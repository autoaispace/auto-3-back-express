import { ObjectId } from 'mongodb';

// 支付状态
export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded'
}

// 支付记录
export interface Payment {
  _id?: ObjectId | string;
  userId: string;
  userEmail: string;
  packageId: string;
  packageName: string;
  credits: number;
  bonusCredits?: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  whopPaymentId?: string;
  whopCheckoutUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// 支付创建请求
export interface CreatePaymentRequest {
  packageId: string;
  userEmail: string;
  userId: string;
  successUrl?: string;
  cancelUrl?: string;
}

// Whop 支付响应
export interface WhopPaymentResponse {
  id: string;
  checkout_url: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}

// Whop Webhook 事件
export interface WhopWebhookEvent {
  id: string;
  type: string;
  data: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    customer_email: string;
    metadata?: Record<string, any>;
  };
  created_at: string;
}