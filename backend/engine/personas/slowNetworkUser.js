/**
 * BreakFlow AI — Slow Network User Persona
 * 
 * Simulates a user on a slow/unreliable network.
 * Uses Playwright's network throttling + artificial delays.
 */

export const metadata = {
  name: 'Bad Wi-Fi User',
  icon: '🟠',
  description: 'Simulates slow network, delayed responses, timeouts, and retries',
  detects: ['timeout issues', 'missing loading states', 'retry bugs', 'stale sessions']
};

export async function execute(page, url, logger) {
  const events = [];
  const emit = (msg) => {
    events.push({ message: msg, timestamp: new Date().toISOString() });
  };

  try {
    // Get CDP session for network throttling
    const context = page.context();
    const cdp = await context.newCDPSession(page);

    // Phase 1: Test with slow 3G
    emit('Phase 1: Simulating Slow 3G network...');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (500 * 1024) / 8, // 500 Kbps
      uploadThroughput: (500 * 1024) / 8,
      latency: 2000 // 2 second latency
    });

    const slow3GStart = Date.now();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const loadTime = Date.now() - slow3GStart;
      emit(`Page loaded in ${loadTime}ms on slow 3G`);

      if (loadTime > 15000) {
        logger.addIssue({
          persona: 'Bad Wi-Fi User',
          severity: 'warning',
          category: 'timeout',
          title: 'Extremely Slow Page Load',
          description: `Page took ${(loadTime / 1000).toFixed(1)}s to load on slow 3G. Users will likely abandon.`,
          details: { loadTimeMs: loadTime, networkProfile: 'slow-3g' }
        });
      }

      // Check for loading indicators
      await page.waitForTimeout(2000);
      const hasLoadingIndicator = await page.evaluate(() => {
        const selectors = ['.loading', '.spinner', '[class*="loading"]', '[class*="spinner"]', '.skeleton', '[class*="skeleton"]'];
        return selectors.some(sel => document.querySelector(sel) !== null);
      }).catch(() => false);

      if (!hasLoadingIndicator && loadTime > 5000) {
        logger.addIssue({
          persona: 'Bad Wi-Fi User',
          severity: 'info',
          category: 'timeout',
          title: 'No Loading Indicator on Slow Network',
          description: 'No loading spinner or skeleton was detected while the page loaded slowly. Users have no feedback.',
          details: { loadTimeMs: loadTime }
        });
      }

    } catch (e) {
      logger.addIssue({
        persona: 'Bad Wi-Fi User',
        severity: 'critical',
        category: 'timeout',
        title: 'Page Failed to Load on Slow Network',
        description: `Page failed to load on slow 3G after 60s timeout: ${e.message}`,
        details: { error: e.message }
      });
    }

    // Phase 2: Test interactions with latency
    emit('Phase 2: Testing interactions with high latency...');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (1000 * 1024) / 8,
      uploadThroughput: (500 * 1024) / 8,
      latency: 3000
    });

    // Try clicking buttons with slow network
    const buttons = await page.$$('button:not([disabled]), a[href], input[type="submit"]');
    for (const btn of buttons.slice(0, 5)) {
      const isVisible = await btn.isVisible().catch(() => false);
      if (!isVisible) continue;

      const btnText = await btn.textContent().catch(() => 'unknown');
      emit(`Clicking "${btnText.trim().substring(0, 40)}" with 3s latency...`);

      const clickStart = Date.now();
      try {
        await btn.click({ timeout: 5000 });
        await page.waitForTimeout(4000); // Wait longer due to latency

        // Check if user gets any feedback
        const hasVisualFeedback = await page.evaluate(() => {
          const indicators = document.querySelectorAll('[class*="loading"], [class*="spinner"], [disabled], [aria-busy="true"]');
          return indicators.length > 0;
        }).catch(() => false);

        if (!hasVisualFeedback) {
          const elapsed = Date.now() - clickStart;
          if (elapsed > 3000) {
            logger.addIssue({
              persona: 'Bad Wi-Fi User',
              severity: 'info',
              category: 'timeout',
              title: 'No Feedback During Slow Action',
              description: `No visual feedback after clicking "${btnText.trim().substring(0, 40)}" — user may click again.`,
              details: { buttonText: btnText.trim(), waitTimeMs: elapsed }
            });
          }
        }
      } catch (e) {
        emit(`Click failed: ${e.message}`);
      }

      // Navigate back for next button
      try {
        const currentUrl = page.url();
        if (!currentUrl.startsWith(url.replace(/\/$/, ''))) {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForTimeout(1500);
        }
      } catch (e) {}
    }

    // Phase 3: Test with intermittent connectivity
    emit('Phase 3: Testing intermittent connectivity...');
    
    // Go offline
    emit('Going offline...');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: true,
      downloadThroughput: 0,
      uploadThroughput: 0,
      latency: 0
    });

    await page.waitForTimeout(3000);

    // Try to interact while offline
    const offlineError = await page.evaluate(() => {
      try {
        // Check if app shows offline state
        const body = document.body.innerText.toLowerCase();
        if (body.includes('offline') || body.includes('no connection') || body.includes('no internet')) {
          return 'has_offline_handling';
        }
        return 'no_offline_handling';
      } catch (e) {
        return e.message;
      }
    }).catch(() => 'page_unresponsive');

    if (offlineError === 'no_offline_handling') {
      logger.addIssue({
        persona: 'Bad Wi-Fi User',
        severity: 'info',
        category: 'network_error',
        title: 'No Offline State Handling',
        description: 'Application does not display an offline state or notification when network is unavailable.',
        details: {}
      });
    }

    // Come back online
    emit('Coming back online...');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });

    await page.waitForTimeout(2000);

    // Check if app recovers
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      emit('App recovered after going back online');
    } catch (e) {
      logger.addIssue({
        persona: 'Bad Wi-Fi User',
        severity: 'critical',
        category: 'network_error',
        title: 'Failed to Recover After Reconnection',
        description: 'Application failed to recover after network came back online.',
        details: { error: e.message }
      });
    }

    // Phase 4: Test session after delay
    emit('Phase 4: Simulating long delay (session staleness)...');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0
    });

    // Wait to simulate user returning after delay
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);

    // Try interacting after delay
    const postDelayButtons = await page.$$('button:not([disabled])');
    if (postDelayButtons.length > 0) {
      const btn = postDelayButtons[0];
      const isVisible = await btn.isVisible().catch(() => false);
      if (isVisible) {
        try {
          await btn.click({ timeout: 5000 });
          await page.waitForTimeout(2000);
        } catch (e) {
          logger.addIssue({
            persona: 'Bad Wi-Fi User',
            severity: 'warning',
            category: 'stale_session',
            title: 'Interaction Failed After Delay',
            description: 'Button click failed after simulating a period of user inactivity.',
            details: { error: e.message }
          });
        }
      }
    }

    // Clean up CDP session
    await cdp.detach().catch(() => {});

    emit('Bad Wi-Fi User persona completed');

  } catch (error) {
    emit(`Persona error: ${error.message}`);
    logger.addIssue({
      persona: 'Bad Wi-Fi User',
      severity: 'warning',
      category: 'navigation_error',
      title: 'Persona Execution Error',
      description: error.message,
      details: { stack: error.stack }
    });
  }

  return events;
}
