// Builds low-poly scenery as one merged mesh per scene, coloured per vertex, so a whole
// town is a handful of draw calls instead of hundreds (the prototype drew about 840 a frame).

import {
  BufferAttribute, BufferGeometry, Color, Euler, Matrix4, Mesh, MeshLambertMaterial, Quaternion, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** One flat-shaded material for every merged mesh in the game (style guide 4.1). */
export const worldMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

export interface PartOptions {
  rot?: [number, number, number];
  scale?: [number, number, number];
}

export class Builder {
  private parts: BufferGeometry[] = [];
  private readonly origin = new Matrix4();

  /** Everything added is moved by this transform, for building a group in local space. */
  withTransform(pos: [number, number, number], rotY: number, f: () => void) {
    const prev = this.origin.clone();
    const m = new Matrix4().compose(new Vector3(...pos), new Quaternion().setFromEuler(new Euler(0, rotY, 0)), new Vector3(1, 1, 1));
    this.origin.multiply(m);
    f();
    this.origin.copy(prev);
  }

  add(geo: BufferGeometry, color: number, x = 0, y = 0, z = 0, o: PartOptions = {}): this {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    const m = new Matrix4().compose(
      new Vector3(x, y, z),
      new Quaternion().setFromEuler(new Euler(...(o.rot ?? [0, 0, 0]))),
      new Vector3(...(o.scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(new Matrix4().multiplyMatrices(this.origin, m));
    const c = new Color(color);
    const n = g.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b; }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    this.parts.push(g);
    geo.dispose();
    return this;
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  geometry(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    if (!merged) throw new Error('nothing to merge');
    merged.computeVertexNormals();
    return merged;
  }

  mesh(): Mesh {
    return new Mesh(this.geometry(), worldMaterial);
  }
}

/** Small seeded random for scenery, so the town looks the same every time it is built. */
export function sceneryRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    range: (lo: number, hi: number) => lo + next() * (hi - lo),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!,
  };
}
