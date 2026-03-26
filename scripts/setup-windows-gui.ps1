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
$form.Size = New-Object System.Drawing.Size(960, 940)
$form.StartPosition = "CenterScreen"
$form.MinimumSize = New-Object System.Drawing.Size(960, 940)
$form.AutoScaleMode = [System.Windows.Forms.AutoScaleMode]::None
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

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
$btnLanguage.Location = New-Object System.Drawing.Point(850, 16)
$btnLanguage.Size = New-Object System.Drawing.Size(70, 30)
$form.Controls.Add($btnLanguage)

$groupInstall = New-Object System.Windows.Forms.GroupBox
$groupInstall.Text = "1) Install / Repair Environment"
$groupInstall.Location = New-Object System.Drawing.Point(20, 80)
$groupInstall.Size = New-Object System.Drawing.Size(900, 140)
$form.Controls.Add($groupInstall)

$cbCodex = New-Object System.Windows.Forms.CheckBox
$cbCodex.Text = "Install Codex"
$cbCodex.Checked = $true
$cbCodex.AutoSize = $true
$cbCodex.Location = New-Object System.Drawing.Point(18, 32)
$groupInstall.Controls.Add($cbCodex)

$cbClaude = New-Object System.Windows.Forms.CheckBox
$cbClaude.Text = "Install Claude Code"
$cbClaude.Checked = $true
$cbClaude.AutoSize = $true
$cbClaude.Location = New-Object System.Drawing.Point(170, 32)
$groupInstall.Controls.Add($cbClaude)

$cbMirror = New-Object System.Windows.Forms.CheckBox
$cbMirror.Text = "Use China Mirror (faster in CN)"
$cbMirror.Checked = $true
$cbMirror.AutoSize = $true
$cbMirror.Location = New-Object System.Drawing.Point(18, 58)
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

$lblEnvNode = New-Object System.Windows.Forms.Label
$lblEnvNode.Text = "Node: -"
$lblEnvNode.Location = New-Object System.Drawing.Point(440, 32)
$lblEnvNode.Size = New-Object System.Drawing.Size(130, 24)
$lblEnvNode.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$lblEnvNode.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$groupInstall.Controls.Add($lblEnvNode)

$lblEnvCodex = New-Object System.Windows.Forms.Label
$lblEnvCodex.Text = "Codex: -"
$lblEnvCodex.Location = New-Object System.Drawing.Point(580, 32)
$lblEnvCodex.Size = New-Object System.Drawing.Size(130, 24)
$lblEnvCodex.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$lblEnvCodex.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$groupInstall.Controls.Add($lblEnvCodex)

$lblEnvClaude = New-Object System.Windows.Forms.Label
$lblEnvClaude.Text = "Claude: -"
$lblEnvClaude.Location = New-Object System.Drawing.Point(720, 32)
$lblEnvClaude.Size = New-Object System.Drawing.Size(150, 24)
$lblEnvClaude.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$lblEnvClaude.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$groupInstall.Controls.Add($lblEnvClaude)

$groupLogin = New-Object System.Windows.Forms.GroupBox
$groupLogin.Text = "2) Login + Multi-Account Slots"
$groupLogin.Location = New-Object System.Drawing.Point(20, 230)
$groupLogin.Size = New-Object System.Drawing.Size(900, 170)
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
$cbSlots.Location = New-Object System.Drawing.Point(122, 74)
$cbSlots.Size = New-Object System.Drawing.Size(220, 23)
$groupLogin.Controls.Add($cbSlots)

$btnRefreshSlots = New-Object System.Windows.Forms.Button
$btnRefreshSlots.Text = "Refresh Slots"
$btnRefreshSlots.Location = New-Object System.Drawing.Point(352, 72)
$btnRefreshSlots.Size = New-Object System.Drawing.Size(100, 26)
$groupLogin.Controls.Add($btnRefreshSlots)

$btnActivateSlot = New-Object System.Windows.Forms.Button
$btnActivateSlot.Text = "Activate Slot"
$btnActivateSlot.Location = New-Object System.Drawing.Point(462, 72)
$btnActivateSlot.Size = New-Object System.Drawing.Size(100, 26)
$groupLogin.Controls.Add($btnActivateSlot)

$btnDeleteSlot = New-Object System.Windows.Forms.Button
$btnDeleteSlot.Text = "Delete Slot"
$btnDeleteSlot.Location = New-Object System.Drawing.Point(572, 72)
$btnDeleteSlot.Size = New-Object System.Drawing.Size(100, 26)
$groupLogin.Controls.Add($btnDeleteSlot)

