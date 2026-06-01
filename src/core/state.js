// The single mutable game-state object, plus a factory for a fresh run.
// Other modules import `state` and mutate it in place (never reassign it).

import { DIFFICULTIES, MAX_LIVES } from "./config.js";

// Per-game state, reset at the start of every run. Music fields live outside
// this factory because they persist across games (mute pref + current track).
export function freshGameState(diffKey) {
  return {
    started: false,
    diffKey: diffKey ?? null,
    config: diffKey ? { ...DIFFICULTIES[diffKey] } : null,
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
  musicCurrentTrack: "none",
  musicMuted: false,
};
