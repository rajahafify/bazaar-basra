import { describe, expect, it } from 'vitest';
import { CartGrid, createRng, footprint, weekendLedger } from '../index';

describe('cart grid (gdd 3.4)', () => {
  it('rejects goods outside the grid or overlapping', () => {
    const g = new CartGrid('handcart'); // 4 x 3
    expect(g.place({ good: 'cloth', col: 0, row: 0, rotated: false })).toBeNull(); // 1 x 3, fills column 0
    expect(g.place({ good: 'dates', col: 0, row: 1, rotated: false })).toBe('overlap');
    expect(g.place({ good: 'cloth', col: 2, row: 0, rotated: true })).toBe('out_of_grid'); // 3 x 1 from col 2
    expect(g.place({ good: 'cloth', col: 1, row: 0, rotated: true })).toBeNull();
    expect(g.usedCells()).toBe(6);
  });

  it('swaps width and height when rotated', () => {
    expect(footprint({ good: 'leather', col: 0, row: 0, rotated: false })).toEqual([[0, 0], [1, 0]]);
    expect(footprint({ good: 'leather', col: 0, row: 0, rotated: true })).toEqual([[0, 0], [0, 1]]);
  });

  it('pads a jar that shares an edge with cloth or straw, not a corner', () => {
    const g = new CartGrid('handcart');
    g.place({ good: 'pottery', col: 0, row: 0, rotated: false }); // cells (0..1, 0..1)
    g.place({ good: 'straw', col: 2, row: 2, rotated: false }); // corner only
    expect(g.isPadded(0)).toBe(false);
    g.place({ good: 'straw', col: 2, row: 1, rotated: false }); // shares an edge
    expect(g.isPadded(0)).toBe(true);
  });

  it('never breaks padded jars and breaks about 1 in 4 unpadded ones', () => {
    const rng = createRng(7);
    let broken = 0;
    const trips = 4000;
    for (let i = 0; i < trips; i++) {
      const g = new CartGrid('handcart');
      g.place({ good: 'pottery', col: 0, row: 0, rotated: false });
      g.place({ good: 'pottery', col: 2, row: 0, rotated: false });
      g.place({ good: 'straw', col: 3, row: 2, rotated: false }); // pads the second jar only
      const lost = g.rideHome(rng);
      expect(lost.every(p => p.col === 0)).toBe(true);
      broken += lost.length;
    }
    expect(broken / trips).toBeGreaterThan(0.22);
    expect(broken / trips).toBeLessThan(0.28);
  });

  it('counts empty cells as wasted hire', () => {
    const l = weekendLedger('donkey', 1, [{ good: 'spices', quantity: 5 }]);
    expect(l.cellsWasted).toBe(15);
    expect(l.wastedHire).toBe(9);
  });

  it('refuses purchases that cannot fit in the cart', () => {
    expect(() => weekendLedger('handcart', 1, [{ good: 'cloth', quantity: 5 }])).toThrow();
  });
});
