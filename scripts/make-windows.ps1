[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

& npm.cmd run assets:installer
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

. (Join-Path $PSScriptRoot 'ensure-wix-toolset.ps1')

$staleSquirrel = Join-Path $root 'out\make\squirrel.windows'
if (Test-Path -LiteralPath $staleSquirrel) {
  Remove-Item -LiteralPath $staleSquirrel -Recurse -Force
}

& (Join-Path $root 'node_modules\.bin\electron-forge.cmd') make
exit $LASTEXITCODE
