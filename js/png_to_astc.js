/**
 * PNG to ASTC Compressor & Converter (Ultra Optimizado)
 * Spritesheet Generator FNF'
 * 
 * Soporta:
 * - Orientación vertical normal derecha (cabeza arriba, pies abajo) por defecto.
 * - Navegación entre carpetas en Android (accept="").
 * - Importación dual (PNG + XML como base de comprobación y alineación de frames).
 * - Exportación exclusiva de archivo .ASTC nativo ultraligero (sin archivo ZIP).
 * - Preset "Ultra Ahorro" que genera archivos .ASTC nativos ligeros (80 KB - 300 KB).
 */

(function () {
    'use strict';

    let currentPngFile = null;
    let currentImage = null;
    let currentXmlFile = null;
    let currentXmlData = null;
    let currentAstcResult = null;

    // DOM Elements
    const pngFileInput = document.getElementById('pngFileInput');
    const btnUploadPng = document.getElementById('btnUploadPng');
    const lblPngBtn = document.getElementById('lblPngBtn');

    const xmlFileInput = document.getElementById('xmlFileInput');
    const btnUploadXml = document.getElementById('btnUploadXml');
    const lblXmlBtn = document.getElementById('lblXmlBtn');

    const xmlBaseBadge = document.getElementById('xmlBaseBadge');
    const xmlBaseTitle = document.getElementById('xmlBaseTitle');
    const xmlBaseDetails = document.getElementById('xmlBaseDetails');
    const chkShowXmlFrames = document.getElementById('chkShowXmlFrames');
    const btnRemoveXml = document.getElementById('btnRemoveXml');

    const configContainer = document.getElementById('astcConfigContainer');
    const resultContainer = document.getElementById('astcResultContainer');

    const selBlockSize = document.getElementById('selBlockSize');
    const selTextureScale = document.getElementById('selTextureScale');
    const selQuality = document.getElementById('selQuality');
    const chkCleanAlpha = document.getElementById('chkCleanAlpha');
    const chkFlipY = document.getElementById('chkFlipY');

    const btnPresetStandard = document.getElementById('btnPresetStandard');
    const btnPresetReduced = document.getElementById('btnPresetReduced');
    const btnPresetUltraLight = document.getElementById('btnPresetUltraLight');
    const btnPresetPristine = document.getElementById('btnPresetPristine');

    const btnCompress = document.getElementById('btnCompressAstc');
    const btnDownloadAstc = document.getElementById('btnDownloadAstc');

    const sourcePreviewCanvas = document.getElementById('sourcePreviewCanvas');
    const sourcePreviewImg = document.getElementById('sourcePreviewImg');
    const thumbResInfo = document.getElementById('thumbResInfo');

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getSelectedBlock() {
        const val = selBlockSize ? selBlockSize.value : '6x6';
        const parts = val.split('x').map(Number);
        return { bx: parts[0] || 6, by: parts[1] || 6 };
    }

    function getSelectedScale() {
        if (!selTextureScale) return 1.0;
        return parseFloat(selTextureScale.value) || 1.0;
    }

    function parseXmlSparrow(xmlDocOrText) {
        try {
            let doc;
            if (typeof xmlDocOrText === 'string') {
                const parser = new DOMParser();
                doc = parser.parseFromString(xmlDocOrText, 'text/xml');
            } else {
                doc = xmlDocOrText;
            }

            const subTextures = doc.getElementsByTagName('SubTexture');
            if (!subTextures || subTextures.length === 0) {
                return null;
            }

            const frames = [];
            let minX = Infinity;
            let minY = Infinity;
            let maxX = 0;
            let maxY = 0;

            for (let i = 0; i < subTextures.length; i++) {
                const st = subTextures[i];
                const name = st.getAttribute('name') || `frame_${i}`;
                const x = parseInt(st.getAttribute('x')) || 0;
                const y = parseInt(st.getAttribute('y')) || 0;
                const w = parseInt(st.getAttribute('width')) || 0;
                const h = parseInt(st.getAttribute('height')) || 0;

                frames.push({ name, x, y, w, h });

                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x + w > maxX) maxX = x + w;
                if (y + h > maxY) maxY = y + h;
            }

            return {
                frames,
                count: frames.length,
                minX: minX === Infinity ? 0 : minX,
                minY: minY === Infinity ? 0 : minY,
                maxX,
                maxY
            };
        } catch (e) {
            console.error('Error al analizar XML Sparrow:', e);
            return null;
        }
    }

    function renderPreview() {
        if (!sourcePreviewCanvas) return;
        const cvs = sourcePreviewCanvas;
        const ctx = cvs.getContext('2d');

        if (!currentImage) {
            cvs.width = 300;
            cvs.height = 180;
            ctx.clearRect(0, 0, cvs.width, cvs.height);
            return;
        }

        const origW = currentImage.naturalWidth || currentImage.width;
        const origH = currentImage.naturalHeight || currentImage.height;

        // Mantener relación de aspecto dentro de límites cómodos
        const maxDisplayW = 340;
        const maxDisplayH = 220;
        let dw = origW;
        let dh = origH;
        const aspect = origW / origH;

        if (dw > maxDisplayW) {
            dw = maxDisplayW;
            dh = Math.round(dw / aspect);
        }
        if (dh > maxDisplayH) {
            dh = maxDisplayH;
            dw = Math.round(dh * aspect);
        }

        cvs.width = dw;
        cvs.height = dh;
        ctx.clearRect(0, 0, dw, dh);

        // Orientación: flipY solo si chkFlipY está activado manualmente
        const isFlipped = chkFlipY && chkFlipY.checked;

        ctx.save();
        if (isFlipped) {
            ctx.translate(0, dh);
            ctx.scale(1, -1);
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(currentImage, 0, 0, dw, dh);
        ctx.restore();

        // Si hay XML base cargado y está marcado mostrar contornos, dibujar cajas de fotogramas
        const showBoxes = chkShowXmlFrames ? chkShowXmlFrames.checked : true;
        if (currentXmlData && currentXmlData.frames && showBoxes) {
            const scaleX = dw / origW;
            const scaleY = dh / origH;

            ctx.save();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = '#00e5ff';
            ctx.fillStyle = 'rgba(0, 229, 255, 0.08)';

            for (let i = 0; i < currentXmlData.frames.length; i++) {
                const f = currentXmlData.frames[i];
                let fx = f.x * scaleX;
                let fy = f.y * scaleY;
                let fw = f.w * scaleX;
                let fh = f.h * scaleY;

                if (isFlipped) {
                    fy = dh - (fy + fh);
                }

                ctx.fillRect(fx, fy, fw, fh);
                ctx.strokeRect(fx, fy, fw, fh);
            }
            ctx.restore();
        }

        if (thumbResInfo) {
            const extra = isFlipped ? ' · Invertida' : ' · De pie';
            thumbResInfo.textContent = `${origW} × ${origH} px${extra}`;
        }
    }

    function updateEstimates() {
        if (!currentImage) return;

        const origW = currentImage.naturalWidth || currentImage.width;
        const origH = currentImage.naturalHeight || currentImage.height;
        const scale = getSelectedScale();
        const targetW = Math.max(4, Math.round(origW * scale));
        const targetH = Math.max(4, Math.round(origH * scale));
        const { bx, by } = getSelectedBlock();

        const blocksX = Math.ceil(targetW / bx);
        const blocksY = Math.ceil(targetH / by);
        const totalBlocks = blocksX * blocksY;
        const estimatedAstcBytes = totalBlocks * 16 + 16; // 16 bytes cabecera + 16 bytes por bloque ASTC
        const bpp = (128 / (bx * by)).toFixed(2);

        // VRAM uncompressed RGBA vs ASTC en memoria GPU Android
        const rawVramBytes = targetW * targetH * 4;
        const vramSavingsPercent = Math.max(0, ((1 - (estimatedAstcBytes / rawVramBytes)) * 100)).toFixed(0);

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        if (scale === 1.0) {
            setTxt('lblSourceRes', `${origW} × ${origH} px`);
        } else {
            setTxt('lblSourceRes', `${targetW} × ${targetH} px (-${((1 - scale) * 100).toFixed(0)}%)`);
        }

        const scaleDetails = document.getElementById('lblScaleDetails');
        if (scaleDetails) {
            if (scale === 1.0) {
                scaleDetails.textContent = `Resolución 1:1 original: ${origW} × ${origH} px (100% fiel a las coordenadas del XML)`;
            } else {
                scaleDetails.textContent = `Resolución escalada: ${targetW} × ${targetH} px (Original: ${origW} × ${origH} px)`;
            }
        }

        setTxt('lblSourceSize', formatBytes(currentPngFile ? currentPngFile.size : 0));
        setTxt('lblEstAstcSize', formatBytes(estimatedAstcBytes));
        setTxt('lblTotalBlocks', `${totalBlocks} (${blocksX} × ${blocksY})`);
        setTxt('lblRamSavings', `-${vramSavingsPercent}% en VRAM`);

        if (currentPngFile && currentPngFile.size > 0) {
            const ratio = ((1 - (estimatedAstcBytes / currentPngFile.size)) * 100).toFixed(1);
            const ratioEl = document.getElementById('lblEstRatio');
            if (ratioEl) {
                if (ratio > 0) {
                    ratioEl.innerHTML = `<span style="color:#00ff88; font-weight:bold;">-${ratio}% más ligero</span>`;
                } else {
                    ratioEl.innerHTML = `<span style="color:#ffaa00;">+${Math.abs(ratio)}% peso (Textura cruda)</span>`;
                }
            }
        }

        renderPreview();
    }

    // Presets oficiales Arm ASTC: eliminan al 100% rellenos/distorsión y optimizan peso
    if (btnPresetStandard) {
        btnPresetStandard.addEventListener('click', () => {
            // Estándar Psych Mobile: 100% Escala · Bloque 6x6 · Calidad Exhaustiva
            if (selTextureScale) selTextureScale.value = '1.0';
            if (selBlockSize) selBlockSize.value = '6x6';
            if (selQuality) selQuality.value = 'thorough';
            if (chkCleanAlpha) chkCleanAlpha.checked = true;
            if (chkFlipY) chkFlipY.checked = false;
            updateEstimates();
        });
    }

    if (btnPresetReduced) {
        btnPresetReduced.addEventListener('click', () => {
            // Ahorro Balanceado Arm: 100% Escala · Bloque 8x8 (-44% peso vs 6x6 sin alterar resolución)
            if (selTextureScale) selTextureScale.value = '1.0';
            if (selBlockSize) selBlockSize.value = '8x8';
            if (selQuality) selQuality.value = 'thorough';
            if (chkCleanAlpha) chkCleanAlpha.checked = true;
            if (chkFlipY) chkFlipY.checked = false;
            updateEstimates();
        });
    }

    if (btnPresetUltraLight) {
        btnPresetUltraLight.addEventListener('click', () => {
            // Consejo Oficial Arm ASTC: Reduce resolución en vez de usar bloques extremos
            // 50% escala con bloque 8x8 o 6x6 produce texturas entre 80 KB y 300 KB impecables sin rellenos glitcheados
            if (selTextureScale) selTextureScale.value = '0.50';
            if (selBlockSize) selBlockSize.value = '8x8';
            if (selQuality) selQuality.value = 'thorough';
            if (chkCleanAlpha) chkCleanAlpha.checked = true;
            if (chkFlipY) chkFlipY.checked = false;
            updateEstimates();
        });
    }

    if (btnPresetPristine) {
        btnPresetPristine.addEventListener('click', () => {
            // Calidad Alta Arm para personajes principales: Bloque 5x5 (5.12 bpp)
            if (selTextureScale) selTextureScale.value = '1.0';
            if (selBlockSize) selBlockSize.value = '5x5';
            if (selQuality) selQuality.value = 'thorough';
            if (chkCleanAlpha) chkCleanAlpha.checked = true;
            if (chkFlipY) chkFlipY.checked = false;
            updateEstimates();
        });
    }

    // Input PNG listener
    if (pngFileInput) {
        pngFileInput.addEventListener('change', async (e) => {
            await window.validateAndProcessFile(e.target, 'png', {
                onSuccess: (file, img) => {
                    currentPngFile = file;
                    currentImage = img;
                    currentAstcResult = null;

                    // Ajuste estándar oficial Psych Mobile: Bloque 6x6, Calidad Exhaustiva (sin distorsión)
                    if (selBlockSize) selBlockSize.value = '6x6';
                    if (selQuality) selQuality.value = 'thorough';
                    if (selTextureScale) selTextureScale.value = '1.0';
                    if (chkCleanAlpha) chkCleanAlpha.checked = true;
                    if (chkFlipY) chkFlipY.checked = false;

                    if (lblPngBtn) {
                        lblPngBtn.textContent = `✓ PNG: ${file.name}`;
                    }
                    if (typeof window.setImportButtonState === 'function') {
                        window.setImportButtonState(btnUploadPng || e.target, 'success', { fileName: file.name });
                    }

                    updateEstimates();

                    if (configContainer) configContainer.style.display = 'block';
                    if (resultContainer) resultContainer.style.display = 'none';
                },
                onError: () => {
                    currentPngFile = null;
                    currentImage = null;
                    currentAstcResult = null;
                    if (lblPngBtn) {
                        lblPngBtn.textContent = '1. Subir Imagen .PNG';
                    }
                    if (typeof window.setImportButtonState === 'function') {
                        window.setImportButtonState(btnUploadPng || e.target, 'error');
                    }
                    if (configContainer) configContainer.style.display = 'none';
                    if (resultContainer) resultContainer.style.display = 'none';
                }
            });
        });
    }

    // Input XML listener (Sparrow Atlas base)
    if (xmlFileInput) {
        xmlFileInput.addEventListener('change', async (e) => {
            await window.validateAndProcessFile(e.target, 'xml', {
                onSuccess: (file, data) => {
                    const parsed = parseXmlSparrow(data.xmlDoc || data.text);
                    if (!parsed || parsed.count === 0) {
                        alert('⚠️ El archivo XML no contiene etiquetas <SubTexture> válidas.');
                        return;
                    }

                    currentXmlFile = file;
                    currentXmlData = parsed;

                    if (lblXmlBtn) {
                        lblXmlBtn.textContent = `✓ XML Base: ${file.name}`;
                    }
                    if (typeof window.setImportButtonState === 'function') {
                        window.setImportButtonState(btnUploadXml || e.target, 'success', { fileName: file.name });
                    }

                    if (xmlBaseBadge) {
                        xmlBaseBadge.style.display = 'flex';
                        if (xmlBaseTitle) xmlBaseTitle.textContent = `Base XML: ${file.name}`;
                        if (xmlBaseDetails) {
                            xmlBaseDetails.textContent = `${parsed.count} fotogramas analizados · Área de frames: ${parsed.maxX} × ${parsed.maxY} px`;
                        }
                    }

                    renderPreview();
                },
                onError: () => {
                    currentXmlFile = null;
                    currentXmlData = null;
                    if (lblXmlBtn) {
                        lblXmlBtn.textContent = '2. Subir Archivo .XML (Base de frames)';
                    }
                    if (xmlBaseBadge) xmlBaseBadge.style.display = 'none';
                    renderPreview();
                }
            });
        });
    }

    // Quitar XML vinculada
    if (btnRemoveXml) {
        btnRemoveXml.addEventListener('click', () => {
            currentXmlFile = null;
            currentXmlData = null;
            if (xmlFileInput) xmlFileInput.value = '';
            if (lblXmlBtn) lblXmlBtn.textContent = '2. Subir Archivo .XML (Base de frames)';
            if (typeof window.setImportButtonState === 'function') {
                window.setImportButtonState(btnUploadXml, 'reset');
            }
            if (xmlBaseBadge) xmlBaseBadge.style.display = 'none';
            renderPreview();
        });
    }

    if (chkShowXmlFrames) {
        chkShowXmlFrames.addEventListener('change', renderPreview);
    }

    if (chkFlipY) {
        chkFlipY.addEventListener('change', () => {
            renderPreview();
        });
    }

    if (selBlockSize) selBlockSize.addEventListener('change', updateEstimates);
    if (selTextureScale) selTextureScale.addEventListener('change', updateEstimates);
    if (selQuality) selQuality.addEventListener('change', updateEstimates);

    // Compresión ASTC Nativa
    if (btnCompress) {
        btnCompress.addEventListener('click', async () => {
            if (!currentImage) {
                alert('❌ Primero selecciona una imagen PNG válida.');
                return;
            }

            const { bx, by } = getSelectedBlock();
            const scale = getSelectedScale();
            const quality = selQuality ? (selQuality.value || 'fast') : 'fast';

            const origW = currentImage.naturalWidth || currentImage.width;
            const origH = currentImage.naturalHeight || currentImage.height;
            const targetW = Math.max(4, Math.round(origW * scale));
            const targetH = Math.max(4, Math.round(origH * scale));

            const isFlipped = chkFlipY && chkFlipY.checked;

            if (typeof mostrarCargaGlobal === 'function') {
                mostrarCargaGlobal(`Comprimiendo a ASTC Ligero (${targetW}×${targetH}, Bloque ${bx}×${by}, ${quality})...\nGenerando textura nativa para FNF Android.`);
            }

            try {
                await new Promise(r => setTimeout(r, 80)); // Permitir renderizado del loader

                // Crear lienzo con dimensiones finales
                const canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                // Si chkFlipY está activado por el usuario, invertir; si no, dejar de pie (orientación normal)
                if (isFlipped) {
                    ctx.save();
                    ctx.translate(0, targetH);
                    ctx.scale(1, -1);
                    ctx.drawImage(currentImage, 0, 0, targetW, targetH);
                    ctx.restore();
                } else {
                    ctx.drawImage(currentImage, 0, 0, targetW, targetH);
                }

                const startTime = performance.now();

                // Delegar compresión nativa ASTC con sangrado de color (Color Bleed) y ponderación alpha
                const result = await window.ASTCEngine.encodeCanvasToAstc(canvas, {
                    blockX: bx,
                    blockY: by,
                    quality: quality,
                    flipY: false,
                    bleedAlpha: chkCleanAlpha ? chkCleanAlpha.checked : true
                });

                const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

                currentAstcResult = {
                    ...result,
                    targetW,
                    targetH,
                    origW,
                    origH,
                    scale
                };

                // Llenar tarjeta de resultados
                const setRes = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = val;
                };
                setRes('resAstcSize', formatBytes(result.totalLength));
                setRes('resDimensions', `${targetW} × ${targetH} px`);
                setRes('resBlock', `${bx} × ${by}`);
                setRes('resBpp', `${result.bpp} bpp`);
                setRes('resElapsed', `${elapsed} seg`);

                if (resultContainer) {
                    resultContainer.style.display = 'block';
                    resultContainer.scrollIntoView({ behavior: 'smooth' });
                }

                if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
            } catch (err) {
                console.error('Error al codificar ASTC:', err);
                if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
                alert('❌ Error durante la compresión ASTC: ' + err.message);
            }
        });
    }

    // Descarga nativa exclusiva .ASTC (sin ZIP)
    if (btnDownloadAstc) {
        btnDownloadAstc.addEventListener('click', () => {
            if (!currentAstcResult || !currentAstcResult.astcBytes) {
                alert('❌ No hay ningún archivo ASTC comprimido para descargar.');
                return;
            }

            const baseName = currentPngFile ? currentPngFile.name.replace(/\.[^/.]+$/, '') : 'textura';
            const downloadName = baseName + '.astc';

            const blob = new Blob([currentAstcResult.astcBytes], { type: 'application/octet-stream' });
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

    // Drag & drop compatible con PNG y XML
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
            const files = Array.from(e.dataTransfer.files);
            const png = files.find(f => f.name.toLowerCase().endsWith('.png'));
            const xml = files.find(f => f.name.toLowerCase().endsWith('.xml'));

            if (png && pngFileInput) {
                const dt = new DataTransfer();
                dt.items.add(png);
                pngFileInput.files = dt.files;
                pngFileInput.dispatchEvent(new Event('change'));
            }
            if (xml && xmlFileInput) {
                const dt = new DataTransfer();
                dt.items.add(xml);
                xmlFileInput.files = dt.files;
                xmlFileInput.dispatchEvent(new Event('change'));
            }
        }
    });

})();
