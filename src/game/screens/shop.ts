// The shop day: set prices, open the stall, watch customers react, weigh at the scale,
// and close for the night (gdd 4). Layout follows the first mockup's shop screen.

import { L, fmt, money } from '../../i18n';
import { emit } from '../../platform/bridge';
import {
  DAY_SECONDS, DaySim, chooseHarith, cycleShelf, daysToSpoil, endDay, harithDue, nextDay, nextLandedCost,
  setPrice, stockOf, type DayEvent, type GoodId, type NightReport, type Reaction,
} from '../../sim';
import { type Draw, type Mood } from '../../ui/draw';
import { UI } from '../../world/palette';
import type { App, Screen } from '../app';
import { WeekLedgerScreen } from './ledger';

type Mode = 'setup' | 'harith' | 'open' | 'night';

/** How fast the pan fills while held: the line is reached in about 1.7 seconds. */
const SCALE_RATE = 0.6;

export class ShopScreen implements Screen {
  camera = 'bazaar' as const;
  private mode: Mode = 'setup';
  private day: DaySim | null = null;
  private night: NightReport | null = null;
  private lastMood: Array<Reaction | null> = [];
  private crierText: string | null = null;
  private crierT = 0;
  private scaleFill = 0;
  private holding = false;

  constructor(private readonly app: App) {}

  enter() {
    const s = this.app.s!;
    this.app.world.clearCustomers();
    this.lastMood = s.shelves.map(() => null);
    this.mode = harithDue(s) ? 'harith' : 'setup';
    if (s.week === 3 && s.day === 2) this.say(L().shop.crierCaravan, 8);
    if (s.flags.inspectorToday) this.say(L().shop.inspector, 8);
    this.syncShelves();
    this.app.world.setDayTime(s.flags.inspectorToday ? 12 : 0);
    this.app.save();
  }

  private say(text: string, seconds = 5) {
    this.crierText = text;
    this.crierT = seconds;
  }

  private syncShelves() {
    const s = this.app.s!;
    this.app.world.setShelves(s.shelves.map(sh => (sh.good && stockOf(s, sh.good) > 0 ? sh.good : null)));
  }

  update(dt: number) {
    if (this.mode !== 'open' || !this.day) return;
    for (const e of this.day.step(dt)) this.onEvent(e);
    if (this.holding && this.day.paused) this.scaleFill = Math.min(1.6, this.scaleFill + SCALE_RATE * dt);
  }

  private onEvent(e: DayEvent) {
    const s = this.app.s!;
    if (e.kind === 'decide' && e.customer.shelf !== null) this.lastMood[e.customer.shelf] = e.customer.reaction;
    if (e.kind === 'decide' || e.kind === 'scaleResult') this.syncShelves();
    if (e.kind === 'scale') this.scaleFill = 0;
    if (e.kind === 'scaleResult') {
      if (e.customer.shelf !== null) this.lastMood[e.customer.shelf] = e.customer.reaction;
      this.app.toast(L().scale[e.result], 2);
    }
    if (e.kind === 'closed') {
      this.night = endDay(s);
      this.mode = 'night';
      emit('day_end', { week: s.week, day: s.day, revenue: s.dayStats.revenue, amanah: s.amanah });
      if (s.week === 3 && s.day === 2) this.say(L().shop.crierHarith, 30);
      if (s.week === 4 && s.day === 5) this.say(L().shop.crierEnd, 30);
    }
  }

  frame(dt: number) {
    this.crierT = Math.max(0, this.crierT - dt);
    const w = this.app.world;
    w.syncCustomers(this.mode === 'open' ? this.day : null, dt);
    if (this.mode === 'open' && this.day) w.setDayTime(this.day.t);
    if (this.mode === 'night') w.setDayTime(Math.min(52, 45 + (this.nightT += dt) * 3));
  }

