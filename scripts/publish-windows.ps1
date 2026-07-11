[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

# The GitHub publisher needs a token with `repo` scope to create the release and
# upload the Squirrel Setup.exe / .nupkg / RELEASES that the app auto-updates from.
if (-not $env:GITHUB_TOKEN) {
  Write-Error 'GITHUB_TOKEN is not set. Create a GitHub personal access token with repo scope and set $env:GITHUB_TOKEN before publishing.'
  exit 1
}

& npm.cmd run assets:installer
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

. (Join-Path $PSScriptRoot 'ensure-wix-toolset.ps1')

$staleSquirrel = Join-Path $root 'out\make\squirrel.windows'
if (Test-Path -LiteralPath $staleSquirrel) {
  Remove-Item -LiteralPath $staleSquirrel -Recurse -Force
}

& (Join-Path $root 'node_modules\.bin\electron-forge.cmd') publish
exit $LASTEXITCODE
