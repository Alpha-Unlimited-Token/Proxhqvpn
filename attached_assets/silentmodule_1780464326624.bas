Attribute VB_Name = "Module1"
'This is a module I compiled for you peeps TO LEARN from, IT IS NOT one I use I made my own totally, but I compiled this for you guys to leard from. Some was coded by me and some was coded by Unsakred... Have Fun - i_silent_i
Public Declare Function SetWindowPos Lib "user32" (ByVal hwnd As Long, ByVal hWndInsertAfter As Long, ByVal X As Long, ByVal Y As Long, ByVal cx As Long, ByVal cy As Long, ByVal wFlags As Long) As Long
Public Declare Function venkymd5crypt Lib "venky.dll" (ByVal pass As String, ByVal salt As String, ByVal ret As String) As Long
Public Declare Function sndPlaySound Lib "winmm.dll" Alias "sndPlaySoundA" (ByVal lpszSoundName As String, ByVal uFlags As Long) As Long
Option Explicit
      #If Win32 Then
        
      #Else
        Private Declare Function sndPlaySound Lib "MMSYSTEM" ( _
                           lpszSoundName As Any, ByVal uFlags%) As Integer
      #End If
Declare Function ShellExecute Lib "shell32.dll" Alias "ShellExecuteA" (ByVal hwnd As Long, ByVal lpOperation As String, ByVal lpFile As String, ByVal lpParameters As String, ByVal lpDirectory As String, ByVal nShowCmd As Long) As Long
Declare Sub CopyMemory Lib "kernel32" Alias "RtlMoveMemory" (destination As Any, Source As Any, ByVal Length As Long)
Declare Sub RtlMoveMemory Lib "kernel32" (ByRef dest As Any, ByRef Source As Any, ByVal nBytes As Long)
Declare Function CloseHandle Lib "kernel32" (ByVal hObject As Long) As Long
Declare Function GetCursorPos Lib "user32" () As Single
Declare Function GetPrivateProfileString Lib "kernel32" Alias "GetPrivateProfileStringA" (ByVal lpApplicationName As String, ByVal lpKeyName As Any, ByVal lpDefault As String, ByVal lpReturnedString As String, ByVal nSize As Long, ByVal lpFileName As String) As Long
Declare Function GetWindowsDirectory Lib "kernel32" Alias "GetWindowsDirectoryA" (ByVal lpBuffer As String, ByVal nSize As Long) As Long
Declare Function OpenProcess Lib "kernel32" (ByVal dwDesiredAccess As Long, ByVal bInheritHandle As Long, ByVal dwProcessId As Long) As Long
Declare Function ReadProcessMemory Lib "kernel32" (ByVal hProcess As Long, ByVal lpBaseAddress As Long, ByVal lpBuffer As String, ByVal nSize As Long, ByRef lpNumberOfBytesWritten As Long) As Long
Declare Function WritePrivateProfileString Lib "kernel32" Alias "WritePrivateProfileStringA" (ByVal lpApplicationName As String, ByVal lpKeyName As Any, ByVal lpString As Any, ByVal lpFileName As String) As Long
Declare Function AppendMenu Lib "user32" Alias "AppendMenuA" (ByVal hMenu As Long, ByVal wFlags As Long, ByVal wIDNewItem As Long, ByVal lpNewItem As String) As Long
Declare Function CreatePopupMenu Lib "user32" () As Long
Declare Function DrawMenuBar Lib "user32" (ByVal hwnd As Long) As Long
Declare Function DeleteMenu Lib "user32" (ByVal hMenu As Long, ByVal nPosition As Long, ByVal wFlags As Long) As Long
Declare Function DestroyMenu Lib "user32" (ByVal hMenu%) As Integer
Declare Function EnableWindow Lib "user32" (ByVal hwnd As Long, ByVal cmd As Long) As Long
Declare Function EnumWindows& Lib "user32" (ByVal lpEnumFunc As Long, ByVal lParam As Long)
Declare Function FindWindow Lib "user32" Alias "FindWindowA" (ByVal lpClassName As String, ByVal lpWindowName As String) As Long
Declare Function FindWindowEx Lib "user32" Alias "FindWindowExA" (ByVal hWnd1 As Long, ByVal hWnd2 As Long, ByVal lpsz1 As String, ByVal lpsz2 As String) As Long
Declare Function ExitWindowsEx& Lib "user32" (ByVal uFlags As Long, ByVal dwReserved As Long)
Declare Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
Declare Function GetClassName& Lib "user32" Alias "GetClassNameA" (ByVal hwnd As Long, ByVal lpClassName As String, ByVal nMaxCount As Long)
Declare Function GetDesktopWindow Lib "user32" () As Long
Declare Function GetMenu Lib "user32" (ByVal hwnd As Long) As Long
Declare Function GetMenuItemCount Lib "user32" (ByVal hMenu As Long) As Long
Declare Function GetMenuItemID Lib "user32" (ByVal hMenu As Long, ByVal nPos As Long) As Long
Declare Function GetMenuString Lib "user32" Alias "GetMenuStringA" (ByVal hMenu As Long, ByVal wIDItem As Long, ByVal lpString As String, ByVal nMaxCount As Long, ByVal wFlag As Long) As Long
Declare Function GetParent Lib "user32" (ByVal hwnd As Long) As Long
Declare Function GetSubMenu Lib "user32" (ByVal hMenu As Long, ByVal nPos As Long) As Long
Declare Function gettopwindow Lib "user32" Alias "GetTopWindow" (ByVal hwnd As Long) As Long
Declare Function GetWindow Lib "user32" (ByVal hwnd As Long, ByVal wCmd As Long) As Long
Declare Function GetWindowLong& Lib "user32" Alias "GetWindowLongA" (ByVal hwnd As Long, ByVal nIndex As Long)
Declare Function GetWindowRect Lib "user32" (ByVal hwnd As Long, lpRect As RECT) As Long
Declare Function GetWindowText Lib "user32" Alias "GetWindowTextA" (ByVal hwnd As Long, ByVal lpString As String, ByVal cch As Long) As Long
Declare Function GetWindowTextLength Lib "user32" Alias "GetWindowTextLengthA" (ByVal hwnd As Long) As Long
Declare Function GetWindowThreadProcessId Lib "user32" (ByVal hwnd As Long, lpdwProcessId As Long) As Long
Declare Function InsertMenu Lib "user32" Alias "InsertMenuA" (ByVal hMenu As Long, ByVal nPosition As Long, ByVal wFlags As Long, ByVal wIDNewItem As Long, ByVal lpNewItem As String) As Long
Declare Function IsWindowEnabled Lib "user32" (ByVal hwnd As Long) As Long
Declare Function mciExecute Lib "winmm.dll" (ByVal lpstrCommand As String) As Long
Declare Function mciSendString Lib "winmm.dll" Alias "mciSendStringA" (ByVal lpstrCommand As String, ByVal lpstrReturnString As String, ByVal uReturnLength As Long, ByVal hwndCallback As Long) As Long
Declare Function MoveWindow Lib "user32" (ByVal hwnd As Long, ByVal X As Long, ByVal Y As Long, ByVal nWidth As Long, ByVal nHeight As Long, ByVal bRepaint As Long) As Long
Declare Function PostMessage Lib "user32" Alias "PostMessageA" (ByVal hwnd As Long, ByVal wMsg As Long, ByVal wParam As Long, ByVal lParam As Long) As Long
Declare Function PutFocus Lib "user32" Alias "SetFocus" (ByVal hwnd As Long) As Long
Declare Function RedrawWindow Lib "user32" (ByVal hwnd As Long, lprcUpdate As RECT, ByVal hrgnUpdate As Long, ByVal fuRedraw As Long) As Long
Declare Function RegisterWindowMessage& Lib "user32" Alias "RegisterWindowMessageA" (ByVal lpString As String)
Declare Function ReleaseCapture Lib "user32" () As Long
Declare Function RemoveMenu Lib "user32" (ByVal hMenu As Long, ByVal nPosition As Long, ByVal wFlags As Long) As Long
Declare Function SendMessage Lib "user32" Alias "SendMessageA" (ByVal hwnd As Long, ByVal wMsg As Long, ByVal wParam As Long, lParam As Any) As Long
Declare Function SendMessageLong Lib "user32" Alias "SendMessageA" (ByVal hwnd As Long, ByVal wMsg As Long, ByVal wParam As Integer, ByVal lParam As Long) As Long
Declare Function SendMessageByNum& Lib "user32" Alias "SendMessageA" (ByVal hwnd As Long, ByVal wMsg As Long, ByVal wParam As Long, ByVal lParam As Long)
Declare Function SendMessageByString Lib "user32" Alias "SendMessageA" (ByVal hwnd As Long, ByVal wMsg As Long, ByVal wParam As Long, ByVal lParam As String) As Long
Declare Function SetFocusApi Lib "user32" Alias "SetFocus" (ByVal hwnd As Long) As Long
Declare Function SetRect Lib "user32" (lpRect As RECT, ByVal X1 As Long, ByVal Y1 As Long, ByVal X2 As Long, ByVal Y2 As Long) As Long
Declare Function SetParent Lib "user32" (ByVal hWndChild As Long, ByVal hWndNewParent As Long) As Long

