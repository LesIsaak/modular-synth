/**
 * StartAnimation — an oscilloscope-style backdrop for the start screen.
 * A faint graticule grid powers on, then two glowing waveforms scroll across
 * the screen while a scan beam sweeps left-to-right, like a live CRT scope.
 * Pure SVG + scoped CSS keyframes, no dependencies. Sits behind the
 * start-screen content as a faint backdrop.
 */

const ORANGE = '#e87d27';
const W = 420;
const H = 330;
const CY = 165;

/**
 * Build a scrolling scope trace. The path spans 2× the viewBox width so the
 * group can translate by exactly one width and loop seamlessly. Wavelengths
 * are chosen to divide the width evenly so there is no visible seam.
 */
function scopePath(wavelength: number, amp: number, harmonic: boolean): string {
  const totalW = W * 2;
  const points = 260;
  let d = '';
  for (let i = 0; i <= points; i++) {
    const x = (i / points) * totalW;
    const phase = (x / wavelength) * 2 * Math.PI;
    const v = harmonic
      ? 0.62 * Math.sin(phase) + 0.38 * Math.sin(2 * phase + 0.6)
      : Math.sin(phase);
    const y = CY - amp * v;
    d += `${i ? ' L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

const WAVE_MAIN = scopePath(105, 72, true);   // 4 cycles across the width
const WAVE_SUB = scopePath(140, 44, false);   // 3 cycles across the width

// Faint graticule lines.
const V_LINES = Array.from({ length: 9 }, (_, i) => ((i + 1) * W) / 10);
const H_LINES = Array.from({ length: 7 }, (_, i) => ((i + 1) * H) / 8);

export function StartAnimation() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <style>{`
        @keyframes oc-screen-on {
          0%   { opacity: 0; transform: scaleY(0.04); }
          45%  { opacity: 1; transform: scaleY(1.04); }
          100% { opacity: 1; transform: scaleY(1); }
        }
        @keyframes oc-grid-in { to { opacity: 1; } }
        @keyframes oc-scroll  { to { transform: translateX(-${W}px); } }
        @keyframes oc-beam {
          0%   { transform: translateX(-30px); opacity: 0; }
          8%   { opacity: 0.9; }
          92%  { opacity: 0.9; }
          100% { transform: translateX(${W + 30}px); opacity: 0; }
        }
        @keyframes oc-flicker {
          0%, 100% { opacity: 0.92; }
          50%      { opacity: 1; }
        }
        .oc-screen { transform-box: fill-box; transform-origin: center;
                     animation: oc-screen-on 0.8s cubic-bezier(.3,.9,.3,1) forwards; }
        .oc-grid   { opacity: 0; animation: oc-grid-in 0.6s ease-out 0.5s forwards; }
        .oc-wave-main { animation: oc-scroll 6s linear infinite, oc-flicker 2.6s ease-in-out infinite; }
        .oc-wave-sub  { animation: oc-scroll 9.5s linear infinite; }
        .oc-beam   { animation: oc-beam 3.4s cubic-bezier(.45,.05,.55,.95) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .oc-screen, .oc-grid, .oc-wave-main, .oc-wave-sub, .oc-beam {
            animation: none !important; opacity: 1 !important; transform: none !important;
          }
        }
      `}</style>

      <defs>
        <filter id="oc-trace-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="oc-beam-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0" />
          <stop offset="50%" stopColor={ORANGE} stopOpacity="0.5" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0" />
        </linearGradient>
      </defs>

      <g className="oc-screen">
        {/* Graticule grid */}
        <g className="oc-grid">
          {V_LINES.map((x) => (
            <line key={`v-${x}`} x1={x} y1="0" x2={x} y2={H} stroke="#262626" strokeWidth="1" />
          ))}
          {H_LINES.map((y) => (
            <line key={`h-${y}`} x1="0" y1={y} x2={W} y2={y} stroke="#262626" strokeWidth="1" />
          ))}
          {/* Bright center axes */}
          <line x1="0" y1={CY} x2={W} y2={CY} stroke="#3c3c3c" strokeWidth="1.5" />
          <line x1={W / 2} y1="0" x2={W / 2} y2={H} stroke="#3c3c3c" strokeWidth="1.5" />
        </g>

        {/* Clip waveforms to the screen so scrolling never spills out */}
        <clipPath id="oc-clip">
          <rect x="0" y="0" width={W} height={H} />
        </clipPath>

        <g clipPath="url(#oc-clip)">
          {/* Secondary, fainter trace */}
          <path
            className="oc-wave-sub"
            d={WAVE_SUB}
            fill="none"
            stroke="#c96a1a"
            strokeWidth="2.5"
            strokeOpacity="0.45"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Main trace */}
          <path
            className="oc-wave-main"
            d={WAVE_MAIN}
            fill="none"
            stroke={ORANGE}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#oc-trace-glow)"
          />
          {/* Sweeping scan beam */}
          <rect
            className="oc-beam"
            x="-2"
            y="0"
            width="4"
            height={H}
            fill="url(#oc-beam-grad)"
          />
        </g>
      </g>
    </svg>
  );
}
