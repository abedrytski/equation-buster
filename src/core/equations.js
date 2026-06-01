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
