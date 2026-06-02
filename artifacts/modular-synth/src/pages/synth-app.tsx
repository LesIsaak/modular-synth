import { useState, useRef, useCallback, useEffect } from 'react';
import { ModuleInstance, Cable, PendingCable, PortType } from '../types';
import {
  MODULE_TYPE_MAP, CATEGORY_ORDER, CATEGORY_LABELS, CATEGORY_COLORS,
  CABLE_COLORS, getDefaultParams, MODULE_TYPES,
} from '../moduleDefinitions';
import { createAudioModule, connectAudioPorts, disconnectAudioPorts } from '../audioEngine';
import ModulePanel from '../components/ModulePanel';

// ─── Layout constants ─────────────────────────────────────────────────────────
const SLOT_W  = 220;   // rack slot width (snap grid)
const SLOT_H  = 400;   // rack slot height (= PANEL_H)
const CONTENT_W = 2400;
const CONTENT_H = 1400;
const KB_H    = 152;   // fixed keyboard panel height
const SIDEBAR_W = 208; // w-52 = 13rem = 208px

// ─── Rack slot helpers ────────────────────────────────────────────────────────
function snapToSlot(x: number, y: number) {
  return {
    x: Math.max(0, Math.round(x / SLOT_W) * SLOT_W),
    y: Math.max(0, Math.round(y / SLOT_H) * SLOT_H),
  };
}

function findNextSlot(modules: ModuleInstance[]): { x: number; y: number } {
  const occupied = new Set(
    modules.map(m => `${Math.round(m.x / SLOT_W)},${Math.round(m.y / SLOT_H)}`)
  );
  const maxCols = Math.floor(CONTENT_W / SLOT_W);
  for (let row = 0; row < 20; row++) {
    for (let col = 0; col < maxCols; col++) {
      if (!occupied.has(`${col},${row}`)) return { x: col * SLOT_W, y: row * SLOT_H };
    }
  }
  return { x: 0, y: 0 };
}

// ─── Default patch (keyboard is NOT a module — it's the fixed panel) ──────────
const DEFAULT_MODULES: ModuleInstance[] = [
  { id: 'vco1',  typeId: 'analog_vco', x: 0 * SLOT_W, y: 0, params: { freq: 0, fine: 0, wave: 0 } },
  { id: 'vcf1',  typeId: 'vcf',        x: 1 * SLOT_W, y: 0, params: { cutoff: 900, res: 2, type: 0 } },
  { id: 'adsr1', typeId: 'adsr',       x: 2 * SLOT_W, y: 0, params: { attack: 0.01, decay: 0.12, sustain: 0.65, release: 0.4 } },
  { id: 'vca1',  typeId: 'vca',        x: 3 * SLOT_W, y: 0, params: { gain: 0 } },
  { id: 'out1',  typeId: 'output',     x: 4 * SLOT_W, y: 0, params: { volume: 0.7 } },
];

const DEFAULT_CABLES: Cable[] = [
  { id: 'c2', fromModuleId: 'vco1',  fromPortId: 'out',     toModuleId: 'vcf1',  toPortId: 'audio_in', color: '#f97316' },
  { id: 'c3', fromModuleId: 'vcf1',  fromPortId: 'out',     toModuleId: 'vca1',  toPortId: 'audio_in', color: '#14b8a6' },
  { id: 'c4', fromModuleId: 'adsr1', fromPortId: 'env_out', toModuleId: 'vca1',  toPortId: 'cv_in',    color: '#a855f7' },
  { id: 'c5', fromModuleId: 'vca1',  fromPortId: 'out',     toModuleId: 'out1',  toPortId: 'in_l',     color: '#22c55e' },
];

