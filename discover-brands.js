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
    check:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="2.6"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    goto:   '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
    gear:   '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.8"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>',
    search: '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    x:      '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    radar:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.8"><circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4.5"></circle><line x1="12" y1="12" x2="19" y2="7"></line></svg>',
    empty:  '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.7"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>'
  };

  /* Spalten. `hideable` steuert nur, ob die Spalte im Einstellungsmenue auftaucht: #, Brand und
     Track sind das Geruest der Tabelle und lassen sich nicht abschalten. `dropAt` ist die
     Reihenfolge, in der bei zu wenig Platz automatisch abgeworfen wird. */
  var COLUMNS = [
    { key: "idx",      label: "#",               hideable: false },
    { key: "brand",    label: "Brand",           hideable: false },
    { key: "vis",      label: "Visibility",      hideable: true },
    { key: "mentions", label: "Mentioned Count", hideable: true, dropAt: "vnar" },
    { key: "domain",   label: "Domain",          hideable: true, dropAt: "nar" },
    { key: "action",   label: "",                hideable: false }
  ];
  var NAR = 860, VNAR = 660;   // Containerbreiten, ab denen abgeworfen wird

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
                   "makeExplain", "rafThrottle", "esc", "storeKey"]
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
        loading: false, hasData: false,
        cols: {}, nar: false, vnar: false
      };

      /* Spaltenwahl haelt pro Instanz, wie in jeder anderen Tabelle. */
      var STORE = UC.storeKey ? UC.storeKey("udb-cols", instanceId) : null;
      (function readCols() {
        var d = {};
        COLUMNS.forEach(function (c) { d[c.key] = true; });
        state.cols = d;
        if (!STORE) return;
        try {
          var raw = JSON.parse(localStorage.getItem(STORE) || "null");
          if (raw && typeof raw === "object") {
            COLUMNS.forEach(function (c) { if (c.hideable && raw[c.key] === false) state.cols[c.key] = false; });
          }
        } catch (e) {}
      })();
      function writeCols() {
        if (!STORE) return;
        try { localStorage.setItem(STORE, JSON.stringify(state.cols)); } catch (e) {}
      }

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
              '<button type="button" class="up-iconbtn up-search-btn" aria-label="Search">' + ICON.search + '</button>' +
              '<div class="up-search-box">' +
                '<input class="up-search-input up-field" type="text" placeholder="Search brands…" ' +
                  'autocomplete="off" spellcheck="false" />' +
                '<button type="button" class="up-search-clear" aria-label="Clear search">' + ICON.x + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="up-cols">' +
              '<button type="button" class="up-iconbtn up-cols-btn" data-tip="Table settings" aria-label="Table settings">' + ICON.gear + '</button>' +
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
      function isDark() { return UC.isYes(root.getAttribute("data-isdark")) || root.getAttribute("data-theme") === "dark"; }
      UC.makeTooltips(root, isDark);

      /* Der Tooltip erklaert die Mechanik, nicht den Knopf. "Matched Brands" allein sagt keinem,
         was passiert, wenn man es abschaltet -- und genau das ist die Frage. */
      UC.makeExplain({
        root: root, getIsDark: isDark, triggerSel: "[data-matched]",
        html: function () {
          return '<div class="up-explain-h">Matched Brands</div>' +
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

      /* ---------------- Einstellungen ---------------- */
      var colsPop = UC.makePopover({
        wrap: root.querySelector(".up-cols"),
        menu: elColsMenu,
        opener: root.querySelector(".up-cols-btn"),
        group: "udb-" + instanceId
      });
      function populateCols() {
        elColsMenu.innerHTML =
          '<div class="up-pop-head">Columns</div>' +
          COLUMNS.filter(function (c) { return c.hideable; }).map(function (c) {
            return '<div class="up-filter-item' + (state.cols[c.key] ? " is-checked" : "") + '" data-col="' + c.key + '">' +
              '<span class="up-filter-check">' + ICON.check + '</span>' +
              '<span class="up-filter-label">' + esc(c.label) + '</span></div>';
          }).join("");
      }
      elColsMenu.addEventListener("click", function (e) {
        var it = e.target.closest("[data-col]");
        if (!it) return;
        var k = it.getAttribute("data-col");
        state.cols[k] = !state.cols[k];
        writeCols(); populateCols(); render();
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

      /* ---------------- Breite ---------------- */
      /* Setzt nur die Stufe und meldet, OB sich etwas geaendert hat -- rendern tut der Aufrufer.
         Sonst haetten wir eine Schleife: render() ruft measure(), measure() riefe render(). */
      function measure() {
        var w = root.clientWidth || 0;
        if (!w) return false;
        var nar = w < NAR, vnar = w < VNAR;
        if (nar === state.nar && vnar === state.vnar) return false;
        state.nar = nar; state.vnar = vnar;
        root.classList.toggle("is-nar", nar);
        root.classList.toggle("is-vnar", vnar);
        return true;
      }
      function onResize() { if (measure()) renderTable(); }
      if (window.ResizeObserver) { try { new ResizeObserver(onResize).observe(root); } catch (e) {} }
      window.addEventListener("resize", onResize);

      /* Sticky-Kopf. Genau wie in jeder anderen Tabelle ueber UC.makeSticky, NICHT von Hand:
         das Kit setzt die Klasse nur ab 1000px Seitenbreite (darunter kaempft ein klebender Kopf
         mit den zusammenklappenden Filtern), liest data-sticky / data-sticky-top, misst die Hoehe
         der Kopfzeile in --up-thead-off -- ohne das landet der Spaltenkopf UNTER der Kopfzeile
         statt darunter -- und loest die Bubble-Wrapper aus ihrem overflow:hidden, in dem sonst
         sowohl das Kleben als auch das Zahnrad-Menue steckenbleibt. */
      var sticky = UC.makeSticky(root, root.querySelector(".up-head"));
      window.addEventListener("resize", UC.rafThrottle(sticky.applySticky));
      sticky.applySticky();

      /* ---------------- Ladeflaeche ---------------- */
      var stepIdx = 0, stepTimer = null;
      function stepTick() {
        var t = elLText;
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
        if (on) {
          stepIdx = 0; elLText.textContent = STEPS[0];
          elLText.classList.remove("is-out", "is-in");
          stepTimer = setInterval(stepTick, STEP_MS);
          elTotal.classList.add("is-sk"); elTotal.textContent = "";
        }
      }

      /* ---------------- Rendern ---------------- */
      function visibleColumns() {
        return COLUMNS.filter(function (c) {
          if (c.hideable && state.cols[c.key] === false) return false;
          if (c.dropAt === "nar" && (state.nar || state.vnar)) return false;
          if (c.dropAt === "vnar" && state.vnar) return false;
          return true;
        });
      }
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

      function cellHtml(c, r, i) {
        if (c.key === "idx")   return '<span class="udb-idx">' + (i + 1) + "</span>";
        if (c.key === "brand") return '<span class="udb-brand">' +
          '<span class="udb-logo">' + (r.favicon
            ? '<img src="' + esc(r.favicon) + '" alt="" loading="lazy" referrerpolicy="no-referrer" ' +
              'onerror="this.remove()" />'
            : initials(r.name)) + "</span>" +
          '<span class="udb-name" title="' + esc(r.name) + '">' + esc(r.name) + "</span></span>";
        /* Ohne Nachkommastelle, wie vorgegeben. Math.round und nicht abschneiden: 4.84 ist naeher
           an 5 als an 4, und die Zahl steht neben einer Rangfolge. */
        if (c.key === "vis")   return '<span class="up-num">' +
          (r.visibility_pct == null ? "–" : Math.round(r.visibility_pct) + "%") + "</span>";
        if (c.key === "mentions") return '<span class="up-num">' +
          (r.mentioned_count == null ? "–" : r.mentioned_count) + "</span>";
        if (c.key === "domain") {
          if (!r.domain) return '<span class="udb-dom-none">–</span>';
          return '<span class="udb-domwrap">' +
            '<span class="udb-dom" title="' + esc(r.domain) + '">' + esc(r.domain) + "</span>" +
            '<button type="button" class="udb-go" data-go="' + esc(r.url) + '" ' +
              'data-tip="Open in new tab" aria-label="Open ' + esc(r.domain) + ' in a new tab">' + ICON.goto + "</button>" +
            "</span>";
        }
        if (c.key === "action") return '<button type="button" class="udb-track" data-track="' + esc(r.id) + '">' +
          ICON.check + '<span class="udb-track-label">Track</span></button>';
        return "";
      }

      function renderTable() {
        var cols = visibleColumns();
        var rows = filtered();

        var head = '<div class="up-thead">' + cols.map(function (c) {
          return '<div class="up-th udb-h-' + c.key + '">' + esc(c.label) + "</div>";
        }).join("") + "</div>";

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
              '<div class="up-empty-h">' + (state.query ? "No brand matches your search" :
                (state.hasData ? "No untracked brands found" : "No results yet")) + "</div>" +
              '<div class="up-empty-t">' + (state.query
                ? "Try a shorter search term."
                : !state.hasData
                  ? "The scan has not returned anything yet. Refresh the page if this stays empty."
                  : (state.matched
                      ? "Every brand we could match to a domain is already tracked. Turn off Matched Brands to match on names alone."
                      : "No brand names were found in your AI answers for this period.")) + "</div>" +
            "</div>";
          return;
        }

        elTable.innerHTML = head + '<div class="up-tbody">' + rows.map(function (r, i) {
          return '<div class="up-row">' + cols.map(function (c) {
            return '<div class="up-td udb-c-' + c.key + '">' + cellHtml(c, r, i) + "</div>";
          }).join("") + "</div>";
        }).join("") + "</div>";
      }

      function renderTotal() {
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
        measure(); renderTotal(); renderTable();
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
          if (typeof list === "string") list = UC.parseLoose ? UC.parseLoose(list) : null;
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
        setLoading: function (v) { setLoading(UC.isYes(v)); },
        reset: function () {
          state.rows = []; state.totalResponses = null; state.hasData = false;
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

      measure();
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
