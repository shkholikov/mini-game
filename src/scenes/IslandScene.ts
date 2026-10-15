import Phaser from 'phaser';
import * as THREE from 'three';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { TEXT } from '../i18n/ru';
import {
  collectStars,
  inTrigger,
  newCar,
  stepBodies,
  stepCar,
  type Body,
  type Car,
  type Island,
  type Star,
  type Vec,
} from '../systems/islandLogic';
import {
  GARAGE_DOOR,
  GATES,
  SPAWN,
  makeBodies,
  makeDecor,
  makeIsland,
  makeStars,
} from '../systems/islandMap';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { IslandWorld } from '../three/IslandWorld';
import { getStage, rayFromGame } from '../three/stage';
import {
  COLOR,
  FONT,
  INK_HEX,
  confetti,
  gameText,
  gradientFill,
  homeButton,
  iconButton,
} from '../ui';

/** Say the hint again after this long without a touch. */
const HINT_AFTER_MS = 9000;
const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * Осман: drive freely around a 3D island. Hold a finger anywhere and the car drives there.
 * Collect 15 stars for a cup, knock over pins and boxes, jump ramps, splash through the pond,
 * drive through an arch to race or into the garage to change car. No timer, no end.
 */
export class IslandScene extends Phaser.Scene {
  private world!: IslandWorld;
  private island!: Island;
  private car!: Car;
  private bodies: Body[] = [];
  private stars: Star[] = [];
  private readonly strikes = new Map<string, number>();
  private driver: Phaser.Input.Pointer | null = null;
  private keys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key> | null = null;
  private count = 0;
  private wasWet = false;
  private leaving = false;
  private card: Phaser.GameObjects.Container | null = null;
  private lastTouch = 0;
  private readonly last = new Map<string, number>();
  private starText!: Phaser.GameObjects.Text;

  constructor() {
    super('Island');
  }

