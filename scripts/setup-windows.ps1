param(
  [switch]$InstallCodex,
  [switch]$InstallClaude,
  [switch]$InstallAll,
  [switch]$EmitGuiEvents,
  [switch]$SkipNodeInstall,
  [switch]$SkipRunnerDeps,
  [switch]$UseChinaMirror,
  [string]$NpmRegistry = "",
  [string]$NodeDistBaseUrl = ""
)

$ErrorActionPreference = "Stop"

function Test-Cmd([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function Add-PathOnce([string]$path) {
  if ([string]::IsNullOrWhiteSpace($path)) { return }
  if (-not (Test-Path $path)) { return }
  $parts = $env:PATH -split ";"
  if ($parts -contains $path) { return }
  $env:PATH = "$path;$env:PATH"
}

function Get-NodeMajorVersion() {
  if (-not (Test-Cmd "node")) { return -1 }
  try {
    $major = & node -p "parseInt(process.versions.node.split('.')[0], 10)" 2>$null
    if ([string]::IsNullOrWhiteSpace($major)) { return -1 }
    return [int]$major
  }
  catch {
    return -1
  }
}

function Resolve-RunnerRoot() {
  if (Test-Path "runner/package.json") {
    return (Resolve-Path "runner").Path
  }
  if (Test-Path "package.json") {
    return (Get-Location).Path
  }
  throw "Cannot locate runner root (expected package.json in current dir or ./runner)."
}

function Resolve-NpmCommand([string]$portableNodeBin) {
  if (Test-Cmd "npm") {
    return "npm"
  }
  $portableNpm = Join-Path $portableNodeBin "npm.cmd"
  if (Test-Path $portableNpm) {
    return $portableNpm
  }
  throw "npm not found. Please rerun setup."
}

function Emit-GuiEvent([string]$type, [hashtable]$payload = @{}) {
  if (-not $EmitGuiEvents.IsPresent) { return }
  $obj = [ordered]@{
    type = $type
    ts = (Get-Date).ToString("o")
  }
  foreach ($k in $payload.Keys) {
    $obj[$k] = $payload[$k]
  }
  $json = $obj | ConvertTo-Json -Compress -Depth 8
  Write-Output ("__AL_EVENT__:" + $json)
}

function Emit-Step([string]$id, [string]$message) {
  Emit-GuiEvent -type "step" -payload @{
    id = $id
    message = $message
  }
}

function Download-FileWithProgress([string]$url, [string]$outFile, [string]$eventId) {
  $request = $null
  $response = $null
  $stream = $null
  $file = $null
  try {
    $request = [System.Net.HttpWebRequest]::Create($url)
    $request.Method = "GET"
    $request.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
    $response = $request.GetResponse()
    $stream = $response.GetResponseStream()
    $total = [int64]$response.ContentLength

    $file = [System.IO.File]::Open($outFile, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
    $buffer = New-Object byte[] 65536
    $read = 0
    $written = [int64]0
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $lastEmitMs = -1

    while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
      $file.Write($buffer, 0, $read)
      $written += $read
      $nowMs = [int64]$sw.ElapsedMilliseconds
      if ($lastEmitMs -lt 0 -or ($nowMs - $lastEmitMs) -ge 700) {
        $sec = [Math]::Max($sw.Elapsed.TotalSeconds, 0.001)
        $bps = [double]($written / $sec)
        $percent = -1
        if ($total -gt 0) {
          $percent = [int][Math]::Floor(($written * 100.0) / $total)
          if ($percent -gt 100) { $percent = 100 }
        }
        Emit-GuiEvent -type "download" -payload @{
          id = $eventId
          bytes = $written
          total = $total
          percent = $percent
          bps = [Math]::Round($bps, 2)
        }
        $lastEmitMs = $nowMs
      }
    }

    $finalPercent = if ($total -gt 0) { 100 } else { -1 }
    $finalBps = [double]0
    if ($sw.Elapsed.TotalSeconds -gt 0) {
      $finalBps = [double]($written / [Math]::Max($sw.Elapsed.TotalSeconds, 0.001))
    }
    Emit-GuiEvent -type "download" -payload @{
      id = $eventId
      bytes = $written
      total = $total
      percent = $finalPercent
      bps = [Math]::Round($finalBps, 2)
    }
  }
  finally {
    if ($file) { $file.Dispose() }
    if ($stream) { $stream.Dispose() }
    if ($response) { $response.Dispose() }
  }
}

function Install-PortableNode20([string]$runtimeRoot, [string]$portableNodeBin, [string]$nodeDistBaseUrl) {
  Write-Host "[setup] Installing portable Node.js 20 (no admin required)..."
  Emit-Step "download_node" "Downloading portable Node.js 20..."
  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

  $baseCandidates = @()
  if (-not [string]::IsNullOrWhiteSpace($nodeDistBaseUrl)) {
    $baseCandidates += $nodeDistBaseUrl.TrimEnd("/")
  }
  $baseCandidates += "https://nodejs.org/dist"

  $installed = $false
  foreach ($baseUrl in $baseCandidates) {
    try {
      $shaUrl = "$baseUrl/latest-v20.x/SHASUMS256.txt"
      $shaRaw = (Invoke-WebRequest -UseBasicParsing -Uri $shaUrl).Content
      $zipName = ($shaRaw -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "node-v20\.[0-9]+\.[0-9]+-win-x64\.zip$" } | Select-Object -First 1)
      if ([string]::IsNullOrWhiteSpace($zipName)) {
        throw "Cannot resolve Node.js v20 win-x64 zip from $shaUrl"
      }

      $zipName = ($zipName -split "\s+")[-1]
      $zipUrl = "$baseUrl/latest-v20.x/$zipName"
      $zipPath = Join-Path $runtimeRoot $zipName
      $extractRoot = Join-Path $runtimeRoot "node-extract"

      if (Test-Path $zipPath) { Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue }
      if (Test-Path $extractRoot) { Remove-Item -Path $extractRoot -Recurse -Force -ErrorAction SilentlyContinue }

      Write-Host ("[setup] Downloading Node.js from: " + $zipUrl)
      Download-FileWithProgress -url $zipUrl -outFile $zipPath -eventId "node_zip"
      Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force
      $nodeDir = Get-ChildItem -Path $extractRoot -Directory | Select-Object -First 1
      if ($null -eq $nodeDir) {
        throw "Portable Node archive extracted but folder not found."
      }

      $portableNodeRoot = Split-Path -Path $portableNodeBin -Parent
      New-Item -ItemType Directory -Path $portableNodeRoot -Force | Out-Null
      if (Test-Path $portableNodeBin) {
        Remove-Item -Path $portableNodeBin -Recurse -Force -ErrorAction SilentlyContinue
      }
      Move-Item -Path $nodeDir.FullName -Destination $portableNodeBin -Force

      Remove-Item -Path $zipPath -Force -ErrorAction SilentlyContinue
      Remove-Item -Path $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
      $installed = $true
      break
    }
    catch {
      Write-Host ("[setup] Node download failed from " + $baseUrl + ", trying next source...") -ForegroundColor Yellow
    }
  }
  if (-not $installed) {
    throw "Portable Node install failed from all candidate sources."
  }
}

function Ensure-Node20([string]$runtimeRoot, [string]$portableNodeBin, [string]$nodeDistBaseUrl) {
  Add-PathOnce $portableNodeBin
  $major = Get-NodeMajorVersion
  if ($major -ge 20 -and (Test-Cmd "npm")) {
    return
  }
  if ($SkipNodeInstall.IsPresent) {
    throw "Node.js >= 20/npm not found and -SkipNodeInstall is set."
  }

  if (Test-Cmd "winget") {
    Write-Host "[setup] Installing Node.js LTS via winget..."
    try {
      winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Host
    }
    catch {
      Write-Host "[setup] winget install failed, fallback to portable Node.js..." -ForegroundColor Yellow
    }
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:PATH = ($machinePath + ";" + $userPath + ";" + $env:PATH)
  }

  $major = Get-NodeMajorVersion
  if ($major -ge 20 -and (Test-Cmd "npm")) {
    return
  }

  Install-PortableNode20 -runtimeRoot $runtimeRoot -portableNodeBin $portableNodeBin -nodeDistBaseUrl $nodeDistBaseUrl
  Add-PathOnce $portableNodeBin
  $major = Get-NodeMajorVersion
  if ($major -lt 20 -or -not (Test-Cmd "npm")) {
    throw "Node.js >= 20/npm still unavailable after portable install."
  }
}

$wantCodex = $InstallCodex.IsPresent
$wantClaude = $InstallClaude.IsPresent
if ($InstallAll.IsPresent -or (-not $wantCodex -and -not $wantClaude)) {
  $wantCodex = $true
  $wantClaude = $true
}
if ($UseChinaMirror.IsPresent) {
  if ([string]::IsNullOrWhiteSpace($NpmRegistry)) {
    $NpmRegistry = "https://registry.npmmirror.com"
  }
  if ([string]::IsNullOrWhiteSpace($NodeDistBaseUrl)) {
    $NodeDistBaseUrl = "https://npmmirror.com/mirrors/node"
  }
}

try {
  Emit-Step "prepare" "Preparing environment..."
  $runnerRoot = Resolve-RunnerRoot
  $runtimeRoot = Join-Path $runnerRoot ".runtime"
  $portableNodeBin = Join-Path $runtimeRoot "node/current"
  $toolsRoot = Join-Path $runnerRoot ".tools"
  $npmGlobalPrefix = Join-Path $toolsRoot "npm-global"

  New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $npmGlobalPrefix -Force | Out-Null

  Ensure-Node20 -runtimeRoot $runtimeRoot -portableNodeBin $portableNodeBin -nodeDistBaseUrl $NodeDistBaseUrl

  Add-PathOnce $npmGlobalPrefix
  Add-PathOnce (Join-Path $npmGlobalPrefix "node_modules/.bin")

  $npmCmd = Resolve-NpmCommand -portableNodeBin $portableNodeBin
  $npmCommonArgs = @("--no-audit", "--fund=false", "--progress=false")
  Write-Host ("[setup] Target CLIs: codex=" + $wantCodex + ", claude=" + $wantClaude)
  if (-not [string]::IsNullOrWhiteSpace($NpmRegistry)) {
    Write-Host ("[setup] Using npm registry: " + $NpmRegistry)
  }
  if (-not [string]::IsNullOrWhiteSpace($NodeDistBaseUrl)) {
    Write-Host ("[setup] Using Node dist mirror: " + $NodeDistBaseUrl)
  }

  if ($wantCodex) {
    Emit-Step "install_codex" "Installing Codex CLI..."
    Write-Host "[setup] Installing Codex CLI (@openai/codex) to local runner tools..."
    $codexArgs = @("install", "-g", "--prefix", $npmGlobalPrefix) + $npmCommonArgs
    if (-not [string]::IsNullOrWhiteSpace($NpmRegistry)) {
      $codexArgs += @("--registry", $NpmRegistry)
    }
    $codexArgs += "@openai/codex"
    & $npmCmd @codexArgs
  }

  if ($wantClaude) {
    Emit-Step "install_claude" "Installing Claude Code CLI..."
    Write-Host "[setup] Installing Claude Code CLI (@anthropic-ai/claude-code) to local runner tools..."
    $claudeArgs = @("install", "-g", "--prefix", $npmGlobalPrefix) + $npmCommonArgs
    if (-not [string]::IsNullOrWhiteSpace($NpmRegistry)) {
      $claudeArgs += @("--registry", $NpmRegistry)
    }
    $claudeArgs += "@anthropic-ai/claude-code"
    & $npmCmd @claudeArgs
  }

  if (-not $SkipRunnerDeps.IsPresent) {
    Emit-Step "install_deps" "Installing runner dependencies..."
    Write-Host "[setup] Installing runner dependencies..."
    $depsArgs = @("--prefix", $runnerRoot, "install") + $npmCommonArgs
    if (-not [string]::IsNullOrWhiteSpace($NpmRegistry)) {
      $depsArgs += @("--registry", $NpmRegistry)
    }
    & $npmCmd @depsArgs
  }

  Emit-Step "verify" "Verifying installation..."
  Write-Host ""
  Write-Host "==== Verification ===="
  if (Test-Cmd "node") { node --version }
  if (Test-Cmd "npm") { npm --version }
  if (Test-Cmd "codex") { codex --version } else { Write-Host "codex: not installed" }
  if (Test-Cmd "claude") { claude --version } else { Write-Host "claude: not installed" }

  $startScript = Join-Path $runnerRoot "scripts/start-runner.ps1"
  Write-Host ""
  Write-Host "==== Next steps ===="
  Write-Host "1) Authenticate selected CLI(s): codex login / claude login"
  Write-Host "2) Start runner:"
  Write-Host ('   powershell -ExecutionPolicy Bypass -File "' + $startScript + '" -Server "http://127.0.0.1:3200" -Token "xxxx"')
  Emit-Step "done" "Setup finished."
  Emit-GuiEvent -type "done" -payload @{ ok = $true }
}
catch {
  Write-Host ("[setup] failed: " + $_.Exception.Message) -ForegroundColor Red
  Emit-GuiEvent -type "done" -payload @{ ok = $false; error = $_.Exception.Message }
  exit 1
}
