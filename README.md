# Bazaar Basra

A mobile trading game about zakat, set in Basra in the time of Umar ibn al-Khattab. Each day, open your stall and sell, or take the caravan out to buy goods in another town. Pay the rent every Friday, and pay zakat at the end of the year.

Built by Artifisi Sdn Bhd as a pilot for the ikhlas.com app. Bahasa Malaysia title: **Pasar Basra**.

## Documents

- [Game design document](docs/gdd.md): how the game plays, the economy, screens, tech, and production plan.
- [Style and World Guide](docs/style-and-world-guide.md): the history, the look, the sound, the writing, and the rules on what can never be shown.

## Prototype

[prototype/mockup.html](prototype/mockup.html) is the first playable mockup: one shop day in the bazaar and a walk through the alleys. It is a single HTML file using three.js r128 from cdnjs, with all UI drawn in canvas. Open it in a browser, ideally in phone portrait size.

The vertical slice is being rebuilt in TypeScript with Vite. See gdd.md section 12.

## Development

Needs Node 22.

```sh
npm install
npm run dev        # local server; open on a phone-sized window
npm test           # unit tests
npm run typecheck
npm run balance    # plays 200 years with a careful and a careless bot, against gdd 9.1
npm run build      # static site in dist/, for Cloudflare Pages
```

The whole year is playable. It is four seasons of four weeks. Each morning you choose:

- **Open the shop**, Moonlighter style: put goods on the slots, set prices, and watch each customer react. The notebook remembers which prices sold and which were too high.
- **Set out** on an expedition, FTL style: one town, a day out and a day back, with three possible stops at each half day. Each stop holds one of 33 events with choices and a lesson (riba, gharar, ihtikar, salam, mudarabah, the eight asnaf, and more). Money, supplies and caravan space are the limits. Each town sells its own goods, and new towns open each season.

On Friday the market is closed: the week's ledger, rent and debts, then upgrades (shelves, camels, water skins, a guide, a shop boy).

If you can't pay the rent, even after selling stock at half price, the stall is lost and you can retry the season. The year ends at the bayt al-mal (valuing stock, the zakat count, sadaqah, the eight asnaf, the end screen). The game saves after every step.

Quests: one main quest a season, paid by the guild the moment it is done, and side quests from people on the road (orders to deliver, debts to repay). A side quest always gives at least a week, is due on a Friday, and can be finished early any morning from the quest log.

- `src/sim/` is the game's rules and numbers from the design doc, with no rendering code and a seeded random generator. `game.ts` holds the year's state and actions, `day.ts` runs a shop day, `bot.ts` plays scripted years for balance runs. Tests reproduce every worked example in the design doc.
- `src/world/` is the 3D town. Scenery is merged into a few meshes with vertex colours, and figures are cached and pooled, so a frame is under 50 draw calls (the mockup drew about 840).
- `src/ui/` draws the canvas UI on the 360 x 640 frame; `src/game/screens/` holds one class per screen.
- `src/i18n/` has one JSON file per language, BM and EN. A test keeps their keys identical and every text box under 30 words.
- `src/platform/` holds the local save and the bridge to the ikhlas.com app: play events (gdd 12.2), the zakat page button and sharing go to a `IkhlasGames` JavaScript channel when the Flutter web view provides one.

Add `?debug` to the URL to expose test hooks, and `&speed=4` to run the game faster.

## Deploy

Cloudflare Pages, project `bazaar-basra`, served at https://basra.artifisi.com.
Cloudflare builds from this repo through its Git integration: build command
`npm run build`, output directory `dist`, production branch `main`. Pushes to
`main` go live and other branches get preview URLs. Cache headers live in
`public/_headers`.

## Status

The new loop (shop or expedition each day) is playable end to end. Still needed: sound, 3D models from an asset pack in place of the procedural stop markers, the asnaf scenes staged in 3D, balance tuning from playtests, and the Flutter package.
