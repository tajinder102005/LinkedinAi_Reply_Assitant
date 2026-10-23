Add-Type -AssemblyName System.Drawing

$destDirs = @(
    "E:\email_ai_reply_extension\linkedin_extension\extension\public\icons"
)

# LinkedIn Brand Blue: #0a66c2
$bgColor = [System.Drawing.Color]::FromArgb(10, 102, 194)
$textColor = [System.Drawing.Color]::White

function Create-RoundedRectanglePath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2

    $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
    $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function Generate-Icon([int]$size, [string]$text, [float]$fontSize, [string]$fontName, [string]$outPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded rectangle badge
    $radius = [float]($size * 0.22)
    $rectPath = Create-RoundedRectanglePath 0 0 ($size) ($size) $radius
    $bgBrush = New-Object System.Drawing.SolidBrush($bgColor)
    $g.FillPath($bgBrush, $rectPath)

    # Draw "inAI" text in white
    $font = New-Object System.Drawing.Font($fontName, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush($textColor)

    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

    $layoutRect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $g.DrawString($text, $font, $textBrush, $layoutRect, $stringFormat)

    $font.Dispose()
    $textBrush.Dispose()
    $bgBrush.Dispose()
    $rectPath.Dispose()
    $g.Dispose()

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated: $outPath"
}

foreach ($dir in $destDirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    Generate-Icon 128 "inAI" 36 "Segoe UI" (Join-Path $dir "icon128.png")
    Generate-Icon 48 "inAI" 14 "Segoe UI" (Join-Path $dir "icon48.png")
    Generate-Icon 16 "in" 10 "Segoe UI" (Join-Path $dir "icon16.png")
}

Write-Output "LinkedIn AI icons created successfully!"
