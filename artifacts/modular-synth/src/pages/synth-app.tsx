import { useState, useRef, useCallback, useEffect } from 'react';
import { ModuleInstance, Cable, PendingCable, PortType } from '../types';
import {
  MODULE_TYPE_MAP, CATEGORY_ORDER, CATEGORY_LABELS, CATEGORY_COLORS,
  CABLE_COLORS, getDefaultParams, MODULE_TYPES,
} from '../moduleDefinitions';
import { AudioModuleNodes, createAudioModule, connectAudioPorts, disconnectAudioPorts } from '../audioEngine';
import ModulePanel from '../components/ModulePanel';

// ─── Default patch ────────────────────────────────────────────────────────────
const DEFAULT_MODULES: ModuleInstance[] = [
  { id: 'kb1', typeId: 'keyboard', x: 30, y: 40, params: { octave: 4 } },
  { id: 'vco1', typeId: 'analog_vco', x: 420, y: 40, params: { freq: 0, fine: 0, wave: 0 } },
  { id: 'vcf1', typeId: 'vcf', x: 640, y: 40, params: { cutoff: 900, res: 2, type: 0 } },
  { id: 'adsr1', typeId: 'adsr', x: 640, y: 340, params: { attack: 0.01, decay: 0.12, sustain: 0.65, release: 0.4 } },
  { id: 'vca1', typeId: 'vca', x: 870, y: 40, params: { gain: 0 } },
  { id: 'out1', typeId: 'output', x: 1080, y: 40, params: { volume: 0.7 } },
];

const DEFAULT_CABLES: Cable[] = [
  { id: 'c1', fromModuleId: 'kb1', fromPortId: 'voct_out', toModuleId: 'vco1', toPortId: 'voct', color: '#4d96ff' },
  { id: 'c2', fromModuleId: 'vco1', fromPortId: 'out', toModuleId: 'vcf1', toPortId: 'audio_in', color: '#f97316' },
  { id: 'c3', fromModuleId: 'vcf1', fromPortId: 'out', toModuleId: 'vca1', toPortId: 'audio_in', color: '#14b8a6' },
  { id: 'c4', fromModuleId: 'adsr1', fromPortId: 'env_out', toModuleId: 'vca1', toPortId: 'cv_in', color: '#a855f7' },
  { id: 'c5', fromModuleId: 'vca1', fromPortId: 'out', toModuleId: 'out1', toPortId: 'in_l', color: '#22c55e' },
  { id: 'c6', fromModuleId: 'kb1', fromPortId: 'gate_out', toModuleId: 'adsr1', toPortId: 'gate_in', color: '#86efac' },
];

const CONTENT_W = 2400;
const CONTENT_H = 1400;

// ─── Module Browser ───────────────────────────────────────────────────────────
function ModuleBrowser({ onAdd }: { onAdd: (typeId: string) => void }) {
  const byCategory = CATEGORY_ORDER.map(cat => ({
    cat,
    label: CATEGORY_LABELS[cat],
    types: MODULE_TYPES.filter(m => m.category === cat),
  })).filter(g => g.types.length > 0);

  const catColors = CATEGORY_COLORS;

  return (
    <div className="w-52 flex-shrink-0 flex flex-col border-r border-[#2a2a2a] bg-[#0f0f0f] z-10 overflow-y-auto" data-testid="module-browser">
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
                  style={{ borderLeft: `3px solid ${catColors[cat] ?? '#555'}`, color: '#bbb' }}
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
        <div>Click port → click port to patch</div>
        <div>Right-click cable to remove</div>
        <div>Drag module header to move</div>
      </div>
    </div>
  );
}

