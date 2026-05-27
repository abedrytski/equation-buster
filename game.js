(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const livesEl = document.getElementById("lives");
  const waveTextEl = document.getElementById("waveText");
  const xpFillEl = document.getElementById("xpFill");
  const tick1El = document.querySelector(".tick1");
  const tick2El = document.querySelector(".tick2");
  const waveAnnounceEl = document.getElementById("waveAnnounce");
  const breatherEl = document.getElementById("breather");
  const breatherCountEl = document.getElementById("breatherCount");
  const streakEl = document.getElementById("streak");
  const streakValueEl = document.getElementById("streakValue");
  const streakMultEl = document.getElementById("streakMult");
  const scoreHudEl = document.getElementById("scoreHud");
  const scoreValueEl = document.getElementById("scoreValue");
  const gameOverEl = document.getElementById("gameover");
  const finalScoreEl = document.getElementById("finalScore");
  const inputValueEl = document.getElementById("inputValue");
  const pausedEl = document.getElementById("paused");
  const startScreenEl = document.getElementById("startScreen");
  const restartBtnEl = document.getElementById("restartBtn");
  const changeDiffBtnEl = document.getElementById("changeDiffBtn");
  const diffBtnEls = document.querySelectorAll(".diffBtn");
  const startBtnEl = document.getElementById("startBtn");
  const bossDebugBtnEl = document.getElementById("bossDebugBtn");
  const bossAlertEl = document.getElementById("bossAlert");
  const inputBoxEl = document.getElementById("inputBox");
  const chipBarEl = document.getElementById("chipBar");
  const bgmEl = document.getElementById("bgm");
  const bossBgmEl = document.getElementById("bossBgm");
  const muteBtnEl = document.getElementById("muteBtn");

  const PLAYER_RADIUS = 14;
  const MAX_LIVES = 3;
  const MAX_INPUT_LEN = 4;
  const MAX_CHIPS = 6;
  const CHIP_WRONG_LOCK = 0.35;
  const WRONG_PUSH_PX = 22;
  const WRONG_FLASH_DURATION = 0.4;
  const GRID_SIZE = 56;
  const LIFE_LOSS_WIPE_RADIUS = 320;

  // ---------- lanes / waves / streak

  const LANE_X_FRACTIONS = [0.22, 0.50, 0.78];
  const NUM_LANES = LANE_X_FRACTIONS.length;
  function laneX(lane) { return W * LANE_X_FRACTIONS[lane]; }

  const BREATHER_DURATION = 4;    // seconds between waves
  const BOSS_EVERY_N_WAVES = 3;

  function isBossWave(wave) { return wave % BOSS_EVERY_N_WAVES === 0; }
  function waveXpBudget(wave) {
    if (isBossWave(wave)) return 0;
    // grows ~12 XP per wave; e.g., w1=16, w2=28, w4=52, w5=64
    return 4 + wave * 8;
  }
  // progress across the full cycle of (BOSS_EVERY_N_WAVES - 1) regular waves
  // + 1 boss wave. Resets to 0 at the start of each new cycle (after a boss).
  function cycleProgress() {
    const cyclePos = (state.wave - 1) % BOSS_EVERY_N_WAVES;  // 0..N-1
    const seg = 1 / BOSS_EVERY_N_WAVES;
    return Math.min(1, cyclePos * seg + waveProgress() * seg);
  }

  function waveProgress() {
    if (isBossWave(state.wave)) {
      const boss = state.enemies.find((e) => e.type === "boss");
      if (!boss) return 1.0;
      return 1.0 - boss.hp / boss.maxHp;
    }
    const budget = waveXpBudget(state.wave);
    if (budget <= 0) return 0;
    // count XP still pending: not yet spent + currently on screen.
    // bar fills as enemies are spawned & resolved (killed, expired, or escaped).
    let aliveXp = 0;
    for (const e of state.enemies) {
      const s = TYPES[e.type];
      if (s) aliveXp += s.xp;
    }
    const remaining = state.waveXpRemaining + aliveXp;
    return Math.max(0, Math.min(1.0, 1 - remaining / budget));
  }

  // streak: [minCount, multiplier, cssTier]
  const STREAK_TIERS = [
    { min: 3,  mult: 2, tier: "tier2" },
    { min: 10, mult: 3, tier: "tier3" },
    { min: 20, mult: 5, tier: "tier4" },
  ];
  function streakMult() {
    let m = 1;
    for (const t of STREAK_TIERS) if (state.streak >= t.min) m = t.mult;
    return m;
  }
  function streakTierClass() {
    let cls = "";
    for (const t of STREAK_TIERS) if (state.streak >= t.min) cls = t.tier;
    return cls;
  }

  // ---------- difficulties

  const DIFFICULTIES = {
    tresfacile: {
      maxNum: 12,
      enemyCapAdd: 1,
      enemyCapMax: 3,
      speedMult: 0.50,
      spawnBase: 1.8,
      spawnDecay: 0.94,
      spawnMin: 1.0,
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
      enemyCapAdd: 2,
      enemyCapMax: 4,
      speedMult: 0.50,
      spawnBase: 1.8,
      spawnPerLevel: 0.10,
      spawnMin: 1.0,
      chargeMax: 15,
    },
    medium: {
      maxNum: 50,
      enemyCapAdd: 3,
      enemyCapMax: 5,
      speedMult: 0.70,
      spawnBase: 1.4,
      spawnPerLevel: 0.10,
      spawnMin: 0.85,
      chargeMax: 30,
    },
    hard: {
      maxNum: 100,
      enemyCapAdd: 4,
      enemyCapMax: 6,
      speedMult: 0.72,
      spawnBase: 1.4,
      spawnDecay: 0.95,
      spawnMin: 0.85,
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
    ice: {
      color: "#7dd3fc", radius: 14, speed: 0, xp: 4, hp: 1, lifetime: 8,
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
      color: "#a78bfa", radius: 40, speed: 18, xp: 50, hp: 3, shape: "boss",
    },
    mini: {
      color: "#a78bfa", radius: 18, speed: 0, xp: 6, hp: 1, shape: "mini",
      eq: (cap, target) => eqAdd(cap, target, 0.35, 2),
    },
  };

  const BOSS_ORBIT_RADIUS = 90;
  const BOSS_ORBIT_SPEED = 0.9; // rad/sec
  const NUM_MINIS = 3;

  const BOSS_COLORS = ["#a78bfa", "#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee"];

  // weighted spawn table per wave (last entry used for higher waves)
  const SPAWN_TABLE = [
    { yellow: 1 },                                                    // W1
    { yellow: 3, ice: 1, pink: 2 },                                 // W3
    { yellow: 2, ice: 1, pink: 2, green: 2 },                       // W4
    { yellow: 2, ice: 1, pink: 2, green: 2, blue: 2 },              // W5
    { yellow: 2, ice: 1, pink: 2, green: 2, blue: 2, hexagon: 1 },  // W6+
  ];

  function spawnTableForWave(wave, cfg) {
    const table = (cfg && cfg.spawnTable) || SPAWN_TABLE;
    const i = Math.min(wave, table.length) - 1;
    return table[Math.max(0, i)];
  }

  function pickType(wave, cfg, maxXp, exclude) {
    const t = spawnTableForWave(wave, cfg);
    const usable = {};
    let total = 0;
    for (const k in t) {
      if (exclude && exclude.has(k)) continue;
      if (maxXp == null || TYPES[k].xp <= maxXp) {
        usable[k] = t[k];
        total += t[k];
      }
    }
    if (total === 0) {
      // budget too small for anything in the table — fall back to the cheapest entry
      let cheapest = null;
      for (const k in t) {
        if (exclude && exclude.has(k)) continue;
        if (cheapest === null || TYPES[k].xp < TYPES[cheapest].xp) cheapest = k;
      }
      return cheapest || "yellow";
    }
    let r = Math.random() * total;
    for (const k in usable) {
      r -= usable[k];
      if (r <= 0) return k;
    }
    return "yellow";
  }

  function iceAllowedNow() {
    // hard limits: one per wave, never two on screen at once
    if (state.iceSpawnedThisWave >= 1) return false;
    if (state.enemies.some((e) => e.type === "ice")) return false;
    // soft gate: only useful when enough movers are around to be slowed
    let movers = 0;
    for (const e of state.enemies) if (e.speed > 0) movers++;
    const need = Math.max(2, Math.ceil(maxEnemiesForWave(state.wave) * 0.6));
    return movers >= need;
  }

  function spawnIntervalForWave(wave, cfg) {
    return Math.max(cfg.spawnMin, cfg.spawnBase * Math.pow(cfg.spawnDecay, wave - 1));
  }

  function waveSpeedFactor(wave) {
    // grows ~5 % per wave, capped at 2.0x. Sub-exponential ramp.
    return Math.min(2.0, 1 + (wave - 1) * 0.05);
  }

  function xpToNext(level) {
    // sub-exponential growth: between linear and quadratic (level^1.3)
    return Math.ceil(3 + Math.pow(level, 1.3));
  }

  // ---------- canvas sizing

  let W = 0, H = 0, dpr = 1;
  let playerX = 0, playerY = 0;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    W = rect.width || window.innerWidth;
    H = rect.height || window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    playerX = W / 2;
    // place the player just above the chip bar at the bottom
    const offsetFromBottom = H < 520 ? 120 : 230;
    playerY = H - offsetFromBottom;
  }
  window.addEventListener("resize", resize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", resize);
  }
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
    chips: [],
    chipLockTimer: 0,
    wave: 1,
    wavePhase: "active",   // "active" | "breather"
    waveTimer: 0,
    waveXpRemaining: 0,
    waveXpEarned: 0,
    streak: 0,
    bestStreak: 0,
    freezeTimer: 0,
    iceSpawnedThisWave: 0,
    wrongFlashTimer: 0,
    score: 0,
    scorePopTimer: 0,
    musicCurrentTrack: "none",
    musicMuted: false,
  };

  const FREEZE_DURATION = 3;

  function startGame(diffKey, opts = {}) {
    const { startWave, ...configOpts } = opts;
    state.diffKey = diffKey;
    state.config = { ...DIFFICULTIES[diffKey], ...configOpts };
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
    state.chips = [];
    state.chipLockTimer = 0;
    state.wave = startWave || 1;
    state.wavePhase = "active";
    state.waveTimer = 0;
    state.waveXpRemaining = waveXpBudget(state.wave);
    state.waveXpEarned = 0;
    state.streak = 0;
    state.bestStreak = 0;
    state.freezeTimer = 0;
    state.iceSpawnedThisWave = 0;
    state.wrongFlashTimer = 0;
    state.score = 0;
    state.scorePopTimer = 0;
    announceWave();
    if (isBossWave(state.wave)) {
      state.bossesSpawned += 1;
      spawnBoss(state.bossesSpawned);
    }
    rebuildChips();
    primeAudio();
    updateMusic();
  }

  // ---------- music
  // Only one track plays at a time (iOS Safari ignores audio.volume, so a
  // crossfade approach plays both tracks at full system volume). We pause one
  // and play the other on transitions. Default is muted; user opts in via the
  // 🔊 button, and the choice persists in localStorage.

  const MUSIC_BG_VOL = 0.45;
  const MUSIC_BOSS_VOL = 0.55;
  let audioPrimed = false;

  function primeAudio() {
    // Must be called from inside a user-gesture handler. Briefly plays each
    // element muted, then pauses, so subsequent .play() calls (e.g. when the
    // boss appears mid-game, outside any gesture) are allowed on iOS.
    if (audioPrimed) return;
    audioPrimed = true;
    for (const el of [bgmEl, bossBgmEl]) {
      el.muted = true;
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
      el.pause();
      el.muted = false;
    }
  }

  function desiredTrack() {
    if (state.musicMuted) return "none";
    if (!state.started || state.gameOver || state.paused) return "none";
    return state.enemies.some((e) => e.type === "boss") ? "boss" : "bg";
  }

  function updateMusic() {
    const desired = desiredTrack();
    if (desired === state.musicCurrentTrack) return;
    if (state.musicCurrentTrack === "bg") bgmEl.pause();
    else if (state.musicCurrentTrack === "boss") bossBgmEl.pause();
    if (desired === "bg") {
      bgmEl.volume = MUSIC_BG_VOL;
      const p = bgmEl.play();
      if (p && p.catch) p.catch(() => {});
    } else if (desired === "boss") {
      bossBgmEl.volume = MUSIC_BOSS_VOL;
      const p = bossBgmEl.play();
      if (p && p.catch) p.catch(() => {});
    }
    state.musicCurrentTrack = desired;
  }

  function setMuted(muted) {
    state.musicMuted = muted;
    try { localStorage.setItem("ms_muted", muted ? "1" : "0"); } catch (_) { /* ignore */ }
    muteBtnEl.classList.toggle("muted", muted);
    muteBtnEl.textContent = muted ? "🔇" : "🔊";
  }

  // Default: muted. Only an explicit "0" in storage means "user opted in".
  try { state.musicMuted = localStorage.getItem("ms_muted") !== "0"; } catch (_) { /* ignore */ }
  setMuted(state.musicMuted);
  muteBtnEl.addEventListener("click", () => {
    primeAudio();
    setMuted(!state.musicMuted);
    updateMusic();
  });

  function announceWave() {
    state.levelUpTimer = 1.0;
  }

  function goToStart() {
    state.started = false;
    state.gameOver = false;
    state.paused = false;
    state.enemies = [];
    state.lasers = [];
    state.deaths = [];
    state.input = "";
    state.chips = [];
    rebuildChips();
  }

  function maxEnemiesForWave(wave) {
    const cfg = state.config;
    const add = cfg ? cfg.enemyCapAdd : 3;
    const cap = cfg ? cfg.enemyCapMax : 5;
    return Math.min(cap, wave + add);
  }

  const SPAWN_HEAD_CLEARANCE = 90;
  const LANE_SEPARATION_GAP = 8;

  function pickSpawnLane() {
    // rank lanes by busy-ness (count asc), tie-break by topmost-enemy y desc
    // (more clearance preferred), then small randomness. Return -1 if no lane
    // has spawn clearance — caller defers the spawn so enemies don't pile up.
    const counts = new Array(NUM_LANES).fill(0);
    const tops = new Array(NUM_LANES).fill(Infinity);
    for (const e of state.enemies) {
      if (e.lane == null || e.speed <= 0 || e.type === "mini") continue;
      counts[e.lane]++;
      if (e.y < tops[e.lane]) tops[e.lane] = e.y;
    }
    const order = [];
    for (let i = 0; i < NUM_LANES; i++) order.push(i);
    order.sort((a, b) => {
      if (counts[a] !== counts[b]) return counts[a] - counts[b];
      const ta = tops[a] === Infinity ? 1e9 : tops[a];
      const tb = tops[b] === Infinity ? 1e9 : tops[b];
      if (ta !== tb) return tb - ta;
      return Math.random() - 0.5;
    });
    for (const l of order) {
      if (tops[l] === Infinity || tops[l] >= SPAWN_HEAD_CLEARANCE) return l;
    }
    return -1;
  }

  function spawnEnemy(maxXp) {
    const exclude = iceAllowedNow() ? null : new Set(["ice"]);
    const type = pickType(state.wave, state.config, maxXp, exclude);
    const spec = TYPES[type];

    let lane, x, y;
    if (spec.speed === 0) {
      // stationary ice: pick a lane, place in the upper half
      lane = Math.floor(Math.random() * NUM_LANES);
      x = laneX(lane);
      const topZoneBottom = Math.max(140, playerY * 0.55);
      y = 80 + Math.random() * Math.max(40, topZoneBottom - 80);
    } else {
      // moving enemies drop in from above; defer if no lane has clearance
      lane = pickSpawnLane();
      if (lane < 0) return 0;
      x = laneX(lane);
      y = -(spec.radius + 40);
    }

    if (type === "ice") state.iceSpawnedThisWave++;

    const eq = spec.eq(state.config.maxNum, state.config.trainingTargets);
    const enemy = {
      type, x, y, lane,
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
    rebuildChips();
    return spec.xp;
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
      ? 2 + tier + randInt(0, 1)
      : 2 + tier * 2 + randInt(0, 1);
    const speed = 14 + tier * 3;
    const radius = 50 + tier * 10;
    const color = BOSS_COLORS[Math.floor(Math.random() * BOSS_COLORS.length)];
    const xpReward = 50 * tier;

    // boss drops in from above in the center lane
    const lane = 1;
    const m = radius + 60;
    const x = laneX(lane);
    const y = -m;

    const boss = {
      type: "boss",
      tier,
      x, y, lane,
      text: eq.text, answer: eq.answer,
      hp, maxHp: hp,
      radius, speed, color, xpReward,
      phase: 1,            // 1 = orbit (invulnerable), 2 = mirrored, 3 = enraged
      invulnerable: true,
    };
    state.enemies.push(boss);

    // spawn the 3 orbiting mini-bosses
    const miniSpec = TYPES.mini;
    for (let i = 0; i < NUM_MINIS; i++) {
      const miniEq = miniSpec.eq(cap, targets);
      state.enemies.push({
        type: "mini",
        parent: boss,
        orbitAngle: (Math.PI * 2 * i) / NUM_MINIS,
        orbitRadius: BOSS_ORBIT_RADIUS,
        orbitSpeed: BOSS_ORBIT_SPEED,
        x: boss.x + Math.cos((Math.PI * 2 * i) / NUM_MINIS) * BOSS_ORBIT_RADIUS,
        y: boss.y + Math.sin((Math.PI * 2 * i) / NUM_MINIS) * BOSS_ORBIT_RADIUS,
        text: miniEq.text, answer: miniEq.answer,
        hp: 1, maxHp: 1,
        radius: miniSpec.radius,
        speed: 0,
        color: color,
        xpReward: miniSpec.xp,
      });
    }

    state.bossAlertTimer = 1.5;
    rebuildChips();
  }

  function activateBoss(boss) {
    boss.invulnerable = false;
    boss.phase = 2;
    // regenerate a fresh equation now that the boss is active
    const cap = state.config.maxNum;
    const targets = state.config.trainingTargets;
    let eq;
    if (state.config.simpleBoss) {
      eq = eqAdd(cap, targets, 0.55 + boss.tier * 0.05, 3);
    } else {
      eq = eqAddOrSub(cap, targets, 0.55 + boss.tier * 0.06, 3);
    }
    boss.text = eq.text;
    boss.answer = eq.answer;
    state.flashTimer = 0.35;
    state.shakeTimer = 0.3;
    rebuildChips();
  }

  function gainXp(amount) {
    const scaled = amount * streakMult();
    state.xp += scaled;
    state.totalXp += scaled;
    while (state.xp >= xpToNext(state.level)) {
      state.xp -= xpToNext(state.level);
      state.level += 1;
    }
  }

  function gainScore(amount) {
    // each enemy contributes (xp × 10) base points, multiplied by streak.
    state.score += amount * 10 * streakMult();
    state.scorePopTimer = 0.18;
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
    rebuildChips();
  }

  function fireAnswer(answer) {
    const matches = [];
    for (let i = 0; i < state.enemies.length; i++) {
      const en = state.enemies[i];
      if (en.invulnerable) continue;
      if (en.answer === answer) matches.push(i);
    }

    if (matches.length === 0) {
      state.shakeTimer = 0.45;
      state.wrongFlashTimer = 0.4;
      state.streak = 0;
      // wrong answer punishment: nudge every moving threat closer to the player
      // and flash every enemy (including orbiting minis and stationary ice) so
      // the player gets feedback regardless of which enemies are on screen.
      for (const en of state.enemies) {
        en.pushFlash = WRONG_FLASH_DURATION;
        if (en.type === "mini") continue;     // orbit position is recomputed each frame
        if (en.speed === 0) continue;          // ice doesn't approach
        en.y += WRONG_PUSH_PX;
      }
      return false;
    }

    state.streak += 1;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;

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
        if (e.type !== "ice") gainScore(e.xpReward);
        state.waveXpEarned += e.xpReward;
        if (state.charge < state.config.chargeMax) state.charge += 1;
        if (e.type === "ice") state.freezeTimer = FREEZE_DURATION;

        // last mini-boss of a parent killed → activate the boss
        if (e.type === "mini" && e.parent) {
          const remaining = state.enemies.some(en => en.type === "mini" && en.parent === e.parent);
          if (!remaining && state.enemies.includes(e.parent)) {
            activateBoss(e.parent);
          }
        }
      } else {
        // regenerate equation; guarantee a different answer so the player
        // cannot kill multi-HP enemies by spamming the same chip
        const oldAnswer = e.answer;
        const genEq = () => {
          if (e.type === "boss") {
            if (state.config.simpleBoss) {
              return eqAdd(state.config.maxNum, state.config.trainingTargets, 0.55 + e.tier * 0.05, 3);
            } else if (e.phase === 3) {
              return eqAdd3(state.config.maxNum, state.config.trainingTargets, 0.30 + e.tier * 0.04, 2);
            }
            return eqAddOrSub(state.config.maxNum, state.config.trainingTargets, 0.55 + e.tier * 0.06, 3);
          }
          return spec.eq(state.config.maxNum, state.config.trainingTargets);
        };
        let eq = genEq();
        for (let tries = 0; tries < 20 && eq.answer === oldAnswer; tries++) eq = genEq();
        e.text = eq.text;
        e.answer = eq.answer;
      }
    }
    rebuildChips();
    return true;
  }

  function fireInput() {
    if (state.input === "") return;
    const answer = parseInt(state.input, 10);
    fireAnswer(answer);
    state.input = "";
  }

  // ---------- chip-based input (mobile)

  function rebuildChips() {
    if (!state.started || state.gameOver) {
      state.chips = [];
      renderChips();
      return;
    }
    // collect unique enemy answers, prioritizing nearest threats; skip invulnerable
    const sorted = state.enemies
      .filter((e) => !e.invulnerable)
      .sort((a, b) => Math.hypot(a.x - playerX, a.y - playerY) - Math.hypot(b.x - playerX, b.y - playerY));
    const wanted = [];
    const wantedSet = new Set();
    for (const e of sorted) {
      if (wantedSet.has(e.answer)) continue;
      wantedSet.add(e.answer);
      wanted.push(e.answer);
      if (wanted.length >= MAX_CHIPS) break;
    }

    const cap = Math.max(20, (state.config?.maxNum || 20) * 2);

    // start from current chips to preserve positions
    const chips = state.chips.slice();
    while (chips.length < MAX_CHIPS) chips.push(null);
    chips.length = MAX_CHIPS;

    // step 1: free slots whose value isn't wanted (and isn't an enemy answer)
    const stillNeeded = new Set(wanted);
    for (let i = 0; i < MAX_CHIPS; i++) {
      if (chips[i] != null && stillNeeded.has(chips[i])) {
        stillNeeded.delete(chips[i]);
      }
    }
    // step 2: place stillNeeded values into RANDOM available slots
    // (random slot picks prevent the same chip from being correct again on the
    //  next hit of a multi-HP enemy)
    const toFill = Array.from(stillNeeded);
    const avail = [];
    for (let i = 0; i < MAX_CHIPS; i++) {
      if (chips[i] == null || !wantedSet.has(chips[i])) avail.push(i);
    }
    for (let i = avail.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [avail[i], avail[j]] = [avail[j], avail[i]];
    }
    for (const ans of toFill) {
      if (avail.length === 0) break;
      chips[avail.shift()] = ans;
    }
    // step 3: fill any nulls with distractors (avoid duplicates)
    for (let i = 0; i < MAX_CHIPS; i++) {
      if (chips[i] != null) continue;
      let cand;
      let guard = 0;
      do {
        cand = randInt(1, cap);
        guard++;
      } while (chips.includes(cand) && guard < 200);
      chips[i] = cand;
    }

    state.chips = chips;
    renderChips();
  }

  function initChipDOM() {
    chipBarEl.innerHTML = "";
    for (let i = 0; i < MAX_CHIPS; i++) {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.dataset.index = String(i);
      btn.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        onChip(btn, i);
      });
      chipBarEl.appendChild(btn);
    }
  }

  function renderChips() {
    const visible = state.started && !state.gameOver && state.chips.length > 0;
    chipBarEl.hidden = !visible;
    if (!visible) return;
    const children = chipBarEl.children;
    for (let i = 0; i < MAX_CHIPS; i++) {
      const node = children[i];
      if (!node) continue;
      const value = state.chips[i];
      if (node.textContent !== String(value)) node.textContent = String(value);
    }
  }

  function onChip(btn, index) {
    if (!state.started || state.gameOver || state.paused) return;
    if (state.chipLockTimer > 0) return;
    const value = state.chips[index];
    if (value == null) return;
    const hit = fireAnswer(value);
    if (hit) {
      btn.classList.add("right");
      setTimeout(() => btn.classList.remove("right"), 180);
    } else {
      btn.classList.add("wrong");
      state.chipLockTimer = CHIP_WRONG_LOCK;
      setTimeout(() => btn.classList.remove("wrong"), 320);
    }
  }

  // ---------- update

  function advanceWave() {
    state.wave += 1;
    state.wavePhase = "active";
    state.waveTimer = 0;
    state.waveXpRemaining = waveXpBudget(state.wave);
    state.waveXpEarned = 0;
    state.iceSpawnedThisWave = 0;
    announceWave();
    if (isBossWave(state.wave)) {
      state.bossesSpawned += 1;
      spawnBoss(state.bossesSpawned);
    }
  }

  function update(dt) {
    if (!state.started || state.gameOver || state.paused) return;

    const frozen = state.freezeTimer > 0;
    if (frozen) state.freezeTimer = Math.max(0, state.freezeTimer - dt);

    const bossAlive = state.enemies.some((e) => e.type === "boss");
    const stillSpawning = state.waveXpRemaining > 0 && !isBossWave(state.wave);
    const waveCleared = !stillSpawning && state.enemies.length === 0;

    // wave phase machine (breather is allowed to tick during freeze so the freeze
    // doesn't stretch the inter-wave gap; new active-phase spawns are gated below)
    if (state.wavePhase === "active" && waveCleared) {
      state.wavePhase = "breather";
      state.waveTimer = BREATHER_DURATION;
    } else if (state.wavePhase === "breather") {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) advanceWave();
    }

    const canSpawn = state.wavePhase === "active" && stillSpawning && !bossAlive && !frozen;

    if (!frozen) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        if (canSpawn && state.enemies.length < maxEnemiesForWave(state.wave)) {
          const cost = spawnEnemy(state.waveXpRemaining);
          state.waveXpRemaining = Math.max(0, state.waveXpRemaining - cost);
        }
        state.spawnTimer = spawnIntervalForWave(state.wave, state.config);
      }
    }

    for (let i = state.lasers.length - 1; i >= 0; i--) {
      state.lasers[i].life -= dt;
      if (state.lasers[i].life <= 0) state.lasers.splice(i, 1);
    }
    for (let i = state.deaths.length - 1; i >= 0; i--) {
      state.deaths[i].life -= dt;
      if (state.deaths[i].life <= 0) state.deaths.splice(i, 1);
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      const spec = TYPES[e.type];

      if (e.pushFlash) {
        e.pushFlash = Math.max(0, e.pushFlash - dt);
      }

      if (spec.lifetime) {
        if (!frozen) e.timeLeft -= dt;
        if (e.timeLeft <= 0) {
          state.enemies.splice(i, 1);
          continue;
        }
      } else if (e.type === "mini") {
        // mini-boss: orbit around its parent boss. No collision damage.
        if (e.parent && state.enemies.includes(e.parent)) {
          if (!frozen) e.orbitAngle += e.orbitSpeed * dt;
          e.x = e.parent.x + Math.cos(e.orbitAngle) * e.orbitRadius;
          e.y = e.parent.y + Math.sin(e.orbitAngle) * e.orbitRadius;
        }
      } else if (!frozen) {
        // boss enrage after the first phase-2 hit — gets faster, equation gets
        // harder (mirrored phase 3). Threshold is 2/3 of max HP so phase 2 stays
        // short and the boss spends most of the fight in the dramatic phase 3.
        if (e.type === "boss" && e.phase === 2 && e.hp <= e.maxHp * 2 / 3) {
          e.phase = 3;
          e.speed = e.speed * 1.4;
          state.flashTimer = 0.35;
          state.shakeTimer = 0.25;
        }

        // straight-down lane movement
        const v = e.speed * state.config.speedMult * waveSpeedFactor(state.wave);
        e.y += v * dt;
        // gentle x easing back toward lane center (in case of any drift)
        const targetX = laneX(e.lane != null ? e.lane : 1);
        e.x += (targetX - e.x) * Math.min(1, dt * 4);

        // queue-up: prevent overlap with the closest enemy ahead in this lane.
        // A faster enemy will stop short of the slower leader's tail.
        let leader = null;
        for (const o of state.enemies) {
          if (o === e || o.lane !== e.lane) continue;
          if (o.speed <= 0 || o.type === "mini") continue;
          if (o.y <= e.y) continue;
          if (leader === null || o.y < leader.y) leader = o;
        }
        if (leader) {
          const minSep = leader.radius + e.radius + LANE_SEPARATION_GAP;
          if (leader.y - e.y < minSep) e.y = leader.y - minSep;
        }

        // collision: enemy crosses the danger line
        if (e.y + e.radius * 0.4 >= playerY) {
          state.enemies.splice(i, 1);
          // if a boss crosses the line, drag its remaining minis with it
          if (e.type === "boss") {
            for (let j = state.enemies.length - 1; j >= 0; j--) {
              if (state.enemies[j].type === "mini" && state.enemies[j].parent === e) {
                state.enemies.splice(j, 1);
              }
            }
          }
          // a boss crossing the danger line is an instant kill
          state.lives = e.type === "boss" ? 0 : state.lives - 1;
          state.streak = 0;
          state.flashTimer = e.type === "boss" ? 0.6 : 0.4;
          state.shakeTimer = e.type === "boss" ? 0.6 : 0.4;

          // wipe nearby enemies (no XP) to give the player breathing room
          const r2 = LIFE_LOSS_WIPE_RADIUS * LIFE_LOSS_WIPE_RADIUS;
          for (let j = state.enemies.length - 1; j >= 0; j--) {
            const ne = state.enemies[j];
            const ddx = ne.x - playerX, ddy = ne.y - playerY;
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
            finalScoreEl.textContent = `Score: ${state.score.toLocaleString("en-US")} · Wave: ${state.wave} · Best streak: ${state.bestStreak}`;
          }
          rebuildChips();
          break;
        }
      }
    }

    if (state.flashTimer > 0) state.flashTimer -= dt;
    if (state.shakeTimer > 0) state.shakeTimer -= dt;
    if (state.wrongFlashTimer > 0) state.wrongFlashTimer -= dt;
    if (state.scorePopTimer > 0) state.scorePopTimer -= dt;
    if (state.levelUpTimer > 0) state.levelUpTimer -= dt;
    if (state.bossAlertTimer > 0) state.bossAlertTimer -= dt;
    if (state.chipLockTimer > 0) state.chipLockTimer -= dt;
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

  function drawEqLabel(cx, baselineY, text, color, mirror = false) {
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
    if (mirror) {
      ctx.save();
      ctx.translate(cx, by + bh / 2 + 1);
      ctx.scale(-1, 1);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(text, cx, by + bh / 2 + 1);
    }
  }

  function drawEnemy(e) {
    const spec = TYPES[e.type];
    const color = e.color;

    // wrong-answer punishment flash: red shock ring that fades out
    if (e.pushFlash && e.pushFlash > 0) {
      const k = e.pushFlash / WRONG_FLASH_DURATION;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * (1.5 + (1 - k) * 0.6), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(239, 68, 68, ${0.75 * k})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // shield aura (blue, hp > 1)
    if (spec.hasShield && e.hp > 1) {
      const t = performance.now() / 400;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 1.55, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(96, 165, 250, ${0.35 + 0.25 * Math.sin(t)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // mini-boss tether to its parent boss
    if (e.type === "mini" && e.parent) {
      ctx.save();
      ctx.strokeStyle = e.color + "44";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(e.parent.x, e.parent.y);
      ctx.lineTo(e.x, e.y);
      ctx.stroke();
      ctx.restore();
    }

    // boss aura (rotating outer rings — extra red ring while enraged, shield while invulnerable)
    if (spec.shape === "boss") {
      const t = performance.now() / 1000;
      octPath(e.x, e.y, e.radius * 1.35, t);
      ctx.strokeStyle = color + "55";
      ctx.lineWidth = 2;
      ctx.stroke();
      if (e.invulnerable) {
        const pulse = 0.5 + 0.4 * Math.sin(performance.now() / 280);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 1.7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(148, 163, 184, ${pulse})`;
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (e.phase === 3) {
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

    // ice lifetime ring + snowflake symbol
    if (spec.lifetime) {
      const frac = Math.max(0, e.timeLeft / spec.lifetime);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      ctx.strokeStyle = frac < 0.3 ? "#f87171" : "rgba(125, 211, 252, 0.75)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = "bold 16px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#e0f2fe";
      ctx.shadowColor = "#7dd3fc";
      ctx.shadowBlur = 8;
      ctx.fillText("❄", e.x, e.y + 1);
      ctx.shadowBlur = 0;
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

    // boss: HP bar + tier label (with rage marker in phase 3)
    if (spec.shape === "boss") {
      ctx.fillStyle = e.phase === 3 ? "#fecaca" : "rgba(255, 255, 255, 0.85)";
      ctx.font = "bold 12px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const label = e.invulnerable
        ? `✦ THE MIRROR ✦`
        : `✦ ЯOЯЯIM ƎHT ✦`;
      ctx.fillText(label, e.x, e.y - 6);

      const barW = e.radius * 1.5;
      const barH = 6;
      const barX = e.x - barW / 2;
      const barY = e.y + e.radius * 0.45;
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = e.phase === 3 ? "#ef4444" : color;
      ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
    }

    // equation label: hidden for invulnerable boss; mirrored when boss is active
    if (e.type === "boss") {
      if (!e.invulnerable) {
        drawEqLabel(e.x, e.y - e.radius - 8, e.text, color, true);
      }
    } else {
      drawEqLabel(e.x, e.y - e.radius - 8, e.text, color);
    }
  }

  function drawLanesAndDangerLine() {
    if (!state.started) return;
    // lane guides — very subtle vertical strips
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#67e8f9";
    const laneW = Math.min(160, W / 4);
    for (let i = 0; i < NUM_LANES; i++) {
      const cx = laneX(i);
      ctx.fillRect(cx - laneW / 2, 0, laneW, playerY);
    }
    ctx.restore();

    // danger line at the player's y
    const lineY = playerY;
    ctx.save();
    const pulse = 0.45 + 0.25 * Math.sin(performance.now() / 380);
    ctx.strokeStyle = `rgba(239, 68, 68, ${pulse * 0.55})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(W, lineY);
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.fillStyle = state.flashTimer > 0 ? "#3a0a14" : "#0a0a14";
    ctx.fillRect(0, 0, W, H);

    drawGrid();
    drawLanesAndDangerLine();

    let shakeX = 0, shakeY = 0;
    if (state.shakeTimer > 0) {
      const m = state.shakeTimer * 30;
      shakeX = (Math.random() - 0.5) * m;
      shakeY = (Math.random() - 0.5) * m;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // player
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#7dd3fc";
    ctx.beginPath();
    ctx.arc(playerX, playerY, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#bae6fd";
    ctx.beginPath();
    ctx.arc(playerX - 3, playerY - 3, PLAYER_RADIUS * 0.4, 0, Math.PI * 2);
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
      ctx.moveTo(playerX, playerY);
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

    // wrong-answer red vignette: pulses across the whole screen so feedback is
    // visible even when no enemies are on screen
    if (state.wrongFlashTimer > 0) {
      const k = Math.min(1, state.wrongFlashTimer / WRONG_FLASH_DURATION);
      ctx.save();
      ctx.fillStyle = `rgba(239, 68, 68, ${0.28 * k})`;
      ctx.fillRect(0, 0, W, H);
      // brighter border ring for emphasis
      const bw = 14;
      ctx.fillStyle = `rgba(239, 68, 68, ${0.55 * k})`;
      ctx.fillRect(0, 0, W, bw);
      ctx.fillRect(0, H - bw, W, bw);
      ctx.fillRect(0, 0, bw, H);
      ctx.fillRect(W - bw, 0, bw, H);
      ctx.restore();
    }

    // freeze overlay
    if (state.freezeTimer > 0) {
      const fade = Math.min(1, state.freezeTimer / 0.4);
      ctx.save();
      ctx.fillStyle = `rgba(125, 211, 252, ${0.16 * fade})`;
      ctx.fillRect(0, 0, W, H);
      // frosty edges
      const edge = 60;
      const grad = ctx.createLinearGradient(0, 0, 0, edge);
      grad.addColorStop(0, `rgba(186, 230, 253, ${0.55 * fade})`);
      grad.addColorStop(1, "rgba(186, 230, 253, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, edge);
      const grad2 = ctx.createLinearGradient(0, H - edge, 0, H);
      grad2.addColorStop(0, "rgba(186, 230, 253, 0)");
      grad2.addColorStop(1, `rgba(186, 230, 253, ${0.55 * fade})`);
      ctx.fillStyle = grad2;
      ctx.fillRect(0, H - edge, W, edge);

      // countdown text
      ctx.font = "bold 22px ui-monospace, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(224, 242, 254, ${0.9 * fade})`;
      ctx.shadowColor = "#7dd3fc";
      ctx.shadowBlur = 14;
      ctx.fillText(`❄ ${state.freezeTimer.toFixed(1)}s`, W / 2, 120);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // HUD
    livesEl.textContent = "♥".repeat(state.lives) + "♡".repeat(MAX_LIVES - state.lives);
    waveTextEl.innerHTML = `Wave <b>${state.wave}</b>`;
    const cp = cycleProgress();
    xpFillEl.style.clipPath = `inset(0 ${((1 - cp) * 100).toFixed(2)}% 0 0)`;
    tick1El.classList.toggle("passed", cp >= 1 / 3);
    tick2El.classList.toggle("passed", cp >= 2 / 3);
    startScreenEl.hidden = state.started;
    gameOverEl.hidden = !state.gameOver;
    bossAlertEl.hidden = state.bossAlertTimer <= 0;
    pausedEl.hidden = !state.paused;

    // wave announce flashes the new wave number when levelUpTimer is active
    if (state.levelUpTimer > 0) {
      waveAnnounceEl.textContent = `WAVE ${state.wave}`;
      waveAnnounceEl.hidden = false;
    } else {
      waveAnnounceEl.hidden = true;
    }

    // breather overlay
    if (state.started && !state.gameOver && state.wavePhase === "breather") {
      breatherEl.hidden = false;
      breatherCountEl.textContent = String(Math.max(1, Math.ceil(state.waveTimer)));
    } else {
      breatherEl.hidden = true;
    }

    // streak chip
    if (state.streak >= 2) {
      streakEl.hidden = false;
      streakValueEl.textContent = String(state.streak);
      const mult = streakMult();
      streakMultEl.textContent = mult > 1 ? `×${mult}` : "";
      streakEl.className = "";
      const tier = streakTierClass();
      if (tier) streakEl.classList.add(tier);
    } else {
      streakEl.hidden = true;
    }

    // score readout (tier color + pop on increment; multiplier badge lives on the streak chip)
    scoreValueEl.textContent = state.score.toLocaleString("en-US");
    scoreHudEl.className = "";
    const sTier = streakTierClass();
    if (sTier) scoreHudEl.classList.add(sTier);
    if (state.scorePopTimer > 0) scoreHudEl.classList.add("pop");

    if (state.input === "") {
      inputBoxEl.hidden = true;
    } else {
      inputBoxEl.hidden = false;
      inputValueEl.textContent = state.input;
      inputValueEl.className = "";
    }
  }

  // ---------- main loop

  initChipDOM();

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    update(dt);
    render();
    updateMusic();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- input

  window.addEventListener("keydown", (ev) => {
    if (!state.started) {
      if (ev.key === "Enter" || ev.key === " ") {
        startGame(selectedDiff);
        ev.preventDefault();
      }
      return;
    }

    if (state.gameOver) {
      if (ev.key === "r" || ev.key === "R") {
        startGame(state.diffKey);
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

  // selected difficulty on the start screen — clicking a diff button just
  // selects it; the START button launches the game with whatever is selected
  let selectedDiff = "medium";
  diffBtnEls.forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedDiff = btn.dataset.diff;
      diffBtnEls.forEach((b) => b.classList.toggle("selected", b === btn));
    });
  });

  startBtnEl.addEventListener("click", () => startGame(selectedDiff));

  // DEBUG — jump straight to the T1 boss fight. Remove this and the
  // #bossDebugBtn markup/CSS when the boss tuning pass is done.
  bossDebugBtnEl.addEventListener("click", () => {
    startGame(selectedDiff, { startWave: BOSS_EVERY_N_WAVES });
  });

  restartBtnEl.addEventListener("click", () => startGame(state.diffKey));
  changeDiffBtnEl.addEventListener("click", goToStart);
})();
