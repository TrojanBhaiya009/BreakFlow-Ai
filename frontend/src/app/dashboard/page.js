'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import PersonaSelector, { PERSONAS } from '../components/PersonaSelector';
import LiveFeed from '../components/LiveFeed';
import ScoreGauge, { getScoreColor } from '../components/ScoreGauge';
import { IconLoader, IconArrowRight, IconGlobe, IconCode, IconTerminal } from '../components/Icons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const CORE_PERSONAS = ['rage-clicker', 'half-fill-user', 'confused-navigator'];
const RESILIENCE_PERSONAS = ['slow-network-user', 'viewport-shifter', 'multi-tab-user', 'permission-denier'];

/* =============================================
   ATTACK PAYLOADS - shown line-by-line in log
   ============================================= */
const ATTACK_PAYLOADS = {
  'rage-clicker': [
    '// ImpatientBuyer: rapid DOM interaction test',
    'const buttons = await page.$$("button, [role=\\"button\\"], a");',
    'for (const btn of buttons) {',
    '  await btn.click({ clickCount: 5, delay: 10 });',
    '  const dupes = await page.evaluate(() =>',
    '    performance.getEntriesByType("resource")',
    '      .filter(r => r.name.includes("/api/"))',
    '  );',
    '  if (dupes.length > 1) logger.log("duplicate_request", btn);',
    '}',
  ],
  'half-fill-user': [
    '// DistractedSignup: partial form submission probe',
    'const forms = await page.$$("form");',
    'for (const form of forms) {',
    '  const inputs = await form.$$("input, textarea, select");',
    '  const half = Math.ceil(inputs.length / 2);',
    '  for (let i = 0; i < half; i++) {',
    '    await inputs[i].fill("test_" + i);',
    '  }',
    '  await form.evaluate(f => f.submit());',
    '}',
  ],
  'confused-navigator': [
    '// LostVisitor: navigation chaos test',
    'for (let i = 0; i < 8; i++) {',
    '  const links = await page.$$("a[href]");',
    '  const random = links[Math.floor(Math.random() * links.length)];',
    '  await random.click().catch(() => {});',
    '  await page.waitForTimeout(300);',
    '  if (Math.random() > 0.5) await page.goBack();',
    '  if (Math.random() > 0.7) await page.reload();',
    '}',
  ],
  'slow-network-user': [
    '// BadWifiUser: throttled network simulation',
    'const cdp = await page.context().newCDPSession(page);',
    'await cdp.send("Network.emulateNetworkConditions", {',
    '  offline: false,',
    '  downloadThroughput: 50 * 1024,',
    '  uploadThroughput: 20 * 1024,',
    '  latency: 2000',
    '});',
    'await page.reload({ waitUntil: "networkidle" });',
  ],
  'contradictory-input-user': [
    '// HostileInputter: injection payload suite',
    'const payloads = [',
    '  "SELECT * FROM users WHERE 1=1; DROP TABLE users;--",',
    '  "<img src=x onerror=alert(1)>",',
    '  "{{constructor.constructor(\'return this\')()}}",',
    '  String.fromCharCode(0, 255, 127),',
    '  "a".repeat(100000)',
    '];',
    'for (const input of await page.$$("input")) {',
    '  for (const payload of payloads) {',
    '    await input.fill(payload);',
    '  }',
    '}',
  ],
  'viewport-shifter': [
    '// SmallScreenUser: responsive layout probe',
    'const viewports = [[375, 812], [768, 1024], [1280, 720]];',
    'for (const [width, height] of viewports) {',
    '  await page.setViewportSize({ width, height });',
    '  await page.waitForTimeout(500);',
    '  const overflow = await page.evaluate(() =>',
    '    document.documentElement.scrollWidth > window.innerWidth',
    '  );',
    '  if (overflow) logger.log("responsive_overflow", { width });',
    '}',
  ],
  'multi-tab-user': [
    '// PowerTabber: concurrent session probe',
    'const tabA = page;',
    'const tabB = await page.context().newPage();',
    'await Promise.all([tabA.goto(url), tabB.goto(url)]);',
    'await tabA.evaluate(() => localStorage.setItem("bf_tab", "A"));',
    'await tabB.evaluate(() => localStorage.setItem("bf_tab", "B"));',
    'const drift = await tabA.evaluate(() => localStorage.getItem("bf_tab"));',
    'if (drift !== "B") logger.log("storage_isolation", drift);',
    'await tabB.close();',
  ],
  'permission-denier': [
    '// PrivacyFirstUser: blocked capability probe',
    'await page.context().clearPermissions();',
    'page.on("dialog", dialog => dialog.dismiss());',
    'const triggers = await page.$$("button, [role=\\"button\\"], a");',
    'for (const trigger of triggers) {',
    '  const label = await trigger.textContent();',
    '  if (/camera|location|notify|clipboard/i.test(label || "")) {',
    '    await trigger.click().catch(() => {});',
    '    await page.waitForTimeout(800);',
    '  }',
    '}',
  ],
};

