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
