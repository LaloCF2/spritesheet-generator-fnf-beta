// ==========================================
// COMPRESOR DE AUDIO OGG
// Varios audios a la vez (hasta 3 sueltos o un .zip con carpetas de canciones).
// Reconoce Inst / Voices (sin importar mayúsculas), pide el nombre de la canción y descarga un .zip
// con la carpeta de la canción: <canción>/Inst.ogg, Voices.ogg o Voices-Player.ogg + Voices-Opponent.ogg.
// ==========================================

var oggFileOriginal = null;          // compatibilidad con el autoguardado (primer audio suelto)
var oggFileName = "audio.ogg";
var oggOriginalSize = 0;

const AUDIO_MAX_SUELTOS = 3;
const AUDIO_MAX_ZIP = 60;
const AUDIO_EXT = ['ogg', 'mp3', 'wav'];
const ROLES_AUDIO = {
    inst: { nombre: 'Inst', etiqueta: 'Inst (instrumental)' },
    voices: { nombre: 'Voices', etiqueta: 'Voices (voces)' },
    'voices-player': { nombre: 'Voices-Player', etiqueta: 'Voices-Player (jugador)' },
    'voices-opponent': { nombre: 'Voices-Opponent', etiqueta: 'Voices-Opponent (oponente)' },
    otro: { nombre: null, etiqueta: 'Otro audio (mismo nombre)' }
};

const audioLote = {
    items: [],               // { id, file, nombre, ruta, grupo, rol, rolAuto, tam, estado, resultado, error, pct, nota }
    grupos: new Map(),       // clave -> { clave, origen: 'suelto'|'zip', ruta: carpeta original, cancion, formatoPsych }
    sigId: 1,
    procesando: false,
    bitrateUsado: null
};

