Add-Type -AssemblyName System.Drawing

$width = 64
$height = 64
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Fundo escuro
$bgBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 13, 17, 23))
$g.FillRectangle($bgBrush, 0, 0, $width, $height)

# Pontos do Escudo
[System.Drawing.Point[]]$points = @(
    [System.Drawing.Point]::new(32, 8),
    [System.Drawing.Point]::new(54, 16),
    [System.Drawing.Point]::new(54, 34),
    [System.Drawing.Point]::new(32, 56),
    [System.Drawing.Point]::new(10, 34),
    [System.Drawing.Point]::new(10, 16)
)

# Preenchimento translúcido interno do escudo (Gradiente verde esmeralda)
$innerBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(230, 16, 185, 129))
$g.FillPolygon($innerBrush, $points)

# Borda do escudo (Ciano Neon)
$shieldPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 56, 189, 248), 5)
$shieldPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$g.DrawPolygon($shieldPen, $points)

# Checkmark central branco
$checkPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255, 255, 255, 255), 5)
$checkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$checkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawLine($checkPen, 23, 32, 29, 39)
$g.DrawLine($checkPen, 29, 39, 43, 23)

$g.Dispose()

$outputPath = "e:\Antigravity\fileshield-watcher\icon.png"
$bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Ícone de escudo criado com sucesso!"
