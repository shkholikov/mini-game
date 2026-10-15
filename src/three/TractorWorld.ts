import * as THREE from 'three';
import type { AnimalId } from '../i18n/ru';
import { createRng } from '../systems/rng';
import { RoadPlan, TRACTOR_SPEED, type RoadItem } from '../systems/tractorLogic';
import { Animator, ease } from './anim';
import { grassTexture, canvas } from './FeedWorld';
import { Pet, model, wheels } from './models';
import { skyTexture } from './stage';

const ROAD_Z = 0.4;
const ANIMAL_Z = -2.4;
const BARN_Z = -5.2;
/** The tractor stops this far before a barn, so it doesn't cover the barn doors. */
const BARN_STOP = 4.6;
/** Things are added this far ahead of the tractor and removed this far behind it. */
const AHEAD = 40;
const BEHIND = 25;
const SCENERY_SPAN = AHEAD + BEHIND;

/** An animal by the road (or one that came out of a barn) with a big invisible tap box. */
export interface RoadAnimal {
  id: AnimalId;
  pet: Pet;
  group: THREE.Group;
  hit: THREE.Mesh;
  busy: boolean;
  waved: boolean;
}

export interface Barn {
  item: RoadItem;
  group: THREE.Group;
  left: THREE.Object3D;
  right: THREE.Object3D;
  visited: boolean;
}

interface Puff {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  life: number;
  vx: number;
}

/**
 * Умар's farm road, seen from the side. The blue tractor drives to the right forever;
 * animals stand by the road and every few of them a barn hides one more.
 */
