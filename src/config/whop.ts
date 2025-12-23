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
    id: 'credits_1000',
    name: '1000 积分',
    credits: 1000,
    price: 10.00,
    currency: 'USD',
    description: '标准积分包 - 1000积分',
    popular: true
  }
];

// 根据套餐ID获取套餐信息
export function getCreditPackage(packageId: string) {
  return CREDIT_PACKAGES.find(pkg => pkg.id === packageId);
}

// 创建 Whop Checkout Configuration (内嵌支付)
export async function createWhopCheckoutConfig(
  userId: string,
  packageId: string,
  userEmail: string
): Promise<{ sessionId: string; packageInfo: any }> {
  const pkg = getCreditPackage(packageId);
  if (!pkg) {
    throw new Error('Invalid package ID');
  }

  if (!WHOP_CONFIG.API_KEY || !WHOP_CONFIG.COMPANY_ID) {
    throw new Error('Whop API key or Company ID not configured');
  }

  try {
    console.log('🔄 Creating Whop checkout configuration...');
    console.log('🏢 Using Company ID:', WHOP_CONFIG.COMPANY_ID);

    const checkoutConfigData = {
      company_id: WHOP_CONFIG.COMPANY_ID,
      plan: {
        initial_price: pkg.price,
        plan_type: "one_time"
      },
      metadata: {
        user_id: userId,
        user_email: userEmail,
        package_id: packageId,
        credits: pkg.credits.toString(),
        bonus_credits: "0",
        package_name: pkg.name
      }
    };

    console.log('📤 Whop checkout config data:', checkoutConfigData);

    const response = await fetch(`${WHOP_CONFIG.BASE_URL}/checkout_configurations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHOP_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutConfigData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Whop API error:', response.status, errorText);
      throw new Error(`Whop API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as any;
    console.log('✅ Whop checkout configuration created:', result);

    if (result && result.id) {
      return {
        sessionId: result.id,
        packageInfo: pkg
      };
    } else {
      throw new Error('No session ID returned from Whop API');
    }

  } catch (error) {
    console.error('❌ Failed to create Whop checkout configuration:', error);
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