Declare Function ShowCursor Lib "user32" (ByVal bShow As Long) As Long
Declare Function ShowWindow Lib "user32" (ByVal hwnd As Long, ByVal nCmdShow As Long) As Long
Declare Function SystemParametersInfo Lib "user32" Alias "SystemParametersInfoA" (ByVal uAction As Long, ByVal uParam As Long, lpvParam As Any, ByVal fuWinIni As Long) As Long

Const EM_UNDO = &HC7
Global Const GFSR_SYSTEMRESOURCES = 0
Global Const GFSR_GDIRESOURCES = 1
Global Const GFSR_USERRESOURCES = 2
Global Const WM_MDICREATE = &H220
Global Const WM_MDIDESTROY = &H221
Global Const WM_MDIACTIVATE = &H222
Global Const WM_MDIRESTORE = &H223
Global Const WM_MDINEXT = &H224
Global Const WM_MDIMAXIMIZE = &H225
Global Const WM_MDITILE = &H226
Global Const WM_MDICASCADE = &H227
Global Const WM_MDIICONARRANGE = &H228
Global Const WM_MDIGETACTIVE = &H229
Global Const WM_MDISETMENU = &H230
Global Const WM_CUT = &H300
Global Const WM_COPY = &H301
Global Const WM_PASTE = &H302

Global Const SND_SYNC = &H0
Global Const SND_ASYNC = &H1
Global Const SND_NODEFAULT = &H2
Global Const SND_LOOP = &H8
Global Const SND_NOSTOP = &H10
Public Const SND_MEMORY = &H4

Public Const WM_SETFOCUS = &H7
Public Const WM_CHAR = &H102
Public Const WM_SETTEXT = &HC
Public Const WM_USER = &H400
Public Const WM_KEYDOWN = &H100
Public Const WM_KEYUP = &H101
Public Const WM_LBUTTONDOWN = &H201
Public Const WM_LBUTTONUP = &H202
Public Const WM_CLOSE = &H10
Public Const WM_COMMAND = &H111
Public Const WM_CLEAR = &H303
Public Const WM_DESTROY = &H2
Public Const WM_gettext = &HD
Public Const WM_GETTEXTLENGTH = &HE
Public Const BM_GETCHECK = &HF0
Public Const BM_GETSTATE = &HF2
Public Const BM_SETCHECK = &HF1
Public Const BM_SETSTATE = &HF3
Public Const EWX_FORCE = 4
Public Const EWX_LOGOFF = 0
Public Const EWX_REBOOT = 2
Public Const EWX_SHUTDOWN = 1
Public Const LB_GETITEMDATA = &H199
Public Const LB_GETCOUNT = &H18B
Public Const LB_ADDSTRING = &H180
Public Const LB_DELETESTRING = &H182
Public Const LB_FINDSTRING = &H18F
Public Const LB_FINDSTRINGEXACT = &H1A2
Public Const LB_GETCURSEL = &H188
Public Const LB_GETtext = &H189
Public Const LB_GETTEXTLEN = &H18A
Public Const LB_SELECTSTRING = &H18C
Public Const LB_SETCOUNT = &H1A7
Public Const LB_SETCURSEL = &H186
Public Const LB_SETSEL = &H185
Public Const LB_INSERTSTRING = &H181
Public Const VK_HOME = &H24
Public Const VK_RIGHT = &H27
Public Const VK_CONTROL = &H11
Public Const VK_DELETE = &H2E
Public Const VK_DOWN = &H28
Public Const VK_LEFT = &H25
Public Const VK_RETURN = &HD
Public Const VK_SPACE = &H20
Public Const VK_TAB = &H9
Public Const HWND_TOP = 0
Public Const HWND_TOPMOST = -1
Public Const HWND_NOTOPMOST = -2
Public Const SWP_NOMOVE = &H2
Public Const SWP_NOSIZE = &H1
Public Const FLAGS = SWP_NOMOVE Or SWP_NOSIZE
Public Const GW_CHILD = 5
Public Const GW_HWNDFIRST = 0
Public Const GW_HWNDLAST = 1
Public Const GW_HWNDNEXT = 2
Public Const GW_HWNDPREV = 3
Public Const GW_MAX = 5
Public Const GW_OWNER = 4
Public Const SPI_SETDESKWALLPAPER = 20
Public Const SPIF_UPDATEINIFILE = 1

Public Const SW_ERASE = &H4
Public Const SW_MAXIMIZE = 3
Public Const SW_MINIMIZE = 6
Public Const SW_HIDE = 0
Public Const SW_RESTORE = 9
Public Const SW_SHOW = 5
Public Const SW_SHOWDEFAULT = 10
Public Const SW_SHOWMAXIMIZED = 3
Public Const SW_SHOWMINIMIZED = 2
Public Const SW_SHOWMINNOACTIVE = 7
Public Const SW_SHOWNOACTIVATE = 4
Public Const SW_SHOWNORMAL = 1

Public Const MF_APPEND = &H100&
Public Const MF_DELETE = &H200&
Public Const MF_CHANGE = &H80&
Public Const MF_ENABLED = &H0&
Public Const MF_DISABLED = &H2&
Public Const MF_REMOVE = &H1000&
Public Const MF_POPUP = &H10&
Public Const MF_STRING = &H0&
Public Const MF_UNCHECKED = &H0&
Public Const MF_CHECKED = &H8&
Public Const MF_GRAYED = &H1&
Public Const MF_BYPOSITION = &H400&
Public Const MF_BYCOMMAND = &H0&
Public Const MF_SEPARATOR = &H800&

Public Const GWW_HINSTANCE = (-6)
Public Const GWW_ID = (-12)
Public Const GWL_STYLE = (-16)
Public Const ENTA = 13
Public Const PROCESS_VM_READ = &H10
Public Const STANDARD_RIGHTS_REQUIRED = &HF0000
Private Const EM_LINESCROLL = &HB6
Private Const SPI_SCREENSAVERRUNNING = 97
Type RECT
Left As Long
Top As Long
Right As Long
Bottom As Long
End Type
Type POINTAPI
X As Long
Y As Long
End Type
Public Declare Sub Sleep Lib "kernel32" (ByVal dwMilliseconds As Long)




Public Declare Function GetShortPathName Lib "kernel32" Alias "GetShortPathNameA" (ByVal lpszLongPath As String, ByVal lpszShortPath As String, ByVal cchBuffer As Long) As Long


