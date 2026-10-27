// The 33 events of the road. Each has two or three choices; each choice changes money, supplies,
// cargo, time or amanah, and some set up something for a later day. The text lives in the
// language files under events.<id>; the lesson line under events.<id>.lesson.

import { GOODS, RIKAZ_RATE, TOWNS, TOWN_IDS, seasonPrice, type GoodId, type Season } from './data';
import {
  LAST_FRIDAY, caravanSpace, canOfferQuest, dayIndex, questDue, type Debt, type GameState, type Order, type Pending,
} from './game';
import type { Trip } from './expedition';
import type { Rng } from './rng';

export type NodeKind = 'road' | 'trader' | 'people' | 'find';

export interface EventCtx {
  s: GameState;
  trip: Trip;
  rng: Rng;
  /** Picks which outcome text to show. */
  say(text: string, vars?: Record<string, string | number>): void;
  cash(n: number): void;
  supplies(n: number): void;
  amanah(n: number): void;
  /** Extra half days on the road. */
  time(halfDays: number): void;
  addCargo(good: GoodId, qty: number, unitCost: number): number;
  removeCargo(good: GoodId, qty: number): number;
  loseRandom(units: number): number;
  helped(): void;
  later(p: Pending): void;
  today(): number;
  /** Numbers rolled when the stop was reached, shown in the event's text. */
  vars: Record<string, string | number>;
  /** Takes on a delivery order: a side quest due on the first Friday a week or more away. */
  order(o: Omit<Order, 'due'>): void;
  /** Takes on a debt, due on the first Friday at least this many days away. */
  debt(who: Debt['who'], amount: number, days: number): void;
}

export interface EventOption {
  id: string;
  /** A string key saying why it can't be chosen, or null. */
  need?: (s: GameState, t: Trip) => string | null;
  resolve: (c: EventCtx) => void;
}

export interface EventDef {
  id: string;
  kind: NodeKind;
  minSeason?: Season;
  /** Whether the event can happen now. */
  when?: (s: GameState, t: Trip) => boolean;
  /** Rolls the numbers the event's text shows, once, when the stop is reached. */
  setup?: (s: GameState, rng: Rng) => Record<string, string | number>;
  options: EventOption[];
}

// ---------- needs ----------

const needCash = (n: number) => (s: GameState) => (s.cash >= n ? null : 'needCash');
const needSupplies = (n: number) => (s: GameState) => (s.supplies >= n ? null : 'needSupplies');
const FOOD: readonly GoodId[] = ['dates', 'fish', 'beef'];
const foodIn = (t: Trip) => FOOD.filter(g => t.cargo[g].qty > 0);
const needFood = (n: number) => (_: GameState, t: Trip) => (FOOD.reduce((a, g) => a + t.cargo[g].qty, 0) >= n ? null : 'needGood');
const needSpace = (n: number) => (s: GameState, t: Trip) => {
  const used = Object.entries(t.cargo).reduce((a, [g, c]) => a + c.qty * GOODS[g as GoodId].space, 0) + t.held;
  return caravanSpace(s) - used >= n ? null : 'needSpace';
};
const both = (...fs: Array<(s: GameState, t: Trip) => string | null>) => (s: GameState, t: Trip) => {
  for (const f of fs) { const r = f(s, t); if (r) return r; }
  return null;
};

/** Take n units of food from the cargo, any kind. */
function giveFood(c: EventCtx, n: number) {
  let left = n;
  for (const g of foodIn(c.trip)) { if (left <= 0) break; left -= c.removeCargo(g, left); }
}

const fair = (s: GameState, g: GoodId) => Math.round(seasonPrice(g, s.season));
const WEEK = 7;

/** Days until a new side quest would be due. */
const questDays = (s: GameState) => (questDue(s) ?? LAST_FRIDAY) - dayIndex(s);

/** Goods sold in the towns open this season, rare ones included. */
function openGoods(s: GameState): GoodId[] {
  const out = new Set<GoodId>();
  for (const id of TOWN_IDS) if (s.season >= TOWNS[id].opens) for (const x of TOWNS[id].sells) out.add(x.good);
  return [...out];
}

