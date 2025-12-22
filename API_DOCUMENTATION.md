# InkGenius Pro Backend API 接口文档

**Base URL**: `https://inkgeniusapi.digworldai.com`

## 目录
- [基础接口](#基础接口)
- [认证接口](#认证接口)
- [邮件订阅接口](#邮件订阅接口)
- [积分系统接口](#积分系统接口)
- [支付系统接口](#支付系统接口)

---

## 基础接口

### 1. 获取 API 信息
**GET** `/`

获取 API 基本信息和可用端点列表。

**响应示例**:
```json
{
  "name": "InkGenius Pro Backend API",
  "version": "1.0.0",
  "status": "running",
  "timestamp": "2024-12-22T10:00:00.000Z",
  "environment": "production",
  "endpoints": {
    "health": "/health",
    "auth": {
      "google": "/api/auth/google",
      "me": "/api/auth/me",
      "logout": "/api/auth/logout"
    },
    "api": {
      "subscribe": "/api/subscribe",
      "credits": "/api/credits"
    }
  },
  "documentation": "https://github.com/your-repo/auto-3-back-express"
}
```

### 2. 健康检查
**GET** `/health`

检查服务器运行状态。

**响应示例**:
```json
{
  "status": "ok",
  "timestamp": "2024-12-22T10:00:00.000Z",
  "environment": "production"
}
```

---

## 认证接口

### 1. Google OAuth 登录
**GET** `/api/auth/google`

发起 Google OAuth 登录流程。

**说明**: 
- 用户访问此端点会被重定向到 Google 登录页面
- 登录成功后会重定向到 `/api/auth/callback`

### 2. Google OAuth 回调
**GET** `/api/auth/callback`

Google OAuth 登录回调处理。

**说明**: 
- 由 Google OAuth 自动调用
- 成功后重定向到前端页面，携带用户信息参数

### 3. 获取当前用户信息
**GET** `/api/auth/me`

获取当前登录用户的详细信息。

**请求头**:
```
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "user": {
    "id": "user-supabase-id",
    "email": "user@example.com",
    "name": "User Name",
    "avatar": "https://avatar-url.com/avatar.jpg",
    "googleId": "google-user-id",
    "createdAt": "2024-12-22T10:00:00.000Z",
    "lastLogin": "2024-12-22T10:00:00.000Z"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "No authorization token provided"
}
```

### 4. 用户登出
**POST** `/api/auth/logout`

登出当前用户。

**响应示例**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 5. 测试数据库连接
**GET** `/api/auth/test/db`

测试 MongoDB 连接并获取用户列表（开发/测试用）。

**响应示例**:
```json
{
  "success": true,
  "message": "Database connection successful",
  "userCount": 5,
  "users": [
    {
      "_id": "user-mongodb-id",
      "email": "user@example.com",
      "name": "User Name",
      "googleId": "google-id",
      "supabaseUserId": "supabase-id",
      "createdAt": "2024-12-22T10:00:00.000Z",
      "lastLogin": "2024-12-22T10:00:00.000Z"
    }
  ]
}
```

### 6. 测试回调端点
**GET** `/api/auth/test/callback`

测试回调端点功能（开发/测试用）。

**响应示例**:
```json
{
  "success": true,
  "message": "Callback test endpoint working",
  "query": {},
  "timestamp": "2024-12-22T10:00:00.000Z",
  "environment": "production",
  "siteUrl": "https://inkgenius.digworldai.com"
}
```

### 7. 创建测试用户
**POST** `/api/auth/test/create-user`

创建测试用户（开发/测试用）。

**请求体**:
```json
{
  "email": "test@example.com",
  "name": "Test User"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Test user created successfully",
  "userId": "mongodb-object-id",
  "userData": {
    "email": "test@example.com",
    "name": "Test User",
    "googleId": "test_1703251200000",
    "supabaseUserId": "test_supabase_1703251200000",
    "lastLogin": "2024-12-22T10:00:00.000Z",
    "createdAt": "2024-12-22T10:00:00.000Z",
    "updatedAt": "2024-12-22T10:00:00.000Z"
  }
}
```

---

## 邮件订阅接口

### 1. 邮件订阅
**POST** `/api/subscribe`

用户邮件订阅功能。

**请求体**:
```json
{
  "email": "user@example.com",
  "source": "inkgenius-pro纹身",
  "pageUrl": "https://inkgenius.pro/features",
  "referrer": "google.com"
}
```

**字段说明**:
- `email` (必填): 用户邮箱
- `source` (可选): 订阅来源
- `pageUrl` (可选): 订阅页面URL
- `referrer` (可选): 来源页面

**成功响应**:
```json
{
  "success": true,
  "message": "Subscription successful",
  "data": {
    "email": "user@example.com",
    "subscribedAt": "2024-12-22T10:00:00.000Z"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "message": "Email is required"
}
```

```json
{
  "success": false,
  "message": "Invalid email format"
}
```

---

## 积分系统接口

### 1. 获取当前用户积分
**GET** `/api/credits/me`

获取当前登录用户的积分信息。

**请求头**:
```
Authorization: Bearer <token>
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "_id": "mongodb-object-id",
    "userId": "user-id",
    "userName": "User Name",
    "userEmail": "user@example.com",
    "credits": 100,
    "totalEarned": 100,
    "totalSpent": 0,
    "createdAt": "2024-12-22T10:00:00.000Z",
    "updatedAt": "2024-12-22T10:00:00.000Z"
  }
}
```

### 2. 通过邮箱获取用户积分
**GET** `/api/credits/by-email/{email}`

通过邮箱获取用户积分信息。

**路径参数**:
- `email`: 用户邮箱（需要URL编码）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "_id": "mongodb-object-id",
    "userId": "user-id",
    "userName": "User Name",
    "userEmail": "user@example.com",
    "credits": 100,
    "totalEarned": 100,
    "totalSpent": 0,
    "createdAt": "2024-12-22T10:00:00.000Z",
    "updatedAt": "2024-12-22T10:00:00.000Z"
  }
}
```

### 3. 获取用户积分交易记录
**GET** `/api/credits/transactions/{email}`

获取用户的积分交易历史记录。

**路径参数**:
- `email`: 用户邮箱（需要URL编码）

**查询参数**:
- `limit` (可选): 返回记录数量限制，默认50

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "transaction-id",
      "userId": "user-id",
      "userEmail": "user@example.com",
      "type": "earn",
      "amount": 50,
      "description": "注册奖励",
      "balanceAfter": 100,
      "createdAt": "2024-12-22T10:00:00.000Z"
    },
    {
      "_id": "transaction-id-2",
      "userId": "user-id",
      "userEmail": "user@example.com",
      "type": "spend",
      "amount": 10,
      "description": "生成纹身设计",
      "balanceAfter": 90,
      "createdAt": "2024-12-22T09:00:00.000Z"
    }
  ]
}
```

### 4. 添加用户积分（管理员）
**POST** `/api/credits/add`

管理员接口：给用户添加积分。

**请求体**:
```json
{
  "userEmail": "user@example.com",
  "amount": 50,
  "description": "管理员奖励"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Credits added successfully",
  "data": {
    "_id": "mongodb-object-id",
    "userId": "user-id",
    "userName": "User Name",
    "userEmail": "user@example.com",
    "credits": 150,
    "totalEarned": 150,
    "totalSpent": 0,
    "createdAt": "2024-12-22T10:00:00.000Z",
    "updatedAt": "2024-12-22T10:30:00.000Z"
  }
}
```

### 5. 扣除用户积分（管理员）
**POST** `/api/credits/spend`

管理员接口：扣除用户积分。

**请求体**:
```json
{
  "userEmail": "user@example.com",
  "amount": 20,
  "description": "使用AI生成纹身"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "Credits spent successfully",
  "data": {
    "_id": "mongodb-object-id",
    "userId": "user-id",
    "userName": "User Name",
    "userEmail": "user@example.com",
    "credits": 130,
    "totalEarned": 150,
    "totalSpent": 20,
    "createdAt": "2024-12-22T10:00:00.000Z",
    "updatedAt": "2024-12-22T10:45:00.000Z"
  }
}
```

### 6. 批量初始化所有用户积分（管理员）
**POST** `/api/credits/initialize-all`

管理员接口：为所有现有用户初始化积分记录。

**响应示例**:
```json
{
  "success": true,
  "message": "Batch initialization completed",
  "summary": {
    "total": 10,
    "created": 8,
    "skipped": 2,
    "errors": 0
  },
  "results": [
    {
      "email": "user1@example.com",
      "status": "created",
      "credits": 100
    },
    {
      "email": "user2@example.com",
      "status": "already_exists",
      "credits": 150
    }
  ]
}
```

### 7. 初始化单个用户积分
**POST** `/api/credits/initialize/{email}`

为指定用户初始化积分记录。

**路径参数**:
- `email`: 用户邮箱（需要URL编码）

**响应示例**:
```json
{
  "success": true,
  "message": "User credits initialized successfully",
  "data": {
    "_id": "mongodb-object-id",
    "userId": "user-id",
    "userName": "User Name",
    "userEmail": "user@example.com",
    "credits": 100,
    "totalEarned": 100,
    "totalSpent": 0,
    "createdAt": "2024-12-22T10:00:00.000Z",
    "updatedAt": "2024-12-22T10:00:00.000Z"
  }
}
```

### 8. 获取所有用户积分（测试）
**GET** `/api/credits/test/all`

测试接口：获取所有用户积分信息。

**响应示例**:
```json
{
  "success": true,
  "message": "All user credits",
  "count": 5,
  "data": [
    {
      "_id": "mongodb-object-id",
      "userId": "user-id-1",
      "userName": "User 1",
      "userEmail": "user1@example.com",
      "credits": 100,
      "totalEarned": 100,
      "totalSpent": 0,
      "createdAt": "2024-12-22T10:00:00.000Z",
      "updatedAt": "2024-12-22T10:00:00.000Z"
    }
  ]
}
```

---

## 错误响应格式

所有接口的错误响应都遵循以下格式：

```json
{
  "success": false,
  "message": "错误描述信息"
}
```

常见HTTP状态码：
- `200`: 成功
- `400`: 请求参数错误
- `401`: 未授权/token无效
- `404`: 资源不存在
- `500`: 服务器内部错误

---

## 认证说明

需要认证的接口需要在请求头中包含：
```
Authorization: Bearer <supabase-jwt-token>
```

获取token的方式：
1. 通过Google OAuth登录获取
2. 使用Supabase客户端SDK获取

---

## 环境信息

- **生产环境**: `https://inkgeniusapi.digworldai.com`
- **开发环境**: `http://localhost:8080`
- **数据库**: MongoDB
- **认证服务**: Supabase
- **OAuth提供商**: Google

---

## 更新日志

- **v1.0.0**: 初始版本，包含基础认证、邮件订阅和积分系统功能
---


## 支付系统接口

### 1. 获取积分套餐列表
**GET** `/api/payment/packages`

获取所有可用的积分套餐。

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "credits_100",
      "name": "100 积分",
      "credits": 100,
      "price": 1.00,
      "currency": "USD",
      "description": "基础积分包 - 100积分",
      "popular": false
    },
    {
      "id": "credits_1000",
      "name": "1000 积分",
      "credits": 1000,
      "price": 10.00,
      "currency": "USD",
      "description": "标准积分包 - 1000积分",
      "popular": true
    },
    {
      "id": "credits_15000",
      "name": "15000 积分",
      "credits": 15000,
      "price": 100.00,
      "currency": "USD",
      "description": "超值积分包 - 15000积分（50%奖励）",
      "popular": false,
      "bonus": 5000
    }
  ]
}
```

### 2. 创建支付订单
**POST** `/api/payment/create`

创建支付订单并获取 Whop 支付链接。

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "packageId": "credits_1000",
  "successUrl": "https://yoursite.com/payment/success",
  "cancelUrl": "https://yoursite.com/payment/cancel"
}
```

