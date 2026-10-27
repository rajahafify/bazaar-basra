// Fixed-step game clock. The simulation advances in equal steps whatever the frame rate,
// so a 45-second shop day lasts 45 seconds on a slow phone too.

export const STEP = 1 / 60;
/** After a long stall (app in background), drop time rather than fast-forward the day. */
const MAX_CATCH_UP = 0.25;

export class FixedClock {
  private acc = 0;
  private last: number | null = null;

  /** Feeds a frame timestamp in ms; returns how many fixed steps to run. */
  tick(nowMs: number): number {
    if (this.last === null) { this.last = nowMs; return 0; }
    this.acc += Math.min(MAX_CATCH_UP, (nowMs - this.last) / 1000);
    this.last = nowMs;
    const steps = Math.floor(this.acc / STEP);
    this.acc -= steps * STEP;
    return steps;
  }

  /** Call when the app returns from the background so the gap is not counted. */
  reset(): void {
    this.last = null;
    this.acc = 0;
  }
}
