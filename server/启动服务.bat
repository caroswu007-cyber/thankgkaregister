@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\" (
  echo [1/2] 正在安装依赖 npm install ...
  call npm install
  if errorlevel 1 (
    echo 安装失败，请检查是否已安装 Node.js 18+
    pause
    exit /b 1
  )
)
echo.
echo [2/2] 服务运行中，请勿关闭本窗口。
echo 在浏览器打开: http://127.0.0.1:8787/  或  http://localhost:8787/health
echo.
node index.js
if errorlevel 1 echo 启动失败，请查看上方报错。
pause
