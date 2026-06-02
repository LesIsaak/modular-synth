import { ModuleTypeDef, ModuleCategory } from './types';

const OSC = '#f97316';
const FLT = '#14b8a6';
const AMP = '#3b82f6';
const DYN = '#0ea5e9';
const ENV = '#a855f7';
const LFO_C = '#ec4899';
const SEQ = '#84cc16';
const CLK = '#eab308';
const DLY = '#22c55e';
const RVB = '#10b981';
const MOD = '#06b6d4';
const DST = '#ef4444';
const SPC = '#8b5cf6';
const GRN = '#d97706';
const UTL = '#94a3b8';

const audioIn = { id: 'audio_in', name: 'IN', type: 'audio_in' } as const;
const audioOut = { id: 'out', name: 'OUT', type: 'audio_out' } as const;
const cutoffCv = { id: 'cutoff_cv', name: 'CUTOFF', type: 'cv_in' } as const;

export const MODULE_TYPES: ModuleTypeDef[] = [
  // ─── Oscillators ───────────────────────────────────────────────────
  {
    id: 'analog_vco', name: 'Analog VCO', category: 'oscillator', accentColor: OSC, width: 160,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 2000, default: 0, log: true, unit: 'Hz' },
      { id: 'fine', name: 'FINE', min: -100, max: 100, default: 0, unit: 'ct' },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SAW', 'SQR', 'TRI', 'SIN'], default: 0 }],
    ports: [{ id: 'voct', name: 'V/OCT', type: 'cv_in' }, audioOut],
  },
  {
    id: 'digital_osc', name: 'Digital OSC', category: 'oscillator', accentColor: OSC, width: 160,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 2000, default: 220, log: true },
      { id: 'octave', name: 'OCTAVE', min: -3, max: 3, default: 0, step: 1 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SQR', 'SAW', 'TRI', 'SIN'], default: 0 }],
    ports: [{ id: 'voct', name: 'V/OCT', type: 'cv_in' }, audioOut],
  },
  {
    id: 'wavetable_osc', name: 'Wavetable OSC', category: 'oscillator', accentColor: OSC, width: 170,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 2000, default: 220, log: true },
      { id: 'pos', name: 'POSITION', min: 0, max: 1, default: 0 },
      { id: 'morph', name: 'MORPH', min: 0, max: 1, default: 0 },
    ],
    ports: [
      { id: 'voct', name: 'V/OCT', type: 'cv_in' },
      { id: 'morph_in', name: 'MORPH', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'fm_osc', name: 'FM Oscillator', category: 'oscillator', accentColor: OSC, width: 170,
    knobs: [
      { id: 'carrier_freq', name: 'CARRIER', min: 20, max: 2000, default: 220, log: true },
      { id: 'ratio', name: 'RATIO', min: 0.1, max: 16, default: 2 },
      { id: 'index', name: 'INDEX', min: 0, max: 20, default: 3 },
    ],
    ports: [
      { id: 'voct', name: 'V/OCT', type: 'cv_in' },
      { id: 'mod_in', name: 'MOD', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'harmonic_osc', name: 'Harmonic OSC', category: 'oscillator', accentColor: OSC, width: 200,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 1000, default: 110, log: true },
      { id: 'h1', name: 'H1', min: 0, max: 1, default: 1 },
      { id: 'h2', name: 'H2', min: 0, max: 1, default: 0.5 },
      { id: 'h3', name: 'H3', min: 0, max: 1, default: 0.25 },
      { id: 'h4', name: 'H4', min: 0, max: 1, default: 0.1 },
    ],
    ports: [{ id: 'voct', name: 'V/OCT', type: 'cv_in' }, audioOut],
  },
  {
    id: 'chord_osc', name: 'Chord OSC', category: 'oscillator', accentColor: OSC, width: 180,
    knobs: [
      { id: 'freq', name: 'ROOT', min: 20, max: 2000, default: 220, log: true },
      { id: 'spread', name: 'SPREAD', min: 0.5, max: 2, default: 1 },
    ],
    selectors: [{ id: 'chord', name: 'CHORD', options: ['MAJ', 'MIN', 'SUS4', 'DIM', 'AUG', '7TH'], default: 0 }],
    ports: [{ id: 'voct', name: 'V/OCT', type: 'cv_in' }, audioOut],
  },
  {
    id: 'noise', name: 'Noise', category: 'oscillator', accentColor: OSC, width: 140,
    knobs: [{ id: 'level', name: 'LEVEL', min: 0, max: 1, default: 0.8 }],
    selectors: [{ id: 'color', name: 'COLOR', options: ['WHITE', 'PINK'], default: 0 }],
    ports: [audioOut],
  },

  // ─── Filters ───────────────────────────────────────────────────────
  {
    id: 'vcf', name: 'LP Filter', category: 'filter', accentColor: FLT, width: 160,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res', name: 'RESONANCE', min: 0.0001, max: 25, default: 1 },
    ],
    selectors: [{ id: 'type', name: 'TYPE', options: ['LP', 'HP', 'BP', 'NOTCH'], default: 0 }],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_lp6', name: 'LP 6dB', category: 'filter', accentColor: FLT, width: 150,
    knobs: [{ id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' }],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_lp18', name: 'LP 18dB', category: 'filter', accentColor: FLT, width: 150,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res', name: 'RESONANCE', min: 0.0001, max: 15, default: 1 },
    ],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_lp24', name: 'LP 24dB', category: 'filter', accentColor: FLT, width: 150,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res', name: 'RESONANCE', min: 0.0001, max: 20, default: 1 },
    ],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_ladder', name: 'Ladder', category: 'filter', accentColor: FLT, width: 160,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res', name: 'RESONANCE', min: 0, max: 4, default: 0.5 },
    ],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_ota', name: 'OTA Filter', category: 'filter', accentColor: FLT, width: 160,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res', name: 'RESONANCE', min: 0.0001, max: 20, default: 1 },
      { id: 'drive', name: 'DRIVE', min: 1, max: 10, default: 2 },
    ],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_svf', name: 'State Variable', category: 'filter', accentColor: FLT, width: 180,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res', name: 'RESONANCE', min: 0.0001, max: 20, default: 1 },
    ],
    ports: [
      audioIn, cutoffCv,
      { id: 'out_lp', name: 'LP', type: 'audio_out' },
      { id: 'out_hp', name: 'HP', type: 'audio_out' },
      { id: 'out_bp', name: 'BP', type: 'audio_out' },
    ],
  },
  {
    id: 'filter_hp', name: 'High-Pass', category: 'filter', accentColor: FLT, width: 150,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 500, log: true, unit: 'Hz' },
      { id: 'res', name: 'RESONANCE', min: 0.0001, max: 25, default: 1 },
    ],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_bp', name: 'Band-Pass', category: 'filter', accentColor: FLT, width: 150,
    knobs: [
      { id: 'cutoff', name: 'FREQ', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'res', name: 'Q', min: 0.0001, max: 30, default: 2 },
    ],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_br', name: 'Band-Reject', category: 'filter', accentColor: FLT, width: 150,
    knobs: [
      { id: 'cutoff', name: 'FREQ', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'res', name: 'Q', min: 0.0001, max: 20, default: 1 },
    ],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_notch', name: 'Notch', category: 'filter', accentColor: FLT, width: 150,
    knobs: [
      { id: 'cutoff', name: 'FREQ', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'res', name: 'Q', min: 0.0001, max: 30, default: 5 },
    ],
    ports: [audioIn, cutoffCv, audioOut],
  },
  {
    id: 'filter_comb', name: 'Comb Filter', category: 'filter', accentColor: FLT, width: 160,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 50, max: 5000, default: 500, log: true, unit: 'Hz' },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.97, default: 0.5 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.5 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'filter_formant', name: 'Formant', category: 'filter', accentColor: FLT, width: 160,
    knobs: [{ id: 'mix', name: 'DEPTH', min: 0, max: 1, default: 0.8 }],
    selectors: [{ id: 'vowel', name: 'VOWEL', options: ['A', 'E', 'I', 'O', 'U'], default: 0 }],
    ports: [audioIn, audioOut],
  },
  {
    id: 'filter_morph', name: 'Morphing', category: 'filter', accentColor: FLT, width: 160,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'morph', name: 'MORPH', min: 0, max: 1, default: 0 },
      { id: 'res', name: 'RESONANCE', min: 0.0001, max: 20, default: 1 },
    ],
    ports: [audioIn, { id: 'morph_cv', name: 'MORPH', type: 'cv_in' }, audioOut],
  },
  {
    id: 'filter_multi', name: 'Multi-Mode', category: 'filter', accentColor: FLT, width: 160,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'res', name: 'RESONANCE', min: 0.0001, max: 25, default: 1 },
    ],
    selectors: [{ id: 'type', name: 'MODE', options: ['LP', 'HP', 'BP', 'NOTCH'], default: 0 }],
    ports: [audioIn, cutoffCv, audioOut],
  },

  // ─── Amplifiers ────────────────────────────────────────────────────
  {
    id: 'vca', name: 'Linear VCA', category: 'amplifier', accentColor: AMP, width: 140,
    knobs: [{ id: 'gain', name: 'GAIN', min: 0, max: 1, default: 0 }],
    ports: [audioIn, { id: 'cv_in', name: 'CV', type: 'cv_in' }, audioOut],
  },
  {
    id: 'vca_expo', name: 'Expo VCA', category: 'amplifier', accentColor: AMP, width: 140,
    knobs: [{ id: 'gain', name: 'GAIN', min: 0, max: 1, default: 0 }],
    ports: [audioIn, { id: 'cv_in', name: 'CV', type: 'cv_in' }, audioOut],
  },
  {
    id: 'vca_dual', name: 'Dual VCA', category: 'amplifier', accentColor: AMP, width: 180,
    knobs: [
      { id: 'gain1', name: 'GAIN A', min: 0, max: 1, default: 0.8 },
      { id: 'gain2', name: 'GAIN B', min: 0, max: 1, default: 0.8 },
    ],
    ports: [
      { id: 'in1', name: 'IN A', type: 'audio_in' },
      { id: 'cv1', name: 'CV A', type: 'cv_in' },
      { id: 'out1', name: 'OUT A', type: 'audio_out' },
      { id: 'in2', name: 'IN B', type: 'audio_in' },
      { id: 'cv2', name: 'CV B', type: 'cv_in' },
      { id: 'out2', name: 'OUT B', type: 'audio_out' },
    ],
  },

  // ─── Dynamics ──────────────────────────────────────────────────────
  {
    id: 'compressor', name: 'Compressor', category: 'dynamics', accentColor: DYN, width: 180,
    knobs: [
      { id: 'threshold', name: 'THRESHOLD', min: -60, max: 0, default: -24, unit: 'dB' },
      { id: 'ratio', name: 'RATIO', min: 1, max: 20, default: 4 },
      { id: 'attack', name: 'ATTACK', min: 0, max: 1, default: 0.003 },
      { id: 'release', name: 'RELEASE', min: 0, max: 1, default: 0.25 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'limiter', name: 'Limiter', category: 'dynamics', accentColor: DYN, width: 160,
    knobs: [
      { id: 'threshold', name: 'CEILING', min: -30, max: 0, default: -3, unit: 'dB' },
      { id: 'release', name: 'RELEASE', min: 0, max: 1, default: 0.1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'expander', name: 'Expander', category: 'dynamics', accentColor: DYN, width: 160,
    knobs: [
      { id: 'threshold', name: 'THRESHOLD', min: -60, max: 0, default: -40, unit: 'dB' },
      { id: 'ratio', name: 'RATIO', min: 1, max: 10, default: 2 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'noise_gate', name: 'Noise Gate', category: 'dynamics', accentColor: DYN, width: 160,
    knobs: [
      { id: 'threshold', name: 'THRESHOLD', min: -80, max: 0, default: -50, unit: 'dB' },
      { id: 'attack', name: 'ATTACK', min: 0, max: 0.5, default: 0.01 },
      { id: 'release', name: 'RELEASE', min: 0, max: 2, default: 0.1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'sidechain', name: 'Sidechain', category: 'dynamics', accentColor: DYN, width: 180,
    knobs: [
      { id: 'threshold', name: 'THRESHOLD', min: -60, max: 0, default: -20, unit: 'dB' },
      { id: 'ratio', name: 'RATIO', min: 1, max: 20, default: 8 },
      { id: 'attack', name: 'ATTACK', min: 0, max: 0.5, default: 0.005 },
      { id: 'release', name: 'RELEASE', min: 0, max: 1, default: 0.15 },
    ],
    ports: [
      audioIn,
      { id: 'sc_in', name: 'SC IN', type: 'audio_in' },
      audioOut,
    ],
  },

  // ─── Envelopes ─────────────────────────────────────────────────────
  {
    id: 'adsr', name: 'ADSR', category: 'envelope', accentColor: ENV, width: 220,
    knobs: [
      { id: 'attack', name: 'ATTACK', min: 0.001, max: 5, default: 0.01, log: true, unit: 's' },
      { id: 'decay', name: 'DECAY', min: 0.001, max: 5, default: 0.1, log: true, unit: 's' },
      { id: 'sustain', name: 'SUSTAIN', min: 0, max: 1, default: 0.7 },
      { id: 'release', name: 'RELEASE', min: 0.001, max: 10, default: 0.3, log: true, unit: 's' },
    ],
    ports: [{ id: 'gate_in', name: 'GATE', type: 'gate_in' }, { id: 'env_out', name: 'ENV', type: 'cv_out' }],
  },
  {
    id: 'ahdsr', name: 'AHDSR', category: 'envelope', accentColor: ENV, width: 240,
    knobs: [
      { id: 'attack', name: 'ATTACK', min: 0.001, max: 5, default: 0.01, log: true, unit: 's' },
      { id: 'hold', name: 'HOLD', min: 0, max: 4, default: 0.05, unit: 's' },
      { id: 'decay', name: 'DECAY', min: 0.001, max: 5, default: 0.15, log: true, unit: 's' },
      { id: 'sustain', name: 'SUSTAIN', min: 0, max: 1, default: 0.6 },
      { id: 'release', name: 'RELEASE', min: 0.001, max: 10, default: 0.4, log: true, unit: 's' },
    ],
    ports: [{ id: 'gate_in', name: 'GATE', type: 'gate_in' }, { id: 'env_out', name: 'ENV', type: 'cv_out' }],
  },

  // ─── LFOs ──────────────────────────────────────────────────────────
  {
    id: 'lfo', name: 'LFO', category: 'lfo', accentColor: LFO_C, width: 160,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.01, max: 30, default: 1, log: true, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 500, default: 200 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SIN', 'TRI', 'SAW', 'SQR'], default: 0 }],
    ports: [{ id: 'cv_out', name: 'CV', type: 'cv_out' }],
  },
  {
    id: 'lfo_analog', name: 'Analog LFO', category: 'lfo', accentColor: LFO_C, width: 170,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.01, max: 20, default: 0.5, log: true, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 500, default: 200 },
      { id: 'drift', name: 'DRIFT', min: 0, max: 1, default: 0.2 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SIN', 'TRI', 'SAW', 'SQR'], default: 0 }],
    ports: [{ id: 'cv_out', name: 'CV', type: 'cv_out' }],
  },
  {
    id: 'lfo_digital', name: 'Digital LFO', category: 'lfo', accentColor: LFO_C, width: 170,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.001, max: 50, default: 2, log: true, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 500, default: 200 },
      { id: 'phase', name: 'PHASE', min: 0, max: 1, default: 0 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SIN', 'SQR', 'SAW', 'TRI', 'S&H'], default: 0 }],
    ports: [{ id: 'cv_out', name: 'CV', type: 'cv_out' }],
  },
  {
    id: 'lfo_multi', name: 'Multi LFO', category: 'lfo', accentColor: LFO_C, width: 170,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.01, max: 30, default: 1, log: true, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 500, default: 200 },
    ],
    ports: [
      { id: 'sin_out', name: 'SIN', type: 'cv_out' },
      { id: 'tri_out', name: 'TRI', type: 'cv_out' },
      { id: 'saw_out', name: 'SAW', type: 'cv_out' },
      { id: 'sqr_out', name: 'SQR', type: 'cv_out' },
    ],
  },

  // ─── Sequencers ────────────────────────────────────────────────────
  {
    id: 'seq_step', name: 'Step Seq', category: 'sequencer', accentColor: SEQ, width: 300,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 's1', name: 'S1', min: 0, max: 127, default: 60, step: 1 },
      { id: 's2', name: 'S2', min: 0, max: 127, default: 62, step: 1 },
      { id: 's3', name: 'S3', min: 0, max: 127, default: 64, step: 1 },
      { id: 's4', name: 'S4', min: 0, max: 127, default: 65, step: 1 },
      { id: 's5', name: 'S5', min: 0, max: 127, default: 67, step: 1 },
      { id: 's6', name: 'S6', min: 0, max: 127, default: 69, step: 1 },
      { id: 's7', name: 'S7', min: 0, max: 127, default: 71, step: 1 },
      { id: 's8', name: 'S8', min: 0, max: 127, default: 72, step: 1 },
    ],
    ports: [
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
      { id: 'voct_out', name: 'V/OCT', type: 'cv_out' },
    ],
  },
  {
    id: 'seq_trigger', name: 'Trigger Seq', category: 'sequencer', accentColor: SEQ, width: 280,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 't1', name: 'T1', min: 0, max: 1, default: 1, step: 1 },
      { id: 't2', name: 'T2', min: 0, max: 1, default: 0, step: 1 },
      { id: 't3', name: 'T3', min: 0, max: 1, default: 1, step: 1 },
      { id: 't4', name: 'T4', min: 0, max: 1, default: 0, step: 1 },
      { id: 't5', name: 'T5', min: 0, max: 1, default: 1, step: 1 },
      { id: 't6', name: 'T6', min: 0, max: 1, default: 1, step: 1 },
      { id: 't7', name: 'T7', min: 0, max: 1, default: 0, step: 1 },
      { id: 't8', name: 'T8', min: 0, max: 1, default: 1, step: 1 },
    ],
    ports: [{ id: 'gate_out', name: 'GATE', type: 'gate_out' }],
  },
  {
    id: 'seq_cv', name: 'CV Seq', category: 'sequencer', accentColor: SEQ, width: 280,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 'v1', name: 'V1', min: 0, max: 1, default: 0.0 },
      { id: 'v2', name: 'V2', min: 0, max: 1, default: 0.25 },
      { id: 'v3', name: 'V3', min: 0, max: 1, default: 0.5 },
      { id: 'v4', name: 'V4', min: 0, max: 1, default: 0.75 },
      { id: 'v5', name: 'V5', min: 0, max: 1, default: 1.0 },
      { id: 'v6', name: 'V6', min: 0, max: 1, default: 0.6 },
      { id: 'v7', name: 'V7', min: 0, max: 1, default: 0.3 },
      { id: 'v8', name: 'V8', min: 0, max: 1, default: 0.1 },
    ],
    ports: [{ id: 'cv_out', name: 'CV', type: 'cv_out' }],
  },
  {
    id: 'seq_gate', name: 'Gate Seq', category: 'sequencer', accentColor: SEQ, width: 280,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 'gate_len', name: 'LENGTH', min: 0.1, max: 0.9, default: 0.5 },
      { id: 'g1', name: 'G1', min: 0, max: 1, default: 1, step: 1 },
      { id: 'g2', name: 'G2', min: 0, max: 1, default: 1, step: 1 },
      { id: 'g3', name: 'G3', min: 0, max: 1, default: 0, step: 1 },
      { id: 'g4', name: 'G4', min: 0, max: 1, default: 1, step: 1 },
      { id: 'g5', name: 'G5', min: 0, max: 1, default: 0, step: 1 },
      { id: 'g6', name: 'G6', min: 0, max: 1, default: 1, step: 1 },
      { id: 'g7', name: 'G7', min: 0, max: 1, default: 1, step: 1 },
      { id: 'g8', name: 'G8', min: 0, max: 1, default: 0, step: 1 },
    ],
    ports: [{ id: 'gate_out', name: 'GATE', type: 'gate_out' }],
  },

  // ─── Clock ─────────────────────────────────────────────────────────
  {
    id: 'clock_gen', name: 'Clock Gen', category: 'clock', accentColor: CLK, width: 150,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 'swing', name: 'SWING', min: 0, max: 0.5, default: 0 },
    ],
    ports: [{ id: 'gate_out', name: 'GATE', type: 'gate_out' }],
  },
  {
    id: 'clock_div', name: 'Divider', category: 'clock', accentColor: CLK, width: 150,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 'div', name: 'DIVIDE', min: 1, max: 16, default: 2, step: 1 },
    ],
    ports: [{ id: 'gate_out', name: 'GATE', type: 'gate_out' }],
  },
  {
    id: 'clock_mul', name: 'Multiplier', category: 'clock', accentColor: CLK, width: 150,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 'mul', name: 'MULTIPLY', min: 1, max: 8, default: 2, step: 1 },
    ],
    ports: [{ id: 'gate_out', name: 'GATE', type: 'gate_out' }],
  },
  {
    id: 'clock_dly', name: 'Clock Delay', category: 'clock', accentColor: CLK, width: 150,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 'delay', name: 'DELAY', min: 0, max: 0.99, default: 0.25 },
    ],
    ports: [{ id: 'gate_out', name: 'GATE', type: 'gate_out' }],
  },
  {
    id: 'clock_shuffle', name: 'Shuffler', category: 'clock', accentColor: CLK, width: 150,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 'shuffle', name: 'SHUFFLE', min: 0, max: 0.5, default: 0.2 },
    ],
    ports: [{ id: 'gate_out', name: 'GATE', type: 'gate_out' }],
  },
  {
    id: 'swing_gen', name: 'Swing Gen', category: 'clock', accentColor: CLK, width: 150,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120 },
      { id: 'swing', name: 'SWING', min: 0, max: 0.67, default: 0.33 },
    ],
    ports: [{ id: 'gate_out', name: 'GATE', type: 'gate_out' }],
  },

  // ─── Delays ────────────────────────────────────────────────────────
  {
    id: 'delay_mod', name: 'Delay', category: 'delay', accentColor: DLY, width: 160,
    knobs: [
      { id: 'time', name: 'TIME', min: 0.01, max: 2, default: 0.25, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.97, default: 0.4 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.3 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'delay_analog', name: 'Analog Delay', category: 'delay', accentColor: DLY, width: 170,
    knobs: [
      { id: 'time', name: 'TIME', min: 0.01, max: 1, default: 0.2, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.95, default: 0.5 },
      { id: 'tone', name: 'TONE', min: 200, max: 8000, default: 2000, log: true },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.4 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'delay_digital', name: 'Digital Delay', category: 'delay', accentColor: DLY, width: 160,
    knobs: [
      { id: 'time', name: 'TIME', min: 0.001, max: 2, default: 0.25, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.99, default: 0.4 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.3 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'delay_tape', name: 'Tape Delay', category: 'delay', accentColor: DLY, width: 180,
    knobs: [
      { id: 'time', name: 'TIME', min: 0.05, max: 1.5, default: 0.3, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.95, default: 0.4 },
      { id: 'flutter', name: 'FLUTTER', min: 0, max: 1, default: 0.3 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.4 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'delay_ping', name: 'Ping-Pong', category: 'delay', accentColor: DLY, width: 160,
    knobs: [
      { id: 'time', name: 'TIME', min: 0.01, max: 2, default: 0.25, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.95, default: 0.4 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.35 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'delay_multi', name: 'Multi-Tap', category: 'delay', accentColor: DLY, width: 200,
    knobs: [
      { id: 'tap1', name: 'TAP1', min: 0.05, max: 1, default: 0.125, unit: 's' },
      { id: 'tap2', name: 'TAP2', min: 0.05, max: 1, default: 0.25, unit: 's' },
      { id: 'tap3', name: 'TAP3', min: 0.05, max: 1, default: 0.5, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.9, default: 0.3 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.35 },
    ],
    ports: [audioIn, audioOut],
  },

  // ─── Reverbs ───────────────────────────────────────────────────────
  {
    id: 'reverb', name: 'Reverb', category: 'reverb', accentColor: RVB, width: 160,
    knobs: [
      { id: 'size', name: 'SIZE', min: 0.1, max: 8, default: 2 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.3 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'reverb_spring', name: 'Spring Reverb', category: 'reverb', accentColor: RVB, width: 170,
    knobs: [
      { id: 'tension', name: 'TENSION', min: 0.1, max: 3, default: 1 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.35 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'reverb_plate', name: 'Plate Reverb', category: 'reverb', accentColor: RVB, width: 160,
    knobs: [
      { id: 'size', name: 'SIZE', min: 0.5, max: 6, default: 2.5 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.3 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'reverb_hall', name: 'Hall Reverb', category: 'reverb', accentColor: RVB, width: 160,
    knobs: [
      { id: 'size', name: 'SIZE', min: 1, max: 10, default: 4 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.35 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'reverb_shimmer', name: 'Shimmer Reverb', category: 'reverb', accentColor: RVB, width: 180,
    knobs: [
      { id: 'size', name: 'SIZE', min: 1, max: 8, default: 3 },
      { id: 'shimmer', name: 'SHIMMER', min: 0, max: 1, default: 0.5 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.4 },
    ],
    ports: [audioIn, audioOut],
  },

  // ─── Modulation ────────────────────────────────────────────────────
  {
    id: 'chorus', name: 'Chorus', category: 'modulation', accentColor: MOD, width: 170,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.1, max: 10, default: 1.5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 1, default: 0.5 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.5 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'flanger', name: 'Flanger', category: 'modulation', accentColor: MOD, width: 170,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.05, max: 10, default: 0.5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 1, default: 0.7 },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.95, default: 0.5 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.5 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'phaser', name: 'Phaser', category: 'modulation', accentColor: MOD, width: 170,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.05, max: 5, default: 0.5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 1, default: 0.8 },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.9, default: 0.4 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.5 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'vibrato', name: 'Vibrato', category: 'modulation', accentColor: MOD, width: 150,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.5, max: 20, default: 5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 1, default: 0.3 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'tremolo', name: 'Tremolo', category: 'modulation', accentColor: MOD, width: 150,
    knobs: [
      { id: 'rate', name: 'RATE', min: 0.5, max: 30, default: 5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 1, default: 0.6 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SIN', 'SQR', 'TRI'], default: 0 }],
    ports: [audioIn, audioOut],
  },
  {
    id: 'rotary', name: 'Rotary Speaker', category: 'modulation', accentColor: MOD, width: 170,
    knobs: [
      { id: 'speed', name: 'SPEED', min: 0.5, max: 10, default: 3.5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0, max: 1, default: 0.7 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.8 },
    ],
    selectors: [{ id: 'mode', name: 'MODE', options: ['SLOW', 'FAST'], default: 0 }],
    ports: [audioIn, audioOut],
  },

  // ─── Distortion ────────────────────────────────────────────────────
  {
    id: 'overdrive', name: 'Overdrive', category: 'distortion', accentColor: DST, width: 160,
    knobs: [
      { id: 'drive', name: 'DRIVE', min: 1, max: 100, default: 20 },
      { id: 'tone', name: 'TONE', min: 200, max: 10000, default: 3000, log: true },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'fuzz', name: 'Fuzz', category: 'distortion', accentColor: DST, width: 160,
    knobs: [
      { id: 'fuzz', name: 'FUZZ', min: 1, max: 200, default: 80 },
      { id: 'tone', name: 'TONE', min: 200, max: 10000, default: 2000, log: true },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'wavefolder', name: 'Wavefolder', category: 'distortion', accentColor: DST, width: 160,
    knobs: [
      { id: 'fold', name: 'FOLD', min: 1, max: 8, default: 3 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'bitcrusher', name: 'Bit Crusher', category: 'distortion', accentColor: DST, width: 160,
    knobs: [
      { id: 'bits', name: 'BITS', min: 1, max: 16, default: 8, step: 1 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'samplerate', name: 'SR Reducer', category: 'distortion', accentColor: DST, width: 160,
    knobs: [
      { id: 'factor', name: 'FACTOR', min: 1, max: 32, default: 8, step: 1 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'saturator', name: 'Saturator', category: 'distortion', accentColor: DST, width: 160,
    knobs: [
      { id: 'drive', name: 'DRIVE', min: 1, max: 50, default: 5 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },

  // ─── Spectral ──────────────────────────────────────────────────────
  {
    id: 'ring_mod', name: 'Ring Mod', category: 'spectral', accentColor: SPC, width: 160,
    knobs: [
      { id: 'freq', name: 'CARRIER', min: 20, max: 5000, default: 440, log: true, unit: 'Hz' },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'pitch_shift', name: 'Pitch Shift', category: 'spectral', accentColor: SPC, width: 160,
    knobs: [
      { id: 'semitones', name: 'SEMITONES', min: -24, max: 24, default: 0, step: 1 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'freq_shift', name: 'Freq Shift', category: 'spectral', accentColor: SPC, width: 160,
    knobs: [
      { id: 'shift', name: 'SHIFT', min: -500, max: 500, default: 50 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'resonator', name: 'Resonator', category: 'spectral', accentColor: SPC, width: 180,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 50, max: 8000, default: 440, log: true, unit: 'Hz' },
      { id: 'q', name: 'Q', min: 1, max: 100, default: 20 },
      { id: 'harmonics', name: 'HARMONICS', min: 1, max: 8, default: 4, step: 1 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 0.7 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'vocoder', name: 'Vocoder', category: 'spectral', accentColor: SPC, width: 180,
    knobs: [
      { id: 'bands', name: 'BANDS', min: 4, max: 16, default: 8, step: 1 },
      { id: 'attack', name: 'ATTACK', min: 0.001, max: 0.1, default: 0.01 },
      { id: 'release', name: 'RELEASE', min: 0.01, max: 0.5, default: 0.1 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [
      { id: 'carrier', name: 'CARRIER', type: 'audio_in' },
      { id: 'modulator', name: 'MOD', type: 'audio_in' },
      audioOut,
    ],
  },
  {
    id: 'fft_proc', name: 'FFT Proc', category: 'spectral', accentColor: SPC, width: 180,
    knobs: [
      { id: 'tilt', name: 'TILT', min: -12, max: 12, default: 0 },
      { id: 'focus', name: 'FOCUS', min: 0, max: 1, default: 0.5 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },

  // ─── Granular ──────────────────────────────────────────────────────
  {
    id: 'granular', name: 'Granular', category: 'granular', accentColor: GRN, width: 200,
    knobs: [
      { id: 'grain_size', name: 'GRAIN', min: 0.01, max: 0.5, default: 0.1, unit: 's' },
      { id: 'density', name: 'DENSITY', min: 1, max: 20, default: 8 },
      { id: 'pitch', name: 'PITCH', min: 0.5, max: 2, default: 1 },
      { id: 'spread', name: 'SPREAD', min: 0, max: 1, default: 0.3 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'time_stretch', name: 'Time Stretch', category: 'granular', accentColor: GRN, width: 170,
    knobs: [
      { id: 'speed', name: 'SPEED', min: 0.25, max: 4, default: 1 },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    ports: [audioIn, audioOut],
  },
  {
    id: 'freeze_proc', name: 'Freeze', category: 'granular', accentColor: GRN, width: 160,
    knobs: [
      { id: 'size', name: 'SIZE', min: 0.05, max: 2, default: 0.5, unit: 's' },
      { id: 'mix', name: 'MIX', min: 0, max: 1, default: 1 },
    ],
    selectors: [{ id: 'freeze', name: 'STATE', options: ['LIVE', 'FREEZE'], default: 0 }],
    ports: [audioIn, audioOut],
  },

  // ─── Utility / I/O ─────────────────────────────────────────────────
  {
    id: 'mixer', name: 'Mixer', category: 'utility', accentColor: UTL, width: 200,
    knobs: [
      { id: 'ch1', name: 'CH1', min: 0, max: 1, default: 0.8 },
      { id: 'ch2', name: 'CH2', min: 0, max: 1, default: 0.8 },
      { id: 'ch3', name: 'CH3', min: 0, max: 1, default: 0.8 },
      { id: 'ch4', name: 'CH4', min: 0, max: 1, default: 0.8 },
    ],
    ports: [
      { id: 'in1', name: 'IN1', type: 'audio_in' }, { id: 'in2', name: 'IN2', type: 'audio_in' },
      { id: 'in3', name: 'IN3', type: 'audio_in' }, { id: 'in4', name: 'IN4', type: 'audio_in' },
      audioOut,
    ],
  },
  {
    id: 'keyboard', name: 'Keyboard', category: 'utility', accentColor: UTL, width: 340,
    knobs: [{ id: 'octave', name: 'OCTAVE', min: 1, max: 7, default: 4, step: 1 }],
    ports: [
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
      { id: 'voct_out', name: 'V/OCT', type: 'cv_out' },
    ],
  },
  {
    id: 'output', name: 'Output', category: 'utility', accentColor: UTL, width: 140,
    knobs: [{ id: 'volume', name: 'MASTER', min: 0, max: 1, default: 0.7 }],
    ports: [
      { id: 'in_l', name: 'IN L', type: 'audio_in' },
      { id: 'in_r', name: 'IN R', type: 'audio_in' },
    ],
  },
];

export const MODULE_TYPE_MAP = new Map(MODULE_TYPES.map(m => [m.id, m]));

export const CATEGORY_ORDER: ModuleCategory[] = [
  'oscillator', 'filter', 'amplifier', 'dynamics',
  'envelope', 'lfo', 'sequencer', 'clock',
  'delay', 'reverb', 'modulation', 'distortion',
  'spectral', 'granular', 'utility',
];

export const CATEGORY_LABELS: Record<string, string> = {
  oscillator: 'Oscillators', filter: 'Filters', amplifier: 'Amplifiers', dynamics: 'Dynamics',
  envelope: 'Envelopes', lfo: 'LFO', sequencer: 'Sequencers', clock: 'Clock',
  delay: 'Delay', reverb: 'Reverb', modulation: 'Modulation', distortion: 'Distortion',
  spectral: 'Spectral', granular: 'Granular', utility: 'Utility / I/O',
};

export const CATEGORY_COLORS: Record<string, string> = {
  oscillator: '#f97316', filter: '#14b8a6', amplifier: '#3b82f6', dynamics: '#0ea5e9',
  envelope: '#a855f7', lfo: '#ec4899', sequencer: '#84cc16', clock: '#eab308',
  delay: '#22c55e', reverb: '#10b981', modulation: '#06b6d4', distortion: '#ef4444',
  spectral: '#8b5cf6', granular: '#d97706', utility: '#94a3b8',
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
