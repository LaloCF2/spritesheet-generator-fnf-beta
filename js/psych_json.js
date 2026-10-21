// Cálculo compartido de compensación Psych Engine (escala, posición y cámara) al reducir la resolución.
// Lo usan el Optimizador PNG/ASTC + XML y Convertir PNG a ASTC.
//
// =========================================================================
// MODELO DE CÓMO PSYCH ENGINE (HAXEFLIXEL) DIBUJA UN PERSONAJE
// =========================================================================
// Al crear el personaje, Psych carga el atlas y aplica la escala del JSON con updateHitbox():
//   - origin  = centro del PRIMER frame del XML (frameWidth/2, frameHeight/2)   -> pivote de la escala
//   - hitbox  = frameWidth y frameHeight de ese primer frame × escala          -> lo que sigue la cámara
// Después cada animación pone su offset. Un punto p del frame (sin recortar) se ve en pantalla en:
//     pantalla = (p − origin) × escala + origin + position − offset
// y la cámara apunta al centro del hitbox:  centro = position + (anchoFrame0 × escala) / 2
//     jugador:  camX = centro.x − 100 − camera_position[0]     camY = centro.y − 100 + camera_position[1]
//     oponente: camX = centro.x + 150 + camera_position[0]     camY = centro.y − 100 + camera_position[1]
//     GF:       camX = centro.x + camera_position[0]           camY = centro.y + camera_position[1]
// Si la textura se reduce por un factor f (todo el XML × f) y la escala pasa a escala/f, para que cada
// punto quede EXACTAMENTE donde estaba:
//     Δposition = origin₀ × (1 − escala) − origin₀' × (1 − escala')      (origin₀' = primer frame nuevo)
//     Δcentro   = Δposition + (anchoFrame0' × escala' − anchoFrame0 × escala) / 2
//     Δcamera_position: jugador X = +Δcentro.x · oponente/GF X = −Δcentro.x · Y = −Δcentro.y
// Si el primer frame es el mismo (solo escalado) esto es  Δposition = (frameWidth₀/2) × (1 − f).

// Rol del personaje: decide el signo de la cámara en X. 'auto' lo deduce del JSON.
function detectarRolPsych(json) {
    if (json && typeof json._editor_isPlayer === 'boolean') return json._editor_isPlayer ? 'player' : 'opponent';
    const img = json && json.image ? String(json.image).toLowerCase() : '';
    if (/(^|[\/_\-])gf([\/_\-]|$)|girlfriend/.test(img)) return 'gf';
    if (json && json.flip_x === true) return 'player';
    if (/(^|[\/_\-])bf([\/_\-]|$)|boyfriend|player/.test(img)) return 'player';
    return 'opponent';
}

function nombreRolPsych(rol) {
    return { player: 'Jugador (BF)', opponent: 'Oponente', gf: 'GF (acompañante)' }[rol] || rol;
}

function primerFrameDe(sprites, usarOriginal) {
    if (!Array.isArray(sprites) || !sprites.length) return null;
    const s = sprites[0];
    return usarOriginal
        ? { name: s.name, fw: s.origFrameWidth || s.frameWidth || s.w, fh: s.origFrameHeight || s.frameHeight || s.h }
        : { name: s.name, fw: s.frameWidth || s.w, fh: s.frameHeight || s.h };
}

// sprites (opcional): [{ name, w, h, frameWidth, frameHeight, origFrameWidth, origFrameHeight }] en el orden del XML.
// Si no se pasa, se usan los fotogramas cargados en el Optimizador (spritesDetectados).
// opts: { frame0Orig: {fw, fh}, frame0New: {fw, fh}, role: 'auto'|'player'|'opponent'|'gf' }
function calcularAjustePsychJson(originalJson, resizeFactor, sprites, opts = {}) {
    if (!originalJson) return null;
    const enOptimizador = !Array.isArray(sprites);
    if (enOptimizador) {
        sprites = (typeof spritesDetectados !== 'undefined' && Array.isArray(spritesDetectados)) ? spritesDetectados : [];
    }
    let json = JSON.parse(JSON.stringify(originalJson));
    let factor = (typeof resizeFactor === 'number' && resizeFactor > 0 && resizeFactor < 1.0) ? resizeFactor : 1.0;

    let origScale = typeof json.scale === 'number' ? json.scale : 1;
    let origPos = (Array.isArray(json.position) && json.position.length >= 2)
        ? [Number(json.position[0]) || 0, Number(json.position[1]) || 0]
        : [0, 0];
    let origCamPos = (Array.isArray(json.camera_position) && json.camera_position.length >= 2)
        ? [Number(json.camera_position[0]) || 0, Number(json.camera_position[1]) || 0]
        : [0, 0];

    // Primer frame del atlas ORIGINAL (el que usaba Psych) y del atlas que se va a exportar
    const f0 = opts.frame0Orig
        || (enOptimizador && window.atlasFrame0Original)
        || primerFrameDe(sprites, true)
        || { fw: 400, fh: 400, name: '' };
    const f1 = opts.frame0New
        || (enOptimizador ? primerFrameDe(sprites, false) : null)
        || { fw: Math.round(f0.fw * factor), fh: Math.round(f0.fh * factor), name: f0.name };

    const rolPedido = opts.role || window.psychCharRole || 'auto';
    const rol = rolPedido === 'auto' ? detectarRolPsych(json) : rolPedido;
    const isPlayer = rol === 'player';

    // Escala compensatoria (el sprite reducido se ve del mismo tamaño en pantalla)
    let newScale = factor < 1 ? Number((origScale / factor).toFixed(4)) : origScale;
    json.scale = newScale;

    const dX = (f0.fw / 2) * (1 - origScale) - (f1.fw / 2) * (1 - newScale);
    const dY = (f0.fh / 2) * (1 - origScale) - (f1.fh / 2) * (1 - newScale);
    const midX = dX + (f1.fw * newScale - f0.fw * origScale) / 2;
    const midY = dY + (f1.fh * newScale - f0.fh * origScale) / 2;

    const deltaX = Math.round(dX);
    const deltaY = Math.round(dY);
    const deltaCamX = Math.round(isPlayer ? midX : -midX);
    const deltaCamY = Math.round(-midY);

    const newPos = [origPos[0] + deltaX, origPos[1] + deltaY];
    const newCamPos = [origCamPos[0] + deltaCamX, origCamPos[1] + deltaCamY];
    json.position = newPos;
    json.camera_position = newCamPos;

    return {
        json: json,
        origScale: origScale,
        newScale: newScale,
        origPos: origPos,
        newPos: newPos,
        origCamPos: origCamPos,
        newCamPos: newCamPos,
        deltaX: deltaX,
        deltaY: deltaY,
        deltaCamX: deltaCamX,
        deltaCamY: deltaCamY,
        isPlayer: isPlayer,
        role: rol,
        roleAuto: rolPedido === 'auto',
        refAnim: f0.name || 'primer frame',
        frameSize: [f0.fw, f0.fh],
        frame0Orig: f0,
        frame0New: f1
    };
}

