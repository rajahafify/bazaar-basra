import { describe, expect, it } from 'vitest';
import {
  DaySim, EVENTS, FRIDAY, GOOD_IDS, TOWNS, advanceDay, arriveHome, buyUpgrade, canSetOut, chooseNode, chooseOption,
  endFriday, endShopDay, eventOptions, finishEvent, finishPrologue, leaveTown, newGame, notebookRange, restockSlot,
  retrySeason, setOut, setPrice, setSlotGood, settleFriday, startShopDay, stockOf, townBuy, yearEndCount,
  MAIN_QUESTS, QUEST_MIN_DAYS, checkMainQuest, dayIndex, deliverOrder, questDue, repayDebt,
  TUTORIAL_DATES, addStock, tripDays, inTutorial, tutorialDay,
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
  it('starts on a Saturday morning with no money, one empty slot and the uncle\'s dates', () => {
    const s = fresh();
    expect(s).toMatchObject({ phase: 'morning', season: 1, week: 1, dow: 0, cash: 0 });
    expect(s.slots).toEqual([{ good: null, qty: 0, cost: 0 }]);
    expect(stockOf(s, 'dates')).toBe(TUTORIAL_DATES);
    expect(inTutorial(s)).toBe(true);
  });

  it('sells out the uncle\'s dates on the tutorial day, for the first capital', () => {
    const s = fresh();
    tutorialDay(s);
    expect(stockOf(s, 'dates')).toBe(0);
    expect(s.cash).toBeGreaterThanOrEqual(TUTORIAL_DATES * 5);
    expect(inTutorial(s)).toBe(false);
    expect(s.dow).toBe(1);
  });
});

describe('a market day', () => {
  it('sells from the slots, writes reactions in the notebook and moves to the next day', () => {
    const s = fresh();
    setSlotGood(s, 0, 'dates');
    setPrice(s, 'dates', 6);
    startShopDay(s);
    new DaySim(s).runToEnd();
    expect(s.day.sold).toBeGreaterThan(0);
    expect(s.cash).toBeGreaterThan(0);
    expect(s.notebook.dates['6']).toBeDefined();
    expect(notebookRange(s, 'dates').good ?? notebookRange(s, 'dates').tooHigh).toBe(6);
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
    addStock(s, 'salt', 2, 2);
    setSlotGood(s, 0, 'dates');
    expect(s.slots[0]).toMatchObject({ good: 'dates', qty: 5 });
    s.slots[0]!.qty = 0;
    expect(restockSlot(s, 0)).toBe(5);
    setSlotGood(s, 0, 'salt');
    expect(stockOf(s, 'dates')).toBe(5);
    expect(s.store.dates.qty).toBe(5);
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
    expect(canSetOut(s, 'groves', 4)).toBeNull();
    expect(canSetOut(s, 'ubulla', 4)).toBeNull();
    s.dow = FRIDAY;
    expect(canSetOut(s, 'groves', 4)).toBe('friday');
  });

  it('goes to town and back, filling the storeroom and using the days', () => {
    const s = fresh(3);
    s.cash = 40;
    expect(setOut(s, 'groves', 5)).toBe(true);
    expect(s.trip!.layers).toHaveLength(TOWNS.groves.stops);
    playTrip(s);
    expect(s.trip).toBeNull();
    expect(s.dow).toBe(tripDays('groves'));
    expect(stockOf(s, 'dates')).toBeGreaterThan(TUTORIAL_DATES);
    expect(s.counters.trips).toBe(1);
  });

  it('every event has 2 or 3 choices and one that is always open', () => {
    expect(EVENTS).toHaveLength(33);
    expect(new Set(EVENTS.map(e => e.id)).size).toBe(33);
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
    s.dow = FRIDAY; s.phase = 'friday'; s.cash = 20;
    expect(settleFriday(s).rentPaid).toBe(5);
    expect(s.cash).toBe(15);

    const t = fresh();
    t.dow = FRIDAY; t.cash = 1;
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
    expect(s.slots).toHaveLength(2);
    expect(s.cash).toBe(85);
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
    expect(yearEndCount(s).zakatableTotal).toBe(before - 25);
    expect(yearEndCount(s).zakat).toBeCloseTo(yearEndCount(s).zakatableTotal / 40);
  });
});

describe('quests', () => {
  it('side quests are due on a Friday at least a week away, and can be delivered early', () => {
    const s = fresh();
    s.dow = 4;
    const due = questDue(s)!;
    expect(due % 7).toBe(FRIDAY);
    expect(due - dayIndex(s)).toBeGreaterThanOrEqual(QUEST_MIN_DAYS);
    s.orders.push({ from: 'imam', good: 'dates', qty: 4, price: 6, due, written: true, amanah: 4, helps: true });
    const cash = s.cash;
    expect(deliverOrder(s, 0)).toBe('filled');
    expect(s.cash).toBe(cash + 24);
    expect(s.orders).toHaveLength(0);
    expect(s.counters.helped).toBe(1);
  });

  it('cannot deliver early without the goods, and a missed written order costs amanah on its Friday', () => {
    const s = fresh();
    s.orders.push({ from: 'purser', good: 'fish', qty: 6, price: 12, due: dayIndex(s) + (FRIDAY - s.dow), written: true, amanah: 2 });
    expect(deliverOrder(s, 0)).toBeNull();
    while (s.dow !== FRIDAY) advanceDay(s);
    const amanah = s.amanah;
    const r = settleFriday(s);
    expect(r.ordersFilled[0]!.result).toBe('short');
    expect(s.amanah).toBeLessThan(amanah);
    expect(s.orders).toHaveLength(0);
  });

  it('debts can be repaid early', () => {
    const s = fresh();
    s.cash = 50;
    s.debts.push({ who: 'friend', amount: 40, due: questDue(s, 14)! });
    const cash = s.cash;
    expect(repayDebt(s, 0)).toBe(true);
    expect(s.cash).toBe(cash - 40);
    expect(s.debts).toHaveLength(0);
  });

  it('the main quest pays once, as soon as it is done', () => {
    const s = fresh();
    for (const g of MAIN_QUESTS[1].objectives) s.counters[g.counter] = g.target;
    const cash = s.cash;
    expect(checkMainQuest(s)).toBe(MAIN_QUESTS[1].reward);
    expect(checkMainQuest(s)).toBe(0);
    expect(s.cash).toBe(cash + MAIN_QUESTS[1].reward);
  });
});
