// Tunables + static data tables. The single place to balance the game.
// Enemy descriptors live in ../systems/enemies/ (one file each); their per-level
// spawn weights and the math difficulty are tuned here via LEVEL_PLAN.

// ---------- core tunables

export const MAX_LIVES = 3;
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
export const LIFE_LOSS_WIPE_RADIUS = 320;
export const FREEZE_DURATION = 5;

// ---------- lanes

export const LANE_X_FRACTIONS = [0.22, 0.50, 0.78];
export const NUM_LANES = LANE_X_FRACTIONS.length;

// player line sits this far above the chip bar
export const PLAYER_LINE_GAP = 70;

// ---------- waves

export const BREATHER_DURATION = 4;    // seconds between waves
export const BOSS_EVERY_N_WAVES = 3;

// ---------- world / level structure
// A world has LEVELS_PER_WORLD levels. Each regular level is WAVES_PER_LEVEL
// short waves; the final level of a world is a single boss fight (no waves).
export const LEVELS_PER_WORLD = 5;
export const WAVES_PER_LEVEL = 2;
export const NUM_WORLDS = 10;

// Display names per world (index 0 unused; worlds are 1-based).
export const WORLD_NAMES = [
  "",
  "Number Jungle",
  "Adder's Peak",
  "Times-Table Valley",
  "Division Desert",
  "Fraction Falls",
  "Decimal Depths",
  "Power Plateau",
  "Algebra Abyss",
  "Geometry Gardens",
  "Infinity Isles",
];

// streak tiers: [minCount, multiplier, cssTier]
export const STREAK_TIERS = [
  { min: 3,  mult: 2, tier: "tier2" },
  { min: 10, mult: 3, tier: "tier3" },
  { min: 20, mult: 5, tier: "tier4" },
];

// Highest streak multiplier — used as the ceiling when computing a level's
// theoretical max score for star ratings.
export const MAX_STREAK_MULT = STREAK_TIERS[STREAK_TIERS.length - 1].mult;

// ---------- level plan (world → level → enemy proportions + difficulty)
//
// The single index that drives a level: who spawns and how hard the math is.
// Replaces the old per-wave SPAWN_TABLE — levels are only WAVES_PER_LEVEL waves
// now, and both waves of a level share one plan.
//
//   lp(maxNum, additional_terms, spawn)
//     maxNum           — difficulty axis 1: ceiling for equation operands.
//                        Bigger = larger numbers, harder arithmetic.
//     additional_terms — difficulty axis 2: extra operands added to every
//                        enemy's equation beyond its base count (0 = normal).
//                        0 everywhere today; set to 1 to turn "a+b" into
//                        "a+b+c", 2 for "a+b+c+d", etc.
//     spawn  — enemy proportions (weights), same shape as a row of the old
//              SPAWN_TABLE. Bonus types (ice/heart) are still gated at spawn
//              time. Empty {} for the boss level (level LEVELS_PER_WORLD), which
//              is boss-only and never samples this.
//
// To add an enemy: give it a file under systems/enemies/, then add its id with
// a weight to the cells where it should appear.
function lp(maxNum, additional_terms, spawn) {
  return { maxNum, additional_terms, spawn };
}

