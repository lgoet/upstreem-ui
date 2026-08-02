/* UPSTREEM — View-Wechsel-Diagnose. In die Konsole der ECHTEN Seite einfuegen, dann normal
   zu einer View navigieren (z.B. Prompts). Nach ~3.5s kommt eine Zeitleiste.

   Die zentrale Frage bei einem 2-Sekunden-Wechsel ist NICHT "wie lange dauert es", sondern:
   ist der Main-Thread blockiert, oder wird nur gewartet? Beides fuehlt sich gleich an, hat aber
   entgegengesetzte Fixes:

     blockiert  → JS/Rendering frisst die Zeit  → Arbeit aus dem Zeitfenster schieben
     gewartet   → RPC/Bubble liefert nicht      → Datenladen beschleunigen, Skeleton frueher zeigen

   Die Zeile "davon Main-Thread blockiert" unten trennt das. */
(function(){
  if (window.__upViewDiag) { console.log('[view-diag] laeuft bereits'); return; }
  window.__upViewDiag = true;

  var RUN = null;
  function viewName(){ try { return new URL(location.href).searchParams.get('view'); } catch(e){ return null; } }

  /* Long Tasks laufen weiter mit, auch ausserhalb eines Laufs — sonst verpassen wir die, die
     schon vor dem pushState anfangen (Bubble startet Workflows oft vor der URL-Aenderung). */
  var LT = [];
  try { new PerformanceObserver(function(l){
    l.getEntries().forEach(function(e){ LT.push({ at: e.startTime, ms: Math.round(e.duration) }); });
  }).observe({entryTypes:['longtask']}); } catch(e){}

  function ev(label, atMs){
    if (RUN) RUN.events.push({ t: atMs != null ? atMs : Math.round(performance.now()-RUN.t0), label: label });
  }
  /* Misst, wie lange unsere eigene Funktion synchron laeuft. Wichtig fuer die Zuordnung: liegt
     eine Blockade direkt auf so einem Aufruf, ist sie unsere; liegt sie in einer Luecke dazwischen,
     gehoert sie Bubble. Achtung, die Charts rendern asynchron weiter — eine kleine Sync-Dauer
     schliesst spaetere Kosten aus unserem Code nicht voellig aus, macht sie aber unwahrscheinlich. */
  function timed(n, orig){
    return function(){
      var startedAt = Math.round(performance.now() - (RUN ? RUN.t0 : performance.now()));
      var s = performance.now();
      var res = orig.apply(this, arguments);
      var d = Math.round(performance.now() - s);
      ev('JS: ' + n + '()' + (d >= 2 ? '   ⏱ ' + d + 'ms synchron' : ''), startedAt);
      return res;
    };
  }

  /* Alle Render-/Loading-Funktionen mitschreiben — zeigt, WANN unsere Komponenten ueberhaupt
     ins Spiel kommen. Kommen sie erst spaet, war die Zeit davor nicht unsere. */
  ['renderPromptsTable','setPromptsTableLoading','resetPromptsTable','setPromptsTableTopics',
   'renderUrlsTable','setUrlsTableLoading','resetUrlsTable',
   'renderDomainsTable','setDomainsTableLoading','resetDomainsTable',
   'renderVisibilityChart','setVisibilityChartLoading','resetVisibilityChart',
   'renderTopCitations','setTopCitationsLoading','resetTopCitations',
   'renderComboChart','setComboChartLoading','resetComboChart',
   'renderTopicsManager','setTopicsManagerLoading','resetTopicsManager'
  ].forEach(function(n){
    var orig = window[n];
    if (typeof orig !== 'function') return;
    window[n] = timed(n, orig);
  });

  if (typeof window.fadeView === 'function'){
    var of = window.fadeView;
    window.fadeView = function(n){ ev('fadeView("' + n + '")'); return of.apply(this, arguments); };
  }

  function start(trigger){
    var name = viewName();
    RUN = { t0: performance.now(), name: name, events: [], ltFrom: LT.length,
            frames: 0, dropped: 0, worst: 0, elVisible: null, rootsSeen: null };
    ev(trigger);

    // Frames waehrend des Uebergangs
    var last = RUN.t0;
    (function tick(){
      if (!RUN) return;
      var now = performance.now(), d = now - last; last = now;
      RUN.frames++; if (d > 20){ RUN.dropped++; if (d > RUN.worst) RUN.worst = d; }
      if (now - RUN.t0 < 600) requestAnimationFrame(tick);
    })();

    // Wann ist die View wirklich sichtbar?
    (function poll(){
      if (!RUN) return;
      var el = name ? document.getElementById('view-' + name) : null;
      if (el && el.offsetParent !== null && el.offsetHeight > 0){
        RUN.elVisible = Math.round(performance.now() - RUN.t0);
        ev('View sichtbar');
        return;
      }
      if (performance.now() - RUN.t0 < 5000) requestAnimationFrame(poll);
    })();

    setTimeout(report, 3500);
  }

  function report(){
    if (!RUN) return;
    var r = RUN; RUN = null;
    var elapsed = 3500;
    var mine = LT.slice(r.ltFrom);
    var blocked = mine.reduce(function(s,x){ return s + x.ms; }, 0);
    var bad = r.dropped > 2 || blocked > 150;

    console.log('%c[view-diag] "' + r.name + '"' + (bad ? '  ⚠ PROBLEM' : '  ✓ ok'),
      'color:#fff;background:' + (bad ? '#b0200c' : '#1a7f37') + ';padding:2px 6px;border-radius:3px');
    console.log('   View sichtbar nach: ' + (r.elVisible == null ? 'nie (>5s)' : r.elVisible + 'ms'));
    console.log('   davon Main-Thread BLOCKIERT: ' + blocked + 'ms'
      + (blocked > 150 ? '   ← JS/Rendering frisst die Zeit' : '   ← nicht blockiert, es wird nur gewartet'));
    console.log('   Frames in den ersten 600ms: ' + r.frames + ' (erwartet ~36), verzoegert: '
      + r.dropped + ', laengste Luecke: ' + Math.round(r.worst) + 'ms');
    /* Long Tasks in dieselbe Zeitleiste einsortieren wie die JS-Aufrufe — entry.startTime hat
       denselben Nullpunkt wie performance.now(), also reicht die Differenz zu t0. So sieht man
       direkt, ob eine Blockade VOR oder NACH dem ersten Render-Aufruf liegt. */
    var timeline = r.events.map(function(e){ return { t: e.t, label: e.label }; });
    mine.forEach(function(x){
      timeline.push({ t: Math.round(x.at - r.t0), label: '⛔ BLOCKIERT ' + x.ms + 'ms' });
    });
    timeline.sort(function(a, b){ return a.t - b.t; });

    console.log('   Zeitleiste:');
    timeline.forEach(function(e){
      console.log('     ' + (e.t < 0 ? '' : '+') + e.t + 'ms   ' + e.label);
    });
    console.log('%c   Deutung: steht vor dem ersten "JS: render…" schon viel Zeit UND viel blockierte Zeit,'
      + ' liegt es an Bubble, nicht an den Komponenten.', 'color:#666');
  }

  ['pushState','replaceState'].forEach(function(m){
    var orig = history[m];
    history[m] = function(){ var res = orig.apply(this, arguments); start('Navigation (' + m + ')'); return res; };
  });
  window.addEventListener('popstate', function(){ start('Navigation (popstate)'); });

  console.log('%c[view-diag] aktiv — jetzt zu einer View navigieren (z.B. Prompts).',
    'color:#fff;background:#1b6eda;padding:2px 6px;border-radius:3px');
})();
