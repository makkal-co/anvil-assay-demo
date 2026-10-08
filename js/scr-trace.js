// Traceability: everything that happened to one serial number, and the containment query that
// answers "which units did this software version, or this instrument, test?".
(function (M) {
  const ui = M.ui, esc = ui.esc, sim = M.sim, st = M.stats;

  function examples() {
    const list = sim.unitList;
    const find = (f) => { for (let i = list.length - 1; i >= 0; i--) if (f(list[i])) return list[i].sn; return null; };
    return [
      ['Needed a retest', find((u) => u.runs.some((r) => r.att === 2 && !r.rep) && u.status === 'passed')],
      ['Repaired', find((u) => u.runs.some((r) => r.rep))],
      ['Scrapped', find((u) => u.status === 'scrap')],
      ['I/O controller, burn-in done', find((u) => u.prod === 'IO' && u.runs.some((r) => r.st === 'C2'))],
      ['Just tested', find((u) => u.runs.length && u.prod === 'SN')],
    ].filter((e) => e[1]);
  }

  function download(name, rows) {
    const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : c)).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }
  ui.download = download;

  // Pass/fail steps run after the measured ones, in order; a failure stops the sequence.
  function stepStatus(r, s, id) {
    if (r.pass) return 'Pass';
    if (r.fail === id) return 'Fail';
    if (s.meas.some((m) => m.id === r.fail)) return 'Not run';
    return s.other.findIndex((o) => o[0] === id) < s.other.findIndex((o) => o[0] === r.fail) ? 'Pass' : 'Not run';
  }

  M.screens.trace = {
    mount(root) {
      root.innerHTML = `<div class="toolbar"><span class="ttl">Traceability</span>
          <input id="tSn" placeholder="Serial number, e.g. SN26-104300" style="width:230px" class="mono"><button class="btn primary" id="tGo">Find</button>
          <span class="muted">Try:</span><span id="tEx"></span></div>
        <div class="dash">
          ${ui.panel('c5', 'Unit history', '<div id="tUnit"></div>')}
          ${ui.panel('c7', 'Result', '<div id="tRun"></div>')}
          ${ui.panel('c12', 'Containment', '<div id="tCont"></div>', { sub: 'every unit a suspect version or instrument touched' })}
        </div>`;
      const go = () => { ui.state.sn = root.querySelector('#tSn').value.trim().toUpperCase(); ui.state.runId = null; ui.refresh(); };
      root.querySelector('#tGo').onclick = go;
      root.querySelector('#tSn').onkeydown = (e) => { if (e.key === 'Enter') go(); };
      if (!ui.state.sn) ui.state.sn = (examples()[0] || [])[1];
      root.querySelector('#tSn').value = ui.state.sn || '';
      root.querySelector('#tEx').innerHTML = examples().map(([l, sn]) => `<button class="btn sm" data-sn="${sn}">${esc(l)}</button>`).join(' ');
      root.querySelectorAll('[data-sn]').forEach((b) => (b.onclick = () => { ui.state.sn = b.dataset.sn; ui.state.runId = null; root.querySelector('#tSn').value = b.dataset.sn; ui.refresh(); }));
    },
    update(root) {
      const u = sim.units[ui.state.sn];
      const U = root.querySelector('#tUnit'), R = root.querySelector('#tRun');
      if (!u) {
        U.innerHTML = `<p class="muted">${ui.state.sn ? 'No unit ' + esc(ui.state.sn) + ' in the store.' : 'Enter a serial number.'}</p>`;
        R.innerHTML = '';
      } else {
        const p = M.prodById[u.prod];
        const stBadge = { passed: 'ok', wip: 'idle', repair: 'warn', scrap: 'bad' }[u.status];
        if (!u.runs.some((r) => r.id === ui.state.runId)) ui.state.runId = u.runs.length ? u.runs[u.runs.length - 1].id : null;
        U.innerHTML = `<div class="unit-h"><span class="sn">${esc(u.sn)}</span><span class="badge ${stBadge}">${{ passed: 'Passed', wip: 'In production', repair: 'In repair', scrap: 'Scrapped' }[u.status]}</span></div>
          <div class="muted" style="margin:4px 0 10px">${esc(p.name)} · part ${esc(p.part)} rev ${esc(p.rev)} · component lot <span class="mono">${esc(u.lot)}</span> · started ${ui.dt(u.created)}${u.done ? ' · finished ' + ui.dt(u.done) : ''}</div>
          <div class="tl">${u.runs.map((r) => `<div class="ev ${r.pass ? '' : 'f'} ${r.id === ui.state.runId ? 'on' : ''}" data-run="${r.id}">
            <span class="mono">${ui.dt(r.t).slice(4)}</span><b>${r.st}</b>
            <span>${r.pass ? '<span class="pass">Pass</span>' : '<span class="fail">Fail</span> — ' + esc(sim.stepName(M.stById[r.st], r.fail))}${r.att > 1 || r.rep ? ` <span class="badge ${r.rep ? 'warn' : 'idle'}">${r.rep ? 'after repair' : 'retest ' + (r.att - 1)}</span>` : ''}</span>
            <span class="mono dim">${esc(r.ver)}${r.synced ? '' : ' <span class="badge warn">on tester</span>'}</span></div>`).join('') || '<p class="muted">Not tested yet.</p>'}</div>`;
        U.querySelectorAll('[data-run]').forEach((d) => (d.onclick = () => { ui.state.runId = +d.dataset.run; ui.refresh(); }));

        const r = u.runs.find((x) => x.id === ui.state.runId);
        if (r) {
          const s = M.stById[r.st];
          const verOk = r.ver === s.rel;
          R.innerHTML = `<table class="g" style="margin-bottom:10px"><tbody>
            <tr><td class="muted">Station</td><td><b>${s.id}</b> ${esc(s.long)} ${ui.srcBadge(s.src)}</td><td class="muted">Result</td><td>${r.pass ? '<span class="pass">Pass</span>' : '<span class="fail">Fail</span>'} · attempt ${r.att}${r.rep ? ' after repair' : ''}</td></tr>
            <tr><td class="muted">Sequence</td><td class="mono">${esc(s.seq)} ${esc(r.ver)} <span class="${verOk ? 'dim' : 'fail'}">${esc(r.hash)}</span> ${verOk ? '<span class="badge ok">released</span>' : '<span class="badge bad">not released</span>'}</td><td class="muted">Finished</td><td class="mono">${ui.dt(r.t)} · ${ui.dur(r.dur)}</td></tr>
            <tr><td class="muted">Operator · fixture</td><td class="mono">${esc(r.op)} · ${esc(r.fix)}</td><td class="muted">Collected</td><td>${r.synced ? 'in the central store' : '<span style="color:var(--warn)">queued on the tester</span>'}</td></tr>
            <tr><td class="muted">Instruments</td><td colspan="3" class="mono">${s.inst.filter((i) => r.inst.includes(i[0])).map((i) => `${esc(i[0])} <span class="dim">${esc(i[1])}, cal due ${esc(i[2])}</span>`).join(' · ')}</td></tr>
          </tbody></table>
          <table class="g"><thead><tr><th>Step</th><th class="num">Value</th><th class="num">Limits</th><th>Unit</th><th>Status</th></tr></thead><tbody>
          ${s.meas.map((mm, i) => { const bad = M.outOfLimits(r.v[i], mm); return `<tr><td>${esc(mm.name)}</td><td class="num">${ui.val(r.v[i], mm)}</td><td class="num">${ui.limits(mm)}</td><td>${esc(mm.unit)}</td><td class="${bad ? 'fail' : 'pass'}">${bad ? 'Fail' : 'Pass'}</td></tr>`; }).join('')}
          ${s.other.map(([id, name]) => { const ss = stepStatus(r, s, id); return `<tr><td>${esc(name)}</td><td class="num dim">—</td><td class="num dim">pass/fail</td><td></td><td class="${ss === 'Fail' ? 'fail' : ss === 'Pass' ? 'pass' : 'dim'}">${ss}</td></tr>`; }).join('')}
          </tbody></table>${r.st === 'C2' ? '<div style="margin-top:10px"><div class="muted" style="margin-bottom:4px">Burn-in log — board temperature, 48 h, one point every 5 min</div><canvas id="tBurn" style="height:150px"></canvas></div>' : ''}`;
          if (r.st === 'C2') {
            const lg = sim.burnLog(u.sn), t0 = r.t - r.dur * 1000;
            M.ch.line(R.querySelector('#tBurn'), { t0, t1: r.t, h: 150, series: [{ pts: lg.temp.map((v, i) => [t0 + i * lg.step * 60000, v]), color: '#e6b422', width: 1.5 }], hlines: [{ y: 85, color: '#f2495c', label: 'limit 85 °C' }], y: [15, 90] });
          }
        } else R.innerHTML = '<p class="muted">Select a result on the left.</p>';
      }

      // Containment.
      const C = root.querySelector('#tCont');
      const vers = [];
      M.STATIONS.forEach((s) => { const seen = new Set(); sim.byStation[s.id].forEach((r) => seen.add(r.ver + '|' + r.hash)); seen.forEach((k) => { const [v, h] = k.split('|'); vers.push({ key: 'ver:' + s.id + ':' + v, label: `${s.id} ${s.seq} ${v} (${h})${v === s.rel ? '' : ' — not released'}`, bad: v !== s.rel }); }); });
      const insts = [];
      M.STATIONS.forEach((s) => s.inst.forEach((i) => insts.push({ key: 'inst:' + s.id + ':' + i[0], label: `${i[0]} ${i[1]} on ${s.id}` })));
      const cq = ui.state.cq || (vers.find((v) => v.bad) || vers[0]).key;
      const [kind, sId, val] = cq.split(':');
      const hits = sim.byStation[sId].filter((r) => (kind === 'ver' ? r.ver === val : r.inst.includes(val)) && r.t > sim.now - 7 * sim.DAY);
      const sns = [...new Set(hits.map((r) => r.sn))];
      const shipped = sns.filter((sn) => sim.units[sn].status === 'passed').length;
      C.innerHTML = `<div class="toolbar" style="margin:0 0 8px"><span>Every unit tested by</span><select id="tCq">${[...vers.sort((a, b) => b.bad - a.bad), ...insts].map((o) => `<option value="${o.key}" ${o.key === cq ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>
          <span class="muted">in the last 7 days</span><span class="sp"></span><button class="btn sm" id="tCsv">Export list (CSV)</button></div>
        <div style="display:flex;gap:24px;margin-bottom:8px"><span><b class="mono" style="font-size:18px">${ui.n(sns.length)}</b> units</span><span><b class="mono" style="font-size:18px">${ui.n(hits.length)}</b> results</span><span><b class="mono" style="font-size:18px;${shipped && kind === 'ver' && vers.find((v) => v.key === cq && v.bad) ? 'color:var(--bad)' : ''}">${ui.n(shipped)}</b> already passed the whole route</span></div>
        <div class="mono" style="font-size:12px;line-height:1.7">${sns.slice(-60).reverse().map((sn) => `<a href="#" data-sn2="${sn}">${sn}</a>`).join(' ') || '<span class="muted">None.</span>'}${sns.length > 60 ? ` <span class="dim">… and ${sns.length - 60} more in the export</span>` : ''}</div>
        ${ui.oq(5, 'which software version produced this result, and how do you know?', 'A version number a developer forgot to increment is worse than none. The collector records the source-control hash itself.')}`;
      C.querySelector('#tCq').onchange = (e) => { ui.state.cq = e.target.value; ui.refresh(); };
      C.querySelectorAll('[data-sn2]').forEach((a) => (a.onclick = (e) => { e.preventDefault(); ui.state.sn = a.dataset.sn2; ui.state.runId = null; root.querySelector('#tSn').value = a.dataset.sn2; ui.refresh(); }));
      C.querySelector('#tCsv').onclick = () => download(`containment-${sId}-${val}.csv`, [['serial', 'product', 'station', 'finished', 'attempt', 'result', 'sequence_version', 'hash', 'unit_status'], ...hits.map((r) => [r.sn, r.prod, r.st, new Date(r.t).toISOString(), r.att, r.pass ? 'pass' : 'fail', r.ver, r.hash, sim.units[r.sn].status])]);
    },
  };
})(globalThis.M = globalThis.M || {});
