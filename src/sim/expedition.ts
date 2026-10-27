// Expeditions: a short run across a branching map of stops to one town and back, like a sector
// in FTL. Each stop takes one supply and holds an event with a few choices. A trip takes a set
// number of days; choices on the road cost money, supplies or goods, never time.

import {
  FRIDAY, GOODS, GOOD_IDS, RARE_CHANCE, SUPPLY_PRICE, TOWNS, TOWN_SUPPLY_PRICE,
  type GoodId, type TownId,
} from './data';
import { EVENTS, eventById, type EventCtx, type NodeKind } from './events';
import {
  LAST_FRIDAY, addStock, advanceDay, caravanSpace, changeAmanah, dayIndex, daysBeforeFriday, questDue, supplyCap, withRng,
  type GameState, type Stock,
} from './game';
import type { Rng } from './rng';

export interface MapNode {
  kind: NodeKind;
  event: string;
  /** Without a guide, one stop at each step shows only a question mark. */
  hidden: boolean;
}

export type Change =
  | { kind: 'cash'; delta: number }
  | { kind: 'supplies'; delta: number }
  | { kind: 'amanah'; delta: number }
  | { kind: 'good'; good: GoodId; delta: number }
  | { kind: 'quest' };

export interface Outcome {
  option: string;
  /** Which outcome text to show, e.g. 'a' or 'aLost'. */
  text: string;
  vars: Record<string, string | number>;
  changes: Change[];
}

export interface TownOffer {
  good: GoodId;
  price: number;
  left: number;
}

export interface Trip {
  town: TownId;
  leg: 'out' | 'town' | 'back' | 'home';
  layers: MapNode[][];
  /** Stops passed on this leg. */
  step: number;
  /** The pick made at each stop of this leg, for drawing the route. */
  picked: number[];
  cargo: Record<GoodId, Stock>;
  /** Space taken by goods carried for someone else. */
  held: number;
  event: { id: string; outcome: Outcome | null; vars: Record<string, string | number> } | null;
  offers: TownOffer[];
  /** Next stop's double supply cost from an overloaded camel, the caravan pot, a revealed layer. */
  flags: Record<string, number>;
  /** Events seen on this trip, so none repeats. */
  seen: string[];
  log: Array<{ event: string; option: string }>;
}

// ---------- planning ----------

export function townOpen(s: GameState, town: TownId): boolean {
  return s.season >= TOWNS[town].opens;
}

/** Days a trip takes with no delays. */
export function tripDays(town: TownId): number {
  return TOWNS[town].days;
}

/** Days this trip takes. */
export function tripLength(trip: Trip): number {
  return TOWNS[trip.town].days;
}

export type SetOutBlock = 'closed' | 'friday' | 'supplies' | null;

export function canSetOut(s: GameState, town: TownId, supplies: number): SetOutBlock {
  if (!townOpen(s, town)) return 'closed';
  if (tripDays(town) > daysBeforeFriday(s)) return 'friday';
  if (s.supplies + supplies < TOWNS[town].stops * 2) return 'supplies';
  return null;
}

/** Supplies to buy before leaving, so the trip can be finished with one spare. */
export function suggestedSupplies(s: GameState, town: TownId): number {
  return Math.max(0, Math.min(supplyCap(s), TOWNS[town].stops * 2 + 1) - s.supplies);
}

export function buySupplies(s: GameState, n: number, price = SUPPLY_PRICE): number {
  const room = supplyCap(s) - s.supplies;
  const k = Math.max(0, Math.min(n, room, Math.floor(s.cash / price)));
  s.supplies += k;
  s.cash -= k * price;
  s.week_.supplies += k * price;
  return k;
}

export function setOut(s: GameState, town: TownId, supplies: number): boolean {
  if (canSetOut(s, town, supplies) !== null) return false;
  buySupplies(s, supplies);
  if (s.supplies < TOWNS[town].stops * 2) return false;
  const trip: Trip = {
    town, leg: 'out', layers: [], step: 0, picked: [],
    cargo: Object.fromEntries(GOOD_IDS.map(g => [g, { qty: 0, cost: 0 }])) as Record<GoodId, Stock>,
    held: 0, event: null, offers: [], flags: {}, seen: [], log: [],
  };
  s.trip = trip;
  withRng(s, rng => { trip.layers = buildLeg(s, trip, rng, TOWNS[town].stops); });
  s.phase = 'trip';
  s.counters.trips += 1;
  return true;
}

