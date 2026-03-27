param(
  [string]$Server = "http://127.0.0.1:3200",
  [string]$Token = "",
  [ValidateSet("desktop","web")]
  [string]$GuiMode = "desktop"
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

& (Join-Path $root "stop.ps1")
& (Join-Path $root "start.ps1") -Server $Server -Token $Token -GuiMode $GuiMode
