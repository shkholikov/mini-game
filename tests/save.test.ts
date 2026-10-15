import { describe, expect, it } from 'vitest';
import { Save, defaultProgress, totalCups, type KeyValueStorage } from '../src/systems/save';

class Memory implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('save', () => {
  it('starts with defaults', () => {
    expect(new Save(new Memory()).get()).toEqual(defaultProgress());
  });

  it('persists updates', () => {
    const m = new Memory();
    new Save(m).update((p) => {
      p.osman.cups.city = 2;
      p.safia.fed = 7;
    });
    const p = new Save(m).get();
    expect(p.osman.cups.city).toBe(2);
    expect(p.safia.fed).toBe(7);
    expect(totalCups(p)).toBe(2);
  });

  it('fills missing fields from a partial save', () => {
    const m = new Memory();
    m.setItem(
      'osman-safia-progress',
      JSON.stringify({ osman: { car: 'blue', cups: { city: 1 } } }),
    );
    const p = new Save(m).get();
    expect(p.osman.car).toBe('blue');
    expect(p.osman.cups).toEqual({ city: 1, forest: 0, desert: 0 });
    expect(p.safia).toEqual({ fed: 0, parties: 0 });
  });

  it('keeps a backup of an unreadable save', () => {
    const m = new Memory();
    m.setItem('osman-safia-progress', '{oops');
    expect(new Save(m).get()).toEqual(defaultProgress());
    expect([...m.data.keys()].some((k) => k.startsWith('osman-safia-progress-corrupt-'))).toBe(
      true,
    );
  });

  it('works without storage', () => {
    const s = new Save(null);
    s.update((p) => void (p.safia.fed = 1));
    expect(s.get().safia.fed).toBe(1);
  });
});
