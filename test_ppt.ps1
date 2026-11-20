try {
    $ppt = New-Object -ComObject PowerPoint.Application
    Write-Host "PowerPoint COM is AVAILABLE!"
    $ppt.Quit()
} catch {
    Write-Host "PowerPoint COM error: $_"
}
