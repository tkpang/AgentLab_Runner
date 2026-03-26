@echo off
setlocal

echo [AgentLab Runner] Launching GUI installer...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows-gui.ps1"

endlocal
