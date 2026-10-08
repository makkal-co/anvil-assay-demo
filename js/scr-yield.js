// Yield & Pareto: true first-pass against reported final yield over time, rolled throughput yield
// per product, the failure Pareto, and the per-station table that says where to look first.
(function (M) {
  const ui = M.ui, esc = ui.esc, st = M.stats, sim = M.sim, H = 3600000;

  M.screens.yield = {
    mount(root) {
      root.innerHTML = `<div class="toolbar"><span class="ttl">Yield &amp; Pareto</span><span class="muted" id="yScope"></span><span class="sp"></span><span id="yRange"></span></div>
        <div class="dash" id="yStats"></div>
        <div class="dash" style="margin-top:8px">
          ${ui.panel('c8', 'True first-pass yield against reported final yield', '<canvas id="yTs" style="height:230px"></canvas><div class="note"><span style="color:#56b366">━ first attempt only</span> &nbsp; <span style="color:#8ab8ff">┅ final, after retests</span> &nbsp; The gap between the lines is retest time the factory pays for every shift.</div>')}
          ${ui.panel('c4', 'Why the two numbers differ', `<p style="margin:0 0 6px">A unit that fails, is retested and passes counts as a pass in <b>final</b> yield. Only <b>first-pass</b> yield shows the retest.</p><p style="margin:0 0 6px">Most of those retests pass with no repair: an intermittent contact, a marginal reading, a fixture. That is <b>no-fault-found</b>, and it is a station problem disguised as a product problem.</p><div id="yNff"></div>${ui.oq(2, 'is a retest a new run or a continuation of the old one?', 'If retests overwrite the failed result, first-pass yield cannot be calculated at all.')}`)}
          ${ui.panel('c7', 'Failure Pareto', '<canvas id="yPar" style="height:260px"></canvas>', { sub: 'failed runs by step · <span style="color:#5794f2">■</span> measured step out of limits · <span style="color:#b877d9">■</span> pass/fail step' })}
          ${ui.panel('c5', 'By station', '<div class="scroll" id="yTbl" style="max-height:268px"></div>', { flush: true })}
        </div>`;
    },
    update(root) {
      const now = sim.now, rg = ui.state.range, t0 = now - rg;
      root.querySelector('#yRange').innerHTML = ui.rangeSeg(rg);
      ui.bindRange(root, () => ui.refresh());
      const sts = ui.scope();
      root.querySelector('#yScope').textContent = ui.state.st ? `— ${ui.state.st} ${M.stById[ui.state.st].name}` : '— every station';
      const runs = []; sts.forEach((s) => st.window(s.id, t0, now).forEach((r) => runs.push(r)));
      const f = st.fpy(runs);
      const prods = ui.state.st ? [M.stById[ui.state.st].prod] : M.PRODUCTS.map((p) => p.id);

      root.querySelector('#yStats').innerHTML =
        ui.stat('c2', 'True first-pass yield', ui.pct(f && f.fpy), f && f.fpy < 0.95 ? 'warn' : 'ok', f ? ui.n(f.n) + ' first attempts' : '') +
        ui.stat('c2', 'Reported final yield', ui.pct(f && f.final), '', 'after retests') +
        ui.stat('c2', 'Retest rate', ui.pct(f && f.retestRate), f && f.retestRate > 0.04 ? 'warn' : '', f ? ui.n(f.runs - f.n) + ' retest runs' : '') +
        ui.stat('c2', 'No-fault-found', ui.pct(f && f.nff, 0), f && f.nff > 0.6 ? 'warn' : '', 'failures that passed on a plain retest') +
        prods.slice(0, 2).map((p) => { const r = st.rty(p, t0, now); return ui.stat('c2', 'Rolled throughput · ' + esc(M.prodById[p].short), ui.pct(r), r != null && r < 0.92 ? 'warn' : 'ok', 'product of first-pass yields along the route'); }).join('') +
        (prods.length === 1 ? ui.stat('c2', 'Units scrapped', ui.n(sim.unitList.filter((u) => u.status === 'scrap' && u.prod === prods[0] && u.done > t0).length), '', 'failed again after repair') : '');

      // Time series, binned so the chart has about forty points.
      const bin = Math.max(10 * 60000, Math.round(rg / 42 / 600000) * 600000);
      const ser = st.series(runs, t0, now, bin);
      M.ch.line(root.querySelector('#yTs'), {
        t0, t1: now, h: 230, y: [0.8, 1.005], yfmt: (v) => Math.round(v * 100) + '%',
        series: [
          { pts: ser.map((b) => [b.t + bin / 2, b.n > 3 ? b.final : null]), color: '#8ab8ff', dash: [4, 3], width: 1.5 },
          { pts: ser.map((b) => [b.t + bin / 2, b.n > 3 ? b.fpy : null]), color: '#56b366', width: 2, area: 'rgba(86,179,102,.07)' },
        ],
        hlines: [{ y: 0.95, color: '#e6b422', label: 'first-pass target 95%' }],
        marks: sim.events.filter((e) => e.kind === 'demo' && e.t > t0).map((e) => ({ t: e.t, color: '#9cc0f5', label: e.st })),
      });
      root.querySelector('#yNff').innerHTML = f ? `<div class="kv" style="display:grid;grid-template-columns:1fr auto;gap:2px 10px;font-size:12px;margin-bottom:4px"><span>Units that failed first time</span><span class="num">${ui.n(f.failed1)}</span><span>…and passed a plain retest</span><span class="num">${ui.pct(f.nff, 0)}</span></div>` : '';

      // Pareto.
      const par = st.pareto(runs).slice(0, 10);
      M.ch.bars(root.querySelector('#yPar'), { h: 260, labels: par.map((p) => `${p.st} ${p.name}`), vals: par.map((p) => p.n), colors: par.map((p) => (M.stById[p.st].meas.some((m) => m.id === p.step) ? '#5794f2' : '#b877d9')), cum: true });

      // Station table.
      const rows = sts.map((s) => {
        const rs = st.window(s.id, t0, now), sf = st.fpy(rs), top = st.pareto(rs)[0];
        return `<tr class="click ${ui.state.st === s.id ? 'sel' : ''}" data-st="${s.id}"><td><b>${s.id}</b> ${esc(s.name)}</td><td class="num">${sf ? ui.n(sf.n) : '—'}</td>
          <td class="num ${sf && sf.fpy < 0.95 ? 'fail' : ''}">${ui.pct(sf && sf.fpy)}</td><td class="num">${ui.pct(sf && sf.final)}</td><td class="num">${ui.pct(sf && sf.nff, 0)}</td><td>${top ? esc(top.name) : '<span class="dim">—</span>'}</td></tr>`;
      }).join('');
      root.querySelector('#yTbl').innerHTML = `<table class="g"><thead><tr><th>Station</th><th class="num">First att.</th><th class="num">First-pass</th><th class="num">Final</th><th class="num">NFF</th><th>Top failure</th></tr></thead><tbody>${rows}</tbody></table>`;
      root.querySelectorAll('#yTbl tr.click').forEach((tr) => (tr.onclick = () => ui.go('yield', ui.state.st === tr.dataset.st ? null : tr.dataset.st)));
    },
  };
})(globalThis.M = globalThis.M || {});
