// Power Run: a square social film. Eco Town loses power and the children try three plans.
// Plays in real time in a browser, or frame by frame under tools/social/render.mjs.
import { THREE, View, Particles, clamp, lerp, smooth, easeOut, easeBack, easeInOut, mixHex } from '/js/game/engine.js?v=20261018b';
import { WORLDS, skyAt } from '/js/game/worlds.js?v=20261018b';
import { Hud, ICON } from '/js/game/hud.js?v=20261018b';

const film = document.querySelector('.film');
const $ = s => film.querySelector(s);
const W = WORLDS.town();
const hud = new Hud($('.hudroot'), { name: 'Power Run', tag: 'Energy · AI Lab', icon: 'bolt', bot: '#ffcf3d' });

/* ---------- handles into the town ---------- */
const sets = W.root.children.filter(g => g.isGroup);
const panelSet = sets.find(g => g.children.length === 1 && g.children[0].isInstancedMesh);
const turbineSet = sets.find(g => g.children[0]?.userData.blades);
const turbines = turbineSet.children;
const panelMesh = panelSet.children[0];
const panelBase = Array.from({ length: panelMesh.count }, (_, i) => { const m = new THREE.Matrix4(); panelMesh.getMatrixAt(i, m); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return { p, q, s }; });
const A = W.anchors;
const sprites = W.root.children.filter(o => o.isSprite);
const winGlow = sprites.filter(s => s.material.color.getHex() === 0xffc76a);
const lampGlow = sprites.filter(s => s.material.color.getHex() === 0xffd77a);
winGlow.forEach(s => s.scale.setScalar(12)); lampGlow.forEach(s => s.scale.setScalar(4.6));
W.setKit({ turbines: false, panels: false });

const smog = new Particles(900, { size: .6 }); W.root.add(smog.mesh);
const fx = new Particles(600, { size: .42, light: false }); W.root.add(fx.mesh);

/* ---------- film state ---------- */
const S = { batTag: false, level: 0, mode: 'intro', haze: 0, hazeT: 0, panels: 0, panelsT0: null, turbT0: null, outAt: null, fireworks: null, orbit: null, flick: null };
let hourTw = { a: 20.3, b: 20.3, t0: 0, d: 1 };
const hourAt = ft => lerp(hourTw.a, hourTw.b, easeInOut(clamp((ft - hourTw.t0) / hourTw.d)));
const tweenHour = (ft, b, d) => { hourTw = { a: hourAt(ft), b, t0: ft, d }; };

/* ---------- overlay helpers ---------- */
const cap = $('.cap'), scrim = $('.scrim');
function say(kick, text) {
  cap.className = 'cap';
  cap.querySelector('.kick').textContent = kick || '';
  let i = 0;
  cap.querySelector('.big').innerHTML = text.split(' ').map(w => {
    const hl = w.startsWith('*') || w.endsWith('*') || w.includes('*');
    const clean = w.replace(/\*(bad|sun):/, '*').replace(/\*/g, '');
    const tone = (w.match(/\*(bad|sun):/) || [])[1] || '';
    return `<span class="w" style="--i:${i++}">${hl ? `<em class="${tone}">${clean}</em>` : clean}</span>`;
  }).join(' ');
  void cap.offsetWidth; cap.classList.add('on'); scrim.classList.add('on');
}
// a highlighted run of words: *bad:runs out.* marks both words
function sayRun(kick, text) {
  const out = []; let tone = null;
  for (const w of text.split(' ')) {
    let x = w, open = false;
    const m = x.match(/^\*(?:(bad|sun):)?/);
    if (m) { tone = m[1] || ''; x = x.slice(m[0].length); open = true; }
    const close = x.includes('*'); x = x.replace('*', '');
    out.push(tone != null ? `*${tone ? tone + ':' : ''}${x}*` : x);
    if (close) tone = null;
  }
  say(kick, out.join(' '));
}
const unsay = () => { cap.classList.add('out'); scrim.classList.remove('on'); };

