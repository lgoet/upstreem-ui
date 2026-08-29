/* upstreem visibility-chart.js — component logic. Requires core.js (window.UpstreemCore) loaded first. */
(function(){
  "use strict";

  /* window.renderVisibilityChart / setVisibilityChartLoading / resetVisibilityChart only become
     the real implementations once votRun() finishes below (after the core.js wait). Bubble's own
     "Run Javascript" steps typically poll for these by name in a loop and call whichever one they
     find first — if a "loading" call and a "render with data" call are both still polling while
     core.js is slow to arrive, whichever poll happens to land first wins, independent of which
     Bubble workflow step actually ran first. That's exactly what made loading state unreliable: a
     "data has arrived" render could beat a "start loading" call that was issued earlier, dropping
     the loading state or leaving it to flip back and forth (each flip re-triggering the chart's
     entrance animation) once the delayed call finally landed. Defining thin stub functions here,
     before any waiting happens, means Bubble's poll always finds a callable function on its very
     first try, so calls land in a queue in the exact order Bubble invoked them and get replayed in
     that same order once the real implementations are ready — no more race between independent
     polling loops. */
  /* Stubs must exist before core.js is guaranteed to be loaded — Bubble polls for these by
     name and would otherwise miss the earliest calls. Everything after the wait uses UC.makeMount. */
  var __votBootQueue = window.__votBootQueue = window.__votBootQueue || [];
  if (!window.__votBootStubbed){
    window.__votBootStubbed = true;
    ["renderVisibilityChart", "setVisibilityChartLoading", "resetVisibilityChart", "setVisibilityChartTheme"].forEach(function(n){
      window[n] = function(){ __votBootQueue.push([n, arguments]); };
    });
  }

  /* Bubble injects this component's <script> tags via jQuery .html(), which does not guarantee
     external scripts execute in DOM order — visibility-chart.js can start running before core.js
     has finished loading. Retry briefly instead of bailing forever, same pattern/reasoning as
     urls-table.js and domains-table.js. */
  function votBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ votBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    votRun();
  }

  function votRun(){
  var UC = window.UpstreemCore;
  var esc = UC.esc, isYes = UC.isYes, resolveBubbleFn = UC.resolveBubbleFn, fmt1 = UC.fmt1, CHECK_SVG = UC.CHECK_SVG;

  /* ---- Ein Weg nach draussen, und er ist nicht stumm ------------------------------------------
     Sechs Stellen hatten dasselbe Handmuster:
         var fn = resolveBubbleFn(name);
         if (typeof fn === "function"){ try { fn(x); } catch(e){} }
     Zwei stille Ausfaelle darin. Fehlt die Bubble-Funktion, passiert schlicht NICHTS -- der Nutzer
     klickt auf Sortieren oder Export und die App tut so, als waere nichts gewesen. Und wirft der
     Workflow, faengt das leere catch den Fehler weg, sodass auch in der Konsole nichts steht.
     Beides ist hier jetzt eine Meldung wert.

     Warum nicht UC.makeFire wie ueberall sonst: makeFire schickt EINEN JSON-String (§13), diese
     sechs Events erwarten seit jeher einen rohen Wert ("visibility_desc", eine ID, eine
     Kommaliste). Ein Wechsel wuerde den Vertrag brechen. Die Nutzlast bleibt darum Zeichen fuer
     Zeichen dieselbe -- nur der Ausfall ist ab jetzt hoerbar. */
  function votFire(root, attr, standardName, wert){
    var name = root.getAttribute(attr) || standardName;
    var fn = resolveBubbleFn(name);
    if (typeof fn !== "function"){
      if (window.console) console.error("visibility-chart: " + name + " ist nicht da, " +
        "die Aktion verpufft. Entweder fehlt der Toolbox-Event in Bubble oder " + attr +
        " zeigt auf einen anderen Namen.");
      return false;
    }
    try { fn(wert); return true; }
    catch(e){
      if (window.console) console.error("visibility-chart: " + name + " hat geworfen:", e);
      return false;
    }
  }

  /* ================= data prep =================
     The series→datasets mapping, the fallback palette and the four colour scales all live in
     core.js now (UC.buildLineDatasets / UC.LINE_PALETTE / UC.COLOR_SCALES / UC.SCALE_ORDER):
     brands-overview is fed by the SAME RPC and draws the same chart from it, which is exactly the
     second consumer §25 names as the trigger to extract rather than copy. Behaviour is unchanged. */
  var PALETTE = UC.LINE_PALETTE;
  var COLOR_SCALES = UC.COLOR_SCALES;
  var buildLineDatasets = UC.buildLineDatasets;

  /* ================= controller ================= */
  function makeController(root){
    var tableEl = root.querySelector(".vt-table");
    var lineWrap = root.querySelector(".up-line-wrap");
    var lineCanvas = root.querySelector(".up-line-canvas");
    var legendEl = root.querySelector(".up-legend");
    if (!tableEl || !lineWrap || !lineCanvas){
      return null;
    }

    var instanceId = root.getAttribute("data-instance") || "default";
    var myCtrlId = "cc_" + Math.random().toString(36).slice(2) + "_" + Date.now();
    /* Chart line colour scale — a PAGE-WIDE preference in core (UC.get/setColorScalePref), not a
       per-instance one. It used to be keyed by instanceId, so this chart and brands-overview's
       chart on the same page could sit in two different palettes even though the user set it once.
       Same mechanism the Line Width switch already used: core persists it and broadcasts
       up-colorscale-change, and every mounted chart repaints (see the listener further down). */
    function readColorScale(){ return UC.getColorScalePref ? UC.getColorScalePref() : "default"; }
    function writeColorScale(){ if (UC.setColorScalePref) UC.setColorScalePref(colorScale); }
    var colorScale = readColorScale();
    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
    function readProcessing(){
      var a = root.getAttribute("data-processing");
      var b = root.getAttribute("data-processing2");
      var pa = (a === "IS_PROCESSING" || a == null) ? false : isYes(a);
      var pb = (b === "IS_PROCESSING_2" || b == null) ? false : isYes(b);
      return pa || pb;
    }
    var LOADING_EXPLICIT = (window.__votLoadingExplicit = window.__votLoadingExplicit || {});
    function isLoading(){
      return LOADING_EXPLICIT[instanceId] ? !!state.loading : readProcessing();
    }

    var state = {
      loading: LOADING_EXPLICIT[instanceId]
        ? !!(window.__votCache && window.__votCache[instanceId] && window.__votCache[instanceId].loading)
        : readProcessing(),
      hasLine: false, hasTable: false,
      series: [], companies: [], tableRows: [], filterCompanies: [], totalCount: null
    };
    var SORT_STORE = (window.__votSort = window.__votSort || {});
    var sortField = (SORT_STORE[instanceId] && SORT_STORE[instanceId].field) || "visibility";
    var sortDir = (SORT_STORE[instanceId] && SORT_STORE[instanceId].dir) || "desc";

    var GRAN_STORE = (window.__votGran = window.__votGran || {});
    var GRAN_PICKED = (window.__votGranPicked = window.__votGranPicked || {});
    var INIT_COMPANIES = (window.__votInitCompanies = window.__votInitCompanies || {});
    var curGran = (GRAN_STORE[instanceId] === "week" || GRAN_STORE[instanceId] === "month") ? GRAN_STORE[instanceId] : "day";
    function seriesRangeDays(){
      var days = [];
      /* dayKey: die Liste wird sortiert und dann per Date.parse auf ihre Spanne geprueft. Mit
         einem formatierten Datum sortiert sie alphabetisch, also stehen vorn und hinten die
         falschen Tage -- und die Spanne entscheidet, welche Granularitaetsknoepfe frei sind. */
      (state.series || []).forEach(function(p){ if (p && p.day != null) days.push(UC.dayKey ? UC.dayKey(p.day) : String(p.day)); });
      if (!days.length) return 0;
      days.sort();
      var a = Date.parse(days[0]), b = Date.parse(days[days.length - 1]);
      if (isNaN(a) || isNaN(b)) return days.length;
      return Math.round((b - a) / 86400000) + 1;
    }
    /* Steht jetzt in core -- brand-detail liest dieselben Schreibweisen. */
    var normGran = UC.normGran;
    function inferGran(series){
      var seen = {};
      (series || []).forEach(function(p){ if (p && p.day != null) seen[UC.dayKey ? UC.dayKey(p.day) : String(p.day)] = 1; });
      var arr = Object.keys(seen).sort();
      if (arr.length < 2) return null;
      var gaps = [];
      for (var i = 1; i < arr.length; i++){
        var a = Date.parse(arr[i - 1]), b = Date.parse(arr[i]);
        if (!isNaN(a) && !isNaN(b)) gaps.push((b - a) / 86400000);
      }
      if (!gaps.length) return null;
      gaps.sort(function(x, y){ return x - y; });
      var med = gaps[Math.floor(gaps.length / 2)];
      if (med >= 20) return "month";
      if (med >= 4) return "week";
      return "day";
    }
    function granBtnsLive(){ return Array.prototype.slice.call(root.querySelectorAll(".vc-gran-btn")); }
    function syncGranActive(){ granBtnsLive().forEach(function(bn){ bn.classList.toggle("is-active", bn.getAttribute("data-gran") === curGran); }); }
    /* Die Schwellen stehen in core (UC.granAvailability) -- brand-detail sperrt mit denselben
       Zahlen. Was hier stand, war die Vorlage dafuer. */
    function applyGranAvailability(){
      var neu = UC.granAvailability(root, state.series, curGran);
      if (neu !== curGran){ curGran = neu; GRAN_STORE[instanceId] = neu; syncGranActive(); }
    }

    /* ---------- the line chart, from the shared kit ----------
       Plugins, tooltip, skeleton, size poll, render verify, the balanced-rows legend with its
       hover highlight and the watermark all live in core now. What stays here is the wiring. */
    function isOwner(){ return !root.__votController || root.__votController.__ctrlId === myCtrlId; }
    function darkNow(){ return isDark; }
    function syncTheme(){
      if (isDark){ root.setAttribute("data-theme","dark"); }
      else { root.removeAttribute("data-theme"); }
    }

    var line = UC.makeLine({
      wrap: lineWrap, canvas: lineCanvas, legend: legendEl,
      isDark: darkNow, isOwner: isOwner,
      gran: function(){ return curGran; },
      /* Ohne Nachkommastellen -- vorgegeben. Der Standard des Kits waere zwei. */
      decimals: 0
    });

    /* ---------- render (two independent halves) ---------- */
    function tableHeadHtml(){
      return '<div class="vt-thead">' +
        '<div class="vt-th vt-th-idx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9" /> <line x1="4" x2="20" y1="15" y2="15" /> <line x1="10" x2="8" y1="3" y2="21" /> <line x1="16" x2="14" y1="3" y2="21" /></svg></div>' +
        '<div class="vt-th">Brand</div>' +
        '<div class="vt-th vt-th-visibility">Visibility<span class="up-th-info" data-explain="visibility"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" /></svg></span></div>' +
        '<div class="vt-th vt-th-ranking">Ranking<span class="up-th-info" data-explain="ranking"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" /></svg></span></div>' +
        '<div class="vt-th vt-th-sentiment">Sentiment<span class="up-th-info" data-explain="sentiment"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" /></svg></span></div></div>';
    }
    function tableSkeletonHtml(){
      /* idx needs its own cls (vt-td-idx) — without it the bar falls back to the generic cell's
         left-aligned padding instead of the real idx column's centered one. */
      return tableHeadHtml() + '<div class="vt-tbody">' + UC.skeletonRows({
        count: 7, rowClass: "vt-row", cellClass: "vt-td",
        cols: [{ w:12, cls:"vt-td-idx" }, { w:70, jitter:18, logo:true }, 46, 52, 56]
      }) + '</div>';
    }
    var tableEmptyGraceTimer = null;
    function renderTableSide(){
      if (root.__votController && root.__votController.__ctrlId !== myCtrlId){ return; }
      /* Der Lesefehler kommt VOR dem Skelett -- sonst sieht endloses Laden aus wie "gleich da". */
      if (state.leseFehler){
        if (tableEmptyGraceTimer){ clearTimeout(tableEmptyGraceTimer); tableEmptyGraceTimer = null; }
        tableEl.innerHTML = UC.leseFehlerHtml("brands");
      }
      else if (state.loading || !state.hasTable){
        if (tableEmptyGraceTimer){ clearTimeout(tableEmptyGraceTimer); tableEmptyGraceTimer = null; }
        tableEl.innerHTML = tableSkeletonHtml();
      }
      else { renderTable(); }
    }
    function renderLineSide(){
      if (!isOwner()) return;
      /* Der Lesefehler schlaegt den Ladezustand: sonst dreht die Kurve weiter, waehrend die
         Tabelle daneben den Fehler schon zeigt. */
      if (state.leseFehler){ root.classList.remove("is-line-loading"); closeScaleMenu(); line.empty("The data could not be read."); return; }
      var loading = state.loading || !state.hasLine || state.linePending;
      /* The gear button (and, if it was somehow open when a reload started, its dropdown) has no
         business being reachable over a skeleton — there's nothing to configure yet. Plain
         descendant CSS rule keyed off this class, not a per-render inline style. */
      root.classList.toggle("is-line-loading", loading);
      if (loading){
        closeScaleMenu();   // no-op when it isn't open
        line.skeleton();
        return;
      }
      line.render(buildLineDatasets(state.series, state.companies || [], colorScale));
    }
    function render(){
      if (root.__votController && root.__votController.__ctrlId !== myCtrlId) return;
      syncTheme();
      setHeadCount();
      renderTableSide();
      renderLineSide();
      syncGranActive();
      syncFilterBadge();
    }

    /* ---------- Top Brands table ---------- */
    /* Visibility/Rank/Sentiment cell classes and sentColor() live in core now — shared with
       prompts-table, which formats these three metrics identically. */
    var HASH_ICON = UC.HASH_ICON.replace('<svg ', '<svg class="up-hash" ');
    function trendChip(delta, decimals, inverted, suffix){
      return UC.trendChip(delta, { decimals: decimals, inverted: inverted, suffix: suffix });
    }
    var sentColor = UC.sentColor;
    var ROW_GOTO = '<span class="up-row-goto">' + UC.GOTO_SVG + '</span>';
    function renderTable(){
      var rows = Array.isArray(state.tableRows) ? state.tableRows : [];
      var head = tableHeadHtml();
      if (!rows.length){
        /* An empty tableRows delivery can be an interim "clearing" step before the real data
           lands a moment later — showing "No data" immediately for that interim state flashes an
           empty placeholder that's gone a beat later. Give a short grace window for a follow-up
           render before committing to the empty view. */
        if (!tableEmptyGraceTimer){
          tableEl.innerHTML = tableSkeletonHtml();
          tableEmptyGraceTimer = setTimeout(function(){
            tableEmptyGraceTimer = null;
            if (state.loading || !state.hasTable || (Array.isArray(state.tableRows) && state.tableRows.length)) return;
            tableEl.innerHTML = head + '<div class="up-empty-mini">No data</div>';
          }, 600);   // matches this same file's line-chart __votNoDataT grace window
        }
        return;
      }
      if (tableEmptyGraceTimer){ clearTimeout(tableEmptyGraceTimer); tableEmptyGraceTimer = null; }
      var body = rows.map(function(r, i){
        var pos = (r.position != null) ? Number(r.position) : null;
        var isLast = (i === rows.length - 1);
        var gap = (isLast && pos != null && pos > 7) ? " vt-gap" : "";
        var logo = r.logo_url
          ? '<span class="up-logo-box has-img"><img src="' + esc(r.logo_url) + '"/></span>'
          : '<span class="up-logo-box"></span>';
        var visNull = (r.visibility_pct == null || r.visibility_pct === "");
        var vis = '<span class="up-num' + (visNull ? " is-empty" : "") + '">' + (visNull ? "–" : UC.fmtPct(r.visibility_pct)) + '</span>' + trendChip(r.visibility_delta_pct, false, false, "%");
        var rank = '<span class="up-rank-group">' + HASH_ICON + '<span class="up-num">' + fmt1(r.avg_rank) + '</span></span>' + trendChip(r.avg_rank_delta, true, true);
        var sentNull = (r.sentiment == null || r.sentiment === "" || !isFinite(Number(r.sentiment)));
        var sc = sentNull ? "#9E9E9E" : sentColor(r.sentiment);
        var sent = '<span class="up-sent"><span class="up-sent-dot" style="background:' + sc + '"></span><span class="up-sent-val' + (sentNull ? " is-empty" : "") + '">' + (sentNull ? "–" : Math.round(Number(r.sentiment))) + '</span></span>' + trendChip(r.sentiment_delta, true, false);
        return '<div class="vt-row' + gap + '" data-id="' + esc(String(r.company_id == null ? "" : r.company_id)) + '">' +
          '<div class="vt-td vt-td-idx">' + (pos != null ? pos : "") + '</div>' +
          '<div class="vt-td vt-td-brand">' + logo + '<span class="vt-brand-name">' + esc(r.name == null ? "" : r.name) + '</span>' + ROW_GOTO + '</div>' +
          '<div class="vt-td vt-td-visibility">' + vis + '</div>' +
          '<div class="vt-td vt-td-ranking">' + rank + '</div>' +
          '<div class="vt-td vt-td-sentiment">' + sent + '</div></div>';
      }).join("");
      tableEl.innerHTML = head + '<div class="vt-tbody">' + body + '</div>';
      Array.prototype.slice.call(tableEl.querySelectorAll(".vt-row")).forEach(function(row){
        var id = row.getAttribute("data-id");
        row.addEventListener("mouseenter", function(){ line.highlight(id); });
        row.addEventListener("mouseleave", function(){ line.highlight(null); });
        row.addEventListener("click", function(){
          votFire(root, "data-rowclick-fn", "bubble_fn_votRowClick", id);
        });
      });
      checkBrandWidth();
    }
    /* Auf EINEN Durchlauf pro Bild zusammengefasst. Der Aufruf haengt ueber checkBrandWidth an
       applyResponsive und damit am ResizeObserver: beim Ziehen des Fensters lief er pro
       Zwischenbreite einmal komplett durch. Gemessen auf der echten Seite (40 Resize-Schritte):
       2967 Lesezugriffe allein hier, 25% aller Zugriffe -- rund 74 je Aufruf mal 40 Aufrufe.
       Die 74 sind nicht das Problem: in der Schleife wird nur gelesen, der Browser rechnet das
       Layout also einmal und bedient den Rest daraus. Die 40 sind es.
       Ein Bild spaeter zu entscheiden ist unsichtbar -- der Zustand haengt an der Breite, und die
       ist im naechsten Bild ohnehin schon wieder anders. Der Wachhund __busy faellt damit weg:
       einmalProBild laesst ohnehin nur einen Lauf zu, und ein zweites Schloss davor koennte im
       Fehlerfall dauerhaft zubleiben (frueher blieb __busy stehen, wenn die Schleife warf). */
    var checkTrendFit = UC.einmalProBild ? UC.einmalProBild(trendFitJetzt)
                                         : function(){ trendFitJetzt(); };
    function trendFitJetzt(){
      if (!tableEl) return;
      var hadHide = tableEl.classList.contains("vt-hide-trend");
      if (hadHide) tableEl.classList.remove("vt-hide-trend");
      var cells = tableEl.querySelectorAll(".vt-td-visibility, .vt-td-ranking, .vt-td-sentiment");
      var tooTight = false;
      for (var i = 0; i < cells.length; i++){
        var c = cells[i];
        if (getComputedStyle(c).display === "none") continue;
        var trend = c.querySelector(".up-trend");
        if (!trend) continue;
        var cRect = c.getBoundingClientRect();
        var tRect = trend.getBoundingClientRect();
        var clearance = cRect.right - tRect.right;
        if (clearance < 8){ tooTight = true; break; }
      }
      tableEl.classList.toggle("vt-hide-trend", tooTight);
    }
    function checkBrandWidth(){
      var w = tableEl ? tableEl.clientWidth : 0;
      root.classList.toggle("is-narrow-cell", w > 0 && w < 380);
      if (!w) return;
      var stacked = root.classList.contains("is-narrow");
      var rootW = root.clientWidth || 0;
      tableEl.classList.toggle("vt-hide-sentiment", stacked && rootW > 0 && rootW < 700);
      tableEl.classList.toggle("vt-hide-rank", stacked && rootW > 0 && rootW < 500);
      checkTrendFit();
    }
    function setHeadCount(){
      var hr = root.querySelector(".vot-heading-right");
      var cn = root.querySelector(".vot-head-count");
      if (!hr || !cn) return;
      /* Skeleton for the WHOLE duration of isLoading(), not just before the first load —
         otherwise a stale count from before the loading toggle sits there unchanged, which reads
         as "nothing happened" rather than "loading". Same idiom as the table components' .is-sk. */
      if (isLoading()){ cn.textContent = ""; cn.classList.add("is-sk"); hr.classList.add("has-count"); return; }
      cn.classList.remove("is-sk");
      if (state.totalCount != null && state.totalCount !== ""){ cn.textContent = state.totalCount; hr.classList.add("has-count"); }
      else { hr.classList.remove("has-count"); }
    }

    /* ---------- column explainers (Visibility / Ranking / Sentiment) ----------
       Positioning/flip/caret logic is UC.makeExplain now; only the per-metric copy and the little
       visual sample stay here, because those genuinely are this component's content. */
    /* Visibility/Ranking/Sentiment come from UC.EXPLAIN_TEXT (core) — the one shared wording
       every table with these columns uses now (ranking maps onto the shared "rank" concept;
       "Ranking" is just this table's own heading for it, kept as-is). */
    var EXPLAIN_FALLBACK = {
      visibility: { h: "Visibility", t: "How often the brand appears in AI answers for the tracked prompts, plus the change against the previous period." },
      ranking:    { h: "Ranking", t: "The brand's average position among all brands mentioned, plus the change against the previous period. A lower number is better." },
      sentiment:  { h: "Sentiment", t: "How positively the brand is described when it's mentioned, plus the change against the previous period." }
    };
    function explainInfo(kind){
      if (UC.explainCopy){
        var trend = ", plus the change against the previous period";
        if (kind === "visibility") return UC.explainCopy("visibility", { scope: " for the tracked prompts", trend: trend });
        if (kind === "ranking"){ var r = UC.explainCopy("rank", { trend: trend }); return r ? { h: "Ranking", t: r.t } : null; }
        if (kind === "sentiment") return UC.explainCopy("sentiment", { trend: trend });
      }
      return EXPLAIN_FALLBACK[kind] || null;
    }
    function explainVisual(kind){
      if (kind === "ranking"){
        return '<span class="vot-explain-row">' + HASH_ICON + '<span>2.3</span></span>';
      }
      /* Mirrors the Sentiment CELL: coloured dot + score + trend, the way it actually renders in
         the table. This used to draw three empty coloured circles -- that is the Brand-Mentions
         logo-stack visual, pasted onto the wrong metric, so the panel showed three blank blobs that
         explained nothing. Colours are literal because .up-explain is body-appended and the
         component's CSS variables do not reach it. */
      if (kind === "sentiment"){
        return '<span class="vot-explain-row">' +
          '<span class="vot-explain-sent"><span class="vot-explain-sentdot" style="background:#60D25D"></span>78</span>' +
          '<span class="vot-explain-up">' + UC.TREND_UP + '</span>' +
          '<span class="vot-explain-up">4</span></span>';
      }
      return '<span class="vot-explain-row">18.4%' +
             '<span class="vot-explain-up">' + UC.TREND_UP + '</span>' +
             '<span class="vot-explain-up">2.9%</span></span>';
    }
    UC.makeExplain({
      root: root,
      triggerSel: ".up-th-info",
      getIsDark: darkNow,
      html: function(kind){
        var info = explainInfo(kind);
        if (!info) return "";
        return '<div class="vot-explain-vis">' + explainVisual(kind) + '</div>' +
               '<div class="vot-explain-h">' + esc(info.h) + '</div>' +
               '<div class="vot-explain-t">' + esc(info.t) + '</div>';
      }
    });

    var inner = root;
    var gotoBtn = root.querySelector(".vot-goto");
    var exportBtn = root.querySelector(".vot-export");

    /* ---------- dropdowns via the shared primitive ----------
       Still plain position:absolute children of their position:relative wrappers (STYLEGUIDE §14,
       no portal) — the open/close mechanics, focus escape, Escape key and the single page-wide
       outside-click listener now come from core instead of being re-implemented here. */
    var sortWrap = root.querySelector(".vot-sort");
    var filterWrap = root.querySelector(".vot-filter");
    var filterMenu = root.querySelector(".up-ment-menu");
    var sortMenu = root.querySelector(".up-sort-menu");
    var POP_GROUP = "vot-" + instanceId;
    var sortPop = UC.makePopover({ wrap: sortWrap, menu: sortMenu, opener: root.querySelector(".vot-sort-btn"), group: POP_GROUP });
    var filterPop = UC.makePopover({ wrap: filterWrap, menu: filterMenu, opener: root.querySelector(".vot-filter-btn"), group: POP_GROUP });
    function popFor(wrap){ return wrap === filterWrap ? filterPop : sortPop; }
    function setPopOpen(pop, open){ if (!pop) return; if (open) popFor(pop).open(); else popFor(pop).close(false); }
    function closePops(except){
      [sortWrap, filterWrap].forEach(function(w){ if (w && w !== except) popFor(w).close(false); });
      if (except !== scaleBtn) closeScaleMenu();
    }

    /* Button tooltips: the shared core implementation. This component used to carry its own
       ~70-line copy (.vot-tip) whose state was per root — the pre-fix architecture that broke
       whenever two instances shared a page. */
    UC.makeTooltips(root, darkNow);

    /* ---------- chart color scale ----------
       The whole body-mounted "Chart Settings" menu (colour scales + the app-wide Line Width
       section, its open/close, outside-click, Escape and focus handling) is UC.makeScaleMenu now —
       shared with brands-overview. Only the per-component wiring stays here. */
    var scaleBtn = root.querySelector(".vot-scale-btn");
    var scaleKit = UC.makeScaleMenu({
      btn: scaleBtn,
      getIsDark: darkNow,
      getScale: function(){ return colorScale; },
      setScale: function(k){ colorScale = k; writeColorScale(); },
      /* "Default" previews the colours that would ACTUALLY render right now — each company's own
         RPC colour, in the same top-7 order buildLineDatasets already picks — never a hardcoded
         stand-in. Reuses buildLineDatasets itself (no scale override) rather than re-deriving
         "which 7 companies, in what order" a second time, so it cannot drift from the real chart. */
      defaultColors: function(){
        return buildLineDatasets(state.series, state.companies || [], null)
          .datasets.map(function(d){ return d.__baseColor; });
      },
      onChange: function(){ renderLineSide(); },
      closeOthers: function(){ closePops(scaleBtn); }
    });
    function closeScaleMenu(){ scaleKit.close(); }

    /* A colour scale picked in ANY chart on the page (this one, brands-overview's) lands here. */
    window.addEventListener("up-colorscale-change", function(e){
      var v = e && e.detail ? e.detail.value : null;
      if (!v || v === colorScale) return;
      colorScale = v;
      renderLineSide();
      if (scaleKit && scaleKit.isOpen && scaleKit.isOpen()) scaleKit.populate();
    });


    if (granBtnsLive().length){
      syncGranActive();
      applyGranAvailability();
    }

    /* ---------- Companies dropdown ----------
       Trigger (.vot-filter-btn, the "fader" icon button) is untouched. The PANEL now reuses the
       same generic .up-filter-item/.up-ment-search/.up-filter-submit classes core.css already
       defines for domains-table's "Mentioned brands" dropdown, per the explicit request to bring
       this panel to that version — search-within-dropdown is new (didn't exist before), everything
       else (Reset restores+fires immediately, Deselect-all only clears the draft, MAX_FILTER_SEL=7
       cap, no "Select all" since that would violate the cap) is unchanged behavior. */
    var filterSel = {};
    var filterQuery = "";
    function syncFilterBadge(){
      var badge = root.querySelector(".vot-filter-badge");
      if (!badge) return;
      var active = activeCompanyIds().length;
      /* Only a real filter — fewer than the max selectable — should light up the badge. At the
         full default (7, or all available companies if fewer exist), showing the count would just
         restate what's already obvious from the chart. */
      var maxSelectable = Math.min((state.filterCompanies || []).length, MAX_FILTER_SEL);
      var show = !!USER_FILTERED[instanceId] && active > 0 && active < maxSelectable;
      badge.textContent = show ? String(active) : "";
      badge.classList.toggle("is-visible", show);
    }
    function activeCompanyIds(){
      var ids = [], seen = {};
      (state.companies || []).forEach(function(c){
        if (!c || c.company_id == null) return;
        var id = String(c.company_id);
        if (!seen[id]){ seen[id] = true; ids.push(id); }
      });
      if (ids.length) return ids;
      (state.series || []).forEach(function(p){
        if (!p) return;
        var raw = (p.company_id != null) ? p.company_id : p.id;
        if (raw == null) return;
        var id = String(raw);
        if (!seen[id]){ seen[id] = true; ids.push(id); }
      });
      return ids;
    }
    function seedFilterSelection(){
      filterSel = {};
      var activeIds = {};
      activeCompanyIds().forEach(function(id){ activeIds[id] = true; });
      (state.filterCompanies || []).forEach(function(c){
        if (!c || c.company_id == null) return;
        filterSel[String(c.company_id)] = !!activeIds[String(c.company_id)];
      });
    }
    var MAX_FILTER_SEL = 7;
    var USER_FILTERED = (window.__votUserFiltered = window.__votUserFiltered || {});
    function isAtInitialSelection(){
      /* Compare against what Reset would actually restore (same fallback it uses) — not just
         whatever's currently plotted — so Reset only shows when clicking it would change anything.
         Deliberately not gated on USER_FILTERED: once the draft matches that target again (e.g.
         Deselect all + Apply landed back on the default set), Reset would be a no-op and has no
         business being offered, regardless of whether a filter was applied at some point before. */
      var target = {}, n = 0;
      var initIds = INIT_COMPANIES[instanceId] || activeCompanyIds();
      initIds.forEach(function(id){ target[id] = true; n++; });
      var current = Object.keys(filterSel).filter(function(k){ return filterSel[k]; });
      if (current.length !== n) return false;
      return current.every(function(id){ return target[id]; });
    }
    function applyFilterSearch(){
      var inp = filterMenu.querySelector(".up-ment-search");
      if (inp) filterQuery = inp.value;
      var q = (filterQuery || "").trim().toLowerCase();
      var items = filterMenu.querySelectorAll(".up-filter-item[data-id]");
      var shown = 0;
      Array.prototype.forEach.call(items, function(it){
        var match = !q || (it.getAttribute("data-name") || "").indexOf(q) > -1;
        it.style.display = match ? "" : "none";
        if (match) shown++;
      });
      var nr = filterMenu.querySelector(".up-ment-noresult");
      if (nr) nr.style.display = (items.length && shown === 0) ? "" : "none";
    }
    function populateFilter(){
      if (!filterMenu) return;
      var list = state.filterCompanies || [];
      if (!list.length){ filterMenu.innerHTML = '<div class="up-ment-empty">No companies</div>'; return; }
      var selCount = list.reduce(function(n, c){ return n + (filterSel[String(c.company_id)] ? 1 : 0); }, 0);
      var atMax = selCount >= MAX_FILTER_SEL;
      var allSelected = list.length > 0 && selCount === list.length;
      var showReset = !isAtInitialSelection();
      var showDeselectAll = atMax || allSelected;
      var head = '<div class="up-filter-head"><span class="up-filter-title">Companies</span>' +
        '<span class="vot-filter-head-actions">' +
          (showReset ? '<button class="up-pop-action" type="button" data-companies-reset>Reset</button>' : '') +
          (showDeselectAll ? '<button class="up-pop-action" type="button" data-companies-clear>Deselect all</button>' : '') +
          '<span class="vot-filter-count">' + selCount + '/' + Math.min(list.length, MAX_FILTER_SEL) + '</span>' +
        '</span></div>';
      var search = '<div class="up-ment-searchwrap">' +
          '<input class="up-ment-search" type="text" placeholder="Search companies..." autocomplete="off" spellcheck="false" value="' + esc(filterQuery) + '"/>' +
          '<button class="up-ment-searchclear" type="button" aria-label="Clear company search">' +
            /* UC.icon statt eines eigenen Kreuzes: dieselbe Form wie jedes andere x der App,
               Strichstaerke 2.2 wie bisher -- das Zeichen sitzt in einem Feld und ist dort
               optisch kleiner. */
            UC.icon("x", 2.2) + '</button>' +
        '</div>';
      var items = list.map(function(c){
        var id = String(c.company_id);
        var checked = !!filterSel[id];
        var disabled = !checked && atMax;
        var nm = String(c.name || id);
        var fav = c.favicon_url || c.logo_url || c.favicon || c.logo || "";
        var logo = fav
          ? '<span class="up-ment-logo"><img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>'
          : '<span class="up-ment-logo" style="background:' + esc(c.color || "#9e9e9e") + '"></span>';
        return '<div class="up-filter-item' + (checked ? " is-checked" : "") + (disabled ? " is-disabled" : "") + '" data-id="' + esc(id) + '" data-name="' + esc(nm.toLowerCase()) + '" title="' + esc(nm) + '">' +
          '<span class="up-filter-check">' + CHECK_SVG + '</span>' +
          logo + '<span class="up-ment-name">' + esc(nm) + '</span></div>';
      }).join("");
      filterMenu.innerHTML = head + search +
        '<div class="up-filter-list up-ment-list">' + items +
          '<div class="up-ment-noresult" style="display:none">No matches</div></div>' +
        '<button class="up-filter-submit" type="button" data-companies-apply>Apply</button>';
      applyFilterSearch();

      var resetBtn = filterMenu.querySelector("[data-companies-reset]");
      if (resetBtn) resetBtn.addEventListener("click", function(ev){
        ev.stopPropagation();
        var initIds = INIT_COMPANIES[instanceId] || activeCompanyIds();
        filterSel = {};
        initIds.forEach(function(id){ filterSel[id] = true; });
        populateFilter();
        fireCompaniesSubmit();
        delete USER_FILTERED[instanceId];
      });
      var clearBtn = filterMenu.querySelector("[data-companies-clear]");
      if (clearBtn) clearBtn.addEventListener("click", function(ev){
        ev.stopPropagation();
        filterSel = {};
        populateFilter();
      });
      var searchInp = filterMenu.querySelector(".up-ment-search");
      if (searchInp) searchInp.addEventListener("input", applyFilterSearch);
      var searchClear = filterMenu.querySelector(".up-ment-searchclear");
      if (searchClear) searchClear.addEventListener("click", function(ev){
        ev.stopPropagation();
        var inp = filterMenu.querySelector(".up-ment-search");
        if (inp){ inp.value = ""; filterQuery = ""; applyFilterSearch(); try { inp.focus(); } catch(e2){} }
      });
      Array.prototype.slice.call(filterMenu.querySelectorAll(".up-filter-item[data-id]")).forEach(function(it){
        it.addEventListener("click", function(ev){
          ev.stopPropagation();
          var id = it.getAttribute("data-id");
          var willCheck = !filterSel[id];
          if (willCheck){
            var count = list.reduce(function(n, c){ return n + (filterSel[String(c.company_id)] ? 1 : 0); }, 0);
            if (count >= MAX_FILTER_SEL) return;
          }
          filterSel[id] = willCheck;
          populateFilter();
        });
      });
      var submit = filterMenu.querySelector("[data-companies-apply]");
      if (submit) submit.addEventListener("click", function(ev){ ev.stopPropagation(); fireCompaniesSubmit(); });
    }
    function fireCompaniesSubmit(){
      var ids = Object.keys(filterSel).filter(function(k){ return filterSel[k]; });
      USER_FILTERED[instanceId] = true;
      var payload = ids.join(",");
      votFire(root, "data-submit-fn", "bubble_fn_votSubmitCompanies", payload);
      if (filterWrap) setPopOpen(filterWrap, false);
    }
    if (filterWrap && !filterWrap.__votOutsideBound){
      filterWrap.__votOutsideBound = true;
      document.addEventListener("click", function(e){
        if (filterWrap && !filterWrap.contains(e.target) && !filterMenu.contains(e.target)) setPopOpen(filterWrap, false);
      });
    }
    seedFilterSelection(); populateFilter();

    /* ---- sort dropdown (Visibility default | Ranking | Sentiment) → fires sort_table (new RPC) ---- */
    var SORT_LABELS = [["visibility","Visibility"],["ranking","Ranking"],["sentiment","Sentiment"]];
    var SORT_OUT_FIELD = { visibility: "visibility", ranking: "rank", sentiment: "sentiment" };
    function fireSort(){
      var outField = SORT_OUT_FIELD[sortField] || sortField;
      votFire(root, "data-sort-fn", "bubble_fn_votSortTable", outField + "_" + sortDir);
    }

    /* Oeffnet den Export-Dialog. Dieselbe Mechanik wie in responses-table, urls-table,
       domains-table und prompts-table: der Dialog ist eine eigene Komponente auf der Seite, und
       data-export-instance sagt, welche gemeint ist. Diese Komponente feuerte bisher nur ihr
       eigenes Export-Event und hatte gar keinen Weg zum Dialog. */
    function openExport(){
      var id = String(root.getAttribute("data-export-instance") || "").trim();
      var fn = window.upstreemExportOpen || (window.parent && window.parent.upstreemExportOpen) || (window.top && window.top.upstreemExportOpen);
      if (typeof fn !== "function"){
        if (window.console) console.warn("[visibility-chart] window.upstreemExportOpen nicht gefunden — liegt die Export-Komponente auf dieser Seite, und ist ihr Element SICHTBAR?");
        return false;
      }
      if (!id || id === "EXPORT_INSTANCE_ID"){
        if (window.console) console.warn("[visibility-chart] data-export-instance ist nicht gesetzt.");
        return false;
      }
      try { fn(id); } catch(e){}
      return true;
    }

    function populateSort(){
      if (!sortMenu) return;
      /* uses core.css's shared .up-pop-* / .up-check option rows — this file used to carry a
         byte-identical .vot-pop-* copy of them */
      var opts = SORT_LABELS.map(function(o){
        return '<div class="up-pop-opt ' + (sortField === o[0] ? "is-active" : "") + '" data-field="' + o[0] + '">' + o[1] +
          '<svg class="up-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg></div>';
      }).join("");
      sortMenu.innerHTML = '<div class="up-pop-head">Sort by</div>' + opts +
        '<div class="up-pop-div"></div>' +
        '<div class="up-pop-row"><span class="up-pop-label">Descending</span><span class="up-switch ' + (sortDir === "desc" ? "is-on" : "") + '"></span></div>';
      Array.prototype.slice.call(sortMenu.querySelectorAll(".up-pop-opt")).forEach(function(op){
        op.addEventListener("click", function(e){ e.stopPropagation(); sortField = op.getAttribute("data-field"); SORT_STORE[instanceId] = { field: sortField, dir: sortDir }; populateSort(); fireSort(); });
      });
      var sw = sortMenu.querySelector(".up-switch");
      if (sw) sw.addEventListener("click", function(e){ e.stopPropagation(); sortDir = (sortDir === "desc" ? "asc" : "desc"); SORT_STORE[instanceId] = { field: sortField, dir: sortDir }; populateSort(); fireSort(); });
    }
    populateSort();
    if (sortWrap && !sortWrap.__votOutsideBound){
      sortWrap.__votOutsideBound = true;
      document.addEventListener("click", function(e){
        if (sortWrap && !sortWrap.contains(e.target) && !sortMenu.contains(e.target)) setPopOpen(sortWrap, false);
      });
    }

    if (!root.__votDelegated){
      root.__votDelegated = true;
      root.addEventListener("click", function(e){
        var granBtn = e.target.closest(".vc-gran-btn");
        if (granBtn){
          if (granBtn.classList.contains("is-disabled")) return;
          var g = granBtn.getAttribute("data-gran");
          if (g === curGran) return;
          curGran = g; GRAN_STORE[instanceId] = g; GRAN_PICKED[instanceId] = true; syncGranActive();
          votFire(root, "data-gran-fn", "bubble_fn_votGranularity", g);
          return;
        }
        if (e.target.closest(".vot-maximize")){
          root.classList.toggle("is-max");
          setTimeout(function(){
            line.resize();
          }, 60);
          return;
        }
        if (e.target.closest(".vot-goto")){
          votFire(root, "data-goto-fn", "bubble_fn_votGoTo", instanceId);
          return;
        }
        if (e.target.closest(".vot-export")){
          openExport();
          votFire(root, "data-export-fn", "bubble_fn_votExportTable", instanceId);
          return;
        }
        if (e.target.closest(".vot-filter-btn")){
          e.stopPropagation();
          if (!filterWrap) return;
          var willOpenF = !filterWrap.classList.contains("is-open");
          closePops(filterWrap);
          if (willOpenF){ filterQuery = ""; seedFilterSelection(); populateFilter(); }
          setPopOpen(filterWrap, willOpenF);
          return;
        }
        if (e.target.closest(".vot-sort-btn")){
          e.stopPropagation();
          if (!sortWrap) return;
          var willOpenS = !sortWrap.classList.contains("is-open");
          closePops(sortWrap);
          setPopOpen(sortWrap, willOpenS);
          return;
        }
      });
    }

    var NARROW_STACK = 880;
    function applyResponsive(){
      if (inner){
        var w = inner.clientWidth || root.clientWidth || 0;
        if (w){ if (w < NARROW_STACK) root.classList.add("is-narrow"); else root.classList.remove("is-narrow"); }
      }
      root.classList.toggle("vc-narrow-page", UC.getPageWidth() < 500);
      checkBrandWidth();
      clearTimeout(root.__votRespT);
      root.__votRespT = setTimeout(function(){
        line.resize();
      }, 60);
    }

    if (window.MutationObserver){
      var syncFromAttrs = function(){
        var wantProc = readProcessing();
        var wantDark = isYes(root.getAttribute("data-isdark"));
        var changed = false;
        if (wantDark !== isDark){
          isDark = wantDark;
          if (isDark){ root.setAttribute("data-theme","dark"); }
          else { root.removeAttribute("data-theme"); }
          changed = true;
        }
        if (!LOADING_EXPLICIT[instanceId] && wantProc !== state.loading){
          if (wantProc && !state.loading) cacheInvalidateSeries(instanceId);
          state.loading = wantProc; changed = true;
        }
        if (changed) render();
      };
      new MutationObserver(syncFromAttrs).observe(root, { attributes:true, attributeFilter:["data-processing","data-processing2","data-isdark"] });
      syncFromAttrs();
    }

    if (window.ResizeObserver){
      new ResizeObserver(function(){
        if (root.__votRaf) return;
        root.__votRaf = requestAnimationFrame(function(){ root.__votRaf = null; applyResponsive(); });
      }).observe(tableEl.parentElement || tableEl);
      new ResizeObserver(function(){
        if (root.__votRespRaf) return;
        root.__votRespRaf = requestAnimationFrame(function(){ root.__votRespRaf = null; applyResponsive(); });
      }).observe(inner || root);
      if (legendEl){
        new ResizeObserver(function(){
          if (root.__votLegRaf) return;
          root.__votLegRaf = requestAnimationFrame(function(){ root.__votLegRaf = null; line.relayoutLegend(); });
        }).observe(legendEl);
      }
    }
    window.addEventListener("resize", function(){
      if (root.__votWinRaf) return;
      root.__votWinRaf = requestAnimationFrame(function(){ root.__votWinRaf = null; line.relayoutLegend(); applyResponsive(); });
    });

    applyResponsive();
    render();

    return {
      __ctrlId: myCtrlId,
      reset: function(){
        /* Local state + UI only — deliberately does NOT fire bubble_fn_votSortTable /
           bubble_fn_votSubmitCompanies. Those are the same Toolbox events the Sort dropdown and
           the in-dropdown Companies Reset/Apply use, and this component's Bubble side wires its
           own "on this event" workflow to each of them (which ends in its own Set-Loading-No step,
           among other things). resetVisibilityChart() is also called ahead of a fresh data load
           (e.g. a page-load/slidein-open workflow that still has its own loading state in flight),
           and firing those events from here re-triggered those side-effect workflows mid-load —
           each one flipping loading back off and replaying the chart's entrance animation. Puts
           sort back to Visibility Descending and companies back to the default set so the dropdowns
           read correctly right away; if the caller also wants Bubble to refetch with those
           defaults, that's a separate, explicit step in their own workflow now. */
        /* Ein Reset raeumt den Lesefehler mit weg -- er gehoert zu den Daten, nicht zur
           Bedienung, und der Aufrufer laedt danach frisch. */
        state.leseFehler = false;
        sortField = "visibility";
        sortDir = "desc";
        SORT_STORE[instanceId] = { field: sortField, dir: sortDir };

        filterSel = {};
        delete USER_FILTERED[instanceId];
        delete INIT_COMPANIES[instanceId];  // next fill re-captures it fresh, like a first load

        /* Also EMPTY the data (chart + table back to skeleton), not just the filters. A slide-in
           that re-uses this placement calls resetVisibilityChart() on open; without this the old
           chart/table sat there and re-animated/re-resized during the open (stale data flashing +
           extra paint). Clearing to skeleton means the reopen is light and the next data load
           starts clean. Deliberately fires NO Bubble event — the caller loads fresh data next.
           The instance cache is cleared too so a Bubble re-render doesn't restore the old data. */
        state.series = []; state.tableRows = [];
        state.companies = []; state.filterCompanies = []; state.totalCount = null;
        state.hasLine = false; state.hasTable = false;
        state.linePending = false; state.noDataConfirmed = false;
        if (window.__votCache){ try { delete window.__votCache[instanceId]; } catch(e){} }

        populateSort();
        populateFilter();
        syncFilterBadge();
        render();   // renders skeletons now that hasLine/hasTable are false
        return true;
      },
      update: function(params){
        params = params || {};
        /* Der Payload kam an, war aber nicht lesbar -- normParams in core.js haengt dafuer
           __parseError an (§46). Ohne diesen Zweig traegt der Aufruf keinen bekannten
           Schluessel: weder Kurve noch Tabelle erfahren etwas, das Skelett bleibt stehen, und
           ein zerrissener Payload sieht aus wie "gleich da". Beide Seiten bekommen den
           Lesefehler, damit nicht eine davon weiterlaedt. */
        if (params.__parseError){
          state.leseFehler = true;
          state.loading = false; state.linePending = false;
          state.hasTable = true; state.tableRows = [];
          state.hasLine = true; state.series = []; state.noDataConfirmed = true;
          clearTimeout(root.__votPendingT); clearTimeout(root.__votNoDataT);
          render(); return;
        }
        if (params.isDark != null){
          /* NICHT isYes(params.isDark): der Parameter ist eine Momentaufnahme aus dem Moment,
             in dem Bubble den Payload gebaut hat. Kennt core ein Thema, gewinnt core -- sonst
             dreht ein Render-Aufruf mit altem is_dark die Komponente hinter der App zurueck.
             Siehe UC.themeParam. */
          isDark = UC.themeParam(params.isDark);
          if (isDark){ root.setAttribute("data-theme","dark"); }
          else { root.removeAttribute("data-theme"); }
        }
        if (params.companies != null){
          state.companies = Array.isArray(params.companies) ? params.companies : [];
          if (!INIT_COMPANIES.hasOwnProperty(instanceId) && state.companies.length){
            INIT_COMPANIES[instanceId] = state.companies.map(function(c){ return String(c.company_id); });
          }
          seedFilterSelection(); populateFilter();
        }
        if (params.filterCompanies != null){
          state.filterCompanies = Array.isArray(params.filterCompanies) ? params.filterCompanies : [];
          seedFilterSelection(); populateFilter();
        }
        var __tc = (params.totalCount != null) ? params.totalCount : (params.total_count != null) ? params.total_count : params.companiesTotal;
        if (__tc != null) state.totalCount = __tc;
        /* Nur eine echte Lieferung loescht den Vermerk -- ein reiner Theme-Render darf ihn
           nicht wegraeumen, sonst stuende danach "No data" statt des Fehlers. */
        if (params.table != null || params.rows != null || params.series != null) state.leseFehler = false;
        var __tbl = (params.table != null) ? params.table : (params.brands != null) ? params.brands : params.rows;
        if (__tbl != null){ state.tableRows = Array.isArray(__tbl) ? __tbl : []; state.hasTable = true; }
        if (params.series != null){
          var __arr = Array.isArray(params.series) ? params.series : [];
          if (__arr.length){
            state.series = __arr; state.hasLine = true; state.linePending = false; state.noDataConfirmed = false;
            clearTimeout(root.__votPendingT); clearTimeout(root.__votNoDataT);
            applyGranAvailability(); seedFilterSelection(); populateFilter();
          }
          else {
            state.linePending = !state.hasLine ? false : (isLoading() ? true : state.linePending);
            clearTimeout(root.__votNoDataT);
            root.__votNoDataT = setTimeout(function(){
              if (state.hasLine && (state.series || []).length) return;
              if (isLoading()) return;
              state.hasLine = true; state.series = []; state.linePending = false; state.noDataConfirmed = true;
              render();
            }, 600);
            if (state.hasLine && isLoading()){
              clearTimeout(root.__votPendingT);
              root.__votPendingT = setTimeout(function(){
                if (!state.linePending) return;
                state.linePending = false;
                render();
              }, 2500);
            }
          }
        }
        var __proc = readProcessing();
        if (!GRAN_PICKED[instanceId]){
          var __explicit = normGran(params.granularity != null ? params.granularity : params.gran);
          var __resolved = __explicit || ((!__proc && params.series != null) ? inferGran(state.series) : null);
          if (__resolved && __resolved !== curGran){ curGran = __resolved; GRAN_STORE[instanceId] = __resolved; }
        }
        syncGranActive();
        if (!LOADING_EXPLICIT[instanceId]) state.loading = __proc;
        render();
      },
      setLoading: function(on){
        LOADING_EXPLICIT[instanceId] = true;
        state.loading = isYes(on);
        /* Ein NEUER Ladeversuch raeumt den Lesefehler weg. Ohne das ueberlebt er jeden weiteren
           Versuch: die Komponente zeigte den Fehler dann auch, nachdem laengst frische Daten
           unterwegs waren. Gemessen am 24.08. -- der Fehler stand nach einem reset() noch da. */
        if (isYes(on)) state.leseFehler = false;
        render();
      },
      /* Theme-only entry point, deliberately separate from update({isDark}) — that path always
         calls render() unconditionally at the end regardless of whether isDark actually changed,
         which for this component means a full table innerHTML rebuild (every row, every <img>,
         every listener re-attached) plus a Chart.js redraw, just because a Run-JS step re-fired
         the SAME theme value (Bubble's own reactive re-evaluation does this routinely, not only on
         a genuine toggle). True no-op when the incoming value matches the current theme. */
      setTheme: function(on){
        var want = isYes(on);
        if (want === isDark) return;
        isDark = want;
        if (isDark){ root.setAttribute("data-theme","dark"); }
        else { root.removeAttribute("data-theme"); }
        render();
      }
    };
  }

  /* ================= root resolution + owner-guard =================
     .vot-root is already a component-specific class name (not the shared .up-root), so no
     additional marker class is needed for the init-selector collision fix applied to
     urls-table.js/domains-table.js. */
  var CACHE = (window.__votCache = window.__votCache || {});
  function cacheData(id, params){
    if (!id) return;
    CACHE[id] = CACHE[id] || {};
    CACHE[id].params = CACHE[id].params || {};
    for (var k in params){ if (params.hasOwnProperty(k) && params[k] !== undefined) CACHE[id].params[k] = params[k]; }
  }
  function cacheInvalidateSeries(id){
    if (!id || !CACHE[id] || !CACHE[id].params) return;
    if (CACHE[id].params.series === undefined) return;
    delete CACHE[id].params.series;
  }
  function cacheLoading(id, v){
    if (!id) return;
    CACHE[id] = CACHE[id] || {};
    var nowLoading = isYes(v);
    if (nowLoading) cacheInvalidateSeries(id);
    CACHE[id].loading = nowLoading;
  }
  function applyCache(root, ctrl){
    var id = root.getAttribute("data-instance");
    if (!id || !CACHE[id]) return;
    try {
      if (CACHE[id].params != null){
        ctrl.update(CACHE[id].params);
      }
    } catch(e){}
    try { if (CACHE[id].loading != null) ctrl.setLoading(CACHE[id].loading); } catch(e){}
  }
  function initRoot(root){
    if (root.__votController) return root.__votController;
    if (root.__votBuilding) return null;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;
    root.__votBuilding = true;
    var ctrl = makeController(root);
    root.__votBuilding = false;
    if (!ctrl) return null;
    if (root.__votController) return root.__votController;
    /* Markenliste seitenweit aus core (setUpstreemBrands) statt nur aus dem eigenen Payload:
       EIN Aufruf pro Seite, und eine neu angelegte oder deaktivierte Marke erreicht jeden Picker.
       Der Payload-Weg (params.filterCompanies) bleibt als Rueckfall -- ein LEERER Store
       ueberschreibt nichts. */
    if (UC.brandsInto) UC.brandsInto(root, function(list){ ctrl.update({ filterCompanies: list }); });
    root.__votController = ctrl; root.__votId = id;
    if (root.__votPendingParams != null){ try { ctrl.update(root.__votPendingParams); } catch(e){} root.__votPendingParams = null; }
    if (root.__votPendingLoading != null){ try { ctrl.setLoading(root.__votPendingLoading); } catch(e){} root.__votPendingLoading = null; }
    applyCache(root, ctrl);
    return ctrl;
  }
  function resolve(id){ var r = rootsWithId(id); return r.length ? initRoot(r[0]) : null; }
  function stashRetryRoot(target, kind, a){
    if (kind === "update") target.__votPendingParams = a;
    if (kind === "loading") target.__votPendingLoading = isYes(a);
    if (kind === "theme") target.__votPendingTheme = isYes(a);
    var tries = 0;
    (function retry(){
      var ctrl = initRoot(target);
      if (ctrl){
        if (target.__votPendingParams != null){ ctrl.update(target.__votPendingParams); target.__votPendingParams = null; }
        if (target.__votPendingLoading != null){ ctrl.setLoading(target.__votPendingLoading); target.__votPendingLoading = null; }
        if (target.__votPendingTheme != null){ ctrl.setTheme(target.__votPendingTheme); target.__votPendingTheme = null; }
        return;
      }
      if (tries++ < 40) setTimeout(retry, 100);
    })();
  }
  function doRender(params){
    params = params || {};
    var id = params.instanceId || "default";
    cacheData(id, params);
    var roots = rootsWithId(id);
    if (!roots.length) return false;
    var any = false;
    roots.forEach(function(root){
      var ctrl = initRoot(root);
      if (ctrl){ ctrl.update(params); any = true; }
      else stashRetryRoot(root, "update", params);
    });
    return any;
  }
  function doLoading(id, loading){
    id = id || "default";
    cacheLoading(id, loading);
    var roots = rootsWithId(id);
    if (!roots.length) return false;
    roots.forEach(function(root){
      var ctrl = initRoot(root);
      if (ctrl) ctrl.setLoading(loading);
      else stashRetryRoot(root, "loading", loading);
    });
    return true;
  }
  /* Theme-only entry point for a Run-JS step that fires on every page-state recalculation whether
     or not the theme actually changed — see ctrl.setTheme's own comment for why that matters here
     specifically (a full table + chart rebuild, not a cheap style flip). Deliberately does NOT go
     through cacheData/doRender — this never touches series/table/companies, only isDark. */
  function doSetTheme(id, on){
    id = id || "default";
    var roots = rootsWithId(id);
    if (!roots.length) return false;
    roots.forEach(function(root){
      var ctrl = initRoot(root);
      if (ctrl) ctrl.setTheme(on);
      else stashRetryRoot(root, "theme", on);
    });
    return true;
  }

  window.votThemeDebug = function(id){
    var roots = rootsWithId(String(id || "").trim());
    if (!roots.length){ console.log("[VOT] keine Instanz mit id", id, "gefunden"); return; }
    roots.forEach(function(root){
      var ctrl = root.__votController;
      var canvas = root.querySelector(".up-line-canvas");
      var chart = null;
      try { chart = (window.Chart && window.Chart.getChart && canvas) ? window.Chart.getChart(canvas) : null; } catch(e){}
      console.log("[VOT] Instanz", root.getAttribute("data-instance"), {
        "data-isdark Attribut": root.getAttribute("data-isdark"),
        "data-theme Attribut (davon abgeleitet)": root.getAttribute("data-theme"),
        "Controller-Id": ctrl ? ctrl.__ctrlId : null,
        "Chart-Instanz vorhanden": !!chart,
        "Chart Tick-Farbe (was tatsaechlich gerendert ist)": chart ? chart.options.scales.x.ticks.color : null
      });
    });
  };

  /* mount: root registry, iframe forwarder, wheel forwarding, init cascade, and the replay of
     whatever Bubble queued against the stubs — all from core. doRender/doLoading stay local
     because this component broadcasts to every root sharing an instanceId. */
  var mount = UC.makeMount({
    /* onMount: makeMount replays Bubble's queued render* calls while it is still
       constructing, i.e. before `mount` below has been assigned. Without this the very
       first render Bubble queued threw on `mount` being undefined and was swallowed. */
    onMount: function(m){ mount = m; },
    rootClass: "vot-root", notPortal: true,
    /* Kein wheelSel mehr — der ganze Wheel-Forwarding-Mechanismus ist aus core raus (siehe den
       Kommentar an seiner alten Stelle in makeMount). Die Ursache lag in fremdem Seiten-CSS
       (`overscroll-behavior: contain` per `*`) und ist in core.css an der Wurzel behoben; damit
       scrollt hier alles wieder nativ, inkl. Trägheit und Bounce. */
    ctrlProp: "__votController",
    resolveLocal: "__votResolveLocal",
    queue: "__votBootQueue",
    initRoot: initRoot,
    api: {
      renderVisibilityChart: doRender,
      setVisibilityChartLoading: function(id, l){ return doLoading(id, l); },
      setVisibilityChartTheme: function(id, on){ return doSetTheme(id, on); },
      resetVisibilityChart: function(instanceId){
        var id = String(instanceId || "").trim();
        if (!id) return false;
        var rs = rootsWithId(id), did = false;
        for (var i = 0; i < rs.length; i++){
          var c = rs[i].__votController;
          if (c && typeof c.reset === "function"){ try { c.reset(); did = true; } catch(e){} }
        }
        return did;
      }
    },
    forwardShape: { renderVisibilityChart: "params", resetVisibilityChart: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end votRun

  votBoot(50); // retry for ~5s before giving up on core.js
})();
