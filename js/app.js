// The frame: login, header, ribbon, the station rail, the status strip, the Demo menu and the
// clock. Screens register themselves in M.screens with mount(root) and update(root).
(function (M) {
  const ui = M.ui, S = ui.state, esc = ui.esc, sim = M.sim;
  const $ = (s) => document.querySelector(s);

  const SCREENS = [
    ['live', 'Factory live'], ['yield', 'Yield & Pareto'], ['meas', 'Measurements'], ['trace', 'Traceability'],
    ['registry', 'Software & stations'], ['pipeline', 'Data pipeline'], ['export', 'BI export'],
  ];

  // ---- Login ---------------------------------------------------------------------------
  function renderLogin() {
    $('#loginUser').innerHTML = M.USERS.map((u) => `<option value="${u.u}" ${u.u === 'test.eng' ? 'selected' : ''}>${u.u} — ${u.role}</option>`).join('');
    const live = M.STATIONS.filter((s) => ui.stState(s.id) !== 'off').length;
    $('#loginSum').innerHTML = `<b>3</b> product lines · <b>${M.STATIONS.length}</b> test stations · <b>${live}</b> collectors online · <b>${ui.n(sim.runs.length)}</b> results in the last 7 days`;
    $('#loginForm').onsubmit = (e) => { e.preventDefault(); enter(M.USERS.find((u) => u.u === $('#loginUser').value)); };
  }
  function enter(user) {
    S.user = user;
    $('#login').hidden = true; $('#app').hidden = false; document.body.classList.remove('pre-login');
    go(S.screen);
  }
  $('#hdrLogout').onclick = () => { M.tour.stop(); S.user = null; $('#app').hidden = true; $('#login').hidden = false; document.body.classList.add('pre-login'); renderLogin(); };

  // ---- Navigation ------------------------------------------------------------------------
  let mounted = null;
  function go(screen, st) {
    if (st !== undefined) S.st = st;
    S.screen = screen;
    const root = $('#screen');
    root.innerHTML = '';
    root.scrollTop = 0;
    mounted = M.screens[screen];
    mounted.mount(root);
    mounted.update(root);
    chrome();
  }
  ui.go = go;

  function chrome() {
    const alerts = ui.activeAlerts();
    $('#ribbon').innerHTML = SCREENS.map(([id, label]) => {
      const badge = id === 'live' && alerts.length ? ` <span class="badge ${alerts.some((a) => a.sev === 'R') ? 'bad' : 'warn'}">${alerts.length}</span>` : '';
      return `<button class="${S.screen === id ? 'on' : ''}" data-s="${id}">${label}${badge}</button>`;
    }).join('');
    $('#ribbon').querySelectorAll('button').forEach((b) => (b.onclick = () => go(b.dataset.s)));
    rail();
    status();
    header();
  }

  function rail() {
    const el = $('#rail');
    const lines = M.PRODUCTS.map((p) => {
      const sts = M.STATIONS.filter((s) => s.prod === p.id);
      return `<div class="rh"><span>${esc(p.short)}</span></div>` + sts.map((s) => {
        const state = ui.stState(s.id);
        return `<div class="it ${S.st === s.id ? 'on' : ''}" data-st="${s.id}" title="${esc(s.long)} — ${ui.STATE_TXT[state]}"><i class="dot ${state}"></i><span class="nm">${s.id} · ${esc(s.name)}</span><span class="src">${M.SRC[s.src]}</span></div>`;
      }).join('');
    }).join('');
    el.innerHTML = `<div class="rh"><span>Stations</span><span class="sp"></span><button class="tog" title="Collapse">«</button></div>` +
      `<div class="it all ${S.st ? '' : 'on'}" data-st=""><i class="dot test"></i><span class="nm">Whole factory</span></div>` + lines;
    el.querySelectorAll('.it').forEach((d) => (d.onclick = () => { S.st = d.dataset.st || null; go(S.screen); }));
    el.querySelector('.tog').onclick = () => document.querySelector('.body').classList.toggle('rail-min');
  }

  function header() {
    $('#hdrClock').textContent = ui.dt(sim.now);
    $('#hdrCtx').textContent = '· ' + (SCREENS.find((s) => s[0] === S.screen) || [])[1] + (S.st ? ' — ' + S.st + ' ' + M.stById[S.st].name : ' — whole factory');
    $('#hdrUser').innerHTML = S.user ? `<b>${esc(S.user.u)}</b> <span>(${esc(S.user.role)})</span>` : '';
  }

  function status() {
    const c = { test: 0, idle: 0, off: 0, alarm: 0, warn: 0 };
    M.STATIONS.forEach((s) => c[ui.stState(s.id)]++);
    const q = M.STATIONS.reduce((a, s) => a + sim.coll[s.id].queue.length, 0);
    $('#status').innerHTML =
      `<span><i class="dot test"></i> ${c.test} testing</span><span><i class="dot idle"></i> ${c.idle} idle</span>` +
      (c.alarm ? `<span><i class="dot alarm"></i> ${c.alarm} alarm</span>` : '') + (c.warn ? `<span><i class="dot warn"></i> ${c.warn} warning</span>` : '') +
      (c.off ? `<span><i class="dot off"></i> ${c.off} collector offline</span>` : '') +
      `<span class="muted">${ui.n(sim.runs.length)} results · ${q ? `<b style="color:var(--warn)">${q} queued on testers</b>` : 'all synced'}</span>` +
      `<span class="sp"></span><span class="muted">Demonstration interface · simulated data · not a product</span>`;
  }

  // ---- Demo menu ---------------------------------------------------------------------------
  const FAULTS = [
    ['wear', 'Wear out the ICT fixture on A1', 'Probe contact resistance creeps up; intermittent opens; retests hide it'],
    ['cal', 'Let A4’s DMM drift out of calibration', 'A4 reads battery error offset from A3 on identical boards'],
    ['lot', 'Switch power modules to component lot L-2619', 'Efficiency distribution moves towards its limit'],
    ['dev', 'Deploy an unreleased sequence build to A3', 'Results carry a version and hash nobody released'],
    ['offline', 'Take A2’s network link down', 'Its collector queues locally; nothing is lost'],
  ];
  $('#hdrDemo').onclick = (e) => {
    const items = [{ head: 'Inject a fault' }];
    FAULTS.forEach(([k, label]) => {
      const on = k === 'offline' ? !sim.coll.A2.online : !!sim.fault[k];
      items.push({ label: on ? 'Restore: ' + label.replace(/^\w+/, (w) => w.toLowerCase()) : label, on: on ? 'active' : '', fn: () => { on ? sim.repair(k) : sim.inject(k); ui.toast(on ? 'Restored' : FAULTS.find((f) => f[0] === k)[2]); refresh(); } });
    });
    items.push({ head: 'Speed' });
    [[1, 'Real time'], [60, '×60 — 1 s = 1 min'], [600, '×600 — 1 s = 10 min']].forEach(([v, l]) => items.push({ label: l, on: sim.speed === v ? '●' : '', fn: () => { sim.speed = v; $('#hdrSpeed').value = String(v); } }));
    items.push({ head: 'Not sure what these do?' });
    items.push({ label: 'Walk me through each scenario…', fn: () => M.onboard.show() });
    ui.menu(e.currentTarget, items);
  };
  $('#hdrSpeed').onchange = (e) => { sim.speed = +e.target.value; };
  $('#hdrTour').onclick = () => M.onboard && M.onboard.show();

  function refresh() { if (!S.user || !mounted) return; const root = $('#screen'); ui.keepScroll(root, () => mounted.update(root)); chrome(); }
  ui.refresh = refresh;

  // ---- Start ---------------------------------------------------------------------------------
  sim.init();
  renderLogin();

  // Deep link for rehearsal: #user=test.eng&screen=yield&st=A1&fault=wear,dev&speed=600&sn=SN26-104300
  const q = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  if (q.speed) { sim.speed = +q.speed; $('#hdrSpeed').value = q.speed; }
  if (q.fault) q.fault.split(',').forEach((f) => sim.inject(f));
  if (q.adv) sim.tick(+q.adv * 60000 / sim.speed);      // advance the clock by N simulated minutes
  if (q.st) S.st = q.st;
  if (q.sn) S.sn = q.sn;
  if (q.screen) S.screen = q.screen;
  if (q.user) enter(M.USERS.find((u) => u.u === q.user) || M.USERS[1]);
  // …&tour=3 opens the walkthrough at step 3; …&scenario=wear&step=2 runs a scenario.
  if (S.user && q.tour) M.tour.walk(+q.tour - 1);
  if (S.user && q.scenario) M.tour.scenario(q.scenario, (+q.step || 1) - 1);

  let last = performance.now(), n = 0;
  setInterval(() => {
    const now = performance.now();
    sim.tick(Math.min(1000, now - last));
    last = now;
    if (!S.user) return;
    n++;
    header();
    // Factory live moves every second; the analytics every three, which is plenty for a chart.
    if (S.screen === 'live' || S.screen === 'pipeline' || n % 3 === 0) refresh();
    else { rail(); status(); }
  }, 1000);
})(globalThis.M = globalThis.M || {});
