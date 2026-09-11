# Start A.E.G.I.S Backend Service
# Usage: .\start_backend.ps1

param(
    [string]$EnvFile = ".\backend\.env",
    [int]$Port = 8000,
    [string]$BindHost = "127.0.0.1"
)

# Verify .env file exists
if (-not (Test-Path $EnvFile)) {
    Write-Warning "Environment file not found: $EnvFile"
    Write-Host "Creating from .env.example..." -ForegroundColor Yellow
    
    if (Test-Path ".\backend\.env.example") {
        Copy-Item ".\backend\.env.example" $EnvFile
        Write-Host "Created: $EnvFile" -ForegroundColor Green
        Write-Host "Please review and update if necessary."
    } else {
        Write-Error ".env.example not found. Cannot initialize environment."
        exit 1
    }
}

# Verify backend directory exists
if (-not (Test-Path ".\backend")) {
    Write-Error "Backend directory not found. Run this script from the project root."
    exit 1
}

# Prefer the project virtualenv created by setup_demo.ps1.
$projectRoot = Split-Path -Parent $PSScriptRoot
$venvPython = Join-Path $projectRoot 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    $venvPython = (Get-Command python -ErrorAction SilentlyContinue).Source
}
if (-not $venvPython) {
    Write-Error "Python was not found. Run setup_demo.ps1 after installing Python."
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "A.E.G.I.S Backend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting FastAPI backend server..." -ForegroundColor Yellow
Write-Host "Host: $BindHost" -ForegroundColor Gray
Write-Host "Port: $Port" -ForegroundColor Gray
Write-Host "API Docs: http://$BindHost`:$Port/docs" -ForegroundColor Cyan
Write-Host "OpenAPI: http://$BindHost`:$Port/openapi.json" -ForegroundColor Cyan
Write-Host "Health: http://$BindHost`:$Port/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Load environment and start backend
$env:APP_ENV = "offline"
Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
        $name, $value = $line.Split('=', 2)
        [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
    }
}
Set-Location (Join-Path $projectRoot 'backend')

& $venvPython -m uvicorn app.main:app --host $BindHost --port $Port --reload

if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend server failed to start. Check configuration and logs above."
    exit 1
}
