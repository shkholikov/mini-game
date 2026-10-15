import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { TEXT } from '../i18n/ru';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { GarageWorld } from '../three/GarageWorld';
import { PLAYER_CARS, type PlayerCar } from '../three/models';
import { getStage } from '../three/stage';
import { gameText, homeButton } from '../ui';

/** Осман: pick a car in the 3D showroom, then drive it on the island. */
export class GarageScene extends Phaser.Scene {
  private world!: GarageWorld;
  private zones: Phaser.GameObjects.Zone[] = [];
  private chosen = false;

  constructor() {
    super('Garage');
  }

  create(): void {
    this.chosen = false;
    this.world = new GarageWorld();
    const stage = getStage();
    stage.show(this.world.scene, this.world.camera);
    this.events.once('shutdown', () => stage.hide());

    homeButton(this);
    const sign = gameText(this, GAME_WIDTH / 2, 86, TEXT.garage, 'heading');
    this.tweens.add({
      targets: sign,
      angle: { from: -2, to: 2 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.zones = PLAYER_CARS.map((name, i) => {
      const z = this.add.zone(0, 0, 230, 260).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.pickCar(name, i));
      return z;
    });
    const current = PLAYER_CARS.indexOf(save.get().osman.car);
    if (current >= 0) this.world.select(current);

    this.time.delayedCall(700, () => void voice().say('garage'));
  }

  update(_time: number, deltaMs: number): void {
    this.world.update(Math.min(deltaMs, 50) / 1000);
    const stage = getStage();
    // Keep the tap zones over the cars, whatever the screen shape.
    this.zones.forEach((z, i) => {
      const p = stage.toGame(this.world.carAnchor(i), this.game.canvas, GAME_WIDTH, GAME_HEIGHT);
      z.setPosition(p.x, p.y);
    });
    stage.render();
  }

  private pickCar(name: PlayerCar, index: number): void {
    if (this.chosen) return;
    this.chosen = true;
    voice().sfx('tap');
    this.world.select(index);
    save.update((p) => void (p.osman.car = name));
    void voice().say(`car_${name}`, 'lets_go');
    this.time.delayedCall(1600, () => this.scene.start('Island'));
  }
}
