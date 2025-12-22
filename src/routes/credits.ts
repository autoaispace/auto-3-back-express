import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { CreditsService } from '../services/CreditsService';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

// 获取当前用户的积分信息
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No authorization token provided'
      });
    }

    const token = authHeader.substring(7);
    
    // 验证token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // 获取用户积分信息
    const db = await getDatabase();
    const creditsService = new CreditsService(db);
    const userCredits = await creditsService.getUserCreditsByEmail(user.email!);

    if (!userCredits) {
      return res.status(404).json({
        success: false,
        message: 'User credits not found'
      });
    }

    res.json({
      success: true,
      data: userCredits
    });
  } catch (error) {
    console.error('Get user credits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user credits'
    });
  }
});

// 通过邮箱获取用户积分信息（用于Google登录用户）
router.get('/by-email/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const db = await getDatabase();
    const creditsService = new CreditsService(db);
    const userCredits = await creditsService.getUserCreditsByEmail(decodeURIComponent(email));

    if (!userCredits) {
      return res.status(404).json({
        success: false,
        message: 'User credits not found'
      });
    }

    res.json({
      success: true,
      data: userCredits
    });
  } catch (error) {
    console.error('Get user credits by email error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user credits'
    });
  }
});

// 获取用户积分交易记录
router.get('/transactions/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const db = await getDatabase();
    const creditsService = new CreditsService(db);
    
    // 先获取用户积分信息以获取userId
    const userCredits = await creditsService.getUserCreditsByEmail(decodeURIComponent(email));
    if (!userCredits) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const transactions = await creditsService.getUserTransactions(userCredits.userId, limit);

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Get user transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user transactions'
    });
  }
});

// 管理员接口：给用户添加积分
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { userEmail, amount, description } = req.body;
    
    if (!userEmail || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'userEmail, amount, and description are required'
      });
    }

    const db = await getDatabase();
    const creditsService = new CreditsService(db);
    
    // 获取用户信息
    const userCredits = await creditsService.getUserCreditsByEmail(userEmail);
    if (!userCredits) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedCredits = await creditsService.addCredits(
      userCredits.userId,
      userEmail,
      amount,
      description
    );

    if (updatedCredits) {
      res.json({
        success: true,
        message: 'Credits added successfully',
        data: updatedCredits
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to add credits'
      });
    }
  } catch (error) {
    console.error('Add credits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add credits'
    });
  }
});

// 管理员接口：扣除用户积分
router.post('/spend', async (req: Request, res: Response) => {
  try {
    const { userEmail, amount, description } = req.body;
    
    if (!userEmail || !amount || !description) {
      return res.status(400).json({
        success: false,
        message: 'userEmail, amount, and description are required'
      });
    }

    const db = await getDatabase();
    const creditsService = new CreditsService(db);
    
    // 获取用户信息
    const userCredits = await creditsService.getUserCreditsByEmail(userEmail);
    if (!userCredits) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const updatedCredits = await creditsService.spendCredits(
      userCredits.userId,
      userEmail,
      amount,
      description
    );

    if (updatedCredits) {
      res.json({
        success: true,
        message: 'Credits spent successfully',
        data: updatedCredits
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Insufficient credits or failed to spend credits'
      });
    }
  } catch (error) {
    console.error('Spend credits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to spend credits'
    });
  }
});

// 测试接口：获取所有用户积分
router.get('/test/all', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const creditsCollection = db.collection('user_credits');
    const allCredits = await creditsCollection.find({}).limit(20).toArray();
    
    res.json({
      success: true,
      message: 'All user credits',
      count: allCredits.length,
      data: allCredits
    });
  } catch (error) {
    console.error('Get all credits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get all credits'
    });
  }
});

export { router as creditsRouter };