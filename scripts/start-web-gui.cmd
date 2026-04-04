@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "RUNNER_ROOT=%SCRIPT_DIR%.."
set "GUI_DIR=%RUNNER_ROOT%\gui"
set "NODE_DIR=%RUNNER_ROOT%\.runtime\node\current"

echo [AgentLab Runner] Starting Web GUI...
echo.

REM Add Node to PATH
set "PATH=%NODE_DIR%;%PATH%"

REM Check if Node is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [Error] Node.js not found. Please run setup first.
    pause
    exit /b 1
)

REM Start the web server
cd /d "%GUI_DIR%"
if "%AGENTLAB_GUI_PORT%"=="" (
  set "AGENTLAB_GUI_PORT=18765"
)
echo Starting server at http://localhost:%AGENTLAB_GUI_PORT%
echo Browser will open automatically...
echo.
echo Press Ctrl+C to stop the server
echo.

node server.cjs

endlocal
