/* UPSTREEM — Drawer-Animation-Diagnose. In die Konsole der ECHTEN Seite einfuegen.
   Danach den Drawer wie gewohnt oeffnen/schliessen. Nach jeder Animation kommt ein Report.
   Beantwortet: ruckelt es wirklich, blockiert JS den Main-Thread, und ruft Bubble waehrend
   der Animation Render-Funktionen auf (= Charts werden mitten in der Animation neu gebaut)? */
(function(){
  if (window.__upDiag) { console.log('[diag] laeuft bereits'); return; }
  window.__upDiag = true;

  var win = { active:false, label:'', t0:0, calls:[], longtasks:[], charts:0 };

  // 1) Long Tasks (alles >50ms, das den Main-Thread blockiert)
  try { new PerformanceObserver(function(l){
    l.getEntries().forEach(function(e){ if (win.active) win.longtasks.push(Math.round(e.duration)); });
  }).observe({entryTypes:['longtask']}); } catch(e){}

  // 2) Jede Render-/Loading-Funktion der Komponenten mitzaehlen
  ['renderVisibilityChart','setVisibilityChartLoading','resetVisibilityChart',
   'renderTopCitations','setTopCitationsLoading','resetTopCitations',
   'renderComboChart','setComboChartLoading','resetComboChart',
   'renderPromptsTable','setPromptsTableLoading','resetPromptsTable','setPromptsTableTopics',
   'renderUrlsTable','renderDomainsTable','renderTopicsManager'
  ].forEach(function(n){
    var orig = window[n];
    if (typeof orig !== 'function') return;
    window[n] = function(){
      if (win.active) win.calls.push(n + ' +' + Math.round(performance.now()-win.t0) + 'ms');
      return orig.apply(this, arguments);
    };
  });

  // 3) Neu gebaute Chart.js-Instanzen zaehlen (teuerster Einzelposten)
  if (window.Chart){
    var OrigChart = window.Chart, Wrapped = function(){ if (win.active) win.charts++; return new OrigChart(arguments[0], arguments[1]); };
    Wrapped.prototype = OrigChart.prototype;
    Object.keys(OrigChart).forEach(function(k){ try { Wrapped[k] = OrigChart[k]; } catch(e){} });
    window.Chart = Wrapped;
  }

  // 4) Frames waehrend der Animation
  function watch(label){
    win = { active:true, label:label, t0:performance.now(), calls:[], longtasks:[], charts:0 };
    var last = win.t0, frames=0, dropped=0, worst=0;
    (function tick(){
      var now=performance.now(), d=now-last; last=now; frames++;
      if (d>20){ dropped++; if(d>worst) worst=d; }
      if (now-win.t0 < 400) requestAnimationFrame(tick);
      else {
        win.active=false;
        var bad = dropped>2 || worst>60 || win.longtasks.length>0;
        console.log('%c[diag] '+label+(bad?'  ⚠ RUCKELT':'  ✓ fluessig'),
          'color:#fff;background:'+(bad?'#b0200c':'#1a7f37')+';padding:2px 6px;border-radius:3px');
        console.log('   Frames: '+frames+' (erwartet ~24), verzoegert: '+dropped+', laengste Luecke: '+Math.round(worst)+'ms');
        console.log('   Long Tasks (Main-Thread blockiert): '+(win.longtasks.length?win.longtasks.join('ms, ')+'ms':'keine'));
        console.log('   Render-Aufrufe waehrend der Animation: '+(win.calls.length?win.calls.join(' | '):'keine'));
        console.log('   Neu gebaute Charts waehrend der Animation: '+win.charts);
      }
    })();
  }

  ['openDrawer','closeDrawer'].forEach(function(fn){
    var orig = window[fn];
    if (typeof orig !== 'function') { console.warn('[diag] '+fn+' nicht gefunden'); return; }
    window[fn] = function(name){ var r = orig.apply(this, arguments); watch(fn+'("'+name+'")'); return r; };
  });

  console.log('%c[diag] aktiv — jetzt Drawer oeffnen und schliessen.','color:#fff;background:#1b6eda;padding:2px 6px;border-radius:3px');
})();