// ---------- the map ----------

const KIND_WEIGHTS: ReadonlyArray<[NodeKind, number]> = [['road', 1], ['trader', 1.3], ['people', 1.1], ['find', 0.6]];

/** Stops to choose from at each step. */
export const STOPS_PER_STEP = 3;

function pickKind(rng: Rng, not: readonly NodeKind[]): NodeKind {
  const pool = KIND_WEIGHTS.filter(([k]) => !not.includes(k));
  let r = rng.next() * pool.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of pool) { r -= w; if (r <= 0) return k; }
  return pool[0]![0];
}

/** An event of this kind that can happen now and has not come up on this trip, least seen first. */
function pickEvent(s: GameState, trip: Trip, rng: Rng, kind: NodeKind, taken: readonly string[]): string | null {
  const ok = EVENTS.filter(e => (e.kind === kind) && !trip.seen.includes(e.id) && !taken.includes(e.id)
    && (e.minSeason ?? 1) <= s.season && (!e.when || e.when(s, trip)));
  if (!ok.length) return null;
  const least = Math.min(...ok.map(e => s.eventsSeen[e.id] ?? 0));
  return rng.pick(ok.filter(e => (s.eventsSeen[e.id] ?? 0) === least)).id;
}

function buildLeg(s: GameState, trip: Trip, rng: Rng, stops: number): MapNode[][] {
  const layers: MapNode[][] = [];
  const taken: string[] = [];
  for (let i = 0; i < stops; i++) {
    const layer: MapNode[] = [];
    for (let j = 0; j < STOPS_PER_STEP; j++) {
      let kind = pickKind(rng, layer.map(n => n.kind));
      let ev = pickEvent(s, trip, rng, kind, taken);
      for (const k of KIND_WEIGHTS.map(([x]) => x)) { if (ev) break; kind = k; ev = pickEvent(s, trip, rng, kind, taken); }
      if (!ev) ev = rng.pick(EVENTS.filter(e => !e.when)).id;
      taken.push(ev);
      layer.push({ kind, event: ev, hidden: false });
    }
    if (!s.upgrades.guide) layer[rng.int(0, STOPS_PER_STEP - 1)]!.hidden = true;
    layers.push(layer);
  }
  return layers;
}

export function cargoUsed(trip: Trip): number {
  return GOOD_IDS.reduce((a, g) => a + trip.cargo[g].qty * GOODS[g].space, 0) + trip.held;
}

export function freeSpace(s: GameState): number {
  return s.trip ? caravanSpace(s) - cargoUsed(s.trip) : caravanSpace(s);
}

/** Choose the next stop. Uses one supply (two after overloading a camel). */
export function chooseNode(s: GameState, i: number): boolean {
  const trip = s.trip;
  if (!trip || trip.event || (trip.leg !== 'out' && trip.leg !== 'back')) return false;
  const node = trip.layers[trip.step]?.[i];
  if (!node) return false;
  trip.picked.push(i);
  const cost = trip.flags.double ? 2 : 1;
  trip.flags.double = 0;
  const notes: Change[] = [];
  withRng(s, rng => {
    if (s.supplies >= cost) s.supplies -= cost;
    else {
      // Out of water: trade goods for it at the stop, or go thirsty and lose amanah with the camel drivers.
      s.supplies = 0;
      const lost = loseRandom(s, trip, rng, 2);
      for (const [good, n] of lost) notes.push({ kind: 'good', good, delta: -n });
      if (!lost.length) changeAmanah(s, -2);
      trip.flags.thirsty = 1;
    }
    // A stop picked before its event could happen gets another of the same kind.
    const def = eventById(node.event);
    if (def.when && !def.when(s, trip)) node.event = pickEvent(s, trip, rng, node.kind, []) ?? 'lostPurse';
    const setup = eventById(node.event).setup;
    trip.event = { id: node.event, outcome: null, vars: setup ? setup(s, rng) : {} };
  });
  trip.seen.push(node.event);
  s.eventsSeen[node.event] = (s.eventsSeen[node.event] ?? 0) + 1;
  if (trip.flags.reveal) { for (const n of trip.layers[trip.step + 1] ?? []) n.hidden = false; trip.flags.reveal = 0; }
  return true;
}

