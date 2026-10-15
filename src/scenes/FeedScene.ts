import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { ANIMALS_PER_PARTY, makeParty, missAction, type FeedRound } from '../systems/feedLogic';
import { createRng } from '../systems/rng';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { FEED_DISTANCE, FeedWorld } from '../three/FeedWorld';
import { getStage, rayFromGame } from '../three/stage';
import { COLOR, confetti, hearts, homeButton, iconButton } from '../ui';

/** Сафия: feed each animal the fruit it wants, in a 3D meadow. No timers, no losing. */
export class FeedScene extends Phaser.Scene {
  private world!: FeedWorld;
  private party: FeedRound[] = [];
  private index = 0;
  private misses = 0;
  private busy = true;
  private zones: Phaser.GameObjects.Zone[] = [];
  private animalZone!: Phaser.GameObjects.Zone;
  private bubble!: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('Feed');
  }

  create(): void {
    this.world = new FeedWorld();
    const stage = getStage();
    stage.show(this.world.scene, this.world.camera);
    this.events.once('shutdown', () => stage.hide());

    homeButton(this);
    this.input.dragDistanceThreshold = 14;
    this.party = makeParty(createRng(Date.now()));
    this.index = 0;
    this.zones = [];
    this.slots = Array.from({ length: ANIMALS_PER_PARTY }, (_, i) =>
      this.slotFrame(800 + (i - 2) * 124, 86),
    );

    this.bubble = this.add.container(0, 0).setScale(0).setDepth(20);
    this.animalZone = this.add.zone(0, 0, 300, 340).setInteractive({ useHandCursor: true });
    this.animalZone.on('pointerdown', () => {
      if (this.busy) return;
      const { animal, want } = this.round;
      void voice().say(`want_${animal}_${want}`);
    });

    void this.startRound();
  }

  private get round(): FeedRound {
    return this.party[this.index]!;
  }

  private async startRound(): Promise<void> {
    this.misses = 0;
    this.busy = true;
    const { animal, want, options } = this.round;
    await this.world.bringAnimal(animal);

    this.bubble.removeAll(true);
    this.bubble.add([
      this.add.circle(-150, 120, 14, 0xffffff),
      this.add.circle(-115, 88, 22, 0xffffff),
      this.add.ellipse(6, 12, 260, 210, 0x000000, 0.15),
      this.add.ellipse(0, 0, 260, 210, 0xffffff).setStrokeStyle(6, COLOR.yellow),
      this.add.image(0, 0, `thumb_fruit_${want}`).setScale(0.55),
    ]);
    this.tweens.add({ targets: this.bubble, scale: 1, duration: 400, ease: 'Back.out' });
    void voice().say(`want_${animal}_${want}`);

    await this.world.setFruits(options);
    this.zones = options.map((_, i) => this.makeFruitZone(i));
    this.busy = false;
  }

  private makeFruitZone(i: number): Phaser.GameObjects.Zone {
    const z = this.add
      .zone(0, 0, 230, 230)
      .setInteractive({ useHandCursor: true, draggable: true });
    let dragged = false;
    z.on('pointerdown', () => (dragged = false));
    z.on('dragstart', () => {
      if (this.busy) return;
      dragged = true;
      voice().sfx('pop', 0.4);
      void voice().say(`fruit_${this.world.fruitIds()[i]}`);
    });
    z.on('drag', (p: Phaser.Input.Pointer) => {
      if (this.busy) return;
      this.world.dragFruit(
        i,
        rayFromGame(getStage(), p.x, p.y, this.game.canvas, GAME_WIDTH, GAME_HEIGHT),
      );
    });
    z.on('dragend', () => {
      if (this.busy) return;
      if (this.world.distanceToAnimal(i) < FEED_DISTANCE) void this.feed(i);
      else void this.world.returnFruit(i);
    });
    z.on('pointerup', () => {
      if (!dragged && !this.busy) void this.feed(i);
    });
    return z;
  }

  update(_time: number, deltaMs: number): void {
    this.world.update(Math.min(deltaMs, 50) / 1000);
    const stage = getStage();
    const toGame = (v: Parameters<typeof stage.toGame>[0]) =>
      stage.toGame(v, this.game.canvas, GAME_WIDTH, GAME_HEIGHT);
    // Tap zones and the thought bubble follow the 3D objects on any screen shape.
    this.zones.forEach((z, i) => {
      const p = toGame(this.world.fruitAnchor(i));
      z.setPosition(p.x, p.y);
    });
    const head = toGame(this.world.animalHead());
    this.bubble.setPosition(head.x + 200, head.y - 30);
    const body = toGame(this.world.animalCenter());
    this.animalZone.setPosition(body.x, body.y);
    stage.render();
  }

  private async feed(i: number): Promise<void> {
    this.busy = true;
    const { animal, want } = this.round;
    const fruitId = this.world.fruitIds()[i];
    voice().sfx('whoosh', 0.4);

    if (fruitId === want) {
      await this.world.throwFruit(i, true);
      voice().sfx('correct');
      const mouth = getStage().toGame(
        this.world.animalMouth(),
        this.game.canvas,
        GAME_WIDTH,
        GAME_HEIGHT,
      );
      hearts(this, mouth.x, mouth.y - 60, 12);
      this.tweens.add({ targets: this.bubble, scale: 0, duration: 250 });
      save.update((p) => void (p.safia.fed += 1));
      void voice().say(`snd_${animal}`, this.index % 2 ? 'yum_safia' : 'yum');
      await this.world.eat();
      await this.world.happy();
      this.fillSlot(animal);
      for (const z of this.zones) z.destroy();
      this.zones = [];
      await Promise.all([this.world.clearFruits(), this.world.sendToFarm()]);
      this.index += 1;
      if (this.index < this.party.length) void this.startRound();
      else void this.partyTime();
      return;
    }

    this.misses += 1;
    const action = missAction(this.misses);
    voice().sfx('soft', 0.5);
    await Promise.all([this.world.throwFruit(i, false), this.world.refuse()]);
    if (action === 'help') {
      await voice().say('hint');
      void this.feed(this.world.fruitIds().indexOf(want));
      return;
    }
    if (action === 'highlight') this.world.highlight(this.world.fruitIds().indexOf(want));
    await voice().say('want_other', `want_${animal}_${want}`);
    this.busy = false;
  }

  /** Empty sticker frame in the top row; fed animals pop into it. */
  private slotFrame(x: number, y: number): Phaser.GameObjects.Arc {
    this.add.circle(x, y + 5, 52, 0x000000, 0.15);
    return this.add.circle(x, y, 52, 0xffffff, 0.7).setStrokeStyle(6, COLOR.yellow);
  }

  private fillSlot(animal: string): void {
    const slot = this.slots[this.index]!;
    const img = this.add.image(slot.x, slot.y, `thumb_pet_${animal}`).setScale(0);
    this.tweens.add({ targets: img, scale: 0.38, duration: 400, ease: 'Back.out' });
    slot.setFillStyle(0xffffff, 1);
    voice().sfx('pop');
  }

  private async partyTime(): Promise<void> {
    save.update((p) => void (p.safia.parties += 1));
    confetti(this);
    await this.world.party();
    confetti(this);
    await voice().say('all_fed');
    iconButton(this, 800, 770, 'return', COLOR.green, () => this.scene.restart(), 150);
  }
}
