const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d', { alpha: true });

const sourceCanvas = document.createElement('canvas');
const sourceCtx = sourceCanvas.getContext('2d', { alpha: true });

let width, height, cx, cy, radius;

// State Configuration
let mirrors = 3;
let autoRotate = true;
let rotateDirection = 1; // 1 = right, -1 = left
let autoAngle = 0;
let rotationVelocity = 0;
let lastTheta = null;
let colorTheme = 'rainbow';
let isSnowflake = true;
let isScopeOn = true;

let ribbonPhase = 0;

let intensity = 65;
let brushSize = 6;
let fadeSpeed = 3;

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let hue = 0;

let lastTime = 0;
let autoTime = 0;
let lastAutoX = null;
let lastAutoY = null;

// Audio System
let audioContext, analyser, dataArray;
let isAudioReacting = false;
let audioSensitivity = 50;
let smoothedVolume = 0;
let smoothedEnergy = 0;
let flashTimer = 0;
let currentZoom = 1.0;
let globalSpeed = 1.0;

// Recording System
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

// Cinema Mode Setup
let idleTimer = null;
function resetIdleTimer() {
    document.body.classList.remove('cinema-mode');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        if (!document.getElementById('controlsPanel')?.matches(':hover')) {
            document.body.classList.add('cinema-mode');
        }
    }, 2500); 
}

