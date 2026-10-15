import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/game';
import { MAX_SPOKEN_NUMBER, type TrackId } from '../i18n/ru';
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
import { FONT, confetti, homeButton, iconButton, playIcon, replayIcon } from '../ui';

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
    this.miniCar = this.add.image(left, 62, `thumb_${car}`).setScale(0.32).setDepth(92);
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
    const lights = this.add.image(800, 300, 'lights').setScale(2.4).setDepth(95);
    this.tweens.add({ targets: lights, scale: 2.7, duration: 500, yoyo: true, repeat: 2 });
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

    const cup = this.add.image(800, 400, 'cup').setScale(0).setDepth(120);
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
      740,
      0x5cb85c,
      replayIcon,
      () => this.scene.restart({ track: id }),
      80,
    ).setDepth(130);
    iconButton(this, 960, 740, 0x4a90e2, playIcon, () => this.scene.start('Garage'), 80).setDepth(
      130,
    );
  }
}
