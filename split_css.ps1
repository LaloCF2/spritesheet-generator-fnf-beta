$lines = Get-Content "css\style.css"
$currentFile = "themes"
$themeLines = @()
$baseLines = @()
$componentsLines = @()
$windowsLines = @()

foreach ($line in $lines) {
    if ($line -match "VARIABLES GLOBALES" -or $line -match "MODO OSCURO" -or $line -match "TEMAS EXTRA") {
        $currentFile = "themes"
    } elseif ($line -match "CAJAS DE CRISTAL INTERNAS" -or $line -match "DROPDOWN ANIMADO" -or $line -match "ESTILOS GLOBALES DE PANELES" -or $line -match "FAB \(FLOATING" -or $line -match "MODALES" -or $line -match "BOTONES FLOTANTES INDIVIDUALES") {
        $currentFile = "components"
    } elseif ($line -match "FONDO ANIMADO" -or $line -match "SISTEMA DE ICONOS" -or $line -match "HEADER Y GESTOR DE VENTANAS" -or $line -match "ESPACIO DE TRABAJO PRINCIPAL") {
        $currentFile = "base"
    } elseif ($line -match "VENTANA 0" -or $line -match "VENTANA 1" -or $line -match "VENTANA 2" -or $line -match "VENTANA 3" -or $line -match "VENTANA 4" -or $line -match "EFECTOS DRAG OVERLAY") {
        $currentFile = "windows"
    }

    if ($currentFile -eq "themes") { $themeLines += $line }
    elseif ($currentFile -eq "components") { $componentsLines += $line }
    elseif ($currentFile -eq "windows") { $windowsLines += $line }
    else { $baseLines += $line }
}

if (!(Test-Path -Path "css")) {
    New-Item -ItemType Directory -Path "css"
}

$themeLines | Set-Content "css\themes.css" -Encoding UTF8
$baseLines | Set-Content "css\base.css" -Encoding UTF8
$componentsLines | Set-Content "css\components.css" -Encoding UTF8
$windowsLines | Set-Content "css\windows.css" -Encoding UTF8
Write-Host "Done"
