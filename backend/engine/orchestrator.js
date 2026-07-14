/**
 * BreakFlow AI — Test Orchestrator
 * 
 * Manages the lifecycle of a test run:
 * 1. Create test run in DB
 * 2. Launch browser via Playwright
 * 3. Execute selected personas sequentially
 * 4. Collect and log failures
 * 5. Calculate resilience score
 * 6. Generate recommendations
 * 7. Update DB with results
 */

import { chromium } from 'playwright';
import { FailureLogger } from './logger.js';
import { calculateResilienceScore } from './scorer.js';
import { generateAllRecommendations } from './recommender.js';
import { deduplicateIssues, getSeverityCounts } from './issueNormalizer.js';
import supabase from '../db/schema.js';

// Import personas
import * as rageClicker from './personas/rageClicker.js';
import * as halfFillUser from './personas/halfFillUser.js';
import * as confusedNavigator from './personas/confusedNavigator.js';
import * as slowNetworkUser from './personas/slowNetworkUser.js';
import * as contradictoryInputUser from './personas/contradictoryInputUser.js';
import * as viewportShifter from './personas/viewportShifter.js';
import * as multiTabUser from './personas/multiTabUser.js';
import * as permissionDenier from './personas/permissionDenier.js';

const PERSONAS = {
  'rage-clicker': rageClicker,
  'half-fill-user': halfFillUser,
  'confused-navigator': confusedNavigator,
  'slow-network-user': slowNetworkUser,
  'contradictory-input-user': contradictoryInputUser,
  'viewport-shifter': viewportShifter,
  'multi-tab-user': multiTabUser,
  'permission-denier': permissionDenier,
};

// Active test streams (SSE connections)
const activeStreams = new Map();

/**
 * Register an SSE stream for a test run
 */
export function registerStream(testRunId, res) {
  if (!activeStreams.has(testRunId)) {
    activeStreams.set(testRunId, []);
  }
  activeStreams.get(testRunId).push(res);
}

/**
 * Remove an SSE stream
 */
export function removeStream(testRunId, res) {
  const streams = activeStreams.get(testRunId);
  if (streams) {
    const idx = streams.indexOf(res);
    if (idx !== -1) streams.splice(idx, 1);
    if (streams.length === 0) activeStreams.delete(testRunId);
  }
}

/**
 * Send SSE event to all connected clients for a test run
 */
function sendEvent(testRunId, eventType, data) {
  const streams = activeStreams.get(testRunId) || [];
  const payload = JSON.stringify({ type: eventType, ...data, timestamp: new Date().toISOString() });
  
  for (const res of streams) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (e) {
      // Client disconnected
    }
  }

  // Also store event in DB (fire-and-forget)
  (async () => {
    try {
      await supabase.from('test_events').insert({
        test_run_id: testRunId,
        event_type: eventType,
        persona: data.persona || null,
        message: data.message || '',
        data: data
      });
    } catch (e) {
      // ignore DB errors for events
    }
  })();
}

/**
 * Run a complete test
 */
