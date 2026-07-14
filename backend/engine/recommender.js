/**
 * BreakFlow AI — Recommendation Engine
 * Combines rule-based heuristic recommendations with Codex-powered analysis.
 * Primary (and only) LLM: Codex via CODEX_API_KEY
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { deduplicateIssues } from './issueNormalizer.js';
dotenv.config();

// ============================================
// RULE-BASED RECOMMENDATIONS
// ============================================

const RULE_BASED_RECOMMENDATIONS = {
  duplicate_request: {
    title: 'Prevent Duplicate Submissions',
    description: 'Your application allows duplicate requests when buttons are clicked rapidly. This can cause duplicate orders, payments, or data entries.',
    priority: 'high',
    code_snippet: `// Disable button after first click
const button = document.querySelector('#submit-btn');
button.addEventListener('click', async () => {
  button.disabled = true;
  button.textContent = 'Processing...';
  try {
    await submitForm();
  } finally {
    button.disabled = false;
    button.textContent = 'Submit';
  }
});

// Or use a debounce utility
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}`
  },
  uncaught_exception: {
    title: 'Add Error Boundaries & Global Error Handling',
    description: 'Uncaught JavaScript exceptions were detected. These crash the application and leave users on broken screens.',
    priority: 'critical',
    code_snippet: `// React Error Boundary
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    logErrorToService(error, info);
  }
  render() {
    if (this.state.hasError) {
      return <FallbackUI />;
    }
    return this.props.children;
  }
}

// Global handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Show user-friendly error notification
});`
  },
  network_error: {
    title: 'Implement Retry Logic with Exponential Backoff',
    description: 'Network requests are failing without graceful handling. Implement retry logic to handle transient failures.',
    priority: 'high',
    code_snippet: `async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && i < maxRetries) {
        await new Promise(r => 
          setTimeout(r, Math.pow(2, i) * 1000)
        );
        continue;
      }
      return response;
    } catch (error) {
      if (i === maxRetries) throw error;
      await new Promise(r => 
        setTimeout(r, Math.pow(2, i) * 1000)
      );
    }
  }
}`
  },
  request_failed: {
    title: 'Add Network Error Recovery',
    description: 'Requests are failing at the network level. Provide fallback UI and offline support.',
    priority: 'high',
    code_snippet: `// Show offline banner
window.addEventListener('offline', () => {
  showNotification('You are offline. Changes will sync when reconnected.');
});

window.addEventListener('online', () => {
  syncPendingChanges();
  showNotification('Back online! Syncing...');
});`
  },
  console_error: {
    title: 'Fix Console Errors',
    description: 'Console errors indicate potential bugs that may affect user experience. Review and fix the logged errors.',
    priority: 'medium',
    code_snippet: `// Add structured error logging
function logError(context, error) {
  console.error(\`[\${context}]\`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  // Send to error tracking service (Sentry, etc.)
}`
  },
  ui_freeze: {
    title: 'Prevent UI Freezes',
    description: 'The UI became unresponsive during testing. Move heavy operations to web workers or use requestIdleCallback.',
    priority: 'critical',
    code_snippet: `// Use Web Worker for heavy computation
const worker = new Worker('heavy-task.js');
worker.postMessage(data);
worker.onmessage = (e) => updateUI(e.data);

// Or use requestIdleCallback
requestIdleCallback((deadline) => {
  while (deadline.timeRemaining() > 0 && tasks.length) {
    processTask(tasks.shift());
  }
});`
  },
  form_resubmission: {
    title: 'Implement POST/Redirect/GET Pattern',
    description: 'Form resubmission on page refresh was detected. Use the PRG pattern to prevent duplicate submissions.',
    priority: 'high',
    code_snippet: `// Server-side: Redirect after POST
app.post('/submit', async (req, res) => {
  await processForm(req.body);
  // Redirect to prevent resubmission on refresh
  res.redirect(303, '/success');
});

// Client-side: Use idempotency keys
const idempotencyKey = crypto.randomUUID();
fetch('/api/submit', {
  method: 'POST',
  headers: { 'Idempotency-Key': idempotencyKey },
  body: JSON.stringify(data)
});`
  },
  stale_session: {
    title: 'Handle Session Expiry Gracefully',
    description: 'Sessions become stale after delays. Implement session refresh and graceful timeout handling.',
    priority: 'high',
    code_snippet: `// Auto-refresh session before expiry
setInterval(async () => {
  const res = await fetch('/api/session/refresh');
  if (res.status === 401) {
    showSessionExpiredModal();
  }
}, 5 * 60 * 1000); // Every 5 minutes`
  },
  timeout: {
    title: 'Add Loading States and Timeout Handling',
    description: 'Operations are timing out without feedback. Add loading indicators and timeout limits.',
    priority: 'medium',
    code_snippet: `const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000);

try {
  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeoutId);
} catch (err) {
  if (err.name === 'AbortError') {
    showNotification('Request timed out. Please try again.');
  }
}`
  },
  navigation_error: {
    title: 'Add Route Guards and Navigation Handling',
    description: 'Navigation produced errors or dead ends. Add route guards and 404 handling.',
    priority: 'medium',
    code_snippet: `// Next.js: Custom 404 page
// app/not-found.js
export default function NotFound() {
  return (
    <div>
      <h2>Page Not Found</h2>
      <Link href="/">Return Home</Link>
    </div>
  );
}

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = '';
  }
});`
  },
  input_validation: {
    title: 'Strengthen Input Validation',
    description: 'The application accepted invalid or contradictory inputs. Add client and server-side validation.',
    priority: 'medium',
    code_snippet: `// Use Zod for schema validation
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  age: z.number().min(0).max(150),
  password: z.string().min(8)
});

// Validate on both client and server
try {
  schema.parse(formData);
} catch (err) {
  showValidationErrors(err.errors);
}`
  }
};

/**
 * Generate rule-based recommendations from issues
 */
