/* UPSTREEM — Chart-Einblend-Diagnose. In die Konsole der ECHTEN Seite einfuegen, dann die Seite
   bzw. den Drawer normal laden. Der Report kommt automatisch ~1.4s nachdem loading auf "no"
   gegangen ist, also genau ueber dem Fenster, in dem die Einblend-Animation laeuft.

   Die eine Frage, die er beantwortet: WARUM ruckelt das Einblenden? Drei Ursachen sehen fuer
   das Auge gleich aus, haben aber komplett verschiedene Fixes:

     mehrere Chart-Builds   → die Animation startet mehrfach neu (sieht aus wie Stottern)
     Long Tasks in dem Fenster → irgendetwas blockiert den Main-Thread waehrend die Animation laeuft
     nur ein Build, keine Blockade, aber trotzdem Frame-Luecken → die Zeichenlast selbst ist zu hoch

   "Charts gebaut" ist die wichtigste Zeile. Steht da mehr als 1, ist das die Ursache — dann
   ruft die Bubble-Seite render/setLoading mehrfach pro Datensatz auf. */
(function(){
  if (window.__upChartDiag){ console.log('[chart-diag] laeuft bereits'); return; }
  window.__upChartDiag = true;

  var RUN = null, reportT = null;

  /* Long Tasks laufen dauerhaft mit, nicht erst ab Fensterstart — die groesste Blockade faengt
     oft schon an, bevor loading auf "no" kippt. */
  var LT = [];
  try { new PerformanceObserver(function(l){
    l.getEntries().forEach(function(e){ LT.push({ at: e.startTime, ms: Math.round(e.duration) }); });
  }).observe({entryTypes:['longtask']}); } catch(e){}

  function ev(label){
    if (!RUN) return;
    RUN.events.push({ t: Math.round(performance.now() - RUN.t0), label: label });
  }

  /* Jede neu konstruierte Chart.js-Instanz zaehlen. Das ist der teuerste Einzelposten und der
     einzige, der die Einblend-Animation von vorne starten laesst. */
  if (window.Chart){
    var OrigChart = window.Chart;
    var Wrapped = function(a, b){ if (RUN){ RUN.charts++; ev('Chart.js-Instanz gebaut (#' + RUN.charts + ')'); } return new OrigChart(a, b); };
    Wrapped.prototype = OrigChart.prototype;
    Object.keys(OrigChart).forEach(function(k){ try { Wrapped[k] = OrigChart[k]; } catch(e){} });
    window.Chart = Wrapped;
  } else {
    console.warn('[chart-diag] window.Chart noch nicht da — Snippet erst einfuegen, wenn die Seite steht.');
  }

  function start(trigger){
    if (RUN){ ev(trigger); return; }   // schon ein Fenster offen: nur mitschreiben
    RUN = { t0: performance.now(), events: [], charts: 0, ltFrom: LT.length,
            frames: 0, dropped: 0, worst: 0 };
    ev(trigger);
    var last = RUN.t0;
    (function tick(){
      if (!RUN) return;
      var now = performance.now(), d = now - last; last = now;
      RUN.frames++;
      if (d > 20){ RUN.dropped++; if (d > RUN.worst) RUN.worst = d; }
      if (now - RUN.t0 < 1400) requestAnimationFrame(tick);
    })();
    clearTimeout(reportT);
    reportT = setTimeout(report, 1400);
  }

  /* Wrappen: jeder Aufruf wird mit eigener Sync-Dauer protokolliert. Liegt eine Blockade direkt
     auf so einem Aufruf, ist sie unsere; liegt sie in einer Luecke, gehoert sie Bubble. */
  function hook(n, startsWindow){
    var orig = window[n];
    if (typeof orig !== 'function') return;
    window[n] = function(){
      var loadingOff = startsWindow && !isYes(arguments[1]);
      if (loadingOff) start('loading = no  (' + n + ')');
      var s = performance.now();
      var res = orig.apply(this, arguments);
      var d = Math.round(performance.now() - s);
      ev('JS: ' + n + '()' + (d >= 2 ? '   ⏱ ' + d + 'ms synchron' : ''));
      return res;
    };
  }
  function isYes(v){ return String(v == null ? '' : v).toLowerCase() === 'yes' || v === true; }

  ['setVisibilityChartLoading','setComboChartLoading','setTopCitationsLoading'].forEach(function(n){ hook(n, true); });
  ['renderVisibilityChart','resetVisibilityChart','setVisibilityChartTheme',
   'renderComboChart','resetComboChart',
   'renderTopCitations','resetTopCitations'].forEach(function(n){ hook(n, false); });

  function report(){
    if (!RUN) return;
    var r = RUN; RUN = null;
    var mine = LT.slice(r.ltFrom);
    var blocked = mine.reduce(function(s, x){ return s + x.ms; }, 0);
    var bad = r.charts > 1 || r.dropped > 3 || blocked > 150;

    console.log('%c[chart-diag]' + (bad ? '  ⚠ PROBLEM' : '  ✓ ok'),
      'color:#fff;background:' + (bad ? '#b0200c' : '#1a7f37') + ';padding:2px 6px;border-radius:3px');
    console.log('   Charts gebaut in diesem Fenster: ' + r.charts
      + (r.charts > 1 ? '   ← URSACHE: die Animation startet ' + r.charts + '× neu' : '   ← richtig, genau einer'));
    console.log('   Frames in 1400ms: ' + r.frames + ' (erwartet ~84), verzoegert: ' + r.dropped
      + ', laengste Luecke: ' + Math.round(r.worst) + 'ms');
    console.log('   Main-Thread BLOCKIERT: ' + blocked + 'ms'
      + (blocked > 150 ? '   ← JS frisst die Zeit' : '   ← nicht blockiert'));

    var timeline = r.events.map(function(e){ return { t: e.t, label: e.label }; });
    mine.forEach(function(x){ timeline.push({ t: Math.round(x.at - r.t0), label: '⛔ BLOCKIERT ' + x.ms + 'ms' }); });
    timeline.sort(function(a, b){ return a.t - b.t; });
    console.log('   Zeitleiste:');
    timeline.forEach(function(e){ console.log('     ' + (e.t < 0 ? '' : '+') + e.t + 'ms   ' + e.label); });
  }

  console.log('%c[chart-diag] aktiv — jetzt die View/den Drawer mit dem Chart laden.',
    'color:#fff;background:#1b6eda;padding:2px 6px;border-radius:3px');
})();
