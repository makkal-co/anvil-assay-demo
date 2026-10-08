// The simulated factory. An event queue moves every unit through its line: test, retest on a
// failure, repair after two, scrap if a repaired unit still fails. Seven days of history are
// generated at load by running the same engine fast, so the charts have something to say.
//
// Each result is held in its station's collector queue and only reaches the central store when
// the collector is online. Every analytic reads the central store, so a station that drops off
// the network goes quiet on the dashboards and back-fills when it returns.
(function (M) {
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;

  // Seeded so the history is the same on every load; screenshots and rehearsals stay stable.
  let seed = 20261007;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pick = (a) => a[Math.floor(rnd() * a.length)];

  // ---- Binary heap of events ordered by time ---------------------------------
  const heap = [];
  function push(ev) { heap.push(ev); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p].t <= heap[i].t) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } }
  function pop() { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; if (l < heap.length && heap[l].t < heap[s].t) s = l; if (r < heap.length && heap[r].t < heap[s].t) s = r; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; }

  const S = {
    MIN, HOUR, DAY,
    now: new Date('2026-10-07T10:30:00').getTime(),
    speed: 60,
    runs: [],            // every result, in completion order
    byStation: {},       // station id → results that reached the central store, in time order
    units: {},           // serial → unit
    unitList: [],
    pending: {},         // station id → units under test right now
    coll: {},            // station id → collector state
    deployed: {},        // station id → { ver, hash } as reported by its latest result
    fault: {},           // active injected faults
    events: [],          // the factory's event log, newest first
    alerts: [],          // raised by the monitor
    counters: { SN: 104200, PM: 20380, IO: 160 },
    fixtureCycles: {},
  };
  M.sim = S;

  M.STATIONS.forEach((st) => {
    S.byStation[st.id] = [];
    S.pending[st.id] = [];
    S.coll[st.id] = { online: true, queue: [], lastSync: 0, sent: 0, offlineSince: null };
    S.deployed[st.id] = { ver: st.rel, hash: M.HASH[st.rel] };
    S.fixtureCycles[st.id] = Math.round(st.fixLife * (0.2 + 0.5 * ((st.id.charCodeAt(1) * 7) % 10) / 10));
  });

  function log(t, kind, text, st) { S.events.unshift({ t, kind, text, st }); if (S.events.length > 400) S.events.length = 400; }

  // ---- Fault effects -----------------------------------------------------------
  // A fixture wearing out raises probe contact resistance, then causes intermittent opens. A
  // historical episode five days ago ends when the fixture is replaced, so the history shows one.
  const HIST_WEAR = { t0: 0, t1: 0 };

  function wearAt(t) {
    let w = 0;
    if (t > HIST_WEAR.t0 && t < HIST_WEAR.t1) w = (t - HIST_WEAR.t0) / HOUR * 5;
    if (S.fault.wear) w = Math.max(w, (t - S.fault.wear.t0) / HOUR * 20 + 30);   // visible within minutes at ×60
    return Math.min(w, 220);
  }

  function lotFor(prod, t) {
    const p = M.prodById[prod];
    if (prod === 'PM' && S.fault.lot && t >= S.fault.lot.t0) return 'L-2619';
    return rnd() < 0.85 ? p.lots[p.lots.length - 1] : p.lots[0];
  }

  function measure(st, mm, unit, t) {
    let v = mm.nom + mm.sd * gauss();
    if (st.id === 'A1' && mm.id === 'rCont') v += wearAt(t);
    if (st.id === 'A4' && mm.id === 'vBat' && S.fault.cal) v += 11;
    if (st.id === 'B2' && mm.id === 'eff' && unit.lot === 'L-2619') v -= 1.1;
    if (mm.id === 'rIso' || mm.id === 'isoC3') v = Math.abs(v);
    return v;
  }

  // ---- Units and runs ------------------------------------------------------------
  function newUnit(prod, t) {
    const p = M.prodById[prod];
    const n = ++S.counters[prod];
    const sn = p.prefix + String(n).padStart(prod === 'IO' ? 5 : 6, '0');
    const u = { sn, prod, lot: lotFor(prod, t), created: t, stage: 0, status: 'wip', runs: [], tries: 0, repaired: false };
    S.units[sn] = u; S.unitList.push(u);
    schedule(u, t + rnd() * 4 * MIN);
  }

  let fctToggle = 0;
  function stationFor(u) {
    const r = M.prodById[u.prod].route[u.stage];
    if (Array.isArray(r)) return r[(fctToggle++) % r.length];
    return r;
  }

  function schedule(u, start) {
    const st = M.stById[stationFor(u)];
    const dur = st.dur * (0.9 + 0.2 * rnd()) * 1000;
    const ev = { t: start + dur, start, u, st: st.id, dur };
    S.pending[st.id].push(ev);
    push(ev);
  }

  function run(ev) {
    const st = M.stById[ev.st], u = ev.u, t = ev.t;
    S.pending[st.id] = S.pending[st.id].filter((x) => x !== ev);
    u.tries++;
    const vals = st.meas.map((mm) => measure(st, mm, u, t));
    let fail = null;
    st.meas.some((mm, i) => { if (M.outOfLimits(vals[i], mm)) { fail = mm.id; return true; } return false; });
    if (!fail) {
      for (const [id, , p] of st.other) {
        let pf = p;
        if (st.id === 'A1' && id === 'shorts') pf += wearAt(t) / 1400;   // worn pins: intermittent opens
        if (rnd() < pf) { fail = id; break; }
      }
    }
    const dep = (S.fault.dev && st.id === 'A3') ? { ver: '3.2.1-dev', hash: 'e41c09a' } : { ver: st.rel, hash: M.HASH[st.rel] };
    S.deployed[st.id] = dep;
    const hr = new Date(t).getHours();
    const r = {
      id: S.runs.length + 1, t, st: st.id, sn: u.sn, prod: u.prod, att: u.tries, rep: u.repaired,
      pass: !fail, fail, dur: ev.dur / 1000, v: vals, ver: dep.ver, hash: dep.hash,
      op: M.OPS[(hr >= 14 ? 3 : 0) + (u.sn.charCodeAt(u.sn.length - 1) % 3)], fix: st.fixture, lot: u.lot,
      inst: st.inst.map((i) => i[0]), synced: false,
    };
    S.runs.push(r); u.runs.push(r);
    S.fixtureCycles[st.id]++;
    const c = S.coll[st.id];
    c.queue.push(r);
    if (c.online) flush(st.id, t);

    if (r.pass) {
      u.tries = 0;
      u.stage++;
      if (u.stage >= M.prodById[u.prod].route.length) { u.status = 'passed'; u.done = t; }
      else schedule(u, t + (2 + rnd() * 8) * MIN);
    } else if (u.tries === 1) {
      schedule(u, t + (2 + rnd() * 4) * MIN);                  // straight retest
    } else if (!u.repaired) {
      u.status = 'repair'; u.repaired = true; u.tries = 0;
      setTimeout0(() => { u.status = 'wip'; }, t + (60 + rnd() * 180) * MIN, u);
    } else {
      u.status = 'scrap'; u.done = t;
      log(t, 'scrap', `${u.sn} scrapped after repair — failed ${stepName(st, fail)} at ${st.id}`, st.id);
    }
  }

  // A repaired unit comes back to the same station after rework.
  function setTimeout0(fn, t, u) { push({ t, fn: () => { fn(); schedule(u, t); } }); }

  function flush(stId, t) {
    const c = S.coll[stId];
    if (!c.queue.length) return;
    c.queue.forEach((r) => { r.synced = true; r.syncAt = t; S.byStation[stId].push(r); });
    if (c.queue.length > 1) S.byStation[stId].sort((a, b) => a.t - b.t);
    c.sent += c.queue.length;
    c.queue = [];
    c.lastSync = t;
  }

  function stepName(st, id) {
    const mm = st.meas.find((x) => x.id === id);
    if (mm) return mm.name;
    const o = st.other.find((x) => x[0] === id);
    return o ? o[1] : id;
  }
  S.stepName = stepName;

  // ---- Arrivals ----------------------------------------------------------------------
  const acc = { SN: 0, PM: 0, IO: 0 };
  // Processes whole minutes from t0 up to t1 and returns the first minute not yet processed.
  function arrivals(t0, t1) {
    let t = t0;
    for (; t < t1; t += MIN) {
      const f = M.shiftFactor(new Date(t));
      if (!f) continue;
      M.PRODUCTS.forEach((p) => {
        acc[p.id] += (p.perHour / 60) * f * (0.85 + 0.3 * rnd());
        while (acc[p.id] >= 1) { acc[p.id] -= 1; newUnit(p.id, t + rnd() * MIN); }
      });
    }
    return t;
  }

  let lastArr = 0;
  function advanceTo(t) {
    if (t > lastArr) lastArr = arrivals(lastArr, t);
    while (heap.length && heap[0].t <= t) {
      const ev = pop();
      if (ev.fn) ev.fn(); else run(ev);
    }
  }

  // ---- Monitor: the alerts a real system would raise -----------------------------------
  function raise(key, sev, st, text, t) {
    const a = S.alerts.find((x) => x.key === key && !x.cleared);
    if (a) { a.text = text; return; }
    S.alerts.unshift({ key, sev, st, text, t, cleared: null });
    log(t, sev === 'R' ? 'alarm' : 'warn', text, st);
  }
  function clear(key, t) {
    const a = S.alerts.find((x) => x.key === key && !x.cleared);
    if (a) { a.cleared = t; log(t, 'ok', 'Cleared — ' + a.text, a.st); }
  }

  function monitor(t) {
    M.STATIONS.forEach((st) => {
      const rs = S.byStation[st.id];
      // Drift: a measurement's recent capability falls well below its long-run capability.
      st.meas.forEach((mm, i) => {
        const recent = M.stats.cpk(lastN(rs, 60).map((r) => r.v[i]), mm);
        const key = 'cpk:' + st.id + ':' + mm.id;
        if (recent != null && recent < 1.0 && rs.length > 60) raise(key, recent < 0.67 ? 'R' : 'Y', st.id, `${st.id} ${mm.name}: Cpk ${recent.toFixed(2)} over the last 60 units — drifting towards a limit`, t);
        else if (recent != null && recent > 1.2) clear(key, t);
      });
      // Version: deployed differs from released.
      const dep = S.deployed[st.id];
      if (dep.ver !== st.rel) raise('ver:' + st.id, 'R', st.id, `${st.id} is running ${st.seq} ${dep.ver} (${dep.hash}) — released version is ${st.rel}`, t);
      else clear('ver:' + st.id, t);
      // Collector.
      const c = S.coll[st.id];
      if (!c.online && c.queue.length) raise('coll:' + st.id, 'Y', st.id, `${st.id} collector offline — ${c.queue.length} results held on the tester, none lost`, t);
      else clear('coll:' + st.id, t);
    });
    // Calibration.
    if (S.fault.cal) raise('cal:DMM-0388', 'R', 'A4', 'A4 DMM-0388 calibration overdue since 1 Oct 2026 — results since then are suspect', t);
    else clear('cal:DMM-0388', t);
    // First-pass yield drop per station, last 2 h against the 7-day figure.
    M.STATIONS.forEach((st) => {
      if (st.id[0] === 'C') return;
      const rs = S.byStation[st.id];
      const recent = M.stats.fpy(rs.filter((r) => r.t > t - 2 * HOUR));
      const base = M.stats.fpy(rs);
      const key = 'fpy:' + st.id;
      if (recent && base && recent.n > 30 && recent.fpy < base.fpy - 0.04) raise(key, 'Y', st.id, `${st.id} first-pass yield ${(recent.fpy * 100).toFixed(1)}% over 2 h, against ${(base.fpy * 100).toFixed(1)}% for the week`, t);
      else if (recent && base && recent.fpy > base.fpy - 0.02) clear(key, t);
    });
  }
  const lastN = (a, n) => a.slice(Math.max(0, a.length - n));

  // ---- Public controls ------------------------------------------------------------------
  S.inject = function (kind) {
    const t = S.now;
    if (kind === 'wear') { S.fault.wear = { t0: t }; log(t, 'demo', 'Demo: ICT fixture FX-ICT-03 starts to wear', 'A1'); }
    if (kind === 'cal') { S.fault.cal = { t0: t }; M.stById.A4.inst[0][2] = '2026-10-01'; log(t, 'demo', 'Demo: A4 DMM-0388 drifts out of calibration', 'A4'); }
    if (kind === 'lot') { S.fault.lot = { t0: t }; M.prodById.PM.lots.push('L-2619'); log(t, 'demo', 'Demo: power modules now built from component lot L-2619', 'B2'); }
    if (kind === 'dev') { S.fault.dev = { t0: t }; log(t, 'demo', 'Demo: someone deploys an unreleased sequence build to A3', 'A3'); }
    if (kind === 'offline') { S.setOnline('A2', false); }
  };
  S.repair = function (kind) {
    const t = S.now;
    if (kind === 'wear') { delete S.fault.wear; S.fixtureCycles.A1 = 0; log(t, 'ok', 'Fixture FX-ICT-03 replaced', 'A1'); }
    if (kind === 'cal') { delete S.fault.cal; M.stById.A4.inst[0][2] = '2027-10-07'; log(t, 'ok', 'DMM-0388 recalibrated', 'A4'); }
    if (kind === 'lot') { delete S.fault.lot; log(t, 'ok', 'Power modules back on lot L-2602', 'B2'); }
    if (kind === 'dev') { delete S.fault.dev; log(t, 'ok', 'A3 back on released FCT_SN210.seq 3.2.0', 'A3'); }
    if (kind === 'offline') S.setOnline('A2', true);
  };
  S.setOnline = function (stId, on) {
    const c = S.coll[stId], t = S.now;
    if (c.online === on) return;
    c.online = on;
    if (!on) { c.offlineSince = t; S.fault.offline = { st: stId, t0: t }; log(t, 'warn', `${stId} network link down — collector keeps queuing locally`, stId); }
    else {
      const n = c.queue.length;
      flush(stId, t); c.offlineSince = null; delete S.fault.offline;
      log(t, 'ok', `${stId} back online — ${n} queued results back-filled into the store`, stId);
    }
  };

  // ---- Clock ---------------------------------------------------------------------------
  let lastMon = 0;
  S.tick = function (dtReal) {
    const target = S.now + dtReal * S.speed;
    // Step in slices so arrivals, collectors and the monitor see time pass in order.
    while (S.now < target) {
      const next = Math.min(target, S.now + 5 * MIN);
      advanceTo(next);
      S.now = next;
      if (S.now - lastMon >= 5 * MIN) { monitor(S.now); lastMon = S.now; }
    }
  };

  S.init = function () {
    const start = S.now - 7 * DAY;
    HIST_WEAR.t0 = start + 2 * DAY + 8 * HOUR;
    HIST_WEAR.t1 = start + 2 * DAY + 30 * HOUR;
    lastArr = start;
    let t = start;
    // Generate history in hour slices, running the monitor so its alert log has a past too.
    while (t < S.now) {
      const next = Math.min(S.now, t + HOUR);
      advanceTo(next);
      if (next >= HIST_WEAR.t1 && next - HOUR < HIST_WEAR.t1) { S.fixtureCycles.A1 = 900; log(HIST_WEAR.t1, 'ok', 'Fixture FX-ICT-03 replaced after intermittent opens', 'A1'); }
      t = next;
      monitor(t);
    }
    lastMon = S.now;
  };

  // Burn-in log for one unit: board temperature and 3.3 V rail, one point a minute for 48 h.
  // Generated from the serial, so it is the same every time it is opened.
  S.burnLog = function (sn) {
    let h = 0; for (const ch of sn) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const g = () => { h = (h * 1103515245 + 12345) | 0; return ((h >>> 8) & 0xffff) / 65536 - 0.5; };
    const temp = [], rail = [];
    for (let i = 0; i <= 48 * 60; i += 5) {
      const cyc = Math.floor(i / 240) % 2;               // 4 h hot, 4 h ambient
      const target = cyc ? 30 : 68;
      const prev = temp.length ? temp[temp.length - 1] : 25;
      const tt = prev + (target - prev) * 0.12 + g() * 0.6;
      temp.push(tt);
      rail.push(3300 + (tt - 45) * 0.12 + g() * 3);
    }
    return { step: 5, temp, rail };
  };
})(globalThis.M = globalThis.M || {});
