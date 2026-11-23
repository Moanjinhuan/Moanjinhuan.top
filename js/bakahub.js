(function () {
  'use strict';

  var canvas = document.getElementById('bakahub-canvas');
  if (!canvas) return;

  var ctx = canvas.getContext('2d');
  var W = canvas.width;
  var H = canvas.height;
  var TAU = Math.PI * 2;
  var PLAYER_NAME = '墨羽';
  var BOSS_NAME = '玄夜';
  var SPELL_NAME = '灯符「长夜孤灯」';

  var readyOverlay = document.getElementById('game-ready');
  var pauseOverlay = document.getElementById('game-pause');
  var overOverlay = document.getElementById('game-over');
  var scoreEl = document.getElementById('game-score');
  var hiscoreEl = document.getElementById('game-hiscore');
  var livesEl = document.getElementById('game-lives');
  var bombsEl = document.getElementById('game-bombs');
  var waveEl = document.getElementById('game-wave');
  var powerEl = document.getElementById('game-power');
  var grazeEl = document.getElementById('game-graze');
  var pointEl = document.getElementById('game-point');
  var bossbarEl = document.getElementById('game-bossbar');
  var bossFill = document.getElementById('game-boss-fill');
  var bossNameEl = document.getElementById('game-boss-name');
  var spellEl = document.getElementById('game-spell');
  var sideBossEl = document.getElementById('game-side-boss');
  var sideSpellEl = document.getElementById('game-side-spell');
  var dialogueEl = document.getElementById('game-dialogue');
  var dialogueTextEl = document.getElementById('game-dialogue-text');
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
  var highScore = 0;
  var wave;
  var elapsed;
  var spawnTimer;
  var bossSpawned;
  var dialogueTimer;
  var lastTime = 0;
  var graze;
  var flash;
  var xHeld = false;

  try { highScore = Number(localStorage.getItem('bakahub-high') || 0) || 0; } catch (e) {}

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pad(n, len) { return ('00000000' + Math.floor(n)).slice(-len); }
  function starIcons(n) { var s = ''; for (var i = 0; i < n; i += 1) s += '★'; return s; }
  function bombIcons(n) { var s = ''; for (var i = 0; i < n; i += 1) s += '✦'; return s; }

  function makeStars() {
    stars = [];
    for (var i = 0; i < 80; i += 1) {
      stars.push({ x: rand(0, W), y: rand(0, H), z: rand(0.3, 1), r: rand(0.5, 1.5) });
    }
  }

  function resetGame() {
    player = {
      x: W / 2, y: H - 46, r: 10, hitR: 2.8,
      speed: 220, focusSpeed: 105,
      cool: 0, inv: 0, lives: 3, bombs: 3, focus: false, bombLock: 0
    };
    bullets = [];
    enemies = [];
    enemyBullets = [];
    particles = [];
    boss = null;
    score = 0;
    wave = 1;
    elapsed = 0;
    spawnTimer = 0.8;
    bossSpawned = false;
    dialogueTimer = 0;
    graze = 0;
    flash = 0;
    xHeld = false;
    makeStars();
    if (bossbarEl) bossbarEl.hidden = true;
    if (dialogueEl) dialogueEl.hidden = true;
    updateHud();
  }

  function updateHud() {
    if (scoreEl) scoreEl.textContent = pad(score, 8);
    if (hiscoreEl) hiscoreEl.textContent = pad(Math.max(highScore, score), 8);
    if (livesEl) livesEl.textContent = starIcons(player.lives) || '—';
    if (bombsEl) bombsEl.textContent = bombIcons(player.bombs) || '—';
    if (waveEl) waveEl.textContent = ('0' + wave).slice(-2);
    if (powerEl) powerEl.textContent = '1.00';
    if (grazeEl) grazeEl.textContent = String(graze);
    if (pointEl) pointEl.textContent = String(Math.floor(score / 1000));
    if (sideBossEl) sideBossEl.textContent = boss ? BOSS_NAME : '—';
    if (sideSpellEl) sideSpellEl.textContent = boss ? SPELL_NAME : '—';
    if (bossNameEl) bossNameEl.textContent = BOSS_NAME;
    if (spellEl) spellEl.textContent = SPELL_NAME;
    if (bossbarEl) bossbarEl.hidden = !boss;
    if (bossFill && boss) bossFill.style.width = Math.max(0, Math.min(100, boss.hp / boss.maxHp * 100)) + '%';
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
    if (overKicker) overKicker.textContent = win ? 'STAGE CLEAR' : 'GAME OVER';
    if (overTitle) overTitle.textContent = win ? '玄夜退散了' : '满身疮痍';
    if (finalScoreEl) finalScoreEl.textContent = String(Math.floor(score));
    if (Math.floor(score) > highScore) {
      highScore = Math.floor(score);
      try { localStorage.setItem('bakahub-high', String(highScore)); } catch (e) {}
    }
    updateHud();
  }

  function endDialogue() {
    if (state !== 'dialogue') return;
    state = 'playing';
    dialogueTimer = 0;
    if (dialogueEl) dialogueEl.hidden = true;
    lastTime = performance.now();
  }

  function beginBossDialogue() {
    state = 'dialogue';
    dialogueTimer = 3.4;
    if (dialogueEl) dialogueEl.hidden = false;
    if (dialogueTextEl) dialogueTextEl.textContent = '又有人闯进幻想屯的夜里了。既然来了，就陪我打完这一场吧。';
    if (bossbarEl) bossbarEl.hidden = false;
    updateHud();
  }

  function spawnBoss() {
    bossSpawned = true;
    boss = {
      x: W / 2, y: 92, r: 29, hp: 300, maxHp: 300,
      t: 0, fire: 0.8, pattern: 0
    };
    enemies = [];
    enemyBullets = [];
    beginBossDialogue();
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
    var spinner = wave >= 2 && Math.random() < 0.4;
    var x = rand(40, W - 40);
    enemies.push({
      x: x, baseX: x, y: -26, r: 12,
      hp: spinner ? 12 : 7, maxHp: spinner ? 12 : 7,
      type: spinner ? 'spinner' : 'drifter',
      phase: rand(0, TAU), amp: rand(20, 55),
      speed: spinner ? 40 : 62,
      fire: rand(0.45, 1.1), t: 0
    });
  }

  function aimShot(x, y, speed, spread) {
    var base = Math.atan2(player.y - y, player.x - x);
    var count = spread ? 3 : 1;
    for (var i = 0; i < count; i += 1) {
      var a = base + (i - (count - 1) / 2) * 0.14;
      enemyBullets.push({ x: x, y: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 3.6, color: '#ff9a4d', grazed: false });
    }
  }

  function radialShot(x, y, count, speed, color) {
    for (var i = 0; i < count; i += 1) {
      var a = (TAU / count) * i + elapsed * 0.2;
      enemyBullets.push({ x: x, y: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: 3.6, color: color || '#ffd27a', grazed: false });
    }
  }

  function boom(x, y, color, amount) {
    for (var i = 0; i < amount; i += 1) {
      var a = rand(0, TAU);
      var s = rand(24, 120);
      particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.22, 0.6), max: 0.6, color: color, r: rand(0.8, 2.2) });
    }
  }

  function hitPlayer() {
    if (player.inv > 0 || state !== 'playing') return;
    player.lives -= 1;
    player.inv = 2.4;
    player.bombs = 3;
    boom(player.x, player.y, '#ffd27a', 24);
    enemyBullets = [];
    if (player.lives <= 0) finishGame(false);
    updateHud();
  }

  function useBomb() {
    if (state !== 'playing' || player.bombs <= 0 || player.bombLock > 0) return;
    player.bombs -= 1;
    player.bombLock = 0.9;
    player.inv = 2.8;
    flash = 1;
    enemyBullets = [];
    for (var i = 0; i < enemies.length; i += 1) {
      boom(enemies[i].x, enemies[i].y, '#8fe0d1', 14);
      score += 200;
    }
    enemies = [];
    if (boss) {
      boss.hp -= 55;
      boom(boss.x, boss.y, '#ff9a3c', 24);
      if (boss.hp <= 0) {
        score += 5000;
        boss = null;
        if (bossbarEl) bossbarEl.hidden = true;
        finishGame(true);
      }
    }
    updateHud();
  }

  function shoot() {
    if (player.cool > 0) return;
    var gap = player.focus ? 4 : 7;
    bullets.push({ x: player.x - gap, y: player.y - 16, vy: -650, r: 2.6 });
    bullets.push({ x: player.x + gap, y: player.y - 16, vy: -650, r: 2.6 });
    player.cool = 0.075;
  }

  function update(dt) {
    elapsed += dt;
    var nextWave = Math.min(4, 1 + Math.floor(elapsed / 9));
    wave = nextWave;
    updateHud();

    var speed = down('focus') ? player.focusSpeed : player.speed;
    player.focus = down('focus');
    var mx = (down('right') ? 1 : 0) - (down('left') ? 1 : 0);
    var my = (down('down') ? 1 : 0) - (down('up') ? 1 : 0);
    if (mx || my) {
      var len = Math.sqrt(mx * mx + my * my);
      player.x = clamp(player.x + mx / len * speed * dt, 14, W - 14);
      player.y = clamp(player.y + my / len * speed * dt, 24, H - 18);
    }
    if (down('shoot')) shoot();
    player.cool -= dt;
    if (player.inv > 0) player.inv -= dt;
    if (player.bombLock > 0) player.bombLock -= dt;
    if (flash > 0) flash -= dt * 1.8;

    spawnTimer -= dt;
    if (!boss && !bossSpawned && spawnTimer <= 0) {
      spawnEnemy();
      spawnTimer = Math.max(0.25, 0.9 - elapsed * 0.012);
    }
    if (!bossSpawned && elapsed >= 32) spawnBoss();

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
        if (e.type === 'spinner') radialShot(e.x, e.y, 8, 92 + wave * 7, '#8fe0d1');
        else aimShot(e.x, e.y, 130 + wave * 9, false);
        e.fire = e.type === 'spinner' ? 1.5 : 1.05;
      }
      if (e.y > H + 30) enemies.splice(j, 1);
    }

    if (boss) {
      boss.t += dt;
      boss.x = W / 2 + Math.sin(boss.t * 0.8) * 88;
      boss.y = 92 + Math.sin(boss.t * 1.3) * 14;
      boss.fire -= dt;
      if (boss.fire <= 0) {
        boss.pattern = (boss.pattern + 1) % 2;
        if (boss.pattern === 0) radialShot(boss.x, boss.y, 12, 90, '#ffb45c');
        else aimShot(boss.x, boss.y, 160, true);
        boss.fire = 0.8;
      }
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
      if (!eb.grazed && d < 24) {
        eb.grazed = true;
        graze += 1;
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

    for (var s = 0; s < stars.length; s += 1) {
      var st = stars[s];
      st.y += (14 + st.z * 55) * dt;
      if (st.y > H + 2) { st.y = -2; st.x = rand(0, W); }
    }

    for (var bi = bullets.length - 1; bi >= 0; bi -= 1) {
      var pb = bullets[bi];
      var hit = false;
      for (var ei = enemies.length - 1; ei >= 0; ei -= 1) {
        var en = enemies[ei];
        if (Math.hypot(pb.x - en.x, pb.y - en.y) < en.r + pb.r) {
          en.hp -= 1;
          hit = true;
          if (en.hp <= 0) {
            score += en.type === 'spinner' ? 300 : 120;
            boom(en.x, en.y, '#ffcf7d', 14);
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
          boom(boss.x, boss.y, '#ff9a3c', 50);
          boss = null;
          if (bossbarEl) bossbarEl.hidden = true;
          finishGame(true);
          return;
        }
      }
      if (hit) bullets.splice(bi, 1);
    }

    for (var ci = enemies.length - 1; ci >= 0; ci -= 1) {
      var ce = enemies[ci];
      if (Math.hypot(ce.x - player.x, ce.y - player.y) < ce.r + player.r * 0.7) {
        hitPlayer();
        break;
      }
    }
  }

  function drawBackground() {
    var g = ctx.createRadialGradient(W / 2, H * 0.25, 8, W / 2, H * 0.55, H * 0.85);
    g.addColorStop(0, '#141b2b');
    g.addColorStop(0.5, '#080d16');
    g.addColorStop(1, '#020408');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#b84f45';
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'rgba(184, 79, 69, 0.55)';
    ctx.beginPath();
    ctx.arc(W / 2, 88, 46, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(201, 168, 106, 0.07)';
    ctx.lineWidth = 1;
    for (var r = 70; r <= 300; r += 60) {
      ctx.beginPath();
      ctx.arc(W / 2, H * 0.52, r, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    for (var i = 0; i < stars.length; i += 1) {
      var s = stars[i];
      ctx.globalAlpha = 0.18 + s.z * 0.6;
      ctx.fillStyle = s.z > 0.75 ? '#ffd9a3' : '#e9e4da';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer() {
    if (player.inv > 0 && Math.floor(player.inv * 18) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#ff9a6a';
    ctx.fillStyle = '#f7f1e5';
    ctx.beginPath();
    ctx.arc(0, -3, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b8463d';
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.lineTo(9, 13);
    ctx.lineTo(-9, 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(-1, -11, 2, 5);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 200, 140, 0.65)';
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, TAU);
    ctx.stroke();
    if (player.focus) {
      ctx.strokeStyle = 'rgba(255, 154, 60, 0.55)';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#ff5f4d';
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
      ctx.rotate(e.t * 1.4);
      ctx.strokeStyle = e.type === 'spinner' ? '#8fe0d1' : '#ffd27a';
      ctx.lineWidth = 1.4;
      ctx.shadowBlur = 10;
      ctx.shadowColor = e.type === 'spinner' ? '#58b7aa' : '#d6a44b';
      ctx.beginPath();
      ctx.rect(-7, -10, 14, 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, -5);
      ctx.lineTo(4, -5);
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.moveTo(-4, 5);
      ctx.lineTo(4, 5);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(233, 228, 218, 0.16)';
      ctx.fillRect(e.x - 12, e.y + e.r + 5, 24, 1.5);
      ctx.fillStyle = e.type === 'spinner' ? '#8fe0d1' : '#ffd27a';
      ctx.fillRect(e.x - 12, e.y + e.r + 5, 24 * (e.hp / e.maxHp), 1.5);
    }
  }

  function drawBoss() {
    if (!boss) return;
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.rotate(boss.t * 0.4);
    ctx.strokeStyle = 'rgba(255, 154, 60, 0.8)';
    ctx.shadowBlur = 26;
    ctx.shadowColor = '#ff7a2a';
    ctx.lineWidth = 1.8;
    for (var i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(0, 0, boss.r + i * 9, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 154, 60, 0.14)';
    ctx.beginPath();
    ctx.arc(0, 0, boss.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffe0ae';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawBullets() {
    for (var i = 0; i < bullets.length; i += 1) {
      var b = bullets[i];
      ctx.save();
      ctx.shadowBlur = 8;
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
      ctx.shadowBlur = 9;
      ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 1.7, 0, TAU);
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
    if (flash > 0) {
      ctx.fillStyle = 'rgba(255, 235, 200, ' + Math.min(0.45, flash * 0.45) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function loop(ts) {
    var dt = Math.min(0.05, Math.max(0, (ts - lastTime) / 1000));
    lastTime = ts;
    if (state === 'playing') update(dt);
    else if (state === 'dialogue') {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0) endDialogue();
    }
    draw();
    requestAnimationFrame(loop);
  }

  document.addEventListener('keydown', function (e) {
    var key = e.key;
    var lower = key.toLowerCase();
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'z', 'x', 'j', 'Enter', 'Escape', 'Control', 'Shift'].indexOf(key) !== -1 || ['z', 'x', 'j'].indexOf(lower) !== -1) {
      e.preventDefault();
    }
    if (e.repeat) return;
    keys[key] = true;

    if (state === 'ready' && (key === 'Enter' || key === ' ' || lower === 'z')) startGame();
    else if (state === 'dialogue' && (key === 'Control' || lower === 'z' || key === 'Enter')) endDialogue();
    else if (state === 'over' && (lower === 'z' || key === 'Enter')) startGame();
    else if (state === 'paused' && (key === 'Enter' || key === 'Escape')) togglePause();
    else if (state === 'playing' && (key === 'Enter' || key === 'Escape')) togglePause();
    else if (state === 'playing' && lower === 'x' && !xHeld) { xHeld = true; useBomb(); }
  });
  document.addEventListener('keyup', function (e) {
    keys[e.key] = false;
    if (e.key.toLowerCase() === 'x') xHeld = false;
  });
  window.addEventListener('blur', function () {
    keys = {};
    xHeld = false;
    if (state === 'playing') togglePause();
  });

  function bindTouch(selector, name) {
    var btn = document.querySelector(selector);
    if (!btn) return;
    var press = function (e) {
      e.preventDefault();
      touch[name] = true;
      btn.classList.add('is-pressed');
      if (name === 'bomb') useBomb();
    };
    var release = function (e) {
      touch[name] = false;
      btn.classList.remove('is-pressed');
    };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }
  ['left', 'right', 'up', 'down', 'shoot', 'bomb', 'focus'].forEach(function (name) {
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
