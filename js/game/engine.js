// Voxel game engine for the DeltaOps Learning site.
// One WebGL renderer draws every game view on the page into its own 2D canvas,
// so the page never holds more than one WebGL context.
import * as THREE from '../vendor/three.module.min.js';
export { THREE };

/* ---------- maths ---------- */
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = t => Math.pow(clamp(t), 3);
export const easeInOut = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeBack = t => { t = clamp(t); const c = 1.9, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const pulse = (t, a, b) => smooth(a, a + .25, t) * (1 - smooth(b - .25, b, t));

export function hash(x, y = 0, z = 0, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1103515245) ^ Math.imul(s | 0, 1664525);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function noise(x, z, s = 0) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, 0, zi, s), b = hash(xi + 1, 0, zi, s), c = hash(xi, 0, zi + 1, s), d = hash(xi + 1, 0, zi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, z, s = 0) => noise(x, z, s) * .58 + noise(x * 2.03, z * 2.03, s + 7) * .29 + noise(x * 4.1, z * 4.1, s + 13) * .13;
export function rand(seed) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) + 1 >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }

export function mixHex(a, b, t) {
  const ar = a >> 16 & 255, ag = a >> 8 & 255, ab = a & 255, br = b >> 16 & 255, bg = b >> 8 & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
export const css = hex => '#' + hex.toString(16).padStart(6, '0');

/* ---------- voxel grid ---------- */
export class Grid {
  constructor(w, h, d) { this.w = w; this.h = h; this.d = d; this.c = new Int32Array(w * h * d).fill(-1); }
  inside(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.w && y < this.h && z < this.d; }
  get(x, y, z) { return this.inside(x, y, z) ? this.c[x + this.w * (z + this.d * y)] : -1; }
  has(x, y, z) { return this.get(x, y, z) >= 0; }
  set(x, y, z, col) { x |= 0; y |= 0; z |= 0; if (this.inside(x, y, z)) this.c[x + this.w * (z + this.d * y)] = col == null || col < 0 ? -1 : col; }
  del(x, y, z) { this.set(x, y, z, -1); }
  box(x0, y0, z0, x1, y1, z1, col) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
          this.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col);
  }
  top(x, z) { for (let y = this.h - 1; y >= 0; y--) if (this.has(x, y, z)) return y; return -1; }
}

/* Face tables: for each of the 6 faces, the corner offsets and the AO probe offsets. */
const FACES = [];
for (let a = 0; a < 3; a++) for (const s of [1, -1]) {
  const b = (a + 1) % 3, c = (a + 2) % 3, n = [0, 0, 0]; n[a] = s;
  const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]];
  FACES.push({
    n, verts: corners.map(([u, v]) => {
      const p = [0, 0, 0]; p[a] = s > 0 ? 1 : 0; p[b] = u; p[c] = v;
      const du = u ? 1 : -1, dv = v ? 1 : -1;
      const s1 = [...n], s2 = [...n], cr = [...n];
      s1[b] += du; s2[c] += dv; cr[b] += du; cr[c] += dv;
      return { p, s1, s2, cr };
    })
  });
}
const AO = [.5, .68, .85, 1];

