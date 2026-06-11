---
name: Patch-loaded params are untrusted
description: Loading/hand-edited .synth patches can carry out-of-range or NaN selector params; clamp array indices and guard the clock scheduler so a bad patch can't crash/freeze the whole app.
---

# Loaded patch params must be treated as untrusted

When a module reads a param to index an array (e.g. `waveGains[Math.round(p.wave)]`, `waveMap[...]`, `DIV_MULTS[...]`) the value can be out of range or NaN if it came from an old/hand-edited `.synth` patch.

**Rules:**
- Any array index derived from a selector/param must be bounds-clamped (`Number.isFinite` check + `Math.max(0, Math.min(len-1, n))`) or use `?? fallback`. `analog_vco.setSelector` previously had an unguarded `waveGains[Math.round(val)].connect()` — an out-of-range `wave` threw a TypeError.
- The clock scheduler chokepoint `makeClockTimer` must sanitize the interval: a non-finite or `<= 0` ms (from a corrupt `bpm`/`div`) makes the worker fire with a NaN/0 delay → runaway loop that freezes the tab (a perceived "crash"). Guarded via `safeInterval()`.

**Why:** `handleLoadPatch` (synth-app.tsx) tears down all audio FIRST, then applies selectors. A throw during selector application happens *after* teardown and *before* `setModules`, leaving the app silent with stale UI — looks like a hard crash and is invisible to fresh-context e2e (no autosave/patch to load). The per-selector call is now wrapped in try/catch so one bad selector can't abort the whole load.

**How to apply:** When adding a new module with a `setSelector` that indexes an array, clamp the index. Never trust that a param is within its selector's declared range on load. main.tsx already logs uncaught errors/rejections with a `[Synth]` prefix — check browser console for those when a "crash" is reported.
