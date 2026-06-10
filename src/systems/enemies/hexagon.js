// Hexagon — big, slow, high-value 3-HP brute with a 3-number addition (base 3 terms).
import { mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "hexagon",
  color: "#cbd5e1", radius: 30, speed: 22, value: 20, hp: 3, shape: "hex",
  eq: (cap, extra = 0) => mkAddN(3 + extra, operandCap(cap, 0.20, 2)),
};
