// Mini — the Mirror boss's orbiting minions (stationary, 1 HP).
import { eqAdd, mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "mini",
  color: "#a78bfa", radius: 18, speed: 0, value: 6, hp: 1, shape: "mini",
  eq: (cap, extra = 0) => extra > 0 ? mkAddN(2 + extra, operandCap(cap, 0.35, 2)) : eqAdd(cap, 0.35, 2),
};
