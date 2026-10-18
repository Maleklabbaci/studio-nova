; Studio Nova installer options (electron-builder `nsis.include`).
;
; With `createDesktopShortcut: true` electron-builder always drops an icon
; on the desktop without asking. We turn that off in electron-builder.yml
; and ask instead, on one extra page shown right after the install-folder
; page - the last choice before files are copied. The answer is kept in
; $DesktopShortcutWanted (default: yes, so silent installs behave like
; before) and applied in `customInstall`, which electron-builder invokes
; at the end of the install section, just after its own shortcut step.
; The uninstaller removes the shortcut through the registry info the
; template already writes, so it stays in sync with what we create here.

!include "LogicLib.nsh"
!include "nsDialogs.nsh"

Var DesktopShortcutWanted
Var DesktopShortcutCheckboxHandle

; The page only exists in the installer script. This file is also compiled
; into the uninstaller (BUILD_UNINSTALLER is defined there), where a page
; function nothing references is warning 6010 - and electron-builder treats
; NSIS warnings as errors, which failed the whole Windows build. The
; uninstaller does not need the page: the template removes the shortcut
; from the registry info it writes itself.
!ifndef BUILD_UNINSTALLER
Function DesktopShortcutPageCreate
  ; Never interrupt a silent install; the default from customInit applies.
  IfSilent 0 showPage
  Abort
showPage:
  ; Page title in the Modern UI header (1037 = title, 1038 = subtitle).
  GetDlgItem $0 $HWNDPARENT 1037
  SendMessage $0 12 0 "STR:Desktop shortcut"
  GetDlgItem $0 $HWNDPARENT 1038
  SendMessage $0 12 0 "STR:One last choice before Studio Nova is installed."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 8u 100% 24u "Add a Studio Nova icon to your desktop so the studio opens in one click. It is only a shortcut: removing it never removes the app."
  Pop $0
  ${NSD_CreateCheckbox} 0 42u 100% 12u "Create a desktop shortcut"
  Pop $DesktopShortcutCheckboxHandle
  ${If} $DesktopShortcutWanted == "1"
    ${NSD_Check} $DesktopShortcutCheckboxHandle
  ${Else}
    ${NSD_Uncheck} $DesktopShortcutCheckboxHandle
  ${EndIf}
  nsDialogs::Show
FunctionEnd

Function DesktopShortcutPageLeave
  ${NSD_GetState} $DesktopShortcutCheckboxHandle $DesktopShortcutWanted
FunctionEnd

!macro customPageAfterChangeDir
  Page custom DesktopShortcutPageCreate DesktopShortcutPageLeave
!macroend
!endif

!macro customInit
  StrCpy $DesktopShortcutWanted "1"
!macroend

!macro customInstall
  ${If} $DesktopShortcutWanted == "1"
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${EndIf}
!macroend
