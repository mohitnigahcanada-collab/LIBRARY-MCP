@echo off
title BuilderBrain
cd /d "%~dp0builderbrain"
echo BuilderBrain starting...
call npm install --silent
if not exist "dist\dashboard" call npm run build:all
start /b npm run start
timeout /t 3 /nobreak >nul
start http://localhost:8765
echo.
echo BuilderBrain running at http://localhost:8765
echo Close this window to stop the server.
pause
