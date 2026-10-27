// The whole year as one serialisable state plus the actions that move it forward.
// Screens call these actions; nothing here touches the browser or three.js.

import {
  CARTS, GOODS, OPENING_AMANAH, OPENING_CASH, SHOP_DAYS_PER_WEEK, SOURCES, STALLS,
  CARAVAN_LATE_DATES_PRICE, marketPrice, type CartId, type GoodId, type SourceId, type StallId, type Week,
} from './data';
import { cellsOf } from './costing';
import { clampAmanah } from './customers';
import { weekLedger, zakatCount, type WeekLedger, type ZakatResult } from './ledger';
import { CartGrid, type Placement } from './packing';
import { createRng, type Rng } from './rng';

export const SAVE_VERSION = 1;

export type Phase =
  | 'prologue'
  | 'stall'      // weekend: choose and rent a stall (weeks 2 to 4)
  | 'source'     // weekend: pick where to buy
  | 'cart'       // weekend: hire a cart
  | 'buy'        // weekend: buy and pack
  | 'ride'       // weekend: ride home
  | 'weekendLedger'
  | 'shop'       // weekdays
  | 'weekLedger'
  | 'yearEnd'
  | 'done';

export interface Lot {
  id: number;
  good: GoodId;
  qty: number;
  landedEach: number;
  /** Absolute shop-day index the lot was bought before. Dates spoil 5 shop days after. */
  boughtDay: number;
}

export interface Debt {
  who: 'bedouin' | 'qardHasan';
  amount: number;
}

export interface Receivable {
  who: 'scholar';
  amount: number;
}

export interface Shelf {
  good: GoodId | null;
  price: number;
}

export interface TrayItem {
  id: number;
  good: GoodId;
  /** Paid with cash, or on credit from the Bedouin trader. */
  credit: boolean;
  placement: Placement | null;
}

export interface Weekend {
  source: SourceId | null;
  cart: CartId | null;
  tray: TrayItem[];
  broken: GoodId[];
  /** Filled when the player leaves the source. */
  ledger: WeekendSummary | null;
}

export interface WeekendSummary {
  lines: Array<{ good: GoodId; qty: number; buyEach: number; landedEach: number }>;
  goodsCost: number;
  hire: number;
  cellsUsed: number;
  cellsTotal: number;
  wastedHire: number;
  refunded: number;
  boughtOnCredit: number;
  broken: Array<{ good: GoodId; landed: number }>;
}

export interface WeekStats {
  cashStart: number;
  amanahStart: number;
  revenue: number;
  cogs: number;
  rent: number;
  stockBought: number;
  writtenOff: number;
  wastedHire: number;
  spoiled: number;
  shortWeights: number;
}

export interface DayStats {
  sold: number;
  revenue: number;
  walked: number;
  amanahStart: number;
  creditSales: number;
}

export interface WeekRecord extends WeekLedger {
  week: Week;
  stall: StallId;
  amanah: number;
}

export interface GameState {
  version: number;
  rng: number;
  phase: Phase;
  week: Week;
  /** Shop day within the week, 1 to 5. 0 during the weekend. */
  day: number;
  cash: number;
  amanah: number;
  stall: StallId;
  lots: Lot[];
  shelves: Shelf[];
  debts: Debt[];
  receivables: Receivable[];
  weekend: Weekend;
  weekStats: WeekStats;
  dayStats: DayStats;
  history: WeekRecord[];
  flags: {
    harith: 'fair' | 'hold' | null;
    inspectorTomorrow: boolean;
    inspectorToday: boolean;
    nextLotId: number;
  };
  yearEnd: { result: ZakatResult; paid: number; sadaqah: number; debtsSettled: number } | null;
  minutesStart: number;
}

// ---------- setup ----------

