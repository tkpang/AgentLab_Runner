# Simple quota checker that uses codex CLI directly
# Fallback when app-server method fails

param(
  [switch]$Json
)

$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$homeDir = [Environment]::GetFolderPath("UserProfile")

function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

Add-PathOnce (Join-Path $runnerRoot ".runtime/node/current")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin")

Set-Location $runnerRoot

try {
  $codexCmd = Get-Command codex -ErrorAction SilentlyContinue
  if (-not $codexCmd) {
    throw "codex not installed"
  }
  
  # Try to get quota info from codex CLI
  $output = & codex 2>&1 | Out-String
  
  # Check if logged in
  $authPath = Join-Path $homeDir ".codex\auth.json"
  if (-not (Test-Path $authPath)) {
    throw "Not logged in - credential file not found"
  }
  
  $result = [PSCustomObject]@{
    ok = $true
    source = "codex-cli"
    message = "Quota check via app-server is not available on Windows. Please run 'codex' in terminal to view quota."
    loggedIn = $true
    credentialFile = $authPath
    refreshedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  }
  
  if ($Json.IsPresent) {
    $result | ConvertTo-Json -Depth 6
  } else {
    Write-Host "Status: Logged in"
    Write-Host "Credential: $authPath"
    Write-Host "Note: Quota details not available via GUI on Windows"
    Write-Host "      Please run 'codex' in terminal to view quota"
  }
}
catch {
  $msg = $_.Exception.Message
  $errObj = [PSCustomObject]@{
    ok = $false
    source = "codex-cli"
    error = $msg
    refreshedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  }
  if ($Json.IsPresent) {
    $errObj | ConvertTo-Json -Depth 6
  } else {
    Write-Host "Error: $msg" -ForegroundColor Red
  }
  exit 1
}