  private nightT = 0;

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().shop;
    // Mood bubbles over customers who have looked at a price.
    if (this.day && this.mode === 'open') {
      for (const c of this.day.customers) {
        if (!c.reaction || (c.state !== 'look' && c.state !== 'out' && c.state !== 'scale')) continue;
        const pos = app.world.customerHead(c.id);
        if (!pos) continue;
        const [x, y] = pos;
        const fade = c.state === 'out' ? Math.max(0, 1 - c.t * 0.9) : 1;
        if (fade <= 0) continue;
        d.ctx.save();
        d.ctx.globalAlpha = fade;
        d.ctx.fillStyle = UI.parch; d.ctx.strokeStyle = UI.panelEdge; d.ctx.lineWidth = 2;
        d.rr(x - 18, y - 40, 36, 32, 9); d.ctx.fill(); d.ctx.stroke();
        d.ctx.beginPath(); d.ctx.moveTo(x - 5, y - 9); d.ctx.lineTo(x, y - 2); d.ctx.lineTo(x + 5, y - 9); d.ctx.fill();
        d.mood(x, y - 24, 11, c.reaction as Mood);
        if (c.revenue > 0) d.text(`+${money(c.revenue)}`, x + 22, y - 36, { size: 13, color: UI.gold, font: 'head' });
        d.ctx.restore();
      }
    }

    const progress = this.mode === 'open' && this.day ? this.day.t / DAY_SECONDS : this.mode === 'night' ? 1 : (s.flags.inspectorToday ? 12 : 0) / DAY_SECONDS;
    app.topBar(d, app.weekTitle(), undefined, progress);
    app.amanahBar(d);
    d.panel(204, 82, 146, 28);
    d.text(fmt(L().dayLabel, { day: s.day }), 277, 97, { size: 13, font: 'head', align: 'center' });
    if (this.crierText && (this.crierT > 0 || this.mode === 'setup')) app.crier(d, this.crierText, 116, Math.min(1, this.crierT + (this.mode === 'setup' ? 1 : 0)));

    this.drawCards(d);

