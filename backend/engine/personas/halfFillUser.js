/**
 * BreakFlow AI — Half-Fill User Persona
 * 
 * Simulates a user who fills forms partially and submits, navigates away mid-flow,
 * or leaves required fields empty.
 */

export const metadata = {
  name: 'Distracted Signup',
  icon: '🟡',
  description: 'Fills forms partially, leaves fields empty, submits incomplete data',
  detects: ['missing validation', 'partial submission bugs', 'abandoned workflow issues']
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

    if (forms.length === 0) {
      // Look for input fields not in forms
      const inputs = await page.$$('input:not([type="hidden"]), textarea, select');
      emit(`Found ${inputs.length} standalone input fields`);
      
      if (inputs.length > 0) {
        await testInputFields(page, inputs, logger, emit);
      }
    }

    for (let formIdx = 0; formIdx < forms.length; formIdx++) {
      const form = forms[formIdx];
      emit(`Testing form ${formIdx + 1}/${forms.length}`);

      // Get all inputs in this form
      const inputs = await form.$$('input:not([type="hidden"]):not([type="submit"]), textarea, select');
      emit(`Form has ${inputs.length} input fields`);

      if (inputs.length === 0) continue;

      // Strategy 1: Fill only half the fields
      emit('Strategy 1: Filling only half the fields...');
      const halfCount = Math.ceil(inputs.length / 2);
      
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) continue;

        if (i < halfCount) {
          await fillField(input, page);
        }
        // Leave the rest empty
      }

      // Try to submit
      await trySubmitForm(form, page, logger, emit, 'half-filled');
      await page.waitForTimeout(1500);

      // Reload page for next strategy
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1500);

      // Re-find forms after reload
      const formsReloaded = await page.$$('form');
      if (formIdx >= formsReloaded.length) break;
      const formReloaded = formsReloaded[formIdx];
      const inputsReloaded = await formReloaded.$$('input:not([type="hidden"]):not([type="submit"]), textarea, select');

      // Strategy 2: Fill all then clear random fields
      emit('Strategy 2: Fill all then clear random fields...');
      for (const input of inputsReloaded) {
        const isVisible = await input.isVisible().catch(() => false);
        if (!isVisible) continue;
        await fillField(input, page);
      }

      // Clear 1-3 random fields
      const clearCount = Math.min(3, Math.max(1, Math.floor(inputsReloaded.length * 0.4)));
      const indicesToClear = getRandomIndices(inputsReloaded.length, clearCount);
      
      for (const idx of indicesToClear) {
        try {
          const input = inputsReloaded[idx];
          const isVisible = await input.isVisible().catch(() => false);
          if (!isVisible) continue;
          await input.fill('');
          const name = await input.getAttribute('name') || await input.getAttribute('id') || 'unknown';
          emit(`Cleared field: ${name}`);
        } catch (e) {}
      }

      await trySubmitForm(formReloaded, page, logger, emit, 'cleared-fields');
      await page.waitForTimeout(1500);

      // Strategy 3: Navigate away mid-form
      emit('Strategy 3: Navigate away mid-form filling...');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(1000);
      
      const formsAgain = await page.$$('form');
      if (formIdx < formsAgain.length) {
        const formAgain = formsAgain[formIdx];
        const inputsAgain = await formAgain.$$('input:not([type="hidden"]):not([type="submit"]), textarea, select');
        
        // Fill just 1-2 fields
        for (let i = 0; i < Math.min(2, inputsAgain.length); i++) {
          const isVisible = await inputsAgain[i].isVisible().catch(() => false);
          if (!isVisible) continue;
          await fillField(inputsAgain[i], page);
        }

        // Navigate away
        emit('Navigating away mid-form...');
        await page.goBack().catch(() => {});
        await page.waitForTimeout(1000);
        await page.goForward().catch(() => {});
        await page.waitForTimeout(1000);

        // Check if form data persisted
        const formsPersist = await page.$$('form');
        if (formIdx < formsPersist.length) {
          const formPersist = formsPersist[formIdx];
          const inputsPersist = await formPersist.$$('input:not([type="hidden"]):not([type="submit"]), textarea, select');
          
          let filledCount = 0;
          for (const input of inputsPersist) {
            const value = await input.inputValue().catch(() => '');
            if (value) filledCount++;
          }

          if (filledCount === 0 && inputsAgain.length > 0) {
            logger.addIssue({
              persona: 'Distracted Signup',
              severity: 'info',
              category: 'navigation_error',
              title: 'Form Data Lost on Navigation',
              description: 'Form data was lost when user navigated away and returned.',
              details: { formIndex: formIdx }
            });
          }
        }
      }
    }

    emit('Distracted Signup persona completed');

  } catch (error) {
    emit(`Persona error: ${error.message}`);
    logger.addIssue({
      persona: 'Distracted Signup',
      severity: 'warning',
      category: 'navigation_error',
      title: 'Persona Execution Error',
      description: error.message,
      details: { stack: error.stack }
    });
  }

  return events;
}

