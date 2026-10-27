// Year end at the bayt al-mal: value the storeroom, count, pay zakat, optional sadaqah,
// where zakat goes, and the end screen (gdd 6).

import { L, fmt, money } from '../../i18n';
import { emit, openZakatPage, share } from '../../platform/bridge';
import { clearGame } from '../../platform/storage';
import { NISAB, debtTotal, owedTotal, payYearEnd, totalProfit, valuations, yearEndCount, type StockValuation } from '../../sim';
import type { Draw } from '../../ui/draw';
import { UI } from '../../world/palette';
import type { App, Screen } from '../app';
import { toTitle } from '../flow';

type Step = 'intro' | 'value' | 'count' | 'sadaqah';
type Tag = 'paid' | 'market' | 'hoped';
const SADAQAH = [5, 10, 20];

export class BaytScreen implements Screen {
  camera = 'alley' as const;
  private step: Step = 'intro';
  private stacks: StockValuation[] = [];
  private stackIndex = 0;
  private reveal = 0;
  private wrong: Tag | null = null;

  constructor(private readonly app: App) {}

  enter() {
    this.app.world.placeWalker('bayt');
    this.app.world.setDayTime(40);
    this.stacks = valuations(this.app.s!);
    this.app.save();
  }

  frame(dt: number) {
    if (this.step === 'count') this.reveal += dt * (this.app.world.reduceMotion ? 100 : 2.5);
  }

  /** The three tags in a fixed but varied order, so the right one is not always in the same place. */
  private tagOrder(): Tag[] {
    const orders: Tag[][] = [['paid', 'market', 'hoped'], ['market', 'hoped', 'paid'], ['hoped', 'paid', 'market']];
    return orders[this.stackIndex % orders.length]!;
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().bayt;
    app.topBar(d, t.title);
    app.page(d, 86, 548);
    if (this.step === 'intro') {
      d.para(t.clerk, 180, 200, 270, { size: 17, align: 'center' }, 24);
      drawClerk(d, 180, 360);
      d.button('next', 90, 560, 180, 48, L().next, { size: 17 });
      return;
    }
    if (this.step === 'value') {
      d.text(t.valueTitle, 180, 116, { size: 19, font: 'head', align: 'center' });
      const v = this.stacks[this.stackIndex];
      if (!v) {
        d.para(t.noStock, 180, 220, 270, { size: 15, align: 'center' }, 20);
        d.button('next', 90, 560, 180, 48, L().next, { size: 17 });
        return;
      }
      d.text(t.valueHint, 180, 142, { size: 13, align: 'center', color: UI.inkSoft });
      d.text(`${this.stackIndex + 1} / ${this.stacks.length}`, 320, 116, { size: 11, align: 'right', color: UI.inkSoft });
      d.goodIcon(v.good, 180, 200, 1.6);
      d.text(`${L().goods[v.good]} ×${v.qty}`, 180, 246, { size: 17, font: 'head', align: 'center' });
      this.tagOrder().forEach((tag, i) => {
        const label = tag === 'paid' ? fmt(t.tagPaid, { n: money(v.paid) }) : tag === 'market' ? fmt(t.tagMarket, { n: v.market }) : fmt(t.tagHoped, { n: v.hoped });
        d.button(`tag-${tag}`, 50, 280 + i * 62, 260, 50, label, { fill: this.wrong === tag ? '#e7b9a8' : UI.parchDark, size: 14 });
      });
      if (this.wrong) d.para(this.wrong === 'paid' ? t.wrongPaid : t.wrongHoped, 180, 480, 270, { size: 13, align: 'center', color: UI.red }, 17);
      return;
    }
    if (this.step === 'count') {
      const r = yearEndCount(s);
      const stock = this.stacks.reduce((a, v) => a + v.qty * v.market, 0);
      const owed = owedTotal(s);
      const debts = debtTotal(s);
      const rows: Array<[string, string, boolean?]> = [
        [t.cash, money(s.cash)],
        [t.stock, `+${money(stock)}`],
        [t.owed, `+${money(owed)}`],
        [t.debts, `−${money(debts)}`],
        [t.total, money(r.zakatableTotal), true],
        [t.nisab, String(NISAB)],
      ];
      if (r.aboveNisab) rows.push([t.due, money(r.zakat), true]);
      let y = 130;
      rows.forEach(([k, v, bold], i) => {
        if (i >= this.reveal) return;
        d.ledgerRow(k, v, 34, y, 292, { bold });
        y += 34;
      });
      if (this.reveal >= rows.length) {
        y = d.para(fmt(t.fixtures, { n: money(s.upgradesSpent) }), 180, y + 14, 280, { size: 11.5, align: 'center', color: UI.inkSoft }, 15);
        if (s.rikazPaid > 0) y = d.para(fmt(t.rikaz, { n: money(s.rikazPaid) }), 180, y + 6, 280, { size: 11.5, align: 'center', color: UI.inkSoft }, 15);
        if (!r.aboveNisab) d.para(t.under, 180, y + 12, 270, { size: 14, align: 'center' }, 18);
        else d.para(t.paid, 180, y + 12, 270, { size: 13, align: 'center', color: UI.inkSoft }, 17);
        d.button('pay', 60, 560, 240, 48, r.aboveNisab ? fmt(t.pay, { n: money(Math.min(r.zakat, s.cash)) }) : t.continue, { size: 17 });
      }
      return;
    }
    // Sadaqah, shown apart from zakat so the difference is clear (gdd 6.1 step 8).
    const r = yearEndCount(s);
    const cashAfter = s.cash - Math.min(r.zakat, s.cash);
    d.text(t.sadaqahTitle, 180, 130, { size: 22, font: 'head', align: 'center' });
    d.para(t.sadaqahBody, 180, 180, 270, { size: 15, align: 'center' }, 20);
    SADAQAH.forEach((n, i) => d.button(`give-${n}`, 50, 280 + i * 60, 260, 48, fmt(t.give, { n }), { size: 16, disabled: cashAfter < n }));
    d.button('give-0', 50, 470, 260, 48, t.none, { fill: UI.parchDark, size: 15 });
  }

