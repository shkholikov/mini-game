// Copies the Kenney CC0 2D files the game uses into public/assets.
// (3D models in public/assets/3d come from Kenney Car Kit, Racing Kit, Cube Pets and Food Kit, copied by hand.)
// Usage: node scripts/copy-kenney.mjs <dir-with-unzipped-kenney-packs>
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src)
  throw new Error(
    'Pass the folder that contains kenney_racing-pack, kenney_animal-pack, kenney_interface-sounds',
  );
const out = 'public/assets';

const copy = (from, to) => {
  mkdirSync(join(out, to, '..'), { recursive: true });
  copyFileSync(join(src, from), join(out, to));
};

const racing = 'kenney_racing-pack/PNG';
copy(`${racing}/Objects/lights.png`, 'race/lights.png');
copy(`${racing}/Tiles/Grass/land_grass04.png`, 'race/land_grass.png');
copy(`${racing}/Tiles/Sand/land_sand04.png`, 'race/land_sand.png');
copy('kenney_racing-pack/License.txt', 'LICENSE-kenney-racing.txt');

// Interface sounds → mp3 (ogg is not reliable on older iPads)
const sounds = {
  correct: 'confirmation_001',
  tap: 'select_001',
  pop: 'pluck_001',
  coin: 'glass_001',
  soft: 'back_001',
  whoosh: 'maximize_006',
  drop: 'drop_002',
};
mkdirSync(join(out, 'sfx'), { recursive: true });
for (const [name, file] of Object.entries(sounds)) {
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    join(src, 'kenney_interface-sounds/Audio', `${file}.ogg`),
    '-ac',
    '1',
    '-b:a',
    '64k',
    join(out, 'sfx', `${name}.mp3`),
  ]);
}
copy('kenney_interface-sounds/License.txt', 'LICENSE-kenney-sounds.txt');
console.log('Kenney assets copied to', out);
