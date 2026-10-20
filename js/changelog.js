const CHANGELOG_DATA = [
    {
        version: "1.6.0",
        date: "Actual",
        changes: [
            "<b><span style='color: #00ff88;'>[NUEVO] Estudio de Texturas ASTC (Móviles / Android):</span></b> Suite completa con 4 herramientas especializadas para texturas .ASTC de Friday Night Funkin' en móviles.",
            "<b><span style='color: #00e5ff;'>1. Optimizador ASTC + XML:</span></b> Carga texturas .astc con su archivo .xml (Sparrow) para reproducir animaciones, deduplicar frames, ajustar resolución/escala y sincronizar automáticamente offsets de posición y cámara en Psych Engine.",
            "<b><span style='color: #00ff88;'>2. Convertir ASTC a PNG:</span></b> Decodificador WebAssembly ultrarrápido 100% offline para ver e inspeccionar texturas .astc y descargarlas en PNG con visor de zoom y fondo intercambiable.",
            "<b><span style='color: #ffaa00;'>3. Convertir PNG a ASTC:</span></b> Textura .astc de pie igual que las originales del juego, con XML y JSON del personaje opcionales. Reempaqueta el atlas quitando espacio vacío y frames repetidos (soul.png: de 16 MB a 2 MB sin perder resolución) y ajusta solo la escala, posición y cámara del JSON al reducir la escala.",
            "<b><span style='color: #00ff88;'>4. Modo Fiel al Original (estilo Arm astcenc):</span></b> No borra ni recolorea nada del dibujo (conserva suavizado, sombras y auras). Perfil lineal, calidad Thorough, peso alfa -cw 1 1 1 8 y pulido de bordes bloque por bloque: sin residuos de color alrededor del personaje.",
            "<b><span style='color: #00e5ff;'>Prioridades de Calidad:</span></b> 💎 Calidad Máxima (5x5), ⭐ Equilibrio (6x6, recomendado) y 🚀 Ligero (8x8), siempre al 100% de resolución (solo se reduce si pasa de 4096 px).",
            "<b><span style='color: #ffaa00;'>Descarga Única:</span></b> Solo PNG → .astc. Con XML (y JSON) → .zip con el .astc, el XML nuevo, el JSON ajustado y un informe .txt de qué cambió y qué sigue igual.",
            "<b><span style='color: #b57cff;'>5. Compresor de Texturas ASTC:</span></b> Recomprime texturas ASTC pesadas a bloques más ligeros conservando 100% la resolución y la distribución (el XML original sigue siendo válido), con vista previa del resultado real.",
            "<b><span style='color: #00e5ff;'>6. Motor ASTC WebAssembly 100% Offline:</span></b> Compilador Arm ASTC oficial con binario WASM embebido, permitiendo comprimir y decodificar directamente en el navegador sin errores de CORS ni bloqueos locales (file:///).",
            "<b><span style='color: #00ff88;'>[CORRECCIÓN] Estudio ASTC:</span></b> El Optimizador ASTC + XML conserva el nombre original de los archivos en el ZIP (antes _opt mezclaba la textura nueva con el XML viejo en el juego). Se eliminaron los puntos de color y bordes escalonados alrededor del personaje, y ya no se borran brillos ni sombras semitransparentes.",
            "<b><span style='color: #00e5ff;'>[CORRECCIÓN] Compresor de Audio OGG:</span></b> Ya comprime correctamente (el motor FFmpeg fallaba al iniciar) y, si ocurre un error, muestra la causa real."
        ]
    },
    {
        version: "1.5.3",
        date: "Reciente",
        changes: [
            "<b><span style='color: #00ff88;'>[CORRECCIÓN] Transparencia Nativa 100% en GIFs:</span></b> Solucionado el fondo verde que aparecía al exportar GIFs transparentes. Se integró un motor GIF de alta fidelidad que graba directamente la transparencia en los encabezados GIF89a.",
            "<b><span style='color: #00e5ff;'>[CORRECCIÓN] Animaciones Limpias sin Frames Pegados:</span></b> Al exportar con fondo de color sólido, se configuró el descarte de frames (disposal method 2) y lienzos aislados por frame, eliminando por completo cualquier fotograma congelado o superpuesto."
        ]
    },
    {
        version: "1.5.2",
        date: "Reciente",
        changes: [
            "<b><span style='color: #00ff88;'>[NUEVO] Botones de Importación Interactivos (Verde / Rojo):</span></b> Al importar cualquier archivo válido (.PNG, .XML, .JSON, Audio), los botones se iluminan en color verde para confirmar la carga exitosa.",
            "<b><span style='color: #00e5ff;'>[MEJORA] Integración Global:</span></b> Activado en Optimizador, Escáner de Cero, Compresor PNG, Compresor de Audio OGG, Conversor Atlas y Creador de GIF.",
            "<b><span style='color: #b57cff;'>[MEJORA] (Optimizador) Selector de JSON Rediseñado:</span></b> Botón interactivo tipo píldora para importar .JSON en Optimizador y Escáner de Cero.",
            "<b><span style='color: #00ff88;'>[CORRECCIÓN] Renderizado Limpio de Rueda de Carga:</span></b> Se eliminó la visualización de etiquetas HTML sin procesar (como &lt;br&gt; y &lt;span&gt;). Ahora todos los avisos de exportación, compresión y optimización se formatean limpiamente."
        ]
    },
    {
        version: "1.5.1",
        changes: [
            "<b><span style='color: #00e5ff;'>[MEJORA] (Optimizador) Alineación de Posición y Cámara Psych Engine:</span></b> Cálculo matemático automático de posición [X, Y], cámara [X, Y] y escala en el .JSON. Evita desfasar o que el personaje flote en el escenario y mantiene el enfoque de la cámara perfecto.",
            "<b><span style='color: #aaff00;'>[MEJORA] (Optimizador) Rueda de Carga:</span></b> Proceso guiado con fases matemáticas detalladas y confirmación interactiva en el badge del JSON importado.",
            "<b><span style='color: #ffaa00;'>[MEJORA] (Optimizador) Arquitectura:</span></b> Separación de herramientas en múltiples páginas para una carga drásticamente más rápida en móviles.",
            "<b><span style='color: #00ff88;'>[MEJORA] (Generador GIF Animado) Sincronización Musical BPM:</span></b> Mejora el ajuste de delays por frame en centisegundos para que los GIFs encajen perfectamente con cualquier canción sin repetir frames innecesariamente.",
            "<b><span style='color: #00e5ff;'>[NUEVO] (Generador GIF Animado) Control de Fondo para GIFs:</span></b> Opción de fondo transparente o fondo de color sólido con paleta interactiva y selector personalizado.",
            "<b><span style='color: #00ff88;'>[MEJORA] (Generador GIF Animado) Sistema de recortes:</span></b> Mejoras al realizar cajas o recortes para mejor facilidad.",
            "<b><span style='color: #aaa;'>[CORRECCIÓN]</span></b> Corrección de errores y mejoras de visualización."
        ]
    },
    {
        version: "1.5.0",
        changes: [
            "<b><span style='color: #00e5ff;'>[NUEVO]</span> Generador de GIF Animado:</b> Crea GIFs a partir de archivos sueltos, spritesheets solos, o combinaciones de XML+PNG sincronizados a los BPM de Friday Night Funkin'.",
            "<b><span style='color: #4caf50;'>[MEJORA]</span> Autoguardado:</b> Sistema de guardado automático en caché periódico y al minimizar la aplicación para evitar pérdida de progreso.",
            "<b><span style='color: #b57cff;'>[NUEVO]</span> Política de Privacidad:</b> Claridad total sobre el procesamiento 100% local sin servidores."
        ]
    },
    {
        version: "1.4.3",
        changes: ["<b><span style='color: #aaa;'>[CORRECCIÓN]</span></b> Corrección de errores y mejoras de rendimiento."]
    },
    {
        version: "1.4.2",
        changes: ["<b><span style='color: #aaa;'>[CORRECCIÓN]</span></b> Corrección de errores y optimización de memoria."]
    },
    {
        version: "1.4.1",
        changes: ["<b><span style='color: #aaa;'>[CORRECCIÓN]</span></b> Corrección de errores en la carga de archivos."]
    },
    {
        version: "1.4.0",
        changes: [
            "<b><span style='color: #ffaa00;'>[NUEVO]</span> Conversor Animate Atlas:</b> Importación de archivos .json y su imagen .png para optimizarlos.",
            "<b><span style='color: #b57cff;'>[MEJORA]</span> Optimizador:</b> Edita la escala y reduce la resolución conservando el peso bajo.",
            "<b><span style='color: #ff3366;'>[NUEVO]</span> Compresor Audio OGG:</b> Reduce el tamaño de instrumentales y voces al instante."
        ]
    },
    {
        version: "1.3.0",
        changes: [
            "<b><span style='color: #ffaa00;'>[NUEVO]</span> Psych Live Editor:</b> Interfaz beta para alinear animaciones en tiempo real para Psych Engine.",
            "<b><span style='color: #aaa;'>[MEJORA]</span></b> Corrección de errores y mejoras en la interfaz de usuario."
        ]
    },
    {
        version: "1.2.0",
        changes: ["<b><span style='color: #aaa;'>[MEJORA]</span></b> Corrección de errores y mejoras de estabilidad."]
    },
    {
        version: "1.1.0",
        changes: ["<b><span style='color: #aaa;'>[MEJORA]</span></b> Corrección de errores y soporte inicial para exportar archivos individuales."]
    },
    {
        version: "1.0.0",
        changes: ["<b><span style='color: #4caf50;'>[LANZAMIENTO]</span></b> Lanzamiento de Spritesheet Generator FNF con Escáner y Optimizador XML."]
    }
];
