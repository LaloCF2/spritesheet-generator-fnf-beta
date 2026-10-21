// ==========================================
// SECUENCIADOR Y EXPORTACIÓN ZIP
// ==========================================

let renderTimelineAbortCtrl = null;

async function renderTimelineSecuenciador() {
    if (renderTimelineAbortCtrl) renderTimelineAbortCtrl.abort();
    renderTimelineAbortCtrl = new AbortController();
    let signal = renderTimelineAbortCtrl.signal;

    // Mover, borrar o duplicar frames puede cambiar el primer frame del XML: se recalcula el JSON
    if (window.uploadedAnimationJSON) refrescarAjusteJson();

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
    autoRenumerar(); renderTimelineSecuenciador(); if (typeof dibujarContornos === 'function') dibujarContornos(); actualizarDropdownFiltros(); if (typeof actualizarDropdownPsych === 'function') actualizarDropdownPsych();
}
function deleteFrame(idx) { spritesDetectados.splice(idx, 1); if (indexEditando === idx) indexEditando = null; autoRenumerar(); renderTimelineSecuenciador(); if (typeof dibujarContornos === 'function') dibujarContornos(); actualizarDropdownFiltros(); if (typeof actualizarDropdownPsych === 'function') actualizarDropdownPsych(); }

document.getElementById('btnAplicarBatch')?.addEventListener('click', () => {
    let prefijo = document.getElementById('inputBatchName').value.trim(); if (!prefijo) return alert("❌ Escribe un prefijo.");
    let casillas = document.querySelectorAll('.frame-checkbox:checked'); if (casillas.length === 0) return alert("❌ Selecciona almenos un frame.");
    casillas.forEach((cb) => { let indice = parseInt(cb.getAttribute('data-index')); spritesDetectados[indice].name = prefijo + "0000"; });
    autoRenumerar(); actualizarDropdownFiltros(); if (typeof actualizarDropdownPsych === 'function') actualizarDropdownPsych(); renderTimelineSecuenciador(); document.getElementById('inputBatchName').value = '';
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

function changeProp(p, v) { if (indexEditando === null) return; spritesDetectados[indexEditando][p] = parseInt(v) || 0; renderizarPreviewTiempoReal(); if (typeof dibujarContornos === 'function') dibujarContornos(); }
function incProp(p, amt) { if (indexEditando === null) return; spritesDetectados[indexEditando][p] = (parseInt(spritesDetectados[indexEditando][p]) || 0) + amt; document.getElementById(`inp_${p}`).value = spritesDetectados[indexEditando][p]; renderizarPreviewTiempoReal(); if (typeof dibujarContornos === 'function') dibujarContornos(); }
document.getElementById('btnToggleRotar')?.addEventListener('click', () => { if (indexEditando === null) return; let s = spritesDetectados[indexEditando]; s.angle = ((s.angle || 0) + 90) % 360; seleccionarFrameAfinador(indexEditando); if (typeof dibujarContornos === 'function') dibujarContornos(); });
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
    if (jsonWarningResolve) {
        let resolver = jsonWarningResolve;
        jsonWarningResolve = null;
        resolver(continuar);
    }
};

// Pregunta si se exporta sin JSON cuando la imagen se redujo (modal compartido con el Optimizador ASTC)
window.pedirConfirmacionSinJson = function () {
    let modal = document.getElementById('modalJsonWarning');
    if (!modal) return Promise.resolve(true);
    let pct = document.getElementById('lblJsonWarnPct');
    if (pct) pct.textContent = formatoPorcentaje(window.totalResizeFactor || 1.0);
    return new Promise((resolve) => {
        jsonWarningResolve = resolve;
        modal.style.display = 'flex';
    });
};

function escHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function formatoPorcentaje(f) {
    return (Math.round(f * 1000) / 10) + '%';
}

function formatoPx(v) {
    return v < 1 ? 'menos de 1 px' : `±${(Math.round(v * 10) / 10)} px`;
}

function rolPersonajeElegido() {
    let sel = document.getElementById('selCharRole');
    return sel ? sel.value : 'auto';
}

function cambiarRolPersonaje() {
    window.psychCharRole = rolPersonajeElegido();
    refrescarAjusteJson();
}

// Ajuste del JSON con el estado actual: factor acumulado, primer frame del XML que se va a exportar y rol elegido.
function obtenerAjusteJsonActual() {
    let up = window.uploadedAnimationJSON;
    if (!up || typeof calcularAjustePsychJson !== 'function' || spritesDetectados.length === 0) return null;
    let factor = window.totalResizeFactor || 1.0;
    let s0 = spritesDetectados[0];
    let adj = calcularAjustePsychJson(up.rawObj, factor, spritesDetectados, {
        frame0Orig: window.atlasFrame0Original || undefined,
        frame0New: { fw: s0.frameWidth || s0.w, fh: s0.frameHeight || s0.h, name: s0.name },
        role: rolPersonajeElegido()
    });
    if (!adj) return null;
    adj.factor = factor;
    adj.hayCambios = adj.newScale !== adj.origScale || adj.deltaX !== 0 || adj.deltaY !== 0 || adj.deltaCamX !== 0 || adj.deltaCamY !== 0;
    if (window.spritesOriginales && typeof verificarAjustePsych === 'function') {
        adj.verif = verificarAjustePsych(window.spritesOriginales, spritesDetectados, up.rawObj, adj.json, adj.role);
    }
    return adj;
}

// Recalcula el JSON con el estado actual y actualiza la tarjeta
function refrescarAjusteJson() {
    let up = window.uploadedAnimationJSON;
    if (!up) return null;
    let adj = obtenerAjusteJsonActual();
    up.obj = adj ? adj.json : JSON.parse(JSON.stringify(up.rawObj));
    actualizarBadgeJson(adj);
    return adj;
}

function avisosDelJson(raw) {
    let notas = [];
    if (raw.no_antialiasing === true && (window.totalResizeFactor || 1) < 1) {
        notas.push('Este personaje es <b>pixel art</b> (no_antialiasing): al reducir la resolución se verá borroso o pixelado. Para pixel art es mejor no reducir.');
    }
    if (raw.image && typeof nombreArchivo === 'string') {
        let imgJson = String(raw.image).split(/[\\/]/).pop().replace(/\.[^.]+$/, '').toLowerCase();
        let imgSubida = nombreArchivo.replace(/\.[^.]+$/, '').toLowerCase();
        if (imgJson && imgSubida && imgJson !== imgSubida) {
            notas.push(`El JSON usa la imagen <b>${escHtml(String(raw.image))}</b> y subiste <b>${escHtml(nombreArchivo)}</b>. Revisa que sea el JSON de este personaje.`);
        }
    }
    return notas;
}

function actualizarBadgeJson(adj, fileName) {
    let lbl = document.getElementById('lblJsonUploaded');
    let up = window.uploadedAnimationJSON;
    if (!lbl || !up) return;

    let raw = up.rawObj;
    let name = escHtml(fileName || up.name);
    let animCount = (raw.animations || []).length;
    let par = (a) => `[${a[0]}, ${a[1]}]`;
    lbl.style.display = 'block';

    if (!adj) {
        lbl.innerHTML = `
            <div class="opt-json-head">
                <span class="opt-json-file">✓ ${name}</span>
                <span class="opt-tag">${animCount} animaciones</span>
            </div>
            <div class="opt-status info">Escala ${up.origScale} · Posición ${par(up.origPosition)} · Cámara ${par(up.origCameraPosition)}</div>`;
        return;
    }

    let rolTxt = nombreRolPsych(adj.role) + (adj.roleAuto ? ' (automático)' : '');
    let fila = (k, a, b) => `
        <div class="opt-k">${k}</div><div>${a}</div><div class="opt-arrow">→</div>
        <div class="opt-new ${a !== b ? 'opt-changed' : ''}">${b}</div>`;

    let estado;
    if (!adj.hayCambios) {
        estado = `<div class="opt-status info">Sin cambios por ahora. Cuando reduzcas la resolución se ajustarán solos la escala, la posición y la cámara.</div>`;
    } else if (adj.verif && adj.verif.frames > 0) {
        let v = adj.verif;
        if (v.posErr <= 3 && v.camErr <= 2) {
            estado = `<div class="opt-status ok">✔ <b>Verificado:</b> simulé los ${v.frames} frames en Psych Engine antes y después. El personaje queda a <b>${formatoPx(v.posErr)}</b> y la cámara a <b>${formatoPx(v.camErr)}</b> del original.</div>`;
        } else {
            estado = `<div class="opt-status warn">⚠ Diferencia de hasta <b>${formatoPx(v.posErr)}</b> en «${escHtml(v.peor)}» (cámara: ${formatoPx(v.camErr)}). Es normal si editaste ese frame a mano en el Laboratorio de Offsets.</div>`;
        }
    } else {
        estado = `<div class="opt-status ok">✔ Escala, posición y cámara compensadas con el modelo de Psych Engine.</div>`;
    }

    let notas = [];
    let f0 = adj.frame0Orig || {}, f1 = adj.frame0New || {};
    let primerNuevo = spritesDetectados[0] ? spritesDetectados[0].name : '';
    if (f0.name && primerNuevo && f0.name !== primerNuevo) {
        notas.push(`El primer frame del XML cambió de «${escHtml(f0.name)}» a «${escHtml(primerNuevo)}». Psych usa ese frame como centro del personaje: ya está compensado.`);
    } else if (primerNuevo) {
        notas.push(`Centro del personaje en Psych: primer frame del XML, «${escHtml(primerNuevo)}» (${f1.fw}×${f1.fh}).`);
    }
    notas.push(adj.roleAuto
        ? `La cámara depende de dónde uses al personaje. Lo detecté como <b>${nombreRolPsych(adj.role)}</b>; si en tu canción va en otro lugar, cámbialo en «Lugar en la canción».`
        : `Cámara calculada para <b>${nombreRolPsych(adj.role)}</b>.`);
    notas = notas.concat(avisosDelJson(raw));

    lbl.innerHTML = `
        <div class="opt-json-head">
            <span class="opt-json-file">✓ ${name}</span>
            <span class="opt-tag">${animCount} animaciones</span>
            <span class="opt-tag opt-tag-role">${rolTxt}</span>
        </div>
        <div class="opt-json-table">
            <div></div><div class="opt-th">Original</div><div></div><div class="opt-th">Nuevo</div>
            ${fila('Escala', String(adj.origScale), String(adj.newScale))}
            ${fila('Posición X, Y', par(adj.origPos), par(adj.newPos))}
            ${fila('Cámara X, Y', par(adj.origCamPos), par(adj.newCamPos))}
        </div>
        ${estado}
        <ul class="opt-notes">${notas.map(n => `<li>${n}</li>`).join('')}</ul>`;
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
        if (txt) txt.textContent = "Subir .JSON del personaje";
        actualizarPreviewResize();
        return;
    }

    await window.validateAndProcessFile(inp, 'json', {
        onSuccess: async (file, data) => {
            showLoader("OPTIMIZADOR", "Leyendo el .JSON del personaje...");
            await pensar(150);
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
            if (txt) txt.textContent = `✓ ${file.name}`;

            let adj = refrescarAjusteJson();
            actualizarPreviewResize();
            ocultarCargaGlobal();
            if (adj && adj.hayCambios && window.UI) {
                window.UI.toast(`JSON ajustado: escala ${adj.newScale}, posición [${adj.newPos}], cámara [${adj.newCamPos}]`, 'ok');
            }
        },
        onError: (errType, msg) => {
            window.uploadedAnimationJSON = null;
            let lbl = document.getElementById('lblJsonUploaded');
            if (lbl) lbl.style.display = 'none';
            let txt = document.getElementById('txtUploadJson');
            if (txt) txt.textContent = "Subir .JSON del personaje";
            ocultarCargaGlobal();
        }
    });
});

