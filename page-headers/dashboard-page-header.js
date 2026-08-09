/* upstreem dashboard-page-header.js — component logic. Requires core.js (window.UpstreemCore)
   loaded first: reuses UC.isYes/UC.makeFire/UC.makeMount/UC.trendChip and the shared .up-root CSS
   variables, plus the Page Header Kit's meta/heading/description styling (core.css's ".up-ph-*"
   classes) -- same as prompts-page-header.js. No subpage nav here (this page has none) and no
   separator row underneath either -- same bare layout as performance-page-header.js -- so the
   markup ends right after the top row.

   Unlike prompts-page-header.js, this component has one real piece of server data (the KPI
   numbers), delivered once at page load via a setter call rather than read off a static
   attribute -- so, unlike that file, this one DOES need the stub-queue/UC.makeMount plumbing
   every table/chart in this repo already uses (see topics-manager.js for the same pattern with a
   single setter). */
(function(){
  "use strict";

  /* Stub queue: if Bubble calls setDashboardPageHeaderKpis() before this script has finished
     loading (a real race -- the CDN loader fetches core.js and this file in sequence, and Bubble's
     own "set the KPIs" workflow step can run before either resolves), the call queues here instead
     of throwing on a function that doesn't exist yet. UC.makeMount replays the queue once it's
     ready. Guarded by __dphBootStubbed so a second copy of this script (Bubble re-injecting the
     element's markup) doesn't reinstall the stub over a queue that may already hold calls. */
  var __dphBootQueue = window.__dphBootQueue = window.__dphBootQueue || [];
  if (!window.__dphBootStubbed){
    window.__dphBootStubbed = true;
    ["setDashboardPageHeaderKpis"].forEach(function(n){
      window[n] = function(){ __dphBootQueue.push([n, arguments]); };
    });
  }

  function dphBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ dphBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    dphRun();
  }

  var UC, mount;

  function dphRun(){
    UC = window.UpstreemCore;

    mount = UC.makeMount({
      /* onMount: makeMount replays Bubble's queued setDashboardPageHeaderKpis calls while it is
         still constructing, i.e. before `mount` below has been assigned -- capturing it via this
         callback (not the makeMount() return value) is what makes the very first queued call, if
         any, see a defined `mount` instead of throwing. Same pattern as topics-manager.js. */
      onMount: function(m){ mount = m; },
      rootClass: "dph-root", notPortal: true,
      ctrlProp: "__dphController",
      resolveLocal: "__dphResolveLocal",
      queue: "__dphBootQueue",
      initRoot: initRoot,
      api: { setDashboardPageHeaderKpis: doSetKpis }
      /* No forwardShape entry: setDashboardPageHeaderKpis(instanceId, kpis) is a plain (id, value)
         call, which is makeMount's default forwarding shape -- only "params"/"id"-shaped setters
         need an explicit entry here. */
    });
  }

  function rootsWithId(id){ return mount.rootsWithId(id); }

  /* Picks the visible instance when the same component is placed more than once on a page (a
     hidden/not-yet-shown duplicate, e.g. behind an unopened drawer, would otherwise win ties by
     DOM order) -- same tie-break topics-manager.js uses for its own resolve(). */
  function resolve(id){
    var r = rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    if (r.length === 1) return initRoot(r[0]);
    for (var i = 0; i < r.length; i++){
      try { if (r[i].offsetParent) return initRoot(r[i]); } catch(e){}
    }
    return initRoot(r[0]);
  }

  /* kpis may arrive as a real array OR as a STRING holding one. The string form exists because
     Bubble builds the Run-JavaScript step as text: an unfilled dynamic expression leaves nothing
     at all behind, so setDashboardPageHeaderKpis("id", [{"avg_rank_prev": , ...}]) reaches the
     browser as a JS SYNTAX ERROR and the whole step dies before this file gets a say. Quoting the
     array turns that from executable code into inert data, and UC.parseLoose puts the missing
     values back as null (plus the usual Bubble damage: NBSP indents, curly quotes, entities,
     unquoted keys). Passing a real array still works exactly as before -- parseLoose returns
     objects untouched -- so nothing that already works needs changing. */
  function doSetKpis(id, kpis){
    var ctrl = resolve(id);
    if (!ctrl) return false;
    var list = UC.parseLoose ? UC.parseLoose(kpis, "dashboard-page-header") : kpis;
    /* A single object instead of a one-element array is the other shape Bubble hands over easily;
       accept it rather than render an empty strip over a punctuation detail. */
    if (list && !isArr(list)) list = [list];
    ctrl.setKpis(list);
    return true;
  }
  function isArr(v){ return Object.prototype.toString.call(v) === "[object Array]"; }

  /* One controller object per root, cached on the root itself (ctrlProp) so a second resolve()
     call against the same still-live root reuses it instead of re-wiring listeners. */
  function initRoot(root){
    if (root.__dphController) return root.__dphController;
    var ctrl = buildController(root);
    root.__dphController = ctrl;
    return ctrl;
  }

  function fmtRank(v){
    var n = Number(v);
    return isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : "–";
  }
  function fmtInt(v){
    var n = Number(v);
    return isFinite(n) ? String(Math.round(n)) : "–";
  }

  function buildController(root){
    var fire = UC.makeFire(root, { label: "dashboard-page-header", eventPrefix: "dph" });

    /* Same data-brand-name/-logo/-isdark re-sync as prompts-page-header.js, same reason: Bubble
       can resolve those dynamic expressions after this root is already mounted, patching the
       attribute in place rather than replacing the node. */
    var nameEl = root.querySelector(".pph-metaname");
    var logoEl = root.querySelector(".up-ph-metalogo");
    function syncFromAttrs(){
      var wantDark = UC.isYes(root.getAttribute("data-isdark"));
      if (wantDark) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

      var name = root.getAttribute("data-brand-name") || "";
      if (name === "BRAND_NAME") name = "";
      if (nameEl) nameEl.textContent = name;

      var logo = root.getAttribute("data-brand-logo") || "";
      if (logo === "BRAND_LOGO_URL") logo = "";
      if (logoEl){
        if (logo){ logoEl.src = logo; logoEl.style.display = ""; }
        else { logoEl.removeAttribute("src"); logoEl.style.display = "none"; }
      }
    }
    syncFromAttrs();
    new MutationObserver(syncFromAttrs).observe(root, {
      attributes: true, attributeFilter: ["data-isdark", "data-brand-name", "data-brand-logo"]
    });

    if (UC.makeTooltips) UC.makeTooltips(root, function(){ return UC.isYes(root.getAttribute("data-isdark")); });

    var refreshBtn = root.querySelector(".dph-refreshbtn");
    if (refreshBtn){
      refreshBtn.addEventListener("click", function(){
        UC.spinOnce(refreshBtn);
        fire("data-refresh-fn", "dphRefresh", {});
      });
    }
    var docsBtn = root.querySelector(".dph-docsbtn");
    if (docsBtn) docsBtn.addEventListener("click", function(){ fire("data-docs-fn", "dphDocs", {}); });

    var kpisEl = root.querySelector(".dph-kpis");
    var descEl = root.querySelector(".up-ph-desc");

    /* Mobile: the KPI strip is the thing that gives, not the description. Below some width the row
       no longer has room for .up-ph-left's full heading+description block AND the KPI strip side
       by side -- left, unlike the strip (flex:0 0 auto, fixed), can shrink and its text wraps, and
       without this the description started breaking onto a second line while the KPIs just sat
       there unbothered. Instead: try showing the KPIs, check whether the description NOW needs to
       wrap because of it, and if so hide them again -- freeing that width back to .up-ph-left. Runs
       on every resize tick (via UC.onResize below) and once right after setKpis() populates real
       content, since the KPI strip's width appearing at all is not itself a root resize. */
    function fitTopRight(){
      if (!kpisEl || !kpisEl.firstChild || !descEl) return;
      kpisEl.style.display = "";
      var lineH = parseFloat(getComputedStyle(descEl).lineHeight) || 0;
      if (lineH && descEl.scrollHeight > lineH * 1.4) kpisEl.style.display = "none";
    }
    if (UC.onResize) UC.onResize(root, fitTopRight);

    /* cls: "up-trend dph-trend-sm" keeps up-trend's pos/neg color logic (core.css) and just
       overrides icon/font size -- see dashboard-page-header.css's own comment on .dph-trend-sm for
       why a plain size override on .up-trend itself would have affected every OTHER trend chip in
       the app instead of just this one. */
    function kpiItem(label, valueText, delta, trendOpts){
      trendOpts = trendOpts || {};
      trendOpts.cls = "up-trend dph-trend-sm";
      var trend = UC.trendChip(delta, trendOpts);
      return '<span class="dph-kpi"><span class="dph-kpi-label">' + label + ':</span>' +
        '<span class="dph-kpi-value">' + valueText + '</span>' + trend + '</span>';
    }

    function setKpis(list){
      if (!kpisEl) return;
      var k = (list && list[0]) || null;
      if (!k){ kpisEl.innerHTML = ""; return; }
      /* Ranking is inverted (a LOWER rank is the improvement) and shown to 1 decimal, matching
         this app's existing rank convention (core.js's fmt1/rankCell) rather than the whole-number
         default the other two KPIs use -- avg_rank moves in increments too small to survive
         trendChip's default integer rounding (a real -0.35 move would round to 0 and vanish). */
      var vis = kpiItem("Visibility", fmtInt(k.avg_visibility_pct) + "%", k.avg_visibility_delta_pct, { suffix: "%" });
      var rank = kpiItem("Ranking", fmtRank(k.avg_rank), k.avg_rank_delta, { inverted: true, decimals: true });
      var sent = kpiItem("Sentiment", fmtInt(k.avg_sentiment), k.avg_sentiment_delta, {});
      kpisEl.innerHTML = vis + '<span class="dph-kpi-sep"></span>' + rank + '<span class="dph-kpi-sep"></span>' + sent;
      fitTopRight();
    }

    return { setKpis: setKpis };
  }

  dphBoot(30);
})();
