// Power Run: a square social film that follows how children play the game.
// The hero runs and jumps at eye level. At each glowing power prize the children tell the AI what to
// build, and the AI builds it into the level (wind that lifts you, batteries you climb). The last prize
// swoops out over Eco Town, where the homes switch on through the evening.
// Plays in real time in a browser, or frame by frame under tools/social/render.mjs.
import { THREE, View, Particles, clamp, lerp, smooth, easeBack, easeInOut, mixHex } from '/js/game/engine.js?v=20261018b';
import { Hud } from '/js/game/hud.js?v=20261018b';
import { powerRunWorld, hero, critter, spark, prize, turbine, battery } from '/tools/social/power-run-world.js';

const film = document.querySelector('.film');
const $ = s => film.querySelector(s);
const W = powerRunWorld();
const A = W.anchors;
const hud = new Hud($('.hudroot'), { name: 'Power Run', tag: 'Energy', icon: 'bolt', bot: '#ffcf3d' });
const BOLT = '<svg viewBox="0 0 24 24"><path d="M13.5 2 4.5 13.5h6.2L9.8 22l9-11.6h-6.2z"/></svg>';
let rnd = 7; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- the course ---------- */
// x positions along the lane. Prizes stop the hero; jumps are arcs between two surfaces.
const CRITTER_X = 34.3;
const PRIZES = [42, 78, 100];
const BATS = [82.5, 85, 87.5, 90];            // battery stairs, each 1.5 taller than the last
const WIND_X = [47, 52, 57];                  // turbines the AI builds beside the lane
const JUMPS = [
  [10.6, 15.4, 2.4], [21.6, 30.6, 3.2], [31.4, 37.2, 3],
  [49.6, 60.6, 6.5, 'wind'],                  // the wind lifts the hero onto the high wall
  [70.2, 75.2, 1.8],
  [80.3, 82.6, 1.3], [83.1, 85.1, 1.3], [85.6, 87.6, 1.3], [88.1, 90.1, 1.3], [90.6, 93.4, 1.4]
];
const SPARK_X = [5, 7, 9, 13, 18, 20, 26, 34.3, 38, 52, 54.5, 57, 64, 67, 82.6, 85.1, 87.6, 90.1, 95, 97];

let batsUp = 0;
const batTop = x => { for (let i = 0; i < BATS.length; i++) if (batsUp > i && Math.abs(x - BATS[i]) <= 1.05) return A.laneY(x) + (i + 1) * 1.5; return -1e9; };
const surf = x => Math.max(A.laneY(x), batTop(x));
function pathY(x) {
  for (const [a, b, apex] of JUMPS) if (x > a && x < b) { const u = (x - a) / (b - a); return lerp(surf(a), surf(b), u) + apex * 4 * u * (1 - u); }
  return surf(x);
}
const inJump = x => JUMPS.find(([a, b]) => x > a && x < b);
// the battery stairs only exist once they are built, so their sparks sit on the finished path
const sparkY = x => { const was = batsUp; batsUp = 4; const y = pathY(x); batsUp = was; return y; };

/* ---------- actors ---------- */
const H = hero(); W.root.add(H);
const bug = critter(); bug.position.set(A.wx(CRITTER_X), A.laneY(CRITTER_X), A.laneZ); W.root.add(bug);
const prizes = PRIZES.map(x => { const p = prize(); p.g.position.set(A.wx(x), A.laneY(x) + 3, A.laneZ); p.pad.position.set(A.wx(x), A.laneY(x), A.laneZ); W.root.add(p.g, p.pad); return p; });
const sparks = SPARK_X.map(x => { const s = spark(), y = sparkY(x) + 1.5; s.position.set(A.wx(x), y, A.laneZ); s.userData = { x, y, got: -1 }; W.root.add(s); return s; });
const levelTurbines = WIND_X.map(x => { const t = turbine(); t.position.set(A.wx(x), A.laneY(x), A.laneZ - 3.2); t.scale.setScalar(.001); t.visible = false; W.root.add(t); return t; });
const bats = BATS.map((x, i) => {
  const g = new THREE.Group();
  for (let k = 0; k <= i; k++) { const b = battery(); b.position.y = k * 1.5; g.add(b); }
  g.position.set(A.wx(x), A.laneY(x), A.laneZ); g.scale.setScalar(.001); g.visible = false; W.root.add(g); return g;
});
const fx = new Particles(900, { size: .3, light: false }); W.root.add(fx.mesh);
const wind = new Particles(260, { size: .18, light: false }); W.root.add(wind.mesh);
function burst(p, cols, n = 24, sp = 6, g = 6) {
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = sp * (.6 + R() * .6);
    fx.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * r * s, vy: u * s + 2, vz: Math.sin(a) * r * s, g, drag: 1.4, life: .7 + R() * .5, color: cols[i % cols.length], size: .32, spin: 6 });
  }
}

