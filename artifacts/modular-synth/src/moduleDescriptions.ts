export const MODULE_DESCRIPTIONS: Record<string, string> = {
  // ─── Oscillators ────────────────────────────────────────────────────────────
  analog_vco:    'Classic analog-style VCO with separate outputs per waveform. V/OCT tracks keyboard pitch at 1 V/octave. PW modulates the pulse width on the square output.',
  digital_osc:   'Precision digital oscillator with an OCTAVE transpose knob. Low CPU; ideal as a primary tone source for melodic patches.',
  wavetable_osc: 'Wavetable oscillator that morphs between stored waveforms. POS scans the table position; MORPH blends adjacent waves for smooth timbral evolution.',
  fm_osc:        'Two-operator FM synthesizer. CARRIER sets the base pitch, RATIO tunes the modulator relative to the carrier, INDEX controls modulation depth for harmonic richness.',
  harmonic_osc:  'Additive oscillator mixing up to 4 harmonic partials. Each Hn knob blends the nth harmonic amplitude for fully customisable waveform shapes.',
  chord_osc:     'Polyphonic chord oscillator. ROOT sets the fundamental pitch; CHORD selects chord type (Maj/Min/Sus4…); SPREAD detunes the voices for stereo width.',
  noise:         'Random noise generator. White noise is spectrally flat; pink noise rolls off at 3 dB/octave for a warmer tone. Great for percussion and sample-and-hold clock sources.',

  // ─── Filters ────────────────────────────────────────────────────────────────
  vcf:             'Versatile multimode filter (LP/HP/BP/NOTCH). CUT sets the cutoff frequency; RES adds resonance that approaches self-oscillation at high values. FM input adds audio-rate modulation.',
  filter_lp6:      'Gentle 1-pole 6 dB/oct low-pass. Subtle high-frequency roll-off — useful for taming brightness without dramatically altering the tone.',
  filter_lp18:     '3-pole 18 dB/oct low-pass. Mid-slope roll-off for punchy bass sounds and classic filter sweeps.',
  filter_lp24:     '4-pole 24 dB/oct low-pass (Moog-style slope). Powerful; high RES values approach self-oscillation and can be used as a sine oscillator.',
  filter_ladder:   'Transistor ladder filter with warm, musical resonance. High RES produces the characteristic growl of classic analog synthesizers.',
  filter_ota:      'OTA-based filter with an integrated DRIVE input. Adds saturation and harmonic grit when pushed hard — combines filtering and distortion.',
  filter_svf:      'State-variable filter with simultaneous LP, HP, BP, and NOTCH outputs at once. Ideal for parallel routing and split-frequency processing.',
  filter_hp:       'High-pass filter that removes low-frequency content. Useful for thinning a bass signal or creating sidechain-ready versions of a sound.',
  filter_bp:       'Band-pass filter passing frequencies around FREQ with a bandwidth set by Q. Good for formant shaping and telephone/radio effects.',
  filter_br:       'Band-reject filter with adjustable center frequency and bandwidth. Carves a smooth notch in the spectrum.',
  filter_notch:    'Narrow notch filter for removing specific resonances, hum frequencies, or feedback tones.',
  filter_comb:     'Comb filter creating a series of evenly spaced notches. High FEEDBACK produces metallic, pitch-like resonances and Karplus-Strong–style plucked tones.',
  filter_formant:  'Formant filter emulating vowel resonance shapes (A/E/I/O/U). DEPTH blends the formant effect with the dry signal.',
  filter_morph:    'Smoothly interpolates between LP, BP, and HP filter characters in a single module. MORPH CV sweeps the characteristic in real time.',
  filter_multi:    'Multimode filter with a MODE selector (LP/HP/BP/NOTCH) — one input, one output, selectable slope character.',

  // ─── Amplifiers ─────────────────────────────────────────────────────────────
  vca:       'Linear VCA — gain scales directly with the CV voltage. Pair with an envelope on the CV input for classic amplitude shaping.',
  vca_expo:  'Exponential VCA — gain responds logarithmically to CV, matching human hearing perception. Sounds more natural for amplitude envelopes than a linear VCA.',
  vca_dual:  'Two fully independent VCAs in one module for compact stereo or parallel patching. A and B channels are completely separate.',

  // ─── Dynamics ───────────────────────────────────────────────────────────────
  compressor: 'Dynamic range compressor. SC input enables sidechain compression — feed a kick drum there for classic bass ducking.',
  limiter:    'Brickwall limiter that prevents signal from exceeding the CEILING level. Place at the end of the chain to protect against clipping.',
  expander:   'Downward expander — attenuates signals that fall below the threshold. Increases dynamic range and reduces background noise between notes.',
  noise_gate: 'Silences the signal when it falls below the threshold. The OPEN output fires a gate signal whenever the gate opens — useful for triggering downstream events.',
  sidechain:  'Dedicated sidechain compressor. Feed a kick drum into the SC input to duck the main signal rhythmically — a classic electronic music technique.',

  // ─── Envelopes ──────────────────────────────────────────────────────────────
  adsr:   'Classic 4-stage ADSR envelope generator. Triggered by a gate signal; outputs a CV contour to control VCAs, filters, and more. EOC fires a gate at the end of release.',
  ahdsr:  '5-stage envelope with an extra Hold phase between Attack and Decay. HLD sets how long the envelope stays at peak level before beginning to decay.',

  // ─── LFOs ───────────────────────────────────────────────────────────────────
  lfo:         'Low-frequency oscillator outputting multiple waveforms simultaneously. RST resets the phase. Patch to filter cutoff, VCA, or pitch for classic modulation.',
  lfo_analog:  'Analog-style LFO with a DRIFT parameter that adds subtle random rate variation, emulating real circuit instability for organic feel.',
  lfo_digital: 'Precision digital LFO with S&H mode and a PHASE offset knob. Stable and predictable — ideal for rhythmic, clock-synced modulation.',
  lfo_multi:   'Compact 4-output LFO with all basic waveforms available simultaneously. Good for complex cross-modulation patches.',

  // ─── Sequencers ─────────────────────────────────────────────────────────────
  seq_step:    '8-step melodic sequencer with per-step MIDI note values (0–127). Outputs V/OCT pitch and a GATE pulse on each step. CLK advances; RST resets to step 1.',
  seq_trigger: '8-step trigger/rest sequencer where each step is on or off. Driven by an external clock; great for rhythmic gate patterns.',
  seq_cv:      '8-step CV sequencer with a continuous voltage level per step. Use for automating filter sweeps, LFO rates, or any CV-controllable parameter.',
  seq_gate:    '8-step gate sequencer with a LENGTH knob controlling what proportion of each step is filled by the gate pulse.',
  arpeggiator: 'MIDI-driven arpeggiator. Connect GATE IN from a keyboard to activate; plays held notes in various directional patterns across up to 4 octaves.',

  // ─── Clocks ─────────────────────────────────────────────────────────────────
  clock_gen:     'Master clock generator with SWING control. Outputs a primary gate plus three divided sub-clocks (/2, /4, /8). RST resets the phase.',
  clock_div:     'Clock divider that outputs one gate every N incoming clock pulses. DIVIDE sets the division ratio from 1 to 16.',
  clock_mul:     'Clock multiplier that generates multiple pulses between each incoming clock tick. MULTIPLY sets the multiplication factor from 1 to 8.',
  clock_dly:     'Delays each incoming clock pulse by a fraction of the clock period. Creates offset rhythms and polyrhythmic relationships.',
  clock_shuffle: 'Adds shuffle/swing to an incoming clock by delaying alternate beats. SHUFFLE controls the groove amount.',
  swing_gen:     'Generates a swung clock from an input pulse. SWING sets the long-to-short beat ratio.',

  // ─── Delays ─────────────────────────────────────────────────────────────────
  delay_mod:     'General-purpose modulated delay line with TIME, FEEDBACK, and wet/dry MIX. Good all-rounder for echoes, slapback, and chorus-like effects.',
  delay_analog:  'Analog bucket-brigade style delay. TONE rolls off high frequencies in the feedback path for warm, lo-fi repeats.',
  delay_digital: 'Clean digital delay with precise timing. High FEEDBACK creates long, cascading echo trails.',
  delay_tape:    'Tape delay simulation with a FLUTTER parameter for pitch instability. Adds vintage warmth and organic character to repeats.',

  // ─── Reverbs ────────────────────────────────────────────────────────────────
  reverb:           'Algorithmic reverb. SIZE sets the perceived room size; MIX blends wet and dry signals.',
  reverb_spring:    'Spring reverb simulation. TENSION controls the spring resonance frequency — emulates classic guitar amp reverb tanks.',
  reverb_plate:     'Plate reverb simulation — dense, smooth decay with a bright musical character. Ideal for vocals, snares, and pads.',
  reverb_hall:      'Large hall reverb with long, lush tails suitable for ambient pads and wide spatial effects.',
  reverb_shimmer:   'Shimmer reverb that pitch-shifts the reverb tail upward by an octave. SHIMMER blends in the pitched layer for ethereal, evolving textures.',

  // ─── Modulation ─────────────────────────────────────────────────────────────
  chorus:  'Stereo chorus using slightly detuned modulated delays. RATE and DEPTH control the modulation LFO speed and depth.',
  flanger: 'Short delay modulated by an LFO with resonant feedback. FEEDBACK controls the intensity of the characteristic jet-plane sweep.',
  phaser:  'All-pass phaser with swept phase-shift notches. FEEDBACK boosts resonance for more dramatic sweeping.',
  vibrato: 'Pitch modulation (vibrato) — modulates the signal delay to create pitch wavering independent of the oscillator.',
  tremolo: 'Amplitude modulation (tremolo) that rhythmically pulses the volume. WAVE changes the modulation shape (sine, square, triangle).',
  rotary:  'Rotary speaker (Leslie cabinet) simulation with SLOW and FAST modes. DEPTH controls the depth of pitch and amplitude modulation.',

  // ─── Distortion ─────────────────────────────────────────────────────────────
  overdrive:   'Soft-clipping overdrive. DRIVE increases saturation; TONE rolls off highs to taste. Warm and musical.',
  fuzz:        'Hard-clipping fuzz — aggressive and harmonically dense. FUZZ CV allows dynamic distortion control from an envelope or LFO.',
  wavefolder:  'Wavefolder that reflects the waveform back on itself when it exceeds the FOLD threshold, generating new upper harmonics.',
  bitcrusher:  'Reduces audio bit depth (1–16 bits). Low BITS values produce characteristic digital grit and quantisation noise.',
  samplerate:  'Reduces the effective sample rate by an integer factor. Creates aliasing and lo-fi digital texture.',
  saturator:   'Gentle soft-clipping saturation — adds harmonic warmth without the aggression of overdrive or fuzz.',

  // ─── Spectral ───────────────────────────────────────────────────────────────
  ring_mod:    'Multiplies the input by a carrier signal to produce sum and difference sidebands. Creates metallic, bell-like, or inharmonic timbres.',
  pitch_shift: 'Shifts pitch by ±24 semitones without time-stretching. SHIFT CV allows dynamic pitch changes from an LFO or envelope.',
  freq_shift:  'Shifts all frequencies by a constant Hz offset (not semitones), producing inharmonic sidebands and subtle pitch smearing.',
  resonator:   'Bank of tuned resonant filters. FREQ sets the fundamental; HARMONICS adds overtone peaks; Q sharpens the resonance.',
  vocoder:     'Band vocoder — CAR is the carrier (synth or noise); MOD is the modulator (voice/audio). BANDS sets the number of frequency channels.',
  fft_proc:    'FFT-based spectral processor. TILT tilts the spectral balance; FOCUS boosts or cuts the center of the spectrum.',

  // ─── Granular ───────────────────────────────────────────────────────────────
  granular:     'Granular processor that chops the input into small grains and re-synthesises them. GRAIN size, DENSITY, PITCH transpose, and SPREAD control the grain cloud.',
  time_stretch: 'Time-stretches the input by 0.25×–4× without changing pitch. SPEED CV for dynamic real-time stretching.',
  freeze_proc:  'Freezes the input into a looping granular texture. FRZE gate freezes/unfreezes; POS scans the frozen buffer position.',

  // ─── Utility / I/O ──────────────────────────────────────────────────────────
  mixer:        '6-channel audio mixer with per-channel level knobs. All inputs are summed to a single output.',
  keyboard:     'CV/gate interface for the on-screen piano keyboard. Outputs V/OCT pitch and a gate signal as keys are pressed.',
  midi_monitor: 'Displays incoming MIDI data in real time: note name, velocity, pitch bend, mod wheel, last CC, channel, and gate status.',
  output:       'Final audio output module. Connect your processed audio here to hear it. MASTER controls overall volume; L and R inputs accept stereo.',

  // ─── Clock / Rhythm ─────────────────────────────────────────────────────────
  euclidean_trig: 'Euclidean rhythm generator. Distributes FILL trigger pulses as evenly as possible across STEPS using the Bjorklund algorithm. GATE fires on pattern hits, INV on rests, CLK on every tick regardless of pattern. CV inputs modulate all three pattern parameters; SYNC resets to step 1.',
  drum_machine:   '6-voice analog-modeled drum machine with Kick, Snare, Closed HH, Open HH, Clap, and Perc. Each voice has its own trigger input, per-voice audio output, and synthesis knobs. MIX outputs all voices summed.',
};
