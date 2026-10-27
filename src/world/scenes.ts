// The bazaar square and the alleys, built once as merged meshes (style guide 2.4).

import {
  BoxGeometry, CanvasTexture, ConeGeometry, CylinderGeometry, DoubleSide, Group, LatheGeometry, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, SphereGeometry, Vector2, Vector3,
} from 'three';
import type { GoodId } from '../sim';
import { Builder, sceneryRandom } from './build';
import { C } from './palette';

const rnd = sceneryRandom(1638);
const flat = { rot: [-Math.PI / 2, 0, 0] as [number, number, number] };

function house(b: Builder, x: number, z: number, w: number, d: number, h: number, color: number, face: [number, number]) {
  b.withTransform([x, 0, z], 0, () => {
    b.add(new BoxGeometry(w, h, d), color, 0, h / 2, 0);
    b.add(new BoxGeometry(w + 0.12, 0.22, d + 0.12), C.brickB, 0, h + 0.11, 0);
    const [fx, fz] = face;
    const ox = fx * (w / 2 + 0.02), oz = fz * (d / 2 + 0.02);
    const along: [number, number] = fx !== 0 ? [0, 1] : [1, 0];
    const off = rnd.range(-0.25, 0.25) * (fx !== 0 ? d : w);
    b.add(new BoxGeometry(fx !== 0 ? 0.06 : 0.8, 1.3, fx !== 0 ? 0.8 : 0.06), C.door, ox + along[0] * off, 0.65, oz + along[1] * off);
    if (h > 2.6) b.add(new BoxGeometry(fx !== 0 ? 0.06 : 0.38, 0.38, fx !== 0 ? 0.38 : 0.06), C.door, ox - along[0] * off * 0.6, h - 0.8, oz - along[1] * off * 0.6);
    for (let i = -1; i <= 1; i++) {
      b.add(new CylinderGeometry(0.05, 0.05, 0.4, 5), C.woodDark,
        fx * (w / 2 + 0.15) + along[0] * i * w / 3.2, h - 0.25, fz * (d / 2 + 0.15) + along[1] * i * d / 3.2,
        { rot: fx !== 0 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0] });
    }
  });
}

function palm(b: Builder, x: number, z: number, s: number) {
  let y = 0;
  const lean = rnd.range(-0.12, 0.12);
  for (let i = 0; i < 6; i++) {
    b.add(new CylinderGeometry((0.13 - i * 0.008) * s, (0.16 - i * 0.008) * s, 0.75 * s, 6), C.trunk, x + lean * i * s, y + 0.37 * s, z, { rot: [0, 0, -lean * 0.5] });
    y += 0.72 * s;
  }
  const tx = x + lean * 6 * s;
  for (let i = 0; i < 9; i++) {
    const frond = new ConeGeometry(0.22 * s, 1.9 * s, 4).translate(0, 0.95 * s, 0).scale(1, 1, 0.25);
    b.add(frond, i % 2 ? C.palm : C.palmDark, tx, y, z, { rot: [0, (i / 9) * Math.PI * 2, 1.15 + rnd.range(-0.15, 0.2)] });
  }
  b.add(new SphereGeometry(0.2 * s, 5, 4), C.date, tx, y - 0.15 * s, z);
}

const jarProfile = [[0, 0], [0.12, 0.02], [0.2, 0.15], [0.21, 0.3], [0.14, 0.48], [0.07, 0.56], [0.09, 0.62], [0, 0.62]]
  .map(([r, y]) => new Vector2(r!, y!));