  press(id: string) {
    const app = this.app, s = app.s!;
    if (this.step === 'intro' && id === 'next') { this.step = 'value'; return; }
    if (this.step === 'value') {
      if (id === 'next') { this.step = 'count'; this.reveal = 0; return; }
      if (!id.startsWith('tag-')) return;
      const tag = id.slice(4) as Tag;
      if (tag !== 'market') { this.wrong = tag; return; }
      this.wrong = null;
      this.stackIndex++;
      if (this.stackIndex >= this.stacks.length) { this.step = 'count'; this.reveal = 0; }
      return;
    }
    if (this.step === 'count' && id === 'pay') {
      if (yearEndCount(s).aboveNisab) { this.step = 'sadaqah'; return; }
      this.finish(0);
      return;
    }
    if (this.step === 'sadaqah' && id.startsWith('give-')) this.finish(Number(id.slice(5)));
  }

  private finish(sadaqah: number) {
    const app = this.app, s = app.s!;
    payYearEnd(s, sadaqah);
    const y = s.yearEnd!;
    emit('zakat_paid', { amount_dirham: y.paid, total: Math.round(y.result.zakatableTotal) });
    if (y.sadaqah > 0) emit('sadaqah_given', { amount_dirham: y.sadaqah });
    app.save();
    app.go(new AsnafScreen(app));
  }
}

function drawClerk(d: Draw, x: number, y: number) {
  const c = d.ctx;
  c.save();
  c.fillStyle = '#7a5232'; d.rr(x - 80, y + 20, 160, 16, 4); c.fill();
  c.fillStyle = '#3d4f7c'; c.beginPath(); c.moveTo(x - 22, y + 20); c.lineTo(x - 14, y - 30); c.lineTo(x + 14, y - 30); c.lineTo(x + 22, y + 20); c.fill();
  c.fillStyle = '#9c6b4a'; c.beginPath(); c.arc(x, y - 44, 13, 0, 7); c.fill();
  c.fillStyle = '#e9dcc0'; c.beginPath(); c.arc(x, y - 48, 14, Math.PI, 0); c.fill();
  c.fillStyle = '#f2e4c4'; d.rr(x + 30, y + 8, 34, 12, 2); c.fill();
  c.restore();
}

