import { useState, useEffect, useRef } from 'react';
import { ModuleInstance, PortType, PendingCable, MidiMonitorData } from '../types';
import { MODULE_TYPE_MAP } from '../moduleDefinitions';
import Knob from './Knob';
import PortJack from './PortJack';

interface ModulePanelProps {
  module: ModuleInstance;
  connectedPorts: Set<string>;
  pendingCable: PendingCable | null;
  onPortClick: (moduleId: string, portId: string, type: PortType) => void;
  onPortDoubleClick: (moduleId: string, portId: string) => void;
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
    <span style={{ fontSize: 6, color: '#4a4a4a', letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 24 }}>{text}</span>
  );
  const val = (text: string) => (
    <span style={{ fontSize: 7, color: '#6b7280', fontVariantNumeric: 'tabular-nums', minWidth: 22, textAlign: 'right' }}>{text}</span>
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
          fontSize: 26, fontWeight: 700, color: d.gate ? accent : '#2a2a2a',
          letterSpacing: '-0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
          transition: 'color 0.1s', minWidth: 52,
        }}>
          {d.noteName === '---' ? '---' : d.noteName}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, marginLeft: 'auto' }}>
          <span style={{ fontSize: 6, color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em' }}>MIDI</span>
          <span style={{ fontSize: 11, color: '#4a4a4a', fontVariantNumeric: 'tabular-nums' }}>#{d.note.toString().padStart(3,'0')}</span>
          <span style={{ fontSize: 6, color: '#333', textTransform: 'uppercase', letterSpacing: '0.08em' }}>CH {d.channel.toString().padStart(2,'0')}</span>
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
        <span style={{ fontSize: 8, color: d.lastCC ? '#4a5568' : '#222', fontVariantNumeric: 'tabular-nums', flex: 1 }}>
          {d.lastCC ? `#${d.lastCC.num.toString().padStart(3,'0')} = ${d.lastCC.val.toString().padStart(3,' ')}` : '— — —'}
        </span>
      </div>

      {/* Note count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label('NOTES')}
        <span style={{ fontSize: 8, color: '#333', fontVariantNumeric: 'tabular-nums' }}>
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
      <span style={{ fontSize: 6, color: '#2a2a2a', letterSpacing: '0.14em', textTransform: 'uppercase' }}>L &nbsp; R</span>
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
      <svg width={108} height={108} viewBox="0 0 108 108" style={{ display: 'block' }}>
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

// ─── Drum Machine step grid ────────────────────────────────────────────────────
const DRM_CHANS = [
  { id: 'kick', label: 'KICK', patKey: 'kick_pat', volKey: 'kick_vol', color: '#ef4444' },
  { id: 'snr',  label: 'SNRE', patKey: 'snr_pat',  volKey: 'snr_vol',  color: '#f97316' },
  { id: 'hhc',  label: 'HH·C', patKey: 'hhc_pat',  volKey: 'hhc_vol',  color: '#eab308' },
  { id: 'hho',  label: 'HH·O', patKey: 'hho_pat',  volKey: 'hho_vol',  color: '#22c55e' },
  { id: 'clp',  label: 'CLAP', patKey: 'clp_pat',  volKey: 'clp_vol',  color: '#60a5fa' },
  { id: 'per',  label: 'PERC', patKey: 'per_pat',  volKey: 'per_vol',  color: '#a78bfa' },
] as const;

function DrumMachineGrid({
  module, onParamChange, onSelectorChange, stepRef,
}: {
  module: ModuleInstance;
  onParamChange: (moduleId: string, paramId: string, value: number) => void;
  onSelectorChange: (moduleId: string, selectorId: string, value: number) => void;
  stepRef?: { value: number };
}) {
  const [displayStep, setDisplayStep] = useState(-1);
  useEffect(() => {
    if (!stepRef) return;
    const id = setInterval(() => setDisplayStep(stepRef.value), 33);
    return () => clearInterval(id);
  }, [stepRef]);

  const playing = Math.round(module.params.play ?? 0) > 0;
  const bpm = Math.round(module.params.bpm ?? 128);

  const toggleStep = (patKey: string, step: number) => {
    const pat = Math.round(module.params[patKey] ?? 0);
    onParamChange(module.id, patKey, pat ^ (1 << step));
  };

  const clearPat = (patKey: string) => onParamChange(module.id, patKey, 0);
  const fillPat  = (patKey: string) => onParamChange(module.id, patKey, 65535);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#090909', overflow: 'hidden',
    }}>
      {/* ─ Header ─ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
        borderBottom: '1px solid #1c1c1c', background: '#111', flexShrink: 0,
      }}>
        <span style={{ fontSize: 6.5, color: '#444', textTransform: 'uppercase', letterSpacing: '0.12em' }}>BPM</span>
        <input
          type="range" min={60} max={200} value={bpm} step={1}
          style={{ width: 64, accentColor: '#dc2626', cursor: 'pointer' }}
          onChange={e => onParamChange(module.id, 'bpm', Number(e.target.value))}
          onMouseDown={e => e.stopPropagation()}
        />
        <span style={{
          fontSize: 11, color: '#dc2626', fontVariantNumeric: 'tabular-nums',
          minWidth: 28, fontWeight: 700, letterSpacing: '0.05em',
        }}>{bpm}</span>
        <div style={{ flex: 1 }} />
        {/* step indicators legend */}
        <div style={{ display: 'flex', gap: 1 }}>
          {Array.from({ length: 16 }, (_, s) => (
            <div key={s} style={{
              width: 5, height: 5, borderRadius: 1,
              background: (playing && displayStep === s) ? '#dc2626' : Math.floor(s / 4) % 2 === 0 ? '#1c1c1c' : '#141414',
              transition: 'background 0.04s',
            }} />
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button
          style={{
            padding: '3px 10px', fontSize: 8, borderRadius: 2, cursor: 'pointer', fontWeight: 700,
            letterSpacing: '0.12em', border: `1px solid ${playing ? '#ef4444' : '#333'}`,
            background: playing ? '#dc2626' : '#1a1a1a', color: playing ? '#fff' : '#555',
            transition: 'all 0.1s',
          }}
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onSelectorChange(module.id, 'play', playing ? 0 : 1)}
        >{playing ? '■ STOP' : '▶ PLAY'}</button>
      </div>

      {/* ─ Step grid ─ */}
      <div style={{ flex: 1, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'space-evenly' }}>
        {DRM_CHANS.map(({ label, patKey, volKey, color }) => {
          const pat = Math.round(module.params[patKey] ?? 0);
          const vol = module.params[volKey] ?? 0.7;
          return (
            <div key={patKey} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* label */}
              <span style={{
                fontSize: 6.5, color, letterSpacing: '0.06em', fontWeight: 700,
                textTransform: 'uppercase', minWidth: 26, textAlign: 'right', flexShrink: 0,
              }}>{label}</span>

              {/* 16 step buttons */}
              <div style={{ display: 'flex', gap: 2, flex: 1 }}>
                {Array.from({ length: 16 }, (_, s) => {
                  const active  = !!(pat & (1 << s));
                  const isCur   = playing && displayStep === s;
                  const grpAlt  = Math.floor(s / 4) % 2 === 1;
                  return (
                    <div
                      key={s}
                      title={`Step ${s + 1}`}
                      style={{
                        flex: 1, height: 20, borderRadius: 2, cursor: 'pointer',
                        background: isCur && active ? '#fff'
                          : isCur             ? '#2c2c2c'
                          : active            ? color
                          : grpAlt            ? '#191919' : '#131313',
                        border: `1px solid ${active ? color + 'aa' : '#222'}`,
                        boxShadow: isCur ? `0 0 5px ${color}` : active ? `0 0 2px ${color}66` : 'none',
                        transition: 'background 0.03s',
                      }}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={() => toggleStep(patKey, s)}
                    />
                  );
                })}
              </div>

              {/* vol bar + controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <div style={{ width: 40, height: 4, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${vol * 100}%`, background: color, borderRadius: 2, transition: 'width 0.05s' }} />
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <button
                    title="Clear pattern"
                    style={{ fontSize: 6, padding: '0 3px', cursor: 'pointer', border: '1px solid #222', borderRadius: 1, background: '#0e0e0e', color: '#444', lineHeight: '10px' }}
                    onMouseDown={e => e.stopPropagation()} onClick={() => clearPat(patKey)}
                  >×</button>
                  <button
                    title="Fill pattern"
                    style={{ fontSize: 6, padding: '0 3px', cursor: 'pointer', border: '1px solid #222', borderRadius: 1, background: '#0e0e0e', color: '#444', lineHeight: '10px' }}
                    onMouseDown={e => e.stopPropagation()} onClick={() => fillPat(patKey)}
                  >■</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─ Volume sliders row ─ */}
      <div style={{ flexShrink: 0, padding: '4px 8px 6px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 6, color: '#333', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>VOL</span>
        {DRM_CHANS.map(({ label, volKey, color }) => (
          <div key={volKey} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1 }}>
            <input
              type="range" min={0} max={1} step={0.01}
              value={module.params[volKey] ?? 0.7}
              style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => onParamChange(module.id, volKey, Number(e.target.value))}
            />
            <span style={{ fontSize: 5.5, color: '#333', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PANEL_H = 300;
const KEYBOARD_H = 540;
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

function PortWithLabel({
  moduleId, port, isConnected, isPendingSource, canConnect, onPortClick, onPortDoubleClick, onRegisterRef,
}: {
  moduleId: string;
  port: { id: string; name: string; type: PortType };
  isConnected: boolean;
  isPendingSource: boolean;
  canConnect: boolean;
  onPortClick: (moduleId: string, portId: string, type: PortType) => void;
  onPortDoubleClick: (moduleId: string, portId: string) => void;
  onRegisterRef: (key: string, el: HTMLDivElement | null) => void;
}) {
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
        onRegisterRef={onRegisterRef}
      />
      <span style={{
        fontSize: 6, color: '#5a5a5a', textTransform: 'uppercase',
        letterSpacing: '0.04em', lineHeight: 1, textAlign: 'center',
        maxWidth: 28, overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap',
      }}>
        {port.name}
      </span>
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
    <div className="relative w-full" style={{ height: 72 }}>
      <div className="flex h-full gap-px">
        {NOTE_WHITES.map((semitone, i) => {
          const midi = octaveBase + semitone;
          const active = activeNote === midi;
          return (
            <div key={i} className="flex-1 rounded-b cursor-pointer border border-gray-600 select-none"
              style={{ background: active ? '#d97706' : '#e5e7eb', boxShadow: active ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'none', transition: 'background 0.05s' }}
              onMouseDown={(e) => { e.preventDefault(); press(semitone); }}
              onMouseUp={release}
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
              onMouseDown={(e) => { e.preventDefault(); press(semitone); }}
              onMouseUp={release}
              onMouseLeave={() => { if (activeNote === midi) release(); }}
              data-testid={`piano-key-black-${NOTE_NAMES[semitone]}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ModulePanel({
  module, connectedPorts, pendingCable, onPortClick, onPortDoubleClick, onParamChange,
  onSelectorChange, onDragStart, onDelete, onRegisterPortRef, onKeyPress,
  analyser, midiMonitorData, isMidiTarget, moduleStepRef,
}: ModulePanelProps) {
  const typeDef = MODULE_TYPE_MAP.get(module.typeId);
  const [showDelete, setShowDelete] = useState(false);
  const [eucStep, setEucStep] = useState(0);

  useEffect(() => {
    if (module.typeId !== 'euclidean_trig' || !moduleStepRef) return;
    const id = setInterval(() => setEucStep(moduleStepRef.value), 33);
    return () => clearInterval(id);
  }, [module.typeId, moduleStepRef]);

  if (!typeDef) return null;

  const isOutput = module.typeId === 'output';
  const isDrum   = module.typeId === 'drum_machine';
  const isEuc    = module.typeId === 'euclidean_trig';
  const panelH   = typeDef.height ?? PANEL_H;
  const bodyH    = panelH - RAIL_H * 2;

  const canConnectPort = (portId: string, portType: PortType): boolean => {
    if (!pendingCable) return false;
    if (pendingCable.fromModuleId === module.id && pendingCable.fromPortId === portId) return false;
    const fromIsOut = pendingCable.fromPortType.endsWith('_out');
    const toIsIn = portType.endsWith('_in');
    if (!fromIsOut || !toIsIn) return false;
    const fromSignal = pendingCable.fromPortType.replace('_out', '');
    const toSignal = portType.replace('_in', '');
    if (fromSignal === 'gate' && toSignal !== 'gate') return false;
    if (toSignal === 'gate' && fromSignal !== 'gate') return false;
    return true;
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
    onRegisterRef: onRegisterPortRef,
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
          cursor: 'grab', position: 'relative',
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
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '0.18em', color: accent,
          textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis', flex: 1, textAlign: 'center', padding: '0 4px',
        }}>
          {typeDef.name}
        </span>
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
        background: isDrum
          ? 'linear-gradient(180deg, #0a0a0a 0%, #0d0d0d 100%)'
          : 'linear-gradient(180deg, #171717 0%, #1a1a1a 100%)',
        borderLeft: `1px solid ${isDrum ? '#1e1e1e' : '#242424'}`,
        borderRight: `1px solid ${isDrum ? '#1e1e1e' : '#242424'}`,
        overflow: 'hidden',
      }}>
        {/* ── Drum machine: patchable trigger ports strip + step grid ── */}
        {isDrum ? (
          <>
            {/* Port patch points — trigger inputs per voice + MIX output */}
            <div style={{
              flexShrink: 0, padding: '5px 8px 4px',
              borderBottom: '1px solid #1c1c1c', background: '#0c0c0c',
              display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap',
            }}>
              {inPorts.map(port => (
                <PortWithLabel key={port.id} {...portProps(port)} />
              ))}
              <div style={{ flex: 1 }} />
              {outPorts.map(port => (
                <PortWithLabel key={port.id} {...portProps(port)} />
              ))}
            </div>
            <DrumMachineGrid
              module={module}
              onParamChange={onParamChange}
              onSelectorChange={onSelectorChange}
              stepRef={moduleStepRef}
            />
          </>
        ) : (
          <>
            {/* Input ports */}
            {inPorts.length > 0 && (
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
            <div style={{ flex: 1, padding: '6px 5px', display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
              {typeDef.knobs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 4px', justifyContent: 'center' }}>
                  {typeDef.knobs.map(knob => (
                    <Knob
                      key={knob.id}
                      def={knob}
                      value={module.params[knob.id] ?? knob.default}
                      onChange={(val) => onParamChange(module.id, knob.id, val)}
                      size="sm"
                    />
                  ))}
                </div>
              )}

              {/* Euclidean LED ring */}
              {isEuc && (
                <EuclideanLedRing
                  steps={module.params.steps ?? 8}
                  fill={module.params.fill ?? 4}
                  shift={module.params.shift ?? 0}
                  currentStep={eucStep}
                />
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

              {isOutput && <OutputMeter analyser={analyser} />}
              {module.typeId === 'midi_monitor' && midiMonitorData && (
                <MidiMonitorDisplay d={midiMonitorData} />
              )}
            </div>

            {/* Output ports */}
            {outPorts.length > 0 && (
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
    </div>
  );
}
