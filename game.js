f (() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const livesEl = document.getElementById("lives");
  const levelTextEl = document.getElementById("levelText");
  const xpTextEl = document.getElementById("xpText");
  const xpFillEl = document.getElementById("xpFill");
  const levelUpEl = document.getElementById("levelUp");
  const gameOverEl = document.getElementById("gameover");
  const finalScoreEl = document.getElementById("finalScore");
  const inputValueEl = document.getElementById("inputValue");
  const pausedEl = document.getElementById("paused");
  const startScreenEl = document.getElementById("startScreen");
  const restartBtnEl = document.getElementById("restartBtn");
  const changeDiffBtnEl = document.getElementById("changeDiffBtn");
  const diffBtnEls = document.querySelectorAll(".diffBtn");
  const trainBtnEls = document.querySelectorAll(".trainBtn");
  const chargeEl = document.getElementById("charge");
  const chargeValEl = document.getElementById("chargeVal");
  const trainingBadgeEl = document.getElementById("trainingBadge");
  const trainingNumEl = document.getElementById("trainingNum");
  const bossAlertEl = document.getElementById("bossAlert");

  const PLAYER_RADIUS = 14;
  const MAX_LIVES = 3;
  const MAX_INPUT_LEN = 4;
  const GRID_SIZE = 56;
  const LIFE_LOSS_WIPE_RADIUS = 320;

  // ---------- difficulties

  const DIFFICULTIES = {
    tresfacile: {
      maxNum: 12,
      enemyCapAdd: 3,
      speedMult: 0.50,
      spawnBase: 1.8,
      spawnDecay: 0.94,
      spawnMin: 0.85,
      chargeMax: 10,
      simpleBoss: true,
      spawnTable: [
        { yellow: 1 },
        { yellow: 3, pink: 1 },
         { yellow: 6, pink: 2, green: 1 },
      ],
    },
    easy: {
      maxNum: 20,
      enemyCapAdd: 3,
      speedMult: 0.50,
      spawnBase: 1.8,
      spawnPerLevel: 0.10,
      spawnMin: 0.85,
      chargeMax: 15,
    },
    medium: {
      maxNum: 50,
      enemyCapAdd: 5,
      speedMult: 0.70,
      spawnBase: 1.4,
      spawnPerLevel: 0.10,
      spawnMin: 0.70,
      chargeMax: 30,
    },
    hard: {
      maxNum: 100,
      enemyCapAdd: 7,
      speedMult: 0.72,
      spawnBase: 1.4,
      spawnDecay: 0.95,
      spawnMin: 0.75,
      chargeMax: 50,
    },
  };
  // give easy/medium their decay knob too
  DIFFICULTIES.easy.spawnDecay = 0.94;
  DIFFICULTIES.medium.spawnDecay = 0.93;

  // ---------- equation generators (kid-friendly: 6yo)

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  function mkAdd(aMax, bMax) {
    const a = randInt(1, aMax), b = randInt(1, bMax);
    return { text: `${a}+${b}`, answer: a + b };
  }
  function mkSubNonNeg(aMax) {
    const a = randInt(2, aMax), b = randInt(1, a - 1);
    return { text: `${a}-${b}`, answer: a - b };
  }
  function mkAdd3(eachMax) {
    const a = randInt(1, eachMax), b = randInt(1, eachMax), c = randInt(1, eachMax);
    return { text: `${a}+${b}+${c}`, answer: a + b + c };
  }

  // training-mode variants: equation must contain a chosen target as one operand
  function pickTarget(targets) {
    return targets[Math.floor(Math.random() * targets.length)];
  }
  function mkAddWith(target, otherMax) {
    const other = randInt(1, Math.max(2, otherMax));
    return Math.random() < 0.5
      ? { text: `${target}+${other}`, answer: target + other }
      : { text: `${other}+${target}`, answer: target + other };
  }
  function mkSubWith(target) {
    // target as the minuend; caller ensures target >= 2
    const b = randInt(1, target - 1);
    return { text: `${target}-${b}`, answer: target - b };
  }
  function mkAdd3With(target, eachMax) {
    const m = Math.max(2, eachMax);
    const others = [randInt(1, m), randInt(1, m)];
    const pos = Math.floor(Math.random() * 3);
    const arr = others.slice();
    arr.splice(pos, 0, target);
    return { text: `${arr[0]}+${arr[1]}+${arr[2]}`, answer: arr[0] + arr[1] + arr[2] };
  }

  function eqAdd(cap, targets, frac, min) {
    const m = operandCap(cap, frac, min);
    if (targets && targets.length) return mkAddWith(pickTarget(targets), m);
    return mkAdd(m, m);
  }
  function eqAddOrSub(cap, targets, frac, min) {
    const m = operandCap(cap, frac, min);
    if (targets && targets.length) {
      const t = pickTarget(targets);
      if (t >= 2 && Math.random() < 0.5) return mkSubWith(t);
      return mkAddWith(t, m);
    }
    return Math.random() < 0.5 ? mkAdd(m, m) : mkSubNonNeg(m);
  }
  function eqAdd3(cap, targets, frac, min) {
    const m = operandCap(cap, frac, min);
    if (targets && targets.length) return mkAdd3With(pickTarget(targets), m);
    return mkAdd3(m);
  }

  // ---------- enemy types

  function operandCap(cap, frac, min) {
    return Math.max(min, Math.floor(cap * frac));
  }

  const TYPES = {
    yellow: {
      color: "#fbbf24", radius: 13, speed: 38, xp: 1, hp: 1,
      eq: (cap, target) => eqAdd(cap, target, 0.25, 2),
    },
    money: {
      color: "#fbbf24", radius: 14, speed: 0, xp: 4, hp: 1, lifetime: 8,
      eq: (cap, target) => eqAdd(cap, target, 0.20, 2),
    },
    pink: {
      color: "#f472b6", radius: 15, speed: 50, xp: 3, hp: 1,
      eq: (cap, target) => {
        const m = Math.max(2, operandCap(cap, 0.5, 2));
        if (target && target.length) {
          const t = pickTarget(target);
          const other = randInt(2, m);
          return Math.random() < 0.5
            ? { text: `${t}+${other}`, answer: t + other }
            : { text: `${other}+${t}`, answer: t + other };
        }
        const a = randInt(2, m), b = randInt(2, m);
        return { text: `${a}+${b}`, answer: a + b };
      },
    },
    green: {
      color: "#34d399", radius: 16, speed: 44, xp: 5, hp: 1,
      eq: (cap, target) => eqAddOrSub(cap, target, 0.50, 3),
    },
    blue: {
      color: "#60a5fa", radius: 18, speed: 32, xp: 8, hp: 2, hasShield: true,
      eq: (cap, target) => eqAddOrSub(cap, target, 0.65, 3),
    },
    hexagon: {
      color: "#cbd5e1", radius: 30, speed: 22, xp: 20, hp: 3, shape: "hex",
      eq: (cap, target) => eqAdd3(cap, target, 0.20, 2),
    },
    boss: {
      color: "#a78bfa", radius: 40, speed: 18, xp: 50, hp: 4, shape: "boss",
    },
  };

  const BOSS_COLORS = ["#a78bfa", "#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee"];

  // weighted spawn table per level (last entry used for higher levels)
  const SPAWN_TABLE = [
    { yellow: 1 },                                                    // L1
    { yellow: 4, money: 1 },                                          // L2
    { yellow: 3, money: 1, pink: 2 },                                 // L3
    { yellow: 2, money: 1, pink: 2, green: 2 },                       // L4
    { yellow: 2, money: 1, pink: 2, green: 2, blue: 2 },              // L5
    { yellow: 2, money: 1, pink: 2, green: 2, blue: 2, hexagon: 1 },  // L6+
  ];

  function spawnTableForLevel(level, cfg) {
    const table = (cfg && cfg.spawnTable) || SPAWN_TABLE;
    const i = Math.min(level, table.length) - 1;
    return table[Math.max(0, i)];
  }

  function pickType(level, cfg) {
    const t = spawnTableForLevel(level, cfg);
    let total = 0;
    for (const k in t) total += t[k];
    let r = Math.random() * total;
    for (const k in t) {
      r -= t[k];
      if (r <= 0) return k;
    }
    return "yellow";
  }

  function spawnIntervalForLevel(level, cfg) {
    return Math.max(cfg.spawnMin, cfg.spawnBase * Math.pow(cfg.spawnDecay, level - 1));
  }

  function levelSpeedFactor(level) {
    // grows ~5 % per level, capped at 2.0x. Sub-exponential ramp.
    return Math.min(2.0, 1 + (level - 1) * 0.05);
  }

  function xpToNext(level) {
    // sub-exponential growth: between linear and quadratic (level^1.3)
    return Math.ceil(3 + Math.pow(level, 1.3));
  }

  // ---------- canvas sizing

  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- state

  const state = {
    started: false,
    diffKey: null,
    config: null,
    lives: MAX_LIVES,
    level: 1,
    xp: 0,
    totalXp: 0,
    enemies: [],
    lasers: [],
    deaths: [],
    spawnTimer: 0,
    gameOver: false,
    flashTimer: 0,
    shakeTimer: 0,
    levelUpTimer: 0,
    input: "",
    paused: false,
    charge: 0,
    bossesSpawned: 0,
    bossAlertTimer: 0,
  };

  function startGame(diffKey, opts = {}) {
    state.diffKey = diffKey;
    state.config = { ...DIFFICULTIES[diffKey], ...opts };
    state.started = true;
    state.lives = MAX_LIVES;
    state.level = 1;
    state.xp = 0;
    state.totalXp = 0;
    state.enemies = [];
    state.lasers = [];
    state.deaths = [];
    state.spawnTimer = 0;
    state.gameOver = false;
    state.flashTimer = 0;
    state.shakeTimer = 0;
    state.levelUpTimer = 0;
    state.input = "";
    state.paused = false;
    state.charge = 0;
    state.bossesSpawned = 0;
    state.bossAlertTimer = 0;
  }

  function goToStart() {
    state.started = false;
    state.gameOver = false;
    state.paused = false;
    state.enemies = [];
    state.lasers = [];
    state.deaths = [];
    state.input = "";
  }

  function maxEnemiesForLevel(level) {
    return level + (state.config ? state.config.enemyCapAdd : 3);
  }

  // pick an x-coordinate in the outer thirds (left third or right third) so
  // enemies spawning from top/bottom still have horizontal distance to travel
  // on wide screens.
  function randXOuterThirds() {
    return Math.random() < 0.5
      ? Math.random() * (W / 3)
      : (W * 2 / 3) + Math.random() * (W / 3);
  }

  function spawnEnemy() {
    const type = pickType(state.level, state.config);
    const spec = TYPES[type];

    let x, y;
    if (spec.speed === 0) {
      const cx = W / 2, cy = H / 2;
      let attempts = 0;
      do {
        x = 80 + Math.random() * (W - 160);
        y = 80 + Math.random() * (H - 160);
        attempts++;
      } while (Math.hypot(x - cx, y - cy) < 220 && attempts < 12);
    } else {
      const edge = Math.floor(Math.random() * 4);
      const m = spec.radius + 40;
      if (edge === 0)      { x = randXOuterThirds(); y = -m; }
      else if (edge === 1) { x = W + m;              y = Math.random() * H; }
      else if (edge === 2) { x = randXOuterThirds(); y = H + m; }
      else                 { x = -m;                 y = Math.random() * H; }
    }

    const eq = spec.eq(state.config.maxNum, state.config.trainingTargets);
    const enemy = {
      type, x, y,
      text: eq.text, answer: eq.answer,
      hp: spec.hp,
      maxHp: spec.hp,
      radius: spec.radius,
      speed: spec.speed,
      color: spec.color,
      xpReward: spec.xp,
    };
    if (spec.lifetime) enemy.timeLeft = spec.lifetime;
    state.enemies.push(enemy);
  }

  function spawnBoss(tier) {
    // wipe everything else off the screen — boss fight is solo
    for (const e of state.enemies) {
      state.deaths.push({
        x: e.x, y: e.y,
        life: 0.45, maxLife: 0.45,
        color: e.color,
        radius: e.radius,
      });
    }
    state.enemies = [];

    const cap = state.config.maxNum;
    const targets = state.config.trainingTargets;
    const simple = state.config.simpleBoss;
    let eq;
    if (simple) {
      eq = eqAdd(cap, targets, 0.55 + tier * 0.05, 3);
    } else {
      const pick = Math.random();
      if (pick < 0.4) {
        eq = eqAdd(cap, targets, 0.55 + tier * 0.06, 3);
      } else if (pick < 0.75) {
        eq = eqAddOrSub(cap, targets, 0.55 + tier * 0.06, 3);
      } else {
        eq = eqAdd3(cap, targets, 0.30 + tier * 0.03, 2);
      }
    }

    const hp = simple
      ? 4 + tier * 2 + randInt(0, 1)
      : 5 + tier * 3 + randInt(0, 2);
    const speed = 14 + tier * 3;
    const radius = 50 + tier * 10;
    const color = BOSS_COLORS[Math.floor(Math.random() * BOSS_COLORS.length)];
    const xpReward = 50 * tier;

    // boss enters only from the left or right edge
    const m = radius + 60;
    const x = Math.random() < 0.5 ? -m : W + m;
    const y = Math.random() * H;

    state.enemies.push({
      type: "boss",
      tier,
      x, y,
      text: eq.text, answer: eq.answer,
      hp, maxHp: hp,
      radius, speed, color, xpReward,
      phase: 1,
    });
    state.bossAlertTimer = 1.5;
  }

  function gainXp(amount) {
    state.xp += amount;
    state.totalXp += amount;
    while (state.xp >= xpToNext(state.level)) {
      state.xp -= xpToNext(state.level);
      state.level += 1;
      state.levelUpTimer = 1.0;
      const expectedBosses = Math.floor(state.level / 10);
      if (expectedBosses > state.bossesSpawned) {
        state.bossesSpawned = expectedBosses;
        spawnBoss(expectedBosses);
      }
    }
  }

  function fireCharge() {
    if (state.charge < state.config.chargeMax) return;
    for (const e of state.enemies) {
      state.lasers.push({
        x: e.x, y: e.y,
        life: 0.25, maxLife: 0.25,
      });
      state.deaths.push({
        x: e.x, y: e.y,
        life: 0.45, maxLife: 0.45,
        color: e.color,
        radius: e.radius,
      });
    }
    state.enemies = [];
    state.charge = 0;
    state.shakeTimer = 0.3;
  }

  function fireInput() {
    if (state.input === "") return;
    const answer = parseInt(state.input, 10);

    const matches = [];
    for (let i = 0; i < state.enemies.length; i++) {
      if (state.enemies[i].answer === answer) matches.push(i);
    }

    if (matches.length === 0) {
      state.input = "";
      state.shakeTimer = 0.35;
      return;
    }

    for (let k = matches.length - 1; k >= 0; k--) {
      const idx = matches[k];
      const e = state.enemies[idx];
      const spec = TYPES[e.type];

      state.lasers.push({
        x: e.x, y: e.y,
        life: 0.15, maxLife: 0.15,
      });

      e.hp -= 1;
      if (e.hp <= 0) {
        state.deaths.push({
          x: e.x, y: e.y,
          life: 0.35, maxLife: 0.35,
          color: e.color,
          radius: e.radius,
        });
        state.enemies.splice(idx, 1);
        gainXp(e.xpReward);
        if (state.charge < state.config.chargeMax) state.charge += 1;
      } else {
        let eq;
        if (e.type === "boss") {
          if (state.config.simpleBoss) {
            eq = eqAdd(state.config.maxNum, state.config.trainingTargets, 0.55 + e.tier * 0.05, 3);
          } else if (e.phase === 2) {
            eq = eqAdd3(state.config.maxNum, state.config.trainingTargets, 0.30 + e.tier * 0.04, 2);
          } else {
            eq = eqAddOrSub(state.config.maxNum, state.config.trainingTargets, 0.55 + e.tier * 0.06, 3);
          }
        } else {
          eq = spec.eq(state.config.maxNum, state.config.trainingTargets);
        }
        e.text = eq.text;
        e.answer = eq.answer;
      }
    }
    state.input = "";
  }

  // ---------- update

  function update(dt) {
    if (!state.started || state.gameOver || state.paused) return;

    const bossAlive = state.enemies.some((e) => e.type === "boss");

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      if (!bossAlive && state.enemies.length < maxEnemiesForLevel(state.level)) {
        spawnEnemy();
      }
      state.spawnTimer = spawnIntervalForLevel(state.level, state.config);
    }

    for (let i = state.lasers.length - 1; i >= 0; i--) {
      state.lasers[i].life -= dt;
      if (state.lasers[i].life <= 0) state.lasers.splice(i, 1);
    }
    for (let i = state.deaths.length - 1; i >= 0; i--) {
      state.deaths[i].life -= dt;
      if (state.deaths[i].life <= 0) state.deaths.splice(i, 1);
    }

    const cx = W / 2, cy = H / 2;

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const spec = TYPES[e.type];

      if (spec.lifetime) {
        e.timeLeft -= dt;
        if (e.timeLeft <= 0) {
          state.enemies.splice(i, 1);
          continue;
        }
      } else {
        // boss enrage at half HP — gets faster, equation gets harder
        if (e.type === "boss" && e.phase === 1 && e.hp <= e.maxHp / 2) {
          e.phase = 2;
          e.speed = e.speed * 1.4;
          state.flashTimer = 0.35;
          state.shakeTimer = 0.25;
        }

        const dx = cx - e.x, dy = cy - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        const v = e.speed * state.config.speedMult * levelSpeedFactor(state.level);
        e.x += (dx / dist) * v * dt;
        e.y += (dy / dist) * v * dt;

        if (dist < PLAYER_RADIUS + e.radius * 0.7) {
          state.enemies.splice(i, 1);
          state.lives -= 1;
          state.flashTimer = 0.4;
          state.shakeTimer = 0.4;

          // wipe nearby enemies (no XP) to give the player breathing room
          const r2 = LIFE_LOSS_WIPE_RADIUS * LIFE_LOSS_WIPE_RADIUS;
          for (let j = state.enemies.length - 1; j >= 0; j--) {
            const ne = state.enemies[j];
            const ddx = ne.x - cx, ddy = ne.y - cy;
            if (ddx * ddx + ddy * ddy <= r2) {
              state.deaths.push({
                x: ne.x, y: ne.y,
                life: 0.45, maxLife: 0.45,
                color: ne.color,
                radius: ne.radius,
              });
              state.enemies.splice(j, 1);
            }
          }

          if (state.lives <= 0) {
            state.gameOver = true;
            finalScoreEl.textContent = `Niveau atteint : ${state.level}`;
          }
          break;
        }
      }
    }

    if (state.flashTimer > 0) state.flashTimer -= dt;
    if (state.shakeTimer > 0) state.shakeTimer -= dt;
    if (state.levelUpTimer > 0) state.levelUpTimer -= dt;
    if (state.bossAlertTimer > 0) state.bossAlertTimer -= dt;
  }

  // ---------- render

  function drawGrid() {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (W / 2) % GRID_SIZE; x < W; x += GRID_SIZE) {
      ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H);
    }
    for (let y = (H / 2) % GRID_SIZE; y < H; y += GRID_SIZE) {
      ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function hexPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function octPath(cx, cy, r, rotate = 0) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i - Math.PI / 8 + rotate;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawEqLabel(cx, baselineY, text, color) {
    ctx.font = "bold 14px ui-monospace, Menlo, monospace";
    const padX = 8, bh = 22;
    const tw = ctx.measureText(text).width;
    const bw = tw + padX * 2;
    const bx = cx - bw / 2;
    const by = baselineY - bh;

    ctx.fillStyle = "#0a0a14";
    roundRect(bx, by, bw, bh, 5);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cx, by + bh / 2 + 1);
  }

  function drawEnemy(e) {
    const spec = TYPES[e.type];
    const color = e.color;

    // shield aura (blue, hp > 1)
    if (spec.hasShield && e.hp > 1) {
      const t = performance.now() / 400;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 1.55, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(96, 165, 250, ${0.35 + 0.25 * Math.sin(t)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // boss aura (rotating outer rings — extra red ring in phase 2)
    if (spec.shape === "boss") {
      const t = performance.now() / 1000;
      octPath(e.x, e.y, e.radius * 1.35, t);
      ctx.strokeStyle = color + "55";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (e.phase === 2) {
        const pulse = 0.5 + 0.4 * Math.sin(performance.now() / 180);
        octPath(e.x, e.y, e.radius * 1.6, -t * 1.4);
        ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // body
    if (spec.shape === "hex") {
      hexPath(e.x, e.y, e.radius);
    } else if (spec.shape === "boss") {
      octPath(e.x, e.y, e.radius);
    } else {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    }
    ctx.fillStyle = "#0a0a14";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = spec.shape === "boss" ? 3 : 2;
    ctx.stroke();

    // money lifetime ring + $ symbol
    if (spec.lifetime) {
      const frac = Math.max(0, e.timeLeft / spec.lifetime);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.strokeStyle = frac < 0.3 ? "#f87171" : "rgba(251, 191, 36, 0.7)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = "bold 14px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText("€", e.x, e.y + 1);
    }

    // hp hearts for hexagon
    if (spec.shape === "hex") {
      ctx.font = "bold 14px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const total = e.maxHp;
      for (let i = 0; i < total; i++) {
        ctx.fillStyle = i < e.hp ? "#ef4444" : "rgba(239, 68, 68, 0.25)";
        ctx.fillText(
          i < e.hp ? "♥" : "♡",
          e.x - (total - 1) * 7 + i * 14,
          e.y + e.radius * 0.35,
        );
      }
    }

    // boss: HP bar + tier label (with rage marker in phase 2)
    if (spec.shape === "boss") {
      ctx.fillStyle = e.phase === 2 ? "#fecaca" : "rgba(255, 255, 255, 0.85)";
      ctx.font = "bold 12px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`BOSS T${e.tier}${e.phase === 2 ? " !" : ""}`, e.x, e.y - 6);

      const barW = e.radius * 1.5;
      const barH = 6;
      const barX = e.x - barW / 2;
      const barY = e.y + e.radius * 0.45;
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = e.phase === 2 ? "#ef4444" : color;
      ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
    }

    // equation label
    drawEqLabel(e.x, e.y - e.radius - 8, e.text, color);
  }

  function render() {
    ctx.fillStyle = state.flashTimer > 0 ? "#3a0a14" : "#0a0a14";
    ctx.fillRect(0, 0, W, H);

    drawGrid();

    let shakeX = 0, shakeY = 0;
    if (state.shakeTimer > 0) {
      const m = state.shakeTimer * 30;
      shakeX = (Math.random() - 0.5) * m;
      shakeY = (Math.random() - 0.5) * m;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    const cx = W / 2, cy = H / 2;

    // player
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#7dd3fc";
    ctx.beginPath();
    ctx.arc(cx, cy, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#bae6fd";
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, PLAYER_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // lasers behind enemies
    for (const l of state.lasers) {
      const t = l.life / l.maxLife;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = "#67e8f9";
      ctx.shadowColor = "#67e8f9";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2 + 5 * t;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(l.x, l.y);
      ctx.stroke();
      ctx.restore();
    }

    for (const e of state.enemies) drawEnemy(e);

    // death pops on top
    for (const d of state.deaths) {
      const t = 1 - d.life / d.maxLife;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius * (1 + t * 1.6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius * (1 + t * 0.8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // HUD
    livesEl.textContent = "♥".repeat(state.lives) + "♡".repeat(MAX_LIVES - state.lives);
    levelTextEl.innerHTML = `Niv : <b>${state.level}</b>`;
    xpTextEl.innerHTML = `<span class="xpIcon">⬢</span> <b>${state.totalXp}</b>`;
    xpFillEl.style.width = `${(state.xp / xpToNext(state.level)) * 100}%`;
    startScreenEl.hidden = state.started;
    gameOverEl.hidden = !state.gameOver;
    levelUpEl.hidden = state.levelUpTimer <= 0;
    bossAlertEl.hidden = state.bossAlertTimer <= 0;
    pausedEl.hidden = !state.paused;

    if (state.config) {
      if (state.charge >= state.config.chargeMax) {
        chargeValEl.textContent = "PRÊT [Espace]";
        chargeEl.className = "ready";
      } else {
        chargeValEl.textContent = `${state.charge}/${state.config.chargeMax}`;
        chargeEl.className = "";
      }
      if (state.config.trainingTargets && state.config.trainingTargets.length) {
        trainingNumEl.textContent = state.config.trainingTargets.join(", ");
        trainingBadgeEl.hidden = false;
      } else {
        trainingBadgeEl.hidden = true;
      }
    } else {
      trainingBadgeEl.hidden = true;
    }

    if (state.input === "") {
      inputValueEl.textContent = "_";
      inputValueEl.className = "empty";
    } else {
      inputValueEl.textContent = state.input;
      inputValueEl.className = "";
    }
  }

  // ---------- main loop

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- input

  window.addEventListener("keydown", (ev) => {
    if (!state.started) {
      const opts = selectionOpts();
      if (ev.key === "1") startGame("tresfacile", opts);
      else if (ev.key === "2") startGame("easy", opts);
      else if (ev.key === "3") startGame("medium", opts);
      else if (ev.key === "4") startGame("hard", opts);
      return;
    }

    if (state.gameOver) {
      if (ev.key === "r" || ev.key === "R") {
        const opts = state.config && state.config.trainingTargets
          ? { trainingTargets: state.config.trainingTargets }
          : {};
        startGame(state.diffKey, opts);
      } else if (ev.key === "c" || ev.key === "C") {
        goToStart();
      }
      return;
    }

    if (ev.key === "Escape") {
      state.paused = !state.paused;
      ev.preventDefault();
      return;
    }

    if (state.paused) return;

    if (/^[0-9]$/.test(ev.key)) {
      if (state.input.length < MAX_INPUT_LEN) state.input += ev.key;
      ev.preventDefault();
    } else if (ev.key === "Enter") {
      fireInput();
      ev.preventDefault();
    } else if (ev.key === "Backspace") {
      state.input = state.input.slice(0, -1);
      ev.preventDefault();
    } else if (ev.key === " ") {
      fireCharge();
      ev.preventDefault();
    }
  });

  const trainingSelection = new Set();
  function selectionOpts() {
    return trainingSelection.size
      ? { trainingTargets: Array.from(trainingSelection).sort((a, b) => a - b) }
      : {};
  }

  trainBtnEls.forEach((btn) => {
    btn.addEventListener("click", () => {
      const num = parseInt(btn.dataset.num, 10);
      if (trainingSelection.has(num)) {
        trainingSelection.delete(num);
        btn.classList.remove("selected");
      } else {
        trainingSelection.add(num);
        btn.classList.add("selected");
      }
    });
  });

  diffBtnEls.forEach((btn) => {
    btn.addEventListener("click", () => startGame(btn.dataset.diff, selectionOpts()));
  });

  restartBtnEl.addEventListener("click", () => {
    const opts = state.config && state.config.trainingTargets
      ? { trainingTargets: state.config.trainingTargets }
      : {};
    startGame(state.diffKey, opts);
  });
  changeDiffBtnEl.addEventListener("click", goToStart);
})();
