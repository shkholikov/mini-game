import { describe, expect, it } from 'vitest';
import {
  TRACKS,
  TRACK_ORDER,
  clampLane,
  generateTrack,
  isObstacle,
  laneAt,
  laneX,
} from '../src/systems/raceLogic';
import { createRng } from '../src/systems/rng';

describe('raceLogic', () => {
  it('maps lanes to x and back', () => {
    for (const lane of [0, 1, 2]) expect(laneAt(laneX(lane))).toBe(lane);
    expect(laneAt(0)).toBe(0);
    expect(laneAt(1600)).toBe(2);
    expect(clampLane(-1)).toBe(0);
    expect(clampLane(5)).toBe(2);
  });

  for (const id of TRACK_ORDER) {
    it(`${id}: never blocks all lanes and stays inside the track`, () => {
      for (let seed = 1; seed < 40; seed++) {
        const track = TRACKS[id];
        const spawns = generateTrack(createRng(seed), track);
        const rows = new Map<number, Set<number>>();
        for (const s of spawns) {
          expect(s.d).toBeGreaterThan(0);
          expect(s.d).toBeLessThan(track.length);
          expect(s.lane).toBeGreaterThanOrEqual(0);
          expect(s.lane).toBeLessThan(3);
          if (isObstacle(s.kind) || s.kind === 'rival') {
            const set = rows.get(s.d) ?? new Set();
            set.add(s.lane);
            rows.set(s.d, set);
          }
        }
        for (const lanes of rows.values()) expect(lanes.size).toBeLessThan(3);
      }
    });

    it(`${id}: has enough stars to count and some boosts`, () => {
      const spawns = generateTrack(createRng(7), TRACKS[id]);
      expect(spawns.filter((s) => s.kind === 'star').length).toBeGreaterThanOrEqual(10);
      expect(spawns.some((s) => s.kind === 'boost')).toBe(true);
    });
  }

  it('uses only obstacles that belong to the track', () => {
    const spawns = generateTrack(createRng(3), TRACKS.desert);
    for (const s of spawns)
      if (isObstacle(s.kind)) expect(TRACKS.desert.obstacles).toContain(s.kind);
  });
});
