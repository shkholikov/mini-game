import type { AnimalId } from '../i18n/ru';
import { ANIMAL_IDS } from './feedLogic';
import { pick, type Rng } from './rng';

/** Tractor cruising speed in world units per second. */
export const TRACTOR_SPEED = 2.4;
/** Quickest honk repeat, so a toddler mashing the screen doesn't turn it into noise. */
export const HONK_GAP_MS = 300;
/** How long the home button has to be held in Умар's mode before the parent panel opens. */
export const HOLD_TO_EXIT_MS = 2000;
/** Every this many animals by the road, the next stop is a barn (about every 30 s). */
export const ANIMALS_PER_BARN = 4;
/** Distance between two things by the road, in world units. */
export const ROAD_GAP = { min: 12, max: 17 } as const;

export interface RoadItem {
  kind: 'animal' | 'barn';
  /** the animal by the road, or the one hiding in the barn */
  animal: AnimalId;
  /** position along the road */
  x: number;
}

/** Endless list of what the tractor meets: a few animals, then a barn, and again. */
export class RoadPlan {
  private x: number;
  private count = 0;
  private last: AnimalId | null = null;

  constructor(
    private readonly rng: Rng,
    startX = 10,
  ) {
    this.x = startX;
  }

  next(): RoadItem {
    const animal = pick(
      this.rng,
      ANIMAL_IDS.filter((a) => a !== this.last),
    );
    this.last = animal;
    this.count += 1;
    const kind = this.count % (ANIMALS_PER_BARN + 1) === 0 ? 'barn' : 'animal';
    const item: RoadItem = { kind, animal, x: this.x };
    this.x += ROAD_GAP.min + this.rng() * (ROAD_GAP.max - ROAD_GAP.min);
    return item;
  }
}

/** Lets a honk through at most once per HONK_GAP_MS. */
export class HonkGate {
  private last = -Infinity;

  tryHonk(nowMs: number): boolean {
    if (nowMs - this.last < HONK_GAP_MS) return false;
    this.last = nowMs;
    return true;
  }
}