// =========================================================================
// VERIFICACIÓN: simula en Psych Engine cada frame antes y después y mide la diferencia en pantalla
// =========================================================================
// origSprites / newSprites: listas en orden del XML (original y exportado). Se comparan por nombre.
function verificarAjustePsych(origSprites, newSprites, origJson, newJson, role) {
    if (!origSprites || !newSprites || !origSprites.length || !newSprites.length || !origJson || !newJson) return null;
    const rol = role && role !== 'auto' ? role : detectarRolPsych(origJson);
    const anims = (origJson.animations || []).map(a => ({ name: a.name || '', off: a.offsets || [0, 0] }))
        .sort((a, b) => b.name.length - a.name.length);
    const offsetDe = (frameName) => {
        const a = anims.find(x => x.name && frameName.startsWith(x.name));
        return a ? a.off : null;
    };
    const flip = (origJson.flip_x === true) !== (rol === 'player');

    const modelo = (sprites, json, base) => {
        const s0 = sprites[0];
        const o = { x: (s0.frameWidth || s0.w) / 2, y: (s0.frameHeight || s0.h) / 2 };
        const sc = typeof json.scale === 'number' ? json.scale : 1;
        const P = json.position || [0, 0];
        return { o, sc, P, fw0: s0.frameWidth || s0.w, fh0: s0.frameHeight || s0.h, base };
    };
    const A = modelo(origSprites, origJson), B = modelo(newSprites, newJson);

    const esquinas = (m, s, off) => {
        const fw = s.frameWidth || s.w;
        const x0 = -(s.frameX || 0), y0 = -(s.frameY || 0);
        const xs = [x0, x0 + s.w].map(x => flip ? fw - x : x);
        const ys = [y0, y0 + s.h];
        const pts = [];
        for (const x of xs) for (const y of ys) {
            pts.push([(x - m.o.x) * m.sc + m.o.x + m.P[0] - off[0], (y - m.o.y) * m.sc + m.o.y + m.P[1] - off[1]]);
        }
        return pts;
    };

    // Se empareja cada frame con su original por su id interno (sobrevive a mover/renumerar) o por nombre
    const clave = (s) => (s._id !== undefined ? 'id:' + s._id : 'n:' + s.name);
    const porClave = new Map(origSprites.map(s => [clave(s), s]));
    let maxErr = 0, peor = '', medidos = 0;
    for (const nb of newSprites) {
        const na = porClave.get(clave(nb));
        if (!na) continue;
        const off = offsetDe(nb.name);
        if (!off || offsetDe(na.name) !== off) continue;   // frames sin animación o pasados a otra animación
        const pa = esquinas(A, na, off), pb = esquinas(B, nb, off);
        for (let i = 0; i < 4; i++) {
            const e = Math.max(Math.abs(pa[i][0] - pb[i][0]), Math.abs(pa[i][1] - pb[i][1]));
            if (e > maxErr) { maxErr = e; peor = nb.name; }
        }
        medidos++;
    }

    const camara = (m, json) => {
        const cp = json.camera_position || [0, 0];
        const cx = m.P[0] + m.fw0 * m.sc / 2, cy = m.P[1] + m.fh0 * m.sc / 2;
        if (rol === 'player') return [cx - 100 - cp[0], cy - 100 + cp[1]];
        if (rol === 'gf') return [cx + cp[0], cy + cp[1]];
        return [cx + 150 + cp[0], cy - 100 + cp[1]];
    };
    const ca = camara(A, origJson), cb = camara(B, newJson);
    const camErr = Math.max(Math.abs(ca[0] - cb[0]), Math.abs(ca[1] - cb[1]));

    return { posErr: maxErr, camErr, frames: medidos, peor, role: rol };
}
