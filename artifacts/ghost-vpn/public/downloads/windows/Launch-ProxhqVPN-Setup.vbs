Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = dir & "\Install.ps1"
cmd = "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File """ & ps1 & """"
sh.Run cmd, 0, False
