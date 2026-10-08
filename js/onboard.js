/* First-run orientation. Once, on the first entry, a card that says what this is and the four
   things worth trying. Declining is remembered for the session; the header button brings it back.
   A rehearsal link that names a screen stays out of the way. */
(function (M) {
  var offered = false;

  function show() {
    if (document.querySelector('.ob-wrap')) return;
    var el = document.createElement('div');
    el.className = 'ob-wrap';
    el.innerHTML =
      '<div class="ob-card">' +
        '<h3>A factory’s test results, in one place</h3>' +
        '<p>Three product lines, nine testers — TestStand, LabVIEW and two vendor testers that only drop files. ' +
        'Every result lands in one store with the software version that produced it. Seven days of history, and it is still running.</p>' +
        '<p><b>Worth trying</b></p><ol>' +
          '<li><b>Yield &amp; Pareto</b> — true first-pass yield against the yield the line reports.</li>' +
          '<li><b>Demo ▾ → wear out the ICT fixture</b>, then watch <b>Measurements</b> catch it before the yield drops.</li>' +
          '<li><b>Demo ▾ → deploy an unreleased build to A3</b>, then <b>Traceability</b> lists every unit it touched.</li>' +
          '<li><b>Data pipeline → take a link down</b>: results queue on the tester and back-fill when it returns.</li>' +
        '</ol>' +
        '<p class="ob-sub">Everything here is simulated and invented. Set the speed to ×600 in the header to watch a shift go by.</p>' +
        '<div class="ob-foot"><button class="btn ob-no">Look around</button><button class="btn primary ob-yes">Start on Yield &amp; Pareto</button></div>' +
      '</div>';
    var close = function () { el.remove(); };
    el.querySelector('.ob-no').onclick = close;
    el.querySelector('.ob-yes').onclick = function () { close(); M.ui.go('yield'); };
    el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });
    document.body.appendChild(el);
  }
  M.onboard = { show: show };

  function mount() {
    var q = new URLSearchParams(location.hash.slice(1));
    if (q.get('screen') || q.get('noob') === '1') return;
    var t = setInterval(function () {
      var app = document.getElementById('app');
      if (!app || app.hidden) return;
      clearInterval(t);
      if (offered) return;
      offered = true;
      setTimeout(show, 500);
    }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(globalThis.M = globalThis.M || {});
