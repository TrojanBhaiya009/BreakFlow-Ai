/**
 * BreakFlow AI — Rage Clicker Persona
 * 
 * Simulates a user who clicks buttons and links repeatedly and rapidly.
 * Detects: duplicate submissions, UI freezes, double-processing issues.
 */

export const metadata = {
  name: 'Rage Clicker',
  icon: '🔴',
  description: 'Clicks buttons and interactive elements rapidly and repeatedly',
  detects: ['duplicate submissions', 'UI freezes', 'double-processing', 'race conditions']
};

export async function execute(page, url, logger) {
  const events = [];

  const emit = (msg) => {
    events.push({ message: msg, timestamp: new Date().toISOString() });
  };

  try {
    emit('Navigating to target URL...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Find all clickable elements
    const clickableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input[type="submit"]',
      'input[type="button"]',
      '[role="button"]',
      '[onclick]',
      '.btn',
      '.button'
    ];

    emit('Scanning for clickable elements...');
    
    for (const selector of clickableSelectors) {
      const elements = await page.$$(selector);
      
      if (elements.length === 0) continue;

      emit(`Found ${elements.length} elements matching "${selector}"`);

      for (const element of elements.slice(0, 5)) { // Limit to 5 per selector type
        const isVisible = await element.isVisible().catch(() => false);
        if (!isVisible) continue;

        const elementText = await element.textContent().catch(() => 'unknown');
        const tagName = await element.evaluate(el => el.tagName).catch(() => 'unknown');

        emit(`Rage clicking: <${tagName}> "${elementText.trim().substring(0, 50)}"`);

        // RAGE CLICK: Click 10-15 times rapidly
        const clickCount = 10 + Math.floor(Math.random() * 6);
        
        for (let i = 0; i < clickCount; i++) {
          try {
            await element.click({ force: true, timeout: 1000 }).catch(() => {});
            // Very short delay between clicks (50-150ms) to simulate rage clicking
            await page.waitForTimeout(50 + Math.random() * 100);
          } catch (e) {
            // Element may have been removed from DOM
            break;
          }
        }

        // Check if page is still responsive after rage clicking
        emit('Checking page responsiveness...');
        const startTime = Date.now();
        try {
          await page.evaluate(() => document.title);
          const responseTime = Date.now() - startTime;
          
          if (responseTime > 3000) {
            logger.addIssue({
              persona: 'Rage Clicker',
              severity: 'critical',
              category: 'ui_freeze',
              title: 'UI Freeze After Rapid Clicking',
              description: `Page became unresponsive for ${responseTime}ms after rapid clicks on "${elementText.trim().substring(0, 50)}"`,
              details: { elementText: elementText.trim(), responseTime, clickCount }
            });
          }
        } catch (e) {
          logger.addIssue({
            persona: 'Rage Clicker',
            severity: 'critical',
            category: 'ui_freeze',
            title: 'Page Crashed After Rapid Clicking',
            description: `Page became completely unresponsive after ${clickCount} rapid clicks on "${elementText.trim().substring(0, 50)}"`,
            details: { elementText: elementText.trim(), clickCount, error: e.message }
          });
        }

        // Wait for any modals/overlays to settle
        await page.waitForTimeout(1000);

        // Try to dismiss any dialogs that appeared
        try {
          page.on('dialog', async (dialog) => {
            await dialog.dismiss();
          });
        } catch (e) {}

        // Navigate back if we left the page
        try {
          const currentUrl = page.url();
          if (currentUrl !== url && !currentUrl.startsWith(url)) {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(1000);
          }
        } catch (e) {}
      }
    }

    // Test double-click on form submit buttons specifically
    emit('Testing double-submit on form buttons...');
    const submitButtons = await page.$$('button[type="submit"], input[type="submit"], form button');
    
    for (const btn of submitButtons.slice(0, 3)) {
      const isVisible = await btn.isVisible().catch(() => false);
      if (!isVisible) continue;

      const btnText = await btn.textContent().catch(() => 'submit');
      emit(`Double-submitting: "${btnText.trim()}"`);

      // Double click
      try {
        await btn.dblclick({ force: true, timeout: 2000 });
        await page.waitForTimeout(500);
      } catch (e) {}
    }

    emit('Rage Clicker persona completed');

  } catch (error) {
    emit(`Persona error: ${error.message}`);
    logger.addIssue({
      persona: 'Rage Clicker',
      severity: 'warning',
      category: 'navigation_error',
      title: 'Persona Execution Error',
      description: error.message,
      details: { stack: error.stack }
    });
  }

  return events;
}
