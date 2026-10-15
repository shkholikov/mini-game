import { describe, expect, it } from 'vitest';
import {
  CAR,
  RESET_AFTER,
  STRIKE_RESET,
  collectStars,
  inTrigger,
  makeBody,
  newCar,
  rampHeight,
  stepBodies,
  stepCar,
  type Island,
  type Ramp,
} from '../src/systems/islandLogic';
import {
  GARAGE_DOOR,
  GATES,
  ISLAND_RADIUS,
  POND,
  RAMPS,
  SPAWN,
  makeBodies,
  makeColliders,
  makeDecor,
  makeIsland,
  makeStars,
} from '../src/systems/islandMap';

const DT = 1 / 60;
const empty = (extra: Partial<Island> = {}): Island => ({
  radius: 100,
  colliders: [],
  ramps: [],
  pond: { x: 500, z: 500, r: 1 },
  ...extra,
});

describe('islandLogic: driving', () => {
  it('drives to the finger and stops there', () => {
    const car = newCar(0, 0, 0);
    const target = { x: 20, z: -15 };
    for (let i = 0; i < 60 * 8; i++) stepCar(car, target, empty(), DT);
    expect(Math.hypot(car.x - target.x, car.z - target.z)).toBeLessThan(CAR.arrive + 0.5);
    expect(Math.abs(car.speed)).toBeLessThan(0.5);
  });

  it('rolls to a stop when the finger is lifted', () => {
    const car = newCar(0, 0, 0);
    for (let i = 0; i < 60; i++) stepCar(car, { x: 0, z: 80 }, empty(), DT);
    expect(car.speed).toBeGreaterThan(5);
    for (let i = 0; i < 90; i++) stepCar(car, null, empty(), DT);
    expect(car.speed).toBe(0);
  });

  it('drives around a tree in the way, never into it', () => {
    const tree = { x: 0, z: 10, r: 1.5 };
    const car = newCar(0, 0, 0);
    for (let i = 0; i < 60 * 6; i++) {
      stepCar(car, { x: 0.3, z: 30 }, empty({ colliders: [tree] }), DT);
      expect(Math.hypot(car.x - tree.x, car.z - tree.z)).toBeGreaterThanOrEqual(
        tree.r + CAR.radius - 1e-6,
      );
    }
    expect(car.z).toBeGreaterThan(25);
  });

  it('bumps softly when driving straight into a wall of rocks', () => {
    const wall = Array.from({ length: 21 }, (_, i) => ({ x: (i - 10) * 1.5, z: 8, r: 1 }));
    const car = newCar(0, 0, 0);
    let bump = 0;
    for (let i = 0; i < 60 * 3; i++) {
      bump = Math.max(bump, stepCar(car, { x: 0, z: 30 }, empty({ colliders: wall }), DT).bump);
      expect(car.z).toBeLessThan(8 - CAR.radius);
    }
    expect(bump).toBeGreaterThan(0);
  });

  it('stays on the island', () => {
    const car = newCar(0, 0, 0);
    for (let i = 0; i < 60 * 10; i++) stepCar(car, { x: 0, z: 500 }, empty({ radius: 30 }), DT);
    expect(Math.hypot(car.x, car.z)).toBeLessThanOrEqual(30 + 1e-6);
  });

  it('slows down in the pond', () => {
    const dry = newCar(0, 0, 0);
    const wet = newCar(0, 0, 0);
    const pond = { x: 0, z: 0, r: 100 };
    for (let i = 0; i < 120; i++) {
      stepCar(dry, { x: 0, z: 90 }, empty(), DT);
      stepCar(wet, { x: 0, z: 90 }, empty({ pond }), DT);
    }
    expect(wet.speed).toBeLessThan(dry.speed * 0.7);
  });
});

describe('islandLogic: ramps', () => {
  const ramp: Ramp = { x: 0, z: 10, heading: 0, len: 8, width: 5, height: 2 };

  it('rises from the back edge to the front edge', () => {
    expect(rampHeight(ramp, 0, 6.01)).toBeCloseTo(0, 1);
    expect(rampHeight(ramp, 0, 10)).toBeCloseTo(1, 5);
    expect(rampHeight(ramp, 0, 13.99)).toBeCloseTo(2, 1);
    expect(rampHeight(ramp, 3, 10)).toBeNull();
  });

  it('launches the car off the top and lands it again', () => {
    const car = newCar(0, -10, 0);
    let launched = false;
    let landed = 0;
    let maxY = 0;
    for (let i = 0; i < 60 * 5; i++) {
      const ev = stepCar(car, { x: 0, z: 200 }, empty({ ramps: [ramp] }), DT);
      launched ||= ev.launched;
      landed = Math.max(landed, ev.landed);
      maxY = Math.max(maxY, car.y);
    }
    expect(launched).toBe(true);
    expect(maxY).toBeGreaterThan(ramp.height + 0.5);
    expect(landed).toBeGreaterThan(0.3);
    expect(car.y).toBe(0);
  });
});

