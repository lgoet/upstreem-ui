(function(){
  /* TEST B -- ZEIT. Was blockiert, und wer ist es. NICHT zusammen mit Test C laufen lassen:
     dessen Zaehler haengen sich an Layout-Zugriffe und verzerren jede Zeitmessung. */
  var LT = [], W = {}, EV = {}, FN = {};
  if (window.PerformanceObserver){
    try {
      new PerformanceObserver(function(l){
        l.getEntries().forEach(function(e){
          var q = (e.attribution && e.attribution[0]) || null;
          LT.push({ ms: Math.round(e.duration), typ: q ? q.name : "-",
                    wo: q && q.containerName ? q.containerName : (q && q.containerId ? q.containerId : "-") });
        });
      }).observe({ type: "longtask", buffered: true });
    } catch(e){ console.log("longtask nicht verfuegbar: " + e.message); }
  }
  /* Unsere oeffentlichen Einstiege. Nur unsere -- Bubbles eigene Funktionen bleiben unangetastet. */
  var UNSER = /(Upstreem|Table|Filter|DateRange|Mira|QuickActions|Preferences|TeamOrga|Brands|Topics|Models|Markets)/;
  Object.keys(window).forEach(function(k){
    if (typeof window[k] !== "function") return;
    if (!/^(set|render|reset|open|close)[A-Z]/.test(k)) return;
    if (!UNSER.test(k)) return;
    var orig = window[k];
    W[k] = { n: 0, ms: 0, max: 0 };
    window[k] = function(){
      var t0 = performance.now();
      try { return orig.apply(this, arguments); }
      finally {
        var d = performance.now() - t0;
        W[k].n++; W[k].ms += d; if (d > W[k].max) W[k].max = d;
      }
    };
  });
  /* Wie viele Events gehen an Bubble? Jedes ist ein Workflow-Start. */
  var dOrig = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function(e){
    var t = e && e.type;
    if (t && /^(up|u[a-z]{2}|mira|am|combo|tcd|vot|sph|cc)[A-Za-z]/.test(t)) EV[t] = (EV[t]||0)+1;
    return dOrig.apply(this, arguments);
  };
  Object.keys(window).forEach(function(k){
    if (k.indexOf("bubble_fn_") !== 0 || typeof window[k] !== "function") return;
    var o = window[k]; FN[k] = 0;
    window[k] = function(){ FN[k]++; return o.apply(this, arguments); };
  });
  window.upB = function(){
    var ges = LT.reduce(function(s,x){ return s + x.ms; }, 0);
    console.log("BLOCKIERT gesamt " + ges + " ms in " + LT.length + " langen Aufgaben (>50ms)");
    LT.sort(function(a,b){ return b.ms - a.ms; });
    console.log("Die 12 laengsten:"); console.table(LT.slice(0,12));
    var l = Object.keys(W).filter(function(k){ return W[k].n; }).map(function(k){
      return { funktion:k, aufrufe:W[k].n, ms_gesamt:Math.round(W[k].ms), ms_max:Math.round(W[k].max) };
    }).sort(function(a,b){ return b.ms_gesamt - a.ms_gesamt; });
    console.log("UNSERE EINSTIEGE (Zeit IM Aufruf, ohne spaeteres Zeichnen im naechsten Bild):");
    l.length ? console.table(l.slice(0,15)) : console.log("   keiner gerufen");
    var e2 = Object.keys(EV).map(function(k){ return { event:k, mal:EV[k] }; })
             .sort(function(a,b){ return b.mal - a.mal; });
    console.log("EVENTS AN BUBBLE (jedes ist ein Workflow-Start):");
    e2.length ? console.table(e2.slice(0,20)) : console.log("   keine");
    var f2 = Object.keys(FN).filter(function(k){ return FN[k]; }).map(function(k){ return { fn:k, mal:FN[k] }; })
             .sort(function(a,b){ return b.mal - a.mal; });
    if (f2.length){ console.log("BUBBLE-FUNKTIONEN direkt gerufen:"); console.table(f2.slice(0,20)); }
    return { blockiert_ms: ges, aufgaben: LT.length, einstiege: l, events: e2 };
  };
  console.log("TEST B laeuft. Jetzt filtern/klicken wie im Alltag, dann:  upB()");
})()
