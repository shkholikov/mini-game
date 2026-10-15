import * as THREE from 'three';
import type { SpawnKind, TrackDef } from '../systems/raceLogic';
import { LANE_COUNT } from '../systems/raceLogic';
import { RIVAL_CARS, model, wheels } from './models';
import { skyTexture } from './stage';

/** World units per logic pixel: race logic works in px, the 3D world in metres-ish units. */
export const K = 1 / 50;
export const LANE_W = 3;
const CURB = 0.8;
const ROAD_W = LANE_COUNT * LANE_W + CURB * 2;
const ROAD_TILE = 16;
const VIEW = 160;
const CAR_SCALE = 1.3;

export function laneToX(lane: number): number {
  return (lane - (LANE_COUNT - 1) / 2) * LANE_W;
}

export interface WorldItem {
  id: number;
  kind: SpawnKind;
  lane: number;
  d: number;
}

interface Thing {
  obj: THREE.Object3D;
  kind: SpawnKind;
  mode: 'live' | 'collect' | 'knock';
  t: number;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  wheels: THREE.Object3D[];
}

/** Draws the race. All game rules stay in RaceScene; this only mirrors them in 3D. */
export class RaceWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 400);
  private readonly car: THREE.Object3D;
  private readonly carWheels: THREE.Object3D[];
  private readonly things = new Map<number, Thing>();
  private readonly decor: THREE.Object3D[] = [];
  private readonly roadTex: THREE.CanvasTexture;
  private readonly groundTex: THREE.CanvasTexture;
  private readonly finish: THREE.Object3D;
  private readonly start: THREE.Object3D;
  private readonly starGeo: THREE.ExtrudeGeometry;
  private readonly starMat: THREE.MeshStandardMaterial;
  private nextDecorZ = 0;
  private shakeT = 0;
  private fov = 58;

  constructor(
    private readonly track: TrackDef,
    carName: string,
  ) {
    const s = this.scene;
    s.background = skyTexture(track.sky[0], track.sky[1]);
    s.fog = new THREE.Fog(new THREE.Color(track.sky[1]), 70, VIEW);

    s.add(new THREE.HemisphereLight(0xffffff, 0x6a7f5a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
    sun.position.set(10, 22, 8);
    sun.target.position.set(0, 0, -8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -16,
      right: 16,
      top: 24,
      bottom: -12,
      near: 1,
      far: 70,
    });
    s.add(sun, sun.target);

    this.groundTex = groundTexture(track.ground);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ map: this.groundTex, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -150;
    ground.receiveShadow = true;
    s.add(ground);

    this.roadTex = roadTexture(track.road);
    this.roadTex.repeat.set(1, 400 / ROAD_TILE);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W, 400),
      new THREE.MeshStandardMaterial({ map: this.roadTex, roughness: 0.85 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -150);
    road.receiveShadow = true;
    s.add(road);

    // low rails along both edges
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2 });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 400), railMat);
      rail.position.set(side * (ROAD_W / 2 + 0.3), 0.25, -150);
      rail.castShadow = true;
      s.add(rail);
    }

    this.car = model(carName, CAR_SCALE);
    this.car.rotation.y = Math.PI;
    s.add(this.car);
    this.carWheels = wheels(this.car);

    this.start = this.gantry();
    this.start.position.z = -4;
    this.finish = this.gantry();
    s.add(this.start, this.finish);

    this.starGeo = starGeometry();
    this.starMat = starMaterial();

    this.camera.position.set(0, 5.2, 9.5);
    this.camera.lookAt(0, 1.2, -12);
  }

  /** Start/finish arch with a chequered stripe on the road. */
  private gantry(): THREE.Object3D {
    const g = new THREE.Group();
    const arch = model('overheadLights', ROAD_W / 1.1);
    arch.rotation.y = Math.PI;
    g.add(arch);
    const tex = checkerTexture();
    tex.repeat.set(ROAD_W / 1.2, 1);
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_W - CURB * 2, 1.2),
      new THREE.MeshStandardMaterial({ map: tex }),
    );
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.02;
    line.receiveShadow = true;
    g.add(line);
    for (const side of [-1, 1]) {
      const flag = model('flagCheckers', 4);
      flag.position.set(side * (ROAD_W / 2 + 1.4), 0, 0);
      g.add(flag);
    }
    return g;
  }

  update(p: {
    dist: number;
    carLane: number;
    tilt: number;
    speed: number;
    boosting: boolean;
    dt: number;
    items: WorldItem[];
    finishD: number;
  }): void {
    const move = p.speed * p.dt * K;
    this.roadTex.offset.y += move / ROAD_TILE;
    this.groundTex.offset.y += move / 20;

    // player car
    const x = laneToX(p.carLane);
    this.car.position.x = x;
    this.car.rotation.y = Math.PI - p.tilt * 0.6;
    this.car.rotation.z = -p.tilt * 0.15;
    for (const w of this.carWheels) w.rotation.x -= move / 0.4;

    this.start.position.z = -4 + p.dist * K;
    this.finish.position.z = -(p.finishD - p.dist) * K;

    this.syncItems(p);
    this.scrollDecor(move);
    this.moveCamera(x, p.boosting, p.dt);
  }

  private syncItems(p: { dist: number; dt: number; speed: number; items: WorldItem[] }): void {
    const seen = new Set<number>();
    for (const it of p.items) {
      seen.add(it.id);
      let th = this.things.get(it.id);
      if (!th) {
        th = this.create(it);
        this.things.set(it.id, th);
      }
      if (th.mode !== 'live') continue;
      const z = -(it.d - p.dist) * K;
      th.obj.position.z = z;
      const tx = laneToX(it.lane);
      th.obj.position.x += (tx - th.obj.position.x) * Math.min(1, p.dt * 6);
      if (th.kind === 'star') th.obj.rotation.y += p.dt * 3;
      if (th.kind === 'boost') {
        const m = (th.obj.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.emissiveIntensity = 0.6 + Math.sin(performance.now() / 120) * 0.4;
      }
      for (const w of th.wheels) w.rotation.x -= p.dt * 10;
    }
    for (const [id, th] of this.things) {
      if (th.mode === 'collect') {
        th.t += p.dt;
        th.obj.position.y += p.dt * 6;
        th.obj.rotation.y += p.dt * 14;
        th.obj.scale.setScalar(Math.max(0.01, 1 - th.t * 1.6));
        if (th.t > 0.6) this.remove(id);
      } else if (th.mode === 'knock') {
        th.t += p.dt;
        th.vel.y -= 25 * p.dt;
        th.obj.position.addScaledVector(th.vel, p.dt);
        th.obj.position.z += p.speed * p.dt * K;
        th.obj.rotation.x += th.spin.x * p.dt;
        th.obj.rotation.z += th.spin.z * p.dt;
        if (th.t > 1.5) this.remove(id);
      } else if (!seen.has(id)) {
        this.remove(id);
      }
    }
  }

  private create(it: WorldItem): Thing {
    let obj: THREE.Object3D;
    let ws: THREE.Object3D[] = [];
    switch (it.kind) {
      case 'star': {
        const mesh = new THREE.Mesh(this.starGeo, this.starMat);
        mesh.userData.shared = true;
        mesh.castShadow = true;
        mesh.position.y = 1.3;
        obj = new THREE.Group().add(mesh);
        break;
      }
      case 'boost':
        obj = chevrons();
        break;
      case 'rival': {
        obj = model(RIVAL_CARS[it.id % RIVAL_CARS.length]!, CAR_SCALE);
        obj.rotation.y = Math.PI;
        ws = wheels(obj);
        break;
      }
      case 'cone_straight':
        obj = model('cone', 2.4);
        break;
      case 'barrel_red':
      case 'barrel_blue':
        obj = barrel(it.kind === 'barrel_red' ? 0xe8463c : 0x3a7be8);
        break;
      case 'tires_red':
        obj = tires();
        break;
      case 'oil':
        obj = oil();
        break;
      case 'rock1':
        obj = rock(1.1);
        break;
    }
    obj.position.x = laneToX(it.lane);
    this.scene.add(obj);
    return {
      obj,
      kind: it.kind,
      mode: 'live',
      t: 0,
      vel: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      wheels: ws,
    };
  }

  private remove(id: number): void {
    const th = this.things.get(id);
    if (!th) return;
    this.scene.remove(th.obj);
    this.things.delete(id);
  }

  collect(id: number): void {
    const th = this.things.get(id);
    if (th) th.mode = 'collect';
  }

  /** Obstacle flies off the road, tumbling. */
  knock(id: number, dir: number): void {
    const th = this.things.get(id);
    if (!th || th.kind === 'rival') return;
    th.mode = 'knock';
    th.vel.set(dir * 9, 9, -4);
    th.spin.set(8, 0, dir * 10);
  }

  shake(): void {
    this.shakeT = 0.3;
  }

  private moveCamera(carX: number, boosting: boolean, dt: number): void {
    this.fov += ((boosting ? 72 : 58) - this.fov) * Math.min(1, dt * 4);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    const cx = carX * 0.55;
    this.camera.position.x += (cx - this.camera.position.x) * Math.min(1, dt * 5);
    this.camera.position.y = 5.2;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.camera.position.x += (Math.random() - 0.5) * 0.4;
      this.camera.position.y += (Math.random() - 0.5) * 0.3;
    }
    this.camera.lookAt(carX * 0.7, 1.2, -12);
  }

  private scrollDecor(move: number): void {
    for (const d of this.decor) d.position.z += move;
    while (this.decor.length && this.decor[0]!.position.z > 14)
      this.scene.remove(this.decor.shift()!);
    // keep the roadside filled up to the fog line
    this.nextDecorZ += move;
    while (this.nextDecorZ > -VIEW) {
      for (const side of [-1, 1]) {
        if (Math.random() < 0.25) continue;
        const name = this.track.decor[Math.floor(Math.random() * this.track.decor.length)]!;
        const obj = this.decorModel(name, side);
        obj.position.x += side * (ROAD_W / 2 + 2.5 + Math.random() * 9);
        obj.position.z = this.nextDecorZ - Math.random() * 4;
        this.scene.add(obj);
        this.decor.push(obj);
      }
      this.nextDecorZ -= 7 + Math.random() * 6;
    }
  }

  private decorModel(name: string, side: number): THREE.Object3D {
    switch (name) {
      case 'rock':
        return rock(1.4 + Math.random() * 1.6);
      case 'grandStand': {
        const o = model(name, 5);
        // seats face the road
        o.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        o.position.x = side * 5;
        return o;
      }
      case 'billboard':
      case 'tent': {
        const o = model(name, 5);
        o.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
        return o;
      }
      case 'treeLarge':
      case 'treeSmall':
        return model(name, 4 + Math.random() * 1.5);
      default:
        return model(name, 5);
    }
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

function finishTexture(
  c: HTMLCanvasElement,
  wrapS: THREE.Wrapping = THREE.RepeatWrapping,
): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = wrapS;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function roadTexture(color: number): THREE.CanvasTexture {
  const W = 512;
  const H = 512;
  const [c, ctx] = canvas(W, H);
  ctx.fillStyle = hex(color);
  ctx.fillRect(0, 0, W, H);
  // speckle
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
  }
  const curb = (CURB / ROAD_W) * W;
  for (let y = 0; y < H; y += 64) {
    ctx.fillStyle = (y / 64) % 2 ? '#ffffff' : '#e8463c';
    ctx.fillRect(0, y, curb, 64);
    ctx.fillRect(W - curb, y, curb, 64);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const lane = (LANE_W / ROAD_W) * W;
  for (let l = 1; l < LANE_COUNT; l++) {
    const x = curb + l * lane - 5;
    ctx.fillRect(x, 0, 10, 180);
    ctx.fillRect(x, 256, 10, 180);
  }
  return finishTexture(c, THREE.ClampToEdgeWrapping);
}

function groundTexture(color: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = hex(color);
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const s = 3 + Math.random() * 6;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  const t = finishTexture(c);
  t.repeat.set(20, 20);
  return t;
}

function checkerTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(64, 64);
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#222' : '#fff';
      ctx.fillRect(i * 32, j * 32, 32, 32);
    }
  const t = finishTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