export interface OptionView {
  id: string;
  /** Why the option can't be taken right now, as a string key, or null. */
  blocked: string | null;
}

export function eventOptions(s: GameState): OptionView[] {
  const trip = s.trip;
  if (!trip?.event) return [];
  const def = eventById(trip.event.id);
  return def.options.map(o => ({ id: o.id, blocked: o.need ? o.need(s, trip) : null }));
}

export function chooseOption(s: GameState, optionId: string): Outcome | null {
  const trip = s.trip;
  if (!trip?.event || trip.event.outcome) return null;
  const def = eventById(trip.event.id);
  const opt = def.options.find(o => o.id === optionId);
  if (!opt || (opt.need && opt.need(s, trip))) return null;
  const outcome: Outcome = { option: optionId, text: optionId, vars: {}, changes: [] };
  withRng(s, rng => opt.resolve(makeCtx(s, trip, rng, outcome)));
  trip.event.outcome = outcome;
  trip.log.push({ event: def.id, option: optionId });
  return outcome;
}

/** Done with this stop: on to the next, into town, or home. */
export function finishEvent(s: GameState) {
  const trip = s.trip;
  if (!trip?.event?.outcome) return;
  trip.event = null;
  trip.step += 1;
  if (trip.step < trip.layers.length) return;
  if (trip.leg === 'out') { trip.leg = 'town'; withRng(s, rng => { trip.offers = townOffers(trip.town, rng); }); }
  else if (trip.leg === 'back') trip.leg = 'home';
}

// ---------- the town ----------

function townOffers(town: TownId, rng: Rng): TownOffer[] {
  return TOWNS[town].sells
    .filter(x => !x.rare || rng.chance(RARE_CHANCE))
    .map(x => ({ good: x.good, price: Math.max(1, Math.round(x.price * (0.85 + rng.next() * 0.3))), left: x.rare ? 4 : 40 }));
}

export function townBuy(s: GameState, good: GoodId, qty: number): number {
  const trip = s.trip;
  const offer = trip?.offers.find(o => o.good === good);
  if (!trip || trip.leg !== 'town' || !offer) return 0;
  if (qty < 0) {
    // Change your mind: hand units back at what you paid.
    const n = Math.min(-qty, trip.cargo[good].qty, 40 - offer.left);
    if (n <= 0) return 0;
    const each = trip.cargo[good].cost / trip.cargo[good].qty;
    trip.cargo[good].qty -= n; trip.cargo[good].cost -= each * n;
    s.cash += each * n; s.week_.goodsBought -= each * n; offer.left += n;
    return -n;
  }
  const bySpace = Math.floor(freeSpace(s) / GOODS[good].space);
  const n = Math.max(0, Math.min(qty, offer.left, bySpace, Math.floor(s.cash / offer.price)));
  if (n <= 0) return 0;
  trip.cargo[good].qty += n;
  trip.cargo[good].cost += n * offer.price;
  offer.left -= n;
  s.cash -= n * offer.price;
  s.week_.goodsBought += n * offer.price;
  return n;
}

export function townSupplies(s: GameState, n: number): number {
  return buySupplies(s, n, TOWN_SUPPLY_PRICE);
}

export function leaveTown(s: GameState) {
  const trip = s.trip;
  if (!trip || trip.leg !== 'town') return;
  trip.leg = 'back';
  trip.step = 0;
  trip.picked = [];
  withRng(s, rng => { trip.layers = buildLeg(s, trip, rng, TOWNS[trip.town].stops); });
}

export interface Homecoming {
  days: number;
  unloaded: Array<{ good: GoodId; qty: number }>;
  hitFriday: boolean;
}

