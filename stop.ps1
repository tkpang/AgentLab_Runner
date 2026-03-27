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

  $pid = [int]$pidRaw
  $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
  if ($proc) {
    Write-Host "[runner] Stopping $Name (pid $pid)..."
    Stop-Process -Id $pid -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
    $proc2 = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc2) {
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[runner] $Name stopped."
  } else {
    Write-Host "[runner] $Name already exited (pid $pid)."
  }

  Remove-Item -Path $PidFile -ErrorAction SilentlyContinue
}

Stop-ManagedProcess -Name "Runner daemon" -PidFile $runnerPidFile
Stop-ManagedProcess -Name "GUI process" -PidFile $guiPidFile