export class TractorWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
  readonly anim = new Animator();
  readonly animals: RoadAnimal[] = [];
  private readonly rig = new THREE.Group();
  private readonly body: THREE.Object3D;
  private readonly tractorWheels: THREE.Object3D[];
  private readonly sun: THREE.DirectionalLight;
  private readonly ground: THREE.Mesh;
  private readonly road: THREE.Mesh;
  private readonly hills = new THREE.Group();
  private readonly scenery: THREE.Object3D[] = [];
  private readonly barns: Barn[] = [];
  private readonly puffs: Puff[] = [];
  private readonly plan = new RoadPlan(createRng(Date.now()), 9);
  private nextItem: RoadItem;
  private readonly barnParts: ReturnType<typeof barnParts>;
  private x = 0;
  private speed = 0;
  private boost = 0;
  private stopped = false;
  private bounce = 0;
  private t = 0;

  constructor() {
    const s = this.scene;
    s.background = skyTexture('#5fbcff', '#e9f7ff');
    s.fog = new THREE.Fog(0xe9f7ff, 35, 80);
    s.add(new THREE.HemisphereLight(0xffffff, 0x7aa35a, 1.7));
    this.sun = new THREE.DirectionalLight(0xfff2d6, 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -16,
      right: 16,
      top: 10,
      bottom: -10,
      near: 1,
      far: 50,
    });
    s.add(this.sun, this.sun.target);

    const grass = grassTexture();
    grass.repeat.set(40, 15);
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 60),
      new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.z = -15;
    this.ground.receiveShadow = true;
    s.add(this.ground);

    this.road = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 2.8),
      new THREE.MeshStandardMaterial({ map: dirtTexture(), roughness: 1 }),
    );
    this.road.rotation.x = -Math.PI / 2;
    this.road.position.set(0, 0.02, ROAD_Z);
    this.road.receiveShadow = true;
    s.add(this.road);

    for (const [x, z, r, c] of [
      [-30, -40, 16, 0x7ccf5a],
      [0, -46, 22, 0x6fc24e],
      [30, -38, 15, 0x86d662],
      [58, -44, 20, 0x7ccf5a],
    ] as const) {
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 12),
        new THREE.MeshStandardMaterial({ color: c, roughness: 1 }),
      );
      hill.scale.y = 0.35;
      hill.position.set(x, 0, z);
      this.hills.add(hill);
    }
    s.add(this.hills);

    this.barnParts = barnParts();
    this.addScenery();

    // the tractor faces +X (Car Kit models face +Z)
    this.body = model('tractor', 1.5);
    this.body.rotation.y = Math.PI / 2;
    this.rig.add(this.body);
    this.rig.position.z = ROAD_Z;
    this.tractorWheels = wheels(this.body);
    s.add(this.rig);
    this.addPuffs();

    this.nextItem = this.plan.next();
    this.placeCamera();
  }

  /** Fences, trees, hay and flowers that loop around as the tractor drives. */
  private addScenery(): void {
    const wood = new THREE.MeshStandardMaterial({ color: 0xc58a4e, roughness: 1 });
    const post = new THREE.BoxGeometry(0.18, 0.9, 0.18);
    const rail = new THREE.BoxGeometry(2.2, 0.14, 0.08);
    for (let x = -BEHIND; x < AHEAD; x += 2.2) {
      const f = new THREE.Group();
      const p = new THREE.Mesh(post, wood);
      p.position.y = 0.45;
      p.castShadow = true;
      for (const y of [0.35, 0.7]) {
        const r = new THREE.Mesh(rail, wood);
        r.position.set(1.1, y, 0);
        f.add(r);
      }
      f.add(p);
      f.position.set(x, 0, -1.3);
      this.scene.add(f);
      this.scenery.push(f);
    }

    const hayMat = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 1 });
    const hay = new THREE.CylinderGeometry(0.7, 0.7, 1.1, 18);
    const stem = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5);
    const head = new THREE.SphereGeometry(0.14, 8, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f9b4a });
    const petals = [0xff6b8a, 0xffd23f, 0xffffff, 0xb07cff, 0xff9f43].map(
      (c) => new THREE.MeshStandardMaterial({ color: c }),
    );
    const rnd = createRng(7);
    for (let i = 0; i < 26; i++) {
      const x = -BEHIND + rnd() * SCENERY_SPAN;
      let obj: THREE.Object3D;
      if (i % 3 === 0) {
        obj = new THREE.Mesh(hay, hayMat);
        obj.rotation.z = Math.PI / 2;
        obj.position.set(x, 0.7, -8 - rnd() * 4);
        obj.castShadow = true;
      } else {
        obj = model(rnd() < 0.5 ? 'treeLarge' : 'treeSmall', 4 + rnd() * 2);
        obj.position.set(x, 0, -10 - rnd() * 8);
      }
      this.scene.add(obj);
      this.scenery.push(obj);
    }
    for (let i = 0; i < 40; i++) {
      const g = new THREE.Group();
      const st = new THREE.Mesh(stem, stemMat);
      st.position.y = 0.2;
      const hd = new THREE.Mesh(head, petals[i % petals.length]);
      hd.position.y = 0.42;
      g.add(st, hd);
      g.position.set(-BEHIND + rnd() * SCENERY_SPAN, 0, 2.2 + rnd() * 2.5);
      this.scene.add(g);
      this.scenery.push(g);
    }
  }

  private addPuffs(): void {
    const geo = new THREE.SphereGeometry(0.3, 10, 8);
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: 0xe8e8e8,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.puffs.push({ mesh, life: 0, vx: 0 });
    }
  }

  private placeCamera(): void {
    const cx = this.x + 2.5;
    this.camera.position.set(cx, 4.2, 12);
    this.camera.lookAt(cx, 1.1, -1.2);
    this.sun.position.set(cx + 6, 14, 9);
    this.sun.target.position.set(cx, 0, 0);
  }

  /** Honk: the tractor jumps, puffs smoke and speeds up for a moment. */
  honk(): void {
    this.bounce = 1;
    this.boost = 1;
    for (let i = 0; i < 3; i++) this.puff(i * 0.12);
  }

  private puff(delay: number): void {
    const p = this.puffs.find((q) => q.life <= 0);
    if (!p) return;
    p.life = 1 + delay;
    p.vx = -0.6 - Math.random() * 0.5;
    // exhaust pipe sits on the bonnet, in front of the cabin
    p.mesh.position.set(this.x + 0.4, 2.1, ROAD_Z);
    p.mesh.scale.setScalar(0.6);
  }

  /** A barn the tractor has just reached (it waits there until `go`). */
  takeBarnStop(): Barn | null {
    const b = this.barns.find((q) => !q.visited && this.x >= q.item.x - BARN_STOP);
    if (!b) return null;
    b.visited = true;
    this.stopped = true;
    return b;
  }

  go(): void {
    this.stopped = false;
  }

  /** Doors swing open and the hidden animal hops out to the road side. */
  async openBarn(b: Barn): Promise<RoadAnimal> {
    await this.anim.run(
      0.8,
      (k) => {
        b.left.rotation.y = -k * 1.9;
        b.right.rotation.y = k * 1.9;
      },
      ease.outQuad,
    );
    const a = this.addAnimal(b.item.animal, b.item.x, BARN_Z + 0.6);
    a.group.scale.setScalar(0.01);
    void a.pet.play('run');
    await this.anim.run(0.5, (k) => a.group.scale.setScalar(Math.max(0.01, k)), ease.outBack);
    await this.anim.run(0.9, (k) => (a.group.position.z = BARN_Z + 0.6 + k * 2.4));
    void a.pet.play('dance');
    return a;
  }

  /** Tapped animal jumps and waves. */
  async cheer(a: RoadAnimal): Promise<void> {
    if (a.busy) return;
    a.busy = true;
    const base = a.group.position.y;
    void a.pet.play('gesture-positive', true);
    await this.anim.run(0.5, (k) => (a.group.position.y = base + Math.sin(k * Math.PI) * 1.1));
    a.busy = false;
  }

  /** Animal under a tap ray, if any. */
  pickAnimal(ray: THREE.Raycaster): RoadAnimal | null {
    const hit = ray.intersectObjects(
      this.animals.map((a) => a.hit),
      false,
    )[0];
    return hit ? (this.animals.find((a) => a.hit === hit.object) ?? null) : null;
  }

  private addAnimal(id: AnimalId, x: number, z: number): RoadAnimal {
    const group = new THREE.Group();
    const pet = new Pet(id, 1.3);
    pet.obj.rotation.y = -0.35;
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 3, 2.6),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.y = 1.2;
    group.add(pet.obj, hit);
    group.position.set(x, 0, z);
    this.scene.add(group);
    const a: RoadAnimal = { id, pet, group, hit, busy: false, waved: false };
    this.animals.push(a);
    return a;
  }

  private addBarn(item: RoadItem): void {
    const { group, left, right } = buildBarn(this.barnParts);
    group.position.set(item.x, 0, BARN_Z);
    this.scene.add(group);
    this.barns.push({ item, group, left, right, visited: false });
  }

  update(dt: number): void {
    this.t += dt;
    this.anim.update(dt);

    const target = this.stopped ? 0 : TRACTOR_SPEED * (1 + this.boost * 1.2);
    this.speed += (target - this.speed) * Math.min(1, dt * (this.stopped ? 3 : 2));
    this.boost = Math.max(0, this.boost - dt * 1.4);
    this.x += this.speed * dt;

    // tractor: gentle rumble, honk bounce, wheels turning
    this.bounce = Math.max(0, this.bounce - dt * 2.5);
    this.rig.position.x = this.x;
    this.rig.position.y =
      Math.sin((1 - this.bounce) * Math.PI) * this.bounce * 0.9 +
      (this.speed > 0.1 ? Math.abs(Math.sin(this.t * 14)) * 0.04 : 0);
    this.rig.rotation.z = this.bounce * 0.12 * Math.sin(this.t * 20);
    for (const w of this.tractorWheels) w.rotation.x += dt * this.speed * 1.6;

    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const k = 1 - Math.min(1, p.life);
      p.mesh.visible = p.life <= 1;
      p.mesh.position.y += dt * 1.2;
      p.mesh.position.x += dt * p.vx;
      p.mesh.scale.setScalar(0.6 + k * 1.8);
      p.mesh.material.opacity = 0.9 * (1 - k);
      if (p.life <= 0) p.mesh.visible = false;
    }

    // ground, road and hills follow the camera; their textures scroll so the land looks still
    this.ground.position.x = this.road.position.x = this.x;
    const g = (this.ground.material as THREE.MeshStandardMaterial).map!;
    g.offset.x = (this.x / 160) * g.repeat.x;
    const r = (this.road.material as THREE.MeshStandardMaterial).map!;
    r.offset.x = (this.x / 160) * r.repeat.x;
    this.hills.position.x = this.x * 0.8;

    for (const o of this.scenery) if (o.position.x < this.x - BEHIND) o.position.x += SCENERY_SPAN;

    while (this.nextItem.x < this.x + AHEAD) {
      if (this.nextItem.kind === 'barn') this.addBarn(this.nextItem);
      else this.addAnimal(this.nextItem.animal, this.nextItem.x, ANIMAL_Z);
      this.nextItem = this.plan.next();
    }
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i]!;
      a.pet.update(dt);
      // animals wave as the tractor drives past
      if (!a.waved && Math.abs(a.group.position.x - this.x) < 2.5) {
        a.waved = true;
        if (!a.busy) void a.pet.play('gesture-positive', true);
      }
      if (a.group.position.x < this.x - BEHIND) {
        this.scene.remove(a.group);
        a.hit.geometry.dispose();
        this.animals.splice(i, 1);
      }
    }
    for (let i = this.barns.length - 1; i >= 0; i--) {
      const b = this.barns[i]!;
      if (b.group.position.x < this.x - BEHIND) {
        this.scene.remove(b.group);
        this.barns.splice(i, 1);
      }
    }

    this.placeCamera();
  }
}

