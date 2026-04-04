param(
  [string]$Command = ""
)

function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir

Add-PathOnce (Join-Path $runnerRoot ".runtime/node/current")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin")

Set-Location $runnerRoot

if (-not [string]::IsNullOrWhiteSpace($Command)) {
  try {
    Invoke-Expression $Command
  }
  catch {
    Write-Host ("[runner-shell] command failed: " + $_.Exception.Message) -ForegroundColor Red
  }
  return
}

Write-Host "Runner shell ready at: $runnerRoot" -ForegroundColor Green
Write-Host "Available commands: codex, claude, node, npm, npx"
