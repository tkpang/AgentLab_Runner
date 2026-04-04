# Start AgentLab Runner Web GUI
# Modern web-based interface with dark theme

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$guiDir = Join-Path $runnerRoot "gui"
$nodeDir = Join-Path $runnerRoot ".runtime\node\current"

function Add-PathOnce([string]$pathEntry) {
    if ([string]::IsNullOrWhiteSpace($pathEntry)) { return }
    if (-not (Test-Path $pathEntry)) { return }
    $parts = $env:PATH -split ";"
    if ($parts -contains $pathEntry) { return }
    $env:PATH = "$pathEntry;$env:PATH"
}

Write-Host "[AgentLab Runner] Starting Web GUI..." -ForegroundColor Cyan
Write-Host ""

# Add Node to PATH
Add-PathOnce $nodeDir
Add-PathOnce (Join-Path $env:ProgramFiles "nodejs")
Add-PathOnce (Join-Path $env:LOCALAPPDATA "Programs\nodejs")

# Check if Node is available
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "[Error] Node.js not found. Please run setup first." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Start the web server
Set-Location $guiDir
$guiPort = if ($env:AGENTLAB_GUI_PORT) { $env:AGENTLAB_GUI_PORT } else { "18765" }
Write-Host "Starting server at http://localhost:$guiPort" -ForegroundColor Green
Write-Host "Browser will open automatically..." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

& node server.cjs
