@echo off
echo 🧪 测试 API 端点...

set BASE_URL=https://inkgeniusapi.digworldai.com

echo.
echo 📍 测试根路径 /
curl -s %BASE_URL%/ | echo.

echo.
echo 📍 测试健康检查 /health
curl -s %BASE_URL%/health | echo.

echo.
echo 📍 测试 Google OAuth /api/auth/google
curl -s -I %BASE_URL%/api/auth/google | findstr "HTTP Location"

echo.
echo 📍 测试订阅端点 /api/subscribe (POST)
curl -s -X POST -H "Content-Type: application/json" -d "{\"email\":\"test@example.com\"}" %BASE_URL%/api/subscribe | echo.

echo.
echo 🎉 测试完成！
pause