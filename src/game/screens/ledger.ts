// The week's ledger, drawn as a merchant's book, lines writing themselves in (gdd 5, style guide 5.4).

import { L, fmt, money } from '../../i18n';
import { emit } from '../../platform/bridge';
import { currentWeekLedger, endWeek, stockValueLanded } from '../../sim';
import { signed, type Draw } from '../../ui/draw';
import type { App, Screen } from '../app';
import { AlleyScreen, StallScreen } from './weekend';

export class WeekLedgerScreen implements Screen {
  camera = 'bazaar' as const;
  private reveal = 0;

  constructor(private readonly app: App) {}

  enter() {
    this.app.world.clearCustomers();
    this.app.world.setDayTime(52);
  }

  frame(dt: number) {
    this.reveal += dt * (this.app.world.reduceMotion ? 100 : 3);
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().ledger;
    const l = currentWeekLedger(s);
    app.topBar(d, app.weekTitle());
    app.page(d, 86, 548);
    d.text(fmt(t.title, { week: s.week }), 180, 114, { size: 20, font: 'head', align: 'center' });
    const x = 34, w = 292;
    const rows: Array<[string, string, { bold?: boolean } ?]> = [
      [t.revenue, signed(l.revenue, money)],
      [t.cogs, signed(-l.costOfGoodsSold, money)],
      [t.rent, signed(-l.rent, money)],
    ];
    if (l.writtenOff > 0.01) rows.push([t.written, signed(-l.writtenOff, money)]);
    if (l.wastedHire > 0.01) rows.push([t.wasted, signed(-l.wastedHire, money)]);
    rows.push([t.profit, signed(l.profit, money), { bold: true }]);
    rows.push(['', '']);
    rows.push([t.cash, money(s.cash)]);
    rows.push([t.stock, money(stockValueLanded(s))]);
    const owed = s.receivables.reduce((a, r) => a + r.amount, 0);
    const owe = s.debts.reduce((a, r) => a + r.amount, 0);
    if (owed > 0) rows.push([t.owedToYou, money(owed)]);
    if (owe > 0) rows.push([t.youOwe, money(owe)]);
    rows.push([L().amanah, `${Math.round(s.weekStats.amanahStart)} → ${Math.round(s.amanah)}`]);
    let y = 152;
    rows.forEach(([label, val, o], i) => {
      if (i >= this.reveal) return;
      if (label) d.ledgerRow(label, val, x, y, w, o);
      y += label ? 30 : 14;
    });
    if (this.reveal >= rows.length) {
      d.button('next', 70, 566, 220, 48, s.week === 4 ? t.yearEnd : t.next, { size: 17 });
    }
    // Pen line down the money column, like a ruled book.
    d.ctx.strokeStyle = 'rgba(176,74,50,.35)'; d.ctx.lineWidth = 1;
    d.ctx.beginPath(); d.ctx.moveTo(x + w - 64, 134); d.ctx.lineTo(x + w - 64, 550); d.ctx.stroke();
  }

  press(id: string) {
    if (id !== 'next') return;
    const app = this.app, s = app.s!;
    const l = currentWeekLedger(s);
    emit('week_end', { week: s.week, profit: Math.round(l.profit), stall: s.stall });
    endWeek(s);
    app.save();
    if (s.phase === 'yearEnd') app.go(new AlleyScreen(app, 'bayt'));
    else app.go(new StallScreen(app));
  }
}
