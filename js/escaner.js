// ==========================================
// MODO ESCANER Y CÁMARA
// ==========================================

function changeScannerBg(bgClass) {
    let wrapper = document.getElementById('scanWrapper');
    wrapper.className = 'canvas-wrapper ' + bgClass;
}

function setGlobalMode(mode) {
    globalMode = mode;
    document.getElementById('btnNavegar').classList.remove('active'); document.getElementById('btnEditar').classList.remove('active-edit');
    if (mode === 'VIEW') {
        document.getElementById('btnNavegar').classList.add('active');
        document.getElementById('manualToolsDiv').style.opacity = '0.3'; document.getElementById('manualToolsDiv').style.pointerEvents = 'none';
    } else {
        document.getElementById('btnEditar').classList.add('active-edit');
        document.getElementById('manualToolsDiv').style.opacity = '1'; document.getElementById('manualToolsDiv').style.pointerEvents = 'auto';
    }
}

document.getElementById('btnZoomIn')?.addEventListener('click', () => {
    let oldZoom = zoomActual; zoomActual = Math.round((zoomActual + 0.1) * 10) / 10; if (zoomActual > 3.0) zoomActual = 3.0;
    let rect = scanWrapper.getBoundingClientRect(); let cx = rect.width / 2; let cy = rect.height / 2;
    panX = cx - (cx - panX) * (zoomActual / oldZoom); panY = cy - (cy - panY) * (zoomActual / oldZoom); actualizarCSSCamera();
});
document.getElementById('btnZoomOut')?.addEventListener('click', () => {
    let oldZoom = zoomActual; zoomActual = Math.round((zoomActual - 0.1) * 10) / 10; if (zoomActual < 0.1) zoomActual = 0.1;
    let rect = scanWrapper.getBoundingClientRect(); let cx = rect.width / 2; let cy = rect.height / 2;
    panX = cx - (cx - panX) * (zoomActual / oldZoom); panY = cy - (cy - panY) * (zoomActual / oldZoom); actualizarCSSCamera();
});

