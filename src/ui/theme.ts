/** One look for the whole game: fonts, colours and text styles. */
import type Phaser from 'phaser';

export const FONT = {
  /** rounded, friendly — every label and button */
  body: '"Nunito", system-ui, sans-serif',
  /** sporty — title and race screens */
  race: '"Russo One", "Nunito", sans-serif',
};

export const COLOR = {
  ink: 0x2f3b52,
  white: 0xffffff,
  orange: 0xff8a3d,
  pink: 0xf06aa0,
  green: 0x4cc35a,
  blue: 0x3d8bff,
  yellow: 0xffc933,
  purple: 0x8f6bff,
  sky: 0x8fd3ff,
} as const;

export const INK = COLOR.ink;
export const INK_HEX = '#2f3b52';

/** Darken (amount < 0) or lighten (amount > 0) a 0xRRGGBB colour. */
export function shade(color: number, amount: number): number {
  const ch = (shift: number): number => {
    const c = (color >> shift) & 0xff;
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export type TextKind = 'title' | 'heading' | 'button' | 'label' | 'counter';

const KINDS: Record<TextKind, { font: string; size: number; stroke: number; shadow: number }> = {
  title: { font: FONT.race, size: 96, stroke: 16, shadow: 8 },
  heading: { font: FONT.race, size: 64, stroke: 12, shadow: 6 },
  button: { font: FONT.body, size: 52, stroke: 0, shadow: 0 },
  label: { font: FONT.body, size: 40, stroke: 8, shadow: 4 },
  counter: { font: FONT.race, size: 44, stroke: 0, shadow: 0 },
};

/** Text in the game style: white, heavy, dark outline and soft drop shadow. */
export function gameText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  kind: TextKind,
  opts: { size?: number; color?: string } = {},
): Phaser.GameObjects.Text {
  const k = KINDS[kind];
  const t = scene.add
    .text(x, y, value, {
      fontFamily: k.font,
      fontSize: `${opts.size ?? k.size}px`,
      fontStyle: k.font === FONT.body ? '900' : 'normal',
      color: opts.color ?? '#ffffff',
      padding: { x: 8, y: 8 },
    })
    .setOrigin(0.5);
  if (k.stroke) t.setStroke(INK_HEX, k.stroke);
  if (k.shadow) t.setShadow(0, k.shadow, 'rgba(0,0,0,0.25)', 0, true, true);
  return t;
}

/** Vertical gradient fill for big titles. */
export function gradientFill(t: Phaser.GameObjects.Text, top: string, bottom: string): void {
  const g = t.context.createLinearGradient(0, 0, 0, t.height);
  g.addColorStop(0.15, top);
  g.addColorStop(0.85, bottom);
  t.setFill(g);
}

/** Waits until the bundled fonts (with Cyrillic) are ready, so Phaser measures text correctly. */
export async function loadFonts(): Promise<void> {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('900 40px "Nunito"', 'Осман Сафия 0123'),
    document.fonts.load('40px "Russo One"', 'Осман Сафия 0123'),
  ]).catch(() => undefined);
}