Public Sub runmenu(lngwindow As Long, strmenutext As String)
Dim intLoop As Integer, intSubLoop As Integer, intSub2Loop As Integer, intSub3Loop As Integer, intSub4Loop As Integer
Dim lngmenu(1 To 5) As Long
Dim lngcount(1 To 5) As Long
Dim lngSubMenuID(1 To 4) As Long
Dim strcaption(1 To 4) As String
    lngmenu(1) = GetMenu(lngwindow&)
    lngcount(1) = GetMenuItemCount(lngmenu(1))
        For intLoop% = 0 To lngcount(1) - 1
            DoEvents
            lngmenu(2) = GetSubMenu(lngmenu(1), intLoop%)
            lngcount(2) = GetMenuItemCount(lngmenu(2))
                For intSubLoop% = 0 To lngcount(2) - 1
                    DoEvents
                    lngSubMenuID(1) = GetMenuItemID(lngmenu(2), intSubLoop%)
                    strcaption(1) = String(75, " ")
                    Call GetMenuString(lngmenu(2), lngSubMenuID(1), strcaption(1), 75, 1)
                        If InStr(LCase(strcaption(1)), LCase(strmenutext$)) Then
                            Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(1), 0)
                            Exit Sub
                        End If
                    lngmenu(3) = GetSubMenu(lngmenu(2), intSubLoop%)
                    lngcount(3) = GetMenuItemCount(lngmenu(3))
                        If lngcount(3) > 0 Then
                            For intSub2Loop% = 0 To lngcount(3) - 1
                                DoEvents
                                lngSubMenuID(2) = GetMenuItemID(lngmenu(3), intSub2Loop%)
                                strcaption(2) = String(75, " ")
                                Call GetMenuString(lngmenu(3), lngSubMenuID(2), strcaption(2), 75, 1)
                                    If InStr(LCase(strcaption(2)), LCase(strmenutext$)) Then
                                        Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(2), 0)
                                        Exit Sub
                                    End If
                                lngmenu(4) = GetSubMenu(lngmenu(3), intSub2Loop%)
                                lngcount(4) = GetMenuItemCount(lngmenu(4))
                                    If lngcount(4) > 0 Then
                                        For intSub3Loop% = 0 To lngcount(4) - 1
                                            DoEvents
                                            lngSubMenuID(3) = GetMenuItemID(lngmenu(4), intSub3Loop%)
                                            strcaption(3) = String(75, " ")
                                            Call GetMenuString(lngmenu(4), lngSubMenuID(3), strcaption(3), 75, 1)
                                                If InStr(LCase(strcaption(3)), LCase(strmenutext$)) Then
                                                    Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(3), 0)
                                                    Exit Sub
                                                End If
                                            lngmenu(5) = GetSubMenu(lngmenu(4), intSub3Loop%)
                                            lngcount(5) = GetMenuItemCount(lngmenu(5))
                                                If lngcount(5) > 0 Then
                                                    For intSub4Loop% = 0 To lngcount(5) - 1
                                                        DoEvents
                                                        lngSubMenuID(4) = GetMenuItemID(lngmenu(5), intSub4Loop%)
                                                        strcaption(4) = String(75, " ")
                                                        Call GetMenuString(lngmenu(5), lngSubMenuID(4), strcaption(4), 75, 1)
                                                            If InStr(LCase(strcaption(4)), LCase(strmenutext$)) Then
                                                                Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(4), 0)
                                                                Exit Sub
                                                            End If
                                                    Next intSub4Loop%
                                                End If
                                        Next intSub3Loop%
                                    End If
                            Next intSub2Loop%
                        End If
                Next intSubLoop%
        Next intLoop%
End Sub
Sub mypmboot()
Dim imclass As Long
imclass = FindWindow("IMCLASS", vbNullString)
Call runmenu(imclass&, "file &Send")
End Sub
Sub pause(interval)
Dim Current
Current = Timer
Do While Timer - Current < Val(interval)
DoEvents
Loop
End Sub
Public Sub WindowClose(lngHwnd As Long)
  Dim imclass As Long
imclass = FindWindow("imclass", vbNullString)
Call SendMessageLong(imclass, WM_CLOSE, 0&, 0&)
End Sub
Public Sub WindowHide(lngHwnd As Long)
    Call ShowWindow(lngHwnd&, SW_HIDE)
End Sub
Public Sub WindowShow(lngHwnd As Long)
    Call ShowWindow(lngHwnd&, SW_SHOW)
End Sub
Sub Buddy()
Dim imclass As Long
imclass = FindWindow("IMCLASS", vbNullString)
Call runmenu(imclass&, "&Add as Friend")
End Sub
Sub ClickMenu(lngwindow As Long, strmenutext As String)
'This is from Andymaul one of my closest friends
'Thanks man.
Dim intLoop As Integer, intSubLoop As Integer, intSub2Loop As Integer, intSub3Loop As Integer, intSub4Loop As Integer
Dim lngmenu(1 To 5) As Long
Dim lngcount(1 To 5) As Long
Dim lngSubMenuID(1 To 4) As Long
Dim strcaption(1 To 4) As String

    lngmenu(1) = GetMenu(lngwindow&)

    lngcount(1) = GetMenuItemCount(lngmenu(1))

        For intLoop% = 0 To lngcount(1) - 1

            DoEvents
    
            lngmenu(2) = GetSubMenu(lngmenu(1), intLoop%)
    
            lngcount(2) = GetMenuItemCount(lngmenu(2))
    
                For intSubLoop% = 0 To lngcount(2) - 1
    
                    DoEvents
        
                    lngSubMenuID(1) = GetMenuItemID(lngmenu(2), intSubLoop%)
        
                    strcaption(1) = String(75, " ")
        
                    Call GetMenuString(lngmenu(2), lngSubMenuID(1), strcaption(1), 75, 1)
        
                        If InStr(LCase(strcaption(1)), LCase(strmenutext$)) Then
        
                            Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(1), 0)
        
                            Exit Sub
        
                        End If
                    
                    lngmenu(3) = GetSubMenu(lngmenu(2), intSubLoop%)
                    
                    lngcount(3) = GetMenuItemCount(lngmenu(3))
                    
                        If lngcount(3) > 0 Then
                    
                            For intSub2Loop% = 0 To lngcount(3) - 1
                        
                                DoEvents
                            
                                lngSubMenuID(2) = GetMenuItemID(lngmenu(3), intSub2Loop%)
                            
                                strcaption(2) = String(75, " ")
                                
                                Call GetMenuString(lngmenu(3), lngSubMenuID(2), strcaption(2), 75, 1)
                                
                                    If InStr(LCase(strcaption(2)), LCase(strmenutext$)) Then
                                    
                                        Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(2), 0)
                                        
                                        Exit Sub
                                        
                                    End If
                                    
                                lngmenu(4) = GetSubMenu(lngmenu(3), intSub2Loop%)
                                
                                lngcount(4) = GetMenuItemCount(lngmenu(4))
                                
                                    If lngcount(4) > 0 Then
                                    
                                        For intSub3Loop% = 0 To lngcount(4) - 1
                                        
                                            DoEvents
                                            
                                            lngSubMenuID(3) = GetMenuItemID(lngmenu(4), intSub3Loop%)
                            
                                            strcaption(3) = String(75, " ")
                                
                                            Call GetMenuString(lngmenu(4), lngSubMenuID(3), strcaption(3), 75, 1)
                                
                                                If InStr(LCase(strcaption(3)), LCase(strmenutext$)) Then
                                    
                                                    Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(3), 0)
                                        
                                                    Exit Sub
                                        
                                                End If
                                            
                                            lngmenu(5) = GetSubMenu(lngmenu(4), intSub3Loop%)
                                            
                                            lngcount(5) = GetMenuItemCount(lngmenu(5))
                                            
                                                If lngcount(5) > 0 Then
                                                
                                                    For intSub4Loop% = 0 To lngcount(5) - 1
                                                    
                                                        DoEvents
                                                        
                                                        lngSubMenuID(4) = GetMenuItemID(lngmenu(5), intSub4Loop%)
                                                        
                                                        strcaption(4) = String(75, " ")
                                                        
                                                        Call GetMenuString(lngmenu(5), lngSubMenuID(4), strcaption(4), 75, 1)
                                                        
                                                            If InStr(LCase(strcaption(4)), LCase(strmenutext$)) Then
                                                            
                                                                Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(4), 0)
                                                                
                                                                Exit Sub
                                                                
                                                            End If
                                                            
                                                    Next intSub4Loop%
                                
                                                End If
                                
                                        Next intSub3Loop%
                                        
                                    End If
                        
                            Next intSub2Loop%
    
                        End If
    
                Next intSubLoop%

        Next intLoop%

