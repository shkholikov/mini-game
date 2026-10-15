import type { TrackId } from '../i18n/ru';
import {
  CAR,
  makeBody,
  type Body,
  type Circle,
  type Island,
  type Pond,
  type Ramp,
  type Star,
  type Trigger,
} from './islandLogic';
import { createRng } from './rng';

/**
 * Layout of Осман's island in world units. North is -z (away from the camera), east is +x.
 *   centre: start plaza with the garage · north-west: race gates · north-east: ramps
 *   south-east: bowling · south: box pyramid and cone slalom · west: pond
 */
export const ISLAND_RADIUS = 52;
/** Grass ends here; sand beach to the edge of the island mesh. */
export const BEACH = 50;
export const ISLAND_EDGE = 58;

export const SPAWN = { x: 0, z: 2, heading: 0 } as const;

export const GARAGE = { x: 0, z: -13, width: 11 } as const;
export const GARAGE_DOOR: Trigger = { x: 0, z: -6.5, halfX: 2.5, halfZ: 1.5 };
/** Grandstand behind the race gates. */
export const STAND = { x: -24, z: -37 } as const;

export const POND: Pond = { x: -30, z: 10, r: 9 };

export const RAMPS: readonly Ramp[] = [
  { x: 14, z: -16, heading: Math.PI, len: 8, width: 5, height: 2.2 },
  { x: 26, z: -20, heading: Math.PI, len: 8, width: 5, height: 2.2 },
  { x: 38, z: -14, heading: Math.PI, len: 8, width: 5, height: 2.2 },
];

export interface Gate extends Trigger {
  track: TrackId;
}
/** One arch per race track; driving through it starts that race. */
export const GATES: readonly Gate[] = (['city', 'forest', 'desert'] as const).map((track, i) => ({
  track,
  x: -36 + i * 12,
  z: -26,
  halfX: 2.6,
  halfZ: 1.2,
}));
export const GATE_WIDTH = 7;

export const BOWLING = { x: 30, z: 22, laneFrom: 10 } as const;
export const PYRAMID = { x: 0, z: 27 } as const;
export const SLALOM = { z: 31, from: -27, to: -7 } as const;

export const PIN = { r: 0.42, h: 1.9 } as const;
export const BOX = { size: 1.5 } as const;
export const CONE = { r: 0.55, h: 1.5 } as const;

/** Things to knock over: 10 pins, a 4-3-2-1 box pyramid, a cone slalom. */
export function makeBodies(): Body[] {
  const out: Body[] = [];
  // pins: triangle with the head pin facing the lane (west)
  for (let row = 0; row < 4; row++)
    for (let j = 0; j <= row; j++)
      out.push(
        makeBody('pin', BOWLING.x + row * 1.3, BOWLING.z + (j - row / 2) * 1.35, PIN.r, PIN.h, {
          group: 'pins',
        }),
      );
  // box pyramid, each box resting on the two below it
  const s = BOX.size;
  let below: number[] = [];
  for (let layer = 0; layer < 4; layer++) {
    const n = 4 - layer;
    const row: number[] = [];
    for (let k = 0; k < n; k++) {
      row.push(out.length);
      out.push(
        makeBody('box', PYRAMID.x + (k - (n - 1) / 2) * (s + 0.05), PYRAMID.z, s / 2, s, {
          y: layer * s,
          on: layer === 0 ? [] : [below[k]!, below[k + 1]!],
        }),
      );
    }
    below = row;
  }
  // cones
  for (let x = SLALOM.from; x <= SLALOM.to; x += 4)
    out.push(makeBody('cone', x, SLALOM.z, CONE.r, CONE.h));
  return out;
}

/** 15 stars: 3 in the air past the ramps, 2 in the pond, the rest spread around. */
export const STARS: readonly { x: number; y: number; z: number }[] = [
  ...RAMPS.map((r) => ({ x: r.x, y: 2.6, z: r.z - r.len / 2 - 4 })),
  { x: -33, y: 1.3, z: 7 },
  { x: -26, y: 1.3, z: 14 },
  { x: -18, y: 1.3, z: -18 },
  { x: 20, y: 1.3, z: 22 },
  { x: 36, y: 1.3, z: 31 },
  { x: 7, y: 1.3, z: 34 },
  { x: -21, y: 1.3, z: 31 },
  { x: 9, y: 1.3, z: 5 },
  { x: -9, y: 1.3, z: -2 },
  { x: 41, y: 1.3, z: 5 },
  { x: -43, y: 1.3, z: -6 },
  { x: 0, y: 1.3, z: -36 },
];

