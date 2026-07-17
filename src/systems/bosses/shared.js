// Shared boss scaffold. Each boss def calls this to wipe the screen and build
// the common boss entity, passing its `kind` (registry id) plus the
// variant-specific hp / value / extra fields.

import { state } from "../../core/state.js";
import { laneX } from "../../core/view.js";
import { BOSS_COLORS, TOP_SPAWN_Y } from "../../core/config.js";
import { wipeEnemiesToDeaths } from "../entities.js";
import { accrueMaxScore } from "../waves.js";

export function createBoss(tier, { kind, hp, value, extra, y }) {
  wipeEnemiesToDeaths();
  const color = BOSS_COLORS[Math.floor(Math.random() * BOSS_COLORS.length)];
  const radius = 30 + tier * 10;
  const boss = {
    type: "boss",
    kind,
    tier,
    // default: hug the top just below the wave bar. Orbit bosses (mirror) pass an
    // explicit y so their wide orbit clears the top mask.
    x: laneX(1), y: y ?? TOP_SPAWN_Y + radius, lane: 1,
    hp, maxHp: hp,
    radius,
    speed: 8 + tier * 2,
    color, value,
    invulnerable: true,
    spawnFade: 0,
    ...extra,
  };
  state.enemies.push(boss);
  accrueMaxScore(value);
  return boss;
}
