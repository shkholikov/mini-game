import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import type { CarColor, TrackId } from '../i18n/ru';
import { TRACKS, TRACK_ORDER } from '../systems/raceLogic';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { FONT, homeButton } from '../ui';
import { CAR_COLORS_ALL } from './BootScene';

/** Осман: pick a car, then a track. */
export class GarageScene extends Phaser.Scene {
  private chosen = false;
  private starting = false;

  constructor() {
    super('Garage');
  }

  create(): void {
    this.chosen = false;
    this.starting = false;
    this.drawGarage();
    homeButton(this);
    const current = save.get().osman.car;

    CAR_COLORS_ALL.forEach((color, i) => {
      const x = 400 + i * 200;
      const pad = this.add.ellipse(x, 400, 170, 60, 0x000000, 0.25);
      const car = this.add
        .image(x, 330, `car_${color}_1`)
        .setScale(1.7)
        .setInteractive({ useHandCursor: true });
      if (color === current)
        this.tweens.add({
          targets: car,
          y: 315,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
      car.on('pointerdown', () => this.pickCar(color, car, pad));
    });

    this.time.delayedCall(700, () => void voice().say('garage'));
  }

  private drawGarage(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x4a5568, 0x4a5568, 0x2d3748, 0x2d3748, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x718096, 1).fillRect(0, 430, GAME_WIDTH, 30);
    g.fillStyle(0x1a202c, 1).fillRect(0, 460, GAME_WIDTH, GAME_HEIGHT - 460);
    for (let x = 0; x < GAME_WIDTH; x += 80)
      g.fillStyle(x % 160 ? 0xf6c445 : 0x1a202c, 1).fillRect(x, 430, 80, 14);
    this.add.image(120, 820, 'tires_white').setScale(1.4);
    this.add.image(1480, 820, 'tires_red').setScale(1.4);
  }

  private pickCar(
    color: CarColor,
    car: Phaser.GameObjects.Image,
    pad: Phaser.GameObjects.Ellipse,
  ): void {
    if (this.chosen) return;
    this.chosen = true;
    voice().sfx('tap');
    save.update((p) => void (p.osman.car = color));
    this.tweens.killTweensOf(car);
    pad.setFillStyle(0xffd84d, 0.6);
    this.tweens.add({ targets: car, angle: 360, scale: 2.1, duration: 600, ease: 'Back.out' });
    void voice().say(`car_${color}`, 'pick_track');
    this.time.delayedCall(700, () => this.showTracks(color));
  }

  private showTracks(color: CarColor): void {
    const cups = save.get().osman.cups;
    TRACK_ORDER.forEach((id, i) => {
      const x = 480 + i * 320;
      const c = this.add.container(x, 1100);
      const track = TRACKS[id];
      const land = this.add.tileSprite(0, 0, 280, 300, track.land).setTileScale(0.6);
      const road = this.add.rectangle(0, 0, 130, 300, track.road);
      const line = this.add.rectangle(0, 0, 8, 300, 0xffffff, 0.7);
      const car = this.add.image(0, 70, `car_${color}_1`).setScale(0.8);
      const frame = this.add.rectangle(0, 0, 280, 300).setStrokeStyle(10, 0xffffff).setRounded(24);
      c.add([land, road, line, car, frame]);
      for (let k = 0; k < Math.min(cups[id], 5); k++)
        c.add(this.add.image(-100 + k * 50, -120, 'cup').setScale(0.3));
      if (cups[id] > 5)
        c.add(
          this.add
            .text(160, -120, `+${cups[id] - 5}`, {
              fontFamily: FONT,
              fontSize: '30px',
              color: '#fff',
            })
            .setOrigin(0.5),
        );
      c.setSize(280, 300).setInteractive({ useHandCursor: true });
      this.tweens.add({ targets: c, y: 680, delay: i * 120, duration: 500, ease: 'Back.out' });
      this.tweens.add({
        targets: car,
        y: 40,
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
