let modoActual = null;
let archivosSueltos = [];
let imgSpritesheet = null;
let xmlDoc = null;
let spritesXML = [];
let animacionesDisponibles = {};

function seleccionarModo(modo) {
    modoActual = modo;
    document.querySelectorAll('.gif-mode-card').forEach(c => c.classList.remove('selected'));
    let card = document.getElementById('cardModo' + modo);
    if (card) card.classList.add('selected');

    let cont = document.getElementById('fileInputsContainer');
    if (cont) cont.style.display = 'flex';
    let dropText = "";
    
    let inputArchivos = document.getElementById('gifInputArchivos');
    if (modo === 'A') {
        dropText = "Sube tus imágenes sueltas (.png, .jpg)";
        if (inputArchivos) { inputArchivos.accept = "image/*"; inputArchivos.multiple = true; }
    } else if (modo === 'B') {
        dropText = "Sube tu hoja de sprites (.png)";
        if (inputArchivos) { inputArchivos.accept = "image/png, image/jpeg"; inputArchivos.multiple = false; }
    } else if (modo === 'C') {
        dropText = "Sube tu XML y tu PNG juntos";
        if (inputArchivos) { inputArchivos.accept = "*/*"; inputArchivos.multiple = true; }
    }
    
    let dropTextEl = document.getElementById('gifDropZoneText');
    if (dropTextEl) dropTextEl.innerText = dropText;
    
    let ws = document.getElementById('gifWorkspace');
    if (ws && !imgSpritesheet && archivosSueltos.length === 0) ws.style.display = 'none';
    
    // Reseteamos datos
    archivosSueltos = [];
    imgSpritesheet = null;
    xmlDoc = null;
    spritesXML = [];
    animacionesDisponibles = {};
    let selectAnim = document.getElementById('selectAnimacionXML');
    if (selectAnim) selectAnim.innerHTML = '<option value="">Carga un XML primero...</option>';
}

let tempXmlFile = null;
let tempPngFile = null;

// =======================
// MODO C: XML + PNG
// =======================
document.getElementById('gifXmlUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    await window.validateAndProcessFile(inp, 'xml', {
        onSuccess: (file, data) => {
            tempXmlFile = file;
            checkModoC();
        },
        onError: () => {
            tempXmlFile = null;
        }
    });
});
document.getElementById('gifPngUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    await window.validateAndProcessFile(inp, 'png', {
        onSuccess: (file, img) => {
            tempPngFile = file;
            checkModoC();
        },
        onError: () => {
            tempPngFile = null;
        }
    });
});

async function checkModoC() {
    if(tempXmlFile && tempPngFile) {
        mostrarCargaGlobal("Procesando archivos...");
        imgSpritesheet = await fileToImage(tempPngFile);
        let xmlText = await tempXmlFile.text();
        let parser = new DOMParser();
        xmlDoc = parser.parseFromString(xmlText, "text/xml");
        
        // Reset temporales
        tempXmlFile = null; 
        tempPngFile = null;
        
        iniciarModoC();
        ocultarCargaGlobal();
    }
}

// =======================
// MODO B: Solo PNG
// =======================
document.getElementById('gifPngUnicoUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    await window.validateAndProcessFile(inp, 'png', {
        onSuccess: async (file, img) => {
            mostrarCargaGlobal("Procesando spritesheet...");
            imgSpritesheet = img;
            iniciarModoB();
            ocultarCargaGlobal();
        }
    });
});

// =======================
// MODO A: Sueltas
// =======================
document.getElementById('gifSueltasUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    let files = Array.from(inp.files || []);
    let btn = window.findTargetButton(inp);
    if (files.length === 0) {
        window.setImportButtonState(btn, 'reset');
        return;
    }

    let nonImages = files.filter(f => !/\.(png|jpg|jpeg|webp)$/i.test(f.name));
    if (nonImages.length === files.length) {
        window.setImportButtonState(btn, 'error');
        window.mostrarLogImportacion({
            tipo: 'formato_incorrecto',
            titulo: 'ARCHIVOS INCORRECTOS',
            esperado: 'Imágenes (.PNG, .JPG)',
            archivo: files[0],
            detalle: `[FORMATO INCORRECTO]: Ninguno de los ${files.length} archivos seleccionados corresponde a una imagen válida.`
        });
        inp.value = "";
        return;
    }

    window.setImportButtonState(btn, 'success');
    mostrarCargaGlobal("Procesando imágenes...");
    archivosSueltos = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f.name) || f.type.startsWith('image/'));
    iniciarModoA();
    ocultarCargaGlobal();
});

