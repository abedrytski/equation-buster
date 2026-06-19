// Boss registry. Each boss is a self-contained def (spawn/update/regenEquation/
// onMinionKilled/label, + optional draw). The engine dispatches through
// getBossDef(boss) instead of branching on boss subtype.
//
// To add a boss: create its def file, import it here, add it to BOSSES, and slot
// its id into BOSS_ORDER. No engine-file edits required.

import mirror from "./mirror.js";
import summoner from "./summoner.js";
import sigma from "./sigma.js";

export const BOSSES = { mirror, summoner, sigma };

// Which boss appears on each boss wave, by occurrence (1-based). Extra boss
// waves clamp to the last entry.
export const BOSS_ORDER = ["summoner", "mirror", "sigma"];

export function getBossDef(boss) {
  return BOSSES[boss.kind];
}

export function pickBossForWave(bossesSpawned) {
  const i = Math.max(0, Math.min(bossesSpawned - 1, BOSS_ORDER.length - 1));
  return BOSSES[BOSS_ORDER[i]];
}
