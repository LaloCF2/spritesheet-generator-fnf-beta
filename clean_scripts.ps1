function Fix-Scripts {
    param([string]$File, [string[]]$ScriptsToKeep)

    $text = [System.IO.File]::ReadAllText($File, [System.Text.Encoding]::UTF8)
    
    # Remove all tool scripts
    $allTools = @("escaner.js", "optimizador.js", "psych.js", "compresor.js", "audio.js", "atlas.js")
    
    foreach ($tool in $allTools) {
        if ($ScriptsToKeep -notcontains $tool) {
            $text = [regex]::Replace($text, "<script src=`"js/$tool`" defer></script>\r?\n?", "")
        }
    }
    
    [System.IO.File]::WriteAllText($File, $text, [System.Text.Encoding]::UTF8)
    Write-Host "Cleaned scripts for $File"
}

Fix-Scripts -File "index.html" -ScriptsToKeep @()
Fix-Scripts -File "escaner.html" -ScriptsToKeep @("escaner.js", "optimizador.js")
Fix-Scripts -File "optimizador.html" -ScriptsToKeep @("escaner.js", "optimizador.js")
Fix-Scripts -File "psych.html" -ScriptsToKeep @("psych.js")
Fix-Scripts -File "compresor.html" -ScriptsToKeep @("compresor.js")
Fix-Scripts -File "audio.html" -ScriptsToKeep @("audio.js")
Fix-Scripts -File "atlas.html" -ScriptsToKeep @("atlas.js")