$lblNewSlot = New-Object System.Windows.Forms.Label
$lblNewSlot.Text = "Save Current As:"
$lblNewSlot.Location = New-Object System.Drawing.Point(18, 113)
$lblNewSlot.AutoSize = $true
$groupLogin.Controls.Add($lblNewSlot)

$tbNewSlot = New-Object System.Windows.Forms.TextBox
$tbNewSlot.Location = New-Object System.Drawing.Point(140, 109)
$tbNewSlot.Size = New-Object System.Drawing.Size(200, 23)
$tbNewSlot.Text = "account-1"
$groupLogin.Controls.Add($tbNewSlot)

$btnSaveSlot = New-Object System.Windows.Forms.Button
$btnSaveSlot.Text = "Save Slot"
$btnSaveSlot.Location = New-Object System.Drawing.Point(352, 107)
$btnSaveSlot.Size = New-Object System.Drawing.Size(100, 26)
$groupLogin.Controls.Add($btnSaveSlot)

$lblActiveSlot = New-Object System.Windows.Forms.Label
$lblActiveSlot.Text = "Active Slot: (none)"
$lblActiveSlot.Location = New-Object System.Drawing.Point(462, 112)
$lblActiveSlot.AutoSize = $true
$groupLogin.Controls.Add($lblActiveSlot)

$groupStart = New-Object System.Windows.Forms.GroupBox
$groupStart.Text = "3) Start Runner"
$groupStart.Location = New-Object System.Drawing.Point(20, 410)
$groupStart.Size = New-Object System.Drawing.Size(900, 120)
$form.Controls.Add($groupStart)

$lblServer = New-Object System.Windows.Forms.Label
$lblServer.Text = "Server:"
$lblServer.Location = New-Object System.Drawing.Point(18, 36)
$lblServer.AutoSize = $true
$groupStart.Controls.Add($lblServer)

$tbServer = New-Object System.Windows.Forms.TextBox
$tbServer.Text = "http://127.0.0.1:3200"
$tbServer.Location = New-Object System.Drawing.Point(92, 32)
$tbServer.Size = New-Object System.Drawing.Size(380, 23)
$groupStart.Controls.Add($tbServer)
$tbServer.Text = $tbServer.Text.Trim().Trim('"')

$lblToken = New-Object System.Windows.Forms.Label
$lblToken.Text = "Token:"
$lblToken.Location = New-Object System.Drawing.Point(18, 70)
$lblToken.AutoSize = $true
$groupStart.Controls.Add($lblToken)

$tbToken = New-Object System.Windows.Forms.TextBox
$tbToken.Location = New-Object System.Drawing.Point(92, 66)
$tbToken.Size = New-Object System.Drawing.Size(580, 23)
$groupStart.Controls.Add($tbToken)

$btnStartRunner = New-Object System.Windows.Forms.Button
$btnStartRunner.Text = "Start Runner"
$btnStartRunner.Location = New-Object System.Drawing.Point(690, 62)
$btnStartRunner.Size = New-Object System.Drawing.Size(140, 28)
$groupStart.Controls.Add($btnStartRunner)

$groupQuota = New-Object System.Windows.Forms.GroupBox
$groupQuota.Text = "4) Quota"
$groupQuota.Location = New-Object System.Drawing.Point(20, 540)
$groupQuota.Size = New-Object System.Drawing.Size(900, 130)
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
$btnQuotaRefresh.Location = New-Object System.Drawing.Point(740, 24)
$btnQuotaRefresh.Size = New-Object System.Drawing.Size(130, 26)
$groupQuota.Controls.Add($btnQuotaRefresh)

$lblQuota5h = New-Object System.Windows.Forms.Label
$lblQuota5h.Text = "5h 剩余: -"
$lblQuota5h.Location = New-Object System.Drawing.Point(18, 74)
$lblQuota5h.Size = New-Object System.Drawing.Size(180, 20)
$groupQuota.Controls.Add($lblQuota5h)

$pbQuota5h = New-Object System.Windows.Forms.ProgressBar
$pbQuota5h.Location = New-Object System.Drawing.Point(200, 74)
$pbQuota5h.Size = New-Object System.Drawing.Size(560, 18)
$pbQuota5h.Minimum = 0
$pbQuota5h.Maximum = 100
$pbQuota5h.Value = 0
$groupQuota.Controls.Add($pbQuota5h)

