import { useState, useEffect } from 'react';
import Knob from './Knob';
import { KnobDef, ModuleInstance } from '../types';

const TC = ['#f97316','#eab308','#22d3ee','#60a5fa','#a855f7','#ec4899','#4ade80','#94a3b8'];
const TL = ['KICK','SNR','HH·C','HH·O','CLAP','PERC','BASS','AUX'];
const LEN_MAP = [4, 8, 12, 16] as const;
const PROB_STEPS = [1, 0.75, 0.5, 0.25] as const;

interface Props {
  module: ModuleInstance;
  knobDefs: KnobDef[];
  onParamChange: (moduleId: string, paramId: string, value: number) => void;
  stepRef?: { value: number };
}

export default function PolyStepPanel({ module: mod, knobDefs, onParamChange, stepRef }: Props) {
  const [liveSteps, setLiveSteps] = useState<number[]>(new Array(8).fill(-1));

  useEffect(() => {
    if (!stepRef) return;
    const id = setInterval(() => {
      const v = stepRef.value | 0;
      setLiveSteps(Array.from({ length: 8 }, (_, i) => (v >>> (i * 4)) & 0xF));
    }, 33);
    return () => clearInterval(id);
  }, [stepRef]);

  const p    = mod.params;
  const kmap = new Map(knobDefs.map(k => [k.id, k]));
  const set  = (id: string, val: number) => onParamChange(mod.id, id, val);

  const toggleStep   = (t: number, s: number) =>
    set(`t${t+1}`, (Math.round(p[`t${t+1}`] ?? 0) ^ (1 << s)) & 0xFFFF);
  const toggleAccent = (t: number, s: number) =>
    set(`t${t+1}_acc`, (Math.round(p[`t${t+1}_acc`] ?? 0) ^ (1 << s)) & 0xFFFF);
  const cycleLen     = (t: number, i: number) => set(`t${t+1}_len`, i);
  const toggleMute   = (t: number) => set(`t${t+1}_mute`, (p[`t${t+1}_mute`] ?? 0) > 0.5 ? 0 : 1);
  const cycleProb    = (t: number) => {
    const cur = p[`t${t+1}_prob`] ?? 1;
    const idx = PROB_STEPS.findIndex(v => Math.abs(v - cur) < 0.06);
    set(`t${t+1}_prob`, PROB_STEPS[(idx + 1) % PROB_STEPS.length]);
  };
  const clearTrack = (t: number) => { set(`t${t+1}`, 0); set(`t${t+1}_acc`, 0); };
  const randomize  = (t: number) => {
    const len = LEN_MAP[Math.max(0, Math.min(3, Math.round(p[`t${t+1}_len`] ?? 1)))];
    let mask = 0;
    for (let s = 0; s < len; s++) if (Math.random() > 0.55) mask |= (1 << s);
    set(`t${t+1}`, mask);
  };

  const bpmDef = kmap.get('bpm');
  const swDef  = kmap.get('swing');
  const glDef  = kmap.get('gate_len');
  const isExt  = (p.clk_src ?? 0) > 0.5;

  const masterLen  = LEN_MAP[Math.max(0, Math.min(3, Math.round(p.t1_len ?? 3)))];
  const masterStep = liveSteps[0] >= 0 ? liveSteps[0] : 0;
  const barPct     = masterLen > 1 ? (masterStep / (masterLen - 1)) * 100 : 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Transport bar ─────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 40,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 8px', borderBottom: '1px solid #1e1e1e',
        background: '#131313',
      }}>
        {bpmDef && <Knob def={bpmDef} value={p.bpm ?? 120}      onChange={v => set('bpm', v)}      size="sm" />}
        {swDef  && <Knob def={swDef}  value={p.swing ?? 0}      onChange={v => set('swing', v)}    size="sm" />}
        {glDef  && <Knob def={glDef}  value={p.gate_len ?? 0.4} onChange={v => set('gate_len', v)} size="sm" />}

        <div style={{ width: 1, height: 22, background: '#282828', flexShrink: 0 }} />

        {/* CLK SRC toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: 6, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.1em' }}>CLK</span>
          {(['INT', 'EXT'] as const).map((lbl, i) => (
            <button
              key={lbl}
              onMouseDown={e => e.stopPropagation()}
              onClick={() => set('clk_src', i)}
              style={{
                padding: '2px 5px', fontSize: 6.5, borderRadius: 2, cursor: 'pointer',
                background: (isExt ? 1 : 0) === i ? '#c084fc' : '#1c1c1c',
                color:      (isExt ? 1 : 0) === i ? '#000'    : '#444',
                border: `1px solid ${(isExt ? 1 : 0) === i ? '#c084fc' : '#252525'}`,
              }}
            >{lbl}</button>
          ))}
        </div>

        <div style={{ width: 1, height: 22, background: '#282828', flexShrink: 0 }} />

        {/* Bar progress indicator */}
        <div style={{ flex: 1, height: 5, background: '#1c1c1c', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, #9333ea88, #c084fc)',
            width: `${barPct.toFixed(1)}%`,
            transition: 'width 0.05s linear',
          }} />
        </div>

        <span style={{
          fontSize: 6, color: '#404040', fontVariantNumeric: 'tabular-nums',
          width: 30, textAlign: 'right', flexShrink: 0,
        }}>
          {liveSteps[0] >= 0 ? `${masterStep + 1}/${masterLen}` : '–/–'}
        </span>
      </div>

      {/* ── Column header ─────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 14,
        display: 'flex', alignItems: 'center',
        padding: '0 5px', gap: 3,
        borderBottom: '1px solid #171717',
        background: '#111',
      }}>
        <div style={{ flexShrink: 0, width: 44 }} />
        <div style={{ flexShrink: 0, display: 'flex', gap: 1, width: 66 }}>
          {([4,8,12,16] as const).map(l => (
            <div key={l} style={{ width: 15, textAlign: 'center', fontSize: 5, color: '#2e2e2e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</div>
          ))}
        </div>
        <div style={{ flexShrink: 0, width: 23 }} />
        <div style={{ flex: 1, display: 'flex', gap: 1 }}>
          {Array.from({ length: 16 }, (_, s) => (
            <div
              key={s}
              style={{
                flex: 1, textAlign: 'center', fontSize: 5, color: '#282828',
                marginLeft: s > 0 && s % 4 === 0 ? 2 : 0,
              }}
            >{s + 1}</div>
          ))}
        </div>
        <div style={{ flexShrink: 0, width: 30, textAlign: 'center', fontSize: 5, color: '#2e2e2e' }}>PROB</div>
      </div>

      {/* ── Track rows ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {Array.from({ length: 8 }, (_, t) => {
          const color   = TC[t];
          const label   = TL[t];
          const mask    = Math.round(p[`t${t+1}`]     ?? 0);
          const accMask = Math.round(p[`t${t+1}_acc`] ?? 0);
          const lenIdx  = Math.max(0, Math.min(3, Math.round(p[`t${t+1}_len`] ?? 1)));
          const len     = LEN_MAP[lenIdx];
          const prob    = p[`t${t+1}_prob`] ?? 1;
          const muted   = (p[`t${t+1}_mute`] ?? 0) > 0.5;
          const live    = liveSteps[t];
          const probPct = Math.round(prob * 100);

          return (
            <div
              key={t}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center',
                padding: '0 5px', gap: 3,
                borderBottom: t < 7 ? '1px solid #191919' : 'none',
                background: muted ? '#0e0e0e' : 'transparent',
              }}
            >
              {/* Track label — click=randomize, right-click=clear */}
              <div
                style={{
                  flexShrink: 0, width: 44,
                  display: 'flex', alignItems: 'center', gap: 3,
                  cursor: 'pointer',
                }}
                title="Click: randomize · Right-click: clear"
                onClick={() => randomize(t)}
                onContextMenu={e => { e.preventDefault(); clearTrack(t); }}
              >
                <div style={{
                  width: 4, height: 24, borderRadius: 1, flexShrink: 0,
                  background: muted ? '#252525' : color,
                  boxShadow: muted ? 'none' : `0 0 5px ${color}55`,
                }} />
                <span style={{
                  fontSize: 6.5, fontWeight: 700, userSelect: 'none',
                  color: muted ? '#2e2e2e' : color,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{label}</span>
              </div>

              {/* Step-length picker */}
              <div style={{ flexShrink: 0, display: 'flex', gap: 1 }}>
                {LEN_MAP.map((l, i) => (
                  <button
                    key={l}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => cycleLen(t, i)}
                    style={{
                      width: 15, height: 13, fontSize: 5.5,
                      padding: 0, borderRadius: 1, cursor: 'pointer',
                      background: lenIdx === i ? `${color}28` : '#141414',
                      color:      lenIdx === i ? color          : '#2e2e2e',
                      border: `1px solid ${lenIdx === i ? `${color}55` : '#1e1e1e'}`,
                      fontWeight: lenIdx === i ? 700 : 400,
                    }}
                  >{l}</button>
                ))}
              </div>

              {/* Mute */}
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => toggleMute(t)}
                style={{
                  flexShrink: 0, width: 20, height: 13, fontSize: 5.5,
                  padding: 0, borderRadius: 1, cursor: 'pointer',
                  background: muted ? color    : '#141414',
                  color:      muted ? '#000'   : '#2e2e2e',
                  border: `1px solid ${muted ? color : '#1e1e1e'}`,
                  fontWeight: 700,
                }}
              >M</button>

              {/* 16 step buttons */}
              <div style={{ flex: 1, display: 'flex', gap: 1 }}>
                {Array.from({ length: 16 }, (_, s) => {
                  const isOn    = (mask    & (1 << s)) !== 0;
                  const isAcc   = (accMask & (1 << s)) !== 0;
                  const isLive  = s === live;
                  const inRange = s < len;

                  return (
                    <div
                      key={s}
                      onClick={() => inRange && toggleStep(t, s)}
                      onContextMenu={e => { e.preventDefault(); inRange && toggleAccent(t, s); }}
                      style={{
                        flex: 1, height: 26, borderRadius: 2,
                        cursor: inRange ? 'pointer' : 'default',
                        opacity: muted ? 0.45 : 1,
                        background: !inRange
                          ? '#0b0b0b'
                          : isOn
                            ? isAcc ? color : `${color}4d`
                            : '#1c1c1c',
                        border: isLive && inRange
                          ? `1px solid ${color}`
                          : isOn && inRange
                            ? `1px solid ${color}44`
                            : `1px solid #1e1e1e`,
                        boxShadow: isLive && isOn && inRange
                          ? `0 0 8px ${color}77`
                          : isLive && inRange
                            ? `0 0 3px ${color}44`
                            : 'none',
                        marginLeft: s > 0 && s % 4 === 0 ? 2 : 0,
                        transition: 'box-shadow 0.04s',
                      }}
                    />
                  );
                })}
              </div>

              {/* Probability */}
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => cycleProb(t)}
                title="Cycle trigger probability: 100% → 75% → 50% → 25%"
                style={{
                  flexShrink: 0, width: 30, height: 13, fontSize: 5.5,
                  padding: 0, borderRadius: 1, cursor: 'pointer',
                  background: prob < 1 ? '#c084fc1a' : '#141414',
                  color:      prob < 1 ? '#c084fc'   : '#2e2e2e',
                  border: `1px solid ${prob < 1 ? '#c084fc44' : '#1e1e1e'}`,
                }}
              >{probPct}%</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
