// The per-frame simulation step: wave phase machine, spawning cadence, effect
// timers, summoner top-up, and the big enemy loop (movement, queue-up, danger
// line). Pure simulation — no drawing.

import { state } from "../core/state.js";
import { laneX, playerX, playerY } from "../core/view.js";
import {
  BREATHER_DURATION, SPAWN_FADE_DURATION,
  LANE_SEPARATION_GAP, SHIELD_REGEN_TIME,
} from "../core/config.js";
import { TYPES } from "./enemies/index.js";
import {
  isBossWave, waveValueBudget, maxEnemiesForWave,
  spawnIntervalForWave, waveSpeedFactor, announceWave,
} from "./waves.js";
import { spawnEnemy } from "./entities.js";
import { getBossDef } from "./bosses/index.js";
import { winLevel, endGame } from "./combat.js";
import { rebuildChips } from "./chips.js";

export function advanceWave() {
  // regular levels only ever step between non-boss waves; the boss level spawns
  // its boss up front in startGame, so there's no in-run boss spawn here.
  state.wave += 1;
  state.wavePhase = "active";
  state.waveTimer = 0;
  state.waveValueRemaining = waveValueBudget(state.wave);
  state.bonusSpawnedThisWave = {};
  announceWave();
}

export function update(dt) {
  if (!state.started || state.gameOver || state.paused) return;

  const frozen = state.freezeTimer > 0;
  if (frozen) state.freezeTimer = Math.max(0, state.freezeTimer - dt);

  const bossAlive = state.enemies.some((e) => e.type === "boss");
  const stillSpawning = state.waveValueRemaining > 0 && !isBossWave();
  const waveCleared = !stillSpawning && state.enemies.length === 0;

  // wave phase machine (breather is allowed to tick during freeze so the freeze
  // doesn't stretch the inter-wave gap; new active-phase spawns are gated below)
  if (state.wavePhase === "active" && waveCleared) {
    if (state.wave >= state.totalWaves) {
      // level complete — show the score screen instead of advancing
      winLevel();
    } else {
      state.wavePhase = "breather";
      state.waveTimer = BREATHER_DURATION;
    }
  } else if (state.wavePhase === "breather") {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) advanceWave();
  }

  const canSpawn = state.wavePhase === "active" && stillSpawning && !bossAlive && !frozen;

  if (!frozen) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      if (canSpawn && state.enemies.length < maxEnemiesForWave(state.wave)) {
        const cost = spawnEnemy(state.waveValueRemaining);
        state.waveValueRemaining = Math.max(0, state.waveValueRemaining - cost);
      }
      state.spawnTimer = spawnIntervalForWave(state.wave, state.config);
    }
  }

  for (let i = state.lasers.length - 1; i >= 0; i--) {
    state.lasers[i].life -= dt;
    if (state.lasers[i].life <= 0) state.lasers.splice(i, 1);
  }
  for (let i = state.deaths.length - 1; i >= 0; i--) {
    state.deaths[i].life -= dt;
    if (state.deaths[i].life <= 0) state.deaths.splice(i, 1);
  }
  for (let i = state.damageNums.length - 1; i >= 0; i--) {
    state.damageNums[i].life -= dt;
    if (state.damageNums[i].life <= 0) state.damageNums.splice(i, 1);
  }

  // per-frame boss-level behavior (each boss def decides: Summoner tops up its
  // minions, Mirror checks its enrage threshold, …)
  for (const e of state.enemies) {
    if (e.type === "boss") getBossDef(e).update(e, dt, { frozen });
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    const spec = TYPES[e.type];

    if (e.pushFlash) {
      e.pushFlash = Math.max(0, e.pushFlash - dt);
    }

    if (e.spawnFade != null && e.spawnFade < 1) {
      e.spawnFade = Math.min(1, e.spawnFade + dt / SPAWN_FADE_DURATION);
    }

    // Shield regeneration for blue-type enemies.
    if (spec.hasShield && !e.shielded) {
      e.shieldRegenTimer += dt;
      if (e.shieldRegenTimer >= SHIELD_REGEN_TIME) e.shielded = true;
    }

    if (spec.lifetime) {
      if (!frozen) e.timeLeft -= dt;
      if (e.timeLeft <= 0) {
        state.enemies.splice(i, 1);
        continue;
      }
    } else if (e.orbitRadius != null) {
      // orbiting minion: circle around its parent boss. No collision damage.
      if (e.parent && state.enemies.includes(e.parent)) {
        if (!frozen) e.orbitAngle += e.orbitSpeed * dt;
        e.x = e.parent.x + Math.cos(e.orbitAngle) * e.orbitRadius;
        e.y = e.parent.y + Math.sin(e.orbitAngle) * e.orbitRadius;
      }
    } else if (!frozen) {
      // straight-down lane movement
      const v = e.speed * state.config.speedMult * waveSpeedFactor(state.wave);
      e.y += v * dt;
      // gentle x easing back toward lane center (in case of any drift)
      const targetX = laneX(e.lane != null ? e.lane : 1);
      e.x += (targetX - e.x) * Math.min(1, dt * 4);

      // queue-up: prevent overlap with the closest enemy ahead in this lane.
      // A faster enemy will stop short of the slower leader's tail.
      let leader = null;
      for (const o of state.enemies) {
        if (o === e || o.lane !== e.lane) continue;
        if (o.speed <= 0 || o.orbitRadius != null) continue;
        if (o.y <= e.y) continue;
        if (leader === null || o.y < leader.y) leader = o;
      }
      if (leader) {
        const minSep = leader.radius + e.radius + LANE_SEPARATION_GAP;
        if (leader.y - e.y < minSep) e.y = leader.y - minSep;
      }

      // collision: enemy crosses the danger line
      if (e.y + e.radius * 0.4 >= playerY) {
        state.enemies.splice(i, 1);
        // if a boss crosses the line, drag its remaining minions with it
        if (e.type === "boss") {
          for (let j = state.enemies.length - 1; j >= 0; j--) {
            if (state.enemies[j].parent === e) state.enemies.splice(j, 1);
          }
        }
        const isBoss = e.type === "boss";
        state.hp = isBoss ? 0 : Math.max(0, state.hp - (e.damage || 1));
        state.streak = 0;
        state.flashTimer = isBoss ? 0.6 : 0.35;
        state.shakeTimer = isBoss ? 0.6 : 0.35;

        if (state.hp <= 0) {
          endGame("Game Over", false);
        }
        rebuildChips();
        break;
      }
    }
  }

  if (state.flashTimer > 0) state.flashTimer -= dt;
  if (state.shakeTimer > 0) state.shakeTimer -= dt;
  if (state.wrongFlashTimer > 0) state.wrongFlashTimer -= dt;
  if (state.scorePopTimer > 0) state.scorePopTimer -= dt;
  if (state.levelUpTimer > 0) state.levelUpTimer -= dt;
  if (state.bossAlertTimer > 0) state.bossAlertTimer -= dt;
  if (state.chipLockTimer > 0) state.chipLockTimer -= dt;
}
