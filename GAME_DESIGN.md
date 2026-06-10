# Equations Buster — Game Design Reference

> A mobile-first, browser-based arithmetic action game. The player defeats
> waves of descending enemies by computing the answer to each enemy's
> equation. Vanilla JS (ES modules) + `<canvas>`, no build step; served by a
> tiny Deno static server (`serve.ts`). Internal repo name: `math-survivor`.
> Audience: casual mobile players (UI is English).

---

## 1. Core loop

1. Enemies spawn at the top and descend through **3 lanes** toward a **danger
   line** just above the input row.
2. Each enemy carries an **arithmetic equation** (e.g. `7+8`) rendered above it,
   with a hidden numeric `answer`.
3. The player submits an answer via a **row of up to 6 tappable answer "chips"**
   (or keyboard digits + Enter).
4. **Correct answer →** a laser fires at **every** enemy whose answer matches,
   dealing 1 HP each. Streak increments. Score awarded.
5. **Wrong answer →** screen shake + flash, **streak resets**, every *moving*
   enemy is shoved ~22 px closer to the player, chips reshuffle.
6. **Enemy crosses the danger line →** lose 1 life; nearby enemies (≤320 px) are
   wiped for breathing room (no XP). A **boss crossing the line is an instant
   game over.**

Run ends in **victory** after clearing wave 6 (the summoner), or **Game Over**
when lives hit 0.

---

## 2. Input system (the chips) — the heart of the "anti-shortcut" design

- `MAX_CHIPS = 6` tappable buttons.
- Chips are populated from **live enemy answers** (nearest threats first), then
  the remaining slots are filled with **decoys**.
- `SHUFFLE_CHIPS_ON_ANSWER = true`: positions reshuffle after *every* answer, so
  players can't memorize "the answer is always the 3rd chip."
- `CHIP_WRONG_LOCK = 0.35`s: brief lock after a wrong tap.

### Two layered anti-cheese mechanics (recently added)

These exist to stop players from solving without doing the arithmetic:

1. **Shared last digit across live enemies** (`dominantDigit` / `sharedEq` in
   `entities.js`). When spawning/regenerating an enemy, the generator is
   rejection-sampled so its answer **ends in the same units digit** as the
   other enemies on screen. The first enemy of a batch sets the digit; the rest
   converge on it.
2. **Confusable decoys** (`chips.js` step 3). Empty chip slots are filled with
   `target ± 10·k` values — **same last digit, neighbouring magnitude** — biased
   toward `−10` (the "forgot the carry" mistake). It balances the least-
   represented units digit so no answer is identifiable by its final digit.

**Net effect:** every chip in the row tends to end in the same digit (e.g. all
end in `7`: `57 67 77 87 97`), so the "just match the units digit" shortcut
returns nothing useful and the real answer looks like one more decoy. The player
must actually compute tens + carry.

### Other input

- Keyboard: digits build `state.input` (max `MAX_INPUT_LEN = 4`), Enter fires,
  Backspace deletes, Esc pauses.

---

## 3. Run structure / waves

- `MAX_WAVES = 6` — a full run is short.
- `BOSS_EVERY_N_WAVES = 3` → **waves 3 and 6 are boss waves.**
  - **Wave 3:** regular **Boss** (orbit → mirror → enrage phases).
  - **Wave 6:** the **Summoner** (final boss); clearing it = victory.
- `BREATHER_DURATION = 4`s between waves.
- **XP-budget spawning:** each non-boss wave has a budget
  `waveXpBudget = 4 + wave·8`. Each spawned enemy costs its `xp`. A wave is
  cleared when the budget is spent **and** the screen is empty. The XP bar is
  the wave-progress indicator.
- **Enemy cap:** `maxEnemiesForWave = min(MAX_ENEMIES=4, cfg.enemyCapMax,
  wave + cfg.enemyCapAdd)`. Hard ceiling of **4 on-screen at once** (keeps the
  chip row readable; boss minions are a deliberate exception — see §6).
- **Speed ramp:** `waveSpeedFactor = +5%/wave, capped at 2.0×`.
- **Lanes:** 3 lanes at x-fractions `0.22 / 0.50 / 0.78`. Enemies **queue up**
  within a lane (a faster enemy stops behind a slower leader). Spawn lane is
  chosen by least-busy + most head clearance; spawn is deferred if no lane has
  clearance.

---

## 4. Difficulties (chosen on the start screen each run)

| Param            | easy | medium | hard |
|------------------|------|--------|------|
| `maxNum` (number ceiling) | 20 | 50 | 100 |
| `enemyCapAdd`    | 2    | 3      | 4    |
| `enemyCapMax`    | 4    | 5      | 6    |
| `speedMult`      | 0.50 | 0.70   | 0.72 |
| `spawnBase` (s)  | 1.8  | 1.4    | 1.4  |
| `spawnDecay`     | 0.94 | 0.93   | 0.95 |
| `spawnMin` (s)   | 1.0  | 0.85   | 0.85 |

`maxNum` feeds each enemy type's per-operand cap, so harder difficulties use
bigger numbers. (Note the global cap of 4 enemies clamps `enemyCapMax` on
medium/hard.)

---

## 5. Streak & scoring

- **Streak tiers:** ≥3 → **2×**, ≥10 → **3×**, ≥20 → **5×** score multiplier.
- **Score per kill** = `xp × 10 × streakMult`.
- Streak resets on a **wrong answer** or **losing a life**.
- End screen shows: `Score · Wave reached · Best streak`.