const clock = $('.clock');
const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" fill="#ffb81a"/><g stroke="#ffb81a" stroke-width="2.4" stroke-linecap="round"><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></g></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="#5b6bd6"/></svg>';
let clockKey = '';
function drawClock(h) {
  const hr = Math.floor(((h % 24) + 24) % 24), day = hr >= 7 && hr < 19, key = hr + (day ? 'd' : 'n');
  if (key === clockKey) return; clockKey = key;
  clock.querySelector('b').textContent = String(hr).padStart(2, '0') + ':00';
  clock.querySelector('.ico').innerHTML = day ? SUN : MOON;
}

const HOURS = 12, H0 = 18;
let strip = null, stripLit = 0;
function nightPanel(airStart) {
  hud.meters([{ key: 'l', label: 'Lights', icon: 'bulb' }, { key: 'a', label: 'Clean air', icon: 'leaf' }]);
  strip = hud.slot('night', `<small>Lights tonight</small><div class="strip">${'<i></i>'.repeat(HOURS)}</div><div class="strip-h"><span>18:00</span><span>00:00</span><span>06:00</span></div>`).querySelectorAll('.strip i');
  stripLit = 0;
  hud.meter('a', airStart, 0);
}
function fillStrip(h) {
  if (!strip) return;
  strip.forEach((c, i) => {
    const hr = H0 + i;
    if (h >= hr + .5 && !c.className) {
      const out = S.outAt != null && hr >= S.outAt;
      c.className = out ? 'off' : 'on';
      if (!out) stripLit++;
    }
  });
}

function cards(label, list, tried = {}) {
  hud.setCards(list, { label });
  for (const [i, note] of Object.entries(tried)) { const c = hud.card(+i); c.classList.add('tried'); c.insertAdjacentHTML('beforeend', `<em class="res">${note}</em>`); }
}
function choose(i) { hud.tap(); hud.pick(i); }
function rewind(on) { $('.rw').classList.toggle('on', on); film.classList.toggle('rewind', on); clock.classList.toggle('fast', on); clock.classList.toggle('back', on); }
function fast(on) { clock.classList.toggle('fast', on); clock.classList.remove('back'); }

// a live label over the battery
const batTag = hud.extra('hd-tag good bat', '');
let batKey = '';
function drawBatTag() {
  const on = S.batTag && S.mode !== 'day';
  batTag.classList.toggle('on', on);
  if (!on) return;
  const pct = Math.round(S.level * 100), key = pct + (S.level < .2 ? 'low' : '');
  if (key !== batKey) { batKey = key; batTag.innerHTML = `${ICON.bolt}Battery ${pct}%`; batTag.className = 'hd-extra hd-tag bat on ' + (S.level < .2 ? 'bad' : 'good'); }
  const p = view.project(A.battery.clone().add(new THREE.Vector3(0, 1.2, 0)));
  batTag.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
}

/* ---------- cameras ---------- */
const cam = (o, snap = false) => { S.orbit = null; W.camOverride = o; if (snap) W.snapCam(); };
const CAM = {
  hook: { target: A.town.clone().add(new THREE.Vector3(0, 0, -4)), dist: 50, el: .5, az: .66, fov: 26, sway: 0 },
  hookWide: { target: A.town.clone().add(new THREE.Vector3(0, 0, -6)), dist: 64, el: .46, az: .56, fov: 26, sway: 0 },
  gas: { target: A.gas.clone().add(new THREE.Vector3(-2, -5, 0)), dist: 34, el: .3, az: .95, fov: 26, sway: 0 },
  smog: { target: A.town.clone().add(new THREE.Vector3(4, 2, -6)), dist: 70, el: .36, az: .78, fov: 26, sway: 0 },
  roofs: { target: A.town.clone().add(new THREE.Vector3(0, 0, -5)), dist: 40, el: .72, az: .5, fov: 26, sway: 0 },
  battery: { target: A.battery.clone().add(new THREE.Vector3(0, -2, 0)), dist: 26, el: .45, az: 2.6, fov: 26, sway: 0 },
  town: { target: A.town.clone().add(new THREE.Vector3(0, 0, -6)), dist: 66, el: .44, az: .62, fov: 26, sway: 0 },
  hill: { target: A.turbines.clone().add(new THREE.Vector3(0, 2, 10)), dist: 60, el: .32, az: .75, fov: 26, sway: 0 },
  finale: { target: A.town.clone().add(new THREE.Vector3(0, 3, -8)), dist: 74, el: .4, az: .3, fov: 26, sway: 0 }
};

