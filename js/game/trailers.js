// Trailers: scripted play-throughs that show how each fictional partner game works.
// Each one is a list of [seconds, cue] pairs run against a world and its HUD.
import { ICON, esc } from './hud.js?v=20261017';

export const BRANDS = {
  eco: { key: 'eco', name: 'Eco AI Explorer', tag: 'Nature centre', icon: 'leaf', bot: '#ffcf3d', world: 'pond' },
  stem: { key: 'stem', name: 'AI Inventor Lab', tag: 'STEM club', icon: 'gear', bot: '#ff8a3d', world: 'mars' },
  camp: { key: 'camp', name: 'Mission AI', tag: 'Holiday camp', icon: 'compass', bot: '#1fc7b6', world: 'island' },
  museum: { key: 'museum', name: 'AI Time Traveller', tag: 'Museum', icon: 'column', bot: '#e8b04b', world: 'rome' }
};

const chips = (list, n, cap, total) => `<small>${esc(cap)} <span class="hd-count">${n}/${total ?? list.length}</span></small><div class="hd-chips">${list.map(([name, c], i) => `<span class="${i < n ? 'got' : ''}" style="--c:${c}"><i></i>${esc(name)}</span>`).join('')}</div>`;
const setChips = (slot, n, cap, total) => {
  if (!slot) return;
  slot.querySelectorAll('.hd-chips span').forEach((s, i) => s.classList.toggle('got', i < n));
  const c = slot.querySelector('.hd-count'); if (c) c.textContent = `${n}/${total ?? slot.querySelectorAll('.hd-chips span').length}`;
};

/* ---------- Eco AI Explorer: design a pond habitat ---------- */
function pond(W, view) {
  const SPECIES = [['Mallard', '#2f8a52'], ['Frog', '#5cc04a'], ['Dragonfly', '#2fa8ff'], ['Heron', '#9aa6b3'], ['Butterfly', '#ff9f2e'], ['Damselfly', '#34d1a0'], ['Pond skater', '#7a5a3a'], ['Newt', '#e07b39']];
  let journal = null;
  const close = { dist: 80, el: .7, az: .55, oy: .04 }, bw = { dist: 74, el: .62, az: .95, target: W.anchors.boardwalk, oy: .04 };
  const cardsA = ['Make it tidy for visitors', 'Add a boardwalk and keep the reeds wild', 'Plant native flowers on one bank'];
  return {
    length: 19.5, poster: 17.8,
    reset() { W.setState('start'); W.camOverride = null; journal = null; },
    cues: [
      [.2, h => h.setStats(4, 1240)],
      [.5, h => h.showMission('Design a pond that wildlife and visitors can share', 'L2')],
      [1.9, h => h.setCards(cardsA, { label: 'Tell the AI helper what to do' })],
      [3.0, h => h.point(h.card(0))],
      [3.8, h => { h.tap(); h.pick(0); }],
      [4.4, h => { h.hideCards(); h.unpoint(); h.say('I took “tidy” to mean cut back. I’ll cut the reeds and add a gravel path and a deck.', { conf: 64 }); }],
      [5.0, (h, w) => { w.setState('nice'); w.camOverride = close; }],
      [6.8, h => { h.meters([{ key: 'v', label: 'Visitors', icon: 'people' }, { key: 'w', label: 'Wildlife', icon: 'leaf' }]); journal = h.slot('journal', chips(SPECIES, 2, 'Species seen')); }],
      [7.1, h => { h.meter('v', 88, 1); h.meter('w', 41, -1); }],
      [8.2, h => h.pop('The ducks have left', 'bad')],
      [9.6, h => { h.unpop(); h.ask('You asked for “tidy”. What did the AI think you meant?'); }],
      [11.2, h => { h.hush(); h.hidePanel(); h.setCards(cardsA, { label: 'Choose a clearer instruction' }); }],
      [12.0, h => h.point(h.card(1))],
      [12.7, h => { h.tap(); h.pick(1); h.unask(); }],
      [13.2, (h, w) => { h.hideCards(); h.unpoint(); h.say('Building a boardwalk across the water. The reeds stay wild.', { chip: 'Plan', conf: 92, tone: 'check' }); w.setState('wild'); w.camOverride = bw; }],
      [14.8, h => { h.on(h.panel); h.meter('v', 82, -1); h.meter('w', 90, 1); }],
      ...[3, 4, 5, 6, 7].map((n, i) => [15.1 + i * .28, () => setChips(journal, n)]),
      [16.3, (h, w) => { w.camOverride = { ...bw, dist: 50, el: .5 }; }],
      [16.6, h => { h.hush(); h.celebrate(3, 'Habitat plan saved', { badge: 'Badge earned: Wildlife friend', xp: 120 }); h.setStats(7, 1360); }],
      [18.9, h => { h.uncelebrate(); h.hidePanel(); h.on(h.mission, false); }]
    ]
  };
}

