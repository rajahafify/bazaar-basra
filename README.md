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
npm run dev        # local server
npm test           # unit tests
npm run typecheck
npm run build
```

- `src/sim/` is the game's economy: goods, prices by week, landed cost, the cart grid, customer reactions, amanah, the weekly ledger and the zakat count. It has no rendering or browser code and uses a seeded random generator, so it can be tested and balance-run headless. Its tests reproduce every worked example in the design doc; if one fails, the code and the doc have drifted apart.
- `src/engine/` holds the fixed-step clock and the 360 x 640 stage fit.
- `src/main.ts` is the entry point. The bazaar scene from the prototype is ported in build week 1.

## Status

Vertical slice in planning, 27 October 2026. Build planned 2 November to 11 December 2026.
