# Installs the RetroBat.Launcher proxy as RetroBat's emulatorLauncher.exe.
# Reversible: the original launcher is kept as emulatorLauncher_real.exe and
# restored by uninstall-launcher.ps1. Idempotent.
param(
  [string]$RetrobatRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$Dotnet = "C:\Program Files\dotnet\dotnet.exe"
)

$ErrorActionPreference = "Stop"
$es = Join-Path $RetrobatRoot "emulationstation"
$real = Join-Path $es "emulatorLauncher_real.exe"
$proxy = Join-Path $es "emulatorLauncher.exe"
$proj = Join-Path $PSScriptRoot "..\RetroBat.Launcher\RetroBat.Launcher.csproj"

if (-not (Test-Path $es)) { throw "emulationstation folder not found under $RetrobatRoot" }

Write-Host "Publishing wrapper…"
$pubDir = Join-Path $env:TEMP "retrobat-launcher-pub"
& $Dotnet publish $proj -c Release -r win-x64 --self-contained false `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true `
  -o $pubDir | Out-Null
$built = Join-Path $pubDir "RetroBat.Launcher.exe"
if (-not (Test-Path $built)) { throw "publish failed: $built missing" }

# Back up the real launcher once.
if (-not (Test-Path $real)) {
  if (-not (Test-Path $proxy)) { throw "emulatorLauncher.exe not found to back up" }
  Write-Host "Backing up original launcher -> emulatorLauncher_real.exe"
  Move-Item $proxy $real
}

Write-Host "Installing proxy as emulatorLauncher.exe"
Copy-Item $built $proxy -Force
Write-Host "Done. Original preserved at: $real"
