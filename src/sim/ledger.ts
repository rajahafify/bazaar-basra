// The weekly profit ledger (gdd 5) and the year-end zakat count (gdd 6.2).

import { NISAB, ZAKAT_RATE } from './data';

export interface WeekInput {
  cashAtStart: number;
  revenue: number;
  /** Landed cost of the goods sold this week. */
  costOfGoodsSold: number;
  /** Stock bought this weekend, paid in cash (weekend ledger total). */
  stockBought: number;
  rent: number;
  /** Landed cost of goods spoiled or broken this week. */
  writtenOff: number;
}

export interface WeekLedger {
  revenue: number;
  costOfGoodsSold: number;
  rent: number;
  writtenOff: number;
  profit: number;
  cashAtEnd: number;
}

export function weekLedger(w: WeekInput): WeekLedger {
  return {
    revenue: w.revenue,
    costOfGoodsSold: w.costOfGoodsSold,
    rent: w.rent,
    writtenOff: w.writtenOff,
    profit: w.revenue - w.costOfGoodsSold - w.rent - w.writtenOff,
    // Cash moves on what was paid, not on cost of goods sold.
    cashAtEnd: w.cashAtStart - w.stockBought - w.rent + w.revenue,
  };
}

export interface ZakatInput {
  cash: number;
  /** Unsold stock valued at today's market price. Spoiled and broken goods count for nothing. */
  stockAtMarket: number;
  /** Money owed to you that you expect to be paid. */
  owedToYou: number;
  /** Debts you owe that are due now. */
  debtsDue: number;
}

export interface ZakatResult {
  zakatableTotal: number;
  nisab: number;
  aboveNisab: boolean;
  zakat: number;
}

export function zakatCount(z: ZakatInput): ZakatResult {
  const zakatableTotal = z.cash + z.stockAtMarket + z.owedToYou - z.debtsDue;
  const aboveNisab = zakatableTotal >= NISAB;
  // Rounding is on the ustaz review list (gdd 13); kept exact here.
  return { zakatableTotal, nisab: NISAB, aboveNisab, zakat: aboveNisab ? zakatableTotal * ZAKAT_RATE : 0 };
}
