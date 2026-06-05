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
const EUC = '#f59e0b';  // Shakmat amber
const DRM = '#dc2626';  // Erica Synths red

const audioIn   = { id: 'audio_in',      name: 'IN',     type: 'audio_in'  } as const;
const audioOut  = { id: 'out',            name: 'OUT',    type: 'audio_out' } as const;
const cutoffCv  = { id: 'cutoff_cv',     name: 'CUT',    type: 'cv_in'     } as const;
const resCv     = { id: 'res_cv',        name: 'RES',    type: 'cv_in'     } as const;
const fmIn      = { id: 'fm_in',         name: 'FM',     type: 'audio_in'  } as const;
const rateCv    = { id: 'rate_cv',       name: 'RATE',   type: 'cv_in'     } as const;
const depthCv   = { id: 'depth_cv',      name: 'DEPTH',  type: 'cv_in'     } as const;
const timeCv    = { id: 'time_cv',       name: 'TIME',   type: 'cv_in'     } as const;
const feedbCv   = { id: 'feedback_cv',   name: 'FB',     type: 'cv_in'     } as const;
const driveCv   = { id: 'drive_cv',      name: 'DRIVE',  type: 'cv_in'     } as const;
const resetIn   = { id: 'reset_in',      name: 'RST',    type: 'gate_in'   } as const;
const clockIn   = { id: 'clock_in',      name: 'CLK',    type: 'gate_in'   } as const;
const retrigIn  = { id: 'retrig_in',     name: 'RETRIG', type: 'gate_in'   } as const;
const eocOut    = { id: 'eoc_out',       name: 'EOC',    type: 'gate_out'  } as const;
const threshCv  = { id: 'threshold_cv',  name: 'THR',    type: 'cv_in'     } as const;
const sizeCv    = { id: 'size_cv',       name: 'SIZE',   type: 'cv_in'     } as const;
const sinOut    = { id: 'sin_out',       name: 'SIN',    type: 'cv_out'    } as const;
const triOut    = { id: 'tri_out',       name: 'TRI',    type: 'cv_out'    } as const;
const sawOut    = { id: 'saw_out',       name: 'SAW',    type: 'cv_out'    } as const;
const sqrOut    = { id: 'sqr_out',       name: 'SQR',    type: 'cv_out'    } as const;
const grOut     = { id: 'gr_out',        name: 'GR',     type: 'cv_out'    } as const;
const speedCv   = { id: 'speed_cv',      name: 'SPEED',  type: 'cv_in'     } as const;
const freqCv    = { id: 'freq_cv',       name: 'FREQ',   type: 'cv_in'     } as const;

