@echo off
title FeedbackAI - Customer Feedback Analyzer
color 0A

echo.
echo  ███████╗███████╗███████╗██████╗ ██████╗  █████╗  ██████╗██╗  ██╗ █████╗ ██╗
echo  ██╔════╝██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔══██╗██║
echo  █████╗  █████╗  █████╗  ██║  ██║██████╔╝███████║██║     █████╔╝ ███████║██║
echo  ██╔══╝  ██╔══╝  ██╔══╝  ██║  ██║██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══██║██║
echo  ██║     ███████╗███████╗██████╔╝██████╔╝██║  ██║╚██████╗██║  ██╗██║  ██║██║
echo  ╚═╝     ╚══════╝╚══════╝╚═════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
echo.
echo  🚀 Starting Customer Feedback Analyzer...
echo.

echo 📡 Starting Backend Server...
start "FeedbackAI Backend" cmd /k "cd /d %~dp0backend && echo Starting Backend Server... && node server.js"

echo ⏳ Waiting for backend to initialize...
timeout /t 3 /nobreak >nul

echo 🌐 Starting Frontend Server...
start "FeedbackAI Frontend" cmd /k "cd /d %~dp0frontend && echo Starting Frontend Server... && npm run dev"

echo.
echo ✅ FeedbackAI is starting up!
echo.
echo 📊 Backend API: http://localhost:5000
echo 🌐 Frontend App: http://localhost:3000
echo 📋 Health Check: http://localhost:5000/health
echo.
echo 🎨 Features:
echo   • 6 Beautiful Themes (Dark, Light, Purple, Blue, Green, Orange)
echo   • Real-time Dashboard with Live Data
echo   • Login System with Beautiful UI
echo   • Responsive Design for All Devices
echo.
echo Press any key to open the application in your browser...
pause >nul

start http://localhost:3000

echo.
echo 🎉 FeedbackAI is now running!
echo.
echo To stop the servers, close the backend and frontend windows.
echo.
pause