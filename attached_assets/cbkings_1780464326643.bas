Attribute VB_Name = "ColdBloodedking"
'This Bas File Was Written By Cold Blooded King
'Yahoo! ID: Not Given
'(just gave ColdBloodedKing's account to my friend)
'Nick Name: Cold Blooded King a.k.a. G-host
'About:
'This Bas File Was Made For Yahoo! 5
'With this bas, u can build a Full Program for yahoo
'Ex: Chat/PM boot, list booter, Invite Bomb, Voice Bomb,
'Lamerizer, Profiler, Talkers, Scroller and more......
'
'HAVE FUN

Option Explicit
Private Declare Function CloseHandle Lib "kernel32" (ByVal hObject As Long) As Long
Declare Function mciGetErrorString Lib "winmm.dll" Alias "mciGetErrorStringA" (ByVal dwError As Long, ByVal lpstrBuffer As String, ByVal uLength As Long) As Long
Public Declare Sub CopyMemory Lib "kernel32" Alias "RtlMoveMemory" (Destination As Any, Source As Any, ByVal Length As Long)
Public Declare Function EnableWindow Lib "user32" (ByVal hWnd As Long, ByVal fEnable As Long) As Long
Public Declare Function FindWindow Lib "user32" Alias "FindWindowA" (ByVal lpClassName As String, ByVal lpWindowName As String) As Long
Public Declare Function FindWindowEx Lib "user32" Alias "FindWindowExA" (ByVal hWnd1 As Long, ByVal hWnd2 As Long, ByVal lpsz1 As String, ByVal lpsz2 As String) As Long
Public Declare Function GetCursorPos Lib "user32" (lpPoint As POINTAPI) As Long
Public Declare Function GetMenu Lib "user32" (ByVal hWnd As Long) As Long
Public Declare Function GetMenuItemCount Lib "user32" (ByVal hMenu As Long) As Long
Public Declare Function GetMenuItemID Lib "user32" (ByVal hMenu As Long, ByVal nPos As Long) As Long
Public Declare Function GetMenuString Lib "user32" Alias "GetMenuStringA" (ByVal hMenu As Long, ByVal wIDItem As Long, ByVal lpString As String, ByVal nMaxCount As Long, ByVal wFlag As Long) As Long
Public Declare Function GetPrivateProfileString Lib "kernel32" Alias "GetPrivateProfileStringA" (ByVal lpApplicationName As String, ByVal lpKeyName As Any, ByVal lpDefault As String, ByVal lpReturnedString As String, ByVal nSize As Long, ByVal lpFileName As String) As Long
Public Declare Function GetSubMenu Lib "user32" (ByVal hMenu As Long, ByVal nPos As Long) As Long
Public Declare Function GetWindowText Lib "user32" Alias "GetWindowTextA" (ByVal hWnd As Long, ByVal lpString As String, ByVal cch As Long) As Long
Public Declare Function GetWindowTextLength Lib "user32" Alias "GetWindowTextLengthA" (ByVal hWnd As Long) As Long
Public Declare Function GetWindowThreadProcessId Lib "user32" (ByVal hWnd As Long, lpdwProcessId As Long) As Long
Public Declare Function IsWindowVisible Lib "user32" (ByVal hWnd As Long) As Long
Public Declare Function OpenProcess Lib "kernel32" (ByVal dwDesiredAccess As Long, ByVal bInheritHandle As Long, ByVal dwProcessId As Long) As Long
Public Declare Function mciSendString Lib "winmm.dll" Alias "mciSendStringA" (ByVal lpstrCommand As String, ByVal lpstrReturnString As String, ByVal uReturnLength As Long, ByVal hwndCallback As Long) As Long
Public Declare Function PostMessage Lib "user32" Alias "PostMessageA" (ByVal hWnd As Long, ByVal wMsg As Long, ByVal wParam As Long, ByVal lParam As Long) As Long
Public Declare Function ReadProcessMemory Lib "kernel32" (ByVal hProcess As Long, ByVal lpBaseAddress As Long, ByVal lpBuffer As String, ByVal nSize As Long, ByRef lpNumberOfBytesWritten As Long) As Long
Public Declare Function SendMessage Lib "user32" Alias "SendMessageA" (ByVal hWnd As Long, ByVal wMsg As Long, ByVal wParam As Long, lParam As Any) As Long
Public Declare Function SendMessageLong& Lib "user32" Alias "SendMessageA" (ByVal hWnd As Long, ByVal wMsg As Long, ByVal wParam As Long, ByVal lParam As Long)
Public Declare Function SendMessageByString Lib "user32" Alias "SendMessageA" (ByVal hWnd As Long, ByVal wMsg As Long, ByVal wParam As Long, ByVal lParam As String) As Long
Public Declare Function SetCursorPos Lib "user32" (ByVal x As Long, ByVal Y As Long) As Long
Public Declare Function SetWindowPos Lib "user32" (ByVal hWnd As Long, ByVal hWndInsertAfter As Long, ByVal x As Long, ByVal Y As Long, ByVal cx As Long, ByVal cy As Long, ByVal wFlags As Long) As Long
Public Declare Function ShowCursor Lib "user32" (ByVal bShow As Long) As Long
Public Declare Function ShowWindow Lib "user32" (ByVal hWnd As Long, ByVal nCmdShow As Long) As Long
Public Declare Function sndPlaySound Lib "winmm.dll" Alias "sndPlaySoundA" (ByVal lpszSoundName As String, ByVal uFlags As Long) As Long
Public Declare Function ReleaseCapture Lib "user32" () As Long
Public Declare Function WritePrivateProfileString Lib "kernel32" Alias "WritePrivateProfileStringA" (ByVal lpApplicationName As String, ByVal lpKeyName As Any, ByVal lpString As Any, ByVal lpFileName As String) As Long
Declare Function SetParent Lib "user32" (ByVal hWndChild As Long, ByVal hWndNewParent As Long) As Long
Declare Function ShellExecute Lib "shell32.dll" Alias "ShellExecuteA" (ByVal hWnd As Long, ByVal lpOperation As String, ByVal lpFile As String, ByVal lpParameters As String, ByVal lpDirectory As String, ByVal nShowCmd As Long) As Long
Public Const BM_GETCHECK = &HF0
Public Const BM_SETCHECK = &HF1
Public Const HWND_NOTOPMOST = -2
Public Const HWND_TOPMOST = -1
Public Const LB_GETCOUNT = &H18B
Public Const LB_GETITEMDATA = &H199
Public Const LB_GETTEXT = &H189
Public Const LB_GETTEXTLEN = &H18A
Public Const LB_SETCURSEL = &H186
Public Const LB_SETSEL = &H185
Public Const SND_ASYNC = &H1
Public Const SND_NODEFAULT = &H2
Public Const SND_FLAG = SND_ASYNC Or SND_NODEFAULT
Public Const SW_HIDE = 0
Public Const SW_SHOW = 5
Public Const SWP_NOMOVE = &H2
Public Const SWP_NOSIZE = &H1
Public Const VK_DOWN = &H28
Public Const VK_LEFT = &H25
Public Const VK_MENU = &H12
Public Const VK_RETURN = &HD
Public Const VK_RIGHT = &H27
Public Const VK_SHIFT = &H10
Public Const VK_SPACE = &H20
Public Const VK_UP = &H26
Public Const WM_CHAR = &H102
Public Const WM_CLOSE = &H10
Public Const WM_COMMAND = &H111
Public Const WM_GETTEXT = &HD
Public Const WM_GETTEXTLENGTH = &HE
Public Const SW_NORMAL = 1
Public Const WM_KEYDOWN = &H100
Public Const WM_KEYUP = &H101
Public Const WM_LBUTTONDBLCLK = &H203
Public Const WM_LBUTTONDOWN = &H201
Public Const WM_LBUTTONUP = &H202
Public Const WM_MOVE = &HF012
Public Const WM_SETTEXT = &HC
Public Const WM_SYSCOMMAND = &H112
Public Const PROCESS_READ = &H10
Public Const RIGHTS_REQUIRED = &HF0000
Public Const ENTER_KEY = 13
Public Const FLAGS = SWP_NOMOVE Or SWP_NOSIZE
Public Type POINTAPI
        x As Long
        Y As Long
