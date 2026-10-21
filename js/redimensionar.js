// ==========================================
// REDUCIR RESOLUCIÓN (Optimizador, Escáner y Optimizador ASTC)
//   ⚡ Fácil (Grande / Medio / Pequeño) · % Porcentaje · ⇲ Alto × Ancho · 💾 Peso · 🎯 Resolución + Peso
// Cada opción arma un "plan" (factor sobre el tamaño ACTUAL de la imagen) y el botón Reducir lo aplica
// con aplicarResizeOptimizador() de js/optimizador.js.
// El peso se mide creando el atlas que se va a descargar (PNG) o, en el Optimizador ASTC, se calcula
// exacto a partir de los bloques (window.OptPesoExacto, definido en js/astc_xml.js).
// ==========================================
(function () {
    'use strict';

    const MB = 1024 * 1024;
    const MODOS = [
        { id: 'facil', icono: '⚡', nombre: 'Fácil', ayuda: 'Elige un tamaño y listo.' },
        { id: 'pct', icono: '%', nombre: 'Porcentaje', ayuda: 'Reduce a un porcentaje del tamaño actual.' },
        { id: 'dim', icono: '⇲', nombre: 'Alto × Ancho', ayuda: 'Elige la resolución final. La proporción se mantiene para que el JSON siga cuadrando.' },
        { id: 'peso', icono: '💾', nombre: 'Peso', ayuda: 'Elige cuánto quieres que pese y se calcula la resolución.' },
        { id: 'combo', icono: '🎯', nombre: 'Resolución + Peso', ayuda: 'Pon un límite de resolución y de peso: se usa el tamaño más grande que cumpla los dos.' }
    ];
    const LADOS = [7680, 6144, 5120, 4096, 3840, 3072, 2560, 2048, 1920, 1600, 1440, 1280, 1024, 960, 800, 720, 640, 512, 480, 360, 256, 128];
    const KB = 1024;
    const PESOS = [50, 30, 20, 15, 10, 8, 6, 5, 4, 3, 2.5, 2, 1.5, 1].map(mb => mb * MB).concat([750, 500, 300, 200, 100, 50].map(kb => kb * KB));
    const PCT_MAS = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];

    const st = { modo: 'facil', plan: null, opciones: new Map(), verMas: {}, calculando: null, firma: '' };
    try { const m = localStorage.getItem('rs_modo'); if (MODOS.some(x => x.id === m)) st.modo = m; } catch (e) { }

    const cont = () => document.getElementById('rsTool');
    const listo = () => typeof imgOriginal !== 'undefined' && imgOriginal && imgOriginal.width > 0 &&
        typeof spritesDetectados !== 'undefined' && spritesDetectados.length > 0;
    const W = () => imgOriginal.width, H = () => imgOriginal.height;
    const dimsDe = (f) => [Math.max(1, Math.round(W() * f)), Math.max(1, Math.round(H() * f))];
    const esAstc = () => typeof window.OptPesoExacto === 'function';
    const pctTxt = (f) => (Math.round(f * 1000) / 10) + '%';
    const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const log = (tipo, msg) => { if (window.UI) window.UI.log(tipo, msg); };

    function fmtBytes(b) {
        if (b == null || !isFinite(b)) return '—';
        if (b >= MB) return (b / MB).toFixed(b >= 10 * MB ? 1 : 2) + ' MB';
        return Math.max(1, Math.round(b / 1024)) + ' KB';
    }
    function fmtPeso(b) {
        if (b == null) return Peso.error ? 'peso no disponible' : 'calculando peso…';
        return esAstc() ? fmtBytes(b) + ' (.astc)' : '≈ ' + fmtBytes(b);
    }
    // Redondea un peso a un número fácil de leer (1.87 MB -> 1.9 MB, 643 KB -> 650 KB)
    function pesoRedondo(b) {
        if (b >= MB) return Math.round(b / MB * 10) / 10 * MB;
        return Math.max(10, Math.round(b / 1024 / 10) * 10) * 1024;
    }

    // ---------------------------------------------------------------
    // PESO: atlas real a un factor dado y modelo rápido para estimar
    // ---------------------------------------------------------------
    // Igual que la reducción real: se reescala la imagen completa una vez y se recortan los frames
    function atlasEscalado(f) {
        const fu = framesUnicos();
        const iw = Math.max(1, Math.round(W() * f)), ih = Math.max(1, Math.round(H() * f));
        const red = document.createElement('canvas');
        red.width = iw; red.height = ih;
        const gr = red.getContext('2d');
        gr.imageSmoothingEnabled = true;
        gr.imageSmoothingQuality = 'high';
        gr.drawImage(imgOriginal, 0, 0, iw, ih);
        const items = fu.unicos.map(s => {
            const x = Math.round(s.x * f), y = Math.round(s.y * f);
            return { key: s, x, y, w: Math.max(1, Math.min(iw - x, Math.round(s.w * f))), h: Math.max(1, Math.min(ih - y, Math.round(s.h * f))) };
        });
        const pack = empaquetarEstantes(items, PAD_ATLAS);
        const c = document.createElement('canvas');
        c.width = pack.w; c.height = pack.h;
        const g = c.getContext('2d');
        for (const it of items) {
            const p = pack.pos.get(it.key);
            g.drawImage(red, it.x, it.y, it.w, it.h, p.x, p.y, it.w, it.h);
        }
        red.width = red.height = 0;
        return c;
    }

    const Peso = {
        firma: '', modelo: null, preparando: null, medidas: new Map(), error: null,

        // Devuelve true si cambió la imagen o los frames (y reinicia lo calculado)
        revisar() {
            const f = W() + 'x' + H() + '|' + (imgOriginal.src || '').length + '|' + spritesDetectados.length + '|' + (esAstc() ? 'astc' : 'png');
            if (f === this.firma) return false;
            this.firma = f; this.modelo = null; this.preparando = null; this.medidas = new Map(); this.error = null; this.cola = [];
            return true;
        },

        async medir(f) {
            const k = f.toFixed(4);
            if (this.medidas.has(k)) return this.medidas.get(k);
            let bytes;
            if (esAstc()) {
                bytes = this.astc(f);
            } else {
                const c = atlasEscalado(f);
                const blob = await new Promise(r => c.toBlob(r, 'image/png'));
                c.width = c.height = 0;
                if (!blob) throw new Error('El navegador no pudo crear el PNG de prueba (posible falta de memoria).');
                bytes = blob.size;
            }
            this.medidas.set(k, bytes);
            return bytes;
        },

        // Peso exacto del .astc con memoria (se consulta muchas veces al pintar las opciones)
        astc(f) {
            const k = 'a' + f.toFixed(5);
            let b = this.medidas.get(k);
            if (b === undefined) { b = window.OptPesoExacto(f); this.medidas.set(k, b); }
            return b;
        },

        // Estimación al instante (la medida real si ya se hizo; null mientras se prepara el modelo)
        rapido(f) {
            if (esAstc()) return this.astc(f);
            const k = f.toFixed(4);
            if (this.medidas.has(k)) return this.medidas.get(k);
            const m = this.modelo;
            return m ? m.s1 * Math.pow(f / m.f1, m.k) : null;
        },

        // Mide en segundo plano las opciones que se están viendo (el peso de un PNG no es exactamente
        // proporcional al tamaño: reducir justo a 50% o 25% comprime mucho mejor que 49%)
        cola: [], trabajando: false,
        precalcular(lista) {
            if (esAstc() || !this.modelo) return;
            for (const f of lista) {
                const k = f.toFixed(4);
                if (f > 0 && f < 0.9995 && !this.medidas.has(k) && !this.cola.includes(k)) this.cola.push(k);
            }
            this.procesarCola();
        },
        async procesarCola() {
            if (this.trabajando || !this.cola.length) return;
            this.trabajando = true;
            const firma = this.firma;
            let hecho = 0;
            while (this.cola.length && firma === this.firma) {
                const k = this.cola.shift();
                await new Promise(r => window.requestIdleCallback ? window.requestIdleCallback(r, { timeout: 600 }) : setTimeout(r, 60));
                try { await this.medir(Number(k)); hecho++; } catch (e) { this.cola = []; break; }
            }
            this.trabajando = false;
            if (hecho && firma === this.firma) refrescar();
        },

        // Factor aproximado para un peso (sin medir)
        factorAprox(T) {
            if (esAstc()) {
                let lo = 0.01, hi = 1;
                for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (this.astc(mid) <= T) lo = mid; else hi = mid; }
                return lo;
            }
            const m = this.modelo;
            return m ? m.f1 * Math.pow(T / m.s1, 1 / m.k) : null;
        },

        // Mide el PNG a dos tamaños y ajusta peso ≈ s1 · (f / f1)^k
        preparar() {
            if (esAstc() || this.modelo) return Promise.resolve(true);
            if (this.preparando) return this.preparando;
            const firma = this.firma;
            this.preparando = (async () => {
                await new Promise(r => setTimeout(r, 30));
                // Puntos "normales" (no 50% / 25% exactos, que comprimen anormalmente bien)
                const maxLado = Math.max(W(), H());
                const f1 = maxLado > 1600 ? 0.47 : 0.93, f2 = Math.round(f1 * 0.62 * 100) / 100;
                const s1 = await this.medir(f1);
                const s2 = await this.medir(f2);
                if (firma !== this.firma) return false;
                let k = Math.log(s1 / s2) / Math.log(f1 / f2);
                if (!isFinite(k) || k < 1 || k > 2.4) k = 1.8;
                this.modelo = { f1, s1, k };
                log('info', `Peso estimado del atlas: ${fmtBytes(this.rapido(1))} con el tamaño actual`);
                return true;
            })().catch(err => {
                this.error = (err && err.message) || String(err);
                log('warn', 'No se pudo calcular el peso estimado: ' + this.error);
                return false;
            }).finally(() => { if (firma === this.firma) refrescar(); });
            return this.preparando;
        },

        // Mayor factor cuyo peso real cabe en T bytes: { factor, bytes, yaCumple, alcanzado }
        async factorParaPeso(T) {
            if (esAstc()) {
                const pf = (x) => this.astc(x);
                if (pf(1) <= T) return { factor: 1, bytes: pf(1), yaCumple: true };
                if (pf(0.02) > T) return { factor: 0.02, bytes: pf(0.02), alcanzado: false };
                let lo = 0.02, hi = 1;
                for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (pf(mid) <= T) lo = mid; else hi = mid; }
                let f = Math.floor(lo * 1000) / 1000;
                while (f > 0.02 && pf(f) > T) f = Math.round((f - 0.001) * 1000) / 1000;
                return { factor: f, bytes: pf(f), alcanzado: true };
            }
            await this.preparar();
            if (!this.modelo) throw new Error(this.error || 'No se pudo medir el peso.');
            const m = this.modelo;
            let f = Math.min(0.999, m.f1 * Math.pow(T / m.s1, 1 / m.k));
            let mejor = null;
            for (let i = 0; i < 7; i++) {
                f = Math.min(0.999, Math.max(0.02, Math.floor(f * 10000) / 10000));
                const s = await this.medir(f);
                if (s <= T && (!mejor || f > mejor.factor)) mejor = { factor: f, bytes: s };
                if (s <= T && (s >= T * 0.93 || f >= 0.999)) break;
                // Pendiente local con la medida más cercana (el PNG no baja exactamente con el área)
                const pts = [...this.medidas.entries()].map(([k, v]) => [Number(k), v]).filter(p => Math.abs(p[0] - f) > 1e-4);
                pts.sort((a, b) => Math.abs(Math.log(a[0] / f)) - Math.abs(Math.log(b[0] / f)));
                let k = pts.length ? Math.log(s / pts[0][1]) / Math.log(f / pts[0][0]) : m.k;
                if (!isFinite(k) || k < 0.8 || k > 2.6) k = m.k;
                let nf = f * Math.pow((T * 0.97) / s, 1 / k);
                if (Math.abs(nf - f) < 0.002) nf = s > T ? f - 0.004 : f + 0.004;
                f = nf;
            }
            if (mejor && mejor.factor >= 0.999) return { factor: 1, bytes: mejor.bytes, yaCumple: true };
            if (!mejor) {
                const s = await this.medir(0.02);
                return s <= T ? { factor: 0.02, bytes: s, alcanzado: true } : { factor: 0.02, bytes: s, alcanzado: false };
            }
            return { factor: mejor.factor, bytes: mejor.bytes, alcanzado: true };
        }
    };

    // ---------------------------------------------------------------
    // OPCIONES
    // ---------------------------------------------------------------
    function registrar(o) { st.opciones.set(o.key, o); return o; }

    function opcionFactor(key, f, titulo, extra = {}) {
        const [w, h] = dimsDe(f);
        const o = Object.assign({ key, factor: f, titulo, w, h }, extra);
        o.peso = Peso.rapido(f);
        o.disabled = Math.min(w, h) < 16 || f >= 0.9995;
        if (!o.aviso && Math.max(w, h) > 4096) o.aviso = 'Pasa de 4096 px: algunos celulares no la cargan';
        if (!o.sub) o.sub = `${w} × ${h} px · ${fmtPeso(o.peso)}`;
        return registrar(o);
    }

    function selClase(key) { return st.plan && st.plan.key === key ? ' sel' : ''; }

    function chip(o) {
        return `<button type="button" class="rs-opt${selClase(o.key)}" data-key="${esc(o.key)}"${o.disabled ? ' disabled' : ''}>` +
            (o.badge ? `<span class="rs-badge">${o.badge}</span>` : '') +
            `<b>${esc(o.titulo)}</b><small>${o.sub}</small>` +
            (o.nota ? `<span class="rs-why">${esc(o.nota)}</span>` : '') +
            (o.aviso ? `<span class="rs-warn" title="${esc(o.aviso)}">⚠ ${esc(/4096/.test(o.aviso) ? 'Más de 4096 px' : o.aviso)}</span>` : '') +
            `</button>`;
    }

    function verMasBoton(id, n) {
        const abierto = !!st.verMas[id];
        return `<button type="button" class="rs-more" data-vermas="${id}" aria-expanded="${abierto}">${abierto ? '▲ Ver menos' : `▼ Ver más (${n})`}</button>`;
    }

    function cercanoA(lista, f) {
        if (f == null || !lista.length) return null;
        return lista.reduce((a, b) => Math.abs(b.f - f) < Math.abs(a.f - f) ? b : a);
    }

    // ---------- ⚡ Fácil ----------
    function vistaFacil() {
        const rec = factorRecomendadoResize();
        const defs = [
            { key: 'facil-g', f: 0.75, titulo: 'Grande', icono: '🖼️', desc: 'Calidad alta: reduce un poco.' },
            { key: 'facil-m', f: 0.5, titulo: 'Medio', icono: '⚖️', desc: 'Equilibrio entre calidad y peso.' },
            { key: 'facil-p', f: 0.35, titulo: 'Pequeño', icono: '🪶', desc: 'Lo más ligero posible.' }
        ];
        const recDef = rec ? cercanoA(defs, rec) : null;
        const tarjetas = defs.map(d => {
            const o = opcionFactor(d.key, d.f, d.titulo, { tituloPlan: `${d.titulo} (${pctTxt(d.f)})` });
            return `<button type="button" class="rs-card${selClase(o.key)}" data-key="${o.key}"${o.disabled ? ' disabled' : ''}>` +
                (recDef === d ? '<span class="rs-badge">⭐ Recomendado</span>' : '') +
                `<span class="rs-card-ico">${d.icono}</span>` +
                `<span class="rs-card-title"><b>${d.titulo}</b><span class="rs-card-pct">${pctTxt(d.f)}</span></span>` +
                `<small>${d.desc}</small>` +
                `<span class="rs-card-dims">${o.w} × ${o.h} px</span>` +
                `<span class="rs-card-peso">${fmtPeso(o.peso)}</span>` +
                (o.aviso ? `<span class="rs-warn">⚠ ${esc(o.aviso)}</span>` : '') +
                `</button>`;
        }).join('');
        return `<div class="rs-cards">${tarjetas}</div>` +
            (rec ? '' : '<div class="opt-hint">Tu imagen ya es pequeña (menos de 1024 px): reducirla más puede verse borrosa en el juego.</div>');
    }

    // ---------- % Porcentaje ----------
    function recomendadosPct() {
        const maxLado = Math.max(W(), H());
        let c = [];
        if (maxLado > 4096) c.push({ f: 4096 / maxLado, nota: 'Cabe en 4096 px: carga en casi cualquier celular' });
        if (maxLado > 2048) c.push({ f: 2048 / maxLado, nota: 'Cabe en 2048 px: máxima compatibilidad' });
        c.push({ f: 0.8, nota: 'Reducción ligera: casi no se nota' });
        c.push({ f: 0.75, nota: 'Equilibrio entre calidad y peso' });
        c.push({ f: 0.5, nota: 'La mitad: la escala del JSON queda exacta (×2)' });
        c.push({ f: 0.4, nota: 'Muy ligera, para celulares con poca memoria' });
        c = c.filter(x => x.f < 0.999 && Math.min(...dimsDe(x.f)) >= 32).sort((a, b) => b.f - a.f);
        const out = [];
        for (const x of c) if (!out.some(y => Math.abs(y.f - x.f) < 0.03)) out.push(x);
        return out.slice(0, 5);
    }

    function vistaPct() {
        const lista = recomendadosPct();
        const recItem = cercanoA(lista, factorRecomendadoResize());
        let html = '<div class="rs-sec">Recomendados para tu imagen</div><div class="rs-grid">' +
            lista.map(x => chip(opcionFactor('pct-' + x.f.toFixed(4), x.f, pctTxt(x.f), {
                nota: x.nota, badge: x === recItem ? '⭐ Recomendado' : '', tituloPlan: pctTxt(x.f)
            }))).join('') + '</div>';
        html += verMasBoton('pct', PCT_MAS.length);
        if (st.verMas.pct) {
            html += '<div class="rs-grid rs-grid-sm">' + PCT_MAS.map(f => chip(opcionFactor('pctm-' + f, f, pctTxt(f)))).join('') + '</div>';
        }
        const v = st.plan && st.plan.key === 'pct-custom' ? Math.round(st.plan.factor * 1000) / 10 : '';
        html += '<div class="rs-sec">Personalizado</div>' +
            `<div class="rs-custom${selClase('pct-custom')}" data-keybox="pct-custom"><input type="number" id="rsPct" min="1" max="99.9" step="0.1" inputmode="decimal" placeholder="Ej. 65" value="${v}" aria-label="Porcentaje personalizado"><span class="rs-unit">%</span><span class="rs-custom-res" id="rsPctRes"></span></div>`;
        return html;
    }

    // ---------- ⇲ Alto × Ancho ----------
    function vistaDim() {
        const maxLado = Math.max(W(), H());
        let c = [];
        if (maxLado > 4096) c.push({ f: 4096 / maxLado, nota: 'Límite de muchos celulares' });
        if (maxLado > 2048) c.push({ f: 2048 / maxLado, nota: 'Compatible con casi todos' });
        c.push({ f: 0.75, nota: 'Tres cuartos del tamaño' });
        c.push({ f: 0.5, nota: 'La mitad exacta' });
        if (maxLado > 1024) c.push({ f: 1024 / maxLado, nota: 'Muy ligera' });
        c = c.filter(x => x.f < 0.999 && Math.min(...dimsDe(x.f)) >= 32).sort((a, b) => b.f - a.f);
        const rec = [];
        for (const x of c) if (!rec.some(y => Math.abs(y.f - x.f) < 0.03)) rec.push(x);
        const recItem = cercanoA(rec, factorRecomendadoResize());
        const titulo = (f) => dimsDe(f).join(' × ');
        let html = '<div class="rs-sec">Recomendados para tu imagen</div><div class="rs-grid">' +
            rec.slice(0, 5).map(x => chip(opcionFactor('dim-' + x.f.toFixed(4), x.f, titulo(x.f), {
                sub: `${pctTxt(x.f)} · ${fmtPeso(Peso.rapido(x.f))}`, nota: x.nota,
                badge: x === recItem ? '⭐ Recomendado' : '', tituloPlan: titulo(x.f) + ' px'
            }))).join('') + '</div>';
        const lados = LADOS.filter(l => l < maxLado && Math.min(...dimsDe(l / maxLado)) >= 16);
        if (lados.length) {
            html += verMasBoton('dim', lados.length);
            if (st.verMas.dim) {
                html += '<div class="rs-grid rs-grid-sm">' + lados.map(l => {
                    const f = l / maxLado;
                    return chip(opcionFactor('dimm-' + l, f, titulo(f), { sub: `${pctTxt(f)} · ${fmtPeso(Peso.rapido(f))}`, tituloPlan: titulo(f) + ' px' }));
                }).join('') + '</div>';
            }
        }
        const p = st.plan && st.plan.key === 'dim-custom' ? dimsDe(st.plan.factor) : ['', ''];
        html += '<div class="rs-sec">Personalizado</div>' +
            `<div class="rs-custom rs-custom-dim${selClase('dim-custom')}" data-keybox="dim-custom">` +
            `<label>Ancho<input type="number" id="rsAncho" min="16" max="${W() - 1}" inputmode="numeric" placeholder="${Math.round(W() / 2)}" value="${p[0]}"></label>` +
            `<span class="rs-x" title="La proporción está fija">🔒 ×</span>` +
            `<label>Alto<input type="number" id="rsAlto" min="16" max="${H() - 1}" inputmode="numeric" placeholder="${Math.round(H() / 2)}" value="${p[1]}"></label>` +
            `<span class="rs-custom-res" id="rsDimRes"></span></div>` +
            '<div class="opt-hint">Al escribir el ancho se calcula el alto (y al revés) para no deformar al personaje.</div>';
        return html;
    }

    // ---------- 💾 Peso ----------
    function vistaPeso() {
        const actual = Peso.rapido(1);
        const etiqueta = esAstc() ? 'Peso del .astc' : 'Peso del PNG del atlas';
        let html = `<div class="rs-peso-actual">${etiqueta} con el tamaño actual: <b>${fmtPeso(actual)}</b></div>`;
        if (actual == null) {
            html += Peso.error
                ? `<div class="opt-hint">No se pudo medir el peso (${esc(Peso.error)}). Prueba con «Porcentaje» o «Alto × Ancho».</div>`
                : '<div class="opt-hint"><span class="rs-spin"></span> Midiendo el peso del atlas para recomendarte tamaños…</div>';
        } else {
            const rec = factorRecomendadoResize();
            let obj = [];
            if (rec) obj.push({ bytes: pesoRedondo(Peso.rapido(rec)), nota: 'Equivale al tamaño recomendado', rec: true });
            obj.push({ bytes: pesoRedondo(actual * 0.5), nota: 'La mitad del peso' });
            obj.push({ bytes: pesoRedondo(actual * 0.25), nota: 'Una cuarta parte del peso' });
            [5, 2, 1].forEach(mb => obj.push({ bytes: mb * MB, nota: mb <= 2 ? 'Ideal para celulares' : 'Ligero para mods' }));
            obj = obj.filter(x => x.bytes < actual * 0.95 && x.bytes > 0);
            const out = [];
            for (const x of obj) {
                const i = out.findIndex(y => Math.abs(y.bytes - x.bytes) / x.bytes < 0.08);
                if (i < 0) out.push(x); else if (x.rec) out[i] = x;
            }
            out.sort((a, b) => b.bytes - a.bytes);
            html += '<div class="rs-sec">Recomendados</div><div class="rs-grid">' + out.slice(0, 5).map(x => chipPeso(x.bytes, x.nota, x.rec)).join('') + '</div>';
            const mas = PESOS.filter(b => b < actual * 0.95 && (Peso.factorAprox(b) || 0) >= 0.03);
            if (mas.length) {
                html += verMasBoton('peso', mas.length);
                if (st.verMas.peso) html += '<div class="rs-grid rs-grid-sm">' + mas.map(b => chipPeso(b, '', false)).join('') + '</div>';
            }
        }
        html += '<div class="rs-sec">Personalizado</div>' +
            `<div class="rs-custom${selClase('peso-custom')}" data-keybox="peso-custom"><span class="rs-unit">Que pese máximo</span>` +
            `<input type="number" id="rsPeso" min="0.01" step="0.01" inputmode="decimal" placeholder="Ej. 1.5">` +
            `<select id="rsPesoUnidad" aria-label="Unidad"><option value="MB">MB</option><option value="KB">KB</option></select>` +
            `<button type="button" class="btn-pildora btn-secundario rs-calc" data-accion="peso-custom">Calcular</button></div>`;
        return html;
    }

    function chipPeso(bytes, nota, rec) {
        const f = Peso.factorAprox(bytes);
        const titulo = '≤ ' + fmtBytes(bytes);
        const sub = f ? `≈ ${pctTxt(Math.min(f, 1))} · ${dimsDe(Math.min(f, 1)).join(' × ')} px` : 'toca para calcular';
        const o = registrar({ key: 'peso-' + Math.round(bytes), titulo, sub, nota, badge: rec ? '⭐ Recomendado' : '', pesoObjetivo: bytes, disabled: f != null && f < 0.02 });
        return chip(o);
    }

    // ---------- 🎯 Resolución + Peso ----------
    function vistaCombo() {
        return '<div class="rs-sec">Que no pase de…</div>' +
            `<div class="rs-combo${selClase('combo')}" data-keybox="combo">` +
            `<label>Ancho máx. (px)<input type="number" id="rsCmbW" min="16" inputmode="numeric" placeholder="${Math.min(W(), 2048)}"></label>` +
            `<label>Alto máx. (px)<input type="number" id="rsCmbH" min="16" inputmode="numeric" placeholder="${Math.min(H(), 2048)}"></label>` +
            `<label>Peso máx.<span class="rs-inline"><input type="number" id="rsCmbP" min="0.01" step="0.01" inputmode="decimal" placeholder="2">` +
            `<select id="rsCmbU" aria-label="Unidad"><option value="MB">MB</option><option value="KB">KB</option></select></span></label>` +
            `<button type="button" class="btn-pildora rs-calc" data-accion="combo">Calcular</button></div>` +
            '<div class="opt-hint">Puedes dejar vacío lo que no te importe. La imagen conserva su proporción.</div>';
    }

    // ---------------------------------------------------------------
    // RESUMEN + BOTÓN REDUCIR
    // ---------------------------------------------------------------
    function vistaResumen() {
        let html = '';
        if (st.calculando) {
            html = `<div class="rs-sum-txt"><span class="rs-spin"></span> ${esc(st.calculando)}</div>`;
        } else if (!st.plan) {
            html = '<div class="rs-sum-txt rs-muted">Elige un tamaño arriba para ver cómo quedará.</div>';
        } else {
            const p = st.plan;
            const [w, h] = dimsDe(p.factor);
            const prev = window.totalResizeFactor || 1;
            const total = prev * p.factor;
            let txt = `<b>${esc(p.titulo)}</b> → quedará en <b>${w} × ${h} px</b> (${pctTxt(p.factor)}${prev < 1 ? ', ' + pctTxt(total) + ' del original' : ''})`;
            const peso = p.bytes != null ? p.bytes : Peso.rapido(p.factor);
            if (peso != null) txt += ` · ${p.bytes != null && !esAstc() ? 'medido ' : ''}${fmtPeso(peso)}`;
            const up = window.uploadedAnimationJSON;
            txt += up
                ? ` · escala del JSON ${up.origScale} → <b>${Number((up.origScale / total).toFixed(4))}</b>`
                : ' · sube el .JSON (paso 2) para que el personaje se vea igual en el juego';
            html = `<div class="rs-sum-txt">${txt}</div>`;
            if (Math.max(w, h) > 4096) html += '<div class="rs-warn">⚠ Pasa de 4096 px: algunos celulares no cargan texturas tan grandes.</div>';
            if (Math.min(w, h) < 64) html += '<div class="rs-warn">⚠ Quedará muy pequeña: se verá borrosa en el juego.</div>';
        }
        const restaurar = typeof puedeRestaurarOriginal === 'function' && puedeRestaurarOriginal()
            ? '<button type="button" class="rs-link" data-accion="restaurar">↺ Volver al tamaño original</button>' : '';
        return `${html}<div class="rs-sum-actions">${restaurar}<button type="button" class="btn-pildora opt-go" data-accion="aplicar"${st.plan && !st.calculando ? '' : ' disabled'}>` +
            '<img src="https://cdn-icons-png.flaticon.com/128/8208/8208316.png" class="icon" alt=""> Reducir</button></div>';
    }

    function pintarResumen() {
        const r = document.getElementById('lblResizePreview');
        if (r) r.innerHTML = vistaResumen();
    }

    function marcar(key) {
        const c = cont();
        if (!c) return;
        c.querySelectorAll('[data-key]').forEach(b => b.classList.toggle('sel', b.dataset.key === key));
        c.querySelectorAll('[data-keybox]').forEach(b => b.classList.toggle('sel', b.dataset.keybox === key));
    }

    // ---------------------------------------------------------------
    // PINTAR
    // ---------------------------------------------------------------
    function refrescar() {
        const c = cont();
        if (!c) return;
        if (!listo()) {
            c.innerHTML = '<div class="opt-hint">Sube la imagen y el XML para ver los tamaños.</div>';
            return;
        }
        if (Peso.revisar()) { st.plan = null; st.calculando = null; }
        if (!esAstc() && !Peso.modelo && !Peso.preparando) Peso.preparar();
        // Mientras se escribe en un campo de la herramienta no se repinta (se perdería lo escrito)
        const foco = document.activeElement;
        if (foco && c.contains(foco) && (foco.tagName === 'INPUT' || foco.tagName === 'SELECT') && c.querySelector('.rs-body')) {
            pintarResumen();
            return;
        }
        st.opciones = new Map();
        const modo = MODOS.find(m => m.id === st.modo) || MODOS[0];
        const cuerpo = { facil: vistaFacil, pct: vistaPct, dim: vistaDim, peso: vistaPeso, combo: vistaCombo }[modo.id]();
        c.innerHTML =
            '<div class="rs-tabs" role="tablist">' + MODOS.map(m =>
                `<button type="button" role="tab" aria-selected="${m.id === modo.id}" class="rs-tab${m.id === modo.id ? ' sel' : ''}" data-modo="${m.id}"><span class="rs-tab-ico">${m.icono}</span>${m.nombre}</button>`).join('') +
            '</div>' +
            `<div class="rs-help">${esc(modo.ayuda)}</div>` +
            `<div class="rs-body">${cuerpo}</div>` +
            `<div id="lblResizePreview" class="rs-summary">${vistaResumen()}</div>`;
        actualizarCustom();
        // Medir de verdad las opciones visibles (las primeras), en segundo plano
        const visibles = [...st.opciones.values()].filter(o => o.factor && !o.disabled).slice(0, 6).map(o => o.factor);
        Peso.precalcular(visibles);
    }

    // Texto de resultado junto a los campos personalizados
    function actualizarCustom() {
        const pr = document.getElementById('rsPctRes');
        if (pr) pr.textContent = st.plan && st.plan.key === 'pct-custom' ? dimsDe(st.plan.factor).join(' × ') + ' px' : '';
        const dr = document.getElementById('rsDimRes');
        if (dr) dr.textContent = st.plan && st.plan.key === 'dim-custom' ? pctTxt(st.plan.factor) : '';
    }

    // ---------------------------------------------------------------
    // ACCIONES
    // ---------------------------------------------------------------
    function elegir(key) {
        const o = st.opciones.get(key);
        if (!o || o.disabled) return;
        if (o.pesoObjetivo) return elegirPorPeso(o.pesoObjetivo, key, o.titulo);
        st.plan = { key, factor: o.factor, titulo: o.tituloPlan || o.titulo };
        marcar(key);
        pintarResumen();
    }

    async function elegirPorPeso(T, key, titulo) {
        st.plan = null;
        st.calculando = `Midiendo la resolución para que pese ${titulo}…`;
        marcar(key);
        pintarResumen();
        try {
            const r = await Peso.factorParaPeso(T);
            st.calculando = null;
            if (r.yaCumple) {
                pintarResumen();
                return alert(`💡 Tu imagen ya pesa ${fmtBytes(r.bytes)} con el tamaño actual: no hace falta reducirla para quedar en ${titulo}.`);
            }
            if (!r.alcanzado) {
                pintarResumen();
                log('warn', `No se puede llegar a ${titulo}: aun al 2% pesa ${fmtBytes(r.bytes)}`);
                return alert(`⚠️ No se puede llegar a ${titulo}.\nAun reduciendo al 2% pesaría ${fmtBytes(r.bytes)}. Prueba con un peso mayor.`);
            }
            st.plan = {
                key, factor: r.factor, titulo: 'Peso ' + titulo, bytes: r.bytes,
                detalle: `Peso ${esAstc() ? 'del .astc' : 'medido del PNG'}: ${fmtBytes(r.bytes)} (objetivo ${titulo}).`
            };
            log('info', `Para pesar ${titulo}: ${pctTxt(r.factor)} (${dimsDe(r.factor).join('x')}) → ${fmtBytes(r.bytes)}`);
        } catch (err) {
            st.calculando = null;
            log('err', 'Error al calcular el peso: ' + (err.message || err));
            alert({ type: 'err', title: 'No se pudo calcular el peso', body: 'Prueba con «Porcentaje» o «Alto × Ancho».', detail: String(err.message || err) });
        }
        marcar(key);
        pintarResumen();
        actualizarCustom();
    }

    function leerPeso(idValor, idUnidad) {
        const v = parseFloat(document.getElementById(idValor)?.value);
        const u = document.getElementById(idUnidad)?.value || 'MB';
        if (!(v > 0)) return null;
        return v * (u === 'KB' ? 1024 : MB);
    }

    function pesoPersonalizado() {
        const T = leerPeso('rsPeso', 'rsPesoUnidad');
        if (!T) return alert('⚠️ Escribe cuánto quieres que pese (por ejemplo 1.5 MB).');
        elegirPorPeso(T, 'peso-custom', '≤ ' + fmtBytes(T));
    }

    async function calcularCombo() {
        const mw = parseInt(document.getElementById('rsCmbW')?.value);
        const mh = parseInt(document.getElementById('rsCmbH')?.value);
        const T = leerPeso('rsCmbP', 'rsCmbU');
        if (!(mw > 0) && !(mh > 0) && !T) return alert('⚠️ Escribe al menos un límite: ancho, alto o peso.');
        let fRes = 1, partes = [];
        if (mw > 0) { fRes = Math.min(fRes, mw / W()); partes.push(`ancho ≤ ${mw}`); }
        if (mh > 0) { fRes = Math.min(fRes, mh / H()); partes.push(`alto ≤ ${mh}`); }
        if (T) partes.push(`peso ≤ ${fmtBytes(T)}`);
        let fPeso = 1, bytes = null;
        if (T) {
            st.plan = null;
            st.calculando = `Midiendo la resolución para que pese ≤ ${fmtBytes(T)}…`;
            marcar('combo');
            pintarResumen();
            try {
                const r = await Peso.factorParaPeso(T);
                st.calculando = null;
                if (!r.alcanzado && !r.yaCumple) {
                    pintarResumen();
                    return alert(`⚠️ No se puede llegar a ${fmtBytes(T)}: aun al 2% pesaría ${fmtBytes(r.bytes)}.`);
                }
                fPeso = r.factor;
                bytes = r.bytes;
            } catch (err) {
                st.calculando = null;
                pintarResumen();
                return alert({ type: 'err', title: 'No se pudo calcular el peso', detail: String(err.message || err) });
            }
        }
        const f = Math.min(fRes, fPeso);
        if (f >= 0.9995) {
            st.plan = null;
            pintarResumen();
            return alert('💡 Tu imagen ya cumple esos límites: no hace falta reducirla.');
        }
        const manda = fPeso < fRes ? 'el peso' : 'la resolución';
        st.plan = {
            key: 'combo', factor: f, titulo: partes.join(' y '),
            bytes: fPeso < fRes ? bytes : null,
            detalle: `Límites: ${partes.join(', ')} (manda ${manda}).`
        };
        log('info', `Resolución + peso: ${partes.join(', ')} → ${pctTxt(f)} (manda ${manda})`);
        marcar('combo');
        pintarResumen();
    }

    function onClick(e) {
        const c = cont();
        const t = e.target.closest('button');
        if (!c || !t || !c.contains(t)) return;
        if (t.dataset.modo) {
            st.modo = t.dataset.modo;
            try { localStorage.setItem('rs_modo', st.modo); } catch (err) { }
            if (document.activeElement) document.activeElement.blur();
            refrescar();
            return;
        }
        if (t.dataset.vermas) {
            st.verMas[t.dataset.vermas] = !st.verMas[t.dataset.vermas];
            refrescar();
            return;
        }
        if (t.dataset.key) return elegir(t.dataset.key);
        const acc = t.dataset.accion;
        if (acc === 'aplicar') aplicarResizeOptimizador();
        else if (acc === 'restaurar') restaurarResolucionOriginal();
        else if (acc === 'peso-custom') pesoPersonalizado();
        else if (acc === 'combo') calcularCombo();
    }

    function onInput(e) {
        const id = e.target.id;
        if (id === 'rsPct') {
            const v = parseFloat(e.target.value);
            if (v >= 1 && v < 100) st.plan = { key: 'pct-custom', factor: v / 100, titulo: `${Math.round(v * 10) / 10}% (personalizado)` };
            else if (st.plan && st.plan.key === 'pct-custom') st.plan = null;
            marcar(st.plan ? st.plan.key : '');
            pintarResumen();
            actualizarCustom();
        } else if (id === 'rsAncho' || id === 'rsAlto') {
            const esAncho = id === 'rsAncho';
            const v = parseInt(e.target.value);
            const otro = document.getElementById(esAncho ? 'rsAlto' : 'rsAncho');
            if (v > 0) {
                const f = v / (esAncho ? W() : H());
                if (otro) otro.value = Math.max(1, Math.round((esAncho ? H() : W()) * f));
                if (f < 0.9995 && f > 0) {
                    st.plan = { key: 'dim-custom', factor: f, titulo: `${dimsDe(f).join(' × ')} px (personalizado)` };
                } else {
                    st.plan = null;
                }
            } else {
                if (otro) otro.value = '';
                if (st.plan && st.plan.key === 'dim-custom') st.plan = null;
            }
            marcar(st.plan ? st.plan.key : '');
            pintarResumen();
            actualizarCustom();
        }
    }

    function onKey(e) {
        if (e.key !== 'Enter') return;
        if (e.target.id === 'rsPeso') { e.preventDefault(); pesoPersonalizado(); }
        else if (['rsCmbW', 'rsCmbH', 'rsCmbP'].includes(e.target.id)) { e.preventDefault(); calcularCombo(); }
    }

    function iniciar() {
        const c = cont();
        if (!c) return;
        c.addEventListener('click', onClick);
        c.addEventListener('input', onInput);
        c.addEventListener('keydown', onKey);
        refrescar();
    }

    window.ResizeTool = {
        refrescar,
        planActual: () => st.plan,
        limpiarPlan: () => { st.plan = null; st.calculando = null; },
        elegir,
        Peso
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
})();
