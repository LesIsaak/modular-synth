import { useEffect, useRef } from 'react';
import { PortDef, PortType } from '../types';

interface PortJackProps {
  moduleId: string;
  portDef: PortDef;
  isConnected: boolean;
  isPendingSource: boolean;
  canConnect: boolean;
  onPortClick: (moduleId: string, portId: string, type: PortType) => void;
  onPortDoubleClick?: (moduleId: string, portId: string) => void;
  onRegisterRef: (key: string, el: HTMLDivElement | null) => void;
  /** For input ports: polls the incoming signal level (0–1) at ~60 fps */
  getInputLevel?: () => number;
}

export const PORT_COLORS: Record<PortType, string> = {
  audio_out: '#fbbf24',
  audio_in:  '#6b7280',
  cv_out:    '#67e8f9',
  cv_in:     '#6b7280',
  gate_out:  '#86efac',
  gate_in:   '#6b7280',
};

// Map input port type → glow color matching the output signal color
const INPUT_GLOW: Partial<Record<PortType, string>> = {
  audio_in: '#fbbf24',
  cv_in:    '#67e8f9',
  gate_in:  '#86efac',
};

export default function PortJack({
  moduleId,
  portDef,
  isConnected,
  isPendingSource,
  canConnect,
  onPortClick,
  onPortDoubleClick,
  onRegisterRef,
  getInputLevel,
}: PortJackProps) {
  const ref     = useRef<HTMLDivElement>(null);
  const glowRef = useRef<SVGCircleElement>(null);
  const rafRef  = useRef<number>(0);
  const key = `${moduleId}-${portDef.id}`;

  useEffect(() => {
    onRegisterRef(key, ref.current);
    return () => onRegisterRef(key, null);
  }, [key, onRegisterRef]);

  // Animate receive glow for connected input ports
  useEffect(() => {
    if (!getInputLevel || !glowRef.current) return;
    const tick = () => {
      if (glowRef.current) {
        const v = Math.min(1, Math.max(0, getInputLevel()));
        glowRef.current.style.opacity = String(v * 0.72);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [getInputLevel]);

  const isOut    = portDef.type.endsWith('_out');
  const active   = isConnected || isPendingSource;
  const ringColor = active ? PORT_COLORS[portDef.type] : (isOut ? PORT_COLORS[portDef.type] : '#4b5563');
  const glowColor = INPUT_GLOW[portDef.type];

  const rimId    = `rim-${key}`;
  const holeId   = `hole-${key}`;
  const shineId  = `shine-${key}`;

  return (
    <div className="flex flex-col items-center gap-0.5" data-testid={`port-${moduleId}-${portDef.id}`}>
      <div
        ref={ref}
        className="hover:scale-110 active:scale-95 transition-transform"
        style={{ position: 'relative', width: 26, height: 26 }}
      >
        {/* Expanded transparent hit-area so the full socket face is clickable */}
        <div
          style={{ position: 'absolute', inset: -9, cursor: 'pointer', zIndex: 1 }}
          onClick={e => { e.stopPropagation(); onPortClick(moduleId, portDef.id, portDef.type); }}
          onDoubleClick={e => { e.stopPropagation(); onPortDoubleClick?.(moduleId, portDef.id); }}
        />
        <svg width={26} height={26} viewBox="0 0 26 26" style={{ display: 'block' }}>
          <defs>
            <radialGradient id={rimId} cx="38%" cy="32%" r="60%">
              <stop offset="0%"   stopColor="#909090" />
              <stop offset="45%"  stopColor="#606060" />
              <stop offset="100%" stopColor="#282828" />
            </radialGradient>
            <radialGradient id={holeId} cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor={active ? ringColor : '#1c1c1c'} stopOpacity={active ? 0.35 : 1} />
              <stop offset="100%" stopColor="#040404" />
            </radialGradient>
            <radialGradient id={shineId} cx="35%" cy="28%" r="55%">
              <stop offset="0%"   stopColor="white" stopOpacity="0.15" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Drop shadow base */}
          <circle cx="13" cy="14" r="11.5" fill="black" opacity="0.55" />

          {/* Outer metal collar */}
          <circle cx="13" cy="13" r="11.5" fill={`url(#${rimId})`} />

          {/* Collar groove / dark ring */}
          <circle cx="13" cy="13" r="8.5"  fill="#111" />

          {/* Inner socket wall */}
          <circle cx="13" cy="13" r="7.5"
            fill="#242424"
            stroke="#383838"
            strokeWidth="0.6"
          />

          {/* Socket bore */}
          <circle cx="13" cy="13" r="6" fill={`url(#${holeId})`} />

          {/* Input receive glow — animated via RAF when signal arrives */}
          {glowColor && (
            <circle ref={glowRef} cx="13" cy="13" r="5.5"
              fill={glowColor} opacity={0}
              style={{ filter: `drop-shadow(0 0 3px ${glowColor})` }}
            />
          )}

          {/* Center contact (TRS tip) */}
          <circle cx="13" cy="13" r="2.2"
            fill={active ? ringColor : '#2e2e2e'}
            stroke={active ? 'none' : '#1a1a1a'}
            strokeWidth="0.5"
            style={{ filter: active ? `drop-shadow(0 0 3px ${ringColor})` : 'none' }}
          />

          {/* Metal sheen highlight */}
          <circle cx="13" cy="13" r="11.5" fill={`url(#${shineId})`} />

          {/* Colored ring when active */}
          {active && (
            <circle cx="13" cy="13" r="11.5"
              fill="none"
              stroke={ringColor}
              strokeWidth="1.2"
              opacity="0.65"
              style={{ filter: `drop-shadow(0 0 4px ${ringColor})` }}
            />
          )}

          {/* Pulse ring when connectable */}
          {canConnect && (
            <circle cx="13" cy="13" r="11.5"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              opacity="0.7"
              className="animate-pulse"
            />
          )}
        </svg>
      </div>
      <span
        className="text-[8px] uppercase tracking-wider"
        style={{ color: isOut ? PORT_COLORS[portDef.type] : '#c0c8d4' }}
      >
        {portDef.name}
      </span>
    </div>
  );
}
