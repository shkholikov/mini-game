import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { TEXT, type TrackId } from '../i18n/ru';
import { TRACKS, TRACK_ORDER } from '../systems/raceLogic';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { GarageWorld } from '../three/GarageWorld';
import { PLAYER_CARS, type PlayerCar } from '../three/models';
import { getStage } from '../three/stage';
import { gameText, homeButton, sticker } from '../ui';

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
    void voice().say(`car_${name}`, 'pick_track');
    this.time.delayedCall(700, () => this.showTracks(name));
  }

  private showTracks(car: PlayerCar): void {
    const cups = save.get().osman.cups;
    TRACK_ORDER.forEach((id, i) => {
      const x = 480 + i * 320;
      const c = this.add.container(x, 1100);
      const track = TRACKS[id];
      // card with a 3D-ish edge, a mini road and the chosen car
      const base = this.add.graphics();
      base.fillStyle(0x000000, 0.2).fillRoundedRect(-140, -132, 280, 300, 32);
      base.fillStyle(0x1f2a52, 1).fillRoundedRect(-140, -140, 280, 300, 32);
      const land = this.add.tileSprite(0, -10, 256, 230, track.land).setTileScale(0.6);
      const road = this.add.rectangle(0, -10, 110, 230, track.road);
      const line = this.add.rectangle(0, -10, 8, 230, 0xffffff, 0.7);
      const thumb = this.add.image(0, 30, `thumb_${car}`).setScale(0.5);
      const frame = this.add.graphics();
      frame.lineStyle(8, 0xffffff, 1).strokeRoundedRect(-128, -125, 256, 230, 22);
      const label = gameText(this, 0, 128, TEXT.tracks[id], 'label', { size: 38 });
      c.add([base, land, road, line, thumb, frame, label]);
      if (cups[id] > 0) c.add(sticker(this, 115, -120, 'cup', cups[id], 0.36));
      c.setSize(280, 300).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: c, y: 690, delay: i * 120, duration: 500, ease: 'Back.out' });
      this.tweens.add({
        targets: thumb,
        y: 0,
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
