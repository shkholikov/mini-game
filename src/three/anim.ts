/** Tiny promise-based tween runner for Three.js objects, advanced from the scene's update loop. */
export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outBack: (t: number) => {
    const c = 1.70158;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
  },
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
};

interface Job {
  t: number;
  duration: number;
  step: (k: number) => void;
  ease: Ease;
  resolve: () => void;
}

export class Animator {
  private jobs: Job[] = [];

  /** Calls `step` with eased progress 0→1 over `duration` seconds. */
  run(duration: number, step: (k: number) => void, e: Ease = ease.inOutSine): Promise<void> {
    return new Promise((resolve) => this.jobs.push({ t: 0, duration, step, ease: e, resolve }));
  }

  wait(seconds: number): Promise<void> {
    return this.run(seconds, () => undefined);
  }

  update(dt: number): void {
    const finished: Job[] = [];
    for (const j of this.jobs) {
      j.t = Math.min(j.duration, j.t + dt);
      j.step(j.ease(j.duration === 0 ? 1 : j.t / j.duration));
      if (j.t >= j.duration) finished.push(j);
    }
    if (finished.length) {
      this.jobs = this.jobs.filter((j) => !finished.includes(j));
      for (const j of finished) j.resolve();
    }
  }
}
