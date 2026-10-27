// The whole year as one serialisable state plus the actions that move it forward.
// Screens call these actions; nothing here touches the browser or three.js.

import {
  BASE_CUSTOMERS, BASE_SLOTS, BASE_SPACE, BASE_SUPPLY_CAP, CUSTOMERS_PER_SHELF, FRIDAY, GOODS, GOOD_IDS, NISAB,
  OPENING_AMANAH, OPENING_CASH, RENT, SKINS_SUPPLY_CAP, SLOT_STACK, SPACE_PER_CAMEL, UPGRADES, WEEKS_PER_SEASON,
  seasonPrice, type GoodId, type Season, type UpgradeId,
} from './data';
import { amanahCustomers, clampAmanah, type Reaction } from './customers';
import { zakatCount, type ZakatResult } from './ledger';
import { createRng, type Rng } from './rng';
import type { Trip } from './expedition';

export const SAVE_VERSION = 3;

export type Phase =
  | 'prologue'
  | 'morning'   // at the stall: open the shop or set out
  | 'shop'      // a market day
  | 'trip'      // on an expedition
  | 'friday'    // rest day: ledger, rent, upgrades
  | 'broke'     // could not pay rent
  | 'yearEnd'   // the bayt al-mal
  | 'done';

export interface Stock {
  qty: number;
  /** Total cost paid for these units, so the average cost is cost / qty. */
  cost: number;
}

export interface Slot {
  good: GoodId | null;
  qty: number;
  /** Cost of the units on the slot. */
  cost: number;
}

export interface Debt {
  who: 'lender' | 'friend' | 'widow';
  amount: number;
  /** Day index it is due on (paid on that week's Friday). */
  due: number;
}

export interface Owed {
  who: 'merchant';
  amount: number;
}

/** Who placed a delivery order: a side quest from an event on the road. */
export type OrderFrom = 'cook' | 'imam' | 'purser' | 'caravan';

export interface Order {
  from: OrderFrom;
  good: GoodId;
  qty: number;
  /** Paid per unit on delivery. */
  price: number;
  /** Day index of the Friday it is due. It can be delivered any morning before. */
  due: number;
  written: boolean;
  /** Amanah gained when delivered, and lost when missed. */
  amanah: number;
  /** Delivering it counts as helping someone. */
  helps?: boolean;
}

/** Something that happens on a later morning because of a choice on the road. */
export interface Pending {
  day: number;
  kind: 'gift' | 'salam' | 'regular' | 'claim';
  key: string;
  cash?: number;
  good?: GoodId;
  qty?: number;
  amanah?: number;
}

export interface Mudarabah {
  capital: number;
  worthAtStart: number;
  due: number;
}

export interface Counters {
  sold: number;
  trips: number;
  upgrades: number;
  helped: number;
  revenue: number;
}

export interface WeekStats {
  revenue: number;
  costOfSold: number;
  goodsBought: number;
  supplies: number;
  other: number;
  amanahStart: number;
}

export interface DayStats {
  sold: number;
  revenue: number;
  walked: number;
  wanted: number;
  amanahStart: number;
}

export interface Notice {
  key: string;
  vars?: Record<string, string | number>;
}

export interface GameState {
  version: number;
  rng: number;
  phase: Phase;
  season: Season;
  week: number;
  /** Saturday 0 to Friday 6. */
  dow: number;
  cash: number;
  amanah: number;
  store: Record<GoodId, Stock>;
  slots: Slot[];
  prices: Record<GoodId, number>;
  /** Price to the reaction last seen at that price, per good. */
  notebook: Record<GoodId, Record<string, Reaction>>;
  /** Demand multiplier per good, drifts back to 1. */
  demand: Record<GoodId, number>;
  /** Customers who asked for a good you did not have, this week. */
  wanted: Record<GoodId, number>;
  upgrades: Record<UpgradeId, number>;
  upgradesSpent: number;
  supplies: number;
  trip: Trip | null;
  debts: Debt[];
  owed: Owed[];
  orders: Order[];
  pending: Pending[];
  mudarabah: Mudarabah | null;
  regulars: number;
  counters: Counters;
  week_: WeekStats;
  day: DayStats;
  /** What happened overnight or on the road, shown on the next morning. */
  notices: Notice[];
  eventsSeen: Record<string, number>;
  flags: Record<string, number>;
  /** The state at the start of this season, to try again after going broke. */
  seasonSave: string | null;
  yearEnd: { result: ZakatResult; paid: number; sadaqah: number; rikaz: number } | null;
  rikazPaid: number;
  openingWorth: number;
  minutesStart: number;
}

