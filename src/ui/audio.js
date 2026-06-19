// Music + SFX control.
//
// BGM tracks (looping):
//   bg    → waves.mp3        (normal wave combat)
//   boss  → boss.mp3         (boss fights)
// The menu / home / world screens play no music.
//
// One-shot SFX (non-looping):
//   game_start.mp3, level_success.mp3, game_over.mp3, laser.mp3

import { state } from "../core/state.js";
import {
  bgmEl,
  levelSuccessSfxEl, gameOverSfxEl, laserSfxEl,
  muteBtnEl, homeMuteBtnEl,
} from "../core/dom.js";
import { MUSIC_BG_VOL } from "../core/config.js";
import { primeSfx } from "./sfx.js";

const SFX_VOL  = 0.65;

const BGM     = { bg: bgmEl };
const BGM_VOL = { bg: MUSIC_BG_VOL };

let audioPrimed = false;

export function primeAudio() {
  if (audioPrimed) return;
  audioPrimed = true;
  primeSfx();
  const all = [bgmEl, levelSuccessSfxEl, gameOverSfxEl, laserSfxEl];
  for (const el of all) {
    el.muted = true;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    el.pause();
    el.muted = false;
  }
}

function desiredTrack() {
  if (state.musicMuted) return "none";
  if (state.paused) return "none";
  if (state.gameOver || !state.started) return "none"; // no music on menus
  return "bg"; // waves.mp3 for both normal and boss combat
}

export function updateMusic() {
  const desired = desiredTrack();
  if (desired === state.musicCurrentTrack) return;
  const prev = BGM[state.musicCurrentTrack];
  if (prev) prev.pause();
  const next = BGM[desired];
  if (next) {
    next.volume = BGM_VOL[desired];
    const p = next.play();
    if (p && p.catch) p.catch(() => {});
  }
  state.musicCurrentTrack = desired;
}

// --- one-shot SFX ---

function playSfx(el, vol = SFX_VOL) {
  if (state.musicMuted) return;
  try {
    el.currentTime = 0;
    el.volume = vol;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  } catch (_) {}
}

export function playLaser()        { playSfx(laserSfxEl,        0.15); }
export function playLevelSuccess() { playSfx(levelSuccessSfxEl, 0.70); }
export function playGameOver()     { playSfx(gameOverSfxEl,     0.65); }

// --- mute toggle ---

export function setMuted(muted) {
  state.musicMuted = muted;
  const icon = muted ? "🔇" : "🔊";
  for (const btn of [muteBtnEl, homeMuteBtnEl]) {
    btn.classList.toggle("muted", muted);
    btn.textContent = icon;
  }
  updateMusic();
}

function onMuteClick() {
  primeAudio();
  const next = !state.musicMuted;
  setMuted(next);
  try { localStorage.setItem("ms_muted", next ? "1" : "0"); } catch (_) {}
}

export function initAudio() {
  const saved = (() => { try { return localStorage.getItem("ms_muted"); } catch (_) { return null; } })();
  setMuted(saved === "1");
  muteBtnEl.addEventListener("click", onMuteClick);
  homeMuteBtnEl.addEventListener("click", onMuteClick);

  // Prime audio on the first user interaction (browsers block autoplay until a
  // gesture) so combat music can start the moment a level begins.
  document.addEventListener("click", () => { primeAudio(); updateMusic(); }, { once: true });
}
