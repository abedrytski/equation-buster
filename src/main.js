// Entry point: import side-effecting setup, wire input, and run the RAF loop.
// Importing ./view.js runs the initial canvas resize + listeners on load.

import "./core/view.js";
import { state } from "./core/state.js";
import { MAX_INPUT_LEN, NUM_WORLDS } from "./core/config.js";
import * as auth from "./lib/auth.js";
import * as progress from "./lib/progress.js";
import { initAuthUI, hideAuthScreen, showAuthScreen } from "./lib/authUI.js";
import {
  restartBtnEl, homeBtnEl, homePlayBtnEl,
  worldCardBtnEl, worldBackBtnEl, worldPlayBtnEl, levelMapEl,
  worldPrevBtnEl, worldNextBtnEl, worldNavTitleEl,
} from "./core/dom.js";
import { initChipDOM } from "./systems/chips.js";
import { initAudio, updateMusic } from "./ui/audio.js";
import { update } from "./systems/update.js";
import { render } from "./ui/render.js";
import { fireInput } from "./systems/combat.js";
import { startGame, goToStart } from "./game.js";

// ---------- startup

initChipDOM();
initAudio();

// Once a user is signed in: load their saved progress, point the menus at the
// furthest reached level, and reveal the game. Guarded against double-fire
// because both the immediate-restore and the OAuth-redirect paths can trigger.
let _signedInOnce = false;
async function onSignedIn(user) {
  if (_signedInOnce) return;
  _signedInOnce = true;
  hideAuthScreen();
  await progress.initProgress();
  const f = progress.getFurthest();
  state.currentWorld = f.world;
  state.selectedLevel = f.level;
}

// Subscribe before initAuth so the OAuth-redirect case (where Supabase fires
// SIGNED_IN via onAuthStateChange after the page reloads with ?code=...) is
// always caught, even if getSession() returned null before the exchange.
auth.onAuthChange(({ type, user }) => {
  if ((type === "SIGNED_IN" || type === "restore") && user) onSignedIn(user);
});

auth.initAuth().then(() => {
  if (!auth.isAuthenticated()) {
    // Either a fresh visit or OAuth exchange still in progress — show the sign-in
    // screen. If it's the latter, onAuthChange above fires shortly after and
    // dismisses it.
    initAuthUI();
    showAuthScreen();
  }
});

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
      if (progress.isUnlocked(state.currentWorld, state.selectedLevel)) {
        startGame(state.currentWorld, state.selectedLevel);
      }
      ev.preventDefault();
    }
    return;
  }

  if (state.gameOver) {
    if (ev.key === "r" || ev.key === "R") {
      startGame(state.selectedWorld, state.selectedLevel);
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

// ---------- menu navigation + level selection

// Home → world-selection, opening at the furthest reached level
function openWorldAtFurthest() {
  const f = progress.getFurthest();
  state.currentWorld = f.world;
  state.selectedLevel = f.level;
  state.menuScreen = "world";
}
homePlayBtnEl.addEventListener("click", openWorldAtFurthest);
worldCardBtnEl.addEventListener("click", openWorldAtFurthest);

// World-selection: tap an unlocked level node to select it
if (levelMapEl) {
  levelMapEl.addEventListener("click", (ev) => {
    const node = ev.target.closest(".node[data-level]");
    if (!node) return;
    const level = parseInt(node.dataset.level, 10);
    if (!progress.isUnlocked(state.currentWorld, level)) return;
    state.selectedLevel = level;
  });
}

// World navigation — moving worlds resets the selection to that world's default
if (worldPrevBtnEl) {
  worldPrevBtnEl.addEventListener("click", () => {
    state.currentWorld = Math.max(1, state.currentWorld - 1);
    state.selectedLevel = progress.defaultLevel(state.currentWorld);
  });
}
if (worldNextBtnEl) {
  worldNextBtnEl.addEventListener("click", () => {
    state.currentWorld = Math.min(NUM_WORLDS, state.currentWorld + 1);
    state.selectedLevel = progress.defaultLevel(state.currentWorld);
  });
}

// Start the selected level
worldPlayBtnEl.addEventListener("click", () => {
  if (!progress.isUnlocked(state.currentWorld, state.selectedLevel)) return;
  startGame(state.currentWorld, state.selectedLevel);
});

// Back button
worldBackBtnEl.addEventListener("click", () => { state.menuScreen = "home"; });

// Game over: replay the same level, or return home
restartBtnEl.addEventListener("click", () => {
  startGame(state.selectedWorld, state.selectedLevel);
});
homeBtnEl.addEventListener("click", goToStart);
