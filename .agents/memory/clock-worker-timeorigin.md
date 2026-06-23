---
name: Clock worker / main thread timeOrigin reconciliation
description: Why beat scheduling must convert the clock worker's performance timestamps into the main thread's perf timeline before mapping to AudioContext time.
---

# Clock worker timeOrigin reconciliation

The clock lives in a Web Worker (`clockWorker.ts`) that fires each beat `LOOKAHEAD_MS` early and posts a `scheduledAt` timestamp. The main thread (`audioEngine.ts` `getClockWorker` onmessage) converts that into an `AudioContext` time so voices can be scheduled sample-accurately ahead of the beat.

**Rule:** `scheduledAt` is in the WORKER's `performance.now()` domain, which has a DIFFERENT `performance.timeOrigin` than the main thread (a dedicated worker's origin is the moment it was created — e.g. the INITIALIZE click — not page navigation). The worker must ship `origin: performance.timeOrigin` with each tick, and the main thread must add `originDelta = (workerOrigin - mainOrigin)` before applying the audio/perf offset:
`scheduled = scheduledAt/1000 + originDelta/1000 + (ctx.currentTime - performance.now()/1000)`.

**Why:** Without the delta, the converted beat time lands seconds in the past, so `Math.max(currentTime+0.001, scheduled)` clamps EVERY beat to "fire now + 1ms". That defeats the look-ahead entirely and leaves timing at the mercy of main-thread render jitter — audible as severe timing jumps, worst on the drum machine (percussion exposes timing error most). This presented as "hardcore timejumps on the drum machine" even though the drum machine itself has no internal clock (it's fired purely by external gates that read the global `_currentTickAudioTime`).

**How to apply:** Any change to the worker→main tick message shape or the beat-time conversion must preserve the time-origin reconciliation. The math is delivery-latency independent (both `ctx.currentTime` and `performance.now()` sampled at receive time, so transit delay cancels) and a no-op when origins happen to match (`originDelta = 0`). Don't "simplify" it back to comparing worker timestamps against main-thread `performance.now()` directly.

## Per-tick offset jitter (second cause of global instability)

Reconciling the origins fixed the "clamp every beat to now" failure, but timing was STILL globally unstable because the perf→audio offset itself was resampled raw every tick: `offset = ctx.currentTime - performance.now()/1000`.

**Rule:** Do NOT recompute that offset fresh on every tick. `AudioContext.currentTime` only advances once per audio render-quantum, so reading `currentTime - performance.now()` at an arbitrary instant wobbles by up to a buffer each read, and that wobble lands directly in every scheduled beat time → audible jitter at ALL tempos (worst on drums). Instead: (1) sample a CORRELATED pair via `AudioContext.getOutputTimestamp()` (`contextTime` vs `performanceTime`) when available, falling back to `currentTime`/`performance.now()`; (2) low-pass the offset (`_clockOffset += 0.08 * (instant - _clockOffset)`); (3) snap to the raw sample on a discontinuity (`|delta| > 0.12s` or NaN init) so a new context / tab resume re-locks instantly; (4) reset `_clockOffset = NaN` whenever `_timingCtx` changes.

**Why:** A constant offset bias is inaudible (just fixed latency); only per-beat jitter is audible. Smoothing keeps the mapping stable while still tracking slow clock drift (audio hw clock vs system clock differ by ppm). getOutputTimestamp gives a jitter-free correlated pair so the smoother has less noise to reject.

**How to apply:** Keep the smoothing + snap. Don't revert to a per-tick raw offset. If residual drift appears after CPU stalls, lower the snap threshold or make it adaptive to the current interval — do not raise the smoothing alpha (that re-admits jitter).
