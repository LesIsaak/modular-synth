// Runs entirely in a Web Worker thread — no DOM, no React, no main-thread contention.
// The main thread sends create/destroy/restart messages; the Worker posts tick events back.

type InMsg =
  | { type: 'create';  id: number; intervalMs: number }
  | { type: 'destroy'; id: number }
  | { type: 'restart'; id: number; intervalMs: number };

interface Entry {
  expectedAt: number;
  intervalMs: number;
  beat: number;
  timerId: ReturnType<typeof setTimeout> | null;
}

const timers = new Map<number, Entry>();

function schedule(id: number, entry: Entry) {
  const now = performance.now();
  const delay = Math.max(0, entry.expectedAt - now);
  entry.timerId = setTimeout(() => {
    const e = timers.get(id);
    if (!e) return;
    (self as unknown as Worker).postMessage({ type: 'tick', id, beat: e.beat++ });
    e.expectedAt += e.intervalMs;
    const nowAfter = performance.now();
    // Resync if we've fallen more than one interval behind (backgrounded tab, etc.)
    if (nowAfter - e.expectedAt > e.intervalMs) e.expectedAt = nowAfter;
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
