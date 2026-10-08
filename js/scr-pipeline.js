// Data pipeline: tester → collector → store → dashboards. Local first: a collector queues on the
// tester when the link is down and back-fills when it returns. Take any station's link down here.
(function (M) {
  const ui = M.ui, esc = ui.esc, sim = M.sim, MIN = 60000;
  const KIND = { ts: 'TestStand result-processing plug-in', lv: 'LabVIEW results library', file: 'File watcher (vendor CSV/XML)' };
  const ROW = 100;   // ❓ bytes per stored measurement row, uncompressed, with indexes

  M.screens.pipeline = {
    mount(root) {
      root.innerHTML = `<div class="toolbar"><span class="ttl">Data pipeline</span><span class="muted">Local first, then networked. A tester never waits for the server to finish a test.</span></div>
        <div class="dash">
          ${ui.panel('c12', 'Where a result goes', '<div class="flow" id="pFlow"></div>')}
          ${ui.panel('c8', 'Collectors', '<div class="scroll" id="pColl"></div>', { flush: true, sub: 'one per station — try taking a link down' })}
          ${ui.panel('c4', 'Storage, worked out for this factory', '<div id="pSize"></div>')}
          ${ui.panel('c8', 'Results arriving in the store', '<canvas id="pRate" style="height:180px"></canvas>', { sub: 'per 5 minutes, last 4 h — a back-fill shows as a spike' })}
          ${ui.panel('c4', 'If the network is down', `<p style="margin:0 0 6px">Results stay on the tester in the collector’s queue. Nothing is lost and testing carries on. When the link returns, the queue drains and the charts back-fill, in time order.</p>
            <p style="margin:0">Areas that are never networked can use the same collector with a signed export to removable media, imported centrally.</p>${ui.oq(9, 'what does a tester do when the server is unreachable?', 'How much local storage is enough, and who is told when a queue is filling?')}`)}
        </div>`;
    },
    update(root) {
      const now = sim.now;
      const recent = sim.runs.filter((r) => r.t > now - 10 * MIN);
      const queued = M.STATIONS.reduce((a, s) => a + sim.coll[s.id].queue.length, 0);
      const stored = M.STATIONS.reduce((a, s) => a + sim.byStation[s.id].length, 0);
      const stepsPer = (s) => s.meas.length + s.other.length;
      const rowsStored = M.STATIONS.reduce((a, s) => a + sim.byStation[s.id].length * stepsPer(s), 0);
      const online = M.STATIONS.filter((s) => sim.coll[s.id].online).length;
      root.querySelector('#pFlow').innerHTML =
        `<div class="box"><b>${M.STATIONS.length} testers</b><span>${M.STATIONS.filter((s) => s.src === 'ts').length} TestStand · ${M.STATIONS.filter((s) => s.src === 'lv').length} LabVIEW · ${M.STATIONS.filter((s) => s.src === 'file').length} file-drop</span><br><span class="mono">${ui.n(recent.length / 10, 1)} results/min</span></div><div class="arr">→</div>
         <div class="box"><b>Collectors</b><span>local queue on each tester</span><br><span class="mono" style="${queued ? 'color:var(--warn)' : ''}">${online}/${M.STATIONS.length} online · ${ui.n(queued)} queued</span></div><div class="arr">→</div>
         <div class="box"><b>Central store</b><span>PostgreSQL + TimescaleDB, on site</span><br><span class="mono">${ui.n(stored)} results · ${ui.n(rowsStored)} step rows</span></div><div class="arr">→</div>
         <div class="box"><b>Use</b><span>Grafana live views · Power BI · notebooks</span><br><span class="mono">read over SQL</span></div>`;

      root.querySelector('#pColl').innerHTML = `<table class="g"><thead><tr><th>Station</th><th>Collector</th><th>Link</th><th>Queue on tester</th><th class="num">Last sync</th><th class="num">Sent, 7 days</th><th></th></tr></thead><tbody>${M.STATIONS.map((s) => {
        const c = sim.coll[s.id], q = c.queue.length;
        return `<tr><td><b>${s.id}</b> ${esc(s.name)}</td><td title="${esc(KIND[s.src])}">${ui.srcBadge(s.src)} <span class="dim">${{ ts: 'plug-in', lv: 'library', file: 'file watcher' }[s.src]}</span></td>
          <td>${c.online ? '<span class="badge ok">online</span>' : `<span class="badge off">offline ${ui.dur((now - c.offlineSince) / 1000)}</span>`}</td>
          <td><div style="display:flex;align-items:center;gap:6px"><div class="qbar"><i style="width:${Math.min(100, q / 2)}%"></i></div><span class="mono ${q ? '' : 'dim'}">${q}</span></div></td>
          <td class="num dim">${c.lastSync ? ui.ago(c.lastSync) : '—'}</td><td class="num">${ui.n(c.sent)}</td>
          <td><button class="btn sm" data-link="${s.id}">${c.online ? 'Take link down' : 'Restore link'}</button></td></tr>`;
      }).join('')}</tbody></table>`;
      root.querySelectorAll('[data-link]').forEach((b) => (b.onclick = () => { const id = b.dataset.link; sim.setOnline(id, !sim.coll[id].online); ui.refresh(); }));

      // Storage arithmetic from the last 24 h of actual results.
      const day = sim.runs.filter((r) => r.t > now - sim.DAY);
      const rowsDay = day.reduce((a, r) => a + stepsPer(M.stById[r.st]), 0);
      const burnRows = sim.byStation.C2.filter((r) => r.t > now - sim.DAY).length * (48 * 60 / 1) * 2;
      const yearGB = ((rowsDay + burnRows) * 365 * ROW) / 1e9;
      const perTester = (day.filter((r) => r.st === 'A1').length * stepsPer(M.stById.A1) * 365 * ROW) / 1e9;
      root.querySelector('#pSize').innerHTML = `<table class="g"><tbody>
        <tr><td>Results in the last 24 h</td><td class="num">${ui.n(day.length)}</td></tr>
        <tr><td>Step rows a day (incl. burn-in logs, 1/min)</td><td class="num">${ui.n(rowsDay + burnRows)}</td></tr>
        <tr><td>A year, uncompressed ❓</td><td class="num">${ui.n(yearGB, 0)} GB</td></tr>
        <tr><td>With time-series compression (~10×) ❓</td><td class="num">${ui.n(yearGB / 10, 1)} GB</td></tr>
        <tr><td>On the busiest tester, a year</td><td class="num">${ui.n(perTester, 1)} GB</td></tr></tbody></table>
        <div class="note">Storage is cheap and local-first is easy. The value is in joining the data, not in keeping it. ❓ marks an assumption: ${ROW} bytes a row.</div>`;

      // Arrival rate into the store.
      const t0 = now - 4 * 60 * MIN, bin = 5 * MIN, nb = 48, bins = new Array(nb).fill(0);
      // A back-filled result arrives when its collector syncs, so plot by sync time.
      sim.runs.forEach((r) => { if (!r.synced || r.t < t0 - sim.DAY) return; const at = r.syncAt || r.t; const i = Math.floor((at - t0) / bin); if (i >= 0 && i < nb) bins[i]++; });
      M.ch.line(root.querySelector('#pRate'), { t0, t1: now, h: 180, series: [{ pts: bins.map((v, i) => [t0 + i * bin + bin / 2, v]), color: '#5794f2', width: 2, area: 'rgba(87,148,242,.08)' }],
        marks: sim.events.filter((e) => e.t > t0 && /network link down|back online/.test(e.text)).map((e) => ({ t: e.t, color: /down/.test(e.text) ? '#e6b422' : '#56b366', label: e.st + (/down/.test(e.text) ? ' down' : ' back') })) });
    },
  };
})(globalThis.M = globalThis.M || {});
