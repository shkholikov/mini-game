import * as THREE from 'three';
import type { Body, Car, Star } from '../systems/islandLogic';
import { forward, rampHeight } from '../systems/islandLogic';
import {
  BEACH,
  BOWLING,
  CONE,
  GARAGE,
  GARAGE_DOOR,
  GATES,
  GATE_WIDTH,
  ISLAND_EDGE,
  PIN,
  POND,
  PYRAMID,
  RAMPS,
  SLALOM,
  SPAWN,
  STAND,
  type Decor,
} from '../systems/islandMap';
import { TRACKS } from '../systems/raceLogic';
import { model, wheels } from './models';
import { rock, starGeometry, starMaterial } from './RaceWorld';
import { skyTexture } from './stage';

const CAR_SCALE = 1.3;
/** Camera offset from the car: high and tilted down, never turning, like a toy-table view. */
const CAM = new THREE.Vector3(0, 17, 19);
const PUFFS = 70;
const RINGS = 24;

interface Puff {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  max: number;
  vel: THREE.Vector3;
  grow: number;
}

interface Ring {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
}

/** Draws Осман's island. The rules live in IslandScene / islandLogic; this mirrors them in 3D. */
export class IslandWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 320);
  private readonly carRoot = new THREE.Group();
  private readonly carTilt = new THREE.Group();
  private readonly carWheels: THREE.Object3D[];
  private readonly sun: THREE.DirectionalLight;
  private readonly look = new THREE.Vector3();
  private readonly stars: { obj: THREE.Object3D; t: number; was: boolean }[] = [];
  private readonly bodies: { obj: THREE.Object3D; pop: number; was: Body['state'] }[] = [];
  private readonly puffs: Puff[] = [];
  private readonly rings: Ring[] = [];
  private readonly seaTex: THREE.CanvasTexture;
  private readonly doorPad: THREE.Mesh;
  private nextPuff = 0;
  private nextRing = 0;
  private wakeT = 0;
  private lastHeading = 0;
  private roll = 0;
  private pitch = 0;
  private squash = 0;
  private wobble = 0;
  private time = 0;

  constructor(
    carName: string,
    decor: readonly Decor[],
    stars: readonly Star[],
    bodies: readonly Body[],
  ) {
    const s = this.scene;
    s.background = skyTexture('#6cc4ff', '#e4f6ff');
    s.fog = new THREE.Fog(0xcfeeff, 70, 150);

    s.add(new THREE.HemisphereLight(0xffffff, 0x7d9a62, 1.5));
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -30,
      right: 30,
      top: 30,
      bottom: -30,
      near: 1,
      far: 90,
    });
    this.sun.shadow.bias = -0.0005;
    s.add(this.sun, this.sun.target);

    // sea, beach foam, island
    this.seaTex = seaTexture();
    this.seaTex.repeat.set(30, 30);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshStandardMaterial({ map: this.seaTex, roughness: 0.4 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.7;
    s.add(sea);
    const foam = new THREE.Mesh(
      new THREE.RingGeometry(ISLAND_EDGE + 0.5, ISLAND_EDGE + 2.5, 96),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }),
    );
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = -0.6;
    foam.name = 'foam';
    s.add(foam);
    const side = new THREE.Mesh(
      new THREE.CylinderGeometry(ISLAND_EDGE, ISLAND_EDGE + 1.5, 3, 96, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe2c286, roughness: 1 }),
    );
    side.position.y = -1.5;
    s.add(side);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(ISLAND_EDGE, 96),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);

    // pond water over its painted bed
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(POND.r, 48),
      new THREE.MeshStandardMaterial({
        color: 0x47c4ef,
        transparent: true,
        opacity: 0.78,
        roughness: 0.15,
        metalness: 0.1,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(POND.x, 0.3, POND.z);
    water.receiveShadow = true;
    s.add(water);

    // glowing pad in front of the garage: "drive here"
    this.doorPad = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.2, 40),
      new THREE.MeshBasicMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.8 }),
    );
    this.doorPad.rotation.x = -Math.PI / 2;
    this.doorPad.position.set(GARAGE_DOOR.x, 0.05, GARAGE_DOOR.z);
    s.add(this.doorPad);

    this.addGarage();
    this.addGates();
    this.addRamps();
    this.addBowlingLane();
    for (const d of decor) s.add(decorModel(d));

    // stars
    const starGeo = starGeometry();
    const starMat = starMaterial();
    for (const st of stars) {
      const mesh = new THREE.Mesh(starGeo, starMat);
      mesh.castShadow = true;
      const obj = new THREE.Group().add(mesh);
      obj.scale.setScalar(1.35);
      obj.position.set(st.x, st.y, st.z);
      s.add(obj);
      this.stars.push({ obj, t: -1, was: st.taken });
    }

    // pins, boxes, cones
    for (const b of bodies) {
      const obj = bodyModel(b);
      obj.rotation.order = 'YXZ';
      s.add(obj);
      this.bodies.push({ obj, pop: -1, was: b.state });
    }

    // player car: root (position + heading) → tilt (pitch, roll, squash) → model
    const car = model(carName, CAR_SCALE);
    this.carWheels = wheels(car);
    this.carTilt.add(car);
    this.carRoot.add(this.carTilt);
    this.carRoot.position.set(SPAWN.x, 0, SPAWN.z);
    this.carRoot.rotation.y = SPAWN.heading;
    this.lastHeading = SPAWN.heading;
    s.add(this.carRoot);

    for (let i = 0; i < PUFFS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), mat);
      mesh.visible = false;
      s.add(mesh);
      this.puffs.push({ mesh, mat, life: 0, max: 1, vel: new THREE.Vector3(), grow: 1 });
    }
    for (let i = 0; i < RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      const mesh = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      s.add(mesh);
      this.rings.push({ mesh, mat, life: 0 });
    }

    this.look.set(SPAWN.x, 0, SPAWN.z);
    this.camera.position.copy(this.look).add(CAM);
    this.camera.lookAt(this.look);
  }

  private addGarage(): void {
    const g = model('pitsGarage');
    const box = new THREE.Box3().setFromObject(g);
    g.scale.setScalar(GARAGE.width / Math.max(0.01, box.max.x - box.min.x));
    g.position.set(GARAGE.x, 0, GARAGE.z);
    this.scene.add(g);
  }

  private addGates(): void {
    GATES.forEach((gate) => {
      const track = TRACKS[gate.track];
      const arch = model('overheadLights');
      const box = new THREE.Box3().setFromObject(arch);
      arch.scale.setScalar((GATE_WIDTH + 1) / Math.max(0.01, box.max.x - box.min.x));
      arch.rotation.y = Math.PI;
      arch.position.set(gate.x, 0, gate.z);
      this.scene.add(arch);
      for (const side of [-1, 1]) {
        const flag = model('flagCheckers', 3.5);
        flag.position.set(gate.x + side * (GATE_WIDTH / 2 + 1.2), 0, gate.z - 1);
        this.scene.add(flag);
        // a hint of the track's world next to each gate
        const hint =
          gate.track === 'city'
            ? model('lightPostLarge', 4)
            : gate.track === 'forest'
              ? model('treeSmall', 3.5)
              : rock(1.2);
        hint.position.set(gate.x + side * (GATE_WIDTH / 2 + 2.6), 0, gate.z - 3);
        this.scene.add(hint);
      }
      // a glowing strip in the track's colours under the arch
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(GATE_WIDTH - 1, 1.2),
        new THREE.MeshBasicMaterial({ map: checkerTexture(track.ground) }),
      );
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(gate.x, 0.04, gate.z);
      this.scene.add(strip);
    });
    const stand = model('grandStand');
    const box = new THREE.Box3().setFromObject(stand);
    stand.scale.setScalar(12 / Math.max(0.01, box.max.x - box.min.x));
    stand.position.set(STAND.x, 0, STAND.z);
    this.scene.add(stand);
  }

  private addRamps(): void {
    const stripes = stripeTexture();
    const red = new THREE.MeshStandardMaterial({ color: 0xe8463c, roughness: 0.6 });
    const top = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 });
    for (const r of RAMPS) {
      const shape = new THREE.Shape();
      shape.moveTo(-r.len / 2, 0);
      shape.lineTo(r.len / 2, 0);
      shape.lineTo(r.len / 2, r.height);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: r.width, bevelEnabled: false });
      geo.translate(0, 0, -r.width / 2);
      // shape x → along the ramp (local +z), extrusion → across
      geo.rotateY(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, [red, top]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(r.x, 0, r.z);
      mesh.rotation.y = r.heading;
      this.scene.add(mesh);
    }
  }

  private addBowlingLane(): void {
    // little guide rails along the lane
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const len = BOWLING.x - BOWLING.laneFrom - 2;
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.3), mat);
      rail.position.set(BOWLING.laneFrom + len / 2, 0.17, BOWLING.z + side * 3.3);
      rail.castShadow = true;
      this.scene.add(rail);
    }
  }

  update(p: {
    car: Car;
    bodies: readonly Body[];
    stars: readonly Star[];
    water: boolean;
    dt: number;
  }): void {
    const { car, dt } = p;
    this.time += dt;

    // car
    this.carRoot.position.set(car.x, car.y, car.z);
    this.carRoot.rotation.y = car.heading;
    const turn = (car.heading - this.lastHeading) / Math.max(dt, 1e-3);
    this.lastHeading = car.heading;
    this.roll +=
      (THREE.MathUtils.clamp(-turn * car.speed * 0.012, -0.14, 0.14) - this.roll) *
      Math.min(1, dt * 8);
    let pitchTarget = 0;
    if (car.air) pitchTarget = THREE.MathUtils.clamp(-car.vy * 0.04, -0.35, 0.4);
    else
      for (const r of RAMPS)
        if (rampHeight(r, car.x, car.z) !== null) {
          const f = forward(car.heading);
          const rf = forward(r.heading);
          pitchTarget = -Math.atan(r.height / r.len) * (f.x * rf.x + f.z * rf.z);
        }
    this.pitch += (pitchTarget - this.pitch) * Math.min(1, dt * 10);
    this.squash = Math.max(0, this.squash - dt * 4);
    this.wobble = Math.max(0, this.wobble - dt * 3);
    this.carTilt.rotation.set(
      this.pitch,
      0,
      this.roll + Math.sin(this.time * 40) * this.wobble * 0.08,
    );
    const sq = Math.sin(this.squash * Math.PI) * 0.18;
    this.carTilt.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    for (const w of this.carWheels) w.rotation.x += (car.speed * dt) / 0.35;

    // splashes and wake rings in the pond
    if (p.water && Math.abs(car.speed) > 1.5) {
      this.wakeT -= dt;
      if (this.wakeT <= 0) {
        this.wakeT = 0.07;
        const f = forward(car.heading);
        this.ring(car.x - f.x * 1.6, car.z - f.z * 1.6);
        for (const side of [-1, 1])
          this.puff(
            car.x - f.x * 1.2 + f.z * side * 0.9,
            0.4,
            car.z - f.z * 1.2 - f.x * side * 0.9,
            0xd8f6ff,
            new THREE.Vector3(f.z * side * 2.5, 3 + Math.random() * 2, -f.x * side * 2.5),
            0.6,
          );
      }
    }

    this.syncStars(p.stars, dt);
    this.syncBodies(p.bodies, dt);
    this.stepPuffs(dt);
    this.stepRings(dt);

    this.seaTex.offset.x = Math.sin(this.time * 0.3) * 0.04;
    this.seaTex.offset.y = this.time * 0.01;
    const pad = 1 + Math.sin(this.time * 4) * 0.08;
    this.doorPad.scale.set(pad, pad, 1);

    // camera and the sun's shadow box follow the car
    const k = 1 - Math.exp(-4 * dt);
    this.look.x += (car.x - this.look.x) * k;
    this.look.z += (car.z - this.look.z) * k;
    this.look.y += (car.y * 0.5 - this.look.y) * k;
    this.camera.position.copy(this.look).add(CAM);
    this.camera.lookAt(this.look);
    this.sun.position.set(this.look.x + 14, 34, this.look.z + 12);
    this.sun.target.position.set(this.look.x, 0, this.look.z);
  }

  private syncStars(stars: readonly Star[], dt: number): void {
    stars.forEach((st, i) => {
      const v = this.stars[i]!;
      if (st.taken && !v.was) v.t = 0;
      if (!st.taken && v.was) {
        // respawn with a pop
        v.t = -1;
        v.obj.visible = true;
        v.obj.position.y = st.y;
        v.obj.scale.setScalar(0.01);
      }
      v.was = st.taken;
      if (v.t >= 0) {
        v.t += dt;
        v.obj.position.y += dt * 7;
        v.obj.rotation.y += dt * 16;
        v.obj.scale.setScalar(Math.max(0.01, 1.35 * (1 - v.t * 1.6)));
        if (v.t > 0.6) {
          v.obj.visible = false;
          v.t = -2;
        }
        return;
      }
      if (st.taken) return;
      const s = v.obj.scale.x;
      if (s < 1.35) v.obj.scale.setScalar(Math.min(1.35, s + dt * 3));
      v.obj.rotation.y += dt * 2.5;
      v.obj.position.y = st.y + Math.sin(this.time * 2.5 + i) * 0.2;
    });
  }

  private syncBodies(bodies: readonly Body[], dt: number): void {
    bodies.forEach((b, i) => {
      const v = this.bodies[i]!;
      if (b.state === 'stand' && v.was !== 'stand') v.pop = 0;
      v.was = b.state;
      v.obj.position.set(b.x, b.y, b.z);
      v.obj.rotation.set(b.rx, b.yaw, b.rz);
      if (v.pop >= 0) {
        v.pop += dt;
        const t = Math.min(1, v.pop / 0.35);
        v.obj.scale.setScalar(t < 1 ? Math.sin(t * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1);
        if (t >= 1) v.pop = -1;
      }
    });
  }

  private puff(
    x: number,
    y: number,
    z: number,
    color: number,
    vel: THREE.Vector3,
    max = 0.8,
    grow = 1.6,
  ): void {
    const p = this.puffs[this.nextPuff]!;
    this.nextPuff = (this.nextPuff + 1) % PUFFS;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(0.5 + Math.random() * 0.5);
    p.mat.color.setHex(color);
    p.mat.opacity = 0.9;
    p.vel.copy(vel);
    p.life = 0;
    p.max = max;
    p.grow = grow;
  }

  private stepPuffs(dt: number): void {
    for (const p of this.puffs) {
      if (!p.mesh.visible) continue;
      p.life += dt;
      if (p.life >= p.max) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 6 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.multiplyScalar(1 + p.grow * dt);
      p.mat.opacity = 0.9 * (1 - p.life / p.max);
    }
  }

  private ring(x: number, z: number): void {
    const r = this.rings[this.nextRing]!;
    this.nextRing = (this.nextRing + 1) % RINGS;
    r.mesh.visible = true;
    r.mesh.position.set(x, 0.33, z);
    r.mesh.scale.setScalar(1);
    r.life = 0;
  }

  private stepRings(dt: number): void {
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.life += dt;
      if (r.life > 1.2) {
        r.mesh.visible = false;
        continue;
      }
      r.mesh.scale.setScalar(1 + r.life * 3);
      r.mat.opacity = 0.7 * (1 - r.life / 1.2);
    }
  }

  /** Dust burst when the car lands, a bigger one for a big jump. */
  landing(air: number): void {
    this.squash = 1;
    const c = this.carRoot.position;
    const n = Math.min(14, 5 + Math.round(air * 10));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.puff(
        c.x,
        c.y + 0.3,
        c.z,
        0xf3e3c0,
        new THREE.Vector3(Math.cos(a) * 5, 2, Math.sin(a) * 5),
        0.7,
      );
    }
  }

  bump(): void {
    this.wobble = 1;
    const c = this.carRoot.position;
    for (let i = 0; i < 4; i++)
      this.puff(
        c.x,
        0.6,
        c.z,
        0xffffff,
        new THREE.Vector3((Math.random() - 0.5) * 4, 3, (Math.random() - 0.5) * 4),
        0.5,
      );
  }

  /** A big splash when the car drives into the pond. */
  splash(): void {
    const c = this.carRoot.position;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      this.puff(
        c.x,
        0.4,
        c.z,
        0xc8f1ff,
        new THREE.Vector3(Math.cos(a) * 3, 5 + Math.random() * 3, Math.sin(a) * 3),
        0.8,
        1,
      );
    }
  }

  /** Sparkles where something was knocked over. */
  hit(x: number, y: number, z: number): void {
    for (let i = 0; i < 2; i++)
      this.puff(
        x,
        y,
        z,
        0xfff3b0,
        new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          3 + Math.random() * 2,
          (Math.random() - 0.5) * 5,
        ),
        0.45,
        0.5,
      );
  }

  /** World position of a body (to put confetti on screen over it). */
  bodyPos(i: number): THREE.Vector3 {
    return this.bodies[i]!.obj.position.clone();
  }

  carPos(): THREE.Vector3 {
    return this.carRoot.position.clone();
  }
}

