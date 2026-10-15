import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/game';
import { BootScene } from './scenes/BootScene';
import { FeedScene } from './scenes/FeedScene';
import { GarageScene } from './scenes/GarageScene';
import { RaceScene } from './scenes/RaceScene';
import { TitleScene } from './scenes/TitleScene';
import { installTouchGuards } from './systems/TouchGuards';
import { initVoice } from './systems/voice';

installTouchGuards();
void navigator.storage?.persist?.().catch(() => undefined);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#8fd3ff',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  input: { activePointers: 3 },
  disableContextMenu: true,
  scene: [BootScene, TitleScene, FeedScene, GarageScene, RaceScene],
});

initVoice(game);

// Handle for e2e tests and debugging in the browser console.
(window as unknown as { __game: Phaser.Game }).__game = game;
