# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Web game for two kids on a tablet: **Осман** (5, cars/racing) and **Сафия** (3, animals/fruits). All voice and text is Russian.

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

- Phaser **4** + TypeScript + Vite. Don't write Phaser 3 APIs from memory — check `node_modules/phaser/skills/` and `node_modules/phaser/types/phaser.d.ts` (masks are filters now, `setTintFill` is gone, etc).
- Scenes: `Boot` (loads everything, makes code-drawn textures) → `Title` (two cards) → `Feed` (Сафия) or `Garage` → `Race` (Осман).
- Pure, Phaser-free logic lives in `src/systems/` and is unit-tested: `feedLogic` (rounds, miss → hint escalation), `raceLogic` (lanes, track generation that never blocks all lanes), `save` (localStorage with defaults merge), `rng` (seeded).
- `src/systems/voice.ts`: `voice().say(...ids)` plays `public/assets/voice/<id>.mp3` in sequence; a new line interrupts the old one; a missing file only warns.
- All Russian text and voice lines are in `src/i18n/ru.ts`. After changing `VOICE`, run `pnpm voice` (a test fails if mp3s are stale).
- Base resolution 1600×900, `Scale.FIT`, landscape only; keep tappable things inside x 200–1400 so 4:3 tablets see them.

## Rules for the kids' experience

- No losing, no timers in Сафия's game, no "wrong"/red crosses: a miss → soft bounce + voice; 2nd miss highlights the answer; 3rd miss the game helps.
- In the race, hitting things only wobbles and slows the car; every race ends at the finish with a cup.
- Every instruction is spoken. Tap targets ≥ 120 px for Сафия.
- No network calls, ads, analytics or external links.

## Assets

Cars, track objects, animals and UI sounds: Kenney CC0 (`public/assets/LICENSE-kenney-*.txt`). Fruits: hand-written SVGs in `public/assets/fruits/`. Voice: generated TTS.
