// Game HUD: the on-screen game interface drawn over a world (Inter, chunky game UI).
// Every widget is plain DOM so text stays crisp and readable at any size.

export const ICON = {
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 16.9l-5.6 2.9 1.1-6.2-4.6-4.4 6.3-.9z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 4.5 13.5h6.2L9.8 22l9-11.6h-6.2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.3 4.3L19 7.2" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 6.5 11 11m0-11-11 11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l7 8h-4.5v6h-5v-6H5z"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19l-7-8h4.5V5h5v6H19z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 8.5V13l3 2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19.5C5 11 10.5 5 20 4.5c-.2 9.8-6 15-15 15z"/><path d="M5.5 19c3-4 6-6.6 9.6-8.6" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.8" stroke-linecap="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 2.5h3.4l.5 2.7 2 .9 2.3-1.6 2.4 2.4-1.6 2.3.9 2 2.7.5v3.4l-2.7.5-.9 2 1.6 2.3-2.4 2.4-2.3-1.6-2 .9-.5 2.7h-3.4l-.5-2.7-2-.9-2.3 1.6-2.4-2.4 1.6-2.3-.9-2-2.7-.5v-3.4l2.7-.5.9-2-1.6-2.3 2.4-2.4 2.3 1.6 2-.9zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" fill-rule="evenodd"/></svg>',
  compass: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 5.4-2.4 6.8-6.8 2.4 2.4-6.8z" fill-rule="evenodd"/></svg>',
  column: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5 12 3l9 4.5zM4 8.8h16v2H4zM5.5 12h2.6v6.5H5.5zM10.7 12h2.6v6.5h-2.6zM15.9 12h2.6v6.5h-2.6zM3.5 19.5h17v2h-17z"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a6.8 6.8 0 0 0-4 12.3V17h8v-2.2a6.8 6.8 0 0 0-4-12.3zM9 18.5h6v1.5a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/></svg>',
  people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="8" r="3.2"/><circle cx="16.5" cy="9" r="2.6"/><path d="M2.5 19.5c.6-3.8 3-5.8 6-5.8s5.4 2 6 5.8zM14.6 14.2c3.2-.6 6 1 6.9 5.3h-5"/></svg>',
  planet: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M6.5 8.5c1.6.4 2.6 1.6 2.4 3.2-.2 1.4 1.2 2 2.2 2.8.9.8.4 2.6-.4 3.8M14.5 4.3c-.5 1.6.4 2.9 2 3.1 1.5.2 2.8 1.2 3.3 2.5" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.6" stroke-linecap="round"/></svg>'
};

const BOT = c => `<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="22.5" y="3" width="3" height="8" rx="1.5" fill="#fff" opacity=".9"/><circle cx="24" cy="4.5" r="3.6" fill="${c}"/><rect x="7" y="10" width="34" height="30" rx="11" fill="#fff"/><rect x="11" y="15" width="26" height="18" rx="8" fill="#14213a"/><circle cx="18.5" cy="24" r="3.6" fill="${c}"/><circle cx="29.5" cy="24" r="3.6" fill="${c}"/><circle cx="19.6" cy="22.9" r="1.1" fill="#fff"/><circle cx="30.6" cy="22.9" r="1.1" fill="#fff"/><rect x="3.5" y="20" width="4" height="10" rx="2" fill="#fff" opacity=".85"/><rect x="40.5" y="20" width="4" height="10" rx="2" fill="#fff" opacity=".85"/></svg>`;

