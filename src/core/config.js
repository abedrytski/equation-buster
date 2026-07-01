// Tunables + static data tables. The single place to balance the game.
// Enemy descriptors live in ../systems/enemies/ (one file each); their per-level
// spawn counts and the math difficulty are tuned here via LEVEL_PLAN.

// ---------- core tunables

export const MAX_HP = 10;
export const PLAYER_DAMAGE_MIN = 13;
export const PLAYER_DAMAGE_MAX = 15;
export const HEART_HEAL = 3;
export const SHIELD_REGEN_TIME = 4;
export const MAX_INPUT_LEN = 4;
export const MAX_CHIPS = 6;
// Hard ceiling on simultaneous on-screen enemies, across all difficulties.
// Keeps the chip row readable and leaves slots for confusable decoys.
export const MAX_ENEMIES = 4;
// When true, every answer (right or wrong) reshuffles the chip positions so
// the player can't memorize a slot. Set to false to keep positions stable.
export const SHUFFLE_CHIPS_ON_ANSWER = true;
export const CHIP_WRONG_LOCK = 0.35;
export const WRONG_PUSH_PX = 22;
export const WRONG_FLASH_DURATION = 0.4;
export const GRID_SIZE = 56;
export const FREEZE_DURATION = 5;

// ---------- lanes

export const LANE_X_FRACTIONS = [0.22, 0.50, 0.78];
export const NUM_LANES = LANE_X_FRACTIONS.length;

// player line sits this far above the chip bar
export const PLAYER_LINE_GAP = 70;

// ---------- waves

export const BREATHER_DURATION = 4;    // seconds between waves

// ---------- world / level structure
// A world has LEVELS_PER_WORLD levels. Each regular level is WAVES_PER_LEVEL
// short waves; the final level of a world is a single boss fight (no waves).
export const LEVELS_PER_WORLD = 5;
export const WAVES_PER_LEVEL = 2;
export const NUM_WORLDS = 3;

// Display names per world (index 0 unused; worlds are 1-based).
export const WORLD_NAMES = [
  "",
  "Summy Meadow",
  "Reflection Hollow",
  "Variable Heights",
  "Times-Table Valley",
  "Division Desert",
  "Fraction Falls",
];

// streak tiers: [minCount, multiplier, cssTier]
export const STREAK_TIERS = [
  { min: 3,  mult: 2, tier: "tier2" },
  { min: 10, mult: 3, tier: "tier3" },
  { min: 20, mult: 5, tier: "tier4" },
];

// ---------- level plan (world → level → enemy proportions + difficulty)
//
// The single index that drives a level: who spawns and how hard the math is.
// Replaces the old per-wave SPAWN_TABLE — levels are only WAVES_PER_LEVEL waves
// now, and both waves of a level share one plan.
//
//   lp(maxNum, additional_terms, hp_mult, spawn)
//     maxNum           — difficulty axis 1: ceiling for equation operands.
//                        Bigger = larger numbers, harder arithmetic.
//     additional_terms — difficulty axis 2: extra operands added to every
//                        enemy's equation beyond its base count (0 = normal).
//                        0 everywhere today; set to 1 to turn "a+b" into
//                        "a+b+c", 2 for "a+b+c+d", etc.
//     hp_mult          — multiplier applied to each spawned enemy's base HP
//                        (rounded up). 1.0 = base. Increases with world/level.
//     spawn  — exact count of each enemy type for the whole level. At run
//              start, the full list is shuffled and split into WAVES_PER_LEVEL
//              queues. Bonus types (ice/heart) are skipped at spawn time if
//              their gate isn't met. Empty {} for boss levels.
//
// To add an enemy: give it a file under systems/enemies/, then add its id with
// a count to the cells where it should appear.
function lp(maxNum, additional_terms, hp_mult, spawn) {
  return { maxNum, additional_terms, hp_mult, spawn };
}

