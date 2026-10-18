// ==========================================
// COMPRESOR DE AUDIO OGG
// ==========================================

var oggFileOriginal = null;
var oggFileName = "audio.ogg";
var oggOriginalSize = 0;

document.getElementById('audioUpload')?.addEventListener('change', async (e) => {
    let inp = e.target;
    if (!inp.files || inp.files.length === 0) {
        if (typeof window.setImportButtonState === 'function') {
            window.setImportButtonState(inp, 'reset');
        }
        return;
    }

    mostrarCargaGlobal("Verificando e importando audio...");

    await window.validateAndProcessFile(inp, 'audio', {
        onSuccess: async (file, buffer) => {
            oggFileOriginal = file;
            oggFileName = file.name;
            oggOriginalSize = file.size;

            document.getElementById('txtAudioOrigSize').textContent = (oggOriginalSize / 1024 / 1024).toFixed(2) + " MB";
            document.getElementById('txtAudioNewSize').textContent = "---";
            document.getElementById('txtAudioBPM').textContent = "Calculando...";

            document.getElementById('btnDownloadAudio').style.display = 'none';
            document.getElementById('btnRunAudio').style.display = 'block';

            if (buffer) {
                analizarBufferBPM(buffer);
            } else {
                detectBPM(file);
            }
            if (typeof window.autoSaveHistory === 'function') window.autoSaveHistory();

            await pensar(300);
            ocultarCargaGlobal();
        },
        onError: () => {
            oggFileOriginal = null;
            document.getElementById('btnRunAudio').style.display = 'none';
            ocultarCargaGlobal();
        }
    });
});

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

function detectBPM(file) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const reader = new FileReader();
    reader.onload = function (e) {
        audioCtx.decodeAudioData(e.target.result, function (buffer) {
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
                document.getElementById('txtAudioBPM').textContent = bpm;
            } else {
                document.getElementById('txtAudioBPM').textContent = "???";
            }
        }, function (e) {
            document.getElementById('txtAudioBPM').textContent = "Error";
        });
    };
    reader.readAsArrayBuffer(file);
}

async function ejecutarCompresionAudio() {
    if (!oggFileOriginal) return alert("Sube un archivo de audio primero (.OGG o .MP3).");

    let radios = document.getElementsByName('oggQuality');
    let bitrate = '128k';
    for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) bitrate = radios[i].value;
    }

    showLoader("MOTOR DE AUDIO", "Cargando motor FFmpeg en el navegador...<br><br><span style='font-size:0.8rem;color:#ffaa00;'>La primera vez que lo uses puede tardar unos segundos en descargar el motor. ¡No cierres la página!</span>");

    try {
        const { FFmpeg } = window.FFmpegWASM;
        const { fetchFile, toBlobURL } = window.FFmpegUtil;

        if (!window.ffmpegInstance) {
            window.ffmpegInstance = new FFmpeg();

            window.ffmpegInstance.on('progress', ({ progress }) => {
                try {
                    let pct = Math.round(progress * 100);
                    if (pct > 0 && pct <= 100) {
                        let loaderTxt = document.getElementById('globalLoaderText');
                        if (loaderTxt) {
                            loaderTxt.innerHTML = `
                                <div style="font-size:0.9rem; color:#aaa; margin-bottom:5px;">Codificando Audio...</div>
                                <div style="font-size:2.5rem; font-weight:900; color:#ffaa00; text-shadow: 0 0 10px rgba(255,170,0,0.5);">${pct}%</div>
                                <div style="font-size:0.8rem; color:#fff; margin-top:5px;">Reduciendo peso.</div>
                            `;
                        }
                    }
                } catch (e) {
                    console.error("Error en progreso:", e);
                }
            });

            const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
            const ffmpegURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd';
            try {
                let loadPromise = window.ffmpegInstance.load({
                    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
                    classWorkerURL: await toBlobURL(`${ffmpegURL}/814.ffmpeg.js`, 'text/javascript'),
                });
                
                let timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error("FFmpeg timeout")), 10000);
                });
                
                await Promise.race([loadPromise, timeoutPromise]);
            } catch (err) {
                window.ffmpegInstance = null;
                ocultarCargaGlobal();
                throw new Error("⚠️ Tu navegador o celular bloquea los procesos en segundo plano para archivos locales (Error/Timeout). Intenta desde una PC.");
            }
        }

        showLoader("COMPRIMIENDO AUDIO", "Preparando tu archivo...");

        let ext = oggFileName.split('.').pop().toLowerCase();
        let inputName = 'input.' + ext;

        await window.ffmpegInstance.writeFile(inputName, await fetchFile(oggFileOriginal));

        await window.ffmpegInstance.exec(['-i', inputName, '-c:a', 'libvorbis', '-b:a', bitrate, 'output.ogg']);

        const data = await window.ffmpegInstance.readFile('output.ogg');
        const blob = new Blob([data.buffer], { type: 'audio/ogg' });
        let finalMB = (blob.size / 1024 / 1024).toFixed(2);
        let finalKB = (blob.size / 1024).toFixed(2);

        if (blob.size < 1024 * 1024) {
            document.getElementById('txtAudioNewSize').textContent = finalKB + " KB";
        } else {
            document.getElementById('txtAudioNewSize').textContent = finalMB + " MB";
        }

        let url = URL.createObjectURL(blob);
        let btnDown = document.getElementById('btnDownloadAudio');
        btnDown.onclick = () => {
            let a = document.createElement('a');
            a.href = url;

            let sufijo = "_opt";
            if (bitrate === '80k') sufijo = "_equil";
            if (bitrate === '48k') sufijo = "_max";

            a.download = oggFileName.replace(/\.[^/.]+$/, sufijo + ".ogg");
            a.click();
        };
        btnDown.style.display = 'block';
        ocultarCargaGlobal();

    } catch (e) {
        console.error(e);
        ocultarCargaGlobal();
        alert("❌ Error en Motor OGG: " + (e.message || e) + "\n\nIntenta reiniciar la pagina, cargarlo desde incognito o cambiar de navegador si este problema persiste.");
    }
}
