// Spawning regular + bonus enemies, plus the shared death-pop / screen-wipe
// effect helpers. (Boss spawning lives in ./bosses/.)

import { state } from "../core/state.js";
import { laneX, playerY } from "../core/view.js";
import { maxEnemiesForWave, accrueMaxScore } from "./waves.js";
import { rebuildChips } from "./chips.js";
import {
  NUM_LANES, TOP_SPAWN_Y, SPAWN_HEAD_CLEARANCE,
} from "../core/config.js";
import { TYPES } from "./enemies/index.js";

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

// Spawn a specific enemy type from the pre-built wave queue.
// Returns true when the queue entry should be consumed (success or gated-skip),
// false when the spawn lane is full and the entry should be retried next tick.
export function spawnEnemyOfType(type) {
  const spec = TYPES[type];
  if (!spec) return true;

  if (spec.bonus) {
    if (spec.requiresMissingHP && state.hp >= state.maxHp) return true;
    if (spec.requiresMovers != null) {
      let movers = 0;
      for (const e of state.enemies) if (e.speed > 0) movers++;
      const need = Math.max(2, Math.ceil(maxEnemiesForWave(state.wave) * spec.requiresMovers));
      if (movers < need) return true;
    }
    let onScreen = 0;
    for (const e of state.enemies) if (e.type === type) onScreen++;
    if (onScreen >= (spec.maxOnScreen ?? 1)) return true;
  }

  return _doSpawn(spec, type);
}

// Shared spawn body. Returns true on success, false if no lane available.
function _doSpawn(spec, type) {
  let lane, x, y;
  if (spec.placement === "upper") {
    lane = Math.floor(Math.random() * NUM_LANES);
    x = laneX(lane);
    const top = TOP_SPAWN_Y + spec.radius;
    const topZoneBottom = Math.max(top + 40, playerY * 0.55);
    y = top + Math.random() * (topZoneBottom - top);
  } else {
    lane = pickSpawnLane();
    if (lane < 0) return false;
    x = laneX(lane);
    y = TOP_SPAWN_Y + spec.radius;
  }

  if (spec.bonus) state.bonusSpawnedThisWave[type] = (state.bonusSpawnedThisWave[type] || 0) + 1;

  const eq = sharedEq(() => spec.eq(state.config.maxNum, state.config.additional_terms));
  const hp = Math.ceil(spec.hp * state.config.hp_mult);
  const enemy = {
    type, x, y, lane,
    text: eq.text, answer: eq.answer,
    hp, maxHp: hp,
    radius: spec.radius, speed: spec.speed,
    color: spec.color, value: spec.value,
    spawnFade: 0,
  };
  if (spec.hasShield) { enemy.shielded = true; enemy.shieldRegenTimer = 0; }
  if (spec.lifetime) enemy.timeLeft = spec.lifetime;
  state.enemies.push(enemy);
  if (spec.awardsScore !== false) accrueMaxScore(spec.value);
  rebuildChips();
  return true;
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
