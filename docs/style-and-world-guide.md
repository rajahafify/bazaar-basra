# Bazaar Basra: Style and World Guide

Studio: Artifisi Sdn Bhd
Version: 0.1, 27 October 2026
Companion to: [gdd.md](gdd.md)

The game design document says how the game plays. This guide says what the world is, what it looks and sounds like, how it speaks, and what must never appear on screen. When the two disagree, raise it. Do not quietly pick one.

---

## 1. Why this guide exists

- We have no art team. The game looks good only if every model, colour, and line of text follows one set of rules.
- We do not use AI-generated art, voices, or music. Everything is either built in code, taken from the approved free model list, or recorded by people.
- The game is about zakat and set in the time of a Companion of the Prophet (peace be upon him). Getting a detail wrong costs trust with ikhlas.com and its users. The sensitivity rules in section 3 are not style choices. They are hard rules.

---

## 2. The world

### 2.1 Place and time

Basra, about 637 to 638 CE (around 16 to 17 AH), in the caliphate of Umar ibn al-Khattab.

- The city was founded a short time before as a camp town by Utba ibn Ghazwan, on Umar's instruction. It sits near the Shatt al-Arab, where the Tigris and Euphrates meet before the Gulf.
- Early houses were reed. After fires, people rebuilt in mud brick. Our city is in that change: mostly mud brick, with reed fences, reed roofs, and palm-trunk beams.
- The old port of al-Ubulla lies close by and handles ships from the Gulf, India, and beyond. That is where the spice and cloth in our game come from.
- Al-Mirbad, the open ground on the desert side of town, is where caravans unload and Bedouin traders meet townspeople. In the game it is the area outside the city gate.
- The town is new and busy. People come from many tribes and places. It should feel like a frontier market, not an old imperial city.

**Check before release:** the founding year, the reed-to-brick timeline, and how far al-Ubulla was from the town. Sources disagree. Our historical reviewer signs off on the in-game text (see gdd.md section 13).

### 2.2 Money and measures

- **Coins.** People pay in silver dirham and gold dinar. Muslim coins of this time reused Sasanian and Byzantine designs. Coins with only Arabic text came decades later, around 696. So our dirham art is a plain silver disc with a worn rim and faint marks. Never draw Arabic legends on the coins, and never show a ruler's face.
- **Measures.** Grain and dates are counted by the sa' and mudd, and weight by the ratl. The game uses simple units (sacks, jars, bolts, pouches). Measure names appear only in the glossary and in flavour text.
- **Nisab.** The game uses the silver nisab of 200 dirham. It is a teaching simplification, flagged for the ikhlas.com ustaz to approve or change.

### 2.3 Trade goods

Only goods that a trader in Basra at this time could plausibly handle:

| Good | Where it comes from | Notes |
| --- | --- | --- |
| Dates | Palm groves along the river | The everyday staple. Spoil if kept too long. |
| Clay jars | Local potters | Fragile. Straw padding protects them. |
| Straw | Farms | Padding and fodder. Never sold at the stall. |
| Cloth | Ships at al-Ubulla, or caravans | Linen and cotton in plain dyes. |
| Spice | Ships at al-Ubulla | Pepper and similar dried spices from India. Shown as small cloth pouches. |
| Leather | Bedouin camp | Bought on credit, which sets up the debt lesson at year end. |

**Never show these:** chilli, tomato, potato, maize, coffee, tea, sugar cubes, paper money, glass window panes, printed books, clocks, firearms, or anything with modern packaging. Coffee and tea look harmless, but they are the easiest mistakes to make and players will notice.

### 2.4 Places in the game

| Place | What it is | Look |
| --- | --- | --- |
| The bazaar | Open square with about ten stalls around a well. The player's stall faces the camera. | Bright, busy, cloth shades, crowd. |
| The alleys | Narrow lanes of mud-brick walls linking the bazaar, the city gate, and the bayt al-mal. Used for walking between places. | Shaded, warm walls, strips of sky above. This is our signature look. |
| City gate and al-Mirbad | Arch in the town wall, open ground beyond it with carts and camels. | Wide, dusty, bright. |
| Palm groves | Edge of town by the water. | Green and gold, long shadows. |
| Al-Ubulla quay | Riverside landing with small boats and stacked cargo. | Water, reed boats, sacks. |
| Bayt al-mal | Public treasury where zakat is paid. Plain mud-brick building with a clerk at a low table. | Calm, simple. Not a mosque. |

### 2.5 People

Nobody in the game has a face, a voice line, or a body that is meant to look like a real historical person.