export function newGame(seed: number, nowMs = 0): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    rng: seed >>> 0,
    phase: 'prologue',
    week: 1,
    day: 0,
    cash: OPENING_CASH,
    amanah: OPENING_AMANAH,
    stall: 'small',
    lots: [],
    shelves: [],
    debts: [],
    receivables: [],
    weekend: emptyWeekend(),
    weekStats: emptyWeekStats(OPENING_CASH, OPENING_AMANAH),
    dayStats: emptyDayStats(OPENING_AMANAH),
    history: [],
    flags: { harith: null, inspectorTomorrow: false, inspectorToday: false, nextLotId: 1 },
    yearEnd: null,
    minutesStart: nowMs,
  };
  // Stock left by the uncle (gdd 2.3), costed at what he paid.
  addLot(s, 'dates', 2, GOODS.dates.buy[1] + 1, 0);
  addLot(s, 'cloth', 1, GOODS.cloth.buy[1] + 2, 0);
  s.shelves = makeShelves(s.stall, []);
  return s;
}

function emptyWeekend(): Weekend {
  return { source: null, cart: null, tray: [], broken: [], ledger: null };
}

function emptyWeekStats(cash: number, amanah: number): WeekStats {
  return { cashStart: cash, amanahStart: amanah, revenue: 0, cogs: 0, rent: 0, stockBought: 0, writtenOff: 0, wastedHire: 0, spoiled: 0, shortWeights: 0 };
}

function emptyDayStats(amanah: number): DayStats {
  return { sold: 0, revenue: 0, walked: 0, amanahStart: amanah, creditSales: 0 };
}

function addLot(s: GameState, good: GoodId, qty: number, landedEach: number, boughtDay: number) {
  s.lots.push({ id: s.flags.nextLotId++, good, qty, landedEach, boughtDay });
}

export function withRng<T>(s: GameState, f: (rng: Rng) => T): T {
  const rng = createRng(s.rng);
  const out = f(rng);
  s.rng = rng.state();
  return out;
}

export function absDay(week: Week, day: number): number {
  return (week - 1) * SHOP_DAYS_PER_WEEK + day;
}

// ---------- prices ----------

/** Market price of a good on a given shop day, with the week's events (gdd 7, 9.2). */
export function marketToday(s: GameState, good: GoodId, day = s.day): number {
  const base = marketPrice(good, s.week);
  if (good === 'dates' && s.week === 3) {
    if (day === 2) return CARAVAN_LATE_DATES_PRICE;
    if (day > 2 && s.flags.harith === 'hold') return Math.round(base * 0.8);
  }
  return base;
}

export function buyPrice(s: GameState, good: GoodId): number {
  return GOODS[good].buy[s.week];
}

// ---------- prologue and weekend ----------

export function finishPrologue(s: GameState) {
  s.phase = 'source';
  // Week 1: the uncle's stall is already rented; the rent is charged in the week 1 ledger (gdd 5).
  payRent(s);
}

export function stallChoices(s: GameState): StallId[] {
  return (Object.keys(STALLS) as StallId[]).filter(id => STALLS[id].fromWeek <= s.week);
}

/** Rents a stall for the week. Short of cash, a qard hasan loan covers the gap (gdd 8). */
export function rentStall(s: GameState, stall: StallId) {
  s.stall = stall;
  payRent(s);
  s.shelves = makeShelves(stall, s.shelves);
  s.phase = 'source';
}

function payRent(s: GameState) {
  const rent = STALLS[s.stall].rent;
  borrowIfShort(s, rent);
  s.cash -= rent;
  s.weekStats.rent += rent;
}

function borrowIfShort(s: GameState, amount: number) {
  if (s.cash >= amount) return 0;
  const loan = Math.ceil(amount - s.cash);
  s.cash += loan;
  const d = s.debts.find(x => x.who === 'qardHasan');
  if (d) d.amount += loan; else s.debts.push({ who: 'qardHasan', amount: loan });
  return loan;
}

export function sourceChoices(s: GameState): SourceId[] {
  return (Object.keys(SOURCES) as SourceId[]).filter(id => SOURCES[id].openWeeks.includes(s.week));
}

export function goodsAt(s: GameState, source: SourceId): GoodId[] {
  return (Object.keys(GOODS) as GoodId[]).filter(g => GOODS[g].source === source && GOODS[g].availableWeeks.includes(s.week));
}

export function chooseSource(s: GameState, source: SourceId) {
  s.weekend.source = source;
  s.phase = 'cart';
}

export function hireCart(s: GameState, cart: CartId) {
  const hire = CARTS[cart].hire;
  borrowIfShort(s, hire);
  s.cash -= hire;
  s.weekend.cart = cart;
  s.weekStats.stockBought += hire;
  s.phase = 'buy';
}

