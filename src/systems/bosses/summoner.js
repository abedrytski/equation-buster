// The Summoner — permanently invulnerable, no equation of its own. It maintains
// a swarm of scattered summon minions; each summon killed costs it 1 HP, and
// when it dies any remaining summons go with it.

import { state } from "../../core/state.js";
import { W, playerY } from "../../core/view.js";
import { TYPES, SUMMONER_MINIONS, SUMMONER_SPAWN_DELAY, TOP_SPAWN_Y } from "../../core/config.js";
import { randInt } from "../../core/equations.js";
import { sharedEq, spawnDeath } from "../entities.js";
import { rebuildChips } from "../chips.js";
import { gainScore } from "../waves.js";
import { createBoss } from "./shared.js";

function spawnSummon(parent) {
  const spec = TYPES.summon;
  const eq = sharedEq(() => spec.eq(state.config.maxNum));
  // pick a random spot on the playfield, biased away from the boss
  let x = W / 2, y = playerY / 2;
  const minX = 40, maxX = W - 40;
  const minY = TOP_SPAWN_Y + spec.radius + 20;
  const maxY = playerY - 60;
  for (let i = 0; i < 20; i++) {
    x = minX + Math.random() * (maxX - minX);
    y = minY + Math.random() * (maxY - minY);
    if (Math.hypot(x - parent.x, y - parent.y) >= parent.radius + 40) break;
  }
  state.enemies.push({
    type: "summon",
    parent,
    x, y, lane: null,
    text: eq.text, answer: eq.answer,
    hp: spec.hp, maxHp: spec.hp,
    radius: spec.radius,
    speed: spec.speed,
    color: spec.color,
    value: spec.value,
    spawnFade: 0,
    timeLeft: spec.lifetime,
  });
  rebuildChips();
}

export default {
  id: "summoner",

  spawn(tier) {
    const boss = createBoss(tier, {
      kind: "summoner",
      hp: 2 + tier * 2 + randInt(0, 1),
      value: 100 * tier,
      extra: { summonCooldown: 0 },
    });
    for (let i = 0; i < SUMMONER_MINIONS; i++) spawnSummon(boss);
    state.bossAlertTimer = 1.5;
    rebuildChips();
    return boss;
  },

  update(boss, dt, { frozen }) {
    // top up minions toward SUMMONER_MINIONS, one at a time, with a small delay
    // so they don't pop back the instant one dies. (freeze pauses summoning.)
    if (frozen) return;
    boss.summonCooldown = Math.max(0, boss.summonCooldown - dt);
    if (boss.summonCooldown > 0) return;
    let count = 0;
    for (const m of state.enemies) if (m.type === "summon" && m.parent === boss) count++;
    if (count < SUMMONER_MINIONS) {
      spawnSummon(boss);
      boss.summonCooldown = SUMMONER_SPAWN_DELAY;
    }
  },

  regenEquation() {
    return null;  // summoner has no equation of its own; never takes direct hits
  },

  onMinionKilled(boss, minion) {
    // each summon kill removes 1 HP; at 0 the boss dies and sweeps its minions
    boss.hp -= 1;
    if (boss.hp > 0) return;
    const idx = state.enemies.indexOf(boss);
    if (idx >= 0) {
      spawnDeath(boss, 0.7);
      state.enemies.splice(idx, 1);
      gainScore(boss.value);
    }
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const oth = state.enemies[j];
      if (oth.type === "summon" && oth.parent === boss) {
        spawnDeath(oth);
        state.enemies.splice(j, 1);
      }
    }
  },

  label() {
    return "✦ THE SUMMONER ✦";
  },
};
