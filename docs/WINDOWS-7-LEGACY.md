# Windows 7 Legacy build

The normal Windows 10/11 build remains on the Electron version declared in
`package.json`.

The separate Windows 7 SP1 x64 build is created with:

```powershell
npm run dist:win7
```

Its installer is written to `release/win7-legacy` and uses Electron 22.3.27,
the final Electron release line compatible with Windows 7.

The Windows 7 SP1 32-bit (x86/ia32) build is created with:

```powershell
npm run dist:win7:x86
```

Its installer is written to `release/win7-legacy-x86`.

## Isolation and offline operation

- It has a distinct application ID, package name, product name, and user-data
  directory.
- It uses a separate Electron user-data directory.
- HTTP, HTTPS, WebSocket, and secure WebSocket requests are rejected.
- Permission requests, external windows, and navigation away from local files
  are rejected.
- The user interface permanently displays `WINDOWS 7 LEGACY · OFFLINE`.

Electron 22 is end-of-life and receives no security updates. This build must
remain offline and should only be used on Windows 7 SP1 64-bit systems where
upgrading the operating system is not currently possible. Use the x86 build
only on 32-bit Windows; use the x64 build on 64-bit Windows.