/** Buys one unit into the tray. Credit is only offered by the Bedouin trader (gdd 7). */
export function buyOne(s: GameState, good: GoodId, credit = false): TrayItem | null {
  const price = buyPrice(s, good);
  if (credit && GOODS[good].source !== 'bedouin') return null;
  if (!credit && s.cash < price) return null;
  if (!credit) s.cash -= price;
  const item: TrayItem = { id: s.flags.nextLotId++, good, credit, placement: null };
  s.weekend.tray.push(item);
  return item;
}

/** Returns an unpacked item from the tray for a full refund. */
export function returnOne(s: GameState, itemId: number) {
  const i = s.weekend.tray.findIndex(t => t.id === itemId);
  const item = s.weekend.tray[i];
  if (!item) return;
  if (!item.credit) s.cash += buyPrice(s, item.good);
  s.weekend.tray.splice(i, 1);
}

export function gridFor(s: GameState, exceptId?: number): CartGrid {
  const g = new CartGrid(s.weekend.cart ?? 'handcart');
  for (const t of s.weekend.tray) if (t.placement && t.id !== exceptId) g.place(t.placement);
  return g;
}

export function placeItem(s: GameState, itemId: number, placement: Omit<Placement, 'good'>): boolean {
  const item = s.weekend.tray.find(t => t.id === itemId);
  if (!item) return false;
  const p: Placement = { ...placement, good: item.good };
  if (gridFor(s, itemId).canPlace(p)) return false;
  item.placement = p;
  return true;
}

export function unplaceItem(s: GameState, itemId: number) {
  const item = s.weekend.tray.find(t => t.id === itemId);
  if (item) item.placement = null;
}

/**
 * Packs every unplaced item it can, biggest first, preferring spots where jars touch padding.
 * The fallback for fiddly packing on small phones (gdd 14.3).
 */
export function autoPack(s: GameState) {
  const order = [...s.weekend.tray]
    .filter(t => !t.placement)
    .sort((a, b) => cellsOf(b.good) - cellsOf(a.good) || (a.good === 'pottery' ? -1 : 1));
  for (const item of order) {
    const grid = gridFor(s);
    let best: Placement | null = null;
    let bestScore = -1;
    for (const rotated of [false, true]) {
      for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
        const p: Placement = { good: item.good, col, row, rotated };
        if (!grid.canPlace(p)) {
          const g2 = gridFor(s);
          g2.place(p);
          const idx = g2.placements.length - 1;
          const touchesPad = g2.neighbours(idx).some(n => GOODS[n.good].padding);
          const padsJar = g2.neighbours(idx).some(n => n.good === 'pottery') && GOODS[item.good].padding;
          const score = (touchesPad && item.good === 'pottery' ? 4 : 0) + (padsJar ? 2 : 0) + g2.neighbours(idx).length * 0.1 - (row * grid.cols + col) * 0.001;
          if (score > bestScore) { bestScore = score; best = p; }
        }
      }
    }
    if (best) item.placement = best;
  }
}

/** Leaves the source: unpacked goods are refunded, packed goods are costed (gdd 3.4, 3.5). */
export function leaveSource(s: GameState) {
  const cart = CARTS[s.weekend.cart ?? 'handcart'];
  const cellsTotal = cart.cols * cart.rows;
  let refunded = 0;
  for (const t of [...s.weekend.tray]) if (!t.placement) { refunded += t.credit ? 0 : buyPrice(s, t.good); returnOne(s, t.id); }
  const byGood = new Map<GoodId, number>();
  let cellsUsed = 0;
  let boughtOnCredit = 0;
  for (const t of s.weekend.tray) {
    byGood.set(t.good, (byGood.get(t.good) ?? 0) + 1);
    cellsUsed += cellsOf(t.good);
    if (t.credit) boughtOnCredit += buyPrice(s, t.good);
  }
  const lines = [...byGood].map(([good, qty]) => {
    const buyEach = buyPrice(s, good);
    return { good, qty, buyEach, landedEach: buyEach + cart.hire * (cellsOf(good) / cellsTotal) };
  });
  const goodsCost = lines.reduce((a, l) => a + l.buyEach * l.qty, 0);
  const wastedHire = cart.hire * ((cellsTotal - cellsUsed) / cellsTotal);
  if (boughtOnCredit > 0) {
    const d = s.debts.find(x => x.who === 'bedouin');
    if (d) d.amount += boughtOnCredit; else s.debts.push({ who: 'bedouin', amount: boughtOnCredit });
  }
  s.weekStats.stockBought += goodsCost - boughtOnCredit;
  s.weekStats.wastedHire += wastedHire;
  s.weekend.ledger = { lines, goodsCost, hire: cart.hire, cellsUsed, cellsTotal, wastedHire, refunded, boughtOnCredit, broken: [] };
  s.phase = 'ride';
}

