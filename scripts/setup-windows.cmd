@echo off
setlocal

echo [AgentLab Runner] Launching Windows setup...
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0setup-windows.ps1" -InstallAll

endlocal