export function generateRuleBasedRecommendations(issues) {
  const uniqueIssues = deduplicateIssues(issues || []);
  const categories = new Set(uniqueIssues.map(i => i.category));
  const recommendations = [];

  for (const category of categories) {
    const rec = RULE_BASED_RECOMMENDATIONS[category];
    if (rec) {
      const categoryIssues = uniqueIssues.filter(i => i.category === category);
      const affectedCount = categoryIssues.reduce((sum, issue) => {
        return sum + (issue.details?.occurrence_count || 1);
      }, 0);
      recommendations.push({
        issue_category: category,
        title: rec.title,
        description: rec.description,
        code_snippet: rec.code_snippet,
        priority: rec.priority,
        source: 'rule-based',
        affected_count: affectedCount
      });
    }
  }

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

  return recommendations;
}

/**
 * Generate Codex-powered recommendations
 * Uses the CODEX_API_KEY — the only LLM provider
 */
export async function generateCodexRecommendations(issues, targetUrl) {
  const codexKey = process.env.CODEX_API_KEY;

  if (!codexKey || codexKey.trim() === '' || codexKey === 'your_codex_api_key_here') {
    console.log('[Recommender] Codex API key not configured — using rule-based recommendations only');
    return [];
  }

  try {
    const uniqueIssues = deduplicateIssues(issues || []);
    const client = new OpenAI({
      apiKey: codexKey,
    });

    // Deduplicate and compress issues
    const compressedMap = new Map();
    for (const issue of uniqueIssues) {
      const key = `${issue.category}:${issue.title}`;
      if (!compressedMap.has(key)) {
        compressedMap.set(key, {
          category: issue.category,
          title: issue.title,
          severity: issue.severity,
          persona: issue.persona,
          description: issue.description,
          count: 0,
          details: issue.details ? JSON.stringify(issue.details).slice(0, 300) : ''
        });
      }
      compressedMap.get(key).count += issue.details?.occurrence_count || 1;
    }

    const compressedIssues = Array.from(compressedMap.values());
    console.log(`[Recommender] Compressed ${issues.length} raw issues into ${compressedIssues.length} unique for Codex.`);

    const formattedIssues = compressedIssues.slice(0, 80).map((issue, idx) => {
      return `${idx + 1}. [${issue.severity.toUpperCase()}] Category: ${issue.category} (Occurrences: ${issue.count})
Title: ${issue.title}
Persona: ${issue.persona}
Description: ${issue.description}
${issue.details ? `Sample Details: ${issue.details}` : ''}`;
    }).join('\n\n');

    const systemPrompt = `You are BreakFlow AI, an expert application resilience and security advisor.
You analyze chaos testing results and provide actionable fix recommendations.
You MUST respond with ONLY a valid JSON array of objects. No markdown, no explanation, no code fences.
Do not repeat the same fix twice. Merge similar issues into one recommendation.
Each object must have these exact keys: title, description, code_snippet, priority
- title: concise title of the issue and fix action
- description: detailed explanation of why it occurred and how to fix it
- code_snippet: concrete JS/TS/React code fix
- priority: one of "critical", "high", "medium", "low"
Provide up to 5 recommendations, sorted by severity. Focus on the most impactful fixes.`;

    const userPrompt = `Analyze the following chaos testing results from auditing "${targetUrl}".
Find deep patterns and correlations between console exceptions, duplicate requests, or network failures.
Provide up to 5 highly specific, actionable fix recommendations.

Issues found:
${formattedIssues}

Respond with ONLY a JSON array:`;

    const completion = await client.chat.completions.create({
      model: 'codex-mini-latest',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.6,
      max_tokens: 8192,
      stream: false,
    });

    const content = completion.choices[0]?.message?.content || '[]';
    
    // Extract JSON array from content (handle potential markdown wrapping)
    let jsonStr = content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const llmRecs = JSON.parse(jsonStr);
    console.log(`[Recommender] Generated ${llmRecs.length} recommendations from Codex`);

    return llmRecs.map(rec => ({
      issue_category: 'codex_analysis',
      title: rec.title,
      description: rec.description,
      code_snippet: rec.code_snippet || null,
      priority: rec.priority || 'medium',
      source: 'codex'
    }));

  } catch (error) {
    console.error('[Recommender] Codex recommendation failed:', error.message);
    return [];
  }
}

