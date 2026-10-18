$files = Get-ChildItem -Filter *.html | Where-Object { $_.Name -ne 'index.html' }
foreach ($f in $files) {
    $text = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $text = $text -replace '<script>\s*appMode = ''(.*?)'';\s*if \(typeof toggleNavButtons === ''function''\) toggleNavButtons\(\);\s*if \(typeof openWindow === ''function''\) openWindow\(''(.*?)''\);\s*</script>', '<script>window.addEventListener("DOMContentLoaded", () => { appMode = "$1"; if (typeof toggleNavButtons === "function") toggleNavButtons(); if (typeof openWindow === "function") openWindow("$2"); });</script>'
    [System.IO.File]::WriteAllText($f.FullName, $text, [System.Text.Encoding]::UTF8)
    Write-Host "Fixed inline script for $($f.Name)"
}
