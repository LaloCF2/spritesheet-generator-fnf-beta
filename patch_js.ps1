$jsFiles = Get-ChildItem -Path "js" -Filter *.js
foreach ($f in $jsFiles) {
    $text = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    
    $text = [regex]::Replace($text, "document\.getElementById\((.*?)\)\.addEventListener", "document.getElementById(`$1)?.addEventListener")
    $text = [regex]::Replace($text, "scanWrapper\.addEventListener", "scanWrapper?.addEventListener")
    $text = [regex]::Replace($text, "canvas\.addEventListener", "canvas?.addEventListener")
    $text = [regex]::Replace($text, "canvasPreview\.addEventListener", "canvasPreview?.addEventListener")
    $text = [regex]::Replace($text, "canvasPsychLive\.addEventListener", "canvasPsychLive?.addEventListener")
    
    $text = [regex]::Replace($text, "document\.getElementById\((.*?)\)\.style", "document.getElementById(`$1)?.style")
    $text = [regex]::Replace($text, "document\.getElementById\((.*?)\)\.classList", "document.getElementById(`$1)?.classList")
    $text = [regex]::Replace($text, "document\.getElementById\((.*?)\)\.value", "document.getElementById(`$1)?.value")
    $text = [regex]::Replace($text, "document\.getElementById\((.*?)\)\.textContent", "document.getElementById(`$1)?.textContent")
    $text = [regex]::Replace($text, "document\.getElementById\((.*?)\)\.innerHTML", "document.getElementById(`$1)?.innerHTML")
    
    [System.IO.File]::WriteAllText($f.FullName, $text, [System.Text.Encoding]::UTF8)
}
Write-Host "Success"
