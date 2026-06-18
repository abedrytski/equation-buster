// Mini — the Mirror boss's orbiting minions. Equations match pink difficulty.
import { randInt, mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "mini",
  color: "#a78bfa", radius: 18, speed: 0, value: 6, hp: 8, damage: 1, shape: "mini",
  eq: (cap, extra = 0) => {
    const hi = operandCap(cap, 1.0, 5);
    const lo = operandCap(cap, 0.4, 4);
    if (extra > 0) return mkAddN(2 + extra, hi);
    const a = randInt(lo, hi), b = randInt(lo, hi);
    return { text: `${a}+${b}`, answer: a + b };
  },
};