// Turns a grid into one merged mesh with per-vertex colour and baked ambient occlusion.
// opts.delay(x,y,z) gives each voxel a build delay (seconds); opts.occ lists other grids that hide faces.
export function meshGrid(grid, opts = {}) {
  const { jitter = .06, delay = null, occ = [], scale = 1, origin = [0, 0, 0], shade = null } = opts;
  const solid = (x, y, z) => { if (grid.has(x, y, z)) return true; for (const g of occ) if (g.has(x, y, z)) return true; return false; };
  const P = [], N = [], C = [], D = [], M = [], I = [];
  const col = new THREE.Color();
  let vi = 0, maxDelay = 0;
  const { w, h, d } = grid;
  for (let y = 0; y < h; y++) for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
    const hex = grid.c[x + w * (z + d * y)];
    if (hex < 0) continue;
    col.setHex(hex);
    const j = 1 + (hash(x, y, z, 5) - .5) * 2 * jitter;
    const sh = shade ? shade(x, y, z) : 1;
    const r = col.r * j * sh, g = col.g * j * sh, bl = col.b * j * sh;
    const dl = delay ? delay(x, y, z) : 0;
    if (dl > maxDelay) maxDelay = dl;
    const cx = (x + .5) * scale + origin[0], cy = (y + .5) * scale + origin[1], cz = (z + .5) * scale + origin[2];
    for (const f of FACES) {
      if (solid(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
      const ao = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const v = f.verts[k];
        const a1 = solid(x + v.s1[0], y + v.s1[1], z + v.s1[2]) ? 1 : 0;
        const a2 = solid(x + v.s2[0], y + v.s2[1], z + v.s2[2]) ? 1 : 0;
        const ac = solid(x + v.cr[0], y + v.cr[1], z + v.cr[2]) ? 1 : 0;
        const o = a1 && a2 ? 0 : 3 - (a1 + a2 + ac);
        ao[k] = o;
        const m = AO[o];
        P.push((x + v.p[0]) * scale + origin[0], (y + v.p[1]) * scale + origin[1], (z + v.p[2]) * scale + origin[2]);
        N.push(f.n[0], f.n[1], f.n[2]);
        C.push(r * m, g * m, bl * m);
        D.push(dl);
        M.push(cx, cy, cz);
      }
      if (ao[0] + ao[2] > ao[1] + ao[3]) I.push(vi + 1, vi + 2, vi + 3, vi + 1, vi + 3, vi);
      else I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setAttribute('aDelay', new THREE.Float32BufferAttribute(D, 1));
  geo.setAttribute('aCenter', new THREE.Float32BufferAttribute(M, 3));
  geo.setIndex(vi > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  geo.computeBoundingSphere();
  geo.userData.maxDelay = maxDelay;
  return geo;
}

/* ---------- build animation (shader patch) ---------- */
// Voxels drop in from above with a small overshoot, then shrink away on the way out.
const BUILD = `#include <begin_vertex>
  float bIn = clamp((uBuild - aDelay) / 0.55, 0.0, 1.0);
  float bOut = clamp((uOut - (uMax - aDelay) * 0.45) / 0.4, 0.0, 1.0);
  float bE = 1.0 - pow(1.0 - bIn, 3.0);
  float bS = (bIn < 1.0 ? smoothstep(0.0, 0.35, bIn) : 1.0) * (1.0 - bOut * bOut);
  transformed = aCenter + (transformed - aCenter) * bS;
  transformed.y += (1.0 - bE) * 16.0 + bOut * bOut * 3.0;`;
export function buildUniforms() { return { uBuild: { value: 1e4 }, uOut: { value: 0 }, uMax: { value: 1 } }; }
export function patchBuild(mat, u) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'attribute float aDelay;\nattribute vec3 aCenter;\nuniform float uBuild;\nuniform float uOut;\nuniform float uMax;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', BUILD);
  };
  mat.customProgramCacheKey = () => 'vox-build';
  return mat;
}
export function voxelMesh(geo, u, matOpts = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, ...matOpts });
  if (u) patchBuild(mat, u);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  if (u) {
    mesh.customDepthMaterial = patchBuild(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), u);
  }
  return mesh;
}

