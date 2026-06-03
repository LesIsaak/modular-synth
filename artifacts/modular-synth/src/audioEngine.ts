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
  /** Per-port gate handlers (e.g. individual drum voice triggers) */
  portNoteOn?: Map<string, (time: number, freq?: number) => void>;
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
function makeClockTimer(getInterval: () => number, onTick: (beatIndex: number) => void) {
  let timerId: ReturnType<typeof setInterval> | null = null;
  let beat = 0;
  const restart = () => {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => { onTick(beat); beat++; }, getInterval());
  };
  restart();
  return { restart, destroy: () => { if (timerId) clearInterval(timerId); } };
}

// ─── Main factory ─────────────────────────────────────────────────────────────
export function createAudioModule(
  ctx: AudioContext,
  typeId: string,
  params: Record<string, number>,
): AudioModuleNodes {
  const p = { ...params };

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
      const octShift = ctx.createGain();
      octShift.gain.value = 0;
      const voct = ctx.createConstantSource();
      voct.offset.value = 0;
      voct.connect(osc.frequency);
      voct.start(); osc.start();
      octShift.disconnect();
      return {
        outputs: new Map([['out', osc]]),
        inputs: new Map([['voct', { node: voct, param: voct.offset }]]),
        noteOn: (_t, freq) => { voct.offset.value = freq * Math.pow(2, Math.round(p.octave ?? 0)); },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') osc.frequency.value = val;
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
      return {
        outputs: new Map([['out', merge]]),
        inputs: new Map([['voct', { node: voct, param: voct.offset }]]),
        noteOn: (_t, freq) => {
          for (let h = 0; h < oscs.length; h++) oscs[h].frequency.value = freq * (h + 1);
        },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') for (let h = 0; h < oscs.length; h++) oscs[h].frequency.value = val * (h + 1);
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
        [0, 4, 7], [0, 3, 7], [0, 5, 7], [0, 3, 6], [0, 4, 8], [0, 4, 7, 10],
      ];
      const merge = ctx.createGain(); merge.gain.value = 0.35;
      const oscs: OscillatorNode[] = [];
      const baseFreq = p.freq ?? 220;
      const intervals = chordIntervals[Math.round(p.chord ?? 0)] ?? chordIntervals[0];
      for (const semi of intervals) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = baseFreq * Math.pow(2, semi / 12) * (p.spread ?? 1);
        o.start(); o.connect(merge); oscs.push(o);
      }
      const voct = ctx.createConstantSource(); voct.offset.value = 0; voct.start();
      return {
        outputs: new Map([['out', merge]]),
        inputs: new Map([['voct', { node: voct, param: voct.offset }]]),
        noteOn: (_t, freq) => {
          const intv = chordIntervals[Math.round(p.chord ?? 0)] ?? chordIntervals[0];
          oscs.forEach((o, i) => { o.frequency.value = freq * Math.pow(2, (intv[i] ?? 0) / 12) * (p.spread ?? 1); });
        },
        setParam: (id, val) => { p[id] = val; },
        setSelector: (id, val) => { p[id] = val; },
        destroy: () => {
          voct.stop(); voct.disconnect();
          oscs.forEach(o => { o.stop(); o.disconnect(); }); merge.disconnect();
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
          if (id === 'cutoff') f.frequency.value = val;
          if (id === 'res') f.Q.value = val;
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
          if (id === 'cutoff') filters.forEach(f => { f.frequency.value = val; });
          if (id === 'res') filters.forEach(f => { f.Q.value = val / stages; });
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
          if (id === 'cutoff') filters.forEach(f => { f.frequency.value = val; });
          if (id === 'res') fbGain.gain.value = Math.min(0.9, val * 0.22);
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
      [lp, hp].forEach(f => { f.frequency.value = p.cutoff ?? 1000; f.Q.value = p.res ?? 1; });
      lp.connect(lpG); hp.connect(hpG); lpG.connect(out); hpG.connect(out);
      const morphCs = ctx.createConstantSource(); morphCs.offset.value = morph; morphCs.start();
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['audio_in', { node: lp }],
          ['morph_cv', { node: morphCs, param: morphCs.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'cutoff') { lp.frequency.value = val; hp.frequency.value = val; }
          if (id === 'res') { lp.Q.value = val; hp.Q.value = val; }
          if (id === 'morph') { lpG.gain.value = 1 - val; hpG.gain.value = val; }
        },
        destroy: () => {
          morphCs.stop(); morphCs.disconnect();
          [lp, hp, lpG, hpG, out].forEach(n => n.disconnect());
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
          if (id === 'gain') gain.gain.value = val;
          if (id === 'offset') offsetCs.offset.value = val;
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
      return {
        outputs: new Map([['env_out', cv], ['eoc_out', eoc]]),
        inputs: new Map([
          ['gate_in', { node: cv }],
          ['retrig_in', { node: cv }],
        ]),
        noteOn: (time, _freq) => {
          const a = p.attack ?? 0.01, d = p.decay ?? 0.1, s = p.sustain ?? 0.7;
          cv.offset.cancelScheduledValues(time);
          cv.offset.setValueAtTime(0, time);
          cv.offset.linearRampToValueAtTime(1, time + a);
          cv.offset.linearRampToValueAtTime(s, time + a + d);
          eoc.offset.setValueAtTime(1, time + a + d); eoc.offset.setValueAtTime(0, time + a + d + 0.01);
        },
        noteOff: (time) => {
          const r = p.release ?? 0.3;
          cv.offset.cancelScheduledValues(time);
          cv.offset.setValueAtTime(cv.offset.value, time);
          cv.offset.linearRampToValueAtTime(0, time + r);
        },
        setParam: (id, val) => { p[id] = val; },
        destroy: () => { cv.stop(); cv.disconnect(); eoc.stop(); eoc.disconnect(); },
      };
    }

    case 'ahdsr': {
      const cv = ctx.createConstantSource();
      cv.offset.value = 0; cv.start();
      const eoc = ctx.createConstantSource(); eoc.offset.value = 0; eoc.start();
      return {
        outputs: new Map([['env_out', cv], ['eoc_out', eoc]]),
        inputs: new Map([
          ['gate_in', { node: cv }],
          ['retrig_in', { node: cv }],
        ]),
        noteOn: (time, _freq) => {
          const a = p.attack ?? 0.01, h = p.hold ?? 0.05, d = p.decay ?? 0.15, s = p.sustain ?? 0.6;
          cv.offset.cancelScheduledValues(time);
          cv.offset.setValueAtTime(0, time);
          cv.offset.linearRampToValueAtTime(1, time + a);
          cv.offset.setValueAtTime(1, time + a + h);
          cv.offset.linearRampToValueAtTime(s, time + a + h + d);
          eoc.offset.setValueAtTime(1, time + a + h + d); eoc.offset.setValueAtTime(0, time + a + h + d + 0.01);
        },
        noteOff: (time) => {
          const r = p.release ?? 0.4;
          cv.offset.cancelScheduledValues(time);
          cv.offset.setValueAtTime(cv.offset.value, time);
          cv.offset.linearRampToValueAtTime(0, time + r);
        },
        setParam: (id, val) => { p[id] = val; },
        destroy: () => { cv.stop(); cv.disconnect(); eoc.stop(); eoc.disconnect(); },
      };
    }

    // ── LFOs ─────────────────────────────────────────────────────────
    case 'lfo': {
      const waveMap: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];
      const allOscs = waveMap.map((t, i) => {
        const o = ctx.createOscillator(); o.type = t;
        o.frequency.value = p.rate ?? 1; o.start();
        return o;
      });
      const allGains = allOscs.map(() => {
        const g = ctx.createGain(); g.gain.value = p.depth ?? 200; return g;
      });
      allOscs.forEach((o, i) => o.connect(allGains[i]));
      // main selector output (single osc active)
      const mainGain = ctx.createGain(); mainGain.gain.value = 1;
      let selIdx = Math.round(p.wave ?? 0);
      allGains[selIdx].connect(mainGain);
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = p.rate ?? 1; rateCv.start();
      rateCv.connect(allOscs[0].frequency); rateCv.connect(allOscs[1].frequency);
      rateCv.connect(allOscs[2].frequency); rateCv.connect(allOscs[3].frequency);
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = p.depth ?? 200; depthCv.start();
      return {
        outputs: new Map<string, AudioNode>([
          ['cv_out', mainGain],
          ['sin_out', allGains[0]], ['tri_out', allGains[1]],
          ['saw_out', allGains[2]], ['sqr_out', allGains[3]],
        ]),
        inputs: new Map([
          ['rate_cv', { node: rateCv, param: rateCv.offset }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
          ['reset_in', { node: rateCv }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') { allOscs.forEach(o => { o.frequency.value = val; }); rateCv.offset.value = val; }
          if (id === 'depth') { allGains.forEach(g => { g.gain.value = val; }); depthCv.offset.value = val; }
        },
        setSelector: (id, val) => {
          if (id === 'wave') {
            allGains[selIdx].disconnect(mainGain);
            selIdx = Math.round(val);
            allGains[selIdx].connect(mainGain);
          }
        },
        destroy: () => {
          rateCv.stop(); rateCv.disconnect(); depthCv.stop(); depthCv.disconnect();
          allOscs.forEach(o => { o.stop(); o.disconnect(); });
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
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = p.rate ?? 0.5; rateCv.start();
      rateCv.connect(allOscs[0].frequency); rateCv.connect(allOscs[1].frequency);
      rateCv.connect(allOscs[2].frequency); rateCv.connect(allOscs[3].frequency);
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = p.depth ?? 200; depthCv.start();
      return {
        outputs: new Map<string, AudioNode>([
          ['cv_out', mainGain],
          ['sin_out', allGains[0]], ['tri_out', allGains[1]],
          ['saw_out', allGains[2]], ['sqr_out', allGains[3]],
        ]),
        inputs: new Map([
          ['rate_cv', { node: rateCv, param: rateCv.offset }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') { allOscs.forEach(o => { o.frequency.value = val; }); rateCv.offset.value = val; }
          if (id === 'depth') { allGains.forEach(g => { g.gain.value = val; }); }
          if (id === 'drift') driftGain.gain.value = val * 0.3;
        },
        setSelector: (id, val) => {
          if (id === 'wave') {
            allGains[selIdx].disconnect(mainGain);
            selIdx = Math.round(val);
            allGains[selIdx].connect(mainGain);
          }
        },
        destroy: () => {
          rateCv.stop(); rateCv.disconnect(); depthCv.stop(); depthCv.disconnect();
          drift.stop(); drift.disconnect(); driftGain.disconnect();
          allOscs.forEach(o => { o.stop(); o.disconnect(); });
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
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = p.rate ?? 2; rateCv.start();
      allOscs.forEach(o => rateCv.connect(o.frequency));
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = p.depth ?? 200; depthCv.start();
      return {
        outputs: new Map<string, AudioNode>([
          ['cv_out', mainGain],
          ['sin_out', allGains[0]], ['sqr_out', allGains[1]],
          ['saw_out', allGains[2]], ['tri_out', allGains[3]],
        ]),
        inputs: new Map([
          ['rate_cv', { node: rateCv, param: rateCv.offset }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') { allOscs.forEach(o => { o.frequency.value = val; }); rateCv.offset.value = val; }
          if (id === 'depth') { allGains.forEach(g => { g.gain.value = val; }); }
        },
        setSelector: (id, val) => {
          if (id === 'wave') {
            allGains[selIdx].disconnect(mainGain);
            selIdx = Math.round(val);
            allGains[selIdx].connect(mainGain);
          }
        },
        destroy: () => {
          rateCv.stop(); rateCv.disconnect(); depthCv.stop(); depthCv.disconnect();
          allOscs.forEach(o => { o.stop(); o.disconnect(); });
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
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = p.rate ?? 1; rateCv.start();
      oscs.forEach(o => rateCv.connect(o.frequency));
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = p.depth ?? 200; depthCv.start();
      return {
        outputs: new Map([
          ['sin_out', gains[0]], ['tri_out', gains[1]],
          ['saw_out', gains[2]], ['sqr_out', gains[3]],
        ]),
        inputs: new Map([
          ['rate_cv', { node: rateCv, param: rateCv.offset }],
          ['depth_cv', { node: depthCv, param: depthCv.offset }],
          ['reset_in', { node: rateCv }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') { oscs.forEach(o => { o.frequency.value = val; }); rateCv.offset.value = val; }
          if (id === 'depth') gains.forEach(g => { g.gain.value = val; });
        },
        destroy: () => {
          rateCv.stop(); rateCv.disconnect(); depthCv.stop(); depthCv.disconnect();
          oscs.forEach(o => { o.stop(); o.disconnect(); });
          gains.forEach(g => g.disconnect());
        },
      };
    }

    // ── Sequencers ───────────────────────────────────────────────────
    case 'seq_step': {
      const freqNode = ctx.createConstantSource();
      freqNode.offset.value = 0; freqNode.start();
      let step = 0;
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      const getMs = () => 60000 / (p.bpm ?? 120);
      let timer = makeClockTimer(getMs, (i) => {
        step = i % 8;
        const midi = Math.round(p[`s${step + 1}`] ?? (60 + step));
        const freq = midiToHz(midi);
        freqNode.offset.value = freq;
        gateCb?.(true, freq);
        setTimeout(() => gateCb?.(false, freq), getMs() * 0.45);
      });
      return {
        outputs: new Map([['voct_out', freqNode]]),
        inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') { timer.destroy(); timer = makeClockTimer(getMs, (i) => { step = i % 8; const midi = Math.round(p[`s${step + 1}`] ?? 60); const freq = midiToHz(midi); freqNode.offset.value = freq; gateCb?.(true, freq); setTimeout(() => gateCb?.(false, freq), getMs() * 0.45); }); } },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); freqNode.stop(); freqNode.disconnect(); },
      };
    }

    case 'seq_trigger': {
      let step = 0;
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      const getMs = () => 60000 / (p.bpm ?? 120);
      let timer = makeClockTimer(getMs, (i) => {
        step = i % 8;
        const active = (p[`t${step + 1}`] ?? 0) > 0.5;
        if (active) {
          gateCb?.(true, 440);
          setTimeout(() => gateCb?.(false, 440), getMs() * 0.4);
        }
      });
      return {
        outputs: new Map(),
        inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') { timer.destroy(); timer = makeClockTimer(getMs, (i) => { const s = i % 8; if ((p[`t${s+1}`] ?? 0) > 0.5) { gateCb?.(true, 440); setTimeout(() => gateCb?.(false, 440), getMs() * 0.4); } }); } },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); },
      };
    }

    case 'seq_cv': {
      const cvNode = ctx.createConstantSource(); cvNode.offset.value = 0; cvNode.start();
      let step = 0;
      const getMs = () => 60000 / (p.bpm ?? 120);
      let timer = makeClockTimer(getMs, (i) => {
        step = i % 8;
        cvNode.offset.value = (p[`v${step + 1}`] ?? 0) * 500;
      });
      return {
        outputs: new Map([['cv_out', cvNode]]),
        inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') { timer.destroy(); timer = makeClockTimer(getMs, (i) => { cvNode.offset.value = (p[`v${(i%8)+1}`] ?? 0) * 500; }); } },
        destroy: () => { timer.destroy(); cvNode.stop(); cvNode.disconnect(); },
      };
    }

    case 'seq_gate': {
      let step = 0;
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      const getMs = () => 60000 / (p.bpm ?? 120);
      let timer = makeClockTimer(getMs, (i) => {
        step = i % 8;
        const active = (p[`g${step + 1}`] ?? 0) > 0.5;
        if (active) {
          const len = getMs() * (p.gate_len ?? 0.5);
          gateCb?.(true, 440);
          setTimeout(() => gateCb?.(false, 440), len);
        }
      });
      return {
        outputs: new Map(),
        inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') { timer.destroy(); timer = makeClockTimer(getMs, (i) => { const s = i % 8; if ((p[`g${s+1}`]??0) > 0.5) { gateCb?.(true,440); setTimeout(()=>gateCb?.(false,440), getMs()*(p.gate_len??0.5)); } }); } },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); },
      };
    }

    // ── Arpeggiator ──────────────────────────────────────────────────
    case 'arpeggiator': {
      const voct = ctx.createConstantSource(); voct.offset.value = 0; voct.start();
      const heldNotes: number[] = [];   // freqs in play order
      let lastNoteFreq = 0;
      let stepIdx = 0;
      let gateCb: ((on: boolean, freq: number) => void) | null = null;

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
          case 2: { // UP/DOWN ping-pong
            const total = n <= 1 ? 1 : (n - 1) * 2;
            const pos = stepIdx % total;
            freq = pos < n ? seq[pos] : seq[total - pos];
            stepIdx = (stepIdx + 1) % total; break;
          }
          case 3: { // DOWN/UP ping-pong
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
          case 6: { // OUTSIDE IN
            const oi = stepIdx % n;
            freq = oi % 2 === 0 ? seq[n - 1 - Math.floor(oi / 2)] : seq[Math.floor(oi / 2)];
            stepIdx = (stepIdx + 1) % n; break;
          }
          case 7: { // INSIDE OUT
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
          default:
            freq = seq[stepIdx % n]; stepIdx = (stepIdx + 1) % n;
        }
        return freq;
      };

      const tick = () => {
        const freq = getNextFreq();
        if (freq === null) return;
        voct.offset.value = freq;
        gateCb?.(true, freq);
        const gl = Math.min(0.95, p.gate_len ?? 0.5);
        setTimeout(() => gateCb?.(false, freq), getStepMs() * gl);
      };

      let timer = makeClockTimer(getStepMs, tick);

      return {
        outputs: new Map([['voct_out', voct]]),
        inputs: new Map(),
        noteOn: (_t, freq) => { if (!heldNotes.includes(freq)) heldNotes.push(freq); lastNoteFreq = freq; },
        noteOff: (_t) => {
          const idx = heldNotes.indexOf(lastNoteFreq);
          if (idx >= 0) { heldNotes.splice(idx, 1); if (stepIdx >= Math.max(1, heldNotes.length)) stepIdx = 0; }
        },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'bpm' || id === 'div') { timer.destroy(); stepIdx = 0; timer = makeClockTimer(getStepMs, tick); }
        },
        setSelector: (id, val) => { p[id] = val; stepIdx = 0; },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); voct.stop(); voct.disconnect(); },
      };
    }

    // ── Clock ────────────────────────────────────────────────────────
    case 'clock_gen': {
      let gateCb: ((on: boolean, freq: number) => void) | null = null;
      let beat = 0;
      const getMs = () => 60000 / (p.bpm ?? 120);
      let timer = makeClockTimer(getMs, (i) => {
        beat = i;
        const ms = getMs();
        const swingOffset = (beat % 2 === 1) ? ms * (p.swing ?? 0) : 0;
        setTimeout(() => {
          gateCb?.(true, 440);
          setTimeout(() => gateCb?.(false, 440), ms * 0.45);
        }, swingOffset);
      });
      return {
        outputs: new Map(),
        inputs: new Map(),
        setParam: (id, val) => { p[id] = val; if (id === 'bpm') { timer.destroy(); beat = 0; timer = makeClockTimer(getMs, (i) => { beat = i; gateCb?.(true, 440); setTimeout(() => gateCb?.(false, 440), getMs() * 0.45); }); } },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); },
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
        setParam: (id, val) => { p[id] = val; timer.destroy(); timer = makeClockTimer(getMs, () => { gateCb?.(true, 440); setTimeout(() => gateCb?.(false, 440), getMs() * 0.45); }); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); },
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
        setParam: (id, val) => { p[id] = val; timer.destroy(); timer = makeClockTimer(getMs, () => { gateCb?.(true, 440); setTimeout(() => gateCb?.(false, 440), getMs() * 0.45); }); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); },
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
        setParam: (id, val) => { p[id] = val; timer.destroy(); timer = makeClockTimer(getMs, () => { const d = getMs()*(p.delay??0.25); setTimeout(()=>{ gateCb?.(true,440); setTimeout(()=>gateCb?.(false,440), getMs()*0.45); }, d); }); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); },
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
        setParam: (id, val) => { p[id] = val; timer.destroy(); beat = 0; timer = makeClockTimer(getMs, (i) => { const sh = i%2===1 ? getMs()*(p.shuffle??0.2) : 0; setTimeout(()=>{ gateCb?.(true,440); setTimeout(()=>gateCb?.(false,440), getMs()*0.4); }, sh); }); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); },
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
        setParam: (id, val) => { p[id] = val; timer.destroy(); beat = 0; timer = makeClockTimer(getMs, (i) => { const sw = i%2===1 ? getMs()*(p.swing??0.33) : 0; setTimeout(()=>{ gateCb?.(true,440); setTimeout(()=>gateCb?.(false,440), getMs()*0.4); }, sw); }); },
        setGateTrigger: fn => { gateCb = fn; },
        destroy: () => { timer.destroy(); },
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
          flutter.stop(); flutter.disconnect();
          [input, delay, fb, flutterGain, out, dryG, wetG].forEach(n => n.disconnect());
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
      const pitchGain = ctx.createGain(); pitchGain.gain.value = (p.shimmer ?? 0.5) * 0.15;
      pitch.connect(pitchGain); pitchGain.connect(conv); pitch.start();
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, conv, p.mix ?? 0.4);
      input.connect(conv);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'size') conv.buffer = makeHallIR(ctx, val);
          if (id === 'shimmer') pitchGain.gain.value = val * 0.15;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          pitch.stop(); pitch.disconnect();
          [input, conv, pitchGain, out, dryG, wetG].forEach(n => n.disconnect());
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
        const lg = ctx.createGain(); lg.gain.value = (p.depth ?? 0.5) * 0.006;
        lfo.connect(lg); lg.connect(d.delayTime); lfo.start();
        input.connect(d); d.connect(wetSum);
        delays.push(d); lfos.push(lfo); lfoGains.push(lg);
      }
      const { out, dryG, wetG } = wetDry(ctx, input, wetSum, p.mix ?? 0.5);
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = p.rate ?? 1.5; rateCv.start();
      lfos.forEach((l, i) => rateCv.connect(l.frequency));
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = p.depth ?? 0.5; depthCv.start();
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
          if (id === 'depth') lfoGains.forEach(lg => { lg.gain.value = val * 0.006; });
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          rateCv.stop(); rateCv.disconnect(); depthCv.stop(); depthCv.disconnect();
          lfos.forEach(l => { l.stop(); l.disconnect(); });
          [input, wetSum, out, dryG, wetG, ...delays, ...lfoGains].forEach(n => n.disconnect());
        },
      };
    }

    case 'flanger': {
      const input = ctx.createGain(); input.gain.value = 1;
      const delay = ctx.createDelay(0.1); delay.delayTime.value = 0.005;
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.5;
      const lfo = ctx.createOscillator(); lfo.frequency.value = p.rate ?? 0.5;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = (p.depth ?? 0.7) * 0.004;
      lfo.connect(lfoGain); lfoGain.connect(delay.delayTime); lfo.start();
      input.connect(delay); delay.connect(fb); fb.connect(delay);
      const { out, dryG, wetG } = wetDry(ctx, input, delay, p.mix ?? 0.5);
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = p.rate ?? 0.5; rateCv.start();
      rateCv.connect(lfo.frequency);
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = p.depth ?? 0.7; depthCv.start();
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
          if (id === 'depth') lfoGain.gain.value = val * 0.004;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          rateCv.stop(); rateCv.disconnect(); depthCv.stop(); depthCv.disconnect();
          lfo.stop(); lfo.disconnect();
          [input, delay, fb, lfoGain, out, dryG, wetG].forEach(n => n.disconnect());
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
      const lfoGain = ctx.createGain(); lfoGain.gain.value = (p.depth ?? 0.8) * 900;
      const lfoOffset = ctx.createConstantSource(); lfoOffset.offset.value = 1000; lfoOffset.start();
      lfo.connect(lfoGain);
      allpasses.forEach(ap => { lfoGain.connect(ap.frequency); lfoOffset.connect(ap.frequency); });
      lfo.start();
      const fb = ctx.createGain(); fb.gain.value = p.feedback ?? 0.4;
      allpasses[numStages - 1].connect(fb); fb.connect(allpasses[0]);
      const { out, dryG, wetG } = wetDry(ctx, input, allpasses[numStages - 1], p.mix ?? 0.5);
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = p.rate ?? 0.5; rateCv.start();
      rateCv.connect(lfo.frequency);
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = p.depth ?? 0.8; depthCv.start();
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
          if (id === 'depth') lfoGain.gain.value = val * 900;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          rateCv.stop(); rateCv.disconnect(); depthCv.stop(); depthCv.disconnect();
          lfo.stop(); lfo.disconnect(); lfoOffset.stop(); lfoOffset.disconnect();
          [input, ...allpasses, lfoGain, fb, out, dryG, wetG].forEach(n => n.disconnect());
        },
      };
    }

    case 'vibrato': {
      const input = ctx.createGain(); input.gain.value = 1;
      const delay = ctx.createDelay(0.05); delay.delayTime.value = 0.005;
      const lfo = ctx.createOscillator(); lfo.frequency.value = p.rate ?? 5;
      const lfoG = ctx.createGain(); lfoG.gain.value = (p.depth ?? 0.3) * 0.003;
      lfo.connect(lfoG); lfoG.connect(delay.delayTime); lfo.start();
      input.connect(delay);
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = p.rate ?? 5; rateCv.start();
      rateCv.connect(lfo.frequency);
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = p.depth ?? 0.3; depthCv.start();
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
          if (id === 'depth') lfoG.gain.value = val * 0.003;
        },
        destroy: () => {
          rateCv.stop(); rateCv.disconnect(); depthCv.stop(); depthCv.disconnect();
          lfo.stop(); lfo.disconnect();
          [input, delay, lfoG].forEach(n => n.disconnect());
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
      const lfoG = ctx.createGain(); lfoG.gain.value = (p.depth ?? 0.6) * 0.5;
      const dc = ctx.createConstantSource(); dc.offset.value = 1 - (p.depth ?? 0.6) * 0.5; dc.start();
      dc.connect(amp.gain); lfo.connect(lfoG); lfoG.connect(amp.gain); lfo.start();
      input.connect(amp);
      const rateCv = ctx.createConstantSource(); rateCv.offset.value = p.rate ?? 5; rateCv.start();
      rateCv.connect(lfo.frequency);
      const depthCv = ctx.createConstantSource(); depthCv.offset.value = p.depth ?? 0.6; depthCv.start();
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
          if (id === 'depth') { lfoG.gain.value = val * 0.5; dc.offset.value = 1 - val * 0.5; }
        },
        setSelector: (id, val) => {
          if (id === 'wave') lfo.type = waveMap[Math.round(val)] ?? 'sine';
        },
        destroy: () => {
          rateCv.stop(); rateCv.disconnect(); depthCv.stop(); depthCv.disconnect();
          lfo.stop(); lfo.disconnect(); dc.stop(); dc.disconnect();
          [input, amp, lfoG].forEach(n => n.disconnect());
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
          amLfo.stop(); amLfo.disconnect(); fmLfo.stop(); fmLfo.disconnect();
          dc.stop(); dc.disconnect();
          [input, amp, amG, fmG, delay, out, dryG, wetG].forEach(n => n.disconnect());
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
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'drive') shaper.curve = softClip(val);
          if (id === 'tone') tone.frequency.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, shaper, tone, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'fuzz': {
      const shaper = ctx.createWaveShaper(); shaper.curve = hardClip(p.fuzz ?? 80);
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass';
      tone.frequency.value = p.tone ?? 2000;
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, tone, p.mix ?? 1);
      input.connect(shaper); shaper.connect(tone); tone.connect(wetG);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'fuzz') shaper.curve = hardClip(val);
          if (id === 'tone') tone.frequency.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, shaper, tone, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'wavefolder': {
      const shaper = ctx.createWaveShaper(); shaper.curve = foldCurve(p.fold ?? 3);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, shaper, p.mix ?? 1);
      input.connect(shaper);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'fold') shaper.curve = foldCurve(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, shaper, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'bitcrusher': {
      const shaper = ctx.createWaveShaper(); shaper.curve = bitcrushCurve(p.bits ?? 8);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, shaper, p.mix ?? 1);
      input.connect(shaper);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'bits') shaper.curve = bitcrushCurve(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, shaper, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'samplerate': {
      const shaper = ctx.createWaveShaper(); shaper.curve = srReduceCurve(p.factor ?? 8);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, shaper, p.mix ?? 1);
      input.connect(shaper);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'factor') shaper.curve = srReduceCurve(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, shaper, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    case 'saturator': {
      const shaper = ctx.createWaveShaper(); shaper.curve = tanhCurve(p.drive ?? 5);
      const input = ctx.createGain(); input.gain.value = 1;
      const { out, dryG, wetG } = wetDry(ctx, input, shaper, p.mix ?? 1);
      input.connect(shaper);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'drive') shaper.curve = tanhCurve(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, shaper, out, dryG, wetG].forEach(n => n.disconnect()); },
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
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'shift') carrier.frequency.value = Math.abs(val);
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => {
          carrier.stop(); carrier.disconnect();
          [input, ring, out, dryG, wetG].forEach(n => n.disconnect());
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
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') bands.forEach((b, i) => { b.frequency.value = val * (i + 1); });
          if (id === 'q') bands.forEach(b => { b.Q.value = val; });
          if (id === 'mix') dry.gain.value = 1 - val;
        },
        destroy: () => { [input, out, dry, ...bands].forEach(n => n.disconnect()); },
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
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'tilt') { lowShelf.gain.value = -val; highShelf.gain.value = val; }
          if (id === 'focus') {
            focus.frequency.value = 1000 + val * 4000;
            focus.gain.value = val * 6;
          }
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        destroy: () => { [input, lowShelf, highShelf, focus, out, dryG, wetG].forEach(n => n.disconnect()); },
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
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'size') delay.delayTime.value = val;
          if (id === 'mix') { dryG.gain.value = 1 - val; wetG.gain.value = val; }
        },
        setSelector: (id, val) => {
          if (id === 'freeze') {
            // FREEZE on: high feedback = frozen loop; off = normal pass-through
            fb.gain.value = val > 0.5 ? 0.98 : 0;
            dryG.gain.value = val > 0.5 ? 0 : 1 - (p.mix ?? 1);
          }
        },
        destroy: () => { [input, delay, fb, out, dryG, wetG].forEach(n => n.disconnect()); },
      };
    }

    // ── Utility ──────────────────────────────────────────────────────
    case 'mixer': {
      const gains = [
        ctx.createGain(), ctx.createGain(), ctx.createGain(),
        ctx.createGain(), ctx.createGain(), ctx.createGain(),
      ];
      const out = ctx.createGain(); out.gain.value = 1;
      const keys = ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6'];
      gains.forEach((g, i) => { g.gain.value = p[keys[i]] ?? 0.8; g.connect(out); });
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['in1', { node: gains[0] }], ['in2', { node: gains[1] }],
          ['in3', { node: gains[2] }], ['in4', { node: gains[3] }],
          ['in5', { node: gains[4] }], ['in6', { node: gains[5] }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          const idx = keys.indexOf(id);
          if (idx >= 0) gains[idx].gain.value = val;
        },
        destroy: () => { gains.forEach(g => g.disconnect()); out.disconnect(); },
      };
    }

    case 'keyboard': {
      const freqSource  = ctx.createConstantSource(); freqSource.offset.value  = 440; freqSource.start();
      const pitchSource = ctx.createConstantSource(); pitchSource.offset.value = 0;   pitchSource.start();
      const modSource   = ctx.createConstantSource(); modSource.offset.value   = 0;   modSource.start();
      return {
        outputs: new Map<string, AudioNode>([
          ['voct_out',  freqSource],
          ['pitch_out', pitchSource],
          ['mod_out',   modSource],
        ]),
        inputs: new Map(),
        noteOn:  (_time, freq) => { freqSource.offset.value = freq; },
        setParam: () => {},
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

      const restartTimer = () => { timer.destroy(); clockStep = 0; timer = makeClockTimer(getMs, tick); };
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
          stepsCV.destroy(); fillCV.destroy(); shiftCV.destroy();
        },
      };
    }

    // ── POLY STEP — 8-track polyrhythmic drum sequencer ─────────────────────────
    case 'poly_step': {
      const NTRACKS = 8;
      const LEN_MAP = [4, 8, 12, 16] as const;

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
      let fillActive = false;
      let clkStep    = 0;

      const getMs      = () => Math.max(20, 60000 / Math.max(1, (p.bpm ?? 120) + bpmCv.read() * 120));
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

        // Pack 8×4-bit track positions into stepRef for UI polling
        let packed = 0;
        for (let t = 0; t < NTRACKS; t++) packed |= (trackPos[t] << (t * 4));
        stepRef.value = packed;

        // Master position CV — all tracks share global_len
        const masterLenIdx = Math.max(0, Math.min(3, Math.round(p.global_len ?? 3)));
        const masterLen    = LEN_MAP[masterLenIdx];
        const masterStep   = trackPos[0];
        posNode.offset.value  = masterLen > 1 ? masterStep / (masterLen - 1) : 0;
        stepNode.offset.value = masterStep / 15;

        // Beat pulse on track-1 step 0
        if (masterStep === 0) fire('beat_out', dur);

        // Per-track processing
        for (let t = 0; t < NTRACKS; t++) {
          const tn  = t + 1;
          const len = masterLen;
          const mask  = Math.round(p[`t${tn}`]     ?? 0) & 0xFFFF;
          const acc   = Math.round(p[`t${tn}_acc`] ?? 0) & 0xFFFF;
          const prob  = Math.min(1, Math.max(0, p[`t${tn}_prob`] ?? 1));
          const muted = (p[`t${tn}_mute`] ?? 0) > 0.5;
          const vel   = Math.min(1, Math.max(0.01, p[`t${tn}_vel`] ?? 0.8));
          const step  = trackPos[t];
          const bit   = 1 << step;
          const isOn  = (mask & bit) !== 0;
          const isAcc = (acc  & bit) !== 0;
          const isEOC = step === len - 1;

          // End-of-cycle outputs
          if (isEOC) {
            fire(`t${tn}_eoc`, dur);
            if (t === 0) fire('eoc_out', dur); // track 1 = master EOC
          }

          // Velocity CV — non-zero only when step fires
          velNodes[t].offset.value = isOn ? vel * (isAcc ? 1.0 : 0.6) : 0;

          // Gate + accent — gated by mute and probability
          if (!muted && isOn && Math.random() < prob) {
            const freq = isAcc ? 880 : 440;
            fire(`t${tn}_gate`, dur, freq);
            if (isAcc || fillActive) fire(`t${tn}_acc`, dur, freq);
          }

          // Advance track step (wraps at track length)
          trackPos[t] = (step + 1) % len;
        }

        clkStep++;
      };

      const tick = (beatIndex: number) => {
        if ((p.clk_src ?? 0) > 0.5) return; // external clock mode
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
          // External clock: each rising edge advances one step
          ['clk_in',  (_t: number, _f?: number) => {
            if (!running) return;
            const swing = getSwing();
            if (swing > 0.005 && clkStep % 2 === 1) setTimeout(doTick, getMs() * swing);
            else doTick();
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
          // Toggle fill (all accent outputs fire on active steps)
          ['fill_in', () => { fillActive = !fillActive; }],
        ]),
        setPortGateTrigger: (portId, fn) => { gateCbs.set(portId, fn); },
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'bpm') { timer.destroy(); timer = makeClockTimer(getMs, tick); }
        },
        destroy: () => {
          timer.destroy();
          posNode.stop(); stepNode.stop();
          for (const n of velNodes) n.stop();
          swingCv.destroy(); bpmCv.destroy();
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
        const t     = ctx.currentTime;
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
        const t     = ctx.currentTime;
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
        const t = ctx.currentTime;
        const osc = ctx.createOscillator(); osc.type = 'square';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(bodyAmt * 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.7);
        osc.connect(g); g.connect(dest);
        osc.start(t); osc.stop(t + dur + 0.01);
      };

      const fireHHC = () => {
        const t     = ctx.currentTime;
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
        const t     = ctx.currentTime;
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
        const t     = ctx.currentTime;
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
        const t     = ctx.currentTime;
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

      // Per-port trigger handlers — voices fired entirely by external gates
      const portNoteOn = new Map<string, (time: number, freq?: number) => void>([
        ['kick_trig', () => fireKick()],
        ['snr_trig',  () => fireSnare()],
        ['hhc_trig',  () => fireHHC()],
        ['hho_trig',  () => fireHHO()],
        ['clp_trig',  () => fireClap()],
        ['per_trig',  () => firePerc()],
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
          master.disconnect();
          for (const ch of CHANS) volGains[ch].disconnect();
        },
      };
    }

    case 'midi_monitor': {
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
  if (dst.param) src.connect(dst.param);
  else src.connect(dst.node as AudioNode);
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
