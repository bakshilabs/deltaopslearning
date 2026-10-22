// The Power Run film world: a runner lane along the front, Eco Town behind it and a hill for turbines.
// Built with the site's voxel engine so it matches the game windows on the homepage.
import { THREE, Grid, World, Tiles, Particles, water, box, group, glow, hash, noise, fbm, mixHex, clamp, lerp, smooth } from '/js/game/engine.js?v=20261018b';

const pick = (arr, r) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];
const GRASS = [0x6fd24a, 0x62c640, 0x7ddc52, 0x58bd3a];
const DIRT = [0xb5793f, 0xa26a35, 0xae7440];
const STONE = [0x9a958f, 0x8a8580, 0xa6a19a];

function ground(x, y, z, h, seed = 0) {
  const r = hash(x, y, z, seed);
  if (y === h) {
    const n = fbm(x * .16, z * .16, seed + 3);
    return mixHex(pick(GRASS, r), n > .55 ? 0xb4f06a : 0x3fae3a, Math.min(.55, Math.abs(n - .5) * 1.1));
  }
  if (y >= h - 2) return pick(DIRT, r);
  return pick(STONE, r);
}
function oak(g, x, y, z, { r = 2.5, trunk = 3, seed = 0 } = {}) {
  const leaves = [0x3fbf4a, 0x2fa83f, 0x62d65a];
  g.box(x, y, z, x, y + trunk, z, 0x8a5a34);
  const cy = y + trunk + r * .55, R = Math.ceil(r) + 1;
  for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.sqrt(dx * dx + (dy * 1.3) ** 2 + dz * dz) + (hash(x + dx, y + dy, z + dz, seed) - .5) * 1.1;
    if (d > r) continue;
    const yy = Math.round(cy + dy);
    g.set(x + dx, yy, z + dz, dy / r > .35 ? leaves[2] : hash(x + dx, yy, z + dz, 4) < .5 ? leaves[0] : leaves[1]);
  }
}
function pine(g, x, y, z, h = 7) {
  const leaves = [0x1f9d5a, 0x178a4c, 0x2fbf6c];
  g.box(x, y, z, x, y + 1, z, 0x6b4a32);
  for (let i = 0; i < h; i++) {
    const r = Math.max(0, (h - i) * .45 - (i % 2) * .55), yy = y + 2 + i, R = Math.ceil(r);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++)
      if (dx * dx + dz * dz <= r * r + .3) g.set(x + dx, yy, z + dz, i > h * .6 ? leaves[2] : hash(x + dx, yy, z + dz) < .5 ? leaves[0] : leaves[1]);
  }
  g.set(x, y + 2 + h, z, leaves[2]);
}
function bush(g, x, y, z) {
  const cols = [0x3fbf4a, 0x5ad152];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++)
    if (Math.abs(dx) + Math.abs(dz) + dy <= 2 && hash(x + dx, y + dy, z + dz, 8) < .85) g.set(x + dx, y + dy, z + dz, pick(cols, hash(x + dx, dy, z + dz)));
}
function house(g, glass, x0, y0, z0, w, d, h, { wall, roof, roof2 }) {
  g.box(x0, y0, z0, x0 + w - 1, y0 + h - 1, z0 + d - 1, (x, y) => ((y - y0) % 2 ? mixHex(wall, 0x000000, .05) : wall));
  for (const [x, z] of [[x0, z0], [x0 + w - 1, z0], [x0, z0 + d - 1], [x0 + w - 1, z0 + d - 1]]) g.box(x, y0, z, x, y0 + h - 1, z, 0xffffff);
  for (let k = 0; ; k++) {
    const za = z0 - 1 + k, zb = z0 + d - k, yy = y0 + h + k;
    if (za > zb) break;
    const rc = k % 2 ? roof2 : roof;
    g.box(x0 - 1, yy, za, x0 + w, yy, za, rc); g.box(x0 - 1, yy, zb, x0 + w, yy, zb, rc);
    if (za + 1 <= zb - 1) g.box(x0, yy, za + 1, x0 + w - 1, yy, zb - 1, wall);
  }
  const dx = x0 + Math.floor(w / 2);
  g.set(dx, y0, z0 + d - 1, 0x7a4a2a); g.set(dx, y0 + 1, z0 + d - 1, 0x7a4a2a);
  const wy = y0 + Math.min(2, h - 2);
  const putWin = (x, y, z) => { g.del(x, y, z); glass.set(x, y, z, 0x34445a); };
  for (let x = x0 + 1; x < x0 + w - 1; x++) {
    if (Math.abs(x - dx) >= 2 && (x - x0) % 2 === 1) putWin(x, wy, z0 + d - 1);
    if ((x - x0) % 2 === 1) putWin(x, wy, z0);
  }
  for (let z = z0 + 1; z < z0 + d - 1; z++) if ((z - z0) % 2 === 1) { putWin(x0, wy, z); putWin(x0 + w - 1, wy, z); }
}
export function turbine() {
  const blades = new THREE.Group();
  for (let i = 0; i < 3; i++) { const p = group(box(.42, 5, .14, 0xffffff, 0, 2.5, 0)); p.rotation.z = i * Math.PI * 2 / 3; blades.add(p); }
  blades.add(box(.6, .6, .6, 0xe9eef2));
  blades.position.set(0, 11, .7);
  const g = group(box(.6, 11, .6, 0xf6f8fa, 0, 5.5, 0), box(.8, .8, 1.6, 0xe2e7eb, 0, 11, 0), box(.64, .5, .64, 0x1f9d55, 0, .25, 0), blades);
  g.userData.blades = blades;
  return g;
}

