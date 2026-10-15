import { expect, test, type Page } from '@playwright/test';

async function tap(page: Page, x: number, y: number): Promise<void> {
  const b = (await page.locator('#game canvas').boundingBox())!;
  await page.mouse.click(b.x + (x * b.width) / 1600, b.y + (y * b.height) / 900);
}

const activeScenes = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        __game: { scene: { getScenes: (a: boolean) => { scene: { key: string } }[] } };
      }
    ).__game.scene
      .getScenes(true)
      .map((s) => s.scene.key),
  );

test('both games start from the title screen without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      m.type() === 'error' ||
      m.text().includes('[voice] missing') ||
      m.text().includes('could not load')
    )
      errors.push(m.text());
  });

  await page.goto('/');
  await expect.poll(() => activeScenes(page)).toContain('Title');

  await tap(page, 1080, 470); // Сафия
  await expect.poll(() => activeScenes(page)).toContain('Feed');

  await tap(page, 270, 80); // home
  await expect.poll(() => activeScenes(page)).toContain('Title');

  await tap(page, 520, 470); // Осман
  await expect.poll(() => activeScenes(page)).toContain('Garage');
  await tap(page, 400, 330); // red car
  await page.waitForTimeout(1500);
  await tap(page, 480, 680); // city track
  await expect.poll(() => activeScenes(page)).toContain('Race');

  expect(errors).toEqual([]);
});
