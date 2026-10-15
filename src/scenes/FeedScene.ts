import Phaser from 'phaser';
import type { AnimalId, FruitId } from '../i18n/ru';
import { ANIMALS_PER_PARTY, makeParty, missAction, type FeedRound } from '../systems/feedLogic';
import { createRng } from '../systems/rng';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { confetti, drawMeadow, hearts, homeButton, iconButton, replayIcon } from '../ui';

const ANIMAL_POS = { x: 700, y: 410 };
const BUBBLE_POS = { x: 1080, y: 230 };
const FRUIT_Y = 770;
const FRUIT_SCALE = 0.45;
/** Dropping a dragged fruit this close to the animal counts as feeding it. */
const FEED_RADIUS = 280;

interface FruitButton {
  id: FruitId;
  c: Phaser.GameObjects.Container;
  home: { x: number; y: number };
  glow: Phaser.GameObjects.Arc;
}

/** Сафия: feed each animal the fruit it wants. No timers, no losing. */
export class FeedScene extends Phaser.Scene {
  private party: FeedRound[] = [];
  private index = 0;
  private misses = 0;
  private busy = true;
  private animal!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Container;
  private fruits: FruitButton[] = [];
  private slots: Phaser.GameObjects.Arc[] = [];
  private fedHeads: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Feed');
  }

  create(): void {
    drawMeadow(this);
    homeButton(this);
    this.input.dragDistanceThreshold = 14;
    this.party = makeParty(createRng(Date.now()));
    this.index = 0;
    this.fedHeads = [];
    this.slots = Array.from({ length: ANIMALS_PER_PARTY }, (_, i) =>
      this.add.circle(800 + (i - 2) * 120, 80, 48, 0xe8f6ff, 0.9).setStrokeStyle(5, 0xffffff),
    );
    this.time.delayedCall(1600, () => this.startRound());
  }

  private get round(): FeedRound {
    return this.party[this.index]!;
  }

  private startRound(): void {
    this.misses = 0;
    this.busy = true;
    const { animal, want, options } = this.round;

    this.animal = this.add
      .image(1900, ANIMAL_POS.y, `animal_${animal}`)
      .setScale(1.1)
      .setInteractive({ useHandCursor: true });
    this.animal.on('pointerdown', () => {
      if (this.busy) return;
      this.wiggle();
      voice().say(`want_${animal}_${want}`);
    });
    this.tweens.add({ targets: this.animal, x: ANIMAL_POS.x, duration: 900, ease: 'Back.out' });
    this.tweens.add({
      targets: this.animal,
      y: ANIMAL_POS.y - 16,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });

    this.bubble = this.add.container(BUBBLE_POS.x, BUBBLE_POS.y).setScale(0);
    this.bubble.add([
      this.add.circle(-150, 120, 14, 0xffffff),
      this.add.circle(-115, 88, 22, 0xffffff),
      this.add.ellipse(0, 0, 270, 220, 0xffffff),
      this.add.image(0, 0, `fruit_${want}`).setScale(0.36),
    ]);
    this.tweens.add({
      targets: this.bubble,
      scale: 1,
      delay: 800,
      duration: 400,
      ease: 'Back.out',
    });

    const xs = options.length === 2 ? [600, 1000] : [460, 800, 1140];
    this.fruits = options.map((id, i) => this.makeFruit(id, xs[i]!, i));

    this.time.delayedCall(1000, () => void voice().say(`want_${animal}_${want}`));
    // Fruits are tappable once they have landed; she doesn't have to wait for the voice.
    this.time.delayedCall(1300, () => (this.busy = false));
  }

  private makeFruit(id: FruitId, x: number, i: number): FruitButton {
    const c = this.add.container(x, 1100).setDepth(10);
    const glow = this.add.circle(0, 0, 132, 0xffe14d).setAlpha(0);
    c.add([
      glow,
      this.add.circle(0, 6, 112, 0x000000, 0.12),
      this.add.circle(0, 0, 112, 0xffffff, 0.92),
      this.add.image(0, 0, `fruit_${id}`).setScale(FRUIT_SCALE),
    ]);
    c.setSize(240, 240).setInteractive({ useHandCursor: true, draggable: true });
    this.tweens.add({
      targets: c,
      y: FRUIT_Y,
      delay: 1100 + i * 120,
      duration: 500,
      ease: 'Back.out',
    });
    const fruit: FruitButton = { id, c, home: { x, y: FRUIT_Y }, glow };

    let dragged = false;
    c.on('pointerdown', () => (dragged = false));
    c.on('dragstart', () => {
      if (this.busy) return;
      dragged = true;
      c.setDepth(50);
      voice().say(`fruit_${id}`);
      this.tweens.add({ targets: c, scale: 1.12, duration: 120 });
    });
    c.on('drag', (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
      if (!this.busy) c.setPosition(dx, dy);
    });
    c.on('dragend', () => {
      if (this.busy) return;
      c.setDepth(10);
      if (Phaser.Math.Distance.Between(c.x, c.y, this.animal.x, this.animal.y) < FEED_RADIUS)
        this.feed(fruit);
      else this.returnHome(fruit);
    });
    c.on('pointerup', () => {
      if (!dragged && !this.busy) this.feed(fruit);
    });
    return fruit;
  }

  private returnHome(f: FruitButton): void {
    this.tweens.add({
      targets: f.c,
      x: f.home.x,
      y: f.home.y,
      scale: 1,
      duration: 350,
      ease: 'Back.out',
    });
  }

  private feed(f: FruitButton): void {
    this.busy = true;
    const mouth = { x: this.animal.x, y: this.animal.y + 60 };
    voice().sfx('whoosh', 0.4);
    if (f.id === this.round.want) {
      this.tweens.add({
        targets: f.c,
        x: mouth.x,
        y: mouth.y,
        scale: 0.2,
        duration: 450,
        ease: 'Quad.in',
        onComplete: () => {
          f.c.setVisible(false);
          void this.happy();
        },
      });
    } else {
      this.tweens.add({
        targets: f.c,
        x: mouth.x + 180,
        y: mouth.y + 40,
        duration: 380,
        ease: 'Quad.out',
        onComplete: () => void this.notThis(f),
      });
    }
  }

  private async happy(): Promise<void> {
    const { animal } = this.round;
    voice().sfx('correct');
    hearts(this, this.animal.x, this.animal.y - 60, 10);
    this.tweens.add({
      targets: this.animal,
      scaleY: 0.95,
      scaleX: 1.2,
      duration: 120,
      yoyo: true,
      repeat: 3,
    });
    this.tweens.add({ targets: this.bubble, scale: 0, duration: 250 });
    save.update((p) => void (p.safia.fed += 1));
    await voice().say(`snd_${animal}`, this.index % 2 ? 'yum_safia' : 'yum');
    this.flyToSlot(animal);
  }

  private async notThis(f: FruitButton): Promise<void> {
    const { animal, want } = this.round;
    this.misses += 1;
    const action = missAction(this.misses);
    voice().sfx('soft', 0.5);
    this.wiggle();
    this.returnHome(f);
    if (action === 'help') {
      await voice().say('hint');
      this.feed(this.fruits.find((x) => x.id === want)!);
      return;
    }
    if (action === 'highlight') this.highlight(want);
    await voice().say('want_other', `want_${animal}_${want}`);
    this.busy = false;
  }

  private highlight(want: FruitId): void {
    const f = this.fruits.find((x) => x.id === want);
    if (!f) return;
    f.glow.setAlpha(0.9);
    this.tweens.add({
      targets: f.c,
      scale: 1.15,
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private wiggle(): void {
    this.tweens.add({
      targets: this.animal,
      angle: { from: -8, to: 8 },
      duration: 90,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.animal.setAngle(0),
    });
  }

  private flyToSlot(animal: AnimalId): void {
    const slot = this.slots[this.index]!;
    for (const f of this.fruits)
      this.tweens.add({ targets: f.c, y: 1100, duration: 300, onComplete: () => f.c.destroy() });
    this.tweens.killTweensOf(this.animal);
    this.tweens.add({
      targets: this.animal,
      x: slot.x,
      y: slot.y,
      scale: 0.3,
      duration: 700,
      ease: 'Cubic.inOut',
      onComplete: () => {
        this.animal.destroy();
        this.bubble.destroy();
        this.fedHeads.push(this.add.image(slot.x, slot.y, `animal_${animal}`).setScale(0.3));
        voice().sfx('pop');
        this.index += 1;
        if (this.index < this.party.length) this.startRound();
        else void this.partyTime();
      },
    });
  }

  private async partyTime(): Promise<void> {
    save.update((p) => void (p.safia.parties += 1));
    confetti(this);
    this.fedHeads.forEach((head, i) => {
      this.tweens.add({
        targets: head,
        x: 800 + (i - 2) * 230,
        y: 430,
        scale: 0.75,
        duration: 700,
        delay: i * 120,
        ease: 'Back.out',
      });
      this.tweens.add({
        targets: head,
        y: 380,
        duration: 350,
        delay: 900 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    });
    await voice().say('all_fed');
    iconButton(this, 800, 740, 0x5cb85c, replayIcon, () => this.scene.restart(), 80);
  }
}
