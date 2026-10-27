// The year-end zakat count. Fixtures (shelves, camels, the guide) are left out on purpose:
// zakat on trade is due on cash, trade goods and money owed to you, not on the tools of the trade.

import { NISAB, ZAKAT_RATE } from './data';

export interface ZakatInput {
  cash: number;
  /** Unsold stock valued at today's market price. */
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
  return { zakatableTotal, nisab: NISAB, aboveNisab, zakat: aboveNisab ? zakatableTotal * ZAKAT_RATE : 0 };
}
