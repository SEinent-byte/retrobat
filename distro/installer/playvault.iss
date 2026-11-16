; PlayVault — Inno Setup installer
; Compile: ISCC /DDistDir="D:\es-build\dist" /DAppVersion="0.1.0" rgs.iss
; DistDir must point at the assembled standalone tree (emulationstation.exe at root).

#ifndef DistDir
  #error Define DistDir, e.g. ISCC /DDistDir="D:\es-build\dist" rgs.iss
#endif
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

#define AppName "PlayVault"
#define AppFullName "PlayVault"
#define AppPublisher "PlayVault"
#define AppExeName "emulationstation.exe"

[Setup]
; NOTE: keep this GUID stable across releases so upgrades replace in place.
AppId={{08E188AC-92B5-4249-920E-E8A704D4CB00}
AppName={#AppFullName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
VersionInfoVersion={#AppVersion}
; Install under the system drive root (e.g. C:\PlayVault) so the emulator tree
; (RetroArch config, saves, states) stays writable — Program Files is not.
DefaultDirName={sd}\{#AppName}
DefaultGroupName={#AppFullName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=PlayVault-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
; Toro icon on the generated Setup.exe (replaces the default Inno icon).
SetupIconFile=..\brand\toro.ico
UninstallDisplayName={#AppFullName}
UninstallDisplayIcon={app}\{#AppExeName}

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"
Name: "en"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; The whole assembled standalone tree. excludes keep user-writable runtime
; state out of the package (created on first run).
Source: "{#DistDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion; \
  Excludes: "*.validated,*.es-bak,roms\*,.emulationstation\account_status.txt,emulators\retroarch\retroarch.cfg,emulators\retroarch\saves\*,emulators\retroarch\states\*,emulators\retroarch\logs\*,emulators\retroarch\screenshots\*"

[Icons]
; Launch through launcher.exe -boot: it syncs the catalog (new web games) then
; starts emulationstation.exe. IconFilename keeps the toro icon on the shortcut.
Name: "{group}\{#AppFullName}"; Filename: "{app}\launcher.exe"; \
  Parameters: "-boot --home ""{app}"" --windowed"; WorkingDir: "{app}"; \
  IconFilename: "{app}\{#AppExeName}"
Name: "{group}\{cm:UninstallProgram,{#AppFullName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppFullName}"; Filename: "{app}\launcher.exe"; \
  Parameters: "-boot --home ""{app}"" --windowed"; WorkingDir: "{app}"; \
  IconFilename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
; Visual C++ 2015-2022 x86 runtime for the MSVC-built EmulationStation (Win32).
; Packed under redist\ in the dist tree; runs on every install (the redist
; is a no-op when a newer runtime is already present), so a clean PC starts
; without a missing-DLL error. Runs before the app launch entry below.
Filename: "{app}\redist\vc_redist.x86.exe"; Parameters: "/install /quiet /norestart"; \
  StatusMsg: "Instalando Visual C++ runtime..."; Flags: waituntilterminated
Filename: "{app}\launcher.exe"; Parameters: "-boot --home ""{app}"" --windowed"; WorkingDir: "{app}"; \
  Description: "{cm:LaunchProgram,{#AppFullName}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Remove runtime state created after install so no stale tree is left behind.
Type: filesandordirs; Name: "{app}\emulators\retroarch\saves"
Type: filesandordirs; Name: "{app}\emulators\retroarch\states"
Type: filesandordirs; Name: "{app}\emulators\retroarch\logs"
Type: filesandordirs; Name: "{app}\.emulationstation\es_temporaryfiles"
