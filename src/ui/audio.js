// Music control. Only one track plays at a time (iOS Safari ignores
// audio.volume, so we pause one and play the other on transitions). Default is
// muted; the user opts in via the 🔊 button, persisted in localStorage.

import { state } from "../core/state.js";
import { bgmEl, bossBgmEl, muteBtnEl } from "../core/dom.js";
import { MUSIC_BG_VOL, MUSIC_BOSS_VOL } from "../core/config.js";

let audioPrimed = false;

export function primeAudio() {
  // Must be called from inside a user-gesture handler. Briefly plays each
  // element muted, then pauses, so subsequent .play() calls (e.g. when the
  // boss appears mid-game, outside any gesture) are allowed on iOS.
  if (audioPrimed) return;
  audioPrimed = true;
  for (const el of [bgmEl, bossBgmEl]) {
    el.muted = true;
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
    el.pause();
    el.muted = false;
  }
}

function desiredTrack() {
  if (state.musicMuted) return "none";
  if (!state.started || state.gameOver || state.paused) return "none";
  return state.enemies.some((e) => e.type === "boss") ? "boss" : "bg";
}

export function updateMusic() {
  const desired = desiredTrack();
  if (desired === state.musicCurrentTrack) return;
  if (state.musicCurrentTrack === "bg") bgmEl.pause();
  else if (state.musicCurrentTrack === "boss") bossBgmEl.pause();
  if (desired === "bg") {
    bgmEl.volume = MUSIC_BG_VOL;
    const p = bgmEl.play();
    if (p && p.catch) p.catch(() => {});
  } else if (desired === "boss") {
    bossBgmEl.volume = MUSIC_BOSS_VOL;
    const p = bossBgmEl.play();
    if (p && p.catch) p.catch(() => {});
  }
  state.musicCurrentTrack = desired;
}

export function setMuted(muted) {
  state.musicMuted = muted;
  try { localStorage.setItem("ms_muted", muted ? "1" : "0"); } catch (_) { /* ignore */ }
  muteBtnEl.classList.toggle("muted", muted);
  muteBtnEl.textContent = muted ? "🔇" : "🔊";
}

// Wire the mute button and restore the saved preference. Called once at startup.
export function initAudio() {
  // Default: muted. Only an explicit "0" in storage means "user opted in".
  try { state.musicMuted = localStorage.getItem("ms_muted") !== "0"; } catch (_) { /* ignore */ }
  setMuted(state.musicMuted);
  muteBtnEl.addEventListener("click", () => {
    primeAudio();
    setMuted(!state.musicMuted);
    updateMusic();
  });
}
