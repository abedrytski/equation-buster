// Blue — tankier mover (2 HP, shielded) with mixed add/subtract.
import { eqAddOrSub, mkAddN, operandCap } from "../../core/equations.js";

export default {
  id: "blue",
  color: "#60a5fa", radius: 18, speed: 32, value: 8, hp: 2, hasShield: true,
  eq: (cap, extra = 0) => extra > 0 ? mkAddN(2 + extra, operandCap(cap, 0.65, 3)) : eqAddOrSub(cap, 0.65, 3),
};
