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
      if (-not [string]::IsNullOrWhiteSpace($codexProbe.text)) {
        Write-Host ("detail: " + (Short-Text $codexProbe.text))
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
