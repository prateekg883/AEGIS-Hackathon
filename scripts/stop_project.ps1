# Stop A.E.G.I.S processes started for this project.
$root = Split-Path -Parent $PSScriptRoot

$pidFiles = @(
    (Join-Path $root '.aegis-backend.pid'),
    (Join-Path $root '.aegis-frontend.pid'),
    (Join-Path $root '.nirikshak-backend.pid'),
    (Join-Path $root '.nirikshak-frontend.pid')
)
foreach ($pf in $pidFiles) {
    if (Test-Path $pf) {
        $procId = Get-Content $pf -ErrorAction SilentlyContinue
        if ($procId) { Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue }
    }
}

$processes = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine -like "*$root*" -and ($_.CommandLine -match 'uvicorn|vite|start_backend|start_frontend')
}
foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

$portConns = Get-NetTCPConnection -LocalPort 8000, 3000 -ErrorAction SilentlyContinue
foreach ($conn in $portConns) {
    if ($conn.OwningProcess) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Remove-Item $pidFiles -Force -ErrorAction SilentlyContinue
Write-Host 'A.E.G.I.S local services stopped.' -ForegroundColor Green
