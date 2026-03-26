param(
  [string]$Server = "http://127.0.0.1:3200",
  [string]$Token = ""
)

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

$entryTs = "runner/src/agentlab-runner.ts"
if (-not (Test-Path $entryTs)) {
  $entryTs = "src/agentlab-runner.ts"
}
if (-not (Test-Path $entryTs)) {
  Write-Host "Cannot find runner entry file. Expected runner/src/agentlab-runner.ts or src/agentlab-runner.ts" -ForegroundColor Red
  exit 1
}

npx tsx $entryTs
