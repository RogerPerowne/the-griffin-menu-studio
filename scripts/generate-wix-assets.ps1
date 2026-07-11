[CmdletBinding()]
param(
  [string]$Root
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Root)) {
  $Root = Resolve-Path (Join-Path $PSScriptRoot '..')
} else {
  $Root = Resolve-Path $Root
}

Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $Root 'build\installer'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$crestPath = Join-Path $Root 'assets\brands\griffin\crest.png'

function New-Brush([string]$hex) {
  $r = [Convert]::ToInt32($hex.Substring(1, 2), 16)
  $g = [Convert]::ToInt32($hex.Substring(3, 2), 16)
  $b = [Convert]::ToInt32($hex.Substring(5, 2), 16)
  return New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($r, $g, $b))
}

function Draw-ImageContained($graphics, $image, [System.Drawing.RectangleF]$box) {
  $ratio = [Math]::Min($box.Width / $image.Width, $box.Height / $image.Height)
  $w = $image.Width * $ratio
  $h = $image.Height * $ratio
  $x = $box.X + (($box.Width - $w) / 2)
  $y = $box.Y + (($box.Height - $h) / 2)
  $graphics.DrawImage($image, [System.Drawing.RectangleF]::new($x, $y, $w, $h))
}

$cream = New-Brush '#F6F3ED'
$panel = New-Brush '#FFFFFF'
$green = New-Brush '#00403D'
$pink = New-Brush '#FFF4F4'
$ink = New-Brush '#222222'
$muted = New-Brush '#66584A'
$linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(228, 221, 209)), 1

$crest = [System.Drawing.Image]::FromFile($crestPath)

try {
  $dialog = New-Object System.Drawing.Bitmap 493, 312
  $g = [System.Drawing.Graphics]::FromImage($dialog)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::FromArgb(246, 243, 237))
    $g.FillRectangle($green, 0, 0, 164, 312)
    Draw-ImageContained $g $crest ([System.Drawing.RectangleF]::new(52, 42, 60, 60))
    $titleFont = New-Object System.Drawing.Font 'Georgia', 14, ([System.Drawing.FontStyle]::Bold)
    $bodyFont = New-Object System.Drawing.Font 'Segoe UI', 8.5
    try {
      $g.DrawString('Griffin', $titleFont, $pink, 34, 126)
      $g.DrawString('Menu Studio', $titleFont, $pink, 34, 150)
      $g.DrawString('Install, repair or remove the desktop menu studio.', $bodyFont, $pink, [System.Drawing.RectangleF]::new(26, 190, 112, 58))
    } finally {
      $titleFont.Dispose()
      $bodyFont.Dispose()
    }
    $g.FillRectangle($panel, 194, 44, 250, 116)
    $g.DrawRectangle($linePen, 194, 44, 250, 116)
    Draw-ImageContained $g $crest ([System.Drawing.RectangleF]::new(216, 64, 54, 54))
    $lockupFont = New-Object System.Drawing.Font 'Georgia', 19, ([System.Drawing.FontStyle]::Bold)
    $studioFont = New-Object System.Drawing.Font 'Segoe UI', 8
    try {
      $g.DrawString('The Griffin', $lockupFont, $ink, 282, 70)
      $g.DrawString('MENU STUDIO', $studioFont, $muted, 286, 104)
    } finally {
      $lockupFont.Dispose()
      $studioFont.Dispose()
    }
    $smallFont = New-Object System.Drawing.Font 'Segoe UI', 9
    try {
      $g.DrawString('Professional Windows Installer', $smallFont, $muted, 204, 188)
      $g.DrawString('Supports first install, update, repair and uninstall.', $smallFont, $ink, [System.Drawing.RectangleF]::new(204, 212, 230, 52))
    } finally {
      $smallFont.Dispose()
    }
  } finally {
    $g.Dispose()
  }
  $dialog.Save((Join-Path $outDir 'wix-dialog.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)

  $banner = New-Object System.Drawing.Bitmap 493, 58
  $g2 = [System.Drawing.Graphics]::FromImage($banner)
  try {
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.Clear([System.Drawing.Color]::FromArgb(246, 243, 237))
    $g2.FillRectangle($green, 0, 0, 58, 58)
    Draw-ImageContained $g2 $crest ([System.Drawing.RectangleF]::new(13, 12, 34, 34))
    $headFont = New-Object System.Drawing.Font 'Georgia', 13, ([System.Drawing.FontStyle]::Bold)
    $subFont = New-Object System.Drawing.Font 'Segoe UI', 8
    try {
      $g2.DrawString('Griffin Menu Studio', $headFont, $ink, 78, 9)
      $g2.DrawString('Desktop menu editor for The Griffin', $subFont, $muted, 80, 34)
    } finally {
      $headFont.Dispose()
      $subFont.Dispose()
    }
    $g2.DrawLine($linePen, 0, 57, 493, 57)
  } finally {
    $g2.Dispose()
  }
  $banner.Save((Join-Path $outDir 'wix-banner.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
} finally {
  $crest.Dispose()
  $cream.Dispose()
  $panel.Dispose()
  $green.Dispose()
  $pink.Dispose()
  $ink.Dispose()
  $muted.Dispose()
  $linePen.Dispose()
}

Write-Output "Generated WiX installer artwork in $outDir"