| Character | Role | Notes |
| --- | --- | --- |
| The merchant (player) | Young trader looking after the family stall. | Not named, so any player can be them. |
| The uncle | Leaves the stall to the player at the start. Speaks through one letter and the ledger notes. | Kind and dry. Never seen after the prologue. |
| Harith | Rival trader. | Offers the hoarding scheme in week 2. Not a villain, just tempting. |
| The market inspector | Checks scales and prices in the bazaar. | Shown only by his staff and turban. Fair, not scary. |
| The bayt al-mal clerk | Counts zakat with the player at year end. | Patient, explains the count. |
| Customers | Housewife, farmer, sailor, Bedouin, scholar, child on an errand. | Told apart by clothing colour and what they carry, never by face. |

**Umar ibn al-Khattab** appears only as a letter read at the start: his instruction to merchants about honest weights and paying zakat. No figure, no silhouette, no voice. Any quotation must be checked against a source by the reviewer, or it is written as a paraphrase and labelled as such.

---

## 3. Sensitivity rules

These rules are absolute. If a feature needs one of them broken, the feature changes.

1. **No depiction of the Prophet (peace be upon him), his family, or any Companion.** No figure, silhouette, shadow, voice, or light effect standing in for them. Umar appears only as written words.
2. **No faces on any figure.** Every character is a faceless shape. This is a style and also a safety rule.
3. **No combat and no crime as gameplay.** No stealing, fighting, or chases. Cheating customers is possible (giving short weight on the scale, gdd.md section 4.5) but always costs amanah and always gets caught over time.
4. **Worship is never a mechanic.** No points for prayer, no prayer mini-game, no timers tied to prayer. Prayer times may pause the market as ambience only, if the ustaz agrees.
5. **No Mecca, Medina, or the Kaaba on screen.**
6. **No battles or conquests on screen.** The wider history may be mentioned in one line of text, never shown.
7. **Zakat recipients are shown with dignity.** The eight asnaf scenes show people being helped, not suffering. No begging animations, no crying, no rags-as-spectacle.
8. **Modest dress for all characters.** Long robes, head coverings for women, no tight clothing.
9. **No music by default.** Ambient sound only. Any music, if added later, is voice and frame drum only and needs ikhlas.com sign-off.
10. **No Quran verses or hadith text in the game** unless the ustaz supplies and checks the exact wording and translation. The ledger and letters use plain paraphrase.
11. **No gambling mechanics.** No loot boxes, no spin wheels, no random paid rewards.
12. **Ustaz review.** Every line of text about zakat, trade law, or history is checked by the ikhlas.com ustaz before release. See gdd.md section 13 for the list.

---

## 4. Art direction

### 4.1 Overall look

Low-poly, flat-shaded, warm. Think of a painted diorama seen from slightly above. Simple shapes, clear silhouettes, soft shadows, no textures beyond flat colour. The game should look handmade by a small studio, because it is.

What we avoid:

- Glossy, plastic, or realistic materials.
- Glow, bloom, lens flare, and heavy post-processing.
- Gradients on UI elements that look like a web template.
- Anything that reads as AI-generated: too much detail, melted edges, random ornaments.

### 4.2 Faceless figures

All people are built in code from primitives, so they match exactly.

| Part | Shape | Notes |
| --- | --- | --- |
| Body | Cone or tapered cylinder (robe) | Height about 1.0 world unit for adults, 0.7 for children. |
| Head | Sphere, smooth, no features | Skin tones from the palette, varied per figure. |
| Head covering | Wrapped sphere cap, turban ring, or hood draped to the shoulders | Women always have a covering that reaches the shoulders. |
| Arms | None, or a short capsule when carrying | Carried items sit in front of the body. |
| Props | Basket, jar, staff, bundle | These tell the player who the customer is. |

Movement is a gentle bob and sway. Mood is shown with an emoji in a small bubble above the head (see 4.7). The figure itself never has a face.

### 4.3 World palette

Use these and nothing else for the 3D world. Hex values are the colours as written in code.

| Name | Hex | Use |
| --- | --- | --- |
| Sky | `#e8cd9c` | Background and fog at midday. |
| Sand | `#d8b685` | Ground, open squares. |
| Brick 1 | `#c59a6a` | Main walls. |
| Brick 2 | `#b5875a` | Shaded walls, variation. |
| Brick 3 | `#d3aa79` | Sunlit walls, trims. |
| Wood | `#7a5232` | Stall frames, beams, carts. |
| Palm | `#56723c` | Palm fronds, plants. |
| Indigo | `#3d4f7c` | Cloth shades, robes. |
| Madder | `#a8432f` | Cloth shades, robes, rugs. |
| Saffron | `#d9a431` | Cloth, spice, highlights. |
| Clay | `#b4643f` | Jars, pots, roof tiles. |

