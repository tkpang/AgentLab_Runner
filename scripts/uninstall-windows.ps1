param(
  [switch]$RemoveNode,
  [switch]$RemoveCodex,
  [switch]$RemoveClaude,
  [switch]$RemoveRunnerDeps
)

$ErrorActionPreference = "Stop"

function Test-Cmd([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

function Resolve-RunnerRoot() {
  if (Test-Path "runner/package.json") {
    return (Resolve-Path "runner").Path
  }
  if (Test-Path "package.json") {
    return (Get-Location).Path
  }
  throw "Cannot locate runner root."
}

function Resolve-NpmCommand([string]$portableNodeBin) {
  if (Test-Cmd "npm") { return "npm" }
  $portableNpm = Join-Path $portableNodeBin "npm.cmd"
  if (Test-Path $portableNpm) { return $portableNpm }
  return ""
}

try {
  if (-not $RemoveNode.IsPresent -and -not $RemoveCodex.IsPresent -and -not $RemoveClaude.IsPresent -and -not $RemoveRunnerDeps.IsPresent) {
    Write-Host "[uninstall] nothing selected. Use switches: -RemoveNode/-RemoveCodex/-RemoveClaude/-RemoveRunnerDeps"
    exit 0
  }

  $runnerRoot = Resolve-RunnerRoot
  $runtimeRoot = Join-Path $runnerRoot ".runtime"
  $portableNodeBin = Join-Path $runtimeRoot "node/current"
  $toolsRoot = Join-Path $runnerRoot ".tools"
  $npmGlobalPrefix = Join-Path $toolsRoot "npm-global"

  Add-PathOnce $portableNodeBin
  Add-PathOnce $npmGlobalPrefix
  Add-PathOnce (Join-Path $npmGlobalPrefix "node_modules/.bin")

  $npmCmd = Resolve-NpmCommand -portableNodeBin $portableNodeBin
  if (($RemoveCodex.IsPresent -or $RemoveClaude.IsPresent) -and [string]::IsNullOrWhiteSpace($npmCmd)) {
    Write-Host "[uninstall] npm unavailable, fallback to file cleanup only." -ForegroundColor Yellow
  }

  if ($RemoveCodex.IsPresent) {
    Write-Host "[uninstall] Removing Codex CLI..."
    if (-not [string]::IsNullOrWhiteSpace($npmCmd)) {
      & $npmCmd uninstall -g --prefix $npmGlobalPrefix @openai/codex --no-audit --fund=false --progress=false 2>$null | Out-Host
    }
    Get-ChildItem -Path $npmGlobalPrefix -Filter "codex*" -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Get-ChildItem -Path (Join-Path $npmGlobalPrefix "node_modules/.bin") -Filter "codex*" -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
  }

  if ($RemoveClaude.IsPresent) {
    Write-Host "[uninstall] Removing Claude Code CLI..."
    if (-not [string]::IsNullOrWhiteSpace($npmCmd)) {
      & $npmCmd uninstall -g --prefix $npmGlobalPrefix @anthropic-ai/claude-code --no-audit --fund=false --progress=false 2>$null | Out-Host
    }
    Get-ChildItem -Path $npmGlobalPrefix -Filter "claude*" -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
    Get-ChildItem -Path (Join-Path $npmGlobalPrefix "node_modules/.bin") -Filter "claude*" -ErrorAction SilentlyContinue | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
  }

  if ($RemoveRunnerDeps.IsPresent) {
    $depsDir = Join-Path $runnerRoot "node_modules"
    if (Test-Path $depsDir) {
      Write-Host "[uninstall] Removing runner node_modules..."
      Remove-Item -Path $depsDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  if ($RemoveNode.IsPresent) {
    $nodeDir = Join-Path $runtimeRoot "node"
    if (Test-Path $nodeDir) {
      Write-Host "[uninstall] Removing local Node runtime..."
      Remove-Item -Path $nodeDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  Write-Host ""
  Write-Host "==== Verification ===="
  if (Test-Cmd "node") { Write-Host ("node still available in PATH: " + (& node --version)) } else { Write-Host "node: not found in PATH" }
  if (Test-Cmd "codex") { Write-Host "codex: still found" } else { Write-Host "codex: not found" }
  if (Test-Cmd "claude") { Write-Host "claude: still found" } else { Write-Host "claude: not found" }
}
catch {
  Write-Host ("[uninstall] failed: " + $_.Exception.Message) -ForegroundColor Red
  exit 1
}