// ---------- setup ----------

function goodsRecord<T>(f: (g: GoodId) => T): Record<GoodId, T> {
  return Object.fromEntries(GOOD_IDS.map(g => [g, f(g)])) as Record<GoodId, T>;
}

export function newGame(seed: number, nowMs = 0): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    rng: seed >>> 0,
    phase: 'prologue',
    season: 1,
    week: 1,
    dow: 0,
    cash: OPENING_CASH,
    amanah: OPENING_AMANAH,
    store: goodsRecord(() => ({ qty: 0, cost: 0 })),
    slots: [],
    prices: goodsRecord(g => Math.round(GOODS[g].fair * 1.15)),
    notebook: goodsRecord(() => ({})),
    demand: goodsRecord(() => 1),
    wanted: goodsRecord(() => 0),
    upgrades: { shelf: 0, camel: 0, skins: 0, guide: 0, boy: 0 },
    upgradesSpent: 0,
    supplies: 0,
    trip: null,
    debts: [],
    owed: [],
    orders: [],
    pending: [],
    mudarabah: null,
    regulars: 0,
    counters: emptyCounters(),
    week_: emptyWeek(OPENING_AMANAH),
    day: emptyDay(OPENING_AMANAH),
    notices: [],
    eventsSeen: {},
    flags: {},
    seasonSave: null,
    yearEnd: null,
    rikazPaid: 0,
    openingWorth: 0,
    minutesStart: nowMs,
  };
  // The uncle leaves some dates and salt in the storeroom.
  addStock(s, 'dates', 6, 3);
  addStock(s, 'salt', 4, 2);
  // A merchant still owes the uncle money.
  s.owed.push({ who: 'merchant', amount: 20 });
  s.slots = Array.from({ length: BASE_SLOTS }, () => ({ good: null, qty: 0, cost: 0 }));
  setSlotGood(s, 0, 'dates');
  setSlotGood(s, 1, 'salt');
  s.openingWorth = netWorth(s);
  return s;
}

function emptyCounters(): Counters {
  return { sold: 0, trips: 0, upgrades: 0, helped: 0, revenue: 0 };
}

function emptyWeek(amanah: number): WeekStats {
  return { revenue: 0, costOfSold: 0, goodsBought: 0, supplies: 0, other: 0, amanahStart: amanah };
}

function emptyDay(amanah: number): DayStats {
  return { sold: 0, revenue: 0, walked: 0, wanted: 0, amanahStart: amanah };
}

export function withRng<T>(s: GameState, f: (rng: Rng) => T): T {
  const rng = createRng(s.rng);
  const out = f(rng);
  s.rng = rng.state();
  return out;
}

export function finishPrologue(s: GameState) {
  s.phase = 'morning';
  saveSeason(s);
}

// ---------- calendar ----------

export function dayIndex(s: GameState): number {
  return ((s.season - 1) * WEEKS_PER_SEASON + (s.week - 1)) * 7 + s.dow;
}

/** Market days left before Friday, counting today. */
export function daysBeforeFriday(s: GameState): number {
  return FRIDAY - s.dow;
}

