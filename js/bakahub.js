(function () {
  'use strict';

  var canvas = document.getElementById('bakahub-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var W = canvas.width;
  var H = canvas.height;
  var TAU = Math.PI * 2;

  var readyOverlay = document.getElementById('game-ready');
  var pauseOverlay = document.getElementById('game-pause');
  var overOverlay = document.getElementById('game-over');
  var scoreEl = document.getElementById('game-score');
  var livesEl = document.getElementById('game-lives');
  var waveEl = document.getElementById('game-wave');
  var bossEl = document.getElementById('game-boss');
  var bossFill = document.getElementById('game-boss-fill');
  var finalScoreEl = document.getElementById('game-score-final');
  var overKicker = document.getElementById('game-over-kicker');
  var overTitle = document.getElementById('game-over-title');

  var state = 'ready';
  var keys = {};
  var touch = {};
  var player;
  var bullets;
  var enemies;
  var enemyBullets;
  var particles;
  var stars;
  var boss;
  var score;
  var wave;
  var elapsed;
  var spawnTimer;
  var bossSpawned;
  var lastTime = 0;
  var waveStamp = 0;
  var highScore = 0;
  try { highScore = Number(localStorage.getItem('bakahub-high') || 0) || 0; } catch (e) {}

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pad(n) { return ('000000' + Math.floor(n)).slice(-6); }

  function makeStars() {
    stars = [];
    for (var i = 0; i < 90; i += 1) {
      stars.push({ x: rand(0, W), y: rand(0, H), z: rand(0.3, 1), r: rand(0.5, 1.6) });
    }
  }

  function resetGame() {
    player = {
      x: W / 2, y: H - 88, r: 14, hitR: 3.4,
      speed: 275, focusSpeed: 135,
      cool: 0, inv: 0, lives: 3, focus: false
    };
    bullets = [];
    enemies = [];
    enemyBullets = [];
    particles = [];
    boss = null;
    score = 0;
    wave = 1;
    elapsed = 0;
    spawnTimer = 0.9;
    bossSpawned = false;
    waveStamp = 0;
    makeStars();
    updateHud();
    if (bossEl) bossEl.hidden = true;
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = pad(score);
    if (livesEl) {
      var hearts = '';
      for (var i = 0; i < player.lives; i += 1) hearts += '♥ ';
      livesEl.textContent = hearts.trim() || '—';
    }
    if (waveEl) waveEl.textContent = ('0' + wave).slice(-2);
    if (bossEl && boss) {
      bossEl.hidden = false;
      if (bossFill) bossFill.style.width = Math.max(0, Math.min(100, boss.hp / boss.maxHp * 100)) + '%';
    } else if (bossEl) {
      bossEl.hidden = true;
    }
  }

  function startGame() {
    resetGame();
    state = 'playing';
    if (readyOverlay) readyOverlay.hidden = true;
    if (pauseOverlay) pauseOverlay.hidden = true;
    if (overOverlay) overOverlay.hidden = true;
    lastTime = performance.now();
    canvas.focus();
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      if (pauseOverlay) pauseOverlay.hidden = false;
    } else if (state === 'paused') {
      state = 'playing';
      if (pauseOverlay) pauseOverlay.hidden = true;
      lastTime = performance.now();
    }
  }

  function finishGame(win) {
    state = 'over';
    if (pauseOverlay) pauseOverlay.hidden = true;
    if (overOverlay) overOverlay.hidden = false;
    if (overKicker) overKicker.textContent = win ? 'DEMO CLEAR' : 'GAME OVER';
    if (overTitle) overTitle.textContent = win ? '占位 Boss 击破了' : '这一局结束了';
    if (finalScoreEl) finalScoreEl.textContent = String(Math.floor(score));
    if (Math.floor(score) > highScore) {
      highScore = Math.floor(score);
      try { localStorage.setItem('bakahub-high', String(highScore)); } catch (e) {}
    }
  }

  function down(name) {
    if (name === 'left') return !!(keys.ArrowLeft || keys.a || keys.A || touch.left);
    if (name === 'right') return !!(keys.ArrowRight || keys.d || keys.D || touch.right);
    if (name === 'up') return !!(keys.ArrowUp || keys.w || keys.W || touch.up);
    if (name === 'down') return !!(keys.ArrowDown || keys.s || keys.S || touch.down);
    if (name === 'shoot') return !!(keys.z || keys.Z || keys.j || keys.J || touch.shoot);
    if (name === 'focus') return !!(keys.Shift || touch.focus);
    return false;
  }

  function spawnEnemy() {
    var spinner = wave >= 3 && Math.random() < 0.38;
    var x = rand(48, W - 48);
    enemies.push({
      x: x, baseX: x, y: -34, r: 15,
      hp: spinner ? 15 : 9, maxHp: spinner ? 15 : 9,
      type: spinner ? 'spinner' : 'drifter',
      phase: rand(0, TAU), amp: rand(28, 76),
      speed: spinner ? 48 : 76,
      fire: rand(0.55, 1.35), t: 0
    });
  }

  function spawnBoss() {
    bossSpawned = true;
    boss = {
      x: W / 2, y: 150, r: 36, hp: 260, maxHp: 260,
      t: 0, fire: 0.8, pattern: 0
    };
    if (bossEl) bossEl.hidden = false;
  }

  function aimShot(x, y, speed, spread) {
    var base = Math.atan2(player.y - y, player.x - x);
    var count = spread ? 3 : 1;
    for (var i = 0; i < count; i += 1) {
      var a = base + (i - (count - 1) / 2) * 0.14;
      enemyBullets.push({ x: x, y: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 4, color: '#ff9a4d', grazed: false });
    }
  }

  function radialShot(x, y, count, speed, color) {
    for (var i = 0; i < count; i += 1) {
      var a = (TAU / count) * i + elapsed * 0.25;
      enemyBullets.push({ x: x, y: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 4, color: color || '#ffd27a', grazed: false });
    }
  }

  function boom(x, y, color, amount) {
    for (var i = 0; i < amount; i += 1) {
      var a = rand(0, TAU);
      var s = rand(30, 150);
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.7), max: 0.7, color: color, r: rand(1, 2.6) });
    }
  }

  function hitPlayer() {
    if (player.inv > 0 || state !== 'playing') return;
    player.lives -= 1;
    player.inv = 2.2;
    boom(player.x, player.y, '#ffd27a', 28);
    enemyBullets = [];
    if (player.lives <= 0) finishGame(false);
    updateHud();
  }

  function shoot() {
    if (player.cool > 0) return;
    var gap = player.focus ? 5 : 8;
    bullets.push({ x: player.x - gap, y: player.y - 18, vy: -760, r: 3 });
    bullets.push({ x: player.x + gap, y: player.y - 18, vy: -760, r: 3 });
    player.cool = 0.085;
  }

  function update(dt) {
    elapsed += dt;
    var nextWave = Math.min(5, 1 + Math.floor(elapsed / 9));
    if (nextWave !== wave) { wave = nextWave; }
    if (elapsed - waveStamp > 0.5) { waveStamp = elapsed; }
    updateHud();

    var speed = down('focus') ? player.focusSpeed : player.speed;
    player.focus = down('focus');
    var mx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
    var my = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
    if (mx || my) {
      var len = Math.sqrt(mx * mx + my * my);
      player.x = clamp(player.x + mx / len * speed * dt, 18, W - 18);
      player.y = clamp(player.y + my / len * speed * dt, 30, H - 22);
    }
    if (down('shoot')) shoot();
    player.cool -= dt;
    if (player.inv > 0) player.inv -= dt;

    spawnTimer -= dt;
    if (!boss && !bossSpawned && spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = Math.max(0.28, 0.95 - elapsed * 0.012);
    }
    if (!bossSpawned && elapsed >= 40) spawnBoss();

    for (var i = bullets.length - 1; i >= 0; i -= 1) {
      var b = bullets[i];
      b.y += b.vy * dt;
      if (b.y < -20) bullets.splice(i, 1);
    }

    for (var j = enemies.length - 1; j >= 0; j -= 1) {
      var e = enemies[j];
      e.t += dt;
      e.y += e.speed * dt;
      e.x = e.baseX + Math.sin(e.t * 2.1 + e.phase) * e.amp;
      e.fire -= dt;
      if (e.fire <= 0 && e.y > 0) {
        if (e.type === 'spinner') radialShot(e.x, e.y, 9, 105 + wave * 8, '#8fe0d1');
        else aimShot(e.x, e.y, 150 + wave * 12, false);
        e.fire = e.type === 'spinner' ? 1.6 : 1.15;
      }
      if (e.y > H + 40) enemies.splice(j, 1);
    }

    if (boss) {
      boss.t += dt;
      boss.x = W / 2 + Math.sin(boss.t * 0.75) * 118;
      boss.y = 150 + Math.sin(boss.t * 1.25) * 18;
      boss.fire -= dt;
      if (boss.fire <= 0) {
        boss.pattern = (boss.pattern + 1) % 2;
        if (boss.pattern === 0) radialShot(boss.x, boss.y, 14, 105, '#ffb45c');
        else aimShot(boss.x, boss.y, 185, true);
        boss.fire = 0.85;
      }
      if (bossEl) bossEl.hidden = false;
      if (bossFill) bossFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
    }

    for (var k = enemyBullets.length - 1; k >= 0; k -= 1) {
      var eb = enemyBullets[k];
      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;
      if (eb.x < -20 || eb.x > W + 20 || eb.y < -20 || eb.y > H + 20) {
        enemyBullets.splice(k, 1);
        continue;
      }
      var d = Math.hypot(eb.x - player.x, eb.y - player.y);
      if (d < player.hitR + eb.r) {
        hitPlayer();
        break;
      }
      if (!eb.grazed && d < 28) {
        eb.grazed = true;
        score += 10;
      }
    }

    for (var p = particles.length - 1; p >= 0; p -= 1) {
      var pt = particles[p];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
      pt.life -= dt;
      if (pt.life <= 0) particles.splice(p, 1);
    }

    for (var s = stars.length - 1; s >= 0; s -= 1) {
      var st = stars[s];
      st.y += (18 + st.z * 70) * dt;
      if (st.y > H + 2) { st.y = -2; st.x = rand(0, W); }
    }

    // player bullets vs enemies
    for (var bi = bullets.length - 1; bi >= 0; bi -= 1) {
      var pb = bullets[bi];
      var hit = false;
      for (var ei = enemies.length - 1; ei >= 0; ei -= 1) {
        var en = enemies[ei];
        if (Math.hypot(pb.x - en.x, pb.y - en.y) < en.r + pb.r) {
          en.hp -= 1;
          hit = true;
          if (en.hp <= 0) {
            score += en.type === 'spinner' ? 350 : 150;
            boom(en.x, en.y, '#ffcf7d', 16);
            enemies.splice(ei, 1);
          }
          break;
        }
      }
      if (!hit && boss && Math.hypot(pb.x - boss.x, pb.y - boss.y) < boss.r + pb.r) {
        boss.hp -= 1;
        hit = true;
        if (boss.hp <= 0) {
          score += 5000;
          boom(boss.x, boss.y, '#ff9a3c', 60);
          boss = null;
          if (bossEl) bossEl.hidden = true;
          finishGame(true);
          return;
        }
      }
      if (hit) bullets.splice(bi, 1);
    }

    // body collision
    for (var ci = enemies.length - 1; ci >= 0; ci -= 1) {
      var ce = enemies[ci];
      if (Math.hypot(ce.x - player.x, ce.y - player.y) < ce.r + player.r * 0.7) {
        hitPlayer();
        break;
      }
    }
  }

  function drawBackground() {
    var g = ctx.createRadialGradient(W / 2, H * 0.35, 10, W / 2, H * 0.55, H * 0.8);
    g.addColorStop(0, '#111a24');
    g.addColorStop(0.55, '#080d13');
    g.addColorStop(1, '#030508');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.strokeStyle = 'rgba(201, 168, 106, 0.06)';
    ctx.lineWidth = 1;
    for (var r = 100; r <= 340; r += 80) {
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.58, r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    for (var i = 0; i < stars.length; i += 1) {
      var s = stars[i];
      ctx.globalAlpha = 0.2 + s.z * 0.65;
      ctx.fillStyle = s.z > 0.75 ? '#ffd9a3' : '#e9e4da';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    if (player.inv > 0 && Math.floor(player.inv * 18) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#ffb45c';
    ctx.fillStyle = '#f5dfb4';
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 13);
    ctx.lineTo(0, 6);
    ctx.lineTo(-14, 13);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 180, 92, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.stroke();
    if (player.focus) {
      ctx.strokeStyle = 'rgba(255, 154, 60, 0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#ff6b5c';
      ctx.beginPath();
      ctx.arc(0, 0, player.hitR, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemies() {
    for (var i = 0; i < enemies.length; i += 1) {
      var e = enemies[i];
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.t * 1.2);
      ctx.strokeStyle = e.type === 'spinner' ? '#8fe0d1' : '#ffd27a';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = e.type === 'spinner' ? '#58b7aa' : '#d6a44b';
      ctx.beginPath();
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, 0);
      ctx.lineTo(0, e.r);
      ctx.lineTo(-e.r, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.42, 0, TAU);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(233, 228, 218, 0.18)';
      ctx.fillRect(e.x - 16, e.y + e.r + 7, 32, 2);
      ctx.fillStyle = e.type === 'spinner' ? '#8fe0d1' : '#ffd27a';
      ctx.fillRect(e.x - 16, e.y + e.r + 7, 32 * (e.hp / e.maxHp), 2);
    }
  }

  function drawBoss() {
    if (!boss) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(boss.t * 0.35);
    ctx.strokeStyle = 'rgba(255, 154, 60, 0.8)';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#ff7a2a';
    ctx.lineWidth = 2;
    for (var i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, boss.r + i * 11, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 154, 60, 0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, boss.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffcf8a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(233, 228, 218, 0.55)';
    ctx.font = '9px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLACEHOLDER BOSS', boss.x, boss.y + boss.r + 26);
  }

  function drawBullets() {
    for (var i = 0; i < bullets.length; i += 1) {
      var b = bullets[i];
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffe3ab';
      ctx.fillStyle = '#fff4d6';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    for (var j = 0; j < enemyBullets.length; j += 1) {
      var e = enemyBullets[j];
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (var i = 0; i < particles.length; i += 1) {
      var p = particles[i];
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawBackground();
    drawEnemies();
    drawBoss();
    drawBullets();
    drawParticles();
    drawPlayer();
  }

  function loop(ts) {
    var dt = Math.min(0.05, Math.max(0, (ts - lastTime) / 1000));
    lastTime = ts;
    if (state === 'playing') update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  document.addEventListener('keydown', function (e) {
    var key = e.key;
    var lower = key.toLowerCase();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'z', 'j', 'p', 'r', 'Shift', 'Escape', 'Enter'].indexOf(key) !== -1 || ['z', 'j', 'p', 'r'].indexOf(lower) !== -1) {
      e.preventDefault();
    }
    keys[key] = true;
    if (state === 'ready' && (key === 'Enter' || key === ' ' || lower === 'z')) startGame();
    else if (state === 'over' && (lower === 'r' || key === 'Enter')) startGame();
    else if ((key === 'Escape' || lower === 'p') && (state === 'playing' || state === 'paused')) togglePause();
    else if (lower === 'r' && state !== 'ready') startGame();
  });
  document.addEventListener('keyup', function (e) { keys[e.key] = false; });
  window.addEventListener('blur', function () {
    keys = {};
    if (state === 'playing') togglePause();
  });

  function bindTouch(selector, name) {
    var btn = document.querySelector(selector);
    if (!btn) return;
    var press = function (e) { e.preventDefault(); touch[name] = true; btn.classList.add('is-pressed'); };
    var release = function (e) { touch[name] = false; btn.classList.remove('is-pressed'); };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }
  ['left', 'right', 'up', 'down', 'shoot', 'focus'].forEach(function (name) {
    bindTouch('[data-touch="' + name + '"]', name);
  });

  var startBtn = document.getElementById('game-start');
  var resumeBtn = document.getElementById('game-resume');
  var restartBtn = document.getElementById('game-restart');
  var touchPause = document.getElementById('game-touch-pause');
  if (startBtn) startBtn.addEventListener('click', startGame);
  if (resumeBtn) resumeBtn.addEventListener('click', togglePause);
  if (restartBtn) restartBtn.addEventListener('click', startGame);
  if (touchPause) touchPause.addEventListener('click', togglePause);
  canvas.addEventListener('pointerdown', function () { canvas.focus(); });

  resetGame();
  draw();
  requestAnimationFrame(loop);
})();