export const LEVEL_PLAN = {
  // World 1 — Number Jungle: introduces the roster one enemy at a time.
  1: {
    1: lp(10, 0, { yellow: 4, ice: 1 }),
    2: lp(12, 0, { yellow: 4, pink: 2, ice: 1, heart: 1 }),
    3: lp(15, 0, { yellow: 3, pink: 3, green: 2, ice: 1, heart: 1 }),
    4: lp(18, 0, { yellow: 3, pink: 3, green: 2, blue: 2, ice: 1, heart: 1 }),
    5: lp(20, 0, {}),
  },
  // World 2 — Adder's Peak: full roster online, hexagon brute appears.
  2: {
    1: lp(18, 0, { yellow: 3, pink: 3, green: 2, ice: 1 }),
    2: lp(20, 0, { yellow: 2, pink: 3, green: 2, blue: 2, ice: 1, heart: 1 }),
    3: lp(22, 0, { yellow: 2, pink: 3, green: 3, blue: 2, hexagon: 1, ice: 1, heart: 1 }),
    4: lp(25, 0, { yellow: 2, pink: 2, green: 3, blue: 3, hexagon: 2, ice: 1, heart: 1 }),
    5: lp(28, 0, {}),
  },
  // World 3 — Times-Table Valley
  3: {
    1: lp(25, 0, { yellow: 2, pink: 3, green: 2, blue: 2, hexagon: 1, ice: 1, heart: 1 }),
    2: lp(28, 0, { yellow: 2, pink: 2, green: 3, blue: 2, hexagon: 1, ice: 1, heart: 1 }),
    3: lp(30, 0, { yellow: 1, pink: 2, green: 3, blue: 3, hexagon: 2, ice: 1, heart: 1 }),
    4: lp(33, 0, { yellow: 1, pink: 2, green: 2, blue: 3, hexagon: 3, ice: 1, heart: 1 }),
    5: lp(36, 0, {}),
  },
  // World 4 — Division Desert
  4: {
    1: lp(33, 0, { yellow: 1, pink: 3, green: 2, blue: 2, hexagon: 1, ice: 1, heart: 1 }),
    2: lp(36, 0, { yellow: 1, pink: 2, green: 3, blue: 2, hexagon: 2, ice: 1, heart: 1 }),
    3: lp(40, 0, { pink: 2, green: 3, blue: 3, hexagon: 2, ice: 1, heart: 1 }),
    4: lp(44, 0, { pink: 2, green: 2, blue: 3, hexagon: 3, ice: 1, heart: 1 }),
    5: lp(48, 0, {}),
  },
  // World 5 — Fraction Falls
  5: {
    1: lp(45, 0, { pink: 3, green: 2, blue: 3, hexagon: 2, ice: 1, heart: 1 }),
    2: lp(50, 0, { pink: 2, green: 3, blue: 3, hexagon: 2, ice: 1, heart: 1 }),
    3: lp(55, 0, { pink: 2, green: 3, blue: 3, hexagon: 3, ice: 1, heart: 1 }),
    4: lp(60, 0, { pink: 2, green: 2, blue: 4, hexagon: 3, ice: 1, heart: 1 }),
    5: lp(65, 0, {}),
  },
  // World 6 — Decimal Depths
  6: {
    1: lp(60, 0, { pink: 3, green: 2, blue: 3, hexagon: 2, ice: 1, heart: 1 }),
    2: lp(66, 0, { pink: 2, green: 3, blue: 3, hexagon: 3, ice: 1, heart: 1 }),
    3: lp(72, 0, { pink: 2, green: 2, blue: 4, hexagon: 3, ice: 1, heart: 1 }),
    4: lp(78, 0, { pink: 1, green: 2, blue: 4, hexagon: 4, ice: 1, heart: 1 }),
    5: lp(85, 0, {}),
  },
  // World 7 — Power Plateau
  7: {
    1: lp(80, 0, { pink: 3, green: 3, blue: 3, hexagon: 2, ice: 1, heart: 1 }),
    2: lp(88, 0, { pink: 2, green: 3, blue: 3, hexagon: 3, ice: 1, heart: 1 }),
    3: lp(95, 0, { pink: 2, green: 2, blue: 3, hexagon: 3, ice: 1, heart: 1 }),
    4: lp(103, 0, { pink: 1, green: 2, blue: 3, hexagon: 4, ice: 1, heart: 1 }),
    5: lp(110, 0, {}),
  },
  // World 8 — Algebra Abyss
  8: {
    1: lp(100, 0, { pink: 2, green: 3, blue: 3, hexagon: 3, ice: 1, heart: 1 }),
    2: lp(110, 0, { pink: 2, green: 2, blue: 4, hexagon: 3, ice: 1, heart: 1 }),
    3: lp(120, 0, { pink: 1, green: 2, blue: 4, hexagon: 4, ice: 1, heart: 1 }),
    4: lp(130, 0, { pink: 1, green: 2, blue: 3, hexagon: 5, ice: 1, heart: 1 }),
    5: lp(140, 0, {}),
  },
  // World 9 — Geometry Gardens
  9: {
    1: lp(130, 0, { pink: 2, green: 2, blue: 4, hexagon: 3, ice: 1, heart: 1 }),
    2: lp(142, 0, { pink: 1, green: 2, blue: 4, hexagon: 4, ice: 1, heart: 1 }),
    3: lp(155, 0, { pink: 1, green: 2, blue: 3, hexagon: 5, ice: 1, heart: 1 }),
    4: lp(168, 0, { green: 2, blue: 3, hexagon: 5, ice: 1, heart: 1 }),
    5: lp(180, 0, {}),
  },
  // World 10 — Infinity Isles: the gauntlet, hexagon-heavy.
  10: {
    1: lp(170, 0, { pink: 1, green: 2, blue: 4, hexagon: 4, ice: 1, heart: 1 }),
    2: lp(185, 0, { green: 2, blue: 4, hexagon: 4, ice: 1, heart: 1 }),
    3: lp(200, 0, { green: 2, blue: 3, hexagon: 5, ice: 1, heart: 1 }),
    4: lp(215, 0, { green: 1, blue: 3, hexagon: 6, ice: 1, heart: 1 }),
    5: lp(230, 0, {}),
  },
};

