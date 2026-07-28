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
  var __tcdBootQueue = window.__tcdBootQueue = window.__tcdBootQueue || [];
  if (!window.__tcdBootStubbed){
    window.__tcdBootStubbed = true;
    window.renderTopCitations = function(){ __tcdBootQueue.push(["renderTopCitations", arguments]); };
    window.setTopCitationsLoading = function(){ __tcdBootQueue.push(["setTopCitationsLoading", arguments]); };
    window.resetTopCitations = function(){ __tcdBootQueue.push(["resetTopCitations", arguments]); };
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

  /* citation types have a genuine dark accent (not the same hex reused on both themes) — no core
     equivalent, this chart-tuned dark palette stays local. */
  var CITE_COLOR_DARK = {
    "Editorial":"#5cd7c8", "UGC / Community":"#62b4da", "Knowledge-Base":"#8082db",
    "Brand Platforms":"#c377cf", "Institutional":"#7693bb", "Competition":"#de8c54", "You":"#d76f82"
  };
  var URL_LABEL = {
    homepage:"Homepage", product_service:"Product / Service", marketplace:"Marketplace", company_info:"Company Info",
    article:"Article", listicle:"Listicle", guide:"Guide", comparison:"Comparison", review:"Review",
    documentation:"Documentation", forum:"Forum", directory:"Directory", video:"Video", social_post:"Social Post", other:"Uncategorized"
  };
  /* bright chart-fill palette, tuned for large area fills — deliberately separate from the chip
     colours below (URL_TYPE_CHIP), which are tuned for small text-on-tint chips. No core
     equivalent for either the light or dark variant. */
  var URL_COLOR_CHART = {
    homepage:"#c3753a", product_service:"#ce8662", marketplace:"#ae7c58", company_info:"#b48139",
    article:"#369379", listicle:"#3e90a6", guide:"#5182ef", comparison:"#726bea", review:"#8a53e1",
    documentation:"#8a53e1", forum:"#a95cee", directory:"#b549bf", video:"#9661f1", social_post:"#a27df8", other:"#8c8f96"
  };
  var URL_COLOR_DARK = {
    homepage:"#fbbf24", product_service:"#fdba74", marketplace:"#fcae6f", company_info:"#facc15",
    article:"#6ee7b7", listicle:"#67e8f9", guide:"#93c5fd", comparison:"#a5b4fc", review:"#c4b5fd",
    documentation:"#c4b5fd", forum:"#d8b4fe", directory:"#f0abfc", video:"#c4b5fd", social_post:"#ddd6fe", other:"#a0a0a0"
  };
  /* NOT UC.OTHER_LIGHT/OTHER_DARK — core's OTHER_DARK is #a8abb2, this component's is #a0a0a0.
     They look like the same shared constant but aren't; keep the local value so this migration
     doesn't silently shift a colour nobody asked to change. */
  var OTHER_LIGHT = "#8c8f96", OTHER_DARK = "#a0a0a0";

  /* canonical URL type chip colours — reuse UC.URL_TYPE (confirmed byte-identical for every key
     it defines) plus the one extra "other" entry this component needs that core's URL_TYPE
     doesn't have. citation types now follow the exact same structural rule as URL types: a
     genuine dark accent (CITE_COLOR_DARK above), not the same hex reused on both themes. */
  var URL_TYPE_CHIP = {};
  Object.keys(UC.URL_TYPE).forEach(function(k){ URL_TYPE_CHIP[k] = UC.URL_TYPE[k]; });
  URL_TYPE_CHIP.other = { label:"Uncategorized", c:"#6f737c", cDark:"#a0a0a0" };
  var MAX_URL_SLICES = 8;
  var TREND_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';
  var TREND_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/></svg>';
  var HASH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>';

  // tag/chip colour+label (table + filter list) — distinct from the chart-slice colour system
  function tagInfo(raw, mode, isDark){
    if (mode === "url"){
      var ut = URL_TYPE_CHIP[raw] || URL_TYPE_CHIP.other;
      var c = isDark ? ut.cDark : ut.c;
      return { label: ut.label, color: c, bg: isDark ? CHIP_BG_DARK : tint(ut.c, 0.12), dot: true };
    }
    var name = citeName(raw);
    var cc = isDark ? (CITE_COLOR_DARK[name] || OTHER_DARK) : (CITE_COLOR[name] || OTHER_LIGHT);
    return { label: name, color: cc, bg: isDark ? CHIP_BG_DARK : tint((CITE_COLOR[name] || OTHER_LIGHT), 0.12), dot: false };
  }
  function typeColor(raw, mode, isDark){
    if (mode === "url"){
      var map = isDark ? URL_COLOR_DARK : URL_COLOR_CHART;
      return map[raw] || (isDark ? OTHER_DARK : OTHER_LIGHT);
    }
    var name = citeName(raw);
    return isDark ? (CITE_COLOR_DARK[name] || OTHER_DARK) : (CITE_COLOR[name] || OTHER_LIGHT);
  }
  function fmtPct(v){ v = Number(v) || 0; if (v > 0 && v < 1) return "<1%"; return Math.round(v) + "%"; }
  function capitalize(s){ s = String(s||""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function measureText(el){
    if (!el) return 0;
    var cs = window.getComputedStyle(el);
    var probe = document.createElement("span");
    probe.textContent = el.textContent;
    probe.style.cssText = "position:absolute;left:-9999px;top:-9999px;white-space:nowrap;visibility:hidden;" +
      "font-family:" + cs.fontFamily + ";font-size:" + cs.fontSize + ";font-weight:" + cs.fontWeight + ";letter-spacing:" + cs.letterSpacing + ";";
    document.body.appendChild(probe);
    var w = probe.offsetWidth;
    document.body.removeChild(probe);
    return w;
  }

  /* ================= Chart.js loader (SHARED across ALL upstreem components on the page) ================= */
  function loadChartJs(){
    if (window.Chart) return Promise.resolve();
    if (window.__upstreemChartJs) return window.__upstreemChartJs;
    window.__upstreemChartJs = new Promise(function(res, rej){
      var existing = document.querySelector('script[data-upstreem-chartjs], script[data-ccchart], script[src*="chart.umd"], script[src*="chart.js@"], script[src*="chart.local"]');
      if (existing){
        var iv = setInterval(function(){ if (window.Chart){ clearInterval(iv); res(); } }, 40);
        setTimeout(function(){ clearInterval(iv); if (window.Chart) res(); else rej(new Error("chartjs timeout")); }, 10000);
        return;
      }
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js";
      s.setAttribute("data-upstreem-chartjs", "1");
      s.onload = function(){ res(); };
      s.onerror = rej;
      document.head.appendChild(s);
    });
    return window.__upstreemChartJs;
  }

  /* ================= doughnut plugins ================= */
  var RING_PX = 12, SEG_GAP = 6, CORNER = 4, HOVER = 12;
  var ringWidthPlugin = {
    id: "tclRingWidth",
    beforeDatasetDraw: function(chart, args){
      var meta = chart.getDatasetMeta(args.index);
      meta.data.forEach(function(arc){ arc.innerRadius = Math.max(1, arc.outerRadius - RING_PX); });
    }
  };
  var constantGapPlugin = {
    id: "tclConstantGap",
    beforeDatasetDraw: function(chart, args){
      var meta = chart.getDatasetMeta(args.index);
      if (!meta || !meta.data || !meta.data.length) return;
      var r = (meta.data[0] && meta.data[0].outerRadius) || 100;
      var gap = SEG_GAP / r, N = meta.data.length;
      var available = (Math.PI*2) - gap*N;
      var total = meta.total || chart.data.datasets[args.index].data.reduce(function(a,b){return a+Number(b||0);},0);
      var cur = -Math.PI/2;
      meta.data.forEach(function(arc, i){
        var value = chart.data.datasets[args.index].data[i];
        var frac = total>0 ? (value/total) : 0;
        var span = frac*available;
        arc.startAngle = cur + gap/2;
        arc.endAngle = cur + span + gap/2;
        arc.circumference = span;
        cur += span + gap;
      });
    }
  };

  /* ================= per-instance doughnut tooltip ================= */
  function makeDonutTooltip(root){
    var state = { x:0, y:0, raf:null };
    var clamp = function(v,a,b){ return Math.max(a, Math.min(b, v)); };
    var lerp = function(a,b,t){ return a+(b-a)*t; };
    return function(context){
      var chart = context.chart, tooltip = context.tooltip;
      var el = root.querySelector(".tcl-donut-tooltip");
      var dark = root.getAttribute("data-theme") === "dark";
      if (!el){
        el = document.createElement("div");
        el.className = "tcl-donut-tooltip";
        el.style.cssText = "position:absolute;pointer-events:none;z-index:9999;opacity:0;transform:translate3d(0,0,0);transition:opacity 120ms ease, transform 120ms ease;";
        el.innerHTML = '<div class="tcl-tt-box"><div class="tcl-tt-title"><span class="tcl-tt-dot"></span><span class="tcl-tt-lbl"></span></div><div class="tcl-tt-sub">Share:</div><div class="tcl-tt-val"></div></div>';
        chart.canvas.parentNode.appendChild(el);
      }
      var boxBg = dark ? "#121212" : "#ffffff";
      var boxBorder = dark ? "" : "border:1px solid #e0e2e6;";
      var boxShadow = dark ? "box-shadow:0 4px 14px rgba(0,0,0,.25);" : "box-shadow:0 4px 14px rgba(0,0,0,.10);";
      var textColor = dark ? "#e6e6e6" : "#1f1f1b";
      var mutedColor = dark ? "#8a8a8a" : "#6f737c";
      el.querySelector(".tcl-tt-box").style.cssText = "background:" + boxBg + ";color:" + textColor + ";" + boxBorder + "border-radius:16px;padding:12px 14px;font-family:Geist,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;line-height:1.35;" + boxShadow + "white-space:nowrap;";
      el.querySelector(".tcl-tt-title").style.cssText = "display:flex;align-items:center;gap:6px;font-weight:600;margin-bottom:6px;";
      el.querySelector(".tcl-tt-sub").style.cssText = "color:" + mutedColor + ";font-size:11px;";
      el.querySelector(".tcl-tt-val").style.cssText = "color:" + textColor + ";";
      if (tooltip.opacity === 0){ el.style.opacity = "0"; return; }
      var i = (tooltip.dataPoints && tooltip.dataPoints[0] && tooltip.dataPoints[0].dataIndex) || 0;
      var od = chart.data.datasets[0].originalData;
      var val = (od && od[i] != null) ? od[i] : (chart.data.datasets[0].data[i] || 0);
      var sliceColor = (chart.data.datasets[0].backgroundColor && chart.data.datasets[0].backgroundColor[i]) || textColor;
      var isUrlMode = chart.__tcdMode === "url";
      var dotEl = el.querySelector(".tcl-tt-dot");
      dotEl.style.cssText = isUrlMode ? "width:6px;height:6px;border-radius:999px;flex:0 0 auto;background:" + sliceColor + ";display:inline-block;" : "display:none;";
      el.querySelector(".tcl-tt-lbl").style.color = sliceColor;
      el.querySelector(".tcl-tt-lbl").textContent = chart.data.labels[i] || "";
      el.querySelector(".tcl-tt-val").textContent = Number(val).toFixed(2) + "%";
      var cx = chart.canvas.offsetLeft, cy = chart.canvas.offsetTop, ca = chart.chartArea;
      var caretX = cx + tooltip.caretX, caretY = cy + tooltip.caretY, m = 12;
      el.style.left = "0px"; el.style.top = "0px";
      var rect = el.getBoundingClientRect();
      var tx = (caretX + rect.width + m > cx + ca.right) ? (caretX - rect.width - m) : (caretX + m);
      tx = clamp(tx, cx + ca.left + m, cx + ca.right - rect.width - m);
      var ty = caretY - rect.height - m;
      if (ty < cy + ca.top + m) ty = caretY + m;
      ty = clamp(ty, cy + ca.top + m, cy + ca.bottom - rect.height - m);
      if (state.raf) cancelAnimationFrame(state.raf);
      var sx = state.x||tx, sy = state.y||ty, st = performance.now(), d = 120;
      function stepFn(now){
        var t = Math.min(1,(now-st)/d), k = t<.5?2*t*t:-1+(4-2*t)*t;
        var nx = lerp(sx,tx,k), ny = lerp(sy,ty,k);
        el.style.transform = "translate3d("+nx+"px,"+ny+"px,0)"; el.style.opacity = "1";
        state.x = nx; state.y = ny;
        if (t<1) state.raf = requestAnimationFrame(stepFn);
      }
      state.raf = requestAnimationFrame(stepFn);
    };
  }

  /* ================= data prep ================= */
  function prepData(mode, rows, isDark){
    rows = Array.isArray(rows) ? rows : [];
    var items = rows
      .filter(function(r){ return r && (r.type != null) && isFinite(Number(r.share_pct)); })
      .map(function(r){ return { key: String(r.type).trim(), share: Math.max(0, Number(r.share_pct)) }; });
    if (mode === "url"){
      items.sort(function(a,b){ return b.share - a.share; });
      if (items.length > MAX_URL_SLICES){
        var head = items.slice(0, MAX_URL_SLICES);
        var otherShare = items.slice(MAX_URL_SLICES).reduce(function(a,b){ return a + b.share; }, 0);
        head.push({ key:"other", share:otherShare, _other:true });
        items = head;
      }
      return items.map(function(it){
        var name = it._other ? "Other" : (URL_LABEL[it.key] || capitalize(String(it.key).replace(/_/g," ")));
        var color = it._other ? (isDark?OTHER_DARK:OTHER_LIGHT) : typeColor(it.key, "url", isDark);
        return { name:name, share:it.share, color:color, rawKey: it._other ? null : it.key };
      });
    }
    return items.map(function(it){
      var name = citeName(it.key);
      return { name:name, share:it.share, color: typeColor(it.key, "citation", isDark), rawKey: it.key };
    });
  }

  /* ================= skeletons ================= */
  function chartSkeletonHtml(){
    var rows = [[110,34],[72,22],[90,22],[120,18],[80,18]];
    var legend = rows.map(function(r){
      return '<div class="tcl-sk-row"><span class="tcl-sk-dot"></span><span class="tcl-sk-lbl" style="width:'+r[0]+'px"></span><span class="tcl-sk-pct" style="width:'+r[1]+'px"></span></div>';
    }).join("");
    return '<div class="tcl-skeleton">' +
      '<div class="tcl-sk-chart"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><mask id="tcl-sk-mask"><circle cx="50" cy="50" r="38" fill="none" stroke="white" stroke-width="7"/></mask>' +
        '<linearGradient id="tcl-sk-grad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" class="tcl-sk-g0"/><stop offset="50%" class="tcl-sk-g1"/><stop offset="100%" class="tcl-sk-g0"/></linearGradient></defs>' +
        '<circle cx="50" cy="50" r="38" fill="none" class="tcl-sk-ring" stroke-width="7"/>' +
        '<rect x="-60" y="0" width="50" height="100" fill="url(#tcl-sk-grad)" mask="url(#tcl-sk-mask)"><animateTransform attributeName="transform" type="translate" from="-60 0" to="160 0" dur="1.2s" repeatCount="indefinite"/></rect>' +
      '</svg></div>' +
      '<div class="tcl-sk-legend">' + legend + '</div>' +
    '</div>';
  }
  function tableSkeletonHtml(){
    var rows = "";
    for (var i = 0; i < 7; i++){
      rows += '<div class="tct-row tct-tsk">' +
        '<div class="tct-td tct-td-idx"><span class="tct-tsk-bar" style="width:12px"></span></div>' +
        '<div class="tct-td"><span class="tct-tsk-logo"></span><span class="tct-tsk-bar" style="width:' + (70 + (i % 3) * 18) + 'px"></span></div>' +
        '<div class="tct-td"><span class="tct-tsk-bar" style="width:60px"></span></div>' +
        '<div class="tct-td"><span class="tct-tsk-bar" style="width:46px"></span></div>' +
        '<div class="tct-td"><span class="tct-tsk-bar" style="width:40px"></span></div>' +
      '</div>';
    }
    return tableHeadHtml() + '<div class="tct-tbody">' + rows + '</div>';
  }
  function tableHeadHtml(mode){
    return '<div class="tct-thead">' +
      '<div class="tct-th tct-th-idx">' + HASH_ICON + '</div>' +
      '<div class="tct-th">' + (mode === "url" ? "URL" : "Domain") + '</div>' +
      '<div class="tct-th tct-th-type">Type</div>' +
      '<div class="tct-th">Share</div>' +
      '<div class="tct-th tct-th-used">Used</div></div>';
  }

  /* ================= controller (one per root element) ================= */
  function makeController(root){
    var body = root.querySelector(".tcl-body");
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
      filterDimension: saved.filterDimension || "citation_type", brandMentioned: saved.brandMentioned || ""
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
    var chartInstance = null;
    var tooltipHandler = makeDonutTooltip(root);

    var topTotal = root.querySelector(".tcl-top-total");
    var topTotalN = topTotal ? topTotal.querySelector(".n") : null;

    function syncModeActive(){
      Array.prototype.slice.call(root.querySelectorAll(".tcd-mode-btn")).forEach(function(b){
        b.classList.toggle("is-active", b.getAttribute("data-mode") === state.mode);
      });
    }
    function syncChartSwitch(){
      Array.prototype.slice.call(root.querySelectorAll(".tcl-seg-btn")).forEach(function(o){
        var on = o.getAttribute("data-chart") === state.chartMode;
        o.classList.toggle("is-active", on);
        o.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    function destroyChart(){
      if (chartInstance){ try { chartInstance.destroy(); } catch(e){} chartInstance = null; }
      var cv = body.querySelector("canvas");
      if (cv && window.Chart && window.Chart.getChart){ var ex = window.Chart.getChart(cv); if (ex) try{ ex.destroy(); }catch(e){} }
    }

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

    function applyCollapse(){
      var layout = body.querySelector(".tcl-donut-layout");
      if (!layout) return;
      layout.classList.toggle("is-collapsed", root.getBoundingClientRect().width < 420);
    }

    function renderDoughnut(){
      if (root.__tcdController && root.__tcdController.__ctrlId !== myCtrlId) return;
      destroyChart();
      var d = state.prepped;
      var allEmpty = !d.length || d.every(function(x){ return !(Number(x.share) > 0); });
      if (allEmpty){ body.innerHTML = '<div class="tcl-empty">No data</div>'; return; }
      body.innerHTML =
        '<div class="tcl-donut-layout">' +
          '<div class="tcl-donut-wrap"><canvas></canvas>' +
            '<div class="tcl-center"><span class="n">' + esc(fmtTotal(state.chartTotal)) + '</span><span class="lbl">Citations</span></div>' +
          '</div>' +
          '<div class="tcl-legend"></div>' +
        '</div>';
      body.querySelector(".tcl-legend").innerHTML = d.map(function(it){
        return '<div class="tcl-legend-row"><span class="tcl-legend-chip" style="background:' + it.color + '"></span>' +
          '<span class="tcl-legend-name">' + esc(it.name) + '</span>' +
          '<span class="tcl-legend-pct">' + esc(fmtPct(it.share)) + '</span></div>';
      }).join("");
      applyCollapse();
      if (!d.length) return;
      loadChartJs().then(function(){
        if (root.__tcdController && root.__tcdController.__ctrlId !== myCtrlId) return;
        var canvas = body.querySelector("canvas");
        if (!canvas) return;
        attachCanvasWheel();
        var ctx = canvas.getContext("2d");
        var origData = d.map(function(x){ return x.share; });
        var display = origData.map(function(v){ return Math.max(v, 1.0); });
        var colors = d.map(function(x){ return x.color; });
        var allZero = origData.every(function(v){ return v <= 0; });
        try {
          chartInstance = new window.Chart(ctx, {
            type: "doughnut",
            data: {
              labels: allZero ? ["—"] : d.map(function(x){ return x.name; }),
              datasets: [{
                data: allZero ? [1] : display,
                originalData: allZero ? [0] : origData,
                backgroundColor: allZero ? [isDark?"rgba(255,255,255,0.06)":"#eeeeee"] : colors,
                spacing: 0, borderWidth: 0, borderRadius: CORNER, hoverOffset: HOVER
              }]
            },
            plugins: [constantGapPlugin, ringWidthPlugin],
            options: {
              responsive: true, maintainAspectRatio: false, layout: { padding: 8 },
              animation: { duration: 200, easing: "easeOutQuad" },
              plugins: { legend: { display:false }, tooltip: { enabled:false, external: tooltipHandler } }
            }
          });
          chartInstance.__tcdMode = state.mode;
        } catch(err){}
      });
    }

    function renderBars(){
      if (root.__tcdController && root.__tcdController.__ctrlId !== myCtrlId) return;
      destroyChart();
      var d = state.prepped.slice().sort(function(a,b){ return b.share - a.share; });
      if (topTotalN) topTotalN.textContent = fmtTotal(state.chartTotal);
      if (topTotal) topTotal.style.display = "flex";
      if (!d.length || d.every(function(x){ return !(Number(x.share) > 0); })){ body.innerHTML = '<div class="tcl-empty">No data</div>'; return; }
      body.innerHTML = '<div class="tcl-bars">' + d.map(function(it){
        var txt = "rgba(255,255,255,0.95)";
        var outColor = isDark ? "rgba(255,255,255,0.85)" : "var(--vc-text)";
        var outPctColor = isDark ? "rgba(255,255,255,0.55)" : "var(--vc-muted)";
        return '<div class="tcl-bar-row">' +
          '<div class="tcl-bar-track">' +
            '<div class="tcl-bar-fill" style="background:' + it.color + ';width:0%">' +
              '<span class="tcl-bar-name" style="color:' + txt + ';opacity:0">' + esc(it.name) + '</span>' +
              '<span class="tcl-bar-pct" style="color:' + txt + ';opacity:0">' + esc(fmtPct(it.share)) + '</span>' +
            '</div>' +
            '<span class="tcl-bar-outside" style="opacity:0">' +
              '<span class="tcl-bar-name-out" style="color:' + outColor + '">' + esc(it.name) + '</span>' +
              '<span class="tcl-bar-pct-out" style="color:' + outPctColor + '">' + esc(fmtPct(it.share)) + '</span>' +
            '</span>' +
          '</div>' +
        '</div>';
      }).join("") + '</div>';

      var rows = Array.prototype.slice.call(body.querySelectorAll(".tcl-bar-row"));
      var metrics = rows.map(function(row){
        var name = row.querySelector(".tcl-bar-name");
        var pin = row.querySelector(".tcl-bar-pct");
        return { nameW: name ? measureText(name) : 0, pctW: pin ? measureText(pin) : 0 };
      });
      function placeRow(row, m){
        var fill = row.querySelector(".tcl-bar-fill");
        var name = row.querySelector(".tcl-bar-name");
        var pin = row.querySelector(".tcl-bar-pct");
        var outside = row.querySelector(".tcl-bar-outside");
        if (!fill || !outside) return;
        var fillPx = fill.offsetWidth;
        var needed = m.nameW + m.pctW + 12 + 20;
        if (fillPx >= needed){
          if (name) name.style.opacity = "1";
          if (pin) pin.style.opacity = "1";
          outside.style.opacity = "0";
        } else {
          if (name) name.style.opacity = "0";
          if (pin) pin.style.opacity = "0";
          outside.style.left = Math.round(fillPx + 8) + "px";
          outside.style.opacity = "1";
        }
      }
      function placeAll(){ rows.forEach(function(row, i){ placeRow(row, metrics[i]); }); }
      function fitBars(){
        if (!rows.length) return;
        var rootH = root.clientHeight;
        if (!rootH) return;
        var topBar = root.querySelector(".tcd-head");
        var topH = topBar ? topBar.offsetHeight + 16 : 0;
        var padV = 32;
        var avail = rootH - topH - padV;
        if (avail <= 0) return;
        var rowH = rows[0].offsetHeight || 42;
        var maxVisible = Math.max(1, Math.floor(avail / rowH));
        for (var i=0;i<rows.length;i++){ rows[i].style.display = (i < maxVisible) ? "" : "none"; }
      }
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        rows.forEach(function(row, i){
          var fill = row.querySelector(".tcl-bar-fill");
          if (fill) fill.style.width = Math.max(d[i].share, 0) + "%";
        });
        fitBars();
      }); });
      var placed = false;
      rows.forEach(function(row){
        var fill = row.querySelector(".tcl-bar-fill");
        if (!fill) return;
        var done = false;
        fill.addEventListener("transitionend", function onEnd(e){
          if (e.propertyName !== "width" || done) return;
          done = true; fill.removeEventListener("transitionend", onEnd);
          var i = rows.indexOf(row); if (i >= 0) placeRow(row, metrics[i]);
        });
      });
      setTimeout(function(){ placed = true; fitBars(); placeAll(); }, 640);
      if (window.ResizeObserver){
        var ro = new ResizeObserver(function(){ fitBars(); if (placed) placeAll(); });
        ro.observe(body);
        rows.forEach(function(row){ var t = row.querySelector(".tcl-bar-track"); if (t) ro.observe(t); });
      }
    }

    function applySelectionDim(prepped){
      var sel = state.mode === "url" ? state.filterUrlTypeSel : state.filterTypeSel;
      var selectedKeys = Object.keys(sel).filter(function(k){ return sel[k]; });
      if (!selectedKeys.length) return prepped;
      var selSet = {};
      selectedKeys.forEach(function(k){ selSet[k] = true; });
      var grey = isDark ? "#3a3a3a" : "#e0e2e6";
      return prepped.map(function(it){
        return (it.rawKey != null && selSet[it.rawKey]) ? it : { name: it.name, share: it.share, color: grey, rawKey: it.rawKey };
      });
    }
    var chartEmptyGraceTimer = null;
    function chartIsEmpty(){ return !state.prepped.length || state.prepped.every(function(x){ return !(Number(x.share) > 0); }); }
    function renderChartSide(){
      if (root.__tcdController && root.__tcdController.__ctrlId !== myCtrlId) return;
      if (state.loading || state.optimisticLoading || !state.hasChart){
        if (chartEmptyGraceTimer){ clearTimeout(chartEmptyGraceTimer); chartEmptyGraceTimer = null; }
        destroyChart();
        if (topTotal) topTotal.style.display = "none";
        body.innerHTML = chartSkeletonHtml();
        syncChartSwitch();
        return;
      }
      state.prepped = applySelectionDim(prepData(state.mode, activeBreakdown(), isDark));
      if (chartIsEmpty()){
        /* Same interim-"clearing" flash risk as the table side — give a short grace window before
           committing to "No data" in case a real breakdown lands a moment later. */
        if (!chartEmptyGraceTimer){
          body.innerHTML = chartSkeletonHtml();
          chartEmptyGraceTimer = setTimeout(function(){
            chartEmptyGraceTimer = null;
            if (root.__tcdController && root.__tcdController.__ctrlId !== myCtrlId) return;
            if (state.loading || state.optimisticLoading || !state.hasChart || !chartIsEmpty()) return;
            if (state.chartMode === "bar"){ if (topTotal) topTotal.style.display = "flex"; renderBars(); }
            else { if (topTotal) topTotal.style.display = "none"; renderDoughnut(); }
            syncChartSwitch();
          }, 3000);   // matches visibility-chart's established __votNoDataT grace window
        }
        syncChartSwitch();
        return;
      }
      if (chartEmptyGraceTimer){ clearTimeout(chartEmptyGraceTimer); chartEmptyGraceTimer = null; }
      if (state.chartMode === "bar"){ if (topTotal) topTotal.style.display = "flex"; renderBars(); }
      else { if (topTotal) topTotal.style.display = "none"; renderDoughnut(); }
      syncChartSwitch();
    }
    function syncChartDim(){ renderChartSide(); }

    /* ================= RIGHT: Top Domains / Top URLs table ================= */
    var ROW_GOTO = '<span class="tct-row-goto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></span>';
    function trendChip(delta, suffix){
      if (delta == null || delta === "") return "";
      var d = Number(delta);
      if (!isFinite(d)) return "";
      var shown = Math.round(Math.abs(d) * 10) / 10;
      if (shown === 0) return "";
      var goingUp = d > 0;
      var cls = goingUp ? "pos" : "neg";
      var icon = goingUp ? TREND_UP : TREND_DOWN;
      return '<span class="tct-trend ' + cls + '">' + icon + shown.toFixed(1) + (suffix || "") + '</span>';
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
        var trend = c.querySelector(".tct-trend");
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
            tableEl.innerHTML = head + '<div class="tct-empty">No data</div>';
          }, 3000);   // matches visibility-chart's established __votNoDataT grace window
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
          ? '<span class="tct-logo-box"><img src="' + esc(favicon) + '" onerror="this.style.visibility=\'hidden\'"/></span>'
          : '<span class="tct-logo-box"></span>';
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
        var share = '<span class="tct-num">' + (shareNull ? "–" : (Math.round(Number(shareRaw) || 0) + "%")) + '</span>' + trendChip(r.share_delta_pct, "%");
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
      var count = state.mode === "url" ? state.totalCountUrl : state.totalCountDomain;
      if (count != null && count !== ""){ cn.textContent = fmtTotal(count); cn.classList.remove("is-sk"); }
      else { cn.textContent = ""; cn.classList.add("is-sk"); }
    }

    /* ================= filter (fader): Citation Types / URL Types + "Brand mentioned?" =================
       Panel is portaled via UpstreemCore.makePortal/placeMenu, matching how domains-table/urls-table
       portal their equivalent dropdowns — the source uses a plain position:absolute menu today, but
       every already-migrated component's equivalent is portaled, so this brings it in line. Reuses
       core.css's shared .up-filter-menu/.up-filter-dim/.up-filter-dim-btn/.up-filter-head/
       .up-filter-title/.up-filter-reset/.up-filter-list/.up-filter-item/.up-filter-check/
       .up-filter-submit — urls-table.js's own citation-type/url-type filter already uses this exact
       shell. Deliberately does NOT revert the live selection when closed without Apply — the source
       never did either; there's no separate draft-vs-applied concept here beyond the badge/chart-grey
       (which already re-renders live on every checkbox click via syncChartDim()). */
    var filterWrap = root.querySelector(".tcd-filter");
    var filterBtn = root.querySelector(".tcd-filter-btn");
    var filterMenu = root.querySelector(".up-filter-menu");
    var _portal = UpstreemCore.makePortal(root, [filterMenu], instanceId);
    var portalLayer = _portal.portalLayer, syncPortalTheme = _portal.syncPortalTheme;

    function setFilterOpen(open){
      if (!filterWrap) return;
      if (!open && filterMenu && filterMenu.contains(document.activeElement)){
        try { filterBtn ? filterBtn.focus({ preventScroll: true }) : document.activeElement.blur(); }
        catch(e){ try { document.activeElement.blur(); } catch(e2){} }
      }
      filterWrap.classList.toggle("is-open", !!open);
      if (filterMenu){
        filterMenu.setAttribute("aria-hidden", open ? "false" : "true");
        filterMenu.classList.toggle("is-shown", !!open);
        if (open) UpstreemCore.placeMenu(filterMenu, filterBtn);
      }
    }
    function closePops(){ setFilterOpen(false); }

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
    function syncFilterBadge(){
      var badge = root.querySelector(".tcd-filter-badge");
      if (!badge) return;
      var n = 0;
      Object.keys(state.appliedTypeSel).forEach(function(k){ if (state.appliedTypeSel[k]) n++; });
      Object.keys(state.appliedUrlTypeSel).forEach(function(k){ if (state.appliedUrlTypeSel[k]) n++; });
      badge.textContent = n ? String(n) : "";
      badge.classList.toggle("is-visible", n > 0);
    }
    function syncBrandToggle(startClearMessage){
      if (!brandToggle) return;
      var hasBrand = !!(state.brand && state.brand.name);
      brandToggle.classList.toggle("is-visible", hasBrand);
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
        state.filterTypeSel = {};
        state.filterUrlTypeSel = {};
        persistState();
        populateFilter();
        syncChartDim();
        fireApplyFilter();   // also clears the applied snapshot + hides the badge
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

    /* ---- Mira-style button tooltips (body-appended, position:fixed) — own implementation, see
       topcitations-dashboard.css's file header for why this isn't UpstreemCore.makeTooltips. ---- */
    var tipEl = window.__tcdTipEl;
    if (!tipEl || !document.body.contains(tipEl)){
      tipEl = document.createElement("div");
      tipEl.className = "tcd-tip";
      document.body.appendChild(tipEl);
      window.__tcdTipEl = tipEl;
    }
    /* tipTimer/tipBtn must be shared across EVERY topcitations-dashboard root on the page —
       they all bind to the same singleton tipEl above. Keeping them as per-root closure state
       (as this used to) meant each other, idle root's own near-always-null tipBtn lost the
       mousemove/scroll safety-net race against whichever root was actually being hovered and
       hid its tooltip out from under it whenever 2+ instances shared a page. */
    var tipState = window.__tcdTipState || (window.__tcdTipState = { timer: null, btn: null, placedRect: null, lastScrollAt: 0 });
    var hideTip = function(){ clearTimeout(tipState.timer); tipState.timer = null; tipState.btn = null; tipEl.classList.remove("show"); };
    var placeTip = function(btn){
      tipEl.style.transform = "";
      var br = btn.getBoundingClientRect();
      var tw = tipEl.offsetWidth, vw = window.innerWidth || document.documentElement.clientWidth;
      var left = br.left + br.width / 2 - tw / 2;
      left = Math.max(6, Math.min(left, vw - tw - 6));
      tipEl.style.left = left + "px";
      tipEl.style.top = (br.bottom + 8) + "px";
      tipState.placedRect = br;
    };
    var showTip = function(btn){
      if (!btn || !document.contains(btn)) return;
      var txt = btn.getAttribute("data-tip"); if (!txt) return;
      var dark2 = (btn.closest(".tcd-root") || root).getAttribute("data-theme") === "dark";
      tipEl.style.background = dark2 ? "#f0f0f0" : "#1f1f1b";
      tipEl.style.color = dark2 ? "#1f1f1b" : "#ffffff";
      tipEl.textContent = txt;
      tipEl.classList.add("show");
      placeTip(btn);
    };
    if (!root.__tcdTipBound){
      root.__tcdTipBound = true;
      /* tipState.lastScrollAt guards these: scrolling moves content under a completely stationary
         cursor, and the browser recomputes hover state as different elements pass under it —
         without suppressing that, a mid-scroll phantom mouseout on the currently-tipped button
         (or mouseover on some other [data-tip] it scrolls past) fought the transform-nudge below,
         which is exactly what read as the tooltip "jumping wildly" while scrolling instead of
         calmly tracking one target. */
      root.addEventListener("mouseover", function(e){
        if (Date.now() - tipState.lastScrollAt < 200) return;
        var btn = e.target.closest("[data-tip]");
        if (!btn || !root.contains(btn) || btn === tipState.btn) return;
        tipState.btn = btn;
        clearTimeout(tipState.timer);
        tipState.timer = setTimeout(function(){ showTip(btn); }, 60);
      });
      root.addEventListener("mouseout", function(e){
        if (Date.now() - tipState.lastScrollAt < 200) return;
        var btn = e.target.closest("[data-tip]");
        if (!btn) return;
        if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
        if (btn === tipState.btn) hideTip();
      });
      root.addEventListener("mousedown", hideTip);
    }
    /* The mousemove/scroll/blur safety-net only needs to run once globally — it operates on the
       shared tipState/tipEl above regardless of which root's closure it was bound from. */
    if (!window.__tcdTipGlobalBound){
      window.__tcdTipGlobalBound = true;
      document.addEventListener("mousemove", function(){
        if (!tipEl.classList.contains("show") && !tipState.timer) return;
        if (!tipState.btn || !document.contains(tipState.btn)){ hideTip(); return; }
        var stillHovered = false;
        try { stillHovered = tipState.btn.matches(":hover"); } catch(err){ stillHovered = true; }
        if (!stillHovered) hideTip();
      });
      /* Keep an open tooltip glued to its trigger while the page scrolls — same cheap,
         compositor-only transform-nudge + settle-time full reposition as dropdown menus (see
         core.js's makePortal/nudgeMenu and makeTooltips). Used to just hide on scroll, which
         reads as "the tooltip vanished," not "the tooltip is stuck to the button." Global (not
         per-root) for the same reason the mousemove safety-net above is global — one listener
         serves whichever instance's tipState.btn is currently set. */
      var tipRepositionRaf = null, tipSettleTimer = null;
      window.addEventListener("scroll", function(){
        tipState.lastScrollAt = Date.now();
        if (!tipState.btn) return;
        if (tipRepositionRaf) return;
        tipRepositionRaf = requestAnimationFrame(function(){
          tipRepositionRaf = null;
          if (!tipState.btn || !tipState.placedRect) return;
          var r = tipState.btn.getBoundingClientRect();
          tipEl.style.transform = "translate(" + Math.round(r.left - tipState.placedRect.left) + "px," + Math.round(r.top - tipState.placedRect.top) + "px)";
          clearTimeout(tipSettleTimer);
          tipSettleTimer = setTimeout(function(){ if (tipState.btn) placeTip(tipState.btn); }, 150);
        });
      }, { capture: true, passive: true });
      window.addEventListener("blur", hideTip);
    }

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
        try { if (chartInstance) chartInstance.resize(); } catch(e){}
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
          state.filterDimension = "citation_type";
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
        if (typeof syncPortalTheme === "function") syncPortalTheme();
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
        state.filterDimension = "citation_type";
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
          if (typeof syncPortalTheme === "function") syncPortalTheme();
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
  function initAll(){
    var roots = document.querySelectorAll(".tcd-root:not(.up-portal)");
    for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
  }
  function isVisible(el){
    try { return !!el.offsetParent; } catch(e){ return true; }
  }
  function rootsWithId(id){
    var roots = document.querySelectorAll(".tcd-root:not(.up-portal)");
    var out = [];
    for (var i = 0; i < roots.length; i++){ if (roots[i].getAttribute("data-instance") === id) out.push(roots[i]); }
    return out;
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
  window.renderTopCitations = doRender;
  window.setTopCitationsLoading = function(id, l){ return doLoading(id, l); };
  window.__tcdResolveLocal = function(id){ return rootsWithId(id).length > 0; };
  window.resetTopCitations = function(instanceId){
    var id = String(instanceId || "").trim();
    if (!id) return false;
    var roots = rootsWithId(id);
    var did = false;
    for (var i = 0; i < roots.length; i++){
      var ctrl = roots[i].__tcdController;
      if (ctrl && typeof ctrl.reset === "function"){ try { ctrl.reset(); did = true; } catch(e){} }
    }
    return did;
  };

  /* Replay whatever Bubble called against the stub functions above while this script was still
     waiting on core.js, in the exact order those calls arrived. */
  if (__tcdBootQueue.length){
    var __tcdQueued = __tcdBootQueue.splice(0, __tcdBootQueue.length);
    __tcdQueued.forEach(function(entry){
      try { window[entry[0]].apply(null, entry[1]); } catch(e){}
    });
  }

  /* ================= forwarder on parent AND top (nested reusables) ================= */
  (function exposeUpward(){
    var targets = [];
    try { if (window.parent && window.parent !== window) targets.push(window.parent); } catch(e){}
    try { if (window.top && window.top !== window && targets.indexOf(window.top) === -1) targets.push(window.top); } catch(e){}
    if (!targets.length) return;
    function makeDeliver(w){
      return function(fnName, id, arg1, arg2){
        var queue = [w], seen = [];
        while (queue.length){
          var win = queue.shift(), ifr;
          try { ifr = win.document.querySelectorAll("iframe"); } catch(e){ continue; }
          for (var i=0;i<ifr.length;i++){ var cw; try { cw = ifr[i].contentWindow; } catch(e){ cw = null; } if (!cw || seen.indexOf(cw) !== -1) continue; seen.push(cw); queue.push(cw); }
        }
        var delivered = false;
        for (var a=0;a<seen.length;a++){ try { var c = seen[a]; if (c && typeof c[fnName] === "function" && c.__tcdResolveLocal && c.__tcdResolveLocal(id)){ c[fnName](arg1, arg2); delivered = true; } } catch(e){} }
        if (delivered) return true;
        for (var b2=0;b2<seen.length;b2++){ try { var c2 = seen[b2]; if (c2 && typeof c2[fnName] === "function") return c2[fnName](arg1, arg2); } catch(e){} }
        return false;
      };
    }
    for (var t=0;t<targets.length;t++){
      (function(w){
        try {
          var deliver = makeDeliver(w);
          w.renderTopCitations = function(params){ params = params || {}; return deliver("renderTopCitations", params.instanceId || "default", params); };
          w.setTopCitationsLoading = function(id, l){ return deliver("setTopCitationsLoading", id || "default", id, l); };
          w.resetTopCitations = function(id){ return deliver("resetTopCitations", id || "default", id); };
        } catch(e){}
      })(targets[t]);
    }
  })();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
  [30, 100, 250, 500, 1000, 1800].forEach(function(ms){ setTimeout(initAll, ms); });

  /* shared page-level watcher (core) — see UC.watchRoots for why this replaced a
     private-to-this-component MutationObserver */
  if (UC.watchRoots) UC.watchRoots("tcd-root", initAll);   // guard: a stale cached core.js on the page may predate this API
  window.addEventListener("resize", function(){
    var roots = document.querySelectorAll(".tcd-root:not(.up-portal)");
    for (var i = 0; i < roots.length; i++){
      var ctrl = roots[i].__tcdController;
      if (ctrl) ctrl.update({});
    }
  });
  /* ================= scroll fix ================= */
  function __tcdScrollTarget(fromEl){
    var doc = document;
    var node = fromEl;
    while (node && node.nodeType === 1 && node !== doc.body && node !== doc.documentElement){
      try {
        var oy = getComputedStyle(node).overflowY;
        if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight + 2) return node;
      } catch(e){}
      node = node.parentNode;
    }
    var byId = doc.getElementById("main");
    if (byId && byId.scrollHeight > byId.clientHeight + 2) return byId;
    var se = doc.scrollingElement || doc.documentElement;
    if (se && se.scrollHeight > se.clientHeight + 2) return se;
    return byId || null;
  }
  function __tcdForwardWheel(e){
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    var t = __tcdScrollTarget(e.target);
    if (t){ if (e.cancelable) e.preventDefault(); t.scrollTop += e.deltaY; return; }
    try { if (window.parent && window.parent !== window) window.parent.scrollBy(0, e.deltaY); } catch(ex){}
    try { window.scrollBy(0, e.deltaY); } catch(ex){}
  }
  function attachCanvasWheel(){
    var roots = document.querySelectorAll(".tcd-root:not(.up-portal)");
    for (var i = 0; i < roots.length; i++){ if (!roots[i].__tcdWheel){ roots[i].__tcdWheel = true; roots[i].addEventListener("wheel", __tcdForwardWheel, { passive: false }); } }
  }
  if (!window.__tcdWheelFixInstalled){
    window.__tcdWheelFixInstalled = true;
    attachCanvasWheel();
    setInterval(attachCanvasWheel, 800);
  }
  } // end tcdRun

  tcdBoot(50); // retry for ~5s before giving up on core.js
})();
