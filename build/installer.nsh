!macro customUnInstall
  ${ifNot} ${isUpdated}
    ${ifNot} ${Silent}
      MessageBox MB_YESNO|MB_ICONQUESTION "Θέλετε να διαγραφούν όλα τα δεδομένα του προγράμματος από τον υπολογιστή;" IDNO keepAppData
        ${if} $installMode == "all"
          SetShellVarContext current
        ${endif}
        RMDir /r "$APPDATA\${APP_FILENAME}"
        !ifdef APP_PRODUCT_FILENAME
          RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
        !endif
        !ifdef APP_PACKAGE_NAME
          RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
        !endif
        ${if} $installMode == "all"
          SetShellVarContext all
        ${endif}
      keepAppData:
    ${endif}
  ${endif}
!macroend
