// Entry point: sets up the stage, the world, the UI canvas, input and the fixed-step loop.

import '@fontsource/reem-kufi/latin-500.css';
import '@fontsource/reem-kufi/latin-700.css';
import '@fontsource/alegreya-sans/latin-500.css';
import '@fontsource/alegreya-sans/latin-700.css';
import '@fontsource/alegreya-sans/latin-800.css';
import { FixedClock, STEP } from './engine/clock';
import { fitStage } from './engine/stage';
import { App } from './game/app';
import { toTitle } from './game/flow';
import { Draw, LH, LW } from './ui/draw';
import { World } from './world/world';

const stage = document.getElementById('stage') as HTMLDivElement;
const worldCanvas = document.getElementById('world') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLCanvasElement;
const ctx = ui.getContext('2d')!;

const world = new World(worldCanvas);
const app = new App(world, new Draw(ctx));

let uiScale = 1;
function resize() {
  const s = fitStage(window.innerWidth, window.innerHeight, window.devicePixelRatio);
  Object.assign(stage.style, {
    width: `${s.width}px`, height: `${s.height}px`,
    left: `${(window.innerWidth - s.width) / 2}px`, top: `${(window.innerHeight - s.height) / 2}px`,
  });
  world.resize(s.width, s.height, s.dpr);
  for (const c of [worldCanvas, ui]) { c.style.width = `${s.width}px`; c.style.height = `${s.height}px`; }
  ui.width = Math.round(s.width * s.dpr);
  ui.height = Math.round(s.height * s.dpr);
  uiScale = s.dpr * s.scale;
}
window.addEventListener('resize', resize);
resize();

function toLogical(e: PointerEvent): [number, number] {
  const r = ui.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * LW, ((e.clientY - r.top) / r.height) * LH];
}
ui.addEventListener('pointerdown', e => { e.preventDefault(); const [x, y] = toLogical(e); app.pointerDown(x, y); });
window.addEventListener('pointerup', () => app.pointerUp());
window.addEventListener('pointercancel', () => app.pointerUp());
ui.addEventListener('contextmenu', e => e.preventDefault());

const clock = new FixedClock();
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) clock.reset();
  else { app.pointerUp(); app.save(); }
});

const params = new URLSearchParams(location.search);
const debug = params.has('debug');
/** Debug only: run the game faster for automated playtests. */
const speed = debug ? Math.max(1, Number(params.get('speed') ?? 1)) : 1;
if (debug) {
  // Hooks for automated playtests: the current tap targets and the app.
  Object.assign(window, { __app: app, __hits: () => app.draw.hits.map(h => ({ ...h })) });
}

let last = performance.now();
function frame(now: number) {
  const steps = clock.tick(now);
  for (let i = 0; i < steps * speed; i++) app.update(STEP);
  const dt = Math.min(0.1, (now - last) / 1000) * speed;
  last = now;
  app.frame(dt, uiScale);
  requestAnimationFrame(frame);
}

const fontsReady = document.fonts?.load
  ? Promise.all([document.fonts.load('700 16px "Reem Kufi"'), document.fonts.load('700 14px "Alegreya Sans"')]).catch(() => undefined)
  : Promise.resolve();
void Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(() => {
  toTitle(app);
  requestAnimationFrame(frame);
});