/* ---------- the script ---------- */
const CUES = [
  [0, () => { cam(CAM.hook, true); W.setHour(20.3); hud.setStats(0, 0); }],
  [.3, () => say('', "It's 8pm in *Eco Town.*")],
  [1.7, () => { S.flick = 1.7; }],
  [2.4, () => unsay()],
  [2.7, () => sayRun('', 'Then the power *bad:runs out.*')],
  [3.0, () => cam(CAM.hookWide)],
  [4.2, () => unsay()],
  [4.5, () => sayRun('', 'Can the children *fix it?*')],
  [5.9, () => unsay()],
  [6.0, () => { hud.root.classList.add('top'); film.classList.add('playing'); clock.classList.add('on'); hud.showMission('Keep the lights on all night and the air clean', 'L1'); }],
  // try 1: gas
  [6.9, () => cards('Try 1 · How will the town make power?', ['Burn more gas', 'Solar panels', 'Wind turbines'])],
  [7.6, () => hud.point(hud.card(0))],
  [8.2, () => choose(0)],
  [8.7, () => { hud.hideCards(); hud.unpoint(); S.mode = 'gas'; cam(CAM.gas, true); sayRun('Try 1', 'Burn more gas. The lights *come back on.*'); }],
  [9.4, () => { nightPanel(82); strip[0].className = strip[1].className = 'on'; hud.meter('l', 100, 1); }],
  [9.6, ft => { tweenHour(ft, 31, 5.2); fast(true); S.hazeT = 1; }],
  [10.9, () => { unsay(); cam(CAM.smog); }],
  [11.4, () => hud.meter('a', 55, -1)],
  [12.8, () => hud.meter('a', 31, -1)],
  [14.0, () => hud.meter('a', 14, -1)],
  [14.8, () => { fast(false); hud.pop('The air is full of smoke', 'bad'); }],
  [16.0, () => { hud.unpop(); hud.hidePanel(); hud.say('The lights stayed on all night. What did the smoke do to the air?', { chip: 'Think', tone: 'warn' }); }],
  // try 2: solar and a battery
  [18.8, ft => { hud.hush(); rewind(true); tweenHour(ft, 12, 1.1); S.hazeT = 0; S.mode = 'day'; sayRun('Try 2', 'Rewind. Find a *cleaner way.*'); }],
  [20.0, () => { rewind(false); smog.clear(); }],
  [20.6, () => unsay()],
  [20.8, () => cards('Try 2 · Find a cleaner way', ['Burn more gas', 'Solar panels and a battery', 'Wind turbines'], { 0: 'Smoky air' })],
  [21.4, () => hud.point(hud.card(1))],
  [22.0, () => choose(1)],
  [22.5, ft => { hud.hideCards(); hud.unpoint(); W.setKit({ panels: true, turbines: false }); S.panelsT0 = ft + .2; cam(CAM.roofs, true); sayRun('', 'Solar panels go on *sun:every roof.*'); }],
  [23.8, ft => { tweenHour(ft, 17.5, 3.2); fast(true); S.mode = 'solar'; S.outAt = 27; }],
  [24.5, () => unsay()],
  [24.8, () => { cam(CAM.battery); S.batTag = true; sayRun('', 'A battery stores the *sun:afternoon sun.*'); }],
  [26.6, () => unsay()],
  [26.9, ft => { cam(CAM.town); nightPanel(100); hud.meter('a', 100, 1); hud.meter('l', 0, 0); tweenHour(ft, 30, 4.6); fast(true); }],
  [27.6, () => hud.meter('l', 50, 1)],
  [30.6, () => { hud.meter('l', 75, -1); }],
  [31.6, () => { fast(false); S.batTag = false; hud.pop('Lights out at 03:00', 'bad'); }],
  [32.8, () => { hud.unpop(); hud.hidePanel(); hud.say('The battery ran flat before sunrise. What else can make power at night?', { chip: 'Think', tone: 'warn' }); }],
  // try 3: add wind
  [35.6, ft => { hud.hush(); rewind(true); tweenHour(ft, 15, 1.1); S.mode = 'day'; S.outAt = null; sayRun('Try 3', 'Keep the sun. Add *something new.*'); }],
  [36.8, () => rewind(false)],
  [37.4, () => unsay()],
  [37.6, () => cards('Try 3 · Keep the lights on until morning', ['A bigger battery', 'Wind turbines on the hill', 'Burn more gas'], { 2: 'Smoky air' })],
  [38.2, () => hud.point(hud.card(1))],
  [38.8, () => choose(1)],
  [39.3, ft => { hud.hideCards(); hud.unpoint(); W.setKit({ panels: true, turbines: true }); S.turbT0 = ft + .3; W.setPower({ wind: 70 }); cam(CAM.hill, true); sayRun('', 'Wind turbines keep spinning *after dark.*'); }],
  [41.2, ft => { unsay(); S.mode = 'wind'; S.batTag = true; cam(CAM.town); nightPanel(100); hud.meter('a', 100, 1); hud.meter('l', 0, 0); tweenHour(ft, 29.3, 4.2); fast(true); }],
  [42.4, () => hud.meter('l', 60, 1)],
  [44.4, () => hud.meter('l', 100, 1)],
  [45.6, ft => { fast(false); S.batTag = false; hud.hidePanel(); hud.celebrate(3, 'Lit all night on clean power', { badge: 'Badge earned: Energy hero', xp: 150, style: 'confetti' }); hud.setStats(3, 150); S.fireworks = ft; S.orbit = { t0: ft, from: .62, to: .2 }; W.camOverride = { ...CAM.finale, az: .62 }; }],
  [48.6, () => { hud.uncelebrate(); hud.on(hud.mission, false); hud.root.classList.remove('top'); film.classList.remove('playing'); clock.classList.remove('on'); }],
  [48.9, () => sayRun('', 'They tested three plans and kept the one that *worked.*')],
  [51.4, () => unsay()],
  [51.6, () => { $('.end').classList.add('on'); film.classList.add('ended'); }]
];
export const LENGTH = 56;

