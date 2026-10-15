import type Phaser from 'phaser';
import * as THREE from 'three';
import { PLAYER_CARS, model } from './models';

/** Renders each player car once into a Phaser texture `thumb_<car>` (title card, HUD, track cards). */
export function makeCarThumbs(textures: Phaser.Textures.TextureManager, size = 320): void {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666677, 2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(4, 8, 6);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(5.2, 3.6, 5.2);
  camera.lookAt(0, 0.55, 0);

  for (const name of PLAYER_CARS) {
    const car = model(name, 1);
    car.rotation.y = -0.35;
    scene.add(car);
    renderer.render(scene, camera);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
    if (textures.exists(`thumb_${name}`)) textures.remove(`thumb_${name}`);
    textures.addCanvas(`thumb_${name}`, c);
    scene.remove(car);
  }
  renderer.dispose();
  renderer.forceContextLoss();
}
