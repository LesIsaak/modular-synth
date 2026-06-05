---
name: Distortion CV polling pattern
description: How to implement CV modulation for WaveShaper-based effects (overdrive, fuzz, wavefolder, bitcrusher, samplerate, saturator)
---

# Problem
`WaveShaper.curve` is a `Float32Array`, not an `AudioParam`. You cannot connect a Web Audio source directly to it for real-time modulation.

# Solution: AnalyserNode polling tap
Create a GainNode input + AnalyserNode tap, poll at 32ms intervals:

```ts
const cvIn = ctx.createGain(); cvIn.gain.value = 1;
const tap = ctx.createAnalyser(); tap.fftSize = 32;
cvIn.connect(tap);
const buf = new Float32Array(1);
const pollId = setInterval(() => {
  tap.getFloatTimeDomainData(buf);
  const cv = buf[0];
  if (Math.abs(cv) > 0.001) shaper.curve = recomputeCurve(p.param + cv * scale);
}, 32);
// In destroy: clearInterval(pollId); cvIn.disconnect(); tap.disconnect();
```

Register `cvIn` in the inputs Map: `['drive_cv', { node: cvIn }]`

**Why:** Same pattern as euclidean_trig and sampler CV taps. The `> 0.001` guard avoids curve recomputation when no CV is present (performance).

**How to apply:** Any module that modulates non-AudioParam state (lookup tables, curve arrays, buffer properties) from CV must use this polling pattern.