/* ---------- overlays ---------- */
const cap = $('.cap');
function say(text, tone = 'yellow') {
  cap.className = 'cap ' + tone;
  cap.querySelector('b').innerHTML = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  void cap.offsetWidth; cap.classList.add('on');
}
const unsay = () => cap.classList.add('out');
const sparkEl = $('[data-sparks]'), homesEl = $('[data-homes]');
const bump = el => { const c = el.closest('.chip'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); };
let nSparks = 0, nHomes = 0;
const setHomes = n => { if (n !== nHomes) { nHomes = n; homesEl.textContent = n; bump(homesEl); townRow(); } };

const pins = $('.pins');
const homeIcons = W.homes.map(() => { const e = document.createElement('div'); e.className = 'hi'; e.innerHTML = BOLT; pins.appendChild(e); return e; });
const prizeTag = document.createElement('div'); prizeTag.className = 'prize-tag'; prizeTag.textContent = 'Power prize'; pins.appendChild(prizeTag);
const homesOn = () => W.homes.filter(x => x.target).length;
function powerHome(i) { const h = W.homes[i]; if (h.target) return; h.target = 1; homeIcons[i].classList.add('on'); setHomes(homesOn()); burst(h.icon.clone().add(V(0, -2, 0)), [0xffd23f, 0xffffff, 0x16ffc6], 18, 5); }

// the prompt card: question, the child's prompt with a blank, answer tiles, then the Lab Guide's reply
const card = $('.pcard');
const ICONS = {
  wind: '<svg viewBox="0 0 32 32"><rect x="15" y="12" width="2.4" height="18" rx="1" fill="#9aa8b4"/><g fill="#2b6fe0"><path d="M16 12 15 1.5c2.6.3 3.6 4 1 10.5z"/><path d="M16 12l9.4 4.6c-1.5 2.2-5.3 1.5-9.4-4.6z"/><path d="M16 12 6.4 16.4c-.8-2.5 2.1-5 9.6-4.4z"/></g><circle cx="16.2" cy="12" r="1.8" fill="#14213a"/></svg>',
  sun: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="6.5" fill="#ffb81a"/><g stroke="#ffb81a" stroke-width="2.6" stroke-linecap="round"><path d="M16 2.5v3.5M16 26v3.5M2.5 16H6M26 16h3.5M6.5 6.5l2.5 2.5M23 23l2.5 2.5M6.5 25.5 9 23M23 9l2.5-2.5"/></g></svg>',
  water: '<svg viewBox="0 0 32 32"><path d="M16 3c5 7 9 11.5 9 16.5a9 9 0 0 1-18 0C7 14.5 11 10 16 3z" fill="#1e9bf0"/><path d="M11.5 19.5a4.5 4.5 0 0 0 4.5 4.5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" opacity=".8"/></svg>',
  none: '<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" fill="none" stroke="#9aa8b4" stroke-width="3"/><path d="M8.5 23.5 23.5 8.5" stroke="#9aa8b4" stroke-width="3" stroke-linecap="round"/></svg>',
  bat1: '<svg viewBox="0 0 32 32"><rect x="10" y="9" width="12" height="18" rx="2.5" fill="#22303f"/><rect x="13.5" y="6" width="5" height="3" rx="1" fill="#ff4f4f"/><rect x="12.5" y="17" width="7" height="7" rx="1" fill="#ffd23f"/></svg>',
  bat4: '<svg viewBox="0 0 32 32"><g fill="#22303f"><rect x="2" y="21" width="6" height="8" rx="1.2"/><rect x="9.5" y="16" width="6" height="13" rx="1.2"/><rect x="17" y="11" width="6" height="18" rx="1.2"/><rect x="24.5" y="5" width="6" height="24" rx="1.2"/></g><g fill="#ffd23f"><rect x="3.3" y="24" width="3.4" height="3"/><rect x="10.8" y="22" width="3.4" height="5"/><rect x="18.3" y="19" width="3.4" height="8"/><rect x="25.8" y="15" width="3.4" height="12"/></g></svg>'
};
function openCard({ n, q, before, after, tiles }) {
  card.querySelector('.pc-n').textContent = 'Power prize ' + n;
  card.querySelector('h3').textContent = q;
  card.querySelector('.pc-prompt p').innerHTML = `${before}<span class="blank">…</span>${after}`;
  card.querySelector('.pc-tiles').innerHTML = tiles.map(([ic, t]) => `<button type="button">${ICONS[ic]}<span>${t}</span></button>`).join('');
  card.classList.remove('replied'); card.querySelector('.pc-send').className = 'pc-send'; card.querySelector('.pc-guide p').textContent = '';
  void card.offsetWidth; card.classList.add('on');
}
function choose(i, text) {
  hud.tap();
  card.querySelectorAll('.pc-tiles button').forEach((b, j) => { b.classList.toggle('picked', j === i); b.classList.toggle('dim', j !== i); });
  const bl = card.querySelector('.blank'); bl.textContent = text; bl.classList.add('filled');
  card.querySelector('.pc-send').classList.add('ready');
}
let typer = null;
function reply(text) { card.classList.add('replied'); typer = { el: card.querySelector('.pc-guide p'), text, t0: ft }; }
const closeCard = () => card.classList.remove('on');
const pointAt = el => hud.point(el);

