// The single mutable game-state object, plus a factory for a fresh run.
// Other modules import `state` and mutate it in place (never reassign it).

import { MAX_LIVES, WAVES_PER_LEVEL } from "./config.js";

// Per-game state, reset at the start of every run. Music fields live outside
// this factory because they persist across games (mute pref + current track).
export function freshGameState() {
  return {
    started: false,
    menuScreen: "home",    // pre-game menu: "home" | "world"
    currentWorld: 1,       // which world we're viewing on world selection screen
    selectedWorld: 1,      // which world the active run belongs to
    selectedLevel: 1,      // which level in the world was selected (default to 1)
    config: null,          // set by startGame() based on world/level
    bossLevel: false,      // true on the final level of a world (boss-only)
    totalWaves: WAVES_PER_LEVEL, // waves to clear this level (1 for boss levels)
    scoreMax: 0,           // theoretical max score for the level (for stars)
    perfectKills: 0,       // hypothetical flawless-run kill counter (for scoreMax)
    lastStars: 0,          // stars earned when the run ended in victory
    lives: MAX_LIVES,
    enemies: [],
    lasers: [],
    deaths: [],
    spawnTimer: 0,
    gameOver: false,
    flashTimer: 0,
    shakeTimer: 0,
    levelUpTimer: 0,
    input: "",
    paused: false,
    bossesSpawned: 0,
    bossAlertTimer: 0,
    chips: [],
    chipLockTimer: 0,
    wave: 1,
    wavePhase: "active",   // "active" | "breather"
    waveTimer: 0,
    waveValueRemaining: 0,
    streak: 0,
    bestStreak: 0,
    freezeTimer: 0,
    bonusSpawnedThisWave: {},
    wrongFlashTimer: 0,
    score: 0,
    scorePopTimer: 0,
  };
}

export const state = {
  ...freshGameState(null),
  menuScreen: null,          // null = loading (auth+progress not ready yet)
  musicCurrentTrack: "none",
  musicMuted: false,
};