// ─── Module browser ───────────────────────────────────────────────────────────
function ModuleBrowser({ onAdd }: { onAdd: (typeId: string) => void }) {
  const byCategory = CATEGORY_ORDER.map(cat => ({
    cat,
    label: CATEGORY_LABELS[cat],
    types: MODULE_TYPES.filter(m => m.category === cat && m.id !== 'keyboard'),
  })).filter(g => g.types.length > 0);

  return (
    <div
      className="flex-shrink-0 flex flex-col border-r border-[#2a2a2a] bg-[#0f0f0f] z-10 overflow-y-auto"
      style={{ width: SIDEBAR_W }}
      data-testid="module-browser"
    >
      <div className="px-4 py-3 border-b border-[#222]">
        <div className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: '#e87d27' }}>MODULAR</div>
        <div className="text-[9px] text-gray-600 mt-0.5 tracking-widest">SYNTHESIZER</div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {byCategory.map(({ cat, label, types }) => (
          <div key={cat} className="mb-3">
            <div className="px-3 py-1 text-[8px] uppercase tracking-[0.15em] text-gray-600 border-b border-[#1e1e1e]">
              {label}
            </div>
            <div className="space-y-0.5 pt-1 px-2">
              {types.map(t => (
                <button
                  key={t.id}
                  className="w-full text-left px-2 py-1.5 text-[10px] rounded transition-all border border-transparent hover:border-[#333] hover:bg-[#1a1a1a]"
                  style={{ borderLeft: `3px solid ${CATEGORY_COLORS[cat] ?? '#555'}`, color: '#bbb' }}
                  onClick={() => onAdd(t.id)}
                  data-testid={`add-module-${t.id}`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-[#222] text-[8px] text-gray-700 space-y-0.5">
        <div>Click port → port to patch cable</div>
        <div>Right-click cable to remove</div>
        <div>Drag header — snaps to rack slots</div>
      </div>
    </div>
  );
}

// ─── Patch cables SVG ─────────────────────────────────────────────────────────
function PatchCables({
  cables, modules, pendingCable, mousePos, getPortCenter, onRemoveCable,
}: {
  cables: Cable[];
  modules: ModuleInstance[];
  pendingCable: PendingCable | null;
  mousePos: { x: number; y: number };
  getPortCenter: (modId: string, portId: string) => { x: number; y: number } | null;
  onRemoveCable: (id: string) => void;
}) {
  const makePath = (x1: number, y1: number, x2: number, y2: number) => {
    const dy = Math.abs(y2 - y1);
    const sag = Math.min(80 + dy * 0.4, 200);
    const mx = (x1 + x2) / 2;
    const my = Math.max(y1, y2) + sag;
    return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  };

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={CONTENT_W}
      height={CONTENT_H}
      style={{ zIndex: 20 }}
    >
      <defs>
        {cables.map(c => (
          <filter key={`glow-${c.id}`} id={`glow-${c.id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
      </defs>
      {cables.map(c => {
        const from = getPortCenter(c.fromModuleId, c.fromPortId);
        const to   = getPortCenter(c.toModuleId,   c.toPortId);
        if (!from || !to) return null;
        const d = makePath(from.x, from.y, to.x, to.y);
        return (
          <g key={c.id} className="pointer-events-auto">
            <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }}
              onContextMenu={e => { e.preventDefault(); onRemoveCable(c.id); }} />
            <path d={d} fill="none" stroke="#000" strokeWidth={5} strokeLinecap="round" opacity={0.5} />
            <path d={d} fill="none" stroke={c.color} strokeWidth={3.5} strokeLinecap="round"
              filter={`url(#glow-${c.id})`} />
          </g>
        );
      })}
      {pendingCable && (() => {
        const from = getPortCenter(pendingCable.fromModuleId, pendingCable.fromPortId);
        if (!from) return null;
        return (
          <path
            d={makePath(from.x, from.y, mousePos.x, mousePos.y)}
            fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round"
            strokeDasharray="6 4" opacity={0.6}
          />
        );
      })()}
    </svg>
  );
}

// ─── Pitch wheel ──────────────────────────────────────────────────────────────
function PitchWheel({ onChange }: { onChange: (val: number) => void }) {
  const [value, setValue] = useState(0);
  const dragging = useRef(false);
  const startY   = useRef(0);
  const startVal = useRef(0);
  const TRACK_H  = 100;

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current   = e.clientY;
    startVal.current = value;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dy  = startY.current - e.clientY;
      const val = Math.max(-1, Math.min(1, startVal.current + dy / (TRACK_H / 2)));
      setValue(val);
      onChange(val);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setValue(0);
      onChange(0);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onChange]);

  const handleTop = `calc(${(1 - (value + 1) / 2) * 100}% - 10px)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, userSelect: 'none' }}>
      <div
        style={{
          width: 34, height: TRACK_H,
          background: '#0c0c0c', border: '1px solid #2c2c2c', borderRadius: 5,
          position: 'relative', cursor: 'ns-resize',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.04)',
        }}
        onMouseDown={onMouseDown}
      >
        {/* groove lines */}
        {[-3, -1, 1, 3].map(n => (
          <div key={n} style={{
            position: 'absolute', left: 5, right: 5,
            top: `calc(50% + ${n * 9}px)`, height: 1, background: '#1e1e1e',
          }} />
        ))}
        {/* center line */}
        <div style={{ position: 'absolute', left: 4, right: 4, top: '50%', height: 1, background: '#3a3a3a' }} />
        {/* handle */}
        <div style={{
          position: 'absolute', left: 4, right: 4, height: 20, top: handleTop,
          borderRadius: 3,
          background: 'linear-gradient(180deg, #4a4a4a 0%, #2e2e2e 60%, #1e1e1e 100%)',
          border: '1px solid #5a5a5a',
          boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
          cursor: 'ns-resize',
        }} />
      </div>
      <span style={{ fontSize: 7, color: '#3e3e3e', letterSpacing: '0.14em', textTransform: 'uppercase' }}>PITCH</span>
    </div>
  );
}

// ─── Mod wheel ────────────────────────────────────────────────────────────────
function ModWheel({ onChange }: { onChange: (val: number) => void }) {
  const [value, setValue] = useState(0);
  const dragging = useRef(false);
  const startY   = useRef(0);
  const startVal = useRef(0);
  const TRACK_H  = 100;

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current   = e.clientY;
    startVal.current = value;
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dy  = startY.current - e.clientY;
      const val = Math.max(0, Math.min(1, startVal.current + dy / TRACK_H));
      setValue(val);
      onChange(val);
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onChange]);

  const handleTop = `calc(${(1 - value) * 100}% - 10px)`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, userSelect: 'none' }}>
      <div
        style={{
          width: 34, height: TRACK_H,
          background: '#0c0c0c', border: '1px solid #2c2c2c', borderRadius: 5,
          position: 'relative', cursor: 'ns-resize',
          boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.9), 0 1px 0 rgba(255,255,255,0.04)',
        }}
        onMouseDown={onMouseDown}
      >
        {/* fill */}
        <div style={{
          position: 'absolute', left: 5, right: 5, bottom: 5,
          height: `calc(${value * 100}% - 10px)`,
          background: 'linear-gradient(to top, #1a3a2a, #0e2218)',
          borderRadius: 3, transition: 'none',
        }} />
        {/* handle */}
        <div style={{
          position: 'absolute', left: 4, right: 4, height: 20, top: handleTop,
          borderRadius: 3,
          background: 'linear-gradient(180deg, #4a4a4a 0%, #2e2e2e 60%, #1e1e1e 100%)',
          border: '1px solid #5a5a5a',
          boxShadow: '0 2px 6px rgba(0,0,0,0.8)',
          cursor: 'ns-resize',
        }} />
      </div>
      <span style={{ fontSize: 7, color: '#3e3e3e', letterSpacing: '0.14em', textTransform: 'uppercase' }}>MOD</span>
    </div>
  );
}

// ─── Fixed keyboard panel ─────────────────────────────────────────────────────
const NOTE_WHITES = [0, 2, 4, 5, 7, 9, 11];
const NOTE_BLACKS = [1, 3, -1, 6, 8, 10, -1];
const NOTE_NAMES  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function midiToHz(midi: number) { return 440 * Math.pow(2, (midi - 69) / 12); }

function FixedKeyboardPanel({
  started,
  onNote,
  onBend,
}: {
  started: boolean;
  onNote: (freq: number, on: boolean) => void;
  onBend: (freq: number) => void;
}) {
  const [octave,     setOctave]     = useState(4);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const pitchRef    = useRef(0);    // current pitch bend -1..1
  const heldFreqRef = useRef(0);    // base freq of held note
  const heldMidiRef = useRef<number | null>(null);

  const pressKey = (semitone: number, octOff = 0) => {
    if (!started) return;
    const midi = (octave + octOff) * 12 + 12 + semitone;
    const freq = midiToHz(midi);
    const BEND_ST = 2;
    const bentFreq = freq * Math.pow(2, pitchRef.current * BEND_ST / 12);
    heldFreqRef.current = freq;
    heldMidiRef.current = midi;
    setActiveNote(midi);
    onNote(bentFreq, true);
  };

  const releaseKey = (midi: number) => {
    if (heldMidiRef.current !== midi) return;
    heldFreqRef.current = 0;
    heldMidiRef.current = null;
    setActiveNote(null);
    onNote(0, false);
  };

  const handlePitchChange = useCallback((val: number) => {
    pitchRef.current = val;
    if (heldFreqRef.current > 0) {
      const BEND_ST = 2;
      onBend(heldFreqRef.current * Math.pow(2, val * BEND_ST / 12));
    }
  }, [onBend]);

  const handleModChange = useCallback((_val: number) => {
    // mod output — future: wire to kb1's mod_out ConstantSource
  }, []);

  const renderOctave = (octOff: number) => {
    const octBase = (octave + octOff) * 12 + 12;
    return (
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        {/* White keys */}
        <div style={{ display: 'flex', height: '100%', gap: 1.5 }}>
          {NOTE_WHITES.map((semitone, i) => {
            const midi   = octBase + semitone;
            const active = activeNote === midi;
            return (
              <div
                key={i}
                style={{
                  flex: 1, borderRadius: '0 0 5px 5px', cursor: 'pointer',
                  background: active ? '#d97706' : '#dde1e5',
                  border: active ? '1px solid #b45309' : '1px solid #777',
                  boxShadow: active
                    ? 'inset 0 3px 5px rgba(0,0,0,0.35)'
                    : '0 5px 0 rgba(0,0,0,0.4), inset 0 -1px 0 rgba(0,0,0,0.1)',
                  transition: 'background 0.04s',
                  userSelect: 'none',
                }}
                onMouseDown={e => { e.preventDefault(); pressKey(semitone, octOff); }}
                onMouseUp={() => releaseKey(midi)}
                onMouseLeave={() => { if (activeNote === midi) releaseKey(midi); }}
                data-testid={`key-w-oct${octave + octOff}-${NOTE_NAMES[semitone]}`}
              />
            );
          })}
        </div>
        {/* Black keys */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%', pointerEvents: 'none' }}>
          {NOTE_BLACKS.map((semitone, i) => {
            if (semitone === -1) return <div key={i} />;
            const midi   = octBase + semitone;
            const active = activeNote === midi;
            const leftPct = (i + 1) * (100 / 7) - (100 / 7) / 2;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute', left: `${leftPct - 4}%`, width: '8%', height: '100%',
                  borderRadius: '0 0 4px 4px', cursor: 'pointer', pointerEvents: 'auto',
                  background: active ? '#d97706' : '#1a1a1a',
                  border: active ? '1px solid #b45309' : '1px solid #000',
                  zIndex: 10,
                  boxShadow: active ? 'none' : '0 5px 8px rgba(0,0,0,0.9)',
                  transition: 'background 0.04s',
                  userSelect: 'none',
                }}
                onMouseDown={e => { e.preventDefault(); pressKey(semitone, octOff); }}
                onMouseUp={() => releaseKey(midi)}
                onMouseLeave={() => { if (activeNote === midi) releaseKey(midi); }}
                data-testid={`key-b-oct${octave + octOff}-${NOTE_NAMES[semitone]}`}
              />
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: SIDEBAR_W, right: 0, height: KB_H,
      zIndex: 30, userSelect: 'none', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, #1c1c1c 0%, #141414 100%)',
      borderTop: '2px solid #0a0a0a',
      boxShadow: '0 -6px 24px rgba(0,0,0,0.9)',
    }}>
      {/* Top rail */}
      <div style={{
        height: 24, flexShrink: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 14px',
        background: 'linear-gradient(180deg, #252525 0%, #1d1d1d 100%)',
        borderBottom: '1px solid #0e0e0e',
      }}>
        <span style={{ fontSize: 7, letterSpacing: '0.22em', color: '#3a3a3a', textTransform: 'uppercase' }}>
          KEYBOARD CONTROLLER
        </span>
        {/* Octave controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 7, color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' }}>OCT</span>
          <button
            style={{
              width: 20, height: 16, fontSize: 11, lineHeight: 1, borderRadius: 2,
              cursor: 'pointer', background: '#181818', color: '#555', border: '1px solid #2a2a2a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setOctave(o => Math.max(1, o - 1))}
            data-testid="octave-down"
          >−</button>
          <span style={{ fontSize: 10, color: '#888', minWidth: 14, textAlign: 'center', fontWeight: 700 }}>
            {octave}
          </span>
          <button
            style={{
              width: 20, height: 16, fontSize: 11, lineHeight: 1, borderRadius: 2,
              cursor: 'pointer', background: '#181818', color: '#555', border: '1px solid #2a2a2a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onClick={() => setOctave(o => Math.min(7, o + 1))}
            data-testid="octave-up"
          >+</button>
        </div>
      </div>

      {/* Main keyboard area */}
      <div style={{ flex: 1, display: 'flex', padding: '10px 14px 10px', gap: 14 }}>
        {/* Pitch + Mod wheels */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <PitchWheel onChange={handlePitchChange} />
          <ModWheel onChange={handleModChange} />
        </div>

        {/* Vertical divider */}
        <div style={{ width: 1, background: '#202020', flexShrink: 0 }} />

        {/* Piano — 2 octaves side-by-side */}
        <div style={{ flex: 1, display: 'flex', gap: 6, minWidth: 0 }}>
          {renderOctave(0)}
          {/* Octave seam */}
          <div style={{ width: 2, background: '#1a1a1a', flexShrink: 0, borderRadius: 1 }} />
          {renderOctave(1)}
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SynthApp() {
  const [started,      setStarted]      = useState(false);
  const [modules,      setModules]      = useState<ModuleInstance[]>(DEFAULT_MODULES);
  const [cables,       setCables]       = useState<Cable[]>(DEFAULT_CABLES);
  const [pendingCable, setPendingCable] = useState<PendingCable | null>(null);
  const [mousePos,     setMousePos]     = useState({ x: 0, y: 0 });

  const audioCtxRef      = useRef<AudioContext | null>(null);
  const audioModulesRef  = useRef<Map<string, ReturnType<typeof createAudioModule>>>(new Map());
  const gateConnRef      = useRef<Map<string, Set<string>>>(new Map());
  const portRefsRef      = useRef<Map<string, HTMLDivElement>>(new Map());
  const rackRef          = useRef<HTMLDivElement>(null);
  const dragRef          = useRef<{
    moduleId: string; startX: number; startY: number; origX: number; origY: number;
  } | null>(null);

  // ─── Port DOM refs ──────────────────────────────────────────────────────────
  const registerPortRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) portRefsRef.current.set(key, el);
    else portRefsRef.current.delete(key);
  }, []);

  const getPortCenter = useCallback((modId: string, portId: string) => {
    const el   = portRefsRef.current.get(`${modId}-${portId}`);
    const rack = rackRef.current;
    if (!el || !rack) return null;
    const eR = el.getBoundingClientRect();
    const rR = rack.getBoundingClientRect();
    return {
      x: eR.left - rR.left + rack.scrollLeft + eR.width  / 2,
      y: eR.top  - rR.top  + rack.scrollTop  + eR.height / 2,
    };
  }, []);

  // ─── Initialize audio ───────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // Always-on keyboard module
    const kb1 = createAudioModule(ctx, 'keyboard', { octave: 4 });
    audioModulesRef.current.set('kb1', kb1);

    // Rack modules
    for (const mod of DEFAULT_MODULES) {
      audioModulesRef.current.set(mod.id, createAudioModule(ctx, mod.typeId, { ...mod.params }));
    }

    // Hard-wire keyboard → VCO voct
    const vco1 = audioModulesRef.current.get('vco1');
    if (vco1) connectAudioPorts(kb1, 'voct_out', vco1, 'voct');

    // Hard-wire keyboard gate → ADSR
    gateConnRef.current.set('kb1', new Set(['adsr1']));

    // Connect default cables
    for (const cable of DEFAULT_CABLES) {
      const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
      const toAudio   = audioModulesRef.current.get(cable.toModuleId);
      if (fromAudio && toAudio) connectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
    }

    setStarted(true);
  }, []);

  // ─── Fixed keyboard callbacks ───────────────────────────────────────────────
  const handleKeyNote = useCallback((freq: number, on: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const kb1 = audioModulesRef.current.get('kb1');
    if (!kb1) return;

    const freqNode = kb1.outputs.get('voct_out') as (AudioNode & { offset?: AudioParam }) | undefined;
    if (freqNode && 'offset' in freqNode && freqNode.offset) {
      freqNode.offset.value = on ? freq : 0;
    }

    const connected = gateConnRef.current.get('kb1') ?? new Set<string>();
    for (const id of connected) {
      const m = audioModulesRef.current.get(id);
      if (on) m?.noteOn?.(ctx.currentTime, freq);
      else    m?.noteOff?.(ctx.currentTime);
    }
  }, []);

  const handleKeyBend = useCallback((bentFreq: number) => {
    const kb1 = audioModulesRef.current.get('kb1');
    if (!kb1) return;
    const freqNode = kb1.outputs.get('voct_out') as (AudioNode & { offset?: AudioParam }) | undefined;
    if (freqNode && 'offset' in freqNode && freqNode.offset) {
      freqNode.offset.value = bentFreq;
    }
  }, []);

  // ─── Add module ─────────────────────────────────────────────────────────────
  const handleAddModule = useCallback((typeId: string) => {
    if (typeId === 'keyboard') return;
    const typeDef = MODULE_TYPE_MAP.get(typeId);
    if (!typeDef) return;
    const id     = `${typeId}_${Date.now()}`;
    const params = getDefaultParams(typeDef);

    setModules(prev => {
      const { x, y } = findNextSlot(prev);
      return [...prev, { id, typeId, x, y, params }];
    });

    if (audioCtxRef.current) {
      audioModulesRef.current.set(id, createAudioModule(audioCtxRef.current, typeId, { ...params }));
    }
  }, []);

  // ─── Delete module ──────────────────────────────────────────────────────────
  const handleDeleteModule = useCallback((moduleId: string) => {
    setCables(prev => {
      const toRemove = prev.filter(c => c.fromModuleId === moduleId || c.toModuleId === moduleId);
      for (const cable of toRemove) {
        const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
        const toAudio   = audioModulesRef.current.get(cable.toModuleId);
        if (fromAudio && toAudio) disconnectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
      }
      return prev.filter(c => c.fromModuleId !== moduleId && c.toModuleId !== moduleId);
    });
    gateConnRef.current.delete(moduleId);
    for (const set of gateConnRef.current.values()) set.delete(moduleId);
    const audio = audioModulesRef.current.get(moduleId);
    if (audio) { audio.destroy(); audioModulesRef.current.delete(moduleId); }
    setModules(prev => prev.filter(m => m.id !== moduleId));
  }, []);

  // ─── Param / selector change ────────────────────────────────────────────────
  const handleParamChange = useCallback((moduleId: string, paramId: string, value: number) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, params: { ...m.params, [paramId]: value } } : m));
    audioModulesRef.current.get(moduleId)?.setParam(paramId, value);
  }, []);

  const handleSelectorChange = useCallback((moduleId: string, selId: string, value: number) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, params: { ...m.params, [selId]: value } } : m));
    audioModulesRef.current.get(moduleId)?.setSelector?.(selId, value);
  }, []);

  // ─── Port click — cable patching ────────────────────────────────────────────
  const handlePortClick = useCallback((moduleId: string, portId: string, portType: PortType) => {
    if (!pendingCable) {
      if (portType.endsWith('_out')) {
        setPendingCable({ fromModuleId: moduleId, fromPortId: portId, fromPortType: portType });
      }
      return;
    }

    const { fromModuleId, fromPortId, fromPortType } = pendingCable;
    if (fromModuleId === moduleId && fromPortId === portId) { setPendingCable(null); return; }
    if (!portType.endsWith('_in')) { setPendingCable(null); return; }

    const fromSig = fromPortType.replace('_out', '');
    const toSig   = portType.replace('_in', '');
    if ((fromSig === 'gate') !== (toSig === 'gate')) { setPendingCable(null); return; }

    const exists = cables.find(c =>
      c.fromModuleId === fromModuleId && c.fromPortId === fromPortId &&
      c.toModuleId   === moduleId     && c.toPortId   === portId
    );
    if (exists) { setPendingCable(null); return; }

    const color    = CABLE_COLORS[cables.length % CABLE_COLORS.length];
    const newCable: Cable = {
      id: `cable_${Date.now()}`, fromModuleId, fromPortId, toModuleId: moduleId, toPortId: portId, color,
    };

    if (fromSig === 'gate') {
      if (!gateConnRef.current.has(fromModuleId)) gateConnRef.current.set(fromModuleId, new Set());
      gateConnRef.current.get(fromModuleId)!.add(moduleId);
    } else {
      const fromAudio = audioModulesRef.current.get(fromModuleId);
      const toAudio   = audioModulesRef.current.get(moduleId);
      if (fromAudio && toAudio) connectAudioPorts(fromAudio, fromPortId, toAudio, portId);
    }

    setCables(prev => [...prev, newCable]);
    setPendingCable(null);
  }, [pendingCable, cables]);

  // ─── Remove cable ───────────────────────────────────────────────────────────
  const handleRemoveCable = useCallback((cableId: string) => {
    setCables(prev => {
      const cable = prev.find(c => c.id === cableId);
      if (!cable) return prev;
      const fromTypeDef = MODULE_TYPE_MAP.get(modules.find(m => m.id === cable.fromModuleId)?.typeId ?? '');
      const fromPort    = fromTypeDef?.ports.find(p => p.id === cable.fromPortId);
      if (fromPort?.type === 'gate_out') {
        gateConnRef.current.get(cable.fromModuleId)?.delete(cable.toModuleId);
      } else {
        const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
        const toAudio   = audioModulesRef.current.get(cable.toModuleId);
        if (fromAudio && toAudio) disconnectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
      }
      return prev.filter(c => c.id !== cableId);
    });
  }, [modules]);

  // ─── Drag (snap on release) ─────────────────────────────────────────────────
  const handleDragStart = useCallback((moduleId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;
    dragRef.current = { moduleId, startX: e.clientX, startY: e.clientY, origX: mod.x, origY: mod.y };
  }, [modules]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (rackRef.current) {
        const r = rackRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - r.left + rackRef.current.scrollLeft,
          y: e.clientY - r.top  + rackRef.current.scrollTop,
        });
      }
      if (dragRef.current) {
        const { moduleId, startX, startY, origX, origY } = dragRef.current;
        setModules(prev => prev.map(m =>
          m.id === moduleId
            ? { ...m, x: Math.max(0, origX + e.clientX - startX), y: Math.max(0, origY + e.clientY - startY) }
            : m
        ));
      }
    };

    const onMouseUp = () => {
      if (dragRef.current) {
        const { moduleId } = dragRef.current;
        // Snap to nearest rack slot on release
        setModules(prev => prev.map(m => {
          if (m.id !== moduleId) return m;
          const snapped = snapToSlot(m.x, m.y);
          return { ...m, ...snapped };
        }));
        dragRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  // Cancel pending cable on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPendingCable(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Legacy keyboard handler (for any keyboard module instances in modules list — none by default)
  const handleModuleKeyPress = useCallback((moduleId: string, freq: number, on: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const audio    = audioModulesRef.current.get(moduleId);
    const freqNode = audio?.outputs.get('voct_out') as (AudioNode & { offset?: AudioParam }) | undefined;
    if (freqNode && 'offset' in freqNode && freqNode.offset) freqNode.offset.value = on ? freq : 0;
    const connected = gateConnRef.current.get(moduleId);
    for (const id of connected ?? []) {
      const m = audioModulesRef.current.get(id);
      if (on) m?.noteOn?.(ctx.currentTime, freq);
      else    m?.noteOff?.(ctx.currentTime);
    }
  }, []);

  // Connected ports set
  const connectedPortsSet = new Set<string>();
  for (const c of cables) {
    connectedPortsSet.add(`${c.fromModuleId}-${c.fromPortId}`);
    connectedPortsSet.add(`${c.toModuleId}-${c.toPortId}`);
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0a0a0a] font-mono select-none">
      {/* Start overlay */}
      {!started && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm">
          <div className="text-center space-y-6">
            <div>
              <div className="text-4xl font-bold tracking-[0.3em] uppercase mb-2" style={{ color: '#e87d27' }}>
                MODULAR
              </div>
              <div className="text-sm text-gray-500 tracking-[0.5em] uppercase">Synthesizer</div>
            </div>
            <div className="text-xs text-gray-600 max-w-xs text-center leading-relaxed">
              A patchable modular synthesizer in the browser.
              Pre-loaded with VCO → VCF → VCA → Output.
              Use the keyboard panel at the bottom to play.
            </div>
            <button
              onClick={handleStart}
              className="px-10 py-3 text-sm font-bold tracking-[0.2em] uppercase rounded border transition-all hover:scale-105 active:scale-95"
              style={{
                background: '#e87d27', color: '#000',
                border: '1px solid #c96a1a',
                boxShadow: '0 0 30px rgba(232,125,39,0.4)',
              }}
              data-testid="start-button"
            >
              INITIALIZE
            </button>
          </div>
        </div>
      )}

      <ModuleBrowser onAdd={handleAddModule} />

      {/* Rack — bottom-padded so modules aren't hidden behind the fixed keyboard */}
      <div
        ref={rackRef}
        className="flex-1 overflow-auto relative rack-bg"
        style={{ paddingBottom: KB_H }}
        onClick={() => { if (pendingCable) setPendingCable(null); }}
        data-testid="rack-workspace"
      >
        <div className="relative" style={{ width: CONTENT_W, height: CONTENT_H }}>
          <PatchCables
            cables={cables}
            modules={modules}
            pendingCable={pendingCable}
            mousePos={mousePos}
            getPortCenter={getPortCenter}
            onRemoveCable={handleRemoveCable}
          />

          {modules.map(mod => (
            <div
              key={mod.id}
              className="absolute"
              style={{ left: mod.x, top: mod.y, zIndex: 10 }}
            >
              <ModulePanel
                module={mod}
                connectedPorts={connectedPortsSet}
                pendingCable={pendingCable}
                onPortClick={handlePortClick}
                onParamChange={handleParamChange}
                onSelectorChange={handleSelectorChange}
                onDragStart={handleDragStart}
                onDelete={handleDeleteModule}
                onRegisterPortRef={registerPortRef}
                onKeyPress={handleModuleKeyPress}
              />
            </div>
          ))}

          {pendingCable && (
            <div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 text-xs text-gray-400 rounded border border-[#333] bg-[#111]/90 backdrop-blur-sm pointer-events-none"
              style={{ zIndex: 100 }}
            >
              Click an input port to connect — ESC to cancel
            </div>
          )}
        </div>
      </div>

      {/* Fixed keyboard panel — always at the bottom */}
      <FixedKeyboardPanel
        started={started}
        onNote={handleKeyNote}
        onBend={handleKeyBend}
      />
    </div>
  );
}
