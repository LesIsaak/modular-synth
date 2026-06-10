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