End Sub

Private Function GetCaption(hwnd)
Dim hWndlength As Integer, hWndTitle As String, a As Integer
hWndlength% = GetWindowTextLength(hwnd)
hWndTitle$ = String$(hWndlength%, 0)
a% = GetWindowText(hwnd, hWndTitle$, (hWndlength% + 1))

GetCaption = hWndTitle$
End Function
Function FindPMWnd()
Dim imclass As Long
imclass& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(imclass&), LCase(" -- instant message")) Then: FindPMWnd = imclass&
End Function
Function FindMainWnd()
FindMainWnd = FindWindow("Yahoobuddymain", vbNullString)
End Function
Function FindChatWnd()
Dim imclass As Long
imclass& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(imclass&), LCase(" -- chat")) Then: FindChatWnd = imclass&
End Function
Public Function ClickButton(Button As Long)
Dim Click As Long
Click& = SendMessageByNum(Button, WM_LBUTTONDOWN, &HD, 0)
Click& = SendMessageByNum(Button, WM_LBUTTONUP, &HD, 0)
End Function
Sub WindowDisable(Window As Long)
Call EnableWindow(Window&, 0)
End Sub
Sub WindowEnable(Window As Long)
Call EnableWindow(Window&, 1)
End Sub
Public Sub SendText(what$)
Dim imc As Long, RichEdit As Long
imc& = FindWindow("IMClass", vbNullString)
RichEdit& = FindWindowEx(imc&, 0&, "RICHEDIT", vbNullString)
Call SendMessageByString(RichEdit, WM_SETTEXT, 0&, what$)
Call pause(0.2)
Call ClickMenu(imc&, "Sen&d")
End Sub
Sub SendBoot(Code$)
Anti2
ClosedaWindow
Closeewindow
Dim parent As Long, Child1 As Long, Child2 As Long
parent& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(parent&), LCase("-- instant message")) Then: Exit Sub
Call SetFocusApi(parent&)
Child2& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)
Call SendMessageByString(Child2&, WM_SETTEXT, 0, Code$)
Call ClickMenu(parent&, "Sen&d")
End Sub
Sub SendTextScroll(what As String, Times As Integer)
Do
SendText (what$)
Times = Times% - 1
Call pause(0.3)
Loop Until Times% = 0
End Sub

Sub SendPM(Who$, what$, Follow As Boolean)
Dim yahoobuddymain As Long, parent As Long, Child1 As Long, Child2 As Long
yahoobuddymain = FindWindow("yahoobuddymain", vbNullString)
Call ClickMenu(yahoobuddymain&, "Send a &Message")
Call pause(0.2)
parent& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(parent&), "Chat") Then Exit Sub
Child1& = FindWindowEx(parent&, 0&, "Edit", vbNullString)
Call SetFocusApi(Child1&)
Call SendMessageByString(Child1&, WM_SETTEXT, 0&, Who$)
Call SendMessageByNum(Child1&, WM_CHAR, 13, 0&)
Child2& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)
Call SendMessageByString(Child2&, WM_SETTEXT, 0&, what$)
Call ClickMenu(parent&, "Sen&d")
If Follow = False Then: Call WindowClose(parent&)
End Sub
Sub SendChat(what$)
Dim parent As Long, Child1 As Long, Child2 As Long
parent& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(parent&), LCase("-- instant message")) Then: Exit Sub
Call SetFocusApi(parent&)
Child2& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)
Call SendMessageByString(Child2&, WM_SETTEXT, 0, what$)
Call ClickMenu(parent&, "Sen&d")
End Sub
Sub SendChatBoot(Code$, anti As Boolean, StayIn As Boolean)
Dim imc As Long, Rich As Long, Button As Long
Dim RichEdit As Long
imc& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(imc&), "Chat") Then: SetFocusApi (imc&)
imc& = FindWindow("IMClass", vbNullString)
RichEdit& = FindWindowEx(imc&, 0&, "RICHEDIT", vbNullString)
RichEdit& = FindWindowEx(imc&, RichEdit&, "RICHEDIT", vbNullString)
If anti = True Then: Call PostMessage(RichEdit&, WM_CLOSE, 0&, 0&)
Rich& = FindWindowEx(imc&, 0&, "RICHEDIT", vbNullString)
Call SendMessageByString(Rich&, WM_SETTEXT, 0&, Code$)
Call pause(0.2)
Call ClickMenu(imc&, "Sen&d")
Call pause(0.2)
If StayIn = False Then: WindowClose (imc&)
End Sub

Sub SendPMBoot(UserName$, Code$, anti As Boolean, Follow As Boolean)
Dim parent As Long, Child1 As Long, Child2 As Long, Button As Long
Dim Yahoo As Long
Dim imclass As Long, RichEdit As Long
Yahoo& = FindWindow("YahooBuddyMain", vbNullString)
Call ClickMenu(Yahoo&, "Send a &Message")
imclass& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(imclass&), "Chat") Then Exit Sub
RichEdit& = FindWindowEx(imclass&, 0&, "RICHEDIT", vbNullString)
RichEdit& = FindWindowEx(imclass&, RichEdit&, "RICHEDIT", vbNullString)

If anti = True Then: Call PostMessage(RichEdit&, WM_CLOSE, 0&, 0&)

parent& = FindWindow("IMClass", vbNullString)
RichEdit& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)
RichEdit& = FindWindowEx(parent&, RichEdit&, "RICHEDIT", vbNullString)
Child1& = FindWindowEx(parent&, 0&, "Edit", vbNullString)

Call SetFocusApi(Child1&)

Call SendMessageByString(Child1&, WM_SETTEXT, 0&, UserName$)

Call SendMessageByNum(Child1&, WM_CHAR, 13, 0&)

Child2& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)


Call SetFocusApi(Child2&)

Call SendMessageByString(Child2&, WM_SETTEXT, 0&, Code$)

Call ClickMenu(parent&, "Sen&d")

Call pause(0.3)

If Follow = False Then: WindowClose (parent&)
End Sub
Sub SendPMLagg(UserName$, Code$, anti As Boolean, Times As Integer)
Dim parent As Long, Child1 As Long, Child2 As Long, Button As Long
Dim Yahoo As Long
Dim imclass As Long, RichEdit As Long
Yahoo& = FindWindow("YahooBuddyMain", vbNullString)
Call ClickMenu(Yahoo&, "Send a &Message")
imclass& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(imclass&), "Chat") Then Exit Sub
RichEdit& = FindWindowEx(imclass&, 0&, "RICHEDIT", vbNullString)
RichEdit& = FindWindowEx(imclass&, RichEdit&, "RICHEDIT", vbNullString)

If anti = True Then: Call PostMessage(RichEdit&, WM_CLOSE, 0&, 0&)

parent& = FindWindow("IMClass", vbNullString)
RichEdit& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)
RichEdit& = FindWindowEx(parent&, RichEdit&, "RICHEDIT", vbNullString)
Child1& = FindWindowEx(parent&, 0&, "Edit", vbNullString)

Call SetFocusApi(Child1&)

Call SendMessageByString(Child1&, WM_SETTEXT, 0&, UserName$)

