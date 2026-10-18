// ==========================================
// PSYCH ENGINE JSON BUILDER
// ==========================================

function changePsychBg(bgClass) {
    let container = document.getElementById('psychPreviewContainer');
    container.className = 'psych-preview-container ' + bgClass;
    
    document.getElementById('psychStageLayers').style.display = (bgClass === 'bg-stage') ? 'block' : 'none';
    document.getElementById('psychBgEditorLayer').style.display = (bgClass === 'bg-editor') ? 'block' : 'none';
}

function actualizarDropdownPsych() {
    p_animPrefix.innerHTML = ''; let prefijos = new Set(); spritesDetectados.forEach(s => { let base = s.name.replace(/\d+$/, ''); if(base) prefijos.add(base); });
    prefijos.forEach(p => { let opt = document.createElement('option'); opt.value = p; opt.textContent = p; p_animPrefix.appendChild(opt); });
}

function addPsychAnimation() {
    let name = document.getElementById('p_animName').value.trim(); let prefix = p_animPrefix.value;
    if(!name || !prefix) return alert("❌ Debes darle un nombre y elegir un prefix.");
    psychAnimations.push({ anim: name, name: prefix, loop: false, fps: 24, offsets: [0, 0], indices: [] }); document.getElementById('p_animName').value = ''; renderPsychAnimList();
    if(psychLiveActiveAnimIdx === -1) playPsychAnim(psychAnimations.length-1);
}

function renderPsychAnimList() {
    psychAnimList.innerHTML = '';
    psychAnimations.forEach((a, i) => {
        let card = document.createElement('div'); card.className = `anim-card ${i===psychLiveActiveAnimIdx ? 'active-anim':''}`;
        card.innerHTML = `
            <div class="anim-card-header">
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn-play-anim" onclick="playPsychAnim(${i})"><img src="https://cdn-icons-png.flaticon.com/512/724/724963.png" class="icon-sm" style="filter: brightness(0) !important;" alt="Play"></button>
                    <span>${a.anim} <small style="color:#aaa;">(${a.name})</small></span>
                </div>
                <button class="btn-del" style="padding:2px 6px; font-size:0.7rem;" onclick="deletePsychAnim(${i})"><img src="https://cdn-icons-png.flaticon.com/512/2734/2734822.png" class="icon-sm" alt="Del"></button>
            </div>
            <div class="anim-card-body">
                <div>
                    <label style="color:#aaa; font-size:0.7rem;">Offset X</label>
                    <div class="tuner-actions" style="margin-top:2px;">
                        <button class="btn-inc" style="width:20px;height:20px;font-size:0.8rem;" onclick="incPAnim(${i}, 'offX', -1)">-</button>
                        <input type="number" id="p_offX_${i}" value="${a.offsets[0]}" onchange="updatePAnim(${i}, 'offX', this.value)" style="font-size:0.75rem; padding:2px;">
                        <button class="btn-inc" style="width:20px;height:20px;font-size:0.8rem;" onclick="incPAnim(${i}, 'offX', 1)">+</button>
                    </div>
                </div>
                <div>
                    <label style="color:#aaa; font-size:0.7rem;">Offset Y</label>
                    <div class="tuner-actions" style="margin-top:2px;">
                        <button class="btn-inc" style="width:20px;height:20px;font-size:0.8rem;" onclick="incPAnim(${i}, 'offY', -1)">-</button>
                        <input type="number" id="p_offY_${i}" value="${a.offsets[1]}" onchange="updatePAnim(${i}, 'offY', this.value)" style="font-size:0.75rem; padding:2px;">
                        <button class="btn-inc" style="width:20px;height:20px;font-size:0.8rem;" onclick="incPAnim(${i}, 'offY', 1)">+</button>
                    </div>
                </div>
                <div>
                    <label style="color:#aaa; font-size:0.7rem;">FPS</label>
                    <div class="tuner-actions" style="margin-top:2px;">
                        <button class="btn-inc" style="width:20px;height:20px;font-size:0.8rem;" onclick="incPAnim(${i}, 'fps', -1)">-</button>
                        <input type="number" id="p_fps_${i}" value="${a.fps}" onchange="updatePAnim(${i}, 'fps', this.value)" style="font-size:0.75rem; padding:2px;">
                        <button class="btn-inc" style="width:20px;height:20px;font-size:0.8rem;" onclick="incPAnim(${i}, 'fps', 1)">+</button>
                    </div>
                </div>
                <div style="display:flex; align-items:flex-end; padding-bottom:4px;">
                    <label style="color:#aaa; font-size:0.75rem; display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" style="scale:1.2; accent-color:var(--accent-psych);" ${a.loop?'checked':''} onchange="updatePAnim(${i}, 'loop', this.checked)"> Loop
                    </label>
                </div>
                <div style="grid-column: span 2;">
                    <label style="color:#aaa; font-size:0.7rem;">Indices (ej: 0,1,2,3 - vacío = todos)</label>
                    <input type="text" style="width:100%; background:#000; border:1px solid #333; color:white; padding:4px; border-radius:4px; font-size:0.75rem; text-align:center; margin-top:2px;" placeholder="Ej: 0, 1, 2" value="${a.indices.join(',')}" onchange="updatePAnim(${i}, 'indices', this.value)">
                </div>
            </div>
        `; psychAnimList.appendChild(card);
    });
}

