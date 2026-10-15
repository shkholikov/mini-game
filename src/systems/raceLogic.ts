import type { TrackId } from '../i18n/ru';
import { pick, type Rng } from './rng';

export const LANE_COUNT = 3;
export const LANE_WIDTH = 160;
export const ROAD_CENTER = 800;

export type ObstacleKind =
  'cone_straight' | 'barrel_red' | 'barrel_blue' | 'tires_red' | 'oil' | 'rock1';
export type SpawnKind = 'star' | 'boost' | 'rival' | ObstacleKind;

export interface Spawn {
  /** Distance from the start line in px */
  d: number;
  lane: number;
  kind: SpawnKind;
}

export interface TrackDef {
  id: TrackId;
  land: string;
  road: number;
  length: number;
  obstacles: ObstacleKind[];
  decor: string[];
}

export const TRACKS: Record<TrackId, TrackDef> = {
  city: {
    id: 'city',
    land: 'land_grass',
    road: 0x6f7377,
    length: 15000,
    obstacles: ['cone_straight', 'barrel_red', 'barrel_blue'],
    decor: ['tree_large', 'tree_small', 'tribune_full', 'tent_red'],
  },
  forest: {
    id: 'forest',
    land: 'land_grass',
    road: 0x9a7048,
    length: 19000,
    obstacles: ['tires_red', 'oil', 'cone_straight'],
    decor: ['tree_large', 'tree_large', 'tree_small', 'tent_blue'],
  },
  desert: {
    id: 'desert',
    land: 'land_sand',
    road: 0xc9a46a,
    length: 23000,
    obstacles: ['rock1', 'barrel_red', 'tires_red'],
    decor: ['rock2', 'rock1', 'tent_red', 'tree_small'],
  },
};

export const TRACK_ORDER: TrackId[] = ['city', 'forest', 'desert'];

export function laneX(lane: number): number {
  return ROAD_CENTER + (lane - (LANE_COUNT - 1) / 2) * LANE_WIDTH;
}

export function clampLane(lane: number): number {
  return Math.max(0, Math.min(LANE_COUNT - 1, lane));
}

/** Lane under a tap x position (taps left/right of the road pick the outer lanes). */
export function laneAt(x: number): number {
  return clampLane(Math.round((x - ROAD_CENTER) / LANE_WIDTH + (LANE_COUNT - 1) / 2));
}

/**
 * Lays out stars, obstacles, boosts and rival cars along the track.
 * Rows are spaced so a 5-year-old has time to react, and a row never blocks all lanes.
 */
export function generateTrack(rng: Rng, track: TrackDef): Spawn[] {
  const spawns: Spawn[] = [];
  let d = 1100;
  const end = track.length - 700;
  while (d < end) {
    const roll = rng();
    const lane = Math.floor(rng() * LANE_COUNT);
    if (roll < 0.42) {
      // a short line of stars in one lane
      const n = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) spawns.push({ d: d + i * 120, lane, kind: 'star' });
      d += (n - 1) * 120;
    } else if (roll < 0.74) {
      spawns.push({ d, lane, kind: pick(rng, track.obstacles) });
      if (rng() < 0.35) {
        // second obstacle in another lane, always leaving one lane free
        const other = (lane + 1 + Math.floor(rng() * (LANE_COUNT - 1))) % LANE_COUNT;
        spawns.push({ d, lane: other, kind: pick(rng, track.obstacles) });
        const free = [0, 1, 2].find((l) => l !== lane && l !== other)!;
        spawns.push({ d, lane: free, kind: 'star' });
      }
    } else if (roll < 0.84) {
      spawns.push({ d, lane, kind: 'boost' });
    } else {
      spawns.push({ d, lane, kind: 'rival' });
    }
    d += 420 + Math.floor(rng() * 220);
  }
  return spawns;
}

export function isObstacle(kind: SpawnKind): kind is ObstacleKind {
  return kind !== 'star' && kind !== 'boost' && kind !== 'rival';
}
