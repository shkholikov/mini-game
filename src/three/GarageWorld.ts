import * as THREE from 'three';
import { PLAYER_CARS, model, wheels } from './models';
import { skyTexture } from './stage';

const SPACING = 3.3;

/** Showroom with the five cars on turntables. Taps are handled by GarageScene. */
export class GarageWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
  readonly cars: THREE.Object3D[] = [];
  private readonly tables: THREE.Mesh[] = [];
  private selected = -1;
  private t = 0;

  constructor() {
    const s = this.scene;
    s.background = skyTexture('#2b3a67', '#5b6b9a');
    s.add(new THREE.HemisphereLight(0xdfe8ff, 0x303040, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(6, 14, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, {
      left: -14,
      right: 14,
      top: 8,
      bottom: -8,
      near: 1,
      far: 50,
    });
    s.add(key);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 40),
      new THREE.MeshStandardMaterial({ color: 0x3a4466, roughness: 0.6, metalness: 0.2 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    PLAYER_CARS.forEach((name, i) => {
      const x = (i - (PLAYER_CARS.length - 1) / 2) * SPACING;
      const table = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.6, 0.3, 40),
        new THREE.MeshStandardMaterial({ color: 0xdfe4f2, metalness: 0.4, roughness: 0.3 }),
      );
      table.position.set(x, 0.15, 0);
      table.receiveShadow = true;
      s.add(table);
      this.tables.push(table);
      const car = model(name, 0.95);
      car.position.set(x, 0.3, 0);
      car.rotation.y = 0.6 + i * 0.4;
      s.add(car);
      this.cars.push(car);
    });

    this.camera.position.set(0, 4, 16);
    this.camera.lookAt(0, -1.4, 0);
  }

  select(index: number): void {
    this.selected = index;
    this.tables.forEach((t, i) =>
      (t.material as THREE.MeshStandardMaterial).color.set(i === index ? 0xffd23f : 0xdfe4f2),
    );
  }

  /** Top of each car in world space, for placing tap zones. */
  carAnchor(i: number): THREE.Vector3 {
    return this.cars[i]!.position.clone().add(new THREE.Vector3(0, 0.9, 0));
  }

  update(dt: number): void {
    this.t += dt;
    this.cars.forEach((car, i) => {
      const chosen = i === this.selected;
      car.rotation.y += dt * (chosen ? 4 : 0.6);
      car.position.y = 0.3 + (chosen ? Math.abs(Math.sin(this.t * 6)) * 0.6 : 0);
      if (chosen) for (const w of wheels(car)) w.rotation.x -= dt * 12;
    });
  }
}
