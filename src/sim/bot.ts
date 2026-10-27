// Scripted players for balance runs: a careful trader who prices fairly and helps people,
// and a greedy one who overprices and takes every shortcut on the road.

import { GOODS, GOOD_IDS, TOWNS, TOWN_IDS, UPGRADES, type GoodId, type TownId, type UpgradeId } from './data';
import { DaySim } from './day';
import { eventById } from './events';
import {
  arriveHome, canSetOut, chooseNode, chooseOption, eventOptions, finishEvent, freeSpace, leaveTown, setOut,
  suggestedSupplies, townBuy, townSupplies,
} from './expedition';
import {
  endFriday, endShopDay, fairToday, finishPrologue, goodsInStore, netWorth, newGame, payYearEnd, rentDue, restockSlot,
  setPrice, setSlotGood, settleFriday, startShopDay, stockOf, totalProfit, upgradeCost, yearEndCount, buyUpgrade,
  type GameState,
} from './game';

export interface Strategy {
  name: string;
  /** Price as a share of today's fair price. */
  markup: number;
  /** Which option to take at each event, by preference. */
  pick: 'honest' | 'greedy';
  upgrades: readonly UpgradeId[];
}

export const CAREFUL: Strategy = { name: 'careful', markup: 1.0, pick: 'honest', upgrades: ['camel', 'shelf', 'camel', 'skins', 'shelf', 'guide'] };
export const CARELESS: Strategy = { name: 'careless', markup: 1.35, pick: 'greedy', upgrades: [] };

/** The option an honest player takes at each event; the greedy player takes the other one. */
const HONEST: Record<string, string> = {
  sandstorm: 'a', lameCamel: 'a', bandits: 'b', caravanPot: 'a', bedouinCamp: 'a', dampSalt: 'a', badFish: 'a',
  droughtTown: 'a', cornerSalt: 'b', fakeBidder: 'b', nextNet: 'b', salam: 'a', moneylender: 'b', friendlyLoan: 'c',
  widow: 'b', datesForDates: 'b', shortMeasure: 'a', bigOrder: 'c', hungryFamily: 'b', potter: 'b', zakatCollector: 'a',
  newMuslim: 'a', freedom: 'a', debtor: 'a', teacher: 'a', traveller: 'a', lostPurse: 'a', carryForBrother: 'a',
  rumour: 'b', buriedCoins: 'a',
};
const GREEDY: Record<string, string> = {
  sandstorm: 'b', lameCamel: 'c', bandits: 'c', caravanPot: 'b', bedouinCamp: 'b', dampSalt: 'b', badFish: 'b',
  droughtTown: 'b', cornerSalt: 'a', fakeBidder: 'a', nextNet: 'a', salam: 'b', moneylender: 'a', friendlyLoan: 'b',
  widow: 'b', datesForDates: 'a', shortMeasure: 'b', bigOrder: 'b', hungryFamily: 'c', potter: 'c', zakatCollector: 'b',
  newMuslim: 'b', freedom: 'b', debtor: 'c', teacher: 'b', traveller: 'b', lostPurse: 'b', carryForBrother: 'b',
  rumour: 'a', buriedCoins: 'b',
};

/** Margin per unit of caravan space at a town, by its usual prices. */
function townValue(s: GameState, town: TownId): number {
  return Math.max(...TOWNS[town].sells.filter(x => !x.rare).map(x => (fairToday(s, x.good) - x.price) / GOODS[x.good].space));
}

function stockUnits(s: GameState): number {
  return GOOD_IDS.reduce((a, g) => a + stockOf(s, g), 0);
}

function morning(s: GameState, st: Strategy) {
  const shelfUnits = s.slots.length * 5;
  if (stockUnits(s) < Math.min(10, shelfUnits)) {
    const towns = TOWN_IDS.filter(t => canSetOut(s, t, suggestedSupplies(s, t)) === null)
      .sort((a, b) => townValue(s, b) - townValue(s, a));
    const town = towns[0];
    if (town && setOut(s, town, suggestedSupplies(s, town))) return runTrip(s, st);
  }
  shopDay(s, st);
}

