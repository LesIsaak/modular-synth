---
name: ModulePanel memoization & prop stability
description: Why ModulePanel must stay React.memo'd and every prop at its call site must be referentially stable, or audio timing jitters.
---

# ModulePanel memoization is load-bearing for audio timing

`ModulePanel` is wrapped in `React.memo`. Every prop passed at its call site in
`synth-app.tsx` MUST be referentially stable across renders. If any prop gets a
new identity each render, memo bails and ALL panels re-render.

**Why:** audio is scheduled on the MAIN THREAD (the clock worker fires early and
`onmessage` schedules Web Audio nodes). Per-frame UI work that re-renders every
panel starves the main thread past the scheduler lookahead window, so scheduled
note times slip — the user hears jitter / rush-early / lag-late. The symptom
appears specifically "when I move the mouse or make patches" because:
- module drag calls `setModules(...)` once per RAF → new `modules` array each frame
- cable drag calls `setMousePos(...)` once per RAF

**How to apply (the rules that keep only the dragged panel committing):**
- Handlers passed to ModulePanel (`onPortClick`, `onPortDoubleClick`,
  `onPortHold`, `onDragStart`, …) must use the ref-trampoline pattern: read
  `modulesRef.current` / `cablesRef.current` / `pendingCableRef.current` inside
  the body and keep `useCallback` deps limited to lifetime-stable values
  (`getPortCenter`, `pushUndo`, `makeGateCb` are all `[]`-dep stable). Do NOT put
  `modules` or `cables` in their deps.
- Derived props must be memoized AND must not depend on module x/y. Gate level
  maps (`cvLevelMap`/`portLevelMap`) on `[cables, moduleTypeSig, started]` where
  `moduleTypeSig` is `modules.map(m => m.id+':'+m.typeId).join('|')` — not on the
  `modules` array. `connectedPortsSet` is `useMemo([cables])`.
- Per-module callback bundles are cached per module id via `getModuleCbs(id,typeId)`
  (Map ref + handler refs) instead of inline closures at the call site.
- Same staleness trap applies to any handler that snapshots state for undo
  (`pushUndo(cablesRef.current, modulesRef.current)`) — a `[]`-dep handler that
  closes over `cables`/`modules` captures first-render state.
