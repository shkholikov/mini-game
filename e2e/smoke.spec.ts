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

test('every game starts from the title screen without errors', async ({ page }) => {
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
  await expect.poll(() => activeScenes(page)).toContain('Island');

  // hold a finger to the right of the car: it drives there
  const carX = () =>
    page.evaluate(
      () =>
        (
          (
            window as unknown as { __game: { scene: { getScene: (k: string) => unknown } } }
          ).__game.scene.getScene('Island') as { car: { x: number } }
        ).car.x,
    );
  const before = await carX();
  const b = (await page.locator('#game canvas:not(#stage3d)').boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.8, b.y + b.height * 0.5);
  await page.mouse.down();
  // software WebGL is slow here, so wait for the car rather than a fixed time
  await expect.poll(carX, { timeout: 10_000 }).toBeGreaterThan(before + 2);
  await page.mouse.up();

  // drive through the city race arch
  await page.evaluate(() => {
    const s = (
      window as unknown as { __game: { scene: { getScene: (k: string) => unknown } } }
    ).__game.scene.getScene('Island') as { car: { x: number; z: number; speed: number } };
    Object.assign(s.car, { x: -36, z: -25.5, speed: 0 });
  });
  await expect.poll(() => activeScenes(page)).toContain('Race');

  expect(errors).toEqual([]);
});

test('Умар: tractor honks, hold-home panel adds and removes a song', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' || m.text().includes('[voice] missing')) errors.push(m.text());
  });

  await page.goto('/');
  await expect.poll(() => activeScenes(page)).toContain('Title');
  await tap(page, 800, 600); // Play
  await page.waitForTimeout(1500);
  const umar = await page.evaluate(() => {
    const g = (window as unknown as { __game: { scene: { getScene: (k: string) => unknown } } })
      .__game;
    const t = g.scene.getScene('Title') as { sides: { umar: { zone: { x: number; y: number } } } };
    return { x: t.sides.umar.zone.x, y: t.sides.umar.zone.y };
  });
  await tap(page, umar.x, umar.y);
  await expect.poll(() => activeScenes(page)).toContain('Tractor');

  await tap(page, 800, 780); // honk on the grass
  await tap(page, 270, 86); // a quick tap on home does nothing
  await page.waitForTimeout(500);
  expect(await activeScenes(page)).toContain('Tractor');

  const b = (await page.locator('#game canvas:not(#stage3d)').boundingBox())!;
  await page.mouse.move(b.x + (270 * b.width) / 1600, b.y + (86 * b.height) / 900);
  await page.mouse.down();
  await page.waitForTimeout(2400);
  await page.mouse.up();

  // parent adds a song from the tablet, then removes it
  const status = () =>
    page.evaluate(
      () =>
        (
          (
            window as unknown as { __game: { scene: { getScene: (k: string) => unknown } } }
          ).__game.scene.getScene('Tractor') as { status: { text: string } | null }
        ).status?.text ?? '',
    );
  await expect.poll(status).toBe('Песни нет');
  const chooser = page.waitForEvent('filechooser');
  await tap(page, 600, 440);
  await (await chooser).setFiles('public/assets/sfx/horn.mp3');
  await expect.poll(status).toBe('Песня есть');
  await tap(page, 1000, 440);
  await expect.poll(status).toBe('Песни нет');

  await tap(page, 640, 600); // home in the parent panel
  await expect.poll(() => activeScenes(page)).toContain('Title');

  expect(errors).toEqual([]);
});
