// All canvas drawing + HUD DOM updates for one frame. Reads `state` and the
// live view geometry; never mutates game state.

import { state } from "../core/state.js";
import { ctx } from "../core/dom.js";
import { W, H, playerX, playerY, laneX } from "../core/view.js";
import {
  GRID_SIZE, NUM_LANES, MAX_HP, WRONG_FLASH_DURATION, SHIELD_REGEN_TIME,
  PLAYER_DAMAGE_MIN, PLAYER_DAMAGE_MAX,
  xpProgressInLevel, playerDamageBonus, playerHpBonus, MAX_PLAYER_LEVEL,
} from "../core/config.js";
import { TYPES } from "../systems/enemies/index.js";
import { cycleProgress, streakMult, streakTierClass, isBossWave } from "../systems/waves.js";
import { getBossDef } from "../systems/bosses/index.js";
import { drawEquation } from "./equation.js";
import { LEVELS_PER_WORLD, NUM_WORLDS, WORLD_NAMES } from "../core/config.js";
import { getCurrentUser } from "../lib/auth.js";
import * as progress from "../lib/progress.js";
import {
  livesEl, waveTextEl, waveFillEl, waveBarEl, tick1El, tick2El, waveAnnounceEl,
  breatherEl, breatherCountEl, streakEl, streakValueEl, streakMultEl,
  scoreHudEl, scoreValueEl, homeScreenEl, worldScreenEl, gameOverEl, bossAlertEl,
  pausedEl, inputBoxEl, inputValueEl, worldNavTitleEl, worldPrevBtnEl, worldNextBtnEl,
  worldProgressFillEl, worldProgressTextEl, worldPlayLabelEl,
  worldHeaderKickerEl, worldHeaderNameEl, worldStarBadgeEl,
  homeWorldKickerEl, homeWorldNameEl, homeWorldFillEl, homeWorldProgressEl,
  homeStarsEl, homePlaySubEl, profileNameEl, profileAvatarEl, profileStarsEl,
  homePlayerDmgEl, homePlayerDmgSubEl, homeMaxHpEl, homeMaxHpSubEl, homeXpFillEl, homeXpLabelEl,
} from "../core/dom.js";

// ---------- primitive shapes

