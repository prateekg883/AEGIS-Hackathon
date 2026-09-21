@echo off
setlocal
cd /d "%~dp0"
echo ======================================================================
echo Packaging A.E.G.I.S for Global Innovation Hackathon 2026 (Unstop)...
echo ======================================================================
echo.

python scripts\package_unstop_submission.py
if errorlevel 1 (
  echo.
  echo [ERROR] Packaging failed. Please ensure Python is installed and accessible.
  pause
  exit /b 1
)

echo.
echo [SUCCESS] Zip package created in current folder:
echo AEGIS_Global_Innovation_Hackathon_2026_Submission.zip
echo.
pause
