// The Sigma — a lone summing colossus shaped like the Σ letter. No minions, no
// shield: it's answerable from the first frame. It carries a fill-in-the-blank
// sum (a+?=n, like the hexagon brute). Every hit it survives, the equation
// gains one more known addend — a+?=n → a+b+?=n → a+b+c+?=n → … — so the
// running sum it asks you to track keeps climbing while the missing addend it
// wants back stays a small, single number. Operand growth caps at MAX_KNOWN so
// the equation never outgrows the chip row.

import { state } from "../../core/state.js";
import { mkMissingAddend, operandCap } from "../../core/equations.js";
import { createBoss } from "./shared.js";

// Most addends the equation ever shows left of the "?". Past this the equation
// stops lengthening (it would stop being readable), but each hit still rerolls
// fresh numbers so the sum keeps changing.
const MAX_KNOWN = 7;

function sigmaEq(knownCount) {
  return mkMissingAddend(knownCount, operandCap(state.config.maxNum, 0.5, 4));
}

export default {
  id: "sigma",

  spawn(tier) {
    // base 78 → scales with world + difficulty via hp_mult; sized to survive a
    // handful of hits so the equation visibly grows term by term.
    const boss = createBoss(tier, {
      kind: "sigma",
      hp: Math.ceil(78 * state.config.hp_mult),
      value: 60 * tier,
      // answerable immediately — no orbiting shield to strip first
      extra: { knownTerms: 1, invulnerable: false },
    });

    const eq = sigmaEq(boss.knownTerms);
    boss.text = eq.text;
    boss.answer = eq.answer;

    state.bossAlertTimer = 1.5;
    return boss;
  },

  update() {
    // no per-frame behavior — the Sigma just stands and computes
  },

  // Called on every surviving hit. Lengthen the equation by one term (capped),
  // then generate it — looping internally until the answer differs from the
  // current one so combat.js's retry loop never re-triggers this growth.
  regenEquation(boss) {
    boss.knownTerms = Math.min(MAX_KNOWN, boss.knownTerms + 1);
    const old = boss.answer;
    let eq = sigmaEq(boss.knownTerms);
    for (let i = 0; i < 20 && eq.answer === old; i++) eq = sigmaEq(boss.knownTerms);
    return eq;
  },

  // Σ-accented name plate.
  drawLabel(ctx, boss) {
    ctx.font = "bold 12px ui-monospace, Menlo, monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillText("Σ THE SIGMA Σ", boss.x, boss.y - 6);
  },

  // Big translucent Σ emblem filling the body, marking its identity at a glance.
  draw(boss, ctx) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = boss.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.round(boss.radius * 1.5)}px Georgia, "Times New Roman", serif`;
    ctx.fillText("Σ", boss.x, boss.y + boss.radius * 0.08);
    ctx.restore();
  },
};