/** A pile of one good, built at the origin; used for the player's shelves and the neighbours'. */
export function goodsPile(b: Builder, good: GoodId, x: number, y: number, z: number, big = false) {
  const k = big ? 1.2 : 1;
  switch (good) {
    case 'dates':
      b.add(new CylinderGeometry(0.4 * k, 0.3 * k, 0.26, 8), C.reed, x, y + 0.13, z);
      for (let i = 0; i < 12; i++) b.add(new SphereGeometry(0.085, 5, 4), C.date, x + rnd.range(-0.26, 0.26) * k, y + 0.29 + rnd.range(0, 0.1), z + rnd.range(-0.26, 0.26) * k);
      break;
    case 'cloth':
      [[C.indigo, -0.12, 0.13], [C.madder, 0.12, 0.13], [C.offWhite, 0, 0.36]].forEach(([c, dz, dy]) =>
        b.add(new CylinderGeometry(0.13, 0.13, 0.8 * k, 8), c!, x, y + dy!, z + dz!, { rot: [0, 0, Math.PI / 2] }));
      break;
    case 'spices':
      ([[-0.22, C.saffron, 0.12], [0.2, 0xb8552c, 0.12], [0, 0x8a5a2b, -0.22]] as const).forEach(([dx, c, dz]) => {
        b.add(new CylinderGeometry(0.17, 0.2, 0.42, 7), 0xd8c9a3, x + dx, y + 0.21, z + dz);
        b.add(new ConeGeometry(0.17, 0.12, 7), c, x + dx, y + 0.47, z + dz);
      });
      break;
    case 'pottery':
      b.add(new LatheGeometry(jarProfile, 8), C.clay, x - 0.18, y, z + 0.05);
      b.add(new LatheGeometry(jarProfile, 8), 0xc9784d, x + 0.2, y, z - 0.08, { scale: [0.8, 0.8, 0.8] });
      b.add(new CylinderGeometry(0.16, 0.11, 0.18, 8), C.clay, x + 0.05, y + 0.09, z + 0.28);
      break;
    case 'leather':
      [[-0.1, 0.1], [0.12, 0.1], [0, 0.3]].forEach(([dz, dy]) =>
        b.add(new BoxGeometry(0.75 * k, 0.16, 0.26), C.leather, x, y + dy!, z + dz!, { rot: [0, rnd.range(-0.2, 0.2), 0] }));
      break;
    case 'straw':
      b.add(new CylinderGeometry(0.22, 0.22, 0.5, 7), C.straw, x, y + 0.22, z, { rot: [0, 0, Math.PI / 2] });
      break;
  }
}

export const SHELF_GOODS: readonly GoodId[] = ['dates', 'cloth', 'spices', 'pottery', 'leather'];

/** Shelf x positions along the player's counter for 2, 3 or 4 shelves. */
export function shelfX(count: number, i: number): number {
  if (count <= 1) return 0;
  return -1.65 + (i * 3.3) / (count - 1);
}

export const STALL_Z = 2.4;
/** Where a customer stands to look at shelf i, across the counter from the player. */
export function customerSpot(count: number, i: number): Vector3 {
  return new Vector3(shelfX(count, i), 0, STALL_Z - 1.15);
}

export interface Bazaar {
  group: Group;
  /** [shelf count][slot][good] -> mesh, shown when that good is on that shelf. */
  piles: Map<string, Mesh>;
  lamps: MeshBasicMaterial;
  sellers: Group[];
}

