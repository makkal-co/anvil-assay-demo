// Shared helpers: formatting, station state, panels, menus, toasts.
(function (M) {
  const ui = {};
  M.ui = ui;
  ui.state = { user: null, screen: 'floor', st: null, range: 24 * 3600000 };
  M.screens = {};

  ui.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  ui.hm = (t) => { const d = new Date(t); return p2(d.getHours()) + ':' + p2(d.getMinutes()); };
  ui.dt = (t) => { const d = new Date(t); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  ui.date = (t) => { const d = new Date(t); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
  ui.pct = (v, dp = 1) => (v == null ? '—' : (v * 100).toFixed(dp) + '%');
  ui.n = (v, dp = 0) => (v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }));
  ui.dur = (s) => (s >= 3600 ? (s / 3600).toFixed(1) + ' h' : s >= 60 ? Math.round(s / 60) + ' min' : Math.round(s) + ' s');
  ui.ago = (t) => { const s = (M.sim.now - t) / 1000; return s < 90 ? Math.round(s) + ' s ago' : s < 5400 ? Math.round(s / 60) + ' min ago' : (s / 3600).toFixed(1) + ' h ago'; };
  ui.val = (v, mm) => (v == null ? '—' : Number(v).toFixed(mm.dp));
  ui.limits = (mm) => (mm.lsl != null && mm.usl != null ? `${mm.lsl} – ${mm.usl}` : mm.lsl != null ? `≥ ${mm.lsl}` : `≤ ${mm.usl}`);
  ui.srcBadge = (src) => `<span class="badge ${src}">${M.SRC[src]}</span>`;
  ui.cpkClass = (c) => (c == null ? '' : c < 1 ? 'bad' : c < 1.33 ? 'warn' : 'ok');

  // ---- Station state ---------------------------------------------------------------
  ui.current = (stId) => { const now = M.sim.now; return M.sim.pending[stId].find((e) => e.start <= now && e.t > now); };
  ui.activeAlerts = (stId) => M.sim.alerts.filter((a) => !a.cleared && (!stId || a.st === stId));
  ui.stState = function (stId) {
    if (!M.sim.coll[stId].online) return 'off';
    const al = ui.activeAlerts(stId);
    if (al.some((a) => a.sev === 'R')) return 'alarm';
    if (al.length) return 'warn';
    return ui.current(stId) ? 'test' : 'idle';
  };
  ui.STATE_TXT = { test: 'Testing', idle: 'Idle', alarm: 'Alarm', warn: 'Warning', off: 'Collector offline' };

  // ---- Panels ------------------------------------------------------------------------
  ui.panel = (cls, title, body, opt = {}) =>
    `<section class="pn ${cls}"${opt.id ? ` id="${opt.id}"` : ''}><div class="pn-h">${title}${opt.sub ? ` <span class="sub">${opt.sub}</span>` : ''}<span class="sp"></span>${opt.right || ''}</div><div class="pn-b${opt.flush ? ' flush' : ''}">${body}</div></section>`;
  ui.stat = (cls, k, v, vcls, d) => `<section class="pn ${cls}"><div class="stat"><div class="k">${k}</div><div class="v ${vcls || ''}">${v}</div><div class="d">${d || '&nbsp;'}</div></div></section>`;
  ui.oq = (n, q, why) => `<div class="oq"><b>Open question — ${q}</b> ${why} <a href="docs/questions.md#${n}" target="_blank">Question ${n} ↗</a></div>`;

  ui.rangeSeg = (cur) => `<span class="seg">${[[2, '2 h'], [8, '8 h'], [24, '24 h'], [72, '3 d'], [168, '7 d']].map(([h, l]) => `<button class="btn sm ${cur === h * 3600000 ? 'on' : ''}" data-range="${h}">${l}</button>`).join('')}</span>`;
  ui.bindRange = (root, after) => root.querySelectorAll('[data-range]').forEach((b) => (b.onclick = () => { ui.state.range = +b.dataset.range * 3600000; after(); }));

  // Remembers the scroll position of each .scroll element across a re-render.
  ui.keepScroll = function (root, fn) {
    const pos = [...root.querySelectorAll('.scroll')].map((e) => e.scrollTop);
    fn();
    root.querySelectorAll('.scroll').forEach((e, i) => { if (pos[i]) e.scrollTop = pos[i]; });
  };

  ui.toast = function (msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  };

  ui.menu = function (anchor, items) {
    document.querySelectorAll('.menu').forEach((m) => m.remove());
    const m = document.createElement('div'); m.className = 'menu';
    m.innerHTML = items.map((it, i) => (it.head ? `<div class="mh">${ui.esc(it.head)}</div>` : `<div class="mi" data-i="${i}">${ui.esc(it.label)}${it.on ? `<span class="on">${ui.esc(it.on)}</span>` : ''}</div>`)).join('');
    const r = anchor.getBoundingClientRect();
    m.style.top = r.bottom + 4 + 'px'; m.style.left = Math.max(8, Math.min(window.innerWidth - 320, r.left)) + 'px';
    document.body.appendChild(m);
    m.onclick = (e) => { const d = e.target.closest('.mi'); if (!d) return; m.remove(); items[+d.dataset.i].fn(); };
    setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } }), 0);
  };

  // Stations in scope for an analytic: the selected one, or every station.
  ui.scope = () => (ui.state.st ? [M.stById[ui.state.st]] : M.STATIONS);
})(globalThis.M = globalThis.M || {});
