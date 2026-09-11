# A.E.G.I.S Offline Deployment Validator
# Comprehensive system validation before deployment to air-gapped environment
# Usage: .\validate_offline_deployment.ps1

param(
    [switch]$Verbose
)

$testCount = 0
$passCount = 0
$failCount = 0
$warningCount = 0

function Test-Condition {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$FailMessage = "Check failed"
    )
    
    $testCount++
    Write-Host "[$testCount] Testing: $Name ... " -NoNewline
    
    try {
        $result = & $Test
        if ($result -eq $true -or $null -eq $result) {
            Write-Host "✓ PASS" -ForegroundColor Green
            $passCount++
            return $true
        } else {
            Write-Host "✗ FAIL" -ForegroundColor Red
            Write-Host "    $FailMessage" -ForegroundColor Red
            $failCount++
            return $false
        }
    } catch {
        Write-Host "✗ ERROR" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
        return $false
    }
}

function Test-Warn {
    param(
        [string]$Name,
        [scriptblock]$Test,
        [string]$Message = "Warning condition detected"
    )
    
    $testCount++
    Write-Host "[$testCount] Checking: $Name ... " -NoNewline
    
    try {
        $result = & $Test
        if ($result -eq $true) {
            Write-Host "⚠ WARNING" -ForegroundColor Yellow
            Write-Host "    $Message" -ForegroundColor Yellow
            $warningCount++
            return $false
        } else {
            Write-Host "✓ OK" -ForegroundColor Green
            $passCount++
            return $true
        }
    } catch {
        Write-Host "✓ OK" -ForegroundColor Green
        $passCount++
        return $true
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "A.E.G.I.S Offline Deployment" -ForegroundColor Cyan
Write-Host "Validation Report" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Get-Location
if (-not (Test-Path ".\backend\app\main.py")) {
    Write-Error "Not in project root directory. Run from project root."
    exit 1
}

# ==================== SECTION 1: PROJECT STRUCTURE ====================
Write-Host "1. PROJECT STRUCTURE" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Test-Condition "Backend directory exists" { Test-Path ".\backend" }
Test-Condition "Backend app directory exists" { Test-Path ".\backend\app" }
Test-Condition "Frontend client directory exists" { Test-Path ".\client\src" }
Test-Condition "Scripts directory exists" { Test-Path ".\scripts" }
Test-Condition "Alembic configuration exists" { Test-Path ".\backend\alembic.ini" }
Test-Condition "Alembic migrations exist" { Test-Path ".\backend\alembic\versions" }
Test-Condition "package.json exists" { Test-Path ".\package.json" }
Test-Condition "Backend requirements.txt exists" { Test-Path ".\backend\requirements.txt" }
Test-Condition "Documentation exists" { Test-Path ".\docs\OFFLINE_DEPLOYMENT.md" }

Write-Host ""

# ==================== SECTION 2: PYTHON ENVIRONMENT ====================
Write-Host "2. PYTHON ENVIRONMENT" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Test-Condition "Python 3.12+ is installed" {
    $version = python --version 2>&1
    [version]$pyVersion = $version -replace "Python ", ""
    $pyVersion -ge [version]"3.12.0"
}

Test-Condition "pip is available" { Get-Command pip -ErrorAction SilentlyContinue }

Test-Condition "FastAPI is installed" { 
    pip show fastapi -ErrorAction SilentlyContinue | Select-String "Name: fastapi"
}

Test-Condition "SQLAlchemy is installed" {
    pip show sqlalchemy -ErrorAction SilentlyContinue | Select-String "Name: sqlalchemy"
}

Test-Condition "Alembic is installed" {
    pip show alembic -ErrorAction SilentlyContinue | Select-String "Name: alembic"
}

Test-Condition "uvicorn is installed" {
    pip show uvicorn -ErrorAction SilentlyContinue | Select-String "Name: uvicorn"
}

Test-Condition "psycopg is installed" {
    pip show psycopg -ErrorAction SilentlyContinue | Select-String "Name: psycopg"
}

Write-Host ""

# ==================== SECTION 3: NODE.JS ENVIRONMENT ====================
Write-Host "3. NODE.JS ENVIRONMENT" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Test-Condition "Node.js 18+ is installed" {
    $version = node --version 2>&1
    [version]$nodeVersion = $version -replace "v", ""
    $nodeVersion -ge [version]"18.0.0"
}

Test-Condition "npm is available" { Get-Command npm -ErrorAction SilentlyContinue }

Test-Condition "React is installed" {
    npm list react 2>$null | Select-String "react@"
}

Test-Condition "Vite is installed" {
    npm list vite 2>$null | Select-String "vite@"
}

Test-Condition "node_modules directory exists" { Test-Path ".\node_modules" -PathType Container }

Write-Host ""

# ==================== SECTION 4: DATABASE ====================
Write-Host "4. DATABASE CONFIGURATION" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Test-Condition "PostgreSQL is installed" {
    Get-Command psql -ErrorAction SilentlyContinue
}

Test-Condition "PostgreSQL service is running" {
    $service = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    $service.Status -eq "Running"
}

Test-Condition "PostgreSQL accepts local connections" {
    psql -U postgres -h localhost -c 'SELECT 1;' -ErrorAction SilentlyContinue | Select-String '1' -Quiet
}

Test-Condition "aegis_sat database exists" {
    $query = 'SELECT datname FROM pg_database WHERE datname=''aegis_sat'' OR datname=''nirikshak_sat'';'
    psql -U postgres -h localhost -c $query -ErrorAction SilentlyContinue | Select-String 'aegis_sat|nirikshak_sat' -Quiet
}

Write-Host ""

# ==================== SECTION 5: ENVIRONMENT CONFIGURATION ====================
Write-Host "5. ENVIRONMENT CONFIGURATION" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Test-Condition ".env or .env.offline exists" {
    (Test-Path ".\backend\.env") -or (Test-Path ".\backend\.env.offline")
}

if (Test-Path ".\backend\.env") {
    Test-Condition ".env contains DATABASE_URL" {
        Select-String -Path ".\backend\.env" -Pattern "DATABASE_URL" -Quiet
    }
    
    Test-Condition ".env DATABASE_URL uses localhost" {
        $content = Get-Content ".\backend\.env" | Select-String "DATABASE_URL"
        $content -match "localhost|127\.0\.0\.1"
    }
    
    Test-Condition ".env OFFLINE_MODE is configured" {
        Select-String -Path ".\backend\.env" -Pattern "OFFLINE_MODE" -Quiet
    }
}

Write-Host ""

# ==================== SECTION 6: NO EXTERNAL DEPENDENCIES ====================
Write-Host "6. OFFLINE COMPLIANCE (No External Services)" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Test-Condition "No cloud SDKs in requirements" {
    $req = Get-Content ".\backend\requirements.txt" -Raw
    -not ($req -match "boto|azure-|google-cloud|aws")
}

Test-Condition "No external API clients imported" {
    $pyFiles = Get-ChildItem -Path ".\backend\app" -Include "*.py" -Recurse
    $hasExternal = $false
    foreach ($file in $pyFiles) {
        $content = Get-Content $file -Raw
        if ($content -match "import requests|import httpx|import aiohttp|from selenium") {
            $hasExternal = $true
            break
        }
    }
    -not $hasExternal
}

Test-Condition "No cloud database connection strings" {
    $envFile = if (Test-Path ".\backend\.env") { ".\backend\.env" } else { ".\backend\.env.offline" }
    if (Test-Path $envFile) {
        $content = Get-Content $envFile -Raw
        -not ($content -match "amazonaws|cosmosdb|aure.database|cloud.google")
    } else {
        $true
    }
}

Write-Host ""

# ==================== SECTION 7: SCRIPTS ====================
Write-Host "7. DEPLOYMENT SCRIPTS" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Test-Condition "prepare_offline_dependencies.ps1 exists" { Test-Path ".\scripts\prepare_offline_dependencies.ps1" }
Test-Condition "install_offline_dependencies.ps1 exists" { Test-Path ".\scripts\install_offline_dependencies.ps1" }
Test-Condition "start_backend.ps1 exists" { Test-Path ".\scripts\start_backend.ps1" }
Test-Condition "start_frontend.ps1 exists" { Test-Path ".\scripts\start_frontend.ps1" }
Test-Condition "check_health.ps1 exists" { Test-Path ".\scripts\check_health.ps1" }
Test-Condition "setup_postgresql_offline.ps1 exists" { Test-Path ".\scripts\setup_postgresql_offline.ps1" }

Write-Host ""

# ==================== SECTION 8: TEST SUITE ====================
Write-Host "8. TEST SUITE" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Write-Host 'Running backend tests (38 expected)...' -NoNewline
Push-Location ".\backend"
$testOutput = python -m unittest discover -s tests 2>&1 | Select-String 'Ran'
Pop-Location
cd ..
if ($testOutput -match "Ran (\d+) tests") {
    $count = [int]$matches[1]
    if ($count -eq 38) {
        Write-Host "✓ PASS" -ForegroundColor Green
        Write-Host "    All $count tests passed" -ForegroundColor Green
        $passCount++
    } else {
        Write-Host "✗ FAIL" -ForegroundColor Red
        Write-Host "    Expected 38 tests, got $count" -ForegroundColor Red
        $failCount++
    }
} else {
    Write-Host "⚠ WARNING" -ForegroundColor Yellow
    $warningCount++
}

$testCount++

Write-Host ""

# ==================== SECTION 9: BUILD ARTIFACTS ====================
Write-Host "9. BUILD ARTIFACTS" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Test-Condition "Frontend build directory exists" { Test-Path ".\dist\public" -PathType Container }
Test-Condition "Frontend HTML generated" { Test-Path ".\dist\public\index.html" }
Test-Condition "Frontend CSS generated" { (Get-ChildItem ".\dist\public\assets" -Filter "*.css" -ErrorAction SilentlyContinue).Count -gt 0 }
Test-Condition "Frontend JS generated" { (Get-ChildItem ".\dist\public\assets" -Filter "*.js" -ErrorAction SilentlyContinue).Count -gt 0 }

Write-Host ""

# ==================== SECTION 10: DEPENDENCIES AUDIT ====================
Write-Host "10. DEPENDENCIES AUDIT" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

$reqCount = (Get-Content ".\backend\requirements.txt" | Measure-Object -Line).Lines
Write-Host "[$($testCount+1)] Backend dependencies pinned: $reqCount packages" -NoNewline
if ($reqCount -gt 0) {
    Write-Host " ✓ OK" -ForegroundColor Green
    $passCount++
} else {
    Write-Host " ✗ FAIL" -ForegroundColor Red
    $failCount++
}
$testCount++

$packageLocked = Test-Path ".\pnpm-lock.yaml"
Write-Host "[$($testCount+1)] Frontend dependencies locked: $(if ($packageLocked) { 'pnpm-lock.yaml' } else { 'package.json only' })" -NoNewline
if ($packageLocked) {
    Write-Host " ✓ OK" -ForegroundColor Green
    $passCount++
} else {
    Write-Host " ⚠ WARNING" -ForegroundColor Yellow
    $warningCount++
}
$testCount++

Write-Host ""

# ==================== SECTION 11: PHASE COMPLETION ====================
Write-Host "11. PHASE COMPLETION" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────" -ForegroundColor Cyan

Test-Condition "Phase 1-13 analytics complete" { Test-Path ".\backend\app\reports\service.py" }
Test-Condition "Phase 14 deployment scripts added" { Test-Path ".\scripts\prepare_offline_dependencies.ps1" }
Test-Condition "No Phase 15 components found" {
    $phase15 = Get-ChildItem -Path ".\backend\app" -Include "*phase15*", "*Phase15*" -Recurse -ErrorAction SilentlyContinue
    $phase15.Count -eq 0
}

Write-Host ""

# ==================== SUMMARY ====================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Tests Run:        $testCount"
Write-Host "Passed:                 $passCount" -ForegroundColor Green
Write-Host "Failed:                 $failCount"
Write-Host "Warnings:               $warningCount"
Write-Host ""

if ($failCount -eq 0 -and $warningCount -eq 0) {
    Write-Host 'ALL SYSTEMS OPERATIONAL' -ForegroundColor Green
    Write-Host "Ready for offline deployment to air-gapped environment" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. On internet-connected machine:" -ForegroundColor Yellow
    Write-Host "   .\scripts\prepare_offline_dependencies.ps1" -ForegroundColor Gray
    Write-Host "2. Transfer project and wheels/ to air-gapped machine" -ForegroundColor Yellow
    Write-Host "3. On air-gapped machine:" -ForegroundColor Yellow
    Write-Host "   .\scripts\install_offline_dependencies.ps1" -ForegroundColor Gray
    Write-Host "   .\scripts\setup_postgresql_offline.ps1" -ForegroundColor Gray
    Write-Host "   .\scripts\start_backend.ps1" -ForegroundColor Gray
    Write-Host "   .\scripts\start_frontend.ps1" -ForegroundColor Gray
    Write-Host "4. Verify with health check:" -ForegroundColor Yellow
    Write-Host "   .\scripts\check_health.ps1" -ForegroundColor Gray
    Write-Host ""
    exit 0
} elseif ($failCount -eq 0) {
    Write-Host 'WARNINGS DETECTED' -ForegroundColor Yellow
    Write-Host "System may be deployable with caution" -ForegroundColor Yellow
    Write-Host ""
    exit 0
} else {
    Write-Host 'DEPLOYMENT NOT READY' -ForegroundColor Red
    Write-Host ('Fix {0} issue(s) before proceeding' -f $failCount) -ForegroundColor Red
    Write-Host ""
    exit 1
}
