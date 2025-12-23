#!/bin/bash

echo "🔧 修复后端配置问题..."

# 安装新的依赖
echo "📦 安装新依赖..."
npm install connect-mongo@^5.1.0
npm install --save-dev @types/connect-mongo@^3.1.3

# 重新构建
echo "🏗️ 重新构建..."
npm run build

echo "✅ 修复完成！"

echo "📋 修复的问题:"
echo "1. ✅ 添加了 trust proxy 设置，修复 X-Forwarded-For 警告"
echo "2. ✅ 使用 MongoDB 存储 session，解决生产环境内存泄漏问题"
echo "3. ✅ 改进了 rate limiting 配置"
echo "4. ✅ 添加了 connect-mongo 依赖"

echo ""
echo "🚀 现在可以重新部署后端了！"