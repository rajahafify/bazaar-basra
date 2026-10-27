// Game data for the sell-or-explore loop (docs: "Pasar Basra: loop redesign plan").
// Money is in dirham. Balance numbers live here so tuning stays in one place.

export type Season = 1 | 2 | 3 | 4;
export const SEASONS: readonly Season[] = [1, 2, 3, 4];
export const WEEKS_PER_SEASON = 4;
/** Days of the week from Saturday (0) to Friday (6). Friday the market is closed. */
export const FRIDAY = 6;

export type GoodId = 'dates' | 'salt' | 'fish' | 'vinegar' | 'beef' | 'cardamom' | 'saffron';
export const GOOD_IDS: readonly GoodId[] = ['dates', 'salt', 'fish', 'vinegar', 'beef', 'cardamom', 'saffron'];

export interface Good {
  id: GoodId;
  /** The fair price in Basra before season and demand changes. Customers judge against this. */
  fair: number;
  /** Caravan space one unit takes. */
  space: number;
  /** Demand by season, as a multiplier on the fair price. */
  season: Readonly<Record<Season, number>>;
}

const flat: Record<Season, number> = { 1: 1, 2: 1, 3: 1, 4: 1 };

export const GOODS: Readonly<Record<GoodId, Good>> = {
  dates: { id: 'dates', fair: 6, space: 1, season: { 1: 1, 2: 1, 3: 0.85, 4: 1.15 } },
  salt: { id: 'salt', fair: 5, space: 1, season: { 1: 1, 2: 1.2, 3: 1, 4: 0.9 } },
  fish: { id: 'fish', fair: 9, space: 1, season: { 1: 1, 2: 0.9, 3: 1, 4: 1.15 } },
  vinegar: { id: 'vinegar', fair: 11, space: 2, season: { 1: 1.1, 2: 1, 3: 1, 4: 0.95 } },
  beef: { id: 'beef', fair: 16, space: 2, season: { 1: 0.95, 2: 1, 3: 1.05, 4: 1.2 } },
  cardamom: { id: 'cardamom', fair: 30, space: 1, season: flat },
  saffron: { id: 'saffron', fair: 48, space: 1, season: { 1: 1, 2: 1, 3: 1.1, 4: 1.15 } },
};

export type TownId = 'groves' | 'ubulla' | 'kufa' | 'madain';
export const TOWN_IDS: readonly TownId[] = ['groves', 'ubulla', 'kufa', 'madain'];

export interface Town {
  id: TownId;
  /** Event stops each way. Each stop takes half a day. */
  stops: number;
  /** First season the route is open. */
  opens: Season;
  /** What the town sells and for how much, before the week's swing. */
  sells: ReadonlyArray<{ good: GoodId; price: number; rare?: boolean }>;
}

export const TOWNS: Readonly<Record<TownId, Town>> = {
  groves: { id: 'groves', stops: 2, opens: 1, sells: [{ good: 'dates', price: 3 }] },
  ubulla: { id: 'ubulla', stops: 2, opens: 1, sells: [{ good: 'fish', price: 5 }, { good: 'salt', price: 2 }, { good: 'cardamom', price: 17, rare: true }] },
  kufa: { id: 'kufa', stops: 3, opens: 2, sells: [{ good: 'beef', price: 9 }, { good: 'vinegar', price: 6 }] },
  madain: { id: 'madain', stops: 3, opens: 3, sells: [{ good: 'saffron', price: 28 }] },
};

/** Chance a rare good is on sale on a given visit. */
export const RARE_CHANCE = 0.5;

export const SUPPLY_PRICE = 2;
export const TOWN_SUPPLY_PRICE = 3;

// ---------- the stall and the caravan ----------

export type UpgradeId = 'shelf' | 'camel' | 'skins' | 'guide' | 'boy';

export interface Upgrade {
  id: UpgradeId;
  /** Price of each level in turn. */
  costs: readonly number[];
}

export const UPGRADES: Readonly<Record<UpgradeId, Upgrade>> = {
  shelf: { id: 'shelf', costs: [60, 120, 200] },
  camel: { id: 'camel', costs: [70, 140, 220] },
  skins: { id: 'skins', costs: [40] },
  guide: { id: 'guide', costs: [90] },
  boy: { id: 'boy', costs: [150] },
};

export const BASE_SLOTS = 3;
export const BASE_SPACE = 12;
export const SPACE_PER_CAMEL = 8;
export const BASE_SUPPLY_CAP = 6;
export const SKINS_SUPPLY_CAP = 10;
/** Most units one shelf slot holds at a time. */
export const SLOT_STACK = 5;

/** Weekly rent, by how many extra shelves the stall has. */
export const RENT = [15, 20, 26, 33] as const;

// ---------- customers ----------

export const DAY_SECONDS = 40;
export const BASE_CUSTOMERS = 8;
export const CUSTOMERS_PER_SHELF = 2;

// ---------- the year ----------

export const OPENING_CASH = 70;
export const OPENING_AMANAH = 50;
export const AMANAH_MIN = 0;
export const AMANAH_MAX = 100;
export const NISAB = 200;
export const ZAKAT_RATE = 1 / 40;
/** One fifth of buried treasure is due at once (rikaz). */
export const RIKAZ_RATE = 1 / 5;

/** Fair price of a good this season, before the week's demand. */
export function seasonPrice(good: GoodId, season: Season): number {
  return GOODS[good].fair * GOODS[good].season[season];
}
