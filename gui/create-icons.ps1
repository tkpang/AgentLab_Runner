# Create simple placeholder icons for the app
# This creates basic colored squares as icons

$iconDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Create a simple 256x256 icon using PowerShell
Add-Type -AssemblyName System.Drawing

# Main app icon (blue gradient)
$bitmap = New-Object System.Drawing.Bitmap(256, 256)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(256, 256)),
    [System.Drawing.Color]::FromArgb(59, 130, 246),
    [System.Drawing.Color]::FromArgb(99, 102, 241)
)

$graphics.FillRectangle($brush, 0, 0, 256, 256)

# Add rounded corners
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$rect = New-Object System.Drawing.Rectangle(20, 20, 216, 216)
$radius = 40
$path.AddArc($rect.X, $rect.Y, $radius, $radius, 180, 90)
$path.AddArc($rect.Right - $radius, $rect.Y, $radius, $radius, 270, 90)
$path.AddArc($rect.Right - $radius, $rect.Bottom - $radius, $radius, $radius, 0, 90)
$path.AddArc($rect.X, $rect.Bottom - $radius, $radius, $radius, 90, 90)
$path.CloseFigure()

$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.FillPath($whiteBrush, $path)

# Save main icon
$iconPath = Join-Path $iconDir "icon.png"
$bitmap.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Create tray icon (smaller, 64x64)
$trayBitmap = New-Object System.Drawing.Bitmap(64, 64)
$trayGraphics = [System.Drawing.Graphics]::FromImage($trayBitmap)
$trayGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$trayBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(64, 64)),
    [System.Drawing.Color]::FromArgb(59, 130, 246),
    [System.Drawing.Color]::FromArgb(99, 102, 241)
)

$trayGraphics.FillEllipse($trayBrush, 8, 8, 48, 48)

$trayIconPath = Join-Path $iconDir "tray-icon.png"
$trayBitmap.Save($trayIconPath, [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()
$trayGraphics.Dispose()
$trayBitmap.Dispose()

Write-Host "Icons created successfully!" -ForegroundColor Green
Write-Host "  - icon.png (main app icon)"
Write-Host "  - tray-icon.png (system tray icon)"
