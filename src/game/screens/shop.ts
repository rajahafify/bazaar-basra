// A market day, Moonlighter style: put goods on the slots, set prices, open, and watch each
// customer react. The notebook remembers every reaction. Empty slots can be restocked or
// swapped while the shop is open. Layout keeps the first mockup's shop screen.

import { L, fmt, money } from '../../i18n';
import { emit } from '../../platform/bridge';
import {
  DAY_SECONDS, DaySim, GOOD_IDS, averageCost, endShopDay, notebookRange, restockSlot, setPrice, setSlotGood,
  startShopDay, type DayEvent, type GoodId, type Reaction,
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
    for (const e of this.day.step(dt)) this.onEvent(e);
  }

  private onEvent(e: DayEvent) {
    const s = this.app.s!;
    if (e.kind === 'decide' && e.customer.shelf !== null) { this.lastMood[e.customer.shelf] = e.customer.reaction; this.syncShelves(); }
    if (e.kind === 'empty') this.syncShelves();
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
    if (this.mode === 'setup') app.crier(d, t.setupHint, 116, 0.95);
    else if (this.hint && this.hintT > 0) app.crier(d, this.hint, 116, Math.min(1, this.hintT * 2));

    this.drawCards(d);

    if (this.mode === 'setup' && this.picking === null) {
      const any = s.slots.some(sl => sl.good && sl.qty > 0);
      d.button('home', 16, 340, 110, 42, t.home, { size: 15, fill: UI.parchDark });
      d.button('open', 190, 336, 154, 48, t.open, { size: 19, disabled: !any });
      if (!any) d.text(t.nothing, 180, 320, { size: 12.5, align: 'center', color: UI.parch });
    }
    if (this.picking !== null) this.drawPicker(d);
    if (this.mode === 'night') this.drawNight(d);
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
    const r = notebookRange(s, good);
    const lines: Array<[string, string]> = [];
    if (r.good !== null) lines.push([fmt(t.knownGood, { n: r.good }), UI.green]);
    if (r.tooHigh !== null) lines.push([fmt(t.knownHigh, { n: r.tooHigh }), UI.red]);
    if (!lines.length) lines.push([t.unknown, UI.inkSoft]);
    const cost = averageCost(s, good);
    if (cost !== null) lines.push([fmt(t.cost, { n: money(cost) }), UI.inkSoft]);
    lines.forEach(([text, color], k) => d.text(text, x, y + k * 15, { size: 10.5, color, maxWidth: w }));
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
    if (this.mode === 'night') {
      if (id === 'next') { endShopDay(s); afterDay(app); }
      return;
    }
    if (this.picking !== null) {
      const i = this.picking;
      if (id.startsWith('pick-')) {
        const what = id.slice(5);
        if (what !== 'cancel') { setSlotGood(s, i, what === 'none' ? null : (what as GoodId)); this.lastMood[i] = null; this.syncShelves(); }
        this.picking = null;
      }
      return;
    }
    const m = id.match(/^(minus|plus|restock|slot)-(\d)$/);
    if (m) {
      const i = Number(m[2]);
      const sl = s.slots[i]!;
      if (m[1] === 'slot') { this.picking = i; return; }
      if (m[1] === 'restock') { restockSlot(s, i); this.syncShelves(); return; }
      if (sl.good) setPrice(s, sl.good, s.prices[sl.good] + (m[1] === 'plus' ? 1 : -1));
      return;
    }
    if (this.mode === 'setup' && id === 'home') { app.go(new MorningScreen(app)); return; }
    if (this.mode === 'setup' && id === 'open') {
      startShopDay(s);
      this.day = new DaySim(s);
      this.mode = 'open';
      app.world.clearCustomers();
    }
  }
}