function chevrons(): THREE.Object3D {
  const shape = new THREE.Shape();
  shape.moveTo(-1, 0);
  shape.lineTo(0, 0.8);
  shape.lineTo(1, 0);
  shape.lineTo(1, -0.45);
  shape.lineTo(0, 0.35);
  shape.lineTo(-1, -0.45);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd23f,
    emissive: 0xff9f1a,
    emissiveIntensity: 0.8,
    side: THREE.DoubleSide,
  });
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(geo, i === 0 ? mat : mat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.03, -i * 1.1);
    g.add(m);
  }
  return g;
}

function barrel(color: number): THREE.Object3D {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 1.3, 20),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
  );
  body.position.y = 0.65;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.57, 0.57, 0.2, 20),
    new THREE.MeshStandardMaterial({ color: 0xffffff }),
  );
  band.position.y = 0.75;
  body.castShadow = band.castShadow = true;
  g.add(body, band);
  return g;
}

function tires(): THREE.Object3D {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.9 });
  const red = new THREE.MeshStandardMaterial({ color: 0xe8463c });
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.25, 10, 20), i === 1 ? red : mat);
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.25 + i * 0.45;
    t.castShadow = true;
    g.add(t);
  }
  return g;
}

function oil(): THREE.Object3D {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x1b1b24, roughness: 0.1, metalness: 0.6 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.scale.set(1, 0.7, 1);
  m.position.y = 0.03;
  return new THREE.Group().add(m);
}

export function rock(size: number): THREE.Object3D {
  const m = new THREE.Mesh(
    new THREE.DodecahedronGeometry(size * 0.6, 0),
    new THREE.MeshStandardMaterial({ color: 0x9a8b78, flatShading: true, roughness: 1 }),
  );
  m.scale.set(1, 0.7, 1);
  m.position.y = size * 0.35;
  m.rotation.y = Math.random() * Math.PI;
  m.castShadow = true;
  m.receiveShadow = true;
  return new THREE.Group().add(m);
}

/** The gold collectable star (shared by the race and the island). */
export function starGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.32 : 0.7;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    bevelSegments: 2,
  });
  geo.center();
  return geo;
}

export function starMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffd23f,
    emissive: 0xffa800,
    emissiveIntensity: 0.45,
    metalness: 0.3,
    roughness: 0.35,
  });
}
