# Start AgentLab Runner Desktop GUI (Electron)
# Independent desktop window with system tray support

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$guiDir = Join-Path $runnerRoot "gui"
$nodeDir = Join-Path $runnerRoot ".runtime\node\current"
$npmGlobal = Join-Path $runnerRoot ".tools\npm-global"

Write-Host "[AgentLab Runner] Starting Desktop GUI..." -ForegroundColor Cyan
Write-Host ""

# Add Node to PATH
$env:PATH = "$nodeDir;$npmGlobal;$env:PATH"

# Check if Node is available
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[Error] Node.js not found. Please run setup first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Electron is installed
Set-Location $guiDir
$electronPath = Join-Path $guiDir "node_modules\electron"
if (-not (Test-Path $electronPath)) {
    Write-Host "[Info] Installing Electron (first time only)..." -ForegroundColor Yellow
    & npm install electron@28.0.0 --save-dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Error] Failed to install Electron" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host ""
}

# Start the desktop app
Write-Host "Starting AgentLab Runner Desktop App..." -ForegroundColor Green
Write-Host ""

& npx electron .
