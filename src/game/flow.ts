// Which screen comes next. Continuing a saved game resumes at the screen for its phase.

import { TUT } from '../sim';
import type { App } from './app';
import { MorningScreen } from './screens/morning';
import { ShopScreen } from './screens/shop';
import { TripScreen } from './screens/trip';
import { BrokeScreen, FridayScreen } from './screens/friday';
import { PrologueScreen, TitleScreen } from './screens/title';
import { BaytScreen, EndScreen } from './screens/yearend';

export function toTitle(app: App) {
  app.go(new TitleScreen(app));
}

export function resume(app: App) {
  const s = app.s!;
  switch (s.phase) {
    case 'prologue': return app.go(new PrologueScreen(app));
    case 'morning':
    // A market day interrupted mid-way starts again from the morning, with the same stock.
    case 'shop':
      s.phase = 'morning';
      if ((s.flags.tut ?? TUT.done) < TUT.morning) {
        // Back into the tutorial day, from choosing the price.
        s.flags.tut = s.slots[0]?.good ? TUT.price : TUT.slot;
        return app.go(new ShopScreen(app));
      }
      return app.go(new MorningScreen(app));
    case 'trip': return app.go(new TripScreen(app));
    case 'friday': return app.go(new FridayScreen(app));
    case 'broke': return app.go(new BrokeScreen(app));
    case 'yearEnd': return app.go(new BaytScreen(app));
    case 'done': return app.go(new EndScreen(app));
  }
}

/** After a day, a trip or a Friday: the screen for wherever the calendar landed. */
export function afterDay(app: App) {
  app.save();
  resume(app);
}

export const go = {
  shop: (app: App) => app.go(new ShopScreen(app)),
};