function init() {
    // Splash screen click to safely permit audio engine setup internally later
    const splashScreen = document.getElementById('splashScreen');
    splashScreen?.addEventListener('click', () => {
        splashScreen.classList.add('hidden');
    });

    window.addEventListener('resize', resize);
    resize();

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('touchmove', resetIdleTimer);
    window.addEventListener('keypress', resetIdleTimer);
    resetIdleTimer();
    
    // Core UI Values
    document.getElementById('mirrorsInput')?.addEventListener('input', (e) => {
        let val = parseInt(e.target.value);
        if (!isNaN(val) && val >= 2) mirrors = Math.min(val, 16);
    });

    document.getElementById('intensityInput')?.addEventListener('input', (e) => intensity = parseInt(e.target.value));
    document.getElementById('brushSizeInput')?.addEventListener('input', (e) => brushSize = parseInt(e.target.value));
    document.getElementById('fadeInput')?.addEventListener('input', (e) => fadeSpeed = parseInt(e.target.value));
    document.getElementById('audioSenseInput')?.addEventListener('input', (e) => audioSensitivity = parseInt(e.target.value));
    document.getElementById('speedInput')?.addEventListener('input', (e) => globalSpeed = parseInt(e.target.value) / 50);
    document.getElementById('colorPalette')?.addEventListener('change', (e) => colorTheme = e.target.value);

    // Structure Toggles
    document.getElementById('symmetryBtn')?.addEventListener('click', (e) => {
        isSnowflake = !isSnowflake;
        e.target.classList.toggle('active', isSnowflake);
        e.target.textContent = isSnowflake ? '❆ Snowflake' : '◎ Mandala';
    });
    document.getElementById('audioRingBtn')?.addEventListener('click', (e) => {
        isScopeOn = !isScopeOn;
        e.target.classList.toggle('active', isScopeOn);
        e.target.textContent = isScopeOn ? '◎ Scope: ON' : '⊘ Scope: OFF';
    });

    // Brush Checkboxes
    const cbNeon = document.getElementById('brushNeon');
    const cbRibbon = document.getElementById('brushRibbon');
    const cbPulsar = document.getElementById('brushPulsar');
    const cbParticles = document.getElementById('brushParticles');
    const cbPlasma = document.getElementById('brushPlasma');
    const cbVoid = document.getElementById('brushVoid');

    function updateCheckboxStyles() {
        if(cbNeon) cbNeon.parentElement.classList.toggle('active-cb', cbNeon.checked);
        if(cbRibbon) cbRibbon.parentElement.classList.toggle('active-cb', cbRibbon.checked);
        if(cbPulsar) cbPulsar.parentElement.classList.toggle('active-cb', cbPulsar.checked);
        if(cbParticles) cbParticles.parentElement.classList.toggle('active-cb', cbParticles.checked);
        if(cbPlasma) cbPlasma.parentElement.classList.toggle('active-cb', cbPlasma.checked);
        if(cbVoid) cbVoid.parentElement.classList.toggle('active-cb', cbVoid.checked);
    }
    
    cbNeon?.addEventListener('change', updateCheckboxStyles);
    cbRibbon?.addEventListener('change', updateCheckboxStyles);
    cbPulsar?.addEventListener('change', updateCheckboxStyles);
    cbParticles?.addEventListener('change', updateCheckboxStyles);
    cbPlasma?.addEventListener('change', updateCheckboxStyles);
    cbVoid?.addEventListener('change', updateCheckboxStyles);
    updateCheckboxStyles();

    // Toggle Buttons
    const autoRotateBtn = document.getElementById('autoRotateBtn');
    autoRotateBtn?.addEventListener('click', () => {
        autoRotate = !autoRotate;
        if(autoRotateBtn) {
            if(autoRotate) {
                autoRotateBtn.classList.add('active');
                autoRotateBtn.textContent = 'Auto Rotate ON';
            } else {
                autoRotateBtn.classList.remove('active');
                autoRotateBtn.textContent = 'Auto Rotate OFF';
            }
        }
    });

    function setRotateDirection(dir) {
        rotateDirection = dir;
        autoRotate = true;
        
        let autoBtn = document.getElementById('autoRotateBtn');
        if(autoBtn) {
            autoBtn.classList.add('active');
            autoBtn.textContent = 'Auto Rotate ON';
        }

        const dirBtn = document.getElementById('rotateDirBtn');
        if (dirBtn) {
            dirBtn.textContent = rotateDirection === 1 ? '⟳ Right' : '⟲ Left';
        }

        const qLeft = document.getElementById('quickLeftBtn');
        const qRight = document.getElementById('quickRightBtn');
        if(qLeft) qLeft.classList.remove('active-dir');
        if(qRight) qRight.classList.remove('active-dir');
        
        let activeBtn = dir === -1 ? qLeft : qRight;
        if (activeBtn) {
            activeBtn.classList.add('active-dir');
            setTimeout(() => {
                activeBtn.classList.remove('active-dir');
            }, 200);
        }
    }

    const rotateDirBtn = document.getElementById('rotateDirBtn');
    rotateDirBtn?.addEventListener('click', () => setRotateDirection(rotateDirection * -1));

    const qLeftBtn = document.getElementById('quickLeftBtn');
    qLeftBtn?.addEventListener('click', () => setRotateDirection(-1));

    const qRightBtn = document.getElementById('quickRightBtn');
    qRightBtn?.addEventListener('click', () => setRotateDirection(1));

    document.getElementById('clearBtn')?.addEventListener('click', () => sourceCtx.clearRect(0, 0, width, height));

    const uiPanel = document.getElementById('controlsPanel');
    document.getElementById('toggleUIBtn')?.addEventListener('click', () => {
        uiPanel?.classList.toggle('hidden');
    });

    document.getElementById('audioReactBtn')?.addEventListener('click', toggleAudio);

    // Save and Record Elements
    document.getElementById('downloadBlackBtn')?.addEventListener('click', () => saveImage(false));
    document.getElementById('downloadTransparentBtn')?.addEventListener('click', () => saveImage(true));
    document.getElementById('recordBtn')?.addEventListener('click', toggleRecording);



    // Touch & Mouse bindings
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopInteracting);

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        startDrawing(e.touches[0]);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        handleMouseMove(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', stopDrawing);

    requestAnimationFrame(animate);
    drawInitialPattern();
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    cx = width / 2;
    cy = height / 2;
    radius = Math.max(cx, cy) * 2.5; 
}

function getThemeHue(rawHue) {
    if (colorTheme === 'rainbow') return rawHue;
    
    let f = (rawHue % 360) / 360;
    
    if (colorTheme === 'cyberpunk') {
        return 180 + f * 140; 
    }
    else if (colorTheme === 'ocean') {
        return 150 + f * 90;
    }
    else if (colorTheme === 'inferno') {
        return f * 60;
    }
    return rawHue % 360;
}

