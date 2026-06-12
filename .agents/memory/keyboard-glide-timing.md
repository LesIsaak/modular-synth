---
name: Keyboard glide / legato note switching
description: Why mouse-drag glide on the on-screen keyboard must press the new note before releasing the old one.
---

# Keyboard glide (drag across keys) must press-new-before-release-old

When switching notes during a glide (mouse drag across keys, or any mono note
change), press the NEW note first, then release the old one.

**Why:** the keyboard engine callback (`handleKeyNote`) schedules gate triggers at
a single shared timestamp `ctx.currentTime + 0.008` for every call within the same
event tick. If you release the old note first (`onNote(old,false)`) it empties the
held list and fires `triggerOff(t)`; the immediately-following `onNote(new,true)`
fires `triggerOn(t)` at the SAME `t`. The noteOff and noteOn cancel on the ADSR and
the new note produces little or no sound — glide appears "broken."

Pressing new-first instead drives the engine's intended legato path: held list goes
`[old] -> [old,new]` (no retrigger, gate stays open, pitch slides via `applyPitch`
legato) then `-> [new]` when the old is released. Smooth glide, no cancellation.

**How to apply:** in `FixedKeyboardPanel.pressKey`, call `onNote(newFreq, true)`
THEN `if (hadPrev) onNote(prevFreq, false)`. Keep releasing the old note (don't just
leave it held) so notes never pile up in the engine's held list — that preserves the
HOLD-mode "it still holds" guarantee. Drag glide is wired via per-key
`onMouseDown` (set mouseDownRef + pressKey) and `onMouseEnter` (pressKey if
mouseDownRef), with a window `mouseup` releasing the held note.

# Note switch must re-fire the gate when GLIDE == 0 (so arps/envelopes follow)

A gate-driven module (esp. the **arpeggiator**) only samples a note when its gate
**fires**. The legato switch above deliberately does NOT re-fire the gate, so a held
note-switch never reaches the arp and it keeps playing the first note. Symptom:
"switching notes on hold doesn't change the note" — but ONLY in patches that route
the keyboard through the arp (keyboard GATE → arp, arp V/OCT → osc). In a direct
keyboard→osc patch it looks fine because pitch (V/OCT) follows the slide regardless.

**Decision (user-chosen):** when `GLIDE == 0`, a note switch re-triggers the gate so
gate-driven modules follow the new note even while held; when `GLIDE > 0`, keep the
smooth legato (no retrigger). **Why:** smooth pitch glide and gate-retrigger are
mutually exclusive on one shared gate cable, so GLIDE selects the mode.

**How to apply:** `handleKeyNote` tracks `activeFreqRef` = the freq currently driving
the gate (null = gate off). Retrigger = `triggerOff(t)` then `triggerOn(t+0.002, f)`
(the ~2ms offset avoids the same-timestamp off/on cancellation above). Guards that
matter: (1) on note-on, only retrigger when `freq !== activeFreqRef.current` — else
duplicate MIDI note-ons retrigger spuriously; (2) on note-off with notes still held,
fall back to the newest held note and retrigger only if it differs from
`activeFreqRef` — this makes the keyboard's press-new-then-release-old sequence NOT
double-trigger (release-old's fallback already equals activeFreq, so it's skipped),
while MIDI chord release-fallback still follows. Reset `activeFreqRef` to null
whenever held-note state is cleared globally.
