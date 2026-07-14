/**
 * BreakFlow AI — PDF Report Generator
 * Uses Playwright to render a styled HTML report page to PDF.
 * Far more reliable than manual PDFKit coordinate placement.
 */

import { chromium } from 'playwright';

function getGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 45) return 'D';
  if (score >= 40) return 'D-';
  return 'F';
}

function getScoreColor(score) {
  if (score >= 80) return '#34d399';
  if (score >= 60) return '#fcd34d';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function getPriorityColor(p) {
  return { critical: '#ef4444', high: '#f97316', medium: '#fcd34d', low: '#60a5fa' }[p] || '#8b92a5';
}

function getSeverityColor(s) {
  return { critical: '#ef4444', warning: '#f59e0b', info: '#60a5fa' }[s] || '#8b92a5';
}

function fmt(cat) {
  return (cat || '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHTML(reportData) {
  const { testRun, issues, recommendations, summary } = reportData;
  const score = testRun.resilience_score ?? 0;
  const grade = getGrade(score);
  const scoreColor = getScoreColor(score);

  const dateStr = testRun.completed_at
    ? new Date(testRun.completed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const duration = summary.duration ? `${Math.round(summary.duration / 1000)}s` : '—';

  // Severity bars
  const maxCount = Math.max(summary.criticalIssues, summary.warningIssues, summary.infoIssues, 1);
  const bars = [
    { label: 'Critical', count: summary.criticalIssues, color: '#ef4444' },
    { label: 'Warning',  count: summary.warningIssues,  color: '#f59e0b' },
    { label: 'Info',     count: summary.infoIssues,     color: '#60a5fa' },
  ].map(b => `
    <div class="bar-row">
      <span class="bar-label">${b.label}</span>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round((b.count / maxCount) * 100)}%;background:${b.color}"></div>
      </div>
      <span class="bar-count" style="color:${b.color}">${b.count}</span>
    </div>`).join('');

  // Persona table rows
  const personaRows = Object.entries(summary.personaBreakdown || {}).map(([pid, d]) => `
    <tr>
      <td>${fmt(pid)}</td>
      <td class="center">${d.totalIssues}</td>
      <td class="center" style="color:#ef4444">${d.critical || 0}</td>
      <td class="center" style="color:#f59e0b">${d.warning || 0}</td>
      <td class="center" style="color:#60a5fa">${d.info || 0}</td>
    </tr>`).join('');

  // Category table rows
  const catRows = Object.entries(summary.categorySummary || {}).map(([cat, data]) => `
    <tr>
      <td>${fmt(cat)}</td>
      <td class="center">${data.count}</td>
      <td class="center" style="color:${getSeverityColor(data.highestSeverity)};font-weight:700;font-size:11px;letter-spacing:.05em">
        ${data.highestSeverity.toUpperCase()}
      </td>
    </tr>`).join('');

  // Issues grouped by severity
  const grouped = { critical: [], warning: [], info: [] };
  for (const issue of issues) {
    const s = issue.severity || 'info';
    (grouped[s] || grouped.info).push(issue);
  }

  const issueSections = ['critical', 'warning', 'info'].map(sev => {
    const list = grouped[sev];
    if (!list.length) return '';
    const color = getSeverityColor(sev);
    const rows = list.slice(0, 60).map(issue => `
      <div class="issue-row">
        <div class="issue-header">
          <span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${sev.toUpperCase()}</span>
          <span class="badge accent-badge">${fmt(issue.category)}</span>
          <span class="persona-tag">${escHtml(issue.persona)}</span>
          <span class="issue-time">${issue.timestamp ? new Date(issue.timestamp).toLocaleTimeString() : ''}</span>
        </div>
        <div class="issue-title">${escHtml(issue.title)}</div>
        <div class="issue-desc">${escHtml((issue.description || '').slice(0, 250))}</div>
      </div>`).join('');

    const more = list.length > 60 ? `<p class="more-note">… and ${list.length - 60} more ${sev} issues</p>` : '';
    return `
      <div class="sev-section">
        <div class="sev-header" style="border-left:4px solid ${color};color:${color}">
          ${sev.toUpperCase()} — ${list.length} issue${list.length !== 1 ? 's' : ''}
        </div>
        ${rows}${more}
      </div>`;
  }).join('');

  // Recommendations
  const recCards = recommendations.map((rec, i) => {
    const pc = getPriorityColor(rec.priority);
    const snippet = rec.code_snippet
      ? `<pre class="code-block">${escHtml(rec.code_snippet.slice(0, 1200))}</pre>`
      : '';
    return `
      <div class="rec-card">
        <div class="rec-header">
          <span class="rec-num">${i + 1}</span>
          <div class="rec-title">${escHtml(rec.title)}</div>
          <span class="badge" style="background:${pc}22;color:${pc};border:1px solid ${pc}44;margin-left:auto">${(rec.priority || 'medium').toUpperCase()}</span>
        </div>
        <p class="rec-desc">${escHtml(rec.description)}</p>
        <div class="rec-meta">Source: ${escHtml(rec.source || 'rule-based')} &nbsp;·&nbsp; Category: ${fmt(rec.issue_category)}</div>
        ${snippet}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>BreakFlow AI — Audit Report</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', sans-serif;
    background: #0c0f17;
    color: #edeef1;
    font-size: 13px;
    line-height: 1.6;
    padding: 0;
  }

  /* ── Header ── */
  .header {
    background: #181c28;
    border-bottom: 1px solid #2a3040;
    padding: 20px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-mark {
    width: 36px; height: 36px; border-radius: 8px;
    background: #f0b429;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800; color: #fff;
  }
  .logo-text { font-size: 20px; font-weight: 800; }
  .logo-text span { color: #f0b429; }
  .report-tag { font-size: 11px; color: #555d73; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }

  /* ── Page container ── */
  .page { padding: 32px 40px; }

  /* ── Summary cards ── */
  .summary-grid {
    display: grid;
    grid-template-columns: 200px 1fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
  }
  .card {
    background: #181c28;
    border: 1px solid #2a3040;
    border-radius: 12px;
    padding: 20px;
  }
  .card-label {
    font-size: 10px; font-weight: 600; letter-spacing: .08em;
    text-transform: uppercase; color: #555d73; margin-bottom: 10px;
  }

  /* ── Score circle ── */
  .score-wrap { text-align: center; padding: 24px 0 8px; }
  .score-num {
    font-size: 56px; font-weight: 800; line-height: 1;
    color: ${scoreColor};
  }
  .score-sub { font-size: 11px; color: #555d73; margin-top: 4px; }
  .grade-num { font-size: 28px; font-weight: 800; color: ${scoreColor}; margin-top: 8px; }

  /* ── Meta grid ── */
  .meta-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .meta-label { font-size: 10px; color: #555d73; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; }
  .meta-value { font-size: 13px; color: #edeef1; word-break: break-all; }

  /* ── Stats ── */
  .stats-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; }
  .stat-box { background: #0c0f17; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #2a3040; }
  .stat-num { font-size: 22px; font-weight: 700; }
  .stat-lbl { font-size: 10px; color: #555d73; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; margin-top: 2px; }

  /* ── Bars ── */
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .bar-label { width: 60px; font-size: 12px; color: #8b92a5; }
  .bar-track { flex: 1; height: 10px; background: #2a3040; border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 5px; min-width: 2px; }
  .bar-count { width: 40px; text-align: right; font-size: 12px; font-weight: 600; }

  /* ── Section headings ── */
  .section { margin-bottom: 28px; }
  .section-title {
    font-size: 16px; font-weight: 700; color: #edeef1;
    margin-bottom: 16px; padding-bottom: 8px;
    border-bottom: 1px solid #2a3040;
    display: flex; align-items: center; gap: 8px;
  }
  .section-title .count {
    font-size: 11px; background: #2a3040; color: #8b92a5;
    border-radius: 20px; padding: 2px 8px; font-weight: 500;
  }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th {
    background: #1e2333; color: #555d73;
    font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
    padding: 8px 12px; text-align: left;
    border-bottom: 1px solid #2a3040;
  }
  td { padding: 9px 12px; border-bottom: 1px solid #1e2333; color: #edeef1; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: rgba(255,255,255,.015); }
  .center { text-align: center; }

  /* ── Badge ── */
  .badge {
    display: inline-block;
    font-size: 10px; font-weight: 600; letter-spacing: .04em;
    padding: 2px 7px; border-radius: 4px; text-transform: uppercase;
  }
  .accent-badge { background: rgba(240,180,41,.1); color: #f0b429; border: 1px solid rgba(240,180,41,.2); }

  /* ── Issues ── */
  .sev-section { margin-bottom: 20px; }
  .sev-header {
    padding: 8px 14px; border-radius: 6px; margin-bottom: 8px;
    font-size: 11px; font-weight: 700; letter-spacing: .06em;
    background: rgba(255,255,255,.03);
  }
  .issue-row {
    background: #181c28; border: 1px solid #2a3040; border-radius: 8px;
    padding: 12px 14px; margin-bottom: 6px;
  }
  .issue-header { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; flex-wrap: wrap; }
  .persona-tag { font-size: 10px; color: #555d73; font-family: 'JetBrains Mono', monospace; }
  .issue-time { font-size: 10px; color: #323848; margin-left: auto; font-family: 'JetBrains Mono', monospace; }
  .issue-title { font-size: 13px; font-weight: 600; color: #edeef1; margin-bottom: 3px; }
  .issue-desc { font-size: 12px; color: #8b92a5; line-height: 1.5; }
  .more-note { font-size: 11px; color: #555d73; padding: 6px 14px; font-style: italic; }

  /* ── Recommendations ── */
  .rec-card {
    background: #181c28; border: 1px solid #2a3040; border-radius: 10px;
    padding: 16px 18px; margin-bottom: 12px;
  }
  .rec-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .rec-num {
    width: 24px; height: 24px; border-radius: 6px;
    background: #f0b429; color: #fff;
    font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .rec-title { font-size: 14px; font-weight: 600; color: #edeef1; }
  .rec-desc { font-size: 12px; color: #8b92a5; line-height: 1.6; margin-bottom: 8px; }
  .rec-meta { font-size: 10px; color: #555d73; margin-bottom: 10px; }
  .code-block {
    background: #0c0f17; border: 1px solid #2a3040; border-radius: 8px;
    padding: 12px 14px; font-family: 'JetBrains Mono', monospace;
    font-size: 11px; color: #34d399; white-space: pre-wrap; word-break: break-word;
    overflow: hidden;
  }

  /* ── Page break ── */
  .page-break { page-break-before: always; }

  /* ── Footer ── */
  .footer {
    text-align: center; color: #323848; font-size: 10px;
    padding: 16px 40px; border-top: 1px solid #1e2333; margin-top: 20px;
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="logo">
    <div class="logo-mark">⚡</div>
    <div class="logo-text">Break<span>Flow</span> AI</div>
  </div>
  <div class="report-tag">Chaos Audit Report</div>
</div>

<!-- PAGE 1: SUMMARY -->
<div class="page">

  <!-- Summary cards -->
  <div class="summary-grid">

    <!-- Score -->
    <div class="card" style="text-align:center">
      <div class="card-label">Resilience Score</div>
      <div class="score-wrap">
        <div class="score-num">${score}</div>
        <div class="score-sub">out of 100</div>
        <div class="grade-num">Grade: ${grade}</div>
      </div>
    </div>

    <!-- Meta -->
    <div class="card">
      <div class="card-label">Test Details</div>
      <div class="meta-row">
        <div class="meta-label">Target URL</div>
        <div class="meta-value">${escHtml(testRun.target_url)}</div>
      </div>
      <div class="meta-row">
        <div class="meta-label">Date</div>
        <div class="meta-value">${dateStr}</div>
      </div>
      <div class="meta-row">
        <div class="meta-label">Duration</div>
        <div class="meta-value">${duration}</div>
      </div>
      <div class="meta-row">
        <div class="meta-label">Status</div>
        <div class="meta-value">${escHtml(testRun.status)}</div>
      </div>
    </div>

    <!-- Stats -->
    <div class="card">
      <div class="card-label">Issue Summary</div>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-num" style="color:#edeef1">${summary.totalIssues}</div>
          <div class="stat-lbl">Total</div>
        </div>
        <div class="stat-box">
          <div class="stat-num" style="color:#ef4444">${summary.criticalIssues}</div>
          <div class="stat-lbl">Critical</div>
        </div>
        <div class="stat-box">
          <div class="stat-num" style="color:#fcd34d">${summary.warningIssues}</div>
          <div class="stat-lbl">Warnings</div>
        </div>
        <div class="stat-box">
          <div class="stat-num" style="color:#60a5fa">${summary.infoIssues}</div>
          <div class="stat-lbl">Info</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Severity Bars -->
  <div class="section">
    <div class="section-title">Severity Breakdown</div>
    <div class="card">${bars}</div>
  </div>

  <!-- Persona Breakdown -->
  ${personaRows ? `
  <div class="section">
    <div class="section-title">Persona Breakdown</div>
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead><tr>
          <th>Persona</th>
          <th class="center">Total</th>
          <th class="center" style="color:#ef4444">Critical</th>
          <th class="center" style="color:#f59e0b">Warning</th>
          <th class="center" style="color:#60a5fa">Info</th>
        </tr></thead>
        <tbody>${personaRows}</tbody>
      </table>
    </div>
  </div>` : ''}

  <!-- Category Summary -->
  ${catRows ? `
  <div class="section">
    <div class="section-title">Issue Categories</div>
    <div class="card" style="padding:0;overflow:hidden">
      <table>
        <thead><tr>
          <th>Category</th>
          <th class="center">Count</th>
          <th class="center">Highest Severity</th>
        </tr></thead>
        <tbody>${catRows}</tbody>
      </table>
    </div>
  </div>` : ''}
</div>

<!-- PAGE 2: ISSUES -->
<div class="page page-break">
  <div class="section">
    <div class="section-title">
      Issues Found
      <span class="count">${issues.length} total</span>
    </div>
    ${issueSections || '<div class="card" style="text-align:center;padding:40px;color:#555d73">No issues detected 🎉</div>'}
  </div>
</div>

<!-- PAGE 3: RECOMMENDATIONS -->
${recommendations.length > 0 ? `
<div class="page page-break">
  <div class="section">
    <div class="section-title">
      Fix Recommendations
      <span class="count">${recommendations.length} fixes</span>
    </div>
    ${recCards}
  </div>
</div>` : ''}

<!-- FOOTER -->
<div class="footer">
  Generated by BreakFlow AI &nbsp;·&nbsp; ${new Date().toISOString()} &nbsp;·&nbsp;
  Results reflect automated chaos testing and may include false positives.
</div>

</body>
</html>`;
}

/**
 * Generate PDF using Playwright — renders HTML then exports to PDF.
 * @param {Object} reportData
 * @param {import('stream').Writable} stream
 */
export async function generatePDFReport(reportData, stream) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();

    const html = buildHTML(reportData);
    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    stream.write(pdfBuffer);
    stream.end();
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
