export const GAME_WIDTH = 1600;
export const GAME_HEIGHT = 900;

/** Area visible on every supported screen (down to 4:3). All interactive objects must stay inside it. */
export const SAFE_AREA = {
  x: (GAME_WIDTH - (GAME_HEIGHT * 4) / 3) / 2,
  y: 0,
  width: (GAME_HEIGHT * 4) / 3,
  height: GAME_HEIGHT,
} as const;
