// Canvas geometry: device-pixel-ratio scaling, playfield dimensions, the
// player line, and lane → x mapping. W/H/playerX/playerY are exported as live
// bindings — other modules import and read them; only this module reassigns.

import { canvas, ctx, chipBarEl } from "./dom.js";
import { LANE_X_FRACTIONS, PLAYER_LINE_GAP } from "./config.js";

export let W = 0, H = 0, dpr = 1;
export let playerX = 0, playerY = 0;

export function laneX(lane) {
  return W * LANE_X_FRACTIONS[lane];
}

// Park the player line a hair above the chip bar. We derive playerY from the
// chip bar's measured offsetHeight (which already factors in safe-area-inset)
// so the finish line hugs the buttons regardless of device chrome. When the
// chip bar is hidden (pre-game), fall back to a reasonable default.
export function placePlayerLine() {
  playerX = W / 2;
  let chipBarH = chipBarEl.offsetHeight;
  if (chipBarH === 0) chipBarH = H < 520 ? 110 : 170;
  playerY = H - chipBarH - PLAYER_LINE_GAP;
}

export function resize() {
  dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  W = rect.width || window.innerWidth;
  H = rect.height || window.innerHeight;
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  placePlayerLine();
}

window.addEventListener("resize", resize);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
}
resize();
