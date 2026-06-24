---
name: Granular synth scheduling pattern
description: How granular_synth module is implemented — scheduler, routing, CV, visualization
---

## Grain scheduler
- `runScheduler` runs every 30ms (TICK_MS) via `setTimeout`
- Fills an 80ms lookahead window (LOOKAHEAD=0.08s) ahead of `ctx.currentTime`
- Each grain: `AudioBufferSourceNode → GainNode (Hanning env) → StereoPannerNode → grainBus`
- `nextGrainAt` advances by `1/density + scatter_jitter` per grain
- Max 64 simultaneous grains (`MAX_GRAINS`)

## Output routing
```
grainBus (explicit stereo, 2ch) → ChannelSplitter(2) → outL / outR
grainBus → outMono (downmix)
grainBus → fbDelay → fbGain → grainBus  (feedback loop; valid because DelayNode is in path)
```
- `grainBus.channelCount = 2; channelCountMode = 'explicit'`
- Feedback capped at 0.9 (knob max) to prevent instability

## CV inputs (AnalyserNode tap pattern)
`makeTap()` → ConstantSource (offset=0) + AnalyserNode(fftSize=32); external signal added to `.offset` AudioParam via connectAudioPorts; `tap.read()` returns current value via `getFloatTimeDomainData`.
Taps: voctTap, posTap, sizeTap, densTap, scatTap, pitchCvTap.

## V/OCT handling
- If `voctTap.read() > 10 Hz` → use cable value as `baseFreq`
- Otherwise use `voctFreq` set by `noteOn(t, freq)` from keyboard
- Pitch in grains: `rate = 2^((pitchSt + pitchCV*12 + log2(baseFreq/440)*12 + randSt) / 12)`

## Waveform peaks
`computePeaks(buf)` → 512-point peak array using `new Float32Array(new ArrayBuffer(512*4))`  
**Why:** TypeScript strict mode requires the `new ArrayBuffer(N*4)` form for typed generic arrays.

## Visualization
`getGrainData()` returns `{ position: scanPos, grains: [{pos,size,pan,age}], hasBuffer, waveformPeaks }`.  
Exposed via `AudioModuleNodes.getGrainData` (optional field added to interface).  
Passed to ModulePanel via `getGrainDataFn` prop; `GranularSynthDisplay` component polls it with rAF.

## New 'synths' category
Added to `ModuleCategory` union in types.ts, `CATEGORY_ORDER` (first), `CATEGORY_LABELS`, `CATEGORY_COLORS` (#a78bfa violet).

## How to wire onLoadSample for non-sampler modules
In synth-app.tsx line ~2994: `(mod.typeId === 'sampler' || mod.typeId === 'granular_synth') ? cbs.onLoadSample : undefined`  
The `handleLoadSample` already calls `audio.loadSample` — the engine just needs to implement `loadSample`.
