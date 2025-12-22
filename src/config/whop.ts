import dotenv from 'dotenv';

dotenv.config();

// Whop 配置
export const WHOP_CONFIG = {
  // Whop API 配置
  API_KEY: process.env.WHOP_API_KEY,
  WEBHOOK_SECRET: process.env.WHOP_WEBHOOK_SECRET,
  COMPANY_ID: process.env.WHOP_COMPANY_ID,
  
  // API 端点
  BASE_URL: 'https://api.whop.com/api/v2',
  
  // 验证必需的环境变量
  validate() {
    if (!this.API_KEY) {
      throw new Error('WHOP_API_KEY environment variable is required');
    }
    if (!this.WEBHOOK_SECRET) {
      throw new Error('WHOP_WEBHOOK_SECRET environment variable is required');
    }
    if (!this.COMPANY_ID) {
      throw new Error('WHOP_COMPANY_ID environment variable is required');
    }
  }
};

// 积分套餐配置
export const CREDIT_PACKAGES = [
  {
    id: 'credits_100',
    name: '100 积分',
    credits: 100,
    price: 1.00,
    currency: 'USD',
    description: '基础积分包 - 100积分',
    popular: false
  },
  {
    id: 'credits_1000',
    name: '1000 积分',
    credits: 1000,
    price: 10.00,
    currency: 'USD',
    description: '标准积分包 - 1000积分',
    popular: true
  },
  {
    id: 'credits_15000',
    name: '15000 积分',
    credits: 15000,
    price: 100.00,
    currency: 'USD',
    description: '超值积分包 - 15000积分（50%奖励）',
    popular: false,
    bonus: 5000 // 额外奖励积分
  }
];

// 根据套餐ID获取套餐信息
export function getCreditPackage(packageId: string) {
  return CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
}

// 验证 Whop webhook 签名
export function verifyWhopSignature(payload: string, signature: string): boolean {
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', WHOP_CONFIG.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}