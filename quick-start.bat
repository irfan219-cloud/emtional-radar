@echo off
echo 🚀 Quick Start - FeedbackAI
echo.

echo 📡 Starting Backend (Port 5001)...
start /min "Backend" cmd /c "cd backend && node app.js"

echo ⏳ Waiting 2 seconds...
timeout /t 2 /nobreak >nul

echo 🌐 Starting Frontend (Port 3000)...
start /min "Frontend" cmd /c "cd frontend && npm run dev"

echo.
echo ✅ Starting servers...
echo 📊 Backend: http://localhost:5001
echo 🌐 Frontend: http://localhost:3000
echo.

timeout /t 3 /nobreak >nul
start http://localhost:3000

echo 🎉 FeedbackAI is launching!
pause