/* upstreem skeleton.js — das Ladeskelett als eigene Komponente (Praefix `usk`).
   Braucht core.js und skeleton.css.

   Es fuellt seine Bubble-Gruppe: volle Breite, volle Hoehe, keine eigene Groesse. Wer die
   Gruppe groesser zieht, bekommt ein groesseres Skelett -- und bei der Zeilen-Fassung auch
   mehr Zeilen, weil die Anzahl aus der gemessenen Hoehe kommt.

   ── Einbau ──────────────────────────────────────────────────────────────────────
   Ein HTML-Element in die Gruppe, die spaeter den Inhalt zeigt. Die Gruppe bestimmt die
   Groesse, das Element bringt keine mit. Sichtbar machen und verstecken uebernimmt Bubble
   ueber die Bedingungen der Gruppe -- das ist dort schon geloest, und ein zweiter Schalter
   hier waere ein zweiter Ort, an dem jemand nachsehen muss.

   ── Die Attribute ───────────────────────────────────────────────────────────────
       data-instance   die Kennung, falls mehrere Skelette auf einer Seite unterschiedlich
                       gesetzt werden sollen. Ohne sie ist es "default".
       data-isdark     "yes" / "no". Wie in jeder Komponente ueber UC.themeParam gelesen;
                       ein data-theme am Element gewinnt dagegen.
       data-variant    "block" (Vorgabe) | "rows" | "card"
                         block  eine Flaeche, die alles fuellt. Fuer Charts, Bilder, Karten.
                         rows   Streifen, deren ANZAHL sich aus der Hoehe ergibt. Fuer Text
                                und Listen.
                         card   eine quadratische Kachel links, daneben die Streifen. Fuer
                                Zeilen mit Logo und Namen.
       data-rows       feste Zeilenanzahl statt der gerechneten. Nur bei rows und card.
       data-radius     Radius der Flaeche bei block, in px. Vorgabe 12.

   ── Der Setter (optional) ───────────────────────────────────────────────────────
   setSkeleton("[dynamic id]", <Text>)   { "variant": "rows", "rows": 4, "radius": 12 }
   resetSkeleton("[dynamic id]")         zurueck auf die Attribute

   Warum es ihn gibt, obwohl die Attribute reichen: dieselbe Erfahrung wie bei drawer-topbar --
   Bubble zieht ein Attribut nicht immer nach. Wer die Fassung im Betrieb wechselt, soll sich
   darauf nicht verlassen muessen. Wer sie nicht wechselt, braucht den Setter nie.

   ── Was es MELDET ───────────────────────────────────────────────────────────────
   Nichts. Ein Skelett ist eine Anzeige und kein Bedienelement -- es hat kein Ereignis, das ein
   Workflow abwarten koennte. Deshalb steht hier auch kein data-*-fn.

   ── Verwendet aus core ──────────────────────────────────────────────────────────
   UC.makeMount, UC.themeParam, UC.readBubble, UC.watchRoots
   Farbe (--vc-sk) und Bewegung (uutpulse) kommen aus core.css. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung ---------------------------------
     Ein Workflow kann setSkeleton rufen, bevor diese Datei geladen ist. Ohne Stub wirft der
     erste Aufruf und reisst den ganzen Run-JS-Step mit -- also auch die Setter der anderen
     Komponenten, die darunter stehen. */
  var API_NAMES = ["setSkeleton", "resetSkeleton"];
  var Q = (window.__uskBootQueue = window.__uskBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function uskBoot(triesLeft) {
    if (!window.UpstreemCore) {
      /* Dieselbe Wiederholung wie in jeder anderen Komponente: Bubble haengt die Skripte per
         jQuery .html() ein, und die Reihenfolge der Ausfuehrung ist dabei nicht garantiert. */
      if (triesLeft > 0) { setTimeout(function () { uskBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uskStart();
  }

  function uskStart() {
    var UC = window.UpstreemCore;

    var FASSUNGEN = { block: 1, rows: 1, card: 1 };
    /* Eine Zeile ist 12px hoch, der Abstand 10 -- dieselben Werte wie .up-tsk-bar in core.
       Sie stehen hier ein zweites Mal, weil die ANZAHL gerechnet werden muss und eine Rechnung
       die Zahlen braucht. Wer sie in der CSS aendert, aendert sie hier mit; der Prueftand
       vergleicht beide Seiten, damit das nicht stillschweigend auseinanderlaeuft. */
    var ZEILE = 12, ABSTAND = 10, KACHEL = 34;

    function zahl(v, rueckfall) {
      var n = parseFloat(v);
      return (isFinite(n) && n >= 0) ? n : rueckfall;
    }

    function initRoot(root) {
      if (!root || root.__uskController) return root && root.__uskController;

      var Z = { variant: null, rows: null, radius: null };   /* was der Setter gesetzt hat */
      var beobachter = null;

      function attr(n) { return root.getAttribute(n); }

      function dunkel() {
        /* UC.themeParam statt eines eigenen isYes: kennt core ein Thema, gewinnt core --
           dasselbe Muster wie in drawer-topbar und ask-mira. */
        return attr("data-theme") === "dark" || UC.themeParam(attr("data-isdark"));
      }

      function fassung() {
        var v = String(Z.variant != null ? Z.variant : (attr("data-variant") || "block"))
                  .toLowerCase().trim();
        /* Eine unbekannte Fassung verschluckt das Skelett NICHT. Ein leerer Kasten waere hier
           der schlimmste Fall: die Gruppe wartet auf Inhalt, und es sieht aus, als sei nichts
           unterwegs. Also die Vorgabe -- und eine Zeile in der Konsole, damit der Tippfehler
           in Bubble auffindbar ist. */
        if (!FASSUNGEN[v]) {
          if (v && window.console) console.warn('upstreem skeleton: unbekannte Fassung "' + v +
            '" -- verwendet wird "block". Moeglich sind: block, rows, card.');
          return "block";
        }
        return v;
      }

      /* Wie viele Zeilen passen in die gemessene Hoehe? n Zeilen brauchen
         n*ZEILE + (n-1)*ABSTAND, also n = (h + ABSTAND) / (ZEILE + ABSTAND). */
      function zeilenAnzahl(hoehe) {
        var fest = zahl(Z.rows != null ? Z.rows : attr("data-rows"), 0);
        if (fest >= 1) return Math.round(fest);
        var n = Math.floor((hoehe + ABSTAND) / (ZEILE + ABSTAND));
        /* MINDESTENS EINE. Eine Gruppe, die (noch) 0px hoch ist -- in Bubble beim Aufbau der
           Normalfall -- ergaebe sonst 0 Zeilen und damit einen leeren Kasten, der spaeter nie
           wieder gefuellt wird, weil niemand ein zweites Mal rechnet. Der Beobachter unten
           rechnet nach, sobald die Gruppe ihre Hoehe hat. */
        return Math.max(1, Math.min(n, 40));
      }

      /* ZEICHNEN IST IDEMPOTENT: es baut den Baum nur um, wenn er sich WIRKLICH aendert.
         Das ist keine Sparsamkeit, sondern eine Bedingung fuers Ueberleben auf dieser Seite.
         core traegt einen Themenwaechter, dessen MutationObserver mit childList und subtree
         laeuft; wer bei jedem Aufruf innerHTML neu setzt, weckt ihn -- und beruehrt dessen
         Antwort wieder ein Attribut, das der eigene Beobachter liest, dreht sich das im Kreis.
         Gemessen: die Prueftandseite fror ein, kein synchrones Skript kam mehr durch, und der
         Browser hat 300 Sekunden lang auf eine Navigation nicht mehr geantwortet.
         Zweiter Grund, der auch ohne Waechter zaehlt: ein neu gesetztes innerHTML laesst die
         Pulsbewegung von vorn anfangen -- sichtbar als Flackern. */
      var letztesHtml = null;
      function zeichnen() {
        var v = fassung();
        var thema = dunkel() ? "dark" : "light";
        if (root.getAttribute("data-theme") !== thema) root.setAttribute("data-theme", thema);
        var r = zahl(Z.radius != null ? Z.radius : attr("data-radius"), 12);
        if (root.style.getPropertyValue("--usk-radius") !== r + "px")
          root.style.setProperty("--usk-radius", r + "px");

        var html;
        if (v === "block") {
          html = '<span class="usk-block"></span>';
        } else {
          /* Bei card ist der Platz fuer die Zeilen die Kachelhoehe und nicht die Gruppenhoehe:
             die zwei Zeilen stehen NEBEN der Kachel und sollen mit ihr abschliessen. */
          var hoehe = (v === "card") ? KACHEL : root.clientHeight;
          var n = zeilenAnzahl(hoehe);
          var zeilen = '<span class="usk-rows">';
          for (var i = 0; i < n; i++) zeilen += '<span class="usk-line"></span>';
          zeilen += '</span>';
          html = (v === "card")
            ? '<span class="usk-card"><span class="usk-tile"></span>' + zeilen + '</span>'
            : zeilen;
        }
        if (html === letztesHtml) return;
        letztesHtml = html;
        root.innerHTML = html;
      }

      /* DIE HOEHE KOMMT SPAETER. In Bubble ist die Gruppe beim ersten Lauf oft noch 0px hoch,
         und eine Rechnung darauf ergibt eine Zeile. Nachgerechnet wird deshalb bei jeder
         Groessenaenderung -- das ist das "fit height".
         Nur bei den Zeilen-Fassungen: block braucht keine Zahl.
         Nur bei einer Aenderung der ANZAHL wird neu gezeichnet. Sonst baut jeder Pixel den
         Baum neu, und die Pulsbewegung faengt bei jedem Bild von vorn an -- sichtbar als
         Flackern, waehrend jemand das Fenster zieht. */
      var letzteZahl = -1;
      function nachrechnen(){
        if (fassung() === "block") return;
        var z = zeilenAnzahl(root.clientHeight);
        if (z === letzteZahl) return;
        letzteZahl = z;
        zeichnen();
      }
      /* ZWEI WEGE, und sie ergaenzen sich:
         ResizeObserver  sieht die Gruppe selbst -- eine Bubble-Gruppe, die ihre Hoehe aendert,
                         ohne dass das Fenster sich bewegt (Bedingung, Reflow, aufgehender
                         Drawer). Das ist der Hauptweg.
         window.resize   der Rueckfall. Er sieht weniger, kostet fast nichts und faengt den
                         haeufigsten Fall trotzdem. Er ist ausserdem der EINZIGE Weg, der sich
                         hier messen laesst: die Zustellung des ResizeObservers haengt an der
                         Bildpipeline des Browsers, und die laeuft in einem verdeckten Fenster
                         nicht -- gemessen blieb die Zahl dort bei 11, waehrend die Rechnung
                         (refresh) 22 ergab. Ein Weg, den man nicht pruefen kann, sollte nicht
                         der einzige sein. */
      function beobachten(){
        if (beobachter) return;
        if (window.ResizeObserver){
          beobachter = new ResizeObserver(nachrechnen);
          beobachter.observe(root);
        }
        var uhr = null;
        window.addEventListener("resize", function(){
          /* Entprellt: waehrend jemand zieht, kommen Dutzende Ereignisse, und jedes wuerde
             messen. 120ms sind kuerzer als eine bewusste Bewegung und laenger als ein Bild. */
          clearTimeout(uhr);
          uhr = setTimeout(nachrechnen, 120);
        });
      }

      var api = {
        set: function (p) {
          /* readBubble ist der LISTEN-Leser: er gibt immer ein Array zurueck, auch fuer ein
             einzelnes Objekt -- gemessen kam fuer '{"variant":"rows"}' ein
             [{variant:"rows"}] heraus. Meine erste Fassung hat Arrays verworfen und der
             Setter tat damit gar nichts; der Prueftand hat es beim ersten Lauf gefangen.
             Genommen wird der erste Eintrag: mehr als eine Fassung kann ein Skelett nicht
             haben, und ein zweiter Eintrag waere eine Angabe zu viel und keine Liste. */
          var d = UC.readBubble ? UC.readBubble(p) : p;
          if (Array.isArray(d)) d = d[0];
          /* Bei einem kaputten Payload bleibt das Skelett stehen, wie es ist -- ein Skelett,
             das wegen eines Tippfehlers in einem Workflow verschwindet, sieht aus wie "fertig
             geladen" und ist die schlimmste Verwechslung, die diese Komponente anstellen kann.
             Eine Zeile in die Konsole, damit es nicht stumm bleibt. */
          if (!d || typeof d !== "object" || Array.isArray(d)) {
            if (p != null && String(p).trim() !== "" && window.console)
              console.warn("upstreem skeleton: setSkeleton konnte den Payload nicht lesen -- " +
                "das Skelett bleibt, wie es war.");
            return;
          }
          if (d.variant != null) Z.variant = d.variant;
          if (d.rows != null) Z.rows = d.rows;
          if (d.radius != null) Z.radius = d.radius;
          zeichnen();
        },
        reset: function () {
          Z = { variant: null, rows: null, radius: null };
          zeichnen();
        },
        /* refresh vergisst die gemerkte Zahl: sonst haelt letzteZahl ein Neuzeichnen auf,
           obwohl sich die Fassung geaendert hat. */
        refresh: function(){ letzteZahl = -1; letztesHtml = null; zeichnen(); }
      };

      zeichnen();
      beobachten();

      /* Die vier Attribute LIVE mitlesen: wechselt Bubble die Fassung oder das Thema, zieht das
         Skelett nach, ohne dass ein Workflow etwas rufen muss. Dieselbe Loesung wie in
         drawer-topbar, und aus demselben Grund. */
      if (window.MutationObserver) {
        new MutationObserver(function () { zeichnen(); }).observe(root, {
          attributes: true,
          attributeFilter: ["data-variant", "data-rows", "data-radius", "data-isdark"]
        });
      }

      root.__uskController = api;
      return api;
    }

    function each(id, fn) {
      var roots = document.getElementsByClassName("usk-root");
      for (var i = 0; i < roots.length; i++) {
        var r = roots[i];
        if (id != null && (r.getAttribute("data-instance") || "default") !== String(id)) continue;
        var c = r.__uskController || initRoot(r);
        if (c) fn(c);
      }
    }

    UC.makeMount({
      rootClass: "usk-root", notPortal: true,
      ctrlProp: "__uskController",
      resolveLocal: "__uskResolveLocal",
      initRoot: initRoot,
      queue: "__uskBootQueue",
      api: {
        setSkeleton: function (id, p) { return each(id, function (c) { c.set(p); }); },
        resetSkeleton: function (id) { return each(id, function (c) { c.reset(); }); }
      }
    });

    if (UC.watchRoots) UC.watchRoots("usk-root", function () {
      var roots = document.getElementsByClassName("usk-root");
      for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
    });
    [0, 100, 400, 1200].forEach(function (ms) {
      setTimeout(function () {
        var roots = document.getElementsByClassName("usk-root");
        for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
      }, ms);
    });
  }

  uskBoot(50);
})();
