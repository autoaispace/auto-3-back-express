import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { PaymentService } from '../services/PaymentService';
import { CREDIT_PACKAGES, verifyWhopSignature } from '../config/whop';
import { supabaseAdmin } from '../config/supabase';

const router = Router();

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
        
        // 处理内嵌支付 (payment.succeeded)
        if (event.type === 'payment.succeeded' && metadata.user_id && metadata.user_email && metadata.package_id) {
          console.log('🔄 Processing embedded payment...');
          
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
              credits: parseInt(metadata.credits) || packageInfo.credits,
              bonusCredits: parseInt(metadata.bonus_credits) || packageInfo.bonus || 0,
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

            console.log('✅ Embedded payment processed successfully');
            
          } catch (error) {
            console.error('❌ Error processing embedded payment:', error);
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
              bonusCredits: packageInfo.bonus || 0,
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