    if (this.mode === 'setup') {
      d.panel(50, 356, 260, 42, 'rgba(242,228,196,.94)');
      d.text(t.setup, 180, 370, { size: 12.5, align: 'center' });
      d.text(t.setup2, 180, 385, { size: 12.5, align: 'center', color: UI.inkSoft });
      const anything = s.shelves.some(sh => sh.good && stockOf(s, sh.good) > 0);
      if (anything) d.button('open', 90, 404, 180, 42, t.open, { size: 18 });
      else d.button('rest', 30, 404, 300, 42, t.rest, { size: 13, fill: UI.parchDark });
    } else if (this.mode === 'open' && this.day) {
      const left = Math.max(0, Math.ceil(DAY_SECONDS - this.day.t));
      d.panel(115, 420, 130, 26, 'rgba(242,228,196,.94)');
      d.text(this.day.t < DAY_SECONDS ? fmt(t.openFor, { s: left }) : t.closed, 180, 433, { size: 12.5, align: 'center' });
      if (this.day.paused) this.drawScale(d);
    } else if (this.mode === 'night') this.drawNight(d);
    else if (this.mode === 'harith') this.drawHarith(d);
  }

  private drawCards(d: Draw) {
    const s = this.app.s!, t = L().shop;
    const n = s.shelves.length;
    const cy = 462;
    d.bar(6, cy - 8, 348, 178);
    const gap = 6;
    const w = (332 - (n - 1) * gap) / n;
    const editing = this.mode === 'setup';
    s.shelves.forEach((sh, i) => {
      const x = 14 + i * (w + gap);
      const good = sh.good && stockOf(s, sh.good) > 0 ? sh.good : null;
      d.ctx.save();
      d.ctx.globalAlpha = good ? 1 : 0.6;
      d.panel(x, cy, w, 162);
      if (good) {
        d.goodIcon(good, x + w / 2, cy + 24);
        d.text(L().goods[good], x + w / 2, cy + 50, { size: 13, align: 'center', font: 'head', maxWidth: w - 8 });
      } else {
        d.text(t.empty, x + w / 2, cy + 40, { size: 13, align: 'center', color: UI.inkSoft });
      }
      d.ctx.restore();
      if (editing) d.area(`shelf-${i}`, x, cy, w, 76);
      if (!good) {
        if (editing) d.text(t.tapToChange, x + w / 2, cy + 62, { size: 10.5, align: 'center', color: UI.inkSoft, maxWidth: w - 6 });
        return;
      }
      this.cardBody(d, i, good, x, cy, w);
    });
  }

  private cardBody(d: Draw, i: number, good: GoodId, x: number, cy: number, w: number) {
    const s = this.app.s!, t = L().shop, sh = s.shelves[i]!;
    d.text(`×${stockOf(s, good)}`, x + w / 2, cy + 66, { size: 11, align: 'center', color: UI.inkSoft });
    d.coin(x + w / 2 - 18, cy + 90, 6);
    d.text(money(sh.price), x + w / 2 - 8, cy + 91, { size: 22, font: 'head' });
    const cost = nextLandedCost(s, good);
    if (cost !== null) {
      const below = sh.price < cost;
      d.text(fmt(t.cost, { n: money(cost) }), x + w / 2, cy + 111, { size: 10.5, align: 'center', color: below ? UI.red : UI.inkSoft, weight: below ? 800 : 700 });
    }
    const spoil = daysToSpoil(s, good);
    if (spoil !== null && spoil <= 1) {
      d.ctx.fillStyle = UI.red; d.rr(x + 4, cy + 4, w - 8, 14, 4); d.ctx.fill();
      d.text(t.spoilSoon, x + w / 2, cy + 11, { size: 9.5, color: UI.parch, align: 'center', weight: 800, maxWidth: w - 10 });
    }
    const mood = this.lastMood[i];
    if (mood) d.mood(x + w - 12, cy + 30, 8, mood as Mood);
    const bw = Math.min(40, (w - 14) / 2);
    d.button(`minus-${i}`, x + 5, cy + 120, bw, 36, '−', { fill: UI.parchDark, size: 18, disabled: sh.price <= 1 });
    d.button(`plus-${i}`, x + w - 5 - bw, cy + 120, bw, 36, '+', { fill: UI.parchDark, size: 18 });
  }

  private drawScale(d: Draw) {
    const t = L().scale, c = this.day!.atScale!;
    d.dim(0.35);
    d.panel(40, 150, 280, 290);
    d.text(t.title, 180, 176, { size: 16, font: 'head', align: 'center' });
    d.text(`${L().goods[c.scaleGood!]} ×${c.bought}`, 180, 198, { size: 13, align: 'center', color: UI.inkSoft });
    // Beam, pans and the fill meter.
    const ctx = d.ctx, cx = 180, by = 250;
    const tilt = Math.max(-0.25, Math.min(0.25, (this.scaleFill - 1) * 0.6));
    ctx.save();
    ctx.strokeStyle = UI.panelEdge; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx, by - 20); ctx.lineTo(cx, by + 60); ctx.stroke();
    ctx.translate(cx, by - 20); ctx.rotate(tilt);
    ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(80, 0); ctx.stroke();
    ctx.fillStyle = UI.gold;
    ctx.beginPath(); ctx.ellipse(-80, 30, 30, 8, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(80, 30, 30, 8, 0, 0, 7); ctx.fill();
    ctx.restore();
    const mx = 70, mw = 220, my = 330;
    d.ctx.fillStyle = UI.parchDark; d.rr(mx, my, mw, 16, 6); d.ctx.fill();
    const fillW = Math.min(1.6, this.scaleFill) / 1.6 * mw;
    d.ctx.fillStyle = this.scaleFill < 0.9 ? UI.gold : this.scaleFill <= 1.1 ? UI.green : UI.red;
    d.rr(mx, my, Math.max(6, fillW), 16, 6); d.ctx.fill();
    // The line, with the fair band either side.
    const lx = mx + (1 / 1.6) * mw;
    d.ctx.fillStyle = 'rgba(95,138,62,.25)'; d.ctx.fillRect(mx + (0.9 / 1.6) * mw, my - 6, (0.2 / 1.6) * mw, 28);
    d.ctx.strokeStyle = UI.ink; d.ctx.lineWidth = 2; d.ctx.beginPath(); d.ctx.moveTo(lx, my - 8); d.ctx.lineTo(lx, my + 24); d.ctx.stroke();
    d.text(t.hint, 180, 368, { size: 12.5, align: 'center', color: UI.inkSoft, maxWidth: 260 });
    d.button('scale', 110, 384, 140, 46, t.hold, { size: 18, hold: true });
  }

  hold(down: boolean) {
    if (!this.day?.paused) return;
    if (down) { this.holding = true; this.scaleFill = 0; return; }
    this.holding = false;
    for (const e of this.day.resolveScale(this.scaleFill)) this.onEvent(e);
  }

  private drawNight(d: Draw) {
    const s = this.app.s!, t = L().night, r = this.night!;
    d.dim(0.45);
    const rows: Array<[string, string]> = [
      [t.sold, String(s.dayStats.sold)],
      [t.takings, `${money(s.dayStats.revenue)} ${L().dirham}`],
      [t.walked, String(s.dayStats.walked)],
      [L().amanah, `${Math.round(s.dayStats.amanahStart)} → ${Math.round(s.amanah)}`],
    ];
    if (s.dayStats.creditSales > 0) rows.push([t.credit, `${money(s.dayStats.creditSales)} ${L().dirham}`]);
    for (const sp of r.spoiled) rows.push([`${t.spoiled}: ${L().goods[sp.good]}`, `×${sp.qty}`]);
    for (const sp of r.aboutToSpoil) rows.push([`${t.soon}: ${L().goods[sp.good]}`, `×${sp.qty}`]);
    const h = 120 + rows.length * 28 + (r.inspectorTomorrow ? 24 : 0);
    const y0 = 300 - h / 2;
    d.panel(30, y0, 300, h);
    d.text(`${t.title} · ${fmt(L().dayLabel, { day: s.day })}`, 180, y0 + 28, { size: 20, font: 'head', align: 'center' });
    rows.forEach(([k, v], i) => d.ledgerRow(k, v, 52, y0 + 62 + i * 28, 256));
    if (r.inspectorTomorrow) d.text(t.inspector, 180, y0 + 62 + rows.length * 28, { size: 12.5, color: UI.red, align: 'center' });
    const last = s.day >= 5;
    d.button('next', 80, y0 + h - 56, 200, 44, last ? t.toLedger : t.next, { size: 16 });
  }

  private drawHarith(d: Draw) {
    const t = L().harith;
    d.dim(0.35);
    d.panel(30, 170, 300, 280);
    d.text(t.title, 180, 200, { size: 16, font: 'head', align: 'center' });
    d.para(t.body, 180, 236, 260, { size: 15, align: 'center' }, 20);
    d.button('fair', 50, 320, 260, 46, t.fair, { size: 15 });
    d.button('hold', 50, 380, 260, 46, t.hold, { fill: UI.parchDark, size: 15 });
  }

  press(id: string) {
    const app = this.app, s = app.s!;
    if (this.mode === 'harith' && (id === 'fair' || id === 'hold')) {
      chooseHarith(s, id);
      emit('harith_choice', { choice: id });
      app.toast(id === 'fair' ? L().harith.fairOutcome : L().harith.holdOutcome, 5);
      this.mode = 'setup';
      return;
    }
    if (id.startsWith('shelf-') && this.mode === 'setup') {
      cycleShelf(s, Number(id.slice(6)));
      this.lastMood = s.shelves.map(() => null);
      this.syncShelves();
      return;
    }
    const m = id.match(/^(minus|plus)-(\d)$/);
    if (m) {
      const i = Number(m[2]);
      const sh = s.shelves[i];
      if (sh) setPrice(s, i, sh.price + (m[1] === 'plus' ? 1 : -1));
      return;
    }
    if (id === 'open' && this.mode === 'setup') {
      this.day = new DaySim(s);
      this.mode = 'open';
      this.app.world.clearCustomers();
      return;
    }
    if (id === 'rest' && this.mode === 'setup') {
      // Nothing to sell: customers walk past and the day closes at once.
      this.day = new DaySim(s);
      for (const e of this.day.runToEnd()) this.onEvent(e);
      return;
    }
    if (id === 'next' && this.mode === 'night') {
      nextDay(s);
      if (s.phase === 'weekLedger') { app.save(); app.go(new WeekLedgerScreen(app)); return; }
      this.day = null;
      this.night = null;
      this.nightT = 0;
      this.crierText = null;
      this.enter();
    }
  }
}
