import { useCallback, useRef, useState } from 'react';
import { ModuleInstance, PortType, PendingCable } from '../types';
import { MODULE_TYPE_MAP } from '../moduleDefinitions';
import Knob from './Knob';
import PortJack from './PortJack';

interface ModulePanelProps {
  module: ModuleInstance;
  connectedPorts: Set<string>;
  pendingCable: PendingCable | null;
  onPortClick: (moduleId: string, portId: string, type: PortType) => void;
  onParamChange: (moduleId: string, paramId: string, value: number) => void;
  onSelectorChange: (moduleId: string, selectorId: string, value: number) => void;
  onDragStart: (moduleId: string, e: React.MouseEvent) => void;
  onDelete: (moduleId: string) => void;
  onRegisterPortRef: (key: string, el: HTMLDivElement | null) => void;
  onKeyPress?: (moduleId: string, freq: number, on: boolean) => void;
}

const NOTE_WHITES = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const NOTE_BLACKS = [1, 3, -1, 6, 8, 10, -1]; // C# D# - F# G# A# -
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function PianoKeyboard({ octave, onKeyPress }: {
  octave: number;
  onKeyPress: (freq: number, on: boolean) => void;
}) {
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const octaveBase = octave * 12 + 12; // MIDI note for C of this octave (C4 = 60)

  const press = (semitone: number) => {
    const midi = octaveBase + semitone;
    setActiveNote(midi);
    onKeyPress(midiToHz(midi), true);
  };

  const release = () => {
    setActiveNote(null);
    onKeyPress(0, false);
  };

  return (
    <div className="relative w-full" style={{ height: 64 }}>
      {/* White keys */}
      <div className="flex h-full gap-px">
        {NOTE_WHITES.map((semitone, i) => {
          const midi = octaveBase + semitone;
          const active = activeNote === midi;
          return (
            <div
              key={i}
              className="flex-1 rounded-b cursor-pointer border border-gray-600 select-none"
              style={{
                background: active ? '#d97706' : '#e5e7eb',
                boxShadow: active ? 'inset 0 2px 4px rgba(0,0,0,0.3)' : 'none',
                transition: 'background 0.05s',
              }}
              onMouseDown={(e) => { e.preventDefault(); press(semitone); }}
              onMouseUp={release}
              onMouseLeave={() => { if (activeNote === midi) release(); }}
              data-testid={`piano-key-white-${NOTE_NAMES[semitone]}`}
            />
          );
        })}
      </div>
      {/* Black keys overlay */}
      <div className="absolute top-0 left-0 w-full flex pointer-events-none" style={{ height: 38 }}>
        {NOTE_BLACKS.map((semitone, i) => {
          if (semitone === -1) {
            return <div key={i} className="flex-1" />;
          }
          const midi = octaveBase + semitone;
          const active = activeNote === midi;
          const whiteWidth = 100 / 7;
          const leftPct = (i + 1) * whiteWidth - whiteWidth / 2;
          return (
            <div
              key={i}
              className="absolute rounded-b cursor-pointer pointer-events-auto select-none"
              style={{
                left: `${leftPct - 4}%`,
                width: '8%',
                height: '100%',
                background: active ? '#d97706' : '#111',
                border: '1px solid #000',
                zIndex: 10,
                boxShadow: active ? 'none' : '0 3px 4px rgba(0,0,0,0.5)',
                transition: 'background 0.05s',
              }}
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
  module,
  connectedPorts,
  pendingCable,
  onPortClick,
  onParamChange,
  onSelectorChange,
  onDragStart,
  onDelete,
  onRegisterPortRef,
  onKeyPress,
}: ModulePanelProps) {
  const typeDef = MODULE_TYPE_MAP.get(module.typeId);
  const [showDelete, setShowDelete] = useState(false);
  if (!typeDef) return null;

  const isKeyboard = module.typeId === 'keyboard';
  const isOutput = module.typeId === 'output';

  const canConnectPort = (portId: string, portType: PortType): boolean => {
    if (!pendingCable) return false;
    if (pendingCable.fromModuleId === module.id && pendingCable.fromPortId === portId) return false;
    const fromIsOut = pendingCable.fromPortType.endsWith('_out');
    const toIsIn = portType.endsWith('_in');
    if (!fromIsOut || !toIsIn) return false;
    // Same signal type matching
    const fromSignal = pendingCable.fromPortType.replace('_out', '');
    const toSignal = portType.replace('_in', '');
    if (fromSignal === 'gate' && toSignal !== 'gate') return false;
    if (toSignal === 'gate' && fromSignal !== 'gate') return false;
    return true;
  };

  const inPorts = typeDef.ports.filter(p => p.type.endsWith('_in'));
  const outPorts = typeDef.ports.filter(p => p.type.endsWith('_out'));

  return (
    <div
      className="absolute module-panel rounded-sm flex flex-col select-none"
      style={{ width: typeDef.width, minHeight: 200 }}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      data-testid={`module-${module.id}`}
    >
      {/* Accent header / drag handle */}
      <div
        className="flex items-center justify-between px-2 cursor-grab active:cursor-grabbing"
        style={{
          height: 22,
          background: `${typeDef.accentColor}22`,
          borderBottom: `1px solid ${typeDef.accentColor}44`,
          borderTop: `3px solid ${typeDef.accentColor}`,
        }}
        onMouseDown={(e) => onDragStart(module.id, e)}
      >
        <span
          className="text-[9px] font-bold tracking-widest uppercase truncate"
          style={{ color: typeDef.accentColor }}
        >
          {typeDef.name}
        </span>
        {showDelete && (
          <button
            className="text-[8px] text-gray-600 hover:text-red-400 transition-colors leading-none ml-1 px-1"
            onClick={(e) => { e.stopPropagation(); onDelete(module.id); }}
            data-testid={`delete-module-${module.id}`}
          >
            ✕
          </button>
        )}
      </div>

      {/* Input ports row */}
      {inPorts.length > 0 && (
        <div className="flex justify-around px-2 pt-2 pb-1">
          {inPorts.map(port => (
            <PortJack
              key={port.id}
              moduleId={module.id}
              portDef={port}
              isConnected={connectedPorts.has(`${module.id}-${port.id}`)}
              isPendingSource={pendingCable?.fromModuleId === module.id && pendingCable.fromPortId === port.id}
              canConnect={canConnectPort(port.id, port.type)}
              onPortClick={onPortClick}
              onRegisterRef={onRegisterPortRef}
            />
          ))}
        </div>
      )}

      {/* Body content */}
      <div className="flex-1 px-3 py-2 flex flex-col gap-3">
        {/* Knobs */}
        {typeDef.knobs.length > 0 && (
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
            {typeDef.knobs.map(knob => (
              <Knob
                key={knob.id}
                def={knob}
                value={module.params[knob.id] ?? knob.default}
                onChange={(val) => onParamChange(module.id, knob.id, val)}
                size="md"
              />
            ))}
          </div>
        )}

        {/* Selectors */}
        {(typeDef.selectors ?? []).map(sel => {
          const curVal = module.params[sel.id] ?? sel.default;
          return (
            <div key={sel.id} className="flex flex-col items-center gap-1">
              <span className="text-[8px] text-gray-500 uppercase tracking-wider">{sel.name}</span>
              <div className="flex gap-1 flex-wrap justify-center">
                {sel.options.map((opt, i) => (
                  <button
                    key={opt}
                    className="px-1.5 py-0.5 text-[8px] rounded border transition-colors"
                    style={{
                      background: Math.round(curVal) === i ? typeDef.accentColor : '#1a1a1a',
                      color: Math.round(curVal) === i ? '#000' : '#666',
                      borderColor: Math.round(curVal) === i ? typeDef.accentColor : '#333',
                    }}
                    onClick={() => onSelectorChange(module.id, sel.id, i)}
                    data-testid={`selector-${module.id}-${sel.id}-${opt}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Keyboard special UI */}
        {isKeyboard && (
          <div className="flex flex-col gap-1">
            <PianoKeyboard
              octave={Math.round(module.params.octave ?? 4)}
              onKeyPress={(freq, on) => onKeyPress?.(module.id, freq, on)}
            />
            <div className="flex justify-center gap-2 mt-1">
              {[1, 2, 3, 4, 5, 6, 7].map(oct => (
                <button
                  key={oct}
                  className="w-5 h-5 text-[8px] rounded border transition-colors"
                  style={{
                    background: Math.round(module.params.octave ?? 4) === oct ? '#94a3b8' : '#1a1a1a',
                    color: Math.round(module.params.octave ?? 4) === oct ? '#000' : '#666',
                    borderColor: Math.round(module.params.octave ?? 4) === oct ? '#94a3b8' : '#333',
                  }}
                  onClick={() => onParamChange(module.id, 'octave', oct)}
                  data-testid={`octave-btn-${oct}`}
                >
                  {oct}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Output VU placeholder */}
        {isOutput && (
          <div className="flex gap-1 justify-center h-12">
            {[0, 1].map(ch => (
              <div key={ch} className="w-3 rounded-sm overflow-hidden flex flex-col-reverse" style={{ background: '#111', border: '1px solid #333' }}>
                <div className="w-full rounded-sm" style={{ height: '60%', background: 'linear-gradient(to top, #22c55e, #fbbf24, #ef4444)' }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Output ports row */}
      {outPorts.length > 0 && (
        <div className="flex justify-around px-2 pb-2 pt-1">
          {outPorts.map(port => (
            <PortJack
              key={port.id}
              moduleId={module.id}
              portDef={port}
              isConnected={connectedPorts.has(`${module.id}-${port.id}`)}
              isPendingSource={pendingCable?.fromModuleId === module.id && pendingCable.fromPortId === port.id}
              canConnect={canConnectPort(port.id, port.type)}
              onPortClick={onPortClick}
              onRegisterRef={onRegisterPortRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}
