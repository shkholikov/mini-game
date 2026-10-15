import { CAR_MODELS, type CarModel, type TrackId } from '../i18n/ru';

export interface Progress {
  version: 1;
  safia: { fed: number; parties: number };
  umar: { rides: number };
  osman: {
    car: CarModel;
    races: number;
    /** island: rounds = all 15 stars collected, stars = stars picked up in total */
    island: { rounds: number; stars: number };
    cups: Record<TrackId, number>;
    bestStars: Record<TrackId, number>;
  };
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'osman-safia-progress';

export function defaultProgress(): Progress {
  return {
    version: 1,
    safia: { fed: 0, parties: 0 },
    umar: { rides: 0 },
    osman: {
      car: 'race',
      races: 0,
      island: { rounds: 0, stars: 0 },
      cups: { city: 0, forest: 0, desert: 0 },
      bestStars: { city: 0, forest: 0, desert: 0 },
    },
  };
}

/** Fills missing fields from defaults so older or partial saves never crash and never lose data. */
function merge(raw: Partial<Progress>): Progress {
  const d = defaultProgress();
  return {
    version: 1,
    safia: { ...d.safia, ...raw.safia },
    umar: { ...d.umar, ...raw.umar },
    osman: {
      ...d.osman,
      ...raw.osman,
      // Cars used to be colours; anything unknown falls back to the race car.
      car: raw.osman?.car && raw.osman.car in CAR_MODELS ? raw.osman.car : d.osman.car,
      island: { ...d.osman.island, ...raw.osman?.island },
      cups: { ...d.osman.cups, ...raw.osman?.cups },
      bestStars: { ...d.osman.bestStars, ...raw.osman?.bestStars },
    },
  };
}

export class Save {
  private state: Progress;

  constructor(private readonly storage: KeyValueStorage | null = safeLocalStorage()) {
    this.state = this.load();
  }

  get(): Progress {
    return this.state;
  }

  update(fn: (p: Progress) => void): Progress {
    const next = structuredClone(this.state);
    fn(next);
    this.state = next;
    try {
      this.storage?.setItem(KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('[save] could not write progress', e);
    }
    return next;
  }

  private load(): Progress {
    const raw = this.storage?.getItem(KEY);
    if (!raw) return defaultProgress();
    try {
      return merge(JSON.parse(raw) as Partial<Progress>);
    } catch (e) {
      console.warn('[save] unreadable progress, keeping a backup', e);
      this.storage?.setItem(`${KEY}-corrupt-${Date.now()}`, raw);
      return defaultProgress();
    }
  }
}

function safeLocalStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function totalCups(p: Progress): number {
  return Object.values(p.osman.cups).reduce((a, b) => a + b, 0);
}
