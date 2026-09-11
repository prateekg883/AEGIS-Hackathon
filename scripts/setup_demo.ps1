# Prepare the local MVP environment and initialize deterministic SQLite demo data.
# Run from the repository root: .\scripts\setup_demo.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw 'Python was not found. Install Python 3.12+ and try again.'
}
if (-not (Get-Command pip -ErrorAction SilentlyContinue)) {
    throw 'pip was not found. Install Python with pip enabled and try again.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js was not found. Install Node.js 18+ and try again.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm was not found. Install Node.js with npm and try again.'
}

$venvPython = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host '[3/7] Creating backend virtual environment...' -ForegroundColor Cyan
    python -m venv (Join-Path $root 'backend\.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Could not create backend\.venv.' }
} else {
    Write-Host '[3/7] Backend virtual environment already exists.' -ForegroundColor Green
}

cmd.exe /c "`"$venvPython`" -c `"import fastapi, uvicorn, sqlalchemy, alembic, psycopg, multipart, httpx`" >nul 2>nul"
if ($LASTEXITCODE -ne 0) {
    Write-Host '[4/7] Installing backend dependencies...' -ForegroundColor Cyan
    & $venvPython -m pip install -r (Join-Path $root 'backend\requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
} else {
    Write-Host '[4/7] Backend dependencies already installed.' -ForegroundColor Green
}

$packageLock = Join-Path $root 'package-lock.json'
$nodeModules = Join-Path $root 'node_modules'
if ((Test-Path $packageLock) -and -not (Test-Path $nodeModules)) {
    Write-Host '[5/7] Installing frontend dependencies with npm ci...' -ForegroundColor Cyan
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
} elseif (-not (Test-Path (Join-Path $nodeModules 'vite\bin\vite.js'))) {
    Write-Host '[5/7] Installing frontend dependencies with npm install...' -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
} else {
    Write-Host '[5/7] Frontend dependencies already installed.' -ForegroundColor Green
}

Write-Host '[6/7] Applying SQLite database migrations...' -ForegroundColor Cyan
Set-Location (Join-Path $root 'backend')
& $venvPython -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Alembic migration failed.' }

Write-Host '[7/7] Loading deterministic demo data...' -ForegroundColor Cyan
& $venvPython -m app.demo.initialize
if ($LASTEXITCODE -ne 0) { throw 'Demo data initialization failed.' }

& $venvPython -c "from sqlalchemy import select; from app.db.session import SessionLocal; from app.models.models import CSEEntity; db=SessionLocal(); exists=db.scalar(select(CSEEntity).where(CSEEntity.cse_code == 'CSE-07')) is not None; db.close(); raise SystemExit(0 if exists else 1)"
if ($LASTEXITCODE -ne 0) { throw 'Demo setup completed without CSE-07.' }

Write-Host 'SETUP COMPLETE' -ForegroundColor Green
Write-Host 'Database: backend/data/aegis_sat.db' -ForegroundColor Gray
