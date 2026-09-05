/* upstreem discover-brands.js — "Discover Untracked Brands". Braucht core.js zuerst.

   Zeigt die wichtigsten Marken, die in den AI-Antworten des Teams vorkommen, aber NICHT im Konto
   getrackt werden -- absteigend nach Visibility, immer nur die vom Server gelieferte Spitze
   (aktuell 30). Jede Zeile hat einen Track-Knopf, der die Marke ins Konto holt.

   ── Was diese Tabelle bewusst NICHT hat ─────────────────────────────────────
   Keine Sortierung, keine Pagination, keinen Zeilenklick. Die Reihenfolge ist die Aussage der
   Tabelle ("das sind die wichtigsten"), und ein zweiter Sortierschluessel wuerde sie zerreden.
   Der Server liefert bereits nur die Spitze, es gibt also auch keine zweite Seite.

   ── Der Ladezustand ist hier kein Detail ────────────────────────────────────
   Der RPC dahinter laeuft bei grossen Teams 20-30 Sekunden. Ein Skelett aus grauen Balken
   behauptet in dieser Zeit, es kaeme gleich etwas; darum steht hier dieselbe Flaeche wie in
   prompt-research -- schwebender Kern, zwei pulsende Ringe, eine wechselnde Statuszeile. Sie sagt,
   dass gerechnet wird, und sie sagt es lange genug, ohne sich abzunutzen.

   ── Was aus core kommt ──────────────────────────────────────────────────────
     Tabellenrahmen        .up-table / .up-thead / .up-row / .up-th / .up-td
     Kopfzeile, Suche      .up-head / UC.makeSearch
     Menue-Schale          .up-menu / .up-filter-item / UC.makePopover
     Tooltips              UC.makeTooltips
     Bubble-Klempnerei     UC.makeMount / UC.makeFire */