// ==========================================
// FRAMES ÚNICOS Y EMPAQUETADO (los usan la exportación y el cálculo de peso)
// ==========================================

// Separación entre frames del atlas: con el suavizado del juego ningún frame toma píxeles del vecino
const PAD_ATLAS = 2;
let cacheFramesUnicos = null;

function hashPixeles(data) {
    let u = new Uint32Array(data.buffer, data.byteOffset, data.length >> 2);
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9 ^ u.length;
    for (let i = 0; i < u.length; i++) {
        let v = u[i];
        h1 = Math.imul(h1 ^ v, 16777619);
        h2 = Math.imul(h2 ^ (v + i), 2246822507);
    }
    return (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36) + '.' + u.length;
}

// Frames con imagen distinta; los repetidos reutilizan la zona del atlas de su "maestro".
function framesUnicos() {
    let firma = imgOriginal.width + 'x' + imgOriginal.height + '|' + spritesDetectados.map(s => s.x + ',' + s.y + ',' + s.w + ',' + s.h).join(';');
    if (cacheFramesUnicos && cacheFramesUnicos.img === imgOriginal && cacheFramesUnicos.firma === firma) return cacheFramesUnicos;
    let unicos = [], repetidoDe = new Map(), porZona = new Map(), porHash = new Map();
    let c = document.createElement('canvas'), g = c.getContext('2d', { willReadFrequently: true });
    for (let s of spritesDetectados) {
        let zona = s.x + ',' + s.y + ',' + s.w + ',' + s.h;
        if (porZona.has(zona)) { repetidoDe.set(s, porZona.get(zona)); continue; }   // misma zona = mismo frame
        let clave = zona;
        if (s.w > 0 && s.h > 0) {
            c.width = s.w; c.height = s.h;
            g.drawImage(imgOriginal, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h);
            clave = s.w + 'x' + s.h + ':' + hashPixeles(g.getImageData(0, 0, s.w, s.h).data);
        }
        if (porHash.has(clave)) {
            repetidoDe.set(s, porHash.get(clave));
            porZona.set(zona, porHash.get(clave));
        } else {
            porHash.set(clave, s);
            porZona.set(zona, s);
            unicos.push(s);
        }
    }
    c.width = c.height = 0;
    cacheFramesUnicos = { img: imgOriginal, firma, unicos, repetidoDe };
    return cacheFramesUnicos;
}