Call SendMessageByNum(Child1&, WM_CHAR, 13, 0&)

Child2& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)


Call SetFocusApi(Child2&)

Do
Call SendMessageByString(Child2&, WM_SETTEXT, 0&, Code$)

Call ClickMenu(parent&, "Sen&d")

Call pause(0.3)
Times% = Times% - 1
Loop Until Times% = 0
Call WindowClose(parent&)
End Sub
Public Function GetYahooText()
Dim imc As Long, Rich As Long
Dim texts As String, thetextlen As Long

imc& = FindWindow("imclass", vbNullString)
Rich& = FindWindowEx(imc&, 0&, "richedit", vbNullString)
Rich& = FindWindowEx(imc&, Rich, "richedit", vbNullString)
Dim TheText As String, TL As Long
TL = SendMessageLong(Rich&, WM_GETTEXTLENGTH, 0&, 0&)
TheText = String(TL + 1, " ")
Call SendMessageByString(Rich&, WM_gettext, TL + 1, TheText)
TheText = Left(TheText, TL)
If TheText = "" Then GoTo NoText
        thetextlen& = (Len(TheText) - 2)
        TheText$ = Left$(TheText, thetextlen&)
GetYahooText = TheText
NoText:
End Function
Sub SendPMScroll(Who$, what$, Times As Integer, Follow As Boolean)
Dim yahoobuddymain As Long, parent As Long, Child1 As Long, Child2 As Long
yahoobuddymain = FindWindow("yahoobuddymain", vbNullString)
Call ClickMenu(yahoobuddymain&, "Send a &Message")
Call pause(0.2)
parent& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(parent&), LCase("chat")) Then: Exit Sub
Call SetFocusApi(parent&)
Child1& = FindWindowEx(parent&, 0&, "Edit", vbNullString)
Call SetFocusApi(Child1&)
Call SendMessageByString(Child1&, WM_SETTEXT, 0, Who$)
Child2& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)
Do
Call SendMessageByString(Child2&, WM_SETTEXT, 0, what$)
Times% = Times% - 1
Call ClickMenu(parent&, "Sen&d")
Call pause(0.3)
Loop Until Times% = 0
If Follow = False Then: Call WindowClose(parent&)
End Sub
Sub SendFile(Who$, FilE$, Message$)
Dim Yahoo As Long, imclass As Long, RichEdit As Long, editx As Long, Button As Long
Yahoo = FindWindow("yahoobuddymain", vbNullString)
Call ClickMenu(Yahoo&, "Send a &File...")
Call pause(0.2)
imclass = FindWindow("imclass", "Send a File...")
RichEdit = FindWindowEx(imclass, 0&, "richedit", vbNullString)
Call SetFocusApi(RichEdit&)
Call SendMessageByString(RichEdit&, WM_SETTEXT, 0, Who$)
Call pause(0.2)
editx = FindWindowEx(imclass, 0&, "edit", vbNullString)
Call SetFocusApi(editx&)
Call SendMessageByString(editx&, WM_SETTEXT, 0, FilE$)
Call pause(0.2)
editx = FindWindowEx(imclass, editx, "edit", vbNullString)
Call SetFocusApi(editx&)
Call SendMessageByString(editx, WM_SETTEXT, 0&, Message$)
Button = FindWindowEx(imclass, 0&, "button", vbNullString)
Button = FindWindowEx(imclass, Button, "button", vbNullString)
Call SetFocusApi(Button&)
Call ClickButton(Button&)
End Sub
Sub YahooClose()
Dim yahoobuddymain As Long
yahoobuddymain = FindWindow("yahoobuddymain", vbNullString)
Call ClickMenu(yahoobuddymain&, "C&lose")
End Sub
Sub ChatClear()
Dim imclass As Long, RichEdit As Long
imclass& = FindWindow("IMClass", vbNullString)
RichEdit& = FindWindowEx(imclass&, 0&, "RICHEDIT", vbNullString)
RichEdit& = FindWindowEx(imclass&, RichEdit&, "RICHEDIT", vbNullString)
If InStr(LCase(GetCaption(imclass&)), "chat") Then
Call SendMessageByString(RichEdit&, WM_SETTEXT, 0&, "")
Else: End If
End Sub
Sub ChatHide()
Call WindowHide(FindChatWnd)
End Sub
Sub ChatShow()
Call WindowShow(FindChatWnd)
End Sub
Sub ChatClearTheirs()
Dim Text As String
Text$ = vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf & vbCrLf
Call SendChat(Text$)
End Sub

Sub PMClear()
'Clears PM
Dim imclass As Long, RichEdit As Long
imclass& = FindWindow("IMClass", vbNullString)
RichEdit& = FindWindowEx(imclass&, 0&, "RICHEDIT", vbNullString)
RichEdit& = FindWindowEx(imclass&, RichEdit&, "RICHEDIT", vbNullString)
If InStr(LCase(GetCaption(imclass&)), "instant message") Then
Call SendMessageByString(RichEdit&, WM_SETTEXT, 0&, "")
Else: End If
End Sub
Sub PMHide()
Call WindowHide(FindPMWnd)
End Sub
Sub PMShow()
Call WindowShow(FindPMWnd)
End Sub

Function PMFrom()
'Get's the open pm user
Dim imclass As Long, Str As String
imclass& = FindWindow("IMClass", vbNullString)
If InStr(LCase(GetCaption(imclass&)), "instant message") Then
Str$ = GetCaption(imclass&)
Str$ = Replace(Str$, " -- Instant Message", "")
PMFrom = Str$
Else: PMFrom = "": End If
End Function
Function PMIgnore()
'Ignores current user.
Dim imclass As Long, Str As String
imclass& = FindWindow("IMClass", vbNullString)
If InStr(LCase(GetCaption(imclass&)), "instant message") Then
Call ClickMenu(imclass&, "&Ignore User...")
Else: End If
End Function
Function PMVoiceOnOff()
Call ClickMenu(FindPMWnd, "Enable &Voice")
End Function
Function Ignore(User As String)
'Ignores specific user
Dim yahoobuddymain As Long, parent As Long, Child1 As Long, Child2 As Long
yahoobuddymain = FindWindow("yahoobuddymain", vbNullString)
Call ClickMenu(yahoobuddymain&, "Send a &Message")
Call pause(0.2)
parent& = FindWindow("IMClass", vbNullString)
Child1& = FindWindowEx(parent&, 0&, "Edit", vbNullString)
Call SetFocusApi(Child1&)
Call SendMessageByString(Child1&, WM_SETTEXT, 0&, User$)
Call SendMessageByNum(Child1&, WM_CHAR, 13, 0&)
Call ClickMenu(parent&, "&Ignore User...")

End Function

