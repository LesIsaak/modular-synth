---
name: MIDI clock → React re-render storm
description: Why high-rate external MIDI events (0xF8 clock, 24/beat) must be throttled before touching React state, or global audio timing jitters.
---

# MIDI clock re-render storm

`midi_clock_in` is a SOFT-SYNC module, not a wired clock source: it has no ports (`ports: []`) and its audioEngine case is a no-op. Its only job is to measure incoming MIDI BPM and, when the user presses LOCK TO DAW, push that BPM to every clock module's `bpm` param (each clock module's `setParam('bpm')` calls `timer.updateInterval()`, so live tempo does follow).

**Rule:** A MIDI clock tick (`0xF8`) arrives 24× per beat (~58×/sec at 145 BPM). Do NOT call `emitMidiClockInfo()` / `setState` / `setModules` on every tick. Each emit fans out to a React listener → `setMidiClockInfo` (re-render) and, when locked, a full `setModules` array rebuild → a re-render storm that starves the main thread and **shifts the global beat** (this is the "MIDI clock in shifts timing" bug). Throttle in the `0xF8` handler: emit only when BPM changed by ≥0.2 (or the sending device changed) AND ≥200ms since the last emit — hard-capped at ~5×/sec. Steady tempo ⇒ ~zero emits.

**Why:** The BPM display and the lock only need coarse updates; 5 Hz is plenty. The audio thread does not need the React update at all — `timer.updateInterval()` is what changes tempo. The hard 200ms floor must apply to the device-change path too: two devices both streaming clock would otherwise flip `deviceName` every tick and bypass the throttle, resurrecting the storm.

**How to apply:** Any new high-rate external input (MIDI clock, OSC, gamepad, sensor streams) that drives React state must be throttled/deduped at the source before `setState`. Keep the measurement loop running every event, but gate the React emission. Known remaining gap: BPM estimation and the throttle closure are shared across all MIDI inputs — true multi-device simultaneous clocking needs per-input state + a single selected clock source (not implemented; single-DAW use is fine).

## Transport START mid-beat permanently shifts the clock phase

Symptom: pressing START/PLAY in the DAW mid-beat shifts the synth's drums/hihats and clock_mul/clock_gen timing (a lasting offset, not a glitch).

**Mechanism:** the clockWorker `update` message only mutates `intervalMs` and does `expectedAt += intervalMs` — it does NOT reschedule from `now`. So pushing even ONE wrong interval permanently offsets `expectedAt` (e.g. one 80-BPM interval among 145-BPM beats leaves a ~336ms phase shift forever). The source of the wrong interval: at transport start there's a clock discontinuity (DAW paused its 0xF8 stream while stopped, or startup ticks are irregular). The BPM estimator averaged across the stop-gap, produced a transient garbage BPM, and LOCK pushed it to every clock module.

**Rule:** A BPM estimator feeding a phase-preserving clock must never compute across a discontinuity. (1) Gap guard: track the previous tick time; if the gap exceeds the slowest valid interval (here >250ms, slower than 20 BPM @ 24 ppq) clear the timestamp buffer and re-measure. (2) Only emit from a FULL window of clean intervals, never a half-filled post-restart buffer. (3) Handle MIDI transport bytes (0xFA Start / 0xFB Continue / 0xFC Stop) by clearing the estimator — but the gap guard is the primary defence because many DAWs only stream 0xF8 and never send transport. With the throttle's "skip if BPM unchanged" rule, a clean restart at the same tempo pushes nothing, so the soft-synced clock is left phase-untouched (no shift) — the desired behaviour.

**Why:** worker `update` is intentionally phase-preserving for smooth tempo knob changes; that same property turns any transient estimate into a permanent error, so the estimate must be clean before it's ever pushed.

## Stable steady-state tempo estimate (median + EMA + deadband + full-precision push)

Symptom: BPM display "shifts so much" at a constant DAW tempo (used to pin at 120). Two compounding causes and their fixes:

**Rule (estimator):** Estimate the pulse period from the interval window with the MEDIAN, not the mean — clock bytes are timestamped on the main thread, so each interval carries event-delivery jitter and occasional very-late ticks; the mean lets one late tick skew the whole estimate (visible wobble + a bad interval pushed to the phase-preserving clocks). Then EMA-smooth the period (coeff ~0.2), and SNAP (reset the EMA accumulator to NaN) on any discontinuity — gap>250ms or transport 0xFA/0xFB/0xFC — so it never blends across a restart. Apply a ≥0.25 BPM deadband/hysteresis on the reported value: a steady tempo then pins to ONE value and, crucially, STOPS emitting/pushing once locked, so the clocks receive no new intervals and cannot phase-wander.

**Rule (push precision):** Push the FULL-PRECISION smoothed BPM to the clock modules (clamp to range only) — do NOT round, not even to an integer. Integer rounding flipped the pushed interval at .5 boundaries (120.4↔120.6 → 120↔121); each flip re-set the worker interval and wandered the phase. The panel rounds to 0.1 only for display (toFixed(1)). Full precision maps a steady tempo to one stable interval and minimises the residual tempo error the free-running clock accumulates.

**Why:** the clockWorker is phase-preserving (`update` only mutates `intervalMs`), so the only ways to keep a constant tempo phase-stable are (a) feed it the cleanest possible period and (b) stop feeding it once locked. Median+EMA+deadband does (b); full-precision does (a).

**Known remaining gap (NOT implemented): true zero-drift phase-lock.** The worker clocks still FREE-RUN at the locked interval; they are never re-anchored to the DAW's actual pulse phase. Any residual tempo-estimate error therefore accumulates linearly as drift over a long session. A proper fix is a PLL: on each accepted 0xF8 pulse (or each 24-pulse quarter boundary), feed a phase-error term into the worker to nudge `expectedAt` toward the DAW phase, correcting BOTH tempo and phase. This is a deliberate, higher-risk change to the fragile timing core and should be tested against a real DAW before shipping. The median+EMA+deadband+full-precision estimator is the low-risk path that restores the remembered "stable 120" behaviour for soft-sync use.
