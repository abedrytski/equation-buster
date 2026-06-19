// Equation generators (kid-friendly: 6yo). Pure functions — no game state.
// Each generator returns { text, answer }. `cap` is the difficulty's maxNum;
// `frac`/`min` derive a per-operand ceiling so harder enemies use bigger numbers.

export function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function operandCap(cap, frac, min) {
  return Math.max(min, Math.floor(cap * frac));
}

export function mkAdd(aMax, bMax) {
  const a = randInt(1, aMax), b = randInt(1, bMax);
  return { text: `${a}+${b}`, answer: a + b };
}

export function mkSubNonNeg(aMax) {
  const a = randInt(2, aMax), b = randInt(1, a - 1);
  return { text: `${a}-${b}`, answer: a - b };
}

export function mkAdd3(eachMax) {
  const a = randInt(1, eachMax), b = randInt(1, eachMax), c = randInt(1, eachMax);
  return { text: `${a}+${b}+${c}`, answer: a + b + c };
}

export function mkAdd5(eachMax) {
  const nums = [];
  for (let i = 0; i < 4; i++) nums.push(randInt(1, eachMax));
  return { text: nums.join("+"), answer: nums.reduce((a, b) => a + b, 0) };
}

export function eqAdd(cap, frac, min) {
  const m = operandCap(cap, frac, min);
  return mkAdd(m, m);
}

export function eqAddOrSub(cap, frac, min) {
  const m = operandCap(cap, frac, min);
  return Math.random() < 0.5 ? mkAdd(m, m) : mkSubNonNeg(m);
}

export function eqAdd3(cap, frac, min) {
  const m = operandCap(cap, frac, min);
  return mkAdd3(m);
}

export function eqAdd5(cap) {
  // matches yellow's per-operand cap (frac 0.25, min 2)
  const m = operandCap(cap, 0.25, 2);
  return mkAdd5(m);
}

// Generic N-operand addition. Used by enemy eq functions when additional_terms > 0.
export function mkAddN(count, eachMax) {
  const nums = [];
  for (let i = 0; i < count; i++) nums.push(randInt(1, eachMax));
  return { text: nums.join("+"), answer: nums.reduce((s, n) => s + n, 0) };
}

// N-operand addition with a per-operand floor (unlike mkAddN which starts at 1).
export function mkAddNFloor(count, lo, hi) {
  const nums = [];
  for (let i = 0; i < count; i++) nums.push(randInt(lo, hi));
  return { text: nums.join("+"), answer: nums.reduce((s, n) => s + n, 0) };
}

// Fill-in-the-blank addition: knownCount known addends + hidden "?" = their sum.
// e.g. knownCount=1 → "5+?=8", knownCount=2 → "3+5+?=11"
export function mkMissingAddend(knownCount, eachMax) {
  const known = [];
  for (let i = 0; i < knownCount; i++) known.push(randInt(1, eachMax));
  const missing = randInt(1, eachMax);
  const sum = known.reduce((s, n) => s + n, 0) + missing;
  return { text: `${known.join("+")}+?=${sum}`, answer: missing };
}

// Subtraction with a guaranteed minimum answer (aFloor).
// aFloor ≥ 2 required; aMax must be > aFloor.
export function mkSubFloor(aMax, aFloor) {
  const lo = Math.max(2, aFloor);
  const hi = Math.max(lo + 1, aMax);
  const a = randInt(lo + 1, hi);
  const b = randInt(1, a - lo);
  return { text: `${a}-${b}`, answer: a - b };
}
