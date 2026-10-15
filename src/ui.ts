import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config/game';
import { voice } from './systems/voice';

export const INK = 0x2f3b52;
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Sky + rolling hills background used by the menus and the feeding game. */
export function drawMeadow(
  scene: Phaser.Scene,
  opts: { sky?: number; skyLow?: number } = {},
): void {
  const g = scene.add.graphics();
  g.fillGradientStyle(
    opts.sky ?? 0x7cc8ff,
    opts.sky ?? 0x7cc8ff,
    opts.skyLow ?? 0xdff3ff,
    opts.skyLow ?? 0xdff3ff,
    1,
  );
  g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  scene.add.circle(1380, 120, 70, 0xffd84d);
  scene.add.circle(1380, 120, 92, 0xffd84d, 0.25);
  for (const [x, y, s] of [
    [330, 230, 1],
    [640, 190, 0.8],
    [1160, 300, 0.9],
  ] as const) {
    const c = scene.add.container(x, y);
    c.add([
      scene.add.ellipse(0, 0, 160 * s, 60 * s, 0xffffff),
      scene.add.ellipse(40 * s, -20 * s, 100 * s, 60 * s, 0xffffff),
      scene.add.ellipse(-40 * s, -10 * s, 90 * s, 50 * s, 0xffffff),
    ]);
    scene.tweens.add({
      targets: c,
      x: x + 60,
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }
  g.fillStyle(0x8fd16b, 1);
  g.fillEllipse(300, 760, 1100, 420);
  g.fillEllipse(1300, 780, 1200, 440);
  g.fillStyle(0x6fbf4f, 1);
  g.fillRect(0, 780, GAME_WIDTH, 120);
}

/** Round icon button; `draw` paints the icon inside a 0-centred graphics. */
export function iconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
  onTap: () => void,
  radius = 60,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const shadow = scene.add.circle(0, 6, radius, 0x000000, 0.18);
  const bg = scene.add.circle(0, 0, radius, color).setStrokeStyle(6, 0xffffff);
  const icon = scene.add.graphics();
  draw(icon);
  c.add([shadow, bg, icon]);
  c.setSize(radius * 2, radius * 2);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => {
    voice().sfx('tap');
    scene.tweens.add({ targets: c, scale: 0.9, duration: 80, yoyo: true, onComplete: onTap });
  });
  return c;
}

/** Home button (top-left) that returns to the title screen. */
export function homeButton(scene: Phaser.Scene): Phaser.GameObjects.Container {
  return iconButton(
    scene,
    270,
    80,
    0xff8a3d,
    (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(-30, -2, 0, -30, 30, -2);
      g.fillRect(-22, -4, 44, 30);
      g.fillStyle(0xff8a3d, 1);
      g.fillRect(-7, 8, 14, 18);
    },
    () => {
      voice().stop();
      scene.scene.start('Title');
    },
    48,
  ).setDepth(100);
}

export function replayIcon(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(12, 0xffffff, 1);
  g.beginPath();
  g.arc(0, 0, 30, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(250));
  g.strokePath();
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(8, -44, 34, -24, 6, -14);
}

export function playIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(-18, -30, -18, 30, 32, 0);
}

/** Burst of colourful confetti across the screen. */
export function confetti(scene: Phaser.Scene, x = GAME_WIDTH / 2, y = -20, count = 90): void {
  const emitter = scene.add.particles(x, y, 'confetti', {
    speedX: { min: -500, max: 500 },
    speedY: { min: 100, max: 600 },
    gravityY: 500,
    rotate: { min: 0, max: 360 },
    lifespan: 2600,
    scale: { min: 0.6, max: 1.2 },
    tint: [0xe8574a, 0xf5c842, 0x4a90e2, 0x5cb85c, 0xf28db2, 0x9b59b6],
    emitting: false,
  });
  emitter.setDepth(200);
  emitter.explode(count);
  scene.time.delayedCall(3000, () => emitter.destroy());
}

export function hearts(scene: Phaser.Scene, x: number, y: number, count = 8): void {
  const emitter = scene.add.particles(x, y, 'heart', {
    speed: { min: 150, max: 380 },
    angle: { min: 200, max: 340 },
    gravityY: 200,
    lifespan: 1300,
    scale: { start: 0.8, end: 0.2 },
    alpha: { start: 1, end: 0 },
    emitting: false,
  });
  emitter.setDepth(150);
  emitter.explode(count);
  scene.time.delayedCall(1500, () => emitter.destroy());
}

/** Small textures made in code: particles, stars, hearts. */
export function makeTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 1).fillRect(0, 0, 16, 10);
  g.generateTexture('confetti', 16, 10);
  g.clear();

  g.fillStyle(0xff5a7a, 1);
  g.fillCircle(14, 14, 13);
  g.fillCircle(36, 14, 13);
  g.fillTriangle(2, 20, 48, 20, 25, 46);
  g.generateTexture('heart', 50, 48);
  g.clear();

  const star = (cx: number, cy: number, r: number): Phaser.Math.Vector2[] =>
    Array.from({ length: 10 }, (_, i) => {
      const rad = i % 2 === 0 ? r : r * 0.48;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      return new Phaser.Math.Vector2(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    });
  g.fillStyle(0xd99a00, 1).fillPoints(star(50, 52, 48), true);
  g.fillStyle(0xffd84d, 1).fillPoints(star(50, 50, 40), true);
  g.fillStyle(0xfff3b0, 1).fillCircle(40, 38, 7);
  g.generateTexture('star', 100, 100);
  g.clear();

  // checkered finish line tile
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle((i + j) % 2 ? 0x222222 : 0xffffff, 1).fillRect(i * 20, j * 20, 20, 20);
    }
  g.generateTexture('checker', 160, 40);
  g.clear();

  // trophy cup
  g.lineStyle(10, 0xe0a800, 1);
  g.strokeCircle(24, 48, 20).strokeCircle(100, 48, 20);
  g.fillStyle(0xffd84d, 1);
  g.fillRect(20, 18, 84, 14);
  g.beginPath();
  g.arc(62, 30, 42, 0, Math.PI);
  g.closePath();
  g.fillPath();
  g.fillStyle(0xe0a800, 1).fillRect(54, 70, 16, 36);
  g.fillStyle(0xffc533, 1).fillRoundedRect(32, 102, 60, 16, 6);
  g.fillStyle(0xb8860b, 1).fillRoundedRect(22, 118, 80, 24, 6);
  g.fillStyle(0xfff3b0, 1).fillEllipse(44, 42, 12, 28);
  g.generateTexture('cup', 124, 146);
  g.destroy();
}
