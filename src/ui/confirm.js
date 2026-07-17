// Generic promise-based confirmation dialog. One shared overlay, reused for
// every prompt. Resolves true on confirm, false on cancel / backdrop tap /
// Escape. Enter confirms.
//
// While open it swallows keydown at the document level (which bubbles before
// the window-level game input handler in main.js), so typing in a dialog never
// leaks into the game.

const overlayEl  = document.getElementById("confirmOverlay");
const titleEl    = document.getElementById("confirmTitle");
const msgEl      = document.getElementById("confirmMsg");
const okBtnEl    = document.getElementById("confirmOk");
const cancelBtnEl = document.getElementById("confirmCancel");

let resolver = null;

function close(result) {
  if (!resolver) return;
  const done = resolver;
  resolver = null;
  overlayEl.hidden = true;
  document.removeEventListener("keydown", onKey);
  done(result);
}

function onKey(ev) {
  ev.stopPropagation();
  if (ev.key === "Escape") { ev.preventDefault(); close(false); }
  else if (ev.key === "Enter") { ev.preventDefault(); close(true); }
}

okBtnEl.addEventListener("click", () => close(true));
cancelBtnEl.addEventListener("click", () => close(false));
overlayEl.addEventListener("click", (ev) => { if (ev.target === overlayEl) close(false); });

export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  if (resolver) close(false); // cancel any prompt already open
  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtnEl.textContent = confirmLabel;
  okBtnEl.classList.toggle("danger", danger);
  overlayEl.hidden = false;
  document.addEventListener("keydown", onKey);
  return new Promise((resolve) => { resolver = resolve; });
}
