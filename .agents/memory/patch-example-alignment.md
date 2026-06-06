---
name: Patch example name & port alignment
description: Rules for keeping modulePatchExamples.ts aligned with moduleDefinitions.ts for the "Build in rack" feature.
---

## Module name aliases

`handleBuildPatch` in `synth-app.tsx` uses a `PATCH_MODULE_ALIASES` map (defined as a module-level constant before `SynthApp`) to resolve short/display labels to canonical type IDs. The resolver tries an exact `m.name` match first, then falls back to the alias map.

Aliases currently defined (label → type id):
- VCF → vcf, VCA → vca, Digital Osc → digital_osc
- VCF LP24 / Filter LP24 → filter_lp24, Wavetable Osc → wavetable_osc
- FM Osc → fm_osc, Harmonic Osc → harmonic_osc, Chord Osc → chord_osc
- VCF BP → filter_bp, Filter Ladder → filter_ladder, Filter SVF → filter_svf
- Filter Comb → filter_comb, Filter Formant → filter_formant
- VCA Expo → vca_expo, Drum Machine → drum_machine
- LFO Multi → lfo_multi, Arpeggiator → arpeggiator
- Clock Divider → clock_div, Delay Mod → delay_mod, Bitcrusher → bitcrusher
- Euclidean → euclidean_trig, Poly Step → poly_step

## Critical port name rules

**Output module** (`output`): inputs are `IN L` (audio_in) and `IN R` (audio_in). Never use bare `L` or `R`.

**Clock Gen** (`clock_gen`): outputs are `GATE`, `/2`, `/4`, `/8`. There is NO `CLK` output port.

**KNIGHT GATE** (`euclidean_trig`): inputs are `STPS`, `FILL`, `SHFT`, `SYNC` (gate_in). There is NO `CLK` input — use `SYNC` for external clock connections. It has its own BPM knob.

**Arpeggiator** (`arpeggiator`): gate input is `GATE`, V/OCT input is `V/OCT`. (Old examples incorrectly used `GATE IN` / `V/OCT IN`.)

**TECHNO DRUM** (`drum_machine`): trigger inputs are `K-TRG` (kick), `S-TRG` (snare), `HC-T` (hi-hat closed). Kick audio output is `K-OUT`, full mix is `MIX`.

**Poly Step** (`poly_step`): gate outputs are `KICK`, `SNR`, `HH·C`, `HH·O`, `CLAP`, `PERC`, `BASS`, `AUX`. Velocity CV outputs are `VEL1`–`VEL8`. Clock input is `CLK`.

**Clock Divider** (`clock_div`): output gate port is `GATE` (not `OUT`). Clock input is `CLK`.

**Sampler** (`sampler`): pitch CV input is `PTCH` (not `PITCH`).

**Why:** `handleBuildPatch` resolves cables by matching port names via `p.name.toUpperCase()`. Any mismatch silently drops the cable — the module gets added but no wire connects.
