/* upstreem performance-radar.js — component logic. Requires core.js (window.UpstreemCore) first.

   The Performance Radar: a topic x brand heatmap. One row per topic, one column per brand, one
   cell per pair. The switcher in the toolbar decides WHICH number the cells carry (Visibility /
   Ranking / Sentiment) — all three already ride along in every cell, so switching is instant and
   needs no round trip. The fader button opens a two-column picker (brands left, topics right)
   that chooses which rows and columns exist at all; that one DOES need fresh data, so it fires an
   event and dims until the answer lands.

   This replaces a standalone <style>+<script> block that lived in the Bubble page. What carried
   over unchanged, on purpose, is the JS CONTRACT — window.renderFestivalHeatmap_<ID>(),
   window.destroyHeatmapTooltip_<ID>() and the bubble_fn_heatmap_cell_clicked("companyId||topicId")
   callback all still exist with the same names and the same shapes, because live Bubble workflows
   are wired to them. Everything else is new.

   What is NOT re-implemented here (it comes from core):
     Bubble plumbing (registry, stub replay, frames)  UC.makeMount / UC.bootStubs
     dropdown open/close/outside-click/Escape         UC.makePopover
     ancestor un-clipping so the menu can hang out    UC.unclipAncestors
     button tooltips                                  UC.makeTooltips
     event dispatch incl. team_id                     UC.makeFire
     sentiment colour, trend chips, number formats    UC.sentColor / UC.trendChip / UC.fmt1
     the topic chip                                   core.css .up-topicchip
     the "dim while reloading" treatment              UC.makeSoftReload
     narrow/very-narrow breakpoints                   UC.widthTiers

   Genuinely local, and why: the heat ramp and the cell grid have exactly one consumer today
   (STYLEGUIDE §25 — build local first, extract on the SECOND consumer). The ramp colours
   themselves are NOT hardcoded here though; they are read from CSS custom properties in
   performance-radar.css, so light/dark follows the app with one palette instead of two. */