Sub PMClose()
'Closes PM
Dim imclass As Long, RichEdit As Long
imclass& = FindWindow("IMClass", vbNullString)
RichEdit& = FindWindowEx(imclass&, 0&, "RICHEDIT", vbNullString)
RichEdit& = FindWindowEx(imclass&, RichEdit&, "RICHEDIT", vbNullString)
If InStr(LCase(GetCaption(imclass&)), "instant message") Then
Call WindowClose(imclass&)
Else: End If
End Sub
Sub NewAnti()
Dim imclass As Long, atleeb As Long
imclass = FindWindow("imclass", vbNullString)
atleeb = FindWindowEx(imclass, 0&, "atl:004eeb68", vbNullString)
Call SendMessageLong(atleeb, WM_CLOSE, 0&, 0&)
End Sub
Sub ChatClose()
'Closes Chat
Dim imclass As Long, RichEdit As Long
imclass& = FindWindow("IMClass", vbNullString)
RichEdit& = FindWindowEx(imclass&, 0&, "RICHEDIT", vbNullString)
RichEdit& = FindWindowEx(imclass&, RichEdit&, "RICHEDIT", vbNullString)
If InStr(LCase(GetCaption(imclass&)), "chat") Then
Call WindowClose(imclass&)
Else: End If
End Sub
Function ChatVoiceOnOff()
Call ClickMenu(FindChatWnd, "Enable &Voice")
End Function
Sub SendChatScroll(what As String, Times As Integer)
'Sends a Chat Scroll
Do
Call SendChat(what$)
Call pause(0.3)
Times% = Times% - 1
Loop Until Times% = 0
End Sub
Sub SendChatLagg(Code$, Times%)
'Send's a Chat Lagg
Do
Call SendChat(Code$)
Call pause(0.3)
Call ChatClear
Times% = Times% - 1
Loop Until Times% = 0
End Sub
Sub SignIn(UserName$, password$, SaveID As Boolean, AutoLogin As Boolean, Invisible As Boolean)
Dim X As Long, editx As Long, Button As Long
Dim yahoobuddymain As Long
yahoobuddymain = FindWindow("yahoobuddymain", vbNullString)
Call ClickMenu(yahoobuddymain&, "C&lose")
X = FindWindow("#32770", "Login")
If X& = True Then GoTo SetText Else: Call ClickMenu(yahoobuddymain&, "&Login...")

SetText:
editx = FindWindowEx(X, 0&, "edit", vbNullString)
Call SetFocusApi(editx)
Call SendMessageByString(editx, WM_SETTEXT, 0&, UserName$)

editx = FindWindowEx(X, editx, "edit", vbNullString)
Call SetFocusApi(editx)
Call SendMessageByString(editx, WM_SETTEXT, 0&, password$)

Button& = FindWindowEx(X&, 0&, "Button", vbNullString)
If SaveID = True Then: Call SendMessage(Button&, BM_SETCHECK, True, 0&)

Button = FindWindowEx(X, Button, "button", vbNullString)

If AutoLogin = True Then: Call SendMessageLong(Button, BM_SETCHECK, True, 0&)

Button = FindWindowEx(X, 0&, "button", vbNullString)
Button = FindWindowEx(X, Button, "button", vbNullString)
Button = FindWindowEx(X, Button, "button", vbNullString)

If Invisible = True Then: Call SendMessageLong(Button, BM_SETCHECK, True, 0&)

Button = FindWindowEx(X, 0&, "button", vbNullString)
Button = FindWindowEx(X, Button, "button", vbNullString)
Button = FindWindowEx(X, Button, "button", vbNullString)
Button = FindWindowEx(X, Button, "button", vbNullString)

Call SetFocusApi(Button&)

Call pause(0.3)

Call ClickButton(Button&)
End Sub

Public Function AntiError()
Dim child As Long
child& = FindWindow("#32770", "Chat Error")
Call SendMessage(child&, WM_CLOSE, 0&, 0&)
'Closes Chat Error
End Function
Public Function AntiLagg()
Dim t As Integer
Do: DoEvents
t% = t% + 1
If t% = 50 Then Exit Do
Loop
End Function
Public Sub MassPM(List As ListBox, Message As String, Follow As Boolean)

Dim Scrll As Integer, Num As Integer, Str As String

Num% = 0

For Scrll% = 0 To List.ListCount - 1
    Str$ = List.List(Scrll%)

        If Num% >= 5 Then
            pause (3)
            Num% = 0
        End If
        If Follow = True Then: Call SendPM(Str$, Message$, True)
        If Follow = False Then: Call SendPM(Str$, Message$, False)
        pause (0.2)
    Num% = Num% + 1
    DoEvents
Next

End Sub
Public Sub MassPMBoot(List As ListBox, Message As String, anti As Boolean)

Dim Scrll As Integer, Num As Integer, Str As String

Num% = 0

For Scrll% = 0 To List.ListCount - 1
    Str$ = List.List(Scrll%)

        If Num% >= 5 Then
            pause (3)
            Num% = 0
        End If
        If anti = True Then: Call SendPMBoot(Str$, Message$, True, False)
        'Determins what the boolean's are set to.
        If anti = False Then: Call SendPMBoot(Str$, Message$, False, False)
        pause (0.2)
    Num% = Num% + 1
    DoEvents
Next

End Sub

Function GetChatName()
Dim imclass As Long
Dim Str As String
imclass& = FindWindow(imclass&, vbNullString)
Str$ = GetCaption(imclass&)
'Get's Caption
GetChatName = Replace(Str$, "-- Chat", "")
'Get's Caption Filterd and returns caption w/ out Chat
End Function
Function GetPMName()
Dim imclass As Long
Dim Str As String
imclass& = FindWindow(imclass&, vbNullString)
Str$ = GetCaption(imclass&)
GetChatName = Replace(Str$, "-- Instant Message", "")
End Function
Function lagg(TheText As String)
'ex: call sendtext(lagg(UnSaKreD))
Dim G As String, a As String
Dim W As Long
Dim r$
Dim U$
Dim t$
Dim p$
G$ = TheText
Dim s$
a = Len(G$)
For W = 1 To a Step 4
    r$ = Mid$(G$, W, 1)
    U$ = Mid$(G$, W + 1, 1)
    s$ = Mid$(G$, W + 2, 1)
    t$ = Mid$(G$, W + 3, 1)
    p$ = p$ & "<html></<html></html><html></html><html></html><html></html>" & r$ & "<html></<html></html><html></html><html></html><html></html>" & U$ & "<html></<html></html><html></html><html></html><html></html>" & s$ & "<html></<html></html><html></html><html></html><html></html>" & t$
Next W
lagg = p$
End Function
Sub Y_BudList_Caption(Caption$)
'changes the caption of your buddylist
'window
Dim yahoobudlist As Long
Dim setcaption As Long
yahoobudlist = FindWindow("YahooBuddyMain", vbNullString)
setcaption = SendMessageByString(yahoobudlist, WM_SETTEXT, 0, Caption$)
End Sub

Sub Form_ExitDown(Form As Form)
'Gives your form that cool flying down effect
Do Until Form.Top >= 13000
Form.Top = Trim(Str(Int(Form.Top) + 175))
Loop
Unload Form
End Sub

Sub Form_ExitColapse(Form As Form)
'Colapses you form to the center if your screen
Dim counter As Integer
Dim i As Integer
counter = Form.Height
Do: DoEvents
counter = counter - 10
Form.Height = counter
Form.Top = (Screen.Height - Form.Height) / 2
Loop Until counter <= 10
i = 15
counter = Form.Width
Do: DoEvents
counter = counter + i
Form.Width = counter
Form.Left = (Screen.Width - Form.Width) / 2
i = i + 1
Loop Until counter >= Screen.Width
Unload Form
End Sub

Sub Form_ExitRight(Form As Form)
'Makes your form fly right
Do Until Form.Left >= 13000
Form.Left = Trim(Str(Int(Form.Left) + 175))
Loop
Unload Form
End Sub
Sub NewChatSend(what$)
Dim imclass As Long, RichEdit As Long
imclass = FindWindow("imclass", vbNullString)
RichEdit = FindWindowEx(imclass, 0&, "richedit", vbNullString)
Call SendMessageByString(RichEdit, WM_SETTEXT, 0&, what$)
ClickSend
End Sub

Sub ClickSend()
Dim imclass As Long, Button As Long
imclass = FindWindow("imclass", vbNullString)
Button = FindWindowEx(imclass, 0&, "button", vbNullString)
Button = FindWindowEx(imclass, Button, "button", vbNullString)
Call SendMessageLong(Button, WM_KEYDOWN, VK_SPACE, 0&)
Call SendMessageLong(Button, WM_KEYUP, VK_SPACE, 0&)
End Sub
Sub NewChatBoot(Code$)
Anti2
CloseWindow2
Dim parent As Long, Child1 As Long, Child2 As Long
parent& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(parent&), LCase("-- instant message")) Then: Exit Sub
Call SetFocusApi(parent&)
Child2& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)
Call SendMessageByString(Child2&, WM_SETTEXT, 0, Code$)
Call ClickMenu(parent&, "Sen&d")
End Sub

