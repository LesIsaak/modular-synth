import { useState, useEffect } from 'react';
import Knob from './Knob';
import { KnobDef, ModuleInstance } from '../types';

const TC = ['#f97316','#eab308','#22d3ee','#60a5fa','#a855f7','#ec4899','#4ade80','#94a3b8'];
const TL = ['KICK','SNR','HH·C','HH·O','CLAP','PERC','BASS','AUX'];
const LEN_OPTS = [4, 8, 12, 16] as const;

interface Props {
  module: ModuleInstance;
  knobDefs: KnobDef[];
  onParamChange: (moduleId: string, paramId: string, value: number) => void;
  stepRef?: { value: number };
}

export default function PolyStepPanel({ module: mod, knobDefs, onParamChange, stepRef }: Props) {
  const [liveStep, setLiveStep] = useState(-1);

  useEffect(() => {
    if (!stepRef) return;
    let last = -1;
    const id = setInterval(() => {
      const next = (stepRef.value) & 0xF;
      if (next !== last) { last = next; setLiveStep(next); }
    }, 33);
    return () => clearInterval(id);
  }, [stepRef]);

  const p   = mod.params;
  const set = (id: string, val: number) => onParamChange(mod.id, id, val);

  const lenIdx = Math.max(0, Math.min(3, Math.round(p.global_len ?? 3)));
  const len    = LEN_OPTS[lenIdx];

  const toggle     = (t: number, s: number) =>
    set(`t${t+1}`, (Math.round(p[`t${t+1}`] ?? 0) ^ (1 << s)) & 0xFFFF);
  const toggleAcc  = (t: number, s: number) =>
    set(`t${t+1}_acc`, (Math.round(p[`t${t+1}_acc`] ?? 0) ^ (1 << s)) & 0xFFFF);
  const toggleMute = (t: number) =>
    set(`t${t+1}_mute`, (p[`t${t+1}_mute`] ?? 0) > 0.5 ? 0 : 1);
  const randomize  = (t: number) => {
    let mask = 0;
    for (let s = 0; s < len; s++) if (Math.random() > 0.5) mask |= (1 << s);
    set(`t${t+1}`, mask);
  };
  const clearTrack = (t: number) => { set(`t${t+1}`, 0); set(`t${t+1}_acc`, 0); };

  const bpmDef = knobDefs.find(k => k.id === 'bpm');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Transport ──────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 52,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px', borderBottom: '1px solid #1e1e1e',
        background: '#131313',
      }}>
        {/* Play / Pause / Stop */}
        {(
          [
            { val: 1, label: '▶', title: 'Play',  active: '#4ade80', activeText: '#000' },
            { val: 2, label: '⏸', title: 'Pause', active: '#facc15', activeText: '#000' },
            { val: 0, label: '■', title: 'Stop',  active: '#f87171', activeText: '#000' },
          ] as { val: number; label: string; title: string; active: string; activeText: string }[]
        ).map(btn => {
          const isActive = Math.round(p.transport ?? 1) === btn.val;
          return (
            <button
              key={btn.val}
              title={btn.title}
              onMouseDown={e => e.stopPropagation()}
              onClick={() => set('transport', btn.val)}
              style={{
                width: 32, height: 24, fontSize: 12,
                padding: 0, borderRadius: 4, cursor: 'pointer',
                background: isActive ? btn.active : '#1a1a1a',
                color:      isActive ? btn.activeText : '#333',
                border: `1px solid ${isActive ? btn.active : '#252525'}`,
                lineHeight: 1,
              }}
            >{btn.label}</button>
          );
        })}

        <div style={{ width: 1, height: 28, background: '#252525', flexShrink: 0 }} />

        {bpmDef && (
          <Knob def={bpmDef} value={p.bpm ?? 120} onChange={v => set('bpm', v)} size="sm" />
        )}

        <div style={{ width: 1, height: 28, background: '#252525', flexShrink: 0 }} />

        {/* Global step-length */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 8, color: '#383838', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Steps</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {LEN_OPTS.map((l, i) => (
              <button
                key={l}
                onMouseDown={e => e.stopPropagation()}
                onClick={() => set('global_len', i)}
                style={{
                  width: 30, height: 20, fontSize: 8, borderRadius: 3, cursor: 'pointer',
                  background: lenIdx === i ? '#c084fc' : '#1a1a1a',
                  color:      lenIdx === i ? '#000'    : '#3a3a3a',
                  border: `1px solid ${lenIdx === i ? '#c084fc' : '#222'}`,
                  fontWeight: lenIdx === i ? 700 : 400,
                }}
              >{l}</button>
            ))}
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: '#252525', flexShrink: 0 }} />

        {/* Progress bar */}
        <div style={{ flex: 1, height: 5, background: '#1c1c1c', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            background: 'linear-gradient(90deg, #9333ea88, #c084fc)',
            width: liveStep >= 0 && len > 1
              ? `${((liveStep / (len - 1)) * 100).toFixed(1)}%`
              : '0%',
            transition: 'width 0.05s linear',
          }} />
        </div>

        <span style={{
          fontSize: 8, color: '#363636', fontVariantNumeric: 'tabular-nums',
          width: 36, textAlign: 'right', flexShrink: 0,
        }}>
          {liveStep >= 0 ? `${liveStep + 1} / ${len}` : '– / –'}
        </span>
      </div>

      {/* ── Column numbers ──────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, height: 16,
        display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: 0,
        borderBottom: '1px solid #161616', background: '#0f0f0f',
      }}>
        <div style={{ flexShrink: 0, width: 64 }} />
        <div style={{ flex: 1, display: 'flex' }}>
          {Array.from({ length: len }, (_, s) => (
            <div
              key={s}
              style={{
                flex: 1, textAlign: 'center', fontSize: 6, color: '#2a2a2a',
                marginLeft: s > 0 && s % 4 === 0 ? 4 : 0,
              }}
            >{s + 1}</div>
          ))}
        </div>
        <div style={{ flexShrink: 0, width: 32 }} />
      </div>

      {/* ── Track rows (fill remaining ≈ 476px / 8 ≈ 59.5px each) ──────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {Array.from({ length: 8 }, (_, t) => {
          const color  = TC[t];
          const mask   = Math.round(p[`t${t+1}`]     ?? 0);
          const acc    = Math.round(p[`t${t+1}_acc`] ?? 0);
          const muted  = (p[`t${t+1}_mute`] ?? 0) > 0.5;

          return (
            <div
              key={t}
              style={{
                flex: 1, display: 'flex', alignItems: 'center',
                padding: '0 10px', gap: 0,
                borderBottom: t < 7 ? '1px solid #181818' : 'none',
                background: muted ? '#0c0c0c' : undefined,
              }}
            >
              {/* Track label */}
              <div
                title="Click: randomize  ·  Right-click: clear"
                onClick={() => randomize(t)}
                onContextMenu={e => { e.preventDefault(); clearTrack(t); }}
                onMouseDown={e => e.stopPropagation()}
                style={{
                  flexShrink: 0, width: 64,
                  display: 'flex', alignItems: 'center', gap: 6,
                  cursor: 'pointer', userSelect: 'none',
                }}
              >
                <div style={{
                  width: 3, height: 32, borderRadius: 1, flexShrink: 0,
                  background: muted ? '#222' : color,
                  boxShadow: muted ? 'none' : `0 0 6px ${color}44`,
                }} />
                <span style={{
                  fontSize: 8, fontWeight: 700,
                  color: muted ? '#272727' : color,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>{TL[t]}</span>
              </div>

              {/* Step buttons */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                {Array.from({ length: len }, (_, s) => {
                  const isOn   = (mask & (1 << s)) !== 0;
                  const isAcc  = (acc  & (1 << s)) !== 0;
                  const isLive = s === liveStep;

                  return (
                    <div
                      key={s}
                      onClick={() => toggle(t, s)}
                      onContextMenu={e => { e.preventDefault(); toggleAcc(t, s); }}
                      onMouseDown={e => e.stopPropagation()}
                      style={{
                        flex: 1, height: 36, borderRadius: 4, cursor: 'pointer',
                        marginLeft: s > 0 && s % 4 === 0 ? 4 : s > 0 ? 1 : 0,
                        opacity: muted ? 0.4 : 1,
                        background: isOn
                          ? isAcc ? color : `${color}55`
                          : '#1e1e1e',
                        border: isLive
                          ? `1px solid ${color}`
                          : isOn
                            ? `1px solid ${color}66`
                            : '1px solid #252525',
                        boxShadow: isLive && isOn
                          ? `0 0 12px ${color}88`
                          : isLive
                            ? `0 0 5px ${color}44`
                            : 'none',
                        transition: 'box-shadow 0.04s',
                      }}
                    />
                  );
                })}
              </div>

              {/* Mute */}
              <button
                onMouseDown={e => e.stopPropagation()}
                onClick={() => toggleMute(t)}
                style={{
                  flexShrink: 0, marginLeft: 8,
                  width: 24, height: 20, fontSize: 7, borderRadius: 3,
                  cursor: 'pointer', fontWeight: 700,
                  background: muted ? color    : '#1a1a1a',
                  color:      muted ? '#000'   : '#303030',
                  border: `1px solid ${muted ? color : '#222'}`,
                }}
              >M</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
