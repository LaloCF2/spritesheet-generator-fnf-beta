# Spritesheet Generator FNF - Historial de Versiones

## Versión 1.6.0 (Actual)
- **[NUEVO] Estudio de Texturas ASTC (Móviles / Android):**
  - **1. Optimizador ASTC + XML:** Permite importar texturas `.astc` junto a su `.xml` (Sparrow) para visualizar y reproducir animaciones, recortar y deduplicar frames, modificar la resolución/escala de la imagen, alinear automáticamente la posición y la cámara del personaje en Psych Engine y exportar paquetes `.zip` con la textura optimizada, el XML y el JSON.
  - **2. Convertir ASTC a PNG:** Decodificación WebAssembly 100% offline y ultrarrápida de texturas `.astc` a imágenes `.png` nítidas, con visor interactivo (zoom, fondos ajedrez/negro/blanco), estadísticas de bloque (bpp, dimensiones, total de bloques) y descarga inmediata.
  - **3. Convertir PNG a ASTC:** Compresión de imágenes `.png` al formato nativo `.astc` (cabecera estándar de 16 bytes, orientación de pie igual que las texturas originales del juego), navegación entre carpetas en Android (`accept="*/*"`) e importación opcional de `.xml` y `.json` del personaje.
    - **Reempaquetado de atlas:** con el XML, quita el espacio vacío y los frames repetidos y alinea cada recorte a los bloques ASTC (ej. `soul.png` de 8192×8192 pasó de 16 MB a 2 MB sin perder resolución).
    - **JSON del personaje (Psych Engine):** al reducir la escala ajusta automáticamente `scale`, `position` y `camera_position` con el mismo cálculo del Optimizador.
    - **Descarga única:** solo PNG → `.astc`; PNG + XML (+ JSON) → `.zip` con el `.astc`, el XML nuevo, el JSON ajustado y un informe `.txt` de qué cambió y qué sigue igual.
  - **4. Modo "Fiel al original" estilo Arm astcenc (Cero residuos):** no borra ni recolorea nada del dibujo (conserva suavizado, sombras y auras). Perfil LDR lineal (`-cl`), calidad Thorough, peso del canal alfa `-cw 1 1 1 8` y **pulido de bordes bloque por bloque** (recomprime con calidad Exhaustive los bloques del borde que dejaban residuos). El modo "Quitar halos de Flash" queda como opción.
  - **5. Prioridades de calidad (siempre al 100% de resolución):**
    - `💎 Calidad Máxima (5×5)`: casi idéntico al PNG.
    - `⭐ Equilibrio (6×6 · Recomendado)`: opción por defecto.
    - `🚀 Ligero (8×8)`: 44% menos peso que 6×6, con algo de manchas de color.
    - La escala solo se reduce si el atlas pasa de 4096 px (límite de muchos celulares): bajar la resolución se ve peor que usar bloques grandes.
  - **6. Compresor de Texturas ASTC:** Herramienta estilo 'Compresor PNG' para recomprimir texturas `.astc` pesadas a bloques más ligeros conservando 100% la resolución y la distribución (el XML original sigue siendo válido), con vista previa del resultado real decodificado.
  - **7. Motor ASTC WebAssembly 100% Offline:** Adaptación completa del compilador Arm ASTC con binario WASM embebido en Base64, funcionando sin errores de CORS ni bloqueos en cualquier navegador o al abrir el archivo directamente con `file:///`.
- **[CORRECCIÓN] Estudio ASTC:**
  - El Optimizador ASTC + XML exporta los archivos con su nombre original dentro del ZIP (antes `_opt`, lo que hacía que el juego mezclara la textura nueva con el XML viejo).
  - Se eliminaron los puntos de color y los bordes escalonados que dejaba la limpieza de halos alrededor del personaje.
  - El Compresor ASTC y el Optimizador ya no borran brillos ni sombras semitransparentes del personaje.
- **[MEJORA] Compresor PNG (nuevo motor estilo pngquant/TinyPNG):**
  - Paleta de colores de alta calidad (median cut + k-means) que **protege los colores de zonas pequeñas** (ej. el micrófono verde no se vuelve gris) y comprime con codificador PNG propio (paleta de 1/2/4/8 bits, transparencia mínima, deflate nivel 9).
  - **Más reducción con mejor calidad:** BOYFRIEND.png de 2.08 MB → 415 KB (−81%) y soul.png de 5.20 MB → 664 KB (−88%), entre 19% y 26% más ligeros que antes.
  - **Nivel de compresión 0-100** (más alto = menos peso; 0 = sin pérdida) con **nivel recomendado automático** al importar, que detecta brillos/degradados grandes para que no salgan bandas, y calidad estimada en vivo al mover la barra.
  - Vista previa del resultado real con botón para comparar con el original, y difuminado (dithering) opcional para degradados.
- **[CORRECCIÓN] Compresor de Audio OGG:** Ya comprime correctamente (el motor FFmpeg fallaba al iniciar). Si ocurre un error, ahora se muestra la causa real.

## Versión 1.5.3
- **[CORRECCIÓN] Transparencia Nativa 100% en Exportación de GIFs:**
  - Se eliminó el fondo verde indeseado (`#00fe0b`) que aparecía al exportar GIFs con fondo transparente.
  - Implementación de un codificador GIF nativo de alta precisión (`gifenc`) que configura el índice de transparencia directamente en la tabla de colores y encabezados gráficos GIF89a.
