param(
  [string]$Server = "http://127.0.0.1:3200",
  [string]$Token = ""
)

function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  if (-not [string]::IsNullOrWhiteSpace($env:RUNNER_TOKEN)) {
    $Token = $env:RUNNER_TOKEN
  }
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  Write-Host "RUNNER_TOKEN is required" -ForegroundColor Red
  Write-Host "Example:" -ForegroundColor Yellow
  Write-Host '  powershell -ExecutionPolicy Bypass -File runner/scripts/start-runner.ps1 -Server "http://127.0.0.1:3200" -Token "xxxx"'
  exit 1
}

$env:RUNNER_SERVER = $Server
$env:RUNNER_TOKEN = $Token

if (Test-Path "runner/src/agentlab-runner.ts") {
  $runnerRoot = (Resolve-Path "runner").Path
  $entryTs = Join-Path $runnerRoot "src/agentlab-runner.ts"
}
else {
  $runnerRoot = (Get-Location).Path
  $entryTs = Join-Path $runnerRoot "src/agentlab-runner.ts"
}
if (-not (Test-Path $entryTs)) {
  Write-Host "Cannot find runner entry file. Expected runner/src/agentlab-runner.ts or src/agentlab-runner.ts" -ForegroundColor Red
  exit 1
}

Add-PathOnce (Join-Path $runnerRoot ".runtime/node/current")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin")
Add-PathOnce (Join-Path $env:ProgramFiles "nodejs")
Add-PathOnce (Join-Path $env:LOCALAPPDATA "Programs/nodejs")

if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  Write-Host "npx not found. Please run setup-windows.ps1 first." -ForegroundColor Red
  exit 1
}

npx tsx $entryTs