End Type
Dim Voicebomb As Boolean

Sub Anti_Screen()
Dim imclass As Long, atlebb As Long, atleeb As Long
imclass = FindWindow("imclass", vbNullString)
atleeb = FindWindowEx(imclass, 0&, "atl:004eeb20", vbNullString)
Call SendMessageLong(atleeb, WM_CLOSE, 0&, 0&)
atlebb = FindWindowEx(imclass, 0&, "atl:004ebb50", vbNullString)
Call SendMessageLong(atlebb, WM_CLOSE, 0&, 0&)
atleeb = FindWindowEx(imclass, 0&, "atl:004eeb68", vbNullString)
Call SendMessageLong(atleeb, WM_CLOSE, 0&, 0&)
End Sub

Sub ChatSend(Text As String)
Dim imclass As Long, richedit As Long, Button As Long
imclass = FindWindow("imclass", vbNullString)
richedit = FindWindowEx(imclass, 0&, "richedit", vbNullString)
Call SendMessageByString(richedit, WM_SETTEXT, 0&, Text)
Call RunMenuByString(Y_GetPMWind, "Sen&d")
End Sub

Sub SendPM(who As String)
Dim x As String
x = "ymsgr:sendIM?" & who$
If ShellExecute(&O0, "Open", x, vbNullString, vbNullString, SW_NORMAL) < 33 Then
End If
End Sub

