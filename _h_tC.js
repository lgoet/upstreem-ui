(function(){
  /* TEST C -- ARBEIT. Wie viel DOM wird angefasst, wer fasst es an, und wie oft wird das Layout
     erzwungen. NICHT zusammen mit Test B: diese Zaehler kosten selbst Zeit. */
  var Z = {}, AN = true, RUMPF = 0, RUMPF_WER = {};
  /* Name UND Datei:Zeile. Der Name allein ist bei minifizierten Dateien wertlos ("o."), die
     Zeile laesst sich nachschlagen -- genau so waren die Violations des Nutzers brauchbar. */
  function wer(){
    var z = ((new Error()).stack || "").split("\n");
    for (var i = 1; i < z.length; i++){
      var r = z[i];
      var m = /at\s+(?:new\s+|async\s+)?([^\s(]+)?\s*\(?([^\s()]*?:\d+:\d+)\)?\s*$/.exec(r);
      if (!m) continue;
      var name = String(m[1] || "").replace(/^Object\./, "");
      var ort  = String(m[2] || "").split("/").pop();
      /* Die Zugriffshuellen selbst ueberspringen, sonst zeigt jede Zeile auf den Zaehler. */
      if (/(^|\.)(get|set)$/.test(name) || /^(wer|buch)$/.test(name)) continue;
      if (ort.indexOf("_h_t") === 0) continue;
      return (name && name.length > 2 ? name + " " : "") + ort;
    }
    return "(oben)";
  }
  function buch(art){ if (!AN) return; var k = wer(); (Z[k] || (Z[k] = {}))[art] = ((Z[k]||{})[art] || 0) + 1; }

  /* --- Suchen und Baumlaeufe --- */
  [[Document.prototype,"querySelectorAll","qsa"],[Element.prototype,"querySelectorAll","qsa"],
   [Document.prototype,"querySelector","qs"],[Element.prototype,"querySelector","qs"],
   [Document.prototype,"getElementsByClassName","gebc"],[Element.prototype,"getElementsByClassName","gebc"]
  ].forEach(function(t){
    var o = t[0], n = t[1], art = t[2], orig = o[n];
    if (typeof orig !== "function") return;
    o[n] = function(){ buch(art); return orig.apply(this, arguments); };
  });
  if (document.createTreeWalker){
    var tw = document.createTreeWalker.bind(document);
    document.createTreeWalker = function(){ buch("treewalker"); return tw.apply(null, arguments); };
  }

  /* --- Layout-Lesezugriffe: das sind die erzwungenen Reflows --- */
  [[HTMLElement.prototype,"offsetWidth"],[HTMLElement.prototype,"offsetHeight"],
   [HTMLElement.prototype,"offsetTop"],[HTMLElement.prototype,"offsetLeft"],
   [Element.prototype,"clientWidth"],[Element.prototype,"clientHeight"],
   [Element.prototype,"scrollWidth"],[Element.prototype,"scrollHeight"],[Element.prototype,"scrollTop"]
  ].forEach(function(pp){
    var d = Object.getOwnPropertyDescriptor(pp[0], pp[1]);
    if (!d || !d.get) return;
    Object.defineProperty(pp[0], pp[1], { configurable:true,
      get:function(){ buch("layout"); return d.get.call(this); } });
  });
  var rectO = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function(){ buch("layout"); return rectO.apply(this, arguments); };
  var gcsO = window.getComputedStyle;
  window.getComputedStyle = function(){ buch("stil"); return gcsO.apply(window, arguments); };

  /* --- Tabellenrumpf neu gebaut? Das ist der teuerste Einzelposten. --- */
  var dIH = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  Object.defineProperty(Element.prototype, "innerHTML", { configurable:true, get:dIH.get,
    set:function(v){
      if (AN && this.classList && (this.classList.contains("up-tbody") || this.classList.contains("urt-cards"))){
        RUMPF++; var k = wer(); RUMPF_WER[k] = (RUMPF_WER[k]||0)+1;
      }
      return dIH.set.call(this, v);
    } });

  window.upC = function(){
    AN = false;
    var l = Object.keys(Z).map(function(k){
      var e = Z[k], s = 0; for (var a in e) s += e[a];
      return { wo:k, gesamt:s, layout:e.layout||0, stil:e.stil||0, qsa:e.qsa||0, qs:e.qs||0,
               gebc:e.gebc||0, treewalker:e.treewalker||0 };
    }).sort(function(a,b){ return b.gesamt - a.gesamt; });
    console.log("DOM-ARBEIT, zugeordnet ueber den Aufrufstapel. 'layout' und 'stil' sind die\n" +
                "erzwungenen Reflows -- eine hohe Zahl bei EINEM Aufrufer ist Thrashing.");
    console.table(l.slice(0,15));
    var r = Object.keys(RUMPF_WER).map(function(k){ return { wo:k, mal:RUMPF_WER[k] }; })
            .sort(function(a,b){ return b.mal - a.mal; });
    console.log("TABELLENRUMPF NEU GEBAUT: " + RUMPF + " mal   (Riegel wirkt = wenige, trotz vieler Render)");
    r.length ? console.table(r) : console.log("   keinmal");
    var summe = l.reduce(function(s,x){ return s + x.gesamt; }, 0);
    console.log("Summe aller gezaehlten Zugriffe: " + summe);
    return { zugriffe: l, rumpf: RUMPF, rumpf_wer: r, summe: summe };
  };
  console.log("TEST C laeuft. Jetzt filtern/klicken wie im Alltag, dann:  upC()");
})()
