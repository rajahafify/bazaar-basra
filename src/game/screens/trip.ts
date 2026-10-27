// An expedition, FTL style: pick one of two stops at each step, live through its event,
// buy at the town market, and come home by a new road. Each stop is half a day.

import { L, fmt, money } from '../../i18n';
import { emit } from '../../platform/bridge';
import {
  GOOD_IDS, TOWN_SUPPLY_PRICE, arriveHome, caravanSpace, cargoUsed, chooseNode, chooseOption, eventOptions,
  finishEvent, freeSpace, leaveTown, supplyCap, townBuy, townSupplies, type Change, type GoodId, type Trip,
} from '../../sim';
import type { Draw } from '../../ui/draw';
import { UI } from '../../world/palette';
import type { App, Screen } from '../app';
import { afterDay } from '../flow';

type EventText = { title: string; body: string; a: string; b: string; c?: string; out: Record<string, string>; lesson: string };

export class TripScreen implements Screen {
  camera = 'desert' as const;
  /** Waiting for the caravan to reach the stop just picked. */
  private walking = false;

  constructor(private readonly app: App) {}

  private get trip(): Trip {
    return this.app.s!.trip!;
  }

  enter() {
    const w = this.app.world;
    w.setDayTime(8);
    this.syncRoute();
    const t = this.trip;
    if (t.leg === 'town' || t.leg === 'home') w.caravanTo(0, 'end');
  }

  private syncRoute() {
    const s = this.app.s!, t = this.trip;
    this.app.world.showRoute(t.layers, t.picked, t.leg === 'out' || t.leg === 'town', s.upgrades.camel);
  }

  frame() {
    if (!this.app.s!.trip) return;
    this.syncRoute();
    if (this.walking && !this.app.world.caravanMoving) this.walking = false;
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = this.trip, tt = L().trip;
    const title = t.leg === 'back' || t.leg === 'home' ? tt.home : fmt(tt.to, { town: L().towns[t.town] });
    app.topBar(d, title, `${fmt(tt.day, { n: t.halfDays })} · ${fmt(tt.space, { a: cargoUsed(t), b: caravanSpace(s) })}`);
    app.amanahBar(d);
    app.sidePanel(d, fmt(tt.supplies, { n: s.supplies }));

    if (this.walking || app.world.caravanMoving) {
      if (t.leg === 'town' || t.leg === 'home') app.crier(d, tt.arriving, 116);
      return;
    }
    if (t.event) { t.event.outcome ? this.drawOutcome(d) : this.drawEvent(d); return; }
    if (t.leg === 'town') { this.drawTown(d); return; }
    if (t.leg === 'home') { this.drawHome(d); return; }
    this.drawMap(d);
  }

  // ---------- the map ----------

  private drawMap(d: Draw) {
    const t = this.trip, tt = L().trip;
    this.app.crier(d, tt.pick, 116);
    const row = t.layers[t.step] ?? [];
    row.forEach((n, i) => {
      const kind = n.hidden ? 'hidden' : n.kind;
      const [x, y, z] = this.app.world.stopScreen(t.step, i);
      if (z > 1 || y < 150 || y > 560) return;
      d.stopIcon(kind, x, y - 26, 15);
      d.area(`node-${i}`, x - 34, y - 50, 68, 70);
    });
    row.forEach((n, i) => {
      const kind = n.hidden ? 'hidden' : n.kind;
      const x = 16 + i * 168;
      d.button(`node-${i}`, x, 572, 160, 52, '', { fill: UI.parch });
      d.stopIcon(kind, x + 26, 598, 13);
      d.text(tt.kinds[kind], x + 46, 598, { size: 15, font: 'head', maxWidth: 108 });
    });
  }

  // ---------- events ----------

  private text(): EventText {
    return (L().events as unknown as Record<string, EventText>)[this.trip.event!.id]!;
  }

  private drawEvent(d: Draw) {
    const s = this.app.s!, ev = this.text(), opts = eventOptions(s);
    const bodyH = d.lines(ev.body, 280, { size: 15 }) * 20;
    const optH = opts.map(o => (o.blocked ? 64 : 50));
    const h = 64 + bodyH + 16 + optH.reduce((a, b) => a + b, 0) + 8;
    let y = this.app.modal(d, h, 0.3);
    d.text(ev.title, 180, y + 30, { size: 20, font: 'head', align: 'center' });
    d.para(ev.body, 180, y + 58, 280, { size: 15, align: 'center' }, 20);
    y += 64 + bodyH + 12;
    opts.forEach((o, i) => {
      const label = (ev as unknown as Record<string, string>)[o.id] ?? o.id;
      d.button(`opt-${o.id}`, 36, y, 288, 44, label, { size: 14, fill: UI.parchDark, disabled: !!o.blocked });
      if (o.blocked) d.text((L().need as Record<string, string>)[o.blocked] ?? o.blocked, 180, y + 54, { size: 11.5, color: UI.red, align: 'center' });
      y += optH[i]!;
    });
  }

