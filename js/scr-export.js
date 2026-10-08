// BI export: published datasets for business reporting and analysis. Each one is a stable view
// over the store, so Power BI, Excel and notebooks read the same shape and nobody writes their own
// fragile query against the raw tables.
(function (M) {
  const ui = M.ui, esc = ui.esc, sim = M.sim, st = M.stats, DAY = 86400000;
  const iso = (t) => new Date(t).toISOString().slice(0, 19).replace('T', ' ');
  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  const DATASETS = [
    { id: 'yield_daily', name: 'Yield by station and day', who: 'Operations · management', refresh: 'Nightly 02:00, and on demand',
      sql: `CREATE VIEW bi.yield_daily AS
SELECT product, station, date_trunc('day', finished) AS day,
       count(*) FILTER (WHERE attempt = 1 AND NOT after_repair)                    AS first_attempts,
       avg((status = 'pass')::int) FILTER (WHERE attempt = 1 AND NOT after_repair) AS first_pass_yield,
       count(*) FILTER (WHERE attempt > 1 OR after_repair)                         AS retests
FROM results GROUP BY 1, 2, 3;`,
      cols: ['product', 'station', 'day', 'first_attempts', 'first_pass_yield', 'final_yield', 'retests', 'no_fault_found'],
      rows() {
        const out = [];
        M.STATIONS.forEach((s) => {
          const by = {};
          sim.byStation[s.id].forEach((r) => (by[dayKey(r.t)] = by[dayKey(r.t)] || []).push(r));
          Object.keys(by).sort().forEach((d) => { const f = st.fpy(by[d]); if (f) out.push([s.prod, s.id, d, f.n, f.fpy.toFixed(4), f.final.toFixed(4), f.runs - f.n, f.nff.toFixed(3)]); });
        });
        return out;
      } },
    { id: 'results', name: 'Test results, one row per run', who: 'Quality · production engineering', refresh: 'Live view',
      sql: `CREATE VIEW bi.results AS
SELECT r.serial, u.product, r.station, r.finished, r.attempt, r.after_repair, r.status,
       r.failed_step, r.sequence_version, r.sequence_hash, r.operator, r.fixture, u.component_lot
FROM results r JOIN units u USING (serial);`,
      cols: ['serial', 'product', 'station', 'finished', 'attempt', 'after_repair', 'status', 'failed_step', 'sequence_version', 'sequence_hash', 'operator', 'fixture', 'component_lot'],
      count: () => sim.runs.filter((r) => r.synced).length,
      rows: (tail) => (tail ? sim.runs.slice(-tail) : sim.runs).filter((r) => r.synced).map((r) => [r.sn, r.prod, r.st, iso(r.t), r.att, r.rep, r.pass ? 'pass' : 'fail', r.fail || '', r.ver, r.hash, r.op, r.fix, r.lot]) },
    { id: 'step_results', name: 'Measured steps, one row per value', who: 'Design and production engineering', refresh: 'Live view (time-series)',
      sql: `CREATE VIEW bi.step_results AS
SELECT s.finished, s.station, s.serial, s.step, s.value, s.low_limit, s.high_limit, s.unit, s.status
FROM step_results s;   -- a TimescaleDB hypertable, compressed after 7 days`,
      cols: ['finished', 'station', 'serial', 'step', 'value', 'low_limit', 'high_limit', 'unit', 'status'],
      count: () => sim.runs.reduce((a, r) => a + (r.synced ? M.stById[r.st].meas.length : 0), 0),
      rows(tail) {
        const out = [];
        (tail ? sim.runs.slice(-tail) : sim.runs).forEach((r) => { if (!r.synced) return; const s = M.stById[r.st]; s.meas.forEach((mm, i) => out.push([iso(r.t), r.st, r.sn, mm.id, r.v[i].toFixed(mm.dp + 1), mm.lsl == null ? '' : mm.lsl, mm.usl == null ? '' : mm.usl, mm.unit, M.outOfLimits(r.v[i], mm) ? 'fail' : 'pass'])); });
        return out;
      } },
    { id: 'unit_genealogy', name: 'Units and their history', who: 'Quality · customer service', refresh: 'Live view',
      sql: `CREATE VIEW bi.unit_genealogy AS
SELECT u.serial, u.product, u.part_number, u.revision, u.component_lot, u.status,
       min(r.finished) AS first_test, max(r.finished) AS last_test,
       count(*) AS runs, bool_or(r.after_repair) AS repaired
FROM units u LEFT JOIN results r USING (serial) GROUP BY u.serial;`,
      cols: ['serial', 'product', 'part_number', 'revision', 'component_lot', 'status', 'first_test', 'last_test', 'runs', 'repaired'],
      count: () => sim.unitList.filter((u) => u.runs.length).length,
      rows: (tail) => (tail ? sim.unitList.slice(-tail) : sim.unitList).filter((u) => u.runs.length).map((u) => { const p = M.prodById[u.prod]; return [u.sn, u.prod, p.part, p.rev, u.lot, u.status, iso(u.runs[0].t), iso(u.runs[u.runs.length - 1].t), u.runs.length, u.repaired]; }) },
    { id: 'station_registry', name: 'Stations, software and instruments', who: 'Test engineering', refresh: 'On every result',
      sql: `CREATE VIEW bi.station_registry AS
SELECT station, sequence, released_version, deployed_version, deployed_hash,
       fixture, fixture_contacts, next_calibration
FROM station_status;`,
      cols: ['station', 'sequence', 'released_version', 'deployed_version', 'deployed_hash', 'fixture', 'fixture_contacts', 'next_calibration'],
      rows: () => M.STATIONS.map((s) => [s.id, s.seq, s.rel, sim.deployed[s.id].ver, sim.deployed[s.id].hash, s.fixture, sim.fixtureCycles[s.id], s.inst.map((i) => i[2]).sort()[0]]) },
  ];

  M.screens.export = {
    mount(root) {
      root.innerHTML = `<div class="toolbar"><span class="ttl">BI export</span><span class="muted">Published views over the store. Power BI, Excel and notebooks connect to these, not to the raw tables.</span></div>
        <div class="dash">
          ${ui.panel('c5', 'Datasets', '<div id="xList"></div>', { flush: true })}
          ${ui.panel('c7', 'Definition', '<div id="xDef"></div>')}
          ${ui.panel('c12', 'Preview', '<div class="scroll" id="xPrev" style="max-height:330px"></div>', { flush: true, right: '<button class="btn sm primary" id="xCsv">Download CSV</button>' })}
        </div>`;
      root.querySelector('#xCsv').onclick = () => { const d = cur(); ui.download(`${d.id}.csv`, [d.cols, ...d.rows()]); };
    },
    update(root) {
      const d = cur();
      root.querySelector('#xList').innerHTML = `<table class="g"><thead><tr><th>View</th><th>For</th><th class="num">Rows</th></tr></thead><tbody>${DATASETS.map((x) => `<tr class="click ${x.id === d.id ? 'sel' : ''}" data-x="${x.id}"><td><b class="mono">bi.${x.id}</b><br><span class="muted">${esc(x.name)}</span></td><td>${esc(x.who)}</td><td class="num">${ui.n(x.count ? x.count() : x.rows().length)}</td></tr>`).join('')}</tbody></table>`;
      root.querySelectorAll('[data-x]').forEach((tr) => (tr.onclick = () => { ui.state.ds = tr.dataset.x; ui.refresh(); }));
      root.querySelector('#xDef').innerHTML = `<div class="muted" style="margin-bottom:6px">Refresh: <b style="color:var(--ink)">${esc(d.refresh)}</b> · Used by: ${esc(d.who)}</div>
        <pre class="mono" style="margin:0;background:#0d0f13;border:1px solid var(--line);padding:8px 10px;font-size:11.5px;overflow:auto;color:#c8d0da">${esc(d.sql)}</pre>
        ${ui.oq(20, 'where do business and design teams get their data — from dashboards or from the store?', 'Published views stop every team from writing its own fragile query.')}`;
      const rows = d.rows(40);   // the preview needs only the latest rows; the download takes them all
      root.querySelector('#xPrev').innerHTML = `<table class="g"><thead><tr>${d.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(-25).reverse().map((r) => `<tr>${r.map((c) => `<td class="${typeof c === 'number' ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    },
  };
  function cur() { return DATASETS.find((x) => x.id === M.ui.state.ds) || DATASETS[0]; }
})(globalThis.M = globalThis.M || {});