/* ---------- the runner course ---------- */
// lane height offsets along x, and the jumps the hero makes (x from, x to, apex above the higher end)
export const LANE_Z = 66;
const LANE = [[0, 14, 0], [14, 24, 2], [24, 28, -3], [28, 58, 0], [58, 72, 6], [72, 92, 0], [92, 114, 6], [114, 128, 0]];
export const laneH = x => { for (const [a, b, h] of LANE) if (x >= a && x < b) return h; return 0; };

export function powerRunWorld() {
  const GW = 128, GH = 40, GD = 82, BASE = 9;
  const g = new Grid(GW, GH, GD), o = [-GW / 2, -(BASE + 1), -GD / 2];
  const hm = new Int16Array(GW * GD).fill(-999);
  const wx = x => x + .5 + o[0], wz = z => z + .5 + o[2], wy = y => y + o[1];
  const H = (x, z) => hm[(x | 0) + GW * (z | 0)];
  const top = (x, z) => wy(H(x, z) + 1);
  const at = (x, z, dy = 0) => new THREE.Vector3(wx(x), top(x, z) + dy, wz(z));

  const W = new World({
    sky: [[0, 0x1f8bff], [.55, 0x6cc8ff], [1, 0xd8f4ff]], fog: [0xcdeeff, 190, 330],
    hemi: [0xe4f4ff, 0x6a7a40, 1.35], sun: [0xfff2d6, 3.1], sunDir: [-.35, .9, .7], shadow: 70,
    center: [0, 0, 0], cam: { az: 0, el: .1, dist: 20, fov: 32, sway: 0 }
  });

  const ROAD = (x, z) => (z >= 31 && z <= 32 && x >= 46 && x <= 122) || (x >= 83 && x <= 84 && z >= 14 && z <= 47);
  const pondD = (x, z) => Math.hypot((x - 20) / 9, (z - 32) / 6);
  for (let z = 0; z < GD; z++) for (let x = 0; x < GW; x++) {
    const dx = (x + .5 - GW / 2) / (GW / 2), dz = (z + .5 - GD / 2) / (GD / 2);
    const d = Math.pow(Math.pow(Math.abs(dx), 6) + Math.pow(Math.abs(dz), 6), 1 / 6) / (.97 + .05 * fbm(x * .1, z * .1, 4));
    if (d > 1) continue;
    let h = 0;
    if (z >= LANE_Z - 4 && z <= LANE_Z + 4) h = laneH(x);
    else if (z < 14) h = Math.round(7 * smooth(0, 1, (14 - z) / 10) * (.8 + .3 * noise(x * .1, z * .1, 2)));
    if (pondD(x, z) < 1) h = -1 - Math.round(1.5 * (1 - pondD(x, z)));
    const hh = BASE + h; hm[x + GW * z] = hh;
    const dep = Math.round(4 + Math.pow(1 - Math.min(1, d), .6) * 10 + noise(x * .35, z * .35, 6) * 3);
    for (let y = Math.max(0, hh - dep); y <= hh; y++) {
      let c = ground(x, y, z, hh, 7);
      if (y === hh && ROAD(x, z)) c = mixHex(0x6b7077, 0x5d6268, hash(x, z));
      if (y === hh && pondD(x, z) < 1) c = 0xd9c98e;
      if (y === hh && z >= LANE_Z - 4 && z <= LANE_Z + 4 && (z === LANE_Z - 4 || z === LANE_Z + 4) && h > 0) c = mixHex(c, 0x2f9e3a, .3);
      g.set(x, y, z, c);
    }
  }
  // the stream that crosses the lane
  const wcells = [];
  for (let z = LANE_Z - 6; z <= LANE_Z + 10; z++) for (let x = 24; x < 28; x++) if (H(x, z) > -900) { hm[x + GW * z] = Math.min(H(x, z), BASE - 3); for (let y = BASE - 2; y <= BASE + 4; y++) g.del(x, y, z); g.set(x, BASE - 3, z, 0xd9c98e); wcells.push({ x: wx(x), z: wz(z), depth: .7 }); }
  for (let z = 0; z < GD; z++) for (let x = 0; x < GW; x++) if (pondD(x, z) < 1 && H(x, z) > -900) wcells.push({ x: wx(x), z: wz(z), depth: clamp((1 - pondD(x, z)) * 1.4) });
  const time = { value: 0 };
  W.root.add(water(wcells, { level: wy(BASE - 1) + .2, deep: 0x1e8fe0, shallow: 0x5fe0f0, time, opacity: .85 }));

  // behind the lane: a fence, then trees and bushes (the eye-level backdrop)
  for (let x = 2; x < 120; x++) if (H(x, LANE_Z - 6) > -900 && (x < 22 || x > 29) && (x < 46 || x > 60)) { const y = H(x, LANE_Z - 6) + 1; g.set(x, y, LANE_Z - 6, x % 3 ? 0xf4f0e6 : 0xffffff); if (x % 3 === 0) g.set(x, y + 1, LANE_Z - 6, 0xffffff); }
  const TREES = [[4, 56], [11, 53], [19, 57], [36, 55], [44, 52], [52, 56], [61, 54], [69, 57], [77, 53], [96, 56], [104, 53], [112, 57], [120, 54], [8, 46], [30, 47], [6, 20], [12, 12], [34, 18], [40, 40], [122, 24], [124, 40], [45, 12]];
  TREES.forEach(([x, z], i) => { if (H(x, z) > -900 && !ROAD(x, z) && pondD(x, z) > 1.3) (i % 3 === 2 ? pine(g, x, H(x, z) + 1, z, 6 + (i % 2)) : oak(g, x, H(x, z) + 1, z, { r: 2.2 + (i % 2) * .5, trunk: 2 + (i % 2), seed: i })); });
  [[15, 58], [27, 56], [57, 58], [86, 57], [100, 58], [116, 58], [24, 44], [62, 46], [107, 46]].forEach(([x, z]) => H(x, z) > -900 && bush(g, x, H(x, z) + 1, z));
  // flowers on the lane edges

  // Eco Town: 11 homes, all dark until the power comes back
  const HOUSES = [[50, 21, 0xfff1d6, 0xe8453c], [57, 20, 0xe4f1ff, 0x2f6fd6], [64, 21, 0xfff6e8, 0xff8a1f], [71, 20, 0xffe3ea, 0xe8453c], [88, 20, 0xe9fbef, 0x14a37f], [95, 21, 0xfff1d6, 0x7a4fe0], [103, 20, 0xe4f1ff, 0xe8453c], [110, 21, 0xfff6e8, 0x2f6fd6],
    [56, 36, 0xffe3ea, 0x14a37f], [70, 37, 0xfff1d6, 0xff8a1f], [98, 36, 0xe9fbef, 0xe8453c]];
  const homes = [];
  HOUSES.forEach(([x, z, wall, roof], i) => {
    const y = H(x, z) + 1, w = 5, d = 4, hh = 3 + (i % 3 === 0 ? 1 : 0);
    const glass = new Grid(GW, GH, GD);
    house(g, glass, x, y, z, w, d, hh, { wall, roof, roof2: mixHex(roof, 0x000000, .12) });
    homes.push({ glass, x, z, y, hh, w, d });
  });
  W.addGrid(g, { origin: o, occ: homes.map(h => h.glass) });
  homes.forEach(hm2 => {
    const m = W.addGrid(hm2.glass, { origin: o, occ: [g], jitter: .01, shadow: false });
    m.material = m.material.clone(); m.material.emissive = new THREE.Color(0x000000);
    hm2.mesh = m;
    hm2.glow = glow(0xffc04a, 10, 0); hm2.glow.position.set(wx(hm2.x + 2), wy(hm2.y + 1.5), wz(hm2.z + 2)); W.root.add(hm2.glow);
    hm2.icon = new THREE.Vector3(wx(hm2.x + 2), wy(hm2.y + hm2.hh + 3.6), wz(hm2.z + 1.5));
    hm2.on = 0; hm2.target = 0;
  });

  // solar panels for every roof, laid one by one
  const sp = [];
  homes.forEach((h, i) => { for (let k = 0; k < 2; k++) sp.push({ x: wx(h.x + 1 + k * 2), y: wy(h.y + h.hh + 2) + .16, z: wz(h.z + 3.5), w: 1.8, h: .14, d: 1.8, c: 0x1d4fd8, rx: .785, k: i / homes.length + k * .02 }); });
  const panels = new Tiles(sp, { drop: 9, dur: 2.2 }); panels.set(false, true); W.root.add(panels.mesh);
  // panel shine strips
  const shine = new Tiles(sp.map(p => ({ ...p, w: .3, h: .16, d: 1.7, x: p.x - .4, y: p.y + .03, c: 0x9fd8ff })), { drop: 9, dur: 2.2 }); shine.set(false, true); W.root.add(shine.mesh);

  // wind turbines on the hill, hidden until they are built
  const turbines = [[60, 6], [72, 5], [84, 4], [96, 5], [108, 6], [118, 9]].map(([x, z], i) => { const t = turbine(); t.position.copy(at(x, z)); t.rotation.y = 0; t.scale.setScalar(.001); t.visible = false; W.root.add(t); t.userData.i = i; return t; });

  // street lamps along the main road
  const lamps = [];
  for (let x = 48; x < 122; x += 7) {
    if (x > 80 && x < 87) continue;
    const p = group(box(.18, 3.2, .18, 0x4a5058, 0, 1.6, 0), box(.8, .16, .22, 0x4a5058, .34, 3.2, 0)), head = box(.4, .18, .32, 0xfff1c0, .66, 3.1, 0, { emissive: 0x000000 });
    p.add(head); p.position.copy(at(x, 30)); W.root.add(p);
    const gl = glow(0xffd77a, 4, 0); gl.position.copy(p.position).add(new THREE.Vector3(.66, 3, 0)); W.root.add(gl);
    lamps.push({ head, gl });
  }

  // blocky clouds
  const clouds = [[-40, 34, -30], [-5, 38, -40], [30, 33, -34], [60, 37, -26], [-62, 31, -10], [10, 30, 6]].map(([x, y, z], i) => {
    const c = new THREE.Group(), n = 3 + (i % 3);
    for (let k = 0; k < n; k++) c.add(box(4 + hash(i, k) * 4, 2 + hash(k, i) * 1.5, 3 + hash(i, k, 2) * 2, 0xffffff, k * 3 - n * 1.5, hash(i, k, 3) * 1.4, hash(k, i, 4) * 2));
    c.position.set(x, y, z); c.traverse(m => { if (m.isMesh) { m.castShadow = false; } }); W.root.add(c); return c;
  });

  // small flowers dotted along the lane
  for (let i = 0; i < 160; i++) {
    const x = 1 + hash(i, 1, 0, 21) * 124, z = LANE_Z - 5 + hash(i, 2, 0, 21) * 13;
    if ((x > 23 && x < 29) || Math.abs(z - LANE_Z) < 3.2 || H(x, z) < -900) continue;
    const c = pick([0xff4f8b, 0xffd23f, 0xffffff, 0xff8a1f, 0xb48cff], hash(i, 3, 0, 21));
    const f = group(box(.1, .45, .1, 0x2f9e3a, 0, .22, 0), box(.36, .3, .36, c, 0, .55, 0, { emissive: mixHex(c, 0x000000, .75) }));
    f.position.set(wx(x), top(x, z), wz(z)); W.root.add(f);
  }
  W.anchors = { town: new THREE.Vector3(wx(84), wy(BASE + 1), wz(30)), hill: new THREE.Vector3(wx(88), wy(BASE + 4), wz(6)), laneY: x => wy(BASE + laneH(x) + 1), laneZ: wz(LANE_Z), wx, wy, wz, at };
  W.homes = homes; W.panels = panels; W.shine = shine; W.turbines = turbines; W.lamps = lamps; W.clouds = clouds; W.time = time;
  W.dusk = 0; W.windOn = 0;
  W.tick((t, dt) => {
    time.value = t;
    panels.update(dt); shine.update(dt);
    clouds.forEach((c, i) => { c.position.x += dt * (.6 + i * .1); if (c.position.x > 80) c.position.x = -80; });
    for (const h of homes) {
      h.on += (h.target - h.on) * Math.min(1, dt * 6);
      h.mesh.material.emissive.setHex(mixHex(0x000000, 0xffc24a, clamp(h.on * (.75 + W.dusk * .4))));
      h.glow.material.opacity = h.on * (.12 + W.dusk * .6);
    }
    lamps.forEach(l => { l.gl.material.opacity = W.dusk * .9; l.head.material.emissive.setHex(mixHex(0x000000, 0xffd77a, W.dusk)); });
    turbines.forEach((tb, i) => { tb.userData.blades.rotation.z -= dt * (2.2 + i * .1) * W.windOn; });
  });
  return W;
}

