; RGS (Retro Games Saviour) — Inno Setup installer
; Compile: ISCC /DDistDir="D:\es-build\dist" /DAppVersion="0.1.0" rgs.iss
; DistDir must point at the assembled standalone tree (emulationstation.exe at root).

#ifndef DistDir
  #error Define DistDir, e.g. ISCC /DDistDir="D:\es-build\dist" rgs.iss
#endif
#ifndef AppVersion
  #define AppVersion "0.1.0"
#endif

#define AppName "RGS"
#define AppFullName "Retro Games Saviour"
#define AppPublisher "RGS"
#define AppExeName "emulationstation.exe"

[Setup]
; NOTE: keep this GUID stable across releases so upgrades replace in place.
AppId={{08E188AC-92B5-4249-920E-E8A704D4CB00}
AppName={#AppFullName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
VersionInfoVersion={#AppVersion}
; Install under the system drive root (e.g. C:\RGS) so the emulator tree
; (RetroArch config, saves, states) stays writable — Program Files is not.
DefaultDirName={sd}\{#AppName}
DefaultGroupName={#AppFullName}
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
OutputBaseFilename=RGS-Setup-{#AppVersion}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
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
  Excludes: "*.validated,emulators\retroarch\saves\*,emulators\retroarch\states\*,emulators\retroarch\logs\*,emulators\retroarch\screenshots\*"

[Icons]
Name: "{group}\{#AppFullName}"; Filename: "{app}\{#AppExeName}"; \
  Parameters: "--home ""{app}"" --windowed"; WorkingDir: "{app}"
Name: "{group}\{cm:UninstallProgram,{#AppFullName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppFullName}"; Filename: "{app}\{#AppExeName}"; \
  Parameters: "--home ""{app}"" --windowed"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Visual C++ runtime for the MSVC-built EmulationStation (Win32/x86).
; TODO before release: bundle vc_redist.x86.exe under redist\ and enable:
; Filename: "{tmp}\vc_redist.x86.exe"; Parameters: "/install /quiet /norestart"; \
;   StatusMsg: "Installing Visual C++ runtime..."; Check: VCRedistNeeded
Filename: "{app}\{#AppExeName}"; Parameters: "--home ""{app}"" --windowed"; WorkingDir: "{app}"; \
  Description: "{cm:LaunchProgram,{#AppFullName}}"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
; Remove runtime state created after install so no stale tree is left behind.
Type: filesandordirs; Name: "{app}\emulators\retroarch\saves"
Type: filesandordirs; Name: "{app}\emulators\retroarch\states"
Type: filesandordirs; Name: "{app}\emulators\retroarch\logs"
Type: filesandordirs; Name: "{app}\.emulationstation\es_temporaryfiles"
