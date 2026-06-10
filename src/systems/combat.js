// Resolving an answer against the enemies: scoring, kills, multi-HP regen,
// summoner damage, the wrong-answer punishment, and ending the run.

import { state } from "../core/state.js";
import { WRONG_FLASH_DURATION, WRONG_PUSH_PX, SHUFFLE_CHIPS_ON_ANSWER, MAX_LIVES } from "../core/config.js";
import { getEnemyDef } from "./enemies/index.js";
import { gainScore, computeStars } from "./waves.js";
import { spawnDeath, sharedEq } from "./entities.js";
import { getBossDef } from "./bosses/index.js";
import { rebuildChips } from "./chips.js";
import { gameOverTitleEl, finalScoreEl, victoryStarsEl } from "../core/dom.js";
import { recordLevelWin } from "../lib/progress.js";

export function endGame(title, victory) {
  state.gameOver = true;
  gameOverTitleEl.textContent = title;
  gameOverTitleEl.classList.toggle("victory", victory);
  finalScoreEl.textContent = `Score: ${state.score.toLocaleString("en-US")} · Best streak: ${state.bestStreak}`;

  if (victory) {
    const stars = state.lastStars;
    const starEls = victoryStarsEl.querySelectorAll(".vStar");
    starEls.forEach((el, i) => el.classList.toggle("earned", i < stars));
    victoryStarsEl.hidden = false;
    // restart the staggered pop-in animation from scratch each win
    victoryStarsEl.classList.remove("show");
    void victoryStarsEl.offsetWidth; // force reflow so the animation replays
    victoryStarsEl.classList.add("show");
  } else {
    victoryStarsEl.hidden = true;
    victoryStarsEl.classList.remove("show");
  }
}

// Called when a level is cleared. Computes the star rating, persists progress
// for the signed-in user, then shows the victory screen.
export function winLevel() {
  const stars = computeStars();
  state.lastStars = stars;
  recordLevelWin(state.selectedWorld, state.selectedLevel, state.score, stars);
  endGame("Level Complete!", true);
}

// Apply a bonus enemy's on-kill `effect` payload (see TYPES bonus entries).
// Each effect kind is one branch here; a new bonus that reuses an existing
// kind needs no change, only a genuinely new kind does.
function applyKillEffect(effect) {
  if (effect.freeze) state.freezeTimer = effect.freeze;
  if (effect.heal) state.lives = Math.min(MAX_LIVES, state.lives + effect.heal);
}

export function fireAnswer(answer) {
  const matches = [];
  for (let i = 0; i < state.enemies.length; i++) {
    const en = state.enemies[i];
    if (en.invulnerable) continue;
    if (en.answer === answer) matches.push(i);
  }

  if (matches.length === 0) {
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

    e.hp -= 1;
    if (e.hp <= 0) {
      spawnDeath(e, 0.35);
      state.enemies.splice(idx, 1);
      if (spec.awardsScore !== false) gainScore(e.value);
      if (spec.effect) applyKillEffect(spec.effect);
      // minions (mini/summon) carry a parent boss; defer the boss-side
      // consequence until after this index-sensitive splice loop.
      if (e.parent) killedMinions.push(e);
    } else {
      // regenerate equation; guarantee a different answer so the player
      // cannot kill multi-HP enemies by spamming the same chip
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