// the town power panel, as in the game
const panel = $('.tpanel');
panel.querySelector('.tp-homes').innerHTML = '<i></i>'.repeat(11);
function townRow() { panel.querySelectorAll('.tp-homes i').forEach((e, i) => e.classList.toggle('on', i < nHomes)); panel.querySelector('.tp-count').textContent = nHomes; }
const setHour = h => { panel.querySelector('.tp-hour').textContent = (h > 12 ? h - 12 : h) + ' pm'; };

function confetti() {
  const c = $('.end .conf'), cols = ['#ffd23f', '#ff4f8b', '#2b6fe0', '#ffffff', '#1f9d55', '#ff8a1f'];
  c.innerHTML = Array.from({ length: 34 }, (_, i) => `<i style="--x:${i % 2 ? 2 + (i * 7) % 12 : 86 + (i * 5) % 12}%;--c:${cols[i % cols.length]};--d:${2.2 + (i % 5) * .35}s;--dl:${-(i % 9) * .3}s"></i>`).join('');
}

/* ---------- sky ---------- */
const DAY = [[0, 0x1f8bff], [.55, 0x6cc8ff], [1, 0xd8f4ff]];
const DUSK = [[0, 0x5b4bff], [.55, 0xff5fa2], [1, 0xffc26b]];
const skyMix = k => DAY.map(([o, c], i) => [o, mixHex(c, DUSK[i][1], k)]);

/* ---------- camera ---------- */
const EYE = { dist: 18, el: .08, az: 0, fov: 34, sway: 0 };
const TOWN = { target: A.town.clone().add(V(0, 0, -2)), dist: 66, el: .55, az: -.18, fov: 30 };
const FINAL = { target: A.town.clone().add(V(0, 4, -8)), dist: 76, el: .34, az: .05, fov: 30 };
let shot = null, shake = 0, base = null;
const look = { lead: 3.2, dy: 0, dist: 18, el: .08 }, lookT = { lead: 3.2, dy: 0, dist: 18, el: .08 };
function move(to, d) { shot = { from: { ...base, target: base.target.clone() }, to, t0: ft, d }; }
function camAt() {
  const k = easeInOut(clamp((ft - shot.t0) / shot.d)), a = shot.from, b = shot.to;
  return { target: a.target.clone().lerp(b.target, k), dist: lerp(a.dist, b.dist, k), el: lerp(a.el, b.el, k), az: lerp(a.az, b.az, k), fov: lerp(a.fov, b.fov, k), sway: 0 };
}
// framing while the prompt card is up: the hero sits in the top half, clear of the card
const promptLook = (lead = 4, dist = 22) => Object.assign(lookT, { lead, dy: -2.3, dist, el: .26 });
const runLook = () => Object.assign(lookT, { lead: 3.2, dy: 0, dist: 18, el: .08 });

