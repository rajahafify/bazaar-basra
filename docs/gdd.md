# Bazaar Basra: Game Design Document

Working title: **Bazaar Basra** (EN), **Pasar Basra** (BM)
Studio: Artifisi Sdn Bhd
Version: 0.1, 27 October 2026
Status: vertical slice in planning. Target live date in the ikhlas.com app: 14 December 2026.

The look, the history, and the rules on what can and cannot be shown live in [style-and-world-guide.md](style-and-world-guide.md). Read both before building anything.

---

## 1. Overview

### 1.1 Pitch

Basra, 638. The city is a few years old, built of reeds and mud brick near the Shatt al-Arab. Your uncle hands you his market stall and leaves on a long journey. You have one lunar year to keep it alive.

On weekends you go out through the alleys and the city gate to buy stock, write every cost in your ledger, and pack it all onto a cart. On weekdays you run the stall in the bazaar, set prices, and read your customers' faces as the day turns to night. At the end of each week the ledger tells you what you actually made. At the end of the year you count what you own and pay zakat at the bayt al-mal, then see where it goes.

It plays like Moonlighter or Recettear without the dungeon, with Backpack Hero's packing grid in place of combat. Honesty is a resource. The year-end count is the boss.

### 1.2 Platform and audience

| Item | Decision |
| --- | --- |
| Platform | Phones, portrait. HTML5 game hosted by Artifisi, opened inside the ikhlas.com app through a small Flutter package. The same build runs in a phone browser. |
| Audience | Ages 13 and up, and families. Malaysia first, Indonesia later. |
| Languages | Bahasa Malaysia and English at launch. |
| Session | One full year is about 25 to 30 minutes. The game saves every morning and every weekend, so it can be played in short sittings. |
| Price | Free inside the ikhlas.com app during the pilot quarter. |

### 1.3 Design pillars

1. **Honest trade is the winning strategy.** Fair prices and fair weights bring more customers. Cheating works for a day and costs you the week.
2. **The ledger is the boss.** Every choice ends up as a number in your book. The year-end zakat count is the final test, and good books make it easy.
3. **A real place, treated with respect.** Basra in the time of Umar, with nobody's face shown and no real person from that time on screen. See the style and world guide.
4. **Short sessions on a phone.** One shop day is under a minute. A weekend is a few minutes. Everything works with one thumb.

### 1.4 Comparable games

| Game | What we take | What we leave |
| --- | --- | --- |
| Moonlighter | Shop by day, gather by night, customer faces reacting to price | Dungeons and combat |
| Recettear | Running a shop as the whole game, pricing as skill | Haggling every sale, the debt-collector plot |
| Backpack Hero | Shaped items packed into a grid, adjacency rules | Combat and item synergies for fighting |
| Potion Craft | Calm, readable, one-screen craft loop | |

---

## 2. Structure

### 2.1 A year in four weeks

Zakat is paid once a lunar year (the hawl) on what you own. It is not paid weekly on profit. So the slice runs four in-game weeks, one per season, and those four weeks make one year. Weeks 1 to 3 end with the weekly profit ledger. Week 4 ends the year, and that is when zakat is counted and paid.

| Week | Season | Main event | New thing the player learns |
| --- | --- | --- | --- |
| 1 | Spring | You inherit a small stall. First trip to the date groves with a handcart. | Buying, costing, packing, pricing |
| 2 | Summer | A ship from India docks. Spices are cheap at Ubulla port. The medium stall opens for rent. | Choosing a source, rent against shelf space |
| 3 | Autumn | A caravan is late and grain runs short. Your rival Harith hoards dates. A Bedouin trader offers leather on credit. | No hoarding, buying on credit |
| 4 | Winter | Cloth sells well in the cold. The big stall opens for rent. On the last night the crier announces the end of the year. | Year-end count and zakat |

### 2.2 A week

```
Weekend (2 days, played as one trip)
  Alleys -> City gate -> Source map -> Hire cart -> Buy and pack -> Ride home -> Weekend ledger
Weekdays (5 shop days)
  Morning -> Midday -> Afternoon -> Dusk -> Night: day summary
End of week
  Weekly ledger (weeks 1 to 3) or year end at the bayt al-mal (week 4)
```

### 2.3 Opening position

