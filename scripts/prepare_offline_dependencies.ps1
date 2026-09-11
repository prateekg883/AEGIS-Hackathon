# Prepare Python Dependencies for Offline Installation
# Run this on an internet-connected machine to create a wheels directory
# Usage: .\prepare_offline_dependencies.ps1

param(
    [string]$RequirementsFile = ".\backend\requirements.txt",
    [string]$OutputDir = ".\wheels"
)

function Test-AdminRights {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check if pip is available
if (-not (Get-Command pip -ErrorAction SilentlyContinue)) {
    Write-Error "pip not found. Please ensure Python is installed and in PATH."
    exit 1
}

# Create wheels directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    Write-Host "Created wheels directory: $OutputDir" -ForegroundColor Green
}

# Verify requirements file exists
if (-not (Test-Path $RequirementsFile)) {
    Write-Error "Requirements file not found: $RequirementsFile"
    exit 1
}

Write-Host "Preparing offline Python dependencies..." -ForegroundColor Cyan
Write-Host "Requirements file: $RequirementsFile"
Write-Host "Output directory: $OutputDir"
Write-Host ""

# Download wheels for all requirements
Write-Host "Downloading wheels (this may take a few minutes)..." -ForegroundColor Yellow
pip wheel --no-cache-dir --wheel-dir $OutputDir -r $RequirementsFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Successfully prepared offline dependencies" -ForegroundColor Green
    Write-Host ""
    Write-Host "Wheels created in: $OutputDir" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Copy the entire 'AEGIS' directory to the air-gapped machine"
    Write-Host "2. Run '.\scripts\install_offline_dependencies.ps1' on the air-gapped machine"
    Write-Host ""
} else {
    Write-Error "Failed to prepare wheels. Check output above for errors."
    exit 1
}