$lblQuota5hPercent = New-Object System.Windows.Forms.Label
$lblQuota5hPercent.Text = "0%"
$lblQuota5hPercent.Location = New-Object System.Drawing.Point(770, 74)
$lblQuota5hPercent.Size = New-Object System.Drawing.Size(100, 20)
$groupQuota.Controls.Add($lblQuota5hPercent)

$lblQuota7d = New-Object System.Windows.Forms.Label
$lblQuota7d.Text = "7d 剩余: -"
$lblQuota7d.Location = New-Object System.Drawing.Point(18, 100)
$lblQuota7d.Size = New-Object System.Drawing.Size(180, 20)
$groupQuota.Controls.Add($lblQuota7d)

$pbQuota7d = New-Object System.Windows.Forms.ProgressBar
$pbQuota7d.Location = New-Object System.Drawing.Point(200, 100)
$pbQuota7d.Size = New-Object System.Drawing.Size(560, 18)
$pbQuota7d.Minimum = 0
$pbQuota7d.Maximum = 100
$pbQuota7d.Value = 0
$groupQuota.Controls.Add($pbQuota7d)

$lblQuota7dPercent = New-Object System.Windows.Forms.Label
$lblQuota7dPercent.Text = "0%"
$lblQuota7dPercent.Location = New-Object System.Drawing.Point(770, 100)
$lblQuota7dPercent.Size = New-Object System.Drawing.Size(100, 20)
$groupQuota.Controls.Add($lblQuota7dPercent)

$groupLog = New-Object System.Windows.Forms.GroupBox
$groupLog.Text = "Logs"
$groupLog.Location = New-Object System.Drawing.Point(20, 680)
$groupLog.Size = New-Object System.Drawing.Size(900, 180)
$form.Controls.Add($groupLog)

$tbLog = New-Object System.Windows.Forms.TextBox
$tbLog.Multiline = $true
$tbLog.ReadOnly = $true
$tbLog.ScrollBars = "Vertical"
$tbLog.Font = New-Object System.Drawing.Font("Consolas", 9)
$tbLog.Location = New-Object System.Drawing.Point(16, 24)
$tbLog.Size = New-Object System.Drawing.Size(868, 140)
$groupLog.Controls.Add($tbLog)

$progressInstall = New-Object System.Windows.Forms.ProgressBar
$progressInstall.Location = New-Object System.Drawing.Point(20, 862)
$progressInstall.Size = New-Object System.Drawing.Size(900, 14)
$progressInstall.Style = [System.Windows.Forms.ProgressBarStyle]::Marquee
$progressInstall.MarqueeAnimationSpeed = 25
$progressInstall.Visible = $false
$form.Controls.Add($progressInstall)

$lblInstallStep = New-Object System.Windows.Forms.Label
$lblInstallStep.Text = ""
$lblInstallStep.AutoSize = $false
$lblInstallStep.Location = New-Object System.Drawing.Point(20, 878)
$lblInstallStep.Size = New-Object System.Drawing.Size(620, 18)
$form.Controls.Add($lblInstallStep)

$lblInstallSpeed = New-Object System.Windows.Forms.Label
$lblInstallSpeed.Text = ""
$lblInstallSpeed.AutoSize = $false
$lblInstallSpeed.Location = New-Object System.Drawing.Point(640, 878)
$lblInstallSpeed.Size = New-Object System.Drawing.Size(280, 18)
$lblInstallSpeed.TextAlign = [System.Drawing.ContentAlignment]::MiddleRight
$form.Controls.Add($lblInstallSpeed)

$status = New-Object System.Windows.Forms.Label
$status.Text = "Ready"
$status.AutoSize = $true
$status.Location = New-Object System.Drawing.Point(22, 900)
$form.Controls.Add($status)

$toolTip = New-Object System.Windows.Forms.ToolTip
$toolTip.AutoPopDelay = 15000
$toolTip.InitialDelay = 300
$toolTip.ReshowDelay = 100

