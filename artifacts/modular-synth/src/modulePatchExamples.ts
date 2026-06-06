export type PatchSignalType = 'audio' | 'cv' | 'gate';

export interface PatchConnection {
  from: string;
  out: string;
  to: string;
  in: string;
  sig: PatchSignalType;
}

export interface PatchExample {
  title: string;
  modules: string[];
  connections: PatchConnection[];
  tip?: string;
}

export const MODULE_PATCH_EXAMPLES: Record<string, PatchExample> = {

  // ─── Oscillators ────────────────────────────────────────────────────────────
  analog_vco: {
    title: 'Basic subtractive voice',
    modules: ['Keyboard', 'Analog VCO', 'VCF', 'ADSR', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard', out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard', out: 'GATE',  to: 'ADSR',       in: 'GATE',  sig: 'gate'  },
      { from: 'Analog VCO', out: 'OUT', to: 'VCF',        in: 'IN',    sig: 'audio' },
      { from: 'ADSR',    out: 'ENV',    to: 'VCF',        in: 'CUT',   sig: 'cv'    },
      { from: 'VCF',     out: 'OUT',    to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'ADSR',    out: 'ENV',    to: 'VCA',        in: 'CV',    sig: 'cv'    },
      { from: 'VCA',     out: 'OUT',    to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Use the SAW output for a bright, classic tone; SQR for hollow and reedy.',
  },

  digital_osc: {
    title: 'Clean digital lead',
    modules: ['Keyboard', 'Digital Osc', 'VCF LP24', 'ADSR', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',   out: 'V/OCT', to: 'Digital Osc', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',   out: 'GATE',  to: 'ADSR',        in: 'GATE',  sig: 'gate'  },
      { from: 'Digital Osc', out: 'OUT',  to: 'VCF LP24',    in: 'IN',    sig: 'audio' },
      { from: 'ADSR',       out: 'ENV',   to: 'VCA',         in: 'CV',    sig: 'cv'    },
      { from: 'VCF LP24',   out: 'OUT',   to: 'VCA',         in: 'IN',    sig: 'audio' },
      { from: 'VCA',        out: 'OUT',   to: 'Output',      in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Set OCTAVE knob to +1 for a high lead sound; combine with VCF sweep.',
  },

  wavetable_osc: {
    title: 'Evolving pad with LFO morphing',
    modules: ['Keyboard', 'Wavetable Osc', 'LFO', 'VCA', 'Reverb', 'Output'],
    connections: [
      { from: 'Keyboard',     out: 'V/OCT', to: 'Wavetable Osc', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',     out: 'GATE',  to: 'VCA',           in: 'CV',    sig: 'gate'  },
      { from: 'LFO',          out: 'SIN',   to: 'Wavetable Osc', in: 'MORPH', sig: 'cv'    },
      { from: 'LFO',          out: 'TRI',   to: 'Wavetable Osc', in: 'POS',   sig: 'cv'    },
      { from: 'Wavetable Osc', out: 'OUT',  to: 'VCA',           in: 'IN',    sig: 'audio' },
      { from: 'VCA',          out: 'OUT',   to: 'Reverb',        in: 'IN',    sig: 'audio' },
      { from: 'Reverb',       out: 'OUT',   to: 'Output',        in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Slow LFO rate (0.1 Hz) creates a slow evolving texture.',
  },

  fm_osc: {
    title: 'FM bell voice',
    modules: ['Keyboard', 'FM Osc', 'ADSR', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard', out: 'V/OCT', to: 'FM Osc', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard', out: 'GATE',  to: 'ADSR',   in: 'GATE',  sig: 'gate'  },
      { from: 'FM Osc',   out: 'OUT',   to: 'VCA',    in: 'IN',    sig: 'audio' },
      { from: 'ADSR',     out: 'ENV',   to: 'VCA',    in: 'CV',    sig: 'cv'    },
      { from: 'ADSR',     out: 'ENV',   to: 'FM Osc', in: 'INDEX', sig: 'cv'    },
      { from: 'VCA',      out: 'OUT',   to: 'Output', in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Patch ADSR to INDEX so the modulation fades out — classic FM bell.',
  },

  harmonic_osc: {
    title: 'Additive pad',
    modules: ['Keyboard', 'Harmonic Osc', 'VCF', 'Reverb', 'Output'],
    connections: [
      { from: 'Keyboard',    out: 'V/OCT', to: 'Harmonic Osc', in: 'V/OCT', sig: 'cv'    },
      { from: 'Harmonic Osc', out: 'OUT',  to: 'VCF',          in: 'IN',    sig: 'audio' },
      { from: 'VCF',         out: 'OUT',   to: 'Reverb',       in: 'IN',    sig: 'audio' },
      { from: 'Reverb',      out: 'OUT',   to: 'Output',       in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Blend H2 and H3 high; H4 low for a warm, organ-like tone.',
  },

  chord_osc: {
    title: 'Polyphonic chord pads',
    modules: ['Keyboard', 'Chord Osc', 'VCF', 'ADSR', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Chord Osc', in: 'ROOT',  sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'ADSR',      in: 'GATE',  sig: 'gate'  },
      { from: 'Chord Osc', out: 'OUT',   to: 'VCF',       in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'VCA',       in: 'CV',    sig: 'cv'    },
      { from: 'VCF',       out: 'OUT',   to: 'VCA',       in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Output',    in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Set SPREAD to taste; a little detuning makes the chords feel wide.',
  },

  noise: {
    title: 'Filtered noise percussion',
    modules: ['Clock Gen', 'ADSR', 'Noise', 'VCF BP', 'VCA', 'Output'],
    connections: [
      { from: 'Clock Gen', out: 'GATE',  to: 'ADSR',   in: 'GATE',  sig: 'gate'  },
      { from: 'Noise',     out: 'OUT',   to: 'VCF BP', in: 'IN',    sig: 'audio' },
      { from: 'VCF BP',    out: 'OUT',   to: 'VCA',    in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'VCA',    in: 'CV',    sig: 'cv'    },
      { from: 'ADSR',      out: 'ENV',   to: 'VCF BP', in: 'CUT',   sig: 'cv'    },
      { from: 'VCA',       out: 'OUT',   to: 'Output', in: 'IN L',  sig: 'audio' },
    ],
    tip: 'White for snares; use a short decay and high bandpass freq for hi-hats.',
  },

  // ─── Filters ────────────────────────────────────────────────────────────────
  vcf: {
    title: 'Filter sweep with LFO',
    modules: ['Analog VCO', 'LFO', 'VCF', 'VCA', 'ADSR', 'Output'],
    connections: [
      { from: 'Analog VCO', out: 'OUT', to: 'VCF',    in: 'IN',   sig: 'audio' },
      { from: 'LFO',        out: 'SIN', to: 'VCF',    in: 'CUT',  sig: 'cv'    },
      { from: 'ADSR',       out: 'ENV', to: 'VCA',    in: 'CV',   sig: 'cv'    },
      { from: 'VCF',        out: 'OUT', to: 'VCA',    in: 'IN',   sig: 'audio' },
      { from: 'VCA',        out: 'OUT', to: 'Output', in: 'IN L', sig: 'audio' },
    ],
    tip: 'Switch LP/HP/BP with the MODE selector for different filter flavours.',
  },

  filter_lp24: {
    title: 'Classic Moog-style bass patch',
    modules: ['Keyboard', 'Analog VCO', 'Filter LP24', 'ADSR', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO',  in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'ADSR',        in: 'GATE',  sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',  to: 'Filter LP24', in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'Filter LP24', in: 'CUT',   sig: 'cv'    },
      { from: 'Filter LP24', out: 'OUT', to: 'VCA',         in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'VCA',         in: 'CV',    sig: 'cv'    },
      { from: 'VCA',       out: 'OUT',   to: 'Output',      in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Push RES near max and sweep CUT for the classic resonant acid bass.',
  },

  filter_ladder: {
    title: 'Warm ladder bass',
    modules: ['Keyboard', 'Analog VCO', 'Filter Ladder', 'ADSR', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',     out: 'V/OCT', to: 'Analog VCO',    in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',     out: 'GATE',  to: 'ADSR',          in: 'GATE',  sig: 'gate'  },
      { from: 'Analog VCO',   out: 'SAW',   to: 'Filter Ladder', in: 'IN',    sig: 'audio' },
      { from: 'ADSR',         out: 'ENV',   to: 'Filter Ladder', in: 'CUT',   sig: 'cv'    },
      { from: 'Filter Ladder', out: 'OUT',  to: 'VCA',           in: 'IN',    sig: 'audio' },
      { from: 'ADSR',         out: 'ENV',   to: 'VCA',           in: 'CV',    sig: 'cv'    },
      { from: 'VCA',          out: 'OUT',   to: 'Output',        in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Medium RES and a fast attack produce the characteristic transistor growl.',
  },

  filter_svf: {
    title: 'Parallel filter textures',
    modules: ['Analog VCO', 'Filter SVF', 'Mixer', 'VCA', 'Output'],
    connections: [
      { from: 'Analog VCO', out: 'OUT', to: 'Filter SVF', in: 'IN',  sig: 'audio' },
      { from: 'Filter SVF', out: 'LP',  to: 'Mixer',      in: 'IN1', sig: 'audio' },
      { from: 'Filter SVF', out: 'HP',  to: 'Mixer',      in: 'IN2', sig: 'audio' },
      { from: 'Filter SVF', out: 'BP',  to: 'Mixer',      in: 'IN3', sig: 'audio' },
      { from: 'Mixer',      out: 'OUT', to: 'VCA',        in: 'IN',  sig: 'audio' },
      { from: 'VCA',        out: 'OUT', to: 'Output',     in: 'IN L', sig: 'audio' },
    ],
    tip: 'Mix LP, BP, and HP at different levels for unique tonal blends.',
  },

  filter_comb: {
    title: 'Karplus-Strong plucked string',
    modules: ['Keyboard', 'Noise', 'Filter Comb', 'VCA', 'ADSR', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Filter Comb', in: 'FREQ',  sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'ADSR',        in: 'GATE',  sig: 'gate'  },
      { from: 'Noise',     out: 'OUT',   to: 'Filter Comb', in: 'IN',    sig: 'audio' },
      { from: 'Filter Comb', out: 'OUT', to: 'VCA',         in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'VCA',         in: 'CV',    sig: 'cv'    },
      { from: 'VCA',       out: 'OUT',   to: 'Output',      in: 'IN L',  sig: 'audio' },
    ],
    tip: 'High FEEDBACK and short ADSR decay mimics a plucked guitar string.',
  },

  filter_formant: {
    title: 'Talking synth / vocoder-like effect',
    modules: ['Keyboard', 'Analog VCO', 'LFO', 'Filter Formant', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',    out: 'V/OCT', to: 'Analog VCO',    in: 'V/OCT',  sig: 'cv'    },
      { from: 'Analog VCO',  out: 'SAW',   to: 'Filter Formant', in: 'IN',    sig: 'audio' },
      { from: 'LFO',         out: 'TRI',   to: 'Filter Formant', in: 'MORPH', sig: 'cv'    },
      { from: 'Filter Formant', out: 'OUT', to: 'VCA',           in: 'IN',    sig: 'audio' },
      { from: 'Keyboard',    out: 'GATE',  to: 'VCA',           in: 'CV',     sig: 'gate'  },
      { from: 'VCA',         out: 'OUT',   to: 'Output',        in: 'IN L',   sig: 'audio' },
    ],
    tip: 'Slow LFO (0.3 Hz) makes the vowel shape cycle slowly — robotic voice effect.',
  },

  // ─── Amplifiers ─────────────────────────────────────────────────────────────
  vca: {
    title: 'Envelope-controlled amplitude',
    modules: ['Keyboard', 'Analog VCO', 'ADSR', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'ADSR',       in: 'GATE',  sig: 'gate'  },
      { from: 'Analog VCO', out: 'OUT',  to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'VCA',        in: 'CV',    sig: 'cv'    },
      { from: 'VCA',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'A linear VCA is most accurate for envelope shaping at audio rate.',
  },

  vca_expo: {
    title: 'Natural-sounding amplitude envelope',
    modules: ['Keyboard', 'Analog VCO', 'ADSR', 'VCA Expo', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'ADSR',       in: 'GATE',  sig: 'gate'  },
      { from: 'Analog VCO', out: 'OUT',  to: 'VCA Expo',   in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'VCA Expo',   in: 'CV',    sig: 'cv'    },
      { from: 'VCA Expo',  out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Sounds more natural than linear VCA; preferred for melody and pads.',
  },

  // ─── Dynamics ───────────────────────────────────────────────────────────────
  compressor: {
    title: 'Kick sidechain ducking',
    modules: ['Drum Machine', 'Analog VCO', 'Compressor', 'Output'],
    connections: [
      { from: 'Drum Machine', out: 'K-OUT', to: 'Compressor', in: 'SC',   sig: 'audio' },
      { from: 'Analog VCO',   out: 'SAW',   to: 'Compressor', in: 'IN',   sig: 'audio' },
      { from: 'Compressor',   out: 'OUT',   to: 'Output',     in: 'IN L', sig: 'audio' },
    ],
    tip: 'Fast attack (~1 ms), medium release (~100 ms), ratio 4:1 for pumping bass.',
  },

  noise_gate: {
    title: 'Gated reverb effect',
    modules: ['Analog VCO', 'Reverb', 'Noise Gate', 'Clock Gen', 'Output'],
    connections: [
      { from: 'Analog VCO', out: 'OUT',  to: 'Reverb',     in: 'IN',   sig: 'audio' },
      { from: 'Reverb',     out: 'OUT',  to: 'Noise Gate', in: 'IN',   sig: 'audio' },
      { from: 'Noise Gate', out: 'OUT',  to: 'Output',     in: 'IN L', sig: 'audio' },
    ],
    tip: 'Set threshold to cut the reverb tail suddenly — classic 80s gated snare.',
  },

  // ─── Envelopes ──────────────────────────────────────────────────────────────
  adsr: {
    title: 'Filter + amplitude shaping',
    modules: ['Keyboard', 'Analog VCO', 'ADSR', 'VCF', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'ADSR',       in: 'GATE',  sig: 'gate'  },
      { from: 'Analog VCO', out: 'OUT',  to: 'VCF',        in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'VCF',        in: 'CUT',   sig: 'cv'    },
      { from: 'ADSR',      out: 'ENV',   to: 'VCA',        in: 'CV',    sig: 'cv'    },
      { from: 'VCF',       out: 'OUT',   to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Use the same ADSR for both VCF and VCA for a tightly linked sound.',
  },

  ahdsr: {
    title: 'Sustained pad with hold phase',
    modules: ['Keyboard', 'Chord Osc', 'AHDSR', 'VCA', 'Reverb', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Chord Osc', in: 'ROOT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'AHDSR',     in: 'GATE', sig: 'gate'  },
      { from: 'Chord Osc', out: 'OUT',   to: 'VCA',       in: 'IN',   sig: 'audio' },
      { from: 'AHDSR',     out: 'ENV',   to: 'VCA',       in: 'CV',   sig: 'cv'    },
      { from: 'VCA',       out: 'OUT',   to: 'Reverb',    in: 'IN',   sig: 'audio' },
      { from: 'Reverb',    out: 'OUT',   to: 'Output',    in: 'IN L', sig: 'audio' },
    ],
    tip: 'Set HOLD to 0.5 s so chords sustain briefly even after key release.',
  },

  // ─── LFOs ───────────────────────────────────────────────────────────────────
  lfo: {
    title: 'Tremolo and filter wobble',
    modules: ['Keyboard', 'Analog VCO', 'LFO', 'VCF', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'LFO',       out: 'SIN',   to: 'VCA',        in: 'CV',    sig: 'cv'    },
      { from: 'LFO',       out: 'TRI',   to: 'VCF',        in: 'CUT',   sig: 'cv'    },
      { from: 'Analog VCO', out: 'OUT',  to: 'VCF',        in: 'IN',    sig: 'audio' },
      { from: 'VCF',       out: 'OUT',   to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'LFO at ~4–6 Hz for classic vibrato; 0.5 Hz for a slow filter wobble.',
  },

  lfo_multi: {
    title: 'Cross-modulation pad',
    modules: ['LFO Multi', 'Wavetable Osc', 'VCF', 'VCA', 'Output'],
    connections: [
      { from: 'LFO Multi',    out: 'SIN', to: 'Wavetable Osc', in: 'MORPH', sig: 'cv'    },
      { from: 'LFO Multi',    out: 'TRI', to: 'VCF',           in: 'CUT',   sig: 'cv'    },
      { from: 'LFO Multi',    out: 'SQR', to: 'VCA',           in: 'CV',    sig: 'cv'    },
      { from: 'Wavetable Osc', out: 'OUT', to: 'VCF',          in: 'IN',    sig: 'audio' },
      { from: 'VCF',          out: 'OUT', to: 'VCA',           in: 'IN',    sig: 'audio' },
      { from: 'VCA',          out: 'OUT', to: 'Output',        in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Use different LFO waveforms for each destination to create complex motion.',
  },

  // ─── Sequencers ─────────────────────────────────────────────────────────────
  seq_step: {
    title: 'Melodic step sequence',
    modules: ['Clock Gen', 'Step Seq', 'Analog VCO', 'VCF', 'VCA', 'Output'],
    connections: [
      { from: 'Clock Gen', out: 'GATE',  to: 'Step Seq',   in: 'CLK',   sig: 'gate'  },
      { from: 'Step Seq',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Step Seq',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',  to: 'VCF',        in: 'IN',    sig: 'audio' },
      { from: 'VCF',       out: 'OUT',   to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Dial in a scale pattern on the step knobs; adjust Clock Gen BPM for tempo.',
  },

  seq_trigger: {
    title: 'Rhythmic trigger pattern',
    modules: ['Clock Gen', 'Trigger Seq', 'Drum Machine', 'Output'],
    connections: [
      { from: 'Clock Gen',  out: 'GATE',  to: 'Trigger Seq',  in: 'CLK',   sig: 'gate'  },
      { from: 'Trigger Seq', out: 'GATE', to: 'Drum Machine', in: 'K-TRG', sig: 'gate'  },
      { from: 'Drum Machine', out: 'MIX', to: 'Output',       in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Set steps 1 and 5 on for a basic kick pattern; add more for complexity.',
  },

  arpeggiator: {
    title: 'MIDI arpeggio to synth voice',
    modules: ['Keyboard', 'Arpeggiator', 'Analog VCO', 'VCF', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',   out: 'GATE',  to: 'Arpeggiator', in: 'GATE',  sig: 'gate'  },
      { from: 'Keyboard',   out: 'V/OCT', to: 'Arpeggiator', in: 'V/OCT', sig: 'cv'    },
      { from: 'Arpeggiator', out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Arpeggiator', out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',   to: 'VCF',        in: 'IN',    sig: 'audio' },
      { from: 'VCF',        out: 'OUT',   to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',        out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Hold a chord on the keyboard and the arpeggiator cycles through the notes.',
  },

  // ─── Clocks ─────────────────────────────────────────────────────────────────
  clock_gen: {
    title: 'Master clock driving sequencer',
    modules: ['Clock Gen', 'Step Seq', 'Analog VCO', 'VCA', 'Output'],
    connections: [
      { from: 'Clock Gen', out: 'GATE',  to: 'Step Seq',   in: 'CLK',   sig: 'gate'  },
      { from: 'Clock Gen', out: '/4',    to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Step Seq',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'   },
      { from: 'Analog VCO', out: 'SAW',  to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Use /4 output to gate VCA for a quarter-note rhythmic chop effect.',
  },

  clock_div: {
    title: 'Polyrhythmic triggers',
    modules: ['Clock Gen', 'Clock Divider', 'Drum Machine', 'Output'],
    connections: [
      { from: 'Clock Gen',     out: 'GATE',  to: 'Clock Divider', in: 'CLK',   sig: 'gate'  },
      { from: 'Clock Gen',     out: 'GATE',  to: 'Drum Machine',  in: 'K-TRG', sig: 'gate'  },
      { from: 'Clock Divider', out: 'GATE',  to: 'Drum Machine',  in: 'S-TRG', sig: 'gate'  },
      { from: 'Drum Machine',  out: 'MIX',   to: 'Output',        in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Set DIVIDE to 3 while clock runs at 16ths to get triplet snare offbeats.',
  },

  midi_clock_in: {
    title: 'DAW-synced sequencer',
    modules: ['MIDI Clock In', 'Clock Gen', 'Step Seq', 'Analog VCO', 'Output'],
    connections: [
      { from: 'MIDI Clock In', out: 'CLK',   to: 'Step Seq',   in: 'CLK',   sig: 'gate'  },
      { from: 'Step Seq',      out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Step Seq',      out: 'GATE',  to: 'Analog VCO', in: 'SYNC',  sig: 'gate'  },
      { from: 'Analog VCO',    out: 'SAW',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Press LOCK TO DAW after adding the module; BPM display turns green when locked.',
  },

  // ─── Delays ─────────────────────────────────────────────────────────────────
  delay_mod: {
    title: 'Modulated echo pad',
    modules: ['Keyboard', 'Analog VCO', 'LFO', 'Delay Mod', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'OUT',  to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Delay Mod',  in: 'IN',    sig: 'audio' },
      { from: 'LFO',       out: 'SIN',   to: 'Delay Mod',  in: 'TIME',  sig: 'cv'    },
      { from: 'Delay Mod', out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'LFO on TIME input creates chorus-like shimmer on the echoes.',
  },

  delay_tape: {
    title: 'Vintage tape echo',
    modules: ['Keyboard', 'Analog VCO', 'VCA', 'Tape Delay', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',  to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Tape Delay', in: 'IN',    sig: 'audio' },
      { from: 'Tape Delay', out: 'OUT',  to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Raise FLUTTER slightly for an organic, slightly unstable echo feel.',
  },

  // ─── Reverbs ────────────────────────────────────────────────────────────────
  reverb: {
    title: 'Atmospheric reverb send',
    modules: ['Keyboard', 'Analog VCO', 'VCA', 'Reverb', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'OUT',  to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Reverb',     in: 'IN',    sig: 'audio' },
      { from: 'Reverb',    out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Set MIX to ~40% and SIZE large for a classic "room" reverb behind the dry signal.',
  },

  reverb_shimmer: {
    title: 'Shimmer ambient pad',
    modules: ['Keyboard', 'Chord Osc', 'VCA', 'Shimmer Reverb', 'Output'],
    connections: [
      { from: 'Keyboard',      out: 'V/OCT', to: 'Chord Osc',      in: 'ROOT', sig: 'cv'    },
      { from: 'Keyboard',      out: 'GATE',  to: 'VCA',            in: 'CV',   sig: 'gate'  },
      { from: 'Chord Osc',     out: 'OUT',   to: 'VCA',            in: 'IN',   sig: 'audio' },
      { from: 'VCA',           out: 'OUT',   to: 'Shimmer Reverb', in: 'IN',   sig: 'audio' },
      { from: 'Shimmer Reverb', out: 'OUT',  to: 'Output',         in: 'IN L', sig: 'audio' },
    ],
    tip: 'High SHIMMER and large SIZE turns a single chord into an infinite wash.',
  },

  // ─── Modulation ─────────────────────────────────────────────────────────────
  chorus: {
    title: 'Lush chorus string ensemble',
    modules: ['Keyboard', 'Chord Osc', 'VCA', 'Chorus', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Chord Osc', in: 'ROOT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',       in: 'CV',   sig: 'gate'  },
      { from: 'Chord Osc', out: 'OUT',   to: 'VCA',       in: 'IN',   sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Chorus',    in: 'IN',   sig: 'audio' },
      { from: 'Chorus',    out: 'OUT',   to: 'Output',    in: 'IN L', sig: 'audio' },
    ],
    tip: 'Slow RATE and moderate DEPTH creates that classic 80s string ensemble sound.',
  },

  flanger: {
    title: 'Jet-sweep lead',
    modules: ['Keyboard', 'Analog VCO', 'VCA', 'Flanger', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',  to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Flanger',    in: 'IN',    sig: 'audio' },
      { from: 'Flanger',   out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'High FEEDBACK and moderate RATE makes the flanging effect very pronounced.',
  },

  tremolo: {
    title: 'Rhythmic amplitude pulse',
    modules: ['Clock Gen', 'Keyboard', 'Analog VCO', 'Tremolo', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'OUT',  to: 'Tremolo',    in: 'IN',    sig: 'audio' },
      { from: 'Tremolo',   out: 'OUT',   to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Set WAVE to SQR for choppy gating; SIN for gentle pulsing.',
  },

  // ─── Distortion ─────────────────────────────────────────────────────────────
  overdrive: {
    title: 'Overdriven lead guitar tone',
    modules: ['Keyboard', 'Analog VCO', 'VCA', 'Overdrive', 'VCF', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',  to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Overdrive',  in: 'IN',    sig: 'audio' },
      { from: 'Overdrive', out: 'OUT',   to: 'VCF',        in: 'IN',    sig: 'audio' },
      { from: 'VCF',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Filter after the overdrive to shape the distortion harmonics.',
  },

  wavefolder: {
    title: 'West-coast wavefolder synthesis',
    modules: ['Keyboard', 'Analog VCO', 'ADSR', 'Wavefolder', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'ADSR',       in: 'GATE',  sig: 'gate'  },
      { from: 'Analog VCO', out: 'SIN',  to: 'Wavefolder', in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'Wavefolder', in: 'FOLD',  sig: 'cv'    },
      { from: 'Wavefolder', out: 'OUT',  to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'VCA',        in: 'CV',    sig: 'cv'    },
      { from: 'VCA',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Use SIN or TRI output from the VCO — folding a sine is the classic approach.',
  },

  bitcrusher: {
    title: 'Lo-fi crusher effect',
    modules: ['Analog VCO', 'Bitcrusher', 'VCF LP24', 'VCA', 'Output'],
    connections: [
      { from: 'Analog VCO', out: 'SQR',  to: 'Bitcrusher', in: 'IN',   sig: 'audio' },
      { from: 'Bitcrusher', out: 'OUT',  to: 'VCF LP24',   in: 'IN',   sig: 'audio' },
      { from: 'VCF LP24',   out: 'OUT',  to: 'VCA',        in: 'IN',   sig: 'audio' },
      { from: 'VCA',        out: 'OUT',  to: 'Output',     in: 'IN L', sig: 'audio' },
    ],
    tip: 'Set BITS to 4–6 for aggressive digital grit; follow with a low-pass to tame aliasing.',
  },

  ring_mod: {
    title: 'Metallic ring modulation',
    modules: ['Keyboard', 'Analog VCO', 'Digital Osc', 'Ring Mod', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',  to: 'Ring Mod',   in: 'IN',    sig: 'audio' },
      { from: 'Digital Osc', out: 'OUT', to: 'Ring Mod',   in: 'CAR',   sig: 'audio' },
      { from: 'Ring Mod',   out: 'OUT',  to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',        out: 'OUT',  to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Tune the carrier to a non-musical interval for inharmonic bell tones.',
  },

  // ─── Spectral ───────────────────────────────────────────────────────────────
  pitch_shift: {
    title: 'Harmonised melody',
    modules: ['Keyboard', 'Analog VCO', 'Pitch Shift', 'Mixer', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Analog VCO', out: 'SAW',  to: 'Mixer',      in: 'IN1',   sig: 'audio' },
      { from: 'Analog VCO', out: 'SAW',  to: 'Pitch Shift', in: 'IN',   sig: 'audio' },
      { from: 'Pitch Shift', out: 'OUT', to: 'Mixer',      in: 'IN2',   sig: 'audio' },
      { from: 'Mixer',      out: 'OUT',  to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Set SHIFT to +5 semitones for a major-third harmony layer.',
  },

  vocoder: {
    title: 'Classic vocoder effect',
    modules: ['Noise', 'Analog VCO', 'Vocoder', 'Output'],
    connections: [
      { from: 'Analog VCO', out: 'SAW', to: 'Vocoder', in: 'CAR', sig: 'audio' },
      { from: 'Noise',      out: 'OUT', to: 'Vocoder', in: 'MOD', sig: 'audio' },
      { from: 'Vocoder',    out: 'OUT', to: 'Output',  in: 'IN L', sig: 'audio' },
    ],
    tip: 'Swap the MOD input for a microphone signal (via audio trig) for true voice vocoding.',
  },

  // ─── Granular ───────────────────────────────────────────────────────────────
  granular: {
    title: 'Granular cloud from a VCO',
    modules: ['Analog VCO', 'LFO', 'Granular', 'Reverb', 'Output'],
    connections: [
      { from: 'Analog VCO', out: 'SAW', to: 'Granular', in: 'IN',    sig: 'audio' },
      { from: 'LFO',        out: 'SIN', to: 'Granular', in: 'PITCH', sig: 'cv'    },
      { from: 'LFO',        out: 'TRI', to: 'Granular', in: 'POS',   sig: 'cv'    },
      { from: 'Granular',   out: 'OUT', to: 'Reverb',   in: 'IN',    sig: 'audio' },
      { from: 'Reverb',     out: 'OUT', to: 'Output',   in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Large GRAIN (500 ms+) with slow DENSITY creates ambient cloud textures.',
  },

  freeze_proc: {
    title: 'Freeze-loop ambient texture',
    modules: ['Keyboard', 'Analog VCO', 'Freeze', 'LFO', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'Freeze',     in: 'FRZE',  sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',  to: 'Freeze',     in: 'IN',    sig: 'audio' },
      { from: 'LFO',       out: 'TRI',   to: 'Freeze',     in: 'POS',   sig: 'cv'    },
      { from: 'Freeze',    out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Hold the keyboard key to freeze the buffer, then the LFO scans the frozen grains.',
  },

  sampler: {
    title: 'Sample-triggered melodic phrase',
    modules: ['Keyboard', 'Sampler', 'VCA', 'Reverb', 'Output'],
    connections: [
      { from: 'Keyboard', out: 'V/OCT', to: 'Sampler', in: 'PTCH', sig: 'cv'    },
      { from: 'Keyboard', out: 'GATE',  to: 'Sampler', in: 'GATE', sig: 'gate'  },
      { from: 'Sampler',  out: 'OUT',   to: 'VCA',     in: 'IN',   sig: 'audio' },
      { from: 'Keyboard', out: 'GATE',  to: 'VCA',     in: 'CV',   sig: 'gate'  },
      { from: 'VCA',      out: 'OUT',   to: 'Reverb',  in: 'IN',   sig: 'audio' },
      { from: 'Reverb',   out: 'OUT',   to: 'Output',  in: 'IN L', sig: 'audio' },
    ],
    tip: 'Load a single-note sample and use V/OCT to pitch it across the keyboard.',
  },

  // ─── Utility / I/O ──────────────────────────────────────────────────────────
  mixer: {
    title: 'Layer three oscillators',
    modules: ['Keyboard', 'Analog VCO', 'Digital Osc', 'Noise', 'Mixer', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'V/OCT', to: 'Digital Osc', in: 'V/OCT', sig: 'cv'   },
      { from: 'Keyboard',  out: 'GATE',  to: 'VCA',        in: 'CV',    sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',  to: 'Mixer',      in: 'IN1',   sig: 'audio' },
      { from: 'Digital Osc', out: 'OUT', to: 'Mixer',      in: 'IN2',   sig: 'audio' },
      { from: 'Noise',     out: 'OUT',   to: 'Mixer',      in: 'IN3',   sig: 'audio' },
      { from: 'Mixer',     out: 'OUT',   to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Mix the noise channel low to add subtle breath to an otherwise clean tone.',
  },

  keyboard: {
    title: 'Standard keyboard-to-synth voice',
    modules: ['Keyboard', 'Analog VCO', 'VCF', 'ADSR', 'VCA', 'Output'],
    connections: [
      { from: 'Keyboard',  out: 'V/OCT', to: 'Analog VCO', in: 'V/OCT', sig: 'cv'    },
      { from: 'Keyboard',  out: 'GATE',  to: 'ADSR',       in: 'GATE',  sig: 'gate'  },
      { from: 'Analog VCO', out: 'SAW',  to: 'VCF',        in: 'IN',    sig: 'audio' },
      { from: 'ADSR',      out: 'ENV',   to: 'VCF',        in: 'CUT',   sig: 'cv'    },
      { from: 'ADSR',      out: 'ENV',   to: 'VCA',        in: 'CV',    sig: 'cv'    },
      { from: 'VCF',       out: 'OUT',   to: 'VCA',        in: 'IN',    sig: 'audio' },
      { from: 'VCA',       out: 'OUT',   to: 'Output',     in: 'IN L',  sig: 'audio' },
    ],
    tip: 'This is the classic subtractive synthesis signal flow.',
  },

  output: {
    title: 'Final stereo output stage',
    modules: ['Analog VCO', 'VCF', 'VCA', 'Reverb', 'Output'],
    connections: [
      { from: 'Analog VCO', out: 'SAW', to: 'VCF',    in: 'IN',   sig: 'audio' },
      { from: 'VCF',        out: 'OUT', to: 'VCA',    in: 'IN',   sig: 'audio' },
      { from: 'VCA',        out: 'OUT', to: 'Reverb', in: 'IN',   sig: 'audio' },
      { from: 'Reverb',     out: 'OUT', to: 'Output', in: 'IN L', sig: 'audio' },
    ],
    tip: 'Connect the same signal to both L and R inputs for a mono-in, stereo-out result.',
  },

  // ─── Rhythm ─────────────────────────────────────────────────────────────────
  euclidean_trig: {
    title: 'Euclidean drum pattern',
    modules: ['Clock Gen', 'Euclidean', 'Drum Machine', 'Output'],
    connections: [
      { from: 'Clock Gen',    out: 'GATE', to: 'Euclidean',    in: 'SYNC',  sig: 'gate'  },
      { from: 'Euclidean',    out: 'GATE', to: 'Drum Machine', in: 'K-TRG', sig: 'gate'  },
      { from: 'Euclidean',    out: 'INV',  to: 'Drum Machine', in: 'HC-T',  sig: 'gate'  },
      { from: 'Drum Machine', out: 'MIX',  to: 'Output',       in: 'IN L',  sig: 'audio' },
    ],
    tip: 'FILL=3, STEPS=8 gives a classic tresillo pattern. INV fires on the off-beats.',
  },

  drum_machine: {
    title: 'Drum machine with external triggers',
    modules: ['Clock Gen', 'Euclidean', 'Drum Machine', 'Reverb', 'Output'],
    connections: [
      { from: 'Clock Gen',    out: 'GATE', to: 'Drum Machine', in: 'K-TRG', sig: 'gate'  },
      { from: 'Clock Gen',    out: '/4',   to: 'Drum Machine', in: 'S-TRG', sig: 'gate'  },
      { from: 'Euclidean',    out: 'GATE', to: 'Drum Machine', in: 'HC-T',  sig: 'gate'  },
      { from: 'Drum Machine', out: 'MIX',  to: 'Reverb',       in: 'IN',    sig: 'audio' },
      { from: 'Reverb',       out: 'OUT',  to: 'Output',       in: 'IN L',  sig: 'audio' },
    ],
    tip: 'Use individual voice outputs to route each drum through its own effects chain.',
  },

  poly_step: {
    title: 'Poly-rhythmic multi-voice sequence',
    modules: ['Clock Gen', 'Poly Step', 'Analog VCO', 'Drum Machine', 'Output'],
    connections: [
      { from: 'Clock Gen',    out: 'GATE', to: 'Poly Step',    in: 'CLK',   sig: 'gate'  },
      { from: 'Poly Step',    out: 'KICK', to: 'Analog VCO',   in: 'SYNC',  sig: 'gate'  },
      { from: 'Poly Step',    out: 'SNR',  to: 'Drum Machine', in: 'K-TRG', sig: 'gate'  },
      { from: 'Poly Step',    out: 'VEL1', to: 'Analog VCO',   in: 'V/OCT', sig: 'cv'    },
      { from: 'Analog VCO',   out: 'SAW',  to: 'Output',       in: 'IN L',  sig: 'audio' },
      { from: 'Drum Machine', out: 'MIX',  to: 'Output',       in: 'IN R',  sig: 'audio' },
    ],
    tip: 'Set tracks to different step lengths (e.g. 7 and 5) for evolving polyrhythm.',
  },
};
