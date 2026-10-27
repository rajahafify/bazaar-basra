// How a customer reacts to a shelf price, and what that does to sales and amanah (gdd 4.4, 4.6).

import { AMANAH_MAX, AMANAH_MIN } from './data';
import type { Rng } from './rng';

export type Reaction = 'delighted' | 'happy' | 'unsure' | 'angry';
export type Sensitivity = 'low' | 'normal' | 'high';

/** Upper bound of each band as a share of market price, by sensitivity. */
const BANDS: Readonly<Record<Sensitivity, { delighted: number; happy: number; unsure: number }>> = {
  normal: { delighted: 0.8, happy: 1.1, unsure: 1.3 },
  // "Low-sensitivity customers shift each band up by 20 points."
  low: { delighted: 1.0, happy: 1.3, unsure: 1.5 },
  // "High-sensitivity customers treat anything above 100% as Unsure."
  // Open question for the gdd: we keep "over 130% is Angry" for them too.
  high: { delighted: 0.8, happy: 1.0, unsure: 1.3 },
};

export function reaction(price: number, market: number, sensitivity: Sensitivity = 'normal'): Reaction {
  const ratio = price / market;
  const b = BANDS[sensitivity];
  if (ratio < b.delighted) return 'delighted';
  if (ratio <= b.happy) return 'happy';
  if (ratio <= b.unsure) return 'unsure';
  return 'angry';
}

export interface VisitOutcome {
  reaction: Reaction;
  bought: number;
  revenue: number;
  amanahDelta: number;
  walkedOff: boolean;
}

/** Resolves one customer looking at one shelf. */
export function visit(rng: Rng, price: number, market: number, stock: number, sensitivity: Sensitivity = 'normal'): VisitOutcome {
  const r = reaction(price, market, sensitivity);
  let want = 0;
  if (r === 'delighted') want = rng.chance(0.5) ? 2 : 1; // "buys at once, sometimes two"
  else if (r === 'happy') want = 1;
  else if (r === 'unsure') want = rng.chance(0.5) ? 1 : 0;
  const bought = Math.min(want, stock);
  let amanahDelta = 0;
  if (bought > 0 && r === 'happy') amanahDelta = bought; // +1 per sale
  if (bought > 0 && r === 'unsure') amanahDelta = -2 * bought; // -2 per sale
  if (r === 'angry') amanahDelta = -5;
  return { reaction: r, bought, revenue: bought * price, amanahDelta, walkedOff: bought === 0 };
}

export function clampAmanah(value: number): number {
  return Math.max(AMANAH_MIN, Math.min(AMANAH_MAX, value));
}

export interface AmanahEffect {
  extraCustomers: number;
  regularCustomer: boolean;
  inspectorVisits: boolean;
}

// gdd 4.6
export function amanahEffect(amanah: number): AmanahEffect {
  if (amanah >= 80) return { extraCustomers: 2, regularCustomer: true, inspectorVisits: false };
  if (amanah >= 60) return { extraCustomers: 0, regularCustomer: false, inspectorVisits: false };
  if (amanah >= 40) return { extraCustomers: -1, regularCustomer: false, inspectorVisits: false };
  return { extraCustomers: 0, regularCustomer: false, inspectorVisits: true };
}
