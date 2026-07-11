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

# Recolour the black crest line-art to a solid colour, preserving its alpha
# channel (so the openwork detail and anti-aliased edges survive intact).
function Draw-ImageTinted($graphics, $image, [System.Drawing.RectangleF]$box, [string]$hex) {
  $r = [Convert]::ToInt32($hex.Substring(1, 2), 16) / 255.0
  $g = [Convert]::ToInt32($hex.Substring(3, 2), 16) / 255.0
  $b = [Convert]::ToInt32($hex.Substring(5, 2), 16) / 255.0
  $cm = New-Object System.Drawing.Imaging.ColorMatrix
  $cm.Matrix00 = 0; $cm.Matrix11 = 0; $cm.Matrix22 = 0   # drop source RGB
  $cm.Matrix40 = $r; $cm.Matrix41 = $g; $cm.Matrix42 = $b # inject brand colour
  # Matrix33 stays 1 -> source alpha (the crest shape) is preserved
  $attr = New-Object System.Drawing.Imaging.ImageAttributes
  $attr.SetColorMatrix($cm)
  $ratio = [Math]::Min($box.Width / $image.Width, $box.Height / $image.Height)
  $w = [int]($image.Width * $ratio)
  $h = [int]($image.Height * $ratio)
  $x = [int]($box.X + (($box.Width - $w) / 2))
  $y = [int]($box.Y + (($box.Height - $h) / 2))
  $dest = New-Object System.Drawing.Rectangle $x, $y, $w, $h
  $graphics.DrawImage($image, $dest, 0, 0, $image.Width, $image.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  $attr.Dispose()
}

$cream = New-Brush '#F6F3ED'
$panel = New-Brush '#FFFFFF'
$green = New-Brush '#00403D'
$pink = New-Brush '#FFF4F4'
$ink = New-Brush '#222222'
$muted = New-Brush '#66584A'
$linePen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(228, 221, 209)), 1

$crest = [System.Drawing.Image]::FromFile($crestPath)

# WiX (WixUI_InstallDir) draws its OWN text over these bitmaps:
#  - Dialog bmp (Welcome/Exit): title + body render on the RIGHT ~two-thirds,
#    so branding must stay inside the LEFT 164px sidebar and nowhere else.
#  - Banner bmp (all other dialogs): title + description render at the top-LEFT,
#    so branding must sit hard-RIGHT and the left must stay clear.
# Keeping to those zones is what prevents the text overlap.

try {
  $dialog = New-Object System.Drawing.Bitmap 493, 312
  $g = [System.Drawing.Graphics]::FromImage($dialog)
  try {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    # Right two-thirds: clean cream canvas that WiX paints its wizard text onto.
    $g.Clear([System.Drawing.Color]::FromArgb(246, 243, 237))
    # Left sidebar: brand green with the crest and stacked wordmark, all within 164px.
    $sidebarW = 164
    $g.FillRectangle($green, 0, 0, $sidebarW, 312)
    Draw-ImageTinted $g $crest ([System.Drawing.RectangleF]::new(42, 66, 80, 80)) '#FFF4F4'
    $center = New-Object System.Drawing.StringFormat
    $center.Alignment = [System.Drawing.StringAlignment]::Center
    $titleFont = New-Object System.Drawing.Font 'Georgia', 15, ([System.Drawing.FontStyle]::Bold)
    $tagFont = New-Object System.Drawing.Font 'Segoe UI', 8
    try {
      $g.DrawString('Griffin', $titleFont, $pink, ([System.Drawing.RectangleF]::new(0, 172, $sidebarW, 26)), $center)
      $g.DrawString('Menu Studio', $titleFont, $pink, ([System.Drawing.RectangleF]::new(0, 196, $sidebarW, 26)), $center)
      $g.DrawString('THE GRIFFIN', $tagFont, $pink, ([System.Drawing.RectangleF]::new(0, 232, $sidebarW, 18)), $center)
    } finally {
      $titleFont.Dispose()
      $tagFont.Dispose()
      $center.Dispose()
    }
    # Hairline separating the sidebar from WiX's text column.
    $g.DrawLine($linePen, $sidebarW, 0, $sidebarW, 312)
  } finally {
    $g.Dispose()
  }
  $dialog.Save((Join-Path $outDir 'wix-dialog.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)

  $banner = New-Object System.Drawing.Bitmap 493, 58
  $g2 = [System.Drawing.Graphics]::FromImage($banner)
  try {
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    # Left: clean canvas for WiX's dialog title + description. Branding sits hard-right.
    $g2.Clear([System.Drawing.Color]::FromArgb(246, 243, 237))
    $g2.FillRectangle($green, 435, 0, 58, 58)
    Draw-ImageTinted $g2 $crest ([System.Drawing.RectangleF]::new(447, 12, 34, 34)) '#FFF4F4'
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
