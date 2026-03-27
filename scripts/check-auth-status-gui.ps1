# GUI-friendly auth status checker
# Returns JSON with separate Codex and Claude status

param(
  [switch]$Json
)

$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$homeDir = [Environment]::GetFolderPath("UserProfile")
$appData = $env:APPDATA

function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

Add-PathOnce (Join-Path $runnerRoot ".runtime/node/current")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin")

Set-Location $runnerRoot

function Read-JsonFileSafe([string]$path) {
  try {
    if (-not (Test-Path $path)) { return $null }
    $raw = Get-Content -Path $path -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    return $raw | ConvertFrom-Json
  }
  catch {
    return $null
  }
}

function Check-CodexStatus() {
  $result = @{
    installed = $false
    loggedIn = $false
    status = "not installed"
    email = ""
    credentialFile = ""
  }
  
  $codexCmd = Get-Command codex -ErrorAction SilentlyContinue
  if (-not $codexCmd) {
    return $result
  }
  
  $result.installed = $true
  
  $authPath = Join-Path $homeDir ".codex\auth.json"
  $result.credentialFile = $authPath
  
  if (Test-Path $authPath) {
    $authObj = Read-JsonFileSafe $authPath
    if ($authObj -and $authObj.tokens) {
      if ($authObj.tokens.access_token -or $authObj.tokens.id_token) {
        $result.loggedIn = $true
        $result.status = "logged in"
        
        try {
          if ($authObj.tokens.id_token) {
            $tokenParts = $authObj.tokens.id_token -split '\.'
            if ($tokenParts.Length -ge 2) {
              $payload = $tokenParts[1]
              $padding = "=" * ((4 - ($payload.Length % 4)) % 4)
              $base64 = $payload.Replace('-', '+').Replace('_', '/') + $padding
              try {
                $jsonPayload = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($base64))
                $payloadObj = $jsonPayload | ConvertFrom-Json
                if ($payloadObj.email) {
                  $result.email = $payloadObj.email
                }
              } catch {}
            }
          }
        } catch {}
        
        return $result
      }
    }
  }
  
  $result.status = "not logged in"
  return $result
}

function Check-ClaudeStatus() {
  $result = @{
    installed = $false
    loggedIn = $false
    status = "not installed"
    email = ""
    credentialFile = ""
  }
  
  $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
  if (-not $claudeCmd) {
    return $result
  }
  
  $result.installed = $true
  
  $authPaths = @(
    (Join-Path $homeDir ".claude.json"),
    (Join-Path $homeDir ".claude\config.json"),
    (Join-Path $homeDir ".claude\credentials.json")
  )
  
  foreach ($authPath in $authPaths) {
    if (Test-Path $authPath) {
      $result.credentialFile = $authPath
      $authObj = Read-JsonFileSafe $authPath
      if ($authObj) {
        $hasToken = $false
        if ($authObj.sessionKey -or $authObj.token -or $authObj.apiKey) {
          $hasToken = $true
        }
        if (-not $hasToken) {
          $jsonStr = $authObj | ConvertTo-Json -Depth 10
          if ($jsonStr -match '"(token|key|session)"') {
            $hasToken = $true
          }
        }
        
        if ($hasToken) {
          $result.loggedIn = $true
          $result.status = "logged in"
          
          if ($authObj.email) {
            $result.email = $authObj.email
          } elseif ($authObj.user -and $authObj.user.email) {
            $result.email = $authObj.user.email
          }
          
          return $result
        }
      }
    }
  }
  
  $result.status = "not logged in"
  return $result
}

$codexStatus = Check-CodexStatus
$claudeStatus = Check-ClaudeStatus

$output = @{
  ok = $true
  codex = $codexStatus
  claude = $claudeStatus
  timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

if ($Json.IsPresent) {
  $output | ConvertTo-Json -Depth 10
} else {
  Write-Host "==== Codex Status ===="
  Write-Host ("Status: " + $codexStatus.status)
  if ($codexStatus.email) {
    Write-Host ("Account: " + $codexStatus.email)
  }
  if ($codexStatus.credentialFile) {
    Write-Host ("Credential: " + $codexStatus.credentialFile)
  }
  Write-Host ""
  
  Write-Host "==== Claude Status ===="
  Write-Host ("Status: " + $claudeStatus.status)
  if ($claudeStatus.email) {
    Write-Host ("Account: " + $claudeStatus.email)
  }
  if ($claudeStatus.credentialFile) {
    Write-Host ("Credential: " + $claudeStatus.credentialFile)
  }
}