$script:activeJob = $null
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 350
$script:lang = "zh"
$script:activeSlotName = ""
$script:quotaState = $null
$script:envState = @{ node = $false; codex = $false; claude = $false }
$script:envPaths = @{ node = ""; codex = ""; claude = "" }

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
      "env_node" { return "Node" }
      "env_codex" { return "Codex" }
      "env_claude" { return "Claude" }
      "env_ok" { return "Ready" }
      "env_bad" { return "Missing" }
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
      "task_install_env" { return "Installing environment..." }
      "task_verify_env" { return "Verifying environment..." }
      "task_check_login" { return "Checking login status..." }
      "step_prepare" { return "Preparing environment..." }
      "step_download_node" { return "Downloading portable Node.js..." }
      "step_install_codex" { return "Installing Codex CLI..." }
      "step_install_claude" { return "Installing Claude CLI..." }
      "step_install_deps" { return "Installing runner dependencies..." }
      "step_verify" { return "Verifying installation..." }
      "step_done" { return "Setup finished." }
      "speed_unknown" { return "Speed: -" }
      "speed_fmt_kb" { return "Speed: {0:N1} KB/s" }
      "speed_fmt_mb" { return "Speed: {0:N2} MB/s" }
      "msg_busy" { return "A task is already running. Please wait." }
      "msg_select_cli" { return "Select at least one CLI (Codex or Claude)." }
      "msg_slot_required" { return "Please enter a slot name." }
      "msg_no_slot_activate" { return "Please select a slot to activate." }
      "msg_no_slot_delete" { return "Please select a slot to delete." }
      "msg_token_required" { return "Please input RUNNER_TOKEN first." }
      "msg_confirm_delete" { return "Delete slot '" }
      "msg_confirm_delete_tail" { return "' ?" }
      "title_save_slot_failed" { return "Save Slot Failed" }
      "title_activate_slot_failed" { return "Activate Slot Failed" }
      "title_delete_slot_failed" { return "Delete Slot Failed" }
      "log_tip" { return "Tip: install first, login, then save account slot." }
      "log_start" { return "Start: {0}" }
      "log_done_exit" { return "Done (exit code {0})." }
      "log_failed_exit" { return "Failed (exit code {0})." }
      "log_slot_list_refreshed" { return "Slot list refreshed. total={0}, active={1}" }
      "log_slot_refresh_failed" { return "Failed to refresh slots: {0}" }
      "log_quota_refreshed" { return "Quota refreshed: 5h={0}% 7d={1}%" }
      "log_quota_refresh_failed" { return "Quota refresh failed: {0}" }
      "log_saved_slot" { return "Saved slot '{0}' with {1} credential file(s)." }
      "log_warning" { return "Warning: {0}" }
      "log_save_slot_failed" { return "Save slot failed: {0}" }
      "log_activated_slot" { return "Activated slot '{0}', restored {1} file(s)." }
      "log_activate_slot_failed" { return "Activate slot failed: {0}" }
      "log_deleted_slot" { return "Deleted slot '{0}'." }
      "log_slot_not_found" { return "Slot '{0}' not found." }
      "log_delete_slot_failed" { return "Delete slot failed: {0}" }
      "log_opened_terminal" { return "Opened terminal: {0}" }
      "log_opened_runner_shell" { return "Opened runner shell." }
      "log_runner_root" { return "Runner root: {0}" }
      "log_env_summary" { return "Environment: Node={0}, Codex={1}, Claude={2}" }
      "log_install_selection" { return "Install selection => Codex={0}, Claude={1}, CNMirror={2}" }
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
    "env_node" { return "Node" }
    "env_codex" { return "Codex" }
    "env_claude" { return "Claude" }
    "env_ok" { return "可用" }
    "env_bad" { return "缺失" }
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
    "task_install_env" { return "正在安装环境..." }
    "task_verify_env" { return "正在检测环境..." }
    "task_check_login" { return "正在检查登录状态..." }
    "step_prepare" { return "正在准备环境..." }
    "step_download_node" { return "正在下载便携版 Node.js..." }
    "step_install_codex" { return "正在安装 Codex CLI..." }
    "step_install_claude" { return "正在安装 Claude CLI..." }
    "step_install_deps" { return "正在安装 Runner 依赖..." }
    "step_verify" { return "正在校验安装结果..." }
    "step_done" { return "安装完成。" }
    "speed_unknown" { return "速度：-" }
    "speed_fmt_kb" { return "速度：{0:N1} KB/s" }
    "speed_fmt_mb" { return "速度：{0:N2} MB/s" }
    "msg_busy" { return "已有任务在执行，请稍候。" }
    "msg_select_cli" { return "请至少勾选一个 CLI（Codex 或 Claude）。" }
    "msg_slot_required" { return "请输入槽位名称。" }
    "msg_no_slot_activate" { return "请先选择要启用的槽位。" }
    "msg_no_slot_delete" { return "请先选择要删除的槽位。" }
    "msg_token_required" { return "请先填写 RUNNER_TOKEN。" }
    "msg_confirm_delete" { return "确认删除槽位 '" }
    "msg_confirm_delete_tail" { return "' 吗？" }
    "title_save_slot_failed" { return "保存槽位失败" }
    "title_activate_slot_failed" { return "启用槽位失败" }
    "title_delete_slot_failed" { return "删除槽位失败" }
    "log_tip" { return "提示：先安装，再登录，再保存账号槽位。" }
    "log_start" { return "开始：{0}" }
    "log_done_exit" { return "完成（退出码 {0}）。" }
    "log_failed_exit" { return "失败（退出码 {0}）。" }
    "log_slot_list_refreshed" { return "槽位已刷新：总数={0}，当前={1}" }
    "log_slot_refresh_failed" { return "刷新槽位失败：{0}" }
    "log_quota_refreshed" { return "额度已刷新：5h={0}% 7d={1}%" }
    "log_quota_refresh_failed" { return "额度刷新失败：{0}" }
    "log_saved_slot" { return "已保存槽位 '{0}'，写入凭证文件 {1} 个。" }
    "log_warning" { return "警告：{0}" }
    "log_save_slot_failed" { return "保存槽位失败：{0}" }
    "log_activated_slot" { return "已启用槽位 '{0}'，恢复文件 {1} 个。" }
    "log_activate_slot_failed" { return "启用槽位失败：{0}" }
    "log_deleted_slot" { return "已删除槽位 '{0}'。" }
    "log_slot_not_found" { return "槽位 '{0}' 不存在。" }
    "log_delete_slot_failed" { return "删除槽位失败：{0}" }
    "log_opened_terminal" { return "已打开终端：{0}" }
    "log_opened_runner_shell" { return "已打开 Runner 终端。" }
    "log_runner_root" { return "Runner 根目录：{0}" }
    "log_env_summary" { return "环境状态：Node={0}，Codex={1}，Claude={2}" }
    "log_install_selection" { return "安装选择 => Codex={0}，Claude={1}，国内镜像={2}" }
    default { return $k }
  }
}

