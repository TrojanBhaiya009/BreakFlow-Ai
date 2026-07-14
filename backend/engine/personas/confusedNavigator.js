/**
 * BreakFlow AI — Confused Navigator Persona
 * 
 * Simulates a user who navigates randomly — back, forward, refresh, 
 * random link clicking, revisiting pages.
 */

export const metadata = {
  name: 'Confused Navigator',
  icon: '🟣',
  description: 'Random back/forward navigation, refresh, clicks random links',
  detects: ['broken redirects', 'dead-end pages', 'navigation errors', 'state corruption']
};

export async function execute(page, url, logger) {
  const events = [];
  const emit = (msg) => {
    events.push({ message: msg, timestamp: new Date().toISOString() });
  };

  const visitedUrls = new Set();
  const deadEnds = [];

  try {
    emit('Navigating to target URL...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    visitedUrls.add(page.url());

    const maxActions = 20;
    
    for (let action = 0; action < maxActions; action++) {
      const actionType = getRandomAction();
      emit(`Action ${action + 1}/${maxActions}: ${actionType}`);

      try {
        switch (actionType) {
          case 'click_random_link': {
            const links = await page.$$('a[href]:not([href="#"]):not([href="javascript:void(0)"])');
            if (links.length > 0) {
              const link = links[Math.floor(Math.random() * links.length)];
              const href = await link.getAttribute('href').catch(() => '');
              const isVisible = await link.isVisible().catch(() => false);
              
              if (isVisible && href) {
                emit(`Clicking link: ${href.substring(0, 80)}`);
                try {
                  await link.click({ timeout: 5000 });
                  await page.waitForTimeout(1500);
                  visitedUrls.add(page.url());
                } catch (e) {
                  emit(`Click failed: ${e.message}`);
                }
              }
            } else {
              emit('No links found — potential dead end');
              deadEnds.push(page.url());
            }
            break;
          }

          case 'go_back': {
            emit('Going back...');
            try {
              await page.goBack({ timeout: 5000 });
              await page.waitForTimeout(1000);
              
              // Check if back actually worked
              if (page.url() === 'about:blank') {
                logger.addIssue({
                  persona: 'Confused Navigator',
                  severity: 'warning',
                  category: 'navigation_error',
                  title: 'Back Navigation Led to Blank Page',
                  description: 'Going back resulted in an about:blank page',
                  details: {}
                });
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
              }
            } catch (e) {
              emit(`Back navigation failed: ${e.message}`);
            }
            break;
          }

          case 'go_forward': {
            emit('Going forward...');
            try {
              await page.goForward({ timeout: 5000 });
              await page.waitForTimeout(1000);
            } catch (e) {
              emit(`Forward navigation failed: ${e.message}`);
            }
            break;
          }

          case 'refresh': {
            emit('Refreshing page...');
            const beforeRefreshUrl = page.url();
            try {
              await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
              await page.waitForTimeout(1500);
              
              const afterRefreshUrl = page.url();
              if (afterRefreshUrl !== beforeRefreshUrl) {
                logger.addIssue({
                  persona: 'Confused Navigator',
                  severity: 'warning',
                  category: 'broken_redirect',
                  title: 'URL Changed After Refresh',
                  description: `Page URL changed from ${beforeRefreshUrl} to ${afterRefreshUrl} after refresh`,
                  details: { before: beforeRefreshUrl, after: afterRefreshUrl }
                });
              }
            } catch (e) {
              emit(`Refresh failed: ${e.message}`);
            }
            break;
          }

          case 'rapid_back_forward': {
            emit('Rapid back-forward cycle...');
            for (let i = 0; i < 5; i++) {
              await page.goBack({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(200);
              await page.goForward({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(200);
            }
            
            // Check page state after chaos
            const startCheck = Date.now();
            try {
              await page.evaluate(() => document.title);
              const elapsed = Date.now() - startCheck;
              if (elapsed > 3000) {
                logger.addIssue({
                  persona: 'Confused Navigator',
                  severity: 'critical',
                  category: 'ui_freeze',
                  title: 'UI Freeze After Rapid Navigation',
                  description: `Page took ${elapsed}ms to respond after rapid back/forward navigation`,
                  details: { responseTime: elapsed }
                });
              }
            } catch (e) {
              logger.addIssue({
                persona: 'Confused Navigator',
                severity: 'critical',
                category: 'ui_freeze',
                title: 'Page Crashed During Rapid Navigation',
                description: 'Page became unresponsive during rapid back/forward navigation',
                details: { error: e.message }
              });
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            }
            break;
          }

          case 'revisit_page': {
            if (visitedUrls.size > 1) {
              const urls = [...visitedUrls];
              const revisitUrl = urls[Math.floor(Math.random() * urls.length)];
              emit(`Revisiting: ${revisitUrl.substring(0, 80)}`);
              try {
                await page.goto(revisitUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                await page.waitForTimeout(1000);
              } catch (e) {
                emit(`Revisit failed: ${e.message}`);
              }
            }
            break;
          }
        }

        // Check for 404 or error pages
        const title = await page.title().catch(() => '');
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '').catch(() => '');
        
        if (title.toLowerCase().includes('404') || 
            title.toLowerCase().includes('not found') ||
            bodyText.toLowerCase().includes('page not found') ||
            bodyText.toLowerCase().includes('404')) {
          logger.addIssue({
            persona: 'Confused Navigator',
            severity: 'warning',
            category: 'navigation_error',
            title: '404 Page Reached',
            description: `Navigation led to a 404 page: ${page.url()}`,
            details: { url: page.url(), title }
          });
        }

      } catch (actionError) {
        emit(`Action error: ${actionError.message}`);
      }
    }

    // Report dead ends
    if (deadEnds.length > 0) {
      const uniqueDeadEnds = [...new Set(deadEnds)];
      for (const deadEnd of uniqueDeadEnds) {
        logger.addIssue({
          persona: 'Confused Navigator',
          severity: 'info',
          category: 'navigation_error',
          title: 'Dead-End Page Detected',
          description: `Page at ${deadEnd} has no navigable links — user may get stuck`,
          details: { url: deadEnd }
        });
      }
    }

    emit(`Confused Navigator completed. Visited ${visitedUrls.size} unique pages.`);

  } catch (error) {
    emit(`Persona error: ${error.message}`);
    logger.addIssue({
      persona: 'Confused Navigator',
      severity: 'warning',
      category: 'navigation_error',
      title: 'Persona Execution Error',
      description: error.message,
      details: { stack: error.stack }
    });
  }

  return events;
}

function getRandomAction() {
  const actions = [
    'click_random_link',
    'click_random_link',
    'click_random_link',
    'go_back',
    'go_back',
    'go_forward',
    'refresh',
    'rapid_back_forward',
    'revisit_page'
  ];
  return actions[Math.floor(Math.random() * actions.length)];
}
