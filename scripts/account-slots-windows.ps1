param(
  [string]$Action = "list",
  [string]$Slot = "",
  [switch]$Json
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$accountsRoot = Join-Path $runnerRoot ".accounts/windows"
$activeSlotFile = Join-Path $accountsRoot ".active-slot"
$homeDir = [Environment]::GetFolderPath("UserProfile")
$appData = $env:APPDATA

$knownTargets = @(
  @{ tool = "codex"; key = "codex_auth"; path = (Join-Path $homeDir ".codex/auth.json") },
  @{ tool = "codex"; key = "codex_config"; path = (Join-Path $homeDir ".codex/config.json") },
  @{ tool = "claude"; key = "claude_home_json"; path = (Join-Path $homeDir ".claude.json") },
  @{ tool = "claude"; key = "claude_config"; path = (Join-Path $homeDir ".claude/config.json") },
  @{ tool = "claude"; key = "claude_credentials"; path = (Join-Path $homeDir ".claude/credentials.json") },
  @{ tool = "claude"; key = "claude_appdata_credentials"; path = (Join-Path $appData "Claude/credentials.json") }
)

function Normalize-SlotName([string]$name) {
  if ($null -eq $name) {
    $v = ""
  }
  else {
    $v = $name.Trim()
  }
  if ([string]::IsNullOrWhiteSpace($v)) {
    throw "Slot name is required."
  }
  if ($v -match '[\\/:*?"<>|]') {
    throw "Slot name contains invalid characters: \\/:*?""<>|"
  }
  return $v
}

function Normalize-Action([string]$actionName) {
  if ($null -eq $actionName) { return "list" }
  $v = $actionName.Trim().ToLowerInvariant()
  if ([string]::IsNullOrWhiteSpace($v)) { return "list" }
  switch ($v) {
    "list" { return "list" }
    "save" { return "save" }
    "activate" { return "activate" }
    "delete" { return "delete" }
    "show-active" { return "show-active" }
    default {
      throw "Unsupported action: $actionName (allowed: list/save/activate/delete/show-active)"
    }
  }
}

function Ensure-Dir([string]$path) {
  New-Item -ItemType Directory -Path $path -Force | Out-Null
}

function Get-ActiveSlot() {
  if (-not (Test-Path $activeSlotFile)) { return "" }
  try {
    return (Get-Content -Path $activeSlotFile -Raw).Trim()
  }
  catch {
    return ""
  }
}

function Set-ActiveSlot([string]$slot) {
  Ensure-Dir $accountsRoot
  Set-Content -Path $activeSlotFile -Value $slot -Encoding UTF8
}

function Clear-ActiveSlot() {
  if (Test-Path $activeSlotFile) {
    Remove-Item -Path $activeSlotFile -Force -ErrorAction SilentlyContinue
  }
}

function To-RelativeStorePath([string]$absPath) {
  if ([string]::IsNullOrWhiteSpace($absPath)) { return "" }
  if ($absPath.StartsWith($homeDir, [StringComparison]::OrdinalIgnoreCase)) {
    $tail = $absPath.Substring($homeDir.Length).TrimStart('\', '/')
    return Join-Path "user_profile" $tail
  }
  if (-not [string]::IsNullOrWhiteSpace($appData) -and $absPath.StartsWith($appData, [StringComparison]::OrdinalIgnoreCase)) {
    $tail = $absPath.Substring($appData.Length).TrimStart('\', '/')
    return Join-Path "appdata" $tail
  }
  $safe = ($absPath -replace '[:\\/\s]', '_')
  return Join-Path "other" $safe
}

function To-AbsoluteTargetPath([string]$relativePath) {
  $parts = $relativePath -split '[\\/]'
  if ($parts.Length -lt 2) {
    throw "Invalid stored path: $relativePath"
  }
  $scope = $parts[0]
  $rest = ($parts[1..($parts.Length - 1)] -join [IO.Path]::DirectorySeparatorChar)
  switch ($scope) {
    "user_profile" { return Join-Path $homeDir $rest }
    "appdata" {
      if ([string]::IsNullOrWhiteSpace($appData)) { throw "APPDATA is empty." }
      return Join-Path $appData $rest
    }
    default { throw "Unsupported stored scope: $scope" }
  }
}

function Write-Result([object]$obj) {
  if ($Json.IsPresent) {
    $obj | ConvertTo-Json -Depth 8
    return
  }
  $obj | Format-List | Out-String | Write-Output
}

function Read-Meta([string]$slotDir) {
  $metaPath = Join-Path $slotDir "meta.json"
  if (-not (Test-Path $metaPath)) { return $null }
  try {
    return Get-Content -Path $metaPath -Raw | ConvertFrom-Json
  }
  catch {
    return $null
  }
}

function Save-Slot([string]$slotName) {
  $slotDir = Join-Path $accountsRoot $slotName
  $filesDir = Join-Path $slotDir "files"
  Ensure-Dir $filesDir
  if (Test-Path $filesDir) {
    Remove-Item -Path $filesDir -Recurse -Force -ErrorAction SilentlyContinue
  }
  Ensure-Dir $filesDir

  $savedFiles = @()
  foreach ($target in $knownTargets) {
    $targetPath = $target.path
    if ([string]::IsNullOrWhiteSpace($targetPath)) { continue }
    if (-not (Test-Path $targetPath)) { continue }

    $relStorePath = To-RelativeStorePath $targetPath
    $dstPath = Join-Path $filesDir $relStorePath
    $dstDir = Split-Path -Parent $dstPath
    Ensure-Dir $dstDir
    Copy-Item -Path $targetPath -Destination $dstPath -Force

    $size = 0
    try { $size = (Get-Item -LiteralPath $targetPath).Length } catch {}
    $savedFiles += [PSCustomObject]@{
      tool = $target.tool
      key = $target.key
      source = $targetPath
      storedAs = $relStorePath
      bytes = $size
    }
  }

  $meta = [PSCustomObject]@{
    slot = $slotName
    updatedAt = (Get-Date).ToString("o")
    savedCount = $savedFiles.Count
    files = $savedFiles
  }
  Ensure-Dir $slotDir
  ($meta | ConvertTo-Json -Depth 8) | Set-Content -Path (Join-Path $slotDir "meta.json") -Encoding UTF8

  return [PSCustomObject]@{
    ok = $true
    action = "save"
    slot = $slotName
    savedCount = $savedFiles.Count
    slotDir = $slotDir
    warning = if ($savedFiles.Count -eq 0) { "No known credential files found. Please login first." } else { "" }
  }
}

function Activate-Slot([string]$slotName) {
  $slotDir = Join-Path $accountsRoot $slotName
  if (-not (Test-Path $slotDir)) {
    throw "Slot not found: $slotName"
  }
  $filesDir = Join-Path $slotDir "files"
  if (-not (Test-Path $filesDir)) {
    throw "Slot has no saved files: $slotName"
  }

  foreach ($target in $knownTargets) {
    if ([string]::IsNullOrWhiteSpace($target.path)) { continue }
    if (Test-Path $target.path) {
      Remove-Item -Path $target.path -Force -ErrorAction SilentlyContinue
    }
  }

  $restored = @()
  $storedFiles = Get-ChildItem -Path $filesDir -Recurse -File -ErrorAction SilentlyContinue
  foreach ($f in $storedFiles) {
    $rel = $f.FullName.Substring($filesDir.Length).TrimStart('\', '/')
    try {
      $targetPath = To-AbsoluteTargetPath $rel
    }
    catch {
      continue
    }
    $targetDir = Split-Path -Parent $targetPath
    Ensure-Dir $targetDir
    Copy-Item -Path $f.FullName -Destination $targetPath -Force
    $restored += $targetPath
  }

  Set-ActiveSlot $slotName
  return [PSCustomObject]@{
    ok = $true
    action = "activate"
    slot = $slotName
    restoredCount = $restored.Count
    restored = $restored
  }
}

function Delete-Slot([string]$slotName) {
  $slotDir = Join-Path $accountsRoot $slotName
  if (-not (Test-Path $slotDir)) {
    return [PSCustomObject]@{
      ok = $true
      action = "delete"
      slot = $slotName
      deleted = $false
      message = "Slot not found."
    }
  }
  Remove-Item -Path $slotDir -Recurse -Force -ErrorAction SilentlyContinue
  if ((Get-ActiveSlot) -eq $slotName) {
    Clear-ActiveSlot
  }
  return [PSCustomObject]@{
    ok = $true
    action = "delete"
    slot = $slotName
    deleted = $true
  }
}

function List-Slots() {
  Ensure-Dir $accountsRoot
  $active = Get-ActiveSlot
  $slots = @()
  $dirs = Get-ChildItem -Path $accountsRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name
  foreach ($d in $dirs) {
    $meta = Read-Meta $d.FullName
    $savedCount = 0
    $updatedAt = ""
    if ($meta) {
      try { $savedCount = [int]$meta.savedCount } catch { $savedCount = 0 }
      try { $updatedAt = [string]$meta.updatedAt } catch { $updatedAt = "" }
    }
    $slots += [PSCustomObject]@{
      name = $d.Name
      isActive = ($active -eq $d.Name)
      savedCount = $savedCount
      updatedAt = $updatedAt
    }
  }
  return [PSCustomObject]@{
    ok = $true
    action = "list"
    activeSlot = $active
    slots = $slots
    accountsRoot = $accountsRoot
  }
}

try {
  $Action = Normalize-Action $Action
  Ensure-Dir $accountsRoot
  switch ($Action) {
    "list" {
      Write-Result (List-Slots)
    }
    "show-active" {
      Write-Result ([PSCustomObject]@{
        ok = $true
        action = "show-active"
        activeSlot = (Get-ActiveSlot)
      })
    }
    "save" {
      $slotName = Normalize-SlotName $Slot
      Write-Result (Save-Slot $slotName)
    }
    "activate" {
      $slotName = Normalize-SlotName $Slot
      Write-Result (Activate-Slot $slotName)
    }
    "delete" {
      $slotName = Normalize-SlotName $Slot
      Write-Result (Delete-Slot $slotName)
    }
  }
}
catch {
  $errorObj = [PSCustomObject]@{
    ok = $false
    action = $Action
    slot = $Slot
    error = $_.Exception.Message
  }
  if ($Json.IsPresent) {
    $errorObj | ConvertTo-Json -Depth 6
  }
  else {
    Write-Host ("[account-slots] failed: " + $_.Exception.Message) -ForegroundColor Red
  }
  exit 1
}
