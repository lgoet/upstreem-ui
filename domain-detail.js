/* upstreem domain-detail.js — die Domain-Detailseite. Braucht core.js (window.UpstreemCore).

   Drei Abschnitte in einer Wurzel, von oben:
     1. Umschalter (Citation Share / Domain Share) ueber einer Karte mit Kopfzeile, KPI und Kurve.
        Aufbau, Masse und Verhalten sind die von brand-detail -- dieselbe Karte, andere Daten.
     2. "Source Funnel": vier Stufen als Trichter.
     3. "Model Breakdown": Balkenliste je Modell.

   Was aus core kommt und hier NICHT noch einmal entsteht:
     UC.makeLine + UC.buildLineDatasets   die Kurve samt Tooltip, Legende, Skelett
     UC.makeTypeChart                     BEIDE Charts der unteren Zeile: URL-Typen und Modelle,
                                          je als Ring oder Balken. Ein Baustein, eine Bewegung.
     UC.trendChip / UC.fmtPct / UC.fmtTotal   die Formate
     UC.typeColor                         die Farbe des Zitationstyps, hell wie dunkel
     UC.makeMount / makeFire / makeLate / parseLoose / widthTiers / onTheme / themeParam

   Neu ist nur der Trichter. Fuer den gibt es in core nichts, und es gibt ihn genau einmal in der
   App -- deshalb steht er hier und nicht dort. Er ist als SVG gezeichnet und nicht mit Chart.js:
   vier weiche Uebergaenge sind vier Bezier-Kurven, und Chart.js kennt keinen Trichtertyp. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung -----------------------------------
     Bubble ruft die Setter aus einem Workflow, der neben dem Laden dieser Datei laeuft. Ohne
     Stubs wirft der erste Aufruf und reisst den ganzen Run-JS-Step mit. */
  var API_NAMES = ["setDomainDetail", "setDomainDetailUrls", "setDomainDetailLoading",
                   "resetDomainDetail"];
  var Q = (window.__uddBootQueue = window.__uddBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function uddBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { uddBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uddStart();
  }

  function uddStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, isYes = UC.isYes;

  var MODES = [
    { key: "citation", label: "Citation Share", heading: "Citations Share over Time" },
    { key: "domain",   label: "Domain Share",   heading: "Domain Share over Time" }
  ];
  var GRANS  = [{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }];
  /* Global heisst: der Anteil dieser URL an ALLEN Zitationen. Domain: ihr Anteil innerhalb dieser
     Domain. Beides kommt aus dem Payload (share_pct), der Schalter sagt Bubble nur, welche Zahl
     der naechste Aufruf liefern soll. */
  var SCOPES = [{ key: "global", label: "Global" }, { key: "domain", label: "Domain" }];

  /* Die vier Stufen des Trichters. `wert` holt die Zahl aus dem Payload, `unter` die Zeile
     darunter. Reihenfolge ist die Erzaehlung: wie oft wird die Quelle zitiert, wie viele Seiten
     davon, wie viele nennen ueberhaupt eine verfolgte Marke, wie viele die eigene. */
  /* Drei Stufen, nicht vier. "Responses citing this domain" ist raus: die Stufe zaehlt Antworten,
     die drei anderen zaehlen URLs. Ein Trichter, dessen erste Stufe eine andere Einheit hat als
     der Rest, behauptet ein Verhaeltnis, das es nicht gibt -- und weil die Hoehe jeder Stufe ihr
     Anteil an der ERSTEN ist, war die Verjuengung danach willkuerlich. */
  var STUFEN = [
    { key: "urls", label: "Cited Pages / URLs",
      wert: function (f) { return f.cited_urls_count; },
      unter: function () { return "URLs"; } },
    { key: "tracked", label: "URLs mentioning tracked brands",
      wert: function (f) { return f.urls_with_tracked_brands; },
      unter: function (f) { return UC.fmtPct(f.tracked_brand_presence_pct, 1) + " of cited URLs"; } },
    { key: "you", label: "URLs mentioning {brand}",
      wert: function (f) { return f.urls_mentioning_you; },
      unter: function (f) { return UC.fmtPct(f.your_url_presence_pct, 1) + " of cited URLs"; } }
  ];

  /* Die drei Bereiche der Seite. Der Nutzer stellt Reihenfolge und Sichtbarkeit ein, NICHT die
     Breite: das Raster steht fest, wie es ist. Typ-Split und Breakdown sind darin EIN Bereich --
     sie stehen ohnehin in einer Zeile, und zwei Menuezeilen fuer eine Zeile der Seite waeren eine
     Einstellung, die man nur halb ausfuehren kann. */
  var BEREICHE = [
    { key: "chart",      label: "Citations over Time" },
    { key: "funnel",     label: "Source Funnel" },
    { key: "breakdowns", label: "Breakdowns" }
  ];
  var LAYOUT_KEY = "uddLayout";

  var MODE_STORE = (window.__uddMode = window.__uddMode || {});
  var GRAN_STORE = (window.__uddGran = window.__uddGran || {});
  var SCOPE_STORE = (window.__uddScope = window.__uddScope || {});
  var CHART_STORE = (window.__uddChart = window.__uddChart || {});
  var MCHART_STORE = (window.__uddMChart = window.__uddMChart || {});

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function num(v) { return UC.toNum(v); }

  /* ---- Farben ---------------------------------------------------------------------------------
     Die Kurve im Citation-Share-Modus traegt die Farbe des Zitationstyps dieser Domain -- dieselbe,
     die der Typ in jeder Tabelle und im Combo-Chart hat (UC.typeColor).
     Fuer den Domain-Share-Modus braucht es mehrere Farben aus derselben Familie. Die Skala des
     Typs hat nur EINE Farbe, also wird sie erweitert: gleicher Farbton, gestaffelte Helligkeit und
     Saettigung. Das haelt die Kurven als Familie zusammen und unterscheidet sie trotzdem --
     und es funktioniert fuer jeden Typ, auch fuer einen, den es heute noch nicht gibt. */
  function hexZuHsl(hex) {
    var h = String(hex || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var l = (max + min) / 2, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), hu = 0;
    if (d !== 0) {
      if (max === r) hu = ((g - b) / d) % 6;
      else if (max === g) hu = (b - r) / d + 2;
      else hu = (r - g) / d + 4;
      hu *= 60; if (hu < 0) hu += 360;
    }
    return { h: hu, s: s, l: l };
  }
  /* Fuenf Stufen um die Grundfarbe herum, im Dunkeln heller angesetzt als im Hellen -- dieselbe
     Richtung, in die core seine Chart-Paletten zwischen den Themen verschiebt. */
  var RAMPE_HELL   = [0, -0.10, 0.10, -0.20, 0.18, -0.28, 0.26];
  var RAMPE_DUNKEL = [0, 0.10, -0.10, 0.20, -0.18, 0.28, -0.26];
  function familie(basis, n, dunkel) {
    var hsl = hexZuHsl(basis);
    var out = [];
    var rampe = dunkel ? RAMPE_DUNKEL : RAMPE_HELL;
    for (var i = 0; i < n; i++) {
      if (!hsl) { out.push(basis); continue; }
      var d = rampe[i % rampe.length];
      var l = Math.min(0.82, Math.max(0.22, hsl.l + d));
      /* Die Saettigung wandert gegenlaeufig mit: eine sehr helle Linie mit voller Saettigung
         wirkt grell, eine sehr dunkle mit wenig Saettigung wird zu Grau. */
      var s = Math.min(0.85, Math.max(0.28, hsl.s - Math.abs(d) * 0.25));
      out.push("hsl(" + Math.round(hsl.h) + "," + Math.round(s * 100) + "%," + Math.round(l * 100) + "%)");
    }
    return out;
  }

  /* ============================================================================================
     Markup. Wie in brand-detail und performance-detail baut die Komponente ihren Innenaufbau
     selbst -- es gibt im Bubble-Element keine Stelle, an der jemand von Hand etwas einsetzen soll.
     ============================================================================================ */
  function shell() {
    return '' +
      /* .up-seg/.up-seg-btn und .vc-gran/.vc-gran-btn sind die Haus-Bauteile aus core.css. Hier
         steht nur die Positionierung, kein eigenes Aussehen. */
      /* Die oberste Zeile steht AUSSERHALB des Chart-Bereichs und immer an erster Stelle: das
         Zahnrad darf nicht mit dem Bereich verschwinden, den es ausblendet -- sonst gibt es keinen
         Weg zurueck. Der Modus-Umschalter darin gehoert dagegen zum Chart und geht mit ihm. */
      '<div class="udd-toprow">' +
        '<div class="up-seg udd-seg" data-tie="chart" role="tablist">' +
          MODES.map(function (m) {
            return '<button class="up-seg-btn" type="button" role="tab" data-mode="' + m.key + '">' +
                     esc(m.label) + '</button>';
          }).join("") +
        '</div>' +
        '<span class="udd-lywrap">' +
          '<button class="up-iconbtn udd-lybtn" type="button" data-tip="Sections"' +
            ' aria-label="Show, hide and arrange sections"></button>' +
          '<div class="udd-lypop up-pop"></div>' +
        '</span>' +
      '</div>' +

      '<div class="udd-card udd-chartcard" data-bereich="chart">' +
        '<div class="udd-head">' +
          '<div class="udd-title">' +
            '<span class="up-logo-box udd-logobox"><span class="up-logo-ltr"></span></span>' +
            '<span class="udd-heading"></span>' +
          '</div>' +
          '<div class="udd-tools">' +
            '<div class="up-seg udd-scope" role="group" aria-label="Share scope">' +
              SCOPES.map(function (s) {
                return '<button class="up-seg-btn" type="button" data-scope="' + s.key + '">' + esc(s.label) + '</button>';
              }).join("") +
            '</div>' +
            '<div class="vc-gran" role="group" aria-label="Granularity">' +
              GRANS.map(function (g) {
                return '<button class="vc-gran-btn" type="button" data-gran="' + g.key + '">' + esc(g.label) + '</button>';
              }).join("") +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="udd-kpi">' +
          '<span class="udd-kpi-val"></span>' +
          '<span class="udd-kpi-trend"></span>' +
        '</div>' +
        '<div class="udd-chartwrap"><canvas class="udd-canvas"></canvas></div>' +
        '<div class="udd-legend up-legend"></div>' +
      '</div>' +

      '<div class="udd-card udd-funnelcard" data-bereich="funnel">' +
        '<div class="udd-sec">' +
          '<span class="udd-sec-title">Source Funnel</span>' +
          '<span class="udd-sec-desc">How often this source is cited, how many of its cited URLs ' +
            'mention brands, and where your brand is still missing</span>' +
        '</div>' +
        '<div class="udd-funnel"></div>' +
      '</div>' +

      /* Typ-Split und Model Breakdown stehen nebeneinander in einer Zeile. Das Typ-Chart ist
         hoeher als die Balkenliste (ein Doughnut braucht seine Flaeche), deshalb richtet die Zeile
         mittig aus statt oben -- sonst haengt die Balkenliste am Kopf der Zeile. */
      '<div class="udd-row2" data-bereich="breakdowns">' +
        '<div class="udd-card udd-typecard">' +
          '<div class="udd-sec udd-sec-row">' +
            '<div class="udd-sec-txt">' +
              '<span class="udd-sec-title">URL Type Split</span>' +
              '<span class="udd-sec-desc">What kind of pages of this domain get cited</span>' +
            '</div>' +
            /* .cc-seg / .cc-seg-btn sind die Alias-Klassen von .up-seg / .up-seg-btn -- dasselbe
               Bauteil wie im Combo-Chart, damit der Umschalter ueberall gleich aussieht. */
            '<div class="cc-seg udd-typeseg" role="tablist" aria-label="Chart type">' +
              '<button class="cc-seg-btn" type="button" role="tab" data-chart="doughnut"' +
                ' data-tip="Doughnut" aria-label="Doughnut">' + UC.icon("donut", 2) + '</button>' +
              '<button class="cc-seg-btn" type="button" role="tab" data-chart="bar"' +
                ' data-tip="Bars" aria-label="Bars">' + UC.icon("chartBarDec", 2) + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="udd-typebody up-donut-body"></div>' +
        '</div>' +

        '<div class="udd-card udd-modelcard">' +
          '<div class="udd-sec udd-sec-row">' +
            '<div class="udd-sec-txt">' +
              '<span class="udd-sec-title">Model Breakdown</span>' +
              '<span class="udd-sec-desc">Distribution of this domain in AI models</span>' +
            '</div>' +
            '<div class="cc-seg udd-modelseg" role="tablist" aria-label="Chart type">' +
              '<button class="cc-seg-btn" type="button" role="tab" data-mchart="doughnut"' +
                ' data-tip="Doughnut" aria-label="Doughnut">' + UC.icon("donut", 2) + '</button>' +
              '<button class="cc-seg-btn" type="button" role="tab" data-mchart="bar"' +
                ' data-tip="Bars" aria-label="Bars">' + UC.icon("chartBarDec", 2) + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="udd-modelbody udd-modeldonut up-donut-body"></div>' +
        '</div>' +
      '</div>';
  }

  function initRoot(root) {
    if (root.__uddController) return root.__uddController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (instanceId === "INSTANCE_ID") return null;   /* Platzhalter noch nicht ersetzt */

    root.innerHTML = shell();
    var fire = UC.makeFire(root, { label: "domain-detail", eventPrefix: "udd" });

    /* Schmale Breiten ueber die EIGENE Box, nicht ueber eine Media Query auf das Fenster: diese
       Seite kann in einem Drawer stehen, der auf einem breiten Bildschirm schmal ist. */
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 640, vnarrowAt: 480 });

    var elSeg     = root.querySelector(".udd-seg");
    var elScope   = root.querySelector(".udd-scope");
    var elGran    = root.querySelector(".vc-gran");
    var elHeading = root.querySelector(".udd-heading");
    var elLogo    = root.querySelector(".udd-logobox");
    var elKpi     = root.querySelector(".udd-kpi");
    var elVal     = root.querySelector(".udd-kpi-val");
    var elTrend   = root.querySelector(".udd-kpi-trend");
    var elChart   = root.querySelector(".udd-chartwrap");
    var elCanvas  = root.querySelector(".udd-canvas");
    var elLegend  = root.querySelector(".udd-legend");
    var elFunnel  = root.querySelector(".udd-funnel");
    var elTypeBody = root.querySelector(".udd-typebody");
    var elTypeSeg  = root.querySelector(".udd-typeseg");
    var elModelSeg = root.querySelector(".udd-modelseg");
    var elModelDonut = root.querySelector(".udd-modeldonut");

    /* UC.themeParam und nicht das Attribut allein: kennt core ein Thema, gewinnt core. Das
       Attribut ist die Momentaufnahme aus dem Lauf des Workflows. */
    var isDark = UC.themeParam(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    function darkNow() { return isDark; }

    /* Die Tooltips fehlten hier komplett -- makeTooltips wurde nie gerufen, also blieb JEDES
       data-tip dieser Komponente stumm: Zahnrad, Ring/Balken-Umschalter, alle. Der zweite
       Parameter ist die Themenabfrage; ohne ihn steht der Tooltip im Dunkeln hell. */
    if (UC.makeTooltips) UC.makeTooltips(root, darkNow);

    var state = {
      mode:  MODE_STORE[instanceId]  || "citation",
      gran:  GRAN_STORE[instanceId]  || "day",
      scope: SCOPE_STORE[instanceId] || "global",
      header: null, share: null, urls: null, model: null, funnel: null,
      brand: (root.getAttribute("data-brand") || "").trim(),
      /* loading startet auf true: die Komponente steht auf der Seite, bevor der Pageload-Workflow
         gelaufen ist, und in dieser Zeit LAEDT sie -- sie ist nicht leer. Beendet wird der Zustand
         durch die Daten oder nach WARTE_MS durch die Warte-Uhr, nie durch nichts. */
      loading: true, hasData: false, error: null,
      /* Die URL-Serie kommt aus einem EIGENEN Workflow, ausgeloest durch einen Klick. Deshalb hat
         sie ihren eigenen Wartezustand: urls === null heisst "noch nie etwas angekommen",
         urlsStale heisst "wir haben etwas, aber gerade neue Zahlen angefordert". Beides ist
         WARTEN und muss ein Skelett zeigen -- nicht "No URL data", denn das ist eine Aussage
         ueber die Daten und nicht ueber uns. urlsError ist das Ende der Geduld. */
      urlsStale: false, urlsError: null,
      /* Der Umschalter des Typ-Charts. Wie in Combo und Topcitations ist der Doughnut der Anfang;
         der Balkenmodus ist die Ansicht fuer viele Typen. Ueberlebt das Neueinspritzen. */
      layout: null,
      chartMode: CHART_STORE[instanceId] || "doughnut",
      /* Beim Model Breakdown ist der BALKEN der Anfang (Vorgabe): zwei oder drei Modelle sind als
         Balken mit Logo und Prozentwert schneller zu lesen als als Ring. */
      modelMode: MCHART_STORE[instanceId] || "bar",
      types: null
    };
    if (state.brand === "BRAND_NAME") state.brand = "";

    /* ---- Sichtbarkeit und Anordnung der vier Bereiche ----------------------------------------
       Der Nutzer bestimmt Reihenfolge, Breite und Sichtbarkeit. Gespeichert wird in den
       Einstellungen (localStorage ueber UC.prefGet/prefSet, teambezogen) -- es ist eine Vorliebe
       des Nutzers, keine Eigenschaft der Daten, und sie soll die naechste Domain ueberleben.
       Gelesen wird nachsichtig: ein unbekannter Schluessel wird ignoriert, ein fehlender ergaenzt.
       Damit kann die Liste der Bereiche wachsen, ohne dass ein gespeichertes Layout ungueltig wird
       -- ein neuer Bereich taucht dann hinten auf und ist sichtbar. */
    function layoutLesen() {
      var roh = null;
      try { roh = UC.prefGet ? UC.prefGet(UC.prefKey ? UC.prefKey(LAYOUT_KEY) : LAYOUT_KEY) : null; } catch (e) {}
      var gespeichert = null;
      try { gespeichert = roh ? JSON.parse(roh) : null; } catch (e) { gespeichert = null; }
      var nach = {};
      if (isArr(gespeichert)) gespeichert.forEach(function (e) {
        if (e && e.key) nach[String(e.key)] = e;
      });
      /* Immer in der Reihenfolge von BEREICHE, also der des Entwurfs. Gespeichert wird nur, was
         ausgeblendet ist -- ein alter Eintrag mit einem Schluessel, den es nicht mehr gibt, wird
         dabei still uebergangen, und ein neuer Bereich kommt sichtbar dazu. */
      return BEREICHE.map(function (b) {
        var e = nach[b.key];
        return { key: b.key, label: b.label, aus: !!(e && e.aus) };
      });
    }
    function layoutSchreiben() {
      try {
        if (UC.prefSet) UC.prefSet(UC.prefKey ? UC.prefKey(LAYOUT_KEY) : LAYOUT_KEY,
          JSON.stringify(state.layout.map(function (e) {
            return { key: e.key, aus: e.aus ? 1 : 0 };
          })));
      } catch (e) {}
    }
    /* Sichtbarkeit ins DOM bringen. */
    function layoutAnwenden() {
      state.layout.forEach(function (e) {
        var el = root.querySelector('[data-bereich="' + e.key + '"]');
        if (!el) return;
        el.hidden = !!e.aus;
        /* Bedienelemente, die zu einem Bereich gehoeren, aber ausserhalb von ihm stehen (der
           Modus-Umschalter in der obersten Zeile): sie gehen mit ihrem Bereich. */
        [].forEach.call(root.querySelectorAll('[data-tie="' + e.key + '"]'), function (t) {
          t.hidden = !!e.aus;
        });
        /* Ist der Chart-Bereich aus, schrumpft der Abstand UNTER der obersten Zeile um 32px. Die
           Zeile selbst bleibt stehen -- sie traegt das Zahnrad, und ein Versatz an der Wurzel hat
           es aus dem Bild geschoben. */
        if (e.key === "chart") root.classList.toggle("is-nochart", !!e.aus);
      });
      /* Ist die zweite Spalte leer, weil kein halber Bereich sichtbar ist, faellt sie durch die
         span-2-Regeln von selbst weg -- dafuer braucht es keine eigene Klasse. */
    }

    /* ---- Das Menue der Bereiche --------------------------------------------------------------
       Ein Auge je Bereich, sonst nichts. Breite und Reihenfolge standen hier einmal auch drin und
       sind wieder heraus: die Anordnung der Seite ist eine Entscheidung des Entwurfs und keine
       Einstellung. Was bleibt, ist das Ausblenden. */
    var elLyWrap = root.querySelector(".udd-lywrap");
    var elLyBtn  = root.querySelector(".udd-lybtn");
    var elLyPop  = root.querySelector(".udd-lypop");

    function lyRowHtml(e) {
      return '<div class="up-cg-row udd-lyrow" data-ly-key="' + esc(e.key) + '"' +
               (e.aus ? ' data-aus="1"' : "") + '>' +
        '<span class="udd-lyname">' + esc(e.label) + "</span>" +
        '<button class="up-cg-eye udd-lyeye' + (e.aus ? " is-off" : "") + '" type="button"' +
          ' data-ly-eye="' + esc(e.key) + '" aria-pressed="' + (e.aus ? "true" : "false") + '"' +
          ' aria-label="' + (e.aus ? "Show section" : "Hide section") + '">' +
          UC.icon(e.aus ? "eyeOff" : "eye", 2) + "</button>" +
      "</div>";
    }
    function lyMenuHtml() {
      return '<div class="udd-lyhead">Sections</div>' +
        '<div class="up-cg-list udd-lylist">' + state.layout.map(lyRowHtml).join("") + "</div>" +
        '<div class="udd-lyfoot">' +
          '<button type="button" class="udd-lyreset">Reset to default</button>' +
        "</div>";
    }
    function lyOeffnen() { elLyPop.innerHTML = lyMenuHtml(); }

    /* ---- Ein Wartezustand, der endet ---------------------------------------------------------
       Das Skelett laeuft, solange keine Daten da sind. Ohne Ende ist "kommt gleich" nicht von
       "kommt nie" zu unterscheiden -- dieselbe Uhr wie in brand-detail, dieselbe Dauer. */
    var WARTE_MS = 25000, warteUhr = null, urlUhr = null;
    function warteStarten() {
      if (warteUhr) clearTimeout(warteUhr);
      warteUhr = setTimeout(function () {
        warteUhr = null;
        if (state.hasData || state.error) return;
        /* Im UI steht, was der Nutzer wissen kann: es sind keine Daten da. Warum, gehoert in die
           Konsole -- so wie es core und vier andere Komponenten schon halten. Ein Arbeitsauftrag
           an uns ("check the ... workflow") ist fuer den Nutzer eine Sackgasse. */
        if (window.console) console.warn("[domain-detail] " + WARTE_MS + "ms ohne setDomainDetail " +
          'fuer die Instanz "' + instanceId + '". Laeuft der Pageload-Workflow?');
        state.error = "No data";
        state.loading = false;
        render();
      }, WARTE_MS);
    }
    function warteBeenden() { if (warteUhr) { clearTimeout(warteUhr); warteUhr = null; } }
    warteStarten();
    /* Bubble spritzt das Markup neu ein, der Modus ueberlebt in MODE_STORE. Startet die Instanz
       also schon im Domain-Share, ist die URL-Serie von der ersten Sekunde an unterwegs. */
    if (state.mode === "domain") setTimeout(function () { if (!state.urls) urlWarteStarten(); }, 0);

    /* Dieselbe Geduld fuer die URL-Serie, aber getrennt gezaehlt: sie wird spaeter und oefter
       angefordert als die Hauptdaten, und ihr Ausbleiben darf nur ihr eigenes Chart betreffen. */
    function urlWarteStarten() {
      state.urlsError = null;
      if (urlUhr) clearTimeout(urlUhr);
      urlUhr = setTimeout(function () {
        urlUhr = null;
        if (!urlWartet()) return;
        if (window.console) console.warn("[domain-detail] " + WARTE_MS + "ms ohne setDomainDetailUrls " +
          'fuer die Instanz "' + instanceId + '". Haengt ein Workflow an uddMode/uddScope/uddGran?');
        state.urlsError = "No data";
        state.urlsStale = false;
        renderChart();
      }, WARTE_MS);
    }
    function urlWarteBeenden() { if (urlUhr) { clearTimeout(urlUhr); urlUhr = null; } }
    /* Warten heisst: nichts da ODER angefordert. Der Fehlerfall ist kein Warten mehr. */
    function urlWartet() { return !state.urlsError && (!state.urls || state.urlsStale); }

    /* ---- Kurve ------------------------------------------------------------------------------ */
    var line = UC.makeLine({
      wrap: elChart, canvas: elCanvas, legend: elLegend,
      isDark: darkNow, isOwner: function () { return true; },
      gran: function () { return state.gran; },
      unit: "%",
      /* Eine Nachkommastelle: das ist die Genauigkeit, in der die Anteile geliefert werden. */
      decimals: 1,
      tipLabel: "Share:",
      watermark: true
    });

    /* ---- Trichter ----------------------------------------------------------------------------
       Vier Stufen. Die Hoehe jeder Stufe ist ihr Anteil an der ERSTEN Stufe, mit einer Untergrenze,
       damit eine Stufe mit dem Wert 0 nicht verschwindet -- sie ist die Aussage "hier ist nichts",
       und die muss man sehen koennen.
       Gezeichnet als EIN Pfad je Stufe: oben eine weiche Kurve von der Hoehe der Stufe zur naechsten,
       unten die Grundlinie. Die Kurve ist ein kubischer Bezier mit waagerechten Anfassern -- so
       laeuft sie an beiden Enden waagerecht aus und die Stufen gehen ohne Knick ineinander ueber. */
    var FN_H = 132;         /* Zeichenhoehe des Trichters in Einheiten des viewBox */
    var FN_MIN = 0.06;      /* kleinste sichtbare Hoehe, als Anteil */
    function trichterHtml(f) {
      var stufen = STUFEN.map(function (s) {
        var v = num(s.wert(f));
        return {
          key: s.key,
          label: s.label.replace("{brand}", state.brand || "your brand"),
          wert: v == null ? 0 : v,
          unter: s.unter(f)
        };
      });
      var basis = stufen[0].wert || 0;
      var farbe = typFarbe();
      var hoehen = stufen.map(function (s) {
        var a = basis > 0 ? (s.wert / basis) : 0;
        return Math.max(FN_MIN, Math.min(1, a));
      });
      var breite = 100, proStufe = breite / stufen.length;
      var pfade = "";
      for (var i = 0; i < stufen.length; i++) {
        var x0 = i * proStufe, x1 = (i + 1) * proStufe;
        var h0 = hoehen[i] * FN_H;
        var h1 = (i + 1 < hoehen.length ? hoehen[i + 1] : hoehen[i]) * FN_H;
        var y0 = FN_H - h0, y1 = FN_H - h1;
        var cx = x0 + proStufe / 2;
        /* Deckkraft stuft sich ab: die erste Stufe ist die volle Menge, jede weitere ein Rest
           davon. Eine eigene Farbe je Stufe waere eine zweite Aussage -- hier geht es nur um
           "immer weniger". */
        var deck = 0.92 - i * 0.18;
        pfade += '<path class="udd-fn-band" d="M' + x0 + ',' + y0 +
                 ' C' + cx + ',' + y0 + ' ' + cx + ',' + y1 + ' ' + x1 + ',' + y1 +
                 ' L' + x1 + ',' + FN_H + ' L' + x0 + ',' + FN_H + ' Z"' +
                 ' fill="' + esc(farbe) + '" fill-opacity="' + deck.toFixed(2) + '"></path>';
      }
      var trenner = "";
      for (var t = 1; t < stufen.length; t++) {
        trenner += '<line class="udd-fn-div" x1="' + (t * proStufe) + '" y1="0" x2="' + (t * proStufe) + '" y2="' + FN_H + '"></line>';
      }
      var kopf = stufen.map(function (s) {
        return '<div class="udd-fn-col">' +
                 '<span class="udd-fn-val">' + esc(UC.fmtTotal(s.wert)) + '</span>' +
                 '<span class="udd-fn-label">' + esc(s.label) + '</span>' +
                 '<span class="udd-fn-sub">' + esc(s.unter) + '</span>' +
               '</div>';
      }).join("");
      return '<div class="udd-fn-head">' + kopf + '</div>' +
             '<svg class="udd-fn-svg" viewBox="0 0 ' + breite + ' ' + FN_H + '" preserveAspectRatio="none" ' +
                  'aria-hidden="true">' + pfade + trenner + '</svg>';
    }

    /* ---- Farbe des Zitationstyps ------------------------------------------------------------- */
    function typFarbe() {
      var t = state.header && state.header.citation_type;
      return UC.typeColor(t || "", "citation", isDark);
    }

    /* ---- Render ------------------------------------------------------------------------------ */
    function modeOf(k) { for (var i = 0; i < MODES.length; i++) if (MODES[i].key === k) return MODES[i]; return MODES[0]; }

    function syncSeg() {
      [].forEach.call(elSeg.querySelectorAll(".up-seg-btn"), function (b) {
        var on = b.getAttribute("data-mode") === state.mode;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
      [].forEach.call(elScope.querySelectorAll(".up-seg-btn"), function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-scope") === state.scope);
      });
      [].forEach.call(elGran.querySelectorAll(".vc-gran-btn"), function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-gran") === state.gran);
      });
      /* Der Global/Domain-Schalter gehoert zum Domain-Share; im Citation-Share gibt es nichts,
         worauf er sich beziehen koennte. Und die KPI-Zeile ist die des globalen Anteils -- im
         Domain-Share nimmt die Kurve ihren Platz ein. */
      var domainModus = state.mode === "domain";
      elScope.hidden = !domainModus;
      elKpi.hidden = domainModus;
      root.classList.toggle("is-domainshare", domainModus);
    }

    function renderHead() {
      var h = state.header || {};
      elHeading.textContent = modeOf(state.mode).heading;
      var fav = h.favicon || h.favicon_url || "";
      var name = h.domain || h.id || "";
      var img = elLogo.querySelector("img");
      /* Auch das Favicon ist ein Skelett, solange geladen wird: es wechselt mit den Daten wie jede
         Zahl daneben. Vorher stand hier das "?" des Anfangsbuchstaben-Rueckfalls -- das behauptet
         "eine Domain, die ich nicht kenne", waehrend die Wahrheit "noch nichts da" ist. */
      /* Auch ein bereits bekanntes Favicon wird zum Skelett, nicht nur ein fehlendes: es gehoert
         zu den ALTEN Daten und kann mit den neuen ein anderes sein. Ein Logo stehen zu lassen,
         waehrend die Zahlen daneben laden, behauptet "diese Domain ist es weiterhin". */
      var laedt = istLaden() || !state.hasData;
      elLogo.classList.toggle("is-sk", laedt);
      if (laedt) {
        elLogo.querySelector(".up-logo-ltr").textContent = "";
        if (img) { img.remove(); elLogo.classList.remove("has-img"); }
        return;
      }
      elLogo.querySelector(".up-logo-ltr").textContent = (name || "").charAt(0).toUpperCase();
      if (fav) {
        if (!img) {
          img = document.createElement("img");
          img.alt = "";
          img.loading = "lazy";
          img.onerror = function () { elLogo.classList.remove("has-img"); this.remove(); };
          elLogo.appendChild(img);
        }
        if (img.getAttribute("src") !== fav) img.setAttribute("src", fav);
        elLogo.classList.add("has-img");
      } else if (img) { img.remove(); elLogo.classList.remove("has-img"); }
    }

    function renderKpi() {
      if (state.error) {
        elVal.innerHTML = '<span class="up-num is-empty">–</span>';
        elTrend.innerHTML = "";
        return;
      }
      if (istLaden() || !state.hasData) {
        elVal.innerHTML = '<span class="up-tsk-bar"></span>';
        elTrend.innerHTML = '<span class="up-tsk-bar"></span>';
        return;
      }
      var h = state.header || {};
      var v = num(h.current_citation_share);
      elVal.innerHTML = '<span class="up-num' + (v == null ? " is-empty" : "") + '">' +
        (v == null ? "–" : esc(UC.fmtPct(v, 1))) + '</span>';
      /* Mit Prozentzeichen und einer Nachkommastelle: der Wert ist die Veraenderung eines
         ANTEILS, und so steht er auch in jeder Tabelle (siehe die Share-Spalten). */
      elTrend.innerHTML = UC.trendChip(h.citation_share_delta_pct, { decimals: true, suffix: "%" });
    }

    function istLaden() { return !!state.loading; }

    function renderChart() {
      if (state.error) { line.empty(state.error); return; }
      if (istLaden() || !state.hasData) { line.skeleton(); return; }

      if (state.mode === "citation") {
        var reihe = isArr(state.share) ? state.share : [];
        if (!reihe.length) { line.empty("No citation share for this period."); return; }
        var id = (state.header && (state.header.domain || state.header.id)) || "domain";
        var punkte = reihe.map(function (p) {
          return { company_id: id, day: p.day, share_pct: num(p.share_pct) };
        });
        var built = UC.buildLineDatasets(punkte, [{
          company_id: id,
          name: id,
          color: typFarbe(),
          favicon_url: (state.header && (state.header.favicon || state.header.favicon_url)) || ""
        }], null);
        line.render(built);
        return;
      }

      /* Reihenfolge wie in CLAUDE.md §2: erst der Fehler, dann das Skelett, dann die Aussage
         ueber die Daten. Vorher stand hier nur die Aussage -- ein Klick auf "Domain Share"
         zeigte "No URL data for this period.", solange der Workflow lief, also genau in dem
         Moment, in dem noch niemand etwas ueber die Daten wissen konnte. */
      if (state.urlsError) { line.empty(state.urlsError); return; }
      if (urlWartet()) { line.skeleton(); return; }
      var pts = state.urls && isArr(state.urls.points) ? state.urls.points : [];
      if (!pts.length) { line.empty("No URL data for this period."); return; }
      /* Eine Farbe je URL, aus der Familie des Zitationstyps -- siehe familie(). Die Reihenfolge
         richtet sich nach dem Gesamtanteil, damit die staerkste Kurve immer dieselbe Farbe hat
         und nicht bei jedem Neuladen springt. */
      var meta = {}, reihenfolge = [];
      pts.forEach(function (p) {
        var u = String(p.url || "");
        if (!u) return;
        if (!meta[u]) {
          meta[u] = { company_id: u, name: p.title || u, gesamt: num(p.share_total_pct) || 0 };
          reihenfolge.push(u);
        }
      });
      reihenfolge.sort(function (a, b) { return meta[b].gesamt - meta[a].gesamt; });
      var farben = familie(typFarbe(), reihenfolge.length, isDark);
      var companies = reihenfolge.map(function (u, i) {
        meta[u].color = farben[i];
        return meta[u];
      });
      var punkte2 = pts.map(function (p) {
        return { company_id: String(p.url || ""), day: p.day, share_pct: num(p.share_pct) };
      });
      line.render(UC.buildLineDatasets(punkte2, companies, null));
    }

    function renderFunnel() {
      if (state.error) { elFunnel.innerHTML = '<div class="up-chart-empty">' + esc(state.error) + '</div>'; return; }
      if (istLaden() || !state.funnel) {
        elFunnel.innerHTML = '<div class="udd-fn-sk">' +
          '<span class="udd-fn-sk-head"></span><span class="udd-fn-sk-body"></span></div>';
        return;
      }
      elFunnel.innerHTML = trichterHtml(state.funnel);
      /* Die Spaltenzahl des Kopfrasters an die Zahl der Stufen binden -- das SVG teilt die Breite
         durch dieselbe Zahl, also muessen die Koepfe darueber genau daraufliegen. */
      var kopf = elFunnel.querySelector(".udd-fn-head");
      if (kopf) kopf.style.setProperty("--udd-fnc", String(STUFEN.length));
    }

    /* Der Typ-Split. UC.makeTypeChart ist derselbe Baustein, den das Combo-Chart und das
       Topcitations-Dashboard benutzen -- Doughnut, Balken, Legende, Skelett und der Tooltip
       kommen von dort. Hier steht nur, WANN was gezeichnet wird.
       decimals: 1 wie im Combo (CLAUDE.md 2b: der Standard des Kits ist 2 und fuer keinen Chart
       der App richtig). */
    /* Das Tor fuer das Balkenwachstum. renderBars gibt seinen Starter hierher, hoeheAnimiert ruft
       ihn erst, wenn Hoehe und Einblenden durch sind -- so laufen die drei Bewegungen NACHEINANDER
       (Hoehe, Einblenden, Balken) statt uebereinander. Laeuft kein hoeheAnimiert (Erstaufbau, neue
       Daten), startet das Tor sofort von selbst. */
    var wachsTor = { starter: null, offen: true };
    function torSchliessen() { wachsTor.starter = null; wachsTor.offen = false; }
    function torOeffnen() {
      wachsTor.offen = true;
      var s = wachsTor.starter; wachsTor.starter = null;
      if (s) s();
    }
    function torNehmen(starter) {
      if (wachsTor.offen) { starter(); return; }
      wachsTor.starter = starter;
    }

    var typeChart = UC.makeTypeChart ? UC.makeTypeChart({
      decimals: 1,
      growGate: torNehmen,
      body: elTypeBody,
      isDark: darkNow,
      isOwner: function () { return true; },
      /* "url" ist der Datenmodus: die Typen kommen aus URL_LABEL und der URL-Farbskala, nicht aus
         der Zitationstyp-Skala. Genau wie im Combo, wenn dort auf URL-Typen umgeschaltet ist. */
      mode: function () { return "url"; },
      chartMode: function () { return state.chartMode; },
      /* Die Zahl in der Mitte ist die Menge der zitierten Seiten dieser Domain -- sie steht im
         Trichter (cited_urls_count) und nicht in types_breakdown, das nur Anteile kennt. */
      total: function () { return state.funnel ? num(state.funnel.cited_urls_count) : null; },
      centerLabel: "Pages",
      collapseHost: root.querySelector(".udd-typecard")
    }) : null;

    function renderTypes() {
      if (!typeChart) return;
      if (state.error) { elTypeBody.innerHTML = '<div class="up-chart-empty">' + esc(state.error) + "</div>"; return; }
      if (istLaden() || !isArr(state.types)) { typeChart.skeleton(); return; }
      var vorbereitet = UC.prepTypeData("url", state.types, isDark);
      if (!vorbereitet.length) { typeChart.empty("No URL types for this period."); return; }
      if (state.chartMode === "bar") typeChart.renderBars(vorbereitet);
      else typeChart.renderDonut(vorbereitet);
    }

    /* Die Hoehe der ZEILE animieren, wenn ein Chart darin den Modus wechselt. Nicht die der
       einzelnen Karte: die Zeile richtet mit align-items: stretch aus, also folgt jede Karte der
       hoeheren -- gemessen blieb eine einzelne Karte bei 326px, egal was in ihr passierte, auch
       ohne min-height. Was sich aendert, ist die Zeile. transition auf height greift bei
       auto nicht -- also: aktuelle Hoehe festschreiben, neu zeichnen, Zielhoehe messen, darauf
       animieren und danach wieder freigeben. 200ms ease (Vorgabe).
       Ohne das Freigeben am Ende bliebe die Karte auf der gemessenen Hoehe stehen und wuerde beim
       naechsten Datenwechsel nicht mehr mitwachsen. */
    /* Der Wechsel Ring <-> Balken in DREI Schritten hintereinander, nicht uebereinander:
         1. die Hoehe der Karte animiert (200ms ease)
         2. mit demselben Mass danach der Inhalt eingeblendet (200ms ease)
         3. erst dann laufen die Erscheinungs-Animationen des Charts los (das Balkenwachstum)
       Vorher liefen 1 und 3 gleichzeitig, und fitBars() in core mass die Hoehe, waehrend sie noch
       die alte war -- es blendete Zeilen aus, die einen Frame spaeter Platz hatten, und der Umbruch
       passierte zweimal. Das war das Stocken.

       Die Zielhoehe wird NACH dem Einrichten des Charts gemessen: Chart.js richtet seine Leinwand
       ueber einen ResizeObserver ein, also erst nach diesem Lauf. Wer vorher misst, misst eine
       Hoehe, die es gleich nicht mehr gibt.

       Waehrend gemessen wird, haelt MIN-HEIGHT die alte Hoehe und nicht height: eine feste Hoehe
       quetscht die Balkenliste, und was nicht hineinpasst, ist weg (gemessen neun Balken im
       Dokument, fuenf sichtbar). Ein Mindestmass laesst wachsen und verhindert nur das
       Zusammenfallen. */
    var HANIM_MS = 200;
    function hoeheAnimiert(karte, neuZeichnen) {
      if (!karte || !karte.getBoundingClientRect) { neuZeichnen(); return; }
      var koerper = karte.querySelector(".udd-typebody, .udd-modelbody");
      var vorher = karte.getBoundingClientRect().height;
      karte.classList.add("is-hanim");
      karte.style.transition = "none";
      karte.style.minHeight = vorher + "px";
      /* Der Inhalt geht auf 0, OHNE Uebergang -- der Wechsel selbst soll nicht zu sehen sein, nur
         das Einblenden danach. */
      if (koerper) { koerper.style.transition = "none"; koerper.style.opacity = "0"; }
      torSchliessen();
      neuZeichnen();

      function einblenden() {
        if (!koerper) { torOeffnen(); aufraeumen(); return; }
        koerper.style.transition = "opacity " + HANIM_MS + "ms ease";
        koerper.style.opacity = "1";
        setTimeout(function () {
          koerper.style.transition = ""; koerper.style.opacity = "";
          /* Jetzt erst die Balken. */
          torOeffnen();
          aufraeumen();
        }, HANIM_MS + 20);
      }
      function aufraeumen() {
        karte.style.height = ""; karte.style.minHeight = ""; karte.style.transition = "";
        karte.classList.remove("is-hanim");
      }

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          /* Mindestmass loslassen, natuerliche Hoehe lesen, im selben Frame wieder festnageln --
             dazwischen entsteht kein Bild. */
          karte.style.minHeight = "";
          var nachher = karte.getBoundingClientRect().height;
          if (Math.abs(nachher - vorher) < 1) { einblenden(); return; }
          karte.style.height = vorher + "px";
          /* Den Startwert festschreiben, ohne zu zeichnen: ohne diese erzwungene Neuberechnung
             springt die Karte ohne Animation auf das Ziel. */
          void karte.offsetHeight;
          karte.style.transition = "height " + HANIM_MS + "ms ease";
          karte.style.height = nachher + "px";
          setTimeout(function () {
            karte.style.height = ""; karte.style.minHeight = ""; karte.style.transition = "";
            einblenden();
          }, HANIM_MS + 20);
        });
      });
    }

    function syncTypeSeg() {
      if (!elTypeSeg) return;
      [].forEach.call(elTypeSeg.querySelectorAll("[data-chart]"), function (b) {
        var an = b.getAttribute("data-chart") === state.chartMode;
        b.classList.toggle("is-active", an);
        b.setAttribute("aria-selected", an ? "true" : "false");
      });
    }

    /* Der Doughnut der Modelle. Dasselbe Werkzeug wie beim Typ-Split, nur mit selbst gebauten
       Items: die Modelle bringen ihre Farbe je Thema mit, es gibt fuer sie keine Skala in core.
       prepTypeData waere hier falsch -- das kennt nur Zitations- und URL-Typen. */
    var modelDonut = UC.makeTypeChart ? UC.makeTypeChart({
      growGate: torNehmen,
      decimals: 1,
      body: elModelDonut,
      isDark: darkNow,
      isOwner: function () { return true; },
      mode: function () { return "url"; },
      /* Derselbe Baustein zeichnet jetzt BEIDE Modi des Model Breakdowns. Vorher kamen die Balken
         aus UC.makeBarList -- die animiert anders (Breite und Text in einem Zug), waehrend
         makeTypeChart erst den Balken wachsen laesst und dann die Texte einfaedt. Zwei Charts in
         einer Zeile mit zwei Bewegungen liest sich als Fehler. Die Logos gehen dabei nicht
         verloren: renderBars in core kann sie jetzt auch. */
      chartMode: function () { return state.modelMode; },
      /* Die Zahl in der Mitte: wie viele verschiedene Modelle diese Domain ueberhaupt zitieren.
         Das ist die Laenge von model_breakdown selbst -- jeder Eintrag IST ein Modell. Keine
         Summe der Anteile, die waere immer 100. */
      total: function () { return isArr(state.model) ? state.model.length : null; },
      centerLabel: "Models",
      collapseHost: root.querySelector(".udd-modelcard")
    }) : null;

    function modelItems() {
      return (isArr(state.model) ? state.model : []).map(function (m) {
        return {
          key: String(m.model || ""),
          name: String(m.model || ""),
          share: num(m.model_share_pct) || 0,
          color: (isDark ? m.color_darkmode : m.color_lightmode) || typFarbe(),
          logo: String(m.model_logo_url || "")
        };
      });
    }

    function syncModelSeg() {
      if (!elModelSeg) return;
      [].forEach.call(elModelSeg.querySelectorAll("[data-mchart]"), function (b) {
        var an = b.getAttribute("data-mchart") === state.modelMode;
        b.classList.toggle("is-active", an);
        b.setAttribute("aria-selected", an ? "true" : "false");
      });
      root.classList.toggle("is-modeldonut", state.modelMode === "doughnut");
    }

    function renderBars() {
      if (!modelDonut) return;
      if (state.error) { modelDonut.empty(state.error); return; }
      if (istLaden() || !isArr(state.model)) { modelDonut.skeleton(); return; }
      var mi = modelItems();
      if (!mi.length) { modelDonut.empty("No model data for this period."); return; }
      if (state.modelMode === "bar") modelDonut.renderBars(mi);
      else modelDonut.renderDonut(mi);
    }

    function render() {
      syncSeg();
      syncTypeSeg();
      syncModelSeg();
      renderHead();
      renderKpi();
      renderChart();
      renderFunnel();
      renderTypes();
      renderBars();
    }

    /* ---- Granularitaet: was die Daten hergeben ----------------------------------------------- */
    function granPruefen() {
      if (!UC.granAvailability) return;
      var reihe = state.mode === "citation"
        ? (isArr(state.share) ? state.share : [])
        : (state.urls && isArr(state.urls.points) ? state.urls.points : []);
      var neu = UC.granAvailability(root, reihe, state.gran);
      if (neu !== state.gran) {
        state.gran = neu; GRAN_STORE[instanceId] = neu;
        syncSeg();
        fire("data-gran-fn", "uddGran", { mode: state.mode, gran: neu, scope: state.scope });
      }
    }

    /* ---- Klicks ------------------------------------------------------------------------------ */
    root.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      var m = e.target.closest("[data-mode]");
      if (m && elSeg.contains(m)) {
        var k = m.getAttribute("data-mode");
        if (k === state.mode) return;              /* schon da: kein Ereignis, kein Neuladen */
        state.mode = k; MODE_STORE[instanceId] = k;
        /* Der Wechsel nach Domain Share fordert die URL-Serie an: ab hier wird gewartet. */
        if (k === "domain" && !state.urls) urlWarteStarten();
        syncSeg(); renderHead(); renderKpi(); renderChart();
        fire("data-mode-fn", "uddMode", { mode: k, gran: state.gran, scope: state.scope });
        return;
      }
      var s = e.target.closest("[data-scope]");
      if (s && elScope.contains(s)) {
        var sk = s.getAttribute("data-scope");
        if (sk === state.scope) return;
        state.scope = sk; SCOPE_STORE[instanceId] = sk;
        /* Global und Domain sind zwei verschiedene Bezugsgroessen: die alte Kurve unter der neuen
           Beschriftung stehen zu lassen waere eine falsche Aussage, kein "noch nicht aktuell". */
        state.urlsStale = true; urlWarteStarten();
        syncSeg(); renderChart();
        fire("data-scope-fn", "uddScope", { mode: state.mode, gran: state.gran, scope: sk });
        return;
      }
      var mc = e.target.closest("[data-mchart]");
      if (mc && elModelSeg && elModelSeg.contains(mc)) {
        var mk = mc.getAttribute("data-mchart");
        if (mk === state.modelMode) return;
        state.modelMode = mk; MCHART_STORE[instanceId] = mk;
        syncModelSeg();
        /* Animiert wird die Karte selbst, nicht mehr eine feste Zeile um beide: die gibt es seit
           dem Bereichsmenue nicht mehr. Weil das Raster seine Karten streckt, misst die Karte die
           Hoehe ihrer Rasterzeile -- steht der Breakdown allein, ist es seine eigene. */
        hoeheAnimiert(root.querySelector(".udd-modelcard"), renderBars);
        /* Kein Ereignis nach Bubble: derselbe Datensatz, andere Darstellung. */
        return;
      }

      var c = e.target.closest("[data-chart]");
      if (c && elTypeSeg && elTypeSeg.contains(c)) {
        var ck = c.getAttribute("data-chart");
        if (ck === state.chartMode) return;
        state.chartMode = ck; CHART_STORE[instanceId] = ck;
        syncTypeSeg();
        hoeheAnimiert(root.querySelector(".udd-typecard"), renderTypes);
        /* Kein Ereignis nach Bubble: der Wechsel zeichnet dieselben Daten anders. */
        return;
      }

      var g = e.target.closest("[data-gran]");
      if (g && elGran.contains(g)) {
        var gk = g.getAttribute("data-gran");
        if (gk === state.gran) return;
        state.gran = gk; GRAN_STORE[instanceId] = gk;
        /* Nur im Domain-Share: dort haengt die x-Achse an der URL-Serie, und eine Tageskurve
           unter der Aufschrift "Month" ist falsch. Im Citation-Share bleibt die alte Kurve
           stehen, bis setDomainDetail die neue bringt -- dort ist sie nur veraltet, nicht falsch. */
        if (state.mode === "domain") { state.urlsStale = true; urlWarteStarten(); }
        syncSeg(); renderChart();
        fire("data-gran-fn", "uddGran", { mode: state.mode, gran: gk, scope: state.scope });
        return;
      }
    });

    /* ---- Thema ------------------------------------------------------------------------------- */
    if (UC.onTheme) UC.onTheme(function (dunkel) {
      isDark = !!dunkel;
      if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
      /* Die Kurve zeichnet das Kit selbst neu (makeLine haengt an onTheme). Trichter, Balken und
         der Typ-Split tragen ihre Farben im Markup und muessen es hier tun. */
      renderTypes();
      renderFunnel(); renderBars();
    });

    /* Die Beschriftungsspalte der Balken haengt an der Breite der EIGENEN Box. */
    if (window.ResizeObserver) {
      var letzteSchmal = root.classList.contains("is-narrow");
      new ResizeObserver(function () {
        var schmal = root.classList.contains("is-narrow");
        if (schmal !== letzteSchmal) { letzteSchmal = schmal; renderBars(); }
      }).observe(root);
    }

    var ctrl = {
      setData: function (payload) {
        var p = UC.parseLoose ? UC.parseLoose(payload, "domain-detail") : payload;
        /* Ein Payload, den parseLoose nicht lesen konnte, darf nicht stillschweigend verpuffen:
           sonst laeuft das Skelett endlos und sieht aus wie "gleich da". */
        var ok = p && typeof p === "object" && !isArr(p);
        if (!ok) {
          state.error = "The domain data could not be read.";
          state.hasData = false; state.loading = false;
          warteBeenden(); render(); return;
        }
        state.error = null;
        if (p.header && typeof p.header === "object") state.header = p.header;
        var ts = p.timeseries && typeof p.timeseries === "object" ? p.timeseries : {};
        if (isArr(ts.citation_share_over_time)) state.share = ts.citation_share_over_time;
        if (isArr(p.model_breakdown)) state.model = p.model_breakdown;
        if (p.source_presence_funnel && typeof p.source_presence_funnel === "object") {
          state.funnel = p.source_presence_funnel;
        }
        /* types_breakdown ist neu im Payload. Fehlt es, bleibt state.types null und der Abschnitt
           zeigt sein Skelett -- nicht "keine Typen", denn das waere eine Aussage ueber Daten, die
           gar nicht geschickt wurden. */
        if (isArr(p.types_breakdown)) state.types = p.types_breakdown;
        state.hasData = !!(state.header || state.share || state.model || state.funnel || state.types);
        state.loading = false;
        warteBeenden();
        granPruefen();
        render();
        return true;
      },
      setUrls: function (payload) {
        var p = UC.parseLoose ? UC.parseLoose(payload, "domain-detail urls") : payload;
        if (!p || typeof p !== "object" || !isArr(p.points)) {
          /* Die URL-Serie ist der zweite Aufruf und darf den ersten nicht mitreissen: ein
             unlesbarer Payload beendet nur den Wartezustand DIESES Charts. */
          state.urls = { points: [] };
        } else {
          state.urls = p;
          /* Der Payload sagt selbst, welchen Bezug er hat -- der Schalter folgt ihm, statt ihn
             zu ueberschreiben. */
          if (p.share_mode === "global" || p.share_mode === "domain") {
            state.scope = p.share_mode; SCOPE_STORE[instanceId] = state.scope;
          }
        }
        state.loading = false;
        state.urlsStale = false; state.urlsError = null;
        warteBeenden(); urlWarteBeenden();
        if (state.mode === "domain") granPruefen();
        syncSeg(); renderChart();
        return true;
      },
      setLoading: function (v) {
        state.loading = isYes(v);
        /* Loading = yes heisst: KEINE Daten zeigen -- nicht "die alten stehen lassen und ein
           Skelett darueberlegen". Der Unterschied ist nicht theoretisch: gemeldet wurde, dass beim
           Laden einer neuen Domain hier und da die Linie der VORIGEN erschien. Solange die alten
           Zahlen im Zustand liegen, kann jeder Weg, der spaeter neu zeichnet, sie wieder auf den
           Schirm bringen -- eine verzoegerte Zeichnung, ein Themenwechsel, ein Breitenwechsel.
           Weggeworfen kann das keiner mehr. Den Rest bringt der naechste setDomainDetail.
           Folge, die genannt sein muss: setzt ein Workflow loading=yes und danach loading=no OHNE
           neue Daten zu schicken, steht "No data" da und nicht mehr der alte Stand. Das ist die
           Regel, um die es hier geht. */
        if (state.loading) {
          state.header = null; state.share = null; state.urls = null;
          state.model = null; state.funnel = null; state.types = null;
          state.hasData = false; state.error = null;
          state.urlsStale = false; state.urlsError = null;
          warteStarten();
        } else warteBeenden();
        render();
        return true;
      },
      reset: function () {
        state.header = null; state.share = null; state.urls = null;
        state.model = null; state.funnel = null; state.types = null;
        state.hasData = false; state.error = null; state.loading = false;
        state.urlsStale = false; state.urlsError = null; urlWarteBeenden();
        state.mode = "citation"; MODE_STORE[instanceId] = "citation";
        state.gran = "day"; GRAN_STORE[instanceId] = "day";
        state.scope = "global"; SCOPE_STORE[instanceId] = "global";
        warteStarten();
        render();
        return true;
      },
      destroy: function () { warteBeenden(); try { line.destroy && line.destroy(); } catch (e) {} }
    };

    root.__uddController = ctrl;
    if (spaet) spaet.drain(instanceId, ctrl);

    /* Bubble fuellt dynamische Attribute manchmal erst NACH diesem Lauf -- der Markenname in der
       vierten Trichterstufe kommt von dort. */
    if (window.MutationObserver) {
      new MutationObserver(function () {
        var b = (root.getAttribute("data-brand") || "").trim();
        if (b === "BRAND_NAME") b = "";
        if (b && b !== state.brand) { state.brand = b; renderFunnel(); }
        var d = UC.themeParam(root.getAttribute("data-isdark"));
        if (d !== isDark) { isDark = d; renderFunnel(); renderBars(); }
      }).observe(root, { attributes: true, attributeFilter: ["data-brand", "data-isdark", "data-theme"] });
    }

    if (elLyBtn) {
      elLyBtn.innerHTML = UC.icon("settings", 2);
      var lyPop = UC.makePopover ? UC.makePopover({
        wrap: elLyWrap, menu: elLyPop, opener: elLyBtn
      }) : null;
      elLyBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        lyOeffnen();
        if (lyPop) lyPop.toggle();
      });
      elLyPop.addEventListener("click", function (e) {
        var ey = e.target.closest ? e.target.closest("[data-ly-eye]") : null;
        if (ey) {
          var ek = ey.getAttribute("data-ly-eye");
          /* Der letzte sichtbare Bereich bleibt sichtbar -- eine leere Seite ist kein Zustand, den
             man versehentlich herstellen koennen soll. */
          var sichtbar = state.layout.filter(function (x) { return !x.aus; });
          var ziel = state.layout.filter(function (x) { return x.key === ek; })[0];
          if (ziel && !ziel.aus && sichtbar.length <= 1) return;
          if (ziel) ziel.aus = !ziel.aus;
          layoutSchreiben(); layoutAnwenden(); lyOeffnen();
          return;
        }
        if (e.target.closest && e.target.closest(".udd-lyreset")) {
          state.layout = BEREICHE.map(function (b) {
            return { key: b.key, label: b.label, aus: false };
          });
          layoutSchreiben(); layoutAnwenden(); lyOeffnen();
        }
      });
    }

    state.layout = layoutLesen();
    layoutAnwenden();

    render();
    return ctrl;
  }

  /* Wartet ein Aufruf auf eine Instanz, die es gerade nicht gibt, geht er NICHT verloren --
     siehe UC.makeLate. Bubble baut das Element zwischen zwei Durchlaeufen neu, und der Workflow
     feuert genau in dieses Fenster. */
  var spaet = UC.makeLate ? UC.makeLate("domain-detail", ".udd-root") : null;

  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "udd-root", notPortal: true,
    ctrlProp: "__uddController",
    resolveLocal: "__uddResolveLocal",
    queue: "__uddBootQueue",
    initRoot: initRoot,
    api: {
      setDomainDetail:        function (id, p) { return each(id, function (c) { c.setData(p); }); },
      setDomainDetailUrls:    function (id, p) { return each(id, function (c) { c.setUrls(p); }); },
      setDomainDetailLoading: function (id, v) { return each(id, function (c) { c.setLoading(v); }); },
      resetDomainDetail:      function (id)    { return each(id, function (c) { c.reset(); }); }
    }
  });

  function each(id, fn) {
    var roots = mount.rootsWithId(String(id == null ? "default" : id).trim());
    if (!roots.length) {
      if (spaet) return spaet.park(id == null ? "default" : id, fn);
      return false;
    }
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c); });
    return true;
  }

  if (UC.watchRoots) UC.watchRoots("udd-root", function () {
    [].forEach.call(document.querySelectorAll(".udd-root"), initRoot);
  });
  }

  uddBoot(30);
})();