  create(): void {
    const decor = makeDecor();
    this.island = makeIsland(decor);
    this.car = newCar(SPAWN.x, SPAWN.z, SPAWN.heading);
    this.bodies = makeBodies();
    this.stars = makeStars();
    this.strikes.clear();
    this.last.clear();
    this.count = 0;
    this.wasWet = false;
    this.leaving = false;
    this.card = null;
    this.driver = null;
    this.lastTouch = this.time.now;

    this.world = new IslandWorld(save.get().osman.car, decor, this.stars, this.bodies);
    const stage = getStage();
    stage.show(this.world.scene, this.world.camera);
    this.events.once('shutdown', () => stage.hide());

    this.makeHud();
    homeButton(this);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      this.lastTouch = this.time.now;
      if (over.length === 0 && !this.card) this.driver = p;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p === this.driver) this.driver = null;
    });
    const kb = this.input.keyboard;
    this.keys = kb
      ? {
          up: kb.addKey('UP'),
          down: kb.addKey('DOWN'),
          left: kb.addKey('LEFT'),
          right: kb.addKey('RIGHT'),
        }
      : null;

    this.time.delayedCall(900, () => void voice().say('island_go', 'island_hint'));
  }

  private makeHud(): void {
    const pill = this.add.graphics().setDepth(90);
    pill.fillStyle(0x000000, 0.2).fillRoundedRect(1165, 46, 260, 84, 42);
    pill.fillStyle(0xffffff, 1).fillRoundedRect(1165, 38, 260, 84, 42);
    pill.lineStyle(6, COLOR.yellow, 1).strokeRoundedRect(1165, 38, 260, 84, 42);
    this.add.image(1215, 80, 'star').setScale(0.6).setDepth(91);
    this.starText = this.add
      .text(1320, 80, `0/${this.stars.length}`, {
        fontFamily: FONT.race,
        fontSize: '46px',
        color: INK_HEX,
      })
      .setOrigin(0.5)
      .setDepth(91);
  }

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    if (this.driver && !this.driver.isDown) this.driver = null;
    const target = this.card || this.leaving ? null : this.target();
    if (target) this.lastTouch = time;

    const car = this.car;
    const ev = stepCar(car, target, this.island, dt);
    const bev = stepBodies(this.bodies, car, dt, this.strikes);

    if (ev.bump > 5) {
      this.world.bump();
      voice().sfx('soft', 0.5);
      if (ev.bump > 9) this.sayOnce('oops', 6000);
    }
    if (ev.launched) voice().sfx('whoosh', 0.6);
    if (ev.landed > 0.35) {
      this.world.landing(ev.landed);
      voice().sfx('drop', 0.6);
      this.sayOnce('wow', 4000);
    }
    if (ev.water && !this.wasWet) {
      this.world.splash();
      voice().sfx('drop', 0.5);
      this.sayOnce('splash', 7000);
    }
    this.wasWet = ev.water;

    for (const i of bev.knocked) {
      const b = this.bodies[i]!;
      this.world.hit(b.x, b.y, b.z);
      if (this.ready('knock', 90)) voice().sfx(b.kind === 'box' ? 'drop' : 'pop', 0.6);
    }
    if (bev.strikes.length) {
      voice().sfx('correct');
      void voice().say('strike');
      const at = getStage().toGame(
        this.world.bodyPos(0),
        this.game.canvas,
        GAME_WIDTH,
        GAME_HEIGHT,
      );
      confetti(this, at.x, at.y - 100, 50);
    }

    collectStars(this.stars, car).forEach(() => this.gotStar());

    this.checkTriggers();

    if (!this.card && !this.leaving && time - this.lastTouch > HINT_AFTER_MS) {
      this.lastTouch = time;
      void voice().say('island_hint');
    }

    this.world.update({ car, bodies: this.bodies, stars: this.stars, water: ev.water, dt });
    getStage().render();
  }

  /** Where the finger (or the arrow keys, for testing on a Mac) wants the car to go. */
  private target(): Vec | null {
    if (this.driver) {
      const ray = rayFromGame(
        getStage(),
        this.driver.x,
        this.driver.y,
        this.game.canvas,
        GAME_WIDTH,
        GAME_HEIGHT,
      );
      const hit = ray.ray.intersectPlane(GROUND, new THREE.Vector3());
      return hit ? { x: hit.x, z: hit.z } : null;
    }
    const k = this.keys;
    if (!k) return null;
    const dx = (k.right.isDown ? 1 : 0) - (k.left.isDown ? 1 : 0);
    const dz = (k.down.isDown ? 1 : 0) - (k.up.isDown ? 1 : 0);
    if (!dx && !dz) return null;
    return { x: this.car.x + dx * 12, z: this.car.z + dz * 12 };
  }

  private gotStar(): void {
    this.count += 1;
    voice().sfx('coin', 0.6);
    save.update((p) => void (p.osman.island.stars += 1));
    this.starText.setText(`${this.count}/${this.stars.length}`);
    this.tweens.add({ targets: this.starText, scale: 1.4, duration: 110, yoyo: true });
    const left = this.stars.length - this.count;
    if (left === 0) void this.roundDone();
    else if (left === 1) void voice().say('one_more');
    else if (this.count % 5 === 0) void voice().say(`stars_${this.count}`);
  }

  private async roundDone(): Promise<void> {
    save.update((p) => void (p.osman.island.rounds += 1));
    confetti(this);
    voice().sfx('correct');

    const card = this.add.container(800, 1200).setDepth(120);
    this.card = card;
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.2).fillRoundedRect(-330, -300, 660, 600, 48);
    panel.fillStyle(0xffffff, 1).fillRoundedRect(-330, -312, 660, 600, 48);
    panel.lineStyle(10, COLOR.yellow, 1).strokeRoundedRect(-330, -312, 660, 600, 48);
    const title = gameText(this, 0, -250, TEXT.allStars, 'heading', { size: 70 });
    gradientFill(title, '#fff6a8', '#ffb330');
    const cup = this.add.image(0, -50, 'cup').setScale(1.6);
    card.add([panel, title, cup]);
    this.tweens.add({ targets: card, y: 430, duration: 700, ease: 'Back.out' });
    this.tweens.add({
      targets: cup,
      angle: { from: -6, to: 6 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      delay: 700,
    });
    await voice().say('all_stars', 'cup');
    if (this.card !== card) return;
    card.add(iconButton(this, 0, 190, 'right', COLOR.green, () => this.nextRound(), 130));
  }

  /** Close the cup card and scatter the stars again. */
  private nextRound(): void {
    this.card?.destroy();
    this.card = null;
    this.count = 0;
    this.starText.setText(`0/${this.stars.length}`);
    for (const s of this.stars) s.taken = false;
    void voice().say('island_go');
  }

  private checkTriggers(): void {
    if (this.leaving || this.card) return;
    const { x, z } = this.car;
    const gate = GATES.find((g) => inTrigger(g, x, z));
    if (gate) {
      this.leave('Race', { track: gate.track }, `track_${gate.track}`);
    } else if (inTrigger(GARAGE_DOOR, x, z)) {
      this.leave('Garage', {}, 'garage');
    }
  }

  private leave(scene: string, data: object, line: string): void {
    this.leaving = true;
    voice().sfx('whoosh');
    void voice().say(line);
    this.cameras.main.fadeOut(700, 255, 255, 255);
    this.time.delayedCall(800, () => this.scene.start(scene, data));
  }

  /** Voice line at most once per `gap` ms. */
  private sayOnce(id: string, gap: number): void {
    if (this.ready(id, gap)) void voice().say(id);
  }

  private ready(key: string, gap: number): boolean {
    const now = this.time.now;
    if (now - (this.last.get(key) ?? -Infinity) < gap) return false;
    this.last.set(key, now);
    return true;
  }
}
