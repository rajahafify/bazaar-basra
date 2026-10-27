import { describe, expect, it } from 'vitest';
import { CAREFUL, CARELESS, playYear } from '../bot';
import {
  DaySim, autoPack, buyOne, chooseSource, deserialize, finishPrologue, gridFor, hireCart, leaveSource, newGame,
  rideHome, serialize, startWeek, stockOf,
} from '../index';

describe('a whole year', () => {
  it('plays four weeks to the zakat count for both scripted players', () => {
    for (const st of [CAREFUL, CARELESS]) {
      const r = playYear(st, 3);
      expect(r.weekProfits).toHaveLength(4);
      expect(r.cash).toBeGreaterThanOrEqual(0);
      expect(r.zakatableTotal).toBeGreaterThan(0);
    }
  });

  it('is the same year for the same seed', () => {
    expect(playYear(CAREFUL, 11)).toEqual(playYear(CAREFUL, 11));
  });

  it('gives the careful trader more amanah than the careless one', () => {
    expect(playYear(CAREFUL, 4).amanah).toBeGreaterThan(playYear(CARELESS, 4).amanah);
  });
});

describe('the first weekend', () => {
  it('refunds what was not packed and stocks the storeroom with what was', () => {
    const s = newGame(1);
    finishPrologue(s);
    chooseSource(s, 'groves');
    hireCart(s, 'handcart');
    const cashBefore = s.cash;
    for (let i = 0; i < 10; i++) buyOne(s, 'dates');
    autoPack(s);
    expect(gridFor(s).usedCells()).toBe(12);
    leaveSource(s);
    expect(s.cash).toBe(cashBefore - 6 * 6);
    rideHome(s);
    startWeek(s);
    expect(stockOf(s, 'dates')).toBe(6 + 2); // six bought, two from the uncle
  });

  it('never breaks a jar padded with straw', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = newGame(seed);
      finishPrologue(s);
      chooseSource(s, 'groves');
      hireCart(s, 'handcart');
      buyOne(s, 'pottery'); buyOne(s, 'straw');
      autoPack(s);
      leaveSource(s);
      rideHome(s);
      expect(s.weekend.ledger!.broken).toHaveLength(0);
    }
  });
});

describe('a shop day', () => {
  it('ends after 45 seconds with every customer gone', () => {
    const s = newGame(2);
    finishPrologue(s);
    chooseSource(s, 'port');
    hireCart(s, 'handcart');
    for (let i = 0; i < 4; i++) buyOne(s, 'spices');
    autoPack(s); leaveSource(s); rideHome(s); startWeek(s);
    const day = new DaySim(s);
    day.runToEnd();
    expect(day.closed).toBe(true);
    expect(day.t).toBeGreaterThanOrEqual(45);
    expect(day.customers.every(c => c.state === 'gone' || c.state === 'waiting')).toBe(true);
  });
});

describe('saving', () => {
  it('round-trips the state and rejects junk', () => {
    const s = newGame(9);
    finishPrologue(s);
    expect(deserialize(serialize(s))).toEqual(s);
    expect(deserialize('{nope')).toBeNull();
    expect(deserialize(null)).toBeNull();
  });
});
