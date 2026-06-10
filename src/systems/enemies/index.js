// Enemy registry. Each enemy is a declarative descriptor (stats + its pure
// equation generator); the engine — movement, queueing, collision, chips and
// rendering — stays generic and looks enemies up by type through TYPES /
// getEnemyDef. Mirrors the boss registry in ../bosses/.
//
// To add an enemy: create its file, import it here, add it to LIST, and give
// its id a weight in the LEVEL_PLAN cells where it should spawn (core/config.js).

import yellow from "./yellow.js";
import ice from "./ice.js";
import heart from "./heart.js";
import pink from "./pink.js";
import green from "./green.js";
import blue from "./blue.js";
import hexagon from "./hexagon.js";
import boss from "./boss.js";
import mini from "./mini.js";
import summon from "./summon.js";

const LIST = [yellow, ice, heart, pink, green, blue, hexagon, boss, mini, summon];

// id -> descriptor. Keyed the same way the old config.TYPES table was, so every
// `TYPES[enemy.type]` lookup elsewhere keeps working unchanged.
export const TYPES = Object.fromEntries(LIST.map((e) => [e.id, e]));

export function getEnemyDef(enemy) {
  return TYPES[enemy.type];
}
