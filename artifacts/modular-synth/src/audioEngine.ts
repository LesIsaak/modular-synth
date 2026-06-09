// ─── Types ────────────────────────────────────────────────────────────────────
export interface AudioModuleNodes {
  outputs: Map<string, AudioNode>;
  inputs: Map<string, { node: AudioNode; param?: AudioParam }>;
  noteOn?: (time: number, freq: number) => void;
  noteOff?: (time: number) => void;
  setParam: (paramId: string, value: number) => void;
  setSelector?: (selectorId: string, value: number) => void;
  /** For sequencers/clocks: called by the rack when gate cables connect */
  setGateTrigger?: (fn: ((on: boolean, freq: number) => void) | null) => void;
  /** Per-port variant: allows modules with multiple gate_out ports to route differently */
  setPortGateTrigger?: (portId: string, fn: (on: boolean, freq: number) => void) => void;
  destroy: () => void;
  /** Only present on the 'output' module — used for the VU meter */
  analyser?: AnalyserNode;
  /** Current sequencer step — polled by the UI at ~30 fps */
  stepRef?: { value: number };
  /** Returns a 0–1 activity level; polled by the UI at ~60 fps for indicator LEDs */
  getLevel?: () => number;
  /** Per-port variant of getLevel — use when the module has multiple outputs at different rates */
  getPortLevel?: (portId: string) => number;
  /** Per-port gate handlers (e.g. individual drum voice triggers) */
  portNoteOn?: Map<string, (time: number, freq?: number) => void>;
  /** Gate-off counterpart to portNoteOn — called when a connected gate cable goes low */
  portNoteOff?: Map<string, (time: number, freq?: number) => void>;
  /** Sampler only: decode and store an ArrayBuffer into the given bank slot */
  loadSample?: (arrayBuffer: ArrayBuffer, bankIndex: number) => Promise<void>;
  /** Freeze only: instantly silence and clear the frozen loop */
  kill?: () => void;
  /** Audio Trig: start capture with a specific deviceId, or re-open the browser picker when omitted */
  triggerDeviceRepick?: (deviceId?: string) => void;
  /** Audio Trig: returns the label of the currently captured device */
  getDeviceLabel?: () => string;
  /** Audio Trig: returns all available audio input devices (non-empty after first permission grant) */
  getDeviceList?: () => { deviceId: string; label: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function makeIR(ctx: AudioContext, dur: number, decay: number, stereo = true): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(stereo ? 2 : 1, len, sr);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function makeSpringIR(ctx: AudioContext, dur: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let e = 1;
  for (let i = 0; i < len; i++) {
    e *= 0.9997;
    d[i] = (Math.random() * 2 - 1) * e + Math.sin(i * 0.09) * 0.06 * e;
  }
  return buf;
}

function makePlateIR(ctx: AudioContext, dur: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
  }
  return buf;
}

function makeHallIR(ctx: AudioContext, dur: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * dur);
  const pre = Math.floor(sr * 0.025);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      const env = Math.min(1, (i - pre) / (sr * 0.08)) * (1 - t) * (1 - t);
      d[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return buf;
}

const mkCurve = () => new Float32Array(new ArrayBuffer(512 * 4));

function softClip(amount: number): Float32Array<ArrayBuffer> {
  const c = mkCurve();
  for (let i = 0; i < 512; i++) { const x=(i*2/512)-1; c[i]=((Math.PI+amount)*x)/(Math.PI+amount*Math.abs(x)); }
  return c;
}

function hardClip(amount: number): Float32Array<ArrayBuffer> {
  const c = mkCurve();
  for (let i = 0; i < 512; i++) { const x=(i*2/512)-1; c[i]=Math.max(-1,Math.min(1,x*amount)); }
  return c;
}

function foldCurve(amount: number): Float32Array<ArrayBuffer> {
  const c = mkCurve();
  for (let i = 0; i < 512; i++) { const x=(i*2/512)-1; c[i]=Math.sin(x*Math.PI*Math.max(1,amount)); }
  return c;
}

function tanhCurve(amount: number): Float32Array<ArrayBuffer> {
  const c = mkCurve();
  for (let i = 0; i < 512; i++) { const x=(i*2/512)-1; c[i]=Math.tanh(x*amount); }
  return c;
}

function bitcrushCurve(bits: number): Float32Array<ArrayBuffer> {
  const c = mkCurve();
  const steps = Math.pow(2, Math.max(1, Math.min(16, bits)));
  for (let i = 0; i < 512; i++) { const x=(i*2/512)-1; c[i]=Math.round(x*steps)/steps; }
  return c;
}

function srReduceCurve(factor: number): Float32Array<ArrayBuffer> {
  const c = mkCurve(); const f = Math.max(1, Math.round(factor));
  for (let i = 0; i < 512; i++) { const x=(i*2/512)-1; c[i]=Math.round(x*(512/f))/(512/f); }
  return c;
}

function makeWavetable(ctx: AudioContext, position: number): PeriodicWave {
  const n = 512;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) imag[i] = (1 - position) * (i === 1 ? 1 : 0) + position * (1 / i);
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

/** Shared wet/dry mixer helper */
function wetDry(ctx: AudioContext, input: AudioNode, wet: AudioNode, mix: number) {
  const dryG = ctx.createGain();
  const wetG = ctx.createGain();
  const out = ctx.createGain();
  dryG.gain.value = 1 - mix;
  wetG.gain.value = mix;
  input.connect(dryG); dryG.connect(out);
  wet.connect(wetG); wetG.connect(out);
  return { out, dryG, wetG };
}

// ─── Clock/sequencer helpers ───────────────────────────────────────────────────
// The clock runs inside a dedicated Web Worker so that React renders and other
// main-thread work can't delay ticks.  Each makeClockTimer call registers a
// numbered timer in the worker; on every tick the worker posts a message back
// and we call the onTick callback on the main thread.

let _clockWorker: Worker | null = null;
let _clockTimerSeq = 0;
const _clockCallbacks = new Map<number, (beat: number) => void>();

// Scheduled AudioContext time for the tick currently being processed.
// Set to the exact beat time before each tick callback fires, reset to 0 after.
// Voice fire functions read this instead of ctx.currentTime so that late-arriving
// Worker messages (due to main-thread React renders) don't cause audible timing drift.
let _currentTickAudioTime = 0;

// Cached AudioContext reference — set on first createAudioModule call.
let _timingCtx: AudioContext | null = null;

/** Returns the AudioContext time for the tick currently being processed (0 outside a tick). */
export function getCurrentTickAudioTime(): number { return _currentTickAudioTime; }

function getClockWorker(): Worker {
  if (!_clockWorker) {
    _clockWorker = new Worker(new URL('./clockWorker.ts', import.meta.url), { type: 'module' });
    _clockWorker.onmessage = (ev: MessageEvent<{ type: string; id: number; beat: number; scheduledAt: number }>) => {
      if (ev.data.type === 'tick') {
        if (_timingCtx) {
          // Convert performance.now() timestamp → AudioContext time.
          // The two clocks have a stable offset once the context is running.
          const perfNowS   = performance.now() / 1000;
          const offset     = _timingCtx.currentTime - perfNowS;
          const scheduled  = ev.data.scheduledAt / 1000 + offset;
          // Clamp: can't schedule in the past; add 1 ms grace so tiny rounding never fires negative.
          _currentTickAudioTime = Math.max(_timingCtx.currentTime + 0.001, scheduled);
        }
        try { _clockCallbacks.get(ev.data.id)?.(ev.data.beat); } catch (err) {
          console.error('[Clock] tick callback threw:', err);
        }
        _currentTickAudioTime = 0;
      }
    };
  }
  return _clockWorker;
}

function makeClockTimer(getInterval: () => number, onTick: (beatIndex: number) => void) {
  const id = ++_clockTimerSeq;
  _clockCallbacks.set(id, onTick);
  const worker = getClockWorker();
  worker.postMessage({ type: 'create', id, intervalMs: getInterval() });

  return {
    restart: () => worker.postMessage({ type: 'restart', id, intervalMs: getInterval() }),
    // Send new intervalMs without resetting the clock — current beat plays on schedule,
    // next beat uses the new tempo. Use this for BPM/div knob changes instead of destroy+create.
    updateInterval: () => worker.postMessage({ type: 'update', id, intervalMs: getInterval() }),
    destroy: () => {
      worker.postMessage({ type: 'destroy', id });
      _clockCallbacks.delete(id);
    },
  };
}

// ─── Main factory ─────────────────────────────────────────────────────────────
export function createAudioModule(
  ctx: AudioContext,
  typeId: string,
  params: Record<string, number>,
): AudioModuleNodes {
  _timingCtx = ctx; // keep reference current so the Worker handler can convert timestamps
  const p = { ...params };

  const cancelAndHold = (param: AudioParam, t: number) => {
    if (typeof (param as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam }).cancelAndHoldAtTime === 'function') {
      (param as AudioParam & { cancelAndHoldAtTime: (t: number) => AudioParam }).cancelAndHoldAtTime(t);
    } else {
      const v = param.value;
      param.cancelScheduledValues(t);
      param.setValueAtTime(v, t);
    }
  };

