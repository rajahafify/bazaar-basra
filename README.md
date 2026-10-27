# Bazaar Basra

A mobile trading game about zakat, set in Basra in the time of Umar ibn al-Khattab. Buy stock on the weekend, pack your cart, run your stall through the week, and pay zakat at the end of the year.

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

The whole year is playable: prologue, four weekends (stall, alleys, source, cart, buy and pack, ride home, weekend ledger), twenty shop days (prices, customers by time of day, the scale, Harith's offer, the inspector, spoilage, night summary), four weekly ledgers, and the year end at the bayt al-mal (valuing stock, the zakat count, sadaqah, the eight asnaf, the end screen). It saves every morning and every weekend.

- `src/sim/` is the game's rules and numbers from the design doc, with no rendering code and a seeded random generator. `game.ts` holds the year's state and actions, `day.ts` runs a shop day, `bot.ts` plays scripted years for balance runs. Tests reproduce every worked example in the design doc.
- `src/world/` is the 3D town. Scenery is merged into a few meshes with vertex colours, and figures are cached and pooled, so a frame is under 50 draw calls (the mockup drew about 840).
- `src/ui/` draws the canvas UI on the 360 x 640 frame; `src/game/screens/` holds one class per screen.
- `src/i18n/` has one JSON file per language, BM and EN. A test keeps their keys identical and every text box under 30 words.
- `src/platform/` holds the local save and the bridge to the ikhlas.com app: play events (gdd 12.2), the zakat page button and sharing go to a `IkhlasGames` JavaScript channel when the Flutter web view provides one.

Add `?debug` to the URL to expose test hooks, and `&speed=4` to run the game faster.

## Status

Vertical slice playable end to end, 27 October 2026. Still needed: sound, the asnaf scenes staged in 3D, ustaz review of all text, balance tuning, and the Flutter package.
