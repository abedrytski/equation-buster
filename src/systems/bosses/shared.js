// Shared boss scaffold. Each boss def calls this to wipe the screen and build
// the common boss entity, passing its `kind` (registry id) plus the
// variant-specific hp / value / extra fields.

import { state } from "../../core/state.js";
import { laneX } from "../../core/view.js";
import { BOSS_COLORS, BOSS_SPAWN_Y } from "../../core/config.js";
import { wipeEnemiesToDeaths } from "../entities.js";

export function createBoss(tier, { kind, hp, value, extra }) {
  wipeEnemiesToDeaths();
  const color = BOSS_COLORS[Math.floor(Math.random() * BOSS_COLORS.length)];
  const boss = {
    type: "boss",
    kind,
    tier,
    x: laneX(1), y: BOSS_SPAWN_Y, lane: 1,
    hp, maxHp: hp,
    radius: 50 + tier * 10,
    speed: 8 + tier * 2,
    color, value,
    invulnerable: true,
    spawnFade: 0,
    ...extra,
  };
  state.enemies.push(boss);
  return boss;
}
