@echo off
title FeedbackAI - Auto Startup
color 0A
cls

echo.
echo  ███████╗███████╗███████╗██████╗ ██████╗  █████╗  ██████╗██╗  ██╗ █████╗ ██╗
echo  ██╔════╝██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██║
echo  █████╗  █████╗  █████╗  ██║  ██║██████╔╝███████║██║     █████╔╝ ███████║██║
echo  ██╔══╝  ██╔══╝  ██╔══╝  ██║  ██║██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══██║██║
echo  ██║     ███████╗███████╗██████╔╝██████╔╝██║  ██║╚██████╗██║  ██╗██║  ██║██║
echo  ╚═╝     ╚══════╝╚══════╝╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
echo.
echo  🚀 AUTOMATIC STARTUP - Customer Feedback Analyzer
echo.

echo 🧹 Step 1: Cleaning up any running processes...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM "Next.js" >nul 2>&1
timeout /t 2 /nobreak >nul

echo 📦 Step 2: Installing dependencies (if needed)...
if not exist "node_modules" (
    echo Installing root dependencies...
    npm install --silent
)

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    cd backend
    npm install --silent
    cd ..
)

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    cd frontend
    npm install --silent
    cd ..
)

echo 📡 Step 3: Starting Backend Server...
cd backend
start "FeedbackAI Backend" cmd /k "echo Starting Backend... && node clean-server.js"
cd ..

echo ⏳ Step 4: Waiting for backend to initialize...
timeout /t 4 /nobreak >nul

echo 🌐 Step 5: Starting Frontend Server...
cd frontend
start "FeedbackAI Frontend" cmd /k "echo Starting Frontend... && npm run dev"
cd ..

echo ⏳ Step 6: Waiting for frontend to build...
timeout /t 8 /nobreak >nul

echo 🌍 Step 7: Opening in browser...
start http://localhost:3000

echo.
echo ✅ FeedbackAI is now running!
echo.
echo 📊 Backend API: Auto-detected port (check backend window)
echo 🌐 Frontend: http://localhost:3000
echo 🎨 Features: 6 Themes, Real-time Dashboard, Login System
echo.
echo 🎯 What you can do:
echo   • Switch between 6 beautiful themes
echo   • View real-time dashboard with live data
echo   • Test the login system
echo   • Explore responsive design
echo.
echo 🛑 To stop: Close the backend and frontend windows
echo.
echo Press any key to minimize this window...
pause >nul
exit