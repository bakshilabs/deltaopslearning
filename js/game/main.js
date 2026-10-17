// Wires the games into the page: the hero player, the example worlds and the Roman Port demo.
import { hub, View } from './engine.js?v=20261017c';
import { WORLDS } from './worlds.js?v=20261017c';
import { Hud, Trailer } from './hud.js?v=20261017c';
import { BRANDS, TRAILERS } from './trailers.js?v=20261017c';

const reduce = hub.reduce;
const idle = fn => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
document.documentElement.classList.add('games');

/* ======================= players: a partner game playing its trailer =======================
   The hero plays one brand on a loop. The worlds section plays whichever example tab is chosen. */
function player(el, { tabs = [], onShow = null, ambient = false } = {}) {
  const keys = el.dataset.player.split(' ');
  const playArea = el.closest('.hero-play');
  const pauseBtn = el.parentElement.querySelector('[data-pause]');
  const games = {};
  let cur = null, phase = 'idle', phaseT = 0, want = keys[0];
  const mark = key => {
    el.dataset.brand = key;
    tabs.forEach(t => { const on = t.dataset.key === key; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
    if (onShow) onShow(key);
  };
  const view = new View(el, { maxDpr: 3, onUpdate: t => step(t) });
  if (!view.ok) {
    // no WebGL: show a still of each game instead
    el.classList.add('nogl'); if (pauseBtn) pauseBtn.hidden = true;
    const still = key => { el.style.setProperty('--poster', `url(/img/game/poster-${key}.webp)`); mark(key); };
    tabs.forEach(t => t.addEventListener('click', () => { if (!t.dataset.frame) still(t.dataset.key); }));
    still(keys[0]);
    return;
  }

  function game(key) {
    if (!games[key]) {
      const b = BRANDS[key], world = WORLDS[b.world]();
      const root = document.createElement('div');
      el.appendChild(root);
      root.hidden = true;
      const hud = new Hud(root, b);
      const spec = TRAILERS[b.world](world, view);
      const tr = new Trailer({ world, hud, ...spec, onLoop: () => leave() });
      games[key] = { key, world, hud, tr, root, spec };
    }
    return games[key];
  }
  let first = true;
  function show(key) {
    const g = game(key);
    if (cur && cur !== g) { cur.hud.clear(); cur.root.hidden = true; }
    cur = g; want = key;
    mark(key);
    g.root.hidden = false;
    g.world.camOverride = null; g.world.snapCam();
    view.setWorld(g.world);
    el.classList.add('ready');
    if (ambient) return still(g);
    if (reduce || view.paused) return poster(g);
    g.hud.clear();
    if (first) { first = false; g.world.finish(); phase = 'build'; phaseT = view.t - .6; }
    else { g.world.build(); phase = 'build'; phaseT = view.t; }
    // build the next tab's world while this one plays
    const next = keys[(keys.indexOf(key) + 1) % keys.length];
    if (next !== key) idle(() => game(next));
  }
  // jump straight to a finished moment (reduced motion, or a tab chosen while paused)
  function poster(g) {
    g.world.finish(); g.root.classList.add('instant');
    g.tr.start(view.t);
    const dt = 1 / 30;
    for (let s = 0; s < g.spec.poster; s += dt) { view.t += dt; g.world.step(view.t, dt); g.tr.update(view.t); }
    phase = 'held';
    hub.drawStill(view);
    requestAnimationFrame(() => requestAnimationFrame(() => g.root.classList.remove('instant')));
  }
  // phones: a calm, finished world that drifts slowly, showing only the brand and the mission,
  // so the hero does not compete with the real demo below it
  function still(g) {
    g.tr.seek(1, view.t);
    if (BRANDS[g.key].world === 'pond') g.world.setState('wild', true);
    g.world.cam = { ...g.world.cam, sway: .22 };
    g.world.finish();
    phase = 'held';
    view.refresh();
  }
  // at the end of a play-through, take the world down and build it again
  function leave() { phase = 'out'; phaseT = view.t; cur.hud.clear(); cur.world.unbuild(); }
  function step(t) {
    if (!cur) return;
    if (phase === 'build' && t - phaseT > 1.25) { phase = 'play'; cur.tr.start(t); if (playArea) playArea.classList.add('noted'); }
    else if (phase === 'play') cur.tr.update(t);
    else if (phase === 'out' && t - phaseT > .85) show(want);
  }
  tabs.forEach((t, i) => {
    // a tab with data-frame shows the real club app in a frame instead (handled by the worlds section)
    t.addEventListener('click', () => { if (t.dataset.frame) return; if (t.dataset.key !== cur.key) show(t.dataset.key); else mark(t.dataset.key); });
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const n = tabs[(i + d + tabs.length) % tabs.length];
      n.focus(); n.click();
    });
  });
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      const p = !view.paused;
      view.pause(p);
      el.classList.toggle('paused', p);
      pauseBtn.setAttribute('aria-pressed', String(p));
      pauseBtn.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause');
      pauseBtn.querySelector('.sr').textContent = p ? 'Play the game preview' : 'Pause the game preview';
    });
    if (reduce) pauseBtn.hidden = true;
  }
  show(keys[0]);
  return { pause: p => { if (!pauseBtn || pauseBtn.getAttribute('aria-pressed') !== 'true') view.pause(p); } };
}

