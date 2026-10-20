// ==========================================
// OPTIMIZADOR PESO PNG
// Motor: js/png_optimizer.js (paleta de alta calidad estilo pngquant + codificador PNG propio)
// ==========================================

let compNombreArchivo = "sprite_optimizado.png";
let compOriginalSize = 0;
let compOriginalFile = null;
let compAnalysis = null;          // colores únicos e histograma de la imagen importada
let compRecommended = null;       // nivel recomendado
let compOriginalCanvas = null;    // copia del original para comparar en la vista previa
let compResultCanvas = null;
let compShowingOriginal = false;
let compEstimateTimer = null;

function compFormatSize(bytes) {
    return bytes < 1024 * 1024 ? (bytes / 1024).toFixed(2) + " KB" : (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function compLevelText(level) {
    if (level <= 0) return "0 · sin pérdida";
    return `${level} · hasta ${PNGOptimizer.levelToColors(level)} colores`;
}

// Calidad estimada al mover la barra (se calcula un momento después de soltarla)
function compUpdateLevelLabels() {
    const slider = document.getElementById('sliderCompColors');
    const level = parseInt(slider.value) || 0;
    document.getElementById('valColors').textContent = compLevelText(level);
    const lbl = document.getElementById('lblCompQuality');
    if (!compAnalysis) { lbl.textContent = "Calidad estimada: --"; return; }
    if (level === 0) { lbl.innerHTML = "Calidad: <b>idéntica (sin pérdida)</b> · reducción menor"; return; }
    lbl.textContent = "Calidad estimada: calculando...";
    clearTimeout(compEstimateTimer);
    compEstimateTimer = setTimeout(() => {
        const est = PNGOptimizer.estimateQuality(compAnalysis, level);
        if ((parseInt(slider.value) || 0) !== level) return;
        const q = isFinite(est.psnr) ? `${est.psnr.toFixed(1)} dB` : "sin pérdida";
        // Imágenes con brillos grandes: avisar si con este nivel pueden aparecer bandas (escalones) en el degradado
        const bands = compRecommended && compRecommended.largeGradients && est.psnrSmooth < 47
            ? ` <span style="color:#ffaa00;">· ⚠️ pueden verse bandas en los brillos (activa el difuminado o baja el nivel)</span>` : '';
        lbl.innerHTML = `Calidad estimada: <b>${PNGOptimizer.qualityLabel(est.psnr)}</b> (${q} · ${est.colors} colores)${bands}`;
    }, 300);
}

document.getElementById('sliderCompColors')?.addEventListener('input', compUpdateLevelLabels);

document.getElementById('btnCompUseRecommended')?.addEventListener('click', () => {
    if (!compRecommended) return;
    document.getElementById('sliderCompColors').value = compRecommended.level;
    compUpdateLevelLabels();
});

document.getElementById('btnCompToggleView')?.addEventListener('click', () => {
    if (!compOriginalCanvas || !compResultCanvas) return;
    compShowingOriginal = !compShowingOriginal;
    const cvs = document.getElementById('canvasCompresorPreview');
    const ctx = cvs.getContext('2d');
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    ctx.drawImage(compShowingOriginal ? compOriginalCanvas : compResultCanvas, 0, 0);
    document.getElementById('btnCompToggleView').textContent = compShowingOriginal ? "👁 Ver comprimido" : "👁 Ver original";
});

document.getElementById('imgCompresorUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    if (!inp.files || inp.files.length === 0) {
        if (typeof window.setImportButtonState === 'function') {
            window.setImportButtonState(inp, 'reset');
        }
        return;
    }

    showLoader("CARGANDO...", "Validando imagen .PNG...");

    await window.validateAndProcessFile(inp, 'png', {
        onSuccess: async (file, img) => {
            compNombreArchivo = file.name;
            compOriginalSize = file.size;
            compOriginalFile = file;
            compResultCanvas = null;
            compShowingOriginal = false;

            let cvs = document.getElementById('canvasCompresorPreview');
            cvs.width = img.naturalWidth || img.width;
            cvs.height = img.naturalHeight || img.height;
            let cCtx = cvs.getContext('2d', { willReadFrequently: true });
            cCtx.clearRect(0, 0, cvs.width, cvs.height);
            cCtx.drawImage(img, 0, 0);

            compOriginalCanvas = document.createElement('canvas');
            compOriginalCanvas.width = cvs.width;
            compOriginalCanvas.height = cvs.height;
            compOriginalCanvas.getContext('2d').drawImage(img, 0, 0);

            document.getElementById('txtCompOrigSize').textContent = compFormatSize(compOriginalSize);
            document.getElementById('txtCompNewSize').textContent = "---";
            document.getElementById('lblCompResultInfo').textContent = "";
            document.getElementById('btnCompToggleView').style.display = 'none';
            document.getElementById('btnDownloadComp').style.display = 'none';

            // Analizar colores y calcular el nivel recomendado
            showLoader("ANALIZANDO COLORES", "Buscando el nivel de compresión ideal para tu imagen...");
            await pensar(80);
            try {
                compAnalysis = PNGOptimizer.analyze(cCtx.getImageData(0, 0, cvs.width, cvs.height));
                compRecommended = PNGOptimizer.recommend(compAnalysis);
                const slider = document.getElementById('sliderCompColors');
                slider.value = compRecommended.level;
                const box = document.getElementById('boxCompRecommend');
                box.style.display = 'block';
                const why = compRecommended.lossless
                    ? `tu imagen tiene solo ${compRecommended.colors} colores: se comprime sin perder nada`
                    : compRecommended.largeGradients
                        ? `${compRecommended.colors} colores · tu imagen tiene brillos/degradados grandes, se dejan colores de sobra para que no salgan bandas`
                        : `${compRecommended.colors} colores · calidad ${PNGOptimizer.qualityLabel(compRecommended.psnr).toLowerCase()}`;
                document.getElementById('lblCompRecommend').innerHTML = `⭐ Recomendado: <b>${compRecommended.level}</b> (${why})`;
                compUpdateLevelLabels();
            } catch (err) {
                console.error('Error al analizar la imagen:', err);
                compAnalysis = null;
            }

            document.getElementById('btnRunCompressor').style.display = 'block';
            ocultarCargaGlobal();
        },
        onError: () => {
            compAnalysis = null;
            document.getElementById('btnRunCompressor').style.display = 'none';
            ocultarCargaGlobal();
        }
    });
});

