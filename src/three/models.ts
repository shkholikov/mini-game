import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { ANIMALS, FRUITS } from '../i18n/ru';

/** Car Kit models (cars face +Z, ~2.5 units long). */
export const PLAYER_CARS = ['race', 'police', 'firetruck', 'ambulance', 'taxi'] as const;
export type PlayerCar = (typeof PLAYER_CARS)[number];
export const RIVAL_CARS = ['sedan', 'suv', 'van', 'truck', 'delivery', 'hatchback-sports'] as const;
const PROPS = ['cone', 'box', 'debris-tire'] as const;
/** Racing Kit pieces (1 unit grid, scaled up in the world). */
const TRACK = [
  'grandStand',
  'tent',
  'treeLarge',
  'treeSmall',
  'lightPostLarge',
  'billboard',
  'flagCheckers',
  'overheadLights',
  'barrierRed',
  'barrierWhite',
  'pylon',
  'bannerTowerRed',
  'bannerTowerGreen',
] as const;

const cache = new Map<string, THREE.Object3D>();
const clips = new Map<string, THREE.AnimationClip[]>();
let loading: Promise<void> | null = null;

/** Loads every model once. Missing files only warn, so the race still runs. */
export function loadModels(onProgress?: (v: number) => void): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const jobs = [
    ...[...PLAYER_CARS, ...RIVAL_CARS, ...PROPS].map(
      (n) => [n, `assets/3d/cars/${n}.glb`] as const,
    ),
    ...TRACK.map((n) => [n, `assets/3d/track/${n}.glb`] as const),
    // Cube Pets (with idle/walk/eat/dance/gesture animations) and Food Kit fruits
    ...Object.keys(ANIMALS).map((n) => [`pet_${n}`, `assets/3d/pets/${n}.glb`] as const),
    ...Object.keys(FRUITS).map((n) => [`food_${n}`, `assets/3d/food/${n}.glb`] as const),
  ];
  let done = 0;
  loading = Promise.all(
    jobs.map(([name, url]) =>
      loader
        .loadAsync(url)
        .then((gltf) => {
          gltf.scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              o.userData.shared = true;
            }
          });
          cache.set(name, normalize(gltf.scene));
          if (gltf.animations.length) clips.set(name, gltf.animations);
        })
        .catch((e) => console.warn(`[models] could not load ${url}`, e))
        .finally(() => onProgress?.(++done / jobs.length)),
    ),
  ).then(() => undefined);
  return loading;
}

/** Wraps a model so its footprint is centred on x/z and it stands on y = 0. */
function normalize(root: THREE.Object3D): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  const wrap = new THREE.Group();
  wrap.add(root);
  return wrap;
}

/** A fresh copy of a model (geometry and materials are shared), or a grey box if it failed to load. */
export function model(name: string, scale = 1): THREE.Object3D {
  const src = cache.get(name);
  const obj = src
    ? src.clone(true)
    : new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0x999999 }),
      );
  obj.scale.setScalar(scale);
  return obj;
}

/** Wheel meshes of a car model (named wheel-*), to spin them. */
export function wheels(car: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  car.traverse((o) => {
    if (o.name.startsWith('wheel')) out.push(o);
  });
  return out;
}

/** A fruit model scaled so its average side is `size` (Food Kit fruits differ a lot in size and shape). */
export function fruit(name: string, size: number): THREE.Object3D {
  const obj = model(`food_${name}`, 1);
  const box = new THREE.Box3().setFromObject(obj);
  const dims = box.getSize(new THREE.Vector3());
  obj.scale.setScalar(size / Math.max((dims.x + dims.y + dims.z) / 3, 0.001));
  return obj;
}

export type PetAction =
  'idle' | 'walk' | 'run' | 'eat' | 'dance' | 'gesture-positive' | 'gesture-negative';

/** An animated Cube Pet with its own mixer. `play` cross-fades between the built-in clips. */
export class Pet {
  readonly obj: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;

  constructor(
    readonly id: string,
    scale = 1,
  ) {
    const src = cache.get(`pet_${id}`);
    this.obj = src ? cloneSkinned(src) : model('box', 1);
    this.obj.scale.setScalar(scale);
    this.mixer = new THREE.AnimationMixer(this.obj);
    for (const clip of clips.get(`pet_${id}`) ?? [])
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.play('idle');
  }

  /** Loops the clip, or plays it once and returns to idle when `once` is set. */
  play(name: PetAction, once = false): Promise<void> {
    const next = this.actions.get(name);
    if (!next) return Promise.resolve();
    if (this.current !== next) {
      next.reset().fadeIn(0.15).play();
      this.current?.fadeOut(0.15);
      this.current = next;
    }
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    if (!once) return Promise.resolve();
    next.reset().play();
    return new Promise((resolve) => {
      const done = (e: { action: THREE.AnimationAction }): void => {
        if (e.action !== next) return;
        this.mixer.removeEventListener('finished', done);
        this.play('idle');
        resolve();
      };
      this.mixer.addEventListener('finished', done);
    });
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }
}
