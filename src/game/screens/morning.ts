// The stall in the morning: the home base. Each market day starts here with one choice:
// open the shop or set out. The notebook, the season goals and the trip planner open from here.

import { L, fmt, money } from '../../i18n';
import { emit } from '../../platform/bridge';
import {
  GOALS, GOOD_IDS, SUPPLY_PRICE, TOWNS, TOWN_IDS, canSetOut, caravanSpace, daysBeforeFriday, goodsInStore,
  notebookRange, rentDue, setOut, stockOf, suggestedSupplies, supplyCap, tripDays, type TownId,
} from '../../sim';
import type { Draw } from '../../ui/draw';
import { UI } from '../../world/palette';
import type { App, Screen } from '../app';
import { ShopScreen } from './shop';
import { TripScreen } from './trip';

type Mode = 'home' | 'notebook' | 'goals' | 'setout';

export class MorningScreen implements Screen {
  camera = 'bazaar' as const;
  private mode: Mode = 'home';
  private town: TownId = 'groves';
  private supplies = 0;

  constructor(private readonly app: App) {}

  enter() {
    const s = this.app.s!, w = this.app.world;
    w.clearCustomers();
    w.setDayTime(5);
    w.setShelves(s.slots.map(sl => (sl.qty > 0 ? sl.good : null)));
    w.setStallCamels(s.upgrades.camel);
    this.app.save();
  }

  /** The one line that says what to do now. */
  private nextStep(): string {
    const s = this.app.s!, t = L().morning;
    const units = GOOD_IDS.reduce((a, g) => a + stockOf(s, g), 0);
    const rent = rentDue(s);
    if (daysBeforeFriday(s) <= 2 && s.cash < rent) return units ? t.nextBroke : fmt(t.nextFriday, { n: rent });
    if (units < 4) return t.nextSetOut;
    if (daysBeforeFriday(s) <= 2) return fmt(t.nextFriday, { n: rent });
    return t.nextShop;
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().morning;
    app.topBar(d, app.calendar(), fmt(t.rent, { n: rentDue(s) }));
    app.amanahBar(d);
    app.sidePanel(d, fmt(t.supplies, { n: s.supplies }));

    if (s.notices.length) { this.drawNotice(d); return; }
    if (this.mode === 'notebook') { this.drawNotebook(d); return; }
    if (this.mode === 'goals') { this.drawGoals(d); return; }
    if (this.mode === 'setout') { this.drawSetOut(d); return; }

    app.crier(d, this.nextStep(), 116);
    d.bar(6, 388, 348, 246);
    d.text(t.store, 20, 406, { size: 14, font: 'head', color: UI.parch });
    const goods = GOOD_IDS.filter(g => stockOf(s, g) > 0);
    if (!goods.length) d.text(t.storeEmpty, 180, 440, { size: 13, color: UI.parchDark, align: 'center' });
    goods.forEach((g, i) => {
      const x = 16 + (i % 4) * 83, y = 418 + Math.floor(i / 4) * 44;
      d.panel(x, y, 78, 38);
      d.goodIcon(g, x + 20, y + 20, 0.62);
      d.text(`×${stockOf(s, g)}`, x + 38, y + 20, { size: 15, font: 'head' });
    });
    const wanted = GOOD_IDS.filter(g => s.wanted[g] > 0).sort((a, b) => s.wanted[b] - s.wanted[a]);
    const wy = 512;
    d.text(t.wanted, 20, wy, { size: 12, color: UI.parchDark, weight: 800 });
    if (!wanted.length) d.text(t.wantedNone, 20, wy + 18, { size: 12, color: UI.parchDark });
    else d.text(wanted.slice(0, 4).map(g => `${L().goods[g]} ×${s.wanted[g]}`).join(' · '), 20, wy + 18, { size: 12.5, color: UI.parch, maxWidth: 320 });
    const anything = goodsInStore(s).length > 0 || s.slots.some(sl => sl.qty > 0);
    d.button('open', 16, 548, 160, 48, t.open, { size: 17, fill: anything ? UI.gold : UI.parchDark });
    d.button('setout', 184, 548, 160, 48, t.setOut, { size: 17 });
    d.button('notebook', 16, 602, 104, 26, t.notebook, { size: 12, fill: UI.parchDark });
    d.button('goals', 128, 602, 104, 26, t.goals, { size: 12, fill: UI.parchDark });
  }

