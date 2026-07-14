'use client';

import { useRef, useEffect } from 'react';

const EVENT_COLORS = {
  start: 'var(--mint)',
  event: 'var(--muted)',
  done:  'var(--color-success)',
  error: 'var(--crimson)',
  complete: 'var(--mint)',
  info: 'var(--muted)',
};

export default function LiveFeed({ events, isRunning }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  if (events.length === 0) return null;

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-3)',
      }}>
        <span className="text-label">Event Log</span>
        {isRunning && <span className="badge badge-live">Live</span>}
      </div>

      <div
        ref={logRef}
        style={{
          maxHeight: '260px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1px',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6875rem',
          border: '1px solid var(--line)',
        }}
      >
        {events.map((ev, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: '8px',
              lineHeight: '1.6',
              padding: '1px 0',
              color: EVENT_COLORS[ev.type] || 'var(--muted)',
            }}
          >
            <span style={{
              fontSize: '0.5625rem',
              flexShrink: 0,
              color: 'var(--muted)',
              opacity: 0.4,
              minWidth: '52px',
            }}>
              {ev.ts ? new Date(ev.ts).toLocaleTimeString() : ''}
            </span>
            <span>{ev.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
