// Resolving an answer against the enemies: scoring, kills, multi-HP regen,
// summoner damage, the wrong-answer punishment, and ending the run.

import { state } from "../core/state.js";
import { WRONG_FLASH_DURATION, WRONG_PUSH_PX, SHUFFLE_CHIPS_ON_ANSWER, xpProgressInLevel } from "../core/config.js";
import { randInt } from "../core/equations.js";
import { getEnemyDef } from "./enemies/index.js";
import { gainScore, computeStars } from "./waves.js";
import { spawnDeath, sharedEq } from "./entities.js";
import { getBossDef } from "./bosses/index.js";
import { rebuildChips } from "./chips.js";
import {
  gameOverTitleEl, finalScoreEl, victoryStarsEl,
  xpGainEl, xpGainAmtEl, xpGainFillEl, xpGainLevelEl, xpReplayTipEl,
} from "../core/dom.js";
import { recordLevelWin, getTotalXP, getPlayerLevel, replayXpInfo } from "../lib/progress.js";
import { getDifficultyMult, xpForStarsAndDiff } from "../lib/settings.js";
import { playLaser, playLevelSuccess, playGameOver } from "../ui/audio.js";
import { playHit, playWrong } from "../ui/sfx.js";

let _xpAnimTimeout = null;

export function endGame(title, victory, xpInfo = null) {
  state.gameOver = true;
  if (_xpAnimTimeout) { clearTimeout(_xpAnimTimeout); _xpAnimTimeout = null; }

  gameOverTitleEl.textContent = title;
  gameOverTitleEl.classList.toggle("victory", victory);
  finalScoreEl.textContent = `Score: ${state.score.toLocaleString("en-US")} · Best streak: ${state.bestStreak}`;

  if (victory) {
    playLevelSuccess();
    const stars = state.lastStars;
    const starEls = victoryStarsEl.querySelectorAll(".vStar");
    starEls.forEach((el, i) => el.classList.toggle("earned", i < stars));
    victoryStarsEl.hidden = false;
    // restart the staggered pop-in animation from scratch each win
    victoryStarsEl.classList.remove("show");
    void victoryStarsEl.offsetWidth; // force reflow so the animation replays
    victoryStarsEl.classList.add("show");
  } else {
    playGameOver();
    victoryStarsEl.hidden = true;
    victoryStarsEl.classList.remove("show");
  }

  // XP gain bar (victory only)
  xpGainEl.classList.remove("visible");
  xpGainAmtEl.classList.remove("levelUp", "zero");
  if (victory && xpInfo) {
    const { xpEarned, xpBefore, levelBefore, dist } = xpInfo;
    const xpAfter = xpBefore + xpEarned;
    const { level: levelAfter, xpIn: xpInAfter, threshold: thresholdAfter } = xpProgressInLevel(xpAfter);
    const { xpIn: xpInBefore, threshold: thresholdBefore } = xpProgressInLevel(xpBefore);
    const leveledUp = levelAfter > levelBefore;

    const oldPct = thresholdBefore > 0 ? (xpInBefore / thresholdBefore) * 100 : 0;
    const newPct = thresholdAfter > 0 ? (xpInAfter / thresholdAfter) * 100 : 100;

    xpGainAmtEl.textContent = `+${xpEarned} XP`;
    xpGainAmtEl.classList.toggle("zero", xpEarned === 0);
    xpGainLevelEl.textContent = leveledUp
      ? `LEVEL UP! ▲ Lv ${levelAfter + 1}`
      : `Lv ${levelAfter + 1} · ${xpInAfter} / ${thresholdAfter} XP`;
    xpReplayTipEl.hidden = xpEarned > 0;

    // Set bar to pre-win position while still invisible
    xpGainFillEl.style.transition = "none";
    xpGainFillEl.style.width = `${oldPct.toFixed(1)}%`;
    xpGainEl.hidden = false;

    _xpAnimTimeout = setTimeout(() => {
      xpGainEl.classList.add("visible");
      void xpGainFillEl.offsetWidth; // reflow so transition fires
      xpGainFillEl.style.transition = "width 0.9s cubic-bezier(0.1, 0, 0.2, 1)";
      xpGainFillEl.style.width = `${newPct.toFixed(1)}%`;
      if (leveledUp) xpGainAmtEl.classList.add("levelUp");
    }, 1800);
  } else {
    xpGainEl.hidden = true;
  }
}