async function ejecutarCompresion() {
    if (!compAnalysis) return alert("❌ Primero selecciona una imagen PNG.");
    let level = parseInt(document.getElementById('sliderCompColors').value) || 0;
    let dither = document.getElementById('chkCompDither').checked;

    showLoader("COMPRIMIENDO PNG", "Eligiendo la mejor paleta de colores y comprimiendo...<br><br><span style='color:var(--accent-pink); font-size: 0.8rem;'>⚠️ Tu pantalla puede congelarse un momento con imágenes grandes, por favor espera...</span>");
    await pensar(120);

    try {
        const t0 = performance.now();
        const result = PNGOptimizer.compress(compAnalysis, level, { dither });
        const secs = ((performance.now() - t0) / 1000).toFixed(1);

        // Si el PNG original ya era más ligero (pasa con PNGs ya optimizados), se entrega el original
        let bytes = result.bytes;
        let keptOriginal = false;
        if (bytes.length >= compOriginalSize && compOriginalFile) {
            bytes = new Uint8Array(await compOriginalFile.arrayBuffer());
            keptOriginal = true;
        }
        let blob = new Blob([bytes], { type: 'image/png' });

        document.getElementById('txtCompNewSize').textContent = compFormatSize(blob.size);
        const pct = ((1 - blob.size / compOriginalSize) * 100).toFixed(0);
        const info = document.getElementById('lblCompResultInfo');
        if (keptOriginal) {
            info.innerHTML = `ℹ️ Tu PNG ya estaba optimizado: el resultado no pesaba menos, así que se descarga el original. Prueba un nivel más alto.`;
        } else {
            const quality = result.lossless ? "idéntica (sin pérdida)" : `${PNGOptimizer.qualityLabel(result.psnr)} (${result.psnr.toFixed(1)} dB)`;
            info.innerHTML = `<b style="color:var(--accent-psych);">-${pct}% de peso</b> · ${result.lossless ? 'sin pérdida' : result.colors + ' colores'} · calidad ${quality}${result.dithered ? ' · con difuminado' : ''} · ${secs}s`;
        }

        // Vista previa: el resultado real (se puede alternar con el original)
        let url = URL.createObjectURL(blob);
        const resultImg = new Image();
        await new Promise((resolve, reject) => { resultImg.onload = resolve; resultImg.onerror = reject; resultImg.src = url; });
        compResultCanvas = document.createElement('canvas');
        compResultCanvas.width = resultImg.naturalWidth;
        compResultCanvas.height = resultImg.naturalHeight;
        compResultCanvas.getContext('2d').drawImage(resultImg, 0, 0);
        const cvs = document.getElementById('canvasCompresorPreview');
        const ctx = cvs.getContext('2d');
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(compResultCanvas, 0, 0);
        compShowingOriginal = false;
        const toggle = document.getElementById('btnCompToggleView');
        toggle.textContent = "👁 Ver original";
        toggle.style.display = 'inline-block';

        let btnDown = document.getElementById('btnDownloadComp');
        btnDown.onclick = () => {
            let a = document.createElement('a');
            a.href = url;
            a.download = compNombreArchivo.replace(/\.[^/.]+$/, "_compressed.png");
            a.click();
        };

        btnDown.style.display = 'block';
        ocultarCargaGlobal();

    } catch (e) {
        ocultarCargaGlobal();
        alert("❌ Hubo un error al comprimir la imagen. Puede que sea demasiado grande para la memoria del navegador.");
        console.error(e);
    }
}
