# Check A.E.G.I.S System Health
# Verifies that both backend and frontend are accessible
# Usage: .\check_health.ps1

param(
    [string]$BackendUrl = "http://127.0.0.1:8000",
    [string]$FrontendUrl = "http://127.0.0.1:3000"
)

$errorCount = 0

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "A.E.G.I.S Health Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check backend health
Write-Host "Checking backend service..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/api/health" -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
        $healthData = $response.Content | ConvertFrom-Json
        Write-Host "Backend is healthy" -ForegroundColor Green
        Write-Host "  Status: $($healthData.status)" -ForegroundColor Gray
        Write-Host "  Service: $($healthData.service)" -ForegroundColor Gray
        if ($healthData.mode) {
            Write-Host "  Mode: $($healthData.mode)" -ForegroundColor Gray
        }
    } else {
        Write-Host "Backend returned status $($response.StatusCode)" -ForegroundColor Red
        $errorCount++
    }
} catch {
    Write-Host "Backend is not accessible at $BackendUrl" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
    $errorCount++
}

Write-Host ""

# Check frontend health
Write-Host "Checking frontend service..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
        Write-Host "Frontend is accessible" -ForegroundColor Green
        Write-Host "  URL: $FrontendUrl" -ForegroundColor Gray
    } else {
        Write-Host "Frontend returned status $($response.StatusCode)" -ForegroundColor Red
        $errorCount++
    }
} catch {
    Write-Host "Frontend is not accessible at $FrontendUrl" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Gray
    $errorCount++
}

Write-Host ""

# Check API documentation
Write-Host "Checking API documentation..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BackendUrl/docs" -UseBasicParsing -TimeoutSec 3
    if ($response.StatusCode -eq 200) {
        Write-Host "API documentation is available" -ForegroundColor Green
        Write-Host "  URL: $BackendUrl/docs" -ForegroundColor Gray
    }
} catch {
    Write-Host "API documentation not accessible" -ForegroundColor Yellow
}

Write-Host ""

# Summary
if ($errorCount -eq 0) {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "All systems operational" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Access the application at:" -ForegroundColor Cyan
    Write-Host "  Frontend: $FrontendUrl" -ForegroundColor Yellow
    Write-Host "  Backend API: $BackendUrl/api" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Health check found $errorCount issue(s)" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Verify backend/data/aegis_sat.db exists or run setup_demo.ps1" -ForegroundColor Gray
    Write-Host "2. Check environment variables in .env" -ForegroundColor Gray
    Write-Host "3. Verify backend service started without errors" -ForegroundColor Gray
    Write-Host "4. Check firewall settings or port availability" -ForegroundColor Gray
    Write-Host ""
    exit 1
}
