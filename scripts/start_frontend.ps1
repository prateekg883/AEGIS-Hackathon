# Start A.E.G.I.S Frontend Development Server
# Usage: .\start_frontend.ps1

param(
    [int]$Port = 3000,
    [string]$BindHost = "127.0.0.1",
    [switch]$Build
)

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Verify package.json exists
if (-not (Test-Path ".\package.json")) {
    Write-Error "package.json not found. Run this script from the project root."
    exit 1
}

# Check if node is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found. Please install Node.js and add it to PATH."
    exit 1
}

# Check if npm/pnpm is available
$packageManager = "npm"
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $packageManager = "pnpm"
} elseif (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm or pnpm not found. Please install Node.js package manager."
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "A.E.G.I.S Frontend" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Package Manager: $packageManager" -ForegroundColor Gray

# Build if requested
if ($Build) {
    Write-Host "Building frontend for production..." -ForegroundColor Yellow
    if ($packageManager -eq 'pnpm') {
        pnpm run build
    } else {
        npm.cmd run build
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed. Check output above for errors."
        exit 1
    }
}

# Start development server
Write-Host ""
Write-Host "Starting Vite development server..." -ForegroundColor Yellow
Write-Host "Frontend: http://$BindHost`:$Port" -ForegroundColor Cyan
Write-Host "Backend API: http://127.0.0.1:8000/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Set offline environment variable
$env:VITE_API_BASE_URL = "http://127.0.0.1:8000"
$env:NODE_ENV = "development"

# Start with vite
if ($packageManager -eq 'pnpm') {
    pnpm run dev
} else {
    npm.cmd run dev
}

if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend server failed to start. Check output above for errors."
    exit 1
}
