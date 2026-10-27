// One shop day: who comes, when, what they look at, and what they do (gdd 4.3 to 4.6).
// The day runs on sim time; the renderer only animates what this reports.

import { DAY_SECONDS, STALLS, type GoodId } from './data';
import { amanahEffect, visit, type Reaction, type Sensitivity } from './customers';
import { absDay, changeAmanah, marketToday, recordSale, stockOf, withRng, type GameState } from './game';
import type { Rng } from './rng';

export type CustomerType =
  | 'household' | 'child' | 'labourer' | 'craftsman' | 'scholar' | 'bedouin' | 'sailor' | 'harithBoy' | 'regular';

export type DayPhase = 'morning' | 'midday' | 'afternoon' | 'dusk';

// gdd 4.3
export const PHASES: ReadonlyArray<{ id: DayPhase; from: number; to: number }> = [
  { id: 'morning', from: 0, to: 12 },
  { id: 'midday', from: 12, to: 22 },
  { id: 'afternoon', from: 22, to: 34 },
  { id: 'dusk', from: 34, to: DAY_SECONDS },
];

export function phaseAt(t: number): DayPhase {
  return (PHASES.find(p => t < p.to) ?? PHASES[PHASES.length - 1]!).id;
}

interface TypeInfo {
  phases: readonly DayPhase[] | 'any';
  prefers: readonly GoodId[] | 'cheapest' | 'any';
  sensitivity: Sensitivity;
  /** Relative weight when picking who comes at a given time. */
  weight: number;
}

// gdd 4.4
export const CUSTOMER_TYPES: Readonly<Record<CustomerType, TypeInfo>> = {
  household: { phases: ['morning'], prefers: ['dates', 'pottery'], sensitivity: 'normal', weight: 3 },
  child: { phases: ['morning'], prefers: ['dates'], sensitivity: 'high', weight: 1.5 },
  labourer: { phases: ['midday'], prefers: 'cheapest', sensitivity: 'high', weight: 3 },
  craftsman: { phases: ['afternoon'], prefers: ['leather', 'cloth'], sensitivity: 'normal', weight: 2 },
  scholar: { phases: ['afternoon'], prefers: ['cloth'], sensitivity: 'low', weight: 1.2 },
  bedouin: { phases: ['afternoon'], prefers: ['pottery'], sensitivity: 'normal', weight: 1.2 },
  sailor: { phases: ['dusk'], prefers: ['spices'], sensitivity: 'low', weight: 3 },
  harithBoy: { phases: 'any', prefers: 'any', sensitivity: 'normal', weight: 0 },
  regular: { phases: 'any', prefers: 'any', sensitivity: 'normal', weight: 0 },
};

/** Seconds to walk from the crowd to the stall, to look at the price, and to walk away. */
export const WALK_IN = 2.4;
export const LOOK = 0.8;
export const WALK_OUT = 2.2;
/** Customers stop arriving this long before close, so the last ones are served by closing (gdd 4.3). */
const LAST_ARRIVAL = DAY_SECONDS - 5;
/** From week 1 day 3, some date and spice buyers ask by weight (gdd 4.5). */
const SCALE_CHANCE = 0.35;
const SCALE_FROM_DAY = 3;

export type CustomerState = 'waiting' | 'in' | 'look' | 'scale' | 'out' | 'gone';

export interface Customer {
  id: number;
  type: CustomerType;
  arriveAt: number;
  /** Shelf index the customer walks to, or null to walk past the stall. */
  shelf: number | null;
  state: CustomerState;
  /** Seconds since the current state started. */
  t: number;
  reaction: Reaction | null;
  bought: number;
  revenue: number;
  credit: boolean;
  /** Set while the customer waits for the player at the scale. */
  scaleGood: GoodId | null;
}

export type DayEvent =
  | { kind: 'arrive'; customer: Customer }
  | { kind: 'decide'; customer: Customer; amanahDelta: number }
  | { kind: 'scale'; customer: Customer }
  | { kind: 'scaleResult'; customer: Customer; result: ScaleResult }
  | { kind: 'toldOthers'; customer: Customer }
  | { kind: 'closed' };

export type ScaleResult = 'fair' | 'short' | 'over';

export class DaySim {
  readonly customers: Customer[] = [];
  /** Seconds into the day. */
  t: number;
  /** Stall opens at midday after an inspector visit (gdd 4.6). */
  readonly opensAt: number;
  closed = false;
  private nextId = 1;

  constructor(private readonly s: GameState) {
    this.opensAt = s.flags.inspectorToday ? 12 : 0;
    this.t = this.opensAt;
    withRng(s, rng => this.schedule(rng));
  }