/* =============================================
   LIVE ATTACK LOG
   ============================================= */
function LiveAttackLog({ currentPersona, isRunning }) {
  const [lines, setLines] = useState([]);
  const logRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isRunning || !currentPersona?.personaKey) return;
    const payload = ATTACK_PAYLOADS[currentPersona.personaKey];
    if (!payload) return;

    setLines([]);
    let idx = 0;
    timerRef.current = setInterval(() => {
      if (idx < payload.length) {
        const nextLine = payload[idx];
        setLines(prev => [...prev, nextLine]);
        idx++;
      } else {
        clearInterval(timerRef.current);
      }
    }, 350 + Math.random() * 250);

    return () => clearInterval(timerRef.current);
  }, [currentPersona?.personaKey, isRunning]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  if (!isRunning && lines.length === 0) return null;

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconCode size={13} style={{ color: 'var(--ember)' }} />
          <span className="text-label">Runner Log</span>
        </div>
        {isRunning && <span className="badge badge-live">Executing</span>}
      </div>
      <div className="attack-log">
        <div className="attack-log-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--crimson)' }} />
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brass)' }} />
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--mint)' }} />
          </div>
          <span className="text-mono" style={{ fontSize: '0.5625rem', color: 'var(--muted)' }}>
            scenario.js
          </span>
        </div>
        <div ref={logRef} className="attack-log-body">
          {lines.map((line, i) => (
            <div key={i} className="attack-log-line">
              <span style={{ color: 'rgba(154,145,132,0.36)', marginRight: '10px', userSelect: 'none' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              {colorLine(line)}
            </div>
          ))}
          {isRunning && (
            <div style={{ marginTop: '2px' }}>
              <span style={{ color: 'rgba(154,145,132,0.36)', marginRight: '10px' }}>{'  '}</span>
              <span style={{
                display: 'inline-block', width: '7px', height: '12px',
                background: 'var(--ember)', animation: 'blink 1s step-end infinite',
              }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const LOG_TOKEN_PATTERN = /("(?:\\.|[^"\\])*")|\b(const|let|var|for|if|await|async|return|function)\b|(\d+)/g;

function colorLine(line) {
  const text = typeof line === 'string' ? line : '';
  if (text.startsWith('//')) return <span className="log-comment">{text}</span>;

  const parts = [];
  let lastIndex = 0;

  text.replace(LOG_TOKEN_PATTERN, (match, stringLiteral, keyword, number, offset) => {
    if (offset > lastIndex) parts.push(text.slice(lastIndex, offset));

    const className = stringLiteral
      ? 'log-string'
      : keyword
        ? 'log-keyword'
        : 'log-number';

    parts.push(
      <span key={`${offset}-${match}`} className={className}>
        {match}
      </span>
    );
    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return <span>{parts}</span>;
}

/* =============================================
   SCORE HISTORY
   ============================================= */
function ScoreHistory({ targetUrl, currentScore }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!targetUrl) return;
    fetch(`${API_URL}/api/tests`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const runs = data
          .filter(t => t.target_url === targetUrl && t.resilience_score !== null)
          .slice(0, 8).reverse();
        setHistory(runs);
      })
      .catch(() => {});
  }, [targetUrl, currentScore]);

  if (history.length < 2) return null;

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <span className="text-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
        Score History
      </span>
      <div className="sparkline-container">
        {history.map((t, i) => {
          const h = Math.max(3, (t.resilience_score / 100) * 32);
          const latest = i === history.length - 1;
          return (
            <div
              key={t.id}
              className="sparkline-bar"
              title={`${t.resilience_score}/100`}
              style={{
                height: `${h}px`,
                background: latest ? 'var(--ember)' : `${getScoreColor(t.resilience_score)}50`,
                opacity: latest ? 1 : 0.5,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/* =============================================
   DASHBOARD
   ============================================= */
export default function Dashboard() {
  const [url, setUrl] = useState('');
  const [selectedPersonas, setSelectedPersonas] = useState(['rage-clicker', 'confused-navigator']);
  const [isRunning, setIsRunning] = useState(false);
  const [testId, setTestId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentPersona, setCurrentPersona] = useState(null);
  const [events, setEvents] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [recentTests, setRecentTests] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/api/tests`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRecentTests(data.slice(0, 5)); })
      .catch(() => {});
  }, []);

  const togglePersona = (id) => {
    setSelectedPersonas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const setPersonaPreset = (preset) => {
    if (isRunning) return;
    setSelectedPersonas(preset);
  };

  const startTest = async () => {
    if (!url) { setError('Enter a URL'); return; }
    try { new URL(url); } catch { setError('Include https://'); return; }
    if (selectedPersonas.length === 0) { setError('Select at least one persona'); return; }

    setError('');
    setIsRunning(true);
    setProgress(0);
    setEvents([]);
    setResult(null);
    setCurrentPersona(null);

    try {
      const res = await fetch(`${API_URL}/api/tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, personas: selectedPersonas }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to start');
      }
      const d = await res.json();
      setTestId(d.id);

      const sse = new EventSource(`${API_URL}/api/tests/${d.id}/stream`);
      sse.onmessage = (e) => {
        try { handleSSE(JSON.parse(e.data), sse); } catch {}
      };
    } catch (err) {
      setError(err.message);
      setIsRunning(false);
    }
  };

  const handleSSE = (ev, sse) => {
    switch (ev.type) {
      case 'persona_start':
        setCurrentPersona(ev);
        setProgress(ev.progress || 0);
        setEvents(p => [...p, { type: 'start', msg: `Starting ${ev.persona}`, ts: ev.timestamp }]);
        break;
      case 'persona_event':
        setEvents(p => [...p, { type: 'event', msg: ev.message, ts: ev.timestamp }]);
        break;
      case 'persona_complete':
        setProgress(ev.progress || 0);
        setEvents(p => [...p, { type: 'done', msg: `${ev.persona} done - ${ev.issuesFound} issues`, ts: ev.timestamp }]);
        break;
      case 'persona_error':
        setEvents(p => [...p, { type: 'error', msg: ev.message, ts: ev.timestamp }]);
        break;
      case 'progress':
        setEvents(p => [...p, { type: 'info', msg: ev.message, ts: ev.timestamp }]);
        break;
      case 'complete':
        setResult(ev);
        setProgress(100);
        setIsRunning(false);
        setCurrentPersona(null);
        sse.close();
        setEvents(p => [...p, { type: 'complete', msg: `Score: ${ev.score}/100 (${ev.grade})`, ts: ev.timestamp }]);
        break;
      case 'error':
        setError(ev.message);
        setIsRunning(false);
        sse.close();
        break;
    }
  };

  return (
    <>
      <Header activePage="dashboard" />

      <main className="container" style={{ paddingTop: '88px', paddingBottom: '48px' }}>
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 className="text-title">Dashboard</h1>
          <p className="text-body" style={{ marginTop: '2px' }}>
            Enter a URL and run browser stress checks against it.
          </p>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: 'var(--space-5)',
          alignItems: 'start',
        }} className="dashboard-grid">

          {/* LEFT — Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <label className="text-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
                Target URL
              </label>
              <input
                id="url-input"
                type="url"
                className="input input-lg"
                placeholder="https://example.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
                disabled={isRunning}
              />
              {error && (
                <p style={{
                  color: 'var(--crimson)', fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)', marginTop: 'var(--space-2)',
                }}>
                  {error}
                </p>
              )}
            </div>

            <div className="card" style={{ padding: 'var(--space-5)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-3)',
              }}>
                <label className="text-label">
                  Personas
                </label>
                <span className="badge badge-neutral">{selectedPersonas.length}/{PERSONAS.length}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px', marginBottom: 'var(--space-3)' }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={isRunning} onClick={() => setPersonaPreset(CORE_PERSONAS)}>
                  Core
                </button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={isRunning} onClick={() => setPersonaPreset(RESILIENCE_PERSONAS)}>
                  Resilience
                </button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={isRunning} onClick={() => setPersonaPreset(PERSONAS.map(p => p.id))}>
                  All
                </button>
                <button type="button" className="btn btn-secondary btn-sm" disabled={isRunning} onClick={() => setPersonaPreset([])}>
                  Clear
                </button>
              </div>
              <PersonaSelector
                selected={selectedPersonas}
                onToggle={togglePersona}
                disabled={isRunning}
              />
            </div>

            <button
              className="btn btn-primary btn-lg"
              onClick={startTest}
              disabled={isRunning}
              style={{ width: '100%' }}
            >
              {isRunning ? <><IconLoader size={15} /> Running...</> : 'Run check'}
            </button>
          </div>

          {/* RIGHT — Output */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

            {/* Progress */}
            {isRunning && (
              <div className="card" style={{ padding: 'var(--space-5)' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 'var(--space-3)',
                }}>
                  <span className="badge badge-live">{currentPersona?.persona || 'Initializing'}</span>
                  <span className="text-mono" style={{ color: 'var(--ember)', fontWeight: 700, fontSize: '0.8125rem' }}>
                    {progress}%
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                {currentPersona && (
                  <p className="text-mono" style={{ fontSize: '0.625rem', color: 'var(--muted)', marginTop: 'var(--space-2)' }}>
                    {currentPersona.index}/{currentPersona.total}
                  </p>
                )}
              </div>
            )}

            <LiveAttackLog currentPersona={currentPersona} isRunning={isRunning} />
            <LiveFeed events={events} isRunning={isRunning} />

            {/* Result */}
            {result && (
              <div>
                <div className="card-accent" style={{
                  padding: 'var(--space-8)',
                  textAlign: 'center',
                  marginBottom: 'var(--space-4)',
                }}>
                  <span className="text-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
                    Resilience Score
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <ScoreGauge score={result.score} />
                  </div>
                  <div style={{
                    display: 'flex', gap: 'var(--space-8)', justifyContent: 'center',
                    marginTop: 'var(--space-6)',
                  }}>
                    {[
                      { v: result.breakdown?.severityCounts?.critical || 0, l: 'Critical', c: 'var(--crimson)' },
                      { v: result.breakdown?.severityCounts?.warning || 0, l: 'Warning', c: 'var(--color-warning)' },
                      { v: result.breakdown?.severityCounts?.info || 0, l: 'Info', c: 'var(--color-info)' },
                    ].map(s => (
                      <div key={s.l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.c }}>{s.v}</div>
                        <div className="text-label">{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <Link href={`/report/${testId}`}>
                  <button className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                    View report <IconArrowRight size={15} />
                  </button>
                </Link>
              </div>
            )}

            {result && url && <ScoreHistory targetUrl={url} currentScore={result.score} />}

            {/* Empty state */}
            {!isRunning && !result && events.length === 0 && (
              <div className="card" style={{ padding: 'var(--space-12) var(--space-6)', textAlign: 'center' }}>
                <IconTerminal size={20} style={{ color: 'var(--muted)', marginBottom: 'var(--space-3)' }} />
                <p className="text-small">
                  Enter a URL and select personas to start testing.
                </p>
              </div>
            )}

            {/* Recent tests */}
            {!isRunning && recentTests.length > 0 && (
              <div className="card" style={{ padding: 'var(--space-5)' }}>
                <span className="text-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>
                  Recent Tests
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {recentTests.map(t => (
                    <Link key={t.id} href={`/report/${t.id}`} style={{ textDecoration: 'none' }}>
                      <div className="card-inner" style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                        padding: '8px var(--space-3)', cursor: 'pointer',
                      }}>
                        <IconGlobe size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="text-mono" style={{
                            fontSize: '0.6875rem', color: 'var(--text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {t.target_url}
                          </div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--muted)', marginTop: '1px' }}>
                            {new Date(t.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {t.resilience_score !== null && (
                          <span className="badge" style={{
                            background: `${getScoreColor(t.resilience_score)}0D`,
                            color: getScoreColor(t.resilience_score),
                            borderColor: `${getScoreColor(t.resilience_score)}1A`,
                          }}>
                            {t.resilience_score}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
