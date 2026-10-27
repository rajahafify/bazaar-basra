// Canvas UI on the fixed 360 x 640 frame: parchment panels, wooden bars, coins and icons
// (style guide 4.7, 5). Buttons register hit areas as they are drawn each frame.

import { REACTION_EMOJI, type GoodId, type Reaction } from '../sim';
import { UI } from '../world/palette';

export const LW = 360;
export const LH = 640;

export interface Hit {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** A press-and-hold control (the scale). */
  hold?: boolean;
}

export interface TextOpts {
  size?: number;
  font?: 'body' | 'head';
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
  maxWidth?: number;
}

export interface ButtonOpts {
  fill?: string;
  color?: string;
  size?: number;
  disabled?: boolean;
  hold?: boolean;
}

export type Mood = 'delighted' | 'happy' | 'unsure' | 'angry';

const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';
const FONTS = {
  body: `"Alegreya Sans", "Trebuchet MS", ${EMOJI}, sans-serif`,
  head: `"Reem Kufi", "Trebuchet MS", ${EMOJI}, sans-serif`,
};

export class Draw {
  readonly hits: Hit[] = [];

  constructor(readonly ctx: CanvasRenderingContext2D) {}

  begin(scale: number) {
    this.hits.length = 0;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.ctx.clearRect(0, 0, LW, LH);
  }

  rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  panel(x: number, y: number, w: number, h: number, fill: string = UI.parch, edge: string = UI.panelEdge) {
    const c = this.ctx;
    c.save();
    c.fillStyle = 'rgba(30,20,10,.28)'; this.rr(x + 2, y + 3, w, h, 9); c.fill();
    c.fillStyle = fill; this.rr(x, y, w, h, 9); c.fill();
    c.lineWidth = 2; c.strokeStyle = edge; c.stroke();
    c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.35)'; this.rr(x + 3, y + 3, w - 6, h - 6, 7); c.stroke();
    c.restore();
  }

  /** Wooden bar panel, for the lower control area. */
  bar(x: number, y: number, w: number, h: number) {
    this.panel(x, y, w, h, UI.panel, UI.panelEdge);
  }

  dim(alpha = 0.45) {
    this.ctx.fillStyle = `rgba(30,20,10,${alpha})`;
    this.ctx.fillRect(0, 0, LW, LH);
  }

  font(o: TextOpts = {}) {
    const size = o.size ?? 14;
    this.ctx.font = `${o.weight ?? 700} ${size}px ${FONTS[o.font ?? 'body']}`;
  }

  text(s: string, x: number, y: number, o: TextOpts = {}) {
    const c = this.ctx;
    this.font(o);
    c.fillStyle = o.color ?? UI.ink;
    c.textAlign = o.align ?? 'left';
    c.textBaseline = 'middle';
    c.fillText(s, x, y, o.maxWidth);
  }

  measure(s: string, o: TextOpts = {}): number {
    this.font(o);
    return this.ctx.measureText(s).width;
  }

  /** Word-wrapped text. Returns the y after the last line. */
  para(s: string, x: number, y: number, width: number, o: TextOpts = {}, lineHeight = (o.size ?? 14) * 1.3): number {
    this.font(o);
    const words = s.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (this.ctx.measureText(next).width > width && line) {
        this.text(line, x, yy, o);
        line = w;
        yy += lineHeight;
      } else line = next;
    }
    if (line) { this.text(line, x, yy, o); yy += lineHeight; }
    return yy;
  }

  /** Number of lines a paragraph would take. */
  lines(s: string, width: number, o: TextOpts = {}): number {
    this.font(o);
    let n = 1, line = '';
    for (const w of s.split(' ')) {
      const next = line ? `${line} ${w}` : w;
      if (this.ctx.measureText(next).width > width && line) { n++; line = w; } else line = next;
    }
    return n;
  }

  button(id: string, x: number, y: number, w: number, h: number, label: string, o: ButtonOpts = {}) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = o.disabled ? 0.45 : 1;
    c.fillStyle = UI.panelEdge; this.rr(x, y + 3, w, h, 8); c.fill();
    c.fillStyle = o.fill ?? UI.gold; this.rr(x, y, w, h, 8); c.fill();
    c.fillStyle = 'rgba(255,255,255,.22)'; this.rr(x + 3, y + 2, w - 6, h * 0.42, 6); c.fill();
    c.strokeStyle = UI.panelEdge; c.lineWidth = 2; this.rr(x, y, w, h, 8); c.stroke();
    this.text(label, x + w / 2, y + h / 2 + 1, { size: o.size ?? 16, font: 'head', color: o.color ?? UI.ink, align: 'center', maxWidth: w - 8 });
    c.restore();
    if (!o.disabled) this.hits.push({ id, x, y, w, h, hold: o.hold });
  }

  /** An invisible tap area, e.g. a whole card. */
  area(id: string, x: number, y: number, w: number, h: number) {
    this.hits.push({ id, x, y, w, h });
  }

  coin(x: number, y: number, r: number) {
    const c = this.ctx;
    c.fillStyle = '#9c7c3c'; c.beginPath(); c.arc(x, y + 1, r, 0, 7); c.fill();
    c.fillStyle = UI.silver; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = '#a49c88'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, r * 0.62, 0, 7); c.stroke();
  }

  /** Customer mood as an emoji, Moonlighter style: one emoji per price band. */
  mood(x: number, y: number, r: number, mood: Mood) {
    this.text(REACTION_EMOJI[mood], x, y + 1, { size: r * 1.9, align: 'center' });
  }

  /** The notebook for one good: each price tried, with the emoji it got, cheapest first. */
  priceChips(book: Readonly<Record<string, Reaction>>, x: number, y: number, maxW: number, size = 11) {
    const prices = Object.keys(book).map(Number).sort((a, b) => a - b);
    let cx = x;
    for (const p of prices) {
      const label = `${p}${REACTION_EMOJI[book[String(p)]!]}`;
      const w = this.measure(label, { size }) + 8;
      if (cx + w > x + maxW) break;
      this.ctx.fillStyle = 'rgba(0,0,0,.07)'; this.rr(cx, y - size * 0.75, w - 2, size * 1.5, 4); this.ctx.fill();
      this.text(label, cx + 3, y, { size, color: UI.ink });
      cx += w;
    }
    return cx;
  }

  goodIcon(good: GoodId, x: number, y: number, s = 1) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(s, s);
    if (good === 'dates') {
      c.fillStyle = '#b08d4f'; this.rr(-17, 2, 34, 11, 4); c.fill();
      c.fillStyle = '#5e2f1c';
      for (const [dx, dy] of [[-10, 0], [-3, -2], [4, 0], [11, -1], [-6, -7], [1, -8], [8, -6], [-1, -13]] as const) { c.beginPath(); c.ellipse(dx, dy, 4, 5.5, 0, 0, 7); c.fill(); }
    } else if (good === 'salt') {
      c.fillStyle = '#c9b48a'; this.rr(-14, -4, 18, 18, 6); c.fill();
      c.fillStyle = '#f4f0e6'; c.beginPath(); c.moveTo(-14, -4); c.lineTo(-5, -14); c.lineTo(4, -4); c.fill();
      c.beginPath(); c.moveTo(2, 14); c.lineTo(10, -2); c.lineTo(18, 14); c.fill();
      c.strokeStyle = '#a49c88'; c.lineWidth = 1; c.stroke();
    } else if (good === 'fish') {
      c.fillStyle = '#8a7a5e';
      for (const dy of [-6, 4]) {
        c.beginPath(); c.ellipse(-2, dy, 13, 4.5, 0, 0, 7); c.fill();
        c.beginPath(); c.moveTo(10, dy); c.lineTo(18, dy - 5); c.lineTo(18, dy + 5); c.fill();
      }
      c.fillStyle = '#f4f0e6'; c.beginPath(); c.arc(-11, -7, 1.3, 0, 7); c.arc(-11, 3, 1.3, 0, 7); c.fill();
    } else if (good === 'vinegar') {
      c.fillStyle = '#b4643f'; c.beginPath();
      c.moveTo(-4, -15); c.lineTo(4, -15); c.quadraticCurveTo(15, -4, 9, 12);
      c.lineTo(-9, 12); c.quadraticCurveTo(-15, -4, -4, -15); c.fill();
      c.fillStyle = '#6b4a2a'; this.rr(-4, -18, 8, 5, 2); c.fill();
      c.strokeStyle = '#7d3f24'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-10, -2); c.lineTo(10, -2); c.stroke();
    } else if (good === 'beef') {
      c.fillStyle = '#7a2e24';
      this.rr(-16, -1, 30, 10, 3); c.fill();
      this.rr(-12, -11, 28, 10, 3); c.fill();
      c.strokeStyle = '#e9dcc0'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-12, 3); c.lineTo(10, 5); c.moveTo(-8, -7); c.lineTo(12, -5); c.stroke();
    } else if (good === 'cardamom') {
      c.fillStyle = '#c9b48a'; this.rr(-13, -6, 26, 20, 7); c.fill();
      c.fillStyle = '#7d9a4a';
      for (const [dx, dy] of [[-7, -7], [0, -9], [7, -7], [-3, -3], [4, -3]] as const) { c.beginPath(); c.ellipse(dx, dy, 3.2, 4.6, 0.3, 0, 7); c.fill(); }
    } else {
      // Saffron: red threads in a brass bowl.
      c.fillStyle = '#b8923a'; c.beginPath(); c.ellipse(0, 4, 15, 8, 0, 0, Math.PI); c.fill();
      c.fillRect(-15, 2, 30, 3);
      c.strokeStyle = '#c8401e'; c.lineWidth = 2; c.lineCap = 'round';
      for (const [x1, y1, x2, y2] of [[-9, 1, -4, -8], [-3, 1, 0, -10], [3, 1, 6, -9], [8, 1, 11, -6], [-6, 0, -9, -6]] as const) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    }
    c.restore();
  }

  /** The kind of stop on the expedition map. */
  stopIcon(kind: string, x: number, y: number, r = 11) {
    const c = this.ctx;
    c.save();
    c.fillStyle = UI.parch; c.strokeStyle = UI.panelEdge; c.lineWidth = 1.6;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
    c.fillStyle = UI.panelEdge; c.strokeStyle = UI.panelEdge;
    if (kind === 'road') {
      c.beginPath(); c.moveTo(x - r * 0.6, y + r * 0.45); c.quadraticCurveTo(x, y - r * 0.8, x + r * 0.6, y + r * 0.45); c.closePath(); c.fill();
    } else if (kind === 'trader') {
      c.fillRect(x - r * 0.55, y - r * 0.1, r * 1.1, r * 0.5);
      c.beginPath(); c.moveTo(x - r * 0.7, y - r * 0.1); c.lineTo(x, y - r * 0.6); c.lineTo(x + r * 0.7, y - r * 0.1); c.fill();
    } else if (kind === 'people') {
      c.beginPath(); c.arc(x - r * 0.25, y - r * 0.25, r * 0.22, 0, 7); c.arc(x + r * 0.28, y - r * 0.2, r * 0.2, 0, 7); c.fill();
      c.fillRect(x - r * 0.5, y + r * 0.02, r * 0.5, r * 0.45); c.fillRect(x + r * 0.08, y + r * 0.05, r * 0.42, r * 0.42);
    } else if (kind === 'find') {
      this.coin(x, y, r * 0.5);
    } else {
      this.text('?', x, y + 1, { size: r * 1.3, font: 'head', align: 'center' });
    }
    c.restore();
  }

  placeIcon(kind: 'market' | 'gate' | 'bayt', x: number, y: number) {
    const c = this.ctx;
    c.save(); c.fillStyle = UI.panelEdge; c.strokeStyle = UI.panelEdge; c.lineWidth = 1.6;
    if (kind === 'gate') {
      this.rr(x - 8, y - 7, 16, 14, 2); c.stroke();
      c.beginPath(); c.arc(x, y + 1, 4, Math.PI, 0); c.lineTo(x + 4, y + 7); c.lineTo(x - 4, y + 7); c.closePath(); c.fill();
    } else if (kind === 'bayt') this.coin(x, y, 7);
    else {
      c.beginPath(); c.moveTo(x - 9, y - 1); c.lineTo(x, y - 8); c.lineTo(x + 9, y - 1); c.closePath(); c.fill();
      c.fillRect(x - 7, y - 1, 2, 8); c.fillRect(x + 5, y - 1, 2, 8);
    }
    c.restore();
  }

  /** A ruled ledger row: label left, amount right, a pen line under it. */
  ledgerRow(label: string, value: string, x: number, y: number, w: number, o: { bold?: boolean; color?: string } = {}) {
    this.text(label, x, y, { size: 13, color: o.bold ? UI.ink : UI.inkSoft, weight: o.bold ? 800 : 700, maxWidth: w - 70 });
    this.text(value, x + w, y, { size: o.bold ? 16 : 14, font: 'head', align: 'right', color: o.color ?? UI.ink });
    const c = this.ctx;
    c.strokeStyle = UI.parchDark; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y + 11); c.lineTo(x + w, y + 11); c.stroke();
  }
}

/** Signed money with an explicit plus or minus, so it never relies on colour alone (style guide 5.2). */
export function signed(n: number, fmt: (n: number) => string): string {
  if (Math.abs(n) < 0.05) return fmt(0);
  return `${n > 0 ? '+' : '−'}${fmt(Math.abs(n))}`;
}
