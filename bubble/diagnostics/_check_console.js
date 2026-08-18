/* UPSTREEM — Sammelpruefung fuer die Konsole der ECHTEN Seite.

   Einfuegen, Enter, dann:

     upCheck.all()        alles nacheinander (asynchron, Ergebnis kommt in Etappen)
     upCheck.pins()       Pins und Auslieferung  <- der wichtigste, siehe unten
     upCheck.core()       core, Wurzeln, Controller, doppelte Instanz-Ids
     upCheck.theme()      laufen App und Komponenten im selben Thema?
     upCheck.loading()    wer haengt gerade im Ladezustand?
     upCheck.wiring()     welches data-*-fn zeigt auf eine Funktion, die es nicht gibt?

   Warum pins() zuerst: jsDelivr merkt sich einen fehlgeschlagenen GitHub-Abruf PRO DATEI und PRO
   COMMIT und antwortet danach dauerhaft mit Status 200 und 54 Zeichen Fehlertext. Ein Blick auf
   den Statuscode findet das NICHT. Trifft es core.js, ist die ganze App tot und es sieht aus wie
   ein kaputter Commit. Genau das ist am 17.08. passiert. */
(function(){
  var C = window.upCheck = {};
  var BASIS = "https://cdn.jsdelivr.net/gh/lgoet/upstreem-ui@";

  function tabelle(titel, zeilen){
    if (!zeilen.length){ console.log("  (nichts)"); return; }
    console.groupCollapsed(titel + "  (" + zeilen.length + ")");
    (console.table ? console.table : console.log)(zeilen);
    console.groupEnd();
  }
  function wurzeln(){ return [].slice.call(document.querySelectorAll(".up-root")); }
  function name(el){
    var k = (el.className || "").split(/\s+/).filter(function(c){ return c && c !== "up-root" && c !== "up-portal"; });
    return k[0] || el.tagName.toLowerCase();
  }
  function ctrlKey(el){
    for (var k in el) if (/Controller$/.test(k) && el[k]) return k;
    return null;
  }

  /* ---- 1. Pins und Auslieferung --------------------------------------------------------- */
  C.pins = function(){
    console.group("%cupCheck.pins()", "font-weight:700");
    var els = [].slice.call(document.querySelectorAll("[data-cdn-pin]"));
    var proPin = {};
    els.forEach(function(el){
      var p = (el.getAttribute("data-cdn-pin") || "").trim() || "(leer)";
      (proPin[p] = proPin[p] || []).push(name(el));
    });
    var pins = Object.keys(proPin);
    console.log("Elemente mit data-cdn-pin:", els.length, "| verschiedene Pins:", pins.length);
    pins.forEach(function(p){ console.log("   " + p + "  ->  " + proPin[p].join(", ")); });
    if (pins.length > 1){
      console.warn("MEHR ALS EIN PIN auf der Seite. Der Loader entdoppelt nach Dateiname, es " +
        "gewinnt also der Pin, dessen Element Bubble zuerst baut -- welcher das ist, wechselt. " +
        "Alle Elemente auf denselben Pin setzen.");
    }
    if (proPin["(leer)"] || proPin["CDN_PIN"]){
      console.warn("Elemente ohne echten Pin laden von @main. Das ist der Entwicklungsstand, " +
        "nicht der geprueft ausgelieferte.");
    }

    var reg = window.__upAssetsLoaded || {};
    var dateien = Object.keys(reg);
    console.log("Vom Loader geladene Dateien:", dateien.length);
    if (!dateien.length){
      console.warn("Keine Registry gefunden. Entweder laeuft auf dieser Seite kein Loader, " +
        "oder die Skripte stehen fest im Seitenkopf.");
      console.groupEnd(); return Promise.resolve(null);
    }
    var geladenePins = {};
    dateien.forEach(function(d){
      var m = /upstreem-ui@([^/]+)\//.exec(reg[d]);
      if (m) geladenePins[m[1]] = (geladenePins[m[1]] || 0) + 1;
    });
    console.log("Pins in den geladenen URLs:", geladenePins);

    console.log("Pruefe die Auslieferung ... (das dauert ein paar Sekunden)");
    return Promise.all(dateien.map(function(d){
      return fetch(reg[d], { cache: "no-store" })
        .then(function(r){ return r.text().then(function(t){ return { datei: d, status: r.status, zeichen: t.length, anfang: t.slice(0, 60) }; }); })
        .catch(function(e){ return { datei: d, status: "NETZFEHLER", zeichen: 0, anfang: String(e && e.message) }; });
    })).then(function(z){
      var kaputt = z.filter(function(x){
        return x.status !== 200 || x.zeichen < 200 || /Failed to fetch|Couldn't find/i.test(x.anfang);
      });
      if (!kaputt.length){
        console.log("%cAlle " + z.length + " Dateien liefern echten Inhalt.", "color:#0a0;font-weight:700");
      } else {
        console.error("KAPUTT AUSGELIEFERT: " + kaputt.length + " von " + z.length +
          ". Das ist der jsDelivr-Fall aus dem Kopf dieser Datei -- Pin purgen (_h_pin_purge.html) " +
          "und erneut pruefen, NICHT den Commit suchen.");
        tabelle("kaputte Dateien", kaputt);
      }
      console.groupEnd();
      return { geprueft: z.length, kaputt: kaputt };
    });
  };

  /* ---- 2. core, Wurzeln, Controller ------------------------------------------------------ */
  C.core = function(){
    console.group("%cupCheck.core()", "font-weight:700");
    var UC = window.UpstreemCore;
    console.log("UpstreemCore:", UC ? ("da, BUILD " + UC.BUILD) : "FEHLT");
    if (!UC) console.error("Ohne core laeuft keine Komponente. Zuerst pins() lesen.");
    var tags = [].slice.call(document.querySelectorAll('script[src*="core.js"]'));
    console.log("script-Tags fuer core.js:", tags.length,
      tags.length > 1 ? "  <- mehr als einer, siehe pins()" : "");

    var w = wurzeln(), ids = {}, zeilen = [];
    w.forEach(function(el){
      var id = el.getAttribute("data-instance") || "(ohne)";
      ids[id] = (ids[id] || 0) + 1;
      zeilen.push({ Komponente: name(el), Instanz: id, Controller: ctrlKey(el) || "-",
        sichtbar: !!(el.offsetWidth || el.offsetHeight), Breite: Math.round(el.getBoundingClientRect().width) });
    });
    console.log("Wurzeln (.up-root):", w.length);
    tabelle("Wurzeln", zeilen);
    var doppelt = Object.keys(ids).filter(function(k){ return ids[k] > 1 && k !== "(ohne)"; });
    if (doppelt.length) console.warn("Dieselbe data-instance mehrfach: " + doppelt.join(", ") +
      ". Die Setter treffen dann alle davon -- oder die falsche.");
    var ohne = zeilen.filter(function(z){ return z.Controller === "-" && z.sichtbar; });
    if (ohne.length) console.warn("Sichtbare Wurzeln ohne Controller (nicht initialisiert, oder " +
      "eine Komponente ohne diese Konvention):", ohne.map(function(z){ return z.Komponente; }).join(", "));
    console.groupEnd();
    return { wurzeln: w.length, doppelteIds: doppelt };
  };

  /* ---- 3. Thema -------------------------------------------------------------------------- */
  C.theme = function(){
    console.group("%cupCheck.theme()", "font-weight:700");
    var app = window.getUpstreemTheme ? window.getUpstreemTheme() : "(keine core-Funktion)";
    var pref = null; try { pref = localStorage.getItem("pref_theme"); } catch(e){}
    var sys = window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    console.log("App:", app, "| localStorage pref_theme:", pref, "| System:", sys,
      "| <html data-theme>:", document.documentElement.getAttribute("data-theme"));
    var soll = app === "dark";
    var zeilen = wurzeln().map(function(el){
      var ist = el.getAttribute("data-theme") === "dark";
      return { Komponente: name(el), "data-isdark": el.getAttribute("data-isdark"),
        "data-theme": el.getAttribute("data-theme"), passt: ist === soll ? "ja" : "NEIN" };
    });
    tabelle("Wurzeln", zeilen);
    var falsch = zeilen.filter(function(z){ return z.passt === "NEIN"; });
    if (falsch.length) console.error("Diese Komponenten stehen im anderen Thema als die App: " +
      falsch.map(function(z){ return z.Komponente; }).join(", ") +
      ". Meist ein Render-Aufruf mit altem is_dark -- die Komponente muss UC.themeParam benutzen.");
    else console.log("%cAlle Komponenten stehen im Thema der App.", "color:#0a0");
    console.groupEnd();
    return { app: app, falsch: falsch.length };
  };

  /* ---- 4. Haengende Ladezustaende -------------------------------------------------------- */
  C.loading = function(){
    console.group("%cupCheck.loading()", "font-weight:700");
    var seit = Math.round(performance.now() / 1000);
    var zeilen = [];
    wurzeln().forEach(function(el){
      var sk = el.querySelectorAll(".up-sk, .up-tsk, .usn-sk, [class*='-sk-'], [class$='-sk']").length;
      var kl = /\bis-loading\b|\bis-busy\b/.test(el.className);
      if (!sk && !kl) return;
      zeilen.push({ Komponente: name(el), Instanz: el.getAttribute("data-instance"),
        Skelette: sk, "is-loading": kl ? "ja" : "-", inert: el.hasAttribute("inert") ? "ja" : "-" });
    });
    console.log("Seite laeuft seit " + seit + "s.");
    if (!zeilen.length) console.log("%cNichts laedt gerade.", "color:#0a0");
    else {
      tabelle("laden gerade", zeilen);
      if (seit > 15) console.error("Nach " + seit + "s laedt hier noch etwas. Ein Ladezustand, der " +
        "nicht endet, heisst: der Setter kam nie an, oder sein Payload war unlesbar. Bubble-Workflow " +
        "und die Konsolenwarnungen darueber pruefen.");
    }
    console.groupEnd();
    return zeilen;
  };

  /* ---- 5. Tote Verdrahtung --------------------------------------------------------------- */
  C.wiring = function(){
    console.group("%cupCheck.wiring()", "font-weight:700");
    var zeilen = [];
    wurzeln().forEach(function(el){
      [].slice.call(el.attributes).forEach(function(a){
        if (!/^data-.*-fn$/.test(a.name)) return;
        var fn = (a.value || "").trim();
        var da = fn && typeof window[fn] === "function";
        zeilen.push({ Komponente: name(el), Attribut: a.name, Funktion: fn || "(leer)",
          vorhanden: da ? "ja" : "NEIN" });
      });
    });
    var tot = zeilen.filter(function(z){ return z.vorhanden === "NEIN"; });
    tabelle("alle data-*-fn", zeilen);
    if (tot.length){
      console.error(tot.length + " Verdrahtung(en) zeigen ins Leere -- diese Klicks loesen in " +
        "Bubble nichts aus. Bubble veroeffentlicht bubble_fn_* NUR fuer SICHTBARE Elemente.");
      tabelle("tot", tot);
    } else console.log("%cJedes data-*-fn zeigt auf eine vorhandene Funktion.", "color:#0a0");
    console.groupEnd();
    return tot;
  };

  C.all = function(){
    C.core(); C.theme(); C.loading(); C.wiring();
    return C.pins();
  };

  console.log("%cupCheck bereit:%c all() · pins() · core() · theme() · loading() · wiring()",
    "font-weight:700", "font-weight:400");
})();