/** Moves to the next day. Market days lead to the morning, Friday to the rest day. */
export function advanceDay(s: GameState) {
  checkMainQuest(s);
  s.dow += 1;
  overnight(s);
  s.phase = s.dow === FRIDAY ? 'friday' : 'morning';
}

/** Demand drifts back, and anything due today arrives. */
function overnight(s: GameState) {
  for (const g of GOOD_IDS) s.demand[g] = 1 + (s.demand[g] - 1) * 0.7;
  const today = dayIndex(s);
  const due = s.pending.filter(p => p.day <= today);
  s.pending = s.pending.filter(p => p.day > today);
  for (const p of due) {
    if (p.cash) s.cash += p.cash;
    if (p.good && p.qty) addStock(s, p.good, p.qty, 0);
    if (p.amanah) changeAmanah(s, p.amanah);
    if (p.kind === 'regular') s.regulars += 1;
    s.notices.push({ key: p.key, vars: { n: p.cash ?? p.qty ?? 0 } });
  }
}

// ---------- stock ----------

export function addStock(s: GameState, good: GoodId, qty: number, unitCost: number) {
  s.store[good].qty += qty;
  s.store[good].cost += qty * unitCost;
}

/** Takes units out of the storeroom and returns what they cost. */
export function takeStock(s: GameState, good: GoodId, qty: number): number {
  const st = s.store[good];
  const n = Math.min(qty, st.qty);
  if (n <= 0) return 0;
  const cost = st.qty ? (st.cost / st.qty) * n : 0;
  st.qty -= n;
  st.cost -= cost;
  if (st.qty === 0) st.cost = 0;
  return cost;
}

/** Everything you own of a good: storeroom plus shelves. */
export function stockOf(s: GameState, good: GoodId): number {
  return s.store[good].qty + s.slots.reduce((a, sl) => a + (sl.good === good ? sl.qty : 0), 0);
}

export function averageCost(s: GameState, good: GoodId): number | null {
  const st = s.store[good];
  let qty = st.qty, cost = st.cost;
  for (const sl of s.slots) if (sl.good === good) { qty += sl.qty; cost += sl.cost; }
  return qty ? cost / qty : null;
}

export function stockCost(s: GameState): number {
  return GOOD_IDS.reduce((a, g) => a + s.store[g].cost, 0) + s.slots.reduce((a, sl) => a + sl.cost, 0);
}

export function goodsInStore(s: GameState): GoodId[] {
  return GOOD_IDS.filter(g => s.store[g].qty > 0);
}

// ---------- the shop ----------

export function slotCount(s: GameState): number {
  return BASE_SLOTS + s.upgrades.shelf;
}

/** Puts a good on a slot, returning what was there to the storeroom, and fills the slot. */
export function setSlotGood(s: GameState, i: number, good: GoodId | null) {
  const sl = s.slots[i];
  if (!sl) return;
  if (sl.good && sl.qty > 0) { s.store[sl.good].qty += sl.qty; s.store[sl.good].cost += sl.cost; }
  sl.good = good; sl.qty = 0; sl.cost = 0;
  if (good) restockSlot(s, i);
}

/** Tops a slot up from the storeroom. Returns how many units were added. */
export function restockSlot(s: GameState, i: number): number {
  const sl = s.slots[i];
  if (!sl || !sl.good) return 0;
  const n = Math.min(SLOT_STACK - sl.qty, s.store[sl.good].qty);
  if (n <= 0) return 0;
  sl.cost += takeStock(s, sl.good, n);
  sl.qty += n;
  return n;
}

export function setPrice(s: GameState, good: GoodId, price: number) {
  s.prices[good] = Math.max(1, Math.round(price));
}

/** Today's fair price for a good: the season's price times the week's demand. */
export function fairToday(s: GameState, good: GoodId): number {
  return seasonPrice(good, s.season) * s.demand[good] * (s.flags[`boom_${good}`] && s.flags[`boom_${good}`]! >= dayIndex(s) ? 1.5 : 1);
}

