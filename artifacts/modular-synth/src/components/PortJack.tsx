import { useEffect, useRef } from 'react';
import { PortDef, PortType } from '../types';

interface PortJackProps {
  moduleId: string;
  portDef: PortDef;
  isConnected: boolean;
  isPendingSource: boolean;
  canConnect: boolean;
  onPortClick: (moduleId: string, portId: string, type: PortType) => void;
  onRegisterRef: (key: string, el: HTMLDivElement | null) => void;
}

const PORT_COLORS: Record<PortType, string> = {
  audio_out: '#fbbf24',
  audio_in: '#6b7280',
  cv_out: '#67e8f9',
  cv_in: '#6b7280',
  gate_out: '#86efac',
  gate_in: '#6b7280',
};

const PORT_GLOW: Record<PortType, string> = {
  audio_out: '0 0 8px rgba(251,191,36,0.7)',
  audio_in: 'none',
  cv_out: '0 0 8px rgba(103,232,249,0.7)',
  cv_in: 'none',
  gate_out: '0 0 8px rgba(134,239,172,0.7)',
  gate_in: 'none',
};

export default function PortJack({
  moduleId,
  portDef,
  isConnected,
  isPendingSource,
  canConnect,
  onPortClick,
  onRegisterRef,
}: PortJackProps) {
  const ref = useRef<HTMLDivElement>(null);
  const key = `${moduleId}-${portDef.id}`;

  useEffect(() => {
    onRegisterRef(key, ref.current);
    return () => onRegisterRef(key, null);
  }, [key, onRegisterRef]);

  const isOut = portDef.type.endsWith('_out');
  const color = isConnected || isPendingSource ? PORT_COLORS[portDef.type] : (isOut ? PORT_COLORS[portDef.type] : '#374151');
  const glow = (isConnected || isPendingSource) ? PORT_GLOW[portDef.type] : 'none';

  return (
    <div className="flex flex-col items-center gap-0.5" data-testid={`port-${moduleId}-${portDef.id}`}>
      <div
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onPortClick(moduleId, portDef.id, portDef.type);
        }}
        className="relative cursor-pointer transition-transform hover:scale-110 active:scale-95"
        style={{ width: 20, height: 20 }}
      >
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: '#111',
            border: `2px solid ${color}`,
            boxShadow: glow,
          }}
        />
        {/* Inner dot */}
        <div
          className="absolute rounded-full"
          style={{
            background: isConnected ? color : '#0a0a0a',
            width: 8, height: 8,
            top: 4, left: 4,
          }}
        />
        {/* Highlight ring when pending/can connect */}
        {canConnect && (
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{ border: '2px solid white', opacity: 0.6 }}
          />
        )}
      </div>
      <span
        className="text-[8px] uppercase tracking-wider"
        style={{ color: isOut ? PORT_COLORS[portDef.type] : '#9ca3af' }}
      >
        {portDef.name}
      </span>
    </div>
  );
}
