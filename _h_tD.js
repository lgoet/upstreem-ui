(function(){
  /* TEST D -- WEM GEHOEREN DIE LANGEN AUFGABEN. Die Zaehler aus C haben die DOM-Arbeit von
     17916 auf 10902 Zugriffe gedrueckt, und die Blockierzeit blieb bei 24 Sekunden. Zugriffe
     sind also nicht der Kostentreiber. Dieses Werkzeug legt die langen Aufgaben und unsere
     eigene Aktivitaet auf dieselbe Zeitachse und sagt, was WAEHREND einer langen Aufgabe lief.
     Es wrappt keine Layout-Zugriffe, verzerrt die Zeit also nicht. */
  var LT = [], MK = [], MUT = [];
  function mark(n){ MK.push({ t: performance.now(), n: n }); }

  if (window.PerformanceObserver){
    try {
      new PerformanceObserver(function(l){
        l.getEntries().forEach(function(e){ LT.push({ a: e.startTime, e: e.startTime + e.duration, ms: Math.round(e.duration) }); });
      }).observe({ type: "longtask", buffered: true });
    } catch(e){ console.log("longtask nicht verfuegbar: " + e.message); }
  }
  /* Unsere Einstiege markieren -- Anfang UND Ende, damit eine lange Aufgabe zeigt, ob sie
     waehrend eines Aufrufs lag oder erst danach (Zeichnen im naechsten Bild). */
  var UNSER = /(Upstreem|Table|Filter|DateRange|Mira|QuickActions|Preferences|TeamOrga|Brands|Topics|Models|Markets)/;
  Object.keys(window).forEach(function(k){
    if (typeof window[k] !== "function" || !/^(set|render|reset|open|close)[A-Z]/.test(k) || !UNSER.test(k)) return;
    var orig = window[k];
    window[k] = function(){ mark(k); try { return orig.apply(this, arguments); } finally { mark("/" + k); } };
  });
  /* DOM-Aenderungen nur ZAEHLEN, keine Suche, kein Layout. Ein eigener Beobachter, damit die
     Zahl nicht von unseren eigenen Beobachtern abhaengt. */
  if (window.MutationObserver){
    new MutationObserver(function(muts){
      var zu = 0, weg = 0;
      for (var i = 0; i < muts.length; i++){ zu += muts[i].addedNodes.length; weg += muts[i].removedNodes.length; }
      MUT.push({ t: performance.now(), zu: zu, weg: weg });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.upD = function(){
    var ges = LT.reduce(function(s,x){ return s + x.ms; }, 0);
    console.log("BLOCKIERT gesamt " + ges + " ms in " + LT.length + " langen Aufgaben");
    var sortiert = LT.slice().sort(function(a,b){ return b.ms - a.ms; }).slice(0, 12);
    var zeilen = sortiert.map(function(t){
      var drin = MK.filter(function(m){ return m.t >= t.a && m.t <= t.e; });
      var m2 = MUT.filter(function(m){ return m.t >= t.a && m.t <= t.e; });
      var knoten = m2.reduce(function(s,x){ return s + x.zu + x.weg; }, 0);
      /* Was VOR der Aufgabe lief, im Fenster davor -- ein Zeichnen im naechsten Bild ist die
         Folge eines Aufrufs, der schon vorbei ist. */
      var davor = MK.filter(function(m){ return m.t < t.a && m.t > t.a - 250 && m.n.charAt(0) !== "/"; });
      return { ms: t.ms,
               unsere_aufrufe_DRIN: drin.filter(function(m){ return m.n.charAt(0) !== "/"; }).map(function(m){ return m.n; }).join(",") || "(keine)",
               unsere_aufrufe_250ms_DAVOR: davor.map(function(m){ return m.n; }).join(",") || "(keine)",
               dom_knoten_in_der_aufgabe: knoten,
               mutations_schuebe: m2.length };
    });
    console.table(zeilen);
    var ohne = zeilen.filter(function(z){ return z.unsere_aufrufe_DRIN === "(keine)" && z.unsere_aufrufe_250ms_DAVOR === "(keine)"; });
    var stumm = zeilen.filter(function(z){ return z.dom_knoten_in_der_aufgabe === 0; });
    console.log("Von den 12 laengsten: " + ohne.length + " ohne jeden unserer Aufrufe (auch nicht 250ms davor), " +
                stumm.length + " ohne jede DOM-Aenderung.");
    console.log(ohne.length >= 6
      ? "==> Die Zeit gehoert NICHT unseren Aufrufen. Dann ist es Bubbles Engine oder die\n" +
        "    Style/Layout/Paint-Kaskade der 23604 Knoten -- beides nur in einer DevTools-Aufnahme sichtbar."
      : "==> Die langen Aufgaben liegen bei oder direkt nach unseren Aufrufen. Dann lohnt es,\n" +
        "    genau die genannten Wege weiter aufzuteilen.");
    var summeZu = MUT.reduce(function(s,x){ return s + x.zu + x.weg; }, 0);
    console.log("DOM-Aenderungen insgesamt: " + summeZu + " Knoten in " + MUT.length + " Schueben");
    return { blockiert_ms: ges, aufgaben: LT.length, laengste: zeilen, dom_knoten: summeZu };
  };
  console.log("TEST D laeuft. Jetzt filtern wie im Alltag, dann:  upD()");
})()
