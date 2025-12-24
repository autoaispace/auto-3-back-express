import { Router, Request, Response } from 'express';
import multer from 'multer';
import { GeminiService } from '../services/GeminiService';
import { supabaseAdmin } from '../config/supabase';
import { getDatabase } from '../config/database';
import { GEMINI_CONFIG, validateImageFormat, validateImageSize, base64ToBuffer } from '../config/gemini';

const router = Router();
const geminiService = new GeminiService();

// 配置multer用于文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: GEMINI_CONFIG.IMAGE_CONFIG.MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (validateImageFormat(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的图像格式'));
    }
  },
});

// 验证用户认证的中间件
const authenticateUser = async (req: Request, res: Response, next: any) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided'
      });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // 将用户信息添加到请求对象
    (req as any).user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// 检查用户积分的中间件
const checkUserCredits = async (req: Request, res: Response, next: any) => {
  try {
    const user = (req as any).user;
    const db = await getDatabase();
    
    // 从user_credits表获取用户积分
    const userCredits = await db.collection('user_credits').findOne({
      $or: [
        { userId: user.id },
        { user_id: user.id },
        { userEmail: user.email },
        { email: user.email }
      ]
    });

    const credits = userCredits?.balance || userCredits?.credits || 0;
    const requiredCredits = 10; // 每次生成需要10积分

    if (credits < requiredCredits) {
      return res.status(402).json({
        success: false,
        message: 'Insufficient credits',
        data: {
          currentCredits: credits,
          requiredCredits: requiredCredits
        }
      });
    }

    (req as any).userCredits = credits;
    next();
  } catch (error) {
    console.error('Credits check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check user credits'
    });
  }
};

