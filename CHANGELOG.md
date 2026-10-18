# Spritesheet Generator FNF - Historial de Versiones

## Versión 1.6.0 (Actual)
- **[NUEVO] Estudio de Texturas ASTC (Móviles / Android):**
  - **1. Optimizador ASTC + XML:** Permite importar texturas `.astc` junto a su `.xml` (Sparrow) para visualizar y reproducir animaciones, recortar y deduplicar frames, modificar la resolución/escala de la imagen, alinear automáticamente la posición y la cámara del personaje en Psych Engine y exportar paquetes `.zip` con la textura optimizada, el XML y el JSON.
  - **2. Convertir ASTC a PNG:** Decodificación WebAssembly 100% offline y ultrarrápida de texturas `.astc` a imágenes `.png` nítidas, con visor interactivo (zoom, fondos ajedrez/negro/blanco), estadísticas de bloque (bpp, dimensiones, total de bloques) y descarga inmediata.
  - **3. Convertir PNG a ASTC (Ultra Optimizado):** Compresión de imágenes `.png` al formato nativo `.astc` con cabecera estándar de 16 bytes. Orientación normal de pie por defecto (pies abajo, cabeza arriba), navegación completa entre carpetas en Android (`accept="*/*"`), importación dual de PNG + XML como base de verificación de fotogramas, presets rápidos (*100% Escala -64% peso*, *Máximo Ahorro -75% peso* y *Peso Mínimo Extremo 80 KB - 300 KB*) garantizando que el ASTC pese mucho menos que el PNG original y descarga directa exclusiva en `.astc` nativo (sin ZIP).
  - **4. Compresor de Texturas ASTC (Nuevo Optimizador):** Herramienta estilo 'Compresor PNG' para recomprimir texturas `.astc` pesadas a bloques ultra ligeros (`10x10`, `12x12`) y limpiar píxeles transparentes, reduciendo el peso de MegaBytes a solo unos pocos KiloBytes conservando 100% la resolución.
  - **5. Motor ASTC WebAssembly 100% Offline:** Adaptación completa del compilador Arm ASTC con binario WASM embebido, permitiendo que funcione sin errores de CORS ni bloqueos en cualquier navegador o al abrir el archivo directamente con `file:///`.
  - **6. Totalmente Adaptado para Móviles con Diagnóstico de Errores:** Navegación forzada en carpetas en Android, detección temprana de errores sintácticos con ventana de logs y diseño responsivo para pantallas táctiles.

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
