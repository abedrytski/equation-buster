// In-game debug panel (toggle with P). Lets you tweak state.config and player
// damage live without restarting — useful for calibrating difficulty.

import { state } from "../core/state.js";

let panelEl = null;

// Fields that live on state.config (set by difficultyForWorldLevel)
const CONFIG_FIELDS = [
  { key: "speedMult",   label: "Speed mult",     step: 0.05, min: 0.1,  max: 5    },
  { key: "spawnBase",   label: "Spawn interval", step: 0.1,  min: 0.1,  max: 6    },
  { key: "spawnDecay",  label: "Spawn decay",    step: 0.01, min: 0.5,  max: 1    },
  { key: "spawnMin",    label: "Spawn min",      step: 0.05, min: 0.05, max: 3    },
  { key: "hp_mult",     label: "HP mult",        step: 0.1,  min: 0.1,  max: 12   },
  { key: "maxNum",      label: "Max number",     step: 1,    min: 1,    max: 200  },
  { key: "enemyCapMax", label: "Enemy cap",      step: 1,    min: 1,    max: 8    },
];

// Fields that live directly on state
const STATE_FIELDS = [
  { key: "playerDamageMin", label: "Dmg min", step: 1, min: 1, max: 9999 },
  { key: "playerDamageMax", label: "Dmg max", step: 1, min: 1, max: 9999 },
];

function makeRow(id, label, step, min, max) {
  const row = document.createElement("div");
  row.className = "dbgRow";
  row.innerHTML = `<label class="dbgLabel">${label}</label>`
    + `<input class="dbgInput" id="${id}" type="number" step="${step}" min="${min}" max="${max}">`;
  return row;
}

function buildPanel() {
  const el = document.createElement("div");
  el.id = "debugPanel";
  el.hidden = true;

  const title = document.createElement("div");
  title.className = "dbgTitle";
  title.textContent = "DEBUG  [P] close";
  el.appendChild(title);

  const sep = (text) => {
    const s = document.createElement("div");
    s.className = "dbgSep";
    s.textContent = text;
    el.appendChild(s);
  };

  sep("— state.config —");
  for (const f of CONFIG_FIELDS) {
    const row = makeRow(`dbg_${f.key}`, f.label, f.step, f.min, f.max);
    el.appendChild(row);
    row.querySelector("input").addEventListener("input", (ev) => {
      if (!state.config) return;
      const v = parseFloat(ev.target.value);
      if (!isNaN(v)) state.config[f.key] = v;
    });
  }

  sep("— player —");
  for (const f of STATE_FIELDS) {
    const row = makeRow(`dbg_${f.key}`, f.label, f.step, f.min, f.max);
    el.appendChild(row);
    row.querySelector("input").addEventListener("input", (ev) => {
      const v = parseInt(ev.target.value, 10);
      if (!isNaN(v)) state[f.key] = v;
    });
  }

  document.getElementById("stage").appendChild(el);
  return el;
}

function syncValues() {
  if (!state.config) return;
  for (const f of CONFIG_FIELDS) {
    const inp = document.getElementById(`dbg_${f.key}`);
    if (inp) inp.value = +state.config[f.key].toFixed(4);
  }
  for (const f of STATE_FIELDS) {
    const inp = document.getElementById(`dbg_${f.key}`);
    if (inp) inp.value = state[f.key];
  }
}

export function toggleDebugPanel() {
  if (!panelEl) panelEl = buildPanel();
  const opening = panelEl.hidden;
  panelEl.hidden = !opening;
  if (opening) syncValues();
}

export function isDebugOpen() {
  return panelEl !== null && !panelEl.hidden;
}
