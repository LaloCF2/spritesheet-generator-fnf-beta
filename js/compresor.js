// ==========================================
// OPTIMIZADOR PESO PNG
// ==========================================

let compNombreArchivo = "sprite_optimizado.png";
let compOriginalSize = 0;

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
        onSuccess: (file, img) => {
            compNombreArchivo = file.name;
            compOriginalSize = file.size;

            let cvs = document.getElementById('canvasCompresorPreview');
            cvs.width = img.naturalWidth || img.width;
            cvs.height = img.naturalHeight || img.height;
            let cCtx = cvs.getContext('2d');
            cCtx.drawImage(img, 0, 0);

            document.getElementById('txtCompOrigSize').textContent = (compOriginalSize / 1024 / 1024).toFixed(2) + " MB";
            document.getElementById('txtCompNewSize').textContent = "---";

            document.getElementById('btnDownloadComp').style.display = 'none';
            document.getElementById('btnRunCompressor').style.display = 'block';

            ocultarCargaGlobal();
        },
        onError: () => {
            document.getElementById('btnRunCompressor').style.display = 'none';
            ocultarCargaGlobal();
        }
    });
});

async function ejecutarCompresion() {
    let numColors = parseInt(document.getElementById('sliderCompColors').value) || 256;

    showLoader("COMPRIMIENDO PNG", "Trabajando en la optimización...<br><br><span style='color:var(--accent-pink); font-size: 0.8rem;'>⚠️ Tu pantalla se congelará un momento por el esfuerzo matemático, por favor espera...</span>");

    await pensar(500);

    setTimeout(async () => {
        try {
            let cvs = document.getElementById('canvasCompresorPreview');
            let cCtx = cvs.getContext('2d');
            let w = cvs.width;
            let h = cvs.height;

            let imgData = cCtx.getImageData(0, 0, w, h);

            let pngData = UPNG.encode([imgData.data.buffer], w, h, numColors);

            let blob = new Blob([pngData], { type: 'image/png' });

            let finalMB = (blob.size / 1024 / 1024).toFixed(2);
            let finalKB = (blob.size / 1024).toFixed(2);

            if (blob.size < 1024 * 1024) {
                document.getElementById('txtCompNewSize').textContent = finalKB + " KB";
            } else {
                document.getElementById('txtCompNewSize').textContent = finalMB + " MB";
            }

            let url = URL.createObjectURL(blob);
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
    }, 500);
}
