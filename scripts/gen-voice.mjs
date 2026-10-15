// Generates Russian voice files from src/i18n/ru.ts with macOS `say` (voice Milena) + ffmpeg.
// Only re-generates lines whose text changed (manifest in public/assets/voice/manifest.json).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VOICE } from '../src/i18n/ru.ts';

const out = 'public/assets/voice';
const manifestPath = join(out, 'manifest.json');
mkdirSync(out, { recursive: true });
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const voice = process.env.VOICE ?? 'Milena';
const tmp = join(tmpdir(), 'voice.aiff');

let made = 0;
for (const [id, text] of Object.entries(VOICE)) {
  const file = join(out, `${id}.mp3`);
  if (manifest[id] === text && existsSync(file)) continue;
  execFileSync('say', ['-v', voice, '-r', '165', '-o', tmp, text]);
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    tmp,
    '-af',
    'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse',
    '-ac',
    '1',
    '-b:a',
    '64k',
    file,
  ]);
  manifest[id] = text;
  made++;
}
rmSync(tmp, { force: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`voice: ${made} generated, ${Object.keys(VOICE).length} total`);