(function () {
  "use strict";

  var API = ["renderDiscoverBrands", "setDiscoverBrandsLoading", "resetDiscoverBrands"];
  var Q = (window.__udbBootQueue = window.__udbBootQueue || []);
  if (!window.__udbBootStubbed) {
    window.__udbBootStubbed = true;
    API.forEach(function (n) { window[n] = function () { Q.push([n, [].slice.call(arguments)]); }; });
  }

  /* Statuszeilen der Ladeflaeche. Sie beschreiben die Schritte, die der RPC wirklich geht -- eine
     Zeile, die etwas anderes behauptet, waere schlimmer als gar keine. Alle 2,6s die naechste;
     bei 30 Sekunden Wartezeit laeuft die Liste knapp zweimal durch. */
  var STEPS = [
    "Reading your AI answers…",
    "Collecting mentioned brand names…",
    "Matching names against cited domains…",
    "Removing brands you already track…",
    "Ranking by visibility…"
  ];
  var STEP_MS = 2600;

  var SV = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  var ICON = {
    check:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="2.6"><path d="M20 6 9 17l-5-5" /></svg>',
    goto:   '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>',
    gear:   '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.8">' +
            '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/>' +
            '<circle cx="12" cy="12" r="3"/></svg>',
    search: '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>',
    x:      '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="2"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>',
    /* Der KOMPASS und nicht mehr die drei Ringe. Die Ringe waren ein Zielscheiben-Zeichen, und die
       Unterseite, auf der diese Suche laeuft, heisst "Discover" -- ihr Reiter im Seitenkopf traegt
       genau diesen Kompass (page-headers/brands-page-header.js, PAGES). Zwei Bilder fuer eine
       Sache waren es vorher. Pfad woertlich von dort uebernommen, nicht nachgezeichnet. */
    radar:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.8"><circle cx="12" cy="12" r="10" /> <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" /></svg>',
    empty:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.7"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>',
    /* Feather "box" als neutrales Markenlogo im Erklaerbeispiel. Nichts selbstgezeichnetes und
       nichts, was nach einer echten Firma aussieht -- es steht nur fuer "irgendeine Marke". */
    brand:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /> <path d="m3.3 7 8.7 5 8.7-5" /> <path d="M12 22V12" /></svg>'
  };

  /* Spalten in der Form, die UC.makeColumns erwartet: NUR die mittleren, abschaltbaren Spalten.
     Die Indexspalte davor kommt ueber cfg.leadWidth, die Markenspalte ueber cfg.firstKey, die
     Track-Spalte dahinter baut das Kit selbst (cfg.actionsMin).

     Hier stand vorher ein eigenes COLUMNS-Format mit `hideable` und selbstgebauten Abwurfstufen,
     dazu ein handgeschriebenes grid-template-columns in drei Varianten und ein eigenes
     Einstellungsmenue aus .up-filter-item mit Haekchen -- das sah dann auch komplett anders aus
     als das Zahnrad-Menue jeder anderen Tabelle, weil core dort .up-pop-row mit .up-switch und
     einem "Select all" baut. Nichts davon war noetig. Meine Begruendung dafuer ("die Indexspalte
     passt nicht in das Modell des Kits") war schlicht falsch: cfg.leadWidth existiert genau fuer
     diesen Fall, der Kommentar in core.js nennt woertlich brands-overviews "#"-Rangzelle.

     `prio` ist die Abwurfreihenfolge des Kits: kleinste Zahl faellt zuerst. Domain vor Mentioned
     Count, wie vorgegeben. */
  /* `min` MUSS die Untergrenze aus `w` sein, nicht kleiner. Das Kit rechnet beim Abwerfen mit
     `min`, das Raster bodenet aber bei der Zahl aus `w` -- stehen da verschiedene Werte, glaubt
     die Rechnung, es passe noch, waehrend die Spuren schon breiter sind als der Kasten. Ich hatte
     100/120/140 gegen 112/132/150 stehen: gemessen 5px Ueberlauf bei 700px Breite, und zwar genau
     die Differenz. Core beschreibt denselben Fehler im Kommentar zu minNarrow. */
  var COLUMNS = [
    { key: "vis",      label: "Visibility",      w: "minmax(112px, 0.7fr)", min: 112, prio: 30 },
    { key: "mentions", label: "Mentioned Count", w: "minmax(132px, 0.8fr)", min: 132, prio: 20 },
    { key: "domain",   label: "Domain",          w: "minmax(150px, 1fr)",   min: 150, prio: 10 }
  ];
  var IDX_W = 44;        // feste Breite der "#"-Spalte, wie in brands-overview
  /* Breite der Track-Spalte. Feste Zahlen, keine inhaltsabhaengige Spur: Kopf und Zeilen sind
     getrennte Raster und wuerden ein `auto` verschieden aufloesen (siehe Kommentar in core.js). */
  var TRACK_WIDE = 108, TRACK_NARROW = 56;

  function udbBoot(n) {
    if (!window.UpstreemCore) {
      if (n > 0) { setTimeout(function () { udbBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[discover-brands] UpstreemCore (core.js) not loaded");
      return;
    }
    udbRun();
  }

  function udbRun() {
    var UC = window.UpstreemCore;
    var esc = UC.esc;

    var MISSING = ["makeMount", "makeFire", "makeSearch", "makePopover", "makeTooltips", "makeSticky",
                   "makeExplain", "makeColumns", "widthTiers", "onResize", "rafThrottle", "esc", "storeKey"]
      .filter(function (k) { return typeof UC[k] !== "function"; });
    if (MISSING.length && window.console) {
      console.error("[discover-brands] The core.js on this page is OLDER than discover-brands.js and " +
        "is missing: " + MISSING.join(", ") + ". Pin every upstreem component on a page to the same commit.");
    }

    var mount;

    function initRoot(root) {
      if (root.__udbController) return;

      var instanceId = root.getAttribute("data-instance") || "default";
      var state = {
        rows: [], totalResponses: null,
        query: "", matched: true,
        /* Startet im Ladezustand. Der Scan laeuft 20 bis 30 Sekunden, und bis zur ersten Antwort
           gibt es NICHTS zu zeigen -- ohne das stand hier der Leerzustand, was aussah, als waere
           die Suche schon gelaufen und habe nichts gefunden. Der erste render() schaltet ab. */
        loading: true, hasData: false,
        cols: {}, widths: {}
      };


      root.innerHTML =
        '<div class="up-head">' +
          '<span class="up-heading">Discover Untracked Brands</span>' +
          '<span class="udb-total is-sk" data-total></span>' +
          '<div class="up-head-tools">' +
            /* KEIN data-tip hier. Der Knopf hat schon die Erklaerkarte (UC.makeExplain weiter
               unten), und data-tip haengt zusaetzlich den kleinen dunklen Chip aus UC.makeTooltips
               daran -- dann standen zwei Tooltips gleichzeitig unter dem Knopf. Genau einer pro
               Element. */
            '<button type="button" class="udb-matched is-on" data-matched aria-pressed="true">' +
              '<span class="udb-cb">' + ICON.check + '</span><span>Matched Brands</span>' +
            '</button>' +
            '<div class="up-search">' +
              '<button type="button" class="up-iconbtn up-search-btn" aria-label="Search" data-tip="Search">' + ICON.search + '</button>' +
              '<div class="up-search-box">' +
                '<input class="up-search-input up-field" type="text" placeholder="Search brands…" ' +
                  'autocomplete="off" spellcheck="false" />' +
                '<button type="button" class="up-search-clear" aria-label="Clear search">' + ICON.x + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="up-cols">' +
              '<button type="button" class="up-iconbtn up-cols-btn" data-tip="Table Settings" aria-label="Table settings">' + ICON.gear +
                /* Das Abzeichen am Zahnrad, wenn der Nutzer Spalten abgeschaltet hat -- syncColsBadge()
                   aus dem Kit schaltet es. Ohne dieses Span lief der Aufruf ins Leere. */
                '<span class="udb-cols-badge"></span></button>' +
              '<div class="up-menu up-cols-menu" data-colsmenu></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="up-box udb-box">' +
          '<div class="up-table" data-table></div>' +
          '<div class="udb-loading" data-loading aria-live="polite">' +
            '<div class="udb-loading-inner">' +
              '<div class="udb-mark">' +
                '<span class="udb-ring r1"></span><span class="udb-ring r2"></span>' +
                '<span class="udb-core">' + ICON.radar + '</span>' +
              '</div>' +
              '<div class="udb-ltitle">Scanning your AI answers</div>' +
              '<div class="udb-lloop"><div class="udb-ltext" data-ltext>' + esc(STEPS[0]) + '</div></div>' +
            '</div>' +
          '</div>' +
        '</div>';

      var elTable   = root.querySelector("[data-table]");
      var elTotal   = root.querySelector("[data-total]");
      var elMatched = root.querySelector("[data-matched]");
      var elLText   = root.querySelector("[data-ltext]");
      var elColsMenu= root.querySelector("[data-colsmenu]");
      var elSearch  = root.querySelector(".up-search");
      var elSearchIn= root.querySelector(".up-search-input");

      var fire = UC.makeFire(root, "udb", { eventPrefix: "udb-" });
      /* UC.themeParam statt isYes: kennt core ein Thema, gewinnt core -- das Attribut ist nur
         die Momentaufnahme aus dem Lauf des Workflows. */
      function isDark() { return UC.themeParam(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark"; }
      UC.makeTooltips(root, isDark);

      /* Der Tooltip erklaert die Mechanik, nicht den Knopf. "Matched Brands" allein sagt keinem,
         was passiert, wenn man es abschaltet -- und genau das ist die Frage. */
      UC.makeExplain({
        root: root, getIsDark: isDark, triggerSel: "[data-matched]",
        html: function () {
          /* MIT .up-explain-vis, der hellen Beispielplatte oben. Genau daran erkennt man diese
             Karte als Erklaerer: in jedem Tabellenkopf steht dort ein Beispiel des Wertes, den die
             Spalte zeigt, und darunter Ueberschrift und Text auf dem dunklen Grund. Meine Karte
             hatte nur die beiden Textzeilen -- selbes Bauteil, aber ohne die Platte sieht sie aus
             wie ein gewoehnlicher Tooltip statt wie die Erklaerer ueberall sonst. */
          return '<div class="up-explain-vis">' +
                   '<span class="up-explain-row">' +
                     '<span class="udb-explain-logo">' + ICON.brand + '</span>' +
                     '<span>Acme Inc. &middot; acme.com</span>' +
                   '</span>' +
                 '</div>' +
                 '<div class="up-explain-h">Matched Brands</div>' +
                 '<div class="up-explain-t">On: only brands where a cited domain could be assigned to the name, ' +
                 'the safer list. Off: brands are matched on the name alone, which finds more but also ' +
                 'catches look-alikes.</div>';
        }
      });

      /* ---------------- Suche ---------------- */
      var search = UC.makeSearch({
        root: root, box: elSearch, input: elSearchIn, state: state,
        mobileMax: 560, prefix: "udb",
        onRender: function () { renderTable(); },
        onFire: function (payload) { fire("data-search-fn", "udbSearch", payload); }
      });

      /* ---------------- Einstellungen ----------------
         Das ganze Tabellengeruest kommt aus UC.makeColumns: Rasterberechnung, Abwerfen bei
         Platzmangel, der Ziehgriff an der Markenspalte und das Zahnrad-Menue. Damit sieht das
         Menue aus wie in jeder anderen Tabelle -- .up-pop-row mit .up-switch und "Select all" --
         statt wie die Haekchenliste, die ich hier vorher selbst gebaut hatte. */
      var colsKit = UC.makeColumns({
        root: root, state: state, columns: COLUMNS,
        storePrefix: "udb", instanceId: instanceId,
        firstKey: "brand", firstMin: 160,
        /* Die "#"-Spalte: feste Breite, nie ausblendbar, nie ziehbar. Genau der Fall, fuer den
           cfg.leadWidth in core existiert. */
        leadWidth: IDX_W,
        /* Breit traegt der Track-Knopf seine Beschriftung, schmal ist er quadratisch -- die Spur
           folgt dem. Als Funktion, weil das Kit sie bei jeder Rasterrechnung neu abfragt. */
        actionsMin: function () { return root.classList.contains("is-narrow") ? TRACK_NARROW : TRACK_WIDE; },
        badgeSel: ".udb-cols-badge", cellPrefixes: ["up", "udb"],
        onChange: function () { renderTable(); }
      });
      state.cols = colsKit.readCols();
      state.widths = colsKit.readWidths();
      var applyCols = colsKit.applyCols, startResize = colsKit.startResize;
      var populateCols = colsKit.populateCols, toggleCol = colsKit.toggleCol;
      var selectAllCols = colsKit.selectAllCols, syncColsBadge = colsKit.syncColsBadge;
      var visibleCols = colsKit.visibleCols;
      function colOn(k) { return state.cols[k] !== false; }

      /* Ziehgriff an der Markenspalte, wie in jeder anderen Tabelle. */
      root.addEventListener("pointerdown", function (e) {
        var grip = e.target.closest(".up-grip");
        if (grip) startResize(e, grip);
      });

      var colsPop = UC.makePopover({
        wrap: root.querySelector(".up-cols"),
        menu: elColsMenu,
        opener: root.querySelector(".up-cols-btn"),
        group: "udb-" + instanceId
      });
      elColsMenu.addEventListener("click", function (e) {
        if (e.target.closest("[data-colsall]")) { selectAllCols(); populateCols(); return; }
        var row = e.target.closest("[data-col]");
        if (!row) return;
        toggleCol(row.getAttribute("data-col"));
        populateCols();
      });
      root.querySelector(".up-cols-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        if (colsPop.isOpen()) { colsPop.close(false); return; }
        populateCols(); colsPop.open();
      });

      /* ---------------- Suche ----------------
         UC.makeSearch haengt seine Listener NICHT selbst an -- es gibt toggle/onInput/cancel nur
         zurueck, und die Komponente verdrahtet sie. Hier fehlte genau das: das Suchfeld war
         gebaut und gestylt, aber Lupe, Tippen und das X hingen an nichts. Das Feld sah benutzbar
         aus und tat nichts -- der schlechteste Zustand von allen. Gleiche Verdrahtung wie in
         urls-table. */
      root.querySelector(".up-search-btn").addEventListener("click", function (e) {
        e.stopPropagation();
        colsPop.close(false);
        search.toggle();
      });
      elSearchIn.addEventListener("input", function () { search.onInput(); });
      elSearchIn.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.stopPropagation(); search.toggle(); }
      });
      root.querySelector(".up-search-clear").addEventListener("click", function (e) {
        e.stopPropagation();
        /* Schmal ist das offene Feld die ganze Werkzeugleiste -- dort schliesst das X die Suche,
           statt nur den Text zu loeschen. Sonst bliebe ein leeres Feld ueber der Tabelle stehen. */
        if (root.classList.contains("is-searchtakeover")) { search.toggle(); return; }
        elSearchIn.value = ""; state.query = "";
        elSearch.classList.remove("has-text");
        search.cancel(); search.run();
        try { elSearchIn.focus(); } catch (e2) {}
      });

      /* ---------------- Matched-Schalter ---------------- */
      elMatched.addEventListener("click", function () {
        state.matched = !state.matched;
        elMatched.classList.toggle("is-on", state.matched);
        elMatched.setAttribute("aria-pressed", state.matched ? "true" : "false");
        /* Das Umschalten aendert die SERVERSEITIGE Auswahl, nicht nur die Anzeige: ohne Matching
           kommen andere Marken zurueck. Also Ladezustand an und auf neue Daten warten. */
        setLoading(true);
        fire("data-matched-fn", "udbMatched", { matched: state.matched ? "yes" : "no" });
      });

      /* ---------------- Breite ----------------
         Das Abwerfen der Spalten macht applyCols() aus dem Kit: es misst den Container, rechnet
         gegen die Mindestbreiten und schreibt das Raster als --up-cols auf die Wurzel. Hier stand
         vorher eine eigene Messung mit zwei Schwellen und drei handgeschriebenen
         grid-template-columns, die mit den anderen Tabellen nichts gemeinsam hatte. */
      /* Die Stufenklassen is-narrow / is-vnarrow setzt UC.widthTiers, NICHT diese Datei.
         Ich hatte hier erst is-t2 gesetzt (das heisst in urls-table und domains-table "Aktions-
         spalte ganz ausblenden" -- der Track-Knopf ist hier aber der Grund fuer die Tabelle) und
         danach is-narrow von Hand bei 720px. Beides war falsch: is-narrow ist eine KLASSE VON
         CORE. makeColumns liest sie in seiner eigenen Rasterrechnung, mein Toggle hat der
         Spaltenlogik also eine andere Stufe untergeschoben als die, in der sie sich glaubte --
         messbar als 5px Ueberlauf, weil die Rechnung von anderen Spuren ausging als das Raster.
         Jetzt setzt widthTiers die Klassen (768 / 500) und das Kit sieht dieselbe Stufe wie das
         CSS. Der Track-Knopf haengt an is-narrow, die Aktionsspur bleibt immer im Template und
         ihre `auto`-Seite folgt der echten Knopfbreite. */
      UC.widthTiers(root);
      UC.onResize(root, function () { applyCols(); });

      /* Sticky-Kopf. Genau wie in jeder anderen Tabelle ueber UC.makeSticky, NICHT von Hand:
         das Kit setzt die Klasse nur ab 1000px Seitenbreite (darunter kaempft ein klebender Kopf
         mit den zusammenklappenden Filtern), liest data-sticky / data-sticky-top, misst die Hoehe
         der Kopfzeile in --up-thead-off -- ohne das landet der Spaltenkopf UNTER der Kopfzeile
         statt darunter -- und loest die Bubble-Wrapper aus ihrem overflow:hidden, in dem sonst
         sowohl das Kleben als auch das Zahnrad-Menue steckenbleibt. */
      var sticky = UC.makeSticky(root, root.querySelector(".up-head"));
    /* Nicht mehr an jedem Bild: applySticky misst die Kopfzeile (syncTheadOffset) und laeuft die
       Vorfahrenkette hoch. In der Messung des Nutzers standen dahinter 703 rAF-Anmeldungen und
       446 Lesezugriffe allein fuer syncTheadOffset. Am Ende der Bewegung reicht es -- die Leiste
       klebt waehrend des Ziehens ohnehin da, wo sie war. */
      if (UC.aufResize) UC.aufResize(sticky.applySticky);
      else window.addEventListener("resize", UC.rafThrottle(sticky.applySticky));
      sticky.applySticky();

      /* ---------------- Ladeflaeche ---------------- */
      var stepIdx = 0, stepTimer = null;
      function stepTick() {
        var t = elLText;
        /* Nicht in einer geparkten Ansicht. Der Ticker laeuft im Takt weiter, aber das
           void t.offsetWidth unten ist ein Reflow-Ausloeser -- und in einem Teilbaum, den der
           Browser wegen content-visibility auslaesst, zwingt er ihn, ihn doch zu layouten.
           Auf der echten Seite war das mit 15 Zugriffen in 20 Sekunden Ruhe der groesste Posten
           (gemessen mit bubble/diagnostics/_diagnose_parkleser.js). Zu sehen ist die Animation
           dort ohnehin nicht. */
        if (window.UpstreemCore && window.UpstreemCore.messbar &&
            !window.UpstreemCore.messbar(t)) return;
        t.classList.add("is-out");
        setTimeout(function () {
          stepIdx = (stepIdx + 1) % STEPS.length;
          t.style.transition = "none";
          t.classList.remove("is-out"); t.classList.add("is-in");
          t.textContent = STEPS[stepIdx];
          void t.offsetWidth;
          t.style.transition = "";
          t.classList.remove("is-in");
        }, 240);
      }
      function setLoading(on) {
        on = !!on;
        /* Gegen die KLASSE pruefen, nicht gegen state.loading. UC.makeSearch schreibt bei jeder
           Suche selbst state.loading = true (dort ist das Flag fuer die Dimm-Mechanik der grossen
           Tabellen gedacht), ohne die Ladeflaeche einzuschalten. Haenge der Waechter am Flag,
           waere es nach der ersten Suche dauerhaft true -- und ein spaeteres
           setDiscoverBrandsLoading("yes") aus Bubble liefe wirkungslos ins Leere, der Nutzer saehe
           beim Umschalten von Matched Brands keinen Ladezustand mehr. Die Klasse ist das, was
           wirklich sichtbar ist, also entscheidet sie. */
        if (on === root.classList.contains("is-loading")) { state.loading = on; return; }
        state.loading = on;
        root.classList.toggle("is-loading", on);
        clearInterval(stepTimer);
        if (on) startStepTimer();
      }
      function startStepTimer() {
        clearInterval(stepTimer);
        stepIdx = 0; elLText.textContent = STEPS[0];
        elLText.classList.remove("is-out", "is-in");
        stepTimer = setInterval(stepTick, STEP_MS);
        elTotal.classList.add("is-sk"); elTotal.textContent = "";
      }

      /* ---------------- Rendern ---------------- */
      /* Der Suchtext filtert HIER, nicht nur serverseitig: die Liste ist auf 30 Zeilen begrenzt und
         liegt komplett im Browser, also darf das Feld sofort wirken statt auf eine Antwort zu
         warten. Das Event geht trotzdem raus -- der Server kann die Auswahl breiter fassen. */
      function filtered() {
        var q = state.query.trim().toLowerCase();
        if (!q) return state.rows;
        return state.rows.filter(function (r) {
          return (r.name || "").toLowerCase().indexOf(q) !== -1 ||
                 (r.domain || "").toLowerCase().indexOf(q) !== -1;
        });
      }
      function initials(name) { return esc(String(name || "?").trim().charAt(0).toUpperCase() || "?"); }

      /* Jede Zelle traegt ihren Spaltenschluessel als Klasse (up-th-<key> / up-td-<key>) -- danach
         blendet applyCols() aus dem Kit sie ein und aus. Vorher hiessen sie udb-h-* / udb-c-*, was
         das Kit nicht kennt.

         Gebaut wird aus visibleCols(), also aus der ABWAHL DES NUTZERS -- nicht aus
         effectiveCols(), das zusaetzlich die Breite einrechnet. Der Unterschied ist nicht
         kosmetisch: effectiveCols() misst, und beim allerersten Render steht die Messung noch
         nicht (das Markup wurde gerade erst geschrieben). Der Kopf entstand dann aus einer zu
         kleinen Breite mit 4 Zellen, waehrend applyCols() eine Zeile spaeter mit der richtigen
         Breite 6 Spuren schrieb -- die Tabelle stand mit zwei fehlenden Spalten da, bis irgendein
         zweiter Render sie zufaellig geradezog. Alle Spalten bauen und applyCols() ausblenden
         lassen ist genau das, wofuer das Kit die Zellen mit ihrem Schluessel markiert; so macht es
         auch brands-overview. */
      function cellHtml(c, r) {
        if (c.key === "vis") return '<span class="up-num' + (r.visibility_pct == null ? " is-empty" : "") + '">' +
          (r.visibility_pct == null ? "–" : Math.round(r.visibility_pct) + "%") + "</span>";
        if (c.key === "mentions") return '<span class="up-num' + (r.mentioned_count == null ? " is-empty" : "") + '">' +
          (r.mentioned_count == null ? "–" : r.mentioned_count) + "</span>";
        if (c.key === "domain") {
          if (!r.domain) return '<span class="up-num is-empty">–</span>';
          return '<span class="udb-domwrap">' +
            '<span class="udb-dom" title="' + esc(r.domain) + '">' + esc(r.domain) + "</span>" +
            '<button type="button" class="udb-go" data-go="' + esc(r.url) + '" ' +
              'data-tip="Open in new tab" aria-label="Open ' + esc(r.domain) + ' in a new tab">' + ICON.goto + "</button>" +
            "</span>";
        }
        return "";
      }

      function headHtml() {
        var h = '<div class="up-thead">' +
          /* Ikone statt des Zeichens "#", genau wie die Rangspalte in brands-overview. */
          '<div class="up-th up-th-idx">' + UC.HASH_ICON + "</div>" +
          '<div class="up-th up-th-brand">Brand</div>';
        visibleCols().forEach(function (c) {
          h += '<div class="up-th up-th-' + c.key + '">' + esc(c.label) + "</div>";
        });
        return h + '<div class="up-th up-th-act"></div></div>';
      }

      function rowHtml(r, i) {
        var h = '<div class="up-row">' +
          '<div class="up-td up-td-idx">' + (i + 1) + "</div>" +
          '<div class="up-td up-td-brand">' +
            '<span class="up-logo-box' + (r.favicon ? " has-img" : "") + '">' +
              (r.favicon
                ? '<img src="' + esc(r.favicon) + '" alt="" loading="lazy" referrerpolicy="no-referrer" />'
                : initials(r.name)) +
            "</span>" +
            '<span class="udb-name" title="' + esc(r.name) + '">' + esc(r.name) + "</span>" +
          "</div>";
        visibleCols().forEach(function (c) {
          h += '<div class="up-td up-td-' + c.key + '">' + cellHtml(c, r) + "</div>";
        });
        return h + '<div class="up-td up-td-act">' +
          '<button type="button" class="udb-track" data-track="' + esc(r.id) + '">' +
          ICON.check + '<span class="udb-track-label">Track</span></button></div></div>';
      }

      function renderTable() {
        var rows = filtered();
        var head = headHtml();

        if (!rows.length) {
          elTable.innerHTML = head +
            '<div class="up-empty">' +
              '<div class="up-empty-ic">' + ICON.empty + "</div>" +
              /* Drei verschiedene Gruende, nichts zu zeigen, und drei verschiedene Texte. Der
                 dritte ist der wichtigste: solange NIE Daten ankamen, darf hier keine Aussage
                 ueber das Ergebnis stehen. Vorher stand da "Every brand we could match to a domain
                 is already tracked" -- ein Befund, den zu dem Zeitpunkt niemand kennt, weil der
                 Scan noch laeuft oder gar nicht erst angelaufen ist. Ein ausgefallener Aufruf sah
                 damit genauso aus wie ein sauberes Ergebnis. */
              /* Vierter Fall, seit der Parse-Fehler nicht mehr als "leer" durchgeht: die Daten
                 KAMEN an, waren aber unlesbar. Das ist ein Fehler und muss auch so heissen. */
              '<div class="up-empty-h">' + (state.parseError ? "Could not load brands" :
                (state.query ? "No brand matches your search" :
                (state.hasData ? "No untracked brands found" : "No results yet"))) + "</div>" +
              /* Der Fehlertext sagt, was der Nutzer TUN kann, und sonst nichts. Vorher stand hier
                 "The data arrived in a form this component could not parse. See the browser
                 console for details." -- eine Entwicklermeldung im Nutzer-UI: "this component"
                 ist ein interner Name, und die Konsole liest niemand, den es angeht.
                 Gleicher Wortlaut wie UC.leseFehlerHtml, damit ueberall dasselbe dasteht. */
              '<div class="up-empty-t">' + (state.parseError
                ? "The data could not be read. Please reload the page."
                : state.query
                ? "Try a shorter search term."
                : !state.hasData
                  ? "The scan has not returned anything yet. Refresh the page if this stays empty."
                  : (state.matched
                      ? "Every brand we could match to a domain is already tracked. Turn off Matched Brands to match on names alone."
                      : "No brand names were found in your AI answers for this period.")) + "</div>" +
            "</div>";
          applyCols(); syncColsBadge();
          return;
        }

        elTable.innerHTML = head + '<div class="up-tbody">' +
          rows.map(rowHtml).join("") + "</div>";
        applyCols(); syncColsBadge();
      }

      function renderTotal() {
        /* Bei einem Lesefehler kommt keine Zahl mehr -- ein pulsender Balken behauptet dann,
           sie sei unterwegs. Gemessen am 24.08.: der Zaehler war das letzte sichtbare Skelett,
           obwohl die Tabelle darunter schon den Fehler zeigte. */
        if (state.parseError) { elTotal.classList.remove("is-sk"); elTotal.textContent = ""; return; }
        if (state.totalResponses == null) { elTotal.classList.add("is-sk"); elTotal.textContent = ""; return; }
        elTotal.classList.remove("is-sk");
        elTotal.textContent = "Total Responses analyzed: " +
          (UC.fmtTotal ? UC.fmtTotal(state.totalResponses) : state.totalResponses);
      }
      /* measure() steht mit im render(), nicht nur im ResizeObserver. Der Beobachter ist der
         richtige Weg fuer eine Bubble-Gruppe, die sich ohne Fenster-Resize aendert -- aber wenn
         er ausfaellt (im Test-Harness feuert er nachweislich gar nicht, auch die vom Standard
         garantierte Erstzustellung nicht), stuende die Tabelle sonst dauerhaft in der falschen
         Stufe. measure() bricht ab, sobald sich nichts geaendert hat, kostet hier also nichts. */
      function render() {
        renderTotal(); renderTable();
        /* Die Kopfzeile kann ihre Hoehe zwischen zwei Rendern aendern (Totalcount vom Skelett
           auf echten Text, Suchfeld auf-/zugeklappt). Ohne das Nachmessen bleibt der
           Spaltenkopf am alten Versatz kleben. */
        if (root.classList.contains("up-sticky")) sticky.syncTheadOffset();
      }

      /* ---------------- Klicks in der Tabelle ---------------- */
      elTable.addEventListener("click", function (e) {
        var go = e.target.closest("[data-go]");
        if (go) {
          var u = go.getAttribute("data-go");
          if (u) { try { window.open(u, "_blank", "noopener"); } catch (err) { location.href = u; } }
          return;
        }
        var tr = e.target.closest("[data-track]");
        if (tr) {
          var id = tr.getAttribute("data-track");
          var row = null;
          for (var i = 0; i < state.rows.length; i++) if (state.rows[i].id === id) { row = state.rows[i]; break; }
          if (!row) return;
          /* Der Knopf sperrt sich sofort. Das Anlegen laeuft in Bubble, und ein Knopf, der nach
             dem Klick noch klickbar aussieht, wird ein zweites Mal gedrueckt. */
          tr.disabled = true;
          fire("data-track-fn", "udbTrack", { name: row.name, domain: row.domain || "" });
        }
      });

      /* ---------------- Daten herein ---------------- */
      function normRows(list) {
        if (!Array.isArray(list)) return [];
        return list.map(function (r, i) {
          /* recognized_urls ist eine Liste, weil ein Name auf mehrere Domains passen kann. Die
             Tabelle zeigt EINE Domain -- die erste ist die vom Server am besten bewertete. */
          var u = (Array.isArray(r.recognized_urls) && r.recognized_urls[0]) || {};
          return {
            id: "r" + i + "_" + String(r.name || ""),
            name: String(r.name == null ? "" : r.name),
            visibility_pct: r.visibility_pct == null ? null : Number(r.visibility_pct),
            mentioned_count: r.mentioned_count == null ? null : Number(r.mentioned_count),
            domain: u.domain ? String(u.domain) : "",
            url: u.root_url ? String(u.root_url) : (u.domain ? "https://" + u.domain : ""),
            favicon: u.favicon_url ? String(u.favicon_url) : ""
          };
        });
      }

      var ctrl = {
        render: function (p) {
          p = p || {};
          var list = p.rows != null ? p.rows : p.brands;
          /* normParams in core hat den Text schon geparst; scheiterte das, liegt hier eine leere
             Liste UND ein __parseError-Vermerk. Ohne den sah ein zerrissener Payload genauso aus
             wie ein sauberes leeres Ergebnis, und die Ansicht behauptete "No untracked brands
             found" -- ein Befund, den zu dem Zeitpunkt niemand hat. */
          state.parseError = !!p.__parseError;
          if (state.parseError){
            state.rows = [];
            if (window.console) console.error("discover-brands: die Zeilen liessen sich nicht lesen. " +
              "Die Konsolenwarnung darueber zeigt, an welcher Stelle das JSON gerissen ist.");
            setLoading(false);
            render();
            return;
          }
          state.rows = normRows(list);
          state.hasData = true;
          /* runs_total steht in jeder Zeile und ist ueberall gleich -- als Rueckfall, wenn der
             Aufruf total_responses nicht mitgibt. Lieber aus den Daten lesen als leer lassen. */
          var t = p.total_responses != null ? p.total_responses
                : (p.totalResponses != null ? p.totalResponses
                : (Array.isArray(list) && list[0] && list[0].runs_total != null ? list[0].runs_total : null));
          state.totalResponses = t == null ? null : Number(t);
          setLoading(false);
          render();
        },
        setLoading: function (v) {
          /* Ein NEUER Ladeversuch raeumt den Lesefehler weg -- sonst ueberlebt er jeden weiteren
             Versuch und steht noch da, waehrend frische Daten unterwegs sind. */
          if (UC.isYes(v)) state.parseError = false;
          setLoading(UC.isYes(v));
        },
        reset: function () {
          state.rows = []; state.totalResponses = null; state.hasData = false; state.parseError = false;
          /* makeSearch hat KEIN reset() -- der alte Aufruf lief in ein undefined und wurde vom
             try verschluckt, das Feld blieb also offen und mit Text stehen. Von Hand zuruecksetzen
             und die laufende Entprellung abbrechen, sonst feuert nach dem Reset noch die alte
             Anfrage nach. */
          state.query = "";
          if (elSearchIn) elSearchIn.value = "";
          if (elSearch) elSearch.classList.remove("is-open", "has-text");
          root.classList.remove("is-searchtakeover");
          search.cancel();
          setLoading(false); render();
        },
        setTheme: function (t) { if (UC.setUpstreemTheme) UC.setUpstreemTheme(t); }
      };
      root.__udbController = ctrl;
      root.__udbResolveLocal = function (id) { return (root.getAttribute("data-instance") || "default") === id; };

      /* Ladezustand von Anfang an: root.classList und der Statustakt muessen zum state.loading
         aus dem Zustandsobjekt passen, sonst zeigt setLoading(false) beim ersten Render ins
         Leere. */
      root.classList.add("is-loading");
      startStepTimer();
      render();
    }

    function each(id, fn) { mount.rootsWithId(id).forEach(function (r) { if (r.__udbController) fn(r.__udbController); }); }

    mount = UC.makeMount({
      onMount: function (m) { mount = m; },
      rootClass: "udb-root", notPortal: true,
      ctrlProp: "__udbController",
      resolveLocal: "__udbResolveLocal",
      queue: "__udbBootQueue",
      initRoot: initRoot,
      api: {
        renderDiscoverBrands: function (p) {
          p = p || {};
          each(p.instanceId || "default", function (c) { c.render(p); });
        },
        setDiscoverBrandsLoading: function (id, v) { each(id || "default", function (c) { c.setLoading(v); }); },
        resetDiscoverBrands: function (id) { each(id || "default", function (c) { c.reset(); }); }
      },
      forwardShape: { renderDiscoverBrands: "params", resetDiscoverBrands: "id" }
    });
  }

  udbBoot(50);
})();
