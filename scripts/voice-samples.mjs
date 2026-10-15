// Makes short samples so you can choose a voice: `pnpm voice:samples [voiceId ...]`
// Without ids it uses up to 4 of your account's voices. Also downloads free previews of
// popular Russian library voices. Files go to voice-samples/ (git-ignored).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listVoices, russianLibraryVoices, speak } from './eleven.mjs';

const out = 'voice-samples';
mkdirSync(out, { recursive: true });
const SAMPLE = 'Кто играет? Осман или Сафия? ... Зайчик хочет морковку! ... Финиш! Ты первый!';

const ids = process.argv.slice(2);
const voices = await listVoices();
const chosen = ids.length ? voices.filter((v) => ids.includes(v.id)) : voices.slice(0, 4);
for (const v of chosen) {
  const file = join(out, `${v.name.replace(/[^\p{L}\p{N}]+/gu, '_')}.mp3`);
  writeFileSync(file, await speak(v.id, SAMPLE));
  console.log(`sample  ${file}  id=${v.id}  ${JSON.stringify(v.labels)}`);
}

try {
  for (const v of await russianLibraryVoices()) {
    if (!v.preview) continue;
    const file = join(out, `library_${v.name.replace(/[^\p{L}\p{N}]+/gu, '_')}.mp3`);
    writeFileSync(file, Buffer.from(await (await fetch(v.preview)).arrayBuffer()));
    console.log(`preview ${file}  id=${v.id} owner=${v.owner}  ${v.gender ?? ''} ${v.age ?? ''}`);
  }
} catch (e) {
  console.warn('could not list library voices:', e.message);
}
