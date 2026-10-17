// The game worlds. Each builder returns a World with a setState() that the
// trailers and the demo call, plus anchors and actors the HUD can point at.
import { THREE, Grid, World, Tiles, Particles, water, kid, box, group, glow, mat, hash, noise, fbm, mixHex, clamp, lerp, smooth, easeInOut, easeOut, rand } from './engine.js?v=20261017b';

/* ---------- terrain kit ---------- */
class Land {
  constructor(W, H, D, base) {
    this.g = new Grid(W, H, D); this.W = W; this.H = H; this.D = D; this.base = base;
    this.o = [-W / 2, -(base + 1), -D / 2];
    this.hm = new Int16Array(W * D).fill(-999);
    this.minY = H;
  }
  h(x, z) { return this.hm[(x | 0) + this.W * (z | 0)]; }
  wx(x) { return x + .5 + this.o[0]; }
  wz(z) { return z + .5 + this.o[2]; }
  wy(y) { return y + this.o[1]; }
  top(x, z) { return this.wy(this.h(x, z) + 1); }
  at(x, z, dy = 0) { return new THREE.Vector3(this.wx(x), this.top(x, z) + dy, this.wz(z)); }
  // smooth ground height at a fractional grid position (for vehicles)
  ys(x, z) {
    const x0 = Math.floor(x - .5), z0 = Math.floor(z - .5), fx = x - .5 - x0, fz = z - .5 - z0;
    const hh = (a, b) => { const v = this.h(clamp(a, 0, this.W - 1), clamp(b, 0, this.D - 1)); return v < -900 ? this.base : v; };
    const a = hh(x0, z0), b = hh(x0 + 1, z0), c = hh(x0, z0 + 1), d = hh(x0 + 1, z0 + 1);
    return this.wy(lerp(lerp(a, b, fx), lerp(c, d, fx), fz) + 1);
  }
  island({ cx, cz, rx, rz, seed = 1, height, surface, depth = 9, wobble = .3 }) {
    this.cx = cx; this.cz = cz; this.rx = rx; this.rz = rz;
    for (let z = 0; z < this.D; z++) for (let x = 0; x < this.W; x++) {
      const dx = (x + .5 - cx) / rx, dz = (z + .5 - cz) / rz;
      const dist = Math.sqrt(dx * dx + dz * dz) / (1 - wobble / 2 + wobble * fbm(x * .1, z * .1, seed));
      if (dist > 1) continue;
      const h = this.base + Math.round(height(x, z, dist));
      this.hm[x + this.W * z] = h;
      const dep = Math.round(2 + Math.pow(1 - dist, .6) * depth + noise(x * .35, z * .35, seed + 5) * 3);
      const y0 = Math.max(0, h - dep);
      this.minY = Math.min(this.minY, y0);
      for (let y = y0; y <= h; y++) this.g.set(x, y, z, surface(x, y, z, h, dist));
    }
  }
  delay(span = 1.6) {
    const { cx, cz, rx, rz, minY, H } = this;
    return (x, y, z) => {
      const r = Math.hypot((x - cx) / rx, (z - cz) / rz);
      return ((y - minY) / (H - minY)) * span * .75 + r * span * .35 + hash(x, y, z, 77) * .3;
    };
  }
  mesh(world, opts = {}) { return world.addGrid(opts.grid || this.g, { origin: this.o, delay: this.delay(opts.span), ...opts }); }
}

const pick = (arr, r) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
const GRASS = [0x78c850, 0x6bbb48, 0x84d058, 0x62b244];
const DIRT = [0xa06e45, 0x8f6039, 0x9a6a40];
const STONE = [0x8f8b88, 0x7f7b78, 0x9a9590];

function ground(x, y, z, h, { grass = GRASS, dirt = DIRT, stone = STONE, seed = 0 } = {}) {
  const r = hash(x, y, z, seed);
  if (y === h) {
    const n = fbm(x * .18, z * .18, seed + 3);
    return mixHex(pick(grass, r), n > .55 ? 0xa8de6c : 0x4c9a3a, Math.min(.6, Math.abs(n - .5) * 1.1));
  }
  if (y >= h - 2) return pick(dirt, r);
  if (y >= h - 4 && r < .4) return pick(dirt, hash(x, y, z, 3));
  return pick(stone, r);
}

/* ---------- trees and things that live in the voxel grid ---------- */
function oak(g, x, y, z, { r = 2.5, trunk = 3, leaves = [0x5cba4b, 0x4ca842, 0x74cc5c], wood = 0x7a5236, seed = 0 } = {}) {
  g.box(x, y, z, x, y + trunk, z, wood);
  const cy = y + trunk + r * .55, R = Math.ceil(r) + 1;
  for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.sqrt(dx * dx + (dy * 1.3) ** 2 + dz * dz) + (hash(x + dx, y + dy, z + dz, seed) - .5) * 1.1;
    if (d > r) continue;
    const yy = Math.round(cy + dy), top = dy / r;
    g.set(x + dx, yy, z + dz, top > .35 ? leaves[2] : hash(x + dx, yy, z + dz, 4) < .5 ? leaves[0] : leaves[1]);
  }
}
function pine(g, x, y, z, { h = 7, leaves = [0x2f8f5c, 0x27804f, 0x3ea56c], wood = 0x6b4a32 } = {}) {
  g.box(x, y, z, x, y + 1, z, wood);
  for (let i = 0; i < h; i++) {
    const r = Math.max(0, (h - i) * .45 - (i % 2) * .55), yy = y + 2 + i, R = Math.ceil(r);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++)
      if (dx * dx + dz * dz <= r * r + .3) g.set(x + dx, yy, z + dz, i > h * .6 ? leaves[2] : hash(x + dx, yy, z + dz) < .5 ? leaves[0] : leaves[1]);
  }
  g.set(x, y + 2 + h, z, leaves[2]);
}
function bush(g, x, y, z, cols = [0x58b04a, 0x6cc458]) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++)
    if (Math.abs(dx) + Math.abs(dz) + dy <= 2 && hash(x + dx, y + dy, z + dz, 8) < .85) g.set(x + dx, y + dy, z + dz, pick(cols, hash(x + dx, dy, z + dz)));
}
function rock(g, x, y, z, s = 1, cols = STONE) {
  for (let dz = -s; dz <= s; dz++) for (let dx = -s; dx <= s; dx++) for (let dy = 0; dy <= s; dy++)
    if (dx * dx + dz * dz + dy * dy * 1.6 <= s * s + .6 && hash(x + dx, y + dy, z + dz, 2) < .9) g.set(x + dx, y + dy, z + dz, pick(cols, hash(x + dx, y + dy, z + dz)));
}
// A house with a gable roof running along x. Windows go into the glass grid.
function house(g, glass, x0, y0, z0, w, d, h, { wall = 0xf3e6cf, wall2, roof = 0xd9583f, roof2, trim = 0xffffff, door = 0x6b4630, win = 0x9cc9e8 } = {}) {
  g.box(x0, y0, z0, x0 + w - 1, y0 + h - 1, z0 + d - 1, (x, y) => (wall2 && (y - y0) % 2 ? wall2 : wall));
  g.box(x0, y0, z0, x0, y0 + h - 1, z0, trim); g.box(x0 + w - 1, y0, z0, x0 + w - 1, y0 + h - 1, z0, trim);
  g.box(x0, y0, z0 + d - 1, x0, y0 + h - 1, z0 + d - 1, trim); g.box(x0 + w - 1, y0, z0 + d - 1, x0 + w - 1, y0 + h - 1, z0 + d - 1, trim);
  for (let k = 0; ; k++) {
    const za = z0 - 1 + k, zb = z0 + d - k, yy = y0 + h + k;
    if (za > zb) break;
    const rc = roof2 && k % 2 ? roof2 : roof;
    g.box(x0 - 1, yy, za, x0 + w, yy, za, rc); g.box(x0 - 1, yy, zb, x0 + w, yy, zb, rc);
    if (za + 1 <= zb - 1) g.box(x0, yy, za + 1, x0 + w - 1, yy, zb - 1, wall);
  }
  // door in the middle of the +z wall, windows either side and on the -z wall
  const dx = x0 + Math.floor(w / 2);
  g.set(dx, y0, z0 + d - 1, door); g.set(dx, y0 + 1, z0 + d - 1, door);
  const wy = y0 + Math.min(2, h - 2);
  const putWin = (x, y, z) => { g.del(x, y, z); glass.set(x, y, z, win); };
  for (let x = x0 + 1; x < x0 + w - 1; x++) {
    if (Math.abs(x - dx) >= 2 && (x - x0) % 2 === 1) putWin(x, wy, z0 + d - 1);
    if ((x - x0) % 2 === 1) putWin(x, wy, z0);
  }
  for (let z = z0 + 1; z < z0 + d - 1; z++) if ((z - z0) % 2 === 1) { putWin(x0, wy, z); putWin(x0 + w - 1, wy, z); }
}

/* ---------- little creatures and props (flat-colour boxes) ---------- */
function duck() {
  const g = group(
    box(.62, .38, .95, 0x8a6a4a, 0, .2, 0), box(.5, .16, .5, 0xf2efe6, 0, .38, -.1),
    box(.36, .36, .36, 0x2f8a52, 0, .56, .42), box(.2, .1, .2, 0xf2b03a, 0, .5, .66),
    box(.2, .14, .26, 0x5a4636, 0, .34, -.52));
  return g;
}
function frog() {
  const eye = (x) => group(box(.16, .16, .16, 0xffffff, x, .38, .16), box(.08, .08, .04, 0x111111, x, .4, .25));
  return group(box(.5, .26, .52, 0x5cc04a, 0, .16, 0), box(.54, .08, .56, 0xe8f2a8, 0, .04, 0), eye(-.14), eye(.14));
}
function dragonfly(col = 0x2fa8ff) {
  const wing = (x, z) => { const w = box(.55, .02, .16, 0xe9f6ff, x, .05, z, { transparent: true, opacity: .7 }); w.castShadow = false; return w; };
  const wl = group(wing(-.32, .05), wing(-.3, -.12)), wr = group(wing(.32, .05), wing(.3, -.12));
  const g = group(box(.09, .09, .8, col, 0, 0, -.1), box(.16, .14, .18, col, 0, .02, .3), wl, wr);
  g.userData.wings = [wl, wr];
  return g;
}
function butterfly(col = 0xff9f2e) {
  const wl = group(box(.32, .02, .34, col, -.18, 0, 0)), wr = group(box(.32, .02, .34, col, .18, 0, 0));
  const g = group(box(.06, .06, .3, 0x2b2b2b), wl, wr);
  g.userData.wings = [wl, wr];
  return g;
}
function heron() {
  const neck = group(box(.14, .8, .14, 0xc9d1d9, 0, .4, 0), box(.24, .2, .3, 0xd8dee5, 0, .86, .08), box(.07, .07, .42, 0xe8b13a, 0, .84, .38));
  neck.position.set(0, 1.5, .25);
  const g = group(box(.12, 1.1, .12, 0xe0b24a, -.12, .55, 0), box(.12, 1.1, .12, 0xe0b24a, .12, .55, 0), box(.5, .5, .9, 0x9aa6b3, 0, 1.3, 0), box(.36, .2, .5, 0x5e6875, 0, 1.6, -.2), neck);
  g.userData.neck = neck;
  return g;
}
function bench(col = 0x9b6a3c) { return group(box(1.6, .12, .5, col, 0, .5, 0), box(1.6, .45, .1, col, 0, .85, -.22), box(.1, .5, .4, 0x555555, -.65, .25, 0), box(.1, .5, .4, 0x555555, .65, .25, 0)); }

// ---------- path helpers ----------
const ellipse = (cx, cz, rx, rz) => t => [cx + Math.cos(t) * rx, cz + Math.sin(t) * rz];
function along(points, u) {
  // points: [[x,z],...], u: 0..1 along the polyline. Returns [x, z, heading]
  const seg = []; let total = 0;
  for (let i = 1; i < points.length; i++) { const l = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]); seg.push(l); total += l; }
  let d = clamp(u) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const a = points[i], b = points[i + 1], k = seg[i] ? d / seg[i] : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, Math.atan2(b[0] - a[0], b[1] - a[1])];
    }
    d -= seg[i];
  }
  return [...points[points.length - 1], 0];
}

/* =========================================================================
   1. Pond habitat (nature centre)
   ========================================================================= */