Sub Pause(interval)
Dim Current
Current = Timer
Do While Timer - Current < Val(interval)
DoEvents
Loop
End Sub

Sub RunMenuByString(Window, mnuCap)
Dim ToSearch        As Long
Dim MenuCount       As Integer
Dim FindString
Dim ToSearchSub     As Long
Dim MenuItemCount   As Integer
Dim GetString
Dim SubCount        As Long
Dim MenuString      As String
Dim GetStringMenu   As Integer
Dim MenuItem        As Long
Dim RunTheMenu      As Integer
ToSearch& = GetMenu(Window)
MenuCount% = GetMenuItemCount(ToSearch&)
For FindString = 0 To MenuCount% - 1
ToSearchSub& = GetSubMenu(ToSearch&, FindString)
MenuItemCount% = GetMenuItemCount(ToSearchSub&)
For GetString = 0 To MenuItemCount% - 1
SubCount& = GetMenuItemID(ToSearchSub&, GetString)
MenuString$ = String$(100, " ")
GetStringMenu% = GetMenuString(ToSearchSub&, SubCount&, MenuString$, 100, 1)
If InStr(UCase(MenuString$), UCase(mnuCap)) Then
MenuItem& = SubCount&
GoTo MatchString
End If
Next GetString
Next FindString
MatchString:
RunTheMenu% = SendMessage(Window, WM_COMMAND, MenuItem&, 0)
End Sub

Sub Y_chat_close()
Call RunMenuByString(Y_GetPMWind, "&Close")
End Sub

Function Y_GetPMWind()
Y_GetPMWind = FindWindow("imclass", vbNullString)
End Function

Sub Voice()
'u can use this in voice bomb
Call RunMenuByString(Y_GetPMWind, "Enable &Voice")
End Sub

Sub invite(who$)
If GetChatPM = "Chat" Then ChatSend ("/invite " & who)
End Sub