async function toggleAudio() {
    const btn = document.getElementById('audioReactBtn');
    if (isAudioReacting) {
        isAudioReacting = false;
        if(audioContext) audioContext.close();
        if (btn) {
            btn.classList.remove('active');
            btn.textContent = '🎵 React to Audio (Mic)';
        }
        return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Audio Reactivity requires a secure connection (HTTPS) and microphone support.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        isAudioReacting = true;
        
        if (btn) {
            btn.classList.add('active');
            btn.textContent = '🎤 Mic is Live!';
        }
    } catch (err) {
        console.error("Error accessing mic", err);
        alert("Please allow microphone access to use Audio Reactivity.");
    }
}

function toggleRecording() {
    const btn = document.getElementById('recordBtn');
    if (!isRecording) {
        let stream = canvas.captureStream(60);
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        recordedChunks = [];
        
        mediaRecorder.ondataavailable = function(e) {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };
        
        mediaRecorder.onstop = function() {
            let blob = new Blob(recordedChunks, { type: 'video/webm' });
            let url = URL.createObjectURL(blob);
            let a = document.createElement('a');
            a.href = url;
            a.download = 'kaleidoscope_recording.webm';
            a.click();
            URL.revokeObjectURL(url);
        };
        
        mediaRecorder.start();
        isRecording = true;
        if (btn) {
            btn.classList.add('recording');
            btn.textContent = '⏹ Stop Video';
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        if (btn) {
            btn.classList.remove('recording');
            btn.textContent = '🎥 Record View';
        }
    }
}



function saveImage(isTransparent) {
    renderKaleidoscope(isTransparent);
    let dataUrl = canvas.toDataURL('image/png');
    let link = document.createElement('a');
    link.download = isTransparent ? 'kaleidoscope-transparent.png' : 'kaleidoscope-black.png';
    link.href = dataUrl;
    link.click();
}

function startDrawing(e) {
    isDrawing = true;
    lastX = e.clientX;
    lastY = e.clientY;
    lastTheta = null;
    lastAutoX = null;
}

function handleMouseMove(e) {
    if (isDrawing) {
        draw(e);
    } else {
        processHoverRotation(e);
    }
}

function executeBrush(tx1, ty1, tx2, ty2) {
    let finalBrushSize = brushSize + (smoothedVolume / 255) * 60;
    let finalIntensity = intensity + (smoothedEnergy / 255) * 60;
    
    let applyFlash = flashTimer > 0;
    let baseHue = getThemeHue(hue);
    let drawHue = applyFlash ? 0 : baseHue; 
    let drawLightness = applyFlash ? 100 : Math.min(finalIntensity, 100);
    
    const activeNeon = document.getElementById('brushNeon')?.checked ?? true;
    const activeRibbon = document.getElementById('brushRibbon')?.checked ?? false;
    const activePulsar = document.getElementById('brushPulsar')?.checked ?? false;
    const activeParticles = document.getElementById('brushParticles')?.checked ?? false;
    const activePlasma = document.getElementById('brushPlasma')?.checked ?? false;
    const activeVoid = document.getElementById('brushVoid')?.checked ?? false;

    // 1. Quantum Ribbon
    if (activeRibbon) {
        let dist = Math.hypot(tx2 - tx1, ty2 - ty1);
        let angle = Math.atan2(ty2 - ty1, tx2 - tx1);
        
        sourceCtx.beginPath();
        sourceCtx.strokeStyle = `hsla(${drawHue}, ${applyFlash ? 0 : 100}%, ${drawLightness}%, 0.8)`;
        sourceCtx.lineWidth = Math.max(1, finalBrushSize * 0.4);
        sourceCtx.shadowBlur = finalIntensity / 3; 
        sourceCtx.shadowColor = `hsl(${drawHue}, ${applyFlash ? 0 : 100}%, 50%)`;
        
        let w = finalBrushSize * 1.5;

        for (let i = 0; i <= dist; i+=3) {
            let px = tx1 + Math.cos(angle) * i;
            let py = ty1 + Math.sin(angle) * i;
            let offset1 = Math.sin(ribbonPhase + i*0.1) * w;
            let nx1 = px + Math.cos(angle + Math.PI/2) * offset1;
            let ny1 = py + Math.sin(angle + Math.PI/2) * offset1;
            if(i===0) sourceCtx.moveTo(nx1, ny1);
            else sourceCtx.lineTo(nx1, ny1);
        }
        sourceCtx.stroke();
        
        sourceCtx.beginPath();
        for (let i = 0; i <= dist; i+=3) {
            let px = tx1 + Math.cos(angle) * i;
            let py = ty1 + Math.sin(angle) * i;
            let offset2 = Math.sin(ribbonPhase + Math.PI + i*0.1) * w;
            let nx2 = px + Math.cos(angle + Math.PI/2) * offset2;
            let ny2 = py + Math.sin(angle + Math.PI/2) * offset2;
            if(i===0) sourceCtx.moveTo(nx2, ny2);
            else sourceCtx.lineTo(nx2, ny2);
        }
        sourceCtx.stroke();
        sourceCtx.shadowBlur = 0;
    }

    // 2. Pulsar Rings
    if (activePulsar) {
        if (Math.random() < 0.15 + (smoothedEnergy/255)*0.2) {
            let size = finalBrushSize * 1.5 + Math.random() * finalBrushSize * 2.5;
            sourceCtx.beginPath();
            sourceCtx.arc(tx2, ty2, size, 0, Math.PI*2);
            sourceCtx.strokeStyle = `hsla(${drawHue}, 100%, ${drawLightness}%, 0.6)`;
            sourceCtx.lineWidth = Math.max(1, finalBrushSize * 0.3);
            sourceCtx.stroke();
        }
    }

    // 3. Neon Layer
    if (activeNeon) {
        sourceCtx.beginPath();
        sourceCtx.moveTo(tx1, ty1);
        sourceCtx.lineTo(tx2, ty2);
        sourceCtx.strokeStyle = `hsla(${drawHue}, ${applyFlash ? 0 : 100}%, ${drawLightness}%, 1)`;
        sourceCtx.lineWidth = finalBrushSize;
        sourceCtx.lineCap = 'round';
        sourceCtx.shadowBlur = finalIntensity / 2;
        sourceCtx.shadowColor = `hsl(${drawHue}, ${applyFlash ? 0 : 100}%, 50%)`;
        sourceCtx.stroke();
    }
    
    // 4. Particles Layer 
    if (activeParticles) {
        let dist = Math.hypot(tx2 - tx1, ty2 - ty1);
        let steps = Math.max(1, Math.floor(dist / (finalBrushSize * 0.4)));
        sourceCtx.fillStyle = `hsl(${drawHue}, ${applyFlash ? 0 : 100}%, ${drawLightness}%)`;
        sourceCtx.shadowBlur = 0; 
        
        sourceCtx.beginPath();
        for (let i=0; i<=steps; i++) {
            let px = tx1 + (tx2 - tx1) * (i/steps) + (Math.random() - 0.5) * finalBrushSize * 3;
            let py = ty1 + (ty2 - ty1) * (i/steps) + (Math.random() - 0.5) * finalBrushSize * 3;
            sourceCtx.moveTo(px, py);
            sourceCtx.arc(px, py, finalBrushSize * Math.random() * 0.8 + 1, 0, Math.PI*2);
        }
        sourceCtx.fill();
    }
    
    // 5. Plasma Layer
    if (activePlasma) {
        sourceCtx.beginPath();
        sourceCtx.moveTo(tx1, ty1);
        let midX = (tx1 + tx2) / 2 + (Math.random() - 0.5) * finalBrushSize * 4;
        let midY = (ty1 + ty2) / 2 + (Math.random() - 0.5) * finalBrushSize * 4;
        sourceCtx.lineTo(midX, midY);
        sourceCtx.lineTo(tx2, ty2);
        sourceCtx.strokeStyle = `hsl(${drawHue}, ${applyFlash ? 0 : 100}%, 80%)`;
        sourceCtx.lineWidth = Math.max(1, finalBrushSize * 0.4);
        sourceCtx.shadowBlur = finalIntensity;
        sourceCtx.shadowColor = `hsl(${drawHue}, ${applyFlash ? 0 : 100}%, 60%)`;
        sourceCtx.stroke();
    }

    // 6. Void Eraser Block
    if (activeVoid) {
        sourceCtx.globalCompositeOperation = 'destination-out';
        sourceCtx.beginPath();
        sourceCtx.moveTo(tx1, ty1);
        sourceCtx.lineTo(tx2, ty2);
        sourceCtx.lineWidth = finalBrushSize * 1.5;
        sourceCtx.lineCap = 'round';
        sourceCtx.strokeStyle = 'rgba(0,0,0,1)';
        sourceCtx.shadowBlur = 0;
        sourceCtx.stroke();
        sourceCtx.globalCompositeOperation = 'source-over'; 
    }
}

function processColorDynamics() {
    let hueStep = 1.0 + (smoothedEnergy / 255) * 6.0; 
    hue += hueStep;
    if (hue >= 360) hue = hue % 360;
    ribbonPhase += 0.2;
}

function draw(e) {
    let x = e.clientX;
    let y = e.clientY;

    let dx1 = lastX - cx;
    let dy1 = lastY - cy;
    let dx2 = x - cx;
    let dy2 = y - cy;
    
    let cos = Math.cos(-autoAngle);
    let sin = Math.sin(-autoAngle);
    
    let tx1 = dx1 * cos - dy1 * sin + cx;
    let ty1 = dx1 * sin + dy1 * cos + cy;
    let tx2 = dx2 * cos - dy2 * sin + cx;
    let ty2 = dx2 * sin + dy2 * cos + cy;
    
    executeBrush(tx1, ty1, tx2, ty2);
    
    lastX = x;
    lastY = y;
    processColorDynamics();
}

function autoDrawPoint(x, y) {
    if (lastAutoX === null) {
        lastAutoX = x;
        lastAutoY = y;
    }
    
    let dx1 = lastAutoX - cx;
    let dy1 = lastAutoY - cy;
    let dx2 = x - cx;
    let dy2 = y - cy;
    
    let cos = Math.cos(-autoAngle);
    let sin = Math.sin(-autoAngle);
    
    let tx1 = dx1 * cos - dy1 * sin + cx;
    let ty1 = dx1 * sin + dy1 * cos + cy;
    let tx2 = dx2 * cos - dy2 * sin + cx;
    let ty2 = dx2 * sin + dy2 * cos + cy;
    
    executeBrush(tx1, ty1, tx2, ty2);
    
    lastAutoX = x;
    lastAutoY = y;
    processColorDynamics();
}

function processHoverRotation(e) {
    let x = e.clientX;
    let y = e.clientY;
    let dx = x - cx;
    let dy = y - cy;
    let theta = Math.atan2(dy, dx);
    let radiusSquared = dx*dx + dy*dy;
    
    if (lastTheta !== null && radiusSquared > 900) { 
        let dTheta = theta - lastTheta;
        if (dTheta > Math.PI) dTheta -= Math.PI * 2;
        if (dTheta < -Math.PI) dTheta += Math.PI * 2;
        rotationVelocity += dTheta * 0.15;
    }
    lastTheta = theta;
}

function stopInteracting() {
    lastTheta = null;
    isDrawing = false;
}

function stopDrawing() {
    isDrawing = false;
}

function updateAudioSmoothing(dt) {
    let targetVolume = 0;
    let targetEnergy = 0;

    if (isAudioReacting && analyser) {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        let bassSum = 0;
        for(let i=0; i<dataArray.length;i++) {
            sum += dataArray[i];
            if(i < 8) bassSum += dataArray[i]; 
        }
        
        let multiplier = audioSensitivity / 50; 
        targetVolume = (sum / dataArray.length) * multiplier;
        targetEnergy = (bassSum / 8) * multiplier;
    }

    let lerpFactor = 1.0 - Math.pow(0.8, dt / 16); 
    let oldEnergy = smoothedEnergy;
    
    smoothedVolume += (targetVolume - smoothedVolume) * lerpFactor;
    smoothedEnergy += (targetEnergy - smoothedEnergy) * lerpFactor;
    
    let threshold = 50 * (50 / Math.max(1, audioSensitivity));
    if (targetEnergy - oldEnergy > threshold) {
        flashTimer = 80; 
    }
}

function animate(time) {
    requestAnimationFrame(animate);
    
    let dt = lastTime ? (time - lastTime) : 16;
    lastTime = time;

    updateAudioSmoothing(dt);
    flashTimer = Math.max(0, flashTimer - dt);

    let visualDt = dt * globalSpeed;

    if (fadeSpeed > 0) {
        sourceCtx.globalCompositeOperation = 'destination-out';
        sourceCtx.fillStyle = `rgba(0, 0, 0, ${(fadeSpeed * 0.015)})`;
        sourceCtx.shadowBlur = 0;
        sourceCtx.fillRect(0, 0, width, height);
        sourceCtx.globalCompositeOperation = 'source-over';
    }

    rotationVelocity *= 0.93; 
    
    if (autoRotate) {
        rotationVelocity += (0.0003 + (smoothedEnergy / 255) * 0.004) * rotateDirection * globalSpeed; 
        
        if (!isDrawing) {
            autoTime += visualDt * 0.0012 + (smoothedVolume / 255) * visualDt * 0.004;
            let R = Math.max(cx, cy) * 0.6;
            let autoX = cx + Math.sin(autoTime * 1.3 + Math.cos(autoTime * 0.7)) * Math.cos(autoTime * 0.8) * R;
            let autoY = cy + Math.cos(autoTime * 1.5 + Math.sin(autoTime * 0.9)) * Math.sin(autoTime * 1.1) * R;
            autoDrawPoint(autoX, autoY);
        } else {
            lastAutoX = null;
        }
    } else {
        lastAutoX = null;
    }
    
    // Clamp the velocity depending on globalSpeed to allow it to go faster if user wants to
    let maxVel = 0.15 * Math.max(1, globalSpeed);
    if (rotationVelocity > maxVel) rotationVelocity = maxVel;
    if (rotationVelocity < -maxVel) rotationVelocity = -maxVel;

    autoAngle += rotationVelocity * (dt / 16); 
    
    let targetZoom = 1.0;
    if (isAudioReacting) {
        targetZoom = 1.0 + (smoothedEnergy / 255) * 0.15; 
    }
    let zoomLerp = 1.0 - Math.pow(0.85, dt / 16);
    currentZoom += (targetZoom - currentZoom) * zoomLerp;

    // Draw Central Audio Scope Ring
    if (isAudioReacting && dataArray && isScopeOn) {
        let scopeRadius = Math.max(30, brushSize*2) + (smoothedVolume / 255) * 40; 
        sourceCtx.beginPath();
        let scopeHue = getThemeHue(hue + 180); 
        
        for (let i = 0; i < dataArray.length; i++) {
            let val = dataArray[i];
            if (val < 10) val = 0;
            let r = scopeRadius + (val / 255) * 80 * (audioSensitivity / 50);
            let theta = (i / dataArray.length) * Math.PI * 2;
            let vx = cx + Math.cos(theta) * r;
            let vy = cy + Math.sin(theta) * r;
            if (i===0) sourceCtx.moveTo(vx, vy);
            else sourceCtx.lineTo(vx, vy);
        }
        sourceCtx.closePath();
        sourceCtx.strokeStyle = `hsla(${scopeHue}, 100%, 70%, 0.15)`; 
        sourceCtx.lineWidth = 2;
        sourceCtx.stroke();
    }

    renderKaleidoscope(false);
}

function renderKaleidoscope(isTransparent = false) {
    if (isTransparent) {
        ctx.clearRect(0, 0, width, height);
    } else {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, width, height);
    }
    
    let sliceAngle = (Math.PI * 2) / mirrors;
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(currentZoom, currentZoom); 
    ctx.rotate(autoAngle);
    
    for (let i = 0; i < mirrors; i++) {
        ctx.save();
        ctx.rotate(i * sliceAngle);
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.arc(0, 0, radius, 0, isSnowflake ? (sliceAngle / 2 + 0.005) : (sliceAngle + 0.005)); 
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(sourceCanvas, -cx, -cy);
        ctx.restore();
        
        if (isSnowflake) {
            ctx.save();
            ctx.rotate(i * sliceAngle);
            ctx.scale(1, -1);
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.arc(0, 0, radius, 0, sliceAngle / 2 + 0.005);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(sourceCanvas, -cx, -cy);
            ctx.restore();
        }
    }
    ctx.restore();
}

function drawInitialPattern() {
    let t = 0;
    let maxT = 60;
    const interval = setInterval(() => {
        if (t > maxT) {
            clearInterval(interval);
            return;
        }
        let rad = t * 2.0;
        let angle = t * 0.15;
        let x = cx + Math.cos(angle) * rad;
        let y = cy + Math.sin(angle) * rad;
        
        if (t === 0) {
            lastX = x; lastY = y;
            isDrawing = true;
        } else {
            draw({ clientX: x, clientY: y });
        }
        t++;
    }, 16);
    setTimeout(() => { isDrawing = false; }, 16 * maxT);
}

init();
