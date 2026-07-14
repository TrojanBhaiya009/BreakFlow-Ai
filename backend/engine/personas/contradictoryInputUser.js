/**
 * BreakFlow AI — Contradictory Input User Persona
 * 
 * Simulates a user who enters invalid, contradictory, and unexpected data.
 */

export const metadata = {
  name: 'Contradictory Input User',
  icon: '🔵',
  description: 'Enters invalid, contradictory, and edge-case data in forms',
  detects: ['input validation gaps', 'injection vulnerabilities', 'type coercion bugs', 'boundary errors']
};

const EVIL_INPUTS = {
  text: [
    '',
    ' ',
    '   ',
    'a'.repeat(10000), // Very long string
    '<script>alert("XSS")</script>',
    '"><img src=x onerror=alert(1)>',
    "'; DROP TABLE users; --",
    '🔥🎉💀🤖',
    '中文测试',
    'null',
    'undefined',
    'NaN',
    'true',
    'false',
    '0',
    '-1',
    '99999999999999999',
    '../../../etc/passwd',
    'test@test@test.com',
    '\n\r\t',
    String.fromCharCode(0),
  ],
  email: [
    'not-an-email',
    'test@',
    '@test.com',
    'test@test@test.com',
    'test@.com',
    'a@b.c',
    `${'a'.repeat(500)}@test.com`,
    '<script>@test.com',
    'test@test.com\n',
  ],
  password: [
    '',
    'a',
    '12345',
    'a'.repeat(10000),
    '<script>alert(1)</script>',
    '   ',
    'パスワード',
  ],
  number: [
    '-1',
    '0',
    '999999999999',
    '-999999999',
    '1.1.1',
    'abc',
    'NaN',
    'Infinity',
    '1e308',
    '0.00000001',
  ],
  tel: [
    'abc',
    '000',
    '+1234567890123456789',
    '(555) 555-5555 ext. 1234',
    '',
  ],
  url: [
    'not-a-url',
    'javascript:alert(1)',
    'ftp://malicious.com',
    'file:///etc/passwd',
    '',
    'http://',
  ],
  date: [
    '0000-00-00',
    '9999-12-31',
    '2025-13-40',
    '2025-02-30',
    '',
  ]
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

    // Find all forms
    const forms = await page.$$('form');
    emit(`Found ${forms.length} forms on the page`);

    // Also get standalone inputs
    const allInputs = await page.$$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select');
    emit(`Found ${allInputs.length} total input fields`);

    const inputGroups = forms.length > 0 
      ? await Promise.all(forms.map(f => f.$$('input:not([type="hidden"]):not([type="submit"]), textarea, select')))
      : [allInputs];

    for (let groupIdx = 0; groupIdx < inputGroups.length; groupIdx++) {
      const inputs = inputGroups[groupIdx];
      emit(`Testing input group ${groupIdx + 1} with ${inputs.length} fields`);

      for (const input of inputs) {
        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) continue;

        const type = (await input.getAttribute('type') || 'text').toLowerCase();
        const name = await input.getAttribute('name') || await input.getAttribute('id') || await input.getAttribute('placeholder') || 'unknown';
        const tagName = await input.evaluate(el => el.tagName.toLowerCase()).catch(() => 'input');

        emit(`Testing field "${name}" (type: ${type})`);

        // Determine which evil inputs to use
        let evilValues;
        if (type === 'email' || name.toLowerCase().includes('email')) {
          evilValues = EVIL_INPUTS.email;
        } else if (type === 'password') {
          evilValues = EVIL_INPUTS.password;
        } else if (type === 'number' || name.toLowerCase().includes('age') || name.toLowerCase().includes('amount') || name.toLowerCase().includes('price')) {
          evilValues = EVIL_INPUTS.number;
        } else if (type === 'tel' || name.toLowerCase().includes('phone')) {
          evilValues = EVIL_INPUTS.tel;
        } else if (type === 'url') {
          evilValues = EVIL_INPUTS.url;
        } else if (type === 'date') {
          evilValues = EVIL_INPUTS.date;
        } else if (type === 'checkbox' || type === 'radio') {
          // Toggle rapidly
          emit(`Rapidly toggling ${type}...`);
          for (let i = 0; i < 10; i++) {
            await input.click({ force: true }).catch(() => {});
            await page.waitForTimeout(100);
          }
          continue;
        } else if (tagName === 'select') {
          // Rapidly change selection
          emit('Rapidly changing dropdown selection...');
          const options = await input.$$('option');
          for (let i = 0; i < Math.min(options.length * 3, 15); i++) {
            const randomOption = options[Math.floor(Math.random() * options.length)];
            const value = await randomOption.getAttribute('value').catch(() => '');
            if (value !== null) {
              await input.selectOption(value).catch(() => {});
              await page.waitForTimeout(100);
            }
          }
          continue;
        } else {
          evilValues = EVIL_INPUTS.text;
        }

        // Test a subset of evil values
        const testValues = evilValues.slice(0, 5);
        
        for (const evilValue of testValues) {
          try {
            // Clear and fill with evil value
            await input.fill('').catch(() => {});
            await input.fill(evilValue).catch(async () => {
              // Some inputs don't support fill, try type
              await input.click().catch(() => {});
              await page.keyboard.type(evilValue.substring(0, 100));
            });

            await page.waitForTimeout(300);

            // Check for immediate validation
            const hasValidationError = await page.evaluate((inputEl) => {
              const el = inputEl;
              return !el.validity?.valid || el.classList.contains('error') || el.classList.contains('invalid');
            }, input).catch(() => false);

            if (!hasValidationError && evilValue.includes('<script>')) {
              logger.addIssue({
                persona: 'Contradictory Input User',
                severity: 'critical',
                category: 'input_validation',
                title: 'Potential XSS: Script Tag Accepted',
                description: `Field "${name}" accepted script tag input without validation`,
                details: { field: name, inputType: type, value: evilValue.substring(0, 100) }
              });
            }

            if (!hasValidationError && evilValue.includes('DROP TABLE')) {
              logger.addIssue({
                persona: 'Contradictory Input User',
                severity: 'critical',
                category: 'input_validation',
                title: 'Potential SQL Injection: SQL Syntax Accepted',
                description: `Field "${name}" accepted SQL injection syntax without validation`,
                details: { field: name, inputType: type }
              });
            }

          } catch (e) {
            // Input rejected the value — that's actually good
          }
        }

        // Reset field
        await input.fill('').catch(() => {});
      }

      // Try submitting with evil data
      if (forms.length > 0 && groupIdx < forms.length) {
        emit('Attempting to submit form with contradictory data...');
        
        // Fill each field with a random evil value
        for (const input of inputs) {
          const isVisible = await input.isVisible().catch(() => false);
          if (!isVisible) continue;

          const type = (await input.getAttribute('type') || 'text').toLowerCase();
          if (type === 'checkbox' || type === 'radio') continue;

          const evilSet = EVIL_INPUTS[type] || EVIL_INPUTS.text;
          const randomEvil = evilSet[Math.floor(Math.random() * evilSet.length)];
          try {
            await input.fill(randomEvil);
          } catch (e) {}
        }

        // Submit
        const form = forms[groupIdx];
        const submitBtn = form ? await form.$('button[type="submit"], input[type="submit"], button:not([type])') : null;
        
        if (submitBtn) {
          const isVisible = await submitBtn.isVisible().catch(() => false);
          if (isVisible) {
            try {
              await submitBtn.click({ force: true });
              await page.waitForTimeout(2000);

              // Check if submission was accepted (should have been rejected)
              const currentUrl = page.url();
              if (currentUrl !== url) {
                logger.addIssue({
                  persona: 'Contradictory Input User',
                  severity: 'warning',
                  category: 'input_validation',
                  title: 'Form Accepted Invalid Data',
                  description: 'Form submission with contradictory/invalid data was accepted and redirected.',
                  details: { redirectedTo: currentUrl }
                });
              }
            } catch (e) {}
          }
        }

        // Reset for next form
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(1000);
        } catch (e) {}
      }
    }

    emit('Contradictory Input User persona completed');

  } catch (error) {
    emit(`Persona error: ${error.message}`);
    logger.addIssue({
      persona: 'Contradictory Input User',
      severity: 'warning',
      category: 'navigation_error',
      title: 'Persona Execution Error',
      description: error.message,
      details: { stack: error.stack }
    });
  }

  return events;
}
