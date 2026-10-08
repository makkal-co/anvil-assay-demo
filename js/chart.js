// Canvas charts for the dashboards: time series, bars with a Pareto line, a histogram against its
// limits, and sparklines. Small, dependency-free, and sharp on high-DPI screens.
(function (M) {
  const C = {};
  M.ch = C;
  const GRID = '#2a2f35', AX = '#8e96a3', FONT = '11px Segoe UI, system-ui, sans-serif', MONO = '10.5px Consolas, monospace';
  C.COL = ['#5794f2', '#b877d9', '#56b366', '#e6b422', '#3fb8b8', '#f2495c', '#8ab8ff', '#ca95e5'];

  function setup(cv, h) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || cv.parentNode.clientWidth || 300;
    h = h || cv.clientHeight || 180;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.height = h + 'px';
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    return { x, w, h };
  }
  C.setup = setup;

  function niceTicks(lo, hi, n) {
    const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || mag * 10;
    const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
    return { ticks: out, step };
  }
  const fmtTick = (v, step) => { const d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step))); return v.toFixed(d); };

  function timeTicks(t0, t1, w) {
    const H = 3600000, span = t1 - t0;
    const steps = [H, 2 * H, 3 * H, 6 * H, 12 * H, 24 * H, 48 * H];
    const step = steps.find((s) => span / s <= Math.max(3, w / 90)) || 48 * H;
    const out = [];
    const d = new Date(t0); d.setMinutes(0, 0, 0);
    let t = d.getTime(); if (t < t0) t += H;
    let day = 0, lastDate = -1;
    for (; t <= t1; t += H) {
      const dt = new Date(t);
      if (step < 24 * H) { if (dt.getHours() % (step / H) === 0) out.push(t); continue; }
      if (dt.getHours() !== 0 || dt.getDate() === lastDate) continue;
      lastDate = dt.getDate();
      if (day++ % (step / (24 * H)) === 0) out.push(t);
    }
    return { ticks: out, step };
  }
  const p2 = (n) => String(n).padStart(2, '0');
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function timeLabel(t, step) {
    const d = new Date(t);
    if (step >= 24 * 3600000 || d.getHours() === 0) return DOW[d.getDay()] + ' ' + d.getDate();
    return p2(d.getHours()) + ':00';
  }

  // Time series. opt: { t0, t1, y:[lo,hi], series:[{pts:[[t,v]], color, width, dash, area}],
  // hlines:[{y, color, label, dash}], bands:[{y0, y1, color}], marks:[{t, color, label}], yfmt, unit }
  C.line = function (cv, opt) {
    const { x, w, h } = setup(cv, opt.h);
    const L = 44, R = 10, T = 8, B = 20, pw = w - L - R, ph = h - T - B;
    let [lo, hi] = opt.y || [0, 1];
    if (!opt.y) {
      lo = Infinity; hi = -Infinity;
      opt.series.forEach((s) => s.pts.forEach((p) => { if (p[1] != null) { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); } }));
      (opt.hlines || []).forEach((l) => { lo = Math.min(lo, l.y); hi = Math.max(hi, l.y); });
      if (!isFinite(lo)) { lo = 0; hi = 1; }
      const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    }
    const X = (t) => L + ((t - opt.t0) / (opt.t1 - opt.t0)) * pw;
    const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * ph;
    x.font = MONO; x.fillStyle = AX; x.strokeStyle = GRID; x.lineWidth = 1;
    const yt = niceTicks(lo, hi, Math.max(2, Math.floor(ph / 32)));
    yt.ticks.forEach((v) => { const y = Math.round(Y(v)) + 0.5; x.beginPath(); x.moveTo(L, y); x.lineTo(L + pw, y); x.stroke(); x.textAlign = 'right'; x.fillText((opt.yfmt || ((v) => fmtTick(v, yt.step)))(v), L - 5, y + 3.5); });
    const tt = timeTicks(opt.t0, opt.t1, pw);
    x.textAlign = 'center';
    tt.ticks.forEach((t) => { const xx = Math.round(X(t)) + 0.5; x.beginPath(); x.moveTo(xx, T); x.lineTo(xx, T + ph); x.stroke(); x.fillText(timeLabel(t, tt.step), xx, h - 6); });
    (opt.bands || []).forEach((b) => { x.fillStyle = b.color; const y0 = Y(Math.min(hi, b.y1)), y1 = Y(Math.max(lo, b.y0)); x.fillRect(L, y0, pw, y1 - y0); });
    (opt.marks || []).forEach((m) => { const xx = X(m.t); if (xx < L || xx > L + pw) return; x.strokeStyle = m.color; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(xx, T); x.lineTo(xx, T + ph); x.stroke(); x.setLineDash([]); if (m.label) { x.fillStyle = m.color; x.textAlign = 'left'; x.font = FONT; x.fillText(m.label, xx + 4, T + 11); x.font = MONO; } });
    x.save(); x.beginPath(); x.rect(L, T, pw, ph); x.clip();
    opt.series.forEach((s) => {
      x.strokeStyle = s.color; x.lineWidth = s.width || 1.5; x.setLineDash(s.dash || []);
      if (s.dots) { x.fillStyle = s.color; s.pts.forEach((p) => { if (p[1] == null) return; x.beginPath(); x.arc(X(p[0]), Y(p[1]), s.r || 1.8, 0, 7); x.fill(); }); return; }
      // Split at gaps so a line (and its shaded area) never bridges hours with no data.
      const segs = []; let cur = [];
      s.pts.forEach((p) => { if (p[1] == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push(p); });
      if (cur.length) segs.push(cur);
      segs.forEach((sg) => {
        x.beginPath(); sg.forEach((p, i) => (i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1])))); x.stroke();
        if (s.area && sg.length > 1) { x.lineTo(X(sg[sg.length - 1][0]), T + ph); x.lineTo(X(sg[0][0]), T + ph); x.closePath(); x.fillStyle = s.area; x.fill(); }
      });
      x.setLineDash([]);
      if (s.hi) s.hi.forEach((p) => { x.fillStyle = s.hiColor || '#f2495c'; x.beginPath(); x.arc(X(p[0]), Y(p[1]), 3, 0, 7); x.fill(); });
    });
    x.restore();
    (opt.hlines || []).forEach((l) => { const y = Math.round(Y(l.y)) + 0.5; if (y < T || y > T + ph) return; x.strokeStyle = l.color; x.setLineDash(l.dash || [5, 4]); x.beginPath(); x.moveTo(L, y); x.lineTo(L + pw, y); x.stroke(); x.setLineDash([]); if (l.label) { x.fillStyle = l.color; x.textAlign = 'right'; x.font = FONT; x.fillText(l.label, L + pw - 4, y - 4); x.font = MONO; } });
    return { X, Y, L, T, pw, ph };
  };

  // Vertical bars with optional cumulative-percentage line (a Pareto). opt: { labels, vals, colors, cum, fmt }
  C.bars = function (cv, opt) {
    const { x, w, h } = setup(cv, opt.h);
    const L = 96, R = opt.cum ? 34 : 10, T = 10, B = 62, pw = w - L - R, ph = h - T - B;
    const max = Math.max(1, ...opt.vals);
    const yt = niceTicks(0, max, 4);
    const top = yt.ticks[yt.ticks.length - 1] || max;
    x.font = MONO; x.strokeStyle = GRID; x.fillStyle = AX;
    yt.ticks.forEach((v) => { const y = Math.round(T + ph - (v / top) * ph) + 0.5; x.beginPath(); x.moveTo(L, y); x.lineTo(L + pw, y); x.stroke(); x.textAlign = 'right'; x.fillText(String(v), L - 5, y + 3.5); });
    const n = opt.vals.length, bw = pw / Math.max(n, 1);
    opt.vals.forEach((v, i) => {
      const bh = (v / top) * ph;
      x.fillStyle = (opt.colors && opt.colors[i]) || C.COL[0];
      x.fillRect(L + i * bw + bw * 0.15, T + ph - bh, bw * 0.7, bh);
      x.save(); x.translate(L + i * bw + bw / 2, T + ph + 6); x.rotate(-Math.PI / 6); x.textAlign = 'right'; x.fillStyle = AX; x.font = FONT;
      const lb = opt.labels[i]; x.fillText(lb.length > 22 ? lb.slice(0, 21) + '…' : lb, 0, 6); x.restore();
    });
    if (opt.cum) {
      const tot = opt.vals.reduce((a, b) => a + b, 0) || 1; let c = 0;
      x.strokeStyle = '#e6b422'; x.lineWidth = 1.5; x.beginPath();
      opt.vals.forEach((v, i) => { c += v; const px = L + i * bw + bw / 2, py = T + ph - (c / tot) * ph; if (i) x.lineTo(px, py); else x.moveTo(px, py); });
      x.stroke();
      x.fillStyle = '#e6b422'; x.textAlign = 'left'; x.font = MONO;
      [0, 50, 100].forEach((p) => x.fillText(p + '%', L + pw + 4, T + ph - (p / 100) * ph + 3.5));
    }
  };

  // Histogram against limits, with a fitted normal curve. opt: { hist, lsl, usl, mean, sd, color, unit, dp }
  C.hist = function (cv, opt) {
    const { x, w, h } = setup(cv, opt.h);
    const L = 36, R = 10, T = 14, B = 22, pw = w - L - R, ph = h - T - B;
    const { h: bins, lo, hi, w: bw } = opt.hist;
    const max = Math.max(1, ...bins);
    const X = (v) => L + ((v - lo) / (hi - lo)) * pw;
    x.font = MONO; x.fillStyle = AX; x.strokeStyle = GRID;
    const xt = niceTicks(lo, hi, Math.max(3, Math.floor(pw / 70)));
    x.textAlign = 'center';
    xt.ticks.forEach((v) => { const xx = Math.round(X(v)) + 0.5; x.beginPath(); x.moveTo(xx, T); x.lineTo(xx, T + ph); x.stroke(); x.fillText(fmtTick(v, xt.step), xx, h - 7); });
    bins.forEach((c, i) => {
      const v0 = lo + i * bw, v1 = v0 + bw;
      const out = (opt.lsl != null && v1 <= opt.lsl) || (opt.usl != null && v0 >= opt.usl);
      x.fillStyle = out ? '#f2495c' : (opt.color || '#5794f2');
      const bh = (c / max) * ph;
      x.fillRect(X(v0) + 0.5, T + ph - bh, Math.max(1, X(v1) - X(v0) - 1), bh);
    });
    if (opt.sd) {
      x.strokeStyle = '#d8dce3'; x.lineWidth = 1.2; x.beginPath();
      const area = bins.reduce((a, b) => a + b, 0) * bw;
      for (let i = 0; i <= 120; i++) {
        const v = lo + (hi - lo) * i / 120;
        const y = area * Math.exp(-0.5 * ((v - opt.mean) / opt.sd) ** 2) / (opt.sd * Math.sqrt(2 * Math.PI));
        const py = T + ph - (y / max) * ph; if (i) x.lineTo(X(v), py); else x.moveTo(X(v), py);
      }
      x.stroke();
    }
    [['LSL', opt.lsl], ['USL', opt.usl]].forEach(([lb, v]) => {
      if (v == null || v < lo || v > hi) return;
      const xx = Math.round(X(v)) + 0.5;
      x.strokeStyle = '#f2495c'; x.setLineDash([5, 3]); x.beginPath(); x.moveTo(xx, T - 4); x.lineTo(xx, T + ph); x.stroke(); x.setLineDash([]);
      x.fillStyle = '#f2495c'; x.font = FONT; x.textAlign = lb === 'LSL' ? 'left' : 'right'; x.fillText(lb, xx + (lb === 'LSL' ? 3 : -3), T + 2);
    });
  };

  C.spark = function (cv, vals, color, lo, hi) {
    const { x, w, h } = setup(cv, 30);
    const v = vals.filter((a) => a != null); if (v.length < 2) return;
    lo = lo != null ? lo : Math.min(...v); hi = hi != null ? hi : Math.max(...v); if (hi === lo) { hi += 1; lo -= 1; }
    x.strokeStyle = color; x.lineWidth = 1.3; x.beginPath();
    let pen = false;
    vals.forEach((a, i) => { if (a == null) { pen = false; return; } const px = (i / (vals.length - 1)) * (w - 2) + 1, py = h - 2 - ((a - lo) / (hi - lo)) * (h - 4); if (pen) x.lineTo(px, py); else { x.moveTo(px, py); pen = true; } });
    x.stroke();
  };
})(globalThis.M = globalThis.M || {});