/* ---------------------------------------------------------------------------------------------
   upCheck.knopf(sel) -- wo sitzt der Platz in einem Knopf wirklich?

   Gebaut fuer den Fall "der Knopf hat rechts zu viel Luft": misst nicht die Polsterung, sondern
   die TINTE. Ein Zeichen fuellt seinen Kasten nie ganz aus, und ein Text endet mit dem letzten
   Buchstaben -- die Polsterung allein sagt darum nichts darueber, was man sieht. Zusaetzlich
   zeigt sie, wieviel Platz NEBEN dem Knopf steht: liegt die Luft dort, hilft keine Polsterung.

     upCheck.knopf(".uca-trigger")          der Create-Knopf
     upCheck.knopf()                        ohne Angabe: derselbe
*/
(function(){
  var C = window.upCheck; if (!C) return;
  C.knopf = function(sel){
    sel = sel || ".uca-trigger";
    var el = document.querySelector(sel);
    if (!el){ console.warn("[upCheck] kein Element fuer " + sel); return null; }
    var b = el.getBoundingClientRect(), cs = getComputedStyle(el);
    function tinteLinks(){
      var k = el.firstElementChild;
      var svg = k && (k.matches("svg") ? k : k.querySelector("svg"));
      var p = svg && svg.querySelector("path,rect,circle");
      if (!p || !svg.viewBox || !svg.viewBox.baseVal.width) return k ? Math.round((k.getBoundingClientRect().left - b.left) * 10) / 10 : null;
      var bb = p.getBBox(), sb = svg.getBoundingClientRect(), f = sb.width / svg.viewBox.baseVal.width;
      return Math.round((sb.left - b.left + bb.x * f) * 10) / 10;
    }
    function tinteRechts(){
      var letzte = el.lastElementChild || el;
      var rg = document.createRange(); rg.selectNodeContents(letzte);
      var rr = rg.getClientRects();
      if (!rr.length) return Math.round((b.right - letzte.getBoundingClientRect().right) * 10) / 10;
      return Math.round((b.right - rr[rr.length - 1].right) * 10) / 10;
    }
    var eltern = el.parentElement ? el.parentElement.getBoundingClientRect() : null;
    var res = {
      knopf: Math.round(b.width * 10) / 10 + " x " + Math.round(b.height * 10) / 10,
      polsterung: cs.padding, abstand: cs.gap,
      tinte_links: tinteLinks(), tinte_rechts: tinteRechts(),
      platz_rechts_NEBEN_dem_knopf: eltern ? Math.round((eltern.right - b.right) * 10) / 10 : null,
      elternklasse: el.parentElement ? el.parentElement.className : null
    };
    console.group("%cupCheck.knopf(" + sel + ")", "font-weight:700");
    (console.table ? console.table : console.log)(res);
    if (res.platz_rechts_NEBEN_dem_knopf > 4)
      console.warn("Der Platz steht NEBEN dem Knopf, nicht darin -- er gehoert dem Elternelement " +
        "(" + res.elternklasse + "). Polsterung am Knopf aendert daran nichts.");
    console.groupEnd();
    return res;
  };
})();