Sub CloseWindow2()
Dim imclass As Long, RichEdit As Long
imclass = FindWindow("imclass", vbNullString)
RichEdit = FindWindowEx(imclass, 0&, "richedit", vbNullString)
RichEdit = FindWindowEx(imclass, RichEdit, "richedit", vbNullString)
Call SendMessageLong(RichEdit, WM_CLOSE, 0&, 0&)
End Sub
Sub voiceboot()
Dim yahoobuddymain As Long, parent As Long, Child1 As Long, Child2 As Long
yahoobuddymain = FindWindow("yahoobuddymain", vbNullString)
Call ClickMenu(yahoobuddymain&, "Send a &Message")
End Sub


Sub NEWBOOT(Code$)
Anti2
NewAnti
ClosedaWindow
Closeewindow
Dim parent As Long, Child1 As Long, Child2 As Long
parent& = FindWindow("IMClass", vbNullString)
If InStr(GetCaption(parent&), LCase("-- instant message")) Then: Exit Sub
Call SetFocusApi(parent&)
Child2& = FindWindowEx(parent&, 0&, "RICHEDIT", vbNullString)
Call SendMessageByString(Child2&, WM_SETTEXT, 0, Code$)
Call ClickMenu(parent&, "Sen&d")
End Sub
Sub ClosedaWindow()
Dim imclass As Long, atleeb As Long
imclass = FindWindow("imclass", vbNullString)
atleeb = FindWindowEx(imclass, 0&, "atl:004eeb20", vbNullString)
Call SendMessageLong(atleeb, WM_CLOSE, 0&, 0&)
End Sub
Sub pmblock()
Dim imclass As Long
imclass = FindWindow("imclass", vbNullString)
Call SendMessageLong(imclass, WM_CLOSE, 0&, 0&)
End Sub
Function YGetName()
Dim imclass As Long
imclass = FindWindow("imclass", vbNullString)
Dim TheText As String, TL As Long
TL = SendMessageLong(imclass, WM_GETTEXTLENGTH, 0&, 0&)
TheText = String(TL + 1, " ")
Call SendMessageByString(imclass, WM_gettext, TL + 1, TheText)
TheText = Left(TheText, TL)
Dim trimmed
Dim lenght As Integer
Dim Chat As String, Char As String
Chat = TheText
Char = InStr(Chat, " -- ")
trimmed = Left(Chat, Char)
trimmed = Trim(trimmed)
YGetName = trimmed
End Function
Public Sub Menu_Run(lngwindow As Long, strmenutext As String)
'Runs Menus
'Thank you unsakred
Dim intLoop As Integer, intSubLoop As Integer, intSub2Loop As Integer, intSub3Loop As Integer, intSub4Loop As Integer
Dim lngmenu(1 To 5) As Long
Dim lngcount(1 To 5) As Long
Dim lngSubMenuID(1 To 4) As Long
Dim strcaption(1 To 4) As String
    lngmenu(1) = GetMenu(lngwindow&)
    lngcount(1) = GetMenuItemCount(lngmenu(1))
        For intLoop% = 0 To lngcount(1) - 1
            
            DoEvents
            lngmenu(2) = GetSubMenu(lngmenu(1), intLoop%)
            lngcount(2) = GetMenuItemCount(lngmenu(2))
                For intSubLoop% = 0 To lngcount(2) - 1
                    DoEvents
                    lngSubMenuID(1) = GetMenuItemID(lngmenu(2), intSubLoop%)
                    strcaption(1) = String(75, " ")
                    Call GetMenuString(lngmenu(2), lngSubMenuID(1), strcaption(1), 75, 1)
                        If InStr(LCase(strcaption(1)), LCase(strmenutext$)) Then
                            Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(1), 0)
                            Exit Sub
                        End If
                    lngmenu(3) = GetSubMenu(lngmenu(2), intSubLoop%)
                    lngcount(3) = GetMenuItemCount(lngmenu(3))
                        If lngcount(3) > 0 Then
                            For intSub2Loop% = 0 To lngcount(3) - 1
                                DoEvents
                                lngSubMenuID(2) = GetMenuItemID(lngmenu(3), intSub2Loop%)
                                strcaption(2) = String(75, " ")
                                Call GetMenuString(lngmenu(3), lngSubMenuID(2), strcaption(2), 75, 1)
                                    If InStr(LCase(strcaption(2)), LCase(strmenutext$)) Then
                                        Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(2), 0)
                                        Exit Sub
                                    End If
                                lngmenu(4) = GetSubMenu(lngmenu(3), intSub2Loop%)
                                lngcount(4) = GetMenuItemCount(lngmenu(4))
                                    If lngcount(4) > 0 Then
                                        For intSub3Loop% = 0 To lngcount(4) - 1
                                            DoEvents
                                            lngSubMenuID(3) = GetMenuItemID(lngmenu(4), intSub3Loop%)
                                            strcaption(3) = String(75, " ")
                                            Call GetMenuString(lngmenu(4), lngSubMenuID(3), strcaption(3), 75, 1)
                                                If InStr(LCase(strcaption(3)), LCase(strmenutext$)) Then
                                                    Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(3), 0)
                                                    Exit Sub
                                                End If
                                            lngmenu(5) = GetSubMenu(lngmenu(4), intSub3Loop%)
                                            lngcount(5) = GetMenuItemCount(lngmenu(5))
                                                If lngcount(5) > 0 Then
                                                    For intSub4Loop% = 0 To lngcount(5) - 1
                                                        DoEvents
                                                        lngSubMenuID(4) = GetMenuItemID(lngmenu(5), intSub4Loop%)
                                                        strcaption(4) = String(75, " ")
                                                        Call GetMenuString(lngmenu(5), lngSubMenuID(4), strcaption(4), 75, 1)
                                                            If InStr(LCase(strcaption(4)), LCase(strmenutext$)) Then
                                                                Call SendMessage(lngwindow&, WM_COMMAND, lngSubMenuID(4), 0)
                                                                Exit Sub
                                                            End If
                                                    Next intSub4Loop%
                                                End If
                                        Next intSub3Loop%
                                    End If
                            Next intSub2Loop%
                        End If
                Next intSubLoop%
        Next intLoop%
End Sub
Sub Closeewindow()
Dim imclass As Long, atlebb As Long
imclass = FindWindow("imclass", vbNullString)
atlebb = FindWindowEx(imclass, 0&, "atl:004ebb50", vbNullString)
Call SendMessageLong(atlebb, WM_CLOSE, 0&, 0&)
End Sub

Sub FIRSTBETA5BOOT()

End Sub
Sub FadeFormYellow(vForm As Form)
'Example:
'Private Sub Form_Paint()
'FadeFormYellow Me
'End Sub
    On Error Resume Next
    Dim intLoop As Integer
    vForm.DrawStyle = vbInsideSolid
    vForm.DrawMode = vbCopyPen
    vForm.ScaleMode = vbPixels
    vForm.DrawWidth = 2
    vForm.ScaleHeight = 256
    For intLoop = 0 To 255
        vForm.Line (0, intLoop)-(Screen.Width, intLoop - 1), RGB(255 - intLoop, 255 - intLoop, 0), B
    Next intLoop
End Sub
Sub FadeFormBlue(vForm As Form)
'Example:
'Private Sub Form_Paint()
'FadeFormBlue Me
'End Sub
    On Error Resume Next
    Dim intLoop As Integer
    vForm.DrawStyle = vbInsideSolid
    vForm.DrawMode = vbCopyPen
    vForm.ScaleMode = vbPixels
    vForm.DrawWidth = 2
    vForm.ScaleHeight = 256
    For intLoop = 0 To 255
        vForm.Line (0, intLoop)-(Screen.Width, intLoop - 1), RGB(0, 0, 255 - intLoop), B
    Next intLoop
