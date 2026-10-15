import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { TEXT } from '../i18n/ru';
import { totalCups } from '../systems/save';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { getStage } from '../three/stage';
import { TitleWorld } from '../three/TitleWorld';
import { FONT } from '../ui';

interface Side {
  zone: Phaser.GameObjects.Zone;
  plate: Phaser.GameObjects.Container;
}

/** Floating 3D island: tap Осман's racing car or Сафия's bunny. */
export class TitleScene extends Phaser.Scene {
  private world!: TitleWorld;
  private osman!: Side;
  private safia!: Side;
  private chosen = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.chosen = false;
    const p = save.get();
    this.world = new TitleWorld(p.osman.car);
    const stage = getStage();
    stage.show(this.world.scene, this.world.camera);
    this.events.once('shutdown', () => stage.hide());

    this.add
      .text(GAME_WIDTH / 2, 90, TEXT.title, {
        fontFamily: FONT,
        fontSize: '84px',
        fontStyle: 'bold',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setStroke('#2f3b52', 14);

    this.osman = this.side(TEXT.osman, 0xff8a3d, 'cup', totalCups(p), 0.42, () => {
      void voice().say('hi_osman');
      this.scene.start('Garage');
    });
    this.safia = this.side(TEXT.safia, 0xf06aa0, 'heart', p.safia.fed, 0.9, () => {
      void voice().say('hi_safia');
      this.scene.start('Feed');
    });

    void voice().say('who_plays');
  }

  /** Name plate with an optional score badge, plus a big tap zone over that half of the island. */
  private side(
    name: string,
    color: number,
    icon: string,
    count: number,
    iconScale: number,
    onTap: () => void,
  ): Side {
    const plate = this.add.container(0, 0).setDepth(10);
    const label = this.add
      .text(0, 0, name, { fontFamily: FONT, fontSize: '56px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    plate.add([
      this.add.rectangle(0, 6, label.width + 70, 96, 0x000000, 0.2).setRounded(48),
      this.add
        .rectangle(0, 0, label.width + 70, 96, color)
        .setRounded(48)
        .setStrokeStyle(8, 0xffffff),
      label,
    ]);
    if (count > 0) {
      const bx = label.width / 2 + 60;
      plate.add([
        this.add.circle(bx, -40, 46, 0xffffff),
        this.add.image(bx, -50, icon).setScale(iconScale * 0.8),
        this.add
          .text(bx, -14, String(count), {
            fontFamily: FONT,
            fontSize: '28px',
            fontStyle: 'bold',
            color: '#2f3b52',
          })
          .setOrigin(0.5),
      ]);
    }

    const zone = this.add.zone(0, 0, 560, 520).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (this.chosen) return;
      this.chosen = true;
      voice().sfx('tap');
      this.tweens.add({
        targets: plate,
        scale: 1.15,
        duration: 120,
        yoyo: true,
        onComplete: onTap,
      });
    });
    return { zone, plate };
  }

  update(_time: number, deltaMs: number): void {
    this.world.update(Math.min(deltaMs, 50) / 1000);
    const stage = getStage();
    const place = (side: Side, spot: Parameters<typeof stage.toGame>[0]): void => {
      const s = stage.toGame(spot, this.game.canvas, GAME_WIDTH, GAME_HEIGHT);
      side.zone.setPosition(s.x, s.y);
      // gentle bob, under the object it names
      side.plate.setPosition(
        s.x,
        Math.min(s.y + 250, GAME_HEIGHT - 90) + Math.sin(this.time.now / 450) * 8,
      );
    };
    place(this.osman, this.world.carSpot());
    place(this.safia, this.world.bunnySpot());
    stage.render();
  }
}
