$content = Get-Content -Path "index.html" -Raw
$lines = $content -split "`r?`n"

$b_home = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match 'id="win-home"' }))
$b_escaner = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match 'id="win-escaner"' }))
$b_orden = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match 'id="win-orden"' }))
$b_afinador = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match 'id="win-afinador"' }))
$b_psych = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match 'id="win-psych"' }))
$b_compresor = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match 'id="win-compresor"' }))
$b_audio = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match 'id="win-audio"' }))
$b_atlas = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match 'id="win-atlas"' }))
$b_footer = [array]::IndexOf($lines, ($lines | Where-Object { $_ -match 'id="welcomeModal"' }))

$header = ($lines[0..($b_home-1)]) -join "`n"
$homeWin = ($lines[$b_home..($b_escaner-1)]) -join "`n"
$escaner = ($lines[$b_escaner..($b_orden-1)]) -join "`n"
$orden = ($lines[$b_orden..($b_afinador-1)]) -join "`n"
$afinador = ($lines[$b_afinador..($b_psych-1)]) -join "`n"
$psych = ($lines[$b_psych..($b_compresor-1)]) -join "`n"
$compresor = ($lines[$b_compresor..($b_audio-1)]) -join "`n"
$audio = ($lines[$b_audio..($b_atlas-1)]) -join "`n"
$atlas = ($lines[$b_atlas..($b_footer-1)]) -join "`n"
$footer = ($lines[$b_footer..($lines.Count-1)]) -join "`n"

$header = $header -replace 'onclick="openWindow\(''win-home''\)"', 'onclick="window.location.href=''index.html''"'

function makeFile([string]$filename, [string]$appMode, [string[]]$includeWindows, [string]$initWindow) {
    $content = $header
    foreach ($win in $includeWindows) {
        $content += "`n" + $win
    }
    
    $script = @"
    <script>
        appMode = '$appMode';
        if (typeof toggleNavButtons === 'function') toggleNavButtons();
        if (typeof openWindow === 'function') openWindow('$initWindow');
    </script>
"@

    $currentFooter = $footer -replace '</body>', "$script`n</body>"
    $content += "`n" + $currentFooter
    
    Set-Content -Path $filename -Value $content -Encoding UTF8
    Write-Host "Created $filename"
}

makeFile -filename 'escaner.html' -appMode 'SCAN' -includeWindows @($escaner, $orden, $afinador) -initWindow 'win-escaner'
makeFile -filename 'optimizador.html' -appMode 'EDIT' -includeWindows @($orden, $afinador) -initWindow 'win-orden'
makeFile -filename 'psych.html' -appMode 'PSYCH' -includeWindows @($psych) -initWindow 'win-psych'
makeFile -filename 'compresor.html' -appMode 'COMPRESS' -includeWindows @($compresor) -initWindow 'win-compresor'
makeFile -filename 'audio.html' -appMode 'AUDIO' -includeWindows @($audio) -initWindow 'win-audio'
makeFile -filename 'atlas.html' -appMode 'ATLAS' -includeWindows @($atlas) -initWindow 'win-atlas'

$newHome = $homeWin -replace 'onclick="initMode\(''SCAN''\)"', 'onclick="window.location.href=''escaner.html''"'
$newHome = $newHome -replace 'onclick="initMode\(''COMPRESS''\)"', 'onclick="window.location.href=''compresor.html''"'
$newHome = $newHome -replace 'onclick="initMode\(''AUDIO''\)"', 'onclick="window.location.href=''audio.html''"'
$newHome = $newHome -replace 'onclick="initMode\(''ATLAS''\)"', 'onclick="window.location.href=''atlas.html''"'

$indexContent = $header + "`n" + $newHome + "`n" + $footer
Set-Content -Path 'index_new.html' -Value $indexContent -Encoding UTF8
Write-Host "Created index_new.html"
