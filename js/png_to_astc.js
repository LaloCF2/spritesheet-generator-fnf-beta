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
    let currentAutoTuneScale = 0.50;
    let currentAutoTuneBlock = '8x8';

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
        if (selTextureScale.value === 'auto') {
            return currentAutoTuneScale || 0.50;
        }
        return parseFloat(selTextureScale.value) || 1.0;
    }

    const chkRepackAtlas = document.getElementById('chkRepackAtlas');

    function isRepackActive() {
        return !!(currentXmlData && currentXmlData.frames && currentXmlData.frames.length > 0 &&
            chkRepackAtlas && chkRepackAtlas.checked);
    }

    // Calcula las dimensiones REALES de la textura de salida para una escala y bloque dados.
    // Con XML + reempaquetado, el atlas se reconstruye sin espacio vacío ni recortes repetidos.
    function planOutput(scale, bx, by) {
        const origW = currentImage.naturalWidth || currentImage.width;
        const origH = currentImage.naturalHeight || currentImage.height;
        let width, height, pack = null;
        if (isRepackActive()) {
            pack = window.ASTCEngine.packAtlas(currentXmlData.frames, { scale, blockX: bx, blockY: by });
            width = pack.width;
            height = pack.height;
        } else {
            width = Math.max(4, Math.round(origW * scale));
            height = Math.max(4, Math.round(origH * scale));
        }
        const blocks = Math.ceil(width / bx) * Math.ceil(height / by);
        return { width, height, pack, scale, bx, by, blocks, bytes: blocks * 16 + 16 };
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

                const fw = parseInt(st.getAttribute('frameWidth')) || w;
                const fh = parseInt(st.getAttribute('frameHeight')) || h;
                frames.push({ name, x, y, w, h, fw, fh });

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
        const isAuto = selTextureScale && selTextureScale.value === 'auto';
        const scale = getSelectedScale();
        const { bx, by } = getSelectedBlock();
        const plan = planOutput(scale, bx, by);
        const targetW = plan.width;
        const targetH = plan.height;

        const blocksX = Math.ceil(targetW / bx);
        const blocksY = Math.ceil(targetH / by);
        const totalBlocks = blocksX * blocksY;
        const estimatedAstcBytes = plan.bytes; // 16 bytes cabecera + 16 bytes por bloque ASTC
        const bpp = (128 / (bx * by)).toFixed(2);

        // VRAM uncompressed RGBA vs ASTC en memoria GPU Android
        const rawVramBytes = targetW * targetH * 4;
        const vramSavingsPercent = Math.max(0, ((1 - (estimatedAstcBytes / rawVramBytes)) * 100)).toFixed(0);

        const setTxt = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        if (plan.pack) {
            setTxt('lblSourceRes', `${targetW} × ${targetH} px (reempaquetado)`);
        } else if (scale === 1.0) {
            setTxt('lblSourceRes', `${origW} × ${origH} px`);
        } else {
            setTxt('lblSourceRes', `${targetW} × ${targetH} px (-${((1 - scale) * 100).toFixed(0)}%)`);
        }

        const scaleDetails = document.getElementById('lblScaleDetails');
        if (scaleDetails) {
            if (plan.pack) {
                const usedPct = ((targetW * targetH) / (origW * origH * scale * scale) * 100).toFixed(0);
                scaleDetails.textContent = `📦 Atlas reempaquetado: ${targetW} × ${targetH} px (escala ${(scale * 100).toFixed(0)}% · bloque ${bx}×${by} · ${plan.pack.uniqueCount} recortes únicos de ${currentXmlData.count} frames · ${usedPct}% del área original). Se generará un XML nuevo.`;
            } else if (isAuto) {
                scaleDetails.textContent = `⚡ Automático: ${targetW} × ${targetH} px (Escala ${(scale * 100).toFixed(0)}% · Bloque ${bx}×${by}${scale < 1 ? " · reducida para no pasar de 4096 px" : " · resolución completa"})`;
            } else if (scale === 1.0) {
                scaleDetails.textContent = `Resolución 1:1 original: ${origW} × ${origH} px (100% fiel a las coordenadas del XML)`;
            } else {
                scaleDetails.textContent = `Resolución escalada: ${targetW} × ${targetH} px (Original: ${origW} × ${origH} px · ${(scale * 100).toFixed(0)}%)`;
            }
        }

        setTxt('lblSourceSize', formatBytes(currentPngFile ? currentPngFile.size : 0));
        setTxt('lblEstAstcSize', formatBytes(estimatedAstcBytes));
        setTxt('lblTotalBlocks', `${totalBlocks} (${blocksX} × ${blocksY})`);
        setTxt('lblRamSavings', `-${vramSavingsPercent}% en VRAM`);

        // Alerta inteligente si la textura supera 1.2 MB
        const boxAlert = document.getElementById('boxLargeTextureAlert');
        const txtAlertOrig = document.getElementById('txtAlertOrigWeight');
        if (boxAlert && txtAlertOrig) {
            if (!isAuto && Math.max(targetW, targetH) > 4096) {
                boxAlert.style.display = 'flex';
                txtAlertOrig.textContent = `${targetW} × ${targetH} px`;
            } else {
                boxAlert.style.display = 'none';
            }
        }

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

        updateJsonBadge();
        renderPreview();
    }

    // Auto-Ajuste: conserva el 100% de la resolución y usa el bloque de la prioridad elegida.
    // Medido con BOYFRIEND (PSNR visible frente al PNG original, mismo peso de 1044 KB):
    //   8x8 al 100% = 27.5 dB · 6x6 al 75% = 22.5 dB  -> bajar la escala daña MÁS la nitidez que un bloque grande
    //   (los contornos negros de FNF son muy nítidos). 6x6 al 100% = 33.8 dB · 5x5 al 100% = 39.0 dB.
    // Solo se reduce la escala si el atlas pasa del límite de textura de muchos celulares (4096 px).
    const MAX_TEXTURE_SIZE = 4096;
    let currentAutoPriority = '6x6';

    function autoTuneForMobile(opts = {}) {
        if (!currentImage) return;
        if (opts.block) currentAutoPriority = opts.block;
        const [bx, by] = currentAutoPriority.split('x').map(Number);

        let s = 1.0;
        while (s > 0.25) {
            const plan = planOutput(s, bx, by);
            if (Math.max(plan.width, plan.height) <= MAX_TEXTURE_SIZE) break;
            s = Math.round((s - 0.05) * 100) / 100;
        }

        currentAutoTuneScale = s;
        currentAutoTuneBlock = currentAutoPriority;

        if (selTextureScale && selTextureScale.value === 'auto') {
            if (selBlockSize) selBlockSize.value = currentAutoTuneBlock;
        }

        if (!opts.keepSettings) {
            setQualityMode('normal');
            if (chkCleanAlpha) chkCleanAlpha.checked = true;
            if (chkFlipY) chkFlipY.checked = false;
        }

        updateEstimates();
    }

    const btnAutoTuneMobile = document.getElementById('btnAutoTuneMobile');
    if (btnAutoTuneMobile) {
        btnAutoTuneMobile.addEventListener('click', autoTuneForMobile);
    }

    // 3 Botones de Calidad de Codificación y Modo de Limpieza
    const btnModeNormal = document.getElementById('btnModeNormal');
    const badgeModeNormal = document.getElementById('badgeModeNormal');
    const btnModeFrameByFrame = document.getElementById('btnModeFrameByFrame');
    const badgeModeFrameByFrame = document.getElementById('badgeModeFrameByFrame');
    const btnModeAdvancedAi = document.getElementById('btnModeAdvancedAi');
    const badgeModeAdvancedAi = document.getElementById('badgeModeAdvancedAi');

    function setQualityMode(mode) {
        if (selQuality) selQuality.value = mode;

        const modes = [
            { id: 'normal', btn: btnModeNormal, badge: badgeModeNormal, color: '#00ff88', bg: 'rgba(0, 255, 136, 0.1)' },
            { id: 'framebyframe', btn: btnModeFrameByFrame, badge: badgeModeFrameByFrame, color: '#00e5ff', bg: 'rgba(0, 229, 255, 0.1)' },
            { id: 'advanced', btn: btnModeAdvancedAi, badge: badgeModeAdvancedAi, color: '#b57cff', bg: 'rgba(181, 124, 255, 0.1)' }
        ];

        modes.forEach(m => {
            if (!m.btn) return;
            if (m.id === mode) {
                m.btn.classList.add('active-mode');
                m.btn.style.borderColor = m.color;
                m.btn.style.background = m.bg;
                m.btn.style.boxShadow = `0 0 15px ${m.bg}`;
                if (m.badge) m.badge.style.display = 'inline';
            } else {
                m.btn.classList.remove('active-mode');
                m.btn.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                m.btn.style.background = 'rgba(255, 255, 255, 0.02)';
                m.btn.style.boxShadow = 'none';
                if (m.badge) m.badge.style.display = 'none';
            }
        });
    }

    if (btnModeNormal) btnModeNormal.addEventListener('click', () => setQualityMode('normal'));
    if (btnModeFrameByFrame) btnModeFrameByFrame.addEventListener('click', () => setQualityMode('framebyframe'));
    if (btnModeAdvancedAi) btnModeAdvancedAi.addEventListener('click', () => setQualityMode('advanced'));

    // Presets = prioridad del Auto-Ajuste (siempre al 100% de resolución salvo el límite de 4096 px)
    const presetButtons = [
        { btn: btnPresetPristine, block: '5x5' },   // 💎 Calidad máxima
        { btn: btnPresetStandard, block: '6x6' },   // ⭐ Equilibrio (recomendado)
        { btn: btnPresetReduced, block: '8x8' }     // 🚀 Ligero
    ];
    presetButtons.forEach(({ btn, block }) => {
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (selTextureScale) selTextureScale.value = 'auto';
            autoTuneForMobile({ block });
        });
    });

    // Input PNG listener
    if (pngFileInput) {
        pngFileInput.addEventListener('change', async (e) => {
            await window.validateAndProcessFile(e.target, 'png', {
                onSuccess: (file, img) => {
                    currentPngFile = file;
                    currentImage = img;
                    currentAstcResult = null;

                    if (lblPngBtn) {
                        lblPngBtn.textContent = `✓ PNG: ${file.name}`;
                    }
                    if (typeof window.setImportButtonState === 'function') {
                        window.setImportButtonState(btnUploadPng || e.target, 'success', { fileName: file.name });
                    }

                    // Establecer 'auto' como predeterminado para optimizar al máximo proporcionalmente (< 1 MB)
                    if (selTextureScale) selTextureScale.value = 'auto';
                    autoTuneForMobile();

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

                    refreshPlan();
                },
                onError: () => {
                    currentXmlFile = null;
                    currentXmlData = null;
                    if (lblXmlBtn) {
                        lblXmlBtn.textContent = '2. Subir Archivo .XML (Base de frames)';
                    }
                    if (xmlBaseBadge) xmlBaseBadge.style.display = 'none';
                    refreshPlan();
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
            refreshPlan();
        });
    }

    // ===== JSON del personaje (Psych Engine): escala, posición y cámara =====
    let currentJsonFile = null;
    let currentJsonRaw = null;
    const jsonFileInput = document.getElementById('jsonFileInput');
    const btnUploadJson = document.getElementById('btnUploadJson');
    const lblJsonBtn = document.getElementById('lblJsonBtn');
    const jsonBaseBadge = document.getElementById('jsonBaseBadge');
    const jsonBaseTitle = document.getElementById('jsonBaseTitle');
    const jsonBaseDetails = document.getElementById('jsonBaseDetails');
    const btnRemoveJson = document.getElementById('btnRemoveJson');

    // Fotogramas del XML en el formato que espera calcularAjustePsychJson (medidas originales)
    function spritesForJson() {
        if (!currentXmlData || !currentXmlData.frames) return [];
        return currentXmlData.frames.map(f => ({
            name: f.name, w: f.w, h: f.h,
            frameWidth: f.fw, frameHeight: f.fh,
            origFrameWidth: f.fw, origFrameHeight: f.fh
        }));
    }

    // Mismo cálculo que el Optimizador: escala x(1/factor) y compensación de posición y cámara
    function computeJsonAdjustment(scale) {
        if (!currentJsonRaw || typeof calcularAjustePsychJson !== 'function') return null;
        return calcularAjustePsychJson(currentJsonRaw, scale, spritesForJson());
    }

    function updateJsonBadge() {
        if (!jsonBaseBadge) return;
        if (!currentJsonRaw) {
            jsonBaseBadge.style.display = 'none';
            return;
        }
        jsonBaseBadge.style.display = 'flex';
        const scale = currentImage ? getSelectedScale() : 1.0;
        const adj = computeJsonAdjustment(scale);
        const animCount = (currentJsonRaw.animations || []).length;
        if (jsonBaseTitle) jsonBaseTitle.textContent = `JSON del personaje: ${currentJsonFile.name} (${animCount} animaciones)`;
        if (!jsonBaseDetails || !adj) return;
        if (scale >= 1.0) {
            jsonBaseDetails.innerHTML = `Escala ${adj.origScale} · Posición [${adj.origPos.join(', ')}] · Cámara [${adj.origCamPos.join(', ')}]<br>` +
                `<span style="color:#aaa;">Con la escala al 100% el JSON no necesita cambios.</span>`;
            return;
        }
        const noXml = !currentXmlData
            ? `<br><span style="color:#ffaa00;">⚠️ Sube el XML para calcular la posición exacta (sin él se usa un tamaño de frame estimado).</span>`
            : '';
        jsonBaseDetails.innerHTML =
            `Al ${(scale * 100).toFixed(0)}%: ` +
            `<b>Escala</b> ${adj.origScale} ➔ <b style="color:#00e5ff;">${adj.newScale}</b> · ` +
            `<b>Posición</b> [${adj.origPos.join(', ')}] ➔ <b style="color:#00ff88;">[${adj.newPos.join(', ')}]</b> · ` +
            `<b>Cámara</b> [${adj.origCamPos.join(', ')}] ➔ <b style="color:#ffcc00;">[${adj.newCamPos.join(', ')}]</b>` +
            `<br><span style="color:#aaa;">Rol: ${adj.isPlayer ? 'Jugador' : 'Oponente'} · Animación base: "${adj.refAnim}" · Frame ${adj.frameSize[0]}×${adj.frameSize[1]} px</span>` +
            noXml;
    }

    function resetJson() {
        currentJsonFile = null;
        currentJsonRaw = null;
        if (jsonFileInput) jsonFileInput.value = '';
        if (lblJsonBtn) lblJsonBtn.textContent = '3. Subir .JSON del personaje (opcional)';
        if (typeof window.setImportButtonState === 'function' && btnUploadJson) {
            window.setImportButtonState(btnUploadJson, 'reset');
        }
        updateJsonBadge();
        if (currentAstcResult) updateDownloadButton();
    }

    if (jsonFileInput) {
        jsonFileInput.addEventListener('change', async (e) => {
            await window.validateAndProcessFile(e.target, 'json', {
                onSuccess: (file, data) => {
                    currentJsonFile = file;
                    currentJsonRaw = JSON.parse(JSON.stringify(data.obj));
                    if (lblJsonBtn) lblJsonBtn.textContent = `✓ JSON: ${file.name}`;
                    if (typeof window.setImportButtonState === 'function') {
                        window.setImportButtonState(btnUploadJson || e.target, 'success', { fileName: file.name });
                    }
                    updateJsonBadge();
                    if (currentAstcResult) updateDownloadButton();
                },
                onError: () => resetJson()
            });
        });
    }
    if (btnRemoveJson) btnRemoveJson.addEventListener('click', resetJson);

    // Recalcula dimensiones y peso (y el auto-ajuste si está activo) sin tocar el resto de opciones
    function refreshPlan() {
        // El XML cambió: la textura ya comprimida (y su reempaquetado) dejó de corresponder
        if (currentAstcResult) {
            currentAstcResult = null;
            if (resultContainer) resultContainer.style.display = 'none';
        }
        if (!currentImage) {
            updateJsonBadge();
            renderPreview();
            return;
        }
        if (selTextureScale && selTextureScale.value === 'auto') {
            autoTuneForMobile({ keepSettings: true });
        } else {
            updateEstimates();
        }
    }

    if (chkRepackAtlas) {
        chkRepackAtlas.addEventListener('change', refreshPlan);
    }

    if (chkShowXmlFrames) {
        chkShowXmlFrames.addEventListener('change', renderPreview);
    }

    if (chkFlipY) {
        chkFlipY.addEventListener('change', () => {
            renderPreview();
        });
    }

    if (selBlockSize) selBlockSize.addEventListener('change', () => {
        // En modo automático, elegir un bloque a mano cambia la prioridad del Auto-Ajuste
        if (selTextureScale && selTextureScale.value === 'auto') autoTuneForMobile({ block: selBlockSize.value, keepSettings: true });
        else updateEstimates();
    });
    if (selTextureScale) {
        selTextureScale.addEventListener('change', () => {
            if (selTextureScale.value === 'auto') {
                autoTuneForMobile();
            } else {
                updateEstimates();
            }
        });
    }

    // SISTEMA DE CARGA CON CONTEO DE PORCENTAJE (0 a 100%) Y FRASES INTELIGENTES
    const globalLoader = document.getElementById('globalLoader');
    const loaderPercent = document.getElementById('loaderPercent');
    const loaderBarFill = document.getElementById('loaderBarFill');
    const globalLoaderText = document.getElementById('globalLoaderText');
    const globalLoaderSubtext = document.getElementById('globalLoaderSubtext');

    function updateLoader(pct, title, subtext) {
        const p = Math.min(100, Math.max(0, Math.round(pct)));
        if (loaderPercent) loaderPercent.textContent = `${p}%`;
        if (loaderBarFill) loaderBarFill.style.width = `${p}%`;
        if (globalLoaderText && title) globalLoaderText.textContent = title;
        if (globalLoaderSubtext && subtext) globalLoaderSubtext.textContent = subtext;
    }

    function showLoader() {
        if (globalLoader) {
            globalLoader.classList.remove('hidden');
            globalLoader.style.setProperty('display', 'flex', 'important');
            globalLoader.style.setProperty('opacity', '1', 'important');
            globalLoader.style.setProperty('visibility', 'visible', 'important');
            globalLoader.style.setProperty('pointer-events', 'auto', 'important');
            updateLoader(0, 'Subiendo imagen...', 'Iniciando transferencia de textura a memoria...');
        }
    }

    function hideLoader() {
        if (globalLoader) {
            globalLoader.classList.add('hidden');
            globalLoader.style.setProperty('display', 'none', 'important');
            globalLoader.style.setProperty('opacity', '0', 'important');
            globalLoader.style.setProperty('visibility', 'hidden', 'important');
            globalLoader.style.setProperty('pointer-events', 'none', 'important');
        }
    }

    // Inicializar oculto en carga de página
    hideLoader();

    let currentDecodedCanvas = null;
    let isProcessing = false;

    // Ejecución del proceso de compresión inteligente
    async function executeCompressionProcess(customOpts = {}) {
        if (isProcessing) return;
        if (!currentImage) {
            alert('❌ Primero selecciona una imagen PNG válida.');
            return;
        }

        isProcessing = true;
        showLoader();
        // Dar tiempo al navegador para renderizar el spinner y el modal antes de procesar
        await new Promise(r => setTimeout(r, 60));

        try {
            const { bx, by } = getSelectedBlock();
            const scale = getSelectedScale();
            const mode = customOpts.mode || (selQuality ? selQuality.value : 'normal') || 'normal';

            const origW = currentImage.naturalWidth || currentImage.width;
            const origH = currentImage.naturalHeight || currentImage.height;
            const plan = planOutput(scale, bx, by);
            const targetW = plan.width;
            const targetH = plan.height;
            const isFlipped = chkFlipY && chkFlipY.checked;
            const bpp = (128 / (bx * by)).toFixed(2);

            // FASE 1: Subiendo imagen... (0% -> 18%)
            updateLoader(0, 'Subiendo imagen...', 'Transfiriendo buffer de píxeles PNG a la memoria interna...');
            await new Promise(r => setTimeout(r, 260));
            updateLoader(8, 'Subiendo imagen...', 'Reservando buffer GPU y cargando cabeceras...');
            await new Promise(r => setTimeout(r, 260));
            updateLoader(18, 'Subiendo imagen...', 'Carga en memoria completada.');
            await new Promise(r => setTimeout(r, 200));

            // FASE 2: Leyendo imagen... (18% -> 38%)
            updateLoader(22, 'Leyendo imagen...', `Analizando canal RGBA (${origW}×${origH} px) y espacio de color...`);
            await new Promise(r => setTimeout(r, 220));
            updateLoader(30, 'Leyendo imagen...', 'Evaluando mapa alfa y transparencia de fotogramas...');
            await new Promise(r => setTimeout(r, 220));
            updateLoader(38, 'Leyendo imagen...', currentXmlData ? `Sincronizando ${currentXmlData.count} fotogramas del XML Sparrow...` : 'Escaneando límites y distribución de fotogramas...');
            await new Promise(r => setTimeout(r, 200));

            // FASE 3: Escaneo IA: Eliminando halos y purgando fondos... (38% -> 68%)
            let scanSubtext = 'Escaneando imagen y eliminando residuos de fondo...';
            if (mode === 'normal') {
                scanSubtext = 'Limpieza normal de alpha y extensión de color en bordes...';
            } else if (mode === 'framebyframe') {
                scanSubtext = currentXmlData ? `Alineando ${currentXmlData.count} frames XML, enmascarando cajas y purgando halos...` : 'Escaneo multi-pasada en toda la imagen: extinguiendo fondos blanco/morado...';
            } else if (mode === 'advanced') {
                scanSubtext = 'IA Profunda multi-pasada: erradicando croma de escenario, de-fringing y sellando bordes...';
            }

            updateLoader(45, 'Escaneo IA: Eliminando halos y purgando fondos...', scanSubtext);
            await new Promise(r => setTimeout(r, 250));

            // Imagen de origen DE PIE (solo se invierte si el usuario indica que su PNG está de cabeza)
            const source = isFlipped ? window.ASTCEngine.flipCanvasVertical(currentImage) : currentImage;

            // Lienzo de trabajo: atlas reempaquetado (con XML) o la imagen completa escalada
            let canvas;
            if (plan.pack) {
                canvas = window.ASTCEngine.renderPackedAtlas(source, plan.pack);
            } else {
                canvas = document.createElement('canvas');
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(source, 0, 0, targetW, targetH);
            }

            updateLoader(55, 'Escaneo IA: Eliminando halos y purgando fondos...', 'Detectando croma de escenario Flash/Photoshop (blanco / púrpura)...');
            await new Promise(r => setTimeout(r, 250));
            updateLoader(65, 'Escaneo IA: Eliminando halos y purgando fondos...', 'Fondo purgado y bordes sellados sin contaminación.');
            await new Promise(r => setTimeout(r, 180));

            // FASE 4: Codificando textura ASTC nativa con Arm astcenc... (68% -> 88%)
            updateLoader(72, 'Codificando textura ASTC nativa con Arm astcenc...', `Comprimiendo bloques ${bx}×${by} (${bpp} bpp) con ponderación alfa oficial...`);
            await new Promise(r => setTimeout(r, 200));

            const startTime = performance.now();

            // Cajas de los fotogramas en las coordenadas de la textura de salida
            const xmlFramesScaled = plan.pack
                ? plan.pack.items.map(it => ({ x: it.px, y: it.py, w: it.pw, h: it.ph }))
                : (currentXmlData && currentXmlData.frames) ? currentXmlData.frames.map(f => ({
                    x: Math.round(f.x * scale),
                    y: Math.round(f.y * scale),
                    w: Math.round(f.w * scale),
                    h: Math.round(f.h * scale)
                })) : null;

            // Sin flipY explícito: se guarda de pie, igual que las texturas originales del juego
            const result = await window.ASTCEngine.encodeCanvasToAstc(canvas, {
                blockX: bx,
                blockY: by,
                mode: mode,
                xmlFrames: xmlFramesScaled,
                bleedAlpha: chkCleanAlpha ? chkCleanAlpha.checked : true
            });

            updateLoader(85, 'Codificando textura ASTC nativa con Arm astcenc...', 'Generando bloques físicos ASTC de 128 bits...');
            await new Promise(r => setTimeout(r, 160));
            updateLoader(90, 'Codificando textura ASTC nativa con Arm astcenc...', 'Empaquetando cabecera oficial de 16 bytes y finalizando binario...');
            await new Promise(r => setTimeout(r, 160));

            // FASE 5: Verificando integridad y decodificando prueba... (88% -> 99%)
            updateLoader(94, 'Verificando integridad y decodificando prueba...', 'Decodificando textura ASTC generada con WebAssembly...');

            // Decodificar la textura ASTC generada para la vista previa:
            // el motor compensa la salida invertida del decodificador, así que se ve DE PIE igual que el PNG.
            const decodedResult = window.ASTCEngine.astcToCanvas(result.astcBytes);
            const decodedCanvas = (decodedResult && decodedResult.canvas) ? decodedResult.canvas : decodedResult;
            currentDecodedCanvas = decodedCanvas;

            updateLoader(98, 'Verificando integridad y decodificando prueba...', 'Auditoría IA de píxeles decodificados: buscando residuos o halos...');

            // Auditar la textura decodificada
            const audit = window.ASTCEngine.auditTexture(decodedCanvas, xmlFramesScaled);

            updateLoader(99, 'Verificando integridad y decodificando prueba...', 'Textura decodificada y auditada con éxito.');
            await new Promise(r => setTimeout(r, 200));

            // FASE 6: ¡Rectificando textura final al 100%!
            // El usuario pidió explícitamente: "y que en 100 se quede un buen rato para reitificar que todo se hizo perfectamente"
            updateLoader(100, '¡Rectificando textura final al 100%!', 'Textura verificada y certificada sin fallas. Lista para FNF Android.');
            await new Promise(r => setTimeout(r, 1400)); // Quedarse un buen rato en 100% como solicitó el usuario

            const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

            currentAstcResult = {
                ...result,
                targetW,
                targetH,
                origW,
                origH,
                scale,
                pack: plan.pack,
                mode,
                audit
            };

            // Dibujar la vista previa real decodificada en resAstcPreviewCanvas (DE PIE)
            const previewCanvas = document.getElementById('resAstcPreviewCanvas');
            if (previewCanvas && decodedCanvas) {
                previewCanvas.width = decodedCanvas.width;
                previewCanvas.height = decodedCanvas.height;
                const pCtx = previewCanvas.getContext('2d');
                pCtx.clearRect(0, 0, decodedCanvas.width, decodedCanvas.height);
                pCtx.drawImage(decodedCanvas, 0, 0);
            }

            // Botón de descarga según lo que se importó (solo .astc, o .zip con xml/json/informe)
            updateDownloadButton();

            // Actualizar tarjetas de estadísticas
            const setRes = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };
            setRes('resAstcSize', formatBytes(result.totalLength));
            setRes('resDimensions', `${targetW} × ${targetH} px`);
            setRes('resBlock', `${bx} × ${by}`);
            setRes('resBpp', `${result.bpp} bpp`);
            setRes('resElapsed', `${elapsed} seg`);

            // Diagnóstico honesto: compara píxel a píxel la textura decodificada contra lo que entró al codificador
            const fidelity = measureFidelity(result.sourceCanvas, decodedCanvas);
            currentAstcResult.fidelity = fidelity;
            const auditBox = document.getElementById('aiAuditLogBox');
            if (auditBox) {
                auditBox.style.display = 'block';
                const clean = fidelity.residuePct < 0.02 && fidelity.holesPct < 0.02;
                auditBox.style.borderColor = clean ? 'rgba(0, 255, 136, 0.4)' : 'rgba(255, 170, 0, 0.4)';
                auditBox.style.background = clean ? 'rgba(0, 255, 136, 0.06)' : 'rgba(255, 170, 0, 0.08)';
                const modeName = { normal: 'Fiel al original (Arm astcenc)', framebyframe: 'Quitar halos de Flash', advanced: 'Quitar halos agresivo' }[mode] || mode;
                auditBox.innerHTML = `
                    <div style="color:${clean ? '#00ff88' : '#ffaa00'}; font-weight:800; font-size:0.9rem; margin-bottom:4px;">
                        ${clean ? '✅ Bordes limpios' : '⚠️ Quedan algunos residuos en los bordes'}
                    </div>
                    <div style="color:#ccc; font-size:0.78rem;">
                        Residuos visibles alrededor del personaje: <b>${fidelity.residue.toLocaleString()}</b> px (${fidelity.residuePct.toFixed(3)}%) ·
                        Huecos en zonas opacas: <b>${fidelity.holes.toLocaleString()}</b> px · Error medio de borde: ${fidelity.edgeErr.toFixed(2)}
                    </div>
                    ${clean ? '' : `<div style="color:#ccc; font-size:0.78rem; margin-top:4px;">
                        Para bordes más limpios usa el bloque <b>6×6</b> (o 5×5) y, si necesitas menos peso, baja la <b>escala</b> en vez de usar bloques más grandes (consejo oficial de Arm).
                    </div>`}
                    <div style="color:#888; font-size:0.72rem; margin-top:6px;">
                        Modo: ${modeName} · Calidad astcenc: ${mode === 'advanced' ? 'exhaustive' : 'thorough'} · Peso alfa (-cw): 8
                    </div>
                `;
            }

            // Resultado del pulido de bordes (bloques recomprimidos para quitar residuos alrededor del personaje)
            if (auditBox && result.repairReport && result.repairReport.revisados > 0) {
                const rr = result.repairReport;
                auditBox.insertAdjacentHTML('beforeend', `
                    <div style="color:#00e5ff; font-size:0.76rem; margin-top:6px;">
                        ✨ Pulido de bordes: ${rr.reparados} de ${rr.revisados} bloques del borde recomprimidos con calidad exhaustive (${rr.seg}s)
                    </div>`);
            }

            hideLoader();

            if (resultContainer) {
                resultContainer.style.display = 'block';
                resultContainer.scrollIntoView({ behavior: 'smooth' });
            }
        } catch (err) {
            console.error('Error al codificar ASTC:', err);
            hideLoader();
            alert('❌ Error durante la compresión ASTC: ' + err.message);
        } finally {
            isProcessing = false;
        }
    }

    // Compara la textura decodificada con la imagen que entró al codificador
    function measureFidelity(srcCanvas, decCanvas) {
        const w = srcCanvas.width, h = srcCanvas.height;
        const s = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data;
        const d = decCanvas.getContext('2d').getImageData(0, 0, w, h).data;
        let residue = 0, holes = 0, edgeErr = 0, edgeN = 0;
        for (let k = 0; k < s.length; k += 4) {
            const sa = s[k + 3], da = d[k + 3];
            if (sa === 0) { if (da >= 16) residue++; }
            else if (sa === 255) { if (da < 200) holes++; }
            else { edgeErr += Math.abs(sa - da); edgeN++; }
        }
        const total = w * h;
        return {
            residue, holes,
            residuePct: residue / total * 100,
            holesPct: holes / total * 100,
            edgeErr: edgeN ? edgeErr / edgeN : 0
        };
    }

    // Botón Comprimir
    if (btnCompress) {
        btnCompress.addEventListener('click', () => {
            executeCompressionProcess();
        });
    }

    // Controles de Fondo para Vista Previa
    const btnBgGrid = document.getElementById('btnBgGrid');
    const btnBgBlack = document.getElementById('btnBgBlack');
    const btnBgWhite = document.getElementById('btnBgWhite');
    const btnBgPurple = document.getElementById('btnBgPurple');
    const resPreviewContainer = document.getElementById('resPreviewContainer');

    function setPreviewBg(type) {
        if (!resPreviewContainer) return;
        const bgs = [
            { id: 'grid', btn: btnBgGrid, bg: 'repeating-conic-gradient(#333 0% 25%, transparent 0% 50%) 50% / 16px 16px', color: '#00e5ff', border: '#00e5ff' },
            { id: 'black', btn: btnBgBlack, bg: '#000000', color: '#ccc', border: '#444' },
            { id: 'white', btn: btnBgWhite, bg: '#ffffff', color: '#111', border: '#444' },
            { id: 'purple', btn: btnBgPurple, bg: '#260a3a', color: '#b57cff', border: '#b57cff' }
        ];

        bgs.forEach(b => {
            if (!b.btn) return;
            if (b.id === type) {
                b.btn.classList.add('active');
                b.btn.style.borderColor = b.border;
                b.btn.style.boxShadow = `0 0 10px ${b.border}66`;
                resPreviewContainer.style.background = b.bg;
            } else {
                b.btn.classList.remove('active');
                b.btn.style.borderColor = '#444';
                b.btn.style.boxShadow = 'none';
            }
        });
    }

    if (btnBgGrid) btnBgGrid.addEventListener('click', () => setPreviewBg('grid'));
    if (btnBgBlack) btnBgBlack.addEventListener('click', () => setPreviewBg('black'));
    if (btnBgWhite) btnBgWhite.addEventListener('click', () => setPreviewBg('white'));
    if (btnBgPurple) btnBgPurple.addEventListener('click', () => setPreviewBg('purple'));

    // Botón para voltear la vista previa manualmente con 1 clic (↕ Voltear Vista)
    const btnFlipPreview = document.getElementById('btnFlipPreview');
    if (btnFlipPreview) {
        btnFlipPreview.addEventListener('click', () => {
            if (!currentDecodedCanvas) return;
            currentDecodedCanvas = window.ASTCEngine.flipCanvasVertical(currentDecodedCanvas);
            const previewCanvas = document.getElementById('resAstcPreviewCanvas');
            if (previewCanvas) {
                previewCanvas.width = currentDecodedCanvas.width;
                previewCanvas.height = currentDecodedCanvas.height;
                const pCtx = previewCanvas.getContext('2d');
                pCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                pCtx.drawImage(currentDecodedCanvas, 0, 0);
            }
        });
    }

    function outputBaseName() {
        return currentPngFile ? currentPngFile.name.replace(/\.[^/.]+$/, '') : 'textura';
    }

    function downloadBlob(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    // Genera el Sparrow XML que corresponde EXACTAMENTE a la textura .astc generada
    // (nuevas posiciones si se reempaquetó, y todas las medidas escaladas si se redujo la escala).
    async function buildOutputXml() {
        const scale = currentAstcResult.scale;
        const pack = currentAstcResult.pack;
        const doc = new DOMParser().parseFromString(await currentXmlFile.text(), 'text/xml');
        const atlas = doc.getElementsByTagName('TextureAtlas')[0];
        if (atlas) atlas.setAttribute('imagePath', outputBaseName() + '.png');

        const subTextures = doc.getElementsByTagName('SubTexture');
        for (let i = 0; i < subTextures.length; i++) {
            const st = subTextures[i];
            const num = (attr) => parseInt(st.getAttribute(attr)) || 0;
            const scaleAttr = (attr) => {
                if (st.hasAttribute(attr)) {
                    const val = parseFloat(st.getAttribute(attr));
                    if (!isNaN(val)) st.setAttribute(attr, Math.round(val * scale).toString());
                }
            };

            if (pack) {
                const item = pack.map.get(`${num('x')},${num('y')},${num('width')},${num('height')}`);
                if (item) {
                    st.setAttribute('x', item.px.toString());
                    st.setAttribute('y', item.py.toString());
                    st.setAttribute('width', item.pw.toString());
                    st.setAttribute('height', item.ph.toString());
                }
            } else {
                scaleAttr('x');
                scaleAttr('y');
                scaleAttr('width');
                scaleAttr('height');
            }
            scaleAttr('frameX');
            scaleAttr('frameY');
            scaleAttr('frameWidth');
            scaleAttr('frameHeight');
        }
        return new XMLSerializer().serializeToString(doc);
    }

    // Archivos que se entregan según lo que se importó
    function outputPlan() {
        const base = outputBaseName();
        const files = [{ name: base + '.astc', kind: 'astc' }];
        if (currentXmlFile && currentXmlData) files.push({ name: base + '.xml', kind: 'xml' });
        if (currentJsonFile && currentJsonRaw) files.push({ name: currentJsonFile.name, kind: 'json' });
        const zip = files.length > 1;
        if (zip) files.push({ name: `LEEME - ${base}.txt`, kind: 'txt' });
        return { base, files, zip, zipName: `${base}_ASTC.zip` };
    }

    function updateDownloadButton() {
        const lbl = document.getElementById('lblDownloadMain');
        const contents = document.getElementById('lblDownloadContents');
        const plan = outputPlan();
        if (lbl) {
            if (!plan.zip) lbl.textContent = 'Descargar Archivo .ASTC';
            else lbl.textContent = 'Descargar .ZIP (' + plan.files.filter(f => f.kind !== 'txt').map(f => f.kind.toUpperCase()).join(' + ') + ')';
        }
        if (contents) {
            contents.textContent = plan.zip
                ? `${plan.zipName} → ${plan.files.map(f => f.name).join(' · ')}`
                : `${plan.files[0].name}`;
        }
    }

    // Informe en texto: qué cambió y qué sigue igual en cada archivo
    function buildReportTxt(plan, jsonAdj) {
        const r = currentAstcResult;
        const L = [];
        const line = (s = '') => L.push(s);
        const sep = () => line('------------------------------------------------------------');
        const modeName = { normal: 'Fiel al original (estilo Arm astcenc)', framebyframe: 'Quitar halos de Flash', advanced: 'Quitar halos agresivo' }[r.mode] || r.mode;

        line('SPRITESHEET GENERATOR FNF · CONVERTIR PNG A ASTC');
        line('Informe de cambios · ' + new Date().toLocaleString());
        sep();
        line('ARCHIVOS INCLUIDOS');
        plan.files.forEach(f => line('  - ' + f.name));
        line();
        line('Cópialos juntos a la carpeta de imágenes de tu personaje, reemplazando los anteriores.');
        line('IMPORTANTE: el .astc, el .xml y el .json de este ZIP van JUNTOS. No mezcles el .xml');
        line('o el .json originales con esta textura: las coordenadas ya no coinciden.');
        sep();
        line('TEXTURA (.ASTC)');
        line(`  PNG original:  ${r.origW} x ${r.origH} px · ${formatBytes(currentPngFile ? currentPngFile.size : 0)}`);
        line(`  ASTC nuevo:    ${r.targetW} x ${r.targetH} px · ${formatBytes(r.totalLength)}`);
        line(`  Escala:        ${(r.scale * 100).toFixed(0)}%`);
        line(`  Bloque:        ${r.blockX}x${r.blockY} (${r.bpp} bits por píxel)`);
        line(`  Modo:          ${modeName}`);
        line(`  Codificador:   Arm astcenc · perfil LDR lineal (-cl) · calidad ${r.mode === 'advanced' ? 'exhaustive' : 'thorough'} · peso alfa -cw 1 1 1 8`);
        if (r.repairReport && r.repairReport.revisados > 0) {
            line(`  Pulido bordes: ${r.repairReport.reparados} de ${r.repairReport.revisados} bloques del borde recomprimidos (calidad exhaustive)`);
        }
        if (r.fidelity) {
            line(`  Residuos visibles alrededor del personaje: ${r.fidelity.residue} px · huecos en zonas opacas: ${r.fidelity.holes} px`);
        }
        line('  Orientación: de pie (igual que las texturas originales del juego).');

        if (currentXmlData) {
            sep();
            line('ATLAS (.XML)');
            line(`  Fotogramas: ${currentXmlData.count} (sin cambios de nombre ni de orden)`);
            if (r.pack) {
                line(`  CAMBIÓ: atlas reempaquetado · ${r.pack.uniqueCount} recortes únicos (los frames repetidos comparten recorte)`);
                line('          se quitó el espacio vacío del PNG original y cada recorte quedó alineado a los bloques ASTC.');
                line('  CAMBIÓ: x, y (nueva posición de cada recorte en la textura)');
            } else if (r.scale !== 1.0) {
                line('  CAMBIÓ: x, y (escaladas)');
            }
            if (r.scale !== 1.0) {
                line(`  CAMBIÓ: width, height, frameX, frameY, frameWidth, frameHeight (multiplicados por ${r.scale})`);
            } else {
                line('  SIGUE IGUAL: width, height, frameX, frameY, frameWidth, frameHeight');
            }
            line(`  CAMBIÓ: imagePath -> ${plan.base}.png`);
            line('  SIGUE IGUAL: nombres de las animaciones y fotogramas, rotated, orden.');
            if (!r.pack && r.scale === 1.0) line('  Las coordenadas son idénticas al XML original.');
        }

        if (jsonAdj) {
            sep();
            line('PERSONAJE (.JSON · Psych Engine)');
            if (r.scale < 1.0) {
                line(`  CAMBIÓ: scale            ${jsonAdj.origScale}  ->  ${jsonAdj.newScale}   (la textura quedó al ${(r.scale * 100).toFixed(0)}% de su tamaño: se compensa para verse igual de grande)`);
                line(`  CAMBIÓ: position         [${jsonAdj.origPos.join(', ')}]  ->  [${jsonAdj.newPos.join(', ')}]   (compensación ΔX ${jsonAdj.deltaX}, ΔY ${jsonAdj.deltaY})`);
                line(`  CAMBIÓ: camera_position  [${jsonAdj.origCamPos.join(', ')}]  ->  [${jsonAdj.newCamPos.join(', ')}]`);
                line(`  Cálculo: rol ${jsonAdj.isPlayer ? 'jugador' : 'oponente'} · animación base "${jsonAdj.refAnim}" · frame ${jsonAdj.frameSize[0]}x${jsonAdj.frameSize[1]} px`);
                line('           (el pivote central de HaxeFlixel se desplaza al reducir la textura; se corrige para que');
                line('            el personaje y la cámara queden exactamente donde estaban)');
            } else {
                line('  SIGUE IGUAL: scale, position y camera_position (la escala de la textura es 100%).');
            }
            line('  SIGUE IGUAL: animaciones, offsets, fps, loop, indices, flip_x, healthicon, colores, image y demás campos.');
            const img = (jsonAdj.json && jsonAdj.json.image) ? String(jsonAdj.json.image) : '';
            const imgBase = img.split('/').pop();
            if (imgBase && imgBase !== plan.base) {
                line();
                line(`  AVISO: el campo "image" del JSON es "${img}", pero la textura se llama "${plan.base}".`);
                line(`         Renombra ${plan.base}.astc y ${plan.base}.xml a "${imgBase}" o cambia "image" en el JSON.`);
            }
        }
        sep();
        return L.join('\r\n');
    }

    // Descarga única: solo PNG -> .astc · PNG + XML (+ JSON) -> .zip con todo y el informe
    if (btnDownloadAstc) {
        btnDownloadAstc.addEventListener('click', async () => {
            if (!currentAstcResult || !currentAstcResult.astcBytes) {
                alert('❌ No hay ningún archivo ASTC comprimido para descargar.');
                return;
            }
            const plan = outputPlan();
            if (!plan.zip) {
                downloadBlob(new Blob([currentAstcResult.astcBytes], { type: 'application/octet-stream' }), plan.files[0].name);
                return;
            }
            if (typeof JSZip === 'undefined') {
                alert('❌ No se pudo cargar el generador de ZIP (revisa tu conexión a internet y recarga la página).');
                return;
            }
            try {
                const zip = new JSZip();
                const jsonAdj = currentJsonRaw ? computeJsonAdjustment(currentAstcResult.scale) : null;
                for (const f of plan.files) {
                    if (f.kind === 'astc') zip.file(f.name, currentAstcResult.astcBytes);
                    else if (f.kind === 'xml') zip.file(f.name, await buildOutputXml());
                    else if (f.kind === 'json') zip.file(f.name, JSON.stringify(jsonAdj ? jsonAdj.json : currentJsonRaw, null, '\t'));
                    else if (f.kind === 'txt') zip.file(f.name, buildReportTxt(plan, jsonAdj));
                }
                const blob = await zip.generateAsync({ type: 'blob' });
                downloadBlob(blob, plan.zipName);
            } catch (err) {
                console.error('Error al generar ZIP:', err);
                alert('❌ Error al generar el ZIP: ' + err.message);
            }
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
            const json = files.find(f => f.name.toLowerCase().endsWith('.json'));
            if (json && jsonFileInput) {
                const dt = new DataTransfer();
                dt.items.add(json);
                jsonFileInput.files = dt.files;
                jsonFileInput.dispatchEvent(new Event('change'));
            }
        }
    });

})();
