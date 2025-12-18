# Express 后端快速配置指南

## 已完成的配置

### 1. 项目依赖
- ✅ Express + TypeScript
- ✅ Supabase 客户端 (@supabase/supabase-js)
- ✅ MongoDB 驱动 (mongodb)
- ✅ Passport + Google OAuth (passport-google-oauth20)
- ✅ Session 管理 (express-session)
- ✅ 安全中间件 (helmet, cors, rate-limit)

### 2. 配置文件
- ✅ `package.json` - 所有依赖已配置
- ✅ `tsconfig.json` - TypeScript 配置
- ✅ `.env.example` - 环境变量模板（占位符，不包含真实密钥）

### 3. 核心功能
- ✅ Supabase 客户端配置 (`src/config/supabase.ts`)
- ✅ MongoDB 连接配置 (`src/config/database.ts`)
- ✅ Google OAuth 认证路由 (`src/routes/auth.ts`)
- ✅ 邮箱订阅路由 (`src/routes/subscribe.ts`)

## 快速开始

### 步骤 1: 安装依赖
```bash
cd auto-3-back-express
npm install
```

### 步骤 2: 配置环境变量
创建 `.env` 文件：
```bash
# 从 .env.example 复制模板
cp .env.example .env

# 然后编辑 .env 文件，填入你的实际配置值
```

### 步骤 3: 启动服务器
```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

## Google OAuth 流程

1. **用户点击 Login 按钮** → 前端跳转到 `/auth/google`
2. **后端重定向到 Google** → Google OAuth 授权页面
3. **用户授权后** → Google 回调到 `/auth/callback`
4. **后端处理**：
   - 创建/更新 Supabase 用户
   - 保存/更新 MongoDB 用户数据
   - 重定向到前端成功页面

## API 端点

### 认证相关
- `GET /auth/google` - 启动 Google 登录
- `GET /auth/callback` - Google OAuth 回调（自动处理）
- `GET /auth/me` - 获取当前用户信息（需要 Bearer token）
- `POST /auth/logout` - 登出

### 其他
- `GET /health` - 健康检查
- `POST /api/subscribe` - 邮箱订阅

## 数据库结构

### MongoDB Collections

**users** 集合结构：
```javascript
{
  email: String,
  name: String,
  avatar: String,
  googleId: String,
  supabaseUserId: String,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## 注意事项

1. **回调 URL 配置**：
   - 确保 Google Cloud Console 中配置的回调 URL 为：`{SITE_URL}/auth/callback`
   - 后端服务器需要部署在可访问该 URL 的域名下

2. **CORS 配置**：
   - 在 `.env` 中配置 `CORS_ORIGIN`，支持多个域名（逗号分隔）
   - 本地开发时，确保包含 `http://localhost:5173` 等本地地址

3. **Session 安全**：
   - 生产环境需要设置强密码的 `SESSION_SECRET`
   - Cookie 在 production 模式下使用 `secure: true` 和 `sameSite: 'none'`

4. **数据库连接**：
   - MongoDB 连接在服务器启动时自动建立
   - 如果连接失败，服务器仍会启动，但相关功能会报错

## 前端集成

在前端 Navbar 的 Login 按钮上添加：
```tsx
<button onClick={() => window.location.href = 'https://your-backend-url/auth/google'}>
  Login
</button>
```

或者使用后端 API 地址：
```tsx
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8080';

<button onClick={() => window.location.href = `${BACKEND_URL}/auth/google`}>
  Login
</button>
```

## 测试

1. **健康检查**：
   ```bash
   curl http://localhost:8080/health
   ```

2. **测试 Google 登录**：
   - 访问 `http://localhost:8080/auth/google`
   - 应该重定向到 Google 登录页面

3. **测试订阅接口**：
   ```bash
   curl -X POST http://localhost:8080/api/subscribe \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "source": "inkgenius-pro纹身",
       "pageUrl": "https://your-domain.com/",
       "referrer": "direct"
     }'
   ```
