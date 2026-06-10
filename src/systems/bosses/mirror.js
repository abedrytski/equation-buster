// The Mirror — orbit boss. Phase 1: invulnerable behind 3 orbiting minis. When
// the last mini dies it activates (phase 2, equation shown mirrored). Past 2/3
// HP it enrages (phase 3: faster, 3-number equations).

import { state } from "../../core/state.js";
import { BOSS_ORBIT_RADIUS, BOSS_ORBIT_SPEED, NUM_MINIS } from "../../core/config.js";
import { TYPES } from "../enemies/index.js";
import { randInt, eqAddOrSub, eqAdd3 } from "../../core/equations.js";
import { sharedEq } from "../entities.js";
import { rebuildChips } from "../chips.js";
import { accrueMaxScore } from "../waves.js";
import { createBoss } from "./shared.js";

// difficulty curve: phase 3 (enraged) = 3-number add; phases 1-2 = add/subtract.
function bossEquation(tier, phase) {
  const cap = state.config.maxNum;
  if (phase === 3) return eqAdd3(cap, 0.30 + tier * 0.04, 2);
  return eqAddOrSub(cap, 0.55 + tier * 0.06, 3);
}

export default {
  id: "mirror",

  spawn(tier) {
    // equation is set on activation (boss is invulnerable + label-hidden until then)
    const boss = createBoss(tier, {
      kind: "mirror",
      hp: 1 + tier * 2 + randInt(0, 1),
      value: 50 * tier,
      extra: { phase: 1 },
    });

    const cap = state.config.maxNum;
    const miniSpec = TYPES.mini;
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
        hp: 1, maxHp: 1,
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
    // enrage after the first phase-2 hit: faster + harder (mirrored phase 3).
    // 2/3 threshold keeps phase 2 short so most of the fight is dramatic phase 3.
    if (boss.phase === 2 && boss.hp <= boss.maxHp * 2 / 3) {
      boss.phase = 3;
      boss.speed = boss.speed * 1.4;
    }
  },

  regenEquation(boss) {
    return bossEquation(boss.tier, boss.phase);
  },

  onMinionKilled(boss, minion) {
    if (!boss.invulnerable) return;  // already activated
    const remaining = state.enemies.some(e => e.type === "mini" && e.parent === boss);
    if (remaining) return;
    boss.invulnerable = false;
    boss.phase = 2;
    const eq = bossEquation(boss.tier, boss.phase);
    boss.text = eq.text;
    boss.answer = eq.answer;
    rebuildChips();
  },

  label(boss) {
    return boss.invulnerable ? "✦ THE MIRROR ✦" : "✦ ЯOЯЯIM ƎHT ✦";
  },
};
