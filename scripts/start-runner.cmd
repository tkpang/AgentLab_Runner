@echo off
setlocal

set "DEFAULT_SERVER=http://127.0.0.1:3200"

if "%RUNNER_TOKEN%"=="" (
  set /p RUNNER_TOKEN=RUNNER_TOKEN:
)

if "%RUNNER_SERVER%"=="" (
  set /p RUNNER_SERVER=RUNNER_SERVER [%DEFAULT_SERVER%]:
)

if "%RUNNER_SERVER%"=="" (
  set "RUNNER_SERVER=%DEFAULT_SERVER%"
)

if "%RUNNER_TOKEN%"=="" (
  echo RUNNER_TOKEN is required.
  pause
  exit /b 1
)

echo [AgentLab Runner] Starting with server=%RUNNER_SERVER%
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0start-runner.ps1" -Server "%RUNNER_SERVER%" -Token "%RUNNER_TOKEN%"

endlocal
