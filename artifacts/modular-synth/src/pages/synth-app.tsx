import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ModuleInstance, Cable, PendingCable, PortType, MidiMonitorData } from '../types';
import { MidiClockInfo, getMidiClockInfo, setMidiClockLocked, emitMidiClockInfo, addMidiClockListener, removeMidiClockListener } from '../midiClock';
import {
  MODULE_TYPE_MAP, CATEGORY_ORDER, CATEGORY_LABELS, CATEGORY_COLORS,
  CABLE_COLORS, getDefaultParams, MODULE_TYPES, MODULE_DESCRIPTIONS,
} from '../moduleDefinitions';
import { createAudioModule, connectAudioPorts, disconnectAudioPorts, getCurrentTickAudioTime } from '../audioEngine';
import ModulePanel from '../components/ModulePanel';

// ─── Layout constants ─────────────────────────────────────────────────────────
const SLOT_W  = 220;   // rack slot width (snap grid)
const SLOT_H  = 300;   // rack row height — matches standard module height for tight packing
const CONTENT_W = 2400;
const CONTENT_H = 3000; // 10 rows × SLOT_H
const KB_H    = 152;   // fixed keyboard panel height
const SIDEBAR_W = 208; // w-52 = 13rem = 208px

// ─── Rack slot helpers ────────────────────────────────────────────────────────
/** Snap y to row grid; snap x to the nearest module-edge in that row (no gaps). */
function snapToSlot(
  x: number, y: number,
  modules: ModuleInstance[], draggingId: string,
) {
  const snappedY = Math.max(0, Math.round(y / SLOT_H) * SLOT_H);
  const targetRow = Math.round(snappedY / SLOT_H);

  // Collect right-edges of every other module in the same row, plus origin 0
  const snapPoints: number[] = [0];
  for (const m of modules) {
    if (m.id === draggingId) continue;
    if (Math.round(m.y / SLOT_H) !== targetRow) continue;
    const w = MODULE_TYPE_MAP.get(m.typeId)?.width ?? SLOT_W;
    snapPoints.push(m.x + w);   // right edge → left edge of next module
  }

  // Pick the snap point closest to where the user dropped
  const snappedX = snapPoints.reduce((best, pt) =>
    Math.abs(pt - x) < Math.abs(best - x) ? pt : best,
  snapPoints[0]);

  return { x: Math.max(0, snappedX), y: snappedY };
}

/** Find the next available tightly-packed position for a new module of the given type. */
function findNextSlot(modules: ModuleInstance[], newTypeId: string): { x: number; y: number } {
  const newW = MODULE_TYPE_MAP.get(newTypeId)?.width ?? SLOT_W;
  for (let row = 0; row < 20; row++) {
    const rowY = row * SLOT_H;
    const rowMods = modules
      .filter(m => Math.round(m.y / SLOT_H) === row)
      .sort((a, b) => a.x - b.x);
    // Walk along the row and find the first x where the new module fits
    let cursor = 0;
    for (const m of rowMods) {
      if (m.x >= cursor + newW) break;        // gap before this module — use cursor
      cursor = Math.max(cursor, m.x + (MODULE_TYPE_MAP.get(m.typeId)?.width ?? SLOT_W));
    }
    if (cursor + newW <= CONTENT_W) return { x: cursor, y: rowY };
  }
  return { x: 0, y: 0 };
}

// ─── Default patch (tightly packed — no gaps) ──────────────────────────────────
const DEFAULT_MODULES: ModuleInstance[] = (() => {
  const defs: Array<{ id: string; typeId: string; params: Record<string, number> }> = [
    { id: 'kb1',   typeId: 'keyboard',   params: {} },
    { id: 'vco1',  typeId: 'analog_vco', params: { freq: 0, fine: 0, wave: 0 } },
    { id: 'vcf1',  typeId: 'vcf',        params: { cutoff: 900, res: 2, type: 0 } },
    { id: 'adsr1', typeId: 'adsr',       params: { attack: 0.01, decay: 0.12, sustain: 0.65, release: 0.4 } },
    { id: 'vca1',  typeId: 'vca',        params: { gain: 0 } },
    { id: 'out1',  typeId: 'output',     params: { volume: 0.7 } },
  ];
  let x = 0;
  return defs.map(d => {
    const m = { ...d, x, y: 0 };
    x += MODULE_TYPE_MAP.get(d.typeId)?.width ?? SLOT_W;
    return m;
  });
})();

const DEFAULT_CABLES: Cable[] = [
  { id: 'c0', fromModuleId: 'kb1',   fromPortId: 'voct_out', toModuleId: 'vco1',  toPortId: 'voct',     color: '#60a5fa' },
  { id: 'c1', fromModuleId: 'kb1',   fromPortId: 'gate_out', toModuleId: 'adsr1', toPortId: 'gate_in',  color: '#eab308' },
  { id: 'c2', fromModuleId: 'vco1',  fromPortId: 'out',      toModuleId: 'vcf1',  toPortId: 'audio_in', color: '#f97316' },
  { id: 'c3', fromModuleId: 'vcf1',  fromPortId: 'out',      toModuleId: 'vca1',  toPortId: 'audio_in', color: '#14b8a6' },
  { id: 'c4', fromModuleId: 'adsr1', fromPortId: 'env_out',  toModuleId: 'vca1',  toPortId: 'cv_in',    color: '#a855f7' },
  { id: 'c5', fromModuleId: 'vca1',  fromPortId: 'out',      toModuleId: 'out1',  toPortId: 'in_l',     color: '#22c55e' },
];

// ─── Module browser ───────────────────────────────────────────────────────────
function ModuleBrowser({ onAdd }: { onAdd: (typeId: string) => void }) {
  const byCategory = CATEGORY_ORDER.map(cat => ({
    cat,
    label: CATEGORY_LABELS[cat],
    types: MODULE_TYPES.filter(m => m.category === cat && m.id !== 'keyboard'),
  })).filter(g => g.types.length > 0);

  const [tooltip, setTooltip] = useState<{ id: string; name: string; desc: string; color: string; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = (t: (typeof MODULE_TYPES)[0], cat: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const desc = MODULE_DESCRIPTIONS[t.id];
    if (!desc) return;
    const rect = e.currentTarget.getBoundingClientRect();
    timerRef.current = setTimeout(() => {
      setTooltip({ id: t.id, name: t.name, desc, color: CATEGORY_COLORS[cat] ?? '#555', y: rect.top });
    }, 3000);
  };

  const handleLeave = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setTooltip(null);
  };

  return (
    <>
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
                    onClick={() => { handleLeave(); onAdd(t.id); }}
                    onMouseEnter={e => handleEnter(t, cat, e)}
                    onMouseLeave={handleLeave}
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

      {/* ── Hover tooltip — appears after 3 s, floats to the right of sidebar ── */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: SIDEBAR_W + 10,
            top: Math.min(tooltip.y, window.innerHeight - 140),
            width: 260,
            zIndex: 200,
            background: '#111',
            border: `1px solid ${tooltip.color}44`,
            borderLeft: `3px solid ${tooltip.color}`,
            borderRadius: 5,
            padding: '10px 12px',
            pointerEvents: 'none',
            boxShadow: `0 4px 24px rgba(0,0,0,0.7), 0 0 12px ${tooltip.color}22`,
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: tooltip.color, textTransform: 'uppercase', marginBottom: 6 }}>
            {tooltip.name}
          </div>
          <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.55 }}>
            {tooltip.desc}
          </div>
          <div style={{ fontSize: 8, color: '#444', marginTop: 8, fontStyle: 'italic' }}>
            hold to read · click to add
          </div>
        </div>
      )}
    </>
  );
}

