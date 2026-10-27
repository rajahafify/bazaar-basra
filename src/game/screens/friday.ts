// Friday: the market is closed. The week's ledger, rent and debts, then the carpenter and the
// caravan master for upgrades, and the season's main quest. If the rent
// can't be paid even after selling stock to the wholesaler, the stall is lost.

import { L, fmt, money } from '../../i18n';
import { emit } from '../../platform/bridge';
import { clearGame } from '../../platform/storage';
import {
  MAIN_QUESTS, UPGRADES, buyUpgrade, dayIndex, endFriday, mainProgress, mainQuestDone, retrySeason, settleFriday,
  upgradeCost, type Season, type FridayResult, type UpgradeId, type WeekEnd,
} from '../../sim';
import type { Draw } from '../../ui/draw';
import { UI } from '../../world/palette';
import type { App, Screen } from '../app';
import { afterDay, toTitle } from '../flow';

type Step = 'ledger' | 'upgrades' | 'season';
const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];

export class FridayScreen implements Screen {
  camera = 'bazaar' as const;
  private step: Step = 'ledger';
  private result: FridayResult | null = null;
  private weekEnd: WeekEnd | null = null;

  constructor(private readonly app: App) {}

  enter() {
    const app = this.app, s = app.s!;
    app.world.clearCustomers();
    app.world.setDayTime(44);
    if (s.flags.fridaySettled === dayIndex(s)) { this.step = 'upgrades'; return; }
    this.result = settleFriday(s);
    if (this.result.broke) {
      emit('went_broke', { season: s.season, week: s.week });
      app.save();
      app.go(new BrokeScreen(app));
      return;
    }
    s.flags.fridaySettled = dayIndex(s);
    emit('week_end', { season: s.season, week: s.week, cash: Math.round(s.cash) });
    app.save();
  }

  draw(d: Draw) {
    const app = this.app, t = L().friday;
    app.topBar(d, app.calendar(), t.sub);
    app.amanahBar(d);
    if (this.step === 'ledger') this.drawLedger(d);
    else if (this.step === 'upgrades') this.drawUpgrades(d);
    else this.drawSeason(d);
  }

  private drawLedger(d: Draw) {
    const s = this.app.s!, t = L().friday, r = this.result!, w = s.week_;
    this.app.page(d, 120, 508);
    d.text(t.title, 180, 146, { size: 20, font: 'head', align: 'center' });
    const profit = w.revenue - w.costOfSold - w.supplies;
    const rows: Array<[string, string, { bold?: boolean; color?: string }?]> = [
      [t.revenue, money(w.revenue)],
      [t.cost, `−${money(w.costOfSold)}`],
      [t.supplies, `−${money(w.supplies)}`],
      [t.profit, money(profit), { bold: true, color: profit >= 0 ? UI.green : UI.red }],
      [t.rent, `−${money(r.rentPaid)}`],
    ];
    if (r.debtsPaid) rows.push([t.debts, `−${money(r.debtsPaid)}`]);
    if (r.mudarabahPaid) rows.push([t.partner, `−${money(r.mudarabahPaid)}`]);
    if (r.debtsLate) rows.push([t.late, money(r.debtsLate), { color: UI.red }]);
    rows.push([t.cash, money(s.cash), { bold: true }]);
    let y = 178;
    for (const [k, v, o] of rows) { d.ledgerRow(k, v, 34, y, 292, o ?? {}); y += 30; }
    const notes: string[] = [];
    if (r.wholesale.units) notes.push(fmt(t.wholesale, { n: r.wholesale.units }));
    for (const o of r.ordersFilled) {
      const vars = { qty: o.order.qty, good: L().goods[o.order.good] };
      notes.push(o.result === 'filled' ? fmt(t.orderFilled, vars) : o.result === 'backedOut' ? t.orderBackedOut : fmt(t.orderShort, vars));
    }
    for (const n of notes) y = d.para(n, 180, y + 6, 280, { size: 12.5, align: 'center', color: UI.inkSoft }, 16);
    d.button('next', 90, 566, 180, 48, L().next, { size: 17 });
  }

