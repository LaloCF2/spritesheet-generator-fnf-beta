// ==========================================
// SECUENCIADOR Y EXPORTACIÓN ZIP
// ==========================================

let renderTimelineAbortCtrl = null;

async function renderTimelineSecuenciador() {
    if (renderTimelineAbortCtrl) renderTimelineAbortCtrl.abort();
    renderTimelineAbortCtrl = new AbortController();
    let signal = renderTimelineAbortCtrl.signal;

    timelineContainer.innerHTML = '';
    const chunk_size = 15;

    for (let i = 0; i < spritesDetectados.length; i += chunk_size) {
        if (signal.aborted) return;

        for (let j = i; j < i + chunk_size && j < spritesDetectados.length; j++) {
            let gIdx = j;
            let s = spritesDetectados[gIdx];

            let item = document.createElement('div'); item.className = `timeline-item ${gIdx === indexEditando ? 'active' : ''}`;

            let meta = document.createElement('div'); meta.className = 'timeline-item-meta';
            let chk = document.createElement('input'); chk.type = 'checkbox'; chk.className = 'frame-checkbox'; chk.setAttribute('data-index', gIdx); chk.onclick = (e) => e.stopPropagation();

            let thumb = document.createElement('canvas'); thumb.width = s.w; thumb.height = s.h;
            let tCtx = thumb.getContext('2d'); tCtx.drawImage(imgOriginal, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
            let nameSpan = document.createElement('span'); nameSpan.className = 'timeline-item-name'; nameSpan.textContent = s.name;
            meta.appendChild(chk); meta.appendChild(thumb); meta.appendChild(nameSpan);

            let actions = document.createElement('div'); actions.className = 'timeline-actions';

            let btnUp = document.createElement('button'); btnUp.className = 'btn-nav'; btnUp.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/128/992/992703.png" class="icon-sm" alt="Arriba">'; btnUp.onclick = (e) => { e.stopPropagation(); moverFrame(gIdx, -1); };
            let btnDown = document.createElement('button'); btnDown.className = 'btn-nav'; btnDown.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/128/3519/3519316.png" class="icon-sm" alt="Abajo">'; btnDown.onclick = (e) => { e.stopPropagation(); moverFrame(gIdx, 1); };
            let btnDup = document.createElement('button'); btnDup.className = 'btn-dup'; btnDup.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/1621/1621635.png" class="icon-sm" alt="Duplicar">'; btnDup.title = "Duplicar Frame"; btnDup.onclick = (e) => { e.stopPropagation(); duplicateFrame(gIdx); };
            let btnDel = document.createElement('button'); btnDel.className = 'btn-del'; btnDel.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/484/484611.png" class="icon-sm" alt="Eliminar">'; btnDel.title = "Eliminar Frame"; btnDel.onclick = (e) => { e.stopPropagation(); deleteFrame(gIdx); };

            if (gIdx === 0) btnUp.disabled = true; if (gIdx === spritesDetectados.length - 1) btnDown.disabled = true;

            actions.appendChild(btnUp); actions.appendChild(btnDown); actions.appendChild(btnDup); actions.appendChild(btnDel);
            item.appendChild(meta); item.appendChild(actions);

            item.addEventListener('click', () => { seleccionarFrameAfinador(gIdx); openWindow('win-afinador'); });
            timelineContainer.appendChild(item);
        }
        await pensar(1);
    }
}

function moverFrame(idx, dir) {
    let dest = idx + dir; if (dest < 0 || dest >= spritesDetectados.length) return;
    let temp = spritesDetectados[idx]; spritesDetectados[idx] = spritesDetectados[dest]; spritesDetectados[dest] = temp;
    if (indexEditando === idx) indexEditando = dest; else if (indexEditando === dest) indexEditando = idx;
    autoRenumerar(); renderTimelineSecuenciador(); dibujarContornos(); actualizarDropdownFiltros(); actualizarDropdownPsych();
}
function deleteFrame(idx) { spritesDetectados.splice(idx, 1); if (indexEditando === idx) indexEditando = null; autoRenumerar(); renderTimelineSecuenciador(); dibujarContornos(); actualizarDropdownFiltros(); actualizarDropdownPsych(); }

document.getElementById('btnAplicarBatch')?.addEventListener('click', () => {
    let prefijo = document.getElementById('inputBatchName').value.trim(); if (!prefijo) return alert("❌ Escribe un prefijo.");
    let casillas = document.querySelectorAll('.frame-checkbox:checked'); if (casillas.length === 0) return alert("❌ Selecciona almenos un frame.");
    casillas.forEach((cb) => { let indice = parseInt(cb.getAttribute('data-index')); spritesDetectados[indice].name = prefijo + "0000"; });
    autoRenumerar(); actualizarDropdownFiltros(); actualizarDropdownPsych(); renderTimelineSecuenciador(); document.getElementById('inputBatchName').value = '';
    if (typeof dibujarContornos === 'function') dibujarContornos();
});

document.getElementById('btnSelectAll')?.addEventListener('click', () => { let chks = document.querySelectorAll('.frame-checkbox'); let anyUnchecked = Array.from(chks).some(c => !c.checked); chks.forEach(cb => cb.checked = anyUnchecked); });

function actualizarDropdownFiltros() {
    let current = selectAnimFilter.value; selectAnimFilter.innerHTML = '<option value="ALL">-- Reproduciendo Todo --</option>';
    let prefijos = new Set(); spritesDetectados.forEach(s => { let base = s.name.replace(/\d+$/, ''); if (base) prefijos.add(base); });
    prefijos.forEach(p => { let opt = document.createElement('option'); opt.value = p; opt.textContent = p; selectAnimFilter.appendChild(opt); });
    if ([...prefijos].includes(current)) selectAnimFilter.value = current;
}

function seleccionarFrameAfinador(index) {
    if (spritesDetectados.length === 0) return; indexEditando = index; let s = spritesDetectados[index];
    document.getElementById('lblCurrentFrame').innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/5157/5157510.png" class="icon" alt="Sel"> ${s.name}`;
    ['frameX', 'frameY', 'frameWidth', 'frameHeight', 'w', 'h'].forEach(p => document.getElementById(`inp_${p}`).value = s[p]);
    document.getElementById('btnToggleRotar').innerHTML = `<img src="https://cdn-icons-png.flaticon.com/512/2549/2549884.png" class="icon" alt="Rot"> Rotar (${s.angle || 0}°)`; document.getElementById('btnToggleRotar').style.color = (s.angle > 0) ? 'var(--accent-pink)' : 'white'; renderizarPreviewTiempoReal();
}
function prevFrame() { if (spritesDetectados.length === 0) return; seleccionarFrameAfinador((indexEditando === null || indexEditando === 0) ? spritesDetectados.length - 1 : indexEditando - 1); }
function nextFrame() { if (spritesDetectados.length === 0) return; seleccionarFrameAfinador((indexEditando === null || indexEditando === spritesDetectados.length - 1) ? 0 : indexEditando + 1); }

function renderizarPreviewTiempoReal() {
    if (indexEditando === null || spritesDetectados.length === 0) return; let s = spritesDetectados[indexEditando]; let fw = s.frameWidth || s.w; let fh = s.frameHeight || s.h;
    canvasPreview.width = Math.max(fw, fh) + 40; canvasPreview.height = Math.max(fw, fh) + 40; ctxPreview.clearRect(0, 0, canvasPreview.width, canvasPreview.height); ctxPreview.fillStyle = "#04040a"; ctxPreview.fillRect(0, 0, canvasPreview.width, canvasPreview.height);
    ctxPreview.save(); ctxPreview.translate(canvasPreview.width / 2 - fw / 2, canvasPreview.height / 2 - fh / 2); ctxPreview.strokeStyle = "rgba(255, 255, 255, 0.3)"; ctxPreview.strokeRect(0, 0, fw, fh);
    ctxPreview.strokeStyle = "rgba(0, 229, 255, 0.2)"; ctxPreview.beginPath(); ctxPreview.moveTo(fw / 2, 0); ctxPreview.lineTo(fw / 2, fh); ctxPreview.moveTo(0, fh / 2); ctxPreview.lineTo(fw, fh / 2); ctxPreview.stroke();
    let drawX = -s.frameX; let drawY = -s.frameY; ctxPreview.translate(drawX + s.w / 2, drawY + s.h / 2); ctxPreview.rotate((s.angle || 0) * Math.PI / 180); ctxPreview.drawImage(imgOriginal, s.x, s.y, s.w, s.h, -s.w / 2, -s.h / 2, s.w, s.h); ctxPreview.restore();
}

function changeProp(p, v) { if (indexEditando === null) return; spritesDetectados[indexEditando][p] = parseInt(v) || 0; renderizarPreviewTiempoReal(); dibujarContornos(); }
function incProp(p, amt) { if (indexEditando === null) return; spritesDetectados[indexEditando][p] = (parseInt(spritesDetectados[indexEditando][p]) || 0) + amt; document.getElementById(`inp_${p}`).value = spritesDetectados[indexEditando][p]; renderizarPreviewTiempoReal(); dibujarContornos(); }
document.getElementById('btnToggleRotar')?.addEventListener('click', () => { if (indexEditando === null) return; let s = spritesDetectados[indexEditando]; s.angle = ((s.angle || 0) + 90) % 360; seleccionarFrameAfinador(indexEditando); dibujarContornos(); });
selectAnimFilter.addEventListener('change', () => { currentLoopFrameIdx = 0; updatePlayerInterval(); });

function updatePlayerInterval() {
    clearInterval(playInterval); if (!playActive || spritesDetectados.length === 0) return;
    canvasLoopPlayer.width = 400; canvasLoopPlayer.height = 400;
    playInterval = setInterval(() => {
        let filtro = selectAnimFilter.value; let framesLoop = spritesDetectados.filter(s => filtro === 'ALL' ? true : s.name.replace(/\d+$/, '') === filtro);
        if (framesLoop.length === 0) { ctxLoopPlayer.clearRect(0, 0, 400, 400); return; }
        if (currentLoopFrameIdx >= framesLoop.length) currentLoopFrameIdx = 0; let s = framesLoop[currentLoopFrameIdx];
        ctxLoopPlayer.clearRect(0, 0, 400, 400); ctxLoopPlayer.fillStyle = "#04040a"; ctxLoopPlayer.fillRect(0, 0, 400, 400);
        ctxLoopPlayer.save(); ctxLoopPlayer.translate(200, 200);
        let maxDim = Math.max(s.w, s.h, s.frameWidth || 0, s.frameHeight || 0); if (maxDim > 300) { let scale = 300 / maxDim; ctxLoopPlayer.scale(scale, scale); }
        let drawX = -s.frameX - (s.frameWidth || s.w) / 2; let drawY = -s.frameY - (s.frameHeight || s.h) / 2;
        ctxLoopPlayer.translate(drawX + s.w / 2, drawY + s.h / 2); ctxLoopPlayer.rotate((s.angle || 0) * Math.PI / 180); ctxLoopPlayer.drawImage(imgOriginal, s.x, s.y, s.w, s.h, -s.w / 2, -s.h / 2, s.w, s.h); ctxLoopPlayer.restore(); currentLoopFrameIdx++;
    }, 1000 / fpsActual);
}

document.getElementById('btnPlayPause')?.addEventListener('click', () => { playActive = !playActive; let icono = playActive ? '3249/3249396.png' : '27/27223.png'; document.getElementById('btnPlayPause').innerHTML = `<img src="https://cdn-icons-png.flaticon.com/512/${icono}" class="icon" alt="PlayPause"> ` + (playActive ? "PAUSAR" : "REANUDAR"); updatePlayerInterval(); });
document.getElementById('btnFpsUp')?.addEventListener('click', () => { if (fpsActual < 60) { fpsActual++; document.getElementById('txtFpsDisplay').textContent = `${fpsActual} FPS`; updatePlayerInterval(); } });
document.getElementById('btnFpsDown')?.addEventListener('click', () => { if (fpsActual > 1) { fpsActual--; document.getElementById('txtFpsDisplay').textContent = `${fpsActual} FPS`; updatePlayerInterval(); } });

window.uploadedAnimationJSON = null;
let jsonWarningResolve = null;

window.resolverModalJsonWarning = function (continuar) {
    document.getElementById('modalJsonWarning').style.display = 'none';
    if (jsonWarningResolve) jsonWarningResolve(continuar);
};


function actualizarBadgeJson(adj, fileName) {
    let lbl = document.getElementById('lblJsonUploaded');
    if (!lbl || !window.uploadedAnimationJSON) return;

    let json = window.uploadedAnimationJSON.obj;
    let animCount = (json.animations || []).length;
    let origScale = window.uploadedAnimationJSON.origScale;
    let origPos = window.uploadedAnimationJSON.origPosition;
    let origCamPos = window.uploadedAnimationJSON.origCameraPosition || [0, 0];
    let name = fileName || window.uploadedAnimationJSON.name;

    lbl.style.display = 'block';

    if (adj && window.lastResizeFactor && window.lastResizeFactor < 1.0) {
        lbl.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
                    <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" class="icon-sm" alt="OK">
                    <b style="color:var(--text);">${name}</b>
                    <span style="background:rgba(0, 229, 255, 0.15); color:#00e5ff; font-weight:bold; font-size:0.75rem; padding:3px 10px; border-radius:12px; border:1px solid rgba(0,229,255,0.4);">
                        ✓ Auto-Alineado Psych Engine
                    </span>
                    <span style="color:#aaa; font-size:0.8rem;">(${animCount} animaciones)</span>
                </div>
                <div style="font-size:0.85rem; color:var(--text); display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
                    <span>• <b>Escala:</b> ${origScale} <span style="color:#00e5ff;">➔</span> <b style="color:#00e5ff;">${adj.newScale}</b></span>
                    <span>• <b>Posición [X, Y]:</b> [${origPos[0]}, ${origPos[1]}] <span style="color:#00ff88;">➔</span> <b style="color:#00ff88;">[${adj.newPos[0]}, ${adj.newPos[1]}]</b></span>
                    <span>• <b>Cámara [X, Y]:</b> [${origCamPos[0]}, ${origCamPos[1]}] <span style="color:#ffcc00;">➔</span> <b style="color:#ffcc00;">[${adj.newCamPos[0]}, ${adj.newCamPos[1]}]</b></span>
                </div>
                <div style="color:#aaa; font-size:0.78rem;">
                    (Compensación: ΔPos: [+${adj.deltaX}, +${adj.deltaY}] | ΔCámara: [${adj.deltaCamX >= 0 ? '+' : ''}${adj.deltaCamX}, ${adj.deltaCamY >= 0 ? '+' : ''}${adj.deltaCamY}] | Rol: ${adj.isPlayer ? 'Player' : 'Opponent'} | Base: "${adj.refAnim}")
                </div>
            </div>
        `;
    } else {
        let posStr = `[${origPos[0]}, ${origPos[1]}]`;
        let camStr = `[${origCamPos[0]}, ${origCamPos[1]}]`;
        lbl.innerHTML = `
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:8px;">
                <img src="https://cdn-icons-png.flaticon.com/512/190/190411.png" class="icon-sm" alt="OK">
                <b style="color:var(--text);">${name}</b>
                <span style="color:#aaa; font-size:0.8rem;">| Anims: ${animCount} | Escala: ${origScale} | Pos: ${posStr} | Cámara: ${camStr}</span>
            </div>
        `;
    }
}

document.getElementById('jsonUpdateUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    if (!inp.files || inp.files.length === 0) {
        window.uploadedAnimationJSON = null;
        let lbl = document.getElementById('lblJsonUploaded');
        if (lbl) lbl.style.display = 'none';
        if (typeof window.setImportButtonState === 'function') {
            window.setImportButtonState(inp, 'reset');
        }
        let txt = document.getElementById('txtUploadJson');
        if (txt) txt.textContent = "Subir Archivo .JSON";
        return;
    }

    await window.validateAndProcessFile(inp, 'json', {
        onSuccess: async (file, data) => {
            showLoader("OPTIMIZADOR", "Procesando archivo .JSON del personaje...");
            await pensar(250);
            let json = data.obj;
            window.uploadedAnimationJSON = {
                name: file.name,
                rawObj: JSON.parse(JSON.stringify(json)),
                obj: json,
                origScale: typeof json.scale === 'number' ? json.scale : 1,
                origPosition: (Array.isArray(json.position) && json.position.length >= 2)
                    ? [Number(json.position[0]) || 0, Number(json.position[1]) || 0]
                    : [0, 0],
                origCameraPosition: (Array.isArray(json.camera_position) && json.camera_position.length >= 2)
                    ? [Number(json.camera_position[0]) || 0, Number(json.camera_position[1]) || 0]
                    : [0, 0]
            };

            let txt = document.getElementById('txtUploadJson');
            if (txt) txt.textContent = `✓ .JSON: ${file.name}`;

            let isOptimized = window.lastResizeFactor && window.lastResizeFactor < 1.0;
            if (isOptimized) {
                showLoader("CALCULANDO MATEMÁTICAS", "Alineando posición, cámara y escala del personaje para Psych Engine...");
                await pensar(400);
                let adj = calcularAjustePsychJson(window.uploadedAnimationJSON.rawObj, window.lastResizeFactor);
                window.uploadedAnimationJSON.obj = adj.json;
                actualizarBadgeJson(adj, file.name);
            } else {
                actualizarBadgeJson(null, file.name);
            }

            await pensar(200);
            ocultarCargaGlobal();
        },
        onError: (errType, msg) => {
            window.uploadedAnimationJSON = null;
            let lbl = document.getElementById('lblJsonUploaded');
            if (lbl) lbl.style.display = 'none';
            let txt = document.getElementById('txtUploadJson');
            if (txt) txt.textContent = "Subir Archivo .JSON";
            ocultarCargaGlobal();
        }
    });
});

async function repackAndExport() {
    if (spritesDetectados.length === 0) return alert("No hay frames para empaquetar.");

    let isOptimized = window.lastResizeFactor && window.lastResizeFactor < 1.0;

    if (isOptimized && !window.uploadedAnimationJSON) {
        let continuar = await new Promise((resolve) => {
            jsonWarningResolve = resolve;
            document.getElementById('modalJsonWarning').style.display = 'flex';
        });
        if (!continuar) return;
    }

    let jsonExportData = null;
    if (window.uploadedAnimationJSON) {
        let finalJson = window.uploadedAnimationJSON.obj;
        if (isOptimized) {
            let factor = window.lastResizeFactor || 1.0;
            let adj = calcularAjustePsychJson(window.uploadedAnimationJSON.rawObj || window.uploadedAnimationJSON.obj, factor);
            if (adj) finalJson = adj.json;
        }
        jsonExportData = { name: window.uploadedAnimationJSON.name, content: JSON.stringify(finalJson, null, "\t") };
    }

    showLoader("OPTIMIZADOR", "Comprimiendo .XML + .PNG en .ZIP..."); await pensar(500);

    let uniqueFrames = []; let duplicatesMap = new Map(); let hashMap = new Map();
    for (let s of spritesDetectados) {
        let tmpCanvas = document.createElement('canvas'); tmpCanvas.width = s.w; tmpCanvas.height = s.h;
        let tmpCtx = tmpCanvas.getContext('2d'); tmpCtx.drawImage(imgOriginal, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
        let hash = tmpCanvas.toDataURL();
        if (hashMap.has(hash)) { let master = hashMap.get(hash); duplicatesMap.set(s.name, master); } else { hashMap.set(hash, s); uniqueFrames.push(s); }
    }

    let dupCount = spritesDetectados.length - uniqueFrames.length; uniqueFrames.sort((a, b) => b.h - a.h); let totalArea = 0; let maxW = 0;
    for (let s of uniqueFrames) { totalArea += (s.w * s.h); if (s.w > maxW) maxW = s.w; }
    let idealWidth = Math.ceil(Math.sqrt(totalArea) * 1.15); let maxWidth = Math.max(maxW, idealWidth);
    let currentX = 0; let currentY = 0; let shelfHeight = 0; let actualMaxWidth = 0;
    for (let s of uniqueFrames) {
        if (currentX + s.w > maxWidth) { currentX = 0; currentY += shelfHeight; shelfHeight = 0; }
        s.packX = currentX; s.packY = currentY; currentX += s.w; if (s.h > shelfHeight) shelfHeight = s.h; if (currentX > actualMaxWidth) actualMaxWidth = currentX;
    }
    let totalHeight = currentY + shelfHeight;
    let packCanvas = document.createElement('canvas'); packCanvas.width = actualMaxWidth; packCanvas.height = totalHeight; let pCtx = packCanvas.getContext('2d');
    for (let s of uniqueFrames) { pCtx.drawImage(imgOriginal, s.x, s.y, s.w, s.h, s.packX, s.packY, s.w, s.h); }

    let baseName = nombreArchivo.replace(/\.[^/.]+$/, "");
    let finalBaseName = isOptimized ? baseName + "_opt" : baseName;

    let nombreZipPNG = finalBaseName + ".png";
    let nombreZipXML = finalBaseName + ".xml";

    let xmlLines = [];
    xmlLines.push('<?xml version="1.0" encoding="utf-8"?>');
    xmlLines.push('<TextureAtlas imagePath="' + nombreZipPNG + '">');
    xmlLines.push('<!-- Spritesheet Generator FNF LaloCF -->\t');
    xmlLines.push('<!-- https://lalocf2.github.io/spritesheet-generator-fnf/ -->\t');

    let exportSprites = [...spritesDetectados]; exportSprites.sort((a, b) => a.name.localeCompare(b.name));
    exportSprites.forEach((s) => {
        let target = duplicatesMap.has(s.name) ? duplicatesMap.get(s.name) : s; let rot = (s.angle === 90 || s.angle === 270) ? ' rotated="true"' : '';
        xmlLines.push('\t<SubTexture name="' + s.name + '" x="' + target.packX + '" y="' + target.packY + '" width="' + target.w + '" height="' + target.h + '" frameX="' + s.frameX + '" frameY="' + s.frameY + '" frameWidth="' + s.frameWidth + '" frameHeight="' + s.frameHeight + '"' + rot + '/>');
    });
    xmlLines.push('</TextureAtlas>');

    let xml = xmlLines.join('\\r\\n').replace(/\\\\r\\\\n/g, '\\r\\n');
    xml = xmlLines.join('\r\n');

    packCanvas.toBlob(function (blobPNG) {
        let zip = new JSZip();
        zip.file(nombreZipPNG, blobPNG);
        zip.file(nombreZipXML, xml);
        if (jsonExportData) {
            zip.file(jsonExportData.name, jsonExportData.content);
        }
        zip.generateAsync({ type: "blob" }).then(function (content) {
            let aZip = document.createElement('a'); aZip.href = URL.createObjectURL(content);
            aZip.download = finalBaseName + ".zip"; aZip.click();
            ocultarCargaGlobal();
            alert(`¡Éxito! Imagen comprimida.\nSe eliminaron ${dupCount} frames duplicados.\nTu archivo ZIP se ha descargado.`);
        });
    });
}

async function exportarActual() {
    if (appMode === 'PSYCH') {
        let charData = { animations: psychAnimations, no_antialiasing: !document.getElementById('p_antialias').checked, image: document.getElementById('p_image').value, position: [parseInt(document.getElementById('p_posX').value) || 0, parseInt(document.getElementById('p_posY').value) || 0], healthicon: document.getElementById('p_icon').value, flip_x: document.getElementById('p_flip').checked, healthbar_colors: hexToRgb(document.getElementById('p_color').value), camera_position: [parseInt(document.getElementById('p_camX').value) || 0, parseInt(document.getElementById('p_camY').value) || 0], sing_duration: parseFloat(document.getElementById('p_sing').value) || 4, scale: parseFloat(document.getElementById('p_scale').value) || 1 };
        const blob = new Blob([JSON.stringify(charData, null, "\t")], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = nombreArchivo.replace(/\.[^/.]+$/, ".json"); document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } else {
        if (spritesDetectados.length === 0) return alert("❌ No hay frames para exportar.");

        let isOptimized = window.lastResizeFactor && window.lastResizeFactor < 1.0;

        if (isOptimized && !window.uploadedAnimationJSON) {
            let continuar = await new Promise((resolve) => {
                jsonWarningResolve = resolve;
                document.getElementById('modalJsonWarning').style.display = 'flex';
            });
            if (!continuar) return;
        }

        let jsonExportData = null;
        if (window.uploadedAnimationJSON) {
            let finalJson = window.uploadedAnimationJSON.obj;
            if (isOptimized) {
                let factor = window.lastResizeFactor || 1.0;
                let adj = calcularAjustePsychJson(window.uploadedAnimationJSON.rawObj || window.uploadedAnimationJSON.obj, factor);
                if (adj) finalJson = adj.json;
            }
            jsonExportData = { name: window.uploadedAnimationJSON.name, content: JSON.stringify(finalJson, null, "\t") };
        }

        let baseName = nombreArchivo.replace(/\.[^/.]+$/, "");
        let finalBaseName = isOptimized ? baseName + "_opt" : baseName;

        let nombrePNG = finalBaseName + ".png";

        let xmlLines = [];
        xmlLines.push('<?xml version="1.0" encoding="utf-8"?>');
        xmlLines.push('<TextureAtlas imagePath="' + nombrePNG + '">');
        xmlLines.push('<!-- Spritesheet Generator FNF LaloCF -->\t');
        xmlLines.push('<!-- https://lalocf2.github.io/spritesheet-generator-fnf/ -->\t');

        let exportSprites = [...spritesDetectados]; exportSprites.sort((a, b) => a.name.localeCompare(b.name));
        exportSprites.forEach((s) => {
            let rot = (s.angle === 90 || s.angle === 270) ? ' rotated="true"' : '';
            xmlLines.push('\t<SubTexture name="' + s.name + '" x="' + s.x + '" y="' + s.y + '" width="' + s.w + '" height="' + s.h + '" frameX="' + s.frameX + '" frameY="' + s.frameY + '" frameWidth="' + s.frameWidth + '" frameHeight="' + s.frameHeight + '"' + rot + '/>');
        });
        xmlLines.push('</TextureAtlas>');

        let xml = xmlLines.join('\r\n');

        const blob = new Blob([xml], { type: 'text/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = finalBaseName + ".xml"; document.body.appendChild(a); a.click(); document.body.removeChild(a);

        if (jsonExportData) {
            const blobJSON = new Blob([jsonExportData.content], { type: 'application/json' }); const aJ = document.createElement('a'); aJ.href = URL.createObjectURL(blobJSON);
            aJ.download = jsonExportData.name; document.body.appendChild(aJ); aJ.click(); document.body.removeChild(aJ);
        }
    }
}

// ==========================================
// RESIZE INTELIGENTE (IMAGEN Y XML)
// ==========================================

function toggleCustomResizeInput() {
    let sel = document.getElementById('selResizeFactor');
    let inp = document.getElementById('inpResizeCustom');
    if (sel.value === 'custom') {
        inp.style.display = 'inline-block';
    } else {
        inp.style.display = 'none';
    }
}

function actualizarLabelResolucion() {
    let lbl = document.getElementById('lblResizeCurrent');
    if (lbl && imgOriginal && imgOriginal.width > 0) {
        lbl.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/3114/3114883.png" class="icon-sm" alt="Size"> Tamaño: ${imgOriginal.width} x ${imgOriginal.height}`;
    }
}

async function aplicarResizeOptimizador() {
    if (!imgOriginal || imgOriginal.width === 0 || spritesDetectados.length === 0) {
        return alert("❌ Primero debes subir una imagen y un XML (Modo Optimizador).");
    }

    let sel = document.getElementById('selResizeFactor').value;
    let factor = 1.0;

    if (sel === 'recommend') {
        let maxDim = Math.max(imgOriginal.width, imgOriginal.height);
        if (maxDim > 4000) factor = 0.5;
        else if (maxDim > 2048) factor = 2048 / maxDim;
        else if (maxDim > 1024) factor = 0.75;
        else {
            return alert("Tu imagen ya está optimizada o es muy pequeña (menor a 1024px). No es necesario reducirla.");
        }
    } else if (sel === 'custom') {
        let val = parseFloat(document.getElementById('inpResizeCustom').value);
        if (isNaN(val) || val <= 0 || val > 100) return alert("❌ Ingresa un porcentaje válido (1-100).");
        factor = val / 100.0;
    } else {
        factor = parseFloat(sel);
    }

    if (factor >= 1.0) return alert("❌ El factor debe ser menor para reducir el tamaño.");

    window.totalResizeFactor = (window.totalResizeFactor || 1.0) * factor;
    window.lastResizeFactor = window.totalResizeFactor;

    // Rueda de carga con fases matemáticas
    showLoader("OPTIMIZADOR", "Iniciando proceso de optimización...");
    await pensar(350);

    let newWidth = Math.round(imgOriginal.width * factor);
    let newHeight = Math.round(imgOriginal.height * factor);

    showLoader("REESCALANDO IMAGEN", `Redimensionando textura gráfica a ${newWidth}x${newHeight} (Calidad Alta)...`);
    await pensar(400);

    let tempCanvas = document.createElement('canvas');
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    let tempCtx = tempCanvas.getContext('2d');

    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    tempCtx.drawImage(imgOriginal, 0, 0, newWidth, newHeight);

    let newImgSrc = tempCanvas.toDataURL("image/png");

    showLoader("RECALCULANDO ATLAS", `Ajustando cajas y coordenadas de ${spritesDetectados.length} fotogramas en el XML...`);
    await pensar(350);

    spritesDetectados.forEach(s => {
        if (s.origFrameWidth === undefined) s.origFrameWidth = s.frameWidth || s.w;
        if (s.origFrameHeight === undefined) s.origFrameHeight = s.frameHeight || s.h;
        s.x = Math.round(s.x * factor);
        s.y = Math.round(s.y * factor);
        s.w = Math.round(s.w * factor);
        s.h = Math.round(s.h * factor);
        s.frameX = Math.round((s.frameX || 0) * factor);
        s.frameY = Math.round((s.frameY || 0) * factor);
        s.frameWidth = Math.round(s.origFrameWidth * window.totalResizeFactor);
        s.frameHeight = Math.round(s.origFrameHeight * window.totalResizeFactor);
    });

    let jsonAdjResult = null;
    if (window.uploadedAnimationJSON) {
        showLoader("CALCULANDO MATEMÁTICAS", "Analizando centro HaxeFlixel y compensando posición y cámara...");
        await pensar(500);

        jsonAdjResult = calcularAjustePsychJson(window.uploadedAnimationJSON.rawObj, window.totalResizeFactor);
        window.uploadedAnimationJSON.obj = jsonAdjResult.json;
        actualizarBadgeJson(jsonAdjResult);

        showLoader("SINCRONIZANDO JSON", `Alineando Pos: [${jsonAdjResult.origPos[0]}, ${jsonAdjResult.origPos[1]}] ➔ [${jsonAdjResult.newPos[0]}, ${jsonAdjResult.newPos[1]}] | Cámara: [${jsonAdjResult.origCamPos[0]}, ${jsonAdjResult.origCamPos[1]}] ➔ [${jsonAdjResult.newCamPos[0]}, ${jsonAdjResult.newCamPos[1]}]...`);
        await pensar(500);
    }

    let newImg = new Image();
    newImg.onload = () => {
        imgOriginal = newImg;
        if (typeof canvas !== 'undefined' && canvas !== null) {
            canvas.width = newImg.width;
            canvas.height = newImg.height;
        }
        actualizarLabelResolucion();
        renderTimelineSecuenciador();
        if (indexEditando !== null) seleccionarFrameAfinador(indexEditando);
        if (typeof dibujarContornos === 'function') dibujarContornos();

        ocultarCargaGlobal();

        let msg = `¡Optimización completada con éxito!\n\n` +
                  `• Nuevo tamaño de imagen: ${newWidth}x${newHeight}\n` +
                  `• El XML ha sido ajustado automáticamente.`;

        if (jsonAdjResult) {
            msg += `\n\n• JSON del personaje ajustado (Psych Engine):\n` +
                   `  - Nueva Escala: ${jsonAdjResult.newScale} (antes ${jsonAdjResult.origScale})\n` +
                   `  - Nueva Posición [X, Y]: [${jsonAdjResult.newPos[0]}, ${jsonAdjResult.newPos[1]}] (antes [${jsonAdjResult.origPos[0]}, ${jsonAdjResult.origPos[1]}])\n` +
                   `  - Nueva Cámara [X, Y]: [${jsonAdjResult.newCamPos[0]}, ${jsonAdjResult.newCamPos[1]}] (antes [${jsonAdjResult.origCamPos[0]}, ${jsonAdjResult.origCamPos[1]}])\n` +
                   `  - Compensación calculada: ΔPos: [+${jsonAdjResult.deltaX}, +${jsonAdjResult.deltaY}] | ΔCámara: [${jsonAdjResult.deltaCamX >= 0 ? '+' : ''}${jsonAdjResult.deltaCamX}, ${jsonAdjResult.deltaCamY >= 0 ? '+' : ''}${jsonAdjResult.deltaCamY}] (Rol: ${jsonAdjResult.isPlayer ? 'Player' : 'Opponent'} | Base: "${jsonAdjResult.refAnim}")\n\n` +
                   `¡Tu personaje y la cámara mantendrán exactamente su posición y enfoque idénticos al original en Psych Engine!`;
        }

        alert(msg);
        if (typeof window.autoSaveHistory === 'function') window.autoSaveHistory();
    };
    newImg.src = newImgSrc;
}
