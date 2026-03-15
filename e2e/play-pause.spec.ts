import { test, expect } from '@playwright/test';

test.describe('Play/pause controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('loading-screen')).toBeHidden({ timeout: 30_000 });
  });

  test('starts in paused state with Play button', async ({ page }) => {
    const button = page.getByTestId('play-pause-button');
    await expect(button).toBeVisible();
    await expect(button).toContainText('Play');
  });

  test('clicking Play changes button to Pause', async ({ page }) => {
    const button = page.getByTestId('play-pause-button');
    await button.click();
    await expect(button).toContainText('Pause');
  });

  test('clicking Pause changes button back to Play', async ({ page }) => {
    const button = page.getByTestId('play-pause-button');
    // Start simulation
    await button.click();
    await expect(button).toContainText('Pause');
    // Stop simulation
    await button.click();
    await expect(button).toContainText('Play');
  });

  test('step counter increments while running', async ({ page }) => {
    const stepStat = page.getByTestId('stat-step');
    const initialStep = await stepStat.textContent();

    // Start simulation
    const button = page.getByTestId('play-pause-button');
    await button.click();

    // Wait for steps to advance
    await page.waitForTimeout(1_000);

    const newStep = await stepStat.textContent();
    expect(Number(newStep)).toBeGreaterThan(Number(initialStep));

    // Stop simulation
    await button.click();
  });

  test('minimize button is clickable', async ({ page }) => {
    const minimize = page.getByTestId('minimize-button');
    await expect(minimize).toBeVisible();
    await expect(minimize).toContainText('Minimize');
    // Click should not throw
    await minimize.click();
  });

  test('simulation controls show stats', async ({ page }) => {
    // Verify stats are displayed with expected labels
    await expect(page.getByTestId('stat-step')).toBeVisible();
    await expect(page.getByTestId('stat-atoms')).toBeVisible();
    await expect(page.getByTestId('stat-bonds')).toBeVisible();
    await expect(page.getByTestId('stat-temp')).toBeVisible();
    await expect(page.getByTestId('stat-ke')).toBeVisible();
    await expect(page.getByTestId('stat-pe')).toBeVisible();
    await expect(page.getByTestId('stat-total-e')).toBeVisible();
  });
});
