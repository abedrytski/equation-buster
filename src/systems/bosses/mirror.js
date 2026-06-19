// The Mirror — orbit boss. Phase 1: invulnerable behind 3 orbiting minis. When
// the last mini dies it activates (phase 2). Past 2/3 HP it enrages (phase 3:
// faster, mixed add/subtract). Equations and HP follow pink-enemy scaling.

import { state } from "../../core/state.js";
import { BOSS_ORBIT_RADIUS, BOSS_ORBIT_SPEED, NUM_MINIS } from "../../core/config.js";
import { TYPES } from "../enemies/index.js";
import { randInt, mkSubFloor, operandCap } from "../../core/equations.js";
import { sharedEq } from "../entities.js";
import { rebuildChips } from "../chips.js";
import { accrueMaxScore } from "../waves.js";
import { createBoss } from "./shared.js";

// Pink-style equations: phase 2 = addition, phase 3 = mixed add/subtract.
function bossEquation(phase) {
  const cap = state.config.maxNum;
  const hi = operandCap(cap, 1.0, 5);
  const lo = operandCap(cap, 0.4, 4);
  if (phase === 3 && Math.random() < 0.5) return mkSubFloor(hi, lo);
  const a = randInt(lo, hi), b = randInt(lo, hi);
  return { text: `${a}+${b}`, answer: a + b };
}

export default {
  id: "mirror",

  // its signature gimmick: the equation is drawn back-to-front.
  mirrorEquation: true,

  spawn(tier) {
    // base 62 → ~100 HP at W1 normal (hp_mult ≈ 1.6); scales with world + diff.
    const boss = createBoss(tier, {
      kind: "mirror",
      hp: Math.ceil(62 * state.config.hp_mult),
      value: 50 * tier,
      extra: { phase: 1 },
    });

    const cap = state.config.maxNum;
    const miniSpec = TYPES.mini;
    const miniHp = Math.max(1, Math.ceil(miniSpec.hp * state.config.hp_mult));
    for (let i = 0; i < NUM_MINIS; i++) {
      const miniEq = sharedEq(() => miniSpec.eq(cap));
      const angle = (Math.PI * 2 * i) / NUM_MINIS;
      state.enemies.push({
        type: "mini",
        parent: boss,
        orbitAngle: angle,
        orbitRadius: BOSS_ORBIT_RADIUS,
        orbitSpeed: BOSS_ORBIT_SPEED,
        x: boss.x + Math.cos(angle) * BOSS_ORBIT_RADIUS,
        y: boss.y + Math.sin(angle) * BOSS_ORBIT_RADIUS,
        text: miniEq.text, answer: miniEq.answer,
        hp: miniHp, maxHp: miniHp,
        radius: miniSpec.radius,
        speed: 0,
        color: boss.color,
        value: miniSpec.value,
        spawnFade: 0,
      });
      accrueMaxScore(miniSpec.value);
    }

    state.bossAlertTimer = 1.5;
    rebuildChips();
    return boss;
  },

  update(boss, dt, { frozen }) {
    if (frozen) return;
    if (boss.phase === 2 && boss.hp <= boss.maxHp * 2 / 3) {
      boss.phase = 3;
      boss.speed = boss.speed * 1.4;
    }
  },

  regenEquation(boss) {
    return bossEquation(boss.phase);
  },

  onMinionKilled(boss, minion) {
    if (!boss.invulnerable) return;
    const remaining = state.enemies.some(e => e.type === "mini" && e.parent === boss);
    if (remaining) return;
    boss.invulnerable = false;
    boss.phase = 2;
    const eq = bossEquation(boss.phase);
    boss.text = eq.text;
    boss.answer = eq.answer;
    rebuildChips();
  },

  label(boss) {
    return boss.invulnerable ? "✦ THE MIRROR ✦" : "✦ ЯOЯЯIM ƎHT ✦";
  },
};
