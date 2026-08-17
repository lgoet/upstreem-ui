/* upstreem brand-detail.js — der Kopfbereich der Marken-Detailseite (Praefix `ubd`).
   Braucht core.js.

   Vier Ansichten hinter einem Switcher: Visibility, Ranking und Sentiment zeigen dieselbe Kurve
   mit anderer Kennzahl, Variations zeigt stattdessen die Variantentabelle. Der Switcher ersetzt
   also nicht nur die Daten, sondern in einem Fall den ganzen Inhalt darunter.

   ── Woher die Daten kommen ──────────────────────────────────────────────────────
   setBrandDetailSeries(id, payload)   {"mode":"visibility|rank|sentiment","series":[{day,value}],
                                        "company_id":"..."} -- EIN Modus pro Aufruf. Bubble laedt
                                        beim Moduswechsel nach, ausgeloest vom data-mode-fn-Event.
   setBrandDetailCompany(id, payload)  die Zeile aus dem Marken-RPC: Name, Logo und die drei
                                        Kennzahlen mit ihren _prev/_delta-Geschwistern.
   setBrandDetailVariations(id, rows)  die Varianten dieser Marke, gesamt (nicht pro Thema).

   Die Serie traegt ihren eigenen Modus mit. Das ist Absicht: eine Antwort, die waehrend eines
   Moduswechsels unterwegs war, laesst sich so erkennen und verwerfen, statt eine Rank-Kurve unter
   die Visibility-Ueberschrift zu legen.

   ── Was aus core kommt ──────────────────────────────────────────────────────────
   UC.makeLine + UC.buildLineDatasets   die Kurve, dieselbe wie im Radar-Detail
   UC.trendChip                          der Trend hinter der grossen Zahl
   UC.sentColor / .up-num / .up-rank-group  die Formate fuer Sentiment und Rang
   UC.makeMount, UC.makeFire, UC.parseLoose, UC.esc, UC.isYes   das uebliche Geruest

   Neu ist hier nur, was es nirgends sonst gibt: der Vier-Wege-Switcher und die KPI-Zeile ueber
   der Kurve. Die Variantentabelle ist ein Zwilling der aus performance-detail und gehoert nach
   core, sobald beide Seiten stehen -- siehe den Abschnitt weiter unten. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung -----------------------------------
     Bubble ruft die Setter aus einem Workflow, der neben dem Laden dieser Datei laeuft. Ohne
     Stubs wirft der erste Aufruf und reisst den ganzen Run-JS-Step mit -- also auch die Aufrufe
     fuer die anderen Komponenten, die darunter stehen. */
  var API_NAMES = ["setBrandDetailSeries", "setBrandDetailCompany", "setBrandDetailVariations",
                   "setBrandDetailLoading", "resetBrandDetail"];
  var Q = (window.__ubdBootQueue = window.__ubdBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  /* Nicht aufgeben, wenn core noch fehlt: Bubble haengt die Skripte per jQuery .html() ein, die
     Reihenfolge ist nicht garantiert. Gleiche Bauart wie in den anderen 27 Dateien. */
  function ubdBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { ubdBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    ubdStart();
  }

  function ubdStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, isYes = UC.isYes;
  /* Dieselbe Raute wie in jeder Rang-Zelle -- .up-hash traegt Groesse und Farbe aus core.css. */
  var HASH = UC.HASH_ICON ? UC.HASH_ICON.replace("<svg ", '<svg class="up-hash" ') : "";

  /* Die vier Ansichten. `metric` benennt das Feld im Marken-RPC, `fmt` sagt, wie die grosse Zahl
     oben links aussieht -- Prozent mit einer Nachkommastelle, Rang als 1,0-Zahl, Sentiment als
     ganze Zahl auf der 0-100-Skala. Genau die Formate, die auch jede Tabelle benutzt. */
  var MODES = [
    { key: "visibility", label: "Visibility", heading: "Visibility over Time",
      metric: "avg_visibility_pct", delta: "avg_visibility_delta_pct", fmt: "pct" },
    { key: "rank",       label: "Ranking",    heading: "Ranking over Time",
      metric: "avg_rank",           delta: "avg_rank_delta",           fmt: "rank" },
    { key: "sentiment",  label: "Sentiment",  heading: "Sentiment over Time",
      metric: "avg_sentiment",      delta: "avg_sentiment_delta",      fmt: "sent" },
    { key: "variations", label: "Variations", heading: "Variations" }
  ];
  function modeOf(key) {
    for (var i = 0; i < MODES.length; i++) if (MODES[i].key === key) return MODES[i];
    return MODES[0];
  }
  var CHART_MODES = { visibility: 1, rank: 1, sentiment: 1 };

  var GRANS = [{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" }];

  /* Der Variations-Abschnitt kommt KOMPLETT aus core: Ueberschrift, Untertitel, Suchfeld und der
     Tabellenkopf mit den drei Erklaer-Rauten. Genau derselbe Aufruf steht im Radar-Detail -- was
     hier frueher stand, war eine nackte Tabelle ohne Kopf und ohne Suche.
     scope "overall": im Radar-Detail geht es um EIN Thema, hier um die ganze Marke. Nur dieses
     Wort unterscheidet die Erklaertexte, alles andere ist identisch. */
  /* Modus und Granularitaet leben AUSSERHALB des Controllers, pro data-instance. Bubble haengt
     das HTML-Element bei jedem Filterwechsel neu ein (jQuery .html()); dabei entsteht ein neuer
     Root, initRoot laeuft von vorn, und ein state.mode im Controller waere jedes Mal wieder
     "visibility". Genau daran lag das Zuruecksprungen des Switchers -- nicht an reset und nicht
     an setSeries, die ich beide vorher verdaechtigt habe. visibility-chart macht es seit langem
     so (window.__votGran), aus demselben Grund. */
  var MODE_STORE = (window.__ubdMode = window.__ubdMode || {});
  var GRAN_STORE = (window.__ubdGran = window.__ubdGran || {});

  var VAR_SCOPE = "overall";
  var VARSEC = UC.variationsSection ? UC.variationsSection({ prefix: "ubd", scope: VAR_SCOPE }) : "";
  var VAR_EXPLAIN = UC.variationsExplain ? UC.variationsExplain(VAR_SCOPE) : {};

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }


  /* Beim Rang ist WENIGER besser -- ein negatives Delta ist also eine Verbesserung. UC.trendChip
     kennt diese Umkehr ueber invert, damit der Pfeil nicht in die falsche Richtung zeigt. */
  function trendHtml(mode, kpi) {
    var d = num(kpi && kpi[mode.delta]);
    if (d == null || !UC.trendChip) return "";
    /* inverted (nicht invert) und decimals -- beides heisst im Kit genau so. Ohne decimals rundet
       trendChip auf ganze Zahlen, aus -4.74 wuerde "5". Und beim Rang ist WENIGER besser, darum
       die Umkehr: ein negatives Delta ist dort eine Verbesserung. */
    /* Genau die Optionen, die der Radar-Detail benutzt: decimals, und beim Prozentwert das
       Prozentzeichen -- NICHT "pp". Dieselbe Zahl darf an zwei Orten nicht zwei Einheiten
       tragen. Beim Rang ist WENIGER besser, darum dort die Umkehr. */
    return UC.trendChip(d, { inverted: mode.fmt === "rank", decimals: true,
                             suffix: mode.fmt === "pct" ? "%" : "" });
  }

  function ubdRun() { /* Platzhalter -- makeMount uebernimmt das Einhaengen, siehe unten. */ }

  /* ============================================================================================
     Markup. Die Bubble-Datei traegt nur das Wurzel-Div; alles darunter baut die Komponente
     selbst -- dieselbe Entscheidung wie in performance-detail, aus demselben Grund: es gibt hier
     keine Stelle, an der jemand von Hand etwas einsetzen soll.
     ============================================================================================ */
  function shell() {
    return '' +
      /* .up-seg/.up-seg-btn und .vc-gran/.vc-gran-btn sind die Haus-Bauteile aus core.css --
         derselbe Segmented-Control, den opportunities benutzt, und derselbe
         Granularitaets-Schalter wie in visibility-chart. Hier steht deshalb nur die
         Positionierung, kein eigenes Aussehen. */
      '<div class="up-seg ubd-seg" role="tablist">' +
        MODES.map(function (m) {
          return '<button class="up-seg-btn" type="button" role="tab" data-mode="' + m.key + '">' +
                   esc(m.label) + '</button>';
        }).join("") +
      '</div>' +

      '<div class="ubd-card">' +
        '<div class="ubd-head">' +
          '<div class="ubd-title">' +
            '<img class="ubd-logo" alt="" onerror="this.style.display=&quot;none&quot;"/>' +
            '<span class="ubd-heading"></span>' +
          '</div>' +
          '<div class="vc-gran" role="group" aria-label="Granularity">' +
            GRANS.map(function (g) {
              return '<button class="vc-gran-btn" type="button" data-gran="' + g.key + '">' +
                       esc(g.label) + '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        '<div class="ubd-kpi">' +
          '<span class="ubd-kpi-val"></span>' +
          '<span class="ubd-kpi-trend"></span>' +
        '</div>' +

        '<div class="ubd-chartwrap"><canvas class="ubd-canvas"></canvas></div>' +
        '<div class="ubd-varwrap">' + VARSEC + '</div>' +
      '</div>';
  }

  function initRoot(root) {
    if (root.__ubdController) return root.__ubdController;

    var instanceId = root.getAttribute("data-instance") || "default";
    if (instanceId === "INSTANCE_ID") return null;   /* Platzhalter noch nicht ersetzt */

    root.innerHTML = shell();

    var fire = UC.makeFire(root, { label: "brand-detail", eventPrefix: "ubd" });

    /* Schmale Breiten ueber die EIGENE Box, nicht ueber eine Media Query auf das Fenster -- so
       macht es jede andere Komponente im Repo (UC.widthTiers). Hier stand eine @media-Regel, und
       die traf daneben: dieses Detail liegt in einem Drawer, der auf einem 1440er Bildschirm
       schmal sein kann. Dann griff die Regel nicht, obwohl es genau der Fall ist, fuer den sie
       gedacht war. 560 statt der 768 des Kits: erst dort wird es fuer Ueberschrift plus Schalter
       in einer Zeile wirklich knapp -- gemessen, siehe .ubd-head in der CSS. */
    UC.widthTiers(root, { narrowAt: 560 });

    var elSwitch  = root.querySelector(".ubd-seg");
    var elGran    = root.querySelector(".vc-gran");
    var elLogo    = root.querySelector(".ubd-logo");
    var elHeading = root.querySelector(".ubd-heading");
    var elVal     = root.querySelector(".ubd-kpi-val");
    var elTrend   = root.querySelector(".ubd-kpi-trend");
    var elCanvas  = root.querySelector(".ubd-canvas");
    var elChart   = root.querySelector(".ubd-chartwrap");
    var elVBody   = root.querySelector(".ubd-vbody");
    var elSearch  = root.querySelector(".ubd-search");
    var elSInput  = elSearch ? elSearch.querySelector(".up-search-input") : null;

    var state = {
      mode: MODE_STORE[instanceId] || "visibility",
      gran: GRAN_STORE[instanceId] || "day",
      company: null,
      series: null,        /* zuletzt empfangene Serie, mitsamt ihrem eigenen mode */
      variations: null,
      error: null,          /* Text statt Skelett, wenn ein Payload unlesbar war */
      varQuery: "",
      loading: false,
      hasData: false
    };

    /* Der Ladezustand kommt auf ZWEI Wegen: als Attribut vom Loader (data-processing, so wie in
       brands-overview und citations-combo-chart) und als Aufruf setBrandDetailLoading. Bisher las
       diese Komponente nur den Aufruf -- ein Element, das seinen Ladezustand ueber das Attribut
       fuehrt, liess den KPI mit dem alten Wert stehen, waehrend daneben das Chart-Skelett lief.
       data-isprocessing wird mitgelesen, weil der Loader beide Schreibweisen kennt und ein
       Attributname, an dem es still scheitert, schwer zu finden ist. */
    function readProcessing(){
      var namen = ["data-processing", "data-processing2", "data-isprocessing"];
      for (var i = 0; i < namen.length; i++){
        var v = root.getAttribute(namen[i]);
        if (v == null || v === "" || /^[A-Z_0-9]{3,}$/.test(v)) continue;
        if (isYes(v)) return true;
      }
      return false;
    }
    /* Wer setBrandDetailLoading einmal gerufen hat, fuehrt den Zustand von da an selbst. Sonst
       ueberschrieben sich Attribut und Aufruf gegenseitig, je nachdem was zuletzt kam. */
    var LOADING_EXPLICIT = (window.__ubdLoadingExplicit = window.__ubdLoadingExplicit || {});
    function istLaden(){ return LOADING_EXPLICIT[instanceId] ? !!state.loading : readProcessing(); }

    function darkNow() { return isYes(root.getAttribute("data-isdark")); }

    var line = UC.makeLine({
      wrap: elChart, canvas: elCanvas, legend: null,
      isDark: darkNow, isOwner: function () { return true; },
      gran: function () { return state.gran; },
      /* Nur Visibility ist ein Prozentwert. Rang ist eine Position, Sentiment eine Punktzahl auf
         der 0-100-Skala -- an beide gehoert kein Prozentzeichen. */
      unit: function () { return modeOf(state.mode).fmt === "pct" ? "%" : ""; },
      /* "Share:" passt nur zur Visibility. Der Rang ist eine Position, das Sentiment eine Note. */
      /* Rang IMMER mit einer Nachkommastelle -- "3" und "3.0" im selben Chart lesen sich wie
         zwei Genauigkeiten. Sentiment ist eine ganze Note, Visibility traegt zwei Stellen. */
      decimals: function () {
        var f = modeOf(state.mode).fmt;
        return f === "rank" ? 1 : (f === "sent" ? 0 : 2);
      },
      tipLabel: function () {
        var f = modeOf(state.mode).fmt;
        return f === "rank" ? "Rank:" : (f === "sent" ? "Sentiment:" : "Share:");
      },
      /* watermark stand hier auf false und fehlte damit als einziger Linienchart der App. Kein
         Grund war notiert -- die Kurve hat dieselbe Groesse wie im visibility-chart, also traegt
         sie das Zeichen auch. */
      watermark: true
    });

    /* ---- Rendern ---------------------------------------------------------------------------- */
    /* Dieselben Schwellen wie im visibility-chart: unter acht Tagen keine Wochen-, unter einem
       Monat keine Monatskurve. Faellt die aktive Stufe weg, springt der Schalter auf Day und die
       Komponente holt die Serie in dieser Stufe nach -- sonst zeigte sie eine Kurve, deren Stufe
       nicht mehr waehlbar ist. */
    function syncGranAvailability() {
      if (!UC.granAvailability) return;
      var s = state.series;
      var neu = UC.granAvailability(root, (s && s.series) || [], state.gran);
      if (neu !== state.gran) {
        state.gran = neu; GRAN_STORE[instanceId] = neu;
        syncGran();
        fire("data-gran-fn", "bubble_fn_ubdGran", { mode: state.mode, gran: neu });
      }
    }

    function syncSwitch() {
      Array.prototype.forEach.call(elSwitch.querySelectorAll(".up-seg-btn"), function (b) {
        var on = b.getAttribute("data-mode") === state.mode;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    function syncGran() {
      Array.prototype.forEach.call(elGran.querySelectorAll(".vc-gran-btn"), function (b) {
        b.classList.toggle("is-active", b.getAttribute("data-gran") === state.gran);
      });
    }

    function renderHead() {
      var m = modeOf(state.mode);
      var c = state.company || {};
      var logo = c.logo_url || c.favicon_url || "";
      if (logo) { elLogo.src = logo; elLogo.style.display = ""; }
      else { elLogo.removeAttribute("src"); elLogo.style.display = "none"; }
      elHeading.textContent = m.heading;
    }

    /* Die grosse Zahl benutzt DIESELBEN Bauteile wie jede Tabellenzelle: Sentiment als .up-sent
       mit farbigem Punkt, Rang als .up-rank-group mit vorangestellter Raute. Nur die Schriftgroesse
       ist hier groesser -- das Muster bleibt, damit dieselbe Zahl ueberall gleich aussieht. */
    function kpiInner(m, kpi) {
      var v = num(kpi && kpi[m.metric]);
      if (v == null) return '<span class="up-num">–</span>';
      if (m.fmt === "sent") {
        return '<span class="up-sent">' +
                 '<span class="up-sent-dot" style="background:' + (UC.sentColor ? UC.sentColor(v) : "") + '"></span>' +
                 '<span class="up-sent-val">' + Math.round(v) + '</span>' +
               '</span>';
      }
      if (m.fmt === "rank") {
        return '<span class="up-rank-group">' + HASH + '<span class="up-num">' +
                 (Math.round(v * 10) / 10).toFixed(1) + '</span></span>';
      }
      /* fmtPctShort wie im Radar-Detail: unter einem Prozent steht "<1%" statt eines
         gerundeten "0%", das nach "gar nicht" aussieht. */
      return '<span class="up-num">' +
               (UC.fmtPctShort ? UC.fmtPctShort(v, true) : (Math.round(v * 10) / 10).toFixed(1) + "%") +
             '</span>';
    }

    function renderKpi() {
      var m = modeOf(state.mode);
      /* Im Variations-Modus gibt es keine einzelne Kennzahl -- die Zeile verschwindet ganz, statt
         eine Zahl aus einem anderen Modus stehen zu lassen. */
      if (!CHART_MODES[state.mode]) { root.classList.add("is-novalue"); return; }
      root.classList.remove("is-novalue");
      /* Waehrend geladen wird ein Skelett statt eines Gedankenstrichs. Der Strich ist die
         Anzeige fuer "es gibt hier keinen Wert" -- ihn auch fuers Warten zu benutzen, macht aus
         zwei verschiedenen Lagen dieselbe Anzeige, und der Nutzer sieht nicht, ob er auf etwas
         wartet oder ob nichts kommt. Der Balken ist der Core-Skelettbalken .up-tsk-bar, nur in
         KPI-Groesse (siehe CSS); die Chart-Flaeche darunter zeigt ohnehin schon ihr eigenes. */
      /* DIESELBE Bedingung wie das Chart-Skelett eine Funktion weiter unten. state.loading allein
         reichte nicht: der Ladezustand kommt ueber setBrandDetailLoading, und der Aufruf erreicht
         die Komponente nicht in jedem Aufbau -- gemessen gab er false zurueck, weil resolve() die
         Instanz nicht fand. Das Chart zeigte trotzdem sein Skelett, weil es auf !hasData prueft,
         und der KPI daneben stand mit einem Gedankenstrich. Zwei Anzeigen fuer denselben Zustand,
         die sich widersprechen -- jetzt haengen beide an derselben Frage. */
      if (istLaden() || !state.hasData) {
        elVal.innerHTML = '<span class="up-tsk-bar"></span>';
        elTrend.innerHTML = '<span class="up-tsk-bar"></span>';
        return;
      }
      var kpi = state.company || {};
      elVal.innerHTML = kpiInner(m, kpi);
      elTrend.innerHTML = trendHtml(m, kpi);
    }

    /* Merkt sich, ob in diesem Modus schon einmal eine Kurve stand. Nur dann darf eine Serie aus
       einem fremden Modus stillschweigend verworfen werden -- sonst bliebe die Karte leer, ohne
       dass jemand erfaehrt, worauf sie wartet. */
    var letzteKurve = false;

    function renderChart() {
      if (!CHART_MODES[state.mode]) return;
      /* Der Fehlerfall kommt VOR dem Skelett: sonst laeuft der Ladezustand endlos weiter und
         sieht aus wie "gleich da", obwohl nichts mehr kommt. */
      if (state.error) { line.empty(state.error); return; }
      if (istLaden() || !state.hasData) { line.skeleton(); return; }
      var p = state.series;
      /* Eine Serie aus einem anderen Modus kann hier nur noch stehen, wenn setSeries den Modus
         nicht uebernehmen konnte (etwa "variations" im Serien-Payload). Dann Text statt Skelett:
         ein Ladezustand, den nichts mehr beendet, sieht aus wie "gleich da" und ist es nicht. */
      /* Eine Serie aus einem anderen Modus wird verworfen, nicht angezeigt -- und sie darf den
         Ladezustand nicht verlaengern. Steht schon eine Kurve, bleibt die stehen (besser als ein
         Skelett, das nichts mehr beendet); gab es noch keine, steht dort Text. Das ist der Fall,
         der vorher endlos geladen hat. */
      if (p && p.mode && p.mode !== state.mode) {
        if (!letzteKurve) line.empty("Waiting for " + modeOf(state.mode).label.toLowerCase() + " data.");
        return;
      }
      letzteKurve = true;
      if (!p || !p.series || !p.series.length) { line.empty(); return; }

      /* buildLineDatasets erwartet die company_id an jedem Punkt und das Feld visibility_pct --
         der RPC liefert {day, value} und die id einmal obendrueber. Einmal umlegen, statt eine
         zweite Aufbereitung danebenzustellen. Dasselbe macht performance-detail. */
      var cid = p.company_id != null ? p.company_id
              : ((state.company && state.company.company_id) || "series");
      var pts = p.series.map(function (x) {
        /* dayKey normalisiert, bevor der Punkt ins Dataset geht: die X-Achse gruppiert nach
           diesem Wert, und ein Datum mit Uhrzeit ergaebe pro Zeitstempel eine eigene Kategorie. */
        /* Ein leerer Wert ist hier eine Null, kein Loch: der RPC liefert fuer einen Tag ohne
           Erwaehnungen nichts, gemeint ist aber "an dem Tag war es 0". Eine Luecke in der Kurve
           liest sich stattdessen wie "keine Daten". */
        var w = num(x.value);
        return { company_id: cid, day: UC.dayKey ? UC.dayKey(x.day) : x.day,
                 visibility_pct: w == null ? 0 : w };
      });
      var rgb = UC.heatAt ? UC.heatAt(root, 0.65) : [100, 132, 168];
      var farbe = "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")";
      var c = state.company || {};
      line.render(UC.buildLineDatasets(pts, [{
        company_id: cid, name: c.name || "", color: farbe,
        favicon_url: c.logo_url || c.favicon_url || ""
      }], null));
    }

    function render() {
      root.classList.toggle("is-variations", state.mode === "variations");
      syncSwitch(); syncGran(); syncGranAvailability();
      renderHead(); renderKpi(); renderChart();
      if (state.mode === "variations") renderVariations();
    }

    /* ---- Variations -------------------------------------------------------------------------
       UC.variationRows baut die Zeilen -- dasselbe Kit, das der Radar-Detail benutzt. Gefiltert
       wird hier: die Suche haengt an DIESEM Feld, das Kit soll keinen Zustand kennen. Solange es
       hier noch kein Suchfeld gibt, ist die Suche leer und alle Zeilen kommen durch. */
    /* Der Marken-RPC liefert nur Name und Anzahl. Anteil und Bezugsgroesse rechnen wir hier aus
       der Summe: ueber ALLE Variationen einer Marke summiert sich die Anzahl genau zu deren
       Erwaehnungen, der Anteil ist also nicht geschaetzt, sondern die Definition. Bringt der
       Payload die Felder doch mit (wie im Radar-Detail), gewinnen sie -- gerechnet wird nur, was
       fehlt. Ohne das stuende in der Spalte "Share of Voice" dauerhaft ein Strich, und eine leere
       Spalte sieht aus wie ein Fehler. */
    function varsMitAnteil() {
      var list = state.variations || [];
      var summe = 0, i;
      for (i = 0; i < list.length; i++) { var c = num(list[i].mentioned_count); if (c != null) summe += c; }
      /* Gefiltert wird ERST hier, nach der Summe: sonst waeren die Prozente beim Tippen
         ploetzlich Anteile an den Treffern statt an der Marke, und dieselbe Zeile zeigte ohne
         Suche 27,8% und mit Suche 100%. Das Kit filtert nicht, es hebt den Treffer nur hervor. */
      var q = String(state.varQuery || "").toLowerCase();
      if (q) list = list.filter(function (v) {
        return String(v.name || "").toLowerCase().indexOf(q) !== -1;
      });
      return list.map(function (v) {
        var c = num(v.mentioned_count);
        var sov = num(v.share_of_voice_pct);
        return {
          name: v.name,
          mentioned_count: v.mentioned_count,
          share_of_voice_pct: sov != null ? sov : (summe > 0 && c != null ? (c / summe) * 100 : null),
          mentions_total: num(v.mentions_total) != null ? v.mentions_total : (summe || null)
        };
      });
    }

    function renderVariations() {
      if (!elVBody) return;
      /* Waehrend des Ladens Skelett-Zeilen im Spaltenraster -- dieselben Balkenbreiten wie im
         Radar-Detail: Name lang, Anteil kurz, Anzahl kurz. */
      /* Skelett ueber DASSELBE Kit wie die Zeilen: variationRows(null) liefert es mit den
         richtigen Zellklassen. Ein eigener skeletonRows-Aufruf hier hatte genau die Breiten
         nicht, an denen die Spalten haengen. */
      if (state.loading || state.variations == null) {
        elVBody.innerHTML = UC.variationRows(null, { rowClass: "up-vrow ubd-vrow" });
        return;
      }
      elVBody.innerHTML = UC.variationRows(varsMitAnteil(), {
        query: state.varQuery,
        rowClass: "up-vrow ubd-vrow",
        emptyText: state.varQuery ? "No variation matches this search."
                                  : "No variations recorded for this brand."
      });
    }

    /* Suche: lokal, ohne Debounce -- die Liste liegt vollstaendig im Speicher, ein Rundgang zum
       Server waere reine Latenz. Auf-/Zuklappen ist das geteilte .up-search aus core, damit sich
       das Feld anfuehlt wie in jeder anderen Tabelle. */
    if (elSearch && elSInput) {
      elSearch.querySelector(".up-search-btn").addEventListener("click", function () {
        var open = !elSearch.classList.contains("is-open");
        elSearch.classList.toggle("is-open", open);
        if (open) { setTimeout(function () { try { elSInput.focus(); } catch (e) {} }, 60); }
        else if (state.varQuery) {
          state.varQuery = ""; elSInput.value = "";
          elSearch.classList.remove("has-text"); renderVariations();
        }
      });
      elSInput.addEventListener("input", function () {
        state.varQuery = String(elSInput.value || "").trim();
        elSearch.classList.toggle("has-text", !!elSInput.value.length);
        renderVariations();
      });
      elSearch.querySelector(".up-search-clear").addEventListener("click", function () {
        state.varQuery = ""; elSInput.value = ""; elSearch.classList.remove("has-text");
        renderVariations(); try { elSInput.focus(); } catch (e) {}
      });
    }

    /* Die drei Erklaer-Rauten im Tabellenkopf. Dieselbe Karte wie ueberall (UC.makeExplain), die
       Texte kommen aus core -- sonst erklaert dieselbe Spalte an zwei Orten Verschiedenes. */
    if (UC.makeExplain) {
      UC.makeExplain({
        root: root, getIsDark: darkNow,
        html: function (key) {
          var e = VAR_EXPLAIN[key];
          if (!e) return "";
          return '<div class="up-explain-h">' + esc(e.h) + '</div>' +
                 '<div class="up-explain-t">' + esc(e.t) + '</div>';
        }
      });
    }

    /* ---- Bedienung --------------------------------------------------------------------------
       Ein Klick auf den Switcher aendert die Ansicht SOFORT (Ueberschrift, Kennzahl, Skelett) und
       bittet Bubble erst danach um die Daten. Andersherum -- warten, bis die Antwort da ist --
       fuehlt sich an, als haette der Klick nicht gewirkt. */
    elSwitch.addEventListener("click", function (e) {
      var b = e.target.closest("[data-mode]");
      if (!b) return;
      var key = b.getAttribute("data-mode");
      if (key === state.mode) return;
      /* Neuer Modus, neue Kurve: der Merker faellt, damit eine noch nicht gelieferte Serie als
         "Waiting for ..." erscheint und nicht als stehengebliebene Kurve des alten Modus. */
      letzteKurve = false;
      state.mode = key; MODE_STORE[instanceId] = key;
      if (CHART_MODES[key]) { state.hasData = false; state.series = null; }
      render();
      fire("data-mode-fn", "bubble_fn_ubdMode", { mode: key, gran: state.gran });
    });

    elGran.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gran]");
      if (!b) return;
      var g = b.getAttribute("data-gran");
      if (g === state.gran) return;
      state.gran = g; GRAN_STORE[instanceId] = g;
      state.hasData = false; state.series = null;
      render();
      fire("data-gran-fn", "bubble_fn_ubdGran", { mode: state.mode, gran: g });
    });

    /* ---- Aussenschnittstelle ---------------------------------------------------------------- */
    var ctrl = {
      root: root,
      setSeries: function (payload) {
        var p = UC.parseLoose ? UC.parseLoose(payload, "brand-detail series") : payload;
        /* Ein Payload, den parseLoose nicht lesen konnte, darf NICHT stillschweigend verpuffen.
           Vorher blieb in dem Fall loading auf true stehen und das Skelett lief endlos -- von
           aussen nicht von "laedt noch" zu unterscheiden. Dasselbe gilt fuer ein Objekt ohne
           series-Feld: p.series.map haette geworfen und den ganzen Run-JS-Step mitgerissen. */
        var ok = p && !isArr(p) && typeof p === "object" && isArr(p.series);
        if (ok) {
          state.series = p;
          state.hasData = true;
          state.error = null;
          /* Die gelieferte Granularitaet gewinnt: wenn der Workflow automatisch auf Woche oder
             Monat wechselt, muss der Schalter das zeigen -- sonst steht dort Day, waehrend eine
             Wochenkurve daneben liegt. Dieselben Feldnamen wie im visibility-chart: granularity,
             gran als Alternative. */
          var g = UC.normGran ? UC.normGran(p.granularity != null ? p.granularity : p.gran) : null;
          if (g) { state.gran = g; GRAN_STORE[instanceId] = g; }
          /* Der Modus wird hier NICHT angefasst. Er wechselt ausschliesslich durch einen Klick
             auf den Switcher oder durch resetBrandDetail. Ein Workflow, der beim Filterwechsel
             erst die Visibility-Serie nachschiebt, liess den Switcher sonst kurz dorthin springen
             und danach zurueck -- ein Flackern, das aussieht wie ein Fehler. */
        } else {
          state.series = null;
          state.error = (p && p.__parseError) || !p
            ? "The chart data could not be read."
            : "The chart data arrived without a series.";
        }
        state.loading = false;
        render();
      },
      setCompany: function (payload) {
        var c = UC.parseLoose ? UC.parseLoose(payload, "brand-detail company") : payload;
        /* Der RPC liefert eine Liste mit genau einer Zeile -- beides annehmen, statt an einer
           Klammer zu scheitern. */
        if (isArr(c)) c = c[0];
        if (c && typeof c === "object") state.company = c;
        render();
      },
      setVariations: function (rows) {
        var list = UC.parseLoose ? UC.parseLoose(rows, "brand-detail variations") : rows;
        state.variations = isArr(list) ? list : [];
        state.loading = false;
        render();
      },
      setLoading: function (v) {
        LOADING_EXPLICIT[instanceId] = true;
        state.loading = isYes(v); render();
      },
      reset: function (hart) {
        state.series = null; state.variations = null; state.hasData = false;
        state.loading = false;
        /* Ohne Argument laesst reset Modus und Granularitaet stehen: der Filter-Workflow ruft es
           bei jedem Wechsel, und der Nutzer soll dabei nicht aus seiner Ansicht geworfen werden.
           MIT "yes" ist es ein echter Neuanfang -- Visibility, Tagesaufloesung, Store geleert. Das
           ist der Fall, den ein Zuruecksetzen-Knopf braucht. */
        if (isYes(hart)) {
          state.mode = "visibility"; state.gran = "day";
          MODE_STORE[instanceId] = "visibility"; GRAN_STORE[instanceId] = "day";
        }
        letzteKurve = false;
        /* Auch die Suche zuruecksetzen: sonst zeigt die naechste Marke eine gefilterte Liste,
           ohne dass irgendwo ein Suchbegriff zu sehen waere. */
        state.varQuery = ""; state.error = null;
        if (elSInput) { elSInput.value = ""; }
        if (elSearch) { elSearch.classList.remove("is-open", "has-text"); }
        render();
      },
      destroy: function () { try { line.destroy && line.destroy(); } catch (e) {} }
    };

    root.__ubdController = ctrl;
    /* Aendert der Loader sein Attribut, muss die Komponente das sehen -- sonst bliebe das
       Skelett stehen oder erschiene nie. */
    if (window.MutationObserver){
      /* data-isdark gehoert MIT in den Filter: die Ueberschriften, die KPI-Zeile und die Legende
         entstehen in render() und lasen den Wert bisher nur beim ersten Bau. Die Kurve selbst
         zeichnet das Kit von sich aus neu -- makeLine haengt seit dieser Runde an UC.onTheme. */
      new MutationObserver(function(){
        if (!LOADING_EXPLICIT[instanceId]) render();
      }).observe(root, { attributes: true,
                         attributeFilter: ["data-isdark", "data-processing", "data-processing2", "data-isprocessing"] });
    }

    render();
    return ctrl;
  }

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }

  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "ubd-root", notPortal: true,
    ctrlProp: "__ubdController",
    resolveLocal: "__ubdResolveLocal",
    queue: "__ubdBootQueue",
    initRoot: initRoot,
    api: {
      setBrandDetailSeries:     function (id, p) { return each(id, function (c) { c.setSeries(p); }); },
      setBrandDetailCompany:    function (id, p) { return each(id, function (c) { c.setCompany(p); }); },
      setBrandDetailVariations: function (id, p) { return each(id, function (c) { c.setVariations(p); }); },
      setBrandDetailLoading:    function (id, v) { return each(id, function (c) { c.setLoading(v); }); },
      /* Zweites Argument "yes" setzt auch Modus und Granularitaet zurueck. Ohne bleibt die
         Ansicht des Nutzers stehen -- siehe die Begruendung an reset(). */
      resetBrandDetail:         function (id, hart) { return each(id, function (c) { c.reset(hart); }); }
    }
  });

  function each(id, fn) {
    var roots = mount.rootsWithId(String(id == null ? "default" : id).trim());
    if (!roots.length) return false;
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c); });
    return true;
  }

  if (UC.watchRoots) UC.watchRoots("ubd-root", function () {
    Array.prototype.forEach.call(document.querySelectorAll(".ubd-root"), initRoot);
  });

  ubdRun();
  }

  ubdBoot(30);
})();