| Item | Value |
| --- | --- |
| Cash | 160 dirham |
| Stock left by your uncle | 2 baskets of dates, 1 roll of cloth (about 52 dirham at market price) |
| Total | about 212 dirham, over the nisab of 200 |
| Stall | Small, rent for week 1 already paid by your uncle |
| Amanah | 60 out of 100 |
| Hawl | Already running. Your uncle's ledger shows his wealth crossed the nisab last Ramadan, so the year ends after week 4. |

The prologue is under one minute: your uncle hands over the stall and the ledger, and a letter from Umar is read aloud in the market telling traders to value their goods and pay zakat on them. Umar never appears.

---

## 3. Weekend

### 3.1 Getting there: the alleys

The player leaves the bazaar through the arch at the back and walks narrow mud-brick lanes with cloth shades overhead. The camera follows from behind and above and turns with the lane. Places are marked by floating signs. Tap a sign, or a place button in the bottom panel, to walk there along the lane graph.

| Place | What happens there |
| --- | --- |
| Bazaar | Back to the stall |
| City gate | Weekend trips start here, at the caravan ground outside the gate |
| Bayt al-mal | Year-end zakat count (week 4 only; before that it shows a short note) |
| Storeroom | Swap stock between days (optional in the slice, can live inside the bazaar UI) |

### 3.2 The source map

At the gate the player picks where to go. Prices move with the week's events.

| Source | Open | Sells |
| --- | --- | --- |
| Date groves | All weeks | Dates, pottery, straw |
| Ubulla port | All weeks | Cloth, spices |
| Bedouin camp | Week 3 only | Leather, on cash or credit |

One trip per weekend.

### 3.3 Hiring a cart

The cart sets the grid size and the transport cost of the trip.

| Cart | Grid | Hire per trip (dirham) | Matches |
| --- | --- | --- | --- |
| Handcart | 4 x 3 (12 cells) | 6 | Small stall |
| Donkey cart | 5 x 4 (20 cells) | 12 | Medium stall |
| Two camels | 6 x 5 (30 cells) | 20 | Big stall |

### 3.4 Buying and packing

The buy screen shows the source's goods with today's price. Bought goods drop into a tray beside the cart grid. The player drags each into the grid and taps to rotate. Goods left in the tray when the player leaves are refunded at 100%, since nothing was carried.

**Goods**

| Good | Shape (cells) | Source | Buy price | Base sell price | Rule |
| --- | --- | --- | --- | --- | --- |
| Dates, a basket | 1 x 2 | Groves | 6 | 10 | Spoils 5 shop days after purchase |
| Pottery jar | 2 x 2 | Groves | 8 | 15 | 1 in 4 breaks on the ride home unless it touches cloth or straw |
| Straw bundle | 1 x 1 | Groves | 1 | Not sold | Padding only |
| Cloth roll | 1 x 3 | Port | 20 | 32 (40 in winter) | Counts as padding |
| Spice sack | 1 x 1 | Port | 30 (21 in week 2) | 50 | Small and valuable, sells best at dusk |
| Leather bundle | 2 x 1 | Bedouin camp | 12 | 20 | Week 3 only, can be bought on credit |

**Packing rules**

- A good must sit fully inside the grid and cannot overlap another.
- Touching means sharing an edge, not a corner.
- A jar touching at least one cloth roll or straw bundle is padded and cannot break.
- Empty cells are shown in the ledger as wasted hire.

Rules held back for the full game: heavy goods crushing goods below them, spices tainting dates, a weight limit separate from space.

### 3.5 The costing ledger

Every purchase becomes a line in the weekend ledger. The cart hire is shared across the goods by the cells each one takes, so every good gets a landed cost.

```
landed cost of an item = buy price + hire x (cells the item takes / cells in the cart)
```

Worked example, week 1, handcart at the groves: 4 date baskets (8 cells) and 1 jar (4 cells) fill all 12 cells. Goods cost 24 + 8 = 32. Hire is 6. Total 38.

| Item | Buy | Share of hire | Landed cost |
| --- | --- | --- | --- |
| Date basket | 6 | 6 x 2/12 = 1 | 7 |
| Jar | 8 | 6 x 4/12 = 2 | 10 |

The landed cost is shown on each price card during the week as the player's floor price.

### 3.6 The ride home

A short animated ride on the map, about 10 seconds. Unpadded jars roll for breakage, and a broken jar is shown with a cracked icon and written off in the ledger. A dodging mini-game for the ride is held for the full game.