function actualizarCSSCamera() {
    if (!imgOriginal.src) return; canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomActual})`;
    document.getElementById('txtZoom').textContent = `${Math.round(zoomActual * 100)}%`; dibujarContornos();
}

let activePointers = {}; let scanToolMode = 'SELECT'; let selScanIdx = -1; let isDragging = false; let dragAction = null;

function setScanTool(tool) {
    scanToolMode = tool; document.getElementById('btnToolSelect').classList.remove('active'); document.getElementById('btnToolDraw').classList.remove('active'); document.getElementById('btnToolDelete').classList.remove('active');
    if (tool === 'SELECT') document.getElementById('btnToolSelect').classList.add('active'); if (tool === 'DRAW') document.getElementById('btnToolDraw').classList.add('active'); if (tool === 'DELETE') document.getElementById('btnToolDelete').classList.add('active');
    canvas.style.cursor = tool === 'DRAW' ? 'crosshair' : (tool === 'DELETE' ? 'not-allowed' : 'default'); dibujarContornos();
}

function getRealCanvasPos(e) {
    let rect = scanWrapper.getBoundingClientRect(); let xWrapper = e.clientX - rect.left; let yWrapper = e.clientY - rect.top;
    return { x: (xWrapper - panX) / zoomActual, y: (yWrapper - panY) / zoomActual };
}

function getHandleAt(p, box) {
    if (!box) return null; let hs = 30 / zoomActual; let h_half = hs / 2;
    let handles = [{ n: 'tl', x: box.x, y: box.y }, { n: 'tr', x: box.x + box.w, y: box.y }, { n: 'bl', x: box.x, y: box.y + box.h }, { n: 'br', x: box.x + box.w, y: box.y + box.h }, { n: 't', x: box.x + box.w / 2, y: box.y }, { n: 'b', x: box.x + box.w / 2, y: box.y + box.h }, { n: 'l', x: box.x, y: box.y + box.h / 2 }, { n: 'r', x: box.x + box.w, y: box.y + box.h / 2 }];
    for (let h of handles) { if (p.x >= h.x - h_half && p.x <= h.x + h_half && p.y >= h.y - h_half && p.y <= h.y + h_half) return h.n; } return null;
}

window.addEventListener('keydown', (e) => {
    if (appMode !== 'SCAN' || globalMode !== 'EDIT' || selScanIdx === -1) return;
    let b = spritesDetectados[selScanIdx]; if (!b) return;
    let step = e.shiftKey ? 10 : 1; let handled = true;

    if (e.ctrlKey) {
        if (e.key === 'ArrowUp') b.h = Math.max(1, b.h - step);
        else if (e.key === 'ArrowDown') b.h += step;
        else if (e.key === 'ArrowLeft') b.w = Math.max(1, b.w - step);
        else if (e.key === 'ArrowRight') b.w += step;
        else handled = false;
    } else {
        if (e.key === 'ArrowUp') b.y -= step;
        else if (e.key === 'ArrowDown') b.y += step;
        else if (e.key === 'ArrowLeft') b.x -= step;
        else if (e.key === 'ArrowRight') b.x += step;
        else handled = false;
    }

    if (handled) { e.preventDefault(); b.frameWidth = b.w; b.frameHeight = b.h; dibujarContornos(); }
});

scanWrapper?.addEventListener('pointerdown', (e) => {
    if (!imgOriginal.src) return;
    scanWrapper.setPointerCapture(e.pointerId); activePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (globalMode === 'EDIT') {
        let p = getRealCanvasPos(e);
        if (scanToolMode === 'DELETE') {
            for (let i = spritesDetectados.length - 1; i >= 0; i--) { let b = spritesDetectados[i]; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { spritesDetectados.splice(i, 1); selScanIdx = -1; autoRenumerar(); dibujarContornos(); return; } }
        } else if (scanToolMode === 'DRAW') {
            isDragging = true; spritesDetectados.push({ name: `custom_0000`, x: Math.round(p.x), y: Math.round(p.y), w: 150, h: 150, frameX: 0, frameY: 0, frameWidth: 150, frameHeight: 150, angle: 0 });
            selScanIdx = spritesDetectados.length - 1; dragAction = { type: 'DRAW', startX: p.x, startY: p.y }; autoRenumerar(); dibujarContornos();
        } else if (scanToolMode === 'SELECT') {
            if (selScanIdx !== -1) { let h = getHandleAt(p, spritesDetectados[selScanIdx]); if (h) { isDragging = true; let b = spritesDetectados[selScanIdx]; dragAction = { type: 'RESIZE', handle: h, startX: p.x, startY: p.y, origX: b.x, origY: b.y, origW: b.w, origH: b.h }; return; } }
            let found = -1;
            for (let i = spritesDetectados.length - 1; i >= 0; i--) { let b = spritesDetectados[i]; if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { found = i; break; } }
            selScanIdx = found;
            if (found !== -1) { isDragging = true; let b = spritesDetectados[selScanIdx]; dragAction = { type: 'MOVE', startX: p.x, startY: p.y, origX: b.x, origY: b.y }; }
            dibujarContornos();
        }
    }
});

scanWrapper?.addEventListener('pointermove', (e) => {
    if (!activePointers[e.pointerId]) return;
    if (globalMode === 'VIEW') {
        let keys = Object.keys(activePointers);
        if (keys.length === 1) {
            let dx = e.clientX - activePointers[e.pointerId].x; let dy = e.clientY - activePointers[e.pointerId].y; panX += dx; panY += dy; activePointers[e.pointerId] = { x: e.clientX, y: e.clientY }; actualizarCSSCamera();
        } else if (keys.length === 2) {
            let id1 = keys[0], id2 = keys[1]; let p1 = activePointers[id1], p2 = activePointers[id2]; let movingId = e.pointerId; let otherId = (movingId == id1) ? id2 : id1; let pOther = activePointers[otherId];
            let oldDist = Math.hypot(p1.x - p2.x, p1.y - p2.y); let cx = (p1.x + p2.x) / 2; let cy = (p1.y + p2.y) / 2; activePointers[movingId] = { x: e.clientX, y: e.clientY };
            let newDist = Math.hypot(activePointers[movingId].x - pOther.x, activePointers[movingId].y - pOther.y); let oldZoom = zoomActual; let delta = (newDist - oldDist) * 0.005; zoomActual += delta;
            if (zoomActual < 0.1) zoomActual = 0.1; if (zoomActual > 3.0) zoomActual = 3.0;
            let rect = scanWrapper.getBoundingClientRect(); let pinchX = cx - rect.left; let pinchY = cy - rect.top;
            panX = pinchX - (pinchX - panX) * (zoomActual / oldZoom); panY = pinchY - (pinchY - panY) * (zoomActual / oldZoom); actualizarCSSCamera();
        }
    } else if (globalMode === 'EDIT' && isDragging && dragAction) {
        let p = getRealCanvasPos(e); let b = spritesDetectados[selScanIdx]; if (!b) return;
        if (dragAction.type === 'DRAW') {
            let newW = Math.round(p.x - dragAction.startX); let newH = Math.round(p.y - dragAction.startY);
            if (newW > 10) b.w = newW; if (newH > 10) b.h = newH; b.frameWidth = b.w; b.frameHeight = b.h;
        } else if (dragAction.type === 'MOVE') { b.x = Math.round(dragAction.origX + (p.x - dragAction.startX)); b.y = Math.round(dragAction.origY + (p.y - dragAction.startY)); }
        else if (dragAction.type === 'RESIZE') {
            let dx = p.x - dragAction.startX; let dy = p.y - dragAction.startY;
            if (dragAction.handle.includes('r')) { b.w = Math.max(1, Math.round(dragAction.origW + dx)); } if (dragAction.handle.includes('b')) { b.h = Math.max(1, Math.round(dragAction.origH + dy)); }
            if (dragAction.handle.includes('l')) { b.x = Math.round(dragAction.origX + dx); b.w = Math.max(1, Math.round(dragAction.origW - dx)); } if (dragAction.handle.includes('t')) { b.y = Math.round(dragAction.origY + dy); b.h = Math.max(1, Math.round(dragAction.origH - dy)); }
            b.frameWidth = b.w; b.frameHeight = b.h;
        } dibujarContornos();
    }
});

function removePointer(e) { delete activePointers[e.pointerId]; if (isDragging) { isDragging = false; dragAction = null; actualizarDropdownFiltros(); actualizarDropdownPsych(); } }
scanWrapper?.addEventListener('pointerup', removePointer); scanWrapper?.addEventListener('pointercancel', removePointer);

function dibujarContornos() {
    if (!imgOriginal.src) return;
    try {
        const _styles = getComputedStyle(document.body);
        const _accent = _styles.getPropertyValue('--accent').trim() || '#00e5ff';
        const _accentPink = _styles.getPropertyValue('--accent-pink').trim() || '#ff0055';

        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(imgOriginal, 0, 0); ctx.lineWidth = Math.max(1, 2 / zoomActual);
        spritesDetectados.forEach((s, idx) => {
            let isSel = (idx === selScanIdx && globalMode === 'EDIT'); ctx.strokeStyle = isSel ? 'var(--accent)' : (s.angle > 0 ? 'var(--accent-pink)' : 'rgba(0, 229, 255, 0.5)');
            if (isSel) ctx.setLineDash([4 / zoomActual, 2 / zoomActual]); else ctx.setLineDash([]); ctx.strokeRect(s.x, s.y, s.w, s.h);
            if (isSel && scanToolMode === 'SELECT') {
                ctx.fillStyle = "white"; ctx.setLineDash([]); let hs = 16 / zoomActual; let hh = hs / 2;
                ctx.fillRect(s.x - hh, s.y - hh, hs, hs); ctx.fillRect(s.x + s.w - hh, s.y - hh, hs, hs); ctx.fillRect(s.x - hh, s.y + s.h - hh, hs, hs); ctx.fillRect(s.x + s.w - hh, s.y + s.h - hh, hs, hs);
                ctx.fillRect(s.x + s.w / 2 - hh, s.y - hh, hs, hs); ctx.fillRect(s.x + s.w / 2 - hh, s.y + s.h - hh, hs, hs); ctx.fillRect(s.x - hh, s.y + s.h / 2 - hh, hs, hs); ctx.fillRect(s.x + s.w - hh, s.y + s.h / 2 - hh, hs, hs);
            }
            ctx.fillStyle = isSel ? 'var(--accent)' : '#ffffff'; let fontSize = Math.max(12, 16 / zoomActual); ctx.font = `bold ${fontSize}px monospace`; ctx.fillText(s.name, s.x + (4 / zoomActual), s.y + fontSize);
        }); ctx.setLineDash([]);
    } catch (e) { console.error("Error al dibujar:", e); }
}

function clearAllScan() { spritesDetectados = []; selScanIdx = -1; dibujarContornos(); }

document.getElementById('btnProcesar')?.addEventListener('click', () => {
    showLoader("EJECUTANDO ESCANER", "Iniciando escaner...");

    setTimeout(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(imgOriginal, 0, 0);
        const w = canvas.width; const h = canvas.height;
        const pixeles = ctx.getImageData(0, 0, w, h).data; const visitados = new Uint8Array(w * h);
        let islasRaw = []; let umbralAlpha = parseInt(document.getElementById('sliderCorte').value); let y = 0;

        function procesarChunk() {
            let limite = Math.min(y + 40, h);
            for (; y < limite; y++) {
                for (let x = 0; x < w; x++) {
                    let idx = y * w + x;
                    if (pixeles[idx * 4 + 3] >= umbralAlpha && !visitados[idx]) {
                        let minX = x, maxX = x, minY = y, maxY = y; let cola = [x, y]; visitados[idx] = 1; let head = 0; let pixCount = 0;
                        while (head < cola.length) {
                            let cx = cola[head++]; let cy = cola[head++]; pixCount++;
                            const vecinos = [[cx, cy + 1], [cx + 1, cy], [cx, cy - 1], [cx - 1, cy], [cx + 1, cy + 1], [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1]];
                            for (const [nx, ny] of vecinos) {
                                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                    let nIdx = ny * w + nx;
                                    if (!visitados[nIdx] && pixeles[nIdx * 4 + 3] >= umbralAlpha) { visitados[nIdx] = 1; cola.push(nx, ny); if (nx < minX) minX = nx; if (nx > maxX) maxX = nx; if (ny < minY) minY = ny; if (ny > maxY) maxY = ny; }
                                }
                            }
                        }
                        if (pixCount >= 4 && (maxX - minX) >= 2 && (maxY - minY) >= 2) { islasRaw.push({ minX, maxX, minY, maxY }); }
                    }
                }
            }
            if (y < h) {
                let porcentaje = Math.floor((y / h) * 100);
                document.getElementById('globalLoaderText').innerHTML = `<div style="font-size:0.9rem; color:#aaa; margin-bottom:5px;">Analizando Imagen...</div><div style="font-size:2.5rem; font-weight:900; color:var(--accent); text-shadow: 0 0 10px rgba(0,229,255,0.5);">${porcentaje}%</div><div style="font-size:0.8rem; color:#ff4d88; margin-top:5px;">Separando frames.</div>`;
                requestAnimationFrame(procesarChunk);
            } else {
                document.getElementById('globalLoaderText').innerHTML = `<div style="font-size:1.2rem; font-weight:bold; color:var(--accent-gold);">¡Análisis Completado!</div><div style="font-size:0.8rem; color:#aaa; margin-top:5px;">Procesando coordenadas finales...</div>`;
                setTimeout(faseFinal, 50);
            }
        }

        function faseFinal() {
            try {
                let dist = parseInt(document.getElementById('sliderUnion').value) || 0;

                let merged = [];
                for (let r of islasRaw) {
                    let overlapIdx = -1;
                    for (let i = 0; i < merged.length; i++) {
                        let m = merged[i];
                        let dx = Math.max(0, m.minX - r.maxX, r.minX - m.maxX);
                        let dy = Math.max(0, m.minY - r.maxY, r.minY - m.maxY);
                        if (Math.max(dx, dy) <= dist) { overlapIdx = i; break; }
                    }
                    if (overlapIdx !== -1) {
                        let m = merged[overlapIdx];
                        m.minX = Math.min(m.minX, r.minX); m.maxX = Math.max(m.maxX, r.maxX);
                        m.minY = Math.min(m.minY, r.minY); m.maxY = Math.max(m.maxY, r.maxY);
                    } else {
                        merged.push({ ...r });
                    }
                }

                let fusion = true;
                while (fusion) {
                    fusion = false;
                    let nextMerged = [];
                    for (let r of merged) {
                        let overlapIdx = -1;
                        for (let i = 0; i < nextMerged.length; i++) {
                            let m = nextMerged[i];
                            let dx = Math.max(0, m.minX - r.maxX, r.minX - m.maxX);
                            let dy = Math.max(0, m.minY - r.maxY, r.minY - m.maxY);
                            if (Math.max(dx, dy) <= dist) { overlapIdx = i; break; }
                        }
                        if (overlapIdx !== -1) {
                            let m = nextMerged[overlapIdx];
                            m.minX = Math.min(m.minX, r.minX); m.maxX = Math.max(m.maxX, r.maxX);
                            m.minY = Math.min(m.minY, r.minY); m.maxY = Math.max(m.maxY, r.maxY);
                            fusion = true;
                        } else {
                            nextMerged.push({ ...r });
                        }
                    }
                    merged = nextMerged;
                }

                let pad = parseInt(document.getElementById('sliderPad').value) || 0;
                spritesDetectados = merged.map((isla) => {
                    let finalMinX = Math.max(0, isla.minX - pad); let finalMaxX = Math.min(w - 1, isla.maxX + pad);
                    let finalMinY = Math.max(0, isla.minY - pad); let finalMaxY = Math.min(h - 1, isla.maxY + pad);
                    let fw = finalMaxX - finalMinX + 1; let fh = finalMaxY - finalMinY + 1;
                    return { name: `frame_0000`, x: finalMinX, y: finalMinY, w: fw, h: fh, frameX: 0, frameY: 0, frameWidth: fw, frameHeight: fh, angle: 0 };
                });

                spritesDetectados.sort((a, b) => (a.y - b.y) || (a.x - b.x));
                selScanIdx = -1; autoRenumerar();
                finalizarCargaGeneral('SCAN');

            } catch (error) {
                console.error("Error en el motor:", error);
                ocultarCargaGlobal();
                alert("❌ Hubo un error de cálculo procesando los datos. Detalle: " + error.message);
            }
        }

        requestAnimationFrame(procesarChunk);
    }, 150);
});

function autoFitSelected() {
    if (selScanIdx === -1 || !imgOriginal.src) { alert("❌ Primero usa el botón Seleccionar y toca un cuadro."); return; }
    let b = spritesDetectados[selScanIdx]; let umbralAlpha = parseInt(document.getElementById('sliderCorte').value);
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(imgOriginal, 0, 0);
    const w = canvas.width; const h = canvas.height; const imgData = ctx.getImageData(0, 0, w, h).data;
    let minX = b.x + b.w, maxX = b.x, minY = b.y + b.h, maxY = b.y; let found = false;
    let startX = Math.max(0, b.x - 2); let endX = Math.min(w, b.x + b.w + 2); let startY = Math.max(0, b.y - 2); let endY = Math.min(h, b.y + b.h + 2);
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) { let alpha = imgData[(y * w + x) * 4 + 3]; if (alpha >= umbralAlpha) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; found = true; } }
    }
    if (found) { b.x = minX; b.y = minY; b.w = maxX - minX + 1; b.h = maxY - minY + 1; b.frameWidth = b.w; b.frameHeight = b.h; dibujarContornos(); }
    else { alert("❌ No se encontró ningun dibujo dentro."); dibujarContornos(); }
}
