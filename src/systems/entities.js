// Spawning regular + bonus enemies, plus the shared death-pop / screen-wipe
// effect helpers. (Boss spawning lives in ./bosses/.)

import { state } from "../core/state.js";
import { laneX, playerY } from "../core/view.js";
import { maxEnemiesForWave } from "./waves.js";
import { rebuildChips } from "./chips.js";
import {
  TYPES, SPAWN_TABLE, NUM_LANES, MAX_LIVES,
  TOP_SPAWN_Y, SPAWN_HEAD_CLEARANCE,
} from "../core/config.js";

// ---------- shared units digit

// The units digit shared by most answerable enemies on screen (null if none).
// New/regenerated equations try to match it so every chip ends the same way,
// which kills the "compute only the last digit" shortcut.
export function dominantDigit(exclude) {
  const counts = new Map();
  let best = null, bestN = 0;
  for (const e of state.enemies) {
    if (e === exclude || e.invulnerable || e.answer == null) continue;
    const d = e.answer % 10;
    const n = (counts.get(d) || 0) + 1;
    counts.set(d, n);
    if (n > bestN) { bestN = n; best = d; }
  }
  return best;
}

// Answers currently shown by other enemies (used to avoid spawning duplicates).
function existingAnswers(exclude) {
  const s = new Set();
  for (const e of state.enemies) {
    if (e === exclude || e.answer == null) continue;
    s.add(e.answer);
  }
  return s;
}

// Generate from `genFn`, biased to share the current dominant units digit so
// new spawns blend into the row. The first enemy of a batch is unconstrained
// (no siblings) and naturally sets the digit the rest converge on.
//
// Distinctness wins over the digit bias: when the number range is too narrow to
// have two distinct answers sharing a digit (e.g. small maxNum, single-digit
// sums), forcing the digit would collapse every enemy to the same value. So we
// only keep the digit match when it doesn't duplicate an answer already on
// screen, and fall back to any distinct answer otherwise.
export function sharedEq(genFn, exclude, tries = 40) {
  const digit = dominantDigit(exclude);
  const used = existingAnswers(exclude);
  let distinct = null; // first distinct-but-wrong-digit candidate, as fallback
  for (let i = 0; i < tries; i++) {
    const eq = genFn();
    if (used.has(eq.answer)) continue;
    if (digit == null || eq.answer % 10 === digit) return eq; // ideal
    if (distinct == null) distinct = eq;
  }
  return distinct || genFn();
}

// ---------- spawn-table sampling

export function spawnTableForWave(wave) {
  const i = Math.min(wave, SPAWN_TABLE.length) - 1;
  return SPAWN_TABLE[Math.max(0, i)];
}

export function pickType(wave, maxValue, exclude) {
  const t = spawnTableForWave(wave);
  const usable = {};
  let total = 0;
  for (const k in t) {
    if (exclude && exclude.has(k)) continue;
    if (maxValue == null || TYPES[k].value <= maxValue) {
      usable[k] = t[k];
      total += t[k];
    }
  }
  if (total === 0) {
    // budget too small for anything in the table — fall back to the cheapest entry
    let cheapest = null;
    for (const k in t) {
      if (exclude && exclude.has(k)) continue;
      if (cheapest === null || TYPES[k].value < TYPES[cheapest].value) cheapest = k;
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

// Generic gate for any `bonus` type, driven entirely by the type's config:
//   maxPerWave / maxOnScreen  - hard caps (default 1 each)
//   requiresMovers: f         - only spawn when ≥ ceil(waveCap*f) movers exist
//                               (a slow/freeze bonus is pointless with nothing
//                               to slow)
//   requiresMissingLife: true - only spawn when the player has lost a life
export function bonusAllowedNow(type, spec) {
  if ((state.bonusSpawnedThisWave[type] || 0) >= (spec.maxPerWave ?? 1)) return false;
  let onScreen = 0;
  for (const e of state.enemies) if (e.type === type) onScreen++;
  if (onScreen >= (spec.maxOnScreen ?? 1)) return false;
  if (spec.requiresMovers != null) {
    let movers = 0;
    for (const e of state.enemies) if (e.speed > 0) movers++;
    const need = Math.max(2, Math.ceil(maxEnemiesForWave(state.wave) * spec.requiresMovers));
    if (movers < need) return false;
  }
  if (spec.requiresMissingLife && state.lives >= MAX_LIVES) return false;
  return true;
}

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

export function spawnEnemy(maxValue) {
  // exclude any bonus type whose spawn gate isn't currently satisfied
  let exclude = null;
  for (const k in TYPES) {
    if (TYPES[k].bonus && !bonusAllowedNow(k, TYPES[k])) {
      (exclude ||= new Set()).add(k);
    }
  }
  const type = pickType(state.wave, maxValue, exclude);
  const spec = TYPES[type];

  let lane, x, y;
  if (spec.placement === "upper") {
    // stationary bonus: pick a lane, place in the upper half (below the wave
    // bar with label clearance)
    lane = Math.floor(Math.random() * NUM_LANES);
    x = laneX(lane);
    const top = TOP_SPAWN_Y + spec.radius;
    const topZoneBottom = Math.max(top + 40, playerY * 0.55);
    y = top + Math.random() * (topZoneBottom - top);
  } else {
    // moving enemies appear right below the wave bar, fully visible with
    // their equation label. Defer if no lane has clearance.
    lane = pickSpawnLane();
    if (lane < 0) return 0;
    x = laneX(lane);
    y = TOP_SPAWN_Y + spec.radius;
  }

  if (spec.bonus) state.bonusSpawnedThisWave[type] = (state.bonusSpawnedThisWave[type] || 0) + 1;

  const eq = sharedEq(() => spec.eq(state.config.maxNum));
  const enemy = {
    type, x, y, lane,
    text: eq.text, answer: eq.answer,
    hp: spec.hp,
    maxHp: spec.hp,
    radius: spec.radius,
    speed: spec.speed,
    color: spec.color,
    value: spec.value,
    spawnFade: 0,
  };
  if (spec.lifetime) enemy.timeLeft = spec.lifetime;
  state.enemies.push(enemy);
  rebuildChips();
  return spec.value;
}

// ---------- shared effect helpers

// queue a fading death-pop at an entity's position (used on kills, wipes, etc.)
export function spawnDeath(e, life = 0.45) {
  state.deaths.push({
    x: e.x, y: e.y,
    life, maxLife: life,
    color: e.color,
    radius: e.radius,
  });
}

// clear the playfield into death-pops — the dramatic boss-entrance wipe
export function wipeEnemiesToDeaths() {
  for (const e of state.enemies) spawnDeath(e);
  state.enemies = [];
}
