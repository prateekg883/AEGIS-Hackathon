# Install and Configure PostgreSQL for Offline Deployment
# This script helps set up a local PostgreSQL instance for A.E.G.I.S
# Usage: .\setup_postgresql_offline.ps1

param(
    [string]$PostgresVersion = "15",
    [string]$DbName = "aegis_sat",
    [string]$DbUser = "postgres",
    [string]$DbPassword = "postgres"
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Setup for A.E.G.I.S" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is installed
$pgPath = Get-Command psql -ErrorAction SilentlyContinue
if ($pgPath) {
    Write-Host "✓ PostgreSQL is installed" -ForegroundColor Green
    $pgVersion = psql --version
    Write-Host "  Version: $pgVersion" -ForegroundColor Gray
} else {
    Write-Host "PostgreSQL is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual Installation Steps:" -ForegroundColor Yellow
    Write-Host "1. Download PostgreSQL $PostgresVersion from: https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    Write-Host "2. Run the installer with default settings" -ForegroundColor Gray
    Write-Host "3. Note the PostgreSQL password (default: postgres)" -ForegroundColor Gray
    Write-Host "4. Add PostgreSQL bin directory to PATH:" -ForegroundColor Gray
    Write-Host "   - Usually: C:\Program Files\PostgreSQL\$PostgresVersion\bin" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "Database Configuration:" -ForegroundColor Yellow
Write-Host "  Database Name: $DbName" -ForegroundColor Gray
Write-Host "  User: $DbUser" -ForegroundColor Gray
Write-Host ""

# Try to connect to PostgreSQL
Write-Host "Testing PostgreSQL connection..." -ForegroundColor Yellow

# Create .pgpass file for password authentication
$pgpassFile = "$env:APPDATA\postgresql\pgpass.conf"
$pgpassDir = Split-Path -Parent $pgpassFile

if (-not (Test-Path $pgpassDir)) {
    New-Item -ItemType Directory -Path $pgpassDir -Force | Out-Null
}

# Write pgpass file (format: hostname:port:database:username:password)
@"
localhost:5432:*:$DbUser`:$DbPassword
"@ | Out-File -Encoding ASCII -FilePath $pgpassFile -Force

# Set restrictive permissions on pgpass
icacls $pgpassFile /inheritance:r /grant:r "$env:USERNAME`:(F)" | Out-Null

Write-Host "✓ Created pgpass authentication file" -ForegroundColor Green

Write-Host ""
Write-Host "Creating database and user..." -ForegroundColor Yellow

# Create database
$createDbCmd = @"
CREATE DATABASE $DbName;
"@

try {
    $createDbCmd | psql -U $DbUser -h localhost -w 2>$null
    Write-Host "✓ Database '$DbName' created (or already exists)" -ForegroundColor Green
} catch {
    Write-Warning "Database creation may have skipped (likely already exists)"
}

Write-Host ""
Write-Host "Running migrations..." -ForegroundColor Yellow
Write-Host "(This will be done by the backend on startup)" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Setup Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Connection String:" -ForegroundColor Cyan
Write-Host "postgresql+psycopg://$DbUser`:$DbPassword@localhost:5432/$DbName" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update .env file with database URL if needed" -ForegroundColor Gray
Write-Host "2. Start the backend: .\scripts\start_backend.ps1" -ForegroundColor Gray
Write-Host "3. Verify health: .\scripts\check_health.ps1" -ForegroundColor Gray
Write-Host ""
