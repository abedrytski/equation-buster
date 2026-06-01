// Entry point: import side-effecting setup, wire input, and run the RAF loop.
// Importing ./view.js runs the initial canvas resize + listeners on load.

import "./core/view.js";
import { state } from "./core/state.js";
import { MAX_INPUT_LEN } from "./core/config.js";
import { diffBtnEls, startBtnEl, restartBtnEl, changeDiffBtnEl } from "./core/dom.js";
import { initChipDOM } from "./systems/chips.js";
import { initAudio, updateMusic } from "./ui/audio.js";
import { update } from "./systems/update.js";
import { render } from "./ui/render.js";
import { fireInput } from "./systems/combat.js";
import { startGame, goToStart } from "./game.js";

// ---------- startup

initChipDOM();
initAudio();

// ---------- main loop

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  update(dt);
  render();
  updateMusic();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- keyboard input

window.addEventListener("keydown", (ev) => {
  if (!state.started) {
    if (ev.key === "Enter" || ev.key === " ") {
      startGame(selectedDiff);
      ev.preventDefault();
    }
    return;
  }

  if (state.gameOver) {
    if (ev.key === "r" || ev.key === "R") {
      startGame(state.diffKey);
    } else if (ev.key === "c" || ev.key === "C") {
      goToStart();
    }
    return;
  }

  if (ev.key === "Escape") {
    state.paused = !state.paused;
    ev.preventDefault();
    return;
  }

  if (state.paused) return;

  if (/^[0-9]$/.test(ev.key)) {
    if (state.input.length < MAX_INPUT_LEN) state.input += ev.key;
    ev.preventDefault();
  } else if (ev.key === "Enter") {
    fireInput();
    ev.preventDefault();
  } else if (ev.key === "Backspace") {
    state.input = state.input.slice(0, -1);
    ev.preventDefault();
  }
});

// ---------- start-screen + game-over buttons

// selected difficulty on the start screen — clicking a diff button just
// selects it; the START button launches the game with whatever is selected
let selectedDiff = "easy";
diffBtnEls.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedDiff = btn.dataset.diff;
    diffBtnEls.forEach((b) => b.classList.toggle("selected", b === btn));
  });
});

startBtnEl.addEventListener("click", () => startGame(selectedDiff));
restartBtnEl.addEventListener("click", () => location.reload());
changeDiffBtnEl.addEventListener("click", goToStart);
