/**
 * ASTC + XML Sequencer & Optimizer
 * Spritesheet Generator FNF'
 * 
 * Functions identically to the PNG optimizer, but handles .astc textures natively
 * with offline WebAssembly decoding, full Psych Engine auto-alignment, and ASTC export.
 */

(function () {
    'use strict';

    let fileAstc = null;
    let fileXml = null;
    let astcHeader = null;
    let astcDecodedCanvas = null;

    window.currentAstcHeader = null;

    const inpAstc = document.getElementById('modAstc');
    const inpXml = document.getElementById('modXML');

    // Listener para subir archivo .ASTC
    if (inpAstc) {
        inpAstc.addEventListener('change', async (e) => {
            await window.validateAndProcessFile(e.target, 'astc', {
                onSuccess: (file, data) => {
                    fileAstc = file;
                    astcHeader = data.header;
                    window.currentAstcHeader = data.header;
                    checkDualAstc();
                },
                onError: () => {
                    fileAstc = null;
                    astcHeader = null;
                    window.currentAstcHeader = null;
                }
            });
        });
    }

    // Listener para subir archivo .XML
    if (inpXml) {
        inpXml.addEventListener('change', async (e) => {
            await window.validateAndProcessFile(e.target, 'xml', {
                onSuccess: (file, data) => {
                    fileXml = file;
                    checkDualAstc();
                },
                onError: () => {
                    fileXml = null;
                }
            });
        });
    }

    async function checkDualAstc() {
        if (!fileAstc || !fileXml) return;

        if (typeof mostrarCargaGlobal === 'function') {
            mostrarCargaGlobal("Decodificando textura ASTC con WebAssembly...");
        }

        try {
            await new Promise(r => setTimeout(r, 60)); // Yield to paint loader

            const buffer = await fileAstc.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            const decoded = window.ASTCEngine.astcToCanvas(bytes);
            astcDecodedCanvas = decoded.canvas;
            astcHeader = decoded.header;
            window.currentAstcHeader = decoded.header;

            nombreArchivo = fileAstc.name;
            window.lastResizeFactor = 1.0;
            window.totalResizeFactor = 1.0;

            const xmlText = await fileXml.text();

            // Load decoded image into imgOriginal
            const img = new Image();
            img.onload = () => {
                imgOriginal = img;
                parseSparrowXML(xmlText);

                appMode = 'EDIT';
                if (typeof toggleNavButtons === 'function') toggleNavButtons();
                finalizarCargaGeneral('EDIT');

                // Update resolution badge with ASTC info
                const bpp = (128 / (astcHeader.blockX * astcHeader.blockY)).toFixed(2);
                const lbl = document.getElementById('lblResizeCurrent');
                if (lbl) {
                    lbl.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/3114/3114883.png" class="icon-sm" alt="Size"> Tamaño: ${img.width} x ${img.height} <span style="color:var(--accent,#00e5ff); font-size:0.8rem; margin-left:6px;">(ASTC ${astcHeader.blockX}x${astcHeader.blockY} • ${bpp} bpp)</span>`;
                }

                if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
            };
            img.onerror = () => {
                if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
                alert("❌ Error al renderizar la textura ASTC decodificada.");
            };
            img.src = decoded.dataUrl;

        } catch (err) {
            console.error("Error al procesar ASTC + XML:", err);
            if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
            alert("❌ Error al procesar ASTC + XML: " + err.message);
        }
    }

    window.invertirTexturaAstc = function (eje) {
        if (!imgOriginal || !imgOriginal.width) {
            alert("❌ Primero importa la textura ASTC y su XML.");
            return;
        }

        if (typeof mostrarCargaGlobal === 'function') {
            mostrarCargaGlobal("Invirtiendo orientación de la textura...");
        }

        setTimeout(() => {
            const flipped = (eje === 'X')
                ? window.ASTCEngine.flipCanvasHorizontal(imgOriginal)
                : window.ASTCEngine.flipCanvasVertical(imgOriginal);

            const newImg = new Image();
            newImg.onload = () => {
                imgOriginal = newImg;
                if (typeof renderTimelineSecuenciador === 'function') renderTimelineSecuenciador();
                if (typeof dibujarContornos === 'function') dibujarContornos();
                if (typeof renderizarPreviewTiempoReal === 'function') renderizarPreviewTiempoReal();
                if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
            };
            newImg.src = flipped.toDataURL('image/png');
        }, 50);
    };

    // Exportador de ZIP con soporte para .ASTC y .PNG
    window.repackAndExportAstc = async function () {
        if (!spritesDetectados || spritesDetectados.length === 0) {
            return alert("❌ No hay frames para empaquetar.");
        }

        const isOptimized = window.lastResizeFactor && window.lastResizeFactor < 1.0;

        if (isOptimized && !window.uploadedAnimationJSON) {
            const continuar = await new Promise((resolve) => {
                window.jsonWarningResolve = resolve;
                const modal = document.getElementById('modalJsonWarning');
                if (modal) modal.style.display = 'flex';
                else resolve(true);
            });
            if (!continuar) return;
        }

        let jsonExportData = null;
        if (window.uploadedAnimationJSON) {
            let finalJson = window.uploadedAnimationJSON.obj;
            if (isOptimized) {
                const factor = window.lastResizeFactor || 1.0;
                const adj = calcularAjustePsychJson(window.uploadedAnimationJSON.rawObj || window.uploadedAnimationJSON.obj, factor);
                if (adj) finalJson = adj.json;
            }
            jsonExportData = { name: window.uploadedAnimationJSON.name, content: JSON.stringify(finalJson, null, "\t") };
        }

        if (typeof mostrarCargaGlobal === 'function') {
            mostrarCargaGlobal("Empaquetando atlas y deduplicando fotogramas...");
        }
        await new Promise(r => setTimeout(r, 100));

        // Deduplication & Shelf packing
        let uniqueFrames = [];
        let duplicatesMap = new Map();
        let hashMap = new Map();

        for (let s of spritesDetectados) {
            let tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = s.w;
            tmpCanvas.height = s.h;
            let tmpCtx = tmpCanvas.getContext('2d');
            tmpCtx.drawImage(imgOriginal, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
            let hash = tmpCanvas.toDataURL();
            if (hashMap.has(hash)) {
                let master = hashMap.get(hash);
                duplicatesMap.set(s.name, master);
            } else {
                hashMap.set(hash, s);
                uniqueFrames.push(s);
            }
        }

        let dupCount = spritesDetectados.length - uniqueFrames.length;

        const blockX = (astcHeader && astcHeader.blockX) || 6;
        const blockY = (astcHeader && astcHeader.blockY) || 6;

        // Empaquetado alineado a la rejilla de bloques ASTC (con 2px de separación):
        // ningún bloque mezcla píxeles de dos fotogramas, evitando bordes sucios en el juego.
        const PAD = 2;
        const cellW = (s) => Math.ceil((s.w + PAD) / blockX) * blockX;
        const cellH = (s) => Math.ceil((s.h + PAD) / blockY) * blockY;

        uniqueFrames.sort((a, b) => b.h - a.h);
        let totalArea = 0;
        let maxW = 0;
        for (let s of uniqueFrames) {
            totalArea += cellW(s) * cellH(s);
            if (cellW(s) > maxW) maxW = cellW(s);
        }

        let idealWidth = Math.ceil(Math.sqrt(totalArea * 1.05) / blockX) * blockX;
        let maxWidth = Math.max(maxW, idealWidth);
        let currentX = 0;
        let currentY = 0;
        let shelfHeight = 0;
        let actualMaxWidth = 0;

        for (let s of uniqueFrames) {
            if (currentX > 0 && currentX + cellW(s) > maxWidth) {
                currentX = 0;
                currentY += shelfHeight;
                shelfHeight = 0;
            }
            s.packX = currentX;
            s.packY = currentY;
            currentX += cellW(s);
            if (cellH(s) > shelfHeight) shelfHeight = cellH(s);
            if (currentX > actualMaxWidth) actualMaxWidth = currentX;
        }

        let totalHeight = currentY + shelfHeight;
        let packCanvas = document.createElement('canvas');
        packCanvas.width = actualMaxWidth;
        packCanvas.height = totalHeight;
        let pCtx = packCanvas.getContext('2d');
        for (let s of uniqueFrames) {
            pCtx.drawImage(imgOriginal, s.x, s.y, s.w, s.h, s.packX, s.packY, s.w, s.h);
        }

        let baseName = nombreArchivo.replace(/\.[^/.]+$/, "");
        let finalBaseName = isOptimized ? baseName + "_opt" : baseName;

        // Los archivos dentro del ZIP conservan el nombre original para que el JSON
        // del personaje (campo "image") los encuentre sin renombrar nada. Solo el ZIP lleva "_opt".
        let nombreZipPNG = baseName + ".png";
        let nombreZipASTC = baseName + ".astc";
        let nombreZipXML = baseName + ".xml";

        // Generate Sparrow XML
        let xmlLines = [];
        xmlLines.push('<?xml version="1.0" encoding="utf-8"?>');
        xmlLines.push('<TextureAtlas imagePath="' + nombreZipPNG + '">');
        xmlLines.push('<!-- Spritesheet Generator FNF LaloCF (Modo ASTC Android) -->\t');
        xmlLines.push('<!-- https://lalocf2.github.io/spritesheet-generator-fnf/ -->\t');

        let exportSprites = [...spritesDetectados];
        exportSprites.sort((a, b) => a.name.localeCompare(b.name));
        exportSprites.forEach((s) => {
            let target = duplicatesMap.has(s.name) ? duplicatesMap.get(s.name) : s;
            let rot = (s.angle === 90 || s.angle === 270) ? ' rotated="true"' : '';
            xmlLines.push('\t<SubTexture name="' + s.name + '" x="' + target.packX + '" y="' + target.packY + '" width="' + target.w + '" height="' + target.h + '" frameX="' + s.frameX + '" frameY="' + s.frameY + '" frameWidth="' + s.frameWidth + '" frameHeight="' + s.frameHeight + '"' + rot + '/>');
        });
        xmlLines.push('</TextureAtlas>');
        let xml = xmlLines.join('\r\n');

        // Encode to ASTC
        if (typeof mostrarCargaGlobal === 'function') {
            mostrarCargaGlobal("Comprimiendo nueva textura .ASTC para Android con WebAssembly...");
        }
        await new Promise(r => setTimeout(r, 60));

        let astcEncoded = null;
        try {
            // Modo 'safe': conserva brillos y sombras semitransparentes (solo sangrado de color)
            astcEncoded = await window.ASTCEngine.encodeCanvasToAstc(packCanvas, {
                blockX: blockX,
                blockY: blockY,
                quality: 'medium',
                mode: 'safe'
            });
        } catch (encErr) {
            console.warn("Aviso al comprimir ASTC, continuando con PNG:", encErr);
        }

        // Build ZIP
        packCanvas.toBlob(async function (blobPNG) {
            let zip = new JSZip();
            zip.file(nombreZipPNG, blobPNG);
            zip.file(nombreZipXML, xml);

            if (astcEncoded && astcEncoded.astcBytes) {
                zip.file(nombreZipASTC, astcEncoded.astcBytes);
            }

            if (jsonExportData) {
                zip.file(jsonExportData.name, jsonExportData.content);
            }

            const content = await zip.generateAsync({ type: "blob" });
            const aZip = document.createElement('a');
            aZip.href = URL.createObjectURL(content);
            aZip.download = finalBaseName + ".zip";
            document.body.appendChild(aZip);
            aZip.click();
            document.body.removeChild(aZip);

            if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();

            let msg = `¡Éxito! Atlas optimizado para Android.\n\n` +
                      `• Se eliminaron ${dupCount} fotogramas duplicados.\n` +
                      `• Tu archivo ZIP incluye:\n` +
                      (astcEncoded && astcEncoded.astcBytes
                          ? `  - ${nombreZipASTC} (Textura comprimida ASTC ${blockX}x${blockY} · ${packCanvas.width}x${packCanvas.height})\n`
                          : `  - ⚠️ No se pudo generar el .ASTC (revisa la consola)\n`) +
                      `  - ${nombreZipPNG} (Copia PNG de respaldo)\n` +
                      `  - ${nombreZipXML} (Sparrow XML)\n`;
            if (jsonExportData) {
                msg += `  - ${jsonExportData.name} (JSON de Psych Engine calibrado)\n`;
            }
            alert(msg);
        }, 'image/png');
    };

    // Sobrescribir repackAndExport para usar la versión ASTC si estamos en astc_xml
    window.repackAndExport = window.repackAndExportAstc;

    // Drag & Drop
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

        if (e.dataTransfer && e.dataTransfer.files) {
            for (let f of e.dataTransfer.files) {
                let ext = f.name.split('.').pop().toLowerCase();
                if (ext === 'astc' && inpAstc) {
                    let dt = new DataTransfer();
                    dt.items.add(f);
                    inpAstc.files = dt.files;
                    inpAstc.dispatchEvent(new Event('change'));
                } else if (ext === 'xml' && inpXml) {
                    let dt = new DataTransfer();
                    dt.items.add(f);
                    inpXml.files = dt.files;
                    inpXml.dispatchEvent(new Event('change'));
                } else if (ext === 'json') {
                    const jsonInp = document.getElementById('jsonUpdateUpload');
                    if (jsonInp) {
                        let dt = new DataTransfer();
                        dt.items.add(f);
                        jsonInp.files = dt.files;
                        jsonInp.dispatchEvent(new Event('change'));
                    }
                }
            }
        }
    });

})();
