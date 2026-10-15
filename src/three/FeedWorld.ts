import * as THREE from 'three';
import type { AnimalId, FruitId } from '../i18n/ru';
import { Animator, ease } from './anim';
import { Pet, fruit, model } from './models';
import { skyTexture } from './stage';

const ANIMAL_POS = new THREE.Vector3(0, 0, -0.6);
const MAIN_SCALE = 1.5;
const FARM_SCALE = 1.0;
const BLANKET_Z = 2.4;
const FRUIT_SIZE = 0.8;
const FRUIT_Y = 0.12;
/** A dragged fruit released this close (on the ground plane) to the animal counts as feeding it. */
export const FEED_DISTANCE = 1.9;

interface FruitSlot {
  id: FruitId;
  obj: THREE.Object3D;
  home: THREE.Vector3;
  ring: THREE.Mesh;
  glow: boolean;
  /** scale that makes this fruit FRUIT_SIZE big */
  base: number;
}

interface FarmPet {
  pet: Pet;
  target: THREE.Vector3;
  rest: number;
}

/** Сафия's meadow: picnic blanket, the hungry animal, and the farm of animals she already fed. */
export class FeedWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
  readonly anim = new Animator();
  private main: Pet | null = null;
  private fruits: FruitSlot[] = [];
  private farm: FarmPet[] = [];
  private time = 0;

  constructor() {
    const s = this.scene;
    s.background = skyTexture('#6fc8ff', '#eaf8ff');
    s.fog = new THREE.Fog(0xeaf8ff, 30, 70);
    s.add(new THREE.HemisphereLight(0xffffff, 0x7aa35a, 1.7));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.3);
    sun.position.set(6, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -14,
      right: 14,
      top: 12,
      bottom: -12,
      near: 1,
      far: 50,
    });
    s.add(sun);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(80, 48),
      new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);

    // rolling hills on the horizon
    for (const [x, z, r, c] of [
      [-22, -38, 16, 0x7ccf5a],
      [8, -45, 22, 0x6fc24e],
      [30, -34, 14, 0x86d662],
    ] as const) {
      const hill = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 12),
        new THREE.MeshStandardMaterial({ color: c, roughness: 1 }),
      );
      hill.scale.y = 0.35;
      hill.position.set(x, 0, z);
      s.add(hill);
    }

    // trees around the meadow
    for (const [x, z, sc] of [
      [-9, -6, 4.5],
      [-11, -1, 3.6],
      [9.5, -5, 4.2],
      [11, 0.5, 3.4],
      [-6, -12, 5],
      [5, -13, 5.5],
      [14, -10, 4.8],
      [-15, -9, 4.4],
    ] as const) {
      const tree = model(Math.random() < 0.5 ? 'treeLarge' : 'treeSmall', sc);
      tree.position.set(x, 0, z);
      s.add(tree);
    }

    this.addFlowers();
    this.addBlanket();

    this.camera.position.set(0, 4.4, 9.8);
    this.camera.lookAt(0, 1.1, -0.4);
  }

  private addFlowers(): void {
    const colors = [0xff6b8a, 0xffd23f, 0xffffff, 0xb07cff, 0xff9f43];
    const stem = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5);
    const head = new THREE.SphereGeometry(0.13, 8, 6);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f9b4a });
    for (let i = 0; i < 70; i++) {
      const x = (Math.random() - 0.5) * 26;
      const z = -14 + Math.random() * 18;
      if (Math.abs(x) < 4 && z > -3) continue; // keep the play area clear
      const g = new THREE.Group();
      const st = new THREE.Mesh(stem, stemMat);
      st.position.y = 0.2;
      const hd = new THREE.Mesh(
        head,
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length] }),
      );
      hd.position.y = 0.42;
      g.add(st, hd);
      g.position.set(x, 0, z);
      this.scene.add(g);
    }
  }

  private addBlanket(): void {
    const [c, ctx] = canvas(128, 128);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#ffffff' : '#f05a5a';
        ctx.fillRect(i * 16, j * 16, 16, 16);
      }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const blanket = new THREE.Mesh(
      new THREE.BoxGeometry(8.4, 0.06, 2.6),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }),
    );
    blanket.position.set(0, 0.03, BLANKET_Z);
    blanket.receiveShadow = true;
    this.scene.add(blanket);
  }

  update(dt: number): void {
    this.time += dt;
    this.anim.update(dt);
    this.main?.update(dt);
    for (const f of this.fruits) {
      if (f.glow) {
        const k = 1 + Math.sin(this.time * 6) * 0.12;
        f.obj.scale.setScalar(f.base * k);
        f.ring.visible = true;
        f.ring.rotation.z += dt * 2;
      }
    }
    this.updateFarm(dt);
  }

  // --- the hungry animal -------------------------------------------------

  /** The animal hops in from the side and turns to face Сафия. */
  async bringAnimal(id: AnimalId): Promise<void> {
    const pet = new Pet(id, MAIN_SCALE);
    this.main = pet;
    pet.obj.position.set(-9, 0, ANIMAL_POS.z);
    pet.obj.rotation.y = Math.PI / 2;
    this.scene.add(pet.obj);
    void pet.play('run');
    await this.anim.run(
      1.1,
      (k) => (pet.obj.position.x = -9 + (ANIMAL_POS.x + 9) * k),
      ease.outQuad,
    );
    void pet.play('idle');
    await this.anim.run(0.3, (k) => (pet.obj.rotation.y = (Math.PI / 2) * (1 - k)));
  }

  /** Head of the animal (bubble anchor) and mouth (where fruits fly). */
  animalHead(): THREE.Vector3 {
    return ANIMAL_POS.clone().add(new THREE.Vector3(0.9, 2.9, 0));
  }

  animalMouth(): THREE.Vector3 {
    return ANIMAL_POS.clone().add(new THREE.Vector3(0, 1.1, 0.9));
  }

  animalCenter(): THREE.Vector3 {
    return ANIMAL_POS.clone().add(new THREE.Vector3(0, 1.2, 0));
  }

  eat(): Promise<void> {
    return this.main?.play('eat', true) ?? Promise.resolve();
  }

  refuse(): Promise<void> {
    return this.main?.play('gesture-negative', true) ?? Promise.resolve();
  }

  async happy(): Promise<void> {
    const pet = this.main;
    if (!pet) return;
    void pet.play('gesture-positive', true);
    await this.anim.run(
      0.7,
      (k) => {
        pet.obj.position.y = Math.sin(k * Math.PI) * 1.2;
        pet.obj.rotation.y = k * Math.PI * 2;
      },
      ease.linear,
    );
  }

  /** The fed animal runs to the farm behind and stays there playing. */
  async sendToFarm(): Promise<void> {
    const pet = this.main;
    if (!pet) return;
    this.main = null;
    const spot = new THREE.Vector3((Math.random() - 0.5) * 12, 0, -5 - Math.random() * 4);
    const from = pet.obj.position.clone();
    pet.obj.rotation.y = Math.atan2(spot.x - from.x, spot.z - from.z);
    void pet.play('run');
    await this.anim.run(
      1,
      (k) => {
        pet.obj.position.lerpVectors(from, spot, k);
        pet.obj.scale.setScalar(MAIN_SCALE + (FARM_SCALE - MAIN_SCALE) * k);
      },
      ease.inOutSine,
    );
    void pet.play('idle');
    this.farm.push({ pet, target: spot.clone(), rest: 1 + Math.random() * 2 });
  }

  private updateFarm(dt: number): void {
    for (const f of this.farm) {
      f.pet.update(dt);
      const p = f.pet.obj.position;
      if (f.rest > 0) {
        f.rest -= dt;
        if (f.rest <= 0) {
          f.target.set((Math.random() - 0.5) * 14, 0, -4.5 - Math.random() * 5);
          f.pet.obj.rotation.y = Math.atan2(f.target.x - p.x, f.target.z - p.z);
          void f.pet.play('walk');
        }
        continue;
      }
      const to = f.target.clone().sub(p);
      const d = to.length();
      if (d < 0.1) {
        f.rest = 1.5 + Math.random() * 3;
        void f.pet.play(Math.random() < 0.3 ? 'dance' : 'idle');
      } else {
        p.addScaledVector(to.normalize(), Math.min(d, dt * 1.4));
      }
    }
  }

  /** Every fed animal lines up in front and dances. */
  async party(): Promise<void> {
    const n = this.farm.length;
    await Promise.all(
      this.farm.map((f, i) => {
        f.rest = Infinity;
        const from = f.pet.obj.position.clone();
        const to = new THREE.Vector3((i - (n - 1) / 2) * 2.2, 0, 0.4);
        void f.pet.play('run');
        return this.anim.run(1.1, (k) => {
          f.pet.obj.position.lerpVectors(from, to, k);
          f.pet.obj.rotation.y = 0;
        });
      }),
    );
    for (const f of this.farm) void f.pet.play('dance');
  }

  // --- fruits on the blanket --------------------------------------------

  async setFruits(ids: FruitId[]): Promise<void> {
    const xs = ids.length === 2 ? [-1.7, 1.7] : [-2.7, 0, 2.7];
    this.fruits = ids.map((id, i) => {
      const obj = fruit(id, FRUIT_SIZE);
      const home = new THREE.Vector3(xs[i]!, FRUIT_Y, BLANKET_Z);
      obj.position.set(home.x, 6, home.z);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.07, 8, 32),
        new THREE.MeshStandardMaterial({
          color: 0xffe14d,
          emissive: 0xffc400,
          emissiveIntensity: 1,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(home.x, 0.08, home.z);
      ring.visible = false;
      this.scene.add(obj, ring);
      return { id, obj, home, ring, glow: false, base: obj.scale.x };
    });
    await Promise.all(
      this.fruits.map((f, i) =>
        this.anim
          .wait(i * 0.12)
          .then(() =>
            this.anim.run(0.55, (k) => (f.obj.position.y = 6 + (FRUIT_Y - 6) * k), ease.outBack),
          ),
      ),
    );
  }

  fruitIds(): FruitId[] {
    return this.fruits.map((f) => f.id);
  }

  fruitAnchor(i: number): THREE.Vector3 {
    const f = this.fruits[i];
    return f
      ? f.obj.position.clone().add(new THREE.Vector3(0, FRUIT_SIZE / 2, 0))
      : new THREE.Vector3();
  }

  /** Moves a fruit under the finger, lifted above the ground. */
  dragFruit(i: number, ray: THREE.Raycaster): void {
    const f = this.fruits[i];
    if (!f) return;
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9), hit)) {
      f.obj.position.set(
        THREE.MathUtils.clamp(hit.x, -6, 6),
        0.9,
        THREE.MathUtils.clamp(hit.z, -3, 4),
      );
    }
  }

  /** Ground distance between a fruit and the animal. */
  distanceToAnimal(i: number): number {
    const f = this.fruits[i];
    if (!f) return Infinity;
    return Math.hypot(f.obj.position.x - ANIMAL_POS.x, f.obj.position.z - ANIMAL_POS.z);
  }

  async returnFruit(i: number): Promise<void> {
    const f = this.fruits[i];
    if (!f) return;
    const from = f.obj.position.clone();
    await this.anim.run(0.4, (k) => f.obj.position.lerpVectors(from, f.home, k), ease.outBack);
  }

  /** Fruit flies in an arc to the mouth. `swallow` shrinks it away; otherwise it bounces off. */
  async throwFruit(i: number, swallow: boolean): Promise<void> {
    const f = this.fruits[i];
    if (!f) return;
    const from = f.obj.position.clone();
    const to = this.animalMouth();
    await this.anim.run(
      0.5,
      (k) => {
        f.obj.position.lerpVectors(from, to, k);
        f.obj.position.y += Math.sin(k * Math.PI) * 1.6;
        f.obj.rotation.y = k * Math.PI * 2;
        if (swallow) f.obj.scale.setScalar(f.base * Math.max(0.01, 1 - k * k * 0.9));
      },
      ease.linear,
    );
    if (swallow) {
      f.obj.visible = false;
      return;
    }
    await this.returnFruit(i);
  }

  highlight(i: number): void {
    const f = this.fruits[i];
    if (f) f.glow = true;
  }

  async clearFruits(): Promise<void> {
    const list = this.fruits;
    this.fruits = [];
    await Promise.all(
      list.map((f) =>
        this.anim
          .run(0.3, (k) => f.obj.scale.setScalar(f.base * Math.max(0.01, 1 - k)))
          .then(() => {
            this.scene.remove(f.obj, f.ring);
          }),
      ),
    );
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function grassTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#74c95a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,60,0,0.08)';
    const s = 3 + Math.random() * 7;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  return t;
}
