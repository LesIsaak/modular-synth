import { useState } from 'react';
import { MODULE_TYPES, CATEGORY_LABELS, CATEGORY_COLORS } from '../moduleDefinitions';
import { PortType } from '../types';

// ─── Per-port descriptions ────────────────────────────────────────────────────
const PORT_DESC: Record<string, string> = {
  // ── Pitch / gate ──
  voct:            '1V/oct from keyboard or sequencer',
  voct_in:         '1V/oct from keyboard or sequencer',
  voct_out:        'Pitch CV — patch to oscillator V/OCT',
  gate_in:         'Trigger from keyboard, clock or sequencer',
  gate_out:        'Trigger out — fires every active step/beat',
  accent_out:      'Fires on accented steps',
  eoc_out:         'Fires at the end of the release stage',
  open_out:        'High while noise gate is open',

  // ── Audio ──
  audio_in:        'Audio signal in',
  out:             'Main audio out — to mixer or next module',
  audio_out:       'Audio out',
  saw_out:         'Sawtooth waveform',
  sqr_out:         'Square waveform',
  tri_out:         'Triangle waveform',
  sin_out:         'Sine waveform',
  out_lp:          'Low-pass filtered output',
  out_hp:          'High-pass filtered output',
  out_bp:          'Band-pass filtered output',
  out_notch:       'Notch filtered output',
  carrier_in:      'Carrier signal for ring modulation',
  carrier:         'Carrier — provides the tonal voice',
  modulator:       'Modulator — provides spectral envelope',
  sc_in:           'Sidechain — triggers dynamics from a separate signal',

  // ── Oscillator CVs ──
  pw_cv:           'Pulse width CV — modulate square duty cycle',
  pwm_in:          'Pulse width mod at audio rate',
  sync_in:         'Hard sync — resets phase for punchy attacks',
  fm_in:           'Audio-rate FM on the filter cutoff',
  mod_in:          'FM modulator audio input',
  index_cv:        'FM index CV — modulation depth',
  ratio_cv:        'FM ratio CV — modulator:carrier ratio',
  h1_cv:           'Harmonic 1 level CV',
  h2_cv:           'Harmonic 2 level CV',
  h3_cv:           'Harmonic 3 level CV',
  h4_cv:           'Harmonic 4 level CV',
  spread_cv:       'Chord spread CV — widen / narrow voicing',
  morph_in:        'Wavetable morph position CV',
  level_cv:        'Level / volume CV',

  // ── Filter CVs ──
  cutoff_cv:       'Filter cutoff CV — from envelope or LFO',
  res_cv:          'Resonance CV — modulate Q / self-oscillation',
  morph_cv:        'Morph CV — sweep LP → BP → HP → Notch',
  vowel_cv:        'Vowel CV — sweep A→E→I→O→U formants',
  freq_cv:         'Frequency CV — comb filter pitch or carrier',

  // ── Envelope ──
  attack_cv:       'Attack time CV',
  decay_cv:        'Decay time CV',
  release_cv:      'Release time CV',
  retrig_in:       'Retrigger — restart without waiting for release',
  env_out:         'Envelope CV — patch to VCA or filter cutoff',

  // ── LFO / mod ──
  rate_cv:         'Rate CV — speed up / slow down',
  depth_cv:        'Depth CV — modulate output amplitude',
  reset_in:        'Reset gate — restart LFO or sequencer to step 1',
  cv_out:          'CV / LFO output signal',

  // ── Dynamics ──
  threshold_cv:    'Threshold CV — modulate dynamics threshold',
  gr_out:          'Gain reduction CV — how much is being compressed',

  // ── Sequencer / clock ──
  clock_in:        'Clock gate — advances sequencer steps',
  reset_in_seq:    'Reset gate — jump to step 1',
  tempo_cv:        'Tempo CV — modulate BPM externally',
  clk_in:          'Clock gate input',
  rst_in:          'Reset gate — jump to step 1',
  div2_out:        'Clock ÷2 — half tempo',
  div4_out:        'Clock ÷4 — quarter tempo',
  div8_out:        'Clock ÷8 — eighth tempo',
  steps_cv:        'Steps CV — modulate step count',
  fill_cv:         'Fill CV — modulate active trigger count',
  shift_cv:        'Shift CV — rotate pattern',
  sync:            'Sync gate — reset euclidean pattern phase',
  inv_out:         'Inverted gate — high when main gate is low',
  clk_out:         'Clock passthrough',
  pos_cv:          'Playback / step position as CV',
  step_cv:         'Current step number as CV',

  // ── Delay / reverb CVs ──
  time_cv:         'Delay time CV — modulate echo length',
  feedback_cv:     'Feedback CV — modulate repeat count',
  drive_cv:        'Drive CV — modulate saturation level',
  size_cv:         'Room/reverb size CV',
  speed_cv:        'Speed CV — time-stretch or rotary speed',
  flutter_cv:      'Flutter CV — tape wow / flutter amount',
  tension_cv:      'Spring tension CV',
  shimmer_cv:      'Shimmer CV — pitch-shifted reverb feedback',
  tap1_cv:         'Tap 1 delay time CV',
  tap2_cv:         'Tap 2 delay time CV',
  tap3_cv:         'Tap 3 delay time CV',

  // ── Spectral / granular ──
  shift_cv_pitch:  'Pitch shift CV — semitones',
  tilt_cv:         'Spectral tilt CV',
  q_cv:            'Q / resonance CV',
  grain_cv:        'Grain size CV',
  density_cv:      'Density CV — grains per second',
  pitch_cv:        'Pitch CV — modulate playback pitch',
  start_cv:        'Sample start point CV',
  length_cv:       'Playback length CV',
  bank_cv:         'Sample bank select CV',
  freeze_in:       'Freeze gate — hold current audio buffer',

  // ── Distortion CVs ──
  fuzz_cv:         'Fuzz amount CV',
  fold_cv:         'Fold intensity CV',
  bits_cv:         'Bit depth CV — lower = crunchier',
  factor_cv:       'Sample-rate reduction CV',

  // ── Keyboard / utility ──
  pitch_out:       'Pitch bend CV — from mod wheel / pitch strip',
  mod_out:         'Mod wheel CV',
  cv_in:           'CV input — amplitude control',
  offset_cv:       'Offset CV — add DC bias',
  in1: 'Channel 1 audio', in2: 'Channel 2 audio', in3: 'Channel 3 audio',
  in4: 'Channel 4 audio', in5: 'Channel 5 audio', in6: 'Channel 6 audio',
  in_l:            'Left channel — to speakers / headphones',
  in_r:            'Right channel — to speakers / headphones',
  vol_cv:          'Master volume CV',

  // ── Drum machine ──
  kick_trig:       'Kick drum trigger in',
  snr_trig:        'Snare trigger in',
  hhc_trig:        'Closed hi-hat trigger in',
  hho_trig:        'Open hi-hat trigger in',
  clp_trig:        'Clap trigger in',
  per_trig:        'Percussion trigger in',
  kick_out:        'Kick drum audio out',
  snr_out:         'Snare audio out',
  hhc_out:         'Closed hi-hat audio out',
  hho_out:         'Open hi-hat audio out',
  clp_out:         'Clap audio out',
  per_out:         'Percussion audio out',
};

