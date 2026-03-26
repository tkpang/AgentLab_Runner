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

Write-Host "Runner root: $runnerRoot"
Write-Host "Checking local tools..."

if (Get-Command node -ErrorAction SilentlyContinue) { node --version } else { Write-Host "node: not installed" }
if (Get-Command npm -ErrorAction SilentlyContinue) { npm --version } else { Write-Host "npm: not installed" }
if (Get-Command codex -ErrorAction SilentlyContinue) { codex --version } else { Write-Host "codex: not installed" }
if (Get-Command claude -ErrorAction SilentlyContinue) { claude --version } else { Write-Host "claude: not installed" }
