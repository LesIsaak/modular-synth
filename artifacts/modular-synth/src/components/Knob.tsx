import { useState, useRef, useCallback } from 'react';
import { KnobDef } from '../types';

interface KnobProps {
  def: KnobDef;
  value: number;
  onChange: (val: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

function formatValue(value: number, def: KnobDef): string {
  if (def.unit === 'Hz') {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(value < 10 ? 2 : 0);
  }
  if (def.unit === 'ct') return `${value >= 0 ? '+' : ''}${value.toFixed(0)}`;
  if (def.unit === 's') return `${value.toFixed(2)}s`;
  if (def.step === 1) return `${Math.round(value)}`;
  return value.toFixed(2);
}

export default function Knob({ def, value, onChange, size = 'md' }: KnobProps) {
  const [showValue, setShowValue] = useState(false);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const toNorm = (v: number) => {
    if (def.log) {
      const logMin = Math.log(def.min || 0.0001);
      const logMax = Math.log(def.max);
      return (Math.log(Math.max(def.min || 0.0001, v)) - logMin) / (logMax - logMin);
    }
    return (v - def.min) / (def.max - def.min);
  };

  const fromNorm = (n: number) => {
    const clamped = Math.max(0, Math.min(1, n));
    if (def.log) {
      const logMin = Math.log(def.min || 0.0001);
      const logMax = Math.log(def.max);
      return Math.exp(logMin + clamped * (logMax - logMin));
    }
    return def.min + clamped * (def.max - def.min);
  };

  const norm = toNorm(value);
  const angle = norm * 270 - 135;

  const sizeMap = { sm: 32, md: 40, lg: 48 };
  const px = sizeMap[size];

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    setShowValue(true);

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dy = startY.current - ev.clientY;
      const range = def.max - def.min;
      const sensitivity = def.log ? 1.5 : 1;
      const normDelta = (dy / 150) * sensitivity;
      const newNorm = Math.max(0, Math.min(1, toNorm(startVal.current) + normDelta));
      let newVal = fromNorm(newNorm);
      if (def.step) newVal = Math.round(newVal / def.step) * def.step;
      newVal = Math.max(def.min, Math.min(def.max, newVal));
      onChange(newVal);
    };

    const onUp = () => {
      dragging.current = false;
      setShowValue(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [value, def, onChange]);

  return (
    <div
      className="flex flex-col items-center gap-1 group select-none"
      onMouseEnter={() => setShowValue(true)}
      onMouseLeave={() => { if (!dragging.current) setShowValue(false); }}
      data-testid={`knob-${def.id}`}
    >
      <div className="relative" style={{ width: px, height: px }}>
        {/* Knob track arc (background) */}
        <svg
          width={px} height={px}
          className="absolute inset-0 pointer-events-none"
          viewBox={`0 0 ${px} ${px}`}
        >
          <circle
            cx={px / 2} cy={px / 2} r={px / 2 - 3}
            fill="none"
            stroke="#111"
            strokeWidth="3"
            strokeDasharray={`${((270 / 360) * 2 * Math.PI * (px / 2 - 3)).toFixed(0)} 999`}
            strokeDashoffset={`${((135 / 360) * 2 * Math.PI * (px / 2 - 3) * -1).toFixed(0)}`}
            strokeLinecap="round"
            transform={`rotate(135 ${px / 2} ${px / 2})`}
            style={{ opacity: 0.25 }}
          />
          <circle
            cx={px / 2} cy={px / 2} r={px / 2 - 3}
            fill="none"
            stroke="#e87d27"
            strokeWidth="3"
            strokeDasharray={`${(norm * (270 / 360) * 2 * Math.PI * (px / 2 - 3)).toFixed(0)} 999`}
            strokeDashoffset="0"
            strokeLinecap="round"
            transform={`rotate(135 ${px / 2} ${px / 2})`}
            style={{ opacity: norm > 0.01 ? 1 : 0 }}
          />
        </svg>

        {/* Knob body */}
        <div
          className="absolute knob-body rounded-full cursor-pointer"
          style={{
            width: px - 8, height: px - 8,
            top: 4, left: 4,
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={e => { e.stopPropagation(); onChange(def.default); }}
        >
          {/* Indicator line */}
          <div
            className="absolute inset-0 flex justify-center"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            <div
              className="absolute rounded-full bg-white/90"
              style={{ width: 2, height: Math.floor(px / 4), top: 4 }}
            />
          </div>
        </div>
      </div>

      {/* Value tooltip */}
      <div className="h-3 flex items-center justify-center">
        {showValue ? (
          <span className="text-[9px] text-orange-400 font-mono tabular-nums whitespace-nowrap">
            {formatValue(value, def)}{def.unit && def.unit !== 'Hz' && def.unit !== 's' && def.unit !== 'ct' ? ` ${def.unit}` : ''}
          </span>
        ) : (
          <span className="text-[9px] text-gray-500 uppercase tracking-widest">{def.name}</span>
        )}
      </div>
    </div>
  );
}