// 扣除用户积分的函数
const deductUserCredits = async (userId: string, userEmail: string, amount: number, description: string) => {
  try {
    const db = await getDatabase();
    
    // 查找用户积分记录
    const userCredits = await db.collection('user_credits').findOne({
      $or: [
        { userId: userId },
        { user_id: userId },
        { userEmail: userEmail },
        { email: userEmail }
      ]
    });

    if (!userCredits) {
      throw new Error('User credits record not found');
    }

    const currentBalance = userCredits.balance || userCredits.credits || 0;
    const newBalance = currentBalance - amount;

    // 更新积分余额
    const updateFields: any = {
      updatedAt: new Date()
    };

    if ('balance' in userCredits) {
      updateFields.balance = newBalance;
      if ('total_spent' in userCredits) {
        updateFields.total_spent = (userCredits.total_spent || 0) + amount;
      }
    } else if ('credits' in userCredits) {
      updateFields.credits = newBalance;
    }

    await db.collection('user_credits').updateOne(
      { _id: userCredits._id },
      { $set: updateFields }
    );

    // 创建积分交易记录
    const transactionRecord = {
      user_id: userId,
      userId: userCredits.userId || userId,
      email: userEmail,
      type: 'debit',
      amount: amount,
      balance_before: currentBalance,
      balance_after: newBalance,
      source: 'gemini_generation',
      description: description,
      metadata: {
        service: 'gemini',
        action: 'image_generation'
      },
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('credit_transactions').insertOne(transactionRecord);
    
    console.log(`✅ 用户积分已扣除: ${currentBalance} - ${amount} = ${newBalance}`);
    return newBalance;
  } catch (error) {
    console.error('❌ 扣除积分失败:', error);
    throw error;
  }
};

// 文生图接口
router.post('/text-to-image', authenticateUser, checkUserCredits, async (req: Request, res: Response) => {
  try {
    const { prompt, style, width, height, negativePrompt } = req.body;
    const user = (req as any).user;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    console.log('🎨 文生图请求:', { userId: user.id, prompt: prompt.substring(0, 100) });

    // 调用Gemini服务生成图像
    const result = await geminiService.generateImageFromText({
      prompt: prompt.trim(),
      style,
      width: width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
      height: height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT,
      negativePrompt
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    // 扣除积分
    try {
      const newBalance = await deductUserCredits(
        user.id,
        user.email,
        10,
        `文生图生成: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`
      );
      
      if (result.metadata) {
        result.metadata.creditsUsed = 10;
        result.metadata.remainingCredits = newBalance;
      }
    } catch (creditError) {
      console.error('❌ 积分扣除失败:', creditError);
      // 继续返回结果，但记录错误
    }

    console.log('✅ 文生图生成成功');
    res.json(result);

  } catch (error) {
    console.error('❌ 文生图生成失败:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '图像生成失败'
    });
  }
});

// 图生图接口
router.post('/image-to-image', authenticateUser, checkUserCredits, upload.single('image'), async (req: Request, res: Response) => {
  try {
    const { prompt, style, strength, width, height } = req.body;
    const user = (req as any).user;
    const imageFile = req.file;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    if (!imageFile) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    // 验证图像
    if (!validateImageSize(imageFile.buffer)) {
      return res.status(400).json({
        success: false,
        message: 'Image file is too large'
      });
    }

    console.log('🖼️ 图生图请求:', { 
      userId: user.id, 
      prompt: prompt.substring(0, 100),
      imageSize: imageFile.size,
      imageMimeType: imageFile.mimetype
    });

    // 将图像转换为base64
    const imageData = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString('base64')}`;

    // 调用Gemini服务生成图像
    const result = await geminiService.generateImageFromImage({
      prompt: prompt.trim(),
      imageData,
      style,
      strength: parseFloat(strength) || 0.7,
      width: parseInt(width) || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
      height: parseInt(height) || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    // 扣除积分
    try {
      const newBalance = await deductUserCredits(
        user.id,
        user.email,
        15, // 图生图消耗更多积分
        `图生图生成: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`
      );
      
      if (result.metadata) {
        result.metadata.creditsUsed = 15;
        result.metadata.remainingCredits = newBalance;
      }
    } catch (creditError) {
      console.error('❌ 积分扣除失败:', creditError);
    }

    console.log('✅ 图生图生成成功');
    res.json(result);

  } catch (error) {
    console.error('❌ 图生图生成失败:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '图像生成失败'
    });
  }
});

// 图生图接口（base64版本）
router.post('/image-to-image-base64', authenticateUser, checkUserCredits, async (req: Request, res: Response) => {
  try {
    const { prompt, imageData, style, strength, width, height } = req.body;
    const user = (req as any).user;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Prompt is required'
      });
    }

    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Image data is required'
      });
    }

    // 验证base64图像
    try {
      const { buffer, mimeType } = base64ToBuffer(imageData);
      
      if (!validateImageFormat(mimeType)) {
        return res.status(400).json({
          success: false,
          message: `Unsupported image format: ${mimeType}`
        });
      }
      
      if (!validateImageSize(buffer)) {
        return res.status(400).json({
          success: false,
          message: 'Image file is too large'
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image data format'
      });
    }

    console.log('🖼️ 图生图请求(base64):', { 
      userId: user.id, 
      prompt: prompt.substring(0, 100)
    });

    // 调用Gemini服务生成图像
    const result = await geminiService.generateImageFromImage({
      prompt: prompt.trim(),
      imageData,
      style,
      strength: parseFloat(strength) || 0.7,
      width: parseInt(width) || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
      height: parseInt(height) || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    // 扣除积分
    try {
      const newBalance = await deductUserCredits(
        user.id,
        user.email,
        15,
        `图生图生成: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`
      );
      
      if (result.metadata) {
        result.metadata.creditsUsed = 15;
        result.metadata.remainingCredits = newBalance;
      }
    } catch (creditError) {
      console.error('❌ 积分扣除失败:', creditError);
    }

    console.log('✅ 图生图生成成功(base64)');
    res.json(result);

  } catch (error) {
    console.error('❌ 图生图生成失败:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '图像生成失败'
    });
  }
});

// 获取生成历史
router.get('/history', authenticateUser, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const db = await getDatabase();
    
    // 获取用户的Gemini生成历史（从积分交易记录中获取）
    const transactions = await db.collection('credit_transactions')
      .find({ 
        user_id: user.id,
        source: 'gemini_generation',
        type: 'debit'
      })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const total = await db.collection('credit_transactions').countDocuments({
      user_id: user.id,
      source: 'gemini_generation',
      type: 'debit'
    });

    res.json({
      success: true,
      data: {
        history: transactions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('❌ 获取生成历史失败:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get generation history'
    });
  }
});

// 测试API连接
router.get('/test', async (req: Request, res: Response) => {
  try {
    const isConnected = await geminiService.testConnection();
    
    res.json({
      success: true,
      data: {
        connected: isConnected,
        config: {
          hasApiKey: !!GEMINI_CONFIG.API_KEY,
          projectId: GEMINI_CONFIG.PROJECT_ID,
          models: GEMINI_CONFIG.MODELS
        }
      }
    });
  } catch (error) {
    console.error('❌ API测试失败:', error);
    res.status(500).json({
      success: false,
      message: 'API test failed'
    });
  }
});

export { router as geminiRouter };