/* ---------- helpers for labels pinned to the world ---------- */
function pinner(view) {
  let list = [];
  return {
    add(hud, anchor, html, cls = 'hd-tag ai', size = null) {
      const e = hud.extra(cls + ' on', html); list.push({ e, anchor, size });
      return e;
    },
    set(e, html, cls) { e.className = 'hd-extra on ' + cls; e.innerHTML = html; },
    frame() {
      const placed = [];
      for (const p of list) {
        if (!p.e.isConnected) continue;
        const s = view.project(p.anchor), off = s.x < 8 || s.x > view.cssW - 8 || s.y < 8 || s.y > view.cssH - 8;
        p.e.style.visibility = off ? 'hidden' : '';
        if (!p.size) {
          // nudge labels apart so they never sit on top of each other
          const w = p.e.offsetWidth, hgt = p.e.offsetHeight + 4;
          for (const q of placed) if (Math.abs(q.x - s.x) < (w + q.w) / 2 && Math.abs(q.y - s.y) < hgt) s.y = q.y - hgt;
          placed.push({ x: s.x, y: s.y, w });
        }
        p.e.style.transform = p.size ? `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)` : `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
      }
    },
    clear() { list = []; }
  };
}

/* ---------- AI Inventor Lab: rover mission on Mars ---------- */
function mars(W, view) {
  const P = pinner(view);
  let prog = null, boxes = {};
  const cards = ['Drive as fast as you can', 'Use wide wheels and stay under 5 km/h', 'Test on sand before the long drive'];
  const follow = { target: W.anchors.rover, dist: 42, el: .56, az: .5, oy: .03 };
  const blk = (txt, c, cls = '') => `<div class="hd-blk ${cls}" style="--c:${c}">${txt}</div>`;
  return {
    length: 23, poster: 21.3,
    reset() { W.setState('start'); W.camOverride = null; P.clear(); prog = null; boxes = {}; },
    frame: () => P.frame(),
    cues: [
      [.2, h => h.setStats(2, 860)],
      [.5, h => h.showMission('Drive the rover to the crater and send back a photo', 'L4')],
      [1.4, h => { prog = h.extra('hd-prog', `<small class="hd-cap">Your programme</small><div class="hd-code">${blk('When mission starts', '#ff8a3d', 'hat')}</div>`); const pr = prog; requestAnimationFrame(() => pr.classList.add('on')); }],
      [2.0, h => h.setCards(cards, { label: 'Choose an instruction' })],
      [3.0, h => h.point(h.card(0))],
      [3.7, h => { h.tap(); h.pick(0); }],
      [4.1, h => { h.hideCards(); h.unpoint(); prog.querySelector('.hd-code').insertAdjacentHTML('beforeend', blk('drive <em>as fast as you can</em>', '#5b4cf0', 'new')); }],
      [4.5, h => h.say('I took “fast” to mean top speed. I picked small, hard wheels.', { conf: 72 })],
      [5.0, (h, w) => { w.setState('fast'); w.camOverride = follow; }],
      [7.7, h => { h.pop('Stuck in soft sand', 'bad'); h.meters([{ key: 's', label: 'Speed', icon: 'bolt' }, { key: 'g', label: 'Grip', icon: 'gear' }]); }],
      [8.0, h => { h.meter('s', 92, 1); h.meter('g', 23, -1); }],
      [9.4, h => { h.unpop(); h.ask('It was fast on flat ground. What changed on the sand?'); }],
      [10.9, h => { h.hush(); h.hidePanel(); h.setCards(cards, { label: 'Change the instruction' }); }],
      [11.7, h => h.point(h.card(1))],
      [12.3, h => { h.tap(); h.pick(1); h.unask(); }],
      [12.7, h => { h.hideCards(); h.unpoint(); const b = prog.querySelectorAll('.hd-blk')[1]; b.outerHTML = blk('drive <em>with wide wheels, under 5 km/h</em>', '#5b4cf0', 'swap'); h.say('Wide wheels spread the weight. Driving slowly over the dunes.', { chip: 'Plan', conf: 90, tone: 'check' }); }],
      [13.1, (h, w) => { w.setState('wide'); w.camOverride = { ...follow, dist: 52, az: .62 }; }],
      [14.6, (h, w) => {
        w.camOverride = { ...follow, dist: 60, az: .62, target: W.anchors.rover.clone().add(new W.anchors.rover.constructor(3, 0, 0)) };
        boxes.a = P.add(h, W.anchors.rockA, '<b>Rock 94%</b>', 'hd-vbox opt', 1);
        boxes.b = P.add(h, W.anchors.rockB, '<b>Rock 91%</b>', 'hd-vbox opt', 1);
        boxes.c = P.add(h, W.anchors.shadow, '<b>Crater 58%</b>', 'hd-vbox bad', 1);
        Object.values(boxes).forEach(b => { b.style.width = '4.4em'; b.style.height = '3.2em'; });
        h.say('I can see two rocks and a crater ahead.', { chip: 'Camera', conf: 58 });
      }],
      [15.9, h => h.point(boxes.c)],
      [16.5, h => { h.tap(); P.set(boxes.c, '<b>Shadow</b>', 'hd-vbox'); boxes.c.style.width = '4.4em'; boxes.c.style.height = '3.2em'; h.say('You checked it. That dark patch is a shadow.', { chip: 'Fixed', tone: 'check', conf: 97 }); }],
      [17.1, h => { h.unpoint(); h.on(h.panel); h.meter('s', 54, -1); h.meter('g', 91, 1); }],
      [19.0, (h, w) => { Object.values(boxes).forEach(b => b.classList.remove('on')); w.camOverride = { ...follow, dist: 84, az: .62 }; w.scan(); }],
      [19.6, (h, w) => {
        w.photo(); const f = h.extra('hd-flash', ''); f.classList.add('on');
        const ph = h.extra('hd-photo', '<canvas width="320" height="200"></canvas>Crater photo #1');
        // the photo is a real snapshot of what the rover can see
        const src = view.canvas, cv = ph.querySelector('canvas'), sw = src.width * .46, sh = sw * .625;
        cv.getContext('2d').drawImage(src, (src.width - sw) / 2, src.height * .34, sw, sh, 0, 0, 320, 200);
        requestAnimationFrame(() => ph.classList.add('on'));
      }],
      [20.1, (h, w) => { h.hush(); h.hidePanel(); w.camOverride = { ...follow, dist: 50, el: .48, oy: .2 }; h.celebrate(3, '', { badge: 'Level 5 reached', xp: 130, style: 'gate' }); h.setStats(5, 990); }],
      [22.4, h => { h.uncelebrate(); h.on(h.mission, false); }]
    ]
  };
}

/* ---------- Mission AI: island expedition at a holiday camp ---------- */
function island(W, view) {
  let votes = null, board = null, ring = null;
  const TEAMS = [['Foxes', '#ff8a3d', 420], ['Otters', '#1fc7b6', 390], ['Hawks', '#7a5cc4', 360], ['Badgers', '#5b6b76', 300]];
  const score = { Foxes: 420, Otters: 390, Hawks: 360, Badgers: 300 };
  const drawBoard = () => {
    const order = Object.keys(score).sort((a, b) => score[b] - score[a]);
    board.querySelectorAll('li').forEach(li => { const n = li.dataset.t; li.style.top = order.indexOf(n) * 2.12 + 'em'; li.querySelector('b').textContent = score[n]; });
  };
  const OPTS = ['Take the quickest route', 'Follow the river and rest at the hut', 'Split up and meet at the lighthouse'];
  const COLS = ['#ff6a2b', '#1f9fd6', '#8a5cd6'];
  const showVotes = (h, label) => {
    votes = h.extra('hd-votes', `<p class="hd-pick" style="position:absolute;top:-2.2em;left:0">${label}</p>` + OPTS.map((o, i) => `<div class="hd-vote" style="--c:${COLS[i]}"><p><span class="k">${'ABC'[i]}</span>${o}</p><div class="dots"></div></div>`).join(''));
    const v = votes; v.style.opacity = 0; requestAnimationFrame(() => { v.style.transition = 'opacity .4s'; v.style.opacity = 1; });
  };
  const vote = i => votes && votes.querySelectorAll('.dots')[i].insertAdjacentHTML('beforeend', '<i></i>');
  const result = w => votes.querySelectorAll('.hd-vote').forEach((v, i) => v.classList.add(i === w ? 'win' : 'lose'));
  const hideVotes = () => { if (votes) { votes.style.opacity = 0; const v = votes; setTimeout(() => v.remove(), 400); votes = null; } };
  const seq = (start, picks) => picks.map((p, k) => [start + k * .22, () => vote(p)]);
  let clock = 150;
  return {
    length: 23.5, poster: 22.4,
    reset() { W.setState('start'); W.camOverride = null; votes = board = ring = null; Object.assign(score, { Foxes: 420, Otters: 390, Hawks: 360, Badgers: 300 }); clock = 150; },
    frame: (t, h, lt) => {
      if (!ring) return;
      clock = Math.max(0, 150 - Math.max(0, lt - 1) * 6.5);
      ring.querySelector('b').textContent = `${Math.floor(clock / 60)}:${String(Math.floor(clock % 60)).padStart(2, '0')}`;
      ring.querySelector('.fg').style.strokeDashoffset = (1 - clock / 150) * 75.4;
    },
    cues: [
      [.2, h => h.setStats(3, 640)],
      [.5, h => h.showMission('Get your team to the lighthouse before sunset', 'Day 3')],
      [1.0, h => { ring = h.extra('hd-ring', `<svg viewBox="0 0 28 28"><circle class="bg" cx="14" cy="14" r="12"/><circle class="fg" cx="14" cy="14" r="12" stroke-dasharray="75.4" stroke-dashoffset="0"/></svg>Sunset in <b>2:30</b>`); }],
      [1.4, h => { board = h.extra('hd-board', `<small>Camp leaderboard</small><ol>${TEAMS.map(([n, c]) => `<li data-t="${n}" class="${n === 'Otters' ? 'me' : ''}"><i style="--c:${c}"></i>${n}<b>0</b></li>`).join('')}</ol>`); drawBoard(); }],
      [2.2, h => showVotes(h, 'Team vote: how do we get there?')],
      ...seq(2.8, [0, 1, 0, 0, 2, 0, 0, 1]),
      [5.0, () => result(0)],
      [5.6, h => { hideVotes(); h.say('I took “quickest” to mean shortest. I sent you straight over the ridge.', { conf: 70 }); }],
      [6.1, (h, w) => { w.setState('quick'); w.camOverride = { target: W.anchors.team, dist: 56, el: .6, az: .78, oy: .02 }; }],
      [9.6, h => { h.pop('The slope is too steep. The team needs a rest', 'bad'); h.meters([{ key: 't', label: 'Time left', icon: 'clock' }, { key: 'e', label: 'Energy', icon: 'bolt' }]); }],
      [9.9, h => { h.meter('t', 81); h.meter('e', 30, -1); }],
      [11.0, h => { h.unpop(); h.ask('The shortest route can take longer. What else matters?'); }],
      [12.4, h => { h.hush(); h.hidePanel(); showVotes(h, 'Vote again'); }],
      ...seq(12.9, [1, 1, 2, 1, 1, 1, 0, 1]),
      [14.9, () => result(1)],
      [15.4, h => { hideVotes(); h.unask(); h.say('Following the river. A rest at the hut keeps your energy up.', { chip: 'Plan', conf: 88, tone: 'check' }); }],
      [15.8, (h, w) => { w.setState('river'); w.camOverride = { target: W.anchors.team, dist: 58, el: .64, az: .55, oy: .02 }; }],
      [18.2, (h, w) => { h.on(h.panel); h.meter('t', 64, -1); h.meter('e', 86, 1); w.camOverride = { target: W.anchors.lighthouse, dist: 100, el: .5, az: .62, oy: .06 }; }],
      [20.9, (h, w) => { w.camOverride = { target: W.anchors.team, dist: 52, el: .45, az: .7, oy: .2 }; }],
      [21.2, h => { h.hush(); h.hidePanel(); h.celebrate(3, 'Expedition map saved', { badge: 'Otters take first place', xp: 120, style: 'confetti' }); h.setStats(6, 760); score.Otters = 510; drawBoard(); }],
      [23.2, h => { h.uncelebrate(); }]
    ]
  };
}

/* ---------- AI Time Traveller: a day in Roman Londinium ---------- */
const ART = {
  amphora: '<svg viewBox="0 0 24 24"><path d="M9 2h6v2.5c0 .8.6 1.2 1.2 1.6 2 1.3 3.3 3.5 3.3 6.4 0 4.2-3 7.6-5.5 9.5h-4C7.5 20.1 4.5 16.7 4.5 12.5c0-2.9 1.3-5.1 3.3-6.4.6-.4 1.2-.8 1.2-1.6z"/></svg>',
  bread: '<svg viewBox="0 0 24 24"><path d="M3 13c0-4 4-7 9-7s9 3 9 7v3.5c0 1.4-1.1 2.5-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5z"/></svg>',
  shell: '<svg viewBox="0 0 24 24"><path d="M12 3c5 0 9 3.6 9 8.5 0 4.4-3.6 8.5-9 9.5-5.4-1-9-5.1-9-9.5C3 6.6 7 3 12 3z"/></svg>',
  coin: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>'
};
function rome(W, view) {
  const P = pinner(view);
  let arts = null;
  const cards = ['Show what Romans ate', 'Find what a dock worker had for lunch', 'Compare a rich family’s dinner with food from a street stall'];
  const ITEMS = [['amphora', 'Amphora (storage jar)'], ['bread', 'Bread'], ['shell', 'Oysters'], ['coin', 'Coin']];
  const got = n => arts && arts.querySelectorAll('.hd-art').forEach((a, i) => a.classList.toggle('got', i < n));
  return {
    length: 21.5, poster: 18.4,
    reset() { W.setState('start'); W.camOverride = null; P.clear(); arts = null; },
    frame: () => P.frame(),
    cues: [
      [.2, h => h.setStats(5, 1520)],
      [.5, h => h.showMission('Plan a day in Londinium, Roman London, for a traveller arriving by boat', 'Room 3')],
      [1.9, h => h.setCards(cards, { label: 'Ask the AI helper' })],
      [3.0, h => h.point(h.card(0))],
      [3.7, h => { h.tap(); h.pick(0); }],
      [4.2, h => { h.hideCards(); h.unpoint(); h.say('I took “what Romans ate” to mean a feast. I planned peacock, dormice and oysters.', { conf: 66 }); }],
      [4.8, (h, w) => { w.setState('feast'); w.camOverride = { target: W.anchors.feast, dist: 76, el: .58, az: .5, oy: .03 }; }],
      [6.2, h => P.add(h, W.anchors.feast, 'A Roman feast', 'hd-tag ai')],
      [6.8, h => { h.meters([{ key: 'a', label: 'Accuracy', icon: 'check' }, { key: 'c', label: 'Curiosity', icon: 'bulb' }]); arts = h.slot('arts', `<small>Evidence found <span class="hd-count">0/4</span></small><div class="hd-arts">${ITEMS.map(([k, n]) => `<div class="hd-art"><span>${ART[k]}</span>${n}</div>`).join('')}</div>`); }],
      [7.1, h => { h.meter('a', 34, -1); h.meter('c', 90, 1); }],
      [8.3, h => h.ask('Who in Londinium ate like this? Who did not?')],
      [9.8, h => { h.hush(); h.hidePanel(); h.root.querySelectorAll('.hd-tag').forEach(e => e.classList.remove('on')); h.setCards(cards, { label: 'Ask a clearer question' }); }],
      [10.6, h => h.point(h.card(1))],
      [11.2, h => { h.tap(); h.pick(1); h.unask(); }],
      [11.7, h => { h.hideCards(); h.unpoint(); h.say('I’ll check the evidence where boats unload, at the bakery and by the river.', { chip: 'Evidence', conf: 85, tone: 'check' }); }],
      [12.1, (h, w) => { w.setState('evidence'); w.camOverride = { target: W.anchors.wharf, dist: 74, el: .6, az: .62, oy: .03 }; }],
      [13.4, h => { P.add(h, W.anchors.amphorae, 'Olive oil from Spain', 'hd-tag good'); h.on(h.panel); got(1); arts.querySelector('.hd-count').textContent = '1/4'; }],
      [14.1, h => { P.add(h, W.anchors.bakery, 'Bread oven', 'hd-tag good'); got(2); arts.querySelector('.hd-count').textContent = '2/4'; }],
      [14.8, h => { P.add(h, W.anchors.oysters, 'Oyster shells', 'hd-tag good'); got(3); arts.querySelector('.hd-count').textContent = '3/4'; }],
      [15.6, h => { h.meter('a', 88, 1); h.meter('c', 94, 1); }],
      [16.9, (h, w) => { w.camOverride = { target: W.anchors.wharf, dist: 50, el: .5, az: .62, oy: .08 }; }],
      [17.2, h => { h.hush(); h.hidePanel(); h.celebrate(3, 'Diary saved with three pieces of evidence', { badge: 'Evidence checked', xp: 120, style: 'stamp' }); h.setStats(8, 1640); }],
      [20.8, h => { h.uncelebrate(); h.root.querySelectorAll('.hd-tag').forEach(e => e.classList.remove('on')); }]
    ]
  };
}

export const TRAILERS = { pond, mars, island, rome };
