Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$setupScript = Join-Path $scriptDir "setup-windows.ps1"
$startScript = Join-Path $scriptDir "start-runner.ps1"
$shellScript = Join-Path $scriptDir "runner-shell.ps1"
$verifyScript = Join-Path $scriptDir "verify-windows.ps1"

$form = New-Object System.Windows.Forms.Form
$form.Text = "AgentLab Runner Setup (Windows)"
$form.Size = New-Object System.Drawing.Size(920, 680)
$form.StartPosition = "CenterScreen"
$form.MinimumSize = New-Object System.Drawing.Size(920, 680)

$title = New-Object System.Windows.Forms.Label
$title.Text = "AgentLab Runner - One-click Setup"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(20, 16)
$form.Controls.Add($title)

$subTitle = New-Object System.Windows.Forms.Label
$subTitle.Text = "Install local Node/Codex/Claude, login, and start runner. All tools are kept under this runner folder."
$subTitle.AutoSize = $true
$subTitle.Location = New-Object System.Drawing.Point(22, 46)
$form.Controls.Add($subTitle)

$groupInstall = New-Object System.Windows.Forms.GroupBox
$groupInstall.Text = "1) Install / Repair Environment"
$groupInstall.Location = New-Object System.Drawing.Point(20, 80)
$groupInstall.Size = New-Object System.Drawing.Size(860, 130)
$form.Controls.Add($groupInstall)

$cbCodex = New-Object System.Windows.Forms.CheckBox
$cbCodex.Text = "Install Codex"
$cbCodex.Checked = $true
$cbCodex.Location = New-Object System.Drawing.Point(18, 32)
$groupInstall.Controls.Add($cbCodex)

$cbClaude = New-Object System.Windows.Forms.CheckBox
$cbClaude.Text = "Install Claude Code"
$cbClaude.Checked = $true
$cbClaude.Location = New-Object System.Drawing.Point(150, 32)
$groupInstall.Controls.Add($cbClaude)

$cbMirror = New-Object System.Windows.Forms.CheckBox
$cbMirror.Text = "Use China Mirror (faster in CN)"
$cbMirror.Checked = $true
$cbMirror.Location = New-Object System.Drawing.Point(18, 58)
$cbMirror.AutoSize = $true
$groupInstall.Controls.Add($cbMirror)

$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = "Install / Repair"
$btnInstall.Location = New-Object System.Drawing.Point(18, 86)
$btnInstall.Size = New-Object System.Drawing.Size(130, 28)
$groupInstall.Controls.Add($btnInstall)

$btnVerify = New-Object System.Windows.Forms.Button
$btnVerify.Text = "Verify"
$btnVerify.Location = New-Object System.Drawing.Point(158, 86)
$btnVerify.Size = New-Object System.Drawing.Size(100, 28)
$groupInstall.Controls.Add($btnVerify)

$btnOpenFolder = New-Object System.Windows.Forms.Button
$btnOpenFolder.Text = "Open Runner Folder"
$btnOpenFolder.Location = New-Object System.Drawing.Point(268, 86)
$btnOpenFolder.Size = New-Object System.Drawing.Size(150, 28)
$groupInstall.Controls.Add($btnOpenFolder)

$groupLogin = New-Object System.Windows.Forms.GroupBox
$groupLogin.Text = "2) Login Accounts"
$groupLogin.Location = New-Object System.Drawing.Point(20, 220)
$groupLogin.Size = New-Object System.Drawing.Size(860, 90)
$form.Controls.Add($groupLogin)

$btnCodexLogin = New-Object System.Windows.Forms.Button
$btnCodexLogin.Text = "Login Codex"
$btnCodexLogin.Location = New-Object System.Drawing.Point(18, 35)
$btnCodexLogin.Size = New-Object System.Drawing.Size(120, 28)
$groupLogin.Controls.Add($btnCodexLogin)

$btnClaudeLogin = New-Object System.Windows.Forms.Button
$btnClaudeLogin.Text = "Login Claude"
$btnClaudeLogin.Location = New-Object System.Drawing.Point(148, 35)
$btnClaudeLogin.Size = New-Object System.Drawing.Size(120, 28)
$groupLogin.Controls.Add($btnClaudeLogin)

