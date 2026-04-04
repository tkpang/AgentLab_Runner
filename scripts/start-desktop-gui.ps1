# Start AgentLab Runner Desktop GUI (Electron)
# Independent desktop window with system tray support

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$guiDir = Join-Path $runnerRoot "gui"
$nodeDir = Join-Path $runnerRoot ".runtime\node\current"
$npmGlobal = Join-Path $runnerRoot ".tools\npm-global"

function Add-PathOnce([string]$pathEntry) {
    if ([string]::IsNullOrWhiteSpace($pathEntry)) { return }
    if (-not (Test-Path $pathEntry)) { return }
    $parts = $env:PATH -split ";"
    if ($parts -contains $pathEntry) { return }
    $env:PATH = "$pathEntry;$env:PATH"
}

Write-Host "[AgentLab Runner] Starting Desktop GUI..." -ForegroundColor Cyan
Write-Host ""

# Ensure Electron launches in desktop mode
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue

# Add Node/NPM locations to PATH
Add-PathOnce $nodeDir
Add-PathOnce $npmGlobal
Add-PathOnce (Join-Path $npmGlobal "node_modules\.bin")
Add-PathOnce (Join-Path $env:ProgramFiles "nodejs")
Add-PathOnce (Join-Path $env:LOCALAPPDATA "Programs\nodejs")

# Check if Node is available
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[Error] Node.js not found. Please run setup first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Electron is installed
Set-Location $guiDir
$electronModulePath = Join-Path $guiDir "node_modules\electron"
$electronBinaryPath = Join-Path $electronModulePath "dist\electron.exe"
if (-not (Test-Path $electronBinaryPath)) {
    Write-Host "[Info] Installing Electron (first time only)..." -ForegroundColor Yellow
    if (Test-Path $electronModulePath) {
        Remove-Item -Path $electronModulePath -Recurse -Force -ErrorAction SilentlyContinue
    }
    & npm install electron@28.0.0 --save-dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Warn] Default registry install failed, retry with mirror..." -ForegroundColor Yellow
        $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
        & npm install electron@28.0.0 --save-dev --no-audit --no-fund --registry=https://registry.npmmirror.com
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[Error] Failed to install Electron" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
    if (-not (Test-Path $electronBinaryPath)) {
        Write-Host "[Error] Electron binary missing after install" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host ""
}

# Start the desktop app
Write-Host "Starting AgentLab Runner Desktop App..." -ForegroundColor Green
Write-Host ""

& npx electron .