// hero: one partner game on a loop
const heroEl = document.querySelector('.hero [data-player]');
if (heroEl) player(heroEl, { ambient: matchMedia('(max-width: 640px)').matches });

// worlds: three example partners in one component, built when it comes near the screen
const worldsEl = document.querySelector('[data-worlds]');
if (worldsEl) {
  const tabs = [...worldsEl.querySelectorAll('[role="tab"]')];
  const panel = worldsEl.querySelector('[role="tabpanel"]');
  const copies = [...worldsEl.querySelectorAll('[data-copy]')];
  const gw = worldsEl.querySelector('[data-player]');
  const frameBox = worldsEl.querySelector('.ws-frame');
  const frame = frameBox && frameBox.querySelector('iframe');
  let ctl = null;
  const showCopy = key => {
    copies.forEach(c => c.classList.toggle('on', c.dataset.copy === key));
    panel.setAttribute('aria-labelledby', 'ws-t-' + key);
  };
  // the Museum and Game Lab tabs play a real mission from the club app, in a frame
  const capText = worldsEl.querySelector('.gw-cap > span');
  const capPause = worldsEl.querySelector('.gw-cap [data-pause]');
  const capWas = capText ? capText.textContent : '';
  // while the Game Lab frame shows, the pause button pauses the frame
  let frameHeld = false, viewIcon = null;
  const setIcon = (held, what) => {
    capPause.setAttribute('aria-pressed', String(held));
    capPause.querySelector('use').setAttribute('href', held ? '#i-play' : '#i-pause');
    capPause.querySelector('.sr').textContent = (held ? 'Play ' : 'Pause ') + what;
  };
  if (capPause) capPause.addEventListener('click', e => {
    if (!frameBox || frameBox.hidden) return;
    e.stopImmediatePropagation();
    frameHeld = !frameHeld;
    setIcon(frameHeld, 'the lab preview');
    if (frame.contentWindow) frame.contentWindow.postMessage(frameHeld ? 'pause' : 'play', location.origin);
  }, true);
  const hideFrame = () => {
    if (!frameBox || frameBox.hidden) return;
    frameBox.hidden = true; gw.hidden = false;
    if (capText) capText.textContent = capWas;
    if (capPause && viewIcon) { setIcon(viewIcon.held, 'the game preview'); viewIcon = null; }
    if (frame.contentWindow) frame.contentWindow.postMessage('pause', location.origin);
    if (ctl) ctl.pause(false);
  };
  tabs.forEach(t => t.addEventListener('click', () => {
    if (!t.dataset.frame) { hideFrame(); return; }
    tabs.forEach(b => { const on = b === t; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    showCopy(t.dataset.key);
    if (frame.getAttribute('src') !== t.dataset.frame) { frame.src = t.dataset.frame; frame.title = t.dataset.title || frame.title; }
    else if (frame.contentWindow) frame.contentWindow.postMessage('play', location.origin);
    frameBox.hidden = false; gw.hidden = true;
    if (capText) capText.textContent = t.dataset.cap || capWas;
    if (capPause && !viewIcon) { viewIcon = { held: capPause.getAttribute('aria-pressed') === 'true' }; frameHeld = false; setIcon(false, 'the lab preview'); }
    if (ctl) ctl.pause(true);
  }));
  const start = () => { ctl = player(gw, { tabs, onShow: showCopy }); };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { io.disconnect(); idle(start); } }, { rootMargin: '500px 0px' });
    io.observe(worldsEl);
  } else start();
}

