// Global gameplay settings persisted in localStorage.

import { XP_BASE_STARS } from "../core/config.js";

const KEY_DIFF = "ms_diff_mult";

// XP scale per difficulty pill. Anchors: 0.5×→50%, 1×→100%, 3×→200%.
const DIFF_XP_SCALE = { 0.5: 0.5, 1: 1.0, 1.5: 1.3, 2: 1.65, 3: 2.0 };

export function xpForStarsAndDiff(stars, diffMult) {
  const base = XP_BASE_STARS[Math.min(3, Math.max(0, stars))] ?? 0;
  const scale = DIFF_XP_SCALE[diffMult] ?? 1.0;
  return Math.round(base * scale);
}

let _diffMult = (() => {
  try { const v = parseFloat(localStorage.getItem(KEY_DIFF)); return isNaN(v) ? 1 : v; }
  catch (_) { return 1; }
})();

export function getDifficultyMult() { return _diffMult; }

export function setDifficultyMult(v) {
  _diffMult = v;
  try { localStorage.setItem(KEY_DIFF, String(v)); } catch (_) {}
}