// ─── Patch cables SVG ─────────────────────────────────────────────────────────
function PatchCables({
  cables, modules, pendingCable, mousePos, getPortCenter, onRemoveCable, onGrabCableEnd, cableOpacity,
}: {
  cables: Cable[];
  modules: ModuleInstance[];
  pendingCable: PendingCable | null;
  mousePos: { x: number; y: number };
  getPortCenter: (modId: string, portId: string) => { x: number; y: number } | null;
  onRemoveCable: (id: string) => void;
  onGrabCableEnd: (cableId: string) => void;
  cableOpacity: number;
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
      style={{ zIndex: 30 }}
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
            {/* Hit area — always present for interaction */}
            <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }}
              onContextMenu={e => { e.preventDefault(); onRemoveCable(c.id); }} />
            {/* Cable lines — opacity controlled by slider */}
            <g opacity={cableOpacity}>
              <path d={d} fill="none" stroke="#000" strokeWidth={6} strokeLinecap="round" opacity={0.45} />
              <path d={d} fill="none" stroke={c.color} strokeWidth={4} strokeLinecap="round"
                filter={`url(#glow-${c.id})`} />
              <path d={d} fill="none" stroke="white" strokeWidth={1.2} strokeLinecap="round" opacity={0.12} />
            </g>

            {/* 3.5mm plug at FROM end — visual only, click falls through to port jack */}
            <g style={{ pointerEvents: 'none' }}>
              <circle cx={from.x} cy={from.y} r={16} fill="transparent" />
              <circle cx={from.x} cy={from.y} r={13} fill="black" opacity={0.4} />
              <circle cx={from.x} cy={from.y} r={12} fill="#383838" stroke="#555" strokeWidth={0.6} />
              <circle cx={from.x} cy={from.y} r={10} fill={c.color} opacity={0.9} />
              <circle cx={from.x} cy={from.y} r={8}  fill="#1c1c1c" />
              <circle cx={from.x} cy={from.y} r={5.5} fill="#404040" />
              <circle cx={from.x} cy={from.y} r={2.5} fill="#888" />
              <ellipse cx={from.x - 3} cy={from.y - 3} rx={3} ry={1.8} fill="white" opacity={0.15} />
              <circle cx={from.x} cy={from.y} r={12} fill="none" stroke={c.color} strokeWidth={1} opacity={0.7} />
            </g>

            {/* 3.5mm plug at TO end — grab to re-patch */}
            <g style={{ pointerEvents: 'auto', cursor: 'grab' }}
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onGrabCableEnd(c.id); }}>
              <circle cx={to.x} cy={to.y} r={16} fill="transparent" />
              <circle cx={to.x} cy={to.y} r={13} fill="black" opacity={0.4} />
              <circle cx={to.x} cy={to.y} r={12} fill="#383838" stroke="#555" strokeWidth={0.6} />
              <circle cx={to.x} cy={to.y} r={10} fill={c.color} opacity={0.9} />
              <circle cx={to.x} cy={to.y} r={8}  fill="#1c1c1c" />
              <circle cx={to.x} cy={to.y} r={5.5} fill="#404040" />
              <circle cx={to.x} cy={to.y} r={2.5} fill="#888" />
              <ellipse cx={to.x - 3} cy={to.y - 3} rx={3} ry={1.8} fill="white" opacity={0.15} />
              <circle cx={to.x} cy={to.y} r={12} fill="none" stroke={c.color} strokeWidth={1} opacity={0.7} />
            </g>
          </g>
        );
      })}
      {pendingCable && (() => {
        const from = getPortCenter(pendingCable.fromModuleId, pendingCable.fromPortId);
        if (!from) return null;
        const col = pendingCable.color ?? '#e5e7eb';
        const mx = mousePos.x, my = mousePos.y;
        return (
          <>
            <path d={makePath(from.x, from.y, mx, my)}
              fill="none" stroke="#000" strokeWidth={6} strokeLinecap="round" opacity={0.4} />
            <path d={makePath(from.x, from.y, mx, my)}
              fill="none" stroke={col} strokeWidth={4} strokeLinecap="round"
              strokeDasharray="8 5" opacity={0.85} />
            <circle cx={mx} cy={my} r={13} fill="black" opacity={0.4} />
            <circle cx={mx} cy={my} r={12} fill="#383838" stroke="#555" strokeWidth={0.6} />
            <circle cx={mx} cy={my} r={10} fill={col} opacity={0.9} />
            <circle cx={mx} cy={my} r={8}  fill="#1c1c1c" />
            <circle cx={mx} cy={my} r={5.5} fill="#404040" />
            <circle cx={mx} cy={my} r={2.5} fill="#888" />
            <ellipse cx={mx - 3} cy={my - 3} rx={3} ry={1.8} fill="white" opacity={0.15} />
            <circle cx={mx} cy={my} r={12} fill="none" stroke={col} strokeWidth={1} opacity={0.7} />
          </>
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
  onPitch,
  onMod,
  onUndo,
  undoAvail,
  cableOpacity,
  onCableOpacity,
  midiStatus,
  midiDeviceCount,
  midiActiveNotes,
  onSave,
  onLoad,
}: {
  started: boolean;
  onNote:           (freq: number, on: boolean) => void;
  onBend:           (freq: number) => void;
  onPitch:          (val: number) => void;
  onMod:            (val: number) => void;
  onUndo:           () => void;
  undoAvail:        boolean;
  cableOpacity:     number;
  onCableOpacity:   (val: number) => void;
  midiStatus:       MidiStatus;
  midiDeviceCount:  number;
  midiActiveNotes?: ReadonlySet<number>;
  onSave:           () => void;
  onLoad:           () => void;
}) {
  const [octave,     setOctave]     = useState(4);
  const [activeNote, setActiveNote] = useState<number | null>(null);
  const [hold,       setHold]       = useState(false);
  const pitchRef    = useRef(0);    // current pitch bend -1..1
  const heldFreqRef = useRef(0);    // base freq of held note
  const heldMidiRef = useRef<number | null>(null);
  const holdRef     = useRef(false);

  const pressKey = (semitone: number, octOff = 0) => {
    if (!started) return;
    const midi = (octave + octOff) * 12 + 12 + semitone;
    const freq = midiToHz(midi);
    const BEND_ST = 2;
    const bentFreq = freq * Math.pow(2, pitchRef.current * BEND_ST / 12);
    heldFreqRef.current = bentFreq;   // store bentFreq so release can match it
    heldMidiRef.current = midi;
    setActiveNote(midi);
    onNote(bentFreq, true);
  };

  const releaseKey = (midi: number) => {
    if (heldMidiRef.current !== midi) return;
    if (holdRef.current) return;     // hold mode: don't release
    const freq = heldFreqRef.current;
    heldFreqRef.current = 0;
    heldMidiRef.current = null;
    setActiveNote(null);
    onNote(freq, false);             // pass the same freq that was used in pressKey
  };

  const toggleHold = () => {
    const next = !holdRef.current;
    holdRef.current = next;
    setHold(next);
    if (!next && heldFreqRef.current > 0) {
      const freq = heldFreqRef.current;
      heldFreqRef.current = 0;
      heldMidiRef.current = null;
      setActiveNote(null);
      onNote(freq, false);           // pass the same freq that was used in pressKey
    }
  };

  const handlePitchChange = useCallback((val: number) => {
    pitchRef.current = val;
    onPitch(val);
    if (heldFreqRef.current > 0) {
      const BEND_ST = 2;
      onBend(heldFreqRef.current * Math.pow(2, val * BEND_ST / 12));
    }
  }, [onBend, onPitch]);

  const handleModChange = useCallback((val: number) => {
    onMod(val);
  }, [onMod]);

  const renderOctave = (octOff: number) => {
    const octBase = (octave + octOff) * 12 + 12;
    return (
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        {/* White keys */}
        <div style={{ display: 'flex', height: '100%', gap: 1.5 }}>
          {NOTE_WHITES.map((semitone, i) => {
            const midi      = octBase + semitone;
            const pressed   = activeNote === midi;
            const midiOn    = midiActiveNotes?.has(midi) ?? false;
            const active    = pressed || midiOn;
            const bg        = midiOn ? '#0891b2' : pressed ? '#d97706' : '#dde1e5';
            const bdr       = midiOn ? '#06b6d4' : pressed ? '#b45309' : '#777';
            return (
              <div
                key={i}
                style={{
                  flex: 1, borderRadius: '0 0 5px 5px', cursor: 'pointer',
                  background: bg,
                  border: `1px solid ${bdr}`,
                  boxShadow: active
                    ? `inset 0 3px 5px rgba(0,0,0,0.35)${midiOn ? ', 0 0 6px rgba(6,182,212,0.5)' : ''}`
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
            const midi     = octBase + semitone;
            const pressed  = activeNote === midi;
            const midiOn   = midiActiveNotes?.has(midi) ?? false;
            const active   = pressed || midiOn;
            const bg       = midiOn ? '#0891b2' : pressed ? '#d97706' : '#1a1a1a';
            const bdr      = midiOn ? '#06b6d4' : pressed ? '#b45309' : '#000';
            const leftPct  = (i + 1) * (100 / 7) - (100 / 7) / 2;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute', left: `${leftPct - 4}%`, width: '8%', height: '100%',
                  borderRadius: '0 0 4px 4px', cursor: 'pointer', pointerEvents: 'auto',
                  background: bg,
                  border: `1px solid ${bdr}`,
                  zIndex: 10,
                  boxShadow: active
                    ? midiOn ? '0 0 8px rgba(6,182,212,0.6)' : 'none'
                    : '0 5px 8px rgba(0,0,0,0.9)',
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
        {/* MIDI status pill */}
        {(() => {
          const cfg: Record<MidiStatus, { dot: string; label: string; title: string }> = {
            pending:     { dot: '#444',    label: 'MIDI …',    title: 'Waiting for MIDI access' },
            unsupported: { dot: '#ef4444', label: 'NO MIDI',   title: 'Web MIDI API not supported (try Chrome/Edge)' },
            denied:      { dot: '#ef4444', label: 'MIDI ✗',    title: 'MIDI access denied — or blocked by iframe. Open the app in its own tab.' },
            'no-devices':{ dot: '#f59e0b', label: 'MIDI —',    title: 'Access granted but no MIDI inputs detected' },
            ready:       { dot: '#22c55e', label: `MIDI ✓ ×${midiDeviceCount}`, title: `${midiDeviceCount} MIDI device(s) connected` },
          };
          const { dot, label, title } = cfg[midiStatus];
          return (
            <div title={title} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: dot, boxShadow: midiStatus === 'ready' ? `0 0 4px ${dot}` : 'none' }} />
              <span style={{ fontSize: 6, color: dot === '#22c55e' ? '#4ade80' : dot === '#444' ? '#444' : '#9ca3af', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {label}
              </span>
            </div>
          );
        })()}
        {/* Controls right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Cable opacity slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 7, color: '#6b7280', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              CABLE
            </span>
            <input
              type="range" min={0} max={1} step={0.01}
              value={cableOpacity}
              onChange={e => onCableOpacity(parseFloat(e.target.value))}
              style={{ width: 52, height: 4, cursor: 'pointer', accentColor: '#555' }}
            />
          </div>
          {/* SAVE button */}
          <button
            onClick={onSave}
            disabled={!started}
            title="Save patch (Ctrl+S)"
            style={{
              height: 16, padding: '0 7px', fontSize: 7, letterSpacing: '0.16em',
              borderRadius: 2, cursor: started ? 'pointer' : 'default',
              fontWeight: 700, textTransform: 'uppercase',
              border: '1px solid #374151', background: '#181818',
              color: started ? '#9ca3af' : '#2a2a2a',
              transition: 'all 0.1s', opacity: started ? 1 : 0.4,
            }}
          >↓ SAVE</button>
          {/* LOAD button */}
          <button
            onClick={onLoad}
            disabled={!started}
            title="Load patch (Ctrl+O)"
            style={{
              height: 16, padding: '0 7px', fontSize: 7, letterSpacing: '0.16em',
              borderRadius: 2, cursor: started ? 'pointer' : 'default',
              fontWeight: 700, textTransform: 'uppercase',
              border: '1px solid #374151', background: '#181818',
              color: started ? '#9ca3af' : '#2a2a2a',
              transition: 'all 0.1s', opacity: started ? 1 : 0.4,
            }}
          >↑ LOAD</button>
          {/* UNDO button */}
          <button
            onClick={onUndo}
            disabled={!undoAvail}
            title="Undo (Ctrl+Z)"
            data-testid="undo-button"
            style={{
              height: 16, padding: '0 7px', fontSize: 7, letterSpacing: '0.16em',
              borderRadius: 2, cursor: undoAvail ? 'pointer' : 'default',
              fontWeight: 700, textTransform: 'uppercase',
              border: `1px solid ${undoAvail ? '#374151' : '#222'}`,
              background: '#181818',
              color: undoAvail ? '#9ca3af' : '#2a2a2a',
              transition: 'all 0.1s',
              opacity: undoAvail ? 1 : 0.4,
            }}
          >↩ UNDO</button>
          {/* HOLD button */}
          <button
            onClick={toggleHold}
            data-testid="hold-button"
            style={{
              height: 16, padding: '0 7px', fontSize: 7, letterSpacing: '0.16em',
              borderRadius: 2, cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase',
              border: `1px solid ${hold ? '#d97706' : '#2a2a2a'}`,
              background: hold ? '#1c1000' : '#181818',
              color: hold ? '#d97706' : '#444',
              boxShadow: hold ? '0 0 6px rgba(217,119,6,0.4)' : 'none',
              transition: 'all 0.1s',
            }}
          >HOLD</button>
          {/* Octave controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 7, color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase' }}>OCT</span>
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

// ─── MIDI input hook ─────────────────────────────────────────────────────────
type MidiMonEvent =
  | { type: 'noteOn';  channel: number; note: number; velocity: number }
  | { type: 'noteOff'; channel: number; note: number }
  | { type: 'bend';    channel: number; bend: number }
  | { type: 'cc';      channel: number; num: number; val: number };

type MidiStatus = 'unsupported' | 'pending' | 'denied' | 'no-devices' | 'ready';


function useMIDI(
  onNote:  (freq: number, on: boolean) => void,
  onBend:  (freq: number) => void,
  onMod:   (val: number) => void,
  onMon:   (ev: MidiMonEvent) => void,
  onClock: (info: MidiClockInfo) => void,
): { status: MidiStatus; deviceCount: number } {
  const onNoteRef  = useRef(onNote);
  const onBendRef  = useRef(onBend);
  const onModRef   = useRef(onMod);
  const onMonRef   = useRef(onMon);
  const onClockRef = useRef(onClock);
  onNoteRef.current  = onNote;
  onBendRef.current  = onBend;
  onModRef.current   = onMod;
  onMonRef.current   = onMon;
  onClockRef.current = onClock;

  const [status,      setStatus]      = useState<MidiStatus>('pending');
  const [deviceCount, setDeviceCount] = useState(0);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) { setStatus('unsupported'); return; }

    const baseFreqRef = { current: 0 };

    // MIDI Clock (0xF8) BPM measurement — 24 pulses per quarter note
    const CLOCK_PULSES_PER_BEAT = 24;
    const CLOCK_WINDOW = 8; // average over this many intervals for stability
    const clockTimestamps: number[] = [];
    let clockDeviceName: string | null = null;

    // Per-device handler so we can track which device is sending clock
    const makeDeviceHandler = (deviceName: string) => (e: MIDIMessageEvent) => {
      const d = e.data;
      if (!d || d.length === 0) return;

      // MIDI Clock tick (single-byte, no channel)
      if (d[0] === 0xf8) {
        const now = performance.now();
        clockTimestamps.push(now);
        if (clockTimestamps.length > CLOCK_WINDOW + 1) clockTimestamps.shift();
        if (clockTimestamps.length >= 2) {
          const intervals: number[] = [];
          for (let i = 1; i < clockTimestamps.length; i++)
            intervals.push(clockTimestamps[i] - clockTimestamps[i - 1]);
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const bpm = Math.round((60000 / avgInterval) / CLOCK_PULSES_PER_BEAT * 10) / 10;
          if (bpm >= 20 && bpm <= 400) {
            if (clockDeviceName !== deviceName) clockDeviceName = deviceName;
            emitMidiClockInfo({ bpm, deviceName });
          }
        }
        return;
      }

      if (d.length < 2) return;
      const type = d[0] & 0xf0;
      const note = d[1];
      const vel  = d.length >= 3 ? d[2] : 0;
      const ch   = (d[0] & 0x0f) + 1;

      if (type === 0x90 && vel > 0) {
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        baseFreqRef.current = freq;
        onNoteRef.current(freq, true);
        onMonRef.current({ type: 'noteOn', channel: ch, note, velocity: vel });
      } else if (type === 0x80 || (type === 0x90 && vel === 0)) {
        const freq = 440 * Math.pow(2, (note - 69) / 12);
        baseFreqRef.current = 0;
        onNoteRef.current(freq, false);
        onMonRef.current({ type: 'noteOff', channel: ch, note });
      } else if (type === 0xe0 && d.length >= 3) {
        const bend14 = (d[2] << 7) | d[1];
        const norm   = (bend14 - 8192) / 8192;
        if (baseFreqRef.current > 0) {
          const BEND_ST = 2;
          onBendRef.current(baseFreqRef.current * Math.pow(2, norm * BEND_ST / 12));
        }
        onMonRef.current({ type: 'bend', channel: ch, bend: (bend14 - 8192) / 8192 });
      } else if (type === 0xb0 && d.length >= 3 && d[1] === 1) {
        onModRef.current(d[2] / 127);
        onMonRef.current({ type: 'cc', channel: ch, num: 1, val: d[2] });
      } else if (type === 0xb0 && d.length >= 3) {
        onMonRef.current({ type: 'cc', channel: ch, num: d[1], val: d[2] });
      }
    };

    let access: MIDIAccess | null = null;
    const deviceHandlers = new Map<string, (e: MIDIMessageEvent) => void>();

    const refreshDevices = (a: MIDIAccess) => {
      let n = 0;
      for (const input of a.inputs.values()) {
        const name = input.name ?? 'Unknown Device';
        if (!deviceHandlers.has(input.id)) {
          deviceHandlers.set(input.id, makeDeviceHandler(name));
        }
        input.onmidimessage = deviceHandlers.get(input.id)!;
        n++;
      }
      setDeviceCount(n);
      setStatus(n > 0 ? 'ready' : 'no-devices');
    };

    // Subscribe to clock updates
    const clockListener = (info: MidiClockInfo) => onClockRef.current(info);
    addMidiClockListener(clockListener);

    navigator.requestMIDIAccess({ sysex: false }).then(a => {
      access = a;
      refreshDevices(a);
      a.onstatechange = () => refreshDevices(a);
    }).catch(() => { setStatus('denied'); });

    return () => {
      removeMidiClockListener(clockListener);
      access?.inputs.forEach(i => { i.onmidimessage = null; });
    };
  }, []);

  return { status, deviceCount };
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SynthApp() {
  const [started,         setStarted]         = useState(false);
  const [samplerBanks,    setSamplerBanks]    = useState<Map<string, boolean[]>>(new Map());
  const [saveDialogOpen,  setSaveDialogOpen]  = useState(false);
  const [saveDialogInput, setSaveDialogInput] = useState('');
  const [modules,      setModules]      = useState<ModuleInstance[]>(DEFAULT_MODULES);
  const [cables,       setCables]       = useState<Cable[]>(DEFAULT_CABLES);
  const [pendingCable, setPendingCable] = useState<PendingCable | null>(null);
  const pendingCableRef = useRef<PendingCable | null>(null);
  pendingCableRef.current = pendingCable;
  const [mousePos,     setMousePos]     = useState({ x: 0, y: 0 });
  const [cableOpacity,     setCableOpacity]     = useState(1);
  const [focusedModuleId,  setFocusedModuleId]  = useState<string | null>(null);
  const [midiActiveNotes,  setMidiActiveNotes]  = useState<ReadonlySet<number>>(new Set());
  const ccOrderRef = useRef<number[]>([]); // CC numbers in order of first touch

  const NOTE_NAMES_MON = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const [midiMonData, setMidiMonData] = useState<MidiMonitorData>({
    gate: false, note: 60, noteName: '---', velocity: 0,
    pitchBend: 0, modWheel: 0, lastCC: null, noteCount: 0, channel: 1,
  });

  // ─── Undo history ──────────────────────────────────────────────────────────
  const undoStackRef   = useRef<Array<{ cables: Cable[]; modules: ModuleInstance[] }>>([]);
  const [undoAvail, setUndoAvail] = useState(false);
  const pushUndo = useCallback((cabs: Cable[], mods: ModuleInstance[]) => {
    undoStackRef.current = [...undoStackRef.current.slice(-19), { cables: cabs, modules: mods }];
    setUndoAvail(true);
  }, []);

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const snap = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setUndoAvail(undoStackRef.current.length > 0);

    // Disconnect cables present now but absent in snapshot
    const toDisconnect = cables.filter(c => !snap.cables.find(p => p.id === c.id));
    for (const cable of toDisconnect) {
      const ftd = MODULE_TYPE_MAP.get(modules.find(m => m.id === cable.fromModuleId)?.typeId ?? '');
      const fp  = ftd?.ports.find(p => p.id === cable.fromPortId);
      if (fp?.type === 'gate_out') {
        gateConnRef.current.get(`${cable.fromModuleId}:${cable.fromPortId}`)?.delete(cable.toModuleId);
        portGateMapRef.current.get(`${cable.fromModuleId}:${cable.fromPortId}`)?.delete(cable.toModuleId);
      } else {
        const fa = audioModulesRef.current.get(cable.fromModuleId);
        const ta = audioModulesRef.current.get(cable.toModuleId);
        if (fa && ta) disconnectAudioPorts(fa, cable.fromPortId, ta, cable.toPortId);
      }
    }
    // Reconnect cables absent now but present in snapshot
    const toConnect = snap.cables.filter(c => !cables.find(p => p.id === c.id));
    for (const cable of toConnect) {
      const ftd = MODULE_TYPE_MAP.get(snap.modules.find(m => m.id === cable.fromModuleId)?.typeId ?? '');
      const fp  = ftd?.ports.find(p => p.id === cable.fromPortId);
      if (fp?.type === 'gate_out') {
        const gkUndo = `${cable.fromModuleId}:${cable.fromPortId}`;
        if (!gateConnRef.current.has(gkUndo)) gateConnRef.current.set(gkUndo, new Set());
        gateConnRef.current.get(gkUndo)!.add(cable.toModuleId);
        if (!portGateMapRef.current.has(gkUndo)) portGateMapRef.current.set(gkUndo, new Map());
        portGateMapRef.current.get(gkUndo)!.set(cable.toModuleId, cable.toPortId);
      } else {
        const fa = audioModulesRef.current.get(cable.fromModuleId);
        const ta = audioModulesRef.current.get(cable.toModuleId);
        if (fa && ta) connectAudioPorts(fa, cable.fromPortId, ta, cable.toPortId);
      }
    }
    // Clean up modules that were added (in current but not in snapshot)
    const addedMods = modules.filter(m => !snap.modules.find(p => p.id === m.id));
    for (const mod of addedMods) {
      try { audioModulesRef.current.get(mod.id)?.destroy(); } catch (_) {}
      audioModulesRef.current.delete(mod.id);
      for (const k of [...gateConnRef.current.keys()]) if (k.startsWith(`${mod.id}:`)) gateConnRef.current.delete(k);
      for (const s of gateConnRef.current.values()) s.delete(mod.id);
      for (const k of [...portGateMapRef.current.keys()]) if (k.startsWith(`${mod.id}:`)) portGateMapRef.current.delete(k);
      for (const m of portGateMapRef.current.values()) m.delete(mod.id);
    }
    // Re-create modules that were deleted (in snapshot but not current)
    const removedMods = snap.modules.filter(m => !modules.find(p => p.id === m.id));
    for (const mod of removedMods) {
      if (audioCtxRef.current)
        audioModulesRef.current.set(mod.id, createAudioModule(audioCtxRef.current, mod.typeId, { ...mod.params }));
    }

    setCables(snap.cables);
    setModules(snap.modules);
  }, [cables, modules]);

  const fileInputRef     = useRef<HTMLInputElement>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const audioModulesRef  = useRef<Map<string, ReturnType<typeof createAudioModule>>>(new Map());
  const gateConnRef      = useRef<Map<string, Set<string>>>(new Map());
  const heldNotesRef     = useRef<number[]>([]);
  const glideRef         = useRef<number>(0);
  /** fromModuleId → Map<destModuleId, destPortId> — for per-port drum triggers */
  const portGateMapRef   = useRef<Map<string, Map<string, string>>>(new Map());
  const portRefsRef      = useRef<Map<string, HTMLDivElement>>(new Map());
  const rackRef          = useRef<HTMLDivElement>(null);
  const dragRef          = useRef<{
    moduleId: string; startX: number; startY: number; origX: number; origY: number;
    origScrollLeft: number; origScrollTop: number;
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
    ctx.resume().catch(() => {});
    audioCtxRef.current = ctx;

    // All rack modules (kb1 is now part of DEFAULT_MODULES)
    for (const mod of DEFAULT_MODULES) {
      audioModulesRef.current.set(mod.id, createAudioModule(ctx, mod.typeId, { ...mod.params }));
    }

    // Connect default cables — handles both audio and gate cables
    for (const cable of DEFAULT_CABLES) {
      const fromTypeDef = MODULE_TYPE_MAP.get(DEFAULT_MODULES.find(m => m.id === cable.fromModuleId)?.typeId ?? '');
      const fromPort    = fromTypeDef?.ports.find(p => p.id === cable.fromPortId);
      if (fromPort?.type === 'gate_out') {
        const gkInit = `${cable.fromModuleId}:${cable.fromPortId}`;
        if (!gateConnRef.current.has(gkInit)) gateConnRef.current.set(gkInit, new Set());
        gateConnRef.current.get(gkInit)!.add(cable.toModuleId);
      } else {
        const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
        const toAudio   = audioModulesRef.current.get(cable.toModuleId);
        if (fromAudio && toAudio) connectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
      }
    }

    setStarted(true);
  }, []);

  // ─── Keyboard callbacks — last-note priority with note memory + glide ───────
  const handleKeyNote = useCallback((freq: number, on: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const kb1 = audioModulesRef.current.get('kb1');
    if (!kb1) return;

    const t    = ctx.currentTime + 0.008;
    const held = heldNotesRef.current;

    const applyPitch = (target: number, legato: boolean) => {
      const freqNode = kb1.outputs.get('voct_out') as (AudioNode & { offset?: AudioParam }) | undefined;
      if (!freqNode || !('offset' in freqNode) || !freqNode.offset) return;
      const g = glideRef.current;
      if (g > 0 && legato) {
        const current = freqNode.offset.value;
        freqNode.offset.cancelScheduledValues(t);
        freqNode.offset.setValueAtTime(current, t);
        freqNode.offset.linearRampToValueAtTime(target, t + g);
      } else {
        freqNode.offset.cancelScheduledValues(t);
        freqNode.offset.setValueAtTime(target, t);
      }
    };

    const gateModules = gateConnRef.current.get('kb1:gate_out') ?? new Set<string>();
    const triggerOn  = (time: number, f: number) => { for (const id of gateModules) audioModulesRef.current.get(id)?.noteOn?.(time, f); };
    const triggerOff = (time: number)            => { for (const id of gateModules) audioModulesRef.current.get(id)?.noteOff?.(time); };

    if (on) {
      if (!held.includes(freq)) held.push(freq);
      const isFirst = held.length === 1;
      applyPitch(freq, !isFirst);        // instant on first note, glide on legato
      if (isFirst) triggerOn(t, freq);   // only gate-trigger ADSR on first note
    } else {
      const idx = held.indexOf(freq);
      if (idx >= 0) held.splice(idx, 1);

      if (held.length === 0) {
        triggerOff(t);                   // last note released → release envelope
      } else {
        applyPitch(held[held.length - 1], true);   // return legato to last held note
      }
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

  const handleKeyPitch = useCallback((val: number) => {
    const node = audioModulesRef.current.get('kb1')?.outputs.get('pitch_out') as
      (AudioNode & { offset?: AudioParam }) | undefined;
    if (node?.offset) node.offset.value = val;
  }, []);

  const handleKeyMod = useCallback((val: number) => {
    const node = audioModulesRef.current.get('kb1')?.outputs.get('mod_out') as
      (AudioNode & { offset?: AudioParam }) | undefined;
    if (node?.offset) node.offset.value = val;
  }, []);

  // handleMidiMon declared below after handleParamChange — useMIDI wired after it

  // ─── Add module ─────────────────────────────────────────────────────────────
  const handleAddModule = useCallback((typeId: string) => {
    if (typeId === 'keyboard') return;
    const typeDef = MODULE_TYPE_MAP.get(typeId);
    if (!typeDef) return;
    const id     = `${typeId}_${Date.now()}`;
    const params = getDefaultParams(typeDef);

    pushUndo(cables, modules);
    setModules(prev => {
      const { x, y } = findNextSlot(prev, typeId);
      return [...prev, { id, typeId, x, y, params }];
    });

    if (audioCtxRef.current) {
      audioModulesRef.current.set(id, createAudioModule(audioCtxRef.current, typeId, { ...params }));
    }
  }, []);

  // ─── Delete module ──────────────────────────────────────────────────────────
  const handleDeleteModule = useCallback((moduleId: string) => {
    pushUndo(cables, modules);
    setCables(prev => {
      const toRemove = prev.filter(c => c.fromModuleId === moduleId || c.toModuleId === moduleId);
      for (const cable of toRemove) {
        const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
        const toAudio   = audioModulesRef.current.get(cable.toModuleId);
        if (fromAudio && toAudio) disconnectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
      }
      return prev.filter(c => c.fromModuleId !== moduleId && c.toModuleId !== moduleId);
    });
    for (const k of [...gateConnRef.current.keys()]) if (k.startsWith(`${moduleId}:`)) gateConnRef.current.delete(k);
    for (const set of gateConnRef.current.values()) set.delete(moduleId);
    const audio = audioModulesRef.current.get(moduleId);
    if (audio) { try { audio.destroy(); } catch (_) {} audioModulesRef.current.delete(moduleId); }
    setModules(prev => prev.filter(m => m.id !== moduleId));
  }, []);

  // ─── Param / selector change ────────────────────────────────────────────────
  const handleParamChange = useCallback((moduleId: string, paramId: string, value: number) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, params: { ...m.params, [paramId]: value } } : m));
    audioModulesRef.current.get(moduleId)?.setParam(paramId, value);
    if (moduleId === 'kb1' && paramId === 'glide') glideRef.current = value;
  }, []);

  const handleSelectorChange = useCallback((moduleId: string, selId: string, value: number) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, params: { ...m.params, [selId]: value } } : m));
    audioModulesRef.current.get(moduleId)?.setSelector?.(selId, value);
  }, []);

  const handleLoadSample = useCallback((moduleId: string, file: File, bankIndex: number) => {
    const audio = audioModulesRef.current.get(moduleId);
    if (!audio?.loadSample) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const buf = e.target?.result;
      if (!(buf instanceof ArrayBuffer)) return;
      try {
        await audio.loadSample!(buf, bankIndex);
        setSamplerBanks(prev => {
          const next = new Map(prev);
          const banks = [...(next.get(moduleId) ?? new Array(8).fill(false))];
          banks[bankIndex] = true;
          next.set(moduleId, banks);
          return next;
        });
      } catch (_) {}
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ─── MIDI monitor + CC→knob auto-mapping ─────────────────────────────────
  const handleMidiMon = useCallback((ev: MidiMonEvent) => {
    // ── MIDI monitor display ──
    setMidiMonData(prev => {
      if (ev.type === 'noteOn') {
        const name = NOTE_NAMES_MON[ev.note % 12] + (Math.floor(ev.note / 12) - 1);
        return { ...prev, gate: true, note: ev.note, noteName: name, velocity: ev.velocity, channel: ev.channel, noteCount: prev.noteCount + 1 };
      }
      if (ev.type === 'noteOff')  return { ...prev, gate: false };
      if (ev.type === 'bend')     return { ...prev, pitchBend: ev.bend };
      if (ev.type === 'cc' && ev.num === 1) return { ...prev, modWheel: ev.val / 127, lastCC: { num: ev.num, val: ev.val } };
      if (ev.type === 'cc')       return { ...prev, lastCC: { num: ev.num, val: ev.val } };
      return prev;
    });

    // ── Light up keyboard keys for incoming MIDI notes ──
    if (ev.type === 'noteOn') {
      setMidiActiveNotes(prev => { const s = new Set(prev); s.add(ev.note); return s; });
    } else if (ev.type === 'noteOff') {
      setMidiActiveNotes(prev => { const s = new Set(prev); s.delete(ev.note); return s; });
    }

    // ── CC → knob auto-mapping (skip CC1 = mod wheel) ──
    if (ev.type === 'cc' && ev.num !== 1 && focusedModuleId) {
      if (!ccOrderRef.current.includes(ev.num)) {
        ccOrderRef.current = [...ccOrderRef.current, ev.num];
      }
      const pos = ccOrderRef.current.indexOf(ev.num);
      const focMod = modules.find(m => m.id === focusedModuleId);
      if (focMod) {
        const typeDef = MODULE_TYPE_MAP.get(focMod.typeId);
        if (typeDef && pos < typeDef.knobs.length) {
          const knob = typeDef.knobs[pos];
          const t = ev.val / 127;
          const value = knob.log && knob.min > 0 && knob.max > 0
            ? knob.min * Math.pow(knob.max / knob.min, t)
            : knob.min + t * (knob.max - knob.min);
          handleParamChange(focMod.id, knob.id, value);
        }
      }
    }
  }, [focusedModuleId, modules, handleParamChange]);

  // ─── MIDI Clock sync ────────────────────────────────────────────────────────
  const [midiClockInfo, setMidiClockInfo] = useState<MidiClockInfo>({ bpm: null, deviceName: null, locked: false });
  const midiClockInfoRef = useRef(midiClockInfo);
  midiClockInfoRef.current = midiClockInfo;

  const BPM_KNOB_IDS = new Set(['bpm']); // param ids that represent BPM across clock modules

  const handleMidiClock = useCallback((info: MidiClockInfo) => {
    setMidiClockInfo(info);
    if (info.locked && info.bpm !== null) {
      // Push rounded BPM to every module that has a 'bpm' param
      setModules(prev => prev.map(m => {
        if (!BPM_KNOB_IDS.has('bpm')) return m;
        const typeDef = MODULE_TYPE_MAP.get(m.typeId);
        if (!typeDef) return m;
        const hasBpm = typeDef.knobs.some(k => k.id === 'bpm');
        if (!hasBpm) return m;
        const bpmClamped = Math.max(20, Math.min(300, Math.round(info.bpm!)));
        audioModulesRef.current.get(m.id)?.setParam('bpm', bpmClamped);
        return { ...m, params: { ...m.params, bpm: bpmClamped } };
      }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleMidiClockLock = useCallback(() => {
    setMidiClockLocked(!midiClockInfoRef.current.locked);
  }, []);

  const handleFreezeKill = useCallback((moduleId: string) => {
    audioModulesRef.current.get(moduleId)?.kill?.();
  }, []);

  // ─── Patch save / load ───────────────────────────────────────────────────────
  const handleSavePatch = useCallback(() => {
    setSaveDialogInput('my-patch');
    setSaveDialogOpen(true);
  }, []);

  const handleConfirmSave = useCallback((name: string) => {
    const safeName = name.trim().replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'my-patch';
    const patch = { version: 1, modules, cables };
    const json  = JSON.stringify(patch, null, 2);
    const blob  = new Blob([json], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href      = url;
    a.download  = `${safeName}.synth`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveDialogOpen(false);
  }, [modules, cables]);

  const handleLoadPatch = useCallback((json: string) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    let patch: { version?: number; modules?: ModuleInstance[]; cables?: Cable[] };
    try { patch = JSON.parse(json); } catch { return; }
    if (!Array.isArray(patch.modules) || !Array.isArray(patch.cables)) return;

    pushUndo(cables, modules);

    // Tear down all current audio
    for (const nodes of audioModulesRef.current.values()) {
      try { nodes.destroy(); } catch (_) {}
    }
    audioModulesRef.current.clear();
    gateConnRef.current.clear();
    portGateMapRef.current.clear();

    // Rebuild from patch
    for (const mod of patch.modules) {
      const audio = createAudioModule(ctx, mod.typeId, { ...mod.params });
      audioModulesRef.current.set(mod.id, audio);
      // Selectors aren't applied by the constructor — apply them now
      const typeDef = MODULE_TYPE_MAP.get(mod.typeId);
      for (const sel of typeDef?.selectors ?? []) {
        const val = mod.params[sel.id] ?? sel.default;
        audio.setSelector?.(sel.id, val);
      }
    }

    // Re-connect cables
    for (const cable of patch.cables) {
      const fromTypeDef = MODULE_TYPE_MAP.get(patch.modules!.find(m => m.id === cable.fromModuleId)?.typeId ?? '');
      const fromPort    = fromTypeDef?.ports.find(p => p.id === cable.fromPortId);
      if (fromPort?.type === 'gate_out') {
        const gk = `${cable.fromModuleId}:${cable.fromPortId}`;
        if (!gateConnRef.current.has(gk)) gateConnRef.current.set(gk, new Set());
        gateConnRef.current.get(gk)!.add(cable.toModuleId);
        if (!portGateMapRef.current.has(gk)) portGateMapRef.current.set(gk, new Map());
        portGateMapRef.current.get(gk)!.set(cable.toModuleId, cable.toPortId);
      } else {
        const fa = audioModulesRef.current.get(cable.fromModuleId);
        const ta = audioModulesRef.current.get(cable.toModuleId);
        if (fa && ta) connectAudioPorts(fa, cable.fromPortId, ta, cable.toPortId);
      }
    }

    setCables(patch.cables);
    setModules(patch.modules);
  }, [cables, modules, pushUndo]);

  const handleLoadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // MIDI input — routes USB keyboard events + Minilab CC→knob mapping + MIDI Clock
  const { status: midiStatus, deviceCount: midiDeviceCount } = useMIDI(handleKeyNote, handleKeyBend, handleKeyMod, handleMidiMon, handleMidiClock);

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
    if (exists) {
      // Second click on the other end of an existing cable → cut it
      const fromTypeDef = MODULE_TYPE_MAP.get(modules.find(m => m.id === fromModuleId)?.typeId ?? '');
      const fromPort    = fromTypeDef?.ports.find(p => p.id === fromPortId);
      if (fromPort?.type === 'gate_out') {
        gateConnRef.current.get(`${fromModuleId}:${fromPortId}`)?.delete(moduleId);
        portGateMapRef.current.get(`${fromModuleId}:${fromPortId}`)?.delete(moduleId);
      } else {
        const fromAudio = audioModulesRef.current.get(fromModuleId);
        const toAudio   = audioModulesRef.current.get(moduleId);
        if (fromAudio && toAudio) disconnectAudioPorts(fromAudio, fromPortId, toAudio, portId);
      }
      setCables(prev => prev.filter(c => c.id !== exists.id));
      setPendingCable(null);
      return;
    }

    pushUndo(cables, modules);
    const color    = CABLE_COLORS[cables.length % CABLE_COLORS.length];
    const newCable: Cable = {
      id: `cable_${Date.now()}`, fromModuleId, fromPortId, toModuleId: moduleId, toPortId: portId, color,
    };

    if (fromSig === 'gate') {
      const gk = `${fromModuleId}:${fromPortId}`;
      if (!gateConnRef.current.has(gk)) gateConnRef.current.set(gk, new Set());
      gateConnRef.current.get(gk)!.add(moduleId);
      // Track which port on the destination is connected (for per-port drum dispatch)
      if (!portGateMapRef.current.has(gk)) portGateMapRef.current.set(gk, new Map());
      portGateMapRef.current.get(gk)!.set(moduleId, portId);
      // For self-clocking modules register a per-port trigger callback
      const fromAudio = audioModulesRef.current.get(fromModuleId);
      const makeGateCb = (key: string) => (on: boolean, freq: number) => {
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        for (const id of gateConnRef.current.get(key) ?? []) {
          const m = audioModulesRef.current.get(id);
          if (!m) continue;
          const toPortId    = portGateMapRef.current.get(key)?.get(id);
          const portHandler = toPortId ? m.portNoteOn?.get(toPortId) : undefined;
          try {
            if (portHandler) {
              if (on) portHandler(getCurrentTickAudioTime() || ctx.currentTime, freq);
            } else {
              if (on) m.noteOn?.(getCurrentTickAudioTime() || ctx.currentTime, freq);
              else    m.noteOff?.(getCurrentTickAudioTime() || ctx.currentTime);
            }
          } catch (_) {}
        }
      };
      if (fromAudio?.setPortGateTrigger) {
        fromAudio.setPortGateTrigger(fromPortId, makeGateCb(gk));
      } else if (fromAudio?.setGateTrigger) {
        fromAudio.setGateTrigger(makeGateCb(gk));
      }
    } else {
      const fromAudio = audioModulesRef.current.get(fromModuleId);
      const toAudio   = audioModulesRef.current.get(moduleId);
      if (fromAudio && toAudio) connectAudioPorts(fromAudio, fromPortId, toAudio, portId);
    }

    setCables(prev => [...prev, newCable]);
    setPendingCable(null);
  }, [pendingCable, cables, modules]);

  // ─── Double-click any port → cut all cables touching it ─────────────────────
  const handlePortDoubleClick = useCallback((moduleId: string, portId: string) => {
    pushUndo(cables, modules);
    setCables(prev => {
      const toRemove = prev.filter(c =>
        (c.fromModuleId === moduleId && c.fromPortId === portId) ||
        (c.toModuleId   === moduleId && c.toPortId   === portId)
      );
      toRemove.forEach(cable => {
        const fromTypeDef = MODULE_TYPE_MAP.get(modules.find(m => m.id === cable.fromModuleId)?.typeId ?? '');
        const fromPort    = fromTypeDef?.ports.find(p => p.id === cable.fromPortId);
        if (fromPort?.type === 'gate_out') {
          gateConnRef.current.get(`${cable.fromModuleId}:${cable.fromPortId}`)?.delete(cable.toModuleId);
          portGateMapRef.current.get(`${cable.fromModuleId}:${cable.fromPortId}`)?.delete(cable.toModuleId);
        } else {
          const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
          const toAudio   = audioModulesRef.current.get(cable.toModuleId);
          if (fromAudio && toAudio) disconnectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
        }
      });
      return prev.filter(c =>
        !(c.fromModuleId === moduleId && c.fromPortId === portId) &&
        !(c.toModuleId   === moduleId && c.toPortId   === portId)
      );
    });
    setPendingCable(null);
  }, [modules]);

  // ─── Remove cable ───────────────────────────────────────────────────────────
  const handleRemoveCable = useCallback((cableId: string) => {
    pushUndo(cables, modules);
    setCables(prev => {
      const cable = prev.find(c => c.id === cableId);
      if (!cable) return prev;
      const fromTypeDef = MODULE_TYPE_MAP.get(modules.find(m => m.id === cable.fromModuleId)?.typeId ?? '');
      const fromPort    = fromTypeDef?.ports.find(p => p.id === cable.fromPortId);
      if (fromPort?.type === 'gate_out') {
        gateConnRef.current.get(`${cable.fromModuleId}:${cable.fromPortId}`)?.delete(cable.toModuleId);
        portGateMapRef.current.get(`${cable.fromModuleId}:${cable.fromPortId}`)?.delete(cable.toModuleId);
      } else {
        const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
        const toAudio   = audioModulesRef.current.get(cable.toModuleId);
        if (fromAudio && toAudio) disconnectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
      }
      return prev.filter(c => c.id !== cableId);
    });
  }, [modules]);

  // ─── Grab cable end → disconnect + become pending (re-patch) ─────────────────
  const handleGrabCableEnd = useCallback((cableId: string) => {
    const cable = cables.find(c => c.id === cableId);
    if (!cable) return;
    pushUndo(cables, modules);
    const fromTypeDef = MODULE_TYPE_MAP.get(modules.find(m => m.id === cable.fromModuleId)?.typeId ?? '');
    const fromPort    = fromTypeDef?.ports.find(p => p.id === cable.fromPortId);
    if (fromPort?.type === 'gate_out') {
      gateConnRef.current.get(`${cable.fromModuleId}:${cable.fromPortId}`)?.delete(cable.toModuleId);
      portGateMapRef.current.get(`${cable.fromModuleId}:${cable.fromPortId}`)?.delete(cable.toModuleId);
    } else {
      const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
      const toAudio   = audioModulesRef.current.get(cable.toModuleId);
      if (fromAudio && toAudio) disconnectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
    }
    setCables(prev => prev.filter(c => c.id !== cableId));
    setPendingCable({
      fromModuleId: cable.fromModuleId,
      fromPortId:   cable.fromPortId,
      fromPortType: (fromPort?.type ?? 'audio_out') as import('../types').PortType,
      color: cable.color,
    });
  }, [cables, modules]);

  // ─── Drag (snap on release) ─────────────────────────────────────────────────
  const handleDragStart = useCallback((moduleId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;
    dragRef.current = {
      moduleId, startX: e.clientX, startY: e.clientY, origX: mod.x, origY: mod.y,
      origScrollLeft: rackRef.current?.scrollLeft ?? 0,
      origScrollTop:  rackRef.current?.scrollTop  ?? 0,
    };
  }, [modules]);

  useEffect(() => {
    const EDGE = 60;      // px from edge to start scrolling
    const MAX_SPD = 14;   // max scroll px per frame

    // Three independent RAF slots:
    //  edgeRafId – continuous edge-scroll loop (drag or cable near rack border)
    //  dragRafId  – throttled module-position update during normal drag
    //  cableRafId – throttled cable-tail mouse-pos update during patching
    let edgeRafId  = 0;
    let dragRafId  = 0;
    let cableRafId = 0;
    let lastMouse  = { x: 0, y: 0 };

    const edgeScroll = () => {
      edgeRafId = 0;
      const hasDrag  = !!dragRef.current;
      const hasCable = !!pendingCableRef.current;
      if ((!hasDrag && !hasCable) || !rackRef.current) return;
      const r = rackRef.current.getBoundingClientRect();
      const mx = lastMouse.x;
      const my = lastMouse.y;
      let dx = 0, dy = 0;
      if (mx < r.left + EDGE)   dx = -MAX_SPD * (1 - (mx - r.left)   / EDGE);
      if (mx > r.right - EDGE)  dx =  MAX_SPD * (1 - (r.right - mx)  / EDGE);
      if (my < r.top  + EDGE)   dy = -MAX_SPD * (1 - (my - r.top)    / EDGE);
      if (my > r.bottom - EDGE) dy =  MAX_SPD * (1 - (r.bottom - my) / EDGE);
      if (dx || dy) {
        rackRef.current.scrollLeft += dx;
        rackRef.current.scrollTop  += dy;
        if (hasDrag) {
          const { moduleId, startX, startY, origX, origY, origScrollLeft, origScrollTop } = dragRef.current!;
          const sl = rackRef.current.scrollLeft;
          const st = rackRef.current.scrollTop;
          setModules(prev => prev.map(m =>
            m.id === moduleId
              ? { ...m,
                  x: Math.max(0, origX + mx - startX + sl - origScrollLeft),
                  y: Math.max(0, origY + my - startY + st - origScrollTop) }
              : m
          ));
        }
        if (hasCable) {
          setMousePos({
            x: mx - r.left + rackRef.current.scrollLeft,
            y: my - r.top  + rackRef.current.scrollTop,
          });
        }
        edgeRafId = requestAnimationFrame(edgeScroll);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      lastMouse = { x: e.clientX, y: e.clientY };

      // Cable-tail position: only update when actively patching, throttled to RAF rate.
      // Avoids full SynthApp re-renders from every mousemove when no cable is pending.
      if (pendingCableRef.current && !cableRafId) {
        cableRafId = requestAnimationFrame(() => {
          cableRafId = 0;
          if (!rackRef.current) return;
          const r = rackRef.current.getBoundingClientRect();
          setMousePos({
            x: lastMouse.x - r.left + rackRef.current.scrollLeft,
            y: lastMouse.y - r.top  + rackRef.current.scrollTop,
          });
        });
      }

      // Module drag: RAF-throttled position update (same fix as knobs).
      if (dragRef.current && !dragRafId) {
        dragRafId = requestAnimationFrame(() => {
          dragRafId = 0;
          if (!dragRef.current || !rackRef.current) return;
          const { moduleId, startX, startY, origX, origY, origScrollLeft, origScrollTop } = dragRef.current;
          const sl = rackRef.current.scrollLeft;
          const st = rackRef.current.scrollTop;
          setModules(prev => prev.map(m =>
            m.id === moduleId
              ? { ...m,
                  x: Math.max(0, origX + lastMouse.x - startX + sl - origScrollLeft),
                  y: Math.max(0, origY + lastMouse.y - startY + st - origScrollTop) }
              : m
          ));
        });
      }

      // Edge-scroll loop
      if ((dragRef.current || pendingCableRef.current) && !edgeRafId) {
        edgeRafId = requestAnimationFrame(edgeScroll);
      }
    };

    const onMouseUp = () => {
      if (edgeRafId)  { cancelAnimationFrame(edgeRafId);  edgeRafId  = 0; }
      if (dragRafId)  { cancelAnimationFrame(dragRafId);  dragRafId  = 0; }
      if (cableRafId) { cancelAnimationFrame(cableRafId); cableRafId = 0; }
      if (dragRef.current) {
        const { moduleId } = dragRef.current;
        setModules(prev => prev.map(m => {
          if (m.id !== moduleId) return m;
          const snapped = snapToSlot(m.x, m.y, prev, moduleId);
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
      if (edgeRafId)  cancelAnimationFrame(edgeRafId);
      if (dragRafId)  cancelAnimationFrame(dragRafId);
      if (cableRafId) cancelAnimationFrame(cableRafId);
    };
  }, []);

  // Cancel pending cable on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPendingCable(null); return; }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleUndo(); return; }
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSavePatch(); return; }
      if (e.key === 'o' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleLoadClick(); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleSavePatch, handleLoadClick]);

  // Legacy keyboard handler (for any keyboard module instances in modules list — none by default)
  const handleModuleKeyPress = useCallback((moduleId: string, freq: number, on: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime + 0.008;
    const audio    = audioModulesRef.current.get(moduleId);
    const freqNode = audio?.outputs.get('voct_out') as (AudioNode & { offset?: AudioParam }) | undefined;
    if (freqNode && 'offset' in freqNode && freqNode.offset) {
      freqNode.offset.cancelScheduledValues(t);
      freqNode.offset.setValueAtTime(on ? freq : 0, t);
    }
    const connected = gateConnRef.current.get(`${moduleId}:gate_out`);
    for (const id of connected ?? []) {
      const m = audioModulesRef.current.get(id);
      if (on) m?.noteOn?.(t, freq);
      else    m?.noteOff?.(t);
    }
  }, []);

  // Connected ports set
  const connectedPortsSet = new Set<string>();
  // ─── CV-to-knob live animation map ─────────────────────────────────────────
  // Maps moduleId → (paramId → getLevel fn) for knobs that have a CV cable.
  // Port naming convention: portId ending in "_cv" modulates the param whose id
  // is the portion before "_cv" (e.g. "res_cv" → "res", "cutoff_cv" → "cutoff").
  const cvLevelMap = useMemo(() => {
    const map = new Map<string, Map<string, () => number>>();
    for (const cable of cables) {
      if (!cable.toPortId.endsWith('_cv')) continue;
      const paramId   = cable.toPortId.slice(0, -3); // strip "_cv"
      const toMod     = modules.find(m => m.id === cable.toModuleId);
      const toTypeDef = toMod ? MODULE_TYPE_MAP.get(toMod.typeId) : undefined;
      if (!toTypeDef?.knobs.find(k => k.id === paramId)) continue;
      const srcGetLevel = audioModulesRef.current.get(cable.fromModuleId)?.getLevel;
      if (!srcGetLevel) continue;
      if (!map.has(cable.toModuleId)) map.set(cable.toModuleId, new Map());
      map.get(cable.toModuleId)!.set(paramId, srcGetLevel);
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cables, modules, started]); // `started` gates audioModulesRef population

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
            <div className="flex justify-center mb-2">
              <svg width="72" height="72" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="180" height="180" rx="36" fill="#E87D27"/>
                <rect x="27" y="30" width="30" height="38" rx="5" fill="white"/>
                <rect x="75" y="30" width="30" height="38" rx="5" fill="white"/>
                <rect x="123" y="30" width="30" height="38" rx="5" fill="white"/>
                <rect x="27" y="60" width="126" height="90" rx="5" fill="white"/>
                <circle cx="54" cy="97" r="13" fill="#E87D27"/>
                <circle cx="126" cy="97" r="13" fill="#E87D27"/>
                <path d="M76 150 L76 117 Q76 103 90 103 Q104 103 104 117 L104 150 Z" fill="#E87D27"/>
              </svg>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-[0.4em] uppercase mb-1" style={{ color: '#e87d27' }}>OrangeCastle</div>
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
            onGrabCableEnd={handleGrabCableEnd}
            cableOpacity={cableOpacity}
          />

          {modules.map(mod => (
            <div
              key={mod.id}
              className="absolute"
              style={{ left: mod.x, top: mod.y }}
              onMouseEnter={() => setFocusedModuleId(mod.id)}
              onMouseLeave={() => setFocusedModuleId(prev => prev === mod.id ? null : prev)}
            >
              <ModulePanel
                module={mod}
                connectedPorts={connectedPortsSet}
                pendingCable={pendingCable}
                onPortClick={handlePortClick}
                onPortDoubleClick={handlePortDoubleClick}
                onParamChange={handleParamChange}
                onSelectorChange={handleSelectorChange}
                midiMonitorData={mod.typeId === 'midi_monitor' ? midiMonData : undefined}
                isMidiTarget={midiStatus === 'ready' && mod.id === focusedModuleId && (MODULE_TYPE_MAP.get(mod.typeId)?.knobs.length ?? 0) > 0}
                onDragStart={handleDragStart}
                onDelete={handleDeleteModule}
                onRegisterPortRef={registerPortRef}
                onKeyPress={handleModuleKeyPress}
                analyser={mod.typeId === 'output' ? audioModulesRef.current.get(mod.id)?.analyser : undefined}
                moduleStepRef={(mod.typeId === 'drum_machine' || mod.typeId === 'euclidean_trig' || mod.typeId === 'poly_step')
                  ? audioModulesRef.current.get(mod.id)?.stepRef
                  : undefined}
                getLevelFn={audioModulesRef.current.get(mod.id)?.getLevel}
                cvLevels={cvLevelMap.get(mod.id)}
                onLoadSample={mod.typeId === 'sampler' ? (file, bank) => handleLoadSample(mod.id, file, bank) : undefined}
                samplerBanksFilled={mod.typeId === 'sampler' ? samplerBanks.get(mod.id) : undefined}
                midiClockInfo={mod.typeId === 'midi_clock_in' ? midiClockInfo : undefined}
                onToggleMidiClockLock={mod.typeId === 'midi_clock_in' ? handleToggleMidiClockLock : undefined}
                onFreezeKill={mod.typeId === 'freeze_proc' ? () => handleFreezeKill(mod.id) : undefined}
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

      {/* Save patch name dialog */}
      {saveDialogOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setSaveDialogOpen(false)}
        >
          <div
            style={{
              background: '#141414', border: '1px solid #2a2a2a', borderRadius: 6,
              padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14,
              minWidth: 280, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 8, letterSpacing: '0.22em', color: '#555', textTransform: 'uppercase' }}>
              SAVE PATCH
            </div>
            <input
              autoFocus
              value={saveDialogInput}
              onChange={e => setSaveDialogInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleConfirmSave(saveDialogInput);
                if (e.key === 'Escape') setSaveDialogOpen(false);
              }}
              placeholder="my-patch"
              style={{
                background: '#0a0a0a', border: '1px solid #333', borderRadius: 3,
                color: '#ccc', fontSize: 13, padding: '7px 10px', fontFamily: 'monospace',
                outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 7, color: '#444', letterSpacing: '0.08em', marginTop: -8 }}>
              file will be saved as <span style={{ color: '#666' }}>{(saveDialogInput.trim() || 'my-patch').replace(/[^a-zA-Z0-9_\- ]/g, '') || 'my-patch'}.synth</span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSaveDialogOpen(false)}
                style={{
                  height: 26, padding: '0 12px', fontSize: 8, letterSpacing: '0.14em',
                  borderRadius: 3, cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase',
                  border: '1px solid #2a2a2a', background: '#181818', color: '#555',
                }}
              >CANCEL</button>
              <button
                onClick={() => handleConfirmSave(saveDialogInput)}
                style={{
                  height: 26, padding: '0 14px', fontSize: 8, letterSpacing: '0.14em',
                  borderRadius: 3, cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase',
                  border: '1px solid #c96a1a', background: '#e87d27', color: '#000',
                }}
              >SAVE</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for patch loading */}
      <input
        type="file"
        accept=".synth,.json"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = ev => {
            if (typeof ev.target?.result === 'string') handleLoadPatch(ev.target.result);
          };
          reader.readAsText(file);
          e.target.value = '';
        }}
      />

      {/* Fixed keyboard panel — always at the bottom */}
      <FixedKeyboardPanel
        started={started}
        onNote={handleKeyNote}
        onBend={handleKeyBend}
        onPitch={handleKeyPitch}
        onMod={handleKeyMod}
        onUndo={handleUndo}
        undoAvail={undoAvail}
        cableOpacity={cableOpacity}
        onCableOpacity={setCableOpacity}
        midiStatus={midiStatus}
        midiDeviceCount={midiDeviceCount}
        midiActiveNotes={midiActiveNotes}
        onSave={handleSavePatch}
        onLoad={handleLoadClick}
      />
    </div>
  );
}
