// Copies the Kenney CC0 files the game uses into public/assets.
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
for (const color of ['red', 'blue', 'green', 'yellow', 'black']) {
  for (const n of [1, 2, 3, 4, 5])
    copy(`${racing}/Cars/car_${color}_${n}.png`, `cars/car_${color}_${n}.png`);
}
for (const o of [
  'cone_straight',
  'barrel_red',
  'barrel_blue',
  'tires_red',
  'tires_white',
  'arrow_yellow',
  'tree_large',
  'tree_small',
  'tribune_full',
  'tent_red',
  'tent_blue',
  'oil',
  'rock1',
  'rock2',
  'lights',
]) {
  copy(`${racing}/Objects/${o}.png`, `race/${o}.png`);
}
copy(`${racing}/Tiles/Grass/land_grass04.png`, 'race/land_grass.png');
copy(`${racing}/Tiles/Sand/land_sand04.png`, 'race/land_sand.png');
copy(`${racing}/Tiles/Dirt/land_dirt04.png`, 'race/land_dirt.png');
copy('kenney_racing-pack/License.txt', 'LICENSE-kenney-racing.txt');

for (const a of [
  'elephant',
  'giraffe',
  'hippo',
  'monkey',
  'panda',
  'parrot',
  'penguin',
  'pig',
  'rabbit',
]) {
  copy(`kenney_animal-pack/PNG/Round/${a}.png`, `animals/${a}.png`);
}
copy('kenney_animal-pack/License.txt', 'LICENSE-kenney-animals.txt');

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
