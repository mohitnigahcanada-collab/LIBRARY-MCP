@echo off
cd /d "%~dp0builderbrain"
echo BuilderBrain starting...
call npm install --silent
if not exist "dist" call npm run build:all
start npm run start
timeout /t 3 /nobreak >/dev/null
start http://localhost:8765
echo BuilderBrain running at http://localhost:8765
pause
