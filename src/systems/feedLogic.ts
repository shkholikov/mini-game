import { ANIMALS, FRUITS, type AnimalId, type FruitId } from '../i18n/ru';
import { pick, shuffle, type Rng } from './rng';

export const ANIMAL_IDS = Object.keys(ANIMALS) as AnimalId[];
export const FRUIT_IDS = Object.keys(FRUITS) as FruitId[];

/** Animals that always want their "own" food, so the game teaches the classic pairs. */
export const SIGNATURE: Partial<Record<AnimalId, FruitId>> = { rabbit: 'carrot', monkey: 'banana' };

export const ANIMALS_PER_PARTY = 5;

export interface FeedRound {
  animal: AnimalId;
  want: FruitId;
  /** Fruits offered at the bottom, includes `want` */
  options: FruitId[];
}

/** First rounds offer 2 fruits, later 3: easy start for a 3-year-old. */
export function optionsCount(roundIndex: number): number {
  return roundIndex < 2 ? 2 : 3;
}

/** One party: ANIMALS_PER_PARTY different animals, each wanting one fruit. */
export function makeParty(rng: Rng): FeedRound[] {
  const animals = shuffle(rng, ANIMAL_IDS).slice(0, ANIMALS_PER_PARTY);
  return animals.map((animal, i) => {
    const want =
      SIGNATURE[animal] ??
      pick(
        rng,
        FRUIT_IDS.filter((f) => f !== 'carrot'),
      );
    const distractors = shuffle(
      rng,
      FRUIT_IDS.filter((f) => f !== want),
    ).slice(0, optionsCount(i) - 1);
    return { animal, want, options: shuffle(rng, [want, ...distractors]) };
  });
}

export type MissAction = 'retry' | 'highlight' | 'help';

/** No losing: 1st miss → try again, 2nd → highlight the right fruit, 3rd → the game helps. */
export function missAction(misses: number): MissAction {
  if (misses >= 3) return 'help';
  if (misses === 2) return 'highlight';
  return 'retry';
}
