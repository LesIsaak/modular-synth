---
name: getPortLevel contract & indicator level resolution
description: How knob/port CV indicators pick a level fn, and the undefined-for-unhandled-port rule that keeps multi-output sources correct.
---

# getPortLevel contract

`AudioModuleNodes.getPortLevel?(portId) => number | undefined` is the per-port
variant of `getLevel`. A module returns a 0..1 level **only for ports it actually
reports on**, and `undefined` for every other port.

**Why:** the UI builds two level maps in `synth-app.tsx` — `cvLevelMap` (knob cyan
CV indicator) and `portLevelMap` (input-port glow). Both want the *source's*
per-port level so a multi-output source shows the right signal. But some modules
implement `getPortLevel` only for their CV **inputs** (e.g. seq `depth_cv`, bd_drum
`tune_cv`/`decay_cv`) while their generic `getLevel` reports the real **output**
level. If `getPortLevel` returned `0` for unhandled ports, preferring it over
`getLevel` would blank the indicator when such a module is used as a CV source via
its output port (e.g. `cv_out`).

**How to apply:**
- New `getPortLevel` impls: `return undefined` (not 0) for any port you don't
  explicitly handle.
- Callers must PROBE then fall back:
  `srcHasPort = !!getPortLevel && getPortLevel(fromPortId) !== undefined`.
  If true, use `() => getPortLevel(fromPortId) ?? 0`; else fall back to
  source `getLevel`; (cvLevelMap only) then dest `getPortLevel(toPortId) ?? 0`.
  Always coalesce `?? 0` so undefined never reaches indicator math.
- The keyboard's `getPortLevel('mod_out')` returns the live mod wheel position
  (`modSource.offset.value`, 0..1); its other ports fall back to the gate
  envelope. This is what makes ModWheel OUT → filter `res_cv` light the RES knob
  with wheel position instead of the gate decay.
- `cvLevelMap` and `portLevelMap` use the SAME probe/fallback logic — keep them in
  sync if you change one.
