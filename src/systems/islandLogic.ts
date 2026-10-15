/**
 * Осман's island: arcade driving rules in world units (metres-ish), free of Phaser and Three.js.
 * The car follows a target point on the ground, slides along solid things, jumps off ramps and
 * knocks over pins, boxes and cones. Nothing ever crashes or ends the game.
 */

export const CAR = {
  radius: 1.3,
  maxSpeed: 15,
  accel: 14,
  brake: 16,
  /** rad/s */
  turn: 3,
  /** closer than this the car is "there" and stops */
  arrive: 1.6,
} as const;
export const GRAVITY = 25;
/** Speed factor while driving through the pond. */
export const WATER_SLOW = 0.6;
/** Knocked-over things stand up again after this many seconds. */
export const RESET_AFTER = 15;
/** After a strike, the pins stand up again after this many seconds. */
export const STRIKE_RESET = 2.5;
/** Car centre height above its wheels, for star pickup. */
const CAR_MID = 0.8;

export interface Vec {
  x: number;
  z: number;
}

export interface Car {
  x: number;
  z: number;
  /** height of the car's base (0 on the ground) */
  y: number;
  /** rotation around the vertical axis; forward is (sin, cos) */
  heading: number;
  speed: number;
  vy: number;
  air: boolean;
  airTime: number;
}

export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** A wedge rising along `heading`, from 0 at the back edge to `height` at the front edge. */
export interface Ramp {
  x: number;
  z: number;
  heading: number;
  len: number;
  width: number;
  height: number;
}

export interface Pond {
  x: number;
  z: number;
  r: number;
}

export interface Island {
  /** the car is gently kept inside this radius */
  radius: number;
  colliders: readonly Circle[];
  ramps: readonly Ramp[];
  pond: Pond;
}

export function newCar(x: number, z: number, heading = 0): Car {
  return { x, z, y: 0, heading, speed: 0, vy: 0, air: false, airTime: 0 };
}

