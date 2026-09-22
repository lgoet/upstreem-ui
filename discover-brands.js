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
    check:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="2.6"><path d="M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7"/></svg>',
    goto:   '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="M9.14339 10.691L9.35031 10.4841C11.329 8.50532 14.5372 8.50532 16.5159 10.4841C18.4947 12.4628 18.4947 15.671 16.5159 17.6497L13.6497 20.5159C11.671 22.4947 8.46279 22.4947 6.48405 20.5159C4.50532 18.5372 4.50532 15.329 6.48405 13.3503L6.9484 12.886"/><path d="M17.0516 11.114L17.5159 10.6497C19.4947 8.67095 19.4947 5.46279 17.5159 3.48405C15.5372 1.50532 12.329 1.50532 10.3503 3.48405L7.48405 6.35031C5.50532 8.32904 5.50532 11.5372 7.48405 13.5159C9.46279 15.4947 12.671 15.4947 14.6497 13.5159L14.8566 13.309"/></svg>',
    gear:   '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.8"><path d="M21.3175 7.14139L20.8239 6.28479C20.4506 5.63696 20.264 5.31305 19.9464 5.18388C19.6288 5.05472 19.2696 5.15664 18.5513 5.36048L17.3311 5.70418C16.8725 5.80994 16.3913 5.74994 15.9726 5.53479L15.6357 5.34042C15.2766 5.11043 15.0004 4.77133 14.8475 4.37274L14.5136 3.37536C14.294 2.71534 14.1842 2.38533 13.9228 2.19657C13.6615 2.00781 13.3143 2.00781 12.6199 2.00781H11.5051C10.8108 2.00781 10.4636 2.00781 10.2022 2.19657C9.94085 2.38533 9.83106 2.71534 9.61149 3.37536L9.27753 4.37274C9.12465 4.77133 8.84845 5.11043 8.48937 5.34042L8.15249 5.53479C7.73374 5.74994 7.25259 5.80994 6.79398 5.70418L5.57375 5.36048C4.85541 5.15664 4.49625 5.05472 4.17867 5.18388C3.86109 5.31305 3.67445 5.63696 3.30115 6.28479L2.80757 7.14139C2.45766 7.74864 2.2827 8.05227 2.31666 8.37549C2.35061 8.69871 2.58483 8.95918 3.05326 9.48012L4.0843 10.6328C4.3363 10.9518 4.51521 11.5078 4.51521 12.0077C4.51521 12.5078 4.33636 13.0636 4.08433 13.3827L3.05326 14.5354C2.58483 15.0564 2.35062 15.3168 2.31666 15.6401C2.2827 15.9633 2.45766 16.2669 2.80757 16.8741L3.30114 17.7307C3.67443 18.3785 3.86109 18.7025 4.17867 18.8316C4.49625 18.9608 4.85542 18.8589 5.57377 18.655L6.79394 18.3113C7.25263 18.2055 7.73387 18.2656 8.15267 18.4808L8.4895 18.6752C8.84851 18.9052 9.12464 19.2442 9.2775 19.6428L9.61149 20.6403C9.83106 21.3003 9.94085 21.6303 10.2022 21.8191C10.4636 22.0078 10.8108 22.0078 11.5051 22.0078H12.6199C13.3143 22.0078 13.6615 22.0078 13.9228 21.8191C14.1842 21.6303 14.294 21.3003 14.5136 20.6403L14.8476 19.6428C15.0004 19.2442 15.2765 18.9052 15.6356 18.6752L15.9724 18.4808C16.3912 18.2656 16.8724 18.2055 17.3311 18.3113L18.5513 18.655C19.2696 18.8589 19.6288 18.9608 19.9464 18.8316C20.264 18.7025 20.4506 18.3785 20.8239 17.7307L21.3175 16.8741C21.6674 16.2669 21.8423 15.9633 21.8084 15.6401C21.7744 15.3168 21.5402 15.0564 21.0718 14.5354L20.0407 13.3827C19.7887 13.0636 19.6098 12.5078 19.6098 12.0077C19.6098 11.5078 19.7888 10.9518 20.0407 10.6328L21.0718 9.48012C21.5402 8.95918 21.7744 8.69871 21.8084 8.37549C21.8423 8.05227 21.6674 7.74864 21.3175 7.14139Z"/><path d="M15.5195 12C15.5195 13.933 13.9525 15.5 12.0195 15.5C10.0865 15.5 8.51953 13.933 8.51953 12C8.51953 10.067 10.0865 8.5 12.0195 8.5C13.9525 8.5 15.5195 10.067 15.5195 12Z"/></svg>',
    search: '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="M17 17L21 21"/><path d="M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z"/></svg>',
    x:      '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="2"><path d="M18 6L6.00081 17.9992M17.9992 18L6 6.00085"/></svg>',
    /* Der KOMPASS und nicht mehr die drei Ringe. Die Ringe waren ein Zielscheiben-Zeichen, und die
       Unterseite, auf der diese Suche laeuft, heisst "Discover" -- ihr Reiter im Seitenkopf traegt
       genau diesen Kompass (page-headers/brands-page-header.js, PAGES). Zwei Bilder fuer eine
       Sache waren es vorher. Pfad woertlich von dort uebernommen, nicht nachgezeichnet. */
    radar:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.8"><circle cx="12" cy="13" r="9"/><path d="M12 3.5V2"/><path d="M10 2H14"/><path d="M14.7728 10.2571C15.5061 10.9837 14.3328 16.8933 13.1289 16.9974C12.1189 17.0848 11.8041 15.0928 11.5914 14.4614C11.3815 13.8383 11.1478 13.6139 10.5298 13.4095C8.95989 12.8901 8.17492 12.6304 8.0195 12.2192C7.60796 11.1304 13.8362 9.32902 14.7728 10.2571Z"/></svg>',
    /* Feather "box" als neutrales Markenlogo im Erklaerbeispiel. Nichts selbstgezeichnetes und
       nichts, was nach einer echten Firma aussieht -- es steht nur fuer "irgendeine Marke". */
    brand:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="M2.5 7.5V13.5C2.5 17.2712 2.5 19.1569 3.67157 20.3284C4.84315 21.5 6.72876 21.5 10.5 21.5H13.5C17.2712 21.5 19.1569 21.5 20.3284 20.3284C21.5 19.1569 21.5 17.2712 21.5 13.5V7.5"/><path d="M3.86909 5.31461L2.5 7.5H21.5L20.2478 5.41303C19.3941 3.99021 18.9673 3.2788 18.2795 2.8894C17.5918 2.5 16.7621 2.5 15.1029 2.5H8.95371C7.32998 2.5 6.51812 2.5 5.84013 2.8753C5.16215 3.2506 4.73113 3.93861 3.86909 5.31461Z"/><path d="M12 7.5V2.5"/><path d="M10 10.5H14"/></svg>'
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
  /* Auf Deutsch heisst "Track" -> "Beobachten", und das ist mehr als doppelt so breit.
     GEMESSEN mit der Schrift der App (13px/500) plus Zeichen 14, Abstand 6 und Polster 2x12:
     Englisch braucht 78px, Deutsch 118. Die 108 reichten damit fuer Englisch bequem und fuer
     Deutsch NICHT -- der Knopf war abgeschnitten (10.09. gemeldet).
     128 statt der gemessenen 118: zehn Pixel Luft, damit eine leicht andere Schriftmetrik auf
     einem anderen Rechner nicht doch wieder schneidet.
     Als Funktion und ueber data-up-locale am <html>: core setzt die Marke in jedem Sprachlauf,
     genau dafuer gibt es sie. Dieselbe Loesung wie die Einladungstabelle in team-orga, nur dort
     in CSS -- hier rechnet das Spaltenraster in JS, also steht die Zahl hier. */
  var TRACK_WIDE_EN = 108, TRACK_WIDE_DE = 128, TRACK_NARROW = 56;
  function trackWide(){
    var l = "";
    try { l = document.documentElement.getAttribute("data-up-locale") || ""; } catch(e){}
    return l === "de" ? TRACK_WIDE_DE : TRACK_WIDE_EN;
  }

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
        actionsMin: function () { return root.classList.contains("is-narrow") ? TRACK_NARROW : trackWide(); },
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
          /* Der Lesefehler ist ein FEHLER und kein Leerzustand -- er hat seinen eigenen
             Baustein. Hier stand sein Wortlaut nachgebaut, mit dem Kommentar "Gleicher Wortlaut
             wie UC.leseFehlerHtml, damit ueberall dasselbe dasteht": genau das haelt jetzt der
             Baustein selbst, statt es in dieser Datei nachzupflegen. */
          if (state.parseError){
            elTable.innerHTML = head + UC.leseFehlerHtml("brands");
            applyCols(); syncColsBadge();
            return;
          }
          /* Drei verschiedene Gruende, nichts zu zeigen, und drei verschiedene Texte. Der dritte
             ist der wichtigste: solange NIE Daten ankamen, darf hier keine Aussage ueber das
             Ergebnis stehen. Vorher stand da "Every brand we could match to a domain is already
             tracked" -- ein Befund, den zu dem Zeitpunkt niemand kennt, weil der Scan noch laeuft
             oder gar nicht erst angelaufen ist. Ein ausgefallener Aufruf sah damit genauso aus
             wie ein sauberes Ergebnis.
             Die Lupe kam bisher aus ICON.empty, einer eigenen Zeichnung in dieser Datei -- der
             dritten desselben Symbols im Repo. Kein Raeum-Knopf: diese Liste hat keinen. */
          elTable.innerHTML = head + UC.leerHtml({
            icon: "search", knopf: "",
            titel: state.query ? "No brand matches your search"
                 : (state.hasData ? "No untracked brands found" : "No results yet"),
            text: state.query ? "Try a shorter search term."
                : (!state.hasData
                    ? "The scan has not returned anything yet. Refresh the page if this stays empty."
                    : (state.matched
                        ? "Every brand we could match to a domain is already tracked. Turn off Matched Brands to match on names alone."
                        : "No brand names were found in your AI answers for this period."))
          });
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
        /* BESCHRIFTUNG UND ZAHL GETRENNT. Vorher stand beides in EINEM Textknoten
           ("Total Responses analyzed: 12.345"), und der Sprachlauf sucht den ganzen Knoten im
           Katalog -- mit der Zahl daran findet er ihn nie. Der Eintrag existierte die ganze
           Zeit ("Ausgewertete KI-Antworten:"), er war nur unerreichbar. Gemeldet am 10.09.
           Jetzt traegt ein eigenes Element die Beschriftung, und die Zahl steht daneben. */
        var SCHL = "Total Responses analyzed:";
        /* data-i18n mit dem englischen Schluessel: daran erkennt der Sprachlauf das Element auch
           dann noch, wenn schon der deutsche Text darin steht -- sonst waere ein Wechsel zurueck
           nach Englisch nicht mehr moeglich. Uebersetzt wird hier gleich mit UC.t, damit der
           englische Text nicht kurz aufblitzt. */
        elTotal.innerHTML = '<span class="udb-total-lbl" data-i18n="' + esc(SCHL) + '">' +
          esc(UC.t(SCHL)) + '</span> <span class="udb-total-n"></span>';
        elTotal.querySelector(".udb-total-n").textContent =
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
