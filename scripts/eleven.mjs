// Small ElevenLabs client used by the voice scripts. The key comes from .env.local and is never printed.
import { existsSync } from 'node:fs';

if (existsSync('.env.local')) process.loadEnvFile('.env.local');

const API = 'https://api.elevenlabs.io/v1';
export const MODEL = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error('ELEVENLABS_API_KEY is missing: add it to .env.local');
  return k;
}

async function call(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'xi-api-key': key(), ...init.headers },
  });
  if (!res.ok)
    throw new Error(`ElevenLabs ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

export async function listVoices() {
  const data = await (await call('/voices')).json();
  return data.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    category: v.category,
    labels: v.labels ?? {},
  }));
}

/** Russian voices from the public library, with free preview links. */
export async function russianLibraryVoices(limit = 8) {
  const data = await (
    await call(`/shared-voices?language=ru&page_size=${limit}&sort=trending`)
  ).json();
  return (data.voices ?? []).map((v) => ({
    id: v.voice_id,
    owner: v.public_owner_id,
    name: v.name,
    gender: v.gender,
    age: v.age,
    preview: v.preview_url,
    description: v.description,
  }));
}

/** Text → mp3 bytes. Settings lean warm and lively for small children. */
export async function speak(voiceId, text) {
  const res = await call(`/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.8,
        style: 0.35,
        use_speaker_boost: true,
      },
    }),
  });
  return Buffer.from(await res.arrayBuffer());
}
