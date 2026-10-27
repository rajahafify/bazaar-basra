// Buy and pack: buy goods into the tray, then pack them into the cart grid (gdd 3.4).
// Tap a good, tap a cell to place its top-left corner there; tap a packed good to lift it out.

import { L, fmt, money } from '../../i18n';
import {
  CARTS, GOODS, autoPack, buyOne, buyPrice, footprint, goodsAt, gridFor, leaveSource, placeItem, returnOne, unplaceItem,
  type GoodId,
} from '../../sim';
import type { Draw } from '../../ui/draw';
import { UI } from '../../world/palette';
import type { App, Screen } from '../app';
import { RideScreen } from './weekend';

const CELL_FILL: Record<GoodId, string> = {
  dates: '#c9a46a', pottery: '#d79a72', straw: '#e6d494', cloth: '#9fb0cf', spices: '#e6c46a', leather: '#b98a62',
};

export class BuyScreen implements Screen {
  camera = 'alley' as const;
  private selected: number | null = null;
  private rotated = false;

  constructor(private readonly app: App) {}

  private layout() {
    const cart = CARTS[this.app.s!.weekend.cart ?? 'handcart'];
    const cell = Math.min(Math.floor(316 / cart.cols), Math.floor(226 / cart.rows), 56);
    const gw = cell * cart.cols, gh = cell * cart.rows;
    return { cart, cell, gx: 180 - gw / 2, gy: 200 + (226 - gh) / 2, gw, gh };
  }

  draw(d: Draw) {
    const app = this.app, s = app.s!, t = L().buy;
    app.topBar(d, t.title, t.hint);
    const goods = goodsAt(s, s.weekend.source!);
    d.bar(6, 82, 348, 108);
    const cw = Math.floor((332 - (goods.length - 1) * 8) / goods.length);
    goods.forEach((g, i) => {
      const x = 14 + i * (cw + 8), y = 90;
      d.panel(x, y, cw, 92);
      d.goodIcon(g, x + 26, y + 24, 0.9);
      d.text(L().goods[g], x + 48, y + 18, { size: 13, font: 'head', maxWidth: cw - 52 });
      d.coin(x + 54, y + 38, 5);
      d.text(money(buyPrice(s, g)), x + 62, y + 39, { size: 15, font: 'head' });
      const credit = GOODS[g].source === 'bedouin';
      if (credit) {
        const bw = (cw - 18) / 2;
        d.button(`buy-${g}`, x + 6, y + 52, bw, 34, '+', { size: 18, disabled: s.cash < buyPrice(s, g) });
        d.button(`credit-${g}`, x + 12 + bw, y + 52, bw, 34, t.credit, { size: 10, fill: UI.parchDark });
      } else {
        d.button(`buy-${g}`, x + 6, y + 52, cw - 12, 34, '+', { size: 18, disabled: s.cash < buyPrice(s, g) });
      }
    });

    // The cart grid.
    const { cart, cell, gx, gy, gw, gh } = this.layout();
    d.panel(gx - 10, gy - 10, gw + 20, gh + 20, '#8a6a45');
    for (let r = 0; r < cart.rows; r++) for (let c = 0; c < cart.cols; c++) {
      d.ctx.fillStyle = '#d8c49a';
      d.rr(gx + c * cell + 2, gy + r * cell + 2, cell - 4, cell - 4, 4); d.ctx.fill();
      d.area(`cell-${c}-${r}`, gx + c * cell, gy + r * cell, cell, cell);
    }
    const grid = gridFor(s);
    s.weekend.tray.forEach(item => {
      if (!item.placement) return;
      const cells = footprint(item.placement);
      const xs = cells.map(([c]) => c), ys = cells.map(([, r]) => r);
      const c0 = Math.min(...xs), r0 = Math.min(...ys);
      const w = (Math.max(...xs) - c0 + 1) * cell, h = (Math.max(...ys) - r0 + 1) * cell;
      const x = gx + c0 * cell, y = gy + r0 * cell;
      d.ctx.fillStyle = CELL_FILL[item.good];
      d.rr(x + 3, y + 3, w - 6, h - 6, 6); d.ctx.fill();
      d.ctx.strokeStyle = this.selected === item.id ? UI.gold : UI.panelEdge; d.ctx.lineWidth = this.selected === item.id ? 3 : 1.5; d.ctx.stroke();
      d.goodIcon(item.good, x + w / 2, y + h / 2, Math.min(1, cell / 50));
      if (item.good === 'pottery') {
        const idx = grid.placements.indexOf(item.placement);
        const padded = idx >= 0 && grid.isPadded(idx);
        d.ctx.fillStyle = padded ? UI.green : UI.red;
        d.ctx.beginPath(); d.ctx.arc(x + w - 11, y + 11, 8, 0, 7); d.ctx.fill();
        d.text(padded ? '✓' : '!', x + w - 11, y + 12, { size: 11, color: UI.parch, align: 'center', weight: 800 });
      }
      if (item.credit) d.text(L().buy.credit, x + 6, y + h - 10, { size: 9, color: UI.ink });
    });

    // The tray of goods not packed yet.
    const tray = s.weekend.tray.filter(x => !x.placement);
    d.bar(6, 438, 348, 196);
    d.text(`${t.tray} (${tray.length})`, 18, 454, { size: 12, color: UI.parch, weight: 800 });
    d.text(t.padNote, 342, 454, { size: 10.5, color: UI.parchDark, align: 'right', maxWidth: 200 });
    tray.slice(0, 7).forEach((item, i) => {
      const x = 14 + i * 48, y = 466;
      d.panel(x, y, 44, 44, this.selected === item.id ? '#f6dfa0' : UI.parch, this.selected === item.id ? UI.gold : UI.panelEdge);
      d.goodIcon(item.good, x + 22, y + 24, 0.62);
      d.area(`tray-${item.id}`, x, y, 44, 44);
    });
    if (tray.length > 7) d.text(`+${tray.length - 7}`, 346, 488, { size: 13, color: UI.parch, align: 'right' });

    const sel = s.weekend.tray.find(x => x.id === this.selected);
    d.button('rotate', 14, 522, 104, 44, this.rotated ? `${t.rotate} ↻` : t.rotate, { fill: UI.parchDark, size: 14, disabled: !sel });
    d.button('return', 128, 522, 104, 44, '−', { fill: UI.parchDark, size: 18, disabled: !sel || !!sel.placement });
    d.button('auto', 242, 522, 104, 44, t.auto, { fill: UI.parchDark, size: 13, disabled: tray.length === 0 });
    d.button('leave', 70, 578, 220, 46, t.leave, { size: 18 });
    if (tray.length > 0) d.text(fmt(t.unpacked, { n: tray.length }), 180, 572 - 2, { size: 10.5, color: UI.parchDark, align: 'center' });
  }