/* ---------- per-frame ---------- */
let ft = -1, ci = 0, t0 = null;
const view = new View(film, { maxDpr: 2, onUpdate: t => frame(t) });
view.setWorld(W);
film.classList.add('ready');

function powerFor(h) {
  if (S.mode === 'intro') {
    const k = S.flick == null ? 0 : ft - S.flick;
    const out = S.flick == null ? 0 : k > .75 ? 1 : (Math.floor(k * 9) % 2);
    return { lit: 1, blackout: out, gas: 0, bat: 0, level: 0 };
  }
  if (S.mode === 'gas') return { lit: 1, blackout: 0, gas: 1, bat: 0, level: 0 };
  if (S.mode === 'day') return { lit: 1, blackout: 0, gas: 0, bat: 0, level: 0 };
  const charge = clamp((h - 13) / 4.2);
  if (h < 17.6) return { lit: 1, blackout: 0, gas: 0, bat: charge > 0 ? 1 : 0, level: charge };
  if (S.mode === 'solar') { const out = h >= S.outAt; return { lit: 1, blackout: out ? 1 : 0, gas: 0, bat: out ? 0 : -1, level: out ? 0 : clamp(1 - (h - 17.6) / (S.outAt - 17.6)) }; }
  return { lit: 1, blackout: 0, gas: 0, bat: -1, level: clamp(1 - (h - 17.6) / 30) };
}

const tmpP = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpM = new THREE.Matrix4();
const FW = [0xffd23f, 0x3be0c2, 0xff7a59, 0x59c7fc, 0xb48cff, 0x16ffc6, 0xffffff];
let fwNext = 0, rnd = 1;
const R = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647;