export function buildBazaar(): Bazaar {
  const group = new Group();
  const b = new Builder();
  b.add(new PlaneGeometry(60, 80), C.sand, 0, 0, -14, flat);
  b.add(new PlaneGeometry(20, 22), C.paving, 0, 0.01, -5, flat);
  for (let x = -12; x <= 12; x += 3.2) {
    if (Math.abs(x) < 1.8) continue;
    house(b, x, -17.5, 3, 3, rnd.range(2.6, 3.8), rnd.pick([C.brickA, C.brickB, C.brickC]), [0, 1]);
  }
  for (let z = 4; z >= -15; z -= 3.3) {
    house(b, -11.5, z, 3, 3.1, rnd.range(2.6, 3.6), rnd.pick([C.brickA, C.brickB, C.brickC]), [1, 0]);
    house(b, 11.5, z, 3, 3.1, rnd.range(2.6, 3.6), rnd.pick([C.brickA, C.brickB, C.brickC]), [-1, 0]);
  }
  // The arch out to the alleys at the back.
  [-1.5, 1.5].forEach(x => b.add(new BoxGeometry(0.7, 4, 0.9), C.brickB, x, 2, -17.3));
  b.add(new BoxGeometry(3.7, 0.8, 1), C.brickA, 0, 4.2, -17.3);
  // The well.
  b.add(new CylinderGeometry(0.75, 0.8, 0.6, 10), C.brickC, 0, 0.3, -9.4);
  [-0.6, 0.6].forEach(x => b.add(new BoxGeometry(0.1, 1.5, 0.1), C.woodDark, x, 0.75, -9.4));
  b.add(new CylinderGeometry(0.05, 0.05, 1.3, 5), C.woodDark, 0, 1.45, -9.4, { rot: [0, 0, Math.PI / 2] });
  [[-8.5, 2], [8.6, -1.5], [-8.2, -13], [8.4, -12.8], [-4, -15], [5, -15.2]].forEach(([x, z]) => palm(b, x!, z!, rnd.range(0.9, 1.15)));

  // Neighbouring stalls, each with goods and a seller.
  const lampB = new Builder();
  const sellerSpots: Array<[number, number, number]> = [];
  const others: Array<[number, number, number]> = [[-4.4, -3.4, 1], [0.1, -3.4, 1], [4.6, -3.4, 1], [-4.4, -6.8, -1], [4.6, -6.8, -1], [-4.4, -12.4, 1], [0.1, -13.2, 1], [4.6, -12.4, 1], [-7.8, -0.5, 1], [7.8, -0.5, 1]];
  for (const [x, z, f] of others) {
    b.withTransform([x, 0, z], f < 0 ? Math.PI : 0, () => {
      b.add(new BoxGeometry(2.6, 0.85, 0.9), C.wood, 0, 0.42, 0);
      b.add(new BoxGeometry(2.7, 0.06, 1.0), C.woodDark, 0, 0.88, 0);
      for (const [px, pz] of [[-1.25, -0.45], [1.25, -0.45], [-1.25, 0.45], [1.25, 0.45]] as const) {
        b.add(new CylinderGeometry(0.05, 0.06, pz < 0 ? 2.5 : 2.2, 5), C.woodDark, px, pz < 0 ? 1.25 : 1.1, pz);
      }
      b.add(new BoxGeometry(3, 0.05, 1.5), rnd.pick(C.canopies), 0, 2.35, 0, { rot: [-0.14, 0, 0] });
      const kinds = (['dates', 'cloth', 'spices', 'pottery'] as GoodId[]).sort(() => rnd.range(-1, 1)).slice(0, 3);
      kinds.forEach((k, i) => goodsPile(b, k, -0.8 + i * 0.8, 0.9, 0.05));
    });
    lampB.add(new SphereGeometry(0.09, 6, 4), C.lamp, x + 1.25, 2.0, z + 0.45 * f);
    sellerSpots.push([x + rnd.range(-0.6, 0.6), z - 0.85 * f, f < 0 ? Math.PI : 0]);
  }

  // The player's stall.
  b.withTransform([0, 0, STALL_Z], 0, () => {
    b.add(new BoxGeometry(4.6, 0.9, 1.1), C.wood, 0, 0.45, 0);
    b.add(new BoxGeometry(4.8, 0.08, 1.25), C.woodDark, 0, 0.94, 0);
    b.add(new BoxGeometry(4.4, 0.02, 0.95), C.reed, 0, 0.99, 0);
    for (const x of [-2.3, 2.3]) {
      b.add(new CylinderGeometry(0.07, 0.08, 3.1, 6), C.woodDark, x, 1.55, -0.55);
      b.add(new CylinderGeometry(0.07, 0.08, 1.6, 6), C.woodDark, x, 0.8, 0.55);
    }
    b.add(new BoxGeometry(4.8, 0.1, 0.1), C.woodDark, 0, 3.1, -0.55);
  });
  lampB.add(new SphereGeometry(0.1, 6, 4), C.lamp, -2.3, 2.6, STALL_Z - 0.5);
  lampB.add(new SphereGeometry(0.1, 6, 4), C.lamp, 2.3, 2.6, STALL_Z - 0.5);
  group.add(b.mesh());

  // The striped valance is the one textured mesh.
  const stripe = document.createElement('canvas');
  stripe.width = 256; stripe.height = 32;
  const sctx = stripe.getContext('2d')!;
  for (let i = 0; i < 16; i++) { sctx.fillStyle = i % 2 ? '#a8432f' : '#ece3d0'; sctx.fillRect(i * 16, 0, 16, 32); }
  sctx.fillStyle = '#3d4f7c'; sctx.fillRect(0, 26, 256, 6);
  const valance = new Mesh(new PlaneGeometry(4.8, 0.45), new MeshLambertMaterial({ map: new CanvasTexture(stripe), side: DoubleSide }));
  valance.position.set(0, 2.88, STALL_Z - 0.6);
  group.add(valance);

  const lampMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 });
  const lamps = new Mesh(lampB.geometry(), lampMat);
  group.add(lamps);

  // Shelf piles: one small mesh per (shelf count, slot, good), toggled on and off.
  const piles = new Map<string, Mesh>();
  for (const count of [2, 3, 4]) {
    for (let i = 0; i < count; i++) {
      for (const good of SHELF_GOODS) {
        const pb = new Builder();
        goodsPile(pb, good, 0, 0, 0, count < 4);
        const m = pb.mesh();
        m.position.set(shelfX(count, i), 1.0, STALL_Z);
        m.visible = false;
        group.add(m);
        piles.set(`${count}:${i}:${good}`, m);
      }
    }
  }

  const sellers = sellerSpots.map(([x, z, ry]) => { const g = new Group(); g.position.set(x, 0, z); g.rotation.y = ry; group.add(g); return g; });
  return { group, piles, lamps: lampMat, sellers };
}

