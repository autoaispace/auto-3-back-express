# InkGenius Pro Backend API 接口总结

## 📋 接口概览

| 分类 | 方法 | 路径 | 描述 | 认证 |
|------|------|------|------|------|
| **基础接口** |
| | GET | `/` | 获取API信息 | ❌ |
| | GET | `/health` | 健康检查 | ❌ |
| **认证接口** |
| | GET | `/api/auth/google` | Google OAuth登录 | ❌ |
| | GET | `/api/auth/callback` | OAuth回调处理 | ❌ |
| | GET | `/api/auth/me` | 获取当前用户信息 | ✅ |
| | POST | `/api/auth/logout` | 用户登出 | ❌ |
| **邮件订阅** |
| | POST | `/api/subscribe` | 邮件订阅 | ❌ |
| **积分系统** |
| | GET | `/api/credits/me` | 获取当前用户积分 | ✅ |
| | GET | `/api/credits/by-email/{email}` | 通过邮箱获取积分 | ❌ |
| | GET | `/api/credits/transactions/{email}` | 获取积分交易记录 | ❌ |
| | POST | `/api/credits/add` | 添加积分（管理员） | ❌ |
| | POST | `/api/credits/spend` | 扣除积分（管理员） | ❌ |
| | POST | `/api/credits/initialize-all` | 批量初始化积分 | ❌ |
| | POST | `/api/credits/initialize/{email}` | 初始化单个用户积分 | ❌ |
| **支付系统** |
| | GET | `/api/payment/packages` | 获取积分套餐列表 | ❌ |
| | POST | `/api/payment/create` | 创建支付订单 | ✅ |
| | GET | `/api/payment/{paymentId}` | 获取支付详情 | ✅ |
| | GET | `/api/payment/user/history` | 获取支付历史 | ✅ |
| | POST | `/api/payment/webhook/whop` | Whop回调处理 | ❌ |
| | POST | `/api/payment/test/complete/{paymentId}` | 测试支付完成 | ❌ |
| **测试接口** |
| | GET | `/api/auth/test/db` | 测试数据库连接 | ❌ |
| | GET | `/api/auth/test/callback` | 测试回调端点 | ❌ |
| | POST | `/api/auth/test/create-user` | 创建测试用户 | ❌ |
| | GET | `/api/credits/test/all` | 获取所有积分信息 | ❌ |

## 🔑 认证说明

需要认证的接口（标记✅）需要在请求头中包含：
```
Authorization: Bearer <supabase-jwt-token>
```

## 📁 文件说明

- `API_DOCUMENTATION.md` - 完整的API文档
- `apifox-collection.json` - Apifox导入文件
- `API_SUMMARY.md` - 本文件，接口总结
- `WHOP_INTEGRATION.md` - Whop支付集成指南

## 🚀 快速导入到Apifox

1. 打开Apifox
2. 创建新项目或选择现有项目
3. 点击"导入" → "导入数据"
4. 选择"OpenAPI/Swagger"格式
5. 上传 `apifox-collection.json` 文件
6. 确认导入

## 🌐 环境配置

### 生产环境
- Base URL: `https://inkgeniusapi.digworldai.com`

### 开发环境  
- Base URL: `http://localhost:8080`

## 📊 接口统计

- **总接口数**: 22个
- **需要认证**: 5个
- **公开接口**: 17个
- **GET请求**: 14个
- **POST请求**: 8个

## 🔧 常用测试场景

### 1. 用户注册登录流程
1. `GET /api/auth/google` - 发起登录
2. `GET /api/auth/me` - 获取用户信息
3. `GET /api/credits/me` - 获取用户积分

### 2. 邮件订阅流程
1. `POST /api/subscribe` - 提交邮件订阅

### 3. 积分购买流程
1. `GET /api/payment/packages` - 获取套餐列表
2. `POST /api/payment/create` - 创建支付订单
3. `GET /api/payment/{paymentId}` - 查看支付状态
4. `GET /api/credits/me` - 确认积分到账

### 4. 积分管理流程
1. `GET /api/credits/by-email/{email}` - 查看积分
2. `POST /api/credits/add` - 添加积分
3. `GET /api/credits/transactions/{email}` - 查看交易记录

### 5. 系统监控
1. `GET /health` - 健康检查
2. `GET /` - API信息
3. `GET /api/auth/test/db` - 数据库连接测试