/* ---------- flat-colour box props ---------- */
const matCache = new Map();
export function mat(hex, opts) {
  const key = hex + (opts ? JSON.stringify(opts) : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color: hex, ...opts }));
  return matCache.get(key);
}
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
export function box(w, h, d, hex, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(boxGeo, hex && hex.isMaterial ? hex : mat(hex, opts));
  m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function group(...kids) { const g = new THREE.Group(); kids.forEach(k => k && g.add(k)); return g; }

/* ---------- glow sprites, for lights at dusk ---------- */
let glowTex = null;
export function glow(hex, size = 2, opacity = 1) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: hex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

/* ---------- characters ---------- */
function faceTexture(skin, eye = 0x1d1d2b, mood = 'smile') {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  const x = c.getContext('2d');
  x.fillStyle = css(skin); x.fillRect(0, 0, 16, 16);
  x.fillStyle = css(eye); x.fillRect(4, 6, 2, 3); x.fillRect(10, 6, 2, 3);
  x.fillStyle = '#fff'; x.fillRect(4, 6, 1, 1); x.fillRect(10, 6, 1, 1);
  x.fillStyle = 'rgba(255,120,120,.55)'; x.fillRect(2, 10, 2, 1); x.fillRect(12, 10, 2, 1);
  x.fillStyle = css(mixHex(skin, 0x6b2d2d, .7));
  if (mood === 'smile') { x.fillRect(6, 11, 4, 1); x.fillRect(5, 10, 1, 1); x.fillRect(10, 10, 1, 1); }
  else if (mood === 'tired') { x.fillRect(6, 12, 4, 1); x.fillStyle = css(eye); x.fillRect(4, 7, 2, 1); x.fillRect(10, 7, 2, 1); }
  else x.fillRect(7, 11, 2, 2);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const SKINS = [0xf6d2b5, 0xe8b48f, 0xc98b62, 0x9a6440, 0x6e4529];
// A blocky character about 2.3 units tall. Faces +z. Call kid.walk(phase, amount) every frame.
export function kid({ shirt = 0x3fa7ff, pants = 0x2d3a5a, skin = SKINS[1], hair = 0x3b2a20, long = false, hat = null, tunic = false, scale = 1 } = {}) {
  const g = new THREE.Group();
  const legL = box(.36, .82, .4, pants, -.2, .41, 0), legR = box(.36, .82, .4, pants, .2, .41, 0);
  const pivL = group(legL), pivR = group(legR);
  pivL.position.y = pivR.position.y = .82; legL.position.y = legR.position.y = -.41;
  const body = box(.82, .86, .46, shirt, 0, 1.25, 0);
  if (tunic) body.scale.y = 1.15, body.position.y = 1.2;
  const armL = box(.26, .78, .3, shirt, 0, -.36, 0), armR = box(.26, .78, .3, shirt, 0, -.36, 0);
  const handL = box(.24, .18, .28, skin, 0, -.82, 0), handR = box(.24, .18, .28, skin, 0, -.82, 0);
  const pal = group(armL, handL), par = group(armR, handR);
  pal.position.set(-.55, 1.64, 0); par.position.set(.55, 1.64, 0);
  const headMats = [mat(skin), mat(skin), mat(skin), mat(skin), new THREE.MeshLambertMaterial({ map: faceTexture(skin) }), mat(skin)];
  const head = new THREE.Mesh(boxGeo, headMats); head.scale.set(.86, .8, .8); head.position.y = 2.1; head.castShadow = true;
  const hairTop = box(.92, .26, .86, hair, 0, 2.48, -.02);
  const hairBack = box(.92, long ? .9 : .5, .2, hair, 0, long ? 2.05 : 2.25, -.36);
  g.add(pivL, pivR, body, pal, par, head, hairTop, hairBack);
  if (hat) g.add(box(1, .16, 1, hat, 0, 2.62, 0), box(.7, .3, .7, hat, 0, 2.8, 0));
  g.scale.setScalar(scale);
  g.userData = { pivL, pivR, pal, par, head };
  g.walk = (ph, amt = 1) => {
    const s = Math.sin(ph) * .7 * amt;
    pivL.rotation.x = s; pivR.rotation.x = -s; pal.rotation.x = -s * .9; par.rotation.x = s * .9;
    body.position.y = (tunic ? 1.2 : 1.25) + Math.abs(Math.cos(ph)) * .06 * amt;
  };
  g.cheer = (t) => { const a = Math.abs(Math.sin(t * 9)); pal.rotation.z = -2.6 - a * .3; par.rotation.z = 2.6 + a * .3; pal.rotation.x = par.rotation.x = 0; };
  g.rest = () => { pal.rotation.z = par.rotation.z = 0; };
  g.setMood = mood => { headMats[4].map = faceTexture(skin, 0x1d1d2b, mood); headMats[4].needsUpdate = true; };
  return g;
}
kid.skins = SKINS;

/* ---------- voxel particles (dust, smoke, splashes, confetti) ---------- */
export class Particles {
  constructor(max = 200, { size = .3, light = true } = {}) {
    const m = light ? new THREE.MeshLambertMaterial() : new THREE.MeshBasicMaterial();
    this.mesh = new THREE.InstancedMesh(boxGeo, m, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.max = max; this.size = size; this.list = []; this.dummy = new THREE.Object3D(); this.col = new THREE.Color();
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, this.col.set(0xffffff));
    this.mesh.count = 0;
  }
  spawn(p) { if (this.list.length < this.max) this.list.push({ age: 0, life: 1, g: 0, drag: 0, grow: 0, size: this.size, spin: 0, ...p }); }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const q = L[i]; q.age += dt;
      if (q.age >= q.life) { L.splice(i, 1); continue; }
      q.vy -= q.g * dt; const k = Math.max(0, 1 - q.drag * dt);
      q.vx *= k; q.vy *= k; q.vz *= k;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.floor != null && q.y < q.floor) { q.y = q.floor; q.vy *= -.3; q.vx *= .6; q.vz *= .6; }
    }
    const d = this.dummy;
    L.forEach((q, i) => {
      const a = q.age / q.life;
      const s = q.size * (1 + q.grow * a) * (a > .7 ? 1 - (a - .7) / .3 : 1) * Math.min(1, q.age * 12);
      d.position.set(q.x, q.y, q.z); d.rotation.set(q.spin * q.age, q.spin * q.age * .7, 0); d.scale.setScalar(Math.max(.001, s));
      d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
      this.mesh.setColorAt(i, this.col.setHex(q.color));
    });
    this.mesh.count = L.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.list.length = 0; this.mesh.count = 0; }
}