/* ======================= the Eco Town demo ======================= */
// One question: what should the town build to keep its lights on tonight? The child's choice is
// built in the world, then the night plays out hour by hour while the camera circles the town.
// Each choice has its own result and trade-off; nothing is marked wrong.
const HOURS = [18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];
const PLANS = [
  { kit: { turbines: true, panels: false }, battery: false, outAt: null,
    big: 'Lights on all night', short: 'On all night',
    effect: 'The wind blew all night, so the turbines kept the lights on.',
    tradeoff: 'But on a still night, the turbines would stop.',
    facil: 'What could the town add for a night with no wind?' },
  { kit: { turbines: false, panels: true }, battery: false, outAt: 20,
    big: 'Lights out at 20:00', short: 'Out at 20:00',
    effect: 'The panels made power all afternoon, then stopped when the sun set.',
    tradeoff: 'Solar panels only work while the sun is up.',
    facil: 'How could the town save the afternoon’s sunshine for the night?' },
  { kit: { turbines: false, panels: true }, battery: true, outAt: 4,
    big: 'Lights on until 04:00', short: 'On until 04:00',
    effect: 'The battery filled up in the sun, then kept the lights on after dark.',
    tradeoff: 'It works without wind, but this battery ran out before morning.',
    facil: 'How could the lights last until morning?' }
];
const hh = h => String(h).padStart(2, '0') + ':00';

