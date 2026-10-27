// Faceless figures built from primitives (style guide 4.2), merged into one mesh each and
// cached by look, so a crowd costs one draw call per person and no new GPU memory per visit.

import {
  BufferGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, TorusGeometry,
} from 'three';
import { Builder, worldMaterial } from './build';
import { C } from './palette';

export type Prop = 'none' | 'basket' | 'jar' | 'sack' | 'bundle' | 'staff' | 'rope' | 'scroll';

export interface Look {
  robe: number;
  cloth: number;
  skin: number;
  /** 1 for adults; children are about 0.7 (style guide 4.2). */
  height: number;
  /** Turban ring instead of a drape to the shoulders. Women always have the drape. */
  turban: boolean;
  prop: Prop;
}

const cache = new Map<string, BufferGeometry>();

function key(l: Look) {
  return `${l.robe}-${l.cloth}-${l.skin}-${l.turban}-${l.prop}`;
}

function geometryFor(l: Look): BufferGeometry {
  const k = key(l);
  const hit = cache.get(k);
  if (hit) return hit;
  const b = new Builder();
  b.add(new CylinderGeometry(0.2, 0.36, 1.15, 7), l.robe, 0, 0.58, 0);
  b.add(new CylinderGeometry(0.212, 0.212, 0.08, 7), C.woodDark, 0, 0.82, 0);
  b.add(new SphereGeometry(0.19, 7, 5), l.skin, 0, 1.32, 0);
  b.add(new SphereGeometry(0.215, 7, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), l.cloth, 0, 1.335, 0, { rot: [-0.25, 0, 0] });
  if (l.turban) b.add(new TorusGeometry(0.18, 0.06, 5, 9), l.cloth, 0, 1.4, 0, { rot: [Math.PI / 2, 0, 0] });
  else b.add(new ConeGeometry(0.26, 0.5, 7), l.cloth, 0, 1.12, -0.07);
  switch (l.prop) {
    case 'basket':
      b.add(new CylinderGeometry(0.2, 0.15, 0.16, 7), C.reed, 0, 0.75, 0.3);
      b.add(new SphereGeometry(0.12, 5, 4), C.date, 0, 0.84, 0.3, { scale: [1.3, 0.5, 1.3] });
      break;
    case 'jar':
      b.add(new SphereGeometry(0.17, 7, 5), C.clay, 0, 0.82, 0.3, { scale: [1, 1.2, 1] });
      break;
    case 'sack':
      b.add(new SphereGeometry(0.25, 6, 5), C.straw, 0, 1.05, -0.28, { scale: [1, 1.2, 0.8] });
      break;
    case 'bundle':
      b.add(new CylinderGeometry(0.08, 0.08, 0.6, 6), C.leather, 0, 0.8, 0.3, { rot: [0, 0, Math.PI / 2] });
      break;
    case 'staff':
      b.add(new CylinderGeometry(0.03, 0.03, 1.7, 5), C.woodDark, 0.3, 0.85, 0.12);
      break;
    case 'rope':
      b.add(new TorusGeometry(0.16, 0.05, 5, 9), C.straw, 0.28, 0.75, 0.05, { rot: [0, Math.PI / 2, 0] });
      break;
    case 'scroll':
      b.add(new CylinderGeometry(0.05, 0.05, 0.32, 6), C.offWhite, 0, 0.82, 0.3, { rot: [0, 0, Math.PI / 2] });
      break;
    case 'none':
      break;
  }
  const g = b.geometry();
  cache.set(k, g);
  return g;
}

const blobGeo = new CircleGeometry(0.42, 12).rotateX(-Math.PI / 2);
const blobMat = new MeshBasicMaterial({ color: 0x2e2015, transparent: true, opacity: 0.2, depthWrite: false });

/** A figure: its body mesh plus a soft blob shadow on the ground (style guide 4.4). */
export class Figure {
  readonly group = new Group();
  readonly body: Mesh;
  private bobPhase = Math.random() * 6;

  constructor(look: Look) {
    this.body = new Mesh(geometryFor(look), worldMaterial);
    this.body.scale.setScalar(look.height);
    const blob = new Mesh(blobGeo, blobMat);
    blob.position.y = 0.01;
    blob.scale.setScalar(look.height);
    blob.renderOrder = -1;
    this.group.add(blob, this.body);
  }

  /** Walking bob; off with reduced motion. */
  bob(dt: number, walking: boolean, reduceMotion: boolean) {
    if (!walking || reduceMotion) { this.body.position.y = 0; return; }
    this.bobPhase += dt * 9;
    this.body.position.y = Math.abs(Math.sin(this.bobPhase)) * 0.06;
  }

  get height(): number {
    return this.body.scale.y;
  }
}

export function randomLook(pick: <T>(xs: readonly T[]) => T, prop: Prop = 'none', height = 1): Look {
  return { robe: pick(C.robes), cloth: pick(C.robes), skin: pick(C.skins), height, turban: pick([true, false]), prop };
}