export const LEVEL_PLAN = {
  // World 1 — Summy Meadow: pure addition; yellow tapers as pink takes over so
  // levels stay short instead of grinding through value-1 filler.
  1: {
    1: lp(10, 0, 1.0, { yellow: 8, ice: 1 }),
    2: lp(12, 0, 1.15, { yellow: 7, pink: 3, ice: 1, heart: 2 }),
    3: lp(15, 0, 1.3, { yellow: 6, pink: 6, ice: 1, heart: 2 }),
    4: lp(18, 0, 1.45, { yellow: 5, pink: 9, ice: 2, heart: 2 }),
    5: lp(20, 0, 1.6, {}),
  },
  // World 2 — Reflection Hollow: subtraction (green) and the shielded brute
  // (blue) join the roster; blue builds toward a shield-heavy L4 finale, and the
  // boss is the Mirror.
  2: {
    1: lp(18, 0, 1.75, { yellow: 5, pink: 5, green: 1, ice: 1 }),
    2: lp(20, 0, 1.9, { yellow: 5, pink: 5, green: 3, blue: 1, ice: 1, heart: 2 }),
    3: lp(22, 0, 2.1, { yellow: 4, pink: 6, green: 5, blue: 2, ice: 1, heart: 2 }),
    4: lp(25, 0, 2.25, { yellow: 3, pink: 4, green: 6, blue: 4, ice: 2, heart: 2 }),
    5: lp(28, 0, 2.4, {}),
  },
  // World 3 — Variable Heights: missing-addend equations (2+?=5); the hexagon
  // brute headlines and blue is a steady presence so the shield mechanic stays
  // in play throughout.
  3: {
    1: lp(25, 0, 2.5, { yellow: 3, pink: 3, green: 5, blue: 3, hexagon: 2, ice: 1, heart: 2 }),
    2: lp(28, 0, 2.65, { yellow: 3, pink: 3, green: 5, blue: 3, hexagon: 3, ice: 1, heart: 2 }),
    3: lp(30, 0, 2.8, { yellow: 2, pink: 3, green: 5, blue: 4, hexagon: 4, ice: 2, heart: 2 }),
    4: lp(33, 0, 3.0, { yellow: 2, pink: 3, green: 5, blue: 4, hexagon: 5, ice: 2, heart: 2 }),
    5: lp(36, 0, 3.15, {}),
  }
}

// Look up a level's plan, clamping out-of-range world/level to the last defined.
export function levelPlan(world, level) {
  const w = LEVEL_PLAN[world] || LEVEL_PLAN[NUM_WORLDS];
  return w[level] || w[LEVELS_PER_WORLD];
}

// ---------- difficulties

// Pacing knobs (speed, spawn cadence, enemy caps) scaled smoothly with absolute
// level. The math difficulty (maxNum / terms) is NOT here — it's authored per
// cell in LEVEL_PLAN above and merged in by difficultyForWorldLevel.
const BASE_DIFFICULTY = {
  enemyCapAdd: 2,
  enemyCapMax: 4,
  speedMult: 0.30,
  spawnBase: 1.8,
  spawnDecay: 0.94,
  spawnMin: 1.0,
};

