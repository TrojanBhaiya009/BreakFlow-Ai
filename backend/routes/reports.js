/**
 * BreakFlow AI — Report Routes
 */

import { Router } from 'express';
import supabase from '../db/schema.js';
import { deduplicateIssues, getSeverityCounts } from '../engine/issueNormalizer.js';

const router = Router();

function deduplicateRecommendations(recommendations = []) {
  const seen = new Set();
  return (recommendations || []).filter(rec => {
    const key = `${rec.issue_category || ''}:${String(rec.title || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const PERSONA_NAME_BY_ID = {
  'rage-clicker': 'Impatient Buyer',
  'half-fill-user': 'Distracted Signup',
  'confused-navigator': 'Lost Visitor',
  'slow-network-user': 'Bad Wi-Fi User',
  'contradictory-input-user': 'Hostile Inputter',
  'viewport-shifter': 'Small-Screen User',
  'multi-tab-user': 'Power Tabber',
  'permission-denier': 'Privacy-First User'
};

const LEGACY_PERSONA_NAME_BY_ID = {
  'rage-clicker': 'Rage Clicker',
  'half-fill-user': 'Half-Fill User',
  'confused-navigator': 'Confused Navigator',
  'slow-network-user': 'Slow Network User',
  'contradictory-input-user': 'Contradictory Input User',
  'viewport-shifter': 'Viewport Shifter',
  'multi-tab-user': 'Multi-Tab User',
  'permission-denier': 'Permission Denier'
};

function normalizePersona(value = '') {
  return String(value).toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function issuePersonas(issue = {}) {
  const personas = issue.details?.affected_personas?.length
    ? issue.details.affected_personas
    : [issue.persona];

  return personas.filter(Boolean).map(normalizePersona);
}

function issueMatchesPersona(issue, personaId) {
  const aliases = [
    personaId,
    PERSONA_NAME_BY_ID[personaId],
    LEGACY_PERSONA_NAME_BY_ID[personaId]
  ].filter(Boolean).map(normalizePersona);

  const issueAliases = issuePersonas(issue);
  return aliases.some(alias => issueAliases.includes(alias));
}

/**
 * GET /api/reports/:id
 * Get full test report with issues, score, and recommendations
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get test run
    const { data: testRun, error: testError } = await supabase
      .from('test_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (testError || !testRun) {
      return res.status(404).json({ error: 'Test run not found' });
    }

    // Get issues
    const { data: issues, error: issuesError } = await supabase
      .from('test_issues')
      .select('*')
      .eq('test_run_id', id)
      .order('timestamp', { ascending: true });

    // Get recommendations
    const { data: recommendations, error: recsError } = await supabase
      .from('test_recommendations')
      .select('*')
      .eq('test_run_id', id)
      .order('created_at', { ascending: true });

    // Get events
    const { data: events, error: eventsError } = await supabase
      .from('test_events')
      .select('*')
      .eq('test_run_id', id)
      .order('created_at', { ascending: true });

    const uniqueIssues = deduplicateIssues(issues || []);
    const severityCounts = getSeverityCounts(uniqueIssues);
    const uniqueRecommendations = deduplicateRecommendations(recommendations || []);

    // Build persona breakdown
    const personaBreakdown = {};
    for (const persona of (testRun.personas || [])) {
      const personaIssues = uniqueIssues.filter(i => issueMatchesPersona(i, persona));
      personaBreakdown[persona] = {
        totalIssues: personaIssues.length,
        critical: personaIssues.filter(i => i.severity === 'critical').length,
        warning: personaIssues.filter(i => i.severity === 'warning').length,
        info: personaIssues.filter(i => i.severity === 'info').length,
        categories: [...new Set(personaIssues.map(i => i.category))]
      };
    }

    // Build category summary
    const categorySummary = {};
    for (const issue of uniqueIssues) {
      if (!categorySummary[issue.category]) {
        categorySummary[issue.category] = { count: 0, highestSeverity: 'info' };
      }
      categorySummary[issue.category].count++;
      if (issue.severity === 'critical') {
        categorySummary[issue.category].highestSeverity = 'critical';
      } else if (issue.severity === 'warning' && categorySummary[issue.category].highestSeverity !== 'critical') {
        categorySummary[issue.category].highestSeverity = 'warning';
      }
    }

    res.json({
      testRun,
      issues: uniqueIssues,
      recommendations: uniqueRecommendations,
      events: events || [],
      summary: {
        personaBreakdown,
        categorySummary,
        totalIssues: uniqueIssues.length,
        criticalIssues: severityCounts.critical,
        warningIssues: severityCounts.warning,
        infoIssues: severityCounts.info,
        resilienceScore: testRun.resilience_score,
        duration: testRun.completed_at && testRun.started_at
          ? new Date(testRun.completed_at) - new Date(testRun.started_at)
          : null
      }
    });

  } catch (error) {
    console.error('GET /api/reports/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/reports/:id/pdf
 * Download a full PDF audit report
 */
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    // Get test run
    const { data: testRun, error: testError } = await supabase
      .from('test_runs')
      .select('*')
      .eq('id', id)
      .single();

    if (testError || !testRun) {
      return res.status(404).json({ error: 'Test run not found' });
    }

    if (testRun.status !== 'completed') {
      return res.status(400).json({ error: 'Test is not yet completed' });
    }

    // Get issues
    const { data: issues } = await supabase
      .from('test_issues')
      .select('*')
      .eq('test_run_id', id)
      .order('timestamp', { ascending: true });

    // Get recommendations
    const { data: recommendations } = await supabase
      .from('test_recommendations')
      .select('*')
      .eq('test_run_id', id)
      .order('created_at', { ascending: true });

    const uniqueIssues = deduplicateIssues(issues || []);
    const severityCounts = getSeverityCounts(uniqueIssues);
    const uniqueRecommendations = deduplicateRecommendations(recommendations || []);

    // Build summary
    const personaBreakdown = {};
    for (const persona of (testRun.personas || [])) {
      const personaIssues = uniqueIssues.filter(i => issueMatchesPersona(i, persona));
      personaBreakdown[persona] = {
        totalIssues: personaIssues.length,
        critical: personaIssues.filter(i => i.severity === 'critical').length,
        warning: personaIssues.filter(i => i.severity === 'warning').length,
        info: personaIssues.filter(i => i.severity === 'info').length,
      };
    }

    const categorySummary = {};
    for (const issue of uniqueIssues) {
      if (!categorySummary[issue.category]) {
        categorySummary[issue.category] = { count: 0, highestSeverity: 'info' };
      }
      categorySummary[issue.category].count++;
      if (issue.severity === 'critical') {
        categorySummary[issue.category].highestSeverity = 'critical';
      } else if (issue.severity === 'warning' && categorySummary[issue.category].highestSeverity !== 'critical') {
        categorySummary[issue.category].highestSeverity = 'warning';
      }
    }

    const reportData = {
      testRun,
      issues: uniqueIssues,
      recommendations: uniqueRecommendations,
      summary: {
        personaBreakdown,
        categorySummary,
        totalIssues: uniqueIssues.length,
        criticalIssues: severityCounts.critical,
        warningIssues: severityCounts.warning,
        infoIssues: severityCounts.info,
        resilienceScore: testRun.resilience_score,
        duration: testRun.completed_at && testRun.started_at
          ? new Date(testRun.completed_at) - new Date(testRun.started_at)
          : null
      }
    };

    // Generate PDF
    const hostname = new URL(testRun.target_url).hostname.replace(/\./g, '_');
    const filename = `breakflow_report_${hostname}_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const { generatePDFReport } = await import('../engine/pdfReport.js');
    await generatePDFReport(reportData, res);

  } catch (error) {
    console.error('GET /api/reports/:id/pdf error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF report' });
    }
  }
});

export default router;
