// Title and prologue.

import { L, lang } from '../../i18n';
import { clearGame, loadGame } from '../../platform/storage';
import { finishPrologue, newGame } from '../../sim';
import { LH, LW, type Draw } from '../../ui/draw';
import { UI } from '../../world/palette';
import type { App, Screen } from '../app';
import { resume } from '../flow';
import { MorningScreen } from './morning';

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
    this.app.world.setShelves(this.app.s!.slots.map(sl => (sl.qty > 0 ? sl.good : null)));
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
    this.app.go(new MorningScreen(this.app));
  }
}