  /** True while a customer is at the scale; the day clock waits for the player. */
  get paused(): boolean {
    return this.customers.some(c => c.state === 'scale');
  }

  get atScale(): Customer | undefined {
    return this.customers.find(c => c.state === 'scale');
  }

  private schedule(rng: Rng) {
    const s = this.s;
    const stall = STALLS[s.stall];
    const effect = amanahEffect(s.amanah);
    let count = rng.int(stall.customers[0], stall.customers[1]) + effect.extraCustomers;
    if (s.flags.inspectorToday) count = Math.round(count * (DAY_SECONDS - this.opensAt) / DAY_SECONDS);
    let regulars = effect.regularCustomer ? 1 : 0;
    if (s.week === 3 && s.day > 2 && s.flags.harith === 'fair') regulars += 1;
    const span = LAST_ARRIVAL - this.opensAt;
    for (let i = 0; i < count; i++) {
      const at = this.opensAt + ((i + rng.next() * 0.8) / count) * span;
      this.add(this.pickType(rng, at), at);
    }
    for (let i = 0; i < regulars; i++) this.add('regular', this.opensAt + rng.next() * span);
    if (rng.chance(0.35)) this.add('harithBoy', this.opensAt + rng.next() * span);
    this.customers.sort((a, b) => a.arriveAt - b.arriveAt);
  }

  private pickType(rng: Rng, at: number): CustomerType {
    const phase = phaseAt(at);
    const pool = (Object.keys(CUSTOMER_TYPES) as CustomerType[])
      .filter(k => { const p = CUSTOMER_TYPES[k].phases; return CUSTOMER_TYPES[k].weight > 0 && p !== 'any' && p.includes(phase); });
    const total = pool.reduce((a, k) => a + CUSTOMER_TYPES[k].weight, 0);
    let r = rng.next() * total;
    for (const k of pool) { r -= CUSTOMER_TYPES[k].weight; if (r <= 0) return k; }
    return pool[0] ?? 'household';
  }

  private add(type: CustomerType, arriveAt: number) {
    this.customers.push({
      id: this.nextId++, type, arriveAt, shelf: null, state: 'waiting', t: 0,
      reaction: null, bought: 0, revenue: 0, credit: false, scaleGood: null,
    });
  }

  /** Which shelf a customer heads for, by what they want and what is on the shelves now. */
  private chooseShelf(rng: Rng, c: Customer): number | null {
    const s = this.s;
    const stocked = s.shelves.map((sh, i) => ({ sh, i })).filter(x => x.sh.good && stockOf(s, x.sh.good) > 0);
    if (!stocked.length) return null;
    const pref = CUSTOMER_TYPES[c.type].prefers;
    if (c.type === 'harithBoy') return rng.pick(stocked).i;
    if (pref === 'cheapest') return stocked.sort((a, b) => a.sh.price - b.sh.price)[0]!.i;
    if (pref !== 'any') {
      const wanted = stocked.filter(x => pref.includes(x.sh.good!));
      if (wanted.length) return rng.pick(wanted).i;
      return rng.chance(0.4) ? rng.pick(stocked).i : null;
    }
    return rng.pick(stocked).i;
  }

  /** Advances the day by dt seconds of sim time. Returns what happened, in order. */
  step(dt: number): DayEvent[] {
    const events: DayEvent[] = [];
    if (this.closed) return events;
    if (!this.paused) this.t += dt;
    withRng(this.s, rng => {
      for (const c of this.customers) {
        if (c.state === 'scale') continue;
        if (c.state === 'waiting') {
          if (this.t < c.arriveAt) continue;
          c.shelf = this.chooseShelf(rng, c);
          c.state = 'in'; c.t = 0;
          events.push({ kind: 'arrive', customer: c });
          continue;
        }
        c.t += dt;
        if (c.state === 'in' && c.t >= WALK_IN) {
          if (c.shelf === null) { c.state = 'out'; c.t = 0; continue; }
          c.state = 'look'; c.t = 0;
        } else if (c.state === 'look' && c.t >= LOOK && c.reaction === null) {
          this.decide(rng, c, events);
        } else if (c.state === 'look' && c.t >= LOOK + 1.2) {
          c.state = 'out'; c.t = 0;
        } else if (c.state === 'out' && c.t >= WALK_OUT) {
          c.state = 'gone';
        }
      }
    });
    if (this.t >= DAY_SECONDS && this.customers.every(c => c.state === 'gone' || (c.state === 'waiting'))) {
      this.closed = true;
      events.push({ kind: 'closed' });
    }
    return events;
  }

