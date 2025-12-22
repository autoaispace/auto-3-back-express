import { Db, ObjectId } from 'mongodb';
import { Payment, PaymentStatus, CreatePaymentRequest, WhopPaymentResponse } from '../models/Payment';
import { WHOP_CONFIG, getCreditPackage } from '../config/whop';
import { CreditsService } from './CreditsService';

export class PaymentService {
  private db: Db;
  private creditsService: CreditsService;

  constructor(db: Db) {
    this.db = db;
    this.creditsService = new CreditsService(db);
  }

  // 创建支付订单
  async createPayment(request: CreatePaymentRequest): Promise<Payment> {
    const paymentsCollection = this.db.collection<Payment>('payments');
    
    // 获取套餐信息
    const creditPackage = getCreditPackage(request.packageId);
    if (!creditPackage) {
      throw new Error('Invalid package ID');
    }

    // 创建支付记录
    const payment: Payment = {
      userId: request.userId,
      userEmail: request.userEmail,
      packageId: request.packageId,
      packageName: creditPackage.name,
      credits: creditPackage.credits,
      bonusCredits: creditPackage.bonus || 0,
      amount: creditPackage.price,
      currency: creditPackage.currency,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        successUrl: request.successUrl,
        cancelUrl: request.cancelUrl
      }
    };

    const result = await paymentsCollection.insertOne(payment);
    const createdPayment = { ...payment, _id: result.insertedId.toString() };

    console.log('✅ Created payment record:', createdPayment);
    return createdPayment;
  }

  // 创建 Whop 支付链接
  async createWhopPayment(payment: Payment): Promise<string> {
    try {
      // 这里需要调用 Whop API 创建支付链接
      // 由于我们没有实际的 Whop API 密钥，这里模拟创建过程
      
      const whopPayload = {
        amount: Math.round(payment.amount * 100), // 转换为分
        currency: payment.currency.toLowerCase(),
        customer_email: payment.userEmail,
        success_url: payment.metadata?.successUrl || `${process.env.SITE_URL}/payment/success`,
        cancel_url: payment.metadata?.cancelUrl || `${process.env.SITE_URL}/payment/cancel`,
        metadata: {
          payment_id: payment._id?.toString(),
          user_id: payment.userId,
          package_id: payment.packageId,
          credits: payment.credits.toString(),
          bonus_credits: (payment.bonusCredits || 0).toString()
        }
      };

      console.log('🔄 Creating Whop payment with payload:', whopPayload);

      // 模拟 Whop API 调用
      // 在实际实现中，这里应该调用真实的 Whop API
      const mockWhopResponse: WhopPaymentResponse = {
        id: `whop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        checkout_url: `https://whop.com/checkout/${payment._id}?amount=${payment.amount}&credits=${payment.credits}`,
        status: 'pending',
        amount: payment.amount,
        currency: payment.currency,
        metadata: whopPayload.metadata
      };

      // 更新支付记录
      const paymentsCollection = this.db.collection<Payment>('payments');
      await paymentsCollection.updateOne(
        { _id: new ObjectId(payment._id as string) },
        {
          $set: {
            whopPaymentId: mockWhopResponse.id,
            whopCheckoutUrl: mockWhopResponse.checkout_url,
            updatedAt: new Date()
          }
        }
      );

      console.log('✅ Created Whop payment:', mockWhopResponse);
      return mockWhopResponse.checkout_url;

    } catch (error) {
      console.error('❌ Failed to create Whop payment:', error);
      throw new Error('Failed to create payment link');
    }
  }

  // 处理支付完成
  async completePayment(paymentId: string, whopPaymentId: string): Promise<boolean> {
    const paymentsCollection = this.db.collection<Payment>('payments');
    
    try {
      // 查找支付记录
      const payment = await paymentsCollection.findOne({
        $or: [
          { _id: new ObjectId(paymentId) },
          { whopPaymentId: whopPaymentId }
        ]
      });

      if (!payment) {
        console.error('❌ Payment not found:', paymentId, whopPaymentId);
        return false;
      }

      if (payment.status === PaymentStatus.COMPLETED) {
        console.log('⚠️ Payment already completed:', payment._id);
        return true;
      }

      // 更新支付状态
      await paymentsCollection.updateOne(
        { _id: payment._id },
        {
          $set: {
            status: PaymentStatus.COMPLETED,
            completedAt: new Date(),
            updatedAt: new Date()
          }
        }
      );

      // 给用户添加积分
      const totalCredits = payment.credits + (payment.bonusCredits || 0);
      const updatedCredits = await this.creditsService.addCredits(
        payment.userId,
        payment.userEmail,
        totalCredits,
        `购买积分包：${payment.packageName}`
      );

      if (updatedCredits) {
        console.log('✅ Payment completed and credits added:', {
          paymentId: payment._id,
          userId: payment.userId,
          credits: totalCredits,
          newBalance: updatedCredits.credits
        });
        return true;
      } else {
        console.error('❌ Failed to add credits for payment:', payment._id);
        return false;
      }

    } catch (error) {
      console.error('❌ Error completing payment:', error);
      return false;
    }
  }

  // 获取用户支付历史
  async getUserPayments(userId: string, limit: number = 20): Promise<Payment[]> {
    const paymentsCollection = this.db.collection<Payment>('payments');
    
    const payments = await paymentsCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return payments;
  }

  // 获取支付详情
  async getPayment(paymentId: string): Promise<Payment | null> {
    const paymentsCollection = this.db.collection<Payment>('payments');
    
    const payment = await paymentsCollection.findOne({
      _id: new ObjectId(paymentId)
    });

    return payment;
  }

  // 取消支付
  async cancelPayment(paymentId: string): Promise<boolean> {
    const paymentsCollection = this.db.collection<Payment>('payments');
    
    const result = await paymentsCollection.updateOne(
      { 
        _id: new ObjectId(paymentId),
        status: PaymentStatus.PENDING
      },
      {
        $set: {
          status: PaymentStatus.CANCELLED,
          updatedAt: new Date()
        }
      }
    );

    return result.modifiedCount > 0;
  }
}