---

## 6. Enemy roster (`TYPES` in `config.js`)

| Type      | Speed | HP | XP  | Equation                | Notes |
|-----------|-------|----|----|-------------------------|-------|
| **yellow**  | 38  | 1  | 1  | `a+b` (small)           | Basic grunt. |
| **ice**     | 0   | 1  | 4  | `a+b`                   | Stationary, 8 s lifetime. **Killing it freezes everything for 5 s.** Capped: 1/wave, never 2 at once, only spawns when ≥~60% of cap are movers. Gives *no* score (utility pickup). |
| **pink**    | 50  | 1  | 3  | `a+b` (bigger)          | Fast. |
| **green**   | 44  | 1  | 5  | `a±b`                   | Add or subtract. |
| **blue**    | 32  | 2  | 8  | `a±b` (big)             | 2 HP + shield; **regenerates its equation on each non-lethal hit** (can't spam one answer). |
| **hexagon** | 22  | 3  | 20 | `a+b+c`                 | Big, slow, tanky mini-threat. |
| **boss**    | 18+ | tier-scaled | 50×tier | phase-based | See below. |
| **mini**    | 0   | 1  | 6  | `a+b`                   | Orbits the regular boss (3 of them). |
| **summon**  | 0   | 1  | 5  | 4-number add            | Summoner's minions; 8 s lifetime. |

Multi-HP enemies (blue, hexagon, boss) **regenerate a fresh equation with a
different answer** after each non-lethal hit.

> ⚠️ Quirk: `eqAdd5` (used by `summon`) actually generates **4** operands, not
> 5 — the name is misleading.

---

## 7. Boss mechanics

### Regular Boss (wave 3) — `spawnBoss`

- Entrance **wipes the screen** (dramatic) and spawns the boss in the center
  lane, **invulnerable and without an equation**, ringed by **3 orbiting
  mini-bosses**.
- **Phase 1 (orbit):** boss is invulnerable. You must **kill all 3 minis**
  first.
- **Phase 2 (mirror):** killing the last mini *activates* the boss — it gets a
  mirrored `a±b` equation and becomes damageable.
- **Phase 3 (enrage):** once HP ≤ ⅔ max, **speed ×1.4** and the equation
  hardens to 3-number addition.
- HP = `1 + tier·2 + rand(0,1)`. Reward = `50×tier`.

### Summoner (wave 6, final) — `spawnSummoner`

- **Permanently invulnerable**, no equation of its own.
- Killed indirectly: **each minion you clear removes 1 HP** from the summoner.
- Continuously **tops minions back up to 3** (0.8 s cooldown), so you're racing
  its spawn rate.
- HP = `2 + tier·2 + rand(0,1)`. Reward = `100×tier`.

A boss reaching the danger line is an **instant game over**, and drags its
remaining minis off-screen with it.

> The cap of 4 enemies gates **regular wave spawns only**. Boss minis/summons
> bypass it (boss fights are denser by design).

---

## 8. Notable mechanics summary

- **Freeze (ice):** 5 s global pause of movement, spawning, lifetimes, and the
  summoner. The inter-wave breather still ticks.
- **Wrong-answer punishment:** shake/flash, streak reset, all movers pushed
  ~22 px closer, chips reshuffle.
- **Life-loss wipe:** crossing the danger line costs a life but clears enemies
  within 320 px (no XP) to prevent cascade deaths.
- **Lane queueing:** prevents enemy overlap; faster enemies stack behind slower
  leaders.

---

## 9. ❗ Meta-progression: currently ABSENT (opportunity area)

There is **no persistent meta-progression** today:

- No save/persistence between runs (no localStorage of any progress).
- No unlockables, currency, upgrades, or account/profile.
- Difficulty is re-chosen every run; it is not gated or unlocked.
- The only "memory" is the **end-of-run summary** (score / wave / best streak),
  which is not stored.
- A run is short and fixed (6 waves) with a hard victory at the end.

**Design-discussion hooks** (things that *don't* exist yet and could be added):
- Persistent best score / streak leaderboard.
- Unlockable difficulties or "endless" mode beyond wave 6.
- Currency from runs → upgrades (extra life, slower start, freeze charges,
  bigger chip row, hint/peek).
- Player progression tied to arithmetic skill (multiplication/division tiers,
  larger `maxNum` ladders).
- Cosmetics / new enemy or boss variants as unlocks.
- Daily challenge / seeded runs.

---

## 10. Code map (for reference)

```
src/
  main.js              entry: RAF loop, keyboard input, start-screen buttons
  game.js              startGame / goToStart (run lifecycle)
  core/
    config.js          ALL tunables + tables (difficulties, TYPES, spawn table)
    equations.js       pure equation generators
    state.js           single mutable game-state object + freshGameState()
    dom.js / view.js   DOM refs + canvas sizing/coords
  systems/
    waves.js           wave/streak/pacing math, enemy cap, XP bar progress
    entities.js        spawning (enemies, bosses, minis, summons), dominantDigit/sharedEq
    update.js          per-frame sim: wave phase machine, spawn cadence, movement, collisions
    combat.js          answer resolution: kills, multi-HP regen, summoner damage, scoring
    chips.js           the tappable answer row + confusable-decoy generation
  ui/
    render.js          canvas drawing
    audio.js           background/boss music
```

**Key constants live in `src/core/config.js`** — it's the single balancing
surface.
