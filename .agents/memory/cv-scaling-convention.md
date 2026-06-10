---
name: CV scaling convention
description: How CV magnitude works across the modular synth audio engine, and why res_cv inputs scale incoming CV.
---

# CV scaling convention

CV in this synth is in **natural destination units**, NOT normalized 0..1. Sources
output values sized for their typical target (e.g. LFO `depth` defaults to ~200 so it
sweeps cutoff in Hz). There is no global normalized CV bus.

**Consequence:** the keyboard mod wheel (`mod_out`) is the outlier — it emits 0..1.
Patched directly into a param it has almost no authority (e.g. +1 on a Q range of ~25).

**Decision:** scale at the **destination**, not the source. The mod wheel can be
patched to anything (cutoff Hz, Q 0..25, VCA gain 0..1, pitch, wavefolder), and each
destination has a different range — so no single source gain is correct. Boosting
`mod_out` would over-drive normalized destinations (VCA/amp tremolo) and still be too
weak for cutoff. The destination owns the scale (same philosophy as the morph filter's
`cv_amt` knob).

**How applied:** Q-targeting `res_cv` inputs route incoming CV through a `GainNode`
(`RES_CV_SCALE = 12`, defined at top of `createAudioModule`) before summing into the Q
AudioParam. Covers `filter_multi` group, `filter_lp18/24`, `filter_ota`, `filter_svf`,
`filter_morph`. `filter_ladder` is intentionally left unscaled — its `res_cv` targets
`fbGain.gain` (range ~0..0.9), already sensitive to a 0..1 source.

**Why it's safe:** the base RES knob still sets the intrinsic Q; CV is summed additively
on top, so no double-counting. LFO (large depth) → res_cv is now ×12 hotter, but
LFO→res was already extreme/unusable pre-fix (200 summed straight into Q), so this is
not a usable→broken regression.

**If broad patch compatibility ever matters:** add a per-filter `res_cv_amt` knob
(default 1) instead of hardwiring ×12.
