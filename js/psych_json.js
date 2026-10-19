// Cálculo compartido de compensación Psych Engine (escala, posición y cámara) al reducir la resolución.
// Lo usan el Optimizador PNG/ASTC + XML y Convertir PNG a ASTC.

// =========================================================================
// CÁLCULO MATEMÁTICO DE COMPENSACIÓN DE POSICIÓN, CÁMARA Y ESCALA (PSYCH ENGINE)
// =========================================================================
// sprites (opcional): [{ name, w, h, frameWidth, frameHeight, origFrameWidth, origFrameHeight }].
// Si no se pasa, se usan los fotogramas cargados en el Optimizador (spritesDetectados).
function calcularAjustePsychJson(originalJson, resizeFactor, sprites) {
    if (!originalJson) return null;
    if (!Array.isArray(sprites)) {
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

    if (factor >= 1.0) {
        return {
            json: json,
            origScale: origScale,
            newScale: origScale,
            origPos: origPos,
            newPos: origPos,
            origCamPos: origCamPos,
            newCamPos: origCamPos,
            deltaX: 0,
            deltaY: 0,
            deltaCamX: 0,
            deltaCamY: 0,
            refAnim: 'N/A',
            frameSize: [0, 0]
        };
    }

    // 1. Escala compensatoria en el JSON para que el sprite reducido mantenga su tamaño en pantalla
    let newScale = Number((origScale / factor).toFixed(4));
    json.scale = newScale;

    // 2. Localizar la animación base de referencia en el JSON (Psych Engine calibra la posición base del personaje según idle/dance)
    let anims = json.animations || [];
    let refAnimObj = anims.find(a => a.anim === 'idle') ||
                     anims.find(a => a.anim === 'danceLeft') ||
                     anims.find(a => a.anim === 'danceRight') ||
                     anims.find(a => a.anim && a.anim.toLowerCase().includes('idle')) ||
                     anims[0];

    let refSprite = null;
    let refAnimName = refAnimObj ? refAnimObj.name : '';

    if (refAnimName && sprites.length > 0) {
        refSprite = sprites.find(s => s.name && s.name.startsWith(refAnimName)) ||
                    sprites.find(s => s.name && s.name.includes(refAnimName));
    }
    if (!refSprite && sprites.length > 0) {
        refSprite = sprites[0];
    }

    // 3. Determinar frameWidth y frameHeight originales de la animación base
    let fwOrig = 400;
    let fhOrig = 400;

    if (refSprite) {
        if (typeof refSprite.origFrameWidth === 'number' && typeof refSprite.origFrameHeight === 'number') {
            fwOrig = refSprite.origFrameWidth;
            fhOrig = refSprite.origFrameHeight;
        } else {
            let currentFw = refSprite.frameWidth || refSprite.w || 400;
            let currentFh = refSprite.frameHeight || refSprite.h || 400;
            fwOrig = Math.round(currentFw / factor);
            fhOrig = Math.round(currentFh / factor);
        }
    }

    // =========================================================================
    // FÓRMULA MATEMÁTICA EXACTA DE HAXEFLIXEL / PSYCH ENGINE:
    // En HaxeFlixel (FlxSprite.hx), el pivote de transformación (origin) está en
    // el centro del frame: origin = (frameWidth / 2, frameHeight / 2).
    // Al reducir la resolución de la textura por 'factor' y compensar multiplicando
    // 'scale' por 1/factor, el centro del frame se contrae hacia el origen (0, 0),
    // provocando que el personaje se desplace hacia arriba y a la izquierda en el stage.
    // La compensación matemática exacta para que el personaje conserve exactamente
    // su posición original en el juego es:
    //   ΔX = + Math.round((frameWidth_original / 2) * (1 - factor))
    //   ΔY = + Math.round((frameHeight_original / 2) * (1 - factor))
    // =========================================================================
    let deltaX = Math.round((fwOrig / 2) * (1 - factor));
    let deltaY = Math.round((fhOrig / 2) * (1 - factor));

    let newPosX = origPos[0] + deltaX;
    let newPosY = origPos[1] + deltaY;
    json.position = [newPosX, newPosY];

    // =========================================================================
    // COMPENSACIÓN EXACTA DE LA CÁMARA (PSYCH ENGINE):
    // En Psych Engine (CharacterEditorState.hx y PlayState.hx):
    //   CamY = midpoint.y - 100 + cameraPosition[1]
    // Como el midpoint.y se desplaza hacia abajo por +ΔY, el objetivo de la cámara
    // queda demasiado abajo. Para devolver la cámara exactamente a su punto original:
    //   ΔCamY = -ΔY
    //
    // Para el eje X:
    //   Oponente: CamX = midpoint.x + 150 + cameraPosition[0]  -->  ΔCamX = -ΔX
    //   Jugador (BF): CamX = midpoint.x - 100 - cameraPosition[0]  -->  ΔCamX = +ΔX
    // =========================================================================
    let isPlayer = false;
    if (typeof json._editor_isPlayer === 'boolean') {
        isPlayer = json._editor_isPlayer;
    } else if (json.flip_x === true) {
        isPlayer = true;
    } else if (json.image && (json.image.toLowerCase().includes('bf') || json.image.toLowerCase().includes('player'))) {
        isPlayer = true;
    }

    let deltaCamY = -deltaY;
    let deltaCamX = isPlayer ? deltaX : -deltaX;

    let newCamX = Math.round(origCamPos[0] + deltaCamX);
    let newCamY = Math.round(origCamPos[1] + deltaCamY);
    json.camera_position = [newCamX, newCamY];

    return {
        json: json,
        origScale: origScale,
        newScale: newScale,
        origPos: origPos,
        newPos: [newPosX, newPosY],
        origCamPos: origCamPos,
        newCamPos: [newCamX, newCamY],
        deltaX: deltaX,
        deltaY: deltaY,
        deltaCamX: deltaCamX,
        deltaCamY: deltaCamY,
        isPlayer: isPlayer,
        refAnim: refAnimObj ? refAnimObj.anim : (refSprite ? refSprite.name : 'default'),
        frameSize: [fwOrig, fhOrig]
    };
}