Function Get_Caption()
Dim imclass As Long
Dim Text As String
imclass = FindWindow("imclass", vbNullString)
Dim TheText As String, TL As Long
TL = SendMessageLong(imclass, WM_GETTEXTLENGTH, 0&, 0&)
TheText = String(TL + 1, " ")
Call SendMessageByString(imclass, WM_GETTEXT, TL + 1, TheText)
TheText = Left(TheText, TL)
Get_Caption = TheText
End Function

Function GetName()
Dim x As Long
Dim A As String
A = Right(Get_Caption, 4)
If A = "Chat" Then
x = Len(Get_Caption) - 8
GetName = Left(Get_Caption, x)
Else
x = Len(Get_Caption) - 19
GetName = Left(Get_Caption, x)
End If
End Function

Function GetChatPM()
Dim imclass As Long
Dim Text As String
imclass = FindWindow("imclass", vbNullString)
Dim TheText As String, TL As Long
TL = SendMessageLong(imclass, WM_GETTEXTLENGTH, 0&, 0&)
TheText = String(TL + 1, " ")
Call SendMessageByString(imclass, WM_GETTEXT, TL + 1, TheText)
TheText = Left(TheText, TL)
GetChatPM = Right(TheText, 4)
If GetChatPM = "Chat" Then GetChatPM = "Chat"
If GetChatPM <> "Chat" Then GetChatPM = "Instant Message"
End Function

Sub Invite_Bomb(who As String) 'Use this with Timer
If GetChatPM = "Chat" Then ChatSend ("/invite " & who$)
If GetChatPM <> "Chat" Then Exit Sub
End Sub

Sub PM_Off()
'use this with "timer"
If GetChatPM <> "Chat" Then Y_chat_close
If GetChatPM = "Chat" Then Exit Sub
End Sub

Sub Voice_bomb_Start(who As String)
'don't use this Function in the Timer
Voicebomb = True
SendPM (who$)
Pause 0.5
Do
Voice
Voice
Pause 0.001
Loop Until Voicebomb = False
End Sub

Sub Voice_bomb_Stop()
Voicebomb = False
End Sub

Sub Buzz()
If GetChatPM <> "Chat" Then
'ChatSend "<ding>"
Call RunMenuByString(Y_GetPMWind, "&Buzz Friend")
End If
End Sub

Sub Buzz_Friend(who As String)
If GetChatPM <> "Chat" Then
SendPM who$
Pause 0.45
Call RunMenuByString(Y_GetPMWind, "&Buzz Friend")
'ChatSend "<ding>"  <- Another way to Buzz without Shake the Screen
End If
End Sub


Sub Y_ChangeUser(ID As String, PW As String)
On Error GoTo hell
Call Y_BudList_Caption("Yahoo! Messenger")
Call VBA.AppActivate("Yahoo! Messenger")
Call SendKeys("^O")
Call SendKeys(ID)
Call SendKeys("{tab}")
Call SendKeys(PW)
Call SendKeys("{tab}")
Call SendKeys("{tab}")
Call SendKeys("{tab}")
Call SendKeys("{tab}")
Call SendKeys("{enter}")
hell:
End Sub

Function Y_Chat_Caption(Caption$)
Dim yahoochat As Long
Dim setcaption As Long
yahoochat = FindWindow("IMclass", vbNullString)
setcaption = SendMessageByString(yahoochat, WM_SETTEXT, 0, Caption$)
End Function

Sub Y_BudList_Caption(Caption$)
Dim yahoobudlist As Long
Dim setcaption As Long
yahoobudlist = FindWindow("YahooBuddyMain", vbNullString)
setcaption = SendMessageByString(yahoobudlist, WM_SETTEXT, 0, Caption$)
End Sub

Sub Y_CloseAll_Chat_IM()
Do
Y_chat_close
Loop Until Y_GetPMWind = 0
End Sub

