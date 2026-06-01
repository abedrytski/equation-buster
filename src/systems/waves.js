// Wave/streak/pacing math + the wave-bar progress model. All derived from `state`
// and the config tables — no rendering, no spawning.

import { state } from "../core/state.js";
import { TYPES, BOSS_EVERY_N_WAVES, STREAK_TIERS, MAX_ENEMIES } from "../core/config.js";

export function isBossWave(wave) {
  return wave % BOSS_EVERY_N_WAVES === 0;
}

export function waveValueBudget(wave) {
  if (isBossWave(wave)) return 0;
  // grows ~12 value per wave; e.g., w1=16, w2=28, w4=52, w5=64
  return 4 + wave * 8;
}

// progress across the full cycle of (BOSS_EVERY_N_WAVES - 1) regular waves
// + 1 boss wave. Resets to 0 at the start of each new cycle (after a boss).
export function cycleProgress() {
  const cyclePos = (state.wave - 1) % BOSS_EVERY_N_WAVES;  // 0..N-1
  const seg = 1 / BOSS_EVERY_N_WAVES;
  return Math.min(1, cyclePos * seg + waveProgress() * seg);
}

export function waveProgress() {
  if (isBossWave(state.wave)) {
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

export function streakMult() {
  let m = 1;
  for (const t of STREAK_TIERS) if (state.streak >= t.min) m = t.mult;
  return m;
}

// each enemy contributes (value × 10) base points, multiplied by streak.
export function gainScore(amount) {
  state.score += amount * 10 * streakMult();
  state.scorePopTimer = 0.18;
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
