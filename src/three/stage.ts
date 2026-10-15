import * as THREE from 'three';

/**
 * One WebGL renderer for every 3D screen, drawn in a canvas *behind* the (transparent) Phaser canvas.
 * Phaser keeps the HUD, buttons and input; Three.js draws the world.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  scene: THREE.Scene | null = null;
  camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 400);

  constructor(private readonly parent: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // No tone mapping: keeps Kenney's bright toy colours.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.id = 'stage3d';
    this.canvas.style.display = 'none';
    parent.prepend(this.canvas);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  show(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.scene = scene;
    this.camera = camera;
    this.canvas.style.display = 'block';
    this.resize();
  }

  hide(): void {
    this.canvas.style.display = 'none';
    if (this.scene) disposeScene(this.scene);
    this.scene = null;
    this.renderer.renderLists.dispose();
  }

  render(): void {
    if (this.scene) this.renderer.render(this.scene, this.camera);
  }

  resize(): void {
    const w = this.parent.clientWidth || window.innerWidth;
    const h = this.parent.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Where a world point lands in Phaser game coordinates (1600×900), using the Phaser canvas
   * position on the page. Used to put tap zones over 3D objects.
   */
  toGame(
    point: THREE.Vector3,
    phaserCanvas: HTMLCanvasElement,
    gameW: number,
    gameH: number,
  ): { x: number; y: number } {
    const p = point.clone().project(this.camera);
    const r3 = this.canvas.getBoundingClientRect();
    const clientX = r3.left + ((p.x + 1) / 2) * r3.width;
    const clientY = r3.top + ((1 - p.y) / 2) * r3.height;
    const rp = phaserCanvas.getBoundingClientRect();
    return {
      x: ((clientX - rp.left) / rp.width) * gameW,
      y: ((clientY - rp.top) / rp.height) * gameH,
    };
  }
}

/** Frees per-screen geometry and materials; shared model geometry is flagged and kept. */
function disposeScene(scene: THREE.Scene): void {
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.shared) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        m.dispose();
      }
    }
  });
  if (scene.background instanceof THREE.Texture) scene.background.dispose();
}

let stage: Stage | null = null;

export function getStage(): Stage {
  if (!stage) stage = new Stage(document.getElementById('game')!);
  return stage;
}

/** Vertical sky gradient used as a scene background. */
export function skyTexture(top: string, bottom: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
