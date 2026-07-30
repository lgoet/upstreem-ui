/* upstreem citations-combo-chart.js — component logic. Requires core.js (window.UpstreemCore) loaded first. */
(function(){
  "use strict";

  /* Stubs must exist before core.js is guaranteed to be loaded, so this one block stays inline —
     Bubble's Run-Javascript steps poll for these by name and would otherwise miss the earliest
     calls. Everything after the core.js wait uses UC.makeMount. */
  var __ccBootQueue = window.__ccBootQueue = window.__ccBootQueue || [];
  if (!window.__ccBootStubbed){
    window.__ccBootStubbed = true;
    ["renderComboChart","setComboChartLoading","resetComboChart"].forEach(function(n){
      window[n] = function(){ __ccBootQueue.push([n, arguments]); };
    });
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
  var esc = UC.esc, isYes = UC.isYes, resolveBubbleFn = UC.resolveBubbleFn, fmtTotal = UC.fmtTotal;

  /* ---------- component-local colour ramp ----------
     The only colour logic that stays here: when several series share the same TYPE (e.g. three
     Editorial domains), they must be visually separable while still reading as one family. Core
     gives the family colour via UC.typeColor; this spreads N shades around it. No other component
     needs this, so it is not in core. */
  function hexToRgb(hex){ var h=String(hex).replace("#",""); if(h.length===3)h=h.split("").map(function(x){return x+x;}).join(""); var n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
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
  function shadeVariants(base, n){
    if(n<=1) return [base];
    var hsl=hexToHsl(base), h=hsl[0], s=hsl[1], lBase=hsl[2];
    // lightness window around the base, kept inside a visible range
    var lo = Math.max(24, lBase - 27);
    var hi = Math.min(78, lBase + 27);
    // widen if the clamped window is too narrow to keep N shades clearly distinct
    var minSpan = Math.min(60, (n - 1) * 10);
    if (hi - lo < minSpan){
      var mid = (lo + hi) / 2;
      lo = Math.max(16, mid - minSpan / 2);
      hi = Math.min(84, mid + minSpan / 2);
    }
    // small hue spread on top of the lightness ramp — noticeably separates same-category shades
    // while keeping them recognisably the same colour family
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

  /* ---------- data mapping (the part the chart kit cannot know) ----------
     Turns the Bubble payload into the {labels, datasets} UC.makeLine expects. This is genuinely
     per component: visibility-chart keys on company_id with a fixed palette, this one keys on
     domain or url depending on dataMode and derives its colours from the entry's TYPE. */
  function buildLineDatasets(series, meta, dataMode, isDark){
    series = Array.isArray(series) ? series : [];
    meta = Array.isArray(meta) ? meta : [];
    var metaMap = {};
    meta.forEach(function(m){
      if (!m) return;
      var id = dataMode === "url" ? m.url : m.domain;
      if (id == null) return;
      /* Legend and tooltip both read dataset.label off this (see core.js's shared
         makeLineTooltip/legendLayout — this is the only place that needs to change). In URL mode
         `id` is the raw url, which is what used to show up verbatim in both places; showing the
         page title instead needs the RPC to actually send one — falls back to the url when it
         doesn't, so this degrades gracefully rather than showing a blank label. */
      metaMap[String(id)] = {
        type: dataMode === "url" ? m.url_type : m.citation_type,
        favicon: m.favicon || "",
        global_share: (m.global_share != null ? Number(m.global_share) : null),
        label: dataMode === "url" ? String(m.title || id) : String(id)
      };
    });
    var byId = {}, daySet = {};
    series.forEach(function(p){
      if (!p) return;
      // accept the identifier under any of these keys: id, company_id, url (url mode), domain (domain mode)
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
    /* group ids by their family colour, then spread a shade ramp inside each group */
    var groups = {};
    ids.forEach(function(id){
      var base = UC.typeColor(metaMap[id].type, dataMode === "url" ? "url" : "citation", isDark);
      (groups[base] = groups[base] || []).push(id);
    });
    var colorForId = {};
    Object.keys(groups).forEach(function(base){
      var arr = groups[base], shades = shadeVariants(base, arr.length);
      arr.forEach(function(id,i){ colorForId[id] = shades[i]; });
    });
    var datasets = ids.map(function(id){
      var col = colorForId[id];
      return {
        label: metaMap[id].label,
        __id: id,
        __globalShare: metaMap[id].global_share,
        __favicon: metaMap[id].favicon,
        __baseColor: col,
        data: labels.map(function(d){ var v = byId[id][d]; return v != null ? v : null; }),
        borderColor: col
      };
    });
    return { labels: labels, datasets: datasets };
  }

  /* ================= controller ================= */
  function makeController(root){
    var donutRoot = root.querySelector(".cc-type-root");
    var body = donutRoot ? donutRoot.querySelector(".up-donut-body") : null;
    var topTotal = donutRoot ? donutRoot.querySelector(".cc-top-total") : null;
    var topTotalN = topTotal ? topTotal.querySelector(".n") : null;
    var segBtns = Array.prototype.slice.call(root.querySelectorAll(".cc-seg-btn"));
    var lineWrap = root.querySelector(".up-line-wrap");
    var lineCanvas = root.querySelector(".up-line-canvas");
    var legendEl = root.querySelector(".up-legend");
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

    function setHeading(){
      if (headingRight) headingRight.textContent = (state.dataMode === "url") ? "URL Type Split" : "Citation Type Split";
    }
    function syncTheme(){
      if (isDark){ root.setAttribute("data-theme","dark"); donutRoot.setAttribute("data-theme","dark"); } else { root.removeAttribute("data-theme"); donutRoot.removeAttribute("data-theme"); }
    }

    /* ---------- the two charts, both from the shared kits ----------
       Everything that used to live here — plugins, tooltips, skeletons, the size poll, the render
       verify, the legend layout and its hover highlight, the bar fit/label logic — is in core now.
       What is left is only this component's wiring: which element, which theme, who owns the
       render, and which granularity the tooltip should format dates for. */
    function isOwner(){ return !root.__ccController || root.__ccController.__ctrlId === myCtrlId; }
    function darkNow(){ return isDark; }

    var line = UC.makeLine({
      wrap: lineWrap, canvas: lineCanvas, legend: legendEl,
      isDark: darkNow, isOwner: isOwner,
      gran: function(){ return curGran; }
    });
    var typeChart = UC.makeTypeChart({
      body: body, isDark: darkNow, isOwner: isOwner,
      mode: function(){ return state.dataMode; },
      total: function(){ return state.total; },
      centerLabel: "Citations",
      collapseHost: donutRoot
    });

    /* ---------- render (two independent halves) ---------- */
    function renderDonutSide(){
      if (!isOwner()) return;
      if (state.loading || !state.hasData){ topTotal.style.display = "none"; typeChart.skeleton(); }
      else if (state.chartMode === "bar"){ topTotal.style.display = "flex"; topTotalN.textContent = fmtTotal(state.total); typeChart.renderBars(state.prepped); }
      else { topTotal.style.display = "none"; typeChart.renderDonut(state.prepped); }
    }
    function renderLineSide(){
      if (!isOwner()) return;
      var loading = state.loading || !state.hasLine || state.linePending;
      /* The gear button (and its dropdown, if it was somehow open when a reload started) has no
         business being reachable over a skeleton — nothing to configure yet. */
      root.classList.toggle("is-line-loading", loading);
      if (loading){
        if (settingsOpen) closeSettingsMenu();
        line.skeleton();
        return;
      }
      /* the per-series filter is this component's own feature — the kit only ever sees the
         datasets that should actually be drawn */
      var built = buildLineDatasets(state.series, state.dataMode === "url" ? state.meta.urls : state.meta.domains, state.dataMode, isDark);
      populateFilter(built.datasets);
      var visible = built.datasets.filter(function(ds){ return !hiddenSeries[ds.__id]; });
      line.render({ labels: built.labels, datasets: visible });
    }
    function render(){
      if (!isOwner()) return;
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
          typeChart.resize(); line.resize();
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
            typeChart.resize(); line.resize(); line.relayoutLegend();
          }, 230);
        });
      });
    }

    /* Button tooltips: the shared core implementation. This component used to carry its own
       ~95-line copy (.cc-tip) — that copy is exactly where the multi-instance bug lived, because
       its state was per root while the chip element was per page. */
    UC.makeTooltips(root, darkNow);

    /* ---------- chart settings (Line Width only — no colors here, see .ccl-settings-btn) ----------
       Same hand-rolled body-mounted open/close shape as visibility-chart's own scale menu (not
       UC.makePopover: its outside-click check assumes the menu is a DOM descendant of its trigger,
       which isn't true once the menu escapes .combo-box's overflow:hidden via document.body). */
    var settingsBtn = root.querySelector(".ccl-settings-btn");
    var settingsMenu = null, settingsOpen = false;
    function ensureSettingsMenu(){
      if (settingsMenu && document.body.contains(settingsMenu)) return settingsMenu;
      settingsMenu = document.createElement("div");
      settingsMenu.className = "up-scale-menu";
      settingsMenu.setAttribute("role", "menu");
      settingsMenu.setAttribute("aria-hidden", "true");
      settingsMenu.addEventListener("click", function(e){
        var lw = e.target.closest("[data-linewidth]");
        if (!lw) return;
        UC.setLineWidthPref(lw.getAttribute("data-linewidth"));
        populateSettingsMenu();
      });
      document.body.appendChild(settingsMenu);
      return settingsMenu;
    }
    function populateSettingsMenu(){
      if (!settingsMenu) return;
      settingsMenu.innerHTML = '<div class="up-pop-head">Chart Settings</div>' + UC.lineWidthSectionHtml();
    }
    function positionSettingsMenu(){
      if (!settingsBtn || !settingsMenu) return;
      var r = settingsBtn.getBoundingClientRect();
      settingsMenu.style.top = (r.bottom + 8) + "px";
      settingsMenu.style.right = (window.innerWidth - r.right) + "px";
    }
    function openSettingsMenu(){
      if (!settingsBtn || settingsOpen) return;
      ensureSettingsMenu();
      populateSettingsMenu();
      settingsOpen = true;
      settingsBtn.classList.add("is-open");
      settingsMenu.setAttribute("data-theme", isDark ? "dark" : "light");
      positionSettingsMenu();
      settingsMenu.setAttribute("aria-hidden", "false");
      void settingsMenu.offsetWidth;
      settingsMenu.classList.add("is-shown");
    }
    function closeSettingsMenu(){
      if (!settingsOpen) return;
      if (settingsMenu && settingsMenu.contains(document.activeElement)){
        try { document.activeElement.blur(); } catch(e){}
      }
      settingsOpen = false;
      if (settingsBtn) settingsBtn.classList.remove("is-open");
      if (settingsMenu){ settingsMenu.classList.remove("is-shown"); settingsMenu.setAttribute("aria-hidden", "true"); }
    }
    if (settingsBtn && !settingsBtn.__ccSettingsBound){
      settingsBtn.__ccSettingsBound = true;
      settingsBtn.addEventListener("click", function(e){
        e.stopPropagation();
        if (settingsOpen) closeSettingsMenu(); else openSettingsMenu();
      });
      document.addEventListener("click", function(e){
        if (!settingsOpen) return;
        if (settingsBtn.contains(e.target)) return;
        if (settingsMenu && settingsMenu.contains(e.target)) return;
        closeSettingsMenu();
      });
      document.addEventListener("keydown", function(e){
        if (!settingsOpen) return;
        if (e.key !== "Escape" && e.key !== "Esc") return;
        closeSettingsMenu();
      });
      window.addEventListener("resize", function(){ if (settingsOpen) positionSettingsMenu(); });
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
    /* Dropdown via the shared primitive: still a plain position:absolute child of a
       position:relative wrapper (STYLEGUIDE §14, no portal), but the open/close mechanics,
       focus escape, Escape key and the single page-wide outside-click listener come from core.
       This component previously toggled `display` directly, which broke §6 — the menu now stays
       in the layout and animates via .is-shown like every other dropdown. */
    var filterPop = UC.makePopover({ wrap: filterWrap, menu: filterMenu, opener: filterBtn, group: "cc-" + instanceId });
    if (filterBtn && filterWrap && !filterBtn.__ccBound){
      filterBtn.__ccBound = true;
      filterBtn.addEventListener("click", function(e){ e.stopPropagation(); filterPop.toggle(); });
    }

    var NARROW_STACK = 880;
    function applyResponsive(){
      if (inner){
        var w = inner.clientWidth || root.clientWidth || 0;
        if (w){ if (w < NARROW_STACK) root.classList.add("is-narrow"); else root.classList.remove("is-narrow"); }
      }
      root.classList.toggle("cc-narrow-page", UC.getPageWidth() < 500);
      clearTimeout(root.__ccRespT);
      root.__ccRespT = setTimeout(function(){
        typeChart.resize(); line.resize();
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
          if (state.hasData){ state.prepped = UC.prepTypeData(state.dataMode, state.__lastType, isDark); }
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
        root.__ccRaf = requestAnimationFrame(function(){ root.__ccRaf = null; typeChart.applyCollapse(); applyResponsive(); });
      }).observe(donutRoot);
      new ResizeObserver(function(){
        if (root.__ccRespRaf) return;
        root.__ccRespRaf = requestAnimationFrame(function(){ root.__ccRespRaf = null; applyResponsive(); });
      }).observe(inner || root);
      if (legendEl){
        new ResizeObserver(function(){
          if (root.__ccLegRaf) return;
          root.__ccLegRaf = requestAnimationFrame(function(){ root.__ccLegRaf = null; line.relayoutLegend(); });
        }).observe(legendEl);
      }
    }
    window.addEventListener("resize", function(){
      if (root.__ccWinRaf) return;
      root.__ccWinRaf = requestAnimationFrame(function(){ root.__ccWinRaf = null; line.relayoutLegend(); applyResponsive(); });
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
          state.prepped = UC.prepTypeData(state.dataMode, split, isDark);
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

  /* mount: root registry, iframe forwarder, wheel forwarding, init cascade and the replay of
     whatever Bubble queued against the stubs above — all from core. doRender/doLoading stay here
     because this component broadcasts to every root sharing an instanceId. */
  var mount = UC.makeMount({
    rootClass: "combo-root",
    /* only the chart surfaces swallow the wheel; nothing else here intercepts scrolling */
    wheelSel: ".up-line-wrap, .up-donut-body, .cc-type-root",
    ctrlProp: "__ccController",
    resolveLocal: "__ccResolveLocal",
    queue: "__ccBootQueue",
    initRoot: initRoot,
    api: {
      renderComboChart: doRender,
      setComboChartLoading: function(id, l){ return doLoading(id, l); },
      resetComboChart: function(instanceId){
        var id = String(instanceId || "").trim();
        if (!id) return false;
        var rs = rootsWithId(id), did = false;
        for (var i = 0; i < rs.length; i++){
          var ctrl = rs[i].__ccController;
          if (ctrl && typeof ctrl.reset === "function"){ try { ctrl.reset(); did = true; } catch(e){} }
        }
        return did;
      }
    },
    forwardShape: { renderComboChart: "params", resetComboChart: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end ccRun

  ccBoot(50); // retry for ~5s before giving up on core.js
})();
