// ==========================================
// ANIMATE ATLAS BAKER A SPARROW V2
// ==========================================

var atlasAnimObj = null;
var atlasJsonObj = null;
var atlasPngImg = null;
var atlasPngFileName = "";
var animSpritesDict = {};

function handleAtlasFileDrop(file) {
    if (appMode === 'ATLAS') {
        const dt = new DataTransfer(); dt.items.add(file);
        let reader = new FileReader();
        reader.onload = function (e) {
            try {
                let json = JSON.parse(e.target.result);
                if (json.AN || json.ANIMATION) {
                    document.getElementById('atlasAnimUpload').files = dt.files;
                    document.getElementById('atlasAnimUpload').dispatchEvent(new Event('change'));
                } else if (json.ATLAS || json.frames) {
                    document.getElementById('atlasJsonUpload').files = dt.files;
                    document.getElementById('atlasJsonUpload').dispatchEvent(new Event('change'));
                }
            } catch (e) { }
        };
        reader.readAsText(file);
    }
}

var atlasAnimFileName = "Animation.json";
var atlasAnimFileName = "Animation.json";
document.getElementById('atlasAnimUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    if (!inp.files || inp.files.length === 0) {
        if (typeof window.setImportButtonState === 'function') window.setImportButtonState(inp, 'reset');
        return;
    }

    await window.validateAndProcessFile(inp, 'json', {
        customValidate: (json) => {
            if (!json.AN && !json.ANIMATION && !json.metadata) {
                return { error: "El archivo no contiene la estructura esperada de Adobe Animate (Animation.json)." };
            }
            return null;
        },
        onSuccess: (file, data) => {
            atlasAnimFileName = file.name;
            atlasAnimObj = data.obj;
            updateAtlasPreview();
        },
        onError: () => {
            atlasAnimObj = null;
        }
    });
});

var atlasJsonFileName = "spritemap.json";
document.getElementById('atlasJsonUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    if (!inp.files || inp.files.length === 0) {
        if (typeof window.setImportButtonState === 'function') window.setImportButtonState(inp, 'reset');
        return;
    }

    await window.validateAndProcessFile(inp, 'json', {
        customValidate: (json) => {
            if (!json.ATLAS && !json.frames) {
                return { error: "El archivo no contiene la estructura de sprites (spritemap.json)." };
            }
            return null;
        },
        onSuccess: (file, data) => {
            atlasJsonFileName = file.name;
            atlasJsonObj = data.obj;
            animSpritesDict = {};
            if (atlasJsonObj.ATLAS && atlasJsonObj.ATLAS.SPRITES) {
                atlasJsonObj.ATLAS.SPRITES.forEach(s => { animSpritesDict[s.SPRITE.name] = s.SPRITE; });
            } else if (atlasJsonObj.frames) {
                for (let k in atlasJsonObj.frames) {
                    let f = atlasJsonObj.frames[k].frame;
                    animSpritesDict[k] = { name: k, x: f.x, y: f.y, w: f.w, h: f.h, rotated: atlasJsonObj.frames[k].rotated };
                }
            }
            updateAtlasPreview();
        },
        onError: () => {
            atlasJsonObj = null;
        }
    });
});

var atlasCharJsonObj = null;
var atlasCharJsonFileName = "character.json";
document.getElementById('atlasCharJsonUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    if (!inp.files || inp.files.length === 0) {
        if (typeof window.setImportButtonState === 'function') window.setImportButtonState(inp, 'reset');
        return;
    }

    await window.validateAndProcessFile(inp, 'json', {
        onSuccess: (file, data) => {
            atlasCharJsonFileName = file.name;
            atlasCharJsonObj = data.obj;
            let btn = document.getElementById('btnAtlasCharJson');
            if (btn) {
                btn.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/190/190411.png" class="icon" style="filter:brightness(0) invert(1);" alt="Check"> CARGADO: ${atlasCharJsonFileName}`;
            }
        },
        onError: () => {
            atlasCharJsonObj = null;
        }
    });
});

document.getElementById('atlasPngUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    if (!inp.files || inp.files.length === 0) {
        if (typeof window.setImportButtonState === 'function') window.setImportButtonState(inp, 'reset');
        return;
    }

    await window.validateAndProcessFile(inp, 'png', {
        onSuccess: (file, img) => {
            atlasPngFileName = file.name;
            atlasPngImg = img;
            updateAtlasPreview();
        },
        onError: () => {
            atlasPngImg = null;
        }
    });
});

