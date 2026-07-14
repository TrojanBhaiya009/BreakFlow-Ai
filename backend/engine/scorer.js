/**
 * BreakFlow AI — Resilience Score Calculator
 * 
 * Calculates a 0-100 resilience score based on issues found during testing.
 * Higher score = more resilient application.
 * 
 * Scores unique issue groups instead of raw repeated browser events.
 */

import { deduplicateIssues, getSeverityCounts } from './issueNormalizer.js';

const SEVERITY_WEIGHTS = {
  critical: 14,
  warning: 6,
  info: 2
};

const CATEGORY_MULTIPLIERS = {
  duplicate_request: 1.5,
  uncaught_exception: 1.4,
  request_failed: 1.0,
  network_error: 0.8,
  console_error: 0.5,   // lowered — console errors are noisy
  ui_freeze: 1.6,
  broken_redirect: 1.3,
  stale_session: 1.4,
  form_resubmission: 1.5,
  timeout: 1.2,
  navigation_error: 1.0,
  input_validation: 0.9,
  responsive_layout: 0.9,
  state_management: 1.2,
  permission_handling: 0.8
};

/**
 * Calculate resilience score from deduplicated issue groups.
 * Repeated occurrences add a capped penalty instead of creating repeated rows.
 * 
 * @param {Array} issues - Array of issue objects
 * @param {Array} personasRun - Array of persona names that were executed
 * @returns {Object} { score, breakdown, grade }
 */
export function calculateResilienceScore(issues, personasRun) {
  const personas = personasRun || [];
  const uniqueIssues = deduplicateIssues(issues || []);
  const rawIssueCount = uniqueIssues.reduce((sum, issue) => {
    return sum + (issue.details?.occurrence_count || 1);
  }, 0);

  if (uniqueIssues.length === 0) {
    return {
      score: 100,
      grade: 'A+',
      breakdown: {
        baseScore: 100,
        totalPenalty: 0,
        issueCount: 0,
        rawIssueCount,
        duplicateSuppressed: rawIssueCount,
        personasClear: personas.length,
        personasWithIssues: 0,
        severityCounts: { critical: 0, warning: 0, info: 0 }
      }
    };
  }

  let totalPenalty = 0;
  const personaIssues = new Map();
  const categories = new Set();

  for (const issue of uniqueIssues) {
    const category = issue.category || 'unknown';
    const categoryMultiplier = CATEGORY_MULTIPLIERS[category] || 1.0;
    const severityWeight = SEVERITY_WEIGHTS[issue.severity] || 2;
    const occurrenceCount = issue.details?.occurrence_count || 1;
    const affectedPersonas = issue.details?.affected_personas?.length || (issue.persona ? 1 : 0);

    // Repeated occurrences matter, but they should not dominate the score.
    const occurrenceFactor = 1 + (Math.log2(Math.min(occurrenceCount, 16)) * 0.2);
    const personaFactor = 1 + Math.min(Math.max(affectedPersonas - 1, 0) * 0.15, 0.45);

    totalPenalty += severityWeight * categoryMultiplier * occurrenceFactor * personaFactor;
    categories.add(category);

    const issuePersonas = issue.details?.affected_personas?.length
      ? issue.details.affected_personas
      : (issue.persona ? [issue.persona] : []);
    for (const persona of issuePersonas) {
      personaIssues.set(persona, (personaIssues.get(persona) || 0) + 1);
    }
  }

  const uniqueCategories = categories.size;
  const diversityPenalty = Math.min(uniqueCategories * 1.5, 10);
  totalPenalty += diversityPenalty;

  const normalizedPenalty = Math.min(95, totalPenalty);
  const score = Math.max(0, Math.round(100 - normalizedPenalty));
  const severityCounts = getSeverityCounts(uniqueIssues);

  return {
    score,
    grade: getGrade(score),
    breakdown: {
      baseScore: 100,
      totalPenalty: Math.round(totalPenalty * 10) / 10,
      normalizedPenalty: Math.round(normalizedPenalty * 10) / 10,
      issueCount: uniqueIssues.length,
      rawIssueCount,
      duplicateSuppressed: Math.max(0, rawIssueCount - uniqueIssues.length),
      uniqueCategories,
      personasClear: Math.max(0, personas.length - personaIssues.size),
      personasWithIssues: personaIssues.size,
      severityCounts
    }
  };
}

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
