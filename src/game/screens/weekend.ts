// Title, prologue, and the weekend: stall, alleys, source, cart, ride home, weekend ledger.

import { L, fmt, lang, money } from '../../i18n';
import { emit } from '../../platform/bridge';
import { clearGame, loadGame } from '../../platform/storage';
import {
  CARTS, STALLS, chooseSource, finishPrologue, hireCart, newGame, rentStall, rideHome, sourceChoices, stallChoices,
  startWeek, type CartId, type SourceId, type StallId,
} from '../../sim';
import { LH, LW, signed, type Draw } from '../../ui/draw';
import { UI } from '../../world/palette';
import type { PlaceId } from '../../world/scenes';
import type { App, Screen } from '../app';
import { next, resume } from '../flow';
import { BuyScreen } from './buy';
import { ShopScreen } from './shop';

export class TitleScreen implements Screen {
  camera = 'orbit' as const;
  private readonly saved = loadGame();

  constructor(private readonly app: App) {}

  enter() {
    this.app.world.setDayTime(30);
  }

  draw(d: Draw) {
    const t = L().title;
    d.panel(30, 150, 300, 150);
    d.text(t.name, 180, 200, { size: 34, font: 'head', align: 'center' });
    d.text(t.tagline, 180, 240, { size: 15, align: 'center', color: UI.inkSoft });
    d.ctx.strokeStyle = UI.gold; d.ctx.lineWidth = 2;
    d.ctx.beginPath(); d.ctx.moveTo(110, 268); d.ctx.lineTo(250, 268); d.ctx.stroke();
    d.coin(180, 268, 6);
    const y = 440;
    if (this.saved && this.saved.phase !== 'done') {
      d.button('continue', 60, y, 240, 48, t.continue, { size: 20 });
      d.button('play', 60, y + 60, 240, 44, t.play, { fill: UI.parchDark, size: 16 });
    } else {
      d.button('play', 60, y + 20, 240, 52, t.play, { size: 20 });
    }
    d.button('lang', 110, 570, 140, 44, t.lang, { fill: UI.parchDark, size: 14 });
  }

  press(id: string) {
    if (id === 'continue' && this.saved) { this.app.s = this.saved; resume(this.app); }
    if (id === 'play') {
      clearGame();
      this.app.s = newGame(Math.floor(Math.random() * 2 ** 31), Date.now());
      this.app.started();
      this.app.go(new PrologueScreen(this.app));
    }
  }
}

export class PrologueScreen implements Screen {
  camera = 'bazaar' as const;
  private page = 0;

  constructor(private readonly app: App) {}

  enter() {
    this.app.world.setDayTime(4);
    this.app.world.setShelves([null, null]);
  }

  draw(d: Draw) {
    const pages = L().prologue;
    d.dim(0.25);
    const text = pages[this.page]!;
    const lines = d.lines(text, 270, { size: 17 });
    const h = 70 + lines * 24;
    d.panel(30, 320 - h / 2, 300, h);
    d.para(text, 180, 320 - h / 2 + 30, 270, { size: 17, align: 'center' }, 24);
    for (let i = 0; i < pages.length; i++) {
      d.ctx.fillStyle = i === this.page ? UI.gold : UI.parchDark;
      d.ctx.beginPath(); d.ctx.arc(180 + (i - (pages.length - 1) / 2) * 14, 320 + h / 2 - 18, 4, 0, 7); d.ctx.fill();
    }
    d.text(L().tapToContinue, 180, 600, { size: 13, color: UI.parch, align: 'center' });
    d.area('next', 0, 0, LW, LH);
    d.button('lang', 296, 16, 44, 24, lang() === 'ms' ? 'EN' : 'BM', { fill: UI.parchDark, size: 11 });
  }

  press(id: string) {
    if (id !== 'next') return;
    if (this.page < L().prologue.length - 1) { this.page++; return; }
    finishPrologue(this.app.s!);
    this.app.save();
    this.app.go(new AlleyScreen(this.app, 'gate'));
  }
}

export class StallScreen implements Screen {
  camera = 'bazaar' as const;

  constructor(private readonly app: App) {}

