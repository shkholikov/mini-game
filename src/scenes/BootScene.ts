import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { ru } from '../i18n/ru';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x6ec6ff, 0x6ec6ff, 0xd8f1ff, 0xd8f1ff, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.circle(GAME_WIDTH - 220, 170, 90, 0xffd84d);

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, ru.title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '120px',
        fontStyle: 'bold',
        color: '#2f3b52',
      })
      .setOrigin(0.5);
  }
}
