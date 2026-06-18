// User progress: an in-memory cache of per-level results plus the derived
// unlock/current/total state the menus read. Backed by Supabase via db.js and
// keyed to the signed-in user from auth.js.

import {
  LEVELS_PER_WORLD, NUM_WORLDS,
  xpProgressInLevel, MAX_PLAYER_LEVEL,
} from "../core/config.js";
import { getCurrentUser } from "./auth.js";
import * as db from "./db.js";

let userId = null;
// key "world:level" -> { stars, score, completed }
const cache = new Map();
let totalPoints = 0;
let totalXP = 0;  // loaded from profile, not derived from stars
let ready = false;

const key = (w, l) => `${w}:${l}`;

// Load the user's profile + all level progress into the cache.
export async function initProgress() {
  const user = getCurrentUser();
  if (!user) return;
  userId = user.id;

  const profile = await db.getOrCreateUser(userId);
  totalXP = profile?.total_xp ?? 0;
  const rows = await db.getAllProgress(userId);

  cache.clear();
  for (const r of rows) cache.set(key(r.world, r.level), r);
  recomputeTotals();
  ready = true;
}

function recomputeTotals() {
  let pts = 0;
  for (const r of cache.values()) pts += r.score || 0;
  totalPoints = pts;
  // totalXP is managed separately (loaded from profile, updated on win)
}

// Persist a level win. xpEarned is computed by the caller (stars × diff scale).
export async function recordLevelWin(world, level, score, stars, xpEarned = 0) {
  if (!userId) return;
  const saved = await db.saveLevelProgress(userId, world, level, stars, score);
  if (saved) cache.set(key(world, level), saved);
  recomputeTotals();
  totalXP += xpEarned;
  db.updateUserProfile(userId, {
    total_points: totalPoints,
    total_xp: totalXP,
    current_world: getFurthest().world,
  });
}

// --- derived getters (read synchronously by the renderer) ---

export function isReady() {
  return ready;
}

export function getLevelResult(world, level) {
  return cache.get(key(world, level)) || null;
}

export function getStars(world, level) {
  const r = cache.get(key(world, level));
  return r ? r.stars : 0;
}

export function isCompleted(world, level) {
  const r = cache.get(key(world, level));
  return !!(r && r.completed);
}

// Global star requirement to unlock a given level.
// Uses absolute level index: (world-1)*5 + level - 1, times 2.
// W1L1=0, W1L2=2, W1L5=8, W2L1=10, W2L2=12 …
export function starRequirement(world, level) {
  const abs = (world - 1) * LEVELS_PER_WORLD + level - 1;
  return abs * 2;
}

// Whether the previous level in the sequence has been cleared (path is open).
export function isPathAccessible(world, level) {
  if (world === 1 && level === 1) return true;
  if (level === 1) return isCompleted(world - 1, LEVELS_PER_WORLD);
  return isCompleted(world, level - 1);
}

// Fully unlocked = path accessible AND star threshold met (or already beaten).
export function isUnlocked(world, level) {
  if (isCompleted(world, level)) return true;
  return isPathAccessible(world, level) && getTotalStars() >= starRequirement(world, level);
}

// Count of completed levels in a world (for the world progress bar).
export function completedInWorld(world) {
  let n = 0;
  for (let l = 1; l <= LEVELS_PER_WORLD; l++) if (isCompleted(world, l)) n++;
  return n;
}

// Total stars earned in a world.
export function starsInWorld(world) {
  let n = 0;
  for (let l = 1; l <= LEVELS_PER_WORLD; l++) n += getStars(world, l);
  return n;
}

export function getTotalPoints() {
  return totalPoints;
}

export function getTotalXP() {
  return totalXP;
}

// 0-based internal level; display as (playerLevel + 1)
export function getPlayerLevel() {
  return xpProgressInLevel(totalXP).level;
}

export function getTotalStars() {
  let n = 0;
  for (const r of cache.values()) n += r.stars || 0;
  return n;
}

// The level to preselect when viewing a world: the first unlocked-but-unbeaten
// level, or the highest unlocked level if the world is fully cleared.
export function defaultLevel(world) {
  let highestUnlocked = 1;
  for (let l = 1; l <= LEVELS_PER_WORLD; l++) {
    if (!isUnlocked(world, l)) break;
    highestUnlocked = l;
    if (!isCompleted(world, l)) return l;
  }
  return highestUnlocked;
}

// XP eligibility: only the frontier level and the one directly below it give
// full XP. Anything further back gives nothing.
export function replayXpInfo(world, level) {
  const frontier = getFurthest();
  const playedAbs   = (world - 1) * LEVELS_PER_WORLD + level;
  const frontierAbs = (frontier.world - 1) * LEVELS_PER_WORLD + frontier.level;
  const dist  = Math.max(0, frontierAbs - playedAbs);
  const scale = dist <= 1 ? 1 : 0;
  return { dist, scale };
}

// The furthest reached (first uncompleted unlocked) level — drives "Continue".
export function getFurthest() {
  for (let w = 1; w <= NUM_WORLDS; w++) {
    for (let l = 1; l <= LEVELS_PER_WORLD; l++) {
      if (isUnlocked(w, l) && !isCompleted(w, l)) return { world: w, level: l };
    }
  }
  return { world: NUM_WORLDS, level: LEVELS_PER_WORLD };
}