/* ---------- scatter: lots of tiny boxes in one draw call (flowers, grass, reeds) ---------- */
export function scatter(items) {
  const m = new THREE.InstancedMesh(boxGeo, new THREE.MeshLambertMaterial(), items.length);
  const d = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((it, i) => {
    d.position.set(it.x, it.y, it.z); d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0); d.scale.set(it.w, it.h, it.d ?? it.w);
    d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, c.setHex(it.c));
  });
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* ---------- water: one merged surface with gentle waves and sun glints ---------- */
export function water(cells, { level = 0, deep = 0x2f8fd6, shallow = 0x7fd6e8, opacity = .8, time } = {}) {
  const P = [], C = [], I = [], c1 = new THREE.Color(deep), c2 = new THREE.Color(shallow), c = new THREE.Color();
  let vi = 0;
  for (const cell of cells) {
    const { x, z } = cell, s = cell.s || 1;
    c.copy(c2).lerp(c1, clamp(cell.depth ?? .5));
    for (const [dx, dz] of [[0, 0], [0, 1], [1, 1], [1, 0]]) { P.push(x - s / 2 + dx * s, level, z - s / 2 + dz * s); C.push(c.r, c.g, c.b); }
    I.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(vi > 65535 ? new THREE.Uint32BufferAttribute(I, 1) : new THREE.Uint16BufferAttribute(I, 1));
  geo.computeVertexNormals();
  const m = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity, shininess: 70, specular: 0xbfe6ff, depthWrite: false });
  const u = time || { value: 0 };
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = u;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float wx = position.x * 1.3 + uTime * 1.6, wz = position.z * 1.1 + uTime * 1.25;
        objectNormal = normalize(vec3(-cos(wx) * .07, 1.0, sin(wz) * .07));`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed.y += sin(position.x * 1.3 + uTime * 1.6) * .05 + cos(position.z * 1.1 + uTime * 1.25) * .05;`);
  };
  m.customProgramCacheKey = () => 'water';
  const mesh = new THREE.Mesh(geo, m);
  // no shadows on the moving surface: they shimmer where the water meets the land
  mesh.receiveShadow = false; mesh.renderOrder = 2;
  mesh.userData.time = u;
  return mesh;
}

