import dotenv from 'dotenv';

dotenv.config();

// Whop 配置
export const WHOP_CONFIG = {
  // Whop API 配置
  API_KEY: process.env.WHOP_API_KEY,
  WEBHOOK_SECRET: process.env.WHOP_WEBHOOK_SECRET,
  COMPANY_ID: process.env.WHOP_COMPANY_ID,
  PLAN_ID: process.env.WHOP_PLAN_ID,
  
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
    if (!this.PLAN_ID) {
      console.warn('⚠️ WHOP_PLAN_ID not set');
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

// 创建 Whop Checkout Session
export async function createWhopCheckoutSession(
  paymentId: string, 
  userId: string, 
  packageId: string, 
  userEmail: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<string> {
  const pkg = getCreditPackage(packageId);
  if (!pkg) {
    throw new Error('Invalid package ID');
  }

  if (!WHOP_CONFIG.API_KEY || !WHOP_CONFIG.PLAN_ID || !WHOP_CONFIG.COMPANY_ID) {
    throw new Error('Whop API key, Plan ID, or Company ID not configured');
  }

  try {
    console.log('🔄 Creating Whop checkout session...');
    console.log('🏢 Using Company ID:', WHOP_CONFIG.COMPANY_ID);
    console.log('📋 Using Plan ID:', WHOP_CONFIG.PLAN_ID);
    
    const checkoutData = {
      plan_id: WHOP_CONFIG.PLAN_ID,
      company_id: WHOP_CONFIG.COMPANY_ID,
      customer_email: userEmail,
      success_url: successUrl || `${process.env.SITE_URL}/payment/success`,
      cancel_url: cancelUrl || `${process.env.SITE_URL}/payment/cancel`,
      metadata: {
        payment_id: paymentId,
        user_id: userId,
        user_email: userEmail,
        package_id: packageId,
        credits: pkg.credits.toString(),
        bonus_credits: (pkg.bonus || 0).toString(),
        amount: pkg.price.toString(),
        company_id: WHOP_CONFIG.COMPANY_ID
      }
    };

    console.log('📤 Whop checkout data:', checkoutData);

    const response = await fetch(`${WHOP_CONFIG.BASE_URL}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHOP_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Whop API error:', response.status, errorText);
      throw new Error(`Whop API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as any;
    console.log('✅ Whop checkout session created:', result);

    if (result && result.checkout_url) {
      return result.checkout_url;
    } else {
      throw new Error('No checkout URL returned from Whop API');
    }

  } catch (error) {
    console.error('❌ Failed to create Whop checkout session:', error);
    throw error;
  }
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