param(
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
  $script:PSNativeCommandUseErrorActionPreference = $false
}

function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

function Emit-Event([string]$type, [hashtable]$payload = @{}) {
  $obj = [ordered]@{
    type = $type
    ts = (Get-Date).ToString("o")
  }
  foreach ($k in $payload.Keys) {
    $obj[$k] = $payload[$k]
  }
  Write-Output ("__AL_EVENT__:" + ($obj | ConvertTo-Json -Compress -Depth 6))
}

function Strip-Ansi([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }
  $t = $text
  $t = [regex]::Replace($t, '\x1B\[[0-9;?]*[ -/]*[@-~]', '')
  $t = [regex]::Replace($t, '\x1B\][^\a]*(\a|\x1B\\)', '')
  return $t
}

function Try-ExtractUrl([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }
  try {
    $urlMatches = [regex]::Matches($text, 'https?://[^\s"''<>]+')
    if ($urlMatches.Count -le 0) { return "" }
    $picked = ""
    foreach ($m in $urlMatches) {
      $candidate = [string]$m.Value
      if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
      $candidate = $candidate.TrimEnd(".", ",", ";", ")", "]")
      if ($candidate -match 'auth\.openai\.com') { return $candidate }
      if ([string]::IsNullOrWhiteSpace($picked)) { $picked = $candidate }
    }
    return $picked
  } catch {
    return ""
  }
}

function Try-ExtractCode([string]$text) {
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }
  try {
    $codeMatch = [regex]::Match($text, '\b[A-Z0-9]{4}-[A-Z0-9]{4,}\b')
    if ($codeMatch.Success) { return $codeMatch.Value }
  } catch {}
  return ""
}

function Try-OpenBrowser([string]$targetUrl) {
  if ([string]::IsNullOrWhiteSpace($targetUrl)) { return $false }
  try {
    Start-Process -FilePath $targetUrl | Out-Null
    Write-Host ("[login] Browser opened: " + $targetUrl)
    return $true
  } catch {
    try {
      Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "start", "", $targetUrl) | Out-Null
      Write-Host ("[login] Browser opened via cmd start: " + $targetUrl)
      return $true
    } catch {
      Write-Host ("[login] Cannot open browser automatically: " + $_.Exception.Message) -ForegroundColor Yellow
      return $false
    }
  }
}

function Emit-AuthUpdate([switch]$Force) {
  $resolvedUrl = if ([string]::IsNullOrWhiteSpace($script:url)) { $script:fallbackUrl } else { $script:url }
  $changed = $false

  if (-not $script:urlAnnounced -and -not [string]::IsNullOrWhiteSpace($resolvedUrl)) {
    if ($script:OpenBrowser.IsPresent -and -not $script:browserTried) {
      $script:browserOpened = Try-OpenBrowser $resolvedUrl
      $script:browserTried = $true
    }
    Write-Output ("[login] Open this URL manually if browser did not open: " + $resolvedUrl)
    $script:urlAnnounced = $true
    $changed = $true
  }

  if (-not $script:codeAnnounced -and -not [string]::IsNullOrWhiteSpace($script:code)) {
    try {
      Set-Clipboard -Value $script:code
      Write-Output ("[login] Device code copied: " + $script:code)
    } catch {
      Write-Output ("[login] Device code: " + $script:code)
    }
    $script:codeAnnounced = $true
    $changed = $true
  }

  if ($Force.IsPresent -or $changed) {
    Emit-Event -type "codex_device_auth" -payload @{
      url = $resolvedUrl
      code = $script:code
      browserOpened = $script:browserOpened
    }
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir

Add-PathOnce (Join-Path $runnerRoot ".runtime/node/current")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin")

Set-Location $runnerRoot

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  Write-Host "[login] codex not found, please run install first." -ForegroundColor Red
  exit 1
}

Write-Host "[login] Starting Codex device auth..."

$rawLines = New-Object System.Collections.Generic.List[string]
$script:url = ""
$script:code = ""
$script:browserOpened = $false
$script:browserTried = $false
$script:urlAnnounced = $false
$script:codeAnnounced = $false
$script:fallbackUrl = "https://auth.openai.com/codex/device"

try {
  & codex login --device-auth 2>&1 | ForEach-Object {
    $line = $_.ToString()
    if ([string]::IsNullOrWhiteSpace($line)) { return }

    $rawLines.Add($line) | Out-Null
    Write-Output $line

    $cleanLine = Strip-Ansi $line

    if ([string]::IsNullOrWhiteSpace($script:url)) {
      $u = Try-ExtractUrl $cleanLine
      if (-not [string]::IsNullOrWhiteSpace($u)) { $script:url = $u }
    }

    if ([string]::IsNullOrWhiteSpace($script:code)) {
      $c = Try-ExtractCode $cleanLine
      if (-not [string]::IsNullOrWhiteSpace($c)) { $script:code = $c }
    }

    Emit-AuthUpdate
  }
} catch {
  $em = ""
  try { $em = [string]$_.Exception.Message } catch {}
  $normalized = $em.ToLowerInvariant()
  if ($normalized.Contains("successfully logged in") -or $normalized.Contains("already logged in")) {
    Write-Output ("[login] codex returned completion message: " + $em)
  } else {
    Write-Host ("[login] codex login failed: " + $em) -ForegroundColor Red
    exit 1
  }
}

$allText = Strip-Ansi ($rawLines -join "`n")
if ([string]::IsNullOrWhiteSpace($script:url)) {
  $script:url = Try-ExtractUrl $allText
}
if ([string]::IsNullOrWhiteSpace($script:code)) {
  $script:code = Try-ExtractCode $allText
}
Emit-AuthUpdate -Force

if ([string]::IsNullOrWhiteSpace($script:url)) {
  $script:url = $script:fallbackUrl
}

Write-Output ("[login] Login command exited. URL: " + $script:url)
Write-Host "[login] After confirming in browser, click 'Check Login Status' in GUI."
