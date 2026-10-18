// ==========================================
// NÚCLEO GLOBAL, VARIABLES Y FUNCIONES
// ==========================================
const CURRENT_VERSION = '1.5.2';

window.showChangelog = function (onlyLatest = false) {
    let modChangelog = document.getElementById('changelogModal');
    if (!modChangelog) {
        modChangelog = document.createElement('div');
        modChangelog.className = 'overlay-modal';
        modChangelog.id = 'changelogModal';
        modChangelog.style.display = 'none';
        modChangelog.innerHTML = `<div class="modal-box modal-box-changelog"></div>`;
        document.body.appendChild(modChangelog);
    }

    modChangelog.onclick = function (e) {
        if (e.target === modChangelog) {
            window.closeChangelogModal();
        }
    };

    let box = modChangelog.querySelector('.modal-box');
    if (box && !box.classList.contains('modal-box-changelog')) {
        box.classList.add('modal-box-changelog');
    }

    if (typeof CHANGELOG_DATA === 'undefined') {
        let script = document.createElement('script');
        script.src = 'js/changelog.js?v=' + CURRENT_VERSION;
        script.onload = () => window.showChangelog(onlyLatest);
        document.head.appendChild(script);
        return;
    }

    // Generador de HTML dinámico basado en CHANGELOG_DATA
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; border-bottom:1px solid rgba(255,215,0,0.25); padding-bottom:10px; margin-bottom:12px; flex-shrink:0;">
            <h2 class="modal-title" style="color: var(--accent-gold); margin:0; font-size: clamp(1.15rem, 3.5vw, 1.45rem); display:flex; align-items:center; gap:10px;">
                <img src="https://cdn-icons-png.flaticon.com/128/3067/3067425.png" style="width:28px; height:28px; filter:invert(1);" alt="Changelog"> 
                Historial de Versiones
            </h2>
            <button onclick="closeChangelogModal()" style="background:none; border:none; color:#aaa; font-size:1.8rem; cursor:pointer; line-height:1; padding:0 4px; transition:0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#aaa'" title="Cerrar">&times;</button>
        </div>
        <div class="modal-body" style="text-align: left; flex:1 1 auto; overflow-y: auto; padding-right: 6px; margin-bottom: 12px; overscroll-behavior: contain;">`;

    let dataToShow = onlyLatest ? [CHANGELOG_DATA[0]] : CHANGELOG_DATA;

    dataToShow.forEach((log, index) => {
        let isLatest = (log.version === CURRENT_VERSION);
        let borderColor = isLatest ? 'var(--accent-gold)' : 'rgba(255,255,255,0.12)';
        let titleColor = isLatest ? 'var(--accent-gold)' : '#e0e0e0';
        let extraTag = log.date ? `<span style="font-size:0.75rem; background:rgba(255,255,255,0.1); color:#bbb; padding:2px 8px; border-radius:4px; margin-left:8px; vertical-align:middle; font-weight:normal;">${log.date}</span>` : '';

        html += `<div style="border: 1px solid ${borderColor}; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; background: rgba(0,0,0,0.35); box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                    <h3 style="color: ${titleColor}; margin-top: 0; margin-bottom: 10px; font-size: clamp(0.95rem, 2.5vw, 1.15rem); display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                        Versión ${log.version} ${isLatest ? '✨ <span style="font-size:0.7rem; background:var(--accent-gold); color:#000; font-weight:bold; padding:2px 6px; border-radius:10px;">Actual</span>' : ''} ${extraTag}
                    </h3>
                    <ul class="modal-list" style="margin: 0; display:flex; flex-direction:column; gap:8px;">`;

        log.changes.forEach(change => {
            html += `<li style="margin: 0; line-height: 1.45; font-size: clamp(0.82rem, 2vw, 0.92rem); padding: 8px 10px; border-radius: 8px;">${change}</li>`;
        });

        html += `   </ul>
                 </div>`;
    });

    html += `</div>
             <button class="btn-pildora btn-modal-action" style="flex-shrink:0; background: linear-gradient(135deg, #b38f00, #665200); border-color: var(--accent-gold); margin-top: auto; padding: 12px 18px; font-weight:bold; font-size:clamp(0.92rem, 2.4vw, 1rem); box-shadow: 0 4px 15px rgba(179,143,0,0.4);" onclick="closeChangelogModal()">¡Entendido!</button>`;

    if (box) {
        box.innerHTML = html;
    }
    modChangelog.style.display = 'flex';
};

window.onload = () => {
    const savedTheme = localStorage.getItem('iasprite_theme') || 'cyberpunk';
    changeTheme(savedTheme);

    const savedMode = localStorage.getItem('iasprite_darkmode');
    if (savedMode === 'true') {
        document.body.classList.add('dark-mode');
    }

    const lastVersion = localStorage.getItem('iasprite_version');

    if (!lastVersion) {
        let modWelcome = document.getElementById('welcomeModal');
        if (modWelcome) modWelcome.style.display = 'flex';
    } else if (lastVersion !== CURRENT_VERSION) {
        window.showChangelog(true);
    }

    let hasFab = document.querySelector('.fab-wrap-theme');
    if (hasFab) {
        let changelogFab = document.createElement('div');
        changelogFab.className = 'fab-wrap-changelog';
        changelogFab.innerHTML = `
            <button class="fab-btn changelog-btn" onclick="window.showChangelog(false)" title="Novedades y Cambios" style="background: rgba(0,229,255,0.6);">
                <img src="https://cdn-icons-png.flaticon.com/128/3067/3067425.png" class="icon-sm icon-black" alt="Novedades">
            </button>
        `;
        document.body.appendChild(changelogFab);
    }

    setTimeout(() => {
        ocultarCargaGlobal();
        checkMobileData();
    }, 500);
};

function checkMobileData() {
    let hideWarning = localStorage.getItem('hideDataWarning');
    if (hideWarning === 'true') return;

    let isCellular = false;
    if (navigator.connection && (navigator.connection.type === 'cellular' || navigator.connection.saveData)) {
        isCellular = true;
    }

    if (!isCellular) return;

    let modalHTML = `
    <div id="dataWarningModal" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:99999; display:flex; justify-content:center; align-items:center;">
        <div style="background:var(--bg-glass, rgba(30,30,30,0.9)); border:1px solid #ffaa00; border-radius:15px; padding:30px; text-align:center; max-width:90%; width:400px; box-shadow:0 0 20px rgba(255,170,0,0.4); backdrop-filter:blur(10px);">
            <img src="https://cdn-icons-png.flaticon.com/128/833/833446.png" style="width:60px; margin-bottom:15px; filter: invert(0.8) sepia(1) saturate(5) hue-rotate(360deg);">
            <h2 style="color:#ffaa00; margin-bottom:15px;">Aviso de Datos Móviles</h2>
            <p style="color:var(--text, #fff); font-size:0.9rem; line-height:1.4; margin-bottom:20px;">
                Parece que estás usando una conexión de datos móviles. Esta aplicación procesa imágenes y herramientas que pueden consumir tu plan de datos.<br><br>¿Deseas continuar?
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button onclick="document.getElementById('dataWarningModal').style.display='none';" style="padding:12px; background:#ffaa00; color:#000; border:none; border-radius:8px; font-weight:bold; font-size:1rem; cursor:pointer;">ESTOY DE ACUERDO</button>
                <button onclick="document.body.innerHTML='<div style=\\'color:white; text-align:center; margin-top:50px; font-family:sans-serif;\\'><h1>Carga Detenida</h1><p>Has bloqueado el uso de la app para no consumir datos móviles.</p></div>';" style="padding:12px; background:rgba(255,255,255,0.1); color:var(--text, #fff); border:1px solid #555; border-radius:8px; font-size:1rem; cursor:pointer;">NO CARGAR</button>
            </div>
            <label style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:20px; color:#aaa; font-size:0.8rem; cursor:pointer;">
                <input type="checkbox" id="chkHideWarning" onchange="localStorage.setItem('hideDataWarning', this.checked ? 'true' : 'false')" style="accent-color:#ffaa00; scale:1.2;"> No mostrar de nuevo
            </label>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function mostrarCargaGlobal(mensaje) {
    let gl = document.getElementById('globalLoader');
    let gt = document.getElementById('globalLoaderText');
    if (gl) {
        if (gt) gt.innerHTML = mensaje || "Cargando...";
        gl.classList.remove('hidden');
    }
}

function ocultarCargaGlobal() {
    let gl = document.getElementById('globalLoader');
    if (gl) gl.classList.add('hidden');

    if (typeof window.autoSaveHistory === 'function') {
        setTimeout(window.autoSaveHistory, 1000);
    }
}

window.closeWelcomeModal = function () {
    document.getElementById('welcomeModal').style.display = 'none';
    localStorage.setItem('iasprite_version', CURRENT_VERSION);
};

window.closeChangelogModal = function () {
    document.getElementById('changelogModal').style.display = 'none';
    localStorage.setItem('iasprite_version', CURRENT_VERSION);
};

function changeTheme(theme) {
    document.body.classList.remove('theme-psych', 'theme-bf');
    if (theme !== 'cyberpunk') document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('iasprite_theme', theme);
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('iasprite_darkmode', isDark);
}

function togglePresetDropdown() {
    let dropdown = document.getElementById('presetDropdown');
    if (dropdown) dropdown.classList.toggle('active');
}

function selectPreset(preset) {
    let input = document.getElementById('inputBatchName');
    if (input) input.value = preset;
    togglePresetDropdown();
}

window.onclick = function (event) {
    if (!event.target.matches('.dropdown-btn')) {
        let dropdown = document.getElementById('presetDropdown');
        if (dropdown && dropdown.classList.contains('active')) {
            dropdown.classList.remove('active');
        }
    }
};

// ==========================================
// SISTEMA GLOBAL DE LOGS Y VALIDACIÓN DE IMPORTACIÓN
// ==========================================

window.initImportLogModal = function () {
    if (document.getElementById('modalLogImportacion')) return;

    const modalHTML = `
    <!-- MODAL DE LOGS DE IMPORTACIÓN -->
    <div class="overlay-modal" id="modalLogImportacion" style="display: none; z-index: 100000;">
        <div class="modal-box modal-box-log" id="boxLogImportacion">
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 14px;">
                <div id="iconLogImportacion" style="font-size: 2.2rem; line-height: 1;">❌</div>
                <div style="flex: 1;">
                    <h3 id="titleLogImportacion" style="margin: 0; color: #ff3366; font-size: 1.25rem; font-weight: 800; letter-spacing: 0.5px;">ARCHIVO INCORRECTO</h3>
                    <span id="badgeLogImportacion" style="display: inline-block; margin-top: 4px; font-size: 0.72rem; background: rgba(255,51,102,0.2); color: #ff3366; border: 1px solid rgba(255,51,102,0.4); padding: 2px 8px; border-radius: 6px; font-weight: bold; text-transform: uppercase;">FORMATO INVÁLIDO</span>
                </div>
                <button onclick="cerrarLogImportacion()" style="background: transparent; border: none; color: #aaa; font-size: 1.6rem; cursor: pointer; padding: 0 6px; line-height: 1;" title="Cerrar">&times;</button>
            </div>

            <div id="msgLogImportacion" style="color: #eee; font-size: 0.95rem; line-height: 1.5; margin-bottom: 16px;">
                El archivo importado no es el correcto.
            </div>

            <div id="wrapperDetalleLog" style="display: none; margin-bottom: 18px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 0.75rem; font-weight: bold; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px;">📋 Registro de Error Técnico (Log):</span>
                    <button id="btnCopiarLogImportacion" onclick="copiarDetalleLogImportacion()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #ccc; font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; cursor: pointer; transition: 0.2s;">Copiar Log</button>
                </div>
                <pre id="detalleLogImportacion" style="background: rgba(0, 0, 0, 0.75); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 12px; color: #ff8099; font-family: 'Consolas', 'Courier New', monospace; font-size: 0.82rem; line-height: 1.45; max-height: 150px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; margin: 0;"></pre>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn-pildora" id="btnOkLogImportacion" onclick="cerrarLogImportacion()" style="background: linear-gradient(135deg, #ff3366, #c2185b); border: none; padding: 10px 24px; color: white; font-weight: bold; cursor: pointer; border-radius: 50px;">¡Entendido!</button>
            </div>
        </div>
    </div>

    <!-- TOAST FLOTANTE -->
    <div id="toastLogImportacion" class="toast-import-feedback"></div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.cerrarLogImportacion = function () {
    let mod = document.getElementById('modalLogImportacion');
    if (mod) mod.style.display = 'none';
};

window.copiarDetalleLogImportacion = function () {
    let pre = document.getElementById('detalleLogImportacion');
    let btn = document.getElementById('btnCopiarLogImportacion');
    if (pre && pre.textContent) {
        navigator.clipboard.writeText(pre.textContent).then(() => {
            if (btn) {
                let orig = btn.textContent;
                btn.textContent = "✓ ¡Copiado!";
                btn.style.color = "#4caf50";
                setTimeout(() => { btn.textContent = orig; btn.style.color = "#ccc"; }, 2000);
            }
        }).catch(err => {
            console.error("No se pudo copiar al portapapeles:", err);
        });
    }
};

window.mostrarToastImportacion = function (mensaje, tipo = 'info', duracion = 4000) {
    window.initImportLogModal();
    let toast = document.getElementById('toastLogImportacion');
    if (!toast) return;

    toast.className = 'toast-import-feedback';
    if (tipo === 'error') {
        toast.classList.add('toast-error');
        toast.innerHTML = `<span style="font-size:1.1rem;">❌</span> <span>${mensaje}</span>`;
    } else if (tipo === 'warning') {
        toast.classList.add('toast-warning');
        toast.innerHTML = `<span style="font-size:1.1rem;">⚠️</span> <span>${mensaje}</span>`;
    } else {
        toast.classList.add('toast-success');
        toast.innerHTML = `<span style="font-size:1.1rem;">✅</span> <span>${mensaje}</span>`;
    }

    toast.classList.add('show');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, duracion);
};

window.mostrarLogImportacion = function (opts = {}) {
    window.initImportLogModal();
    let { tipo, titulo, mensaje, detalle, archivo, esperado } = opts;

    let mod = document.getElementById('modalLogImportacion');
    let box = document.getElementById('boxLogImportacion');
    let icon = document.getElementById('iconLogImportacion');
    let tit = document.getElementById('titleLogImportacion');
    let badge = document.getElementById('badgeLogImportacion');
    let msg = document.getElementById('msgLogImportacion');
    let wrapDetalle = document.getElementById('wrapperDetalleLog');
    let preDetalle = document.getElementById('detalleLogImportacion');
    let btnOk = document.getElementById('btnOkLogImportacion');

    if (!mod || !box) return;

    box.className = 'modal-box modal-box-log';

    let fName = archivo ? archivo.name : "archivo desconocido";
    let fExt = fName.includes('.') ? fName.split('.').pop().toLowerCase() : "sin extensión";
    let fSize = archivo ? (archivo.size / 1024).toFixed(1) + " KB" : "--";

    if (tipo === 'formato_incorrecto') {
        box.classList.remove('log-corrupto', 'log-exito');
        icon.textContent = "❌";
        tit.textContent = titulo || "ARCHIVO INCORRECTO";
        tit.style.color = "#ff3366";
        badge.textContent = "FORMATO NO COINCIDE";
        badge.style.background = "rgba(255,51,102,0.2)";
        badge.style.color = "#ff3366";
        badge.style.borderColor = "rgba(255,51,102,0.4)";

        msg.innerHTML = mensaje || `
            El archivo importado <b style="color:#ff8099;">"${fName}"</b> no es el correcto.<br><br>
            Se esperaba un archivo con formato <b>${esperado || 'específico'}</b>, pero el archivo seleccionado tiene extensión <b>.${fExt}</b>.<br><br>
            <span style="color:#aaa; font-size:0.85rem;">Por favor, revisa tus archivos y selecciona el que corresponde a esta opción.</span>
        `;

        wrapDetalle.style.display = 'block';
        preDetalle.style.color = "#ff8099";
        preDetalle.textContent = detalle || `[LOG DE ERROR]: Formato esperado "${esperado}". Archivo recibido: "${fName}" (tipo detectado: ${archivo && archivo.type ? archivo.type : 'desconocido'}, tamaño: ${fSize}).`;

        btnOk.style.background = "linear-gradient(135deg, #ff3366, #c2185b)";
        console.error(`❌ [LOG IMPORTACIÓN - ARCHIVO INCORRECTO]: Se esperaba "${esperado}", recibido "${fName}"`);
        window.mostrarToastImportacion(`Archivo incorrecto: Se esperaba ${esperado || 'otro formato'}`, 'error');

    } else if (tipo === 'sintaxis_corrupto') {
        box.classList.add('log-corrupto');
        box.classList.remove('log-exito');
        icon.textContent = "⚠️";
        tit.textContent = titulo || "ARCHIVO CON ERRORES Y FALLAS";
        tit.style.color = "#ffaa00";
        badge.textContent = "SINTAXIS INVÁLIDA O CORRUPTO";
        badge.style.background = "rgba(255,152,0,0.2)";
        badge.style.color = "#ffaa00";
        badge.style.borderColor = "rgba(255,152,0,0.4)";

        msg.innerHTML = mensaje || `
            Este archivo cuenta con <b style="color:#ffcc00;">errores y fallas</b>.<br><br>
            El archivo <b style="color:#ffcc00;">"${fName}"</b> tiene la extensión esperada (<b>${esperado || '.' + fExt}</b>), pero contiene fallas de sintaxis, estructura interna rota o está dañado/corrupto y no puede ser procesado.<br><br>
            <span style="color:#aaa; font-size:0.85rem;">Revisa el registro de error a continuación para identificar la falla:</span>
        `;

        wrapDetalle.style.display = 'block';
        preDetalle.style.color = "#ffcc00";
        preDetalle.textContent = detalle || `[LOG DE ERROR - FALLA TÉCNICA]: El archivo "${fName}" no se pudo leer o decodificar debido a una falla interna de estructura o corrupción de datos.`;

        btnOk.style.background = "linear-gradient(135deg, #ff9800, #e65100)";
        console.error(`⚠️ [LOG IMPORTACIÓN - SINTAXIS/CORRUPCIÓN]: Error en "${fName}":\n`, detalle);
        window.mostrarToastImportacion(`Archivo con errores y fallas: ${fName}`, 'warning');

    } else if (tipo === 'exito') {
        console.log(`✓ [LOG IMPORTACIÓN - ÉXITO]: "${fName}" importado correctamente.`);
        window.mostrarToastImportacion(`¡Archivo "${fName}" importado con éxito!`, 'success');
        return;
    }

    mod.style.display = 'flex';
};

window.findTargetButton = function (inputElem) {
    if (!inputElem) return null;
    if (inputElem.tagName === 'BUTTON') return inputElem;
    if (inputElem.nextElementSibling && (inputElem.nextElementSibling.tagName === 'BUTTON' || inputElem.nextElementSibling.classList.contains('btn-pildora'))) {
        return inputElem.nextElementSibling;
    }
    if (inputElem.id) {
        let btn = document.querySelector(`button[onclick*="${inputElem.id}"]`);
        if (btn) return btn;
        let lbl = document.querySelector(`label[for="${inputElem.id}"]`);
        if (lbl) return lbl;
    }
    return inputElem;
};

window.setImportButtonState = function (targetElem, state, details = {}) {
    let btn = window.findTargetButton(targetElem);
    if (!btn) return;

    if (!btn.dataset.origStyle) {
        btn.dataset.origStyle = btn.getAttribute('style') || '';
    }

    if (state === 'success') {
        btn.classList.remove('btn-import-error', 'btn-shake');
        btn.classList.add('btn-import-success');
        btn.style.background = '#4caf50';
        btn.style.backgroundImage = 'linear-gradient(135deg, #4caf50, #2e7d32)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#4caf50';
        btn.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.45)';

        let icons = btn.querySelectorAll('img.icon, img.icon-sm');
        icons.forEach(ic => {
            ic.style.filter = 'brightness(0) invert(1)';
        });

    } else if (state === 'error') {
        btn.classList.remove('btn-import-success');
        btn.classList.add('btn-import-error');
        btn.style.background = '#e91e63';
        btn.style.backgroundImage = 'linear-gradient(135deg, #ff3366, #c2185b)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#ff3366';
        btn.style.boxShadow = '0 4px 15px rgba(255, 51, 102, 0.55)';

        btn.classList.remove('btn-shake');
        void btn.offsetWidth;
        btn.classList.add('btn-shake');

        let icons = btn.querySelectorAll('img.icon, img.icon-sm');
        icons.forEach(ic => {
            ic.style.filter = 'brightness(0) invert(1)';
        });

    } else if (state === 'reset') {
        btn.classList.remove('btn-import-success', 'btn-import-error', 'btn-shake');
        if (btn.dataset.origStyle !== undefined) {
            btn.setAttribute('style', btn.dataset.origStyle);
        }
    }
};

window.validateAndProcessFile = async function (inputElem, expectedType, callbacks = {}) {
    let file = inputElem.files ? inputElem.files[0] : null;
    if (!file) {
        window.setImportButtonState(inputElem, 'reset');
        return false;
    }

    let btn = window.findTargetButton(inputElem);
    let fileName = file.name || "";
    let ext = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : "";

    // 1. VALIDACIÓN DE FORMATO / EXTENSIÓN
    let isCorrectFormat = false;
    let expectedDesc = "";

    if (expectedType === 'png') {
        expectedDesc = ".PNG (Imagen)";
        isCorrectFormat = (ext === 'png');
    } else if (expectedType === 'image') {
        expectedDesc = "Imagen (.PNG, .JPG, .WEBP)";
        isCorrectFormat = ['png', 'jpg', 'jpeg', 'webp'].includes(ext);
    } else if (expectedType === 'xml') {
        expectedDesc = ".XML (Sparrow)";
        isCorrectFormat = (ext === 'xml');
    } else if (expectedType === 'json') {
        expectedDesc = ".JSON (Datos / Personaje)";
        isCorrectFormat = (ext === 'json');
    } else if (expectedType === 'audio') {
        expectedDesc = ".OGG o .MP3 (Audio)";
        isCorrectFormat = ['ogg', 'mp3', 'wav'].includes(ext);
    } else if (expectedType === 'astc') {
        expectedDesc = ".ASTC (Textura Comprimida)";
        isCorrectFormat = (ext === 'astc');
    }

    if (!isCorrectFormat) {
        window.setImportButtonState(btn, 'error');
        window.mostrarLogImportacion({
            tipo: 'formato_incorrecto',
            titulo: 'ARCHIVO INCORRECTO',
            esperado: expectedDesc,
            archivo: file,
            detalle: `[FORMATO INCORRECTO]: Se esperaba un archivo con formato "${expectedDesc}", pero se seleccionó "${fileName}" (extensión detectada: .${ext || 'desconocida'}).`
        });
        inputElem.value = "";
        if (callbacks.onError) callbacks.onError('formato_incorrecto', `Extensión .${ext} no esperada`);
        return false;
    }

    // 2. VALIDACIÓN DE ARCHIVO VACÍO (0 BYTES)
    if (file.size === 0) {
        window.setImportButtonState(btn, 'error');
        window.mostrarLogImportacion({
            tipo: 'sintaxis_corrupto',
            titulo: 'ARCHIVO VACÍO O CORRUPTO',
            esperado: expectedDesc,
            archivo: file,
            detalle: `[ARCHIVO VACÍO]: El archivo "${fileName}" tiene un tamaño de 0 bytes y no contiene información utilizable.`
        });
        inputElem.value = "";
        if (callbacks.onError) callbacks.onError('sintaxis_corrupto', 'Archivo de 0 bytes');
        return false;
    }

    // 3. VALIDACIÓN DE SINTAXIS / CORRUPCIÓN SEGÚN TIPO
    if (expectedType === 'png' || expectedType === 'image') {
        try {
            let img = await new Promise((resolve, reject) => {
                let tempImg = new Image();
                let url = URL.createObjectURL(file);
                tempImg.onload = () => {
                    URL.revokeObjectURL(url);
                    if (tempImg.naturalWidth === 0 || tempImg.naturalHeight === 0) {
                        reject(new Error("La imagen tiene dimensiones de 0x0 píxeles."));
                    } else {
                        resolve(tempImg);
                    }
                };
                tempImg.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error("Falla al decodificar la imagen: Los datos del archivo no corresponden a una imagen gráfica válida o están corruptos/dañados."));
                };
                tempImg.src = url;
            });

            window.setImportButtonState(btn, 'success', { fileName: fileName });
            window.mostrarLogImportacion({ tipo: 'exito', archivo: file });
            if (callbacks.onSuccess) callbacks.onSuccess(file, img);
            return true;
        } catch (err) {
            window.setImportButtonState(btn, 'error');
            window.mostrarLogImportacion({
                tipo: 'sintaxis_corrupto',
                titulo: 'ARCHIVO DE IMAGEN CORRUPTO',
                esperado: expectedDesc,
                archivo: file,
                detalle: `[DECODE ERROR]: ${err.message}`
            });
            inputElem.value = "";
            if (callbacks.onError) callbacks.onError('sintaxis_corrupto', err.message);
            return false;
        }

    } else if (expectedType === 'xml') {
        try {
            let text = await file.text();
            if (!text || !text.trim()) {
                throw new Error("El archivo XML está completamente vacío o sin texto legible.");
            }
            let parser = new DOMParser();
            let xmlDoc = parser.parseFromString(text, "text/xml");
            let parseErrors = xmlDoc.getElementsByTagName("parsererror");
            if (parseErrors.length > 0) {
                let errText = parseErrors[0].textContent.trim();
                throw new Error(`Error de sintaxis XML (DOMParser):\n${errText}`);
            }

            let subTextures = xmlDoc.getElementsByTagName("SubTexture");
            let textureAtlas = xmlDoc.getElementsByTagName("TextureAtlas");
            if (subTextures.length === 0 && textureAtlas.length === 0) {
                throw new Error("El archivo XML tiene sintaxis válida, pero no cuenta con etiquetas <TextureAtlas> ni <SubTexture> necesarias para hojas de sprites de Friday Night Funkin'.");
            }

            window.setImportButtonState(btn, 'success', { fileName: fileName });
            window.mostrarLogImportacion({ tipo: 'exito', archivo: file });
            if (callbacks.onSuccess) callbacks.onSuccess(file, { text: text, xmlDoc: xmlDoc, subTextures: subTextures });
            return true;
        } catch (err) {
            window.setImportButtonState(btn, 'error');
            window.mostrarLogImportacion({
                tipo: 'sintaxis_corrupto',
                titulo: 'ARCHIVO XML CON ERRORES Y FALLAS',
                esperado: expectedDesc,
                archivo: file,
                detalle: `[XML PARSER ERROR]: ${err.message}`
            });
            inputElem.value = "";
            if (callbacks.onError) callbacks.onError('sintaxis_corrupto', err.message);
            return false;
        }

    } else if (expectedType === 'json') {
        try {
            let text = await file.text();
            if (!text || !text.trim()) {
                throw new Error("El archivo JSON está completamente vacío.");
            }
            let jsonObj;
            try {
                jsonObj = JSON.parse(text);
            } catch (syntaxErr) {
                throw new Error(`Error de sintaxis JSON (JSON.parse):\n${syntaxErr.message}`);
            }

            if (!jsonObj || typeof jsonObj !== 'object') {
                throw new Error("El contenido del archivo no es un objeto ni arreglo JSON válido.");
            }

            if (callbacks.customValidate) {
                let customRes = callbacks.customValidate(jsonObj);
                if (customRes && customRes.error) {
                    throw new Error(customRes.error);
                }
            }

            window.setImportButtonState(btn, 'success', { fileName: fileName });
            window.mostrarLogImportacion({ tipo: 'exito', archivo: file });
            if (callbacks.onSuccess) callbacks.onSuccess(file, { text: text, obj: jsonObj });
            return true;
        } catch (err) {
            window.setImportButtonState(btn, 'error');
            window.mostrarLogImportacion({
                tipo: 'sintaxis_corrupto',
                titulo: 'ARCHIVO JSON CON ERRORES Y FALLAS',
                esperado: expectedDesc,
                archivo: file,
                detalle: `[JSON SYNTAX ERROR]: ${err.message}`
            });
            inputElem.value = "";
            if (callbacks.onError) callbacks.onError('sintaxis_corrupto', err.message);
            return false;
        }

    } else if (expectedType === 'audio') {
        try {
            let arrayBuffer = await file.arrayBuffer();
            let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            let audioBuffer = await new Promise((resolve, reject) => {
                audioCtx.decodeAudioData(arrayBuffer, resolve, (err) => {
                    reject(new Error("No se pudo decodificar el audio. El códec no es compatible o el flujo de datos está corrupto."));
                });
            });

            window.setImportButtonState(btn, 'success', { fileName: fileName });
            window.mostrarLogImportacion({ tipo: 'exito', archivo: file });
            if (callbacks.onSuccess) callbacks.onSuccess(file, audioBuffer);
            return true;
        } catch (err) {
            window.setImportButtonState(btn, 'error');
            window.mostrarLogImportacion({
                tipo: 'sintaxis_corrupto',
                titulo: 'ARCHIVO DE AUDIO CON ERRORES Y FALLAS',
                esperado: expectedDesc,
                archivo: file,
                detalle: `[AUDIO DECODE ERROR]: ${err.message}`
            });
            inputElem.value = "";
            if (callbacks.onError) callbacks.onError('sintaxis_corrupto', err.message);
            return false;
        }
    } else if (expectedType === 'astc') {
        try {
            let buffer = await file.arrayBuffer();
            let bytes = new Uint8Array(buffer);
            if (bytes.length < 16) {
                throw new Error("El archivo tiene menos de 16 bytes y no cuenta con la cabecera ASTC estándar.");
            }
            if (bytes[0] !== 0x13 || bytes[1] !== 0xAB || bytes[2] !== 0xA1 || bytes[3] !== 0x5C) {
                throw new Error("Firma mágica inválida (debe iniciar con 0x13 0xAB 0xA1 0x5C). El archivo no es una textura ASTC estándar.");
            }
            let header = null;
            if (window.ASTCEngine && typeof window.ASTCEngine.parseHeader === 'function') {
                header = window.ASTCEngine.parseHeader(bytes);
            } else {
                let bx = bytes[4], by = bytes[5];
                let w = bytes[7] | (bytes[8] << 8) | (bytes[9] << 16);
                let h = bytes[10] | (bytes[11] << 8) | (bytes[12] << 16);
                header = { blockX: bx, blockY: by, width: w, height: h };
            }
            if (!header || header.width <= 0 || header.height <= 0) {
                throw new Error("Dimensiones de textura inválidas en la cabecera ASTC (0x0 píxeles).");
            }
            window.setImportButtonState(btn, 'success', { fileName: fileName });
            window.mostrarLogImportacion({ tipo: 'exito', archivo: file });
            if (callbacks.onSuccess) callbacks.onSuccess(file, { bytes, header });
            return true;
        } catch (err) {
            window.setImportButtonState(btn, 'error');
            window.mostrarLogImportacion({
                tipo: 'sintaxis_corrupto',
                titulo: 'ARCHIVO ASTC CORRUPTO O INVÁLIDO',
                esperado: expectedDesc,
                archivo: file,
                detalle: `[ASTC DECODE ERROR]: ${err.message}`
            });
            inputElem.value = "";
            if (callbacks.onError) callbacks.onError('sintaxis_corrupto', err.message);
            return false;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    window.initImportLogModal();
});

var appMode = 'HOME'; var imgOriginal = new Image(); var nombreArchivo = "spritesheet.png";
var spritesDetectados = []; var psychAnimations = []; var indexEditando = null;

let zoomActual = 1.0; let panX = 0, panY = 0; let globalMode = 'VIEW';

const scanWrapper = document.getElementById('scanWrapper');
const canvas = document.getElementById('canvasSprites'); const ctx = canvas?.getContext('2d');
const canvasPreview = document.getElementById('canvasPreview'); const ctxPreview = canvasPreview?.getContext('2d');
const canvasLoopPlayer = document.getElementById('canvasLoopPlayer'); const ctxLoopPlayer = canvasLoopPlayer?.getContext('2d');
const canvasPsychLive = document.getElementById('canvasPsychLive'); const ctxPsychLive = canvasPsychLive?.getContext('2d');

const timelineContainer = document.getElementById('timelineContainer');
const selectAnimFilter = document.getElementById('selectAnimFilter');
const p_animPrefix = document.getElementById('p_animPrefix');
const psychAnimList = document.getElementById('psychAnimList');

let playActive = true; let playInterval = null; let currentLoopFrameIdx = 0; let fpsActual = 24;
let psychLiveActiveAnimIdx = -1; let psychLiveFrameIdx = 0; let psychLiveInterval = null;

document.getElementById('sliderCorte')?.addEventListener('input', (e) => { let v = document.getElementById('valCorte'); if (v) v.textContent = e.target.value; });
document.getElementById('sliderUnion')?.addEventListener('input', (e) => { let v = document.getElementById('valUnion'); if (v) v.textContent = e.target.value; });
document.getElementById('sliderPad')?.addEventListener('input', (e) => { let v = document.getElementById('valPad'); if (v) v.textContent = e.target.value; });

window.autoRenumerar = function () {
    let contadores = {};
    spritesDetectados.forEach(s => {
        let prefijo = s.name.replace(/\d+$/, '');
        if (!prefijo) prefijo = "frame_";
        if (contadores[prefijo] === undefined) contadores[prefijo] = 0;
        s.name = prefijo + String(contadores[prefijo]).padStart(4, '0');
        contadores[prefijo]++;
    });
};

window.duplicateFrame = function (idx) {
    let original = spritesDetectados[idx]; let copy = JSON.parse(JSON.stringify(original));
    spritesDetectados.splice(idx + 1, 0, copy);
    if (indexEditando !== null && indexEditando > idx) { indexEditando++; }
    autoRenumerar();
    if (typeof renderTimelineSecuenciador === 'function') renderTimelineSecuenciador();
    if (typeof dibujarContornos === 'function') dibujarContornos();
    if (typeof actualizarDropdownFiltros === 'function') actualizarDropdownFiltros();
    if (typeof actualizarDropdownPsych === 'function') actualizarDropdownPsych();
};

window.duplicarActualAfinador = function () {
    if (indexEditando === null) return;
    duplicateFrame(indexEditando);
    if (typeof seleccionarFrameAfinador === 'function') seleccionarFrameAfinador(indexEditando + 1);
};

async function openWindow(winId) {
    mostrarCargaGlobal("Cargando seccin...");
    await pensar(50); // Creador de Blur

    document.querySelectorAll('.window-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.win-btn').forEach(btn => btn.classList.remove('active'));

    let win = document.getElementById(winId);
    if (win) win.classList.add('active');

    let nHome = document.getElementById('navHome'); if (nHome && winId === 'win-home') nHome.classList.add('active');
    let nEsc = document.getElementById('navEscaner'); if (nEsc && winId === 'win-escaner') nEsc.classList.add('active');
    let nOrd = document.getElementById('navOrden'); if (nOrd && winId === 'win-orden') nOrd.classList.add('active');
    let nAfin = document.getElementById('navAfinador'); if (nAfin && winId === 'win-afinador') nAfin.classList.add('active');
    let nPsych = document.getElementById('navPsych'); if (nPsych && winId === 'win-psych') nPsych.classList.add('active');
    let nComp = document.getElementById('navCompresor'); if (nComp && winId === 'win-compresor') nComp.classList.add('active');

    if (winId === 'win-afinador' && typeof renderizarPreviewTiempoReal === 'function') { renderizarPreviewTiempoReal(); updatePlayerInterval(); }
    if (winId === 'win-orden' && typeof renderTimelineSecuenciador === 'function') { renderTimelineSecuenciador(); }
    if (winId === 'win-psych' && typeof startPsychLiveLoop === 'function') { startPsychLiveLoop(); }
    if (winId === 'win-escaner' && typeof actualizarCSSCamera === 'function') { actualizarCSSCamera(); dibujarContornos(); }

    setTimeout(() => { ocultarCargaGlobal(); }, 200);
}

function toggleNavButtons() {
    let nScan = document.getElementById('navEscaner'); if (nScan) nScan.style.display = (appMode === 'SCAN') ? 'flex' : 'none';
    let nOrd = document.getElementById('navOrden'); if (nOrd) nOrd.style.display = (appMode === 'SCAN' || appMode === 'EDIT') ? 'flex' : 'none';
    let nAfin = document.getElementById('navAfinador'); if (nAfin) nAfin.style.display = (appMode === 'SCAN' || appMode === 'EDIT') ? 'flex' : 'none';
    let nPsych = document.getElementById('navPsych'); if (nPsych) nPsych.style.display = (appMode === 'PSYCH') ? 'flex' : 'none';
    let nComp = document.getElementById('navCompresor'); if (nComp) nComp.style.display = (appMode === 'COMPRESS') ? 'flex' : 'none';
    let nAud = document.getElementById('navAudio'); if (nAud) nAud.style.display = (appMode === 'AUDIO') ? 'flex' : 'none';
    let nAtl = document.getElementById('navAtlas'); if (nAtl) nAtl.style.display = (appMode === 'ATLAS') ? 'flex' : 'none';

    let nPack = document.getElementById('navPack'); if (nPack) nPack.style.display = (appMode === 'EDIT' || appMode === 'SCAN') ? 'flex' : 'none';
    let nExp = document.getElementById('navExport'); if (nExp) nExp.style.display = (appMode === 'EDIT' || appMode === 'SCAN' || appMode === 'PSYCH') ? 'flex' : 'none';

    if (appMode === 'PSYCH') {
        if (nExp) {
            nExp.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/136/136443.png" class="icon" alt="JSON"> Generar JSON';
            nExp.style.background = 'linear-gradient(135deg, #558800, #224400)';
        }
    } else {
        if (nExp) {
            nExp.innerHTML = '<img src="https://cdn-icons-png.flaticon.com/512/2874/2874091.png" class="icon" alt="XML"> Solo Guardar XML';
            nExp.style.background = 'linear-gradient(135deg, #008888, #005555)';
        }
    }
}

function initMode(mode) {
    appMode = mode;
    toggleNavButtons();
    if (mode === 'SCAN') openWindow('win-escaner');
    if (mode === 'COMPRESS') openWindow('win-compresor');
    if (mode === 'AUDIO') openWindow('win-audio');
    if (mode === 'ATLAS') openWindow('win-atlas');
    if (typeof window.autoSaveHistory === 'function') window.autoSaveHistory();
}
const pensar = (ms) => new Promise(res => setTimeout(res, ms));
function showLoader(titulo, mensaje) {
    if (!mensaje) {
        mostrarCargaGlobal(titulo || "Cargando...");
        return;
    }
    let html = `<div style="font-size: 1.15rem; font-weight: 800; color: #00e5ff; margin-bottom: 6px; letter-spacing: 0.5px; text-shadow: 0 0 10px rgba(0,229,255,0.4);">${titulo}</div><div style="font-size: 0.92rem; color: #eee; line-height: 1.45;">${mensaje}</div>`;
    mostrarCargaGlobal(html);
}

function loadMainImage(file, callback) {
    if (!file) return; mostrarCargaGlobal("Cargando imagen PNG..."); nombreArchivo = file.name;
    window.lastResizeFactor = 1.0;
    window.totalResizeFactor = 1.0;
    const reader = new FileReader();
    reader.onload = (event) => {
        imgOriginal = new Image();
        imgOriginal.onload = () => {
            spritesDetectados = [];
            if (typeof canvas !== 'undefined' && canvas) {
                canvas.width = imgOriginal.width; canvas.height = imgOriginal.height;
            }
            if (typeof scanWrapper !== 'undefined' && scanWrapper) {
                let rect = scanWrapper.getBoundingClientRect();
                let scaleX = (rect.width - 40) / imgOriginal.width;
                let scaleY = (rect.height - 40) / imgOriginal.height;
                zoomActual = Math.min(1.0, scaleX, scaleY);
                if (zoomActual <= 0) zoomActual = 0.1;
                panX = (rect.width - (imgOriginal.width * zoomActual)) / 2;
                panY = (rect.height - (imgOriginal.height * zoomActual)) / 2;
            } else {
                zoomActual = 1.0;
                panX = 0; panY = 0;
            }
            if (typeof actualizarCSSCamera === 'function') actualizarCSSCamera();
            ocultarCargaGlobal();
            if (callback) callback();
        };
        imgOriginal.onerror = () => { ocultarCargaGlobal(); alert("❌ Error al cargar la imagen."); }
        imgOriginal.src = event.target.result;
    };
    reader.onerror = () => { ocultarCargaGlobal(); alert("❌ Error al leer el archivo."); }
    reader.readAsDataURL(file);
}

document.getElementById('imageInputScan')?.addEventListener('change', async (e) => {
    await window.validateAndProcessFile(e.target, 'png', {
        onSuccess: (file, img) => {
            loadMainImage(file, () => {
                let btn = document.getElementById('btnProcesar');
                if (btn) btn.style.display = 'flex';
            });
        }
    });
});

let tI2 = null, tX2 = null, tI3 = null, tX3 = null;

document.getElementById('modImage')?.addEventListener('change', async (e) => {
    await window.validateAndProcessFile(e.target, 'png', {
        onSuccess: (file, img) => {
            tI2 = file;
            checkDual('EDIT');
        },
        onError: () => {
            tI2 = null;
        }
    });
});

document.getElementById('modXML')?.addEventListener('change', async (e) => {
    await window.validateAndProcessFile(e.target, 'xml', {
        onSuccess: (file, data) => {
            tX2 = file;
            checkDual('EDIT');
        },
        onError: () => {
            tX2 = null;
        }
    });
});

document.getElementById('psychImage')?.addEventListener('change', async (e) => {
    await window.validateAndProcessFile(e.target, 'png', {
        onSuccess: (file, img) => {
            tI3 = file;
            checkDual('PSYCH');
        },
        onError: () => {
            tI3 = null;
        }
    });
});

document.getElementById('psychXML')?.addEventListener('change', async (e) => {
    await window.validateAndProcessFile(e.target, 'xml', {
        onSuccess: (file, data) => {
            tX3 = file;
            checkDual('PSYCH');
        },
        onError: () => {
            tX3 = null;
        }
    });
});

function checkDual(mode) {
    let imgF = mode === 'EDIT' ? tI2 : tI3; let xmlF = mode === 'EDIT' ? tX2 : tX3;
    if (imgF && xmlF) {
        appMode = mode; toggleNavButtons();
        loadMainImage(imgF, () => { let reader = new FileReader(); reader.onload = (e) => { parseSparrowXML(e.target.result); finalizarCargaGeneral(mode); }; reader.readAsText(xmlF); });
    }
}

function parseSparrowXML(xmlString) {
    let parser = new DOMParser(); let xmlDoc = parser.parseFromString(xmlString, "text/xml");
    let subTextures = xmlDoc.getElementsByTagName("SubTexture"); spritesDetectados = [];
    window.lastResizeFactor = 1.0;
    window.totalResizeFactor = 1.0;
    for (let i = 0; i < subTextures.length; i++) {
        let st = subTextures[i]; let w = parseInt(st.getAttribute("width")); let h = parseInt(st.getAttribute("height"));
        let fw = parseInt(st.getAttribute("frameWidth")) || w;
        let fh = parseInt(st.getAttribute("frameHeight")) || h;
        spritesDetectados.push({
            name: st.getAttribute("name"), x: parseInt(st.getAttribute("x")), y: parseInt(st.getAttribute("y")), w: w, h: h,
            frameX: parseInt(st.getAttribute("frameX")) || 0, frameY: parseInt(st.getAttribute("frameY")) || 0,
            frameWidth: fw, frameHeight: fh,
            origFrameWidth: fw, origFrameHeight: fh,
            angle: st.getAttribute("rotated") === "true" ? 90 : 0
        });
    }
}

function finalizarCargaGeneral(mode) {
    if ((mode === 'SCAN' || mode === 'EDIT') && typeof dibujarContornos === 'function') dibujarContornos();
    if (typeof actualizarDropdownFiltros === 'function') actualizarDropdownFiltros();
    if (typeof actualizarDropdownPsych === 'function') actualizarDropdownPsych();
    if (typeof actualizarLabelResolucion === 'function') actualizarLabelResolucion();
    if (mode !== 'PSYCH' && typeof renderTimelineSecuenciador === 'function') renderTimelineSecuenciador();
    currentLoopFrameIdx = 0;
    if (typeof updatePlayerInterval === 'function') updatePlayerInterval();
    if (spritesDetectados.length > 0 && typeof seleccionarFrameAfinador === 'function') seleccionarFrameAfinador(0);
    ocultarCargaGlobal();
    if (mode === 'EDIT') openWindow('win-orden');
    if (mode === 'PSYCH') openWindow('win-psych');

    if (typeof window.autoSaveHistory === 'function') window.autoSaveHistory();
}

window.addEventListener('dragover', (e) => {
    e.preventDefault();
    document.getElementById('dragOverlay').classList.add('active');
});

window.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.clientX === 0 || e.clientY === 0) {
        document.getElementById('dragOverlay').classList.remove('active');
    }
});

window.addEventListener('drop', (e) => {
    e.preventDefault();
    document.getElementById('dragOverlay').classList.remove('active');

    if (e.dataTransfer.files.length > 0) {
        Array.from(e.dataTransfer.files).forEach(file => {
            let ext = file.name.split('.').pop().toLowerCase();

            if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
                if (appMode === 'COMPRESS') {
                    const dt = new DataTransfer(); dt.items.add(file);
                    document.getElementById('imgCompresorUpload').files = dt.files;
                    document.getElementById('imgCompresorUpload').dispatchEvent(new Event('change'));
                } else if (appMode === 'EDIT') {
                    tI2 = file; checkDual('EDIT');
                } else if (appMode === 'PSYCH') {
                    tI3 = file; checkDual('PSYCH');
                } else {
                    loadMainImage(file, () => { document.getElementById('btnProcesar').style.display = 'flex'; });
                }
            } else if (ext === 'xml') {
                if (appMode === 'PSYCH') {
                    tX3 = file; checkDual('PSYCH');
                } else {
                    tX2 = file; checkDual('EDIT');
                }
            } else if (ext === 'ogg' || ext === 'mp3') {
                const dt = new DataTransfer(); dt.items.add(file);
                document.getElementById('audioUpload').files = dt.files;
                document.getElementById('audioUpload').dispatchEvent(new Event('change'));
            } else if (ext === 'json') {
                if (typeof handleAtlasFileDrop === 'function') handleAtlasFileDrop(file);
            }
        });
    }
});

// ==========================================
//  IMÁGENES
// ==========================================
(function initImageLazyLoad() {
    const spinnerCSS = document.createElement('style');
    spinnerCSS.textContent = `
        .img-lazy-wrap {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .img-lazy-wrap img {
            opacity: 0;
            transition: opacity 0.4s ease;
        }
        .img-lazy-wrap img.img-loaded {
            opacity: 1;
        }
        .img-mini-spinner {
            position: absolute;
            border: 2px solid rgba(255,255,255,0.15);
            border-top-color: var(--accent, #00e5ff);
            border-radius: 50%;
            animation: imgSpin 0.7s linear infinite;
        }
        @keyframes imgSpin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(spinnerCSS);

    function wrapImage(img) {
        if (img.closest('.img-lazy-wrap')) return;
        if (img.closest('#globalLoader')) return;
        if (img.closest('.timeline-item')) return;
        if (img.naturalWidth > 0 && img.complete) {
            img.classList.add('img-loaded');
            return;
        }

        const wrap = document.createElement('span');
        wrap.className = 'img-lazy-wrap';

        const spinner = document.createElement('span');
        spinner.className = 'img-mini-spinner';

        let imgW = img.width || img.offsetWidth || 20;
        let imgH = img.height || img.offsetHeight || 20;
        let spinSize = Math.max(10, Math.min(imgW, imgH, 24));
        spinner.style.width = spinSize + 'px';
        spinner.style.height = spinSize + 'px';

        img.parentNode.insertBefore(wrap, img);
        wrap.appendChild(spinner);
        wrap.appendChild(img);

        img.addEventListener('load', function onLoad() {
            img.classList.add('img-loaded');
            if (spinner.parentNode) spinner.remove();
        }, { once: true });

        img.addEventListener('error', function onErr() {
            if (spinner.parentNode) spinner.remove();
            img.style.opacity = '0.3';
        }, { once: true });

        if (img.complete && img.naturalWidth > 0) {
            img.classList.add('img-loaded');
            spinner.remove();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('img:not(.img-loaded)').forEach(wrapImage);
    });

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.tagName === 'IMG') wrapImage(node);
                    else if (node.querySelectorAll) {
                        node.querySelectorAll('img:not(.img-loaded)').forEach(wrapImage);
                    }
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
