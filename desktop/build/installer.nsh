# Dither Studio's installer extras — compiled into the NSIS setup that
# electron-builder writes (`nsis.include` in package.json points here).
#
# One job: an upgrade must not leave the build it replaced behind.
#
# electron-builder removes the previous installation it knows about — the one
# registered under this app's own key (`Software\<appId GUID>`) in the install
# context being used, by running that build's own uninstaller. Three real cases
# slip past it:
#
#   * a build installed for all users, upgraded by a per-user setup (or the
#     other way round): a different key, so nothing looks for it;
#   * an install whose folder sits elsewhere, because the folder picker was
#     used the first time;
#   * a row in Apps & features whose files are already gone.
#
# The sweep runs as `customInstall`: after the previous build's uninstaller has
# had its turn, and after this build's files are on disk, so it can compare
# against $INSTDIR and leave the folder it is installing into alone.
#
# It removes an older build's files itself rather than running that build's
# uninstaller. An electron-builder uninstaller works out where it lives from
# `Software\<key>` before anything else and falls back to the default per-user
# folder — the folder this setup may well be writing to — when that record is
# missing. Handing an installer with a different key to it is not worth the
# risk, and its files, its shortcut (the new build's shortcut has the same
# name) and its registry record are all dealt with here.
#
# A folder is only ever removed when it does not belong to $INSTDIR and the row
# itself proves the folder is a Dither Studio install: it names an uninstaller
# that is still there, or the app's own executable is inside. A row is deleted
# only once its files are really gone; one that cannot be cleaned up is left
# where the user can see it, with a line in the log saying so.

!define DITHER_UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall"
!define DITHER_DISPLAY_NAME "Dither Studio"

!macro customInstall
  !insertmacro ditherSweepOlderBuilds HKEY_CURRENT_USER
  !insertmacro ditherSweepOlderBuilds HKEY_LOCAL_MACHINE
!macroend

!macro ditherSweepOlderBuilds ROOT_KEY
  StrCpy $R6 0                                  # row index in the Uninstall key
  ${Do}
    ClearErrors
    EnumRegKey $R1 ${ROOT_KEY} "${DITHER_UNINSTALL_KEY}" $R6
    ${If} ${Errors}
      ${Break}
    ${EndIf}
    ${If} $R1 == ""
      ${Break}
    ${EndIf}
    IntOp $R6 $R6 + 1                           # advance, so a delete cannot skip a row

    # This app's own key: either this build, or the one electron-builder has
    # just removed. Not ours to clear.
    ${If} $R1 == "${UNINSTALL_APP_KEY}"
      ${Continue}
    ${EndIf}

    ReadRegStr $R2 ${ROOT_KEY} "${DITHER_UNINSTALL_KEY}\$R1" "DisplayName"
    StrCpy $R3 $R2 13                           # "Dither Studio" is 13 characters,
    ${If} $R3 != "${DITHER_DISPLAY_NAME}"       # so an older "Dither Studio 0.1.4"
      ${Continue}                               # matches while anything else does not
    ${EndIf}

    ReadRegStr $R3 ${ROOT_KEY} "${DITHER_UNINSTALL_KEY}\$R1" "UninstallString"
    ${If} $R3 == ""
      DetailPrint "Clearing a leftover Dither Studio entry that has no uninstaller"
      DeleteRegKey ${ROOT_KEY} "${DITHER_UNINSTALL_KEY}\$R1"
      IntOp $R6 $R6 - 1
      ${Continue}
    ${EndIf}

    !insertmacro GetInQuotes $R4 "$R3"
    Push $R4
    Call GetFileParent
    Pop $R5                                     # $R4: its uninstaller, $R5: its folder

    ${If} $R5 == $INSTDIR
      ${Continue}                               # the folder this setup is writing into
    ${EndIf}

    ${If} ${FileExists} "$R4"
    ${OrIf} ${FileExists} "$R5\${APP_EXECUTABLE_FILENAME}"
      # The row names an uninstaller that is still there, or the app itself is
      # in the folder: this is a Dither Studio install, so its files go.
      DetailPrint "Removing the older Dither Studio in $R5"
      RMDir /r "$R5"
      RMDir "$R5"
    ${Else}
      DetailPrint "An older Dither Studio row in $R5 has nothing left in it to remove"
    ${EndIf}

    ${If} ${FileExists} "$R5\*.*"
      DetailPrint "Could not remove $R5, so its uninstall entry stays"
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONEXCLAMATION "An older copy of Dither Studio in $R5 could not be removed. Close the app if it is running and delete that folder by hand; its entry stays in Apps & features until the folder is gone."
      ${EndIf}
    ${Else}
      RMDir "$R5"
      DeleteRegKey ${ROOT_KEY} "${DITHER_UNINSTALL_KEY}\$R1"
      DeleteRegKey ${ROOT_KEY} "Software\$R1"   # the older build's own install record
      IntOp $R6 $R6 - 1
    ${EndIf}
  ${Loop}
!macroend