function audioLog(tipo, msg) { if (window.UI) window.UI.log(tipo, msg); }
function audioToast(msg, tipo, ms) { if (window.UI) window.UI.toast(msg, tipo, ms); }
function escAudio(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function fmtTamAudio(b) {
    if (b == null) return '—';
    return b >= 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
}

function extDe(nombre) {
    return nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '';
}

// Inst / Voices / Voices-Player / Voices-Opponent sin importar mayúsculas ("INST.ogg", "voices_player.ogg", "Voices-bf.ogg"...)
function detectarRolAudio(nombre) {
    let base = nombre.replace(/\.[^.]+$/, '').toLowerCase().trim();
    base = base.replace(/\s*\(\d+\)$/, '').replace(/[\s_.]+/g, '-').replace(/-+$/, '');
    if (/^inst(rumental)?(-|$)/.test(base)) return 'inst';
    const voz = base.match(/^(voices?|vocals?)(-.*)?$/);
    if (voz) {
        const resto = voz[2] || '';
        if (/(player|boyfriend|jugador|(^|-)bf($|-)|(^|-)p1($|-))/.test(resto)) return 'voices-player';
        if (/(opponent|oponente|enemy|(^|-)opp($|-)|(^|-)dad($|-)|(^|-)p2($|-))/.test(resto)) return 'voices-opponent';
        return 'voices';
    }
    return 'otro';
}

// Nombre de carpeta como lo busca Psych Engine: minúsculas y guiones ("Dad Battle" -> "dad-battle")
function formatoCarpetaPsych(nombre) {
    return nombre.trim().toLowerCase().replace(/\s+/g, '-').replace(/[\\/:*?"<>|#%]+/g, '').replace(/-+/g, '-');
}

function limpiarNombreCarpeta(nombre) {
    return nombre.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ');
}

function carpetaFinal(g) {
    if (!g.cancion) return '';
    return g.formatoPsych ? formatoCarpetaPsych(g.cancion) : limpiarNombreCarpeta(g.cancion);
}

function itemsDeGrupo(clave) { return audioLote.items.filter(i => i.grupo === clave); }
function grupoEsCancion(clave) { return itemsDeGrupo(clave).some(i => i.rol !== 'otro'); }

// Dos Voices sin especificar -> Voices-Player y Voices-Opponent (el usuario puede cambiarlo)
function resolverRolesGrupo(clave) {
    const voces = itemsDeGrupo(clave).filter(i => i.rolAuto.startsWith('voices'));
    if (voces.length !== 2) return;
    const [a, b] = voces;
    const tiene = (r) => voces.some(v => v.rolAuto === r);
    if (a.rolAuto === 'voices' && b.rolAuto === 'voices') {
        a.rol = 'voices-player'; b.rol = 'voices-opponent';
        a.nota = b.nota = 'Dos Voices: asigné Jugador y Oponente por orden. Revisa que sea correcto.';
    } else if (a.rolAuto === 'voices') {
        a.rol = tiene('voices-player') ? 'voices-opponent' : 'voices-player';
    } else if (b.rolAuto === 'voices') {
        b.rol = tiene('voices-player') ? 'voices-opponent' : 'voices-player';
    }
}

// Nombre final de cada archivo dentro del ZIP (marca choques de nombre)
function rutasDeSalida() {
    const rutas = new Map(), usadas = new Map();
    for (const it of audioLote.items) {
        const g = audioLote.grupos.get(it.grupo);
        let nombre = ROLES_AUDIO[it.rol].nombre || it.nombre.replace(/\.[^.]+$/, '');
        let carpeta;
        if (it.rol !== 'otro') {
            carpeta = carpetaFinal(g);
            // En un .zip se conserva la ruta de arriba (por ejemplo songs/<canción>/)
            if (g.origen === 'zip' && g.ruta.includes('/')) carpeta = g.ruta.split('/').slice(0, -1).join('/') + '/' + carpeta;
        } else {
            carpeta = g.origen === 'zip' ? g.ruta : '';
        }
        let ruta = (carpeta ? carpeta + '/' : '') + nombre + '.ogg';
        if (usadas.has(ruta.toLowerCase())) {
            let n = 2;
            while (usadas.has(ruta.toLowerCase().replace(/\.ogg$/, ` (${n}).ogg`))) n++;
            ruta = ruta.replace(/\.ogg$/, ` (${n}).ogg`);
            it.choque = true;
        } else {
            it.choque = false;
        }
        usadas.set(ruta.toLowerCase(), it);
        rutas.set(it.id, ruta);
    }
    return rutas;
}

// ---------------------------------------------------------------
// IMPORTAR (audios sueltos y .zip)
// ---------------------------------------------------------------
document.getElementById('audioUpload')?.addEventListener('change', async (e) => {
    const inp = e.target;
    const files = inp.files ? [...inp.files] : [];
    inp.value = '';
    if (!files.length) return;
    await audioAgregarArchivos(files);
});

async function decodificarAudio(blob) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    try {
        const ab = await blob.arrayBuffer();
        return await new Promise((res, rej) => ctx.decodeAudioData(ab, res, () => rej(new Error('No se pudo decodificar el audio: el archivo está dañado o el códec no es compatible.'))));
    } finally {
        if (ctx.close) ctx.close().catch(() => { });
    }
}

async function audioAgregarArchivos(files) {
    if (audioLote.procesando) return audioToast('Espera a que termine la compresión actual.', 'warn');
    const btn = document.getElementById('btnSubirAudio');
    const zips = files.filter(f => extDe(f.name) === 'zip');
    const audios = files.filter(f => extDe(f.name) !== 'zip');
    let agregados = 0, errores = [], avisos = [];
    const gruposAntes = new Map([...audioLote.grupos.keys()].map(k => [k, itemsDeGrupo(k).length]));

    showLoader("COMPRESOR DE AUDIO", "Revisando los archivos...");
    await pensar(60);

    // --- audios sueltos (máximo 3 en total) ---
    const sueltosActuales = audioLote.items.filter(i => audioLote.grupos.get(i.grupo).origen === 'suelto').length;
    let libres = AUDIO_MAX_SUELTOS - sueltosActuales;
    for (const f of audios) {
        if (libres <= 0) { avisos.push(`«${f.name}» no se agregó: máximo ${AUDIO_MAX_SUELTOS} audios sueltos a la vez (usa un .zip para más).`); continue; }
        const ext = extDe(f.name);
        if (!AUDIO_EXT.includes(ext)) { errores.push(`«${f.name}»: formato .${ext || '?'} no compatible (usa .ogg, .mp3, .wav o .zip).`); continue; }
        if (f.size === 0) { errores.push(`«${f.name}»: el archivo está vacío (0 bytes).`); continue; }
        if (audioLote.items.some(i => i.file === f || (i.nombre === f.name && i.tam === f.size && audioLote.grupos.get(i.grupo).origen === 'suelto'))) {
            avisos.push(`«${f.name}» ya estaba en la lista.`); continue;
        }
        try {
            showLoader("COMPRESOR DE AUDIO", `Revisando «${escAudio(f.name)}»...`);
            await decodificarAudio(f);
        } catch (err) {
            errores.push(`«${f.name}»: ${err.message}`);
            continue;
        }
        if (!audioLote.grupos.has('suelto')) audioLote.grupos.set('suelto', { clave: 'suelto', origen: 'suelto', ruta: '', cancion: '', formatoPsych: true });
        agregarItem(f, f.name, '', 'suelto');
        if (!oggFileOriginal) { oggFileOriginal = f; oggFileName = f.name; oggOriginalSize = f.size; }
        libres--; agregados++;
    }

    // --- .zip con carpetas de canciones ---
    for (const z of zips) {
        try {
            showLoader("COMPRESOR DE AUDIO", `Abriendo «${escAudio(z.name)}»...`);
            const r = await leerZipAudios(z);
            agregados += r.agregados;
            avisos.push(...r.avisos);
        } catch (err) {
            errores.push(`«${z.name}»: ${err.message}`);
        }
    }

    ocultarCargaGlobal();
    // Solo se reasignan Jugador / Oponente en los grupos que recibieron audios nuevos
    for (const k of audioLote.grupos.keys()) {
        if (gruposAntes.get(k) !== itemsDeGrupo(k).length) resolverRolesGrupo(k);
    }
    renderAudioLista();

    if (btn && typeof window.setImportButtonState === 'function') {
        window.setImportButtonState(btn, agregados ? 'success' : (errores.length ? 'error' : 'reset'));
    }
    errores.forEach(m => audioLog('err', m));
    avisos.forEach(m => audioLog('warn', m));
    if (errores.length) {
        alert({ type: 'err', title: errores.length === 1 ? 'Un archivo no se pudo agregar' : `${errores.length} archivos no se pudieron agregar`, body: errores.join('\n') + (avisos.length ? '\n' + avisos.join('\n') : '') });
    } else if (avisos.length) {
        alert({ type: 'warn', title: 'Revisa estos avisos', body: avisos.join('\n') });
    }
    if (agregados) {
        audioLog('ok', `${agregados} audio(s) agregados a la lista`);
        detectarBpmDelLote();
        if (typeof window.autoSaveHistory === 'function') window.autoSaveHistory();
        // Si hay Inst / Voices sueltos sin nombre de canción, se pregunta
        const gs = audioLote.grupos.get('suelto');
        if (gs && !gs.cancion && grupoEsCancion('suelto')) await pedirNombreCancion('suelto');
    }
}

function agregarItem(file, nombre, ruta, grupo) {
    const rol = detectarRolAudio(nombre);
    audioLote.items.push({ id: audioLote.sigId++, file, nombre, ruta, grupo, rol, rolAuto: rol, tam: file.size, estado: 'pendiente', resultado: null, error: null, pct: 0, nota: '' });
}

async function leerZipAudios(zipFile) {
    if (typeof JSZip === 'undefined') throw new Error('no se pudo cargar el lector de .zip (revisa tu conexión).');
    let zip;
    try { zip = await JSZip.loadAsync(zipFile); } catch (err) { throw new Error('el .zip está dañado o no es un .zip válido.'); }
    const entradas = Object.values(zip.files).filter(f => !f.dir && !/(^|\/)(__MACOSX|\.)/.test(f.name));
    const audios = entradas.filter(f => AUDIO_EXT.includes(extDe(f.name)));
    const otros = entradas.length - audios.length;
    const avisos = [];
    if (!audios.length) throw new Error('no tiene audios .ogg, .mp3 ni .wav adentro.');
    if (otros) avisos.push(`«${zipFile.name}»: se ignoraron ${otros} archivo(s) que no son audio.`);
    const total = audioLote.items.filter(i => audioLote.grupos.get(i.grupo).origen === 'zip').length;
    let lista = audios;
    if (total + audios.length > AUDIO_MAX_ZIP) {
        lista = audios.slice(0, Math.max(0, AUDIO_MAX_ZIP - total));
        avisos.push(`«${zipFile.name}»: solo se agregaron ${lista.length} audios (máximo ${AUDIO_MAX_ZIP} desde .zip a la vez).`);
    }
    let agregados = 0;
    const base = zipFile.name.replace(/\.zip$/i, '');
    for (const ent of lista) {
        const partes = ent.name.split('/');
        const nombre = partes.pop();
        const ruta = partes.join('/');
        const clave = 'zip:' + zipFile.name + ':' + ruta;
        if (!audioLote.grupos.has(clave)) {
            const cancion = partes.length ? partes[partes.length - 1] : (detectarRolAudio(nombre) !== 'otro' ? base : '');
            audioLote.grupos.set(clave, { clave, origen: 'zip', ruta, cancion, zip: zipFile.name, formatoPsych: false });
        }
        const blob = await ent.async('blob');
        if (!blob.size) { avisos.push(`«${ent.name}» está vacío y se ignoró.`); continue; }
        agregarItem(blob, nombre, ruta, clave);
        agregados++;
    }
    audioLog('info', `«${zipFile.name}»: ${agregados} audio(s) en ${new Set(lista.map(e => e.name.split('/').slice(0, -1).join('/'))).size} carpeta(s)`);
    return { agregados, avisos };
}

function quitarAudio(id) {
    if (audioLote.procesando) return;
    const it = audioLote.items.find(i => i.id === id);
    audioLote.items = audioLote.items.filter(i => i.id !== id);
    for (const [k] of audioLote.grupos) if (!itemsDeGrupo(k).length) audioLote.grupos.delete(k);
    if (it && it.file === oggFileOriginal) oggFileOriginal = null;
    audioLog('info', `Se quitó «${it ? it.nombre : ''}» de la lista`);
    renderAudioLista();
}

function limpiarAudios() {
    if (audioLote.procesando) return;
    audioLote.items = [];
    audioLote.grupos.clear();
    oggFileOriginal = null;
    document.getElementById('txtAudioBPM').textContent = '---';
    const btn = document.getElementById('btnSubirAudio');
    if (btn && typeof window.setImportButtonState === 'function') window.setImportButtonState(btn, 'reset');
    renderAudioLista();
}

// ---------------------------------------------------------------
// NOMBRE DE LA CANCIÓN (ventana)
// ---------------------------------------------------------------
function pedirNombreCancion(clave) {
    const g = audioLote.grupos.get(clave);
    if (!g) return Promise.resolve(null);
    const archivos = itemsDeGrupo(clave).filter(i => i.rol !== 'otro');
    return new Promise((resolve) => {
        const ov = document.createElement('div');
        ov.className = 'ui-log-overlay';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.innerHTML = `
            <div class="ui-log-card t-info au-modal">
                <div class="ui-log-head">
                    <div class="ui-log-icon">🎵</div>
                    <div style="min-width:0;">
                        <span class="ui-log-tag">[CANCIÓN] Compresor de Audio</span>
                        <div class="ui-log-title">¿Cómo se llama la canción?</div>
                    </div>
                </div>
                <div class="ui-log-body" style="white-space:normal;">
                    Detecté ${archivos.map(i => `<b>${escAudio(i.nombre)}</b>`).join(', ')}. Se guardarán en una carpeta con el nombre de la canción dentro del ZIP.
                    <input type="text" class="au-modal-input" maxlength="80" placeholder="Ej. Dad Battle" value="${escAudio(g.cancion || '')}" aria-label="Nombre de la canción">
                    <label class="au-modal-check"><input type="checkbox" ${g.formatoPsych ? 'checked' : ''}> Carpeta con formato de Psych Engine (minúsculas y guiones)</label>
                    <div class="au-modal-prev"></div>
                </div>
                <div class="ui-log-actions">
                    <button type="button" class="ui-btn-ghost" data-act="no">Después</button>
                    <button type="button" class="ui-btn-main" data-act="ok">Guardar nombre</button>
                </div>
            </div>`;
        const input = ov.querySelector('.au-modal-input');
        const check = ov.querySelector('.au-modal-check input');
        const prev = ov.querySelector('.au-modal-prev');
        const pintar = () => {
            const tmp = { cancion: input.value, formatoPsych: check.checked };
            const carpeta = input.value.trim() ? carpetaFinal(tmp) : '…';
            prev.innerHTML = `📁 <b>${escAudio(carpeta)}/</b> ${archivos.map(i => escAudio(ROLES_AUDIO[i.rol].nombre + '.ogg')).join(' · ')}`;
        };
        const cerrar = (valor) => {
            document.removeEventListener('keydown', onKey, true);
            ov.remove();
            resolve(valor);
        };
        const guardar = () => {
            const v = input.value.trim();
            if (!v || !carpetaFinal({ cancion: v, formatoPsych: check.checked })) {
                input.classList.add('au-input-error');
                input.focus();
                return;
            }
            g.cancion = v;
            g.formatoPsych = check.checked;
            audioLog('ok', `Canción: «${v}» → carpeta ${carpetaFinal(g)}/`);
            renderAudioLista();
            cerrar(v);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); cerrar(null); }
            if (e.key === 'Enter') { e.preventDefault(); guardar(); }
        };
        input.addEventListener('input', () => { input.classList.remove('au-input-error'); pintar(); });
        check.addEventListener('change', pintar);
        ov.addEventListener('click', (e) => {
            const act = e.target.getAttribute && e.target.getAttribute('data-act');
            if (act === 'ok') guardar();
            if (act === 'no' || e.target === ov) cerrar(null);
        });
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(ov);
        pintar();
        setTimeout(() => input.focus(), 50);
    });
}

