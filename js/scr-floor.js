// Floor view: the factory as a simplified isometric plan, for someone seeing it for the first time.
// Three lines of testers, the cables from each collector to the server room, and the dashboards.
// Everything on it is live: status beacons, the unit on each tester, queues on a tester whose link
// is down, and the faults injected from the Demo menu. Click anything to open its screen.
(function (M) {
  const ui = M.ui, esc = ui.esc, sim = M.sim, st = M.stats, H = 3600000;

  // ---- Isometric projection: floor units x (to the right, back) and y (to the left, front) ----
  const SC = 20, C30 = 0.866;
  const P = (x, y, z = 0) => [(x - y) * C30 * SC, (x + y) * 0.5 * SC - z * SC];
  const pts = (a) => a.map((p) => P(...p).map((v) => v.toFixed(1)).join(',')).join(' ');
  const quad = (a, fill, cls = '') => `<polygon${cls ? ` class="${cls}"` : ''} points="${pts(a)}" fill="${fill}"/>`;

  // Visible faces from this viewpoint: top, front-left (y + d) and front-right (x + w).
  function box(x, y, z, w, d, h, c, attrs = '') {
    return `<g${attrs}>` +
      quad([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], c[1]) +
      quad([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], c[2]) +
      quad([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], c[0]) + '</g>';
  }

  const COL = {
    bench: ['#dde2e8', '#a9b2bc', '#bec6ce'], inst: ['#4b545f', '#2c323a', '#3a414a'],
    file: ['#a7b8ca', '#6c7e92', '#8193a6'], chamber: ['#d3cbbd', '#958b7c', '#aba190'],
    conv: ['#545d68', '#363c44', '#444b54'], wall: ['#3d444e', '#2b3038', '#333941'],
    rack: ['#323946', '#1b1f26', '#262c34'], desk: ['#7d8794', '#525b66', '#636d79'], pallet: ['#b08a55', '#7d6039', '#94744a'],
  };
  const STATE = { test: '#56b366', idle: '#5b8fd9', warn: '#e6b422', alarm: '#f2495c', off: '#6b7380' };

  // Where each tester stands. k is the kind of equipment: a vendor cabinet that drops files, a
  // chamber, or a bench with an instrument rack.
  const GEO = {
    A1: { x: 3, y: 4.5, w: 4, d: 3, h: 2.4, k: 'file' },
    A2: { x: 10, y: 4.5, w: 4, d: 3, h: 2.6, k: 'chamber' },
    A3: { x: 18, y: 2.2, w: 4, d: 3, h: 1.0, k: 'bench' },
    A4: { x: 18, y: 7.8, w: 4, d: 3, h: 1.0, k: 'bench' },
    B1: { x: 3, y: 12.5, w: 4, d: 3, h: 2.4, k: 'file' },
    B2: { x: 11, y: 12.3, w: 5, d: 3.4, h: 1.0, k: 'bench' },
    C1: { x: 3, y: 19.5, w: 4, d: 3, h: 1.0, k: 'bench' },
    C2: { x: 10, y: 19, w: 5, d: 4, h: 3.2, k: 'chamber' },
    C3: { x: 18, y: 19.5, w: 4, d: 3, h: 1.0, k: 'bench' },
  };
  const top = (g) => g.h + (g.k === 'bench' ? 1.2 : 0);           // bench instruments stand on the table
  const RACK = { x: 31, y: 4.4 };
  const LINES = [
    { prod: 'SN', y: 6, name: 'SENSOR NODE LINE', label: [3, 9.4] },
    { prod: 'PM', y: 14, name: 'POWER MODULE LINE', label: [3, 17.1] },
    { prod: 'IO', y: 21, name: 'I/O CONTROLLER LINE', label: [3, 24.2] },
  ];

  function equipment(id) {
    const g = GEO[id], { x, y, w, d, h } = g;
    let s = '';
    if (g.k === 'bench') {
      s += box(x, y, 0, w, d, h, COL.bench);
      s += box(x + 0.4, y + 0.3, h, w - 0.8, 1.2, 1.2, COL.inst);                 // instrument rack
      s += box(x + 1.2, y + 1.8, h, 1.6, 0.9, 0.12, ['#f0b35a', '#b07a2e', '#c98a37']);   // the unit in its fixture
    } else if (g.k === 'file') {
      s += box(x, y, 0, w, d, h, COL.file);
      s += quad([[x + 0.5, y + d, 1.1], [x + w - 0.5, y + d, 1.1], [x + w - 0.5, y + d, 2.0], [x + 0.5, y + d, 2.0]], '#1d2733');   // vendor screen
    } else {
      s += box(x, y, 0, w, d, h, COL.chamber);
      s += quad([[x + 0.4, y + d, 0.3], [x + w - 0.4, y + d, 0.3], [x + w - 0.4, y + d, h - 0.3], [x + 0.4, y + d, h - 0.3]], '#7f7668');   // door
      s += quad([[x + 1, y + d, 1.2], [x + w - 1, y + d, 1.2], [x + w - 1, y + d, h - 0.8], [x + 1, y + d, h - 0.8]], '#3a4250');       // window
    }
    // Beacon: a stack light on a pole at the back-right corner.
    const t = top(g), b0 = P(x + w - 0.4, y + 0.4, t), b1 = P(x + w - 0.4, y + 0.4, t + 1.3);
    s += `<line x1="${b0[0]}" y1="${b0[1]}" x2="${b1[0]}" y2="${b1[1]}" stroke="#9aa3ad" stroke-width="1.6"/>`;
    s += `<circle id="flB-${id}" class="beacon" cx="${b1[0]}" cy="${b1[1]}" r="5.5" fill="${STATE.idle}"/>`;
    s += `<g id="flQ-${id}"></g>`;
    return `<g class="stn" data-go="yield" data-st="${id}">${s}</g>`;
  }

  // Each collector's cable runs under the floor to a duct at x = 25, then into the server room.
  function cable(id, i) {
    const g = GEO[id], yy = g.y + g.d / 2 + (i % 3 - 1) * 0.25, xd = 25 + (i % 3) * 0.3;
    const p = [[g.x + g.w, yy], [xd, yy], [xd, RACK.y + 0.6 + i * 0.12], [RACK.x, RACK.y + 0.6 + i * 0.12]].map((q) => P(q[0], q[1], 0.02).map((v) => v.toFixed(1)).join(',')).join(' ');
    return `<polyline id="flC-${id}" class="cab" points="${p}"/>`;
  }

  function conveyors() {
    const c = COL.conv, z = 0, h = 0.55;
    return box(0.5, 5.7, z, 2.5, 0.6, h, c) + box(7, 5.7, z, 3, 0.6, h, c) + box(14, 5.7, z, 3.2, 0.6, h, c) + box(17.2, 3.6, z, 0.6, 5.6, h, c) +
      box(0.5, 13.7, z, 2.5, 0.6, h, c) + box(7, 13.7, z, 4, 0.6, h, c) +
      box(0.5, 20.7, z, 2.5, 0.6, h, c) + box(7, 20.7, z, 3, 0.6, h, c) + box(15, 20.7, z, 3, 0.6, h, c);
  }

  // Units travelling along each line. Decorative, but paced to the line's real rate.
  function parcels() {
    const par = box(-0.3, -0.3, 0.55, 0.6, 0.6, 0.35, ['#f0b35a', '#b07a2e', '#c98a37']);
    const path = (y, x1) => { const a = P(1, y), b = P(x1, y); return `M${a[0]},${a[1]} L${b[0]},${b[1]}`; };
    const run = (y, x1, dur, n) => Array.from({ length: n }, (_, i) =>
      `<g>${par}<animateMotion dur="${dur}s" repeatCount="indefinite" begin="-${(dur * i / n).toFixed(1)}s" path="${path(y, x1)}"/></g>`).join('');
    return `<g id="flParcels">${run(6, 17.4, 14, 4)}${run(14, 11, 16, 2)}${run(21, 18, 40, 1)}</g>`;
  }

  function serverRoom() {
    let s = '';
    s += quad([[28, 2, 0], [38, 2, 0], [38, 11, 0], [28, 11, 0]], '#1c2027');
    s += box(28, 1.8, 0, 10, 0.2, 2.6, COL.wall) + box(27.8, 2, 0, 0.2, 9, 2.6, COL.wall);
    let leds = '';
    [0, 1.7, 3.4].forEach((dx, r) => {
      s += box(RACK.x + dx, RACK.y, 0, 1.4, 1.2, 4, COL.rack);
      for (let k = 0; k < 6; k++) {
        const p = P(RACK.x + dx + 0.25, RACK.y + 1.2, 0.6 + k * 0.55);
        leds += `<circle class="led l${(k + r) % 3}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.6"/>`;
      }
    });
    s += leds;
    s += `<g class="glass">${quad([[28, 11, 0], [38, 11, 0], [38, 11, 2.6], [28, 11, 2.6]], 'rgba(130,170,210,.07)')}${quad([[38, 2, 0], [38, 11, 0], [38, 11, 2.6], [38, 2, 2.6]], 'rgba(130,170,210,.05)')}</g>`;
    return `<g data-go="pipeline">${s}</g>`;
  }

  function office() {
    let s = quad([[28, 15, 0], [38, 15, 0], [38, 24, 0], [28, 24, 0]], '#1f242b');
    s += box(29, 16, 0, 0.3, 0.3, 0.9, COL.wall) + box(36.7, 16, 0, 0.3, 0.3, 0.9, COL.wall);
    s += box(29, 16, 0.9, 8, 0.25, 3.2, ['#20262e', '#0f1318', '#171b21']);          // screen wall
    s += `<g id="flScreens"></g>`;
    s += box(30, 19.5, 0, 6, 1.6, 0.9, COL.desk);
    [31, 33, 35].forEach((x) => { s += box(x, 19.8, 0.9, 0.9, 0.12, 0.6, ['#1d2733', '#0f141a', '#171c22']); });
    return `<g data-go="export">${s}</g>`;
  }

  // A screen on the wall is drawn on the wall's front face: u along x, v up.
  const F = (x0, u, v) => P(x0 + u, 16.25, 1.1 + v);
  function screens() {
    const now = sim.now, runs = [];
    M.STATIONS.forEach((s) => st.window(s.id, now - 12 * H, now).forEach((r) => runs.push(r)));
    const ser = st.series(runs, now - 12 * H, now, H);
    const line = (vals, x0, lo, hi, col) => {
      const p = vals.map((v, i) => (v == null ? null : F(x0, 0.2 + 2.1 * i / Math.max(1, vals.length - 1), 0.3 + 2.2 * Math.max(0, Math.min(1, (v - lo) / (hi - lo))))));
      return `<polyline points="${p.filter(Boolean).map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="1.4"/>`;
    };
    const bars = (vals, x0, col) => { const mx = Math.max(1, ...vals); return vals.map((v, i) => quad([[x0 + 0.25 + i * 0.32, 16.25, 1.4], [x0 + 0.47 + i * 0.32, 16.25, 1.4], [x0 + 0.47 + i * 0.32, 16.25, 1.4 + 2 * v / mx], [x0 + 0.25 + i * 0.32, 16.25, 1.4 + 2 * v / mx]], col)).join(''); };
    const par = st.pareto(runs).slice(0, 6).map((p) => p.n);
    const thr = ser.map((b) => b.n);
    return line(ser.map((b) => (b.n > 3 ? b.final : null)), 29.2, 0.85, 1, '#8ab8ff') + line(ser.map((b) => (b.n > 3 ? b.fpy : null)), 29.2, 0.85, 1, '#56b366') +
      bars(thr.slice(-7), 31.9, '#5794f2') + bars(par, 34.6, '#b877d9');
  }

  // Floor markings and painted labels, as on a real shop floor.
  function painted(text, x, y, size = 13, col = '#7d8794') {
    const p = P(x, y);
    return `<text class="paint" transform="matrix(${C30} 0.5 ${-C30} 0.5 ${p[0].toFixed(1)} ${p[1].toFixed(1)})" font-size="${size}" fill="${col}">${text}</text>`;
  }
  const zone = (x, y, w, d) => `<polygon class="zone" points="${pts([[x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0]])}"/>`;

  function labelSlot(id) {
    const g = GEO[id], b = P(g.x + g.w - 0.4, g.y + 0.4, top(g) + 1.3);
    return `<g class="lbl" data-go="yield" data-st="${id}" transform="translate(${(b[0] + 9).toFixed(1)},${(b[1] - 30).toFixed(1)})">
      <rect id="flLr-${id}" width="196" height="34" rx="3"/><text x="7" y="13" class="l1" id="flL1-${id}"></text><text x="7" y="27" class="l2" id="flL2-${id}"></text></g>`;
  }
  function tag(id, x, y, z, w, go, st0) {
    const p = P(x, y, z);
    return `<g class="lbl" data-go="${go}"${st0 ? ` data-st="${st0}"` : ''} transform="translate(${(p[0] - w / 2).toFixed(1)},${(p[1] - 34).toFixed(1)})"><rect id="${id}r" width="${w}" height="34" rx="3"/><text x="7" y="13" class="l1" id="${id}1"></text><text x="7" y="27" class="l2" id="${id}2"></text></g>`;
  }

  function lot(id, x, y, st0) {
    const p = P(x, y, 0.5);
    return `<g class="lbl lot" data-go="meas" data-st="${st0}" transform="translate(${(p[0] - 150).toFixed(1)},${(p[1] - 26).toFixed(1)})"><rect id="${id}r" width="168" height="19" rx="3"/><text x="6" y="13" class="l2" id="${id}2"></text></g>`;
  }

  function scene() {
    let s = '';
    s += quad([[0, 0, 0], [40, 0, 0], [40, 26, 0], [0, 26, 0]], '#23282f', 'slab');
    for (let i = 2; i < 40; i += 2) s += `<line class="grid" x1="${P(i, 0)[0]}" y1="${P(i, 0)[1]}" x2="${P(i, 26)[0]}" y2="${P(i, 26)[1]}"/>`;
    for (let j = 2; j < 26; j += 2) s += `<line class="grid" x1="${P(0, j)[0]}" y1="${P(0, j)[1]}" x2="${P(40, j)[0]}" y2="${P(40, j)[1]}"/>`;
    s += box(0, -0.3, 0, 40, 0.3, 2.8, COL.wall) + box(-0.3, 0, 0, 0.3, 26, 2.8, COL.wall);
    s += zone(0.3, 1.6, 23.6, 9.6) + zone(0.3, 11.6, 23.6, 5.8) + zone(0.3, 18.3, 23.6, 5.9);
    s += painted('SERVER ROOM', 28.4, 10.3, 11) + painted('ENGINEERING OFFICE', 28.4, 23.4, 11) + painted('GOODS IN', 0.5, 25.2, 10);
    M.STATIONS.forEach((x, i) => { s += cable(x.id, i); });
    s += conveyors() + parcels();
    // Pallets of components at the start of each line, with their lot.
    [6, 14, 21].forEach((y, i) => { s += box(0.4, y - 1.6, 0, 1.4, 1.2, 0.5, COL.pallet, ` data-go="meas" data-st="${['A1', 'B2', 'C1'][i]}"`); });
    s += serverRoom();
    const order = Object.keys(GEO).sort((a, b) => (GEO[a].x + GEO[a].w / 2 + GEO[a].y + GEO[a].d / 2) - (GEO[b].x + GEO[b].w / 2 + GEO[b].y + GEO[b].d / 2));
    order.forEach((id) => { s += equipment(id); });
    s += office();
    s += `<g id="flSel"></g>`;
    // Labels last, so nothing draws over them.
    order.forEach((id) => { s += labelSlot(id); });
    s += lot('flLotSN', 1.1, 4.4, 'A1') + lot('flLotPM', 1.1, 12.4, 'B2') + lot('flLotIO', 1.1, 19.4, 'C1');
    s += tag('flStore', 33, 4.4, 4.3, 196, 'pipeline') + tag('flDash', 33, 16, 4.4, 196, 'export');
    return s;
  }

  function dayStart() { const d = new Date(sim.now); if (d.getHours() < 6) d.setDate(d.getDate() - 1); d.setHours(6, 0, 0, 0); return d.getTime(); }

  M.screens.floor = {
    mount(root) {
      root.innerHTML = `<div class="toolbar"><span class="ttl">Floor view</span><span class="muted" id="flSum"></span><span class="sp"></span>
          <span class="fl-key">${[['test', 'testing'], ['idle', 'idle'], ['warn', 'warning'], ['alarm', 'alarm'], ['off', 'link down']].map(([k, l]) => `<span><i class="dot ${k}"></i>${l}</span>`).join('')}
          <span><i class="cabkey"></i>result flowing to the store</span></span></div>
        <div class="pn fl-wrap" id="flWrap"><svg class="fl" id="flSvg" viewBox="-500 -110 1240 800" preserveAspectRatio="xMidYMid meet">${scene()}</svg>
          <div class="fl-note">A simplified plan of an invented factory, not to scale. Click a tester for its yield, the server room for the data pipeline, the office for BI exports.</div></div>`;
      root.querySelectorAll('[data-go]').forEach((el) => (el.onclick = (e) => { e.stopPropagation(); ui.go(el.dataset.go, el.dataset.st || null); }));
    },
    update(root) {
      const now = sim.now, t0 = dayStart(), $ = (id) => root.querySelector('#' + id);
      let online = 0, queued = 0;
      M.STATIONS.forEach((s) => {
        const id = s.id, state = ui.stState(id), c = sim.coll[id], q = c.queue.length;
        if (c.online) online++;
        queued += q;
        $('flB-' + id).setAttribute('fill', STATE[state]);
        $('flB-' + id).classList.toggle('blink', state === 'alarm');
        const cab = $('flC-' + id);
        cab.classList.toggle('off', !c.online);
        // Queued results pile up beside a tester whose link is down.
        const g = GEO[id], n = Math.min(6, Math.ceil(q / 15));
        let qs = '';
        for (let k = 0; k < n; k++) qs += box(g.x + g.w + 0.3, g.y + g.d - 1.1, k * 0.45, 0.9, 0.9, 0.4, ['#e6b422', '#9c7a12', '#b88f17']);
        $('flQ-' + id).innerHTML = qs;

        const sf = st.fpy(st.window(id, t0, now)), cur = ui.current(id), al = ui.activeAlerts(id)[0];
        const dep = sim.deployed[id];
        let l2, cls = '';
        if (!c.online) { l2 = `Link down · ${q} results held here`; cls = 'warn'; }
        else if (al) {
          l2 = '⚠ ' + (al.key.startsWith('ver:') ? `unreleased build ${dep.ver}` :
            al.text.replace(id + ' ', '').replace(/ — .*$/, '').replace(/: Cpk (\S+) over the last 60 units/, ' Cpk $1 ↓').replace(/, against .*$/, '').replace(/ since .*$/, ''));
          cls = al.sev === 'R' ? 'bad' : 'warn';
        }
        else if (dep.ver !== s.rel) { l2 = `⚠ running ${dep.ver}`; cls = 'bad'; }
        else l2 = (cur ? `▶ ${cur.u.sn}` : 'waiting for a unit') + ` · FPY ${ui.pct(sf && sf.fpy)}`;
        if (l2.length > 34) l2 = l2.slice(0, 33) + '…';
        $('flL1-' + id).innerHTML = `${id} · ${esc(s.name)}<tspan class="src" dx="6">${M.SRC[s.src]}</tspan>`;
        const t2 = $('flL2-' + id); t2.textContent = l2; t2.setAttribute('class', 'l2 ' + cls);
        $('flLr-' + id).setAttribute('class', (ui.state.st === id ? 'sel ' : '') + cls);
      });
      // Lots on the pallets at the start of each line.
      [['SN', 'flLotSN'], ['PM', 'flLotPM'], ['IO', 'flLotIO']].forEach(([p, idp]) => {
        const lots = M.prodById[p].lots, lot = p === 'PM' && sim.fault.lot ? 'L-2619' : lots[lots.length - 1];
        const t = $(idp + '2'); t.textContent = `${M.prodById[p].short} line · lot ${lot}`; t.setAttribute('class', 'l2 ' + (lot === 'L-2619' ? 'warn' : ''));
        $(idp + 'r').setAttribute('class', lot === 'L-2619' ? 'warn' : '');
      });
      const stored = M.STATIONS.reduce((a, s) => a + sim.byStation[s.id].length, 0);
      $('flStore1').textContent = 'Central store · PostgreSQL + TimescaleDB';
      const ts = $('flStore2'); ts.textContent = `${ui.n(stored)} results · ${queued ? queued + ' still on testers' : 'all testers synced'}`; ts.setAttribute('class', 'l2 ' + (queued ? 'warn' : ''));
      $('flStorer').setAttribute('class', queued ? 'warn' : '');
      const all = []; M.STATIONS.forEach((s) => st.window(s.id, t0, now).forEach((r) => all.push(r)));
      const f = st.fpy(all);
      $('flDash1').textContent = 'Dashboards · Grafana · Power BI';
      $('flDash2').textContent = `today: first-pass ${ui.pct(f && f.fpy)} · final ${ui.pct(f && f.final)}`;
      $('flScreens').innerHTML = screens();
      root.querySelector('#flParcels').style.display = M.shiftFactor(new Date(now)) ? '' : 'none';
      $('flSum').textContent = `— ${M.STATIONS.length} testers on 3 lines · ${online}/${M.STATIONS.length} collectors online · ${M.shiftFactor(new Date(now)) ? 'shift running' : 'between shifts — burn-in still running'}`;
    },
  };
})(globalThis.M = globalThis.M || {});
