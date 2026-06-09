import { useState, useEffect, useRef, memo } from 'react';
import { ModuleInstance, KnobDef, ModuleTypeDef, PortType, PendingCable, MidiMonitorData } from '../types';
import { MODULE_TYPE_MAP } from '../moduleDefinitions';
import Knob from './Knob';
import PortJack from './PortJack';
import ModuleInfoPopup from './ModuleInfoPopup';
import PolyStepPanel from './PolyStepPanel';

interface ModulePanelProps {
  module: ModuleInstance;
  connectedPorts: Set<string>;
  pendingCable: PendingCable | null;
  onPortClick: (moduleId: string, portId: string, type: PortType) => void;
  onPortDoubleClick: (moduleId: string, portId: string) => void;
  onPortHold: (moduleId: string, portId: string) => void;
  onParamChange: (moduleId: string, paramId: string, value: number) => void;
  onSelectorChange: (moduleId: string, selectorId: string, value: number) => void;
  onDragStart: (moduleId: string, e: React.MouseEvent) => void;
  onDelete: (moduleId: string) => void;
  onRegisterPortRef: (key: string, el: HTMLDivElement | null) => void;
  onKeyPress?: (moduleId: string, freq: number, on: boolean) => void;
  analyser?: AnalyserNode;
  midiMonitorData?: MidiMonitorData;
  isMidiTarget?: boolean;
  /** Polled at ~30 fps by custom displays (drum machine step, euclidean LED ring) */
  moduleStepRef?: { value: number };
  /** Returns 0–1 activity level; polled at ~60 fps for the indicator LED */
  getLevelFn?: () => number;
  /** Map of paramId → getLevel fn for knobs that have a live CV signal patched in */
  cvLevels?: Map<string, () => number>;
  /** Map of portId → getLevel fn for input ports that are receiving a signal */
  portLevels?: Map<string, () => number>;
  /** Sampler: called when user picks a file; bankIndex = currently selected bank */
  onLoadSample?: (file: File, bankIndex: number) => void;
  /** Sampler: which of the 8 banks have a sample loaded */
  samplerBanksFilled?: boolean[];
  /** MIDI Clock In module: current clock info from the DAW */
  midiClockInfo?: { bpm: number | null; deviceName: string | null; locked: boolean };
  /** MIDI Clock In module: toggle sync lock */
  onToggleMidiClockLock?: () => void;
  /** Freeze module: instantly kill the frozen loop */
  onFreezeKill?: () => void;
  /** Seq modules: reset step counter to 1 */
  onSeqReset?: () => void;
  /** Audio Trig: start capture with specific deviceId, or open browser picker when omitted */
  onAudioTrigPickDevice?: (deviceId?: string) => void;
  /** Audio Trig: getter polled to show the active capture device name */
  audioTrigGetDeviceLabel?: () => string;
  /** Audio Trig: getter polled to get available audio input devices */
  audioTrigGetDeviceList?: () => { deviceId: string; label: string }[];
  /** Build this module's example patch in the rack */
  onBuildPatch?: () => void;
}

