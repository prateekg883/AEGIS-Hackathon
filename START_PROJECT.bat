@echo off
setlocal
cd /d "%~dp0"
echo Starting A.E.G.I.S MVP...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_project.ps1"
if errorlevel 1 (
  echo.
  echo Startup failed. Review the message above.
  pause
  exit /b 1
)
pause