  switch (typeId) {
    // ── Oscillators ─────────────────────────────────────────────────
    case 'analog_vco': {
      const waveTypes: OscillatorType[] = ['sawtooth', 'square', 'triangle', 'sine'];
      const waveIds = ['saw', 'sqr', 'tri', 'sin'] as const;
      const oscs = waveTypes.map(t => {
        const o = ctx.createOscillator(); o.type = t; o.frequency.value = 0; return o;
      });
      const voct = ctx.createConstantSource(); voct.offset.value = 0; voct.start();
      const pw = ctx.createConstantSource(); pw.offset.value = 0; pw.start();
      oscs.forEach(o => { o.detune.value = (p.fine ?? 0) * 100; voct.connect(o.frequency); o.start(); });
      // individual wave outputs
      const waveGains = oscs.map(() => { const g = ctx.createGain(); g.gain.value = 1; return g; });
      oscs.forEach((o, i) => o.connect(waveGains[i]));
      // main selector output
      const mainOut = ctx.createGain(); mainOut.gain.value = 1;
      let selectedIdx = Math.round(p.wave ?? 0);
      waveGains[selectedIdx].connect(mainOut);
      return {
        outputs: new Map<string, AudioNode>([
          ['out', mainOut],
          ['saw_out', waveGains[0]], ['sqr_out', waveGains[1]],
          ['tri_out', waveGains[2]], ['sin_out', waveGains[3]],
        ]),
        inputs: new Map([
          ['voct', { node: voct, param: voct.offset }],
          ['pw_cv', { node: pw, param: pw.offset }],
          ['sync_in', { node: voct }],
        ]),
        noteOn: (_t, freq) => { voct.offset.value = freq; },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'fine') oscs.forEach(o => { o.detune.value = val * 100; });
        },
        setSelector: (id, val) => {
          if (id === 'wave') {
            waveGains[selectedIdx].disconnect(mainOut);
            selectedIdx = Math.round(val);
            waveGains[selectedIdx].connect(mainOut);
          }
        },
        destroy: () => {
          voct.stop(); voct.disconnect(); pw.stop(); pw.disconnect();
          oscs.forEach(o => { o.stop(); o.disconnect(); });
          waveGains.forEach(g => g.disconnect()); mainOut.disconnect();
        },
      };
    }

    case 'digital_osc': {
      const osc = ctx.createOscillator();
      const waveMap: OscillatorType[] = ['square', 'sawtooth', 'triangle', 'sine'];
      osc.type = waveMap[Math.round(p.wave ?? 0)] ?? 'square';
      osc.frequency.value = p.freq ?? 220;
      const voct = ctx.createConstantSource();
      voct.offset.value = 0;
      voct.connect(osc.frequency);
      voct.start(); osc.start();
      let lastNoteFreq = p.freq ?? 220;
      return {
        outputs: new Map([['out', osc]]),
        inputs: new Map([['voct', { node: voct, param: voct.offset }]]),
        noteOn: (_t, freq) => {
          lastNoteFreq = freq;
          voct.offset.value = freq * Math.pow(2, Math.round(p.octave ?? 0));
        },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') { osc.frequency.value = val; lastNoteFreq = val; }
          if (id === 'octave') voct.offset.value = lastNoteFreq * Math.pow(2, Math.round(val));
        },
        setSelector: (id, val) => {
          if (id === 'wave') osc.type = waveMap[Math.round(val)] ?? 'square';
        },
        destroy: () => { voct.stop(); voct.disconnect(); osc.stop(); osc.disconnect(); },
      };
    }

    case 'wavetable_osc': {
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(makeWavetable(ctx, p.pos ?? 0));
      osc.frequency.value = p.freq ?? 220;
      const morphCs = ctx.createConstantSource();
      morphCs.offset.value = p.morph ?? 0;
      const voct = ctx.createConstantSource();
      voct.offset.value = 0;
      voct.connect(osc.frequency);
      voct.start(); osc.start(); morphCs.start();
      return {
        outputs: new Map([['out', osc]]),
        inputs: new Map([
          ['voct', { node: voct, param: voct.offset }],
          ['morph_in', { node: morphCs, param: morphCs.offset }],
        ]),
        noteOn: (_t, freq) => { voct.offset.value = freq; },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') osc.frequency.value = val;
          if (id === 'pos' || id === 'morph') {
            osc.setPeriodicWave(makeWavetable(ctx, p.pos ?? 0));
          }
        },
        destroy: () => {
          voct.stop(); voct.disconnect(); morphCs.stop(); morphCs.disconnect();
          osc.stop(); osc.disconnect();
        },
      };
    }

    case 'fm_osc': {
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = p.carrier_freq ?? 220;
      const modulator = ctx.createOscillator();
      modulator.type = 'sine';
      modulator.frequency.value = (p.carrier_freq ?? 220) * (p.ratio ?? 2);
      const modGain = ctx.createGain();
      modGain.gain.value = (p.index ?? 3) * modulator.frequency.value;
      modulator.connect(modGain); modGain.connect(carrier.frequency);
      const voct = ctx.createConstantSource();
      voct.offset.value = 0;
      voct.connect(carrier.frequency); voct.connect(modulator.frequency);
      voct.start(); carrier.start(); modulator.start();
      return {
        outputs: new Map([['out', carrier]]),
        inputs: new Map([
          ['voct', { node: voct, param: voct.offset }],
          ['mod_in', { node: modGain, param: modGain.gain }],
        ]),
        noteOn: (_t, freq) => {
          voct.offset.value = freq;
          modulator.frequency.value = freq * (p.ratio ?? 2);
          modGain.gain.value = (p.index ?? 3) * modulator.frequency.value;
        },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'carrier_freq') { carrier.frequency.value = val; modulator.frequency.value = val * (p.ratio ?? 2); }
          if (id === 'ratio') { modulator.frequency.value = (p.carrier_freq ?? 220) * val; }
          if (id === 'index') modGain.gain.value = val * modulator.frequency.value;
        },
        destroy: () => {
          voct.stop(); voct.disconnect();
          carrier.stop(); carrier.disconnect();
          modulator.stop(); modulator.disconnect();
          modGain.disconnect();
        },
      };
    }

    case 'harmonic_osc': {
      const merge = ctx.createGain();
      merge.gain.value = 0.3;
      const oscs: OscillatorNode[] = [];
      const gains: GainNode[] = [];
      const baseFreq = p.freq ?? 110;
      for (let h = 1; h <= 4; h++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = baseFreq * h;
        g.gain.value = p[`h${h}`] ?? (1 / h);
        o.connect(g); g.connect(merge);
        o.start(); oscs.push(o); gains.push(g);
      }
      const voct = ctx.createConstantSource();
      voct.offset.value = 0;
      voct.start();
      const setHarmonicFreq = (freq: number) => {
        for (let h = 0; h < oscs.length; h++) oscs[h].frequency.value = freq * (h + 1);
      };
      return {
        outputs: new Map([['out', merge]]),
        inputs: new Map([['voct', { node: voct, param: voct.offset }]]),
        noteOn: (_t, freq) => setHarmonicFreq(freq),
        portNoteOn: new Map([
          ['gate_in', (_t: number, freq?: number) => { if (freq) setHarmonicFreq(freq); }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') setHarmonicFreq(val);
          if (id.startsWith('h')) gains[parseInt(id[1]) - 1].gain.value = val;
        },
        destroy: () => {
          voct.stop(); voct.disconnect();
          oscs.forEach(o => { o.stop(); o.disconnect(); });
          gains.forEach(g => g.disconnect());
          merge.disconnect();
        },
      };
    }

    case 'chord_osc': {
      const chordIntervals: number[][] = [
        [0, 4, 7],        // MAJ
        [0, 3, 7],        // MIN
        [0, 5, 7],        // SUS4
        [0, 3, 6],        // DIM
        [0, 4, 8],        // AUG
        [0, 4, 7, 10],    // 7TH
      ];
      const MAX_VOICES = 4; // enough for 7TH (4 notes)
      const merge = ctx.createGain(); merge.gain.value = 0.28;
      const oscs: OscillatorNode[] = [];
      const oscGains: GainNode[] = [];
      for (let i = 0; i < MAX_VOICES; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = p.freq ?? 220;
        g.gain.value = 0; // silenced until noteOn activates voices
        o.connect(g); g.connect(merge);
        o.start();
        oscs.push(o); oscGains.push(g);
      }
      let lastFreq = p.freq ?? 220;
      const applyChord = (freq: number) => {
        lastFreq = freq;
        const intv = chordIntervals[Math.round(p.chord ?? 0)] ?? chordIntervals[0];
        const spread = p.spread ?? 1;
        for (let i = 0; i < MAX_VOICES; i++) {
          if (i < intv.length) {
            // spread stretches/compresses intervals but keeps root at exact pitch
            oscs[i].frequency.value = freq * Math.pow(2, intv[i] * spread / 12);
            oscGains[i].gain.value = 1;
          } else {
            oscGains[i].gain.value = 0; // silence unused voices
          }
        }
      };
      applyChord(lastFreq); // initialise to default freq
      return {
        outputs: new Map([['out', merge]]),
        inputs: new Map(),
        noteOn: (_t, freq) => applyChord(freq),
        portNoteOn: new Map([
          ['gate_in', (_t: number, freq?: number) => applyChord(freq ?? lastFreq)],
        ]),
        setParam: (id, val) => { p[id] = val; if (id === 'freq' || id === 'spread') applyChord(lastFreq); },
        setSelector: (id, val) => { p[id] = val; applyChord(lastFreq); },
        destroy: () => {
          oscs.forEach(o => { o.stop(); o.disconnect(); });
          oscGains.forEach(g => g.disconnect());
          merge.disconnect();
        },
      };
    }

    case 'noise': {
      const bufSize = 2 * 44100;
      const whiteBuf = (() => {
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
        return buf;
      })();
      const pinkBuf = (() => {
        const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
        for (let i = 0; i < bufSize; i++) {
          const w = Math.random() * 2 - 1;
          b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
          b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
          b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
          d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
        }
        return buf;
      })();
      let src = ctx.createBufferSource();
      src.buffer = Math.round(p.color ?? 0) === 1 ? pinkBuf : whiteBuf;
      src.loop = true;
      const gain = ctx.createGain(); gain.gain.value = p.level ?? 0.8;
      src.connect(gain); src.start();
      return {
        outputs: new Map([['out', gain]]),
        inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'level') gain.gain.value = val; },
        setSelector: (id, val) => {
          if (id === 'color') {
            src.stop(); src.disconnect();
            src = ctx.createBufferSource();
            src.buffer = Math.round(val) === 1 ? pinkBuf : whiteBuf;
            src.loop = true; src.connect(gain); src.start();
          }
        },
        destroy: () => { try { src.stop(); } catch(_){} src.disconnect(); gain.disconnect(); },
      };
    }

    // ── Filters (single-stage) ───────────────────────────────────────
    case 'vcf':
    case 'filter_lp6':
    case 'filter_hp':
    case 'filter_bp':
    case 'filter_br':
    case 'filter_notch':
    case 'filter_multi': {
      const typeMap: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];
      const defaultType: Record<string, BiquadFilterType> = {
        vcf: 'lowpass', filter_lp6: 'lowpass', filter_hp: 'highpass',
        filter_bp: 'bandpass', filter_br: 'notch', filter_notch: 'notch', filter_multi: 'lowpass',
      };
      const f = ctx.createBiquadFilter();
      f.type = defaultType[typeId] ?? 'lowpass';
      f.frequency.value = p.cutoff ?? 1000;
      f.Q.value = typeId === 'filter_lp6' ? 0.5 : (p.res ?? 1);
      return {
        outputs: new Map([['out', f]]),
        inputs: new Map([
          ['audio_in', { node: f }],
          ['cutoff_cv', { node: f, param: f.frequency }],
          ['res_cv', { node: f, param: f.Q }],
          ['fm_in', { node: f }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          const t = ctx.currentTime;
          if (id === 'cutoff') { f.frequency.cancelScheduledValues(t); f.frequency.setTargetAtTime(val, t, 0.008); }
          if (id === 'res')    { f.Q.cancelScheduledValues(t); f.Q.setTargetAtTime(val, t, 0.008); }
        },
        setSelector: (id, val) => {
          if (id === 'type') f.type = typeMap[Math.round(val)] ?? 'lowpass';
        },
        destroy: () => f.disconnect(),
      };
    }

    // ── Multi-stage filters ──────────────────────────────────────────
    case 'filter_lp18':
    case 'filter_lp24': {
      const stages = typeId === 'filter_lp18' ? 3 : 4;
      const filters = Array.from({ length: stages }, () => {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = p.cutoff ?? 800;
        f.Q.value = (p.res ?? 1) / stages;
        return f;
      });
      for (let i = 0; i < stages - 1; i++) filters[i].connect(filters[i + 1]);
      return {
        outputs: new Map([['out', filters[stages - 1]]]),
        inputs: new Map([
          ['audio_in', { node: filters[0] }],
          ['cutoff_cv', { node: filters[0], param: filters[0].frequency }],
          ['res_cv', { node: filters[0], param: filters[0].Q }],
          ['fm_in', { node: filters[0] }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          const t = ctx.currentTime;
          if (id === 'cutoff') filters.forEach(f => { f.frequency.cancelScheduledValues(t); f.frequency.setTargetAtTime(val, t, 0.008); });
          if (id === 'res')    filters.forEach(f => { f.Q.cancelScheduledValues(t); f.Q.setTargetAtTime(val / stages, t, 0.008); });
        },
        destroy: () => filters.forEach(f => f.disconnect()),
      };
    }

    case 'filter_ladder': {
      const N = 4;
      const filters = Array.from({ length: N }, () => {
        const f = ctx.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.value = p.cutoff ?? 800; f.Q.value = 0.5; return f;
      });
      for (let i = 0; i < N - 1; i++) filters[i].connect(filters[i + 1]);
      const fbGain = ctx.createGain();
      fbGain.gain.value = Math.min(0.9, (p.res ?? 0.5) * 0.22);
      filters[N - 1].connect(fbGain); fbGain.connect(filters[0]);
      return {
        outputs: new Map([['out', filters[N - 1]]]),
        inputs: new Map([
          ['audio_in', { node: filters[0] }],
          ['cutoff_cv', { node: filters[0], param: filters[0].frequency }],
          ['res_cv', { node: fbGain, param: fbGain.gain }],
          ['fm_in', { node: filters[0] }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          const t = ctx.currentTime;
          if (id === 'cutoff') filters.forEach(f => { f.frequency.cancelScheduledValues(t); f.frequency.setTargetAtTime(val, t, 0.008); });
          if (id === 'res')    { fbGain.gain.cancelScheduledValues(t); fbGain.gain.setTargetAtTime(Math.min(0.9, val * 0.22), t, 0.008); }
        },
        destroy: () => { filters.forEach(f => f.disconnect()); fbGain.disconnect(); },
      };
    }

    case 'filter_ota': {
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.value = p.cutoff ?? 800; f.Q.value = p.res ?? 1;
      const pre = ctx.createWaveShaper(); pre.curve = softClip(p.drive ?? 2);
      pre.connect(f);
      return {
        outputs: new Map([['out', f]]),
        inputs: new Map([
          ['audio_in', { node: pre }],
          ['cutoff_cv', { node: f, param: f.frequency }],
          ['res_cv', { node: f, param: f.Q }],
          ['fm_in', { node: pre }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'cutoff') f.frequency.value = val;
          if (id === 'res') f.Q.value = val;
          if (id === 'drive') pre.curve = softClip(val);
        },
        destroy: () => { pre.disconnect(); f.disconnect(); },
      };
    }

    case 'filter_svf': {
      const input = ctx.createGain(); input.gain.value = 1;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      const notch = ctx.createBiquadFilter(); notch.type = 'notch';
      [lp, hp, bp, notch].forEach(f => {
        f.frequency.value = p.cutoff ?? 800; f.Q.value = p.res ?? 1; input.connect(f);
      });
      return {
        outputs: new Map<string, AudioNode>([['out_lp', lp], ['out_hp', hp], ['out_bp', bp], ['out_notch', notch]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['cutoff_cv', { node: lp, param: lp.frequency }],
          ['res_cv', { node: lp, param: lp.Q }],
          ['fm_in', { node: input }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'cutoff') [lp, hp, bp, notch].forEach(f => { f.frequency.value = val; });
          if (id === 'res') [lp, hp, bp, notch].forEach(f => { f.Q.value = val; });
        },
        destroy: () => { input.disconnect(); [lp, hp, bp, notch].forEach(f => f.disconnect()); },
      };
    }

    case 'filter_comb': {
      const delay = ctx.createDelay(1); delay.delayTime.value = 1 / (p.freq ?? 500);
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.5;
      const dryG = ctx.createGain(); dryG.gain.value = 1 - (p.mix ?? 0.5);
      const wetG = ctx.createGain(); wetG.gain.value = p.mix ?? 0.5;
      const out = ctx.createGain(); out.gain.value = 1;
      const input = ctx.createGain(); input.gain.value = 1;
      input.connect(delay); input.connect(dryG); dryG.connect(out);
      delay.connect(fb); fb.connect(delay);
      delay.connect(wetG); wetG.connect(out);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') delay.delayTime.value = 1 / val;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, delay, fb, dryG, wetG, out].forEach(n => n.disconnect()); },
      };
    }

    case 'filter_formant': {
      // Vowel formants: F1, F2, F3 Hz (approximate)
      const vowels = [
        [800, 1200, 2500], // A
        [400, 2300, 2700], // E
        [300, 2700, 3200], // I
        [500, 900, 2800],  // O
        [300, 800, 2300],  // U
      ];
      const input = ctx.createGain(); input.gain.value = 1;
      const out = ctx.createGain(); out.gain.value = 0.4;
      let bands: BiquadFilterNode[] = [];
      const setVowel = (v: number) => {
        bands.forEach(b => b.disconnect());
        const freqs = vowels[Math.round(v)] ?? vowels[0];
        bands = freqs.map(freq => {
          const f = ctx.createBiquadFilter(); f.type = 'bandpass';
          f.frequency.value = freq; f.Q.value = 8;
          input.connect(f); f.connect(out); return f;
        });
      };
      setVowel(p.vowel ?? 0);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => { p[id] = val; },
        setSelector: (id, val) => { if (id === 'vowel') setVowel(val); },
        destroy: () => { input.disconnect(); bands.forEach(b => b.disconnect()); out.disconnect(); },
      };
    }

    case 'filter_morph': {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
      const lpG = ctx.createGain(); const hpG = ctx.createGain();
      const out = ctx.createGain(); out.gain.value = 1;
      const morph = p.morph ?? 0;
      lpG.gain.value = 1 - morph; hpG.gain.value = morph;

      // audio_in splitter — feeds both lp and hp so the full morph range works
      const inSplit = ctx.createGain(); inSplit.gain.value = 1;
      inSplit.connect(lp); inSplit.connect(hp);
      lp.connect(lpG); hp.connect(hpG); lpG.connect(out); hpG.connect(out);

      // ConstantSource drives BOTH filter frequencies from one param.
      // Setting filter.frequency.value = 0 means all cutoff comes from cutoffCs.
      const cutoffCs = ctx.createConstantSource();
      cutoffCs.offset.value = p.cutoff ?? 1000;
      cutoffCs.start();
      lp.frequency.value = 0; hp.frequency.value = 0;
      cutoffCs.connect(lp.frequency); cutoffCs.connect(hp.frequency);

      // CV AMT: scales incoming CV before it adds to cutoffCs.offset.
      // gain = cv_amt knob value (0–20×). Default 1 = same as raw CV depth.
      const cvAmtGain = ctx.createGain();
      cvAmtGain.gain.value = p.cv_amt ?? 1;
      cvAmtGain.connect(cutoffCs.offset);

      // Same pattern for resonance
      const resCs = ctx.createConstantSource();
      resCs.offset.value = p.res ?? 1;
      resCs.start();
      lp.Q.value = 0; hp.Q.value = 0;
      resCs.connect(lp.Q); resCs.connect(hp.Q);

      const morphCs = ctx.createConstantSource(); morphCs.offset.value = morph; morphCs.start();
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in',  { node: inSplit }],
          ['cutoff_cv', { node: cvAmtGain }],
          ['res_cv',    { node: resCs,   param: resCs.offset   }],
          ['morph_cv',  { node: morphCs, param: morphCs.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'cutoff') cutoffCs.offset.value = val;
          if (id === 'res')    resCs.offset.value = val;
          if (id === 'morph')  { lpG.gain.value = 1 - val; hpG.gain.value = val; }
          if (id === 'cv_amt') cvAmtGain.gain.value = val;
        },
        destroy: () => {
          cutoffCs.stop(); cutoffCs.disconnect();
          resCs.stop();    resCs.disconnect();
          morphCs.stop();  morphCs.disconnect();
          [lp, hp, lpG, hpG, out, inSplit, cvAmtGain].forEach(n => n.disconnect());
        },
      };
    }

    // ── Amplifiers ───────────────────────────────────────────────────
    case 'vca': {
      const gain = ctx.createGain(); gain.gain.value = p.gain ?? 0;
      const offsetCs = ctx.createConstantSource(); offsetCs.offset.value = p.offset ?? 0; offsetCs.start();
      offsetCs.connect(gain.gain);
      return {
        outputs: new Map([['out', gain]]),
        inputs: new Map([
          ['audio_in', { node: gain }],
          ['cv_in', { node: gain, param: gain.gain }],
          ['offset_cv', { node: offsetCs, param: offsetCs.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          const t = ctx.currentTime;
          if (id === 'gain')   { gain.gain.cancelScheduledValues(t); gain.gain.setTargetAtTime(val, t, 0.008); }
          if (id === 'offset') { offsetCs.offset.cancelScheduledValues(t); offsetCs.offset.setTargetAtTime(val, t, 0.008); }
        },
        destroy: () => { offsetCs.stop(); offsetCs.disconnect(); gain.disconnect(); },
      };
    }

    case 'vca_expo': {
      const gain = ctx.createGain(); gain.gain.value = 0;
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(512);
      for (let i = 0; i < 512; i++) {
        const x = i / 512;
        curve[i] = Math.pow(x, 3);
      }
      shaper.curve = curve;
      const offsetCs = ctx.createConstantSource(); offsetCs.offset.value = p.offset ?? 0; offsetCs.start();
      offsetCs.connect(gain.gain);
      return {
        outputs: new Map([['out', gain]]),
        inputs: new Map([
          ['audio_in', { node: gain }],
          ['cv_in', { node: gain, param: gain.gain }],
          ['offset_cv', { node: offsetCs, param: offsetCs.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'gain') gain.gain.value = Math.pow(val, 3);
          if (id === 'offset') offsetCs.offset.value = val;
        },
        destroy: () => { offsetCs.stop(); offsetCs.disconnect(); gain.disconnect(); },
      };
    }

    case 'vca_dual': {
      const g1 = ctx.createGain(); g1.gain.value = p.gain1 ?? 0.8;
      const g2 = ctx.createGain(); g2.gain.value = p.gain2 ?? 0.8;
      return {
        outputs: new Map([['out1', g1], ['out2', g2]]),
        inputs: new Map([
          ['in1', { node: g1 }], ['cv1', { node: g1, param: g1.gain }],
          ['in2', { node: g2 }], ['cv2', { node: g2, param: g2.gain }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'gain1') g1.gain.value = val;
          if (id === 'gain2') g2.gain.value = val;
        },
        destroy: () => { g1.disconnect(); g2.disconnect(); },
      };
    }

    // ── Dynamics ─────────────────────────────────────────────────────
    case 'compressor': {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = p.threshold ?? -24;
      comp.ratio.value = p.ratio ?? 4;
      comp.attack.value = p.attack ?? 0.003;
      comp.release.value = p.release ?? 0.25;
      comp.knee.value = 6;
      return {
        outputs: new Map([['out', comp]]),
        inputs: new Map([['audio_in', { node: comp }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'threshold') comp.threshold.value = val;
          if (id === 'ratio') comp.ratio.value = val;
          if (id === 'attack') comp.attack.value = val;
          if (id === 'release') comp.release.value = val;
        },
        destroy: () => comp.disconnect(),
      };
    }

    case 'limiter': {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = p.threshold ?? -3;
      comp.ratio.value = 20;
      comp.attack.value = 0.001;
      comp.release.value = p.release ?? 0.1;
      comp.knee.value = 0;
      return {
        outputs: new Map([['out', comp]]),
        inputs: new Map([['audio_in', { node: comp }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'threshold') comp.threshold.value = val;
          if (id === 'release') comp.release.value = val;
        },
        destroy: () => comp.disconnect(),
      };
    }

    case 'expander': {
      // Expand below threshold: use gain + DynamicsCompressor with inverse logic
      const inp = ctx.createGain(); inp.gain.value = 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = p.threshold ?? -40;
      comp.ratio.value = 0.5; // below 1 = expansion
      comp.attack.value = 0.01; comp.release.value = 0.1; comp.knee.value = 3;
      inp.connect(comp);
      return {
        outputs: new Map([['out', comp]]),
        inputs: new Map([['audio_in', { node: inp }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'threshold') comp.threshold.value = val;
          if (id === 'ratio') comp.ratio.value = 1 / Math.max(1, val);
        },
        destroy: () => { inp.disconnect(); comp.disconnect(); },
      };
    }

    case 'noise_gate': {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = p.threshold ?? -50;
      comp.ratio.value = 20;
      comp.attack.value = p.attack ?? 0.01;
      comp.release.value = p.release ?? 0.1;
      comp.knee.value = 0;
      return {
        outputs: new Map([['out', comp]]),
        inputs: new Map([['audio_in', { node: comp }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'threshold') comp.threshold.value = val;
          if (id === 'attack') comp.attack.value = val;
          if (id === 'release') comp.release.value = val;
        },
        destroy: () => comp.disconnect(),
      };
    }

    case 'sidechain': {
      const mainIn = ctx.createGain(); mainIn.gain.value = 1;
      const scIn = ctx.createGain(); scIn.gain.value = 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = p.threshold ?? -20;
      comp.ratio.value = p.ratio ?? 8;
      comp.attack.value = p.attack ?? 0.005;
      comp.release.value = p.release ?? 0.15;
      comp.knee.value = 3;
      // Route sidechain signal to compressor's sidechain (key) input
      mainIn.connect(comp);
      // Sidechain input drives the reduction via the compressor's key input
      scIn.connect(comp);
      return {
        outputs: new Map([['out', comp]]),
        inputs: new Map([
          ['audio_in', { node: mainIn }],
          ['sc_in', { node: scIn }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'threshold') comp.threshold.value = val;
          if (id === 'ratio') comp.ratio.value = val;
          if (id === 'attack') comp.attack.value = val;
          if (id === 'release') comp.release.value = val;
        },
        destroy: () => { mainIn.disconnect(); scIn.disconnect(); comp.disconnect(); },
      };
    }

    // ── Envelopes ────────────────────────────────────────────────────
    case 'adsr': {
      const cv = ctx.createConstantSource();
      cv.offset.value = 0; cv.start();
      const eoc = ctx.createConstantSource(); eoc.offset.value = 0; eoc.start();
      let gateOpen = false;
      let noteOnTime = 0;
      const doAttack = (time: number) => {
        gateOpen = true; noteOnTime = time;
        const a = p.attack ?? 0.01, d = p.decay ?? 0.1, s = p.sustain ?? 0.7;
        const DC = 0.003;
        cancelAndHold(cv.offset, time);
        cv.offset.linearRampToValueAtTime(0, time + DC);
        cv.offset.linearRampToValueAtTime(1, time + DC + a);
        cv.offset.linearRampToValueAtTime(s, time + DC + a + d);
        eoc.offset.setValueAtTime(1, time + DC + a + d); eoc.offset.setValueAtTime(0, time + DC + a + d + 0.01);
      };
      return {
        outputs: new Map([['env_out', cv], ['eoc_out', eoc]]),
        inputs: new Map([
          ['gate_in', { node: cv }],
        ]),
        portNoteOn: new Map([
          // retrig_in: restart attack from current level without waiting for gate-off
          ['retrig_in', (time: number) => { try { doAttack(time); } catch (_) {} }],
        ]),
        noteOn: (time, _freq) => { try { doAttack(time); } catch (_) {} },
        noteOff: (time) => {
          try {
            gateOpen = false;
            const r = p.release ?? 0.3;
            cancelAndHold(cv.offset, time);
            cv.offset.linearRampToValueAtTime(0, time + r);
          } catch (_) {}
        },
        setParam: (id, val) => {
          p[id] = val;
          if (!gateOpen) return;
          try {
            const now = ctx.currentTime;
            const a = p.attack ?? 0.01, d = p.decay ?? 0.1;
            const inSustain = now >= noteOnTime + a + d;
            if (id === 'sustain' && inSustain) {
              cv.offset.cancelScheduledValues(now);
              cv.offset.linearRampToValueAtTime(val, now + 0.015);
            } else if ((id === 'attack' || id === 'decay') && !inSustain) {
              const s = p.sustain ?? 0.7;
              const fullEnd = noteOnTime + (p.attack ?? 0.01) + (p.decay ?? 0.1);
              if (fullEnd > now) {
                cv.offset.cancelScheduledValues(now);
                cv.offset.setValueAtTime(cv.offset.value, now);
                cv.offset.linearRampToValueAtTime(s, fullEnd);
              }
            }
          } catch (_) {}
        },
        destroy: () => { try { cv.stop(); } catch(_){} cv.disconnect(); try { eoc.stop(); } catch(_){} eoc.disconnect(); },
      };
    }

    case 'ahdsr': {
      const cv = ctx.createConstantSource();
      cv.offset.value = 0; cv.start();
      const eoc = ctx.createConstantSource(); eoc.offset.value = 0; eoc.start();
      let gateOpen = false;
      let noteOnTime = 0;
      const doAttackAhdsr = (time: number) => {
        gateOpen = true; noteOnTime = time;
        const a = p.attack ?? 0.01, h = p.hold ?? 0.05, d = p.decay ?? 0.15, s = p.sustain ?? 0.6;
        const DC = 0.003;
        cancelAndHold(cv.offset, time);
        cv.offset.linearRampToValueAtTime(0, time + DC);
        cv.offset.linearRampToValueAtTime(1, time + DC + a);
        cv.offset.setValueAtTime(1, time + DC + a + h);
        cv.offset.linearRampToValueAtTime(s, time + DC + a + h + d);
        eoc.offset.setValueAtTime(1, time + DC + a + h + d); eoc.offset.setValueAtTime(0, time + DC + a + h + d + 0.01);
      };
      return {
        outputs: new Map([['env_out', cv], ['eoc_out', eoc]]),
        inputs: new Map([
          ['gate_in', { node: cv }],
        ]),
        portNoteOn: new Map([
          ['retrig_in', (time: number) => { try { doAttackAhdsr(time); } catch (_) {} }],
        ]),
        noteOn: (time, _freq) => { try { doAttackAhdsr(time); } catch (_) {} },
        noteOff: (time) => {
          try {
            gateOpen = false;
            const r = p.release ?? 0.4;
            cancelAndHold(cv.offset, time);
            cv.offset.linearRampToValueAtTime(0, time + r);
          } catch (_) {}
        },
        setParam: (id, val) => {
          p[id] = val;
          if (!gateOpen) return;
          const now = ctx.currentTime;
          const a = p.attack ?? 0.01, h = p.hold ?? 0.05, d = p.decay ?? 0.15;
          const inSustain = now >= noteOnTime + a + h + d;
          if (id === 'sustain' && inSustain) {
            cv.offset.cancelScheduledValues(now);
            cv.offset.linearRampToValueAtTime(val, now + 0.015);
          }
        },
        destroy: () => { try { cv.stop(); } catch(_){} cv.disconnect(); try { eoc.stop(); } catch(_){} eoc.disconnect(); },
      };
    }

    // ── LFOs ─────────────────────────────────────────────────────────
    case 'lfo': {
      const waveMap: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];
      const allOscs = waveMap.map(t => {
        const o = ctx.createOscillator(); o.type = t;
        o.frequency.value = p.rate ?? 1; o.start();
        return o;
      });
      const allGains = allOscs.map(() => {
        const g = ctx.createGain(); g.gain.value = p.depth ?? 200; return g;
      });
      allOscs.forEach((o, i) => o.connect(allGains[i]));
      const mainGain = ctx.createGain(); mainGain.gain.value = 1;
      let selIdx = Math.round(p.wave ?? 0);
      allGains[selIdx].connect(mainGain);
      // rateCv starts at 0 — it's an additive CV input, not the base frequency
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = 0; rateCv.start();
      rateCv.connect(allOscs[0].frequency); rateCv.connect(allOscs[1].frequency);
      rateCv.connect(allOscs[2].frequency); rateCv.connect(allOscs[3].frequency);
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = 0; depthCv.start();
      return {
        outputs: new Map<string, AudioNode>([
          ['cv_out', mainGain],
          ['sin_out', allGains[0]], ['tri_out', allGains[1]],
          ['saw_out', allGains[2]], ['sqr_out', allGains[3]],
        ]),
        inputs: new Map([
          ['rate_cv',  { node: rateCv,  param: rateCv.offset  }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
          ['reset_in', { node: rateCv }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          const t = ctx.currentTime;
          if (id === 'rate')  allOscs.forEach(o => { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(val, t, 0.012); });
          if (id === 'depth') allGains.forEach(g => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(val, t, 0.008); });
        },
        setSelector: (id, val) => {
          if (id === 'wave') {
            allGains[selIdx].disconnect(mainGain);
            selIdx = Math.round(val);
            allGains[selIdx].connect(mainGain);
          }
        },
        getLevel: () => (Math.sin(2 * Math.PI * (p.rate ?? 1) * ctx.currentTime) + 1) / 2,
        destroy: () => {
          try { rateCv.stop(); } catch(_){} rateCv.disconnect(); try { depthCv.stop(); } catch(_){} depthCv.disconnect();
          allOscs.forEach(o => { try { o.stop(); } catch(_){} o.disconnect(); });
          allGains.forEach(g => g.disconnect()); mainGain.disconnect();
        },
      };
    }

    case 'lfo_analog': {
      const waveMap: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];
      const allOscs = waveMap.map(t => {
        const o = ctx.createOscillator(); o.type = t; o.frequency.value = p.rate ?? 0.5; return o;
      });
      const drift = ctx.createOscillator(); drift.frequency.value = 0.07;
      const driftGain = ctx.createGain(); driftGain.gain.value = (p.drift ?? 0.2) * 0.3;
      drift.connect(driftGain);
      allOscs.forEach(o => { driftGain.connect(o.frequency); o.start(); });
      drift.start();
      const allGains = allOscs.map(() => { const g = ctx.createGain(); g.gain.value = p.depth ?? 200; return g; });
      allOscs.forEach((o, i) => o.connect(allGains[i]));
      const mainGain = ctx.createGain(); mainGain.gain.value = 1;
      let selIdx = Math.round(p.wave ?? 0);
      allGains[selIdx].connect(mainGain);
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = 0; rateCv.start();
      rateCv.connect(allOscs[0].frequency); rateCv.connect(allOscs[1].frequency);
      rateCv.connect(allOscs[2].frequency); rateCv.connect(allOscs[3].frequency);
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = 0; depthCv.start();
      return {
        outputs: new Map<string, AudioNode>([
          ['cv_out', mainGain],
          ['sin_out', allGains[0]], ['tri_out', allGains[1]],
          ['saw_out', allGains[2]], ['sqr_out', allGains[3]],
        ]),
        inputs: new Map([
          ['rate_cv',  { node: rateCv,  param: rateCv.offset  }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          const t = ctx.currentTime;
          if (id === 'rate')  allOscs.forEach(o => { o.frequency.cancelScheduledValues(t); o.frequency.setTargetAtTime(val, t, 0.012); });
          if (id === 'depth') allGains.forEach(g => { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(val, t, 0.008); });
          if (id === 'drift') { driftGain.gain.cancelScheduledValues(t); driftGain.gain.setTargetAtTime(val * 0.3, t, 0.008); }
        },
        setSelector: (id, val) => {
          if (id === 'wave') {
            allGains[selIdx].disconnect(mainGain);
            selIdx = Math.round(val);
            allGains[selIdx].connect(mainGain);
          }
        },
        getLevel: () => (Math.sin(2 * Math.PI * (p.rate ?? 0.5) * ctx.currentTime) + 1) / 2,
        destroy: () => {
          try { rateCv.stop(); } catch(_){} rateCv.disconnect(); try { depthCv.stop(); } catch(_){} depthCv.disconnect();
          try { drift.stop(); } catch(_){} drift.disconnect(); driftGain.disconnect();
          allOscs.forEach(o => { try { o.stop(); } catch(_){} o.disconnect(); });
          allGains.forEach(g => g.disconnect()); mainGain.disconnect();
        },
      };
    }

    case 'lfo_digital': {
      const waveTypes: OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
      const allOscs = waveTypes.map(t => {
        const o = ctx.createOscillator(); o.type = t; o.frequency.value = p.rate ?? 2; o.start(); return o;
      });
      const allGains = allOscs.map(() => { const g = ctx.createGain(); g.gain.value = p.depth ?? 200; return g; });
      allOscs.forEach((o, i) => o.connect(allGains[i]));
      const mainGain = ctx.createGain(); mainGain.gain.value = 1;
      let selIdx = Math.round(p.wave ?? 0);
      allGains[selIdx].connect(mainGain);
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = 0; rateCv.start();
      allOscs.forEach(o => rateCv.connect(o.frequency));
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = 0; depthCv.start();
      return {
        outputs: new Map<string, AudioNode>([
          ['cv_out', mainGain],
          ['sin_out', allGains[0]], ['sqr_out', allGains[1]],
          ['saw_out', allGains[2]], ['tri_out', allGains[3]],
        ]),
        inputs: new Map([
          ['rate_cv',  { node: rateCv,  param: rateCv.offset  }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate')  allOscs.forEach(o => { o.frequency.value = val; });
          if (id === 'depth') allGains.forEach(g => { g.gain.value = val; });
        },
        setSelector: (id, val) => {
          if (id === 'wave') {
            allGains[selIdx].disconnect(mainGain);
            selIdx = Math.round(val);
            allGains[selIdx].connect(mainGain);
          }
        },
        getLevel: () => (Math.sin(2 * Math.PI * (p.rate ?? 2) * ctx.currentTime) + 1) / 2,
        destroy: () => {
          try { rateCv.stop(); } catch(_){} rateCv.disconnect(); try { depthCv.stop(); } catch(_){} depthCv.disconnect();
          allOscs.forEach(o => { try { o.stop(); } catch(_){} o.disconnect(); });
          allGains.forEach(g => g.disconnect()); mainGain.disconnect();
        },
      };
    }

    case 'lfo_multi': {
      const sinO = ctx.createOscillator(); sinO.type = 'sine'; sinO.frequency.value = p.rate ?? 1;
      const triO = ctx.createOscillator(); triO.type = 'triangle'; triO.frequency.value = p.rate ?? 1;
      const sawO = ctx.createOscillator(); sawO.type = 'sawtooth'; sawO.frequency.value = p.rate ?? 1;
      const sqrO = ctx.createOscillator(); sqrO.type = 'square'; sqrO.frequency.value = p.rate ?? 1;
      const oscs = [sinO, triO, sawO, sqrO];
      const gains = oscs.map(() => { const g = ctx.createGain(); g.gain.value = p.depth ?? 200; return g; });
      oscs.forEach((o, i) => { o.connect(gains[i]); o.start(); });
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = 0; rateCv.start();
      oscs.forEach(o => rateCv.connect(o.frequency));
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = 0; depthCv.start();
      return {
        outputs: new Map([
          ['sin_out', gains[0]], ['tri_out', gains[1]],
          ['saw_out', gains[2]], ['sqr_out', gains[3]],
        ]),
        inputs: new Map([
          ['rate_cv',  { node: rateCv,  param: rateCv.offset  }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
          ['reset_in', { node: rateCv }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate')  oscs.forEach(o => { o.frequency.value = val; });
          if (id === 'depth') gains.forEach(g => { g.gain.value = val; });
        },
        getLevel: () => (Math.sin(2 * Math.PI * (p.rate ?? 1) * ctx.currentTime) + 1) / 2,
        destroy: () => {
          try { rateCv.stop(); } catch(_){} rateCv.disconnect(); try { depthCv.stop(); } catch(_){} depthCv.disconnect();
          oscs.forEach(o => { try { o.stop(); } catch(_){} o.disconnect(); });
          gains.forEach(g => { try { g.disconnect(); } catch(_){} });
        },
      };
    }

    // ── Sequencers ───────────────────────────────────────────────────
    case 'seq_step': {
      const freqNode = ctx.createConstantSource();
      freqNode.offset.value = 0; freqNode.start();
      let step = 0;
      const stepRef = { value: 0 };
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      let lastExtClkMs = -Infinity;
      const getMs = () => 60000 / (p.bpm ?? 120);
      const doStep = () => {
        const ms = getMs();
        const midi = Math.round(p[`s${step + 1}`] ?? (60 + step));
        const freq = midiToHz(midi);
        stepRef.value = step;
        freqNode.offset.value = freq;
        gateCb?.(true, freq);
        setTimeout(() => gateCb?.(false, freq), ms * 0.45);
        step = (step + 1) % Math.max(1, Math.round(p.steps ?? 8));
      };
      let timer = makeClockTimer(getMs, () => {
        // Suppress internal clock when external CLK is patched (auto-detect)
        if (performance.now() - lastExtClkMs < getMs() * 2) return;
        doStep();
      });
      return {
        outputs: new Map([['voct_out', freqNode]]),
        inputs: new Map(),
        stepRef,
        portNoteOn: new Map([
          ['clock_in',  () => { lastExtClkMs = performance.now(); queueMicrotask(() => doStep()); }],
          ['reset_in',  () => { step = 0; stepRef.value = 0; }],
        ]),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') timer.updateInterval(); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); gateCb = null; try { freqNode.stop(); } catch(_){} freqNode.disconnect(); },
      };
    }

    case 'seq_trigger': {
      let step = 0;
      const stepRef = { value: 0 };
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      let lastExtClkMs = -Infinity;
      const getMs = () => 60000 / (p.bpm ?? 120);
      const doStep = () => {
        const ms = getMs();
        stepRef.value = step;
        const active = (p[`t${step + 1}`] ?? 0) > 0.5;
        if (active) { gateCb?.(true, 440); setTimeout(() => gateCb?.(false, 440), ms * 0.4); }
        step = (step + 1) % Math.max(1, Math.round(p.steps ?? 8));
      };
      let timer = makeClockTimer(getMs, () => {
        if (performance.now() - lastExtClkMs < getMs() * 2) return;
        doStep();
      });
      return {
        outputs: new Map(),
        inputs: new Map(),
        stepRef,
        portNoteOn: new Map([
          ['clock_in',  () => { lastExtClkMs = performance.now(); queueMicrotask(() => doStep()); }],
          ['reset_in',  () => { step = 0; stepRef.value = 0; }],
        ]),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') timer.updateInterval(); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); gateCb = null; },
      };
    }

    case 'seq_cv': {
      const cvNode = ctx.createConstantSource(); cvNode.offset.value = 0; cvNode.start();

      // depth GainNode scales the output by the DEPTH knob (0–1)
      const depthGain = ctx.createGain(); depthGain.gain.value = p.depth ?? 1;
      cvNode.connect(depthGain);

      // depth_cv tap: AnalyserNode so the UI indicator can read the incoming signal
      const depthMix = ctx.createGain(); depthMix.gain.value = 1;
      const depthTap = ctx.createAnalyser(); depthTap.fftSize = 32;
      depthMix.connect(depthTap);
      depthMix.connect(depthGain.gain);  // additive CV on top of the knob value
      const depthBuf = new Float32Array(1);
      const readDepth = () => { depthTap.getFloatTimeDomainData(depthBuf); return depthBuf[0]; };

      let step = 0;
      const stepRef = { value: 0 };
      let lastExtClkMs = -Infinity;
      const getMs = () => 60000 / (p.bpm ?? 120);
      const doStep = () => {
        stepRef.value = step;
        cvNode.offset.value = (p[`v${step + 1}`] ?? 0) * 500;
        step = (step + 1) % Math.max(1, Math.round(p.steps ?? 8));
      };
      let timer = makeClockTimer(getMs, () => {
        if (performance.now() - lastExtClkMs < getMs() * 2) return;
        doStep();
      });
      return {
        outputs: new Map([['cv_out', depthGain]]),
        inputs: new Map([
          ['depth_cv', { node: depthMix as AudioNode }],
        ]),
        stepRef,
        portNoteOn: new Map([
          ['clock_in',  () => { lastExtClkMs = performance.now(); queueMicrotask(() => doStep()); }],
          ['reset_in',  () => { step = 0; stepRef.value = 0; cvNode.offset.value = (p['v1'] ?? 0) * 500; }],
        ]),
        // getLevel: current step value as 0–1, so downstream knob indicators light up
        getLevel: () => Math.max(0, Math.min(1, cvNode.offset.value / 500)),
        getPortLevel: (portId: string) => {
          if (portId === 'depth_cv') return Math.max(0, Math.min(1, (readDepth() + 1) / 2));
          return 0;
        },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'bpm')   timer.updateInterval();
          if (id === 'depth') depthGain.gain.value = val;
        },
        destroy: () => {
          timer.destroy();
          try { cvNode.stop(); } catch(_){} cvNode.disconnect();
          depthGain.disconnect();
          depthMix.disconnect();
          depthTap.disconnect();
        },
      };
    }

    case 'seq_gate': {
      let step = 0;
      const stepRef = { value: 0 };
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      let lastExtClkMs = -Infinity;
      const getMs = () => 60000 / (p.bpm ?? 120);
      const doStep = () => {
        const ms = getMs();
        stepRef.value = step;
        const active = (p[`g${step + 1}`] ?? 0) > 0.5;
        if (active) {
          const len = ms * (p.gate_len ?? 0.5);
          gateCb?.(true, 440);
          setTimeout(() => gateCb?.(false, 440), len);
        }
        step = (step + 1) % Math.max(1, Math.round(p.steps ?? 8));
      };
      let timer = makeClockTimer(getMs, () => {
        if (performance.now() - lastExtClkMs < getMs() * 2) return;
        doStep();
      });
      return {
        outputs: new Map(),
        inputs: new Map(),
        stepRef,
        portNoteOn: new Map([
          ['clock_in',  () => { lastExtClkMs = performance.now(); queueMicrotask(() => doStep()); }],
          ['reset_in',  () => { step = 0; stepRef.value = 0; }],
        ]),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') timer.updateInterval(); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); gateCb = null; },
      };
    }

    // ── Arpeggiator ──────────────────────────────────────────────────
    case 'arpeggiator': {
      const voct = ctx.createConstantSource(); voct.offset.value = 0; voct.start();
      const heldNotes: number[] = [];   // freqs in play order
      let lastNoteFreq = 0;

      // V/OCT tap — samples the incoming V/OCT cable at gate time.
      // Follows the same pattern used by euclidean_trig for CV sampling.
      const voctMix = ctx.createGain(); voctMix.gain.value = 1;
      const voctTap = ctx.createAnalyser(); voctTap.fftSize = 32;
      voctMix.connect(voctTap);
      const voctBuf = new Float32Array(1);
      const readVoct = () => { voctTap.getFloatTimeDomainData(voctBuf); return voctBuf[0]; };
      let stepIdx = 0;
      let gateCb:    ((on: boolean, freq: number) => void) | null = null;
      let accentCb:  ((on: boolean, freq: number) => void) | null = null;
      // Extra state for new modes
      let zigzagPos = 0;
      let zigzagUp  = true;
      let shuffledSeq: number[] = [];
      // Swing / accent counters
      let globalBeat   = 0;  // every timer tick (for swing odd/even)
      let accentBeat   = 0;  // every fired step (for accent division)
      const ACCENT_DIVS = [0, 2, 3, 4, 6, 8]; // maps selector index → divisor

      // div selector: 1/16 1/8 1/4 1/2 1/1  → beat fractions
      const DIV_MULTS = [0.25, 0.5, 1, 2, 4];
      const getStepMs = () => 60000 / (p.bpm ?? 120) * DIV_MULTS[Math.round(p.div ?? 1)];

      const buildSeq = (): number[] => {
        const oct = Math.round(p.octaves ?? 1);
        const base = [...heldNotes].sort((a, b) => a - b);
        const result = [...base];
        for (let o = 1; o < oct; o++) for (const f of base) result.push(f * Math.pow(2, o));
        return result;
      };

      const resetModeState = () => {
        stepIdx = 0; zigzagPos = 0; zigzagUp = true; shuffledSeq = [];
      };

      const getNextFreq = (): number | null => {
        const seq = buildSeq();
        const n = seq.length;
        if (n === 0) return null;
        const mode = Math.round(p.mode ?? 0);
        let freq: number;
        switch (mode) {
          case 0: // UP
            freq = seq[stepIdx % n]; stepIdx = (stepIdx + 1) % n; break;
          case 1: // DOWN
            freq = seq[(n - 1 - stepIdx % n)]; stepIdx = (stepIdx + 1) % n; break;
          case 2: { // U/D ping-pong
            const total = n <= 1 ? 1 : (n - 1) * 2;
            const pos = stepIdx % total;
            freq = pos < n ? seq[pos] : seq[total - pos];
            stepIdx = (stepIdx + 1) % total; break;
          }
          case 3: { // D/U ping-pong
            const total = n <= 1 ? 1 : (n - 1) * 2;
            const pos = stepIdx % total;
            freq = pos < n ? seq[n - 1 - pos] : seq[pos - n + 1];
            stepIdx = (stepIdx + 1) % total; break;
          }
          case 4: // RANDOM
            freq = seq[Math.floor(Math.random() * n)]; break;
          case 5: // AS PLAYED (insertion order)
            freq = heldNotes[stepIdx % Math.max(1, heldNotes.length)] ?? seq[0];
            stepIdx = (stepIdx + 1) % Math.max(1, heldNotes.length); break;
          case 6: { // OUTSIDE→IN
            const oi = stepIdx % n;
            freq = oi % 2 === 0 ? seq[n - 1 - Math.floor(oi / 2)] : seq[Math.floor(oi / 2)];
            stepIdx = (stepIdx + 1) % n; break;
          }
          case 7: { // INSIDE→OUT
            const mid = Math.floor(n / 2);
            const io = stepIdx % n;
            const f = io % 2 === 0
              ? seq[Math.max(0, mid - Math.floor(io / 2))]
              : seq[Math.min(n - 1, mid + Math.ceil(io / 2))];
            freq = f; stepIdx = (stepIdx + 1) % n; break;
          }
          case 8: // UP×2 — each note twice before advancing
            freq = seq[Math.floor(stepIdx / 2) % n]; stepIdx++; if (stepIdx >= n * 2) stepIdx = 0; break;
          case 9: // RANDOM WALK — drift ±1 step
            stepIdx = Math.max(0, Math.min(n - 1, stepIdx + (Math.random() > 0.5 ? 1 : -1)));
            freq = seq[stepIdx]; break;
          case 10: // DOWN×2 — each note twice, descending
            freq = seq[n - 1 - Math.floor(stepIdx / 2) % n];
            stepIdx++; if (stepIdx >= n * 2) stepIdx = 0; break;
          case 11: // SKIP — advance by 2 (interleaves odd/even notes)
            freq = seq[stepIdx % n];
            stepIdx = (stepIdx + 2) % n; break;
          case 12: // ×3 — each note three times before advancing
            freq = seq[Math.floor(stepIdx / 3) % n];
            stepIdx++; if (stepIdx >= n * 3) stepIdx = 0; break;
          case 13: { // PEDAL — alternates root with ascending melody notes
            if (n <= 1) { freq = seq[0]; stepIdx = (stepIdx + 1) % n; break; }
            if (stepIdx % 2 === 0) {
              freq = seq[0];
            } else {
              const ni = (Math.floor(stepIdx / 2) % (n - 1)) + 1;
              freq = seq[ni];
            }
            stepIdx++;
            break;
          }
          case 14: { // ZIGZAG — up 2, back 1 (net ascending)
            freq = seq[((zigzagPos % n) + n) % n];
            if (zigzagUp) { zigzagPos = ((zigzagPos + 2) % n + n) % n; zigzagUp = false; }
            else          { zigzagPos = ((zigzagPos - 1) % n + n) % n; zigzagUp = true;  }
            stepIdx++;
            break;
          }
          case 15: { // SHUF — reshuffle order at the start of each cycle
            if (stepIdx === 0 || shuffledSeq.length !== n) {
              shuffledSeq = [...seq];
              for (let i = shuffledSeq.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledSeq[i], shuffledSeq[j]] = [shuffledSeq[j], shuffledSeq[i]];
              }
            }
            freq = shuffledSeq[stepIdx % n];
            stepIdx = (stepIdx + 1) % n; break;
          }
          default:
            freq = seq[stepIdx % n]; stepIdx = (stepIdx + 1) % n;
        }
        return freq;
      };

      const tick = () => {
        const beat   = globalBeat++;
        const stepMs = getStepMs();
        // Swing: delay odd beats
        const swingDelay = (beat % 2 === 1) ? (p.swing ?? 0) * stepMs : 0;

        setTimeout(() => {
          // Chance: skip this step probabilistically
          if (Math.random() > (p.chance ?? 1)) return;

          const freq = getNextFreq();
          if (freq === null) return;

          voct.offset.value = freq;
          gateCb?.(true, freq);
          const gl = Math.min(0.95, p.gate_len ?? 0.5);
          setTimeout(() => gateCb?.(false, freq), stepMs * gl);

          // Accent: fire accent_out every Nth step
          const accentDiv = ACCENT_DIVS[Math.round(p.accent ?? 0)] ?? 0;
          if (accentDiv > 0 && accentBeat % accentDiv === 0) {
            accentCb?.(true, freq);
            setTimeout(() => accentCb?.(false, freq), stepMs * gl * 0.5);
          }
          accentBeat++;
        }, swingDelay);
      };

      let timer = makeClockTimer(getStepMs, tick);

      // gate_in handler: when triggered by a gate cable, use the V/OCT tap
      // value if a cable is connected (cv > 10 Hz means real pitch data), otherwise
      // fall back to the freq carried by the gate signal itself (keyboard path).
      const addNote = (freq: number) => {
        if (!heldNotes.includes(freq)) heldNotes.push(freq);
        lastNoteFreq = freq;
      };
      const removeNote = (freq: number) => {
        const idx = heldNotes.indexOf(freq);
        if (idx >= 0) { heldNotes.splice(idx, 1); if (stepIdx >= Math.max(1, heldNotes.length)) stepIdx = 0; }
      };

      return {
        outputs: new Map([['voct_out', voct]]),
        inputs: new Map([
          ['voct_in', { node: voctMix as AudioNode }],
        ]),
        noteOn:  (_t, freq) => addNote(freq),
        noteOff: (_t)       => removeNote(lastNoteFreq),
        portNoteOn: new Map([
          ['gate_in', (_t: number, freq?: number) => {
            // Prefer V/OCT tap if a cable is patched (reads >10 Hz = real pitch)
            const cv = readVoct();
            const f = cv > 10 ? cv : (freq ?? 440);
            addNote(f);
          }],
        ]),
        portNoteOff: new Map([
          ['gate_in', (_t: number, freq?: number) => {
            // Remove the exact note that was added by gate-on
            const cv = readVoct();
            removeNote(cv > 10 ? cv : (freq ?? lastNoteFreq));
          }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'bpm') { timer.updateInterval(); }
          if (id === 'div') { resetModeState(); globalBeat = 0; accentBeat = 0; timer.updateInterval(); }
        },
        setSelector: (id, val) => { p[id] = val; resetModeState(); globalBeat = 0; accentBeat = 0; },
        setGateTrigger: fn => { gateCb = fn; },
        setPortGateTrigger: (portId, fn) => { if (portId === 'accent_out') accentCb = fn; else gateCb = fn; },
        destroy: () => {
          timer.destroy(); gateCb = null; accentCb = null;
          try { voct.stop(); } catch(_){} voct.disconnect();
          voctMix.disconnect(); voctTap.disconnect();
        },
      };
    }

    // ── Clock ────────────────────────────────────────────────────────
    case 'clock_gen': {
      let beat = 0;
      const portCbs = new Map<string, (on: boolean, freq: number) => void>();
      const DIV: Record<string, number> = { gate_out: 1, div2_out: 2, div4_out: 4, div8_out: 8 };
      const lastMs: Record<string, number> = {};

      // Bug fix 3: wire up tempo_cv input using AnalyserNode tap
      const tempoCvMix = ctx.createGain(); tempoCvMix.gain.value = 1;
      const tempoCvTap = ctx.createAnalyser(); tempoCvTap.fftSize = 32;
      tempoCvMix.connect(tempoCvTap);
      const tempoCvBuf = new Float32Array(1);
      const readTempoCv = () => { tempoCvTap.getFloatTimeDomainData(tempoCvBuf); return tempoCvBuf[0]; };

      // ±5 V CV range → ±120 BPM offset (matches poly_step bpmCv scaling)
      const getMs = () => 60000 / Math.max(1, (p.bpm ?? 120) + readTempoCv() * 120);

      let timer = makeClockTimer(getMs, (i) => {
        beat = i;
        const ms = getMs();
        // Bug fix 1: capture `i` here so the closure uses the correct beat even
        // if another tick fires and mutates `beat` before the setTimeout runs.
        const swingOffset = (i % 2 === 1) ? ms * (p.swing ?? 0) : 0;
        setTimeout(() => {
          for (const [portId, cb] of portCbs) {
            const div = DIV[portId] ?? 1;
            if (i % div === 0) {          // use `i`, not the shared `beat`
              lastMs[portId] = performance.now();
              cb(true, 440);
              setTimeout(() => cb(false, 440), ms * 0.45);
            }
          }
        }, swingOffset);
      });
      return {
        outputs: new Map(),
        inputs: new Map([['tempo_cv', { node: tempoCvMix as AudioNode }]]),
        // Bug fix 2: handle reset_in — restart the beat counter and timer phase
        portNoteOn: new Map([
          ['reset_in', () => { beat = 0; timer.restart(); }],
        ]),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') timer.updateInterval(); },
        setGateTrigger: fn => {
          if (fn) portCbs.set('gate_out', fn);
          else portCbs.delete('gate_out');
        },
        setPortGateTrigger: (portId, fn) => { portCbs.set(portId, fn); },
        getLevel:     () => Math.max(0, 1 - (performance.now() - (lastMs['gate_out'] ?? 0)) / 120),
        getPortLevel: (portId: string) => Math.max(0, 1 - (performance.now() - (lastMs[portId] ?? 0)) / 120),
        destroy: () => { timer.destroy(); portCbs.clear(); tempoCvMix.disconnect(); tempoCvTap.disconnect(); },
      };
    }

    case 'clock_div': {
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      const getMs = () => 60000 / (p.bpm ?? 120) * (p.div ?? 2);
      let timer = makeClockTimer(getMs, () => {
        gateCb?.(true, 440);
        setTimeout(() => gateCb?.(false, 440), getMs() * 0.45);
      });
      return {
        outputs: new Map(), inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm' || id === 'div') timer.updateInterval(); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); gateCb = null; },
      };
    }

    case 'clock_mul': {
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      const getMs = () => 60000 / (p.bpm ?? 120) / (p.mul ?? 2);
      let timer = makeClockTimer(getMs, () => {
        gateCb?.(true, 440);
        setTimeout(() => gateCb?.(false, 440), getMs() * 0.45);
      });
      return {
        outputs: new Map(), inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm' || id === 'mul') timer.updateInterval(); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); gateCb = null; },
      };
    }

    case 'clock_dly': {
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      const getMs = () => 60000 / (p.bpm ?? 120);
      let timer = makeClockTimer(getMs, () => {
        const delayMs = getMs() * (p.delay ?? 0.25);
        setTimeout(() => {
          gateCb?.(true, 440);
          setTimeout(() => gateCb?.(false, 440), getMs() * 0.45);
        }, delayMs);
      });
      return {
        outputs: new Map(), inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') timer.updateInterval(); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); gateCb = null; },
      };
    }

    case 'clock_shuffle': {
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      let beat = 0;
      const getMs = () => 60000 / (p.bpm ?? 120);
      let timer = makeClockTimer(getMs, (i) => {
        beat = i;
        const shuffle = beat % 2 === 1 ? getMs() * (p.shuffle ?? 0.2) : 0;
        setTimeout(() => {
          gateCb?.(true, 440);
          setTimeout(() => gateCb?.(false, 440), getMs() * 0.4);
        }, shuffle);
      });
      return {
        outputs: new Map(), inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') timer.updateInterval(); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); gateCb = null; },
      };
    }

    case 'swing_gen': {
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      let beat = 0;
      const getMs = () => 60000 / (p.bpm ?? 120);
      let timer = makeClockTimer(getMs, (i) => {
        beat = i;
        const swingMs = beat % 2 === 1 ? getMs() * (p.swing ?? 0.33) : 0;
        const interval = getMs();
        setTimeout(() => {
          gateCb?.(true, 440);
          setTimeout(() => gateCb?.(false, 440), interval * 0.4);
        }, swingMs);
      });
      return {
        outputs: new Map(), inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') timer.updateInterval(); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); gateCb = null; },
      };
    }

    // ── Delays ───────────────────────────────────────────────────────
    case 'delay_mod':
    case 'delay_digital': {
      const delay = ctx.createDelay(5); delay.delayTime.value = p.time ?? 0.25;
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.4;
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, delay, p.mix ?? 0.3);
      input.connect(delay); delay.connect(fb); fb.connect(delay);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['time_cv', { node: delay, param: delay.delayTime }],
          ['feedback_cv', { node: fb, param: fb.gain }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'time') delay.delayTime.value = val;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, delay, fb, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'delay_analog': {
      const delay = ctx.createDelay(3); delay.delayTime.value = p.time ?? 0.2;
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.5;
      const fbFilter = ctx.createBiquadFilter(); fbFilter.type = 'lowpass';
      fbFilter.frequency.value = p.tone ?? 2000;
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, delay, p.mix ?? 0.4);
      input.connect(delay); delay.connect(fbFilter); fbFilter.connect(fb); fb.connect(delay);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['time_cv', { node: delay, param: delay.delayTime }],
          ['feedback_cv', { node: fb, param: fb.gain }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'time') delay.delayTime.value = val;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'tone') fbFilter.frequency.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, delay, fb, fbFilter, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'delay_tape': {
      const delay = ctx.createDelay(3); delay.delayTime.value = p.time ?? 0.3;
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.4;
      const flutter = ctx.createOscillator(); flutter.frequency.value = 3.7;
      const flutterGain = ctx.createGain();
      flutterGain.gain.value = (p.flutter ?? 0.3) * 0.003;
      flutter.connect(flutterGain); flutterGain.connect(delay.delayTime); flutter.start();
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, delay, p.mix ?? 0.4);
      input.connect(delay); delay.connect(fb); fb.connect(delay);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['time_cv', { node: delay, param: delay.delayTime }],
          ['feedback_cv', { node: fb, param: fb.gain }],
          ['flutter_cv', { node: flutterGain, param: flutterGain.gain }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'time') delay.delayTime.value = val;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'flutter') flutterGain.gain.value = val * 0.003;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          try { flutter.stop(); } catch(_){} flutter.disconnect();
          [input, delay, fb, flutterGain, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'delay_ping': {
      const delL = ctx.createDelay(3); delL.delayTime.value = p.time ?? 0.25;
      const delR = ctx.createDelay(3); delR.delayTime.value = (p.time ?? 0.25) * 0.5;
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.4;
      const input = ctx.createGain(); input.gain.value = 1;
      const mix = ctx.createGain(); mix.gain.value = p.mix ?? 0.35;
      const dry = ctx.createGain(); dry.gain.value = 1 - (p.mix ?? 0.35);
      const out = ctx.createGain(); out.gain.value = 1;
      input.connect(delL); delL.connect(delR); delR.connect(fb); fb.connect(delL);
      input.connect(dry); dry.connect(out);
      delL.connect(mix); delR.connect(mix); mix.connect(out);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['time_cv', { node: delL, param: delL.delayTime }],
          ['feedback_cv', { node: fb, param: fb.gain }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'time') { delL.delayTime.value = val; delR.delayTime.value = val * 0.5; }
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'mix') { mix.gain.value = val; dry.gain.value = 1 - val; }
        },
        destroy: () => { [input, delL, delR, fb, mix, dry, out].forEach(n => n.disconnect()); },
      };
    }

    case 'delay_multi': {
      const d1 = ctx.createDelay(2); d1.delayTime.value = p.tap1 ?? 0.125;
      const d2 = ctx.createDelay(2); d2.delayTime.value = p.tap2 ?? 0.25;
      const d3 = ctx.createDelay(2); d3.delayTime.value = p.tap3 ?? 0.5;
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.3;
      const input = ctx.createGain(); input.gain.value = 1;
      const tapMix = ctx.createGain(); tapMix.gain.value = (p.mix ?? 0.35) / 3;
      const dry = ctx.createGain(); dry.gain.value = 1 - (p.mix ?? 0.35);
      const out = ctx.createGain(); out.gain.value = 1;
      [d1, d2, d3].forEach(d => { input.connect(d); d.connect(tapMix); });
      tapMix.connect(fb); fb.connect(d1);
      input.connect(dry); dry.connect(out); tapMix.connect(out);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['tap1_cv', { node: d1, param: d1.delayTime }],
          ['tap2_cv', { node: d2, param: d2.delayTime }],
          ['tap3_cv', { node: d3, param: d3.delayTime }],
          ['feedback_cv', { node: fb, param: fb.gain }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'tap1') d1.delayTime.value = val;
          if (id === 'tap2') d2.delayTime.value = val;
          if (id === 'tap3') d3.delayTime.value = val;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'mix') { tapMix.gain.value = val / 3; dry.gain.value = 1 - val; }
        },
        destroy: () => { [input, d1, d2, d3, fb, tapMix, dry, out].forEach(n => n.disconnect()); },
      };
    }

    // ── Reverbs ──────────────────────────────────────────────────────
    case 'reverb': {
      const conv = ctx.createConvolver();
      conv.buffer = makeIR(ctx, p.size ?? 2, 3);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, conv, p.mix ?? 0.3);
      input.connect(conv);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'size') conv.buffer = makeIR(ctx, val, 3);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, conv, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'reverb_spring': {
      const conv = ctx.createConvolver();
      conv.buffer = makeSpringIR(ctx, p.tension ?? 1);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, conv, p.mix ?? 0.35);
      input.connect(conv);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'tension') conv.buffer = makeSpringIR(ctx, val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, conv, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'reverb_plate': {
      const conv = ctx.createConvolver();
      conv.buffer = makePlateIR(ctx, p.size ?? 2.5);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, conv, p.mix ?? 0.3);
      input.connect(conv);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'size') conv.buffer = makePlateIR(ctx, val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, conv, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'reverb_hall': {
      const conv = ctx.createConvolver();
      conv.buffer = makeHallIR(ctx, p.size ?? 4);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, conv, p.mix ?? 0.35);
      input.connect(conv);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'size') conv.buffer = makeHallIR(ctx, val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, conv, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'reverb_shimmer': {
      const conv = ctx.createConvolver();
      conv.buffer = makeHallIR(ctx, p.size ?? 3);
      // Shimmer = reverb + pitched feedback oscillator
      const pitch = ctx.createOscillator(); pitch.type = 'sine';
      pitch.frequency.value = 880;
      const pitchGain = ctx.createGain(); pitchGain.gain.value = 0;
      pitch.connect(pitchGain); pitchGain.connect(conv); pitch.start();
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, conv, p.mix ?? 0.4);
      input.connect(conv);
      // shimmer_cv drives pitchGain.gain directly (shimmer_cv is an AudioParam target)
      const shimmerCv = ctx.createConstantSource(); shimmerCv.offset.value = (p.shimmer ?? 0.5) * 0.15; shimmerCv.start();
      shimmerCv.connect(pitchGain.gain);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['shimmer_cv', { node: shimmerCv, param: shimmerCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'size') conv.buffer = makeHallIR(ctx, val);
          if (id === 'shimmer') shimmerCv.offset.value = val * 0.15;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          try { pitch.stop(); } catch(_){} pitch.disconnect();
          try { shimmerCv.stop(); } catch(_){} shimmerCv.disconnect();
          [input, conv, pitchGain, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    // ── Modulation ───────────────────────────────────────────────────
    case 'chorus': {
      const voices = 3;
      const input = ctx.createGain(); input.gain.value = 1;
      const wetSum = ctx.createGain(); wetSum.gain.value = 1 / voices;
      const delays: DelayNode[] = [];
      const lfos: OscillatorNode[] = [];
      const lfoGains: GainNode[] = [];
      for (let i = 0; i < voices; i++) {
        const d = ctx.createDelay(0.1); d.delayTime.value = 0.01 + i * 0.007;
        const lfo = ctx.createOscillator(); lfo.frequency.value = (p.rate ?? 1.5) * (1 + i * 0.15);
        const lg = ctx.createGain(); lg.gain.value = 0;
        lfo.connect(lg); lg.connect(d.delayTime); lfo.start();
        input.connect(d); d.connect(wetSum);
        delays.push(d); lfos.push(lfo); lfoGains.push(lg);
      }
      const { out, dryG, wetG } = wetDry(ctx, input, wetSum, p.mix ?? 0.5);
      // rateCv.offset = 0 so external CV adds to the base lfo.frequency.value without doubling
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = 0; rateCv.start();
      lfos.forEach((l) => rateCv.connect(l.frequency));
      // depthCv drives lfoGain directly; initial offset = scaled depth
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = (p.depth ?? 0.5) * 0.006; depthCv.start();
      lfoGains.forEach(lg => depthCv.connect(lg.gain));
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['rate_cv', { node: rateCv, param: rateCv.offset }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') lfos.forEach((l, i) => { l.frequency.value = val * (1 + i * 0.15); });
          if (id === 'depth') depthCv.offset.value = val * 0.006;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          try { rateCv.stop(); } catch(_){} rateCv.disconnect(); try { depthCv.stop(); } catch(_){} depthCv.disconnect();
          lfos.forEach(l => { try { l.stop(); } catch(_){} l.disconnect(); });
          [input, wetSum, out, dryG, wetG, ...delays, ...lfoGains].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'flanger': {
      const input = ctx.createGain(); input.gain.value = 1;
      const delay = ctx.createDelay(0.1); delay.delayTime.value = 0.005;
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = p.rate ?? 0.5;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0;
      lfo.connect(lfoGain); lfoGain.connect(delay.delayTime); lfo.start();
      input.connect(delay); delay.connect(fb); fb.connect(delay);
      const { out, dryG, wetG } = wetDry(ctx, input, delay, p.mix ?? 0.5);
      // rateCv.offset = 0 so CV adds to lfo.frequency.value without doubling
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = 0; rateCv.start();
      rateCv.connect(lfo.frequency);
      // depthCv drives lfoGain.gain directly
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = (p.depth ?? 0.7) * 0.004; depthCv.start();
      depthCv.connect(lfoGain.gain);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['rate_cv', { node: rateCv, param: rateCv.offset }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
          ['feedback_cv', { node: fb, param: fb.gain }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') lfo.frequency.value = val;
          if (id === 'depth') depthCv.offset.value = val * 0.004;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          try { rateCv.stop(); } catch(_){} rateCv.disconnect(); try { depthCv.stop(); } catch(_){} depthCv.disconnect();
          try { lfo.stop(); } catch(_){} lfo.disconnect();
          [input, delay, fb, lfoGain, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'phaser': {
      const numStages = 6;
      const input = ctx.createGain(); input.gain.value = 1;
      const allpasses = Array.from({ length: numStages }, () => {
        const ap = ctx.createBiquadFilter(); ap.type = 'allpass';
        ap.frequency.value = 1000; ap.Q.value = 0.5; return ap;
      });
      for (let i = 0; i < numStages - 1; i++) allpasses[i].connect(allpasses[i + 1]);
      input.connect(allpasses[0]);
      const lfo = ctx.createOscillator(); lfo.frequency.value = p.rate ?? 0.5;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0;
      const lfoOffset = ctx.createConstantSource(); lfoOffset.offset.value = 1000; lfoOffset.start();
      lfo.connect(lfoGain);
      allpasses.forEach(ap => { lfoGain.connect(ap.frequency); lfoOffset.connect(ap.frequency); });
      lfo.start();
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.4;
      allpasses[numStages - 1].connect(fb); fb.connect(allpasses[0]);
      const { out, dryG, wetG } = wetDry(ctx, input, allpasses[numStages - 1], p.mix ?? 0.5);
      // rateCv.offset = 0 so CV adds to lfo.frequency.value without doubling
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = 0; rateCv.start();
      rateCv.connect(lfo.frequency);
      // depthCv drives lfoGain.gain directly
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = (p.depth ?? 0.8) * 900; depthCv.start();
      depthCv.connect(lfoGain.gain);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['rate_cv', { node: rateCv, param: rateCv.offset }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') lfo.frequency.value = val;
          if (id === 'depth') depthCv.offset.value = val * 900;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          try { rateCv.stop(); } catch(_){} rateCv.disconnect(); try { depthCv.stop(); } catch(_){} depthCv.disconnect();
          try { lfo.stop(); } catch(_){} lfo.disconnect(); try { lfoOffset.stop(); } catch(_){} lfoOffset.disconnect();
          [input, ...allpasses, lfoGain, fb, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'vibrato': {
      const input = ctx.createGain(); input.gain.value = 1;
      const delay = ctx.createDelay(0.05); delay.delayTime.value = 0.005;
      const lfo = ctx.createOscillator(); lfo.frequency.value = p.rate ?? 5;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0;
      lfo.connect(lfoG); lfoG.connect(delay.delayTime); lfo.start();
      input.connect(delay);
      // rateCv.offset = 0 so CV adds to lfo.frequency.value without doubling
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = 0; rateCv.start();
      rateCv.connect(lfo.frequency);
      // depthCv drives lfoG.gain directly
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = (p.depth ?? 0.3) * 0.003; depthCv.start();
      depthCv.connect(lfoG.gain);
      return {
        outputs: new Map([['out', delay]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['rate_cv', { node: rateCv, param: rateCv.offset }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') lfo.frequency.value = val;
          if (id === 'depth') depthCv.offset.value = val * 0.003;
        },
        destroy: () => {
          try { rateCv.stop(); } catch(_){} rateCv.disconnect(); try { depthCv.stop(); } catch(_){} depthCv.disconnect();
          try { lfo.stop(); } catch(_){} lfo.disconnect();
          [input, delay, lfoG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'tremolo': {
      const input = ctx.createGain(); input.gain.value = 1;
      const amp = ctx.createGain(); amp.gain.value = 1;
      const waveMap: OscillatorType[] = ['sine', 'square', 'triangle'];
      const lfo = ctx.createOscillator();
      lfo.type = waveMap[Math.round(p.wave ?? 0)] ?? 'sine';
      lfo.frequency.value = p.rate ?? 5;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0;
      const dc = ctx.createConstantSource(); dc.offset.value = 1 - (p.depth ?? 0.6) * 0.5; dc.start();
      dc.connect(amp.gain); lfo.connect(lfoG); lfoG.connect(amp.gain); lfo.start();
      input.connect(amp);
      // rateCv.offset = 0 so CV adds to lfo.frequency.value without doubling
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = 0; rateCv.start();
      rateCv.connect(lfo.frequency);
      // depthCv drives lfoG.gain directly; knob also updates dc bias
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = (p.depth ?? 0.6) * 0.5; depthCv.start();
      depthCv.connect(lfoG.gain);
      return {
        outputs: new Map([['out', amp]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['rate_cv', { node: rateCv, param: rateCv.offset }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') lfo.frequency.value = val;
          if (id === 'depth') { depthCv.offset.value = val * 0.5; dc.offset.value = 1 - val * 0.5; }
        },
        setSelector: (id, val) => {
          if (id === 'wave') lfo.type = waveMap[Math.round(val)] ?? 'sine';
        },
        destroy: () => {
          try { rateCv.stop(); } catch(_){} rateCv.disconnect(); try { depthCv.stop(); } catch(_){} depthCv.disconnect();
          try { lfo.stop(); } catch(_){} lfo.disconnect(); try { dc.stop(); } catch(_){} dc.disconnect();
          [input, amp, lfoG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'rotary': {
      // Rotary speaker: AM tremolo (horn) + slight FM vibrato (bass rotor)
      const input = ctx.createGain(); input.gain.value = 1;
      const amp = ctx.createGain(); amp.gain.value = 1;
      const baseSpeed = p.mode === 1 ? (p.speed ?? 3.5) * 2 : (p.speed ?? 3.5);
      const amLfo = ctx.createOscillator(); amLfo.frequency.value = baseSpeed;
      const fmLfo = ctx.createOscillator(); fmLfo.frequency.value = baseSpeed * 0.7;
      const amG = ctx.createGain(); amG.gain.value = (p.depth ?? 0.7) * 0.5;
      const fmG = ctx.createGain(); fmG.gain.value = (p.depth ?? 0.7) * 20;
      const dc = ctx.createConstantSource(); dc.offset.value = 0.7; dc.start();
      const delay = ctx.createDelay(0.05); delay.delayTime.value = 0.002;
      amLfo.connect(amG); amG.connect(amp.gain);
      fmLfo.connect(fmG); fmG.connect(delay.delayTime);
      dc.connect(amp.gain); amLfo.start(); fmLfo.start();
      input.connect(amp); amp.connect(delay);
      const { out, dryG, wetG } = wetDry(ctx, input, delay, p.mix ?? 0.8);
      input.connect(dryG); delay.connect(wetG);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'speed') {
            amLfo.frequency.value = val; fmLfo.frequency.value = val * 0.7;
          }
          if (id === 'depth') { amG.gain.value = val * 0.5; fmG.gain.value = val * 20; }
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        setSelector: (id, val) => {
          if (id === 'mode') {
            const s = val === 1 ? (p.speed ?? 3.5) * 2 : (p.speed ?? 3.5);
            amLfo.frequency.value = s; fmLfo.frequency.value = s * 0.7;
          }
        },
        destroy: () => {
          try { amLfo.stop(); } catch(_){} amLfo.disconnect(); try { fmLfo.stop(); } catch(_){} fmLfo.disconnect();
          try { dc.stop(); } catch(_){} dc.disconnect();
          [input, amp, amG, fmG, delay, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    // ── Distortion ───────────────────────────────────────────────────
    case 'overdrive': {
      const shaper = ctx.createWaveShaper(); shaper.curve = softClip(p.drive ?? 20);
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass';
      tone.frequency.value = p.tone ?? 3000;
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, tone, p.mix ?? 1);
      input.connect(shaper); shaper.connect(tone); tone.connect(wetG);
      // CV tap for drive — WaveShaper.curve isn't an AudioParam so we poll at 32 ms
      const driveCvIn = ctx.createGain(); driveCvIn.gain.value = 1;
      const driveTap = ctx.createAnalyser(); driveTap.fftSize = 32;
      driveCvIn.connect(driveTap);
      const _dBuf = new Float32Array(1);
      const pollId = setInterval(() => {
        driveTap.getFloatTimeDomainData(_dBuf);
        const cv = _dBuf[0];
        if (Math.abs(cv) > 0.001) shaper.curve = softClip(Math.max(1, (p.drive ?? 20) + cv * 20));
      }, 32);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['drive_cv', { node: driveCvIn }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'drive') shaper.curve = softClip(val);
          if (id === 'tone') tone.frequency.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          clearInterval(pollId);
          try { driveCvIn.disconnect(); } catch(_){} try { driveTap.disconnect(); } catch(_){}
          [input, shaper, tone, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'fuzz': {
      const shaper = ctx.createWaveShaper(); shaper.curve = hardClip(p.fuzz ?? 80);
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass';
      tone.frequency.value = p.tone ?? 2000;
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, tone, p.mix ?? 1);
      input.connect(shaper); shaper.connect(tone); tone.connect(wetG);
      const fuzzCvIn = ctx.createGain(); fuzzCvIn.gain.value = 1;
      const fuzzTap = ctx.createAnalyser(); fuzzTap.fftSize = 32;
      fuzzCvIn.connect(fuzzTap);
      const _fBuf = new Float32Array(1);
      const pollId = setInterval(() => {
        fuzzTap.getFloatTimeDomainData(_fBuf);
        const cv = _fBuf[0];
        if (Math.abs(cv) > 0.001) shaper.curve = hardClip(Math.max(1, (p.fuzz ?? 80) + cv * 80));
      }, 32);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['fuzz_cv', { node: fuzzCvIn }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'fuzz') shaper.curve = hardClip(val);
          if (id === 'tone') tone.frequency.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          clearInterval(pollId);
          try { fuzzCvIn.disconnect(); } catch(_){} try { fuzzTap.disconnect(); } catch(_){}
          [input, shaper, tone, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'wavefolder': {
      const shaper = ctx.createWaveShaper(); shaper.curve = foldCurve(p.fold ?? 3);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, shaper, p.mix ?? 1);
      input.connect(shaper);
      const foldCvIn = ctx.createGain(); foldCvIn.gain.value = 1;
      const foldTap = ctx.createAnalyser(); foldTap.fftSize = 32;
      foldCvIn.connect(foldTap);
      const _flBuf = new Float32Array(1);
      const pollId = setInterval(() => {
        foldTap.getFloatTimeDomainData(_flBuf);
        const cv = _flBuf[0];
        if (Math.abs(cv) > 0.001) shaper.curve = foldCurve(Math.max(1, (p.fold ?? 3) + cv * 4));
      }, 32);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['fold_cv', { node: foldCvIn }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'fold') shaper.curve = foldCurve(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          clearInterval(pollId);
          try { foldCvIn.disconnect(); } catch(_){} try { foldTap.disconnect(); } catch(_){}
          [input, shaper, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'bitcrusher': {
      const shaper = ctx.createWaveShaper(); shaper.curve = bitcrushCurve(p.bits ?? 8);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, shaper, p.mix ?? 1);
      input.connect(shaper);
      const bitsCvIn = ctx.createGain(); bitsCvIn.gain.value = 1;
      const bitsTap = ctx.createAnalyser(); bitsTap.fftSize = 32;
      bitsCvIn.connect(bitsTap);
      const _btBuf = new Float32Array(1);
      const pollId = setInterval(() => {
        bitsTap.getFloatTimeDomainData(_btBuf);
        const cv = _btBuf[0];
        if (Math.abs(cv) > 0.001) shaper.curve = bitcrushCurve(Math.max(1, Math.min(16, (p.bits ?? 8) + cv * 8)));
      }, 32);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['bits_cv', { node: bitsCvIn }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'bits') shaper.curve = bitcrushCurve(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          clearInterval(pollId);
          try { bitsCvIn.disconnect(); } catch(_){} try { bitsTap.disconnect(); } catch(_){}
          [input, shaper, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'samplerate': {
      const shaper = ctx.createWaveShaper(); shaper.curve = srReduceCurve(p.factor ?? 8);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, shaper, p.mix ?? 1);
      input.connect(shaper);
      const factorCvIn = ctx.createGain(); factorCvIn.gain.value = 1;
      const factorTap = ctx.createAnalyser(); factorTap.fftSize = 32;
      factorCvIn.connect(factorTap);
      const _srBuf = new Float32Array(1);
      const pollId = setInterval(() => {
        factorTap.getFloatTimeDomainData(_srBuf);
        const cv = _srBuf[0];
        if (Math.abs(cv) > 0.001) shaper.curve = srReduceCurve(Math.max(1, Math.min(32, (p.factor ?? 8) + cv * 16)));
      }, 32);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['factor_cv', { node: factorCvIn }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'factor') shaper.curve = srReduceCurve(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          clearInterval(pollId);
          try { factorCvIn.disconnect(); } catch(_){} try { factorTap.disconnect(); } catch(_){}
          [input, shaper, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'saturator': {
      const shaper = ctx.createWaveShaper(); shaper.curve = tanhCurve(p.drive ?? 5);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, shaper, p.mix ?? 1);
      input.connect(shaper);
      const satDriveCvIn = ctx.createGain(); satDriveCvIn.gain.value = 1;
      const satDriveTap = ctx.createAnalyser(); satDriveTap.fftSize = 32;
      satDriveCvIn.connect(satDriveTap);
      const _satBuf = new Float32Array(1);
      const pollId = setInterval(() => {
        satDriveTap.getFloatTimeDomainData(_satBuf);
        const cv = _satBuf[0];
        if (Math.abs(cv) > 0.001) shaper.curve = tanhCurve(Math.max(1, (p.drive ?? 5) + cv * 10));
      }, 32);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['drive_cv', { node: satDriveCvIn }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'drive') shaper.curve = tanhCurve(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          clearInterval(pollId);
          try { satDriveCvIn.disconnect(); } catch(_){} try { satDriveTap.disconnect(); } catch(_){}
          [input, shaper, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    // ── Spectral ─────────────────────────────────────────────────────
    case 'ring_mod': {
      const carrier = ctx.createOscillator();
      carrier.frequency.value = p.freq ?? 440;
      const ring = ctx.createGain(); ring.gain.value = 0;
      carrier.connect(ring.gain); carrier.start();
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, ring, p.mix ?? 1);
      input.connect(ring);
      const freqCv = ctx.createConstantSource(); freqCv.offset.value = p.freq ?? 440; freqCv.start();
      freqCv.connect(carrier.frequency);
      const carrierIn = ctx.createGain(); carrierIn.gain.value = 1;
      carrierIn.connect(ring.gain);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['carrier_in', { node: carrierIn }],
          ['freq_cv', { node: freqCv, param: freqCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') carrier.frequency.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          freqCv.stop(); freqCv.disconnect();
          carrier.stop(); carrier.disconnect();
          [input, carrierIn, ring, out, dryG, wetG].forEach(n => n.disconnect());
        },
      };
    }

    case 'pitch_shift': {
      // Sawtooth-LFO delay-based pitch shift approximation
      const input = ctx.createGain(); input.gain.value = 1;
      const delay = ctx.createDelay(0.5); delay.delayTime.value = 0.01;
      const lfo = ctx.createOscillator(); lfo.type = 'sawtooth';
      // Pitch shift by semitones: positive = up (faster lfo), negative = down
      const semis = p.semitones ?? 0;
      const rate = Math.pow(2, Math.abs(semis) / 12) - 1;
      lfo.frequency.value = rate * 10 + 0.001;
      const lfoG = ctx.createGain(); lfoG.gain.value = semis >= 0 ? 0.02 : -0.02;
      const dcOffset = ctx.createConstantSource(); dcOffset.offset.value = 0.03; dcOffset.start();
      lfo.connect(lfoG); lfoG.connect(delay.delayTime); dcOffset.connect(delay.delayTime);
      lfo.start();
      input.connect(delay);
      const { out, dryG, wetG } = wetDry(ctx, input, delay, p.mix ?? 1);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'semitones') {
            const r = Math.pow(2, Math.abs(val) / 12) - 1;
            lfo.frequency.value = r * 10 + 0.001;
            lfoG.gain.value = val >= 0 ? 0.02 : -0.02;
          }
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          lfo.stop(); lfo.disconnect(); dcOffset.stop(); dcOffset.disconnect();
          [input, delay, lfoG, out, dryG, wetG].forEach(n => n.disconnect());
        },
      };
    }

    case 'freq_shift': {
      // Frequency shift via ring modulation (creates one sideband dominant)
      const carrier = ctx.createOscillator();
      carrier.frequency.value = Math.abs(p.shift ?? 50);
      carrier.type = 'sine';
      const ring = ctx.createGain(); ring.gain.value = 0;
      carrier.connect(ring.gain); carrier.start();
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, ring, p.mix ?? 1);
      input.connect(ring);
      // shift_cv adds to carrier.frequency (carrier.frequency is an AudioParam)
      const shiftCv = ctx.createConstantSource(); shiftCv.offset.value = 0; shiftCv.start();
      shiftCv.connect(carrier.frequency);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['shift_cv', { node: shiftCv, param: shiftCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'shift') carrier.frequency.value = Math.abs(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          carrier.stop(); carrier.disconnect();
          try { shiftCv.stop(); } catch(_){} shiftCv.disconnect();
          [input, ring, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'resonator': {
      const input = ctx.createGain(); input.gain.value = 1;
      const out = ctx.createGain(); out.gain.value = 1;
      const numHarmonics = Math.round(p.harmonics ?? 4);
      const baseFreq = p.freq ?? 440;
      const bands: BiquadFilterNode[] = [];
      for (let h = 1; h <= numHarmonics; h++) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.value = baseFreq * h; bp.Q.value = p.q ?? 20;
        const g = ctx.createGain(); g.gain.value = (p.mix ?? 0.7) / numHarmonics / h;
        input.connect(bp); bp.connect(g); g.connect(out); bands.push(bp);
      }
      const dry = ctx.createGain(); dry.gain.value = 1 - (p.mix ?? 0.7);
      input.connect(dry); dry.connect(out);
      // q_cv adds to each band's Q (BiquadFilter.Q is an AudioParam)
      const qCv = ctx.createConstantSource(); qCv.offset.value = 0; qCv.start();
      bands.forEach(b => qCv.connect(b.Q));
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['q_cv', { node: qCv, param: qCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') bands.forEach((b, i) => { b.frequency.value = val * (i + 1); });
          if (id === 'q') bands.forEach(b => { b.Q.value = val; });
          if (id === 'mix') dry.gain.value = 1 - val;
        },
        destroy: () => {
          try { qCv.stop(); } catch(_){} qCv.disconnect();
          [input, out, dry, ...bands].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    case 'vocoder': {
      // Simplified band vocoder: carrier shaped by modulator band envelopes
      const numBands = Math.round(p.bands ?? 8);
      const carrier = ctx.createGain(); carrier.gain.value = 1;
      const modulator = ctx.createGain(); modulator.gain.value = 1;
      const out = ctx.createGain(); out.gain.value = 1;
      // Frequency bands from 80Hz to 8kHz (log spaced)
      const freqs = Array.from({ length: numBands }, (_, i) =>
        80 * Math.pow(8000 / 80, i / (numBands - 1))
      );
      const bandGains: GainNode[] = [];
      freqs.forEach((freq) => {
        const mBP = ctx.createBiquadFilter(); mBP.type = 'bandpass';
        mBP.frequency.value = freq; mBP.Q.value = 3;
        const cBP = ctx.createBiquadFilter(); cBP.type = 'bandpass';
        cBP.frequency.value = freq; cBP.Q.value = 3;
        const env = ctx.createGain(); env.gain.value = 0;
        const fullWave = ctx.createWaveShaper();
        const fc = new Float32Array(512);
        for (let i = 0; i < 512; i++) fc[i] = Math.abs((i / 256) - 1);
        fullWave.curve = fc;
        const smooth = ctx.createBiquadFilter(); smooth.type = 'lowpass';
        smooth.frequency.value = 1 / (p.release ?? 0.1);
        modulator.connect(mBP); mBP.connect(fullWave); fullWave.connect(smooth);
        smooth.connect(env.gain);
        carrier.connect(cBP); cBP.connect(env); env.connect(out);
        bandGains.push(env);
      });
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['carrier', { node: carrier }],
          ['modulator', { node: modulator }],
        ]),
        setParam: (id, val) => { p[id] = val; },
        destroy: () => { [carrier, modulator, out, ...bandGains].forEach(n => n.disconnect()); },
      };
    }

    case 'fft_proc': {
      // Spectral tilt + resonant focus using a shelf + bandpass EQ
      const input = ctx.createGain(); input.gain.value = 1;
      const lowShelf = ctx.createBiquadFilter(); lowShelf.type = 'lowshelf';
      lowShelf.frequency.value = 1000;
      lowShelf.gain.value = -(p.tilt ?? 0);
      const highShelf = ctx.createBiquadFilter(); highShelf.type = 'highshelf';
      highShelf.frequency.value = 1000;
      highShelf.gain.value = (p.tilt ?? 0);
      const focus = ctx.createBiquadFilter(); focus.type = 'peaking';
      focus.frequency.value = 1000 + (p.focus ?? 0.5) * 4000;
      focus.Q.value = 3; focus.gain.value = (p.focus ?? 0.5) * 6;
      const { out, dryG, wetG } = wetDry(ctx, input, focus, p.mix ?? 1);
      input.connect(lowShelf); lowShelf.connect(highShelf); highShelf.connect(focus);
      // tilt_cv modulates highShelf.gain (positive CV tilts up highs); lowShelf is inverted via negation gain
      const tiltCv = ctx.createConstantSource(); tiltCv.offset.value = 0; tiltCv.start();
      const tiltNeg = ctx.createGain(); tiltNeg.gain.value = -1;
      tiltCv.connect(highShelf.gain);
      tiltCv.connect(tiltNeg); tiltNeg.connect(lowShelf.gain);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: input }],
          ['tilt_cv', { node: tiltCv, param: tiltCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'tilt') { lowShelf.gain.value = -val; highShelf.gain.value = val; }
          if (id === 'focus') {
            focus.frequency.value = 1000 + val * 4000;
            focus.gain.value = val * 6;
          }
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          try { tiltCv.stop(); } catch(_){} tiltCv.disconnect(); tiltNeg.disconnect();
          [input, lowShelf, highShelf, focus, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} });
        },
      };
    }

    // ── Granular ─────────────────────────────────────────────────────
    case 'granular': {
      // Granular approximation: multiple looped noise-burst sources at varying pitches
      const out = ctx.createGain(); out.gain.value = 0.3;
      const input = ctx.createGain(); input.gain.value = 1;
      // Generate a source buffer with tonal content
      const sr = ctx.sampleRate;
      const bufLen = Math.floor(sr * 0.5);
      const srcBuf = ctx.createBuffer(1, bufLen, sr);
      const sd = srcBuf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        sd[i] = (Math.random() * 2 - 1) * 0.5 + Math.sin(i * 0.05) * 0.3 + Math.sin(i * 0.1) * 0.2;
      }
      const grains: AudioBufferSourceNode[] = [];
      const numGrains = Math.round(p.density ?? 8);
      const pitch = p.pitch ?? 1;
      for (let g = 0; g < numGrains; g++) {
        const grain = ctx.createBufferSource();
        grain.buffer = srcBuf; grain.loop = true;
        grain.loopStart = (g / numGrains) * 0.5;
        grain.loopEnd = grain.loopStart + (p.grain_size ?? 0.1);
        grain.playbackRate.value = pitch * (1 + (Math.random() - 0.5) * (p.spread ?? 0.3) * 0.2);
        grain.connect(out); grain.start(ctx.currentTime + g * 0.02);
        grains.push(grain);
      }
      input.connect(out);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => { p[id] = val; },
        destroy: () => {
          grains.forEach(g => { try { g.stop(); } catch (_) {} g.disconnect(); });
          input.disconnect(); out.disconnect();
        },
      };
    }

    case 'time_stretch': {
      // Time stretch via playbackRate on a looped source buffer
      const input = ctx.createGain(); input.gain.value = 1;
      const delay = ctx.createDelay(2); delay.delayTime.value = 0.1;
      const fb = ctx.createGain(); fb.gain.value = 0.7;
      const { out, dryG, wetG } = wetDry(ctx, input, delay, p.mix ?? 1);
      input.connect(delay); delay.connect(fb); fb.connect(delay);
      // Speed < 1 = slower (time stretched). We adjust feedback depth.
      fb.gain.value = Math.min(0.95, 1 - (p.speed ?? 1) * 0.05);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'speed') {
            delay.delayTime.value = 0.1 / val;
            fb.gain.value = Math.min(0.95, 1 - val * 0.05);
          }
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, delay, fb, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'freeze_proc': {
      // Freeze: in FREEZE mode, recirculate audio through a long delay with high feedback
      const input = ctx.createGain(); input.gain.value = 1;
      const delay = ctx.createDelay(2); delay.delayTime.value = p.size ?? 0.5;
      const fb = ctx.createGain(); fb.gain.value = 0; // 0 = live, 0.98 = frozen
      const { out, dryG, wetG } = wetDry(ctx, input, delay, p.mix ?? 1);
      input.connect(delay); delay.connect(fb); fb.connect(delay);
      let frozen = false;
      const doFreeze = (on: boolean) => {
        frozen = on;
        fb.gain.value = on ? 0.98 : 0;
        dryG.gain.value = on ? 0 : 1 - (p.mix ?? 1);
      };
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'size') delay.delayTime.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        setSelector: (id, val) => {
          if (id === 'freeze') doFreeze(val > 0.5);
        },
        // freeze_in gate port: each gate-high toggles freeze on/off
        portNoteOn: new Map([
          ['freeze_in', () => { doFreeze(!frozen); }],
        ]),
        kill: () => {
          // Instantly silence the frozen loop: zero feedback + mute wet
          fb.gain.setTargetAtTime(0, delay.context.currentTime, 0.01);
          wetG.gain.setTargetAtTime(0, delay.context.currentTime, 0.01);
          // After the tail fades, restore dry + feedback ready for next freeze
          setTimeout(() => {
            fb.gain.value = 0;
            wetG.gain.value = p.mix ?? 1;
            dryG.gain.value = 1 - (p.mix ?? 1);
          }, 200);
        },
        destroy: () => { [input, delay, fb, out, dryG, wetG].forEach(n => { try { n.disconnect(); } catch(_){} }); },
      };
    }

    // ── Sampler ───────────────────────────────────────────────────────
    case 'sampler': {
      const NUM_BANKS = 8;
      const sampOut = ctx.createGain(); sampOut.gain.value = 1;
      // Persistent envelope gain for the attack ramp — sits between sources and sampOut
      const envGain = ctx.createGain(); envGain.gain.value = 1;
      envGain.connect(sampOut);
      const banks: (AudioBuffer | null)[]    = new Array(NUM_BANKS).fill(null);
      const banksRev: (AudioBuffer | null)[] = new Array(NUM_BANKS).fill(null);

      // CV tap: Analyser read at note-on time
      const makeSamplerCVTap = () => {
        const mix = ctx.createGain(); mix.gain.value = 1;
        const tap = ctx.createAnalyser(); tap.fftSize = 32;
        mix.connect(tap);
        const fbuf = new Float32Array(1);
        return {
          input:   { node: mix as AudioNode },
          read:    () => { tap.getFloatTimeDomainData(fbuf); return fbuf[0]; },
          destroy: () => { try { mix.disconnect(); } catch(_){} try { tap.disconnect(); } catch(_){} },
        };
      };
      const pitchCvTap = makeSamplerCVTap();
      const startCvTap = makeSamplerCVTap();
      const lenCvTap   = makeSamplerCVTap();
      const bankCvTap  = makeSamplerCVTap();

      let activeSource: AudioBufferSourceNode | null = null;
      let eocCb: ((on: boolean, freq: number) => void) | null = null;
      let samplerDestroyed = false;
      let lastTriggerMs = 0;
      let lastFreq = 440;
      let lastBankIdx = 0;
      // Track when and where playback started so we can resume from current position
      let playStartCtx  = 0; // ctx.currentTime at src.start()
      let playOffset    = 0; // offset (seconds) passed to src.start()
      let playRate      = 1; // playbackRate at start (for position estimation)

      const makeReversed = (buf: AudioBuffer): AudioBuffer => {
        const rev = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const fwd   = buf.getChannelData(c);
          const revCh = rev.getChannelData(c);
          for (let i = 0; i < buf.length; i++) revCh[i] = fwd[buf.length - 1 - i];
        }
        return rev;
      };

      // Returns estimated current playback position in seconds within the buffer
      const currentPos = (buf: AudioBuffer): number => {
        if (!activeSource) return 0;
        const pos = playOffset + (ctx.currentTime - playStartCtx) * playRate;
        return Math.max(0, Math.min(buf.duration, pos));
      };

      const sampPlay = (time: number, freq = 440, fromPos?: number) => {
        if (samplerDestroyed) return;
        lastFreq = freq;
        const bankIdx = Math.max(0, Math.min(NUM_BANKS - 1, Math.round((p.bank ?? 0) + bankCvTap.read())));
        lastBankIdx = bankIdx;
        const isRev   = Math.round(p.reverse ?? 0) > 0;
        const buf     = isRev ? banksRev[bankIdx] : banks[bankIdx];
        if (!buf) return;
        lastTriggerMs = performance.now();

        if (activeSource) {
          try { activeSource.stop(time); } catch (_) {}
          try { activeSource.disconnect(); } catch (_) {}
          activeSource = null;
        }

        const semis        = (p.pitch ?? 0) + pitchCvTap.read() * 12;
        // freq / 440 tracks keyboard pitch — no-op when freq defaults to 440
        const rate         = Math.max(0.01, (freq / 440) * Math.pow(2, semis / 12));
        const startFrac    = Math.max(0, Math.min(0.99, (p.start  ?? 0) + startCvTap.read() * 0.5));
        const lenFrac      = Math.max(0.01, Math.min(1 - startFrac, (p.length ?? 1) + lenCvTap.read() * 0.5));
        const startOffset  = startFrac * buf.duration;
        const duration     = lenFrac   * buf.duration;
        const looping      = Math.round(p.loop ?? 0) > 0;
        // If resuming mid-playback, clamp within the new region
        const offset = fromPos !== undefined
          ? Math.max(startOffset, Math.min(startOffset + duration, fromPos))
          : startOffset;

        // Schedule attack ramp on the shared envelope gain
        const atk = Math.max(0, p.attack ?? 0);
        envGain.gain.cancelScheduledValues(time);
        if (atk > 0.001) {
          envGain.gain.setValueAtTime(0, time);
          envGain.gain.linearRampToValueAtTime(1, time + atk);
        } else {
          envGain.gain.setValueAtTime(1, time);
        }

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        src.loop = looping;
        if (looping) { src.loopStart = startOffset; src.loopEnd = startOffset + duration; }
        src.connect(envGain);
        src.start(time, offset, looping ? undefined : Math.max(0.001, startOffset + duration - offset));
        activeSource  = src;
        playStartCtx  = time;
        playOffset    = offset;
        playRate      = rate;

        src.onended = () => {
          if (activeSource === src) activeSource = null;
          if (!samplerDestroyed && eocCb) {
            try {
              eocCb(true, freq);
              setTimeout(() => { if (!samplerDestroyed) eocCb?.(false, freq); }, 20);
            } catch (_) {}
          }
        };
      };

      const sampStop = (time: number) => {
        if (activeSource) {
          try { activeSource.stop(time); } catch (_) {}
          try { activeSource.disconnect(); } catch (_) {}
          activeSource = null;
        }
      };

      // Poll bank CV every 50 ms — switch bank immediately when it changes
      const bankCvPollId = setInterval(() => {
        if (samplerDestroyed) return;
        const newIdx = Math.max(0, Math.min(NUM_BANKS - 1, Math.round((p.bank ?? 0) + bankCvTap.read())));
        if (newIdx !== lastBankIdx && activeSource) {
          sampPlay(ctx.currentTime, lastFreq);
        }
      }, 50);

      return {
        outputs: new Map([['audio_out', sampOut]]),
        inputs: new Map([
          ['pitch_cv',  pitchCvTap.input],
          ['start_cv',  startCvTap.input],
          ['length_cv', lenCvTap.input],
          ['bank_cv',   bankCvTap.input],
        ]),
        noteOn:  (time: number, freq: number) => sampPlay(time, freq),
        noteOff: (time: number) => { if (Math.round(p.loop ?? 0) > 0) sampStop(time); },
        portNoteOn: new Map<string, (time: number, freq: number) => void>([
          ['gate_in', (time, freq) => sampPlay(time, freq)],
          ['sync_in', (time, freq) => sampPlay(time, freq)],
        ]),
        setParam: (id: string, val: number) => {
          p[id] = val;
          if (!activeSource || samplerDestroyed) return;
          if (id === 'pitch') {
            // Live pitch update — no glitch, just update playbackRate
            const semis = (p.pitch ?? 0) + pitchCvTap.read() * 12;
            const rate  = Math.max(0.01, (lastFreq / 440) * Math.pow(2, semis / 12));
            activeSource.playbackRate.value = rate;
            // Keep position tracking accurate after rate change
            playOffset   = currentPos(activeSource.buffer!);
            playStartCtx = ctx.currentTime;
            playRate     = rate;
          } else if (id === 'start' || id === 'length') {
            // Restart from start of new region (scrub behaviour)
            sampPlay(ctx.currentTime, lastFreq);
          } else if (id === 'bank') {
            // Switch buffer — restart from beginning of new bank
            sampPlay(ctx.currentTime, lastFreq);
          }
        },
        setSelector: (id: string, val: number) => {
          p[id] = val;
          if (!activeSource || samplerDestroyed) return;
          if (id === 'loop') {
            // Toggle loop live
            const looping = Math.round(val) > 0;
            activeSource.loop = looping;
            if (looping && activeSource.buffer) {
              const startFrac = Math.max(0, Math.min(0.99, p.start ?? 0));
              const lenFrac   = Math.max(0.01, Math.min(1 - startFrac, p.length ?? 1));
              activeSource.loopStart = startFrac * activeSource.buffer.duration;
              activeSource.loopEnd   = (startFrac + lenFrac) * activeSource.buffer.duration;
            }
          } else if (id === 'reverse') {
            // Flip direction — restart with reversed/forward buffer from current position
            const bankIdx = Math.max(0, Math.min(NUM_BANKS - 1, Math.round(p.bank ?? 0)));
            const buf = activeSource.buffer;
            const pos = buf ? currentPos(buf) : 0;
            // Mirror position within buffer for the reversed variant
            const mirroredPos = buf ? Math.max(0, buf.duration - pos) : 0;
            sampPlay(ctx.currentTime, lastFreq, mirroredPos);
          }
        },
        setPortGateTrigger: (_portId: string, fn: (on: boolean, freq: number) => void) => {
          eocCb = fn;
        },
        getLevel: () => Math.max(0, 1 - (performance.now() - lastTriggerMs) / 500),
        loadSample: async (arrayBuffer: ArrayBuffer, bankIndex: number) => {
          const idx = Math.max(0, Math.min(NUM_BANKS - 1, bankIndex));
          const buf = await ctx.decodeAudioData(arrayBuffer.slice(0));
          banks[idx]    = buf;
          banksRev[idx] = makeReversed(buf);
        },
        destroy: () => {
          samplerDestroyed = true;
          eocCb = null;
          clearInterval(bankCvPollId);
          sampStop(ctx.currentTime);
          pitchCvTap.destroy(); startCvTap.destroy();
          lenCvTap.destroy();   bankCvTap.destroy();
          try { envGain.disconnect(); } catch (_) {}
          try { sampOut.disconnect(); } catch (_) {}
        },
      };
    }

    // ── Utility ──────────────────────────────────────────────────────
    case 'mixer': {
      const NUM_CH = 6;
      type ChStrip = { lo: BiquadFilterNode; mid: BiquadFilterNode; hi: BiquadFilterNode; gain: GainNode };
      const channels: ChStrip[] = [];
      const out = ctx.createGain(); out.gain.value = 1;
      for (let i = 0; i < NUM_CH; i++) {
        const n = i + 1;
        const lo  = ctx.createBiquadFilter(); lo.type  = 'lowshelf';  lo.frequency.value = 200;  lo.gain.value  = p[`ch${n}_lo`]  ?? 0;
        const mid = ctx.createBiquadFilter(); mid.type = 'peaking';   mid.frequency.value = 1000; mid.Q.value = 0.7; mid.gain.value = p[`ch${n}_mid`] ?? 0;
        const hi  = ctx.createBiquadFilter(); hi.type  = 'highshelf'; hi.frequency.value = 4000; hi.gain.value  = p[`ch${n}_hi`]  ?? 0;
        const gain = ctx.createGain(); gain.gain.value = p[`ch${n}`] ?? 0.8;
        lo.connect(mid); mid.connect(hi); hi.connect(gain); gain.connect(out);
        channels.push({ lo, mid, hi, gain });
      }
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map(channels.map((ch, i) => [`in${i + 1}`, { node: ch.lo as AudioNode }])),
        setParam: (id, val) => {
          p[id] = val;
          const m = id.match(/^ch(\d+)(?:_(hi|mid|lo))?$/);
          if (!m) return;
          const ch = channels[parseInt(m[1]) - 1];
          if (!ch) return;
          if (!m[2])           ch.gain.gain.value = val;
          else if (m[2] === 'hi')  ch.hi.gain.value  = val;
          else if (m[2] === 'mid') ch.mid.gain.value  = val;
          else if (m[2] === 'lo')  ch.lo.gain.value   = val;
        },
        destroy: () => {
          channels.forEach(ch => { ch.lo.disconnect(); ch.mid.disconnect(); ch.hi.disconnect(); ch.gain.disconnect(); });
          out.disconnect();
        },
      };
    }

    case 'keyboard': {
      const freqSource  = ctx.createConstantSource(); freqSource.offset.value  = 440; freqSource.start();
      const pitchSource = ctx.createConstantSource(); pitchSource.offset.value = 0;   pitchSource.start();
      const modSource   = ctx.createConstantSource(); modSource.offset.value   = 0;   modSource.start();
      let lastGateMs = 0;
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      return {
        outputs: new Map<string, AudioNode>([
          ['voct_out',  freqSource],
          ['pitch_out', pitchSource],
          ['mod_out',   modSource],
        ]),
        inputs: new Map(),
        noteOn:  (_time, freq) => {
          freqSource.offset.value = freq;
          lastGateMs = performance.now();
          if (gateCb) gateCb(true, freq);
        },
        noteOff: (_time, freq = 440) => {
          if (gateCb) gateCb(false, freq);
        },
        setPortGateTrigger: (portId, fn) => {
          if (portId === 'gate_out') gateCb = fn;
        },
        setParam: () => {},
        getLevel: () => Math.max(0, 1 - (performance.now() - lastGateMs) / 200),
        destroy: () => {
          freqSource.stop();  freqSource.disconnect();
          pitchSource.stop(); pitchSource.disconnect();
          modSource.stop();   modSource.disconnect();
        },
      };
    }

    // ── Euclidean Trigger Generator (Shakmat Knight's Gallop inspired) ─────────
    case 'euclidean_trig': {
      // Bjorklund/Bresenham euclidean pattern
      const eucPat = (n: number, f: number, sh: number): boolean[] => {
        const steps = Math.max(2, Math.min(16, n));
        const fill  = Math.max(0, Math.min(steps, f));
        const pattern: boolean[] = [];
        let bucket = 0;
        for (let i = 0; i < steps; i++) {
          bucket += fill;
          if (bucket >= steps) { bucket -= steps; pattern.push(true); }
          else pattern.push(false);
        }
        const shift = ((Math.round(sh) % steps) + steps) % steps;
        return [...pattern.slice(shift), ...pattern.slice(0, shift)];
      };

      // ── CV input taps — sampled at tick time (accurate for DC/slow CV) ────
      const makeCVTap = () => {
        const mix = ctx.createGain(); mix.gain.value = 1;
        const tap = ctx.createAnalyser(); tap.fftSize = 32;
        mix.connect(tap);
        const buf = new Float32Array(1);
        return {
          input: { node: mix as AudioNode },
          read:  () => { tap.getFloatTimeDomainData(buf); return buf[0]; },
          destroy: () => { mix.disconnect(); tap.disconnect(); },
        };
      };
      const stepsCV = makeCVTap();
      const fillCV  = makeCVTap();
      const shiftCV = makeCVTap();

      let gateCb:    ((on: boolean, freq: number) => void) | null = null;
      let invGateCb: ((on: boolean, freq: number) => void) | null = null;
      let clkCb:     ((on: boolean, freq: number) => void) | null = null;
      const stepRef = { value: 0 };
      let clockStep = 0;

      // div selector: ×4=0.25, ×2=0.5, ×1=1, /2=2, /4=4 multiplier on base interval
      const divMults = [0.25, 0.5, 1, 2, 4];
      const getMs = () => 60000 / (p.bpm ?? 120) * (divMults[Math.round(p.div ?? 2)] ?? 1);

      const tick = (_beat: number) => {
        // knob base + CV offset (1 CV unit ≈ 1 step of modulation)
        const stepsBase = Math.round(p.steps ?? 8);
        const fillBase  = Math.round(p.fill  ?? 4);
        const shiftBase = Math.round(p.shift ?? 0);
        const steps = Math.max(2, Math.min(16, stepsBase + Math.round(stepsCV.read())));
        const fill  = Math.max(0, Math.min(steps, fillBase + Math.round(fillCV.read())));
        const shift = shiftBase + Math.round(shiftCV.read());
        const pattern = eucPat(steps, fill, shift);
        const step = clockStep % steps;
        stepRef.value = step;
        clockStep++;
        const dur = getMs() * 0.4;
        // CLK fires on every tick regardless of pattern
        if (clkCb) { clkCb(true, 440); setTimeout(() => clkCb?.(false, 440), dur); }
        if (pattern[step]) {
          gateCb?.(true, 440);
          setTimeout(() => gateCb?.(false, 440), dur);
        } else {
          if (invGateCb) { invGateCb(true, 440); setTimeout(() => invGateCb?.(false, 440), dur); }
        }
      };

      const restartTimer = () => { clockStep = 0; timer.updateInterval(); };
      let timer = makeClockTimer(getMs, tick);

      return {
        outputs: new Map(),
        inputs: new Map([
          ['steps_cv', stepsCV.input],
          ['fill_cv',  fillCV.input],
          ['shift_cv', shiftCV.input],
        ]),
        stepRef,
        portNoteOn: new Map([
          // SYNC: reset pattern to step 0 on rising gate edge
          ['sync', () => { clockStep = 0; }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'bpm') restartTimer();
        },
        setSelector: (id, val) => {
          p[id] = val;
          if (id === 'div') restartTimer();
        },
        setPortGateTrigger: (portId, fn) => {
          if (portId === 'gate_out') gateCb = fn;
          else if (portId === 'inv_out') invGateCb = fn;
          else if (portId === 'clk_out') clkCb = fn;
        },
        destroy: () => {
          timer.destroy();
          gateCb = null; invGateCb = null; clkCb = null;
          stepsCV.destroy(); fillCV.destroy(); shiftCV.destroy();
        },
      };
    }

    // ── POLY STEP — 8-track polyrhythmic drum sequencer ─────────────────────────
    case 'poly_step': {
      const NTRACKS = 8;
      const LEN_MAP = [4, 8, 12, 16, 32] as const;

      // CV input taps — sampled at each tick
      const makeCVTap = () => {
        const mix = ctx.createGain(); mix.gain.value = 1;
        const tap = ctx.createAnalyser(); tap.fftSize = 32;
        mix.connect(tap);
        const buf = new Float32Array(1);
        return {
          input:   { node: mix as AudioNode },
          read:    () => { tap.getFloatTimeDomainData(buf); return buf[0]; },
          destroy: () => { mix.disconnect(); tap.disconnect(); },
        };
      };
      const swingCv = makeCVTap();
      const bpmCv   = makeCVTap();

      // CV output nodes — per-track velocity + global position/step
      const posNode  = ctx.createConstantSource(); posNode.offset.value  = 0; posNode.start();
      const stepNode = ctx.createConstantSource(); stepNode.offset.value = 0; stepNode.start();
      const velNodes = Array.from({ length: NTRACKS }, () => {
        const n = ctx.createConstantSource(); n.offset.value = 0; n.start(); return n;
      });

      // Gate callbacks — keyed by output port id
      const gateCbs = new Map<string, (on: boolean, freq: number) => void>();

      // Runtime state
      const trackPos = new Int32Array(NTRACKS);
      const stepRef  = { value: 0 };
      let running    = true;
      let clkStep    = 0;

      const getMs      = () => Math.max(5, 15000 / Math.max(1, (p.bpm ?? 120) + bpmCv.read() * 120));
      const getSwing   = () => Math.min(0.49, Math.max(0, (p.swing ?? 0) + swingCv.read() * 0.25));
      const getGateLen = () => Math.max(0.05, Math.min(0.9, p.gate_len ?? 0.4));

      const fire = (portId: string, dur: number, freq = 440) => {
        const cb = gateCbs.get(portId);
        if (!cb) return;
        cb(true, freq); setTimeout(() => cb(false, freq), dur);
      };

      const doTick = () => {
        const ms  = getMs();
        const dur = ms * getGateLen();

        // Clock passthrough — every tick
        fire('clk_out', dur);

        // Store track-1 step position in stepRef for UI polling.
        // Delay the visual update to match when the audio actually plays so the
        // step indicator stays in sync even with lookahead scheduling.
        const _p = trackPos[0];
        const _visualDelay = _currentTickAudioTime
          ? Math.max(0, (_currentTickAudioTime - ctx.currentTime) * 1000 - 10)
          : 0;
        if (_visualDelay > 0) setTimeout(() => { stepRef.value = _p; }, _visualDelay);
        else stepRef.value = _p;

        // Master position CV — all tracks share global_len
        const masterLenIdx = Math.max(0, Math.min(4, Math.round(p.global_len ?? 3)));
        const masterLen    = LEN_MAP[masterLenIdx];
        const masterStep   = trackPos[0];
        // Bug fix 1: stepNode used a hardcoded /15 denominator; use masterLen - 1 like posNode
        posNode.offset.value  = masterLen > 1 ? masterStep / (masterLen - 1) : 0;
        stepNode.offset.value = masterLen > 1 ? masterStep / (masterLen - 1) : 0;

        // Beat pulse on track-1 step 0
        if (masterStep === 0) fire('beat_out', dur);

        // Per-track processing
        for (let t = 0; t < NTRACKS; t++) {
          const tn  = t + 1;
          const len = masterLen;
          const mask  = Math.round(p[`t${tn}`]     ?? 0) | 0;
          const acc   = Math.round(p[`t${tn}_acc`] ?? 0) | 0;
          const prob  = Math.min(1, Math.max(0, p[`t${tn}_prob`] ?? 1));
          const muted = (p[`t${tn}_mute`] ?? 0) > 0.5;
          const vel   = Math.min(1, Math.max(0.01, p[`t${tn}_vel`] ?? 0.8));
          const step  = trackPos[t];
          const bit   = 1 << step;
          const isOn  = (mask & bit) !== 0;
          const isAcc = (acc  & bit) !== 0;
          const isEOC = step === len - 1;

          // Global EOC on track 1 wrap
          if (isEOC && t === 0) fire('eoc_out', dur);

          // Bug fix 2: velocity CV must only be non-zero when the gate actually fires
          // (mute and probability both gate it), and must drop back to 0 when the gate
          // closes (after dur ms) rather than staying high for the entire step period.
          if (!muted && isOn && Math.random() < prob) {
            const scaledVel = vel * (isAcc ? 1.0 : 0.6);
            velNodes[t].offset.value = scaledVel;
            setTimeout(() => { velNodes[t].offset.value = 0; }, dur);
            fire(`t${tn}_gate`, dur, isAcc ? 880 : 440);
          } else {
            velNodes[t].offset.value = 0;
          }

          // Advance track step (wraps at track length)
          trackPos[t] = (step + 1) % len;
        }

        clkStep++;
      };

      let lastExtClkMs    = -Infinity;
      let extClkIntervalMs = Infinity; // measured interval between the last two external pulses

      const tick = (beatIndex: number) => {
        if ((p.clk_src ?? 0) > 0.5) return; // explicit external clock mode
        // Auto-detect: suppress internal timer while external CLK is active.
        // Use 1.5× the measured external pulse interval so the window always
        // outlasts the gap between pulses, regardless of the external tempo.
        const suppressFor = Number.isFinite(extClkIntervalMs)
          ? extClkIntervalMs * 1.5
          : getMs() * 6;   // fallback before first two pulses arrive
        if (performance.now() - lastExtClkMs < suppressFor) return;
        if (!running) return;
        const swing = getSwing();
        if (swing > 0.005 && beatIndex % 2 === 1) {
          setTimeout(doTick, getMs() * swing);
        } else {
          doTick();
        }
      };

      let timer = makeClockTimer(getMs, tick);

      const outputs = new Map<string, AudioNode>([
        ['pos_cv',  posNode  as AudioNode],
        ['step_cv', stepNode as AudioNode],
        ...velNodes.map((n, i) => [`t${i + 1}_vel`, n as AudioNode] as [string, AudioNode]),
      ]);

      const inputs = new Map([
        ['swing_cv', swingCv.input],
        ['bpm_cv',   bpmCv.input  ],
      ]);

      return {
        outputs,
        inputs,
        stepRef,
        portNoteOn: new Map([
          // External clock: each rising edge advances one step; marks lastExtClkMs to suppress internal timer
          ['clk_in',  (_t: number, _f?: number) => {
            if (!running) return;
            const now = performance.now();
            if (lastExtClkMs > -Infinity) extClkIntervalMs = now - lastExtClkMs;
            lastExtClkMs = now;
            // Each incoming pulse = 1 quarter note = 4 16th-note steps
            const ms    = getMs();
            const swing = getSwing();
            for (let s = 0; s < 4; s++) {
              const delay = s * ms + (swing > 0.005 && (clkStep + s) % 2 === 1 ? ms * swing : 0);
              if (delay === 0) doTick();
              else setTimeout(doTick, delay);
            }
          }],
          // Reset all tracks to step 0
          ['rst_in',  () => {
            for (let i = 0; i < NTRACKS; i++) trackPos[i] = 0;
            clkStep = 0;
            posNode.offset.value  = 0;
            stepNode.offset.value = 0;
            stepRef.value         = 0;
          }],
          // Toggle run/stop
          ['run_in',  () => { running = !running; }],
        ]),
        setPortGateTrigger: (portId, fn) => { gateCbs.set(portId, fn); },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'bpm') timer.updateInterval();
          if (id === 'transport') {
            if (val >= 1 && val < 2) {
              running = true;                                        // play
            } else if (val >= 2) {
              running = false;                                       // pause — keep position
            } else {
              running = false;                                       // stop — reset to start
              for (let i = 0; i < NTRACKS; i++) trackPos[i] = 0;
              clkStep = 0; stepRef.value = 0;
            }
          }
        },
        destroy: () => {
          timer.destroy();
          gateCbs.clear();
          try { posNode.stop(); } catch(_){} try { stepNode.stop(); } catch(_){}
          for (const n of velNodes) { try { n.stop(); } catch(_){} }
          swingCv.destroy(); bpmCv.destroy();
        },
      };
    }

    // ── Bass Drum ─────────────────────────────────────────────────────────────
    case 'bd_drum': {
      const outGain = ctx.createGain();
      outGain.gain.value = p.vol ?? 0.9;

      const mkTap = () => {
        const mix = ctx.createGain(); mix.gain.value = 1;
        const tap = ctx.createAnalyser(); tap.fftSize = 32;
        mix.connect(tap);
        const buf = new Float32Array(1);
        return {
          input:   { node: mix as AudioNode },
          read:    () => { tap.getFloatTimeDomainData(buf); return buf[0]; },
          destroy: () => { mix.disconnect(); tap.disconnect(); },
        };
      };
      const tuneTap  = mkTap();
      const decayTap = mkTap();

      const fire = (accented: boolean) => {
        const t = _currentTickAudioTime || ctx.currentTime;

        const tuneHz    = Math.max(15, (p.tune  ?? 60)  + tuneTap.read()  * 100);
        const decaySecs = Math.max(0.05, (p.decay ?? 0.5) + decayTap.read() * 0.5);
        const punch = p.punch ?? 0.65;
        const snap  = p.snap  ?? 0.35;
        const drive = p.drive ?? 0;
        const boost = accented ? 1.3 : 1.0;

        // ── Sine body: pitch sweeps from startHz → endHz over first 55% of decay ──
        const startHz = tuneHz * (1 + punch * 4.5);
        const endHz   = Math.max(15, tuneHz * (1 - punch * 0.82));
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(startHz, t);
        osc.frequency.exponentialRampToValueAtTime(endHz, t + decaySecs * 0.55);
        env.gain.setValueAtTime(boost, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + decaySecs);
        osc.connect(env);

        if (drive > 0.02) {
          const ws = ctx.createWaveShaper();
          const n = 256; const k = 1 + drive * 12;
          const curve = new Float32Array(n);
          for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = Math.tanh(x * k) / Math.tanh(k); }
          ws.curve = curve;
          env.connect(ws); ws.connect(outGain);
        } else {
          env.connect(outGain);
        }
        osc.start(t); osc.stop(t + decaySecs + 0.05);

        // ── Click / snap transient (14 ms noise burst at attack) ──
        if (snap > 0.01) {
          const sr  = ctx.sampleRate;
          const dur = 0.014;
          const nb  = ctx.createBuffer(1, Math.ceil(sr * dur), sr);
          const nd  = nb.getChannelData(0);
          for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
          const ns = ctx.createBufferSource(); ns.buffer = nb;
          const ng = ctx.createGain();
          ng.gain.setValueAtTime(snap * boost, t);
          ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
          ns.connect(ng); ng.connect(outGain);
          ns.start(t); ns.stop(t + dur + 0.002);
        }
      };

      return {
        outputs: new Map([['audio_out', outGain]]),
        inputs: new Map([
          ['tune_cv',  tuneTap.input],
          ['decay_cv', decayTap.input],
        ]),
        portNoteOn: new Map([
          ['trig_in',   () => fire(false)],
          ['accent_in', () => fire(true)],
        ]),
        getPortLevel: (portId: string) => {
          if (portId === 'tune_cv')  return Math.max(0, Math.min(1, (tuneTap.read()  + 1) / 2));
          if (portId === 'decay_cv') return Math.max(0, Math.min(1, (decayTap.read() + 1) / 2));
          return 0;
        },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'vol') outGain.gain.value = val;
        },
        destroy: () => {
          outGain.disconnect();
          tuneTap.destroy();
          decayTap.destroy();
        },
      };
    }

    // ── Drum Machine (Erica Synths Techno System inspired) ──────────────────────
    case 'drum_machine': {
      const master = ctx.createGain(); master.gain.value = 0.8;

      const CHANS = ['kick', 'snr', 'hhc', 'hho', 'clp', 'per'];
      const volGains: Record<string, GainNode> = {};
      for (const ch of CHANS) {
        volGains[ch] = ctx.createGain();
        volGains[ch].gain.value = p[`${ch}_vol`] ?? 0.7;
        volGains[ch].connect(master);
      }

      // ── Parametric synthesis voices ─────────────────────────────────
      const fireKick = () => {
        const t     = _currentTickAudioTime || ctx.currentTime;
        const tune  = p.kick_tune  ?? 0.5;   // 0-1
        const decay = p.kick_decay ?? 0.5;   // s
        const punch = p.kick_punch ?? 0.65;  // 0-1 pitch sweep depth
        const drive = p.kick_drive ?? 0;     // 0-1 waveshaper

        const startHz = 60 + tune * 140;                      // 60-200 Hz
        const endHz   = Math.max(20, startHz * (1 - punch * 0.88));
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.frequency.setValueAtTime(startHz, t);
        osc.frequency.exponentialRampToValueAtTime(endHz, t + decay * 0.55);
        env.gain.setValueAtTime(1, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + decay);
        osc.connect(env);

        if (drive > 0.02) {
          const ws = ctx.createWaveShaper();
          const n = 256; const k = 1 + drive * 9; const curve = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const x = (i * 2) / n - 1;
            curve[i] = Math.tanh(x * k) / Math.tanh(k);
          }
          ws.curve = curve;
          env.connect(ws); ws.connect(volGains.kick);
        } else {
          env.connect(volGains.kick);
        }
        osc.start(t); osc.stop(t + decay + 0.05);

        // click transient
        const sr = ctx.sampleRate;
        const nb = ctx.createBuffer(1, (sr * 0.014) | 0, sr);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        const ns = ctx.createBufferSource(); ns.buffer = nb;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.55, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.014);
        ns.connect(ng); ng.connect(volGains.kick);
        ns.start(t); ns.stop(t + 0.018);
      };

      const fireSnare = () => {
        const t     = _currentTickAudioTime || ctx.currentTime;
        const tune  = p.snr_tune  ?? 190;    // body Hz
        const snap  = p.snr_snap  ?? 0.7;    // noise level
        const decay = p.snr_decay ?? 0.18;   // s
        const tone  = p.snr_tone  ?? 900;    // noise HP filter Hz
        const sr = ctx.sampleRate;

        // noise component
        const nDur = Math.max(decay + 0.04, 0.12);
        const nb = ctx.createBuffer(1, (sr * nDur) | 0, sr);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        const ns = ctx.createBufferSource(); ns.buffer = nb;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = tone;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(snap * 0.9, t); ng.gain.exponentialRampToValueAtTime(0.001, t + decay);
        ns.connect(hp); hp.connect(ng); ng.connect(volGains.snr);
        ns.start(t); ns.stop(t + nDur);

        // body tone
        const osc = ctx.createOscillator(); osc.frequency.value = tune;
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.45);
        osc.connect(og); og.connect(volGains.snr);
        osc.start(t); osc.stop(t + decay * 0.5);
      };

      // Helper: metallic body component (pitched sub-oscillator added to HH voices)
      const makeHHBody = (freq: number, bodyAmt: number, dur: number, dest: GainNode) => {
        if (bodyAmt < 0.01) return;
        const t = _currentTickAudioTime || ctx.currentTime;
        const osc = ctx.createOscillator(); osc.type = 'square';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(bodyAmt * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);
        osc.connect(g); g.connect(dest);
        osc.start(t); osc.stop(t + dur + 0.01);
      };

      const fireHHC = () => {
        const t     = _currentTickAudioTime || ctx.currentTime;
        const tone  = p.hhc_tone  ?? 7500;   // HP Hz
        const decay = p.hhc_decay ?? 0.04;   // s
        const body  = p.hhc_body  ?? 0.15;   // metallic body amount
        const sr = ctx.sampleRate;
        const dur = Math.max(decay + 0.008, 0.02);
        const nb = ctx.createBuffer(1, (sr * dur) | 0, sr);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        const ns = ctx.createBufferSource(); ns.buffer = nb;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = tone;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay);
        ns.connect(hp); hp.connect(g); g.connect(volGains.hhc);
        ns.start(t); ns.stop(t + dur);
        makeHHBody(tone * 0.13, body, dur, volGains.hhc);
      };

      const fireHHO = () => {
        const t     = _currentTickAudioTime || ctx.currentTime;
        const tone  = p.hho_tone  ?? 6000;   // HP Hz
        const decay = p.hho_decay ?? 0.35;   // s
        const body  = p.hho_body  ?? 0.15;   // metallic body amount
        const sr = ctx.sampleRate;
        const dur = decay + 0.04;
        const nb = ctx.createBuffer(1, (sr * dur) | 0, sr);
        const nd = nb.getChannelData(0);
        for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        const ns = ctx.createBufferSource(); ns.buffer = nb;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = tone;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay);
        ns.connect(hp); hp.connect(g); g.connect(volGains.hho);
        ns.start(t); ns.stop(t + dur);
        makeHHBody(tone * 0.13, body, dur, volGains.hho);
      };

      const fireClap = () => {
        const t     = _currentTickAudioTime || ctx.currentTime;
        const tune  = p.clp_tune  ?? 1400;   // BP Hz
        const snap  = p.clp_snap  ?? 0.8;    // layer spread (0-1)
        const decay = p.clp_decay ?? 0.2;    // s
        const sr = ctx.sampleRate;
        for (let layer = 0; layer < 3; layer++) {
          const lt  = t + layer * snap * 0.013;
          const dur = layer < 2 ? 0.05 : decay;
          const nb = ctx.createBuffer(1, (sr * (dur + 0.01)) | 0, sr);
          const nd = nb.getChannelData(0);
          for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
          const ns = ctx.createBufferSource(); ns.buffer = nb;
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = tune; bp.Q.value = 0.75;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.65, lt); g.gain.exponentialRampToValueAtTime(0.001, lt + dur);
          ns.connect(bp); bp.connect(g); g.connect(volGains.clp);
          ns.start(lt); ns.stop(lt + dur + 0.02);
        }
      };

      const firePerc = () => {
        const t     = _currentTickAudioTime || ctx.currentTime;
        const tune  = p.per_tune  ?? 300;    // start Hz
        const decay = p.per_decay ?? 0.15;   // s
        const sweep = p.per_sweep ?? 0.5;    // pitch env depth
        const endHz = Math.max(40, tune * (1 - sweep * 0.92));
        const osc = ctx.createOscillator();
        osc.frequency.setValueAtTime(tune, t);
        osc.frequency.exponentialRampToValueAtTime(endHz, t + decay * 0.65);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.85, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay);
        osc.connect(g); g.connect(volGains.per);
        osc.start(t); osc.stop(t + decay + 0.05);
      };

      let drumDestroyed = false;

      // Per-port trigger handlers — voices fired entirely by external gates
      const portNoteOn = new Map<string, (time: number, freq?: number) => void>([
        ['kick_trig', () => { if (!drumDestroyed) try { fireKick(); } catch(_){} }],
        ['snr_trig',  () => { if (!drumDestroyed) try { fireSnare(); } catch(_){} }],
        ['hhc_trig',  () => { if (!drumDestroyed) try { fireHHC(); } catch(_){} }],
        ['hho_trig',  () => { if (!drumDestroyed) try { fireHHO(); } catch(_){} }],
        ['clp_trig',  () => { if (!drumDestroyed) try { fireClap(); } catch(_){} }],
        ['per_trig',  () => { if (!drumDestroyed) try { firePerc(); } catch(_){} }],
      ]);

      return {
        outputs: new Map<string, AudioNode>([
          ['out',      master],
          ['kick_out', volGains.kick],
          ['snr_out',  volGains.snr],
          ['hhc_out',  volGains.hhc],
          ['hho_out',  volGains.hho],
          ['clp_out',  volGains.clp],
          ['per_out',  volGains.per],
        ]),
        inputs:  new Map(),
        portNoteOn,
        setParam: (id, val) => {
          p[id] = val;
          if (id.endsWith('_vol')) {
            const ch = id.replace('_vol', '');
            if (volGains[ch]) volGains[ch].gain.value = val;
          }
        },
        setSelector: () => {},
        destroy: () => {
          drumDestroyed = true;
          try { master.disconnect(); } catch(_){}
          for (const ch of CHANS) { try { volGains[ch].disconnect(); } catch(_){} }
        },
      };
    }

    case 'midi_monitor':
    case 'midi_clock_in': {
      return { outputs: new Map(), inputs: new Map(), setParam: () => {}, destroy: () => {} };
    }

    case 'output': {
      const master = ctx.createGain();
      master.gain.value = p.volume ?? 0.7;
      // Route through analyser so the VU meter can read levels
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.0;
      master.connect(analyser);
      analyser.connect(ctx.destination);
      const volCv = ctx.createConstantSource(); volCv.offset.value = 0; volCv.start();
      volCv.connect(master.gain);
      return {
        outputs: new Map(),
        inputs: new Map([
          ['in_l', { node: master }],
          ['in_r', { node: master }],
          ['vol_cv', { node: volCv, param: volCv.offset }],
        ]),
        setParam: (id, val) => { p[id] = val; if (id === 'volume') master.gain.value = val; },
        destroy: () => { volCv.stop(); volCv.disconnect(); master.disconnect(); analyser.disconnect(); },
        analyser,
      };
    }

    // ── Audio Trig ────────────────────────────────────────────────────
    case 'audio_trig': {
      const NUM_CH = 8;
      let stream: MediaStream | null = null;
      let sourceNode: MediaStreamAudioSourceNode | null = null;
      let splitter: ChannelSplitterNode | null = null;
      let deviceLabel = 'No device';
      let deviceList: { deviceId: string; label: string }[] = [];
      const gateCbs = new Map<string, (on: boolean, freq: number) => void>();
      const lastTrigMs: number[] = Array(NUM_CH).fill(-Infinity);
      let pollId: ReturnType<typeof setInterval> | null = null;
      let destroyed = false;

      // Per-channel gain nodes and analysers
      const chGains: GainNode[] = [];
      const analysers: AnalyserNode[] = [];
      const dataArrays: Float32Array<ArrayBuffer>[] = [];
      for (let i = 0; i < NUM_CH; i++) {
        const g = ctx.createGain();
        g.gain.value = p[`ch${i + 1}_gain`] ?? 1;
        chGains.push(g);
        const a = ctx.createAnalyser(); a.fftSize = 512;
        g.connect(a);
        analysers.push(a);
        dataArrays.push(new Float32Array(a.fftSize) as Float32Array<ArrayBuffer>);
      }

      const startCapture = async (deviceId?: string) => {
        if (pollId) { clearInterval(pollId); pollId = null; }
        if (stream) stream.getTracks().forEach(t => t.stop());
        if (sourceNode) { try { sourceNode.disconnect(); } catch (_) {} sourceNode = null; }
        if (splitter)   { try { splitter.disconnect(); }   catch (_) {} splitter = null; }

        // Guard: media API might not be available (e.g. non-HTTPS or sandboxed iframe)
        if (!navigator.mediaDevices?.getUserMedia) {
          deviceLabel = 'Not available — open in new tab';
          console.warn('[AUDIO TRIG] navigator.mediaDevices.getUserMedia is unavailable. Open the app in a new browser tab to enable microphone access.');
          if (!destroyed) pollId = setInterval(() => { /* no-op poll */ }, 500);
          return;
        }

        deviceLabel = 'Requesting…';
        console.log('[AUDIO TRIG] startCapture()', deviceId ?? '(default)');

        // Resume AudioContext if browser suspended it
        if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (_) {} }

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              // Use 'ideal' so the browser gracefully falls back instead of throwing OverconstrainedError
              ...(deviceId ? { deviceId: { ideal: deviceId } } : {}),
              channelCount:     { ideal: NUM_CH },
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl:  false,
            },
          });
          const track = stream.getAudioTracks()[0];
          deviceLabel = track?.label ?? 'Unknown device';
          const numCh = track?.getSettings().channelCount ?? 2;
          console.log('[AUDIO TRIG] Capture OK —', deviceLabel, numCh, 'ch');
          sourceNode = ctx.createMediaStreamSource(stream);
          splitter = ctx.createChannelSplitter(Math.max(numCh, 1));
          sourceNode.connect(splitter);
          for (let i = 0; i < Math.min(numCh, NUM_CH); i++) {
            splitter.connect(chGains[i], i, 0);
          }
          // Enumerate available audio inputs now that permission is granted
          navigator.mediaDevices.enumerateDevices().then(all => {
            deviceList = all
              .filter(d => d.kind === 'audioinput')
              .map(d => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 8)}` }));
            console.log('[AUDIO TRIG] Devices:', deviceList.map(d => d.label));
          }).catch(() => {});
        } catch (err) {
          const msg = err instanceof DOMException
            ? (err.name === 'NotAllowedError' ? 'Permission denied' : `${err.name}: ${err.message}`)
            : String(err);
          deviceLabel = msg;
          const name = err instanceof DOMException ? err.name : '';
          const msg2 = err instanceof DOMException ? err.message : String(err);
          console.error('[AUDIO TRIG] getUserMedia failed:', name, msg2);
        }

        if (destroyed) return;
        pollId = setInterval(() => {
          try {
            const now = performance.now();
            for (let i = 0; i < NUM_CH; i++) {
              if ((p[`ch${i + 1}_on`] ?? (i < 6 ? 1 : 0)) < 0.5) continue;
              const thresh   = p[`ch${i + 1}_thresh`] ?? 0.12;
              const retrigMs = (p[`ch${i + 1}_retrig`] ?? 0.08) * 1000;
              const d = dataArrays[i];
              analysers[i].getFloatTimeDomainData(d);
              let rms = 0;
              for (let j = 0; j < d.length; j++) rms += d[j] * d[j];
              rms = Math.sqrt(rms / d.length);
              if (rms > thresh && now - lastTrigMs[i] > retrigMs) {
                lastTrigMs[i] = now;
                const cb = gateCbs.get(`gate${i + 1}_out`);
                cb?.(true, 440);
                setTimeout(() => { try { cb?.(false, 440); } catch (_) {} }, 12);
              }
            }
          } catch (err) {
            console.warn('[AudioTrig] poll error:', err);
          }
        }, 16);
      };

      startCapture();

      return {
        outputs: new Map<string, AudioNode>(),
        inputs:  new Map(),
        setParam: (id, val) => {
          p[id] = val;
          const gainMatch = id.match(/^ch(\d+)_gain$/);
          if (gainMatch) {
            const idx = parseInt(gainMatch[1]) - 1;
            if (chGains[idx]) chGains[idx].gain.value = val;
          }
        },
        setPortGateTrigger: (portId, fn) => { gateCbs.set(portId, fn); },
        getLevel: () => {
          let total = 0, count = 0;
          for (let i = 0; i < NUM_CH; i++) {
            if ((p[`ch${i + 1}_on`] ?? (i < 6 ? 1 : 0)) < 0.5) continue;
            const d = dataArrays[i];
            analysers[i].getFloatTimeDomainData(d);
            let rms = 0;
            for (let j = 0; j < d.length; j++) rms += d[j] * d[j];
            total += Math.sqrt(rms / d.length);
            count++;
          }
          return count > 0 ? Math.min(1, (total / count) * 14) : 0;
        },
        triggerDeviceRepick: (deviceId?: string) => { startCapture(deviceId); },
        getDeviceLabel: () => deviceLabel,
        getDeviceList: () => deviceList,
        destroy: () => {
          destroyed = true;
          if (pollId) clearInterval(pollId);
          stream?.getTracks().forEach(t => t.stop());
          try { sourceNode?.disconnect(); } catch (_) {}
          try { splitter?.disconnect(); }   catch (_) {}
          chGains.forEach(g => { try { g.disconnect(); } catch (_) {} });
          analysers.forEach(a => { try { a.disconnect(); } catch (_) {} });
        },
      };
    }

    // ── CV / Gate ×6 Multiplier ───────────────────────────────────────
    case 'cv_gate_mult': {
      // CV path: one input gain fans out to 6 unity-gain output nodes
      const cvIn = ctx.createGain(); cvIn.gain.value = 1;
      const cvOuts: GainNode[] = [];
      for (let i = 0; i < 6; i++) {
        const g = ctx.createGain(); g.gain.value = 1;
        cvIn.connect(g);
        cvOuts.push(g);
      }

      // Gate path: callbacks stored per output port
      const gateCbs = new Map<string, (on: boolean, freq: number) => void>();

      const outputs = new Map<string, AudioNode>();
      const inputs  = new Map<string, { node: AudioNode; param?: AudioParam }>();
      inputs.set('cv_in', { node: cvIn });
      for (let i = 0; i < 6; i++) outputs.set(`cv${i + 1}_out`, cvOuts[i]);

      return {
        outputs,
        inputs,
        setParam: () => {},
        noteOn: (_t, freq) => {
          for (const cb of gateCbs.values()) cb(true, freq);
        },
        noteOff: () => {
          for (const cb of gateCbs.values()) cb(false, 0);
        },
        setPortGateTrigger: (portId, fn) => { gateCbs.set(portId, fn); },
        // gate_in port: a gate signal patched here fires all downstream gate callbacks
        portNoteOn: new Map([
          ['gate_in', (_t: number, freq: number = 440) => {
            for (const cb of gateCbs.values()) cb(true, freq);
            setTimeout(() => { for (const cb of gateCbs.values()) cb(false, freq); }, 20);
          }],
        ]),
        destroy: () => {
          try { cvIn.disconnect(); } catch (_) {}
          cvOuts.forEach(g => { try { g.disconnect(); } catch (_) {} });
        },
      };
    }

    default:
      console.warn(`Unknown module type: ${typeId}`);
      return {
        outputs: new Map(), inputs: new Map(),
        setParam: () => {}, destroy: () => {},
      };
  }
}

// ─── Port wiring ─────────────────────────────────────────────────────────────
export function connectAudioPorts(
  fromNodes: AudioModuleNodes,
  fromPortId: string,
  toNodes: AudioModuleNodes,
  toPortId: string,
) {
  const src = fromNodes.outputs.get(fromPortId);
  const dst = toNodes.inputs.get(toPortId);
  if (!src || !dst) return;
  try {
    if (dst.param) src.connect(dst.param);
    else src.connect(dst.node as AudioNode);
  } catch (_) {}
}

export function disconnectAudioPorts(
  fromNodes: AudioModuleNodes,
  fromPortId: string,
  toNodes: AudioModuleNodes,
  toPortId: string,
) {
  const src = fromNodes.outputs.get(fromPortId);
  const dst = toNodes.inputs.get(toPortId);
  if (!src || !dst) return;
  try {
    if (dst.param) src.disconnect(dst.param);
    else src.disconnect(dst.node as AudioNode);
  } catch (_) {}
}
