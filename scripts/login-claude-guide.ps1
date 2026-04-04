param(
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

function Emit-Event([string]$type, [hashtable]$payload = @{}) {
  $obj = [ordered]@{
    type = $type
    ts = (Get-Date).ToString("o")
  }
  foreach ($k in $payload.Keys) {
    $obj[$k] = $payload[$k]
  }
  Write-Output ("__AL_EVENT__:" + ($obj | ConvertTo-Json -Compress -Depth 6))
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$shellScript = Join-Path $scriptDir "runner-shell.ps1"

Add-PathOnce (Join-Path $runnerRoot ".runtime/node/current")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin")

Set-Location $runnerRoot

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Host "[login] claude not found, please install Claude Code first." -ForegroundColor Red
  exit 1
}

$loginUrl = "https://claude.ai"
if ($OpenBrowser.IsPresent) {
  try {
    Start-Process $loginUrl | Out-Null
    Write-Host ("[login] Browser opened: " + $loginUrl)
  } catch {
    Write-Host ("[login] Cannot open browser automatically: " + $_.Exception.Message) -ForegroundColor Yellow
  }
}

try {
  Start-Process powershell -ArgumentList @(
    "-NoProfile","-ExecutionPolicy","Bypass","-NoExit",
    "-File",$shellScript,"-Command","claude login"
  ) -WorkingDirectory $runnerRoot | Out-Null
  Write-Host "[login] Opened terminal for: claude login"
}
catch {
  Write-Host ("[login] Cannot open claude login terminal: " + $_.Exception.Message) -ForegroundColor Yellow
}

Emit-Event -type "claude_login_guide" -payload @{
  url = $loginUrl
  terminalCommand = "claude login"
}

