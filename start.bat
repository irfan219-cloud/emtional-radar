@echo off
echo 🚀 Starting Customer Feedback Analyzer...
echo.

echo 📡 Starting backend server...
start "Backend" cmd /k "cd backend && node simple-server.js"

timeout /t 3 /nobreak >nul

echo 🌐 Starting frontend server...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ Both servers are starting!
echo 📊 Backend: http://localhost:5000
echo 🌐 Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause >nul