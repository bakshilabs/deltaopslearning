// Power Run: the playable lab.
// Run and jump through a voxel level that builds itself. At each glowing power prize, tell the AI what to
// build; it drops your choice into the level and changes how you can play. At the last prize the camera
// swoops out over Eco Town and the evening plays out, with a result that follows from your choices.
import { THREE, View, Particles, clamp, lerp, smooth, easeBack, easeInOut, mixHex, box, group } from '/js/game/engine.js?v=20261018b';
import { Hud } from '/js/game/hud.js?v=20261018b';
import { powerRunWorld, hero, critter, spark, prize, turbine, battery } from '/js/game/power-run-world.js';

const LANE = [[0, 14, 0], [14, 24, 2], [24, 28, -3], [28, 58, 0], [58, 72, 6], [72, 128, 0]];
const game = document.querySelector('.game');
const $ = s => game.querySelector(s);
const W = powerRunWorld({ lane: LANE });
const A = W.anchors;
const hud = new Hud($('.hudroot'), { name: 'Power Run', tag: 'Energy', icon: 'bolt', bot: '#ffcf3d' });
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const BOLT = '<svg viewBox="0 0 24 24"><path d="M13.5 2 4.5 13.5h6.2L9.8 22l9-11.6h-6.2z"/></svg>';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const R = Math.random;

/* ---------- the course (x along the lane) ---------- */
const PRIZES = [42, 78, 106];
const BATS = [82.5, 85, 87.5, 90];
const WIND_X = [47, 52, 57];
const COLUMN = [50.3, 54.7];                       // where wind or a water jet lifts the hero
const SHELF = { x0: 91.2, x1: 99.6, top: 6 };      // high spark shelf, reached from the 4th battery
const SOLAR = [{ x0: 47.5, x1: 52, top: 2.2 }, { x0: 52.8, x1: 57.6, top: 4.2 }];
const STREAM = [24, 28], CHECKS = [2, 21, 40.9, 72.5, 76.9];
const ground0 = x => A.laneY(x);
// course x to world x: lane cell x spans world [x, x + 1] from the grid's origin
const gx = x => A.wx(x) - .5;
// [x, height above the ground there]. Most sit at running height; some need a jump, the wind or the batteries.
const SPARKS = [
  [5], [7], [9], [13], [16], [18], [20], [26, 8.5], [34.3, 3.6], [38],
  [52.5, 4.5], [52.5, 7.5], [52.5, 10.5], [61], [64], [67], [75],
  [93, 7.5], [95, 7.5], [97, 7.5], [99, 7.5], [102], [104]
].map(([x, dy = 1.5]) => ({ x, y: ground0(x) + dy }));

/* ---------- state ---------- */
const plan = { source: null, bats: null };
let nBats = 0, solarOn = false, columnOn = null;   // what the AI has built in the level
const P = { x: 2, y: ground0(2), vx: 0, vy: 0, onGround: true, face: 1, coyote: 0, buffer: 0, cut: false, check: 0, landed: -9, hurt: -9 };
const S = { mode: 'load', t: 0, next: 0, seq: null, seqT: 0, si: 0, sparks: 0, dropT: null, dusk: 0, duskT0: null, fireworks: null, fwNext: 0, cheer: null, out: null, hour: 16 };
let ft = 0, shake = 0;

/* ---------- actors ---------- */
const H = hero(); H.visible = false; W.root.add(H);
const bug = critter(); W.root.add(bug);
const BUG = { x: 34.3, dir: 1, squashed: -9 };
const prizes = PRIZES.map(x => { const p = prize(); p.g.position.set(gx(x), ground0(x) + 3, A.laneZ); p.pad.position.set(gx(x), ground0(x), A.laneZ); W.root.add(p.g, p.pad); return p; });
const sparks = SPARKS.map(d => { const s = spark(); s.position.set(gx(d.x), d.y, A.laneZ); s.userData = { ...d, got: -1 }; W.root.add(s); return s; });
const levelTurbines = WIND_X.map(x => { const t = turbine(); t.position.set(gx(x), ground0(x), A.laneZ - 3.2); W.root.add(t); return t; });
const bats = BATS.map((x, i) => { const g = new THREE.Group(); for (let k = 0; k <= i; k++) { const b = battery(); b.position.y = k * 1.5; g.add(b); } g.position.set(gx(x), ground0(x), A.laneZ); W.root.add(g); return g; });
const shelf = group(...Array.from({ length: 9 }, (_, i) => box(.98, .7, 2.2, i % 2 ? 0xffc21a : 0xffd84a, i - 4, -.35, 0, { emissive: 0x4a3200 })));
shelf.position.set(gx((SHELF.x0 + SHELF.x1) / 2), ground0(95) + SHELF.top, A.laneZ); W.root.add(shelf);
const solarPads = SOLAR.map(p => { const w = p.x1 - p.x0; const g = group(box(w, .35, 2.4, 0x1d4fd8, 0, -.18, 0, { emissive: 0x0a2a80 }), box(w - .3, .08, 2, 0x9fd8ff, 0, .02, 0, { emissive: 0x3a7ab0 }), box(.3, 1.2, .3, 0xffd23f, 0, -1, 0)); g.position.set(gx((p.x0 + p.x1) / 2), ground0(p.x0) + p.top, A.laneZ); W.root.add(g); return g; });
function waterWheel() {
  const wheel = new THREE.Group();
  for (let i = 0; i < 8; i++) { const p = group(box(.3, 2.6, .5, 0x9a6a3c, 0, 1.3, 0)); p.rotation.z = i * Math.PI / 4; wheel.add(p); }
  wheel.add(box(.7, .7, .8, 0x6b4a32));
  const g = group(wheel, box(.3, 3.2, .3, 0x6b4a32, 0, -1.4, -.6), box(.3, 3.2, .3, 0x6b4a32, 0, -1.4, .6));
  g.userData.wheel = wheel; return g;
}
const wheel = waterWheel(); wheel.position.set(gx(26), ground0(26) + 2.6, A.laneZ); W.root.add(wheel);
const jetPipe = group(box(4.4, .5, .9, 0x2f8fe0, 0, .25, 0), box(.9, 1.2, .9, 0x2f8fe0, 2, .6, 0)); jetPipe.position.set(gx(52.5), ground0(52), A.laneZ - 1.6); W.root.add(jetPipe);
// town extras the plan may build
const townWheels = [0, 1, 2].map(i => { const w = waterWheel(); w.position.copy(A.at(17 + i * 3, 33)).add(V(0, 2.2, 0)); W.root.add(w); return w; });
const townBats = [0, 1, 2, 3].map(i => { const b = battery(); b.position.copy(A.at(78 + i * 2.4, 26)); W.root.add(b); return b; });
const hide = o => { o.visible = false; };
[...levelTurbines, ...bats.flatMap(b => b.children), ...solarPads, wheel, jetPipe, ...townWheels, ...townBats].forEach(hide);
const partsOf = g => g.children.map((c, i) => [c, i]).sort((a, b) => (a[0].position.y - b[0].position.y) || a[1] - b[1]).map(x => x[0]);
levelTurbines.forEach(t => { t.visible = true; partsOf(t).forEach(hide); });
W.turbines.forEach(t => { t.visible = true; t.scale.setScalar(1); partsOf(t).forEach(hide); });
bats.forEach(b => (b.visible = true));
const fx = new Particles(900, { size: .3, light: false }); W.root.add(fx.mesh);
const dust = new Particles(300, { size: .3 }); W.root.add(dust.mesh);
const air = new Particles(260, { size: .18, light: false }); W.root.add(air.mesh);