  private drawUpgrades(d: Draw) {
    const s = this.app.s!, t = L().friday;
    this.app.page(d, 120, 508);
    d.text(t.upgrades, 180, 144, { size: 17, font: 'head', align: 'center' });
    UPGRADE_IDS.forEach((id, i) => {
      const y = 160 + i * 58;
      const cost = upgradeCost(s, id);
      d.text(t.upgradeNames[id], 30, y + 14, { size: 14, font: 'head' });
      d.para(t.upgradeText[id], 30, y + 32, 210, { size: 11.5, color: UI.inkSoft, align: 'left' }, 14);
      if (cost === null) d.text(t.owned, 300, y + 22, { size: 13, align: 'center', color: UI.green, weight: 800 });
      else d.button(`up-${id}`, 254, y + 4, 86, 38, fmt(t.buy, { n: cost }), { size: 15, disabled: s.cash < cost });
    });
    const gy = 456;
    const main = MAIN_QUESTS[s.season];
    d.text(`${t.goals} · ${L().quests.mainTitles[s.season - 1]}`, 30, gy, { size: 13, weight: 800, color: UI.inkSoft, maxWidth: 220 });
    d.text(mainQuestDone(s) ? L().quests.done : fmt(L().quests.reward, { n: main.reward }), 330, gy, { size: 11.5, align: 'right', color: mainQuestDone(s) ? UI.green : UI.inkSoft });
    const done = mainProgress(s);
    main.objectives.forEach((g, i) => {
      const have = Math.min(g.target, Math.round(s.counters[g.counter]));
      d.text(`${done[i] ? '✓' : '·'} ${fmt(t.goalNames[g.counter], { n: g.target })}`, 30, gy + 22 + i * 20, { size: 12.5, color: done[i] ? UI.green : UI.ink });
      d.text(`${have}/${g.target}`, 330, gy + 22 + i * 20, { size: 12, align: 'right', color: UI.inkSoft });
    });
    d.button('week', 90, 566, 180, 48, t.next, { size: 17 });
  }

  private drawSeason(d: Draw) {
    const s = this.app.s!, t = L().friday, w = this.weekEnd!;
    const h = 220;
    const y = this.app.modal(d, h, 0.4);
    // endFriday has moved the season on, unless the year ended.
    const ended = w.yearEnded ? s.season : s.season - 1;
    d.text(fmt(t.seasonTitle, { season: L().seasons[ended - 1]! }), 180, y + 34, { size: 20, font: 'head', align: 'center' });
    d.coin(180, y + 80, 18);
    const text = w.mainDone ? fmt(t.mainDone, { n: MAIN_QUESTS[ended as Season].reward }) : t.mainMissed;
    d.para(text, 180, y + 118, 270, { size: 15, align: 'center' }, 20);
    d.button('season', 100, y + h - 52, 160, 42, w.yearEnded ? t.yearEnd : L().next, { size: 16 });
  }

  press(id: string) {
    const app = this.app, s = app.s!;
    if (this.step === 'ledger' && id === 'next') { this.step = 'upgrades'; return; }
    if (this.step === 'upgrades') {
      if (id.startsWith('up-')) {
        const up = id.slice(3) as UpgradeId;
        if (buyUpgrade(s, up)) {
          emit('upgrade_buy', { upgrade: up, level: s.upgrades[up] });
          if (up === 'camel') app.world.setStallCamels(s.upgrades.camel);
          if (up === 'shelf') app.world.setShelves(s.slots.map(sl => (sl.qty > 0 ? sl.good : null)));
          app.save();
        }
      }
      if (id === 'week') {
        this.weekEnd = endFriday(s);
        delete s.flags.fridaySettled;
        app.save();
        if (this.weekEnd.seasonEnded) this.step = 'season';
        else afterDay(app);
      }
      return;
    }
    if (this.step === 'season' && id === 'season') afterDay(app);
  }
}

export class BrokeScreen implements Screen {
  camera = 'bazaar' as const;

  constructor(private readonly app: App) {}

  enter() {
    this.app.world.clearCustomers();
    this.app.world.setDayTime(46);
    this.app.world.setShelves(this.app.s!.slots.map(() => null));
  }

  draw(d: Draw) {
    const t = L().broke, s = this.app.s!;
    const bodyH = d.lines(t.body, 270, { size: 15 }) * 20;
    const lessonH = d.lines(t.lesson, 250, { size: 13 }) * 17 + 20;
    const h = 70 + bodyH + 14 + lessonH + 140;
    let y = this.app.modal(d, h, 0.5);
    d.text(t.title, 180, y + 36, { size: 22, font: 'head', align: 'center' });
    d.para(t.body, 180, y + 68, 270, { size: 15, align: 'center' }, 20);
    y += 70 + bodyH + 8;
    d.ctx.fillStyle = UI.parchDark; d.rr(40, y, 280, lessonH, 8); d.ctx.fill();
    d.para(t.lesson, 180, y + 20, 250, { size: 13, align: 'center' }, 17);
    y += lessonH + 16;
    if (s.seasonSave) d.button('retry', 50, y, 260, 48, t.retry, { size: 16 });
    d.button('restart', 50, y + 60, 260, 44, t.restart, { size: 15, fill: UI.parchDark });
  }

  press(id: string) {
    const app = this.app, s = app.s!;
    if (id === 'retry') {
      const back = retrySeason(s);
      if (back) { app.s = back; afterDay(app); return; }
    }
    if (id === 'restart') { clearGame(); app.s = null; toTitle(app); }
  }
}
