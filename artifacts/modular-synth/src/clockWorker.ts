// Runs entirely in a Web Worker thread — no DOM, no React, no main-thread contention.
// The main thread sends create/destroy/restart messages; the Worker posts tick events back.
//
// LOOKAHEAD SCHEDULING
// Each tick message is sent LOOKAHEAD_MS *before* the beat is due.
// `scheduledAt` still carries the exact intended beat time (performance.now ms).
// The main thread converts this to an AudioContext timestamp and schedules audio there,
// so a React render that delays message delivery by up to ~LOOKAHEAD_MS causes zero
// audible drift — the audio node is already queued in the audio thread before the beat hits.

const LOOKAHEAD_MS = 120; // fire message this many ms before the beat

type InMsg =
  | { type: 'create';  id: number; intervalMs: number }
  | { type: 'destroy'; id: number }
  | { type: 'restart'; id: number; intervalMs: number };

interface Entry {
  expectedAt: number;  // performance.now() ms when the next beat SHOULD sound
  intervalMs: number;
  beat: number;
  timerId: ReturnType<typeof setTimeout> | null;
}

const timers = new Map<number, Entry>();

function schedule(id: number, entry: Entry) {
  const now = performance.now();
  // Fire LOOKAHEAD_MS early so the main thread has time to schedule the AudioNode
  const delay = Math.max(0, entry.expectedAt - LOOKAHEAD_MS - now);
  entry.timerId = setTimeout(() => {
    const e = timers.get(id);
    if (!e) return;
    const scheduledAt = e.expectedAt; // exact beat time — main thread schedules audio here
    (self as unknown as Worker).postMessage({ type: 'tick', id, beat: e.beat++, scheduledAt });
    e.expectedAt += e.intervalMs;
    const nowAfter = performance.now();
    // Resync if the tab was backgrounded and clocks diverged drastically
    if (nowAfter - e.expectedAt > e.intervalMs * 2) e.expectedAt = nowAfter + e.intervalMs;
    schedule(id, e);
  }, delay);
}

(self as unknown as Worker).onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;

  if (msg.type === 'create') {
    const entry: Entry = {
      expectedAt: performance.now() + msg.intervalMs,
      intervalMs: msg.intervalMs,
      beat: 0,
      timerId: null,
    };
    timers.set(msg.id, entry);
    schedule(msg.id, entry);

  } else if (msg.type === 'destroy') {
    const e = timers.get(msg.id);
    if (e?.timerId !== null) clearTimeout(e!.timerId!);
    timers.delete(msg.id);

  } else if (msg.type === 'restart') {
    const e = timers.get(msg.id);
    if (e) {
      if (e.timerId !== null) clearTimeout(e.timerId);
      e.beat = 0;
      e.intervalMs = msg.intervalMs;
      e.expectedAt = performance.now() + msg.intervalMs;
      schedule(msg.id, e);
    }
  }
};
