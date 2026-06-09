// --- ESTADOS Y VARIABLES ---
let state = {
    paneles: 1, area: 1.0, cap: 50.0, foco: 3.6, vel: 1.4,
    carga: 17.88, angulo: 179.6, dragging: false,
    incidencia: 0, derivada: 0, kActual: 0, esDeDia: true,
    cargando: false, descargando: false,
    escalaZoom: 100
};

let historial = { carga: [], derivada: [] };
let frameCount = 0;
let lastTime = performance.now();

const getEl = id => document.getElementById(id);
const ctxInc = getEl('canvas-incidencia').getContext('2d');
const ctxQ = getEl('canvas-graph-q').getContext('2d');
const ctxDq = getEl('canvas-graph-dq').getContext('2d');
const starsCanvas = getEl('stars-canvas');
const ctxStars = starsCanvas.getContext('2d');

function resizeCanvas() {
    [getEl('canvas-incidencia'), getEl('canvas-graph-q'), getEl('canvas-graph-dq'), starsCanvas].forEach(c => {
        if(c && c.parentElement) {
            c.width = c.parentElement.clientWidth;
            c.height = c.parentElement.clientHeight;
        }
    });
}
window.addEventListener('resize', resizeCanvas);

function bindSlider(id, prop, formatLabel) {
    const slider = getEl(`sl-${id}`);
    const label = getEl(`lbl-${id}`);
    if (!slider || !label) return;
    
    slider.value = state[prop];
    label.innerHTML = formatLabel(state[prop]);

    slider.addEventListener('input', (e) => {
        state[prop] = parseFloat(e.target.value);
        label.innerHTML = formatLabel(state[prop]);
        if(prop === 'cap') state.carga = Math.min(state.carga, state.cap);
    });
}

bindSlider('vel', 'vel', v => `⏱️ Velocidad: ${v === 0 ? "TIEMPO REAL" : v.toFixed(1)+"x"}`);
bindSlider('paneles', 'paneles', v => `☀️ Cantidad Paneles: ${v}`);
bindSlider('area', 'area', v => `📏 Área Panel: ${v.toFixed(1)} m²`);
bindSlider('foco', 'foco', v => `💡 Potencia Foco: ${v.toFixed(1)} W`);
bindSlider('cap', 'cap', v => `🔋 Batería: ${v} Wh`);

const slZoom = getEl('sl-zoom');
if (slZoom) {
    slZoom.addEventListener('input', (e) => {
        state.escalaZoom = parseInt(e.target.value);
        getEl('lbl-zoom').innerText = `🔍 Escala de Tiempo (Zoom): ${state.escalaZoom} puntos`;
    });
}

function setupDialDrag(dialId, isSky = false) {
    const dial = getEl(dialId);
    if(!dial) return;
    let isDragging = false;
    
    const onDrag = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        let cx, cy;
        if(isSky) {
            const orbit = getEl('celestial-orbit').getBoundingClientRect();
            cx = orbit.left + orbit.width / 2;
            cy = orbit.top + orbit.height / 2;
        } else {
            const rect = dial.getBoundingClientRect();
            cx = rect.left + rect.width / 2;
            cy = rect.top + rect.height / 2;
        }

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const dx = clientX - cx;
        const dy = clientY - cy;
        let angleRad = Math.atan2(dy, dx);
        let grados = angleRad * (180 / Math.PI);
        grados = (grados + 90) % 360;
        if (grados < 0) grados += 360;
        
        state.angulo = grados;
    };

    const startDrag = (e) => { isDragging = true; state.dragging = true; if(isSky) e.stopPropagation();};
    const endDrag = () => { isDragging = false; state.dragging = false; };

    dial.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);

    dial.addEventListener('touchstart', startDrag, {passive: false});
    document.addEventListener('touchmove', onDrag, {passive: false});
    document.addEventListener('touchend', endDrag);
}

setupDialDrag('sun-dial-mini', false);
setupDialDrag('sun-sky', true);
setupDialDrag('moon-sky', true);

