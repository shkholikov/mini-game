/** Blocks browser gestures that would let a child zoom, select, open menus or leave the game. */
export function installTouchGuards(): void {
  const prevent = (e: Event): void => e.preventDefault();

  document.addEventListener('contextmenu', prevent);
  document.addEventListener('selectstart', prevent);
  document.addEventListener('dragstart', prevent);
  // Safari pinch gestures
  document.addEventListener('gesturestart', prevent);
  document.addEventListener('gesturechange', prevent);
  // Multi-finger pinch and double-tap zoom
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('dblclick', prevent);
  // Ctrl+wheel zoom on desktop
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false },
  );

  // Android back gesture/button: keep the user inside the game.
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => history.pushState(null, '', location.href));
}
