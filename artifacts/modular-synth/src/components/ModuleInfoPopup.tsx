import { useEffect, useRef } from 'react';
import { ModuleTypeDef, PortType } from '../types';
import { MODULE_DESCRIPTIONS } from '../moduleDescriptions';
import { CATEGORY_LABELS } from '../moduleDefinitions';

const PORT_TYPE_COLORS: Record<PortType, string> = {
  audio_in:  '#f97316',
  audio_out: '#fb923c',
  cv_in:     '#14b8a6',
  cv_out:    '#2dd4bf',
  gate_in:   '#eab308',
  gate_out:  '#fbbf24',
};

const PORT_TYPE_LABELS: Record<PortType, string> = {
  audio_in:  'Audio In',
  audio_out: 'Audio Out',
  cv_in:     'CV In',
  cv_out:    'CV Out',
  gate_in:   'Gate In',
  gate_out:  'Gate Out',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 6.5, color: '#777', textTransform: 'uppercase',
      letterSpacing: '0.15em', marginBottom: 3, marginTop: 2,
    }}>
      {children}
    </div>
  );
}

function PortRow({ port }: { port: { id: string; name: string; type: PortType } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '1.5px 0' }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: PORT_TYPE_COLORS[port.type],
        boxShadow: `0 0 4px ${PORT_TYPE_COLORS[port.type]}66`,
      }} />
      <span style={{
        fontSize: 8, color: '#ccc', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        minWidth: 40,
      }}>{port.name}</span>
      <span style={{ fontSize: 7, color: '#888' }}>
        {PORT_TYPE_LABELS[port.type]}
      </span>
    </div>
  );
}

export default function ModuleInfoPopup({
  typeDef,
  anchor,
  onClose,
}: {
  typeDef: ModuleTypeDef;
  anchor: { x: number; y: number };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const inPorts  = typeDef.ports.filter(p => p.type.endsWith('_in'));
  const outPorts = typeDef.ports.filter(p => p.type.endsWith('_out'));
  const description = MODULE_DESCRIPTIONS[typeDef.id];

  const POPUP_W = 272;
  const left = Math.max(8, Math.min(anchor.x, window.innerWidth - POPUP_W - 8));
  const top  = Math.min(anchor.y + 6, window.innerHeight - 60);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left,
        top,
        width: POPUP_W,
        maxHeight: '72vh',
        overflowY: 'auto',
        background: '#141414',
        border: `1px solid ${typeDef.accentColor}33`,
        borderTop: `2px solid ${typeDef.accentColor}`,
        borderRadius: 5,
        boxShadow: '0 10px 40px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.03)',
        zIndex: 9999,
        fontFamily: 'monospace',
        userSelect: 'none',
      }}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 10px 7px',
        borderBottom: '1px solid #1e1e1e',
        display: 'flex', alignItems: 'flex-start', gap: 6,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: typeDef.accentColor,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {typeDef.name}
          </div>
          <div style={{
            fontSize: 6.5, color: '#888', textTransform: 'uppercase',
            letterSpacing: '0.12em', marginTop: 2,
          }}>
            {CATEGORY_LABELS[typeDef.category] ?? typeDef.category}
          </div>
        </div>
        <button
          style={{
            width: 14, height: 14, flexShrink: 0,
            fontSize: 9, color: '#666', background: 'none',
            border: '1px solid #2a2a2a', borderRadius: 2,
            cursor: 'pointer', padding: 0, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={onClose}
          onMouseDown={e => e.stopPropagation()}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#aaa'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#666'; }}
        >✕</button>
      </div>

      {/* ── Description ────────────────────────────────────────────────── */}
      {description && (
        <div style={{
          padding: '7px 10px 6px',
          borderBottom: '1px solid #1a1a1a',
        }}>
          <p style={{
            fontSize: 8, color: '#999', lineHeight: 1.6,
            margin: 0, letterSpacing: '0.01em',
          }}>
            {description}
          </p>
        </div>
      )}

      {/* ── Ports ──────────────────────────────────────────────────────── */}
      {(inPorts.length > 0 || outPorts.length > 0) && (
        <div style={{ padding: '6px 10px', borderBottom: '1px solid #1a1a1a' }}>
          {inPorts.length > 0 && (
            <>
              <SectionLabel>Inputs</SectionLabel>
              {inPorts.map(p => <PortRow key={p.id} port={p} />)}
            </>
          )}
          {outPorts.length > 0 && (
            <>
              <SectionLabel>Outputs</SectionLabel>
              {outPorts.map(p => <PortRow key={p.id} port={p} />)}
            </>
          )}
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────────────────── */}
      {typeDef.knobs.length > 0 && (
        <div style={{ padding: '6px 10px 8px' }}>
          <SectionLabel>Controls</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {typeDef.knobs.map(k => (
              <div key={k.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{
                  fontSize: 7.5, color: '#bbb', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  minWidth: 42, flexShrink: 0,
                }}>{k.name}</span>
                <span style={{ fontSize: 7, color: '#666', lineHeight: 1.4 }}>
                  {k.min}–{k.max}{k.unit ? ` ${k.unit}` : ''}
                  {' · '}
                  <span style={{ color: '#777' }}>default {k.default}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Selectors */}
          {(typeDef.selectors ?? []).length > 0 && (
            <div style={{ marginTop: 5 }}>
              {(typeDef.selectors ?? []).map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                  <span style={{
                    fontSize: 7.5, color: '#bbb', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    minWidth: 42, flexShrink: 0,
                  }}>{s.name}</span>
                  <span style={{ fontSize: 7, color: '#666' }}>
                    {s.options.join(' · ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