function lerpColor(c1, c2, t) {
    const r1 = parseInt(c1.substring(1,3), 16), g1 = parseInt(c1.substring(3,5), 16), b1 = parseInt(c1.substring(5,7), 16);
    const r2 = parseInt(c2.substring(1,3), 16), g2 = parseInt(c2.substring(3,5), 16), b2 = parseInt(c2.substring(5,7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `rgb(${r},${g},${b})`;
}

function getSkyColor(angle, isBottom) {
    let norm = angle > 180 ? angle - 360 : angle;
    const mediodia = isBottom ? "#81D4FA" : "#29B6F6";
    const atardecer = isBottom ? "#FFCC80" : "#FF8A65";
    const noche = isBottom ? "#263238" : "#102027";

    if (norm >= 0 && norm <= 85) return lerpColor(mediodia, atardecer, norm / 85);
    if (norm > 85 && norm <= 105) return lerpColor(atardecer, noche, (norm - 85) / 20);
    if (norm >= -85 && norm < 0) return lerpColor(mediodia, atardecer, -norm / 85);
    if (norm >= -105 && norm < -85) return lerpColor(atardecer, noche, (-norm - 85) / 20);
    return noche;
}

function updatePhysics(dtSec) {
    const velReal = 360.0 / 86400.0;
    const velMax = 90.0;
    const factorVelocidad = Math.pow(state.vel / 3.0, 3.0);
    const angularSpeed = state.vel === 0 ? velReal : velReal + (velMax * factorVelocidad);

    if (!state.dragging) {
        state.angulo = (state.angulo + (angularSpeed * dtSec)) % 360.0;
    }

    const anguloNormalizado = state.angulo > 180 ? state.angulo - 360 : state.angulo;
    if (anguloNormalizado >= -105 && anguloNormalizado <= 105) {
        const anguloAjustado = anguloNormalizado * (90.0 / 105.0);
        state.incidencia = Math.cos(anguloAjustado * (Math.PI / 180.0));
    } else {
        state.incidencia = 0;
    }

    state.esDeDia = state.incidencia > 0;
    const pPanel = 1000.0 * (state.area * state.paneles) * 0.15 * 0.90;
    state.kActual = (4 * pPanel) / state.cap;
    const cargaEcuacion = Math.max(state.carga, state.cap * 0.02);
    const dtHorasVirtuales = (angularSpeed * dtSec) / 15.0;

    let dQ_dt = 0;
    if (state.esDeDia) {
        dQ_dt = state.incidencia * state.kActual * cargaEcuacion * (1 - (state.carga / state.cap));
        state.cargando = true;
        state.descargando = false;
    } else {
        state.cargando = false;
        if (state.carga > 0) {
            dQ_dt = -(state.foco / 0.9);
            state.descargando = true;
        } else {
            state.descargando = false;
        }
    }

    state.derivada = dQ_dt;
    state.carga += (dQ_dt * dtHorasVirtuales);
    state.carga = Math.max(0, Math.min(state.carga, state.cap));

    frameCount++;
    if (frameCount % 10 === 0) {
        historial.carga.push(state.carga);
        historial.derivada.push(state.derivada);
        if (historial.carga.length > 500) historial.carga.shift();
        if (historial.derivada.length > 500) historial.derivada.shift();
    }

    const horaDecimal = ((state.angulo / 15.0) + 12.0) % 24.0;
    const hrs = Math.floor(horaDecimal).toString().padStart(2, '0');
    const mins = Math.floor((horaDecimal - Math.floor(horaDecimal)) * 60).toString().padStart(2, '0');
    state.horaStr = `${hrs}:${mins}`;
}

function drawVisuals() {
    const skyBg = getEl('sky-bg');
    if(skyBg) skyBg.style.background = `linear-gradient(to bottom, ${getSkyColor(state.angulo, false)}, ${getSkyColor(state.angulo, true)})`;

    const orbitR = 40; 
    const sunSky = getEl('sun-sky');
    const moonSky = getEl('moon-sky');
    if(sunSky) sunSky.style.transform = `translate(-50%, -50%) rotate(${state.angulo}deg) translate(0, -${orbitR}vw)`;
    if(moonSky) moonSky.style.transform = `translate(-50%, -50%) rotate(${state.angulo + 180}deg) translate(0, -${orbitR}vw)`;

    const sunMoonMini = getEl('sun-moon-mini');
    if(sunMoonMini) sunMoonMini.style.transform = `rotate(${state.angulo}deg)`;

    const nightOverlay = getEl('night-overlay');
    if (nightOverlay) {
        let darkness = state.incidencia < 0.3 ? (0.3 - state.incidencia) / 0.3 : 0;
        nightOverlay.style.opacity = darkness * 0.85;
    }

    const moonGlow = getEl('moon-glow');
    if (moonGlow) {
        moonGlow.style.opacity = state.incidencia <= 0 ? 1 : 0;
    }

    // =====================================================================
    // MÓDULOS EXTERNOS LLAMADOS AQUÍ
    // (Ya no hay código de la farola ni estrellas ensuciando script.js)
    // =====================================================================
    if (typeof actualizarEstrellas === "function") {
        actualizarEstrellas(ctxStars, starsCanvas, state.incidencia, frameCount);
    }
    
    if (typeof actualizarFarola === "function") {
        actualizarFarola(state.descargando, state.foco);
    }
    // =====================================================================

// --- CONTROL DE ANIMACIÓN DE CABLES ---
// 1. Fase de Carga (Del Panel hacia la Batería) -> Verde
const opCarga = state.cargando ? 1 : 0;
const efC1 = getEl('charge-pole'); if(efC1) efC1.style.opacity = opCarga;
const efC2 = getEl('charge-ground'); if(efC2) efC2.style.opacity = opCarga;
const efC3 = getEl('charge-batt'); if(efC3) efC3.style.opacity = opCarga;

// 2. Fase de Descarga (De la Batería hacia la Lámpara) -> Amarillo
    const opDescarga = state.descargando ? 1 : 0;
    const efD1 = getEl('discharge-pole'); if(efD1) efD1.style.opacity = opDescarga;
    const efD2 = getEl('discharge-ground'); if(efD2) efD2.style.opacity = opDescarga;
    const efD3 = getEl('discharge-batt'); if(efD3) efD3.style.opacity = opDescarga;
    
    // --> ESTA ES LA LÍNEA NUEVA PARA TU CABLE DEL MEDIO <--
    const efD4 = getEl('discharge-mid'); if(efD4) efD4.style.opacity = opDescarga; 
    // ----------------------------------------

// --- ACTUALIZACIÓN DE BATERÍA VERTICAL ---
const percent = state.carga / state.cap;
const fillEl = getEl('battery-fill');

// Gradiente hacia ARRIBA (to top)
let gradient = '';
if (percent > 0.5) {
    gradient = 'linear-gradient(to top, #00E676, #B2FF59)'; 
} else if (percent > 0.2) {
    gradient = 'linear-gradient(to top, #FF9100, #FFD740)'; 
} else {
    gradient = 'linear-gradient(to top, #D50000, #FF5252)'; 
}

if(fillEl) {
    fillEl.style.height = `${percent * 100}%`; // Ahora se anima la altura
    fillEl.style.background = gradient;
}

const batText = getEl('battery-text-percent');
if(batText) {
    batText.textContent = `${Math.round(percent * 100)}%`;
}

const batWh = getEl('battery-text-wh');
if(batWh) {
    batWh.textContent = `${state.carga.toFixed(1)} Wh`;
}
// -------------------------------------

    const timeDisplay = getEl('time-display');
    if(timeDisplay) timeDisplay.innerText = state.horaStr;
    
    const normAngle = state.angulo > 180 ? state.angulo - 360 : state.angulo;
    const anguloText = getEl('angulo-text');
    if(anguloText) anguloText.innerText = `Ángulo: ${normAngle.toFixed(1)}°`;
    
    const incidenciaText = getEl('incidencia-text');
    if(incidenciaText) incidenciaText.innerText = `Luz: ${(state.incidencia * 100).toFixed(1)}%`;

    const eqBox = getEl('equation-display');
    if(eqBox) {
        if (state.esDeDia) {
            eqBox.innerHTML = `
                <span class="text-green">dQ/dt</span> = <span class="text-yellow">Luz</span> × k × Q × (1 - Q/Qmax)<br>
                <span class="text-green">${state.derivada.toFixed(2)}</span> = <span class="text-yellow">${state.incidencia.toFixed(2)}</span> × ${state.kActual.toFixed(1)} × ${state.carga.toFixed(1)} × (1 - ${state.carga.toFixed(1)}/${state.cap.toFixed(1)})
            `;
        } else {
            eqBox.innerHTML = `
                <span class="text-red">dQ/dt</span> = - <span class="text-red">Pfoco</span> / <span class="text-gray">η(eficiencia)</span><br>
                <span class="text-red">${state.derivada.toFixed(2)}</span> = - <span class="text-red">${state.foco.toFixed(1)}</span> / <span class="text-gray">0.9</span>
            `;
        }
    }

    const infoQ = getEl('info-q');
    if(infoQ) infoQ.innerText = `${state.carga.toFixed(2)} Wh`;
    
    const infoDq = getEl('info-dq');
    if(infoDq) {
        infoDq.innerText = `${state.derivada.toFixed(2)} W`;
        infoDq.className = state.derivada >= 0 ? 'text-green' : 'text-red';
    }

    // ... tu código anterior de las gráficas

    // --- CONTROL DE DÍA Y NOCHE (Nubes y Pájaros) ---
    // lightLevel calcula la luz: 1 es pleno día, 0 es noche profunda
    let lightLevel = Math.max(0, Math.min(1, state.incidencia * 3));
    
    // Mostramos u ocultamos elementos dependiendo de la hora
    document.querySelectorAll('.day-element').forEach(el => {
        el.style.opacity = lightLevel;
    });
    
    document.querySelectorAll('.night-element').forEach(el => {
        el.style.opacity = 1 - lightLevel;
    });
    // ------------------------------------------------

    drawIncidenciaCurve();
    drawChart(ctxQ, historial.carga, '#29B6F6', 0, state.cap, false);
    
    let maxAbs = 1;
    for(let i=0; i < historial.derivada.length; i++) {
        let val = Math.abs(historial.derivada[i]);
        if(val > maxAbs) maxAbs = val;
    }
    drawChart(ctxDq, historial.derivada, '#00E676', -maxAbs, maxAbs, true);
}

/*CURVA DE INCIDENCIA SOLAR*/
function drawIncidenciaCurve() {
    if (!ctxInc || !ctxInc.canvas) return; 
    ctxInc.clearRect(0,0, ctxInc.canvas.width, ctxInc.canvas.height);
    
    const cw = ctxInc.canvas.width;
    const ch = ctxInc.canvas.height;
    
    // --- NUEVO: MÁRGENES (Padding) ---
    const paddingX = 10; // Margen a los lados
    const paddingY = 25; // Margen arriba y abajo (evita que choque con los bordes)
    
    const drawW = cw - (paddingX * 2);
    const drawH = ch - (paddingY * 2);
    const baseY = ch - paddingY; // La posición de la línea horizontal de abajo
    
    ctxInc.strokeStyle = '#333'; ctxInc.lineWidth = 1;
    ctxInc.beginPath(); 
    ctxInc.moveTo(0, baseY); 
    ctxInc.lineTo(cw, baseY); 
    ctxInc.stroke();

    ctxInc.beginPath();
    for(let x = 0; x <= drawW; x++) {
        let a = -180 + (x / drawW) * 360;
        let val = 0;
        
        if(a >= -105 && a <= 105) {
            val = Math.cos(a * (90/105) * Math.PI/180);
        }
        
        let realX = paddingX + x;
        let realY = baseY - (val * drawH); // Ahora usa el tamaño con márgenes
        
        if(x === 0) ctxInc.moveTo(realX, realY); 
        else ctxInc.lineTo(realX, realY);
    }
    ctxInc.strokeStyle = '#FFCA28'; 
    ctxInc.lineWidth = 2; 
    ctxInc.stroke();

    let normAngle = state.angulo > 180 ? state.angulo - 360 : state.angulo;
    let percentX = (normAngle + 180) / 360;
    
    let xAct = paddingX + (percentX * drawW);
    let yAct = baseY - (state.incidencia * drawH);
    
    ctxInc.fillStyle = '#FFF'; 
    ctxInc.beginPath(); 
    ctxInc.arc(xAct, yAct, 4, 0, Math.PI*2); 
    ctxInc.fill();
}

function drawChart(ctx, dataArr, color, minV, maxV, showZero) {
    if (!ctx || !ctx.canvas) return; 
    
    const w = ctx.canvas.width; 
    const h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const paddingY = 12; // Mantiene que la curva no pegue en el techo/suelo
    const drawH = h - (paddingY * 2); 

    // 1. DIBUJAR CUADRÍCULA (GRID) - REPARTIDA EXACTAMENTE EN PARTES IGUALES
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
        let y = (h / 4) * i; // Divide el alto total exactamente en 4 partes iguales
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
    }
    for (let i = 1; i < 6; i++) {
        let x = (w / 6) * i; // Divide el ancho total exactamente en 6 partes iguales
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
    }
    ctx.stroke();

    // 2. LÍNEA PUNTEADA ESTRICTAMENTE EN LA MITAD EXACTA
    const midY = h / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    if(ctx.setLineDash) ctx.setLineDash([6, 4]); 
    ctx.beginPath(); 
    ctx.moveTo(0, midY); 
    ctx.lineTo(w, midY); 
    ctx.stroke();
    if(ctx.setLineDash) ctx.setLineDash([]); // Restaura a línea continua normal

    if (!dataArr || dataArr.length === 0) return;

    const range = (maxV - minV) === 0 ? 1 : (maxV - minV);
    
    // Calculamos dónde cae el nivel 0 para el sombreado de relleno
    const zY = (h - paddingY) - (((0 - minV) / range) * drawH);

    const validZoom = Math.max(2, state.escalaZoom || 100);
    const visibleData = dataArr.slice(-validZoom);
    if (visibleData.length === 0) return;

    const stepX = w / Math.max(1, validZoom - 1);
    const startX = w - ((visibleData.length - 1) * stepX);

    // 3. EFECTO DE RELLENO BAJO LA LÍNEA
    ctx.beginPath();
    ctx.moveTo(startX, zY); 
    
    for(let i=0; i < visibleData.length; i++) {
        let x = startX + (i * stepX);
        let normY = Math.max(0, Math.min(1, (visibleData[i] - minV) / range));
        let y = (h - paddingY) - (normY * drawH); 
        ctx.lineTo(x, y);
    }
    
    ctx.lineTo(startX + (visibleData.length - 1) * stepX, zY); 
    ctx.closePath();
    
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.15; 
    ctx.fill();
    ctx.globalAlpha = 1.0; 

    // 4. DIBUJAR LA LÍNEA DE DATOS (LA CURVA DE ENERGÍA)
    ctx.strokeStyle = color; 
    ctx.lineWidth = 2.5; 
    ctx.lineJoin = 'round'; 
    ctx.lineCap = 'round';
    ctx.shadowBlur = 4; 
    ctx.shadowColor = color; 
    
    ctx.beginPath();
    for(let i=0; i < visibleData.length; i++) {
        let x = startX + (i * stepX);
        let normY = Math.max(0, Math.min(1, (visibleData[i] - minV) / range));
        let y = (h - paddingY) - (normY * drawH); 
        if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0; 
}

function loop(time) {
    let dtSec = (time - lastTime) / 1000.0;
    lastTime = time;
    if (dtSec > 0.1) dtSec = 0.1;

    updatePhysics(dtSec);
    drawVisuals();

    requestAnimationFrame(loop);
}

resizeCanvas();
requestAnimationFrame(loop);