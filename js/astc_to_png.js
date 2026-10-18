/**
 * ASTC to PNG Converter & Inspector
 * Spritesheet Generator FNF'
 */

(function () {
    'use strict';

    let currentAstcFile = null;
    let currentDecoded = null;
    let currentZoom = 1.0;
    let bgMode = 'checker'; // 'checker', 'black', 'white'

    const fileInput = document.getElementById('astcFileInput');
    const uploadBtn = document.getElementById('btnUploadAstc');
    const previewContainer = document.getElementById('astcPreviewContainer');
    const previewBox = document.getElementById('previewBox');
    const previewCanvas = document.getElementById('previewCanvas');
    const statsContainer = document.getElementById('astcStatsContainer');
    const btnDownloadPng = document.getElementById('btnDownloadPng');
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnZoomReset = document.getElementById('btnZoomReset');
    const zoomLabel = document.getElementById('zoomLabel');
    const btnBgChecker = document.getElementById('btnBgChecker');
    const btnBgBlack = document.getElementById('btnBgBlack');
    const btnBgWhite = document.getElementById('btnBgWhite');

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function setZoom(newZoom) {
        currentZoom = Math.max(0.1, Math.min(5.0, newZoom));
        if (previewCanvas) {
            previewCanvas.style.transform = `scale(${currentZoom})`;
        }
        if (zoomLabel) {
            zoomLabel.textContent = `${Math.round(currentZoom * 100)}%`;
        }
    }

    function setBgMode(mode) {
        bgMode = mode;
        if (!previewBox) return;
        previewBox.classList.remove('bg-checker', 'bg-black', 'bg-white');
        if (mode === 'black') {
            previewBox.classList.add('bg-black');
        } else if (mode === 'white') {
            previewBox.classList.add('bg-white');
        } else {
            previewBox.classList.add('bg-checker');
        }

        [btnBgChecker, btnBgBlack, btnBgWhite].forEach(btn => {
            if (btn) btn.classList.remove('active');
        });
        if (mode === 'checker' && btnBgChecker) btnBgChecker.classList.add('active');
        if (mode === 'black' && btnBgBlack) btnBgBlack.classList.add('active');
        if (mode === 'white' && btnBgWhite) btnBgWhite.classList.add('active');
    }

    async function processAstcFile(file, data) {
        if (typeof mostrarCargaGlobal === 'function') {
            mostrarCargaGlobal("Decodificando textura ASTC con WebAssembly...");
        }

        try {
            await new Promise(r => setTimeout(r, 60)); // Yield to paint loader

            const bytes = data.bytes;
            const decoded = window.ASTCEngine.astcToCanvas(bytes);
            currentDecoded = decoded;
            currentAstcFile = file;

            // Render to preview canvas
            previewCanvas.width = decoded.width;
            previewCanvas.height = decoded.height;
            const ctx = previewCanvas.getContext('2d');
            ctx.clearRect(0, 0, decoded.width, decoded.height);
            ctx.drawImage(decoded.canvas, 0, 0);

            // Calculate auto zoom to fit nicely
            const containerWidth = previewBox.clientWidth || 600;
            const initialZoom = Math.min(1.0, (containerWidth - 40) / decoded.width);
            setZoom(initialZoom > 0 ? initialZoom : 1.0);

            // Populate metadata stats
            const header = decoded.header;
            const bpp = (128 / (header.blockX * header.blockY)).toFixed(2);

            document.getElementById('statResolution').textContent = `${decoded.width} × ${decoded.height} px`;
            document.getElementById('statBlockSize').textContent = `${header.blockX} × ${header.blockY}`;
            document.getElementById('statBitrate').textContent = `${bpp} bpp`;
            document.getElementById('statFileSize').textContent = formatBytes(file.size);
            document.getElementById('statBlocksCount').textContent = `${header.totalBlocks || Math.ceil(decoded.width / header.blockX) * Math.ceil(decoded.height / header.blockY)}`;

            if (previewContainer) previewContainer.style.display = 'block';
            if (statsContainer) statsContainer.style.display = 'grid';

            if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
        } catch (err) {
            console.error("Error decodificando ASTC:", err);
            if (typeof ocultarCargaGlobal === 'function') ocultarCargaGlobal();
            alert("❌ Ocurrió un error al decodificar el archivo ASTC: " + err.message);
        }
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            await window.validateAndProcessFile(e.target, 'astc', {
                onSuccess: (file, data) => {
                    processAstcFile(file, data);
                },
                onError: () => {
                    if (previewContainer) previewContainer.style.display = 'none';
                    if (statsContainer) statsContainer.style.display = 'none';
                    currentDecoded = null;
                    currentAstcFile = null;
                }
            });
        });
    }

    if (btnDownloadPng) {
        btnDownloadPng.addEventListener('click', () => {
            if (!currentDecoded || !currentDecoded.canvas) {
                alert("❌ No hay ninguna imagen decodificada para descargar.");
                return;
            }
            const baseName = currentAstcFile ? currentAstcFile.name.replace(/\.[^/.]+$/, "") : "textura_astc";
            const downloadName = baseName + ".png";

            currentDecoded.canvas.toBlob((blob) => {
                if (!blob) {
                    alert("Error al generar PNG.");
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = downloadName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 'image/png');
        });
    }

    // Zoom controls
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => setZoom(currentZoom + 0.15));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => setZoom(currentZoom - 0.15));
    if (btnZoomReset) btnZoomReset.addEventListener('click', () => setZoom(1.0));

    // Background toggle controls
    if (btnBgChecker) btnBgChecker.addEventListener('click', () => setBgMode('checker'));
    if (btnBgBlack) btnBgBlack.addEventListener('click', () => setBgMode('black'));
    if (btnBgWhite) btnBgWhite.addEventListener('click', () => setBgMode('white'));

    // Manual orientation flip controls
    const btnFlipV = document.getElementById('btnFlipV');
    const btnFlipH = document.getElementById('btnFlipH');
    if (btnFlipV) {
        btnFlipV.addEventListener('click', () => {
            if (!currentDecoded || !currentDecoded.canvas) return;
            currentDecoded.canvas = window.ASTCEngine.flipCanvasVertical(currentDecoded.canvas);
            const ctx = previewCanvas.getContext('2d');
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.drawImage(currentDecoded.canvas, 0, 0);
        });
    }
    if (btnFlipH) {
        btnFlipH.addEventListener('click', () => {
            if (!currentDecoded || !currentDecoded.canvas) return;
            currentDecoded.canvas = window.ASTCEngine.flipCanvasHorizontal(currentDecoded.canvas);
            const ctx = previewCanvas.getContext('2d');
            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.drawImage(currentDecoded.canvas, 0, 0);
        });
    }

    // Drag and drop support
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
        const overlay = document.getElementById('dragOverlay');
        if (overlay) overlay.style.display = 'flex';
    });

    window.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null) {
            const overlay = document.getElementById('dragOverlay');
            if (overlay) overlay.style.display = 'none';
        }
    });

    window.addEventListener('drop', (e) => {
        e.preventDefault();
        const overlay = document.getElementById('dragOverlay');
        if (overlay) overlay.style.display = 'none';

        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
        }
    });

})();
