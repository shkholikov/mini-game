import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VOICE, starsSentence } from '../src/i18n/ru';

describe('voice files', () => {
  it('has a generated mp3 for every line with the current text', () => {
    const manifest = JSON.parse(
      readFileSync('public/assets/voice/manifest.json', 'utf8'),
    ) as Record<string, string>;
    const stale = Object.entries(VOICE).filter(
      ([id, text]) =>
        !manifest[id]?.endsWith(`|${text}`) || !existsSync(`public/assets/voice/${id}.mp3`),
    );
    expect(
      stale.map(([id]) => id),
      'run `pnpm voice`',
    ).toEqual([]);
  });
});

describe('starsSentence', () => {
  it('uses the right Russian number and noun forms', () => {
    expect(starsSentence(1)).toBe('Ты собрал одну звезду!');
    expect(starsSentence(2)).toBe('Ты собрал две звезды!');
    expect(starsSentence(4)).toBe('Ты собрал четыре звезды!');
    expect(starsSentence(5)).toBe('Ты собрал пять звёзд!');
    expect(starsSentence(11)).toBe('Ты собрал одиннадцать звёзд!');
    expect(starsSentence(12)).toBe('Ты собрал двенадцать звёзд!');
    expect(starsSentence(20)).toBe('Ты собрал двадцать звёзд!');
    expect(starsSentence(21)).toBe('Ты собрал двадцать одну звезду!');
    expect(starsSentence(23)).toBe('Ты собрал двадцать три звезды!');
    expect(starsSentence(30)).toBe('Ты собрал тридцать звёзд!');
  });
});