// ---------------------------------------------------------------
// LISTA
// ---------------------------------------------------------------
function renderAudioLista() {
    const cont = document.getElementById('audioLista');
    if (!cont) return;
    const btnRun = document.getElementById('btnRunAudio');
    const btnDown = document.getElementById('btnDownloadAudio');
    const btnClear = document.getElementById('btnLimpiarAudio');
    if (!audioLote.items.length) {
        cont.innerHTML = '<div class="au-vacio">Aún no hay audios. Sube hasta 3 (.ogg / .mp3) o un .zip con carpetas de canciones.</div>';
        if (btnRun) btnRun.style.display = 'none';
        if (btnDown) btnDown.style.display = 'none';
        if (btnClear) btnClear.style.display = 'none';
        actualizarTotalesAudio();
        return;
    }
    const rutas = rutasDeSalida();
    let html = '';
    for (const [clave, g] of audioLote.grupos) {
        const items = itemsDeGrupo(clave);
        if (!items.length) continue;
        const esCancion = grupoEsCancion(clave);
        const titulo = g.origen === 'zip' ? `📦 ${escAudio(g.zip)}${g.ruta ? ' › ' + escAudio(g.ruta) : ''}` : '🎧 Audios sueltos';
        html += `<div class="au-grupo">`;
        html += `<div class="au-grupo-head"><span class="au-grupo-tit">${titulo}</span>`;
        if (esCancion) {
            const carpeta = carpetaFinal(g);
            html += `<div class="au-cancion">
                <label>Canción<input type="text" data-cancion="${escAudio(clave)}" value="${escAudio(g.cancion || '')}" placeholder="Nombre de la canción" ${audioLote.procesando ? 'disabled' : ''}></label>
                <label class="au-check"><input type="checkbox" data-formato="${escAudio(clave)}" ${g.formatoPsych ? 'checked' : ''} ${audioLote.procesando ? 'disabled' : ''}> formato Psych</label>
                <span class="au-carpeta ${carpeta ? '' : 'au-falta'}">${carpeta ? '📁 ' + escAudio(carpeta) + '/' : '⚠ Falta el nombre'}</span>
            </div>`;
        }
        html += `</div>`;
        for (const it of items) {
            const ruta = rutas.get(it.id);
            const opciones = Object.keys(ROLES_AUDIO).map(r => `<option value="${r}" ${r === it.rol ? 'selected' : ''}>${ROLES_AUDIO[r].etiqueta}</option>`).join('');
            let estado = '';
            if (it.estado === 'comprimiendo') estado = `<span class="au-estado au-run"><span class="rs-spin"></span> ${it.pct}%</span>`;
            else if (it.estado === 'listo') estado = `<span class="au-estado au-ok">✓ ${fmtTamAudio(it.resultado.size)} (−${Math.max(0, Math.round((1 - it.resultado.size / it.tam) * 100))}%)</span>`;
            else if (it.estado === 'original') estado = `<span class="au-estado au-warn" title="${escAudio(it.nota)}">= se dejó el original</span>`;
            else if (it.estado === 'error') estado = `<span class="au-estado au-err" title="${escAudio(it.error || '')}">✕ error</span>`;
            else estado = '<span class="au-estado">pendiente</span>';
            html += `<div class="au-item au-${it.estado}">
                <div class="au-item-main">
                    <span class="au-nombre" title="${escAudio(it.ruta ? it.ruta + '/' + it.nombre : it.nombre)}">${escAudio(it.nombre)}</span>
                    <span class="au-tam">${fmtTamAudio(it.tam)}</span>
                    ${estado}
                </div>
                <div class="au-item-sub">
                    <select data-rol="${it.id}" aria-label="Tipo de audio" ${audioLote.procesando ? 'disabled' : ''}>${opciones}</select>
                    <span class="au-destino">→ ${escAudio(ruta)}</span>
                    <button type="button" class="au-quitar" data-quitar="${it.id}" title="Quitar" ${audioLote.procesando ? 'disabled' : ''}>✕</button>
                </div>
                ${it.nota ? `<div class="au-nota">⚠ ${escAudio(it.nota)}</div>` : ''}
                ${it.choque ? '<div class="au-nota">⚠ Dos archivos tendrían el mismo nombre: revisa el tipo de cada uno.</div>' : ''}
                ${it.estado === 'error' ? `<div class="au-nota au-nota-err">${escAudio(it.error || '')}</div>` : ''}
            </div>`;
        }
        html += `</div>`;
    }
    cont.innerHTML = html;
    if (btnRun) btnRun.style.display = audioLote.procesando ? 'none' : 'block';
    if (btnClear) btnClear.style.display = audioLote.procesando ? 'none' : 'inline-flex';
    const hechos = audioLote.items.filter(i => i.estado === 'listo' || i.estado === 'original').length;
    if (btnDown) btnDown.style.display = hechos && !audioLote.procesando ? 'block' : 'none';
    actualizarTotalesAudio();
}

