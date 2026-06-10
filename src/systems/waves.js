// Wave/streak/pacing math + the wave-bar progress model. All derived from `state`
// and the config tables — no rendering, no spawning.

import { state } from "../core/state.js";
import { STREAK_TIERS, MAX_ENEMIES } from "../core/config.js";
import { TYPES } from "./enemies/index.js";

// A boss level is a single boss-only "wave". Driven by the run's bossLevel flag
// (set in startGame) rather than a wave-number cadence.
export function isBossWave() {
  return state.bossLevel === true;
}

export function waveValueBudget(wave) {
  if (isBossWave()) return 0;
  // grows ~12 value per wave; e.g., w1=16, w2=28, w4=52, w5=64
  return 4 + wave * 8;
}

// progress across the whole level. Boss levels track boss HP depletion;
// regular levels divide the bar into `totalWaves` equal segments.
export function cycleProgress() {
  if (isBossWave()) return waveProgress();
  const total = Math.max(1, state.totalWaves);
  const seg = 1 / total;
  return Math.min(1, (state.wave - 1) * seg + waveProgress() * seg);
}

export function waveProgress() {
  if (isBossWave()) {
    const boss = state.enemies.find((e) => e.type === "boss");
    if (!boss) return 1.0;
    return 1.0 - boss.hp / boss.maxHp;
  }
  const budget = waveValueBudget(state.wave);
  if (budget <= 0) return 0;
  // count value still pending: not yet spent + currently on screen.
  // bar fills as enemies are spawned & resolved (killed, expired, or escaped).
  let aliveValue = 0;
  for (const e of state.enemies) {
    const s = TYPES[e.type];
    if (s) aliveValue += s.value;
  }
  const remaining = state.waveValueRemaining + aliveValue;
  return Math.max(0, Math.min(1.0, 1 - remaining / budget));
}

// streak multiplier for an arbitrary streak count
export function multForStreak(streak) {
  let m = 1;
  for (const t of STREAK_TIERS) if (streak >= t.min) m = t.mult;
  return m;
}

export function streakMult() {
  return multForStreak(state.streak);
}

// each enemy contributes (value × 10) base points, multiplied by streak.
export function gainScore(amount) {
  state.score += amount * 10 * streakMult();
  state.scorePopTimer = 0.18;
}

// Accrue a scoring enemy's contribution to the level's theoretical max score,
// as if a flawless never-miss run killed it: the streak rises by one per kill,
// so each successive enemy is worth more. Called at spawn time for every enemy
// that awards score. `state.score / state.scoreMax` then yields the star ratio.
export function accrueMaxScore(value) {
  if (!value || value <= 0) return;
  state.perfectKills += 1;
  state.scoreMax += value * 10 * multForStreak(state.perfectKills);
}

// Stars for a completed level: 3 at ≥95% of max, 2 at ≥50%, else 1.
export function computeStars() {
  if (state.scoreMax <= 0) return 1;
  const ratio = state.score / state.scoreMax;
  if (ratio >= 0.95) return 3;
  if (ratio >= 0.50) return 2;
  return 1;
}

export function streakTierClass() {
  let cls = "";
  for (const t of STREAK_TIERS) if (state.streak >= t.min) cls = t.tier;
  return cls;
}

export function maxEnemiesForWave(wave) {
  const cfg = state.config;
  const add = cfg ? cfg.enemyCapAdd : 3;
  const cap = cfg ? cfg.enemyCapMax : 5;
  return Math.min(MAX_ENEMIES, cap, wave + add);
}

export function spawnIntervalForWave(wave, cfg) {
  return Math.max(cfg.spawnMin, cfg.spawnBase * Math.pow(cfg.spawnDecay, wave - 1));
}

export function waveSpeedFactor(wave) {
  // grows ~5 % per wave, capped at 2.0x. Sub-exponential ramp.
  return Math.min(2.0, 1 + (wave - 1) * 0.05);
}

export function announceWave() {
  state.levelUpTimer = 1.0;
}