/* ---------- the hero, a critter and the power prize (flat-colour boxes) ---------- */
export function hero() {
  const B = 0x3f8cff, B2 = 0x2b6fe0, Y = 0xffc83d;
  const g = new THREE.Group(), body = new THREE.Group();
  const legL = group(box(.42, .62, .46, B2, 0, -.31, 0), box(.5, .2, .62, 0x1d3f9a, 0, -.66, .06)), legR = group(box(.42, .62, .46, B2, 0, -.31, 0), box(.5, .2, .62, 0x1d3f9a, 0, -.66, .06));
  legL.position.set(-.3, .76, 0); legR.position.set(.3, .76, 0);
  body.add(box(1.5, 1.05, 1.0, B, 0, 1.3, 0), box(1.52, .26, 1.02, Y, 0, 1.1, 0));
  const head = group(box(1.62, 1.18, 1.1, B, 0, 0, 0), box(1.3, .62, .1, 0x14213a, 0, .02, .56), box(.24, .26, .06, 0xffffff, -.3, .06, .62), box(.24, .26, .06, 0xffffff, .3, .06, .62), box(.12, .12, .07, 0x14213a, -.26, .04, .66), box(.12, .12, .07, 0x14213a, .34, .04, .66), box(.5, .1, .06, Y, 0, -.18, .62), box(.12, .5, .12, 0x14213a, 0, .82, 0), box(.24, .24, .24, 0xff5a5a, 0, 1.12, 0));
  head.position.y = 2.42; body.add(head);
  const armL = group(box(.3, .7, .34, B2, 0, -.3, 0), box(.36, .3, .4, Y, 0, -.7, 0)), armR = group(box(.3, .7, .34, B2, 0, -.3, 0), box(.36, .3, .4, Y, 0, -.7, 0));
  armL.position.set(-.92, 1.7, 0); armR.position.set(.92, 1.7, 0);
  body.add(armL, armR);
  g.add(legL, legR, body);
  g.userData = { body, head, legL, legR, armL, armR };
  g.run = (ph, amt = 1) => {
    const s = Math.sin(ph) * .9 * amt;
    legL.rotation.x = s; legR.rotation.x = -s; armL.rotation.x = -s * .8; armR.rotation.x = s * .8;
    body.position.y = Math.abs(Math.cos(ph)) * .14 * amt; head.rotation.z = Math.sin(ph) * .04 * amt;
  };
  g.air = k => { legL.rotation.x = -.6; legR.rotation.x = .5; armL.rotation.x = armR.rotation.x = 0; armL.rotation.z = -2.4 * k; armR.rotation.z = 2.4 * k; };
  g.ground = () => { armL.rotation.z = armR.rotation.z = 0; };
  g.cheer = t => { const a = Math.abs(Math.sin(t * 10)); armL.rotation.x = armR.rotation.x = 0; armL.rotation.z = -2.6 - a * .4; armR.rotation.z = 2.6 + a * .4; legL.rotation.x = legR.rotation.x = 0; };
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}
export function critter() {
  const P = 0x7a4fe0;
  const g = group(box(1.7, 1.15, 1.2, P, 0, .6, 0), box(1.3, .3, 1, 0x6440c4, 0, .1, 0),
    box(.3, .32, .06, 0xffffff, -.35, .78, .62), box(.3, .32, .06, 0xffffff, .35, .78, .62), box(.14, .16, .07, 0x14213a, -.3, .74, .66), box(.14, .16, .07, 0x14213a, .3, .74, .66),
    box(.5, .1, .06, 0x2a1450, 0, .42, .62),
    box(.3, .34, .3, 0xff8a1f, -.5, 1.32, 0), box(.3, .48, .3, 0xffb21a, 0, 1.38, 0), box(.3, .34, .3, 0xff8a1f, .5, 1.32, 0));
  return g;
}
export function spark() {
  const g = group(box(.9, .9, .2, 0xffc21a, 0, 0, 0, { emissive: 0x6a4200 }), box(.6, .6, .26, 0xffe066, 0, 0, 0, { emissive: 0x7a5a00 }));
  const gl = glow(0xffd84a, 2.6, .55); g.add(gl);
  return g;
}
export function prize() {
  // a chunky lightning bolt built from blocks
  const Y = 0xffd21f, E = { emissive: 0xb07a00 };
  const bolt = group(box(.9, 1.1, .6, Y, .55, 1.55, 0, E), box(.9, 1.1, .6, Y, .2, .65, 0, E), box(1.9, .55, .6, Y, -.05, .05, 0, E), box(.9, 1.1, .6, Y, -.25, -.5, 0, E), box(.9, 1.1, .6, Y, -.6, -1.4, 0, E), box(.6, .6, .62, 0xfff3a6, .55, 1.75, .02, { emissive: 0xc9a000 }));
  const halo = glow(0xffe14a, 9, .75), halo2 = glow(0xffffff, 4, .6);
  const g = group(bolt, halo, halo2);
  const pad = group(box(2.8, .5, 2.8, 0x2c3e50, 0, .25, 0), box(2.2, .14, 2.2, 0x16ffc6, 0, .56, 0, { emissive: 0x0b8f70 }));
  g.userData = { bolt, halo, pad };
  return { g, pad };
}
export function battery() {
  // a big battery block: dark case, yellow charge window, red cap
  const g = group(box(2, 1.5, 1.8, 0x22303f, 0, .75, 0), box(1.3, .8, .1, 0xffd23f, 0, .78, .92, { emissive: 0x6a5200 }), box(.5, .2, .5, 0xff4f4f, 0, 1.6, 0), box(2.04, .14, 1.84, 0x16ffc6, 0, 1.43, 0, { emissive: 0x0b8f70 }));
  return g;
}
export { Particles };