---

## 4. Weekdays: the shop

### 4.1 Stall sizes

Chosen at the weekend before the trip. Rent is paid from cash at the start of the week.

| Stall | Shelves | Rent per week (dirham) | Customers per day | Location | Available |
| --- | --- | --- | --- | --- | --- |
| Small | 2 | 10 | 6 to 8 | Back row near the arch | Week 1 |
| Medium | 3 | 25 | 8 to 10 | Middle aisle | From week 2 |
| Big | 4 | 45 | 10 to 13 | Corner by the well | From week 4 |

Customer counts are before the amanah modifier (4.6).

### 4.2 Shelves and prices

Each shelf holds one kind of good from the storeroom. Before the day, and between days, the player drags goods onto shelves and sets each price with minus and plus buttons in steps of 1 dirham. Prices can be changed during the day.

Each price card shows the good, stock left, the price, the landed cost as a small line under it, and the face of the last customer who looked at it.

### 4.3 Day to night

One shop day is 45 seconds.

| Phase | Seconds | Light | Who comes |
| --- | --- | --- | --- |
| Morning | 0 to 12 | Cool, long shadows | Households, a child sent for dates |
| Midday | 12 to 22 | White, short shadows, fewer people | Anyone looking for something cheap |
| Afternoon | 22 to 34 | Warm | Craftsmen, a scholar |
| Dusk | 34 to 45 | Orange, lamps come on | Sailors back from the river |

At 45 seconds the stall closes, customers already walking up are served, and the night summary appears.

### 4.4 Customers

Customers come out of the bazaar crowd, walk to the shelf they want, look at the price for about 0.7 seconds, react, and buy or walk off.

**Customer types**

| Type | Comes at | Prefers | Price sensitivity |
| --- | --- | --- | --- |
| Household buyer | Morning | Dates, pottery | Normal |
| Child sent for dates | Morning | Dates | High: will not pay above market |
| Labourer | Midday | Cheapest shelf | High |
| Craftsman | Afternoon | Leather, cloth | Normal |
| Scholar | Afternoon | Cloth | Low, may ask for credit |
| Bedouin trader | Afternoon | Pottery | Normal |
| Sailor | Dusk | Spices | Low: pays up to 130% without complaint |
| Harith's boy | Any | Checks your prices, never buys | None |

**Reaction to price**

The reaction compares the shelf price with the good's market price for that week.

| Price vs market | Face | Result | Amanah |
| --- | --- | --- | --- |
| Under 80% | Delighted | Buys at once, sometimes two | No change, but the player loses margin |
| 80% to 110% | Happy | Buys | +1 per sale |
| 110% to 130% | Unsure | Buys half the time | -2 per sale |
| Over 130% | Angry | Walks off and tells others | -5 |

Low-sensitivity customers shift each band up by 20 points. High-sensitivity customers treat anything above 100% as Unsure.

### 4.5 The scale

From week 1 day 3, some customers ask for dates or spices by weight. The player holds a finger down to fill the pan and lets go at the line.

| Result | Effect |
| --- | --- |
| Within the line | Normal sale |
| Short by more than 10% | Amanah -10. Twice in a week brings the market inspector. |
| Over by more than 10% | Stock lost, amanah +3 |

### 4.6 Amanah

A meter from 0 to 100, starting at 60.

| Amanah | Effect |
| --- | --- |
| 80 and up | +2 customers a day, a regular customer appears |
| 60 to 79 | Normal |
| 40 to 59 | -1 customer a day |
| Under 40 | The market inspector visits the next morning, checks your scale, and the stall opens at midday |

Amanah does not change the zakat owed. It shows on every ledger and on the end screen.

### 4.7 Spoilage and the storeroom

Dates spoil 5 shop days after purchase. A basket one day from spoiling shows a warning on its card. Spoiled dates are written off in the weekly ledger. Other goods keep.

### 4.8 Night summary

A card at the end of each day: items sold, revenue, customers who walked off, amanah change, stock left, and anything about to spoil. Tap to start the next morning. The game saves here.

---

## 5. End of week: the ledger

After the fifth night the ledger opens as a full page drawn like a merchant's book. Lines fill in one at a time.

Worked example, week 1, small stall, all new stock sold:

| Line | Dirham |
| --- | --- |
| Revenue: 4 date baskets at 10, 1 jar at 15 | 55 |
| Cost of goods sold, landed (from the weekend ledger) | -38 |
| Stall rent | -10 |
| **Profit for the week** | **7** |
| Cash: 160 at the start, -38, -10, +55 | 167 |

The page also shows: unsold stock carried forward at landed cost, spoiled or broken goods written off, money owed to you, money you owe, and amanah for the week.

The thin first week is deliberate. The small stall barely pays, which makes renting the medium stall in week 2 a real decision.

---

## 6. Year end: zakat

### 6.1 Flow

1. After week 4's ledger, the crier announces the end of the year.
2. The player walks the alleys to the bayt al-mal.
3. **Value the storeroom.** For each stack, three price tags appear: what you paid, today's market price, the price you hope to get. Today's market price is correct. A wrong pick shows one line explaining why, then lets the player try again. Spoiled and broken goods count for nothing.
4. **Add money owed to you,** such as a scholar who bought cloth on credit.
5. **Take off debts due now,** such as the Bedouin trader's leather from week 3 if it is unpaid.
6. **Check against the nisab** of 200 dirham. If the total is over, one fortieth is due.
7. **Pay.** The player carries the coins to the clerk, who checks the ledger and writes it in his register.
8. **Optional sadaqah.** A separate prompt to give extra. It is shown apart from zakat so the difference is clear.
9. **Where it went.** Eight short scenes, one per asnaf.
10. **End screen.**

### 6.2 Formula

```
zakatable total = cash
                + unsold stock at today's market price
                + money owed to you (that you expect to be paid)
                - debts you owe that are due now
if zakatable total >= nisab: zakat = zakatable total / 40
```

Costs already paid during the year (rent, cart hire, stock bought) are not deducted again. That money has already left the chest.

### 6.3 Worked example

| Line | Dirham |
| --- | --- |
| Cash in the chest | 420 |
| Unsold stock at today's market price | 90 |
| Owed to you by a customer | 20 |
| Owed by you to the Bedouin trader | -30 |
| **Zakatable total** | **500** |
| Nisab | 200 |
| **Zakat** | **12.5** |

### 6.4 The eight asnaf

About 7 seconds each, tap to move on. Staged in the same 3D town with the camera moved in. Nobody has a face.

| Asnaf | Scene |
| --- | --- |
| Fuqara (the poor) | A widow with no income gets her month's food |
| Masakin (the needy) | A labourer who works but cannot cover rent |
| Amil (the collectors) | The clerk himself, paid for his work |
| Muallaf (those whose hearts are being brought close) | A Persian craftsman, newly Muslim, settling into the city |
| Riqab (freeing slaves) | A man paying to buy back his freedom |
| Gharimin (debtors) | A boatman whose boat sank, his debt cleared |
| Fi sabilillah (in the way of Allah) | To be decided with the ikhlas.com ustaz |
| Ibn sabil (the stranded traveller) | A traveller robbed on the road, given enough to get home |

### 6.5 End screen

- Your year: total profit, amanah, zakat paid, sadaqah given.
- One line: "Zakat on trade goods is still due today. Count yours." (BM: "Zakat perniagaan masih wajib hari ini. Kira zakat anda.")
- Button: opens the ikhlas.com zakat page through the app's own router.
- Share card with the player's year, for WhatsApp and Instagram.
- Play again.

The real-world zakat button must follow the method of the zakat body the money goes to. Malaysian state zakat bodies use their own business zakat method.

---

## 7. Events

| When | Event | Effect |
| --- | --- | --- |
| Week 2, weekend | The crier: a ship from India has docked at Ubulla | Spice buy price 21 instead of 30 for the week |
| Week 3, day 2 | A caravan is late, grain is short | Dates market price +60% for the day |
| Week 3, day 2 | Harith holds his dates back | Choice prompt, below |
| Week 3, weekend | A Bedouin trader offers leather on credit | Leather can be bought now and paid at year end |
| Week 4, weekend | Cold winter | Cloth base sell price 40 |
| Week 4, night 5 | The crier announces the end of the year | Leads to the bayt al-mal |

**The Harith choice (week 3, day 2)**