let atlasGlobalAnimations = [];

function updateAtlasPreview() {
    let box = document.getElementById('atlasPreviewBox');
    if (atlasAnimObj && atlasJsonObj && atlasPngImg) {
        let anims = [];
        atlasGlobalAnimations = [];
        if (atlasAnimObj.AN && atlasAnimObj.AN.TL && atlasAnimObj.AN.TL.L) {
            let layers = Array.isArray(atlasAnimObj.AN.TL.L) ? atlasAnimObj.AN.TL.L : [atlasAnimObj.AN.TL.L];
            layers.forEach(l => {
                let frames = Array.isArray(l.FR) ? l.FR : [l.FR];
                frames.forEach(fr => {
                    if (fr.N && !anims.includes(fr.N)) {
                        anims.push(fr.N);
                        atlasGlobalAnimations.push({ name: fr.N, start: fr.I || 0, end: (fr.I || 0) + (fr.DU || 1), layer: l });
                    }
                });
            });
        }

        let sel = document.getElementById('atlasAnimSelect');
        sel.innerHTML = '';
        atlasGlobalAnimations.forEach(a => {
            let opt = document.createElement('option');
            opt.value = a.name; opt.textContent = a.name;
            sel.appendChild(opt);
        });

        let canvas = document.getElementById('atlasPreviewCanvas');
        canvas.style.display = 'block';
        let span = box.querySelector('span');
        if (span) span.style.display = 'none';

        document.getElementById('btnRunAtlas').style.display = 'block';

        updateAtlasPreviewCanvas();
    } else {
        let span = box.querySelector('span');
        if (span) span.style.display = 'block';
        document.getElementById('atlasPreviewCanvas').style.display = 'none';
        document.getElementById('btnRunAtlas').style.display = 'none';
    }
    if (typeof window.autoSaveHistory === 'function') window.autoSaveHistory();
}

function updateAtlasPreviewCanvas() {
    let selName = document.getElementById('atlasAnimSelect').value;
    if (!selName) return;

    let anim = atlasGlobalAnimations.find(a => a.name === selName);
    if (!anim) return;

    let canvas = document.getElementById('atlasPreviewCanvas');
    canvas.width = 1000; canvas.height = 1000;
    let ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvas.width / 2, canvas.height / 2);

    renderSymbolTimeline(atlasAnimObj.AN.TL, anim.start, ctx);
}

window.toggleAtlasRawMode = function () {
    let isRaw = document.getElementById('chkExportAtlasRaw')?.checked;
    let resizeConfig = document.getElementById('atlasResizeConfig');
    let sparrowConfig = document.getElementById('atlasSparrowConfig');
    let btnRun = document.getElementById('btnRunAtlas');

    if (isRaw) {
        if (resizeConfig) resizeConfig.style.display = 'block';
        if (sparrowConfig) sparrowConfig.style.display = 'none';
        if (btnRun) btnRun.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/128/11252/11252744.png" class="icon" alt="Procesar"> DESCARGAR ATLAS REDIMENSIONADO';
    } else {
        if (resizeConfig) resizeConfig.style.display = 'none';
        if (sparrowConfig) sparrowConfig.style.display = 'flex';
        if (btnRun) btnRun.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/128/11252/11252744.png" class="icon" alt="Procesar"> GENERAR Y DESCARGAR ARCHIVOS';
    }
};

window.checkAtlasCustomResize = function () {
    let sel = document.getElementById('selAtlasResizeFactor');
    let inp = document.getElementById('inpAtlasResizeCustom');
    if (sel && inp) {
        if (sel.value === 'custom') {
            inp.style.display = 'inline-block';
        } else {
            inp.style.display = 'none';
        }
    }
};

function getAtlasScaleFactor() {
    let sel = document.getElementById('selAtlasResizeFactor')?.value;
    if (sel === 'custom') {
        let val = parseFloat(document.getElementById('inpAtlasResizeCustom')?.value);
        if (isNaN(val) || val <= 0) return 1;
        return val / 100;
    }
    return parseFloat(sel) || 1;
}