function fileToImage(file) {
    return new Promise((resolve) => {
        let reader = new FileReader();
        reader.onload = (e) => {
            let img = new Image();
            img.onload = () => resolve(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

async function iniciarModoA() {
    document.getElementById('gifWorkspace').style.display = 'flex';
    let selector = document.getElementById('xmlAnimSelector');
    if(selector) selector.style.display = 'none';
    let cropCont = document.getElementById('gifCropContainer');
    if (cropCont) cropCont.style.display = 'none';
    let bpmCont = document.getElementById('bpmContainerGif');
    if (bpmCont) bpmCont.style.display = 'flex';
    let prevBox = document.getElementById('previewBoxGif');
    if (prevBox) prevBox.style.display = 'flex';
    
    window.framesPreRenderizados = [];
    
    // Sort files by name so they are in sequence
    archivosSueltos.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
    
    let loadedImages = [];
    let maxWidth = 0;
    let maxHeight = 0;
    
    for(let i=0; i<archivosSueltos.length; i++) {
        let img = await fileToImage(archivosSueltos[i]);
        loadedImages.push(img);
        if(img.width > maxWidth) maxWidth = img.width;
        if(img.height > maxHeight) maxHeight = img.height;
    }
    
    window.archivosSueltosCargados = loadedImages;
    window.archivosSueltosDims = { width: maxWidth, height: maxHeight };
    renderizarFramesSueltos();
}

function renderizarFramesSueltos() {
    if (!window.archivosSueltosCargados || window.archivosSueltosCargados.length === 0) return;
    let maxWidth = window.archivosSueltosDims.width;
    let maxHeight = window.archivosSueltosDims.height;
    window.framesPreRenderizados = [];
    window.framesCanvasOriginales = [];
    
    for(let i=0; i<window.archivosSueltosCargados.length; i++) {
        let img = window.archivosSueltosCargados[i];
        let dx = (maxWidth - img.width) / 2;
        let dy = (maxHeight - img.height) / 2;
        
        let cOrig = document.createElement('canvas');
        cOrig.width = maxWidth;
        cOrig.height = maxHeight;
        let ctxOrig = cOrig.getContext('2d');
        ctxOrig.drawImage(img, dx, dy);
        window.framesCanvasOriginales.push(cOrig);
        
        let c = document.createElement('canvas');
        c.width = maxWidth;
        c.height = maxHeight;
        let ctx = c.getContext('2d');
        
        if (window.gifBgMode === 'color') {
            ctx.fillStyle = window.gifBgColor;
            ctx.fillRect(0, 0, maxWidth, maxHeight);
        } else {
            ctx.clearRect(0, 0, maxWidth, maxHeight);
        }
        
        ctx.drawImage(img, dx, dy);
        window.framesPreRenderizados.push(c.toDataURL('image/png'));
    }
    
    let bgCont = document.getElementById('gifBgContainer');
    if (bgCont) bgCont.style.display = 'flex';
    document.getElementById('txtFrameCount').textContent = `${window.framesPreRenderizados.length} Frames`;
    document.getElementById('previewPlaceholder').style.display = 'none';
    document.getElementById('previewGifImg').style.display = 'block';
    document.getElementById('btnGenerarGif').style.display = 'block';
    document.getElementById('btnDescargarGif').style.display = 'none';
    
    let seq = document.getElementById('gifSequencer');
    if(seq) seq.style.display = 'block';
    
    renderizarSecuenciadorGif();
    actualizarBPM();
}

let gifCajas = [];
let cropMode = 'VIEW'; // VIEW, EDIT
let cropTool = 'SELECT'; // SELECT, DRAW, DELETE
let cropZoom = 1;
let cropPanX = 0;
let cropPanY = 0;
let selectedBoxIndex = -1;
let cropActivePointers = {};
let cropIsDragging = false;
let cropDragAction = null;

function changeScannerBgGif(bgClass) {
    let wrapper = document.getElementById('cropCanvasWrapper');
    if (wrapper) wrapper.className = 'canvas-wrapper ' + bgClass;
}

function setGlobalModeGif(mode) {
    cropMode = mode;
    let btnN = document.getElementById('btnNavegarGif');
    let btnE = document.getElementById('btnEditarGif');
    let toolDiv = document.getElementById('manualToolsDivGif');
    let wrapper = document.getElementById('cropCanvasWrapper');
    
    if (btnN) btnN.classList.remove('active');
    if (btnE) btnE.classList.remove('active-edit');
    
    if (mode === 'VIEW') {
        if (btnN) btnN.classList.add('active');
        if (toolDiv) { toolDiv.style.opacity = '0.3'; toolDiv.style.pointerEvents = 'none'; }
        if (wrapper) wrapper.style.cursor = 'grab';
    } else {
        if (btnE) btnE.classList.add('active-edit');
        if (toolDiv) { toolDiv.style.opacity = '1'; toolDiv.style.pointerEvents = 'auto'; }
        setScanToolGif(cropTool || 'SELECT');
    }
    dibujarGifCrop();
}

function setScanToolGif(tool) {
    cropTool = tool;
    let btnSel = document.getElementById('btnToolSelectGif');
    let btnDrw = document.getElementById('btnToolDrawGif');
    let btnDel = document.getElementById('btnToolDeleteGif');
    let wrapper = document.getElementById('cropCanvasWrapper');
    
    if (btnSel) btnSel.classList.remove('active');
    if (btnDrw) btnDrw.classList.remove('active');
    if (btnDel) btnDel.classList.remove('active');
    
    if (tool === 'SELECT') {
        if (btnSel) btnSel.classList.add('active');
        if (wrapper) wrapper.style.cursor = 'default';
    } else if (tool === 'DRAW') {
        if (btnDrw) btnDrw.classList.add('active');
        if (wrapper) wrapper.style.cursor = 'crosshair';
    } else if (tool === 'DELETE') {
        if (btnDel) btnDel.classList.add('active');
        if (wrapper) wrapper.style.cursor = 'not-allowed';
    }
    dibujarGifCrop();
}

function actualizarCSSCrop() {
    let canvas = document.getElementById('gifCropCanvas');
    if (!canvas) return;
    canvas.style.transform = `translate(${cropPanX}px, ${cropPanY}px) scale(${cropZoom})`;
    let txt = document.getElementById('txtZoomGif');
    if (txt) txt.textContent = `${Math.round(cropZoom * 100)}%`;
    dibujarGifCrop();
}

document.getElementById('btnZoomInGif')?.addEventListener('click', () => {
    let oldZoom = cropZoom; 
    cropZoom = Math.round((cropZoom + 0.1) * 10) / 10; 
    if (cropZoom > 4.0) cropZoom = 4.0;
    let wrapper = document.getElementById('cropCanvasWrapper');
    if (!wrapper) return;
    let rect = wrapper.getBoundingClientRect(); 
    let cx = rect.width / 2; let cy = rect.height / 2;
    cropPanX = cx - (cx - cropPanX) * (cropZoom / oldZoom); 
    cropPanY = cy - (cy - cropPanY) * (cropZoom / oldZoom); 
    actualizarCSSCrop();
});

document.getElementById('btnZoomOutGif')?.addEventListener('click', () => {
    let oldZoom = cropZoom; 
    cropZoom = Math.round((cropZoom - 0.1) * 10) / 10; 
    if (cropZoom < 0.1) cropZoom = 0.1;
    let wrapper = document.getElementById('cropCanvasWrapper');
    if (!wrapper) return;
    let rect = wrapper.getBoundingClientRect(); 
    let cx = rect.width / 2; let cy = rect.height / 2;
    cropPanX = cx - (cx - cropPanX) * (cropZoom / oldZoom); 
    cropPanY = cy - (cy - cropPanY) * (cropZoom / oldZoom); 
    actualizarCSSCrop();
});

async function iniciarModoB() {
    document.getElementById('gifWorkspace').style.display = 'flex';
    let selector = document.getElementById('xmlAnimSelector');
    if (selector) selector.style.display = 'none';
    
    let prevBox = document.getElementById('previewBoxGif');
    if (prevBox) prevBox.style.display = 'none';
    document.getElementById('btnGenerarGif').style.display = 'none';
    document.getElementById('btnDescargarGif').style.display = 'none';
    
    let bpmCont = document.getElementById('bpmContainerGif');
    if (bpmCont) bpmCont.style.display = 'none';
    let bgCont = document.getElementById('gifBgContainer');
    if (bgCont) bgCont.style.display = 'none';
    
    let seq = document.getElementById('gifSequencer');
    if (seq) seq.style.display = 'none';
    
    let cropCont = document.getElementById('gifCropContainer');
    if (cropCont) cropCont.style.display = 'block';
    
    let btnVolver = document.getElementById('btnVolverACortador');
    if (btnVolver) btnVolver.style.display = 'none';
    
    let txtCargar = document.getElementById('txtCargarPngGif');
    if (txtCargar) txtCargar.textContent = `CAMBIAR HOJA DE SPRITES (${imgSpritesheet.width}x${imgSpritesheet.height}px)`;
    
    let canvas = document.getElementById('gifCropCanvas');
    if (!canvas) return;
    
    canvas.width = imgSpritesheet.width;
    canvas.height = imgSpritesheet.height;
    
    let wrapper = document.getElementById('cropCanvasWrapper');
    let wrapperRect = wrapper.getBoundingClientRect();
    let scaleX = wrapperRect.width / imgSpritesheet.width;
    let scaleY = wrapperRect.height / imgSpritesheet.height;
    cropZoom = Math.min(scaleX, scaleY) * 0.95;
    if (cropZoom > 1) cropZoom = 1;
    if (cropZoom < 0.1) cropZoom = 0.1;
    
    cropPanX = (wrapperRect.width - (imgSpritesheet.width * cropZoom)) / 2;
    cropPanY = (wrapperRect.height - (imgSpritesheet.height * cropZoom)) / 2;
    
    gifCajas = [];
    selectedBoxIndex = -1;
    actualizarContadorFramesGif();
    setGlobalModeGif('VIEW');
    actualizarCSSCrop();
}

function getRealCropPos(e) {
    let wrapper = document.getElementById('cropCanvasWrapper');
    let rect = wrapper.getBoundingClientRect(); 
    let xWrapper = e.clientX - rect.left; 
    let yWrapper = e.clientY - rect.top;
    return { x: (xWrapper - cropPanX) / cropZoom, y: (yWrapper - cropPanY) / cropZoom };
}

function getHandleAtGif(p, box) {
    if (!box) return null; 
    let hs = 30 / cropZoom; // Touch area 30px
    let h_half = hs / 2;
    let handles = [
        { n: 'tl', x: box.x, y: box.y }, 
        { n: 'tr', x: box.x + box.w, y: box.y }, 
        { n: 'bl', x: box.x, y: box.y + box.h }, 
        { n: 'br', x: box.x + box.w, y: box.y + box.h }, 
        { n: 't', x: box.x + box.w / 2, y: box.y }, 
        { n: 'b', x: box.x + box.w / 2, y: box.y + box.h }, 
        { n: 'l', x: box.x, y: box.y + box.h / 2 }, 
        { n: 'r', x: box.x + box.w, y: box.y + box.h / 2 }
    ];
    for (let h of handles) { 
        if (p.x >= h.x - h_half && p.x <= h.x + h_half && p.y >= h.y - h_half && p.y <= h.y + h_half) return h.n; 
    } 
    return null;
}

function dibujarGifCrop() {
    let canvas = document.getElementById('gifCropCanvas');
    if (!canvas || !imgSpritesheet) return;
    let ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgSpritesheet, 0, 0);
    
    const isEdit = (cropMode === 'EDIT');
    const isDelete = (cropTool === 'DELETE');
    
    gifCajas.forEach((caja, index) => {
        let isSelected = (index === selectedBoxIndex && isEdit);
        
        // Bordes
        if (isSelected) {
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = Math.max(1.5, 2.5 / cropZoom);
            ctx.setLineDash([4 / cropZoom, 2 / cropZoom]);
        } else if (isEdit && isDelete) {
            ctx.strokeStyle = '#ff4d88';
            ctx.lineWidth = Math.max(1, 2 / cropZoom);
            ctx.setLineDash([]);
        } else {
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.65)';
            ctx.lineWidth = Math.max(1, 2 / cropZoom);
            ctx.setLineDash([]);
        }
        
        ctx.strokeRect(caja.x, caja.y, caja.w, caja.h);
        
        // Relleno suave translúcido
        if (isSelected) {
            ctx.fillStyle = 'rgba(0, 229, 255, 0.18)';
            ctx.fillRect(caja.x, caja.y, caja.w, caja.h);
        } else if (isEdit && isDelete) {
            ctx.fillStyle = 'rgba(255, 77, 136, 0.12)';
            ctx.fillRect(caja.x, caja.y, caja.w, caja.h);
        }
        
        // 8 Manijas de control si está seleccionada
        if (isSelected && cropTool === 'SELECT') {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = Math.max(1, 1.5 / cropZoom);
            ctx.setLineDash([]);
            let hs = 14 / cropZoom;
            let hh = hs / 2;
            
            let handlePoints = [
                [caja.x, caja.y],
                [caja.x + caja.w, caja.y],
                [caja.x, caja.y + caja.h],
                [caja.x + caja.w, caja.y + caja.h],
                [caja.x + caja.w / 2, caja.y],
                [caja.x + caja.w / 2, caja.y + caja.h],
                [caja.x, caja.y + caja.h / 2],
                [caja.x + caja.w, caja.y + caja.h / 2]
            ];
            
            for (let [hx, hy] of handlePoints) {
                ctx.fillRect(hx - hh, hy - hh, hs, hs);
                ctx.strokeRect(hx - hh, hy - hh, hs, hs);
            }
        }
        
        // Etiqueta numerada con fondo de píldora
        ctx.setLineDash([]);
        let fontSize = Math.max(11, 14 / cropZoom);
        ctx.font = `bold ${fontSize}px sans-serif`;
        let labelText = `F${index + 1}`;
        let textW = ctx.measureText(labelText).width;
        let pad = 4 / cropZoom;
        let badgeW = textW + pad * 2;
        let badgeH = fontSize + pad * 2;
        let badgeY = (caja.y - badgeH < 0) ? caja.y : caja.y - badgeH;
        
        ctx.fillStyle = isSelected ? '#00e5ff' : (isEdit && isDelete ? '#ff4d88' : 'rgba(15, 15, 25, 0.85)');
        ctx.fillRect(caja.x, badgeY, badgeW, badgeH);
        
        ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
        ctx.fillText(labelText, caja.x + pad, badgeY + fontSize);
    });
    
    ctx.setLineDash([]);
}

function autoFitSelectedGif() {
    if (selectedBoxIndex === -1 || !imgSpritesheet || !gifCajas[selectedBoxIndex]) {
        alert("❌ Primero usa el botón Seleccionar y toca una caja.");
        return;
    }
    let b = gifCajas[selectedBoxIndex];
    let tempC = document.createElement('canvas');
    tempC.width = imgSpritesheet.width;
    tempC.height = imgSpritesheet.height;
    let tCtx = tempC.getContext('2d');
    tCtx.drawImage(imgSpritesheet, 0, 0);
    const w = tempC.width; 
    const h = tempC.height;
    const imgData = tCtx.getImageData(0, 0, w, h).data;
    
    let minX = b.x + b.w, maxX = b.x, minY = b.y + b.h, maxY = b.y; 
    let found = false;
    let startX = Math.max(0, Math.floor(b.x)); 
    let endX = Math.min(w, Math.ceil(b.x + b.w)); 
    let startY = Math.max(0, Math.floor(b.y)); 
    let endY = Math.min(h, Math.ceil(b.y + b.h));
    
    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) { 
            let alpha = imgData[(y * w + x) * 4 + 3]; 
            if (alpha >= 15) { 
                if (x < minX) minX = x; 
                if (x > maxX) maxX = x; 
                if (y < minY) minY = y; 
                if (y > maxY) maxY = y; 
                found = true; 
            } 
        }
    }
    if (found) { 
        b.x = minX; 
        b.y = minY; 
        b.w = maxX - minX + 1; 
        b.h = maxY - minY + 1; 
        actualizarContadorFramesGif();
        dibujarGifCrop(); 
    } else { 
        alert("❌ No se encontró ningún dibujo dentro de esta caja."); 
        dibujarGifCrop(); 
    }
}

function limpiarCajasGif() {
    if (gifCajas.length === 0) return;
    if (confirm("¿Estás seguro de que deseas borrar todas las cajas marcadas?")) {
        gifCajas = [];
        selectedBoxIndex = -1;
        actualizarContadorFramesGif();
        dibujarGifCrop();
    }
}

function actualizarContadorFramesGif() {
    let txt = document.getElementById('txtContadorFramesGif');
    if (!txt) return;
    let count = gifCajas.length;
    if (count === 0) {
        txt.textContent = "0 Frames";
    } else if (count === 1) {
        txt.textContent = selectedBoxIndex === 0 ? "1 Frame (Sel)" : "1 Frame";
    } else {
        if (selectedBoxIndex >= 0) {
            txt.textContent = `${count} Frames (#${selectedBoxIndex + 1} Sel)`;
        } else {
            txt.textContent = `${count} Frames`;
        }
    }
}

function volverACortadorGif() {
    document.getElementById('gifCropContainer').style.display = 'block';
    let bpmCont = document.getElementById('bpmContainerGif');
    if (bpmCont) bpmCont.style.display = 'none';
    let bgCont = document.getElementById('gifBgContainer');
    if (bgCont) bgCont.style.display = 'none';
    let prevBox = document.getElementById('previewBoxGif');
    if (prevBox) prevBox.style.display = 'none';
    document.getElementById('btnGenerarGif').style.display = 'none';
    document.getElementById('btnDescargarGif').style.display = 'none';
    document.getElementById('gifSequencer').style.display = 'none';
    actualizarCSSCrop();
}

function renderizarFramesModoB() {
    if (!gifCajas || gifCajas.length === 0 || !imgSpritesheet) return;
    window.framesPreRenderizados = [];
    window.framesCanvasOriginales = [];
    
    let maxWidth = 0;
    let maxHeight = 0;
    gifCajas.forEach(caja => {
        if (caja.w > maxWidth) maxWidth = caja.w;
        if (caja.h > maxHeight) maxHeight = caja.h;
    });
    
    gifCajas.forEach(caja => {
        let dx = (maxWidth - caja.w) / 2;
        let dy = (maxHeight - caja.h) / 2;
        
        let cOrig = document.createElement('canvas');
        cOrig.width = maxWidth;
        cOrig.height = maxHeight;
        let ctxOrig = cOrig.getContext('2d');
        ctxOrig.drawImage(imgSpritesheet, caja.x, caja.y, caja.w, caja.h, dx, dy, caja.w, caja.h);
        window.framesCanvasOriginales.push(cOrig);
        
        let c = document.createElement('canvas');
        c.width = maxWidth;
        c.height = maxHeight;
        let ctx = c.getContext('2d');
        
        if (window.gifBgMode === 'color') {
            ctx.fillStyle = window.gifBgColor;
            ctx.fillRect(0, 0, maxWidth, maxHeight);
        } else {
            ctx.clearRect(0, 0, maxWidth, maxHeight);
        }
        
        ctx.drawImage(imgSpritesheet, caja.x, caja.y, caja.w, caja.h, dx, dy, caja.w, caja.h);
        window.framesPreRenderizados.push(c.toDataURL('image/png'));
    });
    
    document.getElementById('gifCropContainer').style.display = 'none';
    let bgCont = document.getElementById('gifBgContainer');
    if (bgCont) bgCont.style.display = 'flex';
    let bpmCont = document.getElementById('bpmContainerGif');
    if (bpmCont) bpmCont.style.display = 'flex';
    let prevBox = document.getElementById('previewBoxGif');
    if (prevBox) prevBox.style.display = 'flex';
    document.getElementById('txtFrameCount').textContent = `${window.framesPreRenderizados.length} Frames`;
    document.getElementById('previewPlaceholder').style.display = 'none';
    document.getElementById('previewGifImg').style.display = 'block';
    document.getElementById('btnGenerarGif').style.display = 'block';
    
    let seq = document.getElementById('gifSequencer');
    if (seq) seq.style.display = 'block';
    
    let btnVolver = document.getElementById('btnVolverACortador');
    if (btnVolver) btnVolver.style.display = 'block';
    
    renderizarSecuenciadorGif();
    actualizarBPM();
}

function extraerFramesGif() {
    if (gifCajas.length === 0) {
        alert("¡No has marcado ningún frame! Usa el Modo Edición y la herramienta Dibujar Caja para marcar tus frames.");
        return;
    }
    
    mostrarCargaGlobal("Extrayendo frames...");
    setTimeout(() => {
        renderizarFramesModoB();
        ocultarCargaGlobal();
    }, 100);
}

window.addEventListener('keydown', (e) => {
    if (modoActual !== 'B' || cropMode !== 'EDIT' || selectedBoxIndex === -1) return;
    let b = gifCajas[selectedBoxIndex];
    if (!b) return;
    let step = e.shiftKey ? 10 : 1;
    let handled = true;
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        gifCajas.splice(selectedBoxIndex, 1);
        selectedBoxIndex = -1;
        actualizarContadorFramesGif();
        dibujarGifCrop();
        e.preventDefault();
        return;
    }
    
    if (e.ctrlKey) {
        if (e.key === 'ArrowUp') b.h = Math.max(5, b.h - step);
        else if (e.key === 'ArrowDown') b.h += step;
        else if (e.key === 'ArrowLeft') b.w = Math.max(5, b.w - step);
        else if (e.key === 'ArrowRight') b.w += step;
        else handled = false;
    } else {
        if (e.key === 'ArrowUp') b.y -= step;
        else if (e.key === 'ArrowDown') b.y += step;
        else if (e.key === 'ArrowLeft') b.x -= step;
        else if (e.key === 'ArrowRight') b.x += step;
        else handled = false;
    }
    
    if (handled) {
        e.preventDefault();
        dibujarGifCrop();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    let wrapper = document.getElementById('cropCanvasWrapper');
    if (!wrapper) return;
    
    wrapper.addEventListener('pointerdown', (e) => {
        if (!imgSpritesheet) return;
        wrapper.setPointerCapture(e.pointerId);
        cropActivePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        
        if (cropMode === 'EDIT') {
            let p = getRealCropPos(e);
            if (cropTool === 'DELETE') {
                for (let i = gifCajas.length - 1; i >= 0; i--) {
                    let b = gifCajas[i];
                    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
                        gifCajas.splice(i, 1);
                        selectedBoxIndex = -1;
                        actualizarContadorFramesGif();
                        dibujarGifCrop();
                        return;
                    }
                }
            } else if (cropTool === 'DRAW') {
                cropIsDragging = true;
                gifCajas.push({ x: Math.round(p.x), y: Math.round(p.y), w: 10, h: 10 });
                selectedBoxIndex = gifCajas.length - 1;
                cropDragAction = { type: 'DRAW', startX: p.x, startY: p.y };
                actualizarContadorFramesGif();
                dibujarGifCrop();
            } else if (cropTool === 'SELECT') {
                if (selectedBoxIndex !== -1) {
                    let h = getHandleAtGif(p, gifCajas[selectedBoxIndex]);
                    if (h) {
                        cropIsDragging = true;
                        let b = gifCajas[selectedBoxIndex];
                        cropDragAction = { type: 'RESIZE', handle: h, startX: p.x, startY: p.y, origX: b.x, origY: b.y, origW: b.w, origH: b.h };
                        return;
                    }
                }
                let found = -1;
                for (let i = gifCajas.length - 1; i >= 0; i--) {
                    let b = gifCajas[i];
                    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
                        found = i;
                        break;
                    }
                }
                selectedBoxIndex = found;
                if (found !== -1) {
                    cropIsDragging = true;
                    let b = gifCajas[selectedBoxIndex];
                    cropDragAction = { type: 'MOVE', startX: p.x, startY: p.y, origX: b.x, origY: b.y };
                }
                actualizarContadorFramesGif();
                dibujarGifCrop();
            }
        }
    });

    wrapper.addEventListener('pointermove', (e) => {
        if (!cropActivePointers[e.pointerId]) return;
        if (cropMode === 'VIEW') {
            let keys = Object.keys(cropActivePointers);
            if (keys.length === 1) {
                let dx = e.clientX - cropActivePointers[e.pointerId].x;
                let dy = e.clientY - cropActivePointers[e.pointerId].y;
                cropPanX += dx;
                cropPanY += dy;
                cropActivePointers[e.pointerId] = { x: e.clientX, y: e.clientY };
                actualizarCSSCrop();
            } else if (keys.length === 2) {
                let id1 = keys[0], id2 = keys[1];
                let p1 = cropActivePointers[id1], p2 = cropActivePointers[id2];
                let movingId = e.pointerId;
                let otherId = (movingId == id1) ? id2 : id1;
                let pOther = cropActivePointers[otherId];
                let oldDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                let cx = (p1.x + p2.x) / 2;
                let cy = (p1.y + p2.y) / 2;
                cropActivePointers[movingId] = { x: e.clientX, y: e.clientY };
                let newDist = Math.hypot(cropActivePointers[movingId].x - pOther.x, cropActivePointers[movingId].y - pOther.y);
                let oldZoom = cropZoom;
                let delta = (newDist - oldDist) * 0.005;
                cropZoom += delta;
                if (cropZoom < 0.1) cropZoom = 0.1;
                if (cropZoom > 4.0) cropZoom = 4.0;
                let rect = wrapper.getBoundingClientRect();
                let pinchX = cx - rect.left;
                let pinchY = cy - rect.top;
                cropPanX = pinchX - (pinchX - cropPanX) * (cropZoom / oldZoom);
                cropPanY = pinchY - (pinchY - cropPanY) * (cropZoom / oldZoom);
                actualizarCSSCrop();
            }
        } else if (cropMode === 'EDIT' && cropIsDragging && cropDragAction) {
            let p = getRealCropPos(e);
            let b = gifCajas[selectedBoxIndex];
            if (!b) return;
            if (cropDragAction.type === 'DRAW') {
                let curW = Math.round(p.x - cropDragAction.startX);
                let curH = Math.round(p.y - cropDragAction.startY);
                if (curW >= 0) { b.x = Math.round(cropDragAction.startX); b.w = curW; }
                else { b.x = Math.round(p.x); b.w = Math.abs(curW); }
                if (curH >= 0) { b.y = Math.round(cropDragAction.startY); b.h = curH; }
                else { b.y = Math.round(p.y); b.h = Math.abs(curH); }
            } else if (cropDragAction.type === 'MOVE') {
                b.x = Math.round(cropDragAction.origX + (p.x - cropDragAction.startX));
                b.y = Math.round(cropDragAction.origY + (p.y - cropDragAction.startY));
            } else if (cropDragAction.type === 'RESIZE') {
                let dx = p.x - cropDragAction.startX;
                let dy = p.y - cropDragAction.startY;
                if (cropDragAction.handle.includes('r')) { b.w = Math.max(5, Math.round(cropDragAction.origW + dx)); }
                if (cropDragAction.handle.includes('b')) { b.h = Math.max(5, Math.round(cropDragAction.origH + dy)); }
                if (cropDragAction.handle.includes('l')) { b.x = Math.round(cropDragAction.origX + dx); b.w = Math.max(5, Math.round(cropDragAction.origW - dx)); }
                if (cropDragAction.handle.includes('t')) { b.y = Math.round(cropDragAction.origY + dy); b.h = Math.max(5, Math.round(cropDragAction.origH - dy)); }
            }
            dibujarGifCrop();
        }
    });

    function removeCropPointer(e) {
        delete cropActivePointers[e.pointerId];
        if (cropIsDragging) {
            if (cropDragAction && cropDragAction.type === 'DRAW') {
                let b = gifCajas[selectedBoxIndex];
                if (b && (b.w < 10 || b.h < 10)) {
                    gifCajas.pop();
                    selectedBoxIndex = -1;
                }
            }
            cropIsDragging = false;
            cropDragAction = null;
            actualizarContadorFramesGif();
            dibujarGifCrop();
        }
    }
    
    wrapper.addEventListener('pointerup', removeCropPointer);
    wrapper.addEventListener('pointercancel', removeCropPointer);

    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        let oldZoom = cropZoom;
        if (e.deltaY < 0) cropZoom *= 1.1;
        else cropZoom /= 1.1;
        if (cropZoom < 0.1) cropZoom = 0.1;
        if (cropZoom > 4.0) cropZoom = 4.0;
        
        let rect = wrapper.getBoundingClientRect();
        let cx = e.clientX - rect.left;
        let cy = e.clientY - rect.top;
        cropPanX = cx - (cx - cropPanX) * (cropZoom / oldZoom);
        cropPanY = cy - (cy - cropPanY) * (cropZoom / oldZoom);
        actualizarCSSCrop();
    }, { passive: false });
});

