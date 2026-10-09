/* The Guide. Offered once on the first entry, and on the header's "? Guide" button any time: a
   walkthrough of the screens, and five scenarios, each of which injects one fault, moves the clock
   on and shows where it surfaces. A rehearsal link that names a screen stays out of the way. */
(function (M) {
  var offered = false;

  function show() {
    if (document.querySelector('.ob-wrap')) return;
    if (M.tour && M.tour.active()) M.tour.stop();
    var el = document.createElement('div');
    el.className = 'ob-wrap';
    el.innerHTML =
      '<div class="ob-card guide">' +
        '<h3>A factory’s test results, in one place</h3>' +
        '<p>Three product lines, nine testers — TestStand, LabVIEW and two vendor testers that only drop files. ' +
        'Every result lands in one store with the software version that produced it. Seven days of history, and it is still running.</p>' +
        '<div class="g-walk"><div><b>The walkthrough</b><span>Every screen, starting with the factory floor, then Yield &amp; Pareto. About three minutes.</span></div>' +
          '<button class="btn primary" data-walk>Start the walkthrough</button></div>' +
        '<p style="margin:14px 0 4px"><b>Scenarios</b> — the faults in the <b>Demo ▾</b> menu, one at a time. Each one breaks something, ' +
        'moves the clock on a few hours and takes you to every screen where it shows.</p>' +
        '<div class="g-scen">' + M.SCENARIOS.map(function (s) {
          return '<button data-scen="' + s[0] + '"><b>' + s[1] + '</b><span>' + s[2] + '.</span><i>' + s[3] + '</i></button>';
        }).join('') + '</div>' +
        '<p class="ob-sub" style="margin-top:12px">Everything here is simulated and invented. A scenario changes the factory: use its fix, or reload the page to start again.</p>' +
        '<div class="ob-foot"><button class="btn ob-no">Look around on my own</button></div>' +
      '</div>';
    var close = function () { el.remove(); };
    el.querySelector('.ob-no').onclick = close;
    el.querySelector('[data-walk]').onclick = function () { close(); M.tour.walk(0); };
    el.querySelectorAll('[data-scen]').forEach(function (b) { b.onclick = function () { close(); M.tour.scenario(b.dataset.scen); }; });
    el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });
    document.body.appendChild(el);
  }
  M.onboard = { show: show };

  function mount() {
    var q = new URLSearchParams(location.hash.slice(1));
    if (q.get('screen') || q.get('noob') === '1' || q.get('tour') || q.get('scenario')) return;
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
