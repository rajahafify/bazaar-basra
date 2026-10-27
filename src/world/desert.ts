// The expedition map in 3D: open desert with dunes and palms, a marker for each stop, the
// towns at either end, and camels for the caravan. Built from the same merged low-poly parts
// as the town; models from an asset pack can replace the markers later.

import {
  BoxGeometry, BufferGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  PlaneGeometry, SphereGeometry,
} from 'three';
import type { NodeKind } from '../sim';
import { Builder, sceneryRandom, worldMaterial } from './build';
import { C } from './palette';
import { house, palm } from './scenes';

const rnd = sceneryRandom(638);
const flat = { rot: [-Math.PI / 2, 0, 0] as [number, number, number] };

/** Spacing between stops along the route, and the x of the two stops in a pair. */
export const STEP_Z = 6;
export const LANE_X = 2.6;

export function buildDesert(): Group {
  const group = new Group();
  const b = new Builder();
  b.add(new PlaneGeometry(90, 120), C.sand, 0, 0, -30, flat);
  for (let i = 0; i < 70; i++) {
    const x = rnd.range(-30, 30), z = rnd.range(-70, 14);
    if (Math.abs(x) < 6) continue;
    b.add(new SphereGeometry(rnd.range(1.5, 4), 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), rnd.pick([C.sand, C.sandDark, 0xe0c08f]), x, -0.2, z, { scale: [1.6, rnd.range(0.25, 0.5), 1] });
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd.pick([-1, 1]) * rnd.range(5, 16), z = rnd.range(-66, 10);
    b.add(new SphereGeometry(rnd.range(0.2, 0.55), 5, 3), C.rock, x, 0.05, z, { scale: [1.3, 0.7, 1] });
  }
  for (let i = 0; i < 9; i++) palm(b, rnd.pick([-1, 1]) * rnd.range(6, 14), rnd.range(-64, 8), rnd.range(0.8, 1.1));
  group.add(b.mesh());
  return group;
}

const markerCache = new Map<string, BufferGeometry>();

function geo(key: string, f: (b: Builder) => void): BufferGeometry {
  const hit = markerCache.get(key);
  if (hit) return hit;
  const b = new Builder();
  f(b);
  const g = b.geometry();
  markerCache.set(key, g);
  return g;
}

/** A stop on the map, by what kind of event it holds. */
export function stopMarker(kind: NodeKind | 'hidden'): Mesh {
  const g = geo(kind, b => {
    b.add(new CylinderGeometry(1.1, 1.2, 0.08, 14), C.sandDark, 0, 0.04, 0);
    switch (kind) {
      case 'road':
        // A cairn and a dune ridge: the road itself is the danger.
        for (let i = 0; i < 4; i++) b.add(new SphereGeometry(0.3 - i * 0.05, 6, 4), C.rock, rnd.range(-0.1, 0.1), 0.2 + i * 0.32, 0, { scale: [1.2, 0.8, 1.1] });
        b.add(new SphereGeometry(0.9, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), C.sand, 0.7, 0, -0.4, { scale: [1, 0.5, 0.6] });
        break;
      case 'trader':
        b.add(new BoxGeometry(1.4, 0.55, 0.6), C.wood, 0, 0.3, 0.1);
        for (const x of [-0.65, 0.65]) b.add(new CylinderGeometry(0.04, 0.04, 1.5, 5), C.woodDark, x, 0.75, -0.2);
        b.add(new BoxGeometry(1.7, 0.05, 1.0), C.madder, 0, 1.5, 0, { rot: [-0.2, 0, 0] });
        b.add(new SphereGeometry(0.2, 6, 4), C.sack, -0.35, 0.68, 0.1);
        b.add(new SphereGeometry(0.2, 6, 4), C.clay, 0.3, 0.68, 0.1);
        break;
      case 'people':
        b.add(new ConeGeometry(0.95, 1.2, 4), C.tent, 0, 0.6, -0.1, { rot: [0, Math.PI / 4, 0], scale: [1.3, 1, 1] });
        b.add(new CylinderGeometry(0.25, 0.3, 0.12, 8), C.rock, 0.9, 0.06, 0.7);
        b.add(new ConeGeometry(0.16, 0.36, 6), C.saffron, 0.9, 0.3, 0.7);
        break;
      case 'find':
        for (const [x, h] of [[-0.5, 1.4], [0.1, 0.8], [0.6, 1.1]] as const) b.add(new CylinderGeometry(0.17, 0.2, h, 7), C.brickC, x, h / 2, 0);
        b.add(new BoxGeometry(1.4, 0.2, 0.4), C.brickB, -0.2, 1.45, 0, { rot: [0, 0, -0.15] });
        break;
      case 'hidden':
        b.add(new CylinderGeometry(0.06, 0.06, 1.6, 5), C.woodDark, 0, 0.8, 0);
        break;
    }
  });
  const m = new Mesh(g, worldMaterial);
  if (kind === 'hidden') m.add(questionSign());
  return m;
}