  enter() {
    this.app.world.setDayTime(6);
    this.app.world.clearCustomers();
    this.app.save();
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().stall;
    app.topBar(d, app.weekTitle());
    app.amanahBar(d);
    d.bar(6, 236, 348, 398);
    d.text(t.title, 180, 258, { size: 16, font: 'head', align: 'center', color: UI.parch });
    const open = stallChoices(s);
    (['small', 'medium', 'big'] as StallId[]).forEach((id, i) => {
      const st = STALLS[id];
      const y = 278 + i * 116;
      const enabled = open.includes(id);
      d.ctx.save();
      d.ctx.globalAlpha = enabled ? 1 : 0.5;
      d.panel(16, y, 328, 106, id === s.stall ? '#f6ead0' : UI.parch);
      d.text(t[id], 30, y + 22, { size: 17, font: 'head' });
      d.text(t.where[id], 30, y + 44, { size: 12.5, color: UI.inkSoft });
      d.text(fmt(t.shelves, { n: st.shelves }), 30, y + 66, { size: 13 });
      d.text(fmt(t.customers, { a: st.customers[0], b: st.customers[1] }), 30, y + 86, { size: 13, color: UI.inkSoft });
      d.ctx.restore();
      if (enabled) d.button(`rent-${id}`, 230, y + 54, 100, 44, fmt(t.rent, { n: st.rent }), { size: 14 });
      else d.text(fmt(L().weekLabel, { week: st.fromWeek, season: L().seasons[st.fromWeek - 1]! }), 330, y + 76, { size: 11, color: UI.inkSoft, align: 'right' });
    });
  }

  press(id: string) {
    if (!id.startsWith('rent-')) return;
    const s = this.app.s!;
    const stall = id.slice(5) as StallId;
    const loanBefore = s.debts.find(x => x.who === 'qardHasan')?.amount ?? 0;
    rentStall(s, stall);
    const loan = (s.debts.find(x => x.who === 'qardHasan')?.amount ?? 0) - loanBefore;
    if (loan > 0) this.app.toast(fmt(L().stall.loan, { n: loan }), 4);
    emit('stall_rent', { week: s.week, stall });
    this.app.save();
    this.app.go(new AlleyScreen(this.app, 'gate'));
  }
}

/** The alleys: walk to the city gate at the weekend, or to the bayt al-mal at year end (gdd 3.1). */
export class AlleyScreen implements Screen {
  camera = 'alley' as const;

  constructor(private readonly app: App, private readonly goal: 'gate' | 'bayt') {}

  enter() {
    this.app.world.setDayTime(this.goal === 'bayt' ? 40 : 8);
    this.app.world.placeWalker('market');
  }

  draw(d: Draw) {
    const app = this.app, w = app.world, t = L().alley;
    for (const k of ['gate', 'bayt', 'market'] as PlaceId[]) {
      const [x, y, z] = w.placeScreen(k);
      if (z > 1 || x < -40 || x > LW + 40 || y < 110 || y > 440) continue;
      const label = L().places[k];
      const bw = d.measure(label, { size: 13, font: 'head' }) + 36;
      d.ctx.save();
      d.ctx.fillStyle = UI.parch; d.ctx.strokeStyle = UI.panelEdge; d.ctx.lineWidth = 2;
      d.rr(x - bw / 2, y - 30, bw, 26, 7); d.ctx.fill(); d.ctx.stroke();
      d.ctx.beginPath(); d.ctx.moveTo(x - 5, y - 5); d.ctx.lineTo(x, y + 2); d.ctx.lineTo(x + 5, y - 5); d.ctx.fill();
      d.placeIcon(k, x - bw / 2 + 14, y - 17);
      d.text(label, x - bw / 2 + 26, y - 16, { size: 13, font: 'head' });
      d.ctx.restore();
      if (w.arrived !== k && !w.walking) d.area(`go-${k}`, x - bw / 2, y - 34, bw, 38);
    }
    app.topBar(d, t.title, t.hint);
    const py = 470;
    d.bar(6, py - 8, 348, 170);
    d.panel(14, py, 332, 74);
    const at = w.walking ? null : w.arrived;
    if (at) {
      d.placeIcon(at, 34, py + 22);
      d.text(L().places[at], 50, py + 21, { size: 16, font: 'head' });
      const msg = at === 'bayt' && this.goal !== 'bayt' ? t.notYet : t.arrive[at];
      d.para(msg, 26, py + 44, 310, { size: 12.5, color: UI.inkSoft }, 15);
    } else {
      d.text(t.walking, 180, py + 37, { size: 15, align: 'center', color: UI.inkSoft });
    }
    (['market', 'bayt', 'gate'] as PlaceId[]).forEach((k, i) => {
      d.button(`go-${k}`, 14 + i * 112, py + 86, 104, 34, L().places[k], {
        fill: w.arrived === k && !w.walking ? UI.gold : UI.parchDark, size: 13, disabled: w.walking || w.arrived === k,
      });
    });
    if (at === this.goal) {
      d.button('enter', 70, py + 128, 220, 32, this.goal === 'gate' ? t.toGate : t.enterBayt, { size: 14 });
    }
  }

