@echo off
echo ========================================
echo  XIAO IMU Visualizer
echo ========================================
echo.

REM ポート8080が既に使用中なら停止
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 "') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [1/2] サーバーを起動中...
start /b python -m http.server 8080

REM サーバーが起動するまで2秒待機
timeout /t 2 /nobreak > nul

echo [2/2] ブラウザを開いています...
start http://localhost:8080/

echo.
echo ✓ サーバー起動中 (http://localhost:8080/)
echo   このウィンドウを閉じるとサーバーが停止します。
echo.
pause
