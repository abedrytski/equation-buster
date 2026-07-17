// The Absorber — a vulnerable boss ringed by healers that spiral inward and
// shrink; each one that reaches the core merges in and heals the boss. Solving a
// healer's equation doesn't pop it — it *corrupts* it (red, flaming): it keeps
// spiraling in, but on merge it damages the boss for the same amount it would
// have healed. Turn the boss's own heals against it. Reuses the orbit system.

import { state } from "../../core/state.js";
import { ABSORBER_ORBIT_RADIUS, BOSS_ORBIT_SPEED } from "../../core/config.js";
import { TYPES } from "../enemies/index.js";
import { randInt, operandCap } from "../../core/equations.js";
import { sharedEq, spawnDeath } from "../entities.js";
import { rebuildChips } from "../chips.js";
import { accrueMaxScore, gainScore } from "../waves.js";
import { createBoss } from "./shared.js";

const NUM_HEALERS = 2;
const START_R = ABSORBER_ORBIT_RADIUS; // outer orbit
const SPIRAL_TIME = 20;               // s for an ignored healer to fully merge
const MERGE_R = START_R * 0.15;      // radius at which it "reaches the core"
const HEAL_FRAC = 0.10;              // boss regains 10% max HP per merge
const RESPAWN_DELAY = 1.5;           // s before a merged healer returns

function bossEq() {
  const cap = state.config.maxNum;
  const hi = operandCap(cap, 1.0, 5), lo = operandCap(cap, 0.4, 4);
  const a = randInt(lo, hi), b = randInt(lo, hi);
  return { text: `${a}+${b}`, answer: a + b };
}

function spawnHealer(boss, angle) {
  const spec = TYPES.mini;
  const eq = sharedEq(() => spec.eq(state.config.maxNum));
  const hp = Math.max(1, Math.ceil(spec.hp * state.config.hp_mult));
  state.enemies.push({
    type: "mini", parent: boss, healer: true,
    orbitAngle: angle, orbitRadius: START_R, orbitSpeed: BOSS_ORBIT_SPEED,
    x: boss.x + Math.cos(angle) * START_R,
    y: boss.y + Math.sin(angle) * START_R,
    text: eq.text, answer: eq.answer,
    hp, maxHp: hp,
    radius: spec.radius, baseRadius: spec.radius,
    speed: 0, color: boss.color, value: spec.value, spawnFade: 0,
  });
  accrueMaxScore(spec.value);
  rebuildChips();
}

// Replace a solved healer with a corrupted mote at the same point in its spiral.
// No equation (already solved) → unanswerable; on merge it damages the boss.
function spawnCorrupted(boss, from) {
  state.enemies.push({
    type: "mini", parent: boss, healer: true, corrupted: true,
    orbitAngle: from.orbitAngle, orbitRadius: from.orbitRadius, orbitSpeed: BOSS_ORBIT_SPEED,
    x: from.x, y: from.y,
    text: "", answer: null,
    hp: 1, maxHp: 1,
    radius: from.radius, baseRadius: TYPES.mini.radius,
    speed: 0, color: "#ef4444", value: 0, spawnFade: 0,
  });
}

function killBoss(boss) {
  const idx = state.enemies.indexOf(boss);
  if (idx >= 0) { spawnDeath(boss, 0.7); state.enemies.splice(idx, 1); gainScore(boss.value); }
  for (let j = state.enemies.length - 1; j >= 0; j--) {
    const oth = state.enemies[j];
    if (oth.type === "mini" && oth.parent === boss) { spawnDeath(oth); state.enemies.splice(j, 1); }
  }
}

export default {
  id: "absorber",

  spawn(tier) {
    const boss = createBoss(tier, {
      kind: "absorber",
      hp: Math.ceil(50 * state.config.hp_mult),
      value: 55 * tier,
      extra: { invulnerable: false, healerCooldown: 0 }, // vulnerable from the start
    });
    const eq = bossEq();
    boss.text = eq.text; boss.answer = eq.answer;
    for (let i = 0; i < NUM_HEALERS; i++) spawnHealer(boss, (Math.PI * 2 * i) / NUM_HEALERS);
    state.bossAlertTimer = 1.5;
    rebuildChips();
    return boss;
  },

  update(boss, dt, { frozen }) {
    if (frozen) return;
    boss.healerCooldown = Math.max(0, boss.healerCooldown - dt);

    let merged = false;
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const h = state.enemies[i];
      if (h.type !== "mini" || h.parent !== boss) continue;
      h.orbitRadius -= (START_R / SPIRAL_TIME) * dt;                  // spiral inward
      h.radius = h.baseRadius * Math.max(0.3, h.orbitRadius / START_R); // shrink
      if (h.orbitRadius <= MERGE_R) {                                 // reached core → merge
        const amt = Math.ceil(boss.maxHp * HEAL_FRAC);
        if (h.corrupted) {
          boss.hp -= amt;                                             // absorbed corruption bites back
          state.damageNums.push({ x: boss.x, y: boss.y - boss.radius - 10, value: amt, life: 0.7, maxLife: 0.7 });
        } else {
          boss.hp = Math.min(boss.maxHp, boss.hp + amt);
        }
        spawnDeath(h, 0.25);
        state.enemies.splice(i, 1);
        boss.healerCooldown = RESPAWN_DELAY;
        merged = true;
        if (boss.hp <= 0) { killBoss(boss); return; }
      }
    }

    let count = 0;
    for (const e of state.enemies) if (e.type === "mini" && e.parent === boss) count++;
    if (count < NUM_HEALERS && boss.healerCooldown === 0) {
      spawnHealer(boss, Math.random() * Math.PI * 2);
      boss.healerCooldown = RESPAWN_DELAY;
    }
    if (merged) rebuildChips();
  },

  regenEquation() { return bossEq(); },

  // Solving a healer corrupts it instead of removing it: it keeps its slot and
  // its spiral, but now damages the boss when it merges (see the merge loop).
  onMinionKilled(boss, minion) { if (minion) spawnCorrupted(boss, minion); },

  label() { return "✦ THE ABSORBER ✦"; },
};