function fillSlots(s: GameState) {
  const goods = goodsInStore(s).sort((a, b) => s.store[b].qty - s.store[a].qty);
  s.slots.forEach((sl, i) => {
    if (sl.good && (sl.qty > 0 || s.store[sl.good].qty > 0)) { restockSlot(s, i); return; }
    const used = new Set(s.slots.map(x => x.good));
    const next = goods.find(g => !used.has(g) && s.store[g].qty > 0) ?? goods.find(g => s.store[g].qty > 0);
    setSlotGood(s, i, next ?? null);
  });
}

function shopDay(s: GameState, st: Strategy) {
  startShopDay(s);
  fillSlots(s);
  for (const g of GOOD_IDS) setPrice(s, g, fairToday(s, g) * st.markup);
  new DaySim(s).runToEnd(0.1, slot => { if (!restockSlot(s, slot)) fillSlots(s); });
  endShopDay(s);
}

function runTrip(s: GameState, st: Strategy) {
  const prefs = st.pick === 'honest' ? HONEST : GREEDY;
  for (let guard = 0; guard < 50 && s.trip; guard++) {
    const t = s.trip;
    if (t.leg === 'town') {
      const offers = [...t.offers].sort((a, b) => (fairToday(s, b.good) - b.price) / GOODS[b.good].space - (fairToday(s, a.good) - a.price) / GOODS[a.good].space);
      townSupplies(s, Math.max(0, TOWNS[t.town].stops - s.supplies + 1));
      const reserve = rentDue(s) + 5;
      for (const o of offers) {
        if (fairToday(s, o.good) <= o.price) continue;
        const afford = Math.floor((s.cash - reserve) / o.price);
        if (afford > 0 && freeSpace(s) > 0) townBuy(s, o.good, afford);
      }
      leaveTown(s);
      continue;
    }
    if (t.leg === 'home') { arriveHome(s); return; }
    if (t.event) {
      if (!t.event.outcome) {
        const opts = eventOptions(s).filter(o => !o.blocked);
        const want = prefs[t.event.id];
        const o = opts.find(x => x.id === want) ?? opts[opts.length - 1] ?? opts[0];
        if (o) chooseOption(s, o.id);
        else chooseOption(s, eventById(t.event.id).options[0]!.id);
      }
      finishEvent(s);
      continue;
    }
    chooseNode(s, 0);
  }
}

function friday(s: GameState, st: Strategy) {
  const r = settleFriday(s);
  if (r.broke) return;
  for (const id of st.upgrades) {
    const level = st.upgrades.slice(0, st.upgrades.indexOf(id) + 1).filter(x => x === id).length;
    if (s.upgrades[id] >= level) continue;
    const cost = upgradeCost(s, id);
    if (cost !== null && s.cash - cost > rentDue(s) + 60) buyUpgrade(s, id);
    break;
  }
  endFriday(s);
}

export interface YearResult {
  broke: boolean;
  seasonBroke: number | null;
  netWorth: number;
  profit: number;
  zakatableTotal: number;
  zakat: number;
  amanah: number;
  trips: number;
  upgrades: number;
  worthBySeason: number[];
}

export function playYear(st: Strategy, seed: number): YearResult {
  const s = newGame(seed);
  finishPrologue(s);
  let trips = 0;
  const worthBySeason: number[] = [];
  let lastSeason = s.season;
  for (let guard = 0; guard < 2000; guard++) {
    if (s.phase === 'morning') { const before = s.counters.trips; morning(s, st); if (s.counters.trips > before) trips++; }
    else if (s.phase === 'friday') friday(s, st);
    else if (s.phase === 'broke') return { broke: true, seasonBroke: s.season, netWorth: netWorth(s), profit: totalProfit(s), zakatableTotal: 0, zakat: 0, amanah: s.amanah, trips, upgrades: totalUpgrades(s), worthBySeason };
    else if (s.phase === 'yearEnd') break;
    if (s.season !== lastSeason) { worthBySeason.push(Math.round(netWorth(s))); lastSeason = s.season; }
  }
  worthBySeason.push(Math.round(netWorth(s)));
  const r = yearEndCount(s);
  const profit = totalProfit(s);
  payYearEnd(s, 0);
  return { broke: false, seasonBroke: null, netWorth: netWorth(s), profit, zakatableTotal: r.zakatableTotal, zakat: r.zakat, amanah: s.amanah, trips, upgrades: totalUpgrades(s), worthBySeason };
}

function totalUpgrades(s: GameState): number {
  return (Object.keys(UPGRADES) as UpgradeId[]).reduce((a, k) => a + s.upgrades[k], 0);
}

export type { GoodId };
