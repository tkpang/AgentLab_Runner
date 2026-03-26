Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$setupScript = Join-Path $scriptDir "setup-windows.ps1"
$startScript = Join-Path $scriptDir "start-runner.ps1"
$shellScript = Join-Path $scriptDir "runner-shell.ps1"
$verifyScript = Join-Path $scriptDir "verify-windows.ps1"
$authStatusScript = Join-Path $scriptDir "auth-status-windows.ps1"
$accountSlotsScript = Join-Path $scriptDir "account-slots-windows.ps1"

$form = New-Object System.Windows.Forms.Form
$form.Text = "AgentLab Runner Setup (Windows)"
$form.Size = New-Object System.Drawing.Size(920, 780)
$form.StartPosition = "CenterScreen"
$form.MinimumSize = New-Object System.Drawing.Size(920, 780)

$title = New-Object System.Windows.Forms.Label
$title.Text = "AgentLab Runner - One-click Setup"
$title.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(20, 16)
$form.Controls.Add($title)

$subTitle = New-Object System.Windows.Forms.Label
$subTitle.Text = "Install local Node/Codex/Claude, login, switch accounts, and start runner. All tools are kept under this runner folder."
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
$groupLogin.Text = "2) Login + Multi-Account Slots"
$groupLogin.Location = New-Object System.Drawing.Point(20, 220)
$groupLogin.Size = New-Object System.Drawing.Size(860, 170)
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

$btnAuthStatus = New-Object System.Windows.Forms.Button
$btnAuthStatus.Text = "Check Login Status"
$btnAuthStatus.Location = New-Object System.Drawing.Point(428, 35)
$btnAuthStatus.Size = New-Object System.Drawing.Size(150, 28)
$groupLogin.Controls.Add($btnAuthStatus)

$lblSlots = New-Object System.Windows.Forms.Label
$lblSlots.Text = "Account Slots:"
$lblSlots.Location = New-Object System.Drawing.Point(18, 78)
$lblSlots.AutoSize = $true
$groupLogin.Controls.Add($lblSlots)

$cbSlots = New-Object System.Windows.Forms.ComboBox
$cbSlots.DropDownStyle = "DropDownList"
$cbSlots.Location = New-Object System.Drawing.Point(108, 74)
$cbSlots.Size = New-Object System.Drawing.Size(220, 23)
$groupLogin.Controls.Add($cbSlots)

$btnRefreshSlots = New-Object System.Windows.Forms.Button
$btnRefreshSlots.Text = "Refresh Slots"
$btnRefreshSlots.Location = New-Object System.Drawing.Point(338, 72)
$btnRefreshSlots.Size = New-Object System.Drawing.Size(100, 26)
$groupLogin.Controls.Add($btnRefreshSlots)

$btnActivateSlot = New-Object System.Windows.Forms.Button
$btnActivateSlot.Text = "Activate Slot"
$btnActivateSlot.Location = New-Object System.Drawing.Point(448, 72)
$btnActivateSlot.Size = New-Object System.Drawing.Size(100, 26)
$groupLogin.Controls.Add($btnActivateSlot)

$btnDeleteSlot = New-Object System.Windows.Forms.Button
$btnDeleteSlot.Text = "Delete Slot"
$btnDeleteSlot.Location = New-Object System.Drawing.Point(558, 72)
$btnDeleteSlot.Size = New-Object System.Drawing.Size(100, 26)
$groupLogin.Controls.Add($btnDeleteSlot)

$lblNewSlot = New-Object System.Windows.Forms.Label
$lblNewSlot.Text = "Save Current As:"
$lblNewSlot.Location = New-Object System.Drawing.Point(18, 113)
$lblNewSlot.AutoSize = $true
$groupLogin.Controls.Add($lblNewSlot)

$tbNewSlot = New-Object System.Windows.Forms.TextBox
$tbNewSlot.Location = New-Object System.Drawing.Point(108, 109)
$tbNewSlot.Size = New-Object System.Drawing.Size(220, 23)
$tbNewSlot.Text = "account-1"
$groupLogin.Controls.Add($tbNewSlot)

$btnSaveSlot = New-Object System.Windows.Forms.Button
$btnSaveSlot.Text = "Save Slot"
$btnSaveSlot.Location = New-Object System.Drawing.Point(338, 107)
$btnSaveSlot.Size = New-Object System.Drawing.Size(100, 26)
$groupLogin.Controls.Add($btnSaveSlot)

$lblActiveSlot = New-Object System.Windows.Forms.Label
$lblActiveSlot.Text = "Active Slot: (none)"
$lblActiveSlot.Location = New-Object System.Drawing.Point(448, 112)
$lblActiveSlot.AutoSize = $true
$groupLogin.Controls.Add($lblActiveSlot)

