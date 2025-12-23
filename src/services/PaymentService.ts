import { Db, ObjectId } from 'mongodb';
import { Payment, PaymentStatus, CreatePaymentRequest } from '../models/Payment';
import { getCreditPackage, createWhopCheckoutConfig } from '../config/whop';
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
      bonusCredits: 0,
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

  // 创建 Whop 内嵌支付配置
  async createWhopCheckoutConfig(payment: Payment): Promise<{ sessionId: string; packageInfo: any }> {
    try {
      console.log('🔄 Creating Whop checkout config for payment:', payment._id);

      // 使用 Whop API 创建 checkout configuration
      const { sessionId, packageInfo } = await createWhopCheckoutConfig(
        payment.userId,
        payment.packageId,
        payment.userEmail
      );

      // 更新支付记录
      const paymentsCollection = this.db.collection<Payment>('payments');
      await paymentsCollection.updateOne(
        { _id: new ObjectId(payment._id as string) },
        {
          $set: {
            whopSessionId: sessionId,
            updatedAt: new Date()
          }
        }
      );

      console.log('✅ Created Whop checkout config:', sessionId);
      return { sessionId, packageInfo };

    } catch (error) {
      console.error('❌ Failed to create Whop checkout config:', error);
      throw new Error('Failed to create payment configuration');
    }
  }

  // 创建 Whop 支付链接 (保持向后兼容)
  async createWhopCheckoutUrl(payment: Payment): Promise<string> {
    try {
      console.log('🔄 Creating Whop checkout session for payment:', payment._id);

      // 对于向后兼容，我们可以返回一个占位符 URL
      // 实际的内嵌支付不需要 URL，而是使用 session ID
      const placeholderUrl = `https://whop.com/checkout/${payment._id}`;

      // 更新支付记录
      const paymentsCollection = this.db.collection<Payment>('payments');
      await paymentsCollection.updateOne(
        { _id: new ObjectId(payment._id as string) },
        {
          $set: {
            whopCheckoutUrl: placeholderUrl,
            updatedAt: new Date()
          }
        }
      );

      console.log('✅ Created placeholder checkout URL:', placeholderUrl);
      return placeholderUrl;

    } catch (error) {
      console.error('❌ Failed to create Whop checkout URL:', error);
      throw new Error('Failed to create payment link');
    }
  }

  // 处理支付完成（通过 webhook metadata）
  async completePaymentByMetadata(metadata: Record<string, any>): Promise<boolean> {
    const paymentsCollection = this.db.collection<Payment>('payments');
    
    try {
      const paymentId = metadata.payment_id;
      const userId = metadata.user_id;
      const userEmail = metadata.user_email;
      const packageId = metadata.package_id;
      const credits = parseInt(metadata.credits || '0');
      const bonusCredits = parseInt(metadata.bonus_credits || '0');

      console.log('🔄 Processing payment completion:', {
        paymentId,
        userId,
        userEmail,
        packageId,
        credits,
        bonusCredits
      });

      if (!paymentId) {
        console.error('❌ No payment_id in metadata');
        return false;
      }

      // 查找支付记录
      const payment = await paymentsCollection.findOne({
        _id: new ObjectId(paymentId)
      });

      if (!payment) {
        console.error('❌ Payment not found:', paymentId);
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
      const totalCredits = credits + bonusCredits;
      const updatedCredits = await this.creditsService.addCredits(
        userId || payment.userId,
        userEmail || payment.userEmail,
        totalCredits,
        `购买积分包：${payment.packageName}`
      );

      if (updatedCredits) {
        console.log('✅ Payment completed and credits added:', {
          paymentId: payment._id,
          userId: userId || payment.userId,
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

  // 处理支付完成（原有方法，保持兼容性）
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