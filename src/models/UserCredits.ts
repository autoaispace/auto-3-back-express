// 用户积分模型定义
export interface UserCredits {
  _id?: string;
  userId: string; // 关联用户的MongoDB _id
  userName: string; // 用户名称
  userEmail: string; // 用户邮箱
  credits: number; // 用户积分
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
  lastEarnedAt?: Date; // 最后获得积分时间
  lastSpentAt?: Date; // 最后消费积分时间
}

// 积分操作类型
export enum CreditOperationType {
  EARN = 'earn', // 获得积分
  SPEND = 'spend', // 消费积分
  BONUS = 'bonus', // 奖励积分
  REFUND = 'refund' // 退还积分
}

// 积分操作记录
export interface CreditTransaction {
  _id?: string;
  userId: string; // 用户ID
  userEmail: string; // 用户邮箱
  type: CreditOperationType; // 操作类型
  amount: number; // 积分数量（正数为获得，负数为消费）
  description: string; // 操作描述
  relatedId?: string; // 关联的订单或活动ID
  createdAt: Date; // 操作时间
}

// 默认积分配置
export const DEFAULT_CREDITS = {
  NEW_USER_BONUS: 100, // 新用户注册奖励
  DAILY_LOGIN_BONUS: 10, // 每日登录奖励
  REFERRAL_BONUS: 50, // 推荐奖励
};