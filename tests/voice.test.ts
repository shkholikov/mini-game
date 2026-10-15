import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VOICE } from '../src/i18n/ru';

describe('voice files', () => {
  it('has a generated mp3 for every line with the current text', () => {
    const manifest = JSON.parse(
      readFileSync('public/assets/voice/manifest.json', 'utf8'),
    ) as Record<string, string>;
    const stale = Object.entries(VOICE).filter(
      ([id, text]) => manifest[id] !== text || !existsSync(`public/assets/voice/${id}.mp3`),
    );
    expect(
      stale.map(([id]) => id),
      'run `pnpm voice`',
    ).toEqual([]);
  });
});