function actualizarTotalesAudio() {
    const orig = audioLote.items.reduce((s, i) => s + i.tam, 0);
    const hechos = audioLote.items.filter(i => i.estado === 'listo' || i.estado === 'original');
    const nuevo = hechos.reduce((s, i) => s + (i.estado === 'listo' ? i.resultado.size : i.tam), 0);
    document.getElementById('txtAudioOrigSize').textContent = audioLote.items.length ? fmtTamAudio(orig) : '--- MB';
    document.getElementById('txtAudioNewSize').textContent = hechos.length ? fmtTamAudio(nuevo) : '--- MB';
    const det = document.getElementById('txtAudioDetalle');
    if (det) {
        if (!audioLote.items.length) det.textContent = 'Sin audios.';
        else if (!hechos.length) det.textContent = `${audioLote.items.length} audio(s) listos para comprimir.`;
        else {
            const origHechos = hechos.reduce((s, i) => s + i.tam, 0);
            det.textContent = `${hechos.length} de ${audioLote.items.length} comprimidos · ahorro ${Math.max(0, Math.round((1 - nuevo / origHechos) * 100))}%`;
        }
    }
}

document.getElementById('audioLista')?.addEventListener('input', (e) => {
    const clave = e.target.dataset.cancion;
    if (clave === undefined) return;
    const g = audioLote.grupos.get(clave);
    if (!g) return;
    g.cancion = e.target.value;
    const head = e.target.closest('.au-grupo');
    const carpeta = carpetaFinal(g);
    const lbl = head && head.querySelector('.au-carpeta');
    if (lbl) { lbl.textContent = carpeta ? '📁 ' + carpeta + '/' : '⚠ Falta el nombre'; lbl.classList.toggle('au-falta', !carpeta); }
    const rutas = rutasDeSalida();
    head.querySelectorAll('[data-rol]').forEach(sel => {
        const d = sel.parentElement.querySelector('.au-destino');
        if (d) d.textContent = '→ ' + rutas.get(Number(sel.dataset.rol));
    });
});

