// Pink — fast mover with a plain two-number addition drawn from a capped range.
import { randInt, operandCap, mkAddN } from "../../core/equations.js";

export default {
  id: "pink",
  color: "#f472b6", radius: 15, speed: 50, value: 3, hp: 12, damage: 2,
  eq: (cap, extra = 0) => {
    const hi = operandCap(cap, 1.0, 5);
    const lo = operandCap(cap, 0.4, 4);
    if (extra > 0) return mkAddN(2 + extra, hi);
    const a = randInt(lo, hi), b = randInt(lo, hi);
    return { text: `${a}+${b}`, answer: a + b };
  },
};