function drawGrid() {
  ctx.strokeStyle = "rgba(148, 163, 184, 0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = (W / 2) % GRID_SIZE; x < W; x += GRID_SIZE) {
    ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H);
  }
  for (let y = (H / 2) % GRID_SIZE; y < H; y += GRID_SIZE) {
    ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hexPath(cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function octPath(cx, cy, r, rotate = 0) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 8 + rotate;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---------- entities

function drawEnemy(e) {
  const spec = TYPES[e.type];
  const color = e.color;

  // newly spawned enemies fade in (and scale up slightly) so they don't
  // pop into existence when they appear right under the wave bar
  const fade = e.spawnFade != null ? e.spawnFade : 1;
  ctx.save();
  if (fade < 1) {
    ctx.globalAlpha = fade;
    const k = 0.8 + 0.2 * fade;
    ctx.translate(e.x, e.y);
    ctx.scale(k, k);
    ctx.translate(-e.x, -e.y);
  }

  // wrong-answer punishment flash: red shock ring that fades out
  if (e.pushFlash && e.pushFlash > 0) {
    const k = e.pushFlash / WRONG_FLASH_DURATION;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * (1.5 + (1 - k) * 0.6), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.75 * k})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // shield aura (blue, when shield is active)
  if (e.shielded) {
    const t = performance.now() / 400;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius * 1.55, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(96, 165, 250, ${0.35 + 0.25 * Math.sin(t)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // shield recharge ring — counter-clockwise fill while shield is regenerating
  if (!e.shielded && e.shieldRegenTimer > 0) {
    const frac = Math.min(1, e.shieldRegenTimer / SHIELD_REGEN_TIME);
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 5, -Math.PI / 2, -Math.PI / 2 - Math.PI * 2 * frac, true);
    ctx.strokeStyle = `rgba(96, 165, 250, ${0.3 + 0.5 * frac})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // mini-boss tether to its parent boss
  if (e.type === "mini" && e.parent) {
    ctx.save();
    ctx.strokeStyle = e.color + "44";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(e.parent.x, e.parent.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();
    ctx.restore();
  }

  // boss aura (rotating outer rings — extra red ring while enraged, shield while invulnerable)
  if (spec.shape === "boss") {
    const t = performance.now() / 1000;
    octPath(e.x, e.y, e.radius * 1.35, t);
    ctx.strokeStyle = color + "55";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (e.invulnerable) {
      const pulse = 0.5 + 0.4 * Math.sin(performance.now() / 280);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 1.7, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(148, 163, 184, ${pulse})`;
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (e.phase === 3) {
      const pulse = 0.5 + 0.4 * Math.sin(performance.now() / 180);
      octPath(e.x, e.y, e.radius * 1.6, -t * 1.4);
      ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // body
  if (spec.shape === "hex") {
    hexPath(e.x, e.y, e.radius);
  } else if (spec.shape === "boss") {
    octPath(e.x, e.y, e.radius);
  } else {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
  }
  ctx.fillStyle = "#0a0a14";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = spec.shape === "boss" ? 3 : 2;
  ctx.stroke();

  // lifetime ring + symbol — countdown ring in the enemy's own color, turning
  // amber when time is nearly up; glyph (spec.glyph) marks the type at a glance
  if (spec.lifetime) {
    const frac = Math.max(0, e.timeLeft / spec.lifetime);
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.strokeStyle = frac < 0.3 ? "#fbbf24" : color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (spec.glyph) {
      ctx.font = "bold 16px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = color;
      ctx.shadowBlur = 9;
      ctx.fillText(spec.glyph, e.x, e.y + 1);
      ctx.shadowBlur = 0;
    }
  }

  // HP bar for all regular enemies (not bosses or bonus pickups)
  if (!spec.bonus && spec.shape !== "boss") {
    const barW = e.radius * 1.8;
    const barH = 3;
    const barX = e.x - barW / 2;
    const barY = e.y + e.radius + 5;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, barW * Math.max(0, e.hp / e.maxHp), barH);
  }

  // boss: HP bar + tier label (with rage marker in phase 3)
  if (spec.shape === "boss") {
    ctx.font = "bold 12px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const bDef = getBossDef(e);
    if (bDef.drawLabel) {
      bDef.drawLabel(ctx, e);
    } else {
      ctx.fillStyle = e.phase === 3 ? "#fecaca" : "rgba(255, 255, 255, 0.85)";
      ctx.fillText(bDef.label(e), e.x, e.y - 6);
    }

    const barW = e.radius * 1.5;
    const barH = 6;
    const barX = e.x - barW / 2;
    const barY = e.y + e.radius * 0.45;
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = e.phase === 3 ? "#ef4444" : color;
    ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
  }

  // equation label: hidden for invulnerable boss; mirrored when boss is active
  if (e.type === "boss") {
    if (!e.invulnerable) {
      const mirror = getBossDef(e).mirrorEquation === true;
      drawEquation(ctx, { cx: e.x, baselineY: e.y - e.radius - 8, text: e.text, color, mirror });
    }
  } else {
    drawEquation(ctx, { cx: e.x, baselineY: e.y - e.radius - 8, text: e.text, color });
  }

  // optional per-boss custom visuals (neither current boss needs it)
  if (spec.shape === "boss") getBossDef(e).draw?.(e, ctx);

  ctx.restore();
}

function drawLanesAndDangerLine() {
  if (!state.started) return;
  // lane guides — very subtle vertical strips
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = "#67e8f9";
  const laneW = Math.min(160, W / 4);
  for (let i = 0; i < NUM_LANES; i++) {
    const cx = laneX(i);
    ctx.fillRect(cx - laneW / 2, 0, laneW, playerY);
  }
  ctx.restore();

  // danger line at the player's y — if an enemy crosses this, the player
  // loses a life. Layered: red warning gradient band above, then a bold
  // pulsing dashed hazard line. Hard to miss.
  const lineY = playerY;
  ctx.save();
  const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 380);

  // warning gradient band fading up from the line
  const bandH = 36;
  const grad = ctx.createLinearGradient(0, lineY - bandH, 0, lineY);
  grad.addColorStop(0, "rgba(239, 68, 68, 0)");
  grad.addColorStop(1, `rgba(239, 68, 68, ${0.18 + 0.10 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, lineY - bandH, W, bandH);

  // main dashed hazard line
  ctx.shadowColor = "rgba(239, 68, 68, 1)";
  ctx.shadowBlur = 18;
  ctx.strokeStyle = `rgba(255, 80, 80, ${0.85 + 0.15 * pulse})`;
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 8]);
  ctx.lineDashOffset = -(performance.now() / 60) % 22;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(W, lineY);
  ctx.stroke();
  ctx.setLineDash([]);

  // bright inner highlight to make the line read crisp even with the glow
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `rgba(255, 220, 220, ${0.6 + 0.2 * pulse})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([14, 8]);
  ctx.lineDashOffset = -(performance.now() / 60) % 22;
  ctx.beginPath();
  ctx.moveTo(0, lineY);
  ctx.lineTo(W, lineY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

// Draw curved connecting paths between level nodes in the world map
function renderLevelMapPaths() {
  const svg = document.querySelector(".levelMapSvg");
  if (!svg) return;

  const nodes = Array.from(document.querySelectorAll(".levelMap .node[data-level]"));
  if (nodes.length < 2) return;

  // Clear previous paths
  svg.querySelectorAll("path").forEach((p) => p.remove());

  // Draw bezier curves connecting consecutive nodes
  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i].getBoundingClientRect();
    const to = nodes[i + 1].getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();

    // Convert to SVG coordinate space (relative to levelMap)
    const fromX = from.left - svgRect.left + from.width / 2;
    const fromY = from.top - svgRect.top + from.height / 2;
    const toX = to.left - svgRect.left + to.width / 2;
    const toY = to.top - svgRect.top + to.height / 2;

    // Quadratic bezier curve with control point offset horizontally
    const midY = (fromY + toY) / 2;
    const cpX = (fromX + toX) / 2 + 40; // offset control point to create curve
    const cpY = midY;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      `M ${fromX} ${fromY} Q ${cpX} ${cpY} ${toX} ${toY}`
    );
    path.setAttribute("stroke", "rgba(148, 163, 184, 0.3)");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-dasharray", "8 4");
    svg.appendChild(path);
  }
}

// ---------- menu screens (home + world selection), driven by saved progress

function renderHomeScreen() {
  const f = progress.getFurthest();
  homeWorldKickerEl.textContent = `World ${f.world}`;
  homeWorldNameEl.textContent = WORLD_NAMES[f.world] || `World ${f.world}`;
  const done = progress.completedInWorld(f.world);
  homeWorldFillEl.style.width = `${((done / LEVELS_PER_WORLD) * 100).toFixed(0)}%`;
  homeWorldProgressEl.textContent = `${done}/${LEVELS_PER_WORLD}`;
  homeStarsEl.textContent = String(progress.getTotalStars());
  const lvlLabel = f.level >= LEVELS_PER_WORLD ? "Boss" : `Level ${f.level}`;
  const verb = progress.getTotalPoints() > 0 ? "Continue" : "Start";
  homePlaySubEl.textContent = `${verb} · ${lvlLabel}`;

  const { level: pl, xpIn, threshold } = xpProgressInLevel(progress.getTotalXP());
  const { min: dmgBonusMin, max: dmgBonusMax } = playerDamageBonus(pl);
  homePlayerDmgEl.textContent = `${PLAYER_DAMAGE_MIN + dmgBonusMin}–${PLAYER_DAMAGE_MAX + dmgBonusMax}`;
  if (pl < MAX_PLAYER_LEVEL) {
    const { min: nextMin, max: nextMax } = playerDamageBonus(pl + 1);
    const deltaMin = nextMin - dmgBonusMin;
    const deltaMax = nextMax - dmgBonusMax;
    homePlayerDmgSubEl.textContent = deltaMin === deltaMax
      ? `next level: +${deltaMin}`
      : `next level: +${deltaMin}–+${deltaMax}`;
  } else {
    homePlayerDmgSubEl.textContent = "max level";
  }
  homeMaxHpEl.textContent = String(MAX_HP + playerHpBonus(pl));
  if (pl < MAX_PLAYER_LEVEL) {
    homeMaxHpSubEl.textContent = `next level: +${playerHpBonus(pl + 1) - playerHpBonus(pl)}`;
  } else {
    homeMaxHpSubEl.textContent = "max level";
  }
  if (pl < MAX_PLAYER_LEVEL) {
    homeXpFillEl.style.width = `${((xpIn / threshold) * 100).toFixed(1)}%`;
    homeXpLabelEl.textContent = `${xpIn} / ${threshold} XP · Lv ${pl + 1}`;
  } else {
    homeXpFillEl.style.width = "100%";
    homeXpLabelEl.textContent = `Max level · Lv ${pl + 1}`;
  }

  const user = getCurrentUser();
  if (user?.email) {
    const name = user.email.split("@")[0];
    profileNameEl.textContent = name;
    profileAvatarEl.textContent = name.charAt(0).toUpperCase();
  }
  profileStarsEl.textContent = `Lv ${pl + 1}`;
}

function renderWorldScreen() {
  const w = state.currentWorld;
  worldNavTitleEl.textContent = `World ${w}`;
  worldHeaderKickerEl.textContent = `World ${w}`;
  worldHeaderNameEl.textContent = WORLD_NAMES[w] || `World ${w}`;
  worldStarBadgeEl.textContent = String(progress.starsInWorld(w));
  worldPrevBtnEl.disabled = w <= 1;
  worldNextBtnEl.disabled = w >= NUM_WORLDS;

  const done = progress.completedInWorld(w);
  worldProgressFillEl.style.width = `${((done / LEVELS_PER_WORLD) * 100).toFixed(0)}%`;
  worldProgressTextEl.textContent = `${done}/${LEVELS_PER_WORLD} levels`;

  // keep the selection valid for this world
  if (!progress.isUnlocked(w, state.selectedLevel)) {
    state.selectedLevel = progress.defaultLevel(w);
  }

  const totalStars = progress.getTotalStars();
  for (let l = 1; l <= LEVELS_PER_WORLD; l++) {
    const wrapper = document.querySelector(`.levelNodeWrapper[data-level="${l}"]`);
    if (!wrapper) continue;
    const node = wrapper.querySelector(".node");
    const isBoss = l === LEVELS_PER_WORLD;
    const unlocked   = progress.isUnlocked(w, l);
    const completed  = progress.isCompleted(w, l);
    const pathOk     = progress.isPathAccessible(w, l);

    node.dataset.unlocked = unlocked ? "true" : "false";
    // padlock only when path itself is blocked; star-gated shows number dimly
    node.classList.toggle("locked",    !pathOk);
    node.classList.toggle("starGated", pathOk && !unlocked);
    node.classList.toggle("done",      completed && !isBoss);
    node.classList.toggle("boss",      isBoss);
    node.classList.toggle("current",   unlocked && !completed && !isBoss);
    node.classList.toggle("selected",  l === state.selectedLevel);

    const stars = progress.getStars(w, l);
    const starRow = wrapper.querySelector(".levelStars");
    starRow.querySelectorAll(".star").forEach((s, i) => s.classList.toggle("filled", i < stars));
    starRow.style.visibility = completed ? "visible" : "hidden";

    // star requirement badge — always shows total/required even when met
    const reqEl = wrapper.querySelector(".reqLabel");
    if (reqEl) {
      const req = progress.starRequirement(w, l);
      if (req === 0) {
        reqEl.hidden = true;
      } else {
        reqEl.hidden = false;
        reqEl.textContent = `${totalStars} / ${req} ★`;
        reqEl.className = unlocked ? "reqLabel met" : "reqLabel";
      }
    }
  }

  worldPlayLabelEl.textContent =
    state.selectedLevel >= LEVELS_PER_WORLD ? "Boss Level" : `Level ${state.selectedLevel}`;

  renderLevelMapPaths();
}

// ---------- HUD (DOM) updates

function renderHud() {
  const hpRatio = state.hp / state.maxHp;
  livesEl.style.color = hpRatio > 0.5 ? "#f8fafc" : hpRatio > 0.25 ? "#fbbf24" : "#ef4444";
  livesEl.textContent = `♥ ${state.hp}/${state.maxHp}`;
  if (state.bossLevel) {
    waveTextEl.innerHTML = `<b>BOSS</b>`;
  } else {
    waveTextEl.innerHTML = `Wave <b>${state.wave}</b>/${state.totalWaves}`;
  }
  const cp = cycleProgress();
  waveFillEl.style.clipPath = `inset(0 ${((1 - cp) * 100).toFixed(2)}% 0 0)`;
  // boss levels show a continuous red HP-style bar with no segment ticks;
  // regular (2-wave) levels show a single mid-point tick.
  waveBarEl.classList.toggle("boss", state.bossLevel);
  tick1El.hidden = state.bossLevel;
  tick2El.hidden = true;  // only one tick now (mid-level), tick2 unused
  tick1El.classList.toggle("passed", cp >= 0.5);
  // pre-game menu: show home or world-selection; both hide once a run starts
  const inMenu = !state.started && !state.gameOver;
  homeScreenEl.hidden = !(inMenu && state.menuScreen === "home");
  worldScreenEl.hidden = !(inMenu && state.menuScreen === "world");
  gameOverEl.hidden = !state.gameOver;

  if (inMenu && state.menuScreen === "home") renderHomeScreen();
  if (inMenu && state.menuScreen === "world") renderWorldScreen();
  bossAlertEl.hidden = state.bossAlertTimer <= 0;
  pausedEl.hidden = !state.paused;

  // wave announce flashes the new wave number when levelUpTimer is active.
  // Suppress it on boss waves so it doesn't overlap the BOSS alert.
  if (state.levelUpTimer > 0 && !isBossWave()) {
    waveAnnounceEl.textContent = `WAVE ${state.wave}`;
    waveAnnounceEl.hidden = false;
  } else {
    waveAnnounceEl.hidden = true;
  }

  // breather overlay
  if (state.started && !state.gameOver && state.wavePhase === "breather") {
    breatherEl.hidden = false;
    breatherCountEl.textContent = String(Math.max(1, Math.ceil(state.waveTimer)));
  } else {
    breatherEl.hidden = true;
  }

  // streak chip
  if (state.streak >= 2) {
    streakEl.hidden = false;
    streakValueEl.textContent = String(state.streak);
    const mult = streakMult();
    streakMultEl.textContent = mult > 1 ? `×${mult}` : "";
    streakEl.className = "";
    const tier = streakTierClass();
    if (tier) streakEl.classList.add(tier);
  } else {
    streakEl.hidden = true;
  }

  // score readout (tier color + pop on increment; multiplier badge lives on the streak chip)
  scoreValueEl.textContent = state.score.toLocaleString("en-US");
  scoreHudEl.className = "";
  const sTier = streakTierClass();
  if (sTier) scoreHudEl.classList.add(sTier);
  if (state.scorePopTimer > 0) scoreHudEl.classList.add("pop");

  if (state.input === "") {
    inputBoxEl.hidden = true;
  } else {
    inputBoxEl.hidden = false;
    inputValueEl.textContent = state.input;
  }
}

// ---------- frame

export function render() {
  ctx.fillStyle = state.flashTimer > 0 ? "#3a0a14" : "#0a0a14";
  ctx.fillRect(0, 0, W, H);

  drawGrid();
  drawLanesAndDangerLine();

  let shakeX = 0, shakeY = 0;
  if (state.shakeTimer > 0) {
    const m = state.shakeTimer * 30;
    shakeX = (Math.random() - 0.5) * m;
    shakeY = (Math.random() - 0.5) * m;
  }
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // lasers behind enemies
  for (const l of state.lasers) {
    const t = l.life / l.maxLife;
    ctx.save();
    ctx.globalAlpha = t;
    ctx.strokeStyle = "#67e8f9";
    ctx.shadowColor = "#67e8f9";
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2 + 5 * t;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(playerX, playerY);
    ctx.lineTo(l.x, l.y);
    ctx.stroke();
    ctx.restore();
  }

  for (const e of state.enemies) drawEnemy(e);

  // death pops on top
  for (const d of state.deaths) {
    const t = 1 - d.life / d.maxLife;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius * (1 + t * 1.6), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius * (1 + t * 0.8), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // floating damage numbers with a small impact burst icon
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const d of state.damageNums) {
    const t = 1 - d.life / d.maxLife;
    const alpha = Math.max(0, 1 - t * 1.4);
    const rise = t * 38;
    const numColor = d.value === 0 ? "#93c5fd" : "#ffffff";
    ctx.save();
    ctx.globalAlpha = alpha;

    // 4-ray burst icon to the left of the number
    const bx = d.x - 14, by = d.y - rise;
    const br = 5 + (1 - t) * 2;  // slightly larger when fresh
    ctx.strokeStyle = d.value === 0 ? "#93c5fd" : "#facc15";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let r = 0; r < 4; r++) {
      const a = (r / 4) * Math.PI;
      ctx.moveTo(bx + Math.cos(a) * br, by + Math.sin(a) * br);
      ctx.lineTo(bx - Math.cos(a) * br, by - Math.sin(a) * br);
    }
    ctx.stroke();

    ctx.font = `bold 17px ui-monospace, Menlo, monospace`;
    ctx.fillStyle = numColor;
    ctx.fillText(String(d.value), d.x + 6, d.y - rise);
    ctx.restore();
  }

  ctx.restore();

  // wrong-answer red vignette: pulses across the whole screen so feedback is
  // visible even when no enemies are on screen
  if (state.wrongFlashTimer > 0) {
    const k = Math.min(1, state.wrongFlashTimer / WRONG_FLASH_DURATION);
    ctx.save();
    ctx.fillStyle = `rgba(239, 68, 68, ${0.28 * k})`;
    ctx.fillRect(0, 0, W, H);
    // brighter border ring for emphasis
    const bw = 14;
    ctx.fillStyle = `rgba(239, 68, 68, ${0.55 * k})`;
    ctx.fillRect(0, 0, W, bw);
    ctx.fillRect(0, H - bw, W, bw);
    ctx.fillRect(0, 0, bw, H);
    ctx.fillRect(W - bw, 0, bw, H);
    ctx.restore();
  }

  // freeze overlay
  if (state.freezeTimer > 0) {
    const fade = Math.min(1, state.freezeTimer / 0.4);
    ctx.save();
    ctx.fillStyle = `rgba(125, 211, 252, ${0.16 * fade})`;
    ctx.fillRect(0, 0, W, H);
    // frosty edges
    const edge = 60;
    const grad = ctx.createLinearGradient(0, 0, 0, edge);
    grad.addColorStop(0, `rgba(186, 230, 253, ${0.55 * fade})`);
    grad.addColorStop(1, "rgba(186, 230, 253, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, edge);
    const grad2 = ctx.createLinearGradient(0, H - edge, 0, H);
    grad2.addColorStop(0, "rgba(186, 230, 253, 0)");
    grad2.addColorStop(1, `rgba(186, 230, 253, ${0.55 * fade})`);
    ctx.fillStyle = grad2;
    ctx.fillRect(0, H - edge, W, edge);

    // countdown text
    ctx.font = "bold 22px ui-monospace, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = `rgba(224, 242, 254, ${0.9 * fade})`;
    ctx.shadowColor = "#7dd3fc";
    ctx.shadowBlur = 14;
    ctx.fillText(`❄ ${state.freezeTimer.toFixed(1)}s`, W / 2, 120);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  renderHud();
}
