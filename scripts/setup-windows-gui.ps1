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
$quotaScript = Join-Path $scriptDir "quota-status-windows.ps1"

$form = New-Object System.Windows.Forms.Form
$form.Text = "AgentLab Runner Setup (Windows)"
$form.Size = New-Object System.Drawing.Size(920, 920)
$form.StartPosition = "CenterScreen"
$form.MinimumSize = New-Object System.Drawing.Size(920, 920)

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

$btnLanguage = New-Object System.Windows.Forms.Button
$btnLanguage.Text = "EN"
$btnLanguage.Location = New-Object System.Drawing.Point(810, 16)
$btnLanguage.Size = New-Object System.Drawing.Size(70, 30)
$form.Controls.Add($btnLanguage)

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

$groupQuota = New-Object System.Windows.Forms.GroupBox
$groupQuota.Text = "4) Quota"
$groupQuota.Location = New-Object System.Drawing.Point(20, 530)
$groupQuota.Size = New-Object System.Drawing.Size(860, 130)
$form.Controls.Add($groupQuota)

$lblQuotaAccount = New-Object System.Windows.Forms.Label
$lblQuotaAccount.Text = "当前账号: -"
$lblQuotaAccount.Location = New-Object System.Drawing.Point(18, 28)
$lblQuotaAccount.Size = New-Object System.Drawing.Size(620, 20)
$groupQuota.Controls.Add($lblQuotaAccount)

$lblQuotaPlan = New-Object System.Windows.Forms.Label
$lblQuotaPlan.Text = "套餐: -"
$lblQuotaPlan.Location = New-Object System.Drawing.Point(18, 48)
$lblQuotaPlan.Size = New-Object System.Drawing.Size(300, 20)
$groupQuota.Controls.Add($lblQuotaPlan)

$lblQuotaRefreshed = New-Object System.Windows.Forms.Label
$lblQuotaRefreshed.Text = "刷新时间: -"
$lblQuotaRefreshed.Location = New-Object System.Drawing.Point(340, 48)
$lblQuotaRefreshed.Size = New-Object System.Drawing.Size(300, 20)
$groupQuota.Controls.Add($lblQuotaRefreshed)

$btnQuotaRefresh = New-Object System.Windows.Forms.Button
$btnQuotaRefresh.Text = "刷新余量"
$btnQuotaRefresh.Location = New-Object System.Drawing.Point(700, 24)
$btnQuotaRefresh.Size = New-Object System.Drawing.Size(130, 26)
$groupQuota.Controls.Add($btnQuotaRefresh)

$lblQuota5h = New-Object System.Windows.Forms.Label
$lblQuota5h.Text = "5h 剩余: -"
$lblQuota5h.Location = New-Object System.Drawing.Point(18, 74)
$lblQuota5h.Size = New-Object System.Drawing.Size(180, 20)
$groupQuota.Controls.Add($lblQuota5h)

$pbQuota5h = New-Object System.Windows.Forms.ProgressBar
$pbQuota5h.Location = New-Object System.Drawing.Point(200, 74)
$pbQuota5h.Size = New-Object System.Drawing.Size(520, 18)
$pbQuota5h.Minimum = 0
$pbQuota5h.Maximum = 100
$pbQuota5h.Value = 0
$groupQuota.Controls.Add($pbQuota5h)

$lblQuota5hPercent = New-Object System.Windows.Forms.Label
$lblQuota5hPercent.Text = "0%"
$lblQuota5hPercent.Location = New-Object System.Drawing.Point(730, 74)
$lblQuota5hPercent.Size = New-Object System.Drawing.Size(100, 20)
$groupQuota.Controls.Add($lblQuota5hPercent)

$lblQuota7d = New-Object System.Windows.Forms.Label
$lblQuota7d.Text = "7d 剩余: -"
$lblQuota7d.Location = New-Object System.Drawing.Point(18, 100)
$lblQuota7d.Size = New-Object System.Drawing.Size(180, 20)
$groupQuota.Controls.Add($lblQuota7d)

