---
name: MIDI clock → React re-render storm
description: Why high-rate external MIDI events (0xF8 clock, 24/beat) must be throttled before touching React state, or global audio timing jitters.
---

# MIDI clock re-render storm

`midi_clock_in` is a SOFT-SYNC module, not a wired clock source: it has no ports (`ports: []`) and its audioEngine case is a no-op. Its only job is to measure incoming MIDI BPM and, when the user presses LOCK TO DAW, push that BPM to every clock module's `bpm` param (each clock module's `setParam('bpm')` calls `timer.updateInterval()`, so live tempo does follow).

**Rule:** A MIDI clock tick (`0xF8`) arrives 24× per beat (~58×/sec at 145 BPM). Do NOT call `emitMidiClockInfo()` / `setState` / `setModules` on every tick. Each emit fans out to a React listener → `setMidiClockInfo` (re-render) and, when locked, a full `setModules` array rebuild → a re-render storm that starves the main thread and **shifts the global beat** (this is the "MIDI clock in shifts timing" bug). Throttle in the `0xF8` handler: emit only when BPM changed by ≥0.2 (or the sending device changed) AND ≥200ms since the last emit — hard-capped at ~5×/sec. Steady tempo ⇒ ~zero emits.

**Why:** The BPM display and the lock only need coarse updates; 5 Hz is plenty. The audio thread does not need the React update at all — `timer.updateInterval()` is what changes tempo. The hard 200ms floor must apply to the device-change path too: two devices both streaming clock would otherwise flip `deviceName` every tick and bypass the throttle, resurrecting the storm.

**How to apply:** Any new high-rate external input (MIDI clock, OSC, gamepad, sensor streams) that drives React state must be throttled/deduped at the source before `setState`. Keep the measurement loop running every event, but gate the React emission. Known remaining gap: BPM estimation and the throttle closure are shared across all MIDI inputs — true multi-device simultaneous clocking needs per-input state + a single selected clock source (not implemented; single-DAW use is fine).
