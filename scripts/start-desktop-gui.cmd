@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "RUNNER_ROOT=%SCRIPT_DIR%.."
set "GUI_DIR=%RUNNER_ROOT%\gui"
set "NODE_DIR=%RUNNER_ROOT%\.runtime\node\current"
set "NPM_GLOBAL=%RUNNER_ROOT%\.tools\npm-global"

echo [AgentLab Runner] Starting Desktop GUI...
echo.

REM Add Node to PATH
set "PATH=%NODE_DIR%;%NPM_GLOBAL%;%PATH%"

REM Check if Node is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [Error] Node.js not found. Please run setup first.
    pause
    exit /b 1
)

REM Check if Electron is installed
cd /d "%GUI_DIR%"
if not exist "node_modules\electron" (
    echo [Info] Installing Electron (first time only)...
    call npm install electron@28.0.0 --save-dev --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo [Error] Failed to install Electron
        pause
        exit /b 1
    )
    echo.
)

REM Start the desktop app
echo Starting AgentLab Runner Desktop App...
echo.

npx electron .

endlocal