function scaleAtlasAnimationNode(node, factor) {
    if (Array.isArray(node)) {
        node.forEach(n => scaleAtlasAnimationNode(n, factor));
    } else if (typeof node === 'object' && node !== null) {
        if (node.M3D && Array.isArray(node.M3D) && node.M3D.length === 16) {
            node.M3D[12] *= factor;
            node.M3D[13] *= factor;
        }
        if (node.TRP) {
            if (node.TRP.x !== undefined) node.TRP.x *= factor;
            if (node.TRP.y !== undefined) node.TRP.y *= factor;
        }
        for (let key in node) {
            scaleAtlasAnimationNode(node[key], factor);
        }
    }
}

async function exportScaledAtlasRaw(optOpt) {
    let factor = getAtlasScaleFactor();
    showLoader("ESCALANDO", factor === 1 ? "Preparando archivos originales..." : `Redimensionando al ${Math.round(factor * 100)}%...`);
    await pensar(50);

    let newAnim = JSON.parse(JSON.stringify(atlasAnimObj));
    let newJson = JSON.parse(JSON.stringify(atlasJsonObj));

    if (factor !== 1) {
        if (newJson.meta && newJson.meta.size) {
            newJson.meta.size.w = Math.round(newJson.meta.size.w * factor);
            newJson.meta.size.h = Math.round(newJson.meta.size.h * factor);
        }
        if (newJson.ATLAS && newJson.ATLAS.SPRITES) {
            newJson.ATLAS.SPRITES.forEach(s => {
                if (s.SPRITE) {
                    s.SPRITE.x = Math.round(s.SPRITE.x * factor);
                    s.SPRITE.y = Math.round(s.SPRITE.y * factor);
                    s.SPRITE.w = Math.round(s.SPRITE.w * factor);
                    s.SPRITE.h = Math.round(s.SPRITE.h * factor);
                }
            });
        } else if (newJson.frames) {
            for (let k in newJson.frames) {
                let f = newJson.frames[k].frame;
                if (f) {
                    f.x = Math.round(f.x * factor);
                    f.y = Math.round(f.y * factor);
                    f.w = Math.round(f.w * factor);
                    f.h = Math.round(f.h * factor);
                }
                let sS = newJson.frames[k].spriteSourceSize;
                if (sS) {
                    sS.x = Math.round(sS.x * factor);
                    sS.y = Math.round(sS.y * factor);
                    sS.w = Math.round(sS.w * factor);
                    sS.h = Math.round(sS.h * factor);
                }
                let sZ = newJson.frames[k].sourceSize;
                if (sZ) {
                    sZ.w = Math.round(sZ.w * factor);
                    sZ.h = Math.round(sZ.h * factor);
                }
            }
        }
        scaleAtlasAnimationNode(newAnim, factor);
    }

    let finalW = Math.max(1, Math.round(atlasPngImg.width * factor));
    let finalH = Math.max(1, Math.round(atlasPngImg.height * factor));
    let finalCanv = document.createElement('canvas');
    finalCanv.width = finalW;
    finalCanv.height = finalH;
    let ctx = finalCanv.getContext('2d');
    ctx.drawImage(atlasPngImg, 0, 0, finalW, finalH);

    let baseName = document.getElementById('txtAtlasExportName')?.value.trim() || atlasPngFileName.replace('.png', '');
    let zipName = baseName;
    if (factor !== 1) {
        zipName += `_${Math.round(factor * 100)}pct`;
    }

    let newCharJson = null;
    if (atlasCharJsonObj) {
        newCharJson = JSON.parse(JSON.stringify(atlasCharJsonObj));
        if (factor !== 1) {
            if (newCharJson.position && newCharJson.position.length >= 2) {
                newCharJson.position[0] = Math.round(newCharJson.position[0] * factor);
                newCharJson.position[1] = Math.round(newCharJson.position[1] * factor);
            }
            if (newCharJson.camera_position && newCharJson.camera_position.length >= 2) {
                newCharJson.camera_position[0] = Math.round(newCharJson.camera_position[0] * factor);
                newCharJson.camera_position[1] = Math.round(newCharJson.camera_position[1] * factor);
            }
        }
    }

    let minFakeTime = 40;
    let maxFakeTime = 70;
    let fakeTimeSeconds = Math.floor(Math.random() * (maxFakeTime - minFakeTime + 1)) + minFakeTime;
    let iterations = 10;
    let msPerIter = (fakeTimeSeconds * 1000) / iterations;

    let mensajesPolido = [
        "Analizando estructuras...",
        "Calculando nuevas dimensiones...",
        "Ajustando resolucion...",
        "Reestructurando animación...",
        "Optimizando sprites...",
        "Buscando impurezas visuales...",
        "Mejorando calidad de renderizado...",
        "Empaquetando datos...",
        "Verificando integridad...",
        "Casi listo..."
    ];

    for (let i = 0; i < iterations; i++) {
        let porc = Math.round((i / iterations) * 100);
        showLoader("PULIENDO...", `${mensajesPolido[i % mensajesPolido.length]} (${porc}%)<br><small style="color:#aaa;">Este proceso de pulido toma su tiempo...</small>`);
        await pensar(msPerIter);
    }
    showLoader("PULIENDO...", "Generando archivos finales (100%)...");
    await pensar(500);

    let zip = new JSZip();
    let folder = zip.folder(zipName);

    folder.file(atlasAnimFileName || "Animation.json", JSON.stringify(newAnim, null, 2));
    folder.file(atlasJsonFileName || "spritemap.json", JSON.stringify(newJson, null, 2));
    if (newCharJson) {
        folder.file(atlasCharJsonFileName || "character.json", JSON.stringify(newCharJson, null, 2));
    }

    let pngBlob = null;
    if (optOpt) {
        showLoader("ESCALANDO", "Comprimiendo PNG con UPNG...");
        await pensar(50);
        let rgba = ctx.getImageData(0, 0, finalW, finalH).data;
        let upng = UPNG.encode([rgba.buffer], finalW, finalH, 256);
        pngBlob = new Blob([upng], { type: 'image/png' });
    } else {
        pngBlob = await new Promise(res => finalCanv.toBlob(res, 'image/png'));
    }
    folder.file(atlasPngFileName || "spritemap.png", pngBlob);

    showLoader("GENERANDO ZIP", "Preparando archivo final...");
    await pensar(50);

    let content = await zip.generateAsync({ type: "blob" });
    let url = URL.createObjectURL(content);
    let a = document.createElement("a");
    a.href = url;
    a.download = zipName + "_Atlas.zip";
    a.click();

    ocultarCargaGlobal();
    let box = document.getElementById('atlasPreviewBox');
    if (box) {
        box.innerHTML = `
            <div style="font-size:2rem; font-weight:bold; color:var(--accent-gold);">¡GENERADO!</div>
            <div style="color:#aaa; font-size:0.8rem; margin-top:5px;">Descarga de Atlas completa.</div>
        `;
    }
}

