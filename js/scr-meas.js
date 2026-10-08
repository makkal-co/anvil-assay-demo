// Measurements: one measured step, as a distribution against its limits, as a control chart over
// time, across every station that measures it, and by component lot. This is the screen where a
// drifting fixture, an instrument out of calibration or a bad lot shows before the yield does.
(function (M) {
  const ui = M.ui, esc = ui.esc, st = M.stats, sim = M.sim;

  // Opening a station shows its worst measurement first — the one whose last 60 results are least
  // capable — so a drifting fixture or instrument is the first thing on screen, not a menu away.
  function worst(station) {
    const rs = sim.byStation[station.id].slice(-60);
    let best = station.meas[0].id, low = Infinity;
    station.meas.forEach((mm, i) => { const c = st.cpk(rs.map((r) => r.v[i]), mm); if (c != null && c < low) { low = c; best = mm.id; } });
    return best;
  }

  function sel() {
    const s = ui.state;
    if (!s.mst || (s.st && s.mst !== s.st)) { s.mst = s.st || s.mst || 'A1'; s.midFor = null; }
    const station = M.stById[s.mst];
    if (s.midFor !== station.id || !station.meas.some((m) => m.id === s.mid)) { s.mid = worst(station); s.midFor = station.id; }
    return { station, mm: station.meas.find((m) => m.id === s.mid), idx: station.meas.findIndex((m) => m.id === s.mid) };
  }

  M.screens.meas = {
    mount(root) {
      root.innerHTML = `<div class="toolbar"><span class="ttl">Measurements</span>
          <select id="mSt"></select><select id="mMm"></select><span class="sp"></span><span id="mRange"></span></div>
        <div class="dash" id="mStats"></div>
        <div class="dash" style="margin-top:8px">
          ${ui.panel('c6', 'Distribution against limits', '<canvas id="mHist" style="height:240px"></canvas>', { id: 'mHistP' })}
          ${ui.panel('c6', 'Control chart', '<canvas id="mSpc" style="height:240px"></canvas><div class="note" id="mSpcNote"></div>', { sub: 'every result in order, with ±3σ control limits from the first part of the window' })}
          ${ui.panel('c6', 'Same measurement on other stations', '<div id="mCmp"></div>' + '<div class="note">Latest 100 results from each station.</div>' + ui.oq(18, 'how are stations compared when they measure the same thing?', 'A small offset is invisible on each station’s own pass/fail. Side by side, it is a calibration problem with a date on it.'))}
          ${ui.panel('c6', 'By component lot', '<div id="mLot"></div>' + ui.oq(17, 'is a measurement judged only against its limits, or also against its own trend?', 'A limit only catches drift after yield has dropped.'))}
        </div>`;
      const sSel = root.querySelector('#mSt'), mSel = root.querySelector('#mMm');
      sSel.onchange = () => { ui.state.mst = sSel.value; ui.state.st = sSel.value; ui.go('meas'); };
      mSel.onchange = () => { ui.state.mid = mSel.value; ui.state.midFor = ui.state.mst; ui.refresh(); };
    },
    update(root) {
      const { station, mm, idx } = sel();
      const now = sim.now, rg = ui.state.range, t0 = now - rg;
      const sSel = root.querySelector('#mSt'), mSel = root.querySelector('#mMm');
      if (!sSel.options.length) {
        sSel.innerHTML = M.STATIONS.map((s) => `<option value="${s.id}">${s.id} · ${esc(s.name)} (${esc(M.prodById[s.prod].short)})</option>`).join('');
      }
      sSel.value = station.id;
      const opts = station.meas.map((m) => `<option value="${m.id}">${esc(m.name)}${m.unit ? ' (' + m.unit + ')' : ''}</option>`).join('');
      if (mSel.dataset.st !== station.id) { mSel.innerHTML = opts; mSel.dataset.st = station.id; }
      mSel.value = mm.id;
      root.querySelector('#mRange').innerHTML = ui.rangeSeg(rg);
      ui.bindRange(root, () => ui.refresh());

      const rs = st.window(station.id, t0, now);
      const vals = rs.map((r) => r.v[idx]);
      const ms = st.meanSd(vals) || { n: vals.length, mean: mm.nom, sd: mm.sd };
      const cpk = st.cpk(vals, mm);
      const recent = st.cpk(vals.slice(-60), mm);
      const out = vals.filter((v) => M.outOfLimits(v, mm)).length;
      const u = mm.unit ? ' ' + mm.unit : '';
      root.querySelector('#mStats').innerHTML =
        ui.stat('c2', 'Results', ui.n(vals.length), 'blue', `${station.id} · ${esc(mm.name)}`) +
        ui.stat('c2', 'Mean', ui.val(ms.mean, mm) + u, '', 'nominal ' + mm.nom + u) +
        ui.stat('c2', 'Std deviation', ms.sd.toFixed(mm.dp + 1) + u, '', 'limits ' + ui.limits(mm) + u) +
        ui.stat('c2', 'Cpk, whole window', cpk == null ? '—' : cpk.toFixed(2), ui.cpkClass(cpk), '≥ 1.33 capable') +
        ui.stat('c2', 'Cpk, last 60 units', recent == null ? '—' : recent.toFixed(2), ui.cpkClass(recent), recent != null && cpk != null && recent < cpk - 0.3 ? 'falling — something changed' : 'steady') +
        ui.stat('c2', 'Outside limits', ui.n(out), out ? 'bad' : 'ok', ui.pct(vals.length ? out / vals.length : 0, 2) + ' of results');

      // Histogram: range covers the data and both limits.
      let lo = Math.min(...vals, mm.lsl != null ? mm.lsl : Infinity), hi = Math.max(...vals, mm.usl != null ? mm.usl : -Infinity);
      if (!isFinite(lo) || !isFinite(hi)) { lo = mm.nom - 4 * mm.sd; hi = mm.nom + 4 * mm.sd; }
      if (mm.lsl == null) lo = Math.min(lo, ms.mean - 4 * ms.sd); if (mm.usl == null) hi = Math.max(hi, ms.mean + 4 * ms.sd);
      const pad = (hi - lo) * 0.05; lo -= pad; hi += pad;
      M.ch.hist(root.querySelector('#mHist'), { h: 240, hist: st.hist(vals, lo, hi, 48), lsl: mm.lsl, usl: mm.usl, mean: ms.mean, sd: ms.sd });

      // Control chart: baseline from the first 30% of the window.
      const base = st.meanSd(vals.slice(0, Math.max(20, Math.floor(vals.length * 0.3)))) || ms;
      const ucl = base.mean + 3 * base.sd, lcl = base.mean - 3 * base.sd;
      const step = Math.max(1, Math.ceil(rs.length / 1500));
      const pts = [], hiPts = [];
      for (let i = 0; i < rs.length; i += step) { const p = [rs[i].t, vals[i]]; pts.push(p); if (vals[i] > ucl || vals[i] < lcl) hiPts.push(p); }
      // Western Electric rule 4: eight consecutive points on one side of the centre line.
      let run = 0, side = 0, ruleAt = null;
      vals.forEach((v, i) => { const sd = v > base.mean ? 1 : -1; run = sd === side ? run + 1 : 1; side = sd; if (run === 8) ruleAt = rs[i].t; });
      const hl = [{ y: base.mean, color: '#8e96a3', label: 'centre', dash: [2, 3] }, { y: ucl, color: '#e6b422', label: 'UCL' }, { y: lcl, color: '#e6b422', label: 'LCL' }];
      if (mm.usl != null) hl.push({ y: mm.usl, color: '#f2495c', label: 'USL', dash: [] });
      if (mm.lsl != null) hl.push({ y: mm.lsl, color: '#f2495c', label: 'LSL', dash: [] });
      M.ch.line(root.querySelector('#mSpc'), { t0, t1: now, h: 240, series: [{ pts, color: '#5794f2', dots: true, r: 1.6, hi: hiPts }], hlines: hl,
        marks: sim.events.filter((e) => e.kind === 'demo' && e.t > t0 && e.st === station.id).map((e) => ({ t: e.t, color: '#9cc0f5', label: 'demo' })) });
      const outCl = vals.filter((v) => v > ucl || v < lcl).length;
      root.querySelector('#mSpcNote').innerHTML = `${outCl} point${outCl === 1 ? '' : 's'} outside the control limits` + (ruleAt ? ` · last run of eight on one side of centre ended ${ui.ago(ruleAt)}` : '') + '. Control limits say whether the process changed; specification limits say whether the unit is good. They are different questions.';

      // Same measurement elsewhere.
      const same = M.STATIONS.filter((s) => s.meas.some((m) => m.id === mm.id));
      const allVals = [];
      const rowsCmp = same.map((s) => {
        const i = s.meas.findIndex((m) => m.id === mm.id);
        const v = sim.byStation[s.id].slice(-100).map((r) => r.v[i]); v.forEach((x) => allVals.push(x));   // latest 100 each, so a recent offset is not averaged away
        return { s, v, ms: st.meanSd(v), cpk: st.cpk(v, mm) };
      });
      const pool = st.meanSd(allVals);
      root.querySelector('#mCmp').innerHTML = same.length < 2
        ? `<p class="muted" style="margin:0">Only ${station.id} measures ${esc(mm.name)}. Choose a functional-test measurement on A3 or A4, or the 3.3 V rail on C1 and C3, to compare stations.</p>`
        : `<table class="g"><thead><tr><th>Station</th><th class="num">n</th><th class="num">Mean</th><th class="num">σ</th><th class="num">Cpk</th><th class="num">Bias from pooled mean</th><th>Instrument</th></tr></thead><tbody>${rowsCmp.map((r) => {
            const bias = r.ms && pool ? r.ms.mean - pool.mean : null; const big = bias != null && Math.abs(bias) > 0.5 * pool.sd;
            return `<tr class="${r.s.id === station.id ? 'sel' : ''}"><td><b>${r.s.id}</b> ${esc(r.s.name)}</td><td class="num">${ui.n(r.v.length)}</td><td class="num">${r.ms ? ui.val(r.ms.mean, mm) : '—'}</td><td class="num">${r.ms ? r.ms.sd.toFixed(mm.dp + 1) : '—'}</td><td class="num ${ui.cpkClass(r.cpk)}">${r.cpk == null ? '—' : r.cpk.toFixed(2)}</td><td class="num ${big ? 'fail' : ''}">${bias == null ? '—' : (bias >= 0 ? '+' : '') + bias.toFixed(mm.dp + 1) + u}</td><td>${esc(r.s.inst[0][0])}</td></tr>`;
          }).join('')}</tbody></table>`;

      // By lot.
      const byLot = {};
      rs.forEach((r, i) => { (byLot[r.lot] = byLot[r.lot] || []).push(vals[i]); });
      root.querySelector('#mLot').innerHTML = `<table class="g"><thead><tr><th>Component lot</th><th class="num">n</th><th class="num">Mean</th><th class="num">σ</th><th class="num">Cpk</th><th class="num">Outside limits</th></tr></thead><tbody>${Object.entries(byLot).sort().map(([lot, v]) => {
        const s2 = st.meanSd(v), c = st.cpk(v, mm), o = v.filter((x) => M.outOfLimits(x, mm)).length;
        return `<tr><td class="mono">${esc(lot)}</td><td class="num">${ui.n(v.length)}</td><td class="num">${s2 ? ui.val(s2.mean, mm) : '—'}</td><td class="num">${s2 ? s2.sd.toFixed(mm.dp + 1) : '—'}</td><td class="num ${ui.cpkClass(c)}">${c == null ? '—' : c.toFixed(2)}</td><td class="num ${o ? 'fail' : ''}">${o}</td></tr>`;
      }).join('')}</tbody></table><div class="note">Design engineering reads this table: a lot that moves a distribution is evidence for the next revision, not only a production problem.</div>`;
    },
  };
})(globalThis.M = globalThis.M || {});
