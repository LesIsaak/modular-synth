/**
 * StartAnimation — a one-shot 3-second SVG animation for the start screen.
 * Ports power on, patch cables draw in with a gravity droop, and plug tips
 * snap into the jacks with a glow pulse. Pure SVG + scoped CSS keyframes,
 * no dependencies. Sits behind the start-screen content as a faint backdrop.
 */

const ORANGE = '#e87d27';

type Jack = { x: number; y: number };

// Panel jacks arranged in three rows, like a Eurorack faceplate.
const JACKS: Jack[] = [
  { x: 60,  y: 55 },
  { x: 160, y: 48 },
  { x: 260, y: 52 },
  { x: 360, y: 50 },
  { x: 110, y: 165 },
  { x: 210, y: 160 },
  { x: 310, y: 168 },
  { x: 60,  y: 275 },
  { x: 160, y: 280 },
  { x: 260, y: 272 },
  { x: 360, y: 278 },
];

// Patch cables: from-jack index, to-jack index, droop amount, color, delay (s).
const CABLES: { from: number; to: number; sag: number; color: string; delay: number }[] = [
  { from: 0,  to: 5,  sag: 70,  color: ORANGE,   delay: 0.25 },
  { from: 1,  to: 7,  sag: 95,  color: '#f0a85a', delay: 0.50 },
  { from: 2,  to: 6,  sag: 55,  color: ORANGE,   delay: 0.75 },
  { from: 3,  to: 9,  sag: 90,  color: '#c96a1a', delay: 1.00 },
  { from: 4,  to: 10, sag: 80,  color: ORANGE,   delay: 1.25 },
  { from: 5,  to: 8,  sag: 60,  color: '#f0a85a', delay: 1.50 },
  { from: 1,  to: 6,  sag: 50,  color: '#c96a1a', delay: 1.75 },
  { from: 7,  to: 10, sag: 45,  color: ORANGE,   delay: 2.00 },
];

/** Quadratic bezier path that droops downward between two jacks. */
function cablePath(a: Jack, b: Jack, sag: number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 + sag;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

export function StartAnimation() {
  return (
    <svg
      viewBox="0 0 420 330"
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <style>{`
        @keyframes oc-jack-on {
          0%   { opacity: 0; transform: scale(0.5); }
          60%  { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes oc-cable-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes oc-plug-in {
          0%   { opacity: 0; transform: scale(0); }
          70%  { opacity: 1; transform: scale(1.4); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes oc-glow-pulse {
          0%   { opacity: 0; transform: scale(0.6); }
          50%  { opacity: 0.55; transform: scale(2.2); }
          100% { opacity: 0; transform: scale(2.6); }
        }
        .oc-jack-ring  { transform-box: fill-box; transform-origin: center;
                         opacity: 0; animation: oc-jack-on 0.5s ease-out forwards; }
        .oc-cable      { fill: none; stroke-linecap: round;
                         animation: oc-cable-draw 0.9s cubic-bezier(.4,.8,.4,1) forwards; }
        .oc-plug       { transform-box: fill-box; transform-origin: center;
                         opacity: 0; animation: oc-plug-in 0.35s cubic-bezier(.34,1.56,.64,1) forwards; }
        .oc-glow       { transform-box: fill-box; transform-origin: center;
                         opacity: 0; animation: oc-glow-pulse 0.6s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .oc-jack-ring, .oc-cable, .oc-plug, .oc-glow {
            animation: none !important; opacity: 1 !important; stroke-dashoffset: 0 !important;
          }
        }
      `}</style>

      <defs>
        <filter id="oc-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Panel jacks (ports) */}
      {JACKS.map((j, i) => (
        <g key={`jack-${i}`} className="oc-jack-ring" style={{ animationDelay: `${i * 0.08}s` }}>
          <circle cx={j.x} cy={j.y} r="13" fill="#161616" stroke="#3a3a3a" strokeWidth="2" />
          <circle cx={j.x} cy={j.y} r="6"  fill="#0a0a0a" stroke="#555" strokeWidth="1.5" />
          <circle cx={j.x} cy={j.y} r="2.5" fill="#2a2a2a" />
        </g>
      ))}

      {/* Patch cables + plug tips */}
      {CABLES.map((c, i) => {
        const a = JACKS[c.from];
        const b = JACKS[c.to];
        return (
          <g key={`cable-${i}`}>
            <path
              className="oc-cable"
              d={cablePath(a, b, c.sag)}
              stroke={c.color}
              strokeWidth="4"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1}
              filter="url(#oc-soft-glow)"
              style={{ animationDelay: `${c.delay}s` }}
            />
            {/* Glow burst + plug tip at each end, timed to when the cable lands */}
            {[a, b].map((p, e) => (
              <g key={`end-${i}-${e}`}>
                <circle
                  className="oc-glow"
                  cx={p.x} cy={p.y} r="10"
                  fill={c.color}
                  style={{ animationDelay: `${c.delay + 0.7}s` }}
                />
                <circle
                  className="oc-plug"
                  cx={p.x} cy={p.y} r="7"
                  fill={c.color}
                  stroke="#1a1a1a" strokeWidth="2"
                  style={{ animationDelay: `${c.delay + 0.6}s` }}
                />
                <circle
                  className="oc-plug"
                  cx={p.x} cy={p.y} r="2.5"
                  fill="#1a1a1a"
                  style={{ animationDelay: `${c.delay + 0.6}s` }}
                />
              </g>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
