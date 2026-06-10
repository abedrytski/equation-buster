// User progress: an in-memory cache of per-level results plus the derived
// unlock/current/total state the menus read. Backed by Supabase via db.js and
// keyed to the signed-in user from auth.js.

import { LEVELS_PER_WORLD, NUM_WORLDS } from "../core/config.js";
import { getCurrentUser } from "./auth.js";
import * as db from "./db.js";

let userId = null;
// key "world:level" -> { stars, score, completed }
const cache = new Map();
let totalPoints = 0;
let ready = false;

const key = (w, l) => `${w}:${l}`;

// Load the user's profile + all level progress into the cache.
export async function initProgress() {
  const user = getCurrentUser();
  if (!user) return;
  userId = user.id;

  await db.getOrCreateUser(userId);
  const rows = await db.getAllProgress(userId);

  cache.clear();
  for (const r of rows) cache.set(key(r.world, r.level), r);
  recomputeTotals();
  ready = true;
}

function recomputeTotals() {
  let sum = 0;
  for (const r of cache.values()) sum += r.score || 0;
  totalPoints = sum;
}

// Persist a level win, raising the cached best result and totals.
export async function recordLevelWin(world, level, score, stars) {
  if (!userId) return;
  const saved = await db.saveLevelProgress(userId, world, level, stars, score);
  if (saved) cache.set(key(world, level), saved);
  recomputeTotals();
  // keep the profile's headline number in sync (no ranking, just the total)
  db.updateUserProfile(userId, {
    total_points: totalPoints,
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

// A level is unlocked if it's the very first level, the previous level in the
// same world is done, or it's the first level of a world whose predecessor is
// fully cleared.
export function isUnlocked(world, level) {
  if (world === 1 && level === 1) return true;
  if (level > 1) return isCompleted(world, level - 1);
  return isCompleted(world - 1, LEVELS_PER_WORLD);
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

// The furthest reached (first uncompleted unlocked) level — drives "Continue".
export function getFurthest() {
  for (let w = 1; w <= NUM_WORLDS; w++) {
    for (let l = 1; l <= LEVELS_PER_WORLD; l++) {
      if (isUnlocked(w, l) && !isCompleted(w, l)) return { world: w, level: l };
    }
  }
  return { world: NUM_WORLDS, level: LEVELS_PER_WORLD };
}
