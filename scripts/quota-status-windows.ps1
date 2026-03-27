param(
  [switch]$Json
)

$ErrorActionPreference = "Stop"

$script:hasConvertFromJsonDepth = $false
try {
  $cmd = Get-Command ConvertFrom-Json -ErrorAction Stop
  $script:hasConvertFromJsonDepth = $cmd.Parameters.ContainsKey("Depth")
}
catch {
  $script:hasConvertFromJsonDepth = $false
}

function ConvertFrom-JsonCompat([string]$jsonText, [int]$depth = 20) {
  if ($script:hasConvertFromJsonDepth) {
    return $jsonText | ConvertFrom-Json -Depth $depth
  }
  return $jsonText | ConvertFrom-Json
}

function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

function Find-EmailValue($obj) {
  if ($null -eq $obj) { return $null }
  if ($obj -is [string]) { return $null }
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
    return $null
  }
  if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) {
    foreach ($item in $obj) {
      $nested = Find-EmailValue $item
      if (-not [string]::IsNullOrWhiteSpace($nested)) { return $nested }
    }
    return $null
  }
  return $null
}

function Parse-CodexIdentity([string]$homeDir) {
  $identity = ""
  $status = ""
  try {
    if (Get-Command codex -ErrorAction SilentlyContinue) {
      $status = (& codex login status 2>&1 | Out-String).Trim()
    }
  } catch {}

  try {
    $authPath = Join-Path $homeDir ".codex/auth.json"
    if (Test-Path $authPath) {
      $raw = Get-Content -Path $authPath -Raw
      if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $obj = ConvertFrom-JsonCompat $raw 20
        $mail = Find-EmailValue $obj
        if (-not [string]::IsNullOrWhiteSpace($mail)) {
          $identity = $mail
        }
      }
    }
  } catch {}

  if ([string]::IsNullOrWhiteSpace($identity)) {
    $identity = $status
  }
  if ([string]::IsNullOrWhiteSpace($identity)) {
    $identity = "unknown"
  }
  return @{
    identity = $identity
    loginStatus = $status
  }
}

function Invoke-CodexRateLimits() {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "node not found"
  }
  $codexCmd = Get-Command codex -ErrorAction SilentlyContinue
  if (-not $codexCmd) {
    throw "codex not installed"
  }
  $codexPath = ""
  try {
    $codexPath = [string]$codexCmd.Source
    if ([string]::IsNullOrWhiteSpace($codexPath)) { $codexPath = [string]$codexCmd.Path }
  } catch {}
  if ([string]::IsNullOrWhiteSpace($codexPath)) { $codexPath = "codex" }

  $tmpJs = Join-Path ([System.IO.Path]::GetTempPath()) ("agentlab-codex-rate-" + [Guid]::NewGuid().ToString("N") + ".mjs")
  $js = @'
import { spawn } from "node:child_process";

const codexBin = process.env.AGENTLAB_CODEX_PATH || "codex";
const initId = "init-1";
const rateId = "rate-1";
const proc = spawn(codexBin, ["app-server"], { stdio: ["pipe", "pipe", "pipe"] });
let buffer = "";
let done = false;

function finish(obj, code = 0) {
  if (done) return;
  done = true;
  try { console.log(JSON.stringify(obj)); } catch {}
  try { proc.stdin.end(); } catch {}
  setTimeout(() => { try { proc.kill("SIGTERM"); } catch {} }, 50);
  setTimeout(() => process.exit(code), 120);
}

function send(obj) {
  proc.stdin.write(JSON.stringify(obj) + "\n");
}

proc.on("error", (err) => {
  finish({ ok: false, error: String(err?.message || err) }, 1);
});

proc.stderr.on("data", (chunk) => {
  const errText = chunk.toString();
  if (errText.includes("child_process") || errText.includes("EPERM") || errText.includes("EACCES")) {
    finish({ ok: false, error: "Windows permission issue with codex app-server. Try running codex directly in terminal." }, 1);
  }
});

proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  while (true) {
    const idx = buffer.indexOf("\n");
    if (idx < 0) break;
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }

    if (msg?.id === initId && msg?.result) {
      send({ method: "initialized" });
      send({ id: rateId, method: "account/rateLimits/read" });
      continue;
    }
    if (msg?.id === rateId) {
      finish({ ok: true, data: msg?.result || null }, 0);
      return;
    }
  }
});

send({
  id: initId,
  method: "initialize",
  params: {
    clientInfo: {
      name: "agentlab-runner-quota",
      title: "AgentLab Runner Quota",
      version: "0.1.0"
    },
    capabilities: {
      experimentalApi: true
    }
  }
});