/* ---------- tiles: instanced boxes that are laid one by one (paths, planks, reeds, flowers) ---------- */
export class Tiles {
  constructor(items, { dur = 1.1, drop = 2.5, shadow = true, basic = false } = {}) {
    this.items = items; this.n = items.length;
    this.mesh = new THREE.InstancedMesh(boxGeo, basic ? new THREE.MeshBasicMaterial() : new THREE.MeshLambertMaterial(), Math.max(1, this.n));
    this.mesh.castShadow = shadow; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    const c = new THREE.Color();
    items.forEach((it, i) => this.mesh.setColorAt(i, c.setHex(it.c)));
    // order 0..1 decides who appears first
    const keys = items.map((it, i) => it.k ?? i / Math.max(1, this.n - 1));
    const mx = Math.max(1e-6, ...keys);
    this.k = keys.map(k => k / mx);
    this.dur = dur; this.drop = drop; this.p = 1; this.target = 1; this.d = new THREE.Object3D(); this.dirty = true;
    this.write();
  }
  set(on, instant = false) { this.target = on ? 1 : 0; if (instant) { this.p = this.target; this.dirty = true; this.write(); } }
  update(dt) {
    if (this.p !== this.target) {
      const s = dt / this.dur;
      this.p = this.target > this.p ? Math.min(this.target, this.p + s) : Math.max(this.target, this.p - s * 1.6);
      this.dirty = true;
    }
    if (this.dirty) this.write();
  }
  write() {
    this.dirty = false;
    const d = this.d, showing = this.target === 1;
    this.mesh.visible = this.p > 0;
    for (let i = 0; i < this.n; i++) {
      const it = this.items[i];
      const q = clamp((this.p * 1.6 - this.k[i] * .6) / 1, 0, 1);
      const s = showing ? easeBack(q) : easeOut(q);
      d.position.set(it.x, it.y + (1 - easeOut(q)) * this.drop * (showing ? 1 : 0), it.z);
      d.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      d.scale.set(Math.max(1e-4, it.w * s), Math.max(1e-4, it.h * s), Math.max(1e-4, (it.d ?? it.w) * s));
      d.updateMatrix(); this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ---------- a world: meshes + props + its own lights and camera ---------- */
export class World {
  constructor({ sky, fog, hemi = [0xdff1ff, 0x6a5a48, 1.7], sun = [0xfff3dc, 2.9], sunDir = [-.55, 1, .45], shadow = 34, center = [0, 0, 0], cam = {} } = {}) {
    this.scene = new THREE.Scene();
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.u = buildUniforms();
    this.layers = {};
    this.props = [];
    this.ticks = [];
    this.skyStops = sky || [[0, 0x8fd3ff], [1, 0xe9f7ff]];
    this.hemi = new THREE.HemisphereLight(hemi[0], hemi[1], hemi[2]);
    this.sun = new THREE.DirectionalLight(sun[0], sun[1]);
    this.sunDir = new THREE.Vector3(...sunDir).normalize();
    this.sun.position.copy(this.sunDir).multiplyScalar(60);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -shadow; sc.right = sc.top = shadow; sc.near = 1; sc.far = 160; sc.updateProjectionMatrix();
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -.0006; this.sun.shadow.normalBias = .04;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    if (fog) this.scene.fog = new THREE.Fog(fog[0], fog[1], fog[2]);
    this.center = new THREE.Vector3(...center);
    this.cam = { az: .78, el: .58, dist: 92, fov: 26, ...cam };
    this.camera = new THREE.PerspectiveCamera(this.cam.fov, 1.6, 1, 600);
    this.look = new THREE.Vector3().copy(this.center);
    this.camOverride = null; this.camCur = null;
  }
  // A layer is a group of voxel meshes that builds in and out on its own clock.
  layer(name) {
    if (!this.layers[name]) {
      const u = name === 'base' ? this.u : buildUniforms();
      const g = new THREE.Group(); this.root.add(g);
      this.layers[name] = { u, g, meshes: [], shown: name === 'base', t: 1e4, out: 0, dir: 0 };
    }
    return this.layers[name];
  }
  addGrid(grid, opts = {}) {
    const L = this.layer(opts.layer || 'base');
    const geo = meshGrid(grid, opts);
    const m = voxelMesh(geo, L.u, opts.mat);
    if (opts.shadow === false) m.castShadow = false;
    L.u.uMax.value = Math.max(L.u.uMax.value, geo.userData.maxDelay);
    L.g.add(m); L.meshes.push(m);
    return m;
  }
  // Props pop in after the terrain under them has landed.
  prop(obj, delay = 1, layer = 'base') { obj.userData.delay = delay; obj.userData.layer = layer; obj.userData.base = obj.scale.clone(); this.root.add(obj); this.props.push(obj); return obj; }
  tick(fn) { this.ticks.push(fn); }
  show(name, on = true) { const L = this.layer(name); if (L.shown === on) return; L.shown = on; if (on) { L.t = 0; L.out = 0; } else { L.out = 0.0001; } }
  setLayer(name, on) { const L = this.layer(name); L.shown = on; L.t = on ? 1e4 : 0; L.out = on ? 0 : 1e4; this.syncLayer(L); }
  syncLayer(L) {
    L.u.uBuild.value = L.t; L.u.uOut.value = L.out;
    L.g.visible = L.shown || L.out < (L.u.uMax.value * .45 + .45);
  }
  // Start the whole world building from nothing.
  build() { for (const k in this.layers) { const L = this.layers[k]; if (L.shown) { L.t = 0; L.out = 0; } } this.building = 0; }
  unbuild() { for (const k in this.layers) { const L = this.layers[k]; if (L.shown) L.out = 0.0001; } this.leaving = 0; }
  finish() { for (const k in this.layers) { const L = this.layers[k]; L.t = L.shown ? 1e4 : 0; L.out = L.shown ? 0 : 1e4; this.syncLayer(L); } this.building = this.leaving = null; }
  step(t, dt) {
    for (const k in this.layers) {
      const L = this.layers[k];
      if (L.t < 1e4) L.t += dt;
      if (L.out > 0 && L.out < 1e4) L.out += dt;
      this.syncLayer(L);
    }
    if (this.building != null) this.building += dt;
    if (this.leaving != null) this.leaving += dt;
    for (const p of this.props) {
      const L = this.layers[p.userData.layer] || this.layers.base;
      const pin = clamp((L.t - p.userData.delay) / .45);
      const pout = L.out > 0 ? clamp((L.out - .05) / .35) : 0;
      const s = (L.t >= 1e4 ? 1 : easeBack(pin)) * (1 - easeIn(pout));
      p.visible = s > .001;
      if (p.visible) p.scale.copy(p.userData.base).multiplyScalar(Math.max(.001, s));
    }
    for (const f of this.ticks) f(t, dt);
    this.easeCam(1 - Math.exp(-dt * 2.6));
  }
  // The camera eases towards cam (or camOverride) so trailers can cut to close-ups smoothly.
  snapCam() { this.camCur = null; }
  easeCam(k) {
    const c = this.camOverride ? { ...this.cam, ...this.camOverride } : this.cam;
    if (!this.camCur) { this.camCur = { az: c.az, el: c.el, dist: c.dist, fov: c.fov, oy: c.oy || 0 }; this.look.copy(c.target || this.center); return; }
    const cur = this.camCur;
    cur.az += (c.az - cur.az) * k; cur.el += (c.el - cur.el) * k; cur.dist += (c.dist - cur.dist) * k; cur.fov += (c.fov - cur.fov) * k; cur.oy += ((c.oy || 0) - cur.oy) * k;
    this.look.lerp(c.target || this.center, k);
  }
  frame(aspect, t) {
    const c = this.camOverride ? { ...this.cam, ...this.camOverride } : this.cam;
    if (!this.camCur) this.easeCam(1);
    const cur = this.camCur;
    const narrow = clamp(1.5 / aspect, 1, 2.1);
    const az = cur.az + Math.sin(t * .07) * (c.sway ?? .05);
    const dist = cur.dist * Math.pow(narrow, .9);
    this.camera.fov = cur.fov;
    this.camera.aspect = aspect;
    this.camera.position.set(
      this.look.x + Math.cos(cur.el) * Math.sin(az) * dist,
      this.look.y + Math.sin(cur.el) * dist,
      this.look.z + Math.cos(cur.el) * Math.cos(az) * dist);
    this.camera.lookAt(this.look);
    if (Math.abs(cur.oy) > .001) this.camera.setViewOffset(1000, 1000 / aspect, 0, -cur.oy * 1000 / aspect, 1000, 1000 / aspect); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.sun.position.copy(this.center).addScaledVector(this.sunDir, 70);
    this.sun.target.position.copy(this.center);
  }
  paintSky(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [o, c] of this.skyStops) g.addColorStop(o, css(c));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (this.paintExtra) this.paintExtra(ctx, w, h);
  }
}

/* ---------- the shared renderer and its views ---------- */
class Hub {
  constructor() {
    this.views = new Set();
    this.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.quality = 1; this.calm = 0;
    this.loop = this.loop.bind(this);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.wake(); });
  }
  init() {
    if (this.r) return true;
    try {
      this.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (e) { this.failed = true; return false; }
    this.r.setPixelRatio(1);
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.r.setClearColor(0x000000, 0);
    this.cw = this.ch = 0;
    return true;
  }
  add(view) {
    if (!this.init()) return false;
    this.views.add(view);
    const io = new IntersectionObserver(es => { for (const e of es) { view.visible = e.isIntersecting; if (view.visible) this.wake(); } }, { rootMargin: '120px 0px' });
    io.observe(view.el);
    const ro = new ResizeObserver(() => { view.resize(); if (this.reduce || view.paused) this.drawStill(view); else this.wake(); });
    ro.observe(view.el);
    return true;
  }
  wake() { if (!this.raf && !document.hidden) { this.last = performance.now(); this.raf = requestAnimationFrame(this.loop); } }
  loop(now) {
    this.raf = 0;
    if (document.hidden) return;
    const dt = Math.min(.05, (now - this.last) / 1000); this.last = now;
    let any = false;
    const t0 = performance.now();
    for (const v of this.views) {
      if (!v.visible) continue;
      if (this.reduce || v.paused) { if (v.dirty) this.drawStill(v); continue; }
      v.t += dt; v.update(v.t, dt); this.draw(v); any = true;
    }
    // drop resolution a little if frames are slow
    if (any) {
      const ft = performance.now() - t0;
      this.avg = (this.avg || ft) * .95 + ft * .05;
      // a slow device gives up a little sharpness, never much; a fast one wins it back
      if (this.avg > 22 && this.quality > .8) { this.quality = Math.max(.8, this.quality - .05); this.avg = 14; this.views.forEach(v => v.resize()); }
      else if (this.avg < 9 && this.quality < 1 && ++this.calm > 240) { this.quality = Math.min(1, this.quality + .05); this.calm = 0; this.views.forEach(v => v.resize()); }
    }
    if (any) this.raf = requestAnimationFrame(this.loop);
  }
  drawStill(v) { if (!v.visible && !v.force) { v.dirty = true; return; } v.dirty = false; this.draw(v); }
  draw(v) {
    const w = v.canvas.width, h = v.canvas.height;
    if (!w || !h) return;
    if (w > this.cw || h > this.ch) { this.cw = Math.max(w, this.cw); this.ch = Math.max(h, this.ch); this.r.setSize(this.cw, this.ch, false); }
    const W = v.world;
    W.frame(w / h, v.t);
    this.r.setViewport(0, 0, w, h); this.r.setScissor(0, 0, w, h); this.r.setScissorTest(true);
    this.r.render(W.scene, W.camera);
    const ctx = v.ctx;
    W.paintSky(ctx, w, h);
    ctx.drawImage(this.r.domElement, 0, this.ch - h, w, h, 0, 0, w, h);
    if (v.after) v.after(ctx, w, h);
  }
}
export const hub = new Hub();

// A view is one canvas on the page showing one world at a time.
export class View {
  constructor(el, { maxDpr = 2, onUpdate = null } = {}) {
    this.el = el; this.maxDpr = maxDpr;
    this.canvas = el.querySelector('canvas') || el.appendChild(document.createElement('canvas'));
    this.ctx = this.canvas.getContext('2d');
    this.t = 0; this.visible = false; this.paused = false; this.dirty = true;
    this.onUpdate = onUpdate;
    this.ok = hub.add(this);
    this.resize();
  }
  setWorld(w) { this.world = w; this.dirty = true; this.refresh(); }
  // When nothing is animating (reduced motion or paused), settle the world and draw one frame.
  refresh(settle = 6) {
    if (!this.world) return;
    if (hub.reduce || this.paused) { for (let i = 0; i < settle; i++) this.update(this.t, .2); hub.drawStill(this); }
    else hub.wake();
  }
  resize() {
    const r = this.el.getBoundingClientRect();
    // as sharp as the screen, up to 3x, but never more than about 2600 pixels across
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr, 2600 / Math.max(1, r.width)) * hub.quality;
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (w !== this.canvas.width || h !== this.canvas.height) { this.canvas.width = w; this.canvas.height = h; this.dirty = true; }
    // layout size in the element's own CSS pixels, so labels line up even when the page is zoomed on big screens
    this.cssW = this.el.offsetWidth || r.width; this.cssH = this.el.offsetHeight || r.height;
  }
  update(t, dt) {
    if (!this.world) return;
    this.world.step(t, dt);
    // keep the camera current so labels pinned to the world line up with this frame
    if (this.canvas.width && this.canvas.height) this.world.frame(this.canvas.width / this.canvas.height, t);
    if (this.onUpdate) this.onUpdate(t, dt);
  }
  // Screen position (CSS px, relative to the view) of a world point.
  project(v3) {
    const p = v3.clone().project(this.world.camera);
    return { x: (p.x * .5 + .5) * this.cssW, y: (-p.y * .5 + .5) * this.cssH, behind: p.z > 1 };
  }
  pause(on) { this.paused = on; if (!on) hub.wake(); }
}
