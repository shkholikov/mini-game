import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { MAX_SPOKEN_NUMBER, TEXT, type TrackId } from '../i18n/ru';
import {
  LANE_COUNT,
  TRACKS,
  clampLane,
  generateTrack,
  isObstacle,
  type Spawn,
  type TrackDef,
} from '../systems/raceLogic';
import { createRng } from '../systems/rng';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { RaceWorld } from '../three/RaceWorld';
import { getStage } from '../three/stage';
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

const BASE_SPEED = 560;
const MAX_EXTRA_SPEED = 260;
const RIVAL_SPEED = 0.55;
/** Logic px: how close (along the track) an object must be to touch the car. */
const HIT_DISTANCE = 70;
/** How far ahead objects appear (≈ the fog line in 3D). */
const LOOKAHEAD = 7000;

interface Live {
  id: number;
  spawn: Spawn;
  done: boolean;
  passed?: boolean;
}

/** Осман: 3-lane race in 3D. Bumps only slow the car down; every race ends at the finish with a cup. */
export class RaceScene extends Phaser.Scene {
  private track!: TrackDef;
  private world!: RaceWorld;
  private spawns: Spawn[] = [];
  private live: Live[] = [];
  private nextSpawn = 0;
  private dist = 0;
  private lane = 1;
  /** Tweened car position in lanes (fractional while changing lane) and tilt. */
  private carPos = { lane: 1, tilt: 0 };
  private stars = 0;
  private running = false;
  private finished = false;
  private boostUntil = 0;
  private slowUntil = 0;
  private lastOops = -10_000;
  private lastOvertake = -10_000;
  private rollOut = 0;
  private starText!: Phaser.GameObjects.Text;
  private miniCar!: Phaser.GameObjects.Image;

  constructor() {
    super('Race');
  }

  init(data: { track?: TrackId }): void {
    this.track = TRACKS[data.track ?? 'city'];
    this.dist = 0;
    this.lane = 1;
    this.carPos = { lane: 1, tilt: 0 };
    this.stars = 0;
    this.running = false;
    this.finished = false;
    this.boostUntil = 0;
    this.slowUntil = 0;
    this.nextSpawn = 0;
    this.live = [];
  }

  create(): void {
    this.spawns = generateTrack(createRng(Date.now()), this.track);
    const car = save.get().osman.car;
    this.world = new RaceWorld(this.track, car);
    const stage = getStage();
    stage.show(this.world.scene, this.world.camera);
    this.events.once('shutdown', () => stage.hide());

    this.makeHud(car);
    homeButton(this);
    this.setupInput();
    void this.countdown();
  }

  private makeHud(car: string): void {
    // progress: a little road from start to the chequered flag, with Осман's car on it
    const left = 520;
    const right = 1080;
    const g = this.add.graphics().setDepth(90);
    g.fillStyle(0x000000, 0.2).fillRoundedRect(left - 40, 62, right - left + 80, 52, 26);
    g.fillStyle(0x4a4f57, 1).fillRoundedRect(left - 40, 54, right - left + 80, 52, 26);
    g.lineStyle(5, 0xffffff, 1).strokeRoundedRect(left - 40, 54, right - left + 80, 52, 26);
    g.fillStyle(0xffffff, 0.8);
    for (let x = left; x < right - 10; x += 40) g.fillRect(x, 78, 22, 5);
    this.add
      .image(right + 14, 80, 'checker')
      .setScale(0.3, 1.05)
      .setDepth(91);
    this.miniCar = this.add.image(left, 72, `thumb_${car}`).setScale(0.3).setDepth(92);
    this.miniCar.setData('range', [left, right]);

    // star counter pill
    const pill = this.add.graphics().setDepth(90);
    pill.fillStyle(0x000000, 0.2).fillRoundedRect(1215, 46, 190, 84, 42);
    pill.fillStyle(0xffffff, 1).fillRoundedRect(1215, 38, 190, 84, 42);
    pill.lineStyle(6, COLOR.yellow, 1).strokeRoundedRect(1215, 38, 190, 84, 42);
    this.add.image(1262, 80, 'star').setScale(0.6).setDepth(91);
    this.starText = this.add
      .text(1340, 80, '0', { fontFamily: FONT.race, fontSize: '50px', color: INK_HEX })
      .setOrigin(0.5)
      .setDepth(91);
  }

