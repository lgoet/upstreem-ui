/* upstreem topcitations-dashboard.js — component logic. Requires core.js (window.UpstreemCore) loaded first. */
(function(){
  "use strict";

  /* window.renderTopCitations / setTopCitationsLoading / resetTopCitations only become the real
     implementations once tcdRun() finishes below (after the core.js wait). Bubble's own "Run
     Javascript" steps typically poll for these by name and call whichever one they find first —
     if core.js is slow to arrive, whichever poll happens to land first wins, independent of which
     Bubble workflow step actually ran first. That's exactly what made visibility-chart's loading
     state unreliable, fixed by defining thin stub functions immediately, before any waiting
     happens: Bubble's poll always finds a callable function on its very first try, so calls land
     in a queue in the exact order Bubble invoked them and replay in that order once the real
     implementations are ready. Applied here proactively — this component has the exact same
     boot-order dependency. */
  /* Stubs must exist before core.js is guaranteed to be loaded — Bubble polls for these by
     name and would otherwise miss the earliest calls. Everything after the wait uses UC.makeMount. */
  var __tcdBootQueue = window.__tcdBootQueue = window.__tcdBootQueue || [];
  if (!window.__tcdBootStubbed){
    window.__tcdBootStubbed = true;
    ["renderTopCitations", "setTopCitationsLoading", "resetTopCitations"].forEach(function(n){
      window[n] = function(){ __tcdBootQueue.push([n, arguments]); };
    });
  }

  /* Bubble injects this component's <script> tags via jQuery .html(), which does not guarantee
     external scripts execute in DOM order — topcitations-dashboard.js can start running before
     core.js has finished loading. Retry briefly instead of bailing forever, same pattern as the
     other three components. */
  function tcdBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ tcdBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    tcdRun();
  }

  function tcdRun(){
  var UC = window.UpstreemCore;
  var esc = UC.esc, isYes = UC.isYes, resolveBubbleFn = UC.resolveBubbleFn, tint = UC.tint,
      citeName = UC.citeName, fmtTotal = UC.fmtTotal, CHECK_SVG = UC.CHECK_SVG,
      CITE_COLOR = UC.CITE_COLOR, CITE_ALIAS = UC.CITE_ALIAS, ALL_CITATION_TYPES = UC.ALL_CITATION_TYPES,
      ALL_URL_TYPES = UC.ALL_URL_TYPES, CHIP_BG_DARK = UC.CHIP_BG_DARK;

  /* Chip colours are a SEPARATE system from the chart-slice colours: chips are small text-on-tint
     labels, slices are large fills. Core owns the slice palette (UC.typeColor); the chip palette
     stays here. UC.URL_TYPE covers every key except the "other" bucket this component needs. */
  var URL_TYPE_CHIP = {};
  Object.keys(UC.URL_TYPE).forEach(function(k){ URL_TYPE_CHIP[k] = UC.URL_TYPE[k]; });
  URL_TYPE_CHIP.other = { label:"Uncategorized", c:"#6f737c", cDark:"#a0a0a0" };

  function tagInfo(raw, mode, isDark){
    if (mode === "url"){
      var ut = URL_TYPE_CHIP[raw] || URL_TYPE_CHIP.other;
      var c = isDark ? ut.cDark : ut.c;
      return { label: ut.label, color: c, bg: isDark ? CHIP_BG_DARK : tint(ut.c, 0.12), dot: true };
    }
    var name = citeName(raw);
    var cc = UC.typeColor(raw, "citation", isDark);
    return { label: name, color: cc, bg: isDark ? CHIP_BG_DARK : tint(UC.typeColor(raw, "citation", false), 0.12), dot: false };
  }
  var fmtPct = UC.fmtPct;

  function tableSkeletonHtml(mode){
    /* One bar per real column — idx, name, type, share, USED. The migration to UC.skeletonRows
       dropped the 5th entry (Used), which just rendered as an empty cell rather than an obviously
       missing bar, so it went unnoticed. idx also needs its own cls (tct-td-idx) — without it the
       bar falls back to the generic cell's left-aligned padding instead of the real idx column's
       centered one. */
    return tableHeadHtml(mode) + '<div class="tct-tbody">' + UC.skeletonRows({
      count: 7, rowClass: "tct-row", cellClass: "tct-td",
      cols: [{ w:12, cls:"tct-td-idx" }, { w:60, jitter:18, logo:true }, 46, 40, 36]
    }) + '</div>';
  }
  function tableHeadHtml(mode){
    return '<div class="tct-thead">' +
      '<div class="tct-th tct-th-idx">' + UC.HASH_ICON + '</div>' +
      '<div class="tct-th">' + (mode === "url" ? "URL" : "Domain") + '</div>' +
      '<div class="tct-th tct-th-type">Type</div>' +
      '<div class="tct-th">Share</div>' +
      '<div class="tct-th tct-th-used">Used</div></div>';
  }

  /* ================= controller (one per root element) ================= */
  function makeController(root){
    var body = root.querySelector(".up-donut-body");
    var tableEl = root.querySelector(".tct-table");
    if (!body || !tableEl) return null;

    var instanceId = root.getAttribute("data-instance") || "default";
    var myCtrlId = "tcd_" + Math.random().toString(36).slice(2) + "_" + Date.now();
    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");

    function readProcessing(){
      var a = root.getAttribute("data-processing");
      var b = root.getAttribute("data-processing2");
      var pa = (a === "IS_PROCESSING" || a == null) ? false : isYes(a);
      var pb = (b === "IS_PROCESSING_2" || b == null) ? false : isYes(b);
      return pa || pb;
    }
    /* Once setTopCitationsLoading() has been called for this instance, THAT is the only thing that
       may change the loading state — the data-processing attributes are ignored from then on.
       Window-level so it survives the element rebuilds Bubble does. */
    var LOADING_EXPLICIT = (window.__tcdLoadingExplicit = window.__tcdLoadingExplicit || {});

    // persists across a DOM element being torn down and recreated — keyed by instanceId, lives on
    // window so it survives that.
    var INSTANCE_STORE = (window.__tcdInstanceStore = window.__tcdInstanceStore || {});
    var saved = INSTANCE_STORE[instanceId] || {};
    var BRAND_CLEAR_STORE = (window.__tcdBrandClearUntil = window.__tcdBrandClearUntil || {});

    /* Which type dimension the filter dropdown opens on. In URL mode that is URL Types: the list
       IS urls, so citation types are the second question, not the first — and every other place
       in the app that shows urls (urls-table, the domains-table drilldown) filters them by URL
       type. Domain mode has only one dimension, so the segmented switch does not even render
       there. An explicit pick by the user is persisted and wins over this on re-render; switching
       modes deliberately does not — the new mode gets its own default. */
    function defaultDim(mode){ return mode === "url" ? "url_type" : "citation_type"; }

    var state = {
      loading: LOADING_EXPLICIT[instanceId] ? !!saved.loading : readProcessing(),
      optimisticLoading: false,
      hasChart: false, hasTable: false,
      mode: saved.mode || "domain", userPickedMode: saved.userPickedMode || false,
      chartMode: "doughnut", prepped: [], chartTotal: 0,
      topDomains: [], topUrls: [],
      totalCountDomain: (saved.totalCountDomain != null) ? saved.totalCountDomain : null,
      totalCountUrl: (saved.totalCountUrl != null) ? saved.totalCountUrl : null,
      typesBreakdown: [], urlTypesBreakdown: [], baselineDomain: [], baselineUrl: [], brand: saved.brand || null,
      filterTypeSel: saved.filterTypeSel || {}, filterUrlTypeSel: saved.filterUrlTypeSel || {},
      appliedTypeSel: saved.appliedTypeSel || {}, appliedUrlTypeSel: saved.appliedUrlTypeSel || {},
      filterDimension: saved.filterDimension || defaultDim(saved.mode || "domain"), brandMentioned: saved.brandMentioned || ""
    };
    function persistState(){
      INSTANCE_STORE[instanceId] = {
        mode: state.mode, userPickedMode: state.userPickedMode,
        totalCountDomain: state.totalCountDomain, totalCountUrl: state.totalCountUrl,
        brand: state.brand,
        filterTypeSel: state.filterTypeSel, filterUrlTypeSel: state.filterUrlTypeSel,
        appliedTypeSel: state.appliedTypeSel, appliedUrlTypeSel: state.appliedUrlTypeSel,
        filterDimension: state.filterDimension, brandMentioned: state.brandMentioned,
        loading: state.loading
      };
    }
    var topTotal = root.querySelector(".tcl-top-total");
    var topTotalN = topTotal ? topTotal.querySelector(".n") : null;

    /* which breakdown feeds the chart: the live one, or the remembered baseline while a type
       filter is active (so greying out a slice doesn't also shrink the others) */
    function rawBreakdown(){
      if (state.mode === "url" && state.typesBreakdown.length === 0 && state.urlTypesBreakdown.length) return state.urlTypesBreakdown;
      return state.typesBreakdown;
    }
    function currentSel(){
      return state.mode === "url" ? state.filterUrlTypeSel : state.filterTypeSel;
    }
    function hasActiveSel(){
      var sel = currentSel();
      return Object.keys(sel).some(function(k){ return sel[k]; });
    }
    function activeBreakdown(){
      var raw = rawBreakdown();
      var key = state.mode === "url" ? "baselineUrl" : "baselineDomain";
      if (!hasActiveSel()){
        if (raw && raw.length) state[key] = raw;
        return raw;
      }
      return (state[key] && state[key].length) ? state[key] : raw;
    }
    function syncChartSwitch(){
      Array.prototype.slice.call(root.querySelectorAll(".tcl-seg-btn")).forEach(function(o){
        var on = o.getAttribute("data-chart") === state.chartMode;
        o.classList.toggle("is-active", on);
        o.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    function syncModeActive(){
      Array.prototype.slice.call(root.querySelectorAll(".tcd-mode-btn")).forEach(function(b){
        b.classList.toggle("is-active", b.getAttribute("data-mode") === state.mode);
      });
    }

    /* ---------- the type chart, from the shared kit ----------
       Plugins, doughnut tooltip, skeleton, bar fit/label logic all live in core now. */
    function isOwner(){ return !root.__tcdController || root.__tcdController.__ctrlId === myCtrlId; }
    function darkNow(){ return isDark; }
    var typeChart = UC.makeTypeChart({
      body: body, isDark: darkNow, isOwner: isOwner,
      mode: function(){ return state.mode; },
      chartMode: function(){ return state.chartMode; },
      total: function(){ return state.chartTotal; },
      centerLabel: "Citations",
      collapseHost: root,
      /* this component's chart box has the toolbar above it inside the same root, so the bar list
         has to subtract that before deciding how many bars fit */
      availHeight: function(){
        var rootH = root.clientHeight; if (!rootH) return 0;
        var head = root.querySelector(".tcd-head");
        return rootH - (head ? head.offsetHeight + 16 : 0) - 32;
      },
      /* Clicking a segment/legend row/bar is the exact same action as clicking its checkbox in
         the filter menu below, PLUS an immediate Apply — a chart click is one decisive action
         with nothing to stage further, unlike ticking several boxes in the menu before deciding.
         Reuses fireApplyFilter() itself (not a copy of what it does) so this can never drift from
         what a real Apply click sends. */
      onSliceClick: function(key){
        var sel = state.mode === "url" ? state.filterUrlTypeSel : state.filterTypeSel;
        sel[key] = !sel[key];
        persistState();
        populateFilter();
        /* Unlike a filter-menu checkbox (which only stages a change syncChartDim can safely
           preview live, see below), this always fires an immediate Apply — a reload is coming no
           matter what. Previewing the toggle's dim state first is actively wrong here: deselecting
           the last-checked slice empties the selection, which by design means "no filter" and
           un-dims everything — a bright full-color flash right before the loader replaces it.
           Go straight to the loading state instead, same as a manual mode switch does. */
        state.optimisticLoading = true;
        renderChartSide();
        fireApplyFilter();
      }
    });
    function applyCollapse(){ typeChart.applyCollapse(); }

    function applySelectionDim(prepped){
      var sel = state.mode === "url" ? state.filterUrlTypeSel : state.filterTypeSel;
      return UC.applyTypeDim(prepped, sel, isDark);
    }
    function chartIsEmpty(){ return !state.prepped.length || state.prepped.every(function(x){ return !(Number(x.share) > 0); }); }
    /* Same interim-"clearing" flash risk as the table side — the shared grace helper shows the
       skeleton first and only commits to "No data" if it is still empty shortly after. Shorter
       than the 3s default (and shorter than visibility-chart's own window): once loading is
       genuinely done, sitting on a skeleton for multiple seconds read as "stuck", not "settling". */
    var chartGrace = UC.makeEmptyGrace({
      showSkeleton: function(){ typeChart.skeleton(); },
      stillEmpty: function(){
        return isOwner() && !state.loading && !state.optimisticLoading && state.hasChart && chartIsEmpty();
      },
      commitEmpty: function(){ drawChart(); syncChartSwitch(); },
      ms: 600
    });
    function drawChart(){
      if (state.chartMode === "bar"){ if (topTotal) topTotal.style.display = "flex"; if (topTotalN) topTotalN.textContent = fmtTotal(state.chartTotal); typeChart.renderBars(state.prepped); }
      else { if (topTotal) topTotal.style.display = "none"; typeChart.renderDonut(state.prepped); }
    }
    function renderChartSide(){
      if (!isOwner()) return;
      if (state.loading || state.optimisticLoading || !state.hasChart){
        chartGrace.clear();
        if (topTotal) topTotal.style.display = "none";
        typeChart.skeleton();
        syncChartSwitch();
        return;
      }
      state.prepped = applySelectionDim(UC.prepTypeData(state.mode, activeBreakdown(), isDark));
      if (chartIsEmpty()){ chartGrace.hold(); syncChartSwitch(); return; }
      chartGrace.clear();
      drawChart();
      syncChartSwitch();
    }
    /* A dim-only change (checkbox toggle, chart-segment click, Reset) never touches WHICH items
       exist or their shares — only which are greyed out. Going through the full renderChartSide()
       path for that replayed typeChart's entrance animation on every single click (donut: fresh
       fade-in; bars: width resets to 0% and regrows) — visible as the whole chart flashing before
       settling into the new selection. typeChart.updateColors() patches the existing paint in
       place instead. Only falls back to the full path for states updateColors can't handle on its
       own: still loading, or a transition into/out of the empty state (skeleton/grace needed). */
    function syncChartDim(){
      if (!isOwner() || state.loading || state.optimisticLoading || !state.hasChart){ renderChartSide(); return; }
      state.prepped = applySelectionDim(UC.prepTypeData(state.mode, activeBreakdown(), isDark));
      if (chartIsEmpty()){ renderChartSide(); return; }
      chartGrace.clear();
      typeChart.updateColors(state.prepped);
    }

    /* ================= RIGHT: Top Domains / Top URLs table ================= */
    var ROW_GOTO = '<span class="up-row-goto">' + UC.GOTO_SVG + '</span>';
    function trendChip(delta, suffix){
      return UC.trendChip(delta, { decimals: true, suffix: suffix });
    }
    function activeRows(){ return state.mode === "url" ? state.topUrls : state.topDomains; }
    function checkTrendFit(){
      if (checkTrendFit.__busy) return;
      checkTrendFit.__busy = true;
      var hadHide = tableEl.classList.contains("tct-hide-trend");
      if (hadHide) tableEl.classList.remove("tct-hide-trend");
      var cells = tableEl.querySelectorAll(".tct-td-share");
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
      tableEl.classList.toggle("tct-hide-trend", tooTight);
      checkTrendFit.__busy = false;
    }
    function checkBrandWidth(){
      var w = tableEl ? tableEl.clientWidth : 0;
      root.classList.toggle("is-narrow-cell", w > 0 && w < 380);
      if (!w) return;
      var stacked = root.classList.contains("is-narrow");
      var rootW = root.clientWidth || 0;
      tableEl.classList.toggle("tct-hide-used", stacked && rootW > 0 && rootW < 700);
      tableEl.classList.toggle("tct-hide-type", stacked && rootW > 0 && rootW < 500);
      checkTrendFit();
    }
    var tableEmptyGraceTimer = null;
    function renderTable(){
      var rows = activeRows();
      var head = tableHeadHtml(state.mode);
      if (!rows.length){
        /* An empty top_domains/top_urls delivery can be an interim "clearing" step before the
           real data lands a moment later — showing "No data" immediately for that interim state
           flashes an empty placeholder that's gone a beat later. Give a short grace window for a
           follow-up render before committing to the empty view. */
        if (!tableEmptyGraceTimer){
          tableEl.innerHTML = tableSkeletonHtml();
          tableEmptyGraceTimer = setTimeout(function(){
            tableEmptyGraceTimer = null;
            if (state.loading || state.optimisticLoading || !state.hasTable || activeRows().length) return;
            tableEl.innerHTML = head + '<div class="up-empty-mini">No data</div>';
          }, 600);   // shortened from the 3s visibility-chart default — felt "stuck" once loading was genuinely done
        }
        return;
      }
      if (tableEmptyGraceTimer){ clearTimeout(tableEmptyGraceTimer); tableEmptyGraceTimer = null; }
      var body2 = rows.map(function(r, i){
        var pos = i + 1;
        var isUrl = state.mode === "url";
        var displayName = isUrl ? (r.title || r.url || "") : (r.domain || "");
        var idKey = isUrl ? (r.url || r.title) : r.domain;
        var hoverTitle = isUrl && r.title && r.url && r.title !== r.url ? r.url : "";
        var favicon = r.favicon || r.logo || "";
        var logo = favicon
          ? '<span class="up-logo-box has-img"><img src="' + esc(favicon) + '" onerror="this.style.visibility=\'hidden\'"/></span>'
          : '<span class="up-logo-box"></span>';
        var typeRawKey = isUrl ? r.url_type : r.citation_type;
        var tagMode = isUrl ? "url" : "domain";
        var typeTag = "";
        if (typeRawKey != null){
          var ti = tagInfo(typeRawKey, tagMode, isDark);
          var dotHtml = ti.dot ? '<span class="tct-tag-dot" style="background:' + ti.color + '"></span>' : "";
          typeTag = '<span class="tct-tag" style="background:' + ti.bg + ';color:' + ti.color + '">' + dotHtml + '<span class="tct-tag-lbl">' + esc(ti.label) + '</span></span>';
        }
        var shareRaw = isUrl ? r.global_share_pct : r.share_pct;
        var shareNull = (shareRaw == null || shareRaw === "");
        var share = '<span class="tct-num' + (shareNull ? " is-empty" : "") + '">' + (shareNull ? "–" : fmtPct(shareRaw)) + '</span>' + trendChip(r.share_delta_pct, "%");
        var used = (r.used_total != null) ? '<span class="tct-used">' + esc(fmtTotal(r.used_total)) + '</span>' : "";
        return '<div class="tct-row" data-id="' + esc(String(idKey == null ? "" : idKey)) + '">' +
          '<div class="tct-td tct-td-idx">' + pos + '</div>' +
          '<div class="tct-td tct-td-name">' + logo + '<span class="tct-name"' + (hoverTitle ? ' title="' + esc(hoverTitle) + '"' : '') + '>' + esc(displayName) + '</span>' + ROW_GOTO + '</div>' +
          '<div class="tct-td tct-td-type">' + typeTag + '</div>' +
          '<div class="tct-td tct-td-share">' + share + '</div>' +
          '<div class="tct-td tct-td-used">' + used + '</div></div>';
      }).join("");
      tableEl.innerHTML = head + '<div class="tct-tbody">' + body2 + '</div>';
      Array.prototype.slice.call(tableEl.querySelectorAll(".tct-row")).forEach(function(row){
        var id = row.getAttribute("data-id");
        row.addEventListener("click", function(){
          var fnName = root.getAttribute("data-rowclick-fn") || "bubble_fn_tcdRowClick";
          var fn = resolveBubbleFn(fnName);
          if (typeof fn === "function"){ try { fn(id, instanceId); } catch(e){} }
        });
      });
      checkBrandWidth();
    }
    function renderTableSide(){
      if (root.__tcdController && root.__tcdController.__ctrlId !== myCtrlId) return;
      if (state.loading || state.optimisticLoading || !state.hasTable){
        if (tableEmptyGraceTimer){ clearTimeout(tableEmptyGraceTimer); tableEmptyGraceTimer = null; }
        tableEl.innerHTML = tableSkeletonHtml();
      }
      else { renderTable(); }
    }

    function setHeading(){
      var lbl = root.querySelector(".tcd-head-label");
      if (lbl) lbl.textContent = state.mode === "url" ? "Top URLs" : "Top Domains";
    }
    function setHeadCount(){
      var hr = root.querySelector(".tcd-heading-right");
      var cn = root.querySelector(".tcd-head-count");
      if (!hr || !cn) return;
      hr.classList.add("has-count");
      /* Skeleton for the WHOLE duration of loading, not just before the first load — otherwise a
         stale count from before a filter/mode change sits there unchanged while fresh data is
         still in flight, which reads as "nothing happened" rather than "loading". */
      if (state.loading || state.optimisticLoading){ cn.textContent = ""; cn.classList.add("is-sk"); return; }
      var count = state.mode === "url" ? state.totalCountUrl : state.totalCountDomain;
      if (count != null && count !== ""){ cn.textContent = fmtTotal(count); cn.classList.remove("is-sk"); }
      else { cn.textContent = ""; cn.classList.add("is-sk"); }
    }

    /* ================= filter (fader): Citation Types / URL Types + "Brand mentioned?" =================
       Plain position:absolute child of its position:relative wrapper (STYLEGUIDE §14) driven by
       UC.makePopover — open/close, focus escape, Escape and the single page-wide outside-click
       listener come from core. Reuses core.css's shared .up-filter-* shell, same as urls-table's
       equivalent filter. Deliberately does NOT revert the live selection when closed without
       Apply: there is no draft-vs-applied concept here beyond the badge/chart-grey, which already
       re-renders live on every checkbox click via syncChartDim(). */
    var filterWrap = root.querySelector(".tcd-filter");
    var filterBtn = root.querySelector(".tcd-filter-btn");
    var filterMenu = root.querySelector(".up-filter-menu");
    var filterPop = UC.makePopover({ wrap: filterWrap, menu: filterMenu, opener: filterBtn, group: "tcd-" + instanceId });
    function setFilterOpen(open){ if (open) filterPop.open(); else filterPop.close(false); }
    function closePops(){ setFilterOpen(false); }

    /* Small "Reset" control, LEFT (type chart) unit's own toolbar, placed before the doughnut/bar
       switch — shown only while a type filter (citation or url) is actually applied. Injected here
       rather than added to the static bubble markup so existing embeds pick it up on the next
       CDN-pin bump without needing their HTML re-pasted; see syncFilterBadge() for the visibility
       toggle, and resetTypeFilters() above for what a click does — identical to the filter menu's
       own Reset. */
    var chartHeadTools = root.querySelector(".tcd-unit-left .tcd-head-tools");
    var chartResetBtn = chartHeadTools ? chartHeadTools.querySelector(".tcd-chart-reset") : null;
    if (chartHeadTools && !chartResetBtn){
      chartResetBtn = document.createElement("button");
      chartResetBtn.type = "button";
      chartResetBtn.className = "tcd-chart-reset";
      chartResetBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>' +
        '<span>Reset</span>';
      chartHeadTools.insertBefore(chartResetBtn, chartHeadTools.firstChild);
      chartResetBtn.addEventListener("click", function(ev){ ev.stopPropagation(); resetTypeFilters(); });
    }

    function fireApplyFilter(){
      var citationIds = Object.keys(state.filterTypeSel).filter(function(k){ return state.filterTypeSel[k]; });
      var urlIds = Object.keys(state.filterUrlTypeSel).filter(function(k){ return state.filterUrlTypeSel[k]; });
      // one plain-text value — e.g. "Editorial,UGC_Community,Brand_Platform;guide"
      // IMPORTANT on the Bubble side: mark this Value as plain TEXT, NOT "list of texts" — a
      // "list" field auto-splits on comma internally, which breaks this delimiter scheme.
      var combined = citationIds.join(",") + ";" + urlIds.join(",");
      state.appliedTypeSel = {}; citationIds.forEach(function(k){ state.appliedTypeSel[k] = true; });
      state.appliedUrlTypeSel = {}; urlIds.forEach(function(k){ state.appliedUrlTypeSel[k] = true; });
      persistState();
      syncFilterBadge();
      var fnName = root.getAttribute("data-types-fn") || "bubble_fn_tcdApplyTypeFilter";
      var fn = resolveBubbleFn(fnName);
      if (typeof fn === "function"){ try { fn(combined, instanceId); } catch(e){} }
    }
    /* Shared by the filter menu's own Reset button and the header reset button next to the chart
       (see chartResetBtn below) — one place so the two entry points can never drift apart. */
    function resetTypeFilters(){
      state.filterTypeSel = {};
      state.filterUrlTypeSel = {};
      persistState();
      populateFilter();
      /* Same immediate-apply flash as onSliceClick above — clearing the selection always un-dims
         everything, so go straight to the loader instead of showing that undimmed state first. */
      state.optimisticLoading = true;
      renderChartSide();
      fireApplyFilter();   // also clears the applied snapshot + hides the badge
    }
    function fireDimension(){
      var fnName = root.getAttribute("data-dimension-fn") || "bubble_fn_tcdFilterDimension";
      var fn = resolveBubbleFn(fnName);
      if (typeof fn === "function"){ try { fn(state.filterDimension, instanceId); } catch(e){} }
    }
    function fireBrand(){
      var fnName = root.getAttribute("data-brand-fn") || "bubble_fn_tcdBrandMentioned";
      var fn = resolveBubbleFn(fnName);
      if (typeof fn === "function"){ try { fn(state.brandMentioned || "", instanceId); } catch(e){} }
    }

    var brandToggle = root.querySelector(".tcd-brand-toggle");
    /* Overwrites whatever data-tip a hand-pasted root copy already carries -- static Bubble
       markup, not something this file builds, so a wording fix only reaches existing embeds if
       the CDN'd JS rewrites the attribute at init. */
    if (brandToggle) brandToggle.setAttribute("data-tip", "Filter for your brand mentions");
    function syncFilterBadge(){
      var n = 0;
      Object.keys(state.appliedTypeSel).forEach(function(k){ if (state.appliedTypeSel[k]) n++; });
      Object.keys(state.appliedUrlTypeSel).forEach(function(k){ if (state.appliedUrlTypeSel[k]) n++; });
      var badge = root.querySelector(".tcd-filter-badge");
      if (badge){ badge.textContent = n ? String(n) : ""; badge.classList.toggle("is-visible", n > 0); }
      if (chartResetBtn) chartResetBtn.classList.toggle("is-visible", n > 0);
    }
    function syncBrandToggle(startClearMessage){
      if (!brandToggle) return;
      var hasBrand = !!(state.brand && state.brand.name);
      /* Gated on the DATA, not just the brand attribute: Bubble can set the brand long before the
         first table payload lands. Two separate conditions, both needed:
           hasTable — nothing has ever arrived, so there is nothing to filter yet.
           rows on screen while busy — a reload that still has its old rows keeps the toggle put
             (re-hiding it on every loading toggle made it flicker out on each reload), but a
             reload showing nothing but skeleton must not offer a filter over an empty table. */
      var busy = state.loading || state.optimisticLoading;
      var showsRows = state.hasTable && !!activeRows().length;
      /* PAGE-LOAD RULE (asked for repeatedly, and this is the line that broke it): with no data
         before the load, the toggle stays hidden until loading has actually finished -- not the
         moment the first rows appear. The old condition showed it as soon as rows existed, even
         mid-load, so it flashed in, went again on the next loading tick, and came back at the
         end. Once it has settled ONCE, a later reload keeps it put: a refresh must not make it
         disappear and reappear either. */
      if (!busy && state.hasTable) state.brandSettled = true;
      brandToggle.classList.toggle("is-visible", hasBrand && state.hasTable && !!state.brandSettled);
      if (!hasBrand) return;
      var lbl = brandToggle.querySelector(".tcd-brand-label");
      var logo = brandToggle.querySelector(".tcd-brand-logo");
      if (logo){
        if (state.brand.logo){ logo.src = state.brand.logo; logo.style.display = ""; }
        else { logo.style.display = "none"; }
      }
      brandToggle.classList.toggle("is-yes", state.brandMentioned === "yes");
      brandToggle.classList.toggle("is-no", state.brandMentioned === "no");
      function steadyLabel(){
        if (!lbl) return;
        if (state.brandMentioned === "yes") lbl.textContent = state.brand.name + " is mentioned";
        else if (state.brandMentioned === "no") lbl.textContent = state.brand.name + " is not mentioned";
        else lbl.textContent = state.brand.name + " mentioned?";
      }
      if (startClearMessage) BRAND_CLEAR_STORE[instanceId] = Date.now() + 3000;
      var clearUntil = BRAND_CLEAR_STORE[instanceId];
      var remaining = clearUntil ? clearUntil - Date.now() : 0;
      clearTimeout(brandToggle.__tcdClearTimer);
      if (remaining > 0 && lbl){
        lbl.textContent = state.mode === "url" ? "All URLs" : "All Domains";
        brandToggle.__tcdClearTimer = setTimeout(function(){ delete BRAND_CLEAR_STORE[instanceId]; steadyLabel(); }, remaining);
      } else {
        delete BRAND_CLEAR_STORE[instanceId];
        steadyLabel();
      }
    }

    function populateFilter(){
      if (!filterMenu) return;
      var dimension = state.mode === "url" ? state.filterDimension : "citation_type";
      var listKeys = dimension === "url_type" ? ALL_URL_TYPES : ALL_CITATION_TYPES;
      var list = listKeys.map(function(k){ return { type: k }; });
      var sel = dimension === "url_type" ? state.filterUrlTypeSel : state.filterTypeSel;

      var dimSwitch = "";
      if (state.mode === "url"){
        dimSwitch = '<div class="up-filter-dim" role="tablist">' +
          '<button class="up-filter-dim-btn' + (dimension === "citation_type" ? " is-active" : "") + '" data-dim="citation_type" type="button">Citation Type</button>' +
          '<button class="up-filter-dim-btn' + (dimension === "url_type" ? " is-active" : "") + '" data-dim="url_type" type="button">URL Type</button>' +
        '</div>';
      }
      var head = '<div class="up-filter-head"><span class="up-filter-title">' + (dimension === "url_type" ? "URL Types" : "Citation Types") + '</span>' +
        '<button class="up-filter-reset" type="button">Reset</button></div>';
      var items = !list.length
        ? '<div class="tcd-filter-empty">No types</div>'
        : list.map(function(t){
            var key = String(t.type);
            var checked = !!sel[key];
            var ti = tagInfo(key, dimension === "url_type" ? "url" : "domain", isDark);
            var dotHtml = ti.dot ? '<span class="tct-tag-dot" style="background:' + ti.color + '"></span>' : "";
            return '<div class="up-filter-item ' + (checked ? "is-checked" : "") + '" data-key="' + esc(key) + '">' +
              '<span class="up-filter-check">' + CHECK_SVG + '</span>' +
              '<span class="tct-tag" style="background:' + ti.bg + ';color:' + ti.color + '">' + dotHtml + '<span class="tct-tag-lbl">' + esc(ti.label) + '</span></span>' +
              '</div>';
          }).join("");

      filterMenu.innerHTML = dimSwitch + head + '<div class="up-filter-list">' + items + '</div>' + '<button class="up-filter-submit" type="button">Apply</button>';

      var resetBtn = filterMenu.querySelector(".up-filter-reset");
      if (resetBtn) resetBtn.addEventListener("click", function(ev){
        ev.stopPropagation();
        resetTypeFilters();
        setFilterOpen(false);   // Reset is a decision, not a staging step — closes like Apply
      });

      var dimBtns = Array.prototype.slice.call(filterMenu.querySelectorAll("[data-dim]"));
      dimBtns.forEach(function(btn){
        btn.addEventListener("click", function(ev){
          ev.stopPropagation();
          state.filterDimension = btn.getAttribute("data-dim");
          persistState();
          populateFilter();
          fireDimension();
        });
      });
      Array.prototype.slice.call(filterMenu.querySelectorAll(".up-filter-item")).forEach(function(it){
        it.addEventListener("click", function(ev){
          ev.stopPropagation();
          var key = it.getAttribute("data-key");
          sel[key] = !sel[key];
          persistState();
          it.classList.toggle("is-checked");
          syncChartDim();   // grey out non-selected slices live, even before Apply
        });
      });
      var submitBtn = filterMenu.querySelector(".up-filter-submit");
      if (submitBtn) submitBtn.addEventListener("click", function(ev){
        ev.stopPropagation();
        fireApplyFilter();
        setFilterOpen(false);
      });
    }
    if (filterWrap && !filterWrap.__tcdOutsideBound){
      filterWrap.__tcdOutsideBound = true;
      document.addEventListener("click", function(e){
        if (filterWrap && !filterWrap.contains(e.target) && !(filterMenu && filterMenu.contains(e.target))) setFilterOpen(false);
      });
    }

    var gotoBtn = root.querySelector(".tcd-goto");
    var exportBtn = root.querySelector(".tcd-export");

    /* Button tooltips: the shared core implementation (this component's own .tcd-tip copy was
       where the page-global-state fix originally landed; core now carries it for everyone). */
    UC.makeTooltips(root, darkNow);

    /* ---- responsive ---- */
    var NARROW_STACK = 880;
    var BRAND_MIN_W = 480;
    function applyResponsive(){
      var w = root.clientWidth || 0;
      if (w){ if (w < NARROW_STACK) root.classList.add("is-narrow"); else root.classList.remove("is-narrow"); }
      root.classList.toggle("tcd-hide-brand", w > 0 && w < BRAND_MIN_W);
      applyCollapse();
      checkBrandWidth();
      clearTimeout(root.__tcdRespT);
      root.__tcdRespT = setTimeout(function(){
        typeChart.resize();
      }, 60);
    }

    function render(){
      if (root.__tcdController && root.__tcdController.__ctrlId !== myCtrlId) return;
      renderChartSide();
      renderTableSide();
      setHeading();
      setHeadCount();
      syncBrandToggle();
      syncModeActive();
      syncFilterBadge();
    }

    if (!root.__tcdDelegated){
      root.__tcdDelegated = true;
      root.addEventListener("click", function(e){
        var modeBtn = e.target.closest(".tcd-mode-btn");
        if (modeBtn){
          var m = modeBtn.getAttribute("data-mode");
          if (m === state.mode) return;
          state.mode = m;
          state.userPickedMode = true;
          state.filterDimension = defaultDim(m);
          state.optimisticLoading = true;
          persistState();
          delete BRAND_CLEAR_STORE[instanceId];
          syncModeActive();
          setHeading();
          populateFilter();
          renderChartSide(); renderTableSide();
          syncBrandToggle();
          var mFnName = root.getAttribute("data-mode-fn") || "bubble_fn_tcdMode";
          var mFn = resolveBubbleFn(mFnName);
          if (typeof mFn === "function"){ try { mFn(m, instanceId); } catch(err){} }
          return;
        }
        var chartBtn = e.target.closest(".tcl-seg-btn");
        if (chartBtn){
          state.chartMode = chartBtn.getAttribute("data-chart");
          renderChartSide();
          return;
        }
        var filterBtnEl = e.target.closest(".tcd-filter-btn");
        if (filterBtnEl){
          e.stopPropagation();
          var willOpen = !filterWrap.classList.contains("is-open");
          closePops();
          setFilterOpen(willOpen);
          return;
        }
        var gotoBtnEl = e.target.closest(".tcd-goto");
        if (gotoBtnEl){
          var gFnName = root.getAttribute("data-goto-fn") || "bubble_fn_tcdGoTo";
          var gFn = resolveBubbleFn(gFnName);
          if (typeof gFn === "function"){ try { gFn(instanceId); } catch(err){} }
          return;
        }
        var exportBtnEl = e.target.closest(".tcd-export");
        if (exportBtnEl){
          var eFnName = root.getAttribute("data-export-fn") || "bubble_fn_tcdExportTable";
          var eFn = resolveBubbleFn(eFnName);
          if (typeof eFn === "function"){ try { eFn(instanceId); } catch(err){} }
          return;
        }
        var brandBtnEl = e.target.closest(".tcd-brand-toggle");
        if (brandBtnEl){
          var justClearedToEmpty = false;
          if (state.brandMentioned === "yes") state.brandMentioned = "no";
          else if (state.brandMentioned === "no"){ state.brandMentioned = ""; justClearedToEmpty = true; }
          else state.brandMentioned = "yes";
          persistState();
          delete BRAND_CLEAR_STORE[instanceId];
          syncBrandToggle(justClearedToEmpty);
          fireBrand();
          return;
        }
      });
    }

    applyResponsive();
    render();
    populateFilter();

    if (window.ResizeObserver){
      new ResizeObserver(function(){
        if (root.__tcdRaf) return;
        root.__tcdRaf = requestAnimationFrame(function(){ root.__tcdRaf = null; applyResponsive(); });
      }).observe(tableEl.parentElement || tableEl);
      new ResizeObserver(function(){
        if (root.__tcdRaf2) return;
        root.__tcdRaf2 = requestAnimationFrame(function(){ root.__tcdRaf2 = null; applyResponsive(); });
      }).observe(root);
    }

    /* Reconcile isDark AND the loading attributes from the DOM too, not only from an explicit
       render()/setLoading() call — mirrors the same live-attribute reconciliation already in
       urls-table.js/domains-table.js/visibility-chart.js. Without this, a page that flips
       data-processing purely via the attribute (no accompanying JS call) never got noticed here,
       unlike everywhere else in the library. */
    var themeObserver = new MutationObserver(function(){
      var wantDark = isYes(root.getAttribute("data-isdark"));
      var changed = false;
      if (wantDark !== isDark){
        isDark = wantDark;
        if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        changed = true;
      }
      if (!LOADING_EXPLICIT[instanceId]){
        var wantProc = readProcessing();
        if (wantProc !== state.loading){ state.loading = wantProc; changed = true; }
      }
      if (changed){ render(); populateFilter(); }
    });
    themeObserver.observe(root, { attributes: true, attributeFilter: ["data-isdark", "data-processing", "data-processing2"] });

    return {
      __ctrlId: myCtrlId,
      /*
        Bubble Toolbox → Run JavaScript
        window.resetTopCitations("YOUR_INSTANCE_ID");
        Clears Brand Mentioned, the type filter (both citation-type and url-type selections, live
        AND applied), and resets the filter dimension back to citation_type — i.e. every filter
        this component exposes. Re-renders with whatever data is already loaded (ungreyed, badge
        cleared) but does not itself fire bubble_fn_tcdApplyTypeFilter / bubble_fn_tcdBrandMentioned
        or request new data.
      */
      reset: function(){
        state.brandMentioned = "";
        state.filterTypeSel = {};
        state.filterUrlTypeSel = {};
        state.appliedTypeSel = {};
        state.appliedUrlTypeSel = {};
        state.filterDimension = defaultDim(state.mode);
        /* Also EMPTY the data (chart + table back to skeleton), not just the filters — same reason
           as visibility-chart's reset: a slide-in that re-uses this placement calls
           resetTopCitations() on open, and without this the old doughnut/bars + table re-rendered
           and re-animated during the open (stale data flash + extra paint). Fires NO Bubble event;
           the caller loads fresh data next. persistState() does not store the data arrays, so a
           Bubble re-render already starts empty — no cache to clear here. */
        state.topDomains = []; state.topUrls = [];
        state.typesBreakdown = []; state.urlTypesBreakdown = [];
        state.baselineDomain = []; state.baselineUrl = [];
        /* also clear the counts, otherwise setHeadCount keeps showing the OLD "Top Domains 25"
           through the next loading animation until fresh data lands (null -> head-count skeleton).
           chartTotal is the doughnut-center / bar "N Citations" number. */
        state.totalCountDomain = null; state.totalCountUrl = null; state.chartTotal = 0;
        state.hasChart = false; state.hasTable = false;
        state.optimisticLoading = false;
        persistState();
        render();
        populateFilter();
        syncFilterBadge();
        syncBrandToggle(false);
        applyResponsive();
        return true;
      },
      update: function(params){
        if (!params || typeof params !== "object") return;
        if (params.mode != null && !state.userPickedMode){ state.mode = params.mode === "url" ? "url" : "domain"; syncModeActive(); }
        if (params.chartMode != null){ state.chartMode = params.chartMode === "bar" ? "bar" : "doughnut"; }
        if (params.totalCountDomain != null) state.totalCountDomain = params.totalCountDomain;
        if (params.totalCountUrl != null) state.totalCountUrl = params.totalCountUrl;
        if (params.citations_total != null) state.chartTotal = params.citations_total;
        if (params.brand != null) state.brand = params.brand;
        if (params.top_domains != null){ state.topDomains = Array.isArray(params.top_domains) ? params.top_domains : []; state.hasTable = true; }
        if (params.top_urls != null){ state.topUrls = Array.isArray(params.top_urls) ? params.top_urls : []; state.hasTable = true; }
        if (params.types_breakdown != null){ state.typesBreakdown = Array.isArray(params.types_breakdown) ? params.types_breakdown : []; state.hasChart = true; }
        if (params.url_types_breakdown != null){ state.urlTypesBreakdown = Array.isArray(params.url_types_breakdown) ? params.url_types_breakdown : []; }
        if (params.isDark != null){
          isDark = isYes(params.isDark);
          if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
          }
        persistState();
        if (params.top_domains != null || params.top_urls != null ||
            params.types_breakdown != null || params.url_types_breakdown != null){
          state.optimisticLoading = false;
        }
        if (!LOADING_EXPLICIT[instanceId]) state.loading = readProcessing();
        render();
        populateFilter();
        applyResponsive();
      },
      setLoading: function(on){
        LOADING_EXPLICIT[instanceId] = true;
        state.loading = isYes(on);
        if (!state.loading) state.optimisticLoading = false;
        persistState();
        render();
        populateFilter();
        applyResponsive();
      }
    };
  }

  /* ================= init / multi-instance bootstrap ================= */
  function initRoot(root){
    if (root.__tcdController) return root.__tcdController;
    var ctrl = makeController(root);
    if (!ctrl) return null;
    if (root.__tcdController) return root.__tcdController;
    root.__tcdController = ctrl; root.__tcdId = ctrl.__ctrlId;
    return ctrl;
  }
  function isVisible(el){
    try { return !!el.offsetParent; } catch(e){ return true; }
  }
  function resolve(id){
    var r = rootsWithId(id);
    if (!r.length) return null;
    if (r.length === 1) return r[0];
    // instanceId collision: this reusable is placed more than once on the page right now.
    // Prefer whichever matching root is actually visible — a safety net, not a fix; give each
    // placement a genuinely unique instanceId so this collision can't happen in the first place.
    for (var i = 0; i < r.length; i++){ if (isVisible(r[i])) return r[i]; }
    return r[0];
  }
  function doRender(params){
    var id = params && params.instanceId;
    var root = id ? resolve(id) : document.querySelector(".tcd-root:not(.up-portal)");
    if (!root){ return; }
    var ctrl = root.__tcdController || initRoot(root);
    if (!ctrl){ return; }
    ctrl.update(params);
  }
  function doLoading(id, loading){
    var roots = id ? rootsWithId(id) : Array.prototype.slice.call(document.querySelectorAll(".tcd-root:not(.up-portal)"));
    if (!roots.length) return false;
    var did = false;
    roots.forEach(function(root){
      var ctrl = root.__tcdController || initRoot(root);
      if (ctrl && typeof ctrl.setLoading === "function"){ ctrl.setLoading(loading); did = true; }
    });
    return did;
  }
  /* mount from core: root registry, forwarder, wheel forwarding, init cascade, stub replay.
     doRender/doLoading stay local — this component deliberately resolves the single VISIBLE root
     for an instanceId instead of broadcasting, unlike the others. */
  var mount = UC.makeMount({
    /* onMount: makeMount replays Bubble's queued render* calls while it is still
       constructing, i.e. before `mount` below has been assigned. Without this the very
       first render Bubble queued threw on `mount` being undefined and was swallowed. */
    onMount: function(m){ mount = m; },
    rootClass: "tcd-root", notPortal: true,
    /* Kein wheelSel mehr — der ganze Wheel-Forwarding-Mechanismus ist aus core raus (siehe den
       Kommentar an seiner alten Stelle in makeMount). Die Ursache lag in fremdem Seiten-CSS
       (`overscroll-behavior: contain` per `*`) und ist in core.css an der Wurzel behoben; damit
       scrollt hier alles wieder nativ, inkl. Trägheit und Bounce. */
    ctrlProp: "__tcdController",
    resolveLocal: "__tcdResolveLocal",
    queue: "__tcdBootQueue",
    initRoot: initRoot,
    api: {
      renderTopCitations: doRender,
      setTopCitationsLoading: function(id, l){ return doLoading(id, l); },
      resetTopCitations: function(instanceId){
        var id = String(instanceId || "").trim();
        if (!id) return false;
        var rs = rootsWithId(id), did = false;
        for (var i = 0; i < rs.length; i++){
          var c = rs[i].__tcdController;
          if (c && typeof c.reset === "function"){ try { c.reset(); did = true; } catch(e){} }
        }
        return did;
      }
    },
    forwardShape: { renderTopCitations: "params", resetTopCitations: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end tcdRun

  tcdBoot(50); // retry for ~5s before giving up on core.js
})();
