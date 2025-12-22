#!/bin/bash

# 快速部署脚本
echo "🚀 开始部署到 Vercel..."

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误：请在 auto-3-back-express 目录下运行此脚本"
    exit 1
fi

# 构建项目
echo "📦 构建项目..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

# 提交代码到 Git
echo "📝 提交代码到 Git..."
git add .
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"

# 推送到 GitHub
echo "⬆️ 推送到 GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ 代码已推送到 GitHub"
    echo "🌐 Vercel 将自动开始部署"
    echo "📊 查看部署状态：https://vercel.com/dashboard"
else
    echo "❌ 推送失败，请检查 Git 配置"
    exit 1
fi

echo "🎉 部署脚本执行完成！"