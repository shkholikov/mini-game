import { expect, test, type Page } from '@playwright/test';

async function tap(page: Page, x: number, y: number): Promise<void> {
  const b = (await page.locator('#game canvas:not(#stage3d)').boundingBox())!;
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

  await tap(page, 800, 600); // Play
  await page.waitForTimeout(1500);
  const sides = await page.evaluate(() => {
    const g = (window as unknown as { __game: { scene: { getScene: (k: string) => unknown } } })
      .__game;
    const t = g.scene.getScene('Title') as {
      sides: {
        osman: { zone: { x: number; y: number } };
        safia: { zone: { x: number; y: number } };
      };
    };
    return {
      osman: { x: t.sides.osman.zone.x, y: t.sides.osman.zone.y },
      safia: { x: t.sides.safia.zone.x, y: t.sides.safia.zone.y },
    };
  });
  await tap(page, sides.safia.x, sides.safia.y); // Сафия
  await expect.poll(() => activeScenes(page)).toContain('Feed');

  await tap(page, 270, 86); // home
  await expect.poll(() => activeScenes(page)).toContain('Title');

  await page.waitForTimeout(1500);
  const again = await page.evaluate(() => {
    const g = (window as unknown as { __game: { scene: { getScene: (k: string) => unknown } } })
      .__game;
    const t = g.scene.getScene('Title') as { sides: { osman: { zone: { x: number; y: number } } } };
    return { x: t.sides.osman.zone.x, y: t.sides.osman.zone.y };
  });
  await tap(page, again.x, again.y); // Осман
  await expect.poll(() => activeScenes(page)).toContain('Garage');
  // cars are 3D; their tap zones follow the projected positions
  const zone = await page.evaluate(() => {
    const g = (window as unknown as { __game: { scene: { getScene: (k: string) => unknown } } })
      .__game;
    const z = (g.scene.getScene('Garage') as { zones: { x: number; y: number }[] }).zones[0]!;
    return { x: z.x, y: z.y };
  });
  await tap(page, zone.x, zone.y);
  await page.waitForTimeout(2500);
  await tap(page, 480, 690); // city track
  await expect.poll(() => activeScenes(page)).toContain('Race');

  expect(errors).toEqual([]);
});