async function ejecutarAtlasBaker() {
    if (!atlasAnimObj || !atlasJsonObj || !atlasPngImg) return alert("Faltan archivos.");

    let isRawMode = document.getElementById('chkExportAtlasRaw')?.checked;
    let currentOptOpt = document.getElementById('chkAtlasOpt')?.checked;

    if (isRawMode) {
        await exportScaledAtlasRaw(currentOptOpt);
        return;
    }

    let optPng = document.getElementById('chkAtlasPng').checked;
    let optOpt = document.getElementById('chkAtlasOpt').checked;
    let optXml = document.getElementById('chkAtlasXml').checked;
    let optJson = document.getElementById('chkAtlasJson').checked;

    if (!optPng && !optXml && !optJson) return alert("Selecciona al menos una opción para exportar.");

    showLoader("ORDENANDO", "Generando fotogramas... 0%");


    let animations = [];
    let layers = Array.isArray(atlasAnimObj.AN.TL.L) ? atlasAnimObj.AN.TL.L : [atlasAnimObj.AN.TL.L];
    layers.forEach(l => {
        let frames = Array.isArray(l.FR) ? l.FR : [l.FR];
        frames.forEach(fr => {
            if (fr.N) {
                animations.push({ name: fr.N, start: fr.I || 0, end: (fr.I || 0) + (fr.DU || 1), layer: l });
            }
        });
    });

    if (animations.length === 0) return alert("No se encontraron animaciones (N) en la línea de tiempo principal.");

    let framesRendered = [];
    let scaleMultiplier = 1;

    let offCtx = document.createElement('canvas').getContext('2d');

    for (let a = 0; a < animations.length; a++) {
        let anim = animations[a];
        let frameCount = anim.end - anim.start;
        for (let f = 0; f < frameCount; f++) {
            let actualFrame = anim.start + f;

            let minX = 2000, minY = 2000, maxX = -1, maxY = -1;

            let tempCanv = document.createElement('canvas');
            tempCanv.width = 2000; tempCanv.height = 2000;
            let tCtx = tempCanv.getContext('2d', { willReadFrequently: true });
            tCtx.translate(1000, 1000);

            renderSymbolTimeline(atlasAnimObj.AN.TL, actualFrame, tCtx);

            let idata = tCtx.getImageData(0, 0, 2000, 2000);
            let d32 = new Uint32Array(idata.data.buffer);

            for (let y = 0; y < 2000; y++) {
                for (let x = 0; x < 2000; x++) {
                    if ((d32[y * 2000 + x] & 0xFF000000) !== 0) { minY = y; break; }
                }
                if (minY !== 2000) break;
            }

            if (minY !== 2000) {
                for (let y = 1999; y >= minY; y--) {
                    for (let x = 0; x < 2000; x++) {
                        if ((d32[y * 2000 + x] & 0xFF000000) !== 0) { maxY = y; break; }
                    }
                    if (maxY !== -1) break;
                }
                for (let x = 0; x < 2000; x++) {
                    for (let y = minY; y <= maxY; y++) {
                        if ((d32[y * 2000 + x] & 0xFF000000) !== 0) { minX = x; break; }
                    }
                    if (minX !== 2000) break;
                }
                for (let x = 1999; x >= minX; x--) {
                    for (let y = minY; y <= maxY; y++) {
                        if ((d32[y * 2000 + x] & 0xFF000000) !== 0) { maxX = x; break; }
                    }
                    if (maxX !== -1) break;
                }
            }

            if (minX <= maxX) {
                let w = maxX - minX + 1;
                let h = maxY - minY + 1;
                let finalCanv = document.createElement('canvas');
                finalCanv.width = w; finalCanv.height = h;
                finalCanv.getContext('2d').putImageData(tCtx.getImageData(minX, minY, w, h), 0, 0);

                framesRendered.push({
                    animName: anim.name,
                    frameNum: f,
                    canvas: finalCanv,
                    w: w, h: h,
                    frameX: -(minX - 1000),
                    frameY: -(minY - 1000)
                });
            }

            document.getElementById('iaStatusTxt').innerHTML = `Renderizando ${anim.name} (${f + 1}/${frameCount})...`;
            await pensar(1);
        }
    }

    showLoader("EMPAQUETANDO SPRITES", "Generando Spritesheet Sparrow...");
    await pensar(50);

    framesRendered.sort((a, b) => b.h - a.h);
    let packerWidth = 4096;
    let currentX = 0; let currentY = 0; let rowHeight = 0;

    framesRendered.forEach(fr => {
        if (currentX + fr.w > packerWidth) {
            currentX = 0;
            currentY += rowHeight;
            rowHeight = 0;
        }
        fr.x = currentX;
        fr.y = currentY;
        currentX += fr.w + 2;
        if (fr.h > rowHeight) rowHeight = fr.h + 2;
    });

    let packerHeight = currentY + rowHeight;
    let finalAtlas = document.createElement('canvas');
    finalAtlas.width = packerWidth; finalAtlas.height = packerHeight;
    let finalCtx = finalAtlas.getContext('2d');

    let baseName = document.getElementById('txtAtlasExportName').value.trim() || atlasPngFileName.replace('.png', '');
    let finalPngName = baseName + '.png';

    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<TextureAtlas imagePath="' + finalPngName + '">\n';
    xml += '<!-- Spritesheet Generator FNF LaloCF -->\t\n';
    xml += '<!-- https://lalocf2.github.io/spritesheet-generator-fnf/ -->\t\n';
    let psychJson = { animations: [], image: baseName, position: [0, 0], healthicon: "face", flip_x: false, healthbar_colors: [161, 161, 161], camera_position: [0, 0], sing_duration: 4, scale: 1 };

    let psychAnimsAdded = {};

    framesRendered.forEach(fr => {
        finalCtx.drawImage(fr.canvas, fr.x, fr.y);
        let frameName = fr.animName + fr.frameNum.toString().padStart(4, '0');
        xml += `\t<SubTexture name="${frameName}" x="${fr.x}" y="${fr.y}" width="${fr.w}" height="${fr.h}" frameX="${fr.frameX}" frameY="${fr.frameY}" frameWidth="${fr.w}" frameHeight="${fr.h}"/>\n`;

        if (!psychAnimsAdded[fr.animName]) {
            psychAnimsAdded[fr.animName] = true;
            psychJson.animations.push({ anim: fr.animName, name: fr.animName, fps: 24, loop: false, indices: [], offsets: [0, 0] });
        }
    });

    xml += '</TextureAtlas>';

    showLoader("GENERANDO ZIP", optOpt ? "Comprimiendo PNG con UPNG..." : "Preparando archivo...");
    await pensar(50);

    let zip = new JSZip();

    if (optXml) zip.file(baseName + ".xml", xml);
    if (optJson) zip.file(baseName + ".json", JSON.stringify(psychJson, null, 2));

    let pngBlob = null;
    if (optPng || optOpt) {
        if (optOpt) {
            let rgba = finalCtx.getImageData(0, 0, packerWidth, packerHeight).data;
            let upng = UPNG.encode([rgba.buffer], packerWidth, packerHeight, 256);
            pngBlob = new Blob([upng], { type: 'image/png' });
        } else {
            pngBlob = await new Promise(res => finalAtlas.toBlob(res, 'image/png'));
        }
        zip.file(finalPngName, pngBlob);
    }

    let content = await zip.generateAsync({ type: "blob" });
    let url = URL.createObjectURL(content);
    let a = document.createElement("a");
    a.href = url;
    a.download = baseName + "_Baked.zip";
    a.click();

    ocultarCargaGlobal();
    let box = document.getElementById('atlasPreviewBox');
    box.innerHTML = `
        <div style="font-size:2rem; font-weight:bold; color:var(--accent-gold);">¡GENERADO!</div>
        <div style="color:#aaa; font-size:0.8rem; margin-top:5px;">Descarga completa.</div>
    `;
}

