@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
title 竞迹 — 计时系统
color 0A
cd /d %~dp0

echo.
echo ================================================
echo   竞迹 JingJi — 精准计时 · 智能田径
echo ================================================
echo.

:: Load config from .env
set GITHUB_TOKEN=
set GIST_ID=
for /f "usebackq tokens=1,2 delims==" %%A in (".env") do (
    if "%%A"=="GITHUB_TOKEN" set GITHUB_TOKEN=%%B
    if "%%A"=="GIST_ID" set GIST_ID=%%B
)

:: Kill any existing cloudflared
taskkill /f /im cloudflared.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Start Node server (if not already running)
netstat -an | findstr "0.0.0.0:8080" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
    echo 正在启动服务器...
    start "" /min cmd /c "node serve.js > server.log 2>&1"
    timeout /t 3 /nobreak >nul
) else (
    echo 服务器已在运行
)

:: Start cloudflared tunnel
echo 正在建立公网通道...
if exist tunnel-log.txt del tunnel-log.txt
start "" /min cmd /c "cloudflared.exe tunnel --url http://localhost:8080 > tunnel-log.txt 2>&1"

:: Wait for URL (up to 30s)
echo 等待分配公网地址...
set URL=
for /f "delims=" %%U in ('powershell -command "for($i=0;$i-lt30;$i++){Start-Sleep 1; $log=''; if(Test-Path 'tunnel-log.txt'){$log=Get-Content tunnel-log.txt -Raw}; $m=[regex]::Match($log,'https://[a-z0-9-]+\.trycloudflare\.com'); if($m.Success){Write-Output $m.Value; break}}"') do set URL=%%U

if "%URL%"=="" (
    echo 获取地址超时，请检查网络并重试
    pause
    exit /b 1
)

:: Update GitHub Gist with new URL
if not "%GITHUB_TOKEN%"=="" (
    echo 正在更新公网链接...
    powershell -command "$h=@{'Authorization'=\"token %GITHUB_TOKEN%\";'Content-Type'='application/json'}; $b='{\"files\":{\"url.txt\":{\"content\":\"%URL%\"}}}'; try{ Invoke-RestMethod -Uri \"https://api.github.com/gists/%GIST_ID%\" -Method PATCH -Headers $h -Body $b | Out-Null }catch{}" 2>nul
)

:: Write link to desktop
(
echo 竞迹 APP 永久入口
echo.
echo https://boy147258.github.io/jingjitimer/
echo.
echo 把此链接发给所有手机即可使用
echo 本次会话直连地址（备用）：%URL%
) > "%USERPROFILE%\Desktop\竞迹链接.txt"

echo.
echo ================================================
echo   系统已启动！永久入口链接：
echo.
echo   https://boy147258.github.io/jingjitimer/
echo.
echo   把这个链接发给所有手机即可使用
echo ================================================
echo.
echo 关闭此窗口即停止公网访问
echo.
pause
