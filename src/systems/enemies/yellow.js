// Yellow — the basic mover: cheap, slow, single-HP, simple 2-number add.
import { eqAdd, mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "yellow",
  color: "#fbbf24", radius: 13, speed: 38, value: 1, hp: 1,
  eq: (cap, extra = 0) => extra > 0 ? mkAddN(2 + extra, operandCap(cap, 0.25, 2)) : eqAdd(cap, 0.25, 2),
};
