import { describe, expect, it } from 'vitest';
import { amanahCustomers, clampAmanah, createRng, reaction, visit } from '../index';

describe('reaction to price', () => {
  it('uses the normal bands against the fair price', () => {
    expect(reaction(8, 10)).toBe('delighted');
    expect(reaction(9, 10)).toBe('happy');
    expect(reaction(10, 10)).toBe('happy');
    expect(reaction(12, 10)).toBe('unsure');
    expect(reaction(13, 10)).toBe('angry');
  });

  it('lets low-sensitivity customers pay more and high-sensitivity ones less', () => {
    expect(reaction(13, 10, 'low')).toBe('unsure');
    expect(reaction(11, 10, 'high')).toBe('unsure');
    expect(reaction(12, 10, 'high')).toBe('angry');
  });
});

describe('a customer visit', () => {
  it('buys one when happy and raises amanah a little', () => {
    expect(visit(createRng(1), 10, 10, 5)).toMatchObject({ reaction: 'happy', bought: 1, amanahDelta: 0.5 });
  });

  it('leaves without buying when angry, and amanah drops', () => {
    expect(visit(createRng(1), 20, 10, 5)).toMatchObject({ reaction: 'angry', bought: 0, amanahDelta: -1.5 });
  });

  it('never buys more than is on the slot', () => {
    for (let seed = 1; seed < 20; seed++) expect(visit(createRng(seed), 5, 10, 1).bought).toBeLessThanOrEqual(1);
  });
});

describe('amanah', () => {
  it('stays between 0 and 100 and brings customers when high', () => {
    expect(clampAmanah(130)).toBe(100);
    expect(clampAmanah(-5)).toBe(0);
    expect(amanahCustomers(85)).toBeGreaterThan(amanahCustomers(50));
    expect(amanahCustomers(10)).toBeLessThan(0);
  });
});
