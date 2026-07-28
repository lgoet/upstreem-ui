/* upstreem citations-combo-chart.js — component logic. Requires core.js (window.UpstreemCore) loaded first. */
(function(){
  "use strict";

  /* window.renderComboChart / setComboChartLoading / resetComboChart only become the real
     implementations once ccRun() finishes below (after the core.js wait) — same stub-queue
     pattern as the other three chart/table components, for the same reason: Bubble's own
     "Run Javascript" steps poll for these by name and call whichever is callable first, so thin
     stubs defined immediately (before any waiting happens) mean calls land in a queue in the exact
     order Bubble invoked them and get replayed in that order once the real implementations exist. */
  var __ccBootQueue = window.__ccBootQueue = window.__ccBootQueue || [];
  if (!window.__ccBootStubbed){
    window.__ccBootStubbed = true;
    window.renderComboChart = function(){ __ccBootQueue.push(["renderComboChart", arguments]); };
    window.setComboChartLoading = function(){ __ccBootQueue.push(["setComboChartLoading", arguments]); };
    window.resetComboChart = function(){ __ccBootQueue.push(["resetComboChart", arguments]); };
  }

  /* Bubble injects this component's <script> tags via jQuery .html(), which does not guarantee
     external scripts execute in DOM order — citations-combo-chart.js can start running before
     core.js has finished loading. Retry briefly instead of bailing forever. */
  function ccBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ ccBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    ccRun();
  }

  function ccRun(){
  var UC = window.UpstreemCore;
  var esc = UC.esc, isYes = UC.isYes, citeName = UC.citeName, resolveBubbleFn = UC.resolveBubbleFn, fmtTotal = UC.fmtTotal;
  var CITE_COLOR = UC.CITE_COLOR, CITE_ALIAS = UC.CITE_ALIAS;

  /* ================= Chart.js loader (SHARED across ALL upstreem components on the page) ================= */
  function loadChartJs(){
    if (window.Chart) return Promise.resolve();
    if (window.__upstreemChartJs) return window.__upstreemChartJs;
    window.__upstreemChartJs = new Promise(function(res, rej){
      // if a Chart.js script is already present (e.g. from another upstreem component on this
      // same page), wait for IT instead of loading a second copy — loading Chart.js twice breaks
      // existing chart instances (each load overwrites window.Chart with a fresh module/registry)
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

  /* ================= colours/labels not covered by core.js (CITE_COLOR/CITE_ALIAS ARE — see
     UC above) ================= */
  var URL_LABEL = {
    homepage:"Homepage", product_service:"Product / Service", marketplace:"Marketplace", company_info:"Company Info",
    article:"Article", listicle:"Listicle", guide:"Guide", comparison:"Comparison", review:"Review",
    documentation:"Documentation", forum:"Forum", directory:"Directory", video:"Video", social_post:"Social Post", other:"Uncategorized"
  };
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
  /* NOT UC.OTHER_DARK (#a8abb2) — this component's dark "other" value is #a0a0a0, same trap
     already documented in topcitations-dashboard.js: looks like a shared constant, isn't one. */
  var OTHER_LIGHT = "#8c8f96", OTHER_DARK = "#a0a0a0";
  var MAX_URL_SLICES = 8;

  /* ================= local-only helpers (no core.js equivalent) ================= */
  function capitalize(s){ s = String(s||""); return s.charAt(0).toUpperCase() + s.slice(1); }
  /* fmtPct has the <1% special case UC.fmtTotal doesn't — kept local, same as topcitations. */
  function fmtPct(v){ v = Number(v) || 0; if (v > 0 && v < 1) return "<1%"; return Math.round(v) + "%"; }
  function hexToRgb(hex){ var h=String(hex).replace("#",""); if(h.length===3)h=h.split("").map(function(x){return x+x;}).join(""); var n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
  function measureText(el){ if(!el) return 0; var r=el.getBoundingClientRect(); return r.width || el.scrollWidth || 0; }
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

  function hexToHsl(hex){
    var c = hexToRgb(hex).map(function(v){ return v/255; });
    var r=c[0],g=c[1],b=c[2];
    var max=Math.max(r,g,b), min=Math.min(r,g,b), h, s, l=(max+min)/2;
    if(max===min){ h=s=0; }
    else{ var d=max-min; s = l>0.5 ? d/(2-max-min) : d/(max+min);
      if(max===r) h=(g-b)/d+(g<b?6:0); else if(max===g) h=(b-r)/d+2; else h=(r-g)/d+4;
      h/=6; }
    return [h*360, s*100, l*100];
  }
  function hslToHex(h,s,l){
    h/=360; s/=100; l/=100;
    function hue2rgb(p,q,t){ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; }
    var r,g,b;
    if(s===0){ r=g=b=l; }
    else{ var q=l<0.5?l*(1+s):l+s-l*s; var p=2*l-q; r=hue2rgb(p,q,h+1/3); g=hue2rgb(p,q,h); b=hue2rgb(p,q,h-1/3); }
    function to(x){ var v=Math.round(x*255).toString(16); return v.length===1?"0"+v:v; }
    return "#"+to(r)+to(g)+to(b);
  }
  /* Is a fill colour light enough that white label text would be hard to read? Uses WCAG relative
     luminance so it judges by hue too. Threshold sits high on purpose: only genuinely light bars
     flip to dark text, mid-tone citation fills keep white. */
  function barIsLight(col){
    if (typeof col !== "string") return false;
    var c = col.charAt(0) === "#" ? col.slice(1) : col;
    if (c.length === 3) c = c.charAt(0)+c.charAt(0)+c.charAt(1)+c.charAt(1)+c.charAt(2)+c.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(c)) return false;
    function lin(v){ v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }
    var L = 0.2126*lin(parseInt(c.substr(0,2),16)) + 0.7152*lin(parseInt(c.substr(2,2),16)) + 0.0722*lin(parseInt(c.substr(4,2),16));
    return L > 0.55;
  }
  function shadeVariants(base, n){
    if(n<=1) return [base];
    var hsl=hexToHsl(base), h=hsl[0], s=hsl[1], lBase=hsl[2];
    var lo = Math.max(24, lBase - 27);
    var hi = Math.min(78, lBase + 27);
    var minSpan = Math.min(60, (n - 1) * 10);
    if (hi - lo < minSpan){
      var mid = (lo + hi) / 2;
      lo = Math.max(16, mid - minSpan / 2);
      hi = Math.min(84, mid + minSpan / 2);
    }
    var hueSpan = Math.min(30, (n - 1) * 11);
    var out=[];
    for(var i=0;i<n;i++){
      var t = i/(n-1);
      var l = lo + t*(hi-lo);
      var hv = (h + (t - 0.5) * hueSpan + 360) % 360;
      var sv = Math.max(30, Math.min(96, s - 10 + t*20));
      out.push(hslToHex(hv, sv, l));
    }
    return out;
  }

  /* ================= doughnut plugins ================= */
  var RING_PX = 12, SEG_GAP = 6, CORNER = 4, HOVER = 12;
  var ringWidthPlugin = {
    id: "ucRingWidth",
    beforeDatasetDraw: function(chart, args){
      var meta = chart.getDatasetMeta(args.index);
      meta.data.forEach(function(arc){ arc.innerRadius = Math.max(1, arc.outerRadius - RING_PX); });
    }
  };
  var constantGapPlugin = {
    id: "ucConstantGap",
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

  /* ================= doughnut tooltip ================= */
  function makeDonutTooltip(root){
    var state = { x:0, y:0, raf:null };
    var clamp = function(v,a,b){ return Math.max(a, Math.min(b, v)); };
    var lerp = function(a,b,t){ return a+(b-a)*t; };
    return function(context){
      var chart = context.chart, tooltip = context.tooltip;
      var el = root.querySelector(".ccd-donut-tooltip");
      if (!el){
        el = document.createElement("div");
        el.className = "ccd-donut-tooltip";
        el.style.cssText = "position:absolute;pointer-events:none;z-index:9999;opacity:0;transform:translate3d(0,0,0);transition:opacity 120ms ease, transform 120ms ease;";
        el.innerHTML = '<div class="ccd-tt-box"><div class="ccd-tt-title"></div><div class="ccd-tt-sub">Share:</div><div class="ccd-tt-val"></div></div>';
        el.querySelector(".ccd-tt-box").style.cssText = "background:#121212;color:#e6e6e6;border-radius:8px;padding:12px 14px;font-family:Geist,system-ui,-apple-system,Segoe UI,Roboto,Arial;font-size:13px;line-height:1.35;box-shadow:0 4px 14px rgba(0,0,0,.25);white-space:nowrap;";
        el.querySelector(".ccd-tt-title").style.cssText = "font-weight:500;margin-bottom:6px;";
        el.querySelector(".ccd-tt-sub").style.cssText = "color:#8a8a8a;font-size:11px;";
        chart.canvas.parentNode.appendChild(el);
      }
      if (tooltip.opacity === 0){ el.style.opacity = "0"; return; }
      var i = (tooltip.dataPoints && tooltip.dataPoints[0] && tooltip.dataPoints[0].dataIndex) || 0;
      var od = chart.data.datasets[0].originalData;
      var val = (od && od[i] != null) ? od[i] : (chart.data.datasets[0].data[i] || 0);
      el.querySelector(".ccd-tt-title").textContent = chart.data.labels[i] || "";
      el.querySelector(".ccd-tt-val").textContent = Number(val).toFixed(2) + "%";
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
      var el = wrap.querySelector(".cc-line-tt");
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
      var el = wrap.querySelector(".cc-line-tt");
      if (!el){
        el = document.createElement("div");
        el.className = "cc-line-tt";
        el.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:9999;opacity:0;transform:translate3d(0,0,0);transition:opacity 120ms ease;";
        wrap.appendChild(el);
      }
      if (tooltip.opacity === 0){ el.style.opacity = "0"; visible = false; pos.x = null; pos.y = null; return; }
      var dps = (tooltip.dataPoints || []).filter(function(dp){ return dp && dp.parsed && dp.parsed.y != null; });
      if (!dps.length){ el.style.opacity = "0"; visible = false; pos.x = null; pos.y = null; return; }
      var themeRoot = chart.canvas.closest(".combo-root");
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
  function prepData(dataMode, rows, isDark){
    rows = Array.isArray(rows) ? rows : [];
    var items = rows
      .filter(function(r){ return r && (r.type != null) && isFinite(Number(r.share_pct)); })
      .map(function(r){ return { key: String(r.type).trim(), share: Math.max(0, Number(r.share_pct)) }; });
    if (dataMode === "url"){
      items.sort(function(a,b){ return b.share - a.share; });
      if (items.length > MAX_URL_SLICES){
        var head = items.slice(0, MAX_URL_SLICES);
        var otherShare = items.slice(MAX_URL_SLICES).reduce(function(a,b){ return a + b.share; }, 0);
        head.push({ key:"other", share:otherShare, _other:true });
        items = head;
      }
      return items.map(function(it){
        var name = it._other ? "Other" : (URL_LABEL[it.key] || capitalize(String(it.key).replace(/_/g," ")));
        var map = isDark ? URL_COLOR_DARK : URL_COLOR_CHART;
        var color = it._other ? (isDark?OTHER_DARK:OTHER_LIGHT) : (map[it.key] || (isDark?OTHER_DARK:OTHER_LIGHT));
        return { name:name, share:it.share, color:color };
      });
    }
    return items.map(function(it){
      var name = citeName(it.key);
      return { name:name, share:it.share, color: CITE_COLOR[name] || OTHER_LIGHT };
    });
  }

  function buildLineDatasets(series, meta, dataMode, isDark){
    series = Array.isArray(series) ? series : [];
    meta = Array.isArray(meta) ? meta : [];
    var metaMap = {};
    meta.forEach(function(m){
      if (!m) return;
      var id = dataMode === "url" ? m.url : m.domain;
      if (id == null) return;
      metaMap[String(id)] = {
        type: dataMode === "url" ? m.url_type : m.citation_type,
        favicon: m.favicon || "",
        global_share: (m.global_share != null ? Number(m.global_share) : null),
        label: String(id)
      };
    });
    var byId = {}, daySet = {};
    series.forEach(function(p){
      if (!p) return;
      var raw = (p.id != null) ? p.id : (p.company_id != null) ? p.company_id : (p.url != null) ? p.url : (p.domain != null) ? p.domain : "";
      var id = String(raw);
      if (!id) return;
      var day = String(p.day);
      daySet[day] = true;
      (byId[id] = byId[id] || {})[day] = Number(p.share_pct) || 0;
    });
    var labels = Object.keys(daySet).sort();
    var ids = Object.keys(byId);
    ids.forEach(function(id){
      if (!metaMap[id]) metaMap[id] = { type:null, favicon:"", global_share:null, label:id };
      if (metaMap[id].global_share == null){
        var vals = labels.map(function(d){ return byId[id][d]; }).filter(function(v){ return v != null; });
        metaMap[id].global_share = vals.length ? (vals.reduce(function(a,b){ return a+b; },0)/vals.length) : 0;
      }
    });
    ids.sort(function(a,b){ return (metaMap[b].global_share||0) - (metaMap[a].global_share||0); });
    ids = ids.slice(0, 7);
    function baseColor(type){
      if (dataMode === "url"){
        var key = String(type||"").trim();
        var map = isDark ? URL_COLOR_DARK : URL_COLOR_CHART;
        return map[key] || (isDark?OTHER_DARK:OTHER_LIGHT);
      }
      var name = citeName(type);
      return CITE_COLOR[name] || OTHER_LIGHT;
    }
    var groups = {};
    ids.forEach(function(id){
      var base = baseColor(metaMap[id].type);
      (groups[base] = groups[base] || []).push(id);
    });
    var colorForId = {};
    Object.keys(groups).forEach(function(base){
      var arr = groups[base], shades = shadeVariants(base, arr.length);
      arr.forEach(function(id,i){ colorForId[id] = shades[i]; });
    });
    var globalMax = 0;
    var datasets = ids.map(function(id){
      var data = labels.map(function(d){ var v = byId[id][d]; if (v != null && v > globalMax) globalMax = v; return v != null ? v : null; });
      var col = colorForId[id];
      return {
        label: metaMap[id].label,
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
  function skeletonHtml(){
    var rows = [[110,34],[72,22],[90,22],[120,18],[80,18]];
    var legend = rows.map(function(r){
      return '<div class="ccd-sk-row"><span class="ccd-sk-dot"></span><span class="ccd-sk-lbl" style="width:'+r[0]+'px"></span><span class="ccd-sk-pct" style="width:'+r[1]+'px"></span></div>';
    }).join("");
    var u = Math.random().toString(36).slice(2);
    var mId = 'ccd-sk-mask-' + u, gId = 'ccd-sk-grad-' + u;
    return '<div class="ccd-skeleton">' +
      '<div class="ccd-sk-chart"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
        '<defs><mask id="' + mId + '"><circle cx="50" cy="50" r="38" fill="none" stroke="white" stroke-width="7"/></mask>' +
        '<linearGradient id="' + gId + '" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" class="ccd-sk-g0"/><stop offset="50%" class="ccd-sk-g1"/><stop offset="100%" class="ccd-sk-g0"/></linearGradient></defs>' +
        '<circle cx="50" cy="50" r="38" fill="none" class="ccd-sk-ring" stroke-width="7"/>' +
        '<rect x="-60" y="0" width="50" height="100" fill="url(#' + gId + ')" mask="url(#' + mId + ')"><animateTransform attributeName="transform" type="translate" from="-60 0" to="160 0" dur="1.2s" repeatCount="indefinite"/></rect>' +
      '</svg></div>' +
      '<div class="ccd-sk-legend">' + legend + '</div>' +
    '</div>';
  }
  function lineSkeletonHtml(){
    var hlines = new Array(4).join("x").split("x").map(function(){ return '<div class="sk-lc-hline"></div>'; }).join("");
    var xlabels = new Array(6).join("x").split("x").map(function(){ return '<div class="sk-lc-xlabel"></div>'; }).join("");
    var d = "M0,125 C60,115 100,70 150,58 C200,46 230,90 280,74 C330,58 390,22 460,14";
    var agId = 'cc-sk-ag-' + Math.random().toString(36).slice(2);
    return '<div class="cc-line-sk"><div class="sk-linechart">' +
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

  /* ================= line legend (balanced rows — same algorithm as visibility-chart.js) ================= */
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
    var donutRoot = root.querySelector(".ccd-chart-root");
    var body = donutRoot ? donutRoot.querySelector(".ccd-body") : null;
    var topTotal = donutRoot ? donutRoot.querySelector(".ccd-top-total") : null;
    var topTotalN = topTotal ? topTotal.querySelector(".n") : null;
    var segBtns = Array.prototype.slice.call(root.querySelectorAll(".ccd-seg-btn"));
    var lineWrap = root.querySelector(".cc-line-wrap");
    var lineCanvas = root.querySelector(".cc-line-canvas");
    var legendEl = root.querySelector(".cc-legend");
    var headingRight = root.querySelector(".combo-heading-right");
    if (!donutRoot || !body || !topTotal || !topTotalN || !segBtns.length || !lineWrap || !lineCanvas){
      return null;
    }

    var instanceId = root.getAttribute("data-instance") || "default";
    var myCtrlId = "cc_" + Math.random().toString(36).slice(2) + "_" + Date.now();
    var savedMode = null;
    try { savedMode = window.localStorage.getItem("cc_chart_mode__" + instanceId); } catch(e){}
    var startMode = (savedMode === "bar" || savedMode === "doughnut") ? savedMode : "doughnut";

    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark){ root.setAttribute("data-theme","dark"); donutRoot.setAttribute("data-theme","dark"); } else { root.removeAttribute("data-theme"); donutRoot.removeAttribute("data-theme"); }
    /* OR two independent loading signals (data-processing/data-processing2), same convention as
       the other three chart/table components. */
    function readProcessing(){
      var a = root.getAttribute("data-processing");
      var b = root.getAttribute("data-processing2");
      var pa = (a === "IS_PROCESSING" || a == null) ? false : isYes(a);
      var pb = (b === "IS_PROCESSING_2" || b == null) ? false : isYes(b);
      return pa || pb;
    }
    /* Once setComboChartLoading() has been called explicitly for this instance, attribute changes
       are ignored for it from then on — matches visibility-chart.js/topcitations-dashboard.js. */
    var LOADING_EXPLICIT = (window.__ccLoadingExplicit = window.__ccLoadingExplicit || {});

    var state = {
      chartMode: startMode, dataMode: "domain",
      total: 0, prepped: [],
      loading: LOADING_EXPLICIT[instanceId]
        ? !!(window.__ccCache && window.__ccCache[instanceId] && window.__ccCache[instanceId].loading)
        : readProcessing(),
      hasData: false, __lastType: null,
      series: [], meta: { domains: [], urls: [] }, hasLine: false
    };
    var chartInstance = null, lineChart = null;

    // ---- granularity (day/week/month) — controller-level so renderLine + update can use it ----
    var GRAN_STORE = (window.__ccGran = window.__ccGran || {});
    /* Once the user has manually clicked a granularity button, update()'s auto-inference from
       incoming series data must stop overriding their choice — same gate as visibility-chart.js's
       GRAN_PICKED (missing from the original standalone version of this component). */
    var GRAN_PICKED = (window.__ccGranPicked = window.__ccGranPicked || {});
    var curGran = (GRAN_STORE[instanceId] === "week" || GRAN_STORE[instanceId] === "month") ? GRAN_STORE[instanceId] : "day";
    var granBtns = Array.prototype.slice.call(root.querySelectorAll(".cc-gran-btn"));
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
    function syncGranActive(){ granBtns.forEach(function(bn){ bn.classList.toggle("is-active", bn.getAttribute("data-gran") === curGran); }); }
    function applyGranAvailability(){
      var r = seriesRangeDays();
      granBtns.forEach(function(bn){
        var g = bn.getAttribute("data-gran");
        var dis = (g === "week" && r > 0 && r < 8) || (g === "month" && r > 0 && r < 31);
        bn.classList.toggle("is-disabled", dis);
        if (dis) bn.setAttribute("aria-disabled", "true"); else bn.removeAttribute("aria-disabled");
      });
      var activeBtn = granBtns.filter(function(bn){ return bn.getAttribute("data-gran") === curGran; })[0];
      if (activeBtn && activeBtn.classList.contains("is-disabled")){ curGran = "day"; GRAN_STORE[instanceId] = "day"; syncGranActive(); }
    }

    function themeColors(){
      return isDark
        ? { text:"#e0e0e0", muted:"#a0a0a0", border:"#353535", bg:"#1b1b1b" }
        : { text:"#1f1f1b", muted:"#6f737c", border:"#e0e2e6", bg:"#ffffff" };
    }
    function setHeading(){
      if (headingRight) headingRight.textContent = (state.dataMode === "url") ? "URL Type Split" : "Citation Type Split";
    }
    function syncTheme(){
      if (isDark){ root.setAttribute("data-theme","dark"); donutRoot.setAttribute("data-theme","dark"); } else { root.removeAttribute("data-theme"); donutRoot.removeAttribute("data-theme"); }
    }

    /* ---------- doughnut render ---------- */
    function destroyChart(){
      if (chartInstance){ try { chartInstance.destroy(); } catch(e){} chartInstance = null; }
      var cv = body.querySelector("canvas");
      if (cv && window.Chart && window.Chart.getChart){ var ex = window.Chart.getChart(cv); if (ex) try{ ex.destroy(); }catch(e){} }
    }
    function applyCollapse(){
      if (!body) return;
      var layout = body.querySelector(".ccd-donut-layout");
      if (!layout) return;
      layout.classList.toggle("is-collapsed", donutRoot.getBoundingClientRect().width < 320);
    }
    var donutTooltip = makeDonutTooltip(donutRoot);

    function renderDoughnut(){
      if (root.__ccController && root.__ccController.__ctrlId !== myCtrlId)return;
      destroyChart();
      var d = state.prepped;
      body.innerHTML =
        '<div class="ccd-donut-layout">' +
          '<div class="ccd-donut-wrap"><canvas></canvas>' +
            '<div class="ccd-center"><span class="n">' + esc(fmtTotal(state.total)) + '</span><span class="lbl">Citations</span></div>' +
          '</div><div class="ccd-legend"></div>' +
        '</div>';
      body.querySelector(".ccd-legend").innerHTML = d.map(function(it){
        return '<div class="ccd-legend-row"><span class="ccd-legend-chip" style="background:' + it.color + '"></span>' +
          '<span class="ccd-legend-name">' + esc(it.name) + '</span>' +
          '<span class="ccd-legend-pct">' + esc(fmtPct(it.share)) + '</span></div>';
      }).join("");
      applyCollapse();
      if (!d.length) return;
      loadChartJs().then(function(){
        var canvas = body.querySelector("canvas");
        if (!canvas) return;
        var ctx = canvas.getContext("2d");
        var origData = d.map(function(x){ return x.share; });
        var display = origData.map(function(v){ return Math.max(v, 1.0); });
        var colors = d.map(function(x){ return x.color; });
        var allZero = origData.every(function(v){ return v <= 0; });
        window.Chart.defaults.color = isDark ? "#a0a0a0" : "#6f737c";
        window.Chart.defaults.font = { family: "Geist, system-ui, -apple-system, Segoe UI, Roboto, Arial", size: 12 };
        try {
          chartInstance = new window.Chart(ctx, {
            type: "doughnut",
            data: { labels: allZero ? ["—"] : d.map(function(x){ return x.name; }),
              datasets: [{ data: allZero ? [1] : display, originalData: allZero ? [0] : origData,
                backgroundColor: allZero ? [isDark?"rgba(255,255,255,0.06)":"#eeeeee"] : colors,
                spacing: 0, borderWidth: 0, borderRadius: CORNER, hoverOffset: HOVER }] },
            plugins: [constantGapPlugin, ringWidthPlugin],
            options: { responsive: true, maintainAspectRatio: false, layout: { padding: 8 },
              animation: { duration: 200, easing: "easeOutQuad" },
              plugins: { legend: { display:false }, tooltip: { enabled:false, external: donutTooltip } } }
          });
        } catch(err){}
      });
    }

    function renderBars(){
      if (root.__ccController && root.__ccController.__ctrlId !== myCtrlId)return;
      destroyChart();
      var d = state.prepped.slice().sort(function(a,b){ return b.share - a.share; });
      topTotalN.textContent = fmtTotal(state.total);
      topTotal.style.display = "flex";
      if (!d.length){ body.innerHTML = '<div class="ccd-empty">No data</div>'; return; }
      body.innerHTML = '<div class="ccd-bars">' + d.map(function(it){
        var light = barIsLight(it.color);
        var txt = light ? "rgba(31,31,27,0.96)" : "rgba(255,255,255,0.95)";
        var txtPct = light ? "rgba(31,31,27,0.62)" : "rgba(255,255,255,0.75)";
        /* var(--vc-text)/var(--vc-muted) — not var(--ccd-text)/var(--ccd-muted), which no longer
           exist as separate tokens (see citations-combo-chart.css header). */
        var outColor = isDark ? "rgba(255,255,255,0.85)" : "var(--vc-text)";
        var outPctColor = isDark ? "rgba(255,255,255,0.55)" : "var(--vc-muted)";
        return '<div class="ccd-bar-row"><div class="ccd-bar-track">' +
            '<div class="ccd-bar-fill" style="background:' + it.color + ';width:0%">' +
              '<span class="ccd-bar-name" style="color:' + txt + ';opacity:0">' + esc(it.name) + '</span>' +
              '<span class="ccd-bar-pct ccd-bar-pct-in" style="color:' + txtPct + ';opacity:0">' + esc(fmtPct(it.share)) + '</span>' +
            '</div>' +
            '<span class="ccd-bar-outside" style="opacity:0">' +
              '<span class="ccd-bar-name-out" style="color:' + outColor + '">' + esc(it.name) + '</span>' +
              '<span class="ccd-bar-pct-out" style="color:' + outPctColor + '">' + esc(fmtPct(it.share)) + '</span>' +
            '</span></div></div>';
      }).join("") + '</div>';

      var rows = Array.prototype.slice.call(body.querySelectorAll(".ccd-bar-row"));
      var metrics = rows.map(function(row){
        return { nameW: measureText(row.querySelector(".ccd-bar-name")), pctW: measureText(row.querySelector(".ccd-bar-pct-in")) };
      });
      function placeRow(row, m){
        var fill = row.querySelector(".ccd-bar-fill"), name = row.querySelector(".ccd-bar-name"),
            pin = row.querySelector(".ccd-bar-pct-in"), outside = row.querySelector(".ccd-bar-outside");
        if (!fill || !outside) return;
        var fillPx = fill.offsetWidth, needed = m.nameW + m.pctW + 12 + 20;
        if (fillPx >= needed){ if(name)name.style.opacity="1"; if(pin)pin.style.opacity="1"; outside.style.opacity="0"; }
        else { if(name)name.style.opacity="0"; if(pin)pin.style.opacity="0"; outside.style.left=Math.round(fillPx+8)+"px"; outside.style.opacity="1"; }
      }
      function placeAll(){ rows.forEach(function(row, i){ placeRow(row, metrics[i]); }); }
      function fitBars(){
        if (!rows.length) return;
        var avail = body.clientHeight; if (!avail) return;
        var rowH = rows[0].offsetHeight || 42;
        var maxVisible = Math.max(1, Math.floor(avail / rowH));
        for (var i=0;i<rows.length;i++) rows[i].style.display = (i < maxVisible) ? "" : "none";
      }
      requestAnimationFrame(function(){ requestAnimationFrame(function(){
        rows.forEach(function(row, i){ var fill = row.querySelector(".ccd-bar-fill"); if (fill) fill.style.width = Math.max(d[i].share,0) + "%"; });
        fitBars();
      }); });
      var placed = false;
      rows.forEach(function(row){
        var fill = row.querySelector(".ccd-bar-fill"); if (!fill) return;
        var done = false;
        fill.addEventListener("transitionend", function onEnd(e){
          if (e.propertyName !== "width" || done) return;
          done = true; fill.removeEventListener("transitionend", onEnd);
          var i = rows.indexOf(row); if (i>=0) placeRow(row, metrics[i]);
        });
      });
      setTimeout(function(){ placed = true; fitBars(); placeAll(); }, 640);
      if (window.ResizeObserver){
        var ro = new ResizeObserver(function(){ fitBars(); if (placed) placeAll(); });
        ro.observe(body);
        rows.forEach(function(row){ var t = row.querySelector(".ccd-bar-track"); if (t) ro.observe(t); });
      }
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
        lineChart.update("none");
      }
      if (legendEl){
        var items = legendEl.querySelectorAll(".up-company-item");
        for (var i=0;i<items.length;i++){
          var cid = items[i].getAttribute("data-company-id");
          items[i].style.opacity = (id == null || cid === id) ? "1" : "0.35";
        }
      }
    }
    if (legendEl && legendEl.getAttribute("data-cc-hoverbound") !== "1"){
      legendEl.setAttribute("data-cc-hoverbound", "1");
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
    }
    function clearLineExtras(){ var sk = lineWrap.querySelector(".cc-line-sk"); if (sk) sk.remove(); var em = lineWrap.querySelector(".cc-line-empty"); if (em) em.remove(); }
    function showLineSkeleton(){ destroyLine(); clearLineExtras(); clearLegend(); lineWrap.insertAdjacentHTML("beforeend", lineSkeletonHtml()); }

    function renderLine(){
      if (root.__ccController && root.__ccController.__ctrlId !== myCtrlId)return;
      clearLineExtras();
      var meta = state.dataMode === "url" ? state.meta.urls : state.meta.domains;
      var built = buildLineDatasets(state.series, meta || [], state.dataMode, isDark);
      populateFilter(built.datasets);
      if (!built.datasets.length){
        destroyLine(); clearLegend();
        lineWrap.insertAdjacentHTML("beforeend", '<div class="cc-line-empty">No data</div>');
        return;
      }
      var visDs = built.datasets.filter(function(ds){ return !hiddenSeries[ds.__id]; });
      if (!visDs.length){
        destroyLine(); clearLegend();
        lineWrap.insertAdjacentHTML("beforeend", '<div class="cc-line-empty">No data</div>');
        return;
      }
      renderLegend(visDs);
      loadChartJs().then(function(){
        if (root.__ccController && root.__ccController.__ctrlId !== myCtrlId) return;
        if (!lineCanvas) return;

        /* Chart.js needs the container to have real, settled dimensions at creation time — a
           setInterval poll (not rAF/ResizeObserver, both of which pause/throttle on a backgrounded
           or not-yet-visible Bubble popup tab) waits for that before building. Ported verbatim from
           visibility-chart.js — see that file's comment on the exact reasoning. */
        function buildChart(){
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

        if (lineWrap.clientWidth > 0 && lineWrap.clientHeight > 0){
          buildChart();
        } else {
          var __sizeTicks = 0;
          var __sizeIv = setInterval(function(){
            if (root.__ccController && root.__ccController.__ctrlId !== myCtrlId){
              clearInterval(__sizeIv); return;
            }
            if (!lineCanvas || !lineCanvas.isConnected){ clearInterval(__sizeIv); return; }
            var sized = lineWrap.clientWidth > 0 && lineWrap.clientHeight > 0;
            if (sized || ++__sizeTicks > 600){
              clearInterval(__sizeIv);
              buildChart();
            }
          }, 200);
        }
      }).catch(function(err){
      });
    }

    /* ---------- render (two independent halves) ---------- */
    function renderDonutSide(){
      if (root.__ccController && root.__ccController.__ctrlId !== myCtrlId){ return; }
      if (state.loading || !state.hasData){
        destroyChart(); topTotal.style.display = "none"; body.innerHTML = skeletonHtml();
      } else if (state.chartMode === "bar"){ topTotal.style.display = "flex"; renderBars(); }
      else { topTotal.style.display = "none"; renderDoughnut(); }
    }
    function renderLineSide(){
      if (root.__ccController && root.__ccController.__ctrlId !== myCtrlId){ return; }
      if (state.loading || !state.hasLine || state.linePending){ showLineSkeleton(); return; }
      renderLine();
      verifyLineRendered();
    }
    /* Chart.js's own internals occasionally fail to attach silently (a race inside its own resize
       observer) — re-check a few times and rebuild if the canvas ends up with no live chart
       instance and no empty-state shown. Ported verbatim from visibility-chart.js. */
    function verifyLineRendered(){
      clearTimeout(root.__ccLineVerifyT);
      var attempts = 0;
      function check(){
        if (root.__ccController && root.__ccController.__ctrlId !== myCtrlId) return;
        if (state.loading || !state.hasLine || state.linePending) return;
        var alive = false;
        try { alive = !!(window.Chart && window.Chart.getChart && lineCanvas && window.Chart.getChart(lineCanvas)); } catch(e){}
        if (alive || lineWrap.querySelector(".cc-line-empty")){
          return;
        }
        if (attempts++ >= 12) return;
        renderLine();
        root.__ccLineVerifyT = setTimeout(check, 250);
      }
      root.__ccLineVerifyT = setTimeout(check, 400);
    }
    function render(){
      if (root.__ccController && root.__ccController.__ctrlId !== myCtrlId)return;
      syncTheme();
      setHeading();
      syncSwitch();
      renderDonutSide();
      renderLineSide();
    }

    function syncSwitch(){
      segBtns.forEach(function(o){
        var on = o.getAttribute("data-chart") === state.chartMode;
        o.classList.toggle("is-active", on);
        o.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    segBtns.forEach(function(o){
      if (o.getAttribute("data-cc-bound") === "1") return;
      o.setAttribute("data-cc-bound", "1");
      o.addEventListener("click", function(){
        var ctrl = root.__ccController || initRoot(root);
        if (!ctrl) return;
        ctrl.setMode(o.getAttribute("data-chart"));
      });
    });

    var maxBtn = root.querySelector(".combo-maximize");
    var inner = root;
    if (maxBtn && inner && maxBtn.getAttribute("data-cc-bound") !== "1"){
      maxBtn.setAttribute("data-cc-bound", "1");
      maxBtn.addEventListener("click", function(){
        var max = root.classList.toggle("is-max");
        maxBtn.setAttribute("data-tip", max ? "Minimize" : "Maximize");
        maxBtn.setAttribute("aria-label", max ? "Minimize" : "Maximize");
        setTimeout(function(){
          try { if (chartInstance) chartInstance.resize(); } catch(e){}
          try { if (lineChart) lineChart.resize(); } catch(e){}
        }, 60);
      });
    }

    var hideBtns = Array.prototype.slice.call(root.querySelectorAll(".combo-hide"));
    if (hideBtns.length && inner){
      var HIDDEN = (window.__ccHidden = window.__ccHidden || {});
      if (HIDDEN[instanceId]){ root.classList.add("is-hidden-view"); }
      hideBtns.forEach(function(hideBtn){
        if (hideBtn.getAttribute("data-cc-bound") === "1") return;
        hideBtn.setAttribute("data-cc-bound", "1");
        hideBtn.addEventListener("click", function(){
          var collapsed = root.classList.toggle("is-hidden-view");
          HIDDEN[instanceId] = collapsed;
          hideBtn.setAttribute("data-tip", collapsed ? "Show" : "Hide");
          hideBtn.setAttribute("aria-label", collapsed ? "Show" : "Hide");
          if (collapsed){
            root.classList.remove("is-max");
            if (maxBtn){ maxBtn.setAttribute("data-tip","Maximize"); maxBtn.setAttribute("aria-label","Maximize"); }
          }
          setTimeout(function(){
            try { if (chartInstance) chartInstance.resize(); } catch(e){}
            try { if (lineChart) lineChart.resize(); } catch(e){}
            legendLayout();
          }, 230);
        });
      });
    }

    /* Mira-style button tooltip — kept as this component's own implementation (see
       citations-combo-chart.css header comment for why this isn't UpstreemCore.makeTooltips).
       ONE shared element for the whole page (not one per root). Events are delegated on root
       rather than bound per button, so replacing a button can't strand a tooltip that never
       receives its mouseleave. */
    var ccTipEl = window.__ccTipEl;
    if (!ccTipEl || !document.body.contains(ccTipEl)){
      ccTipEl = document.createElement("div");
      ccTipEl.className = "cc-tip";
      document.body.appendChild(ccTipEl);
      window.__ccTipEl = ccTipEl;
    }
    if (!root.__ccTipBound){
      root.__ccTipBound = true;
      var ccTipTimer = null, ccTipBtn = null, ccTipPlacedRect = null;
      var ccHideTip = function(){ clearTimeout(ccTipTimer); ccTipBtn = null; ccTipPlacedRect = null; ccTipEl.classList.remove("show"); };
      var ccPlaceTip = function(btn){
        ccTipEl.style.transform = "";
        var br = btn.getBoundingClientRect();
        var tw = ccTipEl.offsetWidth, vw = window.innerWidth || document.documentElement.clientWidth;
        var left = br.left + br.width / 2 - tw / 2;
        left = Math.max(6, Math.min(left, vw - tw - 6));
        ccTipEl.style.left = left + "px";
        ccTipEl.style.top = (br.bottom + 8) + "px";
        ccTipPlacedRect = br;
      };
      var ccShowTip = function(btn){
        if (!btn || !document.contains(btn)) return;
        var txt = btn.getAttribute("data-tip"); if (!txt) return;
        var dark = (btn.closest(".combo-root") || root).getAttribute("data-theme") === "dark";
        ccTipEl.style.background = dark ? "#f0f0f0" : "#1f1f1b";
        ccTipEl.style.color = dark ? "#1f1f1b" : "#ffffff";
        ccTipEl.textContent = txt;
        ccTipEl.classList.add("show");
        ccTipBtn = btn;
        ccPlaceTip(btn);
      };
      /* Keep an open tooltip glued to its trigger while the page scrolls — same cheap,
         compositor-only transform-nudge + settle-time full reposition as the dropdown menus and
         .vot-tip/.tcd-tip already use. Without this the tooltip just stayed frozen at its old
         screen position while the trigger scrolled out from under it. */
      var ccTipRepositionRaf = null, ccTipSettleTimer = null;
      window.addEventListener("scroll", function(){
        if (!ccTipBtn) return;
        if (ccTipRepositionRaf) return;
        ccTipRepositionRaf = requestAnimationFrame(function(){
          ccTipRepositionRaf = null;
          if (!ccTipBtn || !ccTipPlacedRect) return;
          var r = ccTipBtn.getBoundingClientRect();
          ccTipEl.style.transform = "translate(" + Math.round(r.left - ccTipPlacedRect.left) + "px," + Math.round(r.top - ccTipPlacedRect.top) + "px)";
          clearTimeout(ccTipSettleTimer);
          ccTipSettleTimer = setTimeout(function(){ if (ccTipBtn) ccPlaceTip(ccTipBtn); }, 150);
        });
      }, { capture: true, passive: true });
      root.addEventListener("mouseover", function(e){
        var btn = e.target.closest("[data-tip]");
        if (!btn || !root.contains(btn) || btn === ccTipBtn) return;
        ccTipBtn = btn;
        clearTimeout(ccTipTimer);
        ccTipTimer = setTimeout(function(){ ccShowTip(btn); }, 60);
      });
      root.addEventListener("mouseout", function(e){
        var btn = e.target.closest("[data-tip]");
        if (!btn) return;
        if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
        ccHideTip();
      });
      root.addEventListener("mousedown", ccHideTip);
      document.addEventListener("mousemove", function(){
        if (!ccTipEl.classList.contains("show") && !ccTipTimer) return;
        if (!ccTipBtn || !document.contains(ccTipBtn)){ ccHideTip(); return; }
        var stillHovered = false;
        try { stillHovered = ccTipBtn.matches(":hover"); } catch(err){ stillHovered = true; }
        if (!stillHovered) ccHideTip();
      });
      window.addEventListener("blur", ccHideTip);
    }

    // line-chart granularity switcher — fires a Run-JS / JavaScript-to-Bubble event on change.
    if (granBtns.length){
      syncGranActive();
      applyGranAvailability();
      granBtns.forEach(function(bn){
        if (bn.getAttribute("data-cc-bound") === "1") return;
        bn.setAttribute("data-cc-bound", "1");
        bn.addEventListener("click", function(){
          if (bn.classList.contains("is-disabled")) return;
          var g = bn.getAttribute("data-gran");
          if (g === curGran) return;
          curGran = g; GRAN_STORE[instanceId] = g; GRAN_PICKED[instanceId] = true; syncGranActive();
          var fnName = root.getAttribute("data-gran-fn") || "bubble_fn_comboGranularity";
          var fn = resolveBubbleFn(fnName);
          if (typeof fn === "function"){ try { fn(g); } catch(e){} }
        });
      });
    }

    // ---- filter dropdown: hide/show individual domains/urls in the line chart ----
    var FILTER_STORE = (window.__ccFilter = window.__ccFilter || {});
    var hiddenSeries = FILTER_STORE[instanceId] || (FILTER_STORE[instanceId] = {});
    var filterWrap = root.querySelector(".combo-filter");
    var filterBtn = root.querySelector(".combo-filter-btn");
    var filterMenu = root.querySelector(".combo-filter-menu");
    function syncFilterBadge(datasets){
      var badge = root.querySelector(".combo-filter-badge");
      if (!badge) return;
      var all = (datasets || []).length;
      var visible = (datasets || []).filter(function(ds){ return !hiddenSeries[ds.__id]; }).length;
      var show = all > 0 && visible > 0 && visible < all;
      badge.textContent = show ? String(visible) : "";
      badge.classList.toggle("is-visible", show);
    }
    function populateFilter(datasets){
      if (!filterMenu) return;
      syncFilterBadge(datasets);
      if (!datasets || !datasets.length){ filterMenu.innerHTML = '<div class="combo-filter-empty">No series</div>'; return; }
      var anyHidden = datasets.some(function(ds){ return hiddenSeries[ds.__id]; });
      var title = state.dataMode === "url" ? "URLs" : "Domains";
      var head = '<div class="combo-filter-head"><span class="combo-filter-title">' + title + '</span>' +
        '<button class="combo-filter-toggle" type="button" data-act="' + (anyHidden ? "select" : "deselect") + '">' +
        (anyHidden ? "Select all" : "Deselect all") + '</button></div>';
      var items = datasets.map(function(ds){
        var checked = !hiddenSeries[ds.__id];
        var icon = ds.__favicon
          ? '<img class="combo-filter-favicon" src="' + esc(ds.__favicon) + '" onerror="this.style.visibility=\'hidden\'"/>'
          : '<span class="combo-filter-dot" style="background:' + ds.__baseColor + '"></span>';
        return '<div class="combo-filter-item ' + (checked ? "is-checked" : "") + '" data-id="' + esc(String(ds.__id)) + '" style="--cc-fltclr:' + ds.__baseColor + '" title="' + esc(ds.label) + '">' +
          '<span class="combo-filter-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>' +
          icon + '<span class="combo-filter-name">' + esc(ds.label) + '</span></div>';
      }).join("");
      filterMenu.innerHTML = head + items;
      var tog = filterMenu.querySelector(".combo-filter-toggle");
      if (tog){
        tog.addEventListener("click", function(ev){
          ev.stopPropagation();
          if (tog.getAttribute("data-act") === "deselect"){ datasets.forEach(function(ds){ hiddenSeries[ds.__id] = true; }); }
          else { datasets.forEach(function(ds){ delete hiddenSeries[ds.__id]; }); }
          renderLineSide();
        });
      }
      Array.prototype.slice.call(filterMenu.querySelectorAll(".combo-filter-item")).forEach(function(it){
        it.addEventListener("click", function(ev){
          ev.stopPropagation();
          var id = it.getAttribute("data-id");
          if (hiddenSeries[id]) delete hiddenSeries[id]; else hiddenSeries[id] = true;
          it.classList.toggle("is-checked");
          syncFilterBadge(datasets);
          renderLineSide();
        });
      });
    }
    /* Dropdown menu is a plain position:absolute child of .combo-filter (position:relative) — no
       UpstreemCore.makePortal/placeMenu call, per STYLEGUIDE §14. */
    if (filterBtn && filterWrap && !filterBtn.__ccBound){
      filterBtn.__ccBound = true;
      filterBtn.addEventListener("click", function(e){ e.stopPropagation(); filterWrap.classList.toggle("is-open"); });
    }
    if (filterWrap && !filterWrap.__ccOutsideBound){
      filterWrap.__ccOutsideBound = true;
      document.addEventListener("click", function(e){ if (filterWrap && !filterWrap.contains(e.target)) filterWrap.classList.remove("is-open"); });
    }

    var NARROW_STACK = 880;
    function applyResponsive(){
      if (inner){
        var w = inner.clientWidth || root.clientWidth || 0;
        if (w){ if (w < NARROW_STACK) root.classList.add("is-narrow"); else root.classList.remove("is-narrow"); }
      }
      root.classList.toggle("cc-narrow-page", getPageWidth() < 500);
      clearTimeout(root.__ccRespT);
      root.__ccRespT = setTimeout(function(){
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
          if (isDark){ root.setAttribute("data-theme","dark"); donutRoot.setAttribute("data-theme","dark"); } else { root.removeAttribute("data-theme"); donutRoot.removeAttribute("data-theme"); }
          if (state.hasData){ state.prepped = prepData(state.dataMode, state.__lastType, isDark); }
          changed = true;
        }
        if (!LOADING_EXPLICIT[instanceId] && wantProc !== state.loading){ state.loading = wantProc; changed = true; }
        if (changed) render();
      };
      new MutationObserver(syncFromAttrs).observe(root, { attributes:true, attributeFilter:["data-processing","data-processing2","data-isdark"] });
    }

    if (window.ResizeObserver){
      new ResizeObserver(function(){
        if (root.__ccRaf) return;
        root.__ccRaf = requestAnimationFrame(function(){ root.__ccRaf = null; applyCollapse(); applyResponsive(); });
      }).observe(donutRoot);
      new ResizeObserver(function(){
        if (root.__ccRespRaf) return;
        root.__ccRespRaf = requestAnimationFrame(function(){ root.__ccRespRaf = null; applyResponsive(); });
      }).observe(inner || root);
      if (legendEl){
        new ResizeObserver(function(){
          if (root.__ccLegRaf) return;
          root.__ccLegRaf = requestAnimationFrame(function(){ root.__ccLegRaf = null; legendLayout(); });
        }).observe(legendEl);
      }
    }
    window.addEventListener("resize", function(){
      if (root.__ccWinRaf) return;
      root.__ccWinRaf = requestAnimationFrame(function(){ root.__ccWinRaf = null; legendLayout(); applyResponsive(); });
    });

    applyResponsive();
    render();

    return {
      __ctrlId: myCtrlId,
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          isDark = isYes(params.isDark);
          if (isDark){ root.setAttribute("data-theme","dark"); donutRoot.setAttribute("data-theme","dark"); } else { root.removeAttribute("data-theme"); donutRoot.removeAttribute("data-theme"); }
        }
        if (params.dataMode != null) state.dataMode = (params.dataMode === "url") ? "url" : "domain";
        if ((params.chartMode === "bar" || params.chartMode === "doughnut") && !savedMode) state.chartMode = params.chartMode;
        if (params.total != null) state.total = Number(params.total) || 0;
        var split = (params.typeSplit != null) ? params.typeSplit : params.data;
        if (split != null){
          state.__lastType = split;
          state.prepped = prepData(state.dataMode, split, isDark);
          state.hasData = true;
        }
        if (params.series != null){
          var __arr = Array.isArray(params.series) ? params.series : [];
          if (__arr.length){ state.series = __arr; state.hasLine = true; state.linePending = false; applyGranAvailability(); }
          else if (!state.hasLine){ state.series = []; state.hasLine = true; state.linePending = false; }
          else {
            state.linePending = true;
          }
        }
        if (params.domains != null) state.meta.domains = Array.isArray(params.domains) ? params.domains : [];
        if (params.urls != null) state.meta.urls = Array.isArray(params.urls) ? params.urls : [];
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
      },
      setMode: function(m){
        if (m !== "bar" && m !== "doughnut") return;
        state.chartMode = m;
        try { window.localStorage.setItem("cc_chart_mode__" + instanceId, m); } catch(e){}
        syncSwitch(); renderDonutSide();
      },
      reset: function(){
        /* Local state + UI only — deliberately does NOT fire bubble_fn_comboGranularity. Also
           EMPTIES the data (both halves back to skeleton), not just the filters, so a slide-in
           that calls resetComboChart() on open doesn't sit there re-animating/re-resizing stale
           data. Fires zero Bubble events — same hard rule as resetVisibilityChart/
           resetTopCitations, and for the same reason: a reset ahead of a fresh load must not
           re-trigger whatever workflow is wired to the granularity click. */
        hiddenSeries = FILTER_STORE[instanceId] = {};
        delete GRAN_PICKED[instanceId];
        curGran = "day"; GRAN_STORE[instanceId] = "day";

        state.series = []; state.prepped = []; state.hasData = false; state.hasLine = false;
        state.linePending = false; state.total = 0; state.__lastType = null;
        state.meta = { domains: [], urls: [] };
        if (window.__ccCache){ try { delete window.__ccCache[instanceId]; } catch(e){} }

        syncGranActive();
        populateFilter([]);
        render();
        return true;
      }
    };
  }

  /* ================= root resolution + owner-guard ================= */
  var CACHE = (window.__ccCache = window.__ccCache || {});
  function cacheData(id, params){
    if (!id) return;
    CACHE[id] = CACHE[id] || {};
    CACHE[id].params = CACHE[id].params || {};
    for (var k in params){ if (params.hasOwnProperty(k) && params[k] !== undefined) CACHE[id].params[k] = params[k]; }
  }
  function cacheLoading(id, v){ if (!id) return; CACHE[id] = CACHE[id] || {}; CACHE[id].loading = isYes(v); }
  function applyCache(root, ctrl){
    var id = root.getAttribute("data-instance");
    if (!id || !CACHE[id]) return;
    try { if (CACHE[id].params != null) ctrl.update(CACHE[id].params); } catch(e){}
    try { if (CACHE[id].loading != null) ctrl.setLoading(CACHE[id].loading); } catch(e){}
  }
  function initRoot(root){
    if (root.__ccController) return root.__ccController;
    if (root.__ccBuilding) return null;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;
    root.__ccBuilding = true;
    var ctrl = makeController(root);
    root.__ccBuilding = false;
    if (!ctrl) return null;
    if (root.__ccController) return root.__ccController;
    root.__ccController = ctrl; root.__ccId = id;
    if (root.__ccPendingParams != null){ try { ctrl.update(root.__ccPendingParams); } catch(e){} root.__ccPendingParams = null; }
    if (root.__ccPendingLoading != null){ try { ctrl.setLoading(root.__ccPendingLoading); } catch(e){} root.__ccPendingLoading = null; }
    applyCache(root, ctrl);
    return ctrl;
  }
  function initAll(){ var roots = document.querySelectorAll(".combo-root"); for (var i=0;i<roots.length;i++) initRoot(roots[i]); }
  /* shared page-level watcher (core) — see UC.watchRoots for why this replaces a private-to-this-
     component MutationObserver + setInterval pair (the original standalone version of this
     component had its own window.__ccRootWatcher doing exactly that). */
  if (UC.watchRoots) UC.watchRoots("combo-root", initAll);   // guard: a stale cached core.js on the page may predate this API
  function rootsWithId(id){
    id = id || "default";
    var out = [], roots = document.querySelectorAll(".combo-root");
    for (var i=0;i<roots.length;i++){ if ((roots[i].getAttribute("data-instance")||"default") === id) out.push(roots[i]); }
    return out;
  }
  function stashRetryRoot(target, kind, a){
    if (kind === "update") target.__ccPendingParams = a;
    if (kind === "loading") target.__ccPendingLoading = isYes(a);
    var tries = 0;
    (function retry(){
      var ctrl = initRoot(target);
      if (ctrl){
        if (target.__ccPendingParams != null){ ctrl.update(target.__ccPendingParams); target.__ccPendingParams = null; }
        if (target.__ccPendingLoading != null){ ctrl.setLoading(target.__ccPendingLoading); target.__ccPendingLoading = null; }
        return;
      }
      if (tries++ < 40) setTimeout(retry, 100);
    })();
  }
  // deliver to EVERY root that carries the id (a reusable embedded N times shares one iframe,
  // so several .combo-root copies have the same instance id — all of them must fill, not just the first)
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

  window.renderComboChart = doRender;
  window.setComboChartLoading = function(id, l){ return doLoading(id, l); };
  window.__ccResolveLocal = function(id){ return rootsWithId(id).length > 0; };
  window.resetComboChart = function(instanceId){
    var id = String(instanceId || "").trim();
    if (!id) return false;
    var roots = rootsWithId(id);
    var did = false;
    for (var i = 0; i < roots.length; i++){
      var ctrl = roots[i].__ccController;
      if (ctrl && typeof ctrl.reset === "function"){ try { ctrl.reset(); did = true; } catch(e){} }
    }
    return did;
  };

  /* Replay whatever Bubble called against the stub functions above while this script was still
     waiting on core.js, in the exact order those calls arrived. */
  if (__ccBootQueue.length){
    var __ccQueued = __ccBootQueue.splice(0, __ccBootQueue.length);
    __ccQueued.forEach(function(entry){
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
        for (var a=0;a<seen.length;a++){ try { var c = seen[a]; if (c && typeof c[fnName] === "function" && c.__ccResolveLocal && c.__ccResolveLocal(id)){ c[fnName](arg1, arg2); delivered = true; } } catch(e){} }
        if (delivered) return true;
        for (var b2=0;b2<seen.length;b2++){ try { var c2 = seen[b2]; if (c2 && typeof c2[fnName] === "function") return c2[fnName](arg1, arg2); } catch(e){} }
        return false;
      };
    }
    for (var t=0;t<targets.length;t++){
      (function(w){
        try {
          var deliver = makeDeliver(w);
          w.renderComboChart = function(params){ params = params || {}; return deliver("renderComboChart", params.instanceId || "default", params); };
          w.setComboChartLoading = function(id, l){ return deliver("setComboChartLoading", id || "default", id, l); };
          w.resetComboChart = function(id){ return deliver("resetComboChart", id || "default", id); };
        } catch(e){}
      })(targets[t]);
    }
  })();

  /* ================= scroll fix ================= */
  function __ccScrollTarget(fromEl){
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
  function __ccForwardWheel(e){
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    var t = __ccScrollTarget(e.target);
    if (t){ if (e.cancelable) e.preventDefault(); t.scrollTop += e.deltaY; return; }
    try { if (window.parent && window.parent !== window) window.parent.scrollBy(0, e.deltaY); } catch(ex){}
    try { window.scrollBy(0, e.deltaY); } catch(ex){}
  }
  function __ccAttachWheel(){
    var roots = document.querySelectorAll(".combo-root");
    for (var i = 0; i < roots.length; i++){ if (!roots[i].__ccWheel){ roots[i].__ccWheel = true; roots[i].addEventListener("wheel", __ccForwardWheel, { passive: false }); } }
  }
  if (!window.__ccWheelFixInstalled){
    window.__ccWheelFixInstalled = true;
    __ccAttachWheel();
    setInterval(__ccAttachWheel, 800);
  }

  /* ================= init ================= */
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
  [30, 100, 250, 500, 1000, 1800].forEach(function(ms){ setTimeout(initAll, ms); });
  document.addEventListener("pointerdown", function(e){
    var r = e.target && e.target.closest ? e.target.closest(".combo-root") : null;
    if (r && !r.__ccController) initRoot(r);
  }, true);
  } // end ccRun

  ccBoot(50); // retry for ~5s before giving up on core.js
})();