(function(){
  "use strict";

  /* ---------------------------------------------------------------------------
     Boot stubs. Bubble's Run-JavaScript steps poll for these names and call
     whichever is callable first, so a render that arrives before this file has
     parsed must be queued rather than lost (STYLEGUIDE §25).

     The per-instance legacy aliases (renderFestivalHeatmap_<ID>) cannot be stubbed
     here — the id is not known until the markup exists. The loader block in
     bubble/performance_radar_bubble.html stubs those two names into THIS same queue,
     which is why the queue name below and the one over there must stay in sync.
     --------------------------------------------------------------------------- */
  var __uhmBootQueue = window.__uhmBootQueue = window.__uhmBootQueue || [];
  if (!window.__uhmBootStubbed){
    window.__uhmBootStubbed = true;
    ["renderPerformanceRadar", "setPerformanceRadarLoading", "resetPerformanceRadar",
     "renderFestivalHeatmap", "destroyHeatmapTooltip"].forEach(function(n){
      window[n] = function(){ __uhmBootQueue.push([n, arguments]); };
    });
  }

  function uhmBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uhmBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uhmRun();
  }

  function uhmRun(){
  var UC = window.UpstreemCore;

  /* Every component on a page shares ONE core.js — the last data-cdn-pin loaded wins. If that
     copy predates a kit this file needs, name the cause once instead of dying later on a bare
     "UC.x is not a function", then degrade to something that still draws. */
  var MISSING = ["makeMount", "makePopover", "makeTooltips", "makeFire", "sentColor"]
    .filter(function(k){ return typeof UC[k] !== "function"; });
  if (MISSING.length && window.console){
    console.error("[performance-radar] The core.js running on this page is OLDER than " +
      "performance-radar.js and is missing: " + MISSING.join(", ") + ". Pin every Upstreem " +
      "component on the page to the SAME commit (data-cdn-pin).");
  }

  var esc = UC.esc, isYes = UC.isYes, fmt1 = UC.fmt1, toNum = UC.toNum, sentColor = UC.sentColor;
  var HASH_SVG = UC.HASH_ICON ? UC.HASH_ICON.replace("<svg ", '<svg class="up-hash" ') : "";
  var CHECK_SVG = UC.CHECK_SVG;
  var GEAR_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>';
  var X_SVG = UC.icon("x", 2.2);

  /* ---------------------------------------------------------------------------
     Geometry. These four numbers are the whole responsive story.

     COL_MIN went 76 -> 60 and GAP 6/8 -> 4 because the cells got shorter and tighter
     (40px tall, 8px radius). At a typical 1000px container that is 13 brand columns
     where 11 fit before — the "two more" the redesign asked for, and it falls out of
     the geometry rather than being a second hardcoded cap.
     --------------------------------------------------------------------------- */
  var LEAD_W      = 176;   // topic column -- laengere Topicnamen wurden bei 132 abgeschnitten
  var LEAD_W_NARR = 132;
  var COL_MIN     = 60;    // a brand column never shrinks below this; past that the grid scrolls
  var GAP         = 4;
  /* Fallback caps for the picker when the payload carries no selection.*_limit. Ten was the old
     server default; twelve is what the tighter grid now has room for. The payload always wins —
     see readLimits(). */
  var DEF_TOPIC_LIMIT = 12, DEF_COMPANY_LIMIT = 12;

  var METRICS = [
    { key: "visibility", label: "Visibility" },
    { key: "rank",       label: "Ranking"    },
    { key: "sentiment",  label: "Sentiment"  }
  ];
  /* The switcher's own labels use "Ranking"; the payload and every event use "rank". One place
     to look when they have to be told apart. */
  var METRIC_ALIAS = { ranking: "rank", rank: "rank", visibility: "visibility", sentiment: "sentiment" };

  /* Heat ramp fallback — only reached if performance-radar.css did not load. The real colours
     live in --uhm-h0..--uhm-h4 there (one set per theme). */
  var RAMP_FALLBACK = [[240,243,248],[200,212,229],[138,164,196],[74,110,150],[30,58,95]];

  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  function hexToRgb(h){
    h = String(h == null ? "" : h).trim().replace("#", "");
    if (h.length === 3) h = h.charAt(0)+h.charAt(0)+h.charAt(1)+h.charAt(1)+h.charAt(2)+h.charAt(2);
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* Perceived brightness (ITU-R BT.601). Decides black-vs-white ink on a filled cell instead of
     the old "is the normalized value above 0.35" guess, which got it wrong on the sentiment
     palette (whose colours do not get monotonically darker). */
  function isLightFill(rgb){
    return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 150;
  }

  function rgbCss(rgb){ return "rgb(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ")"; }

  /* ---------------------------------------------------------------------------
     Per-instance persistence: metric, Farbskala und Gewichtungsbalken.

     Bewusst auf `window` und NICHT im localStorage: das ueberlebt genau das, was es ueberleben
     soll -- Bubble reisst das Element bei jeder Aenderung eines dynamischen Ausdrucks ab und baut
     es neu auf, und ohne das waere jeder Drawer-Wechsel ein Zuruecksetzen auf Visibility. Ein
     echter Seitenreload leert window und damit auch das hier: die Ansicht startet wieder im
     Standard. Genau so gewollt -- eine Anzeigeeinstellung, die Wochen spaeter unbemerkt noch
     steht, ist eine Falle.
     --------------------------------------------------------------------------- */
  var METRIC_STORE = (window.__uhmMetric = window.__uhmMetric || {});
  var SCALE_STORE  = (window.__uhmScale  = window.__uhmScale  || {});   // "color" | "mono"
  /* Die Auswahl selbst wird NICHT gespeichert -- sie kommt bei jedem Render aus dem Payload. Was
     gemerkt wird, ist der Zustand des ERSTEN Renders pro Instanz: nur gegen den kann man sagen,
     ob der Benutzer etwas veraendert hat. Ohne diesen Bezugspunkt war der Punkt am Trigger schon
     beim Seitenaufbau an, weil "weniger ausgewaehlt als verfuegbar" auf jede normale Seite
     zutrifft, sobald die Auswahlliste aus dem globalen Store kommt. */
  var INIT_SEL = (window.__uhmInitSel = window.__uhmInitSel || {});
  /* Der Gewichtungs-Schalter ueberlebt als EINZIGE Einstellung den Reload: er beschreibt, WIE VIEL
     man sehen will, nicht was gerade untersucht wird. Metrik und Farbskala bleiben bewusst auf
     window -- die gehoeren zur laufenden Frage und sollen beim naechsten Besuch im Standard
     stehen. localStorage-Schluessel ueber UC.storeKey, damit er sich mit anderen Apps auf
     derselben Domain nicht in die Quere kommt. */
  /* OHNE UC.storeKey, und das ist der Punkt: storeKey haengt die Team-Id an den Schluessel, und
     die steht beim Boot dieser Komponente noch nicht fest -- setUpstreemTeam kommt aus dem
     Page-Load-Workflow und damit spaeter. Gelesen wurde also unter "...@_", geschrieben nach dem
     Umschalten unter "...@team_abc", und der naechste Seitenaufbau fand nichts. Die Einstellung
     war die ganze Zeit gespeichert, nur unter einem Schluessel, den niemand mehr gesucht hat.
     Ein Anzeigeschalter gehoert ohnehin nicht hinter die Team-Trennung: er sagt, wie ICH die
     Heatmap sehen will, nicht welche Daten darin stehen.
     Der alte Schluessel wird beim Lesen noch mitgenommen, damit ein Wert, der es doch einmal
     hineingeschafft hat, nicht verloren geht. */
  function weightKeys(instanceId){
    var raw = "uhm_weights__" + instanceId;
    var UCg = window.UpstreemCore;
    return { plain: raw, legacy: (UCg && UCg.storeKey) ? UCg.storeKey(raw) : null };
  }
  function readWeights(instanceId){
    try {
      var k = weightKeys(instanceId);
      var v = window.localStorage.getItem(k.plain);
      if (v == null && k.legacy) v = window.localStorage.getItem(k.legacy);
      return v === "1";
    } catch(e){ return false; }
  }
  function writeWeights(instanceId, on){
    try { window.localStorage.setItem(weightKeys(instanceId).plain, on ? "1" : "0"); } catch(e){}
  }

  /* Wie viele der vier Balken gefuellt sind. Referenz ist das Maximum der SICHTBAREN Matrix, nicht
     ein globaler Wert: die Frage, die die Balken beantworten sollen, ist "wie ungewoehnlich ist
     diese Zelle im Vergleich zu dem, was daneben steht". Alles ueber null bekommt mindestens einen
     Balken -- sonst sieht "eine Erwaehnung" aus wie "keine". */
  var WEIGHT_STEPS = 4;
  function weightLevel(mentions, max){
    var m = toNum(mentions);
    if (m == null || m <= 0 || !max) return 0;
    return Math.max(1, Math.min(WEIGHT_STEPS, Math.ceil((m / max) * WEIGHT_STEPS)));
  }
  function weightHtml(level){
    var out = '<span class="uhm-w" aria-hidden="true">';
    for (var i = 1; i <= WEIGHT_STEPS; i++) out += '<i' + (i <= level ? ' class="is-on"' : '') + '></i>';
    return out + '</span>';
  }

  /* ---------------------------------------------------------------------------
     Tooltip — ONE body-mounted chip for the whole page, exactly like the Landscape
     chart's. Body-mounted because the grid box clips overflow for its rounded
     corners, so an in-flow tooltip would be cut off on the edge cells.
     --------------------------------------------------------------------------- */
  var tipEl = null, tipRaf = null, tipX = 0, tipY = 0;
  function ensureTip(){
    if (tipEl && document.body.contains(tipEl)) return tipEl;
    tipEl = document.createElement("div");
    tipEl.className = "uhm-tip";
    document.body.appendChild(tipEl);
    return tipEl;
  }
  function hideTip(){
    if (tipRaf){ cancelAnimationFrame(tipRaf); tipRaf = null; }
    if (tipEl) tipEl.classList.remove("is-on");
  }
  /* The legacy destroyHeatmapTooltip() contract: not just hide, actually take it off screen and
     empty it. Bubble calls this when it navigates away while a cell is still hovered. */
  function killTip(){
    hideTip();
    if (tipEl && tipEl.parentNode) tipEl.parentNode.removeChild(tipEl);
    tipEl = null; tipX = 0; tipY = 0;
  }

  function metricRowsHtml(cell){
    var vis = cell.visibility_pct, sv = cell.sentiment, rv = cell.avg_rank;
    var ment = cell.mentions;
    /* Drei Zellen pro Zeile, direkt ins Grid -- KEIN Wrapper-Element. Nur so teilen sich alle
       Zeilen dieselben Spaltenkanten: Label, dann alle Werte auf einer x-Position, dann alle
       Trends auf einer x-Position. Mit einem Wrapper pro Zeile waere jede Zeile ihr eigenes
       Layout und die Zahlen wuerden versetzt stehen. Der Trend kommt NACH dem Wert, weil das die
       Leserichtung ist: erst was es ist, dann wohin es geht. */
    function row(label, valHtml, trendHtml){
      return '<span class="uhm-tip-lbl">' + label + '</span>' +
             '<span class="uhm-tip-val">' + valHtml + '</span>' +
             '<span class="uhm-tip-trend">' + (trendHtml || "") + '</span>';
    }
    var visHtml = vis == null ? '<span class="uhm-tip-empty">-</span>'
      : '<span class="up-num">' + fmtPctShort(vis) + '</span>';
    var sentHtml = sv == null ? '<span class="uhm-tip-empty">-</span>'
      : '<span class="up-sent"><span class="up-sent-dot" style="background:' + sentColor(sv) + '"></span>' +
        '<span class="up-sent-val">' + Math.round(sv) + '</span></span>';
    var rankHtml = rv == null ? '<span class="uhm-tip-empty">-</span>'
      : '<span class="up-rank-group">' + HASH_SVG + '<span class="up-num">' + fmt1(rv) + '</span></span>';
    var mentHtml = ment == null ? '<span class="uhm-tip-empty">-</span>'
      : '<span class="up-num">' + Math.round(ment) + '</span>';
    /* Rank is inverted: a SMALLER number is better, so a negative delta is the green one. */
    return row("Visibility", visHtml, UC.trendChip ? UC.trendChip(cell.visibility_delta_pct, { decimals: true, suffix: "%" }) : "") +
           row("Sentiment",  sentHtml, UC.trendChip ? UC.trendChip(cell.sentiment_delta, {}) : "") +
           row("Avg. Rank",  rankHtml, UC.trendChip ? UC.trendChip(cell.avg_rank_delta, { decimals: true, inverted: true }) : "") +
           row("Mentions",   mentHtml, UC.trendChip ? UC.trendChip(deltaOf(cell.mentions, cell.mentions_prev), {}) : "");
  }
  function deltaOf(now, prev){
    var a = toNum(now), b = toNum(prev);
    if (a == null || b == null) return null;
    return a - b;
  }
  function fmtPctShort(v){
    var n = toNum(v);
    if (n == null) return "-";
    if (n > 0 && Math.round(n) === 0) return "<1%";
    return Math.round(n) + "%";
  }

  function showTip(anchorEl, cell, company, topic, isDark){
    if (!cell){ hideTip(); return; }
    var el = ensureTip();
    el.setAttribute("data-theme", isDark ? "dark" : "light");
    var hex = isDark ? (topic.hexDark || topic.hexLight) : (topic.hexLight || topic.hexDark);
    el.innerHTML =
      '<div class="uhm-tip-head">' +
        '<span class="up-logo-box' + (company.logo ? " has-img" : "") + '">' +
          (company.logo ? '<img src="' + esc(company.logo) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'"/>'
                        : '<span class="up-logo-ltr">' + esc((company.name || "?").charAt(0)) + '</span>') +
        '</span>' +
        '<span class="uhm-tip-name">' + esc(company.name || "") + '</span>' +
      '</div>' +
      '<div class="uhm-tip-topic">' + topicChipHtml(topic, hex, true) + '</div>' +
      '<div class="uhm-tip-sep"></div>' +
      '<div class="uhm-tip-rows">' + metricRowsHtml(cell) + '</div>';

    /* Measure at 0,0 first — the chip is transform-positioned, so its own box has to be known
       before we can decide which side of the cell it fits on. */
    el.style.transform = "translate3d(0,0,0)";
    var tr = el.getBoundingClientRect();
    var cr = anchorEl.getBoundingClientRect();
    var m = 10;
    var tx = cr.right + m;
    if (tx + tr.width + m > window.innerWidth) tx = cr.left - tr.width - m;
    tx = clamp(tx, m, Math.max(m, window.innerWidth - tr.width - m));
    var ty = clamp(cr.top + cr.height / 2 - tr.height / 2, m, Math.max(m, window.innerHeight - tr.height - m));

    if (tipRaf) cancelAnimationFrame(tipRaf);
    var sx = tipX || tx, sy = tipY || ty, st = performance.now(), dur = 110;
    (function step(now){
      var t = Math.min(1, (now - st) / dur);
      var k = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      var cx = sx + (tx - sx) * k, cy = sy + (ty - sy) * k;
      el.style.transform = "translate3d(" + cx + "px," + cy + "px,0)";
      el.classList.add("is-on");
      tipX = cx; tipY = cy;
      if (t < 1) tipRaf = requestAnimationFrame(step); else tipRaf = null;
    })(performance.now());
  }

  /* core.css's .up-topicchip — THE topic chip for the whole app. Nothing chip-shaped is drawn
     locally; only the colour custom property is supplied. */
  function topicChipHtml(topic, hex, isStatic){
    return '<span class="up-topicchip' + (isStatic ? " is-static" : "") + '" style="--ust-tag-color:' + esc(hex || "#6b7280") + '">' +
      (topic.emoji ? '<span class="up-topicchip-e">' + esc(topic.emoji) + '</span>' : "") +
      '<span class="up-topicchip-lbl">' + esc(topic.name == null ? "" : topic.name) + '</span>' +
    '</span>';
  }

  /* ---------------------------------------------------------------------------
     Legacy per-instance aliases.
     renderFestivalHeatmap_<ID> / destroyHeatmapTooltip_<ID> are what the live Bubble
     workflows call. They are registered per root that exists, on this window and on
     parent/top, because a component inside a Bubble reusable lives in its own frame
     while the workflow calling it runs in the page.
     --------------------------------------------------------------------------- */
  function registerLegacyAliases(){
    var roots = document.querySelectorAll(".uhm-root");
    var targets = [window];
    try { if (window.parent && window.parent !== window) targets.push(window.parent); } catch(e){}
    try { if (window.top && window.top !== window && targets.indexOf(window.top) === -1) targets.push(window.top); } catch(e){}
    Array.prototype.forEach.call(roots, function(root){
      var id = root.getAttribute("data-instance") || "default";
      if (!id) return;
      targets.forEach(function(w){
        try {
          w["renderFestivalHeatmap_" + id]  = function(params){ return apiRender(withId(params, id)); };
          w["destroyHeatmapTooltip_" + id]  = function(){ return apiDestroyTip(id); };
        } catch(e){}
      });
    });
  }
  /* The legacy call passes the payload with NO instanceId (the id was baked into the function
     name). Put it back so the normal instance routing works. */
  function withId(params, id){
    var p = UC.normParams ? UC.normParams(params, "uhm-root") : params;
    if (typeof p === "string"){ try { p = JSON.parse(p); } catch(e){ p = {}; } }
    p = p || {};
    if (p.instanceId == null) p.instanceId = id;
    return p;
  }

  /* =========================================================================
     initRoot — one controller per .uhm-root
     ========================================================================= */
  function initRoot(root){
    if (root.__uhmController) return root.__uhmController;

    var instanceId = root.getAttribute("data-instance") || "default";
    var fire = UC.makeFire(root, { label: "performance-radar", eventPrefix: "uhm" });

    var state = {
      cells: [],
      cellMap: {},
      topics: [],            // rows, in render order
      companies: [],         // columns, in render order
      availTopics: [],
      availCompanies: [],
      payloadTopics: [],
      payloadCompanies: [],
      selTopics: {},         // picker draft: id -> bool
      selCompanies: {},
      appliedTopics: [],     // what the last Apply actually sent, for the Reset affordance
      appliedCompanies: [],
      topicLimit: DEF_TOPIC_LIMIT,
      companyLimit: DEF_COMPANY_LIMIT,
      metric: METRIC_ALIAS[String(METRIC_STORE[instanceId] || "").toLowerCase()] || "visibility",
      scale: SCALE_STORE[instanceId] === "mono" ? "mono" : "color",
      weights: readWeights(instanceId),
      isDark: isYes(root.getAttribute("data-isdark")),
      loading: false,
      hasData: false,
      layoutKey: ""          // "topicIds|companyIds" — decides patch vs rebuild
    };

    var elHeading = root.querySelector(".up-heading");
    var elSeg     = root.querySelector(".uhm-metric");
    var elPick    = root.querySelector(".uhm-pick");
    var elPickBtn = root.querySelector(".uhm-pick-btn");
    var elPickMenu= root.querySelector(".uhm-pick-menu");
    /* Der Settings-Block wird NACHGERUESTET, wenn er im Markup fehlt. Die Bubble-Vorlage ist eine
       hand-eingefuegte Kopie: alles, was neu ins Markup kommt, erreicht ein bestehendes Element
       erst, wenn jemand es dort einfuegt -- und bis dahin fehlt die Funktion kommentarlos. Der
       CDN-Pin dagegen erreicht jedes Placement sofort. Dieselbe Ueberlegung, aus der core.js das
       Fader-Icon aus JS schreibt statt es dem Markup zu ueberlassen.
       Steht der Block schon da, wird nichts angefasst. */
    var elTools = root.querySelector(".up-head-tools");
    if (!root.querySelector(".uhm-set") && elTools){
      var setWrap = document.createElement("div");
      setWrap.className = "uhm-set";
      setWrap.innerHTML =
        '<button class="uhm-set-btn up-iconbtn" type="button" data-tip="Settings" aria-label="Settings">' +
          GEAR_SVG +
        '</button>' +
        '<div class="uhm-set-menu up-menu" role="menu" aria-hidden="true"></div>';
      var before = root.querySelector(".uhm-pick");
      if (before) elTools.insertBefore(setWrap, before); else elTools.appendChild(setWrap);
    }
    var elSet     = root.querySelector(".uhm-set");
    var elSetBtn  = root.querySelector(".uhm-set-btn");
    var elSetMenu = root.querySelector(".uhm-set-menu");
    var elGrid    = root.querySelector(".uhm-grid");
    var elBox     = root.querySelector(".uhm-box");
    var elScroll  = root.querySelector(".uhm-scroll");

    if (!elGrid){
      if (window.console) console.error("[performance-radar] .uhm-grid missing in the markup for instance " + instanceId);
      return null;
    }

    /* The fader glyph is WRITTEN from JS rather than trusted to the markup: the CDN pin ships
       JS/CSS while the Bubble markup is a hand-pasted copy, so an icon that only lives in markup
       silently stays on whatever version was pasted last (core.js says the same about
       SLIDERS_ICON at its definition). */
    /* IMMER schreiben, nicht nur in einen leeren Knopf. Der Vorbehalt war der Grund, warum das
       Fader-Zeichen hier auf dem Stand blieb, den das Bubble-Markup gerade trug: der CDN-Pin
       liefert JS/CSS, das Markup ist eine handgemachte Kopie. */
    if (elPickBtn && UC.SLIDERS_ICON){
      elPickBtn.innerHTML = UC.SLIDERS_ICON + '<span class="up-badge is-dot"></span>';
    }

    /* Store-Aenderungen ziehen den Picker nach: legt jemand woanders ein Topic an oder deaktiviert
       eine Marke, ist die neue Liste hier sofort da -- ohne Reload und ohne dass die mutierende
       Stelle wissen muss, dass es diesen Picker gibt. Die Abmeldung haengt am root, core raeumt
       tote Abonnenten selbst weg. */
    if (UC.onTopics) UC.onTopics(function(){ syncAvailable(); if (pickPop.isOpen()) populatePicker(); }, root);
    if (UC.onBrands) UC.onBrands(function(){ syncAvailable(); if (pickPop.isOpen()) populatePicker(); }, root);

    if (UC.makeTooltips) UC.makeTooltips(root, function(){ return state.isDark; });
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 760, vnarrowAt: 520 });
    /* Bubble likes to wrap a component in a plain group div with overflow:hidden and no scrolling
       of its own; that clips the picker menu the moment it hangs below a short component. Same
       call every other dropdown-owning component makes. */
    if (UC.unclipAncestors) UC.unclipAncestors(root);

    var soft = UC.makeSoftReload ? UC.makeSoftReload(root, { delay: 120, killAfter: 15000 })
                                 : { begin: function(){}, end: function(){} };

    /* ---------------- theme ---------------- */
    function syncTheme(){
      var r = UC.syncTheme ? UC.syncTheme(root, state.isDark)
                           : { isDark: isYes(root.getAttribute("data-isdark")), changed: true };
      if (!r.changed) return false;
      state.isDark = r.isDark;
      return true;
    }
    syncTheme();
    if (!root.__uhmThemeObs){
      root.__uhmThemeObs = true;
      try {
        new MutationObserver(function(){
          if (syncTheme()){
            paintCells();
            if (elPick && elPick.classList.contains("is-open")) populatePicker();
            if (elSet && elSet.classList.contains("is-open")) populateSettings();
          }
        }).observe(root, { attributes: true, attributeFilter: ["data-isdark"] });
      } catch(e){}
    }

    /* ---------------- heat ramp ----------------
       Rampe und Interpolation liegen jetzt in core (UC.heatAt), weil der Detailbereich denselben
       Farbwert fuer seine Kurve braucht. Hier bleibt nur, was wirklich diese Komponente ausmacht:
       die entsaettigte Variante und der Schalter dazwischen. */
    /* Entsaettigte Skala: KEINE zweite Palette, sondern dieselbe Rampe ueber ihre wahrgenommene
       Helligkeit (BT.601) auf Grauwerte gezogen. Damit bleiben die Abstufungen exakt dieselben wie
       in der farbigen Variante -- eine handgewaehlte Grau-Palette daneben waere die naechste
       Stelle, die auseinanderlaeuft. */
    function desat(rgb){
      var y = Math.round((rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000);
      return [y, y, y];
    }
    function heatColor(t){
      var out = UC.heatAt ? UC.heatAt(root, t) : RAMP_FALLBACK[Math.round(clamp(t, 0, 1) * 4)];
      return state.scale === "mono" ? desat(out) : out;
    }
    function emptyFill(){
      var cs = null;
      try { cs = getComputedStyle(root); } catch(e){}
      var v = cs ? (cs.getPropertyValue("--uhm-empty") || "").trim() : "";
      return hexToRgb(v) || (state.isDark ? [38,38,38] : [245,245,245]);
    }

    /* ---------------- metric value + colour for one cell ---------------- */
    function rawValue(cell, metric){
      if (!cell) return null;
      if (metric === "sentiment") return toNum(cell.sentiment);
      if (metric === "rank")      return toNum(cell.avg_rank);
      return toNum(cell.visibility_pct);
    }
    /* heat_value_* is precomputed server-side against the whole matrix — using it means the
       shading matches what the backend intends and stays stable when a picker change removes the
       current max. Only when it is absent do we normalise locally from `ranges`. */
    function heatValue(cell, metric){
      if (!cell) return null;
      var pre = toNum(metric === "rank" ? cell.heat_value_rank
                    : metric === "sentiment" ? cell.heat_value_sentiment
                    : cell.heat_value_visibility);
      if (pre != null) return clamp(pre, 0, 1);
      var v = rawValue(cell, metric);
      if (v == null) return null;
      var r = state.ranges || {};
      var mn = toNum(metric === "rank" ? r.rank_min : metric === "sentiment" ? r.sentiment_min : r.visibility_min);
      var mx = toNum(metric === "rank" ? r.rank_max : metric === "sentiment" ? r.sentiment_max : r.visibility_max);
      if (mn == null || mx == null || mx === mn) return 0;
      var t = (v - mn) / (mx - mn);
      return clamp(metric === "rank" ? 1 - t : t, 0, 1);   // rank: lower is better
    }
    function cellText(cell, metric){
      var v = rawValue(cell, metric);
      if (v == null) return "";
      if (metric === "sentiment") return String(Math.round(v));
      if (metric === "rank") return '<span class="uhm-cell-hash">#</span>' + fmt1(v);
      return fmtPctShort(v);
    }
    /* "Has a value" is not the same as "greater than zero": a brand ranked #6 with 0.00%
       visibility is still a real measurement, and a sentiment of exactly 0 is a real (bad) score.
       Only a null reads as no data. Mentions === 0 is the honest empty signal — the row exists
       because the matrix is dense, not because anything was measured. */
    function hasValue(cell, metric){
      if (!cell) return false;
      if (toNum(cell.mentions) === 0) return false;
      return rawValue(cell, metric) != null;
    }

    /* =====================================================================
       Ingest
       ===================================================================== */
    function readLimits(params){
      var sel = params && params.selection;
      var tl = sel ? toNum(sel.topic_limit) : null;
      var cl = sel ? toNum(sel.company_limit) : null;
      state.topicLimit   = tl != null && tl > 0 ? tl : DEF_TOPIC_LIMIT;
      state.companyLimit = cl != null && cl > 0 ? cl : DEF_COMPANY_LIMIT;
    }

    function normTopic(t){
      if (!t) return null;
      var id = t.topic_id != null ? String(t.topic_id) : (t.id != null ? String(t.id) : "");
      if (!id) return null;
      return {
        id: id,
        name: t.name != null ? String(t.name) : (t.topic_name != null ? String(t.topic_name) : id),
        emoji: t.emoji || t.topic_emoji || null,
        hexLight: t.hex_light || t.topic_hex_light || null,
        hexDark: t.hex_dark || t.topic_hex_dark || null,
        pos: toNum(t.selected_position) != null ? toNum(t.selected_position)
             : (toNum(t.position) != null ? toNum(t.position) : (toNum(t.topic_position) != null ? toNum(t.topic_position) : 9999)),
        share: toNum(t.topic_share_pct)
      };
    }
    function normCompany(c){
      if (!c) return null;
      var id = c.company_id != null ? String(c.company_id) : (c.id != null ? String(c.id) : "");
      if (!id) return null;
      return {
        id: id,
        name: c.name != null ? String(c.name) : (c.company_name != null ? String(c.company_name) : id),
        logo: c.logo_url || c.favicon_url || c.favicon || "",
        role: c.role || "",
        pos: toNum(c.selected_position) != null ? toNum(c.selected_position)
             : (toNum(c.position) != null ? toNum(c.position) : (toNum(c.company_position) != null ? toNum(c.company_position) : 9999)),
        visibility: toNum(c.visibility_pct)
      };
    }
    function byPos(a, b){ return (a.pos || 0) - (b.pos || 0); }

    /* The cells array alone is enough to draw the matrix — selected_topics/selected_companies are
       richer (share, role, previous-period numbers) and are preferred when present, but a payload
       that carries only `cells` still renders. That is deliberate: the legacy standalone was
       cells-only, and a workflow still wired that way must not go blank. */
    function ingest(params){
      var cells = Array.isArray(params.cells) ? params.cells : [];
      state.cells = cells;
      state.ranges = params.ranges || null;
      state.cellMap = {};
      var tSeen = {}, cSeen = {}, tFromCells = [], cFromCells = [];
      cells.forEach(function(c){
        if (!c) return;
        var tid = c.topic_id != null ? String(c.topic_id) : "";
        var cid = c.company_id != null ? String(c.company_id) : "";
        if (!tid || !cid) return;
        state.cellMap[tid + "|" + cid] = c;
        if (!tSeen[tid]){ tSeen[tid] = true; tFromCells.push(normTopic(c)); }
        if (!cSeen[cid]){ cSeen[cid] = true; cFromCells.push(normCompany(c)); }
      });

      var selT = Array.isArray(params.selected_topics) ? params.selected_topics.map(normTopic).filter(Boolean) : [];
      var selC = Array.isArray(params.selected_companies) ? params.selected_companies.map(normCompany).filter(Boolean) : [];
      state.topics    = (selT.length ? selT : tFromCells).slice().sort(byPos);
      state.companies = (selC.length ? selC : cFromCells).slice().sort(byPos);

      state.payloadTopics    = Array.isArray(params.available_topics) ? params.available_topics.map(normTopic).filter(Boolean) : [];
      state.payloadCompanies = Array.isArray(params.available_companies) ? params.available_companies.map(normCompany).filter(Boolean) : [];
      syncAvailable();

      /* Seed the picker draft from what is actually on screen, and remember it as the baseline
         the Reset button returns to. */
      state.selTopics = {};    state.topics.forEach(function(t){ state.selTopics[t.id] = true; });
      state.selCompanies = {}; state.companies.forEach(function(c){ state.selCompanies[c.id] = true; });
      state.appliedTopics    = state.topics.map(function(t){ return t.id; });
      state.appliedCompanies = state.companies.map(function(c){ return c.id; });
      if (!INIT_SEL[instanceId] && state.topics.length && state.companies.length){
        INIT_SEL[instanceId] = { topics: state.appliedTopics.slice(), companies: state.appliedCompanies.slice() };
      }

      state.hasData = state.topics.length > 0 && state.companies.length > 0;
    }

    /* =====================================================================
       Grid
       ===================================================================== */
    /* ---- Was der Picker zur Auswahl stellt ----
       Erste Wahl sind die seitenweiten Stores (UC.getTopics / UC.getBrands): dieselbe Liste, die
       auch der Topics-Filter und die Prompts-Tabelle sehen, EIN Bubble-Ausdruck fuer die ganze
       Seite, und ein neu angelegtes Topic erreicht diesen Picker mit. available_topics /
       available_companies aus dem Payload sind der Rueckfall fuer Seiten ohne Store -- und was
       gerade auf dem Schirm steht, ist der Rueckfall vom Rueckfall, damit die Liste nie leer ist.

       Fuer Marken gab es diesen Store bis eben nicht; er ist jetzt in core (setUpstreemBrands /
       upstreemBrandsChanged), gebaut wie der fuer Topics und Markets. */
    function syncAvailable(){
      var storeT = (UC.getTopics ? UC.getTopics() : []).map(normTopic).filter(Boolean);
      var storeC = (UC.getBrands ? UC.getBrands() : []).map(normCompany).filter(Boolean);
      var t = storeT.length ? storeT : (state.payloadTopics.length ? state.payloadTopics : state.topics);
      var c = storeC.length ? storeC : (state.payloadCompanies.length ? state.payloadCompanies : state.companies);
      /* Was auf dem Schirm steht, MUSS waehlbar bleiben -- sonst kann man eine Zeile, die der
         Store nicht kennt, nicht mehr abwaehlen. */
      state.availTopics    = mergeById(t, state.topics);
      state.availCompanies = mergeById(c, state.companies);
    }
    function mergeById(primary, extra){
      var seen = {}, out = [];
      primary.concat(extra).forEach(function(x){
        if (!x || seen[x.id]) return;
        seen[x.id] = true; out.push(x);
      });
      return out.sort(byPos);
    }

    function layoutKeyOf(){
      return state.topics.map(function(t){ return t.id; }).join(",") + "||" +
             state.companies.map(function(c){ return c.id; }).join(",");
    }

    function applyTracks(){
      var lead = root.classList.contains("is-narrow") ? LEAD_W_NARR : LEAD_W;
      var n = Math.max(1, state.companies.length);
      elGrid.style.gridTemplateColumns = lead + "px repeat(" + n + ", minmax(" + COL_MIN + "px, 1fr))";
      elGrid.style.gap = GAP + "px";
      root.style.setProperty("--uhm-lead", lead + "px");
    }

    function colHeadHtml(c){
      var initial = esc((c.name || "?").charAt(0));
      return '<div class="uhm-colhead" data-company="' + esc(c.id) + '" title="' + esc(c.name) + '">' +
          '<span class="uhm-logo' + (c.logo ? " has-img" : "") + '">' +
            '<span class="uhm-logo-ltr">' + initial + '</span>' +
            (c.logo ? '<img src="' + esc(c.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                      ' onerror="this.closest(\'.uhm-logo\').classList.remove(\'has-img\'); this.remove()"/>' : "") +
          '</span>' +
          '<span class="uhm-colname">' + esc(c.name) + '</span>' +
        '</div>';
    }

    function rowHeadHtml(t){
      var hex = state.isDark ? (t.hexDark || t.hexLight) : (t.hexLight || t.hexDark);
      return '<div class="uhm-rowhead" data-topic="' + esc(t.id) + '">' + topicChipHtml(t, hex, true) + '</div>';
    }

    /* Alles, was eine Zelle ausmacht -- Fuellung, Schriftfarbe, Text, Gewichtungsbalken -- in
       EINEM Schritt. Rueckgabe ist ein HTML-Fragment, kein Style-Schreibzugriff im Nachhinein.
       Genau daran hing der Fehler, dass die Zahlen erst weiss aufblitzten: .uhm-cell hat eine
       transition auf color, der Default ist helle Schrift, und ein nachtraegliches Setzen der
       richtigen Farbe hat diese Transition ausgeloest. Steht die Farbe schon im gelieferten
       Markup, gibt es keinen Ausgangswert, von dem aus ueberblendet werden koennte. */
    function cellInner(cell, metric, empty, maxMentions){
      var on = hasValue(cell, metric);
      if (!on) return { cls: " is-empty", style: "background:" + rgbCss(empty), html: "" };
      var rgb;
      if (metric === "sentiment"){
        rgb = hexToRgb(sentColor(rawValue(cell, metric))) || empty;
        /* Auch hier entsaettigen: eine Einstellung namens "Schwarzweiss", bei der die
           Sentiment-Ansicht weiter bunt ist, waere keine. */
        if (state.scale === "mono") rgb = desat(rgb);
      } else {
        rgb = heatColor(heatValue(cell, metric) || 0);
      }
      var html = cellText(cell, metric);
      if (state.weights) html += weightHtml(weightLevel(cell.mentions, maxMentions));
      return { cls: isLightFill(rgb) ? " is-onlight" : "", style: "background:" + rgbCss(rgb), html: html };
    }
    /* Bezugsgroesse der Gewichtungsbalken: das Maximum der aktuell sichtbaren Matrix. */
    function maxMentions(){
      var m = 0;
      state.topics.forEach(function(t){
        state.companies.forEach(function(c){
          var v = toNum((state.cellMap[t.id + "|" + c.id] || {}).mentions);
          if (v != null && v > m) m = v;
        });
      });
      return m;
    }

    function buildGrid(){
      applyTracks();
      var metric = state.metric, empty = emptyFill(), mx = maxMentions();
      var html = '<div class="uhm-corner"></div>';
      state.companies.forEach(function(c){ html += colHeadHtml(c); });
      state.topics.forEach(function(t){
        html += rowHeadHtml(t);
        state.companies.forEach(function(c){
          var key = t.id + "|" + c.id;
          var v = cellInner(state.cellMap[key], metric, empty, mx);
          html += '<div class="uhm-cell' + v.cls + '" data-key="' + esc(key) + '"' +
                  ' data-topic="' + esc(t.id) + '" data-company="' + esc(c.id) + '"' +
                  ' style="' + v.style + '">' + v.html + '</div>';
        });
      });
      elGrid.innerHTML = html;
      state.layoutKey = layoutKeyOf();
      runAppear();
    }

    /* Repaint WITHOUT touching the DOM structure — this is what makes the metric switch animate:
       the same nodes get a new background-color and the CSS transition on .uhm-cell does the rest.
       A full rebuild would swap the nodes and there would be nothing to transition between.
       Beim ERSTEN Aufbau laeuft das bewusst nicht (siehe buildGrid) -- dort waere die Transition
       kein Effekt, sondern ein Fehler. */
    function paintCells(){
      var metric = state.metric, empty = emptyFill(), mx = maxMentions();
      Array.prototype.forEach.call(elGrid.querySelectorAll(".uhm-cell"), function(el){
        var cell = state.cellMap[el.getAttribute("data-key")];
        var v = cellInner(cell, metric, empty, mx);
        el.style.background = v.style.slice("background:".length);
        el.classList.toggle("is-empty", v.cls === " is-empty");
        el.classList.toggle("is-onlight", v.cls === " is-onlight");
        el.innerHTML = v.html;
        el.setAttribute("aria-hidden", v.cls === " is-empty" ? "true" : "false");
      });
      /* Row/column headers carry the theme's topic colour, which flips with the theme. */
      Array.prototype.forEach.call(elGrid.querySelectorAll(".uhm-rowhead"), function(el){
        var t = topicById(el.getAttribute("data-topic"));
        if (!t) return;
        var chip = el.querySelector(".up-topicchip");
        if (chip) chip.style.setProperty("--ust-tag-color", (state.isDark ? (t.hexDark || t.hexLight) : (t.hexLight || t.hexDark)) || "#6b7280");
      });
    }

    /* Appear animation: a short diagonal stagger, capped so a big matrix does not take a second
       to finish. Removed once it has run so the metric-switch transition owns the cells again —
       an animation still attached to the node would win over the transition. */
    var appearTimer = null;
    function runAppear(){
      var nodes = elGrid.querySelectorAll(".uhm-cell, .uhm-colhead, .uhm-rowhead");
      var cols = Math.max(1, state.companies.length);
      var maxStep = 240;
      Array.prototype.forEach.call(nodes, function(el, i){
        var r = Math.floor(i / (cols + 1)), c = i % (cols + 1);
        var d = Math.min(maxStep, (r + c) * 12);
        el.style.animationDelay = d + "ms";
      });
      elGrid.classList.remove("is-appear");
      void elGrid.offsetWidth;                 // forced reflow: restart the animation
      elGrid.classList.add("is-appear");
      clearTimeout(appearTimer);
      appearTimer = setTimeout(function(){
        elGrid.classList.remove("is-appear");
        Array.prototype.forEach.call(nodes, function(el){ el.style.animationDelay = ""; });
      }, maxStep + 340);
    }

    function topicById(id){
      for (var i = 0; i < state.topics.length; i++) if (state.topics[i].id === id) return state.topics[i];
      for (var j = 0; j < state.availTopics.length; j++) if (state.availTopics[j].id === id) return state.availTopics[j];
      return null;
    }
    function companyById(id){
      for (var i = 0; i < state.companies.length; i++) if (state.companies[i].id === id) return state.companies[i];
      for (var j = 0; j < state.availCompanies.length; j++) if (state.availCompanies[j].id === id) return state.availCompanies[j];
      return null;
    }

    /* Skeleton: same pulse token every other component uses (--vc-sk + uutpulse). */
    /* Das Skelett bekommt die Hoehe, die vorher dastand. Ein Ladezustand, der die Seite
       zusammenschnurren oder aufspringen laesst, ist selbst eine Stoerung -- und beim Zurueckkommen
       springt sie ein zweites Mal. Die Zeilenzahl kommt darum aus den zuletzt gezeigten Themen,
       nicht aus einer festen 7. Gab es noch nie Daten, bleibt es beim Vorgabemass.
       Nur die Zeilen, nicht die Spalten: die Spaltenbreite ist ein Raster mit minmax(), da wuerde
       eine abweichende Spaltenzahl die Breite verschieben statt sie zu erhalten. */
    function renderSkeleton(){
      var rows = 7, cols = 6;
      var vorher = (state.topics || []).length;
      if (vorher > 0) rows = vorher;
      elGrid.style.gridTemplateColumns = (root.classList.contains("is-narrow") ? LEAD_W_NARR : LEAD_W) +
        "px repeat(" + cols + ", minmax(" + COL_MIN + "px, 1fr))";
      elGrid.style.gap = GAP + "px";
      var html = '<div class="uhm-corner"></div>';
      for (var c = 0; c < cols; c++) html += '<div class="uhm-colhead is-sk"><span class="uhm-sk-logo"></span><span class="uhm-sk-bar"></span></div>';
      for (var r = 0; r < rows; r++){
        html += '<div class="uhm-rowhead is-sk"><span class="uhm-sk-chip"></span></div>';
        for (var k = 0; k < cols; k++) html += '<div class="uhm-cell is-sk"></div>';
      }
      elGrid.innerHTML = html;
      /* Die Zeilenzahl allein trifft die Hoehe nur ungefaehr: die echten Zeilenkoepfe tragen
         Themen-Chips, die Skelettbalken sind ein paar Pixel flacher. Darum zusaetzlich die
         zuletzt gemessene echte Hoehe als Mindestmass -- damit steht das Skelett exakt so hoch
         wie das, was es ersetzt, und die Seite springt beim Hin- und Herwechseln nicht. */
      elGrid.style.minHeight = state.lastGridH ? (state.lastGridH + "px") : "";
      state.layoutKey = "";
    }
    function renderEmpty(){
      elGrid.style.gridTemplateColumns = "1fr";
      elGrid.innerHTML = '<div class="uhm-empty">No data</div>';
      state.layoutKey = "";
    }

    function render(){
      /* Solange geladen wird, gewinnt der Ladezustand -- auch wenn schon Daten dastehen. Sonst
         zeichnet der naechste render() waehrend eines laufenden Ladevorgangs die ALTEN Zahlen
         ueber das Skelett, und man sieht wieder Werte, die gerade ersetzt werden. */
      if (state.loading){ renderSkeleton(); syncPickBtn(); return; }
      if (!state.hasData){
        renderEmpty();
        syncPickBtn();
        return;
      }
      elGrid.style.minHeight = "";
      var key = layoutKeyOf();
      if (key === state.layoutKey && elGrid.querySelector(".uhm-cell:not(.is-sk)")) paintCells();
      else buildGrid();
      /* Fuer das naechste Skelett merken, wie hoch die echten Daten stehen. */
      try { state.lastGridH = Math.round(elGrid.getBoundingClientRect().height) || 0; } catch(e){}
      syncPickBtn();
    }

    /* =====================================================================
       Toolbar: metric switcher
       ===================================================================== */
    function syncSeg(){
      if (!elSeg) return;
      Array.prototype.forEach.call(elSeg.querySelectorAll("[data-metric]"), function(b){
        var on = METRIC_ALIAS[b.getAttribute("data-metric")] === state.metric;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    function setMetric(m, fireEvent){
      m = METRIC_ALIAS[String(m || "").toLowerCase()] || "visibility";
      if (m === state.metric && fireEvent !== true) return;
      state.metric = m;
      METRIC_STORE[instanceId] = m;
      syncSeg();
      paintCells();
      /* No data round trip needed — every cell already carries all three numbers. The event still
         goes out so a workflow can persist the choice or keep a Bubble state in sync. */
      if (fireEvent !== false) fire("data-metric-fn", "uhmMetric", { metric: m });
    }

    /* =====================================================================
       Toolbar: the fader picker (brands left, topics right)
       ===================================================================== */
    var pickPop = (elPick && elPickMenu)
      ? UC.makePopover({ wrap: elPick, menu: elPickMenu, opener: elPickBtn, group: "uhm-" + instanceId,
                         onClose: function(committed){ if (!committed) resetDraft(); } })
      : { open: function(){}, close: function(){}, toggle: function(){}, isOpen: function(){ return false; } };

    var pickQuery = { brands: "", topics: "" };

    function resetDraft(){
      state.selTopics = {};    state.appliedTopics.forEach(function(id){ state.selTopics[id] = true; });
      state.selCompanies = {}; state.appliedCompanies.forEach(function(id){ state.selCompanies[id] = true; });
    }
    function countSel(map){ var n = 0, k; for (k in map) if (map[k]) n++; return n; }
    function selectedIds(map, order){
      var out = [];
      order.forEach(function(x){ if (map[x.id]) out.push(x.id); });
      return out;
    }

    function pickColumnHtml(side, title, list, selMap, cap, itemHtml){
      var sel = countSel(selMap);
      var atMax = sel >= cap;
      var q = (pickQuery[side] || "").trim().toLowerCase();
      var items = list.map(function(x){
        var on = !!selMap[x.id];
        var disabled = !on && atMax;
        var hay = String(x.name || "").toLowerCase();
        var hit = !q || hay.indexOf(q) > -1;
        return '<div class="up-filter-item' + (on ? " is-checked" : "") + (disabled ? " is-disabled" : "") +
          '" data-side="' + side + '" data-id="' + esc(x.id) + '"' +
          (hit ? "" : ' style="display:none"') + ' title="' + esc(x.name) + '">' +
          '<span class="up-filter-check">' + CHECK_SVG + '</span>' + itemHtml(x) + '</div>';
      }).join("");
      var shown = list.filter(function(x){ return !q || String(x.name || "").toLowerCase().indexOf(q) > -1; }).length;
      return '<div class="uhm-pick-col" data-col="' + side + '">' +
        '<div class="up-filter-head">' +
          '<span class="up-filter-title">' + title + '</span>' +
          '<span class="uhm-pick-count">' + sel + '/' + Math.min(list.length, cap) + '</span>' +
        '</div>' +
        '<div class="up-ment-searchwrap">' +
          '<input class="up-ment-search uhm-pick-search" data-side="' + side + '" type="text" ' +
            'placeholder="Search ' + title.toLowerCase() + '..." autocomplete="off" spellcheck="false" value="' + esc(pickQuery[side]) + '"/>' +
          '<button class="up-ment-searchclear" type="button" data-side="' + side + '" aria-label="Clear search">' + X_SVG + '</button>' +
        '</div>' +
        '<div class="up-filter-list uhm-pick-list">' + items +
          '<div class="up-ment-noresult"' + (shown ? ' style="display:none"' : "") + '>No matches</div>' +
        '</div>' +
      '</div>';
    }

    /* Jeder Klick auf einen Eintrag baut das Menue komplett neu -- anders bekaeme man den Zaehler,
       die Kappungs-Sperre der anderen Eintraege und den Reset-Knopf nicht mit. Der Neuaufbau wirft
       aber auch die beiden Scroll-Container weg, und der Ersatz startet bei 0. Wer weit unten in
       den Topics etwas anhakte, landete darum jedes Mal wieder ganz oben. Die Scrollposition wird
       deshalb ueber den Neuaufbau getragen, pro Spalte getrennt. */
    function pickScrollLesen(){
      var s = {};
      if (!elPickMenu) return s;
      Array.prototype.forEach.call(elPickMenu.querySelectorAll(".uhm-pick-col"), function(col){
        var list = col.querySelector(".uhm-pick-list");
        if (list) s[col.getAttribute("data-col")] = list.scrollTop;
      });
      return s;
    }
    function pickScrollSchreiben(s){
      if (!elPickMenu || !s) return;
      Array.prototype.forEach.call(elPickMenu.querySelectorAll(".uhm-pick-col"), function(col){
        var list = col.querySelector(".uhm-pick-list");
        var v = s[col.getAttribute("data-col")];
        /* Nach einer Suche ist die Liste kuerzer als vorher; ohne die Klammer scrollte sie sonst
           auf einen Wert, den es nicht mehr gibt, und stand danach am unteren Anschlag. */
        if (list && v) list.scrollTop = Math.min(v, Math.max(0, list.scrollHeight - list.clientHeight));
      });
    }

    function populatePicker(){
      if (!elPickMenu) return;
      var scrollStand = pickScrollLesen();
      if (!state.availCompanies.length && !state.availTopics.length){
        elPickMenu.innerHTML = '<div class="up-ment-empty">Nothing to pick yet</div>';
        return;
      }
      var brands = pickColumnHtml("brands", "Brands", state.availCompanies, state.selCompanies, state.companyLimit,
        function(c){
          var initial = esc((c.name || "?").charAt(0));
          return '<span class="up-ment-logo">' +
                   (c.logo ? '<img src="' + esc(c.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.style.visibility=\'hidden\'"/>'
                           : '<span class="uhm-pick-ltr">' + initial + '</span>') +
                 '</span><span class="up-ment-name">' + esc(c.name) + '</span>';
        });
      var topics = pickColumnHtml("topics", "Topics", state.availTopics, state.selTopics, state.topicLimit,
        function(t){
          var hex = state.isDark ? (t.hexDark || t.hexLight) : (t.hexLight || t.hexDark);
          return topicChipHtml(t, hex, true);
        });
      /* Reset zeigt sich, sobald IRGENDETWAS vom Ausgangszustand abweicht -- der noch nicht
         abgeschickte Entwurf ODER die bereits angewendete Auswahl. Vorher hing er nur am
         Entwurf und verschwand damit direkt nach dem Apply, also genau dann, wenn man ihn
         braucht. */
      var draftT = selectedIds(state.selTopics, state.availTopics);
      var draftC = selectedIds(state.selCompanies, state.availCompanies);
      var dirty = !sameSet(draftC, state.appliedCompanies) || !sameSet(draftT, state.appliedTopics) ||
                  changedFromInitial();
      elPickMenu.innerHTML =
        '<div class="uhm-pick-cols">' + brands + topics + '</div>' +
        '<div class="uhm-pick-foot">' +
          '<button class="up-filter-submit uhm-pick-apply" type="button" data-pickapply>Apply</button>' +
          (dirty ? '<button class="up-pop-action" type="button" data-pickreset>Reset</button>' : '') +
        '</div>';
      pickScrollSchreiben(scrollStand);
    }

    function sameSet(a, b){
      if (a.length !== b.length) return false;
      var m = {}; b.forEach(function(x){ m[x] = true; });
      return a.every(function(x){ return m[x]; });
    }

    /* =====================================================================
       Einstellungen (Zahnrad oben rechts)
       Aufbau bewusst der der Table-Settings: .up-menu als Panel, .up-pop-head als
       Abschnittstitel, .up-scale-opt/.up-scale-dots fuer die Farbskala (dieselben runden,
       ueberlappenden Punkte wie im Chart-Settings-Menue der Linecharts) und .up-pop-row +
       .up-switch fuer den Schalter. Nichts davon ist hier neu gebaut.
       ===================================================================== */
    var setPop = (elSet && elSetMenu)
      ? UC.makePopover({ wrap: elSet, menu: elSetMenu, opener: elSetBtn, group: "uhm-" + instanceId })
      : { open: function(){}, close: function(){}, toggle: function(){}, isOpen: function(){ return false; } };

    /* Vier Punkte, aus derselben Rampe entnommen, die das Chart benutzt -- die Vorschau kann
       darum gar nicht von der Wirklichkeit abweichen. Positionen 1..4 von 5 Stops, damit der
       hellste (fast weisse) Stop die Vorschau nicht anfuehrt. */
    function scaleDotsHtml(mono){
      var stops = (UC.heatRamp ? UC.heatRamp(root) : null) || RAMP_FALLBACK, out = "";
      for (var i = 1; i < 5; i++){
        var rgb = stops[i];
        if (mono){ var y = Math.round((rgb[0]*299 + rgb[1]*587 + rgb[2]*114)/1000); rgb = [y,y,y]; }
        out += '<span class="up-scale-dot" style="background:' + rgbCss(rgb) + '"></span>';
      }
      return '<span class="up-scale-dots">' + out + '</span>';
    }
    function scaleOptHtml(key, label, mono){
      return '<div class="up-scale-opt' + (state.scale === key ? " is-active" : "") + '" data-scale="' + key + '">' +
        '<div class="up-scale-opt-head"><span class="up-scale-opt-lbl">' + label + '</span>' +
          '<span class="up-check">' + CHECK_SVG + '</span></div>' +
        scaleDotsHtml(mono) + '</div>';
    }
    function populateSettings(){
      if (!elSetMenu) return;
      elSetMenu.innerHTML =
        '<div class="up-pop-head">Color scale</div>' +
        scaleOptHtml("color", "Default", false) +
        scaleOptHtml("mono",  "Monochrome", true) +
        '<div class="up-pop-div"></div>' +
        '<div class="up-pop-row" data-weights role="button" tabindex="0">' +
          '<span class="up-pop-label">Mentions weight</span>' +
          '<span class="up-switch' + (state.weights ? " is-on" : "") + '"></span>' +
        '</div>' +
        '<div class="uhm-set-note">Shows how many mentions a value is based on.</div>';
    }
    function setScale(key){
      key = key === "mono" ? "mono" : "color";
      if (key === state.scale) return;
      state.scale = key;
      SCALE_STORE[instanceId] = key;
      populateSettings();
      paintCells();
    }
    function setWeights(on){
      on = !!on;
      if (on === state.weights) return;
      state.weights = on;
      writeWeights(instanceId, on);
      root.classList.toggle("has-weights", on);
      populateSettings();
      paintCells();
    }

    /* Weicht die aktuell GEZEIGTE Auswahl vom ersten Render ab? Das ist die Frage, die der Punkt
       am Trigger beantwortet -- nicht "sind weniger ausgewaehlt als verfuegbar". */
    function changedFromInitial(){
      var init = INIT_SEL[instanceId];
      if (!init) return false;
      return !sameSet(state.appliedTopics, init.topics) ||
             !sameSet(state.appliedCompanies, init.companies);
    }
    function syncPickBtn(){
      if (!elPick) return;
      var badge = elPick.querySelector(".up-badge");
      var changed = state.hasData && changedFromInitial();
      elPick.classList.toggle("is-active", changed);
      if (badge) badge.classList.toggle("is-visible", changed);
    }

    function applyPicker(){
      var cIds = selectedIds(state.selCompanies, state.availCompanies);
      var tIds = selectedIds(state.selTopics, state.availTopics);
      if (!cIds.length || !tIds.length) return;    // an empty axis is not a chart
      state.appliedCompanies = cIds;
      state.appliedTopics = tIds;

      /* Optimistic local narrowing: everything the user KEPT we already have data for, so redraw
         it immediately instead of showing a skeleton for a change that is partly free. Anything
         newly ADDED has no cells yet and only appears once the workflow answers — which is why
         the soft dim runs until then rather than nothing at all. */
      var keepT = {}, keepC = {};
      tIds.forEach(function(id){ keepT[id] = true; });
      cIds.forEach(function(id){ keepC[id] = true; });
      var nextT = state.availTopics.filter(function(t){ return keepT[t.id] && hasAnyCellForTopic(t.id); });
      var nextC = state.availCompanies.filter(function(c){ return keepC[c.id] && hasAnyCellForCompany(c.id); });
      if (nextT.length && nextC.length){
        state.topics = nextT;
        state.companies = nextC;
        render();
      }
      soft.begin(state.hasData);
      /* VOR dem Bubble-Event leeren, aus demselben Grund wie beim Zellklick: der Workflow startet
         seine Run-JS-Schritte sofort, und ein Reset danach wuerde wegraeumen, was gerade
         angekommen ist. */
      resetDetail();
      fire("data-select-fn", "uhmSelect", { company_ids: cIds.join(","), topic_ids: tIds.join(",") });
      pickPop.close(true);
      syncPickBtn();
    }
    function hasAnyCellForTopic(tid){
      for (var k in state.cellMap) if (state.cellMap.hasOwnProperty(k) && k.indexOf(tid + "|") === 0) return true;
      return false;
    }
    function hasAnyCellForCompany(cid){
      for (var k in state.cellMap) if (state.cellMap.hasOwnProperty(k) && k.slice(k.indexOf("|") + 1) === cid) return true;
      return false;
    }

    /* ---------------- events ---------------- */
    root.addEventListener("click", function(e){
      var mb = e.target.closest("[data-metric]");
      if (mb && elSeg && elSeg.contains(mb)){ setMetric(mb.getAttribute("data-metric")); return; }

      if (elSetBtn && e.target.closest(".uhm-set-btn")){
        e.stopPropagation();
        if (setPop.isOpen()){ setPop.close(false); return; }
        populateSettings();
        setPop.open();
        return;
      }
      if (elSetMenu && elSetMenu.contains(e.target)){
        var so = e.target.closest("[data-scale]");
        if (so){ setScale(so.getAttribute("data-scale")); return; }
        if (e.target.closest("[data-weights]")){ setWeights(!state.weights); return; }
        return;
      }

      if (elPickBtn && e.target.closest(".uhm-pick-btn")){
        e.stopPropagation();
        if (pickPop.isOpen()){ pickPop.close(false); return; }
        resetDraft();
        populatePicker();
        pickPop.open();
        return;
      }

      if (elPickMenu && elPickMenu.contains(e.target)){
        var clear = e.target.closest(".up-ment-searchclear");
        if (clear){
          pickQuery[clear.getAttribute("data-side")] = "";
          populatePicker();
          var back = elPickMenu.querySelector('.uhm-pick-search[data-side="' + clear.getAttribute("data-side") + '"]');
          if (back) back.focus();
          return;
        }
        if (e.target.closest("[data-pickreset]")){
          /* Zurueck auf den Ausgangszustand und sofort anwenden -- ein Reset, der nur den Entwurf
             zuruecksetzt und die angewendete Auswahl stehen laesst, waere kein Reset. */
          var init = INIT_SEL[instanceId];
          if (init){
            state.selTopics = {};    init.topics.forEach(function(id){ state.selTopics[id] = true; });
            state.selCompanies = {}; init.companies.forEach(function(id){ state.selCompanies[id] = true; });
            populatePicker();
            applyPicker();
          } else { resetDraft(); populatePicker(); }
          return;
        }
        if (e.target.closest("[data-pickapply]")){ applyPicker(); return; }
        var item = e.target.closest(".up-filter-item[data-id]");
        if (item){
          if (item.classList.contains("is-disabled")) return;
          var side = item.getAttribute("data-side"), id = item.getAttribute("data-id");
          var map = side === "topics" ? state.selTopics : state.selCompanies;
          var cap = side === "topics" ? state.topicLimit : state.companyLimit;
          if (map[id]) delete map[id];
          else if (countSel(map) < cap) map[id] = true;
          populatePicker();
          return;
        }
        return;
      }

      /* Cell click — the legacy contract, unchanged: one plain string "companyId||topicId",
         NOT JSON, on window.bubble_fn_heatmap_cell_clicked. */
      var cell = e.target.closest(".uhm-cell");
      if (cell && !cell.classList.contains("is-empty") && !cell.classList.contains("is-sk")){
        emitCellClick(cell.getAttribute("data-company"), cell.getAttribute("data-topic"));
      }
    });

    if (elPickMenu){
      elPickMenu.addEventListener("input", function(e){
        var inp = e.target.closest(".uhm-pick-search");
        if (!inp) return;
        var side = inp.getAttribute("data-side");
        pickQuery[side] = inp.value;
        /* Filter in place instead of re-rendering the panel: rebuilding would blur the field on
           every keystroke, which is how a search box ends up eating the second character. */
        var col = inp.closest(".uhm-pick-col");
        var q = pickQuery[side].trim().toLowerCase();
        var shown = 0;
        Array.prototype.forEach.call(col.querySelectorAll(".up-filter-item[data-id]"), function(it){
          var hit = !q || (it.getAttribute("title") || "").toLowerCase().indexOf(q) > -1;
          it.style.display = hit ? "" : "none";
          if (hit) shown++;
        });
        var nr = col.querySelector(".up-ment-noresult");
        if (nr) nr.style.display = shown ? "none" : "";
      });
    }

    /* Den Detailbereich unter dem Radar direkt fuellen, ohne Umweg ueber den Server.
       Kopf, KPIs und das Standing auf dem Topic stecken alle schon im Raster: die Zelle liefert
       die Werte, die SPALTE die Wettbewerber auf diesem Topic, die ZEILE dieselbe Marke ueber alle
       Topics. Damit steht der Block sofort, und die RPCs fuellen nur noch Kurve, Variations und
       die URLs-Table darunter nach -- statt dass der Nutzer erst auf einen Ladebalken sieht fuer
       Zahlen, die zwei Zentimeter weiter oben schon auf dem Schirm stehen.
       Fehlt die Komponente auf der Seite, passiert hier gar nichts: der Radar funktioniert
       unveraendert allein. */
    /* Welcher Detailbereich gehoert zu DIESEM Radar? Nicht ueber gleiche data-instance-Werte --
       das sind zwei Ids, die jemand von Hand synchron halten muesste, und genau daran ist es beim
       ersten Einbau gescheitert. Die Antwort steht im Layout: es ist der Block, der raeumlich zu
       diesem Radar gehoert. Also vom eigenen Wurzelelement nach oben gehen und im ersten Vorfahren,
       der ueberhaupt einen enthaelt, den nehmen. Auf einer Seite mit mehreren Radar-Detail-Paaren
       trifft das jedes Paar richtig, solange die beiden zusammen in einer Gruppe liegen -- und so
       baut man sie ohnehin. data-detail-instance auf dem Radar hat weiterhin Vorrang, falls die
       Zuordnung mal wirklich ueber Kreuz laufen soll. */
    function nearestDetailInstance(){
      try {
        var node = root;
        while (node && node !== document.body){
          var hit = node.querySelector ? node.querySelector(".upd-root") : null;
          if (hit) return hit.getAttribute("data-instance") || "default";
          node = node.parentElement;
        }
        /* Kein gemeinsamer Vorfahre: dann der erste, der im Dokument NACH diesem Radar steht. */
        var all = document.querySelectorAll(".upd-root");
        for (var i = 0; i < all.length; i++){
          if (root.compareDocumentPosition(all[i]) & 4) return all[i].getAttribute("data-instance") || "default";
        }
      } catch(e){}
      return null;
    }

    function detailInstance(){
      return root.getAttribute("data-detail-instance") || nearestDetailInstance() || instanceId;
    }

    /* Nach einem Apply zeigen die Achsen etwas anderes als vorher. Die Zelle, auf der der
       Detailbereich steht, kann gerade weggefiltert worden sein -- und selbst wenn sie bleibt,
       gehoert der Vergleich darunter (Spalte = alle Marken auf dem Topic, Zeile = diese Marke
       ueber alle Topics) zum alten Raster. Der Bereich wird darum geleert, statt eine Auswertung
       stehen zu lassen, die zur neuen Auswahl nicht mehr passt.
       Der Radar macht das selbst, weil er es ohnehin ist, der den Detailbereich fuellt. Die
       SICHTBARKEIT der Bubble-Gruppe darum herum kann er nicht anfassen, das ist ein Custom
       State -- dafuer braucht der uhmSelect-Workflow einen eigenen Schritt. */
    function resetDetail(){
      var fn = window.resetPerformanceDetail;
      if (typeof fn !== "function") return;
      try { fn(detailInstance()); } catch(e){
        if (window.console) console.warn("[performance-radar] resetPerformanceDetail threw:", e);
      }
    }

    function feedDetail(companyId, topicId){
      var fn = window.renderPerformanceDetail;
      if (typeof fn !== "function") return;
      var co = companyById(companyId), tp = topicById(topicId);
      if (!co || !tp) return;
      var cell = state.cellMap[topicId + "|" + companyId] || null;
      var hex = (state.isDark ? (tp.hexDark || tp.hexLight) : (tp.hexLight || tp.hexDark)) || "#6b7280";

      /* Spalte: alle Marken auf DIESEM Topic. Zeile: diese Marke ueber alle Topics. Beide nur aus
         dem, was gerade sichtbar ist -- was der Picker ausgeblendet hat, gehoert auch nicht in den
         Vergleich darunter. */
      var column = state.companies.map(function(c){
        var cc = state.cellMap[topicId + "|" + c.id];
        return cc ? {
          company_id: c.id, name: c.name, favicon_url: c.logo,
          visibility_pct: cc.visibility_pct, sentiment: cc.sentiment,
          avg_rank: cc.avg_rank, mentions: cc.mentions
        } : null;
      }).filter(Boolean);
      var row = state.topics.map(function(t){
        var cc = state.cellMap[t.id + "|" + companyId];
        return cc ? {
          topic_id: t.id, name: t.name,
          visibility_pct: cc.visibility_pct, visibility_delta_pct: cc.visibility_delta_pct,
          sentiment: cc.sentiment, sentiment_delta: cc.sentiment_delta,
          avg_rank: cc.avg_rank, avg_rank_delta: cc.avg_rank_delta,
          mentions: cc.mentions, mentions_prev: cc.mentions_prev
        } : null;
      }).filter(Boolean);

      try {
        fn({
          instanceId: detailInstance(),
          company: { company_id: co.id, name: co.name, favicon_url: co.logo },
          topic:   { topic_id: tp.id, name: tp.name, emoji: tp.emoji, color: hex },
          cell: cell, topic_column: column, brand_row: row
        });
      } catch(e){
        if (window.console) console.warn("[performance-radar] renderPerformanceDetail threw:", e);
      }
    }

    function emitCellClick(companyId, topicId){
      var payload = String(companyId == null ? "" : companyId) + "||" + String(topicId == null ? "" : topicId);
      var fnName = root.getAttribute("data-cell-fn") || "bubble_fn_heatmap_cell_clicked";
      /* ZUERST den Detailbereich, DANN den Bubble-Workflow. Andersherum startet der Workflow seine
         Run-JS-Schritte, waehrend die Auswahl hier noch nicht gesetzt ist -- und setSelection()
         raeumt danach auf, was gerade angekommen ist. Das Ergebnis war ein Block, der dauerhaft im
         Ladezustand stand, obwohl beide Aufrufe durchgelaufen waren. */
      feedDetail(companyId, topicId);
      var fn = UC.resolveBubbleFn ? UC.resolveBubbleFn(fnName) : window[fnName];
      if (typeof fn === "function"){ try { fn(payload); } catch(e){} }
      else if (window.console){
        console.warn("[performance-radar] " + fnName + " not found on window/parent/top or any " +
          "reachable iframe — the cell click reached no Bubble workflow. Check the Toolbox element's name.");
      }
      try { root.dispatchEvent(new CustomEvent("uhmCellClick", { detail: { company_id: companyId, topic_id: topicId }, bubbles: true })); } catch(e){}
      hideTip();
    }

    /* hover tooltip */
    elGrid.addEventListener("mouseover", function(e){
      var cell = e.target.closest(".uhm-cell");
      if (!cell || cell.classList.contains("is-empty") || cell.classList.contains("is-sk")) return;
      var data = state.cellMap[cell.getAttribute("data-key")];
      var co = companyById(cell.getAttribute("data-company"));
      var tp = topicById(cell.getAttribute("data-topic"));
      if (!data || !co || !tp) return;
      showTip(cell, data, co, tp, state.isDark);
    });
    elGrid.addEventListener("mouseout", function(e){
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(".uhm-cell")) return;
      hideTip();
    });
    if (elScroll) elScroll.addEventListener("scroll", hideTip, { passive: true });

    /* Re-flow the tracks when the container width crosses a breakpoint (the lead column narrows). */
    if (UC.onResize) UC.onResize(root, function(){
      if (state.hasData && state.layoutKey) applyTracks();
    });

    /* =====================================================================
       Public surface for this root
       ===================================================================== */
    var ctrl = {
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          root.setAttribute("data-isdark", isYes(params.isDark) ? "yes" : "no");
          syncTheme();
        }
        readLimits(params);
        if (params.metric != null){
          /* An explicit metric in the payload only wins the FIRST time; after that the user's own
             switcher click owns it, exactly like the granularity switchers elsewhere. */
          if (METRIC_STORE[instanceId] == null) setMetric(params.metric, false);
        }
        ingest(params);
        /* "Keine Daten" und "Payload kaputt" duerfen nicht dasselbe Bild ergeben. Ohne diese
           Zeilen zeigt die Komponente in beiden Faellen "No data", und dann sucht man den Fehler
           in der Datenbank statt im Run-JS-Step -- genau der stille Ausfall, den dieses Repo
           schon zu oft hatte. Es wird NICHT protokolliert, dass die Matrix leer ist (das sieht
           man ja), sondern nur, dass der Aufruf gar keine verwertbare Struktur mitbrachte. */
        if (!state.hasData && window.console){
          var cellsOk = params && Object.prototype.toString.call(params.cells) === "[object Array]";
          if (!cellsOk){
            var got;
            try {
              got = (params == null) ? String(params)
                  : (typeof params !== "object") ? (typeof params + " " + String(params).slice(0, 80))
                  : ("Objekt mit den Feldern [" + Object.keys(params).join(", ") + "]");
            } catch(e){ got = "?"; }
            console.error("[performance-radar] render ohne verwertbare Daten: `cells` fehlt oder ist " +
              "kein Array. Erhalten: " + got + ". Haeufigste Ursache: der Payload wurde im Run-JS-Step " +
              "nicht geparst (JSON.parse geworfen und der catch-Zweig hat ein leeres Objekt " +
              "durchgereicht) -- die Matrix zeigt dann 'No data', obwohl die Daten existieren.");
          }
        }
        state.loading = false;
        root.classList.remove("is-loading");
        soft.end();
        syncSeg();
        render();
        if (pickPop.isOpen()) populatePicker();
      },
      /* Das Skelett gehoert bei JEDEM Ladevorgang gezeigt, nicht nur beim allerersten. Die
         Bedingung !state.hasData machte diesen Setter nach dem ersten Datensatz wirkungslos: die
         Klasse is-loading wurde gesetzt, aber niemand zeichnete etwas. Fuer den Aufrufer sah das
         aus, als tue die Funktion gar nichts -- und die Heatmap zeigte weiter die alten Zahlen,
         waehrend die neuen unterwegs waren.
         soft (das Dimmen bei komponenteneigenen Nachladungen) bleibt davon unberuehrt: das hier
         ist der ausdrueckliche Aufruf von aussen, und der bedeutet "zeig den Ladezustand". */
      setLoading: function(on){
        state.loading = !!on;
        root.classList.toggle("is-loading", state.loading);
        if (!state.loading){ soft.end(); render(); return; }
        soft.end();
        renderSkeleton();
      },
      reset: function(){
        state.cells = []; state.cellMap = {};
        state.topics = []; state.companies = [];
        state.availTopics = []; state.availCompanies = [];
        state.selTopics = {}; state.selCompanies = {};
        state.appliedTopics = []; state.appliedCompanies = [];
        state.hasData = false; state.loading = false; state.layoutKey = "";
        pickPop.close(false);
        hideTip();
        soft.end();
        root.classList.remove("is-loading");
        renderEmpty();
        syncPickBtn();
      },
      destroyTip: killTip,
      root: root,
      instanceId: instanceId
    };

    root.__uhmController = ctrl;
    root.classList.toggle("has-weights", state.weights);
    syncSeg();
    if (elHeading && !elHeading.textContent.trim()) elHeading.textContent = "Performance Chart";
    renderSkeleton();
    registerLegacyAliases();
    return ctrl;
  }

  /* =========================================================================
     Mount
     ========================================================================= */
  var mount = null;

  function ctrlsFor(id){
    if (!mount) return [];
    var out = [];
    mount.rootsWithId(id).forEach(function(r){
      var c = r.__uhmController || initRoot(r);
      if (c) out.push(c);
    });
    return out;
  }

  function apiRender(params){
    params = params || {};
    var id = params.instanceId || "default";
    var list = ctrlsFor(id);
    /* A payload whose instanceId matches nothing still has to land somewhere: a single placement
       on the page is the overwhelmingly common case, and silently dropping the render because a
       Bubble text field carries a stray space is the exact "empty and broken look the same"
       failure this repo keeps hitting. */
    if (!list.length && mount){
      var all = mount.roots();
      if (all.length === 1){
        var c = all[0].__uhmController || initRoot(all[0]);
        if (c) list = [c];
      }
    }
    list.forEach(function(c){ c.update(params); });
  }
  function apiSetLoading(id, v){ ctrlsFor(id || "default").forEach(function(c){ c.setLoading(isYesLoose(v)); }); }
  function apiReset(id){ ctrlsFor(id || "default").forEach(function(c){ c.reset(); }); }
  function apiDestroyTip(id){
    /* The legacy contract is "kill the tooltip", full stop — it is one shared element, so the id
       only decides which root we bother to look up, not which chip dies. */
    killTip();
    ctrlsFor(id || "default");
  }

  /* setPerformanceRadarLoading(id,"no") must turn loading OFF. A bare !!v is true for the string
     "no", which is exactly the inversion that shipped in another component in this repo. */
  function isYesLoose(v){
    var UC2 = window.UpstreemCore;
    if (UC2 && UC2.isYes) return UC2.isYes(v);
    if (typeof v === "boolean") return v;
    var t = String(v == null ? "" : v).trim().toLowerCase();
    return t === "yes" || t === "true" || t === "1" || t === "y";
  }

  mount = UC.makeMount({
    rootClass: "uhm-root", notPortal: true,
    ctrlProp: "__uhmController",
    queue: "__uhmBootQueue", flag: "__uhmBootStubbed",
    resolveLocal: "__uhmResolveLocal",
    initRoot: initRoot,
    api: {
      renderPerformanceRadar: apiRender,
      setPerformanceRadarLoading: apiSetLoading,
      resetPerformanceRadar: apiReset,
      /* Legacy, un-suffixed. The suffixed twins are installed by registerLegacyAliases(). */
      renderFestivalHeatmap: apiRender,
      destroyHeatmapTooltip: function(id){ apiDestroyTip(id); }
    },
    forwardShape: {
      renderPerformanceRadar: "params",
      renderFestivalHeatmap: "params",
      resetPerformanceRadar: "id",
      destroyHeatmapTooltip: "id"
    },
    /* onMount runs BEFORE makeMount replays Bubble's queued calls — the suffixed aliases have to
       exist by then or a queued renderFestivalHeatmap_<ID> throws into the replay's catch and the
       very first render is silently dropped. */
    onMount: function(m){ mount = m; registerLegacyAliases(); }
  });

  if (UC.watchRoots) UC.watchRoots("uhm-root", registerLegacyAliases);
  }

  uhmBoot(30);
})();