export function customersToday(s: GameState): number {
  return BASE_CUSTOMERS + CUSTOMERS_PER_SHELF * s.upgrades.shelf + amanahCustomers(s.amanah) + s.regulars;
}

export function startShopDay(s: GameState) {
  s.phase = 'shop';
  s.day = emptyDay(s.amanah);
}

/** A unit sold from a slot. */
export function recordSale(s: GameState, slot: number, qty: number, price: number) {
  const sl = s.slots[slot];
  if (!sl || !sl.good || qty <= 0) return;
  const n = Math.min(qty, sl.qty);
  const cost = sl.qty ? (sl.cost / sl.qty) * n : 0;
  sl.qty -= n; sl.cost -= cost;
  if (sl.qty === 0) sl.cost = 0;
  const revenue = n * price;
  s.cash += revenue;
  s.week_.revenue += revenue;
  s.week_.costOfSold += cost;
  s.day.sold += n;
  s.day.revenue += revenue;
  s.counters.sold += n;
  s.counters.revenue += revenue;
  s.demand[sl.good] = Math.max(0.75, s.demand[sl.good] - 0.02 * n);
  if (s.upgrades.boy && sl.qty === 0) restockSlot(s, slot);
}

export function noteReaction(s: GameState, good: GoodId, price: number, r: Reaction) {
  s.notebook[good][String(price)] = r;
}

export function noteWanted(s: GameState, good: GoodId) {
  s.wanted[good] += 1;
  s.day.wanted += 1;
  s.demand[good] = Math.min(1.3, s.demand[good] + 0.02);
}

/** What the notebook says about a good: the best price that sold well, and the lowest that put people off. */
export function notebookRange(s: GameState, good: GoodId): { good: number | null; tooHigh: number | null } {
  let best: number | null = null, tooHigh: number | null = null;
  for (const [p, r] of Object.entries(s.notebook[good])) {
    const price = Number(p);
    if ((r === 'happy' || r === 'delighted') && (best === null || price > best)) best = price;
    if ((r === 'unsure' || r === 'angry') && (tooHigh === null || price < tooHigh)) tooHigh = price;
  }
  return { good: best, tooHigh };
}

export function endShopDay(s: GameState) {
  advanceDay(s);
}

export function changeAmanah(s: GameState, delta: number) {
  s.amanah = clampAmanah(s.amanah + delta);
}

// ---------- the caravan ----------

export function caravanSpace(s: GameState): number {
  return BASE_SPACE + SPACE_PER_CAMEL * s.upgrades.camel;
}

export function supplyCap(s: GameState): number {
  return s.upgrades.skins ? SKINS_SUPPLY_CAP : BASE_SUPPLY_CAP;
}

// ---------- Friday ----------

export interface FridayReport {
  rent: number;
  debtsDue: Debt[];
  ordersDue: Order[];
  mudarabah: { capital: number; share: number } | null;
}

export function rentDue(s: GameState): number {
  return RENT[Math.min(s.upgrades.shelf, RENT.length - 1)]!;
}

export function fridayReport(s: GameState): FridayReport {
  const today = dayIndex(s);
  let mud: FridayReport['mudarabah'] = null;
  if (s.mudarabah && s.mudarabah.due <= today) {
    const m = s.mudarabah;
    // Her capital earns what yours earned this week; she takes half the gain, or bears the loss.
    const worth = netWorth(s);
    const rate = m.worthAtStart > 0 ? (worth - m.worthAtStart) / m.worthAtStart : 0;
    const share = rate >= 0 ? m.capital * rate * 0.5 : m.capital * rate;
    mud = { capital: m.capital, share: Math.round(share * 10) / 10 };
  }
  return {
    rent: rentDue(s),
    debtsDue: s.debts.filter(d => d.due <= today),
    ordersDue: s.orders.filter(o => o.due <= today),
    mudarabah: mud,
  };
}

