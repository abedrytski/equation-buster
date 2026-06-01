// Game controller: starting a run and returning to the menu. Kept separate
// from input wiring so both the keyboard and the buttons can drive it.

import { state, freshGameState } from "./core/state.js";
import { waveValueBudget, announceWave } from "./systems/waves.js";
import { rebuildChips } from "./systems/chips.js";
import { primeAudio, updateMusic } from "./ui/audio.js";

export function startGame(diffKey) {
  Object.assign(state, freshGameState(diffKey));
  state.started = true;
  state.waveValueRemaining = waveValueBudget(state.wave);
  announceWave();
  rebuildChips();
  primeAudio();
  updateMusic();
}

export function goToStart() {
  // back to the menu — full reset, keeping the chosen difficulty
  Object.assign(state, freshGameState(state.diffKey));
  rebuildChips();
}