setTimeout(() => {
  finish({ ok: false, error: "timeout waiting account/rateLimits/read" }, 1);
}, 15000);
'@

  $oldCodexPathEnv = $env:AGENTLAB_CODEX_PATH
  try {
    Set-Content -Path $tmpJs -Value $js -Encoding UTF8
    $env:AGENTLAB_CODEX_PATH = $codexPath
    $raw = (& node $tmpJs 2>&1 | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($raw)) {
      throw "empty response from codex app-server probe"
    }
    $obj = ConvertFrom-JsonCompat $raw 20
    return $obj
  }
  finally {
    if ($null -eq $oldCodexPathEnv) {
      Remove-Item Env:AGENTLAB_CODEX_PATH -ErrorAction SilentlyContinue
    } else {
      $env:AGENTLAB_CODEX_PATH = $oldCodexPathEnv
    }
    Remove-Item -Path $tmpJs -Force -ErrorAction SilentlyContinue
  }
}

function Map-WindowLabel([int]$mins) {
  if ($mins -eq 300) { return "5h" }
  if ($mins -eq 10080) { return "7d" }
  if ($mins -lt 60) { return "${mins}m" }
  if (($mins % 60) -eq 0) {
    $h = [int]($mins / 60)
    if ($h -lt 24) { return "${h}h" }
  }
  if (($mins % 1440) -eq 0) {
    $d = [int]($mins / 1440)
    return "${d}d"
  }
  return "${mins}m"
}

function To-QuotaItem($bucket) {
  if ($null -eq $bucket) {
    return $null
  }
  $used = 0
  try { $used = [int]$bucket.usedPercent } catch { $used = 0 }
  if ($used -lt 0) { $used = 0 }
  if ($used -gt 100) { $used = 100 }
  $remaining = 100 - $used
  $mins = 0
  try { $mins = [int]$bucket.windowDurationMins } catch {}
  $label = Map-WindowLabel $mins
  $resetEpoch = $null
  try { $resetEpoch = [int64]$bucket.resetsAt } catch {}
  $resetLocal = ""
  if ($null -ne $resetEpoch -and $resetEpoch -gt 0) {
    try {
      $resetLocal = [DateTimeOffset]::FromUnixTimeSeconds($resetEpoch).ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss")
    } catch {}
  }
  return [PSCustomObject]@{
    windowLabel = $label
    windowDurationMins = $mins
    usedPercent = $used
    remainingPercent = $remaining
    resetsAtEpoch = $resetEpoch
    resetsAtLocal = $resetLocal
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$homeDir = [Environment]::GetFolderPath("UserProfile")

Add-PathOnce (Join-Path $runnerRoot ".runtime/node/current")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global")
Add-PathOnce (Join-Path $runnerRoot ".tools/npm-global/node_modules/.bin")

Set-Location $runnerRoot

try {
  $identityInfo = Parse-CodexIdentity $homeDir
  
  # 检查凭证文件是否存在
  $authPath = Join-Path $homeDir ".codex/auth.json"
  $hasCredential = Test-Path $authPath
  
  $probe = Invoke-CodexRateLimits
  if (-not $probe.ok) {
    $errMsg = if ($probe.error) { [string]$probe.error } else { "unknown probe error" }
    if ($hasCredential) {
      $errMsg = "Credential file exists but cannot fetch quota. " + $errMsg + " (Hint: credential may be expired, try re-login)"
    }
    throw $errMsg
  }
  $rl = $probe.data.rateLimits
  if ($null -eq $rl) {
    throw "rateLimits payload missing"
  }

  $primary = To-QuotaItem $rl.primary
  $secondary = To-QuotaItem $rl.secondary
  $planType = ""
  try { $planType = [string]$rl.planType } catch {}
  if ([string]::IsNullOrWhiteSpace($planType)) { $planType = "unknown" }

  $result = [PSCustomObject]@{
    ok = $true
    source = "codex"
    account = [PSCustomObject]@{
      provider = "codex"
      identity = [string]$identityInfo.identity
      loginStatus = [string]$identityInfo.loginStatus
      planType = $planType
    }
    primary = $primary
    secondary = $secondary
    refreshedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  }

  if ($Json.IsPresent) {
    $result | ConvertTo-Json -Depth 8
  }
  else {
    Write-Host ("Account: " + $result.account.identity)
    Write-Host ("Plan: " + $result.account.planType)
    Write-Host ("5h  remaining: " + $primary.remainingPercent + "% (used " + $primary.usedPercent + "%), reset " + $primary.resetsAtLocal)
    Write-Host ("7d  remaining: " + $secondary.remainingPercent + "% (used " + $secondary.usedPercent + "%), reset " + $secondary.resetsAtLocal)
    Write-Host ("Refreshed: " + $result.refreshedAt)
  }
}
catch {
  $msg = $_.Exception.Message
  $errObj = [PSCustomObject]@{
    ok = $false
    source = "codex"
    error = $msg
    refreshedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
  }
  if ($Json.IsPresent) {
    $errObj | ConvertTo-Json -Depth 6
  }
  else {
    Write-Host ("[quota] failed: " + $msg) -ForegroundColor Red
  }
  exit 1
}
