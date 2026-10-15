import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/game';

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
