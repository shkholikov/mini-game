import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { VOICE } from '../i18n/ru';
import { ANIMAL_IDS, FRUIT_IDS } from '../systems/feedLogic';
import { makeTextures } from '../ui';

const SFX = ['correct', 'tap', 'pop', 'coin', 'soft', 'whoosh', 'drop'];
const RACE = [
  'arrow_yellow',
  'barrel_blue',
  'barrel_red',
  'cone_straight',
  'land_dirt',
  'land_grass',
  'land_sand',
  'lights',
  'oil',
  'rock1',
  'rock2',
  'tent_blue',
  'tent_red',
  'tires_red',
  'tires_white',
  'tree_large',
  'tree_small',
  'tribune_full',
];
export const CAR_COLORS_ALL = ['red', 'blue', 'green', 'yellow', 'black'] as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const bar = this.add
      .rectangle(GAME_WIDTH / 2 - 300, GAME_HEIGHT / 2, 0, 40, 0xffd84d)
      .setOrigin(0, 0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 608, 48).setStrokeStyle(6, 0xffffff);
    this.load.on('progress', (v: number) => (bar.width = 600 * v));
    this.load.on('loaderror', (file: Phaser.Loader.File) =>
      console.warn(`[boot] could not load ${file.key}`),
    );

    this.load.setPath('assets/');
    for (const a of ANIMAL_IDS) this.load.image(`animal_${a}`, `animals/${a}.png`);
    // Fruits are vectors: render at 2× and show at 0.5 so they stay sharp on big screens.
    for (const f of FRUIT_IDS)
      this.load.svg(`fruit_${f}`, `fruits/${f}.svg`, { width: 400, height: 400 });
    for (const c of CAR_COLORS_ALL)
      for (let n = 1; n <= 5; n++) this.load.image(`car_${c}_${n}`, `cars/car_${c}_${n}.png`);
    for (const r of RACE) this.load.image(r, `race/${r}.png`);
    for (const s of SFX) this.load.audio(`sfx_${s}`, `sfx/${s}.mp3`);
    for (const id of Object.keys(VOICE)) this.load.audio(`v_${id}`, `voice/${id}.mp3`);
  }

  create(): void {
    makeTextures(this);
    this.scene.start('Title');
  }
}
