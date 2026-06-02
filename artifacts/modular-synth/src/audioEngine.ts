export interface AudioModuleNodes {
  outputs: Map<string, AudioNode>;
  inputs: Map<string, { node: AudioNode; param?: AudioParam }>;
  noteOn?: (time: number, freq: number) => void;
  noteOff?: (time: number) => void;
  setParam: (paramId: string, value: number) => void;
  setSelector?: (selectorId: string, value: number) => void;
  destroy: () => void;
}

function makeImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * duration);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function makeWavetable(ctx: AudioContext, position: number): PeriodicWave {
  const n = 512;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const sine = i === 1 ? 1 : 0;
    const additive = 1 / i;
    imag[i] = sine * (1 - position) + additive * position;
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

const CHORD_INTERVALS: Record<string, number[]> = {
  MAJ: [0, 4, 7, 12], MIN: [0, 3, 7, 12], SUS4: [0, 5, 7, 12],
  DIM: [0, 3, 6, 9], AUG: [0, 4, 8, 12], '7TH': [0, 4, 7, 10],
};
const CHORD_NAMES = ['MAJ', 'MIN', 'SUS4', 'DIM', 'AUG', '7TH'];
const VCO_WAVES: OscillatorType[] = ['sawtooth', 'square', 'triangle', 'sine'];
const LFO_WAVES: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square'];

export function createAudioModule(
  ctx: AudioContext,
  typeId: string,
  initialParams: Record<string, number>
): AudioModuleNodes {
  const p = { ...initialParams };

  switch (typeId) {
    case 'analog_vco': {
      const osc = ctx.createOscillator();
      const out = ctx.createGain();
      out.gain.value = 0.85;
      osc.type = VCO_WAVES[Math.round(p.wave ?? 0)] ?? 'sawtooth';
      osc.frequency.value = p.freq ?? 0;
      osc.detune.value = p.fine ?? 0;
      osc.connect(out);
      osc.start();
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['voct', { node: out, param: osc.frequency }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') osc.frequency.value = val;
          if (id === 'fine') osc.detune.value = val;
        },
        setSelector: (id, val) => {
          if (id === 'wave') osc.type = VCO_WAVES[Math.round(val)] ?? 'sawtooth';
        },
        destroy: () => { osc.stop(); osc.disconnect(); out.disconnect(); },
      };
    }

    case 'digital_osc': {
      const osc = ctx.createOscillator();
      const out = ctx.createGain();
      out.gain.value = 0.85;
      const waveMap: OscillatorType[] = ['square', 'sawtooth', 'triangle', 'sine'];
      osc.type = waveMap[Math.round(p.wave ?? 0)] ?? 'square';
      osc.frequency.value = (p.freq ?? 220) * Math.pow(2, p.octave ?? 0);
      osc.connect(out);
      osc.start();
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['voct', { node: out, param: osc.frequency }]]),
        setParam: (id, val) => {
          p[id] = val;
          osc.frequency.value = (p.freq ?? 220) * Math.pow(2, Math.round(p.octave ?? 0));
        },
        setSelector: (id, val) => {
          if (id === 'wave') osc.type = waveMap[Math.round(val)] ?? 'square';
        },
        destroy: () => { osc.stop(); osc.disconnect(); out.disconnect(); },
      };
    }

    case 'wavetable_osc': {
      const osc = ctx.createOscillator();
      const out = ctx.createGain();
      out.gain.value = 0.85;
      osc.setPeriodicWave(makeWavetable(ctx, p.pos ?? 0));
      osc.frequency.value = p.freq ?? 220;
      osc.connect(out);
      osc.start();
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['voct', { node: out, param: osc.frequency }],
          ['morph_in', { node: out }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') osc.frequency.value = val;
          if (id === 'pos' || id === 'morph') osc.setPeriodicWave(makeWavetable(ctx, val));
        },
        destroy: () => { osc.stop(); osc.disconnect(); out.disconnect(); },
      };
    }

    case 'fm_osc': {
      const carrier = ctx.createOscillator();
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      const out = ctx.createGain();
      out.gain.value = 0.85;
      carrier.type = 'sine';
      modulator.type = 'sine';
      const updateFM = () => {
        const cf = p.carrier_freq ?? 220;
        const r = p.ratio ?? 2;
        const idx = p.index ?? 3;
        carrier.frequency.value = cf;
        modulator.frequency.value = cf * r;
        modGain.gain.value = cf * r * idx;
      };
      updateFM();
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(out);
      modulator.start();
      carrier.start();
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['voct', { node: out, param: carrier.frequency }],
          ['mod_in', { node: modGain }],
        ]),
        setParam: (id, val) => { p[id] = val; updateFM(); },
        destroy: () => {
          carrier.stop(); modulator.stop();
          carrier.disconnect(); modulator.disconnect(); modGain.disconnect(); out.disconnect();
        },
      };
    }

    case 'harmonic_osc': {
      const oscs: OscillatorNode[] = [];
      const gains: GainNode[] = [];
      const out = ctx.createGain();
      out.gain.value = 0.7;
      const hKeys = ['h1', 'h2', 'h3', 'h4'];
      const base = p.freq ?? 110;
      for (let i = 0; i < 4; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = base * (i + 1);
        g.gain.value = p[hKeys[i]] ?? 1 / (i + 1);
        o.connect(g); g.connect(out); o.start();
        oscs.push(o); gains.push(g);
      }
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['voct', { node: out, param: oscs[0].frequency }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'freq') oscs.forEach((o, i) => { o.frequency.value = val * (i + 1); });
          const hi = hKeys.indexOf(id);
          if (hi >= 0) gains[hi].gain.value = val;
        },
        destroy: () => {
          oscs.forEach(o => { o.stop(); o.disconnect(); });
          gains.forEach(g => g.disconnect()); out.disconnect();
        },
      };
    }

    case 'chord_osc': {
      const oscs: OscillatorNode[] = [];
      const out = ctx.createGain();
      out.gain.value = 0.5;
      const getFreqs = () => {
        const root = p.freq ?? 220;
        const sp = p.spread ?? 1;
        const cn = CHORD_NAMES[Math.round(p.chord ?? 0)] ?? 'MAJ';
        const ivs = CHORD_INTERVALS[cn] ?? [0, 4, 7, 12];
        return ivs.map(iv => root * Math.pow(2, iv / 12) * sp);
      };
      for (let i = 0; i < 4; i++) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.connect(out); o.start(); oscs.push(o);
      }
      getFreqs().forEach((f, i) => { oscs[i].frequency.value = f; });
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['voct', { node: out, param: oscs[0].frequency }]]),
        setParam: (id, val) => {
          p[id] = val;
          getFreqs().forEach((f, i) => { oscs[i].frequency.value = f; });
        },
        setSelector: (id, val) => {
          if (id === 'chord') { p.chord = val; getFreqs().forEach((f, i) => { oscs[i].frequency.value = f; }); }
        },
        destroy: () => { oscs.forEach(o => { o.stop(); o.disconnect(); }); out.disconnect(); },
      };
    }

    case 'vcf': {
      const filter = ctx.createBiquadFilter();
      const typeMap: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];
      filter.type = typeMap[Math.round(p.type ?? 0)] ?? 'lowpass';
      filter.frequency.value = p.cutoff ?? 800;
      filter.Q.value = p.res ?? 1;
      return {
        outputs: new Map([['out', filter]]),
        inputs: new Map([
          ['audio_in', { node: filter }],
          ['cutoff_cv', { node: filter, param: filter.frequency }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'cutoff') filter.frequency.value = val;
          if (id === 'res') filter.Q.value = val;
        },
        setSelector: (id, val) => {
          if (id === 'type') filter.type = typeMap[Math.round(val)] ?? 'lowpass';
        },
        destroy: () => { filter.disconnect(); },
      };
    }

    case 'adsr': {
      const envNode = ctx.createConstantSource();
      envNode.offset.value = 0;
      envNode.start();
      return {
        outputs: new Map([['env_out', envNode]]),
        inputs: new Map(),
        setParam: (id, val) => { p[id] = val; },
        noteOn: (_time, _freq) => {
          const now = ctx.currentTime;
          const a = p.attack ?? 0.01;
          const d = p.decay ?? 0.1;
          const s = p.sustain ?? 0.7;
          envNode.offset.cancelScheduledValues(now);
          envNode.offset.setValueAtTime(0, now);
          envNode.offset.linearRampToValueAtTime(1, now + a);
          envNode.offset.linearRampToValueAtTime(s, now + a + d);
        },
        noteOff: (_time) => {
          const now = ctx.currentTime;
          const current = Math.max(0, Math.min(1, envNode.offset.value));
          const r = p.release ?? 0.3;
          envNode.offset.cancelScheduledValues(now);
          envNode.offset.setValueAtTime(current, now);
          envNode.offset.linearRampToValueAtTime(0, now + r);
        },
        destroy: () => { envNode.stop(); envNode.disconnect(); },
      };
    }

    case 'vca': {
      const gain = ctx.createGain();
      gain.gain.value = p.gain ?? 0;
      return {
        outputs: new Map([['out', gain]]),
        inputs: new Map([
          ['audio_in', { node: gain }],
          ['cv_in', { node: gain, param: gain.gain }],
        ]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'gain') gain.gain.value = val;
        },
        destroy: () => { gain.disconnect(); },
      };
    }

    case 'lfo': {
      const osc = ctx.createOscillator();
      const depthGain = ctx.createGain();
      osc.type = LFO_WAVES[Math.round(p.wave ?? 0)] ?? 'sine';
      osc.frequency.value = p.rate ?? 1;
      depthGain.gain.value = p.depth ?? 200;
      osc.connect(depthGain);
      osc.start();
      return {
        outputs: new Map([['cv_out', depthGain]]),
        inputs: new Map(),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'rate') osc.frequency.value = val;
          if (id === 'depth') depthGain.gain.value = val;
        },
        setSelector: (id, val) => {
          if (id === 'wave') osc.type = LFO_WAVES[Math.round(val)] ?? 'sine';
        },
        destroy: () => { osc.stop(); osc.disconnect(); depthGain.disconnect(); },
      };
    }

    case 'reverb': {
      const convolver = ctx.createConvolver();
      const dryGain = ctx.createGain();
      const wetGain = ctx.createGain();
      const out = ctx.createGain();
      const input = ctx.createGain();
      convolver.buffer = makeImpulse(ctx, p.size ?? 2, 2);
      dryGain.gain.value = 1 - (p.mix ?? 0.3);
      wetGain.gain.value = p.mix ?? 0.3;
      input.connect(dryGain); input.connect(convolver);
      convolver.connect(wetGain); dryGain.connect(out); wetGain.connect(out);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'mix') { dryGain.gain.value = 1 - val; wetGain.gain.value = val; }
          if (id === 'size') convolver.buffer = makeImpulse(ctx, val, 2);
        },
        destroy: () => {
          input.disconnect(); convolver.disconnect();
          dryGain.disconnect(); wetGain.disconnect(); out.disconnect();
        },
      };
    }

    case 'delay_mod': {
      const delay = ctx.createDelay(5);
      const fb = ctx.createGain();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const out = ctx.createGain();
      const input = ctx.createGain();
      delay.delayTime.value = p.time ?? 0.25;
      fb.gain.value = p.feedback ?? 0.4;
      dry.gain.value = 1 - (p.mix ?? 0.3);
      wet.gain.value = p.mix ?? 0.3;
      input.connect(dry); input.connect(delay);
      delay.connect(fb); fb.connect(delay); delay.connect(wet);
      dry.connect(out); wet.connect(out);
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([['audio_in', { node: input }]]),
        setParam: (id, val) => {
          p[id] = val;
          if (id === 'time') delay.delayTime.value = val;
          if (id === 'feedback') fb.gain.value = val;
          if (id === 'mix') { dry.gain.value = 1 - val; wet.gain.value = val; }
        },
        destroy: () => {
          input.disconnect(); delay.disconnect(); fb.disconnect();
          dry.disconnect(); wet.disconnect(); out.disconnect();
        },
      };
    }

    case 'mixer': {
      const chs = ['ch1', 'ch2', 'ch3', 'ch4'].map((k, i) => {
        const g = ctx.createGain();
        g.gain.value = p[k] ?? 0.8;
        return g;
      });
      const out = ctx.createGain();
      out.gain.value = 0.8;
      chs.forEach(c => c.connect(out));
      return {
        outputs: new Map([['out', out]]),
        inputs: new Map([
          ['in1', { node: chs[0] }], ['in2', { node: chs[1] }],
          ['in3', { node: chs[2] }], ['in4', { node: chs[3] }],
        ]),
        setParam: (id, val) => {
          const i = ['ch1', 'ch2', 'ch3', 'ch4'].indexOf(id);
          if (i >= 0) chs[i].gain.value = val;
        },
        destroy: () => { chs.forEach(c => c.disconnect()); out.disconnect(); },
      };
    }

    case 'keyboard': {
      const freqNode = ctx.createConstantSource();
      freqNode.offset.value = 0;
      freqNode.start();
      return {
        outputs: new Map([['voct_out', freqNode]]),
        inputs: new Map(),
        setParam: () => {},
        destroy: () => { freqNode.stop(); freqNode.disconnect(); },
      };
    }

    case 'output': {
      const master = ctx.createGain();
      master.gain.value = p.volume ?? 0.7;
      master.connect(ctx.destination);
      return {
        outputs: new Map(),
        inputs: new Map([
          ['in_l', { node: master }],
          ['in_r', { node: master }],
        ]),
        setParam: (id, val) => {
          if (id === 'volume') master.gain.value = val;
        },
        destroy: () => { master.disconnect(); },
      };
    }

    default:
      return { outputs: new Map(), inputs: new Map(), setParam: () => {}, destroy: () => {} };
  }
}

export function connectAudioPorts(
  fromAudio: AudioModuleNodes,
  fromPortId: string,
  toAudio: AudioModuleNodes,
  toPortId: string
): boolean {
  const fromNode = fromAudio.outputs.get(fromPortId);
  const toEntry = toAudio.inputs.get(toPortId);
  if (!fromNode || !toEntry) return false;
  try {
    if (toEntry.param) {
      fromNode.connect(toEntry.param);
    } else {
      fromNode.connect(toEntry.node);
    }
    return true;
  } catch (e) {
    console.warn('Connect failed:', e);
    return false;
  }
}

export function disconnectAudioPorts(
  fromAudio: AudioModuleNodes,
  fromPortId: string,
  toAudio: AudioModuleNodes,
  toPortId: string
): void {
  const fromNode = fromAudio.outputs.get(fromPortId);
  const toEntry = toAudio.inputs.get(toPortId);
  if (!fromNode || !toEntry) return;
  try {
    if (toEntry.param) {
      fromNode.disconnect(toEntry.param);
    } else {
      fromNode.disconnect(toEntry.node);
    }
  } catch (e) {
    console.warn('Disconnect failed:', e);
  }
}
