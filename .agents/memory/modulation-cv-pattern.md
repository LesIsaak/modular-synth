---
name: Modulation CV doubling bug
description: How to correctly wire rateCv and depthCv in chorus/flanger/phaser/vibrato/tremolo without doubling
---

# The bug
When `lfo.frequency.value = p.rate` AND `rateCv.offset.value = p.rate`, the resulting frequency is doubled because Web Audio AudioParams sum all connected sources plus the `.value` property.

# The fix
- Set `lfo.frequency.value = p.rate` (the knob position / base value)
- Set `rateCv.offset.value = 0` (CV input adds delta on top of the knob)
- Connect `rateCv` to `lfo.frequency`
- `setParam('rate', val)` updates `lfo.frequency.value = val`
- For rate CV modulation, the CV signal additively shifts the LFO frequency

# depthCv pattern
- Set `lfoGain.gain.value = 0` (base is zero)
- Set `depthCv.offset.value = (p.depth ?? default) * scale` (initial value in scaled units)
- Connect `depthCv` to `lfoGain.gain` (ConstantSource node output drives the AudioParam)
- `setParam('depth', val)` updates `depthCv.offset.value = val * scale`
- When external CV is connected, it connects to `depthCv.offset` AudioParam, additively modulating the depth

**Why:** AudioParams sum `.value` + all connected audio signals. Setting both the base `.value` and a ConstantSource with the same value doubles the modulation depth / frequency.

**How to apply:** Any time a ConstantSource is used as a CV modulator for an AudioParam — always zero out the AudioParam's `.value` and put the initial value into the ConstantSource's offset.