function iniciarModoC() {
    document.getElementById('gifWorkspace').style.display = 'flex';
    document.getElementById('xmlAnimSelector').style.display = 'block';
    let cropCont = document.getElementById('gifCropContainer');
    if (cropCont) cropCont.style.display = 'none';
    let bpmCont = document.getElementById('bpmContainerGif');
    if (bpmCont) bpmCont.style.display = 'flex';
    let prevBox = document.getElementById('previewBoxGif');
    if (prevBox) prevBox.style.display = 'flex';
    
    // Parsear XML
    spritesXML = [];
    animacionesDisponibles = {};
    
    let subtextures = xmlDoc.getElementsByTagName('SubTexture');
    for(let i=0; i<subtextures.length; i++) {
        let st = subtextures[i];
        let name = st.getAttribute('name');
        // Quitar los números finales para agrupar
        let prefix = name.replace(/[0-9]+$/, '').trim();
        
        let frame = {
            name: name,
            x: parseInt(st.getAttribute('x')) || 0,
            y: parseInt(st.getAttribute('y')) || 0,
            width: parseInt(st.getAttribute('width')) || 0,
            height: parseInt(st.getAttribute('height')) || 0,
            frameX: parseInt(st.getAttribute('frameX')) || 0,
            frameY: parseInt(st.getAttribute('frameY')) || 0,
            frameWidth: parseInt(st.getAttribute('frameWidth')) || parseInt(st.getAttribute('width')),
            frameHeight: parseInt(st.getAttribute('frameHeight')) || parseInt(st.getAttribute('height'))
        };
        
        spritesXML.push(frame);
        
        if(!animacionesDisponibles[prefix]) {
            animacionesDisponibles[prefix] = [];
        }
        animacionesDisponibles[prefix].push(frame);
    }
    
    let selector = document.getElementById('selectAnimacionXML');
    selector.innerHTML = '';
    
    for (let anim in animacionesDisponibles) {
        let opt = document.createElement('option');
        opt.value = anim;
        opt.textContent = `${anim} (${animacionesDisponibles[anim].length} frames)`;
        selector.appendChild(opt);
    }
    
    selector.onchange = actualizarVistaPrevia;
    actualizarVistaPrevia();
}

