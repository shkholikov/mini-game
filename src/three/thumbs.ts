import type Phaser from 'phaser';
import * as THREE from 'three';
import { ANIMALS, FRUITS } from '../i18n/ru';
import { PLAYER_CARS, fruit, model } from './models';

interface Shot {
  key: string;
  make: () => THREE.Object3D;
  /** camera position; it looks at the object's centre */
  from: THREE.Vector3;
}

/**
 * Renders 3D models once into Phaser textures:
 * `thumb_<car>`, `thumb_pet_<animal>`, `thumb_fruit_<fruit>` (title, HUD, bubbles, progress row).
 */
export function makeThumbs(textures: Phaser.Textures.TextureManager, size = 320): void {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);

  const shots: Shot[] = [
    ...PLAYER_CARS.map((c) => ({
      key: `thumb_${c}`,
      make: () => model(c, 1),
      from: new THREE.Vector3(5.2, 3.6, 5.2),
    })),
    ...Object.keys(ANIMALS).map((a) => ({
      key: `thumb_pet_${a}`,
      make: () => model(`pet_${a}`, 1),
      from: new THREE.Vector3(1.6, 2.2, 5.2),
    })),
    ...Object.keys(FRUITS).map((f) => ({
      key: `thumb_fruit_${f}`,
      make: () => fruit(f, 1),
      from: new THREE.Vector3(1.4, 1.6, 2.6),
    })),
  ];

  for (const shot of shots) {
    const obj = shot.make();
    obj.rotation.y = shot.key.startsWith('thumb_pet') ? 0 : -0.35;
    scene.add(obj);
    // frame the object: look at its centre from a distance that fits its size
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const dir = shot.from.clone().normalize();
    camera.position
      .copy(center)
      .addScaledVector(dir, (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.05);
    camera.lookAt(center);
    renderer.render(scene, camera);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
    if (textures.exists(shot.key)) textures.remove(shot.key);
    textures.addCanvas(shot.key, c);
    scene.remove(obj);
  }
  renderer.dispose();
  renderer.forceContextLoss();
}
