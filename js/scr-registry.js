// Software & stations: what is released against what is actually running, read from the results
// themselves; fixture wear by contact cycles; instrument calibration by due date.
(function (M) {
  const ui = M.ui, esc = ui.esc, sim = M.sim;
  const RELEASED = { A1: '2026-08-04', A2: '2026-09-15', A3: '2026-09-22', A4: '2026-09-22', B1: '2026-06-30', B2: '2026-09-01', C1: '2026-07-21', C2: '2026-05-12', C3: '2026-08-26' };
  const day = (s) => new Date(s + 'T00:00:00').getTime();

  M.screens.registry = {
    mount(root) {
      root.innerHTML = `<div class="toolbar"><span class="ttl">Software &amp; stations</span><span class="muted">Released versions come from your release process. Deployed versions are read from each result as it arrives — nobody has to report them.</span></div>
        <div class="dash">
          ${ui.panel('c12', 'Stations', '<div class="scroll" id="rSt"></div>', { flush: true })}
          ${ui.panel('c6', 'Instrument calibration', '<div class="scroll" id="rCal" style="max-height:300px"></div>', { flush: true })}
          ${ui.panel('c6', 'Why this screen exists', `<p style="margin:0 0 6px">Your developers write and release the test software. This screen does not replace that process; it <b>watches</b> it.</p>
            <p style="margin:0 0 6px">Every result carries the sequence version and source-control hash that produced it, written by the collector, not typed by a person. So a station running a build that was never released is visible from its first result, and the containment query on Traceability lists every unit it touched.</p>
            <p style="margin:0">The same goes for instruments and fixtures: a result knows which meter measured it and how many contacts its fixture had made.</p>
            ${ui.oq(6, 'what happens when a station runs a sequence version that has not been released?', 'Refuse to record, record and flag, or not notice — it is a decision, not a default.')}`)}
        </div>`;
    },
    update(root) {
      const now = sim.now;
      const rows = M.STATIONS.map((s) => {
        const dep = sim.deployed[s.id], ok = dep.ver === s.rel;
        const last = sim.byStation[s.id][sim.byStation[s.id].length - 1];
        const cyc = sim.fixtureCycles[s.id], life = s.fixLife, frac = Math.min(1, cyc / life);
        const due = s.inst.map((i) => day(i[2])).sort((a, b) => a - b)[0];
        const dueCls = due < now ? 'fail' : due - now < 30 * sim.DAY ? '' : 'dim';
        return `<tr class="click" data-st="${s.id}"><td><b>${s.id}</b> ${esc(s.long)}</td><td>${ui.srcBadge(s.src)}</td><td class="mono">${esc(s.seq)}</td>
          <td class="mono" title="Released ${RELEASED[s.id]}">${esc(s.rel)} <span class="dim">${esc(M.HASH[s.rel])}</span></td>
          <td class="mono ${ok ? '' : 'fail'}">${esc(dep.ver)} <span class="${ok ? 'dim' : 'fail'}">${esc(dep.hash)}</span></td>
          <td>${ok ? '<span class="badge ok">matches</span>' : '<span class="badge bad">NOT RELEASED</span>'}</td>
          <td class="mono">${esc(s.fixture)}</td><td><div style="display:flex;align-items:center;gap:6px"><div class="qbar" style="width:80px"><i style="width:${frac * 100}%;background:${frac > 0.9 ? 'var(--bad)' : frac > 0.75 ? 'var(--warn)' : 'var(--ok)'}"></i></div><span class="mono dim">${ui.n(cyc)}/${ui.n(life)}</span></div></td>
          <td class="mono ${dueCls}">${ui.date(due)}</td><td class="dim">${last ? ui.ago(last.t) : '—'}</td></tr>`;
      }).join('');
      root.querySelector('#rSt').innerHTML = `<table class="g"><thead><tr><th>Station</th><th>Source</th><th>Sequence</th><th>Released</th><th>Deployed (from results)</th><th></th><th>Fixture</th><th>Fixture contacts</th><th>Next calibration</th><th>Last result</th></tr></thead><tbody>${rows}</tbody></table>`;
      root.querySelectorAll('#rSt tr.click').forEach((tr) => (tr.onclick = () => { ui.state.cq = 'ver:' + tr.dataset.st + ':' + sim.deployed[tr.dataset.st].ver; ui.go('trace', tr.dataset.st); }));

      const insts = [];
      M.STATIONS.forEach((s) => s.inst.forEach((i) => insts.push({ id: i[0], what: i[1], st: s.id, due: day(i[2]) })));
      insts.sort((a, b) => a.due - b.due);
      root.querySelector('#rCal').innerHTML = `<table class="g"><thead><tr><th>Instrument</th><th>Type</th><th>Station</th><th>Calibration due</th><th></th></tr></thead><tbody>${insts.map((i) => {
        const over = i.due < now, soon = !over && i.due - now < 60 * sim.DAY;
        return `<tr><td class="mono">${esc(i.id)}</td><td>${esc(i.what)}</td><td>${i.st}</td><td class="mono ${over ? 'fail' : ''}">${ui.date(i.due)}</td><td>${over ? '<span class="badge bad">overdue</span>' : soon ? '<span class="badge warn">due soon</span>' : ''}</td></tr>`;
      }).join('')}</tbody></table>`;
    },
  };
})(globalThis.M = globalThis.M || {});
