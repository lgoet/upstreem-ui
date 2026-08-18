/* upstreem domain-detail.js — die Domain-Detailseite. Braucht core.js (window.UpstreemCore).

   Drei Abschnitte in einer Wurzel, von oben:
     1. Umschalter (Citation Share / Domain Share) ueber einer Karte mit Kopfzeile, KPI und Kurve.
        Aufbau, Masse und Verhalten sind die von brand-detail -- dieselbe Karte, andere Daten.
     2. "Source Funnel": vier Stufen als Trichter.
     3. "Model Breakdown": Balkenliste je Modell.

   Was aus core kommt und hier NICHT noch einmal entsteht:
     UC.makeLine + UC.buildLineDatasets   die Kurve samt Tooltip, Legende, Skelett
     UC.makeBarList                       die Balkenliste (Markup und CSS wie im Type-Chart)
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
  var STUFEN = [
    { key: "responses", label: "Responses citing this domain",
      wert: function (f) { return f.ai_searches_citing_domain; },
      unter: function () { return "Responses"; } },
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

  var MODE_STORE = (window.__uddMode = window.__uddMode || {});
  var GRAN_STORE = (window.__uddGran = window.__uddGran || {});
  var SCOPE_STORE = (window.__uddScope = window.__uddScope || {});

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
      /* Umschalter und Karte stehen in EINEM Block: die Wurzel setzt 32px zwischen ihre Kinder,
         und zwischen Umschalter und seiner Karte gehoeren 16. */
      '<div class="udd-block">' +
      '<div class="up-seg udd-seg" role="tablist">' +
        MODES.map(function (m) {
          return '<button class="up-seg-btn" type="button" role="tab" data-mode="' + m.key + '">' +
                   esc(m.label) + '</button>';
        }).join("") +
      '</div>' +

      '<div class="udd-card udd-chartcard">' +
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
      '</div>' +

      '<div class="udd-card udd-funnelcard">' +
        '<div class="udd-sec">' +
          '<span class="udd-sec-title">Source Funnel</span>' +
          '<span class="udd-sec-desc">How often this source is cited, how many of its cited URLs ' +
            'mention brands, and where your brand is still missing</span>' +
        '</div>' +
        '<div class="udd-funnel"></div>' +
      '</div>' +

      '<div class="udd-card udd-modelcard">' +
        '<div class="udd-sec">' +
          '<span class="udd-sec-title">Model Breakdown</span>' +
          '<span class="udd-sec-desc">Distribution of this domain in AI models</span>' +
        '</div>' +
        '<div class="udd-bars"></div>' +
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
    var elBars    = root.querySelector(".udd-bars");

    /* UC.themeParam und nicht das Attribut allein: kennt core ein Thema, gewinnt core. Das
       Attribut ist die Momentaufnahme aus dem Lauf des Workflows. */
    var isDark = UC.themeParam(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    function darkNow() { return isDark; }

    var state = {
      mode:  MODE_STORE[instanceId]  || "citation",
      gran:  GRAN_STORE[instanceId]  || "day",
      scope: SCOPE_STORE[instanceId] || "global",
      header: null, share: null, urls: null, model: null, funnel: null,
      brand: (root.getAttribute("data-brand") || "").trim(),
      loading: false, hasData: false, error: null,
      /* Die URL-Serie kommt aus einem EIGENEN Workflow, ausgeloest durch einen Klick. Deshalb hat
         sie ihren eigenen Wartezustand: urls === null heisst "noch nie etwas angekommen",
         urlsStale heisst "wir haben etwas, aber gerade neue Zahlen angefordert". Beides ist
         WARTEN und muss ein Skelett zeigen -- nicht "No URL data", denn das ist eine Aussage
         ueber die Daten und nicht ueber uns. urlsError ist das Ende der Geduld. */
      urlsStale: false, urlsError: null
    };
    if (state.brand === "BRAND_NAME") state.brand = "";

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

    var bars = UC.makeBarList({
      mount: elBars,
      isDark: darkNow,
      /* Die Beschriftungsspalte nur, wenn die Komponente breit genug ist -- gemessen an der
         eigenen Box ueber die Klasse, die widthTiers setzt. */
      labelCol: function () { return !root.classList.contains("is-narrow"); },
      fmt: function (v) { return UC.fmtPct(v, 1); }
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
      elLogo.querySelector(".up-logo-ltr").textContent = (name || "?").charAt(0).toUpperCase();
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
    }

    function renderBars() {
      if (state.error) { elBars.innerHTML = '<div class="up-chart-empty">' + esc(state.error) + '</div>'; return; }
      if (istLaden() || !isArr(state.model)) { bars.skeleton(4); return; }
      var items = state.model.map(function (m) {
        return {
          key: m.model,
          name: m.model,
          share: num(m.model_share_pct) || 0,
          /* Jedes Modell bringt seine eigene Farbe je Thema mit; ohne die faellt es auf die
             Typfarbe der Domain zurueck, damit die Liste nie farblos dasteht. */
          color: (isDark ? m.color_darkmode : m.color_lightmode) || typFarbe(),
          logo: m.model_logo_url || ""
        };
      });
      bars.render(items);
    }

    function render() {
      syncSeg();
      renderHead();
      renderKpi();
      renderChart();
      renderFunnel();
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
      /* Die Kurve zeichnet das Kit selbst neu (makeLine haengt an onTheme). Der Trichter und die
         Balken tragen ihre Farben im Markup und muessen es hier tun. */
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
        state.hasData = !!(state.header || state.share || state.model || state.funnel);
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
        if (state.loading) warteStarten(); else warteBeenden();
        render();
        return true;
      },
      reset: function () {
        state.header = null; state.share = null; state.urls = null;
        state.model = null; state.funnel = null;
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
