'use client';

import Link from 'next/link';
import Header from './components/Header';
import Footer from './components/Footer';
import { PERSONAS } from './components/PersonaSelector';
import { IconArrowRight } from './components/Icons';

const FEATURES = [
  { title: 'Browser personas', desc: 'Run repeatable sessions for rapid clicks, half-filled forms, navigation churn, resize checks, and denied permissions.' },
  { title: 'Failure signals', desc: 'Flag duplicate submissions, frozen UI states, broken redirects, missing validation, and client-side exceptions.' },
  { title: 'Run scoring', desc: 'Track a 0-100 resilience score with severity counts, persona breakdowns, and history for the same target.' },
  { title: 'Repair context', desc: 'Keep notes tied to the category that failed instead of handing teams a vague bug list.' },
  { title: 'Execution log', desc: 'See the browser actions and probes applied during a run, useful when a test needs to be reproduced.' },
  { title: 'Input probes', desc: 'Exercise long strings, malformed values, XSS payloads, SQL-like text, and boundary values.' },
];

const STEPS = [
  { n: '01', title: 'Paste URL', desc: 'Any reachable web app: production, staging, or tunneled localhost.' },
  { n: '02', title: 'Pick Personas', desc: 'Select which behavior patterns to test against.' },
  { n: '03', title: 'Run Test', desc: 'Watch browser sessions interact with the target in real time.' },
  { n: '04', title: 'Review Report', desc: 'Score, issues, categories, and repair notes in one place.' },
];

const COVERAGE_CHECKS = [
  { id: 'forms', name: 'Forms', desc: 'Required fields, partial submits, invalid values', color: '#D56F61' },
  { id: 'navigation', name: 'Navigation', desc: 'Back, forward, reload, dead ends', color: '#789CAE' },
  { id: 'network', name: 'Network', desc: 'Slow loads, offline states, recovery', color: '#C28A4B' },
  { id: 'responsive', name: 'Responsive', desc: 'Overflow, tap targets, fixed overlays', color: '#55A79C' },
  { id: 'state', name: 'State', desc: 'Duplicate actions and multi-tab drift', color: '#78B58A' },
];

