param(
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

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
  # Remove common ANSI escape/control sequences that can break URL parsing.
  $t = $text
  $t = [regex]::Replace($t, '\x1B\[[0-9;?]*[ -/]*[@-~]', '')
  $t = [regex]::Replace($t, '\x1B\][^\a]*(\a|\x1B\\)', '')
  return $t
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
$rawLines = @()
try {
  $rawLines = (& codex login --device-auth 2>&1 | ForEach-Object { $_.ToString() })
} catch {
  Write-Host ("[login] codex login failed: " + $_.Exception.Message) -ForegroundColor Red
  exit 1
}

if ($null -eq $rawLines) { $rawLines = @() }
foreach ($line in $rawLines) {
  if (-not [string]::IsNullOrWhiteSpace($line)) {
    Write-Output $line
  }
}

$allText = ($rawLines -join "`n")
$cleanText = Strip-Ansi $allText
$url = ""
$code = ""
$browserOpened = $false
$fallbackUrl = "https://auth.openai.com/codex/device"

try {
  $urlMatches = [regex]::Matches($cleanText, 'https?://[^\s"''<>]+')
  if ($urlMatches.Count -gt 0) {
    foreach ($m in $urlMatches) {
      $candidate = [string]$m.Value
      if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
      $candidate = $candidate.TrimEnd(".", ",", ";", ")", "]")
      if ($candidate -match 'auth\.openai\.com') {
        $url = $candidate
        break
      }
      if ([string]::IsNullOrWhiteSpace($url)) {
        $url = $candidate
      }
    }
  }
} catch {}

try {
  $codeMatch = [regex]::Match($cleanText, '\b[A-Z0-9]{4}-[A-Z0-9]{4,}\b')
  if ($codeMatch.Success) {
    $code = $codeMatch.Value
  }
} catch {}

if ([string]::IsNullOrWhiteSpace($url)) {
  $url = $fallbackUrl
}

if ($OpenBrowser.IsPresent -and -not [string]::IsNullOrWhiteSpace($url)) {
  try {
    Start-Process -FilePath $url | Out-Null
    $browserOpened = $true
    Write-Host ("[login] Browser opened: " + $url)
  } catch {
    try {
      Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "start", "", $url) | Out-Null
      $browserOpened = $true
      Write-Host ("[login] Browser opened via cmd start: " + $url)
    } catch {
      Write-Host ("[login] Cannot open browser automatically: " + $_.Exception.Message) -ForegroundColor Yellow
    }
  }
}

Write-Output ("[login] Open this URL manually if browser did not open: " + $url)

if (-not [string]::IsNullOrWhiteSpace($code)) {
  try {
    Set-Clipboard -Value $code
    Write-Host ("[login] Device code copied: " + $code)
  } catch {
    Write-Host ("[login] Device code: " + $code)
  }
}

Emit-Event -type "codex_device_auth" -payload @{
  url = $url
  code = $code
  browserOpened = $browserOpened
}

Write-Host "[login] After confirming in browser, click 'Check Login Status' in GUI."
