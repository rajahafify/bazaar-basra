// Seeded random numbers, so a run of the economy can be replayed exactly
// for tests, balance runs and bug reports. Mulberry32: small, fast, good enough for a game.

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** An integer in [min, max], both ends included. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** The internal state, to save and later resume with createRng(state). */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    chance: p => next() < p,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: items => {
      if (items.length === 0) throw new Error('pick from an empty list');
      return items[Math.floor(next() * items.length)]!;
    },
    state: () => a,
  };
}
