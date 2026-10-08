// Demonstration data for an electronics factory's production test.
// Entirely invented: no customer, no real product, no real line. Round generic numbers only.
(function (M) {
  // ---- Products and lines ---------------------------------------------------
  // Three families chosen to show both ends of electronics test: seconds-per-unit volume, and
  // low-volume serialised assemblies with long burn-in and full traceability.
  M.PRODUCTS = [
    { id: 'SN', name: 'Sensor node PCBA', short: 'Sensor node', part: 'SN-210', rev: 'C', prefix: 'SN26-', perHour: 90,
      route: ['A1', 'A2', ['A3', 'A4']], lots: ['L-2604', 'L-2607'] },
    { id: 'PM', name: 'DC-DC power module', short: 'Power module', part: 'PM-48', rev: 'B', prefix: 'PM26-', perHour: 20,
      route: ['B1', 'B2'], lots: ['L-2588', 'L-2602'] },
    { id: 'IO', name: 'I/O controller assembly', short: 'I/O controller', part: 'IOC-7', rev: 'A', prefix: 'IOC26-', perHour: 1,
      route: ['C1', 'C2', 'C3'], lots: ['L-2571'] },
  ];
  M.prodById = Object.fromEntries(M.PRODUCTS.map((p) => [p.id, p]));

  // ---- Measurements -----------------------------------------------------------
  // [id, name, unit, nominal, sigma, lsl, usl, dp]. Each station tracks a few measured steps;
  // the remaining steps are pass/fail only and carry a small failure rate of their own.
  const m = (id, name, unit, nom, sd, lsl, usl, dp) => ({ id, name, unit, nom, sd, lsl, usl, dp });

  // src: how results leave the station. 'ts' TestStand result processing, 'lv' LabVIEW results
  // library, 'file' a vendor tester that only drops files, parsed by a watcher.
  M.STATIONS = [
    { id: 'A1', prod: 'SN', name: 'ICT', long: 'In-circuit test', src: 'file', dur: 25, seq: 'ICT program SN-210', rel: '14', fixture: 'FX-ICT-03', fixLife: 50000,
      inst: [['ICT-07', 'In-circuit tester', '2027-01-20']],
      meas: [m('rPull', 'R12 pull-up', 'kΩ', 10, 0.12, 9.5, 10.5, 2), m('cDec', 'C7 decoupling', 'nF', 100, 2.4, 90, 110, 1), m('rCont', 'Probe contact', 'mΩ', 180, 14, null, 300, 0)],
      other: [['shorts', 'Shorts and opens', 0.022], ['diode', 'Diode orientation', 0.003]] },
    { id: 'A2', prod: 'SN', name: 'Calibration', long: 'Sensor calibration', src: 'lv', dur: 40, seq: 'SensorCal.lvproj', rel: '2.6.0', fixture: 'FX-CAL-01', fixLife: 100000,
      inst: [['REF-112', 'Reference sensor', '2027-03-02'], ['DMM-0233', '6½-digit DMM', '2026-12-14']],
      meas: [m('offPre', 'Offset before cal', 'mV', 4, 2.4, -15, 15, 2), m('gain', 'Gain coefficient', '', 1.0, 0.012, 0.95, 1.05, 4), m('errPost', 'Error after cal', '%', 0, 0.12, -0.5, 0.5, 3)],
      other: [['write', 'Write coefficients', 0.012], ['seal', 'Chamber seal check', 0.008]] },
    { id: 'A3', prod: 'SN', name: 'Functional 1', long: 'Functional test, bay 1', src: 'ts', dur: 55, seq: 'FCT_SN210.seq', rel: '3.2.0', fixture: 'FX-FCT-11', fixLife: 30000,
      inst: [['DMM-0417', '6½-digit DMM', '2027-02-08'], ['RF-020', 'RF power meter', '2026-11-30']],
      meas: [m('iSleep', 'Sleep current', 'µA', 12, 1.1, null, 18, 1), m('txPow', 'Radio TX power', 'dBm', 8, 0.35, 6.5, 9.5, 2), m('vBat', 'Battery monitor error', 'mV', 0, 5, -25, 25, 1)],
      other: [['prog', 'Firmware programming', 0.012], ['link', 'Radio link', 0.018]] },
    { id: 'A4', prod: 'SN', name: 'Functional 2', long: 'Functional test, bay 2', src: 'ts', dur: 55, seq: 'FCT_SN210.seq', rel: '3.2.0', fixture: 'FX-FCT-12', fixLife: 30000,
      inst: [['DMM-0388', '6½-digit DMM', '2027-01-11'], ['RF-021', 'RF power meter', '2026-12-05']],
      meas: [m('iSleep', 'Sleep current', 'µA', 12, 1.1, null, 18, 1), m('txPow', 'Radio TX power', 'dBm', 8, 0.35, 6.5, 9.5, 2), m('vBat', 'Battery monitor error', 'mV', 0, 5, -25, 25, 1)],
      other: [['prog', 'Firmware programming', 0.012], ['link', 'Radio link', 0.018]] },
    { id: 'B1', prod: 'PM', name: 'Hipot', long: 'Hipot and insulation', src: 'file', dur: 30, seq: 'Hipot program PM-48', rel: '5', fixture: 'FX-HP-02', fixLife: 40000,
      inst: [['HPT-005', 'Hipot tester', '2026-12-20']],
      meas: [m('iLeak', 'Leakage at 1.5 kV', 'µA', 2.1, 0.35, null, 5, 2), m('rIso', 'Insulation resistance', 'GΩ', 18, 3, 1, null, 1)],
      other: [['arc', 'Arc detect', 0.012]] },
    { id: 'B2', prod: 'PM', name: 'Power test', long: 'Power and regulation', src: 'ts', dur: 120, seq: 'PWR_PM48.seq', rel: '1.9.2', fixture: 'FX-PWR-05', fixLife: 20000,
      inst: [['LOAD-03', 'Electronic load', '2027-02-17'], ['DMM-0291', '6½-digit DMM', '2027-01-04'], ['SCOPE-09', 'Oscilloscope', '2027-04-01']],
      meas: [m('eff', 'Efficiency at full load', '%', 93.2, 0.3, 91.5, null, 2), m('reg', 'Load regulation', '%', 0.25, 0.06, null, 0.5, 3), m('ripple', 'Output ripple', 'mVpp', 32, 4, null, 60, 1)],
      other: [['startup', 'Start-up sequence', 0.014], ['ocp', 'Over-current trip', 0.009]] },
    { id: 'C1', prod: 'IO', name: 'Functional', long: 'Board functional test', src: 'ts', dur: 900, seq: 'FCT_IOC7.seq', rel: '2.1.0', fixture: 'FX-IOC-01', fixLife: 5000,
      inst: [['DMM-0502', '6½-digit DMM', '2027-03-10'], ['CAL-014', 'Process calibrator', '2027-02-26']],
      meas: [m('rail33', '3.3 V rail', 'V', 3.30, 0.012, 3.20, 3.40, 3), m('aiErr', 'Analog input error', '%FS', 0, 0.02, -0.1, 0.1, 3), m('loopMs', 'Comms loopback latency', 'ms', 1.8, 0.15, null, 3, 2)],
      other: [['io', 'Digital I/O walk', 0.03]] },
    { id: 'C2', prod: 'IO', name: 'Burn-in', long: 'Burn-in chamber, 8 slots', src: 'lv', dur: 48 * 3600, seq: 'BurnIn.lvproj', rel: '1.4.1', fixture: 'CH-BI-01', fixLife: 2000,
      inst: [['TC-LOG-02', 'Temperature logger', '2027-01-29']],
      meas: [m('tMax', 'Peak board temperature', '°C', 71, 1.5, null, 85, 1), m('railDev', 'Rail deviation over run', 'mV', 9, 3, null, 30, 1)],
      other: [['reset', 'Unexpected reset', 0.02]] },
    { id: 'C3', prod: 'IO', name: 'Acceptance', long: 'Acceptance test', src: 'ts', dur: 1800, seq: 'ATP_IOC7.seq', rel: '2.0.3', fixture: 'FX-IOC-02', fixLife: 5000,
      inst: [['DMM-0502', '6½-digit DMM', '2027-03-10'], ['ISO-001', 'Insulation tester', '2027-02-02']],
      meas: [m('rail33', '3.3 V rail', 'V', 3.30, 0.012, 3.20, 3.40, 3), m('resp', 'Output response time', 'ms', 4.2, 0.3, null, 6, 2), m('isoC3', 'Isolation', 'GΩ', 40, 6, 5, null, 1)],
      other: [['func', 'Full functional sweep', 0.025]] },
  ];
  M.stById = Object.fromEntries(M.STATIONS.map((s) => [s.id, s]));

  // Released sequence versions and their source-control hashes. A station's deployed version is
  // read from the result itself, so a mismatch is visible the moment one result arrives.
  M.HASH = { '14': 'a71f3c2', '2.6.0': '5d0e8b1', '3.2.0': 'c93a17f', '5': '0be4d92', '1.9.2': '7f21c6a', '2.1.0': '3ac9e05', '1.4.1': 'e8d2b47', '2.0.3': '91f0a3d' };

  M.SRC = { ts: 'TestStand', lv: 'LabVIEW', file: 'File drop' };

  // A one-sided specification has null for the missing limit. Compare explicitly: in JavaScript
  // `v > null` is `v > 0`, which would fail every reading.
  M.outOfLimits = (v, mm) => (mm.lsl != null && v < mm.lsl) || (mm.usl != null && v > mm.usl);

  M.USERS = [
    { u: 'viewer', name: 'Factory viewer', role: 'Viewer' },
    { u: 'test.eng', name: 'Test engineer', role: 'Engineer' },
    { u: 'quality', name: 'Quality engineer', role: 'Quality' },
    { u: 'ops.mgr', name: 'Operations manager', role: 'Manager' },
  ];
  M.OPS = ['op-01', 'op-02', 'op-03', 'op-04', 'op-05', 'op-06'];

  // Two production shifts, 06:00 to 22:00. Nights are quiet; burn-in keeps running.
  M.shiftFactor = (d) => { const h = d.getHours(); return h >= 6 && h < 22 ? 1 : 0; };
})(globalThis.M = globalThis.M || {});
