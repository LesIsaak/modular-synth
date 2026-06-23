---
name: MIDI clock PLL phase correction
description: How the app phase-locks its free-running clock timers to the DAW's MIDI clock to prevent drift
---

## Rule
Free-running clockWorker timers always drift from the DAW. Phase corrections must come from MIDI tick timestamps, not from BPM interval updates.

**Why:** Continuous BPM interval pushes while locked cause random phase walk — the USB-jittered BPM estimate oscillates ±0.2 BPM, each push changes `intervalMs`, and this fights the PLL nudge causing progressive drift.

**How to apply:** Push BPM to clock modules ONLY on the unlocked → locked transition. After that, the PLL (nudge) owns all timing.

## Critical bugs to avoid

### BPM pushes while locked → progressive drift
`handleMidiClock` must check `!wasLocked && info.locked` before calling `setParam('bpm', ...)`. Continuous pushes while locked change `intervalMs` every beat with oscillating jitter values and cause growing phase walk that the PLL cannot correct.

### PLL deadband too large → PLL never fires at steady state
With a 0.1 BPM locked tempo error, steady-state phase error ≈ 1ms. The old 2ms deadband was larger than this, so no corrections ever fired after initial convergence and drift accumulated unchecked. Use 0.5ms deadband.

## Architecture

### clockWorker — `nudge` message
`{ type: 'nudge', id, adjustMs }` shifts `e.expectedAt += adjustMs` without resetting beat count or cancelling the pending setTimeout. Positive = fire later, negative = fire earlier.

`update` message only changes `intervalMs`, does NOT reset `expectedAt` or cancel pending timer — safe for BPM changes but must not be called repeatedly with jittered estimates while locked.

### audioEngine — `_lastClockBeatMainMs`
Updated on every clockWorker tick message: `scheduledAt + (origin ?? perf.timeOrigin) - perf.timeOrigin`. Converts worker-clock beat time to main-thread performance-clock ms. Exposed via `getLastClockBeatMainMs()`.

`nudgeAllClockTimers(adjustMs)` iterates `_activeClockNudgers` (Set parallel to `_activeClockRestarters`).

### useMIDI — `tickCount` + `onBeat` callback
`tickCount` increments on every 0xF8; resets to 0 on 0xFA/0xFB/0xFC. When `tickCount % 24 === 0` and locked, fires `onBeatRef.current(performance.now())`.

### SynthApp — `handleMidiBeat` (P-controller)
```
phaseError = getLastClockBeatMainMs() - (midiArrivalMs + syncOffsetMs)
if |phaseError| < 0.5 or > 240: skip
nudgeAllClockTimers(-phaseError × 0.4)   // 40% correction, converges in 3–5 beats
```
- 0.5ms lower bound — small enough to catch 1ms steady-state drift
- 240ms upper bound — catches stale `_lastClockBeatMainMs` from previous beat

### MIDI Sync Offset
User-adjustable `midiSyncOffsetMs` (−100 to +100ms, slider in MIDI Clock In panel, double-click = 0). Added to `midiArrivalMs` in PLL comparison to compensate for USB transmission delay. Negative = app fires earlier.

## Key rules
- Do NOT push BPM while locked — deadlock with PLL. Only push at lock-time transition.
- PLL deadband: 0.5ms (not 2ms).
- PLL nudge gain: 0.4 (safe P-controller — lower if beats "hunt"; raise if convergence slow).
- `_lastClockBeatMainMs` updated by ALL timers simultaneously; safe regardless of which writes last.