  press(id: string) {
    if (id.startsWith('go-')) this.app.world.walkTo(id.slice(3) as PlaceId);
    if (id === 'enter') {
      if (this.goal === 'gate') next.source(this.app);
      else next.bayt(this.app);
    }
  }
}

export class SourceScreen implements Screen {
  camera = 'alley' as const;

  constructor(private readonly app: App) {}

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().source;
    app.topBar(d, app.weekTitle());
    const crier = s.week === 2 ? t.crier2 : s.week === 3 ? t.crier3 : s.week === 4 ? t.crier4 : null;
    if (crier) app.crier(d, crier, 84);
    d.bar(6, 200, 348, 434);
    d.text(t.title, 180, 224, { size: 15, font: 'head', align: 'center', color: UI.parch });
    const open = sourceChoices(s);
    (['groves', 'port', 'bedouin'] as SourceId[]).forEach((id, i) => {
      const y = 246 + i * 128;
      const enabled = open.includes(id);
      d.ctx.save();
      d.ctx.globalAlpha = enabled ? 1 : 0.5;
      d.panel(16, y, 328, 116);
      drawSourceArt(d, id, 70, y + 58);
      d.text(t[id], 132, y + 30, { size: 17, font: 'head' });
      d.text(t[`${id}Sells`], 132, y + 54, { size: 13, color: UI.inkSoft, maxWidth: 200 });
      d.ctx.restore();
      if (enabled) d.button(`src-${id}`, 132, y + 70, 120, 36, L().next, { size: 14 });
      else d.text(fmt(L().weekLabel, { week: 3, season: L().seasons[2]! }), 132, y + 86, { size: 12, color: UI.inkSoft });
    });
  }

  press(id: string) {
    if (!id.startsWith('src-')) return;
    chooseSource(this.app.s!, id.slice(4) as SourceId);
    this.app.go(new CartScreen(this.app));
  }
}

function drawSourceArt(d: Draw, id: SourceId, x: number, y: number) {
  const c = d.ctx;
  c.save();
  c.fillStyle = '#e8cd9c'; d.rr(x - 50, y - 46, 100, 92, 8); c.fill();
  if (id === 'groves') {
    for (const [dx, h] of [[-26, 38], [0, 46], [26, 36]] as const) {
      c.fillStyle = '#8a6a45'; c.fillRect(x + dx - 2, y + 30 - h, 4, h);
      c.fillStyle = '#56723c';
      for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(x + dx + Math.cos(k * 1.3) * 8, y + 30 - h + Math.sin(k * 1.3) * 3, 10, 3, k * 1.3, 0, 7); c.fill(); }
    }
  } else if (id === 'port') {
    c.fillStyle = '#5a8f99'; c.fillRect(x - 50, y + 6, 100, 40);
    c.fillStyle = '#7a5232'; c.beginPath(); c.moveTo(x - 24, y + 6); c.lineTo(x + 24, y + 6); c.lineTo(x + 16, y + 18); c.lineTo(x - 16, y + 18); c.fill();
    c.fillStyle = '#e9dcc0'; c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x, y + 4); c.lineTo(x + 20, y + 4); c.fill();
  } else {
    c.fillStyle = '#6b5a3e'; c.beginPath(); c.moveTo(x - 34, y + 30); c.lineTo(x, y - 18); c.lineTo(x + 34, y + 30); c.fill();
    c.fillStyle = '#3d4f7c'; c.fillRect(x - 6, y + 10, 12, 20);
  }
  c.restore();
}