describe('islandLogic: knocking things over', () => {
  it('a knocked box flies, comes to rest and stands up again later', () => {
    const bodies = [makeBody('box', 0, 5, 0.75, 1.5)];
    const car = newCar(0, 0, 0);
    car.speed = 10;
    const strikes = new Map<string, number>();
    let knocked = false;
    for (let i = 0; i < 60 * 3; i++) {
      if (i < 30) {
        car.z += car.speed * DT;
      }
      if (stepBodies(bodies, car, DT, strikes).knocked.length > 0) knocked = true;
    }
    expect(knocked).toBe(true);
    expect(bodies[0]!.state).toBe('down');
    expect(bodies[0]!.z).toBeGreaterThan(6);
    car.z = -50;
    let reset = false;
    for (let i = 0; i < 60 * (RESET_AFTER + 1); i++)
      if (stepBodies(bodies, car, DT, strikes).reset.includes(0)) reset = true;
    expect(reset).toBe(true);
    expect(bodies[0]!.state).toBe('stand');
  });

  it('boxes on top fall when the box below is knocked', () => {
    const bodies = makeBodies().filter((b) => b.kind === 'box');
    expect(bodies.filter((b) => b.home.y > 0).every((b) => b.on.length === 2)).toBe(true);
    // re-index supports for the filtered list: the pyramid boxes are contiguous in makeBodies
    const offset = makeBodies().findIndex((b) => b.kind === 'box');
    for (const b of bodies) b.on = b.on.map((j) => j - offset);
    const car = newCar(bodies[0]!.x, bodies[0]!.z - 1.6, 0);
    car.speed = 8;
    const strikes = new Map<string, number>();
    for (let i = 0; i < 60 * 4; i++) stepBodies(bodies, car, DT, strikes);
    expect(bodies.at(-1)!.state).not.toBe('stand');
  });

  it('a strike when every pin is down, then the pins stand up again', () => {
    const pins = makeBodies().filter((b) => b.group === 'pins');
    expect(pins).toHaveLength(10);
    for (const p of pins) p.state = 'down';
    const strikes = new Map<string, number>();
    const car = newCar(-100, -100, 0);
    expect(stepBodies(pins, car, DT, strikes).strikes).toEqual(['pins']);
    expect(stepBodies(pins, car, DT, strikes).strikes).toEqual([]);
    for (let i = 0; i < 60 * (STRIKE_RESET + 0.5); i++) stepBodies(pins, car, DT, strikes);
    expect(pins.every((p) => p.state === 'stand')).toBe(true);
  });

  it('a car flying over a pin does not knock it', () => {
    const bodies = [makeBody('pin', 0, 3, 0.42, 1.9)];
    const car = newCar(0, 3, 0);
    car.y = 3;
    car.speed = 10;
    expect(stepBodies(bodies, car, DT, new Map()).knocked).toEqual([]);
  });
});

describe('islandMap', () => {
  const decor = makeDecor();
  const colliders = makeColliders(decor);

  it('has 15 stars, all on the island and none inside a solid thing', () => {
    const stars = makeStars();
    expect(stars).toHaveLength(15);
    for (const s of stars) {
      expect(Math.hypot(s.x, s.z)).toBeLessThan(ISLAND_RADIUS - CAR.radius);
      for (const c of colliders)
        expect(Math.hypot(s.x - c.x, s.z - c.z), `star at ${s.x},${s.z}`).toBeGreaterThan(
          c.r + CAR.radius,
        );
    }
  });

  it('keeps the spawn, the ramp landings and the race gates free', () => {
    const spots = [
      SPAWN,
      ...RAMPS.map((r) => ({ x: r.x, z: r.z - r.len / 2 - 6 })),
      ...GATES.map((g) => ({ x: g.x, z: g.z + 4 })),
      { x: GARAGE_DOOR.x, z: GARAGE_DOOR.z + 2 },
      POND,
    ];
    for (const p of spots)
      for (const c of colliders)
        expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThan(c.r + CAR.radius);
  });

  it('the spawn is outside every trigger and the pond', () => {
    for (const t of [GARAGE_DOOR, ...GATES]) expect(inTrigger(t, SPAWN.x, SPAWN.z)).toBe(false);
    expect(Math.hypot(SPAWN.x - POND.x, SPAWN.z - POND.z)).toBeGreaterThan(POND.r);
  });

  it('every star can be picked up by driving to it', () => {
    const island = makeIsland(decor);
    for (const [i, s] of makeStars().entries()) {
      const car = newCar(SPAWN.x, SPAWN.z, SPAWN.heading);
      const stars = makeStars();
      let got = false;
      for (let t = 0; t < 60 * 30 && !got; t++) {
        stepCar(car, s, island, DT);
        got = collectStars(stars, car).includes(i);
      }
      expect(got, `star ${i} at ${s.x},${s.z}`).toBe(true);
    }
  });
});
