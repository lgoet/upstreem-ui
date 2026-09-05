/* UPSTREEM -- WER LIEST LAYOUT IN EINER GEPARKTEN ANSICHT?

   WOHIN: Konsole der laufenden Seite, einfach einfuegen. Danach 10-20 Sekunden NICHTS tun, dann

       upParkReport()

   WAS ES BEANTWORTET: die Meldung "Rendering was performed in a subtree hidden by
   content-visibility" sagt, DASS jemand einen geparkten Teilbaum layouten liess, aber nicht wer.
   Chrome haengt manchmal eine Quelle daran (zuletzt "pre_run_jquery.js" -- Bubbles eigenes
   jQuery), oft aber keine. Solange das offen ist, weiss niemand, ob noch etwas von uns kommt.

   WIE: jeder Layout-Lesezugriff (clientWidth und Geschwister, getBoundingClientRect) wird
   umschlossen. Liegt das Element in einer geparkten Ansicht oder einem geparkten Drawer, wird der
   AUFRUFER mitgeschrieben -- synchron, der Stapel ist also echt. Gelesen wird unveraendert
   weitergegeben, es aendert sich nichts am Verhalten.

   PREIS: dieser Umweg laeuft bei JEDEM Layout-Lesezugriff der ganzen Seite, auch bei den vielen
   berechtigten. Das ist fuer eine Messung von zwanzig Sekunden richtig und fuer den Dauerbetrieb
   falsch -- danach die Seite neu laden, dann ist es weg. */
(function(){
  if (window.__upParkDiag) { console.warn("[upstreem] laeuft schon -- upParkReport() aufrufen"); return; }
  var treffer = {}, gesamt = 0;
  window.__upParkDiag = treffer;

  /* Geparkt heisst: DIESES Element wird nicht gerendert, und zwar wegen eines Containers mit
     content-visibility. checkVisibility beantwortet den ersten Teil ohne Layoutwert -- sonst
     wuerde die Messung selbst ausloesen, was sie messen will.

     ACHTUNG, hier lag der erste Anlauf daneben: gefragt wurde der CONTAINER, und
     content-visibility:hidden laesst den Container selbst weiter "sichtbar" sein -- nur seine
     KINDER werden nicht gerendert. Die Diagnose meldete deshalb 0 Treffer, auch bei einer
     absichtlich gesetzten Lesung. Gefragt wird jetzt das gelesene Element selbst.

     Der zweite Teil (Container mit content-visibility) trennt die gesuchte Sorte von einem
     schlichten display:none -- dort kostet ein Lesezugriff nichts, weil es nichts zu layouten
     gibt. getComputedStyle laeuft nur, wenn checkVisibility schon "nicht gerendert" gesagt hat. */
  function geparkt(el){
    try {
      if (!el || typeof el.checkVisibility !== "function") return false;
      if (el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })) return false;
      var v = el.closest && el.closest('[id^="view-"], [id^="drawer-"]');
      if (!v) return false;
      var cv = "";
      try { cv = window.getComputedStyle(v).contentVisibility || ""; } catch(e){}
      return cv === "hidden" || cv === "auto";
    } catch(e){ return false; }
  }
  function quelle(){
    var s = "";
    try { s = new Error().stack || ""; } catch(e){}
    var z = s.split("\n");
    for (var i = 2; i < z.length; i++){
      var t = z[i].trim();
      /* Die eigenen Rahmen ueberspringen -- nach FUNKTIONSNAMEN, denn dieses Script wird per
         eval eingesetzt und hat keinen Dateinamen, an dem man es erkennen koennte. Ohne das
         meldete der Bericht sich selbst ("at zaehle") als Quelle. */
      if (/\bquelle\b|\bzaehle\b|\bgeparkt\b|upParkDiag|\[as (client|offset|scroll)/.test(t)) continue;
      return t.replace(/^at\s+/, "").slice(0, 140);
    }
    return "(unbekannt)";
  }
  function zaehle(){
    var q = quelle();
    treffer[q] = (treffer[q] || 0) + 1;
    gesamt++;
  }
  function haengeGetter(proto, name){
    var d = Object.getOwnPropertyDescriptor(proto, name);
    if (!d || !d.get) return;
    Object.defineProperty(proto, name, {
      configurable: true, enumerable: d.enumerable,
      get: function(){ if (geparkt(this)) zaehle(); return d.get.call(this); }
    });
  }
  ["clientWidth","clientHeight","scrollWidth","scrollHeight"].forEach(function(n){
    haengeGetter(Element.prototype, n);
  });
  ["offsetWidth","offsetHeight","offsetLeft","offsetTop"].forEach(function(n){
    haengeGetter(HTMLElement.prototype, n);
  });
  var gbcr = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function(){
    if (geparkt(this)) zaehle();
    return gbcr.apply(this, arguments);
  };

  window.upParkReport = function(){
    var namen = Object.keys(treffer).sort(function(a,b){ return treffer[b] - treffer[a]; });
    console.log("%c[upstreem] " + gesamt + " Layout-Lesezugriffe in geparkten Ansichten, " +
      namen.length + " Quellen",
      "color:#fff;background:" + (gesamt ? "#b0200c" : "#1a7f37") + ";padding:2px 6px;border-radius:3px");
    namen.forEach(function(n){
      var unser = /core\.js|core\.min\.js|table\.js|chart\.js:|sidebar\.js|filter|page-header|detail\.js|mira/.test(n)
                  && n.indexOf("pre_run") < 0 && n.indexOf("run.js") < 0;
      console.log("  " + String(treffer[n]).padStart(6, " ") + "  " + (unser ? "[UNS] " : "[fremd] ") + n);
    });
    if (!gesamt) console.log("  nichts -- in geparkten Ansichten wird kein Layout gelesen");
    return gesamt;
  };
  console.log("%c[upstreem] Parkleser-Diagnose aktiv -- 20s nichts tun, dann upParkReport()",
    "color:#fff;background:#1b6eda;padding:2px 6px;border-radius:3px");
})();