// Empaquetado en estantes (de más alto a más bajo). items: [{ key, w, h }] -> { pos: Map(key -> {x, y}), w, h }
function empaquetarEstantes(items, pad) {
    let porAltura = [...items].sort((a, b) => b.h - a.h);
    let totalArea = 0, maxW = 0;
    for (let it of porAltura) { totalArea += (it.w + pad) * (it.h + pad); if (it.w + pad > maxW) maxW = it.w + pad; }
    let maxWidth = Math.max(maxW, Math.ceil(Math.sqrt(totalArea) * 1.15));
    let x = 0, y = 0, estante = 0, ancho = 0, pos = new Map();
    for (let it of porAltura) {
        if (x > 0 && x + it.w > maxWidth) { x = 0; y += estante + pad; estante = 0; }
        pos.set(it.key, { x, y });
        x += it.w + pad;
        if (it.h > estante) estante = it.h;
        if (x - pad > ancho) ancho = x - pad;
    }
    return { pos, w: Math.max(1, ancho), h: Math.max(1, y + estante) };
}

// XML Sparrow en el MISMO orden que la lista de frames: Psych usa el primer frame como centro del personaje
// y como caja que sigue la cámara, así que nunca se reordena al exportar.
function construirXmlSparrow(nombreImagen, posicionDe) {
    let xmlLines = [];
    xmlLines.push('<?xml version="1.0" encoding="utf-8"?>');
    xmlLines.push('<TextureAtlas imagePath="' + nombreImagen + '">');
    xmlLines.push('<!-- Spritesheet Generator FNF LaloCF -->\t');
    xmlLines.push('<!-- https://lalocf2.github.io/spritesheet-generator-fnf/ -->\t');
    spritesDetectados.forEach((s) => {
        let p = posicionDe(s);
        let rot = (s.angle === 90 || s.angle === 270) ? ' rotated="true"' : '';
        xmlLines.push('\t<SubTexture name="' + s.name + '" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" frameX="' + s.frameX + '" frameY="' + s.frameY + '" frameWidth="' + s.frameWidth + '" frameHeight="' + s.frameHeight + '"' + rot + '/>');
    });
    xmlLines.push('</TextureAtlas>');
    return xmlLines.join('\r\n');
}

