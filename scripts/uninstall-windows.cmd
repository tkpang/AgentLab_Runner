@echo off
setlocal

echo [AgentLab Runner] Uninstall helper...
echo Example:
echo   uninstall-windows.cmd -RemoveCodex -RemoveClaude -RemoveNode
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-windows.ps1" %*

endlocal
