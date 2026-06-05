---
name: poly_step port completeness
description: Full list of ports the poly_step engine registers vs what must be in moduleDefinitions.ts
---

# Engine outputs (all must have matching definition ports)
- `pos_cv`, `step_cv` — global position/step CV (cv_out)
- `t{1-8}_vel` — per-track velocity CV (cv_out)
- `clk_out` — clock passthrough (gate_out)
- `beat_out` — fires on track-1 step 0 (gate_out)
- `eoc_out` — master end-of-cycle (gate_out, fires when track 1 wraps)
- `t{1-8}_gate` — per-track step gates (gate_out)
- `t{1-8}_acc` — per-track accent gates (gate_out)
- `t{1-8}_eoc` — per-track end-of-cycle gates (gate_out)

# Engine inputs (portNoteOn + CV taps — all must have matching definition ports)
- `clk_in`, `rst_in` — standard gate inputs
- `run_in` — toggles run/stop state
- `fill_in` — toggles fill (all accents fire)
- `bpm_cv`, `swing_cv` — CV tap inputs (cv_in)

**Why:** Ports in the engine but missing from the definition can never be patched by the user — the UI won't render the jack.
