// Equation display: turns an equation string into pixels. A single parser feeds
// multiple "formats" (inline pill, vertical column). The active format is the
// display preference state.eqFormat, toggled at runtime. Game state and the
// equation strings are never touched here — this module only draws.

import { state } from "../core/state.js";

const OPERATORS = new Set(["+", "-", "×", "÷"]);

// "8+?=11" -> { operands:["8","?"], operators:["+"], rhs:"11" }
// "3+4"    -> { operands:["3","4"], operators:["+"], rhs:null }
export function parseEquation(text) {
  const eq = text.indexOf("=");
  const lhs = eq === -1 ? text : text.slice(0, eq);
  const rhs = eq === -1 ? null : text.slice(eq + 1).trim();
  const operands = [], operators = [];
  let cur = "";
  for (const ch of lhs) {
    if (OPERATORS.has(ch)) { operands.push(cur.trim()); operators.push(ch); cur = ""; }
    else cur += ch;
  }
  if (cur.trim() !== "") operands.push(cur.trim());
  return { operands, operators, rhs };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------- inline: the original pill (kept pixel-identical) ----------

function drawInline(ctx, _parsed, { cx, baselineY, text, color, mirror }) {
  ctx.font = "bold 14px ui-monospace, Menlo, monospace";
  const padX = 8, bh = 22;
  const tw = ctx.measureText(text).width;
  const bw = tw + padX * 2;
  const bx = cx - bw / 2, by = baselineY - bh;

  ctx.fillStyle = "#0a0a14";
  roundRect(ctx, bx, by, bw, bh, 5); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (mirror) {
    ctx.save();
    ctx.translate(cx, by + bh / 2 + 1);
    ctx.scale(-1, 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(text, cx, by + bh / 2 + 1);
  }
}

// ---------- column: vertical "worksheet" layout ----------

const COL_FONT = "bold 15px ui-monospace, Menlo, monospace";
const ROW_H = 18, PAD = 8;

function drawUnderscore(ctx, right, y, w) {
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(right - Math.max(w, 12), y + 7);
  ctx.lineTo(right, y + 7);
  ctx.stroke();
}

function drawColumn(ctx, parsed, { cx, baselineY, color }) {
  ctx.font = COL_FONT;
  const { operands, operators, rhs } = parsed;

  // rows: each operand; "?" becomes the blank slot. Operator sits left of its row.
  const rows = operands.map((op, i) => ({
    text: op === "?" ? "" : op,
    blank: op === "?",
    op: i > 0 ? operators[i - 1] : null,
  }));
  // result row: known rhs, or a blank for the player to compute (no "=" form)
  const result = { text: rhs && rhs !== "?" ? rhs : "", blank: !rhs || rhs === "?" };

  const opW = ctx.measureText("×").width, gap = 6;
  let numW = ctx.measureText(result.text || "0").width;
  for (const r of rows) numW = Math.max(numW, ctx.measureText(r.text || "0").width);

  const bw = opW + gap + numW + PAD * 2;
  const bh = (rows.length + 1) * ROW_H + PAD * 2 + 2;
  const bx = cx - bw / 2, by = baselineY - bh;

  ctx.fillStyle = "#0a0a14";
  roundRect(ctx, bx, by, bw, bh, 6); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();

  const numRight = bx + bw - PAD, opLeft = bx + PAD;
  ctx.textBaseline = "middle";
  let y = by + PAD + ROW_H / 2;

  for (const r of rows) {
    if (r.op) { ctx.fillStyle = color; ctx.textAlign = "left"; ctx.fillText(r.op, opLeft, y); }
    ctx.textAlign = "right";
    if (r.blank) drawUnderscore(ctx, numRight, y, numW);
    else { ctx.fillStyle = "#fff"; ctx.fillText(r.text, numRight, y); }
    y += ROW_H;
  }

  const ruleY = by + PAD + rows.length * ROW_H + 1;
  ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx + PAD * 0.6, ruleY); ctx.lineTo(bx + bw - PAD * 0.6, ruleY); ctx.stroke();

  y = ruleY + ROW_H / 2 + 1;
  ctx.textAlign = "right";
  if (result.blank) drawUnderscore(ctx, numRight, y, numW);
  else { ctx.fillStyle = "#fff"; ctx.fillText(result.text, numRight, y); }
}

// ---------- registry + dispatch ----------

const FORMATS = {
  inline: { parse: false, draw: drawInline },
  column: { parse: true,  draw: drawColumn },
};

// Entry point used by render.js. opts: { cx, baselineY, text, color, mirror? }
export function drawEquation(ctx, opts) {
  const fmt = FORMATS[state.eqFormat] || FORMATS.inline;
  fmt.draw(ctx, fmt.parse ? parseEquation(opts.text) : null, opts);
}
