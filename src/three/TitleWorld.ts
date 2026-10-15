import * as THREE from 'three';
import { Pet, fruit, model, wheels } from './models';
import { skyTexture } from './stage';

const CAR_CENTER = new THREE.Vector3(-4.6, 0.45, 0.9);
const CAR_RADIUS = 1.6;
const BUNNY_POS = new THREE.Vector3(0, 0.4, 1.4);
const TRACTOR_CENTER = new THREE.Vector3(4.6, 0.45, 0.9);
const TRACTOR_RADIUS = 1.5;

/**
 * Start screen: a floating island with Осман's car racing in circles, Сафия's bunny dancing
 * among fruits, and Умар's blue tractor driving round a fenced field.
 */
export class TitleWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
  private readonly island = new THREE.Group();
  private readonly car: THREE.Object3D;
  private readonly carWheels: THREE.Object3D[];
  private readonly tractor: THREE.Object3D;
  private readonly tractorWheels: THREE.Object3D[];
  private readonly bunny: Pet;
  private readonly clouds: THREE.Object3D[] = [];
  private t = 0;

  constructor(carName: string) {
    const s = this.scene;
    s.background = skyTexture('#5fbcff', '#e9f7ff');
    s.add(new THREE.HemisphereLight(0xffffff, 0x88aa77, 1.8));
    const sun = new THREE.DirectionalLight(0xfff2d6, 2.4);
    sun.position.set(5, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    s.add(sun);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 7.6, 0.8, 48),
      new THREE.MeshStandardMaterial({ color: 0x74c95a, roughness: 1 }),
    );
    top.receiveShadow = true;
    const dirt = new THREE.Mesh(
      new THREE.CylinderGeometry(7.6, 6.2, 1.4, 48),
      new THREE.MeshStandardMaterial({ color: 0xa87a4f, roughness: 1 }),
    );
    dirt.position.y = -1.1;
    const rock = new THREE.Mesh(
      new THREE.ConeGeometry(6.2, 5, 9),
      new THREE.MeshStandardMaterial({ color: 0x8c7a6b, flatShading: true }),
    );
    rock.rotation.x = Math.PI;
    rock.position.y = -4.3;
    this.island.add(top, dirt, rock);
    this.island.position.y = -0.4;
    s.add(this.island);

    // Осман's side: round track with a car driving around it
    const track = new THREE.Mesh(
      new THREE.RingGeometry(CAR_RADIUS - 0.9, CAR_RADIUS + 0.9, 48),
      new THREE.MeshStandardMaterial({ color: 0x5d6166 }),
    );
    track.rotation.x = -Math.PI / 2;
    track.position.set(CAR_CENTER.x, 0.42, CAR_CENTER.z);
    track.receiveShadow = true;
    this.island.add(track);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const cone = model('cone', 0.8);
      cone.position.set(
        CAR_CENTER.x + Math.cos(a) * (CAR_RADIUS + 1.1),
        0.4,
        CAR_CENTER.z + Math.sin(a) * (CAR_RADIUS + 1.1),
      );
      this.island.add(cone);
    }
    this.car = model(carName, 0.7);
    this.island.add(this.car);
    this.carWheels = wheels(this.car);

    // Сафия's side: bunny dancing next to a fruit basket
    this.bunny = new Pet('bunny', 1.3);
    this.bunny.obj.position.copy(BUNNY_POS);
    void this.bunny.play('dance');
    this.island.add(this.bunny.obj);
    const fruits: [string, number, number, number][] = [
      ['apple', -1.5, 0.4, 2.2],
      ['banana', 1.6, 0.4, 2.3],
      ['strawberry', -1.3, 0.4, 0.5],
      ['watermelon', 1.4, 0.4, 0.4],
      ['carrot', 0.1, 0.4, 3.1],
    ];
    for (const [name, x, y, z] of fruits) {
      const f = fruit(name, 0.75);
      f.position.set(x, y, z);
      this.island.add(f);
    }

    // Умар's side: dirt track round a fenced field with hay, and the blue tractor
    const dirt2 = new THREE.Mesh(
      new THREE.RingGeometry(TRACTOR_RADIUS - 0.7, TRACTOR_RADIUS + 0.7, 48),
      new THREE.MeshStandardMaterial({ color: 0xc99a62 }),
    );
    dirt2.rotation.x = -Math.PI / 2;
    dirt2.position.set(TRACTOR_CENTER.x, 0.42, TRACTOR_CENTER.z);
    dirt2.receiveShadow = true;
    this.island.add(dirt2);
    const wood = new THREE.MeshStandardMaterial({ color: 0xc58a4e });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.16), wood);
      post.position.set(
        TRACTOR_CENTER.x + Math.cos(a) * (TRACTOR_RADIUS + 1.05),
        0.75,
        TRACTOR_CENTER.z + Math.sin(a) * (TRACTOR_RADIUS + 1.05),
      );
      post.castShadow = true;
      this.island.add(post);
    }
    const hay = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.7, 16),
      new THREE.MeshStandardMaterial({ color: 0xf2c94c }),
    );
    hay.rotation.z = Math.PI / 2;
    hay.position.set(TRACTOR_CENTER.x, 0.85, TRACTOR_CENTER.z);
    hay.castShadow = true;
    this.island.add(hay);
    this.tractor = model('tractor', 0.75);
    this.island.add(this.tractor);
    this.tractorWheels = wheels(this.tractor);

    for (const [x, z, sc, name] of [
      [-6, -4, 3.2, 'treeLarge'],
      [-2.2, -4.6, 2.6, 'treeSmall'],
      [2, -4.4, 3.4, 'treeLarge'],
      [6.2, -3.4, 2.8, 'treeSmall'],
      [0.3, -2.4, 2.2, 'treeSmall'],
    ] as const) {
      const tree = model(name, sc);
      tree.position.set(x, 0.4, z);
      this.island.add(tree);
    }

    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    for (const [x, y, z, sc] of [
      [-11, 1, -6, 1.4],
      [10, 3, -8, 1.8],
      [-8, -4, 2, 1.1],
      [9, -3, 1, 1.2],
      [0, 6, -14, 2.2],
    ] as const) {
      const c = new THREE.Group();
      for (const [dx, dy, r] of [
        [0, 0, 1],
        [1, 0.3, 0.8],
        [-1, 0.2, 0.75],
        [0.4, 0.7, 0.7],
      ] as const) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), cloudMat);
        puff.position.set(dx, dy, 0);
        c.add(puff);
      }
      c.scale.setScalar(sc);
      c.position.set(x, y, z);
      s.add(c);
      this.clouds.push(c);
    }

    this.camera.position.set(0, 8.2, 17.5);
    this.camera.lookAt(0, -0.4, 0);
  }

  /** Centre of each side (tap zones and name plates). */
  carSpot(): THREE.Vector3 {
    return CAR_CENTER.clone().add(this.island.position);
  }

  bunnySpot(): THREE.Vector3 {
    return BUNNY_POS.clone()
      .add(this.island.position)
      .add(new THREE.Vector3(0, 1.2, 0));
  }

  tractorSpot(): THREE.Vector3 {
    return TRACTOR_CENTER.clone().add(this.island.position);
  }

  update(dt: number): void {
    this.t += dt;
    this.island.position.y = -0.4 + Math.sin(this.t * 1.2) * 0.15;
    const a = this.t * 1.4;
    this.car.position.set(
      CAR_CENTER.x + Math.cos(a) * CAR_RADIUS,
      0.42,
      CAR_CENTER.z + Math.sin(a) * CAR_RADIUS,
    );
    // heading follows the tangent of the circle (cars face +Z)
    this.car.rotation.y = -a;
    for (const w of this.carWheels) w.rotation.x += dt * 10;
    // the tractor goes round the other way, slower
    const b = -this.t * 0.7;
    this.tractor.position.set(
      TRACTOR_CENTER.x + Math.cos(b) * TRACTOR_RADIUS,
      0.42,
      TRACTOR_CENTER.z + Math.sin(b) * TRACTOR_RADIUS,
    );
    this.tractor.rotation.y = -b + Math.PI;
    for (const w of this.tractorWheels) w.rotation.x += dt * 5;
    this.bunny.update(dt);
    this.clouds.forEach((c, i) => (c.position.x += Math.sin(this.t * 0.2 + i) * dt * 0.3));
  }
}