let animTimer = null;
let animRafId = null;
let animStartTime = null;
window.framesPreRenderizados = [];
window.beatsPorCiclo = 1; // 1, 2, 4, 0.5, o 'step'
let audioCtxMetronomo = null;
let metronomoAudioActivo = false;
let ultimoBeatPulse = -1;

window.gifBgMode = 'transparent'; // 'transparent' | 'color'
window.gifBgColor = '#1a1a2e';
window.framesCanvasOriginales = [];
window.archivosSueltosCargados = [];
window.archivosSueltosDims = { width: 0, height: 0 };

function seleccionarModoFondoGif(modo) {
    window.gifBgMode = modo;
    let btnTrans = document.getElementById('btnBgModoTransparente');
    let btnCol = document.getElementById('btnBgModoColor');
    let panelPaleta = document.getElementById('panelPaletaColoresGif');
    let badge = document.getElementById('badgeFondoActual');
    let prevBox = document.querySelector('.preview-box') || document.getElementById('previewBoxGif');

    if (modo === 'transparent') {
        if (btnTrans) btnTrans.classList.add('active');
        if (btnCol) btnCol.classList.remove('active');
        if (panelPaleta) panelPaleta.style.display = 'none';
        if (badge) {
            badge.textContent = 'Transparente';
            badge.style.color = 'var(--accent)';
            badge.style.borderColor = 'var(--accent)';
            badge.style.background = 'rgba(0, 229, 255, 0.15)';
        }
        if (prevBox) {
            prevBox.style.backgroundColor = '#a0a0a0';
            prevBox.style.backgroundImage = 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%)';
        }
    } else {
        if (btnTrans) btnTrans.classList.remove('active');
        if (btnCol) btnCol.classList.add('active');
        if (panelPaleta) panelPaleta.style.display = 'flex';
        if (badge) {
            badge.textContent = window.gifBgColor.toUpperCase();
            badge.style.color = '#fff';
            badge.style.borderColor = window.gifBgColor;
            badge.style.background = window.gifBgColor;
        }
        if (prevBox) {
            prevBox.style.backgroundImage = 'none';
            prevBox.style.backgroundColor = window.gifBgColor;
        }
    }

    regenerarFramesSegunModo();
}