/** The ride home: unpadded jars may break (gdd 3.6). Then the goods go to the storeroom. */
export function rideHome(s: GameState) {
  const grid = gridFor(s);
  const broken = withRng(s, rng => grid.rideHome(rng));
  const ledger = s.weekend.ledger!;
  const boughtDay = absDay(s.week, 0);
  for (const t of s.weekend.tray) {
    const line = ledger.lines.find(l => l.good === t.good)!;
    // The grid holds the tray's own placement objects, so a broken placement is found by identity.
    if (t.placement && broken.includes(t.placement)) {
      ledger.broken.push({ good: t.good, landed: line.landedEach });
      s.weekStats.writtenOff += line.landedEach;
      continue;
    }
    if (t.good === 'straw') continue; // padding only, never sold (gdd 3.4)
    addLot(s, t.good, 1, line.landedEach, boughtDay);
  }
  mergeLots(s);
  s.phase = 'weekendLedger';
}

function mergeLots(s: GameState) {
  const out: Lot[] = [];
  for (const l of s.lots) {
    const same = out.find(o => o.good === l.good && o.boughtDay === l.boughtDay && Math.abs(o.landedEach - l.landedEach) < 1e-9);
    if (same) same.qty += l.qty; else out.push({ ...l });
  }
  s.lots = out.filter(l => l.qty > 0);
}

/** Straw is a cost of the trip, not stock: its landed cost goes to the week like the hire. */
export function strawCost(s: GameState): number {
  const line = s.weekend.ledger?.lines.find(l => l.good === 'straw');
  return line ? line.landedEach * line.qty : 0;
}

export function startWeek(s: GameState) {
  s.weekStats.writtenOff += strawCost(s);
  s.day = 1;
  s.phase = 'shop';
  s.shelves = makeShelves(s.stall, s.shelves, s);
  startDay(s);
}

// ---------- shop days ----------

export function stockOf(s: GameState, good: GoodId): number {
  return s.lots.filter(l => l.good === good).reduce((a, l) => a + l.qty, 0);
}

export function goodsInStore(s: GameState): GoodId[] {
  return (Object.keys(GOODS) as GoodId[]).filter(g => GOODS[g].market && stockOf(s, g) > 0);
}

function makeShelves(stall: StallId, old: Shelf[], s?: GameState): Shelf[] {
  const n = STALLS[stall].shelves;
  const shelves: Shelf[] = [];
  for (let i = 0; i < n; i++) shelves.push(old[i] ? { ...old[i]! } : { good: null, price: 0 });
  if (s) {
    // Fill empty shelves with goods in store that are not shelved yet, most valuable first.
    const shelved = new Set(shelves.map(x => x.good).filter(Boolean));
    for (const sh of shelves) {
      if (sh.good && stockOf(s, sh.good) > 0) continue;
      sh.good = null;
      const next = goodsInStore(s)
        .filter(g => !shelved.has(g))
        .sort((a, b) => stockOf(s, b) * marketToday(s, b) - stockOf(s, a) * marketToday(s, a))[0];
      if (next) { sh.good = next; shelved.add(next); sh.price = marketToday(s, next); }
    }
  }
  return shelves;
}

export function setShelfGood(s: GameState, shelf: number, good: GoodId | null) {
  const sh = s.shelves[shelf];
  if (!sh) return;
  if (good && s.shelves.some((x, i) => i !== shelf && x.good === good)) return;
  sh.good = good;
  if (good) sh.price = marketToday(s, good);
}