/* ---------- effects ---------- */
function burst(p, cols, n = 24, sp = 6, g = 6) {
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = sp * (.6 + R() * .6);
    fx.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * r * s, vy: u * s + 2, vz: Math.sin(a) * r * s, g, drag: 1.4, life: .7 + R() * .5, color: cols[i % cols.length], size: .32, spin: 6 });
  }
}
const puff = (p, n = 10) => { for (let i = 0; i < n; i++) dust.spawn({ x: p.x + (R() - .5) * 1.5, y: p.y + .1, z: p.z + (R() - .5) * 1.5, vx: (R() - .5) * 5, vy: 1 + R() * 2, vz: (R() - .5) * 5, g: 4, drag: 2, life: .6, grow: 1.5, color: R() < .5 ? 0xf2efe6 : 0xd9f7c4, size: .35 }); };
const bounce = u => { const n = 7.5625, d = 2.75; if (u < 1 / d) return n * u * u; if (u < 2 / d) return n * (u -= 1.5 / d) * u + .75; if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + .9375; return n * (u -= 2.625 / d) * u + .984375; };
const drops = [];
function dropParts(parts, t0, { gap = .12, h = 16, dur = .55, onLand = null } = {}) {
  parts.forEach((o, k) => { o.userData.home = o.userData.home || o.position.clone(); o.visible = false; drops.push({ o, t: t0 + k * gap, h, dur, onLand, landed: false }); });
}
function stepDrops() {
  for (const d of drops) {
    const u = (ft - d.t) / d.dur;
    d.o.visible = u > 0;
    if (u <= 0) continue;
    d.o.position.copy(d.o.userData.home); d.o.position.y += d.h * (1 - bounce(clamp(u)));
    if (u >= .36 && !d.landed) { d.landed = true; d.onLand && d.onLand(d.o); }
  }
}
const landFx = o => { const p = new THREE.Vector3(); o.getWorldPosition(p); shake = Math.max(shake, .22); puff(p); return p; };
const fxl = $('.fxl'), speedEl = $('.speed');
function ring(p, color = '#fff', size = 90, cls = '') {
  const v = view.project(p); if (v.behind) return;
  const e = document.createElement('i'); e.className = 'ring ' + cls; e.style.cssText = `left:${v.x}px;top:${v.y}px;--c:${color};--s:${size}px`;
  fxl.appendChild(e); setTimeout(() => e.remove(), 900);
}
function pop(p, text, cls = 'plus') {
  const v = view.project(p); const e = document.createElement('b');
  e.className = cls; e.textContent = text; e.style.cssText = `left:${v.x}px;top:${v.y}px`;
  fxl.appendChild(e); setTimeout(() => e.remove(), 900);
}
const pillar = (() => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: prizes[0].g.userData.halo.material.map, color: 0xfff2a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.set(4, 30, 1); W.root.add(m); m.userData.t0 = -9; return m; })();
function flash() { const f = $('.flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }

/* ---------- overlays ---------- */
const cap = $('.cap');
function say(text, tone = 'yellow') { cap.className = 'cap ' + tone; cap.querySelector('b').innerHTML = text.replace(/\*(.+?)\*/g, '<em>$1</em>'); void cap.offsetWidth; cap.classList.add('on'); }
const unsay = () => cap.classList.add('out');
let capTimer = null;
const sayFor = (text, tone, s = 2.6) => { say(text, tone); clearTimeout(capTimer); capTimer = setTimeout(unsay, s * 1000); };
const sparkEl = $('[data-sparks]'), homesEl = $('[data-homes]');
const bump = el => { const c = el.closest('.chip'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); };
const pins = $('.pins');
const homeIcons = W.homes.map(() => { const e = document.createElement('div'); e.className = 'hi'; e.innerHTML = BOLT; pins.appendChild(e); return e; });
const prizeTag = document.createElement('div'); prizeTag.className = 'prize-tag'; prizeTag.textContent = 'Power prize'; pins.appendChild(prizeTag);
// every two sparks switch on one home, as in the lab
const homesFromSparks = () => Math.min(11, Math.floor(S.sparks / 2));
let shownHomes = 0;
function showHomes(n) { if (n === shownHomes) return; shownHomes = n; homesEl.textContent = n; bump(homesEl); panel.querySelectorAll('.tp-homes i').forEach((e, i) => e.classList.toggle('on', i < n)); panel.querySelector('.tp-count').textContent = n; }
const ORDER = [0, 1, 2, 3, 8, 9, 4, 5, 6, 7, 10];
function powerHome(i, on) { const h = W.homes[i]; if (!!h.target === on) return; h.target = on ? 1 : 0; homeIcons[i].classList.toggle('on', on); if (on) { ring(h.icon, '#ffd23f', 110); burst(h.icon.clone().add(V(0, -2, 0)), [0xffd23f, 0xffffff, 0x16ffc6], 18, 5); } showHomes(W.homes.filter(x => x.target).length); }

/* ---------- the prompt card ---------- */
const card = $('.pcard'), tilesEl = card.querySelector('.pc-tiles'), sendBtn = card.querySelector('.pc-send'), playBtn = card.querySelector('.pc-play');
const ICONS = {
  wind: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="15" y="12" width="2.4" height="18" rx="1" fill="#9aa8b4"/><g fill="#2b6fe0"><path d="M16 12 15 1.5c2.6.3 3.6 4 1 10.5z"/><path d="M16 12l9.4 4.6c-1.5 2.2-5.3 1.5-9.4-4.6z"/><path d="M16 12 6.4 16.4c-.8-2.5 2.1-5 9.6-4.4z"/></g><circle cx="16.2" cy="12" r="1.8" fill="#14213a"/></svg>',
  sun: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="6.5" fill="#ffb81a"/><g stroke="#ffb81a" stroke-width="2.6" stroke-linecap="round"><path d="M16 2.5v3.5M16 26v3.5M2.5 16H6M26 16h3.5M6.5 6.5l2.5 2.5M23 23l2.5 2.5M6.5 25.5 9 23M23 9l2.5-2.5"/></g></svg>',
  water: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3c5 7 9 11.5 9 16.5a9 9 0 0 1-18 0C7 14.5 11 10 16 3z" fill="#1e9bf0"/><path d="M11.5 19.5a4.5 4.5 0 0 0 4.5 4.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/></svg>',
  none: '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="11" fill="none" stroke="#9aa8b4" stroke-width="3"/><path d="M8.5 23.5 23.5 8.5" stroke="#9aa8b4" stroke-width="3" stroke-linecap="round"/></svg>',
  bat1: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="10" y="9" width="12" height="18" rx="2.5" fill="#22303f"/><rect x="13.5" y="6" width="5" height="3" rx="1" fill="#ff4f4f"/><rect x="12.5" y="17" width="7" height="7" rx="1" fill="#ffd23f"/></svg>',
  bat4: '<svg viewBox="0 0 32 32" aria-hidden="true"><g fill="#22303f"><rect x="2" y="21" width="6" height="8" rx="1.2"/><rect x="9.5" y="16" width="6" height="13" rx="1.2"/><rect x="17" y="11" width="6" height="18" rx="1.2"/><rect x="24.5" y="5" width="6" height="24" rx="1.2"/></g><g fill="#ffd23f"><rect x="3.3" y="24" width="3.4" height="3"/><rect x="10.8" y="22" width="3.4" height="5"/><rect x="18.3" y="19" width="3.4" height="8"/><rect x="25.8" y="15" width="3.4" height="12"/></g></svg>'
};
const QUESTIONS = [
  { q: "What should make the town's power?", before: 'Use ', after: '.', key: 'source', tiles: [
    { id: 'wind', icon: 'wind', label: 'Wind turbines', fill: 'wind turbines', reply: 'Jump into the wind by the turbines. It lifts you up high. The wind can blow day and night.' },
    { id: 'solar', icon: 'sun', label: 'Solar panels', fill: 'solar panels', reply: 'Your panels power floating platforms. Jump on them while the sun shines.' },
    { id: 'water', icon: 'water', label: 'Water wheels', fill: 'water wheels', reply: 'Water wheels need a river, so I put one in the stream. It pumps a water jet. Stand in it to fly up.' }] },
  { q: 'How many batteries should I add?', before: 'Add ', after: '.', key: 'bats', tiles: [
    { id: 0, icon: 'none', label: 'No battery', fill: 'no battery', reply: 'With no battery, nothing is saved for later. The high sparks are out of reach.' },
    { id: 1, icon: 'bat1', label: '1 battery', fill: '1 battery', reply: 'One battery stores a little spare power, but it is not tall enough to reach the high sparks.' },
    { id: 4, icon: 'bat4', label: '4 batteries', fill: '4 batteries', reply: 'Batteries store spare power for the evening. Climb all 4 to reach the high sparks!' }] }
];
let picked = null, typer = null;
function openCard(n) {
  const Q = QUESTIONS[n]; picked = null;
  card.querySelector('.pc-n').textContent = 'Power prize ' + (n + 1);
  card.querySelector('.pc-q').textContent = Q.q;
  card.querySelector('.pc-prompt p').innerHTML = `${Q.before}<span class="blank">…</span>${Q.after}`;
  tilesEl.className = 'pc-tiles';
  tilesEl.innerHTML = Q.tiles.map((t, i) => `<button type="button" aria-pressed="false" data-i="${i}">${ICONS[t.icon]}<span>${t.label}</span></button>`).join('');
  card.classList.remove('replied'); sendBtn.disabled = true; card.querySelector('.pc-guide p').textContent = '';
  card.classList.add('on'); game.classList.add('busy');
  setTimeout(() => tilesEl.querySelector('button')?.focus({ preventScroll: true }), 350);
}
tilesEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || card.classList.contains('replied')) return;
  const Q = QUESTIONS[S.next - 1], t = Q.tiles[+b.dataset.i]; picked = t;
  tilesEl.classList.add('chosen'); tilesEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  const bl = card.querySelector('.blank'); bl.textContent = t.fill; bl.classList.remove('filled'); void bl.offsetWidth; bl.classList.add('filled');
  sendBtn.disabled = false;
});
sendBtn.addEventListener('click', () => {
  if (!picked) return;
  const Q = QUESTIONS[S.next - 1]; plan[Q.key] = picked.id;
  card.classList.add('replied'); typer = { el: card.querySelector('.pc-guide p'), text: picked.reply, t0: ft };
  build(Q.key, picked.id);
  setTimeout(() => playBtn.focus({ preventScroll: true }), 400);
});
playBtn.addEventListener('click', () => { card.classList.remove('on'); game.classList.remove('busy'); runLook(); S.mode = 'play'; game.focus({ preventScroll: true }); });