function pondWorld() {
  const L = new Land(50, 24, 42, 12);
  const W = new World({
    sky: [[0, 0x6fc3ff], [.6, 0xb9e4ff], [1, 0xeefaff]], fog: [0xdff2ff, 140, 260],
    hemi: [0xcfe6ff, 0x5d5140, 1.15], sun: [0xfff0d4, 3.5], sunDir: [-.5, .85, .8], shadow: 32,
    center: [0, -2, 0], cam: { az: .7, el: .64, dist: 100, fov: 24 }
  });
  const PC = { x: 23, z: 21, rx: 8.5, rz: 6.3 };
  const pd = (x, z) => Math.hypot((x + .5 - PC.x) / PC.rx, (z + .5 - PC.z) / PC.rz) / (.92 + .16 * noise(x * .3, z * .3, 4));
  const hut = { x0: 8, z0: 11, w: 7, d: 5 };
  L.island({
    cx: 25, cz: 21, rx: 23, rz: 19, seed: 3,
    height: (x, z) => {
      const p = pd(x, z);
      if (p < 1) return -1 - Math.round(2.6 * (1 - p));
      if (x >= hut.x0 - 2 && x <= hut.x0 + hut.w + 1 && z >= hut.z0 - 2 && z <= hut.z0 + hut.d + 3) return 1;
      const hill = smooth(0, 1, (16 - z) / 10) * smooth(0, 1, (x - 26) / 14) * 2.6;
      return Math.round(fbm(x * .14, z * .14, 2) * 1.4 - .55 + hill + smooth(1, 1.6, p) * .4);
    },
    surface: (x, y, z, h, dist) => {
      const p = pd(x, z);
      if (y === h && p < 1) return mixHex(0xa8935f, 0x6f6440, clamp(1 - p) * .9);
      if (y === h && p < 1.2) return mixHex(0xb7c76a, 0x9fc45a, hash(x, z));
      return ground(x, y, z, h, { seed: 1 });
    }
  });
  const g = L.g, glass = new Grid(L.W, L.H, L.D);
  const T = (x, z) => L.h(x, z) + 1;
  // trees
  [[7, 22], [41, 9], [44, 27], [10, 33], [31, 37], [20, 6], [38, 34]].forEach(([x, z], i) => { if (L.h(x, z) > 0) oak(g, x, T(x, z), z, { r: 2.2 + (i % 3) * .35, seed: i }); });
  [[5, 16], [45, 18], [35, 5], [14, 37], [27, 4]].forEach(([x, z], i) => { if (L.h(x, z) > 0) pine(g, x, T(x, z), z, { h: 6 + (i % 3) }); });
  [[17, 9], [37, 14], [40, 23], [12, 27], [26, 33], [33, 30]].forEach(([x, z]) => L.h(x, z) > 0 && bush(g, x, T(x, z), z));
  [[30, 10], [16, 30], [43, 13]].forEach(([x, z], i) => L.h(x, z) > 0 && rock(g, x, T(x, z) - 1, z, 2));
  house(g, glass, hut.x0, T(hut.x0, hut.z0), hut.z0, hut.w, hut.d, 4, { wall: 0xc98d5a, wall2: 0xb97d4c, roof: 0x3f7f5c, roof2: 0x4a8f68, trim: 0x8a5a34 });
  L.mesh(W, { occ: [glass] });
  L.mesh(W, { grid: glass, occ: [g], jitter: .02 });

  const time = { value: 0 };
  const cells = [];
  for (let z = 0; z < L.D; z++) for (let x = 0; x < L.W; x++) { const p = pd(x, z); if (p < 1 && L.h(x, z) > -999) cells.push({ x: L.wx(x), z: L.wz(z), depth: clamp((1 - p) * 1.6) }); }
  const pondWater = water(cells, { level: -.3, deep: 0x1677c9, shallow: 0x4fd0d6, time, opacity: .86 });
  W.prop(pondWater, 1.6);

  // lily pads
  const pads = [];
  [[-4, 1], [-2.5, -2.4], [1.5, 2.6], [3.6, -1.2], [-5.6, -1], [0, -3.4], [5.5, 1.8]].forEach(([dx, dz], i) => {
    const p = group(box(1, .06, 1, 0x4fa83f, 0, 0, 0));
    if (i % 3 === 0) p.add(box(.3, .22, .3, 0xff8fb8, .15, .12, .1), box(.14, .1, .14, 0xffe27a, .15, .25, .1));
    p.position.set(L.wx(PC.x) + dx, -.24, L.wz(PC.z) + dz); p.rotation.y = i * 1.3;
    pads.push(p); W.prop(p, 1.9 + i * .05);
  });

  // reeds (wild edge)
  const reedItems = [];
  for (let z = 0; z < L.D; z++) for (let x = 0; x < L.W; x++) {
    const p = pd(x, z), ang = Math.atan2(z - PC.z, x - PC.x);
    if (p < .78 || p > 1.12 || hash(x, z, 0, 21) > .6) continue;
    if (ang > -1.9 && ang < -.9) continue; // keep the north bank open for the path
    const n = 2 + Math.floor(hash(x, z, 1) * 3);
    for (let k = 0; k < n; k++) {
      const ox = (hash(x, z, k, 3) - .5) * .8, oz = (hash(x, z, k, 4) - .5) * .8, hgt = 1.3 + hash(x, z, k, 5) * 1.3;
      const base = Math.max(-.3, L.top(x, z));
      const k0 = (ang + Math.PI) / (Math.PI * 2);
      reedItems.push({ x: L.wx(x) + ox, y: base + hgt / 2, z: L.wz(z) + oz, w: .13, h: hgt, c: hash(x, z, k) < .5 ? 0x5f9e3c : 0x78b24a, k: k0 });
      if (hash(x, z, k, 9) < .45) reedItems.push({ x: L.wx(x) + ox, y: base + hgt + .2, z: L.wz(z) + oz, w: .22, h: .5, c: 0x7a4a2a, k: k0 + .01 });
    }
  }
  const reeds = new Tiles(reedItems, { dur: 1.2, drop: 0 });
  W.root.add(reeds.mesh);

  // gravel ring path (for visitors)
  const ringItems = [];
  for (let z = 0; z < L.D; z++) for (let x = 0; x < L.W; x++) {
    const p = pd(x, z);
    if (p < 1.22 || p > 1.62 || L.h(x, z) < L.base - 1) continue;
    const ang = Math.atan2(z - PC.z, x - PC.x);
    ringItems.push({ x: L.wx(x), y: L.top(x, z) + .08, z: L.wz(z), w: 1, h: .16, c: hash(x, z) < .5 ? 0xe2d8c0 : 0xd3c7aa, k: (ang + Math.PI) / (Math.PI * 2) });
  }
  const ring = new Tiles(ringItems, { dur: 1.4, drop: 1.2 });
  W.root.add(ring.mesh);

  // viewing deck over the water (north bank)
  const deckItems = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++)
    deckItems.push({ x: L.wx(PC.x - 3 + i), y: .05, z: L.wz(PC.z - 6 + j), w: 1, h: .22, d: .92, c: i % 2 ? 0xc79a64 : 0xb88a55, k: j / 4 + i * .02 });
  for (let i = 0; i < 6; i += 5) for (let j = 1; j < 4; j += 2) deckItems.push({ x: L.wx(PC.x - 3 + i), y: -.6, z: L.wz(PC.z - 6 + j), w: .2, h: 1.2, c: 0x7a5a3a, k: 0 });
  const deck = new Tiles(deckItems, { dur: 1.1, drop: 2 });
  W.root.add(deck.mesh);

  // boardwalk across the south-east corner
  const bwPath = [[PC.x + 9.5, PC.z + 1], [PC.x + 5, PC.z + 2.2], [PC.x + 2, PC.z + 4.2], [PC.x - 1, PC.z + 7]];
  const bwItems = [];
  for (let u = 0, i = 0; u <= 1.0001; u += 1 / 26, i++) {
    const [x, z, hd] = along(bwPath, u);
    bwItems.push({ x: L.wx(x), y: .02, z: L.wz(z), w: 1.7, h: .2, d: .42, ry: hd + Math.PI / 2, c: i % 2 ? 0xc49563 : 0xb3855a, k: u });
    if (i % 4 === 0) {
      const px = Math.cos(hd) * .85, pz = -Math.sin(hd) * .85;
      bwItems.push({ x: L.wx(x) + px, y: -.2, z: L.wz(z) + pz, w: .16, h: 1.4, c: 0x7a5a3a, k: u }, { x: L.wx(x) - px, y: -.2, z: L.wz(z) - pz, w: .16, h: 1.4, c: 0x7a5a3a, k: u });
    }
  }
  const boardwalk = new Tiles(bwItems, { dur: 1.5, drop: 2 });
  W.root.add(boardwalk.mesh);

  // native flowers on the east bank
  const flItems = [], FL = [0xffd23f, 0xb48cff, 0xff7aa8, 0xffffff, 0x6ec6ff, 0xff9f43];
  for (let z = 0; z < L.D; z++) for (let x = 0; x < L.W; x++) {
    const p = pd(x, z);
    if (x < PC.x + 7 || p < 1.15 || L.h(x, z) < L.base - 1 || hash(x, z, 0, 31) > .55) continue;
    for (let k = 0; k < 2; k++) {
      const ox = (hash(x, z, k, 6) - .5) * .7, oz = (hash(x, z, k, 7) - .5) * .7, hh = .35 + hash(x, z, k, 8) * .45, t = L.top(x, z);
      const kk = hash(x, z, k, 9);
      flItems.push({ x: L.wx(x) + ox, y: t + hh / 2, z: L.wz(z) + oz, w: .07, h: hh, c: 0x4f9a3a, k: kk });
      flItems.push({ x: L.wx(x) + ox, y: t + hh + .1, z: L.wz(z) + oz, w: .26, h: .2, c: pick(FL, hash(x, z, k, 10)), k: kk + .02 });
    }
  }
  const flowers = new Tiles(flItems, { dur: 1.3, drop: .6 });
  W.root.add(flowers.mesh);

  // benches for visitors
  const benches = [[PC.x - 9.6, PC.z - 2, 1.4], [PC.x + 2, PC.z - 8.6, 0], [PC.x + 9.5, PC.z + 4, -1.6]].map(([x, z, r]) => {
    const b = bench(); b.position.copy(L.at(x | 0, z | 0)); b.rotation.y = r; W.root.add(b); return b;
  });

  // wildlife
  const ducks = [0, 2.1, 4.2].map(o => { const d = duck(); W.root.add(d); return { o, d }; });
  const frogs = [0, 3, 5].map(i => { const f = frog(); pads[i].add(f); f.position.y = .03; return f; });
  const flies = [0x2fa8ff, 0x34d1a0].map(c => { const d = dragonfly(c); W.root.add(d); return d; });
  const butts = [0xff9f2e, 0xffffff, 0xffd23f, 0xb48cff].map(c => { const b = butterfly(c); W.root.add(b); return b; });
  const her = heron(); her.position.copy(L.at(PC.x - 7, PC.z + 3)); her.position.y = -.6; her.rotation.y = .9; W.root.add(her);
  const splash = new Particles(80, { size: .18 }); W.root.add(splash.mesh);

  // visitors
  const people = [
    kid({ shirt: 0xff6b4a, hair: 0x2b1d14 }), kid({ shirt: 0x3fa7ff, hair: 0xe0b060, long: true, skin: kid.skins[0] }),
    kid({ shirt: 0xffc83d, hair: 0x1a1a1a, skin: kid.skins[3] }), kid({ shirt: 0x8f6bff, hair: 0x5a3a24, skin: kid.skins[2], long: true })
  ];
  people.forEach(p => { p.scale.setScalar(.82); W.root.add(p); });

  // state
  const S = { wild: 1, visitors: 0, reeds: 1, ring: 0, deck: 0, bw: 0, flowers: 0 };
  const target = { ...S };
  const STATES = {
    start: { wild: .7, visitors: .5, reeds: 1, ring: 0, deck: 0, bw: 0, flowers: 0 },
    nice: { wild: .12, visitors: 1, reeds: 0, ring: 1, deck: 1, bw: 0, flowers: 0 },
    wild: { wild: 1, visitors: .5, reeds: 1, ring: 0, deck: 0, bw: 1, flowers: 1 }
  };
  W.setState = (name, instant = false) => {
    Object.assign(target, STATES[name]);
    reeds.set(!!target.reeds, instant); ring.set(!!target.ring, instant); deck.set(!!target.deck, instant);
    boardwalk.set(!!target.bw, instant); flowers.set(!!target.flowers, instant);
    benches.forEach(b => (b.userData.on = !!target.ring));
    if (instant) Object.assign(S, target);
    W.state = name;
  };
  W.setState('start', true);

  const C = new THREE.Vector3(L.wx(PC.x), 0, L.wz(PC.z));
  let fishT = 2;
  W.tick((t, dt) => {
    time.value = t;
    const k = Math.min(1, dt * 1.6);
    for (const key in S) S[key] += (target[key] - S[key]) * k;
    [reeds, ring, deck, boardwalk, flowers].forEach(x => x.update(dt));
    benches.forEach(b => { const s = lerp(b.scale.x, b.userData.on ? 1 : .001, Math.min(1, dt * 6)); b.scale.setScalar(s); b.visible = s > .01; });
    // ducks: circle the pond, fly off when the reeds go
    ducks.forEach(({ o, d }, i) => {
      const a = t * .22 + o, gone = 1 - clamp(S.wild * 1.4 - (i === 0 ? 0 : .3));
      const r = 3.6 + i * .5;
      d.position.set(C.x + Math.cos(a) * r * 1.2 + gone * 14, -.32 + Math.sin(t * 2 + i) * .04 + gone * gone * 12, C.z + Math.sin(a) * r * .8 - gone * 6);
      d.rotation.y = -a + (gone > .05 ? .8 : 0); d.rotation.z = gone * .3;
      d.visible = gone < .98;
    });
    frogs.forEach((f, i) => { const s = clamp(S.wild * 1.5 - .4); f.scale.setScalar(Math.max(.001, s)); const hop = (t * .6 + i * .37) % 1; f.position.y = .03 + (hop < .15 ? Math.sin(hop / .15 * Math.PI) * .5 : 0); });
    flies.forEach((f, i) => {
      const s = clamp(S.wild * 1.6 - .5); f.visible = s > .02; f.scale.setScalar(Math.max(.001, s) * 1.1);
      const a = t * (.7 + i * .2) + i * 3;
      f.position.set(C.x + Math.sin(a) * 6 + Math.sin(a * 3.1) * .8, 1.6 + Math.sin(a * 2.3) * .5, C.z + Math.cos(a * 1.3) * 4.5);
      f.rotation.y = a * 1.3; f.userData.wings.forEach((w, j) => (w.rotation.z = Math.sin(t * 60 + j) * .5));
    });
    butts.forEach((b, i) => {
      const s = clamp(S.flowers * 1.4 - .3); b.visible = s > .02; b.scale.setScalar(Math.max(.001, s) * 1.2);
      const a = t * .5 + i * 1.7;
      b.position.set(L.wx(PC.x + 12) + Math.sin(a) * 3.5 + Math.sin(a * 2.7) * .6, 1.4 + Math.abs(Math.sin(a * 4)) * .6 + i * .15, L.wz(PC.z) + Math.cos(a * .8) * 6);
      b.rotation.y = a; b.userData.wings.forEach((w, j) => (w.rotation.z = (j ? -1 : 1) * (.3 + Math.sin(t * 18 + i) * .6)));
    });
    const hs = clamp(S.reeds * 1.3 - .3) * clamp(S.wild * 1.5 - .3); her.visible = hs > .02; her.scale.setScalar(Math.max(.001, hs));
    her.userData.neck.rotation.x = Math.max(0, Math.sin(t * .7)) * .5;
    // visitors walk the gravel ring, or stroll the boardwalk
    people.forEach((p, i) => {
      const on = i < Math.round(1 + S.visitors * 3);
      const s = lerp(p.scale.x, on ? .82 : .001, Math.min(1, dt * 5)); p.scale.setScalar(s); p.visible = s > .01;
      if (S.ring > .5) {
        const a = t * .08 * (i % 2 ? -1 : 1) + i * 1.6, e = ellipse(PC.x, PC.z, PC.rx * 1.42, PC.rz * 1.42)(a);
        const x = clamp(e[0], 0, L.W - 1), z = clamp(e[1], 0, L.D - 1);
        p.position.set(L.wx(x), L.top(x | 0, z | 0) + .16, L.wz(z));
        p.rotation.y = -a + (i % 2 ? Math.PI : 0); p.walk(t * 6 + i, 1);
      } else if (S.bw > .5 && i < 2) {
        const u = .5 + Math.sin(t * .18 + i * 2) * .45, [x, z, hd] = along(bwPath, u);
        p.position.set(L.wx(x), .14, L.wz(z)); p.rotation.y = hd + (Math.cos(t * .18 + i * 2) > 0 ? 0 : Math.PI); p.walk(t * 6 + i, 1);
      } else {
        const spots = [[hut.x0 + 3, hut.z0 + 7], [hut.x0 + 6, hut.z0 + 8], [PC.x + 10, PC.z - 4], [PC.x - 4, PC.z + 9]];
        const [x, z] = spots[i]; p.position.set(L.wx(x), L.top(x, z), L.wz(z)); p.rotation.y = Math.atan2(PC.x - x, PC.z - z); p.walk(0, 0);
      }
    });
    // a fish jumps now and then
    fishT -= dt;
    if (fishT < 0 && S.wild > .5) {
      fishT = 2.5 + Math.random() * 2;
      const a = Math.random() * 6.28, x = C.x + Math.cos(a) * 3, z = C.z + Math.sin(a) * 2;
      for (let i = 0; i < 14; i++) splash.spawn({ x, y: -.2, z, vx: (Math.random() - .5) * 2, vy: 2.5 + Math.random() * 2, vz: (Math.random() - .5) * 2, g: 9, life: .8, color: i < 2 ? 0xff9f43 : 0xe6fbff, size: i < 2 ? .3 : .14 });
    }
    splash.update(dt);
  });
  W.anchors = { pond: C, reeds: L.at(PC.x - 8, PC.z + 2, 1.5), deck: new THREE.Vector3(L.wx(PC.x), 1, L.wz(PC.z - 5)), boardwalk: new THREE.Vector3(L.wx(PC.x + 4), 1.2, L.wz(PC.z + 3)), flowers: L.at(PC.x + 12, PC.z, 1.2), hut: L.at(hut.x0 + 3, hut.z0 + 2, 5) };
  W.actors = { ducks: ducks.map(d => d.d), frogs, flies, butts, heron: her };
  return W;
}

