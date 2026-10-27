// One market day, Moonlighter style: customers come in, each wants a good, looks at its slot,
// reacts to the price and buys or walks off. Slots can be restocked while the shop is open.
// The day runs on sim time; the renderer only animates what this reports.

import { DAY_SECONDS, GOODS, GOOD_IDS, type GoodId } from './data';
import { visit, type Reaction, type Sensitivity } from './customers';
import { changeAmanah, customersToday, fairToday, noteReaction, noteWanted, recordSale, withRng, type GameState } from './game';
import type { Rng } from './rng';

export type CustomerType = 'household' | 'child' | 'labourer' | 'craftsman' | 'scholar' | 'bedouin' | 'sailor' | 'regular';

interface TypeInfo {
  wants: readonly GoodId[];
  sensitivity: Sensitivity;
  weight: number;
}

export const CUSTOMER_TYPES: Readonly<Record<CustomerType, TypeInfo>> = {
  household: { wants: ['dates', 'vinegar', 'salt', 'fish'], sensitivity: 'normal', weight: 3 },
  child: { wants: ['dates'], sensitivity: 'high', weight: 1 },
  labourer: { wants: ['dates', 'fish', 'salt'], sensitivity: 'high', weight: 2.5 },
  craftsman: { wants: ['beef', 'vinegar', 'salt'], sensitivity: 'normal', weight: 1.5 },
  scholar: { wants: ['saffron', 'cardamom', 'dates'], sensitivity: 'low', weight: 1 },
  bedouin: { wants: ['dates', 'salt', 'beef'], sensitivity: 'normal', weight: 1.2 },
  sailor: { wants: ['fish', 'beef', 'cardamom'], sensitivity: 'low', weight: 1.5 },
  regular: { wants: GOOD_IDS, sensitivity: 'low', weight: 0 },
};

/** Seconds to walk from the crowd to the stall, to look at the price, and to walk away. */
export const WALK_IN = 2.4;
export const LOOK = 0.9;
export const WALK_OUT = 2.2;
const LAST_ARRIVAL = DAY_SECONDS - 5;

export type CustomerState = 'waiting' | 'in' | 'look' | 'out' | 'gone';

export interface Customer {
  id: number;
  type: CustomerType;
  want: GoodId;
  arriveAt: number;
  /** Slot the customer walks to, or null to walk past the stall. */
  shelf: number | null;
  state: CustomerState;
  t: number;
  reaction: Reaction | null;
  bought: number;
  revenue: number;
  /** Asked for a good that was not on any slot. */
  asked: boolean;
}

export type DayEvent =
  | { kind: 'arrive'; customer: Customer }
  | { kind: 'decide'; customer: Customer }
  | { kind: 'asked'; customer: Customer }
  | { kind: 'empty'; slot: number }
  | { kind: 'closed' };

export class DaySim {
  readonly customers: Customer[] = [];
  t = 0;
  closed = false;
  private nextId = 1;

  constructor(private readonly s: GameState) {
    withRng(s, rng => this.schedule(rng));
  }

  private schedule(rng: Rng) {
    const s = this.s;
    const count = Math.max(2, customersToday(s) + rng.int(-1, 1));
    for (let i = 0; i < count; i++) {
      const at = ((i + rng.next() * 0.8) / count) * LAST_ARRIVAL;
      const type = i < s.regulars ? 'regular' : this.pickType(rng);
      this.add(type, this.pickWant(rng, type), at);
    }
    this.customers.sort((a, b) => a.arriveAt - b.arriveAt);
  }

  private pickType(rng: Rng): CustomerType {
    const pool = (Object.keys(CUSTOMER_TYPES) as CustomerType[]).filter(k => CUSTOMER_TYPES[k].weight > 0);
    let r = rng.next() * pool.reduce((a, k) => a + CUSTOMER_TYPES[k].weight, 0);
    for (const k of pool) { r -= CUSTOMER_TYPES[k].weight; if (r <= 0) return k; }
    return 'household';
  }

