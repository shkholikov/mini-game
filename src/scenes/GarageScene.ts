import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import type { TrackId } from '../i18n/ru';
import { TRACKS, TRACK_ORDER } from '../systems/raceLogic';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { GarageWorld } from '../three/GarageWorld';
import { PLAYER_CARS, type PlayerCar } from '../three/models';
import { getStage } from '../three/stage';
import { FONT, homeButton } from '../ui';

/** Осман: pick a car in the 3D showroom, then a track. */
export class GarageScene extends Phaser.Scene {
  private world!: GarageWorld;
  private zones: Phaser.GameObjects.Zone[] = [];
  private chosen = false;
  private starting = false;

  constructor() {
    super('Garage');
  }

  create(): void {
    this.chosen = false;
    this.starting = false;
    this.world = new GarageWorld();
    const stage = getStage();
    stage.show(this.world.scene, this.world.camera);
    this.events.once('shutdown', () => stage.hide());

    homeButton(this);
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
    void voice().say(`car_${name}`, 'pick_track');
    this.time.delayedCall(700, () => this.showTracks(name));
  }

  private showTracks(car: PlayerCar): void {
    const cups = save.get().osman.cups;
    TRACK_ORDER.forEach((id, i) => {
      const x = 480 + i * 320;
      const c = this.add.container(x, 1100);
      const track = TRACKS[id];
      const land = this.add.tileSprite(0, 0, 280, 280, track.land).setTileScale(0.6);
      const road = this.add.rectangle(0, 0, 130, 280, track.road);
      const line = this.add.rectangle(0, 0, 8, 280, 0xffffff, 0.7);
      const thumb = this.add.image(0, 50, `thumb_${car}`).setScale(0.55);
      const frame = this.add.rectangle(0, 0, 280, 280).setStrokeStyle(10, 0xffffff).setRounded(24);
      c.add([land, road, line, thumb, frame]);
      for (let k = 0; k < Math.min(cups[id], 5); k++)
        c.add(this.add.image(-100 + k * 50, -105, 'cup').setScale(0.3));
      if (cups[id] > 5)
        c.add(
          this.add
            .text(160, -105, `+${cups[id] - 5}`, {
              fontFamily: FONT,
              fontSize: '30px',
              color: '#fff',
            })
            .setOrigin(0.5),
        );
      c.setSize(280, 280).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: c, y: 700, delay: i * 120, duration: 500, ease: 'Back.out' });
      this.tweens.add({
        targets: thumb,
        y: 20,
        duration: 700 + i * 100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
      c.on('pointerdown', () => this.start(id, c));
    });
  }

  private start(track: TrackId, c: Phaser.GameObjects.Container): void {
    if (this.starting) return;
    this.starting = true;
    voice().sfx('tap');
    void voice().say(`track_${track}`);
    this.tweens.add({
      targets: c,
      scale: 1.1,
      duration: 200,
      yoyo: true,
      onComplete: () => this.scene.start('Race', { track }),
    });
  }
}
