// Hexagon — big, slow, high-value 3-HP brute with fill-in-the-blank equations.
// Base: "a+?=sum" (1 known term). Each additional_term adds one more known term.
import { mkMissingAddend, operandCap } from "../../core/equations.js";

export default {
  id: "hexagon",
  color: "#cbd5e1", radius: 30, speed: 22, value: 20, hp: 30, damage: 6, shape: "hex",
  eq: (cap, extra = 0) => mkMissingAddend(1 + extra, operandCap(cap, 0.5, 4)),
};
