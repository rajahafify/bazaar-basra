// The cart grid: placing shaped goods, and which jars are padded (gdd 3.4).

import { CARTS, GOODS, JAR_BREAK_CHANCE, type CartId, type GoodId } from './data';
import type { Rng } from './rng';

export interface Placement {
  good: GoodId;
  /** Top-left cell. */
  col: number;
  row: number;
  /** Rotated 90 degrees: width and height swap. */
  rotated: boolean;
}

export type PlaceError = 'out_of_grid' | 'overlap';

export function footprint(p: Placement): Array<[number, number]> {
  const [w0, h0] = GOODS[p.good].shape;
  const [w, h] = p.rotated ? [h0, w0] : [w0, h0];
  const cells: Array<[number, number]> = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) cells.push([p.col + dx, p.row + dy]);
  return cells;
}

export class CartGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly items: Placement[] = [];
  /** Index into items for each cell, or -1 when empty. */
  private readonly cells: number[];

  constructor(cart: CartId) {
    this.cols = CARTS[cart].cols;
    this.rows = CARTS[cart].rows;
    this.cells = new Array<number>(this.cols * this.rows).fill(-1);
  }

  get placements(): readonly Placement[] {
    return this.items;
  }

  canPlace(p: Placement): PlaceError | null {
    for (const [c, r] of footprint(p)) {
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 'out_of_grid';
      if (this.cells[r * this.cols + c] !== -1) return 'overlap';
    }
    return null;
  }

  place(p: Placement): PlaceError | null {
    const err = this.canPlace(p);
    if (err) return err;
    const index = this.items.length;
    this.items.push(p);
    for (const [c, r] of footprint(p)) this.cells[r * this.cols + c] = index;
    return null;
  }

  usedCells(): number {
    return this.cells.filter(i => i !== -1).length;
  }

  /** Placements that share an edge (not just a corner) with the one at `index`. */
  neighbours(index: number): Placement[] {
    const item = this.items[index];
    if (!item) return [];
    const found = new Set<number>();
    for (const [c, r] of footprint(item)) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const other = this.cells[nr * this.cols + nc]!;
        if (other !== -1 && other !== index) found.add(other);
      }
    }
    return [...found].map(i => this.items[i]!);
  }

  isPadded(index: number): boolean {
    return this.neighbours(index).some(n => GOODS[n.good].padding);
  }

  /** Rolls breakage for each unpadded jar on the ride home (gdd 3.6). Returns the broken placements. */
  rideHome(rng: Rng): Placement[] {
    return this.items.filter((p, i) => p.good === 'pottery' && !this.isPadded(i) && rng.chance(JAR_BREAK_CHANCE));
  }
}
