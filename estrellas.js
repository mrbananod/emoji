// --- estrellas.js ---

// 1. Generar el array de estrellas una sola vez
const numStars = 150;
const stars = [];
for(let i = 0; i < numStars; i++) {
    stars.push({
        x: Math.random(), 
        y: Math.random() * 0.65, 
        
        // CAMBIO 1: Las hacemos un poco más grandes para que el brillo tenga de dónde agarrarse
        r: Math.random() > 0.85 ? Math.random() * 1.5 + 1.0 : Math.random() * 0.8 + 0.5, 
        
        speed: Math.random() * 0.05 + 0.02, 
        offset: Math.random() * Math.PI * 2, 
        
        // Guardamos solo los valores RGB (Blanco o Azul claro) para manipular la opacidad mejor
        color: Math.random() > 0.7 ? '210, 230, 255' : '255, 255, 255' 
    });
}

// 2. Función que dibuja las estrellas (el Director la llamará)
function actualizarEstrellas(ctxStars, starsCanvas, incidencia, frameCount) {
    if (!ctxStars || !starsCanvas) return;
    
    ctxStars.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
    
    if(incidencia >= 0.3) return; 

    // Aumentamos el multiplicador a 4 para que aparezcan más brillantes apenas anochezca
    const globalAlpha = Math.max(0, Math.min(1, (0.3 - incidencia) * 4));
    
    for(let i = 0; i < stars.length; i++) {
        let s = stars[i];
        let x = s.x * starsCanvas.width;
        let y = s.y * starsCanvas.height;
        
        // CAMBIO 2: Normalizamos el seno para que vaya de 0 a 1 (nunca negativo)
        let twinkle = (Math.sin(frameCount * s.speed + s.offset) + 1) / 2;
        
        // CAMBIO 3: Opacidad base del 30% garantizada. Las estrellas nunca se apagarán del todo.
        let starAlpha = globalAlpha * (0.3 + twinkle * 0.7); 
        
        ctxStars.beginPath();
        
        // CAMBIO 4: Le damos a las estrellas grandes un HALO DE LUZ extremo desde el propio JavaScript
        if (s.r > 1.0) {
            ctxStars.shadowBlur = 15; // Difuminado fuerte
            ctxStars.shadowColor = `rgba(${s.color}, ${starAlpha})`;
        } else {
            ctxStars.shadowBlur = 0;
        }
        
        // Dibujamos el núcleo de la estrella
        ctxStars.fillStyle = `rgba(${s.color}, ${starAlpha})`;
        ctxStars.arc(x, y, s.r, 0, Math.PI*2);
        ctxStars.fill();
    }
    
    ctxStars.shadowBlur = 0; // Limpiamos para no afectar a otros posibles dibujos
}