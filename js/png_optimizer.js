/**
 * Optimizador de PNG (Spritesheet Generator FNF)
 *
 * Reduce el peso de un PNG como lo hacen pngquant / TinyPNG:
 *  1. Paleta de alta calidad: median cut + refinamiento k-means sobre los colores únicos (ponderados por
 *     cuántas veces aparecen), medido en un espacio que equivale EXACTAMENTE al error visible del sprite
 *     dibujado sobre un fondo oscuro y uno claro (colores premultiplicados por su alfa).
 *  2. Codificador PNG propio: paleta de 1/2/4/8 bits según los colores, tRNS solo con las entradas
 *     semitransparentes, y deflate al nivel máximo (pako nivel 9).
 *  3. Recomendación automática: el nivel más alto de compresión que mantiene la calidad objetivo.
 *
 * Requiere pako (deflate). Expone window.PNGOptimizer.
 */
(function (global) {
    'use strict';

    const MIN_COLORS = 16;
    const MAX_COLORS = 256;
    let WEIGHT_POWER = 0.75;
    // Calidad objetivo de la recomendación automática (PSNR visible). 36 dB = "muy buena": con la
    // protección de colores ninguna zona visible cambia de color (probado con BOYFRIEND: ~160 colores).
    const RECOMMENDED_PSNR = 36;
    const RECOMMENDED_GRADIENT_PSNR = 47;

    // ---------- Nivel de compresión <-> número de colores ----------
    // Nivel 0 = sin pérdida. Niveles 1-100 = de 256 colores a 16 (escala logarítmica, que es como cambia el peso).
    function levelToColors(level) {
        if (level <= 0) return 0;
        const t = (Math.min(100, level) - 1) / 99;
        return Math.max(MIN_COLORS, Math.round(MAX_COLORS * Math.pow(MIN_COLORS / MAX_COLORS, t)));
    }
    function colorsToLevel(colors) {
        if (!colors) return 0;
        const c = Math.max(MIN_COLORS, Math.min(MAX_COLORS, colors));
        return Math.max(1, Math.min(100, Math.round(1 + 99 * Math.log(c / MAX_COLORS) / Math.log(MIN_COLORS / MAX_COLORS))));
    }

    // ---------- Espacio de color ----------
    // El error de un píxel dibujado sobre un fondo bg es  ΔC = ΔP − bg·Δa  (P = color premultiplicado).
    // Sumado sobre fondo oscuro (30) y claro (230) se convierte en una distancia euclídea en este espacio:
    //   e_c = √2 · (P_c − 0.5098·A)    e_a = 0.9608·A
    // Así el k-means minimiza directamente el error que se ve en el juego.
    const SQ2 = Math.SQRT2, KA = 130 / 255, WA = Math.sqrt(60000 / 65025);
    function toFeature(r, g, b, a, out, o) {
        const f = a / 255;
        out[o] = SQ2 * (r * f - KA * a);
        out[o + 1] = SQ2 * (g * f - KA * a);
        out[o + 2] = SQ2 * (b * f - KA * a);
        out[o + 3] = WA * a;
    }
    function fromFeature(F, o) {
        let a = F[o + 3] / WA;
        if (a >= 252.5) a = 255;        // opaco de verdad: evita zonas "casi opacas" que dejan ver el fondo
        if (a < 1.5) return [0, 0, 0, 0];
        a = Math.round(Math.min(255, a));
        const conv = (v) => Math.max(0, Math.min(255, Math.round((v / SQ2 + KA * a) * 255 / a)));
        return [conv(F[o]), conv(F[o + 1]), conv(F[o + 2]), a];
    }

    // ---------- Análisis: colores únicos ----------
    function analyze(imageData) {
        const u32 = new Uint32Array(imageData.data.buffer, imageData.data.byteOffset, imageData.width * imageData.height);
        const map = new Map();
        const keys = [], counts = [];
        let prevKey = -1, prevId = -1, opaque = true, visible = 0, soft = 0;
        for (let i = 0; i < u32.length; i++) {
            let k = u32[i];
            if ((k >>> 24) === 0) k = 0;           // todo píxel invisible es el mismo color (0,0,0,0)
            if (k === prevKey) { counts[prevId]++; continue; }
            let id = map.get(k);
            if (id === undefined) { id = keys.length; map.set(k, id); keys.push(k); counts.push(0); }
            counts[id]++;
            prevKey = k; prevId = id;
        }
        const n = keys.length;
        const F = new Float32Array(n * 4);
        const W = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const k = keys[i];
            const a = k >>> 24;
            if (a !== 255) opaque = false;
            if (a > 0) visible += counts[i];
            if (a > 0 && a < 255) soft += counts[i];
            toFeature(k & 255, (k >>> 8) & 255, (k >>> 16) & 255, a, F, i * 4);
            W[i] = counts[i];
        }
        // Píxeles de degradado suave (brillos, auras): ni relleno plano ni borde. Ahí es donde, con pocos
        // colores, aparecen bandas/escalones aunque el error medio sea bajo.
        const w = imageData.width, h = imageData.height, step = w * h > 4e6 ? 2 : 1;
        const Ws = new Float64Array(n);
        let smooth = 0, pk = -1, pid = -1;
        const close = (a, b) => {
            if ((b >>> 24) === 0) return false;
            for (let s = 0; s < 32; s += 8) if (Math.abs(((a >>> s) & 255) - ((b >>> s) & 255)) > 10) return false;
            return true;
        };
        for (let y = 1; y < h - 1; y += step) {
            for (let x = 1; x < w - 1; x += step) {
                const i = y * w + x, k = u32[i];
                if ((k >>> 24) === 0) continue;
                const l = u32[i - 1], r = u32[i + 1], up = u32[i - w], dn = u32[i + w];
                if (l === k && r === k && up === k && dn === k) continue;
                if (!close(k, l) || !close(k, r) || !close(k, up) || !close(k, dn)) continue;
                const id = k === pk ? pid : map.get(k);
                pk = k; pid = id;
                Ws[id] += step * step;
                smooth += step * step;
            }
        }
        return { width: w, height: h, u32, map, keys: Uint32Array.from(keys), W, F, Ws, unique: n, opaque, visible: Math.max(1, visible), soft, smooth };
    }

    // ---------- Paleta inicial: median cut por varianza ----------
    function medianCut(F, W, n, K) {
        const idx = new Int32Array(n);
        for (let i = 0; i < n; i++) idx[i] = i;
        const stats = (s, e) => {
            const m = [0, 0, 0, 0], q = [0, 0, 0, 0];
            let w = 0;
            for (let t = s; t < e; t++) {
                const i = idx[t], wi = W[i], o = i * 4;
                w += wi;
                for (let c = 0; c < 4; c++) { const v = F[o + c]; m[c] += wi * v; q[c] += wi * v * v; }
            }
            const sse = [0, 0, 0, 0];
            let total = 0;
            for (let c = 0; c < 4; c++) { sse[c] = Math.max(0, q[c] - m[c] * m[c] / w); total += sse[c]; m[c] /= w; }
            return { s, e, w, mean: m, sse, total };
        };
        const boxes = [stats(0, n)];
        while (boxes.length < K) {
            let bi = -1, bt = 0;
            for (let b = 0; b < boxes.length; b++) {
                if (boxes[b].e - boxes[b].s > 1 && boxes[b].total > bt) { bt = boxes[b].total; bi = b; }
            }
            if (bi < 0) break;
            const box = boxes[bi];
            let c = 0;
            for (let k = 1; k < 4; k++) if (box.sse[k] > box.sse[c]) c = k;
            const sub = idx.subarray(box.s, box.e);
            sub.sort((a, b) => F[a * 4 + c] - F[b * 4 + c]);
            // Punto de corte que minimiza el error de las dos mitades en ese canal
            let tw = 0, tx = 0, txx = 0;
            for (let t = box.s; t < box.e; t++) { const i = idx[t], v = F[i * 4 + c], wi = W[i]; tw += wi; tx += wi * v; txx += wi * v * v; }
            let lw = 0, lx = 0, lxx = 0, best = Infinity, cut = box.s;
            for (let t = box.s; t < box.e - 1; t++) {
                const i = idx[t], v = F[i * 4 + c], wi = W[i];
                lw += wi; lx += wi * v; lxx += wi * v * v;
                const rw = tw - lw, rx = tx - lx, rxx = txx - lxx;
                const e = (lxx - lx * lx / lw) + (rxx - rx * rx / rw);
                if (e < best) { best = e; cut = t; }
            }
            boxes.splice(bi, 1, stats(box.s, cut + 1), stats(cut + 1, box.e));
        }
        const P = new Float32Array(boxes.length * 4);
        boxes.forEach((b, j) => { for (let c = 0; c < 4; c++) P[j * 4 + c] = b.mean[c]; });
        return P;
    }

    // Color de la paleta más cercano (con salida temprana)
    let lastDist = 0;
    function nearest(F, o, P, K) {
        const f0 = F[o], f1 = F[o + 1], f2 = F[o + 2], f3 = F[o + 3];
        let best = Infinity, bj = 0;
        for (let j = 0, p = 0; j < K; j++, p += 4) {
            let t = f3 - P[p + 3], d = t * t;
            if (d >= best) continue;
            t = f1 - P[p + 1]; d += t * t;
            if (d >= best) continue;
            t = f0 - P[p]; d += t * t;
            if (d >= best) continue;
            t = f2 - P[p + 2]; d += t * t;
            if (d < best) { best = d; bj = j; }
        }
        lastDist = best;
        return bj;
    }

    // ---------- Refinamiento k-means (Lloyd) ----------
    function kmeans(F, W, n, P, iterations, locked) {
        const K = P.length / 4;
        const sums = new Float64Array(K * 4), ws = new Float64Array(K);
        for (let it = 0; it < iterations; it++) {
            sums.fill(0); ws.fill(0);
            let worst = -1, worstErr = -1;
            for (let i = 0; i < n; i++) {
                const o = i * 4, j = nearest(F, o, P, K), wi = W[i];
                ws[j] += wi;
                sums[j * 4] += wi * F[o]; sums[j * 4 + 1] += wi * F[o + 1]; sums[j * 4 + 2] += wi * F[o + 2]; sums[j * 4 + 3] += wi * F[o + 3];
                const e = lastDist * wi;
                if (e > worstErr) { worstErr = e; worst = i; }
            }
            let moved = 0;
            for (let j = 0; j < K; j++) {
                if (locked && locked[j]) continue;          // color protegido: no se mueve
                if (ws[j] > 0) {
                    for (let c = 0; c < 4; c++) {
                        const v = sums[j * 4 + c] / ws[j];
                        moved += Math.abs(v - P[j * 4 + c]);
                        P[j * 4 + c] = v;
                    }
                } else if (worst >= 0) {
                    // Color de la paleta sin uso: se reubica en el color peor representado
                    for (let c = 0; c < 4; c++) P[j * 4 + c] = F[worst * 4 + c];
                    worst = -1;
                }
            }
            if (moved < 0.05 * K) break;
        }
        return P;
    }

    // Los dos colores de la paleta más cercanos (para saber cuánto costaría quitar una entrada)
    function nearest2(F, o, P, K) {
        const f0 = F[o], f1 = F[o + 1], f2 = F[o + 2], f3 = F[o + 3];
        let d1 = Infinity, d2 = Infinity, j1 = 0;
        for (let j = 0, p = 0; j < K; j++, p += 4) {
            let t = f3 - P[p + 3], d = t * t;
            if (d >= d2) continue;
            t = f1 - P[p + 1]; d += t * t;
            if (d >= d2) continue;
            t = f0 - P[p]; d += t * t;
            if (d >= d2) continue;
            t = f2 - P[p + 2]; d += t * t;
            if (d < d1) { d2 = d1; d1 = d; j1 = j; } else if (d < d2) { d2 = d; }
        }
        return { j1, d1, d2 };
    }

    // Protección de colores distintos: una zona visible (suficientes píxeles del mismo color) nunca debe
    // cambiar mucho de color (ej. el micrófono verde volviéndose gris). Si pasa, la entrada de la paleta
    // que menos falta hace se reemplaza por ese color y se reajusta.
    function protectDistinctColors(an, P, train, maxRounds) {
        const K = P.length / 4;
        const minCount = Math.max(24, an.visible * 0.00005);
        const maxErr = 6 * 10 * 10;          // ~10 niveles de diferencia visible por canal
        const candidates = [];
        for (let i = 0; i < an.unique; i++) if (an.W[i] >= minCount && an.keys[i] !== 0) candidates.push(i);
        const locked = new Uint8Array(K);
        // Como máximo una cuarta parte de la paleta: con muy pocos colores, proteger demasiados
        // dejaría sin colores al resto de la imagen
        const rounds = Math.min(maxRounds, Math.floor(K / 4));
        for (let r = 0; r < rounds; r++) {
            let worst = -1, worstD = maxErr;
            for (const i of candidates) {
                const j = nearest(an.F, i * 4, P, K);
                if (lastDist > worstD) { worstD = lastDist; worst = i; }
            }
            if (worst < 0) break;
            // Costo de quitar cada entrada = error extra de sus colores al pasar al segundo más cercano
            const cost = new Float64Array(K);
            for (let i = 0; i < train.n; i++) {
                const n2 = nearest2(train.F, i * 4, P, K);
                cost[n2.j1] += train.W[i] * (n2.d2 - n2.d1);
            }
            let jmin = -1, cmin = Infinity;
            for (let j = 0; j < K; j++) if (!locked[j] && cost[j] < cmin) { cmin = cost[j]; jmin = j; }
            if (jmin < 0) break;
            for (let c = 0; c < 4; c++) P[jmin * 4 + c] = an.F[worst * 4 + c];
            locked[jmin] = 1;                 // no se vuelve a quitar ni se mueve con el k-means
        }
        return locked;
    }

    // Muestra ponderada de colores únicos para que imágenes con muchísimos colores sigan siendo rápidas
    function sampleForTraining(an, maxSamples) {
        if (an.unique <= maxSamples) return { F: an.F, W: an.W, n: an.unique };
        const order = Array.from({ length: an.unique }, (_, i) => i).sort((a, b) => an.W[b] - an.W[a]);
        const top = Math.floor(maxSamples / 2);
        const rest = an.unique - top;
        const step = rest / (maxSamples - top);
        const pick = order.slice(0, top);
        let restWeight = 0, pickedRest = 0;
        for (let t = top; t < an.unique; t++) restWeight += an.W[order[t]];
        const sampled = [];
        for (let x = top; x < an.unique && sampled.length < maxSamples - top; x += step) sampled.push(order[Math.floor(x)]);
        for (const i of sampled) pickedRest += an.W[i];
        const scale = pickedRest > 0 ? restWeight / pickedRest : 1;
        const all = pick.concat(sampled);
        const F = new Float32Array(all.length * 4), W = new Float64Array(all.length);
        all.forEach((i, t) => { F.set(an.F.subarray(i * 4, i * 4 + 4), t * 4); W[t] = t < top ? an.W[i] : an.W[i] * scale; });
        return { F, W, n: all.length };
    }

    // ---------- Cuantización completa ----------
    // Devuelve la paleta final (RGBA enteros, ordenada: semitransparentes primero) y el índice de cada color único.
    function quantize(an, K, opts = {}) {
        if (an.unique <= K) {
            // Ya cabe en la paleta: sin pérdida
            const rgba = new Uint8Array(an.unique * 4);
            for (let i = 0; i < an.unique; i++) {
                const k = an.keys[i];
                rgba[i * 4] = k & 255; rgba[i * 4 + 1] = (k >>> 8) & 255; rgba[i * 4 + 2] = (k >>> 16) & 255; rgba[i * 4 + 3] = k >>> 24;
            }
            const map = new Int32Array(an.unique).map((_, i) => i);
            return finalizePalette(rgba, an.unique, map, an, true);
        }
        const train = sampleForTraining(an, opts.maxSamples || 40000);
        // Peso = píxeles^p (p < 1): los colores de zonas pequeñas pero distintas (un micrófono, unos ojos)
        // no se pierden frente a los rellenos grandes, igual que hace pngquant.
        const p = opts.weightPower !== undefined ? opts.weightPower : WEIGHT_POWER;
        if (p !== 1) {
            const Wt = new Float64Array(train.n);
            for (let i = 0; i < train.n; i++) Wt[i] = Math.pow(train.W[i], p);
            train.W = Wt;
        }
        // Si hay píxeles invisibles se reserva un hueco para el color transparente exacto
        // (PNG admite como máximo 256 colores en la paleta)
        const Kq = an.map.has(0) ? K - 1 : K;
        let P = medianCut(train.F, train.W, train.n, Kq);
        P = kmeans(train.F, train.W, train.n, P, opts.iterations || 8);
        // Proteger zonas de color distinto (y reajustar el resto de la paleta alrededor de ellas)
        const locked = protectDistinctColors(an, P, train, opts.protectRounds !== undefined ? opts.protectRounds : 32);
        if (locked.some(v => v)) P = kmeans(train.F, train.W, train.n, P, 3, locked);

        // Paleta en enteros (lo que realmente se guarda) y sin duplicados
        const Kp = P.length / 4;
        const seen = new Map();
        const ints = [];
        for (let j = 0; j < Kp; j++) {
            const c = fromFeature(P, j * 4);
            const key = (c[0] | (c[1] << 8) | (c[2] << 16) | (c[3] << 24)) >>> 0;
            if (!seen.has(key)) { seen.set(key, ints.length); ints.push(c); }
        }
        // Si hay píxeles invisibles, asegurar una entrada totalmente transparente exacta
        if (an.map.has(0) && !seen.has(0)) ints.push([0, 0, 0, 0]);
        if (ints.length > MAX_COLORS) throw new Error("paleta de más de 256 colores");
        const rgba = new Uint8Array(ints.length * 4);
        ints.forEach((c, j) => rgba.set(c, j * 4));
        const PF = new Float32Array(ints.length * 4);
        ints.forEach((c, j) => toFeature(c[0], c[1], c[2], c[3], PF, j * 4));
        // Asignar cada color único a su color final más cercano
        const map = new Int32Array(an.unique);
        for (let i = 0; i < an.unique; i++) map[i] = an.keys[i] === 0 ? ints.findIndex(c => c[3] === 0) : nearest(an.F, i * 4, PF, ints.length);
        return finalizePalette(rgba, ints.length, map, an, false);
    }

    // Ordena la paleta (semitransparentes primero, para que tRNS sea corto), calcula la calidad (PSNR visible)
    function finalizePalette(rgba, K, map, an, lossless) {
        const order = Array.from({ length: K }, (_, j) => j).sort((a, b) => {
            const aa = rgba[a * 4 + 3], ab = rgba[b * 4 + 3];
            if ((aa < 255) !== (ab < 255)) return aa < 255 ? -1 : 1;
            if (aa < 255) return aa - ab;
            const la = rgba[a * 4] * 299 + rgba[a * 4 + 1] * 587 + rgba[a * 4 + 2] * 114;
            const lb = rgba[b * 4] * 299 + rgba[b * 4 + 1] * 587 + rgba[b * 4 + 2] * 114;
            return la - lb;
        });
        const remap = new Int32Array(K);
        const palette = new Uint8Array(K * 4);
        order.forEach((old, j) => { remap[old] = j; palette.set(rgba.subarray(old * 4, old * 4 + 4), j * 4); });
        const index = new Int32Array(an.unique);
        let se = 0, seSoft = 0, seSmooth = 0;
        const PF = new Float32Array(K * 4);
        for (let j = 0; j < K; j++) toFeature(palette[j * 4], palette[j * 4 + 1], palette[j * 4 + 2], palette[j * 4 + 3], PF, j * 4);
        for (let i = 0; i < an.unique; i++) {
            const j = remap[map[i]];
            index[i] = j;
            if (!lossless) {
                let d = 0;
                for (let c = 0; c < 4; c++) { const t = an.F[i * 4 + c] - PF[j * 4 + c]; d += t * t; }
                se += d * an.W[i];
                const ai = an.keys[i] >>> 24;
                if (ai > 0 && ai < 255) seSoft += d * an.W[i];
                seSmooth += d * an.Ws[i];
            }
        }
        const mse = se / (an.visible * 6);
        // Calidad solo en zonas semitransparentes (brillos, auras, bordes suaves): ahí se notan las bandas
        const mseSoft = an.soft > 0 ? seSoft / (an.soft * 6) : 0;
        const psnrSoft = lossless || mseSoft === 0 ? Infinity : 10 * Math.log10(255 * 255 / mseSoft);
        // Calidad en degradados suaves (riesgo de bandas)
        const mseSmooth = an.smooth > 0 ? seSmooth / (an.smooth * 6) : 0;
        const psnrSmooth = lossless || mseSmooth === 0 ? Infinity : 10 * Math.log10(255 * 255 / mseSmooth);
        const psnr = lossless || mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse);
        let transparentCount = 0;
        while (transparentCount < K && palette[transparentCount * 4 + 3] < 255) transparentCount++;
        return { palette, colors: K, index, psnr, psnrSoft, psnrSmooth, lossless, transparentCount };
    }

    // ---------- Codificador PNG ----------
    const CRC_TABLE = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
        return t;
    })();
    function crc32(bytes) {
        let c = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
        return (c ^ 0xFFFFFFFF) >>> 0;
    }
    function chunk(type, data) {
        const out = new Uint8Array(12 + data.length);
        const dv = new DataView(out.buffer);
        dv.setUint32(0, data.length);
        for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
        out.set(data, 8);
        dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
        return out;
    }
    function ihdr(w, h, depth, colorType) {
        const d = new Uint8Array(13), dv = new DataView(d.buffer);
        dv.setUint32(0, w); dv.setUint32(4, h);
        d[8] = depth; d[9] = colorType; d[10] = 0; d[11] = 0; d[12] = 0;
        return chunk('IHDR', d);
    }
    function concat(parts) {
        const len = parts.reduce((s, p) => s + p.length, 0);
        const out = new Uint8Array(len);
        let o = 0;
        for (const p of parts) { out.set(p, o); o += p.length; }
        return out;
    }
    const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    function deflate(raw) {
        return global.pako.deflate(raw, { level: 9, memLevel: 9 });
    }

    // Índice de paleta de cada píxel (sin difuminado): cada color único va a su color más cercano
    function buildIndexPlain(an, q) {
        const n = an.width * an.height, u32 = an.u32, map = an.map, index = q.index;
        const out = new Uint8Array(n);
        let prevKey = -1, prevIdx = 0;
        for (let i = 0; i < n; i++) {
            let k = u32[i];
            if ((k >>> 24) === 0) k = 0;
            if (k !== prevKey) { prevKey = k; prevIdx = index[map.get(k)]; }
            out[i] = prevIdx;
        }
        return out;
    }

    // Difuminado selectivo (Floyd-Steinberg, como pngquant): SOLO en degradados suaves (brillos, auras),
    // donde reducir colores formaría bandas. Contornos, bordes duros y rellenos planos no se tocan,
    // así los sprites de FNF siguen nítidos y comprimen bien.
    function buildIndexDithered(an, q, strength) {
        const w = an.width, h = an.height, u32 = an.u32, K = q.colors;
        const plain = buildIndexPlain(an, q);
        const PF = new Float32Array(K * 4);
        for (let j = 0; j < K; j++) toFeature(q.palette[j * 4], q.palette[j * 4 + 1], q.palette[j * 4 + 2], q.palette[j * 4 + 3], PF, j * 4);
        // Zona suave: visible, sin coincidencia exacta en la paleta, y sin saltos bruscos con sus 4 vecinos
        const smoothAt = (i, x, y) => {
            const k = u32[i];
            if ((k >>> 24) === 0) return false;
            const near = (k2) => {
                if ((k2 >>> 24) === 0) return false;
                for (let s = 0; s < 32; s += 8) if (Math.abs(((k >>> s) & 255) - ((k2 >>> s) & 255)) > 14) return false;
                return true;
            };
            if (x > 0 && !near(u32[i - 1])) return false;
            if (x < w - 1 && !near(u32[i + 1])) return false;
            if (y > 0 && !near(u32[i - w])) return false;
            if (y < h - 1 && !near(u32[i + w])) return false;
            // Relleno plano (los 4 vecinos iguales): no es degradado, no se difumina (evita puntitos)
            if (x > 0 && x < w - 1 && y > 0 && y < h - 1 &&
                u32[i - 1] === k && u32[i + 1] === k && u32[i - w] === k && u32[i + w] === k) return false;
            return true;
        };
        let errCur = new Float32Array((w + 2) * 4), errNext = new Float32Array((w + 2) * 4);
        const f = new Float32Array(4);
        const out = plain;
        const MAXE = 40;                        // límite del error acumulado (evita "gusanos" de color)
        for (let y = 0; y < h; y++) {
            const ltr = (y & 1) === 0;           // recorrido en serpiente
            for (let t = 0; t < w; t++) {
                const x = ltr ? t : w - 1 - t;
                const i = y * w + x;
                const eo = (x + 1) * 4;
                if (!smoothAt(i, x, y)) { errCur[eo] = errCur[eo + 1] = errCur[eo + 2] = errCur[eo + 3] = 0; continue; }
                const k = u32[i];
                toFeature(k & 255, (k >>> 8) & 255, (k >>> 16) & 255, k >>> 24, f, 0);
                for (let c = 0; c < 4; c++) f[c] += Math.max(-MAXE, Math.min(MAXE, errCur[eo + c] * strength));
                const j = nearest(f, 0, PF, K);
                out[i] = j;
                // Repartir el error entre los vecinos que aún no se procesan
                const dir = ltr ? 1 : -1;
                for (let c = 0; c < 4; c++) {
                    const e = f[c] - PF[j * 4 + c];
                    errCur[eo + dir * 4 + c] += e * 7 / 16;
                    errNext[eo - dir * 4 + c] += e * 3 / 16;
                    errNext[eo + c] += e * 5 / 16;
                    errNext[eo + dir * 4 + c] += e * 1 / 16;
                }
            }
            const tmp = errCur; errCur = errNext; errNext = tmp; errNext.fill(0);
        }
        return out;
    }

    // Calidad real (PSNR visible) de un índice de píxeles ya decidido
    function measureIndex(an, q, idx) {
        const K = q.colors, PF = new Float32Array(K * 4), f = new Float32Array(4);
        for (let j = 0; j < K; j++) toFeature(q.palette[j * 4], q.palette[j * 4 + 1], q.palette[j * 4 + 2], q.palette[j * 4 + 3], PF, j * 4);
        let se = 0;
        for (let i = 0; i < idx.length; i++) {
            const k = an.u32[i];
            if ((k >>> 24) === 0) continue;
            toFeature(k & 255, (k >>> 8) & 255, (k >>> 16) & 255, k >>> 24, f, 0);
            const j = idx[i] * 4;
            for (let c = 0; c < 4; c++) { const t = f[c] - PF[j + c]; se += t * t; }
        }
        const mse = se / (an.visible * 6);
        return mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse);
    }

    // Paleta de 1/2/4/8 bits por píxel
    function encodeIndexed(an, q, idx) {
        const w = an.width, h = an.height, K = q.colors;
        const depth = K <= 2 ? 1 : K <= 4 ? 2 : K <= 16 ? 4 : 8;
        const rowBytes = Math.ceil(w * depth / 8);
        const raw = new Uint8Array(h * (rowBytes + 1));
        const perByte = 8 / depth;
        for (let y = 0; y < h; y++) {
            const ro = y * (rowBytes + 1) + 1;   // filtro 0 (None): lo mejor para imágenes de paleta
            if (depth === 8) { raw.set(idx.subarray(y * w, (y + 1) * w), ro); continue; }
            for (let x = 0; x < w; x++) raw[ro + ((x / perByte) | 0)] |= idx[y * w + x] << (8 - depth * (1 + (x % perByte)));
        }
        const plte = new Uint8Array(K * 3);
        for (let j = 0; j < K; j++) { plte[j * 3] = q.palette[j * 4]; plte[j * 3 + 1] = q.palette[j * 4 + 1]; plte[j * 3 + 2] = q.palette[j * 4 + 2]; }
        const parts = [SIGNATURE, ihdr(w, h, depth, 3), chunk('PLTE', plte)];
        if (q.transparentCount > 0) {
            const trns = new Uint8Array(q.transparentCount);
            for (let j = 0; j < q.transparentCount; j++) trns[j] = q.palette[j * 4 + 3];
            parts.push(chunk('tRNS', trns));
        }
        parts.push(chunk('IDAT', deflate(raw)), chunk('IEND', new Uint8Array(0)));
        return concat(parts);
    }

    // Sin pérdida con más de 256 colores: RGBA (o RGB si es todo opaco).
    // Se prueban "sin filtro" y "filtro adaptativo por fila" y se queda el más pequeño
    // (en sprites con mucho fondo transparente suele ganar "sin filtro").
    function encodeTruecolor(an) {
        const a = encodeTruecolorWith(an, false);
        if (an.width * an.height > 16e6) return a;     // imágenes gigantes: la segunda prueba tardaría demasiado
        const b = encodeTruecolorWith(an, true);
        return a.length <= b.length ? a : b;
    }
    function encodeTruecolorWith(an, adaptive) {
        const w = an.width, h = an.height, bpp = an.opaque ? 3 : 4;
        const rowBytes = w * bpp;
        const raw = new Uint8Array(h * (rowBytes + 1));
        const src = new Uint8Array(an.u32.buffer, an.u32.byteOffset, w * h * 4);
        let prev = new Uint8Array(rowBytes), cur = new Uint8Array(rowBytes);
        const cand = [0, 1, 2, 3, 4].map(() => new Uint8Array(rowBytes));
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const s = (y * w + x) * 4, d = x * bpp;
                const invisible = src[s + 3] === 0;
                cur[d] = invisible ? 0 : src[s]; cur[d + 1] = invisible ? 0 : src[s + 1]; cur[d + 2] = invisible ? 0 : src[s + 2];
                if (bpp === 4) cur[d + 3] = src[s + 3];
            }
            if (!adaptive) {
                const ro = y * (rowBytes + 1);
                raw[ro] = 0;
                raw.set(cur, ro + 1);
                const t = prev; prev = cur; cur = t;
                continue;
            }
            let bestF = 0, bestSum = Infinity;
            for (let f = 0; f < 5; f++) {
                const out = cand[f];
                let sum = 0;
                for (let i = 0; i < rowBytes; i++) {
                    const a = i >= bpp ? cur[i - bpp] : 0, b = y > 0 ? prev[i] : 0, c = (i >= bpp && y > 0) ? prev[i - bpp] : 0;
                    let pred = 0;
                    if (f === 1) pred = a;
                    else if (f === 2) pred = b;
                    else if (f === 3) pred = (a + b) >> 1;
                    else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
                    const v = (cur[i] - pred) & 255;
                    out[i] = v;
                    sum += v < 128 ? v : 256 - v;
                }
                if (sum < bestSum) { bestSum = sum; bestF = f; }
            }
            const ro = y * (rowBytes + 1);
            raw[ro] = bestF;
            raw.set(cand[bestF], ro + 1);
            const t = prev; prev = cur; cur = t;
        }
        const parts = [SIGNATURE, ihdr(w, h, 8, an.opaque ? 2 : 6), chunk('IDAT', deflate(raw)), chunk('IEND', new Uint8Array(0))];
        return concat(parts);
    }

    // ---------- API ----------
    // level 0 = sin pérdida · 1..100 = más compresión (menos colores)
    function compress(an, level, opts = {}) {
        const colors = levelToColors(level);
        if (colors === 0) {
            if (an.unique <= MAX_COLORS) {
                const q = quantize(an, an.unique);
                return { bytes: encodeIndexed(an, q, buildIndexPlain(an, q)), colors: q.colors, psnr: Infinity, lossless: true, dithered: false };
            }
            return { bytes: encodeTruecolor(an), colors: an.unique, psnr: Infinity, lossless: true, dithered: false };
        }
        const q = quantize(an, colors, { iterations: opts.iterations || 8 });
        // Difuminado selectivo solo si se pide ({ dither: true }): en sprites de FNF suele sumar peso sin mejorar
        const dither = opts.dither === true && !q.lossless;
        const idx = dither ? buildIndexDithered(an, q, opts.ditherStrength || 0.85) : buildIndexPlain(an, q);
        const psnr = dither ? measureIndex(an, q, idx) : q.psnr;
        return { bytes: encodeIndexed(an, q, idx), colors: q.colors, psnr, psnrSoft: q.psnrSoft, psnrSmooth: q.psnrSmooth, lossless: q.lossless, dithered: dither };
    }

    // Calidad estimada rápida (para mover la barra sin esperar)
    function estimateQuality(an, level) {
        const colors = levelToColors(level);
        if (colors === 0 || an.unique <= colors) return { colors: colors || an.unique, psnr: Infinity, psnrSoft: Infinity, psnrSmooth: Infinity };
        const q = quantize(an, colors, { iterations: 3, maxSamples: 12000, protectRounds: 16 });
        return { colors: q.colors, psnr: q.psnr, psnrSoft: q.psnrSoft, psnrSmooth: q.psnrSmooth };
    }

    // Nivel recomendado: la mayor compresión que mantiene la calidad objetivo (dB de PSNR visible)
    function recommend(an, targetPsnr = RECOMMENDED_PSNR) {
        if (an.unique <= MAX_COLORS) {
            return { level: colorsToLevel(Math.max(MIN_COLORS, an.unique)), colors: an.unique, psnr: Infinity, lossless: true };
        }
        // Si la imagen tiene degradados grandes (brillos, auras amplias: 5% o más de lo visible), también se
        // exige que ahí no aparezcan bandas. Probado: soul (17% de degradado) necesita ≥ 47 dB en degradados
        // (~190 colores); BOYFRIEND (3%) se ve igual al original con ~140 colores.
        const gradientFraction = an.smooth / an.visible;
        const needSmooth = gradientFraction >= 0.05 ? RECOMMENDED_GRADIENT_PSNR : -Infinity;
        let lo = 1, hi = 100, best = 1, bestQ = null;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            const q = estimateQuality(an, mid);
            if (q.psnr >= targetPsnr && q.psnrSmooth >= needSmooth) { best = mid; bestQ = q; lo = mid + 1; } else { hi = mid - 1; }
        }
        if (!bestQ) bestQ = estimateQuality(an, 1);
        return { level: best, colors: bestQ.colors, psnr: bestQ.psnr, lossless: false, largeGradients: needSmooth > 0 };
    }

    function qualityLabel(psnr) {
        if (!isFinite(psnr)) return 'Idéntica (sin pérdida)';
        if (psnr >= 42) return 'Idéntica a simple vista';
        if (psnr >= 38) return 'Excelente';
        if (psnr >= 35.5) return 'Muy buena';
        if (psnr >= 32) return 'Aceptable (cambios leves de tono)';
        return 'Baja (se notan los cambios)';
    }

    global.PNGOptimizer = { analyze, compress, estimateQuality, recommend, levelToColors, colorsToLevel, qualityLabel, setWeightPower: (p) => { WEIGHT_POWER = p; } };
})(typeof window !== 'undefined' ? window : this);
