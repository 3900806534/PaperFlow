; PaperFlow NSIS hooks — deploy bundled Umi-OCR to D:\Umi-OCR on install;
; ask whether to delete local data on uninstall

!macro NSIS_HOOK_POSTINSTALL
  ; Copy bundled Umi-OCR engine to D:\Umi-OCR (user rule: tools on D:)
  ; Skip if the user already has it there
  IfFileExists "D:\Umi-OCR\Umi-OCR.exe" SkipUmiCopy
  CreateDirectory "D:\Umi-OCR"
  CopyFiles /SILENT "$INSTDIR\resources\Umi-OCR\*.*" "D:\Umi-OCR\"
  SkipUmiCopy:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "是否同时删除本地学习数据？$\r$\n$\r$\n选择「是」将删除所有试卷和答题记录（D:\PaperFlowData）。$\r$\n选择「否」保留数据，重新安装后仍可使用。" IDYES pfDeleteData IDNO pfKeepData

  pfDeleteData:
    RMDir /r "D:\PaperFlowData"
    Goto pfDataDone

  pfKeepData:
    Goto pfDataDone

  pfDataDone:
!macroend
