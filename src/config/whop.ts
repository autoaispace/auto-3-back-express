import dotenv from 'dotenv';

dotenv.config();

// Whop 配置
export const WHOP_CONFIG = {
  // Whop API 配置
  API_KEY: process.env.WHOP_API_KEY,
  WEBHOOK_SECRET: process.env.WHOP_WEBHOOK_SECRET,
  COMPANY_ID: process.env.WHOP_COMPANY_ID,
  
  // Whop 产品链接
  PRODUCT_BASE_URL: 'https://whop.com/8429d376-ddb2-4fb6-bebf-b81b25deff04/test-7d-00b2/',
  
  // API 端点
  BASE_URL: 'https://api.whop.com/api/v2',
  
  // 验证必需的环境变量
  validate() {
    if (!this.API_KEY) {
      console.warn('⚠️ WHOP_API_KEY not set');
    }
    if (!this.WEBHOOK_SECRET) {
      console.warn('⚠️ WHOP_WEBHOOK_SECRET not set');
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

// 生成 Whop Checkout URL with metadata
export function generateWhopCheckoutUrl(paymentId: string, userId: string, packageId: string, userEmail: string): string {
  const pkg = getCreditPackage(packageId);
  if (!pkg) {
    throw new Error('Invalid package ID');
  }

  // 构建带 metadata 的 URL
  const baseUrl = WHOP_CONFIG.PRODUCT_BASE_URL;
  const params = new URLSearchParams({
    // Whop 会将这些参数作为 metadata 传递给 webhook
    payment_id: paymentId,
    user_id: userId,
    user_email: userEmail,
    package_id: packageId,
    credits: pkg.credits.toString(),
    bonus_credits: (pkg.bonus || 0).toString(),
    amount: pkg.price.toString()
  });

  return `${baseUrl}?${params.toString()}`;
}

// 验证 Whop webhook 签名
export function verifyWhopSignature(payload: string, signature: string): boolean {
  if (!WHOP_CONFIG.WEBHOOK_SECRET) {
    console.error('❌ WHOP_WEBHOOK_SECRET not configured');
    return false;
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', WHOP_CONFIG.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}