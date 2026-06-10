// Ice — stationary bonus pickup. Awards no score; on kill it freezes the
// playfield. Only spawns when there are enough movers to make freezing useful.
import { eqAdd, mkAddN, operandCap } from "../../core/equations.js";
import { FREEZE_DURATION } from "../../core/config.js";

export default {
  id: "ice",
  color: "#7dd3fc", radius: 14, speed: 0, value: 4, hp: 1, lifetime: 8, glyph: "❄",
  bonus: true, placement: "upper", awardsScore: false,
  effect: { freeze: FREEZE_DURATION }, requiresMovers: 0.6,
  eq: (cap, extra = 0) => extra > 0 ? mkAddN(2 + extra, operandCap(cap, 0.20, 2)) : eqAdd(cap, 0.20, 2),
};
