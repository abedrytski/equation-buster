// Summon — the Summoner boss's minions: stationary, lifetime-bounded.
// 4-number addition using yellow's difficulty fractions — bigger numbers than
// regular yellows ("more digits") thanks to the extra operands summing up.
import { mkAddNFloor, operandCap } from "../../core/equations.js";

export default {
  id: "summon",
  color: "#c084fc", radius: 14, speed: 0, value: 5, hp: 6, damage: 1, lifetime: 8, glyph: "✦",
  eq: (cap, extra = 0) => {
    const hi = operandCap(cap, 0.8, 4);
    const lo = operandCap(cap, 0.2, 2);
    return mkAddNFloor(4 + extra, lo, hi);
  },
};
