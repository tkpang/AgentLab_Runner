$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runDir = Join-Path $root ".run"
$guiPidFile = Join-Path $runDir "gui.pid"
$runnerPidFile = Join-Path $runDir "runner.pid"

function Stop-ManagedProcess {
  param(
    [string]$Name,
    [string]$PidFile
  )

  if (-not (Test-Path $PidFile)) {
    Write-Host "[runner] $Name not running (no pid file)."
    return
  }

  $pidRaw = Get-Content -Path $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $pidRaw) {
    Remove-Item -Path $PidFile -ErrorAction SilentlyContinue
    Write-Host "[runner] $Name pid file empty, cleaned."
    return
  }

  $targetPid = [int]$pidRaw
  $proc = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
  if ($proc) {
    Write-Host "[runner] Stopping $Name (pid $targetPid)..."
    Stop-Process -Id $targetPid -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
    $proc2 = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
    if ($proc2) {
      Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[runner] $Name stopped."
  } else {
    Write-Host "[runner] $Name already exited (pid $targetPid)."
  }

  Remove-Item -Path $PidFile -ErrorAction SilentlyContinue
}

function Stop-StaleRunnerProcesses {
  param([string]$RootPath)

  $normalizedRoot = [regex]::Escape($RootPath.ToLowerInvariant())
  try {
    $candidates = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $cmd = [string]$_.CommandLine
      if ([string]::IsNullOrWhiteSpace($cmd)) { return $false }
      $cmdLower = $cmd.ToLowerInvariant()
      if ($cmdLower -notmatch $normalizedRoot) { return $false }
      return (
        $cmdLower.Contains("agentlab-runner.ts") -or
        $cmdLower.Contains("start-runner.ps1") -or
        $cmdLower.Contains("gui\\server.cjs") -or
        $cmdLower.Contains("electron-main.cjs") -or
        $cmdLower.Contains("electron\\dist\\electron.exe") -or
        $cmdLower.Contains('npx-cli.js" electron .') -or
        $cmdLower.Contains("node_modules\\.bin\\..\\electron\\cli.js") -or
        $cmdLower.Contains("start-desktop-gui.ps1") -or
        $cmdLower.Contains("start-web-gui.ps1")
      )
    }

    foreach ($proc in $candidates) {
      try {
        Stop-Process -Id ([int]$proc.ProcessId) -Force -ErrorAction SilentlyContinue
        Write-Host "[runner] cleaned stale process pid=$($proc.ProcessId)"
      } catch {
        # ignore single process failures
      }
    }
  } catch {
    # ignore fallback cleanup failures
  }
}

Stop-ManagedProcess -Name "Runner daemon" -PidFile $runnerPidFile
Stop-ManagedProcess -Name "GUI process" -PidFile $guiPidFile
Stop-StaleRunnerProcesses -RootPath $root