export interface FridayResult {
  broke: boolean;
  rentPaid: number;
  debtsPaid: number;
  debtsLate: number;
  ordersFilled: Array<{ order: Order; result: OrderResult }>;
  mudarabahPaid: number;
  /** Stock sold at half price to the wholesaler to cover rent. */
  wholesale: { units: number; cash: number };
}

/** Sells stock to the wholesaler at half its fair price, cheapest first, until cash reaches the target. */
export function sellToWholesaler(s: GameState, target: number): { units: number; cash: number } {
  const out = { units: 0, cash: 0 };
  const goods = [...GOOD_IDS].sort((a, b) => GOODS[a].fair - GOODS[b].fair);
  for (const g of goods) {
    const each = Math.max(1, Math.floor(seasonPrice(g, s.season) / 2));
    while (s.cash < target && stockOf(s, g) > 0) {
      if (s.store[g].qty > 0) takeStock(s, g, 1);
      else {
        const sl = s.slots.find(x => x.good === g && x.qty > 0)!;
        sl.cost -= sl.cost / sl.qty; sl.qty -= 1;
      }
      s.cash += each;
      out.units += 1; out.cash += each;
    }
  }
  return out;
}

/** Pays rent, debts and partners, and fills orders. Going broke happens here. */
export function settleFriday(s: GameState): FridayResult {
  const r = fridayReport(s);
  const out: FridayResult = { broke: false, rentPaid: 0, debtsPaid: 0, debtsLate: 0, ordersFilled: [], mudarabahPaid: 0, wholesale: { units: 0, cash: 0 } };
  withRng(s, rng => {
    for (const o of r.ordersDue) {
      let result: OrderResult;
      if (stockOf(s, o.good) < o.qty) {
        // A handshake order may be forgotten by both sides; a written one is owed.
        result = !o.written && rng.chance(0.5) ? 'backedOut' : 'short';
        if (result === 'short') changeAmanah(s, -Math.max(3, o.amanah + 1));
      } else result = fillOrder(s, o, rng);
      out.ordersFilled.push({ order: o, result });
    }
  });
  s.orders = s.orders.filter(o => !r.ordersDue.includes(o));
  if (r.mudarabah) {
    const pay = Math.max(0, r.mudarabah.capital + r.mudarabah.share);
    s.cash -= pay;
    s.week_.other += Math.max(0, r.mudarabah.share);
    out.mudarabahPaid = pay;
    s.mudarabah = null;
  }
  if (s.cash < r.rent) out.wholesale = sellToWholesaler(s, r.rent);
  if (s.cash < r.rent) {
    out.broke = true;
    s.phase = 'broke';
    return out;
  }
  s.cash -= r.rent;
  out.rentPaid = r.rent;
  for (const d of r.debtsDue) {
    if (s.cash >= d.amount) { s.cash -= d.amount; out.debtsPaid += d.amount; s.debts = s.debts.filter(x => x !== d); }
    else { d.due += 7; out.debtsLate += d.amount; changeAmanah(s, -3); }
  }
  return out;
}

export function upgradeCost(s: GameState, id: UpgradeId): number | null {
  const level = s.upgrades[id];
  return UPGRADES[id].costs[level] ?? null;
}

export function buyUpgrade(s: GameState, id: UpgradeId): boolean {
  const cost = upgradeCost(s, id);
  if (cost === null || s.cash < cost) return false;
  s.cash -= cost;
  s.upgrades[id] += 1;
  s.upgradesSpent += cost;
  s.counters.upgrades += 1;
  if (id === 'shelf') s.slots.push({ good: null, qty: 0, cost: 0 });
  checkMainQuest(s);
  return true;
}

// ---------- quests ----------

export interface MainQuest {
  objectives: ReadonlyArray<{ counter: keyof Counters; target: number }>;
  /** Paid by the merchants' guild the moment every objective is met. */
  reward: number;
}