/* =========================================================================
   2. Rover on Mars (STEM club)
   ========================================================================= */
const wheelGeo = {};
function wheel(r, w) {
  const k = r + ':' + w;
  if (!wheelGeo[k]) { const g = new THREE.CylinderGeometry(r, r, w, 12); g.rotateZ(Math.PI / 2); wheelGeo[k] = g; }
  const m = new THREE.Mesh(wheelGeo[k], mat(0x353b44)); m.castShadow = true;
  const hub = box(w + .04, r * .7, r * .7, 0xb9c0c8); m.add(hub);
  const tread = box(w + .02, r * 2.02, .12, 0x22272e); m.add(tread);
  return m;
}
function rover(accent = 0x5b4cf0) {
  const g = new THREE.Group(), body = new THREE.Group();
  body.add(
    box(2, .7, 2.8, 0xeef1f4, 0, 1.2, 0), box(2.04, .18, 2.84, accent, 0, .92, 0),
    box(1.8, .1, 1.4, 0x2b4fa0, 0, 1.6, -.55), box(1.82, .04, .06, 0x9fb7e6, 0, 1.66, -.55), box(.06, .04, 1.42, 0x9fb7e6, 0, 1.66, -.55),
    box(.16, 1.1, .16, 0xc7ccd2, .55, 2.1, .85), box(.9, .52, .55, 0xf7f8fa, .55, 2.9, .95),
    box(.24, .24, .08, 0x1d2633, .35, 2.93, 1.24), box(.24, .24, .08, 0x1d2633, .75, 2.93, 1.24),
    box(.08, .08, .04, 0xffffff, .3, 2.99, 1.29), box(.08, .08, .04, 0xffffff, .7, 2.99, 1.29),
    box(.06, .9, .06, 0xc7ccd2, -.7, 2, -1.05), box(.5, .06, .5, 0xdfe3e8, -.7, 2.46, -1.05), box(.1, .1, .1, accent, -.7, 2.55, -1.05));
  g.add(body);
  const sets = {};
  for (const [kind, r, w] of [['small', .34, .26], ['wide', .72, 1.05]]) {
    const s = new THREE.Group(); s.userData.r = r;
    for (const side of [-1, 1]) for (const z of [-1.05, 0, 1.05]) {
      const wh = wheel(r, w); wh.position.set(side * (1.08 + w / 2), r, z); s.add(wh);
    }
    s.add(box(.12, .12, 2.3, 0x9aa2ab, -1.08, Math.max(r, .6), 0), box(.12, .12, 2.3, 0x9aa2ab, 1.08, Math.max(r, .6), 0));
    sets[kind] = s; g.add(s);
  }
  g.userData = { body, sets, kind: 'small' };
  g.setWheels = kind => { g.userData.kind = kind; for (const k in sets) sets[k].visible = k === kind; body.position.y = kind === 'wide' ? .4 : 0; };
  g.setWheels('small');
  return g;
}
function marsWorld() {
  const L = new Land(56, 26, 38, 10);
  const W = new World({
    sky: [[0, 0x7fc0f0], [.55, 0xcfe3f2], [.85, 0xf6dcc8], [1, 0xffe8d4]], fog: [0xf7e2d2, 170, 300],
    hemi: [0xeef2ff, 0x7a3a22, 1.3], sun: [0xfff2e0, 3.9], sunDir: [-.5, .85, .8], shadow: 34,
    center: [0, -1.5, 0], cam: { az: .6, el: .6, dist: 128, fov: 24 }
  });
  const CR = { x: 45, z: 18.5, r: 6.4 }, SAND = { x: 27, z: 20, r: 3.8 };
  const STRATA = [0x9c4428, 0xd0794a, 0x7e3320, 0xe2a06a, 0xb25234, 0x6a2e1e, 0xc86a3e];
  L.island({
    cx: 28, cz: 19, rx: 27.5, rz: 17.5, seed: 11, depth: 11,
    height: (x, z) => {
      const cd = Math.hypot(x + .5 - CR.x, z + .5 - CR.z) / CR.r;
      if (cd < 1) return -2.6 * (1 - cd * cd) + 1.4 * smooth(.6, 1, cd);
      const rim = Math.max(0, 1.6 - Math.abs(cd - 1.12) * 3.2);
      const plateau = 1.7 + noise(x * .3, z * .3, 2) * .8;
      const dune = Math.pow(Math.max(0, Math.sin(x * .3 + z * .16 + noise(x * .08, z * .08, 4) * 2.2)), 1.5) * 2.2 + fbm(x * .1, z * .1, 9) * 1.2 - .5;
      const p = 1 - smooth(12, 18, x);
      const sd = Math.hypot(x + .5 - SAND.x, z + .5 - SAND.z) / SAND.r;
      return p * plateau + (1 - p) * (sd < 1 ? .2 : dune) + rim;
    },
    surface: (x, y, z, h) => {
      const r = hash(x, y, z, 6);
      if (y === h) {
        const cd = Math.hypot(x + .5 - CR.x, z + .5 - CR.z) / CR.r, sd = Math.hypot(x + .5 - SAND.x, z + .5 - SAND.z) / SAND.r;
        if (cd < .32) return mixHex(0xeef6ff, 0xcfe3f5, r);
        if (Math.hypot((x + .5 - 38) / 2.2, (z + .5 - 21) / 1.4) < 1) return mixHex(0x5a2416, 0x4a1d12, r);
        if (cd < .95) return mixHex(0x8a3a22, 0x6f2e1c, r * .7);
        if (sd < 1) return mixHex(0xf6bd86, 0xffd19e, r);
        if (x < 15) return mixHex(0xb4573a, 0x9c4a30, r * .8);
        const n = fbm(x * .2, z * .2, 3), m = noise(x * .45, z * .45, 17);
        if (m > .78) return mixHex(0x6e3324, 0x5c2a1e, r);
        return mixHex(mixHex(0xdf8452, 0xc96a3f, r), n > .55 ? 0xf2ad74 : 0xa94f30, Math.min(.65, Math.abs(n - .5) * 1.5));
      }
      if (y >= h - 1) return 0xb85f3a;
      return STRATA[(Math.floor((y + noise(x * .18, z * .18, 5) * 2.4) / 1.4) % STRATA.length + STRATA.length) % STRATA.length];
    }
  });
  const g = L.g, glass = new Grid(L.W, L.H, L.D), T = (x, z) => L.h(x, z) + 1;
  const RK = [0x6e2c1a, 0x82392a, 0x5a2416];
  [[20, 9, 2], [33, 15, 2], [36, 25, 1], [24, 29, 2], [50, 9, 1], [31, 6, 1], [14, 25, 1], [52, 25, 2]].forEach(([x, z, s]) => L.h(x, z) > -900 && rock(g, x, T(x, z) - 1, z, s, RK));
  // habitat dome
  const D = { x: 8, z: 10, r: 4.6 }, dy0 = T(D.x, D.z);
  for (let y = 0; y <= 5; y++) for (let z = -5; z <= 5; z++) for (let x = -5; x <= 5; x++) {
    const d = Math.sqrt(x * x + y * y * 1.15 + z * z);
    if (d > D.r) continue;
    const shell = d > D.r - 1.2;
    if (y === 2 && shell && (x + z) % 2 === 0 && (x > 0 || z > 0)) glass.set(D.x + x, dy0 + y, D.z + z, 0x8fd8ff);
    else g.set(D.x + x, dy0 + y, D.z + z, y === 1 ? 0xc9ced3 : hash(x, y, z) < .5 ? 0xf4f4f2 : 0xeaeceb);
  }
  g.box(D.x + 4, dy0, D.z - 1, D.x + 7, dy0 + 2, D.z + 1, 0xf0f1f0); g.box(D.x + 7, dy0, D.z, D.x + 7, dy0 + 1, D.z, 0x5b4cf0);
  for (let y = 0; y <= 3; y++) for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) if (x * x + z * z <= 6.5 + (y === 3 ? -3 : 0)) g.set(7 + x, T(7, 19) + y, 19 + z, y === 1 ? 0x5b4cf0 : 0xf2f3f2);
  // landing pad
  const py = T(17, 29) - 1;
  g.box(15, py, 26, 21, py, 32, (x, y, z) => ((x === 15 || x === 21) && (z === 26 || z === 32) ? 0xffc83d : (x + z) % 2 ? 0x9b9ea3 : 0x8e9196));
  L.mesh(W, { occ: [glass] });
  L.mesh(W, { grid: glass, occ: [g], jitter: .02 });
  // solar panels and antenna
  [[3, 23], [3, 26.5], [6.4, 24.8]].forEach(([x, z], i) => {
    const p = group(box(.2, 1, .2, 0xb5bcc4, 0, .5, 0), box(2.6, .12, 1.6, 0x27458f, 0, 1.05, 0), box(2.62, .04, .06, 0x9fb3d9, 0, 1.12, 0), box(.06, .04, 1.62, 0x9fb3d9, 0, 1.12, 0));
    p.children[1].rotation.x = p.children[2].rotation.x = p.children[3].rotation.x = -.35;
    p.position.copy(L.at(x | 0, z | 0)); W.prop(p, 1.8 + i * .1);
  });
  const dish = group(box(.2, 3.4, .2, 0xc7ccd2, 0, 1.7, 0), box(1.6, .14, 1.6, 0xe9ecef, 0, 3.5, .15), box(.1, .6, .1, 0xc7ccd2, 0, 3.8, .35));
  dish.children[1].rotation.x = -.6; dish.position.copy(L.at(13, 6)); W.prop(dish, 1.9);
  // target flag on the crater rim
  const flag = group(box(.12, 3.2, .12, 0xffffff, 0, 1.6, 0), box(1.4, .8, .06, 0x5b4cf0, .72, 2.75, 0));
  flag.position.copy(L.at(CR.x - 4, CR.z - 5)); W.prop(flag, 2.2);
  const beacon = glow(0xb7aaff, 4, .8); beacon.position.copy(flag.position).add(new THREE.Vector3(0, 3.4, 0)); W.root.add(beacon);
  // pebbles
  const peb = [];
  for (let i = 0; i < 160; i++) { const x = 2 + hash(i, 1) * 52, z = 2 + hash(i, 2) * 34; if (L.h(x, z) < -900) continue; const s = .25 + hash(i, 3) * .35; peb.push({ x: L.wx(x), y: L.top(x | 0, z | 0) + s / 2, z: L.wz(z), w: s, h: s * .7, c: pick(RK, hash(i, 4)), ry: hash(i, 5) * 3 }); }
  const pebbles = new Tiles(peb, { drop: 0 }); W.root.add(pebbles.mesh);

  // the rover
  const rv = rover(); W.root.add(rv);
  const route = [[13.5, 12.5], [19, 15.5], [23.5, 18.5], [27, 20], [31, 20.5], [35.5, 19.5], [CR.x - 7.4, CR.z - 1.5]];
  const lens = [0]; for (let i = 1; i < route.length; i++) lens.push(lens[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
  const total = lens[lens.length - 1];
  const sandU = (lens[3] - 1.2) / total;
  const dust = new Particles(160, { size: .28 }); W.root.add(dust.mesh);
  const TR = 360, tracks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x8f4128 }), TR);
  tracks.count = 0; tracks.receiveShadow = true; tracks.frustumCulled = false; W.root.add(tracks);
  const tDummy = new THREE.Object3D(); let tLast = null, tNext = 0;
  const resetTracks = () => { tracks.count = 0; tNext = 0; tLast = null; tracks.instanceMatrix.needsUpdate = true; };
  const ping = new THREE.Mesh(new THREE.RingGeometry(.9, 1.15, 40), new THREE.MeshBasicMaterial({ color: 0x8ff5ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ping.rotation.x = -Math.PI / 2; W.root.add(ping);
  const flash = glow(0xffffff, 10, 0); W.root.add(flash);
  const pos = new THREE.Vector3(), headPos = new THREE.Vector3();
  const R = { mode: 'start', u: 0, sink: 0, spin: 0, mt: 0, pop: 1, scan: -1, flash: -1 };
  W.setState = (mode, instant) => {
    R.mode = mode; R.mt = 0;
    if (mode === 'start') { R.u = 0; R.sink = 0; rv.setWheels('small'); resetTracks(); }
    if (mode === 'fast') { rv.setWheels('small'); }
    if (mode === 'wide') { R.u = 0; R.sink = 0; R.pop = 0; rv.setWheels('wide'); resetTracks(); }
    if (mode === 'done') { rv.setWheels('wide'); R.u = 1; R.sink = 0; }
    if (instant) { if (mode === 'fast') { R.u = sandU; R.sink = .85; } if (mode === 'wide') { R.u = 1; R.pop = 1; } R.mt = 99; }
    W.state = mode;
  };
  W.scan = () => { R.scan = 0; };
  W.photo = () => { R.flash = 0; };
  W.setState('start', true);
  W.tick((t, dt) => {
    R.mt += dt;
    let speed = 0;
    if (R.mode === 'fast') {
      if (R.u < sandU) { speed = Math.min(.3, R.mt * .35); R.u = Math.min(sandU, R.u + speed * dt); }
      else { R.sink = Math.min(.85, R.sink + dt * .7); R.spin += dt * 22; }
    } else if (R.mode === 'wide' && R.mt > .4) {
      speed = Math.min(.19, (R.mt - .4) * .25); R.u = Math.min(1, R.u + speed * dt);
    }
    R.pop = Math.min(1, R.pop + dt * 2.2);
    const [x, z, hd] = along(route, R.u);
    const y = L.ys(x, z) - R.sink;
    pos.set(L.wx(x - .5), y, L.wz(z - .5));
    rv.position.copy(pos);
    const ahead = along(route, Math.min(1, R.u + .02)), yA = L.ys(ahead[0], ahead[1]);
    rv.rotation.set(R.mode === 'fast' && R.sink > .05 ? Math.sin(t * 30) * .03 - .12 : -(yA - L.ys(x, z)) * .35, hd, 0);
    const sc = R.pop < 1 ? Math.max(.001, 1 + Math.sin(R.pop * Math.PI) * .25) * (R.pop < .2 ? R.pop * 5 : 1) : 1;
    rv.scale.setScalar(sc * 1.5);
    R.spin += speed * dt * total / rv.userData.sets[rv.userData.kind].userData.r;
    rv.userData.sets[rv.userData.kind].children.forEach(c => { if (c.geometry && c.geometry.type === 'CylinderGeometry') c.rotation.x = R.spin; });
    // dust
    const moving = speed > .01 || (R.mode === 'fast' && R.sink > 0 && R.u >= sandU);
    if (moving && Math.random() < (R.mode === 'fast' ? .9 : .35)) {
      const back = new THREE.Vector3(-Math.sin(hd), 0, -Math.cos(hd));
      dust.spawn({ x: pos.x + back.x * 1.4 + (Math.random() - .5) * 2, y: pos.y + .3, z: pos.z + back.z * 1.4 + (Math.random() - .5) * 2, vx: back.x * 1.5 + (Math.random() - .5), vy: 1 + Math.random() * 1.6, vz: back.z * 1.5 + (Math.random() - .5), g: 1.2, drag: 1.2, life: 1.3, grow: 1.8, color: pick([0xf0b07a, 0xe39a66, 0xffd2a8], Math.random()), size: .3 });
    }
    dust.update(dt);
    // tyre tracks: two lines of marks laid behind the rover
    if (!tLast || tLast.distanceTo(pos) > .45) {
      if (tLast) {
        const half = rv.userData.kind === 'wide' ? 1.46 : 1.25, sx = Math.cos(hd) * half, sz = -Math.sin(hd) * half, wdt = rv.userData.kind === 'wide' ? .6 : .3;
        for (const side of [1, -1]) {
          const i = tNext % TR; tNext++;
          tDummy.position.set(pos.x + sx * side, L.ys(x + sx * side, z + sz * side) + .03 - (R.mode === 'fast' && R.u >= sandU ? .2 : 0), pos.z + sz * side);
          tDummy.rotation.set(0, hd, 0); tDummy.scale.set(wdt, .05, .32); tDummy.updateMatrix();
          tracks.setMatrixAt(i, tDummy.matrix);
        }
        tracks.count = Math.min(TR, tNext); tracks.instanceMatrix.needsUpdate = true;
      }
      tLast = pos.clone();
    }
    headPos.set(0, 3, 1).applyMatrix4(rv.matrixWorld);
    if (R.scan >= 0) { R.scan += dt; const k = R.scan / 1.4; ping.position.set(pos.x, pos.y + .15, pos.z); ping.scale.setScalar(1 + k * 9); ping.material.opacity = Math.max(0, .9 - k); if (k > 1) R.scan = -1; } else ping.material.opacity = 0;
    if (R.flash >= 0) { R.flash += dt; flash.position.copy(headPos); flash.material.opacity = Math.max(0, 1 - R.flash * 2.5); if (R.flash > .5) R.flash = -1; } else flash.material.opacity = 0;
    beacon.material.opacity = .5 + Math.sin(t * 4) * .3;
  });
  W.paintExtra = (ctx, w, h) => {
    for (let i = 0; i < 70; i++) { const x = hash(i, 1, 0, 3) * w, y = hash(i, 2, 0, 3) * h * .5, a = .35 + .5 * Math.abs(Math.sin(W.time * 1.5 + i)); ctx.fillStyle = `rgba(255,255,255,${a * (1 - y / (h * .5))})`; const r = (hash(i, 3, 0, 3) < .15 ? 2 : 1.2) * (w / 900); ctx.fillRect(x, y, r, r); }
  };
  W.time = 0; W.tick(t => (W.time = t));
  W.at = (x, z, dy) => L.at(x, z, dy);
  W.anchors = { rover: pos, head: headPos, crater: L.at(CR.x, CR.z, 0), sand: L.at(SAND.x, SAND.z, .5), rockA: L.at(33, 15, 1.6), rockB: L.at(36, 25, 1.2), shadow: L.at(38, 21, .2) };
  return W;
}

/* =========================================================================
   3. Island expedition (holiday camp)
   ========================================================================= */
const DAY = [[0, 0x6cc4ff], [.6, 0xb5e4ff], [1, 0xeefaff]], DUSK = [[0, 0x3b3f8f], [.5, 0xd96a8a], [.8, 0xffa66b], [1, 0xffd39a]];
const lerpStops = (a, b, k) => a.map(([o, c], i) => [o, mixHex(c, b[Math.min(i, b.length - 1)][1], k)]);
function tent(g, x, y, z, col, len = 3) {
  for (let k = 0; k < 2; k++) g.box(x - 1 + k, y + k, z, x + 1 - k, y + k, z + len - 1, k ? mixHex(col, 0xffffff, .25) : col);
  g.set(x, y, z + len - 1, 0x3a2a20);
}
function islandWorld() {
  const L = new Land(58, 30, 46, 9);
  const W = new World({
    sky: DAY, fog: [0xe3f4ff, 160, 300], hemi: [0xd6ecff, 0x4c5a3e, 1.15], sun: [0xfff1d8, 3.5], sunDir: [-.5, .85, .8], shadow: 36,
    center: [0, -2.5, 1], cam: { az: .66, el: .66, dist: 138, fov: 24 }
  });
  const river = [[35, 12], [29, 12.6], [24, 11], [19, 9], [14, 7], [8, 3.5]];
  const rd = (x, z) => { let m = 99; for (let i = 1; i < river.length; i++) { const [ax, az] = river[i - 1], [bx, bz] = river[i]; const vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)); m = Math.min(m, Math.hypot(x - ax - vx * t, z - az - vz * t)); } return m; };
  const ridge = (x, z) => 7.5 * Math.exp(-(((x - 31 - (z - 26) * .18) / 5.6) ** 2)) * smooth(13, 21, z) * (1 - smooth(34, 42, z)) * (.72 + .4 * noise(z * .16, x * .12, 6));
  const isl = (x, z) => Math.hypot((x + .5 - 29) / 25, (z + .5 - 23.5) / 19.5) / (.9 + .32 * fbm(x * .09, z * .09, 5));
  const SEABED = L.base - 4;
  for (let z = 0; z < L.D; z++) for (let x = 0; x < L.W; x++) {
    const d = isl(x, z);
    let h;
    if (d > 1) h = SEABED + Math.round(noise(x * .2, z * .2, 8) * 1.2);
    else if (d > .86) h = L.base - 1 + Math.round((1 - d) * 7);
    else h = L.base + 1 + Math.round(ridge(x, z) + fbm(x * .15, z * .15, 2) * 1.3 - .3);
    if (d <= 1 && rd(x + .5, z + .5) < 1.35) h = L.base - 1;
    L.hm[x + L.W * z] = h;
    for (let y = 0; y <= h; y++) {
      let c;
      const r = hash(x, y, z, 2);
      if (y === h) {
        if (h < L.base) c = mixHex(0xe9d39a, 0xd8c08a, r);                // seabed sand
        else if (h === L.base) c = mixHex(0xf5e2a8, 0xeed79a, r);         // beach
        else if (h >= L.base + 7) c = mixHex(0xf4f7fa, 0xe3eaf0, r);      // snow
        else if (h >= L.base + 5) c = mixHex(0x9ea3a8, 0x8a8f94, r);      // rock
        else c = ground(x, y, z, h, { seed: 4 });
      } else if (y >= h - 2 && h > L.base) c = h >= L.base + 5 ? 0x8a8d92 : pick(DIRT, r);
      else c = (Math.floor((y + noise(x * .2, z * .2, 3) * 2) / 1.6) % 2) ? mixHex(0x9b9389, 0x8a8278, r) : mixHex(0xc7b07c, 0xb69f6c, r);
      L.g.set(x, y, z, c);
    }
  }
  L.cx = 29; L.cz = 23; L.rx = 29; L.rz = 23; L.minY = 0;
  const g = L.g, glass = new Grid(L.W, L.H, L.D), T = (x, z) => L.h(x, z) + 1;
  const routeA = [[13, 31], [20, 27.5], [27, 24.5], [31, 23], [36, 20], [43, 16.5], [48, 15]];
  const routeB = [[13, 31], [14.5, 26], [17, 20.5], [21, 18], [25, 18.3], [30, 15.3], [37, 15.5], [42, 17], [46, 18]];
  const nearRoute = (x, z) => [routeA, routeB].some(r => { for (let i = 1; i < r.length; i++) { const [ax, az] = r[i - 1], [bx, bz] = r[i], vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)); if (Math.hypot(x - ax - vx * t, z - az - vz * t) < 2.6) return true; } return false; });
  // trees
  for (let i = 0; i < 70; i++) {
    const x = 3 + Math.floor(hash(i, 9) * 52), z = 3 + Math.floor(hash(i, 10) * 40), hh = L.h(x, z);
    if (hh <= L.base || hh >= L.base + 5 || rd(x, z) < 3 || isl(x, z) > .8 || nearRoute(x, z) || Math.hypot(x - 45, z - 21) < 6.5) continue;
    if (x < 20 && z > 29) continue; // camp clearing
    if (Math.abs(x - 25) < 4 && Math.abs(z - 16) < 3) continue;
    if (hash(i, 11) < .6) pine(g, x, T(x, z), z, { h: 5 + Math.floor(hash(i, 12) * 3) }); else oak(g, x, T(x, z), z, { r: 2, trunk: 2, seed: i });
  }
  // camp: tents
  tent(g, 9, T(9, 33), 32, 0xff6a2b); tent(g, 15, T(15, 36), 35, 0x3fa7ff); tent(g, 15, T(15, 29), 28, 0x46c06b);
  // halfway hut
  house(g, glass, 23, T(24, 17), 16, 5, 4, 3, { wall: 0xc98d5a, wall2: 0xb97d4c, roof: 0x8a3b2a, roof2: 0x9c4632, trim: 0x8a5a34 });
  // lighthouse on the east point
  const LH = { x: 50, z: 14 }, ly = T(LH.x, LH.z);
  rock(g, LH.x, ly - 2, LH.z, 3, [0x8e9196, 0x7a7d82, 0x9a9ea3]);
  const ly2 = L.g.top(LH.x, LH.z) + 1;
  for (let y = 0; y < 10; y++) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) {
    const r2 = x * x + z * z;
    if (r2 <= 2.5) g.set(LH.x + x, ly2 + y, LH.z + z, Math.floor(y / 2) % 2 ? 0xe8443a : 0xfafafa);
  }
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (x * x + z * z <= 5) g.set(LH.x + x, ly2 + 10, LH.z + z, 0x3b4048);
  for (let y = 11; y <= 12; y++) for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) glass.set(LH.x + x, ly2 + y, LH.z + z, 0xfff3b0);
  g.box(LH.x - 1, ly2 + 13, LH.z - 1, LH.x + 1, ly2 + 13, LH.z + 1, 0xc93a30); g.set(LH.x, ly2 + 14, LH.z, 0xc93a30);
  L.mesh(W, { occ: [glass] });
  const lamp = L.mesh(W, { grid: glass, occ: [g], jitter: .02 });
  lamp.material.emissive = new THREE.Color(0x000000);
  const lampTop = new THREE.Vector3(L.wx(LH.x), L.wy(ly2 + 12), L.wz(LH.z));

  // sea: surface plus see-through sides
  const time = { value: 0 }, cells = [];
  for (let z = 0; z < L.D; z++) for (let x = 0; x < L.W; x++) if (L.h(x, z) < L.base) cells.push({ x: L.wx(x), z: L.wz(z), depth: clamp((L.base - L.h(x, z)) / 5) });
  const sea = water(cells, { level: -.25, deep: 0x1c8fd6, shallow: 0x5fe0e0, opacity: .78, time }); W.prop(sea, 1.4);
  const sideMat = new THREE.MeshLambertMaterial({ color: 0x1a7fc4, transparent: true, opacity: .8, depthWrite: false });
  const depth = L.base - SEABED, x0 = L.o[0], x1 = L.o[0] + L.W, z0 = L.o[2], z1 = L.o[2] + L.D, yb = L.wy(SEABED + 1) - .02;
  for (const [w, px, pz, ry] of [[L.W, 0, z1, 0], [L.W, 0, z0, Math.PI], [L.D, x1, 0, Math.PI / 2], [L.D, x0, 0, -Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, -.25 - yb), sideMat); m.position.set(px + (px ? 0 : (x0 + x1) / 2), (yb - .25) / 2, pz + (pz ? 0 : (z0 + z1) / 2)); m.rotation.y = ry; W.prop(m, 1.4);
  }
  // fish under the surface
  const fish = [0, 1, 2, 3, 4].map(i => { const f = group(box(.7, .3, .25, 0xff9f43), box(.2, .3, .25, 0xff7a2b, -.42, 0, 0)); W.root.add(f); return f; });
  // jetty and boat by the camp
  const jet = []; for (let i = 0; i < 7; i++) jet.push({ x: L.wx(4 - i * .0), y: .1, z: L.wz(38 + i), w: 1.6, h: .2, d: .9, c: i % 2 ? 0xc49563 : 0xb3855a, k: i / 7 });
  W.root.add(new Tiles(jet).mesh);
  const boat = group(box(1.6, .5, 3.2, 0xffffff, 0, .1, 0), box(1.7, .18, 3.3, 0x2a7de1, 0, -.2, 0), box(.2, 2.6, .2, 0x8a6a4a, 0, 1.4, 0), box(.06, 1.8, 1.4, 0xfff5e0, .1, 1.7, .3));
  boat.position.set(L.wx(1), -.2, L.wz(41)); W.root.add(boat);
  // campfire
  const fireAt = L.at(12, 32), fire = new Particles(60, { size: .3, light: false }); W.root.add(fire.mesh);
  const logs = group(box(1.6, .3, .3, 0x6b4630, 0, .15, 0), box(.3, .3, 1.6, 0x5a3a26, 0, .2, 0)); logs.position.copy(fireAt); W.prop(logs, 2);
  const fireGlow = glow(0xffa040, 5, .7); fireGlow.position.copy(fireAt).add(new THREE.Vector3(0, 1, 0)); W.root.add(fireGlow);
  // lighthouse beam
  const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 22, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -11, 0); beam.geometry.rotateZ(Math.PI / 2);
  const beamPivot = group(beam); beamPivot.position.copy(lampTop); W.root.add(beamPivot);
  const lampGlow = glow(0xfff1a0, 6, 0); lampGlow.position.copy(lampTop); W.root.add(lampGlow);

  // the team
  const team = [0xff6a2b, 0xff6a2b, 0xff6a2b, 0xff6a2b].map((c, i) => kid({ shirt: c, pants: 0x2d3a5a, skin: kid.skins[[1, 3, 0, 2][i]], hair: [0x2b1d14, 0x1a1a1a, 0xe0b060, 0x7a3a1a][i], long: i % 2 === 1, hat: i === 0 ? 0x1fc7b6 : null }));
  team.forEach(k => { k.scale.setScalar(1.9); W.root.add(k); });
  const S = { mode: 'start', mt: 0, u: 0, energy: 1, dusk: 0, duskT: 0, rest: 0 };
  W.setState = (mode, instant) => {
    S.mode = mode; S.mt = 0;
    if (mode === 'start' || mode === 'quick' || mode === 'river') { S.u = 0; S.energy = 1; }
    if (mode !== 'river') S.duskT = 0;
    if (instant) { if (mode === 'quick') { S.u = .5; S.energy = .2; } if (mode === 'river') { S.u = 1; S.duskT = 1; S.dusk = 1; } S.mt = 99; }
    team.forEach(k => k.setMood(mode === 'quick' && instant ? 'tired' : 'smile'));
    W.state = mode;
  };
  W.setState('start', true);
  // the chosen route, drawn on the ground as a glowing trail just ahead of the team
  const trailOf = (r, c) => {
    const pts = [];
    for (let i = 1; i < r.length; i++) { const [ax, az] = r[i - 1], [bx, bz] = r[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / .9); for (let k = 0; k < n; k++) { const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n; pts.push([x, z]); } }
    const g = new THREE.Group();
    pts.forEach(([x, z], i) => { const d = box(.95, .22, .95, c, L.wx(x - .5), L.ys(x, z) + .14, L.wz(z - .5), { emissive: c, emissiveIntensity: .7 }); d.userData.u = i / (pts.length - 1); g.add(d); });
    W.root.add(g); return g;
  };
  const trails = { quick: trailOf(routeA, 0xff7a2b), river: trailOf(routeB, 0x2aa6ff) };
  let fishA = 0;
  W.tick((t, dt) => {
    time.value = t; S.mt += dt;
    for (const k in trails) trails[k].children.forEach(d => { const on = S.mode === k && d.userData.u <= (k === 'quick' ? Math.min(.5, S.u) + .2 : S.u + .22); d.visible = on; if (on) { const k = .95 * (1 + Math.sin(t * 5 - d.userData.u * 30) * .14); d.scale.set(k, .22, k); } });
    let route = routeA, moving = false;
    if (S.mode === 'quick') {
      const climb = S.u > .22 && S.u < .55;
      const sp = climb ? .12 * (.3 + S.energy) : .16;
      if (S.u < .5) { S.u = Math.min(.5, S.u + sp * dt); moving = true; S.energy = Math.max(.18, S.energy - (climb ? .22 : .02) * dt); }
      if (S.u >= .5 && !S.tired) { S.tired = true; team.forEach(k => k.setMood('tired')); }
    } else S.tired = false;
    if (S.mode === 'river') {
      route = routeB;
      const atHut = S.u > .42 && S.u < .46 && S.rest < 1.2;
      if (atHut) S.rest += dt; else if (S.u < 1) { S.u = Math.min(1, S.u + .2 * dt); moving = true; }
      if (S.u > .7) S.duskT = Math.min(1, S.duskT + dt * .35);
    } else S.rest = 0;
    S.dusk += (S.duskT - S.dusk) * Math.min(1, dt * 2);
    team.forEach((k, i) => {
      const u = clamp(S.u - i * .028);
      const [x, z, hd] = along(route, u);
      const sit = (S.mode === 'quick' && S.tired) || (S.mode === 'river' && S.u > .42 && S.u < .46 && S.rest < 1.2);
      const ox = (i % 2 ? .6 : -.6), oz = (i > 1 ? .5 : -.5);
      k.position.set(L.wx(x - .5) + (sit ? ox : 0), L.ys(x, z) - (sit ? .45 : 0), L.wz(z - .5) + (sit ? oz : 0));
      k.rotation.y = hd;
      const done = S.mode === 'river' && S.u >= 1;
      if (done) { k.position.x += (i - 1.5) * 1.15; k.position.z -= (i - 1.5) * .82; k.cheer(t + i * .2); k.rotation.y = .62 + (i - 1.5) * .22; }
      else { k.rest(); k.walk(t * 7 + i, moving && !sit ? 1 : 0); }
      const ud = k.userData; ud.pivL.rotation.x = ud.pivR.rotation.x = sit ? -1.4 : ud.pivL.rotation.x;
    });
    // sky and light shift towards sunset
    // only a hint of sunset, so the scene stays bright and easy to read
    const d = S.dusk * .25;
    W.skyStops = lerpStops(DAY, DUSK, d);
    W.sun.color.setHex(mixHex(0xfff1d8, 0xffa060, d)); W.sun.intensity = 3.5 - d * 1.3;
    W.hemi.intensity = 1.15 - d * .35; W.hemi.color.setHex(mixHex(0xd6ecff, 0xffb8c8, d));
    lamp.material.emissive.setHex(mixHex(0x000000, 0xffd060, S.dusk));
    beam.material.opacity = S.dusk * .28; lampGlow.material.opacity = S.dusk; beamPivot.rotation.y = t * 1.3;
    fireGlow.material.opacity = .5 + d * .5 + Math.sin(t * 13) * .1;
    if (Math.random() < .6) fire.spawn({ x: fireAt.x + (Math.random() - .5) * .6, y: fireAt.y + .3, z: fireAt.z + (Math.random() - .5) * .6, vx: (Math.random() - .5) * .3, vy: 1.6 + Math.random(), vz: (Math.random() - .5) * .3, life: .7, grow: -.6, color: pick([0xffd23f, 0xff9f2e, 0xff6a2b], Math.random()), size: .32 });
    fire.update(dt);
    fishA += dt * .5;
    fish.forEach((f, i) => { const a = fishA * (1 + i * .1) + i * 1.3, r = 21 + (i % 3) * 2; f.position.set(Math.cos(a) * r * 1.05, -1.6 - (i % 2) * .8, Math.sin(a) * r * .75); f.rotation.y = -a; });
    boat.position.y = -.2 + Math.sin(t * 1.4) * .08; boat.rotation.z = Math.sin(t * 1.1) * .04;
  });
  W.anchors = { camp: L.at(12, 32, 2), ridge: L.at(31, 23, 1.5), hut: L.at(25, 18, 4), lighthouse: lampTop, team: team[0].position };
  W.team = team; W.S = S;
  return W;
}

