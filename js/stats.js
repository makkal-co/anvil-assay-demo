// The statistics the dashboards are built on. Computed properly even though the data is invented:
// true first-pass yield, final yield, rolled throughput yield, retest and no-fault-found rates,
// Cpk, a failure Pareto and SPC control limits.
(function (M) {
  const S = {};
  M.stats = S;

  // A unit's first attempt at a station is attempt 1 before any repair. Everything after it is a
  // retest, which is exactly what reported "final" yield hides.
  S.fpy = function (runs) {
    let n = 0, pass = 0, retest = 0;
    const units = new Map();
    for (const r of runs) {
      if (r.att === 1 && !r.rep) { n++; if (r.pass) pass++; }
      else retest++;
      let u = units.get(r.sn);
      if (!u) { u = { first: null, second: null, any: false }; units.set(r.sn, u); }
      if (r.att === 1 && !r.rep) u.first = r.pass;
      if (r.att === 2 && !r.rep) u.second = r.pass;
      if (r.pass) u.any = true;
    }
    if (!n) return null;
    let finalN = 0, finalPass = 0, failed1 = 0, nff = 0;
    units.forEach((u) => {
      if (u.first === null) return;
      finalN++; if (u.any) finalPass++;
      if (u.first === false) { failed1++; if (u.second === true) nff++; }
    });
    return { n, fpy: pass / n, final: finalN ? finalPass / finalN : null, retestRate: retest / n, failed1, nff: failed1 ? nff / failed1 : 0, runs: runs.length };
  };

  S.meanSd = function (vals) {
    const n = vals.length; if (n < 2) return null;
    let s = 0; for (const v of vals) s += v;
    const mean = s / n;
    let q = 0; for (const v of vals) q += (v - mean) * (v - mean);
    return { n, mean, sd: Math.sqrt(q / (n - 1)) };
  };

  S.cpk = function (vals, mm) {
    if (vals.length < 10) return null;
    const ms = S.meanSd(vals);
    if (!ms || !ms.sd) return null;
    const up = mm.usl != null ? (mm.usl - ms.mean) / (3 * ms.sd) : Infinity;
    const lo = mm.lsl != null ? (ms.mean - mm.lsl) / (3 * ms.sd) : Infinity;
    return Math.min(up, lo);
  };

  S.pareto = function (runs) {
    const c = {};
    for (const r of runs) if (!r.pass) c[r.st + ':' + r.fail] = (c[r.st + ':' + r.fail] || 0) + 1;
    return Object.entries(c).map(([k, n]) => { const [st, step] = k.split(':'); return { st, step, n, name: M.sim.stepName(M.stById[st], step) }; }).sort((a, b) => b.n - a.n);
  };

  // Rolled throughput yield: the product of first-pass yields along a product's route. Parallel
  // stations at one stage are pooled, since a unit visits one of them.
  S.rty = function (prod, t0, t1) {
    const p = M.prodById[prod];
    let rty = 1, any = false;
    for (const stage of p.route) {
      const ids = Array.isArray(stage) ? stage : [stage];
      const rs = [];
      ids.forEach((id) => S.window(id, t0, t1).forEach((r) => rs.push(r)));
      const f = S.fpy(rs);
      if (!f) continue;
      any = true; rty *= f.fpy;
    }
    return any ? rty : null;
  };

  // Results for a station in [t0, t1), from the central store, by binary search on time.
  S.window = function (st, t0, t1) {
    const a = M.sim.byStation[st];
    const lb = (x) => { let lo = 0, hi = a.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (a[mid].t < x) lo = mid + 1; else hi = mid; } return lo; };
    return a.slice(lb(t0), lb(t1));
  };

  S.prodWindow = function (prod, t0, t1) {
    const out = [];
    M.STATIONS.filter((s) => s.prod === prod).forEach((s) => S.window(s.id, t0, t1).forEach((r) => out.push(r)));
    return out;
  };

  // Hourly (or any bin) series of first-pass and final yield.
  S.series = function (runs, t0, t1, bin) {
    const nb = Math.ceil((t1 - t0) / bin);
    const bins = Array.from({ length: nb }, () => []);
    for (const r of runs) { const i = Math.floor((r.t - t0) / bin); if (i >= 0 && i < nb) bins[i].push(r); }
    return bins.map((b, i) => { const f = S.fpy(b); return { t: t0 + i * bin, n: b.length, fpy: f ? f.fpy : null, final: f ? f.final : null }; });
  };

  S.hist = function (vals, lo, hi, nb) {
    const h = new Array(nb).fill(0), w = (hi - lo) / nb;
    for (const v of vals) { let i = Math.floor((v - lo) / w); if (i < 0) i = 0; if (i >= nb) i = nb - 1; h[i]++; }
    return { h, lo, hi, w };
  };
})(globalThis.M = globalThis.M || {});