function descFor(portId: string): string {
  return PORT_DESC[portId] ?? '';
}

const TYPE_DOT: Record<PortType, string> = {
  audio_in:  '#fbbf24',
  audio_out: '#fbbf24',
  cv_in:     '#a78bfa',
  cv_out:    '#a78bfa',
  gate_in:   '#86efac',
  gate_out:  '#86efac',
};

const TYPE_LABEL: Record<PortType, string> = {
  audio_in:  'audio',
  audio_out: 'audio',
  cv_in:     'cv',
  cv_out:    'cv',
  gate_in:   'gate',
  gate_out:  'gate',
};

interface Props { onClose: () => void }

export default function IORefPanel({ onClose }: Props) {
  const [search, setSearch] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  const q = search.toLowerCase().trim();

  // Group modules by category, filter by search
  const byCat = new Map<string, typeof MODULE_TYPES>();
  for (const m of MODULE_TYPES) {
    if (!m.ports.length) continue;
    if (q && !m.name.toLowerCase().includes(q) &&
        !m.ports.some(p => p.name.toLowerCase().includes(q) || descFor(p.id).toLowerCase().includes(q))) continue;
    const list = byCat.get(m.category) ?? [];
    list.push(m);
    byCat.set(m.category, list);
  }

  const toggle = (cat: string) =>
    setOpenCats(s => { const n = new Set(s); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });

  return (
    <div
      style={{
        position: 'absolute', bottom: '100%', right: 0, marginBottom: 6,
        width: 540, maxHeight: 520,
        background: '#0e0e0e', border: '1px solid #252525', borderRadius: 6,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        zIndex: 200,
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px 6px', borderBottom: '1px solid #1c1c1c', flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, letterSpacing: '0.18em', color: '#555', textTransform: 'uppercase' }}>
          Module I/O Reference
        </span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Legend */}
          {([['audio','#fbbf24'],['cv','#a78bfa'],['gate','#86efac']] as const).map(([lbl, col]) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: col }} />
              <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.08em' }}>{lbl}</span>
            </div>
          ))}
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, padding: 0,
          }}>✕</button>
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '6px 12px 5px', borderBottom: '1px solid #161616', flexShrink: 0 }}>
        <input
          type="text" placeholder="Search module or port…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', background: '#151515', border: '1px solid #282828', borderRadius: 3,
            color: '#9ca3af', fontSize: 11, padding: '4px 8px', outline: 'none',
            letterSpacing: '0.04em',
          }}
        />
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 8px' }}>
        {[...byCat.entries()].map(([cat, modules]) => {
          const catColor = CATEGORY_COLORS[cat] ?? '#555';
          const isOpen = openCats.has(cat) || q.length > 0;
          return (
            <div key={cat}>
              {/* Category header */}
              <div
                onClick={() => toggle(cat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', cursor: 'pointer',
                  background: '#111', borderBottom: '1px solid #1a1a1a',
                  userSelect: 'none',
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: catColor, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: catColor, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, flex: 1 }}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </span>
                <span style={{ fontSize: 10, color: '#333' }}>{isOpen ? '▴' : '▾'}</span>
              </div>

              {/* Module rows */}
              {isOpen && modules.map(mod => {
                const ins  = mod.ports.filter(p => p.type.endsWith('_in'));
                const outs = mod.ports.filter(p => p.type.endsWith('_out'));
                return (
                  <div key={mod.id} style={{
                    borderBottom: '1px solid #141414',
                    padding: '5px 12px 6px 18px',
                  }}>
                    <span style={{ fontSize: 10, color: '#8a9ab0', letterSpacing: '0.1em', fontWeight: 700 }}>
                      {mod.name}
                    </span>
                    <div style={{ display: 'flex', gap: 16, marginTop: 5 }}>
                      {/* Inputs */}
                      {ins.length > 0 && (
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 8, color: '#3a3a3a', letterSpacing: '0.14em', textTransform: 'uppercase' }}>IN</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 3 }}>
                            {ins.map(p => (
                              <PortRow key={p.id} port={p} desc={descFor(p.id)} />
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Outputs */}
                      {outs.length > 0 && (
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 8, color: '#3a3a3a', letterSpacing: '0.14em', textTransform: 'uppercase' }}>OUT</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 3 }}>
                            {outs.map(p => (
                              <PortRow key={p.id} port={p} desc={descFor(p.id)} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {byCat.size === 0 && (
          <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 11, color: '#333', letterSpacing: '0.1em' }}>
            No results
          </div>
        )}
      </div>
    </div>
  );
}

function PortRow({ port, desc }: { port: { id: string; name: string; type: PortType }; desc: string }) {
  const dot = TYPE_DOT[port.type];
  const typeLabel = TYPE_LABEL[port.type];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, minWidth: 72,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 9, color: dot, letterSpacing: '0.05em', fontWeight: 600 }}>{port.name}</span>
        <span style={{ fontSize: 7, color: '#2e2e2e', letterSpacing: '0.06em' }}>{typeLabel}</span>
      </div>
      <span style={{ fontSize: 9, color: '#4a5568', letterSpacing: '0.02em', lineHeight: 1.35 }}>
        {desc || '—'}
      </span>
    </div>
  );
}
