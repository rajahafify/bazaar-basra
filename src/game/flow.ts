// Which screen comes next. Continuing a saved game resumes at the screen for its phase.

import type { App } from './app';
import { AlleyScreen, CartScreen, PrologueScreen, RideScreen, SourceScreen, StallScreen, TitleScreen, WeekendLedgerScreen } from './screens/weekend';
import { BuyScreen } from './screens/buy';
import { ShopScreen } from './screens/shop';
import { WeekLedgerScreen } from './screens/ledger';
import { BaytScreen, EndScreen } from './screens/yearend';

export function toTitle(app: App) {
  app.go(new TitleScreen(app));
}

export function resume(app: App) {
  const s = app.s!;
  switch (s.phase) {
    case 'prologue': return app.go(new PrologueScreen(app));
    case 'stall': return app.go(new StallScreen(app));
    case 'source': return app.go(new AlleyScreen(app, 'gate'));
    case 'cart': return app.go(new CartScreen(app));
    case 'buy': return app.go(new BuyScreen(app));
    case 'ride': return app.go(new RideScreen(app));
    case 'weekendLedger': return app.go(new WeekendLedgerScreen(app));
    case 'shop': return app.go(new ShopScreen(app));
    case 'weekLedger': return app.go(new WeekLedgerScreen(app));
    case 'yearEnd': return app.go(new AlleyScreen(app, 'bayt'));
    case 'done': return app.go(new EndScreen(app));
  }
}

export const next = {
  source: (app: App) => app.go(new SourceScreen(app)),
  bayt: (app: App) => app.go(new BaytScreen(app)),
};