// Look up a level's plan, clamping out-of-range world/level to the last defined.
export function levelPlan(world, level) {
  const w = LEVEL_PLAN[world] || LEVEL_PLAN[NUM_WORLDS];
  return w[level] || w[LEVELS_PER_WORLD];
}

// Enemy proportions (weights) for a given world/level — drives spawning.
export function spawnTableFor(world, level) {
  return levelPlan(world, level).spawn;
}

// ---------- difficulties

// Pacing knobs (speed, spawn cadence, enemy caps) scaled smoothly with absolute
// level. The math difficulty (maxNum / terms) is NOT here — it's authored per
// cell in LEVEL_PLAN above and merged in by difficultyForWorldLevel.
const BASE_DIFFICULTY = {
  enemyCapAdd: 2,
  enemyCapMax: 4,
  speedMult: 0.50,
  spawnBase: 1.8,
  spawnDecay: 0.94,
  spawnMin: 1.0,
};

// Build the full runtime difficulty config for a world/level: math knobs straight
// from LEVEL_PLAN, pacing knobs scaled logarithmically with absolute level
// (5 levels per world, log base 1.5 for smooth exponential growth).
export function difficultyForWorldLevel(world, level) {
  const plan = levelPlan(world, level);
  const absoluteLevel = (world - 1) * LEVELS_PER_WORLD + level;
  // log_1.5(x) ≈ ln(x) / ln(1.5)
  const scalar = Math.log(Math.max(1, absoluteLevel)) / Math.log(1.5);

  return {
    maxNum: plan.maxNum,
    additional_terms: plan.additional_terms,
    enemyCapAdd: Math.round(BASE_DIFFICULTY.enemyCapAdd * (0.7 + scalar * 0.5)),
    enemyCapMax: Math.round(BASE_DIFFICULTY.enemyCapMax * (0.7 + scalar * 0.5)),
    speedMult: BASE_DIFFICULTY.speedMult * (0.8 + scalar * 0.3),
    spawnBase: BASE_DIFFICULTY.spawnBase * Math.pow(0.94, scalar * 0.5),
    spawnDecay: BASE_DIFFICULTY.spawnDecay - scalar * 0.01,
    spawnMin: Math.max(0.1, BASE_DIFFICULTY.spawnMin - scalar * 0.05),
  };
}

// ---------- bosses

export const BOSS_ORBIT_RADIUS = 90;
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
export const MUSIC_BOSS_VOL = 0.55;
