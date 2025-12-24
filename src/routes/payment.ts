import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { PaymentService } from '../services/PaymentService';
import { CREDIT_PACKAGES, verifyWhopSignature } from '../config/whop';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

// 获取用户积分交易记录
router.get('/user/credit-transactions', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

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

    const db = await getDatabase();
    
    // 获取用户的积分交易记录
    const transactions = await db.collection('credit_transactions')
      .find({ user_id: user.id })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // 获取总数
    const total = await db.collection('credit_transactions').countDocuments({ user_id: user.id });

    res.json({
      success: true,
      data: {
        transactions: transactions,
        pagination: {
          total: total,
          limit: limit,
          offset: offset,
          hasMore: offset + limit < total
        }
      }
    });

  } catch (error) {
    console.error('Get credit transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit transactions'
    });
  }
});

// 获取用户积分
router.get('/user/credits', async (req: Request, res: Response) => {
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

    const db = await getDatabase();
    
    // 首先从users表获取用户的ObjectId
    const mongoUser = await db.collection('users').findOne({ 
      $or: [
        { user_id: user.id },
        { email: user.email }
      ]
    });
    
    if (!mongoUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found in database'
      });
    }
    
    const userObjectId = mongoUser._id;
    
    // 从MongoDB的user_credits表获取用户积分（兼容多种字段格式）
    const userCredits = await db.collection('user_credits').findOne({ 
      $or: [
        { userId: userObjectId.toString() }, // 原有格式：userId字段存储ObjectId字符串
        { userId: userObjectId },            // 原有格式：userId字段存储ObjectId
        { user_id: user.id },                // 新格式：user_id字段存储Supabase UUID
        { userEmail: user.email },           // 通过邮箱匹配
        { email: user.email }                // 通过邮箱匹配（不同字段名）
      ]
    });

    // 获取积分余额（兼容不同的字段名）
    let credits = 0;
    let lastUpdated = null;
    let source = 'not_found';
    
    if (userCredits) {
      credits = userCredits.balance || userCredits.credits || 0;
      lastUpdated = userCredits.updatedAt || userCredits.lastEarnedAt || null;
      source = 'user_credits';
      console.log('✅ 从user_credits表获取积分:', credits);
    } else {
      // 如果user_credits表中没有记录，从users表获取（兜底）
      console.log('⚠️ user_credits表中未找到记录，从users表获取');
      credits = mongoUser.credits || 0;
      lastUpdated = mongoUser.updatedAt || null;
      source = 'users';
    }

    res.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        credits: credits,
        lastUpdated: lastUpdated,
        source: source,
        userObjectId: userObjectId.toString()
      }
    });

  } catch (error) {
    console.error('Get user credits error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user credits'
    });
  }
});

// 获取积分套餐列表
router.get('/packages', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: CREDIT_PACKAGES
    });
  } catch (error) {
    console.error('Get packages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get packages'
    });
  }
});

// 创建支付订单 (内嵌支付)
router.post('/create-embedded', async (req: Request, res: Response) => {
  try {
    const { packageId } = req.body;
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

    if (!packageId) {
      return res.status(400).json({
        success: false,
        message: 'Package ID is required'
      });
    }

    // 导入 createWhopCheckoutConfig 函数
    const { createWhopCheckoutConfig } = await import('../config/whop');

    // 创建 Whop checkout configuration
    const { sessionId, packageInfo } = await createWhopCheckoutConfig(
      user.id,
      packageId,
      user.email!
    );

    res.json({
      success: true,
      data: {
        sessionId,
        package: {
          id: packageInfo.id,
          name: packageInfo.name,
          credits: packageInfo.credits,
          bonusCredits: packageInfo.bonus || 0,
          amount: packageInfo.price,
          currency: packageInfo.currency
        }
      }
    });

  } catch (error) {
    console.error('Create embedded payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create embedded payment'
    });
  }
});

// 获取支付详情
router.get('/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
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

    const db = await getDatabase();
    const paymentService = new PaymentService(db);

    const payment = await paymentService.getPayment(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // 确保用户只能查看自己的支付记录
    if (payment.userId !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment'
    });
  }
});

