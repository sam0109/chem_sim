import { test, expect, Page } from '@playwright/test';

/**
 * Press a keyboard shortcut after ensuring keyboard events will reach
 * the window-level listener in Toolbar.tsx. We focus the document body
 * to avoid the Three.js canvas intercepting keypresses.
 */
async function pressKey(page: Page, key: string): Promise<void> {
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press(key);
}

test.describe('Keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 30_000 });
  });

  test('S key activates Select tool', async ({ page }) => {
    // First switch away from Select (default)
    await pressKey(page, 'a');
    await expect(page.getByTestId('tool-place-atom')).toHaveCSS('border-width', '2px');

    // Press S to go back to Select
    await pressKey(page, 's');
    await expect(page.getByTestId('tool-select')).toHaveCSS('border-width', '2px');
  });

  test('A key activates Place Atom tool', async ({ page }) => {
    await pressKey(page, 'a');
    await expect(page.getByTestId('tool-place-atom')).toHaveCSS('border-width', '2px');
  });

  test('D key activates Delete tool', async ({ page }) => {
    await pressKey(page, 'd');
    await expect(page.getByTestId('tool-delete')).toHaveCSS('border-width', '2px');
  });

  test('G key activates Drag tool', async ({ page }) => {
    await pressKey(page, 'g');
    await expect(page.getByTestId('tool-drag')).toHaveCSS('border-width', '2px');
  });

  test('M key activates Measure tool', async ({ page }) => {
    await pressKey(page, 'm');
    await expect(page.getByTestId('tool-measure-distance')).toHaveCSS('border-width', '2px');
  });

  test('L key toggles labels', async ({ page }) => {
    const toggleBtn = page.getByTestId('toggle-labels');

    // Labels are on by default (border-width: 2px)
    await expect(toggleBtn).toHaveCSS('border-width', '2px');

    // Toggle off
    await pressKey(page, 'l');
    await expect(toggleBtn).toHaveCSS('border-width', '1px');

    // Toggle back on
    await pressKey(page, 'l');
    await expect(toggleBtn).toHaveCSS('border-width', '2px');
  });

  test('clicking tool buttons changes active tool', async ({ page }) => {
    // Use dispatchEvent to avoid Three.js canvas intercepting clicks
    const placeAtom = page.getByTestId('tool-place-atom');
    await placeAtom.dispatchEvent('click');
    await expect(placeAtom).toHaveCSS('border-width', '2px');
    await expect(page.getByTestId('tool-select')).toHaveCSS('border-width', '1px');

    // Click Delete button
    const del = page.getByTestId('tool-delete');
    await del.dispatchEvent('click');
    await expect(del).toHaveCSS('border-width', '2px');
    await expect(placeAtom).toHaveCSS('border-width', '1px');
  });

  test('energy plot toggle button works', async ({ page }) => {
    // Energy plot hidden by default
    await expect(page.getByTestId('energy-plot')).toBeHidden();

    // Use dispatchEvent to show
    await page.getByTestId('toggle-energy-plot').dispatchEvent('click');
    await expect(page.getByTestId('energy-plot')).toBeVisible();

    // Dispatch again to hide
    await page.getByTestId('toggle-energy-plot').dispatchEvent('click');
    await expect(page.getByTestId('energy-plot')).toBeHidden();
  });
});
