import { Router, Request, Response } from 'express';
import { getDatabase } from '../config/database';
import { PaymentService } from '../services/PaymentService';
import { CREDIT_PACKAGES, WHOP_CONFIG, verifyWhopSignature } from '../config/whop';
import { supabaseAdmin } from '../config/supabase';
import crypto from 'crypto';

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

// 创建支付订单
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { packageId, successUrl, cancelUrl } = req.body;
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

    const db = await getDatabase();
    const paymentService = new PaymentService(db);

    // 创建支付记录
    const payment = await paymentService.createPayment({
      packageId,
      userEmail: user.email!,
      userId: user.id,
      successUrl,
      cancelUrl
    });

    // 创建 Whop 支付链接
    const checkoutUrl = await paymentService.generateWhopCheckoutUrl(payment);

    res.json({
      success: true,
      data: {
        paymentId: payment._id,
        checkoutUrl,
        package: {
          id: payment.packageId,
          name: payment.packageName,
          credits: payment.credits,
          bonusCredits: payment.bonusCredits,
          amount: payment.amount,
          currency: payment.currency
        }
      }
    });

  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment'
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
        
        // 如果有 metadata，使用新方法处理
        if (metadata.payment_id) {
          const success = await paymentService.completePaymentByMetadata(metadata);
          
          if (success) {
            console.log('✅ Payment completed successfully via metadata');
          } else {
            console.error('❌ Failed to complete payment via metadata');
          }
        } else {
          // 兼容旧方法
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