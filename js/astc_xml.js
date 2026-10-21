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
                window.imgBaseOptimizador = null;   // la próxima reducción parte de la textura ya volteada
                if (typeof renderTimelineSecuenciador === 'function') renderTimelineSecuenciador();
                if (typeof dibujarContornos === 'function') dibujarContornos();
                if (typeof renderizarPreviewTiempoReal === 'function') renderizarPreviewTiempoReal();
                if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
            };
            newImg.src = flipped.toDataURL('image/png');
        }, 50);
    };

    // Empaquetado en estantes alineado a la rejilla de bloques ASTC (con 2 px de separación):
    // ningún bloque mezcla píxeles de dos fotogramas, evitando bordes sucios en el juego.
    // items: [{ key, w, h }] -> { pos: Map(key -> {x, y}), w, h }
    function empaquetarAstc(items, blockX, blockY) {
        const PAD = 2;
        const cellW = (it) => Math.ceil((it.w + PAD) / blockX) * blockX;
        const cellH = (it) => Math.ceil((it.h + PAD) / blockY) * blockY;
        const porAltura = [...items].sort((a, b) => b.h - a.h);
        let totalArea = 0, maxW = 0;
        for (const it of porAltura) {
            totalArea += cellW(it) * cellH(it);
            if (cellW(it) > maxW) maxW = cellW(it);
        }
        const maxWidth = Math.max(maxW, Math.ceil(Math.sqrt(totalArea * 1.05) / blockX) * blockX);
        let x = 0, y = 0, estante = 0, ancho = 0;
        const pos = new Map();
        for (const it of porAltura) {
            if (x > 0 && x + cellW(it) > maxWidth) { x = 0; y += estante; estante = 0; }
            pos.set(it.key, { x, y });
            x += cellW(it);
            if (cellH(it) > estante) estante = cellH(it);
            if (x > ancho) ancho = x;
        }
        return { pos, w: Math.max(blockX, ancho), h: Math.max(blockY, y + estante) };
    }

    // Peso EXACTO del .astc que se exportaría si la imagen se reduce por el factor f (lo usa js/redimensionar.js):
    // 16 bytes de cabecera + 16 bytes por bloque.
    window.OptPesoExacto = function (f) {
        const blockX = (astcHeader && astcHeader.blockX) || 6;
        const blockY = (astcHeader && astcHeader.blockY) || 6;
        const fu = framesUnicos();
        const pack = empaquetarAstc(fu.unicos.map(s => ({ key: s, w: Math.max(1, Math.round(s.w * f)), h: Math.max(1, Math.round(s.h * f)) })), blockX, blockY);
        return 16 + Math.ceil(pack.w / blockX) * Math.ceil(pack.h / blockY) * 16;
    };

    // Exportador de ZIP con soporte para .ASTC y .PNG
    window.repackAndExportAstc = async function () {
        if (!spritesDetectados || spritesDetectados.length === 0) {
            return alert("❌ No hay frames para empaquetar.");
        }

        const isOptimized = (window.totalResizeFactor || 1.0) < 1.0;

        if (isOptimized && !window.uploadedAnimationJSON) {
            if (!(await window.pedirConfirmacionSinJson())) return;
        }

        // Escala, posición y cámara calculadas con el primer frame real del XML y el rol elegido
        const adj = obtenerAjusteJsonActual();
        let jsonExportData = adj ? { name: window.uploadedAnimationJSON.name, content: JSON.stringify(adj.json, null, "\t") } : null;

        if (typeof mostrarCargaGlobal === 'function') {
            mostrarCargaGlobal("Empaquetando atlas y deduplicando fotogramas...");
        }
        await new Promise(r => setTimeout(r, 100));

        // Frames únicos (los repetidos reutilizan la misma zona) y empaquetado alineado a los bloques ASTC
        const fu = framesUnicos();
        let uniqueFrames = fu.unicos;
        let dupCount = spritesDetectados.length - uniqueFrames.length;

        const blockX = (astcHeader && astcHeader.blockX) || 6;
        const blockY = (astcHeader && astcHeader.blockY) || 6;
        const pack = empaquetarAstc(uniqueFrames.map(s => ({ key: s, w: s.w, h: s.h })), blockX, blockY);

        let packCanvas = document.createElement('canvas');
        packCanvas.width = pack.w;
        packCanvas.height = pack.h;
        let pCtx = packCanvas.getContext('2d');
        for (let s of uniqueFrames) {
            const p = pack.pos.get(s);
            pCtx.drawImage(imgOriginal, s.x, s.y, s.w, s.h, p.x, p.y, s.w, s.h);
        }

        let baseName = nombreArchivo.replace(/\.[^/.]+$/, "");
        let finalBaseName = isOptimized ? baseName + "_opt" : baseName;

        // Los archivos dentro del ZIP conservan el nombre original para que el JSON
        // del personaje (campo "image") los encuentre sin renombrar nada. Solo el ZIP lleva "_opt".
        let nombreZipPNG = baseName + ".png";
        let nombreZipASTC = baseName + ".astc";
        let nombreZipXML = baseName + ".xml";

        // Sparrow XML en el orden original (Psych usa el primer frame como centro del personaje)
        let xml = construirXmlSparrow(nombreZipPNG, (s) => {
            const target = fu.repetidoDe.get(s) || s;
            const p = pack.pos.get(target);
            return { x: p.x, y: p.y, w: target.w, h: target.h };
        });
        let informe = (isOptimized || adj) ? construirInformeOptimizacion({
            baseName, atlasW: packCanvas.width, atlasH: packCanvas.height, dupCount, adj,
            extra: `Textura ASTC: bloques ${blockX}x${blockY} (incluye copia PNG de respaldo)`
        }) : null;

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
            if (informe) zip.file("informe_optimizacion.txt", informe);

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
                msg += `  - ${jsonExportData.name} (escala ${adj.newScale}, posición [${adj.newPos.join(', ')}], cámara [${adj.newCamPos.join(', ')}])\n`;
            }
            if (informe) msg += `  - informe_optimizacion.txt (qué cambió y qué sigue igual)\n`;
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
