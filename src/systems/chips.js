// Chip-based touch input: the row of tappable answer buttons. Rebuilds the
// chip values from the current enemy answers (+ distractors) and handles taps.

import { state } from "../core/state.js";
import { placePlayerLine, playerX, playerY } from "../core/view.js";
import { randInt } from "../core/equations.js";
import { fireAnswer } from "./combat.js";
import { MAX_CHIPS, CHIP_WRONG_LOCK } from "../core/config.js";
import { chipBarEl } from "../core/dom.js";

export function rebuildChips(shuffle = false) {
  if (!state.started || state.gameOver) {
    state.chips = [];
    renderChips();
    return;
  }
  // collect unique enemy answers, prioritizing nearest threats; skip invulnerable
  const sorted = state.enemies
    .filter((e) => !e.invulnerable)
    .sort((a, b) => Math.hypot(a.x - playerX, a.y - playerY) - Math.hypot(b.x - playerX, b.y - playerY));
  const wanted = [];
  const wantedSet = new Set();
  for (const e of sorted) {
    if (wantedSet.has(e.answer)) continue;
    wantedSet.add(e.answer);
    wanted.push(e.answer);
    if (wanted.length >= MAX_CHIPS) break;
  }

  // magnitude band of the answers actually on screen. Decoys — and any stale
  // chips left over from larger, now-dead enemies — must stay inside it, scaled
  // to the answer size, so the row never shows a number wildly out of range of
  // the current enemies.
  const reals = sorted.map((e) => e.answer).filter((a) => a != null);
  const maxReal = reals.length ? Math.max(...reals) : (state.config?.maxNum || 20);
  const minReal = reals.length ? Math.min(...reals) : 1;
  const useTens = maxReal >= 20;          // tens-place decoys only help for 2-digit answers
  const band = useTens ? 10 : 4;
  const loBound = Math.max(1, minReal - band);
  const hiBound = maxReal + band;

  // start from current chips to preserve positions
  const chips = state.chips.slice();
  while (chips.length < MAX_CHIPS) chips.push(null);
  chips.length = MAX_CHIPS;

  // step 1: free slots whose value isn't wanted (and isn't an enemy answer)
  const stillNeeded = new Set(wanted);
  for (let i = 0; i < MAX_CHIPS; i++) {
    if (chips[i] != null && stillNeeded.has(chips[i])) {
      stillNeeded.delete(chips[i]);
    }
  }
  // step 2: place stillNeeded values into RANDOM available slots
  // (random slot picks prevent the same chip from being correct again on the
  //  next hit of a multi-HP enemy)
  const toFill = Array.from(stillNeeded);
  const avail = [];
  for (let i = 0; i < MAX_CHIPS; i++) {
    if (chips[i] == null || !wantedSet.has(chips[i])) avail.push(i);
  }
  for (let i = avail.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [avail[i], avail[j]] = [avail[j], avail[i]];
  }
  for (const ans of toFill) {
    if (avail.length === 0) break;
    chips[avail.shift()] = ans;
  }
  // drop any leftover chip now out of the on-screen answer range (e.g. a decoy
  // or answer left from a bigger enemy that has since died) so step 3 replaces
  // it with an in-range decoy.
  for (let i = 0; i < MAX_CHIPS; i++) {
    if (chips[i] != null && !wantedSet.has(chips[i]) &&
        (chips[i] < loBound || chips[i] > hiBound)) {
      chips[i] = null;
    }
  }
  // step 3: fill any nulls with *confusable* distractors. Each decoy shares the
  // last digit of a real answer and sits near its magnitude (answer ± 10·k), so
  // the row can't be solved by reading units digits or by spotting the "big"
  // number — the player has to actually compute. We reinforce whichever answer's
  // units digit is currently least represented, so no answer is identifiable by
  // its final digit and the real answer just looks like one more decoy.
  const enemyAnswers = new Set();
  for (const e of state.enemies) if (!e.invulnerable && e.answer != null) enemyAnswers.add(e.answer);

  const lastDigitCount = (digit) => {
    let n = 0;
    for (let i = 0; i < MAX_CHIPS; i++) if (chips[i] != null && chips[i] % 10 === digit) n++;
    return n;
  };
  // Decoy deltas. For 2-digit answers we shift the tens (± multiples of 10) so
  // the row can't be read off by units digit. Single-digit answers have no tens
  // to shift, so we use small off-by-N slips (the natural mistakes). Either way
  // candidates are clamped to [loBound, hiBound] so nothing is out of range.
  const DELTAS = useTens ? [-10, 10, -20, 20, -30, 30, -40, 40]
                         : [-1, 1, -2, 2, -3, 3, -4, 4];

  for (let i = 0; i < MAX_CHIPS; i++) {
    if (chips[i] != null) continue;
    let cand = null;

    if (wanted.length > 0) {
      // target the answer whose units digit is least represented so far
      let target = wanted[0], bestN = Infinity;
      for (const a of wanted) {
        const n = lastDigitCount(a % 10);
        if (n < bestN) { bestN = n; target = a; }
      }
      for (const d of DELTAS) {
        const v = target + d;
        if (v >= loBound && v <= hiBound && !chips.includes(v) && !enemyAnswers.has(v)) {
          cand = v; break;
        }
      }
    }

    if (cand == null) {
      // fallback: a distinct, in-range value
      let guard = 0;
      do {
        cand = randInt(loBound, hiBound);
        guard++;
      } while ((chips.includes(cand) || enemyAnswers.has(cand)) && guard < 200);
    }
    chips[i] = cand;
  }

  // optional shuffle: randomize all slots so the player can't memorize where
  // a given answer always lives. Only used when the caller asks for it.
  if (shuffle) {
    for (let i = chips.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chips[i], chips[j]] = [chips[j], chips[i]];
    }
  }

  state.chips = chips;
  renderChips();
}

export function initChipDOM() {
  chipBarEl.innerHTML = "";
  for (let i = 0; i < MAX_CHIPS; i++) {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.type = "button";
    btn.dataset.index = String(i);
    btn.addEventListener("pointerdown", (ev) => {
      ev.preventDefault();
      onChip(btn, i);
    });
    chipBarEl.appendChild(btn);
  }
}

let chipBarWasVisible = false;
export function renderChips() {
  const visible = state.started && !state.gameOver && state.chips.length > 0;
  chipBarEl.hidden = !visible;
  if (visible && !chipBarWasVisible) placePlayerLine();
  chipBarWasVisible = visible;
  if (!visible) return;
  const children = chipBarEl.children;
  for (let i = 0; i < MAX_CHIPS; i++) {
    const node = children[i];
    if (!node) continue;
    const value = state.chips[i];
    if (node.textContent !== String(value)) node.textContent = String(value);
  }
}

function onChip(btn, index) {
  if (!state.started || state.gameOver || state.paused) return;
  if (state.chipLockTimer > 0) return;
  const value = state.chips[index];
  if (value == null) return;
  const hit = fireAnswer(value);
  if (hit) {
    btn.classList.add("right");
    setTimeout(() => btn.classList.remove("right"), 180);
  } else {
    btn.classList.add("wrong");
    state.chipLockTimer = CHIP_WRONG_LOCK;
    setTimeout(() => btn.classList.remove("wrong"), 320);
  }
}
