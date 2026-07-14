/**
 * BreakFlow - Permission Denier Persona
 *
 * Clicks permission-related controls and checks that blocked flows provide feedback.
 */

export const metadata = {
  name: 'Privacy-First User',
  icon: 'permission',
  description: 'Denies browser capabilities such as location, camera, and notifications',
  detects: ['missing permission fallbacks', 'blocked workflow loops', 'unclear recovery states']
};

const PERMISSION_RE = /camera|microphone|location|geo|notify|notification|clipboard|paste|share|upload/i;
const FEEDBACK_RE = /permission|blocked|denied|allow|enable|browser settings|unavailable|manual|paste|upload/i;

export async function execute(page, url, logger) {
  const events = [];
  const emit = (msg) => events.push({ message: msg, timestamp: new Date().toISOString() });

  try {
    emit('Clearing browser permissions...');
    await page.context().clearPermissions();
    page.on('dialog', async (dialog) => dialog.dismiss().catch(() => {}));

    emit('Navigating to target URL...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    const permissionSnapshot = await page.evaluate(async () => {
      const names = ['geolocation', 'camera', 'microphone', 'notifications', 'clipboard-read'];
      const results = {};
      if (!navigator.permissions?.query) return results;

      for (const name of names) {
        try {
          results[name] = (await navigator.permissions.query({ name })).state;
        } catch {
          results[name] = 'unsupported';
        }
      }
      return results;
    }).catch(() => ({}));

    emit(`Permission states: ${Object.entries(permissionSnapshot).map(([k, v]) => `${k}:${v}`).join(', ') || 'unavailable'}`);

    const triggers = await page.$$('button, a[href], [role="button"], input[type="file"], label');
    let tested = 0;

    for (const trigger of triggers.slice(0, 30)) {
      const visible = await trigger.isVisible().catch(() => false);
      if (!visible) continue;

      const label = await trigger.evaluate((el) => (
        el.textContent ||
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.getAttribute('name') ||
        ''
      ).trim()).catch(() => '');

      if (!PERMISSION_RE.test(label)) continue;
      tested++;
      emit(`Testing permission trigger: "${label.slice(0, 50)}"`);

      const before = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      await trigger.click({ timeout: 3000, force: true }).catch(() => {});
      await page.waitForTimeout(1200);
      const after = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      const changedText = after.replace(before, '');

      if (!FEEDBACK_RE.test(after) && changedText.trim().length < 8) {
        logger.addIssue({
          persona: 'Privacy-First User',
          severity: 'info',
          category: 'permission_handling',
          title: 'Permission Flow Has No Visible Fallback',
          description: `Clicking "${label.slice(0, 50)}" did not show visible recovery guidance when browser permissions were unavailable.`,
          details: { label, permissionSnapshot }
        });
      }
    }

    if (tested === 0) {
      emit('No permission-related controls found');
    }

    emit('Privacy-First User persona completed');
  } catch (error) {
    emit(`Persona error: ${error.message}`);
    logger.addIssue({
      persona: 'Privacy-First User',
      severity: 'warning',
      category: 'permission_handling',
      title: 'Persona Execution Error',
      description: error.message,
      details: { stack: error.stack }
    });
  }

  return events;
}
