import { test, expect, Page } from '@playwright/test';

/**
 * Open the examples dropdown. Retries the click if the dropdown
 * doesn't appear immediately (canvas overlay can steal focus).
 */
async function openExamplesDropdown(page: Page): Promise<void> {
  const examplesButton = page.getByTestId('examples-button');
  const dropdown = page.getByTestId('examples-dropdown');

  // Retry clicking up to 3 times — the Three.js canvas can intercept the first click
  for (let attempt = 0; attempt < 3; attempt++) {
    await examplesButton.click();
    try {
      await expect(dropdown).toBeVisible({ timeout: 2_000 });
      return;
    } catch {
      // Dropdown didn't appear, try again
    }
  }
  // Final attempt — let it throw on failure
  await examplesButton.click();
  await expect(dropdown).toBeVisible({ timeout: 5_000 });
}

test.describe('Example molecule loading', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden({
      timeout: 30_000,
    });
  });

  test('examples dropdown opens and lists 14 molecules', async ({ page }) => {
    await openExamplesDropdown(page);

    const dropdown = page.getByTestId('examples-dropdown');
    const items = dropdown.locator('button');
    await expect(items).toHaveCount(14);
  });

  test('default molecule is Water with 3 atoms', async ({ page }) => {
    // App loads Water by default
    const atomCount = page.getByTestId('stat-atoms');
    await expect(atomCount).toHaveText('3');
  });

  test('loading Methane shows 5 atoms', async ({ page }) => {
    await openExamplesDropdown(page);
    await page.getByTestId('example-Methane (CH₄)').click();

    const atomCount = page.getByTestId('stat-atoms');
    await expect(atomCount).toHaveText('5', { timeout: 5_000 });
  });

  test('loading Ethanol shows 9 atoms', async ({ page }) => {
    await openExamplesDropdown(page);
    await page.getByTestId('example-Ethanol (C₂H₅OH)').click();

    const atomCount = page.getByTestId('stat-atoms');
    await expect(atomCount).toHaveText('9', { timeout: 5_000 });
  });

  test('loading NaCl shows 2 atoms', async ({ page }) => {
    await openExamplesDropdown(page);
    await page.getByTestId('example-NaCl pair').click();

    const atomCount = page.getByTestId('stat-atoms');
    await expect(atomCount).toHaveText('2', { timeout: 5_000 });
  });

  test('loading CO2 shows 3 atoms', async ({ page }) => {
    await openExamplesDropdown(page);
    await page.getByTestId('example-Carbon Dioxide (CO₂)').click();

    const atomCount = page.getByTestId('stat-atoms');
    await expect(atomCount).toHaveText('3', { timeout: 5_000 });
  });

  test('dropdown closes after selecting a molecule', async ({ page }) => {
    await openExamplesDropdown(page);

    const dropdown = page.getByTestId('examples-dropdown');
    await page.getByTestId('example-NaCl pair').click();

    await expect(dropdown).toBeHidden({ timeout: 5_000 });
  });
});
