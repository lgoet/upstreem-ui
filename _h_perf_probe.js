/* ==============================================================================================
   perfProbe -- findet heraus, WER die Seite langsam macht. Zum Einfuegen in die Browser-Konsole
   der echten App.

   Warum dieses Werkzeug und nicht nur das Performance-Panel: das Panel zeigt, DASS Layout
   gerechnet wird und wie lange. Es sagt aber schlecht, WELCHE Komponente es ausgeloest hat, wenn
   zwoelf Komponenten dieselben Funktionen aus core.js benutzen. Diese Sonde zaehlt jeden
   layout-lesenden Zugriff und schreibt ihn der Komponente UND der Codestelle zu, die ihn gemacht
   hat -- danach steht die Antwort als Rangliste da.

   Der Hintergrund: ein Layout-Lesezugriff (offsetWidth, getBoundingClientRect, getComputedStyle)
   direkt NACH einem Schreibzugriff zwingt den Browser, das Layout sofort neu zu rechnen, statt es
   bis zum naechsten Bild zu sammeln. Steht das in einer Schleife, rechnet er es pro Durchlauf
   einmal -- "layout thrashing". Genau das erklaert auch, warum es mit offener Konsole 2-5x
   schlimmer wird: DevTools instrumentiert jede Style- und Layoutberechnung, reine Rechenzeit in
   JS dagegen kaum. Wer mit offener Konsole viel langsamer wird, rechnet Layout, er rechnet nicht.

   BENUTZUNG
     1. In der Konsole der echten App einfuegen (ganze Datei).
     2. perfProbe.start()
     3. Das machen, was langsam ist -- Fenster ziehen, Seite neu laden, filtern.
     4. perfProbe.report()

   Fuer den Pageload muss die Sonde VOR den Komponenten laufen. Dafuer: Konsole offen lassen,
   perfProbe.start() aufrufen, dann F5 -- geht nicht, die Sonde ist nach dem Neuladen weg.
   Stattdessen "Preserve log" anschalten und die Sonde als Snippet in DevTools ablegen
   (Sources > Snippets), dann laeuft sie mit einem Klick direkt nach dem Laden.
   ============================================================================================== */
