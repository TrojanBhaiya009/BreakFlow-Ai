/**
 * BreakFlow - Multi-Tab User Persona
 *
 * Opens the same app in two tabs and looks for stale state or duplicate-action gaps.
 */

export const metadata = {
  name: 'Power Tabber',
  icon: 'tabs',
  description: 'Runs the same workflow in parallel browser tabs',
  detects: ['duplicate actions', 'storage drift', 'stale multi-tab state']
};

export async function execute(page, url, logger) {
  const events = [];
  const emit = (msg) => events.push({ message: msg, timestamp: new Date().toISOString() });
  let secondPage;

  try {
    emit('Opening target in two tabs...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    secondPage = await page.context().newPage();
    logger.attach(secondPage, 'Power Tabber');
    await secondPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1200);

    emit('Checking shared storage behavior...');
    const storageResult = await page.evaluate(() => {
      localStorage.setItem('breakflow_tab_probe', 'tab-a');
      return {
        localStorageKeys: Object.keys(localStorage).length,
        sessionStorageKeys: Object.keys(sessionStorage).length
      };
    });
    const sharedValue = await secondPage.evaluate(() => localStorage.getItem('breakflow_tab_probe'));
    await page.evaluate(() => localStorage.removeItem('breakflow_tab_probe')).catch(() => {});

    if (sharedValue !== 'tab-a') {
      logger.addIssue({
        persona: 'Power Tabber',
        severity: 'info',
        category: 'state_management',
        title: 'Unexpected Local Storage Isolation',
        description: 'A localStorage value written in one tab was not visible in another tab in the same browser context.',
        details: { sharedValue, storageResult }
      });
    }

    emit('Filling matching fields in both tabs...');
    await fillFirstEditableField(page, 'tab-a@example.com');
    await fillFirstEditableField(secondPage, 'tab-b@example.com');

    emit('Attempting concurrent submit/action...');
    const guarded = await submitInParallel(page, secondPage);
    if (guarded === false) {
      logger.addIssue({
        persona: 'Power Tabber',
        severity: 'warning',
        category: 'duplicate_request',
        title: 'Concurrent Action Was Not Guarded',
        description: 'The same visible action could be triggered from two tabs without either control entering a disabled or busy state.',
        details: { action: 'parallel-submit' }
      });
    }

    emit('Power Tabber persona completed');
  } catch (error) {
    emit(`Persona error: ${error.message}`);
    logger.addIssue({
      persona: 'Power Tabber',
      severity: 'warning',
      category: 'state_management',
      title: 'Persona Execution Error',
      description: error.message,
      details: { stack: error.stack }
    });
  } finally {
    if (secondPage) await secondPage.close().catch(() => {});
  }

  return events;
}

async function fillFirstEditableField(page, value) {
  const fields = await page.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea');
  for (const field of fields) {
    const visible = await field.isVisible().catch(() => false);
    const disabled = await field.isDisabled().catch(() => true);
    if (!visible || disabled) continue;

    const type = (await field.getAttribute('type') || 'text').toLowerCase();
    const fillValue = type === 'email' ? value : `BreakFlow ${value}`;
    await field.fill(fillValue).catch(() => {});
    return true;
  }
  return false;
}

async function submitInParallel(pageA, pageB) {
  const selector = 'button[type="submit"], input[type="submit"], form button:not([type]), button:not([disabled]), [role="button"]';
  const buttonA = await pageA.$(selector);
  const buttonB = await pageB.$(selector);
  if (!buttonA || !buttonB) return null;

  const visibleA = await buttonA.isVisible().catch(() => false);
  const visibleB = await buttonB.isVisible().catch(() => false);
  if (!visibleA || !visibleB) return null;

  await Promise.all([
    buttonA.click({ timeout: 3000 }).catch(() => {}),
    buttonB.click({ timeout: 3000 }).catch(() => {})
  ]);
  await pageA.waitForTimeout(1000);

  const states = await Promise.all([
    controlIsGuarded(buttonA),
    controlIsGuarded(buttonB)
  ]);

  return states.some(Boolean);
}

async function controlIsGuarded(control) {
  return control.evaluate((el) => {
    const ariaBusy = el.getAttribute('aria-busy') === 'true';
    const ariaDisabled = el.getAttribute('aria-disabled') === 'true';
    return Boolean(el.disabled || ariaBusy || ariaDisabled || el.className?.toString().includes('loading'));
  }).catch(() => false);
}