/** The main quest: one chapter a season, all of its objectives counted within that season. */
export const MAIN_QUESTS: Readonly<Record<Season, MainQuest>> = {
  1: { objectives: [{ counter: 'sold', target: 40 }, { counter: 'trips', target: 3 }, { counter: 'upgrades', target: 1 }], reward: 60 },
  2: { objectives: [{ counter: 'revenue', target: 500 }, { counter: 'helped', target: 2 }, { counter: 'trips', target: 4 }], reward: 90 },
  3: { objectives: [{ counter: 'sold', target: 90 }, { counter: 'upgrades', target: 2 }, { counter: 'helped', target: 3 }], reward: 120 },
  4: { objectives: [{ counter: 'revenue', target: 1200 }, { counter: 'trips', target: 5 }, { counter: 'helped', target: 3 }], reward: 150 },
};

export function mainProgress(s: GameState): boolean[] {
  return MAIN_QUESTS[s.season].objectives.map(g => s.counters[g.counter] >= g.target);
}

export function mainQuestDone(s: GameState): boolean {
  return s.flags.mainDone === s.season;
}

/** Pays the main quest's reward once, as soon as every objective is met. */
export function checkMainQuest(s: GameState): number {
  if (mainQuestDone(s) || !mainProgress(s).every(Boolean)) return 0;
  const reward = MAIN_QUESTS[s.season].reward;
  s.flags.mainDone = s.season;
  s.cash += reward;
  s.notices.push({ key: 'notice.mainDone', vars: { n: reward } });
  return reward;
}

/** Side quests open at once: orders and debts. */
export const MAX_SIDE_QUESTS = 4;
/** A side quest always gives at least a full week. */
export const QUEST_MIN_DAYS = 7;
/** Day index of the year's last Friday. */
export const LAST_FRIDAY = 4 * WEEKS_PER_SEASON * 7 - 1;

export function sideQuestCount(s: GameState): number {
  return s.orders.length + s.debts.length;
}

/** The first Friday at least `days` from today, or null if that is past the year's end. */
export function questDue(s: GameState, days = QUEST_MIN_DAYS): number | null {
  const d = dayIndex(s) + days;
  const due = d + ((FRIDAY - (d % 7) + 7) % 7);
  return due <= LAST_FRIDAY ? due : null;
}

/** Whether a new side quest can be offered now. */
export function canOfferQuest(s: GameState): boolean {
  return sideQuestCount(s) < MAX_SIDE_QUESTS && questDue(s) !== null;
}

export type OrderResult = 'filled' | 'backedOut' | 'short';

/** Hands over the goods and takes payment. A handshake buyer may back out. */
function fillOrder(s: GameState, o: Order, rng: Rng): OrderResult {
  if (stockOf(s, o.good) < o.qty) return 'short';
  if (!o.written && rng.chance(0.3)) return 'backedOut';
  let left = o.qty;
  const fromStore = Math.min(left, s.store[o.good].qty);
  let cost = takeStock(s, o.good, fromStore);
  left -= fromStore;
  for (const sl of s.slots) {
    if (left <= 0 || sl.good !== o.good) continue;
    const n = Math.min(left, sl.qty);
    const c = sl.qty ? (sl.cost / sl.qty) * n : 0;
    sl.qty -= n; sl.cost -= c; left -= n; cost += c;
  }
  const rev = o.qty * o.price;
  s.cash += rev; s.week_.revenue += rev; s.week_.costOfSold += cost;
  s.counters.revenue += rev; s.counters.sold += o.qty;
  changeAmanah(s, o.amanah);
  if (o.helps) { s.counters.helped += 1; s.flags.helpedTotal = (s.flags.helpedTotal ?? 0) + 1; }
  return 'filled';
}

/** Delivers an order before its Friday. Needs the goods in the storeroom or on the slots. */
export function deliverOrder(s: GameState, i: number): OrderResult | null {
  const o = s.orders[i];
  if (!o || stockOf(s, o.good) < o.qty) return null;
  const result = withRng(s, rng => fillOrder(s, o, rng));
  s.orders.splice(i, 1);
  return result;
}

