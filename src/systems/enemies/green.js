// Green — mover with a non-negative subtraction.
import { mkSubNonNeg, mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "green",
  color: "#34d399", radius: 16, speed: 44, value: 5, hp: 1,
  eq: (cap, extra = 0) => extra > 0 ? mkAddN(2 + extra, operandCap(cap, 0.50, 3)) : mkSubNonNeg(cap),
};