function demo() {
  const root = document.querySelector('[data-demo]');
  if (!root) return;
  const $ = s => root.querySelector(s);
  const flow = [...document.querySelectorAll('[data-flow] li')];
  const cards = [...root.querySelectorAll('[data-card]')], cardWrap = $('.cards');
  const res = $('[data-result]'), big = $('[data-big]');
  const clock = $('[data-clock]'), status = $('[data-status]'), hoursEl = $('[data-hours]'), note = $('[data-hours-note]');
  const gameEl = $('[data-demo-game]');
  const world = WORLDS.town();
  const view = new View(gameEl, { maxDpr: 3 });
  if (view.ok) { view.setWorld(world); gameEl.classList.add('ready'); } else gameEl.classList.add('nogl');
  const base = { ...world.cam };
  let timers = [];
  const phone = () => matchMedia('(max-width: 640px)').matches;
  const later = (fn, ms) => timers.push(setTimeout(fn, reduce ? 0 : ms));
  const setFlow = name => {
    const k0 = ['mission', 'decision', 'consequence', 'iterate'].indexOf(name);
    flow.forEach((li, k) => { li.classList.toggle('on', k === k0); li.classList.toggle('done', k < k0); });
  };
  const orbit = k => { world.camOverride = { az: base.az - .35 + k * .7, el: base.el, dist: base.dist * .92, fov: base.fov }; };
  // the town before any choice: midday sun, nothing built yet
  function reset() {
    world.setKit({ turbines: false, panels: false }); world.setHour(12); world.camOverride = null;
    world.setPower({ lit: 0, gas: 0, bat: 0, level: 0, blackout: 0 }); view.refresh(30);
    clock.textContent = '12:00'; status.hidden = true; big.className = 'dm-big'; big.textContent = '';
    hoursEl.innerHTML = '';
    HOURS.forEach(h => { const li = document.createElement('li'); li.innerHTML = '<i></i><span></span>'; li.children[1].textContent = h % 3 === 0 ? hh(h) : ''; hoursEl.appendChild(li); });
    note.textContent = '';
  }
  reset(); setFlow('mission');

  function choose(k) {
    timers.forEach(clearTimeout); timers = [];
    const p = PLANS[k];
    cards.forEach((c, j) => c.setAttribute('aria-pressed', String(j === k)));
    cardWrap.classList.add('busy'); res.hidden = true;
    if (phone()) {
      const top = gameEl.getBoundingClientRect().top, navH = 80;
      if (top < navH || top > innerHeight * .4) scrollBy({ top: top - navH, behavior: reduce ? 'auto' : 'smooth' });
    }
    reset(); setFlow('decision');
    // build it in the afternoon sun
    world.setKit(p.kit); world.setHour(15); clock.textContent = '15:00'; orbit(0);
    world.setPower({ lit: 1, bat: p.battery ? 1 : 0, level: p.battery ? .9 : 0, blackout: 0 }); view.refresh(40);
    status.textContent = p.battery ? 'Building solar panels and a battery' : p.kit.turbines ? 'Building wind turbines' : 'Building solar panels'; status.className = 'dm-status'; status.hidden = false;
    $('[data-pick]').textContent = 'Watch the night…';
    // then the night, hour by hour, while the camera circles the town
    const cells = [...hoursEl.children];
    HOURS.forEach((h, j) => later(() => {
      const out = p.outAt != null && j >= HOURS.indexOf(p.outAt);
      world.setHour(h); orbit((j + 1) / HOURS.length);
      world.setPower({ lit: 1, blackout: out ? 1 : 0, bat: p.battery && !out && j > 0 ? -1 : 0, level: p.battery ? Math.max(0, .9 - j * .09) : 0 });
      clock.textContent = hh(h); view.refresh(30);
      cells[j].className = out ? 'off' : 'on';
      setFlow('consequence');
      if (out && h === p.outAt) { status.textContent = `Lights out at ${hh(h)}`; status.className = 'dm-status warn'; }
      else if (j === 0) status.textContent = 'The sun sets';
      else if (p.battery && j === 1) status.textContent = 'The battery takes over';
    }, 1400 + j * 420));
    later(() => done(k), 1400 + HOURS.length * 420 + 200);
  }
  function done(k) {
    const p = PLANS[k];
    big.textContent = p.big; big.className = 'dm-big on ' + (p.outAt == null ? 'good' : 'dark');
    status.hidden = true;
    $('[data-effect]').textContent = p.effect;
    $('[data-tradeoff]').textContent = p.tradeoff;
    $('[data-facil]').textContent = '“' + p.facil + '”';
    note.textContent = p.outAt == null ? 'The lights stayed on all night.' : `The lights stayed on until ${hh(p.outAt)}.`;
    res.hidden = false; cardWrap.classList.remove('busy');
    cards[k].classList.add('tried'); cards[k].querySelector('[data-res]').textContent = p.short;
    $('[data-pick]').textContent = cards.every(c => c.classList.contains('tried')) ? 'You have tried all three. Which would you choose, and why?' : 'Now try another choice and compare.';
    later(() => setFlow('iterate'), 1200);
    if (phone()) res.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }
  cards.forEach((c, k) => c.addEventListener('click', () => choose(k)));
  $('[data-again]').addEventListener('click', () => {
    timers.forEach(clearTimeout); timers = [];
    res.hidden = true; cards.forEach(c => c.setAttribute('aria-pressed', 'false'));
    reset(); setFlow('iterate');
    $('[data-pick]').textContent = 'Tap another choice to compare.';
    cards.find(c => !c.classList.contains('tried'))?.focus();
  });
}
demo();
