// The 3D world: one renderer, the bazaar and alley scenes, the crowd, customers and the light
// that moves from morning to night (style guide 4.4, 4.5).

import {
  Color, CylinderGeometry, DirectionalLight, Fog, Group, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from 'three';
import type { Customer, CustomerType, DaySim, GoodId, NodeKind } from '../sim';
import { DAY_SECONDS } from '../sim';
import { Figure, randomLook, type Look, type Prop } from './figures';
import { C } from './palette';
import { NODES, buildAlley, buildBazaar, customerSpot, goodsPile, route, shelfX, STALL_Z, type Bazaar, type PlaceId } from './scenes';
import { Builder, sceneryRandom } from './build';
import { LANE_X, MARKER_SCALE, STEP_Z, buildDesert, camelMesh, stopMarker, townMarker } from './desert';

export type CameraMode = 'bazaar' | 'alley' | 'orbit' | 'desert';

export interface RouteStop {
  kind: NodeKind;
  hidden: boolean;
}

const rnd = sceneryRandom(7);

/** Light keyframes over the shop day, in seconds, and for night (style guide 4.4). */
const LIGHT_KEYS = [
  { t: 0, sun: 0xffe7b8, sunI: 1.0, hemi: 0.55, sky: 0xe3d2ad },
  { t: 17, sun: 0xfff6e6, sunI: 1.15, hemi: 0.65, sky: 0xe8cd9c },
  { t: 28, sun: 0xffd08a, sunI: 1.0, hemi: 0.55, sky: 0xe6c08a },
  { t: 40, sun: 0xff9a5c, sunI: 0.8, hemi: 0.42, sky: 0xd99a6c },
  { t: 45, sun: 0xd9786a, sunI: 0.55, hemi: 0.35, sky: 0x9a6a68 },
  { t: 52, sun: 0x5a6a9a, sunI: 0.2, hemi: 0.28, sky: 0x3a4566 },
];

const PROPS: Record<CustomerType, Prop> = {
  household: 'basket', child: 'basket', labourer: 'sack', craftsman: 'bundle', scholar: 'scroll',
  bedouin: 'jar', sailor: 'rope', regular: 'basket',
};

interface CustomerView {
  fig: Figure;
  from: Vector3;
  to: Vector3;
}

export class World {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(44, 9 / 16, 0.1, 120);
  readonly reduceMotion: boolean;
  private readonly hemi = new HemisphereLight(0xfff1d6, 0x8a6a45, 0.6);
  private readonly sun = new DirectionalLight(0xffe2b0, 0.9);
  private readonly bazaar: Bazaar;
  private readonly alley: Group;
  private mode: CameraMode = 'bazaar';
  private readonly crowd: Array<{ fig: Figure; gx: number; gz: number; to: Vector3 | null; wait: number; speed: number }> = [];
  private readonly customerViews = new Map<number, CustomerView>();
  private readonly figurePool = new Map<string, Figure[]>();
  private readonly you: Figure;
  private readonly walker: Figure;
  private readonly alleyNPCs: Figure[] = [];
  private walkPath: string[] = [];
  walkAt: PlaceId | 'junction' = 'market';
  arrived: PlaceId | null = 'market';
  private readonly heading = new Vector3(0, 0, -1);
  private readonly camPos = new Vector3();
  private readonly camLook = new Vector3();
  private orbitT = 0;
  private shelfCount = 3;
  private readonly desert: Group;
  private readonly route = new Group();
  private routeKey = '';
  private readonly caravan = new Group();
  private readonly caravanTarget = new Vector3();
  private camelCount = -1;
  private readonly stallCamels = new Group();
  private stopPos: Vector3[][] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.scene.background = new Color(C.sky);
    this.scene.fog = new Fog(C.sky, 26, 60);
    this.sun.position.set(-8, 14, 6);
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.bazaar = buildBazaar();
    this.scene.add(this.bazaar.group);
    for (const s of this.bazaar.sellers) s.add(new Figure(randomLook(rnd.pick, 'none', rnd.range(0.92, 1.03))).group);
    this.alley = buildAlley();
    this.alley.visible = false;
    this.scene.add(this.alley);
    this.desert = buildDesert();
    this.desert.add(this.route, this.caravan);
    this.desert.visible = false;
    this.scene.add(this.desert);
    this.bazaar.group.add(this.stallCamels);

    const GX = [-6.3, -2.2, 2.3, 6.3];
    for (let i = 0; i < 11; i++) {
      const fig = new Figure(randomLook(rnd.pick, rnd.pick(['none', 'none', 'basket', 'jar', 'sack'] as const), rnd.range(0.86, 1.04)));
      const gx = Math.floor(rnd.range(0, 4)), gz = Math.floor(rnd.range(0, 3));
      fig.group.position.set(GX[gx]!, 0, [-1.1, -5.1, -9.6][gz]!);
      this.bazaar.group.add(fig.group);
      this.crowd.push({ fig, gx, gz, to: null, wait: rnd.range(0, 3), speed: rnd.range(1.1, 1.7) });
    }
    const merchant: Look = { robe: 0x8a6a45, cloth: C.offWhite, skin: C.skins[0], height: 1.05, turban: true, prop: 'none' };
    this.you = new Figure(merchant);
    this.you.group.position.set(1.0, 0, STALL_Z + 1.7);
    this.you.group.rotation.y = Math.PI;
    this.bazaar.group.add(this.you.group);
    this.walker = new Figure(merchant);
    this.walker.group.position.copy(NODES.market);
    this.alley.add(this.walker.group);
    for (const [x, z] of [[0.6, -3], [-0.7, -15], [-6, -9.4], [0.5, -19]] as const) {
      const n = new Figure(randomLook(rnd.pick, 'none', rnd.range(0.9, 1.02)));
      n.group.position.set(x, 0, z);
      n.group.rotation.y = rnd.range(0, 6);
      this.alleyNPCs.push(n);
      this.alley.add(n.group);
    }
    this.setMode('bazaar');
    this.setDayTime(17);
  }

  resize(width: number, height: number, dpr: number) {
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  setMode(mode: CameraMode) {
    this.mode = mode;
    const inAlley = mode === 'alley', inDesert = mode === 'desert';
    this.alley.visible = inAlley;
    this.desert.visible = inDesert;
    this.bazaar.group.visible = !inAlley && !inDesert;
    const fog = this.scene.fog as Fog;
    if (inDesert) {
      fog.near = 22; fog.far = 70;
      this.followCaravan(1);
    } else if (inAlley) {
      fog.near = 14; fog.far = 40;
      const p = this.walker.group.position;
      this.camPos.set(p.x - this.heading.x * 3.4, 7.6, p.z - this.heading.z * 3.4);
      this.camLook.set(p.x, 0.6, p.z);
    } else {
      fog.near = 26; fog.far = 60;
      this.camera.position.set(0, 7.4, 11.8);
      this.camera.lookAt(0, 0.3, -1.2);
      this.sun.target.position.set(0, 0, 0);
      this.sun.position.set(-8, 14, 6);
    }
  }

  /** Seconds into the shop day; past 45 is dusk turning to night. */
  setDayTime(t: number) {
    const keys = LIGHT_KEYS;
    let i = 0;
    while (i < keys.length - 2 && t > keys[i + 1]!.t) i++;
    const a = keys[i]!, b = keys[i + 1]!;
    const k = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    const sun = new Color(a.sun).lerp(new Color(b.sun), k);
    this.sun.color.copy(sun);
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * k;
    this.hemi.intensity = a.hemi + (b.hemi - a.hemi) * k;
    const sky = new Color(a.sky).lerp(new Color(b.sky), k);
    (this.scene.background as Color).copy(sky);
    (this.scene.fog as Fog).color.copy(sky);
    // Sun swings from east to west over the day.
    const ang = (Math.min(t, DAY_SECONDS) / DAY_SECONDS) * Math.PI;
    this.sun.position.set(-14 * Math.cos(ang), 6 + 10 * Math.sin(ang), 6);
    this.bazaar.lamps.opacity = Math.max(0, Math.min(1, (t - 34) / 8));
  }

  /** Shows what is on each slot of the player's stall. Piles are built the first time they are needed. */
  setShelves(goods: ReadonlyArray<GoodId | null>) {
    this.shelfCount = goods.length;
    goods.forEach((g, i) => {
      if (!g) return;
      const key = `${goods.length}:${i}:${g}`;
      if (this.bazaar.piles.has(key)) return;
      const pb = new Builder();
      goodsPile(pb, g, 0, 0, 0, goods.length <= 4);
      const m = pb.mesh();
      m.position.set(shelfX(goods.length, i), 1.0, STALL_Z);
      this.bazaar.group.add(m);
      this.bazaar.piles.set(key, m);
    });
    for (const [key, m] of this.bazaar.piles) {
      const [count, slot, good] = key.split(':');
      m.visible = Number(count) === goods.length && goods[Number(slot)] === good;
    }
    // The player stands behind the counter, a little to one side.
    this.you.group.position.x = 0.4;
    this.you.group.position.z = STALL_Z + 1.5;
  }

  /** Camels you own wait behind the stall. */
  setStallCamels(n: number) {
    if (n === this.camelCount) return;
    this.camelCount = n;
    this.stallCamels.clear();
    for (let i = 0; i < n; i++) {
      const c = camelMesh(false);
      c.position.set(3.6 + i * 1.3, 0, STALL_Z + 1.4 + (i % 2) * 0.6);
      c.rotation.y = -0.4;
      this.stallCamels.add(c);
    }
  }

  // ---------- customers ----------

  private takeFigure(type: CustomerType): Figure {
    const pool = this.figurePool.get(type) ?? [];
    const f = pool.pop();
    if (f) { f.group.visible = true; return f; }
    const child = type === 'child';
    const fig = new Figure(randomLook(rnd.pick, PROPS[type], child ? 0.72 : rnd.range(0.9, 1.05)));
    this.bazaar.group.add(fig.group);
    return fig;
  }

  private releaseFigure(type: CustomerType, f: Figure) {
    f.group.visible = false;
    const pool = this.figurePool.get(type) ?? [];
    pool.push(f);
    this.figurePool.set(type, pool);
  }

  clearCustomers() {
    for (const [, v] of this.customerViews) v.fig.group.visible = false;
    this.customerViews.clear();
  }

  /** Places each customer from the day's state; figures are pooled, never rebuilt. */
  syncCustomers(day: DaySim | null, dt: number) {
    const live = new Set<number>();
    for (const c of day?.customers ?? []) {
      if (c.state === 'waiting' || c.state === 'gone') continue;
      live.add(c.id);
      let v = this.customerViews.get(c.id);
      if (!v) {
        const fig = this.takeFigure(c.type);
        const side = c.id % 2 ? -6.3 : 6.3;
        const from = new Vector3(side, 0, -1.1 + ((c.id * 37) % 7) / 10 - 0.3);
        const to = c.shelf === null ? new Vector3(-side, 0, -1.1) : customerSpot(this.shelfCount, c.shelf);
        v = { fig, from, to };
        this.customerViews.set(c.id, v);
      }
      this.placeCustomer(c, v, dt);
    }
    for (const [id, v] of this.customerViews) {
      if (!live.has(id)) {
        const type = day?.customers.find(c => c.id === id)?.type ?? 'regular';
        this.releaseFigure(type, v.fig);
        this.customerViews.delete(id);
      }
    }
  }

  private placeCustomer(c: Customer, v: CustomerView, dt: number) {
    const g = v.fig.group;
    const walkIn = 2.4, walkOut = 2.2;
    if (c.state === 'in') {
      const k = Math.min(1, c.t / walkIn);
      g.position.lerpVectors(v.from, v.to, k);
      g.rotation.y = Math.atan2(v.to.x - v.from.x, v.to.z - v.from.z);
      v.fig.bob(dt, true, this.reduceMotion);
    } else if (c.state === 'look') {
      g.position.copy(v.to);
      g.rotation.y = 0;
      v.fig.bob(dt, false, this.reduceMotion);
    } else if (c.state === 'out') {
      const k = Math.min(1, c.t / walkOut);
      const exit = new Vector3(v.from.x, 0, -1.1);
      g.position.lerpVectors(v.to, exit, k);
      g.rotation.y = Math.atan2(exit.x - v.to.x, exit.z - v.to.z);
      v.fig.bob(dt, true, this.reduceMotion);
    }
  }

  /** Screen position (360 x 640 logical frame) of a point above a customer's head, or null. */
  customerHead(id: number): [number, number] | null {
    const v = this.customerViews.get(id);
    if (!v || !v.fig.group.visible) return null;
    const p = v.fig.group.position;
    return this.toScreen(p.x, 1.9 * v.fig.height, p.z);
  }

  shelfScreen(i: number): [number, number] {
    return this.toScreen(shelfX(this.shelfCount, i), 1.6, STALL_Z);
  }

  toScreen(x: number, y: number, z: number): [number, number] {
    const v = new Vector3(x, y, z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * 360, (-v.y * 0.5 + 0.5) * 640];
  }

  // ---------- alleys ----------

  /** Starts walking to a place along the lane graph. */
  walkTo(place: PlaceId) {
    if (this.walkPath.length || place === this.arrived) return;
    this.walkPath = route(this.walkAt, place);
    this.arrived = null;
  }

  get walking(): boolean {
    return this.walkPath.length > 0;
  }

  /** Puts the walker at a place without walking, e.g. entering the alleys from the bazaar. */
  placeWalker(place: PlaceId) {
    this.walkPath = [];
    this.walkAt = place;
    this.arrived = place;
    this.walker.group.position.copy(NODES[place]);
    this.heading.set(0, 0, place === 'market' ? -1 : 1);
    if (place === 'bayt') this.heading.set(1, 0, 0);
    this.setMode('alley');
  }

  placeScreen(place: PlaceId): [number, number, number] {
    const n = NODES[place];
    const v = new Vector3(n.x, 2.6, n.z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * 360, (-v.y * 0.5 + 0.5) * 640, v.z];
  }

  // ---------- the expedition map ----------

  /** Builds the leg's route: where you start, two stops per step, and where you are going. */
  showRoute(layers: ReadonlyArray<ReadonlyArray<RouteStop>>, picked: readonly number[], fromHome: boolean, camels: number) {
    const key = `${fromHome}|${layers.map(l => l.map(n => `${n.kind}${n.hidden ? '?' : ''}`).join(',')).join(';')}|${picked.join(',')}|${camels}`;
    if (key === this.routeKey) return;
    const fresh = !this.routeKey.startsWith(`${fromHome}|${layers.map(l => l.map(n => `${n.kind}${n.hidden ? '?' : ''}`).join(',')).join(';')}|`);
    this.routeKey = key;
    this.route.clear();
    const start = townMarker(fromHome);
    start.position.set(0, 0, 3.2);
    start.rotation.y = Math.PI;
    const endZ = -(layers.length + 1) * STEP_Z;
    const end = townMarker(!fromHome);
    end.position.set(0, 0, endZ - 2.2);
    this.route.add(start, end);
    this.stopPos = layers.map((l, i) => l.map((_, j) => new Vector3((j - (l.length - 1) / 2) * LANE_X, 0, -(i + 1) * STEP_Z)));
    layers.forEach((l, i) => l.forEach((n, j) => {
      const m = stopMarker(n.hidden ? 'hidden' : n.kind);
      m.position.copy(this.stopPos[i]![j]!);
      m.scale.setScalar(MARKER_SCALE);
      m.rotation.y = rnd.range(-0.3, 0.3);
      this.route.add(m);
    }));
    // Dotted tracks: the way you came is solid, the ways ahead are faint.
    const b = new Builder();
    const dots = (a: Vector3, z: Vector3, strong: boolean) => {
      const n = Math.max(3, Math.round(a.distanceTo(z) / 0.7));
      for (let k = 1; k < n; k++) {
        const p = a.clone().lerp(z, k / n);
        b.add(new CylinderGeometry(strong ? 0.13 : 0.08, strong ? 0.13 : 0.08, 0.04, 6), strong ? C.woodDark : C.sandDark, p.x, 0.03, p.z);
      }
    };
    const origin = new Vector3(0, 0, 1.2);
    let from = [origin];
    let came = origin;
    layers.forEach((_, i) => {
      const row = this.stopPos[i]!;
      const pick = picked[i];
      for (const f of from) for (let j = 0; j < row.length; j++) {
        const strong = f === came && pick === j;
        if (pick !== undefined && !strong) continue;
        dots(f, row[j]!, strong);
      }
      if (pick !== undefined) { came = row[pick]!; from = [came]; } else from = [...row];
    });
    const goal = new Vector3(0, 0, endZ);
    for (const f of from) dots(f, goal, false);
    if (!b.empty) this.route.add(b.mesh());
    // The caravan: you and your camels.
    this.caravan.clear();
    const walker = new Figure({ robe: 0x8a6a45, cloth: C.offWhite, skin: C.skins[0], height: 1, turban: true, prop: 'staff' });
    // The caravan group walks towards its local -z; figures and camels are modelled facing +z.
    walker.group.position.set(0.35, 0, -1.1);
    walker.group.rotation.y = Math.PI;
    this.caravan.add(walker.group);
    for (let i = 0; i <= camels; i++) {
      const c = camelMesh(true);
      c.position.set(-0.15 + (i % 2) * 0.3, 0, 0.2 + i * 1.5);
      c.rotation.y = Math.PI;
      c.scale.setScalar(0.8);
      this.caravan.add(c);
    }
    const at = picked.length ? this.stopPos[picked.length - 1]![picked[picked.length - 1]!]! : origin;
    this.caravanTarget.copy(at);
    if (fresh) { this.caravan.position.copy(at); this.followCaravan(1); }
  }

  /** Sends the caravan towards a stop, or to the end of the route. */
  caravanTo(layer: number, i: number | 'end') {
    if (i === 'end') this.caravanTarget.set(0, 0, -(this.stopPos.length + 1) * STEP_Z + 0.5);
    else { const p = this.stopPos[layer]?.[i]; if (p) this.caravanTarget.copy(p); }
  }

  get caravanMoving(): boolean {
    return this.caravan.position.distanceTo(this.caravanTarget) > 0.05;
  }

  stopScreen(layer: number, i: number): [number, number, number] {
    const p = this.stopPos[layer]?.[i];
    if (!p) return [-100, -100, 1];
    const v = new Vector3(p.x, 1.4, p.z).project(this.camera);
    return [(v.x * 0.5 + 0.5) * 360, (-v.y * 0.5 + 0.5) * 640, v.z];
  }

  private followCaravan(k: number) {
    const p = this.caravan.position;
    this.camPos.lerp(new Vector3(p.x * 0.3, 10.5, p.z + 8.5), k);
    this.camLook.lerp(new Vector3(p.x * 0.2, 0, p.z - 7), k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.position.set(p.x - 8, 14, p.z + 6);
  }

  private updateDesert(dt: number) {
    const p = this.caravan.position, t = this.caravanTarget;
    const d = p.distanceTo(t), step = (this.reduceMotion ? 40 : 4) * dt;
    const walking = d > 0.05;
    if (walking) {
      if (d <= step) p.copy(t);
      else {
        const dir = t.clone().sub(p).normalize();
        p.addScaledVector(dir, step);
        this.caravan.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
      }
    }
    for (const c of this.caravan.children) c.position.y = walking && !this.reduceMotion ? Math.abs(Math.sin(performance.now() / 160 + c.position.z)) * 0.05 : 0;
    this.followCaravan(this.reduceMotion ? 1 : 1 - Math.pow(0.05, dt));
  }

  // ---------- frame ----------

  update(dt: number) {
    if (this.mode === 'alley') this.updateAlley(dt);
    else if (this.mode === 'desert') this.updateDesert(dt);
    else this.updateCrowd(dt);
    if (this.mode === 'orbit') {
      this.orbitT += this.reduceMotion ? 0 : dt * 0.05;
      const r = 13;
      this.camera.position.set(Math.sin(this.orbitT) * r * 0.6, 6.5, 6 + Math.cos(this.orbitT) * r * 0.4);
      this.camera.lookAt(0, 0.8, -4);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private updateCrowd(dt: number) {
    const GX = [-6.3, -2.2, 2.3, 6.3], GZ = [-1.1, -5.1, -9.6];
    for (const p of this.crowd) {
      const o = p.fig.group.position;
      if (!p.to) {
        p.wait -= dt;
        p.fig.bob(dt, false, this.reduceMotion);
        if (p.wait > 0) continue;
        const opts: Array<[number, number]> = [];
        if (p.gx > 0) opts.push([p.gx - 1, p.gz]);
        if (p.gx < 3) opts.push([p.gx + 1, p.gz]);
        if (p.gz > 0) opts.push([p.gx, p.gz - 1]);
        if (p.gz < 2) opts.push([p.gx, p.gz + 1]);
        const [nx, nz] = rnd.pick(opts);
        p.gx = nx; p.gz = nz;
        p.to = new Vector3(GX[nx]! + rnd.range(-0.5, 0.5), 0, GZ[nz]! + rnd.range(-0.35, 0.35));
      }
      const dx = p.to.x - o.x, dz = p.to.z - o.z, d = Math.hypot(dx, dz), step = p.speed * dt;
      if (d <= step) { o.x = p.to.x; o.z = p.to.z; p.to = null; p.wait = rnd.range(0.8, 3.5); continue; }
      o.x += (dx / d) * step; o.z += (dz / d) * step;
      p.fig.group.rotation.y = Math.atan2(dx, dz);
      p.fig.bob(dt, true, this.reduceMotion);
    }
  }

  private updateAlley(dt: number) {
    const p = this.walker.group.position;
    const next = this.walkPath[0];
    if (next) {
      const target = NODES[next as PlaceId];
      const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz), step = 3.2 * dt;
      if (d <= step) {
        p.x = target.x; p.z = target.z;
        this.walkAt = this.walkPath.shift() as PlaceId;
        if (!this.walkPath.length) this.arrived = this.walkAt as PlaceId;
      } else {
        p.x += (dx / d) * step; p.z += (dz / d) * step;
        this.heading.set(dx / d, 0, dz / d);
        this.walker.group.rotation.y = Math.atan2(dx, dz);
      }
      this.walker.bob(dt, true, this.reduceMotion);
    } else {
      this.walker.bob(dt, false, this.reduceMotion);
    }
    const want = new Vector3(p.x - this.heading.x * 3.4, 7.6, p.z - this.heading.z * 3.4);
    const k = this.reduceMotion ? 1 : 1 - Math.pow(0.02, dt);
    this.camPos.lerp(want, k);
    this.camLook.lerp(new Vector3(p.x + this.heading.x * 0.4, 0.6, p.z + this.heading.z * 0.4), k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.position.set(p.x - 8, 14, p.z + 6);
  }

  setOrbit() {
    this.setMode('orbit');
  }
}