// Informe .txt que va dentro del ZIP: qué cambió y qué sigue igual
function construirInformeOptimizacion(info) {
    let L = [];
    let res = window.resolucionOriginal;
    let f = window.totalResizeFactor || 1.0;
    L.push("INFORME DE OPTIMIZACIÓN - Spritesheet Generator FNF'");
    L.push("=".repeat(52));
    L.push(`Archivo: ${info.baseName}`);
    if (f < 1 && res) L.push(`Resolución: ${res.w}x${res.h} -> ${imgOriginal.width}x${imgOriginal.height} (${formatoPorcentaje(f)})`);
    else L.push(`Resolución: ${imgOriginal.width}x${imgOriginal.height} (sin reducir)`);
    L.push(`Atlas reempaquetado: ${info.atlasW}x${info.atlasH} px`);
    L.push(`Frames: ${spritesDetectados.length} (${info.dupCount} repetidos reutilizan la misma imagen)`);
    L.push(`Orden del XML: el mismo de la lista (primer frame: "${spritesDetectados[0].name}")`);
    if (info.extra) L.push(info.extra);
    L.push("");
    let adj = info.adj;
    if (adj) {
        L.push(`JSON DEL PERSONAJE: ${window.uploadedAnimationJSON.name}`);
        L.push(`Lugar en la canción (para la cámara): ${nombreRolPsych(adj.role)}${adj.roleAuto ? ' (automático)' : ''}`);
        L.push(`  Escala:          ${adj.origScale} -> ${adj.newScale}`);
        L.push(`  Posición X, Y:   [${adj.origPos.join(', ')}] -> [${adj.newPos.join(', ')}]`);
        L.push(`  Cámara X, Y:     [${adj.origCamPos.join(', ')}] -> [${adj.newCamPos.join(', ')}]`);
        L.push("  Sin cambios: animaciones, offsets, fps, flip_x, icono, colores y todo lo demás.");
        if (adj.verif && adj.verif.frames > 0) {
            L.push(`  Verificación (modelo de Psych Engine, ${adj.verif.frames} frames): personaje ${formatoPx(adj.verif.posErr)}, cámara ${formatoPx(adj.verif.camErr)} respecto al original.`);
        }
    } else if (f < 1) {
        L.push("SIN JSON: la escala, posición y cámara del personaje NO se ajustaron.");
        L.push(`En el juego se verá al ${formatoPorcentaje(f)} de su tamaño hasta que subas el .json y vuelvas a exportar.`);
    }
    L.push("");
    L.push("CÓMO USARLO");
    L.push("Los archivos tienen su nombre original: reemplaza los de tu mod (imagen y XML en images/characters,");
    L.push("el .json en characters). No hace falta cambiar nada más.");
    return L.join('\r\n');
}

