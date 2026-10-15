# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

3D web game for two kids on a tablet: **Осман** (5, cars/racing) and **Сафия** (3, animals/fruits). All voice and text is Russian.

## Commands

```bash
pnpm dev                          # http://localhost:5173 (also on the LAN: open http://<mac-ip>:5173 on the tablet)
pnpm build                        # tsc + vite build → dist/
pnpm test                         # vitest (logic + voice files up to date)
pnpm vitest run tests/raceLogic.test.ts   # single file
pnpm test:e2e                     # playwright smoke (builds, serves on :4173)
pnpm lint                         # eslint + prettier --check
pnpm voice                        # regenerate Russian voice mp3s from src/i18n/ru.ts (macOS `say`, voice Milena, + ffmpeg)
pnpm assets <dir>                 # re-copy Kenney CC0 files from unzipped packs in <dir>
```

## Architecture

- **Hybrid renderer.** Three.js draws every 3D world in `#stage3d`, a canvas _behind_ the transparent Phaser canvas (`transparent: true`). Phaser owns HUD, buttons, text, particles (confetti, hearts) and all input. `src/three/stage.ts` holds the single shared `WebGLRenderer`; each scene calls `getStage().show(world.scene, world.camera)` in `create`, `stage.render()` in `update`, and `stage.hide()` on `shutdown`.
- **Tap targets over 3D objects** are Phaser `Zone`s repositioned every frame with `stage.toGame(worldPoint, …)`; dragging in 3D uses `rayFromGame(...)` and a ground plane.
- Scenes → worlds: `Title` → `TitleWorld` (floating island), `Feed` → `FeedWorld` (meadow, blanket, farm), `Garage` → `GarageWorld` (showroom), `Race` → `RaceWorld` (chase-cam track). Scenes keep the game rules; worlds only mirror them in 3D.
- `src/three/models.ts` loads all GLBs once in `Boot` (`loadModels`), recentres them on the ground (`normalize`), and exposes `model()`, `fruit()` (size-normalised) and `Pet` (animated Cube Pet with clips idle/walk/run/eat/dance/gesture-positive/gesture-negative). `thumbs.ts` renders models into Phaser textures `thumb_<car>`, `thumb_pet_<animal>`, `thumb_fruit_<fruit>` for 2D UI.
- Phaser **4** + Three.js + TypeScript + Vite. Don't write Phaser 3 APIs from memory — check `node_modules/phaser/skills/` and `node_modules/phaser/types/phaser.d.ts`.
- Pure, Phaser-free logic lives in `src/systems/` and is unit-tested: `feedLogic` (rounds, miss → hint escalation), `raceLogic` (lanes, track generation that never blocks all lanes; logic units are px, `RaceWorld.K` converts to world units), `save` (localStorage with defaults merge), `rng` (seeded).
- `src/systems/voice.ts`: `voice().say(...ids)` plays `public/assets/voice/<id>.mp3` in sequence; a new line interrupts the old one; a missing file only warns.
- All Russian text and voice lines are in `src/i18n/ru.ts` (animals, fruits, cars, tracks). After changing it, run `pnpm voice` (a test fails if mp3s are stale). Adding an animal also needs `public/assets/3d/pets/<id>.glb`.
- UI kit in `src/ui/`: `theme.ts` (fonts Nunito + Russo One bundled via @fontsource, colours, `gameText`), `button.ts` (`candyButton`, `iconButton`, `homeButton`, `sticker`), `effects.ts` (confetti, hearts, code-made textures). Icons are Kenney Game Icons loaded as `icon_<name>`. Fonts are awaited (`loadFonts`) before the Phaser game is created.
- `Title` shows a Play screen once per visit: that tap unlocks audio and fullscreens `#game` (both canvases; `scale.fullscreenTarget: 'game'`).
- Portrait: `#rotate-hint` (HTML/CSS in `index.html`/`style.css`, text from `ru.ts`) covers the game and `main.ts` pauses the loop and sounds.
- Base resolution 1600×900, `Scale.FIT`, landscape only.

## Rules for the kids' experience

- No losing, no timers in Сафия's game, no "wrong"/red crosses: a miss → soft bounce + voice; 2nd miss highlights the answer; 3rd miss the game helps.
- In the race, hitting things only wobbles and slows the car; every race ends at the finish with a cup.
- Every instruction is spoken. Tap targets ≥ 120 px for Сафия.
- No network calls, ads, analytics or external links.

## Assets

All art is Kenney CC0 (`public/assets/LICENSE-kenney-*.txt`): 3D Car Kit, Racing Kit, Cube Pets and Food Kit in `public/assets/3d/` (each pack keeps its own `Textures/colormap.png`), plus 2D UI sounds and a few 2D race tiles. Voice: generated TTS (macOS Milena).