// the AI drops the child's choice into the level
function build(key, id) {
  const t0 = ft + .25;
  if (key === 'source') {
    promptLook(7.5, 34, -.6);
    if (id === 'wind') { levelTurbines.forEach((tb, i) => dropParts(partsOf(tb), t0 + i * .35, { gap: .16, h: 18, onLand: o => ring(landFx(o), '#59c7fc', 70) })); columnOn = 'wind'; }
    if (id === 'solar') { solarPads.forEach((p, i) => dropParts([p], t0 + i * .35, { h: 14, onLand: o => { ring(landFx(o), '#ffd23f', 90); burst(o.position, [0xffd23f, 0x9fd8ff, 0xffffff], 20, 5, 4); } })); solarOn = true; }
    if (id === 'water') { dropParts([wheel], t0, { h: 14, onLand: o => ring(landFx(o), '#59c7fc', 90) }); dropParts([jetPipe], t0 + .5, { h: 14, onLand: o => ring(landFx(o), '#59c7fc', 80) }); columnOn = 'water'; promptLook(-6, 30, -.6); setTimeout(() => promptLook(7.5, 34, -.6), 1600); }
  } else {
    nBats = 0; let k = 0; const n = id;
    promptLook(6.5, 26);
    bats.forEach((b, i) => { if (i >= n) return; b.children.forEach((c, j) => dropParts([c], t0 + (k++) * .13, { h: 14, dur: .5, onLand: o => {
      const p = landFx(o); p.y += 1.5;
      for (let m = 0; m < 8; m++) fx.spawn({ x: p.x + (R() - .5) * 1.6, y: p.y, z: p.z + .9, vx: (R() - .5) * 3, vy: 4 + R() * 5, vz: (R() - .5) * 2, g: 3, drag: 1, life: .5, color: R() < .5 ? 0x16ffc6 : 0xffd23f, size: .2, spin: 9 });
      if (j === i) { nBats = Math.max(nBats, i + 1); ring(p, '#16ffc6', 90); }
    } })); });
    if (n === 4) sayFor('Batteries store power for *later.*', 'green', 2.8);
  }
}