function incPAnim(idx, prop, amt) {
    let val = 0; if(prop === 'offX') { psychAnimations[idx].offsets[0] += amt; document.getElementById(`p_offX_${idx}`).value = psychAnimations[idx].offsets[0]; }
    if(prop === 'offY') { psychAnimations[idx].offsets[1] += amt; document.getElementById(`p_offY_${idx}`).value = psychAnimations[idx].offsets[1]; }
    if(prop === 'fps')  { psychAnimations[idx].fps += amt; document.getElementById(`p_fps_${idx}`).value = psychAnimations[idx].fps; }
    if(idx === psychLiveActiveAnimIdx) startPsychLiveLoop();
}

function updatePAnim(idx, prop, val) {
    if(prop==='offX') psychAnimations[idx].offsets[0] = parseInt(val)||0; if(prop==='offY') psychAnimations[idx].offsets[1] = parseInt(val)||0; if(prop==='fps') psychAnimations[idx].fps = parseInt(val)||24;
    if(prop==='loop') psychAnimations[idx].loop = val; if(prop==='indices') { psychAnimations[idx].indices = val.trim() ? val.split(',').map(n=>parseInt(n.trim())).filter(n=>!isNaN(n)) : []; }
    if(idx === psychLiveActiveAnimIdx) startPsychLiveLoop();
}
function deletePsychAnim(idx) { psychAnimations.splice(idx, 1); if(psychLiveActiveAnimIdx===idx) psychLiveActiveAnimIdx=-1; renderPsychAnimList(); }
function playPsychAnim(idx) { psychLiveActiveAnimIdx = idx; psychLiveFrameIdx = 0; renderPsychAnimList(); startPsychLiveLoop(); }
function updatePsychLive() { if(psychLiveActiveAnimIdx !== -1) startPsychLiveLoop(); }

function startPsychLiveLoop() {
    clearInterval(psychLiveInterval); if(psychLiveActiveAnimIdx === -1 || spritesDetectados.length === 0) return;
    let anim = psychAnimations[psychLiveActiveAnimIdx];
    let frames = spritesDetectados.filter(s => s.name.replace(/\d+$/, '') === anim.name);
    if(anim.indices && anim.indices.length > 0) { frames = anim.indices.map(i => frames[i]).filter(f => f); }
    if(frames.length === 0) { ctxPsychLive.clearRect(0,0,canvasPsychLive.width, canvasPsychLive.height); return; }

    canvasPsychLive.width = 600; canvasPsychLive.height = 600;

    psychLiveInterval = setInterval(() => {
        if(psychLiveFrameIdx >= frames.length) { if(anim.loop) psychLiveFrameIdx = 0; else psychLiveFrameIdx = frames.length - 1; }
        
        ctxPsychLive.clearRect(0, 0, 600, 600);
        
        let scale = parseFloat(document.getElementById('p_scale').value) || 1; 
        let flipX = document.getElementById('p_flip').checked; 
        let antialias = document.getElementById('p_antialias').checked;
        ctxPsychLive.imageSmoothingEnabled = antialias;

        let showOnion = document.getElementById('p_onion').checked;
        if(showOnion && frames.length > 1) {
            let prevIdx = (psychLiveFrameIdx - 1 + frames.length) % frames.length;
            let prevS = frames[prevIdx];
            
            ctxPsychLive.save(); ctxPsychLive.globalAlpha = 0.3; // Fantasma con baja opacidad
            ctxPsychLive.translate(300, 300); ctxPsychLive.scale(flipX ? -scale : scale, scale); ctxPsychLive.translate(anim.offsets[0], anim.offsets[1]);
            let drawX = -prevS.frameX - (prevS.frameWidth || prevS.w) / 2; let drawY = -prevS.frameY - (prevS.frameHeight || prevS.h) / 2;
            ctxPsychLive.translate(drawX + prevS.w/2, drawY + prevS.h/2); ctxPsychLive.rotate((prevS.angle || 0) * Math.PI / 180); 
            ctxPsychLive.drawImage(imgOriginal, prevS.x, prevS.y, prevS.w, prevS.h, -prevS.w/2, -prevS.h/2, prevS.w, prevS.h);
            ctxPsychLive.restore();
        }

        let s = frames[psychLiveFrameIdx]; 
        ctxPsychLive.save(); ctxPsychLive.translate(300, 300); ctxPsychLive.scale(flipX ? -scale : scale, scale); ctxPsychLive.translate(anim.offsets[0], anim.offsets[1]);
        let drawX = -s.frameX - (s.frameWidth || s.w) / 2; let drawY = -s.frameY - (s.frameHeight || s.h) / 2;
        ctxPsychLive.translate(drawX + s.w/2, drawY + s.h/2); ctxPsychLive.rotate((s.angle || 0) * Math.PI / 180); 
        ctxPsychLive.drawImage(imgOriginal, s.x, s.y, s.w, s.h, -s.w/2, -s.h/2, s.w, s.h);
        ctxPsychLive.restore();

        let camX = parseInt(document.getElementById('p_camX').value) || 0;
        let camY = parseInt(document.getElementById('p_camY').value) || 0;
        ctxPsychLive.fillStyle = "rgba(255, 0, 85, 0.8)";
        ctxPsychLive.beginPath();
        ctxPsychLive.arc(300 + camX, 300 + camY, 6, 0, Math.PI * 2);
        ctxPsychLive.fill();
        ctxPsychLive.strokeStyle = "white"; ctxPsychLive.lineWidth = 2; ctxPsychLive.stroke();

        if(anim.loop || psychLiveFrameIdx < frames.length - 1) psychLiveFrameIdx++;
    }, 1000 / (anim.fps || 24));
}

function hexToRgb(hex) { let res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex); return res ? [parseInt(res[1], 16), parseInt(res[2], 16), parseInt(res[3], 16)] : [0,0,0]; }
