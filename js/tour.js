// Guided walkthroughs. One spotlight at a time, with what you are looking at and why it matters.
//
// The walkthrough goes screen by screen, starting on Yield & Pareto. Each scenario injects one of
// the Demo ▾ faults, moves the factory clock on until the fault has something to show, then visits
// every screen where it appears and ends with the fix.
(function (M) {
  const ui = M.ui, sim = M.sim, MIN = 60000;

  // Moves the factory clock on by simulated minutes, whatever the speed setting.
  function advance(min) { sim.tick(min * MIN / sim.speed); }

  // A scenario needs production running for the next few hours. If that would run into the night
  // (no shifts 22:00–06:00), go to 06:30 first so the fault does not age with nobody testing.
  function toShift(needMin) {
    const d = new Date(sim.now), h = d.getHours() + d.getMinutes() / 60;
    if (h >= 6 && h + needMin / 60 <= 21.5) return;
    const t = new Date(sim.now);
    if (h >= 6) t.setDate(t.getDate() + 1);
    t.setHours(6, 30, 0, 0);
    advance((t.getTime() - sim.now) / MIN);
  }

  function prep(kind, minutes) {
    const on = kind === 'offline' ? !sim.coll.A2.online : !!sim.fault[kind];
    if (!on) { toShift(minutes); sim.inject(kind); advance(minutes); }
    ui.state.range = 24 * 3600000;
  }

  const meas = (st, mid) => ({ st, mst: st, mid, midFor: st });

  // ---- The walkthrough ---------------------------------------------------------------------------
  const WALK = [
    { screen: 'floor', st: null, sel: '#flWrap', title: 'The factory at a glance',
      text: 'An invented electronics factory: three product lines, nine testers, a server room and an engineering office. Each tester has a status light and a label with the unit it is testing and its first-pass yield today. The blue dashed lines are results travelling from each tester’s collector to the central store.',
      why: 'Click any tester for its yield, the server room for the data pipeline, the office for BI exports. Every scenario in the Guide shows up here too.' },
    { screen: 'yield', st: null, sel: '#yStats', title: 'Two yields, told honestly',
      text: '<b>Reported final yield</b> is what most lines quote: a unit that fails, is retested and passes counts as a pass. <b>True first-pass yield</b> counts first attempts only. The gap between them is retest time, paid for on every shift.',
      why: 'Rolled throughput yield multiplies first-pass yield along the route. Three stations at 96–98% each give about 92% for the sensor node, while the line reports close to 100%.' },
    { screen: 'yield', st: null, sel: '#yTs', panel: true, title: 'The gap, over time',
      text: 'Green is first attempts only; the dashed line is after retests. Change the range at the top right to see a whole week. The dip five days back is a fixture that wore out and was replaced.',
      why: 'Only possible if a retest is stored as a new run. If a tester overwrites the failed result, first-pass yield cannot be calculated at all.' },
    { screen: 'yield', st: null, sel: '#yNff', panel: true, title: 'No fault found',
      text: 'Most failures here pass on a plain retest, with no repair. That is a contact, a fixture or a marginal limit: a <b>station</b> problem that looks like a product problem.',
      why: 'No-fault-found is the cheapest yield there is to win back, and it is invisible in final yield.' },
    { screen: 'yield', st: null, sel: '#yPar', panel: true, title: 'Where the failures are',
      text: 'Failed runs by test step, across every station, with the cumulative line. Blue bars are measurements out of limits; purple are pass/fail steps.',
      why: 'One query across all testers. Today that usually means opening nine folders of files.' },
    { screen: 'yield', st: null, sel: '#yTbl', panel: true, title: 'By station',
      text: 'First-pass, final yield, NFF and the top failure for each station. Click a row and every chart on this screen filters to that station; click it again for the whole factory. The station rail on the left does the same on every screen.',
      why: 'Where to look first, in one table.' },
    { screen: 'live', st: null, sel: '#lvCards', title: 'Factory live',
      text: 'One card per tester: what it is testing now, units in the last hour, first-pass yield today and its collector queue. The badge says how results leave the station: a TestStand plug-in, a LabVIEW library, or a watcher on a tester that only drops files.',
      why: 'Three kinds of tester, one result model. That is the part most factories are missing.' },
    { screen: 'live', st: null, sel: '#lvFeed', panel: true, title: 'Alerts come from the data',
      text: 'The monitor watches every result as it lands: capability falling, yield dropping, an unreleased version, a collector holding results. Alerts badge the ribbon and colour the station.',
      why: 'In a real system these go to Grafana alerting, and from there to email or Teams.' },
    { screen: 'meas', ...meas('A3', 'txPow'), sel: '#mStats', title: 'Every measurement, as a distribution',
      text: 'Pick a station and a measured step. Cpk over the window and over the last 60 units side by side: when the recent figure falls, something changed.',
      why: 'Opening a station shows its least capable measurement first, so a problem is on screen before you look for it.' },
    { screen: 'meas', ...meas('A3', 'txPow'), sel: '#mSpc', panel: true, title: 'Control limits are not specification limits',
      text: 'Every result in order, with ±3σ control limits (amber) and the specification limits (red). A run of eight on one side of the centre line is flagged.',
      why: 'The limit says whether a unit is good. The control chart says whether the process changed. A fixture can drift for days inside its limits.' },
    { screen: 'meas', ...meas('A3', 'txPow'), sel: '#mCmp', panel: true, title: 'Same test, different stations',
      text: 'A3 and A4 run the same sequence on the same boards. Side by side, an instrument or fixture offset shows as bias long before either station fails anything.',
      why: 'The calibration scenario in the Guide shows this going wrong.' },
    { screen: 'trace', st: null, sel: '#tUnit', panel: true, title: 'One serial, everything that happened',
      text: 'Every run, retest and repair for a unit, in order. Click a run for its steps, its values against limits, the instruments with their calibration dates, the operator, the fixture, and the sequence version with its source-control hash. Try the example buttons at the top.',
      why: 'What a quality engineer needs when a unit comes back from the field.' },
    { screen: 'trace', st: null, sel: '#tCont', panel: true, title: 'Containment',
      text: 'Every unit a given sequence version or instrument touched in the last seven days, how many have already passed the whole route, and the list as CSV.',
      why: 'The question an audit or a customer complaint asks. Here it takes one click instead of a week.' },
    { screen: 'registry', st: null, sel: '#rSt', panel: true, title: 'Released against deployed',
      text: 'Released versions come from your release process. Deployed versions are read from each result as it arrives, so nobody has to report them. Fixture contact counts and the next calibration date sit on the same row.',
      why: 'Your developers keep writing and releasing the tests. This watches the process; it does not replace it.' },
    { screen: 'pipeline', st: null, sel: '#pFlow', panel: true, title: 'Local first, then networked',
      text: 'Tester → collector with a local queue → central store on site → Grafana, Power BI and notebooks. A tester never waits for the server to finish a test.',
      why: 'Stations can start collecting before the network reaches them. The storage panel below works out how little space it needs.' },
    { screen: 'pipeline', st: null, sel: '#pColl', panel: true, title: 'Take a link down yourself',
      text: 'Each collector has a button here. Take one down and its queue fills on the tester; restore it and the results back-fill into the store, in time order. Nothing is lost.',
      why: 'The data pipeline scenario in the Guide walks through this.' },
    { screen: 'export', st: null, sel: '#xList', panel: true, title: 'Handing off to the business',
      text: 'Published SQL views for Power BI, Excel and notebooks, each with its definition, refresh and a CSV download.',
      why: 'One agreed shape per question, so no team writes its own fragile query against the raw tables.' },
    { screen: 'live', st: null, sel: '#hdrDemo', title: 'Now break something',
      text: 'The <b>Demo ▾</b> menu injects five faults a real factory meets: a worn fixture, an instrument out of calibration, a bad component lot, an unreleased test build and a network outage. Each one shows up on different screens.',
      why: 'Press <b>? Guide</b> any time for a guided walk through each of them.', end: 'scenarios' },
  ];

  // ---- The scenarios ------------------------------------------------------------------------------
  const SCEN = {
    wear: {
      title: 'Fixture wear', start: () => prep('wear', 180), fix: ['Replace the fixture', () => sim.repair('wear')],
      steps: [
        { screen: 'live', st: null, sel: '#lvFeed', panel: true, title: 'What we just did',
          text: 'ICT fixture <b>FX-ICT-03</b> on station A1 starts to wear: its probes make poorer contact, so the measured contact resistance creeps up and worn pins cause occasional opens. The factory clock has moved on three hours.',
          why: 'In the event log: the demo action, then the alerts the monitor raised on its own.' },
        { screen: 'meas', ...meas('A1', 'rCont'), sel: '#mStats', title: 'Capability falls first',
          text: 'Probe contact on A1. Cpk over the last 60 units has dropped well below the whole window, and the monitor has raised an alert. Very few units have failed this measurement yet.',
          why: 'This is the early warning. Yield has not moved.' },
        { screen: 'meas', ...meas('A1', 'rCont'), sel: '#mSpc', panel: true, title: 'The control chart sees the drift',
          text: 'The points climb out of the amber control limits and towards the red 300 mΩ specification limit. The run-of-eight rule fires.',
          why: 'Specification limits would only catch it after units started failing.' },
        { screen: 'yield', st: 'A1', sel: '#yStats', title: 'Why nobody noticed',
          text: 'The intermittent opens mostly pass on a plain retest, so final yield stays high and no-fault-found rises. Operators retest and move on.',
          why: 'Final yield hides a worn fixture for days. First-pass yield and NFF do not.' },
        { screen: 'meas', ...meas('A1', 'rCont'), sel: '#mSpc', panel: true, title: 'The fix', fixStep: true,
          text: 'Replace the fixture with the button below and watch the readings fall back to nominal. A real system would also count fixture contacts, so the replacement is planned on a count instead of on a failure.',
          why: 'Set the speed to ×600 in the header to see the recovery quickly.' },
      ],
    },
    cal: {
      title: 'Instrument out of calibration', start: () => prep('cal', 150), fix: ['Recalibrate the meter', () => sim.repair('cal')],
      steps: [
        { screen: 'live', st: null, sel: '#lvFeed', panel: true, title: 'What we just did',
          text: 'The DMM on station A4, <b>DMM-0388</b>, now reads 11 mV high, and its calibration ran out on 1 October. A3 and A4 test the same boards, with the same sequence and the same ±25 mV limits. The clock has moved on 2½ hours.',
          why: 'Nothing has failed. That is the problem.' },
        { screen: 'meas', ...meas('A4', 'vBat'), sel: '#mStats', title: 'On its own, A4 looks almost fine',
          text: 'Battery monitor error on A4: nearly every unit still passes. The mean has moved off nominal and Cpk is lower, but nothing on A4’s own pass/fail would make anyone look.',
          why: 'An offset inside the limits passes units that should not pass, and fails units that should.' },
        { screen: 'meas', ...meas('A4', 'vBat'), sel: '#mCmp', panel: true, title: 'Side by side, it is obvious',
          text: 'The same measurement on A3 and A4, latest 100 results each. A4 is biased against the pooled mean, shown in red, and the instrument column names the meter.',
          why: 'Station-to-station comparison needs every tester in one store. On separate PCs it is invisible.' },
        { screen: 'registry', st: null, sel: '#rCal', panel: true, title: 'And the calibration is overdue',
          text: 'DMM-0388 is listed as overdue. Every result records which instruments measured it, so the date is joined to the data, not kept in a separate spreadsheet.',
          why: 'Results measured by an overdue instrument are suspect from that date, whatever they read.' },
        { screen: 'trace', st: null, state: { cq: 'inst:A4:DMM-0388' }, sel: '#tCont', panel: true, title: 'Which units did it measure?', fixStep: true,
          text: 'Containment by instrument: every unit DMM-0388 measured, how many have already shipped through the route, and the CSV for quality to act on. Recalibrate it with the button below.',
          why: 'A real system would filter from the last good calibration date. The question is the same.' },
      ],
    },
    lot: {
      title: 'Component-lot shift', start: () => prep('lot', 180), fix: ['Go back to lot L-2602', () => sim.repair('lot')],
      steps: [
        { screen: 'live', st: null, sel: '#lvFeed', panel: true, title: 'What we just did',
          text: 'Power modules are now built from component lot <b>L-2619</b>. Its parts cost about 1.1 points of efficiency at full load. Nothing on the test line changed. The clock has moved on three hours.',
          why: 'Lot codes are recorded against every unit, so every result knows its lot.' },
        { screen: 'meas', ...meas('B2', 'eff'), sel: '#mHistP', title: 'The distribution moves',
          text: 'Efficiency at full load on B2. A second hump has appeared close to the 91.5 % lower limit. Most of those units still pass.',
          why: 'Margin is gone before yield is.' },
        { screen: 'meas', ...meas('B2', 'eff'), sel: '#mLot', panel: true, title: 'Split by lot',
          text: 'The same results by component lot. L-2619 sits a point lower with a much poorer Cpk, while the old lots are unchanged.',
          why: 'This table is for design engineering: evidence for the supplier and for the next revision, not only a production problem.' },
        { screen: 'export', st: null, state: { ds: 'step_results' }, sel: '#xDef', panel: true, title: 'Take it further', fixStep: true,
          text: 'Design engineers pull <b>bi.step_results</b> into a notebook or Power BI and join it with incoming inspection. Go back to the old lot with the button below.',
          why: 'Production test data is the largest dataset a design team ever gets about its own product.' },
      ],
    },
    dev: {
      title: 'Unreleased test build', start: () => prep('dev', 120), fix: ['Put A3 back on 3.2.0', () => sim.repair('dev')],
      steps: [
        { screen: 'live', st: null, sel: '#lvFeed', panel: true, title: 'What we just did',
          text: 'Someone copied a development build of the functional test, <b>3.2.1-dev</b>, onto station A3, perhaps to try a fix. It runs and units pass. The clock has moved on two hours.',
          why: 'It happens in every factory that writes its own tests. The question is whether anyone can tell.' },
        { screen: 'floor', st: null, sel: '#flWrap', title: 'On the floor',
          text: 'A3’s light has gone red and its label says <b>unreleased build 3.2.1-dev</b>. Units are still flowing through it and on down the line.',
          why: 'Nothing on the station itself looks wrong. The data says so.' },
        { screen: 'registry', st: null, sel: '#rSt', panel: true, title: 'Seen from the first result',
          text: 'A3 shows <b>NOT RELEASED</b>: deployed 3.2.1-dev with a hash nobody released. Nobody reported it. The collector writes the version and source-control hash into every result.',
          why: 'Click a row here and it opens the containment query for that version.' },
        { screen: 'trace', st: null, state: { cq: 'ver:A3:3.2.1-dev' }, sel: '#tCont', panel: true, title: 'Every unit it tested', fixStep: true,
          text: 'Containment by sequence version: every unit tested by the unreleased build, and how many have already passed the whole line. Export the list for quality, then put A3 back on the released build with the button below.',
          why: 'Whether an unreleased version is refused, flagged or allowed is a policy decision. This makes it possible to enforce.' },
      ],
    },
    offline: {
      title: 'Network outage', start: () => prep('offline', 60), fix: null,
      steps: [
        { screen: 'floor', st: null, sel: '#flWrap', title: 'What we just did',
          text: 'Station A2’s network link went down an hour ago. On the floor its cable has gone grey and results are piling up beside the tester, while the calibration station keeps testing.',
          why: 'Testing never waits for the server. The central store’s label counts what is still on the testers.' },
        { screen: 'pipeline', st: null, sel: '#pColl', panel: true, title: 'Queued, not lost',
          text: 'A2 is offline with its queue filling. The status strip at the bottom counts results held on testers. In the store, A2 simply goes quiet.',
          why: 'This is also how a tester that has never been networked starts: collecting locally from day one.' },
        { screen: 'pipeline', st: null, sel: '#pRate', panel: true, title: 'Link restored', enter: () => sim.setOnline('A2', true),
          text: 'We have just restored the link. The queue drained into the store in one go, so it shows as a spike in arrivals. The results keep their test times, so every chart back-fills in order.',
          why: 'For areas that are never networked, the same collector writes a signed export for removable media.' },
      ],
    },
  };
  M.SCENARIOS = [
    ['wear', 'Fixture wear', 'A test fixture wears out on the ICT station', 'Measurements catches it before yield moves'],
    ['cal', 'Instrument out of calibration', 'A meter on one functional tester reads high', 'Station comparison and calibration records'],
    ['lot', 'Component-lot shift', 'A new component lot lowers power-module efficiency', 'Distributions split by lot, for design'],
    ['dev', 'Unreleased test build', 'A development build of a test is deployed to one station', 'Version registry and containment'],
    ['offline', 'Network outage', 'One station loses its network link', 'Local queue, then back-fill'],
  ];

  // ---- The spotlight ------------------------------------------------------------------------------
  let steps = null, i = -1, hole, card, timer, scen = null;

  function show(n) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    const s = steps[i];
    if (s.state) Object.assign(ui.state, s.state);
    if (s.mst) Object.assign(ui.state, { mst: s.mst, mid: s.mid, midFor: s.midFor });
    if (s.enter && !s.entered) { s.entered = true; s.enter(); }
    ui.go(s.screen, s.st === undefined ? ui.state.st : s.st);
    setTimeout(place, 60); setTimeout(place, 400);
  }

  function target() {
    const s = steps[i];
    let el = document.querySelector(s.sel);
    if (el && s.panel) el = el.closest('.pn') || el;
    return el;
  }

  function place() {
    if (i < 0) return;
    const s = steps[i], el = target();
    if (!el) return;
    if (!place.scrolled) { el.scrollIntoView({ block: 'nearest' }); place.scrolled = true; }
    const rc = el.getBoundingClientRect(), pad = 4, vh = window.innerHeight, vw = window.innerWidth;
    const top = Math.max(2, rc.top - pad), left = Math.max(2, rc.left - pad);
    const h = Math.max(0, Math.min(vh - top - 2, rc.bottom + pad - top)), w = Math.min(vw - left - 2, rc.width + pad * 2);
    Object.assign(hole.style, { top: top + 'px', left: left + 'px', width: w + 'px', height: h + 'px' });

    if (card.dataset.i !== String(i)) {
      card.dataset.i = String(i);
      const last = i === steps.length - 1;
      const fix = s.fixStep && scen && scen.fix;
      card.innerHTML = `<div class="h"><span class="tag">${scen ? 'Scenario · ' + scen.title : 'Walkthrough'}</span>${s.title}</div>
        <div class="b">${s.text}<div class="why">${s.why}</div></div>
        <div class="f"><span class="count">${i + 1} / ${steps.length}</span><span class="sp"></span>
          <button class="btn sm" data-t="stop">Close</button>
          <button class="btn sm" data-t="prev" ${i === 0 ? 'disabled' : ''}>Back</button>
          ${fix ? `<button class="btn sm" data-t="fix">${scen.fix[0]}</button>` : ''}
          <button class="btn sm primary" data-t="next">${last ? (s.end === 'scenarios' ? 'Show the scenarios' : 'Finish') : 'Next'}</button></div>`;
    }
    const cw = Math.min(380, vw - 16), chh = card.offsetHeight || 240;
    let cy = rc.bottom + 12;
    if (cy + chh > vh - 8) cy = rc.top - chh - 12;
    if (cy < 8) cy = Math.max(8, vh - chh - 8);          // tall target: sit the card at the bottom
    let cx = rc.width > vw * 0.5 ? rc.left + rc.width / 2 - cw / 2 : rc.left;
    cx = Math.max(8, Math.min(vw - cw - 8, cx));
    Object.assign(card.style, { top: cy + 'px', left: cx + 'px', width: cw + 'px' });
  }

  function start(list, at, sc) {
    stop();
    steps = list.map((s) => Object.assign({}, s)); scen = sc || null;
    hole = document.createElement('div'); hole.className = 'tour-hole';
    card = document.createElement('div'); card.className = 'tour-card';
    card.onclick = (e) => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      const t = b.dataset.t;
      if (t === 'stop') stop();
      if (t === 'prev') go(i - 1);
      if (t === 'fix') { scen.fix[1](); ui.toast(scen.fix[0] + ' — done'); b.disabled = true; ui.refresh(); }
      if (t === 'next') {
        if (i < steps.length - 1) return go(i + 1);
        const end = steps[i].end; stop();
        if (end === 'scenarios') M.onboard.show();
      }
    };
    document.body.append(hole, card);
    window.addEventListener('resize', place);
    document.addEventListener('keydown', keys);
    timer = setInterval(place, 1000);                       // screens re-render as the factory runs
    go(at || 0);
  }
  function go(n) { place.scrolled = false; show(n); }
  function stop() {
    if (hole) hole.remove();
    if (card) card.remove();
    clearInterval(timer);
    hole = card = steps = scen = null; i = -1;
    window.removeEventListener('resize', place);
    document.removeEventListener('keydown', keys);
  }
  function keys(e) {
    if (e.key === 'Escape') stop();
    if (e.key === 'ArrowRight' && i < steps.length - 1) go(i + 1);
    if (e.key === 'ArrowLeft' && i > 0) go(i - 1);
  }

  function scenario(kind, at) {
    const sc = SCEN[kind]; if (!sc) return;
    sc.start();
    ui.refresh();
    start(sc.steps, at, sc);
  }

  M.tour = { walk: (at) => start(WALK, at), scenario, stop, active: () => i >= 0 };
})(globalThis.M = globalThis.M || {});
