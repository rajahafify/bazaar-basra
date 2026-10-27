import { describe, expect, it } from 'vitest';
import { FixedClock, STEP } from '../clock';
import { LH, LW, fitStage } from '../stage';

describe('fixed clock', () => {
  it('runs the same sim time at 15 fps as at 60 fps', () => {
    const run = (fps: number) => {
      const c = new FixedClock();
      let steps = 0;
      for (let t = 0; t <= 10_000; t += 1000 / fps) steps += c.tick(t);
      return steps * STEP;
    };
    expect(run(15)).toBeCloseTo(10, 0);
    expect(run(60)).toBeCloseTo(10, 0);
  });

  it('drops long stalls instead of fast-forwarding', () => {
    const c = new FixedClock();
    c.tick(0);
    expect(c.tick(30_000) * STEP).toBeLessThanOrEqual(0.25);
  });
});

describe('stage fit', () => {
  it('keeps the 9:16 frame and fits the narrower side', () => {
    const tall = fitStage(390, 844, 3);
    expect(tall.width).toBe(390);
    expect(tall.height).toBe(Math.floor((390 * LH) / LW));
    expect(tall.dpr).toBe(2);
    const wide = fitStage(1200, 640, 1);
    expect(wide.height).toBe(640);
    expect(wide.width).toBe(360);
  });
});