export function forward(heading: number): Vec {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

/** Shortest signed angle from a to b, in (-π, π]. */
export function angleTo(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

/** Ramp surface height under a point, or null when the point is not on the ramp. */
export function rampHeight(r: Ramp, x: number, z: number): number | null {
  const f = forward(r.heading);
  const dx = x - r.x;
  const dz = z - r.z;
  const along = dx * f.x + dz * f.z;
  const across = dx * f.z - dz * f.x;
  if (Math.abs(along) > r.len / 2 || Math.abs(across) > r.width / 2) return null;
  return ((along + r.len / 2) / r.len) * r.height;
}

export function groundHeight(island: Island, x: number, z: number): number {
  let h = 0;
  for (const r of island.ramps) h = Math.max(h, rampHeight(r, x, z) ?? 0);
  return h;
}

export function inWater(p: Pond, x: number, z: number): boolean {
  return Math.hypot(x - p.x, z - p.z) < p.r - 0.5;
}

export interface CarEvents {
  /** how hard the car bumped into something solid (0 = no bump), in units/s */
  bump: number;
  launched: boolean;
  /** seconds in the air, set on the frame the car lands */
  landed: number;
  water: boolean;
}

/**
 * Moves the car one step toward `target` (null = finger lifted, roll to a stop),
 * over ramps and around solid things.
 */
export function stepCar(car: Car, target: Vec | null, island: Island, dt: number): CarEvents {
  const ev: CarEvents = { bump: 0, launched: false, landed: 0, water: false };
  const water = !car.air && inWater(island.pond, car.x, car.z);
  ev.water = water;

  let want = 0;
  if (target && !car.air) {
    const aim = steerAround(car, target, island.colliders);
    const dx = aim.x - car.x;
    const dz = aim.z - car.z;
    // arrival and speed go by the finger itself, not the detour point
    const dist = Math.hypot(target.x - car.x, target.z - car.z);
    if (dist > CAR.arrive) {
      const err = angleTo(car.heading, Math.atan2(dx, dz));
      // turn faster when moving, a little even when standing still
      const turn = CAR.turn * (0.45 + 0.55 * Math.min(1, Math.abs(car.speed) / 6));
      car.heading += Math.sign(err) * Math.min(Math.abs(err), turn * dt);
      // slow down for sharp turns and near the finger
      want =
        Math.min(CAR.maxSpeed, dist * 1.4) * Math.max(0.25, Math.cos(Math.min(Math.abs(err), 1.4)));
    }
  }
  if (water) want *= WATER_SLOW;
  if (!car.air) {
    const rate = want > car.speed ? CAR.accel : CAR.brake;
    car.speed += Math.sign(want - car.speed) * Math.min(Math.abs(want - car.speed), rate * dt);
  }

  const before = groundHeight(island, car.x, car.z);
  const f = forward(car.heading);
  car.x += f.x * car.speed * dt;
  car.z += f.z * car.speed * dt;

  // keep on the island
  const d = Math.hypot(car.x, car.z);
  if (d > island.radius) {
    car.x *= island.radius / d;
    car.z *= island.radius / d;
    const into = (f.x * car.x + f.z * car.z) / island.radius;
    if (into > 0) car.speed *= 1 - 0.7 * into;
  }

  ev.bump = Math.max(ev.bump, resolveCircles(car, island.colliders));

  const ground = groundHeight(island, car.x, car.z);
  if (car.air) {
    car.airTime += dt;
    car.vy -= GRAVITY * dt;
    car.y += car.vy * dt;
    if (car.y <= ground) {
      car.y = ground;
      car.vy = 0;
      car.air = false;
      ev.landed = car.airTime;
      car.airTime = 0;
    }
  } else if (before - ground > 0.5 && car.speed > 2) {
    // drove off the high end of a ramp: fly
    car.air = true;
    car.airTime = 0;
    car.vy = car.speed * 0.4 + 3.5;
    car.y = before;
    ev.launched = true;
  } else {
    car.y = ground;
  }
  return ev;
}

/**
 * A small helper for little drivers: when a tree or rock sits on the straight line to the finger,
 * aim past its side instead, so the car drives around it on its own.
 */
export function steerAround(car: Car, target: Vec, circles: readonly Circle[]): Vec {
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-6) return target;
  const ux = dx / dist;
  const uz = dz / dist;
  let best: { along: number; c: Circle; side: number } | null = null;
  for (const c of circles) {
    const cx = c.x - car.x;
    const cz = c.z - car.z;
    const along = cx * ux + cz * uz;
    if (along <= 0 || along > Math.min(dist, 12)) continue;
    const across = cx * uz - cz * ux;
    if (Math.abs(across) > c.r + CAR.radius + 0.3) continue;
    if (!best || along < best.along) best = { along, c, side: across >= 0 ? -1 : 1 };
  }
  if (!best) return target;
  // a point beside the obstacle, on the side the car is already leaning to
  const off = best.c.r + CAR.radius + 1.2;
  return { x: best.c.x + best.side * uz * off, z: best.c.z - best.side * ux * off };
}

/** Pushes the car out of solid circles; returns how hard it hit (speed into the obstacle). */
export function resolveCircles(car: Car, circles: readonly Circle[]): number {
  let hit = 0;
  const f = forward(car.heading);
  for (const c of circles) {
    const dx = car.x - c.x;
    const dz = car.z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + CAR.radius;
    if (d >= min) continue;
    const nx = d > 1e-6 ? dx / d : 1;
    const nz = d > 1e-6 ? dz / d : 0;
    car.x = c.x + nx * min;
    car.z = c.z + nz * min;
    // how much the car drives into the obstacle (1 = head-on)
    const into = -(f.x * nx + f.z * nz) * Math.sign(car.speed);
    if (into > 0) {
      hit = Math.max(hit, Math.abs(car.speed) * into);
      car.speed *= 1 - 0.8 * into;
    }
  }
  return hit;
}

// ---- things to knock over -------------------------------------------------------------------

export type BodyKind = 'pin' | 'box' | 'cone';

export interface Body {
  kind: BodyKind;
  /** pins in one group make a strike when all are down */
  group: string | null;
  /** standing position; y is the base height (stacked boxes sit on others) */
  home: { x: number; y: number; z: number; yaw: number };
  /** footprint radius and height */
  r: number;
  h: number;
  /** centre of mass */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  rx: number;
  rz: number;
  spinX: number;
  spinZ: number;
  state: 'stand' | 'fly' | 'down';
  /** seconds since it came to rest */
  downT: number;
  /** indices of bodies this one stands on; it falls when one of them is knocked */
  on: number[];
}

export function makeBody(
  kind: BodyKind,
  x: number,
  z: number,
  r: number,
  h: number,
  opts: { y?: number; yaw?: number; group?: string; on?: number[] } = {},
): Body {
  const b: Body = {
    kind,
    group: opts.group ?? null,
    home: { x, y: opts.y ?? 0, z, yaw: opts.yaw ?? 0 },
    r,
    h,
    x,
    y: 0,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    rx: 0,
    rz: 0,
    spinX: 0,
    spinZ: 0,
    state: 'stand',
    downT: 0,
    on: opts.on ?? [],
  };
  standUp(b);
  return b;
}

export function standUp(b: Body): void {
  b.x = b.home.x;
  b.z = b.home.z;
  b.y = b.home.y + b.h / 2;
  b.yaw = b.home.yaw;
  b.vx = b.vy = b.vz = 0;
  b.rx = b.rz = 0;
  b.spinX = b.spinZ = 0;
  b.state = 'stand';
  b.downT = 0;
}

/** Height of the centre when lying on the ground. */
function restY(b: Body): number {
  return b.kind === 'box' ? b.h / 2 : b.r;
}

function knock(b: Body, vx: number, vz: number, up: number, rng: () => number): void {
  b.state = 'fly';
  b.vx = vx;
  b.vz = vz;
  b.vy = up;
  const s = Math.hypot(vx, vz);
  if (s > 0.1) b.yaw = Math.atan2(vx, vz);
  b.spinX = 4 + s * 0.8 + rng() * 3;
  b.spinZ = (rng() - 0.5) * (2 + s * 0.6);
}

export interface BodyEvents {
  /** bodies the car knocked this step */
  knocked: number[];
  /** bodies that stood up again */
  reset: number[];
  /** groups whose last standing body just fell */
  strikes: string[];
}

/**
 * Knocks, flies and settles the bodies. `strikeT` keeps per-group timers between calls
 * (pass the same Map every step).
 */
export function stepBodies(
  bodies: Body[],
  car: Car,
  dt: number,
  strikeT: Map<string, number>,
  rng: () => number = Math.random,
): BodyEvents {
  const ev: BodyEvents = { knocked: [], reset: [], strikes: [] };
  const f = forward(car.heading);

  bodies.forEach((b, i) => {
    // the car pushes standing (or still-sliding) things it touches, unless it flies over them
    if (b.state !== 'fly' && car.y < b.y + b.h / 2 - 0.2) {
      const dx = b.x - car.x;
      const dz = b.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < CAR.radius + b.r && Math.abs(car.speed) > 0.5) {
        const nx = d > 1e-6 ? dx / d : f.x;
        const nz = d > 1e-6 ? dz / d : f.z;
        const s = Math.abs(car.speed);
        const push = 2 + s * 0.7;
        knock(
          b,
          nx * push + f.x * car.speed * 0.5,
          nz * push + f.z * car.speed * 0.5,
          3 + s * 0.35,
          rng,
        );
        b.x = car.x + nx * (CAR.radius + b.r);
        b.z = car.z + nz * (CAR.radius + b.r);
        if (b.kind === 'box') car.speed *= 0.9;
        ev.knocked.push(i);
      }
    }
    // things standing on a knocked thing fall too
    if (b.state === 'stand' && b.on.some((j) => bodies[j]!.state !== 'stand'))
      knock(b, (rng() - 0.5) * 2, (rng() - 0.5) * 2, 0.5, rng);
  });

  // flying things knock over standing ones (bowling!)
  for (const a of bodies) {
    if (a.state !== 'fly' || Math.hypot(a.vx, a.vz) < 1.5) continue;
    for (const b of bodies) {
      if (b === a || b.state !== 'stand') continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r && Math.abs(a.y - b.y) < (a.h + b.h) / 2)
        knock(b, a.vx * 0.7, a.vz * 0.7, 2 + Math.hypot(a.vx, a.vz) * 0.2, rng);
    }
  }

  bodies.forEach((b, i) => {
    if (b.state === 'fly') {
      b.vy -= GRAVITY * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.z += b.vz * dt;
      b.rx += b.spinX * dt;
      b.rz += b.spinZ * dt;
      const floor = restY(b);
      if (b.y <= floor) {
        b.y = floor;
        if (b.vy < -3) {
          b.vy = -b.vy * 0.3;
          b.vx *= 0.7;
          b.vz *= 0.7;
          b.spinX *= 0.6;
          b.spinZ *= 0.6;
        } else {
          b.vy = 0;
          const k = Math.exp(-4 * dt);
          b.vx *= k;
          b.vz *= k;
          b.spinX *= k;
          b.spinZ *= k;
          if (Math.hypot(b.vx, b.vz) < 0.3) settle(b);
        }
      }
    } else if (b.state === 'down') {
      b.downT += dt;
      if (b.downT > RESET_AFTER) {
        standUp(b);
        ev.reset.push(i);
      }
    }
  });

  // strikes: every pin of a group down
  const groups = new Set(bodies.map((b) => b.group).filter((g): g is string => g !== null));
  for (const g of groups) {
    const members = bodies.filter((b) => b.group === g);
    const allDown = members.every((b) => b.state !== 'stand');
    const t = strikeT.get(g);
    if (allDown && t === undefined) {
      strikeT.set(g, 0);
      ev.strikes.push(g);
    } else if (t !== undefined) {
      const next = t + dt;
      if (next > STRIKE_RESET) {
        strikeT.delete(g);
        bodies.forEach((b, i) => {
          if (b.group === g && b.state !== 'stand') {
            standUp(b);
            ev.reset.push(i);
          }
        });
      } else strikeT.set(g, next);
    }
  }
  return ev;
}

