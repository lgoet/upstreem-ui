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

  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }

  /* Die grosse Zahl oben links. Ein fehlender Wert wird zum Gedankenstrich, nicht zu "0" oder
     "NaN" -- eine 0 waere eine Aussage, die die Daten nicht hergeben. */
  function bigValue(mode, kpi) {
    var v = num(kpi && kpi[mode.metric]);
    if (v == null) return "–";
    if (mode.fmt === "pct")  return (Math.round(v * 10) / 10).toFixed(1) + "%";
    if (mode.fmt === "rank") return (Math.round(v * 10) / 10).toFixed(1);
    return String(Math.round(v));
  }

  /* Beim Rang ist WENIGER besser -- ein negatives Delta ist also eine Verbesserung. UC.trendChip
     kennt diese Umkehr ueber invert, damit der Pfeil nicht in die falsche Richtung zeigt. */
  function trendHtml(mode, kpi) {
    var d = num(kpi && kpi[mode.delta]);
    if (d == null || !UC.trendChip) return "";
    /* inverted (nicht invert) und decimals -- beides heisst im Kit genau so. Ohne decimals rundet
       trendChip auf ganze Zahlen, aus -4.74 wuerde "5". Und beim Rang ist WENIGER besser, darum
       die Umkehr: ein negatives Delta ist dort eine Verbesserung. */
    return UC.trendChip(d, { inverted: mode.fmt === "rank", decimals: true,
                             suffix: mode.fmt === "pct" ? "pp" : "" });
  }

  function ubdRun() { /* Platzhalter -- makeMount uebernimmt das Einhaengen, siehe unten. */ }

  /* ============================================================================================
     Markup. Die Bubble-Datei traegt nur das Wurzel-Div; alles darunter baut die Komponente
     selbst -- dieselbe Entscheidung wie in performance-detail, aus demselben Grund: es gibt hier
     keine Stelle, an der jemand von Hand etwas einsetzen soll.
     ============================================================================================ */
  function shell() {
    return '' +
      '<div class="ubd-switch" role="tablist">' +
        MODES.map(function (m) {
          return '<button class="ubd-switch-btn" type="button" role="tab" data-mode="' + m.key + '">' +
                   esc(m.label) + '</button>';
        }).join("") +
      '</div>' +

      '<div class="ubd-card">' +
        '<div class="ubd-head">' +
          '<div class="ubd-title">' +
            '<img class="ubd-logo" alt="" onerror="this.style.display=&quot;none&quot;"/>' +
            '<span class="ubd-heading"></span>' +
          '</div>' +
          '<div class="ubd-gran" role="group" aria-label="Granularity">' +
            GRANS.map(function (g) {
              return '<button class="ubd-gran-btn" type="button" data-gran="' + g.key + '">' +
                       esc(g.label) + '</button>';
            }).join("") +
          '</div>' +
        '</div>' +

        '<div class="ubd-kpi">' +
          '<span class="ubd-kpi-val"></span>' +
          '<span class="ubd-kpi-trend"></span>' +
        '</div>' +

        '<div class="ubd-chartwrap"><canvas class="ubd-canvas"></canvas></div>' +
        '<div class="ubd-varwrap"></div>' +
      '</div>';
  }

  function initRoot(root) {
    if (root.__ubdController) return root.__ubdController;

    var instanceId = root.getAttribute("data-instance") || "default";
    if (instanceId === "INSTANCE_ID") return null;   /* Platzhalter noch nicht ersetzt */

    root.innerHTML = shell();

    var fire = UC.makeFire(root, { label: "brand-detail", eventPrefix: "ubd" });

    var elSwitch  = root.querySelector(".ubd-switch");
    var elGran    = root.querySelector(".ubd-gran");
    var elLogo    = root.querySelector(".ubd-logo");
    var elHeading = root.querySelector(".ubd-heading");
    var elVal     = root.querySelector(".ubd-kpi-val");
    var elTrend   = root.querySelector(".ubd-kpi-trend");
    var elCanvas  = root.querySelector(".ubd-canvas");
    var elChart   = root.querySelector(".ubd-chartwrap");
    var elVars    = root.querySelector(".ubd-varwrap");

    var state = {
      mode: "visibility",
      gran: "day",
      company: null,
      series: null,        /* zuletzt empfangene Serie, mitsamt ihrem eigenen mode */
      variations: null,
      loading: false,
      hasData: false
    };

    function darkNow() { return isYes(root.getAttribute("data-isdark")); }

    var line = UC.makeLine({
      wrap: elChart, canvas: elCanvas, legend: null,
      isDark: darkNow, isOwner: function () { return true; },
      gran: function () { return state.gran; },
      watermark: false
    });

    /* ---- Rendern ---------------------------------------------------------------------------- */
    function syncSwitch() {
      Array.prototype.forEach.call(elSwitch.querySelectorAll("[data-mode]"), function (b) {
        var on = b.getAttribute("data-mode") === state.mode;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    function syncGran() {
      Array.prototype.forEach.call(elGran.querySelectorAll("[data-gran]"), function (b) {
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

    function renderKpi() {
      var m = modeOf(state.mode);
      /* Im Variations-Modus gibt es keine einzelne Kennzahl -- die Zeile verschwindet ganz, statt
         eine Zahl aus einem anderen Modus stehen zu lassen. */
      if (!CHART_MODES[state.mode]) { root.classList.add("is-novalue"); return; }
      root.classList.remove("is-novalue");
      var kpi = state.company || {};
      elVal.textContent = bigValue(m, kpi);
      elVal.className = "ubd-kpi-val" + (m.fmt === "sent" ? " up-sent" : "");
      if (m.fmt === "sent" && UC.sentColor) {
        var v = num(kpi[m.metric]);
        elVal.style.color = v == null ? "" : UC.sentColor(v);
      } else {
        elVal.style.color = "";
      }
      elTrend.innerHTML = trendHtml(m, kpi);
    }

    function renderChart() {
      if (!CHART_MODES[state.mode]) return;
      if (state.loading || !state.hasData) { line.skeleton(); return; }
      var p = state.series;
      /* Eine Serie aus einem anderen Modus ist eine Antwort, die waehrend des Wechsels unterwegs
         war. Sie gehoert nicht unter diese Ueberschrift -- also Skelett statt falscher Kurve. */
      if (p && p.mode && p.mode !== state.mode) { line.skeleton(); return; }
      if (!p || !p.series || !p.series.length) { line.empty(); return; }

      /* buildLineDatasets erwartet die company_id an jedem Punkt und das Feld visibility_pct --
         der RPC liefert {day, value} und die id einmal obendrueber. Einmal umlegen, statt eine
         zweite Aufbereitung danebenzustellen. Dasselbe macht performance-detail. */
      var cid = p.company_id != null ? p.company_id
              : ((state.company && state.company.company_id) || "series");
      var pts = p.series.map(function (x) {
        return { company_id: cid, day: x.day, visibility_pct: num(x.value) };
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
      syncSwitch(); syncGran(); renderHead(); renderKpi(); renderChart();
      if (state.mode === "variations") renderVariations();
    }

    /* ---- Variations -------------------------------------------------------------------------
       Vorlaeufig hier, absichtlich schlank gehalten: die Tabelle im Radar-Detail kann mehr
       (Suche, Ring, Sortierung) und ist der Kandidat fuer UC.makeVariations. Bis beide Seiten
       stehen, waere ein Kit aus EINEM Verbraucher geraten -- §25 sagt: extrahieren beim zweiten,
       und der zweite ist genau diese Datei. Der Umbau ist der naechste Schritt. */
    function renderVariations() {
      var rows = state.variations;
      if (state.loading || rows == null) {
        elVars.innerHTML = UC.skeletonRows ? UC.skeletonRows(5) : "";
        return;
      }
      if (!rows.length) {
        elVars.innerHTML = '<div class="up-empty-mini">No variations recorded for this brand.</div>';
        return;
      }
      elVars.innerHTML = rows.map(function (v) {
        return '<div class="up-row ubd-vrow">' +
                 '<div class="up-td ubd-td-name">' + esc(String(v.name || "")) + '</div>' +
                 '<div class="up-td ubd-td-cnt"><span class="up-num">' +
                   (num(v.mentioned_count) == null ? "–" : Math.round(num(v.mentioned_count))) +
                 '</span></div>' +
               '</div>';
      }).join("");
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
      state.mode = key;
      if (CHART_MODES[key]) { state.hasData = false; state.series = null; }
      render();
      fire("data-mode-fn", "bubble_fn_ubdMode", { mode: key, gran: state.gran });
    });

    elGran.addEventListener("click", function (e) {
      var b = e.target.closest("[data-gran]");
      if (!b) return;
      var g = b.getAttribute("data-gran");
      if (g === state.gran) return;
      state.gran = g;
      state.hasData = false; state.series = null;
      render();
      fire("data-gran-fn", "bubble_fn_ubdGran", { mode: state.mode, gran: g });
    });

    /* ---- Aussenschnittstelle ---------------------------------------------------------------- */
    var ctrl = {
      root: root,
      setSeries: function (payload) {
        var p = UC.parseLoose ? UC.parseLoose(payload, "brand-detail series") : payload;
        if (p && !isArr(p) && typeof p === "object") {
          state.series = p;
          state.hasData = true;
          state.loading = false;
        }
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
      setLoading: function (v) { state.loading = isYes(v); render(); },
      reset: function () {
        state.series = null; state.variations = null; state.hasData = false;
        state.loading = false; state.mode = "visibility"; state.gran = "day";
        render();
      },
      destroy: function () { try { line.destroy && line.destroy(); } catch (e) {} }
    };

    root.__ubdController = ctrl;
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
      resetBrandDetail:         function (id)    { return each(id, function (c) { c.reset(); }); }
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
