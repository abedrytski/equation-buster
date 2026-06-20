// Game controller: starting a run and returning to the menu. Kept separate
// from input wiring so both the keyboard and the buttons can drive it.

import { state, freshGameState } from "./core/state.js";
import { announceWave } from "./systems/waves.js";
import { rebuildChips } from "./systems/chips.js";
import { primeAudio, updateMusic, restartMusic } from "./ui/audio.js";
import {
  difficultyForWorldLevel, LEVELS_PER_WORLD, WAVES_PER_LEVEL,
  PLAYER_DAMAGE_MIN, PLAYER_DAMAGE_MAX, playerDamageBonus,
  MAX_HP, playerHpBonus, levelPlan,
} from "./core/config.js";

// Build per-wave spawn queues from a level's exact enemy counts.
// Shuffles the full list, then splits roughly in half across WAVES_PER_LEVEL waves.
function buildWaveQueues(spawn, numWaves) {
  const all = [];
  for (const [type, count] of Object.entries(spawn)) {
    for (let i = 0; i < count; i++) all.push(type);
  }
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  const queues = [];
  const base = Math.floor(all.length / numWaves);
  let offset = 0;
  for (let w = 0; w < numWaves; w++) {
    const size = w < all.length % numWaves ? base + 1 : base;
    queues.push(all.slice(offset, offset + size));
    offset += size;
  }
  return queues;
}
import { pickBossForWave } from "./systems/bosses/index.js";
import { getPlayerLevel } from "./lib/progress.js";
import { getDifficultyMult } from "./lib/settings.js";

export function startGame(world, level) {
  Object.assign(state, freshGameState());
  const pl = getPlayerLevel();
  const dmgBonus = playerDamageBonus(pl);
  state.playerDamageMin = PLAYER_DAMAGE_MIN + dmgBonus.min;
  state.playerDamageMax = PLAYER_DAMAGE_MAX + dmgBonus.max;
  state.maxHp = MAX_HP + playerHpBonus(pl);
  state.hp = state.maxHp;
  state.started = true;
  state.selectedWorld = world;
  state.selectedLevel = level;
  state.config = difficultyForWorldLevel(world, level, getDifficultyMult());

  // The final level of each world is a single boss fight; every other level is
  // a short run of WAVES_PER_LEVEL regular waves.
  state.bossLevel = level >= LEVELS_PER_WORLD;
  state.totalWaves = state.bossLevel ? 1 : WAVES_PER_LEVEL;

  const plan = levelPlan(world, level);
  state.waveQueues = buildWaveQueues(plan.spawn, state.totalWaves);
  state.spawnQueue = [...state.waveQueues[0]];
  state.waveSpawnTotal = state.spawnQueue.length;

  if (state.bossLevel) {
    // boss difficulty grows with the world we're in
    state.bossesSpawned = world;
    pickBossForWave(world).spawn(world);
  }

  announceWave();
  rebuildChips();
  primeAudio();
  restartMusic();
}

export function goToStart() {
  // back to the menu — full reset
  Object.assign(state, freshGameState());
  rebuildChips();
}
