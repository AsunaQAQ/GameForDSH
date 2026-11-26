/* NIGHTFALL — game loop, physics, rendering, UI */
(function () {
  'use strict';

  const W = 480;
  const H = 270;
  const T = 16;

  const GRAV = 1450;
  const MAX_FALL = 560;
  const RUN = 138;
  const ACC = 1500;
  const AIR_ACC = 950;
  const FRIC = 1900;
  const AIR_FRIC = 520;
  const JUMP = 455;
  const AIR_JUMP = 365;
  const COYOTE = 0.1;
  const BUFFER = 0.15;
  const ATTACK_BUFFER = 0.3;
  const DASH_BUFFER = 0.2;
  const DASH_SPEED = 320;
  const DASH_TIME = 0.16;
  const DASH_CD = 0.52;
  const PW = 12;
  const PH = 32;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
  const lerp = (a, b, t) => a + (b - a) * t;
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const rand = (a, b) => a + Math.random() * (b - a);

  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const stage = $('stage');
  const hud = $('hud');
  const hpEl = $('hp');
  const pips = Array.from(hpEl.querySelectorAll('.pip'));
  const coresEl = $('cores');
  const coreCountEl = $('coreCount');
  const timerEl = $('timer');
  const toastEl = $('toast');
  const commsEl = $('comms');
  const commsTextEl = $('commsText');
  const hintsEl = document.querySelector('.hints');
  const titleEl = $('title');
  const pauseEl = $('pause');
  const endingEl = $('ending');
  const fadeEl = $('fade');
  const bootEl = $('boot');
  const startBtn = $('startBtn');
  const resumeBtn = $('resumeBtn');
  const restartBtn = $('restartBtn');
  const loadNote = $('loadNote');
  const statTime = $('statTime');
  const statCores = $('statCores');
  const statDeaths = $('statDeaths');

  const IMG = {};
  const SLASH = [];
  let tilesImg = null;

  const level = window.NF.level;
  const audio = window.NF.audio;

  let ready = false;
  let state = 'title';
  let player = null;
  let cam = { x: 0, y: 0 };
  let respawnPoint = { ...level.spawn };
  let checkpointIdx = -1;
  let coresGot = 0;
  let elapsed = 0;
  let deaths = 0;
  let animTime = 0;
  let hitstop = 0;
  let shake = 0;
  let shakeX = 0;
  let shakeY = 0;
  let flash = 0;
  let flashColor = '255,255,255';
  let lightningT = 11;
  let deathTimer = 0;
  let gateHintT = 0;
  let hintTimer = 0;
  let toastT = 0;
  let commsT = 0;
  let hudTick = 0;
  let lastHp = 3;

  const particles = [];
  const ghosts = [];
  const rings = [];
  const rain = [];

  const keys = new Set();

  const ACTIONS = {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    jump: ['Space', 'KeyK', 'KeyW', 'KeyZ'],
    dash: ['ShiftLeft', 'ShiftRight', 'KeyL'],
    attack: ['KeyJ', 'KeyX'],
    pause: ['Escape', 'KeyP'],
    restart: ['KeyR'],
    mute: ['KeyM'],
  };

  // ------------------------------------------------------------------ helpers
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('missing ' + src));
      im.src = src;
    });
  }

  async function loadAssets() {
    const base = {
      sheet: 'assets/chen_sheet.png',
      rim: 'assets/chen_rim.png',
      tiles: 'assets/tiles.png',
      far: 'assets/bg_far.png',
      mid: 'assets/bg_mid.png',
      near: 'assets/bg_near.png',
      portrait: 'assets/portrait.png',
    };
    for (const [k, src] of Object.entries(base)) IMG[k] = await loadImage(src);
    for (let i = 0; i < 4; i++) SLASH.push(await loadImage(`assets/slash_${i}.png`));
    tilesImg = IMG.tiles;
  }

  function isActive(action) {
    const list = ACTIONS[action];
    for (let i = 0; i < list.length; i++) if (keys.has(list[i])) return true;
    return false;
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    const s = Math.max(0.6, r.width / W);
    document.documentElement.style.setProperty('--u', s.toFixed(3) + 'px');
  }

  // ------------------------------------------------------------------ UI
  function showToast(text, dur = 2.6) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    toastT = dur;
  }
  function showComms(text, dur = 5.5) {
    commsTextEl.textContent = text;
    commsEl.classList.add('show');
    commsT = dur;
  }
  function hideComms() {
    commsEl.classList.remove('show');
    commsT = 0;
  }
  function updateHpUI() {
    if (!player) return;
    pips.forEach((el, i) => el.classList.toggle('on', i < player.hp));
  }
  function updateCoreUI() {
    coreCountEl.textContent = String(coresGot);
    coresEl.classList.remove('pop');
    void coresEl.offsetWidth;
    coresEl.classList.add('pop');
  }
  function updateTimerUI() {
    timerEl.textContent = fmtTime(elapsed);
  }
  function triggerHurtPip(index) {
    const el = pips[index];
    if (!el) return;
    el.classList.remove('hurt');
    void el.offsetWidth;
    el.classList.add('hurt');
    setTimeout(() => el.classList.remove('hurt'), 420);
  }

  // ------------------------------------------------------------------ world setup
  function makePlayer(x, y) {
    return {
      x, y,
      vx: 0, vy: 0,
      grounded: false,
      coyote: 0,
      jumpBuf: 0,
      airJumps: 1,
      airDash: 1,
      dashT: 0,
      dashCd: 0,
      dashBuf: 0,
      attackT: 0,
      attackBuf: 0,
      attackHit: new Set(),
      facing: 1,
      hp: 3,
      maxHp: 3,
      invuln: 0,
      hurtT: 0,
      jumpTime: 0,
      runPhase: 0,
      idleT: 0,
      dustT: 0,
      prevBottom: y,
      jumpCut: false,
    };
  }

  function startRun() {
    if (!ready) return;
    audio.init();
    audio.sfx.ui();

    level.reset();
    player = makePlayer(level.spawn.x, level.spawn.y);
    player.grounded = true;
    respawnPoint = { ...level.spawn };
    checkpointIdx = -1;
    coresGot = 0;
    elapsed = 0;
    deaths = 0;
    lastHp = 3;
    hitstop = 0;
    shake = 0;
    flash = 0;
    deathTimer = 0;
    gateHintT = 0;
    hintTimer = 0;
    particles.length = 0;
    ghosts.length = 0;
    rings.length = 0;
    state = 'play';

    titleEl.classList.add('hidden');
    endingEl.classList.add('hidden');
    pauseEl.classList.add('hidden');
    fadeEl.classList.remove('on');
    hud.classList.remove('hidden');
    hintsEl.classList.remove('fade');
    hideComms();

    pips.forEach((el) => el.classList.add('on'));
    updateCoreUI();
    updateTimerUI();
    snapCamera();
    showToast('目标：回收 3 枚数据核心 · 抵达 B-7', 4.2);
    showComms('……雨会盖住脚步。先回收散落的核心，再去 B-7 撤离点。', 6.5);
  }

  function snapCamera() {
    if (!player) return;
    const tx = player.x + player.facing * 18 + player.vx * 0.08 - W / 2;
    const ty = player.y - 22 - H / 2 - 34 + clamp(player.vy * 0.05, -14, 24);
    cam.x = clamp(tx, 0, level.W * T - W);
    cam.y = clamp(ty, 0, level.H * T - H);
  }

  function togglePause() {
    if (state === 'play') {
      state = 'pause';
      pauseEl.classList.remove('hidden');
      audio.sfx.ui();
    } else if (state === 'pause') {
      state = 'play';
      pauseEl.classList.add('hidden');
      audio.sfx.ui();
    }
  }

  function showEnding() {
    state = 'end';
    statTime.textContent = fmtTime(elapsed);
    statCores.textContent = `${coresGot} / 3`;
    statDeaths.textContent = String(deaths);
    endingEl.classList.remove('hidden');
    hud.classList.add('hidden');
    hideComms();
    audio.sfx.gate();
    burst(player.x, player.y - 20, 28, ['#6dffb0', '#6fe7ff', '#eafff4'], 130, 0.9, -30, true);
  }

  function killPlayer(reason) {
    if (state !== 'play' || !player) return;
    state = 'dead';
    deaths += 1;
    deathTimer = 1.55;
    player.hp = 0;
    player.invuln = 99;
    player.vx = 0;
    player.vy = 0;
    shake = 11;
    flash = 0.55;
    flashColor = '220,60,52';
    audio.sfx.death();
    burst(player.x, player.y - 16, 26, ['#ff6b5a', '#e8453f', '#ffb45c', '#ffffff'], 160, 0.8, 220, true);
    updateHpUI();
    showToast(reason === 'fall' ? '信号中断 · 正在重新定位' : '生命信号丢失 · 正在重连', 2.2);
  }

  function respawn() {
    player = makePlayer(respawnPoint.x, respawnPoint.y);
    player.grounded = true;
    player.invuln = 1.6;
    state = 'play';
    fadeEl.classList.remove('on');
    updateHpUI();
    updateTimerUI();
    snapCamera();
    showToast('信号恢复 · 继续行动', 2);
  }

  function damagePlayer(amount, fromX) {
    if (!player || state !== 'play' || player.invuln > 0) return;
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = 1.15;
    player.hurtT = 0.28;
    const away = player.x < fromX ? -1 : 1;
    player.vx = away * 190;
    player.vy = -210;
    player.grounded = false;
    shake = 8;
    hitstop = 0.055;
    flash = 0.3;
    flashColor = '230,70,60';
    audio.sfx.hurt();
    updateHpUI();
    if (player.hp > 0) triggerHurtPip(player.hp);
    burst(player.x, player.y - 18, 12, ['#ff7a66', '#ffffff', '#e8453f'], 130, 0.5, 180, true);
    if (player.hp <= 0) killPlayer('hp');
  }

  // ------------------------------------------------------------------ physics
  function playerBox(p) {
    return { x: p.x - PW / 2, y: p.y - PH, w: PW, h: PH };
  }

  function gateSolid() {
    const g = level.gate;
    if (!g) return false;
    return !g.open || g.openT < 0.45;
  }

  function resolveX(p) {
    const b = playerBox(p);
    const x0 = Math.floor(b.x / T);
    const x1 = Math.floor((b.x + b.w - 0.01) / T);
    const y0 = Math.floor(b.y / T);
    const y1 = Math.floor((b.y + b.h - 0.01) / T);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (level.get(x, y) === 1) {
          if (p.vx > 0) p.x = x * T - PW / 2;
          else if (p.vx < 0) p.x = (x + 1) * T + PW / 2;
          p.vx = 0;
          return;
        }
      }
    }
    if (gateSolid()) {
      const g = level.gate;
      if (overlap({ x: p.x - PW / 2, y: p.y - PH, w: PW, h: PH }, { x: g.x, y: g.y, w: g.w, h: g.h })) {
        if (p.x < g.x + g.w / 2) p.x = g.x - PW / 2;
        else p.x = g.x + g.w + PW / 2;
        p.vx = 0;
      }
    }
  }

  function resolveY(p) {
    p.grounded = false;
    const b = playerBox(p);
    const x0 = Math.floor(b.x / T);
    const x1 = Math.floor((b.x + b.w - 0.01) / T);
    const y0 = Math.floor(b.y / T);
    const y1 = Math.floor((b.y + b.h - 0.01) / T);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const v = level.get(x, y);
        if (v === 1) {
          if (p.vy > 0) {
            p.y = y * T;
            p.vy = 0;
            p.grounded = true;
            return;
          } else if (p.vy < 0) {
            p.y = (y + 1) * T + PH;
            p.vy = 0;
            return;
          }
        } else if (v === 2 && p.vy >= 0) {
          const top = y * T + 2;
          if (p.prevBottom <= top + 1.5) {
            p.y = top;
            p.vy = 0;
            p.grounded = true;
            return;
          }
        }
      }
    }
    if (gateSolid()) {
      const g = level.gate;
      if (overlap({ x: p.x - PW / 2, y: p.y - PH, w: PW, h: PH }, { x: g.x, y: g.y, w: g.w, h: g.h })) {
        if (p.vy > 0) {
          p.y = g.y;
          p.vy = 0;
          p.grounded = true;
        }
      }
    }
  }

  function doJump(p) {
    p.vy = -JUMP;
    p.grounded = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.jumpCut = false;
    p.jumpTime = 0.0001;
    audio.sfx.jump();
    burst(p.x, p.y, 7, ['#8fa5c4', '#d5e4f5', '#5c7799'], 90, 0.4, 120, false);
    rings.push({ x: p.x, y: p.y, r: 4, life: 0.28, max: 0.28, color: '#a6e9ff' });
  }

  function doAirJump(p) {
    p.vy = -AIR_JUMP;
    p.airJumps -= 1;
    p.jumpBuf = 0;
    p.jumpCut = false;
    p.jumpTime = 0.0001;
    audio.sfx.doubleJump();
    rings.push({ x: p.x, y: p.y - 10, r: 6, life: 0.4, max: 0.4, color: '#ff6f9d' });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      particles.push({
        x: p.x, y: p.y - 14, vx: Math.cos(a) * 70, vy: Math.sin(a) * 40,
        life: 0.4, max: 0.4, size: 1, color: i % 2 ? '#ff8fb4' : '#9fefff',
        grav: 0, drag: 0.9, add: true,
      });
    }
  }

  function updatePlayer(dt) {
    const p = player;
    p.prevBottom = p.y;

    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.attackT > 0) p.attackT -= dt;
    if (p.coyote > 0) p.coyote -= dt;
    if (p.jumpBuf > 0) p.jumpBuf -= dt;
    if (p.attackBuf > 0) p.attackBuf -= dt;
    if (p.dashBuf > 0) p.dashBuf -= dt;
    if (p.jumpTime > 0) p.jumpTime += dt;
    p.idleT += dt;
    p.dustT -= dt;

    let dir = (isActive('right') ? 1 : 0) - (isActive('left') ? 1 : 0);
    if (dir !== 0 && p.dashT <= 0 && p.hurtT <= 0.14) p.facing = dir;

    // Actions are buffered by keydown, so a quick tap survives fixed-step frames and hitstop.
    if (p.attackBuf > 0 && p.attackT <= 0) {
      p.attackBuf = 0;
      p.attackT = 0.26;
      p.attackHit.clear();
      audio.sfx.slash();
    }

    if (p.dashBuf > 0 && p.dashCd <= 0 && (p.grounded || p.airDash > 0)) {
      p.dashBuf = 0;
      if (dir !== 0) p.facing = dir;
      p.dashT = DASH_TIME;
      p.dashCd = DASH_CD;
      if (!p.grounded) p.airDash -= 1;
      p.vy = 0;
      p.invuln = Math.max(p.invuln, 0.2);
      audio.sfx.dash();
      shake = 3;
      for (let i = 0; i < 9; i++) {
        particles.push({
          x: p.x - p.facing * rand(0, 12), y: p.y - rand(6, 30),
          vx: -p.facing * rand(30, 120), vy: rand(-25, 25),
          life: 0.3, max: 0.3, size: 1, color: '#b7eaff', grav: 0, drag: 0.92, add: true,
        });
      }
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.facing * DASH_SPEED;
      p.vy = 0;
      if (Math.random() < 0.38) {
        ghosts.push({ x: p.x, y: p.y, facing: p.facing, life: 0.26, max: 0.26 });
      }
      if (p.dashT <= 0) p.vx = p.facing * RUN * 0.72;
    } else {
      if (p.hurtT > 0) {
        p.vx = approach(p.vx, 0, 220 * dt);
      } else if (dir !== 0) {
        p.vx = approach(p.vx, dir * RUN, (p.grounded ? ACC : AIR_ACC) * dt);
      } else {
        p.vx = approach(p.vx, 0, (p.grounded ? FRIC : AIR_FRIC) * dt);
      }

      p.vy += GRAV * dt;
      if (p.vy > MAX_FALL) p.vy = MAX_FALL;

      if (p.jumpBuf > 0) {
        if (p.grounded || p.coyote > 0) doJump(p);
        else if (p.airJumps > 0) doAirJump(p);
      }

      if (!isActive('jump') && p.vy < 0 && !p.jumpCut && p.jumpTime > 0.06) {
        p.vy *= 0.52;
        p.jumpCut = true;
      }
    }

    p.x += p.vx * dt;
    resolveX(p);
    p.y += p.vy * dt;
    const wasGrounded = p.grounded;
    resolveY(p);

    if (p.grounded) {
      p.coyote = COYOTE;
      p.airJumps = 1;
      p.airDash = 1;
      p.jumpTime = 0;
      if (!wasGrounded && p.vy === 0) {
        audio.sfx.land();
        for (let i = 0; i < 8; i++) {
          particles.push({
            x: p.x + rand(-7, 7), y: p.y - 1, vx: rand(-60, 60), vy: rand(-60, -10),
            life: 0.34, max: 0.34, size: 1, color: i % 2 ? '#7f94b3' : '#c3d6ea',
            grav: 240, drag: 0.94, add: false,
          });
        }
        rings.push({ x: p.x, y: p.y, r: 3, life: 0.25, max: 0.25, color: '#9ab7d8' });
      }
      if (Math.abs(p.vx) > 40 && p.dashT <= 0 && p.dustT <= 0) {
        p.dustT = 0.075;
        particles.push({
          x: p.x - p.facing * 5, y: p.y - 1, vx: -p.facing * rand(10, 45), vy: rand(-40, -12),
          life: 0.32, max: 0.32, size: 1, color: '#6d819e', grav: 120, drag: 0.94, add: false,
        });
      }
      p.runPhase += (Math.abs(p.vx) / 42) * dt * 6;
    } else {
      if (p.coyote > 0) p.coyote -= dt;
      p.runPhase += dt * 2;
    }

    // bounds / fall
    if (p.y > level.H * T + 40) {
      killPlayer('fall');
      return;
    }

    // spikes
    for (const sp of level.spikes) {
      const rect = { x: sp.x0 * T, y: sp.y * T + 8, w: (sp.x1 - sp.x0 + 1) * T, h: 8 };
      if (p.invuln <= 0 && overlap(playerBox(p), rect)) {
        damagePlayer(1, rect.x + rect.w / 2);
        break;
      }
    }

    // attacks
    if (p.attackT > 0 && p.attackT < 0.21) {
      const box = p.facing > 0
        ? { x: p.x + 2, y: p.y - 46, w: 44, h: 42 }
        : { x: p.x - 46, y: p.y - 46, w: 44, h: 42 };
      for (const e of level.enemies) {
        if (!e.alive || p.attackHit.has(e)) continue;
        const eb = { x: e.x - 10, y: e.y + Math.sin(e.bob) * 4 - 9, w: 20, h: 18 };
        if (overlap(box, eb)) {
          p.attackHit.add(e);
          hitEnemy(e, p.facing);
        }
      }
    }
  }

  function hitEnemy(e, dir) {
    e.hp -= 1;
    e.hit = 0.16;
    e.x = clamp(e.x + dir * 7, e.min, e.max);
    audio.sfx.hit();
    shake = 4.5;
    hitstop = 0.045;
    flash = 0.1;
    flashColor = '255,190,150';
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: e.x, y: e.y + Math.sin(e.bob) * 4, vx: rand(-150, 150), vy: rand(-150, 60),
        life: rand(0.25, 0.5), max: 0.5, size: Math.random() < 0.3 ? 2 : 1,
        color: i % 3 === 0 ? '#ffffff' : i % 2 ? '#ff6b5a' : '#ffb45c',
        grav: 300, drag: 0.93, add: true,
      });
    }
    if (e.hp <= 0) {
      e.alive = false;
      audio.sfx.hit();
      for (let i = 0; i < 22; i++) {
        particles.push({
          x: e.x, y: e.y + Math.sin(e.bob) * 4, vx: rand(-190, 190), vy: rand(-200, 80),
          life: rand(0.3, 0.8), max: 0.8, size: rand(1, 2.4), color: i % 3 === 0 ? '#ffffff' : i % 2 ? '#ff6b5a' : '#ffb45c',
          grav: 340, drag: 0.93, add: true,
        });
      }
      rings.push({ x: e.x, y: e.y, r: 4, life: 0.35, max: 0.35, color: '#ff9a6b' });
      shake = 6;
    }
  }

  // ------------------------------------------------------------------ entities
  function updateEntities(dt) {
    // cores
    for (const c of level.cores) {
      if (c.taken) continue;
      c.bob += dt;
      const cy = c.y + Math.sin(c.bob * 2.2) * 3;
      const dx = player.x - c.x;
      const dy = (player.y - PH / 2) - cy;
      if (dx * dx + dy * dy < 24 * 24) {
        c.taken = true;
        coresGot += 1;
        audio.sfx.core();
        updateCoreUI();
        flash = 0.12;
        flashColor = '255,210,140';
        burst(c.x, cy, 22, ['#ffe6ae', '#ffb45c', '#ffffff', '#ff8a5c'], 140, 0.7, 80, true);
        rings.push({ x: c.x, y: cy, r: 5, life: 0.5, max: 0.5, color: '#ffcb73' });
        showToast(`数据核心 ${coresGot} / 3 已回收`, 2.6);
        if (coresGot < 3) showComms(`核心到手。还剩 ${3 - coresGot} 枚，别放松。`, 4);
        else showComms('三枚核心全部回收。去 B-7，把门打开。', 5);
      }
    }

    // checkpoints
    for (let i = 0; i < level.checkpoints.length; i++) {
      const c = level.checkpoints[i];
      if (c.active) continue;
      if (Math.abs(player.x - c.x) < 22 && Math.abs(player.y - c.y) < 48) {
        c.active = true;
        checkpointIdx = i;
        respawnPoint = { x: c.x, y: c.y };
        player.hp = player.maxHp;
        updateHpUI();
        audio.sfx.checkpoint();
        showToast('检查点已同步 · 生命信号恢复', 2.8);
        showComms(i === 0
          ? '检查点同步完毕。前面的楼区断电了，小心巡逻机。'
          : '最后一个检查点。B-7 就在前面——别让核心掉在地上。', 5.5);
        rings.push({ x: c.x, y: c.y - 20, r: 4, life: 0.6, max: 0.6, color: '#6fe7ff' });
        burst(c.x, c.y - 20, 16, ['#6fe7ff', '#d7fbff', '#ffffff'], 110, 0.7, -40, true);
      }
    }

    // enemies
    for (const e of level.enemies) {
      if (!e.alive) continue;
      e.bob += dt * 2.4;
      e.hit = Math.max(0, e.hit - dt);
      e.x += e.dir * 16 * dt;
      if (e.x < e.min) { e.x = e.min; e.dir = 1; }
      if (e.x > e.max) { e.x = e.max; e.dir = -1; }
      const ey = e.y + Math.sin(e.bob) * 4;
      if (player.invuln <= 0) {
        const eb = { x: e.x - 10, y: ey - 9, w: 20, h: 18 };
        if (overlap(playerBox(player), eb)) damagePlayer(1, e.x);
      }
    }

    // gate
    const g = level.gate;
    if (g) {
      if (gateHintT > 0) gateHintT -= dt;
      if (!g.open) {
        g.openT = Math.max(0, g.openT - dt);
        const near = player.x > g.x - 90 && player.x < g.x + g.w + 20;
        if (near) {
          if (coresGot >= 3) {
            g.open = true;
            g.openT = 0.001;
            audio.sfx.gate();
            shake = 5;
            showToast('B-7 撤离通道解锁', 3);
            showComms('门开了。把赤霄收好，走过去就行。', 4.5);
            burst(g.x + g.w / 2, g.y + g.h / 2, 26, ['#6dffb0', '#d6fff0', '#6fe7ff'], 150, 0.9, -30, true);
          } else if (gateHintT <= 0) {
            gateHintT = 3;
            showToast(`数据核心不足 · 还差 ${3 - coresGot} 枚`, 2.4);
          }
        }
      } else {
        g.openT = Math.min(1, g.openT + dt * 1.7);
        if (player.x > g.x + 22) showEnding();
      }
    }
  }

  // ------------------------------------------------------------------ camera / particles
  function updateCamera(dt) {
    const tx = player.x + player.facing * 18 + player.vx * 0.09 - W / 2;
    const ty = player.y - 22 - H / 2 - 34 + clamp(player.vy * 0.05, -14, 24);
    const k = 1 - Math.exp(-8 * dt);
    cam.x = clamp(lerp(cam.x, tx, k), 0, level.W * T - W);
    cam.y = clamp(lerp(cam.y, ty, k), 0, level.H * T - H);
  }

  function burst(x, y, n, colors, speed, life, grav, add) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * rand(0.25, 1);
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        life: life * rand(0.6, 1.2),
        max: life,
        size: Math.random() < 0.25 ? 2 : 1,
        color: colors[(Math.random() * colors.length) | 0],
        grav,
        drag: 0.95,
        add,
      });
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      ghosts[i].life -= dt;
      if (ghosts[i].life <= 0) ghosts.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.life -= dt;
      r.r += dt * 90;
      if (r.life <= 0) rings.splice(i, 1);
    }
  }

  function updateFx(dt) {
    animTime += dt;
    if (shake > 0) {
      shake = Math.max(0, shake - dt * 34);
      shakeX = rand(-1, 1) * shake;
      shakeY = rand(-1, 1) * shake;
    } else {
      shakeX = 0;
      shakeY = 0;
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
    for (const r of rain) {
      r.y += r.spd * dt;
      r.x += r.drift * dt;
      if (r.y > H + 12) {
        r.y = rand(-30, -4);
        r.x = rand(-40, W + 40);
      }
      if (r.x < -50) r.x += W + 100;
    }
    if (state === 'play') {
      lightningT -= dt;
      if (lightningT <= 0) {
        lightningT = rand(9, 18);
        flash = Math.max(flash, 0.55);
        flashColor = '170,205,255';
        audio.sfx.thunder();
      }
    }
  }

  function updateUI(dt) {
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) toastEl.classList.remove('show');
    }
    if (commsT > 0) {
      commsT -= dt;
      if (commsT <= 0) commsEl.classList.remove('show');
    }
    if (state === 'play') {
      hintTimer += dt;
      if (hintTimer > 9) hintsEl.classList.add('fade');
      hudTick += dt;
      if (hudTick > 0.2) {
        hudTick = 0;
        updateTimerUI();
      }
      if (player.hp !== lastHp) {
        lastHp = player.hp;
        updateHpUI();
      }
    }
  }

  // ------------------------------------------------------------------ glow
  const glowCache = new Map();
  function glowSprite(rgb) {
    if (glowCache.has(rgb)) return glowCache.get(rgb);
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grad.addColorStop(0, `rgba(${rgb},0.95)`);
    grad.addColorStop(0.25, `rgba(${rgb},0.42)`);
    grad.addColorStop(0.6, `rgba(${rgb},0.12)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glowCache.set(rgb, c);
    return c;
  }

  const GLOW = {
    pink: '255,79,139',
    cyan: '111,231,255',
    amber: '255,180,92',
    green: '109,255,176',
    red: '232,69,63',
    white: '235,245,255',
  };

  function drawGlow(sx, sy, r, rgb, alpha, blend = 'lighter') {
    if (sx < -r || sx > W + r || sy < -r || sy > H + r) return;
    ctx.save();
    ctx.globalCompositeOperation = blend;
    ctx.globalAlpha = alpha;
    ctx.drawImage(glowSprite(rgb), sx - r, sy - r, r * 2, r * 2);
    ctx.restore();
  }

  // ------------------------------------------------------------------ background
  function drawLayer(img, fx, fy, alpha) {
    if (!img) return;
    const iw = img.width;
    const ih = img.height;
    let ox = -((cam.x * fx) % iw);
    if (ox > 0) ox -= iw;
    const oy = -60 - cam.y * fy;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, 0, 0, iw, ih, Math.floor(ox), Math.floor(oy), iw, ih);
    ctx.drawImage(img, 0, 0, iw, ih, Math.floor(ox) + iw, Math.floor(oy), iw, ih);
    ctx.globalAlpha = 1;
  }

  function drawBackgrounds() {
    ctx.fillStyle = '#050810';
    ctx.fillRect(0, 0, W, H);
    drawLayer(IMG.far, 0.035, 0.03, 0.98);
    drawLayer(IMG.mid, 0.14, 0.055, 0.96);
    drawLayer(IMG.near, 0.36, 0.085, 0.94);

    // rain-night grade: knock the plates back so the foreground reads
    ctx.fillStyle = 'rgba(4, 8, 20, 0.42)';
    ctx.fillRect(0, 0, W, H);

    // city haze / horizon glow
    const hz = ctx.createRadialGradient(W * 0.66, 170, 10, W * 0.66, 170, 260);
    hz.addColorStop(0, 'rgba(80, 140, 210, 0.1)');
    hz.addColorStop(0.55, 'rgba(40, 70, 120, 0.04)');
    hz.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, W, H);

    const top = ctx.createLinearGradient(0, 0, 0, 120);
    top.addColorStop(0, 'rgba(2, 4, 10, 0.55)');
    top.addColorStop(1, 'rgba(2, 4, 10, 0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 120);

    const grad = ctx.createLinearGradient(0, H * 0.4, 0, H);
    grad.addColorStop(0, 'rgba(3, 6, 13, 0)');
    grad.addColorStop(0.62, 'rgba(3, 6, 13, 0.38)');
    grad.addColorStop(1, 'rgba(3, 6, 13, 0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------------ world
  let rx = 0;
  let ry = 0;

  function drawWorld() {
    if (!level.world) return;
    rx = clamp(cam.x + shakeX * 0.7, 0, level.W * T - W);
    ry = clamp(cam.y + shakeY * 0.7, 0, level.H * T - H);
    const sx = Math.floor(rx);
    const sy = Math.floor(ry);
    ctx.drawImage(level.world, sx, sy, W, H, Math.floor(sx - rx), Math.floor(sy - ry), W, H);

    drawGlows();
    drawRings();
    drawCores();
    drawCheckpoints();
    drawGate();
    drawEnemies();
    drawParticles(false);
    drawPlayer();
    drawSlash();
    drawParticles(true);
  }

  function drawGlows() {
    // neon edges
    for (const n of level.neonEdges) {
      const y = n.ypx - ry;
      if (y < -20 || y > H + 20) continue;
      const x0 = n.x0px - rx;
      const x1 = n.x1px - rx;
      if (x1 < -20 || x0 > W + 20) continue;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = n.color;
      ctx.fillRect(Math.floor(x0), Math.floor(y), Math.ceil(x1 - x0), 1);
      ctx.globalAlpha = 1;
      const pulse = 0.55 + 0.45 * Math.sin(animTime * 2.1 + n.phase);
      const rgb = n.color === '#ff4f8b' ? GLOW.pink : n.color === '#ffb45c' ? GLOW.amber : GLOW.cyan;
      drawGlow((x0 + x1) / 2, y, 26, rgb, 0.1 * pulse);
    }
    // lamps
    for (const l of level.lamps) {
      const x = l.x - rx;
      const y = l.y - l.h - ry;
      if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
      const rgb = l.color === '#ffb45c' ? GLOW.amber : l.color === '#ff4f8b' ? GLOW.pink : GLOW.cyan;
      drawGlow(x, y, 30, rgb, 0.16 + 0.03 * Math.sin(animTime * 3 + l.x));
      // light cone in the rain
      const groundY = l.y - ry;
      const cone = ctx.createLinearGradient(0, y + 3, 0, groundY);
      cone.addColorStop(0, `rgba(${rgb},0.10)`);
      cone.addColorStop(0.55, `rgba(${rgb},0.035)`);
      cone.addColorStop(1, `rgba(${rgb},0)`);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(x - 3, y + 3);
      ctx.lineTo(x + 3, y + 3);
      ctx.lineTo(x + 28, groundY);
      ctx.lineTo(x - 28, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(${rgb},0.9)`;
      ctx.fillRect(Math.round(x) - 3, Math.round(y), 7, 1);
      ctx.restore();
    }
    // signs
    for (const s of level.signs) {
      const x = s.px + 24 - rx;
      const y = s.py + 8 - ry;
      if (x < -80 || x > W + 80 || y < -40 || y > H + 40) continue;
      const rgb = s.color === '#ff4f8b' ? GLOW.pink : s.color === '#ffb45c' ? GLOW.amber : s.color === '#6dffb0' ? GLOW.green : GLOW.cyan;
      drawGlow(x, y, 34, rgb, 0.12 + 0.035 * Math.sin(animTime * 2.4 + s.px));
    }
    // player silhouette lift
    drawGlow(player.x - rx, player.y - 20 - ry, 38, '90,150,220', 0.1);
    drawGlow(player.x + player.facing * 12 - rx, player.y - 26 - ry, 13, GLOW.red, 0.07);
  }

  function drawCores() {
    for (const c of level.cores) {
      if (c.taken) continue;
      const x = c.x - rx;
      const y = c.y + Math.sin(c.bob * 2.2) * 3 - ry;
      if (x < -40 || x > W + 40) continue;
      drawGlow(x, y, 24, GLOW.amber, 0.28 + 0.1 * Math.sin(animTime * 3 + c.bob));
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(animTime * 1.1 + c.bob * 0.2);
      ctx.fillStyle = '#ffd484';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.fillStyle = '#ffb45c';
      ctx.fillRect(-3, -3, 6, 6);
      ctx.fillStyle = '#fff3d0';
      ctx.fillRect(-1, -2, 2, 3);
      ctx.restore();
      // small orbit mark
      const a = animTime * 2 + c.id;
      ctx.fillStyle = 'rgba(255,220,150,0.75)';
      ctx.fillRect(Math.round(x + Math.cos(a) * 10), Math.round(y + Math.sin(a) * 6), 1, 1);
      ctx.fillRect(Math.round(x + Math.cos(a + Math.PI) * 10), Math.round(y + Math.sin(a + Math.PI) * 6), 1, 1);
    }
  }

  function drawCheckpoints() {
    for (const c of level.checkpoints) {
      const x = c.x - rx;
      const y = c.y - ry;
      if (x < -40 || x > W + 40 || y < -60 || y > H + 40) continue;
      const active = c.active;
      const rgb = active ? GLOW.cyan : GLOW.amber;
      const pulse = 0.5 + 0.5 * Math.sin(animTime * 3 + c.id);
      drawGlow(x, y - 22, active ? 34 : 20, rgb, active ? 0.3 : 0.12 + pulse * 0.06);
      // base
      ctx.fillStyle = '#0b111b';
      ctx.fillRect(x - 7, y - 3, 14, 3);
      ctx.fillStyle = '#33445e';
      ctx.fillRect(x - 7, y - 3, 14, 1);
      ctx.fillStyle = '#1b2738';
      ctx.fillRect(x - 1, y - 24, 3, 21);
      ctx.fillStyle = active ? '#6fe7ff' : '#7c5a38';
      ctx.fillRect(x - 1, y - 24, 1, 21);
      // beacon diamond
      const by = y - 27 + Math.sin(animTime * 2.4) * 1.5;
      ctx.fillStyle = active ? '#bffaff' : '#d9b07a';
      ctx.fillRect(x - 2, Math.round(by) - 3, 5, 7);
      ctx.fillStyle = active ? '#6fe7ff' : '#ffb45c';
      ctx.fillRect(x - 1, Math.round(by) - 4, 3, 9);
      ctx.fillStyle = active ? '#ffffff' : '#ffe9c7';
      ctx.fillRect(x, Math.round(by) - 2, 1, 3);
      if (active) {
        const beam = ctx.createLinearGradient(0, y - 60, 0, y);
        beam.addColorStop(0, 'rgba(111,231,255,0)');
        beam.addColorStop(1, 'rgba(111,231,255,0.10)');
        ctx.fillStyle = beam;
        ctx.fillRect(x - 10, y - 60, 20, 60);
      }
    }
  }

  function drawGate() {
    const g = level.gate;
    if (!g) return;
    const x = g.x - rx;
    const y = g.y - ry;
    if (x > W + 80 || x + g.w < -80) return;
    const t = g.open ? g.openT : 0;
    const doorH = Math.max(0, g.h * (1 - t));
    const cx = x + g.w / 2;
    const cy = y + g.h / 2;
    drawGlow(cx, cy, 100, g.open ? GLOW.green : GLOW.red, g.open ? 0.18 : 0.1);

    // recess / frame
    ctx.fillStyle = '#05080e';
    ctx.fillRect(x - 12, y - 20, g.w + 24, g.h + 22);
    for (const px of [x - 12, x + g.w + 6]) {
      ctx.fillStyle = '#101725';
      ctx.fillRect(px, y - 20, 6, g.h + 22);
      ctx.fillStyle = '#33425b';
      ctx.fillRect(px, y - 20, 6, 2);
      ctx.fillStyle = '#1d2738';
      ctx.fillRect(px + 1, y - 14, 1, g.h + 10);
    }
    // lintel + hazard chevrons
    ctx.fillStyle = '#0b1119';
    ctx.fillRect(x - 12, y - 20, g.w + 24, 11);
    for (let i = -12; i < g.w + 14; i += 9) {
      ctx.fillStyle = '#9d6a2c';
      for (let k = 0; k < 4; k++) ctx.fillRect(x + i + k, y - 19 + k, 4, 2);
    }
    // neon frame line
    ctx.fillStyle = g.open ? 'rgba(109,255,176,0.85)' : 'rgba(255,79,92,0.75)';
    ctx.fillRect(x - 2, y - 2, g.w + 4, 1);
    ctx.fillRect(x - 2, y - 2, 1, g.h + 2);
    ctx.fillRect(x + g.w + 1, y - 2, 1, g.h + 2);

    // threshold
    ctx.fillStyle = '#1a2436';
    ctx.fillRect(x - 8, y + g.h - 3, g.w + 16, 3);
    ctx.fillStyle = '#3c4f6c';
    ctx.fillRect(x - 8, y + g.h - 3, g.w + 16, 1);

    // opening / corridor
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, g.w, g.h);
    ctx.clip();
    ctx.fillStyle = '#03070c';
    ctx.fillRect(x, y, g.w, g.h);
    if (g.open) {
      const beam = ctx.createLinearGradient(0, y + g.h, 0, y);
      beam.addColorStop(0, 'rgba(109,255,176,0.2)');
      beam.addColorStop(1, 'rgba(109,255,176,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(x, y, g.w, g.h);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(109,255,176,${0.05 + 0.03 * Math.sin(animTime * 4 + i)})`;
        ctx.fillRect(x + 4 + i * 16, y + 6, 1, g.h - 12);
      }
    }

    // shutter panel (rolls up)
    if (doorH > 0.5) {
      for (let i = 0; i < 4; i++) {
        const px = x + i * 16;
        ctx.fillStyle = i % 2 ? '#1b2232' : '#171e2c';
        ctx.fillRect(px, y, 15, doorH);
        ctx.fillStyle = 'rgba(82, 104, 136, 0.5)';
        ctx.fillRect(px, y, 15, 1);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(px + 15, y, 1, doorH);
      }
      for (let by = y + 18; by < y + doorH - 2; by += 18) {
        ctx.fillStyle = 'rgba(3, 6, 12, 0.45)';
        ctx.fillRect(x, by, g.w, 1);
      }
      if (doorH > 34) {
        level.fontDraw(ctx, 'B-7', x + 18, y + 14, 2, g.open ? '#a9ffd4' : '#ffd0bb', 'rgba(0,0,0,0.8)');
      }
      // bottom edge warning stripe
      const by = y + doorH - 7;
      if (doorH > 10) {
        ctx.fillStyle = '#161a24';
        ctx.fillRect(x, by, g.w, 6);
        for (let i = 0; i < g.w; i += 8) {
          ctx.fillStyle = '#b5792f';
          for (let k = 0; k < 4; k++) ctx.fillRect(x + i + k, by + 2 + k, 3, 2);
        }
      }
      ctx.fillStyle = g.open ? '#6dffb0' : '#ff6b5a';
      ctx.fillRect(x, y + doorH - 1, g.w, 1);
    }
    ctx.restore();

    // pillar status lamps
    for (const px of [x - 9, x + g.w + 3]) {
      drawGlow(px + 2, y + 10, 10, g.open ? GLOW.green : GLOW.red, 0.35);
      ctx.fillStyle = g.open ? '#6dffb0' : '#ff4f5c';
      ctx.fillRect(px, y + 8, 4, 4);
      ctx.fillStyle = '#02100c';
      ctx.fillRect(px + 1, y + 9, 2, 2);
    }
    // overhead plate
    ctx.fillStyle = '#0c121c';
    ctx.fillRect(cx - 23, y - 15, 46, 10);
    ctx.fillStyle = g.open ? '#6dffb0' : '#ffb45c';
    ctx.fillRect(cx - 23, y - 15, 46, 1);
    level.fontDraw(ctx, 'B-7', cx - 14, y - 14, 1, g.open ? '#c9ffe6' : '#ffe1bf');
  }

  function drawEnemies() {
    for (const e of level.enemies) {
      if (!e.alive) continue;
      const x = e.x - rx;
      const y = e.y + Math.sin(e.bob) * 4 - ry;
      if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      drawGlow(x, y, 18, GLOW.red, 0.14);
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      if (e.dir < 0) ctx.scale(-1, 1);
      // rotors
      const rot = Math.sin(animTime * 30) * 5;
      ctx.fillStyle = '#1c2434';
      ctx.fillRect(-11, -9 + rot * 0.2, 22, 2);
      ctx.fillStyle = '#40536f';
      ctx.fillRect(-11, -9, 6, 1);
      ctx.fillRect(5, -9, 6, 1);
      // body
      ctx.fillStyle = e.hit > 0 ? '#ffffff' : '#2b364d';
      ctx.fillRect(-8, -6, 16, 9);
      ctx.fillStyle = e.hit > 0 ? '#ffdede' : '#18202f';
      ctx.fillRect(-7, -5, 14, 7);
      ctx.fillStyle = '#43536c';
      ctx.fillRect(-8, -6, 16, 1);
      // eye
      ctx.fillStyle = '#ff4f5c';
      ctx.fillRect(3, -3, 3, 2);
      ctx.fillStyle = '#ffd0c8';
      ctx.fillRect(4, -3, 1, 1);
      // fins
      ctx.fillStyle = '#1b2333';
      ctx.fillRect(-9, 3, 3, 3);
      ctx.fillRect(6, 3, 3, 3);
      ctx.restore();
      // scanner line
      ctx.fillStyle = 'rgba(255,80,90,0.18)';
      ctx.fillRect(Math.round(x - 14), Math.round(y + 10), 28, 1);
    }
  }

  function drawPlayer() {
    const p = player;
    if (!p) return;
    const sx = Math.round(p.x - rx);
    const sy = Math.round(p.y - ry);

    // shadow
    if (p.grounded) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + 1, 9, 2.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    drawGlow(sx, sy - 20, 26, '90,150,220', 0.06);

    // ghosts
    for (const g of ghosts) {
      const a = (g.life / g.max) * 0.25;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(Math.round(g.x - rx), Math.round(g.y - ry));
      if (g.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(IMG.sheet, 12 * 56, 56, 56, 56, -28, -53, 56, 56);
      ctx.restore();
    }

    let frame = 0;
    if (p.dashT > 0) frame = 12;
    else if (p.attackT > 0) frame = p.attackT > 0.12 ? 14 : 15;
    else if (p.hurtT > 0) frame = 13;
    else if (!p.grounded) frame = p.vy < 0 ? 10 : 11;
    else if (Math.abs(p.vx) > 12) frame = 4 + (Math.floor(p.runPhase) % 6);
    else frame = Math.floor(p.idleT * 4) % 4;

    const blink = p.invuln > 0 && p.invuln < 90 && Math.floor(animTime * 24) % 2 === 0;
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    ctx.translate(sx, sy);
    if (p.facing < 0) ctx.scale(-1, 1);
    const col = frame % 8;
    const row = Math.floor(frame / 8);
    ctx.drawImage(IMG.sheet, col * 56, row * 56, 56, 56, -28, -53, 56, 56);
    // cool rim from the city neon
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = blink ? 0.22 : 0.7;
    ctx.drawImage(IMG.rim, col * 56, row * 56, 56, 56, -28, -53, 56, 56);
    ctx.restore();
  }

  function drawSlash() {
    const p = player;
    if (!p || p.attackT <= 0) return;
    const t = 0.26 - p.attackT;
    const idx = Math.min(3, Math.floor(t / 0.05));
    const img = SLASH[idx];
    if (!img) return;
    const hx = p.x + p.facing * 16 - rx;
    const hy = p.y - 28 - ry;
    drawGlow(hx, hy, 34, GLOW.red, 0.2);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(p.facing, 1);
    ctx.drawImage(img, -34, -30, 72, 72);
    ctx.restore();
  }

  function drawRings() {
    for (const r of rings) {
      const a = Math.max(0, r.life / r.max);
      const rgb = r.color === '#a6e9ff' ? GLOW.cyan : r.color === '#ff6f9d' ? GLOW.pink : r.color === '#ffcb73' ? GLOW.amber : GLOW.cyan;
      drawGlow(r.x - rx, r.y - ry, r.r * 1.8, rgb, 0.25 * a);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = a * 0.8;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(r.x - rx, r.y - ry, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles(add) {
    for (const p of particles) {
      if (p.add !== add) continue;
      const x = Math.round(p.x - rx);
      const y = Math.round(p.y - ry);
      if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (add) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size));
      ctx.fillRect(x, y, s, s);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ------------------------------------------------------------------ screen fx
  function drawRain() {
    ctx.lineWidth = 1;
    for (const r of rain) {
      ctx.strokeStyle = `rgba(150,190,235,${r.a})`;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.drift * 0.025, r.y + r.len);
      ctx.stroke();
      if (r.y > H - 3 && Math.random() < 0.02) {
        ctx.fillStyle = 'rgba(160,200,240,0.25)';
        ctx.fillRect(r.x, H - 2, 1, 1);
      }
    }
    // faint drifting fog band
    const fog = ctx.createLinearGradient(0, H - 70, 0, H);
    fog.addColorStop(0, 'rgba(80,120,170,0)');
    fog.addColorStop(0.6, 'rgba(80,120,170,0.035)');
    fog.addColorStop(1, 'rgba(80,120,170,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, H - 70, W, 70);

    // slow mist band, drifts a little with the camera
    const mistY = 132 + Math.sin(animTime * 0.13) * 7;
    const mist = ctx.createLinearGradient(0, mistY - 34, 0, mistY + 34);
    mist.addColorStop(0, 'rgba(96,136,188,0)');
    mist.addColorStop(0.5, 'rgba(96,136,188,0.055)');
    mist.addColorStop(1, 'rgba(96,136,188,0)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, mistY - 34, W, 68);
  }

  function drawFlash() {
    if (flash <= 0.002) return;
    ctx.fillStyle = `rgba(${flashColor},${Math.min(0.6, flash * 0.6)})`;
    ctx.fillRect(0, 0, W, H);
  }

  function buildRain() {
    rain.length = 0;
    for (let i = 0; i < 210; i++) {
      rain.push({
        x: rand(-40, W + 40),
        y: rand(0, H),
        len: rand(5, 13),
        spd: rand(280, 470),
        drift: rand(-65, -35),
        a: rand(0.1, 0.34),
      });
    }
  }

  // ------------------------------------------------------------------ step / render
  function step(dt) {
    if (hitstop > 0) {
      hitstop -= dt;
      return;
    }
    if (state === 'play') {
      elapsed += dt;
      updatePlayer(dt);
      updateEntities(dt);
      updateCamera(dt);
      updateParticles(dt);
      updateFx(dt);
      updateUI(dt);
    } else if (state === 'dead') {
      deathTimer -= dt;
      if (deathTimer < 1.0) fadeEl.classList.add('on');
      if (deathTimer <= 0) {
        respawn();
      }
      updateParticles(dt);
      updateFx(dt);
      updateUI(dt);
    } else if (state === 'end') {
      updateParticles(dt);
      updateFx(dt);
      updateUI(dt);
    } else {
      updateFx(dt);
    }
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    drawBackgrounds();
    if (ready && player) {
      drawWorld();
    }
    drawRain();
    drawFlash();
  }

  let last = 0;
  let acc = 0;
  const STEP = 1 / 120;

  function loop(now) {
    if (!last) last = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 8) {
      step(STEP);
      acc -= STEP;
      guard += 1;
    }
    if (guard === 8) acc = 0;
    render();
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------ input
  const gameKeyCodes = new Set();
  Object.values(ACTIONS).forEach((arr) => arr.forEach((k) => gameKeyCodes.add(k)));
  gameKeyCodes.add('Enter');

  window.addEventListener('keydown', (e) => {
    if (gameKeyCodes.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);

    if (state === 'title') {
      if ((e.code === 'Enter' || e.code === 'Space') && ready) startRun();
      return;
    }
    if (state === 'ending') {
      if (e.code === 'Enter' || e.code === 'KeyR') startRun();
      return;
    }
    if (e.code === 'KeyM') {
      const muted = audio.toggleMute();
      if (state === 'play' || state === 'pause') showToast(muted ? '音频已关闭' : '音频已开启', 1.4);
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === 'play' || state === 'pause') togglePause();
      return;
    }
    if (state === 'pause') {
      if (e.code === 'Enter') {
        togglePause();
      }
      return;
    }
    if (state === 'play' && e.code === 'KeyR') {
      startRun();
      return;
    }

    // Buffer game actions at the event itself. This makes quick taps reliable
    // even when a render frame runs no fixed step, or during hitstop.
    if (state === 'play' && player) {
      if (ACTIONS.jump.includes(e.code)) player.jumpBuf = BUFFER;
      else if (ACTIONS.attack.includes(e.code)) player.attackBuf = ATTACK_BUFFER;
      else if (ACTIONS.dash.includes(e.code)) player.dashBuf = DASH_BUFFER;
    }
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  let imeWarned = false;
  window.addEventListener('compositionstart', () => {
    if (state === 'play' && !imeWarned) {
      imeWarned = true;
      showToast('检测到输入法 · 建议切换到英文后再操作', 3.4);
    }
  });

  window.addEventListener('blur', () => {
    keys.clear();
    if (player) {
      player.jumpBuf = 0;
      player.attackBuf = 0;
      player.dashBuf = 0;
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'play') togglePause();
  });

  startBtn.addEventListener('click', () => {
    audio.init();
    startRun();
    startBtn.blur();
  });
  resumeBtn.addEventListener('click', () => {
    audio.init();
    togglePause();
    resumeBtn.blur();
  });
  restartBtn.addEventListener('click', () => {
    audio.init();
    startRun();
    restartBtn.blur();
  });

  window.addEventListener('resize', resize);

  // ------------------------------------------------------------------ boot
  function init() {
    level.buildWorld(tilesImg);
    level.reset();
    player = makePlayer(level.spawn.x, level.spawn.y);
    player.grounded = true;
    snapCamera();
    buildRain();
    resize();
    ready = true;
    bootEl.classList.add('done');
    startBtn.disabled = false;
    loadNote.textContent = '档案载入完成 · 按 ENTER 开始';
    loadNote.classList.add('ready');
    requestAnimationFrame(loop);

    // idle attract frame
    updateHpUI();
    updateCoreUI();
  }

  loadAssets()
    .then(init)
    .catch((err) => {
      console.error(err);
      bootEl.classList.add('done');
      loadNote.textContent = '素材载入失败：' + err.message;
      loadNote.style.color = '#ff6b6b';
      startBtn.disabled = true;
    });

  // debug / test hooks
  window.__NF = {
    get state() { return state; },
    get player() { return player; },
    get cam() { return cam; },
    get cores() { return coresGot; },
    level,
    imgs: IMG,
    start: () => { audio.init(); startRun(); },
    teleport(x, y) {
      if (!player) return;
      player.x = x;
      player.y = y;
      player.vx = 0;
      player.vy = 0;
      snapCamera();
    },
    setCores(n) {
      coresGot = n;
      updateCoreUI();
    },
    god() {
      if (player) player.invuln = 999;
    },
    pause: togglePause,
  };
})();