$pbQuota7d = New-Object System.Windows.Forms.ProgressBar
$pbQuota7d.Location = New-Object System.Drawing.Point(200, 100)
$pbQuota7d.Size = New-Object System.Drawing.Size(520, 18)
$pbQuota7d.Minimum = 0
$pbQuota7d.Maximum = 100
$pbQuota7d.Value = 0
$groupQuota.Controls.Add($pbQuota7d)

$lblQuota7dPercent = New-Object System.Windows.Forms.Label
$lblQuota7dPercent.Text = "0%"
$lblQuota7dPercent.Location = New-Object System.Drawing.Point(730, 100)
$lblQuota7dPercent.Size = New-Object System.Drawing.Size(100, 20)
$groupQuota.Controls.Add($lblQuota7dPercent)

$groupLog = New-Object System.Windows.Forms.GroupBox
$groupLog.Text = "Logs"
$groupLog.Location = New-Object System.Drawing.Point(20, 670)
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
$status.Location = New-Object System.Drawing.Point(22, 862)
$form.Controls.Add($status)

$script:activeJob = $null
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 350
$script:lang = "zh"
$script:activeSlotName = ""
$script:quotaState = $null

function T([string]$k) {
  if ($script:lang -eq "en") {
    switch ($k) {
      "form_title" { return "AgentLab Runner Setup (Windows)" }
      "title" { return "AgentLab Runner - One-click Setup" }
      "subtitle" { return "Install local Node/Codex/Claude, login, switch accounts, and start runner. All tools are kept under this runner folder." }
      "group_install" { return "1) Install / Repair Environment" }
      "install_codex" { return "Install Codex" }
      "install_claude" { return "Install Claude Code" }
      "use_mirror" { return "Use China Mirror (faster in CN)" }
      "btn_install" { return "Install / Repair" }
      "btn_verify" { return "Verify" }
      "btn_open_folder" { return "Open Runner Folder" }
      "group_login" { return "2) Login + Multi-Account Slots" }
      "btn_login_codex" { return "Login Codex" }
      "btn_login_claude" { return "Login Claude" }
      "btn_open_shell" { return "Open Runner Shell" }
      "btn_check_login" { return "Check Login Status" }
      "label_slots" { return "Account Slots:" }
      "btn_refresh_slots" { return "Refresh Slots" }
      "btn_activate_slot" { return "Activate Slot" }
      "btn_delete_slot" { return "Delete Slot" }
      "label_save_as" { return "Save Current As:" }
      "btn_save_slot" { return "Save Slot" }
      "active_slot_none" { return "Active Slot: (none)" }
      "active_slot" { return "Active Slot: " }
      "group_start" { return "3) Start Runner" }
      "label_server" { return "Server:" }
      "label_token" { return "Token:" }
      "btn_start_runner" { return "Start Runner" }
      "group_quota" { return "4) Quota" }
      "btn_quota_refresh" { return "Refresh Quota" }
      "quota_account" { return "Account:" }
      "quota_plan" { return "Plan:" }
      "quota_refreshed" { return "Refreshed:" }
      "quota_5h" { return "5h Remaining:" }
      "quota_7d" { return "7d Remaining:" }
      "quota_unknown" { return "-" }
      "quota_unavailable" { return "Unavailable" }
      "quota_loading" { return "Refreshing quota..." }
      "quota_reset" { return "reset" }
      "group_logs" { return "Logs" }
      "ready" { return "Ready" }
      "msg_busy" { return "A task is already running. Please wait." }
      "msg_select_cli" { return "Select at least one CLI (Codex or Claude)." }
      "msg_slot_required" { return "Please enter a slot name." }
      "msg_no_slot_activate" { return "Please select a slot to activate." }
      "msg_no_slot_delete" { return "Please select a slot to delete." }
      "msg_token_required" { return "Please input RUNNER_TOKEN first." }
      "msg_confirm_delete" { return "Delete slot '" }
      "msg_confirm_delete_tail" { return "' ?" }
      "log_tip" { return "Tip: install first, login, then save account slot." }
      default { return $k }
    }
  }
  switch ($k) {
    "form_title" { return "AgentLab Runner 安装器 (Windows)" }
    "title" { return "AgentLab Runner - 一键配置" }
    "subtitle" { return "安装本地 Node/Codex/Claude，登录账号，切换多账号，并启动 runner。工具都保存在当前 runner 目录。" }
    "group_install" { return "1) 安装 / 修复环境" }
    "install_codex" { return "安装 Codex" }
    "install_claude" { return "安装 Claude Code" }
    "use_mirror" { return "使用国内镜像加速" }
    "btn_install" { return "安装 / 修复" }
    "btn_verify" { return "环境检测" }
    "btn_open_folder" { return "打开 Runner 目录" }
    "group_login" { return "2) 账号登录 + 多账号槽位" }
    "btn_login_codex" { return "登录 Codex" }
    "btn_login_claude" { return "登录 Claude" }
    "btn_open_shell" { return "打开 Runner 终端" }
    "btn_check_login" { return "检查登录状态" }
    "label_slots" { return "账号槽位：" }
    "btn_refresh_slots" { return "刷新槽位" }
    "btn_activate_slot" { return "启用槽位" }
    "btn_delete_slot" { return "删除槽位" }
    "label_save_as" { return "保存当前账号为：" }
    "btn_save_slot" { return "保存槽位" }
    "active_slot_none" { return "当前槽位：无" }
    "active_slot" { return "当前槽位：" }
    "group_start" { return "3) 启动 Runner" }
    "label_server" { return "服务端：" }
    "label_token" { return "Token：" }
    "btn_start_runner" { return "启动 Runner" }
    "group_quota" { return "4) 额度余量" }
    "btn_quota_refresh" { return "刷新余量" }
    "quota_account" { return "当前账号：" }
    "quota_plan" { return "套餐：" }
    "quota_refreshed" { return "刷新时间：" }
    "quota_5h" { return "5h 剩余：" }
    "quota_7d" { return "7d 剩余：" }
    "quota_unknown" { return "-" }
    "quota_unavailable" { return "不可用" }
    "quota_loading" { return "正在刷新额度..." }
    "quota_reset" { return "重置" }
    "group_logs" { return "日志" }
    "ready" { return "就绪" }
    "msg_busy" { return "已有任务在执行，请稍候。" }
    "msg_select_cli" { return "请至少勾选一个 CLI（Codex 或 Claude）。" }
    "msg_slot_required" { return "请输入槽位名称。" }
    "msg_no_slot_activate" { return "请先选择要启用的槽位。" }
    "msg_no_slot_delete" { return "请先选择要删除的槽位。" }
    "msg_token_required" { return "请先填写 RUNNER_TOKEN。" }
    "msg_confirm_delete" { return "确认删除槽位 '" }
    "msg_confirm_delete_tail" { return "' 吗？" }
    "log_tip" { return "提示：先安装，再登录，再保存账号槽位。" }
    default { return $k }
  }
}

