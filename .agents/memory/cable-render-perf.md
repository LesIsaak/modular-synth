---
name: Cable rendering & drag performance (synth-app)
description: Why the in-progress cable is drawn imperatively, and why PatchCables' memo-buster must be the post-commit layoutVersion (not modules).
---

# Cable rendering & drag performance

Two related, non-obvious rules for the patch-cable layer in `synth-app.tsx`.

## 1. The cable tail must NOT use React state on the per-RAF hot path
While a cable is being dragged (and during edge-scroll), mouse position updates
every animation frame. Writing that to React state (`setMousePos`) re-renders the
whole `SynthApp` each frame.

**Why it matters:** live MIDI `noteOn` schedules at `ctx.currentTime + 0.008`
(only ~8ms lead). Any main-thread task >8ms (a full re-render of the rack +
keyboard) shifts the note onset → audible jitter when the user plays a hardware
MIDI keyboard *while* patching. (Sequencer clock is tolerant — clockWorker has
~120ms lookahead — so this only bites the live-MIDI path.)

**How to apply:**
- Keep the cable-tail position in `mousePosRef` (a ref), never `useState`.
- Draw the in-progress cable in its own `<svg>` overlay via a `forwardRef`
  component (`PendingCablePreview`) updated *imperatively* — `setAttribute('d', …)`
  on the two paths + a `transform` on the plug `<g>` — through a `setMouse(x,y)`
  handle. RAF handlers call `pendingPreviewRef.current?.setMouse(x,y)`, no setState.
- Recompute the cable's `from` (source port center) inside `setMouse` every call:
  the source module can be dragged while a cable is pending, so a mount-cached
  origin goes stale.
- Memoize `FixedKeyboardPanel` (and any heavy sibling) so it can't re-render on
  unrelated parent updates; ensure every prop is stable (all callbacks `useCallback`).

## 2. PatchCables' memo-buster must be `cableLayoutVersion`, NOT `modules`
`PatchCables` is `React.memo`. Its endpoints come from `getPortCenter`, which reads
**live** `getBoundingClientRect` *during render*.

**Why it matters:** the render in which `modules` changes still sees PRE-commit
DOM, so cables would draw at the old port positions (or null). A post-commit
correction render is required. There is a `useLayoutEffect(() => setCableLayoutVersion(v=>v+1), [modules])`
that fires *after* commit, once port DOM exists. Passing `modules` as the memo-buster
fires one commit too early → on patch-load cables are missing (ports don't exist
yet) and after a module drop cables stay detached at the pre-snap position.

**How to apply:** pass `layoutVersion={cableLayoutVersion}` to `PatchCables`
(declared in props, intentionally *not* destructured/read — it exists only to bust
memo). This makes it redraw exactly once per module commit, always against fresh DOM.

## Residual per-frame React state (out of scope unless asked)
- MIDI CC/bend streams still call `setExtKbPitch`/`setExtKbMod`/`setMidiMonData`
  per message (100Hz+), re-rendering SynthApp.
- Module-drag still calls `setModules` per frame.
