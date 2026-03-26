param(
  [switch]$InstallCodex,
  [switch]$InstallClaude,
  [switch]$InstallAll,
  [switch]$SkipNodeInstall,
  [switch]$SkipRunnerDeps
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

function Get-NodeMajorVersion() {
  if (-not (Test-Cmd "node")) { return -1 }
  try {
    $major = & node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>$null
    if ([string]::IsNullOrWhiteSpace($major)) { return -1 }
    return [int]$major
  }
  catch {
    return -1
  }
}

function Resolve-RunnerRoot() {
  if (Test-Path "runner/package.json") {
    return (Resolve-Path "runner").Path
  }
  if (Test-Path "package.json") {
    return (Get-Location).Path
  }
  throw "Cannot locate runner root (expected package.json in current dir or ./runner)."
}

function Resolve-NpmCommand([string]$portableNodeBin) {
  if (Test-Cmd "npm") {
    return "npm"
  }
  $portableNpm = Join-Path $portableNodeBin "npm.cmd"
  if (Test-Path $portableNpm) {
    return $portableNpm
  }
  throw "npm not found. Please rerun setup."
}

function Install-PortableNode20([string]$runtimeRoot, [string]$portableNodeBin) {
  Write-Host "[setup] Installing portable Node.js 20 (no admin required)..."
  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

  $shaUrl = "https://nodejs.org/dist/latest-v20.x/SHASUMS256.txt"
  $shaRaw = (Invoke-WebRequest -UseBasicParsing -Uri $shaUrl).Content
  $zipName = ($shaRaw -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "node-v20\.[0-9]+\.[0-9]+-win-x64\.zip$" } | Select-Object -First 1)
  if ([string]::IsNullOrWhiteSpace($zipName)) {
    throw "Cannot resolve latest Node.js v20 win-x64 zip from $shaUrl"
  }
  $zipName = ($zipName -split "\s+")[-1]
  $zipUrl = "https://nodejs.org/dist/latest-v20.x/$zipName"
  $zipPath = Join-Path $runtimeRoot $zipName
  $extractRoot = Join-Path $runtimeRoot "node-extract"

  if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue }
  if (Test-Path $extractRoot) { Remove-Item -Path $extractRoot -Recurse -Force -ErrorAction SilentlyContinue }

  Invoke-WebRequest -UseBasicParsing -Uri $zipUrl -OutFile $zipPath
  Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force
  $nodeDir = Get-ChildItem -Path $extractRoot -Directory | Select-Object -First 1
  if ($null -eq $nodeDir) {
    throw "Portable Node archive extracted but folder not found."
  }

  $portableNodeRoot = Split-Path -Path $portableNodeBin -Parent
  New-Item -ItemType Directory -Path $portableNodeRoot -Force | Out-Null
  if (Test-Path $portableNodeBin) {
    Remove-Item -Path $portableNodeBin -Recurse -Force -ErrorAction SilentlyContinue
  }
  Move-Item -Path $nodeDir.FullName -Destination $portableNodeBin -Force

  Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
  Remove-Item -Path $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
}

function Ensure-Node20([string]$runtimeRoot, [string]$portableNodeBin) {
  Add-PathOnce $portableNodeBin
  $major = Get-NodeMajorVersion
  if ($major -ge 20 -and (Test-Cmd "npm")) {
    return
  }
  if ($SkipNodeInstall.IsPresent) {
    throw "Node.js >= 20/npm not found and -SkipNodeInstall is set."
  }

  if (Test-Cmd "winget") {
    Write-Host "[setup] Installing Node.js LTS via winget..."
    try {
      winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Host
    }
    catch {
      Write-Host "[setup] winget install failed, fallback to portable Node.js..." -ForegroundColor Yellow
    }
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:PATH = ($machinePath + ";" + $userPath + ";" + $env:PATH)
  }

  $major = Get-NodeMajorVersion
  if ($major -ge 20 -and (Test-Cmd "npm")) {
    return
  }

  Install-PortableNode20 -runtimeRoot $runtimeRoot -portableNodeBin $portableNodeBin
  Add-PathOnce $portableNodeBin
  $major = Get-NodeMajorVersion
  if ($major -lt 20 -or -not (Test-Cmd "npm")) {
    throw "Node.js >= 20/npm still unavailable after portable install."
  }
}

$wantCodex = $InstallCodex.IsPresent
$wantClaude = $InstallClaude.IsPresent
if ($InstallAll.IsPresent -or (-not $wantCodex -and -not $wantClaude)) {
  $wantCodex = $true
  $wantClaude = $true
}

try {
  $runnerRoot = Resolve-RunnerRoot
  $runtimeRoot = Join-Path $runnerRoot ".runtime"
  $portableNodeBin = Join-Path $runtimeRoot "node/current"
  $toolsRoot = Join-Path $runnerRoot ".tools"
  $npmGlobalPrefix = Join-Path $toolsRoot "npm-global"

  New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $npmGlobalPrefix -Force | Out-Null

  Ensure-Node20 -runtimeRoot $runtimeRoot -portableNodeBin $portableNodeBin

  Add-PathOnce $npmGlobalPrefix
  Add-PathOnce (Join-Path $npmGlobalPrefix "node_modules/.bin")

  $npmCmd = Resolve-NpmCommand -portableNodeBin $portableNodeBin

  if ($wantCodex) {
    Write-Host "[setup] Installing Codex CLI (@openai/codex) to local runner tools..."
    & $npmCmd install -g --prefix $npmGlobalPrefix @openai/codex
  }

  if ($wantClaude) {
    Write-Host "[setup] Installing Claude Code CLI (@anthropic-ai/claude-code) to local runner tools..."
    & $npmCmd install -g --prefix $npmGlobalPrefix @anthropic-ai/claude-code
  }

  if (-not $SkipRunnerDeps.IsPresent) {
    Write-Host "[setup] Installing runner dependencies..."
    & $npmCmd --prefix $runnerRoot install
  }

  Write-Host ""
  Write-Host "==== Verification ===="
  if (Test-Cmd "node") { node --version }
  if (Test-Cmd "npm") { npm --version }
  if (Test-Cmd "codex") { codex --version } else { Write-Host "codex: not installed" }
  if (Test-Cmd "claude") { claude --version } else { Write-Host "claude: not installed" }

  $startScript = Join-Path $runnerRoot "scripts/start-runner.ps1"
  Write-Host ""
  Write-Host "==== Next steps ===="
  Write-Host "1) Authenticate selected CLI(s): codex login / claude login"
  Write-Host "2) Start runner:"
  Write-Host ('   powershell -ExecutionPolicy Bypass -File "' + $startScript + '" -Server "http://127.0.0.1:3200" -Token "xxxx"')
}
catch {
  Write-Host ("[setup] failed: " + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
