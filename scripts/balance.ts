// Plays many years with scripted players and compares them with the targets in gdd 9.1.
// Run with: npm run balance

import { CAREFUL, CARELESS, playYear, type YearResult } from '../src/sim/bot';

const RUNS = 200;
const targets: Record<string, string> = {
  careful: 'week 1 profit 5 to 15, week 4 profit 60 to 100, zakatable 450 to 650',
  careless: 'zakatable 250 to 320',
};

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)]!;
const fmt = (xs: number[]) => `median ${pct(xs, 0.5)}  (10% ${pct(xs, 0.1)}, 90% ${pct(xs, 0.9)})`;

for (const st of [CAREFUL, CARELESS]) {
  const runs: YearResult[] = [];
  for (let seed = 1; seed <= RUNS; seed++) runs.push(playYear(st, seed));
  console.log(`\n${st.name}: ${targets[st.name]}`);
  for (let w = 0; w < 4; w++) console.log(`  week ${w + 1} profit   ${fmt(runs.map(r => r.weekProfits[w]!))}`);
  console.log(`  zakatable total ${fmt(runs.map(r => r.zakatableTotal))}`);
  console.log(`  amanah          ${fmt(runs.map(r => r.amanah))}`);
  console.log(`  under nisab     ${runs.filter(r => r.zakat === 0).length} of ${RUNS}`);
}
