import { test, expect } from '@playwright/test';

test.describe('Periodic table', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden({
      timeout: 30_000,
    });
  });

  test('periodic table is visible on load', async ({ page }) => {
    await expect(page.getByTestId('periodic-table')).toBeVisible();
    await expect(page.getByTestId('periodic-table')).toContainText(
      'Periodic Table',
    );
  });

  test('Carbon is selected by default', async ({ page }) => {
    const carbon = page.getByTestId('element-C');
    await expect(carbon).toBeVisible();
    // Selected element has a 2px solid white border
    await expect(carbon).toHaveCSS('border-style', 'solid');
    await expect(carbon).toHaveCSS('border-width', '2px');
  });

  test('clicking Hydrogen selects it', async ({ page }) => {
    const hydrogen = page.getByTestId('element-H');
    await expect(hydrogen).toBeVisible();

    await hydrogen.click();

    // Hydrogen should now have the selected border
    await expect(hydrogen).toHaveCSS('border-width', '2px');
    // Carbon should no longer be selected (1px border)
    const carbon = page.getByTestId('element-C');
    await expect(carbon).toHaveCSS('border-width', '1px');
  });

  test('clicking Oxygen selects it', async ({ page }) => {
    const oxygen = page.getByTestId('element-O');
    await expect(oxygen).toBeVisible();

    await oxygen.click();

    await expect(oxygen).toHaveCSS('border-width', '2px');
  });

  test('contains at least 36 elements', async ({ page }) => {
    // The periodic table should show elements from H (1) through Kr (36)
    const periodicTable = page.getByTestId('periodic-table');
    const elementButtons = periodicTable.locator('button');
    const count = await elementButtons.count();
    expect(count).toBeGreaterThanOrEqual(36);
  });

  test('key elements are present', async ({ page }) => {
    // Spot-check several elements across the table
    await expect(page.getByTestId('element-H')).toBeVisible(); // Hydrogen
    await expect(page.getByTestId('element-He')).toBeVisible(); // Helium
    await expect(page.getByTestId('element-Li')).toBeVisible(); // Lithium
    await expect(page.getByTestId('element-C')).toBeVisible(); // Carbon
    await expect(page.getByTestId('element-N')).toBeVisible(); // Nitrogen
    await expect(page.getByTestId('element-O')).toBeVisible(); // Oxygen
    await expect(page.getByTestId('element-Na')).toBeVisible(); // Sodium
    await expect(page.getByTestId('element-Cl')).toBeVisible(); // Chlorine
    await expect(page.getByTestId('element-Fe')).toBeVisible(); // Iron
    await expect(page.getByTestId('element-Kr')).toBeVisible(); // Krypton
  });
});