document.getElementById('audioLista')?.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.rol) {
        const it = audioLote.items.find(i => i.id === Number(t.dataset.rol));
        if (!it) return;
        it.rol = t.value;
        it.nota = '';
        audioLog('info', `«${it.nombre}» se guardará como ${ROLES_AUDIO[it.rol].nombre || 'su mismo nombre'}`);
        renderAudioLista();
    } else if (t.dataset.formato !== undefined) {
        const g = audioLote.grupos.get(t.dataset.formato);
        if (g) { g.formatoPsych = t.checked; renderAudioLista(); }
    } else if (t.dataset.cancion !== undefined) {
        renderAudioLista();
    }
});

document.getElementById('audioLista')?.addEventListener('click', (e) => {
    const q = e.target.closest('[data-quitar]');
    if (q) quitarAudio(Number(q.dataset.quitar));
});

// ---------------------------------------------------------------
// BPM (del Inst, o del primer audio)
// ---------------------------------------------------------------
async function detectarBpmDelLote() {
    const it = audioLote.items.find(i => i.rol === 'inst') || audioLote.items[0];
    const lbl = document.getElementById('txtAudioBPM');
    if (!it || !lbl) return;
    lbl.textContent = 'Calculando...';
    try {
        analizarBufferBPM(await decodificarAudio(it.file));
    } catch (err) {
        lbl.textContent = '---';
    }
}