export class CartScreen implements Screen {
  camera = 'alley' as const;

  constructor(private readonly app: App) {}

  draw(d: Draw) {
    const app = this.app, t = L().cart;
    app.topBar(d, app.weekTitle());
    d.bar(6, 120, 348, 514);
    d.text(t.title, 180, 144, { size: 16, font: 'head', align: 'center', color: UI.parch });
    const match: Record<CartId, StallId> = { handcart: 'small', donkey: 'medium', camels: 'big' };
    (['handcart', 'donkey', 'camels'] as CartId[]).forEach((id, i) => {
      const cart = CARTS[id];
      const y = 166 + i * 152;
      d.panel(16, y, 328, 140);
      d.text(t[id], 30, y + 24, { size: 17, font: 'head' });
      d.text(fmt(t.grid, { c: cart.cols, r: cart.rows }), 30, y + 48, { size: 13 });
      d.text(fmt(t.match, { stall: L().stall[match[id]].toLowerCase() }), 30, y + 68, { size: 12, color: UI.inkSoft, maxWidth: 180 });
      const cell = 14, gx = 330 - cart.cols * cell, gy = y + 16;
      for (let r = 0; r < cart.rows; r++) for (let c = 0; c < cart.cols; c++) {
        d.ctx.fillStyle = UI.parchDark; d.ctx.strokeStyle = UI.inkSoft; d.ctx.lineWidth = 1;
        d.ctx.fillRect(gx + c * cell, gy + r * cell, cell - 2, cell - 2);
      }
      d.button(`cart-${id}`, 30, y + 86, 150, 44, fmt(t.hire, { n: cart.hire }), { size: 15, fill: match[id] === app.s!.stall ? UI.gold : UI.parchDark });
    });
  }

  press(id: string) {
    if (!id.startsWith('cart-')) return;
    const s = this.app.s!;
    const cart = id.slice(5) as CartId;
    hireCart(s, cart);
    emit('cart_hire', { week: s.week, cart });
    this.app.go(new BuyScreen(this.app));
  }
}

/** A short ride on the map; unpadded jars may crack (gdd 3.6). */
export class RideScreen implements Screen {
  camera = 'alley' as const;
  private t = 0;
  private done = false;
  private readonly duration: number;

  constructor(private readonly app: App) {
    this.duration = app.world.reduceMotion ? 0.5 : 6;
  }

  frame(dt: number) {
    if (this.done) return;
    this.t += dt;
    if (this.t >= this.duration) {
      this.done = true;
      rideHome(this.app.s!);
      this.app.save();
    }
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().ride;
    app.topBar(d, t.title);
    d.dim(0.3);
    d.panel(20, 110, 320, 330, '#ead7ae');
    const c = d.ctx;
    // The map: river, the town, the source, and the road between.
    c.fillStyle = '#5a8f99'; c.beginPath(); c.moveTo(250, 110); c.bezierCurveTo(220, 220, 300, 300, 260, 440); c.lineTo(340, 440); c.lineTo(340, 110); c.fill();
    c.fillStyle = '#c59a6a'; d.rr(60, 340, 70, 60, 6); c.fill();
    d.text(L().places.market, 95, 412, { size: 12, align: 'center', font: 'head' });
    const src = s.weekend.source ?? 'groves';
    const from: [number, number] = src === 'port' ? [270, 160] : src === 'bedouin' ? [70, 150] : [180, 160];
    d.text(L().source[src], from[0], from[1] - 22, { size: 12, align: 'center', font: 'head' });
    c.strokeStyle = '#8a6a45'; c.lineWidth = 3; c.setLineDash([6, 6]);
    c.beginPath(); c.moveTo(from[0], from[1]); c.quadraticCurveTo(200, 290, 95, 360); c.stroke(); c.setLineDash([]);
    const k = Math.min(1, this.t / this.duration);
    const px = (1 - k) * (1 - k) * from[0] + 2 * (1 - k) * k * 200 + k * k * 95;
    const py = (1 - k) * (1 - k) * from[1] + 2 * (1 - k) * k * 290 + k * k * 360;
    c.fillStyle = '#7a5232'; d.rr(px - 12, py - 8, 24, 14, 3); c.fill();
    c.fillStyle = '#2e2015'; c.beginPath(); c.arc(px - 7, py + 7, 4, 0, 7); c.arc(px + 7, py + 7, 4, 0, 7); c.fill();
    if (this.done) {
      const broken = s.weekend.ledger?.broken.length ?? 0;
      const msg = broken === 0 ? t.whole : fmt(broken === 1 ? t.broken : t.brokenMany, { n: broken });
      d.panel(30, 460, 300, 70);
      d.para(msg, 180, 484, 270, { size: 14, align: 'center' }, 18);
      d.button('next', 90, 552, 180, 46, L().next, { size: 17 });
    }
  }

