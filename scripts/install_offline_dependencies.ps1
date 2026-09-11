# Install Python Dependencies from Local Wheels (Offline)
# Run this on the air-gapped machine to install from prepared wheels
# Usage: .\install_offline_dependencies.ps1

param(
    [string]$WheelsDir = ".\wheels",
    [string]$RequirementsFile = ".\backend\requirements.txt"
)

# Verify wheels directory exists
if (-not (Test-Path $WheelsDir)) {
    Write-Error "Wheels directory not found: $WheelsDir"
    Write-Error "Please run 'prepare_offline_dependencies.ps1' on an internet-connected machine first."
    exit 1
}

# Check if pip is available
if (-not (Get-Command pip -ErrorAction SilentlyContinue)) {
    Write-Error "pip not found. Please ensure Python is installed and in PATH."
    exit 1
}

Write-Host "Installing offline Python dependencies..." -ForegroundColor Cyan
Write-Host "Wheels directory: $WheelsDir"
Write-Host ""

# Count wheels
$wheelCount = (Get-ChildItem -Path $WheelsDir -Filter "*.whl" | Measure-Object).Count
Write-Host "Found $wheelCount wheel files" -ForegroundColor Yellow

if ($wheelCount -eq 0) {
    Write-Error "No wheel files found in $WheelsDir"
    Write-Error "The wheels directory appears to be empty or missing wheels."
    exit 1
}

Write-Host ""
Write-Host "Installing packages..." -ForegroundColor Yellow

# Install all wheels using --no-index to ensure offline operation
pip install --no-index --find-links=$WheelsDir -r $RequirementsFile

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Successfully installed all dependencies" -ForegroundColor Green
    Write-Host ""
    Write-Host "Verification:" -ForegroundColor Cyan
    pip list | Select-Object -First 20
    Write-Host ""
} else {
    Write-Error "Failed to install dependencies. Check output above for errors."
    exit 1
}
