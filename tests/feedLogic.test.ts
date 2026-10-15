import { describe, expect, it } from 'vitest';
import { ANIMALS_PER_PARTY, makeParty, missAction, optionsCount } from '../src/systems/feedLogic';
import { createRng } from '../src/systems/rng';

describe('feedLogic', () => {
  it('makes a party of different animals', () => {
    for (let seed = 1; seed < 50; seed++) {
      const party = makeParty(createRng(seed));
      expect(party).toHaveLength(ANIMALS_PER_PARTY);
      expect(new Set(party.map((r) => r.animal)).size).toBe(ANIMALS_PER_PARTY);
    }
  });

  it('always offers the wanted fruit, without duplicates', () => {
    for (let seed = 1; seed < 50; seed++) {
      makeParty(createRng(seed)).forEach((r, i) => {
        expect(r.options).toContain(r.want);
        expect(new Set(r.options).size).toBe(r.options.length);
        expect(r.options).toHaveLength(optionsCount(i));
      });
    }
  });

  it('keeps the classic pairs', () => {
    for (let seed = 1; seed < 50; seed++) {
      for (const r of makeParty(createRng(seed))) {
        if (r.animal === 'rabbit') expect(r.want).toBe('carrot');
        if (r.animal === 'monkey') expect(r.want).toBe('banana');
        if (r.animal !== 'rabbit') expect(r.want).not.toBe('carrot');
      }
    }
  });

  it('starts easy: 2 fruits, then 3', () => {
    expect([0, 1, 2, 3, 4].map(optionsCount)).toEqual([2, 2, 3, 3, 3]);
  });

  it('never leaves her stuck', () => {
    expect([1, 2, 3, 4].map(missAction)).toEqual(['retry', 'highlight', 'help', 'help']);
  });
});
