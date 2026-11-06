Add-Type -AssemblyName System.Drawing

$dir = Join-Path $PSScriptRoot '..\apps\desktop\src-tauri\icons'
$dir = [System.IO.Path]::GetFullPath($dir)
New-Item -ItemType Directory -Force -Path $dir | Out-Null

function New-DaylineIcon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $pathObj = New-Object System.Drawing.Drawing2D.GraphicsPath
  $radius = [Math]::Max(8, [int]($size * 0.22))
  $d = $radius * 2
  $pathObj.AddArc(0, 0, $d, $d, 180, 90)
  $pathObj.AddArc($size - $d, 0, $d, $d, 270, 90)
  $pathObj.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $pathObj.AddArc(0, $size - $d, $d, $d, 90, 90)
  $pathObj.CloseFigure()

  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 67, 119, 255),
    [System.Drawing.Color]::FromArgb(255, 35, 70, 190),
    45
  )
  $g.FillPath($bg, $pathObj)

  $fontSize = [Math]::Max(12, [int]($size * 0.56))
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textRect = New-Object System.Drawing.RectangleF(0, -1, $size, $size)
  $g.DrawString('D', $font, [System.Drawing.Brushes]::White, $textRect, $format)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $font.Dispose()
  $bg.Dispose()
  $pathObj.Dispose()
}

New-DaylineIcon 32 (Join-Path $dir '32x32.png')
New-DaylineIcon 128 (Join-Path $dir '128x128.png')
New-DaylineIcon 256 (Join-Path $dir '128x128@2x.png')
New-DaylineIcon 256 (Join-Path $dir 'icon-256.png')

Write-Host "Icons written to $dir"