function cambiarColorFondoGif(colorHex) {
    window.gifBgColor = colorHex;
    let lbl = document.getElementById('lblColorFondoHex');
    if (lbl) lbl.textContent = colorHex.toLowerCase();
    let picker = document.getElementById('pickerColorFondoGif');
    if (picker && picker.value !== colorHex) picker.value = colorHex;
    let badge = document.getElementById('badgeFondoActual');
    if (badge && window.gifBgMode === 'color') {
        badge.textContent = colorHex.toUpperCase();
        badge.style.borderColor = colorHex;
        badge.style.background = colorHex;
    }
    let prevBox = document.querySelector('.preview-box') || document.getElementById('previewBoxGif');
    if (prevBox && window.gifBgMode === 'color') {
        prevBox.style.backgroundImage = 'none';
        prevBox.style.backgroundColor = colorHex;
    }

    document.querySelectorAll('.btn-color-swatch').forEach(sw => {
        if (sw.getAttribute('data-color').toLowerCase() === colorHex.toLowerCase()) {
            sw.classList.add('active');
        } else {
            sw.classList.remove('active');
        }
    });

    if (window.gifBgMode !== 'color') {
        seleccionarModoFondoGif('color');
    } else {
        regenerarFramesSegunModo();
    }
}

function seleccionarSwatchColor(colorHex, btnEl) {
    document.querySelectorAll('.btn-color-swatch').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    cambiarColorFondoGif(colorHex);
}

