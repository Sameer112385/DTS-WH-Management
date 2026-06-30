@echo off
title Warehouse Operations Web Application Launcher
echo ===================================================================
echo   Welcome to Warehouse Operations Management System Launcher
echo ===================================================================
echo.

:: Setup portable Node.js and Python PATH dynamically
set "PATH=%~dp0node-v24.16.0-win-x64;%LOCALAPPDATA%\Microsoft\WindowsApps;%PATH%"

echo [1/2] Launching FastAPI Backend Server...
start cmd /k "title FastAPI Backend && cd /d %~dp0backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [2/2] Launching React Vite Frontend Server...
start cmd /k "title React Frontend && cd /d %~dp0frontend && npm install && npm run dev"

echo.
echo ===================================================================
echo   Application initialization completed successfully!
echo.
echo   * Backend API:          http://127.0.0.1:8000
echo   * Swagger UI Docs:      http://127.0.0.1:8000/docs
echo   * Frontend Web UI:      http://localhost:3000
echo.
echo   Press any key to close this launcher. The app windows will remain open.
echo ===================================================================
pause > nul
