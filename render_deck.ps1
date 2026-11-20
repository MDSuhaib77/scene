$ErrorActionPreference = "Stop"

$pptxPath = "C:\Users\Suhaib\Downloads\pl-an-project-main\pl-an-project-main\SceneOS_Midterm_Review.pptx"
$pdfPath = "C:\Users\Suhaib\Downloads\pl-an-project-main\pl-an-project-main\SceneOS_Midterm_Review.pdf"
$slidesDir = "C:\Users\Suhaib\Downloads\pl-an-project-main\pl-an-project-main\docs\rendered_slides"

if (!(Test-Path $slidesDir)) {
    New-Item -ItemType Directory -Path $slidesDir | Out-Null
}

$ppt = New-Object -ComObject PowerPoint.Application
try {
    # Open presentation (Read-only = False, Untitled = False, WithWindow = False)
    $pres = $ppt.Presentations.Open($pptxPath, [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
    
    # 1. Export as PDF (32 = ppSaveAsPDF)
    Write-Host "Exporting to PDF: $pdfPath"
    $pres.SaveAs($pdfPath, 32)
    
    # 2. Export each slide as PNG
    Write-Host "Exporting individual slide images..."
    for ($i = 1; $i -le $pres.Slides.Count; $i++) {
        $slide = $pres.Slides.Item($i)
        $outImg = Join-Path $slidesDir ("slide_{0:D2}.png" -f $i)
        $slide.Export($outImg, "PNG", 1920, 1080)
        Write-Host "  Exported Slide $i -> $outImg"
    }
    
    $pres.Close()
    Write-Host "All slides rendered successfully!"
} finally {
    $ppt.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null
}
