// How a customer reacts to a shelf price, Moonlighter style: an emoji shows how the price sits
// against today's fair price, and the notebook remembers the emoji for each price tried.
// A bargain or a fair price sells; a dear price still sells but cools demand; too dear walks away.

import { AMANAH_MAX, AMANAH_MIN } from './data';
import type { Rng } from './rng';

export type Reaction = 'delighted' | 'happy' | 'unsure' | 'angry';
export type Sensitivity = 'low' | 'normal' | 'high';

/** Upper bound of each band as a share of today's fair price, by sensitivity. */
const BANDS: Readonly<Record<Sensitivity, { delighted: number; happy: number; unsure: number }>> = {
  normal: { delighted: 0.85, happy: 1.05, unsure: 1.25 },
  low: { delighted: 0.95, happy: 1.15, unsure: 1.4 },
  high: { delighted: 0.8, happy: 1.0, unsure: 1.15 },
};

export function reaction(price: number, fair: number, sensitivity: Sensitivity = 'normal'): Reaction {
  const ratio = price / fair;
  const b = BANDS[sensitivity];
  if (ratio < b.delighted) return 'delighted';
  if (ratio <= b.happy) return 'happy';
  if (ratio <= b.unsure) return 'unsure';
  return 'angry';
}

export interface VisitOutcome {
  reaction: Reaction;
  bought: number;
  amanahDelta: number;
}

/** One customer looking at one slot. */
export function visit(rng: Rng, price: number, fair: number, stock: number, sensitivity: Sensitivity = 'normal'): VisitOutcome {
  const r = reaction(price, fair, sensitivity);
  let want = 0;
  if (r === 'delighted') want = rng.chance(0.5) ? 2 : 1;
  else if (r === 'happy') want = 1;
  else if (r === 'unsure') want = 1;
  const bought = Math.min(want, stock);
  let amanahDelta = 0;
  if (bought > 0 && r === 'happy') amanahDelta = 0.5;
  if (bought > 0 && r === 'unsure') amanahDelta = -0.3;
  if (r === 'angry') amanahDelta = -1.5;
  return { reaction: r, bought, amanahDelta };
}

/** The emoji each reaction shows above a customer and in the notebook. */
export const REACTION_EMOJI: Readonly<Record<Reaction, string>> = {
  delighted: '🤩',
  happy: '😊',
  unsure: '😕',
  angry: '😠',
};

export function clampAmanah(value: number): number {
  return Math.max(AMANAH_MIN, Math.min(AMANAH_MAX, value));
}

/** Extra (or fewer) customers a day from your good name. */
export function amanahCustomers(amanah: number): number {
  if (amanah >= 80) return 3;
  if (amanah >= 65) return 1;
  if (amanah < 25) return -2;
  return 0;
}
