// Factory live: every station at once, the day's yield told honestly, and the event feed.
(function (M) {
  const ui = M.ui, esc = ui.esc, st = M.stats, sim = M.sim, H = 3600000;

  function dayStart() { const d = new Date(sim.now); if (d.getHours() < 6) d.setDate(d.getDate() - 1); d.setHours(6, 0, 0, 0); return d.getTime(); }

  M.screens.live = {
    mount(root) {
      root.innerHTML = `<div class="toolbar"><span class="ttl">Factory live</span><span class="muted" id="lvScope"></span><span class="sp"></span><span class="muted">Since 06:00 · updates as results arrive</span></div>
        <div class="dash" id="lvStats"></div>
        <div class="cards" id="lvCards" style="margin:8px 0"></div>
        <div class="dash">
          ${ui.panel('c8', 'Units started per hour', '<canvas id="lvTp" style="height:200px"></canvas>', { sub: 'last 24 h · <span style="color:#5794f2">━</span> sensor node · <span style="color:#b877d9">━</span> power module · <span style="color:#56b366">━</span> I/O controller' })}
          ${ui.panel('c4', 'Event log', '<div class="feed" id="lvFeed"></div>', { sub: 'alerts, recoveries, demo actions' })}
        </div>`;
    },
    update(root) {
      const t0 = dayStart(), now = sim.now;
      const sts = ui.scope();
      const prods = [...new Set(sts.map((s) => s.prod))];
      root.querySelector('#lvScope').textContent = ui.state.st ? `— ${ui.state.st} only. Choose “Whole factory” in the rail for every line.` : '— every line';

      // Headline figures. True first-pass vs reported final yield is the point of the whole demo.
      const runs = []; sts.forEach((s) => st.window(s.id, t0, now).forEach((r) => runs.push(r)));
      const f = st.fpy(runs);
      const started = prods.reduce((a, p) => a + st.window(M.prodById[p].route[0], t0, now).filter((r) => r.att === 1 && !r.rep).length, 0);
      const rtyP = ui.state.st ? M.stById[ui.state.st].prod : 'SN';
      const rty = st.rty(rtyP, t0, now);
      const online = M.STATIONS.filter((s) => sim.coll[s.id].online).length;
      const gap = f && f.final != null ? f.final - f.fpy : null;
      root.querySelector('#lvStats').innerHTML =
        ui.stat('c2', 'Units started today', ui.n(started), 'blue', prods.map((p) => M.prodById[p].short).join(' · ')) +
        ui.stat('c2', 'True first-pass yield', ui.pct(f && f.fpy), f && f.fpy < 0.95 ? 'warn' : 'ok', 'first attempts only') +
        ui.stat('c2', 'Reported final yield', ui.pct(f && f.final), '', gap != null ? `hides ${ui.pct(gap)} of retests` : '') +
        ui.stat('c2', `Rolled throughput yield`, ui.pct(rty), rty != null && rty < 0.92 ? 'warn' : 'ok', `${esc(M.prodById[rtyP].short)}, whole route`) +
        ui.stat('c2', 'Retests today', ui.n(f ? f.runs - f.n : 0), '', f ? `${ui.pct(f.nff, 0)} passed with no repair` : '') +
        ui.stat('c2', 'Collectors online', `${online}/${M.STATIONS.length}`, online < M.STATIONS.length ? 'warn' : 'ok', online < M.STATIONS.length ? 'results queued on the tester' : 'all results reaching the store');

      // Station cards.
      root.querySelector('#lvCards').innerHTML = M.STATIONS.map((s) => {
        const state = ui.stState(s.id);
        const rs = st.window(s.id, t0, now), sf = st.fpy(rs);
        const lastH = st.window(s.id, now - H, now).filter((r) => r.att === 1 && !r.rep).length;
        const cur = ui.current(s.id);
        const q = sim.coll[s.id].queue.length;
        const al = ui.activeAlerts(s.id)[0];
        const curTxt = cur ? `▶ ${cur.u.sn} · ${ui.dur((cur.t - now) / 1000)} left${cur.u.tries ? ' · retest' : ''}` : '<span class="dim">waiting for a unit</span>';
        return `<div class="card ${state}${ui.state.st === s.id ? ' sel' : ''}" data-st="${s.id}">
          <div class="t1"><span>${s.id} · ${esc(s.name)}</span><span class="sp"></span>${ui.srcBadge(s.src)}</div>
          <div class="t2">${esc(M.prodById[s.prod].short)} · ${esc(s.long)} · <b>${ui.STATE_TXT[state]}</b></div>
          <div class="kv"><span>Units in the last hour</span><span class="num">${s.prod === 'IO' && s.id === 'C2' ? sim.pending.C2.length + ' in chamber' : lastH}</span>
            <span>First-pass yield today</span><span class="num">${ui.pct(sf && sf.fpy)}</span>
            <span>Retests today</span><span class="num">${sf ? sf.runs - sf.n : 0}</span>
            <span>Collector queue</span><span class="num" ${q ? 'style="color:var(--warn)"' : ''}>${q ? q + ' held' : 'synced'}</span></div>
          <div class="now">${al ? `<span class="${al.sev === 'R' ? 'fail' : ''}" style="${al.sev === 'R' ? '' : 'color:var(--warn)'}">⚠ ${esc(al.text.replace(s.id + ' ', ''))}</span>` : curTxt}</div>
          <canvas data-spark="${s.id}"></canvas></div>`;
      }).join('');
      root.querySelectorAll('#lvCards .card').forEach((c) => (c.onclick = () => ui.go('yield', c.dataset.st)));
      root.querySelectorAll('[data-spark]').forEach((cv) => {
        const ser = st.series(sim.byStation[cv.dataset.spark].slice(-3000), now - 12 * H, now, H).map((b) => b.fpy);
        M.ch.spark(cv, ser, '#56b366', 0.8, 1);
      });

      // Throughput.
      const series = M.PRODUCTS.map((p, i) => {
        const first = st.window(p.route[0], now - 24 * H, now).filter((r) => r.att === 1 && !r.rep);
        const bins = new Array(24).fill(0);
        first.forEach((r) => { const b = Math.floor((r.t - (now - 24 * H)) / H); if (b >= 0 && b < 24) bins[b]++; });
        return { pts: bins.map((v, b) => [now - 24 * H + b * H + H / 2, v]), color: M.ch.COL[i], width: 2 };
      });
      M.ch.line(root.querySelector('#lvTp'), { t0: now - 24 * H, t1: now, series, y: [0, 110], h: 200 });
      root.querySelector('#lvTp').title = M.PRODUCTS.map((p, i) => ['blue', 'purple', 'green'][i] + ': ' + p.short).join(' · ');

      const ev = sim.events.slice(0, 60);
      root.querySelector('#lvFeed').innerHTML = ev.length ? ev.map((e) => `<div><span class="tm">${ui.hm(e.t)}</span><span class="dim">${e.st || ''}</span><span class="${e.kind}">${esc(e.text)}</span></div>`).join('') : '<span class="muted">Nothing yet.</span>';
    },
  };
})(globalThis.M = globalThis.M || {});