  /** What they came for, leaning towards what the season wants. Regulars ask for what you sell. */
  private pickWant(rng: Rng, type: CustomerType): GoodId {
    const s = this.s;
    if (type === 'regular') {
      const onShow = s.slots.filter(sl => sl.good && sl.qty > 0).map(sl => sl.good!);
      if (onShow.length) return rng.pick(onShow);
    }
    const wants = CUSTOMER_TYPES[type].wants;
    let r = rng.next() * wants.reduce((a, g) => a + GOODS[g].season[s.season] * s.demand[g], 0);
    for (const g of wants) { r -= GOODS[g].season[s.season] * s.demand[g]; if (r <= 0) return g; }
    return wants[0]!;
  }

  private add(type: CustomerType, want: GoodId, arriveAt: number) {
    this.customers.push({ id: this.nextId++, type, want, arriveAt, shelf: null, state: 'waiting', t: 0, reaction: null, bought: 0, revenue: 0, asked: false });
  }

  /** The slot with what they want; failing that, a look at something else now and then. */
  private chooseShelf(rng: Rng, c: Customer): number | null {
    const slots = this.s.slots.map((sl, i) => ({ sl, i })).filter(x => x.sl.good && x.sl.qty > 0);
    const match = slots.find(x => x.sl.good === c.want);
    if (match) return match.i;
    c.asked = true;
    if (slots.length && rng.chance(0.3)) return rng.pick(slots).i;
    return null;
  }

  /** Advances the day by dt seconds of sim time. Returns what happened, in order. */
  step(dt: number): DayEvent[] {
    const events: DayEvent[] = [];
    if (this.closed) return events;
    this.t += dt;
    withRng(this.s, rng => {
      for (const c of this.customers) {
        if (c.state === 'gone') continue;
        if (c.state === 'waiting') {
          if (this.t < c.arriveAt) continue;
          c.shelf = this.chooseShelf(rng, c);
          if (c.asked) { noteWanted(this.s, c.want); events.push({ kind: 'asked', customer: c }); }
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
    if (this.t >= DAY_SECONDS && this.customers.every(c => c.state === 'gone' || c.state === 'waiting')) {
      this.closed = true;
      events.push({ kind: 'closed' });
    }
    return events;
  }

  private decide(rng: Rng, c: Customer, events: DayEvent[]) {
    const s = this.s;
    const sl = s.slots[c.shelf!];
    const good = sl?.good;
    if (!sl || !good || sl.qty === 0) { c.reaction = 'unsure'; c.state = 'out'; c.t = 0; s.day.walked += 1; return; }
    const price = s.prices[good];
    // Browsing something they didn't come for: only a bargain tempts them.
    const browsing = good !== c.want;
    const v = visit(rng, price, fairToday(s, good), sl.qty, CUSTOMER_TYPES[c.type].sensitivity);
    c.reaction = v.reaction;
    noteReaction(s, good, price, v.reaction);
    const bought = browsing && v.reaction !== 'delighted' ? 0 : v.bought;
    if (bought > 0) recordSale(s, c.shelf!, bought, price); else s.day.walked += 1;
    c.bought = bought;
    c.revenue = bought * price;
    changeAmanah(s, v.amanahDelta);
    events.push({ kind: 'decide', customer: c });
    if (sl.qty === 0) events.push({ kind: 'empty', slot: c.shelf! });
  }

  /** Runs the rest of the day with no player. For tests and balance runs. */
  runToEnd(stepSeconds = 0.1, onEmpty?: (slot: number) => void): DayEvent[] {
    const all: DayEvent[] = [];
    for (let i = 0; i < 100000 && !this.closed; i++) {
      const ev = this.step(stepSeconds);
      if (onEmpty) for (const e of ev) if (e.kind === 'empty') onEmpty(e.slot);
      all.push(...ev);
    }
    return all;
  }
}