/* ---------- the town panel and result ---------- */
const panel = $('.tpanel');
panel.querySelector('.tp-homes').innerHTML = '<i></i>'.repeat(11);
const hh = h => (h > 12 ? h - 12 : h) + ' pm';
function lightsOutHour() { if (plan.source !== 'solar') return null; return plan.bats >= 4 ? null : plan.bats === 1 ? 20 : 19; }
function showResult() {
  const out = lightsOutHour(), homes = homesFromSparks(), all = S.sparks >= SPARKS.length - 1;
  const stars = [true, out == null, homes >= 8 && all];
  $('.r-stars').innerHTML = stars.map(w => `<span class="${w ? 'won' : ''}"></span>`).join('');
  $('#r-h').textContent = out == null ? 'The lights stayed on until bedtime!' : `The lights went out at ${hh(out)}.`;
  const why = [];
  why.push({ wind: 'The wind can blow day and night, so your turbines kept making power after sunset.', solar: 'Solar panels make power only while the sun is up. The sun set at about 7 pm.', water: 'A river flows all day and all night, so your water wheel kept turning.' }[plan.source]);
  if (plan.source === 'solar') why.push(plan.bats >= 4 ? 'Your 4 batteries stored spare sunshine power for the evening.' : plan.bats === 1 ? 'One battery stored a little spare power, enough for one more hour.' : 'With no battery, nothing was saved for the evening.');
  else why.push(plan.bats > 0 ? 'Your batteries stored spare power for later, in case it is needed.' : 'With no battery, nothing was saved for later. Tonight your plan did not need it.');
  why.push(`You collected ${S.sparks} sparks, which switched on ${homes} of 11 homes.`);
  $('.r-why').innerHTML = why.map(w => `<li>${w}</li>`).join('');
  $('.r-plan').textContent = `Your plan: use ${QUESTIONS[0].tiles.find(t => t.id === plan.source).fill}, add ${QUESTIONS[1].tiles.find(t => t.id === plan.bats).fill}.`;
  $('.result').classList.add('on');
  setTimeout(() => $('.again').focus({ preventScroll: true }), 500);
}
$('.again').addEventListener('click', () => location.reload());