| Choice | What happens |
| --- | --- |
| Sell at your normal fair price | Amanah +15. One extra regular customer a day for the rest of the week. Harith's stall is empty by week 4. |
| Hold your dates for tomorrow's higher price | The market inspector visits. Amanah -20. The caravan arrives overnight, so the dates price falls 20% below normal for the rest of the week, and the held dates are closer to spoiling. |

The game never lectures. The outcome is the lesson, and one line from the crier names the rule afterwards: hoarding food to push up the price (ihtikar) is forbidden.

---

## 8. Failing and recovering

- **Not enough cash for rent.** A friend of your uncle offers an interest-free loan (qard hasan) for the shortfall. It shows on every ledger and as a debt at year end.
- **Ending the year under the nisab.** Allowed. The clerk explains that no zakat is due this year and why. The end screen still shows the asnaf walk, framed as what other people's zakat did.
- **Stall left empty.** Customers walk past. The day still ends normally.

There is no game over. The player always reaches the end of the year.

---

## 9. Economy and balance

### 9.1 Targets

| Measure | Target |
| --- | --- |
| Week 1 profit, careful play | 5 to 15 dirham |
| Week 4 profit, careful play with big stall | 60 to 100 dirham |
| Year-end zakatable total, careful play | 450 to 650 dirham |
| Year-end zakatable total, careless play | 250 to 320 dirham |
| Under the nisab | Possible only with very poor play |
| Time for a full year | 25 to 30 minutes |

These are starting numbers. Tune them in the playtest in week 6 of the build.

### 9.2 Market prices by week

Base sell price, used as "market price" in the reaction table and in the year-end valuation.

| Good | Week 1 | Week 2 | Week 3 | Week 4 |
| --- | --- | --- | --- | --- |
| Dates | 10 | 10 | 10 (16 on day 2) | 11 |
| Pottery | 15 | 15 | 16 | 15 |
| Cloth | 32 | 30 | 32 | 40 |
| Spices | 50 | 42 | 50 | 50 |
| Leather | | | 20 | 20 |

---

## 10. Saving and progression

- Autosave at the start of every morning and every weekend, in the web view's local storage.
- If storage is blocked or cleared, the game starts from the prologue without error.
- One save slot in the slice.
- No unlocks outside the year in the slice. The full game adds more years and more of the city.

---

## 11. Screens and controls

| Screen | Main controls |
| --- | --- |
| Title | Play, Continue, BM/EN |
| Prologue | Tap to advance |
| Bazaar, before opening | Drag goods to shelves, minus and plus on each price, Open Stall, To the alleys |
| Bazaar, open | Price buttons, the scale when asked |
| Night summary | Next morning |
| Alleys | Tap a sign or a place button to walk |
| Source map | Pick a source |
| Cart hire | Pick a cart |
| Buy and pack | Buy buttons, drag into the grid, tap to rotate, Leave |
| Ride home | Watch |
| Weekly ledger | Next week |
| Bayt al-mal | Tap stacks to value, Pay, Sadaqah prompt |
| Asnaf walk | Tap to advance |
| End screen | Zakat page, Share, Play again |

All UI is drawn in the canvas on a fixed 360 x 640 frame. No HTML UI. See the style and world guide for the visual rules.

Accessibility in the slice: every control is at least 32 x 28 logical pixels, text at least 11 px on the 360 frame, reduced motion turns off walk bobbing and camera easing, and colour is never the only signal (faces have shapes as well as colours).

---

## 12. Technology

| Area | Decision |
| --- | --- |
| Engine | three.js with TypeScript, built with Vite |
| Rendering | Low-poly, flat-shaded. One palette and one light rig over every model |
| Models | Free low-poly GLB models from threejsassets.com (commercial use allowed, no credit needed, no reselling the files). People and missing props built in code. Draco and KTX2 decoders hosted by us |
| UI | A second three.js scene with a flat camera, drawn over the world on a fixed 360 x 640 frame that scales to fit and keeps clear of notches. Text with troika-three-text (SDF) at the device pixel ratio |
| Strings | One JSON file per language |
| Hosting | Cloudflare Pages, on an Artifisi games subdomain |
| App integration | Flutter package `ikhlas_games` wrapping a web view, shared as a private git repo |
| Budgets | About 100,000 triangles on screen at most, under 8 MB on first load, 60 fps on mid-range phones, 30 fps floor on low-end Android |

### 12.1 Flutter package

