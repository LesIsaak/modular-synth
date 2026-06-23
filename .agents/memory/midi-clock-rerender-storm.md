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
