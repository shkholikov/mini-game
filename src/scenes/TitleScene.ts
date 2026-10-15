import Phaser from 'phaser';
import { GAME_WIDTH } from '../config/game';
import { TEXT } from '../i18n/ru';
import { save } from '../systems/services';
import { totalCups } from '../systems/save';
import { voice } from '../systems/voice';
import { FONT, INK, drawMeadow } from '../ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    drawMeadow(this);
    const p = save.get();

    this.add
      .text(GAME_WIDTH / 2, 90, TEXT.title, {
        fontFamily: FONT,
        fontSize: '84px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#2f3b52', 14);

    this.card(
      520,
      470,
      0xff8a3d,
      TEXT.osman,
      (c) => {
        const car = this.add.image(0, -40, `thumb_${p.osman.car}`).setScale(1.6);
        c.add(car);
        this.tweens.add({
          targets: car,
          x: 20,
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
        this.badge(c, 'cup', totalCups(p), 0.42);
      },
      () => {
        voice().say('hi_osman');
        this.scene.start('Garage');
      },
    );

    this.card(
      1080,
      470,
      0xf06aa0,
      TEXT.safia,
      (c) => {
        const rabbit = this.add.image(-40, -40, 'animal_rabbit').setScale(0.75);
        const apple = this.add.image(90, 20, 'fruit_apple').setScale(0.32);
        c.add([rabbit, apple]);
        this.tweens.add({
          targets: rabbit,
          y: -60,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
        this.badge(c, 'heart', p.safia.fed, 0.9);
      },
      () => {
        voice().say('hi_safia');
        this.scene.start('Feed');
      },
    );

    voice().say('who_plays');
  }

  private card(
    x: number,
    y: number,
    color: number,
    name: string,
    fill: (c: Phaser.GameObjects.Container) => void,
    onTap: () => void,
  ): void {
    const c = this.add.container(x, y);
    c.add(this.add.rectangle(0, 12, 480, 540, 0x000000, 0.15).setRounded(48));
    c.add(this.add.rectangle(0, 0, 480, 540, color).setRounded(48).setStrokeStyle(10, 0xffffff));
    c.add(
      this.add
        .text(0, 200, name, {
          fontFamily: FONT,
          fontSize: '64px',
          fontStyle: 'bold',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setStroke('#2f3b52', 10),
    );
    fill(c);
    c.setSize(480, 540).setInteractive({ useHandCursor: true });
    this.tweens.add({
      targets: c,
      angle: { from: -1.5, to: 1.5 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    let used = false;
    c.on('pointerdown', () => {
      if (used) return;
      used = true;
      voice().sfx('tap');
      this.tweens.add({ targets: c, scale: 0.92, duration: 90, yoyo: true, onComplete: onTap });
    });
  }

  private badge(c: Phaser.GameObjects.Container, icon: string, count: number, scale: number): void {
    if (count <= 0) return;
    c.add(this.add.circle(160, -210, 58, 0xffffff));
    c.add(this.add.image(160, -222, icon).setScale(scale));
    c.add(
      this.add
        .text(160, -176, String(count), {
          fontFamily: FONT,
          fontSize: '34px',
          fontStyle: 'bold',
          color: '#' + INK.toString(16),
        })
        .setOrigin(0.5),
    );
  }
}
