// Heart — stationary bonus pickup. Awards no score; on kill it heals one life.
// Only spawns when the player has actually lost a life.
import { eqAdd, mkAddN, operandCap } from "../../core/equations.js";
import { HEART_HEAL } from "../../core/config.js";

export default {
    id: "heart",
    color: "#fb7185", radius: 14, speed: 0, value: 0, hp: 8, damage: 0, lifetime: 8, glyph: "♥",
    bonus: true, placement: "upper", awardsScore: false,
    effect: { heal: HEART_HEAL }, requiresMissingHP: true,
    eq: (cap, extra = 0) => extra > 0 ? mkAddN(2 + extra, operandCap(cap, 0.30, 2)) : eqAdd(cap, 0.30, 2),
};
