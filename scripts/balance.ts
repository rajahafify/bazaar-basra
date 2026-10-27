// Plays many years with scripted players to check the loop: the careful trader should grow
// season on season and end well above the nisab; the greedy one should end below them.
// Run with: npm run balance

import { CAREFUL, CARELESS, playYear, type YearResult } from '../src/sim/bot';

const RUNS = 200;
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)]!;
const fmt = (xs: number[]) => `median ${Math.round(pct(xs, 0.5))}  (10% ${Math.round(pct(xs, 0.1))}, 90% ${Math.round(pct(xs, 0.9))})`;

for (const st of [CAREFUL, CARELESS]) {
  const runs: YearResult[] = [];
  for (let seed = 1; seed <= RUNS; seed++) runs.push(playYear(st, seed));
  const done = runs.filter(r => !r.broke);
  console.log(`\n${st.name}`);
  console.log(`  went broke      ${runs.length - done.length} of ${RUNS}`);
  for (let i = 0; i < 4; i++) console.log(`  worth, season ${i + 1} end ${fmt(done.map(r => r.worthBySeason[i] ?? 0))}`);
  console.log(`  profit          ${fmt(done.map(r => r.profit))}`);
  console.log(`  zakatable total ${fmt(done.map(r => r.zakatableTotal))}`);
  console.log(`  amanah          ${fmt(done.map(r => r.amanah))}`);
  console.log(`  trips           ${fmt(done.map(r => r.trips))}`);
  console.log(`  upgrades        ${fmt(done.map(r => r.upgrades))}`);
  console.log(`  under nisab     ${done.filter(r => r.zakat === 0).length} of ${done.length}`);
}
