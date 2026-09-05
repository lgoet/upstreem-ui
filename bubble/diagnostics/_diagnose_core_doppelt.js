/* UPSTREEM -- WER HAENGT core.js EIN? (und wie oft)

   WOHIN: Bubble -> Settings -> SEO/metatags -> "Script/meta tags in header", GANZ NACH OBEN --
   vor page_theme_preload und vor das Preload-Snippet. Es muss laufen, bevor irgendetwas ein
   Script einhaengen kann, sonst sieht es die ersten Einhaenger nicht.

   DER BEFUND, DEM ES NACHGEHT: im Performance-Trace vom 05.09. wurde core.js 17x evaluiert --
   gleiche URL, gleicher Commit. Ausgefuehrt wird nur die erste Fassung (die BUILD-Sperre oben in
   core.js laesst die anderen sofort zurueckkehren), aber GEPARST werden alle: 812 KB pro
   Evaluierung, zusammen 850 ms Hauptstrang. Die Registry (__upAssetsLoaded) und der
   Doppel-Waechter im Preload-Snippet verhindern das nicht vollstaendig, also gibt es Einhaenger,
   die an beidem vorbeikommen -- Elemente mit einem aelteren Loader, ein document.write, oder ein
   Script-Tag, das schon im Markup steht.

   WAS ES TUT: es faengt JEDES eingehaengte script/link auf eine upstreem-Datei ab und schreibt
   auf, WER es eingehaengt hat (Stapelspur). Es aendert nichts und entfernt nichts -- reine
   Beobachtung, damit die Zahlen nicht von einer Gegenmassnahme verfaelscht werden.

   AUSWERTEN: nach dem Seitenaufbau in der Konsole

       upCoreReport()      Tabelle: Datei | Anzahl | Herkunft (erste zwei Zeilen der Spur)

   Danach wieder herausnehmen. */
(function(){
  if (window.__upCoreDiag) return;
  var treffer = [];
  window.__upCoreDiag = treffer;

  function notiere(tag){
    var u = tag.tagName === "SCRIPT" ? tag.getAttribute("src")
          : (tag.tagName === "LINK" ? tag.getAttribute("href") : null);
    if (!u || u.indexOf("upstreem-ui@") < 0) return;
    var spur = "";
    try { spur = new Error().stack || ""; } catch(e){}
    /* Die eigenen Rahmen wegwerfen: die ersten zwei Zeilen sind immer notiere/der Beobachter. */
    var zeilen = spur.split("\n").slice(3, 7).map(function(z){ return z.trim(); });
    treffer.push({
      datei: u.slice(u.lastIndexOf("/") + 1),
      pin: (/upstreem-ui@([^/]+)\//.exec(u) || [])[1] || "?",
      vorbereitet: !!tag.getAttribute("data-up-preload"),
      zeit: Math.round((window.performance && performance.now ? performance.now() : Date.now())),
      spur: zeilen
    });
  }

  /* Zwei Wege, denn ein Tag kann als Kind eines ganzen Teilbaums hereinkommen (Bubble haengt
      Teilbaeume auf einmal ein -- genau daran ist der Doppel-Waechter im Preload-Snippet schon
      einmal vorbeigelaufen). */
  function sehen(n){
    if (!n || n.nodeType !== 1) return;
    if (n.tagName === "SCRIPT" || n.tagName === "LINK") notiere(n);
    if (!n.querySelectorAll) return;
    var drin = n.querySelectorAll("script[src], link[href]");
    for (var i = 0; i < drin.length; i++) notiere(drin[i]);
  }
  if (window.MutationObserver){
    new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++){
        var neu = muts[i].addedNodes;
        for (var j = 0; j < neu.length; j++) sehen(neu[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  /* Auch das, was VOR diesem Script schon im Dokument stand -- sonst fehlt genau der Einhaenger,
     der am fruehesten dran war. */
  sehen(document.documentElement);

  window.upCoreReport = function(){
    var nach = {};
    treffer.forEach(function(t){
      var k = t.datei;
      (nach[k] || (nach[k] = [])).push(t);
    });
    var namen = Object.keys(nach).sort(function(a,b){ return nach[b].length - nach[a].length; });
    console.log("%c[upstreem] " + treffer.length + " Einhaengungen, " + namen.length + " Dateien",
      "color:#fff;background:#1b6eda;padding:2px 6px;border-radius:3px");
    namen.forEach(function(n){
      var l = nach[n];
      if (l.length < 2 && n.indexOf("core.") !== 0) return;   /* nur Auffaelliges und core */
      console.log("  " + n + "  x" + l.length +
        "   Pins: " + l.map(function(t){ return t.pin.slice(0,7); }).filter(function(v,i,a){ return a.indexOf(v)===i; }).join(",") +
        "   vorbereitet: " + l.filter(function(t){ return t.vorbereitet; }).length);
      l.forEach(function(t, i){
        if (i > 3) return;
        console.log("      +" + t.zeit + "ms  " + (t.vorbereitet ? "[Kopf-Snippet]" : "[fremd]") +
                    "\n         " + t.spur.join("\n         "));
      });
    });
    return treffer.length;
  };
})();
