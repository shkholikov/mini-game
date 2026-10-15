export const GAME_WIDTH = 1600;
export const GAME_HEIGHT = 900;

/** Visible on every screen down to 4:3; keep everything tappable inside it. */
export const SAFE = { left: 200, right: 1400, top: 0, bottom: 900 } as const;

/** Minimum tap target for a 3-year-old, in base-resolution pixels. */
export const MIN_TARGET = 120;
