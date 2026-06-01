// Tunables + static data tables. The single place to balance the game.
// Imports only the pure equation generators (for the TYPES eq builders).

import { randInt, operandCap, eqAdd, eqAddOrSub, eqAdd3, eqAdd5 } from "./equations.js";

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
export const MAX_WAVES = 6;

// streak tiers: [minCount, multiplier, cssTier]
export const STREAK_TIERS = [
  { min: 3,  mult: 2, tier: "tier2" },
  { min: 10, mult: 3, tier: "tier3" },
  { min: 20, mult: 5, tier: "tier4" },
];

// ---------- difficulties

export const DIFFICULTIES = {
  easy: {
    maxNum: 20,
    enemyCapAdd: 2,
    enemyCapMax: 4,
    speedMult: 0.50,
    spawnBase: 1.8,
    spawnDecay: 0.94,
    spawnMin: 1.0,
  },
  medium: {
    maxNum: 50,
    enemyCapAdd: 3,
    enemyCapMax: 5,
    speedMult: 0.70,
    spawnBase: 1.4,
    spawnDecay: 0.93,
    spawnMin: 0.85,
  },
  hard: {
    maxNum: 100,
    enemyCapAdd: 4,
    enemyCapMax: 6,
    speedMult: 0.72,
    spawnBase: 1.4,
    spawnDecay: 0.95,
    spawnMin: 0.85,
  },
};

// ---------- enemy types

export const TYPES = {
  yellow: {
    color: "#fbbf24", radius: 13, speed: 38, value: 1, hp: 1,
    eq: (cap) => eqAdd(cap, 0.25, 2),
  },
  // --- bonus enemies: stationary pickups that pay out an `effect` on kill
  // instead of score. Declarative fields (bonus/effect/placement + gating)
  // mean adding another bonus is one entry here plus a SPAWN_TABLE listing.
  ice: {
    color: "#7dd3fc", radius: 14, speed: 0, value: 4, hp: 1, lifetime: 8, glyph: "❄",
    bonus: true, placement: "upper", awardsScore: false,
    effect: { freeze: FREEZE_DURATION }, requiresMovers: 0.6,
    eq: (cap) => eqAdd(cap, 0.20, 2),
  },
  heart: {
    color: "#fb7185", radius: 14, speed: 0, value: 0, hp: 1, lifetime: 8, glyph: "♥",
    bonus: true, placement: "upper", awardsScore: false,
    effect: { heal: 1 }, requiresMissingLife: true,
    eq: (cap) => eqAdd(cap, 0.20, 2),
  },
  pink: {
    color: "#f472b6", radius: 15, speed: 50, value: 3, hp: 1,
    eq: (cap) => {
      const m = Math.max(2, operandCap(cap, 0.5, 2));
      const a = randInt(2, m), b = randInt(2, m);
      return { text: `${a}+${b}`, answer: a + b };
    },
  },
  green: {
    color: "#34d399", radius: 16, speed: 44, value: 5, hp: 1,
    eq: (cap) => eqAddOrSub(cap, 0.50, 3),
  },
  blue: {
    color: "#60a5fa", radius: 18, speed: 32, value: 8, hp: 2, hasShield: true,
    eq: (cap) => eqAddOrSub(cap, 0.65, 3),
  },
  hexagon: {
    color: "#cbd5e1", radius: 30, speed: 22, value: 20, hp: 3, shape: "hex",
    eq: (cap) => eqAdd3(cap, 0.20, 2),
  },
  boss: {
    color: "#a78bfa", radius: 40, speed: 18, value: 50, hp: 3, shape: "boss",
  },
  mini: {
    color: "#a78bfa", radius: 18, speed: 0, value: 6, hp: 1, shape: "mini",
    eq: (cap) => eqAdd(cap, 0.35, 2),
  },
  summon: {
    // SUMMONER's minions — stationary, lifetime-bounded, 5-num add equations
    color: "#c084fc", radius: 14, speed: 0, value: 5, hp: 1, lifetime: 8, glyph: "✦",
    eq: (cap) => eqAdd5(cap),
  },
};

// ---------- bosses

export const BOSS_ORBIT_RADIUS = 90;
export const BOSS_ORBIT_SPEED = 0.9; // rad/sec
export const NUM_MINIS = 3;
export const SUMMONER_MINIONS = 3;
export const SUMMONER_SPAWN_DELAY = 0.8;

export const BOSS_COLORS = ["#a78bfa", "#f87171", "#fb923c", "#fbbf24", "#34d399", "#22d3ee"];

// ---------- spawn placement

// weighted spawn table per wave (last entry used for higher waves)
export const SPAWN_TABLE = [
  { yellow: 3, ice: 1 },                                                    // W1
  { yellow: 3, ice: 1, pink: 2, heart: 1 },                                 // W2
  { yellow: 2, ice: 1, pink: 2, green: 2, heart: 1 },                       // W3
  { yellow: 2, ice: 1, pink: 2, green: 2, blue: 2, heart: 1 },              // W4
  { yellow: 2, ice: 1, pink: 2, green: 2, blue: 2, hexagon: 1, heart: 1 },  // W5+
];

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