function frame(t) {
  if (t0 == null) { if (!window.__go) return; t0 = t; }
  const dt = Math.min(.05, Math.max(0, t - t0 - ft)); ft = t - t0;
  while (ci < CUES.length && CUES[ci][0] <= ft) CUES[ci++][1](ft);
  hud.tick(ft);

  const h = hourAt(ft);
  W.setHour(((h % 24) + 24) % 24);
  // brighter night: lit windows and street lamps glow harder, and the moonlight lifts a little
  const night = skyAt(h).night;
  W.hemi.intensity += night * .3;
  for (const g of winGlow) { g.material.opacity = Math.min(1, g.material.opacity * 1.7); }
  for (const g of lampGlow) { g.material.opacity = Math.min(1, g.material.opacity * 1.4); }
  const pw = powerFor(h); S.level = pw.level; W.setPower(pw);
  drawBatTag();
  drawClock(h);
  if (S.mode !== 'intro' && S.mode !== 'day') fillStrip(h);

  // smog from the gas plant, and a brown haze that builds overnight
  S.haze += (S.hazeT * clamp((h - 20) / 8, .25, 1) - S.haze) * Math.min(1, dt * (S.hazeT ? .9 : 3));
  if (S.mode === 'gas') for (let i = 0; i < 5; i++) smog.spawn({ x: A.gas.x + (R() - .5) * 1.4, y: A.gas.y + .4, z: A.gas.z + (R() - .5) * 1.4, vx: -3 - R() * 4.5, vy: 1.2 + R() * 1.4, vz: -2.6 + R() * 4, drag: .12, life: 5.5 + R() * 2.5, grow: 2.2 + R() * 1.5, color: [0x6c7073, 0x83878a, 0x5a5e62, 0x9a9384, 0x777064][Math.floor(R() * 5)], size: .35 + R() * .45, spin: R() * 2 });
  smog.update(dt);
  if (S.haze > .002) {
    const hz = S.haze;
    W.skyStops = W.skyStops.map(([o, c], i) => [o, mixHex(c, [0x5d5648, 0x7d715c, 0x9a8a6c, 0xb3a17e][i] ?? 0x9a8a6c, hz * .8)]);
    W.hemi.color.setHex(mixHex(W.hemi.color.getHex(), 0xb09a78, hz * .55));
    W.sun.color.setHex(mixHex(W.sun.color.getHex(), 0xd09060, hz * .6));
    W.scene.fog.color.setHex(mixHex(0xdbe9f7, 0x8f826a, hz));
    W.scene.fog.near = lerp(170, 60, hz); W.scene.fog.far = lerp(300, 190, hz);
  } else { W.scene.fog.color.setHex(0xdbe9f7); W.scene.fog.near = 170; W.scene.fog.far = 300; }

  // solar panels drop onto the roofs one by one
  if (S.panelsT0 != null) {
    const p = clamp((ft - S.panelsT0) / 1.6), n = panelBase.length;
    panelBase.forEach((b, i) => {
      const q = clamp(p * 1.7 - (i / n) * .7);
      tmpP.copy(b.p); tmpP.y += (1 - easeOut(q)) * 7;
      tmpS.copy(b.s).multiplyScalar(Math.max(1e-4, easeBack(q)));
      panelMesh.setMatrixAt(i, tmpM.compose(tmpP, b.q, tmpS));
    });
    panelMesh.instanceMatrix.needsUpdate = true;
    if (p >= 1) S.panelsT0 = null;
  }
  // turbines rise on the hill
  if (S.turbT0 != null) turbines.forEach((tb, i) => { const s = easeBack(clamp((ft - S.turbT0 - i * .16) / .5)); tb.scale.copy(tb.userData.base).multiplyScalar(Math.max(.001, s)); });

  // a slow orbit for the finale
  if (S.orbit) { const k = easeInOut(clamp((ft - S.orbit.t0) / 6)); W.camOverride = { ...CAM.finale, az: lerp(S.orbit.from, S.orbit.to, k) }; }

  // fireworks over the town
  if (S.fireworks != null && ft - S.fireworks < 9 && ft >= fwNext) {
    fwNext = ft + .28 + R() * .3;
    const cx = A.town.x + (R() - .5) * 34, cy = A.town.y + 16 + R() * 9, cz = A.town.z - 6 + (R() - .5) * 18, col = FW[Math.floor(R() * FW.length)], col2 = FW[Math.floor(R() * FW.length)];
    for (let i = 0; i < 46; i++) {
      const u = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 6 + R() * 2.5;
      fx.spawn({ x: cx, y: cy, z: cz, vx: Math.cos(a) * r * sp, vy: u * sp, vz: Math.sin(a) * r * sp, g: 4, drag: 1.3, life: 1.3 + R() * .5, color: i % 3 ? col : col2, size: .55, spin: 4 });
    }
  }
  fx.update(dt);
}

// playing in a normal browser: start once the fonts are in
document.fonts.ready.then(() => { window.__ready = true; if (!window.__rec) window.__go = true; });