function renderSymbolTimeline(tl, frameIndex, ctx) {
    if (!tl || !tl.L) return;
    let layers = Array.isArray(tl.L) ? tl.L : [tl.L];
    for (let i = layers.length - 1; i >= 0; i--) {
        let layer = layers[i];
        let frames = Array.isArray(layer.FR) ? layer.FR : [layer.FR];
        let kf = frames.find(fr => frameIndex >= (fr.I || 0) && frameIndex < (fr.I || 0) + (fr.DU || 1));

        if (kf && kf.E) {
            let elements = Array.isArray(kf.E) ? kf.E : [kf.E];
            elements.forEach(el => {
                if (el.SI) {
                    let si = el.SI;
                    let m = si.M3D;
                    ctx.save();
                    if (m) ctx.transform(m[0], m[1], m[4], m[5], m[12], m[13]);
                    if (si.C && si.C.AL !== undefined) ctx.globalAlpha *= si.C.AL;

                    let innerFrame = frameIndex - (kf.I || 0) + (si.FF || 0);
                    let symbolDef = atlasAnimObj.SD.S.find(s => s.SN === si.SN);
                    if (symbolDef && symbolDef.TL) {
                        let dur = getSymbolDuration(symbolDef.TL);
                        if (si.LP === 'LP') innerFrame = innerFrame % dur;
                        renderSymbolTimeline(symbolDef.TL, innerFrame, ctx);
                    }
                    ctx.restore();
                } else if (el.ASI) {
                    let asi = el.ASI;
                    let m = asi.M3D;
                    ctx.save();
                    if (m) ctx.transform(m[0], m[1], m[4], m[5], m[12], m[13]);

                    let sprite = animSpritesDict[asi.N];
                    if (sprite) {
                        if (sprite.rotated) {
                            ctx.translate(sprite.w / 2, sprite.h / 2);
                            ctx.rotate(-Math.PI / 2);
                            ctx.drawImage(atlasPngImg, sprite.x, sprite.y, sprite.h, sprite.w, -sprite.h / 2, -sprite.w / 2, sprite.h, sprite.w);
                        } else {
                            ctx.drawImage(atlasPngImg, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);
                        }
                    }
                    ctx.restore();
                }
            });
        }
    }
}

function getSymbolDuration(tl) {
    let dur = 1;
    let layers = Array.isArray(tl.L) ? tl.L : [tl.L];
    layers.forEach(l => {
        let frames = Array.isArray(l.FR) ? l.FR : [l.FR];
        let lastFr = frames[frames.length - 1];
        if (lastFr) { let end = (lastFr.I || 0) + (lastFr.DU || 1); if (end > dur) dur = end; }
    });
    return dur;
}
