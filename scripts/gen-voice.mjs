// Generates Russian voice files from src/i18n/ru.ts.
//   ElevenLabs (when ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are set in .env.local) or
//   macOS `say` (voice Milena) as a fallback. Output is trimmed and saved as mono mp3.
// Only re-generates lines whose text or voice changed (manifest in public/assets/voice/manifest.json).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { VOICE } from '../src/i18n/ru.ts';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const eleven = process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID;
const speak = eleven ? (await import('./eleven.mjs')).speak : null;

const out = 'public/assets/voice';
const manifestPath = join(out, 'manifest.json');
mkdirSync(out, { recursive: true });
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const voice = process.env.VOICE ?? 'Milena';
const provider = eleven ? `eleven:${process.env.ELEVENLABS_VOICE_ID}` : `mac:${voice}`;
const tmp = join(tmpdir(), 'voice-src');

let made = 0;
for (const [id, text] of Object.entries(VOICE)) {
  const file = join(out, `${id}.mp3`);
  const stamp = `${provider}|${text}`;
  if (manifest[id] === stamp && existsSync(file)) continue;
  if (speak) writeFileSync(tmp, await speak(process.env.ELEVENLABS_VOICE_ID, text));
  else execFileSync('say', ['-v', voice, '-r', '165', '-o', `${tmp}.aiff`, text]);
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-i',
    speak ? tmp : `${tmp}.aiff`,
    '-af',
    'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse',
    '-ac',
    '1',
    '-b:a',
    '64k',
    file,
  ]);
  manifest[id] = stamp;
  made++;
  if (made % 20 === 0) console.log(`  ${made} lines…`);
}
rmSync(tmp, { force: true });
rmSync(`${tmp}.aiff`, { force: true });
// Drop lines that no longer exist.
for (const f of readdirSync(out)) {
  const id = f.replace(/\.mp3$/, '');
  if (f.endsWith('.mp3') && !(id in VOICE)) {
    rmSync(join(out, f));
    delete manifest[id];
  }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`voice (${provider}): ${made} generated, ${Object.keys(VOICE).length} total`);
