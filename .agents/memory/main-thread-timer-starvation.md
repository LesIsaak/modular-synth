---
name: Main-thread timer starvation
description: Tight setInterval polling on the main thread starves sequencer/clock setTimeout scheduling, causing global audio latency across all modules.
---

# Main-thread timer starvation

Web Audio renders on a separate real-time thread, but module scheduling (clock,
sequencers, gate on/off) runs on the **main thread** via `setTimeout`. A tight
JS polling loop (`setInterval` at very small intervals, e.g. 6 ms / 167× per
second) outcompetes those timers, delaying their callbacks past the intended
audio timestamp — Chrome then outputs the events late, so *every* module feels
sluggish, not just the one doing the polling.

**Why:** the vocoder envelope follower polls AnalyserNodes from the main thread.
At 6 ms it caused global latency; the user reported "all the audio" lagged, not
just the vocoder. 32 ms felt laggy on the vocoder envelope itself; 16 ms (≈ rAF
cadence) is the sweet spot — responsive envelope, breathing room for the timer
queue.

**How to apply:** keep any main-thread AnalyserNode/CV polling at ~16 ms or
slower. Make the envelope/decay coefficient poll-interval-independent:
`coeff = exp(-(POLL_MS/1000) / max(0.001, timeConstantSeconds))` so the knob maps
to real seconds regardless of the chosen interval.