  private changeLabel(c: Change): string {
    const t = L().change;
    const sign = (n: number) => (n > 0 ? `+${money(n)}` : `−${money(-n)}`);
    switch (c.kind) {
      case 'cash': return fmt(t.cash, { n: sign(c.delta) });
      case 'supplies': return fmt(t.supplies, { n: sign(c.delta) });
      case 'amanah': return fmt(t.amanah, { n: sign(c.delta) });
      case 'time': return fmt(t.time, { n: c.delta });
      case 'good': return fmt(t.good, { n: sign(c.delta), good: L().goods[c.good] });
    }
  }

  private drawOutcome(d: Draw) {
    const ev = this.text(), o = this.trip.event!.outcome!;
    const vars: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(o.vars)) vars[k] = typeof v === 'string' && (GOOD_IDS as readonly string[]).includes(v) ? L().goods[v as GoodId] : v;
    const text = fmt(ev.out[o.text] ?? '', vars);
    const textH = d.lines(text, 280, { size: 15 }) * 20;
    const lessonH = d.lines(ev.lesson, 260, { size: 13 }) * 17 + 30;
    const chips = o.changes.map(c => this.changeLabel(c));
    const chipRows = Math.ceil(chips.length / 2);
    const h = 56 + textH + 12 + chipRows * 30 + 10 + lessonH + 70;
    let y = this.app.modal(d, h, 0.3);
    d.text(ev.title, 180, y + 30, { size: 20, font: 'head', align: 'center' });
    d.para(text, 180, y + 56, 280, { size: 15, align: 'center' }, 20);
    y += 56 + textH + 6;
    o.changes.forEach((c, i) => {
      const x = 36 + (i % 2) * 148, cy = y + Math.floor(i / 2) * 30;
      const good = c.kind === 'time' ? false : c.delta > 0;
      d.panel(x, cy, 140, 24, good ? '#d8e6c0' : '#ecc9b8', UI.panelEdge);
      if (c.kind === 'good') d.goodIcon(c.good, x + 14, cy + 12, 0.36);
      d.text(chips[i]!, x + (c.kind === 'good' ? 80 : 70), cy + 12, { size: 12, align: 'center', weight: 700, maxWidth: 110 });
    });
    y += chipRows * 30 + 8;
    d.ctx.fillStyle = UI.parchDark; d.rr(36, y, 288, lessonH, 8); d.ctx.fill();
    d.text(L().trip.lesson.toUpperCase(), 50, y + 14, { size: 10, weight: 800, color: UI.inkSoft });
    d.para(ev.lesson, 180, y + 32, 260, { size: 13, align: 'center' }, 17);
    y += lessonH + 14;
    d.button('continue', 100, y, 160, 44, L().trip.continue, { size: 16 });
  }

  // ---------- the town ----------

  private drawTown(d: Draw) {
    const s = this.app.s!, t = this.trip, tt = L().town;
    d.dim(0.3);
    d.panel(10, 116, 340, 514);
    d.text(fmt(tt.title, { town: L().towns[t.town] }), 180, 142, { size: 18, font: 'head', align: 'center' });
    t.offers.forEach((o, i) => {
      const y = 162 + i * 66;
      d.panel(20, y, 320, 58, UI.parch, UI.panelEdge);
      d.goodIcon(o.good, 46, y + 29, 0.72);
      d.text(L().goods[o.good], 76, y + 18, { size: 15, font: 'head' });
      d.text(fmt(tt.each, { n: o.price }), 76, y + 38, { size: 12, color: UI.inkSoft });
      if (o.left < 10) d.text(o.left > 0 ? fmt(tt.left, { n: o.left }) : tt.rare, 150, y + 38, { size: 12, color: UI.red });
      const have = t.cargo[o.good].qty;
      d.button(`buy-minus-${o.good}`, 210, y + 12, 34, 34, '−', { fill: UI.parchDark, size: 18, disabled: have <= 0 });
      d.text(String(have), 266, y + 29, { size: 18, font: 'head', align: 'center' });
      d.button(`buy-plus-${o.good}`, 288, y + 12, 34, 34, '+', { fill: UI.gold, size: 18, disabled: o.left <= 0 || s.cash < o.price || freeSpace(s) < 1 });
    });
    const y = 162 + t.offers.length * 66 + 8;
    d.text(fmt(tt.supplies, { n: TOWN_SUPPLY_PRICE }), 30, y + 16, { size: 14, font: 'head' });
    d.text(`${s.supplies}/${supplyCap(s)}`, 266, y + 16, { size: 16, font: 'head', align: 'center' });
    d.button('sup-plus', 288, y, 34, 32, '+', { fill: UI.parchDark, size: 18, disabled: s.supplies >= supplyCap(s) || s.cash < TOWN_SUPPLY_PRICE });
    const cy = y + 44;
    d.text(tt.cargo, 30, cy, { size: 12, weight: 800, color: UI.inkSoft });
    d.text(fmt(L().trip.space, { a: cargoUsed(t), b: caravanSpace(s) }), 330, cy, { size: 12, align: 'right', color: freeSpace(s) < 1 ? UI.red : UI.inkSoft });
    const bw = 300 * Math.min(1, cargoUsed(t) / caravanSpace(s));
    d.ctx.fillStyle = UI.parchDark; d.rr(30, cy + 10, 300, 8, 4); d.ctx.fill();
    d.ctx.fillStyle = UI.gold; d.rr(30, cy + 10, bw, 8, 4); d.ctx.fill();
    if (freeSpace(s) < 1) d.text(tt.full, 180, cy + 34, { size: 12, align: 'center', color: UI.red });
    d.button('leave', 80, 566, 200, 50, tt.leave, { size: 18 });
  }

  // ---------- home ----------

  private drawHome(d: Draw) {
    const t = this.trip, tt = L().home;
    const goods = GOOD_IDS.filter(g => t.cargo[g].qty > 0);
    const h = 120 + Math.max(1, Math.ceil(goods.length / 3)) * 48 + 60;
    const y = this.app.modal(d, h, 0.3);
    d.text(tt.title, 180, y + 30, { size: 20, font: 'head', align: 'center' });
    d.text(fmt(tt.days, { n: Math.max(1, Math.ceil(t.halfDays / 2)) }), 180, y + 54, { size: 13, align: 'center', color: UI.inkSoft });
    d.text(tt.unloaded, 40, y + 84, { size: 12, weight: 800, color: UI.inkSoft });
    if (!goods.length) d.para(tt.nothing, 180, y + 112, 270, { size: 14, align: 'center' }, 18);
    goods.forEach((g, i) => {
      const x = 36 + (i % 3) * 98, gy = y + 96 + Math.floor(i / 3) * 48;
      d.panel(x, gy, 92, 40);
      d.goodIcon(g, x + 22, gy + 20, 0.6);
      d.text(`×${t.cargo[g].qty}`, x + 44, gy + 20, { size: 15, font: 'head' });
    });
    d.button('unload', 100, y + h - 58, 160, 44, tt.unload, { size: 16 });
  }

  // ---------- input ----------

  press(id: string) {
    const app = this.app, s = app.s!, t = s.trip;
    if (!t || this.walking || app.world.caravanMoving) return;
    if (id.startsWith('node-') && !t.event && (t.leg === 'out' || t.leg === 'back')) {
      const i = Number(id.slice(5));
      const layer = t.step;
      if (!chooseNode(s, i)) return;
      app.world.caravanTo(layer, i);
      this.walking = true;
      if (t.flags.thirsty) { app.toast(L().trip.thirsty); t.flags.thirsty = 0; }
      app.save();
      return;
    }
    if (id.startsWith('opt-')) {
      if (chooseOption(s, id.slice(4))) emit('trip_event', { event: t.event!.id, option: id.slice(4) });
      app.save();
      return;
    }
    if (id === 'continue') {
      finishEvent(s);
      if (t.leg === 'town' || t.leg === 'home') { app.world.caravanTo(0, 'end'); this.walking = true; }
      app.save();
      return;
    }
    if (t.leg === 'town') {
      if (id.startsWith('buy-plus-')) townBuy(s, id.slice(9) as GoodId, 1);
      if (id.startsWith('buy-minus-')) townBuy(s, id.slice(10) as GoodId, -1);
      if (id === 'sup-plus') townSupplies(s, 1);
      if (id === 'leave') { leaveTown(s); this.syncRoute(); }
      app.save();
      return;
    }
    if (id === 'unload' && t.leg === 'home') {
      const back = arriveHome(s);
      if (back) emit('trip_end', { town: t.town, days: back.days, units: back.unloaded.reduce((a, u) => a + u.qty, 0) });
      afterDay(app);
    }
  }
}
