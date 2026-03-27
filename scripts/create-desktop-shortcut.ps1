# Create Desktop Shortcut for AgentLab Runner Web GUI

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$startScript = Join-Path $scriptDir "start-web-gui.cmd"

$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "AgentLab Runner.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $startScript
$shortcut.WorkingDirectory = $runnerRoot
$shortcut.Description = "AgentLab Runner Control Panel"
$shortcut.IconLocation = "shell32.dll,13"
$shortcut.Save()

Write-Host "Desktop shortcut created!" -ForegroundColor Green
Write-Host ""
Write-Host "Location: $shortcutPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Double-click 'AgentLab Runner' icon on desktop to start" -ForegroundColor Yellow

$startMenuPath = [Environment]::GetFolderPath("StartMenu")
$programsPath = Join-Path $startMenuPath "Programs"
$startMenuShortcut = Join-Path $programsPath "AgentLab Runner.lnk"

$shortcut2 = $shell.CreateShortcut($startMenuShortcut)
$shortcut2.TargetPath = $startScript
$shortcut2.WorkingDirectory = $runnerRoot
$shortcut2.Description = "AgentLab Runner Control Panel"
$shortcut2.IconLocation = "shell32.dll,13"
$shortcut2.Save()

Write-Host "Start menu shortcut created!" -ForegroundColor Green

[System.Runtime.Interopservices.Marshal]::ReleaseComObject($shell) | Out-Null