function analizarBufferBPM(buffer) {
    try {
        const data = buffer.getChannelData(0);
        let peaks = [];
        let threshold = 0.8;
        let step = Math.round(buffer.sampleRate * 0.05);

        for (let i = 0; i < data.length; i += step) {
            if (data[i] > threshold) {
                peaks.push(i / buffer.sampleRate);
            }
        }

        if (peaks.length < 2) {
            document.getElementById('txtAudioBPM').textContent = "---";
            return;
        }

        let intervals = {};
        for (let i = 1; i < peaks.length; i++) {
            let interval = Math.round((peaks[i] - peaks[i - 1]) * 100) / 100;
            if (interval > 0.2 && interval < 2.0) {
                intervals[interval] = (intervals[interval] || 0) + 1;
            }
        }

        let mostCommon = null;
        let maxCount = 0;
        for (let k in intervals) {
            if (intervals[k] > maxCount) {
                maxCount = intervals[k];
                mostCommon = parseFloat(k);
            }
        }

        if (mostCommon) {
            let bpm = Math.round(60 / mostCommon);
            while (bpm < 90) bpm *= 2;
            while (bpm > 180) bpm /= 2;
            document.getElementById('txtAudioBPM').textContent = Math.round(bpm) + " BPM";
        } else {
            document.getElementById('txtAudioBPM').textContent = "---";
        }
    } catch (e) {
        document.getElementById('txtAudioBPM').textContent = "---";
    }
}

// Compatibilidad con el autoguardado (restaura un audio)
function detectBPM(file) {
    if (file && !audioLote.items.some(i => i.file === file)) audioAgregarArchivos([file]);
}

// ---------------------------------------------------------------
// MOTOR FFMPEG
// ---------------------------------------------------------------
let audioProgresoActual = null;   // item que se está comprimiendo (para la barra de progreso)

async function cargarMotorFFmpeg() {
    if (window.ffmpegInstance) return window.ffmpegInstance;
    if (!window.FFmpegWASM || !window.FFmpegUtil) throw new Error("No se pudo cargar el motor de audio. Revisa tu conexión a internet y recarga la página.");
    const { FFmpeg } = window.FFmpegWASM;
    const { toBlobURL } = window.FFmpegUtil;
    const ff = new FFmpeg();
    ff.on('progress', ({ progress }) => {
        const it = audioProgresoActual;
        if (!it) return;
        const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
        if (pct === it.pct) return;
        it.pct = pct;
        const txt = document.getElementById('globalLoaderText');
        if (txt) {
            txt.innerHTML = `
                <div style="font-size:0.9rem; color:#aaa; margin-bottom:5px;">${escAudio(it.etiquetaProgreso || '')}</div>
                <div style="font-size:2.5rem; font-weight:900; color:#ffaa00; text-shadow: 0 0 10px rgba(255,170,0,0.5);">${pct}%</div>
                <div style="font-size:0.8rem; color:#fff; margin-top:5px;">${escAudio(it.nombre)}</div>`;
        }
    });
    // El worker de FFmpeg 0.12 se crea como módulo: ahí no existe importScripts y el núcleo
    // se carga con import(), por lo que el núcleo DEBE ser la versión ESM (la UMD falla con
    // "failed to import ffmpeg-core.js"). El worker sí es el UMD autocontenido (814.ffmpeg.js).
    const coreBaseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
    const ffmpegURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd';
    try {
        showLoader("MOTOR DE AUDIO", "Descargando motor FFmpeg (~31 MB, solo la primera vez)...<br><br><span style='font-size:0.8rem;color:#ffaa00;'>Puede tardar según tu conexión. ¡No cierres la página!</span>");
        const coreURL = await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm');
        const classWorkerURL = await toBlobURL(`${ffmpegURL}/814.ffmpeg.js`, 'text/javascript');
        showLoader("MOTOR DE AUDIO", "Iniciando motor FFmpeg...");
        await Promise.race([
            ff.load({ coreURL, wasmURL, classWorkerURL }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("El motor tardó más de 60 segundos en iniciar.")), 60000))
        ]);
    } catch (err) {
        try { ff.terminate(); } catch (e) { }
        throw new Error("No se pudo iniciar el motor de audio: " + (err && err.message ? err.message : err) + "\nRevisa tu conexión a internet (el motor se descarga la primera vez).");
    }
    window.ffmpegInstance = ff;
    audioLog('ok', 'Motor de audio FFmpeg listo');
    return ff;
}

