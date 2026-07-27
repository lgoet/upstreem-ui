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
  var __votBootQueue = window.__votBootQueue = window.__votBootQueue || [];
  if (!window.__votBootStubbed){
    window.__votBootStubbed = true;
    window.renderVisibilityChart = function(){ __votBootQueue.push(["renderVisibilityChart", arguments]); };
    window.setVisibilityChartLoading = function(){ __votBootQueue.push(["setVisibilityChartLoading", arguments]); };
    window.resetVisibilityChart = function(){ __votBootQueue.push(["resetVisibilityChart", arguments]); };
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

  /* ================= Chart.js loader (SHARED across ALL upstreem components on the page) =================
     Unchanged from the pre-migration component: window.__upstreemChartJs is already a deliberate
     cross-component dedup global, not something this migration introduces. */
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

  /* ================= local helpers (chart-specific date formatting, not covered by core.js) ================= */
  function truncate(s, n){ s = String(s==null?"":s); return s.length > n ? s.slice(0, n-1) + "…" : s; }
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var MONTHS_DE = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function dateFmt(day){
    var m = String(day||"").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(day||"");
    return parseInt(m[3],10) + " " + MONTHS[parseInt(m[2],10)-1] + " " + m[1];
  }
  function dateFmtTitle(day, gran){
    var m = String(day||"").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(day||"");
    if (gran === "month") return MONTHS_DE[parseInt(m[2],10) - 1] || dateFmt(day);
    return dateFmt(day);
  }

  /* ================= line chart plugins + tooltip ================= */
  var LINE_TENSION = 0.3, LINE_WIDTH = 1.5, LINE_POINT_HOVER = 4, LINE_POINT_HIT = 6, LINE_POINT_BORDER = 1.4;
  var X_MAX_TICKS = 7, Y_PAD = 1.15;

  var hoverLinePlugin = {
    id: "ccHoverLine",
    afterDatasetsDraw: function(chart){
      var act = chart.tooltip && chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
      if (!act || !act.length) return;
      var x = act[0].element.x, ca = chart.chartArea, ctx = chart.ctx;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(x, ca.top); ctx.lineTo(x, ca.bottom);
      ctx.lineWidth = 1; ctx.strokeStyle = chart.$ccHoverLineColor || "rgba(0,0,0,0.12)";
      ctx.stroke(); ctx.restore();
    }
  };
  var dashedYGridPlugin = {
    id: "ccDashedYGrid",
    beforeDatasetsDraw: function(chart){
      var y = chart.scales.y, ca = chart.chartArea, ctx = chart.ctx;
      if (!y || !ca) return;
      var ticks = (y.getTicks && y.getTicks()) || y.ticks || [];
      if (!ticks.length) return;
      ctx.save();
      ctx.setLineDash([6,6]); ctx.lineWidth = 1; ctx.strokeStyle = chart.$ccGridColor || "rgba(0,0,0,0.08)";
      ticks.forEach(function(t){
        if (t.value <= 0) return;
        var yp = y.getPixelForValue(t.value);
        if (yp == null || isNaN(yp)) return;
        if (yp < ca.top - 0.5 || yp > ca.bottom + 0.5) return;
        ctx.beginPath(); ctx.moveTo(ca.left, Math.round(yp) + 0.5); ctx.lineTo(ca.right, Math.round(yp) + 0.5); ctx.stroke();
      });
      ctx.restore();
    }
  };

  function makeLineTooltip(wrap){
    var pos = { x:null, y:null }, target = { x:0, y:0 }, running = false, visible = false, raf = null;
    var FOLLOW = 0.18;
    function loop(){
      var el = wrap.querySelector(".vc-line-tt");
      if (pos.x == null){ pos.x = target.x; pos.y = target.y; }
      pos.x += (target.x - pos.x) * FOLLOW;
      pos.y += (target.y - pos.y) * FOLLOW;
      if (el) el.style.transform = "translate3d(" + pos.x + "px," + pos.y + "px,0)";
      var dx = Math.abs(target.x - pos.x), dy = Math.abs(target.y - pos.y);
      if (visible || dx > 0.4 || dy > 0.4){ raf = requestAnimationFrame(loop); }
      else { running = false; }
    }
    return function(context){
      var chart = context.chart, tooltip = context.tooltip;
      var el = wrap.querySelector(".vc-line-tt");
      if (!el){
        el = document.createElement("div");
        el.className = "vc-line-tt";
        el.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:9999;opacity:0;transform:translate3d(0,0,0);transition:opacity 120ms ease;";
        wrap.appendChild(el);
      }
      if (tooltip.opacity === 0){ el.style.opacity = "0"; visible = false; pos.x = null; pos.y = null; return; }
      var dps = (tooltip.dataPoints || []).filter(function(dp){ return dp && dp.parsed && dp.parsed.y != null; });
      if (!dps.length){ el.style.opacity = "0"; visible = false; pos.x = null; pos.y = null; return; }
      var themeRoot = chart.canvas.closest(".vot-root");
      var dark = !!(themeRoot && themeRoot.getAttribute("data-theme") === "dark");
      var boxBg = dark ? "#121212" : "#ffffff";
      var boxBorder = dark ? "" : "border:1px solid #e0e2e6;";
      var boxShadow = dark ? "box-shadow:0 4px 14px rgba(0,0,0,.25);" : "box-shadow:0 4px 14px rgba(0,0,0,.10);";
      var textColor = dark ? "#e6e6e6" : "#1f1f1b";
      var mutedColor = dark ? "#8a8a8a" : "#6f737c";
      var idx = dps[0].dataIndex;
      var dayLabel = chart.data.labels[idx];
      dps = dps.slice().sort(function(a,b){ return b.parsed.y - a.parsed.y; });
      var ff = "Geist,system-ui,-apple-system,Segoe UI,Roboto,Arial";
      var rows = dps.map(function(dp){
        var ds = dp.dataset;
        var icon = ds.__favicon
          ? '<img src="' + esc(ds.__favicon) + '" width="16" height="16" style="border-radius:4px;display:block;object-fit:cover" onerror="this.style.visibility=\'hidden\'"/>'
          : '<span style="width:16px;height:16px;border-radius:4px;background:' + ds.__baseColor + ';display:block"></span>';
        var name = truncate(ds.label, 32);
        var vy = Number(dp.parsed.y) || 0, vr = Math.round(vy);
        var val = (vy > 0 && vr === 0) ? "<1%" : (vr + "%");
        return '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">' +
            '<span style="flex:0 0 16px;display:flex">' + icon + '</span>' +
            '<span style="flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:' + textColor + '">' + esc(name) + '</span>' +
            '<span style="flex:0 0 auto;margin-left:77px;color:' + textColor + ';font-weight:500">' + val + '</span>' +
          '</div>';
      }).join("");
      el.innerHTML =
        '<div style="background:' + boxBg + ';color:' + textColor + ';' + boxBorder + 'border-radius:16px;padding:10px 12px;font-family:' + ff + ';font-size:13px;line-height:1.35;' + boxShadow + 'white-space:nowrap;min-width:220px;">' +
          '<div style="color:' + mutedColor + ';font-size:11px">' + esc(dateFmtTitle(dayLabel, chart.__curGran)) + '</div>' +
          rows +
        '</div>';
      var cx = chart.canvas.offsetLeft, cy = chart.canvas.offsetTop, ca = chart.chartArea;
      var caretX = cx + (tooltip.caretX != null ? tooltip.caretX : dps[0].element.x), m = 16;
      el.style.left = "0px"; el.style.top = "0px";
      var rect = el.getBoundingClientRect();
      var tx = (caretX + rect.width + m > cx + ca.right) ? (caretX - rect.width - m) : (caretX + m);
      tx = Math.max(cx + ca.left, Math.min(tx, cx + ca.right - rect.width));
      var ty = Math.max(cy + ca.top, Math.min(cy + ca.top + 8, cy + ca.bottom - rect.height));
      target.x = tx; target.y = ty;
      if (pos.x == null){ pos.x = tx; pos.y = ty; el.style.transform = "translate3d("+tx+"px,"+ty+"px,0)"; }
      el.style.opacity = "1"; visible = true;
      if (!running){ running = true; raf = requestAnimationFrame(loop); }
    };
  }

  /* ================= data prep ================= */
  function buildLineDatasets(series, companies){
    series = Array.isArray(series) ? series : [];
    companies = Array.isArray(companies) ? companies : [];
    var metaMap = {};
    companies.forEach(function(c){
      if (!c || c.company_id == null) return;
      metaMap[String(c.company_id)] = {
        color: c.color || null,
        favicon: c.favicon_url || c.favicon || "",
        name: c.name != null ? String(c.name) : String(c.company_id),
        global_share: (c.visibility_window_pct != null ? Number(c.visibility_window_pct) : null)
      };
    });
    var byId = {}, daySet = {};
    series.forEach(function(p){
      if (!p) return;
      var raw = (p.company_id != null) ? p.company_id : (p.id != null) ? p.id : "";
      var id = String(raw);
      if (!id) return;
      var day = String(p.day);
      daySet[day] = true;
      var v = (p.visibility_pct != null) ? Number(p.visibility_pct) : (p.share_pct != null ? Number(p.share_pct) : 0);
      (byId[id] = byId[id] || {})[day] = v || 0;
    });
    var labels = Object.keys(daySet).sort();
    var ids = Object.keys(byId);
    ids.forEach(function(id){
      if (!metaMap[id]) metaMap[id] = { color:null, favicon:"", name:id, global_share:null };
      if (metaMap[id].global_share == null){
        var vals = labels.map(function(d){ return byId[id][d]; }).filter(function(v){ return v != null; });
        metaMap[id].global_share = vals.length ? (vals.reduce(function(a,b){ return a+b; },0)/vals.length) : 0;
      }
    });
    ids.sort(function(a,b){ return (metaMap[b].global_share||0) - (metaMap[a].global_share||0); });
    ids = ids.slice(0, 7);
    var PALETTE = ["#14b8a6","#0ea5e9","#6366f1","#d946ef","#f97316","#f43f5e","#64748b"];
    var globalMax = 0;
    var datasets = ids.map(function(id, i){
      var data = labels.map(function(d){ var v = byId[id][d]; if (v != null && v > globalMax) globalMax = v; return v != null ? v : null; });
      var col = metaMap[id].color || PALETTE[i % PALETTE.length];
      return {
        label: metaMap[id].name,
        __id: id,
        __globalShare: metaMap[id].global_share,
        __favicon: metaMap[id].favicon,
        __baseColor: col,
        data: data,
        borderColor: col
      };
    });
    return { labels: labels, datasets: datasets, globalMax: globalMax };
  }

  /* ================= skeletons ================= */
  function lineSkeletonHtml(){
    var hlines = new Array(4).join("x").split("x").map(function(){ return '<div class="sk-lc-hline"></div>'; }).join("");
    var xlabels = new Array(6).join("x").split("x").map(function(){ return '<div class="sk-lc-xlabel"></div>'; }).join("");
    var d = "M0,125 C60,115 100,70 150,58 C200,46 230,90 280,74 C330,58 390,22 460,14";
    var agId = 'vc-sk-ag-' + Math.random().toString(36).slice(2);
    return '<div class="vc-line-sk"><div class="sk-linechart">' +
      '<div class="sk-lc-grid">' + hlines +
        '<svg class="sk-lc-svg" viewBox="0 0 460 160" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
          '<defs><linearGradient id="' + agId + '" x1="0" y1="0" x2="0" y2="1"><stop class="sk-lc-astop0" offset="0%"/><stop class="sk-lc-astop1" offset="100%"/></linearGradient></defs>' +
          '<path d="' + d + ' L460,160 L0,160 Z" fill="url(#' + agId + ')"/>' +
          '<path class="sk-lc-stroke" d="' + d + '"/>' +
          '<path class="sk-lc-shimmer-path" d="' + d + '"/>' +
        '</svg>' +
      '</div>' +
      '<div class="sk-lc-xaxis">' + xlabels + '</div>' +
    '</div></div>';
  }

  /* ================= line legend (balanced rows) ================= */
  var LEG_MIN_GAP = 8, LEG_MAX_GAP = 16;
  function legGetColumnGap(w){ return Math.max(LEG_MIN_GAP, Math.min(LEG_MAX_GAP, Math.floor(w * 0.025))); }
  function legNormalizeUrl(url){ if (!url) return ""; if (url.indexOf("//") === 0) return "https:" + url; return url; }
  function legItemHtml(c, measure){
    return '<div class="up-company-item' + (measure ? ' up-measure-item' : '') + '" data-company-id="' + esc(c.company_id) + '">' +
        '<span class="up-company-color" style="background:' + esc(c.color || "#999999") + '"></span>' +
        '<span class="up-company-inner-gap"></span>' +
        (c.favicon_url ? '<img class="up-company-favicon" src="' + esc(legNormalizeUrl(c.favicon_url)) + '" alt="" onerror="this.style.visibility=\'hidden\'">' : '<span class="up-company-favicon" style="visibility:hidden"></span>') +
        '<span class="up-company-inner-gap"></span>' +
        '<span class="up-company-name">' + esc(c.name) + '</span>' +
      '</div>';
  }
  function legRowWidth(widths, start, end, gap){ var total = 0; for (var i = start; i < end; i++){ total += widths[i]; if (i > start) total += gap; } return total; }
  function legGreedyRowCount(widths, cw, gap){
    var rows = 1, cur = 0;
    for (var i = 0; i < widths.length; i++){
      var next = cur === 0 ? widths[i] : cur + gap + widths[i];
      if (cur > 0 && next > cw){ rows++; cur = widths[i]; } else { cur = next; }
    }
    return rows;
  }
  function legBalancedBreaks(widths, rowCount, cw, gap){
    var n = widths.length;
    if (rowCount <= 1 || n <= 1) return [];
    var dp = [], prev = [];
    for (var r = 0; r <= rowCount; r++){ dp.push(new Array(n + 1).fill(Infinity)); prev.push(new Array(n + 1).fill(-1)); }
    dp[0][0] = 0;
    for (var r2 = 1; r2 <= rowCount; r2++){
      for (var i = 1; i <= n; i++){
        for (var k = r2 - 1; k < i; k++){
          var w = legRowWidth(widths, k, i, gap);
          if (w > cw) continue;
          var score = Math.max(dp[r2 - 1][k], w);
          if (score < dp[r2][i]){ dp[r2][i] = score; prev[r2][i] = k; }
        }
      }
    }
    if (!isFinite(dp[rowCount][n])) return [];
    var breaks = [], ii = n;
    for (var r3 = rowCount; r3 > 1; r3--){ var kk = prev[r3][ii]; if (kk <= 0) break; breaks.unshift(kk); ii = kk; }
    return breaks;
  }
  function getPageWidth(){
    try { if (window.top && window.top.innerWidth) return window.top.innerWidth; } catch(e){}
    return window.innerWidth || document.documentElement.clientWidth || 0;
  }

  /* ================= controller ================= */
  function makeController(root){
    var tableEl = root.querySelector(".vt-table");
    var lineWrap = root.querySelector(".vc-line-wrap");
    var lineCanvas = root.querySelector(".vc-line-canvas");
    var legendEl = root.querySelector(".vc-legend");
    if (!tableEl || !lineWrap || !lineCanvas){
      return null;
    }

    var instanceId = root.getAttribute("data-instance") || "default";
    var myCtrlId = "cc_" + Math.random().toString(36).slice(2) + "_" + Date.now();
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
    var chartInstance = null, lineChart = null;
    var SORT_STORE = (window.__votSort = window.__votSort || {});
    var sortField = (SORT_STORE[instanceId] && SORT_STORE[instanceId].field) || "visibility";
    var sortDir = (SORT_STORE[instanceId] && SORT_STORE[instanceId].dir) || "desc";

    var GRAN_STORE = (window.__votGran = window.__votGran || {});
    var GRAN_PICKED = (window.__votGranPicked = window.__votGranPicked || {});
    var INIT_COMPANIES = (window.__votInitCompanies = window.__votInitCompanies || {});
    var curGran = (GRAN_STORE[instanceId] === "week" || GRAN_STORE[instanceId] === "month") ? GRAN_STORE[instanceId] : "day";
    function seriesRangeDays(){
      var days = [];
      (state.series || []).forEach(function(p){ if (p && p.day != null) days.push(String(p.day)); });
      if (!days.length) return 0;
      days.sort();
      var a = Date.parse(days[0]), b = Date.parse(days[days.length - 1]);
      if (isNaN(a) || isNaN(b)) return days.length;
      return Math.round((b - a) / 86400000) + 1;
    }
    function normGran(v){
      v = String(v == null ? "" : v).toLowerCase().trim();
      if (v.indexOf("month") === 0 || v === "mon" || v === "m") return "month";
      if (v.indexOf("week") === 0 || v === "w") return "week";
      if (v.indexOf("day") === 0 || v === "daily" || v === "d") return "day";
      return null;
    }
    function inferGran(series){
      var seen = {};
      (series || []).forEach(function(p){ if (p && p.day != null) seen[String(p.day)] = 1; });
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
    function applyGranAvailability(){
      var r = seriesRangeDays();
      var btns = granBtnsLive();
      btns.forEach(function(bn){
        var g = bn.getAttribute("data-gran");
        var dis = (g === "week" && r > 0 && r < 8) || (g === "month" && r > 0 && r < 31);
        bn.classList.toggle("is-disabled", dis);
        if (dis) bn.setAttribute("aria-disabled", "true"); else bn.removeAttribute("aria-disabled");
      });
      var activeBtn = btns.filter(function(bn){ return bn.getAttribute("data-gran") === curGran; })[0];
      if (activeBtn && activeBtn.classList.contains("is-disabled")){ curGran = "day"; GRAN_STORE[instanceId] = "day"; syncGranActive(); }
    }

    function themeColors(){
      return isDark
        ? { text:"#e0e0e0", muted:"#a0a0a0", border:"#353535", bg:"#1b1b1b" }
        : { text:"#1f1f1b", muted:"#6f737c", border:"#e0e2e6", bg:"#ffffff" };
    }
    function setHeading(){ /* headings are static ("Visibility over Time" / "Top Brands") */ }
    function syncTheme(){
      if (isDark){ root.setAttribute("data-theme","dark"); }
      else { root.removeAttribute("data-theme"); }
      if (typeof syncPortalTheme === "function") syncPortalTheme();
    }

    /* ---------- line legend ---------- */
    var legendCompanies = [];
    function buildLegendCompanies(datasets){
      return (datasets || []).map(function(ds){
        return { company_id: ds.__id, name: ds.label, color: ds.__baseColor, favicon_url: ds.__favicon };
      });
    }
    function legendLayout(){
      if (!legendEl) return;
      if (getPageWidth() < 500){ legendEl.classList.add("is-hidden"); return; }
      legendEl.classList.remove("is-hidden");
      var rowsC = legendEl.querySelector(".up-company-rows");
      var measure = Array.prototype.slice.call(legendEl.querySelectorAll(".up-measure-item"));
      if (!rowsC || !measure.length) return;
      var cw = legendEl.clientWidth;
      if (!cw){ setTimeout(legendLayout, 100); return; }
      var gap = legGetColumnGap(cw);
      legendEl.style.setProperty("--up-column-gap", gap + "px");
      var widths = measure.map(function(it){ return it.getBoundingClientRect().width; });
      var rowCount = legGreedyRowCount(widths, cw, gap);
      rowCount = Math.max(1, Math.min(rowCount, legendCompanies.length, 2));
      var breaks = legBalancedBreaks(widths, rowCount, cw, gap);
      if (rowCount === 2 && !breaks.length) breaks = [Math.ceil(legendCompanies.length / 2)];
      var rows = [], start = 0;
      for (var b = 0; b < breaks.length; b++){ rows.push(legendCompanies.slice(start, breaks[b])); start = breaks[b]; }
      rows.push(legendCompanies.slice(start));
      rowsC.innerHTML = rows.map(function(row){
        return '<div class="up-company-row">' + row.map(function(c){ return legItemHtml(c, false); }).join("") + '</div>';
      }).join("");
    }
    function renderLegend(datasets){
      if (!legendEl) return;
      legendCompanies = buildLegendCompanies(datasets);
      if (!legendCompanies.length){ legendEl.innerHTML = ""; return; }
      legendEl.innerHTML =
        '<div class="up-company-measure">' + legendCompanies.map(function(c){ return legItemHtml(c, true); }).join("") + '</div>' +
        '<div class="up-company-rows"></div>';
      legendLayout();
    }
    function clearLegend(){ if (legendEl){ legendCompanies = []; legendEl.innerHTML = ""; } }

    function applyHighlight(id){
      if (lineChart && lineChart.__activeId !== id){
        lineChart.__activeId = id;
        var dim = isDark ? "rgba(160,160,160,0.20)" : "rgba(120,123,124,0.22)";
        lineChart.data.datasets.forEach(function(ds){
          ds.borderColor = (id == null || ds.__id === id) ? ds.__baseColor : dim;
        });
        lineChart.update("highlight");
      }
      if (legendEl){
        var items = legendEl.querySelectorAll(".up-company-item");
        for (var i=0;i<items.length;i++){
          var cid = items[i].getAttribute("data-company-id");
          items[i].style.opacity = (id == null || cid === id) ? "1" : "0.35";
        }
      }
    }
    if (legendEl && legendEl.getAttribute("data-vc-hoverbound") !== "1"){
      legendEl.setAttribute("data-vc-hoverbound", "1");
      legendEl.addEventListener("mouseover", function(e){
        var it = e.target && e.target.closest ? e.target.closest(".up-company-item") : null;
        if (it) applyHighlight(it.getAttribute("data-company-id"));
      });
      legendEl.addEventListener("mouseleave", function(){ applyHighlight(null); });
    }

    /* ---------- line render ---------- */
    function destroyLine(){
      if (lineChart){ try { lineChart.destroy(); } catch(e){} lineChart = null; }
      if (window.Chart && window.Chart.getChart){ var ex = window.Chart.getChart(lineCanvas); if (ex) try{ ex.destroy(); }catch(e){} }
      /* The external tooltip is a plain DOM element outside Chart.js's own lifecycle — destroying
         the chart stops the callback that would otherwise set its opacity back to 0, so a tooltip
         left visible from a hover right before a reload/skeleton would stay stuck on screen. */
      var tt = lineWrap.querySelector(".vc-line-tt");
      if (tt) tt.style.opacity = "0";
    }
    function clearLineExtras(){ var sk = lineWrap.querySelector(".vc-line-sk"); if (sk) sk.remove(); var em = lineWrap.querySelector(".vc-line-empty"); if (em) em.remove(); }
    function showLineSkeleton(){ destroyLine(); clearLineExtras(); clearLegend(); lineWrap.insertAdjacentHTML("beforeend", lineSkeletonHtml()); }

    function renderLine(){
      if (root.__votController && root.__votController.__ctrlId !== myCtrlId){
        return;
      }
      clearLineExtras();
      var built = buildLineDatasets(state.series, state.companies || []);
      if (!built.datasets.length){
        destroyLine(); clearLegend();
        lineWrap.insertAdjacentHTML("beforeend", '<div class="vc-line-empty">No data</div>');
        return;
      }
      var visDs = built.datasets;
      renderLegend(visDs);
      loadChartJs().then(function(){
        if (root.__votController && root.__votController.__ctrlId !== myCtrlId){
          return;
        }
        if (!lineCanvas) return;

        function buildChart(){
          if (root.__votController && root.__votController.__ctrlId !== myCtrlId){
            return;
          }
          if (!lineCanvas || !lineCanvas.isConnected) return;
          destroyLine();
          var tc = themeColors();
          var ctx = lineCanvas.getContext("2d");
          window.Chart.defaults.color = tc.muted;
          window.Chart.defaults.font = { family: "Geist, system-ui, -apple-system, Segoe UI, Roboto, Arial", size: 12 };
          var single = built.labels.length <= 1;
          visDs.forEach(function(ds){
            ds.borderWidth = LINE_WIDTH; ds.fill = false; ds.cubicInterpolationMode = "monotone"; ds.tension = LINE_TENSION;
            ds.pointRadius = single ? 4 : 0; ds.pointHoverRadius = LINE_POINT_HOVER; ds.pointHitRadius = LINE_POINT_HIT;
            ds.pointBorderWidth = LINE_POINT_BORDER; ds.pointBackgroundColor = tc.bg; ds.pointBorderColor = ds.__baseColor;
            ds.pointHoverBackgroundColor = tc.bg; ds.pointHoverBorderColor = ds.__baseColor;
            if (single){ ds.pointBackgroundColor = ds.__baseColor; }
            ds.spanGaps = true; ds.clip = 8;
          });
          var visMax = 0; visDs.forEach(function(ds){ (ds.data || []).forEach(function(v){ if (v != null && v > visMax) visMax = v; }); });
          var yMax = visMax * Y_PAD; if (yMax <= 0) yMax = 1; if (yMax > 100) yMax = 100;
          var labels = built.labels;
          try {
            lineChart = new window.Chart(ctx, {
              type: "line",
              data: { labels: labels, datasets: visDs },
              plugins: [hoverLinePlugin, dashedYGridPlugin],
              options: {
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 600, easing: "easeOutQuart" },
                /* named transition used by applyHighlight()'s update("highlight") — a smooth 200ms
                   fade for the row/legend cross-highlight, separate from the slower initial draw-in. */
                transitions: { highlight: { animation: { duration: 200, easing: "easeOutQuad" } } },
                interaction: { mode: "index", intersect: false },
                layout: { padding: { top: 8, right: 2, bottom: 0, left: 0 } },
                plugins: { legend: { display:false }, tooltip: { enabled:false, external: makeLineTooltip(lineWrap) } },
                scales: {
                  x: { grid: { display:false }, offset: single, border: { display:true, color: tc.border, width:1 },
                       ticks: { autoSkip:true, maxTicksLimit:X_MAX_TICKS, maxRotation:0, color: tc.muted,
                                callback: function(v, i){
                                  var lab = String(labels[i] || "");
                                  if (curGran === "month"){
                                    var m = lab.match(/^(\d{4})-(\d{2})/);
                                    if (m) return MONTHS_DE[parseInt(m[2],10) - 1] || lab;
                                  }
                                  return lab.slice(5);
                                } } },
                  y: { min:0, max:yMax, beginAtZero:true,
                       afterBuildTicks: function(scale){ var m = scale.max || 1; scale.ticks = [{value:0},{value:m/3},{value:2*m/3},{value:m}]; },
                       ticks: { color: tc.muted, callback: function(v){ return Math.round(v) + "%"; } },
                       grid: { display:false }, border: { display:false } }
                },
                elements: { point: { radius: 0 } }
              }
            });
            lineChart.$ccGridColor = tc.border;
            lineChart.$ccHoverLineColor = tc.border;
            lineChart.__curGran = curGran;
          } catch(err){
          }
        }

        /* Chart.js reads the canvas's live layout to compute where the entrance animation starts
           from, so it needs a container with real, settled dimensions at creation time — not just
           "attached to the DOM". Two situations defeat that:
           1) Chart.js was already loaded (cached from a prior mount) and this .then() runs as an
              immediate microtask, before the browser has laid out a freshly re-inserted widget
              (e.g. navigating back to a dashboard that rebuilds the DOM subtree) — a short wait
              fixes this, since the container genuinely has a size once layout catches up.
           2) The root is fed data while sitting inside a Bubble element that's hidden via
              display:none (a popup/group not yet shown) — the container reports 0x0 no matter how
              long you wait, since display:none never gets a box. Building the chart against that
              collapsed geometry, then having Chart.js's own resize observer redraw it once the
              group becomes visible, replays as the points flying in from that collapsed (0,0)
              corner instead of growing up from the baseline.
           Deliberately setInterval, not requestAnimationFrame or ResizeObserver: both of those are
           tied to the rendering/compositor pipeline, which browsers pause or heavily throttle for a
           backgrounded or inactive tab — exactly when a Bubble popup is likely to sit hidden for a
           while before the user opens it, so either would risk stalling indefinitely. setInterval
           keeps ticking (throttled, but not paused) regardless of tab visibility, matching this
           file's other wait-for-Bubble-to-catch-up loops (initAll's retry cascade, the watermark's
           injection interval). */
        if (lineWrap.clientWidth > 0 && lineWrap.clientHeight > 0){
          buildChart();
        } else {
          var __sizeTicks = 0;
          var __sizeIv = setInterval(function(){
            if (root.__votController && root.__votController.__ctrlId !== myCtrlId){
              clearInterval(__sizeIv); return;
            }
            if (!lineCanvas || !lineCanvas.isConnected){ clearInterval(__sizeIv); return; }
            var sized = lineWrap.clientWidth > 0 && lineWrap.clientHeight > 0;
            if (sized || ++__sizeTicks > 600){   // ~2 min cap — give up and build anyway past that
              clearInterval(__sizeIv);
              buildChart();
            }
          }, 200);
        }
      }).catch(function(err){
      });
    }

    /* ---------- render (two independent halves) ---------- */
    function tableHeadHtml(){
      return '<div class="vt-thead">' +
        '<div class="vt-th vt-th-idx"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg></div>' +
        '<div class="vt-th">Brand</div>' +
        '<div class="vt-th vt-th-visibility">Visibility<span class="vt-th-info" data-explain="visibility"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span></div>' +
        '<div class="vt-th vt-th-ranking">Ranking<span class="vt-th-info" data-explain="ranking"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span></div>' +
        '<div class="vt-th vt-th-sentiment">Sentiment<span class="vt-th-info" data-explain="sentiment"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span></div></div>';
    }
    function tableSkeletonHtml(){
      var rows = "";
      for (var i = 0; i < 7; i++){
        rows += '<div class="vt-row vt-tsk">' +
          '<div class="vt-td vt-td-idx"><span class="vt-tsk-bar" style="width:12px"></span></div>' +
          '<div class="vt-td"><span class="vt-tsk-logo"></span><span class="vt-tsk-bar" style="width:' + (70 + (i % 3) * 18) + 'px"></span></div>' +
          '<div class="vt-td"><span class="vt-tsk-bar" style="width:46px"></span></div>' +
          '<div class="vt-td"><span class="vt-tsk-bar" style="width:52px"></span></div>' +
          '<div class="vt-td"><span class="vt-tsk-bar" style="width:56px"></span></div>' +
        '</div>';
      }
      return tableHeadHtml() + '<div class="vt-tbody">' + rows + '</div>';
    }
    function renderTableSide(){
      if (root.__votController && root.__votController.__ctrlId !== myCtrlId){ return; }
      if (state.loading || !state.hasTable){ tableEl.innerHTML = tableSkeletonHtml(); }
      else { renderTable(); }
    }
    function renderLineSide(){
      if (root.__votController && root.__votController.__ctrlId !== myCtrlId){
        return;
      }
      if (state.loading || !state.hasLine || state.linePending){
        showLineSkeleton(); return;
      }
      renderLine();
      verifyLineRendered();
    }
    function verifyLineRendered(){
      clearTimeout(root.__votLineVerifyT);
      var attempts = 0;
      function check(){
        if (root.__votController && root.__votController.__ctrlId !== myCtrlId) return;
        if (state.loading || !state.hasLine || state.linePending) return;
        var alive = false;
        try { alive = !!(window.Chart && window.Chart.getChart && lineCanvas && window.Chart.getChart(lineCanvas)); } catch(e){}
        if (alive || lineWrap.querySelector(".vc-line-empty")){
          return;
        }
        if (attempts++ >= 12) return;
        renderLine();
        root.__votLineVerifyT = setTimeout(check, 250);
      }
      root.__votLineVerifyT = setTimeout(check, 400);
    }
    function render(){
      if (root.__votController && root.__votController.__ctrlId !== myCtrlId) return;
      syncTheme();
      setHeading();
      setHeadCount();
      renderTableSide();
      renderLineSide();
      syncGranActive();
      syncFilterBadge();
    }

    /* ---------- Top Brands table ---------- */
    var TREND_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>';
    var TREND_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17"></line><polyline points="17 7 17 17 7 17"></polyline></svg>';
    var HASH_ICON = '<svg class="vt-hash" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>';
    function trendChip(delta, decimals, inverted, suffix){
      if (delta == null || delta === "") return "";
      var d = Number(delta);
      if (!isFinite(d)) return "";
      var shown = decimals ? Math.round(Math.abs(d) * 10) / 10 : Math.round(Math.abs(d));
      if (shown === 0) return "";
      var goingUp = d > 0;
      var positive = inverted ? !goingUp : goingUp;
      var cls = positive ? "pos" : "neg";
      var icon = goingUp ? TREND_UP : TREND_DOWN;
      var txt = (decimals ? shown.toFixed(1) : String(shown)) + (suffix || "");
      return '<span class="vt-trend ' + cls + '">' + icon + txt + '</span>';
    }
    function sentColor(v){
      v = Number(v);
      if (v <= 25) return "#D25D5D";
      if (v <= 40) return "#D2865D";
      if (v <= 60) return "#9E9E9E";
      if (v <= 75) return "#9FD25D";
      return "#60D25D";
    }
    var ROW_GOTO = '<span class="vt-row-goto"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg></span>';
    function renderTable(){
      var rows = Array.isArray(state.tableRows) ? state.tableRows : [];
      var head = tableHeadHtml();
      if (!rows.length){ tableEl.innerHTML = head + '<div class="vt-empty">No data</div>'; return; }
      var body = rows.map(function(r, i){
        var pos = (r.position != null) ? Number(r.position) : null;
        var isLast = (i === rows.length - 1);
        var gap = (isLast && pos != null && pos > 7) ? " vt-gap" : "";
        var logo = r.logo_url
          ? '<span class="vt-logo-box"><img src="' + esc(r.logo_url) + '" onerror="this.style.visibility=\'hidden\'"/></span>'
          : '<span class="vt-logo-box"></span>';
        var visNull = (r.visibility_pct == null || r.visibility_pct === "");
        var vis = '<span class="vt-num">' + (visNull ? "–" : (Math.round(Number(r.visibility_pct) || 0) + "%")) + '</span>' + trendChip(r.visibility_delta_pct, false, false, "%");
        var rank = '<span class="vt-rank-group">' + HASH_ICON + '<span class="vt-num">' + fmt1(r.avg_rank) + '</span></span>' + trendChip(r.avg_rank_delta, true, true);
        var sentNull = (r.sentiment == null || r.sentiment === "" || !isFinite(Number(r.sentiment)));
        var sc = sentNull ? "#9E9E9E" : sentColor(r.sentiment);
        var sent = '<span class="vt-sent"><span class="vt-sent-dot" style="background:' + sc + '"></span><span class="vt-sent-val">' + (sentNull ? "–" : Math.round(Number(r.sentiment))) + '</span></span>' + trendChip(r.sentiment_delta, true, false);
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
        row.addEventListener("mouseenter", function(){ applyHighlight(id); });
        row.addEventListener("mouseleave", function(){ applyHighlight(null); });
        row.addEventListener("click", function(){
          var fnName = root.getAttribute("data-rowclick-fn") || "bubble_fn_votRowClick";
          var fn = resolveBubbleFn(fnName);
          if (typeof fn === "function"){ try { fn(id); } catch(e){} }
        });
      });
      checkBrandWidth();
    }
    function checkTrendFit(){
      if (checkTrendFit.__busy) return;
      checkTrendFit.__busy = true;
      var hadHide = tableEl.classList.contains("vt-hide-trend");
      if (hadHide) tableEl.classList.remove("vt-hide-trend");
      var cells = tableEl.querySelectorAll(".vt-td-visibility, .vt-td-ranking, .vt-td-sentiment");
      var tooTight = false;
      for (var i = 0; i < cells.length; i++){
        var c = cells[i];
        if (getComputedStyle(c).display === "none") continue;
        var trend = c.querySelector(".vt-trend");
        if (!trend) continue;
        var cRect = c.getBoundingClientRect();
        var tRect = trend.getBoundingClientRect();
        var clearance = cRect.right - tRect.right;
        if (clearance < 8){ tooTight = true; break; }
      }
      tableEl.classList.toggle("vt-hide-trend", tooTight);
      checkTrendFit.__busy = false;
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
      if (state.totalCount != null && state.totalCount !== ""){ cn.textContent = state.totalCount; hr.classList.add("has-count"); }
      else { hr.classList.remove("has-count"); }
    }

    /* ---------- column explainers (Visibility / Ranking / Sentiment) — NEW, matches the
       urls-table/domains-table .up-explain pattern; not a shared UpstreemCore function there
       either, so this follows the same per-component convention rather than inventing one. ---------- */
    var explain = document.createElement("div");
    explain.className = "up-explain";
    document.body.appendChild(explain);
    var EXPLAIN_TEXT = {
      visibility: { h: "Visibility",
        t: "How often this brand appears in AI answers for the tracked prompts, plus the change against the previous period." },
      ranking: { h: "Ranking",
        t: "This brand's average position among all brands mentioned, plus the change against the previous period. A lower number is better." },
      sentiment: { h: "Sentiment",
        t: "How positively this brand is described when it's mentioned, plus the change against the previous period." }
    };
    function explainVisual(kind){
      if (kind === "ranking"){
        return '<span class="vot-explain-row">' + HASH_ICON + '<span>2.3</span></span>';
      }
      if (kind === "sentiment"){
        return ["#D25D5D","#9E9E9E","#60D25D"].map(function(c){
          return '<span class="vot-explain-dot" style="background:' + c + '22;color:' + c + '"></span>';
        }).join("");
      }
      return '<span class="vot-explain-row">18.4%' +
             '<span class="vot-explain-up">' + TREND_UP + '</span>' +
             '<span class="vot-explain-up">2.9%</span></span>';
    }
    function showExplain(el){
      var kind = el.getAttribute("data-explain");
      var info = EXPLAIN_TEXT[kind];
      if (!info) return;
      explain.setAttribute("data-theme", isDark ? "dark" : "light");
      explain.innerHTML =
        '<div class="vot-explain-vis">' + explainVisual(kind) + '</div>' +
        '<div class="vot-explain-h">' + esc(info.h) + '</div>' +
        '<div class="vot-explain-t">' + esc(info.t) + '</div>';
      explain.classList.add("is-on");
      var r = el.getBoundingClientRect();
      var er = explain.getBoundingClientRect();
      var iconCenter = r.left + r.width / 2;
      var left = Math.max(8, Math.min(window.innerWidth - er.width - 8, iconCenter - er.width/2));
      var flipped = false;
      var top = r.bottom + 10;
      if (top + er.height > window.innerHeight - 8){ top = Math.max(8, r.top - er.height - 10); flipped = true; }
      explain.classList.toggle("is-flipped", flipped);
      explain.style.left = left + "px";
      explain.style.top = top + "px";
      var caret = Math.max(14, Math.min(er.width - 14, iconCenter - left));
      explain.style.setProperty("--up-caret", caret + "px");
    }
    function hideExplain(){ explain.classList.remove("is-on"); }
    root.addEventListener("mouseover", function(e){
      var el = e.target.closest(".vt-th-info");
      if (el && root.contains(el)) showExplain(el);
    });
    root.addEventListener("mouseout", function(e){
      if (e.target.closest(".vt-th-info")) hideExplain();
    });

    var inner = root;
    var gotoBtn = root.querySelector(".vot-goto");
    var exportBtn = root.querySelector(".vot-export");

    /* ---------- popovers: Sort stays non-portaled (untouched); Companies is portaled (core) ---------- */
    var sortWrap = root.querySelector(".vot-sort");
    var filterWrap = root.querySelector(".vot-filter");
    var filterBtn = root.querySelector(".vot-filter-btn");
    var filterMenu = root.querySelector(".up-ment-menu");
    var sortMenu = root.querySelector(".vot-sort-menu");
    /* body-portal for the Companies dropdown only (core) — Sort keeps its original
       position:absolute popover, untouched per the migration scope. */
    var _portal = UpstreemCore.makePortal(root, [filterMenu], instanceId);
    var portalLayer = _portal.portalLayer, syncPortalTheme = _portal.syncPortalTheme;

    function setPopOpen(pop, open){
      if (!pop) return;
      var isFilter = pop === filterWrap;
      var menu = isFilter ? filterMenu : sortMenu;
      if (!open && menu && menu.contains(document.activeElement)){
        var opener = pop.querySelector(".vot-sort-btn, .vot-filter-btn");
        try { opener ? opener.focus({ preventScroll: true }) : document.activeElement.blur(); }
        catch(e){ try { document.activeElement.blur(); } catch(e2){} }
      }
      pop.classList.toggle("is-open", !!open);
      if (menu){
        menu.setAttribute("aria-hidden", open ? "false" : "true");
        if (isFilter){
          menu.classList.toggle("is-shown", !!open);
          if (open) UpstreemCore.placeMenu(menu, filterBtn);
        }
      }
    }
    function closePops(except){
      [sortWrap, filterWrap].forEach(function(pop){
        if (!pop || pop === except || !pop.classList.contains("is-open")) return;
        setPopOpen(pop, false);
      });
    }

    // Mira-style button tooltip — kept as this component's own implementation (see
    // visibility-chart.css header comment for why this isn't UpstreemCore.makeTooltips).
    if (!root.__votTip){
      var tipEl = document.createElement("div"); tipEl.className = "vot-tip"; document.body.appendChild(tipEl);
      root.__votTip = tipEl;
      var tipTimer = null, tipSuppressed = false;
      var themeTip = function(){
        var dark = root.getAttribute("data-theme") === "dark";
        tipEl.style.background = dark ? "#f0f0f0" : "#1f1f1b";
        tipEl.style.color = dark ? "#1f1f1b" : "#ffffff";
      };
      var showTip = function(btn){
        if (tipSuppressed) return;
        var txt = btn.getAttribute("data-tip"); if (!txt) return;
        tipEl.textContent = txt; themeTip();
        tipEl.classList.add("show");
        var br = btn.getBoundingClientRect();
        var tw = tipEl.offsetWidth, vw = window.innerWidth || document.documentElement.clientWidth;
        var left = br.left + br.width / 2 - tw / 2;
        left = Math.max(6, Math.min(left, vw - tw - 6));
        tipEl.style.left = left + "px";
        tipEl.style.top = (br.bottom + 8) + "px";
      };
      var hideTip = function(){ clearTimeout(tipTimer); tipEl.classList.remove("show"); };
      Array.prototype.slice.call(root.querySelectorAll("[data-tip]")).forEach(function(btn){
        btn.addEventListener("mouseenter", function(){ tipSuppressed = false; clearTimeout(tipTimer); tipTimer = setTimeout(function(){ showTip(btn); }, 60); });
        btn.addEventListener("mouseleave", function(){ tipSuppressed = false; hideTip(); });
        btn.addEventListener("mousedown", function(){ tipSuppressed = true; hideTip(); });
        btn.addEventListener("click", function(){ tipSuppressed = true; hideTip(); });
      });
    }

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
          '<button class="up-ment-searchclear" type="button" aria-label="Clear company search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
        '</div>';
      var items = list.map(function(c){
        var id = String(c.company_id);
        var checked = !!filterSel[id];
        var disabled = !checked && atMax;
        var nm = String(c.name || id);
        var fav = c.favicon_url || c.logo_url || c.favicon || c.logo || "";
        var logo = fav
          ? '<span class="up-ment-logo"><img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.style.visibility=\'hidden\'"/></span>'
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
      var fnName = root.getAttribute("data-submit-fn") || "bubble_fn_votSubmitCompanies";
      var fn = resolveBubbleFn(fnName);
      if (typeof fn === "function"){ try { fn(payload); } catch(e){} }
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
    var sortBtn = root.querySelector(".vot-sort-btn");
    function fireSort(){
      var fnName = root.getAttribute("data-sort-fn") || "bubble_fn_votSortTable";
      var fn = resolveBubbleFn(fnName);
      var outField = SORT_OUT_FIELD[sortField] || sortField;
      if (typeof fn === "function"){ try { fn(outField + "_" + sortDir); } catch(e){} }
    }
    function populateSort(){
      if (!sortMenu) return;
      var opts = SORT_LABELS.map(function(o){
        return '<div class="vot-pop-opt ' + (sortField === o[0] ? "is-active" : "") + '" data-field="' + o[0] + '">' + o[1] +
          '<svg class="vot-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>';
      }).join("");
      sortMenu.innerHTML = '<div class="vot-pop-head">Sort by</div>' + opts +
        '<div class="vot-pop-div"></div>' +
        '<div class="vot-pop-row"><span class="vot-pop-label">Descending</span><span class="up-switch ' + (sortDir === "desc" ? "is-on" : "") + '"></span></div>';
      Array.prototype.slice.call(sortMenu.querySelectorAll(".vot-pop-opt")).forEach(function(op){
        op.addEventListener("click", function(e){ e.stopPropagation(); sortField = op.getAttribute("data-field"); SORT_STORE[instanceId] = { field: sortField, dir: sortDir }; populateSort(); fireSort(); });
      });
      var sw = sortMenu.querySelector(".up-switch");
      if (sw) sw.addEventListener("click", function(e){ e.stopPropagation(); sortDir = (sortDir === "desc" ? "asc" : "desc"); SORT_STORE[instanceId] = { field: sortField, dir: sortDir }; populateSort(); fireSort(); });
    }
    populateSort();
    if (sortWrap && !sortWrap.__votOutsideBound){
      sortWrap.__votOutsideBound = true;
      document.addEventListener("click", function(e){ if (sortWrap && !sortWrap.contains(e.target)) setPopOpen(sortWrap, false); });
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
          var gFnName = root.getAttribute("data-gran-fn") || "bubble_fn_votGranularity";
          var gFn = resolveBubbleFn(gFnName);
          if (typeof gFn === "function"){ try { gFn(g); } catch(err){} }
          return;
        }
        if (e.target.closest(".vot-maximize")){
          root.classList.toggle("is-max");
          setTimeout(function(){
            try { if (chartInstance) chartInstance.resize(); } catch(err){}
            try { if (lineChart) lineChart.resize(); } catch(err){}
          }, 60);
          return;
        }
        if (e.target.closest(".vot-goto")){
          var goFnName = root.getAttribute("data-goto-fn") || "bubble_fn_votGoTo";
          var goFn = resolveBubbleFn(goFnName);
          if (typeof goFn === "function"){ try { goFn(instanceId); } catch(err){} }
          return;
        }
        if (e.target.closest(".vot-export")){
          var exFnName = root.getAttribute("data-export-fn") || "bubble_fn_votExportTable";
          var exFn = resolveBubbleFn(exFnName);
          if (typeof exFn === "function"){ try { exFn(instanceId); } catch(err){} }
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
      root.classList.toggle("vc-narrow-page", getPageWidth() < 500);
      checkBrandWidth();
      clearTimeout(root.__votRespT);
      root.__votRespT = setTimeout(function(){
        try { if (chartInstance) chartInstance.resize(); } catch(e){}
        try { if (lineChart) lineChart.resize(); } catch(e){}
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
          if (typeof syncPortalTheme === "function") syncPortalTheme();
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
          root.__votLegRaf = requestAnimationFrame(function(){ root.__votLegRaf = null; legendLayout(); });
        }).observe(legendEl);
      }
    }
    window.addEventListener("resize", function(){
      if (root.__votWinRaf) return;
      root.__votWinRaf = requestAnimationFrame(function(){ root.__votWinRaf = null; legendLayout(); applyResponsive(); });
    });

    applyResponsive();
    render();

    return {
      __ctrlId: myCtrlId,
      reset: function(){
        /* Restore + actually notify Bubble, the same way the in-dropdown Reset button and the
           Sort dropdown do — so the external "reset this instance" Run JavaScript step visibly
           puts sort back to Visibility Descending and companies back to the default set, instead
           of only clearing local flags ahead of a fill that may never come. */
        sortField = "visibility";
        sortDir = "desc";
        SORT_STORE[instanceId] = { field: sortField, dir: sortDir };
        populateSort();
        fireSort();

        var initIds = INIT_COMPANIES[instanceId] || activeCompanyIds();
        filterSel = {};
        initIds.forEach(function(id){ filterSel[id] = true; });
        populateFilter();
        fireCompaniesSubmit();
        delete USER_FILTERED[instanceId];   // after fireCompaniesSubmit, which would set it
        delete INIT_COMPANIES[instanceId];  // next fill re-captures it fresh, like a first load
        syncFilterBadge();
        return true;
      },
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          isDark = isYes(params.isDark);
          if (isDark){ root.setAttribute("data-theme","dark"); }
          else { root.removeAttribute("data-theme"); }
          if (typeof syncPortalTheme === "function") syncPortalTheme();
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
            }, 3000);
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
    root.__votController = ctrl; root.__votId = id;
    if (root.__votPendingParams != null){ try { ctrl.update(root.__votPendingParams); } catch(e){} root.__votPendingParams = null; }
    if (root.__votPendingLoading != null){ try { ctrl.setLoading(root.__votPendingLoading); } catch(e){} root.__votPendingLoading = null; }
    applyCache(root, ctrl);
    return ctrl;
  }
  function initAll(){ var roots = document.querySelectorAll(".vot-root:not(.up-portal)"); for (var i=0;i<roots.length;i++) initRoot(roots[i]); }
  if (window.MutationObserver && !window.__votRootWatcher){
    window.__votRootWatcher = new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++){
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++){
          var n = added[j];
          if (n.nodeType !== 1) continue;
          if (n.classList && n.classList.contains("vot-root")) initRoot(n);
          if (n.querySelectorAll){
            var found = n.querySelectorAll(".vot-root");
            for (var k = 0; k < found.length; k++) initRoot(found[k]);
          }
        }
      }
    });
    window.__votRootWatcher.observe(document.body, { childList: true, subtree: true });
    setInterval(initAll, 1500);
  }
  function rootsWithId(id){
    id = id || "default";
    var out = [], roots = document.querySelectorAll(".vot-root:not(.up-portal)");
    for (var i=0;i<roots.length;i++){ if ((roots[i].getAttribute("data-instance")||"default") === id) out.push(roots[i]); }
    return out;
  }
  function resolve(id){ var r = rootsWithId(id); return r.length ? initRoot(r[0]) : null; }
  function stashRetryRoot(target, kind, a){
    if (kind === "update") target.__votPendingParams = a;
    if (kind === "loading") target.__votPendingLoading = isYes(a);
    var tries = 0;
    (function retry(){
      var ctrl = initRoot(target);
      if (ctrl){
        if (target.__votPendingParams != null){ ctrl.update(target.__votPendingParams); target.__votPendingParams = null; }
        if (target.__votPendingLoading != null){ ctrl.setLoading(target.__votPendingLoading); target.__votPendingLoading = null; }
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

  window.renderVisibilityChart = doRender;
  window.setVisibilityChartLoading = function(id, l){ return doLoading(id, l); };
  window.__votResolveLocal = function(id){ return rootsWithId(id).length > 0; };
  window.votThemeDebug = function(id){
    var roots = rootsWithId(String(id || "").trim());
    if (!roots.length){ console.log("[VOT] keine Instanz mit id", id, "gefunden"); return; }
    roots.forEach(function(root){
      var ctrl = root.__votController;
      var canvas = root.querySelector(".vc-line-canvas");
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
  window.resetVisibilityChart = function(instanceId){
    var id = String(instanceId || "").trim();
    if (!id) return false;
    var roots = rootsWithId(id);
    var did = false;
    for (var i = 0; i < roots.length; i++){
      var ctrl = roots[i].__votController;
      if (ctrl && typeof ctrl.reset === "function"){ try { ctrl.reset(); did = true; } catch(e){} }
    }
    return did;
  };

  /* Replay whatever Bubble called against the stub functions above while this script was still
     waiting on core.js, in the exact order those calls arrived — see the comment by the stub
     definitions for why this is what actually fixes the loading-state race. */
  if (__votBootQueue.length){
    var __votQueued = __votBootQueue.splice(0, __votBootQueue.length);
    __votQueued.forEach(function(entry){
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
        for (var a=0;a<seen.length;a++){ try { var c = seen[a]; if (c && typeof c[fnName] === "function" && c.__votResolveLocal && c.__votResolveLocal(id)){ c[fnName](arg1, arg2); delivered = true; } } catch(e){} }
        if (delivered) return true;
        for (var b2=0;b2<seen.length;b2++){ try { var c2 = seen[b2]; if (c2 && typeof c2[fnName] === "function") return c2[fnName](arg1, arg2); } catch(e){} }
        return false;
      };
    }
    for (var t=0;t<targets.length;t++){
      (function(w){
        try {
          var deliver = makeDeliver(w);
          w.renderVisibilityChart = function(params){ params = params || {}; return deliver("renderVisibilityChart", params.instanceId || "default", params); };
          w.setVisibilityChartLoading = function(id, l){ return deliver("setVisibilityChartLoading", id || "default", id, l); };
          w.resetVisibilityChart = function(id){ return deliver("resetVisibilityChart", id || "default", id); };
        } catch(e){}
      })(targets[t]);
    }
  })();

  /* ================= scroll fix ================= */
  function __votScrollTarget(fromEl){
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
  function __votForwardWheel(e){
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    var t = __votScrollTarget(e.target);
    if (t){ if (e.cancelable) e.preventDefault(); t.scrollTop += e.deltaY; return; }
    try { if (window.parent && window.parent !== window) window.parent.scrollBy(0, e.deltaY); } catch(ex){}
    try { window.scrollBy(0, e.deltaY); } catch(ex){}
  }
  function __votAttachWheel(){
    var roots = document.querySelectorAll(".vot-root");
    for (var i = 0; i < roots.length; i++){ if (!roots[i].__votWheel){ roots[i].__votWheel = true; roots[i].addEventListener("wheel", __votForwardWheel, { passive: false }); } }
  }
  if (!window.__votWheelFixInstalled){
    window.__votWheelFixInstalled = true;
    __votAttachWheel();
    setInterval(__votAttachWheel, 800);
  }

  /* ================= init ================= */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
  [30, 100, 250, 500, 1000, 1800].forEach(function(ms){ setTimeout(initAll, ms); });
  document.addEventListener("pointerdown", function(e){
    var r = e.target && e.target.closest ? e.target.closest(".vot-root") : null;
    if (r && !r.__votController) initRoot(r);
  }, true);
  } // end votRun

  votBoot(50); // retry for ~5s before giving up on core.js
})();
