import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('app loads and shows main UI', async ({ page }) => {
    await page.goto('/');

    // Loading screen should appear then disappear
    const loading = page.getByTestId('loading-screen');
    await expect(loading).toBeVisible({ timeout: 5_000 });
    await expect(loading).toBeHidden({ timeout: 30_000 });

    // Main app container should be visible
    await expect(page.getByTestId('app-container')).toBeVisible();
  });

  test('WebGL canvas is present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 30_000 });

    // Three.js renders into a <canvas> element
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible();
  });

  test('status bar shows expected text', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 30_000 });

    const statusBar = page.getByTestId('status-bar');
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toContainText('ChemSim');
    await expect(statusBar).toContainText('Press S/A/D/G/M for tools');
  });

  test('all main panels are visible on load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 30_000 });

    await expect(page.getByTestId('simulation-controls')).toBeVisible();
    await expect(page.getByTestId('toolbar')).toBeVisible();
    await expect(page.getByTestId('periodic-table')).toBeVisible();
  });

  test('property panel is hidden when no atoms selected', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 30_000 });

    // Property panel should not be visible (no atoms selected on load)
    await expect(page.getByTestId('property-panel')).toBeHidden();
  });

  test('energy plot is hidden by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 30_000 });

    await expect(page.getByTestId('energy-plot')).toBeHidden();
  });
});
