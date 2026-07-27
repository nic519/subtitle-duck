#ifndef SourceDir
#define SourceDir "..\portable-work\subtitle-duck"
#endif

#ifndef OutputDir
#define OutputDir "..\artifacts"
#endif

#ifndef AppVersion
#define AppVersion "1.0.0"
#endif

#ifndef AppIconFile
#define AppIconFile "..\assets\app-icon.ico"
#endif

#ifndef OutputBaseFilename
#define OutputBaseFilename "subtitle-duck_1.0.0_x64-setup"
#endif

[Setup]
AppId=com.subtitleduck.app
AppName=subtitle-duck
AppVersion={#AppVersion}
AppPublisher=subtitle-duck
DefaultDirName={localappdata}\Programs\subtitle-duck
DefaultGroupName=subtitle-duck
DisableProgramGroupPage=yes
OutputDir={#OutputDir}
OutputBaseFilename={#OutputBaseFilename}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
SetupIconFile={#AppIconFile}
UninstallDisplayIcon={app}\bin\launcher.exe
SetupLogging=yes

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Dirs]
Name: "{localappdata}\com.subtitleduck.app\stable\logs"

[Icons]
Name: "{group}\subtitle-duck"; Filename: "{app}\bin\launcher.exe"; WorkingDir: "{app}\bin"
Name: "{group}\Open Logs"; Filename: "{win}\explorer.exe"; Parameters: """{localappdata}\com.subtitleduck.app\stable\logs"""
Name: "{userdesktop}\subtitle-duck"; Filename: "{app}\bin\launcher.exe"; WorkingDir: "{app}\bin"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Run]
Filename: "{app}\bin\launcher.exe"; Description: "Launch subtitle-duck"; Flags: nowait postinstall skipifsilent; WorkingDir: "{app}\bin"
