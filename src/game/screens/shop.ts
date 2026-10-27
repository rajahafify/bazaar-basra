// A market day, Moonlighter style: put goods on the slots, set prices, open, and watch each
// customer react. The notebook remembers every reaction. Empty slots can be restocked or
// swapped while the shop is open. Layout keeps the first mockup's shop screen.

import { L, fmt, money } from '../../i18n';
import { emit } from '../../platform/bridge';
import {
  DAY_SECONDS, DaySim, GOOD_IDS, REACTION_EMOJI, TUT, averageCost, endShopDay, fairToday, inTutorial, restockSlot,
  setPrice, setSlotGood, startShopDay, type DayEvent, type GoodId, type Reaction,
} from '../../sim';
import type { Draw, Mood } from '../../ui/draw';
import { UI } from '../../world/palette';
import type { App, Screen } from '../app';
import { afterDay } from '../flow';
import { MorningScreen } from './morning';

type Mode = 'setup' | 'open' | 'night';

export class ShopScreen implements Screen {
  camera = 'bazaar' as const;
  private mode: Mode = 'setup';
  private day: DaySim | null = null;
  private picking: number | null = null;
  private lastMood: Array<Reaction | null> = [];
  private hint: string | null = null;
  private hintT = 0;
  private nightT = 0;

  constructor(private readonly app: App) {}

  enter() {
    const s = this.app.s!;
    this.app.world.clearCustomers();
    this.app.world.setDayTime(0);
    this.lastMood = s.slots.map(() => null);
    this.syncShelves();
  }

  private syncShelves() {
    const s = this.app.s!;
    this.app.world.setShelves(s.slots.map(sl => (sl.good && sl.qty > 0 ? sl.good : null)));
  }

  private say(text: string, seconds = 3) {
    this.hint = text;
    this.hintT = seconds;
  }

  update(dt: number) {
    if (this.mode !== 'open' || !this.day) return;
    // The tutorial waits while the player restocks the empty slot.
    if (this.app.s!.flags.tut === TUT.restock) return;
    for (const e of this.day.step(dt)) this.onEvent(e);
  }

  private onEvent(e: DayEvent) {
    const s = this.app.s!;
    if (e.kind === 'decide' && e.customer.shelf !== null) { this.lastMood[e.customer.shelf] = e.customer.reaction; this.syncShelves(); }
    if (e.kind === 'empty') {
      this.syncShelves();
      const sl = s.slots[e.slot];
      if (s.flags.tut === TUT.watch && sl?.good && s.store[sl.good].qty > 0) s.flags.tut = TUT.restock;
    }
    if (e.kind === 'asked') this.say(fmt(L().shop.asked, { good: L().goods[e.customer.want] }), 2.4);
    if (e.kind === 'closed') {
      this.mode = 'night';
      this.nightT = 0;
      emit('day_end', { season: s.season, week: s.week, day: s.dow, revenue: s.day.revenue, amanah: Math.round(s.amanah) });
    }
  }

  frame(dt: number) {
    this.hintT = Math.max(0, this.hintT - dt);
    const w = this.app.world;
    w.syncCustomers(this.mode === 'open' ? this.day : null, dt);
    if (this.mode === 'open' && this.day) w.setDayTime(this.day.t * 45 / DAY_SECONDS);
    if (this.mode === 'night') w.setDayTime(Math.min(52, 45 + (this.nightT += dt) * 3));
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().shop;
    if (this.day && this.mode === 'open') this.drawBubbles(d);

    const progress = this.mode === 'open' && this.day ? this.day.t / DAY_SECONDS : this.mode === 'night' ? 1 : 0;
    app.topBar(d, app.calendar(), undefined, progress);
    app.amanahBar(d);
    app.sidePanel(d, this.mode === 'open' && this.day ? fmt(t.openFor, { s: Math.max(0, Math.ceil(DAY_SECONDS - this.day.t)) }) : L().days[s.dow]!);
    if (this.mode === 'setup' && !inTutorial(s)) app.crier(d, t.setupHint, 116, 0.95);
    else if (this.hint && this.hintT > 0) app.crier(d, this.hint, 116, Math.min(1, this.hintT * 2));

    this.drawCards(d);

    if (this.mode === 'setup' && this.picking === null) {
      const any = s.slots.some(sl => sl.good && sl.qty > 0);
      if (!inTutorial(s)) d.button('home', 16, 340, 110, 42, t.home, { size: 15, fill: UI.parchDark });
      // An empty stall can still open: nothing sells, but you learn what people ask for.
      d.button('open', 190, 336, 154, 48, t.open, { size: 19, disabled: !any && inTutorial(s) });
      if (!any) d.text(t.nothing, 180, 320, { size: 12.5, align: 'center', color: UI.parch });
    }
    if (this.picking !== null) this.drawPicker(d);
    if (this.mode === 'night') this.drawNight(d);
    if (inTutorial(s)) this.drawTutorial(d);
  }