/* ---------- the script ---------- */
const S = { x: 1, run: true, speed: 0, landed: -1, next: 0, seq: null, seqT: 0, si: 0, eyeY: null, windT0: null, batT0: null, hillT0: null, duskT0: null, fireworks: null, fwNext: 0, cheer: null };
const CUES = [
  [.25, () => say('Eco Town has lost its *power!*', 'yellow')],
  [2.6, () => unsay()],
  [2.9, () => say('Run, jump and grab the *sparks!*', 'blue')],
  [5.0, () => unsay()]
];
const tile = i => card.querySelectorAll('.pc-tiles button')[i];
const send = () => card.querySelector('.pc-send');
const play = () => card.querySelector('.pc-play');
function prizeHit(i) { const f = $('.flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); prizeTag.classList.remove('on'); shake = .55; burst(prizes[i].g.position, [0xffd23f, 0xffffff, 0xffb21a, 0x16ffc6], 80, 10, 4); prizes[i].g.visible = false; S.cheer = ft; }
const SEQS = [
  // prize 1: wind turbines
  [
    [0, () => { prizeHit(0); promptLook(5.5); }],
    [.6, () => openCard({ n: 1, q: "What should make the town's power?", before: 'Use ', after: '.', tiles: [['wind', 'Wind turbines'], ['sun', 'Solar panels'], ['water', 'Water wheels']] })],
    [1.5, () => pointAt(tile(0))],
    [2.1, () => choose(0, 'wind turbines')],
    [2.8, () => pointAt(send())],
    [3.3, () => { hud.tap(); send().classList.add('sent'); }],
    [3.7, () => { hud.unpoint(); reply('Jump into the wind by the turbines. It lifts you up high.'); S.windT0 = ft + .2; promptLook(7.5, 36); lookT.dy = -.6; }],
    [6.3, () => pointAt(play())],
    [6.8, () => hud.tap()],
    [7.1, () => { hud.unpoint(); closeCard(); runLook(); }],
    [7.4, () => { S.run = true; say('The AI builds your choice into the *level!*', 'green'); }],
    [10.4, () => unsay()]
  ],
  // prize 2: batteries
  [
    [0, () => { prizeHit(1); promptLook(5.5); }],
    [.6, () => openCard({ n: 2, q: 'How many batteries should I add?', before: 'Add ', after: '.', tiles: [['none', 'No battery'], ['bat1', '1 battery'], ['bat4', '4 batteries']] })],
    [1.5, () => pointAt(tile(2))],
    [2.1, () => choose(2, '4 batteries')],
    [2.8, () => pointAt(send())],
    [3.3, () => { hud.tap(); send().classList.add('sent'); }],
    [3.7, () => { hud.unpoint(); reply('Batteries store spare power for the night. Climb all 4 to reach the high sparks!'); S.batT0 = ft + .2; promptLook(6.5, 26); }],
    [6.5, () => pointAt(play())],
    [7.0, () => hud.tap()],
    [7.3, () => { hud.unpoint(); closeCard(); runLook(); }],
    [7.6, () => { S.run = true; }]
  ],
  // prize 3: out to the town for the evening
  [
    [0, () => prizeHit(2)],
    [.5, () => $('.stamp').classList.add('on')],
    [1.0, () => { move(TOWN, 3.0); S.hillT0 = ft + 1.2; }],
    [1.8, () => $('.stamp').classList.add('out')],
    [2.6, () => homeIcons.forEach(e => e.classList.add('show'))],
    [3.2, () => { panel.classList.add('on'); setHour(4); }],
    [3.6, () => say('Now watch the *evening.*', 'pink')],
    [4.4, () => { S.duskT0 = ft; }],
    ...[5, 6, 7, 8, 9].map((h, i) => [4.6 + i * .7, () => setHour(h)]),
    ...[0, 1, 2, 3, 8, 9, 4, 5, 6, 7, 10].map((h, i) => [4.8 + i * .3, () => powerHome(h)]),
    [5.8, () => unsay()],
    [6.0, () => move(FINAL, 3.0)],
    [8.6, () => { panel.classList.remove('on'); hud.celebrate(3, 'Lights on until bedtime', { badge: 'Badge earned: Clean energy hero', style: 'confetti' }); S.fireworks = ft; }],
    [11.4, () => hud.uncelebrate()],
    [11.6, () => say('Every choice changes what *gets built.*', 'green')],
    [14.0, () => unsay()],
    [14.2, () => { film.classList.add('ended'); $('.end').classList.add('on'); confetti(); }]
  ]
];

/* ---------- per frame ---------- */
let ft = -1, ci = 0, t0 = null;
const view = new View(film, { maxDpr: 2, onUpdate: t => frame(t) });
base = { ...EYE, target: V(A.wx(4.2), A.laneY(0) + 1.5, A.laneZ) };
W.camOverride = base; W.snapCam();
view.setWorld(W);
film.classList.add('ready');

function frame(t) {
  if (t0 == null) { if (!window.__go) return; t0 = t; }
  const dt = Math.min(.05, Math.max(0, t - t0 - ft)); ft = t - t0;
  while (ci < CUES.length && CUES[ci][0] <= ft) CUES[ci++][1]();
  if (S.seq) while (S.si < S.seq.length && S.seq[S.si][0] + S.seqT <= ft) S.seq[S.si++][1]();
  hud.tick(ft);
  if (typer) { const n = Math.floor((ft - typer.t0) * 55); typer.el.textContent = typer.text.slice(0, n); if (n >= typer.text.length) typer = null; }

  // the hero runs, jumps, rides the wind and climbs
  const prev = S.x, j0 = inJump(prev);
  const want = S.run ? (j0 && j0[3] === 'wind' ? 5 : 8.4) : 0;
  S.speed += (want - S.speed) * Math.min(1, dt * (S.run ? 5 : 12));
  if (ft > .3) S.x += S.speed * dt;
  if (S.next < PRIZES.length && S.run && S.x >= PRIZES[S.next] - 1.1) { S.x = PRIZES[S.next] - 1.1; S.run = false; S.speed = 0; S.seq = SEQS[S.next]; S.seqT = ft; S.si = 0; S.next++; }
  const y = pathY(S.x), j = inJump(S.x);
  H.position.set(A.wx(S.x), y, A.laneZ);
  const cheering = S.cheer != null && ft - S.cheer < 1.2 && !S.run;
  H.rotation.y = cheering ? .25 : !S.run ? lerp(H.rotation.y, .35, Math.min(1, dt * 6)) : Math.PI / 2 - .35;
  if (cheering) { H.cheer(ft); H.position.y = y + Math.abs(Math.sin((ft - S.cheer) * 7)) * .8; H.userData.body.scale.set(1, 1, 1); }
  else if (j) { H.air(j[3] === 'wind' ? 1 : .6); H.userData.body.scale.set(.94, 1.08, .94); H.rotation.z = j[3] === 'wind' ? Math.sin(ft * 8) * .08 : 0; }
  else {
    H.rotation.z = 0; H.ground(); H.run(ft * 15, clamp(S.speed / 8));
    if (j0) { S.landed = ft; shake = Math.max(shake, .3); burst(H.position.clone().add(V(0, .2, 0)), [0xd9f7c4, 0xffffff, 0x9be37a], 12, 3, 8); }
    const sq = clamp((ft - S.landed) / .22); H.userData.body.scale.set(1 + .14 * (1 - sq), 1 - .16 * (1 - sq), 1 + .14 * (1 - sq));
  }

  // sparks spin and get collected
  for (const s of sparks) {
    const d = s.userData;
    if (d.got < 0) {
      s.rotation.y = ft * 4 + d.x; s.position.y = d.y + Math.sin(ft * 4 + d.x) * .15;
      if (Math.abs(S.x - d.x) < .8 && Math.abs(y + 1.5 - d.y) < 2.4) { d.got = ft; nSparks++; sparkEl.textContent = nSparks; bump(sparkEl); burst(s.position, [0xffd23f, 0xffffff, 0xffb21a], 14, 5, 3); }
    } else { const k = clamp((ft - d.got) / .25); s.scale.setScalar(Math.max(.001, (1 + k * .6) * (1 - k))); s.position.y += dt * 6; }
  }
  bug.position.y = A.laneY(CRITTER_X) + Math.abs(Math.sin(ft * 5)) * .25; bug.rotation.y = Math.sin(ft * 2) * .4;
  prizes.forEach((p, i) => { p.g.rotation.y = ft * 2.2 + i; p.g.position.y = A.laneY(PRIZES[i]) + 3 + Math.sin(ft * 3 + i) * .3; p.g.userData.halo.material.opacity = .6 + Math.sin(ft * 6) * .2; });

  // what the AI builds: turbines and a wind column, then battery stairs
  if (S.windT0 != null) {
    levelTurbines.forEach((tb, i) => {
      const k = easeBack(clamp((ft - S.windT0 - i * .22) / .55));
      tb.visible = k > .001; tb.scale.setScalar(Math.max(.001, k)); tb.userData.blades.rotation.z -= dt * 4 * clamp(k);
      if (k > 0 && !tb.userData.puff) { tb.userData.puff = 1; burst(tb.position.clone().add(V(0, 1, 0)), [0xffffff, 0xd9f7c4, 0x59c7fc], 22, 5, 6); }
    });
    if (ft > S.windT0 + .8) for (let i = 0; i < 3; i++) wind.spawn({ x: A.wx(50.5 + R() * 4), y: A.laneY(50) + R() * 2, z: A.laneZ + (R() - .5) * 2.4, vx: (R() - .5) * .6, vy: 7 + R() * 5, vz: 0, life: 1.4, drag: .2, color: R() < .5 ? 0xffffff : 0xbfeaff, size: .14 + R() * .12, grow: 1.5 });
  }
  wind.update(dt);
  if (S.batT0 != null) bats.forEach((b, i) => {
    const k = easeBack(clamp((ft - S.batT0 - i * .3) / .5));
    b.visible = k > .001; b.scale.setScalar(Math.max(.001, k));
    if (k > 0 && !b.userData.puff) { b.userData.puff = 1; batsUp = i + 1; burst(b.position.clone().add(V(0, (i + 1) * 1.5, 0)), [0x16ffc6, 0xffd23f, 0xffffff], 22, 5, 6); }
  });

  // camera: eye level while playing, a scripted swoop for the town
  for (const k of ['lead', 'dy', 'dist', 'el']) look[k] += (lookT[k] - look[k]) * Math.min(1, dt * 3);
  if (!shot) {
    const ty = y + 1.5;
    S.eyeY = S.eyeY == null ? ty : S.eyeY + (ty - S.eyeY) * Math.min(1, dt * 3.5);
    base = { ...EYE, dist: look.dist, el: look.el, target: V(H.position.x + look.lead, S.eyeY + look.dy, A.laneZ) };
  } else base = camAt();
  W.camOverride = base;
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); const s = shake * shake; W.camOverride = { ...base, target: base.target.clone().add(V((R() - .5) * s, (R() - .5) * s, 0)) }; }
  W.snapCam();

  // the evening, with turbines on the hill
  if (S.hillT0 != null) {
    W.turbines.forEach((tb, i) => {
      const k = easeBack(clamp((ft - S.hillT0 - i * .16) / .55));
      tb.visible = k > .001; tb.scale.setScalar(Math.max(.001, k));
      if (k > 0 && !tb.userData.puff) { tb.userData.puff = 1; burst(tb.position.clone().add(V(0, 1, 0)), [0xffffff, 0xd9f7c4], 16, 4, 6); }
    });
    W.windOn = clamp((ft - S.hillT0) / 1.2);
  }
  if (S.duskT0 != null) W.dusk = smooth(0, 1, (ft - S.duskT0) / 3.4);
  W.skyStops = skyMix(W.dusk);
  W.sun.color.setHex(mixHex(0xfff2d6, 0xff9a52, W.dusk)); W.sun.intensity = lerp(3.1, 2.9, W.dusk);
  W.sunDir.set(lerp(-.35, -.8, W.dusk), lerp(.9, .55, W.dusk), .7).normalize();
  W.hemi.color.setHex(mixHex(0xe4f4ff, 0xffd0e0, W.dusk)); W.hemi.intensity = lerp(1.35, 1.75, W.dusk);
  W.scene.fog.color.setHex(mixHex(0xcdeeff, 0xffb3c8, W.dusk));

  if (S.fireworks != null && ft - S.fireworks < 6 && ft >= S.fwNext) {
    S.fwNext = ft + .22 + R() * .25;
    const c = A.town.clone().add(V((R() - .5) * 60, 22 + R() * 12, (R() - .5) * 26 - 6));
    burst(c, [[0xffd23f, 0xffffff], [0xff4f8b, 0xffd23f], [0x16ffc6, 0x59c7fc], [0xb48cff, 0xffffff], [0xff8a1f, 0xffd23f]][Math.floor(R() * 5)], 60, 12, 3);
  }
  fx.update(dt);

  // labels pinned to the world
  W.homes.forEach((h, i) => { const p = view.project(h.icon); homeIcons[i].style.transform = `translate(${p.x}px, ${p.y}px)`; });
  const near = S.run && S.next < PRIZES.length && PRIZES[S.next] - S.x < 14;
  prizeTag.classList.toggle('on', near);
  if (near) { const pp = view.project(prizes[S.next].g.position.clone().add(V(0, 3.2, 0))); prizeTag.style.transform = `translate(${pp.x}px, ${pp.y}px) translate(-50%, -100%)`; }
}

document.fonts.ready.then(() => { window.__ready = true; if (!window.__rec) window.__go = true; });