/** Pays a debt back before it is due. */
export function repayDebt(s: GameState, i: number): boolean {
  const d = s.debts[i];
  if (!d || s.cash < d.amount) return false;
  s.cash -= d.amount;
  s.debts.splice(i, 1);
  changeAmanah(s, 1);
  return true;
}

export interface WeekEnd {
  seasonEnded: boolean;
  /** Whether this season's main quest was finished. */
  mainDone: boolean;
  yearEnded: boolean;
}

/** After Friday: on to Saturday, a new season, or the year end. */
export function endFriday(s: GameState): WeekEnd {
  checkMainQuest(s);
  const out: WeekEnd = { seasonEnded: false, mainDone: mainQuestDone(s), yearEnded: false };
  s.wanted = goodsRecord(() => 0);
  s.week_ = emptyWeek(s.amanah);
  s.week += 1;
  s.dow = 0;
  if (s.week > WEEKS_PER_SEASON) {
    out.seasonEnded = true;
    s.counters = emptyCounters();
    s.week = 1;
    if (s.season === 4) {
      out.yearEnded = true;
      s.phase = 'yearEnd';
      return out;
    }
    s.season = (s.season + 1) as Season;
  }
  overnight(s);
  s.phase = 'morning';
  if (out.seasonEnded) saveSeason(s);
  return out;
}

// ---------- going broke ----------

function saveSeason(s: GameState) {
  const copy = { ...s, seasonSave: null };
  s.seasonSave = JSON.stringify(copy);
}

/** Back to the start of this season, as it was then. */
export function retrySeason(s: GameState): GameState | null {
  if (!s.seasonSave) return null;
  const back = JSON.parse(s.seasonSave) as GameState;
  back.seasonSave = s.seasonSave;
  back.phase = 'morning';
  return back;
}

// ---------- worth and the year end ----------

export function owedTotal(s: GameState): number {
  return s.owed.reduce((a, o) => a + o.amount, 0);
}

export function debtTotal(s: GameState): number {
  return s.debts.reduce((a, d) => a + d.amount, 0) + (s.mudarabah?.capital ?? 0);
}

/** Cash, stock at cost and money owed, less debts. Fixtures are not counted. */
export function netWorth(s: GameState): number {
  return s.cash + stockCost(s) + owedTotal(s) - debtTotal(s);
}

export function totalProfit(s: GameState): number {
  return netWorth(s) + s.upgradesSpent - s.openingWorth;
}

export interface StockValuation {
  good: GoodId;
  qty: number;
  paid: number;
  market: number;
  hoped: number;
}

/** Each good you hold, priced three ways for the bayt al-mal. */
export function valuations(s: GameState): StockValuation[] {
  return GOOD_IDS.filter(g => stockOf(s, g) > 0).map(g => {
    const qty = stockOf(s, g);
    const market = Math.round(seasonPrice(g, s.season));
    return { good: g, qty, paid: Math.round((averageCost(s, g) ?? 0) * qty), market, hoped: Math.round(market * 1.4) };
  });
}

export function yearEndCount(s: GameState): ZakatResult {
  const stockAtMarket = valuations(s).reduce((a, v) => a + v.qty * v.market, 0);
  return zakatCount({ cash: s.cash, stockAtMarket, owedToYou: owedTotal(s), debtsDue: debtTotal(s) });
}

export function payYearEnd(s: GameState, sadaqah: number) {
  const result = yearEndCount(s);
  const paid = Math.min(result.zakat, s.cash);
  s.cash -= paid;
  const gift = Math.min(sadaqah, s.cash);
  s.cash -= gift;
  s.yearEnd = { result, paid, sadaqah: gift, rikaz: s.rikazPaid };
  s.phase = 'done';
}

export { NISAB };

// ---------- saves ----------

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    return s.version === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}
