---
name: MIDI clock PLL phase correction
description: How the app phase-locks its free-running clock timers to the DAW's MIDI clock to prevent drift
---

## Rule
Free-running clockWorker timers always drift from the DAW. Phase corrections must come from MIDI tick timestamps, not from BPM interval updates.

**Why:** Continuous BPM interval pushes (even with a small deadband) cause random phase walk — each `update` message shifts `expectedAt` slightly; oscillating estimates (+/−0.2 BPM) create a random walk that accumulates into audible drift within 30 s. The correct fix is to compare DAW beat arrival time against app scheduled beat time and nudge `expectedAt` directly.

## Architecture

### clockWorker — `nudge` message
`{ type: 'nudge', id, adjustMs }` shifts `e.expectedAt += adjustMs` without resetting beat count or cancelling the pending setTimeout. Positive = fire later, negative = fire earlier.

### audioEngine — `_lastClockBeatMainMs`
Updated on every clockWorker tick message: `scheduledAt + (origin ?? perf.timeOrigin) - perf.timeOrigin`. This converts the worker's scheduled beat time into main-thread performance-clock ms. Exposed via `getLastClockBeatMainMs()`.

`nudgeAllClockTimers(adjustMs)` iterates `_activeClockNudgers` (a Set parallel to `_activeClockRestarters`), registered/removed in `makeClockTimer`.

### useMIDI — `tickCount` + `onBeat` callback
`tickCount` increments on every 0xF8; resets to 0 on 0xFA/0xFB/0xFC transport messages. When locked and `tickCount % 24 === 0` (a quarter-note boundary), fires `onBeatRef.current(performance.now())`.

### SynthApp — `handleMidiBeat` (P-controller)
```
phaseError = getLastClockBeatMainMs() - midiArrivalMs
if |phaseError| < 2 or > 240: skip (noise / stale data)
nudgeAllClockTimers(-phaseError × 0.4)   // 40% correction, converges in 3–5 beats
```
Guard: `> 240 ms` catches stale `_lastClockBeatMainMs` from a previous sub-beat tick.

## Key rules
- Do NOT use continuous BPM interval pushes for phase correction (random walk).
- Deadband for BPM display/audio updates stays at 0.5 BPM (coarse gate only).
- PLL nudge gain 0.4 is a safe P-controller — lower if beats "hunt" audibly; raise if convergence is slow.
- `_lastClockBeatMainMs` is updated by ALL timers (clock_gen, drum_machine, etc.); because all timers fire at beat boundaries simultaneously (within LOOKAHEAD tolerance), the value is always the current quarter-note boundary regardless of which timer wrote it last.
