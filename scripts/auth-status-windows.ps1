function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

function Invoke-Probe([string]$command, [string[]]$arguments) {
  try {
    $output = & $command @arguments 2>&1 | ForEach-Object { $_.ToString() }
    $text = ($output -join "`n").Trim()
    $code = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
    return @{
      ok = ($code -eq 0)
      code = $code
      text = $text
    }
  }
  catch {
    return @{
      ok = $false
      code = -1
      text = $_.Exception.Message
    }
  }
}

function Read-JsonFileSafe([string]$path) {
  try {
    if (-not (Test-Path $path)) { return $null }
    $raw = Get-Content -Path $path -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    return $raw | ConvertFrom-Json
  }
  catch {
    return $null
  }
}

function Find-EmailValue($obj) {
  if ($null -eq $obj) { return "" }
  if ($obj -is [string]) { return "" }
  if ($obj -is [System.Collections.IDictionary]) {
    foreach ($k in $obj.Keys) {
      $keyName = [string]$k
      $v = $obj[$k]
      if ($keyName -ieq "email" -and $v -is [string] -and -not [string]::IsNullOrWhiteSpace($v)) {
        return $v
      }
      $nested = Find-EmailValue $v
      if (-not [string]::IsNullOrWhiteSpace($nested)) { return $nested }
    }
    return ""
  }
  if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) {
    foreach ($item in $obj) {
      $nested = Find-EmailValue $item
      if (-not [string]::IsNullOrWhiteSpace($nested)) { return $nested }
    }
    return ""
  }
  return ""
}

function Has-TokenValue($obj) {
  if ($null -eq $obj) { return $false }
  if ($obj -is [string]) { return $false }
  if ($obj -is [System.Collections.IDictionary]) {
    foreach ($k in $obj.Keys) {
      $keyName = ([string]$k).ToLowerInvariant()
      $v = $obj[$k]
      if (($keyName -match "token" -or $keyName -match "key") -and $v -is [string] -and -not [string]::IsNullOrWhiteSpace($v)) {
        return $true
      }
      if (Has-TokenValue $v) { return $true }
    }
    return $false
  }
  if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) {
    foreach ($item in $obj) {
      if (Has-TokenValue $item) { return $true }
    }
    return $false
  }
  return $false
}

function Inspect-CodexAuth([string]$authPath) {
  $result = @{
    exists = (Test-Path $authPath)
    hasToken = $false
    email = ""
  }
  if (-not $result.exists) { return $result }
  $obj = Read-JsonFileSafe $authPath
  if ($null -eq $obj) { return $result }
  
  # 检查 Codex 特定的 tokens 结构
  if ($obj.tokens -and ($obj.tokens.access_token -or $obj.tokens.id_token)) {
    $result.hasToken = $true
  } else {
    $result.hasToken = Has-TokenValue $obj
  }
  
  $result.email = Find-EmailValue $obj
  return $result
}

function Short-Text([string]$text, [int]$maxLen = 220) {
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }
  $flat = ($text -replace "\r", " " -replace "\n", " ").Trim()
  if ($flat.Length -le $maxLen) { return $flat }
  return $flat.Substring(0, $maxLen) + "..."
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$homeDir = [Environment]::GetFolderPath("UserProfile")
$appData = $env:APPDATA

Add-PathOnce (Join-Path $runnerRoot ".runtime/node/current")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin")

Set-Location $runnerRoot

Write-Host "Runner root: $runnerRoot"
Write-Host "User profile: $homeDir"
Write-Host ""

