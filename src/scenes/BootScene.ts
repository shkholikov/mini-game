import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { VOICE } from '../i18n/ru';
import { ANIMAL_IDS, FRUIT_IDS } from '../systems/feedLogic';
import { loadModels } from '../three/models';
import { makeCarThumbs } from '../three/thumbs';
import { makeTextures } from '../ui';

const SFX = ['correct', 'tap', 'pop', 'coin', 'soft', 'whoosh', 'drop'];
/** 2D race art still used: countdown lights and the land tiles on the garage track cards. */
const RACE = ['lights', 'land_grass', 'land_sand'];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const bar = this.add
      .rectangle(GAME_WIDTH / 2 - 300, GAME_HEIGHT / 2, 0, 40, 0xffd84d)
      .setOrigin(0, 0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 608, 48).setStrokeStyle(6, 0xffffff);
    // The bar shows Phaser files and 3D models together.
    const progress = { files: 0, models: 0 };
    const draw = (): void =>
      void (bar.width = 600 * (progress.files * 0.7 + progress.models * 0.3));
    this.load.on('progress', (v: number) => ((progress.files = v), draw()));
    void loadModels((v) => ((progress.models = v), draw()));
    this.load.on('loaderror', (file: Phaser.Loader.File) =>
      console.warn(`[boot] could not load ${file.key}`),
    );

    this.load.setPath('assets/');
    for (const a of ANIMAL_IDS) this.load.image(`animal_${a}`, `animals/${a}.png`);
    // Fruits are vectors: render at 2× and show at 0.5 so they stay sharp on big screens.
    for (const f of FRUIT_IDS)
      this.load.svg(`fruit_${f}`, `fruits/${f}.svg`, { width: 400, height: 400 });
    for (const r of RACE) this.load.image(r, `race/${r}.png`);
    for (const s of SFX) this.load.audio(`sfx_${s}`, `sfx/${s}.mp3`);
    for (const id of Object.keys(VOICE)) this.load.audio(`v_${id}`, `voice/${id}.mp3`);
  }

  async create(): Promise<void> {
    makeTextures(this);
    await loadModels();
    makeCarThumbs(this.textures);
    this.scene.start('Title');
  }
}
