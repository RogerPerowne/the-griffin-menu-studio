[CmdletBinding()]
param(
  [string]$OutputRoot
)

if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $PSScriptRoot '..\out'
}

$resolvedRoot = Resolve-Path $OutputRoot -ErrorAction Stop
$msi = Join-Path $resolvedRoot 'make\wix\x64\Griffin Menu Studio.msi'
$squirrelSetup = Join-Path $resolvedRoot 'make\squirrel.windows\x64\Griffin Menu Studio Setup.exe'
$appRoot = Join-Path $resolvedRoot 'Griffin Menu Studio-win32-x64'

$targets = @()
foreach ($installer in @($msi, $squirrelSetup)) {
  if (Test-Path -LiteralPath $installer) {
    $targets += Get-Item -LiteralPath $installer
  } else {
    throw "Missing installer to verify: $installer"
  }
}

if (Test-Path -LiteralPath $appRoot) {
  $targets += Get-ChildItem -LiteralPath $appRoot -Recurse -File |
    Where-Object { $_.Extension -in '.exe', '.dll', '.node' }
} else {
  throw "Missing packaged application directory: $appRoot"
}

if (!$targets.Count) {
  throw 'No Windows binaries were found to verify.'
}

$invalid = foreach ($target in $targets) {
  $signature = Get-AuthenticodeSignature -LiteralPath $target.FullName
  if ($signature.Status -ne 'Valid') {
    [PSCustomObject]@{
      File = $target.FullName
      Status = $signature.Status
      StatusMessage = $signature.StatusMessage
    }
  }
}

if ($invalid) {
  $invalid | Format-Table -AutoSize | Out-String | Write-Error
  throw 'Windows signature verification failed.'
}

Write-Output "Verified Authenticode signatures for $($targets.Count) Windows binaries."