// ---------- alleys ----------

export type PlaceId = 'market' | 'gate' | 'bayt';
export const NODES: Record<PlaceId | 'junction', Vector3> = {
  market: new Vector3(0, 0, 4),
  junction: new Vector3(0, 0, -9),
  gate: new Vector3(0, 0, -23),
  bayt: new Vector3(-11, 0, -9),
};
const EDGES: Record<string, string[]> = { market: ['junction'], junction: ['market', 'gate', 'bayt'], gate: ['junction'], bayt: ['junction'] };

export function route(from: string, to: string): string[] {
  const prev: Record<string, string | null> = { [from]: null };
  const q = [from];
  while (q.length) {
    const n = q.shift()!;
    if (n === to) break;
    for (const m of EDGES[n] ?? []) if (!(m in prev)) { prev[m] = n; q.push(m); }
  }
  const out: string[] = [];
  let n: string | null | undefined = to;
  while (n && n !== from) { out.unshift(n); n = prev[n]; }
  return out;
}

export function buildAlley(): Group {
  const group = new Group();
  const b = new Builder();
  b.add(new PlaneGeometry(60, 70), C.sandDark, 0, 0, -10, flat);
  b.add(new PlaneGeometry(2.6, 34), C.sand, 0, 0.01, -9, flat);
  b.add(new PlaneGeometry(13, 2.6), C.sand, -6.5, 0.012, -9, flat);
  const brick = [C.brickA, C.brickB, C.brickC];
  for (let z = 6.5; z > -25; z -= 2.9) {
    const zz = z - 1.4;
    if (!(zz < -7.2 && zz > -10.8)) house(b, -3.1, zz, 2.4, 2.8, rnd.range(2.8, 4.2), rnd.pick(brick), [1, 0]);
    house(b, 3.1, zz, 2.4, 2.8, rnd.range(2.8, 4.2), rnd.pick(brick), [-1, 0]);
  }
  for (let x = -2.9; x > -14; x -= 2.9) {
    house(b, x - 1.4, -6.2, 2.8, 2.4, rnd.range(2.8, 4), rnd.pick(brick), [0, -1]);
    house(b, x - 1.4, -11.8, 2.8, 2.4, rnd.range(2.8, 4), rnd.pick(brick), [0, 1]);
  }
  for (const z of [-4.5, -15.5, -19.5]) b.add(new BoxGeometry(2.6, 0.03, 0.9), rnd.pick(C.canopies), 0, rnd.range(3.1, 3.4), z, { rot: [0, 0, rnd.range(-0.08, 0.08)] });
  // City gate, with al-Mirbad and palms beyond it.
  [-1.9, 1.9].forEach(x => b.add(new BoxGeometry(1.4, 5.2, 1.6), C.brickB, x, 2.6, -25));
  b.add(new BoxGeometry(5.2, 1, 1.6), C.brickA, 0, 4.9, -25);
  for (let i = 0; i < 8; i++) palm(b, rnd.range(-9, 9), rnd.range(-34, -29), rnd.range(0.9, 1.2));
  // Bayt al-mal: plain mud brick, a heavy door. Not a mosque (style guide 2.4).
  b.add(new BoxGeometry(3, 4.4, 5), C.brickC, -14.6, 2.2, -9);
  b.add(new BoxGeometry(3.2, 0.3, 5.2), C.brickB, -14.6, 4.5, -9);
  b.add(new BoxGeometry(0.08, 2, 1.4), C.woodDark, -13.07, 1, -9);
  group.add(b.mesh());
  return group;
}