/** Comes to rest lying down: pins and cones on their side, boxes square on a face. */
function settle(b: Body): void {
  b.state = 'down';
  b.downT = 0;
  b.vx = b.vy = b.vz = 0;
  b.spinX = b.spinZ = 0;
  const q = Math.PI / 2;
  if (b.kind === 'box') {
    b.rx = Math.round(b.rx / q) * q;
    b.rz = Math.round(b.rz / q) * q;
  } else {
    b.rx = q;
    b.rz = 0;
  }
  b.y = restY(b);
}

// ---- stars ----------------------------------------------------------------------------------

export interface Star {
  x: number;
  y: number;
  z: number;
  taken: boolean;
}

/** Stars the car is touching now (and marks them taken). */
export function collectStars(stars: Star[], car: Car): number[] {
  const got: number[] = [];
  stars.forEach((s, i) => {
    if (s.taken) return;
    if (Math.hypot(s.x - car.x, s.z - car.z) < 2.4 && Math.abs(car.y + CAR_MID - s.y) < 2.3) {
      s.taken = true;
      got.push(i);
    }
  });
  return got;
}

/** Axis-aligned trigger box (race gates, the garage door). */
export interface Trigger {
  x: number;
  z: number;
  halfX: number;
  halfZ: number;
}

export function inTrigger(t: Trigger, x: number, z: number): boolean {
  return Math.abs(x - t.x) < t.halfX && Math.abs(z - t.z) < t.halfZ;
}