export const MODULE_TYPES: ModuleTypeDef[] = [
  // ─── Oscillators ───────────────────────────────────────────────────
  {
    id: 'analog_vco', name: 'Analog VCO', category: 'oscillator', accentColor: OSC, width: 220,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 2000, default: 0, log: true, unit: 'Hz' },
      { id: 'fine', name: 'FINE', min: -100, max: 100, default: 0, unit: 'ct' },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SAW', 'SQR', 'TRI', 'SIN'], default: 0 }],
    ports: [
      { id: 'voct',    name: 'V/OCT', type: 'cv_in'    },
      { id: 'pw_cv',   name: 'PW',    type: 'cv_in'    },
      { id: 'sync_in', name: 'SYNC',  type: 'cv_in'    },
      audioOut,
      { id: 'saw_out', name: 'SAW',   type: 'audio_out' },
      { id: 'sqr_out', name: 'SQR',   type: 'audio_out' },
      { id: 'tri_out', name: 'TRI',   type: 'audio_out' },
      { id: 'sin_out', name: 'SIN',   type: 'audio_out' },
    ],
  },
  {
    id: 'digital_osc', name: 'Digital OSC', category: 'oscillator', accentColor: OSC, width: 200,
    knobs: [
      { id: 'freq',   name: 'FREQ',   min: 20, max: 2000, default: 220, log: true },
      { id: 'octave', name: 'OCTAVE', min: -3, max: 3, default: 0, step: 1 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SQR', 'SAW', 'TRI', 'SIN'], default: 0 }],
    ports: [
      { id: 'voct',    name: 'V/OCT', type: 'cv_in'    },
      { id: 'sync_in', name: 'SYNC',  type: 'cv_in'    },
      audioOut,
      { id: 'sqr_out', name: 'SQR',   type: 'audio_out' },
      { id: 'saw_out', name: 'SAW',   type: 'audio_out' },
    ],
  },
  {
    id: 'wavetable_osc', name: 'Wavetable OSC', category: 'oscillator', accentColor: OSC, width: 200,
    knobs: [
      { id: 'freq',  name: 'FREQ',  min: 20, max: 2000, default: 220, log: true },
      { id: 'pos',   name: 'POS',   min: 0, max: 1, default: 0 },
      { id: 'morph', name: 'MORPH', min: 0, max: 1, default: 0 },
    ],
    ports: [
      { id: 'voct',     name: 'V/OCT', type: 'cv_in' },
      { id: 'morph_in', name: 'MORPH', type: 'cv_in' },
      { id: 'pos_cv',   name: 'POS',   type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'fm_osc', name: 'FM Oscillator', category: 'oscillator', accentColor: OSC, width: 210,
    knobs: [
      { id: 'carrier_freq', name: 'CARRIER', min: 20, max: 2000, default: 220, log: true },
      { id: 'ratio',        name: 'RATIO',   min: 0.1, max: 16, default: 2 },
      { id: 'index',        name: 'INDEX',   min: 0, max: 20, default: 3 },
    ],
    ports: [
      { id: 'voct',     name: 'V/OCT', type: 'cv_in' },
      { id: 'mod_in',   name: 'MOD',   type: 'cv_in' },
      { id: 'index_cv', name: 'INDEX', type: 'cv_in' },
      { id: 'ratio_cv', name: 'RATIO', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'harmonic_osc', name: 'Harmonic OSC', category: 'oscillator', accentColor: OSC, width: 240,
    knobs: [
      { id: 'freq', name: 'FREQ', min: 20, max: 1000, default: 110, log: true },
      { id: 'h1',   name: 'H1',   min: 0, max: 1, default: 1 },
      { id: 'h2',   name: 'H2',   min: 0, max: 1, default: 0.5 },
      { id: 'h3',   name: 'H3',   min: 0, max: 1, default: 0.25 },
      { id: 'h4',   name: 'H4',   min: 0, max: 1, default: 0.1 },
    ],
    ports: [
      { id: 'gate_in', name: 'GATE',  type: 'gate_in' },
      { id: 'voct',    name: 'V/OCT', type: 'cv_in' },
      { id: 'h1_cv',   name: 'H1',    type: 'cv_in' },
      { id: 'h2_cv',   name: 'H2',    type: 'cv_in' },
      { id: 'h3_cv',   name: 'H3',    type: 'cv_in' },
      { id: 'h4_cv',   name: 'H4',    type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'chord_osc', name: 'Chord OSC', category: 'oscillator', accentColor: OSC, width: 200,
    knobs: [
      { id: 'freq',   name: 'ROOT',   min: 20, max: 2000, default: 220, log: true },
      { id: 'spread', name: 'SPREAD', min: 0.5, max: 2, default: 1 },
    ],
    selectors: [{ id: 'chord', name: 'CHORD', options: ['MAJ', 'MIN', 'SUS4', 'DIM', 'AUG', '7TH'], default: 0 }],
    ports: [
      { id: 'gate_in',   name: 'GATE',   type: 'gate_in' },
      { id: 'voct',      name: 'V/OCT',  type: 'cv_in' },
      { id: 'spread_cv', name: 'SPREAD', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'noise', name: 'Noise', category: 'oscillator', accentColor: OSC, width: 170,
    knobs: [{ id: 'level', name: 'LEVEL', min: 0, max: 1, default: 0.8 }],
    selectors: [{ id: 'color', name: 'COLOR', options: ['WHITE', 'PINK'], default: 0 }],
    ports: [
      { id: 'level_cv', name: 'LEVEL', type: 'cv_in' },
      audioOut,
    ],
  },

  // ─── Filters ───────────────────────────────────────────────────────
  {
    id: 'vcf', name: 'LP Filter', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res',    name: 'RES',    min: 0.0001, max: 25, default: 1 },
    ],
    selectors: [{ id: 'type', name: 'TYPE', options: ['LP', 'HP', 'BP', 'NOTCH'], default: 0 }],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },
  {
    id: 'filter_lp6', name: 'LP 6dB', category: 'filter', accentColor: FLT, width: 190,
    knobs: [{ id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' }],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },
  {
    id: 'filter_lp18', name: 'LP 18dB', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res',    name: 'RES',    min: 0.0001, max: 15, default: 1 },
    ],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },
  {
    id: 'filter_lp24', name: 'LP 24dB', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res',    name: 'RES',    min: 0.0001, max: 20, default: 1 },
    ],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },
  {
    id: 'filter_ladder', name: 'Ladder', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res',    name: 'RES',    min: 0, max: 4, default: 0.5 },
    ],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },
  {
    id: 'filter_ota', name: 'OTA Filter', category: 'filter', accentColor: FLT, width: 210,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res',    name: 'RES',    min: 0.0001, max: 20, default: 1 },
      { id: 'drive',  name: 'DRIVE',  min: 1, max: 10, default: 2 },
    ],
    ports: [audioIn, cutoffCv, resCv, fmIn, driveCv, audioOut],
  },
  {
    id: 'filter_svf', name: 'State Variable', category: 'filter', accentColor: FLT, width: 230,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 800, log: true, unit: 'Hz' },
      { id: 'res',    name: 'RES',    min: 0.0001, max: 20, default: 1 },
    ],
    ports: [
      audioIn, cutoffCv, resCv, fmIn,
      { id: 'out_lp',    name: 'LP',    type: 'audio_out' },
      { id: 'out_hp',    name: 'HP',    type: 'audio_out' },
      { id: 'out_bp',    name: 'BP',    type: 'audio_out' },
      { id: 'out_notch', name: 'NOTCH', type: 'audio_out' },
    ],
  },
  {
    id: 'filter_hp', name: 'High-Pass', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 500, log: true, unit: 'Hz' },
      { id: 'res',    name: 'RES',    min: 0.0001, max: 25, default: 1 },
    ],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },
  {
    id: 'filter_bp', name: 'Band-Pass', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'FREQ', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'res',    name: 'Q',    min: 0.0001, max: 30, default: 2 },
    ],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },
  {
    id: 'filter_br', name: 'Band-Reject', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'FREQ', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'res',    name: 'Q',    min: 0.0001, max: 20, default: 1 },
    ],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },
  {
    id: 'filter_notch', name: 'Notch', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'FREQ', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'res',    name: 'Q',    min: 0.0001, max: 30, default: 5 },
    ],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },
  {
    id: 'filter_comb', name: 'Comb Filter', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'freq',     name: 'FREQ',     min: 50, max: 5000, default: 500, log: true, unit: 'Hz' },
      { id: 'feedback', name: 'FEEDBACK', min: 0, max: 0.97, default: 0.5 },
      { id: 'mix',      name: 'MIX',      min: 0, max: 1, default: 0.5 },
    ],
    ports: [audioIn, freqCv, feedbCv, audioOut],
  },
  {
    id: 'filter_formant', name: 'Formant', category: 'filter', accentColor: FLT, width: 200,
    knobs: [{ id: 'mix', name: 'DEPTH', min: 0, max: 1, default: 0.8 }],
    selectors: [{ id: 'vowel', name: 'VOWEL', options: ['A', 'E', 'I', 'O', 'U'], default: 0 }],
    ports: [
      audioIn,
      { id: 'vowel_cv', name: 'VOWEL', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'filter_morph', name: 'Morphing', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'morph',  name: 'MORPH',  min: 0, max: 1, default: 0 },
      { id: 'res',    name: 'RES',    min: 0.0001, max: 20, default: 1 },
      { id: 'cv_amt', name: 'CV AMT', min: 0, max: 20, default: 1 },
    ],
    ports: [
      audioIn, cutoffCv,
      { id: 'morph_cv', name: 'MORPH', type: 'cv_in' },
      resCv, audioOut,
    ],
  },
  {
    id: 'filter_multi', name: 'Multi-Mode', category: 'filter', accentColor: FLT, width: 200,
    knobs: [
      { id: 'cutoff', name: 'CUTOFF', min: 20, max: 20000, default: 1000, log: true, unit: 'Hz' },
      { id: 'res',    name: 'RES',    min: 0.0001, max: 25, default: 1 },
    ],
    selectors: [{ id: 'type', name: 'MODE', options: ['LP', 'HP', 'BP', 'NOTCH'], default: 0 }],
    ports: [audioIn, cutoffCv, resCv, fmIn, audioOut],
  },

  // ─── Amplifiers ────────────────────────────────────────────────────
  {
    id: 'vca', name: 'Linear VCA', category: 'amplifier', accentColor: AMP, width: 180,
    knobs: [{ id: 'gain', name: 'GAIN', min: 0, max: 1, default: 0, cvPortId: 'cv_in' }],
    ports: [
      audioIn,
      { id: 'cv_in',     name: 'CV',     type: 'cv_in' },
      { id: 'offset_cv', name: 'OFFSET', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'vca_expo', name: 'Expo VCA', category: 'amplifier', accentColor: AMP, width: 180,
    knobs: [{ id: 'gain', name: 'GAIN', min: 0, max: 1, default: 0, cvPortId: 'cv_in' }],
    ports: [
      audioIn,
      { id: 'cv_in',     name: 'CV',     type: 'cv_in' },
      { id: 'offset_cv', name: 'OFFSET', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'vca_dual', name: 'Dual VCA', category: 'amplifier', accentColor: AMP, width: 220,
    knobs: [
      { id: 'gain1', name: 'GAIN A', min: 0, max: 1, default: 0.8, cvPortId: 'cv1' },
      { id: 'gain2', name: 'GAIN B', min: 0, max: 1, default: 0.8, cvPortId: 'cv2' },
    ],
    ports: [
      { id: 'in1',  name: 'IN A',  type: 'audio_in'  },
      { id: 'cv1',  name: 'CV A',  type: 'cv_in'     },
      { id: 'out1', name: 'OUT A', type: 'audio_out'  },
      { id: 'in2',  name: 'IN B',  type: 'audio_in'  },
      { id: 'cv2',  name: 'CV B',  type: 'cv_in'     },
      { id: 'out2', name: 'OUT B', type: 'audio_out'  },
    ],
  },

  // ─── Dynamics ──────────────────────────────────────────────────────
  {
    id: 'compressor', name: 'Compressor', category: 'dynamics', accentColor: DYN, width: 220,
    knobs: [
      { id: 'threshold', name: 'THRESH',  min: -60, max: 0,   default: -24, unit: 'dB' },
      { id: 'ratio',     name: 'RATIO',   min: 1,   max: 20,  default: 4 },
      { id: 'attack',    name: 'ATK',     min: 0,   max: 1,   default: 0.003 },
      { id: 'release',   name: 'REL',     min: 0,   max: 1,   default: 0.25 },
    ],
    ports: [
      audioIn,
      { id: 'sc_in', name: 'SC', type: 'audio_in' },
      threshCv,
      audioOut, grOut,
    ],
  },
  {
    id: 'limiter', name: 'Limiter', category: 'dynamics', accentColor: DYN, width: 200,
    knobs: [
      { id: 'threshold', name: 'CEILING', min: -30, max: 0, default: -3,  unit: 'dB' },
      { id: 'release',   name: 'RELEASE', min: 0,   max: 1, default: 0.1 },
    ],
    ports: [audioIn, threshCv, audioOut, grOut],
  },
  {
    id: 'expander', name: 'Expander', category: 'dynamics', accentColor: DYN, width: 200,
    knobs: [
      { id: 'threshold', name: 'THRESH', min: -60, max: 0,  default: -40, unit: 'dB' },
      { id: 'ratio',     name: 'RATIO',  min: 1,   max: 10, default: 2 },
    ],
    ports: [audioIn, threshCv, audioOut],
  },
  {
    id: 'noise_gate', name: 'Noise Gate', category: 'dynamics', accentColor: DYN, width: 210,
    knobs: [
      { id: 'threshold', name: 'THRESH',  min: -80, max: 0,   default: -50, unit: 'dB' },
      { id: 'attack',    name: 'ATTACK',  min: 0,   max: 0.5, default: 0.01 },
      { id: 'release',   name: 'RELEASE', min: 0,   max: 2,   default: 0.1 },
    ],
    ports: [
      audioIn, threshCv, audioOut,
      { id: 'open_out', name: 'OPEN', type: 'gate_out' },
    ],
  },
  {
    id: 'sidechain', name: 'Sidechain', category: 'dynamics', accentColor: DYN, width: 220,
    knobs: [
      { id: 'threshold', name: 'THRESH',  min: -60, max: 0,   default: -20, unit: 'dB' },
      { id: 'ratio',     name: 'RATIO',   min: 1,   max: 20,  default: 8 },
      { id: 'attack',    name: 'ATK',     min: 0,   max: 0.5, default: 0.005 },
      { id: 'release',   name: 'REL',     min: 0,   max: 1,   default: 0.15 },
    ],
    ports: [
      audioIn,
      { id: 'sc_in', name: 'SC', type: 'audio_in' },
      threshCv,
      audioOut, grOut,
    ],
  },

  // ─── Envelopes ─────────────────────────────────────────────────────
  {
    id: 'adsr', name: 'ADSR', category: 'envelope', accentColor: ENV, width: 280,
    knobs: [
      { id: 'attack',  name: 'ATK', min: 0.001, max: 5,  default: 0.01, log: true, unit: 's' },
      { id: 'decay',   name: 'DEC', min: 0.001, max: 5,  default: 0.1,  log: true, unit: 's' },
      { id: 'sustain', name: 'SUS', min: 0,     max: 1,  default: 0.7 },
      { id: 'release', name: 'REL', min: 0.001, max: 10, default: 0.3,  log: true, unit: 's' },
    ],
    ports: [
      { id: 'gate_in',    name: 'GATE',  type: 'gate_in' },
      retrigIn,
      { id: 'attack_cv',  name: 'ATK',   type: 'cv_in'   },
      { id: 'decay_cv',   name: 'DEC',   type: 'cv_in'   },
      { id: 'release_cv', name: 'REL',   type: 'cv_in'   },
      { id: 'env_out',    name: 'ENV',   type: 'cv_out'  },
      eocOut,
    ],
  },
  {
    id: 'ahdsr', name: 'AHDSR', category: 'envelope', accentColor: ENV, width: 300,
    knobs: [
      { id: 'attack',  name: 'ATK', min: 0.001, max: 5,  default: 0.01,  log: true, unit: 's' },
      { id: 'hold',    name: 'HLD', min: 0,     max: 4,  default: 0.05,  unit: 's' },
      { id: 'decay',   name: 'DEC', min: 0.001, max: 5,  default: 0.15,  log: true, unit: 's' },
      { id: 'sustain', name: 'SUS', min: 0,     max: 1,  default: 0.6 },
      { id: 'release', name: 'REL', min: 0.001, max: 10, default: 0.4,   log: true, unit: 's' },
    ],
    ports: [
      { id: 'gate_in', name: 'GATE', type: 'gate_in' },
      retrigIn,
      { id: 'env_out', name: 'ENV',  type: 'cv_out'  },
      eocOut,
    ],
  },

  // ─── LFOs ──────────────────────────────────────────────────────────
  {
    id: 'lfo', name: 'LFO', category: 'lfo', accentColor: LFO_C, width: 220,
    knobs: [
      { id: 'rate',  name: 'RATE',  min: 0.01, max: 30,  default: 1,   log: true, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0,    max: 500, default: 200 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SIN', 'TRI', 'SAW', 'SQR'], default: 0 }],
    ports: [
      rateCv, depthCv,
      { id: 'reset_in', name: 'RST', type: 'gate_in' },
      { id: 'cv_out', name: 'CV', type: 'cv_out' },
      sinOut, triOut, sawOut, sqrOut,
    ],
  },
  {
    id: 'lfo_analog', name: 'Analog LFO', category: 'lfo', accentColor: LFO_C, width: 230,
    knobs: [
      { id: 'rate',  name: 'RATE',  min: 0.01, max: 20,  default: 0.5, log: true, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0,    max: 500, default: 200 },
      { id: 'drift', name: 'DRIFT', min: 0,    max: 1,   default: 0.2 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SIN', 'TRI', 'SAW', 'SQR'], default: 0 }],
    ports: [
      rateCv, depthCv,
      { id: 'cv_out', name: 'CV', type: 'cv_out' },
      sinOut, triOut, sawOut, sqrOut,
    ],
  },
  {
    id: 'lfo_digital', name: 'Digital LFO', category: 'lfo', accentColor: LFO_C, width: 230,
    knobs: [
      { id: 'rate',  name: 'RATE',  min: 0.001, max: 50,  default: 2,   log: true, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0,     max: 500, default: 200 },
      { id: 'phase', name: 'PHASE', min: 0,     max: 1,   default: 0 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SIN', 'SQR', 'SAW', 'TRI', 'S&H'], default: 0 }],
    ports: [
      rateCv, depthCv,
      { id: 'cv_out', name: 'CV', type: 'cv_out' },
      sinOut, triOut, sawOut, sqrOut,
    ],
  },
  {
    id: 'lfo_multi', name: 'Multi LFO', category: 'lfo', accentColor: LFO_C, width: 210,
    knobs: [
      { id: 'rate',  name: 'RATE',  min: 0.01, max: 30,  default: 1,   log: true, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0,    max: 500, default: 200 },
    ],
    ports: [
      rateCv, depthCv,
      { id: 'reset_in', name: 'RST', type: 'gate_in' },
      sinOut, triOut, sawOut, sqrOut,
    ],
  },

  // ─── Sequencers ────────────────────────────────────────────────────
  {
    id: 'seq_step', name: 'Step Seq', category: 'sequencer', accentColor: SEQ, width: 340,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120, step: 1 },
      { id: 's1',  name: 'S1',  min: 0, max: 127, default: 60,  step: 1 },
      { id: 's2',  name: 'S2',  min: 0, max: 127, default: 62,  step: 1 },
      { id: 's3',  name: 'S3',  min: 0, max: 127, default: 64,  step: 1 },
      { id: 's4',  name: 'S4',  min: 0, max: 127, default: 65,  step: 1 },
      { id: 's5',  name: 'S5',  min: 0, max: 127, default: 67,  step: 1 },
      { id: 's6',  name: 'S6',  min: 0, max: 127, default: 69,  step: 1 },
      { id: 's7',  name: 'S7',  min: 0, max: 127, default: 71,  step: 1 },
      { id: 's8',  name: 'S8',  min: 0, max: 127, default: 72,  step: 1 },
    ],
    ports: [
      clockIn, resetIn,
      { id: 'gate_out', name: 'GATE',  type: 'gate_out' },
      { id: 'voct_out', name: 'V/OCT', type: 'cv_out'   },
    ],
  },
  {
    id: 'seq_trigger', name: 'Trigger Seq', category: 'sequencer', accentColor: SEQ, width: 320,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120, step: 1 },
      { id: 't1',  name: 'T1',  min: 0, max: 1, default: 1, step: 1 },
      { id: 't2',  name: 'T2',  min: 0, max: 1, default: 0, step: 1 },
      { id: 't3',  name: 'T3',  min: 0, max: 1, default: 1, step: 1 },
      { id: 't4',  name: 'T4',  min: 0, max: 1, default: 0, step: 1 },
      { id: 't5',  name: 'T5',  min: 0, max: 1, default: 1, step: 1 },
      { id: 't6',  name: 'T6',  min: 0, max: 1, default: 1, step: 1 },
      { id: 't7',  name: 'T7',  min: 0, max: 1, default: 0, step: 1 },
      { id: 't8',  name: 'T8',  min: 0, max: 1, default: 1, step: 1 },
    ],
    ports: [
      clockIn, resetIn,
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
    ],
  },
  {
    id: 'seq_cv', name: 'CV Seq', category: 'sequencer', accentColor: SEQ, width: 320,
    knobs: [
      { id: 'bpm', name: 'BPM', min: 20, max: 300, default: 120, step: 1 },
      { id: 'v1',  name: 'V1',  min: 0, max: 1, default: 0.0  },
      { id: 'v2',  name: 'V2',  min: 0, max: 1, default: 0.25 },
      { id: 'v3',  name: 'V3',  min: 0, max: 1, default: 0.5  },
      { id: 'v4',  name: 'V4',  min: 0, max: 1, default: 0.75 },
      { id: 'v5',  name: 'V5',  min: 0, max: 1, default: 1.0  },
      { id: 'v6',  name: 'V6',  min: 0, max: 1, default: 0.6  },
      { id: 'v7',  name: 'V7',  min: 0, max: 1, default: 0.3  },
      { id: 'v8',  name: 'V8',  min: 0, max: 1, default: 0.1  },
    ],
    ports: [
      clockIn, resetIn,
      { id: 'cv_out', name: 'CV', type: 'cv_out' },
    ],
  },
  {
    id: 'seq_gate', name: 'Gate Seq', category: 'sequencer', accentColor: SEQ, width: 320,
    knobs: [
      { id: 'bpm',      name: 'BPM',    min: 20, max: 300, default: 120, step: 1 },
      { id: 'gate_len', name: 'LENGTH', min: 0.1, max: 0.9, default: 0.5 },
      { id: 'g1',       name: 'G1',     min: 0, max: 1, default: 1, step: 1 },
      { id: 'g2',       name: 'G2',     min: 0, max: 1, default: 1, step: 1 },
      { id: 'g3',       name: 'G3',     min: 0, max: 1, default: 0, step: 1 },
      { id: 'g4',       name: 'G4',     min: 0, max: 1, default: 1, step: 1 },
      { id: 'g5',       name: 'G5',     min: 0, max: 1, default: 0, step: 1 },
      { id: 'g6',       name: 'G6',     min: 0, max: 1, default: 1, step: 1 },
      { id: 'g7',       name: 'G7',     min: 0, max: 1, default: 1, step: 1 },
      { id: 'g8',       name: 'G8',     min: 0, max: 1, default: 0, step: 1 },
    ],
    ports: [
      clockIn, resetIn,
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
    ],
  },

  // ─── Arpeggiator ──────────────────────────────────────────────────
  {
    id: 'arpeggiator', name: 'ARPEGGIATOR', category: 'sequencer', accentColor: SEQ, width: 280,
    knobs: [
      { id: 'bpm',      name: 'BPM',    min: 40,   max: 300,  default: 120, step: 1 },
      { id: 'gate_len', name: 'GATE',   min: 0.05, max: 0.95, default: 0.5 },
      { id: 'octaves',  name: 'OCT',    min: 1,    max: 4,    default: 1, step: 1 },
      { id: 'swing',    name: 'SWING',  min: 0,    max: 0.7,  default: 0 },
      { id: 'chance',   name: 'CHANCE', min: 0,    max: 1,    default: 1 },
    ],
    selectors: [
      { id: 'mode',   name: 'MODE',   options: ['UP','DOWN','U/D','D/U','RAND','PLAY','OUT→IN','IN→OUT','UP×2','R.WLK','DWN×2','SKIP','×3','PEDAL','ZIGZAG','SHUF'], default: 0 },
      { id: 'div',    name: 'DIV',    options: ['1/16','1/8','1/4','1/2','1/1'], default: 1 },
      { id: 'accent', name: 'ACCENT', options: ['OFF','÷2','÷3','÷4','÷6','÷8'], default: 0 },
    ],
    ports: [
      { id: 'voct_in',    name: 'V/OCT', type: 'cv_in'   },
      { id: 'gate_in',    name: 'GATE',  type: 'gate_in' },
      { id: 'voct_out',   name: 'V/OCT',  type: 'cv_out'   },
      { id: 'gate_out',   name: 'GATE',   type: 'gate_out' },
      { id: 'accent_out', name: 'ACCENT', type: 'gate_out' },
    ],
  },

  // ─── Clock ─────────────────────────────────────────────────────────
  {
    id: 'clock_gen', name: 'Clock Gen', category: 'clock', accentColor: CLK, width: 210,
    knobs: [
      { id: 'bpm',   name: 'BPM',   min: 20, max: 300, default: 120, step: 1 },
      { id: 'swing', name: 'SWING', min: 0,  max: 0.5, default: 0   },
    ],
    ports: [
      resetIn,
      { id: 'tempo_cv', name: 'TEMPO', type: 'cv_in'    },
      { id: 'gate_out', name: 'GATE',  type: 'gate_out' },
      { id: 'div2_out', name: '/2',    type: 'gate_out' },
      { id: 'div4_out', name: '/4',    type: 'gate_out' },
      { id: 'div8_out', name: '/8',    type: 'gate_out' },
    ],
  },
  {
    id: 'clock_div', name: 'Divider', category: 'clock', accentColor: CLK, width: 190,
    knobs: [
      { id: 'bpm', name: 'BPM',    min: 20, max: 300, default: 120, step: 1 },
      { id: 'div', name: 'DIVIDE', min: 1,  max: 16,  default: 2, step: 1 },
    ],
    ports: [
      clockIn, resetIn,
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
    ],
  },
  {
    id: 'clock_mul', name: 'Multiplier', category: 'clock', accentColor: CLK, width: 190,
    knobs: [
      { id: 'bpm', name: 'BPM',      min: 20, max: 300, default: 120, step: 1 },
      { id: 'mul', name: 'MULTIPLY', min: 1,  max: 8,   default: 2, step: 1 },
    ],
    ports: [
      clockIn, resetIn,
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
    ],
  },
  {
    id: 'clock_dly', name: 'Clock Delay', category: 'clock', accentColor: CLK, width: 190,
    knobs: [
      { id: 'bpm',   name: 'BPM',   min: 20, max: 300,  default: 120, step: 1 },
      { id: 'delay', name: 'DELAY', min: 0,  max: 0.99, default: 0.25 },
    ],
    ports: [
      clockIn, resetIn,
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
    ],
  },
  {
    id: 'clock_shuffle', name: 'Shuffler', category: 'clock', accentColor: CLK, width: 190,
    knobs: [
      { id: 'bpm',     name: 'BPM',     min: 20, max: 300, default: 120, step: 1 },
      { id: 'shuffle', name: 'SHUFFLE', min: 0,  max: 0.5, default: 0.2 },
    ],
    ports: [
      clockIn, resetIn,
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
    ],
  },
  {
    id: 'swing_gen', name: 'Swing Gen', category: 'clock', accentColor: CLK, width: 190,
    knobs: [
      { id: 'bpm',   name: 'BPM',   min: 20, max: 300,  default: 120, step: 1 },
      { id: 'swing', name: 'SWING', min: 0,  max: 0.67, default: 0.33 },
    ],
    ports: [
      clockIn, resetIn,
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
    ],
  },

  {
    id: 'midi_clock_in', name: 'MIDI Clock In', category: 'clock', accentColor: CLK, width: 210,
    knobs: [], selectors: [], ports: [],
  },

  // ─── Delays ────────────────────────────────────────────────────────
  {
    id: 'delay_mod', name: 'Delay', category: 'delay', accentColor: DLY, width: 200,
    knobs: [
      { id: 'time',     name: 'TIME',     min: 0.01, max: 2,    default: 0.25, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0,    max: 0.97, default: 0.4  },
      { id: 'mix',      name: 'MIX',      min: 0,    max: 1,    default: 0.3  },
    ],
    ports: [audioIn, timeCv, feedbCv, audioOut],
  },
  {
    id: 'delay_analog', name: 'Analog Delay', category: 'delay', accentColor: DLY, width: 210,
    knobs: [
      { id: 'time',     name: 'TIME',     min: 0.01, max: 1,    default: 0.2,  unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0,    max: 0.95, default: 0.5  },
      { id: 'tone',     name: 'TONE',     min: 200,  max: 8000, default: 2000, log: true },
      { id: 'mix',      name: 'MIX',      min: 0,    max: 1,    default: 0.4  },
    ],
    ports: [audioIn, timeCv, feedbCv, audioOut],
  },
  {
    id: 'delay_digital', name: 'Digital Delay', category: 'delay', accentColor: DLY, width: 200,
    knobs: [
      { id: 'time',     name: 'TIME',     min: 0.001, max: 2,    default: 0.25, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0,     max: 0.99, default: 0.4  },
      { id: 'mix',      name: 'MIX',      min: 0,     max: 1,    default: 0.3  },
    ],
    ports: [audioIn, timeCv, feedbCv, audioOut],
  },
  {
    id: 'delay_tape', name: 'Tape Delay', category: 'delay', accentColor: DLY, width: 220,
    knobs: [
      { id: 'time',     name: 'TIME',    min: 0.05, max: 1.5,  default: 0.3,  unit: 's' },
      { id: 'feedback', name: 'FB',      min: 0,    max: 0.95, default: 0.4  },
      { id: 'flutter',  name: 'FLUTTER', min: 0,    max: 1,    default: 0.3 },
      { id: 'mix',      name: 'MIX',     min: 0,    max: 1,    default: 0.4  },
    ],
    ports: [
      audioIn, timeCv, feedbCv,
      { id: 'flutter_cv', name: 'FLTR', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'delay_ping', name: 'Ping-Pong', category: 'delay', accentColor: DLY, width: 200,
    knobs: [
      { id: 'time',     name: 'TIME',     min: 0.01, max: 2,    default: 0.25, unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0,    max: 0.95, default: 0.4  },
      { id: 'mix',      name: 'MIX',      min: 0,    max: 1,    default: 0.35 },
    ],
    ports: [audioIn, timeCv, feedbCv, audioOut],
  },
  {
    id: 'delay_multi', name: 'Multi-Tap', category: 'delay', accentColor: DLY, width: 250,
    knobs: [
      { id: 'tap1',     name: 'TAP1',     min: 0.05, max: 1,   default: 0.125, unit: 's' },
      { id: 'tap2',     name: 'TAP2',     min: 0.05, max: 1,   default: 0.25,  unit: 's' },
      { id: 'tap3',     name: 'TAP3',     min: 0.05, max: 1,   default: 0.5,   unit: 's' },
      { id: 'feedback', name: 'FEEDBACK', min: 0,    max: 0.9, default: 0.3 },
      { id: 'mix',      name: 'MIX',      min: 0,    max: 1,   default: 0.35 },
    ],
    ports: [
      audioIn,
      { id: 'tap1_cv', name: 'T1', type: 'cv_in' },
      { id: 'tap2_cv', name: 'T2', type: 'cv_in' },
      { id: 'tap3_cv', name: 'T3', type: 'cv_in' },
      feedbCv, audioOut,
    ],
  },

  // ─── Reverbs ───────────────────────────────────────────────────────
  {
    id: 'reverb', name: 'Reverb', category: 'reverb', accentColor: RVB, width: 190,
    knobs: [
      { id: 'size', name: 'SIZE', min: 0.1, max: 8, default: 2 },
      { id: 'mix',  name: 'MIX',  min: 0,   max: 1, default: 0.3 },
    ],
    ports: [audioIn, sizeCv, audioOut],
  },
  {
    id: 'reverb_spring', name: 'Spring Reverb', category: 'reverb', accentColor: RVB, width: 210,
    knobs: [
      { id: 'tension', name: 'TENSION', min: 0.1, max: 3, default: 1 },
      { id: 'mix',     name: 'MIX',     min: 0,   max: 1, default: 0.35 },
    ],
    ports: [
      audioIn,
      { id: 'tension_cv', name: 'TENS', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'reverb_plate', name: 'Plate Reverb', category: 'reverb', accentColor: RVB, width: 190,
    knobs: [
      { id: 'size', name: 'SIZE', min: 0.5, max: 6, default: 2.5 },
      { id: 'mix',  name: 'MIX',  min: 0,   max: 1, default: 0.3 },
    ],
    ports: [audioIn, sizeCv, audioOut],
  },
  {
    id: 'reverb_hall', name: 'Hall Reverb', category: 'reverb', accentColor: RVB, width: 190,
    knobs: [
      { id: 'size', name: 'SIZE', min: 1, max: 10, default: 4 },
      { id: 'mix',  name: 'MIX',  min: 0, max: 1,  default: 0.35 },
    ],
    ports: [audioIn, sizeCv, audioOut],
  },
  {
    id: 'reverb_shimmer', name: 'Shimmer Reverb', category: 'reverb', accentColor: RVB, width: 210,
    knobs: [
      { id: 'size',    name: 'SIZE',    min: 1, max: 8, default: 3 },
      { id: 'shimmer', name: 'SHIMMER', min: 0, max: 1, default: 0.5 },
      { id: 'mix',     name: 'MIX',     min: 0, max: 1, default: 0.4 },
    ],
    ports: [
      audioIn, sizeCv,
      { id: 'shimmer_cv', name: 'SHIM', type: 'cv_in' },
      audioOut,
    ],
  },

  // ─── Modulation ────────────────────────────────────────────────────
  {
    id: 'chorus', name: 'Chorus', category: 'modulation', accentColor: MOD, width: 200,
    knobs: [
      { id: 'rate',  name: 'RATE',  min: 0.1, max: 10, default: 1.5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0,   max: 1,  default: 0.5 },
      { id: 'mix',   name: 'MIX',   min: 0,   max: 1,  default: 0.5 },
    ],
    ports: [audioIn, rateCv, depthCv, audioOut],
  },
  {
    id: 'flanger', name: 'Flanger', category: 'modulation', accentColor: MOD, width: 210,
    knobs: [
      { id: 'rate',     name: 'RATE',     min: 0.05, max: 10,   default: 0.5, unit: 'Hz' },
      { id: 'depth',    name: 'DEPTH',    min: 0,    max: 1,    default: 0.7 },
      { id: 'feedback', name: 'FEEDBACK', min: 0,    max: 0.95, default: 0.5 },
      { id: 'mix',      name: 'MIX',      min: 0,    max: 1,    default: 0.5 },
    ],
    ports: [audioIn, rateCv, depthCv, feedbCv, audioOut],
  },
  {
    id: 'phaser', name: 'Phaser', category: 'modulation', accentColor: MOD, width: 200,
    knobs: [
      { id: 'rate',     name: 'RATE',     min: 0.05, max: 5,   default: 0.5, unit: 'Hz' },
      { id: 'depth',    name: 'DEPTH',    min: 0,    max: 1,   default: 0.8 },
      { id: 'feedback', name: 'FEEDBACK', min: 0,    max: 0.9, default: 0.4 },
      { id: 'mix',      name: 'MIX',      min: 0,    max: 1,   default: 0.5 },
    ],
    ports: [audioIn, rateCv, depthCv, audioOut],
  },
  {
    id: 'vibrato', name: 'Vibrato', category: 'modulation', accentColor: MOD, width: 190,
    knobs: [
      { id: 'rate',  name: 'RATE',  min: 0.5, max: 20, default: 5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0,   max: 1,  default: 0.3 },
    ],
    ports: [audioIn, rateCv, depthCv, audioOut],
  },
  {
    id: 'tremolo', name: 'Tremolo', category: 'modulation', accentColor: MOD, width: 190,
    knobs: [
      { id: 'rate',  name: 'RATE',  min: 0.5, max: 30, default: 5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0,   max: 1,  default: 0.6 },
    ],
    selectors: [{ id: 'wave', name: 'WAVE', options: ['SIN', 'SQR', 'TRI'], default: 0 }],
    ports: [audioIn, rateCv, depthCv, audioOut],
  },
  {
    id: 'rotary', name: 'Rotary Speaker', category: 'modulation', accentColor: MOD, width: 210,
    knobs: [
      { id: 'speed', name: 'SPEED', min: 0.5, max: 10, default: 3.5, unit: 'Hz' },
      { id: 'depth', name: 'DEPTH', min: 0,   max: 1,  default: 0.7 },
      { id: 'mix',   name: 'MIX',   min: 0,   max: 1,  default: 0.8 },
    ],
    selectors: [{ id: 'mode', name: 'MODE', options: ['SLOW', 'FAST'], default: 0 }],
    ports: [audioIn, speedCv, audioOut],
  },

  // ─── Distortion ────────────────────────────────────────────────────
  {
    id: 'overdrive', name: 'Overdrive', category: 'distortion', accentColor: DST, width: 200,
    knobs: [
      { id: 'drive', name: 'DRIVE', min: 1,   max: 100,   default: 20 },
      { id: 'tone',  name: 'TONE',  min: 200, max: 10000, default: 3000, log: true },
      { id: 'mix',   name: 'MIX',   min: 0,   max: 1,     default: 1 },
    ],
    ports: [audioIn, driveCv, audioOut],
  },
  {
    id: 'fuzz', name: 'Fuzz', category: 'distortion', accentColor: DST, width: 200,
    knobs: [
      { id: 'fuzz', name: 'FUZZ', min: 1,   max: 200,   default: 80 },
      { id: 'tone', name: 'TONE', min: 200, max: 10000, default: 2000, log: true },
      { id: 'mix',  name: 'MIX',  min: 0,   max: 1,     default: 1 },
    ],
    ports: [
      audioIn,
      { id: 'fuzz_cv', name: 'FUZZ', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'wavefolder', name: 'Wavefolder', category: 'distortion', accentColor: DST, width: 200,
    knobs: [
      { id: 'fold', name: 'FOLD', min: 1, max: 8, default: 3 },
      { id: 'mix',  name: 'MIX',  min: 0, max: 1, default: 1 },
    ],
    ports: [
      audioIn,
      { id: 'fold_cv', name: 'FOLD', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'bitcrusher', name: 'Bit Crusher', category: 'distortion', accentColor: DST, width: 200,
    knobs: [
      { id: 'bits', name: 'BITS', min: 1, max: 16, default: 8, step: 1 },
      { id: 'mix',  name: 'MIX',  min: 0, max: 1,  default: 1 },
    ],
    ports: [
      audioIn,
      { id: 'bits_cv', name: 'BITS', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'samplerate', name: 'SR Reducer', category: 'distortion', accentColor: DST, width: 200,
    knobs: [
      { id: 'factor', name: 'FACTOR', min: 1, max: 32, default: 8, step: 1 },
      { id: 'mix',    name: 'MIX',    min: 0, max: 1,  default: 1 },
    ],
    ports: [
      audioIn,
      { id: 'factor_cv', name: 'FCTR', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'saturator', name: 'Saturator', category: 'distortion', accentColor: DST, width: 200,
    knobs: [
      { id: 'drive', name: 'DRIVE', min: 1, max: 50, default: 5 },
      { id: 'mix',   name: 'MIX',   min: 0, max: 1,  default: 1 },
    ],
    ports: [audioIn, driveCv, audioOut],
  },

  // ─── Spectral ──────────────────────────────────────────────────────
  {
    id: 'ring_mod', name: 'Ring Mod', category: 'spectral', accentColor: SPC, width: 210,
    knobs: [
      { id: 'freq', name: 'CARRIER', min: 20, max: 5000, default: 440, log: true, unit: 'Hz' },
      { id: 'mix',  name: 'MIX',     min: 0,  max: 1,    default: 1 },
    ],
    ports: [
      audioIn,
      { id: 'carrier_in', name: 'CAR', type: 'audio_in' },
      freqCv,
      audioOut,
    ],
  },
  {
    id: 'pitch_shift', name: 'Pitch Shift', category: 'spectral', accentColor: SPC, width: 200,
    knobs: [
      { id: 'semitones', name: 'SEMITONES', min: -24, max: 24, default: 0, step: 1 },
      { id: 'mix',       name: 'MIX',       min: 0,   max: 1,  default: 1 },
    ],
    ports: [
      audioIn,
      { id: 'shift_cv', name: 'SHIFT', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'freq_shift', name: 'Freq Shift', category: 'spectral', accentColor: SPC, width: 200,
    knobs: [
      { id: 'shift', name: 'SHIFT', min: -500, max: 500, default: 50 },
      { id: 'mix',   name: 'MIX',   min: 0,    max: 1,   default: 1 },
    ],
    ports: [
      audioIn,
      { id: 'shift_cv', name: 'SHIFT', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'resonator', name: 'Resonator', category: 'spectral', accentColor: SPC, width: 230,
    knobs: [
      { id: 'freq',      name: 'FREQ',      min: 50, max: 8000, default: 440, log: true, unit: 'Hz' },
      { id: 'q',         name: 'Q',         min: 1,  max: 100,  default: 20 },
      { id: 'harmonics', name: 'HARMONICS', min: 1,  max: 8,    default: 4, step: 1 },
      { id: 'mix',       name: 'MIX',       min: 0,  max: 1,    default: 0.7 },
    ],
    ports: [
      audioIn, freqCv,
      { id: 'q_cv', name: 'Q', type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'vocoder', name: 'Vocoder', category: 'spectral', accentColor: SPC, width: 210,
    knobs: [
      { id: 'bands',   name: 'BANDS',   min: 4,     max: 16,  default: 8, step: 1 },
      { id: 'attack',  name: 'ATTACK',  min: 0.001, max: 0.1, default: 0.01 },
      { id: 'release', name: 'RELEASE', min: 0.01,  max: 0.5, default: 0.1 },
      { id: 'mix',     name: 'MIX',     min: 0,     max: 1,   default: 1 },
    ],
    ports: [
      { id: 'carrier',   name: 'CAR', type: 'audio_in' },
      { id: 'modulator', name: 'MOD', type: 'audio_in' },
      audioOut,
    ],
  },
  {
    id: 'fft_proc', name: 'FFT Proc', category: 'spectral', accentColor: SPC, width: 200,
    knobs: [
      { id: 'tilt',  name: 'TILT',  min: -12, max: 12, default: 0 },
      { id: 'focus', name: 'FOCUS', min: 0,   max: 1,  default: 0.5 },
      { id: 'mix',   name: 'MIX',   min: 0,   max: 1,  default: 1 },
    ],
    ports: [
      audioIn,
      { id: 'tilt_cv', name: 'TILT', type: 'cv_in' },
      audioOut,
    ],
  },

  // ─── Granular ──────────────────────────────────────────────────────
  {
    id: 'granular', name: 'Granular', category: 'granular', accentColor: GRN, width: 260,
    knobs: [
      { id: 'grain_size', name: 'GRAIN',   min: 0.01, max: 0.5, default: 0.1, unit: 's' },
      { id: 'density',    name: 'DENSITY', min: 1,    max: 20,  default: 8 },
      { id: 'pitch',      name: 'PITCH',   min: 0.5,  max: 2,   default: 1 },
      { id: 'spread',     name: 'SPREAD',  min: 0,    max: 1,   default: 0.3 },
    ],
    ports: [
      audioIn,
      { id: 'grain_cv',   name: 'GRAIN', type: 'cv_in' },
      { id: 'density_cv', name: 'DENS',  type: 'cv_in' },
      { id: 'pitch_cv',   name: 'PITCH', type: 'cv_in' },
      { id: 'pos_cv',     name: 'POS',   type: 'cv_in' },
      audioOut,
    ],
  },
  {
    id: 'time_stretch', name: 'Time Stretch', category: 'granular', accentColor: GRN, width: 200,
    knobs: [
      { id: 'speed', name: 'SPEED', min: 0.25, max: 4, default: 1 },
      { id: 'mix',   name: 'MIX',   min: 0,    max: 1, default: 1 },
    ],
    ports: [audioIn, speedCv, audioOut],
  },
  {
    id: 'freeze_proc', name: 'Freeze', category: 'granular', accentColor: GRN, width: 200,
    knobs: [
      { id: 'size', name: 'SIZE', min: 0.05, max: 2, default: 0.5, unit: 's' },
      { id: 'mix',  name: 'MIX',  min: 0,    max: 1, default: 1 },
    ],
    selectors: [{ id: 'freeze', name: 'STATE', options: ['LIVE', 'FREEZE'], default: 0 }],
    ports: [
      audioIn,
      { id: 'freeze_in', name: 'FRZE', type: 'gate_in' },
      { id: 'pos_cv',    name: 'POS',  type: 'cv_in'   },
      audioOut,
    ],
  },
  {
    id: 'sampler', name: 'Sampler', category: 'granular', accentColor: '#d97706', width: 260,
    knobs: [
      { id: 'pitch',  name: 'PITCH', min: -24,  max: 24,  default: 0,   step: 0.01, unit: 'st' },
      { id: 'start',  name: 'START', min: 0,    max: 1,   default: 0                            },
      { id: 'length', name: 'LEN',   min: 0.01, max: 1,   default: 1                            },
      { id: 'bank',   name: 'BANK',  min: 0,    max: 7,   default: 0,   step: 1                 },
      { id: 'attack', name: 'ATK',   min: 0,    max: 2,   default: 0,   step: 0.001, unit: 's' },
    ],
    selectors: [
      { id: 'reverse', name: 'DIR',  options: ['FWD', 'REV'],       default: 0 },
      { id: 'loop',    name: 'LOOP', options: ['ONE-SHOT', 'LOOP'], default: 0 },
    ],
    ports: [
      { id: 'gate_in',   name: 'GATE', type: 'gate_in'   },
      { id: 'sync_in',   name: 'SYNC', type: 'gate_in'   },
      { id: 'pitch_cv',  name: 'PTCH', type: 'cv_in'     },
      { id: 'start_cv',  name: 'STRT', type: 'cv_in'     },
      { id: 'length_cv', name: 'LEN',  type: 'cv_in'     },
      { id: 'bank_cv',   name: 'BNK',  type: 'cv_in'     },
      { id: 'audio_out', name: 'OUT',  type: 'audio_out' },
      { id: 'eoc_out',   name: 'EOC',  type: 'gate_out'  },
    ],
  },

  // ─── Utility / I/O ─────────────────────────────────────────────────
  {
    id: 'mixer', name: 'Mixer', category: 'utility', accentColor: UTL, width: 270,
    knobs: [
      { id: 'ch1', name: 'CH1', min: 0, max: 1, default: 0.8 },
      { id: 'ch2', name: 'CH2', min: 0, max: 1, default: 0.8 },
      { id: 'ch3', name: 'CH3', min: 0, max: 1, default: 0.8 },
      { id: 'ch4', name: 'CH4', min: 0, max: 1, default: 0.8 },
      { id: 'ch5', name: 'CH5', min: 0, max: 1, default: 0.8 },
      { id: 'ch6', name: 'CH6', min: 0, max: 1, default: 0.8 },
    ],
    ports: [
      { id: 'in1', name: 'IN1', type: 'audio_in' },
      { id: 'in2', name: 'IN2', type: 'audio_in' },
      { id: 'in3', name: 'IN3', type: 'audio_in' },
      { id: 'in4', name: 'IN4', type: 'audio_in' },
      { id: 'in5', name: 'IN5', type: 'audio_in' },
      { id: 'in6', name: 'IN6', type: 'audio_in' },
      audioOut,
    ],
  },
  {
    id: 'audio_trig', name: 'AUDIO TRIG', category: 'utility', accentColor: UTL, width: 480,
    knobs: [
      // Per-channel strips: ch{n}_on / ch{n}_gain / ch{n}_thresh / ch{n}_retrig
      // (all chN_* knobs are hidden from the default row and rendered as vertical strips)
      { id: 'ch1_on',     name: 'CH1',    min: 0, max: 1, default: 1,    step: 1     },
      { id: 'ch1_gain',   name: 'GAIN',   min: 0, max: 3, default: 1,    step: 0.01  },
      { id: 'ch1_thresh', name: 'THRESH', min: 0, max: 1, default: 0.12, step: 0.005 },
      { id: 'ch1_retrig', name: 'RETRIG', min: 0.01, max: 2, default: 0.08, step: 0.01 },
      { id: 'ch2_on',     name: 'CH2',    min: 0, max: 1, default: 1,    step: 1     },
      { id: 'ch2_gain',   name: 'GAIN',   min: 0, max: 3, default: 1,    step: 0.01  },
      { id: 'ch2_thresh', name: 'THRESH', min: 0, max: 1, default: 0.12, step: 0.005 },
      { id: 'ch2_retrig', name: 'RETRIG', min: 0.01, max: 2, default: 0.08, step: 0.01 },
      { id: 'ch3_on',     name: 'CH3',    min: 0, max: 1, default: 1,    step: 1     },
      { id: 'ch3_gain',   name: 'GAIN',   min: 0, max: 3, default: 1,    step: 0.01  },
      { id: 'ch3_thresh', name: 'THRESH', min: 0, max: 1, default: 0.12, step: 0.005 },
      { id: 'ch3_retrig', name: 'RETRIG', min: 0.01, max: 2, default: 0.08, step: 0.01 },
      { id: 'ch4_on',     name: 'CH4',    min: 0, max: 1, default: 1,    step: 1     },
      { id: 'ch4_gain',   name: 'GAIN',   min: 0, max: 3, default: 1,    step: 0.01  },
      { id: 'ch4_thresh', name: 'THRESH', min: 0, max: 1, default: 0.12, step: 0.005 },
      { id: 'ch4_retrig', name: 'RETRIG', min: 0.01, max: 2, default: 0.08, step: 0.01 },
      { id: 'ch5_on',     name: 'CH5',    min: 0, max: 1, default: 1,    step: 1     },
      { id: 'ch5_gain',   name: 'GAIN',   min: 0, max: 3, default: 1,    step: 0.01  },
      { id: 'ch5_thresh', name: 'THRESH', min: 0, max: 1, default: 0.12, step: 0.005 },
      { id: 'ch5_retrig', name: 'RETRIG', min: 0.01, max: 2, default: 0.08, step: 0.01 },
      { id: 'ch6_on',     name: 'CH6',    min: 0, max: 1, default: 1,    step: 1     },
      { id: 'ch6_gain',   name: 'GAIN',   min: 0, max: 3, default: 1,    step: 0.01  },
      { id: 'ch6_thresh', name: 'THRESH', min: 0, max: 1, default: 0.12, step: 0.005 },
      { id: 'ch6_retrig', name: 'RETRIG', min: 0.01, max: 2, default: 0.08, step: 0.01 },
      { id: 'ch7_on',     name: 'CH7',    min: 0, max: 1, default: 0,    step: 1     },
      { id: 'ch7_gain',   name: 'GAIN',   min: 0, max: 3, default: 1,    step: 0.01  },
      { id: 'ch7_thresh', name: 'THRESH', min: 0, max: 1, default: 0.12, step: 0.005 },
      { id: 'ch7_retrig', name: 'RETRIG', min: 0.01, max: 2, default: 0.08, step: 0.01 },
      { id: 'ch8_on',     name: 'CH8',    min: 0, max: 1, default: 0,    step: 1     },
      { id: 'ch8_gain',   name: 'GAIN',   min: 0, max: 3, default: 1,    step: 0.01  },
      { id: 'ch8_thresh', name: 'THRESH', min: 0, max: 1, default: 0.12, step: 0.005 },
      { id: 'ch8_retrig', name: 'RETRIG', min: 0.01, max: 2, default: 0.08, step: 0.01 },
    ],
    ports: [
      { id: 'gate1_out', name: 'GATE 1', type: 'gate_out' },
      { id: 'gate2_out', name: 'GATE 2', type: 'gate_out' },
      { id: 'gate3_out', name: 'GATE 3', type: 'gate_out' },
      { id: 'gate4_out', name: 'GATE 4', type: 'gate_out' },
      { id: 'gate5_out', name: 'GATE 5', type: 'gate_out' },
      { id: 'gate6_out', name: 'GATE 6', type: 'gate_out' },
      { id: 'gate7_out', name: 'GATE 7', type: 'gate_out' },
      { id: 'gate8_out', name: 'GATE 8', type: 'gate_out' },
    ],
  },
  {
    id: 'cv_gate_mult', name: 'CV/GT ×6', category: 'utility', accentColor: UTL, width: 160,
    knobs: [],
    ports: [
      { id: 'cv_in',     name: 'CV IN',  type: 'audio_in' },
      { id: 'gate_in',   name: 'GT IN',  type: 'gate_in'  },
      { id: 'cv1_out',   name: 'CV 1',   type: 'audio_out' },
      { id: 'gate1_out', name: 'GT 1',   type: 'gate_out'  },
      { id: 'cv2_out',   name: 'CV 2',   type: 'audio_out' },
      { id: 'gate2_out', name: 'GT 2',   type: 'gate_out'  },
      { id: 'cv3_out',   name: 'CV 3',   type: 'audio_out' },
      { id: 'gate3_out', name: 'GT 3',   type: 'gate_out'  },
      { id: 'cv4_out',   name: 'CV 4',   type: 'audio_out' },
      { id: 'gate4_out', name: 'GT 4',   type: 'gate_out'  },
      { id: 'cv5_out',   name: 'CV 5',   type: 'audio_out' },
      { id: 'gate5_out', name: 'GT 5',   type: 'gate_out'  },
      { id: 'cv6_out',   name: 'CV 6',   type: 'audio_out' },
      { id: 'gate6_out', name: 'GT 6',   type: 'gate_out'  },
    ],
  },
  {
    id: 'keyboard', name: 'KB OUT', category: 'utility', accentColor: UTL, width: 200,
    knobs: [
      { id: 'glide', name: 'GLIDE', min: 0, max: 2, default: 0, step: 0.01 },
    ],
    ports: [
      { id: 'gate_out',  name: 'GATE',  type: 'gate_out' },
      { id: 'voct_out',  name: 'V/OCT', type: 'cv_out'   },
      { id: 'pitch_out', name: 'PITCH', type: 'cv_out'   },
      { id: 'mod_out',   name: 'MOD',   type: 'cv_out'   },
    ],
  },
  {
    id: 'midi_monitor', name: 'MIDI MON', category: 'utility', accentColor: '#22d3ee', width: 200,
    knobs: [], selectors: [], ports: [],
  },
  {
    id: 'output', name: 'Output', category: 'utility', accentColor: UTL, width: 180,
    knobs: [{ id: 'volume', name: 'MASTER', min: 0, max: 1, default: 0.7 }],
    ports: [
      { id: 'in_l',   name: 'IN L', type: 'audio_in' },
      { id: 'in_r',   name: 'IN R', type: 'audio_in' },
      { id: 'vol_cv', name: 'VOL',  type: 'cv_in'    },
    ],
  },

  // ─── Euclidean Trigger Generator (Shakmat Knight's Gallop inspired) ──────────
  {
    id: 'euclidean_trig', name: 'KNIGHT GATE', category: 'clock', accentColor: EUC, width: 320,
    knobs: [
      { id: 'bpm',   name: 'BPM',   min: 20,  max: 300, default: 120, step: 1 },
      { id: 'steps', name: 'STEPS', min: 2,   max: 16,  default: 8,  step: 1 },
      { id: 'fill',  name: 'FILL',  min: 1,   max: 16,  default: 4,  step: 1 },
      { id: 'shift', name: 'SHIFT', min: 0,   max: 15,  default: 0,  step: 1 },
    ],
    selectors: [{ id: 'div', name: 'CLK DIV', options: ['×4','×2','×1','/2','/4'], default: 2 }],
    ports: [
      { id: 'steps_cv', name: 'STPS', type: 'cv_in'   },
      { id: 'fill_cv',  name: 'FILL', type: 'cv_in'   },
      { id: 'shift_cv', name: 'SHFT', type: 'cv_in'   },
      { id: 'sync',     name: 'SYNC', type: 'gate_in' },
      { id: 'gate_out', name: 'GATE', type: 'gate_out' },
      { id: 'inv_out',  name: 'INV',  type: 'gate_out' },
      { id: 'clk_out',  name: 'CLK',  type: 'gate_out' },
    ],
  },

  // ─── Poly Step Drum Sequencer ─────────────────────────────────────────────────
  {
    id: 'poly_step', name: 'POLY STEP', category: 'sequencer', accentColor: '#c084fc', width: 960, height: 600,
    knobs: [
      { id: 'bpm',        name: 'BPM',    min: 20,  max: 300,   default: 120, step: 1 },
      { id: 'swing',      name: 'SWING',  min: 0,   max: 0.5,   default: 0 },
      { id: 'gate_len',   name: 'GATE',   min: 0.05,max: 0.95,  default: 0.4 },
      { id: 'clk_src',    name: 'CLK',    min: 0,   max: 1,     default: 0, step: 1 },
      { id: 'global_len', name: 'LENGTH', min: 0,   max: 3,     default: 3, step: 1 },
      { id: 'transport',  name: 'TRANS',  min: 0,   max: 2,     default: 1, step: 1 },
      // Step masks (per track)
      { id: 't1', name: 'T1', min: 0, max: 65535, default: 4369, step: 1 },
      { id: 't2', name: 'T2', min: 0, max: 65535, default: 4112, step: 1 },
      { id: 't3', name: 'T3', min: 0, max: 65535, default: 21845, step: 1 },
      { id: 't4', name: 'T4', min: 0, max: 65535, default: 136,  step: 1 },
      { id: 't5', name: 'T5', min: 0, max: 65535, default: 0,    step: 1 },
      { id: 't6', name: 'T6', min: 0, max: 65535, default: 0,    step: 1 },
      { id: 't7', name: 'T7', min: 0, max: 65535, default: 0,    step: 1 },
      { id: 't8', name: 'T8', min: 0, max: 65535, default: 0,    step: 1 },
      // Accent masks (per track)
      { id: 't1_acc', name: 'T1 ACC', min: 0, max: 65535, default: 257,  step: 1 },
      { id: 't2_acc', name: 'T2 ACC', min: 0, max: 65535, default: 4112, step: 1 },
      { id: 't3_acc', name: 'T3 ACC', min: 0, max: 65535, default: 0,    step: 1 },
      { id: 't4_acc', name: 'T4 ACC', min: 0, max: 65535, default: 0,    step: 1 },
      { id: 't5_acc', name: 'T5 ACC', min: 0, max: 65535, default: 0,    step: 1 },
      { id: 't6_acc', name: 'T6 ACC', min: 0, max: 65535, default: 0,    step: 1 },
      { id: 't7_acc', name: 'T7 ACC', min: 0, max: 65535, default: 0,    step: 1 },
      { id: 't8_acc', name: 'T8 ACC', min: 0, max: 65535, default: 0,    step: 1 },
      // Mute (per track)
      { id: 't1_mute', name: 'T1 MUTE', min: 0, max: 1, default: 0, step: 1 },
      { id: 't2_mute', name: 'T2 MUTE', min: 0, max: 1, default: 0, step: 1 },
      { id: 't3_mute', name: 'T3 MUTE', min: 0, max: 1, default: 0, step: 1 },
      { id: 't4_mute', name: 'T4 MUTE', min: 0, max: 1, default: 0, step: 1 },
      { id: 't5_mute', name: 'T5 MUTE', min: 0, max: 1, default: 0, step: 1 },
      { id: 't6_mute', name: 'T6 MUTE', min: 0, max: 1, default: 0, step: 1 },
      { id: 't7_mute', name: 'T7 MUTE', min: 0, max: 1, default: 0, step: 1 },
      { id: 't8_mute', name: 'T8 MUTE', min: 0, max: 1, default: 0, step: 1 },
    ],
    ports: [
      // ── Inputs ────────────────────────────────────────────────────
      // Transport / clock
      { id: 'clk_in',   name: 'CLK',   type: 'gate_in' },
      { id: 'rst_in',   name: 'RST',   type: 'gate_in' },
      { id: 'run_in',   name: 'RUN',   type: 'gate_in' },
      // CV modulation
      { id: 'bpm_cv',   name: 'BPM',   type: 'cv_in'   },
      { id: 'swing_cv', name: 'SWING', type: 'cv_in'   },
      // ── Main track gate outputs ───────────────────────────────────
      { id: 't1_gate',  name: 'KICK',  type: 'gate_out' },
      { id: 't2_gate',  name: 'SNR',   type: 'gate_out' },
      { id: 't3_gate',  name: 'HH·C',  type: 'gate_out' },
      { id: 't4_gate',  name: 'HH·O',  type: 'gate_out' },
      { id: 't5_gate',  name: 'CLAP',  type: 'gate_out' },
      { id: 't6_gate',  name: 'PERC',  type: 'gate_out' },
      { id: 't7_gate',  name: 'BASS',  type: 'gate_out' },
      { id: 't8_gate',  name: 'AUX',   type: 'gate_out' },
      // ── Global sync / utility outputs ────────────────────────────
      { id: 'clk_out',  name: 'CLK',   type: 'gate_out' },
      { id: 'beat_out', name: 'BEAT',  type: 'gate_out' },
      { id: 'eoc_out',  name: 'EOC',   type: 'gate_out' },
      { id: 'pos_cv',   name: 'POS',   type: 'cv_out'   },
      { id: 'step_cv',  name: 'STEP',  type: 'cv_out'   },
      // ── Per-track velocity CV outputs ─────────────────────────────
      { id: 't1_vel',   name: 'VEL1',  type: 'cv_out'  },
      { id: 't2_vel',   name: 'VEL2',  type: 'cv_out'  },
      { id: 't3_vel',   name: 'VEL3',  type: 'cv_out'  },
      { id: 't4_vel',   name: 'VEL4',  type: 'cv_out'  },
      { id: 't5_vel',   name: 'VEL5',  type: 'cv_out'  },
      { id: 't6_vel',   name: 'VEL6',  type: 'cv_out'  },
      { id: 't7_vel',   name: 'VEL7',  type: 'cv_out'  },
      { id: 't8_vel',   name: 'VEL8',  type: 'cv_out'  },
    ],
  },

  // ─── Drum Machine (Erica Synths Techno System inspired) ──────────────────────
  {
    id: 'drum_machine', name: 'TECHNO DRUM', category: 'sequencer', accentColor: DRM,
    width: 960,
    knobs: [
      // ── BASS DRUM ──
      { id: 'kick_tune',  name: 'TUNE',  min: 0,    max: 1,     default: 0.5           },
      { id: 'kick_decay', name: 'DECAY', min: 0.05, max: 2.0,   default: 0.5,  log: true },
      { id: 'kick_punch', name: 'PUNCH', min: 0,    max: 1,     default: 0.65          },
      { id: 'kick_drive', name: 'DRIVE', min: 0,    max: 1,     default: 0             },
      { id: 'kick_vol',   name: 'VOL',   min: 0,    max: 1,     default: 0.85          },
      // ── SNARE ──
      { id: 'snr_tune',   name: 'TUNE',  min: 80,   max: 400,   default: 190           },
      { id: 'snr_snap',   name: 'SNAP',  min: 0,    max: 1,     default: 0.7           },
      { id: 'snr_decay',  name: 'DECAY', min: 0.05, max: 0.6,   default: 0.18          },
      { id: 'snr_tone',   name: 'TONE',  min: 300,  max: 3000,  default: 900,  log: true },
      { id: 'snr_vol',    name: 'VOL',   min: 0,    max: 1,     default: 0.70          },
      // ── HH · CLOSED ──
      { id: 'hhc_tone',   name: 'TONE',  min: 3000, max: 14000, default: 7500, log: true },
      { id: 'hhc_decay',  name: 'DECAY', min: 0.01, max: 0.22,  default: 0.04          },
      { id: 'hhc_body',   name: 'BODY',  min: 0,    max: 1,     default: 0.15          },
      { id: 'hhc_vol',    name: 'VOL',   min: 0,    max: 1,     default: 0.55          },
      // ── HH · OPEN ──
      { id: 'hho_tone',   name: 'TONE',  min: 2000, max: 10000, default: 6000, log: true },
      { id: 'hho_decay',  name: 'DECAY', min: 0.05, max: 1.5,   default: 0.35          },
      { id: 'hho_body',   name: 'BODY',  min: 0,    max: 1,     default: 0.15          },
      { id: 'hho_vol',    name: 'VOL',   min: 0,    max: 1,     default: 0.50          },
      // ── CLAP ──
      { id: 'clp_tune',   name: 'TONE',  min: 400,  max: 4000,  default: 1400, log: true },
      { id: 'clp_snap',   name: 'SNAP',  min: 0,    max: 1,     default: 0.8           },
      { id: 'clp_decay',  name: 'DECAY', min: 0.05, max: 0.6,   default: 0.2           },
      { id: 'clp_vol',    name: 'VOL',   min: 0,    max: 1,     default: 0.60          },
      // ── PERC ──
      { id: 'per_tune',   name: 'TUNE',  min: 60,   max: 1200,  default: 300,  log: true },
      { id: 'per_decay',  name: 'DECAY', min: 0.03, max: 0.6,   default: 0.15          },
      { id: 'per_sweep',  name: 'SWEEP', min: 0,    max: 1,     default: 0.5           },
      { id: 'per_vol',    name: 'VOL',   min: 0,    max: 1,     default: 0.55          },
    ],
    selectors: [],
    ports: [
      // Trigger inputs (one per voice)
      { id: 'kick_trig', name: 'K-TRG', type: 'gate_in'  },
      { id: 'snr_trig',  name: 'S-TRG', type: 'gate_in'  },
      { id: 'hhc_trig',  name: 'HC-T',  type: 'gate_in'  },
      { id: 'hho_trig',  name: 'HO-T',  type: 'gate_in'  },
      { id: 'clp_trig',  name: 'CL-T',  type: 'gate_in'  },
      { id: 'per_trig',  name: 'PR-T',  type: 'gate_in'  },
      // Individual voice outputs + mix bus
      { id: 'kick_out',  name: 'K-OUT', type: 'audio_out' },
      { id: 'snr_out',   name: 'S-OUT', type: 'audio_out' },
      { id: 'hhc_out',   name: 'HC-O',  type: 'audio_out' },
      { id: 'hho_out',   name: 'HO-O',  type: 'audio_out' },
      { id: 'clp_out',   name: 'CL-O',  type: 'audio_out' },
      { id: 'per_out',   name: 'PR-O',  type: 'audio_out' },
      { id: 'out',       name: 'MIX',   type: 'audio_out' },
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
  oscillator: 'Oscillators', filter:     'Filters',    amplifier:  'Amplifiers', dynamics:   'Dynamics',
  envelope:   'Envelopes',   lfo:        'LFO',         sequencer:  'Sequencers', clock:      'Clock',
  delay:      'Delay',       reverb:     'Reverb',      modulation: 'Modulation', distortion: 'Distortion',
  spectral:   'Spectral',    granular:   'Granular',    utility:    'Utility / I/O',
};

export const CATEGORY_COLORS: Record<string, string> = {
  oscillator: '#f97316', filter:     '#14b8a6', amplifier:  '#3b82f6', dynamics:   '#0ea5e9',
  envelope:   '#a855f7', lfo:        '#ec4899', sequencer:  '#84cc16', clock:      '#eab308',
  delay:      '#22c55e', reverb:     '#10b981', modulation: '#06b6d4', distortion: '#ef4444',
  spectral:   '#8b5cf6', granular:   '#d97706', utility:    '#94a3b8',
};

export const CABLE_COLORS = [
  '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff922b',
  '#cc5de8', '#ff8787', '#63e6be', '#74c0fc', '#f783ac',
  '#a9e34b', '#ffec99', '#e599f7', '#66d9e8', '#ffa94d',
];

export const MODULE_DESCRIPTIONS: Record<string, string> = {
  // ── Oscillators ────────────────────────────────────────────────────
  analog_vco:    'Sawtooth-core oscillator with 4 simultaneous waveform outputs and V/OCT pitch tracking. SYNC input hard-resets the phase for punchy, distorted attacks.',
  digital_osc:   'Precise digital oscillator with octave shift. Cleaner than analog — great for sharp leads or as a sync slave to another oscillator.',
  wavetable_osc: 'Scans through a table of waveforms. POS sets the start position, MORPH crossfades to adjacent waves — patch both to an LFO for evolving, animated tones.',
  fm_osc:        'Two-operator FM synthesis. RATIO tunes the modulator relative to the carrier; INDEX sets modulation depth — low = subtle harmonics, high = metallic or glassy.',
  harmonic_osc:  'Additive synthesis — mix up to 4 harmonics (H1–H4) of a root frequency. Each harmonic has its own CV input for dynamic timbral morphing.',
  chord_osc:     'Plays a full chord from a single V/OCT input. Choose MAJ / MIN / SUS4 / DIM / AUG / 7TH; SPREAD widens or tightens the voicing.',
  noise:         'Generates random noise for percussion, wind effects, or FM fodder. WHITE has equal energy per Hz; PINK rolls off the highs for a warmer, more natural texture.',

  // ── Filters ────────────────────────────────────────────────────────
  vcf:            'General-purpose VCF with LP / HP / BP / NOTCH modes. FM input allows audio-rate frequency modulation for harsh, metallic tones.',
  filter_lp6:    'Gentle 6 dB/oct low-pass — one pole, no resonance. Warm, subtle filtering like a vintage console EQ.',
  filter_lp18:   '3-pole 18 dB/oct low-pass. Sits between a 12 and 24 dB slope — classic Korg-style character.',
  filter_lp24:   'Steep 4-pole 24 dB/oct low-pass. High resonance self-oscillates into a sine wave — the definitive synth filter sound.',
  filter_ladder: 'Moog-style transistor ladder filter. Feedback path gives a characteristic non-linear warmth as resonance increases.',
  filter_ota:    'OTA-based filter (Roland / Oberheim style) with a DRIVE knob for pre-saturation. Adds grit before the filter stage.',
  filter_svf:    'State variable filter — outputs all 4 modes simultaneously on separate ports. Feed one signal into LP and HP for parallel processing tricks.',
  filter_hp:     'High-pass filter that removes low frequencies. Great for thinning out basses, sidechain processing, or creating telephone / radio effects.',
  filter_bp:     'Band-pass — only frequencies near the cutoff come through. High Q narrows the band into a peaky, vocal-like resonance.',
  filter_br:     'Band-reject filter — cuts a frequency band while passing everything else. The inverse of a band-pass.',
  filter_notch:  'Narrow notch filter for surgically removing a specific frequency, like mains hum or a harsh resonance.',
  filter_comb:   'Delay-based comb filter with feedback. FEEDBACK controls resonance; high values produce metallic ringing and flanging-like effects.',
  filter_formant:'Shapes audio to mimic vowel sounds (A / E / I / O / U). Patch an LFO to VOWEL CV for a talking filter effect.',
  filter_morph:  'Continuously morphs LP → BP → HP → NOTCH as MORPH sweeps 0 → 1. Patch an LFO for automated filter mode transitions.',
  filter_multi:  'Classic multi-mode filter with a switchable LP / HP / BP / NOTCH selector. One filter, all modes — flip between them during a performance.',

  // ── Amplifiers ─────────────────────────────────────────────────────
  vca:       'Linear VCA — gain scales directly with CV. Use for ADSR-shaped envelopes where precise level control matters.',
  vca_expo:  'Exponential VCA — gain responds logarithmically to CV, matching how we perceive volume. More musical and natural-sounding than linear for playing.',
  vca_dual:  'Two independent VCAs in one module. Route two signals through separate CV-controlled channels — useful for stereo or two-voice patches.',

  // ── Dynamics ───────────────────────────────────────────────────────
  compressor: 'Reduces dynamic range when signal exceeds THRESH. RATIO sets how hard it clamps. SC input allows sidechain compression — duck a pad under a kick.',
  limiter:    'Hard ceiling on output level — nothing passes above CEILING. Protects against clipping while preserving transients.',
  expander:   'Attenuates signal when it falls below THRESH — the opposite of compression. Increases dynamic range; useful for gating subtle background noise.',
  noise_gate: 'Completely silences signal below THRESH. Cleans up noise between notes. OPEN output sends a gate signal while the gate is open.',
  sidechain:  'Compressor that ducks one signal based on another (the SC input). Classic pumping EDM effect: kick → SC input, pad → main input.',

  // ── Envelopes ──────────────────────────────────────────────────────
  adsr:  'Standard Attack-Decay-Sustain-Release envelope. Gate input triggers it; ENV output shapes a VCA or filter. EOC fires a pulse at the end of release.',
  ahdsr: 'ADSR plus a HOLD stage — signal stays at peak for the HOLD duration before decaying. Ideal for plucked or struck sounds that need a held transient.',

  // ── LFOs ───────────────────────────────────────────────────────────
  lfo:         'General-purpose LFO with 4 wave shapes and simultaneous individual outputs. RST input syncs to a clock. DEPTH sets the output amplitude in CV units.',
  lfo_analog:  'LFO with a DRIFT knob that adds subtle rate wobble — makes the cycle slightly irregular, like a vintage hardware LFO that never repeats exactly.',
  lfo_digital: 'Widest rate range (0.001–50 Hz) plus a PHASE offset knob. Includes S&H mode for random stepped CV — patch to pitch for random melodies.',
  lfo_multi:   'Outputs all 4 shapes simultaneously on separate ports, all phase-locked. Use when you want to modulate multiple targets at the same LFO rate.',

  // ── Sequencers ─────────────────────────────────────────────────────
  seq_step:    '8-step pitch sequencer. Each knob sets a MIDI note value. Clock advances the steps; V/OCT output drives an oscillator.',
  seq_trigger: 'Trigger pattern sequencer — each step is on or off. Outputs a gate pulse for every active step to trigger drums, envelopes, etc.',
  seq_cv:      '8-step sequencer with freely tunable CV values (not quantized). Use for any modulation target — filter cutoff, LFO rate, reverb mix.',
  seq_gate:    'Gate pattern sequencer — outputs a sustained gate per step. Use to rhythmically open a VCA or trigger an ADSR in a pattern.',
  arpeggiator: 'Plays keyboard notes in arpeggiation patterns. SWING delays odd beats; CHANCE randomly skips steps; ACCENT emphasizes every Nth trigger.',
  poly_step:   '8-track step sequencer — per-track gates, velocity CV, and global clock/beat/EOC/position outputs.',
  drum_machine:'Pattern-based drum machine with multiple independent voice trigger outputs. Program beats per voice and patch each output to its own drum module.',

  // ── Clock ──────────────────────────────────────────────────────────
  clock_gen:     'Master clock oscillator — BPM sets the tempo and outputs gate pulses. The heart of any rhythmic patch. SWING adds groove to the timing.',
  clock_div:     'Divides an incoming clock by integer ratios (÷2, ÷4…) for slower subdivisions. Stack with Clock Gen to get half-time or quarter-time patterns.',
  clock_mul:     'Multiplies an incoming clock for faster subdivisions. Get 16th notes from a quarter-note clock; useful for hi-hat or arp patterns.',
  clock_dly:     'Delays each gate pulse by a fixed amount — for off-beat patterns and syncopation without repatching.',
  clock_shuffle: 'Adds shuffle / swing to an incoming clock. Adjustable amount for anything from subtle groove to hard swing.',
  swing_gen:     'Standalone swing generator. Outputs a modified clock with beat offset for a classic drum machine swing feel.',
  euclidean_trig:'Generates Euclidean rhythmic patterns — mathematically distributes FILL triggers across STEPS evenly. SHIFT rotates the pattern. Inspired by the Shakmat Knight\'s Gallop.',

  // ── Delay ──────────────────────────────────────────────────────────
  delay_mod:     'Stereo delay with modulation on the delay time. TIME sets delay length; FEEDBACK controls repeats; modulation adds gentle chorus-like movement.',
  delay_analog:  'Bucket-brigade analog delay — less precise than digital. Adds warmth and subtle pitch drift to the repeats, like a vintage BBD unit.',
  delay_digital: 'Clean, precise digital delay with pristine repeats. Use for rhythmic echoes where you need exact timing.',
  delay_tape:    'Tape delay emulation — slow SPEED warps and darkens repeats like a real tape machine slowing down. FLUTTER adds wow and flutter.',
  delay_ping:    'Ping-pong stereo delay bouncing between left and right channels. Instantly creates wide, spatial movement from a mono source.',
  delay_multi:   'Up to 4 independent delay taps with individual level controls. Create complex polyrhythmic echo patterns from a single signal.',

  // ── Reverb ─────────────────────────────────────────────────────────
  reverb:          'General algorithmic reverb. SIZE sets room size; DECAY controls tail length; MIX blends wet and dry signal.',
  reverb_spring:   'Spring reverb simulation — the classic boing and twang of a mechanical spring tank. Adds vintage character to guitars, drums, or synths.',
  reverb_plate:    'Plate reverb — dense, lush, with a fast build-up. The classic studio reverb sound heard on vocals and snares.',
  reverb_hall:     'Large hall simulation with a long, spacious tail. Good for pads, strings, and ambient textures where you need a big room.',
  reverb_shimmer:  'Reverb with pitch-shifted feedback — the tail is transposed up an octave and fed back in. Creates ethereal, rising washes of sound.',

  // ── Modulation ─────────────────────────────────────────────────────
  chorus:  'Duplicates the signal with slight pitch and timing variation — thickens and widens mono sources into a rich stereo texture.',
  flanger: 'Short delay with feedback swept by an internal LFO — creates the metallic jet-plane sweep of a classic flanger.',
  phaser:  'All-pass filter network swept by an LFO. Notch-based sweeping effect — smoother and more musical than flanging.',
  vibrato: 'Pure pitch modulation — like patching an LFO to V/OCT but internally. RATE and DEPTH control the speed and depth of the wobble.',
  tremolo: 'Volume modulation at LFO rate. Classic guitar amp tremolo effect — also useful as a rhythmic gating tool.',
  rotary:  'Leslie rotating speaker cabinet simulation. Emulates the Doppler effect of a spinning horn — iconic for organs and pads.',

  // ── Distortion ─────────────────────────────────────────────────────
  overdrive:  'Soft-clip saturation in the style of a tube amp or TS pedal. Adds harmonics and warmth without completely destroying the signal.',
  fuzz:       'Hard-clip fuzz — from mild hair to full square-wave destruction. BIAS shifts the clipping asymmetry for asymmetric harmonics.',
  wavefolder: 'Folds the waveform back on itself when it exceeds a threshold — creates complex harmonic stacking unique to synthesis.',
  bitcrusher: 'Reduces bit depth from 16-bit hiss to 1-bit digital crunch. Extreme lo-fi digital destruction.',
  samplerate: 'Reduces sample rate to introduce aliasing artifacts and digital roughness. Works well layered with Bit Crusher.',
  saturator:  'Gentle tape-style saturation — adds warmth and subtle harmonic compression without obvious distortion. Good as a final bus insert.',

  // ── Spectral ───────────────────────────────────────────────────────
  ring_mod:    'Multiplies two signals — outputs only sum and difference frequencies. No original signal. Creates inharmonic, metallic, bell-like tones.',
  pitch_shift: 'Transposes pitch without changing playback speed. SEMI sets the shift in semitones; use for harmonization or detuning effects.',
  freq_shift:  'Shifts all frequencies by a fixed Hz amount (not a ratio). Creates inharmonic, detuned textures — very different from pitch shifting.',
  resonator:   'Bank of tuned bandpass filters modeling a physical resonant body — like a plate, string, or tube. Pitch-tracks V/OCT input.',
  vocoder:     'Analyzes the spectral envelope of one signal and applies it to another. Classic robot-voice effect — patch speech to carrier and synth to modulator.',
  fft_proc:    'FFT-based spectral processor with frequency-domain freeze, blur, and pitch shifting. Creates smeared, spectral textures.',

  // ── Granular ───────────────────────────────────────────────────────
  granular:     'Slices audio into tiny grains and scatters / overlaps them. POSITION scans the grain buffer; SIZE sets grain length; SPREAD randomizes position for clouds and textures.',
  time_stretch: 'Changes playback speed without pitch shift — or vice versa — using granular grain manipulation.',
  freeze_proc:  'Captures a snapshot of the audio and loops it as a sustained drone. FADE controls how quickly the frozen image builds up.',
  sampler:      'Plays back audio samples from up to 8 banks. PITCH shifts playback in semitones; START trims the play head; LEN sets the region length. GATE triggers playback; SYNC re-triggers without retriggering the envelope. FWD/REV reverses the sample; LOOP sustains until gate-off. Click LOAD to drop a file into the selected bank.',

  // ── Utility ────────────────────────────────────────────────────────
  audio_trig:   'Captures a live audio input (USB mixer, microphone, interface) via the browser and converts transients into gate pulses. GAIN sets input level; THRESH is the RMS level a hit must exceed; RETRIG is the minimum time between triggers. CH selects which channel of a multi-channel device to listen on (1 = left, 2 = right, 3–8 for multi-channel USB interfaces). Click PICK DEVICE to choose a different audio input.',
  mixer:        '4-channel audio mixer with individual gain knobs. Basic signal summing — use to combine multiple oscillators or effects before the output.',
  keyboard:     'Exposes the on-screen keyboard as V/OCT and gate outputs so you can patch it to oscillators and envelopes like any other module.',
  midi_monitor: 'Displays incoming MIDI data — note, velocity, CC, pitch bend, and more. Useful for debugging MIDI patches and monitoring live input.',
  output:       'Final stereo output module with VU meter. All audio paths must end here. Adjust the master level with the GAIN knob.',
};

export function getDefaultParams(typeDef: ModuleTypeDef): Record<string, number> {
  const params: Record<string, number> = {};
  for (const k of typeDef.knobs) params[k.id] = k.default;
  for (const s of typeDef.selectors ?? []) params[s.id] = s.default;
  return params;
}
