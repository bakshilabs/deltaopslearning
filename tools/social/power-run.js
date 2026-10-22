// Power Run: a square social film in the style of the game.
// The hero runs at eye level, grabs the power prize, then the camera swoops out over Eco Town
// where the children's choices (solar, then wind) switch the homes back on.
// Plays in real time in a browser, or frame by frame under tools/social/render.mjs.
import { THREE, View, Particles, clamp, lerp, smooth, easeBack, easeInOut, mixHex } from '/js/game/engine.js?v=20261018b';
import { Hud } from '/js/game/hud.js?v=20261018b';
import { powerRunWorld, hero, critter, spark, prize, JUMPS, CRITTER_X, PRIZE_X, SPARKS } from '/tools/social/power-run-world.js';

const film = document.querySelector('.film');
const $ = s => film.querySelector(s);
const W = powerRunWorld();
const A = W.anchors;
const hud = new Hud($('.hudroot'), { name: 'Power Run', tag: 'Energy', icon: 'bolt', bot: '#ffcf3d' });
const BOLT = '<svg viewBox="0 0 24 24"><path d="M13.5 2 4.5 13.5h6.2L9.8 22l9-11.6h-6.2z"/></svg>';
let rnd = 7; const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;

// ground height under the hero, and the jump arcs over it
function pathY(x) {
  for (const [a, b, apex] of JUMPS) if (x > a && x < b) { const u = (x - a) / (b - a); return lerp(A.laneY(a), A.laneY(b), u) + apex * 4 * u * (1 - u); }
  return A.laneY(x);
}
const inJump = x => JUMPS.find(([a, b]) => x > a && x < b);

/* ---------- actors ---------- */
const H = hero(); W.root.add(H);
const bug = critter(); bug.position.set(A.wx(CRITTER_X), A.laneY(CRITTER_X), A.laneZ); W.root.add(bug);
const P = prize(); P.g.position.set(A.wx(PRIZE_X), A.laneY(PRIZE_X) + 3, A.laneZ); P.pad.position.set(A.wx(PRIZE_X), A.laneY(PRIZE_X), A.laneZ); W.root.add(P.g, P.pad);
const sparks = SPARKS.map(x => { const s = spark(), y = pathY(x) + 1.5; s.position.set(A.wx(x), y, A.laneZ); s.userData = { x, y, got: -1 }; W.root.add(s); return s; });
const fx = new Particles(700, { size: .3, light: false }); W.root.add(fx.mesh);
function burst(p, cols, n = 24, sp = 6, g = 6) {
  for (let i = 0; i < n; i++) {
    const u = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.sqrt(1 - u * u), s = sp * (.6 + R() * .6);
    fx.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * r * s, vy: u * s + 2, vz: Math.sin(a) * r * s, g, drag: 1.4, life: .7 + R() * .5, color: cols[i % cols.length], size: .32, spin: 6 });
  }
}

/* ---------- overlay helpers ---------- */
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
const setHomes = n => { if (n !== nHomes) { nHomes = n; homesEl.textContent = n; bump(homesEl); } };

const pins = $('.pins');
const homeIcons = W.homes.map(() => { const e = document.createElement('div'); e.className = 'hi'; e.innerHTML = BOLT; pins.appendChild(e); return e; });
const prizeTag = document.createElement('div'); prizeTag.className = 'prize-tag'; prizeTag.textContent = 'Power prize'; pins.appendChild(prizeTag);
const homesOn = () => W.homes.filter(x => x.target).length;
function powerHome(i) { const h = W.homes[i]; if (h.target) return; h.target = 1; homeIcons[i].classList.add('on'); setHomes(homesOn()); burst(h.icon.clone().add(new THREE.Vector3(0, -2, 0)), [0xffd23f, 0xffffff, 0x16ffc6], 18, 5); }
function unpowerHome(i) { W.homes[i].target = 0; homeIcons[i].classList.remove('on'); setHomes(homesOn()); }