$btnOpenShell = New-Object System.Windows.Forms.Button
$btnOpenShell.Text = "Open Runner Shell"
$btnOpenShell.Location = New-Object System.Drawing.Point(278, 35)
$btnOpenShell.Size = New-Object System.Drawing.Size(140, 28)
$groupLogin.Controls.Add($btnOpenShell)

$groupStart = New-Object System.Windows.Forms.GroupBox
$groupStart.Text = "3) Start Runner"
$groupStart.Location = New-Object System.Drawing.Point(20, 320)
$groupStart.Size = New-Object System.Drawing.Size(860, 120)
$form.Controls.Add($groupStart)

$lblServer = New-Object System.Windows.Forms.Label
$lblServer.Text = "Server:"
$lblServer.Location = New-Object System.Drawing.Point(18, 34)
$lblServer.AutoSize = $true
$groupStart.Controls.Add($lblServer)

$tbServer = New-Object System.Windows.Forms.TextBox
$tbServer.Text = "http://127.0.0.1:3200"
$tbServer.Location = New-Object System.Drawing.Point(72, 30)
$tbServer.Size = New-Object System.Drawing.Size(350, 23)
$groupStart.Controls.Add($tbServer)

$lblToken = New-Object System.Windows.Forms.Label
$lblToken.Text = "Token:"
$lblToken.Location = New-Object System.Drawing.Point(18, 68)
$lblToken.AutoSize = $true
$groupStart.Controls.Add($lblToken)

$tbToken = New-Object System.Windows.Forms.TextBox
$tbToken.Location = New-Object System.Drawing.Point(72, 64)
$tbToken.Size = New-Object System.Drawing.Size(600, 23)
$groupStart.Controls.Add($tbToken)

$btnStartRunner = New-Object System.Windows.Forms.Button
$btnStartRunner.Text = "Start Runner"
$btnStartRunner.Location = New-Object System.Drawing.Point(690, 62)
$btnStartRunner.Size = New-Object System.Drawing.Size(140, 28)
$groupStart.Controls.Add($btnStartRunner)

$groupLog = New-Object System.Windows.Forms.GroupBox
$groupLog.Text = "Logs"
$groupLog.Location = New-Object System.Drawing.Point(20, 450)
$groupLog.Size = New-Object System.Drawing.Size(860, 180)
$form.Controls.Add($groupLog)

$tbLog = New-Object System.Windows.Forms.TextBox
$tbLog.Multiline = $true
$tbLog.ReadOnly = $true
$tbLog.ScrollBars = "Vertical"
$tbLog.Font = New-Object System.Drawing.Font("Consolas", 9)
$tbLog.Location = New-Object System.Drawing.Point(16, 24)
$tbLog.Size = New-Object System.Drawing.Size(828, 140)
$groupLog.Controls.Add($tbLog)

$status = New-Object System.Windows.Forms.Label
$status.Text = "Ready"
$status.AutoSize = $true
$status.Location = New-Object System.Drawing.Point(22, 636)
$form.Controls.Add($status)

$script:activeJob = $null
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 350

function Add-Log([string]$message) {
  if ([string]::IsNullOrWhiteSpace($message)) { return }
  $ts = (Get-Date).ToString("HH:mm:ss")
  $tbLog.AppendText("[$ts] $message`r`n")
  $tbLog.SelectionStart = $tbLog.TextLength
  $tbLog.ScrollToCaret()
}

function Set-Busy([bool]$busy, [string]$text = "") {
  $btnInstall.Enabled = -not $busy
  $btnVerify.Enabled = -not $busy
  $cbCodex.Enabled = -not $busy
  $cbClaude.Enabled = -not $busy
  $cbMirror.Enabled = -not $busy
  if ($busy) {
    $status.Text = $text
  } else {
    $status.Text = "Ready"
  }
}

function Start-BackgroundScript([string]$displayName, [string]$scriptPath, [string[]]$arguments) {
  if ($script:activeJob -and $script:activeJob.State -eq "Running") {
    [System.Windows.Forms.MessageBox]::Show("A task is already running. Please wait.", "Busy")
    return
  }
  Add-Log("Start: $displayName")
  Set-Busy $true $displayName

  $script:activeJob = Start-Job -ScriptBlock {
    param($targetScript, $args, $cwd)
    Set-Location $cwd
    & $targetScript @args 2>&1 | ForEach-Object { $_.ToString() }
    $code = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
    "__EXIT_CODE__:$code"
  } -ArgumentList $scriptPath, $arguments, $runnerRoot

  $timer.Start()
}

