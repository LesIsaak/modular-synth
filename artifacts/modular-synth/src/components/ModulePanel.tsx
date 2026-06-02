import { useState, useEffect, useRef } from 'react';
import { ModuleInstance, PortType, PendingCable } from '../types';
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
  onSelectorChange, onDragStart, onDelete, onRegisterPortRef, onKeyPress, analyser,
}: ModulePanelProps) {
  const typeDef = MODULE_TYPE_MAP.get(module.typeId);
  const [showDelete, setShowDelete] = useState(false);
  if (!typeDef) return null;

  const isOutput = module.typeId === 'output';
  const panelH = PANEL_H;
  const bodyH = panelH - RAIL_H * 2;

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
          borderTop: `2px solid ${accent}`,
          borderBottom: '1px solid #0e0e0e',
          boxShadow: '0 2px 4px rgba(0,0,0,0.7)',
          userSelect: 'none',
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
        <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
      </div>

      {/* Panel body */}
      <div style={{
        height: bodyH, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, #171717 0%, #1a1a1a 100%)',
        borderLeft: '1px solid #242424',
        borderRight: '1px solid #242424',
        overflow: 'hidden',
      }}>
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