function LT([string]$key, [object[]]$fmtArgs = @()) {
  $template = [string](T $key)
  if ($fmtArgs -ne $null -and $fmtArgs.Count -gt 0) {
    return [string]::Format($template, [object[]]$fmtArgs)
  }
  return $template
}

function Resolve-StepText([string]$stepId, [string]$fallback = "") {
  switch ($stepId) {
    "prepare" { return T "step_prepare" }
    "download_node" { return T "step_download_node" }
    "install_codex" { return T "step_install_codex" }
    "install_claude" { return T "step_install_claude" }
    "install_deps" { return T "step_install_deps" }
    "verify" { return T "step_verify" }
    "done" { return T "step_done" }
    default {
      if (-not [string]::IsNullOrWhiteSpace($fallback)) { return $fallback }
      return ""
    }
  }
}

function Format-SpeedText([double]$bps) {
  if ($bps -le 0) { return T "speed_unknown" }
  $kb = $bps / 1024.0
  if ($kb -ge 1024.0) {
    return LT "speed_fmt_mb" @($kb / 1024.0)
  }
  return LT "speed_fmt_kb" @($kb)
}

function Try-HandleGuiEvent([string]$line) {
  if ([string]::IsNullOrWhiteSpace($line)) { return $false }
  if (-not $line.StartsWith("__AL_EVENT__:")) { return $false }
  $json = $line.Substring(13)
  if ([string]::IsNullOrWhiteSpace($json)) { return $true }
  try {
    $evt = $json | ConvertFrom-Json -Depth 8
    $etype = [string]$evt.type
    switch ($etype) {
      "step" {
        $stepText = Resolve-StepText ([string]$evt.id) ([string]$evt.message)
        if (-not [string]::IsNullOrWhiteSpace($stepText)) {
          $lblInstallStep.Text = $stepText
          $status.Text = $stepText
          $progressInstall.Style = [System.Windows.Forms.ProgressBarStyle]::Marquee
          $progressInstall.MarqueeAnimationSpeed = 25
        }
      }
      "download" {
        $pct = -1
        $bps = 0.0
        try { $pct = [int]$evt.percent } catch { $pct = -1 }
        try { $bps = [double]$evt.bps } catch { $bps = 0.0 }
        if ($pct -ge 0 -and $pct -le 100) {
          if ($progressInstall.Style -ne [System.Windows.Forms.ProgressBarStyle]::Continuous) {
            $progressInstall.Style = [System.Windows.Forms.ProgressBarStyle]::Continuous
          }
          if ($pct -lt $progressInstall.Minimum) { $pct = $progressInstall.Minimum }
          if ($pct -gt $progressInstall.Maximum) { $pct = $progressInstall.Maximum }
          $progressInstall.Value = $pct
          $lblInstallStep.Text = (Resolve-StepText "download_node" "") + " " + $pct + "%"
          $status.Text = $lblInstallStep.Text
        }
        $lblInstallSpeed.Text = Format-SpeedText $bps
      }
      "done" {
        $lblInstallStep.Text = Resolve-StepText "done" ""
      }
      default {}
    }
  }
  catch {
    Add-Log("Event parse failed: $($_.Exception.Message)")
  }
  return $true
}