  private drawNotice(d: Draw) {
    const n = this.app.s!.notices[0]!;
    const text = fmt((L().notices as Record<string, string>)[n.key.replace('notice.', '')] ?? n.key, { n: money(Math.abs(Number(n.vars?.n ?? 0))) });
    const h = 60 + d.lines(text, 270, { size: 16 }) * 22 + 60;
    const y = this.app.modal(d, h, 0.3);
    d.para(text, 180, y + 34, 270, { size: 16, align: 'center' }, 22);
    d.button('notice', 110, y + h - 58, 140, 42, L().next, { size: 16 });
  }

  private drawNotebook(d: Draw) {
    const s = this.app.s!, t = L().notebook;
    d.dim(0.35);
    d.panel(14, 120, 332, 500);
    d.text(t.title, 180, 146, { size: 19, font: 'head', align: 'center' });
    d.text(t.hint, 180, 168, { size: 12, align: 'center', color: UI.inkSoft });
    GOOD_IDS.forEach((g, i) => {
      const y = 196 + i * 46;
      d.goodIcon(g, 42, y + 8, 0.7);
      d.text(L().goods[g], 72, y, { size: 14, font: 'head' });
      const r = notebookRange(s, g);
      const parts: string[] = [];
      if (r.good !== null) parts.push(fmt(L().shop.knownGood, { n: r.good }));
      if (r.tooHigh !== null) parts.push(fmt(L().shop.knownHigh, { n: r.tooHigh }));
      d.text(parts.length ? parts.join(' · ') : t.none, 72, y + 18, { size: 12, color: parts.length ? UI.ink : UI.inkSoft, maxWidth: 260 });
    });
    if (s.flags.zakatPage) d.para(t.zakat, 180, 528, 300, { size: 11.5, align: 'center', color: UI.inkSoft }, 14);
    d.button('close', 120, 570, 120, 40, L().close, { size: 15, fill: UI.parchDark });
  }

  private drawGoals(d: Draw) {
    const s = this.app.s!, t = L().friday;
    d.dim(0.35);
    d.panel(24, 170, 312, 300);
    d.text(`${t.goals} · ${L().seasons[s.season - 1]}`, 180, 198, { size: 18, font: 'head', align: 'center' });
    GOALS[s.season].forEach((g, i) => {
      const y = 236 + i * 52;
      const have = Math.min(g.target, Math.round(s.counters[g.counter]));
      const done = have >= g.target;
      d.text(fmt(t.goalNames[g.counter], { n: g.target }), 44, y, { size: 14, color: done ? UI.green : UI.ink });
      d.ctx.fillStyle = UI.parchDark; d.rr(44, y + 14, 220, 8, 4); d.ctx.fill();
      d.ctx.fillStyle = done ? UI.green : UI.gold; d.rr(44, y + 14, 220 * (have / g.target), 8, 4); d.ctx.fill();
      d.text(`${have}/${g.target}`, 316, y + 18, { size: 12, align: 'right', color: UI.inkSoft });
    });
    d.para(t.goalReward, 180, 398, 270, { size: 12, align: 'center', color: UI.inkSoft }, 16);
    d.button('close', 120, 420, 120, 40, L().close, { size: 15, fill: UI.parchDark });
  }

