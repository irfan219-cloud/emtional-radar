@echo off
title FeedbackAI - Complete System Startup
color 0A

echo.
echo  ███████╗███████╗███████╗██████╗ ██████╗  █████╗  ██████╗██╗  ██╗ █████╗ ██╗
echo  ██╔════╝██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██║
echo  █████╗  █████╗  █████╗  ██║  ██║██████╔╝███████║██║     █████╔╝ ███████║██║
echo  ██╔══╝  ██╔══╝  ██╔══╝  ██║  ██║██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══██║██║
echo  ██║     ███████╗███████╗██████╔╝██████╔╝██║  ██║╚██████╗██║  ██╗██║  ██║██║
echo  ╚═╝     ╚══════╝╚══════╝╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
echo.
echo  🚀 Complete Customer Feedback Analyzer System
echo  📊 Real-time Analytics • 🤖 AI-Powered • 🔔 Smart Alerts
echo.

echo 🧹 Cleaning up previous instances...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo 📦 Checking dependencies...
cd backend
if not exist node_modules (
    echo 📥 Installing backend dependencies...
    npm install
)
cd ..

cd frontend
if not exist node_modules (
    echo 📥 Installing frontend dependencies...
    npm install
)
cd ..

echo 🗄️ Starting Database Services...
docker-compose up -d postgres redis >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Docker not available, using local services
) else (
    echo ✅ Database services started
    timeout /t 3 /nobreak >nul
)

echo 📡 Starting Backend API Server...
cd backend
start "FeedbackAI Backend" cmd /k "echo 🚀 Starting Backend Server... && node clean-server.js"
cd ..

echo ⏳ Waiting for backend initialization...
timeout /t 5 /nobreak >nul

echo 🌐 Starting Frontend Dashboard...
cd frontend
start "FeedbackAI Frontend" cmd /k "echo 🌐 Starting Frontend Dashboard... && npm run dev"
cd ..

echo.
echo ✅ FeedbackAI System Starting Up!
echo.
echo 📊 Backend API: Auto-detected port (5002-5005)
echo 🌐 Frontend App: http://localhost:3000
echo 🏥 Health Check: http://localhost:5002/health (or 5003-5005)
echo 🧪 Test Endpoints: http://localhost:5002/api/test/health
echo.
echo 🎨 Features Available:
echo   • Real-time Dashboard with Live Data
echo   • Alert Management Center
echo   • Emotion Heatmap Visualization
echo   • 6 Beautiful Themes (Dark, Light, Purple, Blue, Green, Orange)
echo   • AI-Powered Sentiment Analysis
echo   • Virality Prediction
echo   • Response Generation
echo   • Multi-Platform Data Ingestion
echo.

timeout /t 5 /nobreak >nul

echo 🌐 Opening application in browser...
start http://localhost:3000

echo.
echo 🎉 FeedbackAI is now running!
echo.
echo 💡 Quick Start Guide:
echo   1. Visit the Dashboard for real-time analytics
echo   2. Check the Alerts tab for urgent feedback
echo   3. Explore the Heatmap for emotion analysis
echo   4. Test the API at /api/test/health
echo.
echo 🛑 To stop: Close the backend and frontend windows
echo.
pause