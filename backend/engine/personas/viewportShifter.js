/**
 * BreakFlow - Viewport Shifter Persona
 *
 * Resizes the app across common device widths and checks for layout failures.
 */

export const metadata = {
  name: 'Viewport Shifter',
  icon: 'viewport',
  description: 'Resizes through mobile, tablet, and desktop viewports',
  detects: ['horizontal overflow', 'tiny tap targets', 'blocked responsive layouts']
};

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'small-mobile', width: 320, height: 700 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 }
];

export async function execute(page, url, logger) {
  const events = [];
  const emit = (msg) => events.push({ message: msg, timestamp: new Date().toISOString() });

  try {
    emit('Navigating to target URL...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    for (const viewport of VIEWPORTS) {
      emit(`Testing ${viewport.name} viewport (${viewport.width}x${viewport.height})...`);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(900);

      const result = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const scrollWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0);
        const overflowPx = scrollWidth - window.innerWidth;

        const candidates = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')];
        const tinyTargets = candidates
          .map((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const visible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
            if (!visible || rect.bottom < 0 || rect.top > window.innerHeight) return null;
            if (rect.width >= 32 && rect.height >= 32) return null;
            return {
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('name') || '').trim().slice(0, 60),
              width: Math.round(rect.width),
              height: Math.round(rect.height)
            };
          })
          .filter(Boolean)
          .slice(0, 8);

        const blockingFixed = [...document.querySelectorAll('body *')]
          .map((el) => {
            const style = window.getComputedStyle(el);
            if (!['fixed', 'sticky'].includes(style.position) || style.pointerEvents === 'none') return null;
            const rect = el.getBoundingClientRect();
            const area = rect.width * rect.height;
            const viewportArea = window.innerWidth * window.innerHeight;
            if (area < viewportArea * 0.55) return null;
            return {
              tag: el.tagName.toLowerCase(),
              text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 60),
              areaRatio: Number((area / viewportArea).toFixed(2))
            };
          })
          .filter(Boolean)
          .slice(0, 3);

        return { overflowPx, tinyTargets, blockingFixed };
      });

      if (result.overflowPx > 4) {
        logger.addIssue({
          persona: 'Viewport Shifter',
          severity: viewport.width <= 375 ? 'warning' : 'info',
          category: 'responsive_layout',
          title: 'Horizontal Overflow at Viewport Width',
          description: `The page overflows horizontally by ${result.overflowPx}px at ${viewport.width}px wide.`,
          details: { viewport, overflowPx: result.overflowPx }
        });
      }

      if (result.tinyTargets.length > 0) {
        logger.addIssue({
          persona: 'Viewport Shifter',
          severity: 'info',
          category: 'responsive_layout',
          title: 'Small Interactive Targets',
          description: `${result.tinyTargets.length} visible controls are smaller than 32x32px at ${viewport.width}px wide.`,
          details: { viewport, samples: result.tinyTargets }
        });
      }

      if (result.blockingFixed.length > 0) {
        logger.addIssue({
          persona: 'Viewport Shifter',
          severity: 'warning',
          category: 'responsive_layout',
          title: 'Large Fixed Element May Block Content',
          description: `A fixed or sticky element covers more than half of the viewport at ${viewport.width}px wide.`,
          details: { viewport, samples: result.blockingFixed }
        });
      }
    }

    emit('Viewport Shifter persona completed');
  } catch (error) {
    emit(`Persona error: ${error.message}`);
    logger.addIssue({
      persona: 'Viewport Shifter',
      severity: 'warning',
      category: 'responsive_layout',
      title: 'Persona Execution Error',
      description: error.message,
      details: { stack: error.stack }
    });
  }

  return events;
}