function regenerarFramesSegunModo() {
    let btnGen = document.getElementById('btnGenerarGif');
    let btnDown = document.getElementById('btnDescargarGif');
    if (btnGen && btnDown && btnDown.style.display === 'block') {
        btnGen.style.display = 'block';
        btnDown.style.display = 'none';
    }

    // Modo A: Archivos sueltos
    if (window.archivosSueltosCargados && window.archivosSueltosCargados.length > 0) {
        renderizarFramesSueltos();
        return;
    }

    // Modo B: Solo PNG
    if (typeof modoActual !== 'undefined' && modoActual === 'B' && window.gifCajas && window.gifCajas.length > 0 && window.imgSpritesheet) {
        renderizarFramesModoB();
        return;
    }

    // Modo C: XML + PNG
    let selectXml = document.getElementById('selectAnimacionXML');
    if (selectXml && selectXml.value && window.animacionesDisponibles && window.animacionesDisponibles[selectXml.value]) {
        actualizarVistaPrevia();
        return;
    }
}

function obtenerBpmActual() {
    let inputNum = document.getElementById('inputBpmNum');
    let slider = document.getElementById('sliderBpm');
    let bpm = 100;
    if (inputNum && inputNum.value) {
        bpm = parseFloat(inputNum.value);
    } else if (slider && slider.value) {
        bpm = parseFloat(slider.value);
    }
    if (isNaN(bpm) || bpm < 30) bpm = 30;
    if (bpm > 400) bpm = 400;
    return bpm;
}

function calcularDuracionCicloMs() {
    let bpm = obtenerBpmActual();
    let numFrames = (window.framesPreRenderizados && window.framesPreRenderizados.length) || 1;
    let beatMs = 60000 / bpm;
    
    if (window.beatsPorCiclo === 'step') {
        // En FNF: 1 Beat = 4 Steps (semicorcheas) -> 1 Step = (60000 / bpm) / 4 ms
        let stepMs = beatMs / 4;
        return numFrames * stepMs;
    }
    
    let beats = typeof window.beatsPorCiclo === 'number' ? window.beatsPorCiclo : 1;
    return beatMs * beats;
}

function cambiarModoRitmo(beats, btnEl) {
    window.beatsPorCiclo = beats;
    document.querySelectorAll('.btn-rhythm').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    actualizarBPM();
}

function ajustarBpmRelativo(delta) {
    let bpm = Math.round(obtenerBpmActual() + delta);
    if (bpm < 40) bpm = 40;
    if (bpm > 300) bpm = 300;
    let slider = document.getElementById('sliderBpm');
    let inputNum = document.getElementById('inputBpmNum');
    if (slider) slider.value = bpm;
    if (inputNum) inputNum.value = bpm;
    actualizarBPM();
}

function onInputSliderBpm(val) {
    let inputNum = document.getElementById('inputBpmNum');
    if (inputNum) inputNum.value = val;
    actualizarBPM();
}

function onInputChangeBpmNum(val) {
    let slider = document.getElementById('sliderBpm');
    let num = parseFloat(val);
    if (!isNaN(num) && slider) {
        slider.value = Math.min(300, Math.max(40, num));
    }
    actualizarBPM();
}

function toggleMetronomoAudio() {
    metronomoAudioActivo = !metronomoAudioActivo;
    let btn = document.getElementById('btnMetronomoAudio');
    if (btn) {
        if (metronomoAudioActivo) {
            btn.classList.remove('btn-secundario');
            btn.classList.add('btn-primario');
            btn.innerHTML = '🔊 Beat Sonando';
        } else {
            btn.classList.remove('btn-primario');
            btn.classList.add('btn-secundario');
            btn.innerHTML = '🔈 Escuchar Beat';
        }
    }
    if (metronomoAudioActivo && !audioCtxMetronomo) {
        try {
            audioCtxMetronomo = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
            console.error("AudioContext no soportado", e);
        }
    }
}

function reproducirTickMetronomo() {
    if (!metronomoAudioActivo) return;
    try {
        if (!audioCtxMetronomo) {
            audioCtxMetronomo = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtxMetronomo.state === 'suspended') {
            audioCtxMetronomo.resume();
        }
        let now = audioCtxMetronomo.currentTime;
        let osc = audioCtxMetronomo.createOscillator();
        let gain = audioCtxMetronomo.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(gain);
        gain.connect(audioCtxMetronomo.destination);
        osc.start(now);
        osc.stop(now + 0.04);
    } catch(e) {
        console.error(e);
    }
}

function actualizarBPM() {
    let bpm = obtenerBpmActual();
    let slider = document.getElementById('sliderBpm');
    let inputNum = document.getElementById('inputBpmNum');
    let lblBpm = document.getElementById('lblBpm');
    
    if (slider && slider.value != bpm) slider.value = bpm;
    if (inputNum && inputNum.value != bpm) inputNum.value = bpm;
    if (lblBpm) lblBpm.textContent = bpm;
    
    let numFrames = (window.framesPreRenderizados && window.framesPreRenderizados.length) || 1;
    let beatMs = 60000 / bpm;
    let duracionCicloMs = calcularDuracionCicloMs();
    let msPerFrame = duracionCicloMs / numFrames;
    let fpsEquiv = 1000 / msPerFrame;
    
    let lblDur = document.getElementById('lblDuracionDetalle');
    if (lblDur) {
        if (window.beatsPorCiclo === 'step') {
            lblDur.textContent = `1 Step = ${(beatMs/4).toFixed(1)} ms | 1 Beat = ${beatMs.toFixed(1)} ms`;
        } else {
            lblDur.textContent = `${window.beatsPorCiclo} Beat(s) = ${(beatMs * window.beatsPorCiclo).toFixed(1)} ms`;
        }
    }
    
    let lblCiclo = document.getElementById('lblCicloTotalMs');
    if (lblCiclo) lblCiclo.textContent = `${duracionCicloMs.toFixed(1)} ms`;
    
    let lblMs = document.getElementById('lblMsPerFrame');
    if (lblMs) lblMs.textContent = `${msPerFrame.toFixed(2)} ms/f`;
    
    let lblFpsEquiv = document.getElementById('lblFpsEquiv');
    if (lblFpsEquiv) lblFpsEquiv.textContent = `(= ${fpsEquiv.toFixed(1)} FPS continuo)`;
    
    let lblFps = document.getElementById('lblFps');
    if (lblFps) lblFps.textContent = `(= ${msPerFrame.toFixed(1)} ms/f | ${fpsEquiv.toFixed(1)} FPS)`;
    
    // Si ya se había generado un GIF pero cambiaron el tempo, permitir volver a exportar
    let btnGen = document.getElementById('btnGenerarGif');
    let btnDown = document.getElementById('btnDescargarGif');
    if (btnGen && btnDown && btnDown.style.display === 'block') {
        btnGen.style.display = 'block';
        btnDown.style.display = 'none';
    }
    
    if(window.framesPreRenderizados.length > 0) {
        iniciarAnimacionPreview();
    }
}