const h = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Hud {
  constructor(root, brand) {
    this.root = root; this.brand = brand;
    root.classList.add('hud');
    root.setAttribute('aria-hidden', 'true');
    this.top = h('div', 'hd-top');
    this.badge = h('div', 'hd-brand', `<span class="hd-logo">${ICON[brand.icon]}</span><span><b>${esc(brand.name)}</b><small>${esc(brand.tag)}</small></span>`);
    this.stats = h('div', 'hd-stats', `<span class="hd-stat st-star">${ICON.star}<b>0</b></span><span class="hd-stat st-xp"><i>XP</i><b>0</b></span>`);
    this.top.append(this.badge, this.stats);
    this.mission = h('div', 'hd-mission', '<span class="hd-lv"></span><p><small>Mission</small><b></b></p>');
    this.bubble = h('div', 'hd-bubble', `<span class="hd-bot">${BOT(brand.bot || '#3be0c2')}</span><div><p class="hd-who"><b>AI helper</b><span class="hd-chip">Plan</span></p><p class="hd-say"></p><p class="hd-conf"><span><i></i></span><em></em></p></div>`);
    this.cards = h('div', 'hd-cards');
    this.panel = h('div', 'hd-panel');
    this.toast = h('div', 'hd-toast');
    this.prompt = h('div', 'hd-prompt', '<small>Facilitator</small><b></b>');
    this.finger = h('div', 'hd-finger', '<svg viewBox="0 0 32 32"><path d="M12.2 3.6c1.3 0 2.3 1 2.3 2.3v8.3l1-.2c.2-1.1 1.2-1.9 2.3-1.9 1.1 0 2 .7 2.3 1.7.4-.5 1.1-.8 1.8-.8 1.2 0 2.2.9 2.3 2.1.4-.3.9-.4 1.4-.4 1.3 0 2.3 1 2.3 2.3v5.2c0 4.6-3.7 8.3-8.3 8.3h-1.9c-2.6 0-5-1.2-6.6-3.3l-5-6.6c-.8-1-.6-2.5.4-3.3 1-.7 2.4-.6 3.2.3l1.3 1.5V5.9c0-1.3 1-2.3 2.3-2.3z" fill="#fff" stroke="#0c1b24" stroke-width="1.6" stroke-linejoin="round"/></svg><i></i>');
    this.burst = h('div', 'hd-burst');
    root.append(this.top, this.mission, this.bubble, this.cards, this.panel, this.toast, this.prompt, this.burst, this.finger);
    this.counters = [];
    this.typer = null;
    this.score = { stars: 0, xp: 0 };
  }
  // ---- small helpers
  on(el, v = true) { el.classList.toggle('on', v); }
  setStats(stars, xp) {
    this.countTo(this.stats.querySelector('.st-star b'), stars, .5);
    this.countTo(this.stats.querySelector('.st-xp b'), xp, 1.1);
    this.stats.classList.remove('bump'); void this.stats.offsetWidth; this.stats.classList.add('bump');
    this.score = { stars, xp };
  }
  countTo(el, to, dur = .9) { this.counters.push({ el, from: +el.textContent || 0, to, t0: this.t ?? 0, dur }); }
  showMission(text, level) {
    this.mission.querySelector('b').textContent = text;
    this.mission.querySelector('.hd-lv').textContent = level || '';
    this.mission.classList.remove('mini');
    this.on(this.mission);
    this.miniAt = (this.t ?? 0) + 2.8;
  }
  say(text, { chip = 'Plan', conf = null, tone = '' } = {}) {
    const b = this.bubble;
    b.querySelector('.hd-chip').textContent = chip;
    b.className = 'hd-bubble on ' + tone;
    this.typer = { el: b.querySelector('.hd-say'), text, t0: this.t ?? 0 };
    this.typer.el.textContent = '';
    const c = b.querySelector('.hd-conf');
    if (conf == null) c.hidden = true;
    else { c.hidden = false; c.querySelector('i').style.width = '0%'; c.querySelector('em').textContent = conf + '% sure'; requestAnimationFrame(() => (c.querySelector('i').style.width = conf + '%')); }
  }
  hush() { this.on(this.bubble, false); }
  setCards(list, { label = 'Pick a card' } = {}) {
    this.cards.innerHTML = `<p class="hd-pick">${esc(label)}</p>` + list.map((c, i) => `<button type="button" tabindex="-1" class="hd-card" data-i="${i}"><span class="hd-k">${'ABCD'[i]}</span><span>${esc(c)}</span></button>`).join('');
    this.on(this.cards);
  }
  pick(i) { this.cards.querySelectorAll('.hd-card').forEach((c, j) => { c.classList.toggle('picked', j === i); c.classList.toggle('dim', j !== i); }); }
  card(i) { return this.cards.querySelector(`.hd-card[data-i="${i}"]`); }
  hideCards() { this.on(this.cards, false); }
  pop(text, tone = 'good', at = null) {
    this.toast.className = 'hd-toast ' + tone;
    this.toast.innerHTML = `<span>${tone === 'bad' ? ICON.cross : ICON.check}</span><b>${esc(text)}</b>`;
    void this.toast.offsetWidth; this.toast.classList.add('on');
  }
  unpop() { this.on(this.toast, false); }
  ask(text) { this.prompt.querySelector('b').textContent = text; this.on(this.prompt); }
  unask() { this.on(this.prompt, false); }
  // the pointing finger
  point(target, { tap = false } = {}) {
    // aim at a card's letter badge so the hand never hides the words
    const aim = (target.querySelector && target.querySelector('.hd-k, .k')) || target;
    // measured in screen pixels; divide by the page zoom (big screens) to get the HUD's own pixels
    const r = this.root.getBoundingClientRect(), t = aim.getBoundingClientRect(), z = r.width / (this.root.offsetWidth || r.width) || 1;
    const x = (t.left - r.left + t.width * .5) / z, y = (t.top - r.top + t.height * .6) / z;
    this.finger.style.transform = `translate(${x}px, ${y}px)`;
    this.finger.classList.add('on');
    if (tap) this.tap();
  }
  tap() { this.finger.classList.remove('tap'); void this.finger.offsetWidth; this.finger.classList.add('tap'); }
  unpoint() { this.finger.classList.remove('on'); }
  celebrate(n = 3, text = '', { badge = '', xp = 0, style = 'rays' } = {}) {
    this.root.querySelectorAll('.hd-tag, .hd-vbox').forEach(e => e.classList.remove('on'));
    const stars = `<div class="hd-stars">${[0, 1, 2].map(i => `<span class="${i < n ? 'won' : ''}" style="--i:${i}">${ICON.star}</span>`).join('')}</div>`;
    const lots = style === 'confetti', bits = lots ? 40 : 22;
    let html = '';
    if (style === 'stamp') html = `<em class="hd-stamp">${esc(badge)}</em>` + (text ? `<p>${esc(text)}</p>` : '');
    else if (style === 'gate') html = stars + `<div class="hd-gate" style="top:3.1em"><b>${esc(badge)}</b><span><i></i></span></div>`;
    else html = (style === 'rays' ? '<span class="hd-rays"></span>' : '') + stars + (text ? `<p>${esc(text)}</p>` : '') + (badge ? `<em class="hd-badge">${ICON.check}${esc(badge)}</em>` : '');
    if (style !== 'stamp') html += Array.from({ length: bits }, (_, i) => `<i style="--a:${(i * (360 / bits) + (i % 3) * 7)}deg;--d:${55 + (i % 4) * (lots ? 30 : 20)}%;--c:${['#ffd23f', '#3be0c2', '#ff7a59', '#59c7fc', '#b48cff'][i % 5]}"></i>`).join('');
    this.burst.className = 'hd-burst' + (lots ? ' lots' : '');
    this.burst.innerHTML = html;
    void this.burst.offsetWidth; this.burst.classList.add('on');
    if (xp) {
      // a "+XP" chip flies from the burst to the XP counter
      const fly = document.createElement('span'); fly.className = 'hd-fly'; fly.textContent = `+${xp} XP`;
      this.root.appendChild(fly);
      const r = this.root.getBoundingClientRect(), b = this.burst.getBoundingClientRect(), x = this.stats.querySelector('.st-xp').getBoundingClientRect(), z = r.width / (this.root.offsetWidth || r.width) || 1;
      fly.style.setProperty('--from', `translate(${(b.left - r.left) / z}px, ${(b.top - r.top) / z + 40}px) scale(.8)`);
      fly.style.setProperty('--to', `translate(${(x.left - r.left + x.width / 2) / z}px, ${(x.top - r.top + x.height / 2) / z}px) scale(.9)`);
      fly.classList.add('go');
      setTimeout(() => fly.remove(), 1600);
    }
  }
  uncelebrate() { this.on(this.burst, false); }
  // meters: [{key,label,icon,value,good}]
  meters(list) {
    let m = this.panel.querySelector('.hd-meters');
    if (!m) { m = h('div', 'hd-meters'); this.panel.prepend(m); }
    m.innerHTML = list.map(x => `<div class="hd-meter" data-k="${x.key}"><span class="hd-mi">${ICON[x.icon] || ''}</span><span class="hd-ml">${esc(x.label)}</span><span class="hd-mb"><i style="width:0%"></i></span><b>0</b><span class="hd-trend"></span></div>`).join('');
    this.on(this.panel);
  }
  meter(key, value, trend = 0) {
    const m = this.panel.querySelector(`.hd-meter[data-k="${key}"]`);
    if (!m) return;
    m.querySelector('i').style.width = value + '%';
    m.classList.toggle('low', value < 50);
    this.countTo(m.querySelector('b'), value, .9);
    const tr = m.querySelector('.hd-trend');
    tr.innerHTML = trend > 0 ? ICON.up : trend < 0 ? ICON.down : '';
    tr.className = 'hd-trend ' + (trend > 0 ? 'up' : trend < 0 ? 'down' : '');
  }
  hidePanel() { this.on(this.panel, false); }
  slot(name, html) {
    let s = this.panel.querySelector(`[data-slot="${name}"]`);
    if (!s) { s = h('div', 'hd-slot'); s.dataset.slot = name; this.panel.append(s); }
    s.innerHTML = html; return s;
  }
  tick(t) {
    this.t = t;
    if (this.miniAt && t > this.miniAt) { this.mission.classList.add('mini'); this.miniAt = 0; }
    if (this.typer) {
      const n = Math.floor((t - this.typer.t0) * 70);
      this.typer.el.textContent = this.typer.text.slice(0, Math.max(0, n));
      if (n >= this.typer.text.length) this.typer = null;
    }
    this.counters = this.counters.filter(c => {
      const k = Math.min(1, (t - c.t0) / c.dur), e = 1 - Math.pow(1 - k, 3);
      c.el.textContent = Math.round(c.from + (c.to - c.from) * e);
      return k < 1;
    });
  }
  clear() {
    [this.mission, this.bubble, this.cards, this.panel, this.toast, this.prompt, this.burst].forEach(e => e.classList.remove('on'));
    this.unpoint(); this.typer = null; this.counters = []; this.miniAt = 0; this.mission.classList.remove('mini');
    this.root.querySelectorAll('.hd-fly').forEach(e => e.remove());
    this.panel.innerHTML = '';
    this.root.querySelectorAll('.hd-extra').forEach(e => e.remove());
  }
  extra(cls, html) { const e = h('div', 'hd-extra ' + cls, html); this.root.insertBefore(e, this.finger); return e; }
}

