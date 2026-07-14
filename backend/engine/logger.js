/**
 * BreakFlow AI — Failure Logger
 * Attaches to Playwright pages to capture console errors, network failures,
 * duplicate requests, broken redirects, and uncaught exceptions.
 */

import { deduplicateIssues, getIssueFingerprint, getSeverityCounts } from './issueNormalizer.js';

export class FailureLogger {
  constructor(testRunId, targetUrl = '') {
    this.testRunId = testRunId;
    this.targetUrl = targetUrl;
    this.targetHost = '';
    try {
      if (targetUrl) {
        this.targetHost = new URL(targetUrl).hostname;
      }
    } catch (e) {
      console.error('[FailureLogger] Invalid target URL:', targetUrl);
    }
    this.issues = [];
    this.issueKeys = new Map();
    this.networkRequests = new Map();
    this.duplicateTracker = new Map();
  }

  /**
   * Attach listeners to a Playwright page
   */
  attach(page, persona) {
    // Console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const loc = msg.location() || {};
        const url = loc.url || '';
        
        // Filter out third-party console errors (e.g. ads, tag managers)
        if (url && this.targetHost) {
          try {
            const msgHost = new URL(url).hostname;
            const isFirstParty = msgHost === this.targetHost || msgHost.endsWith('.' + this.targetHost);
            if (!isFirstParty) return; // Ignore third-party script logs
          } catch (e) {
            // URL parse error, keep it just in case
          }
        }

        this.addIssue({
          persona,
          severity: 'warning',
          category: 'console_error',
          title: 'Console Error Detected',
          description: msg.text(),
          details: { type: msg.type(), location: loc }
        });
      }
    });

    // Uncaught exceptions (always critical, usually first-party)
    page.on('pageerror', (error) => {
      this.addIssue({
        persona,
        severity: 'critical',
        category: 'uncaught_exception',
        title: 'Uncaught JavaScript Exception',
        description: error.message,
        details: { stack: error.stack }
      });
    });

    // Network failures (4xx/5xx responses)
    page.on('response', (response) => {
      const status = response.status();
      const url = response.url();

      if (status >= 400) {
        // Filter out third-party status failures
        if (this.targetHost) {
          try {
            const respHost = new URL(url).hostname;
            const isFirstParty = respHost === this.targetHost || respHost.endsWith('.' + this.targetHost);
            if (!isFirstParty) return; // Ignore 404s/500s on foreign tracking scripts
          } catch (e) {}
        }

        this.addIssue({
          persona,
          severity: status >= 500 ? 'critical' : 'warning',
          category: 'network_error',
          title: `HTTP ${status} Error`,
          description: `Request to ${url} returned ${status}`,
          details: { url, status, statusText: response.statusText() }
        });
      }
    });

    // Track duplicate requests
    page.on('request', (request) => {
      const url = request.url();
      const method = request.method();

      // Duplicate submissions/race conditions are only actionable for mutating calls.
      // Repeated GETs for documents/assets are normal browser behavior and created noisy false positives.
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return;
      }

      const key = `${method}-${url}`;
      const now = Date.now();

      // Only track duplicates for first-party APIs/calls
      if (this.targetHost) {
        try {
          const reqHost = new URL(url).hostname;
          const isFirstParty = reqHost === this.targetHost || reqHost.endsWith('.' + this.targetHost);
          if (!isFirstParty) return;
        } catch (e) {
          return;
        }
      }
      
      if (!this.duplicateTracker.has(key)) {
        this.duplicateTracker.set(key, []);
      }
      
      const timestamps = this.duplicateTracker.get(key);
      timestamps.push(now);
      
      // Check for rapid duplicates (within 2 seconds)
      const recentDuplicates = timestamps.filter(t => now - t < 2000);
      if (recentDuplicates.length > 3) {
        this.addIssue({
          persona,
          severity: 'critical',
          category: 'duplicate_request',
          title: 'Duplicate Request Detected',
          description: `${method} ${url} was called ${recentDuplicates.length} times in 2 seconds`,
          details: { method, url, count: recentDuplicates.length }
        });
        // Reset to avoid flooding
        this.duplicateTracker.set(key, [now]);
      }
    });

    // Request failures (network level, e.g. DNS fail, aborts)
    page.on('requestfailed', (request) => {
      const url = request.url();
      const failure = request.failure();
      const errorText = failure?.errorText || 'Unknown error';

      // Ignore normal browser aborts, resource cancellations, blocked tracking scripts
      if (
        errorText.includes('ERR_ABORTED') || 
        errorText.includes('ERR_BLOCKED_BY_ORB') ||
        errorText.includes('ERR_BLOCKED_BY_CLIENT') ||
        errorText.includes('ERR_CONNECTION_REFUSED')
      ) {
        return;
      }

      // Filter to first-party requests
      if (this.targetHost) {
        try {
          const reqHost = new URL(url).hostname;
          const isFirstParty = reqHost === this.targetHost || reqHost.endsWith('.' + this.targetHost);
          if (!isFirstParty) return;
        } catch (e) {
          return;
        }
      }

      this.addIssue({
        persona,
        severity: 'critical',
        category: 'request_failed',
        title: 'Network Request Failed',
        description: `Request to ${url} failed: ${errorText}`,
        details: { url, method: request.method(), error: errorText }
      });
    });
  }

  addIssue(issue) {
    const normalizedIssue = {
      ...issue,
      test_run_id: this.testRunId,
      timestamp: new Date().toISOString()
    };

    const key = getIssueFingerprint(normalizedIssue);
    const existingIndex = this.issueKeys.get(key);

    if (existingIndex !== undefined) {
      const merged = deduplicateIssues([this.issues[existingIndex], normalizedIssue])[0];
      this.issues[existingIndex] = merged;
      return;
    }

    this.issueKeys.set(key, this.issues.length);
    this.issues.push(normalizedIssue);
  }

  getIssues() {
    return deduplicateIssues(this.issues);
  }

  getIssuesByCategory() {
    const categories = {};
    for (const issue of this.issues) {
      if (!categories[issue.category]) {
        categories[issue.category] = [];
      }
      categories[issue.category].push(issue);
    }
    return categories;
  }

  getSeverityCounts() {
    return getSeverityCounts(this.getIssues());
  }
}