function Update-ActiveSlotLabel() {
  if ([string]::IsNullOrWhiteSpace($script:activeSlotName)) {
    $lblActiveSlot.Text = T "active_slot_none"
  } else {
    $lblActiveSlot.Text = (T "active_slot") + " " + $script:activeSlotName
  }
}

function Set-QuotaUnavailable([string]$message = "") {
  $msg = if ([string]::IsNullOrWhiteSpace($message)) { T "quota_unavailable" } else { $message }
  $lblQuotaAccount.Text = (T "quota_account") + " " + $msg
  $lblQuotaPlan.Text = (T "quota_plan") + " " + (T "quota_unknown")
  $lblQuotaRefreshed.Text = (T "quota_refreshed") + " " + (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  $lblQuota5h.Text = (T "quota_5h") + " " + (T "quota_unknown")
  $lblQuota7d.Text = (T "quota_7d") + " " + (T "quota_unknown")
  $pbQuota5h.Value = 0
  $pbQuota7d.Value = 0
  $lblQuota5hPercent.Text = "0%"
  $lblQuota7dPercent.Text = "0%"
}

function Apply-QuotaData($quotaObj) {
  $script:quotaState = $quotaObj
  if ($null -eq $quotaObj -or -not $quotaObj.ok) {
    $msg = ""
    try { $msg = [string]$quotaObj.error } catch {}
    Set-QuotaUnavailable $msg
    return
  }
  $identity = ""
  $planType = ""
  $refreshedAt = ""
  try { $identity = [string]$quotaObj.account.identity } catch {}
  try { $planType = [string]$quotaObj.account.planType } catch {}
  try { $refreshedAt = [string]$quotaObj.refreshedAt } catch {}
  if ([string]::IsNullOrWhiteSpace($identity)) { $identity = T "quota_unknown" }
  if ([string]::IsNullOrWhiteSpace($planType)) { $planType = T "quota_unknown" }
  if ([string]::IsNullOrWhiteSpace($refreshedAt)) { $refreshedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss") }

  $pRemain = 0
  $sRemain = 0
  $pReset = ""
  $sReset = ""
  try { $pRemain = [int]$quotaObj.primary.remainingPercent } catch { $pRemain = 0 }
  try { $sRemain = [int]$quotaObj.secondary.remainingPercent } catch { $sRemain = 0 }
  try { $pReset = [string]$quotaObj.primary.resetsAtLocal } catch {}
  try { $sReset = [string]$quotaObj.secondary.resetsAtLocal } catch {}

  if ($pRemain -lt 0) { $pRemain = 0 }
  if ($pRemain -gt 100) { $pRemain = 100 }
  if ($sRemain -lt 0) { $sRemain = 0 }
  if ($sRemain -gt 100) { $sRemain = 100 }

  $lblQuotaAccount.Text = (T "quota_account") + " " + $identity
  $lblQuotaPlan.Text = (T "quota_plan") + " " + $planType
  $lblQuotaRefreshed.Text = (T "quota_refreshed") + " " + $refreshedAt

  $lblQuota5h.Text = (T "quota_5h") + " " + $pRemain + "%" + $(if ([string]::IsNullOrWhiteSpace($pReset)) { "" } else { "  (" + (T "quota_reset") + " " + $pReset + ")" })
  $lblQuota7d.Text = (T "quota_7d") + " " + $sRemain + "%" + $(if ([string]::IsNullOrWhiteSpace($sReset)) { "" } else { "  (" + (T "quota_reset") + " " + $sReset + ")" })

  $pbQuota5h.Value = $pRemain
  $pbQuota7d.Value = $sRemain
  $lblQuota5hPercent.Text = "$pRemain%"
  $lblQuota7dPercent.Text = "$sRemain%"
}

function Apply-Language() {
  $form.Text = T "form_title"
  $title.Text = T "title"
  $subTitle.Text = T "subtitle"
  $groupInstall.Text = T "group_install"
  $cbCodex.Text = T "install_codex"
  $cbClaude.Text = T "install_claude"
  $cbMirror.Text = T "use_mirror"
  $btnInstall.Text = T "btn_install"
  $btnVerify.Text = T "btn_verify"
  $btnOpenFolder.Text = T "btn_open_folder"
  $groupLogin.Text = T "group_login"
  $btnCodexLogin.Text = T "btn_login_codex"
  $btnClaudeLogin.Text = T "btn_login_claude"
  $btnOpenShell.Text = T "btn_open_shell"
  $btnAuthStatus.Text = T "btn_check_login"
  $lblSlots.Text = T "label_slots"
  $btnRefreshSlots.Text = T "btn_refresh_slots"
  $btnActivateSlot.Text = T "btn_activate_slot"
  $btnDeleteSlot.Text = T "btn_delete_slot"
  $lblNewSlot.Text = T "label_save_as"
  $btnSaveSlot.Text = T "btn_save_slot"
  $groupStart.Text = T "group_start"
  $lblServer.Text = T "label_server"
  $lblToken.Text = T "label_token"
  $btnStartRunner.Text = T "btn_start_runner"
  $groupQuota.Text = T "group_quota"
  $btnQuotaRefresh.Text = T "btn_quota_refresh"
  $groupLog.Text = T "group_logs"
  if ($status.Text -eq "Ready" -or $status.Text -eq "就绪") {
    $status.Text = T "ready"
  }
  Update-ActiveSlotLabel
  if ($null -ne $script:quotaState) {
    Apply-QuotaData $script:quotaState
  }
  else {
    Set-QuotaUnavailable (T "quota_unknown")
  }
  if ($script:lang -eq "zh") {
    $btnLanguage.Text = "EN"
  } else {
    $btnLanguage.Text = "中文"
  }
}

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
  $btnQuotaRefresh.Enabled = -not $busy
  $cbSlots.Enabled = -not $busy
  $tbNewSlot.Enabled = -not $busy
  $cbCodex.Enabled = -not $busy
  $cbClaude.Enabled = -not $busy
  $cbMirror.Enabled = -not $busy
  if ($busy) {
    $status.Text = $text
  } else {
    $status.Text = T "ready"
  }
}

function Start-BackgroundScript([string]$displayName, [string]$scriptPath, [string[]]$arguments) {
  if ($script:activeJob -and $script:activeJob.State -eq "Running") {
    [System.Windows.Forms.MessageBox]::Show((T "msg_busy"), (T "ready"))
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
    $script:activeSlotName = $active
    Update-ActiveSlotLabel

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

function Refresh-QuotaStatus() {
  try {
    Set-Busy $true (T "quota_loading")
    $raw = & $quotaScript -Json 2>&1 | Out-String
    if ([string]::IsNullOrWhiteSpace($raw)) {
      throw "empty quota response"
    }
    $obj = $raw | ConvertFrom-Json -Depth 10
    Apply-QuotaData $obj
    if ($obj.ok) {
      Add-Log("Quota refreshed: 5h=$($obj.primary.remainingPercent)% 7d=$($obj.secondary.remainingPercent)%")
    }
    else {
      Add-Log("Quota refresh failed: $($obj.error)")
    }
  }
  catch {
    Set-QuotaUnavailable $_.Exception.Message
    Add-Log("Quota refresh failed: $($_.Exception.Message)")
  }
  finally {
    Set-Busy $false
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
    [System.Windows.Forms.MessageBox]::Show((T "msg_select_cli"), (T "group_install"))
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

$btnQuotaRefresh.Add_Click({
  Refresh-QuotaStatus
})

$btnSaveSlot.Add_Click({
  $slotName = $tbNewSlot.Text.Trim()
  if ([string]::IsNullOrWhiteSpace($slotName)) {
    [System.Windows.Forms.MessageBox]::Show((T "msg_slot_required"), (T "group_login"))
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
    [System.Windows.Forms.MessageBox]::Show((T "msg_no_slot_activate"), (T "group_login"))
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
    [System.Windows.Forms.MessageBox]::Show((T "msg_no_slot_delete"), (T "group_login"))
    return
  }
  $slotName = [string]$cbSlots.SelectedItem
  $confirm = [System.Windows.Forms.MessageBox]::Show(
    ((T "msg_confirm_delete") + $slotName + (T "msg_confirm_delete_tail")),
    (T "btn_delete_slot"),
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
    [System.Windows.Forms.MessageBox]::Show((T "msg_token_required"), (T "group_start"))
    return
  }
  if ([string]::IsNullOrWhiteSpace($server)) {
    $server = "http://127.0.0.1:3200"
  }
  Start-Process powershell -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File",$startScript,"-Server",$server,"-Token",$token) -WorkingDirectory $runnerRoot | Out-Null
  Add-Log("Opened terminal: start runner")
})

$btnLanguage.Add_Click({
  if ($script:lang -eq "zh") {
    $script:lang = "en"
  } else {
    $script:lang = "zh"
  }
  Apply-Language
})

$form.Add_FormClosed({
  if ($script:activeJob) {
    Stop-Job -Job $script:activeJob -ErrorAction SilentlyContinue
    Remove-Job -Job $script:activeJob -Force -ErrorAction SilentlyContinue
    $script:activeJob = $null
  }
})

Add-Log("Runner root: $runnerRoot")
Apply-Language
Add-Log((T "log_tip"))
Refresh-SlotList ""
[void]$form.ShowDialog()