(function () {
  "use strict";

  var AUS = [];            /* Rueckbau-Funktionen */
  var zaehler = {};        /* "Komponente|Stelle" -> Anzahl */
  var proKomponente = {};
  var proStelle = {};
  var langeAufgaben = [];
  /* Wer die Zeit verbraucht -- nicht wer misst. Die Zaehler oben finden Layout-Thrashing; sie
     sagen aber nichts ueber einen Callback, der schlicht lange RECHNET. Deshalb wird jeder
     Rueckruf, der ueber setTimeout, setInterval oder requestAnimationFrame angemeldet wird, mit
     seiner ANMELDESTELLE gemerkt und beim Ausfuehren gestoppt. Der Report nennt danach die
     teuersten -- mit Datei und Zeile derjenigen Stelle, die den Rueckruf angemeldet hat. */
  var rueckrufe = {};      /* "Stelle" -> { n, ms, max } */
  var laeuft = false, t0 = 0;
  var obs = null;

  /* Welche Komponente hat den Zugriff gemacht? Naechster Vorfahre mit data-instance oder einer
     *-root-Klasse. Ohne Treffer: der Dokumentname, damit auch Fremdcode auftaucht. */
  function komponenteVon(el) {
    var n = el && el.nodeType === 1 ? el : (el && el.parentNode);
    var tiefe = 0;
    while (n && n.nodeType === 1 && tiefe++ < 30) {
      var k = (n.className && n.className.toString) ? n.className.toString() : "";
      var m = k.match(/\b([a-z]{2,4}-root)\b/);
      if (m) {
        var inst = n.getAttribute && n.getAttribute("data-instance");
        return m[1] + (inst ? "#" + inst : "");
      }
      n = n.parentNode;
    }
    return "(ausserhalb einer Komponente)";
  }

  /* Die erste Codestelle, die nicht zur Sonde gehoert. Kurz gehalten: Datei:Zeile reicht, um sie
     im Repo zu finden, und lange Stacks machen die Rangliste unlesbar. */
  function stelleVon() {
    var s = "";
    try { s = new Error().stack || ""; } catch (e) { return "(kein Stack)"; }
    var zeilen = s.split("\n");
    /* Rahmen der Sonde selbst -- inklusive der eingehaengten Getter, die als "X.get" auftauchen.
       Ohne diesen Filter stand das Messgeraet ganz oben in der eigenen Rangliste (gemessen:
       erst "stelleVon", nach dem ersten Fix "HTMLDivElement.get"), und der Bericht war wertlos. */
    var eigen = /_h_perf_probe|perfProbe|stelleVon|komponenteVon|\bbuche\b|patchGetter|patchMethode|\.get\s|\.get$/;

    /* ERST nach einem Rahmen MIT Datei suchen. In der echten App kommt der Code von jsDelivr,
       da hat jeder Rahmen eine URL -- Datei:Zeile ist die Angabe, mit der man die Stelle im Repo
       aufschlaegt. Ein Funktionsname allein hilft dort nicht weiter. */
    for (var i = 1; i < zeilen.length; i++) {
      if (eigen.test(zeilen[i])) continue;
      var m = zeilen[i].match(/([^\/\s()]+\.js):(\d+):\d+/);
      if (m) return m[1] + ":" + m[2];
      var v = zeilen[i].match(/(VM\d+[^\s:)]*):(\d+)/);   /* per Run-JS eingespeister Code */
      if (v) return v[1] + ":" + v[2];
    }
    /* Nur wenn es GAR keinen Dateirahmen gibt (aus der Konsole gerufener Code): Funktionsname. */
    for (var j = 1; j < zeilen.length; j++) {
      if (eigen.test(zeilen[j])) continue;
      var fn = zeilen[j].match(/at\s+([A-Za-z0-9_$.<>]+)\s/);
      if (fn && fn[1] !== "Object" && fn[1] !== "eval") return fn[1] + " (ohne Datei)";
    }
    return "(unbekannte Stelle)";
  }

  function buche(el) {
    if (!laeuft) return;
    var k = komponenteVon(el), st = stelleVon();
    var key = k + " | " + st;
    zaehler[key] = (zaehler[key] || 0) + 1;
    proKomponente[k] = (proKomponente[k] || 0) + 1;
    proStelle[st] = (proStelle[st] || 0) + 1;
  }

  /* --- Getter umhaengen. Original merken, damit start/stop mehrfach gehen. --- */
  function patchGetter(proto, name) {
    var d = Object.getOwnPropertyDescriptor(proto, name);
    if (!d || !d.get) return;
    Object.defineProperty(proto, name, {
      configurable: true, enumerable: d.enumerable,
      get: function () { buche(this); return d.get.call(this); }
    });
    AUS.push(function () { Object.defineProperty(proto, name, d); });
  }
  function patchMethode(obj, name, elVon) {
    var alt = obj[name];
    if (typeof alt !== "function") return;
    obj[name] = function () {
      buche(elVon ? elVon(this, arguments) : this);
      return alt.apply(this, arguments);
    };
    AUS.push(function () { obj[name] = alt; });
  }

  window.perfProbe = {
    start: function () {
      if (laeuft) { console.log("perfProbe laeuft schon"); return; }
      zaehler = {}; proKomponente = {}; proStelle = {}; langeAufgaben = [];
      laeuft = true; t0 = Date.now();

      patchGetter(Element.prototype, "clientWidth");
      patchGetter(Element.prototype, "clientHeight");
      patchGetter(Element.prototype, "scrollWidth");
      patchGetter(Element.prototype, "scrollHeight");
      patchGetter(Element.prototype, "scrollTop");
      patchGetter(HTMLElement.prototype, "offsetWidth");
      patchGetter(HTMLElement.prototype, "offsetHeight");
      patchGetter(HTMLElement.prototype, "offsetTop");
      patchGetter(HTMLElement.prototype, "offsetLeft");
      patchGetter(HTMLElement.prototype, "offsetParent");
      patchMethode(Element.prototype, "getBoundingClientRect");
      patchMethode(Element.prototype, "getClientRects");
      /* getComputedStyle nimmt das Element als erstes Argument, nicht als this. */
      patchMethode(window, "getComputedStyle", function (self, args) { return args[0]; });

      /* Die drei Anmeldewege fuer aufgeschobene Arbeit. Gemessen wird die Ausfuehrung, gemerkt
         wird die Stelle der ANMELDUNG -- die steht im Stack des Aufrufs von setTimeout & Co. */
      ["setTimeout", "setInterval", "requestAnimationFrame"].forEach(function (name) {
        var alt = window[name];
        if (typeof alt !== "function") return;
        window[name] = function (fn) {
          if (typeof fn !== "function") return alt.apply(window, arguments);
          var stelle = stelleVon();
          var args = [].slice.call(arguments);
          args[0] = function () {
            var t = (window.performance && performance.now) ? performance.now() : 0;
            try { return fn.apply(this, arguments); }
            finally {
              if (t) {
                var d = performance.now() - t;
                var r = rueckrufe[stelle] || (rueckrufe[stelle] = { n: 0, ms: 0, max: 0 });
                r.n++; r.ms += d; if (d > r.max) r.max = d;
              }
            }
          };
          return alt.apply(window, args);
        };
        AUS.push(function () { window[name] = alt; });
      });

      /* Lange Aufgaben sagen, WANN es weh tat -- die Zaehler sagen, wer schuld war. */
      try {
        obs = new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (e) {
            langeAufgaben.push({ ms: Math.round(e.duration), bei: Math.round(e.startTime) });
          });
        });
        obs.observe({ entryTypes: ["longtask"] });
      } catch (e) { obs = null; }

      console.log("perfProbe an. Jetzt das Langsame tun, dann perfProbe.report()");
    },

    stop: function () {
      while (AUS.length) { try { AUS.pop()(); } catch (e) {} }
      if (obs) { try { obs.disconnect(); } catch (e) {} obs = null; }
      laeuft = false;
    },

    report: function () {
      var dauer = Date.now() - t0;
      this.stop();
      function rang(o, n) {
        return Object.keys(o).map(function (k) { return { k: k, v: o[k] }; })
          .sort(function (a, b) { return b.v - a.v; }).slice(0, n || 15);
      }
      var gesamt = Object.keys(proStelle).reduce(function (s, k) { return s + proStelle[k]; }, 0);

      console.log("%c perfProbe: " + gesamt + " Layout-Lesezugriffe in " + dauer + "ms ",
                  "background:#111;color:#fff;padding:2px 6px;border-radius:4px");
      if (langeAufgaben.length) {
        var summe = langeAufgaben.reduce(function (s, a) { return s + a.ms; }, 0);
        console.log("Lange Aufgaben (>50ms): " + langeAufgaben.length +
                    ", zusammen " + summe + "ms, laengste " +
                    Math.max.apply(null, langeAufgaben.map(function (a) { return a.ms; })) + "ms");
      }
      console.log("\n-- nach KOMPONENTE ------------------------------------------");
      console.table(rang(proKomponente).map(function (r) {
        return { Komponente: r.k, Zugriffe: r.v, Anteil: Math.round(r.v / gesamt * 100) + "%" }; }));
      console.log("\n-- nach CODESTELLE ------------------------------------------");
      console.table(rang(proStelle).map(function (r) {
        return { Stelle: r.k, Zugriffe: r.v, Anteil: Math.round(r.v / gesamt * 100) + "%" }; }));
      console.log("\n-- Komponente x Stelle (die eigentliche Antwort) ------------");
      console.table(rang(zaehler, 20).map(function (r) {
        return { "Komponente | Stelle": r.k, Zugriffe: r.v }; }));

      /* Die eigentliche Antwort auf "was dauert so lange": die teuersten Rueckrufe, nach
         verbrauchter Zeit. n ist die Zahl der Ausfuehrungen, max die laengste einzelne. */
      var rl = Object.keys(rueckrufe).map(function (k) { return { k: k, v: rueckrufe[k] }; })
        .sort(function (a, b) { return b.v.ms - a.v.ms; }).slice(0, 15);
      if (rl.length) {
        console.log("\n-- ZEIT nach Rueckruf (setTimeout / rAF / setInterval) ------");
        console.table(rl.map(function (r) {
          return { "Angemeldet bei": r.k, "Summe ms": Math.round(r.v.ms),
                   "Aufrufe": r.v.n, "laengster ms": Math.round(r.v.max) };
        }));
      }

      return { gesamt: gesamt, dauerMs: dauer, proKomponente: proKomponente,
               proStelle: proStelle, langeAufgaben: langeAufgaben, rueckrufe: rueckrufe };
    },

    /* Fuer den Resize-Fall: zieht das Fenster nicht, sondern aendert die Breite der
       Komponenten-Wurzeln -- misst also genau die Kette, die beim echten Ziehen laeuft, ohne dass
       jemand die Maus bewegen muss. Praktisch fuer eine wiederholbare Messung. */
    resizeTest: function (schritte) {
      var wurzeln = document.querySelectorAll("[class*='-root']");
      var alt = [];
      for (var i = 0; i < wurzeln.length; i++) alt.push(wurzeln[i].style.width);
      var breiten = schritte || [1200, 900, 700, 500, 900, 1200];
      var n = 0;
      return new Promise(function (fertig) {
        (function weiter() {
          if (n >= breiten.length) {
            for (var j = 0; j < wurzeln.length; j++) wurzeln[j].style.width = alt[j];
            setTimeout(function () { fertig(true); }, 300);
            return;
          }
          var b = breiten[n++];
          for (var k = 0; k < wurzeln.length; k++) wurzeln[k].style.width = b + "px";
          /* Auch das Fenster-Ereignis feuern: ein Teil der Komponenten haengt an
             window.resize statt an einem ResizeObserver, und die Breitenaenderung an der Wurzel
             allein erreicht die nicht. Gemessen: ohne diese Zeile blieb der Zaehler auf 0. */
          try { window.dispatchEvent(new Event("resize")); } catch (e) {}
          setTimeout(weiter, 260);
        })();
      });
    }
  };

  console.log("perfProbe geladen. perfProbe.start() -> langsames Ding tun -> perfProbe.report()");
})();
