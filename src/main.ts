import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import '@fontsource/russo-one/400.css';
import Phaser from 'phaser';
import './style.css';
import { GAME_HEIGHT, GAME_WIDTH } from './config/game';
import { TEXT } from './i18n/ru';
import { BootScene } from './scenes/BootScene';
import { FeedScene } from './scenes/FeedScene';
import { GarageScene } from './scenes/GarageScene';
import { IslandScene } from './scenes/IslandScene';
import { RaceScene } from './scenes/RaceScene';
import { TitleScene } from './scenes/TitleScene';
import { TractorScene } from './scenes/TractorScene';
import { setSongPortrait } from './systems/song';
import { installTouchGuards } from './systems/TouchGuards';
import { initVoice } from './systems/voice';
import { loadFonts } from './ui/theme';

installTouchGuards();
void navigator.storage?.persist?.().catch(() => undefined);

document.getElementById('rotate-title')!.textContent = TEXT.rotateTitle;
document.getElementById('rotate-sub')!.textContent = TEXT.rotateSub;

async function start(): Promise<void> {
  await loadFonts();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    // Transparent so the Three.js canvas behind it shows through.
    transparent: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      // Fullscreen the container holding both canvases, so the 3D world stays visible.
      fullscreenTarget: 'game',
    },
    input: { activePointers: 3 },
    disableContextMenu: true,
    scene: [BootScene, TitleScene, FeedScene, GarageScene, IslandScene, RaceScene, TractorScene],
  });
  initVoice(game);

  // Upright device: pause the game and its sounds until it is turned back.
  const portrait = window.matchMedia('(orientation: portrait)');
  const apply = (): void => {
    setSongPortrait(portrait.matches);
    if (portrait.matches) {
      game.sound.pauseAll();
      game.loop.sleep();
    } else {
      game.loop.wake();
      game.sound.resumeAll();
    }
  };
  portrait.addEventListener('change', apply);
  game.events.once('ready', apply);

  // Handle for e2e tests and debugging in the browser console.
  (window as unknown as { __game: Phaser.Game }).__game = game;
}

void start();