/** Cycles a shelf through the goods in store that are not on another shelf. */
export function cycleShelf(s: GameState, shelf: number) {
  const options: Array<GoodId | null> = [null, ...goodsInStore(s).filter(g => !s.shelves.some((x, i) => i !== shelf && x.good === g))];
  const cur = options.indexOf(s.shelves[shelf]?.good ?? null);
  setShelfGood(s, shelf, options[(cur + 1) % options.length] ?? null);
}

export function setPrice(s: GameState, shelf: number, price: number) {
  const sh = s.shelves[shelf];
  if (sh) sh.price = Math.max(1, Math.round(price));
}

/** Landed cost the player paid for the next unit sold (first in, first out). */
export function nextLandedCost(s: GameState, good: GoodId): number | null {
  const lot = oldestLot(s, good);
  return lot ? lot.landedEach : null;
}

function oldestLot(s: GameState, good: GoodId): Lot | undefined {
  return s.lots.filter(l => l.good === good && l.qty > 0).sort((a, b) => a.boughtDay - b.boughtDay)[0];
}

/** Shop days left before the oldest dates spoil, or null when there are none. */
export function daysToSpoil(s: GameState, good: GoodId): number | null {
  const life = GOODS[good].spoilsAfterDays;
  const lot = oldestLot(s, good);
  if (life === null || !lot) return null;
  return lot.boughtDay + life - absDay(s.week, s.day) + 1;
}

/** Takes units out of the storeroom, oldest first. Returns their landed cost. */
export function takeStock(s: GameState, good: GoodId, qty: number): number {
  let cost = 0;
  let left = qty;
  while (left > 0) {
    const lot = oldestLot(s, good);
    if (!lot) break;
    const n = Math.min(left, lot.qty);
    lot.qty -= n; left -= n; cost += n * lot.landedEach;
  }
  s.lots = s.lots.filter(l => l.qty > 0);
  return cost;
}

export function recordSale(s: GameState, good: GoodId, qty: number, price: number, credit = false) {
  const cogs = takeStock(s, good, qty);
  s.weekStats.cogs += cogs;
  s.dayStats.sold += qty;
  if (credit) {
    const r = s.receivables.find(x => x.who === 'scholar');
    if (r) r.amount += qty * price; else s.receivables.push({ who: 'scholar', amount: qty * price });
    s.dayStats.creditSales += qty * price;
    s.weekStats.revenue += qty * price;
  } else {
    s.cash += qty * price;
    s.dayStats.revenue += qty * price;
    s.weekStats.revenue += qty * price;
  }
}

export function changeAmanah(s: GameState, delta: number) {
  s.amanah = clampAmanah(s.amanah + delta);
}

export function startDay(s: GameState) {
  s.flags.inspectorToday = s.flags.inspectorTomorrow;
  s.flags.inspectorTomorrow = false;
  s.dayStats = emptyDayStats(s.amanah);
  for (const sh of s.shelves) if (sh.good && stockOf(s, sh.good) === 0) sh.good = null;
}

/** Harith's offer on week 3, day 2 (gdd 7). */
export function harithDue(s: GameState): boolean {
  return s.week === 3 && s.day === 2 && s.flags.harith === null && s.phase === 'shop';
}

export function chooseHarith(s: GameState, choice: 'fair' | 'hold') {
  s.flags.harith = choice;
  if (choice === 'fair') changeAmanah(s, 15);
  else { changeAmanah(s, -20); s.flags.inspectorToday = true; }
}

export interface NightReport {
  spoiled: Array<{ good: GoodId; qty: number }>;
  aboutToSpoil: Array<{ good: GoodId; qty: number }>;
  inspectorTomorrow: boolean;
}

/** Closes the shop day: spoilage, and whether the inspector comes tomorrow (gdd 4.6, 4.7). */
export function endDay(s: GameState): NightReport {
  const today = absDay(s.week, s.day);
  const spoiled: NightReport['spoiled'] = [];
  for (const l of s.lots) {
    const life = GOODS[l.good].spoilsAfterDays;
    if (life !== null && today >= l.boughtDay + life) {
      spoiled.push({ good: l.good, qty: l.qty });
      s.weekStats.writtenOff += l.qty * l.landedEach;
      s.weekStats.spoiled += l.qty;
      l.qty = 0;
    }
  }
  s.lots = s.lots.filter(l => l.qty > 0);
  const aboutToSpoil = s.lots
    .filter(l => { const life = GOODS[l.good].spoilsAfterDays; return life !== null && today + 1 >= l.boughtDay + life; })
    .map(l => ({ good: l.good, qty: l.qty }));
  s.flags.inspectorTomorrow = s.amanah < 40 || s.weekStats.shortWeights >= 2;
  if (s.weekStats.shortWeights >= 2) s.weekStats.shortWeights = 0;
  return { spoiled, aboutToSpoil, inspectorTomorrow: s.flags.inspectorTomorrow };
}

