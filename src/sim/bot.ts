// Scripted players for balance runs (gdd 9.1): a careful trader and a careless one.

import { CARTS, GOODS, STALLS, type CartId, type GoodId, type SourceId, type StallId, type Week } from './data';
import { cellsOf } from './costing';
import {
  autoPack, buyOne, buyPrice, chooseHarith, chooseSource, endDay, endWeek, finishPrologue, goodsAt, harithDue,
  hireCart, leaveSource, marketToday, newGame, nextDay, payYearEnd, rentStall, rideHome, setPrice, startDay,
  startWeek, totalProfit, yearEndCount, type GameState,
} from './game';
import { DaySim } from './day';

export interface Strategy {
  name: string;
  stall: (week: Week) => StallId;
  source: (week: Week) => SourceId;
  cart: (stall: StallId) => CartId;
  /** Price as a share of today's market price. */
  markup: number;
  padJars: boolean;
  harith: 'fair' | 'hold';
  /** Share of the cart to fill. */
  fill: number;
}

const CART_FOR: Record<StallId, CartId> = { small: 'handcart', medium: 'donkey', big: 'camels' };

export const CAREFUL: Strategy = {
  name: 'careful',
  stall: w => (w === 1 ? 'small' : w === 4 ? 'big' : 'medium'),
  source: w => (w === 1 ? 'groves' : w === 3 ? 'bedouin' : 'port'),
  cart: st => CART_FOR[st],
  markup: 1,
  padJars: true,
  harith: 'fair',
  fill: 1,
};

export const CARELESS: Strategy = {
  name: 'careless',
  stall: () => 'small',
  source: w => (w % 2 ? 'groves' : 'port'),
  cart: () => 'handcart',
  markup: 1.25,
  padJars: false,
  harith: 'hold',
  fill: 0.75,
};

/** Fills the cart with the goods at the source that earn most per cell, padding jars if asked. */
function shop(s: GameState, st: Strategy) {
  const cart = CARTS[s.weekend.cart!];
  const cells = Math.floor(cart.cols * cart.rows * st.fill);
  const goods = goodsAt(s, s.weekend.source!).filter(g => GOODS[g].market);
  const ranked = goods.sort((a, b) => margin(s, b) / cellsOf(b) - margin(s, a) / cellsOf(a));
  let used = 0;
  // Spread purchases across goods so several shelves are stocked.
  for (let round = 0; round < 20 && used < cells; round++) {
    for (const g of ranked) {
      const need = cellsOf(g) + (g === 'pottery' && st.padJars ? 1 : 0);
      if (used + need > cells) continue;
      if (!buyOne(s, g, GOODS[g].source === 'bedouin')) continue;
      used += cellsOf(g);
      if (g === 'pottery' && st.padJars && goodsAt(s, s.weekend.source!).includes('straw')) { buyOne(s, 'straw'); used += 1; }
    }
  }
  autoPack(s);
}

function margin(s: GameState, g: GoodId): number {
  return GOODS[g].market![s.week] - buyPrice(s, g);
}

export interface YearResult {
  strategy: string;
  seed: number;
  weekProfits: number[];
  zakatableTotal: number;
  zakat: number;
  amanah: number;
  cash: number;
  profit: number;
}

export function playYear(st: Strategy, seed: number): YearResult {
  const s = newGame(seed);
  finishPrologue(s);
  for (let w = 1; w <= 4; w++) {
    const week = w as Week;
    if (week > 1) rentStall(s, STALLS[st.stall(week)].id);
    chooseSource(s, st.source(week));
    hireCart(s, st.cart(s.stall));
    shop(s, st);
    leaveSource(s);
    rideHome(s);
    startWeek(s);
    for (let d = 1; d <= 5; d++) {
      if (harithDue(s)) chooseHarith(s, st.harith);
      s.shelves.forEach((sh, i) => { if (sh.good) setPrice(s, i, marketToday(s, sh.good) * st.markup); });
      new DaySim(s).runToEnd();
      endDay(s);
      nextDay(s);
      if (s.phase === 'shop') { startDay(s); }
    }
    endWeek(s);
  }
  const count = yearEndCount(s);
  payYearEnd(s, 0);
  return {
    strategy: st.name, seed, weekProfits: s.history.map(h => Math.round(h.profit)),
    zakatableTotal: Math.round(count.zakatableTotal), zakat: count.zakat, amanah: s.amanah, cash: Math.round(s.cash), profit: Math.round(totalProfit(s)),
  };
}