async function repackAndExport() {
    if (spritesDetectados.length === 0) return alert("No hay frames para empaquetar.");

    let isOptimized = (window.totalResizeFactor || 1.0) < 1.0;
    if (isOptimized && !window.uploadedAnimationJSON) {
        if (!(await window.pedirConfirmacionSinJson())) return;
    }

    let adj = obtenerAjusteJsonActual();
    let jsonExportData = adj ? { name: window.uploadedAnimationJSON.name, content: JSON.stringify(adj.json, null, "\t") } : null;

    showLoader("OPTIMIZADOR", "Comprimiendo .XML + .PNG en .ZIP..."); await pensar(120);

    let fu = framesUnicos();
    let uniqueFrames = fu.unicos;
    let dupCount = spritesDetectados.length - uniqueFrames.length;
    let pack = empaquetarEstantes(uniqueFrames.map(s => ({ key: s, w: s.w, h: s.h })), PAD_ATLAS);
    let packCanvas = document.createElement('canvas'); packCanvas.width = pack.w; packCanvas.height = pack.h; let pCtx = packCanvas.getContext('2d');
    for (let s of uniqueFrames) { let p = pack.pos.get(s); pCtx.drawImage(imgOriginal, s.x, s.y, s.w, s.h, p.x, p.y, s.w, s.h); }
    let pos = new Map();
    spritesDetectados.forEach(s => {
        let m = fu.repetidoDe.get(s) || s, p = pack.pos.get(m);
        pos.set(s, { x: p.x, y: p.y, w: m.w, h: m.h });
    });

    // Los archivos del ZIP conservan su nombre original para que el campo "image" del JSON los encuentre
    let baseName = nombreArchivo.replace(/\.[^/.]+$/, "");
    let nombreZipPNG = baseName + ".png";
    let nombreZipXML = baseName + ".xml";
    let nombreZip = (isOptimized ? baseName + "_opt" : baseName) + ".zip";

    let xml = construirXmlSparrow(nombreZipPNG, (s) => pos.get(s));
    let informe = (isOptimized || adj) ? construirInformeOptimizacion({ baseName, atlasW: packCanvas.width, atlasH: packCanvas.height, dupCount, adj }) : null;

    packCanvas.toBlob(function (blobPNG) {
        let zip = new JSZip();
        zip.file(nombreZipPNG, blobPNG);
        zip.file(nombreZipXML, xml);
        if (jsonExportData) zip.file(jsonExportData.name, jsonExportData.content);
        if (informe) zip.file("informe_optimizacion.txt", informe);
        zip.generateAsync({ type: "blob" }).then(function (content) {
            let aZip = document.createElement('a'); aZip.href = URL.createObjectURL(content);
            aZip.download = nombreZip; aZip.click();
            ocultarCargaGlobal();
            let msg = `✅ ¡Éxito! ZIP descargado: ${nombreZip}\n` +
                `• ${nombreZipPNG} (${packCanvas.width}x${packCanvas.height}) y ${nombreZipXML}: se reutilizaron ${dupCount} frames repetidos.`;
            if (adj) msg += `\n• ${jsonExportData.name}: escala ${adj.newScale}, posición [${adj.newPos.join(', ')}], cámara [${adj.newCamPos.join(', ')}].`;
            if (informe) msg += `\n• informe_optimizacion.txt con lo que cambió y lo que sigue igual.`;
            msg += `\nLos archivos tienen su nombre original: solo reemplaza los de tu mod.`;
            alert(msg);
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

        let isOptimized = (window.totalResizeFactor || 1.0) < 1.0;
        if (isOptimized && !window.uploadedAnimationJSON) {
            if (!(await window.pedirConfirmacionSinJson())) return;
        }

        let adj = obtenerAjusteJsonActual();
        let jsonExportData = adj ? { name: window.uploadedAnimationJSON.name, content: JSON.stringify(adj.json, null, "\t") } : null;

        let baseName = nombreArchivo.replace(/\.[^/.]+$/, "");
        let finalBaseName = isOptimized ? baseName + "_opt" : baseName;

        let xml = construirXmlSparrow(finalBaseName + ".png", (s) => s);

        const blob = new Blob([xml], { type: 'text/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = finalBaseName + ".xml"; document.body.appendChild(a); a.click(); document.body.removeChild(a);

        if (jsonExportData) {
            const blobJSON = new Blob([jsonExportData.content], { type: 'application/json' }); const aJ = document.createElement('a'); aJ.href = URL.createObjectURL(blobJSON);
            aJ.download = jsonExportData.name; document.body.appendChild(aJ); aJ.click(); document.body.removeChild(aJ);
        }
        if (isOptimized && window.UI) {
            window.UI.toast("Este botón solo guarda el XML. La imagen reducida se descarga con «Descargar ZIP».", 'warn', 6000);
        }
    }
}


// ==========================================
// RESIZE INTELIGENTE (IMAGEN Y XML)
// La interfaz para elegir el tamaño (Fácil, Porcentaje, Alto × Ancho, Peso...) está en js/redimensionar.js
// ==========================================

// Factor recomendado automáticamente según el tamaño de la imagen (null si ya es pequeña)
function factorRecomendadoResize() {
    let maxDim = Math.max(imgOriginal.width, imgOriginal.height);
    if (maxDim > 4000) return 0.5;
    if (maxDim > 2048) return 2048 / maxDim;
    if (maxDim > 1024) return 0.75;
    return null;
}

function actualizarPreviewResize() {
    if (window.ResizeTool) window.ResizeTool.refrescar();
}

function actualizarLabelResolucion() {
    let lbl = document.getElementById('lblResizeCurrent');
    if (lbl && imgOriginal && imgOriginal.width > 0) {
        let f = window.totalResizeFactor || 1.0;
        lbl.innerHTML = `<img src="https://cdn-icons-png.flaticon.com/128/3114/3114883.png" class="icon-sm" alt="Size"> Tamaño: ${imgOriginal.width} x ${imgOriginal.height}` +
            (f < 1 ? ` <span style="opacity:.75;">(${formatoPorcentaje(f)} del original)</span>` : '');
    }
    if (!window.resolucionOriginal && imgOriginal && imgOriginal.width > 0 && (window.totalResizeFactor || 1) === 1) {
        window.resolucionOriginal = { w: imgOriginal.width, h: imgOriginal.height };
    }
    actualizarPreviewResize();
}

// ¿Se puede volver al tamaño original sin perder calidad? (se guarda la imagen original al reducir)
function puedeRestaurarOriginal() {
    let base = window.imgBaseOptimizador;
    return (window.totalResizeFactor || 1) < 1 && !!base && Math.abs(base.factor - 1) < 1e-9;
}

async function restaurarResolucionOriginal() {
    if (!puedeRestaurarOriginal()) return alert("⚠️ No se puede volver al tamaño original: no hay una copia de la imagen original en esta sesión. Vuelve a subir la imagen y el XML.");
    return aplicarResizeOptimizador(1 / window.totalResizeFactor, { restaurar: true });
}

// Cambia la resolución por un factor relativo al tamaño ACTUAL (0.5 = la mitad).
// opciones: { titulo, detalle, restaurar }
async function aplicarResizeOptimizador(factor, opciones = {}) {
    if (!imgOriginal || imgOriginal.width === 0 || spritesDetectados.length === 0) {
        return alert("❌ Primero debes subir una imagen y un XML (Modo Optimizador).");
    }
    if (factor === undefined && window.ResizeTool) {
        let plan = window.ResizeTool.planActual();
        if (!plan) return alert("⚠️ Elige primero un tamaño: toca una de las opciones de «Reducir resolución».");
        factor = plan.factor;
        opciones = Object.assign({ titulo: plan.titulo, detalle: plan.detalle }, opciones);
    }
    factor = Number(factor);
    let prevTotal = window.totalResizeFactor || 1.0;
    let newTotal = prevTotal * factor;
    if (opciones.restaurar) newTotal = 1.0;
    if (!(factor > 0) || !isFinite(factor)) return alert("❌ Tamaño no válido.");
    if (!opciones.restaurar && !(factor < 0.9995)) return alert("⚠️ Ese tamaño es igual o mayor al actual: elige uno más pequeño para reducir.");
    if (newTotal > 1.0001) return alert("⚠️ No se puede agrandar más que la imagen original.");

    if (!window.resolucionOriginal || prevTotal === 1) window.resolucionOriginal = { w: imgOriginal.width, h: imgOriginal.height };

    // Siempre se reescala desde la imagen original en una sola pasada (más nítido y sin redondeos acumulados)
    if (!window.imgBaseOptimizador) window.imgBaseOptimizador = { img: imgOriginal, factor: prevTotal };
    let base = window.imgBaseOptimizador;
    let rel = newTotal / base.factor;
    let newWidth = Math.max(1, Math.round(base.img.width * rel));
    let newHeight = Math.max(1, Math.round(base.img.height * rel));
    let mismaQueBase = newWidth === base.img.width && newHeight === base.img.height;

    window.UI && window.UI.log('step', `Reduciendo ${imgOriginal.width}x${imgOriginal.height} → ${newWidth}x${newHeight}${opciones.titulo ? ' (' + opciones.titulo + ')' : ''}`);
    showLoader(opciones.restaurar ? "VOLVIENDO AL ORIGINAL" : "REESCALANDO IMAGEN", `${imgOriginal.width}x${imgOriginal.height} → ${newWidth}x${newHeight} (calidad alta)...`);
    await pensar(80);

    let newImgSrc;
    if (mismaQueBase) {
        newImgSrc = base.img.src;
    } else {
        let tempCanvas = document.createElement('canvas');
        tempCanvas.width = newWidth;
        tempCanvas.height = newHeight;
        let tempCtx = tempCanvas.getContext('2d');
        tempCtx.imageSmoothingEnabled = true;
        tempCtx.imageSmoothingQuality = 'high';
        tempCtx.drawImage(base.img, 0, 0, newWidth, newHeight);
        try {
            newImgSrc = tempCanvas.toDataURL("image/png");
        } catch (err) {
            ocultarCargaGlobal();
            window.UI && window.UI.log('err', 'No se pudo reescalar: ' + err.message);
            return alert({ type: 'err', title: 'No se pudo reescalar la imagen', body: 'El navegador se quedó sin memoria para una imagen de ' + newWidth + 'x' + newHeight + '. Prueba con un tamaño más pequeño o cierra otras pestañas.', detail: String(err.message || err) });
        }
    }
    let factorReal = newTotal / prevTotal;

    window.totalResizeFactor = newTotal;
    window.lastResizeFactor = newTotal;

    showLoader("RECALCULANDO ATLAS", `Ajustando cajas y coordenadas de ${spritesDetectados.length} fotogramas en el XML...`);
    await pensar(60);

    // Cada valor guarda su medida exacta (sin redondear) para que reducir varias veces no acumule errores.
    // Si un valor se editó a mano en el Laboratorio de Offsets, se respeta lo editado.
    const CAMPOS = ['x', 'y', 'w', 'h', 'frameX', 'frameY', 'frameWidth', 'frameHeight'];
    spritesDetectados.forEach(s => {
        if (s.origFrameWidth === undefined) s.origFrameWidth = s.frameWidth || s.w;
        if (s.origFrameHeight === undefined) s.origFrameHeight = s.frameHeight || s.h;
        let actual = {
            x: Number(s.x) || 0, y: Number(s.y) || 0, w: Number(s.w) || 0, h: Number(s.h) || 0,
            frameX: Number(s.frameX) || 0, frameY: Number(s.frameY) || 0,
            frameWidth: Number(s.frameWidth) || Number(s.w) || 0, frameHeight: Number(s.frameHeight) || Number(s.h) || 0
        };
        let exacto = Object.assign({}, s._exacto);
        CAMPOS.forEach(k => {
            let v = exacto[k];
            if (v === undefined || Math.round(v) !== actual[k]) v = actual[k];
            v *= factorReal;
            exacto[k] = v;
            s[k] = Math.round(v);
        });
        s._exacto = exacto;
        if (s.w < 1) s.w = 1;
        if (s.h < 1) s.h = 1;
    });

    let jsonAdjResult = null;
    if (window.uploadedAnimationJSON) {
        showLoader("AJUSTANDO JSON", "Compensando escala, posición y cámara con el modelo de Psych Engine...");
        await pensar(80);
        jsonAdjResult = refrescarAjusteJson();
    }

    let newImg = new Image();
    newImg.onerror = () => {
        ocultarCargaGlobal();
        alert({ type: 'err', title: 'No se pudo cargar la imagen reescalada', body: 'Prueba con un tamaño más pequeño.' });
    };
    newImg.onload = () => {
        imgOriginal = newImg;
        if (typeof canvas !== 'undefined' && canvas !== null) {
            canvas.width = newImg.width;
            canvas.height = newImg.height;
        }
        if (window.ResizeTool) window.ResizeTool.limpiarPlan();
        actualizarLabelResolucion();
        renderTimelineSecuenciador();
        if (indexEditando !== null) seleccionarFrameAfinador(indexEditando);
        if (typeof dibujarContornos === 'function') dibujarContornos();

        ocultarCargaGlobal();

        let msg = opciones.restaurar
            ? `✅ ¡Volviste al tamaño original!\n• Imagen: ${newWidth}x${newHeight}.\n• El XML volvió a sus medidas originales.`
            : `✅ ¡Resolución reducida!\n` +
              `• Imagen: ${newWidth}x${newHeight} (${formatoPorcentaje(newTotal)} del original).\n` +
              `• El XML se ajustó automáticamente.`;
        if (opciones.detalle) msg += `\n• ${opciones.detalle}`;

        if (jsonAdjResult) {
            msg += `\n• JSON del personaje (${nombreRolPsych(jsonAdjResult.role)}):` +
                `\n   Escala ${jsonAdjResult.origScale} → ${jsonAdjResult.newScale}` +
                `\n   Posición [${jsonAdjResult.origPos.join(', ')}] → [${jsonAdjResult.newPos.join(', ')}]` +
                `\n   Cámara [${jsonAdjResult.origCamPos.join(', ')}] → [${jsonAdjResult.newCamPos.join(', ')}]`;
            if (jsonAdjResult.verif && jsonAdjResult.verif.frames > 0) {
                msg += `\n• Verificado en ${jsonAdjResult.verif.frames} frames: el personaje queda a ${formatoPx(jsonAdjResult.verif.posErr)} y la cámara a ${formatoPx(jsonAdjResult.verif.camErr)} del original.`;
            }
        } else if (!opciones.restaurar) {
            msg += `\n• Sube el .JSON del personaje para que en el juego conserve su tamaño, posición y cámara.`;
        }

        alert(msg);
        if (typeof window.autoSaveHistory === 'function') window.autoSaveHistory();
    };
    newImg.src = newImgSrc;
}