async function comprimirUnAudio(ff, it, bitrate, n) {
    const { fetchFile } = window.FFmpegUtil;
    const ext = extDe(it.nombre) || 'ogg';
    const entrada = `in_${n}.${ext}`, salida = `out_${n}.ogg`;
    await ff.writeFile(entrada, await fetchFile(it.file));
    try {
        // -vn: ignora portadas de los .mp3 (si no, FFmpeg intenta meter una imagen en el .ogg y falla)
        const code = await ff.exec(['-i', entrada, '-vn', '-c:a', 'libvorbis', '-b:a', bitrate, salida]);
        if (code !== 0 && code !== undefined) throw new Error(`FFmpeg terminó con código ${code} (el audio puede estar dañado).`);
        const data = await ff.readFile(salida);
        if (!data || !data.length) throw new Error('FFmpeg no generó audio (el archivo puede estar dañado).');
        return new Blob([data.buffer], { type: 'audio/ogg' });
    } finally {
        try { await ff.deleteFile(entrada); } catch (e) { }
        try { await ff.deleteFile(salida); } catch (e) { }
    }
}

function bitrateElegido() {
    const r = [...document.getElementsByName('oggQuality')].find(x => x.checked);
    return r ? r.value : '128k';
}

async function ejecutarCompresionAudio() {
    if (audioLote.procesando) return;
    if (!audioLote.items.length) return alert("⚠️ Sube un audio primero (.OGG, .MP3) o un .ZIP con canciones.");

    // Nombre de canción para cada grupo con Inst / Voices
    for (const [clave, g] of audioLote.grupos) {
        if (grupoEsCancion(clave) && !carpetaFinal(g)) {
            const nombre = await pedirNombreCancion(clave);
            if (!nombre) {
                audioLog('warn', 'Compresión cancelada: falta el nombre de la canción');
                return alert("⚠️ Falta el nombre de la canción.\nEscríbelo para que los audios se guarden en su carpeta (por ejemplo dad-battle/Inst.ogg).");
            }
        }
    }
    rutasDeSalida();
    if (audioLote.items.some(i => i.choque)) {
        audioLog('warn', 'Hay audios que terminarían con el mismo nombre');
        alert("⚠️ Dos audios terminarían con el mismo nombre.\nSe guardarán con (2) al final; si no es lo que quieres, cambia el tipo de alguno en la lista.");
    }

    // Con otra calidad se recomprime todo; con la misma, solo lo que falta o falló
    const bitrate = bitrateElegido();
    const cambioCalidad = audioLote.bitrateUsado !== bitrate;
    audioLote.bitrateUsado = bitrate;
    const pendientes = audioLote.items.filter(i => cambioCalidad || (i.estado !== 'listo' && i.estado !== 'original'));
    if (!pendientes.length) return alert(`💡 Todos los audios ya están comprimidos a ${bitrate}bps. Toca «${textoBotonDescarga()}» o elige otra calidad.`);
    audioLote.procesando = true;
    pendientes.forEach(i => { i.estado = 'pendiente'; i.resultado = null; i.error = null; i.pct = 0; });
    renderAudioLista();
    audioLog('step', `Comprimiendo ${pendientes.length} audio(s) a ${bitrate}bps`);

    let ff;
    try {
        showLoader("MOTOR DE AUDIO", "Cargando motor FFmpeg en el navegador...");
        ff = await cargarMotorFFmpeg();
    } catch (err) {
        audioLote.procesando = false;
        renderAudioLista();
        ocultarCargaGlobal();
        audioLog('err', err.message);
        return alert({ type: 'err', title: 'No se pudo iniciar el motor de audio', body: err.message + "\n\nIntenta recargar la página, abrirla en incógnito o cambiar de navegador si el problema sigue." });
    }

    let n = 0, ok = 0, originales = 0, fallos = 0;
    for (const it of pendientes) {
        n++;
        it.estado = 'comprimiendo';
        it.pct = 0;
        it.etiquetaProgreso = `Audio ${n} de ${pendientes.length}`;
        audioProgresoActual = it;
        renderAudioLista();
        showLoader("COMPRIMIENDO AUDIO", `Audio ${n} de ${pendientes.length}: ${escAudio(it.nombre)}`);
        try {
            const blob = await comprimirUnAudio(ff, it, bitrate, n);
            if (blob.size >= it.tam && extDe(it.nombre) === 'ogg') {
                // Ya estaba más comprimido: recomprimir solo empeoraría la calidad
                it.estado = 'original';
                it.resultado = it.file;
                it.nota = `Ya pesaba menos (${fmtTamAudio(it.tam)}) que comprimido a ${bitrate}bps (${fmtTamAudio(blob.size)}): se dejó el original.`;
                originales++;
                audioLog('warn', `«${it.nombre}»: ${it.nota}`);
            } else {
                it.estado = 'listo';
                it.resultado = blob;
                ok++;
                audioLog('ok', `«${it.nombre}»: ${fmtTamAudio(it.tam)} → ${fmtTamAudio(blob.size)}`);
            }
        } catch (err) {
            it.estado = 'error';
            it.error = (err && err.message) || String(err);
            fallos++;
            audioLog('err', `«${it.nombre}»: ${it.error}`);
        }
        audioProgresoActual = null;
    }
    audioLote.procesando = false;
    ocultarCargaGlobal();
    renderAudioLista();

    const hechos = audioLote.items.filter(i => i.estado === 'listo' || i.estado === 'original');
    if (!hechos.length) {
        return alert({ type: 'err', title: 'No se pudo comprimir ningún audio', body: audioLote.items.filter(i => i.error).map(i => `${i.nombre}: ${i.error}`).join('\n') });
    }
    const antes = hechos.reduce((s, i) => s + i.tam, 0), despues = hechos.reduce((s, i) => s + i.resultado.size, 0);
    let msg = `${fallos ? '⚠️' : '✅'} ¡Compresión terminada!\n` +
        `• ${ok} audio(s) comprimidos${originales ? `, ${originales} se dejaron igual (ya pesaban menos)` : ''}${fallos ? `, ${fallos} con error` : ''}.\n` +
        `• Peso: ${fmtTamAudio(antes)} → ${fmtTamAudio(despues)} (−${Math.max(0, Math.round((1 - despues / antes) * 100))}%).\n` +
        `• Toca «${textoBotonDescarga()}» para guardarlos.`;
    if (fallos) msg += `\n• Errores: ${audioLote.items.filter(i => i.estado === 'error').map(i => i.nombre).join(', ')} (detalles en la lista).`;
    alert(msg);
    if (typeof window.autoSaveHistory === 'function') window.autoSaveHistory();
}

