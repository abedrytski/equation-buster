// Cached DOM element references. Imported as a module, so this runs after the
// document is parsed (deferred), meaning every lookup resolves.

export const canvas = document.getElementById("game");
export const ctx = canvas.getContext("2d");

export const livesEl = document.getElementById("lives");
export const waveTextEl = document.getElementById("waveText");
export const waveFillEl = document.getElementById("waveFill");
export const tick1El = document.querySelector(".tick1");
export const tick2El = document.querySelector(".tick2");
export const waveAnnounceEl = document.getElementById("waveAnnounce");
export const breatherEl = document.getElementById("breather");
export const breatherCountEl = document.getElementById("breatherCount");
export const streakEl = document.getElementById("streak");
export const streakValueEl = document.getElementById("streakValue");
export const streakMultEl = document.getElementById("streakMult");
export const scoreHudEl = document.getElementById("scoreHud");
export const scoreValueEl = document.getElementById("scoreValue");
export const gameOverEl = document.getElementById("gameover");
export const finalScoreEl = document.getElementById("finalScore");
export const gameOverTitleEl = document.getElementById("gameoverTitle");
export const inputValueEl = document.getElementById("inputValue");
export const pausedEl = document.getElementById("paused");
export const startScreenEl = document.getElementById("startScreen");
export const restartBtnEl = document.getElementById("restartBtn");
export const changeDiffBtnEl = document.getElementById("changeDiffBtn");
export const diffBtnEls = document.querySelectorAll(".diffBtn");
export const startBtnEl = document.getElementById("startBtn");
export const bossAlertEl = document.getElementById("bossAlert");
export const inputBoxEl = document.getElementById("inputBox");
export const chipBarEl = document.getElementById("chipBar");
export const bgmEl = document.getElementById("bgm");
export const bossBgmEl = document.getElementById("bossBgm");
export const muteBtnEl = document.getElementById("muteBtn");
