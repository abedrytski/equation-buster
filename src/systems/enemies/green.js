// Green — mover with a non-negative subtraction.
import { mkSubFloor, mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "green",
  color: "#34d399", radius: 16, speed: 44, value: 5, hp: 15, damage: 3,
  eq: (cap, extra = 0) => {
    const hi = operandCap(cap, 0.85, 6);
    const lo = operandCap(cap, 0.2, 2);
    if (extra > 0) return mkAddN(2 + extra, hi);
    return mkSubFloor(hi, lo);
  },
};