// ---- models made in code --------------------------------------------------------------------

/** A model scaled so its largest footprint side (x or z) is `size`. */
function sized(name: string, size: number, by: 'x' | 'y' = 'x'): THREE.Object3D {
  const o = model(name);
  const b = new THREE.Box3().setFromObject(o);
  const d = by === 'x' ? Math.max(b.max.x - b.min.x, b.max.z - b.min.z) : b.max.y - b.min.y;
  o.scale.setScalar(size / Math.max(d, 0.001));
  return o;
}

function bodyModel(b: Body): THREE.Object3D {
  const g = new THREE.Group();
  let inner: THREE.Object3D;
  if (b.kind === 'pin') {
    const profile = [
      [0, 0],
      [0.28, 0],
      [0.42, 0.5],
      [0.36, 0.95],
      [0.19, 1.28],
      [0.23, 1.55],
      [0.19, 1.82],
      [0, PIN.h],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    inner = new THREE.Group();
    const white = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
    );
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.205, 0.14, 16),
      new THREE.MeshStandardMaterial({ color: 0xe8463c, roughness: 0.4 }),
    );
    band.position.y = 1.3;
    white.castShadow = band.castShadow = true;
    inner.add(white, band);
  } else if (b.kind === 'box') {
    inner = sized('box', b.h, 'y');
  } else {
    inner = sized('cone', CONE.h, 'y');
  }
  inner.position.y = -b.h / 2;
  g.add(inner);
  return g;
}

