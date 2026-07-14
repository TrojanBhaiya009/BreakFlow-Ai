'use client';

import { IconCheck } from './Icons';

export const PERSONAS = [
  {
    id: 'rage-clicker',
    name: 'Rage Clicker',
    description: 'Rapid clicking on all interactive elements',
    color: '#789CAE',
    detects: ['Duplicate submissions', 'UI freezes', 'Race conditions'],
  },
  {
    id: 'half-fill-user',
    name: 'Half-Fill User',
    description: 'Partial form fills, abandoned workflows',
    color: '#D56F61',
    detects: ['Missing validation', 'Partial submission bugs'],
  },
  {
    id: 'confused-navigator',
    name: 'Confused Navigator',
    description: 'Random back/forward, page refresh cycles',
    color: '#8E8678',
    detects: ['Broken redirects', 'Navigation errors', 'State corruption'],
  },
  {
    id: 'slow-network-user',
    name: 'Slow Network User',
    description: 'Throttled network, offline transitions',
    color: '#C28A4B',
    detects: ['Timeout issues', 'Missing loading states'],
  },
  {
    id: 'contradictory-input-user',
    name: 'Contradictory Input',
    description: 'XSS, SQL injection, edge-case inputs',
    color: '#78B58A',
    detects: ['Injection vulnerabilities', 'Type coercion bugs'],
  },
  {
    id: 'viewport-shifter',
    name: 'Viewport Shifter',
    description: 'Mobile, tablet, and narrow desktop resizing',
    color: '#55A79C',
    detects: ['Horizontal overflow', 'Tiny tap targets', 'Broken responsive states'],
  },
  {
    id: 'multi-tab-user',
    name: 'Multi-Tab User',
    description: 'Parallel tabs sharing session and form state',
    color: '#A68852',
    detects: ['Duplicate actions', 'Storage collisions', 'Stale UI'],
  },
  {
    id: 'permission-denier',
    name: 'Permission Denier',
    description: 'Blocks location, camera, notifications, clipboard',
    color: '#5A9BA8',
    detects: ['Missing fallbacks', 'Permission loops', 'Blocked workflows'],
  },
];

export default function PersonaSelector({ selected, onToggle, disabled = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {PERSONAS.map((p) => {
        const active = selected.includes(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onToggle(p.id)}
            disabled={disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: active ? `${p.color}0A` : 'var(--surface-2)',
              border: `1px solid ${active ? p.color + '30' : 'var(--line)'}`,
              borderRadius: 'var(--radius-md)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.45 : 1,
              width: '100%',
              fontFamily: 'var(--font-sans)',
              transition: 'border-color 0.1s ease',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text)' }}>
                {p.name}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', marginTop: '1px' }}>
                {p.description}
              </div>
            </div>

            <div style={{
              width: 18, height: 18, borderRadius: 5,
              border: `2px solid ${active ? p.color : 'rgba(237,231,220,0.22)'}`,
              background: active ? p.color : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.1s ease',
            }}>
              {active && <IconCheck size={11} style={{ color: 'var(--surface)' }} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