Sub Form_ExitColapse(Form As Form)
Dim Counter As Integer
Dim I As Integer
Counter = Form.Height
Do: DoEvents
Counter = Counter - 10
Form.Height = Counter
Form.Top = (Screen.Height - Form.Height) / 2
Loop Until Counter <= 10
I = 15
Counter = Form.Width
Do: DoEvents
Counter = Counter + I
Form.Width = Counter
Form.Left = (Screen.Width - Form.Width) / 2
I = I + 1
Loop Until Counter >= Screen.Width
Unload Form
End Sub

Public Function HideChat()
Dim YChatWnd As Long
YChatWnd& = FindWindow("YChatWnd", vbNullString)
ShowWindow YChatWnd&, 0
End Function

Public Function ShowChat()
Dim YChatWnd As Long
YChatWnd& = FindWindow("YChatWnd", vbNullString)
ShowWindow YChatWnd&, 1
End Function

Function Lamerizer(Nam As String)
Dim x As Integer, lcse As String, letr As String, dis As String
For x = 1 To Len(Nam)
lcse$ = LCase(Nam)
letr$ = Mid(lcse$, x, 1)
If letr$ = " " Then Let dis$ = " ": GoTo Dissem
If letr$ = "a" Then Let dis$ = "<b><red>a-is for the animals that fucks your mama": GoTo Dissem
If letr$ = "b" Then Let dis$ = "<b><red>b-is for all the boys you love": GoTo Dissem
If letr$ = "c" Then Let dis$ = "<b><red>c-is for the cocks u sucked": GoTo Dissem
If letr$ = "d" Then Let dis$ = "<b><red>d-is for all the times your dissed": GoTo Dissem
If letr$ = "e" Then Let dis$ = "<b><red>e-is for that egghead of yours": GoTo Dissem
If letr$ = "f" Then Let dis$ = "<b><red>f-is for the for the time you fuck your mom": GoTo Dissem
If letr$ = "g" Then Let dis$ = "<b><red>g-is for the gays who rape you": GoTo Dissem
If letr$ = "h" Then Let dis$ = "<b><red>h-is for the ho your momma is": GoTo Dissem
If letr$ = "i" Then Let dis$ = "<b><red>i-is for the idiotic dumbass you are": GoTo Dissem
If letr$ = "j" Then Let dis$ = "<b><red>j-is for all the times you jerkoff to your cat": GoTo Dissem
If letr$ = "k" Then Let dis$ = "<b><red>k-is for you self esteem that the cool kids killed": GoTo Dissem
If letr$ = "l" Then Let dis$ = "<b><red>l-is for the lame ass you are": GoTo Dissem
If letr$ = "m" Then Let dis$ = "<b><red>m-is for the many men you sucked": GoTo Dissem
If letr$ = "n" Then Let dis$ = "<b><red>n-is for the nights you spent alone": GoTo Dissem
If letr$ = "o" Then Let dis$ = "<b><red>o-is for the sex operation you had": GoTo Dissem
If letr$ = "p" Then Let dis$ = "<b><red>p-is for the times people pee on you": GoTo Dissem
If letr$ = "q" Then Let dis$ = "<b><red>q-is for the queer you are": GoTo Dissem
If letr$ = "r" Then Let dis$ = "<b><red>r-is for all the times you raped your pig!": GoTo Dissem
If letr$ = "s" Then Let dis$ = "<b><red>s-is for your lover Steve Case": GoTo Dissem
If letr$ = "t" Then Let dis$ = "<b><red>t-is for the tits youll never see": GoTo Dissem
If letr$ = "u" Then Let dis$ = "<b><red>u-is for your underwear hangin on the flagpole": GoTo Dissem
If letr$ = "v" Then Let dis$ = "<b><red>v-is for the victories you'll never have": GoTo Dissem
If letr$ = "w" Then Let dis$ = "<b><red>w-is for the 400 pounds your ass wiegh":  GoTo Dissem
If letr$ = "x" Then Let dis$ = "<b><red>x-is for all the lamers who" & Chr(34) & "[x]'ed" & Chr(34) & " you online": GoTo Dissem
If letr$ = "y" Then Let dis$ = "<b><red>y-is for the question of, why your even alive?": GoTo Dissem
If letr$ = "z" Then Let dis$ = "<b><red>z-is for zero which is what you are":  GoTo Dissem
If letr$ = "_" Then Let dis$ = "<b><red>_ U so dumb u got put a line between ur name"
If letr$ = "1" Then Let dis$ = "<b><red>1-is for how many inches your dick is": GoTo Dissem
If letr$ = "2" Then Let dis$ = "<b><red>2-is for the 2 cents you make a year": GoTo Dissem
If letr$ = "3" Then Let dis$ = "<b><red>3-is for the amount of dicks you can suck at one": GoTo Dissem
If letr$ = "4" Then Let dis$ = "<b><red>4-is for your mom bein a slut":  GoTo Dissem
If letr$ = "5" Then Let dis$ = "<b><red>5-is for 5 times an hour you whack off": GoTo Dissem
If letr$ = "6" Then Let dis$ = "<b><red>6-is for the years you been single": GoTo Dissem
If letr$ = "7" Then Let dis$ = "<b><red>7-is for the times your girl cheated on you..with me": GoTo Dissem
If letr$ = "8" Then Let dis$ = "<b><red>8-is for how many people beat the hell outta you today": GoTo Dissem
If letr$ = "9" Then Let dis$ = "<b><red>9-is for amount of gays fucks you everynigh": GoTo Dissem
If letr$ = "0" Then Let dis$ = "<b><red>0-is for the amount of girls you get": GoTo Dissem
Dissem:
Call ChatSend(dis$)
Pause 0.8
Next x
End Function

