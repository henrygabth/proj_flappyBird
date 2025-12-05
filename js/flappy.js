(() => {
  const BASE_W = 288;
  const BASE_H = 512;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext('2d');

  // Ajuste de resolução
  canvas.width = BASE_W * DPR;
  canvas.height = BASE_H * DPR;
  canvas.style.width = BASE_W + 'px';
  canvas.style.height = BASE_H + 'px';
  ctx.scale(DPR, DPR);

  // --- Áudio ---
  let audioCtx;
  function beep(type = 'sine', freq = 800, dur = 0.07, vol = 0.15) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = vol;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      setTimeout(() => { o.stop(); }, dur * 1000); 
    } catch (e) {
      console.error("Função beep: ", e);
    }
  }

  // --- Estados ---
  const STATE = { READY: 0, PLAYING: 1, GAMEOVER: 2 };
  let state = STATE.READY;
  let paused = false;

  // --- Constantes do jogo ---
  const gravity = 0.10; //valor baixo para simular a gravidade da Lua
  const flap = -6.25;
  const pipeSpeed = 3.9;
  const pipeGap = 200;
  const pipeInterval = 1400;
  const groundH = 112;

  // --- Pássaro ---
  const bird = {
    x: 60,
    y: BASE_H / 2,
    vy: 0,
    r: 0,
    w: 34, h: 24,
    frame: 0, fTimer: 0,
    reset() {
      this.x = 60;
      this.y = BASE_H * 0.45;
      this.vy = 0;
      this.r = 0;
      this.frame = 0;
      this.fTimer = 0;
    }
  };

  // --- Variáveis de cena ---
  let pipes = [];
  let lastSpawn = 0;
  let groundX = 0;
  let score = 0;
  let best = Number(localStorage.getItem("flap_best") || 0);
  const particles = [];

  // --- Utils ---
  function rand(min, max) {
    return Math.random() * (max - min) + min; // <-- corrigido
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // --- Ciclo de vida ---
  function resetGame() {
    state = STATE.READY;
    bird.reset();
    pipes = [];
    lastSpawn = 0;
    groundX = 0;
    score = 0;
    particles.length = 0;
  }

  function startGame() {
    if (state !== STATE.PLAYING) {
      state = STATE.PLAYING;
      lastSpawn = 0;
      bird.vy = 0;
    }
  }

  function gameOver() {
    state = STATE.GAMEOVER;
    best = Math.max(best, score);
    localStorage.setItem('flap_best', String(best));
    beep('square', 220, .12, .2);

    for (let i = 0; i < 16; i++) {
      particles.push({
        x: bird.x, y: bird.y, vx: rand(-2, 2), vy: rand(-2, 1),
        life: rand(18, 30)
      });
    }
  }

  function flapBird() {
    if (state === STATE.READY) { startGame(); return; }
    if (state === STATE.PLAYING) {
      bird.vy = flap;
      beep('square', 800, .05, .15);
      return;
    }
    if (state === STATE.GAMEOVER) { resetGame(); return; }
  }

  // --- Controles ---
  window.addEventListener("keydown", (e) => {
    // Aceita Space por code e por key
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      flapBird();
    }
    if (e.key === 'p' || e.key === 'P') paused = !paused;
    if (e.key === 'r' || e.key === 'R') resetGame();
  }, { passive: false });

  // Clique/toque no canvas para pular (sem chamar a função direto!)
  canvas.addEventListener("pointerdown", flapBird); // <-- corrigido

  // --- Desenho ---
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, BASE_H);
    g.addColorStop(0, '#000000ff');
    g.addColorStop(1, cssVar('--bg') || '#000000ff'); // <-- corrigido
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, BASE_W, BASE_H);

    ctx.globalAlpha = 0.85;
    drawCloud(40, 90, 1);
    drawCloud(200, 60, 0.9);
    drawCloud(150, 140, 1.1);
    ctx.globalAlpha = 1;
  }

  function drawCloud(x, y, s = 1) {
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.ellipse(x, y, 18 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 16 * s, y + 2 * s, 14 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 16 * s, y + 2 * s, 14 * s, 10 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGround() {
    ctx.fillStyle = cssVar('--ground') || '#ebe9d7ff'; // <-- corrigido
    ctx.fillRect(0, BASE_H - groundH, BASE_W, groundH);

    ctx.fillStyle = '#bde15c';
    ctx.fillRect(0, BASE_H - groundH, BASE_W, 6);

    const tileW = 24; // <-- nome corrigido
    for (let x = -tileW + (groundX % tileW); x < BASE_W; x += tileW) {
      ctx.fillStyle = cssVar('--ground-dark') || '#b5a86b'; // <-- corrigido
      ctx.fillRect(x, BASE_H - 18, 16, 8);
      ctx.fillRect(x + 8, BASE_H - 34, 12, 6);
    }
  }

  function drawPipe(x, topH) {
    const w = 52;
    const lip = 10;

    // Top
    ctx.fillStyle = cssVar('--pipe') || '#5ee370';
    ctx.fillRect(x, 0, w, topH);
    ctx.fillStyle = cssVar('--pipe-dark') || '#25b244';
    ctx.fillRect(x, topH - 6, w, 6);
    ctx.fillRect(x + lip, 0, 4, topH);

    // Bottom
    const bottomY = topH + pipeGap;
    const h = BASE_H - groundH - bottomY;
    ctx.fillStyle = cssVar('--pipe') || '#5ee370';
    ctx.fillRect(x, bottomY, w, h);
    ctx.fillStyle = cssVar('--pipe-dark') || '#25b244';
    ctx.fillRect(x, bottomY, w, 6);
    ctx.fillRect(x + lip, bottomY, 4, h);
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.r);

    // Corpo
    ctx.fillStyle = '#ffd45c';
    roundRect(ctx, -17, -12, 34, 24, 8);
    ctx.fill();

    // Asa
    ctx.fillStyle = '#f7b731';
    const wingY = Math.sin(bird.frame) * 3;
    roundRect(ctx, -8, -2 + wingY, 16, 8, 4);
    ctx.fill();

    // Bico
    ctx.fillStyle = '#ff8e3c';
    ctx.beginPath();
    ctx.moveTo(10, -2);
    ctx.lineTo(20, 2);
    ctx.lineTo(10, 6);
    ctx.closePath();
    ctx.fill();

    // Olho
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.arc(4, -5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath(); ctx.arc(5, -5, 2, 0, Math.PI * 2); ctx.fill(); // <-- faltava fill

    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawHUD() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';

    if (state === STATE.READY) {
      drawTitle('FLAPPY', 'BIRD');
      drawMsg('Toque / Espaço para começar');
    }

    if (state === STATE.PLAYING) {
      drawScore(score, BASE_W / 2, 20, 2.4);
    }

    if (state === STATE.GAMEOVER) {
      drawScore(score, BASE_W / 2, 36, 2.4);
      drawPanel();
    }
  }

  function drawTitle(a, b) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px Arial';
    ctx.fillText(a, BASE_W / 2, 80);
    ctx.fillStyle = '#ebe9d7ff';
    ctx.fillText(b, BASE_W / 2, 120); // 120 mais próximo do original
  }

  function drawMsg(t) {
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.fillRect(24, 158, BASE_W - 48, 46);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.fillText(t, BASE_W / 2, 170);
    ctx.font = '12px Arial';
    ctx.fillText('Melhor: ' + best + ' | Pausa: P', BASE_W / 2, 188);
  }

  function drawScore(n, x, y, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }

  function drawPanel() {
    const w = 220, h = 160, x = (BASE_W - w) / 2, y = 140;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.fillStyle = '#f7f7f7';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('GAME OVER', BASE_W / 2, y + 12);

    // Medalha por score
    let medal = 'Bronze'; let col = '#cd7f32';
    if (score >= 30) { medal = 'Platina'; col = '#e5e4e2'; }
    else if (score >= 20) { medal = 'Ouro'; col = '#ffd700'; }
    else if (score >= 10) { medal = 'Prata'; col = '#c0c0c0'; }

    ctx.fillStyle = col; // <-- corrigido (antes estava fillRect)
    ctx.beginPath(); ctx.arc(x + 40, y + 70, 22, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#333'; ctx.font = 'bold 12px Arial';
    ctx.fillText(medal, x + 40, y + 64);

    ctx.fillStyle = '#666'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'left';
    ctx.fillText('Pontuação', x + 84, y + 56);
    ctx.fillText('Recorde', x + 84, y + 86);

    ctx.textAlign = 'right'; ctx.fillStyle = '#111'; ctx.font = 'bold 16px Arial';
    ctx.fillText(score, x + w - 16, y + 56);
    ctx.fillText(best, x + w - 16, y + 86);

    ctx.textAlign = 'center'; ctx.fillStyle = '#444'; ctx.font = '12px Arial'; // <-- corrigido
    ctx.fillText('Toque / Espaço para reiniciar', BASE_W / 2, y + h - 20);
  }

  // --- Update ---
  function update(dt) {
    // chão “rolando”
    groundX -= pipeSpeed;
    if (groundX <= -24) groundX += 24;

    if (state === STATE.READY) {
      bird.fTimer += dt * 0.02;
      bird.frame = bird.fTimer;
      bird.y = BASE_H * 0.45 + Math.sin(performance.now() * 0.003) * 6;
      return;
    }

    if (state === STATE.PLAYING) {
      // spawn de canos
      lastSpawn += dt;
      if (lastSpawn > pipeInterval) {
        lastSpawn = 0;
        const minTop = 40;
        const maxTop = BASE_H - groundH - 40 - pipeGap; // <-- corrigido (tinha erro de sintaxe)
        const topH = Math.floor(rand(minTop, maxTop));
        pipes.push({ x: BASE_W + 10, top: topH, passed: false });
      }

      // mover canos / colisão / pontuação
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= pipeSpeed;

        // hitbox bird
        const bx = bird.x - bird.w / 2, by = bird.y - bird.h / 2, bw = bird.w, bh = bird.h;
        const pipeW = 52;
        const gapY1 = p.top;                   // <-- definidos
        const gapY2 = p.top + pipeGap;

        const hitTop = (bx + bw > p.x && bx < p.x + pipeW && by < gapY1);
        const hitBottom = (bx + bw > p.x && bx < p.x + pipeW && by + bh > gapY2);

        if (hitTop || hitBottom) { gameOver(); }

        if (!p.passed && p.x + pipeW < bird.x) {
          p.passed = true; score++; beep('triangle', 600, .04, .12);
        }
        if (p.x < -60) pipes.splice(i, 1);
      }

      // física do pássaro
      bird.vy += gravity;
      bird.y += bird.vy;
      bird.r = Math.max(-0.5, Math.min(1.1, bird.vy * 0.05));
      bird.fTimer += dt * 0.02; bird.frame = bird.fTimer;

      // chão / teto
      if (bird.y + bird.h / 2 >= BASE_H - groundH) {
        bird.y = BASE_H - groundH - bird.h / 2;
        gameOver();
      }
      if (bird.y - bird.h / 2 <= 0) {
        bird.y = bird.h / 2;
      }
    }

    if (state === STATE.GAMEOVER) {
      bird.vy += gravity; bird.y += bird.vy;
      bird.r = Math.min(1.2, bird.r + 0.04);
      if (bird.y + bird.h / 2 >= BASE_H - groundH) {
        bird.y = BASE_H - groundH - bird.h / 2;
        bird.vy = 0;
      }
      // partículas
      for (let i = particles.length - 1; i >= 0; i--) { // <-- loop corrigido
        const pa = particles[i];
        pa.x += pa.vx;
        pa.y += pa.vy; // <-- corrigido
        if (--pa.life <= 0) particles.splice(i, 1);
      }
    }
  }

  // --- Render ---
  function render() {
    drawBackground();
    for (const p of pipes) drawPipe(p.x, p.top);
    drawGround();
    drawBird();
    for (const pa of particles) {
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.fillRect(pa.x, pa.y, 2, 2);
    }
    drawHUD();
  }

  // --- Loop ---
  let prev = 0;
  function loop(ts) {
    const dt = Math.min(32, ts - prev);
    prev = ts;
    if (!paused) { update(dt); render(); }
    requestAnimationFrame(loop);
  }

  resetGame();
  requestAnimationFrame(loop);
})();
