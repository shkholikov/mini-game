import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { MAX_SPOKEN_NUMBER, type CarColor, type TrackId } from '../i18n/ru';
import {
  LANE_COUNT,
  LANE_WIDTH,
  ROAD_CENTER,
  TRACKS,
  clampLane,
  generateTrack,
  isObstacle,
  laneAt,
  laneX,
  type Spawn,
  type TrackDef,
} from '../systems/raceLogic';
import { createRng, pick } from '../systems/rng';
import { save } from '../systems/services';
import { voice } from '../systems/voice';
import { FONT, confetti, homeButton, iconButton, playIcon, replayIcon } from '../ui';
import { CAR_COLORS_ALL } from './BootScene';

const CAR_Y = 720;
const CURB = 30;
const ROAD_WIDTH = LANE_COUNT * LANE_WIDTH + CURB * 2;
const BASE_SPEED = 560;
const MAX_EXTRA_SPEED = 260;
const RIVAL_SPEED = 0.55;
const HIT_DISTANCE = 85;

interface Live {
  spawn: Spawn;
  sprite: Phaser.GameObjects.Image;
  done: boolean;
  passed?: boolean;
}

/** Осман: 3-lane race. Bumps only slow the car down; every race ends at the finish with a cup. */
export class RaceScene extends Phaser.Scene {
  private track!: TrackDef;
  private car!: Phaser.GameObjects.Image;
  private land!: Phaser.GameObjects.TileSprite;
  private road!: Phaser.GameObjects.TileSprite;
  private spawns: Spawn[] = [];
  private live: Live[] = [];
  private nextSpawn = 0;
  private dist = 0;
  private lane = 1;
  private stars = 0;
  private running = false;
  private finished = false;
  private boostUntil = 0;
  private slowUntil = 0;
  private lastOops = -10_000;
  private lastOvertake = -10_000;
  private nextDecor = 0;
  private starText!: Phaser.GameObjects.Text;
  private miniCar!: Phaser.GameObjects.Image;
  private finishLine!: Phaser.GameObjects.TileSprite;
  private exhaust!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('Race');
  }

  init(data: { track?: TrackId }): void {
    this.track = TRACKS[data.track ?? 'city'];
    this.dist = 0;
    this.lane = 1;
    this.stars = 0;
    this.running = false;
    this.finished = false;
    this.boostUntil = 0;
    this.slowUntil = 0;
    this.nextSpawn = 0;
    this.nextDecor = 300;
    this.live = [];
  }

  create(): void {
    const rng = createRng(Date.now());
    this.spawns = generateTrack(rng, this.track);
    this.makeRoadTexture();

    this.land = this.add.tileSprite(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      this.track.land,
    );
    this.road = this.add.tileSprite(
      ROAD_CENTER,
      GAME_HEIGHT / 2,
      ROAD_WIDTH,
      GAME_HEIGHT,
      `road_${this.track.id}`,
    );
    this.finishLine = this.add
      .tileSprite(ROAD_CENTER, -200, ROAD_WIDTH - CURB * 2, 40, 'checker')
      .setDepth(5);
    this.add
      .image(ROAD_CENTER - ROAD_WIDTH / 2 - 150, 520, 'tribune_full')
      .setAngle(-90)
      .setDepth(2)
      .setData('scroll', true);
    this.add
      .image(ROAD_CENTER + ROAD_WIDTH / 2 + 150, 520, 'tribune_full')
      .setAngle(90)
      .setDepth(2)
      .setData('scroll', true);

    const color: CarColor = save.get().osman.car;
    this.exhaust = this.add.particles(0, 0, 'confetti', {
      speedY: { min: 200, max: 360 },
      speedX: { min: -40, max: 40 },
      lifespan: 400,
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0xffd84d, 0xff8a3d, 0xe8574a],
      frequency: 30,
      emitting: false,
    });
    this.car = this.add.image(laneX(1), CAR_Y, `car_${color}_1`).setScale(1.4).setDepth(20);
    this.exhaust.startFollow(this.car, 0, 90).setDepth(19);

    this.makeHud(color);
    homeButton(this);
    this.setupInput();
    void this.countdown();
  }

  private makeRoadTexture(): void {
    const key = `road_${this.track.id}`;
    if (this.textures.exists(key)) return;
    const h = 256;
    const g = this.make.graphics({}, false);
    g.fillStyle(this.track.road, 1).fillRect(0, 0, ROAD_WIDTH, h);
    for (let y = 0; y < h; y += 32) {
      const c = (y / 32) % 2 ? 0xffffff : 0xe8574a;
      g.fillStyle(c, 1)
        .fillRect(0, y, CURB, 32)
        .fillRect(ROAD_WIDTH - CURB, y, CURB, 32);
    }
    g.fillStyle(0xffffff, 0.75);
    for (let l = 1; l < LANE_COUNT; l++) {
      const x = CURB + l * LANE_WIDTH - 4;
      g.fillRect(x, 0, 8, 96).fillRect(x, 128, 8, 96);
    }
    g.generateTexture(key, ROAD_WIDTH, h);
    g.destroy();
  }

  private makeHud(color: CarColor): void {
    const left = 500;
    const right = 1100;
    this.add
      .rectangle((left + right) / 2, 70, right - left + 40, 36, 0x000000, 0.35)
      .setRounded(18)
      .setDepth(90);
    this.add.rectangle((left + right) / 2, 70, right - left, 10, 0xffffff, 0.8).setDepth(90);
    this.add
      .image(right + 10, 70, 'checker')
      .setScale(0.35, 1)
      .setDepth(91);
    this.miniCar = this.add
      .image(left, 70, `car_${color}_1`)
      .setScale(0.45)
      .setAngle(90)
      .setDepth(92);
    this.miniCar.setData('range', [left, right]);

    this.add.circle(1330, 80, 64, 0xffffff, 0.9).setDepth(90);
    this.add.image(1300, 80, 'star').setScale(0.55).setDepth(91);
    this.starText = this.add
      .text(1352, 80, '0', {
        fontFamily: FONT,
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#2f3b52',
      })
      .setOrigin(0.5)
      .setDepth(91);
  }

  private setupInput(): void {
    // Tap or drag over a lane to drive there; taps beside the road pick the outer lanes.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.steerTo(laneAt(p.x)));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) this.steerTo(laneAt(p.x));
    });
    this.input.keyboard?.on('keydown-LEFT', () => this.steerTo(this.lane - 1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.steerTo(this.lane + 1));
  }

  private steerTo(lane: number): void {
    const target = clampLane(lane);
    if (!this.running || this.finished || target === this.lane) return;
    const dir = Math.sign(target - this.lane);
    this.lane = target;
    this.tweens.killTweensOf(this.car);
    this.car.setAngle(0);
    this.tweens.add({ targets: this.car, x: laneX(target), duration: 220, ease: 'Sine.out' });
    this.tweens.add({ targets: this.car, angle: 14 * dir, duration: 110, yoyo: true });
  }

  private async countdown(): Promise<void> {
    const lights = this.add.image(ROAD_CENTER, 360, 'lights').setScale(2.2).setDepth(95);
    this.tweens.add({ targets: lights, scale: 2.5, duration: 500, yoyo: true, repeat: 2 });
    await voice().say('ready');
    this.tweens.add({
      targets: lights,
      alpha: 0,
      duration: 300,
      onComplete: () => lights.destroy(),
    });
    this.running = true;
  }

  private speed(time: number): number {
    let s = BASE_SPEED + MAX_EXTRA_SPEED * Math.min(1, this.dist / this.track.length);
    if (time < this.boostUntil) s *= 1.7;
    if (time < this.slowUntil) s *= 0.45;
    return s;
  }

  update(time: number, deltaMs: number): void {
    if (!this.running) return;
    const dt = Math.min(deltaMs, 50) / 1000;
    const v = this.finished ? 0 : this.speed(time);
    const move = v * dt;
    this.dist += move;

    this.land.tilePositionY -= move;
    this.road.tilePositionY -= move;
    for (const o of [...this.children.list]) {
      if (o instanceof Phaser.GameObjects.Image && o.getData('scroll')) {
        o.y += move;
        if (o.y > GAME_HEIGHT + 300) o.destroy();
      }
    }
    this.spawnDecor();
    this.spawnObjects();
    this.moveObjects(dt, time);
    this.exhaust.emitting = time < this.boostUntil;

    const finishY = CAR_Y - (this.track.length - this.dist);
    this.finishLine.y = finishY - 60;
    const [l, r] = this.miniCar.getData('range') as [number, number];
    this.miniCar.x = l + (r - l) * Math.min(1, this.dist / this.track.length);

    if (!this.finished && this.dist >= this.track.length) void this.finish();
  }

  private spawnDecor(): void {
    while (this.nextDecor < this.dist + 1000) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const edge = ROAD_CENTER + side * (ROAD_WIDTH / 2 + 60);
      const x = edge + side * (40 + Math.random() * 280);
      const key = this.track.decor[Math.floor(Math.random() * this.track.decor.length)]!;
      this.add
        .image(x, CAR_Y - (this.nextDecor - this.dist), key)
        .setScale(key.startsWith('tribune') ? 1 : 1.3)
        .setAngle(key.startsWith('tribune') || key.startsWith('tent') ? side * 90 : 0)
        .setDepth(3)
        .setData('scroll', true);
      this.nextDecor += 220 + Math.random() * 260;
    }
  }

  private spawnObjects(): void {
    while (
      this.nextSpawn < this.spawns.length &&
      this.spawns[this.nextSpawn]!.d - this.dist < 1000
    ) {
      const spawn = { ...this.spawns[this.nextSpawn]! };
      this.nextSpawn += 1;
      let key: string = spawn.kind;
      let scale = 1.4;
      if (spawn.kind === 'star') {
        key = 'star';
        scale = 0.75;
      } else if (spawn.kind === 'boost') {
        key = 'arrow_yellow';
        scale = 0.9;
      } else if (spawn.kind === 'rival') {
        const others = CAR_COLORS_ALL.filter((c) => c !== save.get().osman.car);
        key = `car_${pick(Math.random, others)}_${2 + Math.floor(Math.random() * 4)}`;
        scale = 1.3;
      }
      const sprite = this.add
        .image(laneX(spawn.lane), CAR_Y - (spawn.d - this.dist), key)
        .setScale(scale)
        .setDepth(spawn.kind === 'rival' ? 18 : 10);
      if (spawn.kind === 'star')
        this.tweens.add({ targets: sprite, angle: 360, duration: 2400, repeat: -1 });
      this.live.push({ spawn, sprite, done: false });
    }
  }

  private moveObjects(dt: number, time: number): void {
    const carLane = laneAt(this.car.x);
    for (const o of this.live) {
      if (o.spawn.kind === 'rival' && !this.finished) o.spawn.d += BASE_SPEED * RIVAL_SPEED * dt;
      o.sprite.y = CAR_Y - (o.spawn.d - this.dist);
      if (!o.done && o.spawn.lane === carLane && Math.abs(o.sprite.y - CAR_Y) < HIT_DISTANCE)
        this.hit(o, time);
      if (o.spawn.kind === 'rival' && !o.passed && o.sprite.y > CAR_Y + 120) {
        o.passed = true;
        if (!o.done && time - this.lastOvertake > 3000) {
          this.lastOvertake = time;
          void voice().say('overtake');
        }
      }
    }
    this.live = this.live.filter((o) => {
      if (o.sprite.y > GAME_HEIGHT + 200 || !o.sprite.active) {
        o.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  private hit(o: Live, time: number): void {
    o.done = true;
    const kind = o.spawn.kind;
    if (kind === 'star') {
      this.stars += 1;
      voice().sfx('coin', 0.5);
      this.tweens.killTweensOf(o.sprite);
      this.tweens.add({
        targets: o.sprite,
        x: 1300,
        y: 80,
        scale: 0.3,
        duration: 400,
        ease: 'Quad.in',
        onComplete: () => {
          o.sprite.destroy();
          this.starText.setText(String(this.stars));
          this.tweens.add({ targets: this.starText, scale: 1.4, duration: 100, yoyo: true });
        },
      });
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
    this.cameras.main.shake(180, 0.006);
    this.tweens.add({
      targets: this.car,
      angle: { from: -18, to: 18 },
      duration: 80,
      yoyo: true,
      repeat: 2,
      onComplete: () => this.car.setAngle(0),
    });
    const away =
      o.spawn.lane === 0 ? -1 : o.spawn.lane === LANE_COUNT - 1 ? 1 : Math.random() < 0.5 ? -1 : 1;
    if (isObstacle(kind)) {
      this.tweens.add({
        targets: o.sprite,
        x: o.sprite.x + away * 260,
        angle: away * 200,
        alpha: 0,
        duration: 500,
        onComplete: () => o.sprite.destroy(),
      });
    } else {
      // The rival steers into the next lane so it never drives through Осман's car.
      const lane =
        o.spawn.lane === 0
          ? 1
          : o.spawn.lane === LANE_COUNT - 1
            ? LANE_COUNT - 2
            : o.spawn.lane + away;
      o.spawn.lane = lane;
      this.tweens.add({ targets: o.sprite, x: laneX(lane), duration: 300, ease: 'Sine.out' });
      this.tweens.add({ targets: o.sprite, angle: away * 15, duration: 150, yoyo: true });
    }
    if (time - this.lastOops > 4000) {
      this.lastOops = time;
      void voice().say('oops');
    }
  }

  private async finish(): Promise<void> {
    this.finished = true;
    this.exhaust.emitting = false;
    const id = this.track.id;
    save.update((p) => {
      p.osman.races += 1;
      p.osman.cups[id] += 1;
      p.osman.bestStars[id] = Math.max(p.osman.bestStars[id], this.stars);
    });
    confetti(this);
    voice().sfx('correct');
    this.tweens.add({ targets: this.car, y: CAR_Y - 220, duration: 900, ease: 'Cubic.out' });

    const cup = this.add.image(ROAD_CENTER, 380, 'cup').setScale(0).setDepth(120);
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.25)
      .setDepth(110);
    this.tweens.add({ targets: cup, scale: 2.2, duration: 700, ease: 'Back.out' });
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

    iconButton(
      this,
      640,
      720,
      0x5cb85c,
      replayIcon,
      () => this.scene.restart({ track: id }),
      80,
    ).setDepth(130);
    iconButton(this, 960, 720, 0x4a90e2, playIcon, () => this.scene.start('Garage'), 80).setDepth(
      130,
    );
  }
}