Function Y_GetMainWind()
Y_GetMainWind = FindWindow("YahooBuddyMain", vbNullString)
End Function

Sub Y_Hide_BudList()
Dim yahoobudlist As Long
yahoobudlist = FindWindow("YahooBuddyMain", vbNullString)
Call ShowWindow(yahoobudlist, SW_HIDE)
End Sub

Sub Y_Show_BudList()
Dim yahoobudlist As Long
yahoobudlist = FindWindow("YahooBuddyMain", vbNullString)
Call ShowWindow(yahoobudlist, SW_SHOW)
End Sub

Public Sub StayOnTop(frm As Form)
Call SetWindowPos(frm.hWnd, HWND_TOPMOST, 0, 0, 0, 0, FLAGS)
End Sub

Sub Y_BudList_Enable()
Dim yahoobuddymain As Long
yahoobuddymain = FindWindow("yahoobuddymain", vbNullString)
Call EnableWindow(yahoobuddymain, 1)
End Sub

Sub Y_BudList_Disable()
Dim yahoobuddymain As Long
yahoobuddymain = FindWindow("yahoobuddymain", vbNullString)
Call EnableWindow(yahoobuddymain, 0)
End Sub

Public Sub Y_ListBoot(List As ListBox)
Dim Scrll As Integer, Num As Integer, Str As String
Num% = 0
For Scrll% = 0 To List.ListCount - 1
Str$ = List.List(Scrll%)
If Num% >= 5 Then
Num% = 0
End If
SendPM (Str)
Pause 0.65
Anti_Screen
ChatSend ("BOOT CODE") '<= Reaplace with your own boot code
Call Y_chat_close
Num% = Num% + 1
DoEvents
Next
End Sub


Public Sub Y_ListBuzz(List As ListBox)
Dim Scrll As Integer, Num As Integer, Str As String
Num% = 0
For Scrll% = 0 To List.ListCount - 1
Str$ = List.List(Scrll%)
If Num% >= 5 Then
Num% = 0
End If
SendPM (Str)
Pause 0.5
Buzz
Y_chat_close
Num% = Num% + 1
DoEvents
Next
End Sub