/* ---------- prize sequences ---------- */
function prizeHit(i) { flash(); prizeTag.classList.remove('on'); shake = .55; burst(prizes[i].g.position, [0xffd23f, 0xffffff, 0xffb21a, 0x16ffc6], 80, 10, 4); prizes[i].g.visible = false; S.cheer = ft; pillar.position.copy(prizes[i].g.position).add(V(0, 8, 0)); pillar.userData.t0 = ft; ring(prizes[i].g.position, '#ffd23f', 260, 'big'); ring(prizes[i].g.position, '#ffffff', 160); }
const SEQS = [
  [[0, () => { prizeHit(0); promptLook(5.5); }], [.6, () => openCard(0)]],
  [[0, () => { prizeHit(1); promptLook(5.5); }], [.6, () => openCard(1)]],
  [
    [0, () => { prizeHit(2); game.classList.add('busy'); }],
    [.5, () => $('.stamp').classList.add('on')],
    [1.0, () => { move(TOWN, 3.0); buildTown(ft + 1.1); }],
    [1.8, () => $('.stamp').classList.add('out')],
    [2.6, () => homeIcons.forEach(e => e.classList.add('show'))],
    [3.2, () => { panel.classList.add('on'); panel.querySelector('.tp-hour').textContent = hh(4); }],
    [3.6, () => say('Now watch the *evening.*', 'pink')],
    [4.4, () => { S.duskT0 = ft; S.evening = ft; }],
    [6.0, () => unsay()],
    [9.0, () => move(FINAL, 3.0)],
    [11.4, () => { const out = lightsOutHour(); if (out == null) { hud.celebrate(3, 'Lights on until bedtime', { badge: 'Badge earned: Clean energy hero', style: 'confetti' }); S.fireworks = ft; } }],
    [13.6, () => { hud.uncelebrate(); panel.classList.remove('on'); showResult(); S.mode = 'done'; }]
  ]
];
function buildTown(t0) {
  if (plan.source === 'wind') W.turbines.forEach((tb, i) => dropParts(partsOf(tb), t0 + i * .22, { gap: .12, h: 22, onLand: o => { const p = new THREE.Vector3(); o.getWorldPosition(p); ring(p, '#ffffff', 50); } }));
  if (plan.source === 'solar') { W.panels.set(true); W.shine.set(true); }
  if (plan.source === 'water') townWheels.forEach((w, i) => dropParts([w], t0 + i * .3, { h: 18, onLand: o => ring(landFx(o), '#59c7fc', 80) }));
  W.windOn = plan.source === 'wind' ? 1 : 0;
  townBats.forEach((b, i) => { if (i < Math.min(4, plan.bats)) dropParts([b], t0 + .8 + i * .2, { h: 14, onLand: o => ring(landFx(o), '#16ffc6', 70) }); });
}

/* ---------- camera ---------- */
const EYE = { dist: 18, el: .08, az: 0, fov: 34, sway: 0 };
const TOWN = { target: A.town.clone().add(V(0, 0, -2)), dist: 66, el: .55, az: -.18, fov: 30 };
const FINAL = { target: A.town.clone().add(V(0, 4, -8)), dist: 76, el: .34, az: .05, fov: 30 };
const WIDE = { target: V(gx(26), ground0(0) + 1, A.laneZ - 8), dist: 50, el: .34, az: .2, fov: 32, sway: 0 };
let shot = null, base = null, eyeY = null;
const look = { lead: 3.2, dy: 0, dist: 18, el: .08 }, lookT = { ...look };
const promptLook = (lead = 4, dist = 22, dy = -2.3) => Object.assign(lookT, { lead, dy, dist, el: .26 });
const runLook = () => Object.assign(lookT, { lead: 3.2, dy: 0, dist: 18, el: .08 });
function move(to, d) { shot = { from: { ...base, target: base.target.clone() }, to, t0: ft, d }; }
function camAt() {
  const k = easeInOut(clamp((ft - shot.t0) / shot.d)), a = shot.from, b = shot.to;
  return { target: a.target.clone().lerp(b.target, k), dist: lerp(a.dist, b.dist, k), el: lerp(a.el, b.el, k), az: lerp(a.az, b.az, k), fov: lerp(a.fov, b.fov, k), sway: 0 };
}

