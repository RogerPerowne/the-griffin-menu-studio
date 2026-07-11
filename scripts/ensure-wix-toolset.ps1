[CmdletBinding()]
param(
  [string]$Version = '3.14.1',
  [string]$CacheRoot
)

$ErrorActionPreference = 'Stop'

$hasWixOnPath = (Get-Command candle.exe -ErrorAction SilentlyContinue) -and (Get-Command light.exe -ErrorAction SilentlyContinue)
if ($hasWixOnPath) {
  Write-Output 'Using WiX Toolset from PATH.'
} else {
  if ([string]::IsNullOrWhiteSpace($CacheRoot)) {
    $CacheRoot = Join-Path $env:LOCALAPPDATA 'GriffinMenuStudioBuild\wix'
  }

  $packageRoot = Join-Path $CacheRoot $Version
  $toolsDir = Join-Path $packageRoot 'tools'
  $candle = Join-Path $toolsDir 'candle.exe'
  $light = Join-Path $toolsDir 'light.exe'

  if (!(Test-Path -LiteralPath $candle) -or !(Test-Path -LiteralPath $light)) {
    New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null
    $nupkg = Join-Path $packageRoot "wix.$Version.nupkg"
    $url = "https://www.nuget.org/api/v2/package/wix/$Version"
    Write-Output "Downloading WiX Toolset $Version build tools..."
    Invoke-WebRequest -Uri $url -OutFile $nupkg
    $extractDir = Join-Path $packageRoot 'extract'
    if (Test-Path -LiteralPath $extractDir) {
      Remove-Item -LiteralPath $extractDir -Recurse -Force
    }
    $zip = Join-Path $packageRoot "wix.$Version.zip"
    Copy-Item -LiteralPath $nupkg -Destination $zip -Force
    Expand-Archive -LiteralPath $zip -DestinationPath $extractDir -Force
    if (Test-Path -LiteralPath $toolsDir) {
      Remove-Item -LiteralPath $toolsDir -Recurse -Force
    }
    Move-Item -LiteralPath (Join-Path $extractDir 'tools') -Destination $toolsDir
    Remove-Item -LiteralPath $extractDir -Recurse -Force
  }

  if (!(Test-Path -LiteralPath $candle) -or !(Test-Path -LiteralPath $light)) {
    throw "WiX Toolset $Version did not provide candle.exe and light.exe."
  }

  $env:PATH = "$toolsDir;$env:PATH"
  Write-Output "Using WiX Toolset $Version from $toolsDir"
}
