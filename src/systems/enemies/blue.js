// Blue — tankier mover (2 HP, shielded) with mixed add/subtract.
import { randInt, mkSubFloor, mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "blue",
  color: "#60a5fa", radius: 18, speed: 32, value: 8, hp: 15, damage: 4, hasShield: true,
  eq: (cap, extra = 0) => {
    const hi = operandCap(cap, 0.9, 6);
    const lo = operandCap(cap, 0.35, 3);
    if (extra > 0) return mkAddN(2 + extra, hi);
    if (Math.random() < 0.5) {
      const a = randInt(lo, hi), b = randInt(lo, hi);
      return { text: `${a}+${b}`, answer: a + b };
    }
    return mkSubFloor(hi, lo);
  },
};