Write-Host "==== Codex Login Status ===="
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  Write-Host "codex: not installed"
}
else {
  $codexVersion = Invoke-Probe "codex" @("--version")
  Write-Host ("version: " + (Short-Text $codexVersion.text))
  $codexAuthPath = Join-Path $homeDir ".codex/auth.json"
  $codexAuth = Inspect-CodexAuth $codexAuthPath

  # 优先检查凭证文件，避免 GUI 环境中的 stdin 错误
  if ($codexAuth.exists -and $codexAuth.hasToken) {
    Write-Host "status: logged in (credential file verified)"
    if (-not [string]::IsNullOrWhiteSpace($codexAuth.email)) {
      Write-Host ("account: " + $codexAuth.email)
    }
    # 尝试获取更多信息，但不依赖其结果
    $codexProbe = Invoke-Probe "codex" @("whoami")
    if ($codexProbe.ok -and -not [string]::IsNullOrWhiteSpace($codexProbe.text)) {
      Write-Host ("detail: " + (Short-Text $codexProbe.text))
    }
  }
  else {
    # 凭证文件不存在或无效，尝试命令行探测
    $codexProbe = Invoke-Probe "codex" @("whoami")
    if ($codexProbe.ok -and -not [string]::IsNullOrWhiteSpace($codexProbe.text)) {
      Write-Host "status: logged in (probe: codex whoami)"
      Write-Host ("detail: " + (Short-Text $codexProbe.text))
    }
    else {
      $fallback = Invoke-Probe "codex" @("auth", "status")
      if ($fallback.ok -and -not [string]::IsNullOrWhiteSpace($fallback.text)) {
        Write-Host "status: maybe logged in (probe: codex auth status)"
        Write-Host ("detail: " + (Short-Text $fallback.text))
      }
      else {
        $msg = ($codexProbe.text + " " + $fallback.text).ToLowerInvariant()
        if ($msg.Contains("login") -or $msg.Contains("not") -or $msg.Contains("unauth")) {
          Write-Host "status: not logged in (please run: codex login)"
        }
        else {
          Write-Host "status: unknown (run codex login to ensure auth)"
        }
        Write-Host ("detail: " + (Short-Text ($codexProbe.text + " " + $fallback.text)))
      }
    }
  }

  $codexAuthCandidates = @(
    (Join-Path $homeDir ".codex/auth.json"),
    (Join-Path $homeDir ".codex/config.json"),
    (Join-Path $appData "codex/auth.json")
  )
  $codexFound = $codexAuthCandidates | Where-Object { Test-Path $_ }
  if ($codexFound.Count -gt 0) {
    Write-Host "credential files:"
    $codexFound | ForEach-Object { Write-Host ("  - " + $_) }
  }
  else {
    Write-Host "credential files: not found in common locations"
  }
}

Write-Host ""
Write-Host "==== Claude Login Status ===="
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Write-Host "claude: not installed"
}
else {
  $claudeVersion = Invoke-Probe "claude" @("--version")
  Write-Host ("version: " + (Short-Text $claudeVersion.text))

  $claudeProbe = Invoke-Probe "claude" @("whoami")
  if ($claudeProbe.ok -and -not [string]::IsNullOrWhiteSpace($claudeProbe.text)) {
    Write-Host "status: logged in (probe: claude whoami)"
    Write-Host ("detail: " + (Short-Text $claudeProbe.text))
  }
  else {
    $fallback = Invoke-Probe "claude" @("auth", "status")
    if ($fallback.ok -and -not [string]::IsNullOrWhiteSpace($fallback.text)) {
      Write-Host "status: maybe logged in (probe: claude auth status)"
      Write-Host ("detail: " + (Short-Text $fallback.text))
    }
    else {
      $msg = ($claudeProbe.text + " " + $fallback.text).ToLowerInvariant()
      if ($msg.Contains("login") -or $msg.Contains("not") -or $msg.Contains("unauth")) {
        Write-Host "status: not logged in (please run: claude login)"
      }
      else {
        Write-Host "status: unknown (run claude login to ensure auth)"
      }
      if (-not [string]::IsNullOrWhiteSpace($claudeProbe.text)) {
        Write-Host ("detail: " + (Short-Text $claudeProbe.text))
      }
    }
  }

  $claudeAuthCandidates = @(
    (Join-Path $homeDir ".claude.json"),
    (Join-Path $homeDir ".claude/config.json"),
    (Join-Path $homeDir ".claude/credentials.json"),
    (Join-Path $appData "Claude/credentials.json")
  )
  $claudeFound = $claudeAuthCandidates | Where-Object { Test-Path $_ }
  if ($claudeFound.Count -gt 0) {
    Write-Host "credential files:"
    $claudeFound | ForEach-Object { Write-Host ("  - " + $_) }
  }
  else {
    Write-Host "credential files: not found in common locations"
  }
}