export async function runTest(testRunId, targetUrl, selectedPersonas) {
  console.log(`[Orchestrator] Starting test ${testRunId} for ${targetUrl}`);
  console.log(`[Orchestrator] Selected personas: ${selectedPersonas.join(', ')}`);

  // Update status to running
  await supabase.from('test_runs').update({
    status: 'running',
    started_at: new Date().toISOString()
  }).eq('id', testRunId);

  sendEvent(testRunId, 'status', { message: 'Test started', status: 'running' });

  const logger = new FailureLogger(testRunId, targetUrl);
  let browser;

  try {
    // Launch browser
    sendEvent(testRunId, 'progress', { message: 'Launching browser...', phase: 'init' });
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const personasToRun = selectedPersonas.filter(p => PERSONAS[p]);
    const totalPersonas = personasToRun.length;

    for (let i = 0; i < totalPersonas; i++) {
      const personaKey = personasToRun[i];
      const persona = PERSONAS[personaKey];
      const personaName = persona.metadata.name;
      const progress = Math.round(((i) / totalPersonas) * 100);

      sendEvent(testRunId, 'persona_start', {
        persona: personaName,
        personaKey,
        icon: persona.metadata.icon,
        index: i + 1,
        total: totalPersonas,
        progress,
        message: `Starting ${personaName}...`
      });

      console.log(`[Orchestrator] Running persona: ${personaName} (${i + 1}/${totalPersonas})`);

      try {
        // Create a fresh context and page for each persona
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        // Attach failure logger to page
        logger.attach(page, personaName);

        // Handle dialogs automatically
        page.on('dialog', async (dialog) => {
          await dialog.dismiss().catch(() => {});
        });

        // Execute persona
        const personaEvents = await persona.execute(page, targetUrl, logger);

        // Stream persona events
        for (const event of personaEvents) {
          sendEvent(testRunId, 'persona_event', {
            persona: personaName,
            ...event
          });
        }

        // Cleanup
        await page.close().catch(() => {});
        await context.close().catch(() => {});

        sendEvent(testRunId, 'persona_complete', {
          persona: personaName,
          personaKey,
          index: i + 1,
          total: totalPersonas,
          progress: Math.round(((i + 1) / totalPersonas) * 100),
          issuesFound: logger.getIssues().filter(issue => {
            const affectedPersonas = issue.details?.affected_personas || [issue.persona];
            return affectedPersonas.includes(personaName);
          }).length,
          message: `${personaName} completed`
        });

      } catch (personaError) {
        console.error(`[Orchestrator] Persona ${personaName} failed:`, personaError.message);
        sendEvent(testRunId, 'persona_error', {
          persona: personaName,
          message: `${personaName} encountered an error: ${personaError.message}`
        });
      }
    }

    // Calculate results
    sendEvent(testRunId, 'progress', { message: 'Analyzing results...', phase: 'analysis' });

    const rawIssues = logger.getIssues();
    const issues = deduplicateIssues(rawIssues);
    const scoreResult = calculateResilienceScore(issues, personasToRun);
    const recommendations = await generateAllRecommendations(issues, targetUrl);

    // Save issues to DB
    if (issues.length > 0) {
      const { error: issuesError } = await supabase.from('test_issues').insert(
        issues.map(issue => ({
          test_run_id: testRunId,
          persona: issue.persona,
          severity: issue.severity,
          category: issue.category,
          title: issue.title,
          description: issue.description,
          details: issue.details || {},
          timestamp: issue.timestamp
        }))
      );
      if (issuesError) console.error('[Orchestrator] Failed to save issues:', issuesError);
    }

    // Save recommendations
    if (recommendations.length > 0) {
      const { error: recsError } = await supabase.from('test_recommendations').insert(
        recommendations.map(rec => ({
          test_run_id: testRunId,
          issue_category: rec.issue_category,
          title: rec.title,
          description: rec.description,
          code_snippet: rec.code_snippet || null,
          priority: rec.priority,
          source: rec.source
        }))
      );
      if (recsError) console.error('[Orchestrator] Failed to save recommendations:', recsError);
    }

    // Update test run with final results
    const severityCounts = getSeverityCounts(issues);
    await supabase.from('test_runs').update({
      status: 'completed',
      resilience_score: scoreResult.score,
      total_issues: issues.length,
      critical_issues: severityCounts.critical,
      warning_issues: severityCounts.warning,
      info_issues: severityCounts.info,
      completed_at: new Date().toISOString()
    }).eq('id', testRunId);

    sendEvent(testRunId, 'complete', {
      message: 'Test completed',
      score: scoreResult.score,
      grade: scoreResult.grade,
      totalIssues: issues.length,
      breakdown: scoreResult.breakdown,
      status: 'completed'
    });

    console.log(`[Orchestrator] Test ${testRunId} completed. Score: ${scoreResult.score} (${scoreResult.grade})`);

  } catch (error) {
    console.error(`[Orchestrator] Test ${testRunId} failed:`, error);

    await supabase.from('test_runs').update({
      status: 'failed',
      completed_at: new Date().toISOString()
    }).eq('id', testRunId);

    sendEvent(testRunId, 'error', {
      message: `Test failed: ${error.message}`,
      status: 'failed'
    });

  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