// ---------------------------------------------------------------
// DESCARGA (un .ogg o un .zip con las carpetas de las canciones)
// ---------------------------------------------------------------
function planDescarga() {
    const hechos = audioLote.items.filter(i => i.estado === 'listo' || i.estado === 'original');
    const soloUnoSuelto = hechos.length === 1 && audioLote.items.length === 1 && hechos[0].rol === 'otro' &&
        audioLote.grupos.get(hechos[0].grupo).origen === 'suelto';
    const carpetas = [...new Set(hechos.filter(i => i.rol !== 'otro').map(i => carpetaFinal(audioLote.grupos.get(i.grupo))))];
    const nombreZip = (carpetas.length === 1 && hechos.every(i => i.rol !== 'otro') ? carpetas[0] : 'audios_optimizados') + '.zip';
    return { hechos, soloUnoSuelto, nombreZip };
}

function textoBotonDescarga() {
    const p = planDescarga();
    return p.soloUnoSuelto ? 'Descargar audio' : `Descargar ${p.nombreZip}`;
}

async function descargarAudios() {
    const p = planDescarga();
    if (!p.hechos.length) return alert("⚠️ Primero comprime los audios.");
    const descargar = (blob, nombre) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };
    if (p.soloUnoSuelto) {
        const it = p.hechos[0];
        const bitrate = audioLote.bitrateUsado || '128k';
        const sufijo = bitrate === '48k' ? '_max' : bitrate === '80k' ? '_equil' : '_opt';
        descargar(it.resultado, it.nombre.replace(/\.[^/.]+$/, '') + sufijo + '.ogg');
        audioLog('ok', 'Audio descargado');
        return;
    }
    showLoader("COMPRESOR DE AUDIO", "Armando el .zip...");
    try {
        const rutas = rutasDeSalida();
        const zip = new JSZip();
        for (const it of p.hechos) zip.file(rutas.get(it.id), it.resultado);
        const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
        descargar(blob, p.nombreZip);
        ocultarCargaGlobal();
        const lista = p.hechos.map(i => rutas.get(i.id)).join('\n');
        audioLog('ok', `ZIP descargado: ${p.nombreZip}`);
        alert(`✅ ZIP descargado: ${p.nombreZip}\nAl descomprimirlo tendrás:\n${lista}`);
    } catch (err) {
        ocultarCargaGlobal();
        audioLog('err', 'No se pudo crear el ZIP: ' + err.message);
        alert({ type: 'err', title: 'No se pudo crear el ZIP', detail: String(err.message || err) });
    }
}

document.getElementById('btnDownloadAudio')?.addEventListener('click', descargarAudios);

window.audioAgregarArchivos = audioAgregarArchivos;
window.ejecutarCompresionAudio = ejecutarCompresionAudio;
window.limpiarAudios = limpiarAudios;
window.audioLote = audioLote;

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderAudioLista);
else renderAudioLista();
