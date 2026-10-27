// Entry point. For now this sets up the stage, the fixed-step clock and an empty world;
// the bazaar scene is ported from prototype/mockup.html in build week 1.

import { Color, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import { FixedClock, STEP } from './engine/clock';
import { LH, LW, fitStage } from './engine/stage';

const stage = document.getElementById('stage') as HTMLDivElement;
const worldCanvas = document.getElementById('world') as HTMLCanvasElement;
const ui = document.getElementById('ui') as HTMLCanvasElement;
const ctx = ui.getContext('2d')!;

const renderer = new WebGLRenderer({ canvas: worldCanvas, antialias: true });
const scene = new Scene();
scene.background = new Color(0xe8cd9c);
const camera = new PerspectiveCamera(44, LW / LH, 0.1, 120);

let scale = 1;
let dpr = 1;
function resize() {
  const s = fitStage(window.innerWidth, window.innerHeight, window.devicePixelRatio);
  scale = s.scale;
  dpr = s.dpr;
  Object.assign(stage.style, {
    width: `${s.width}px`, height: `${s.height}px`,
    left: `${(window.innerWidth - s.width) / 2}px`, top: `${(window.innerHeight - s.height) / 2}px`,
  });
  renderer.setPixelRatio(s.dpr);
  renderer.setSize(s.width, s.height, false);
  for (const c of [worldCanvas, ui]) { c.style.width = `${s.width}px`; c.style.height = `${s.height}px`; }
  ui.width = Math.round(s.width * s.dpr);
  ui.height = Math.round(s.height * s.dpr);
  camera.aspect = s.width / s.height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const clock = new FixedClock();
document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.reset(); });

let simTime = 0;
function frame(now: number) {
  const steps = clock.tick(now);
  for (let i = 0; i < steps; i++) simTime += STEP;
  renderer.render(scene, camera);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
  ctx.clearRect(0, 0, LW, LH);
  ctx.fillStyle = '#3a2a1a';
  ctx.font = '700 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Pasar Basra · ${simTime.toFixed(1)}s`, LW / 2, LH / 2);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