function Resolve-ToolPath([string]$tool, [string[]]$candidatePaths) {
  foreach ($p in $candidatePaths) {
    if (-not [string]::IsNullOrWhiteSpace($p) -and (Test-Path $p)) {
      return $p
    }
  }
  try {
    $cmd = Get-Command $tool -ErrorAction Stop
    if ($cmd -and $cmd.Source) { return [string]$cmd.Source }
    if ($cmd -and $cmd.Path) { return [string]$cmd.Path }
  } catch {}
  return ""
}

function Set-EnvBadge([System.Windows.Forms.Label]$label, [string]$nameKey, [bool]$ok, [string]$path = "") {
  $label.Text = (T $nameKey) + ": " + $(if ($ok) { T "env_ok" } else { T "env_bad" })
  if ($ok) {
    $label.BackColor = [System.Drawing.Color]::FromArgb(22, 101, 52)
    $label.ForeColor = [System.Drawing.Color]::White
  } else {
    $label.BackColor = [System.Drawing.Color]::FromArgb(127, 29, 29)
    $label.ForeColor = [System.Drawing.Color]::White
  }
  $tip = if ([string]::IsNullOrWhiteSpace($path)) { T "env_bad" } else { $path }
  $toolTip.SetToolTip($label, $tip)
}

function Update-EnvironmentBadges() {
  Set-EnvBadge $lblEnvNode "env_node" $script:envState.node $script:envPaths.node
  Set-EnvBadge $lblEnvCodex "env_codex" $script:envState.codex $script:envPaths.codex
  Set-EnvBadge $lblEnvClaude "env_claude" $script:envState.claude $script:envPaths.claude
}

