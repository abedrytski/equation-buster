// Entry point: import side-effecting setup, wire input, and run the RAF loop.
// Importing ./view.js runs the initial canvas resize + listeners on load.

import "./core/view.js";
import { state } from "./core/state.js";
import { MAX_INPUT_LEN, NUM_WORLDS } from "./core/config.js";
import * as auth from "./lib/auth.js";
import * as progress from "./lib/progress.js";
import { initAuthUI, hideAuthScreen, showAuthScreen } from "./lib/authUI.js";
import {
  restartBtnEl, worldMapBtnEl, homeBtnEl, homePlayBtnEl,
  worldCardBtnEl, worldBackBtnEl, worldPlayBtnEl, levelMapEl,
  worldPrevBtnEl, worldNextBtnEl,
  diffPillsEl,
  settingsBtnEl, settingsMenuEl, resetBtnEl, logoutBtnEl,
  bossListBtnEl, bossListMenuEl,
} from "./core/dom.js";
import { confirmDialog } from "./ui/confirm.js";
import { initChipDOM } from "./systems/chips.js";
import { initAudio, updateMusic } from "./ui/audio.js";
import { update } from "./systems/update.js";
import { render } from "./ui/render.js";
import { fireInput } from "./systems/combat.js";
import { startGame, goToStart } from "./game.js";
import { BOSS_ORDER } from "./systems/bosses/index.js";
import { LEVELS_PER_WORLD } from "./core/config.js";
import { toggleDebugPanel } from "./ui/debug.js";
import { getDifficultyMult, setDifficultyMult } from "./lib/settings.js";

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
  await progress.initProgress();
  const f = progress.getFurthest();
  state.currentWorld = f.world;
  state.selectedLevel = f.level;
  state.menuScreen = "home";
  hideAuthScreen();  // reveal only after home screen data is ready
}

// INITIAL_SESSION fires once on subscription with the definitive auth state
// (restored session or null). SIGNED_IN covers the OAuth-redirect return.
auth.onAuthChange(({ type, user }) => {
  if (user && (type === "INITIAL_SESSION" || type === "SIGNED_IN")) {
    onSignedIn(user);
  } else if (!user && type === "INITIAL_SESSION") {
    initAuthUI();
    showAuthScreen();
  }
});

auth.initAuth();

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
  // P toggles the debug panel at any point during a started run (skip if
  // the event originates from a debug input so typing doesn't close it).
  if (state.started && (ev.key === "p" || ev.key === "P") && ev.target.tagName !== "INPUT") {
    toggleDebugPanel();
    ev.preventDefault();
    return;
  }

  // C toggles the equation display format (inline ↔ column) during active play.
  // Guarded off the game-over screen, where C already means "return to start".
  if (state.started && !state.gameOver && (ev.key === "c" || ev.key === "C") && ev.target.tagName !== "INPUT") {
    state.eqFormat = state.eqFormat === "inline" ? "column" : "inline";
    ev.preventDefault();
    return;
  }

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

// ---------- settings menu (gear): Reset + Log out

function closeSettingsMenu() {
  settingsMenuEl.hidden = true;
  bossListMenuEl.hidden = true;
  settingsBtnEl.setAttribute("aria-expanded", "false");
}
function toggleSettingsMenu() {
  const open = settingsMenuEl.hidden;
  settingsMenuEl.hidden = !open;
  settingsBtnEl.setAttribute("aria-expanded", String(open));
}

settingsBtnEl.addEventListener("click", (ev) => {
  ev.stopPropagation(); // don't let the outside-click closer see this click
  toggleSettingsMenu();
});
// any click outside the open menu(s) closes it
document.addEventListener("click", (ev) => {
  if (settingsMenuEl.hidden && bossListMenuEl.hidden) return;
  if (settingsMenuEl.contains(ev.target) || bossListMenuEl.contains(ev.target)) return;
  closeSettingsMenu();
});

// Boss list: jump straight into any boss fight, no unlock required. Each boss
// maps to the world it normally headlines (its BOSS_ORDER slot), so difficulty
// and the correct boss both fall out of startGame's existing boss-wave path.
for (const [i, id] of BOSS_ORDER.entries()) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "settingsItem";
  btn.textContent = id.charAt(0).toUpperCase() + id.slice(1);
  btn.addEventListener("click", () => {
    closeSettingsMenu();
    startGame(i + 1, LEVELS_PER_WORLD);
  });
  bossListMenuEl.appendChild(btn);
}
bossListBtnEl.addEventListener("click", (ev) => {
  ev.stopPropagation();
  settingsMenuEl.hidden = true;
  bossListMenuEl.hidden = false;
});

resetBtnEl.addEventListener("click", async () => {
  closeSettingsMenu();
  const ok = await confirmDialog({
    title: "Reset progress?",
    message: "This erases all your stars, levels and XP, starting you over from World 1, Level 1. This can't be undone.",
    confirmLabel: "Reset",
    danger: true,
  });
  if (!ok) return;
  await progress.resetProgress();
  setDifficultyMult(1);
  syncDiffPills();
  state.currentWorld = 1;
  state.selectedLevel = 1;
  state.menuScreen = "home";
});

logoutBtnEl.addEventListener("click", async () => {
  closeSettingsMenu();
  const ok = await confirmDialog({
    title: "Log out?",
    message: "You'll need to sign in again with Google to keep playing.",
    confirmLabel: "Log out",
    danger: true,
  });
  if (!ok) return;
  await auth.signOut();
  window.location.reload(); // fresh load returns to the sign-in screen
});

// Difficulty pills
function syncDiffPills() {
  const cur = getDifficultyMult();
  for (const btn of diffPillsEl.querySelectorAll(".diffPill")) {
    btn.classList.toggle("active", parseFloat(btn.dataset.mult) === cur);
  }
}
diffPillsEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest(".diffPill");
  if (!btn) return;
  setDifficultyMult(parseFloat(btn.dataset.mult));
  syncDiffPills();
});
syncDiffPills();

// Game over: replay, go to world map, or return home
restartBtnEl.addEventListener("click", () => {
  startGame(state.selectedWorld, state.selectedLevel);
});
worldMapBtnEl.addEventListener("click", () => {
  goToStart();              // full reset after the finished run
  openWorldAtFurthest();    // then open the world map on the latest available level
});
homeBtnEl.addEventListener("click", goToStart);