  /** What the tutorial asks for now, and which controls it points at. */
  private tutorialStep(): { text: string; targets: string[]; next?: boolean } | null {
    const s = this.app.s!, t = L().tutorial, step = s.flags.tut;
    const legend = `${REACTION_EMOJI.delighted} ${t.delighted}  ${REACTION_EMOJI.happy} ${t.happy}\n${REACTION_EMOJI.unsure} ${t.unsure}  ${REACTION_EMOJI.angry} ${t.angry}`;
    if (this.mode === 'setup') {
      if (step === TUT.slot) return { text: t.slot, targets: this.picking === null ? ['slot-0'] : ['pick-dates'] };
      if (step === TUT.price) return { text: fmt(t.price, { n: Math.round(fairToday(s, 'dates')) }), targets: ['minus-0', 'plus-0'], next: true };
      return { text: t.open, targets: ['open'] };
    }
    if (this.mode === 'open') {
      if (step === TUT.restock) return { text: t.restock, targets: ['restock-0'] };
      return { text: `${t.watch}\n${legend}`, targets: [] };
    }
    return { text: t.night, targets: ['next'] };
  }

  private drawTutorial(d: Draw) {
    const step = this.tutorialStep();
    if (!step) return;
    // Outline the controls it points at, pulsing.
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 220);
    d.ctx.save();
    d.ctx.strokeStyle = `rgba(233,168,58,${pulse})`; d.ctx.lineWidth = 4;
    for (const h of d.hits.filter(h => step.targets.includes(h.id))) { d.rr(h.x - 4, h.y - 4, h.w + 8, h.h + 8, 10); d.ctx.stroke(); }
    d.ctx.restore();
    const lines = step.text.split('\n');
    const heights = lines.map(l => d.lines(l, 300, { size: 14 }) * 19);
    const h = 22 + heights.reduce((a, b) => a + b, 0) + (step.next ? 44 : 0);
    const y = this.mode === 'night' ? 96 : 116;
    d.panel(10, y, 340, h, '#f6e3b4', UI.gold);
    let yy = y + 20;
    lines.forEach((l, i) => { d.para(l, 180, yy, 300, { size: 14, align: 'center' }, 19); yy += heights[i]!; });
    if (step.next) d.button('tut-next', 120, y + h - 42, 120, 34, L().tutorial.next, { size: 14 });
  }

  /** In the tutorial only the control it points at works. */
  private tutorialAllows(id: string): boolean {
    const s = this.app.s!;
    if (!inTutorial(s)) return true;
    const step = s.flags.tut;
    if (this.mode === 'night') return id === 'next';
    if (this.mode === 'open') return step === TUT.restock ? id === 'restock-0' : false;
    if (step === TUT.slot) return id === 'slot-0' || id === 'pick-dates' || id === 'pick-cancel';
    if (step === TUT.price) return id === 'minus-0' || id === 'plus-0' || id === 'tut-next';
    return id === 'open' || id === 'minus-0' || id === 'plus-0';
  }

  private drawBubbles(d: Draw) {
    for (const c of this.day!.customers) {
      const asking = c.asked && c.shelf === null && (c.state === 'in' || c.state === 'out');
      const reacted = c.reaction && (c.state === 'look' || c.state === 'out');
      if (!asking && !reacted) continue;
      const pos = this.app.world.customerHead(c.id);
      if (!pos) continue;
      const [x, y] = pos;
      const fade = c.state === 'out' ? Math.max(0, 1 - c.t * 0.9) : 1;
      if (fade <= 0) continue;
      d.ctx.save();
      d.ctx.globalAlpha = fade;
      d.ctx.fillStyle = UI.parch; d.ctx.strokeStyle = UI.panelEdge; d.ctx.lineWidth = 2;
      d.rr(x - 18, y - 40, 36, 32, 9); d.ctx.fill(); d.ctx.stroke();
      d.ctx.beginPath(); d.ctx.moveTo(x - 5, y - 9); d.ctx.lineTo(x, y - 2); d.ctx.lineTo(x + 5, y - 9); d.ctx.fill();
      if (asking) {
        d.goodIcon(c.want, x, y - 24, 0.5);
        d.text('?', x + 13, y - 34, { size: 13, font: 'head', color: UI.red });
      } else {
        d.mood(x, y - 24, 11, c.reaction as Mood);
        if (c.revenue > 0) d.text(`+${money(c.revenue)}`, x + 22, y - 36, { size: 13, color: UI.gold, font: 'head' });
      }
      d.ctx.restore();
    }
  }

  private drawCards(d: Draw) {
    const s = this.app.s!, t = L().shop;
    const n = s.slots.length;
    const rows = n > 3 ? 2 : 1;
    const top = rows === 2 ? 398 : 452;
    d.bar(6, top - 8, 348, 640 - top + 2);
    const perRow = 3, gap = 6, w = (332 - (perRow - 1) * gap) / perRow, h = rows === 2 ? 112 : 170;
    s.slots.forEach((sl, i) => {
      const x = 14 + (i % perRow) * (w + gap), y = top + Math.floor(i / perRow) * (h + 6);
      const good = sl.good;
      const has = good && sl.qty > 0;
      d.ctx.save();
      d.ctx.globalAlpha = has ? 1 : 0.75;
      d.panel(x, y, w, h);
      d.ctx.restore();
      d.area(`slot-${i}`, x, y, w, h - 44);
      if (!good) {
        d.text(t.empty, x + w / 2, y + 28, { size: 13, align: 'center', color: UI.inkSoft });
        d.text(t.choose, x + w / 2, y + 48, { size: 10.5, align: 'center', color: UI.inkSoft, maxWidth: w - 8 });
        return;
      }
      d.goodIcon(good, x + 22, y + 22, 0.62);
      d.text(`×${sl.qty}`, x + w - 8, y + 16, { size: 15, font: 'head', align: 'right' });
      d.text(fmt(t.inStore, { n: s.store[good].qty }), x + w - 8, y + 32, { size: 9.5, align: 'right', color: UI.inkSoft });
      d.text(L().goods[good], x + 6, y + 48, { size: 12, font: 'head', maxWidth: w - 12 });
      const mood = this.lastMood[i];
      if (mood) d.mood(x + 44, y + 16, 7, mood as Mood);
      if (h > 120) this.cardKnowledge(d, good, x + 6, y + 70, w - 12);
      const py = y + h - 40;
      const price = s.prices[good];
      const bw = 30;
      d.button(`minus-${i}`, x + 4, py, bw, 34, '−', { fill: UI.parchDark, size: 18, disabled: price <= 1 });
      d.coin(x + w / 2 - 12, py + 17, 5);
      d.text(String(price), x + w / 2 - 4, py + 18, { size: 19, font: 'head' });
      d.button(`plus-${i}`, x + w - 4 - bw, py, bw, 34, '+', { fill: UI.parchDark, size: 18 });
      if (sl.qty === 0 && s.store[good].qty > 0) d.button(`restock-${i}`, x + 8, y + 20, w - 16, 30, t.restock, { size: 13 });
    });
  }

  /** What the notebook knows about a good, and what it cost you. */
  private cardKnowledge(d: Draw, good: GoodId, x: number, y: number, w: number) {
    const s = this.app.s!, t = L().shop;
    // The notebook: each price tried with the emoji it got, two rows at most.
    const book = s.notebook[good];
    const prices = Object.keys(book).map(Number).sort((a, b) => a - b);
    if (!prices.length) d.text(t.unknown, x, y, { size: 10.5, color: UI.inkSoft, maxWidth: w });
    else {
      const half = Math.ceil(prices.length / 2);
      const rows = prices.length > 3 ? [prices.slice(0, half), prices.slice(half)] : [prices];
      rows.forEach((row, k) => d.priceChips(Object.fromEntries(row.map(p => [String(p), book[String(p)]!])), x, y + k * 17, w, 10.5));
    }
    const cost = averageCost(s, good);
    if (cost !== null) d.text(fmt(t.cost, { n: money(cost) }), x, y + 36, { size: 10.5, color: UI.inkSoft, maxWidth: w });
  }

  private drawPicker(d: Draw) {
    const s = this.app.s!, t = L().shop;
    const goods = GOOD_IDS.filter(g => s.store[g].qty > 0 || s.slots[this.picking!]?.good === g);
    const h = 110 + goods.length * 46;
    const y = this.app.modal(d, h, 0.35);
    d.text(t.choose, 180, y + 26, { size: 17, font: 'head', align: 'center' });
    goods.forEach((g, k) => {
      const yy = y + 48 + k * 46;
      d.button(`pick-${g}`, 36, yy, 288, 40, '', { fill: UI.parchDark });
      d.goodIcon(g, 64, yy + 20, 0.6);
      d.text(L().goods[g], 94, yy + 20, { size: 15, font: 'head' });
      d.text(fmt(t.inStore, { n: s.store[g].qty }), 312, yy + 20, { size: 12, align: 'right', color: UI.inkSoft });
    });
    d.button('pick-none', 36, y + h - 56, 140, 40, t.none, { size: 13, fill: UI.parchDark });
    d.button('pick-cancel', 184, y + h - 56, 140, 40, L().back, { size: 14, fill: UI.parchDark });
  }

  private drawNight(d: Draw) {
    const s = this.app.s!, t = L().night;
    const rows: Array<[string, string]> = [
      [t.sold, String(s.day.sold)],
      [t.takings, `${money(s.day.revenue)} ${L().dirham}`],
      [t.walked, String(s.day.walked)],
      [t.wanted, String(s.day.wanted)],
      [L().amanah, `${Math.round(s.day.amanahStart)} → ${Math.round(s.amanah)}`],
    ];
    const h = 130 + rows.length * 30;
    const y = this.app.modal(d, h, 0.45);
    d.text(`${t.title} · ${L().days[s.dow]}`, 180, y + 30, { size: 20, font: 'head', align: 'center' });
    rows.forEach(([k, v], i) => d.ledgerRow(k, v, 44, y + 66 + i * 30, 272));
    d.button('next', 90, y + h - 58, 180, 44, s.dow === 5 ? t.friday : t.next, { size: 16 });
  }

  press(id: string) {
    const app = this.app, s = app.s!;
    if (!this.tutorialAllows(id)) return;
    if (id === 'tut-next') { s.flags.tut = TUT.open; return; }
    if (this.mode === 'night') {
      if (id === 'next') {
        if (inTutorial(s)) s.flags.tut = TUT.morning;
        endShopDay(s);
        afterDay(app);
      }
      return;
    }
    if (this.picking !== null) {
      const i = this.picking;
      if (id.startsWith('pick-')) {
        const what = id.slice(5);
        if (what !== 'cancel') { setSlotGood(s, i, what === 'none' ? null : (what as GoodId)); this.lastMood[i] = null; this.syncShelves(); }
        if (what === 'dates' && s.flags.tut === TUT.slot) s.flags.tut = TUT.price;
        this.picking = null;
      }
      return;
    }
    const m = id.match(/^(minus|plus|restock|slot)-(\d)$/);
    if (m) {
      const i = Number(m[2]);
      const sl = s.slots[i]!;
      if (m[1] === 'slot') { this.picking = i; return; }
      if (m[1] === 'restock') { restockSlot(s, i); this.syncShelves(); if (s.flags.tut === TUT.restock) s.flags.tut = TUT.selling; return; }
      if (sl.good) setPrice(s, sl.good, s.prices[sl.good] + (m[1] === 'plus' ? 1 : -1));
      return;
    }
    if (this.mode === 'setup' && id === 'home') { app.go(new MorningScreen(app)); return; }
    if (this.mode === 'setup' && id === 'open') {
      const tutorial = inTutorial(s);
      if (tutorial && s.prices.dates > fairToday(s, 'dates') * 1.25) { this.say(L().tutorial.tooHigh); return; }
      startShopDay(s);
      if (tutorial) s.flags.tut = TUT.watch;
      this.day = new DaySim(s, tutorial);
      this.mode = 'open';
      app.world.clearCustomers();
    }
  }
}