/** An order for a good from the open towns, priced above fair so it is worth the trip. */
function rollOrder(s: GameState, rng: Rng, pool: readonly GoodId[], markup: number) {
  const open = openGoods(s);
  const goods = pool.filter(g => open.includes(g));
  const good = rng.pick(goods.length ? goods : open);
  const dear = GOODS[good].fair >= 30;
  const qty = dear ? rng.int(2, 3) : rng.int(4, 7);
  return { good, qty, price: Math.round(fair(s, good) * markup), days: questDays(s) };
}

// ---------- the events ----------

export const EVENTS: readonly EventDef[] = [
  // On the road: risk and trust.
  {
    id: 'sandstorm', kind: 'road',
    options: [
      { id: 'a', need: needSupplies(1), resolve: c => { c.supplies(-1); } },
      { id: 'b', resolve: c => { if (c.rng.chance(0.5)) { const n = c.loseRandom(2); c.say(n ? 'bLost' : 'bLucky'); } else c.say('bLucky'); } },
    ],
  },
  {
    id: 'lameCamel', kind: 'road',
    options: [
      { id: 'a', resolve: c => { c.time(1); } },
      { id: 'b', need: (_, t) => (Object.values(t.cargo).some(x => x.qty > 0) ? null : 'needGood'), resolve: c => { c.loseRandom(2); } },
      { id: 'c', resolve: c => { c.trip.flags.double = 1; c.amanah(-2); } },
    ],
  },
  {
    id: 'bandits', kind: 'road',
    options: [
      { id: 'a', need: needCash(4), resolve: c => { c.cash(-4); c.time(1); } },
      { id: 'b', need: needSupplies(1), resolve: c => { c.supplies(-1); } },
      { id: 'c', resolve: c => {
        if (c.rng.chance(0.4)) {
          const n = c.loseRandom(3);
          if (!n) { const take = Math.min(10, c.s.cash); c.cash(-take); }
          c.say('cRobbed');
        } else c.say('cSafe');
      } },
    ],
  },
  {
    id: 'caravanPot', kind: 'road',
    when: (_, t) => !t.flags.pot,
    options: [
      { id: 'a', need: needCash(2), resolve: c => { c.cash(-2); c.trip.flags.pot = 1; } },
      { id: 'b', resolve: () => {} },
    ],
  },
  {
    id: 'bedouinCamp', kind: 'road',
    options: [
      { id: 'a', resolve: c => { c.time(1); c.supplies(2); c.trip.flags.reveal = 1; c.amanah(1); } },
      { id: 'b', resolve: () => {} },
    ],
  },

  // With traders: fair dealing.
  {
    id: 'dampSalt', kind: 'trader',
    options: [
      { id: 'a', need: both(needCash(8), needSpace(4)), resolve: c => { c.time(1); c.cash(-8); c.addCargo('salt', 4, 2); } },
      { id: 'b', need: both(needCash(6), needSpace(3)), resolve: c => { c.cash(-6); c.addCargo('salt', 3, 2); c.say('b', { n: 3 }); } },
      { id: 'c', resolve: () => {} },
    ],
  },
  {
    id: 'badFish', kind: 'trader',
    when: (_, t) => t.cargo.fish.qty >= 2,
    options: [
      { id: 'a', resolve: c => { c.removeCargo('fish', 2); c.cash(8); c.amanah(3); } },
      { id: 'b', resolve: c => { c.amanah(-5); c.later({ day: c.today() + 3, kind: 'claim', key: 'notice.badFish', cash: -6, amanah: -3 }); } },
    ],
  },
  {
    id: 'droughtTown', kind: 'trader',
    when: (_, t) => FOOD.reduce((a, g) => a + t.cargo[g].qty, 0) >= 3,
    options: [
      { id: 'a', resolve: c => {
        const g = foodIn(c.trip)[0]!;
        const n = c.removeCargo(g, 3);
        c.cash(n * fair(c.s, g)); c.amanah(5); c.helped();
        c.later({ day: c.today() + 3, kind: 'regular', key: 'notice.drought' });
      } },
      { id: 'b', resolve: c => {
        const g = foodIn(c.trip)[0]!;
        const n = c.removeCargo(g, 3);
        c.cash(n * fair(c.s, g) * 3); c.amanah(-8);
      } },
    ],
  },
  {
    id: 'cornerSalt', kind: 'trader',
    options: [
      { id: 'a', need: needCash(20), resolve: c => { c.cash(-20); c.amanah(-10); c.later({ day: c.today() + WEEK, kind: 'gift', key: 'notice.corner', cash: 30 }); } },
      { id: 'b', resolve: c => { c.amanah(2); } },
    ],
  },
  {
    id: 'fakeBidder', kind: 'trader',
    options: [
      { id: 'a', need: needCash(3), resolve: c => { c.cash(-3); c.amanah(-8); for (const g of Object.keys(c.s.demand) as GoodId[]) c.s.demand[g] += 0.15; } },
      { id: 'b', resolve: c => { c.amanah(2); } },
    ],
  },
  {
    id: 'nextNet', kind: 'trader',
    options: [
      { id: 'a', need: needCash(10), resolve: c => {
        c.cash(-10);
        const n = c.rng.int(0, 6);
        c.addCargo('fish', n, n ? 10 / n : 0);
        c.say(n >= 3 ? 'aGood' : 'aBad', { n });
      } },
      { id: 'b', need: both(needCash(12), needSpace(3)), resolve: c => { c.cash(-12); c.addCargo('fish', 3, 4); } },
      { id: 'c', resolve: () => {} },
    ],
  },
  {
    id: 'salam', kind: 'trader',
    options: [
      { id: 'a', need: needCash(15), resolve: c => { c.cash(-15); c.later({ day: c.today() + 2 * WEEK, kind: 'salam', key: 'notice.salam', good: 'dates', qty: 8 }); } },
      { id: 'b', resolve: () => {} },
    ],
  },
  {
    id: 'moneylender', kind: 'trader',
    when: s => canOfferQuest(s) && !s.debts.some(d => d.who === 'lender'),
    options: [
      { id: 'a', resolve: c => { c.cash(50); c.amanah(-5); c.debt('lender', 60, 2 * WEEK); } },
      { id: 'b', resolve: c => { c.amanah(1); } },
    ],
  },
  {
    id: 'friendlyLoan', kind: 'trader',
    when: s => canOfferQuest(s) && !s.debts.some(d => d.who === 'friend'),
    options: [
      { id: 'a', resolve: c => { c.cash(40); c.amanah(1); c.debt('friend', 40, 2 * WEEK); } },
      { id: 'b', resolve: c => {
        c.cash(40);
        const disputed = c.rng.chance(0.5);
        c.debt('friend', disputed ? 55 : 40, 2 * WEEK);
        if (disputed) c.later({ day: c.today() + 2 * WEEK - 1, kind: 'claim', key: 'notice.loanDispute' });
      } },
      { id: 'c', resolve: () => {} },
    ],
  },
  {
    id: 'widow', kind: 'trader',
    when: s => !s.mudarabah,
    options: [
      { id: 'a', resolve: c => {
        c.cash(60);
        // Her share is measured from now, with her money in hand.
        const s = c.s;
        const stock = Object.values(s.store).reduce((a, x) => a + x.cost, 0) + s.slots.reduce((a, x) => a + x.cost, 0);
        s.mudarabah = { capital: 60, worthAtStart: s.cash + stock, due: c.today() + WEEK };
      } },
      { id: 'b', resolve: () => {} },
    ],
  },
  {
    id: 'datesForDates', kind: 'trader',
    when: (_, t) => t.cargo.dates.qty >= 1,
    options: [
      { id: 'a', need: needSpace(1), resolve: c => { c.removeCargo('dates', 1); c.addCargo('dates', 2, 2); c.amanah(-4); } },
      { id: 'b', need: needSpace(1), resolve: c => { c.removeCargo('dates', 1); c.addCargo('dates', 2, 2); c.amanah(1); } },
      { id: 'c', resolve: () => {} },
    ],
  },
  {
    id: 'shortMeasure', kind: 'trader',
    options: [
      { id: 'a', resolve: c => { c.amanah(5); c.helped(); } },
      { id: 'b', resolve: c => { c.amanah(-2); } },
    ],
  },
  {
    id: 'bigOrder', kind: 'trader',
    when: s => canOfferQuest(s) && !s.orders.some(o => o.from === 'cook'),
    setup: s => ({ qty: 6, price: fair(s, 'salt') + 2, days: questDays(s) }),
    options: [
      { id: 'a', resolve: c => { c.order({ from: 'cook', good: 'salt', qty: 6, price: Number(c.vars.price), written: true, amanah: 2 }); } },
      { id: 'b', resolve: c => { c.order({ from: 'cook', good: 'salt', qty: 6, price: Number(c.vars.price), written: false, amanah: 2 }); } },
      { id: 'c', resolve: () => {} },
    ],
  },
  {
    id: 'purser', kind: 'trader',
    when: s => canOfferQuest(s) && !s.orders.some(o => o.from === 'purser'),
    setup: (s, rng) => rollOrder(s, rng, ['fish', 'salt', 'vinegar', 'beef', 'dates'], 1.35),
    options: [
      { id: 'a', resolve: c => { c.order({ from: 'purser', good: c.vars.good as GoodId, qty: Number(c.vars.qty), price: Number(c.vars.price), written: true, amanah: 2 }); } },
      { id: 'b', resolve: () => {} },
    ],
  },
  {
    id: 'caravanMaster', kind: 'trader', minSeason: 2,
    when: s => canOfferQuest(s) && !s.orders.some(o => o.from === 'caravan'),
    setup: (s, rng) => rollOrder(s, rng, ['vinegar', 'beef', 'cardamom', 'saffron'], 1.3),
    options: [
      { id: 'a', resolve: c => { c.order({ from: 'caravan', good: c.vars.good as GoodId, qty: Number(c.vars.qty), price: Number(c.vars.price), written: true, amanah: 2 }); } },
      { id: 'b', resolve: () => {} },
    ],
  },

  {
    id: 'mosqueKitchen', kind: 'people',
    when: s => canOfferQuest(s) && !s.orders.some(o => o.from === 'imam'),
    setup: (s, rng) => ({ qty: rng.int(4, 6), price: fair(s, 'dates'), days: questDays(s) }),
    options: [
      { id: 'a', resolve: c => { c.order({ from: 'imam', good: 'dates', qty: Number(c.vars.qty), price: Number(c.vars.price), written: true, amanah: 4, helps: true }); } },
      { id: 'b', resolve: () => {} },
    ],
  },

  // People in need: the eight asnaf.
  {
    id: 'hungryFamily', kind: 'people',
    options: [
      { id: 'a', need: needFood(2), resolve: c => { giveFood(c, 2); c.amanah(4); c.helped(); } },
      { id: 'b', need: needCash(5), resolve: c => { c.cash(-5); c.amanah(4); c.helped(); } },
      { id: 'c', resolve: () => {} },
    ],
  },
  {
    id: 'potter', kind: 'people',
    options: [
      { id: 'a', need: needCash(8), resolve: c => { c.cash(-8); c.amanah(3); c.helped(); c.later({ day: c.today() + 5, kind: 'gift', key: 'notice.potter', cash: 6 }); } },
      { id: 'b', need: needCash(4), resolve: c => { c.cash(-4); c.amanah(3); c.helped(); } },
      { id: 'c', resolve: () => {} },
    ],
  },
  {
    id: 'zakatCollector', kind: 'people',
    options: [
      { id: 'a', resolve: c => { c.time(1); c.amanah(1); c.s.flags.zakatPage = 1; } },
      { id: 'b', resolve: () => {} },
    ],
  },
  {
    id: 'newMuslim', kind: 'people',
    options: [
      { id: 'a', need: needSupplies(1), resolve: c => { c.supplies(-1); c.amanah(3); c.helped(); c.later({ day: c.today() + WEEK, kind: 'regular', key: 'notice.newMuslim' }); } },
      { id: 'b', resolve: () => {} },
    ],
  },
  {
    id: 'freedom', kind: 'people',
    options: [
      { id: 'a', need: needCash(20), resolve: c => { c.cash(-20); c.amanah(6); c.helped(); } },
      { id: 'b', resolve: () => {} },
    ],
  },
  {
    id: 'debtor', kind: 'people',
    when: s => s.owed.length > 0,
    options: [
      { id: 'a', resolve: c => { const o = c.s.owed[0]!; c.amanah(2); c.helped(); c.later({ day: c.today() + 2 * WEEK, kind: 'gift', key: 'notice.debtorPays', cash: o.amount }); c.s.owed = []; } },
      { id: 'b', resolve: c => { const o = c.s.owed[0]!; c.amanah(5); c.helped(); c.later({ day: c.today() + 2 * WEEK, kind: 'gift', key: 'notice.debtorPays', cash: o.amount / 2 }); c.s.owed = []; } },
      { id: 'c', resolve: c => { const o = c.s.owed[0]!; c.cash(o.amount); c.amanah(-6); c.s.owed = []; } },
    ],
  },
  {
    id: 'teacher', kind: 'people',
    options: [
      { id: 'a', resolve: c => { c.time(1); c.amanah(4); c.helped(); c.later({ day: c.today() + 2 * WEEK, kind: 'regular', key: 'notice.teacher', cash: 10 }); } },
      { id: 'b', resolve: () => {} },
    ],
  },
  {
    id: 'traveller', kind: 'people',
    options: [
      { id: 'a', need: needSupplies(1), resolve: c => { c.supplies(-1); c.amanah(4); c.helped(); c.later({ day: c.today() + 10, kind: 'gift', key: 'notice.traveller', cash: 12 }); } },
      { id: 'b', resolve: () => {} },
    ],
  },

  // Honesty, finds and news.
  {
    id: 'lostPurse', kind: 'find',
    options: [
      { id: 'a', resolve: c => { c.time(1); c.amanah(6); if (c.rng.chance(0.5)) { c.cash(5); c.say('aReward'); } } },
      { id: 'b', resolve: c => { c.cash(15); c.amanah(-8); } },
    ],
  },
  {
    id: 'carryForBrother', kind: 'find',
    when: (_, t) => t.leg === 'back' && !t.flags.carrying,
    options: [
      { id: 'a', need: needSpace(2), resolve: c => { c.trip.held += 2; c.trip.flags.carrying = 1; } },
      { id: 'b', resolve: () => {} },
    ],
  },
  {
    id: 'rumour', kind: 'find',
    options: [
      { id: 'a', resolve: c => {
        const g = rumourGood(c);
        const truth = c.rng.chance(0.4);
        if (truth) c.s.flags[`boom_${g}`] = c.today() + WEEK;
        c.say('a', { good: g });
      } },
      { id: 'b', resolve: c => {
        c.time(1);
        const g = rumourGood(c);
        const truth = c.rng.chance(0.4);
        if (truth) c.s.flags[`boom_${g}`] = c.today() + WEEK;
        c.say(truth ? 'bTrue' : 'bFalse', { good: g });
      } },
    ],
  },
  {
    id: 'buriedCoins', kind: 'find',
    options: [
      { id: 'a', resolve: c => { const n = c.rng.int(25, 50); const fifth = Math.round(n * RIKAZ_RATE); c.cash(n - fifth); c.s.rikazPaid += fifth; c.amanah(3); c.say('a', { n, fifth }); } },
      { id: 'b', resolve: c => { const n = c.rng.int(25, 50); c.cash(n); c.amanah(-6); c.say('b', { n }); } },
    ],
  },
];

function rumourGood(c: EventCtx): GoodId {
  // The same good for both choices on one stop.
  const key = 'rumourGood';
  const known: GoodId[] = ['dates', 'salt', 'fish', 'vinegar', 'beef', 'saffron'];
  if (c.trip.flags[key] === undefined) c.trip.flags[key] = c.rng.int(0, known.length - 1);
  return known[c.trip.flags[key]!]!;
}


const BY_ID = new Map(EVENTS.map(e => [e.id, e]));

export function eventById(id: string): EventDef {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`no event ${id}`);
  return e;
}