$timer.Add_Tick({
  if (-not $script:activeJob) {
    $timer.Stop()
    return
  }
  $chunk = Receive-Job -Job $script:activeJob -ErrorAction SilentlyContinue
  foreach ($line in $chunk) {
    $s = "$line"
    if ($s.StartsWith("__EXIT_CODE__:")) {
      $exitCode = $s.Substring(12)
      if ($exitCode -eq "0") {
        Add-Log("Done (exit code 0).")
      } else {
        Add-Log("Failed (exit code $exitCode).")
      }
    } else {
      Add-Log($s)
    }
  }

  if ($script:activeJob.State -in @("Completed", "Failed", "Stopped")) {
    $tail = Receive-Job -Job $script:activeJob -ErrorAction SilentlyContinue
    foreach ($line in $tail) {
      $s = "$line"
      if ($s.StartsWith("__EXIT_CODE__:")) {
        $exitCode = $s.Substring(12)
        if ($exitCode -eq "0") {
          Add-Log("Done (exit code 0).")
        } else {
          Add-Log("Failed (exit code $exitCode).")
        }
      } else {
        Add-Log($s)
      }
    }
    Remove-Job -Job $script:activeJob -Force -ErrorAction SilentlyContinue
    $script:activeJob = $null
    $timer.Stop()
    Set-Busy $false
  }
})

$btnInstall.Add_Click({
  $args = @()
  if ($cbCodex.Checked -and $cbClaude.Checked) {
    $args += "-InstallAll"
  } elseif ($cbCodex.Checked) {
    $args += "-InstallCodex"
  } elseif ($cbClaude.Checked) {
    $args += "-InstallClaude"
  } else {
    [System.Windows.Forms.MessageBox]::Show("Select at least one CLI (Codex or Claude).", "Invalid Option")
    return
  }
  if ($cbMirror.Checked) {
    $args += "-UseChinaMirror"
  }
  Start-BackgroundScript "Installing environment..." $setupScript $args
})

$btnVerify.Add_Click({
  Start-BackgroundScript "Verifying environment..." $verifyScript @()
})

$btnOpenFolder.Add_Click({
  Start-Process explorer.exe $runnerRoot | Out-Null
})

$btnCodexLogin.Add_Click({
  Start-Process powershell -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File",$shellScript,"-Command","codex login") -WorkingDirectory $runnerRoot | Out-Null
  Add-Log("Opened terminal: codex login")
})

$btnClaudeLogin.Add_Click({
  Start-Process powershell -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File",$shellScript,"-Command","claude login") -WorkingDirectory $runnerRoot | Out-Null
  Add-Log("Opened terminal: claude login")
})

$btnOpenShell.Add_Click({
  Start-Process powershell -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File",$shellScript) -WorkingDirectory $runnerRoot | Out-Null
  Add-Log("Opened runner shell.")
})

$btnStartRunner.Add_Click({
  $token = $tbToken.Text.Trim()
  $server = $tbServer.Text.Trim()
  if ([string]::IsNullOrWhiteSpace($token)) {
    [System.Windows.Forms.MessageBox]::Show("Please input RUNNER_TOKEN first.", "Token Required")
    return
  }
  if ([string]::IsNullOrWhiteSpace($server)) {
    $server = "http://127.0.0.1:3200"
  }
  Start-Process powershell -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File",$startScript,"-Server",$server,"-Token",$token) -WorkingDirectory $runnerRoot | Out-Null
  Add-Log("Opened terminal: start runner")
})

$form.Add_FormClosed({
  if ($script:activeJob) {
    Stop-Job -Job $script:activeJob -ErrorAction SilentlyContinue
    Remove-Job -Job $script:activeJob -Force -ErrorAction SilentlyContinue
    $script:activeJob = $null
  }
})

Add-Log("Runner root: $runnerRoot")
Add-Log("Tip: install first, then login, then start runner.")
[void]$form.ShowDialog()