/** Unload into the storeroom and move the calendar on by the days spent. */
export function arriveHome(s: GameState): Homecoming | null {
  const trip = s.trip;
  if (!trip || trip.leg !== 'home') return null;
  const unloaded: Homecoming['unloaded'] = [];
  for (const g of GOOD_IDS) {
    const c = trip.cargo[g];
    if (c.qty > 0) { addStock(s, g, c.qty, c.cost / c.qty); unloaded.push({ good: g, qty: c.qty }); }
  }
  if (trip.flags.carrying) {
    s.pending.push({ day: 0, kind: 'regular', key: 'notice.brother', amanah: 3 });
  }
  const days = tripLength(trip);
  s.trip = null;
  let hitFriday = false;
  for (let i = 0; i < days; i++) {
    advanceDay(s);
    if (s.dow === FRIDAY) { hitFriday = true; break; }
  }
  return { days, unloaded, hitFriday };
}

// ---------- event helpers ----------

function loseRandom(s: GameState, trip: Trip, rng: Rng, units: number): Array<[GoodId, number]> {
  const lost = new Map<GoodId, number>();
  for (let i = 0; i < units; i++) {
    const have = GOOD_IDS.filter(g => trip.cargo[g].qty > 0);
    if (!have.length) break;
    const g = rng.pick(have);
    const c = trip.cargo[g];
    c.cost -= c.cost / c.qty; c.qty -= 1;
    lost.set(g, (lost.get(g) ?? 0) + 1);
  }
  if (trip.flags.pot) {
    // The caravan pot pays back what the road took.
    const n = [...lost.values()].reduce((a, b) => a + b, 0);
    s.cash += n * 3;
  }
  return [...lost.entries()];
}

function makeCtx(s: GameState, trip: Trip, rng: Rng, out: Outcome): EventCtx {
  const ctx: EventCtx = {
    s, trip, rng,
    say(text, vars = {}) { out.text = text; Object.assign(out.vars, vars); },
    cash(n) { s.cash += n; if (n !== 0) out.changes.push({ kind: 'cash', delta: n }); },
    supplies(n) { const before = s.supplies; s.supplies = Math.max(0, s.supplies + n); const d = s.supplies - before; if (d) out.changes.push({ kind: 'supplies', delta: d }); },
    amanah(n) { changeAmanah(s, n); if (n) out.changes.push({ kind: 'amanah', delta: n }); },
    addCargo(good, qty, unitCost) {
      const n = Math.max(0, Math.min(qty, Math.floor(freeSpace(s) / GOODS[good].space)));
      if (n > 0) { trip.cargo[good].qty += n; trip.cargo[good].cost += n * unitCost; out.changes.push({ kind: 'good', good, delta: n }); }
      return n;
    },
    removeCargo(good, qty) {
      const c = trip.cargo[good];
      const n = Math.min(qty, c.qty);
      if (n <= 0) return 0;
      c.cost -= (c.cost / c.qty) * n; c.qty -= n;
      out.changes.push({ kind: 'good', good, delta: -n });
      return n;
    },
    loseRandom(units) {
      const lost = loseRandom(s, trip, rng, units);
      for (const [good, n] of lost) out.changes.push({ kind: 'good', good, delta: -n });
      if (lost.length && trip.flags.pot) out.changes.push({ kind: 'cash', delta: lost.reduce((a, [, n]) => a + n, 0) * 3 });
      return lost.reduce((a, [, n]) => a + n, 0);
    },
    helped() { s.counters.helped += 1; s.flags.helpedTotal = (s.flags.helpedTotal ?? 0) + 1; },
    later(p) { s.pending.push(p); },
    today() { return dayIndex(s); },
    vars: trip.event?.vars ?? {},
    order(o) {
      s.orders.push({ ...o, due: questDue(s) ?? LAST_FRIDAY });
      out.changes.push({ kind: 'quest' });
    },
    debt(who, amount, days) {
      s.debts.push({ who, amount, due: questDue(s, days) ?? LAST_FRIDAY });
      out.changes.push({ kind: 'quest' });
    },
  };
  return ctx;
}

export function cargoCount(trip: Trip, good: GoodId): number {
  return trip.cargo[good].qty;
}
