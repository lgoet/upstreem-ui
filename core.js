/* upstreem core.js — geteilte Daten + Utilities fuer alle Tabellen-/Chart-Komponenten.
   Vor jeder Komponente laden; stellt window.UpstreemCore bereit. Event-Namen bleiben pro Komponente. */
(function(){
  "use strict";

  var CITE_COLOR = {
    "Editorial":"#27a79b", "UGC / Community":"#34a1d1", "Knowledge-Base":"#797ad8",
    "Brand Platforms":"#bc69c9", "Institutional":"#5e7eac", "Competition":"#dd7e3e", "You":"#d35f73"
  };
  var CITE_ALIAS = {
    "Brand_Platform":"Brand Platforms", "Brand Platform":"Brand Platforms",
    "Knowledge_Base":"Knowledge-Base", "Knowledge Base":"Knowledge-Base",
    "UGC_Community":"UGC / Community", "UGC Community":"UGC / Community"
  };
  var ALL_CITATION_TYPES = ["Editorial","UGC_Community","Knowledge_Base","Brand_Platform","Institutional","Competition","You"];
  /* URL types: canonical palette, copied 1:1 from the standalone URL Type chip component.
     Unlike citation types these DO have a real dark variant. */
  var URL_TYPE = {
    homepage:        { label:"Homepage",         c:"#b45309", cDark:"#fbbf24" },
    product_service: { label:"Product / Service", c:"#c2683b", cDark:"#fdba74" },
    marketplace:     { label:"Marketplace",      c:"#9a5b2e", cDark:"#fcae6f" },
    company_info:    { label:"Company Info",     c:"#a16207", cDark:"#facc15" },
    article:         { label:"Article",          c:"#047857", cDark:"#6ee7b7" },
    listicle:        { label:"Listicle",         c:"#0e7490", cDark:"#67e8f9" },
    guide:           { label:"Guide",            c:"#2563eb", cDark:"#93c5fd" },
    comparison:      { label:"Comparison",       c:"#4f46e5", cDark:"#a5b4fc" },
    review:          { label:"Review",           c:"#6d28d9", cDark:"#c4b5fd" },
    documentation:   { label:"Documentation",    c:"#6d28d9", cDark:"#c4b5fd" },
    forum:           { label:"Forum",            c:"#9333ea", cDark:"#d8b4fe" },
    directory:       { label:"Directory",        c:"#a21caf", cDark:"#f0abfc" },
    video:           { label:"Video",            c:"#7c3aed", cDark:"#c4b5fd" },
    social_post:     { label:"Social Post",      c:"#8b5cf6", cDark:"#ddd6fe" }
  };
  var ALL_URL_TYPES = Object.keys(URL_TYPE);
  var OTHER_LIGHT = "#8c8f96", OTHER_DARK = "#a8abb2", CHIP_BG_DARK = "#242424";
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  /* Search behaviour lifted verbatim from quick_actions.html so both feel identical. */
  var DEBOUNCE = 400, MIN = 2;
  /* Sort coalescing window. Shorter than search: a click is a deliberate act, so the result
     has to feel immediate, but it is long enough to swallow a burst of clicks. */
  var SORT_DEBOUNCE = 250;
  var PAGE_SIZES = [15, 25, 50, 100];

  var DEFAULT_PAGE_SIZE = 15;
  /* Compact count format shared with the other components: 1.23k / 12.3k / 1.2m */
  function fmtTotal(n){
    n = Number(n) || 0;
    if (n < 1000) return String(Math.round(n));
    var k = n / 1000;
    if (n < 10000) return (Math.round(k * 100) / 100).toFixed(2).replace(/0+$/,"").replace(/\.$/,"") + "k";
    if (n < 1000000) return (Math.round(k * 10) / 10).toFixed(1).replace(/\.0$/,"") + "k";
    return (Math.round((n/1000000) * 10) / 10).toFixed(1).replace(/\.0$/,"") + "m";
  }

  function isYes(v){ return /^(1|true|yes|y)$/i.test(String(v == null ? "" : v).trim()); }
  /* Wraps every occurrence of the active query in <mark>. Escapes FIRST, then inserts the
     markup — doing it the other way round would let a crafted domain inject HTML. */
  function highlight(text, q){
    var safe = esc(text);
    q = String(q == null ? "" : q).trim();
    if (!q) return safe;
    var needle = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try { return safe.replace(new RegExp("(" + needle + ")", "ig"), '<mark class="up-hl">$1</mark>'); }
    catch(e){ return safe; }
  }
  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[c];
    });
  }
  function citeName(raw){
    if (!raw) return "";
    var s = String(raw).trim();
    if (CITE_ALIAS[s]) return CITE_ALIAS[s];
    if (/^Brand\s+Platforms?$/i.test(s)) return "Brand Platforms";
    if (/^Knowledge[-\s_]?Base$/i.test(s)) return "Knowledge-Base";
    if (/^UGC(\s*[\/_]?\s*Community)?$/i.test(s)) return "UGC / Community";
    return s;
  }
  function tint(hex, a){
    var h = String(hex).replace("#","");
    if (h.length === 3) h = h.split("").map(function(x){ return x + x; }).join("");
    var n = parseInt(h, 16);
    return "rgba(" + ((n>>16)&255) + "," + ((n>>8)&255) + "," + (n&255) + "," + a + ")";
  }
  function toNum(v){ var n = Number(v); return isFinite(n) ? n : null; }
  function fmt1(v){ var n = toNum(v); return n == null ? "–" : (Math.round(n * 10) / 10).toFixed(1); }
  function fmtInt(v){ var n = toNum(v); return n == null ? "–" : String(Math.round(n)); }
  /* App-wide date format: "24. Jul 2026". Parses the RPC's ISO timestamps; anything
     unparseable renders as an em dash rather than "Invalid Date". */
  function fmtDate(v){
    if (v == null || v === "") return "–";
    var d = new Date(String(v));
    if (isNaN(d.getTime())) return "–";
    return String(d.getDate()).padStart(2, "0") + ". " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function foldDiacritics(s){
    var t = String(s == null ? "" : s);
    try { t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(e){}
    return t.replace(/ß/g, "ss").toLowerCase();
  }
  function germanExpand(s){
    return String(s == null ? "" : s)
      .replace(/Ä/g,"Ae").replace(/Ö/g,"Oe").replace(/Ü/g,"Ue")
      .replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss")
      .toLowerCase();
  }
  function resolveBubbleFn(fnName){
    var fn = window[fnName] || (window.parent && window.parent[fnName]) || (window.top && window.top[fnName]);
    if (typeof fn === "function") return fn;
    var start; try { start = window.top || window.parent || window; } catch(e){ start = window; }
    var queue = [start], seen = [];
    while (queue.length){
      var win = queue.shift();
      if (seen.indexOf(win) !== -1) continue;
      seen.push(win);
      try { if (typeof win[fnName] === "function") return win[fnName]; } catch(e){}
      var frames; try { frames = win.document.querySelectorAll("iframe"); } catch(e){ continue; }
      for (var i = 0; i < frames.length; i++){
        var cw; try { cw = frames[i].contentWindow; } catch(e){ cw = null; }
        if (cw && seen.indexOf(cw) === -1) queue.push(cw);
      }
    }
    return null;
  }

  var TREND_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';
  var TREND_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/></svg>';
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var COPY_SVG = '<svg class="up-ic-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  var GOTO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';
  var DONE_SVG = '<svg class="up-ic-done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  var EXT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  /* Survives Bubble rebuilding the element, keyed by instanceId. */
  var STORE = (window.__uutStore = window.__uutStore || {});
  var LOADING_EXPLICIT = (window.__uutLoadingExplicit = window.__uutLoadingExplicit || {});

  /* Shared button/brand tooltip: creates the floating chip, positions it, and installs the
     generic [data-tip]/[data-brandtip] hover handlers on root. getIsDark() is read at show-time
     so it always reflects the current theme. Returns the show/hide handles for component-specific
     tooltips (e.g. a truncated title) to reuse. */
  function makeTooltips(root, getIsDark){
    var tip = document.createElement("div");
    tip.className = "up-tip";
    document.body.appendChild(tip);
    function showTip(el){ showTipText(el, el.getAttribute("data-tip")); }
    function showTipText(el, t){
      if (!t) return;
      tip.textContent = t;
      tip.setAttribute("data-theme", getIsDark() ? "dark" : "light");
      var r = el.getBoundingClientRect();
      tip.style.left = "0px"; tip.style.top = "0px";
      tip.classList.add("is-on");
      var tr = tip.getBoundingClientRect();
      tip.style.left = Math.max(4, Math.min(window.innerWidth - tr.width - 4, r.left + r.width/2 - tr.width/2)) + "px";
      tip.style.top = Math.max(4, r.top - tr.height - 6) + "px";
    }
    function hideTip(){ tip.classList.remove("is-on"); tip.classList.remove("is-wide"); }
    function showTipWide(el, text){
      if (!text) return;
      tip.textContent = text;
      tip.classList.add("is-wide");
      tip.setAttribute("data-theme", getIsDark() ? "dark" : "light");
      var r = el.getBoundingClientRect();
      tip.style.left = "0px"; tip.style.top = "0px";
      tip.classList.add("is-on");
      var tr = tip.getBoundingClientRect();
      tip.style.left = Math.max(4, Math.min(window.innerWidth - tr.width - 4, r.left)) + "px";
      tip.style.top = Math.max(4, r.top - tr.height - 6) + "px";
    }
    root.addEventListener("mouseover", function(e){
      var el = e.target.closest("[data-tip]");
      if (el && root.contains(el)){ showTip(el); return; }
      var bt = e.target.closest("[data-brandtip]");
      if (bt && root.contains(bt)) showTipText(bt, bt.getAttribute("data-brandtip"));
    });
    root.addEventListener("mouseleave", function(e){
      var t = e.target;
      if (t && (t.hasAttribute("data-tip") || t.hasAttribute("data-brandtip"))) hideTip();
    }, true);
    return { showTip: showTip, showTipText: showTipText, showTipWide: showTipWide, hideTip: hideTip, el: tip };
  }

  /* Shared event dispatch: resolves the Bubble function (via the data-*-fn attr or a fallback
     name) across window/parent/top/iframes and calls it with the JSON payload. label + eventPrefix
     stay per component so warnings and the DOM side-channel event read correctly. */
  function makeFire(root, opts){
    opts = opts || {};
    var label = opts.label || "component";
    var evtPrefix = opts.eventPrefix || "";
    return function fire(attr, fallbackName, payload){
      var fnName = root.getAttribute(attr) || fallbackName;
      var fn = resolveBubbleFn(fnName);
      var json; try { json = JSON.stringify(payload); } catch(e){ json = ""; }
      if (typeof fn === "function"){ try { fn(json); } catch(e){} }
      else if (window.console) {
        console.warn("[" + label + "] " + fnName + " not found on window/parent/top or any reachable " +
          "iframe — this action reached no Bubble workflow. Check the Toolbox element's name.");
      }
      try { root.dispatchEvent(new CustomEvent(evtPrefix + fallbackName, { detail: payload, bubbles: true })); } catch(e){}
    };
  }

  /* Body-portal for dropdown menus: position:sticky / Bubble wrappers form stacking contexts that
     trap fixed menus; moving them under a display:contents layer on <body> frees them. Returns the
     layer + a theme mirror that must be called on every theme change (and once at creation).

     Also owns keeping an OPEN portaled menu glued to its trigger while the page scrolls. A
     position:fixed menu (which is what placeMenu produces) doesn't move on its own when an
     ancestor scrolls — without this, every portaled dropdown across every component either drifted
     from its trigger or stayed frozen on screen, and each component that remembered to wire its own
     scroll listener did so slightly differently (unthrottled vs rAF-batched), so the same dropdown
     felt "sticky" in one component and "detached" in another for no product reason. One shared,
     rAF-throttled listener here means every component gets identical behaviour for free just by
     calling makePortal/placeMenu — nothing left for a future migration to remember or get slightly
     wrong. Relies on placeMenu() stamping menu.__upBtn with its trigger on every call, and on the
     is-shown class every component already toggles to mark a portaled menu as currently open. */
  function makePortal(root, menuEls, instanceId){
    if (instanceId){                                  // clear a stale portal from a prior (re-injected) mount
      var old = document.querySelectorAll(".up-portal");
      for (var k = 0; k < old.length; k++){
        if (old[k].getAttribute("data-portal-for") === String(instanceId)){
          try { old[k].parentNode.removeChild(old[k]); } catch(e){}
        }
      }
    }
    var portalLayer = document.createElement("div");
    portalLayer.className = "up-root up-portal";
    if (instanceId) portalLayer.setAttribute("data-portal-for", String(instanceId));
    document.body.appendChild(portalLayer);
    (menuEls || []).forEach(function(m){ if (m) portalLayer.appendChild(m); });
    function syncPortalTheme(){
      if (!portalLayer) return;
      if (root.getAttribute("data-theme") === "dark") portalLayer.setAttribute("data-theme", "dark");
      else portalLayer.removeAttribute("data-theme");
    }
    syncPortalTheme();

    var repositionRaf = null;
    function repositionShownMenus(){
      repositionRaf = null;
      (menuEls || []).forEach(function(m){
        if (m && m.__upBtn && m.classList.contains("is-shown")) placeMenu(m, m.__upBtn);
      });
    }
    function scheduleReposition(){
      if (repositionRaf) return;
      repositionRaf = requestAnimationFrame(repositionShownMenus);
    }
    window.addEventListener("scroll", scheduleReposition, true);
    window.addEventListener("resize", scheduleReposition);

    return { portalLayer: portalLayer, syncPortalTheme: syncPortalTheme };
  }

  /* Position a dropdown menu against its trigger: right-aligned, kept inside the viewport, flips
     above when there's more room, and caps max-height to the available space. Pure geometry — the
     component still decides which menu/trigger and when. Remembers the trigger on the menu element
     itself so makePortal's scroll/resize listener can re-call this with the right button without
     the component having to track that separately. */
  function placeMenu(menu, btn, opts){
    if (!menu || !btn) return;
    menu.__upBtn = btn;
    opts = opts || {};
    var GAP = opts.gap != null ? opts.gap : 4, EDGE = opts.edge != null ? opts.edge : 8;
    menu.style.maxHeight = "";                    // measure natural size first
    var r = btn.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    var left = r.right - mw;                       // right-aligned to the trigger
    if (left < EDGE) left = EDGE;
    if (left + mw > vw - EDGE) left = vw - EDGE - mw;
    var below = vh - r.bottom - GAP - EDGE;
    var above = r.top - GAP - EDGE;
    var top, maxH;
    if (mh <= below || below >= above){ top = r.bottom + GAP; maxH = below; }   // below the button
    else { maxH = above; top = r.top - GAP - Math.min(mh, maxH); }              // flipped up
    menu.style.position = "fixed";
    menu.style.top = Math.max(EDGE, Math.round(top)) + "px";
    menu.style.left = Math.round(left) + "px";
    menu.style.right = "auto";
    menu.style.maxHeight = Math.max(0, Math.round(maxH)) + "px";
    menu.style.zIndex = "2147483002";
  }

  /* Sticky header machinery: pins the toolbar + column header at data-sticky-top on wide screens,
     un-clips overflow:hidden ancestors (Bubble wrappers) so position:sticky isn't trapped, and
     keeps --up-thead-off in sync with the toolbar height. Returns applySticky (wire to resize) and
     syncTheadOffset (call after the header height can change). */
  function makeSticky(root, headEl){
    function unclipToScroller(restore){
      var el = root.parentElement, guard = 0;
      while (el && el !== document.body && el !== document.documentElement && guard++ < 40){
        var cs; try { cs = window.getComputedStyle(el); } catch(e){ break; }
        var oy = cs.overflowY;
        if (oy === "auto" || oy === "scroll" || oy === "overlay") break;   // the scroll container: leave it
        var clips = (cs.overflow === "hidden" || cs.overflow === "clip" ||
                     cs.overflowX === "hidden" || cs.overflowX === "clip" ||
                     oy === "hidden" || oy === "clip");
        if (restore){
          if (el.hasAttribute("data-up-unclipped")){ el.style.overflow = el.getAttribute("data-up-unclipped") || ""; el.removeAttribute("data-up-unclipped"); }
        } else if (clips && !el.hasAttribute("data-up-unclipped")){
          el.setAttribute("data-up-unclipped", el.style.overflow || "");
          el.style.overflow = "visible";
        }
        el = el.parentElement;
      }
    }
    function syncTheadOffset(){ if (headEl) root.style.setProperty("--up-thead-off", headEl.offsetHeight + "px"); }
    function applySticky(){
      var pageW = window.innerWidth || document.documentElement.clientWidth || 0;
      var on = root.getAttribute("data-sticky") !== "no" && pageW >= 1000;
      var v = root.getAttribute("data-sticky-top"); if (v) root.style.setProperty("--up-sticky-top", /^[0-9]+$/.test(v) ? v + "px" : v);
      root.classList.toggle("up-sticky", on);
      unclipToScroller(!on);
      if (on) syncTheadOffset();
    }
    return { applySticky: applySticky, syncTheadOffset: syncTheadOffset };
  }

  /* Bubble re-injects a component's whole markup block (script tags included) whenever the
     reusable it lives in re-renders, so every component needs some way to notice "my root just
     reappeared in the DOM" and re-run its init. Each of the four components used to set this up
     independently: its own document.body MutationObserver (childList+subtree — i.e. "wake up on
     ANY DOM change anywhere on the page") plus its own setInterval(initAll, 1500) heartbeat. On a
     page that places two or more of these components that's 2-4 separate whole-page observers and
     timers all doing redundant work forever, and every one of them re-fires on totally unrelated
     DOM churn elsewhere on the page (another reusable's appear animation, a repeating group
     re-rendering, Mira's own UI) — exactly the kind of background tax that shows up as animations
     feeling slightly less smooth than a plain standalone HTML embed had. One shared observer/timer
     pair here does the same job for every registered component at once. */
  var __rootWatchers = [];
  var __rootWatcherObs = null, __rootWatcherIv = null;
  function watchRoots(rootSelector, onRootsFound){
    for (var e = 0; e < __rootWatchers.length; e++){
      if (__rootWatchers[e].selector === rootSelector) return;   // already registered — a component's boot can run more than once per page
    }
    __rootWatchers.push({ selector: rootSelector, onFound: onRootsFound });
    if (!__rootWatcherObs && window.MutationObserver){
      __rootWatcherObs = new MutationObserver(function(muts){
        var hit = {};
        for (var i = 0; i < muts.length; i++){
          var added = muts[i].addedNodes;
          for (var j = 0; j < added.length; j++){
            var n = added[j];
            if (n.nodeType !== 1) continue;
            for (var w = 0; w < __rootWatchers.length; w++){
              var watcher = __rootWatchers[w];
              if (hit[w]) continue;
              if ((n.classList && n.classList.contains(watcher.selector)) ||
                  (n.querySelector && n.querySelector("." + watcher.selector))) hit[w] = true;
            }
          }
        }
        for (var k = 0; k < __rootWatchers.length; k++){ if (hit[k]) try { __rootWatchers[k].onFound(); } catch(e){} }
      });
      __rootWatcherObs.observe(document.body, { childList: true, subtree: true });
    }
    if (!__rootWatcherIv){
      __rootWatcherIv = setInterval(function(){
        for (var i = 0; i < __rootWatchers.length; i++){ try { __rootWatchers[i].onFound(); } catch(e){} }
      }, 1500);
    }
  }

  window.UpstreemCore = {
    CITE_COLOR: CITE_COLOR,
    CITE_ALIAS: CITE_ALIAS,
    ALL_CITATION_TYPES: ALL_CITATION_TYPES,
    URL_TYPE: URL_TYPE,
    ALL_URL_TYPES: ALL_URL_TYPES,
    OTHER_LIGHT: OTHER_LIGHT,
    OTHER_DARK: OTHER_DARK,
    CHIP_BG_DARK: CHIP_BG_DARK,
    MONTHS: MONTHS,
    DEBOUNCE: DEBOUNCE,
    MIN: MIN,
    SORT_DEBOUNCE: SORT_DEBOUNCE,
    PAGE_SIZES: PAGE_SIZES,
    DEFAULT_PAGE_SIZE: DEFAULT_PAGE_SIZE,
    fmtTotal: fmtTotal,
    isYes: isYes,
    highlight: highlight,
    esc: esc,
    citeName: citeName,
    tint: tint,
    toNum: toNum,
    fmt1: fmt1,
    fmtInt: fmtInt,
    fmtDate: fmtDate,
    foldDiacritics: foldDiacritics,
    germanExpand: germanExpand,
    resolveBubbleFn: resolveBubbleFn,
    TREND_UP: TREND_UP,
    TREND_DOWN: TREND_DOWN,
    CHECK_SVG: CHECK_SVG,
    COPY_SVG: COPY_SVG,
    GOTO_SVG: GOTO_SVG,
    DONE_SVG: DONE_SVG,
    EXT_SVG: EXT_SVG,
    STORE: STORE,
    LOADING_EXPLICIT: LOADING_EXPLICIT,
    makeTooltips: makeTooltips,
    makeFire: makeFire,
    makePortal: makePortal,
    placeMenu: placeMenu,
    makeSticky: makeSticky,
    watchRoots: watchRoots
  };
})();