$groupStart = New-Object System.Windows.Forms.GroupBox
$groupStart.Text = "3) Start Runner"
$groupStart.Location = New-Object System.Drawing.Point(20, 400)
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
$groupLog.Location = New-Object System.Drawing.Point(20, 530)
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
$status.Location = New-Object System.Drawing.Point(22, 722)
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
  $btnAuthStatus.Enabled = -not $busy
  $btnRefreshSlots.Enabled = -not $busy
  $btnActivateSlot.Enabled = -not $busy
  $btnDeleteSlot.Enabled = -not $busy
  $btnSaveSlot.Enabled = -not $busy
  $cbSlots.Enabled = -not $busy
  $tbNewSlot.Enabled = -not $busy
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

function Invoke-SlotActionJson([string]$action, [string]$slot) {
  $args = @("-Action", $action, "-Json")
  if (-not [string]::IsNullOrWhiteSpace($slot)) {
    $args += @("-Slot", $slot)
  }
  $raw = & $accountSlotsScript @args 2>&1 | Out-String
  if ([string]::IsNullOrWhiteSpace($raw)) {
    throw "Empty response from account slot script."
  }
  try {
    $obj = $raw | ConvertFrom-Json
  }
  catch {
    throw ("Invalid JSON response: " + $raw)
  }
  if (-not $obj.ok) {
    $err = if ($obj.error) { [string]$obj.error } else { "unknown error" }
    throw $err
  }
  return $obj
}

function Refresh-SlotList([string]$preferSlot = "") {
  try {
    $result = Invoke-SlotActionJson "list" ""
    $cbSlots.Items.Clear()
    $names = @()
    foreach ($s in $result.slots) {
      $name = [string]$s.name
      $names += $name
      [void]$cbSlots.Items.Add($name)
    }
    $active = [string]$result.activeSlot
    if ([string]::IsNullOrWhiteSpace($active)) {
      $lblActiveSlot.Text = "Active Slot: (none)"
    } else {
      $lblActiveSlot.Text = "Active Slot: $active"
    }

    $selected = ""
    if (-not [string]::IsNullOrWhiteSpace($preferSlot) -and $names -contains $preferSlot) {
      $selected = $preferSlot
    } elseif (-not [string]::IsNullOrWhiteSpace($active) -and $names -contains $active) {
      $selected = $active
    } elseif ($names.Count -gt 0) {
      $selected = $names[0]
    }
    if (-not [string]::IsNullOrWhiteSpace($selected)) {
      $cbSlots.SelectedItem = $selected
    }

    Add-Log("Slot list refreshed. total=$($names.Count), active=$active")
  }
  catch {
    Add-Log("Failed to refresh slots: $($_.Exception.Message)")
  }
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

$btnAuthStatus.Add_Click({
  Start-BackgroundScript "Checking login status..." $authStatusScript @()
})

$btnRefreshSlots.Add_Click({
  Refresh-SlotList ""
})

$btnSaveSlot.Add_Click({
  $slotName = $tbNewSlot.Text.Trim()
  if ([string]::IsNullOrWhiteSpace($slotName)) {
    [System.Windows.Forms.MessageBox]::Show("Please enter a slot name.", "Slot Required")
    return
  }
  try {
    $res = Invoke-SlotActionJson "save" $slotName
    Add-Log("Saved slot '$slotName' with $($res.savedCount) credential file(s).")
    if (-not [string]::IsNullOrWhiteSpace([string]$res.warning)) {
      Add-Log("Warning: $($res.warning)")
    }
    Refresh-SlotList $slotName
  }
  catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Save Slot Failed")
    Add-Log("Save slot failed: $($_.Exception.Message)")
  }
})

$btnActivateSlot.Add_Click({
  if ($cbSlots.SelectedItem -eq $null) {
    [System.Windows.Forms.MessageBox]::Show("Please select a slot to activate.", "No Slot Selected")
    return
  }
  $slotName = [string]$cbSlots.SelectedItem
  try {
    $res = Invoke-SlotActionJson "activate" $slotName
    Add-Log("Activated slot '$slotName', restored $($res.restoredCount) file(s).")
    Refresh-SlotList $slotName
  }
  catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Activate Slot Failed")
    Add-Log("Activate slot failed: $($_.Exception.Message)")
  }
})

$btnDeleteSlot.Add_Click({
  if ($cbSlots.SelectedItem -eq $null) {
    [System.Windows.Forms.MessageBox]::Show("Please select a slot to delete.", "No Slot Selected")
    return
  }
  $slotName = [string]$cbSlots.SelectedItem
  $confirm = [System.Windows.Forms.MessageBox]::Show(
    "Delete slot '$slotName' ?",
    "Confirm Delete",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Warning
  )
  if ($confirm -ne [System.Windows.Forms.DialogResult]::Yes) { return }
  try {
    $res = Invoke-SlotActionJson "delete" $slotName
    if ($res.deleted) {
      Add-Log("Deleted slot '$slotName'.")
    } else {
      Add-Log("Slot '$slotName' not found.")
    }
    Refresh-SlotList ""
  }
  catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, "Delete Slot Failed")
    Add-Log("Delete slot failed: $($_.Exception.Message)")
  }
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
Add-Log("Tip: install first, login, then save account slot.")
Refresh-SlotList ""
[void]$form.ShowDialog()
