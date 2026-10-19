/**
 * Compresor de Texturas ASTC (Optimizador de Peso Móvil)
 * Spritesheet Generator FNF'
 * 
 * Permite importar archivos .astc pesados y recomprimirlos a formatos de bloque
 * ultra ligeros (10x10, 12x12) limpiando píxeles transparentes.
 * Conserva el 100% de la resolución original y compatibilidad con el juego.
 */

(function () {
    'use strict';

    let currentAstcFile = null;
    let currentDecodedCanvas = null;
    let currentHeader = null;
    let currentCompressedResult = null;

    const fileInput = document.getElementById('astcCompressUpload');
    const uploadBtn = document.getElementById('btnUploadAstcMain');
    const workspace = document.getElementById('compresorAstcWorkspace');

    const metaRes = document.getElementById('metaRes');
    const metaBlock = document.getElementById('metaBlock');
    const metaBpp = document.getElementById('metaBpp');

    const selTargetBlock = document.getElementById('selAstcTargetBlock');
    const selQuality = document.getElementById('selAstcQuality');
    const chkCleanAlpha = document.getElementById('chkCleanAlphaAstc');

    const btnPresetMax = document.getElementById('btnPresetAstcMax');
    const btnPresetUltra = document.getElementById('btnPresetAstcUltra');
    const btnPresetBal = document.getElementById('btnPresetAstcBal');

    const btnRun = document.getElementById('btnRunAstcCompressor');
    const btnDownload = document.getElementById('btnDownloadCompressedAstc');

    const txtOrigSize = document.getElementById('txtAstcOrigSize');
    const txtNewSize = document.getElementById('txtAstcNewSize');
    const boxSavings = document.getElementById('boxSavingsPercent');
    const canvasPreview = document.getElementById('canvasAstcPreview');

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getTargetBlock() {
        const val = selTargetBlock ? selTargetBlock.value : '12x12';
        const parts = val.split('x').map(Number);
        return { bx: parts[0] || 12, by: parts[1] || 12 };
    }

    function updateEstimatedSavings() {
        if (!currentHeader || !currentAstcFile) return;

        const { bx, by } = getTargetBlock();
        const blocksX = Math.ceil(currentHeader.width / bx);
        const blocksY = Math.ceil(currentHeader.height / by);
        const estimatedBytes = blocksX * blocksY * 16 + 16;

        if (txtNewSize) {
            txtNewSize.textContent = formatBytes(estimatedBytes);
        }

        if (boxSavings && currentAstcFile.size > 0) {
            const ratio = ((1 - (estimatedBytes / currentAstcFile.size)) * 100).toFixed(1);
            boxSavings.style.display = 'block';
            if (ratio > 0) {
                boxSavings.innerHTML = `🚀 Ahorro estimado: <b>-${ratio}% más ligero</b>`;
                boxSavings.style.color = '#00ff88';
                boxSavings.style.borderColor = 'rgba(0, 255, 136, 0.3)';
                boxSavings.style.background = 'rgba(0, 255, 136, 0.1)';
            } else {
                boxSavings.innerHTML = `ℹ️ Peso estimado: similar al archivo original`;
                boxSavings.style.color = '#ffaa00';
                boxSavings.style.borderColor = 'rgba(255, 170, 0, 0.3)';
                boxSavings.style.background = 'rgba(255, 170, 0, 0.1)';
            }
        }
    }

    function renderPreviewCanvas(sourceCanvas) {
        if (!canvasPreview || !sourceCanvas) return;

        const maxDisplayW = 340;
        const maxDisplayH = 260;
        let dw = sourceCanvas.width;
        let dh = sourceCanvas.height;
        const aspect = dw / dh;

        if (dw > maxDisplayW) {
            dw = maxDisplayW;
            dh = Math.round(dw / aspect);
        }
        if (dh > maxDisplayH) {
            dh = maxDisplayH;
            dw = Math.round(dh * aspect);
        }

        canvasPreview.width = dw;
        canvasPreview.height = dh;
        const ctx = canvasPreview.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sourceCanvas, 0, 0, dw, dh);
    }

    // Presets basados en guía oficial Arm astcenc
    if (btnPresetBal) {
        btnPresetBal.addEventListener('click', () => {
            // Estándar Psych Mobile (6x6)
            if (selTargetBlock) selTargetBlock.value = '6x6';
            if (selQuality) selQuality.value = 'thorough';
            if (chkCleanAlpha) chkCleanAlpha.checked = true;
            updateEstimatedSavings();
        });
    }

    if (btnPresetUltra) {
        btnPresetUltra.addEventListener('click', () => {
            // Balanceado Arm (-44% peso · 8x8)
            if (selTargetBlock) selTargetBlock.value = '8x8';
            if (selQuality) selQuality.value = 'thorough';
            if (chkCleanAlpha) chkCleanAlpha.checked = true;
            updateEstimatedSavings();
        });
    }

    if (btnPresetMax) {
        btnPresetMax.addEventListener('click', () => {
            // Máximo Ahorro para fondos (12x12)
            if (selTargetBlock) selTargetBlock.value = '12x12';
            if (selQuality) selQuality.value = 'thorough';
            if (chkCleanAlpha) chkCleanAlpha.checked = true;
            updateEstimatedSavings();
        });
    }

    if (selTargetBlock) selTargetBlock.addEventListener('change', updateEstimatedSavings);
    if (selQuality) selQuality.addEventListener('change', updateEstimatedSavings);

    // Carga de archivo .ASTC
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const inp = e.target;
            if (!inp.files || inp.files.length === 0) {
                if (typeof window.setImportButtonState === 'function') {
                    window.setImportButtonState(uploadBtn || inp, 'reset');
                }
                return;
            }

            if (typeof mostrarCargaGlobal === 'function') {
                mostrarCargaGlobal('Cargando y analizando textura .ASTC...');
            }

            await window.validateAndProcessFile(inp, 'astc', {
                onSuccess: async (file, data) => {
                    try {
                        currentAstcFile = file;
                        currentCompressedResult = null;

                        // Decodificar con WebAssembly
                        const buffer = await file.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        const decoded = window.ASTCEngine.astcToCanvas(bytes);

                        currentDecodedCanvas = decoded.canvas;
                        currentHeader = decoded.header;

                        // Mostrar metadatos
                        if (metaRes) metaRes.textContent = `${currentHeader.width} × ${currentHeader.height} px`;
                        if (metaBlock) metaBlock.textContent = `${currentHeader.blockX}×${currentHeader.blockY}`;
                        const origBpp = (128 / (currentHeader.blockX * currentHeader.blockY)).toFixed(2);
                        if (metaBpp) metaBpp.textContent = `${origBpp} bpp`;

                        if (txtOrigSize) txtOrigSize.textContent = formatBytes(file.size);

                        // Renderizar vista previa
                        renderPreviewCanvas(currentDecodedCanvas);

                        // Actualizar estimación
                        updateEstimatedSavings();

                        if (workspace) workspace.style.display = 'flex';
                        if (btnDownload) btnDownload.style.display = 'none';

                        if (uploadBtn) {
                            uploadBtn.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/3114/3114883.png" class="icon icon-black" alt="Upload"> ✓ TEXTURA: ${file.name}`;
                        }

                        if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
                    } catch (err) {
                        console.error('Error al procesar textura ASTC:', err);
                        if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
                        alert('❌ Error al decodificar la textura ASTC: ' + err.message);
                    }
                },
                onError: (type, msg) => {
                    if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
                    if (workspace) workspace.style.display = 'none';
                    if (uploadBtn) {
                        uploadBtn.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/3114/3114883.png" class="icon icon-black" alt="Upload"> SELECCIONAR TEXTURA .ASTC`;
                    }
                }
            });
        });
    }

    // Iniciar Compresión
    if (btnRun) {
        btnRun.addEventListener('click', async () => {
            if (!currentDecodedCanvas || !currentHeader || !currentAstcFile) {
                alert('❌ Primero sube una textura .ASTC válida.');
                return;
            }

            const { bx, by } = getTargetBlock();
            const quality = selQuality ? (selQuality.value || 'fast') : 'fast';

            if (typeof mostrarCargaGlobal === 'function') {
                mostrarCargaGlobal(`Recomprimiendo ASTC (Bloque ${bx}×${by}, ${quality})...\nReduciendo peso conservando 100% resolución.`);
            }

            try {
                await new Promise(r => setTimeout(r, 80)); // Permite pintar el loader

                const w = currentHeader.width;
                const h = currentHeader.height;

                // Lienzo de trabajo
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(currentDecodedCanvas, 0, 0);

                const startTime = performance.now();

                // Recomprimir ASTC conservando resolución y distribución (el XML original sigue siendo válido).
                // Modo 'safe': solo sangrado de color, sin borrar píxeles semitransparentes.
                const result = await window.ASTCEngine.encodeCanvasToAstc(canvas, {
                    blockX: bx,
                    blockY: by,
                    quality: quality,
                    mode: 'safe',
                    bleedAlpha: chkCleanAlpha ? chkCleanAlpha.checked : true
                });

                const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
                currentCompressedResult = result;

                // Actualizar resultados
                if (txtNewSize) txtNewSize.textContent = formatBytes(result.totalLength);

                if (boxSavings && currentAstcFile.size > 0) {
                    const ratio = ((1 - (result.totalLength / currentAstcFile.size)) * 100).toFixed(1);
                    boxSavings.style.display = 'block';
                    if (ratio > 0) {
                        boxSavings.innerHTML = `🎉 ¡Compresión Exitosa! <b>-${ratio}% de peso reducido</b> (${elapsed}s)`;
                        boxSavings.style.color = '#00ff88';
                        boxSavings.style.borderColor = 'rgba(0, 255, 136, 0.4)';
                        boxSavings.style.background = 'rgba(0, 255, 136, 0.15)';
                    } else {
                        boxSavings.innerHTML = `✅ Recompresión lista (${formatBytes(result.totalLength)}, ${elapsed}s)`;
                    }
                }

                // Vista previa del resultado REAL (decodificando el .astc generado)
                const check = window.ASTCEngine.astcToCanvas(result.astcBytes);
                renderPreviewCanvas(check.canvas);

                if (btnDownload) {
                    btnDownload.style.display = 'block';
                    btnDownload.scrollIntoView({ behavior: 'smooth' });
                }

                if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
            } catch (err) {
                console.error('Error al recomprimir ASTC:', err);
                if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
                alert('❌ Error durante la compresión: ' + err.message);
            }
        });
    }

    // Descarga directa del .ASTC optimizado (sin ZIP)
    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            if (!currentCompressedResult || !currentCompressedResult.astcBytes) {
                alert('❌ No hay ninguna textura comprimida para descargar.');
                return;
            }

            const baseName = currentAstcFile ? currentAstcFile.name.replace(/\.[^/.]+$/, '') : 'textura';
            const downloadName = baseName + '_compressed.astc';

            const blob = new Blob([currentCompressedResult.astcBytes], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // Drag and Drop
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        const overlay = document.getElementById('dragOverlay');
        if (overlay) overlay.style.display = 'flex';
    });

    window.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null) {
            const overlay = document.getElementById('dragOverlay');
            if (overlay) overlay.style.display = 'none';
        }
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        const overlay = document.getElementById('dragOverlay');
        if (overlay) overlay.style.display = 'none';

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (fileInput) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        }
    });

})();