/** Geometry and materials shared by every barn (built once per world). */
function barnParts() {
  return {
    red: new THREE.MeshStandardMaterial({ color: 0xd94a3d, roughness: 0.9 }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3b2418 }),
    walls: new THREE.BoxGeometry(4.4, 3, 3.4),
    roofGeo: new THREE.CylinderGeometry(2.6, 2.6, 3.8, 3, 1),
    door: new THREE.BoxGeometry(1.1, 2.2, 0.12),
    hole: new THREE.PlaneGeometry(2.2, 2.2),
    trim: new THREE.BoxGeometry(1.35, 0.12, 0.06),
  };
}

/** Red barn with two doors hinged at the sides (they rotate open around Y). */
function buildBarn(p: ReturnType<typeof barnParts>) {
  const group = new THREE.Group();
  const walls = new THREE.Mesh(p.walls, p.red);
  walls.position.y = 1.5;
  walls.castShadow = walls.receiveShadow = true;
  const roof = new THREE.Mesh(p.roofGeo, p.roof);
  // a 3-sided cylinder lying along Z is a gable roof; scale.z flattens it (local Z points up)
  roof.rotation.x = -Math.PI / 2;
  roof.scale.z = 0.55;
  roof.position.y = 3.72;
  roof.castShadow = true;
  const hole = new THREE.Mesh(p.hole, p.dark);
  hole.position.set(0, 1.1, 1.71);
  group.add(walls, roof, hole);

  const door = (side: -1 | 1): THREE.Object3D => {
    const hinge = new THREE.Group();
    hinge.position.set(side * 1.1, 1.1, 1.76);
    const d = new THREE.Mesh(p.door, p.white);
    d.position.x = -side * 0.55;
    const panel = new THREE.Mesh(p.door, p.red);
    panel.scale.set(0.8, 0.88, 1);
    panel.position.set(-side * 0.55, 0, 0.03);
    const x1 = new THREE.Mesh(p.trim, p.white);
    x1.rotation.z = 1.1;
    x1.position.set(-side * 0.55, 0, 0.1);
    const x2 = x1.clone();
    x2.rotation.z = -1.1;
    hinge.add(d, panel, x1, x2);
    group.add(hinge);
    return hinge;
  };
  return { group, left: door(-1), right: door(1) };
}

function dirtTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(128, 64);
  ctx.fillStyle = '#c99a62';
  ctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(80,40,0,0.12)';
    const s = 2 + Math.random() * 5;
    ctx.fillRect(Math.random() * 128, Math.random() * 64, s, s);
  }
  // two wheel ruts
  ctx.fillStyle = 'rgba(90,55,20,0.25)';
  ctx.fillRect(0, 14, 128, 7);
  ctx.fillRect(0, 43, 128, 7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(40, 1);
  return t;
}