/* ---------- input ---------- */
const keys = { left: false, right: false, jump: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'jump', KeyW: 'jump', Space: 'jump' };
function press(k, on) { if (k === 'jump' && on && !keys.jump) P.buffer = .14; if (k === 'jump' && !on) P.cut = true; keys[k] = on; }
addEventListener('keydown', e => { const k = KEYMAP[e.code]; if (!k || e.target.closest?.('button') && e.code === 'Space') return; if (S.mode === 'play') e.preventDefault(); if (!e.repeat) press(k, true); });
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) press(k, false); });
addEventListener('blur', () => { keys.left = keys.right = keys.jump = false; });
game.querySelectorAll('.pad button').forEach(b => {
  const k = b.dataset.k, on = v => e => { e.preventDefault(); b.classList.toggle('on', v); press(k, v); };
  b.addEventListener('pointerdown', e => { b.setPointerCapture?.(e.pointerId); on(true)(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, on(false)));
});
if (matchMedia('(pointer: coarse)').matches) game.classList.add('touch');
addEventListener('touchstart', () => game.classList.add('touch'), { once: true, passive: true });

/* ---------- physics ---------- */
const RAD = .55, GRAV = 42, JUMP = 15.5, RUN = 8.2;
const batTop = x => { for (let i = 0; i < BATS.length; i++) if (nBats > i && Math.abs(x - BATS[i]) <= 1.05) return ground0(x) + (i + 1) * 1.5; return -1e9; };
const solid = x => (x < .3 || x > 126.5 ? 1e9 : Math.max(ground0(x), batTop(x)));
function floorAt(x, y0, y1) {
  let f = Math.max(solid(x - RAD + .05), solid(x), solid(x + RAD - .05));
  const plats = [...(solarOn ? SOLAR : []), SHELF];
  for (const p of plats) { const top = ground0(p.x0) + p.top; if (x + RAD > p.x0 && x - RAD < p.x1 && y0 >= top - .08 && y1 <= top + .02) f = Math.max(f, top); }
  return f;
}
function respawn() {
  flash(); ring(H.position, '#59c7fc', 140);
  P.x = CHECKS[P.check]; P.y = ground0(P.x) + 6; P.vx = P.vy = 0; P.hurt = ft;
  sayFor('Splash! Try that jump *again.*', 'blue', 2.2);
}
function physics(dt) {
  if (S.mode !== 'play') { P.vx = 0; return; }
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  if (dir) P.face = dir;
  // inside the wind or a water jet the hero drifts slowly, so there is time to rise
  const drift = inColumn() && P.y < ground0(52) + 10 ? .35 : 1;
  P.vx += (dir * RUN * drift - P.vx) * Math.min(1, dt * (P.onGround ? 14 : 6));
  P.coyote = P.onGround ? .1 : P.coyote - dt; P.buffer -= dt;
  if (P.buffer > 0 && P.coyote > 0) { P.vy = JUMP; P.onGround = false; P.coyote = 0; P.buffer = 0; P.cut = false; puff(H.position, 6); }
  if (P.cut && P.vy > 4 && !inColumn()) P.vy *= .55;
  P.cut = false;
  // wind or a water jet lifts the hero
  if (inColumn() && P.y < ground0(52) + 11) { P.vy = Math.min(P.vy + 70 * dt, 10); P.onGround = false; }
  else P.vy -= GRAV * dt;
  // horizontal: stop at walls taller than a small step
  const nx = P.x + P.vx * dt, edge = nx + Math.sign(P.vx) * RAD;
  if (P.vx && solid(edge) > P.y + .45) P.vx = 0; else P.x = nx;
  // vertical: land on the ground, batteries or platforms
  const ny = P.y + P.vy * dt, f = floorAt(P.x, P.y, ny);
  if (ny <= f && P.vy <= 0) { if (!P.onGround && P.vy < -6) { P.landed = ft; shake = Math.max(shake, .25); puff(H.position, 12); } P.y = f; P.vy = 0; P.onGround = true; }
  else { P.y = ny; if (P.onGround && ny < f - .05) P.onGround = false; if (ny > f + .05) P.onGround = false; }
  // falling into the stream
  if (P.x > STREAM[0] + .3 && P.x < STREAM[1] - .3 && P.y < ground0(26) + .6) { burst(H.position, [0x59c7fc, 0xffffff, 0x9fe8ff], 30, 6, 8); respawn(); }
  // checkpoints and prizes
  CHECKS.forEach((c, i) => { if (P.x > c && i > P.check && P.onGround) P.check = i; });
  if (S.next < PRIZES.length && Math.abs(P.x - PRIZES[S.next]) < 1.15) { P.x = PRIZES[S.next] - 1.1; P.vx = 0; S.mode = 'prize'; S.seq = SEQS[S.next]; S.seqT = ft; S.si = 0; S.next++; P.check = Math.max(P.check, [2, 4, 4][S.next - 1]); }
  // the critter: stomp it from above, or get bumped back
  const bx = BUG.x, by = ground0(bx);
  if (ft - BUG.squashed > 3 && Math.abs(P.x - bx) < 1.25 && P.y < by + 1.3) {
    if (P.vy < 0 && P.y > by + .5) { P.vy = 12; BUG.squashed = ft; burst(bug.position.clone().add(V(0, 1, 0)), [0x7a4fe0, 0xffb21a, 0xffffff], 24, 6, 6); ring(bug.position, '#b48cff', 100); pop(bug.position.clone().add(V(0, 2, 0)), 'Boing!'); }
    else if (ft - P.hurt > .8) { P.hurt = ft; P.vx = 0; P.x += (P.x < bx ? -1 : 1) * .6; P.vy = 8; P.onGround = false; shake = .4; pop(H.position.clone().add(V(0, 3, 0)), 'Ouch!', 'ouch'); }
  }
}
const inColumn = () => columnOn && P.x > COLUMN[0] && P.x < COLUMN[1];

/* ---------- per frame ---------- */
const view = new View(game, { maxDpr: 2, onUpdate: (t, dt) => frame(t, dt) });
base = { ...WIDE }; W.camOverride = base; W.snapCam();
view.setWorld(W);
game.classList.add('ready');
let started = false, t0 = null;

function frame(t, dt) {
  if (t0 == null) { t0 = t; W.build(); }
  ft = t - t0;
  if (!started && ft > 1.8 && S.mode === 'load') { S.mode = 'title'; $('.title').classList.add('on'); setTimeout(() => $('.go').focus({ preventScroll: true }), 400); }
  if (S.seq) while (S.si < S.seq.length && S.seq[S.si][0] + S.seqT <= ft) S.seq[S.si++][1]();
  hud.tick(ft);
  if (typer) { const n = Math.floor((ft - typer.t0) * 55); typer.el.textContent = typer.text.slice(0, n); if (n >= typer.text.length) typer = null; }
  W.water.material.opacity = .85 * clamp((ft - 1.3) / .6);

  // pickups and props pop in after the ground has landed
  [...sparks, bug, ...prizes.map(p => p.g), ...prizes.map(p => p.pad), shelf].forEach(o => { if (o.userData.got > -1 || o.userData.popped) return; const at0 = 1.4 + (o.position.x - A.wx(0)) * .012; const k = easeBack(clamp((ft - at0) / .45)); o.scale.setScalar(Math.max(.001, k)); if (ft > at0 + .5) o.userData.popped = 1; });

  // the hero drops in, then plays
  for (let n = 0, sub = Math.ceil(dt / (1 / 120)); n < sub; n++) physics(dt / sub);
  if (S.mode === 'intro') {
    const fall = clamp((ft - S.t) / .5); P.y = ground0(P.x) + 16 * (1 - fall * fall); H.visible = true;
    if (fall >= 1) { S.mode = 'play'; P.y = ground0(P.x); P.landed = ft; shake = .55; puff(H.position, 12); ring(H.position, '#ffffff', 150); burst(H.position.clone().add(V(0, .4, 0)), [0xffd23f, 0xffffff, 0x59c7fc], 30, 7, 6); sayFor('Run and jump to the glowing *power prize.*', 'blue', 3); }
  }
  H.position.set(gx(P.x), P.y, A.laneZ);
  const cheering = S.cheer != null && ft - S.cheer < 1.2;
  H.rotation.y = cheering ? .25 : S.mode === 'prize' ? lerp(H.rotation.y, .35, Math.min(1, dt * 6)) : P.face > 0 ? Math.PI / 2 - .35 : -Math.PI / 2 + .35;
  if (cheering) { H.cheer(ft); H.userData.body.scale.set(1, 1, 1); }
  else if (!P.onGround && S.mode === 'play') { H.air(inColumn() ? 1 : .6); H.userData.body.scale.set(.94, 1.08, .94); H.rotation.z = inColumn() ? Math.sin(ft * 8) * .08 : 0; }
  else {
    const sp = Math.abs(P.vx);
    H.rotation.z = 0; H.ground(); H.run(ft * 15, clamp(sp / 8));
    if (sp > 4 && Math.floor(ft * 12) !== Math.floor((ft - dt) * 12)) dust.spawn({ x: H.position.x - P.face * .6, y: H.position.y + .15, z: H.position.z + (R() - .5) * .6, vx: -P.face * 1.5, vy: 1, vz: 0, g: 2, drag: 2, life: .5, grow: 1.4, color: 0xeaf7dc, size: .28 });
    const sq = clamp((ft - P.landed) / .22); H.userData.body.scale.set(1 + .14 * (1 - sq), 1 - .16 * (1 - sq), 1 + .14 * (1 - sq));
  }
  H.traverse(m => { if (m.material && m.isMesh) m.visible = !(ft - P.hurt < .8 && Math.floor(ft * 14) % 2); });

  // sparks
  for (const s of sparks) {
    const d = s.userData;
    if (d.got < 0) {
      s.rotation.y = ft * 4 + d.x; s.position.y = d.y + Math.sin(ft * 4 + d.x) * .15;
      if (S.mode === 'play' && Math.abs(P.x - d.x) < .9 && Math.abs(d.y - (P.y + 1.2)) < 1.5) {
        d.got = ft; S.sparks++; sparkEl.textContent = S.sparks; bump(sparkEl);
        burst(s.position, [0xffd23f, 0xffffff, 0xffb21a], 14, 5, 3); pop(s.position, '+1'); ring(s.position, '#ffd23f', 60);
        const n = homesFromSparks(); for (let i = 0; i < n; i++) powerHome(ORDER[i], true);
      }
    } else { const k = clamp((ft - d.got) / .25); s.scale.setScalar(Math.max(.001, (1 + k * .6) * (1 - k))); s.position.y += dt * 6; }
  }
  // the critter patrols
  if (ft - BUG.squashed > 3) { BUG.x += BUG.dir * 1.6 * dt; if (BUG.x > 37 || BUG.x < 31.6) BUG.dir *= -1; }
  const sq = clamp((ft - BUG.squashed) / 3);
  bug.position.set(gx(BUG.x), ground0(BUG.x) + Math.abs(Math.sin(ft * 5)) * .25 * (sq >= 1 ? 1 : 0), A.laneZ);
  bug.scale.set(1, sq < 1 ? Math.max(.15, sq < .1 ? .2 : sq) : 1, 1); bug.rotation.y = BUG.dir > 0 ? .4 : -.4;
  prizes.forEach((p, i) => { p.g.rotation.y = ft * 2.2 + i; p.g.position.y = ground0(PRIZES[i]) + 3 + Math.sin(ft * 3 + i) * .3; p.g.userData.halo.material.opacity = .6 + Math.sin(ft * 6) * .2; });

  // what the AI built: turbines turning, a wind or water column, glowing panels, the wheel
  stepDrops();
  levelTurbines.forEach((tb, i) => { tb.userData.blades.rotation.z -= dt * 5 * (columnOn === 'wind' ? 1 : 0); });
  wheel.userData.wheel.rotation.z -= dt * 1.6; townWheels.forEach(w => (w.userData.wheel.rotation.z -= dt * 1.6));
  if (columnOn && drops.length) for (let i = 0; i < 3; i++) air.spawn({ x: gx(COLUMN[0] + R() * (COLUMN[1] - COLUMN[0])), y: ground0(50) + R() * 2, z: A.laneZ + (R() - .5) * 2.4, vx: (R() - .5) * .6, vy: 7 + R() * 5, vz: 0, life: 1.4, drag: .2, color: columnOn === 'water' ? (R() < .5 ? 0x59c7fc : 0xbfeaff) : (R() < .5 ? 0xffffff : 0xbfeaff), size: .14 + R() * .12, grow: 1.5 });
  air.update(dt);
  solarPads.forEach((p, i) => { if (p.visible) p.children[1].material.emissive.setHex(mixHex(0x3a7ab0, 0x9fd8ff, .5 + .5 * Math.sin(ft * 3 + i))); });

  // camera
  for (const k of ['lead', 'dy', 'dist', 'el']) look[k] += (lookT[k] - look[k]) * Math.min(1, dt * 3);
  if (!shot) {
    const ty = P.y + 1.5, lead = S.mode === 'play' ? P.face * look.lead : look.lead;
    eyeY = eyeY == null ? ty : eyeY + (ty - eyeY) * Math.min(1, dt * 3.5);
    let b = { ...EYE, dist: look.dist, el: look.el, target: V(H.position.x + lead, eyeY + look.dy, A.laneZ) };
    if (S.mode === 'load' || S.mode === 'title' || S.mode === 'intro') {
      const k = S.mode === 'intro' ? easeInOut(clamp((ft - S.t + .4) / 1.1)) : 0, w = { ...WIDE, dist: WIDE.dist - Math.min(ft, 6) * 1.2 };
      b = { target: w.target.clone().lerp(b.target, k), dist: lerp(w.dist, b.dist, k), el: lerp(w.el, b.el, k), az: lerp(w.az, b.az, k), fov: lerp(w.fov, b.fov, k), sway: 0 };
    }
    base = b;
  } else base = camAt();
  W.camOverride = base;
  if (shake > 0 && !reduce) { shake = Math.max(0, shake - dt * 1.6); const s = shake * shake; W.camOverride = { ...base, target: base.target.clone().add(V((R() - .5) * s, (R() - .5) * s, 0)) }; }
  W.snapCam();

  // the evening in the town
  if (S.evening != null) {
    const k = clamp((ft - S.evening) / 5), hour = 16 + k * 5, h = Math.floor(hour), out = lightsOutHour(), lit = homesFromSparks();
    if (h !== S.hour) { S.hour = h; panel.querySelector('.tp-hour').textContent = hh(h); }
    const dark = out != null && hour >= out;
    // at lights out the homes go dark one by one
    if (dark) { S.darkT = S.darkT ?? ft; ORDER.forEach((hi, i) => { if (W.homes[hi].target && ft - S.darkT > (lit - 1 - i) * .18) powerHome(hi, false); }); }
    if (dark && !S.saidOut) { S.saidOut = 1; say(`The lights went out at *${hh(out)}.*`, 'pink'); setTimeout(unsay, 2400); }
  }
  if (S.duskT0 != null) W.dusk = smooth(0, 1, (ft - S.duskT0) / 3.4);
  const DAY = [[0, 0x1f8bff], [.55, 0x6cc8ff], [1, 0xd8f4ff]], DUSK = [0x5b4bff, 0xff5fa2, 0xffc26b];
  W.skyStops = DAY.map(([o, c], i) => [o, mixHex(c, DUSK[i], W.dusk)]);
  W.sun.color.setHex(mixHex(0xfff2d6, 0xff9a52, W.dusk)); W.sun.intensity = lerp(3.1, 2.9, W.dusk);
  W.sunDir.set(lerp(-.35, -.8, W.dusk), lerp(.9, .55, W.dusk), .7).normalize();
  W.hemi.color.setHex(mixHex(0xe4f4ff, 0xffd0e0, W.dusk)); W.hemi.intensity = lerp(1.35, 1.75, W.dusk);
  W.scene.fog.color.setHex(mixHex(0xcdeeff, 0xffb3c8, W.dusk));
  if (S.fireworks != null && ft - S.fireworks < 4 && ft >= S.fwNext) {
    S.fwNext = ft + .22 + R() * .25;
    burst(A.town.clone().add(V((R() - .5) * 60, 22 + R() * 12, (R() - .5) * 26 - 6)), [[0xffd23f, 0xffffff], [0xff4f8b, 0xffd23f], [0x16ffc6, 0x59c7fc], [0xb48cff, 0xffffff]][Math.floor(R() * 4)], 60, 12, 3);
  }
  fx.update(dt); dust.update(dt);
  { const k = ft - pillar.userData.t0; pillar.material.opacity = k < 0 ? 0 : Math.max(0, .9 * (1 - k / 1.4)); pillar.scale.set(4 + k * 3, 30, 1); }
  speedEl.style.opacity = S.mode === 'play' && P.onGround ? clamp((Math.abs(P.vx) - 6) / 3) * .45 : 0;

  // labels pinned to the world
  W.homes.forEach((h, i) => { const p = view.project(h.icon); homeIcons[i].style.transform = `translate(${p.x}px, ${p.y}px)`; });
  const near = S.mode === 'play' && S.next < PRIZES.length && Math.abs(PRIZES[S.next] - P.x) < 14;
  prizeTag.classList.toggle('on', near);
  if (near) { const pp = view.project(prizes[S.next].g.position.clone().add(V(0, 3.2, 0))); prizeTag.style.transform = `translate(${pp.x}px, ${pp.y}px) translate(-50%, -100%)`; }
}

$('.go').addEventListener('click', () => { $('.title').classList.remove('on'); started = true; S.mode = 'intro'; S.t = ft; P.x = 2; game.focus({ preventScroll: true }); });
// for automated checks
window.__power = { P, S, plan, keys, press };
