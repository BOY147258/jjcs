@echo off
chcp 65001 >nul
title 竞迹 — 更新代码
color 0A
cd /d %~dp0

echo.
echo ================================================
echo   jjcs 竞迹 — 推送最新代码
echo ================================================
echo.

echo 提交代码...
git add -A
git commit -m "update %date% %time%"

echo.
echo 推送到 GitHub...
git push

echo.
echo 重启本地服务器...
taskkill /f /im node.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" /min cmd /c "node serve.js > server.log 2>&1"

echo.
echo ================================================
echo   更新完成！链接不变：
echo   https://boy147258.github.io/jjcs/
echo ================================================
echo.
pause