**字段说明**:
- `packageId` (必填): 套餐ID
- `successUrl` (可选): 支付成功后的回调URL
- `cancelUrl` (可选): 支付取消后的回调URL

**成功响应**:
```json
{
  "success": true,
  "data": {
    "paymentId": "payment-mongodb-id",
    "checkoutUrl": "https://whop.com/checkout/...",
    "package": {
      "id": "credits_1000",
      "name": "1000 积分",
      "credits": 1000,
      "bonusCredits": 0,
      "amount": 10.00,
      "currency": "USD"
    }
  }
}
```

### 3. 获取支付详情
**GET** `/api/payment/{paymentId}`

获取指定支付订单的详细信息。

**请求头**:
```
Authorization: Bearer <token>
```

**路径参数**:
- `paymentId`: 支付订单ID

**响应示例**:
```json
{
  "success": true,
  "data": {
    "_id": "payment-id",
    "userId": "user-id",
    "userEmail": "user@example.com",
    "packageId": "credits_1000",
    "packageName": "1000 积分",
    "credits": 1000,
    "bonusCredits": 0,
    "amount": 10.00,
    "currency": "USD",
    "status": "completed",
    "whopPaymentId": "whop_payment_id",
    "whopCheckoutUrl": "https://whop.com/checkout/...",
    "createdAt": "2024-12-22T10:00:00.000Z",
    "updatedAt": "2024-12-22T10:05:00.000Z",
    "completedAt": "2024-12-22T10:05:00.000Z"
  }
}
```

