# One-command local startup for A.E.G.I.S
# Run from the repository root or through START_PROJECT.bat.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '========================================' -ForegroundColor Cyan
Write-Host ' A.E.G.I.S MVP STARTUP' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan

& (Join-Path $PSScriptRoot 'stop_project.ps1')

& (Join-Path $PSScriptRoot 'setup_demo.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Setup failed. Review the error above and try again.' }

$backend = Start-Process powershell.exe -PassThru -WindowStyle Normal -WorkingDirectory $root -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-File', '.\scripts\start_backend.ps1')
$frontend = Start-Process powershell.exe -PassThru -WindowStyle Normal -WorkingDirectory $root -ArgumentList @('-NoExit', '-ExecutionPolicy', 'Bypass', '-File', '.\scripts\start_frontend.ps1')

Set-Content (Join-Path $root '.aegis-backend.pid') $backend.Id
Set-Content (Join-Path $root '.aegis-frontend.pid') $frontend.Id

Write-Host 'Waiting for backend health...' -ForegroundColor Yellow
$backendReady = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2
        if ($health.status -eq 'ok') { $backendReady = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $backendReady) { throw 'Backend did not become healthy. Inspect the backend PowerShell window.' }
Write-Host 'Backend health: OK' -ForegroundColor Green

Write-Host 'Waiting for frontend...' -ForegroundColor Yellow
$frontendReady = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
        $response = Invoke-WebRequest 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200) { $frontendReady = $true; break }
    } catch { }
    Start-Sleep -Seconds 1
}
if (-not $frontendReady) { throw 'Frontend did not become available. Inspect the frontend PowerShell window.' }
Write-Host 'Frontend: OK' -ForegroundColor Green

try {
    $report = Invoke-RestMethod 'http://127.0.0.1:8000/api/reports/generate?cse_code=CSE-07&assessment_period=Q2%202026' -Method Post -TimeoutSec 10
    if ($report.report_status -ne 'GENERATED') { throw 'Report status was not GENERATED.' }
    Write-Host 'CSE-07 Q2 2026 report: GENERATED' -ForegroundColor Green
} catch {
    Write-Warning "Report flow check failed: $($_.Exception.Message)"
}

Write-Host 'Opening A.E.G.I.S (browser)...' -ForegroundColor Cyan
Start-Process 'http://localhost:3000'
Write-Host 'MVP is running at http://localhost:3000' -ForegroundColor Green
Write-Host 'Use STOP_PROJECT.bat to stop the local services.' -ForegroundColor Gray