  press(id: string) {
    if (id === 'next' && this.done) this.app.go(new WeekendLedgerScreen(this.app));
  }
}

/** Every purchase as a line with its landed cost (gdd 3.5). */
export class WeekendLedgerScreen implements Screen {
  camera = 'alley' as const;
  private reveal = 0;

  constructor(private readonly app: App) {}

  frame(dt: number) {
    this.reveal += dt * (this.app.world.reduceMotion ? 100 : 4);
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().weekendLedger, led = s.weekend.ledger!;
    app.topBar(d, app.weekTitle());
    app.page(d, 86, 548);
    d.text(t.title, 180, 112, { size: 19, font: 'head', align: 'center' });
    const x0 = 30, w = 300;
    let y = 144;
    d.text(t.colGood, x0, y, { size: 11, color: UI.inkSoft, weight: 800 });
    d.text(t.colBuy, x0 + 150, y, { size: 11, color: UI.inkSoft, weight: 800, align: 'right' });
    d.text(t.colHire, x0 + 222, y, { size: 11, color: UI.inkSoft, weight: 800, align: 'right' });
    d.text(t.colLanded, x0 + w, y, { size: 11, color: UI.inkSoft, weight: 800, align: 'right' });
    y += 24;
    let n = 0;
    const show = () => n++ < this.reveal;
    for (const l of led.lines) {
      if (!show()) break;
      d.goodIcon(l.good, x0 + 10, y, 0.55);
      d.text(`${L().goods[l.good]} ×${l.qty}`, x0 + 26, y, { size: 13 });
      d.text(money(l.buyEach), x0 + 150, y, { size: 13, align: 'right', font: 'head' });
      d.text(money(l.landedEach - l.buyEach), x0 + 222, y, { size: 13, align: 'right', font: 'head' });
      d.text(money(l.landedEach), x0 + w, y, { size: 14, align: 'right', font: 'head' });
      y += 26;
    }
    y += 8;
    const rows: Array<[string, string, boolean?]> = [
      [t.goods, money(led.goodsCost)],
      [t.hire, money(led.hire)],
      [t.total, money(led.goodsCost + led.hire), true],
    ];
    if (led.wastedHire > 0.01) rows.push([fmt(t.wasted, { n: led.cellsTotal - led.cellsUsed }), money(led.wastedHire)]);
    if (led.boughtOnCredit > 0) rows.push([t.credit, money(led.boughtOnCredit)]);
    for (const b of led.broken) rows.push([`${t.broken}: ${L().goods[b.good]}`, signed(-b.landed, money)]);
    for (const [label, val, bold] of rows) {
      if (!show()) break;
      d.ledgerRow(label, val, x0, y, w, { bold });
      y += 28;
    }
    if (n <= this.reveal) {
      d.para(t.note, 180, y + 14, 280, { size: 13, align: 'center', color: UI.inkSoft }, 17);
      d.button('next', 90, 564, 180, 46, t.toStall, { size: 17 });
    }
  }

  press(id: string) {
    if (id !== 'next') return;
    startWeek(this.app.s!);
    this.app.go(new ShopScreen(this.app));
  }
}
