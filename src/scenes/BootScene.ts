import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { TEXT, VOICE } from '../i18n/ru';
import { loadModels } from '../three/models';
import { makeThumbs } from '../three/thumbs';
import { COLOR, gameText, gradientFill, makeTextures } from '../ui';

const SFX = ['correct', 'tap', 'pop', 'coin', 'soft', 'whoosh', 'drop', 'horn'];
/** 2D race art still used: countdown lights and the land tiles on the garage track cards. */
const RACE = ['lights', 'land_grass', 'land_sand'];
const ICONS = ['home', 'return', 'right', 'star', 'trophy', 'tablet', 'musicOn', 'musicOff'];

const BAR_W = 640;
const BAR_H = 44;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const logo = gameText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 120, TEXT.title, 'title');
    gradientFill(logo, '#fff6a8', '#ffb330');
    this.tweens.add({
      targets: logo,
      scale: 1.05,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    const x = GAME_WIDTH / 2 - BAR_W / 2;
    const y = GAME_HEIGHT / 2 + 40;
    const frame = this.add.graphics();
    frame
      .fillStyle(0x000000, 0.2)
      .fillRoundedRect(x - 8, y - 2, BAR_W + 16, BAR_H + 16, (BAR_H + 16) / 2);
    frame
      .fillStyle(0xffffff, 1)
      .fillRoundedRect(x - 8, y - 8, BAR_W + 16, BAR_H + 16, (BAR_H + 16) / 2);
    const fill = this.add.graphics();
    const draw = (v: number): void => {
      const w = Math.max(BAR_H, BAR_W * v);
      fill.clear();
      fill.fillStyle(COLOR.green, 1).fillRoundedRect(x, y, w, BAR_H, BAR_H / 2);
      fill.fillStyle(0xffffff, 0.3).fillRoundedRect(x + 8, y + 6, w - 16, BAR_H * 0.35, 8);
    };
    draw(0);

    // The bar shows Phaser files and 3D models together.
    const progress = { files: 0, models: 0 };
    const update = (): void => draw(progress.files * 0.7 + progress.models * 0.3);
    this.load.on('progress', (v: number) => ((progress.files = v), update()));
    void loadModels((v) => ((progress.models = v), update()));
    this.load.on('loaderror', (file: Phaser.Loader.File) =>
      console.warn(`[boot] could not load ${file.key}`),
    );

    this.load.setPath('assets/');
    for (const r of RACE) this.load.image(r, `race/${r}.png`);
    for (const i of ICONS) this.load.image(`icon_${i}`, `icons/${i}.png`);
    for (const s of SFX) this.load.audio(`sfx_${s}`, `sfx/${s}.mp3`);
    for (const id of Object.keys(VOICE)) this.load.audio(`v_${id}`, `voice/${id}.mp3`);
  }

  async create(): Promise<void> {
    makeTextures(this);
    await loadModels();
    makeThumbs(this.textures);
    this.scene.start('Title');
  }
}
