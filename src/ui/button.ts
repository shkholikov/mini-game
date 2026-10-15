import Phaser from 'phaser';
import { voice } from '../systems/voice';
import { COLOR, FONT, INK_HEX, shade } from './theme';

export interface CandyOptions {
  width: number;
  height: number;
  color: number;
  /** icon texture from public/assets/icons (loaded as `icon_<name>`) */
  icon?: string;
  /** any texture shown on the left (e.g. a 3D thumbnail) */
  image?: string;
  imageScale?: number;
  label?: string;
  fontSize?: number;
  onTap: () => void;
}

const EDGE = 12;

/**
 * Chunky toy button: darker 3D edge underneath, shiny top, white outline.
 * Pressing pushes the top down onto the edge, with a click sound.
 */
export function candyButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  o: CandyOptions,
): Phaser.GameObjects.Container {
  const { width: w, height: h } = o;
  const r = Math.min(h / 2, 48);
  const root = scene.add.container(x, y);

  const base = scene.add.graphics();
  base.fillStyle(0x000000, 0.18).fillRoundedRect(-w / 2, -h / 2 + EDGE + 8, w, h, r);
  base.fillStyle(shade(o.color, -0.35), 1).fillRoundedRect(-w / 2, -h / 2 + EDGE, w, h, r);
  root.add(base);

  const top = scene.add.container(0, 0);
  const face = scene.add.graphics();
  face.fillStyle(o.color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  face
    .fillStyle(0xffffff, 0.22)
    .fillRoundedRect(-w / 2 + 10, -h / 2 + 8, w - 20, h * 0.42, Math.max(4, r - 8));
  face.lineStyle(6, 0xffffff, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  top.add(face);

  let contentX = 0;
  if (o.image) {
    const img = scene.add
      .image(o.label ? -w / 2 + h * 0.62 : 0, -4, o.image)
      .setScale(o.imageScale ?? 0.4);
    top.add(img);
    contentX = o.label ? h * 0.5 : 0;
  }
  if (o.icon) {
    const size = Math.min(w, h) * 0.58;
    const icon = scene.add.image(o.label ? -w / 2 + h * 0.6 : 0, 0, `icon_${o.icon}`);
    icon.setScale(size / icon.width);
    top.add(icon);
    contentX = o.label ? h * 0.45 : 0;
  }
  if (o.label) {
    const t = scene.add
      .text(contentX, -2, o.label, {
        fontFamily: FONT.body,
        fontStyle: '900',
        fontSize: `${o.fontSize ?? Math.round(h * 0.42)}px`,
        color: '#ffffff',
        padding: { x: 6, y: 6 },
      })
      .setOrigin(0.5)
      .setShadow(0, 4, 'rgba(0,0,0,0.25)', 0, true, true);
    t.setStroke(INK_HEX, 0);
    top.add(t);
  }
  root.add(top);

  root.setSize(w, h + EDGE);
  root.setInteractive({ useHandCursor: true });
  let pressed = false;
  root.on('pointerdown', () => {
    if (pressed) return;
    pressed = true;
    voice().sfx('tap');
    scene.tweens.add({
      targets: top,
      y: EDGE - 2,
      duration: 70,
      yoyo: true,
      onComplete: () => {
        pressed = false;
        o.onTap();
      },
    });
  });
  return root;
}

/** Round candy button with a white icon. */
export function iconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  icon: string,
  color: number,
  onTap: () => void,
  size = 120,
): Phaser.GameObjects.Container {
  return candyButton(scene, x, y, { width: size, height: size, color, icon, onTap });
}

/** Home button (top-left) back to the island. */
export function homeButton(scene: Phaser.Scene): Phaser.GameObjects.Container {
  return iconButton(
    scene,
    270,
    86,
    'home',
    COLOR.orange,
    () => {
      voice().stop();
      scene.scene.start('Title');
    },
    104,
  ).setDepth(100);
}

/** Little white sticker with an icon and a number (cups, hearts, stars). */
export function sticker(
  scene: Phaser.Scene,
  x: number,
  y: number,
  icon: string,
  count: number,
  iconScale = 0.4,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  c.add(scene.add.circle(0, 5, 46, 0x000000, 0.15));
  c.add(scene.add.circle(0, 0, 46, 0xffffff).setStrokeStyle(5, COLOR.yellow));
  c.add(scene.add.image(0, -10, icon).setScale(iconScale));
  c.add(
    scene.add
      .text(0, 20, String(count), { fontFamily: FONT.race, fontSize: '28px', color: INK_HEX })
      .setOrigin(0.5),
  );
  return c;
}
