param(
  [string]$Server = "http://127.0.0.1:3200",
  [string]$Token = "",
  [ValidateSet("desktop","web")]
  [string]$GuiMode = "desktop"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runDir = Join-Path $root ".run"
if (-not (Test-Path $runDir)) {
  New-Item -ItemType Directory -Path $runDir | Out-Null
}

$guiPidFile = Join-Path $runDir "gui.pid"
$runnerPidFile = Join-Path $runDir "runner.pid"
$guiLog = Join-Path $runDir "gui.log"
$guiErrLog = Join-Path $runDir "gui.err.log"
$runnerLog = Join-Path $runDir "runner.log"
$runnerErrLog = Join-Path $runDir "runner.err.log"

function Add-PathOnce {
  param([string]$PathEntry)
  if ([string]::IsNullOrWhiteSpace($PathEntry)) { return }
  if (-not (Test-Path $PathEntry)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $PathEntry) { return }
  $env:PATH = "$PathEntry;$env:PATH"
}

function Prepare-RunnerEnvironment {
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Add-PathOnce (Join-Path $root ".runtime\node\current")
  Add-PathOnce (Join-Path $root ".tools\npm-global")
  Add-PathOnce (Join-Path $root ".tools\npm-global\node_modules\.bin")
  Add-PathOnce (Join-Path $env:ProgramFiles "nodejs")
  Add-PathOnce (Join-Path $env:LOCALAPPDATA "Programs\nodejs")
}

function Ensure-NodeReady {
  if (Get-Command node -ErrorAction SilentlyContinue) {
    return
  }

  $setupScript = Join-Path $root "scripts/setup-windows.ps1"
  if (-not (Test-Path $setupScript)) {
    throw "Node.js not found and setup script is missing: $setupScript"
  }

  Write-Host "[runner] Node.js not found. Running setup..."
  $setupArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $setupScript,
    "-InstallAll"
  )
  if ($env:RUNNER_USE_CN_MIRROR -eq "1") {
    $setupArgs += "-UseChinaMirror"
  }
  & powershell.exe @setupArgs
  if ($LASTEXITCODE -ne 0) {
    throw "setup-windows.ps1 failed with exit code $LASTEXITCODE"
  }

  Prepare-RunnerEnvironment
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js still not found after setup. Please reopen terminal and retry."
  }
}

function Start-ManagedProcess {
  param(
    [string]$Name,
    [string]$PidFile,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$StdoutPath,
    [string]$StderrPath
  )

  if (Test-Path $PidFile) {
    $existingPid = (Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($existingPid) {
      $existing = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
      if ($existing) {
        Write-Host "[runner] $Name already running (pid $existingPid)."
        return
      }
    }
    Remove-Item -Path $PidFile -ErrorAction SilentlyContinue
  }

  Write-Host "[runner] Starting $Name..."
  $proc = Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput $StdoutPath -RedirectStandardError $StderrPath
  Set-Content -Path $PidFile -Value $proc.Id -Encoding utf8
  Write-Host "[runner] $Name started (pid $($proc.Id))."
}

function Resolve-GuiStartScript {
  param([string]$Mode)
  if ($Mode -eq "web") {
    return Join-Path $root "scripts/start-web-gui.ps1"
  }
  return Join-Path $root "scripts/start-desktop-gui.ps1"
}

function Resolve-GuiName {
  param([string]$Mode)
  if ($Mode -eq "web") {
    return "Web GUI"
  }
  return "Desktop GUI"
}

if ($GuiMode -eq "desktop") {
  Write-Host "[runner] GUI mode: desktop (Electron window + tray)"
} else {
  Write-Host "[runner] GUI mode: web (browser)"
}

Prepare-RunnerEnvironment
Ensure-NodeReady

$guiScript = Resolve-GuiStartScript -Mode $GuiMode
$guiName = Resolve-GuiName -Mode $GuiMode

Start-ManagedProcess `
  -Name $guiName `
  -PidFile $guiPidFile `
  -FilePath "powershell.exe" `
  -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $guiScript) `
  -StdoutPath $guiLog `
  -StderrPath $guiErrLog

if ([string]::IsNullOrWhiteSpace($Token)) {
  $Token = $env:RUNNER_TOKEN
}

if ([string]::IsNullOrWhiteSpace($Token)) {
  Write-Host "[runner] RUNNER_TOKEN is empty, skip daemon startup."
  Write-Host "[runner] Run: .\start.ps1 -Token <token>"
} else {
  Start-ManagedProcess `
    -Name "Runner daemon" `
    -PidFile $runnerPidFile `
    -FilePath "powershell.exe" `
    -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Join-Path $root "scripts/start-runner.ps1"), "-Server", $Server, "-Token", $Token) `
    -StdoutPath $runnerLog `
    -StderrPath $runnerErrLog
}

Write-Host ""
Write-Host "[runner] Logs:"
Write-Host "  GUI:    $guiLog"
Write-Host "  Daemon: $runnerLog"
