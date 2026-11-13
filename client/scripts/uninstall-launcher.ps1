# Restores RetroBat's original emulatorLauncher.exe (undo install-launcher.ps1).
param(
  [string]$RetrobatRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"
$es = Join-Path $RetrobatRoot "emulationstation"
$real = Join-Path $es "emulatorLauncher_real.exe"
$proxy = Join-Path $es "emulatorLauncher.exe"

if (-not (Test-Path $real)) {
  Write-Host "Nothing to restore (emulatorLauncher_real.exe not found)."
  return
}
Remove-Item $proxy -Force -ErrorAction SilentlyContinue
Move-Item $real $proxy
Write-Host "Restored original emulatorLauncher.exe"