async function actualizarVistaPrevia() {
    let prefix = document.getElementById('selectAnimacionXML').value;
    if(!prefix) return;
    
    let frames = animacionesDisponibles[prefix];
    document.getElementById('txtFrameCount').textContent = `${frames.length} Frames`;
    
    // Generar canvas de cada frame
    window.framesPreRenderizados = [];
    window.framesCanvasOriginales = [];
    
    let maxWidth = 0;
    let maxHeight = 0;
    frames.forEach(f => {
        if(f.frameWidth > maxWidth) maxWidth = f.frameWidth;
        if(f.frameHeight > maxHeight) maxHeight = f.frameHeight;
    });
    
    for (let i=0; i<frames.length; i++) {
        let f = frames[i];
        let dx = Math.abs(f.frameX);
        let dy = Math.abs(f.frameY);
        
        let cOrig = document.createElement('canvas');
        cOrig.width = maxWidth;
        cOrig.height = maxHeight;
        let ctxOrig = cOrig.getContext('2d');
        ctxOrig.drawImage(imgSpritesheet, f.x, f.y, f.width, f.height, dx, dy, f.width, f.height);
        window.framesCanvasOriginales.push(cOrig);
        
        let c = document.createElement('canvas');
        c.width = maxWidth;
        c.height = maxHeight;
        let ctx = c.getContext('2d');
        
        if (window.gifBgMode === 'color') {
            ctx.fillStyle = window.gifBgColor;
            ctx.fillRect(0, 0, maxWidth, maxHeight);
        } else {
            ctx.clearRect(0, 0, maxWidth, maxHeight);
        }
        
        ctx.drawImage(imgSpritesheet, f.x, f.y, f.width, f.height, dx, dy, f.width, f.height);
        window.framesPreRenderizados.push(c.toDataURL('image/png'));
    }
    
    let bgCont = document.getElementById('gifBgContainer');
    if (bgCont) bgCont.style.display = 'flex';
    
    document.getElementById('previewPlaceholder').style.display = 'none';
    document.getElementById('previewGifImg').style.display = 'block';
    document.getElementById('btnGenerarGif').style.display = 'block';
    document.getElementById('btnDescargarGif').style.display = 'none';
    
    document.getElementById('gifSequencer').style.display = 'block';
    renderizarSecuenciadorGif();
    actualizarBPM();
}

function renderizarSecuenciadorGif() {
    let track = document.getElementById('gifSequencerTrack');
    if (!track) return;
    track.innerHTML = '';
    
    let isColor = (window.gifBgMode === 'color');
    let cardBg = isColor ? window.gifBgColor : 'repeating-conic-gradient(#808080 0% 25%, #666 0% 50%) 50% / 10px 10px';
    
    window.framesPreRenderizados.forEach((frameData, index) => {
        let card = document.createElement('div');
        card.style.cssText = `position:relative; width:80px; height:80px; background:${cardBg}; border-radius:5px; flex-shrink:0; display:flex; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.5); border: 2px solid #555;`;
        
        let img = document.createElement('img');
        img.src = frameData;
        img.style.cssText = "max-width:100%; max-height:100%; object-fit:contain;";
        card.appendChild(img);
        
        let numBadge = document.createElement('div');
        numBadge.style.cssText = "position:absolute; bottom:2px; left:2px; background:rgba(0,0,0,0.7); color:#fff; font-size:10px; font-weight:bold; padding:2px 4px; border-radius:3px;";
        numBadge.innerText = (index + 1);
        card.appendChild(numBadge);
        
        // Btn Duplicate
        let btnDup = document.createElement('div');
        btnDup.innerHTML = "+";
        btnDup.style.cssText = "position:absolute; top:-5px; right:15px; width:20px; height:20px; background:#4CAF50; color:#fff; border-radius:50%; text-align:center; line-height:20px; font-weight:bold; cursor:pointer; font-size:14px; z-index:10;";
        btnDup.onclick = () => {
            window.framesPreRenderizados.splice(index + 1, 0, frameData);
            if (window.framesCanvasOriginales && window.framesCanvasOriginales.length > index) {
                window.framesCanvasOriginales.splice(index + 1, 0, window.framesCanvasOriginales[index]);
            }
            document.getElementById('txtFrameCount').textContent = `${window.framesPreRenderizados.length} Frames`;
            renderizarSecuenciadorGif();
            actualizarBPM();
        };
        card.appendChild(btnDup);
        
        // Btn Delete
        let btnDel = document.createElement('div');
        btnDel.innerHTML = "×";
        btnDel.style.cssText = "position:absolute; top:-5px; right:-5px; width:20px; height:20px; background:#f44336; color:#fff; border-radius:50%; text-align:center; line-height:18px; font-weight:bold; cursor:pointer; font-size:16px; z-index:10;";
        btnDel.onclick = () => {
            if(window.framesPreRenderizados.length > 1) {
                window.framesPreRenderizados.splice(index, 1);
                if (window.framesCanvasOriginales && window.framesCanvasOriginales.length > index) {
                    window.framesCanvasOriginales.splice(index, 1);
                }
                document.getElementById('txtFrameCount').textContent = `${window.framesPreRenderizados.length} Frames`;
                renderizarSecuenciadorGif();
                actualizarBPM();
            } else {
                alert("No puedes eliminar el último frame.");
            }
        };
        card.appendChild(btnDel);
        
        track.appendChild(card);
    });
}

let currFrameIndex = 0;
function iniciarAnimacionPreview() {
    if (animRafId) cancelAnimationFrame(animRafId);
    if (animTimer) clearInterval(animTimer);
    
    if (!window.framesPreRenderizados || window.framesPreRenderizados.length === 0) return;
    let imgEl = document.getElementById('previewGifImg');
    if (!imgEl) return;
    
    let totalFrames = window.framesPreRenderizados.length;
    let duracionCicloMs = calcularDuracionCicloMs();
    if (duracionCicloMs <= 0) duracionCicloMs = 500;
    
    let bpm = obtenerBpmActual();
    let beatMs = 60000 / bpm;
    
    animStartTime = performance.now();
    let ultimoFrameMostrado = -1;
    let ledEl = document.getElementById('beatIndicatorLed');
    
    function loop(now) {
        let elapsed = now - animStartTime;
        let progress = (elapsed % duracionCicloMs) / duracionCicloMs;
        let frameIdx = Math.floor(progress * totalFrames);
        if (frameIdx >= totalFrames) frameIdx = totalFrames - 1;
        
        if (frameIdx !== ultimoFrameMostrado) {
            ultimoFrameMostrado = frameIdx;
            imgEl.src = window.framesPreRenderizados[frameIdx];
        }
        
        // Pulso visual y sonoro sincronizado al Beat musical exacto
        let curBeatNumber = Math.floor(elapsed / beatMs);
        if (curBeatNumber !== ultimoBeatPulse) {
            ultimoBeatPulse = curBeatNumber;
            reproducirTickMetronomo();
            if (ledEl) {
                ledEl.classList.add('beat-pulse-active');
                setTimeout(() => {
                    ledEl.classList.remove('beat-pulse-active');
                }, 90);
            }
        }
        
        animRafId = requestAnimationFrame(loop);
    }
    
    animRafId = requestAnimationFrame(loop);
}

function calcularDelaysPorFrame(duracionTotalSecs, numFrames) {
    let targetCentisecs = Math.max(numFrames, Math.round(duracionTotalSecs * 100));
    let base = Math.floor(targetCentisecs / numFrames);
    let remainder = targetCentisecs % numFrames;
    let delays = [];
    
    let acc = 0;
    for (let i = 0; i < numFrames; i++) {
        acc += remainder;
        let d = base;
        if (acc >= numFrames) {
            d += 1;
            acc -= numFrames;
        }
        delays.push(Math.max(1, d)); // Mínimo 1 centisegundo (10ms)
    }
    return delays;
}