// ─── Patch cable SVG ──────────────────────────────────────────────────────────
function PatchCables({
  cables,
  modules,
  pendingCable,
  mousePos,
  getPortCenter,
  onRemoveCable,
}: {
  cables: Cable[];
  modules: ModuleInstance[];
  pendingCable: PendingCable | null;
  mousePos: { x: number; y: number };
  getPortCenter: (modId: string, portId: string) => { x: number; y: number } | null;
  onRemoveCable: (id: string) => void;
}) {
  const makePath = (x1: number, y1: number, x2: number, y2: number): string => {
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
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        ))}
      </defs>

      {cables.map(c => {
        const from = getPortCenter(c.fromModuleId, c.fromPortId);
        const to = getPortCenter(c.toModuleId, c.toPortId);
        if (!from || !to) return null;
        const d = makePath(from.x, from.y, to.x, to.y);
        return (
          <g key={c.id} className="pointer-events-auto">
            {/* Hit area */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              style={{ cursor: 'pointer' }}
              onContextMenu={(e) => { e.preventDefault(); onRemoveCable(c.id); }}
            />
            {/* Shadow */}
            <path d={d} fill="none" stroke="#000" strokeWidth={5} strokeLinecap="round" opacity={0.5} />
            {/* Cable */}
            <path
              d={d}
              fill="none"
              stroke={c.color}
              strokeWidth={3.5}
              strokeLinecap="round"
              filter={`url(#glow-${c.id})`}
            />
          </g>
        );
      })}

      {/* Pending cable */}
      {pendingCable && (() => {
        const from = getPortCenter(pendingCable.fromModuleId, pendingCable.fromPortId);
        if (!from) return null;
        const d = makePath(from.x, from.y, mousePos.x, mousePos.y);
        return (
          <path
            d={d}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray="6 4"
            opacity={0.6}
          />
        );
      })()}
    </svg>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function SynthApp() {
  const [started, setStarted] = useState(false);
  const [modules, setModules] = useState<ModuleInstance[]>(DEFAULT_MODULES);
  const [cables, setCables] = useState<Cable[]>(DEFAULT_CABLES);
  const [pendingCable, setPendingCable] = useState<PendingCable | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioModulesRef = useRef<Map<string, AudioModuleNodes>>(new Map());
  // gate_out moduleId → Set of ADSR moduleIds
  const gateConnectionsRef = useRef<Map<string, Set<string>>>(new Map());

  // Register setGateTrigger callback on sequencers/clocks so they can fire noteOn/Off
  const registerGateTrigger = useCallback((fromModuleId: string) => {
    const fromAudio = audioModulesRef.current.get(fromModuleId);
    if (!fromAudio?.setGateTrigger) return;
    fromAudio.setGateTrigger((on: boolean, freq: number) => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const connected = gateConnectionsRef.current.get(fromModuleId);
      for (const toId of connected ?? []) {
        const toAudio = audioModulesRef.current.get(toId);
        if (on) toAudio?.noteOn?.(ctx.currentTime, freq);
        else toAudio?.noteOff?.(ctx.currentTime);
      }
    });
  }, []);
  // port DOM refs
  const portRefsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  // drag state
  const dragRef = useRef<{ moduleId: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const rackRef = useRef<HTMLDivElement>(null);

  const registerPortRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) portRefsRef.current.set(key, el);
    else portRefsRef.current.delete(key);
  }, []);

  const getPortCenter = useCallback((modId: string, portId: string): { x: number; y: number } | null => {
    const el = portRefsRef.current.get(`${modId}-${portId}`);
    const rack = rackRef.current;
    if (!el || !rack) return null;
    const elR = el.getBoundingClientRect();
    const rackR = rack.getBoundingClientRect();
    return {
      x: elR.left - rackR.left + rack.scrollLeft + elR.width / 2,
      y: elR.top - rackR.top + rack.scrollTop + elR.height / 2,
    };
  }, []);

  // Initialize audio on start
  const handleStart = useCallback(() => {
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    // Create audio modules
    for (const mod of DEFAULT_MODULES) {
      const audio = createAudioModule(ctx, mod.typeId, { ...mod.params });
      audioModulesRef.current.set(mod.id, audio);
    }

    // Connect cables
    for (const cable of DEFAULT_CABLES) {
      const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
      const toAudio = audioModulesRef.current.get(cable.toModuleId);
      const fromTypeDef = MODULE_TYPE_MAP.get(
        DEFAULT_MODULES.find(m => m.id === cable.fromModuleId)?.typeId ?? ''
      );
      const fromPort = fromTypeDef?.ports.find(p => p.id === cable.fromPortId);

      if (fromPort?.type === 'gate_out') {
        // Track gate connection
        const key = cable.fromModuleId;
        if (!gateConnectionsRef.current.has(key)) gateConnectionsRef.current.set(key, new Set());
        gateConnectionsRef.current.get(key)!.add(cable.toModuleId);
        registerGateTrigger(cable.fromModuleId);
      } else if (fromAudio && toAudio) {
        connectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
      }
    }

    setStarted(true);
  }, []);

  // Add module
  const handleAddModule = useCallback((typeId: string) => {
    const typeDef = MODULE_TYPE_MAP.get(typeId);
    if (!typeDef) return;
    const id = `${typeId}_${Date.now()}`;
    const params = getDefaultParams(typeDef);
    const newMod: ModuleInstance = { id, typeId, x: 200 + Math.random() * 200, y: 100 + Math.random() * 200, params };

    if (audioCtxRef.current) {
      const audio = createAudioModule(audioCtxRef.current, typeId, { ...params });
      audioModulesRef.current.set(id, audio);
    }

    setModules(prev => [...prev, newMod]);
  }, []);

  // Delete module — disconnect all cables
  const handleDeleteModule = useCallback((moduleId: string) => {
    setCables(prev => {
      const toRemove = prev.filter(c => c.fromModuleId === moduleId || c.toModuleId === moduleId);
      for (const cable of toRemove) {
        const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
        const toAudio = audioModulesRef.current.get(cable.toModuleId);
        if (fromAudio && toAudio) disconnectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
      }
      return prev.filter(c => c.fromModuleId !== moduleId && c.toModuleId !== moduleId);
    });

    // Remove gate connections
    gateConnectionsRef.current.delete(moduleId);
    for (const [key, set] of gateConnectionsRef.current) {
      set.delete(moduleId);
    }

    const audio = audioModulesRef.current.get(moduleId);
    if (audio) { audio.destroy(); audioModulesRef.current.delete(moduleId); }

    setModules(prev => prev.filter(m => m.id !== moduleId));
  }, []);

  // Param change
  const handleParamChange = useCallback((moduleId: string, paramId: string, value: number) => {
    setModules(prev => prev.map(m =>
      m.id === moduleId ? { ...m, params: { ...m.params, [paramId]: value } } : m
    ));
    const audio = audioModulesRef.current.get(moduleId);
    audio?.setParam(paramId, value);
  }, []);

  // Selector change
  const handleSelectorChange = useCallback((moduleId: string, selectorId: string, value: number) => {
    setModules(prev => prev.map(m =>
      m.id === moduleId ? { ...m, params: { ...m.params, [selectorId]: value } } : m
    ));
    const audio = audioModulesRef.current.get(moduleId);
    audio?.setSelector?.(selectorId, value);
  }, []);

  // Port click — start or complete a cable
  const handlePortClick = useCallback((moduleId: string, portId: string, portType: PortType) => {
    if (!pendingCable) {
      // Only start from output ports
      if (portType.endsWith('_out')) {
        setPendingCable({ fromModuleId: moduleId, fromPortId: portId, fromPortType: portType });
      }
      return;
    }

    // Completing the cable
    const { fromModuleId, fromPortId, fromPortType } = pendingCable;

    // Cancel if clicking same port or same module's output
    if (fromModuleId === moduleId && fromPortId === portId) {
      setPendingCable(null);
      return;
    }

    // Must be an input port
    if (!portType.endsWith('_in')) {
      setPendingCable(null);
      return;
    }

    // Type compatibility
    const fromSignal = fromPortType.replace('_out', '');
    const toSignal = portType.replace('_in', '');
    const isGate = fromSignal === 'gate';
    const toIsGate = toSignal === 'gate';
    if (isGate !== toIsGate) {
      setPendingCable(null);
      return;
    }

    // Don't duplicate
    const exists = cables.find(c =>
      c.fromModuleId === fromModuleId && c.fromPortId === fromPortId &&
      c.toModuleId === moduleId && c.toPortId === portId
    );
    if (exists) { setPendingCable(null); return; }

    const color = CABLE_COLORS[cables.length % CABLE_COLORS.length];
    const newCable: Cable = {
      id: `cable_${Date.now()}`,
      fromModuleId, fromPortId,
      toModuleId: moduleId, toPortId: portId,
      color,
    };

    // Wire up audio
    if (isGate) {
      const key = fromModuleId;
      if (!gateConnectionsRef.current.has(key)) gateConnectionsRef.current.set(key, new Set());
      gateConnectionsRef.current.get(key)!.add(moduleId);
      registerGateTrigger(fromModuleId);
    } else {
      const fromAudio = audioModulesRef.current.get(fromModuleId);
      const toAudio = audioModulesRef.current.get(moduleId);
      if (fromAudio && toAudio) connectAudioPorts(fromAudio, fromPortId, toAudio, portId);
    }

    setCables(prev => [...prev, newCable]);
    setPendingCable(null);
  }, [pendingCable, cables]);

  // Remove cable
  const handleRemoveCable = useCallback((cableId: string) => {
    setCables(prev => {
      const cable = prev.find(c => c.id === cableId);
      if (!cable) return prev;

      const fromTypeDef = MODULE_TYPE_MAP.get(modules.find(m => m.id === cable.fromModuleId)?.typeId ?? '');
      const fromPort = fromTypeDef?.ports.find(p => p.id === cable.fromPortId);

      if (fromPort?.type === 'gate_out') {
        gateConnectionsRef.current.get(cable.fromModuleId)?.delete(cable.toModuleId);
      } else {
        const fromAudio = audioModulesRef.current.get(cable.fromModuleId);
        const toAudio = audioModulesRef.current.get(cable.toModuleId);
        if (fromAudio && toAudio) disconnectAudioPorts(fromAudio, cable.fromPortId, toAudio, cable.toPortId);
      }

      return prev.filter(c => c.id !== cableId);
    });
  }, [modules]);

  // Keyboard note press
  const handleKeyPress = useCallback((moduleId: string, freq: number, on: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const audio = audioModulesRef.current.get(moduleId);
    if (!audio) return;

    // Update V/OCT frequency node
    const freqNode = audio.outputs.get('voct_out') as (AudioNode & { offset?: AudioParam }) | undefined;
    if (freqNode && 'offset' in freqNode && freqNode.offset) {
      freqNode.offset.value = on ? freq : 0;
    }

    // Trigger gate-connected ADSRs
    const connected = gateConnectionsRef.current.get(moduleId);
    if (connected) {
      for (const adsrId of connected) {
        const adsrAudio = audioModulesRef.current.get(adsrId);
        if (on) adsrAudio?.noteOn?.(ctx.currentTime, freq);
        else adsrAudio?.noteOff?.(ctx.currentTime);
      }
    }
  }, []);

  // Drag modules
  const handleDragStart = useCallback((moduleId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;
    dragRef.current = { moduleId, startX: e.clientX, startY: e.clientY, origX: mod.x, origY: mod.y };
  }, [modules]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      // Track mouse for pending cable
      if (rackRef.current) {
        const r = rackRef.current.getBoundingClientRect();
        setMousePos({
          x: e.clientX - r.left + rackRef.current.scrollLeft,
          y: e.clientY - r.top + rackRef.current.scrollTop,
        });
      }

      // Drag module
      if (dragRef.current) {
        const { moduleId, startX, startY, origX, origY } = dragRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        setModules(prev => prev.map(m =>
          m.id === moduleId
            ? { ...m, x: Math.max(0, origX + dx), y: Math.max(0, origY + dy) }
            : m
        ));
      }
    };

    const onMouseUp = () => { dragRef.current = null; };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Cancel pending cable on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingCable(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
              Pre-loaded with Keyboard → VCO → VCF → VCA → Output.
              Press keys on the keyboard module to play.
            </div>
            <button
              onClick={handleStart}
              className="px-10 py-3 text-sm font-bold tracking-[0.2em] uppercase rounded border transition-all hover:scale-105 active:scale-95"
              style={{
                background: '#e87d27',
                color: '#000',
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

      {/* Rack */}
      <div
        ref={rackRef}
        className="flex-1 overflow-auto relative rack-bg"
        onClick={() => { if (pendingCable) setPendingCable(null); }}
        data-testid="rack-workspace"
      >
        <div className="relative" style={{ width: CONTENT_W, height: CONTENT_H }}>
          {/* Cable SVG */}
          <PatchCables
            cables={cables}
            modules={modules}
            pendingCable={pendingCable}
            mousePos={mousePos}
            getPortCenter={getPortCenter}
            onRemoveCable={handleRemoveCable}
          />

          {/* Modules */}
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
                onKeyPress={handleKeyPress}
              />
            </div>
          ))}

          {/* Hint when pending cable */}
          {pendingCable && (
            <div
              className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 text-xs text-gray-400 rounded border border-[#333] bg-[#111]/90 backdrop-blur-sm z-50 pointer-events-none"
              style={{ zIndex: 100 }}
            >
              Click an input port to connect — ESC to cancel
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
