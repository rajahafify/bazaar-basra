// The app: owns the world, the UI canvas, the game state and the current screen.

import { L, fmt, lang, money, setLang } from '../i18n';
import { emit } from '../platform/bridge';
import { loadLang, saveGame, saveLang } from '../platform/storage';
import type { GameState } from '../sim';
import { Draw, LH, LW, type Hit } from '../ui/draw';
import { UI } from '../world/palette';
import type { CameraMode, World } from '../world/world';

export interface Screen {
  camera: CameraMode;
  enter?(): void;
  /** Fixed-step update in sim seconds. */
  update?(dt: number): void;
  /** Per-frame update with real time, for animation. */
  frame?(dt: number): void;
  draw(d: Draw): void;
  press?(id: string): void;
  hold?(down: boolean): void;
}

export class App {
  s: GameState | null = null;
  screen!: Screen;
  private toastText = '';
  private toastT = 0;
  private holding = false;

  constructor(readonly world: World, readonly draw: Draw) {
    const saved = loadLang();
    setLang(saved ?? (navigator.language?.toLowerCase().startsWith('ms') ? 'ms' : saved ?? 'ms'));
  }

  go(screen: Screen) {
    this.screen = screen;
    this.world.setMode(screen.camera);
    screen.enter?.();
  }

  save() {
    if (this.s) saveGame(this.s);
  }

  toast(text: string, seconds = 2.6) {
    this.toastText = text;
    this.toastT = seconds;
  }

  toggleLang() {
    const next = lang() === 'ms' ? 'en' : 'ms';
    setLang(next);
    saveLang(next);
  }

  // ---------- loop ----------

  update(dt: number) {
    this.screen.update?.(dt);
  }

  frame(dt: number, scale: number) {
    this.toastT = Math.max(0, this.toastT - dt);
    this.screen.frame?.(dt);
    this.world.update(dt);
    this.draw.begin(scale);
    this.screen.draw(this.draw);
    if (this.toastT > 0) {
      const d = this.draw;
      d.ctx.save();
      d.ctx.globalAlpha = Math.min(1, this.toastT * 2);
      const lines = d.lines(this.toastText, 300, { size: 13 });
      const h = 16 + lines * 17;
      d.panel(20, 300 - h / 2, 320, h, UI.panel);
      d.para(this.toastText, 180, 300 - h / 2 + 16, 300, { size: 13, color: UI.parch, align: 'center' }, 17);
      d.ctx.restore();
    }
  }

  // ---------- input ----------

  private hitAt(x: number, y: number): Hit | undefined {
    const hits = this.draw.hits;
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i]!;
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return undefined;
  }

  pointerDown(x: number, y: number) {
    const h = this.hitAt(x, y);
    if (!h) return;
    if (h.hold) { this.holding = true; this.screen.hold?.(true); return; }
    if (h.id === 'lang') { this.toggleLang(); return; }
    this.screen.press?.(h.id);
  }

  pointerUp() {
    if (this.holding) { this.holding = false; this.screen.hold?.(false); }
  }

  // ---------- shared pieces ----------

  /** The parchment bar along the top: place, cash, and the BM/EN switch. */
  topBar(d: Draw, title: string, sub?: string, progress?: number) {
    d.panel(10, 10, 340, 66);
    d.text(L().title.name.toUpperCase(), 22, 24, { size: 9, color: UI.inkSoft, weight: 800 });
    d.text(title, 22, 42, { size: 16, font: 'head', maxWidth: 220 });
    if (this.s) {
      const cash = money(this.s.cash);
      d.coin(258 - Math.max(0, d.measure(cash, { size: 20, font: 'head' }) - 36), 38, 8);
      const cx = 272 - Math.max(0, d.measure(cash, { size: 20, font: 'head' }) - 36);
      d.text(cash, cx, 39, { size: 20, font: 'head' });
      d.text(L().dirham, cx + d.measure(cash, { size: 20, font: 'head' }) + 4, 41, { size: 12, color: UI.inkSoft });
    }
    if (progress !== undefined) {
      const bx = 22, bw = 236, by = 62, p = Math.max(0, Math.min(1, progress));
      d.ctx.fillStyle = UI.parchDark; d.rr(bx, by - 3, bw, 6, 3); d.ctx.fill();
      d.ctx.fillStyle = UI.gold; d.rr(bx, by - 3, bw * p, 6, 3); d.ctx.fill();
      d.ctx.fillStyle = '#e9a83a'; d.ctx.beginPath(); d.ctx.arc(bx + bw * p, by, 5.5, 0, 7); d.ctx.fill();
      d.ctx.strokeStyle = UI.panelEdge; d.ctx.lineWidth = 1.2; d.ctx.stroke();
    } else if (sub) {
      d.text(sub, 22, 62, { size: 12, color: UI.inkSoft, maxWidth: 260 });
    }
    d.button('lang', 296, 50, 44, 24, lang() === 'ms' ? 'EN' : 'BM', { fill: UI.parchDark, size: 11 });
  }

  weekTitle(): string {
    const s = this.s!;
    return fmt(L().weekLabel, { week: s.week, season: L().seasons[s.week - 1]! });
  }

  amanahBar(d: Draw, y = 82) {
    if (!this.s) return;
    d.panel(10, y, 186, 28);
    d.text(L().amanah, 20, y + 15, { size: 13, font: 'head' });
    const ax = 86, aw = 76, a = this.s.amanah;
    d.ctx.fillStyle = UI.parchDark; d.rr(ax, y + 10, aw, 9, 4); d.ctx.fill();
    d.ctx.fillStyle = a >= 60 ? UI.green : a >= 40 ? UI.gold : UI.red; d.rr(ax, y + 10, (aw * a) / 100, 9, 4); d.ctx.fill();
    d.ctx.strokeStyle = UI.panelEdge; d.ctx.lineWidth = 1; d.rr(ax, y + 10, aw, 9, 4); d.ctx.stroke();
    d.text(String(Math.round(a)), 170, y + 15, { size: 13, font: 'head' });
  }

  crier(d: Draw, text: string, y = 116, alpha = 1) {
    d.ctx.save();
    d.ctx.globalAlpha = alpha;
    const lines = d.lines(text, 318, { size: 12.5 });
    const h = 14 + lines * 16;
    d.panel(10, y, 340, h, UI.panel, UI.panelEdge);
    d.para(text, 180, y + 15, 318, { size: 12.5, color: UI.parch, align: 'center' }, 16);
    d.ctx.restore();
  }

  /** A full parchment page, for ledgers and the bayt al-mal. */
  page(d: Draw, y = 86, h = LH - 96) {
    d.dim(0.35);
    d.panel(14, y, LW - 28, h);
  }

  started() {
    emit('game_start', { lang: lang() });
  }
}