/** Moves to the next morning, or to the week's ledger after day 5. */
export function nextDay(s: GameState) {
  if (s.day >= SHOP_DAYS_PER_WEEK) {
    s.phase = 'weekLedger';
    return;
  }
  s.day += 1;
  startDay(s);
}

export function currentWeekLedger(s: GameState): WeekLedger {
  const w = s.weekStats;
  const l = weekLedger({
    cashAtStart: w.cashStart, revenue: w.revenue, costOfGoodsSold: w.cogs, stockBought: w.stockBought,
    rent: w.rent, writtenOff: w.writtenOff, wastedHire: w.wastedHire,
  });
  // Cash may also have moved through loans and credit, so report what is really in the chest.
  return { ...l, cashAtEnd: s.cash };
}

export function stockValueLanded(s: GameState): number {
  return s.lots.reduce((a, l) => a + l.qty * l.landedEach, 0);
}

/** Closes the week. After week 4 the crier ends the year (gdd 2.1). */
export function endWeek(s: GameState) {
  s.history.push({ ...currentWeekLedger(s), week: s.week, stall: s.stall, amanah: s.amanah });
  if (s.week === 4) { s.phase = 'yearEnd'; return; }
  s.week = (s.week + 1) as Week;
  s.day = 0;
  s.weekend = emptyWeekend();
  s.weekStats = emptyWeekStats(s.cash, s.amanah);
  s.phase = 'stall';
}

// ---------- year end ----------

export interface StockValuation {
  good: GoodId;
  qty: number;
  paid: number;
  market: number;
  hoped: number;
}

/** The three price tags for each stack at the bayt al-mal (gdd 6.1 step 3). */
export function valuations(s: GameState): StockValuation[] {
  return goodsInStore(s).map(good => {
    const qty = stockOf(s, good);
    const paid = s.lots.filter(l => l.good === good).reduce((a, l) => a + l.qty * l.landedEach, 0) / qty;
    const market = marketPrice(good, 4);
    return { good, qty, paid: Math.round(paid * 10) / 10, market, hoped: Math.round(market * 1.3) };
  });
}

export function yearEndCount(s: GameState): ZakatResult {
  const stockAtMarket = valuations(s).reduce((a, v) => a + v.qty * v.market, 0);
  const owedToYou = s.receivables.reduce((a, r) => a + r.amount, 0);
  const debtsDue = s.debts.reduce((a, d) => a + d.amount, 0);
  return zakatCount({ cash: s.cash, stockAtMarket, owedToYou, debtsDue });
}

/**
 * Pays zakat, then any sadaqah, then settles debts due from the chest. Zakat paid beyond the cash
 * in the chest is not possible, so it is capped there and the shortfall is shown on the end screen.
 */
export function payYearEnd(s: GameState, sadaqah: number) {
  const result = yearEndCount(s);
  const paid = Math.min(result.zakat, s.cash);
  s.cash -= paid;
  const give = Math.max(0, Math.min(sadaqah, s.cash));
  s.cash -= give;
  let debtsSettled = 0;
  for (const d of s.debts) { const pay = Math.min(d.amount, s.cash); s.cash -= pay; d.amount -= pay; debtsSettled += pay; }
  s.debts = s.debts.filter(d => d.amount > 0);
  s.yearEnd = { result, paid, sadaqah: give, debtsSettled };
  s.phase = 'done';
}

export function totalProfit(s: GameState): number {
  return s.history.reduce((a, w) => a + w.profit, 0);
}

// ---------- saving ----------

export function serialize(s: GameState): string {
  return JSON.stringify(s);
}

export function deserialize(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as GameState;
    return s && s.version === SAVE_VERSION ? s : null;
  } catch {
    return null;
  }
}