Public Sub Y_Mass_PM(List As ListBox, Text As String)
Dim Scrll As Integer, Num As Integer, Str As String
Num% = 0
For Scrll% = 0 To List.ListCount - 1
Str$ = List.List(Scrll%)
If Num% >= 5 Then
Num% = 0
End If
SendPM (Str)
Pause 0.5
ChatSend Text$
Y_chat_close
Num% = Num% + 1
DoEvents
Next
End Sub

Sub Y_StatusCaption(Name As String)
Dim yahoobuddymain As Long, msctlsstatusbar As Long
yahoobuddymain = FindWindow("yahoobuddymain", vbNullString)
msctlsstatusbar = FindWindowEx(yahoobuddymain, 0&, "msctls_statusbar32", vbNullString)
Call SendMessageByString(msctlsstatusbar, WM_SETTEXT, 0&, Name)
End Sub

Sub Devil_scroll(Times As Integer)
'Call Devil_scroll(20) <-- 20 times scroll
Dim x As Integer
x = 0
Do
ChatSend (">:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) >:) ")
Pause 0.34
x = x + 1
Loop Until x = Times
End Sub

Sub Smile_scroll(Times As Integer)
'Call Smile_scroll(10) <-- 10 times scroll
Dim x As Integer
x = 0
Do
ChatSend (":) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :) :)")
Pause 0.34
x = x + 1
Loop Until x = Times
End Sub

Sub Custom_scroll(Times As Integer, Text As String)
'Call Custom_scroll(10, "SWEET!!!!!") <-- 10 times scroll with the Text SWEET!!!!!
Dim x As Integer
x = 0
Do
ChatSend Text$
Pause 0.34
x = x + 1
Loop Until x = Times
End Sub

Sub CountDown_Bot(Second As Integer)
Dim x As Integer
x = Second
Do
ChatSend (x)
Pause 0.34
x = x - 1
Loop Until x = 0
End Sub


Sub Multiline_send(Text As String)
'Send Multiline Like In Yahelite
Dim A As String
Dim x As Long
On Error GoTo hell
A = Text$
Do
ChatSend Left(A, 500)
Pause 0.34
x = Len(A) - 500
A = Right(A, x)
Loop Until A = ""
hell: A = ""
End Sub


Sub Custom_Talker(What2Say As String, custom As String)
Dim Character As String, Text As String, Width As Integer, Spacing As Integer, Talking As String, TheTalker As String
Let Text$ = What2Say$
Let Width% = Len(Text$)
Do While Spacing% <= Width%
Let Spacing% = Spacing% + 1
Let Character$ = Mid$(Text$, Spacing%, 1)
Let Character$ = Character$ + custom
Let Talking$ = Talking$ + Character$
Loop
TheTalker$ = Talking$
ChatSend TheTalker$
End Sub


Sub Talker_plus(What2Say As String)
Dim Character As String, Text As String, Width As Integer, Spacing As Integer, Talking As String, TheTalker As String
Let Text$ = What2Say$
Let Width% = Len(Text$)
Do While Spacing% <= Width%
Let Spacing% = Spacing% + 1
Let Character$ = Mid$(Text$, Spacing%, 1)
Let Character$ = Character$ + "+"
Let Talking$ = Talking$ + Character$
Loop
TheTalker$ = Talking$
ChatSend TheTalker$
End Sub

Sub Talker_Bullet(What2Say As String)
Dim Character As String, Text As String, Width As Integer, Spacing As Integer, Talking As String, TheTalker As String
Let Text$ = What2Say$
Let Width% = Len(Text$)
Do While Spacing% <= Width%
Let Spacing% = Spacing% + 1
Let Character$ = Mid$(Text$, Spacing%, 1)
Let Character$ = Character$ + "•"
Let Talking$ = Talking$ + Character$
Loop
TheTalker$ = Talking$
ChatSend TheTalker$
End Sub