Robes and cloth shades use indigo, madder, saffron, and undyed off-white (`#e9dcc0`). Skin tones vary across a warm brown range.

### 4.4 Light and time of day

One directional sun and one soft fill. The sun moves through the day and the colours shift with it.

| Time | Sun colour | Feel |
| --- | --- | --- |
| Morning | Pale gold, low from the east | Cool shadows, market setting up. |
| Midday | Near white, high | Short shadows, busiest. |
| Afternoon | Warm gold | Long shadows, trade slows. |
| Dusk | Orange to rose | Lamps start to glow at stalls. |
| Night | Deep blue fill, small warm lamp lights | Market closed, day summary over it. |

No real-time shadows on phones below mid-range. Use a soft blob shadow under figures and props instead.

### 4.5 Camera

- **Bazaar:** fixed three-quarter view from above and in front of the player's stall. The stall fills the lower third, the crowd and other stalls behind it.
- **Alleys:** follow camera behind and above the walker, steep enough that walls never block the view.
- **Weekend map and cart packing:** flat top-down, UI-led.
- Never put the camera at eye level, never rotate it freely, and never shake it.

### 4.6 3D models

We use free low-poly models from threejsassets.com (commercial use allowed, no attribution required, files may not be resold). We never use their human models; people are always our own faceless figures.

**Approved for use, after recolouring to the palette:**

- Bazaar stall, market stall, produce stand
- Date palm and small shrubs
- Camel and donkey
- Amphora, clay jars, baskets, sacks, crates
- Mudbrick houses and walls
- Desert dune and ground tiles
- Small reed boat (pirogue) for the quay

**Not allowed:**

- Anything labelled Egyptian (pyramids, sphinx, obelisks). Wrong place.
- Realistic or high-detail models. They clash with the flat look.
- Anything modern: cars, signs, lamps with bulbs, plastic crates.
- Domes and minarets. Mosque architecture of this period was simple and the reviewer has not agreed any design, so we leave religious buildings out entirely.

Every model is checked in the game before it is committed, recoloured to the palette, and listed in `assets/LICENSES.md` with its source page.

### 4.7 Icons and mood bubbles

Small flat icons drawn in canvas, two colours at most. Customer moods are the exception: four emoji, Moonlighter style, one per price band: 🤩 a bargain, 😊 a fair price, 😕 dear but they buy, 😠 too dear, they leave. The notebook shows the same emoji next to each price tried.

---

## 5. Interface

### 5.1 Rules

- All UI is drawn in canvas on top of the 3D view. No HTML or DOM interface at all, including menus and settings.
- The UI is laid out on a fixed 360 by 640 logical frame and scaled to fit the phone, so it looks the same on every device. Extra space at the edges is filled with the world, not stretched UI.
- Panels look like parchment and dark wood: a book and a counter, not an app.
- Touch targets are at least 44 by 44 logical pixels.

### 5.2 UI colours

| Token | Hex | Use |
| --- | --- | --- |
| parch | `#f2e4c4` | Panel fill, ledger pages. |
| parchDark | `#e2cfa4` | Rows, inset areas. |
| ink | `#3a2a1a` | Body text. |
| panel | `#4a3423` | Wooden bars and frames. |
| edge | `#2e2015` | Outlines and dividers. |
| gold | `#c79232` | Primary buttons, coins, highlights. |
| green | `#5f8a3e` | Profit, positive change. |
| red | `#b04a32` | Loss, warnings. |
| grey | `#8d8172` | Disabled, secondary text. |

Profit and loss are never shown by colour alone. Always add a plus or minus sign.

### 5.3 Type

- **Headings and numbers on signs:** Reem Kufi. Its Kufic shapes fit the period without using real Arabic text as decoration.
- **Body text, ledger, and buttons:** Alegreya Sans.
- Minimum text size 13 logical pixels. Ledger figures use tabular numbers so columns line up.
- Arabic script appears only where it means something (glossary terms, the bayt al-mal sign), checked by the reviewer. Never as decoration.

### 5.4 The ledger

The ledger is the heart of the interface and the main teaching tool. It looks like a hand-ruled book with two columns, money in and money out. Every number the player sees in a summary can be traced back to a line in the ledger. New lines write themselves in, one at a time, so the player sees the sum being built.