End Sub
Sub FadeFormGrey(vForm As Form)
'Example:
'Private Sub Form_Paint()
'FadeFormGrey Me
'End Sub
    On Error Resume Next
    Dim intLoop As Integer
    vForm.DrawStyle = vbInsideSolid
    vForm.DrawMode = vbCopyPen
    vForm.ScaleMode = vbPixels
    vForm.DrawWidth = 2
    vForm.ScaleHeight = 256
    For intLoop = 0 To 255
        vForm.Line (0, intLoop)-(Screen.Width, intLoop - 1), RGB(255 - intLoop, 255 - intLoop, 255 - intLoop), B
    Next intLoop
End Sub
Sub FadeFormGreen(vForm As Form)
'Example:
'Private Sub Form_Paint()
'FadeFormGreen Me
'End Sub

On Error Resume Next
    Dim intLoop As Integer
    vForm.DrawStyle = vbInsideSolid
    vForm.DrawMode = vbCopyPen
    vForm.ScaleMode = vbPixels
    vForm.DrawWidth = 2
    vForm.ScaleHeight = 256
    For intLoop = 0 To 255
        vForm.Line (0, intLoop)-(Screen.Width, intLoop - 1), RGB(0, 255 - intLoop, 0), B
    Next intLoop
End Sub
Sub FadeFormRed(vForm As Form)
'Example:
'Private Sub Form_Paint()
'FadeFormRed Me
'End Sub
    On Error Resume Next
    Dim intLoop As Integer
    vForm.DrawStyle = vbInsideSolid
    vForm.DrawMode = vbCopyPen
    vForm.ScaleMode = vbPixels
    vForm.DrawWidth = 2
    vForm.ScaleHeight = 256
    For intLoop = 0 To 255
        vForm.Line (0, intLoop)-(Screen.Width, intLoop - 1), RGB(255 - intLoop, 0, 0), B
    Next intLoop
End Sub
Sub FadeFormPurple(vForm As Form)
'Example:
'Private Sub Form_Paint()
'FadeFormPurple Me
'End Sub
    On Error Resume Next
    Dim intLoop As Integer
    vForm.DrawStyle = vbInsideSolid
    vForm.DrawMode = vbCopyPen
    vForm.ScaleMode = vbPixels
    vForm.DrawWidth = 2
    vForm.ScaleHeight = 256
    For intLoop = 0 To 255
        vForm.Line (0, intLoop)-(Screen.Width, intLoop - 1), RGB(255 - intLoop, 0, 255 - intLoop), B
    Next intLoop
End Sub
Public Sub ClipboardCopy(Text As String)
'Copies text to the clipboard
'Call Clipboardcopy("NewText")
'or possibly
'Call Clipboardcopy(text1.text)
On Error GoTo Error
Clipboard.Clear
Clipboard.SetText Text$
Exit Sub
Error:  MsgBox Err.Description, vbExclamation, "Error"
End Sub


Public Function getcrypt(passwd As String)

Dim ts As String
ts = Space$(50)
Dim X As Long
Dim saltc As String
saltc = "_2S43d5f"
X = venkymd5crypt(passwd, saltc, ts)
getcrypt = ts
End Function
Function Bot_Lamerizer(Nam As String)
'Makes fun of someone in a chat
'Example:
'Call Bot_Lamerizer(Text1.Text)
Dim X As Integer, lcse As String, letr As String, dis As String
SendChat "<b>Lamerizer Bot: Todays lamer is... " + Nam$
pause (0.4)

For X = 1 To Len(Nam)
lcse$ = LCase(Nam)
letr$ = Mid(lcse$, X, 1)
If letr$ = "a" Then Let dis$ = "a-is for the animals your momma fucks": GoTo Dissem
If letr$ = "b" Then Let dis$ = "b-is for all the boys you love": GoTo Dissem
If letr$ = "c" Then Let dis$ = "c-is for the cunt you are": GoTo Dissem
If letr$ = "d" Then Let dis$ = "d-is for all the times your dissed": GoTo Dissem
If letr$ = "e" Then Let dis$ = "e-is for that egghead of yours": GoTo Dissem
If letr$ = "f" Then Let dis$ = "f-is for the friday nights you stay home": GoTo Dissem
If letr$ = "g" Then Let dis$ = "g-is for the girls who hate you": GoTo Dissem
If letr$ = "h" Then Let dis$ = "h-is for the ho your momma is": GoTo Dissem
If letr$ = "i" Then Let dis$ = "i-is for the idiotic dumbass you are": GoTo Dissem
If letr$ = "j" Then Let dis$ = "j-is for all the times you jerkoff to your dog": GoTo Dissem
If letr$ = "k" Then Let dis$ = "k-is for you self esteem that the cool kids killed": GoTo Dissem
If letr$ = "l" Then Let dis$ = "l-is for the lame ass you are": GoTo Dissem
If letr$ = "m" Then Let dis$ = "m-is for the many men you sucked": GoTo Dissem
If letr$ = "n" Then Let dis$ = "n-is for the nights you spent alone": GoTo Dissem
If letr$ = "o" Then Let dis$ = "o-is for the sex operation you had": GoTo Dissem
If letr$ = "p" Then Let dis$ = "p-is for the times people p on you": GoTo Dissem
If letr$ = "q" Then Let dis$ = "q-is for the queer you are": GoTo Dissem
If letr$ = "r" Then Let dis$ = "r-is for all the times i raped your sister": GoTo Dissem
If letr$ = "s" Then Let dis$ = "s-is for the sex u get from ur dad": GoTo Dissem
If letr$ = "t" Then Let dis$ = "t-is for the tits youll never see": GoTo Dissem
If letr$ = "u" Then Let dis$ = "u-is for your underwear hangin on the flagpole": GoTo Dissem
If letr$ = "v" Then Let dis$ = "v-is for the victories you'll never have": GoTo Dissem
If letr$ = "w" Then Let dis$ = "w-is for the 400 pounds you wiegh":  GoTo Dissem
If letr$ = "x" Then Let dis$ = "x-is for all the lamers who" & Chr(34) & "[x]'ed" & Chr(34) & " you online": GoTo Dissem
If letr$ = "y" Then Let dis$ = "y-is for the question of, y your even alive?": GoTo Dissem
If letr$ = "z" Then Let dis$ = "z-is for zero which is what you are":  GoTo Dissem

If letr$ = "1" Then Let dis$ = "1-is for how many inches your dick is": GoTo Dissem
If letr$ = "2" Then Let dis$ = "2-is for the 2 dollars you make an hour": GoTo Dissem
If letr$ = "3" Then Let dis$ = "3-is for the amount of men your girl takes at once": GoTo Dissem
If letr$ = "4" Then Let dis$ = "4-is for your mom bein a whore":  GoTo Dissem
If letr$ = "5" Then Let dis$ = "5-is for 5 times an hour you whack off": GoTo Dissem
If letr$ = "6" Then Let dis$ = "6-is for the years you been single": GoTo Dissem
If letr$ = "7" Then Let dis$ = "7-is for the times your girl cheated on you..with me": GoTo Dissem
If letr$ = "8" Then Let dis$ = "8-is for how many people beat the hell outta you today": GoTo Dissem
If letr$ = "9" Then Let dis$ = "9-is for how many boyfriends your momma has": GoTo Dissem
If letr$ = "0" Then Let dis$ = "0-is for the amount of girls you get": GoTo Dissem

Dissem:
Call SendChat(dis$)
pause (0.4)
Next X
End Function
Sub Anti2()
Dim imclass As Long, atlefb As Long
imclass = FindWindow("imclass", vbNullString)
atlefb = FindWindowEx(imclass, 0&, "atl:004efb68", vbNullString)
Call SendMessageLong(atlefb, WM_CLOSE, 0&, 0&)
End Sub