```dart
IkhlasGames.open(
  context,
  game: 'bazaar-basra',
  lang: 'ms',
  onEvent: (e) => analytics.log(e.name, e.params),
  onZakatTap: () => router.push('/zakat'),
);
```

### 12.2 Play events

No names, phone numbers or anything personal.

| Event | Params |
| --- | --- |
| `game_start` | lang |
| `day_end` | week, day, revenue, amanah |
| `week_end` | week, profit, stall |
| `cart_hire` | week, cart |
| `stall_rent` | week, stall |
| `harith_choice` | choice |
| `zakat_paid` | amount_dirham, total |
| `sadaqah_given` | amount_dirham |
| `game_finish` | minutes_played |
| `zakat_cta_tap` | |
| `share_tap` | |

### 12.3 App store

Apple's guideline 4.7 allows HTML5 mini games inside an app under conditions. The ikhlas.com developers should confirm before the build. The slice takes no payments, so store fees do not apply.

---

## 13. Content review

Every line of text, every asnaf scene and every fiqh rule goes to the ikhlas.com ustaz or shariah reviewer before release. Review starts in build week 4 with the text and scenes, not at the end.

Points to confirm:

- Valuing trade goods at market price on the day the year ends.
- Counting money owed to you (some scholars count only debts likely to be paid).
- Taking off debts due.
- Rounding of the zakat amount.
- How nisab in dirham maps to today's 85 g of gold.
- The riqab and fi sabilillah scenes.
- The qard hasan loan as a fail recovery.
- Whether any music is acceptable.

---

## 14. Production

### 14.1 Build plan

| Dates (2026) | Work | Playable at the end |
| --- | --- | --- |
| 2 to 6 Nov | Stall sizes, day to night lighting, customers by time of day, night summary, storeroom swaps | Five shop days in a row |
| 9 to 13 Nov | Source map, buying, cart hire, packing grid with shapes and rotation, weekend ledger with landed cost | A weekend, start to finish |
| 16 to 20 Nov | Ride home with breakage, weekly ledger, rent and stall upgrades, spoilage | Week 1, complete |
| 23 to 27 Nov | Weeks 2 to 4 content and events, the scale, amanah and the inspector | All four weeks |
| 30 Nov to 4 Dec | Year end, zakat count, asnaf walk, end screen, BM text, Flutter package, play events | The whole year |
| 7 to 11 Dec | Ustaz review fixes, ikhlas.com test build, playtest with 5 people including a teenager and a parent, balance | Ready to ship |
| 14 Dec | Live in the ikhlas.com app | |

### 14.2 In and out of the slice

| In | Out (full game) |
| --- | --- |
| One year, four weeks | More years, a city that grows |
| Three sources, three carts, three stalls | More sources, boats, hired help |
| Six goods | More goods, crafting |
| Packing with padding | Weight, crushing, tainting |
| Map ride with breakage | Dodging ride mini-game |
| Harith event, credit from the Bedouin | Mudarabah partnerships, the famine year (Am al-Ramadah) |
| One save slot | Multiple saves, cloud save |
| BM and English | Bahasa Indonesia, Arabic |

### 14.3 Risks

| Risk | Effect | Response |
| --- | --- | --- |
| Ustaz review is slow or changes a core rule | Misses 14 Dec | Send text and scenes in build week 4 |
| ikhlas.com app release cycle | The package waits for their next release | Get it into a December release early. Game updates after that need no app release |
| Free pilot grows in scope | Unpaid weeks | Anything outside this document waits for the paid deal |
| Low-end Android web view performance | Slow or broken game | Test on a low-end Android in build week 1 |
| Packing grid is fiddly on small phones | Players quit at the first weekend | Large cells, snap to grid, an auto-pack button as a fallback |

---

## 15. Open questions

1. Is one sitting of 25 to 30 minutes right inside an app, or should each week be its own session? Current plan: saves every morning and weekend.
2. Should the ride home become a dodging mini-game in the slice? Current plan: no.
3. Haggling at the source: in or out? Current plan: out.
4. Does ikhlas.com want its name in the world, such as a caravan banner, or only in the app around the game?
5. Which zakat bodies is the ikhlas.com zakat page collecting for, and which method should the end screen follow?
6. Player character: fixed, or a choice of a young man or a young woman? Current plan: fixed, unnamed merchant. A choice costs one extra figure and some text.
