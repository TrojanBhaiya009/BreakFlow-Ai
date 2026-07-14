'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { use } from 'react';
import Header from '../../components/Header';
import ScoreGauge, { getScoreColor } from '../../components/ScoreGauge';
import {
  IconArrowLeft, IconGlobe, IconClock,
  IconChevronDown, IconChevronRight,
  IconCode, IconCheck,
} from '../../components/Icons';

const API_URL = 'http://localhost:3001';

export default function ReportPage({ params }) {
  const { id } = use(params);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('issues');
  const [expandedRec, setExpandedRec] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfToast, setPdfToast] = useState(null);
  const [fixingIssue, setFixingIssue] = useState(null);
  const [generatedFixes, setGeneratedFixes] = useState({});
  const [copied, setCopied] = useState(null);

  async function handleExportPDF() {
    setPdfDownloading(true);
    setPdfToast(null);
    try {
      const res = await fetch(`${API_URL}/api/reports/${id}/pdf`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `breakflow_report_${id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfToast('success');
    } catch {
      setPdfToast('error');
    } finally {
      setPdfDownloading(false);
      setTimeout(() => setPdfToast(null), 3000);
    }
  }

  async function handleFix(issue, index) {
    setFixingIssue(index);
    try {
      const res = await fetch(`${API_URL}/api/codex/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issue: { title: issue.title, description: issue.description, category: issue.category, severity: issue.severity },
          targetUrl: report.testRun.target_url,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedFixes(prev => ({ ...prev, [index]: data.fix }));
      } else {
        setGeneratedFixes(prev => ({ ...prev, [index]: localFix(issue) }));
      }
    } catch {
      setGeneratedFixes(prev => ({ ...prev, [index]: localFix(issue) }));
    } finally {
      setFixingIssue(null);
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function shareReport() {
    const url = `${window.location.origin}/report/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied('share');
      setTimeout(() => setCopied(null), 2000);
    });
  }

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/reports/${id}`);
        if (!res.ok) throw new Error('Not found');
        setReport(await res.json());
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    };
    load();

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/api/reports/${id}`);
        const data = await res.json();
        setReport(data);
        if (['completed', 'failed'].includes(data.testRun?.status)) clearInterval(poll);
      } catch {}
    }, 5000);
    return () => clearInterval(poll);
  }, [id]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="container" style={{ paddingTop: '120px', textAlign: 'center' }}>
          <div style={{
            width: 16, height: 16, border: '2px solid var(--line)',
            borderTopColor: 'var(--ember)', borderRadius: '50%',
            animation: 'spin 0.6s linear infinite', margin: '0 auto var(--space-3)',
          }} />
          <p className="text-small text-mono">Loading...</p>
        </main>
      </>
    );
  }

  if (error || !report) {
    return (
      <>
        <Header />
        <main className="container" style={{ paddingTop: '120px', textAlign: 'center' }}>
          <h2 className="text-heading">Not found</h2>
          <p className="text-body" style={{ marginTop: '4px' }}>{error}</p>
          <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: 'var(--space-5)' }}>
            <IconArrowLeft size={15} /> Dashboard
          </Link>
        </main>
      </>
    );
  }

  const { testRun, issues, recommendations, summary } = report;
  const score = testRun.resilience_score;

  const tabs = [
    { key: 'issues', label: `Issues (${issues.length})` },
    { key: 'recommendations', label: `Fixes (${recommendations.length})` },
    { key: 'categories', label: 'Categories' },
  ];

  return (
    <>
      <Header />
      <main className="container" style={{ paddingTop: '88px', paddingBottom: '48px' }}>
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)', flexWrap: 'wrap',
          }}>
            <h1 className="text-title">Report</h1>
            <span className={`badge badge-${testRun.status === 'completed' ? 'success' : testRun.status === 'failed' ? 'critical' : 'ember'}`}>
              {testRun.status}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
              <button className="btn btn-secondary btn-sm" onClick={shareReport}>
                {copied === 'share' ? <><IconCheck size={13} /> Copied</> : 'Copy link'}
              </button>
              {testRun.status === 'completed' && (
                <button className="btn btn-secondary btn-sm" onClick={handleExportPDF} disabled={pdfDownloading}>
                  {pdfDownloading ? 'Generating...' : 'Export PDF'}
                </button>
              )}
            </div>
          </div>

          {pdfToast && (
            <div style={{
              display: 'inline-block', padding: '4px 10px',
              borderRadius: 'var(--radius-sm)', fontSize: '0.75rem',
              background: pdfToast === 'success' ? 'rgba(120,181,138,0.12)' : 'rgba(213,111,97,0.12)',
              border: `1px solid ${pdfToast === 'success' ? 'rgba(120,181,138,0.28)' : 'rgba(213,111,97,0.28)'}`,
              color: pdfToast === 'success' ? 'var(--mint)' : 'var(--crimson)',
              marginBottom: 'var(--space-2)',
            }}>
              {pdfToast === 'success' ? 'PDF downloaded' : 'PDF generation failed'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <span className="text-mono text-small" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <IconGlobe size={13} /> {testRun.target_url}
            </span>
            <span className="text-mono text-small" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <IconClock size={13} /> {new Date(testRun.created_at).toLocaleString()}
            </span>
            {summary.duration && (
              <span className="text-mono text-small">{fmtDuration(summary.duration)}</span>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="summary-grid" style={{
          display: 'grid', gridTemplateColumns: '220px 1fr',
          gap: 'var(--space-4)', marginBottom: 'var(--space-6)',
        }}>
          <div className="card-accent" style={{ padding: 'var(--space-6)', textAlign: 'center', gridRow: 'span 2' }}>
            <span className="text-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>Score</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ScoreGauge score={score} size={140} />
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <span className="text-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>Issues</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
              {[
                { v: summary.criticalIssues, l: 'Critical', c: 'var(--crimson)' },
                { v: summary.warningIssues, l: 'Warning', c: 'var(--color-warning)' },
                { v: summary.infoIssues, l: 'Info', c: 'var(--color-info)' },
              ].map(s => (
                <div key={s.l} style={{
                  textAlign: 'center', padding: 'var(--space-3)',
                  background: 'var(--surface-2)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--line)',
                }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.c }}>{s.v}</div>
                  <div className="text-label">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 'var(--space-5)' }}>
            <span className="text-label" style={{ display: 'block', marginBottom: 'var(--space-3)' }}>Personas</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {(testRun.personas || []).map(pid => {
                const pd = summary.personaBreakdown?.[pid];
                return (
                  <span key={pid} className="badge badge-neutral">
                    {fmtCat(pid)} {pd && <span style={{ opacity: 0.5 }}>({pd.totalIssues})</span>}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-list" style={{ marginBottom: 'var(--space-4)' }}>
          {tabs.map(t => (
            <button
              key={t.key}
              className={`tab-button ${activeTab === t.key ? 'tab-button-active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'issues' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {issues.length === 0 ? (
                <Empty title="No issues found" sub="Your app handled the test well." />
              ) : issues.map((issue, i) => (
                <div key={issue.id || i} className="card" style={{ padding: 'var(--space-4) var(--space-5)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span className={`badge ${sevBadge(issue.severity)}`}>{issue.severity}</span>
                        <span className="badge badge-ember">{fmtCat(issue.category)}</span>
                        <span className="text-mono" style={{ fontSize: '0.625rem', color: 'var(--muted)' }}>{issue.persona}</span>
                      </div>
                      <h4 style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '2px' }}>{issue.title}</h4>
                      <p className="text-small">{issue.description}</p>

                      <div style={{ marginTop: 'var(--space-3)' }}>
                        {!generatedFixes[i] ? (
                          <button className="btn-fix" onClick={() => handleFix(issue, i)} disabled={fixingIssue === i}>
                            {fixingIssue === i ? (
                              <><span style={{
                                width: 9, height: 9, border: '2px solid rgba(85,167,156,0.28)',
                                borderTopColor: 'var(--ember)', borderRadius: '50%',
                                display: 'inline-block', animation: 'spin 0.6s linear infinite',
                              }} /> Generating...</>
                            ) : (
                              <><IconCode size={11} /> Draft repair</>
                            )}
                          </button>
                        ) : (
                          <div style={{ marginTop: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span className="text-mono" style={{ fontSize: '0.625rem', color: 'var(--mint)', fontWeight: 600 }}>
                                Repair note ready
                              </span>
                              <button className="btn-fix" onClick={() => copy(generatedFixes[i], i)} style={{ fontSize: '0.5625rem', padding: '2px 6px' }}>
                                {copied === i ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <div className="code-block">{generatedFixes[i]}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-mono" style={{ fontSize: '0.5625rem', color: 'var(--muted)', flexShrink: 0, opacity: 0.5 }}>
                      {issue.timestamp ? new Date(issue.timestamp).toLocaleTimeString() : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {recommendations.length === 0 ? (
                <Empty title="No recommendations" sub="No fixes needed." />
              ) : recommendations.map((rec, i) => (
                <div key={rec.id || i} className="card" style={{ padding: 'var(--space-5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: prioColor(rec.priority), flexShrink: 0 }} />
                    <h4 style={{ fontWeight: 600, fontSize: '0.875rem' }}>{rec.title}</h4>
                    <span className="badge" style={{
                      background: `${prioColor(rec.priority)}12`,
                      color: prioColor(rec.priority),
                      borderColor: `${prioColor(rec.priority)}22`,
                    }}>{rec.priority}</span>
                    <span className="badge badge-codex">{sourceLabel(rec.source)}</span>
                  </div>
                  <p className="text-small" style={{ marginBottom: rec.code_snippet ? 'var(--space-3)' : 0 }}>
                    {rec.description}
                  </p>
                  {rec.code_snippet && (
                    <>
                      <button
                        onClick={() => setExpandedRec(expandedRec === i ? null : i)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--ember)',
                          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500,
                          padding: '2px 0', fontFamily: 'var(--font-mono)',
                          display: 'flex', alignItems: 'center', gap: '3px',
                        }}
                      >
                        {expandedRec === i
                          ? <><IconChevronDown size={13} /> Hide code</>
                          : <><IconChevronRight size={13} /> Show code</>}
                      </button>
                      {expandedRec === i && (
                        <div className="code-block" style={{ marginTop: '4px' }}>{rec.code_snippet}</div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'categories' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
              {Object.entries(summary.categorySummary || {}).map(([cat, data]) => (
                <div key={cat} className="card" style={{ padding: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h4 style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{fmtCat(cat)}</h4>
                    <span className={`badge ${sevBadge(data.highestSeverity)}`}>{data.highestSeverity}</span>
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.count}</div>
                  <div className="text-label">{data.count === 1 ? 'occurrence' : 'occurrences'}</div>
                </div>
              ))}
              {Object.keys(summary.categorySummary || {}).length === 0 && (
                <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center', gridColumn: '1 / -1' }}>
                  <p className="text-small">No categories.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ marginTop: 'var(--space-8)', textAlign: 'center' }}>
          <Link href="/dashboard" className="btn btn-secondary btn-lg">
            <IconArrowLeft size={15} /> Back to dashboard
          </Link>
        </div>
      </main>
    </>
  );
}

function Empty({ title, sub }) {
  return (
    <div className="card" style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
      <h3 className="text-subheading" style={{ color: 'var(--text-2)' }}>{title}</h3>
      <p className="text-small" style={{ marginTop: '2px' }}>{sub}</p>
    </div>
  );
}

function sevBadge(s) {
  return { critical: 'badge-critical', warning: 'badge-warning', info: 'badge-info' }[s] || 'badge-info';
}

function prioColor(p) {
  return { critical: '#D56F61', high: '#D08355', medium: '#C28A4B', low: '#789CAE' }[p] || '#8E8678';
}

function sourceLabel(source) {
  return source === 'codex' ? 'analysis' : source;
}

function fmtDuration(ms) {
  if (!ms) return '';
  return ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`;
}

function fmtCat(c) {
  return c.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function localFix(issue) {
  const fixes = {
    duplicate_request: `// Debounce form submissions
let submitting = false;
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;
  submitting = true;
  btn.disabled = true;
  try { await fetch(form.action, { method: 'POST', body: new FormData(form) }); }
  finally { submitting = false; btn.disabled = false; }
});`,
    uncaught_exception: `// Global error boundary
window.addEventListener('error', (e) => {
  console.error(e.error);
  showNotification('Something went wrong');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  e.preventDefault();
});`,
    network_error: `// Retry with exponential backoff
async function fetchRetry(url, opts = {}, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.ok) return res;
      if (i < retries) await new Promise(r => setTimeout(r, 2**i * 1000));
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 2**i * 1000));
    }
  }
}`,
    input_validation: `// Schema validation with Zod
import { z } from 'zod';
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});
const result = schema.safeParse(data);
if (!result.success) showErrors(result.error.errors);`,
  };
  return fixes[issue.category] || `// Fix for: ${issue.title}
// Category: ${issue.category}
try {
  await performAction();
} catch (error) {
  handleGracefully(error);
}`;
}