/* =========================================================================
   4. Roman Londinium (museum)
   ========================================================================= */
function amphora(c = 0xc8703f) { return group(box(.5, .8, .5, c, 0, .55, 0), box(.36, .2, .36, c, 0, .08, 0), box(.2, .35, .2, c, 0, 1.1, 0), box(.5, .08, .1, mixHex(c, 0x000000, .2), 0, 1.15, 0)); }
function stall(awn = 0xd94a3a, goods = [0xd9a35a, 0xc8703f, 0x8fbf4a]) {
  const g = group(box(2.6, .9, 1.2, 0x9b6a3c, 0, .45, 0), box(.12, 2.2, .12, 0x7a5232, -1.2, 1.1, -.5), box(.12, 2.2, .12, 0x7a5232, 1.2, 1.1, -.5), box(.12, 2.2, .12, 0x7a5232, -1.2, 1.1, .5), box(.12, 2.2, .12, 0x7a5232, 1.2, 1.1, .5));
  for (let i = 0; i < 5; i++) { const s = box(.56, .1, 1.6, i % 2 ? 0xffffff : awn, -1.12 + i * .56, 2.25, .1); s.rotation.x = .18; g.add(s); }
  goods.forEach((c, i) => g.add(box(.5, .3, .5, c, -.8 + i * .8, 1.05, 0)));
  return g;
}
function romeWorld() {
  const L = new Land(56, 28, 42, 10);
  const W = new World({
    sky: [[0, 0x7cc4f5], [.6, 0xc4e6fa], [1, 0xfff4e2]], fog: [0xf1ead8, 160, 290], hemi: [0xe6f0ff, 0x6a5840, 1.15], sun: [0xfff0d2, 3.6], sunDir: [-.5, .85, .8], shadow: 34,
    center: [0, -1.5, 0], cam: { az: .58, el: .62, dist: 112, fov: 24 }
  });
  const rz = x => 31 + Math.sin(x * .13) * 1.3;
  const inRiver = (x, z) => Math.abs(z + .5 - rz(x)) < 3.2;
  const STONE_W = [0xe9e1cf, 0xe0d7c2, 0xf0e9d9];
  L.island({
    cx: 28, cz: 21, rx: 27.5, rz: 20.5, seed: 21, depth: 10, wobble: .22,
    height: (x, z) => { if (inRiver(x, z)) return -2; if (z > rz(x) + 3) return Math.round(fbm(x * .15, z * .15, 3) * 1.2 - .2); return z < 13 && x > 19 && x < 37 ? 0 : 0; },
    surface: (x, y, z, h) => {
      const r = hash(x, y, z, 3);
      if (y === h) {
        if (inRiver(x, z)) return mixHex(0x8f7d58, 0x75684a, r);
        if (z > rz(x) + 3) return ground(x, y, z, h, { seed: 2 });
        const road = (z >= 18 && z <= 19) || (x >= 27 && x <= 28 && z < 26);
        if (road) return mixHex(0xb9b3a7, 0xa39d91, r);
        if (x >= 34 && x <= 45 && z >= 14 && z <= 24) return (x + z) % 2 ? 0xd9d1bf : 0xcfc6b2;  // forum paving
        return mixHex(0x8fcf63, 0x7cc256, r);
      }
      return ground(x, y, z, h, { seed: 5 });
    }
  });
  const g = L.g, glass = new Grid(L.W, L.H, L.D), T = (x, z) => L.h(x, z) + 1, y0 = L.base + 1;
  // city wall with red tile bands, and a gate
  for (let x = 3; x <= 52; x++) for (let z = 1; z <= 2; z++) { if (L.h(x, z) < -900) continue; for (let y = 0; y < 5; y++) if (!(x >= 26 && x <= 29 && y < 3)) g.set(x, y0 + y, z, y === 2 ? 0xb5503a : hash(x, y, z) < .5 ? 0xd2c8b0 : 0xc4b99f); if (x % 3 === 0) g.set(x, y0 + 5, z === 1 ? 1 : 1, 0xc9bfa5); }
  g.box(25, y0, 1, 25, y0 + 6, 3, 0xd8cdb4); g.box(30, y0, 1, 30, y0 + 6, 3, 0xd8cdb4);
  // temple: podium, steps, columns, roof
  g.box(21, y0, 4, 34, y0 + 1, 12, (x, y, z) => pick(STONE_W, hash(x, y, z)));
  for (let k = 0; k < 2; k++) g.box(23, y0 + k, 13 + (1 - k), 32, y0 + k, 13 + (1 - k), 0xe2d9c4);
  g.box(23, y0 + 2, 5, 32, y0 + 7, 9, 0xefe6d3);
  for (let x = 22; x <= 33; x += 2) for (let y = 2; y <= 7; y++) g.set(x, y0 + y, 11, y === 2 || y === 7 ? 0xe2d9c4 : 0xf8f4ea);
  for (let z = 5; z <= 11; z += 2) for (let y = 2; y <= 7; y++) { g.set(22, y0 + y, z, 0xf8f4ea); g.set(33, y0 + y, z, 0xf8f4ea); }
  g.box(21, y0 + 8, 4, 34, y0 + 8, 12, 0xe2d9c4);
  for (let k = 0; k < 5; k++) {
    const za = 4 + k, zb = 12 - k, yy = y0 + 9 + k; if (za > zb) break;
    g.box(20, yy, za, 35, yy, za, k % 2 ? 0xb34d33 : 0xc4573a); g.box(20, yy, zb, 35, yy, zb, k % 2 ? 0xb34d33 : 0xc4573a);
    if (za + 1 <= zb - 1) g.box(21, yy, za + 1, 34, yy, zb - 1, 0xf3ecdc);
  }
  // houses along the main street
  const HC = [[0xf3e6cf, 0xc4573a], [0xe9cf9a, 0xb34d33], [0xf6efe4, 0xc4573a], [0xe7c79a, 0xa94632]];
  [[5, 6, 6, 5], [12, 6, 6, 5], [6, 21, 7, 5], [14, 21, 6, 5], [38, 6, 6, 5], [46, 6, 5, 6], [46, 15, 6, 6], [38, 26 - 6, 0, 0]].forEach(([x, z, w, d], i) => {
    if (!w) return;
    const [wall, roof] = HC[i % 4];
    house(g, glass, x, y0, z, w, d, 4, { wall, wall2: mixHex(wall, 0xffffff, .3), roof, roof2: mixHex(roof, 0x000000, .12), trim: 0xb39a78, door: 0x7a4a2a, win: 0x3b2a20 });
  });
  // bakery oven (dome)
  for (let y = 0; y <= 2; y++) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) if (x * x + y * y * 1.4 + z * z <= 5.2) g.set(21 + x, y0 + y, 24 + z, y === 0 && z === 2 && x === 0 ? 0x2a1a12 : 0xc98a5a);
  // wharf planks along the north bank
  for (let x = 6; x <= 44; x++) { const zw = Math.floor(rz(x) - 3.2); for (let z = zw - 1; z <= zw + 1; z++) if (L.h(x, z) > -900) { g.set(x, L.base, z, (x % 2) ? 0xb3855a : 0xc49563); g.set(x, L.base - 1, z, -1); } }
  L.mesh(W, { occ: [glass] });
  L.mesh(W, { grid: glass, occ: [g], jitter: .02 });
  // river
  const time = { value: 0 }, cells = [];
  for (let z = 0; z < L.D; z++) for (let x = 0; x < L.W; x++) if (inRiver(x, z) && L.h(x, z) > -900) cells.push({ x: L.wx(x), z: L.wz(z), depth: clamp(1 - Math.abs(z + .5 - rz(x)) / 3.2) });
  W.prop(water(cells, { level: -.35, deep: 0x2b7fae, shallow: 0x67c4c9, time }), 1.4);
  // waterfalls where the river leaves the island
  const falls = new Particles(140, { size: .3 }); W.root.add(falls.mesh);
  const fallAt = [];
  for (const x of [0, L.W - 1]) { let xx = x; const dir = x ? -1 : 1; while (L.h(xx, Math.round(rz(xx))) < -900 && Math.abs(xx - x) < 12) xx += dir; fallAt.push([L.wx(xx) - dir * .6, L.wz(rz(xx) - .5)]); }
  // bridge
  const br = []; for (let i = -5; i <= 5; i++) br.push({ x: L.wx(48), y: .2, z: L.wz(rz(48) + i * .82), w: 2.6, h: .24, d: .7, c: i % 2 ? 0xa97b4f : 0x9a6d44, k: (i + 5) / 10 });
  for (let i = -4; i <= 4; i += 2) br.push({ x: L.wx(47) - .2, y: -.6, z: L.wz(rz(48) + i * .82), w: .25, h: 1.8, c: 0x6b4a30 }, { x: L.wx(49) + .2, y: -.6, z: L.wz(rz(48) + i * .82), w: .25, h: 1.8, c: 0x6b4a30 });
  W.root.add(new Tiles(br, { drop: 0 }).mesh);
  // the ship
  const ship = group(box(2.4, 1, 7, 0x8a5a34, 0, .2, 0), box(2.6, .3, 7.2, 0x6b4428, 0, .75, 0), box(1.6, .6, 1.4, 0x8a5a34, 0, .9, 3.4), box(.25, 6, .25, 0x6b4428, 0, 3.6, -.4), box(3.8, 3.4, .12, 0xf6ead2, 0, 4.1, -.2), box(3.82, .7, .14, 0xc23a2a, 0, 4.6, -.2));
  ship.rotation.y = Math.PI / 2; ship.position.set(L.wx(35), -.3, L.wz(rz(35) + .6)); W.prop(ship, 1.9);
  // crane, amphorae, crates on the wharf
  const crane = group(box(.3, 5, .3, 0x7a5232, 0, 2.5, 0), box(.25, .25, 4, 0x7a5232, 0, 4.8, 1.2), box(.06, 2, .06, 0x3a2a20, 0, 3.8, 3), box(.7, .5, .7, 0xb3855a, 0, 2.6, 3));
  crane.position.copy(L.at(14, Math.floor(rz(14) - 3.2))); crane.rotation.y = .3; W.prop(crane, 2);
  const amphs = [];
  for (let i = 0; i < 7; i++) { const a = amphora(i % 3 ? 0xc8703f : 0xb85f33); a.position.copy(L.at(19 + (i % 4) * .8, Math.floor(rz(19) - 3.6))).add(new THREE.Vector3(0, i > 3 ? .9 : 0, i > 3 ? .3 : 0)); a.rotation.y = i; W.prop(a, 2.1 + i * .03); amphs.push(a); }
  [[24, .0], [25, .3]].forEach(([x], i) => { const c = box(.9, .8, .9, 0xa97b4f); c.position.copy(L.at(x, Math.floor(rz(x) - 3.6), .4)); W.prop(c, 2.2); });
  // market stalls in the forum
  [[36, 16, 0xd94a3a], [40, 16, 0x2f6fd6], [36, 22, 0xe8b04b], [43, 21, 0x3a9a5a]].forEach(([x, z, c], i) => { const s = stall(c); s.position.copy(L.at(x, z)); s.rotation.y = i % 2 ? Math.PI : 0; W.prop(s, 2 + i * .05); });
  // cypress and oak trees
  const trees = new Grid(L.W, L.H, L.D);
  [[19, 6], [36, 6], [19, 11], [36, 11]].forEach(([x, z]) => { trees.set(x, y0, z, 0x6b4a32); for (let y = 1; y <= 7; y++) { const r = y >= 2 && y <= 5 ? 1 : 0; for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dz) <= r) trees.set(x + dx, y0 + y, z + dz, (y + dx + dz) % 2 ? 0x2f6b3e : 0x3a7d48); } });
  [[8, 37], [20, 38], [34, 39], [44, 37]].forEach(([x, z], i) => L.h(x, z) > -900 && oak(trees, x, T(x, z), z, { r: 2, trunk: 2, seed: 30 + i }));
  L.mesh(W, { grid: trees, occ: [g] });
  // people in tunics
  const TUN = [0xd9534f, 0x5b8def, 0xe8c547, 0xf2efe6, 0x7a5cc4, 0x3aa37a];
  const people = TUN.map((c, i) => { const k = kid({ shirt: c, pants: kid.skins[[1, 2, 0, 3, 1, 4][i]], skin: kid.skins[[1, 2, 0, 3, 1, 4][i]], hair: [0x2b1d14, 0x1a1a1a, 0x7a3a1a, 0xe0b060, 0x3b2a20, 0x1a1a1a][i], tunic: true, long: i % 3 === 1 }); k.scale.setScalar(.88); W.root.add(k); return k; });
  // feast table (what the AI imagined) and evidence pins (what children check)
  const feast = group(box(5.5, .2, 2, 0x8a5a34, 0, .9, 0), box(5.7, .08, 2.2, 0x6a2a8a, 0, 1.02, 0), box(.2, .9, .2, 0x6b4428, -2.5, .45, -.8), box(.2, .9, .2, 0x6b4428, 2.5, .45, .8), box(.2, .9, .2, 0x6b4428, -2.5, .45, .8), box(.2, .9, .2, 0x6b4428, 2.5, .45, -.8));
  const peacock = group(box(.5, .5, .8, 0x1f5fbf, 0, .3, 0), box(.2, .5, .2, 0x1f5fbf, 0, .7, .35), box(1.6, 1.2, .1, 0x1aa37a, 0, .8, -.45), box(1.2, .8, .11, 0x2fd0c0, 0, .8, -.46));
  peacock.position.set(-1.2, 1.06, 0); feast.add(peacock);
  [[.6, 0xe8c547], [1.3, 0x8a3a8a], [2, 0xd9d1bf]].forEach(([x, c]) => feast.add(box(.5, .3, .5, c, x, 1.2, 0)));
  for (let i = 0; i < 4; i++) feast.add(box(.3, .1, .3, 0xbfb8aa, -2.2 + i * .35, 1.12, .6));
  feast.position.copy(L.at(40, 19)); W.root.add(feast);
  const pins = [L.at(20, Math.floor(rz(20) - 3.6), 2.6), L.at(21, 24, 3.6), L.at(16, Math.floor(rz(16) - 3.2), 1.6)].map(p => { const pin = group(box(.6, .6, .6, 0xffc83d), box(.2, .7, .2, 0xffc83d, 0, -.65, 0)); pin.children[0].rotation.set(.6, .6, 0); pin.position.copy(p); pin.userData.base = p.clone(); pin.userData.on = 0; W.root.add(pin); return pin; });
  const shells = []; for (let i = 0; i < 9; i++) shells.push({ x: L.wx(16) + (hash(i, 1) - .5) * 1.6, y: L.top(16, Math.floor(rz(16) - 3.2)) + .08, z: L.wz(Math.floor(rz(16) - 3.2)) + (hash(i, 2) - .5) * 1.2, w: .4, h: .12, d: .3, c: i % 2 ? 0xbdb8ae : 0xd8d3c8, ry: hash(i, 3) * 3 });
  W.root.add(new Tiles(shells, { drop: 0 }).mesh);
  const smoke = new Particles(50, { size: .4 }); W.root.add(smoke.mesh);
  const ovenTop = L.at(21, 24, 2.4);
  const S = { mode: 'start', feast: 0, pins: 0, modern: 0 };
  W.setState = (mode, instant) => { S.mode = mode; if (instant) { S.feast = mode === 'feast' || mode === 'modern' ? 1 : 0; S.pins = mode === 'evidence' ? 1 : 0; S.modern = mode === 'modern' ? 1 : 0; } W.state = mode; };
  W.setState('start', true);
  const walkers = [[[27.5, 6], [27.5, 24]], [[6, 18.5], [24, 18.5]], [[30, 18.5], [50, 18.5]], [[34, 15], [45, 23]], [[10, 26], [40, 26]], [[38, 26], [12, 26]]];
  W.tick((t, dt) => {
    time.value = t;
    const ft = S.mode === 'feast' || S.mode === 'modern' ? 1 : 0, pt = S.mode === 'evidence' ? 1 : 0, mt = S.mode === 'modern' ? 1 : 0;
    S.feast += (ft - S.feast) * Math.min(1, dt * 4); S.pins += (pt - S.pins) * Math.min(1, dt * 4); S.modern += (mt - S.modern) * Math.min(1, dt * 4);
    extras(t, dt);
    const fs = S.feast < .02 ? .001 : S.feast * 2.2; feast.scale.setScalar(fs); feast.visible = S.feast > .02;
    pins.forEach((p, i) => { const s = clamp(S.pins * 1.5 - i * .25); p.visible = s > .02; p.scale.setScalar(Math.max(.001, s)); p.position.y = p.userData.base.y + Math.sin(t * 3 + i) * .2; p.rotation.y = t * 1.5; });
    people.forEach((k, i) => {
      const [a, b] = walkers[i], u = (Math.sin(t * .12 + i * 1.7) + 1) / 2, x = lerp(a[0], b[0], u), z = lerp(a[1], b[1], u);
      const dir = Math.cos(t * .12 + i * 1.7) > 0 ? 1 : -1;
      const workers = S.mode === 'evidence' && i >= 4;
      if (workers) { const p = L.at(22 + (i - 4) * 1.6, Math.floor(rz(22) - 3.4)); k.position.copy(p); k.rotation.y = 0; k.walk(0, 0); k.userData.par.rotation.x = -1.2 + Math.sin(t * 3 + i) * .2; }
      else { k.position.set(L.wx(x), L.top(Math.floor(x), Math.floor(z)), L.wz(z)); k.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) + (dir > 0 ? 0 : Math.PI); k.walk(t * 6 + i, 1); }
    });
    if (Math.random() < .25) smoke.spawn({ x: ovenTop.x, y: ovenTop.y, z: ovenTop.z, vx: .2, vy: 1.1, vz: -.1, drag: .3, life: 2.2, grow: 2.5, color: pick([0xf2f0ec, 0xe2dfda], Math.random()), size: .35 });
    smoke.update(dt);
    ship.position.y = -.3 + Math.sin(t * 1.2) * .08; ship.rotation.z = Math.sin(t * .9) * .03;
  });
  // ---- the demo's bigger moments: a banquet, foods from much later, dig pits, and check marks ----
  const pop = (o, k) => { o.visible = k > .02; o.scale.setScalar(Math.max(.001, k)); };
  // a banquet: guests in togas round the feast, torches and gold plates
  const banquet = new THREE.Group(); banquet.position.copy(L.at(40, 19)); W.root.add(banquet);
  [[-3.4, -1.6], [-1.2, -1.9], [1.2, -1.9], [3.4, -1.6], [-3.4, 1.6], [3.4, 1.6]].forEach(([x, z], i) => {
    const g = kid({ shirt: [0x6a2a8a, 0xf2efe6, 0xc9a227, 0xf2efe6, 0x6a2a8a, 0xc9a227][i], pants: 0xf2efe6, skin: kid.skins[i % 5], hair: [0x2b1d14, 0xe0b060, 0x1a1a1a, 0x7a3a1a, 0x3b2a20, 0x2b1d14][i], tunic: true, long: i % 2 === 0 });
    g.scale.setScalar(.95); g.position.set(x, 0, z); g.rotation.y = z < 0 ? 0 : Math.PI; banquet.add(g);
  });
  for (const [x, z] of [[-4.6, 0], [4.6, 0]]) { banquet.add(box(.25, 2.6, .25, 0x6b4428, x, 1.3, z)); const fl = glow(0xffb040, 2.4, .9); fl.position.set(x, 2.8, z); banquet.add(fl); banquet.add(box(.45, .45, .45, 0xffc040, x, 2.75, z)); }
  for (let i = 0; i < 6; i++) banquet.add(box(.5, .08, .5, 0xe8c547, -2.4 + i * .95, 1.1, i % 2 ? .55 : -.55));
  // foods that only reached Britain much later, piled big on the market
  const modern = new THREE.Group(); modern.position.copy(L.at(38, 21)); W.root.add(modern);
  const tomatoes = new THREE.Group(); tomatoes.add(box(2.2, .9, 1.6, 0x9a6d44, 0, .45, 0));
  for (let i = 0; i < 9; i++) tomatoes.add(box(.62, .62, .62, i % 3 ? 0xe23a2a : 0xf05a3a, -.75 + (i % 3) * .75, 1.15 + Math.floor(i / 3) * .1, -.5 + Math.floor(i / 3) * .5), box(.2, .14, .2, 0x3a9a3a, -.75 + (i % 3) * .75, 1.52, -.5 + Math.floor(i / 3) * .5));
  const potatoes = new THREE.Group();
  for (let i = 0; i < 3; i++) potatoes.add(box(1.1, 1.3, 1.1, 0xc9a86a, i * 1.25 - 1.25, .65, 0), box(.9, .25, .9, 0x8a6a3a, i * 1.25 - 1.25, 1.42, 0));
  for (let i = 0; i < 5; i++) potatoes.add(box(.42, .34, .5, 0xb8894e, -1.5 + i * .7, .17, 1));
  potatoes.position.set(-.5, 0, 3.4);
  const choc = group(box(1.3, 1.6, 1.3, 0xf3ecdc, 0, .8, 0), box(1.05, .12, 1.05, 0x5a3220, 0, 1.58, 0), box(.25, .8, .5, 0xf3ecdc, .8, .9, 0), box(.1, .1, .1, 0xffffff, 0, 2, 0));
  choc.position.set(3.4, 0, 1.2);
  tomatoes.position.set(0, 0, -.6);
  modern.add(tomatoes, potatoes, choc);
  const steam = new Particles(30, { size: .35 }); W.root.add(steam.mesh);
  // dig pits where the finds come out of the ground
  const pits = [];
  for (const [x, z] of [[20, Math.floor(rz(20) - 4.6)], [19, 22], [15, Math.floor(rz(15) - 4.4)]]) {
    const p = group(box(2.4, .12, 2.4, 0x5a3a24, 0, .02, 0), box(2.6, .3, .25, 0x8a6a46, 0, .15, 1.2), box(2.6, .3, .25, 0x8a6a46, 0, .15, -1.2), box(.25, .3, 2.6, 0x8a6a46, 1.2, .15, 0), box(.25, .3, 2.6, 0x8a6a46, -1.2, .15, 0), box(.12, 1.4, .12, 0xd8cdb4, 1.3, .7, 1.3), box(.12, 1.4, .12, 0xd8cdb4, -1.3, .7, -1.3));
    p.position.copy(L.at(x, z)); W.root.add(p); pits.push(p);
  }
  // the find rising out of each pit: an olive oil jar, a loaf of bread, a pile of oyster shells
  [amphora(0xc8703f), group(box(1, .45, .7, 0xc98a4a, 0, .22, 0), box(.8, .2, .5, 0xe0a860, 0, .5, 0)), group(...[0, 1, 2, 3, 4].map(i => box(.42, .12, .32, i % 2 ? 0xbdb8ae : 0xe8e4dc, (i % 3 - 1) * .35, .06 + Math.floor(i / 3) * .13, (i % 2 - .5) * .3)))].forEach((f, i) => { pits[i].add(f); pits[i].userData.find = f; });
  // big floating marks over each claim: a tick, a cross or a question mark
  const MARKC = { good: ['#1fb45f', '✓'], bad: ['#ff4d4d', '✗'], unknown: ['#f0a030', '?'] };
  const markTex = {};
  const markOf = v => {
    if (!markTex[v]) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.fillStyle = MARKC[v][0]; x.beginPath(); x.arc(64, 64, 50, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '900 70px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(MARKC[v][1], 64, 68); markTex[v] = new THREE.CanvasTexture(c); markTex[v].colorSpace = THREE.SRGBColorSpace; }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex[v], depthTest: false, transparent: true })); sp.renderOrder = 10; return sp;
  };
  const marks = [];
  W.mark = (anchor, verdict) => { const sp = markOf(verdict); sp.position.copy(W.anchors[anchor]).add(new THREE.Vector3(marks.filter(m => m.anchor === anchor).length * 3, 3.4, 0)); sp.scale.setScalar(.01); W.root.add(sp); marks.push({ sp, anchor, born: -1 }); };
  W.clearMarks = () => { marks.forEach(m => W.root.remove(m.sp)); marks.length = 0; };
  const chocTop = new THREE.Vector3();
  function extras(t, dt) {
    pop(banquet, S.feast > .02 ? Math.min(1, S.feast * 1.2) * 1.5 : 0);
    banquet.children.forEach((c, i) => { if (c.userData && c.userData.par) c.userData.par.rotation.x = -.6 + Math.sin(t * 4 + i) * .4; });
    pop(modern, S.modern * 1.8); tomatoes.position.y = Math.sin(t * 2) * .05;
    pits.forEach((p, i) => { const k = clamp(S.pins * 1.6 - i * .2); pop(p, k * 1.5); const f = p.userData.find; f.position.y = .4 + k * (1.6 + Math.sin(t * 2 + i) * .15); f.rotation.y = t * .8 + i; });
    if (S.modern > .5 && Math.random() < .4) { choc.getWorldPosition(chocTop); steam.spawn({ x: chocTop.x, y: chocTop.y + 1.8, z: chocTop.z, vx: (Math.random() - .5) * .2, vy: .9, vz: 0, drag: .3, life: 1.6, grow: 2, color: 0xffffff, size: .3 }); }
    steam.update(dt);
    marks.forEach(m => { if (m.born < 0) m.born = t; const k = clamp((t - m.born) * 4); m.sp.scale.setScalar(2.8 * (k < 1 ? 1.25 - .25 * k : 1) * k + .001); m.sp.position.y += Math.sin(t * 3) * .004; });
  }
  W.anchors = { feast: L.at(40, 19, 3.2), temple: L.at(27, 8, 12), amphorae: pins[0].userData.base, bakery: pins[1].userData.base, oysters: pins[2].userData.base, ship: L.at(35, 31, 5), wharf: L.at(20, 26, 1), tomatoes: L.at(38, 20, 2.6), potatoes: L.at(37, 24, 2.4), chocolate: L.at(41, 22, 3) };
  return W;
}