// Called when a level is cleared. Computes the star rating, persists progress
// for the signed-in user, then shows the victory screen.
export function winLevel() {
  const stars = computeStars();
  state.lastStars = stars;

  // Capture state before the win so we can animate the XP gain
  const xpBefore    = getTotalXP();
  const levelBefore = getPlayerLevel();

  // XP decays when replaying levels below the frontier (0.85 per level behind)
  const { dist, scale } = replayXpInfo(state.selectedWorld, state.selectedLevel);
  const xpEarned = Math.round(xpForStarsAndDiff(stars, getDifficultyMult()) * scale);

  recordLevelWin(state.selectedWorld, state.selectedLevel, state.score, stars, xpEarned);
  endGame("Level Complete!", true, { xpEarned, xpBefore, levelBefore, dist });
}

// Apply a bonus enemy's on-kill `effect` payload (see TYPES bonus entries).
// Each effect kind is one branch here; a new bonus that reuses an existing
// kind needs no change, only a genuinely new kind does.
function applyKillEffect(effect) {
  if (effect.freeze) state.freezeTimer = effect.freeze;
  if (effect.heal) state.hp = Math.min(state.maxHp, state.hp + effect.heal);
}

export function fireAnswer(answer) {
  const matches = [];
  for (let i = 0; i < state.enemies.length; i++) {
    const en = state.enemies[i];
    if (en.invulnerable) continue;
    if (en.answer === answer) matches.push(i);
  }

  if (matches.length === 0) {
    playWrong();
    state.shakeTimer = 0.45;
    state.wrongFlashTimer = 0.4;
    state.streak = 0;
    // wrong answer punishment: nudge every moving threat closer to the player
    // and flash every enemy (including orbiting minis and stationary ice) so
    // the player gets feedback regardless of which enemies are on screen.
    for (const en of state.enemies) {
      en.pushFlash = WRONG_FLASH_DURATION;
      if (en.type === "mini") continue;     // orbit position is recomputed each frame
      if (en.speed === 0) continue;          // ice doesn't approach
      en.y += WRONG_PUSH_PX;
    }
    if (SHUFFLE_CHIPS_ON_ANSWER) rebuildChips(true);
    return false;
  }

  state.streak += 1;
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;

  const killedMinions = [];
  for (let k = matches.length - 1; k >= 0; k--) {
    const idx = matches[k];
    const e = state.enemies[idx];
    const spec = getEnemyDef(e);

    state.lasers.push({
      x: e.x, y: e.y,
      life: 0.15, maxLife: 0.15,
    });

    // Shield intercepts the first hit — no HP damage, 4 s regen.
    if (e.shielded) {
      e.shielded = false;
      e.shieldRegenTimer = 0;
      state.damageNums.push({ x: e.x, y: e.y - e.radius - 10, value: 0, life: 0.7, maxLife: 0.7 });
      const oldAnswer = e.answer;
      let eq = sharedEq(() => spec.eq(state.config.maxNum), e);
      for (let tries = 0; tries < 20 && eq.answer === oldAnswer; tries++)
        eq = sharedEq(() => spec.eq(state.config.maxNum), e);
      e.text = eq.text; e.answer = eq.answer;
      continue;
    }

    const dmg = randInt(state.playerDamageMin, state.playerDamageMax);
    state.damageNums.push({ x: e.x, y: e.y - e.radius - 10, value: dmg, life: 0.7, maxLife: 0.7 });
    e.hp -= dmg;

    if (e.hp <= 0) {
      playLaser();
      spawnDeath(e, 0.35);
      state.enemies.splice(idx, 1);
      if (spec.awardsScore !== false) gainScore(e.value);
      if (spec.effect) applyKillEffect(spec.effect);
      if (e.parent) killedMinions.push(e);
    } else {
      playHit();
      const oldAnswer = e.answer;
      const genEq = () => {
        if (e.type === "boss") return getBossDef(e).regenEquation(e);
        return sharedEq(() => spec.eq(state.config.maxNum), e);
      };
      let eq = genEq();
      for (let tries = 0; tries < 20 && eq.answer === oldAnswer; tries++) eq = genEq();
      e.text = eq.text;
      e.answer = eq.answer;
    }
  }

  // Boss-side consequences of minion deaths — the Mirror activates on its last
  // mini, the Summoner loses HP per summon and dies when drained. Deferred so
  // the matches-by-index loop above stays valid.
  for (const m of killedMinions) {
    if (state.enemies.includes(m.parent)) getBossDef(m.parent).onMinionKilled(m.parent, m);
  }

  rebuildChips(SHUFFLE_CHIPS_ON_ANSWER);
  return true;
}

export function fireInput() {
  if (state.input === "") return;
  const answer = parseInt(state.input, 10);
  fireAnswer(answer);
  state.input = "";
}