function confetti() {
  const c = $('.end .conf'), cols = ['#ffd23f', '#ff4f8b', '#2b6fe0', '#ffffff', '#1f9d55', '#ff8a1f'];
  c.innerHTML = Array.from({ length: 46 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--c:${cols[i % cols.length]};--d:${2.2 + (i % 5) * .35}s;--dl:${-(i % 9) * .3}s"></i>`).join('');
}

/* ---------- sky ---------- */
const DAY = [[0, 0x1f8bff], [.55, 0x6cc8ff], [1, 0xd8f4ff]];
const DUSK = [[0, 0x5b4bff], [.55, 0xff5fa2], [1, 0xffc26b]];
const skyMix = k => DAY.map(([o, c], i) => [o, mixHex(c, DUSK[i][1], k)]);

/* ---------- camera ---------- */
// eye level beside the hero, then a crane up and out over the town
const EYE = { dist: 18, el: .08, az: 0, fov: 34, sway: 0 };
const TOWN = { target: A.town.clone().add(new THREE.Vector3(0, 0, -2)), dist: 64, el: .62, az: -.2, fov: 30 };
const ROOFS = { target: A.town.clone().add(new THREE.Vector3(-14, 0, -8)), dist: 42, el: .72, az: -.1, fov: 30 };
const HILL = { target: A.hill.clone().add(new THREE.Vector3(0, 7, 4)), dist: 52, el: .16, az: -.05, fov: 30 };
const FINAL = { target: A.town.clone().add(new THREE.Vector3(0, 4, -8)), dist: 76, el: .34, az: .05, fov: 30 };
let shot = null, shake = 0, base = null;
function move(to, d, ft) { shot = { from: { ...base, target: base.target.clone() }, to, t0: ft, d }; }
function camAt(ft) {
  const k = easeInOut(clamp((ft - shot.t0) / shot.d)), a = shot.from, b = shot.to;
  return { target: a.target.clone().lerp(b.target, k), dist: lerp(a.dist, b.dist, k), el: lerp(a.el, b.el, k), az: lerp(a.az, b.az, k), fov: lerp(a.fov, b.fov, k), sway: 0 };
}

/* ---------- the script ---------- */
const S = { run: true, x: 1, landed: -1, duskT0: null, windT0: null, fireworks: null, fwNext: 0, eyeY: null };
const X0 = 1, T_RUN = .3, SPEED = 8.2;
const CUES = [
  [.25, () => say('Eco Town has lost its *power!*', 'yellow')],
  [2.7, () => unsay()],
  [3.0, () => say('Run, jump and grab the *sparks!*', 'blue')],
  [5.5, () => unsay()],
  [6.3, () => prizeTag.classList.add('on')]
];
// these run once the hero reaches the prize (times are seconds after that moment)
const AFTER = [
  [0, () => { $('.flash').classList.add('on'); $('.stamp').classList.add('on'); prizeTag.classList.remove('on'); shake = .7; burst(P.g.position, [0xffd23f, 0xffffff, 0xffb21a, 0x16ffc6], 90, 11, 4); P.g.visible = false; }],
  [.9, ft => move(TOWN, 3.0, ft)],
  [1.6, () => $('.stamp').classList.add('out')],
  [2.6, () => homeIcons.forEach(e => e.classList.add('show'))],
  [3.9, () => hud.setCards(['Solar panels', 'Wind turbines', 'Gas power station'], { label: 'Prize 1 · Tell the AI what to build' })],
  [4.6, () => hud.point(hud.card(0))],
  [5.2, () => { hud.tap(); hud.pick(0); }],
  [5.7, ft => { hud.hideCards(); hud.unpoint(); W.panels.set(true); W.shine.set(true); move(ROOFS, 2.4, ft); say('Solar panels turn *sunshine* into power.', 'yellow'); }],
  ...[0, 1, 2, 3, 8, 9].map((h, i) => [6.6 + i * .28, () => powerHome(h)]),
  [8.9, () => unsay()],
  [9.1, ft => { S.duskT0 = ft; move(TOWN, 2.2, ft); }],
  [10.0, () => say('The sun is setting. The power is *running out!*', 'pink')],
  ...[9, 8, 3, 2].map((h, i) => [10.6 + i * .22, () => unpowerHome(h)]),
  [12.4, () => unsay()],
  [12.6, () => hud.setCards(['Wind turbines', 'More solar panels', 'A gas power station'], { label: 'Prize 2 · What makes power after dark?' })],
  [13.3, () => hud.point(hud.card(0))],
  [13.9, () => { hud.tap(); hud.pick(0); }],
  [14.4, ft => { hud.hideCards(); hud.unpoint(); move(HILL, 1.6, ft); S.windT0 = ft + .7; }],
  [15.0, () => say('Wind turbines keep spinning *after dark.*', 'blue low')],
  [16.9, ft => move(FINAL, 2.6, ft)],
  ...[2, 3, 8, 9, 4, 5, 6, 7, 10].map((h, i) => [17.2 + i * .2, () => powerHome(h)]),
  [17.6, () => unsay()],
  [19.4, ft => { hud.celebrate(3, '11 of 11 homes on', { badge: 'Badge earned: Clean energy hero', style: 'confetti' }); S.fireworks = ft; }],
  [22.4, () => hud.uncelebrate()],
  [22.6, () => say('The whole town runs on *clean power!*', 'green')],
  [25.1, () => unsay()],
  [25.3, () => { film.classList.add('ended'); $('.end').classList.add('on'); confetti(); }]
];

/* ---------- per frame ---------- */
let ft = -1, ci = 0, ai = 0, t0 = null, tWon = null;
const view = new View(film, { maxDpr: 2, onUpdate: t => frame(t) });
W.camOverride = { ...EYE, target: new THREE.Vector3(A.wx(X0 + 3.2), A.laneY(0) + 1.5, A.laneZ) }; W.snapCam();
view.setWorld(W);
film.classList.add('ready');

function frame(t) {
  if (t0 == null) { if (!window.__go) return; t0 = t; }
  const dt = Math.min(.05, Math.max(0, t - t0 - ft)); ft = t - t0;
  while (ci < CUES.length && CUES[ci][0] <= ft) CUES[ci++][1](ft);
  if (tWon != null) while (ai < AFTER.length && AFTER[ai][0] + tWon <= ft) AFTER[ai++][1](ft);
  hud.tick(ft);

  // the hero runs, jumps and lands
  const prev = S.x;
  if (S.run) S.x = Math.min(PRIZE_X - 1.1, X0 + SPEED * Math.max(0, ft - T_RUN));
  const y = pathY(S.x), j = inJump(S.x);
  H.position.set(A.wx(S.x), y, A.laneZ);
  H.rotation.y = tWon != null ? lerp(Math.PI / 2 - .35, .25, clamp((ft - tWon) / .5)) : Math.PI / 2 - .35;
  if (tWon != null) { H.cheer(ft); H.position.y = y + Math.abs(Math.sin((ft - tWon) * 6)) * .9 * Math.max(0, 1 - (ft - tWon) / 3); H.userData.body.scale.set(1, 1, 1); }
  else if (j) { H.air(1); H.userData.body.scale.set(.94, 1.08, .94); }
  else {
    H.ground(); H.run(ft * 15, 1);
    if (inJump(prev)) { S.landed = ft; shake = Math.max(shake, .3); burst(H.position.clone().add(new THREE.Vector3(0, .2, 0)), [0xd9f7c4, 0xffffff, 0x9be37a], 12, 3, 8); }
    const sq = clamp((ft - S.landed) / .22); H.userData.body.scale.set(1 + .14 * (1 - sq), 1 - .16 * (1 - sq), 1 + .14 * (1 - sq));
  }
  if (S.run && S.x >= PRIZE_X - 1.1) { tWon = ft; S.run = false; }

  // sparks spin and get collected
  for (const s of sparks) {
    const d = s.userData;
    if (d.got < 0) {
      s.rotation.y = ft * 4 + d.x; s.position.y = d.y + Math.sin(ft * 4 + d.x) * .15;
      if (Math.abs(S.x - d.x) < .8) { d.got = ft; nSparks++; sparkEl.textContent = nSparks; bump(sparkEl); burst(s.position, [0xffd23f, 0xffffff, 0xffb21a], 14, 5, 3); }
    } else { const k = clamp((ft - d.got) / .25); s.scale.setScalar(Math.max(.001, (1 + k * .6) * (1 - k))); s.position.y += dt * 6; }
  }
  bug.position.y = A.laneY(CRITTER_X) + Math.abs(Math.sin(ft * 5)) * .25; bug.rotation.y = Math.sin(ft * 2) * .4;
  P.g.rotation.y = ft * 2.2; P.g.position.y = A.laneY(PRIZE_X) + 3 + Math.sin(ft * 3) * .3;
  P.g.userData.halo.material.opacity = .6 + Math.sin(ft * 6) * .2;

  // camera: eye level while running, scripted moves after the prize
  if (!shot) {
    const ty = y + 1.5;
    S.eyeY = S.eyeY == null ? ty : S.eyeY + (Math.min(ty, A.laneY(S.x) + 2.6) - S.eyeY) * Math.min(1, dt * 4);
    base = { ...EYE, target: new THREE.Vector3(H.position.x + 3.2, S.eyeY, A.laneZ) };
  } else base = camAt(ft);
  W.camOverride = base;
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); const s = shake * shake; W.camOverride = { ...base, target: base.target.clone().add(new THREE.Vector3((R() - .5) * s, (R() - .5) * s, 0)) }; }
  W.snapCam();

  // sunset, then the wind turbines
  if (S.duskT0 != null) W.dusk = smooth(0, 1, (ft - S.duskT0) / 2.4);
  W.skyStops = skyMix(W.dusk);
  W.sun.color.setHex(mixHex(0xfff2d6, 0xff9a52, W.dusk)); W.sun.intensity = lerp(3.1, 2.9, W.dusk);
  W.sunDir.set(lerp(-.35, -.8, W.dusk), lerp(.9, .55, W.dusk), .7).normalize();
  W.hemi.color.setHex(mixHex(0xe4f4ff, 0xffd0e0, W.dusk)); W.hemi.intensity = lerp(1.35, 1.75, W.dusk);
  W.scene.fog.color.setHex(mixHex(0xcdeeff, 0xffb3c8, W.dusk));
  if (S.windT0 != null) {
    W.turbines.forEach((tb, i) => {
      const k = easeBack(clamp((ft - S.windT0 - i * .18) / .55));
      tb.visible = k > .001; tb.scale.setScalar(Math.max(.001, k));
      if (k > 0 && !tb.userData.puff) { tb.userData.puff = 1; burst(tb.position.clone().add(new THREE.Vector3(0, 1, 0)), [0xffffff, 0xd9f7c4], 16, 4, 6); }
    });
    W.windOn = clamp((ft - S.windT0) / 1.2);
  }

  // fireworks over the town
  if (S.fireworks != null && ft - S.fireworks < 6 && ft >= S.fwNext) {
    S.fwNext = ft + .22 + R() * .25;
    const c = A.town.clone().add(new THREE.Vector3((R() - .5) * 60, 22 + R() * 12, (R() - .5) * 26 - 6));
    burst(c, [[0xffd23f, 0xffffff], [0xff4f8b, 0xffd23f], [0x16ffc6, 0x59c7fc], [0xb48cff, 0xffffff], [0xff8a1f, 0xffd23f]][Math.floor(R() * 5)], 60, 12, 3);
  }
  fx.update(dt);

  // labels pinned to the world
  W.homes.forEach((h, i) => { const p = view.project(h.icon); homeIcons[i].style.transform = `translate(${p.x}px, ${p.y}px)`; });
  const pp = view.project(P.g.position.clone().add(new THREE.Vector3(0, 3.2, 0)));
  prizeTag.style.transform = `translate(${pp.x}px, ${pp.y}px) translate(-50%, -100%)`;
}

document.fonts.ready.then(() => { window.__ready = true; if (!window.__rec) window.__go = true; });