function decorModel(d: Decor): THREE.Object3D {
  let o: THREE.Object3D;
  switch (d.kind) {
    case 'treeLarge':
      o = sized('treeLarge', 4.2 * d.size, 'y');
      break;
    case 'treeSmall':
      o = sized('treeSmall', 3.6 * d.size, 'y');
      break;
    case 'rock':
      o = rock(d.size * 1.7);
      break;
    case 'bush':
      o = bush(d.size);
      break;
  }
  o.position.set(d.x, 0, d.z);
  o.rotation.y = (d.x * 13.7 + d.z * 7.3) % (Math.PI * 2);
  return o;
}

function bush(size: number): THREE.Object3D {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x5fb04a, flatShading: true, roughness: 1 });
  const parts = [
    [0, 0.6, 0, 0.9],
    [0.7, 0.45, 0.2, 0.65],
    [-0.6, 0.45, -0.1, 0.7],
  ] as const;
  for (const [x, y, z, r] of parts) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * size, 0), mat);
    m.position.set(x * size, y * size, z * size);
    m.castShadow = true;
    g.add(m);
  }
  return g;
}

// ---- textures -------------------------------------------------------------------------------

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function texture(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/**
 * The whole island painted once: grass, beach, sandy paths, plaza, race asphalt,
 * bowling lane, pond bed. Canvas pixels map 1:1 onto world x/z (north = canvas top).
 */
function groundTexture(): THREE.CanvasTexture {
  const S = 2048;
  const [c, ctx] = canvas(S, S);
  const k = S / (ISLAND_EDGE * 2);
  ctx.setTransform(k, 0, 0, k, ISLAND_EDGE * k, ISLAND_EDGE * k);

  ctx.fillStyle = '#f1d9a2';
  ctx.fillRect(-ISLAND_EDGE, -ISLAND_EDGE, ISLAND_EDGE * 2, ISLAND_EDGE * 2);
  // wavy grass edge
  ctx.fillStyle = '#8fd16a';
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const r = BEACH + Math.sin(a * 5) * 0.9 + Math.sin(a * 11 + 1) * 0.5;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.fill();
  // grass speckles
  let seed = 11;
  const rnd = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 5000; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * (BEACH - 1);
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(40,90,20,0.10)';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 0.15 + rnd() * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // sandy paths from the plaza to every place
  ctx.strokeStyle = '#ead6a6';
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.5;
  const path = (x1: number, z1: number, cx: number, cz: number, x2: number, z2: number): void => {
    ctx.beginPath();
    ctx.moveTo(x1, z1);
    ctx.quadraticCurveTo(cx, cz, x2, z2);
    ctx.stroke();
  };
  path(0, 0, -14, -6, -24, -19); // race gates
  path(0, 0, 14, -2, 26, -10); // ramps
  path(0, 0, 4, 18, BOWLING.laneFrom, BOWLING.z); // bowling
  path(0, 0, 2, 12, PYRAMID.x, PYRAMID.z - 3); // boxes
  path(0, 0, -10, 18, (SLALOM.from + SLALOM.to) / 2, SLALOM.z - 3); // slalom
  path(0, 0, -16, 2, POND.x + 6, POND.z - 2); // pond

  // plaza
  ctx.fillStyle = '#efe4cc';
  ctx.beginPath();
  ctx.arc(0, -1, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,130,90,0.25)';
  ctx.lineWidth = 0.12;
  for (let x = -9; x <= 9; x += 1.5) {
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.lineTo(x, 8);
    ctx.stroke();
  }
  for (let z = -10; z <= 8; z += 1.5) {
    ctx.beginPath();
    ctx.moveTo(-9, z);
    ctx.lineTo(9, z);
    ctx.stroke();
  }
  ctx.strokeStyle = '#d8c7a2';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(0, -1, 8.5, 0, Math.PI * 2);
  ctx.stroke();

  // race corner: asphalt with each gate's own road colour
  const g0 = GATES[0]!;
  const g2 = GATES[GATES.length - 1]!;
  roundRect(ctx, g0.x - 6, g0.z - 6, g2.x - g0.x + 12, 12, 2.5, '#5d6166');
  for (const gate of GATES) {
    const t = TRACKS[gate.track];
    roundRect(ctx, gate.x - GATE_WIDTH / 2 + 0.5, gate.z - 5, GATE_WIDTH - 1, 10, 1.5, hex(t.road));
    roundRect(ctx, gate.x - 2, gate.z + 2, 4, 2.5, 1, hex(t.ground));
  }

  // bowling lane
  roundRect(
    ctx,
    BOWLING.laneFrom,
    BOWLING.z - 3,
    BOWLING.x - BOWLING.laneFrom + 7,
    6,
    1,
    '#e7b877',
  );
  ctx.strokeStyle = 'rgba(150,90,40,0.35)';
  ctx.lineWidth = 0.1;
  for (let z = BOWLING.z - 2.5; z <= BOWLING.z + 2.5; z += 0.5) {
    ctx.beginPath();
    ctx.moveTo(BOWLING.laneFrom + 0.5, z);
    ctx.lineTo(BOWLING.x + 6.5, z);
    ctx.stroke();
  }
  ctx.fillStyle = '#d7473d';
  for (let i = 0; i < 5; i++) {
    const x = BOWLING.x - 9 + i * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, BOWLING.z - 0.4 + (i - 2) * 0.8);
    ctx.lineTo(x + 0.9, BOWLING.z + (i - 2) * 0.8);
    ctx.lineTo(x, BOWLING.z + 0.4 + (i - 2) * 0.8);
    ctx.fill();
  }

  // pond bed and its muddy shore
  ctx.fillStyle = '#c9b27a';
  ctx.beginPath();
  ctx.arc(POND.x, POND.z, POND.r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b7f96';
  ctx.beginPath();
  ctx.arc(POND.x, POND.z, POND.r, 0, Math.PI * 2);
  ctx.fill();

  // garage forecourt
  roundRect(ctx, GARAGE.x - GARAGE.width / 2, GARAGE.z + 2, GARAGE.width, 6, 1, '#cfd6dd');

  return texture(c);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function seaTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#3aa6dd';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const x = (i * 47) % 128;
    const y = (i * 71) % 128;
    ctx.beginPath();
    ctx.arc(x, y, 9, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  return texture(c, true);
}

function stripeTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  for (let i = -64; i < 64; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 80, 64);
    ctx.lineTo(i + 64, 64);
    ctx.fill();
  }
  const t = texture(c, true);
  t.repeat.set(0.5, 0.5);
  return t;
}

function checkerTexture(color: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 24);
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#ffffff' : hex(color);
      ctx.fillRect(i * 8, j * 8, 8, 8);
    }
  const t = texture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}