- **[CORRECCIÓN] Eliminación de Frames Pegados/Congelados en Fondo Sólido:**
  - Se solucionó el problema donde frames anteriores quedaban pegados o superpuestos debajo de la animación al usar fondos de color sólido.
  - Se configuró el método de descarte de fotogramas (`disposal: 2` / Restore to background) y aislamiento de lienzos independientes por frame, garantizando animaciones limpias, nítidas y sin residuos visuales.

## Versión 1.5.2
- **[NUEVO] Feedback Visual y Diagnóstico en Botones de Importación:**
  - **Color Verde al Importar con Éxito:** Al seleccionar un archivo válido (.PNG, .XML, .JSON, Audio), el botón de importación se ilumina en color verde con confirmación visual de carga, igual que en el creador de GIFs.
  - **Cobertura Completa:** Aplicado de forma unificada en el Optimizador, Escáner de Cero, Compresor PNG, Compresor de Audio OGG, Conversor Atlas y Creador de GIF.
  - **Nuevo Botón Interactivo de JSON:** Renovación del campo de importación de `.json` en Optimizador y Escáner con botón estilo píldora sincronizado al sistema de estados.
- **[CORRECCIÓN] Renderizado Limpio en Rueda de Carga:** Se eliminó la visualización de etiquetas HTML crudas (como `<br>` y `<span style=...>`) en los mensajes de la rueda de carga. Ahora todos los títulos, avisos de congelamiento y advertencias se renderizan con saltos de línea reales y colores estéticos en todas las herramientas.

## Versión 1.5.1
- **[MEJORA] (Optimizador) Alineación Automática Psych Engine:** Cálculo matemático automático de posición y escala al optimizar la resolución de texturas y XML junto al archivo `.json` del personaje. Se compensa exactamente la contracción del centro de transformación HaxeFlixel (ΔX, ΔY), asegurando que el personaje conserve su posición original en el escenario sin flotar ni desfasarse.
- **[MEJORA] (Optimizador) Proceso con Rueda de Carga:** Animación de carga y fases matemáticas detalladas durante la optimización, con confirmación visual interactiva en el badge del JSON importado.
- **[MEJORA] (Optimizador) Arquitectura:** Separación de herramientas en múltiples archivos HTML para carga más rápida y mejor rendimiento en dispositivos móviles.
- **[MEJORA] (Generador GIF Animado) Sincronización Musical BPM:** Mejora el ajuste de delays por frame en centisegundos para que los GIFs encajen perfectamente con cualquier canción sin repetir frames innecesariamente.
- **[NUEVO] (Generador GIF Animado) Control de Fondo para GIFs:** Opción para exportar y previsualizar GIFs con fondo transparente o con color sólido, incluyendo paleta de colores rápidos (negro, blanco, verde, azul, magenta, etc.) y selector de color personalizado.
- **[MEJORA] (Generador GIF Animado) Sistema de recortes:** Mejoras al realizar cajas o recortes para mejor facilidad.
- **[CORRECCION]** Corrección de errores y mejoras generales de rendimiento.

## Versión 1.5.0
- **[NUEVO] Generador de GIF Animado:** Crea GIFs a partir de archivos sueltos, spritesheets solos, o combinaciones de XML+PNG sincronizados a los BPM de Friday Night Funkin'.
- **[MEJORA] Autoguardado:** Sistema de guardado automático en caché periódico y al minimizar la aplicación para evitar pérdida de progreso.
- **[MEJORA] Arquitectura:** Separación de herramientas en múltiples archivos HTML para carga más rápida y mejor rendimiento en dispositivos móviles.
- **[MEJORA] Sincronización Musical BPM Precisa:** Eliminado el redondeo forzado a FPS enteros que provocaba velocidades idénticas en BPMs cercanos (105 vs 106). Nuevo motor de tiempo musical continuo basado en milisegundos exactos de beat (60,000 / BPM), selector de compás (1 Beat, 2 Beats, 4 Beats, 1/2 Beat, 1 Step por frame), pulso LED visual, claqueta/metrónomo auditivo opcional y ajuste de centisegundos en el GIF exportado para sincronización perfecta con cualquier canción.
- **[NUEVO] Política de Privacidad:** Se añadió una sección de política de privacidad clara al pie de la página principal.

## Versión 1.4.3
- **[CORRECCIÓN]** Corrección de errores y mejoras generales de rendimiento.

## Versión 1.4.2
- **[CORRECCIÓN]** Corrección de errores y optimización de memoria.

## Versión 1.4.1
- **[CORRECCIÓN]** Corrección de errores en la carga de archivos.

## Versión 1.4.0
- **[NUEVO] Conversor Animate Atlas:** Importación de archivos .json con su imagen .png para optimizarlos y reducir su resolución de imagen.
- **[MEJORA] Optimizador:** Ahora además de modificar la escala del personaje, puedes modificar y optimizar la resolución de la imagen .png para reducir su peso drásticamente.
- **[NUEVO] Compresor Audio OGG:** Herramienta añadida para comprimir archivos de audio.

## Versión 1.3.0
- **[NUEVO] Psych Live Editor:** Modo de previsualización en vivo para ajustar offsets visualmente.
- **[MEJORA]** Corrección de errores y mejoras generales en la interfaz de usuario.

## Versión 1.2.0
- **[MEJORA]** Corrección de errores y mejoras.

## Versión 1.1.0
- **[MEJORA]** Corrección de errores y soporte inicial para exportar archivos individuales.

## Versión 1.0.0
- **[LANZAMIENTO]** Lanzamiento inicial de Spritesheet Generator FNF con funciones básicas de escaneo y optimización de XML.