  private drawSetOut(d: Draw) {
    const s = this.app.s!, t = L().setout;
    d.dim(0.3);
    d.panel(10, 116, 340, 514);
    d.text(t.title, 180, 140, { size: 18, font: 'head', align: 'center' });
    d.text(fmt(t.space, { n: caravanSpace(s) }), 180, 160, { size: 12, align: 'center', color: UI.inkSoft });
    TOWN_IDS.forEach((id, i) => {
      const y = 176 + i * 74;
      const block = canSetOut(s, id, supplyCap(s));
      const open = block !== 'closed' && block !== 'friday';
      const sel = this.town === id;
      d.ctx.save();
      d.ctx.globalAlpha = open ? 1 : 0.5;
      d.panel(20, y, 320, 66, sel ? '#f6e3b4' : UI.parch, sel ? UI.gold : UI.panelEdge);
      d.text(L().towns[id], 34, y + 18, { size: 16, font: 'head' });
      d.text(fmt(t.days, { n: tripDays(id) }), 326, y + 18, { size: 12, align: 'right', color: UI.inkSoft });
      TOWNS[id].sells.forEach((x, k) => d.goodIcon(x.good, 46 + k * 40, y + 46, 0.55));
      d.ctx.restore();
      if (block === 'closed') d.text(fmt(t.closed, { season: L().seasons[TOWNS[id].opens - 1]! }), 326, y + 46, { size: 12, align: 'right', color: UI.red });
      else if (block === 'friday') d.text(t.friday, 326, y + 46, { size: 11.5, align: 'right', color: UI.red, maxWidth: 190 });
      if (open) d.area(`town-${id}`, 20, y, 320, 66);
    });
    const need = TOWNS[this.town].stops * 2;
    const y = 476;
    d.text(t.supplies, 30, y, { size: 15, font: 'head' });
    d.text(fmt(t.suppliesHint, { n: need }), 30, y + 18, { size: 11.5, color: UI.inkSoft });
    const total = s.supplies + this.supplies;
    d.button('sup-minus', 196, y - 16, 36, 34, '−', { fill: UI.parchDark, size: 18, disabled: this.supplies <= 0 });
    d.text(String(total), 252, y + 1, { size: 20, font: 'head', align: 'center', color: total < need ? UI.red : UI.ink });
    d.button('sup-plus', 272, y - 16, 36, 34, '+', { fill: UI.parchDark, size: 18, disabled: total >= supplyCap(s) || s.cash < (this.supplies + 1) * SUPPLY_PRICE });
    d.text(fmt(t.cost, { n: this.supplies * SUPPLY_PRICE }), 316, y + 1, { size: 12, color: UI.inkSoft });
    const ok = canSetOut(s, this.town, this.supplies) === null && s.cash >= this.supplies * SUPPLY_PRICE;
    d.button('go', 30, 560, 170, 50, t.go, { size: 18, disabled: !ok });
    d.button('stay', 210, 560, 120, 50, t.back, { size: 16, fill: UI.parchDark });
  }

  private openSetOut() {
    const s = this.app.s!;
    const open = (id: TownId) => canSetOut(s, id, supplyCap(s)) === null;
    this.pickTown(open(this.town) ? this.town : TOWN_IDS.find(open) ?? 'groves');
    this.mode = 'setout';
  }

  private pickTown(id: TownId) {
    const s = this.app.s!;
    this.town = id;
    this.supplies = Math.min(suggestedSupplies(s, id), Math.floor(s.cash / SUPPLY_PRICE));
  }

  press(id: string) {
    const app = this.app, s = app.s!;
    if (s.notices.length) { if (id === 'notice') s.notices.shift(); app.save(); return; }
    if (id === 'close') { this.mode = 'home'; return; }
    if (this.mode === 'setout') {
      if (id.startsWith('town-')) this.pickTown(id.slice(5) as TownId);
      if (id === 'sup-minus') this.supplies = Math.max(0, this.supplies - 1);
      if (id === 'sup-plus') this.supplies += 1;
      if (id === 'stay') this.mode = 'home';
      if (id === 'go' && setOut(s, this.town, this.supplies)) {
        emit('trip_start', { town: this.town, season: s.season, week: s.week });
        app.save();
        app.go(new TripScreen(app));
      }
      return;
    }
    if (id === 'notebook') this.mode = 'notebook';
    if (id === 'goals') this.mode = 'goals';
    if (id === 'setout') this.openSetOut();
    if (id === 'open') app.go(new ShopScreen(app));
  }
}