async function fillField(input, page) {
  try {
    const type = await input.getAttribute('type') || 'text';
    const name = (await input.getAttribute('name') || await input.getAttribute('placeholder') || '').toLowerCase();

    if (type === 'email' || name.includes('email')) {
      await input.fill('test@example.com');
    } else if (type === 'password' || name.includes('password')) {
      await input.fill('TestPass123!');
    } else if (type === 'tel' || name.includes('phone')) {
      await input.fill('5551234567');
    } else if (type === 'number' || name.includes('age') || name.includes('quantity')) {
      await input.fill('25');
    } else if (type === 'url') {
      await input.fill('https://example.com');
    } else if (type === 'checkbox' || type === 'radio') {
      await input.check().catch(() => input.click());
    } else if (type === 'date') {
      await input.fill('2025-01-15');
    } else {
      await input.fill('Test Input Data');
    }
  } catch (e) {}
}

async function trySubmitForm(form, page, logger, emit, strategy) {
  try {
    // Try finding submit button
    const submitBtn = await form.$('button[type="submit"], input[type="submit"], button:not([type])');
    if (submitBtn) {
      const isVisible = await submitBtn.isVisible().catch(() => false);
      if (isVisible) {
        emit(`Submitting ${strategy} form...`);
        await submitBtn.click({ force: true });
        await page.waitForTimeout(2000);

        // Check for error messages (if none, it accepted bad data)
        const errorSelectors = ['.error', '.alert-danger', '.invalid-feedback', '[class*="error"]', '[role="alert"]'];
        let hasError = false;

        for (const sel of errorSelectors) {
          const errorEl = await page.$(sel);
          if (errorEl && await errorEl.isVisible().catch(() => false)) {
            hasError = true;
            break;
          }
        }

        if (!hasError) {
          logger.addIssue({
            persona: 'Distracted Signup',
            severity: 'warning',
            category: 'input_validation',
            title: `Form Accepted ${strategy} Submission`,
            description: `The form accepted a ${strategy} submission without visible validation errors.`,
            details: { strategy }
          });
        }

        return;
      }
    }

    // Fallback: press Enter
    emit('No submit button found, pressing Enter...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  } catch (e) {
    emit(`Submit attempt failed: ${e.message}`);
  }
}

async function testInputFields(page, inputs, logger, emit) {
  for (const input of inputs.slice(0, 10)) {
    const isVisible = await input.isVisible().catch(() => false);
    if (!isVisible) continue;
    
    const name = await input.getAttribute('name') || await input.getAttribute('id') || 'unknown';
    emit(`Testing standalone field: ${name}`);
    
    // Try submitting empty
    await input.focus().catch(() => {});
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
  }
}

function getRandomIndices(max, count) {
  const indices = new Set();
  while (indices.size < count && indices.size < max) {
    indices.add(Math.floor(Math.random() * max));
  }
  return [...indices];
}