---

## 6. Sound

No music by default (see section 3). The world should sound alive.

| Sound | When |
| --- | --- |
| Crowd murmur, mixed languages, no clear words | Bazaar, louder at midday |
| Footsteps on packed earth, cart wheels | Alleys and gate |
| Coins on wood | Each sale |
| Pen scratch | Each ledger line |
| Wooden thunk | Placing an item in the cart grid |
| Clay crack | A jar breaks |
| Camel grunt, donkey bray | Gate and al-Mirbad |
| Water lapping, gulls | Al-Ubulla quay |
| Wind in palms | Groves, and soft under every scene |
| Evening crickets | Dusk and night |

All sounds come from libraries with commercial licences or are recorded by us. Listed in `assets/LICENSES.md`. No synthetic voices.

---

## 7. Writing

### 7.1 Voice

- Plain, warm, and short. A good teacher talking to a teenager, not a textbook.
- Never preachy. The game shows the lesson through numbers and choices; the text does not lecture.
- No modern slang and no fake old English ("thee", "verily").
- Every sentence works in Bahasa Malaysia and English. Write the BM and EN together, not one translated after.
- Keep any single text box under 30 words. The ledger is the only place for detail.
- Respectful forms: "the Prophet (peace be upon him)" in EN, "Nabi Muhammad SAW" in BM. Companions with "may Allah be pleased with him" (EN) and "RA" (BM) on first mention in a screen.

### 7.2 Sample lines

| Moment | English | Bahasa Malaysia |
| --- | --- | --- |
| Day opens | The bazaar is waking up. | Pasar mula sibuk. |
| Customer haggles | Too dear. Ten, and I'll take it. | Mahal sangat. Sepuluh, saya ambil. |
| Jar breaks | One jar cracked on the road. Straw would have saved it. | Satu tempayan pecah di jalan. Jerami boleh menyelamatkannya. |
| Weekly profit | This week you made 7 dirham after rent and stock. | Minggu ini untung 7 dirham selepas sewa dan stok. |
| Year end | A year has passed since you took the stall. Time to count what you own. | Sudah setahun anda menjaga gerai. Masa untuk mengira harta anda. |

### 7.3 Glossary

| Term | Arabic | Bahasa Malaysia | English meaning |
| --- | --- | --- | --- |
| Zakat | زكاة | Zakat | Yearly obligatory payment on wealth above the nisab. |
| Nisab | نصاب | Nisab | Minimum wealth before zakat is due. |
| Hawl | حول | Haul | One full lunar year of holding wealth. |
| Amanah | أمانة | Amanah | Trustworthiness, honesty in dealings. |
| Bayt al-mal | بيت المال | Baitulmal | Public treasury. |
| Qard hasan | قرض حسن | Qard al-hasan | Interest-free loan. |
| Dirham | درهم | Dirham | Silver coin. |
| Dinar | دينار | Dinar | Gold coin. |
| Sa' | صاع | Gantang | A measure of volume for grain and dates. |
| Mudd | مد | Cupak | A quarter of a sa'. |
| Suq | سوق | Pasar | Market. |
| Ihtikar | احتكار | Sorok barang | Hoarding to push prices up. Harith's scheme. |

The eight asnaf, as shown in the year-end scenes:

| Arabic | Bahasa Malaysia | English |
| --- | --- | --- |
| al-Fuqara' | Fakir | The poor |
| al-Masakin | Miskin | The needy |
| al-'Amilin 'alayha | Amil | Zakat collectors and administrators |
| al-Mu'allafati qulubuhum | Muallaf | Those whose hearts are being drawn to Islam |
| fi al-Riqab | Riqab | Freeing those in bondage |
| al-Gharimin | Gharimin | Those in debt |
| fi Sabilillah | Fisabilillah | In the cause of Allah |
| Ibn al-Sabil | Ibnu Sabil | Stranded travellers |

Arabic spellings and BM terms follow the usage of Malaysian state zakat bodies. The ustaz confirms the final list.

---

## 8. Checklist before anything goes in the build

- [ ] Fits the world palette and the flat look.
- [ ] No faces. No depiction of the Prophet (peace be upon him), his family, or Companions.
- [ ] Not an anachronism (section 2.3).
- [ ] Model or sound source is listed in `assets/LICENSES.md`.
- [ ] Text written in BM and EN together, under 30 words per box.
- [ ] Anything about zakat, law, or history is on the ustaz review list.
- [ ] Looks right on a small phone (360 by 640) and a large one.