export default function Home() {
  return (
    <>
      <Header activePage="home" />

      {/* HERO */}
      <section className="hero-section">
        <div className="container" style={{
          paddingTop: '72px',
          paddingBottom: '72px',
        }}>
          <div className="hero-grid" style={{
            display: 'grid',
            gridTemplateColumns: '0.92fr 1.08fr',
            gap: '56px',
            alignItems: 'center',
          }}>
            {/* Copy */}
            <div>
              <div className="fade-up" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginBottom: 'var(--space-4)',
              }}>
                <span style={{ width: 28, height: 1, background: 'var(--ember)' }} />
                <span className="text-label" style={{
                  color: 'var(--ember)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>
                  Browser resilience checks
                </span>
              </div>

              <h1 className="text-display fade-up delay-1">
                Stress-test browser flows before release.
              </h1>

              <p className="text-body fade-up delay-2" style={{
                maxWidth: '520px',
                marginTop: 'var(--space-5)',
              }}>
                BreakFlow runs failure-oriented browser sessions against a target URL
                and reports the failure modes that tend to survive ordinary QA:
                duplicate actions, partial submissions, layout drift, slow network
                behavior, and broken navigation state.
              </p>

              <div className="fade-up delay-3" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '1px',
                maxWidth: '520px',
                marginTop: 'var(--space-8)',
                border: '1px solid var(--line)',
                background: 'var(--line)',
              }}>
                {[
                  ['8', 'personas'],
                  ['0-100', 'score'],
                  ['live', 'runner log'],
                ].map(([value, label]) => (
                  <div key={label} style={{
                    background: 'var(--bg)',
                    padding: '12px 14px',
                  }}>
                    <div className="text-mono" style={{
                      color: 'var(--text)',
                      fontSize: '0.875rem',
                      fontWeight: 700,
                    }}>
                      {value}
                    </div>
                    <div className="text-label" style={{
                      marginTop: '2px',
                      textTransform: 'none',
                      letterSpacing: 0,
                    }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="fade-up delay-3" style={{
                display: 'flex',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-6)',
              }}>
                <Link href="/dashboard">
                  <button className="btn btn-primary btn-lg">
                    Run a check
                    <IconArrowRight size={15} />
                  </button>
                </Link>
                <a href="#how-it-works" className="btn btn-secondary btn-lg">
                  View process
                </a>
              </div>
            </div>

            {/* Terminal */}
            <div className="fade-up delay-2">
              <div className="terminal">
                <div className="terminal-bar">
                  <div className="terminal-dot" style={{ background: 'var(--crimson)' }} />
                  <div className="terminal-dot" style={{ background: 'var(--brass)' }} />
                  <div className="terminal-dot" style={{ background: 'var(--mint)' }} />
                  <span style={{
                    marginLeft: '8px',
                    fontSize: '0.625rem',
                    color: 'var(--muted)',
                    fontFamily: 'var(--font-mono)',
                  }}>
                    run.log
                  </span>
                </div>
                <div className="terminal-body">
                  <div><span className="prompt">$</span> <span className="cmd">breakflow run https://checkout.local</span></div>
                  <div style={{ height: 8 }} />
                  <div className="dim">Opening Chromium context...</div>
                  <div className="dim">Applying 8 behavior profiles...</div>
                  <div style={{ height: 8 }} />
                  <div><span className="ok">PASS</span> Small-Screen User - no overflow</div>
                  <div><span className="warn">WARN</span> Distracted Signup - missing validation</div>
                  <div><span className="err">FAIL</span> Impatient Buyer - duplicate submit</div>
                  <div><span className="ok">PASS</span> Privacy-First User - fallback shown</div>
                  <div><span className="warn">WARN</span> Bad Wi-Fi User - empty loading state</div>
                  <div style={{ height: 8 }} />
                  <div>Score: <span className="warn">74/100</span> (B-)</div>
                  <div style={{ marginTop: '3px' }}>
                    <div style={{
                      height: 4, borderRadius: 2,
                      background: 'var(--surface-3)',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', width: '74%',
                        background: 'var(--ember)',
                        borderRadius: 2,
                      }} />
                    </div>
                  </div>
                  <div className="ok" style={{ marginTop: '4px' }}>5 findings grouped by flow</div>
                  <div style={{ marginTop: '3px' }}>
                    <span className="prompt">$</span>{' '}
                    <span style={{ borderRight: '2px solid var(--mint)', animation: 'blink 1s step-end infinite', paddingRight: '1px' }}>&nbsp;</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="section">
        <div className="container">
          <SectionHeader
            label="Capabilities"
            title="What the runner checks"
          />

          <div className="feature-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-12)',
          }}>
            {FEATURES.map((f, index) => (
              <div key={f.title} className="card card-hover" style={{ padding: 'var(--space-6)' }}>
                <div className="text-label" style={{
                  color: 'var(--ember)',
                  marginBottom: 'var(--space-4)',
                }}>
                  {String(index + 1).padStart(2, '0')}
                </div>
                <h3 className="text-subheading" style={{ marginBottom: 'var(--space-2)' }}>
                  {f.title}
                </h3>
                <p className="text-small">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PERSONAS */}
      <section id="personas" className="section">
        <div className="container">
          <SectionHeader
            label="Personas"
            title="Behavior profiles"
          />

          <div className="persona-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-12)',
          }}>
            {PERSONAS.map((p, index) => (
              <div key={p.id} className="card card-hover persona-card">
                <div className="persona-card-header">
                  <div className="persona-num" style={{
                    borderColor: `${p.color}55`,
                    color: p.color,
                    background: `${p.color}12`,
                  }}>
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <h3 className="persona-title">{p.name}</h3>
                </div>
                <p className="persona-desc">
                  {p.description}
                </p>
                <div className="persona-tags">
                  {p.detects.map((tag) => (
                    <span key={tag} className="persona-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COVERAGE */}
      <section className="section">
        <div className="container">
          <SectionHeader
            label="Coverage"
            title="Coverage areas"
            subtitle="The runner focuses on browser behavior that tends to break real user workflows."
          />

          <div className="coverage-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-12)',
          }}>
            {COVERAGE_CHECKS.map((a) => (
              <div key={a.id} className="card" style={{
                padding: 'var(--space-5)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  marginBottom: 'var(--space-2)',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: a.color,
                  }} />
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{a.name}</h4>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {a.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="section">
        <div className="container-sm">
          <SectionHeader
            label="Process"
            title="Run workflow"
          />

          <div className="process-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-4)',
            marginTop: 'var(--space-12)',
          }}>
            {STEPS.map((s) => (
              <div key={s.n} className="card card-hover" style={{ padding: 'var(--space-5)' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  marginBottom: 'var(--space-3)',
                }}>
                  <div className="step-num">{s.n}</div>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                </div>
                <h3 className="text-subheading" style={{ marginBottom: '4px' }}>
                  {s.title}
                </h3>
                <p className="text-small">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="container" style={{ maxWidth: '640px' }}>
          <div className="card-accent" style={{
            padding: 'var(--space-16) var(--space-12)',
            textAlign: 'center',
          }}>
            <h2 className="text-title">
              Run the next release candidate
            </h2>
            <p className="text-body" style={{
              maxWidth: '380px',
              margin: 'var(--space-3) auto var(--space-8)',
            }}>
              Point BreakFlow at a staged build, select the behavior profiles, and review the findings before the deploy window.
            </p>
            <Link href="/dashboard">
              <button className="btn btn-primary btn-lg">
                Open dashboard
                <IconArrowRight size={15} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

function SectionHeader({ label, title, subtitle }) {
  return (
    <div>
      <span className="text-label" style={{ color: 'var(--ember)' }}>{label}</span>
      <h2 className="text-title" style={{ marginTop: '4px' }}>{title}</h2>
      {subtitle && (
        <p className="text-body" style={{ maxWidth: '480px', marginTop: 'var(--space-2)' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