export function makeStars(): Star[] {
  return STARS.map((s) => ({ ...s, taken: false }));
}

export interface Decor {
  kind: 'treeLarge' | 'treeSmall' | 'rock' | 'bush';
  x: number;
  z: number;
  size: number;
  /** solid (trees, rocks) or soft (bushes) */
  solid: boolean;
}

/** Places that must stay clear of trees and rocks. */
function keepClear(): Circle[] {
  return [
    { x: SPAWN.x, z: SPAWN.z, r: 10 },
    { x: GARAGE.x, z: GARAGE.z, r: 10 },
    { x: POND.x, z: POND.z, r: POND.r + 3 },
    ...RAMPS.flatMap((r) => [
      { x: r.x, z: r.z, r: 7 },
      // run-up and landing
      { x: r.x, z: r.z + 9, r: 6 },
      { x: r.x, z: r.z + 16, r: 6 },
      { x: r.x, z: r.z - 12, r: 8 },
    ]),
    ...GATES.flatMap((g) => [
      { x: g.x, z: g.z, r: 7 },
      { x: g.x, z: g.z + 8, r: 5 },
    ]),
    { x: STAND.x, z: STAND.z, r: 9 },
    { x: BOWLING.x, z: BOWLING.z, r: 7 },
    { x: (BOWLING.x + BOWLING.laneFrom) / 2, z: BOWLING.z, r: 11 },
    { x: PYRAMID.x, z: PYRAMID.z, r: 7 },
    { x: (SLALOM.from + SLALOM.to) / 2, z: SLALOM.z, r: 13 },
    ...STARS.map((s) => ({ x: s.x, z: s.z, r: 5 })),
  ];
}

/** Trees, rocks and bushes: a ring near the beach and a few clusters, never in the way. */
export function makeDecor(seed = 7): Decor[] {
  const rng = createRng(seed);
  const clear = keepClear();
  const out: Decor[] = [];
  const free = (x: number, z: number, r: number): boolean =>
    clear.every((c) => Math.hypot(x - c.x, z - c.z) > c.r + r) &&
    // wide enough gaps for the car to pass between any two
    out.every((d) => Math.hypot(x - d.x, z - d.z) > d.size + r + 2 * CAR.radius + 1);
  for (let i = 0; i < 400 && out.length < 70; i++) {
    const a = rng() * Math.PI * 2;
    const ring = i < 260;
    const dist = ring ? 42 + rng() * 6 : 10 + rng() * 32;
    const x = Math.cos(a) * dist;
    const z = Math.sin(a) * dist;
    const roll = rng();
    const kind: Decor['kind'] =
      roll < 0.4 ? 'treeLarge' : roll < 0.65 ? 'treeSmall' : roll < 0.8 ? 'rock' : 'bush';
    const size = kind === 'treeLarge' ? 1.5 : kind === 'treeSmall' ? 1.1 : 0.9 + rng() * 0.8;
    if (!free(x, z, size)) continue;
    out.push({ kind, x, z, size, solid: kind !== 'bush' });
  }
  return out;
}

/** Solid circles the car slides around. */
export function makeColliders(decor: readonly Decor[]): Circle[] {
  const gatePosts = GATES.flatMap((g) => [
    { x: g.x - GATE_WIDTH / 2, z: g.z, r: 0.6 },
    { x: g.x + GATE_WIDTH / 2, z: g.z, r: 0.6 },
  ]);
  // one round collider each, so the car's auto-steering goes around them, not into a gap
  const garage = { x: GARAGE.x, z: GARAGE.z, r: GARAGE.width / 2 };
  const stand = { x: STAND.x, z: STAND.z, r: 6 };
  return [
    ...decor.filter((d) => d.solid).map((d) => ({ x: d.x, z: d.z, r: d.size })),
    ...gatePosts,
    garage,
    stand,
  ];
}

export function makeIsland(decor: readonly Decor[]): Island {
  return { radius: ISLAND_RADIUS, colliders: makeColliders(decor), ramps: RAMPS, pond: POND };
}
