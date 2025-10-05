@echo off
title FeedbackAI - FAST MODE
color 0A

echo ⚡ FAST MODE - FeedbackAI
echo.

echo 📡 Backend starting...
cd backend
start /b node fast-server.js
cd ..

echo ⏳ Wait 1 sec...
timeout /t 1 /nobreak >nul

echo 🌐 Frontend starting...
cd frontend
start npm run dev
cd ..

echo.
echo ⚡ FAST STARTUP COMPLETE!
echo 📊 Backend: http://localhost:5001
echo 🌐 Frontend: http://localhost:3000
echo.

timeout /t 2 /nobreak >nul
start http://localhost:3000

pause