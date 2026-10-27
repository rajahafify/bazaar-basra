// Game data from docs/gdd.md. Every number here has a section reference so balance
// changes stay traceable to the design doc. Money is in dirham.

export type Week = 1 | 2 | 3 | 4;
export const WEEKS: readonly Week[] = [1, 2, 3, 4];

export type GoodId = 'dates' | 'pottery' | 'straw' | 'cloth' | 'spices' | 'leather';
export type SourceId = 'groves' | 'port' | 'bedouin';
export type CartId = 'handcart' | 'donkey' | 'camels';
export type StallId = 'small' | 'medium' | 'big';

export interface Good {
  id: GoodId;
  /** Footprint in cells, width x height, before rotation (gdd 3.4). */
  shape: readonly [number, number];
  source: SourceId;
  /** Buy price at the source by week (gdd 3.4, 7). */
  buy: Readonly<Record<Week, number>>;
  /** Market (base sell) price by week, or null for goods never sold at the stall (gdd 9.2). */
  market: Readonly<Record<Week, number>> | null;
  /** Protects a touching jar from breaking (gdd 3.4 packing rules). */
  padding: boolean;
  /** Shop days after purchase before it spoils, or null if it keeps (gdd 4.7). */
  spoilsAfterDays: number | null;
  /** First week the good can be bought (leather is week 3 only, gdd 3.2). */
  availableWeeks: readonly Week[];
}

const every = (n: number): Record<Week, number> => ({ 1: n, 2: n, 3: n, 4: n });

export const GOODS: Readonly<Record<GoodId, Good>> = {
  dates: {
    id: 'dates', shape: [1, 2], source: 'groves', buy: every(6),
    market: { 1: 10, 2: 10, 3: 10, 4: 11 }, padding: false, spoilsAfterDays: 5, availableWeeks: WEEKS,
  },
  pottery: {
    id: 'pottery', shape: [2, 2], source: 'groves', buy: every(8),
    market: { 1: 15, 2: 15, 3: 16, 4: 15 }, padding: false, spoilsAfterDays: null, availableWeeks: WEEKS,
  },
  straw: {
    id: 'straw', shape: [1, 1], source: 'groves', buy: every(1),
    market: null, padding: true, spoilsAfterDays: null, availableWeeks: WEEKS,
  },
  cloth: {
    id: 'cloth', shape: [1, 3], source: 'port', buy: every(20),
    market: { 1: 32, 2: 30, 3: 32, 4: 40 }, padding: true, spoilsAfterDays: null, availableWeeks: WEEKS,
  },
  spices: {
    id: 'spices', shape: [1, 1], source: 'port', buy: { 1: 30, 2: 21, 3: 30, 4: 30 },
    market: { 1: 50, 2: 42, 3: 50, 4: 50 }, padding: false, spoilsAfterDays: null, availableWeeks: WEEKS,
  },
  leather: {
    // Week 3 only at the camp; still sells in week 4 (gdd 9.2).
    id: 'leather', shape: [2, 1], source: 'bedouin', buy: every(12),
    market: { 1: 20, 2: 20, 3: 20, 4: 20 }, padding: false, spoilsAfterDays: null, availableWeeks: [3],
  },
};

/** Chance an unpadded jar breaks on the ride home (gdd 3.4). */
export const JAR_BREAK_CHANCE = 0.25;

/** Dates market price on week 3 day 2, when the caravan is late (gdd 7, 9.2). */
export const CARAVAN_LATE_DATES_PRICE = 16;

export interface Source {
  id: SourceId;
  openWeeks: readonly Week[];
}

export const SOURCES: Readonly<Record<SourceId, Source>> = {
  groves: { id: 'groves', openWeeks: WEEKS },
  port: { id: 'port', openWeeks: WEEKS },
  bedouin: { id: 'bedouin', openWeeks: [3] },
};

export interface Cart {
  id: CartId;
  cols: number;
  rows: number;
  hire: number;
}

// gdd 3.3
export const CARTS: Readonly<Record<CartId, Cart>> = {
  handcart: { id: 'handcart', cols: 4, rows: 3, hire: 6 },
  donkey: { id: 'donkey', cols: 5, rows: 4, hire: 12 },
  camels: { id: 'camels', cols: 6, rows: 5, hire: 20 },
};

export interface Stall {
  id: StallId;
  shelves: number;
  rent: number;
  /** Customers per day before the amanah modifier, inclusive range. */
  customers: readonly [number, number];
  fromWeek: Week;
}

// gdd 4.1
export const STALLS: Readonly<Record<StallId, Stall>> = {
  small: { id: 'small', shelves: 2, rent: 10, customers: [6, 8], fromWeek: 1 },
  medium: { id: 'medium', shelves: 3, rent: 25, customers: [8, 10], fromWeek: 2 },
  big: { id: 'big', shelves: 4, rent: 45, customers: [10, 13], fromWeek: 4 },
};

// gdd 2.3, 4.6, 6.2
export const NISAB = 200;
export const ZAKAT_RATE = 1 / 40;
export const OPENING_CASH = 160;
export const OPENING_AMANAH = 60;
export const AMANAH_MIN = 0;
export const AMANAH_MAX = 100;
export const SHOP_DAYS_PER_WEEK = 5;
export const DAY_SECONDS = 45;

export function marketPrice(good: GoodId, week: Week): number {
  const m = GOODS[good].market;
  if (!m) throw new Error(`${good} is not sold at the stall`);
  return m[week];
}