let qTex: CanvasTexture | null = null;

function questionSign(): Mesh {
  if (!qTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    x.fillStyle = '#f2e4c4'; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill();
    x.strokeStyle = '#2e2015'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#3a2a1a'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 32, 35);
    qTex = new CanvasTexture(c);
  }
  const m = new Mesh(new PlaneGeometry(0.8, 0.8), new MeshBasicMaterial({ map: qTex, transparent: true, side: DoubleSide }));
  m.position.set(0, 1.85, 0);
  return m;
}

/** Basra or the destination town at an end of the route. */
export function townMarker(home: boolean): Mesh {
  const g = geo(home ? 'basra' : 'town', b => {
    const brick = [C.brickA, C.brickB, C.brickC];
    const r = sceneryRandom(home ? 1 : 2);
    if (home) {
      [-1.6, 1.6].forEach(x => b.add(new BoxGeometry(1.0, 3.4, 1.2), C.brickB, x, 1.7, 0));
      b.add(new BoxGeometry(4.2, 0.7, 1.2), C.brickA, 0, 3.2, 0);
      for (const x of [-4.5, -3.2, 3.2, 4.5]) b.add(new BoxGeometry(1.4, 2.2, 1.1), C.brickC, x, 1.1, 0);
    } else {
      for (let i = 0; i < 6; i++) house(b, -3.4 + (i % 3) * 3.4, -0.8 - Math.floor(i / 3) * 3, 2.4, 2.4, r.range(2, 3.2), r.pick(brick), [0, 1]);
      palm(b, -5.2, 0.6, 0.9);
      palm(b, 5, 0.2, 1);
    }
  });
  return new Mesh(g, worldMaterial);
}

/** A camel from boxes and cylinders, facing +z. */
export function camelMesh(loaded: boolean): Mesh {
  const g = geo(loaded ? 'camelLoaded' : 'camel', b => {
    b.add(new BoxGeometry(0.55, 0.5, 1.2), C.camel, 0, 1.15, 0);
    b.add(new SphereGeometry(0.32, 7, 4), C.camel, 0, 1.45, -0.05, { scale: [0.9, 0.8, 1.2] });
    for (const [x, z] of [[-0.18, 0.42], [0.18, 0.42], [-0.18, -0.42], [0.18, -0.42]] as const) b.add(new CylinderGeometry(0.07, 0.06, 0.95, 5), C.camel, x, 0.47, z);
    b.add(new CylinderGeometry(0.1, 0.13, 0.75, 6), C.camel, 0, 1.55, 0.72, { rot: [0.7, 0, 0] });
    b.add(new BoxGeometry(0.2, 0.2, 0.42), C.camel, 0, 1.88, 0.98);
    if (loaded) {
      b.add(new BoxGeometry(0.95, 0.38, 0.5), C.sack, 0, 1.25, -0.05);
      b.add(new BoxGeometry(0.6, 0.12, 0.9), C.madder, 0, 1.75, -0.05);
    }
  });
  return new Mesh(g, worldMaterial);
}
