/**
 * Spritesheet Generator FNF' · Interfaz unificada (ui.js)
 *
 * Se carga en el <head> de TODAS las herramientas (después de css/ui.css).
 *  1. Registro de herramientas: color propio, icono, título, descripción y pasos de cada una.
 *  2. Cabecera unificada en la ventana principal (sustituye los títulos sueltos de cada página).
 *  3. Botones de subir archivo con el mismo estilo de "zona de carga".
 *  4. Sistema de logs: tarjetas de mensaje (en lugar de alert), avisos flotantes y la consola
 *     "Registro de actividad" con hora y etiquetas, que se conserva al pasar de una herramienta a otra.
 */
(function () {
    'use strict';

    const PAGE = (location.pathname.split('/').pop() || 'index.html').replace(/\.html?$/i, '') || 'index';

    // Colores por familia de herramientas (la forma es la misma; el color identifica la herramienta)
    const C = {
        home: ['#6c5ce7', '#ff7eb3'],
        scan: ['#0984e3', '#00cec9'],
        opt: ['#6c5ce7', '#a29bfe'],
        psych: ['#20bf6b', '#a3e635'],
        png: ['#a55eea', '#ff7eb3'],
        audio: ['#ff9f1a', '#ff6b6b'],
        atlas: ['#ff4757', '#ff7eb3'],
        gif: ['#00b8d9', '#6c5ce7'],
        astc: ['#00c896', '#00b8d9']
    };

    const TOOLS = {
        index: {
            c: C.home, icon: '🎤', kicker: 'Caja de herramientas para mods de FNF',
            title: 'Spritesheet Generator <span class="ui-grad">FNF\'</span>',
            name: 'Inicio',
            desc: 'Elige una herramienta. Todo se procesa en tu propio navegador: tus archivos no se suben a ningún servidor.',
            win: '#win-home'
        },
        escaner: {
            c: C.scan, icon: '🔍', kicker: 'Sprites · XML', name: 'Escáner de Cero',
            title: 'Escáner <span class="ui-grad">de Cero</span>',
            desc: 'Detecta automáticamente cada sprite de una hoja PNG y genera su archivo XML para el personaje.',
            steps: ['Sube tu hoja PNG', 'Ajusta la detección', 'Exporta el XML'], win: '#win-escaner'
        },
        optimizador: {
            c: C.opt, icon: '🛠️', kicker: 'Sprites · XML · JSON', name: 'Optimizador',
            title: '<span class="ui-grad">Optimizador</span> de Sprites',
            desc: 'Ordena, corrige y deduplica frames de un PNG + XML, reduce la resolución y ajusta el JSON de Psych Engine.',
            steps: ['Sube PNG + XML', 'Edita y optimiza', 'Empaqueta el ZIP'], win: '#win-orden'
        },
        psych: {
            c: C.psych, icon: '🎭', kicker: 'Psych Engine · JSON', name: 'Psych Character Builder',
            title: 'Psych <span class="ui-grad">Character Builder</span>',
            desc: 'Visualiza y alinea las animaciones del personaje en vivo para generar su .json sin abrir el Character Editor.',
            steps: ['Sube PNG + XML', 'Alinea las animaciones', 'Genera el JSON'], win: '#win-psych'
        },
        compresor: {
            c: C.png, icon: '🗜️', kicker: 'Imágenes · PNG', name: 'Compresor PNG',
            title: 'Compresor <span class="ui-grad">PNG</span>',
            desc: 'Reduce el peso de tus PNG como TinyPNG: elige la mejor paleta de colores y protege los detalles.',
            steps: ['Sube tu PNG', 'Elige el nivel', 'Descarga'], win: '#win-compresor'
        },
        audio: {
            c: C.audio, icon: '🎵', kicker: 'Audio · OGG', name: 'Compresor de Audio',
            title: 'Compresor de <span class="ui-grad">Audio OGG</span>',
            desc: 'Reduce el peso de tus canciones y voces (hasta 3 a la vez o un .zip). Reconoce Inst y Voices y las guarda en la carpeta de la canción.',
            steps: ['Sube audios o un .zip', 'Elige la calidad', 'Descarga OGG o ZIP'], win: '#win-audio'
        },
        atlas: {
            c: C.atlas, icon: '🧩', kicker: 'Adobe Animate · Atlas', name: 'Conversor Animate Atlas',
            title: 'Conversor <span class="ui-grad">Animate Atlas</span>',
            desc: 'Convierte un Texture Atlas de Adobe Animate (Animation.json + spritemap) y optimiza su resolución.',
            steps: ['Sube los archivos del atlas', 'Configura la exportación', 'Exporta'], win: '#win-atlas'
        },
        generador_gif: {
            c: C.gif, icon: '🎞️', kicker: 'Animación · GIF', name: 'Generador de GIF',
            title: 'Generador de <span class="ui-grad">GIF Animado</span>',
            desc: 'Crea GIFs de tus animaciones sincronizados a los BPM de la canción. Elige cómo quieres importar:',
            steps: ['Elige el modo', 'Ajusta frames y BPM', 'Exporta el GIF'], win: '#win-gif', hideIntro: true
        },
        gif_png: {
            c: C.gif, icon: '🖼️', kicker: 'Generador de GIF · Hoja de sprites', name: 'GIF desde hoja PNG',
            title: 'GIF desde <span class="ui-grad">hoja de sprites</span>',
            desc: 'Sube tu hoja de sprites (.png), marca los frames y crea la animación desde cero.',
            steps: ['Sube la hoja PNG', 'Marca los frames', 'Exporta el GIF'], win: '#win-gif', hideIntro: true
        },
        gif_sueltas: {
            c: C.gif, icon: '🗂️', kicker: 'Generador de GIF · Imágenes sueltas', name: 'GIF desde imágenes',
            title: 'GIF desde <span class="ui-grad">imágenes sueltas</span>',
            desc: 'Sube varias imágenes (.png, .jpg), ordénalas y conviértelas en una animación.',
            steps: ['Sube tus imágenes', 'Ordena y ajusta', 'Exporta el GIF'], win: '#win-gif', hideIntro: true
        },
        gif_xml: {
            c: C.gif, icon: '📜', kicker: 'Generador de GIF · XML + PNG', name: 'GIF desde XML',
            title: 'GIF desde <span class="ui-grad">XML + PNG</span>',
            desc: 'Usa el XML y el PNG de tu personaje para exportar cualquiera de sus animaciones como GIF.',
            steps: ['Sube XML + PNG', 'Elige la animación', 'Exporta el GIF'], win: '#win-gif', hideIntro: true
        },
        astc: {
            c: C.astc, icon: '📱', kicker: 'Texturas ASTC · Android', name: 'Estudio ASTC',
            title: 'Estudio de <span class="ui-grad">Texturas ASTC</span>',
            desc: 'Herramientas para las texturas comprimidas .astc de Friday Night Funkin\' Android y Psych Engine Mobile.',
            win: '#win-astc-hub', hideIntro: true
        },
        astc_xml: {
            c: C.astc, icon: '🧬', kicker: 'Estudio ASTC · Optimizador', name: 'Optimizador ASTC + XML',
            title: 'Optimizador <span class="ui-grad">ASTC + XML</span>',
            desc: 'Abre un .astc con su XML para ver las animaciones, deduplicar frames, reducir la resolución y ajustar el JSON.',
            steps: ['Sube .astc + .xml', 'Edita y reduce', 'Exporta el ZIP'], win: '#win-orden'
        },
        astc_to_png: {
            c: C.astc, icon: '🔓', kicker: 'Estudio ASTC · Decodificador', name: 'ASTC a PNG',
            title: 'Convertir <span class="ui-grad">ASTC a PNG</span>',
            desc: 'Decodifica una textura .astc al instante a PNG de máxima calidad para revisarla o editarla.',
            steps: ['Sube tu .astc', 'Revisa la textura', 'Descarga el PNG'], win: '#win-astc-to-png', hideIntro: true
        },
        png_to_astc: {
            c: C.astc, icon: '⚡', kicker: 'Estudio ASTC · Codificador', name: 'PNG a ASTC',
            title: 'Convertir <span class="ui-grad">PNG a ASTC</span>',
            desc: 'Comprime tu PNG a textura .astc para Android. Con el XML se reempaqueta el atlas; con el JSON se ajusta el personaje.',
            steps: ['Sube PNG (+ XML, JSON)', 'Elige la prioridad', 'Descarga'], win: '#win-png-to-astc', hideIntro: true
        },
        compresor_astc: {
            c: C.astc, icon: '📦', kicker: 'Estudio ASTC · Compresor', name: 'Compresor ASTC',
            title: 'Compresor de <span class="ui-grad">Texturas ASTC</span>',
            desc: 'Recomprime un .astc pesado a un bloque más ligero conservando su resolución (tu XML sigue sirviendo).',
            steps: ['Sube tu .astc', 'Elige el bloque', 'Descarga'], win: '#win-compresor-astc', hideIntro: true
        }
    };

    // Tarjetas del Inicio: color de cada herramienta
    const CARD_COLORS = {
        'escaner.html': C.scan, 'optimizador.html': C.opt, 'psych.html': C.psych, 'compresor.html': C.png,
        'audio.html': C.audio, 'atlas.html': C.atlas, 'generador_gif.html': C.gif, 'astc.html': C.astc
    };

    const cfg = TOOLS[PAGE] || null;

    function rgba(hex, a) {
        const h = hex.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
        return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }

    function setAccent(el, pair) {
        el.style.setProperty('--tool-accent', pair[0]);
        el.style.setProperty('--tool-accent-2', pair[1]);
        el.style.setProperty('--tool-accent-soft', rgba(pair[0], 0.12));
        el.style.setProperty('--tool-accent-glow', rgba(pair[0], 0.35));
    }

    // El color se aplica en cuanto carga el script (antes de pintar), para que no haya parpadeo
    setAccent(document.documentElement, (cfg && cfg.c) || C.home);

    // Modo oscuro y tema guardados: se aplican en cuanto existe el <body>, sin esperar a que terminen
    // de bajar los iconos externos (antes la página se veía en modo claro varios segundos con internet lento)
    function applySavedLook() {
        try {
            if (localStorage.getItem('iasprite_darkmode') === 'true') document.body.classList.add('dark-mode');
            const theme = localStorage.getItem('iasprite_theme');
            if (theme && theme !== 'cyberpunk') document.body.classList.add(`theme-${theme}`);
        } catch (e) { /* almacenamiento no disponible */ }
    }
    if (document.body) {
        applySavedLook();
    } else {
        const bodyWatcher = new MutationObserver(() => {
            if (document.body) { bodyWatcher.disconnect(); applySavedLook(); }
        });
        bodyWatcher.observe(document.documentElement, { childList: true });
    }

    // ======================================================================
    //  UTILIDADES
    // ======================================================================
    function stripHtml(s) {
        if (s == null) return '';
        const d = document.createElement('div');
        d.innerHTML = String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p|h[1-6]|li)>/gi, '\n');
        return (d.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }

    function hhmmss(t) {
        const d = new Date(t);
        return [d.getHours(), d.getMinutes(), d.getSeconds()].map(v => String(v).padStart(2, '0')).join(':');
    }

    const LEADING_SYMBOLS = /^[\s\p{Extended_Pictographic}️‍✓✔✕✖ℹ:·•\-]+/u;

    // Clasifica un mensaje por su contenido: éxito, aviso, error o información
    function classify(msg) {
        const s = String(msg).trim();
        const head = s.slice(0, 100).toLowerCase();
        if (/^(❌|⛔|🚫)/u.test(s) || /\berror\b|falló|fallo|no se pudo|inválid|corrupt/.test(head)) return 'err';
        if (/^(⚠️|⚠)/u.test(s) || /\baviso\b|atención|cuidado|advertencia/.test(head)) return 'warn';
        if (/^(✅|✔|✓|🎉)/u.test(s) || /¡éxito|éxito!|completad|exitosa|listo/.test(head)) return 'ok';
        return 'info';
    }

    const TYPE = {
        ok: { icon: '✅', tag: 'ÉXITO', title: '¡Listo!', btn: '¡Perfecto!' },
        warn: { icon: '⚠️', tag: 'AVISO', title: 'Aviso', btn: 'Entendido' },
        err: { icon: '⛔', tag: 'ERROR', title: 'Algo salió mal', btn: 'Entendido' },
        info: { icon: '💡', tag: 'INFO', title: 'Información', btn: 'Entendido' },
        step: { icon: '⏳', tag: 'PASO' }
    };

    // ======================================================================
    //  REGISTRO DE ACTIVIDAD (se conserva entre herramientas durante la sesión)
    // ======================================================================
    const LOG_KEY = 'sgfnf_activity_log_v1';
    const MAX_ENTRIES = 250;
    let entries = [];
    try { entries = JSON.parse(sessionStorage.getItem(LOG_KEY) || '[]') || []; } catch (e) { entries = []; }
    let unread = 0, unreadErr = 0;
    let consoleFilter = 'all';

    function saveEntries() {
        try { sessionStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))); } catch (e) { /* almacenamiento no disponible */ }
    }

    function addEntry(type, msg) {
        const text = String(msg || '').trim();
        if (!text) return;
        const last = entries[entries.length - 1];
        if (last && last.m === text && last.k === type && Date.now() - last.t < 1500) return;   // sin duplicados seguidos
        entries.push({ t: Date.now(), k: type, m: text.slice(0, 2000), p: PAGE });
        if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
        saveEntries();
        const panel = document.getElementById('uiConsole');
        if (panel && !panel.hidden) {
            renderConsole();
        } else if (type !== 'step') {
            unread++;
            if (type === 'err') unreadErr++;
        }
        updateBadge();
    }

    // ======================================================================
    //  TARJETAS DE MENSAJE (reemplazan alert)
    // ======================================================================
    const queue = [];
    let showing = false;

    function message(input) {
        let o = typeof input === 'object' && input !== null ? input : { text: input };
        const raw = stripHtml(o.text != null ? o.text : '');
        const type = o.type || classify(raw);
        let title = o.title, body = o.body;
        if (!title) {
            const lines = raw.split('\n');
            const first = lines[0].replace(LEADING_SYMBOLS, '').trim();
            if (first && first.length <= 90) {
                title = first;
                body = lines.slice(1).join('\n').trim();
            } else {
                title = TYPE[type].title;
                body = raw.replace(LEADING_SYMBOLS, '').trim();
            }
        }
        addEntry(type, [title, body].filter(Boolean).join(' — ').replace(/\n+/g, ' · '));
        queue.push({ type, title, body: body || '', detail: o.detail || '', tag: o.tag || TYPE[type].tag });
        if (!showing) nextMessage();
    }

    function nextMessage() {
        const m = queue.shift();
        if (!m) { showing = false; return; }
        showing = true;
        const t = TYPE[m.type] || TYPE.info;
        const ov = document.createElement('div');
        ov.className = 'ui-log-overlay';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.innerHTML = `
            <div class="ui-log-card t-${m.type}">
                <div class="ui-log-head">
                    <div class="ui-log-icon">${t.icon}</div>
                    <div style="min-width:0;">
                        <span class="ui-log-tag">[${esc(m.tag)}] ${esc((cfg && cfg.name) || 'Spritesheet Generator')}</span>
                        <div class="ui-log-title">${esc(m.title)}</div>
                    </div>
                    <div class="ui-log-time">${hhmmss(Date.now())}</div>
                </div>
                <div class="ui-log-body">${esc(m.body)}${m.detail ? `<span class="ui-log-detail">${esc(m.detail)}</span>` : ''}</div>
                <div class="ui-log-actions">
                    <button type="button" class="ui-btn-ghost" data-act="copy">Copiar</button>
                    <button type="button" class="ui-btn-main" data-act="ok">${t.btn}</button>
                </div>
            </div>`;
        if (!m.body && !m.detail) ov.querySelector('.ui-log-body').style.display = 'none';
        const close = () => {
            document.removeEventListener('keydown', onKey, true);
            ov.remove();
            setTimeout(nextMessage, 80);
        };
        const onKey = (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); close(); }
        };
        ov.addEventListener('click', (e) => {
            const act = e.target && e.target.getAttribute && e.target.getAttribute('data-act');
            if (act === 'ok' || e.target === ov) close();
            if (act === 'copy') {
                const txt = `[${m.tag}] ${m.title}\n${m.body}${m.detail ? '\n' + m.detail : ''}`;
                const done = () => { e.target.textContent = '✓ Copiado'; setTimeout(() => { e.target.textContent = 'Copiar'; }, 1600); };
                if (navigator.clipboard) navigator.clipboard.writeText(txt).then(done).catch(() => {});
            }
        });
        document.addEventListener('keydown', onKey, true);
        (document.body || document.documentElement).appendChild(ov);
        const ok = ov.querySelector('[data-act="ok"]');
        if (ok) ok.focus();
    }

    // alert() del navegador -> tarjeta de mensaje con estilo (no bloquea la página)
    window.alert = function (msg) {
        if (!document.body) { document.addEventListener('DOMContentLoaded', () => message(msg), { once: true }); return; }
        message(msg);
    };

    // ======================================================================
    //  AVISOS FLOTANTES
    // ======================================================================
    function toast(msg, type, ms) {
        const text = stripHtml(msg);
        if (!text) return;
        type = type || classify(text);
        addEntry(type, text);
        if (!document.body) return;
        let box = document.getElementById('uiToasts');
        if (!box) {
            box = document.createElement('div');
            box.id = 'uiToasts';
            box.className = 'ui-toasts';
            document.body.appendChild(box);
        }
        while (box.children.length >= 4) box.firstChild.remove();
        const dur = ms || 3800;
        const el = document.createElement('div');
        el.className = `ui-toast t-${type}`;
        el.innerHTML = `<div class="ui-toast-icon">${(TYPE[type] || TYPE.info).icon}</div><div style="flex:1;min-width:0;">${esc(text.replace(LEADING_SYMBOLS, ''))}</div><div class="ui-toast-bar" style="animation-duration:${dur}ms"></div>`;
        el.addEventListener('click', () => el.remove());
        box.appendChild(el);
        setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 320); }, dur);
    }

    // ======================================================================
    //  CONSOLA "REGISTRO DE ACTIVIDAD"
    // ======================================================================
    function buildConsole() {
        if (document.getElementById('uiConsoleBtn')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'uiConsoleBtn';
        btn.className = 'ui-console-btn';
        btn.title = 'Registro de actividad: todo lo que pasó en las herramientas';
        btn.innerHTML = '<span class="dot"></span><span class="lbl">Registro</span><span>&gt;_</span><span class="badge" id="uiConsoleBadge"></span>';
        document.body.appendChild(btn);

        const panel = document.createElement('div');
        panel.id = 'uiConsole';
        panel.className = 'ui-console';
        panel.hidden = true;
        panel.innerHTML = `
            <div class="ui-console-head">
                <div class="lights"><i></i><i></i><i></i></div>
                <span>registro.log</span>
                <span class="sp"></span>
                <button type="button" data-c="copy">Copiar</button>
                <button type="button" data-c="clear">Limpiar</button>
                <button type="button" data-c="close">✕</button>
            </div>
            <div class="ui-console-filters">
                <button type="button" data-f="all" class="on">Todo</button>
                <button type="button" data-f="ok">✅ Éxitos</button>
                <button type="button" data-f="warn">⚠️ Avisos</button>
                <button type="button" data-f="err">⛔ Errores</button>
                <button type="button" data-f="step">⏳ Pasos</button>
            </div>
            <div class="ui-console-list" id="uiConsoleList"></div>`;
        document.body.appendChild(panel);

        btn.addEventListener('click', () => {
            panel.hidden = !panel.hidden;
            if (!panel.hidden) { unread = 0; unreadErr = 0; updateBadge(); renderConsole(); }
        });
        panel.addEventListener('click', (e) => {
            const c = e.target.getAttribute('data-c'), f = e.target.getAttribute('data-f');
            if (c === 'close') panel.hidden = true;
            if (c === 'clear') { entries = []; saveEntries(); renderConsole(); }
            if (c === 'copy') {
                const txt = entries.map(x => `${hhmmss(x.t)} [${TYPE[x.k] ? TYPE[x.k].tag : x.k}] ${x.p !== PAGE ? '(' + x.p + ') ' : ''}${x.m}`).join('\n');
                if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => { e.target.textContent = '✓ Copiado'; setTimeout(() => { e.target.textContent = 'Copiar'; }, 1500); }).catch(() => {});
            }
            if (f) {
                consoleFilter = f;
                panel.querySelectorAll('[data-f]').forEach(b => b.classList.toggle('on', b === e.target));
                renderConsole();
            }
        });
        updateBadge();
    }

    function renderConsole() {
        const list = document.getElementById('uiConsoleList');
        if (!list) return;
        const shown = entries.filter(x => consoleFilter === 'all' || x.k === consoleFilter);
        if (!shown.length) {
            list.innerHTML = '<div class="ui-console-empty">Sin registros todavía.<br>Aquí aparecerá todo lo que hagas: archivos importados, procesos, avisos y errores.</div>';
            return;
        }
        list.innerHTML = shown.map(x => {
            const T = TYPE[x.k] || TYPE.info;
            const other = x.p !== PAGE ? `<span style="color:#7c7fa6;">(${esc((TOOLS[x.p] && TOOLS[x.p].name) || x.p)})</span> ` : '';
            return `<div class="ui-entry t-${x.k}"><span class="t">${hhmmss(x.t)}</span><span class="k">${T.tag}</span><span class="m">${other}${esc(x.m)}</span></div>`;
        }).join('');
        list.scrollTop = list.scrollHeight;
    }

    function updateBadge() {
        const b = document.getElementById('uiConsoleBadge');
        if (!b) return;
        b.textContent = unread > 99 ? '99+' : String(unread);
        b.classList.toggle('show', unread > 0);
        b.classList.toggle('err', unreadErr > 0);
    }

    // ======================================================================
    //  CABECERA UNIFICADA Y ESTILO COMÚN
    // ======================================================================
    function buildHero() {
        if (!cfg) return;
        const win = document.querySelector(cfg.win) || document.querySelector('.window-content.active') || document.querySelector('.window-content');
        if (!win || win.querySelector(':scope > .ui-hero')) return;

        // Título anterior (h2 dentro del panel o barra de título de la ventana) e introducción repetida
        const oldTitle = win.querySelector(':scope > h2.section-title');
        if (oldTitle) oldTitle.style.display = 'none';
        if (cfg.hideIntro) {
            const intro = win.querySelector(':scope > p');
            if (intro) intro.style.display = 'none';
        }

        const hero = document.createElement('div');
        hero.className = 'ui-hero';
        const steps = (cfg.steps || []).map((s, i) => `<span class="ui-step"><b>${i + 1}</b>${esc(s)}</span>`).join('');
        hero.innerHTML = `
            <div class="ui-hero-icon" aria-hidden="true">${cfg.icon}</div>
            <div class="ui-hero-text">
                <div class="ui-hero-kicker">${esc(cfg.kicker)}</div>
                <h1 class="ui-hero-title">${cfg.title}</h1>
                ${cfg.desc ? `<p class="ui-hero-desc">${esc(cfg.desc)}</p>` : ''}
                ${steps ? `<div class="ui-steps">${steps}</div>` : ''}
            </div>`;
        win.insertBefore(hero, win.firstChild);
    }

    // Botones que abren un selector de archivos -> estilo de "zona de carga"
    function tagUploads() {
        document.querySelectorAll('button[onclick*=".click()"], .btn-pildora[onclick*=".click()"]').forEach(btn => {
            const m = /getElementById\(\s*['"]([^'"]+)['"]\s*\)\.click\(\)/.exec(btn.getAttribute('onclick') || '');
            if (!m) return;
            const inp = document.getElementById(m[1]);
            if (inp && inp.type === 'file') btn.classList.add('ui-upload');
        });
    }

    function colorHomeCards() {
        document.querySelectorAll('.home-card[onclick]').forEach(card => {
            const m = /location\.href\s*=\s*['"]([^'"]+)['"]/.exec(card.getAttribute('onclick') || '');
            const pair = m && CARD_COLORS[m[1]];
            if (!pair) return;
            card.style.setProperty('--card-accent', pair[0]);
            card.style.setProperty('--card-accent-2', pair[1]);
            card.style.setProperty('--card-glow', rgba(pair[0], 0.3));
        });
    }

    // ======================================================================
    //  CONEXIÓN CON LAS FUNCIONES EXISTENTES (main.js)
    // ======================================================================
    function hookExisting() {
        // Avisos de importación -> avisos nuevos
        if (typeof window.mostrarToastImportacion === 'function') {
            window.mostrarToastImportacion = function (mensaje, tipo, duracion) {
                const map = { error: 'err', warning: 'warn', success: 'ok', info: 'info' };
                toast(mensaje, map[tipo] || 'info', duracion);
            };
        }

        // Errores al importar archivos -> tarjeta de mensaje con detalle técnico
        if (typeof window.mostrarLogImportacion === 'function') {
            const original = window.mostrarLogImportacion;
            window.mostrarLogImportacion = function (opts = {}) {
                const { tipo, titulo, mensaje, detalle, archivo, esperado } = opts;
                const fName = archivo ? archivo.name : 'archivo desconocido';
                const fExt = fName.includes('.') ? fName.split('.').pop().toLowerCase() : 'sin extensión';
                const fSize = archivo ? (archivo.size / 1024).toFixed(1) + ' KB' : '--';
                if (tipo === 'exito') {
                    console.log(`✓ [LOG IMPORTACIÓN - ÉXITO]: "${fName}" importado correctamente.`);
                    toast(`Archivo importado: ${fName} (${fSize})`, 'ok');
                    return;
                }
                if (tipo === 'formato_incorrecto') {
                    console.error(`❌ [LOG IMPORTACIÓN - ARCHIVO INCORRECTO]: Se esperaba "${esperado}", recibido "${fName}"`);
                    message({
                        type: 'err', tag: 'FORMATO NO COINCIDE', title: titulo ? stripHtml(titulo) : 'Archivo incorrecto',
                        body: mensaje ? stripHtml(mensaje) : `El archivo "${fName}" no es el correcto.\n\nSe esperaba ${esperado || 'otro formato'}, pero el archivo tiene extensión .${fExt}.\nRevisa tus archivos y elige el que corresponde a esta opción.`,
                        detail: detalle || `Formato esperado: ${esperado}\nArchivo recibido: ${fName} (${archivo && archivo.type ? archivo.type : 'tipo desconocido'}, ${fSize})`
                    });
                    return;
                }
                if (tipo === 'sintaxis_corrupto') {
                    console.error(`⚠️ [LOG IMPORTACIÓN - SINTAXIS/CORRUPCIÓN]: Error en "${fName}":\n`, detalle);
                    message({
                        type: 'warn', tag: 'ARCHIVO DAÑADO', title: titulo ? stripHtml(titulo) : 'El archivo tiene errores',
                        body: mensaje ? stripHtml(mensaje) : `"${fName}" tiene la extensión correcta, pero su contenido está dañado o tiene errores y no se puede procesar.\n\nAbajo está el detalle técnico del error.`,
                        detail: detalle || `No se pudo leer "${fName}" (${fSize}).`
                    });
                    return;
                }
                return original.apply(this, arguments);
            };
        }

        // Pasos del cargador -> registro de actividad
        if (typeof window.mostrarCargaGlobal === 'function') {
            const originalCarga = window.mostrarCargaGlobal;
            window.mostrarCargaGlobal = function (mensaje) {
                const txt = stripHtml(mensaje).replace(/\s*\n\s*/g, ' · ');
                if (txt && !/^Cargando secci/i.test(txt)) addEntry('step', txt);
                return originalCarga.apply(this, arguments);
            };
        }
    }

    // Errores de JavaScript inesperados -> registro (para poder reportarlos)
    window.addEventListener('error', (e) => {
        if (!e || !e.message) return;
        const where = e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '';
        addEntry('err', `Error interno: ${e.message}${where}`);
    });
    window.addEventListener('unhandledrejection', (e) => {
        const r = e && e.reason;
        addEntry('err', `Error interno: ${(r && r.message) || r}`);
    });

    // El cargador de arranque ("Iniciando...") se quita en cuanto la página está lista, sin esperar a que
    // terminen de bajar los iconos externos. Si una herramienta lo está usando (otro texto), no se toca.
    function hideStartupLoader() {
        const g = document.getElementById('globalLoader');
        const t = document.getElementById('globalLoaderText');
        if (g && !g.classList.contains('hidden') && t && /^\s*Iniciando\.\.\.\s*$/.test(t.textContent)) {
            g.classList.add('hidden');
        }
    }

    function init() {
        buildHero();
        tagUploads();
        colorHomeCards();
        hookExisting();
        buildConsole();
        setTimeout(hideStartupLoader, 250);
        addEntry('info', `Abriste: ${(cfg && cfg.name) || PAGE}`);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    // API pública para que las herramientas registren sus propios eventos
    window.UI = { message, toast, log: addEntry, page: PAGE };
})();
