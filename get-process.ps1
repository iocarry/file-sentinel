Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinUtil {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@ -ErrorAction SilentlyContinue

$hwnd = [WinUtil]::GetForegroundWindow()
if ($hwnd -ne [IntPtr]::Zero) {
    $pidOut = 0
    [WinUtil]::GetWindowThreadProcessId($hwnd, [ref]$pidOut)
    if ($pidOut -gt 0) {
        $p = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
        if ($p) {
            @{
                Name = $p.Name + ".exe"
                Pid = $p.Id
                Path = $p.Path
                User = $env:USERNAME
            } | ConvertTo-Json -Compress
            exit
        }
    }
}

@{
    Name = "Sistema"
    Pid = 0
    Path = ""
    User = $env:USERNAME
} | ConvertTo-Json -Compress
