import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/game';
import { BootScene } from './scenes/BootScene';
import { installTouchGuards } from './systems/TouchGuards';

installTouchGuards();

export const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8fd3ff',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: {
    activePointers: 3,
  },
  disableContextMenu: true,
  scene: [BootScene],
});