async function generarGif() {
    if (!window.framesPreRenderizados || window.framesPreRenderizados.length === 0) {
        alert("⚠️ No hay frames disponibles para generar la animación.");
        return;
    }
    
    let duracionCicloMs = calcularDuracionCicloMs();
    let numFrames = window.framesPreRenderizados.length;
    let duracionTotalSecs = duracionCicloMs / 1000;
    let delaysCentisecs = calcularDelaysPorFrame(duracionTotalSecs, numFrames);
    
    mostrarCargaGlobal("Codificando la animación GIF al tempo musical BPM...");
    
    // Permitir que el modal de carga se muestre en el DOM antes del proceso
    await new Promise(r => setTimeout(r, 60));
    
    try {
        // Obtener los canvases originales de los frames
        let frameCanvases = [];
        if (window.framesCanvasOriginales && window.framesCanvasOriginales.length === window.framesPreRenderizados.length) {
            frameCanvases = window.framesCanvasOriginales;
        } else {
            // Fallback: reconstruir desde los dataURLs de framesPreRenderizados
            for (let i = 0; i < window.framesPreRenderizados.length; i++) {
                let img = new Image();
                await new Promise((res) => {
                    img.onload = res;
                    img.onerror = res;
                    img.src = window.framesPreRenderizados[i];
                });
                let c = document.createElement('canvas');
                c.width = img.naturalWidth || img.width || 300;
                c.height = img.naturalHeight || img.height || 300;
                let ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
                frameCanvases.push(c);
            }
        }
        
        let gifWidth = 0;
        let gifHeight = 0;
        for (let i = 0; i < frameCanvases.length; i++) {
            if (frameCanvases[i].width > gifWidth) gifWidth = frameCanvases[i].width;
            if (frameCanvases[i].height > gifHeight) gifHeight = frameCanvases[i].height;
        }
        if (gifWidth <= 0) gifWidth = 300;
        if (gifHeight <= 0) gifHeight = 300;
        
        let esTransparente = (window.gifBgMode === 'transparent');
        let colorFondo = window.gifBgColor || '#1a1a2e';
        
        let EncoderConstructor = window.GIFEncoder || (window.gifenc && window.gifenc.GIFEncoder);
        let quantizeFn = window.quantize || (window.gifenc && window.gifenc.quantize);
        let applyPaletteFn = window.applyPalette || (window.gifenc && window.gifenc.applyPalette);
        
        if (EncoderConstructor && quantizeFn && applyPaletteFn) {
            let encoder = EncoderConstructor();
            let frameCanvas = document.createElement('canvas');
            frameCanvas.width = gifWidth;
            frameCanvas.height = gifHeight;
            let ctx = frameCanvas.getContext('2d', { willReadFrequently: true });
            
            for (let i = 0; i < frameCanvases.length; i++) {
                let orig = frameCanvases[i];
                let ox = Math.round((gifWidth - orig.width) / 2);
                let oy = Math.round((gifHeight - orig.height) / 2);
                let delayMs = (delaysCentisecs[i] || 10) * 10;
                
                if (esTransparente) {
                    ctx.clearRect(0, 0, gifWidth, gifHeight);
                    ctx.drawImage(orig, ox, oy);
                    let imgData = ctx.getImageData(0, 0, gifWidth, gifHeight);
                    let rgba = imgData.data;
                    
                    // Umbral binario para transparencia nativa limpia sin halos ni artefactos
                    for (let p = 0; p < rgba.length; p += 4) {
                        if (rgba[p + 3] < 128) {
                            rgba[p] = 0;
                            rgba[p + 1] = 0;
                            rgba[p + 2] = 0;
                            rgba[p + 3] = 0;
                        } else {
                            rgba[p + 3] = 255;
                        }
                    }
                    
                    let palette = quantizeFn(rgba, 256, {
                        format: 'rgba4444',
                        oneBitAlpha: 0,
                        clearAlpha: true
                    });
                    
                    // Garantizar que el índice 0 de la paleta sea el color transparente [0,0,0,0]
                    let transIdx = palette.findIndex(c => c.length >= 4 && c[3] === 0);
                    if (transIdx === -1) {
                        palette.unshift([0, 0, 0, 0]);
                        if (palette.length > 256) palette.pop();
                        transIdx = 0;
                    } else if (transIdx !== 0) {
                        let tmp = palette[0];
                        palette[0] = palette[transIdx];
                        palette[transIdx] = tmp;
                        transIdx = 0;
                    }
                    
                    let index = applyPaletteFn(rgba, palette, 'rgba4444');
                    
                    encoder.writeFrame(index, gifWidth, gifHeight, {
                        palette: palette,
                        transparent: true,
                        transparentIndex: 0,
                        delay: delayMs,
                        dispose: 2 // Restore to background: elimina cualquier residuo de frame previo
                    });
                } else {
                    // Modo Color Sólido
                    ctx.fillStyle = colorFondo;
                    ctx.fillRect(0, 0, gifWidth, gifHeight);
                    ctx.drawImage(orig, ox, oy);
                    
                    let imgData = ctx.getImageData(0, 0, gifWidth, gifHeight);
                    let rgba = imgData.data;
                    
                    for (let p = 3; p < rgba.length; p += 4) {
                        rgba[p] = 255;
                    }
                    
                    let palette = quantizeFn(rgba, 256, {
                        format: 'rgb565'
                    });
                    
                    let index = applyPaletteFn(rgba, palette, 'rgb565');
                    
                    encoder.writeFrame(index, gifWidth, gifHeight, {
                        palette: palette,
                        transparent: false,
                        delay: delayMs,
                        dispose: 2 // Restore to background: evita acumulación o congelamiento de frames
                    });
                }
            }
            
            encoder.finish();
            let bytes = encoder.bytesView();
            let blob = new Blob([bytes], { type: 'image/gif' });
            if (window.ultimoGifBlobUrl) {
                URL.revokeObjectURL(window.ultimoGifBlobUrl);
            }
            let gifFinalUrl = URL.createObjectURL(blob);
            window.ultimoGifBlobUrl = gifFinalUrl;
            
            ocultarCargaGlobal();
            
            let previewImg = document.getElementById('previewGifImg');
            if (previewImg) previewImg.src = gifFinalUrl;
            if (animRafId) cancelAnimationFrame(animRafId);
            if (animTimer) clearInterval(animTimer);
            
            let btnDown = document.getElementById('btnDescargarGif');
            btnDown.href = gifFinalUrl;
            let nombreAnim = (document.getElementById('selectAnimacionXML')?.value) || 'animacion_bpm';
            btnDown.download = nombreAnim + ".gif";
            
            document.getElementById('btnGenerarGif').style.display = 'none';
            btnDown.style.display = 'block';
            return;
        }
        
        // Fallback a gifshot si gifenc no estuviese cargado
        console.warn("gifenc no disponible, usando fallback gifshot");
        let framesDataUrls = [];
        for (let i = 0; i < frameCanvases.length; i++) {
            let c = document.createElement('canvas');
            c.width = gifWidth;
            c.height = gifHeight;
            let cctx = c.getContext('2d');
            if (!esTransparente) {
                cctx.fillStyle = colorFondo;
                cctx.fillRect(0, 0, gifWidth, gifHeight);
            }
            cctx.drawImage(frameCanvases[i], (gifWidth - frameCanvases[i].width) / 2, (gifHeight - frameCanvases[i].height) / 2);
            framesDataUrls.push(c.toDataURL('image/png'));
        }
        
        gifshot.createGIF({
            images: framesDataUrls,
            gifWidth: gifWidth,
            gifHeight: gifHeight,
            interval: duracionTotalSecs / numFrames,
            numFrames: numFrames,
            sampleInterval: 10
        }, function(obj) {
            ocultarCargaGlobal();
            if (!obj.error) {
                let gifFinal = obj.image;
                document.getElementById('previewGifImg').src = gifFinal;
                if (animRafId) cancelAnimationFrame(animRafId);
                if (animTimer) clearInterval(animTimer);
                
                let btnDown = document.getElementById('btnDescargarGif');
                btnDown.href = gifFinal;
                let nombreAnim = (document.getElementById('selectAnimacionXML')?.value) || 'animacion_bpm';
                btnDown.download = nombreAnim + ".gif";
                
                document.getElementById('btnGenerarGif').style.display = 'none';
                btnDown.style.display = 'block';
            } else {
                alert("❌ Hubo un error al generar el GIF.");
            }
        });
    } catch(err) {
        console.error("Error en generarGif:", err);
        ocultarCargaGlobal();
        alert("❌ Error al procesar los frames del GIF: " + err.message);
    }
}
