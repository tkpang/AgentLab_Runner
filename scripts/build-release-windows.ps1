param(
  [string]$Version = "",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerRoot = Split-Path -Parent $scriptDir
$guiDir = Join-Path $runnerRoot "gui"
$distDir = Join-Path $guiDir "dist"
$unpackedDir = Join-Path $distDir "win-unpacked"

if (-not $SkipBuild) {
  Push-Location $guiDir
  try {
    npm ci
    npm run build:win:dir
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $unpackedDir)) {
  throw "Build output not found: $unpackedDir"
}

if ([string]::IsNullOrWhiteSpace($Version)) {
  $pkg = Get-Content (Join-Path $guiDir "package.json") -Raw | ConvertFrom-Json
  $Version = [string]$pkg.version
}

$bundleName = "AgentLab-Runner-$Version-windows-x64"
$stagingDir = Join-Path $distDir $bundleName
$zipPath = Join-Path $distDir "$bundleName.zip"

if (Test-Path $stagingDir) {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}
if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stagingDir | Out-Null
Copy-Item -Path (Join-Path $unpackedDir "*") -Destination $stagingDir -Recurse -Force
Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "[release] Windows bundle created:"
Write-Host "  $zipPath"