/* =========================================================================
   5. Eco Town (the playable demo): power, people and planet over 24 hours
   ========================================================================= */
const NIGHT = [0x0a1230, 0x18265a, 0x24306a, 0x2f3c78], DAWN = [0x4a6fb8, 0xc99aa8, 0xf3a98a, 0xffd9a8], NOON = [0x5bb8ff, 0x8fcfff, 0xaee0ff, 0xe9f7ff], EVE = [0x2f3f8f, 0xd66a8a, 0xffa66b, 0xffd39a];
const SKY_KEYS = [[0, NIGHT, 1], [5, NIGHT, 1], [6.5, DAWN, .35], [9, NOON, 0], [16.5, NOON, 0], [18.5, EVE, .45], [20, NIGHT, 1], [24, NIGHT, 1]];
const OFFS = [0, .5, .8, 1];
export function skyAt(h) {
  h = ((h % 24) + 24) % 24;
  let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1][0] <= h) i++;
  const [h0, s0, n0] = SKY_KEYS[i], [h1, s1, n1] = SKY_KEYS[i + 1], k = smooth(0, 1, (h - h0) / (h1 - h0 || 1));
  return { stops: OFFS.map((o, j) => [o, mixHex(s0[j], s1[j], k)]), night: lerp(n0, n1, k) };
}
function turbine() {
  const blades = new THREE.Group();
  for (let i = 0; i < 3; i++) { const b = box(.34, 4.2, .12, 0xffffff, 0, 2.1, 0); const p = group(b); p.rotation.z = i * Math.PI * 2 / 3; blades.add(p); }
  blades.add(box(.5, .5, .5, 0xe9eef2));
  blades.position.set(0, 9.2, .55);
  const g = group(box(.5, 9, .5, 0xf4f6f8, 0, 4.5, 0), box(.7, .7, 1.4, 0xe2e7eb, 0, 9.2, 0), blades);
  g.userData.blades = blades;
  return g;
}
function townWorld() {
  const L = new Land(54, 30, 42, 11);
  const W = new World({
    sky: skyAt(18).stops, fog: [0xdbe9f7, 170, 300], hemi: [0xd6ecff, 0x5a5040, 1.15], sun: [0xfff0d4, 3.4], sunDir: [-.5, .85, .8], shadow: 34,
    center: [0, 1.5, 0], cam: { az: .62, el: .56, dist: 124, fov: 24, sway: .03 }
  });
  const ROADS = (x, z) => (z >= 24 && z <= 25 && x > 6 && x < 50) || (x >= 27 && x <= 28 && z > 14 && z < 38);
  const lakeD = (x, z) => Math.hypot((x + .5 - 10) / 6.5, (z + .5 - 31) / 5);
  L.island({
    cx: 27, cz: 21, rx: 27, rz: 20.5, seed: 31, depth: 10, wobble: .24,
    height: (x, z) => {
      if (lakeD(x, z) < 1) return -1 - Math.round(1.5 * (1 - lakeD(x, z)));
      const hill = 5.5 * smooth(0, 1, (15 - z) / 9) * (.75 + .35 * noise(x * .12, z * .1, 2));
      return Math.round(hill + (z > 15 ? 0 : fbm(x * .15, z * .15, 3) * .8));
    },
    surface: (x, y, z, h) => {
      if (y === h && lakeD(x, z) < 1) return mixHex(0x9b8a5c, 0x6f6a45, .5);
      if (y === h && ROADS(x, z)) return mixHex(0x6b7077, 0x5d6268, hash(x, z));
      if (y === h && lakeD(x, z) < 1.25) return 0xd9cf9e;
      return ground(x, y, z, h, { seed: 7 });
    }
  });
  const g = L.g, glass = new Grid(L.W, L.H, L.D), T = (x, z) => L.h(x, z) + 1;
  // houses
  const HOUSES = [[8, 17, 0xf3e6cf, 0xd9583f], [15, 17, 0xdfeaf2, 0x3f5f8a], [31, 17, 0xf6efe4, 0xd9583f], [38, 17, 0xf0dcc0, 0x56606b], [45, 18, 0xe8f0e6, 0x3f7f5c],
    [15, 27, 0xf3e6cf, 0x56606b], [21, 27, 0xf8e1d6, 0xd9583f], [31, 27, 0xdfeaf2, 0xd9583f], [37, 27, 0xf3e6cf, 0x3f5f8a], [21, 33, 0xf0dcc0, 0x3f7f5c], [31, 33, 0xf6efe4, 0x56606b], [37, 33, 0xe8f0e6, 0xd9583f]];
  const roofs = [];
  HOUSES.forEach(([x, z, wall, roof], i) => {
    if (L.h(x, z) < -900) return;
    const y = T(x, z), w = 5, d = 4, hh = 3 + (i % 3 === 0 ? 1 : 0);
    house(g, glass, x, y, z, w, d, hh, { wall, wall2: mixHex(wall, 0x000000, .04), roof, roof2: mixHex(roof, 0x000000, .1), trim: 0xffffff, win: 0x2f4256 });
    roofs.push({ x, z, y: y + hh, w, d });
  });
  // gas plant (east) and battery (by the road)
  const GP = { x: 46, z: 26 }, gy = T(GP.x, GP.z);
  g.box(GP.x - 2, gy, GP.z - 2, GP.x + 3, gy + 3, GP.z + 3, (x, y) => (y === gy + 3 ? 0x8d949b : 0xb3bac1));
  g.box(GP.x + 1, gy + 4, GP.z, GP.x + 2, gy + 9, GP.z + 1, (x, y) => (y >= gy + 8 ? 0xd9534f : 0xc9ced3));
  const BT = { x: 21, z: 20 }, by = T(BT.x, BT.z);
  g.box(BT.x, by, BT.z, BT.x + 3, by + 2, BT.z + 2, 0x2c3e50); g.box(BT.x, by + 3, BT.z, BT.x + 3, by + 3, BT.z + 2, 0x16ffc6);
  // trees
  [[4, 24], [6, 13], [12, 9], [23, 37], [44, 34], [49, 14], [41, 11], [18, 11], [26, 40], [47, 21]].forEach(([x, z], i) => { if (L.h(x, z) > -900 && !ROADS(x, z)) (i % 3 ? oak : pine)(g, x, T(x, z), z, i % 3 ? { r: 2, trunk: 2, seed: i } : { h: 6 }); });
  L.mesh(W, { occ: [glass] });
  const win = L.mesh(W, { grid: glass, occ: [g], jitter: .01 });
  win.material.emissive = new THREE.Color(0x000000);
  // water
  const time = { value: 0 }, cells = [];
  for (let z = 0; z < L.D; z++) for (let x = 0; x < L.W; x++) if (lakeD(x, z) < 1 && L.h(x, z) > -900) cells.push({ x: L.wx(x), z: L.wz(z), depth: clamp((1 - lakeD(x, z)) * 1.5) });
  W.prop(water(cells, { level: -.3, deep: 0x1d7cc4, shallow: 0x56cbd6, time }), 1.4);
  // solar panels on roofs
  const sp = [];
  roofs.forEach((r, i) => { if (i % 4 === 3) return; for (let k = 0; k < 2; k++) sp.push({ x: L.wx(r.x + 1 + k * 2), y: L.wy(r.y + 2) + .14, z: L.wz(r.z + 3.5), w: 1.8, h: .12, d: 1.8, c: 0x2a4fa8, rx: .785, k: i / roofs.length }); });
  // each power source sits in its own group, so the demo can show only what the child chose
  const panelSet = new THREE.Group(), turbineSet = new THREE.Group(); W.root.add(panelSet, turbineSet);
  const panels = new Tiles(sp, { drop: 1 }); panelSet.add(panels.mesh);
  // turbines on the hill
  const turbines = [[9, 5], [16, 4], [23, 3], [30, 4], [37, 5], [44, 7]].map(([x, z], i) => { const t = turbine(); t.position.copy(L.at(x, z)); t.rotation.y = .5; W.prop(t, 1.8 + i * .08); turbineSet.add(t); return t; });
  // streetlights along the main road
  const lamps = [];
  for (let x = 9; x < 50; x += 6) {
    const p = group(box(.16, 3, .16, 0x50565d, 0, 1.5, 0), box(.7, .14, .2, 0x50565d, .3, 3, 0));
    const head = box(.36, .16, .3, 0xfff1c0, .6, 2.9, 0, { emissive: 0x000000 }); p.add(head);
    p.position.copy(L.at(x, 23)); W.prop(p, 2);
    const gl = glow(0xffd77a, 3.2, 0); gl.position.copy(p.position).add(new THREE.Vector3(.6, 2.8, 0)); W.root.add(gl);
    lamps.push({ head, gl });
  }
  // window glows (one sprite per house) for the night view
  const hglow = roofs.map(r => { const s = glow(0xffc76a, 9, 0); s.position.set(L.wx(r.x + 2), L.wy(r.y - 1), L.wz(r.z + 2)); W.root.add(s); return s; });
  // smoke and battery glow
  const smoke = new Particles(80, { size: .5 }); W.root.add(smoke.mesh);
  const chimney = new THREE.Vector3(L.wx(GP.x + 1.5), L.wy(gy + 10.2), L.wz(GP.z + .5));
  const batGlow = glow(0x16ffc6, 6, 0); batGlow.position.set(L.wx(BT.x + 1.5), L.wy(by + 4), L.wz(BT.z + 1)); W.root.add(batGlow);
  const batBars = [0, 1, 2, 3].map(i => { const b = box(.5, .5, .1, 0x16ffc6, 0, 0, 0, { emissive: 0x0a6b55 }); b.position.set(L.wx(BT.x) + .2 + i * .78, L.wy(by + 1.6), L.wz(BT.z + 2.55)); W.root.add(b); return b; });
  // cars
  const cars = [0xff6a4a, 0x3fa7ff].map(c => { const car = group(box(1.1, .55, 2, c, 0, .45, 0), box(.95, .45, 1, 0xdff4ff, 0, .95, -.1), box(1.15, .3, .3, 0x222222, 0, .25, .65), box(1.15, .3, .3, 0x222222, 0, .25, -.65)); const hl = glow(0xfff4c0, 2.2, 0); hl.position.set(0, .6, 1.2); car.add(hl); car.userData.hl = hl; W.root.add(car); return car; });
  const people = [0xff6b4a, 0x3fa7ff, 0xffc83d].map((c, i) => { const k = kid({ shirt: c, skin: kid.skins[i + 1], hair: [0x2b1d14, 0xe0b060, 0x1a1a1a][i], long: i === 1 }); k.scale.setScalar(.85); W.root.add(k); return k; });

  const S = { hour: 18, night: 0, lit: 1, gas: 0, wind: 30, bat: 0, level: 0, blackout: 0, panels: 1, tgt: { lit: 1, gas: 0, bat: 0, level: 0, blackout: 0 } };
  W.setHour = hf => { S.hour = hf; };
  // power: {lit, gas, battery: 1 charge / -1 use / 0, level 0..1, blackout, wind}
  W.setPower = p => { Object.assign(S.tgt, p); if (p.wind != null) S.wind = p.wind; };
  W.setState = () => {};
  // which power sources are built: the demo shows only what the child chose
  W.setKit = ({ turbines: tOn = true, panels: pOn = true } = {}) => { turbineSet.visible = tOn; panelSet.visible = pOn; };
  W.setPower({ lit: 1, gas: 0, bat: 0, level: .2, blackout: 0 });
  const sunV = new THREE.Vector3();
  W.tick((t, dt) => {
    time.value = t;
    const k = Math.min(1, dt * 5);
    for (const key of ['lit', 'gas', 'bat', 'level', 'blackout']) S[key] += (S.tgt[key] - S[key]) * k;
    const sky = skyAt(S.hour); W.skyStops = sky.stops; S.night = sky.night;
    // sun swings across the sky; at night a dim blue moon light
    const a = (S.hour - 6) / 12 * Math.PI, day = clamp(Math.sin(a) * 1.4);
    sunV.set(-Math.cos(a) * .9, Math.max(.25, Math.sin(a)), .55).normalize();
    if (day <= .05) sunV.set(.4, .9, .6).normalize();
    W.sunDir.copy(sunV);
    W.sun.color.setHex(day > .05 ? mixHex(0xffa060, 0xfff0d4, clamp(Math.sin(a) * 2)) : 0x9fb6ff);
    W.sun.intensity = day > .05 ? .8 + day * 2.6 : .9;
    W.hemi.intensity = .62 + (1 - S.night) * .58;
    W.hemi.color.setHex(mixHex(0xd6ecff, 0x6a7cc0, S.night));
    const n = S.night, on = S.lit * (1 - S.blackout);
    win.material.emissive.setHex(mixHex(0x000000, 0xffc65a, n * on * 1.6 > 1 ? 1 : n * on * 1.6));
    hglow.forEach((s, i) => (s.material.opacity = n * on * (.5 + (i % 3) * .08)));
    lamps.forEach(l => { l.gl.material.opacity = n * on * .9; l.head.material.emissive.setHex(mixHex(0x000000, 0xffd77a, n * on)); });
    turbines.forEach((tb, i) => { tb.userData.blades.rotation.z -= dt * (.4 + S.wind / 10) * (1 + i * .03); });
    if (S.gas > .5 && Math.random() < .7) smoke.spawn({ x: chimney.x + (Math.random() - .5) * .4, y: chimney.y, z: chimney.z + (Math.random() - .5) * .4, vx: .5 + Math.random() * .4, vy: 1.4, vz: -.2, drag: .25, life: 2.6, grow: 2.4, color: pick([0x9aa0a6, 0xb4b9be, 0x7f858b], Math.random()), size: .45 });
    smoke.update(dt);
    batGlow.material.opacity = Math.abs(S.bat) * (.45 + Math.sin(t * 5) * .15) * (.4 + n * .6);
    batBars.forEach((b, i) => { const full = S.level * 4 > i + .5; b.visible = full || (S.bat > .5 && Math.floor(t * 3) % 4 === i); });
    cars.forEach((c, i) => {
      const u = ((t * .045 + i * .5) % 1);
      const path = i ? [[7, 24.5], [49, 24.5]] : [[49, 25.5], [7, 25.5]];
      const [x, z, hd] = along(path, u); c.position.set(L.wx(x - .5), L.ys(x, z) + .02, L.wz(z - .5)); c.rotation.y = hd; c.userData.hl.material.opacity = n * .9;
    });
    people.forEach((p, i) => { const u = (Math.sin(t * .1 + i * 2) + 1) / 2, x = lerp(10, 46, u), z = 22.6 + i * .2, dir = Math.cos(t * .1 + i * 2) > 0; p.position.set(L.wx(x), L.ys(x + .5, z + .5), L.wz(z)); p.rotation.y = dir ? Math.PI / 2 : -Math.PI / 2; p.walk(t * 6 + i, 1); });
  });
  W.paintExtra = (ctx, w, h) => {
    if (S.night < .05) return;
    for (let i = 0; i < 90; i++) { const x = hash(i, 1, 0, 9) * w, y = hash(i, 2, 0, 9) * h * .55; ctx.fillStyle = `rgba(255,255,255,${S.night * (.3 + .5 * Math.abs(Math.sin(i + time.value)))})`; const r = (hash(i, 3, 0, 9) < .15 ? 2 : 1.2) * w / 1000; ctx.fillRect(x, y, r, r); }
    const mx = w * .86, my = h * .15, mr = w * .02, gl = ctx.createRadialGradient(mx, my, mr * .6, mx, my, mr * 3.2);
    gl.addColorStop(0, `rgba(220,230,255,${S.night * .35})`); gl.addColorStop(1, 'rgba(220,230,255,0)');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(mx, my, mr * 3.2, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(244,246,255,${S.night * .95})`; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(200,208,232,${S.night * .6})`; ctx.beginPath(); ctx.arc(mx - mr * .3, my - mr * .2, mr * .22, 0, 7); ctx.arc(mx + mr * .35, my + mr * .3, mr * .15, 0, 7); ctx.fill();
  };
  W.anchors = { battery: batGlow.position, gas: chimney, turbines: L.at(26, 4, 9), town: L.at(27, 27, 4) };
  return W;
}

export const WORLDS = { pond: pondWorld, mars: marsWorld, island: islandWorld, rome: romeWorld, town: townWorld };
