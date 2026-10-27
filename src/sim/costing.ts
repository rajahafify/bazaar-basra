// Landed cost: buy price plus a share of the cart hire by cells taken (gdd 3.5).

import { CARTS, GOODS, type CartId, type GoodId, type Week } from './data';

export interface Purchase {
  good: GoodId;
  quantity: number;
}

export interface CostLine {
  good: GoodId;
  quantity: number;
  buyEach: number;
  hireShareEach: number;
  landedEach: number;
  total: number;
}

export interface WeekendLedger {
  cart: CartId;
  lines: CostLine[];
  goodsCost: number;
  hire: number;
  total: number;
  cellsUsed: number;
  cellsWasted: number;
  /** Hire paid for empty cells, shown as waste in the ledger (gdd 3.4). */
  wastedHire: number;
}

export function cellsOf(good: GoodId): number {
  const [w, h] = GOODS[good].shape;
  return w * h;
}

export function weekendLedger(cartId: CartId, week: Week, purchases: readonly Purchase[]): WeekendLedger {
  const cart = CARTS[cartId];
  const cartCells = cart.cols * cart.rows;
  const lines = purchases
    .filter(p => p.quantity > 0)
    .map((p): CostLine => {
      const buyEach = GOODS[p.good].buy[week];
      const hireShareEach = cart.hire * (cellsOf(p.good) / cartCells);
      const landedEach = buyEach + hireShareEach;
      return { good: p.good, quantity: p.quantity, buyEach, hireShareEach, landedEach, total: landedEach * p.quantity };
    });
  const goodsCost = lines.reduce((s, l) => s + l.buyEach * l.quantity, 0);
  const cellsUsed = lines.reduce((s, l) => s + cellsOf(l.good) * l.quantity, 0);
  if (cellsUsed > cartCells) throw new Error(`purchases need ${cellsUsed} cells, cart has ${cartCells}`);
  const cellsWasted = cartCells - cellsUsed;
  return {
    cart: cartId,
    lines,
    goodsCost,
    hire: cart.hire,
    total: goodsCost + cart.hire,
    cellsUsed,
    cellsWasted,
    wastedHire: cart.hire * (cellsWasted / cartCells),
  };
}