function Refresh-EnvironmentIndicators([bool]$writeLog = $false) {
  $script:envPaths.node = Resolve-ToolPath "node" @(
    (Join-Path $runnerRoot ".runtime/node/current/node.exe")
    (Join-Path $runnerRoot ".runtime/node/current/node")
  )
  $script:envPaths.codex = Resolve-ToolPath "codex" @(
    (Join-Path $runnerRoot ".tools/npm-global/codex.cmd")
    (Join-Path $runnerRoot ".tools/npm-global/codex")
    (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin/codex.cmd")
    (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin/codex")
  )
  $script:envPaths.claude = Resolve-ToolPath "claude" @(
    (Join-Path $runnerRoot ".tools/npm-global/claude.cmd")
    (Join-Path $runnerRoot ".tools/npm-global/claude")
    (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin/claude.cmd")
    (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin/claude")
  )
  $script:envState.node = -not [string]::IsNullOrWhiteSpace($script:envPaths.node)
  $script:envState.codex = -not [string]::IsNullOrWhiteSpace($script:envPaths.codex)
  $script:envState.claude = -not [string]::IsNullOrWhiteSpace($script:envPaths.claude)
  Update-EnvironmentBadges
  if ($writeLog) {
    Add-Log (LT "log_env_summary" @(
      $(if ($script:envState.node) { T "env_ok" } else { T "env_bad" }),
      $(if ($script:envState.codex) { T "env_ok" } else { T "env_bad" }),
      $(if ($script:envState.claude) { T "env_ok" } else { T "env_bad" })
    ))
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
  Update-EnvironmentBadges
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
  if ($progressInstall.Visible -and [string]::IsNullOrWhiteSpace($lblInstallSpeed.Text) -eq $false) {
    $lblInstallSpeed.Text = T "speed_unknown"
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
  $progressInstall.Visible = $busy
  if ($busy) {
    $progressInstall.Style = [System.Windows.Forms.ProgressBarStyle]::Marquee
    $progressInstall.MarqueeAnimationSpeed = 25
    $lblInstallStep.Text = $text
    $lblInstallSpeed.Text = T "speed_unknown"
    $status.Text = $text
  } else {
    $progressInstall.Style = [System.Windows.Forms.ProgressBarStyle]::Continuous
    $progressInstall.Value = 0
    $lblInstallStep.Text = ""
    $lblInstallSpeed.Text = ""
    $status.Text = T "ready"
  }
}

function Start-BackgroundScript([string]$displayName, [string]$scriptPath, [string[]]$arguments) {
  if ($script:activeJob -and $script:activeJob.State -eq "Running") {
    [System.Windows.Forms.MessageBox]::Show((T "msg_busy"), (T "ready"))
    return
  }
  Add-Log (LT "log_start" @($displayName))
  Set-Busy $true $displayName

  $script:activeJob = Start-Job -ScriptBlock {
    param($targetScript, $targetArgs, $cwd)
    Set-Location $cwd
    & $targetScript @targetArgs 2>&1 | ForEach-Object { $_.ToString() }
    $code = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
    "__EXIT_CODE__:$code"
  } -ArgumentList $scriptPath, $arguments, $runnerRoot

  $timer.Start()
}

function Invoke-SlotActionJson([string]$action, [string]$slot) {
  $slotArgs = @($action)
  if (-not [string]::IsNullOrWhiteSpace($slot)) {
    $slotArgs += @($slot)
  }
  $raw = & $accountSlotsScript @slotArgs -Json 2>&1 | Out-String
  if ([string]::IsNullOrWhiteSpace($raw)) {
    # Fallback: explicitly invoke by powershell -File to avoid invocation-policy edge cases.
    $fallbackArgs = @("-NoProfile","-ExecutionPolicy","Bypass","-File",$accountSlotsScript) + $slotArgs + @("-Json")
    $raw = & powershell @fallbackArgs 2>&1 | Out-String
  }
  if ([string]::IsNullOrWhiteSpace($raw)) {
    throw "Empty response from account slot script."
  }
  $jsonText = ""
  $trimmedRaw = $raw.Trim()
  if ($trimmedRaw.StartsWith("{") -or $trimmedRaw.StartsWith("[")) {
    $jsonText = $trimmedRaw
  } else {
    $jsonLine = ($raw -split "`r?`n" | Where-Object {
      $t = $_.Trim()
      $t.StartsWith("{") -or $t.StartsWith("[")
    } | Select-Object -Last 1)
    if (-not [string]::IsNullOrWhiteSpace($jsonLine)) {
      $jsonText = $jsonLine.Trim()
    }
  }
  if ([string]::IsNullOrWhiteSpace($jsonText)) {
    throw ("Invalid JSON response: " + $raw)
  }
  try {
    $obj = $jsonText | ConvertFrom-Json
  }
  catch {
    throw ("Invalid JSON response: " + $jsonText)
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

    Add-Log (LT "log_slot_list_refreshed" @($names.Count, $active))
  }
  catch {
    Add-Log (LT "log_slot_refresh_failed" @($_.Exception.Message))
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
      Add-Log (LT "log_quota_refreshed" @($obj.primary.remainingPercent, $obj.secondary.remainingPercent))
    }
    else {
      Add-Log (LT "log_quota_refresh_failed" @($obj.error))
    }
  }
  catch {
    Set-QuotaUnavailable $_.Exception.Message
    Add-Log (LT "log_quota_refresh_failed" @($_.Exception.Message))
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
    if (Try-HandleGuiEvent $s) { continue }
    if ($s.StartsWith("__EXIT_CODE__:")) {
      $exitCode = $s.Substring(12)
      if ($exitCode -eq "0") {
        Add-Log (LT "log_done_exit" @($exitCode))
      } else {
        Add-Log (LT "log_failed_exit" @($exitCode))
      }
    } else {
      Add-Log($s)
    }
  }

  if ($script:activeJob.State -in @("Completed", "Failed", "Stopped")) {
    $tail = Receive-Job -Job $script:activeJob -ErrorAction SilentlyContinue
    foreach ($line in $tail) {
      $s = "$line"
      if (Try-HandleGuiEvent $s) { continue }
      if ($s.StartsWith("__EXIT_CODE__:")) {
        $exitCode = $s.Substring(12)
        if ($exitCode -eq "0") {
          Add-Log (LT "log_done_exit" @($exitCode))
        } else {
          Add-Log (LT "log_failed_exit" @($exitCode))
        }
      } else {
        Add-Log($s)
      }
    }
    Remove-Job -Job $script:activeJob -Force -ErrorAction SilentlyContinue
    $script:activeJob = $null
    $timer.Stop()
    Set-Busy $false
    Refresh-EnvironmentIndicators $false
  }
})

$btnInstall.Add_Click({
  if (-not $cbCodex.Checked -and -not $cbClaude.Checked) {
    [System.Windows.Forms.MessageBox]::Show((T "msg_select_cli"), (T "group_install"))
    return
  }
  $installArgs = @(
    "-InstallCodex:$($cbCodex.Checked.ToString().ToLowerInvariant())",
    "-InstallClaude:$($cbClaude.Checked.ToString().ToLowerInvariant())",
    "-EmitGuiEvents"
  )
  if ($cbMirror.Checked) {
    $installArgs += "-UseChinaMirror"
  }
  Add-Log (LT "log_install_selection" @($cbCodex.Checked, $cbClaude.Checked, $cbMirror.Checked))
  Start-BackgroundScript (T "task_install_env") $setupScript $installArgs
})

$btnVerify.Add_Click({
  Start-BackgroundScript (T "task_verify_env") $verifyScript @()
})

$btnAuthStatus.Add_Click({
  Start-BackgroundScript (T "task_check_login") $authStatusScript @()
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
    Add-Log (LT "log_saved_slot" @($slotName, $res.savedCount))
    if (-not [string]::IsNullOrWhiteSpace([string]$res.warning)) {
      Add-Log (LT "log_warning" @($res.warning))
    }
    Refresh-SlotList $slotName
  }
  catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, (T "title_save_slot_failed"))
    Add-Log (LT "log_save_slot_failed" @($_.Exception.Message))
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
    Add-Log (LT "log_activated_slot" @($slotName, $res.restoredCount))
    Refresh-SlotList $slotName
  }
  catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, (T "title_activate_slot_failed"))
    Add-Log (LT "log_activate_slot_failed" @($_.Exception.Message))
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
      Add-Log (LT "log_deleted_slot" @($slotName))
    } else {
      Add-Log (LT "log_slot_not_found" @($slotName))
    }
    Refresh-SlotList ""
  }
  catch {
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, (T "title_delete_slot_failed"))
    Add-Log (LT "log_delete_slot_failed" @($_.Exception.Message))
  }
})