  press(id: string) {
    const s = this.app.s!;
    if (id.startsWith('buy-') || id.startsWith('credit-')) {
      const credit = id.startsWith('credit-');
      const good = id.slice(credit ? 7 : 4) as GoodId;
      const item = buyOne(s, good, credit);
      if (item) this.selected = item.id;
      return;
    }
    if (id.startsWith('tray-')) { this.selected = Number(id.slice(5)); this.rotated = false; return; }
    if (id.startsWith('cell-')) {
      const [, c, r] = id.split('-').map(Number) as [number, number, number];
      const sel = s.weekend.tray.find(x => x.id === this.selected);
      const here = s.weekend.tray.find(x => x.placement && footprint(x.placement).some(([cc, rr]) => cc === c && rr === r));
      if (sel && !sel.placement) {
        if (placeItem(s, sel.id, { col: c, row: r, rotated: this.rotated })) {
          const nextUnpacked = s.weekend.tray.find(x => !x.placement);
          this.selected = nextUnpacked?.id ?? null;
          this.rotated = false;
        } else this.app.toast(L().buy.cantFit, 1.4);
        return;
      }
      if (here) { unplaceItem(s, here.id); this.selected = here.id; this.rotated = here.placement?.rotated ?? false; }
      return;
    }
    if (id === 'rotate') {
      const sel = s.weekend.tray.find(x => x.id === this.selected);
      if (!sel) return;
      if (sel.placement) {
        const p = sel.placement;
        unplaceItem(s, sel.id);
        if (!placeItem(s, sel.id, { col: p.col, row: p.row, rotated: !p.rotated })) {
          placeItem(s, sel.id, { col: p.col, row: p.row, rotated: p.rotated });
          this.app.toast(L().buy.cantFit, 1.4);
        }
      } else this.rotated = !this.rotated;
      return;
    }
    if (id === 'return' && this.selected !== null) {
      returnOne(s, this.selected);
      this.selected = s.weekend.tray.find(x => !x.placement)?.id ?? null;
      return;
    }
    if (id === 'auto') { autoPack(s); this.selected = null; return; }
    if (id === 'leave') {
      leaveSource(s);
      this.app.go(new RideScreen(this.app));
    }
  }
}
