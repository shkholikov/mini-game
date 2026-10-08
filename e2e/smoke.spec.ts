import { expect, test } from '@playwright/test';

test('game boots and renders the canvas without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
