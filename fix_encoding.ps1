$files = Get-ChildItem -Filter *.html
foreach ($f in $files) {
    $text = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
    $bytes = [System.Text.Encoding]::GetEncoding(1252).GetBytes($text)
    $fixedText = [System.Text.Encoding]::UTF8.GetString($bytes)
    [System.IO.File]::WriteAllText($f.FullName, $fixedText, [System.Text.Encoding]::UTF8)
    Write-Host "Fixed encoding for $($f.Name)"
}
