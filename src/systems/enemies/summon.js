// Summon — the Summoner boss's minions: stationary, lifetime-bounded, with a
// 4-number addition (base 4 terms, grows with additional_terms).
import { eqAdd5, mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "summon",
  color: "#c084fc", radius: 14, speed: 0, value: 5, hp: 1, lifetime: 8, glyph: "✦",
  eq: (cap, extra = 0) => extra > 0 ? mkAddN(4 + extra, operandCap(cap, 0.25, 2)) : eqAdd5(cap),
};