Sub Talker_Bullet2(What2Say As String)
Dim Character As String, Text As String, Width As Integer, Spacing As Integer, Talking As String, TheTalker As String
Let Text$ = What2Say$
Let Width% = Len(Text$)
Do While Spacing% <= Width%
Let Spacing% = Spacing% + 1
Let Character$ = Mid$(Text$, Spacing%, 1)
Let Character$ = Character$ + "¤"
Let Talking$ = Talking$ + Character$
Loop
TheTalker$ = Talking$
ChatSend TheTalker$
End Sub

Sub Talker_Bubble(What2Say As String)
Dim Character As String, Text As String, Width As Integer, Spacing As Integer, Talking As String, TheTalker As String
Let Text$ = What2Say$
Let Width% = Len(Text$)
Do While Spacing% <= Width%
Let Spacing% = Spacing% + 1
Let Character$ = Mid$(Text$, Spacing%, 1)
Let Character$ = "(" + Character$ + ")"
Let Talking$ = Talking$ + Character$
Loop
TheTalker$ = Talking$
ChatSend TheTalker$
End Sub

Sub Talker_Link(What2Say As String)
Dim Character As String, Text As String, Width As Integer, Spacing As Integer, Talking As String, TheTalker As String
Let Text$ = What2Say$
Let Width% = Len(Text$)
Do While Spacing% <= Width%
Let Spacing% = Spacing% + 1
Let Character$ = Mid$(Text$, Spacing%, 1)
Let Character$ = Character$ + "-"
Let Talking$ = Talking$ + Character$
Loop
TheTalker$ = Talking$
ChatSend TheTalker$
End Sub

Sub Talker_Slash(What2Say As String)
Dim Character As String, Text As String, Width As Integer, Spacing As Integer, Talking As String, TheTalker As String
Let Text$ = What2Say$
Let Width% = Len(Text$)
Do While Spacing% <= Width%
Let Spacing% = Spacing% + 1
Let Character$ = Mid$(Text$, Spacing%, 1)
Let Character$ = Character$ + "/"
Let Talking$ = Talking$ + Character$
Loop
TheTalker$ = Talking$
ChatSend TheTalker$
End Sub

Sub Talker_Period(What2Say As String)
Dim Character As String, Text As String, Width As Integer, Spacing As Integer, Talking As String, TheTalker As String
Let Text$ = What2Say$
Let Width% = Len(Text$)
Do While Spacing% <= Width%
Let Spacing% = Spacing% + 1
Let Character$ = Mid$(Text$, Spacing%, 1)
Let Character$ = Character$ + "."
Let Talking$ = Talking$ + Character$
Loop
TheTalker$ = Talking$
ChatSend TheTalker$
End Sub

Sub Talker_Lowercase(What2Say As String)
ChatSend LCase(What2Say)
End Sub

Sub Talker_Upercase(What2Say As String)
ChatSend UCase(What2Say)
End Sub

Sub Talker_Backward(What2Say As String)
ChatSend StrReverse(What2Say)
End Sub

Sub Talker_Mirror(What2Say As String)
ChatSend (What2Say) & " || " & StrReverse(What2Say)
End Sub

Sub Profiler(who As String)
Call ShellExecute(&O0, "Open", "http://profiles.yahoo.com/" & who$, vbNullString, vbNullString, SW_NORMAL)
End Sub

Sub Add_Ascii(List As ListBox)
Dim A As Long, B As String
For A = 123 To 255
B = Chr(A)
List.AddItem B
Next A
End Sub

Sub ListBox_RemoveItem(List As ListBox)
If List.Text = "" Then Exit Sub
List.RemoveItem (List.ListIndex)
End Sub

Sub GoWebsite(Site As String)
If ShellExecute(&O0, "Open", Site, vbNullString, vbNullString, SW_NORMAL) < 33 Then
End If
End Sub

Sub Yahoo_Search(WhatToSearch As String)
GoWebsite ("http://search.yahoo.com/bin/search?p=" & WhatToSearch)
End Sub
