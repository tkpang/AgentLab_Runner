param(
  [switch]$InstallCodex,
  [switch]$InstallClaude,
  [switch]$InstallAll,
  [switch]$SkipNodeInstall
)

$wantCodex = $InstallCodex.IsPresent
$wantClaude = $InstallClaude.IsPresent
$runnerPrefix = ""
if (Test-Path "runner/scripts") {
  $runnerPrefix = "runner/"
}

if ($InstallAll.IsPresent -or (-not $wantCodex -and -not $wantClaude)) {
  $wantCodex = $true
  $wantClaude = $true
}

function Test-Cmd($name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Ensure-Node {
  if ((Test-Cmd "node") -and (Test-Cmd "npm")) {
    return
  }
  if ($SkipNodeInstall.IsPresent) {
    throw "Node.js/npm not found and -SkipNodeInstall is set."
  }
  if (-not (Test-Cmd "winget")) {
    throw "Node.js/npm not found, and winget is unavailable. Please install Node.js >= 20 manually."
  }
  Write-Host "[setup] Installing Node.js LTS via winget..."
  winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
}

try {
  Ensure-Node

  if ($wantCodex) {
    Write-Host "[setup] Installing Codex CLI (@openai/codex)..."
    npm install -g @openai/codex
  }

  if ($wantClaude) {
    Write-Host "[setup] Installing Claude Code CLI (@anthropic-ai/claude-code)..."
    npm install -g @anthropic-ai/claude-code
  }

  Write-Host ""
  Write-Host "==== Verification ===="
  if (Test-Cmd "node") { node --version }
  if (Test-Cmd "npm") { npm --version }
  if (Test-Cmd "codex") { codex --version } else { Write-Host "codex: not installed" }
  if (Test-Cmd "claude") { claude --version } else { Write-Host "claude: not installed" }

  Write-Host ""
  Write-Host "==== Next steps ===="
  Write-Host "1) Authenticate selected CLI(s): codex login / claude login"
  if ([string]::IsNullOrWhiteSpace($runnerPrefix)) {
    Write-Host "2) Install runner deps: npm install"
  }
  else {
    Write-Host "2) Install runner deps: npm --prefix runner install"
  }
  Write-Host ("3) Start runner: powershell -ExecutionPolicy Bypass -File " + $runnerPrefix + 'scripts/start-runner.ps1 -Server "http://127.0.0.1:3200" -Token "xxxx"')
}
catch {
  Write-Host ("[setup] failed: " + $_.Exception.Message) -ForegroundColor Red
  exit 1
}