/**
 * Generate a fix for a specific issue using Codex
 */
export async function generateCodexFix(issue, targetUrl) {
  const codexKey = process.env.CODEX_API_KEY;

  if (!codexKey || codexKey.trim() === '' || codexKey === 'your_codex_api_key_here') {
    return null;
  }

  try {
    const client = new OpenAI({
      apiKey: codexKey,
    });

    const completion = await client.chat.completions.create({
      model: 'codex-mini-latest',
      messages: [
        {
          role: 'system',
          content: `You are a senior security engineer. Generate a precise, copy-pasteable code fix for the given issue. Return ONLY the code, no explanation, no markdown fences.`
        },
        {
          role: 'user',
          content: `Fix this issue found during chaos testing of "${targetUrl}":

Title: ${issue.title}
Category: ${issue.category}
Severity: ${issue.severity}
Description: ${issue.description}

Generate a concrete code fix:`
        }
      ],
      temperature: 0.4,
      max_tokens: 2000,
      stream: false,
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('[Recommender] Codex fix generation failed:', error.message);
    return null;
  }
}

/**
 * Generate all recommendations (rule-based + Codex)
 */
export async function generateAllRecommendations(issues, targetUrl) {
  const ruleBased = generateRuleBasedRecommendations(issues);
  const codexBased = await generateCodexRecommendations(issues, targetUrl);

  const seen = new Set();
  return [...ruleBased, ...codexBased].filter(rec => {
    const key = `${rec.issue_category}:${String(rec.title || '').toLowerCase().replace(/\s+/g, ' ').trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
