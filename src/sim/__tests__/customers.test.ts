import { describe, expect, it } from 'vitest';
import { amanahEffect, clampAmanah, createRng, reaction, visit } from '../index';

describe('reaction to price (gdd 4.4)', () => {
  it('uses the normal bands against market price', () => {
    expect(reaction(7, 10)).toBe('delighted');
    expect(reaction(8, 10)).toBe('happy');
    expect(reaction(11, 10)).toBe('happy');
    expect(reaction(12, 10)).toBe('unsure');
    expect(reaction(13, 10)).toBe('unsure');
    expect(reaction(14, 10)).toBe('angry');
  });

  it('shifts every band up 20 points for low-sensitivity customers', () => {
    expect(reaction(65, 50, 'low')).toBe('happy'); // 130%
    expect(reaction(75, 50, 'low')).toBe('unsure'); // 150%
    expect(reaction(76, 50, 'low')).toBe('angry');
  });

  it('treats anything over market as unsure for high-sensitivity customers', () => {
    expect(reaction(10, 10, 'high')).toBe('happy');
    expect(reaction(11, 10, 'high')).toBe('unsure');
  });
});

describe('a customer visit', () => {
  it('buys one when happy and raises amanah by 1', () => {
    const v = visit(createRng(1), 10, 10, 5);
    expect(v).toMatchObject({ reaction: 'happy', bought: 1, revenue: 10, amanahDelta: 1, walkedOff: false });
  });

  it('walks off angry and costs 5 amanah', () => {
    const v = visit(createRng(1), 20, 10, 5);
    expect(v).toMatchObject({ reaction: 'angry', bought: 0, amanahDelta: -5, walkedOff: true });
  });

  it('cannot buy more than the stock left', () => {
    for (let seed = 0; seed < 50; seed++) expect(visit(createRng(seed), 5, 10, 1).bought).toBeLessThanOrEqual(1);
  });

  it('is reproducible from a seed', () => {
    const run = (seed: number) => Array.from({ length: 20 }, (_, i) => visit(createRng(seed + i), 12, 10, 3).bought);
    expect(run(42)).toEqual(run(42));
  });
});

describe('amanah (gdd 4.6)', () => {
  it('clamps to 0..100', () => {
    expect(clampAmanah(-4)).toBe(0);
    expect(clampAmanah(130)).toBe(100);
  });

  it('maps bands to effects', () => {
    expect(amanahEffect(80).extraCustomers).toBe(2);
    expect(amanahEffect(60).extraCustomers).toBe(0);
    expect(amanahEffect(59).extraCustomers).toBe(-1);
    expect(amanahEffect(39).inspectorVisits).toBe(true);
  });
});