### 4. 获取用户支付历史
**GET** `/api/payment/user/history`

获取当前用户的支付历史记录。

**请求头**:
```
Authorization: Bearer <token>
```

**查询参数**:
- `limit` (可选): 返回记录数量限制，默认20

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "payment-id-1",
      "userId": "user-id",
      "userEmail": "user@example.com",
      "packageId": "credits_1000",
      "packageName": "1000 积分",
      "credits": 1000,
      "amount": 10.00,
      "currency": "USD",
      "status": "completed",
      "createdAt": "2024-12-22T10:00:00.000Z",
      "completedAt": "2024-12-22T10:05:00.000Z"
    }
  ]
}
```

### 5. Whop Webhook 处理
**POST** `/api/payment/webhook/whop`

处理 Whop 支付回调通知（由 Whop 系统调用）。

**请求头**:
```
whop-signature: <webhook-signature>
```

**请求体**:
```json
{
  "id": "event-id",
  "type": "payment.completed",
  "data": {
    "id": "whop-payment-id",
    "status": "completed",
    "amount": 1000,
    "currency": "usd",
    "customer_email": "user@example.com",
    "metadata": {
      "payment_id": "mongodb-payment-id",
      "user_id": "user-id",
      "package_id": "credits_1000",
      "credits": "1000"
    }
  },
  "created_at": "2024-12-22T10:05:00.000Z"
}
```

**响应示例**:
```json
{
  "success": true
}
```

### 6. 测试支付完成（开发用）
**POST** `/api/payment/test/complete/{paymentId}`

测试接口：模拟支付完成（仅开发环境可用）。

**路径参数**:
- `paymentId`: 支付订单ID

**响应示例**:
```json
{
  "success": true,
  "message": "Payment completed successfully"
}
```

---

## 支付流程说明

### 前端支付流程

1. **获取套餐列表**
   ```javascript
   const response = await fetch('/api/payment/packages');
   const packages = await response.json();
   ```

2. **创建支付订单**
   ```javascript
   const response = await fetch('/api/payment/create', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       packageId: 'credits_1000',
       successUrl: window.location.origin + '/payment/success',
       cancelUrl: window.location.origin + '/payment/cancel'
     })
   });
   ```

3. **跳转到支付页面**
   ```javascript
   const data = await response.json();
   if (data.success) {
     window.location.href = data.data.checkoutUrl;
   }
   ```

### Whop 配置要求

在 Whop 后台需要配置以下信息：

1. **Webhook URL**: `https://your-api-domain.com/api/payment/webhook/whop`
2. **Webhook 事件**: 
   - `payment.completed`
   - `checkout.completed`
   - `payment.failed`
   - `checkout.failed`

### 环境变量配置

```env
# Whop 支付配置
WHOP_API_KEY=your_whop_api_key_here
WHOP_WEBHOOK_SECRET=your_whop_webhook_secret_here
WHOP_COMPANY_ID=your_whop_company_id_here
```

### 积分套餐配置

当前支持的套餐：

| 套餐ID | 名称 | 积分 | 价格 | 奖励积分 | 说明 |
|--------|------|------|------|----------|------|
| `credits_100` | 100积分 | 100 | $1.00 | 0 | 基础套餐 |
| `credits_1000` | 1000积分 | 1000 | $10.00 | 0 | 标准套餐（热门） |
| `credits_15000` | 15000积分 | 15000 | $100.00 | 5000 | 超值套餐（50%奖励） |

### 安全说明

1. **Webhook 验证**: 所有 Whop webhook 都会验证签名
2. **用户验证**: 支付订单只能由订单创建者查看
3. **重复处理**: 系统会防止重复处理同一支付
4. **错误处理**: 支付失败时会记录详细日志

---

## 更新日志

- **v1.1.0**: 添加 Whop 支付系统，支持积分购买功能
- **v1.0.0**: 初始版本，包含基础认证、邮件订阅和积分系统功能