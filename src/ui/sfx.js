// Synthesised sound effects via Web Audio API. No audio files needed.
// All sounds respect the music mute toggle (state.musicMuted).

import { state } from "../core/state.js";

let _ac = null;

function ac() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  if (_ac.state === "suspended") _ac.resume();
  return _ac;
}

// Call once inside a user-gesture handler so iOS allows later .play() calls.
export function primeSfx() {
  try { ac(); } catch (_) {}
}

function play(fn) {
  if (state.musicMuted) return;
  try { fn(ac()); } catch (_) {}
}

// Softer sine blip for hits that don't kill (enemy survives).
export function playHit() {
  play((ctx) => {
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(500 + Math.random() * 300, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.07);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.start(now);
    osc.stop(now + 0.07);
  });
}

// Low sawtooth buzzer for wrong answers.
export function playWrong() {
  play((ctx) => {
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(110, now + 0.07);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  });
}
