# Windows 10/11 x86 build

The Windows 10/11 32-bit (x86/ia32) installer is created with:

```powershell
npm run dist:win:x86
```

The installer is written to `release/win-x86` and uses the same modern
Electron release as the standard Windows 10/11 application. It is a standard
build: Windows 7 legacy mode and its offline-only restrictions are not enabled.

Use this installer only on 32-bit editions of Windows 10/11. The normal x64
installer remains the recommended build for 64-bit Windows.
