import { describe, expect, it } from 'vitest';
import { CAREFUL, CARELESS, playYear } from '../bot';

describe('balance', () => {
  it('rewards the careful trader over the greedy one', () => {
    const careful = [1, 2, 3, 4, 5, 6].map(seed => playYear(CAREFUL, seed));
    const greedy = [1, 2, 3, 4, 5, 6].map(seed => playYear(CARELESS, seed));
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    expect(median(careful.map(r => r.profit))).toBeGreaterThan(median(greedy.map(r => r.profit)) + 500);
    expect(careful.filter(r => r.broke).length).toBeLessThanOrEqual(1);
    expect(median(careful.map(r => r.amanah))).toBeGreaterThan(70);
  });
});
