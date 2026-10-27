import { describe, expect, it } from 'vitest';
import {
  DaySim, EVENTS, FRIDAY, GOOD_IDS, TOWNS, advanceDay, arriveHome, buyUpgrade, canSetOut, chooseNode, chooseOption,
  endFriday, endShopDay, eventOptions, finishEvent, finishPrologue, leaveTown, newGame, notebookRange, restockSlot,
  retrySeason, setOut, setPrice, setSlotGood, settleFriday, startShopDay, stockOf, townBuy, yearEndCount,
  type GameState,
} from '../index';

function fresh(seed = 7): GameState {
  const s = newGame(seed);
  finishPrologue(s);
  return s;
}

/** Plays a trip choosing the first stop and the first open option every time. */
function playTrip(s: GameState) {
  for (let guard = 0; guard < 40 && s.trip; guard++) {
    const t = s.trip;
    if (t.leg === 'town') { townBuy(s, t.offers[0]!.good, 3); leaveTown(s); continue; }
    if (t.leg === 'home') { arriveHome(s); continue; }
    if (t.event) {
      if (!t.event.outcome) chooseOption(s, eventOptions(s).find(o => !o.blocked)!.id);
      finishEvent(s);
      continue;
    }
    chooseNode(s, 0);
  }
}

describe('a new year', () => {
  it('starts on a Saturday morning with the uncle\'s stock on the shelves', () => {
    const s = fresh();
    expect(s).toMatchObject({ phase: 'morning', season: 1, week: 1, dow: 0 });
    expect(s.slots).toHaveLength(3);
    expect(s.slots[0]).toMatchObject({ good: 'dates', qty: 5 });
    expect(stockOf(s, 'dates')).toBe(6);
  });
});

describe('a market day', () => {
  it('sells from the slots, writes reactions in the notebook and moves to the next day', () => {
    const s = fresh();
    setPrice(s, 'dates', 6);
    startShopDay(s);
    new DaySim(s).runToEnd();
    expect(s.day.sold).toBeGreaterThan(0);
    expect(s.cash).toBeGreaterThan(70);
    expect(notebookRange(s, 'dates').good).toBe(6);
    endShopDay(s);
    expect(s).toMatchObject({ phase: 'morning', dow: 1 });
  });

  it('notes customers who ask for goods you do not have', () => {
    const s = fresh();
    startShopDay(s);
    new DaySim(s).runToEnd();
    expect(GOOD_IDS.reduce((a, g) => a + s.wanted[g], 0)).toBeGreaterThan(0);
  });

  it('restocks a slot from the storeroom and swaps goods back', () => {
    const s = fresh();
    s.slots[0]!.qty = 0;
    expect(restockSlot(s, 0)).toBe(1);
    setSlotGood(s, 0, 'salt');
    expect(stockOf(s, 'dates')).toBe(1);
    expect(s.store.dates.qty).toBe(1);
  });

  it('leads to Friday after Thursday', () => {
    const s = fresh();
    for (let i = 0; i < FRIDAY; i++) advanceDay(s);
    expect(s).toMatchObject({ phase: 'friday', dow: FRIDAY });
  });
});

describe('expeditions', () => {
  it('needs enough supplies and enough days before Friday', () => {
    const s = fresh();
    expect(canSetOut(s, 'groves', 0)).toBe('supplies');
    expect(canSetOut(s, 'kufa', 6)).toBe('closed');
    s.dow = 5;
    expect(canSetOut(s, 'groves', 4)).toBe('friday');
  });

  it('goes to town and back, filling the storeroom and using the days', () => {
    const s = fresh(3);
    expect(setOut(s, 'groves', 5)).toBe(true);
    expect(s.trip!.layers).toHaveLength(TOWNS.groves.stops);
    playTrip(s);
    expect(s.trip).toBeNull();
    expect(s.dow).toBeGreaterThanOrEqual(2);
    expect(stockOf(s, 'dates')).toBeGreaterThan(6);
    expect(s.counters.trips).toBe(1);
  });

  it('every event has 2 or 3 choices and one that is always open', () => {
    expect(EVENTS).toHaveLength(30);
    expect(new Set(EVENTS.map(e => e.id)).size).toBe(30);
    for (const e of EVENTS) {
      expect(e.options.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.options.length, e.id).toBeLessThanOrEqual(3);
      expect(e.options.some(o => !o.need), e.id).toBe(true);
    }
  });
});

describe('Friday', () => {
  it('takes rent, or sells to the wholesaler, or the stall is lost', () => {
    const s = fresh();
    s.dow = FRIDAY; s.phase = 'friday';
    const cash = s.cash;
    expect(settleFriday(s).rentPaid).toBe(15);
    expect(s.cash).toBe(cash - 15);

    const t = fresh();
    t.dow = FRIDAY; t.cash = 5;
    const r = settleFriday(t);
    expect(r.wholesale.units).toBeGreaterThan(0);
    expect(r.broke).toBe(false);

    const u = fresh();
    u.dow = FRIDAY; u.cash = 0;
    for (const g of GOOD_IDS) u.store[g] = { qty: 0, cost: 0 };
    for (const sl of u.slots) { sl.qty = 0; sl.cost = 0; }
    expect(settleFriday(u).broke).toBe(true);
    expect(u.phase).toBe('broke');
    expect(retrySeason(u)).toMatchObject({ phase: 'morning', season: 1, week: 1 });
  });

  it('upgrades add a shelf slot and are paid from cash', () => {
    const s = fresh();
    s.cash = 100;
    expect(buyUpgrade(s, 'shelf')).toBe(true);
    expect(s.slots).toHaveLength(4);
    expect(s.cash).toBe(40);
  });

  it('runs four weeks to a season and four seasons to the year end', () => {
    const s = fresh();
    s.cash = 10000;
    for (let w = 0; w < 16; w++) {
      for (let i = 0; i < FRIDAY; i++) advanceDay(s);
      settleFriday(s);
      endFriday(s);
    }
    expect(s.phase).toBe('yearEnd');
  });
});

describe('the year end', () => {
  it('counts cash, stock and money owed, but not the shelves or camels', () => {
    const s = fresh();
    s.cash = 300;
    const before = yearEndCount(s).zakatableTotal;
    buyUpgrade(s, 'camel');
    expect(yearEndCount(s).zakatableTotal).toBe(before - 70);
    expect(yearEndCount(s).zakat).toBeCloseTo(yearEndCount(s).zakatableTotal / 40);
  });
});
