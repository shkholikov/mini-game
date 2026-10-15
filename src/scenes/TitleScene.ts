import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { TEXT } from '../i18n/ru';
import { totalCups } from '../systems/save';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { getStage } from '../three/stage';
import { TitleWorld } from '../three/TitleWorld';
import { COLOR, FONT, INK_HEX, candyButton, iconButton, sticker } from '../ui';

interface Side {
  zone: Phaser.GameObjects.Zone;
  button: Phaser.GameObjects.Container;
}

/** Distance between the three name buttons. */
const BUTTON_GAP = 420;

/** Shown once per visit: the Play tap unlocks sound and enters fullscreen. */
let started = false;

/** Floating 3D island: a Play screen first, then tap Осман's car, Сафия's bunny or Умар's tractor. */
export class TitleScene extends Phaser.Scene {
  private world!: TitleWorld;
  private sides: { osman?: Side; safia?: Side; umar?: Side } = {};
  private chosen = false;

  constructor() {
    super('Title');
  }

  create(): void {
    this.chosen = false;
    this.sides = {};
    this.world = new TitleWorld(save.get().osman.car);
    const stage = getStage();
    stage.show(this.world.scene, this.world.camera);
    this.events.once('shutdown', () => stage.hide());

    const logo = this.logo();
    if (started) {
      logo.setScale(0.75).setPosition(GAME_WIDTH / 2, 80);
      this.showChoices();
      return;
    }
    const play = iconButton(
      this,
      GAME_WIDTH / 2,
      600,
      'right',
      COLOR.green,
      () => this.begin(logo, play),
      220,
    );
    play.setDepth(30);
    this.tweens.add({
      targets: play,
      scale: 1.08,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /** "Осман и Сафия" with letters dropping in one by one. */
  private logo(): Phaser.GameObjects.Container {
    const c = this.add.container(GAME_WIDTH / 2, 300).setDepth(20);
    const style = {
      fontFamily: FONT.race,
      fontSize: '100px',
      color: '#ffffff',
      padding: { x: 6, y: 10 },
    };
    const letters = [...TEXT.title].map((ch) => {
      const t = this.add.text(0, 0, ch, style).setOrigin(0.5).setStroke(INK_HEX, 18);
      t.setShadow(0, 10, 'rgba(0,0,0,0.25)', 0, true, true);
      const g = t.context.createLinearGradient(0, 0, 0, t.height);
      g.addColorStop(0.2, '#fff6a8');
      g.addColorStop(0.8, '#ffb330');
      t.setFill(g);
      return t;
    });
    const widths = letters.map((t) => (t.text === ' ' ? 30 : t.width - 16));
    let x = -widths.reduce((a, b) => a + b, 0) / 2;
    letters.forEach((t, i) => {
      t.x = x + widths[i]! / 2;
      x += widths[i]!;
      t.y = -500;
      c.add(t);
      this.tweens.add({ targets: t, y: 0, delay: 300 + i * 60, duration: 600, ease: 'Bounce.out' });
      this.tweens.add({
        targets: t,
        y: -10,
        delay: 1400 + i * 80,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    });
    return c;
  }

  private begin(logo: Phaser.GameObjects.Container, play: Phaser.GameObjects.Container): void {
    started = true;
    // Fullscreen hides the browser bars on the tablet; not every browser allows it.
    try {
      if (!this.scale.isFullscreen) this.scale.startFullscreen();
      void (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
        .lock?.('landscape')
        .catch(() => undefined);
    } catch {
      // keep playing in the normal browser view
    }
    this.tweens.killTweensOf(play);
    this.tweens.add({
      targets: play,
      scale: 0,
      duration: 250,
      ease: 'Back.in',
      onComplete: () => play.destroy(),
    });
    this.tweens.add({
      targets: logo,
      y: 80,
      scale: 0.75,
      duration: 600,
      ease: 'Cubic.inOut',
      onComplete: () => this.showChoices(),
    });
  }

  private showChoices(): void {
    const p = save.get();
    this.sides.osman = this.side(
      TEXT.osman,
      COLOR.orange,
      `thumb_${p.osman.car}`,
      0.5,
      'cup',
      totalCups(p),
      0.36,
      () => {
        void voice().say('hi_osman');
        this.scene.start('Garage');
      },
    );
    this.sides.safia = this.side(
      TEXT.safia,
      COLOR.pink,
      'thumb_pet_bunny',
      0.45,
      'heart',
      p.safia.fed,
      0.7,
      () => {
        void voice().say('hi_safia');
        this.scene.start('Feed');
      },
    );
    this.sides.umar = this.side(TEXT.umar, COLOR.blue, 'thumb_tractor', 0.5, '', 0, 0, () => {
      void voice().say('hi_umar');
      this.scene.start('Tractor');
    });
    void voice().say('who_plays');
  }

  /** Big toy button with the kid's name, plus a tap zone over that kid's part of the island. */
  private side(
    name: string,
    color: number,
    image: string,
    imageScale: number,
    stickerIcon: string,
    count: number,
    stickerScale: number,
    onTap: () => void,
  ): Side {
    const go = (): void => {
      if (this.chosen) return;
      this.chosen = true;
      onTap();
    };
    const button = candyButton(this, 0, 0, {
      width: 370,
      height: 130,
      color,
      image,
      imageScale,
      label: name,
      fontSize: 58,
      onTap: go,
    });
    button.setDepth(25).setScale(0);
    if (count > 0) button.add(sticker(this, 170, -62, stickerIcon, count, stickerScale));
    this.tweens.add({ targets: button, scale: 1, duration: 500, ease: 'Back.out' });

    const zone = this.add.zone(0, 0, 400, 440).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      voice().sfx('tap');
      go();
    });
    return { zone, button };
  }

  update(_time: number, deltaMs: number): void {
    this.world.update(Math.min(deltaMs, 50) / 1000);
    const stage = getStage();
    // zones follow the 3D spots; the buttons sit in three fixed columns so they never overlap
    const place = (
      side: Side | undefined,
      spot: Parameters<typeof stage.toGame>[0],
      column: number,
    ): void => {
      if (!side) return;
      const s = stage.toGame(spot, this.game.canvas, GAME_WIDTH, GAME_HEIGHT);
      side.zone.setPosition(s.x, s.y);
      side.button.setPosition(
        GAME_WIDTH / 2 + column * BUTTON_GAP,
        GAME_HEIGHT - 110 + Math.sin(this.time.now / 450 + column) * 6,
      );
    };
    place(this.sides.osman, this.world.carSpot(), -1);
    place(this.sides.safia, this.world.bunnySpot(), 0);
    place(this.sides.umar, this.world.tractorSpot(), 1);
    stage.render();
  }
}
