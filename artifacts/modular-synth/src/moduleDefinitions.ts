import { ModuleTypeDef, ModuleCategory } from './types';

export const MODULE_TYPES: ModuleTypeDef[] = [
  {
    id: 'analog_vco',
    name: 'Analog VCO',
    category: 'oscillator',
    accentColor: '#f97316',
    width: 160,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 2000, default: 0, log: true, unit: 'Hz' },
      { id: 'fine', name: 'FINE', min: -100, max: 100, default: 0, unit: 'ct' },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SAW', 'SQR', 'TRI', 'SIN'], default: 0 }],
    ports: [
      { id: 'voct', name: 'V/OCT', type: 'cv_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'digital_osc',
    name: 'Digital OSC',
    category: 'oscillator',
    accentColor: '#f97316',
    width: 160,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 2000, default: 220, log: true },
      { id: 'octave', name: 'OCTAVE', min: -3, max: 3, default: 0, step: 1 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SQR', 'SAW', 'TRI', 'SIN'], default: 0 }],
    ports: [
      { id: 'voct', name: 'V/OCT', type: 'cv_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'wavetable_osc',
    name: 'Wavetable OSC',
    category: 'oscillator',
    accentColor: '#f97316',
    width: 170,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 2000, default: 220, log: true },
      { id: 'pos', name: 'POSITION', min: 0, max: 1, default: 0 },
      { id: 'morph', name: 'MORPH', min: 0, max: 1, default: 0 },
    ],
    ports: [
      { id: 'voct', name: 'V/OCT', type: 'cv_in' },
      { id: 'morph_in', name: 'MORPH', type: 'cv_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'fm_osc',
    name: 'FM Oscillator',
    category: 'oscillator',
    accentColor: '#f97316',
    width: 170,
    knobs: [
      { id: 'carrier_freq', name: 'CARRIER', min: 20, max: 2000, default: 220, log: true },
      { id: 'ratio', name: 'RATIO', min: 0.1, max: 16, default: 2 },
      { id: 'index', name: 'INDEX', min: 0, max: 20, default: 3 },
    ],
    ports: [
      { id: 'voct', name: 'V/OCT', type: 'cv_in' },
      { id: 'mod_in', name: 'MOD', type: 'cv_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'harmonic_osc',
    name: 'Harmonic OSC',
    category: 'oscillator',
    accentColor: '#f97316',
    width: 200,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 1000, default: 110, log: true },
      { id: 'h1', name: 'H1', min: 0, max: 1, default: 1 },
      { id: 'h2', name: 'H2', min: 0, max: 1, default: 0.5 },
      { id: 'h3', name: 'H3', min: 0, max: 1, default: 0.25 },
      { id: 'h4', name: 'H4', min: 0, max: 1, default: 0.1 },
    ],
    ports: [
      { id: 'voct', name: 'V/OCT', type: 'cv_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'chord_osc',
    name: 'Chord OSC',
    category: 'oscillator',
    accentColor: '#f97316',
    width: 180,
    knobs: [
      { id: 'freq', name: 'ROOT', min: 20, max: 2000, default: 220, log: true },
      { id: 'spread', name: 'SPREAD', min: 0.5, max: 2, default: 1 },
    ],
    selectors: [{ id: 'chord', name: 'CHORD', options: ['MAJ', 'MIN', 'SUS4', 'DIM', 'AUG', '7TH'], default: 0 }],
    ports: [
      { id: 'voct', name: 'V/OCT', type: 'cv_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'vcf',
    name: 'VCF',
    category: 'filter',
    accentColor: '#14b8a6',
    width: 160,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res', name: 'RESONANCE', min: 0.0001, max: 25, default: 1 },
    ],
    selectors: [{ id: 'type', name: 'TYPE', options: ['LP', 'HP', 'BP', 'NOTCH'], default: 0 }],
    ports: [
      { id: 'audio_in', name: 'IN', type: 'audio_in' },
      { id: 'cutoff_cv', name: 'CUTOFF', type: 'cv_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'adsr',
    name: 'ADSR',
    category: 'envelope',
    accentColor: '#a855f7',
    width: 220,
    knobs: [
      { id: 'attack', name: 'ATTACK', min: 0.001, max: 5, default: 0.01, log: true, unit: 's' },
      { id: 'decay', name: 'DECAY', min: 0.001, max: 5, default: 0.1, log: true, unit: 's' },
      { id: 'sustain', name: 'SUSTAIN', min: 0, max: 1, default: 0.7 },
      { id: 'release', name: 'RELEASE', min: 0.001, max: 10, default: 0.3, log: true, unit: 's' },
    ],
    ports: [
      { id: 'gate_in', name: 'GATE', type: 'gate_in' },
      { id: 'env_out', name: 'ENV', type: 'cv_out' },
    ],
  },
  {
    id: 'vca',
    name: 'VCA',
    category: 'amplifier',
    accentColor: '#3b82f6',
    width: 140,
    knobs: [
      { id: 'gain', name: 'GAIN', min: 0, max: 1, default: 0 },
    ],
    ports: [
      { id: 'audio_in', name: 'IN', type: 'audio_in' },
      { id: 'cv_in', name: 'CV', type: 'cv_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'lfo',
    name: 'LFO',
    category: 'lfo',
    accentColor: '#ec4899',
    width: 160,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.01, max: 30, default: 1, log: true, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 500, default: 200 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SIN', 'TRI', 'SAW', 'SQR'], default: 0 }],
    ports: [
      { id: 'cv_out', name: 'CV', type: 'cv_out' },
    ],
  },
  {
    id: 'reverb',
    name: 'Reverb',
    category: 'effect',
    accentColor: '#22c55e',
    width: 160,
    knobs: [
      { id: 'size', name: 'SIZE', min: 0.1, max: 8, default: 2 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.3 },
    ],
    ports: [
      { id: 'audio_in', name: 'IN', type: 'audio_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'delay_mod',
    name: 'Delay',
    category: 'effect',
    accentColor: '#22c55e',
    width: 160,
    knobs: [
      { id: 'time', name: 'TIME', min: 0.01, max: 2, default: 0.25, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.97, default: 0.4 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.3 },
    ],
    ports: [
      { id: 'audio_in', name: 'IN', type: 'audio_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'mixer',
    name: 'Mixer',
    category: 'utility',
    accentColor: '#94a3b8',
    width: 200,
    knobs: [
      { id: 'ch1', name: 'CH1', min: 0, max: 1, default: 0.8 },
      { id: 'ch2', name: 'CH2', min: 0, max: 1, default: 0.8 },
      { id: 'ch3', name: 'CH3', min: 0, max: 1, default: 0.8 },
      { id: 'ch4', name: 'CH4', min: 0, max: 1, default: 0.8 },
    ],
    ports: [
      { id: 'in1', name: 'IN1', type: 'audio_in' },
      { id: 'in2', name: 'IN2', type: 'audio_in' },
      { id: 'in3', name: 'IN3', type: 'audio_in' },
      { id: 'in4', name: 'IN4', type: 'audio_in' },
      { id: 'out', name: 'OUT', type: 'audio_out' },
    ],
  },
  {
    id: 'keyboard',
    name: 'Keyboard',
    category: 'utility',
    accentColor: '#94a3b8',
    width: 340,
    knobs: [
      { id: 'octave', name: 'OCTAVE', min: 1, max: 7, default: 4, step: 1 },
    ],
    ports: [
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
      { id: 'voct_out', name: 'V/OCT', type: 'cv_out' },
    ],
  },
  {
    id: 'output',
    name: 'Output',
    category: 'utility',
    accentColor: '#94a3b8',
    width: 140,
    knobs: [
      { id: 'volume', name: 'MASTER', min: 0, max: 1, default: 0.7 },
    ],
    ports: [
      { id: 'in_l', name: 'IN L', type: 'audio_in' },
      { id: 'in_r', name: 'IN R', type: 'audio_in' },
    ],
  },
];

export const MODULE_TYPE_MAP = new Map(MODULE_TYPES.map(m => [m.id, m]));

export const CATEGORY_ORDER: ModuleCategory[] = [
  'oscillator', 'filter', 'amplifier', 'envelope', 'lfo', 'effect', 'utility',
];

export const CATEGORY_LABELS: Record<string, string> = {
  oscillator: 'Oscillators',
  filter: 'Filters',
  amplifier: 'Amplifiers',
  envelope: 'Envelopes',
  lfo: 'LFO',
  effect: 'Effects',
  utility: 'Utility / I/O',
};

export const CABLE_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b',
  '#cc5de8', '#ff8787', '#63e6be', '#74c0fc', '#f783ac',
  '#a9e34b', '#ffec99', '#e599f7', '#66d9e8', '#ffa94d',
];

export function getDefaultParams(typeDef: ModuleTypeDef): Record<string, number> {
  const params: Record<string, number> = {};
  for (const k of typeDef.knobs) params[k.id] = k.default;
  for (const s of typeDef.selectors ?? []) params[s.id] = s.default;
  return params;
}