  private decide(rng: Rng, c: Customer, events: DayEvent[]) {
    const s = this.s;
    const shelf = s.shelves[c.shelf!];
    const good = shelf?.good;
    if (!shelf || !good || stockOf(s, good) === 0) { c.reaction = 'unsure'; c.state = 'out'; c.t = 0; return; }
    const market = marketToday(s, good);
    if (c.type === 'harithBoy') {
      // Checks your prices, never buys (gdd 4.4).
      c.reaction = shelf.price / market > 1.1 ? 'unsure' : 'happy';
      events.push({ kind: 'decide', customer: c, amanahDelta: 0 });
      return;
    }
    if (good === 'dates' && s.week === 3 && s.day === 2 && s.flags.harith === 'hold') {
      // Your dates are held back for tomorrow's price.
      c.reaction = 'unsure'; c.state = 'out'; c.t = 0;
      events.push({ kind: 'decide', customer: c, amanahDelta: 0 });
      return;
    }
    const v = visit(rng, shelf.price, market, stockOf(s, good), CUSTOMER_TYPES[c.type].sensitivity);
    c.reaction = v.reaction;
    if (v.bought > 0 && (good === 'dates' || good === 'spices') && absDay(s.week, s.day) >= SCALE_FROM_DAY && rng.chance(SCALE_CHANCE)) {
      c.state = 'scale'; c.scaleGood = good; c.bought = v.bought;
      events.push({ kind: 'scale', customer: c });
      return;
    }
    // A scholar may take cloth on credit, to pay at year end (gdd 4.4, 6.1 step 4).
    c.credit = c.type === 'scholar' && good === 'cloth' && v.bought > 0 && rng.chance(0.4);
    this.settle(c, good, v.bought, v.amanahDelta);
    if (v.reaction === 'angry') this.tellOthers(c, events);
    events.push({ kind: 'decide', customer: c, amanahDelta: v.amanahDelta });
  }

  private settle(c: Customer, good: GoodId, bought: number, amanahDelta: number) {
    const s = this.s;
    const price = s.shelves[c.shelf!]!.price;
    if (bought > 0) recordSale(s, good, bought, price, c.credit); else s.dayStats.walked += 1;
    c.bought = bought;
    c.revenue = bought * price;
    changeAmanah(s, amanahDelta);
  }

  /** An angry customer tells others: the next one waiting does not come (gdd 4.4). */
  private tellOthers(c: Customer, events: DayEvent[]) {
    const next = this.customers.find(x => x.state === 'waiting' && x.type !== 'regular');
    if (next) { next.state = 'gone'; events.push({ kind: 'toldOthers', customer: c }); }
  }

  /**
   * The player let go of the scale. `fill` is the weight given as a share of what was asked for:
   * within 10% is fair, short costs amanah, over gives stock away (gdd 4.5).
   */
  resolveScale(fill: number): DayEvent[] {
    const c = this.atScale;
    if (!c || !c.scaleGood) return [];
    const s = this.s;
    const result: ScaleResult = fill < 0.9 ? 'short' : fill > 1.1 ? 'over' : 'fair';
    const base = c.reaction === 'happy' ? c.bought : c.reaction === 'unsure' ? -2 * c.bought : 0;
    let delta = base;
    if (result === 'short') { delta += -10; s.weekStats.shortWeights += 1; }
    if (result === 'over') delta += 3;
    this.settle(c, c.scaleGood, c.bought, delta);
    if (result === 'over') {
      // The extra weight is stock given away: one more unit leaves the storeroom unpaid.
      if (stockOf(s, c.scaleGood) > 0) { recordGiveaway(s, c.scaleGood); }
    }
    c.state = 'look'; c.t = LOOK + 0.4; c.scaleGood = null;
    return [{ kind: 'scaleResult', customer: c, result }];
  }

  /** Runs the rest of the day with no player: scales are weighed fairly. For tests and balance runs. */
  runToEnd(stepSeconds = 0.1): DayEvent[] {
    const all: DayEvent[] = [];
    for (let i = 0; i < 100000 && !this.closed; i++) {
      if (this.paused) all.push(...this.resolveScale(1));
      all.push(...this.step(stepSeconds));
    }
    return all;
  }
}

function recordGiveaway(s: GameState, good: GoodId) {
  // Lost stock is written off at landed cost, like spoilage.
  const lot = s.lots.filter(l => l.good === good && l.qty > 0).sort((a, b) => a.boughtDay - b.boughtDay)[0];
  if (!lot) return;
  lot.qty -= 1;
  s.weekStats.writtenOff += lot.landedEach;
  s.lots = s.lots.filter(l => l.qty > 0);
}