function ActivityLED({ getLevelFn, color }: { getLevelFn: () => number; color: string }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  useEffect(() => {
    const tick = () => {
      if (dotRef.current) {
        const v = getLevelFn();
        dotRef.current.style.opacity = String(0.12 + v * 0.88);
        dotRef.current.style.boxShadow = v > 0.08 ? `0 0 ${Math.round(4 + v * 6)}px ${color}` : 'none';
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getLevelFn, color]);
  return (
    <div ref={dotRef} style={{
      width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
      background: color, opacity: 0.12,
    }} />
  );
}

// ─── MIDI Monitor display ─────────────────────────────────────────────────────
function MidiMonitorDisplay({ d }: { d: MidiMonitorData }) {
  const accent = '#22d3ee';
  const bar = (val: number, color: string, w = '100%') => (
    <div style={{ flex: 1, height: 5, background: '#111', borderRadius: 2, overflow: 'hidden', width: w }}>
      <div style={{ height: '100%', width: `${Math.round(val * 100)}%`, background: color, borderRadius: 2, transition: 'width 0.05s' }} />
    </div>
  );
  const bipolarBar = (val: number) => {
    const pct = Math.abs(val) * 50;
    const left = val < 0 ? 50 - pct : 50;
    return (
      <div style={{ flex: 1, height: 5, background: '#111', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: '50%', width: 1, height: '100%', background: '#333' }} />
        <div style={{
          position: 'absolute', top: 0, height: '100%',
          left: `${left}%`, width: `${pct}%`,
          background: accent, borderRadius: 2,
        }} />
      </div>
    );
  };
  const label = (text: string) => (
    <span style={{ fontSize: 6, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 24 }}>{text}</span>
  );
  const val = (text: string) => (
    <span style={{ fontSize: 7, color: '#9ca3af', fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'right' }}>{text}</span>
  );
  const row = (lbl: string, content: React.ReactNode, v: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {label(lbl)}{content}{val(v)}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '6px 8px', height: '100%' }}>
      {/* Gate + Note name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Gate LED */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: d.gate ? '#22c55e' : '#1a1a1a',
          boxShadow: d.gate ? '0 0 6px #22c55e' : 'none',
          border: `1px solid ${d.gate ? '#16a34a' : '#2a2a2a'}`,
          transition: 'all 0.05s',
        }} />
        {/* Note name — big */}
        <span style={{
          fontSize: 26, fontWeight: 700, color: d.gate ? accent : '#505050',
          letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          transition: 'color 0.1s', minWidth: 52,
        }}>
          {d.noteName === '---' ? '---' : d.noteName}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, marginLeft: 'auto' }}>
          <span style={{ fontSize: 6, color: '#777', textTransform: 'uppercase', letterSpacing: '0.1em' }}>MIDI</span>
          <span style={{ fontSize: 11, color: '#999', fontVariantNumeric: 'tabular-nums' }}>#{d.note.toString().padStart(3,'0')}</span>
          <span style={{ fontSize: 6, color: '#777', textTransform: 'uppercase', letterSpacing: '0.08em' }}>CH {d.channel.toString().padStart(2,'0')}</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #1e1e1e, transparent)' }} />

      {/* Velocity */}
      {row('VEL', bar(d.velocity / 127, '#22c55e'), String(d.velocity))}
      {/* Pitch bend */}
      {row('PIT', bipolarBar(d.pitchBend), (d.pitchBend >= 0 ? '+' : '') + (d.pitchBend * 100).toFixed(0) + '%')}
      {/* Mod wheel */}
      {row('MOD', bar(d.modWheel, '#a855f7'), (d.modWheel * 127).toFixed(0))}

      {/* Divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #1e1e1e, transparent)' }} />

      {/* Last CC */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label('CC')}
        <span style={{ fontSize: 8, color: d.lastCC ? '#7a8a9a' : '#555', fontVariantNumeric: 'tabular-nums', flex: 1 }}>
          {d.lastCC ? `#${d.lastCC.num.toString().padStart(3,'0')} = ${d.lastCC.val.toString().padStart(3,' ')}` : '— — —'}
        </span>
      </div>

      {/* Note count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label('NOTES')}
        <span style={{ fontSize: 8, color: '#777', fontVariantNumeric: 'tabular-nums' }}>
          {d.noteCount.toString().padStart(6, '0')}
        </span>
      </div>
    </div>
  );
}

// ─── Live VU meter ────────────────────────────────────────────────────────────
function OutputMeter({ analyser }: { analyser?: AnalyserNode }) {
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    let envL = 0;
    let envR = 0;

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      analyser.getFloatTimeDomainData(buf);

      // Compute RMS
      let sum = 0;
      for (const s of buf) sum += s * s;
      const rms = Math.sqrt(sum / buf.length);

      // Smooth: fast attack, slow decay
      const target = Math.min(rms * 3.5, 1);
      envL = target > envL ? target : envL * 0.88 + target * 0.12;
      envR = envL; // mono signal, mirror on both bars

      const pctL = Math.min(envL * 100, 100).toFixed(1) + '%';
      const pctR = pctL;
      if (leftRef.current)  leftRef.current.style.height  = pctL;
      if (rightRef.current) rightRef.current.style.height = pctR;
    };

    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  const track: React.CSSProperties = {
    width: 14, height: 80, background: '#0a0a0a',
    border: '1px solid #1e1e1e', borderRadius: 3,
    display: 'flex', flexDirection: 'column-reverse',
    overflow: 'hidden',
  };
  const fill: React.CSSProperties = {
    width: '100%', height: '0%',
    background: 'linear-gradient(to top, #16a34a 0%, #22c55e 50%, #fbbf24 78%, #ef4444 100%)',
    transition: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 5 }}>
        <div style={track}><div ref={leftRef}  style={fill} /></div>
        <div style={track}><div ref={rightRef} style={fill} /></div>
      </div>
      <span style={{ fontSize: 6, color: '#666', letterSpacing: '0.14em', textTransform: 'uppercase' }}>L &nbsp; R</span>
    </div>
  );
}

// ─── Euclidean LED ring display ───────────────────────────────────────────────
function EuclideanLedRing({ steps, fill, shift, currentStep }: {
  steps: number; fill: number; shift: number; currentStep: number;
}) {
  const n  = Math.max(2, Math.min(16, Math.round(steps)));
  const f  = Math.max(0, Math.min(n, Math.round(fill)));
  const sh = ((Math.round(shift) % n) + n) % n;

  // Bresenham euclidean distribution
  const pattern: boolean[] = [];
  let bucket = 0;
  for (let i = 0; i < n; i++) {
    bucket += f;
    if (bucket >= n) { bucket -= n; pattern.push(true); }
    else pattern.push(false);
  }
  const shifted = [...pattern.slice(sh), ...pattern.slice(0, sh)];

  const cx = 54, cy = 54, r = 42, dotR = 4.5;
  const accent = '#f59e0b';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <svg width={80} height={80} viewBox="0 0 108 108" style={{ display: 'block' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1c1c1c" strokeWidth={2} />
        {shifted.map((hit, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          const isCur = i === ((currentStep % n + n) % n);
          return (
            <circle key={i} cx={x} cy={y} r={dotR}
              fill={isCur ? '#fff' : hit ? accent : '#1e1e1e'}
              stroke={hit ? accent : '#2a2a2a'}
              strokeWidth={1}
              style={{ filter: (isCur || hit) ? `drop-shadow(0 0 3px ${accent})` : 'none' }}
            />
          );
        })}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={11} fill={accent}
          fontFamily="monospace" fontWeight="bold">{f}/{n}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize={6.5} fill="#444"
          fontFamily="monospace" letterSpacing="0.15em">EUCLID</text>
      </svg>
    </div>
  );
}

// ─── Drum voice synthesis panel ────────────────────────────────────────────────
const DRM_VOICES = [
  { id: 'kick', label: 'BASS DRUM', color: '#ef4444', params: ['kick_tune','kick_decay','kick_punch','kick_drive'], vol: 'kick_vol' },
  { id: 'snr',  label: 'SNARE',    color: '#f97316', params: ['snr_tune','snr_snap','snr_decay','snr_tone'],       vol: 'snr_vol'  },
  { id: 'hhc',  label: 'HH · CLS', color: '#eab308', params: ['hhc_tone','hhc_decay','hhc_body'],                  vol: 'hhc_vol'  },
  { id: 'hho',  label: 'HH · OPN', color: '#22c55e', params: ['hho_tone','hho_decay','hho_body'],                  vol: 'hho_vol'  },
  { id: 'clp',  label: 'CLAP',     color: '#60a5fa', params: ['clp_tune','clp_snap','clp_decay'],                  vol: 'clp_vol'  },
  { id: 'per',  label: 'PERC',     color: '#a78bfa', params: ['per_tune','per_decay','per_sweep'],                 vol: 'per_vol'  },
] as const;

function DrumVoicePanel({ module, knobDefs, onParamChange }: {
  module: ModuleInstance;
  knobDefs: KnobDef[];
  onParamChange: (moduleId: string, paramId: string, value: number) => void;
}) {
  const knobMap = new Map(knobDefs.map(k => [k.id, k]));

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      height: '100%',
      overflow: 'hidden',
    }}>
      {DRM_VOICES.map((voice, i) => (
        <div key={voice.id} style={{
          display: 'flex', flexDirection: 'column',
          borderRight: i < 5 ? '1px solid #222' : 'none',
          overflow: 'hidden',
        }}>
          {/* ─ Voice header ─ */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '4px 7px 3px',
            borderBottom: `1px solid ${voice.color}28`, flexShrink: 0,
            background: `${voice.color}0a`,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: voice.color, boxShadow: `0 0 4px ${voice.color}99`,
            }} />
            <span style={{
              fontSize: 6.5, color: voice.color, textTransform: 'uppercase',
              letterSpacing: '0.08em', fontWeight: 700, whiteSpace: 'nowrap',
            }}>{voice.label}</span>
          </div>

          {/* ─ Synthesis knobs ─ */}
          <div style={{
            flex: 1, display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', justifyContent: 'center',
            gap: 1, padding: '3px 3px 2px', overflow: 'hidden',
          }}>
            {voice.params.map(pid => {
              const def = knobMap.get(pid);
              if (!def) return null;
              return (
                <Knob
                  key={pid}
                  def={def}
                  value={module.params[pid] ?? def.default}
                  onChange={val => onParamChange(module.id, pid, val)}
                  size="sm"
                />
              );
            })}
          </div>

          {/* ─ Volume slider ─ */}
          <div style={{
            flexShrink: 0, padding: '2px 8px 5px',
            borderTop: '1px solid #1c1c1c',
            display: 'flex', flexDirection: 'column', gap: 1,
          }}>
            <span style={{
              fontSize: 5.5, color: '#888', textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>VOL</span>
            <input
              type="range" min={0} max={1} step={0.01}
              value={module.params[voice.vol] ?? 0.7}
              style={{ width: '100%', accentColor: voice.color, cursor: 'pointer' }}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => onParamChange(module.id, voice.vol, Number(e.target.value))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const PANEL_H = 300;
const RAIL_H = 28;

const NOTE_WHITES = [0, 2, 4, 5, 7, 9, 11];
const NOTE_BLACKS = [1, 3, -1, 6, 8, 10, -1];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function Screw() {
  return (
    <div style={{
      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
      background: 'radial-gradient(circle at 35% 30%, #c8c8c8, #5a5a5a 50%, #282828)',
      border: '1px solid #111',
      boxShadow: '0 1px 3px rgba(0,0,0,0.9), inset 0 0.5px 0 rgba(255,255,255,0.12)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="7" height="7" viewBox="0 0 7 7" style={{ opacity: 0.55 }}>
        <line x1="3.5" y1="0.8" x2="3.5" y2="6.2" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="0.8" y1="3.5" x2="6.2" y2="3.5" stroke="#111" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

/** Returns a short contextual hint for a port — what it carries or where it goes.
 *  Shown in a tiny second line below the port name so users know the signal role
 *  without it just repeating the name. */
function portHint(id: string, type: PortType): string {
  if (id === 'audio_in')        return 'sig in';
  if (id === 'audio_out')       return 'mixer';
  if (id === 'env_out')         return 'vca/flt';
  if (id === 'eoc_out')         return 'eoc';
  if (id === 'open_out')        return 'open';
  if (id === 'fm_in')           return 'fm';
  if (id === 'pwm_in')          return 'pwm';
  if (id === 'pitch_bend_out')  return 'p.bend';
  if (id === 'mod_wheel_out')   return 'm.wheel';
  if (id === 'freeze_in')       return 'frz';
  if (id.startsWith('voct'))    return 'pitch';
  if (id.includes('gate'))      return 'trig';
  if (id.includes('accent'))    return 'acc';
  if (id.includes('audio'))     return 'audio';
  if (id.includes('env'))       return 'env';
  if (id.match(/div\d/))        return 'clk÷';
  if (id.includes('cutoff'))    return 'cut cv';
  if (id.includes('res'))       return 'res';
  if (id.includes('sub'))       return 'sub';
  if (id.match(/saw|sq_|tri_|sin_/)) return 'wave';
  if (id.includes('lfo'))       return 'lfo';
  if (id.includes('noise'))     return 'nse';
  if (id.includes('mod'))       return 'mod';
  if (id.match(/cv_in|cv_out/)) return 'cv';
  switch (type) {
    case 'audio_in':  return 'sig in';
    case 'audio_out': return 'sig out';
    case 'cv_in':     return 'cv';
    case 'cv_out':    return 'cv';
    case 'gate_in':   return 'trig';
    case 'gate_out':  return 'trig';
  }
}

function PortWithLabel({
  moduleId, port, isConnected, isPendingSource, canConnect, onPortClick, onPortDoubleClick, onPortHold, onRegisterRef, getLevelFn,
}: {
  moduleId: string;
  port: { id: string; name: string; type: PortType };
  isConnected: boolean;
  isPendingSource: boolean;
  canConnect: boolean;
  onPortClick: (moduleId: string, portId: string, type: PortType) => void;
  onPortDoubleClick: (moduleId: string, portId: string) => void;
  onPortHold: (moduleId: string, portId: string) => void;
  onRegisterRef: (key: string, el: HTMLDivElement | null) => void;
  getLevelFn?: () => number;
}) {
  const hint = portHint(port.id, port.type);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, width: 28, flexShrink: 0 }}>
      <PortJack
        moduleId={moduleId}
        portDef={port}
        isConnected={isConnected}
        isPendingSource={isPendingSource}
        canConnect={canConnect}
        onPortClick={onPortClick}
        onPortDoubleClick={onPortDoubleClick}
        onPortHold={onPortHold}
        onRegisterRef={onRegisterRef}
        getInputLevel={getLevelFn}
      />
      {hint && (
        <span style={{
          fontSize: 6, color: '#606878', textTransform: 'uppercase',
          letterSpacing: '0.04em', lineHeight: 1, textAlign: 'center',
          maxWidth: 32, overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap',
        }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function PianoKeyboard({ octave, onKeyPress }: {
  octave: number;
  onKeyPress: (freq: number, on: boolean) => void;
}) {
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const octaveBase = octave * 12 + 12;
  const press = (semitone: number) => {
    const midi = octaveBase + semitone;
    setActiveNote(midi);
    onKeyPress(midiToHz(midi), true);
  };
  const release = () => { setActiveNote(null); onKeyPress(0, false); };
  return (
    <div className="relative w-full" style={{ height: 72, zIndex: 40 }}>
      <div className="flex h-full gap-px">
        {NOTE_WHITES.map((semitone, i) => {
          const midi = octaveBase + semitone;
          const active = activeNote === midi;
          return (
            <div key={i} className="flex-1 rounded-b cursor-pointer border border-gray-600 select-none"
              style={{ background: active ? '#d97706' : '#e5e7eb', boxShadow: active ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'none', transition: 'background 0.05s' }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); press(semitone); }}
              onMouseUp={(e) => { e.stopPropagation(); release(); }}
              onMouseLeave={() => { if (activeNote === midi) release(); }}
              data-testid={`piano-key-white-${NOTE_NAMES[semitone]}`}
            />
          );
        })}
      </div>
      <div className="absolute top-0 left-0 w-full flex pointer-events-none" style={{ height: 44 }}>
        {NOTE_BLACKS.map((semitone, i) => {
          if (semitone === -1) return <div key={i} className="flex-1" />;
          const midi = octaveBase + semitone;
          const active = activeNote === midi;
          const leftPct = (i + 1) * (100 / 7) - (100 / 7) / 2;
          return (
            <div key={i} className="absolute rounded-b cursor-pointer pointer-events-auto select-none"
              style={{ left: `${leftPct - 4}%`, width: '8%', height: '100%', background: active ? '#d97706' : '#111', border: '1px solid #000', zIndex: 10, boxShadow: active ? 'none' : '0 3px 4px rgba(0,0,0,0.5)', transition: 'background 0.05s' }}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); press(semitone); }}
              onMouseUp={(e) => { e.stopPropagation(); release(); }}
              onMouseLeave={() => { if (activeNote === midi) release(); }}
              data-testid={`piano-key-black-${NOTE_NAMES[semitone]}`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Sampler bank panel with REC capability ────────────────────────────────
function SamplerBankPanel({
  module, accent, samplerBanksFilled, onParamChange, onLoadSample, typeDef, onSelectorChange, cvLevels,
}: {
  module: ModuleInstance;
  accent: string;
  samplerBanksFilled?: boolean[];
  onParamChange: (moduleId: string, paramId: string, value: number) => void;
  onLoadSample?: (file: File, bankIndex: number) => void;
  typeDef: ModuleTypeDef;
  onSelectorChange: (moduleId: string, selId: string, value: number) => void;
  cvLevels?: Map<string, () => number>;
}) {
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const [recError, setRecError] = useState<string | null>(null);
  const mrRef    = useRef<MediaRecorder | null>(null);
  const chunks   = useRef<Blob[]>([]);
  const streamRef= useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    mrRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const startRec = async () => {
    setRecError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      chunks.current = [];
      const mr = new MediaRecorder(stream);
      mrRef.current = mr;
      mr.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        const file = new File([blob], `rec-bank${Math.round(module.params.bank ?? 0) + 1}.webm`, { type: 'audio/webm' });
        onLoadSample?.(file, Math.round(module.params.bank ?? 0));
        setRecording(false);
        setRecSecs(0);
      };
      mr.start();
      setRecording(true);
      setRecSecs(0);
      let s = 0;
      timerRef.current = setInterval(() => { s++; setRecSecs(s); }, 1000);
    } catch (err) {
      setRecError('Mic access denied');
      setRecording(false);
    }
  };

  const stopRec = () => { mrRef.current?.stop(); };

  const bankIndex = Math.round(module.params.bank ?? 0);

  return (
    <div style={{ flex: 1, padding: '2px 5px', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
      {/* Bank row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 6px', background: '#0e0e0e',
        borderRadius: 3, border: '1px solid #1c1c1c', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {Array.from({ length: 8 }, (_, i) => {
            const isSelected = bankIndex === i;
            const isFilled   = samplerBanksFilled?.[i] ?? false;
            return (
              <div
                key={i}
                onClick={() => onParamChange(module.id, 'bank', i)}
                onMouseDown={e => e.stopPropagation()}
                title={`Bank ${i + 1}${isFilled ? ' · loaded' : ' · empty'}`}
                style={{
                  width: 11, height: 11, borderRadius: '50%',
                  cursor: 'pointer', flexShrink: 0,
                  background: isSelected ? accent : isFilled ? `${accent}55` : '#1a1a1a',
                  border: `1px solid ${isSelected ? accent : isFilled ? `${accent}88` : '#2a2a2a'}`,
                  boxShadow: isSelected ? `0 0 6px ${accent}aa` : 'none',
                  transition: 'background 0.1s, box-shadow 0.1s',
                }}
              />
            );
          })}
        </div>
        {/* LOAD button */}
        <label
          style={{
            marginLeft: 'auto', padding: '2px 6px', fontSize: 7,
            borderRadius: 2, cursor: 'pointer', background: '#1c1c1c',
            color: accent, border: `1px solid ${accent}55`,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            flexShrink: 0, lineHeight: '14px', userSelect: 'none',
          }}
          onMouseDown={e => e.stopPropagation()}
          title={`Load into bank ${bankIndex + 1}`}
        >
          LOAD
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.flac,.ogg,.aiff"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (file && onLoadSample) { onLoadSample(file, bankIndex); e.target.value = ''; }
            }}
          />
        </label>
        {/* REC / STOP button */}
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={recording ? stopRec : startRec}
          title={recording ? 'Stop recording' : `Record mic into bank ${bankIndex + 1}`}
          style={{
            padding: '2px 6px', fontSize: 7, borderRadius: 2, cursor: 'pointer',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
            lineHeight: '14px', flexShrink: 0, userSelect: 'none',
            border: recording ? '1px solid #ef4444' : '1px solid #374151',
            background: recording ? '#ef4444' : '#1c1c1c',
            color: recording ? '#fff' : '#9ca3af',
            animation: recording ? 'recPulse 1s ease-in-out infinite' : 'none',
          }}
        >
          {recording ? `■ ${recSecs}s` : '● REC'}
        </button>
      </div>
      {recError && (
        <span style={{ fontSize: 6, color: '#ef4444', textAlign: 'center', letterSpacing: '0.1em' }}>{recError}</span>
      )}

      {/* Knobs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 4px', justifyContent: 'center' }}>
        {typeDef.knobs.map(knob => (
          <Knob
            key={knob.id}
            def={knob}
            value={module.params[knob.id] ?? knob.default}
            onChange={val => onParamChange(module.id, knob.id, val)}
            size="sm"
            cvGetLevel={cvLevels?.get(knob.id)}
          />
        ))}
      </div>

      {/* DIR + LOOP selectors */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        {(typeDef.selectors ?? []).map(sel => {
          const curVal = module.params[sel.id] ?? sel.default;
          return (
            <div key={sel.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 6, color: '#666', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{sel.name}</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {sel.options.map((opt, i) => (
                  <button
                    key={opt}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => onSelectorChange(module.id, sel.id, i)}
                    data-testid={`selector-${module.id}-${sel.id}-${opt}`}
                    style={{
                      padding: '2px 5px', fontSize: 7, borderRadius: 2, cursor: 'pointer',
                      background: Math.round(curVal) === i ? accent : '#1c1c1c',
                      color: Math.round(curVal) === i ? '#000' : '#666',
                      border: `1px solid ${Math.round(curVal) === i ? accent : '#282828'}`,
                    }}
                  >{opt}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ModulePanel({
  module, connectedPorts, pendingCable, onPortClick, onPortDoubleClick, onPortHold, onParamChange,
  onSelectorChange, onDragStart, onDelete, onRegisterPortRef, onKeyPress,
  analyser, midiMonitorData, isMidiTarget, moduleStepRef, getLevelFn, cvLevels, portLevels,
  onLoadSample, samplerBanksFilled,
  midiClockInfo, onToggleMidiClockLock,
  onFreezeKill,
  onSeqReset,
  onAudioTrigPickDevice, audioTrigGetDeviceLabel, audioTrigGetDeviceList,
  onBuildPatch,
}: ModulePanelProps) {
  const typeDef = MODULE_TYPE_MAP.get(module.typeId);
  const [showDelete, setShowDelete] = useState(false);
  const [showInfo,   setShowInfo]   = useState(false);
  const [infoAnchor, setInfoAnchor] = useState({ x: 0, y: 0 });
  const [noteOpen,   setNoteOpen]   = useState(true);
  const [eucStep,  setEucStep]  = useState(0);
  const [seqStep,  setSeqStep]  = useState(-1);
  const [audioTrigLabel, setAudioTrigLabel] = useState('—');
  const [audioTrigDevices, setAudioTrigDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [audioTrigSelectedId, setAudioTrigSelectedId] = useState('');

  useEffect(() => {
    if (module.typeId !== 'audio_trig' || !audioTrigGetDeviceLabel) return;
    const id = setInterval(() => setAudioTrigLabel(audioTrigGetDeviceLabel()), 800);
    return () => clearInterval(id);
  }, [module.typeId, audioTrigGetDeviceLabel]);

  useEffect(() => {
    if (module.typeId !== 'audio_trig' || !audioTrigGetDeviceList) return;
    const update = () => setAudioTrigDevices(audioTrigGetDeviceList());
    update();
    const id = setInterval(update, 1500);
    return () => clearInterval(id);
  }, [module.typeId, audioTrigGetDeviceList]);

  useEffect(() => {
    if (module.typeId !== 'euclidean_trig' || !moduleStepRef) return;
    const id = setInterval(() => setEucStep(moduleStepRef.value), 33);
    return () => clearInterval(id);
  }, [module.typeId, moduleStepRef]);

  const isSeqModule = ['seq_step', 'seq_trigger', 'seq_cv', 'seq_gate'].includes(module.typeId);

  useEffect(() => {
    if (!isSeqModule || !moduleStepRef) return;
    const id = setInterval(() => setSeqStep(moduleStepRef.value), 33);
    return () => clearInterval(id);
  }, [isSeqModule, moduleStepRef]);

  if (!typeDef) return null;

  const isOutput    = module.typeId === 'output';
  const isDrum      = module.typeId === 'drum_machine';
  const isEuc       = module.typeId === 'euclidean_trig';
  const isPolyStep  = module.typeId === 'poly_step';
  const isSampler   = module.typeId === 'sampler';
  const isMixer     = module.typeId === 'mixer';
  const panelH   = isPolyStep && !noteOpen ? PANEL_H : (typeDef.height ?? PANEL_H);
  const bodyH    = panelH - RAIL_H * 2;

  const canConnectPort = (portId: string, portType: PortType): boolean => {
    if (!pendingCable) return false;
    if (pendingCable.fromModuleId === module.id && pendingCable.fromPortId === portId) return false;
    const pendingIsOut = pendingCable.fromPortType.endsWith('_out');
    const thisIsOut    = portType.endsWith('_out');
    const thisIsIn     = portType.endsWith('_in');
    // Standard: pending from output → highlight compatible inputs
    if (pendingIsOut && thisIsIn) {
      const fromSignal = pendingCable.fromPortType.replace('_out', '');
      const toSignal   = portType.replace('_in', '');
      if (fromSignal === 'gate' && toSignal !== 'gate') return false;
      if (toSignal   === 'gate' && fromSignal !== 'gate') return false;
      return true;
    }
    // Reversed: pending from input → highlight compatible outputs
    if (!pendingIsOut && thisIsOut) {
      const pendingSignal = pendingCable.fromPortType.replace('_in', '');
      const thisSignal    = portType.replace('_out', '');
      if (pendingSignal === 'gate' && thisSignal !== 'gate') return false;
      if (thisSignal    === 'gate' && pendingSignal !== 'gate') return false;
      return true;
    }
    return false;
  };

  const inPorts = typeDef.ports.filter(p => p.type.endsWith('_in'));
  const outPorts = typeDef.ports.filter(p => p.type.endsWith('_out'));

  const portProps = (port: typeof typeDef.ports[0]) => ({
    moduleId: module.id,
    port,
    isConnected: connectedPorts.has(`${module.id}-${port.id}`),
    isPendingSource: pendingCable?.fromModuleId === module.id && pendingCable.fromPortId === port.id,
    canConnect: canConnectPort(port.id, port.type),
    onPortClick,
    onPortDoubleClick,
    onPortHold,
    onRegisterRef: onRegisterPortRef,
    getLevelFn: port.type.endsWith('_in') ? portLevels?.get(port.id) : undefined,
  });

  const accent = typeDef.accentColor;

  return (
    <div
      style={{ width: typeDef.width, height: panelH, display: 'flex', flexDirection: 'column', position: 'relative' }}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      data-testid={`module-${module.id}`}
    >
      {/* Top rail – drag handle */}
      <div
        style={{
          height: RAIL_H, flexShrink: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 5px',
          cursor: 'grab', position: 'relative', zIndex: 25,
          background: 'linear-gradient(180deg, #2c2c2c 0%, #1e1e1e 100%)',
          borderTop: `2px solid ${isMidiTarget ? '#22d3ee' : accent}`,
          borderBottom: '1px solid #0e0e0e',
          boxShadow: isMidiTarget ? '0 0 10px rgba(34,211,238,0.25), 0 2px 4px rgba(0,0,0,0.7)' : '0 2px 4px rgba(0,0,0,0.7)',
          userSelect: 'none',
          transition: 'border-top-color 0.15s, box-shadow 0.15s',
        }}
        onMouseDown={(e) => onDragStart(module.id, e)}
        onDoubleClick={e => e.preventDefault()}
      >
        <Screw />
        {getLevelFn && (
          <ActivityLED getLevelFn={getLevelFn} color={accent} />
        )}
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', color: accent,
          textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', flex: 1, textAlign: 'center', padding: '0 4px',
        }}>
          {typeDef.name}
        </span>
        {/* Grid collapse toggle — poly_step only */}
        {isPolyStep && (
          <button
            title={noteOpen ? 'Collapse grid' : 'Expand grid'}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setNoteOpen(v => !v); }}
            style={{
              width: 14, height: 14, fontSize: 9, lineHeight: 1,
              cursor: 'pointer', borderRadius: 2, padding: 0,
              border: `1px solid ${noteOpen ? accent : '#484848'}`,
              background: noteOpen ? `${accent}30` : '#252525',
              color: noteOpen ? accent : '#909090',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginRight: 2,
              transition: 'color 0.1s, background 0.1s, border-color 0.1s',
            }}
          >{noteOpen ? '▾' : '▸'}</button>
        )}
        {/* Info button — always visible */}
        <button
          style={{
            width: 14, height: 14, fontSize: 9, lineHeight: 1,
            cursor: 'pointer', borderRadius: 2, padding: 0,
            border: `1px solid ${showInfo ? accent : '#484848'}`,
            background: showInfo ? `${accent}30` : '#252525',
            color: showInfo ? accent : '#909090',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginRight: 2,
            transition: 'color 0.1s, background 0.1s, border-color 0.1s',
            boxShadow: showInfo ? `0 0 6px ${accent}44` : 'none',
          }}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setInfoAnchor({ x: rect.left, y: rect.bottom });
            setShowInfo(v => !v);
          }}
          onMouseEnter={e => {
            if (!showInfo) {
              const el = e.currentTarget as HTMLElement;
              el.style.color = '#ddd';
              el.style.borderColor = '#707070';
              el.style.background = '#333';
            }
          }}
          onMouseLeave={e => {
            if (!showInfo) {
              const el = e.currentTarget as HTMLElement;
              el.style.color = '#909090';
              el.style.borderColor = '#484848';
              el.style.background = '#252525';
            }
          }}
          title="Module info"
          data-testid={`info-module-${module.id}`}
        >ⓘ</button>
        {/* Fixed-width slot — always same size, ✕ appears inside on hover, no layout shift */}
        <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 3 }}>
          {showDelete && (
            <button
              style={{
                width: 14, height: 14, fontSize: 8, lineHeight: 1,
                cursor: 'pointer', border: '1px solid #3a3a3a', borderRadius: 2,
                background: 'none', color: '#555',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = '#ef4444';
                (e.currentTarget as HTMLElement).style.borderColor = '#ef4444';
                (e.currentTarget as HTMLElement).style.background = '#2a0000';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = '#555';
                (e.currentTarget as HTMLElement).style.borderColor = '#3a3a3a';
                (e.currentTarget as HTMLElement).style.background = 'none';
              }}
              onMouseDown={e => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onDelete(module.id); }}
              data-testid={`delete-module-${module.id}`}
            >✕</button>
          )}
        </div>
        <Screw />
      </div>

      {/* Panel body */}
      <div style={{
        height: bodyH, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, #171717 0%, #1a1a1a 100%)',
        borderLeft: '1px solid #242424',
        borderRight: '1px solid #242424',
      }}>
        {/* ── Drum machine: trigger input strip → voice panels → output strip ── */}
        {isDrum ? (
          <>
            {/* Trigger inputs (top) */}
            <div style={{ flexShrink: 0, padding: '5px 6px 4px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 3px' }}>
                {inPorts.map(port => (
                  <PortWithLabel key={port.id} {...portProps(port)} />
                ))}
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #2a2a2a, transparent)', margin: '4px 0 0' }} />
            </div>

            {/* Voice synthesis panels */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <DrumVoicePanel
                module={module}
                knobDefs={typeDef.knobs}
                onParamChange={onParamChange}
              />
            </div>

            {/* Individual + mix outputs (bottom) */}
            <div style={{ flexShrink: 0, padding: '3px 6px 6px' }}>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #2a2a2a, transparent)', margin: '0 0 4px' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 3px' }}>
                {outPorts.map(port => (
                  <PortWithLabel key={port.id} {...portProps(port)} />
                ))}
              </div>
            </div>
          </>
        ) : isPolyStep ? (
          <>
            {/* Input ports */}
            <div style={{ flexShrink: 0, padding: '5px 6px 4px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 3px' }}>
                {inPorts.map(port => <PortWithLabel key={port.id} {...portProps(port)} />)}
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #2a2a2a, transparent)', margin: '4px 0 0' }} />
            </div>

            {/* 8-track sequencer grid */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <PolyStepPanel
                module={module}
                knobDefs={typeDef.knobs}
                onParamChange={onParamChange}
                stepRef={moduleStepRef}
                noteOpen={noteOpen}
                cvLevels={cvLevels}
              />
            </div>

            {/* Output ports — all in one row */}
            <div style={{ flexShrink: 0, padding: '3px 6px 6px' }}>
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #2a2a2a, transparent)', margin: '0 0 4px' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 3px' }}>
                {outPorts.map(port => <PortWithLabel key={port.id} {...portProps(port)} />)}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Input ports */}
            {!isMixer && inPorts.length > 0 && (
              <div style={{ flexShrink: 0, padding: '7px 5px 4px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 3px' }}>
                  {inPorts.map(port => (
                    <PortWithLabel key={port.id} {...portProps(port)} />
                  ))}
                </div>
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #2a2a2a, transparent)', margin: '5px 0 0' }} />
              </div>
            )}

            {/* Controls */}
            {isSampler ? (
              /* ── Sampler: bank dots, load button, knobs, dir/loop selectors ── */
              <SamplerBankPanel
                module={module}
                accent={accent}
                samplerBanksFilled={samplerBanksFilled}
                onParamChange={onParamChange}
                onLoadSample={onLoadSample}
                typeDef={typeDef}
                onSelectorChange={onSelectorChange}
                cvLevels={cvLevels}
              />
            ) : isEuc ? (
              /* ── KNIGHT GATE: knobs+selector left, LED ring right ── */
              <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                {/* Left column: knobs + CLK DIV */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 4px', justifyContent: 'center' }}>
                    {typeDef.knobs.map(knob => (
                      <Knob
                        key={knob.id}
                        def={knob}
                        value={module.params[knob.id] ?? knob.default}
                        onChange={(val) => onParamChange(module.id, knob.id, val)}
                        size="sm"
                        cvGetLevel={cvLevels?.get(knob.id)}
                      />
                    ))}
                  </div>
                  {(typeDef.selectors ?? []).map(sel => {
                    const curVal = module.params[sel.id] ?? sel.default;
                    return (
                      <div key={sel.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 7, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{sel.name}</span>
                        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {sel.options.map((opt, i) => (
                            <button
                              key={opt}
                              style={{
                                padding: '2px 5px', fontSize: 7, borderRadius: 2, cursor: 'pointer',
                                background: Math.round(curVal) === i ? accent : '#1c1c1c',
                                color: Math.round(curVal) === i ? '#000' : '#888',
                                border: `1px solid ${Math.round(curVal) === i ? accent : '#282828'}`,
                              }}
                              onClick={() => onSelectorChange(module.id, sel.id, i)}
                              data-testid={`selector-${module.id}-${sel.id}-${opt}`}
                            >{opt}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right column: LED ring */}
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EuclideanLedRing
                    steps={module.params.steps ?? 8}
                    fill={module.params.fill ?? 4}
                    shift={module.params.shift ?? 0}
                    currentStep={eucStep}
                  />
                </div>
              </div>
            ) : (
              /* ── Standard controls ── */
              <div style={{ flex: 1, padding: '6px 5px', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                {!isMixer && typeDef.knobs.filter(k => !/^ch\d+_/.test(k.id)).length > 0 && (
                  isSeqModule ? (() => {
                    const stepKnobs = typeDef.knobs.filter(k => /^[stgv]\d+$/.test(k.id));
                    const ctrlKnobs = typeDef.knobs.filter(k => !/^[stgv]\d+$/.test(k.id));
                    return (
                      <>
                        {ctrlKnobs.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 4px', justifyContent: 'center', alignItems: 'center' }}>
                            {ctrlKnobs.map(knob => (
                              <Knob key={knob.id} def={knob}
                                value={module.params[knob.id] ?? knob.default}
                                onChange={val => onParamChange(module.id, knob.id, val)}
                                size="sm" cvGetLevel={cvLevels?.get(knob.id)} />
                            ))}
                            {onSeqReset && (
                              <button
                                onMouseDown={e => e.stopPropagation()}
                                onClick={onSeqReset}
                                title="Reset to step 1"
                                style={{
                                  height: 18, padding: '0 6px',
                                  fontSize: 7, fontFamily: 'monospace', fontWeight: 700,
                                  letterSpacing: '0.14em', textTransform: 'uppercase',
                                  borderRadius: 2, cursor: 'pointer',
                                  border: '1px solid #333',
                                  background: '#1a1a1a', color: '#888',
                                  flexShrink: 0,
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#e87d27'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#c96a1a'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#888'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#333'; }}
                              >
                                RST
                              </button>
                            )}
                          </div>
                        )}
                        {stepKnobs.length > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                            {stepKnobs.map((knob, idx) => {
                              const isLive    = idx === seqStep;
                              const isTrigStep = module.typeId === 'seq_trigger';
                              const stepOn     = isTrigStep && (module.params[knob.id] ?? knob.default) >= 0.5;
                              return (
                                <div key={knob.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                  {isTrigStep ? (
                                    <button
                                      onMouseDown={e => e.stopPropagation()}
                                      onClick={() => onParamChange(module.id, knob.id, stepOn ? 0 : 1)}
                                      style={{
                                        width: 22, height: 22, borderRadius: 3, cursor: 'pointer',
                                        background: stepOn ? accent : '#181818',
                                        border: `1px solid ${stepOn ? accent : '#333'}`,
                                        transition: 'background 0.08s, border-color 0.08s',
                                        boxShadow: stepOn ? `0 0 5px ${accent}88` : 'none',
                                        flexShrink: 0,
                                      }}
                                    />
                                  ) : (
                                    <Knob def={knob}
                                      value={module.params[knob.id] ?? knob.default}
                                      onChange={val => onParamChange(module.id, knob.id, val)}
                                      size="sm" cvGetLevel={cvLevels?.get(knob.id)} />
                                  )}
                                  <div style={{
                                    width: 5, height: 5, borderRadius: '50%',
                                    background: isLive ? '#e2e2e2' : '#222',
                                    boxShadow: isLive ? '0 0 6px #fff, 0 0 10px #aaa' : 'none',
                                    transition: 'background 0.04s, box-shadow 0.04s',
                                  }} />
                                  {isTrigStep && (
                                    <span style={{ fontSize: 6, color: '#555', letterSpacing: '0.06em', lineHeight: 1 }}>
                                      {idx + 1}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })() : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 4px', justifyContent: 'center' }}>
                    {typeDef.knobs.filter(k => !/^ch\d+_/.test(k.id)).map(knob => (
                      <Knob
                        key={knob.id}
                        def={knob}
                        value={module.params[knob.id] ?? knob.default}
                        onChange={(val) => onParamChange(module.id, knob.id, val)}
                        size="sm"
                        cvGetLevel={cvLevels?.get(knob.id)}
                      />
                    ))}
                  </div>
                  )
                )}

                {(typeDef.selectors ?? []).map(sel => {
                  const curVal = module.params[sel.id] ?? sel.default;
                  return (
                    <div key={sel.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 7, color: '#484848', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{sel.name}</span>
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {sel.options.map((opt, i) => (
                          <button
                            key={opt}
                            style={{
                              padding: '2px 5px', fontSize: 7, borderRadius: 2, cursor: 'pointer',
                              background: Math.round(curVal) === i ? accent : '#1c1c1c',
                              color: Math.round(curVal) === i ? '#000' : '#4a4a4a',
                              border: `1px solid ${Math.round(curVal) === i ? accent : '#282828'}`,
                            }}
                            onClick={() => onSelectorChange(module.id, sel.id, i)}
                            data-testid={`selector-${module.id}-${sel.id}-${opt}`}
                          >{opt}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {module.typeId === 'freeze_proc' && onFreezeKill && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
                    <button
                      onClick={onFreezeKill}
                      style={{
                        padding: '3px 12px', fontSize: 8, borderRadius: 2, cursor: 'pointer',
                        background: '#7f1d1d', color: '#fca5a5',
                        border: '1px solid #991b1b',
                        letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#991b1b')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#7f1d1d')}
                    >KILL</button>
                  </div>
                )}

                {module.typeId === 'audio_trig' && (() => {
                  const NUM_STRIPS = 8;
                  return (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                      {/* Channel strips */}
                      <div style={{ display: 'flex', gap: 2 }}>
                        {Array.from({ length: NUM_STRIPS }, (_, i) => {
                          const n = i + 1;
                          const onId     = `ch${n}_on`;
                          const gainId   = `ch${n}_gain`;
                          const threshId = `ch${n}_thresh`;
                          const retrigId = `ch${n}_retrig`;
                          const onDef     = typeDef.knobs.find(k => k.id === onId)!;
                          const gainDef   = typeDef.knobs.find(k => k.id === gainId)!;
                          const threshDef = typeDef.knobs.find(k => k.id === threshId)!;
                          const retrigDef = typeDef.knobs.find(k => k.id === retrigId)!;
                          const gatePort  = outPorts.find(p => p.id === `gate${n}_out`);
                          const isOn = (module.params[onId] ?? onDef?.default ?? 0) >= 0.5;
                          return (
                            <div key={n} style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                              padding: '3px 2px',
                              background: isOn ? '#181818' : '#111',
                              border: `1px solid ${isOn ? '#303030' : '#1c1c1c'}`,
                              borderRadius: 3,
                              minWidth: 40,
                            }}>
                              <button
                                onClick={() => onParamChange(module.id, onId, isOn ? 0 : 1)}
                                style={{
                                  padding: '1px 4px', fontSize: 7, borderRadius: 2, cursor: 'pointer',
                                  background: isOn ? accent : '#1c1c1c',
                                  color: isOn ? '#000' : '#444',
                                  border: `1px solid ${isOn ? accent : '#2a2a2a'}`,
                                  fontWeight: 700, letterSpacing: '0.05em', width: '100%',
                                }}
                              >CH{n}</button>
                              {gainDef && <Knob def={gainDef} value={module.params[gainId] ?? gainDef.default}
                                onChange={v => onParamChange(module.id, gainId, v)} size="sm" />}
                              {threshDef && <Knob def={threshDef} value={module.params[threshId] ?? threshDef.default}
                                onChange={v => onParamChange(module.id, threshId, v)} size="sm" />}
                              {retrigDef && <Knob def={retrigDef} value={module.params[retrigId] ?? retrigDef.default}
                                onChange={v => onParamChange(module.id, retrigId, v)} size="sm" />}
                              {gatePort && <PortWithLabel {...portProps(gatePort)} />}
                            </div>
                          );
                        })}
                      </div>

                      {/* Device panel — right side */}
                      <div style={{
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5,
                        padding: '4px 5px', background: '#0e0e0e',
                        border: '1px solid #1e1e1e', borderRadius: 3, minWidth: 64,
                      }}>
                        <span style={{ fontSize: 6, color: '#484848', textTransform: 'uppercase', letterSpacing: '0.12em', textAlign: 'center' }}>SOURCE</span>
                        {audioTrigDevices.length > 0 && (
                          <select
                            value={audioTrigSelectedId}
                            onMouseDown={e => e.stopPropagation()}
                            onChange={e => {
                              setAudioTrigSelectedId(e.target.value);
                              onAudioTrigPickDevice?.(e.target.value || undefined);
                            }}
                            style={{
                              width: '100%', padding: '2px 3px', fontSize: 6,
                              background: '#141414', color: '#94a3b8',
                              border: '1px solid #2a2a2a', borderRadius: 2,
                              cursor: 'pointer', outline: 'none',
                            }}
                          >
                            <option value="">— active —</option>
                            {audioTrigDevices.map(d => (
                              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                            ))}
                          </select>
                        )}
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => onAudioTrigPickDevice?.()}
                          style={{
                            width: '100%', padding: '3px 4px', fontSize: 6, borderRadius: 2, cursor: 'pointer',
                            background: '#1a1a1a', color: '#94a3b8', border: '1px solid #2e2e2e',
                            letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#252525')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}
                        >{audioTrigDevices.length > 0 ? 'REPICK' : 'PICK'}</button>
                        {/* Status label — colour-coded so failures are obvious */}
                        {(() => {
                          const isErr  = /denied|error|not available/i.test(audioTrigLabel);
                          const isOk   = audioTrigDevices.length > 0 && !isErr;
                          const isPend = /requesting/i.test(audioTrigLabel);
                          const color  = isErr ? '#f87171' : isOk ? '#4ade80' : isPend ? '#fbbf24' : '#555';
                          return (
                            <div style={{
                              fontSize: 7, color, letterSpacing: '0.03em', textAlign: 'center',
                              wordBreak: 'break-word', lineHeight: 1.3,
                            }}>{audioTrigLabel || '—'}</div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })()}

                {isMixer && (() => {
                  const NUM_CH = 6;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
                        {Array.from({ length: NUM_CH }, (_, i) => {
                          const n = i + 1;
                          const gainId = `ch${n}`;
                          const hiId   = `ch${n}_hi`;
                          const midId  = `ch${n}_mid`;
                          const loId   = `ch${n}_lo`;
                          const gainDef = typeDef.knobs.find(k => k.id === gainId);
                          const hiDef   = typeDef.knobs.find(k => k.id === hiId);
                          const midDef  = typeDef.knobs.find(k => k.id === midId);
                          const loDef   = typeDef.knobs.find(k => k.id === loId);
                          const inPort  = inPorts.find(p => p.id === `in${n}`);
                          return (
                            <div key={n} style={{
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                              padding: '2px 1px 4px', background: '#181818',
                              border: '1px solid #282828', borderRadius: 3, flex: 1, minWidth: 0,
                            }}>
                              <span style={{ fontSize: 6, color: accent, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0 }}>CH{n}</span>
                              {gainDef && <Knob def={gainDef} value={module.params[gainId] ?? gainDef.default}
                                onChange={v => onParamChange(module.id, gainId, v)} size="sm" />}
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, flexShrink: 0 }}>
                                {hiDef && (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                                    <span style={{ fontSize: 5, color: '#555', lineHeight: 1, marginBottom: 1 }}>H</span>
                                    <Knob def={hiDef} value={module.params[hiId] ?? hiDef.default}
                                      onChange={v => onParamChange(module.id, hiId, v)} size="xs" noLabel />
                                  </div>
                                )}
                                {midDef && (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                                    <span style={{ fontSize: 5, color: '#555', lineHeight: 1, marginBottom: 1 }}>M</span>
                                    <Knob def={midDef} value={module.params[midId] ?? midDef.default}
                                      onChange={v => onParamChange(module.id, midId, v)} size="xs" noLabel />
                                  </div>
                                )}
                                {loDef && (
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                                    <span style={{ fontSize: 5, color: '#555', lineHeight: 1, marginBottom: 1 }}>L</span>
                                    <Knob def={loDef} value={module.params[loId] ?? loDef.default}
                                      onChange={v => onParamChange(module.id, loId, v)} size="xs" noLabel />
                                  </div>
                                )}
                              </div>
                              {inPort && <div style={{ marginTop: 'auto' }}><PortWithLabel {...portProps(inPort)} /></div>}
                            </div>
                          );
                        })}
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #2a2a2a, transparent)', margin: '3px 0 3px' }} />
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                          {outPorts.map(port => <PortWithLabel key={port.id} {...portProps(port)} />)}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {isOutput && <OutputMeter analyser={analyser} />}
                {module.typeId === 'midi_monitor' && midiMonitorData && (
                  <MidiMonitorDisplay d={midiMonitorData} />
                )}
                {module.typeId === 'midi_clock_in' && midiClockInfo && (() => {
                  const { bpm, deviceName, locked } = midiClockInfo;
                  const CLK_AMBER = '#f59e0b';
                  const CLK_GREEN = '#22c55e';
                  const hasSignal = bpm !== null;
                  return (
                    <div style={{ padding: '10px 10px 6px', fontFamily: 'monospace' }}>
                      {/* BPM display */}
                      <div style={{
                        background: '#0a0a0a', border: '1px solid #2a2a2a',
                        borderRadius: 4, padding: '8px 10px', marginBottom: 8,
                        textAlign: 'center',
                      }}>
                        <div style={{
                          fontSize: 28, fontWeight: 700, letterSpacing: '0.05em',
                          color: hasSignal ? (locked ? CLK_GREEN : CLK_AMBER) : '#333',
                          lineHeight: 1,
                          textShadow: hasSignal ? `0 0 12px ${locked ? CLK_GREEN : CLK_AMBER}66` : 'none',
                          transition: 'color 0.2s, text-shadow 0.2s',
                        }}>
                          {hasSignal ? bpm!.toFixed(1) : '---.-'}
                        </div>
                        <div style={{ fontSize: 7, color: '#555', letterSpacing: '0.2em', marginTop: 3 }}>
                          BPM
                        </div>
                      </div>

                      {/* Device name */}
                      <div style={{
                        fontSize: 7, color: '#666', letterSpacing: '0.08em',
                        textTransform: 'uppercase', marginBottom: 8,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textAlign: 'center',
                      }}>
                        {deviceName ?? (hasSignal ? 'Unknown Device' : 'No clock received')}
                      </div>

                      {/* Lock toggle */}
                      <button
                        onClick={onToggleMidiClockLock}
                        style={{
                          width: '100%', padding: '5px 0',
                          background: locked ? `${CLK_GREEN}22` : '#111',
                          border: `1px solid ${locked ? CLK_GREEN : '#333'}`,
                          borderRadius: 4, cursor: 'pointer',
                          color: locked ? CLK_GREEN : '#666',
                          fontSize: 8, fontFamily: 'monospace',
                          fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
                          transition: 'all 0.15s',
                          boxShadow: locked ? `0 0 8px ${CLK_GREEN}44` : 'none',
                        }}
                        onMouseEnter={e => { if (!locked) (e.currentTarget as HTMLElement).style.borderColor = '#555'; }}
                        onMouseLeave={e => { if (!locked) (e.currentTarget as HTMLElement).style.borderColor = '#333'; }}
                      >
                        {locked ? '⏵ LOCKED' : 'LOCK TO DAW'}
                      </button>

                      {locked && (
                        <div style={{
                          marginTop: 6, fontSize: 7, color: CLK_GREEN,
                          textAlign: 'center', letterSpacing: '0.08em',
                          opacity: 0.8,
                        }}>
                          All clock BPMs synced
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Output ports — hidden for audio_trig (ports rendered inside each strip) */}
            {outPorts.length > 0 && module.typeId !== 'audio_trig' && module.typeId !== 'mixer' && (
              <div style={{ flexShrink: 0, padding: '4px 5px 7px' }}>
                <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #2a2a2a, transparent)', margin: '0 0 5px' }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 3px' }}>
                  {outPorts.map(port => (
                    <PortWithLabel key={port.id} {...portProps(port)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom rail */}
      <div style={{
        height: RAIL_H, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 5px',
        background: 'linear-gradient(180deg, #1e1e1e 0%, #2a2a2a 100%)',
        borderTop: '1px solid #0e0e0e',
        borderBottom: '2px solid #0a0a0a',
      }}>
        <Screw />
        <Screw />
      </div>

      {/* Module info popup */}
      {showInfo && (
        <ModuleInfoPopup
          typeDef={typeDef}
          anchor={infoAnchor}
          onClose={() => setShowInfo(false)}
          onBuildPatch={onBuildPatch}
        />
      )}
    </div>
  );
}

export default memo(ModulePanel);