// 获取用户支付历史
router.get('/user/history', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const limit = parseInt(req.query.limit as string) || 20;

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

    const db = await getDatabase();
    const paymentService = new PaymentService(db);

    const payments = await paymentService.getUserPayments(user.id, limit);

    res.json({
      success: true,
      data: payments
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment history'
    });
  }
});

// Whop Webhook 处理
router.post('/webhook/whop', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['whop-signature'] as string;
    const payload = JSON.stringify(req.body);

    console.log('📨 Received Whop webhook:', {
      headers: req.headers,
      body: req.body,
      signature: signature ? signature.substring(0, 20) + '...' : 'none'
    });

    // 验证 webhook 签名（如果配置了）
    if (signature && !verifyWhopSignature(payload, signature)) {
      console.error('❌ Invalid Whop webhook signature');
      return res.status(401).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    const event = req.body;
    const db = await getDatabase();
    const paymentService = new PaymentService(db);

    // 处理不同类型的事件
    switch (event.type) {
      case 'payment.completed':
      case 'checkout.completed':
      case 'payment.succeeded':
        console.log('✅ Processing payment completion event');
        
        // 从 webhook 数据中提取 metadata
        const eventData = event.data || event;
        const metadata = eventData.metadata || {};
        
        console.log('📋 Event metadata:', metadata);
        
        // 处理支付成功事件 - 简化版本（只有一个套餐）
        if (event.type === 'payment.succeeded') {
          console.log('🔄 Processing payment.succeeded event (简化版本)...');
          
          // 尝试多种方式获取用户信息
          let userId = null;
          let userEmail = null;
          
          // 方法1: 从 metadata 获取
          if (metadata.user_id && metadata.user_email) {
            console.log('✅ 从 metadata 获取用户信息');
            userId = metadata.user_id;
            userEmail = metadata.user_email;
          }
          // 方法2: 从 eventData 直接获取
          else if (eventData.user_id && eventData.user_email) {
            console.log('✅ 从 eventData 获取用户信息');
            userId = eventData.user_id;
            userEmail = eventData.user_email;
          }
          // 方法3: 从 eventData.user 对象获取 (Whop标准格式)
          else if (eventData.user && eventData.user.id && eventData.user.email) {
            console.log('✅ 从 eventData.user 对象获取用户信息');
            userId = eventData.user.id;
            userEmail = eventData.user.email;
          }
          // 方法4: 从 URL 参数获取
          else if (eventData.checkout_url || eventData.payment_url) {
            console.log('🔍 尝试从 URL 参数获取用户信息');
            const url = eventData.checkout_url || eventData.payment_url;
            if (url) {
              try {
                const urlObj = new URL(url);
                userId = urlObj.searchParams.get('metadata[user_id]') || urlObj.searchParams.get('user_id');
                userEmail = urlObj.searchParams.get('metadata[user_email]') || urlObj.searchParams.get('user_email');
                
                if (userId && userEmail) {
                  console.log('✅ 从 URL 参数获取用户信息成功');
                }
              } catch (e) {
                console.log('❌ 解析 URL 参数失败:', e instanceof Error ? e.message : String(e));
              }
            }
          }
          
          // 如果无法获取用户信息，记录错误并跳过处理
          if (!userId || !userEmail) {
            console.error('❌ 无法获取用户信息，无法处理支付');
            console.log('当前获取到的信息:', { userId, userEmail });
            console.log('📋 完整事件数据:', JSON.stringify(event, null, 2));
            
            // 记录未处理的支付事件，便于手动处理
            try {
              const unprocessedPayment = {
                whopPaymentId: eventData.id || `whop_${Date.now()}`,
                eventType: event.type,
                eventData: eventData,
                metadata: metadata,
                status: 'missing_user_info',
                createdAt: new Date(),
                note: '缺少用户信息：无法自动处理，需要手动添加积分'
              };

              const result = await db.collection('unprocessed_payments').insertOne(unprocessedPayment);
              console.log('📝 未处理支付已记录:', result.insertedId);
              console.log('⚠️ 需要手动处理此支付事件 - 缺少用户信息');
              
            } catch (error) {
              console.error('❌ 记录未处理支付失败:', error);
            }
            
            // 跳过处理，不给任何用户添加积分
            break;
          }
          
          console.log('✅ 确认用户信息有效:', { userId, userEmail });
          
          // 重要：如果获取到的是Whop用户ID，需要通过邮箱查找系统中的用户
          let systemUserId = userId;
          
          // 如果userId看起来像Whop用户ID (以user_开头)，尝试通过邮箱查找系统用户
          if (userId.startsWith('user_')) {
            console.log('🔍 检测到Whop用户ID，尝试通过邮箱查找系统用户...');
            
            try {
              // 通过邮箱查找系统中的用户
              const { data, error } = await supabaseAdmin.auth.admin.listUsers();
              
              if (!error && data && data.users) {
                const systemUser = data.users.find((u: any) => u.email === userEmail);
                if (systemUser) {
                  systemUserId = systemUser.id;
                  console.log(`✅ 通过邮箱找到系统用户: ${userEmail} -> ${systemUserId}`);
                } else {
                  console.log(`⚠️ 系统中未找到邮箱为 ${userEmail} 的用户`);
                  // 记录为未处理，因为无法匹配到系统用户
                  console.log('📝 记录为未处理支付，需要手动处理');
                  
                  const unprocessedPayment = {
                    whopPaymentId: eventData.id || `whop_${Date.now()}`,
                    eventType: event.type,
                    eventData: eventData,
                    metadata: metadata,
                    whopUserId: userId,
                    userEmail: userEmail,
                    status: 'user_not_found',
                    createdAt: new Date(),
                    note: `系统中未找到邮箱为 ${userEmail} 的用户，需要手动处理`
                  };

                  const result = await db.collection('unprocessed_payments').insertOne(unprocessedPayment);
                  console.log('📝 未处理支付已记录:', result.insertedId);
                  break;
                }
              } else {
                console.error('❌ 获取用户列表失败:', error);
                // 继续使用Whop用户ID，但会在后续步骤失败
              }
            } catch (error) {
              console.error('❌ 查找系统用户失败:', error);
              // 继续使用Whop用户ID，但会在后续步骤失败
            }
          }
          
          console.log('👤 最终使用的用户ID:', systemUserId);
          
          try {
            // 简化：直接使用固定的套餐信息（因为只有一个套餐）
            const packageInfo = CREDIT_PACKAGES[0]; // 只有一个套餐，直接取第一个
            const creditsToAdd = 1000; // 固定添加1000积分
            
            console.log('📦 使用套餐信息:', packageInfo);
            console.log('💰 添加积分:', creditsToAdd);

            // 创建支付记录
            const paymentRecord = {
              userId: systemUserId, // 使用系统用户ID
              userEmail: userEmail,
              whopUserId: userId, // 保存原始Whop用户ID
              packageId: packageInfo.id,
              packageName: packageInfo.name,
              credits: creditsToAdd,
              bonusCredits: 0,
              amount: packageInfo.price,
              currency: packageInfo.currency,
              status: 'completed',
              whopPaymentId: eventData.id || `whop_${Date.now()}`,
              completedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // 保存支付记录
            const result = await db.collection('payments').insertOne(paymentRecord);
            console.log('💾 Payment record created:', result.insertedId);

            // 更新用户积分到MongoDB - 完整的积分管理系统
            const totalCredits = creditsToAdd; // 1000积分
            
            try {
              // 1. 首先在users表中找到用户记录，获取用户的_id
              const mongoUser = await db.collection('users').findOne({ 
                $or: [
                  { _id: systemUserId },
                  { email: userEmail },
                  { user_id: systemUserId }
                ]
              });
              
              let userObjectId = null;
              let currentCredits = 0;
              let newCredits = totalCredits;
              
              if (mongoUser) {
                console.log('✅ 在users表中找到用户记录');
                userObjectId = mongoUser._id; // 获取用户的ObjectId
                currentCredits = mongoUser.credits || 0;
                newCredits = currentCredits + totalCredits;
                
                // 更新users表中的积分
                const updateResult = await db.collection('users').updateOne(
                  { _id: mongoUser._id },
                  { 
                    $set: { 
                      credits: newCredits,
                      updatedAt: new Date()
                    }
                  }
                );
                
                console.log(`✅ users表积分已更新: ${currentCredits} + ${totalCredits} = ${newCredits}`);
                console.log('📊 users表更新结果:', updateResult.modifiedCount, '条记录被修改');
              } else {
                console.log('⚠️ users表中未找到用户记录，无法继续处理');
                throw new Error('用户记录不存在');
              }
              
              // 2. 在user_credits表中查找现有记录（使用多种可能的字段匹配）
              console.log('🔄 查找user_credits表中的现有记录...');
              console.log('🔍 查找条件 - userObjectId:', userObjectId, 'systemUserId:', systemUserId, 'userEmail:', userEmail);
              
              const userCreditsRecord = await db.collection('user_credits').findOne({
                $or: [
                  { userId: userObjectId.toString() }, // 原有格式：userId字段存储ObjectId字符串
                  { userId: userObjectId },            // 原有格式：userId字段存储ObjectId
                  { user_id: systemUserId },           // 新格式：user_id字段存储Supabase UUID
                  { userEmail: userEmail },            // 通过邮箱匹配
                  { email: userEmail }                 // 通过邮箱匹配（不同字段名）
                ]
              });
              
              if (userCreditsRecord) {
                console.log('✅ 找到现有的user_credits记录:', userCreditsRecord._id);
                console.log('📋 现有记录结构:', Object.keys(userCreditsRecord));
                
                // 获取当前余额（兼容不同的字段名）
                const currentBalance = userCreditsRecord.balance || userCreditsRecord.credits || 0;
                const newBalance = currentBalance + totalCredits;
                
                // 更新现有记录（保持原有字段结构）
                const updateFields: any = {
                  updatedAt: new Date()
                };
                
                // 根据现有记录的字段结构来更新
                if ('balance' in userCreditsRecord) {
                  updateFields.balance = newBalance;
                  if ('total_earned' in userCreditsRecord) {
                    updateFields.total_earned = (userCreditsRecord.total_earned || 0) + totalCredits;
                  }
                } else if ('credits' in userCreditsRecord) {
                  updateFields.credits = newBalance;
                }
                
                // 更新lastEarnedAt字段（如果存在）
                if ('lastEarnedAt' in userCreditsRecord) {
                  updateFields.lastEarnedAt = new Date();
                }
                
                const creditsUpdateResult = await db.collection('user_credits').updateOne(
                  { _id: userCreditsRecord._id },
                  { $set: updateFields }
                );
                
                console.log(`✅ user_credits表已更新: ${currentBalance} + ${totalCredits} = ${newBalance}`);
                console.log('📊 user_credits表更新结果:', creditsUpdateResult.modifiedCount, '条记录被修改');
                
                // 更新currentCredits为实际的余额
                currentCredits = currentBalance;
                newCredits = newBalance;
              } else {
                console.log('⚠️ user_credits表中未找到现有记录');
                console.log('📝 这可能表示数据不一致，建议检查数据');
                throw new Error('user_credits表中未找到对应记录');
              }
              
              // 3. 创建 credit_transactions 交易记录
              console.log('🔄 创建积分交易记录...');
              
              const transactionRecord = {
                user_id: systemUserId,
                userId: userObjectId.toString(), // 同时保存ObjectId字符串（兼容性）
                email: userEmail,
                type: 'credit', // 积分增加
                amount: totalCredits,
                balance_before: currentCredits,
                balance_after: newCredits,
                source: 'whop_payment',
                source_id: eventData.id, // Whop支付ID
                description: `Whop支付充值 - ${packageInfo.name}`,
                metadata: {
                  whop_payment_id: eventData.id,
                  whop_user_id: userId,
                  package_id: packageInfo.id,
                  package_name: packageInfo.name,
                  payment_amount: packageInfo.price,
                  currency: packageInfo.currency
                },
                status: 'completed',
                createdAt: new Date(),
                updatedAt: new Date()
              };
              
              const transactionResult = await db.collection('credit_transactions').insertOne(transactionRecord);
              console.log('✅ credit_transactions表记录已创建:', transactionResult.insertedId);
              console.log(`📝 交易记录: +${totalCredits} 积分 (${currentCredits} → ${newCredits})`);
              
              console.log(`💰 积分管理完成 - 最终积分: ${newCredits}`);
              
            } catch (mongoError) {
              console.error('❌ MongoDB积分管理失败:', mongoError);
              // 继续处理，不中断流程
            }

            console.log('✅ Payment.succeeded processed successfully (简化版本)');
            
          } catch (error) {
            console.error('❌ Error processing payment.succeeded:', error);
          }
        }
        // 处理直接链接支付（兼容之前的实现）
        else if (metadata.user_id && metadata.user_email && metadata.package_id && metadata.credits) {
          console.log('🔄 Processing direct link payment...');
          
          try {
            // 查找套餐信息
            const packageInfo = CREDIT_PACKAGES.find(pkg => pkg.id === metadata.package_id);
            if (!packageInfo) {
              console.error('❌ Package not found:', metadata.package_id);
              break;
            }

            // 创建支付记录
            const paymentRecord = {
              userId: metadata.user_id,
              userEmail: metadata.user_email,
              packageId: metadata.package_id,
              packageName: packageInfo.name,
              credits: parseInt(metadata.credits),
              bonusCredits: 0,
              amount: packageInfo.price,
              currency: packageInfo.currency,
              status: 'completed',
              whopPaymentId: eventData.id || `whop_${Date.now()}`,
              completedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // 保存支付记录
            const result = await db.collection('payments').insertOne(paymentRecord);
            console.log('💾 Payment record created:', result.insertedId);

            // 更新用户积分
            const totalCredits = paymentRecord.credits + paymentRecord.bonusCredits;
            
            // 使用 Supabase Admin 更新用户积分
            const { data: user, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(metadata.user_id);
            
            if (getUserError || !user) {
              console.error('❌ Failed to get user:', getUserError);
              break;
            }

            // 更新用户的 user_metadata
            const currentCredits = user.user.user_metadata?.credits || 0;
            const newCredits = currentCredits + totalCredits;

            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
              metadata.user_id,
              {
                user_metadata: {
                  ...user.user.user_metadata,
                  credits: newCredits
                }
              }
            );

            if (updateError) {
              console.error('❌ Failed to update user credits:', updateError);
            } else {
              console.log(`✅ User credits updated: ${currentCredits} + ${totalCredits} = ${newCredits}`);
            }

            console.log('✅ Direct link payment processed successfully');
            
          } catch (error) {
            console.error('❌ Error processing direct link payment:', error);
          }
        }
        // 处理传统支付记录方式（兼容旧方法）
        else if (metadata.payment_id) {
          const success = await paymentService.completePaymentByMetadata(metadata);
          
          if (success) {
            console.log('✅ Payment completed successfully via metadata');
          } else {
            console.error('❌ Failed to complete payment via metadata');
          }
        } else {
          // 兼容最旧方法
          const paymentData = eventData;
          const paymentId = paymentData.metadata?.payment_id;
          const whopPaymentId = paymentData.id;

          if (paymentId && whopPaymentId) {
            const success = await paymentService.completePayment(paymentId, whopPaymentId);
            
            if (success) {
              console.log('✅ Payment completed successfully via legacy method');
            } else {
              console.error('❌ Failed to complete payment via legacy method');
            }
          } else {
            console.error('❌ Missing payment identifiers in webhook data');
            
            // 兜底处理：记录未处理的支付事件
            console.log('🔄 Recording unprocessed payment for manual handling...');
            try {
              const unprocessedPayment = {
                whopPaymentId: eventData.id || `whop_${Date.now()}`,
                eventType: event.type,
                eventData: eventData,
                metadata: metadata,
                status: 'needs_manual_processing',
                createdAt: new Date(),
                note: '需要手动处理：无法自动获取用户信息或支付标识符'
              };

              const result = await db.collection('unprocessed_payments').insertOne(unprocessedPayment);
              console.log('📝 Unprocessed payment recorded:', result.insertedId);
              console.log('⚠️ 需要手动处理此支付事件');
              
            } catch (error) {
              console.error('❌ Error recording unprocessed payment:', error);
            }
          }
        }
        break;

      case 'payment.failed':
      case 'checkout.failed':
        console.log('❌ Payment failed:', event.data);
        break;

      default:
        console.log('ℹ️ Unhandled webhook event type:', event.type);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

// 测试支付完成（开发用）
router.post('/test/complete/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Test endpoint not available in production'
      });
    }

    const db = await getDatabase();
    const paymentService = new PaymentService(db);

    const success = await paymentService.completePayment(paymentId, `test_${Date.now()}`);

    res.json({
      success,
      message: success ? 'Payment completed successfully' : 'Failed to complete payment'
    });

  } catch (error) {
    console.error('Test complete payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete test payment'
    });
  }
});

export { router as paymentRouter };