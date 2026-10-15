import { describe, expect, it } from 'vitest';
import { createRng } from '../src/systems/rng';
import {
  ANIMALS_PER_BARN,
  HONK_GAP_MS,
  HonkGate,
  ROAD_GAP,
  RoadPlan,
} from '../src/systems/tractorLogic';

describe('tractorLogic', () => {
  it('puts a barn after every few animals', () => {
    const plan = new RoadPlan(createRng(3));
    const kinds = Array.from({ length: 15 }, () => plan.next().kind);
    const barns = kinds.flatMap((k, i) => (k === 'barn' ? [i] : []));
    expect(barns).toEqual([ANIMALS_PER_BARN, ANIMALS_PER_BARN * 2 + 1, ANIMALS_PER_BARN * 3 + 2]);
  });

  it('never shows the same animal twice in a row and keeps a steady gap', () => {
    for (let seed = 1; seed < 30; seed++) {
      const plan = new RoadPlan(createRng(seed), 10);
      let prev = plan.next();
      expect(prev.x).toBe(10);
      for (let i = 0; i < 40; i++) {
        const item = plan.next();
        expect(item.animal).not.toBe(prev.animal);
        const gap = item.x - prev.x;
        expect(gap).toBeGreaterThanOrEqual(ROAD_GAP.min);
        expect(gap).toBeLessThanOrEqual(ROAD_GAP.max);
        prev = item;
      }
    }
  });

  it('lets a honk through at most once per gap', () => {
    const gate = new HonkGate();
    expect(gate.tryHonk(1000)).toBe(true);
    expect(gate.tryHonk(1000 + HONK_GAP_MS - 1)).toBe(false);
    expect(gate.tryHonk(1000 + HONK_GAP_MS)).toBe(true);
  });
});
