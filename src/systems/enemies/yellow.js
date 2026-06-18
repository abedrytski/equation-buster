// Yellow — basic mover: simple 2-number add, operands ≥ 2 so no trivial 1+1.
import { randInt, mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "yellow",
  color: "#fbbf24", radius: 13, speed: 38, value: 1, hp: 10, damage: 1,
  eq: (cap, extra = 0) => {
    const hi = operandCap(cap, 0.8, 4);
    const lo = operandCap(cap, 0.2, 2);
    if (extra > 0) return mkAddN(2 + extra, hi);
    const a = randInt(lo, hi), b = randInt(lo, hi);
    return { text: `${a}+${b}`, answer: a + b };
  },
};
