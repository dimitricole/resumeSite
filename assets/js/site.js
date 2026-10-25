// The run: scrolling moves each section from queued to running to done. The rail, the bar,
// the hero graph and the phone spine all paint the same states.
(() => {
  const $ = (id) => document.getElementById(id);
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const spineMQ = matchMedia('(max-width: 859px)'); // keep in step with site.css
  const sections = [...document.querySelectorAll('main section[data-step]')];
  const names = sections.map((s, k) => k ? s.querySelector('.kicker span:last-child').textContent : 'Start');
  const railSteps = [...document.querySelectorAll('.step')];
  const barSteps = [...document.querySelectorAll('.bar-segs li')];
  const secMarks = [...document.querySelectorAll('[data-sec]')];
  const stepsEl = $('steps');
  const fillDone = stepsEl.querySelector('.fill-done');
  const fillLive = stepsEl.querySelector('.fill-live');
  const track = stepsEl.querySelector('.track');
  const last = sections.length - 1;

  const fmt = (ms) => {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  /* ---- Scroll drives the run. A visited step stays done. ---- */
  const spent = sections.map(() => 0);
  const visited = sections.map((_, i) => i === 0);
  let active = 0, frac = 0;
  const t0 = performance.now();
  let tPrev = t0;

  function measure() {
    const line = innerHeight * 0.4;
    let i = 0;
    sections.forEach((s, k) => { if (s.getBoundingClientRect().top <= line) i = k; });
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    if (atEnd) i = last;
    const r = sections[i].getBoundingClientRect();
    frac = i === last || atEnd ? 1 : Math.min(1, Math.max(0, (line - r.top) / r.height));
    // a jump counts every step above the landing point as done; their timers keep only the time really spent
    if (i !== active) { active = i; for (let k = 0; k <= i; k++) visited[k] = true; paintStates(); }
    paintFill();
  }

  const stateOf = (k) => k === active ? 'running' : visited[k] ? 'done' : 'queued';
  const setCurrent = (a, on) => on ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current');

  function paintStates() {
    railSteps.forEach((li, k) => {
      li.dataset.state = stateOf(k);
      li.querySelector('.st').textContent = stateOf(k);
      setCurrent(li.querySelector('a'), k === active);
    });
    barSteps.forEach((li, k) => {
      li.dataset.state = stateOf(k);
      setCurrent(li.querySelector('a'), k === active);
    });
    $('barState').dataset.state = stateOf(active);
    $('barNow').textContent = names[active];
    $('barSt').textContent = stateOf(active);
    $('railCount').textContent = (active + 1) + ' of ' + sections.length;
    secMarks.forEach(el => { el.dataset.state = stateOf(+el.dataset.sec); });
    paintGraph();
    buildSpine();
    paintTimes();
  }

  let nodeY = [];
  function layoutRail() {
    const box = stepsEl.getBoundingClientRect();
    nodeY = railSteps.map(li => {
      const r = li.querySelector('.node').getBoundingClientRect();
      return r.top + r.height / 2 - box.top;
    });
    if (!box.height) return;
    const h = (nodeY[last] - nodeY[0]) + 'px';
    track.style.top = fillDone.style.top = fillLive.style.top = nodeY[0] + 'px';
    track.style.height = fillDone.style.height = fillLive.style.height = h;
    paintFill();
  }
  function paintFill() {
    if (nodeY.length) {
      const full = nodeY[last] - nodeY[0] || 1;
      const doneTo = nodeY[visited.lastIndexOf(true)] - nodeY[0];
      const at = nodeY[active] - nodeY[0];
      const liveTo = active === last ? at : at + frac * (nodeY[active + 1] - nodeY[active]);
      fillDone.style.transform = 'scaleY(' + (doneTo / full) + ')';
      fillLive.style.transform = 'translateY(' + at + 'px) scaleY(' + ((liveTo - at) / full) + ')';
    }
    barSteps.forEach((li, k) => {
      const v = k === active ? (k === last ? 1 : Math.max(frac, 0.04)) : visited[k] ? 1 : 0;
      li.querySelector('.seg i').style.transform = 'scaleX(' + v + ')';
    });
  }

  function paintTimes() {
    railSteps.forEach((li, k) => { li.querySelector('.t').textContent = visited[k] ? fmt(spent[k]) : ''; });
    const total = fmt(performance.now() - t0);
    $('railClock').textContent = total;
    $('barClock').textContent = total;
  }
  function tick() {
    const now = performance.now();
    if (!document.hidden) spent[active] += now - tPrev;
    tPrev = now;
    paintTimes();
  }

  /* ---- The hero graph: the same steps, with pulses travelling its edges ---- */
  const NS = 'http://www.w3.org/2000/svg';
  const graph = $('graph');
  const svg = graph.querySelector('.edges');
  const gnodes = [...graph.querySelectorAll('[data-node]')];
  const N = (id) => graph.querySelector('[data-node="' + id + '"]');
  const STEP = {};
  gnodes.forEach(n => { STEP[n.dataset.node] = +n.dataset.step; });
  const PARENT = { sg: 'root', experience: 'root', ovenlight: 'sg', apps: 'sg', aws: 'experience', ripple: 'experience', writing: 'experience' };
  const LEAVES = ['ovenlight', 'apps', 'aws', 'ripple', 'writing'];
  const EDGES = Object.entries(PARENT).map(([b, a]) => [a, b]).concat(LEAVES.map(l => [l, 'contact']));
  const SPEED = 150, TAIL = 26, GAP = 0.12, REST = 1.8;
  let edges = [], starts = [0, 0, 0], cycle = 1;

  const mk = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  function box(id) {
    const el = id === 'root' ? N('root').querySelector('.portrait') : N(id);
    const g = graph.getBoundingClientRect(), r = el.getBoundingClientRect();
    const l = r.left - g.left, t = r.top - g.top;
    return { l, r: l + r.width, cy: t + r.height / 2 };
  }
  function pathFor(a, b) {
    const A = box(a), B = box(b);
    const x1 = a === 'root' ? A.r + 10 : A.r, y1 = A.cy, x2 = B.l, y2 = B.cy;
    const xm = (x1 + x2) / 2, dy = y2 - y1;
    if (Math.abs(dy) < 1) return `M${x1},${y1} H${x2}`;
    const s = Math.sign(dy), r = Math.min(10, Math.abs(dy) / 2, (x2 - x1) / 4);
    return `M${x1},${y1} H${xm - r} Q${xm},${y1} ${xm},${y1 + s * r} V${y2 - s * r} Q${xm},${y2} ${xm + r},${y2} H${x2}`;
  }
  const pulse = (parent, d) => {
    const g = mk('g', {}), base = mk('path', { d, class: 'edge' }), tail = mk('path', { d, class: 'tail' }), head = mk('circle', { r: 2.6, class: 'head' });
    tail.style.opacity = head.style.opacity = 0; // hidden until placed
    g.append(base, tail, head);
    parent.append(g);
    return { g, base, tail, head, len: base.getTotalLength() };
  };

  function build() {
    svg.textContent = '';
    if (!graph.offsetWidth) { edges = []; return; }
    edges = EDGES.map(([a, b]) => Object.assign(pulse(svg, pathFor(a, b)), { a, b, depth: a === 'root' ? 0 : b === 'contact' ? 2 : 1 }));
    // a wave: every edge at one depth leaves together, the next depth leaves when the last pulse lands
    const maxd = [0, 0, 0];
    edges.forEach(e => { maxd[e.depth] = Math.max(maxd[e.depth], e.len / SPEED); });
    let t = 0;
    starts = maxd.map(m => { const s = t; if (m) t += m + GAP; return s; });
    cycle = t + REST;
    paintEdges();
    draw();
  }

  // an edge carries work only once its source has run
  const kindOf = (from, to) => stateOf(from) === 'queued' ? '' : stateOf(to) === 'running' ? 'live' : stateOf(to) === 'done' ? 'done' : '';
  function paintEdges() {
    const rank = { '': 0, done: 1, live: 2 };
    edges.forEach(e => {
      e.kind = kindOf(STEP[e.a], STEP[e.b]);
      e.base.setAttribute('class', 'edge ' + e.kind + (e.hot ? ' hot' : ''));
      e.g.setAttribute('class', e.kind);
    });
    // live edges draw last, so a shared trunk shows the path to what is running
    edges.slice().sort((x, y) => rank[x.kind] - rank[y.kind]).forEach(e => svg.append(e.g));
  }
  function paintGraph() {
    gnodes.forEach(n => {
      const s = stateOf(STEP[n.dataset.node]);
      n.dataset.state = s;
      n.querySelectorAll('.state').forEach(el => { el.textContent = s; });
    });
    if (edges.length) { paintEdges(); if (reduceMQ.matches) draw(); }
  }

  function place(e, pos) {
    if (pos <= 0 || pos >= e.len + TAIL) { e.head.style.opacity = e.tail.style.opacity = 0; return; }
    const p = e.base.getPointAtLength(Math.min(e.len, pos));
    const fade = Math.max(0, Math.min(1, pos / 14, (e.len - pos) / 14 + 0.0001));
    const k = e.kind === 'live' ? 1 : 0.7;
    e.head.setAttribute('cx', p.x);
    e.head.setAttribute('cy', p.y);
    e.tail.style.strokeDasharray = `${Math.min(TAIL, pos)} ${e.len + TAIL}`;
    e.tail.style.strokeDashoffset = -Math.max(0, pos - TAIL);
    e.head.style.opacity = fade * k;
    e.tail.style.opacity = fade * k * 0.55;
  }

  let clock = 0;
  function draw() {
    drawSpine();
    for (const e of edges) {
      // reduced motion: one still pulse sits on each live edge
      if (reduceMQ.matches) place(e, e.kind === 'live' ? e.len * 0.6 : -1);
      else place(e, ((clock % cycle) - starts[e.depth]) * SPEED);
    }
  }

  let lastT = 0, raf = 0, graphVisible = true;
  function frame(now) {
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    clock += dt;
    draw();
    raf = requestAnimationFrame(frame);
  }
  function run() {
    cancelAnimationFrame(raf);
    lastT = 0;
    const moving = edges.length ? graphVisible : !!spine;
    if (!reduceMQ.matches && moving && !document.hidden) raf = requestAnimationFrame(frame);
    else draw();
  }

  // hovering or focusing a node traces its path back to the portrait
  function heat(id, on) {
    const path = new Set();
    for (let n = id; n && n !== 'root'; n = PARENT[n]) path.add(n);
    edges.forEach(e => {
      e.hot = on && path.has(e.b);
      e.base.classList.toggle('hot', e.hot);
    });
  }
  graph.querySelectorAll('a.gn').forEach(n => {
    for (const [ev, on] of [['mouseenter', true], ['mouseleave', false], ['focus', true], ['blur', false]])
      n.addEventListener(ev, () => heat(n.dataset.node, on));
  });

  /* ---- Phones: one spine from the portrait through every section, items branching off it ---- */
  const mainEl = document.querySelector('main');
  const spineSvg = mainEl.querySelector('.spine');
  const BRANCH = '.sg-lead, .apps-grid .tile, .job, .contact-card';
  let spine = null;

  function buildSpine() {
    spineSvg.textContent = '';
    spine = null;
    if (!spineMQ.matches) return;
    const M = mainEl.getBoundingClientRect();
    const rel = (el) => {
      const r = el.getBoundingClientRect();
      return { l: r.left - M.left, b: r.bottom - M.top, cx: r.left - M.left + r.width / 2, cy: r.top - M.top + r.height / 2 };
    };
    const gx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gx')) || 15;
    const R = 10;
    spineSvg.setAttribute('height', mainEl.offsetHeight);
    const P = rel(document.querySelector('.mroot .photo'));
    const yN = sections.map((sec, k) => k ? rel(sec.querySelector('.kicker > .node')).cy : 0);
    // only the first item in each row branches off the spine, so no elbow crosses a neighbour
    const items = sections.map(sec => [...sec.querySelectorAll(BRANCH)]
      .filter((el, _, all) => !all.some(o => o !== el && Math.abs(o.offsetTop - el.offsetTop) < 2 && rel(o).l < rel(el).l))
      .map(el => ({ x: rel(el).l - (el.classList.contains('job') ? 8 : 0), y: rel(el.querySelector('.appicon, .yr, h2') || el).cy })));
    const lastItems = items[last];
    const yEnd = (lastItems.length ? lastItems[lastItems.length - 1].y : yN[last]) - R;
    const ye = P.b + 12;
    const head0 = `M${P.cx},${P.b} V${ye - R} Q${P.cx},${ye} ${P.cx - R},${ye} H${gx + R} Q${gx},${ye} ${gx},${ye + R}`;
    // trunk segments: segment k leads into section k + 1; the last one runs through Contact
    for (let k = 0; k <= last; k++) {
      const d = k === 0 ? head0 + ` V${yN[1]}` : `M${gx},${yN[k]} V${k === last ? yEnd : yN[k + 1]}`;
      spineSvg.append(mk('path', { d, class: 'edge ' + (k === last ? kindOf(last, last) : kindOf(k, k + 1)) }));
    }
    const elbows = items.map((list, k) => list.map(it => {
      const e = pulse(spineSvg, `M${gx},${it.y - R} Q${gx},${it.y} ${gx + R},${it.y} H${it.x}`);
      e.kind = kindOf(k, k);
      e.g.setAttribute('class', e.kind);
      e.base.setAttribute('class', 'edge ' + e.kind);
      return e;
    }));
    // the pulse runs down the spine to the running section, then out along its branches
    const target = Math.max(active, 1);
    const trk = pulse(spineSvg, head0 + ` V${yN[target]}`);
    trk.kind = stateOf(target) === 'running' ? 'live' : '';
    trk.g.setAttribute('class', trk.kind);
    trk.base.style.stroke = 'none';
    const spd = Math.max(SPEED, trk.len / 1.6);
    spine = { trk, spd, out: active ? elbows[active] : [], tOut: trk.len / spd + GAP };
    spine.cycle = spine.tOut + 0.4 + REST;
    drawSpine();
  }
  function drawSpine() {
    if (!spine) return;
    if (reduceMQ.matches) { place(spine.trk, -1); spine.out.forEach(e => place(e, -1)); return; }
    const t = clock % spine.cycle;
    place(spine.trk, t * spine.spd);
    spine.out.forEach(e => place(e, (t - spine.tOut) * SPEED));
  }

  /* ---- Wiring ---- */
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; measure(); });
  }, { passive: true });
  addEventListener('resize', () => { layoutRail(); measure(); });
  document.addEventListener('visibilitychange', () => { tPrev = performance.now(); run(); });
  new ResizeObserver(() => { build(); run(); }).observe(graph);
  new ResizeObserver(() => buildSpine()).observe(mainEl);
  new IntersectionObserver(([e]) => { graphVisible = e.isIntersecting; run(); }).observe(graph);
  spineMQ.addEventListener('change', () => { buildSpine(); run(); });
  reduceMQ.addEventListener('change', () => { paintEdges(); run(); });

  const relayout = () => { layoutRail(); measure(); build(); buildSpine(); run(); };
  relayout();
  paintStates();
  setInterval(tick, 250);
  if (document.fonts) document.fonts.ready.then(relayout);
})();
