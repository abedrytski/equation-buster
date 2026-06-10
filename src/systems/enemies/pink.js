// Pink — fast mover with a plain two-number addition drawn from a capped range.
import { randInt, operandCap, mkAddN } from "../../core/equations.js";

export default {
  id: "pink",
  color: "#f472b6", radius: 15, speed: 50, value: 3, hp: 1,
  eq: (cap, extra = 0) => {
    const m = Math.max(2, operandCap(cap, 0.5, 2));
    if (extra > 0) return mkAddN(2 + extra, m);
    const a = randInt(2, m), b = randInt(2, m);
    return { text: `${a}+${b}`, answer: a + b };
  },
};