$btnOpenFolder.Add_Click({
  Start-Process explorer.exe $runnerRoot | Out-Null
})

$btnCodexLogin.Add_Click({
  Start-Process powershell -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File",$shellScript,"-Command","codex login") -WorkingDirectory $runnerRoot | Out-Null
  Add-Log (LT "log_opened_terminal" @("codex login"))
})

$btnClaudeLogin.Add_Click({
  Start-Process powershell -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File",$shellScript,"-Command","claude login") -WorkingDirectory $runnerRoot | Out-Null
  Add-Log (LT "log_opened_terminal" @("claude login"))
})

$btnOpenShell.Add_Click({
  Start-Process powershell -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File",$shellScript) -WorkingDirectory $runnerRoot | Out-Null
  Add-Log (T "log_opened_runner_shell")
})

$btnStartRunner.Add_Click({
  $token = $tbToken.Text.Trim()
  $server = $tbServer.Text.Trim().Trim('"')
  if ([string]::IsNullOrWhiteSpace($token)) {
    [System.Windows.Forms.MessageBox]::Show((T "msg_token_required"), (T "group_start"))
    return
  }
  if ([string]::IsNullOrWhiteSpace($server)) {
    $server = "http://127.0.0.1:3200"
  }
  Start-Process powershell -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-NoExit","-File",$startScript,"-Server",$server,"-Token",$token) -WorkingDirectory $runnerRoot | Out-Null
  Add-Log (LT "log_opened_terminal" @("start runner"))
})

$btnLanguage.Add_Click({
  if ($script:lang -eq "zh") {
    $script:lang = "en"
  } else {
    $script:lang = "zh"
  }
  Apply-Language
  Add-Log (LT "log_env_summary" @(
    $(if ($script:envState.node) { T "env_ok" } else { T "env_bad" }),
    $(if ($script:envState.codex) { T "env_ok" } else { T "env_bad" }),
    $(if ($script:envState.claude) { T "env_ok" } else { T "env_bad" })
  ))
})

$form.Add_FormClosed({
  if ($script:activeJob) {
    Stop-Job -Job $script:activeJob -ErrorAction SilentlyContinue
    Remove-Job -Job $script:activeJob -Force -ErrorAction SilentlyContinue
    $script:activeJob = $null
  }
})

Apply-Language
Refresh-EnvironmentIndicators $false
Add-Log (LT "log_runner_root" @($runnerRoot))
Add-Log((T "log_tip"))
Refresh-SlotList ""
[void]$form.ShowDialog()