  private setupInput(): void {
    // Tap or drag over the left / middle / right of the screen to drive into that lane.
    const laneFromX = (x: number): number => (x < 600 ? 0 : x > 1000 ? 2 : 1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.steerTo(laneFromX(p.x)));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.steerTo(laneFromX(p.x));
    });
    this.input.keyboard?.on('keydown-LEFT', () => this.steerTo(this.lane - 1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.steerTo(this.lane + 1));
  }

  private steerTo(lane: number): void {
    const target = clampLane(lane);
    if (!this.running || this.finished || target === this.lane) return;
    const dir = Math.sign(target - this.lane);
    this.lane = target;
    this.tweens.killTweensOf(this.carPos);
    this.tweens.add({ targets: this.carPos, lane: target, duration: 260, ease: 'Sine.out' });
    this.tweens.add({
      targets: this.carPos,
      tilt: dir,
      duration: 130,
      yoyo: true,
      onComplete: () => (this.carPos.tilt = 0),
    });
  }

  private async countdown(): Promise<void> {
    const lights = this.add.image(800, 250, 'lights').setScale(2.4).setDepth(95);
    const words = TEXT.go.map((w, i) => {
      const t = gameText(this, 800, 430, w, 'heading', { size: 110 }).setDepth(96).setScale(0);
      gradientFill(t, i === 2 ? '#c8ff8a' : '#fff6a8', i === 2 ? '#3fbf4a' : '#ffb330');
      return t;
    });
    words.forEach((t, i) => {
      this.tweens.add({ targets: t, scale: 1, delay: i * 850, duration: 300, ease: 'Back.out' });
      if (i < words.length - 1)
        this.tweens.add({ targets: t, alpha: 0, delay: i * 850 + 700, duration: 150 });
    });
    await voice().say('ready');
    this.tweens.add({
      targets: [lights, ...words],
      alpha: 0,
      duration: 300,
      onComplete: () => [lights, ...words].forEach((o) => o.destroy()),
    });
    this.running = true;
  }

  private speed(time: number): number {
    if (!this.running) return 0;
    // After the finish the car rolls on past the arch and gently stops.
    if (this.finished) return this.rollOut;
    let s = BASE_SPEED + MAX_EXTRA_SPEED * Math.min(1, this.dist / this.track.length);
    if (time < this.boostUntil) s *= 1.7;
    if (time < this.slowUntil) s *= 0.45;
    return s;
  }

  update(time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    const v = this.speed(time);
    this.dist += v * dt;

    if (this.running) {
      this.spawnObjects();
      this.moveObjects(dt, time);
      const [l, r] = this.miniCar.getData('range') as [number, number];
      this.miniCar.x = l + (r - l) * Math.min(1, this.dist / this.track.length);
      if (!this.finished && this.dist >= this.track.length) void this.finish();
    }

    this.world.update({
      dist: this.dist,
      carLane: this.carPos.lane,
      tilt: this.carPos.tilt,
      speed: v,
      boosting: time < this.boostUntil,
      dt,
      items: this.live.map((o) => ({
        id: o.id,
        kind: o.spawn.kind,
        lane: o.spawn.lane,
        d: o.spawn.d,
      })),
      finishD: this.track.length,
    });
    getStage().render();
  }

  private spawnObjects(): void {
    while (
      this.nextSpawn < this.spawns.length &&
      this.spawns[this.nextSpawn]!.d - this.dist < LOOKAHEAD
    ) {
      this.live.push({
        id: this.nextSpawn,
        spawn: { ...this.spawns[this.nextSpawn]! },
        done: false,
      });
      this.nextSpawn += 1;
    }
  }

  private moveObjects(dt: number, time: number): void {
    const carLane = Math.round(this.carPos.lane);
    for (const o of this.live) {
      if (o.spawn.kind === 'rival' && !this.finished) o.spawn.d += BASE_SPEED * RIVAL_SPEED * dt;
      const gap = o.spawn.d - this.dist;
      if (!this.finished && !o.done && o.spawn.lane === carLane && Math.abs(gap) < HIT_DISTANCE)
        this.hit(o, time);
      if (o.spawn.kind === 'rival' && !o.passed && gap < -150) {
        o.passed = true;
        if (!o.done && time - this.lastOvertake > 3000) {
          this.lastOvertake = time;
          void voice().say('overtake');
        }
      }
    }
    // Drop things well behind the camera.
    this.live = this.live.filter((o) => o.spawn.d - this.dist > -700);
  }

  private hit(o: Live, time: number): void {
    o.done = true;
    const kind = o.spawn.kind;
    if (kind === 'star') {
      this.stars += 1;
      voice().sfx('coin', 0.5);
      this.world.collect(o.id);
      this.starText.setText(String(this.stars));
      this.tweens.add({ targets: this.starText, scale: 1.5, duration: 100, yoyo: true });
      return;
    }
    if (kind === 'boost') {
      this.boostUntil = time + 1600;
      voice().sfx('whoosh');
      void voice().say('boost');
      this.cameras.main.flash(150, 255, 230, 120);
      return;
    }
    // Obstacle or rival: a gentle bump, never a crash.
    this.slowUntil = time + 800;
    voice().sfx('soft', 0.6);
    this.world.shake();
    this.tweens.add({
      targets: this.carPos,
      tilt: { from: -1, to: 1 },
      duration: 90,
      yoyo: true,
      repeat: 2,
      onComplete: () => (this.carPos.tilt = 0),
    });
    const away =
      o.spawn.lane === 0 ? -1 : o.spawn.lane === LANE_COUNT - 1 ? 1 : Math.random() < 0.5 ? -1 : 1;
    if (isObstacle(kind)) {
      this.world.knock(o.id, away);
    } else {
      // The rival steers into the next lane so it never drives through Осман's car.
      o.spawn.lane =
        o.spawn.lane === 0
          ? 1
          : o.spawn.lane === LANE_COUNT - 1
            ? LANE_COUNT - 2
            : o.spawn.lane + away;
    }
    if (time - this.lastOops > 4000) {
      this.lastOops = time;
      void voice().say('oops');
    }
  }

  private async finish(): Promise<void> {
    this.rollOut = this.speed(this.time.now);
    this.finished = true;
    this.tweens.add({ targets: this, rollOut: 0, duration: 1800, ease: 'Quad.out' });
    const id = this.track.id;
    save.update((p) => {
      p.osman.races += 1;
      p.osman.cups[id] += 1;
      p.osman.bestStars[id] = Math.max(p.osman.bestStars[id], this.stars);
    });
    confetti(this);
    voice().sfx('correct');

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.3)
      .setDepth(110);
    const card = this.add.container(800, 1200).setDepth(120);
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.2).fillRoundedRect(-330, -300, 660, 600, 48);
    panel.fillStyle(0xffffff, 1).fillRoundedRect(-330, -312, 660, 600, 48);
    panel.lineStyle(10, COLOR.yellow, 1).strokeRoundedRect(-330, -312, 660, 600, 48);
    const title = gameText(this, 0, -250, TEXT.finish, 'heading', { size: 80 });
    gradientFill(title, '#fff6a8', '#ffb330');
    const cup = this.add.image(0, -60, 'cup').setScale(1.6);
    const starRow = this.add.container(0, 120);
    starRow.add(this.add.image(-50, 0, 'star').setScale(0.75));
    starRow.add(
      this.add
        .text(30, 0, String(this.stars), {
          fontFamily: FONT.race,
          fontSize: '64px',
          color: INK_HEX,
        })
        .setOrigin(0, 0.5),
    );
    card.add([panel, title, cup, starRow]);
    this.tweens.add({ targets: card, y: 430, duration: 700, ease: 'Back.out' });
    this.tweens.add({
      targets: cup,
      angle: { from: -6, to: 6 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      delay: 700,
    });

    const spoken = Math.min(this.stars, MAX_SPOKEN_NUMBER);
    await voice().say('finish', ...(spoken > 0 ? ['stars', `num_${spoken}`] : []), 'cup');

    card.add(
      iconButton(
        this,
        -120,
        230,
        'return',
        COLOR.green,
        () => this.scene.restart({ track: id }),
        120,
      ),
    );
    card.add(
      iconButton(this, 120, 230, 'right', COLOR.blue, () => this.scene.start('Garage'), 120),
    );
  }
}