/** Two faceless figures with a coin passing between them. */
function drawGiving(d: Draw, x: number, y: number, i: number) {
  const c = d.ctx;
  c.save();
  const robes = ['#3d4f7c', '#a8432f', '#6b5a3e', '#7d8c5c', '#5b6f7a', '#8a7a5a', '#d9a431', '#3d4f7c'];
  for (const [dx, col] of [[-50, robes[i]!], [50, robes[(i + 3) % 8]!]] as const) {
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x + dx - 26, y + 50); c.lineTo(x + dx - 14, y - 20); c.lineTo(x + dx + 14, y - 20); c.lineTo(x + dx + 26, y + 50); c.fill();
    c.fillStyle = '#9c6b4a'; c.beginPath(); c.arc(x + dx, y - 34, 13, 0, 7); c.fill();
    c.fillStyle = '#e9dcc0'; c.beginPath(); c.arc(x + dx, y - 37, 14.5, Math.PI, 0); c.fill();
  }
  d.coin(x, y - 4, 10);
  c.restore();
}

export class AsnafScreen implements Screen {
  camera = 'orbit' as const;
  private i = 0;

  constructor(private readonly app: App) {}

  enter() {
    this.app.world.setDayTime(42);
  }

  draw(d: Draw) {
    const t = L().asnaf, s = this.app.s!;
    d.dim(0.2);
    d.panel(24, 120, 312, 400);
    d.text(t.title, 180, 148, { size: 13, align: 'center', color: UI.inkSoft, weight: 800 });
    d.text(`${this.i + 1} / 8`, 318, 148, { size: 11, align: 'right', color: UI.inkSoft });
    d.text(t.names[this.i]!, 180, 184, { size: 22, font: 'head', align: 'center' });
    drawGiving(d, 180, 290, this.i);
    d.para(t.scenes[this.i]!, 180, 384, 270, { size: 15, align: 'center' }, 20);
    if (s.yearEnd && !s.yearEnd.result.aboveNisab) d.para(t.others, 180, 470, 270, { size: 12, align: 'center', color: UI.inkSoft }, 16);
    d.text(L().tapToContinue, 180, 560, { size: 13, color: UI.parch, align: 'center' });
    d.area('next', 0, 0, 360, 640);
  }

  press(id: string) {
    if (id !== 'next') return;
    if (this.i < 7) { this.i++; return; }
    this.app.go(new EndScreen(this.app));
  }
}

export class EndScreen implements Screen {
  camera = 'orbit' as const;

  constructor(private readonly app: App) {}

  enter() {
    const s = this.app.s!;
    this.app.world.setDayTime(30);
    emit('game_finish', { minutes_played: s.minutesStart ? Math.round((Date.now() - s.minutesStart) / 60000) : 0 });
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().end, y = s.yearEnd!;
    d.dim(0.2);
    d.panel(24, 70, 312, 520);
    d.text(t.title, 180, 104, { size: 24, font: 'head', align: 'center' });
    const rows: Array<[string, string]> = [
      [t.profit, `${money(totalProfit(s))} ${L().dirham}`],
      [t.amanah, String(Math.round(s.amanah))],
      [t.zakat, `${money(y.paid)} ${L().dirham}`],
      [t.sadaqah, `${money(y.sadaqah)} ${L().dirham}`],
      [t.helped, String(s.flags.helpedTotal ?? 0)],
    ];
    rows.forEach(([k, v], i) => d.ledgerRow(k, v, 46, 150 + i * 36, 268));
    d.ctx.fillStyle = UI.parchDark; d.rr(40, 320, 280, 62, 8); d.ctx.fill();
    d.para(t.line, 180, 340, 250, { size: 15, align: 'center', font: 'head' }, 20);
    d.button('cta', 50, 396, 260, 50, t.cta, { size: 17 });
    d.button('share', 50, 458, 125, 44, t.share, { fill: UI.parchDark, size: 14 });
    d.button('again', 185, 458, 125, 44, t.again, { fill: UI.parchDark, size: 14 });
  }

  press(id: string) {
    const s = this.app.s!, y = s.yearEnd!;
    if (id === 'cta') openZakatPage();
    if (id === 'share') void share(fmt(L().end.shareText, { profit: money(totalProfit(s)), amanah: Math.round(s.amanah), zakat: money(y.paid) }));
    if (id === 'again') { clearGame(); this.app.s = null; toTitle(this.app); }
  }
}
