// Game controller: starting a run and returning to the menu. Kept separate
// from input wiring so both the keyboard and the buttons can drive it.

import { state, freshGameState } from "./core/state.js";
import { waveValueBudget, announceWave } from "./systems/waves.js";
import { rebuildChips } from "./systems/chips.js";
import { primeAudio, updateMusic } from "./ui/audio.js";
import {
  difficultyForWorldLevel, LEVELS_PER_WORLD, WAVES_PER_LEVEL,
  PLAYER_DAMAGE_MIN, PLAYER_DAMAGE_MAX, playerDamageBonus,
} from "./core/config.js";
import { pickBossForWave } from "./systems/bosses/index.js";
import { getPlayerLevel } from "./lib/progress.js";
import { getDifficultyMult } from "./lib/settings.js";

export function startGame(world, level) {
  Object.assign(state, freshGameState());
  const pl = getPlayerLevel();
  const dmgBonus = playerDamageBonus(pl);
  state.playerDamageMin = PLAYER_DAMAGE_MIN + dmgBonus.min;
  state.playerDamageMax = PLAYER_DAMAGE_MAX + dmgBonus.max;
  state.started = true;
  state.selectedWorld = world;
  state.selectedLevel = level;
  state.config = difficultyForWorldLevel(world, level, getDifficultyMult());

  // The final level of each world is a single boss fight; every other level is
  // a short run of WAVES_PER_LEVEL regular waves.
  state.bossLevel = level >= LEVELS_PER_WORLD;
  state.totalWaves = state.bossLevel ? 1 : WAVES_PER_LEVEL;
  state.waveValueRemaining = waveValueBudget(state.wave);

  if (state.bossLevel) {
    // boss difficulty grows with the world we're in
    state.bossesSpawned = world;
    pickBossForWave(world).spawn(world);
  }

  announceWave();
  rebuildChips();
  primeAudio();
  updateMusic();
}

export function goToStart() {
  // back to the menu — full reset
  Object.assign(state, freshGameState());
  rebuildChips();
}