// A timeline of cues. Cues fire once per loop, in order. t comes from the view clock.
export class Trailer {
  constructor({ world, hud, length, cues, reset, onLoop, frame, poster }) {
    Object.assign(this, { world, hud, length, cues, reset, onLoop, frame, poster });
    this.i = 0; this.loopStart = 0; this.done = false;
  }
  start(t) { this.loopStart = t; this.i = 0; this.hud.clear(); this.reset && this.reset(); }
  update(t) {
    const lt = t - this.loopStart;
    this.hud.tick(t);
    while (this.i < this.cues.length && this.cues[this.i][0] <= lt) { this.cues[this.i][1](this.hud, this.world, t); this.i++; }
    if (this.frame) this.frame(t, this.hud, lt);
    if (lt >= this.length) { if (this.onLoop) this.onLoop(); else this.start(t); }
  }
  // Jump straight to a moment, used for reduced motion and posters.
  seek(lt, t = 0) {
    this.hud.root.classList.add('instant');
    this.hud.clear(); this.reset && this.reset();
    for (const [at, fn] of this.cues) if (at <= lt) fn(this.hud, this.world, t);
    this.hud.typer && (this.hud.typer.el.textContent = this.hud.typer.text, this.hud.typer = null);
    this.hud.counters.forEach(c => (c.el.textContent = c.to)); this.hud.counters = [];
    this.i = this.cues.length;
    if (this.frame) this.frame(t, this.hud, lt);
    requestAnimationFrame(() => requestAnimationFrame(() => this.hud.root.classList.remove('instant')));
  }
}
