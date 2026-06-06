import { useEffect, useRef, useState } from 'react';
import { ModuleTypeDef, PortType } from '../types';
import { MODULE_DESCRIPTIONS } from '../moduleDescriptions';
import { CATEGORY_LABELS } from '../moduleDefinitions';
import { MODULE_PATCH_EXAMPLES, PatchSignalType } from '../modulePatchExamples';

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

const SIG_COLOR: Record<PatchSignalType, string> = {
  audio: '#f97316',
  cv:    '#14b8a6',
  gate:  '#eab308',
};

const SIG_LABEL: Record<PatchSignalType, string> = {
  audio: 'audio',
  cv:    'cv',
  gate:  'gate',
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
  onBuildPatch,
}: {
  typeDef: ModuleTypeDef;
  anchor: { x: number; y: number };
  onClose: () => void;
  onBuildPatch?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<'info' | 'patch'>('info');

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
  const patch = MODULE_PATCH_EXAMPLES[typeDef.id];

  const POPUP_W = 272;
  const left = Math.max(8, Math.min(anchor.x, window.innerWidth - POPUP_W - 8));
  const top  = Math.min(anchor.y + 6, window.innerHeight - 60);

  const tabBtn = (label: string, active: boolean, onClick: () => void) => (
    <button
      onClick={onClick}
      onMouseDown={e => e.stopPropagation()}
      style={{
        height: 16, padding: '0 7px', fontSize: 6.5, letterSpacing: '0.14em',
        borderRadius: 2, cursor: 'pointer', fontWeight: 700, textTransform: 'uppercase',
        border: `1px solid ${active ? typeDef.accentColor + '88' : '#2a2a2a'}`,
        background: active ? typeDef.accentColor + '22' : 'none',
        color: active ? typeDef.accentColor : '#555',
        transition: 'all 0.1s',
      }}
    >{label}</button>
  );

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

        {/* Tab toggles */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {tabBtn('INFO',  view === 'info',  () => setView('info'))}
          {patch && tabBtn('PATCH', view === 'patch', () => setView('patch'))}
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

      {/* ── INFO view ──────────────────────────────────────────────────── */}
      {view === 'info' && (
        <>
          {description && (
            <div style={{ padding: '7px 10px 6px', borderBottom: '1px solid #1a1a1a' }}>
              <p style={{ fontSize: 8, color: '#999', lineHeight: 1.6, margin: 0, letterSpacing: '0.01em' }}>
                {description}
              </p>
            </div>
          )}

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
        </>
      )}

      {/* ── PATCH view ─────────────────────────────────────────────────── */}
      {view === 'patch' && patch && (
        <div style={{ padding: '8px 10px' }}>

          {/* Patch title */}
          <div style={{
            fontSize: 8, fontWeight: 700, color: '#ccc',
            textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6,
          }}>
            {patch.title}
          </div>

          {/* Module chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {patch.modules.map((m, i) => {
              const isThis = m.toLowerCase().replace(/\s+/g, '_') === typeDef.id
                || m === typeDef.name;
              return (
                <div key={i} style={{
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 7, fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  background: isThis ? typeDef.accentColor + '28' : '#1e1e1e',
                  border: `1px solid ${isThis ? typeDef.accentColor + '66' : '#2a2a2a'}`,
                  color: isThis ? typeDef.accentColor : '#888',
                }}>
                  {m}
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#1e1e1e', marginBottom: 8 }} />

          {/* Signal flow */}
          <SectionLabel>Signal flow</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {patch.connections.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {/* from */}
                <div style={{
                  fontSize: 6.5, color: '#aaa', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}>
                  {c.from}
                </div>
                <div style={{
                  fontSize: 6, color: SIG_COLOR[c.sig], letterSpacing: '0.05em',
                  textTransform: 'uppercase', border: `1px solid ${SIG_COLOR[c.sig]}55`,
                  borderRadius: 2, padding: '0 3px', flexShrink: 0,
                  background: SIG_COLOR[c.sig] + '12',
                }}>
                  {c.out}
                </div>
                {/* arrow */}
                <div style={{
                  flex: 1, height: 1, minWidth: 6,
                  background: `linear-gradient(to right, ${SIG_COLOR[c.sig]}88, ${SIG_COLOR[c.sig]}44)`,
                }} />
                <div style={{ fontSize: 7, color: SIG_COLOR[c.sig] + 'cc', flexShrink: 0 }}>›</div>
                {/* to */}
                <div style={{
                  fontSize: 6, color: SIG_COLOR[c.sig], letterSpacing: '0.05em',
                  textTransform: 'uppercase', border: `1px solid ${SIG_COLOR[c.sig]}55`,
                  borderRadius: 2, padding: '0 3px', flexShrink: 0,
                  background: SIG_COLOR[c.sig] + '12',
                }}>
                  {c.in}
                </div>
                <div style={{
                  fontSize: 6.5, color: '#aaa', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  whiteSpace: 'nowrap',
                }}>
                  {c.to}
                </div>
              </div>
            ))}
          </div>

          {/* Signal type legend */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {(['audio', 'cv', 'gate'] as PatchSignalType[]).map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 8, height: 1.5, background: SIG_COLOR[s], borderRadius: 1 }} />
                <span style={{ fontSize: 6, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {SIG_LABEL[s]}
                </span>
              </div>
            ))}
          </div>

          {/* Tip */}
          {patch.tip && (
            <div style={{
              marginTop: 10, padding: '6px 8px',
              background: '#111', borderRadius: 3,
              borderLeft: `2px solid ${typeDef.accentColor}66`,
            }}>
              <div style={{ fontSize: 6.5, color: '#555', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 3 }}>
                TIP
              </div>
              <p style={{ fontSize: 7.5, color: '#888', lineHeight: 1.55, margin: 0 }}>
                {patch.tip}
              </p>
            </div>
          )}

          {/* Build in rack button */}
          {onBuildPatch && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={() => { onBuildPatch(); onClose(); }}
              style={{
                marginTop: 12, width: '100%',
                padding: '6px 0',
                fontSize: 8, fontWeight: 700, letterSpacing: '0.18em',
                textTransform: 'uppercase',
                background: typeDef.accentColor + '18',
                border: `1px solid ${typeDef.accentColor}55`,
                borderRadius: 3, cursor: 'pointer',
                color: typeDef.accentColor,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = typeDef.accentColor + '30'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = typeDef.accentColor + '18'; }}
            >
              ▶ Build in rack
            </button>
          )}
        </div>
      )}
    </div>
  );
}
