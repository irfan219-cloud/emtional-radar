@echo off
echo Starting Customer Feedback Analyzer...
echo.

echo Step 1: Starting Database Services...
docker-compose up -d postgres redis

echo.
echo Step 2: Waiting for services to be ready...
timeout /t 10 /nobreak > nul

echo.
echo Step 3: Checking service status...
docker-compose ps

echo.
echo Step 4: Services are ready!
echo.
echo Next steps:
echo 1. Open a new terminal and run: cd backend && npm install && npm run dev
echo 2. Open another terminal and run: cd frontend && npm install && npm run dev
echo.
echo Then visit:
echo - Frontend: http://localhost:3000
echo - Backend API: http://localhost:5000/health
echo.
pause