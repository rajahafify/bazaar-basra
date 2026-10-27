// The worked examples in docs/gdd.md. If one of these fails, either the code or the
// design doc is wrong, and the two must be brought back in line.

import { describe, expect, it } from 'vitest';
import { GOODS, NISAB, OPENING_CASH, marketPrice, weekendLedger, weekLedger, zakatCount } from '../index';

describe('gdd 2.3 opening position', () => {
  it('starts just over the nisab: 160 cash plus 2 date baskets and 1 cloth roll at market', () => {
    const stock = 2 * marketPrice('dates', 1) + marketPrice('cloth', 1);
    expect(stock).toBe(52);
    expect(OPENING_CASH + stock).toBe(212);
    expect(OPENING_CASH + stock).toBeGreaterThan(NISAB);
  });
});

describe('gdd 3.5 weekend costing ledger', () => {
  const ledger = weekendLedger('handcart', 1, [
    { good: 'dates', quantity: 4 },
    { good: 'pottery', quantity: 1 },
  ]);

  it('fills all 12 cells of the handcart', () => {
    expect(ledger.cellsUsed).toBe(12);
    expect(ledger.cellsWasted).toBe(0);
    expect(ledger.wastedHire).toBe(0);
  });

  it('costs 32 in goods plus 6 hire, 38 in total', () => {
    expect(ledger.goodsCost).toBe(32);
    expect(ledger.hire).toBe(6);
    expect(ledger.total).toBe(38);
  });

  it('lands a date basket at 7 and a jar at 10', () => {
    const dates = ledger.lines.find(l => l.good === 'dates')!;
    const jar = ledger.lines.find(l => l.good === 'pottery')!;
    expect(dates.hireShareEach).toBe(1);
    expect(dates.landedEach).toBe(7);
    expect(jar.hireShareEach).toBe(2);
    expect(jar.landedEach).toBe(10);
  });
});

describe('gdd 5 weekly ledger, week 1', () => {
  it('makes 7 dirham profit and ends with 167 cash', () => {
    const revenue = 4 * GOODS.dates.market![1] + GOODS.pottery.market![1];
    expect(revenue).toBe(55);
    const week = weekLedger({ cashAtStart: 160, revenue, costOfGoodsSold: 38, stockBought: 38, rent: 10, writtenOff: 0 });
    expect(week.profit).toBe(7);
    expect(week.cashAtEnd).toBe(167);
  });
});

describe('gdd 6.3 zakat worked example', () => {
  it('counts 500 zakatable and 12.5 zakat due', () => {
    const z = zakatCount({ cash: 420, stockAtMarket: 90, owedToYou: 20, debtsDue: 30 });
    expect(z.zakatableTotal).toBe(500);
    expect(z.aboveNisab).toBe(true);
    expect(z.zakat).toBe(12.5);
  });

  it('owes nothing under the nisab (gdd 8)', () => {
    const z = zakatCount({ cash: 150, stockAtMarket: 40, owedToYou: 0, debtsDue: 0 });
    expect(z.aboveNisab).toBe(false);
    expect(z.zakat).toBe(0);
  });

  it('owes zakat at exactly the nisab', () => {
    expect(zakatCount({ cash: 200, stockAtMarket: 0, owedToYou: 0, debtsDue: 0 }).zakat).toBe(5);
  });
});
