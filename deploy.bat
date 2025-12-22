@echo off
echo 🚀 开始部署到 Vercel...

REM 检查是否在正确的目录
if not exist "package.json" (
    echo ❌ 错误：请在 auto-3-back-express 目录下运行此脚本
    pause
    exit /b 1
)

REM 构建项目
echo 📦 构建项目...
call npm run build

if %errorlevel% neq 0 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

REM 提交代码到 Git
echo 📝 提交代码到 Git...
git add .
git commit -m "Deploy: %date% %time%"

REM 推送到 GitHub
echo ⬆️ 推送到 GitHub...
git push origin main

if %errorlevel% equ 0 (
    echo ✅ 代码已推送到 GitHub
    echo 🌐 Vercel 将自动开始部署
    echo 📊 查看部署状态：https://vercel.com/dashboard
) else (
    echo ❌ 推送失败，请检查 Git 配置
    pause
    exit /b 1
)

echo 🎉 部署脚本执行完成！
pause