// Build the full runtime difficulty config for a world/level: math knobs straight
// from LEVEL_PLAN, pacing knobs scaled logarithmically with absolute level
// (5 levels per world, log base 1.5 for smooth exponential growth).
// diffMult is the global challenge multiplier (1 = default).
// Scales maxNum (equations), hp_mult (enemy HP), and speedMult.
export function difficultyForWorldLevel(world, level, diffMult = 1) {
  const plan = levelPlan(world, level);
  const absoluteLevel = (world - 1) * LEVELS_PER_WORLD + level;
  // log_1.5(x) ≈ ln(x) / ln(1.5)
  const scalar = Math.log(Math.max(1, absoluteLevel)) / Math.log(1.5);

  return {
    maxNum: Math.round(plan.maxNum * diffMult),
    additional_terms: plan.additional_terms,
    hp_mult: plan.hp_mult * diffMult,
    enemyCapAdd: Math.round(BASE_DIFFICULTY.enemyCapAdd * (0.7 + scalar * 0.5)),
    enemyCapMax: Math.round(BASE_DIFFICULTY.enemyCapMax * (0.7 + scalar * 0.5)),
    speedMult: BASE_DIFFICULTY.speedMult * (0.8 + scalar * 0.3) * (1 + (diffMult - 1) * 0.5),
    spawnBase: BASE_DIFFICULTY.spawnBase * Math.pow(0.94, scalar * 0.5),
    spawnDecay: BASE_DIFFICULTY.spawnDecay - scalar * 0.01,
    spawnMin: Math.max(0.1, BASE_DIFFICULTY.spawnMin - scalar * 0.05),
  };
}

// ---------- bosses

export const BOSS_ORBIT_RADIUS = 340;
export const BOSS_ORBIT_SPEED = 0.9; // rad/sec
export const NUM_MINIS = 3;
export const SUMMONER_MINIONS = 3;
export const SUMMONER_SPAWN_DELAY = 0.8;

export const BOSS_COLORS = ["#a78bfa", "#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee"];

// ---------- spawn placement

// Moving enemies appear just below the wave bar (topMask is 78px tall, and
// each enemy carries a ~30px equation label above its center, so center y
// must be ≥ 108 + radius for the label to clear the mask).
export const TOP_SPAWN_Y = 110;
// Boss spawn center y. Must be ≥ TOP_SPAWN_Y + BOSS_ORBIT_RADIUS so the
// orbiting minis at their highest point stay below the wave bar/topMask.
export const BOSS_SPAWN_Y = TOP_SPAWN_Y + BOSS_ORBIT_RADIUS - 8;
export const SPAWN_HEAD_CLEARANCE = 180;
export const LANE_SEPARATION_GAP = 8;
export const SPAWN_FADE_DURATION = 0.45;  // seconds for newly spawned enemies to fade in

// ---------- audio

export const MUSIC_BG_VOL = 0.45;

// ---------- player progression (XP / level)

// Base XP per star at 1× difficulty. Scaled by difficulty in settings.js.
export const XP_BASE_STARS = [0, 50, 100, 150];
// XP needed for level 1. Each subsequent level costs ×XP_LEVEL_GROWTH more.
export const XP_BASE_THRESHOLD = 250;
export const XP_LEVEL_GROWTH = 1.15;
export const MAX_PLAYER_LEVEL = 30;

// Returns { level, xpIn, threshold } from accumulated XP.
// threshold = XP needed to reach the NEXT level (0 when at max).
export function xpProgressInLevel(totalXP) {
  let level = 0;
  let threshold = XP_BASE_THRESHOLD;
  let spent = 0;
  while (level < MAX_PLAYER_LEVEL && totalXP >= spent + threshold) {
    spent += threshold;
    threshold = Math.ceil(threshold * XP_LEVEL_GROWTH);
    level++;
  }
  return { level, xpIn: totalXP - spent, threshold: level < MAX_PLAYER_LEVEL ? threshold : 0 };
}

// Non-linear damage bonus at player level n. Starts at +2 per level and
// accelerates quadratically — level 5 ≈ +11–13, level 10 ≈ +27–35.
export function playerDamageBonus(level) {
  const n = level;
  return {
    min: Math.floor(n * 2 + n * (n - 1) / 4),
    max: Math.floor(n * 2 + n * (n - 1) / 2),
  };
}

// HP bonus at player level n. Same quadratic shape as damage, half the base rate.
// level 5 ≈ +6, level 10 ≈ +14, level 20 ≈ +39.
export function playerHpBonus(level) {
  const n = level;
  return Math.floor(n + n * (n - 1) / 20);
}
