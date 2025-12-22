import { Db, ObjectId } from 'mongodb';
import { UserCredits, CreditTransaction, CreditOperationType, DEFAULT_CREDITS } from '../models/UserCredits';

export class CreditsService {
    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    // 创建用户积分记录
    async createUserCredits(userId: string, userName: string, userEmail: string): Promise<UserCredits> {
        const creditsCollection = this.db.collection<UserCredits>('user_credits');

        // 检查是否已存在
        const existingCredits = await creditsCollection.findOne({ userId });
        if (existingCredits) {
            console.log('✅ User credits already exist:', existingCredits);
            return existingCredits;
        }

        const newCredits: UserCredits = {
            userId,
            userName,
            userEmail,
            credits: DEFAULT_CREDITS.NEW_USER_BONUS, // 新用户奖励积分
            createdAt: new Date(),
            updatedAt: new Date(),
            lastEarnedAt: new Date()
        };

        const result = await creditsCollection.insertOne(newCredits);
        console.log('✅ Created user credits:', result.insertedId);

        // 记录积分获得记录
        await this.addCreditTransaction(
            userId,
            userEmail,
            CreditOperationType.BONUS,
            DEFAULT_CREDITS.NEW_USER_BONUS,
            '新用户注册奖励'
        );

        return { ...newCredits, _id: result.insertedId.toString() };
    }

    // 获取用户积分信息
    async getUserCredits(userId: string): Promise<UserCredits | null> {
        const creditsCollection = this.db.collection<UserCredits>('user_credits');
        const credits = await creditsCollection.findOne({ userId });

        if (credits) {
            console.log('✅ Found user credits:', credits);
            return credits;
        }

        console.log('❌ No credits found for user:', userId);
        return null;
    }

    // 通过邮箱获取用户积分信息
    async getUserCreditsByEmail(userEmail: string): Promise<UserCredits | null> {
        const creditsCollection = this.db.collection<UserCredits>('user_credits');
        const credits = await creditsCollection.findOne({ userEmail });

        if (credits) {
            console.log('✅ Found user credits by email:', credits);
            return credits;
        }

        console.log('❌ No credits found for email:', userEmail);
        return null;
    }

    // 更新用户积分
    async updateUserCredits(userId: string, newCredits: number): Promise<boolean> {
        const creditsCollection = this.db.collection<UserCredits>('user_credits');

        const result = await creditsCollection.updateOne(
            { userId },
            {
                $set: {
                    credits: newCredits,
                    updatedAt: new Date()
                }
            }
        );

        console.log('✅ Updated user credits:', result.modifiedCount > 0);
        return result.modifiedCount > 0;
    }

    // 增加积分
    async addCredits(userId: string, userEmail: string, amount: number, description: string): Promise<UserCredits | null> {
        const creditsCollection = this.db.collection<UserCredits>('user_credits');

        const result = await creditsCollection.findOneAndUpdate(
            { userId },
            {
                $inc: { credits: amount },
                $set: {
                    updatedAt: new Date(),
                    lastEarnedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (result) {
            // 记录积分变动
            await this.addCreditTransaction(
                userId,
                userEmail,
                CreditOperationType.EARN,
                amount,
                description
            );

            console.log('✅ Added credits:', amount, 'New total:', result.credits);
            return result;
        }

        return null;
    }

    // 消费积分
    async spendCredits(userId: string, userEmail: string, amount: number, description: string): Promise<UserCredits | null> {
        const creditsCollection = this.db.collection<UserCredits>('user_credits');

        // 先检查余额
        const currentCredits = await this.getUserCredits(userId);
        if (!currentCredits || currentCredits.credits < amount) {
            console.log('❌ Insufficient credits:', currentCredits?.credits, 'Required:', amount);
            return null;
        }

        const result = await creditsCollection.findOneAndUpdate(
            { userId },
            {
                $inc: { credits: -amount },
                $set: {
                    updatedAt: new Date(),
                    lastSpentAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (result) {
            // 记录积分变动
            await this.addCreditTransaction(
                userId,
                userEmail,
                CreditOperationType.SPEND,
                -amount,
                description
            );

            console.log('✅ Spent credits:', amount, 'Remaining:', result.credits);
            return result;
        }

        return null;
    }

    // 添加积分交易记录
    async addCreditTransaction(
        userId: string,
        userEmail: string,
        type: CreditOperationType,
        amount: number,
        description: string,
        relatedId?: string
    ): Promise<void> {
        const transactionsCollection = this.db.collection<CreditTransaction>('credit_transactions');

        const transaction: CreditTransaction = {
            userId,
            userEmail,
            type,
            amount,
            description,
            relatedId,
            createdAt: new Date()
        };

        await transactionsCollection.insertOne(transaction);
        console.log('✅ Added credit transaction:', transaction);
    }

    // 获取用户积分交易记录
    async getUserTransactions(userId: string, limit: number = 50): Promise<CreditTransaction[]> {
        const transactionsCollection = this.db.collection<CreditTransaction>('credit_transactions');

        const transactions = await transactionsCollection
            .find({ userId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .toArray();

        console.log('✅ Found transactions:', transactions.length);
        return transactions;
    }
}