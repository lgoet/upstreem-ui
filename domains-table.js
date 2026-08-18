/* upstreem domains-table.js — component logic. Requires core.js (window.UpstreemCore) loaded first. */
(function(){
  "use strict";

  /* Bubble's own RunJS "kick" polling can call window.setDomainsTableLoading/renderDomainsTable
     before core.js has finished loading and udtRun() has assigned the real functions — without
     this, that call throws "is not a function" and is lost. Stub them as immediate, synchronous
     queueing functions right away; udtRun() drains the queue (in original order) once the real
     implementations are assigned. window.__udtBootStubbed guards against re-stubbing over a
     real implementation if this script tag executes more than once on the page. */
  /* Stubs must exist before core.js is guaranteed to be loaded — Bubble polls for these by
     name and would otherwise miss the earliest calls. Everything after the wait uses UC.makeMount. */
  var __udtBootQueue = window.__udtBootQueue = window.__udtBootQueue || [];
  if (!window.__udtBootStubbed){
    window.__udtBootStubbed = true;
    ["renderDomainsTable", "setDomainsTableLoading", "resetDomainsTable", "setDomainsTableBrands",
     "setDomainsTablePages"].forEach(function(n){
      window[n] = function(){ __udtBootQueue.push([n, arguments]); };
    });
  }

  /* Bubble injects this component's <script> tags via jQuery .html(), which does not guarantee
     external scripts execute in DOM order — domains-table.js can start running before core.js has
     finished loading. Retry briefly instead of bailing forever on the first check: covers the
     normal race (core.js finishes a beat later) without masking a genuinely missing core.js.
     Same pattern/reasoning as urls-table.js. */
  function udtBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ udtBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    udtRun();
  }

  function udtRun(){
  var UC = window.UpstreemCore;
  var CITE_COLOR = UC.CITE_COLOR, CITE_ALIAS = UC.CITE_ALIAS, ALL_CITATION_TYPES = UC.ALL_CITATION_TYPES, URL_TYPE = UC.URL_TYPE, ALL_URL_TYPES = UC.ALL_URL_TYPES, OTHER_LIGHT = UC.OTHER_LIGHT, OTHER_DARK = UC.OTHER_DARK, CHIP_BG_DARK = UC.CHIP_BG_DARK, MONTHS = UC.MONTHS, DEBOUNCE = UC.DEBOUNCE, MIN = UC.MIN, SORT_DEBOUNCE = UC.SORT_DEBOUNCE, PAGE_SIZES = UC.PAGE_SIZES, DEFAULT_PAGE_SIZE = UC.DEFAULT_PAGE_SIZE, fmtTotal = UC.fmtTotal, isYes = UC.isYes, highlight = UC.highlight, redditTitleHtml = UC.redditTitleHtml, esc = UC.esc, citeName = UC.citeName, tint = UC.tint, toNum = UC.toNum, fmt1 = UC.fmt1, fmtInt = UC.fmtInt, fmtDate = UC.fmtDate, foldDiacritics = UC.foldDiacritics, germanExpand = UC.germanExpand, resolveBubbleFn = UC.resolveBubbleFn, TREND_UP = UC.TREND_UP, TREND_DOWN = UC.TREND_DOWN, CHECK_SVG = UC.CHECK_SVG, COPY_SVG = UC.COPY_SVG, GOTO_SVG = UC.GOTO_SVG, DONE_SVG = UC.DONE_SVG, EXT_SVG = UC.EXT_SVG;

  /* Own store, deliberately NOT UpstreemCore.STORE — that's hardcoded to window.__uutStore
     inside core.js (urls-table-specific despite living in the "shared" file). Sharing it here
     would let a domains-table instance's persisted state collide with a urls-table instance's. */
  var STORE = (window.__udtStore = window.__udtStore || {});
  var LOADING_EXPLICIT = (window.__udtLoadingExplicit = window.__udtLoadingExplicit || {});

  /* Hideable columns. Domain and Actions are deliberately absent — the table makes no sense
     without the domain, and the row actions are the point of the Actions cell. */
  var COLUMNS = [
      /* `prio` = survival order when too narrow to fit everything (higher survives longer, see
         UC.makeColumns' autoFit). */
      { key: "share",    label: "Share",     w: "minmax(13%, 150px)",   min: 130, prio: 40 },
      { key: "used",     label: "Used",      w: "minmax(11%, 1fr)",     min: 100, dropAt: "narrow",  prio: 20 },
      { key: "type",     label: "Type",      w: "minmax(11%, 1fr)",     min: 118, dropAt: "vnarrow", prio: 30 },
      { key: "lastseen", label: "Last Seen", w: "minmax(104px, 0.7fr)", min: 104, dropAt: "vnarrow", prio: 10 }
  ];

  /* ORDER maps each (field, direction) pair onto the single value the RPC expects in p_order.
     NOTE: the last-seen tokens are last_used_* here, NOT last_seen_* like urls-table — this is
     the domains RPC's own naming, preserved exactly from the pre-migration component. */
  var SORT_FIELDS = [
    { key: "share",       label: "Share" },
    { key: "share_trend", label: "Share Trend" },
    { key: "last_seen",   label: "Last Seen" }
  ];
  var ORDER = {
    "share:desc":       "share_desc",
    "share:asc":        "share_asc",
    "share_trend:desc": "share_delta_desc",
    "share_trend:asc":  "share_delta_asc",
    "last_seen:desc":   "last_used_desc",
    "last_seen:asc":    "last_used_asc"
  };
  function orderValue(field, dir){ return ORDER[field + ":" + dir] || "share_desc"; }
  var HEAD_CYCLE = {
    share:     ["share:desc", "share:asc", "share_trend:desc", "share_trend:asc"],
    last_seen: ["last_seen:desc", "last_seen:asc"]
  };
  var DEFAULT_SORT = { field: "share", dir: "desc" };
  /* Drilldown paging. The RPC is now genuinely paginated: opening a domain, and every later
     search/type-filter/page/page-size change, fires a fresh request for exactly that slice —
     the server is the only place that knows the full list, which is also why the type filter
     below offers every possible URL type rather than only the ones on the currently-loaded page. */
  var SUB_PAGE_SIZES = [10, 25];
  var SUB_SKELETON_ROWS = 5;
  /* Must match the open/close animation's own duration in domains-table.css
     (.udt-subrows.is-entering/.is-closing { animation: ... 200ms ... }) — there is no shared
     CSS custom property for a keyframe's duration, so the two are kept in sync by hand. */
  var SUB_ANIM_MS = 200;
  var CHEV_SVG = '<svg class="udt-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>';
  var SUB_SEARCH_SVG = UC.icon("search", 2);
  var SUB_X_SVG = UC.icon("x", 2.2);
  /* Feather's "link" icon — the hover-reveal "Show Pages" row control (item 10). Chosen over the
     GOTO_SVG diagonal arrow already used elsewhere because that arrow means "leave this page /
     open the domain", and this control means the opposite: stay here, open the drilldown. */
  var LINK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /> <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>';

  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var saved = STORE[instanceId] || {};

    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");

    var elHeadCount = root.querySelector(".up-head-count");
    var elTbody     = root.querySelector(".up-tbody");
    var elSearch    = root.querySelector(".up-search");
    var elSearchIn  = root.querySelector(".up-search-input");
    var elFilter    = root.querySelector(".up-filter");
    var elFilterMenu= root.querySelector(".up-filter-menu");
    /* The drilldown's own sub-filter button reuses this same .up-filter-btn class but doesn't
       exist in the DOM yet at init (built later per open drilldown row) -- this querySelector
       only ever reaches the toolbar-level one. */
    var elFilterBtn = elFilter && elFilter.querySelector(".up-filter-btn");
    if (elFilterBtn) elFilterBtn.setAttribute("data-tip", "Filter Citation Types");
    var elSort      = root.querySelector(".up-sort");
    var elSortMenu  = root.querySelector(".up-sort-menu");
    var elBrand     = root.querySelector(".udt-brand-toggle");
    /* Overwrites whatever data-tip a hand-pasted root copy already carries -- static Bubble
       markup, not something this file builds, so a wording fix only reaches existing embeds if
       the CDN'd JS rewrites the attribute at init. */
    if (elBrand) elBrand.setAttribute("data-tip", "Filter for your brand mentions");
    var elBrandLogo = root.querySelector(".udt-brand-logo");
    var elBrandLbl  = root.querySelector(".udt-brand-label");
    var elFilterLbl = root.querySelector(".up-filter-btn-lbl");
    var elHeading   = root.querySelector(".up-heading");
    var elHeadTools = root.querySelector(".up-head-tools");
    var elHead      = root.querySelector(".up-head");
    var elPageSize  = root.querySelector(".up-pagesize-seg");
    var elPager     = root.querySelector(".up-pager");
    var elCols      = root.querySelector(".up-cols");
    var elColsMenu  = root.querySelector(".up-cols-menu");
    var elMent      = root.querySelector(".up-ment");
    var elMentMenu  = root.querySelector(".up-ment-menu");
    var elMentBtn   = elMent && elMent.querySelector(".up-ment-btn");
    if (elMentBtn) elMentBtn.setAttribute("data-tip", "Filter for brand mentions");
    var mentQuery = "";   // transient brand-search query inside the mentioned dropdown
    if (elMentMenu) elMentMenu.addEventListener("input", function(e){
      if (e.target && e.target.classList && e.target.classList.contains("up-ment-search")) applyMentFilter();
    });
    var elMentLbl   = root.querySelector(".up-ment-lbl");

    var state = {
      rows: [],
      totalCount: null,
      hasData: false,
      /* Drilldown. Exactly ONE domain is expanded at a time — opening another closes and resets
         the previous one, so the sub-toolbar's search/type/page state can live as plain fields
         here instead of being kept per domain.
         Server-paginated: subRows is only the CURRENT page, refetched on open and on every later
         search/type/page/page-size change — there is no full-list cache any more, because the
         server is the only place that knows the total and a client-side cache can't paginate a
         list it was never given in full.
         Deliberately not persisted: an expansion is a look-at-this-now gesture, and restoring one
         over a different result set after a reload would show a domain's pages under the wrong
         parent row. */
      expandedDomain: null,                 // the one open domain, or null
      subRows: [],                          // current page's [{url,title,domain_share,url_type,last_seen,total_count,...}]
      subTotal: null,                       // total_count, read off the last response's rows
      subLoading: false,                    // true between firing a request and its response landing
      subReqId: null,                       // guards against a stale response overwriting a newer one
      subQuery: "",                         // sub-toolbar search
      subTypes: {},                         // sub-toolbar URL-type filter (applied immediately)
      subDisplay: "title",                  // "title" | "url" — which text the page cell shows; purely local, no fetch
      subPage: 1,
      subPageSize: SUB_PAGE_SIZES[0],
      loading: false,                       // intern (Suche/Pagination), startet immer frei
      softReload: false,                    // true only while a sort is in flight — see dim.begin/end
      extLoading: hasProcessingAttr() ? readProcessing()
             : (LOADING_EXPLICIT[instanceId] ? !!saved.loading : false),
      query: saved.query || "",
      sortField: saved.sortField || DEFAULT_SORT.field,
      sortDir: saved.sortDir || DEFAULT_SORT.dir,
      filterSel: saved.filterSel || {},        // live checkbox state (citation types) — single dimension
      appliedSel: saved.appliedSel || {},      // what was last submitted
      brandMentioned: saved.brandMentioned || "",
      pageSize: saved.pageSize || DEFAULT_PAGE_SIZE,
      page: saved.page || 1,                   // 1-based; offset is derived, never stored
      cols: {},                                // filled from colsKit.readCols() below
      widths: {},                              // filled from colsKit.readWidths() below
      brands: saved.brands || [],              // full list; persisted so a Bubble re-render keeps them
      mentionSel: saved.mentionSel || {},      // live checkbox state
      mentionApplied: saved.mentionApplied || {}
    };
    // Domains table has no row-height toggle — always compact, matching the pre-migration spec.
    root.classList.add("is-dense");
    /* Column visibility is a per-user display preference, not app data — localStorage, keyed by
       instance so two placements can differ. Wrapped because Bubble can run inside contexts where
       storage access throws (private mode, blocked third-party cookies). */
    var sortTimer = null;
    /* Search comes from core (UC.makeSearch) — this file and domains-table carried copies that
       were identical apart from comments. fitToolbar stays local because the toolbar tiers are
       this component's own. */
    var MOBILE_SEARCH_MAX = 640;   // below this component width an open search takes over the toolbar
    var search = UC.makeSearch({
      root: root, box: elSearch, input: elSearchIn, state: state,
      mobileMax: MOBILE_SEARCH_MAX, prefix: "udt",
      onRender: function(){ renderTable(); renderPager(); },
      onFire: function(payload){ closeDrilldown(); state.softReload = false; dim.end(); fire("data-search-fn", "udtSearch", payload); },
      onTakeoverEnd: function(){ fitToolbar(); },
      persist: function(){ persist(); }
    });
    function runSearch(){ search.run(); }
    function toggleSearch(){ search.toggle(); }
    function onSearchInput(){ search.onInput(); }
    function syncSearchTakeover(){ search.syncTakeover(); }

    function usableAttr(v, placeholder){
      return v != null && v !== "" && v !== placeholder;
    }
    /* True when the element actually carries a processing value. Deciding factor for who owns the
       loading state: whoever supplies a real value wins. Same "attribute filled -> attribute
       decides; attribute empty -> the explicit call decides" model as urls-table.js. */
    function hasProcessingAttr(){
      return usableAttr(root.getAttribute("data-processing"), "IS_PROCESSING") ||
             usableAttr(root.getAttribute("data-processing2"), "IS_PROCESSING_2");
    }
    function readProcessing(){
      var a = root.getAttribute("data-processing");
      var b = root.getAttribute("data-processing2");
      var pa = usableAttr(a, "IS_PROCESSING") ? isYes(a) : false;
      var pb = usableAttr(b, "IS_PROCESSING_2") ? isYes(b) : false;
      return pa || pb;
    }
    function persist(){
      STORE[instanceId] = {
        loading: state.extLoading, query: state.query,
        sortField: state.sortField, sortDir: state.sortDir,
        filterSel: state.filterSel, appliedSel: state.appliedSel,
        brandMentioned: state.brandMentioned,
        pageSize: state.pageSize, page: state.page,
        mentionSel: state.mentionSel, mentionApplied: state.mentionApplied,
        brands: state.brands
      };
    }
    /* shared event dispatch (core) — "udt-" matches the CustomEvent prefix the old component
       already used ("udt-" + fallbackName), kept for anything listening on the DOM side-channel. */
    var fire = UpstreemCore.makeFire(root, { label: "domains-table", eventPrefix: "udt-" });
    /* Soft-reload dim — sort only. Same result set, only re-ordered, so the rows stay on screen
       and just dim instead of blanking to a skeleton. See UC.makeSoftReload / prompts-table.js,
       which had this first. */
    var dim = UC.makeSoftReload(root);

    /* ---------------- table ---------------- */
    function skeletonRows(n){
      return UC.skeletonRows({ count: n, cols: [
        { w:110, jitter:30, logo:true, cls:"up-td-domain" },
        { w:70,  cls:"up-td-share" },
        { w:56,  cls:"up-td-used" },
        { w:82,  cls:"up-td-type" },
        { w:88,  cls:"up-td-lastseen" },
        { w:56,  cls:"udt-td-actions" }
      ]});
    }
    function trendChip(delta, suffix){
      return UC.trendChip(delta, { decimals: true, suffix: suffix });
    }
    /* Domains only ever have a citation type (no url-type concept) — one palette, no leading dot
       needed to distinguish it from a second type system the way urls-table's chip does. */
    function tagHtml(raw){
      if (!raw) return "";
      var label = citeName(raw);
      var color = CITE_COLOR[label] || OTHER_LIGHT;
      var bg = isDark ? CHIP_BG_DARK : tint(color, 0.12);
      return '<span class="udt-tag" style="color:' + color + ';background:' + bg + '">' +
               '<span class="udt-tag-lbl">' + esc(label) + '</span>' +
             '</span>';
    }
    /* Shared with the targeted sub-block re-render below (renderSubBlockOnly) — the drilldown's
       page rows reuse the parent domain's favicon, so both need the exact same normalization. */
    function domainFavUrl(r){
      var fav = String((r && r.favicon) == null ? "" : r.favicon);
      if (fav.indexOf("//") === 0) fav = "https:" + fav;
      return fav;
    }
    function rowByDomain(dom){
      for (var i = 0; i < state.rows.length; i++){
        if (String(state.rows[i].domain) === dom) return state.rows[i];
      }
      return null;
    }
    function rowHtml(r){
      var dom = String(r.domain == null ? "" : r.domain);
      var fav = domainFavUrl(r);
      var initial = dom.replace(/^www\./, "").charAt(0) || "?";
      var share = r.share_pct;
      var used = (r.runs_with_domain != null) ? r.runs_with_domain
               : (r.used_total != null) ? r.used_total
               : (r.used != null) ? r.used
               : r.total_used;
      var pages = toNum(r.urls_count);
      var isOpen = state.expandedDomain === dom;
      /* "N pages" doubles as the drilldown trigger. A real <button> rather than a styled span:
         it is a genuine control, so it should be tabbable and Enter/Space-operable for free
         instead of needing a parallel keydown path. aria-expanded makes the state audible. */
      var pagesBtn = pages > 0
        ? '<button class="up-pages udt-pagesbtn' + (isOpen ? " is-open" : "") + '" type="button"' +
            ' data-pages-toggle aria-expanded="' + (isOpen ? "true" : "false") + '">' +
            '<span class="udt-pagesbtn-lbl">' + fmtTotal(pages) + (pages === 1 ? " page" : " pages") + '</span>' +
            CHEV_SVG +
          '</button>'
        : '<span class="up-pages">' + fmtTotal(pages || 0) + " pages" + '</span>';
      return '<div class="up-row' + (isOpen ? " is-expanded" : "") + '" data-domain="' + esc(dom) + '" tabindex="0" role="button">' +
        '<div class="up-td up-td-domain">' +
          '<span class="udt-logo-box' + (fav ? " has-img" : "") + '">' +
            '<span class="udt-logo-ltr">' + esc(initial) + '</span>' +
            (fav ? '<img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                   ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
          '</span>' +
          '<span class="udt-dom-wrap">' +
            '<span class="udt-dom-title">' + highlight(dom, state.query) + '</span>' +
            pagesBtn +
          '</span>' +
          /* Both the goto arrow and the "Show Pages" affordance anchor to this ONE wrapper
             (position:absolute inside it, see the CSS) rather than each carrying its own
             margin-left:auto — two auto-margin siblings split the row's free space between them,
             which is what put the arrow somewhere in the middle of the cell instead of flush
             against the edge. Second, longer-dwell affordance: a 1s hover on the row fades the
             plain goto arrow out and fades an explicit "Show Pages" control in, staggered so one
             finishes leaving before the other arrives (see the row-hover-timer below and both
             elements' transition-delay). Same data-pages-toggle trigger as the "N pages" chevron,
             so the existing click handler opens it for free — only rendered when there is
             something to show. */
          '<span class="udt-row-affordance">' +
            '<span class="udt-row-goto">' + GOTO_SVG + '</span>' +
            (pages > 0 ? '<button class="udt-row-showpages" type="button" data-pages-toggle aria-label="Show pages">' +
               LINK_SVG + '<span>Show Pages</span></button>' : "") +
          '</span>' +
        '</div>' +
        '<div class="up-td up-td-share"><span class="udt-num">' + fmt1(share) + '%</span>' + trendChip(r.share_delta_pct, "%") + '</div>' +
        '<div class="up-td up-td-used"><span class="udt-used">' + fmtTotal(used || 0) + '</span></div>' +
        '<div class="up-td up-td-type">' + tagHtml(r.citation_type) + '</div>' +
        '<div class="up-td up-td-lastseen"><span class="udt-date">' + esc(fmtDate(r.last_used_at)) + '</span></div>' +
        '<div class="up-td udt-td-actions">' +
          '<span class="udt-actions">' +
            '<button class="udt-actbtn up-act-copy" type="button" data-tip="Copy domain" aria-label="Copy domain">' + COPY_SVG + DONE_SVG + '</button>' +
            '<button class="udt-actbtn up-act-open" type="button" data-tip="Open in new tab" aria-label="Open in new tab">' + EXT_SVG + '</button>' +
          '</span>' +
        '</div>' +
      '</div>' + subrowsHtml(dom, fav);
    }
    /* ---------- drilldown: one domain's pages, as a self-contained mini table ----------
       Rendered as a SIBLING of .up-row, never as more .up-row elements: a row is a CSS grid whose
       track list is the domain table's columns, and this block has its own columns entirely.
       Keeping it outside also keeps it out of UC.makeColumns' show/hide sweep and its per-row
       signature stamping, which both key on .up-row.
       It carries its own header, search, URL-type filter and pager because it IS a table — giving
       it the same furniture as every other table in the app is what makes it feel like part of
       the product rather than a popover that happens to contain rows. All of that filtering runs
       locally over the delivered list; only opening the row ever talks to the server. */
    /* A missing/empty type is "Uncategorized" — same convention as every other type chip in the
       app (core.js's URL_LABEL.other, topcitations-dashboard's URL_TYPE_CHIP.other) — never a
       blank cell. A non-empty value that just doesn't match a known key still renders as its own
       raw text: that is a real (if unmapped) type, not an absent one. */
    function urlTypeInfo(raw){
      var key = String(raw == null ? "" : raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
      var t = URL_TYPE[key];
      if (t) return { label: t.label, color: isDark ? t.cDark : t.c, base: t.c };
      return { label: key ? String(raw) : "Uncategorized", color: isDark ? OTHER_DARK : OTHER_LIGHT, base: OTHER_LIGHT };
    }
    /* Same chip as urls-table's URL-type cell — leading dot included, since that dot is what
       tells URL types and citation types apart at a glance. One step smaller here, matching the
       rest of the drilldown. Always renders now that a missing type has a real label. */
    function urlTagHtml(raw){
      var ti = urlTypeInfo(raw);
      var bg = isDark ? CHIP_BG_DARK : tint(ti.base, 0.12);
      return '<span class="udt-sub-tag" style="color:' + ti.color + ';background:' + bg + '">' +
               '<span class="udt-sub-tag-dot" style="background:' + ti.color + '"></span>' +
               '<span class="udt-sub-tag-lbl">' + esc(ti.label) + '</span>' +
             '</span>';
    }
    function subrowsHtml(dom, parentFav){
      if (state.expandedDomain !== dom) return "";
      var body, foot;
      if (state.subLoading){
        /* Skeleton rows match whatever count was actually on screen a moment ago, not a fixed
           number — switching page size from 10 to 25 while only 10 rows exist would otherwise
           jump the panel to 25 skeleton bars and then shrink back to 10 real ones the instant the
           response lands, a resize the user did not ask for. Falls back to SUB_SKELETON_ROWS only
           when there is no previous page to measure (the very first open). */
        body = subSkeletonRowsHtml(state.subRows.length || SUB_SKELETON_ROWS);
        foot = "";
      } else if (!state.subRows.length){
        var filteredNow = !!String(state.subQuery || "").trim() ||
          Object.keys(state.subTypes || {}).some(function(k){ return state.subTypes[k]; });
        body = '<div class="udt-sub-empty">' +
          (filteredNow ? "No pages match those filters" : "No pages found for this domain") + '</div>';
        foot = "";
      } else {
        var size = state.subPageSize;
        var total = state.subTotal != null ? state.subTotal : state.subRows.length;
        var pageCount = Math.max(1, Math.ceil(total / size));
        var cur = Math.min(Math.max(1, state.subPage), pageCount);
        var from = (cur - 1) * size;
        body = state.subRows.map(function(u){ return subrowHtml(u, parentFav); }).join("");
        foot = subFootHtml(total, cur, pageCount, from, state.subRows.length);
      }
      /* The toolbar and header render UNCONDITIONALLY, loading or not — a field the user is
         typing into must never disappear mid-keystroke just because the row list below it is
         mid-fetch. Only the row list (and the footer, which needs a real total) go into the
         loading state. */
      var inner = subToolbarHtml(dom) + subHeadHtml() +
                  '<div class="udt-sub-list">' + body + '</div>' + foot;
      /* is-entering only on the first render after the toggle — see the animation comment in
         domains-table.css. Cleared here rather than in a timer because this is the exact moment
         the class has been handed to the markup. */
      var enter = subEnter ? " is-entering" : "";
      subEnter = false;
      /* .udt-sub-inner normally clips (overflow:hidden, needed for the open/close height
         animation) — but that clips the Types dropdown too whenever the drilldown isn't tall
         enough for the menu to fit below the toolbar. is-menu-open lifts the clip only while a
         menu inside is actually open, same targeted-overflow-override pattern as
         .upt-td-topics/.ust-cell in prompts-table.css (STYLEGUIDE §29) rather than reintroducing
         a portal. */
      var innerCls = "udt-sub-inner" + (subTypeOpen ? " is-menu-open" : "");
      return '<div class="udt-subrows' + enter + '" data-sub-for="' + esc(dom) + '">' +
               '<div class="' + innerCls + '">' + inner + '</div>' +
             '</div>';
    }
    /* Skeleton mirrors the real row's shape — icon block, title bar, and one bar per right-hand
       column — instead of a single generic stripe, so the layout does not visibly jump when the
       data lands. Runs on every fetch, not just the first: opening a domain, paging, or changing
       a filter/search all refetch server-side now, so this replaces the row list (never the
       toolbar above it — see subrowsHtml) on each of those too. */
    function subSkeletonRowsHtml(count){
      var one = '<div class="udt-subrow is-sk">' +
          '<span class="udt-sub-main"><span class="udt-sk-logo"></span><span class="udt-sk-bar udt-sk-title"></span></span>' +
          '<span class="udt-sk-bar udt-sk-share"></span>' +
          '<span class="udt-sk-bar udt-sk-type"></span>' +
          '<span class="udt-sk-bar udt-sk-date"></span>' +
          '<span></span>' +
        '</div>';
      var out = "";
      for (var i = 0; i < (count || SUB_SKELETON_ROWS); i++) out += one;
      return out;
    }
    /* Every possible URL type is offered, always — not just the ones visible on the current page.
       With server-side paging this view never holds the full list, so deriving "which types
       exist" from what happens to be loaded would silently hide options that are one page away. */
    function subToolbarHtml(dom){
      var q = String(state.subQuery || "");
      var selCount = Object.keys(state.subTypes || {}).filter(function(k){ return state.subTypes[k]; }).length;
      var typeCtl = '<div class="udt-sub-filter' + (subTypeOpen ? " is-open" : "") + '">' +
        '<button class="up-filter-btn udt-sub-filterbtn' + (selCount ? " is-active" : "") + '" type="button" data-subfilter>' +
          '<span class="up-filter-btn-lbl">' + (selCount ? selCount + " selected" : "All URL Types") + '</span>' +
          '<svg class="up-filter-btn-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>' +
        '</button>' +
        '<div class="up-filter-menu udt-sub-filtermenu' + (subTypeOpen ? " is-shown" : "") + '" role="menu">' +
          '<div class="up-filter-head"><span class="up-filter-title">URL Types</span>' +
            (selCount ? '<button class="up-filter-reset" type="button" data-subtypereset>Reset</button>' : "") +
          '</div>' +
          '<div class="up-filter-list">' + ALL_URL_TYPES.map(function(k){
            var ti = urlTypeInfo(k);
            var bg = isDark ? CHIP_BG_DARK : tint(ti.base, 0.12);
            return '<div class="up-filter-item' + (state.subTypes[k] ? " is-checked" : "") + '" data-subtype="' + esc(k) + '">' +
              '<span class="up-filter-check">' + CHECK_SVG + '</span>' +
              '<span class="up-filter-tag" style="color:' + ti.color + ';background:' + bg + '">' +
                '<span class="uut-tag-dot" style="background:' + ti.color + '"></span>' +
                '<span class="up-filter-tag-lbl">' + esc(ti.label) + '</span></span>' +
            '</div>';
          }).join("") + '</div>' +
        '</div>' +
      '</div>';
      /* Title/URL is a pure display toggle over whatever is already loaded — no fetch, so it's a
         plain state flip + re-render, unlike everything else in this toolbar. Visually matches
         the page-size segmented control (same shape, same idea: two mutually-exclusive options),
         but deliberately does NOT reuse its literal .up-pagesize-seg/-btn classes — the outer
         table's own renderPageSize() does an untargeted root.querySelector(".up-pagesize-seg")
         and would grab whichever one comes first in the DOM, silently overwriting this control
         with 10/25 buttons. Own classes, own (near-identical) CSS instead. */
      var dispCtl = '<div class="udt-sub-dispseg" role="group" aria-label="Show title or URL">' +
        '<button class="udt-sub-disp-btn' + (state.subDisplay !== "url" ? " is-active" : "") + '" type="button" data-subdisp="title">Title</button>' +
        '<button class="udt-sub-disp-btn' + (state.subDisplay === "url" ? " is-active" : "") + '" type="button" data-subdisp="url">URL</button>' +
      '</div>';
      /* Left-aligned, in this order: search, URL-type filter, title/url switcher — same reading
         order as the columns they affect. The close button is the one thing that stays pinned to
         the far right (margin-left:auto on itself), since "how do I leave" belongs on the
         opposite side from "how do I narrow what I'm looking at". */
      return '<div class="udt-sub-toolbar">' +
        '<div class="udt-sub-tools">' +
          '<div class="udt-sub-search' + (q ? " has-text" : "") + '">' +
            '<span class="udt-sub-search-ic">' + SUB_SEARCH_SVG + '</span>' +
            '<input class="udt-sub-search-in" type="text" placeholder="Search pages…" autocomplete="off"' +
              ' spellcheck="false" aria-label="Search pages" value="' + esc(q) + '"/>' +
            '<button class="udt-sub-search-x" type="button" data-subclear aria-label="Clear search">' + SUB_X_SVG + '</button>' +
          '</div>' +
          typeCtl + dispCtl +
        '</div>' +
        /* Closes the whole drilldown — distinct from the search-field's own X, which only clears
           the query. A real icon button (.up-iconbtn), matching every other lone-icon control. */
        '<button class="up-iconbtn udt-sub-closebtn" type="button" data-subdrillclose aria-label="Close pages">' + SUB_X_SVG + '</button>' +
      '</div>';
    }
    function subHeadHtml(){
      /* "Domain Share", not "Global Share": the number is each page's share WITHIN this domain,
         which is a different figure from the global share the parent row carries. Labelling it
         global would invite comparing it against the wrong thing. */
      return '<div class="udt-sub-head">' +
        '<span>Page</span>' +
        '<span class="udt-sub-h-num">Domain Share</span>' +
        '<span>Type</span>' +
        '<span>Last Seen</span>' +
        '<span></span>' +
      '</div>';
    }
    function subFootHtml(total, cur, pageCount, from, shown){
      var sizes = SUB_PAGE_SIZES.map(function(n){
        return '<button class="up-pagesize-btn' + (state.subPageSize === n ? " is-active" : "") +
               '" type="button" data-subsize="' + n + '">' + n + '</button>';
      }).join("");
      /* Same windowed pager as every other table's footer (UC.makePager's pageWindow): ends,
         a run around the current page, "…" gaps between — not a flat 1..N row, which at a
         couple hundred pages read as a wall of numbers instead of a pager. */
      var pages = subPageWindow(cur, pageCount).map(function(p){
        if (p === "gap") return '<span class="up-page-gap">…</span>';
        return '<button class="up-page' + (p === cur ? " is-active" : "") + '" type="button" data-subpage="' + p + '">' + p + '</button>';
      }).join("");
      var info = total ? '<span class="up-pager-info">' + fmtInt(from + 1) + '–' + fmtInt(from + shown) + ' of ' + fmtTotal(total) + '</span>' : "";
      return '<div class="udt-sub-foot">' +
        '<div class="up-pagesize"><span class="up-pagesize-lbl">Rows</span>' +
          '<div class="up-pagesize-seg" role="group" aria-label="Rows per page">' + sizes + '</div></div>' +
        '<div class="up-pager">' + info +
          (pageCount > 1 ?
            '<button class="up-page up-page-prev" type="button" aria-label="Previous page" data-subpage-prev' + (cur <= 1 ? " disabled" : "") + '>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>' +
            '<span class="udt-sub-pages">' + pages + '</span>' +
            '<button class="up-page up-page-next" type="button" aria-label="Next page" data-subpage-next' + (cur >= pageCount ? " disabled" : "") + '>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>'
            : "") +
        '</div>' +
      '</div>';
    }
    function subrowHtml(u, parentFav){
      var url = String(u.url == null ? "" : u.url);
      var title = String(u.title == null ? "" : u.title) || url;
      /* The page payload carries no favicon of its own — and every one of these URLs belongs to
         the domain in the row above, so that domain's favicon is the correct icon anyway. Reusing
         it also means no extra image request per page row, and nothing is fetched from a
         third-party favicon service that was never asked for. */
      var fav = String(u.favicon == null ? "" : u.favicon) || String(parentFav || "");
      if (fav.indexOf("//") === 0) fav = "https:" + fav;
      var initial = (title || url).charAt(0) || "?";
      /* A missing share renders as a bare dash, never "–%" — a unit on a value that isn't there
         reads like a broken number rather than an absent one. Muted via is-empty — same "nothing
         here" convention every table in the app uses now (core.css). */
      var shareMissing = u.domain_share == null || u.domain_share === "";
      var shareTxt = shareMissing ? "–" : fmt1(u.domain_share) + "%";
      var shareCls = "udt-sub-share" + (shareMissing ? " is-empty" : "");
      /* Title/URL switcher (item 6) — purely which STRING lands in this one cell; everything
         else about the row (search matches, sort, favicon) is unaffected. Same truncation/hover-
         tooltip handling either way, since both go through .udt-sub-title. */
      var shown = state.subDisplay === "url" ? url : title;
      /* Reddit's own scraped title is almost always just "reddit.com" — a parsed r/sub + slug
         reads far better and is available right in the URL. Only applies in title mode: URL mode
         means "show me the literal URL," which this would defeat the point of. */
      var titleHtml = state.subDisplay === "url" ? null : redditTitleHtml(url, title, state.subQuery);
      if (titleHtml == null) titleHtml = highlight(shown, state.subQuery);
      return '<div class="udt-subrow" data-suburl="' + esc(url) + '" tabindex="0" role="button">' +
        '<span class="udt-sub-main">' +
          '<span class="udt-sub-logo' + (fav ? " has-img" : "") + '">' +
            '<span class="udt-sub-ltr">' + esc(initial) + '</span>' +
            (fav ? '<img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                   ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
          '</span>' +
          '<span class="udt-sub-title">' + titleHtml + '</span>' +
        '</span>' +
        '<span class="' + shareCls + '">' + shareTxt + '</span>' +
        '<span class="udt-sub-type">' + urlTagHtml(u.url_type) + '</span>' +
        '<span class="udt-sub-date">' + esc(fmtDate(u.last_seen)) + '</span>' +
        '<span class="udt-sub-goto">' + GOTO_SVG + '</span>' +
      '</div>';
    }
    var subTypeOpen = false, subEnter = false, subReqSeq = 0;
    /* subPageSize and subDisplay are deliberately NOT reset here — unlike query/types/page, which
       are filters on THIS domain's content and have no reason to carry over to the next one,
       "how many rows" and "title vs URL" are user preferences about how they like to read the
       list. They persist for the session (in state, so a real page reload still starts fresh —
       there is no localStorage write here on purpose) across opening a different domain, or the
       same one again. */
    function resetSubState(){
      state.subQuery = ""; state.subTypes = {}; state.subPage = 1;
      state.subRows = []; state.subTotal = null; state.subLoading = false; state.subReqId = null;
      subTypeOpen = false;
      /* Covers the close path too, not just switching domains — togglePages' close branches call
         this without a following renderSubBlockOnly, so without this the class would otherwise
         stay stuck on root (see the comment at its toggle site). */
      root.classList.remove("is-subfilter-open");
    }
    /* Any action up in the OUTER table's own toolbar (search, sort, the citation-type filter,
       mentioned brands, the brand toggle, main pagination) closes an open drilldown instantly —
       no fade-out, unlike the user-driven close in togglePages(). The row set is about to change
       (or already has, for an externally-pushed re-render — see update()), and a drilldown left
       open over rows that no longer exist, or that never re-fetches its own page, is worse than
       just closing it. Keeping this one rule in one place is also just simpler than teaching every
       outer-table action to reason about the drilldown individually. */
    function closeDrilldown(){
      if (!state.expandedDomain) return;
      state.expandedDomain = null;
      resetSubState();
    }
    /* Domains can contain characters that are syntax inside an attribute selector. */
    function cssEsc(v){
      var t = String(v == null ? "" : v);
      if (window.CSS && CSS.escape) return CSS.escape(t);
      return t.replace(/["\\]/g, "\\$&");
    }
    /* Replaces ONLY the .udt-subrows block for `dom` — the domain ROW above it, and every OTHER
       row in the table, are never touched. Creates the block fresh if it doesn't exist yet (the
       first render after opening) or swaps in a new one if it does (every later search/filter/
       page/page-size change, and the async response that lands after any of those).

       This replaced calling the full renderTable() for all of that. A full render rebuilds every
       row's HTML from scratch on every keystroke or page click — including the one row the user's
       mouse is still sitting on. A brand-new DOM node under a stationary mouse forces the browser
       to re-evaluate :hover from a blank slate, which visibly dropped and re-delayed the hover-only
       bits (the goto arrow, the "Show Pages" pill) for a frame — that flicker on the domain row
       every time the drilldown loaded anything was this function's whole reason to exist. */
    function renderSubBlockOnly(dom){
      var row = root.querySelector('.up-row[data-domain="' + cssEsc(dom) + '"]');
      if (!row){ renderTable(); return; }   // not in the DOM right now (e.g. an outer reload is racing this) — fall back
      var host = row.nextElementSibling && row.nextElementSibling.classList.contains("udt-subrows")
        ? row.nextElementSibling : null;
      var wrap = document.createElement("div");
      wrap.innerHTML = subrowsHtml(dom, domainFavUrl(rowByDomain(dom)));
      var fresh = wrap.firstElementChild;
      if (!fresh){ if (host) host.remove(); return; }   // dom is no longer expandedDomain — nothing to show
      if (host) host.replaceWith(fresh); else row.after(fresh);
      /* .udt-sub-inner lifting its own overflow:hidden (see subrowsHtml) isn't enough on its
         own — while the sticky header is pinned, .up-tbody ALSO clips (overflow:hidden, for its
         rounded bottom corners, core.css). That ancestor sits outside this function's own
         replaced subtree, so it needs its own toggle here rather than in the markup string. */
      root.classList.toggle("is-subfilter-open", subTypeOpen);
    }
    /* Shows the row-list skeleton immediately (the toolbar above it stays live — see subrowsHtml),
       then fires a request for exactly the current domain/query/types/page/page-size combination.
       subReqSeq guards against a slow, now-stale response landing after a faster, later one:
       setPages() only accepts a response whose (optional) requestId still matches.

       delay (ms), when given, defers only the actual network round-trip, not the skeleton — used
       exclusively by the OPEN path (see togglePages) so the request doesn't start competing with
       the panel's own 200ms entrance animation. Without it, a fast response arriving mid-animation
       forces a second re-render before the panel had settled into its final height, which is what
       read as the drilldown "stuttering" open. Every other trigger (search, filter, page,
       page-size — the panel is already open and at rest for all of them) calls this with no delay. */
    function fetchSubPage(delay){
      var dom = state.expandedDomain;
      if (!dom) return;
      state.subLoading = true;
      renderSubBlockOnly(dom);
      function fireNow(){
        if (state.expandedDomain !== dom) return;   // closed (or switched) before the delay elapsed
        subReqSeq += 1;
        state.subReqId = subReqSeq;
        fire("data-showpages-fn", "udtShowPages", {
          domain: dom,
          query: state.subQuery,
          url_types: Object.keys(state.subTypes).filter(function(k){ return state.subTypes[k]; }).join(","),
          page: state.subPage,
          page_size: state.subPageSize,
          /* Same shape as the outer table's own page event (limit/offset/page) — your RPC reads
             p_offset there, so the drilldown's RPC gets the identical field rather than making you
             derive it Bubble-side from page * page_size. */
          offset: (state.subPage - 1) * state.subPageSize,
          request_id: subReqSeq
        });
      }
      if (delay) setTimeout(fireNow, delay); else fireNow();
    }
    /* Exactly one open at a time — opening another closes and fully resets the previous one, so a
       search or type filter never carries over from one domain to the next.
       Every transition here is an in-place DOM mutation (class toggle, single-node insert/remove/
       replace) — never a rebuild of the row itself, let alone the whole table. See the comment on
       renderSubBlockOnly for why: recreating the row under an active mouse is what caused the
       flicker.
       Closing animates out BEFORE the block is removed: removing it immediately would delete the
       node mid-transition and it would simply vanish. Switching directly from one open domain to
       another closes the first instantly (no fade) and opens the second — same behavior as before,
       just done by hand now instead of falling out of a full re-render for free. */
    function togglePages(dom){
      if (state.expandedDomain === dom){
        var host = root.querySelector('.udt-subrows[data-sub-for="' + cssEsc(dom) + '"]');
        var row = root.querySelector('.up-row[data-domain="' + cssEsc(dom) + '"]');
        var btn = row && row.querySelector("[data-pages-toggle]");
        if (btn){ btn.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); }
        if (host){
          host.classList.add("is-closing");
          setTimeout(function(){
            if (state.expandedDomain !== dom) return;   // something else already took over
            state.expandedDomain = null; resetSubState();
            var r2 = root.querySelector('.up-row[data-domain="' + cssEsc(dom) + '"]');
            if (r2) r2.classList.remove("is-expanded");
            if (host.parentNode) host.remove();
          }, SUB_ANIM_MS);
        } else {
          state.expandedDomain = null; resetSubState();
          if (row) row.classList.remove("is-expanded");
        }
        return;
      }
      var prevDom = state.expandedDomain;
      if (prevDom){
        var prevRow = root.querySelector('.up-row[data-domain="' + cssEsc(prevDom) + '"]');
        if (prevRow){
          prevRow.classList.remove("is-expanded");
          var prevBtn = prevRow.querySelector("[data-pages-toggle]");
          if (prevBtn){ prevBtn.classList.remove("is-open"); prevBtn.setAttribute("aria-expanded", "false"); }
          var prevSub = prevRow.nextElementSibling;
          if (prevSub && prevSub.classList.contains("udt-subrows")) prevSub.remove();
        }
      }
      state.expandedDomain = dom;
      resetSubState();
      subEnter = true;
      var newRow = root.querySelector('.up-row[data-domain="' + cssEsc(dom) + '"]');
      if (newRow){
        newRow.classList.add("is-expanded");
        var newBtn = newRow.querySelector("[data-pages-toggle]");
        if (newBtn){ newBtn.classList.add("is-open"); newBtn.setAttribute("aria-expanded", "true"); }
      }
      /* Delayed: the panel's own entrance animation gets to finish uninterrupted before the
         response can possibly land and force a second render mid-flight — see fetchSubPage. */
      fetchSubPage(SUB_ANIM_MS);
    }
    /* Sub-search input. Delegated on the root because the whole block is re-rendered on every
       fetch — a listener bound to the input itself would die with it. The input is NOT re-created
       while typing (see subrowsHtml: the toolbar stays live during a fetch), so focus and caret
       are restored explicitly below, which is why this debounces rather than firing per keystroke.
       Below MIN characters it waits rather than firing a query too short to be useful — same gate
       the main table's own search uses — except for a full clear, which always goes out. */
    var subSearchTimer = null;
    root.addEventListener("input", function(e){
      var inp = e.target.closest && e.target.closest(".udt-sub-search-in");
      if (!inp) return;
      var v = String(inp.value || "");
      clearTimeout(subSearchTimer);
      if (v.length && v.length < MIN) return;
      subSearchTimer = setTimeout(function(){
        if (v === state.subQuery) return;
        state.subQuery = v; state.subPage = 1;
        fetchSubPage();
        var again = root.querySelector(".udt-sub-search-in");
        if (again){ again.focus(); try { again.setSelectionRange(v.length, v.length); } catch(err){} }
      }, DEBOUNCE);
    });
    var emptyGraceTimer = null;
    function clearEmptyGrace(){ if (emptyGraceTimer){ clearTimeout(emptyGraceTimer); emptyGraceTimer = null; } }
    function renderEmptyState(filtered){
      elTbody.innerHTML = '<div class="up-empty">' +
        '<div class="up-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>' +
        '<div class="up-empty-h">' + (filtered ? "No matching domains" : "No domains yet") + '</div>' +
        '<div class="up-empty-t">' + (filtered
          ? "Nothing matches the current search and filters."
          : "Domains appear here once your prompts have been run.") + '</div>' +
        (filtered ? '<button class="up-empty-btn" type="button" data-clearall>Clear filters</button>' : "") +
      '</div>';
    }
    function renderTable(){
      /* SOFT reload (sort): the result set is the same, just re-ordered — the rows on screen are
         still truthful, so they stay and only dim (see UC.makeSoftReload). Everything else that
         reaches isBusy() (search, filters, page) still falls through to the skeleton below. */
      if (isBusy() && state.softReload && state.hasData && state.rows.length){
        clearEmptyGrace(); return;
      }
      // skeleton matches the CURRENT page size, so the table doesn't visibly resize when data lands
      if (isBusy() || !state.hasData){ clearEmptyGrace(); elTbody.innerHTML = skeletonRows(state.pageSize); return; }
      if (!state.rows.length){
        var filtered = !!state.query ||
          Object.keys(state.appliedSel).some(function(k){ return state.appliedSel[k]; }) ||
          !!state.brandMentioned ||
          Object.keys(state.mentionApplied).some(function(k){ return state.mentionApplied[k]; });
        if (filtered){ clearEmptyGrace(); renderEmptyState(true); return; }
        /* An unfiltered empty result can be an interim "clearing" step before the real data lands
           a moment later (e.g. a workflow that clears the table before kicking off a new query) —
           showing "No domains yet" immediately for that interim state flashes an empty placeholder
           that's gone a beat later. Give a short grace window for a follow-up call before
           committing to the empty view; any subsequent render() (loading again, or real rows)
           cancels it via clearEmptyGrace() above. */
        if (!emptyGraceTimer){
          elTbody.innerHTML = skeletonRows(state.pageSize);
          emptyGraceTimer = setTimeout(function(){
            emptyGraceTimer = null;
            if (isBusy() || !state.hasData || state.rows.length) return;   // state moved on already
            renderEmptyState(false);
          }, (UC.EMPTY_GRACE_MS || 500));   // matches the app-wide empty-grace window (see core.js's makeEmptyGrace)
        }
        return;
      }
      clearEmptyGrace();
      elTbody.innerHTML = state.rows.map(rowHtml).join("");
    }
    function renderCount(){
      elHeading.classList.add("has-count");
      /* Skeleton for the WHOLE duration of isBusy(), not just before the first load — otherwise
         a stale count from before a filter/sort change sits there unchanged while fresh data is
         still in flight, which reads as "nothing happened" rather than "loading". */
      if (isBusy()){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      var n = (state.totalCount != null) ? state.totalCount : (state.hasData ? state.rows.length : null);
      if (n == null){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      elHeadCount.textContent = fmtTotal(n);
      elHeadCount.classList.remove("is-sk");
    }

    /* ---------------- header sorters ---------------- */
    /* Same "derive the cycle position from the actually-active sort" logic as urls-table.js —
       see its comment for why a stored position drifts and breaks the wrap-around. */
    function applySort(field, dir){
      closeDrilldown();
      state.sortField = field; state.sortDir = dir;
      state.page = 1;
      /* Marked and dimmed on the CLICK, not inside the debounce below — see urls-table.js's
         identical comment. */
      state.softReload = true;
      dim.begin(state.hasData && !!state.rows.length);
      persist(); syncHeadSorters(); populateSort();
      clearTimeout(sortTimer);
      sortTimer = setTimeout(function(){
        search.setLatest(null);
        state.loading = true;
        fire("data-sort-fn", "udtSort", {
          order: orderValue(state.sortField, state.sortDir),   // -> p_order — last_used_desc/asc, NOT last_seen_*
          sort_field: state.sortField, sort_dir: state.sortDir
        });
        renderTable();
      }, SORT_DEBOUNCE);
    }

    /* ---------------- sort dropdown ---------------- */
    function populateSort(){
      if (!elSortMenu) return;   // a stale/incomplete root copy may be missing this markup
      /* Shared markup: UC.sortMenuHtml. Four components built this string identically, including
         the data-sortfield / data-sortdir hooks their click handlers match on -- so a change to
         the markup here had to be made in four places or the handlers drifted apart from it. */
      elSortMenu.innerHTML = UC.sortMenuHtml(SORT_FIELDS, state.sortField, state.sortDir);
    }

    /* ---------------- citation type filter (single dimension — domains have no url-type) ---------------- */
    function populateFilter(){
      if (!elFilterMenu) return;   // a stale/incomplete root copy may be missing this markup
      var sel = state.filterSel;
      var anySel = Object.keys(sel).filter(function(k){ return sel[k]; }).length;
      var html = '<div class="up-filter-head">' +
          '<span class="up-filter-title">Citation Types</span>' +
          (anySel ? '<button class="up-filter-reset" type="button">Reset</button>' : "") +
        '</div><div class="up-filter-list">';
      html += ALL_CITATION_TYPES.map(function(key){
        var label = citeName(key);
        var color = CITE_COLOR[label] || OTHER_LIGHT;
        var bg = isDark ? CHIP_BG_DARK : tint(color, 0.12);
        return '<div class="up-filter-item' + (sel[key] ? " is-checked" : "") + '" data-type="' + esc(key) + '">' +
                 '<span class="up-filter-check">' + CHECK_SVG + '</span>' +
                 '<span class="up-filter-tag" style="color:' + color + ';background:' + bg + '">' +
                   '<span class="up-filter-tag-lbl">' + esc(label) + '</span></span>' +
               '</div>';
      }).join("");
      html += '</div><button class="up-filter-submit" type="button" data-typeapply>Apply</button>';
      elFilterMenu.innerHTML = html;
    }
    function syncFilterBadge(){
      var ct = Object.keys(state.appliedSel).filter(function(k){ return state.appliedSel[k]; });
      elFilter.classList.toggle("is-active", !!ct.length);
      var lbl = !ct.length ? "All Types" : ct.length === 1 ? citeName(ct[0]) : ct.length + " Types";
      elFilterLbl.textContent = lbl;
      fitToolbar();
    }
    function submitFilter(){
      var next = {};
      Object.keys(state.filterSel).forEach(function(k){ if (state.filterSel[k]) next[k] = true; });
      var before = Object.keys(state.appliedSel).filter(function(k){ return state.appliedSel[k]; }).sort().join(",");
      var after  = Object.keys(next).sort().join(",");
      if (after === before){ persist(); return; }   // unchanged -> close only, don't re-run the RPC
      closeDrilldown();
      state.appliedSel = next;
      state.page = 1;
      state.softReload = false; dim.end();
      persist(); syncFilterBadge(); renderPager();
      fire("data-filter-fn", "udtFilter", { citation_types: Object.keys(next).join(",") });
    }

    /* ---------------- column resizing ----------------
       Same as urls-table.js: widths live as explicit px once dragged; the CSS template rules
       until then. Domain-column-only, same reasoning (it holds two lines of text). */
    var DOMAIN_MIN = 220;
    var ACTIONS_MIN = 100;

    /* Columns, pagination and header sorting all come from core now — urls-table and
       domains-table used to carry byte-identical copies of that machinery. Only the data
       differs, and that data is right here in the config. */
    var colsKit = UC.makeColumns({
      root: root, state: state, columns: COLUMNS,
      storePrefix: "udt", instanceId: instanceId,
      firstKey: "domain", firstMin: DOMAIN_MIN, actionsMin: 100,
      dense: false, badgeSel: ".udt-cols-badge", cellPrefixes: ["up"],
      onChange: function(){ render(); }
    });
    var readCols = colsKit.readCols, writeCols = colsKit.writeCols;
    var readWidths = colsKit.readWidths, writeWidths = colsKit.writeWidths;
    var visibleCols = colsKit.visibleCols, effectiveCols = colsKit.effectiveCols;
    var layoutKeys = colsKit.layoutKeys, colMin = colsKit.colMin;
    var applyCols = colsKit.applyCols, startResize = colsKit.startResize;
    var populateCols = colsKit.populateCols, toggleCol = colsKit.toggleCol;
    var selectAllCols = colsKit.selectAllCols, syncColsBadge = colsKit.syncColsBadge;
    /* hydrated here, not in the state literal above: the kit owns the storage format, and
       these used to be hoisted function declarations that could run before it existed */
    state.cols = colsKit.readCols();
    state.widths = colsKit.readWidths();

    var pagerKit = UC.makePager({
      root: root, state: state,
      onClamp: function(){ persist(); },
      onChange: function(){ closeDrilldown(); persist(); renderTable(); firePage(); }
    });
    var pageCount = pagerKit.pageCount, offset = pagerKit.offset;
    var renderPager = pagerKit.renderPager, renderPageSize = pagerKit.renderPageSize;
    var goToPage = pagerKit.goToPage, setPageSize = pagerKit.setPageSize;
    /* Reused as-is for the drilldown's own pager (subFootHtml) — same 1 … 4 5 6 … 12 windowing
       every other table's footer already uses, instead of the drilldown printing every page
       number in a flat row. */
    var subPageWindow = pagerKit.pageWindow;

    var sortKit = UC.makeHeadSort({
      root: root, state: state, cycles: HEAD_CYCLE, defaultSort: DEFAULT_SORT,
      trendField: "share_trend",   /* the Share header owns its trend key too — same as urls-table */
      onSort: function(f, d){ applySort(f, d); }
    });
    var syncHeadSorters = sortKit.syncHeadSorters, headSortClick = sortKit.headSortClick;
    var legacyCopy = UC.legacyCopy;
    root.addEventListener("pointerdown", function(e){
      var grip = e.target.closest(".up-grip");
      if (!grip) return;
      e.stopPropagation();
      startResize(e);
    });

    /* ---------------- column visibility ---------------- */
    /* Progressive column drop, least-important-first: Used goes first (narrow), Type + Last Seen
       follow (vnarrow) — mirrors urls-table's overlapping-tier pattern, just with domains' own
       column set (no "ment"/"brands" here to drop). */

    /* ---------------- pagination ---------------- */
    function firePage(){
      search.setLatest(null);
      state.softReload = false; dim.end();   // paging never dims — only sort does
      fire("data-page-fn", "udtPage", { limit: state.pageSize, offset: offset(), page: state.page });
    }

    /* ---------------- mentioned brands (multi-select) ---------------- */
    function populateMent(){
      if (!elMentMenu) return;   // a stale/incomplete root copy may be missing this markup
      var list = state.brands || [];
      var selCount = Object.keys(state.mentionSel).filter(function(k){ return state.mentionSel[k]; }).length;
      var head = '<div class="up-filter-head">' +
          '<span class="up-filter-title">Mentioned brands</span>' +
          (selCount
             ? '<button class="up-pop-action" type="button" data-mentreset>Reset</button>'
             : (list.length ? '<button class="up-pop-action" type="button" data-mentall>Select all</button>' : "")) +
        '</div>';
      var items = !list.length
        ? '<div class="up-ment-empty">No brands available</div>'
        : list.map(function(b){
            var id = String(b.company_id != null ? b.company_id : (b.id != null ? b.id : (b.brand_id != null ? b.brand_id : b.name)));
            var nm = String(b.name != null ? b.name : id);
            var logo = String(b.logo_url != null ? b.logo_url : (b.logo != null ? b.logo : (b.favicon != null ? b.favicon : "")));
            return '<div class="up-filter-item' + (state.mentionSel[id] ? " is-checked" : "") +
                   '" data-brand="' + esc(id) + '" data-name="' + esc(nm.toLowerCase()) + '" title="' + esc(nm) + '">' +
                     '<span class="up-filter-check">' + CHECK_SVG + '</span>' +
                     (logo ? '<span class="up-ment-logo"><img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>'
                           : '<span class="up-ment-logo"></span>') +
                     '<span class="up-ment-name">' + esc(nm) + '</span>' +
                   '</div>';
          }).join("");
      var search = list.length
        ? '<div class="up-ment-searchwrap">' +
            '<input class="up-ment-search" type="text" placeholder="Search brands..." autocomplete="off" spellcheck="false" value="' + esc(mentQuery) + '"/>' +
            '<button class="up-ment-searchclear" type="button" aria-label="Clear brand search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg></button>' +
          '</div>'
        : '';
      elMentMenu.innerHTML = head + search +
        '<div class="up-filter-list up-ment-list is-fill-checked">' + items +
          '<div class="up-ment-noresult" style="display:none">No matches</div></div>' +
        '<button class="up-filter-submit" type="button" data-mentapply>Apply</button>';
      applyMentFilter();
    }
    /* Sucht in der Markenliste des Dropdowns -- siehe UC.mentFilter in core.js. Das Kit gibt die
       uebernommene Sucheingabe zurueck, damit sie hier im eigenen mentQuery weiterlebt. */
    function applyMentFilter(){ mentQuery = UC.mentFilter(elMentMenu, mentQuery); }
    /* Kopfzeile des Dropdowns (Titel + Reset/Select all) -- siehe UC.mentHead in core.js. */
    function syncMentHead(){ UC.mentHead(elMentMenu, state.brands, state.mentionSel); }
    function syncMentLabel(){
      var keys = Object.keys(state.mentionApplied).filter(function(k){ return state.mentionApplied[k]; });
      elMent.classList.toggle("is-active", !!keys.length);
      var lbl;
      if (!keys.length) lbl = "All Brands";
      else if (keys.length === 1){
        var hit = (state.brands || []).filter(function(b){
          return String(b.company_id != null ? b.company_id : (b.id != null ? b.id : (b.brand_id != null ? b.brand_id : b.name))) === keys[0];
        })[0];
        lbl = hit ? String(hit.name || keys[0]) : keys[0];
      } else lbl = keys.length + " Brands";
      elMentLbl.textContent = lbl;
      fitToolbar();
    }
    function submitMent(){
      var next = {};
      Object.keys(state.mentionSel).forEach(function(k){ if (state.mentionSel[k]) next[k] = true; });
      var before = Object.keys(state.mentionApplied).filter(function(k){ return state.mentionApplied[k]; }).sort().join(",");
      var after  = Object.keys(next).sort().join(",");
      if (after === before){ persist(); return; }
      closeDrilldown();
      state.mentionApplied = next;
      state.page = 1;
      state.softReload = false; dim.end();
      persist(); syncMentLabel(); renderPager();
      fire("data-mentioned-fn", "udtMentioned", { brands: Object.keys(next).join(",") });
    }

    /* ---------------- brand mentioned (single toggle) ---------------- */
    function syncBrand(){
      if (!elBrand) return;
      var name = root.getAttribute("data-brand-name") || "";
      var logo = root.getAttribute("data-brand-logo") || "";
      var valid = name && name !== "BRAND_NAME";
      /* Gated on the DATA, not just the attribute: Bubble can set data-brand-name long before the
         first row payload lands. Two separate conditions, both needed:
           hasData  — nothing has ever arrived, so there is nothing to filter yet.
           rows on screen while busy — a reload that still has its old rows keeps the toggle put
             (re-hiding it on every loading=yes made it flicker out on each reload), but a reload
             showing nothing but skeleton must not offer a filter over an empty table. */
      /* PAGE-LOAD RULE (asked for repeatedly, and this is the line that broke it): with no data
         before the load, the toggle stays hidden until loading has actually finished -- not the
         moment the first rows appear. The old condition showed it as soon as rows existed, even
         mid-load, so it flashed in, went again on the next loading tick, and came back at the
         end. Once it has settled ONCE, a later reload keeps it put: a refresh must not make it
         disappear and reappear either. */
      if (!isBusy() && state.hasData) state.brandSettled = true;
      elBrand.classList.toggle("is-visible", !!valid && state.hasData && !!state.brandSettled);
      if (!valid) return;
      elBrandLbl.textContent = name + " mentioned";
      if (logo && logo !== "BRAND_LOGO"){ elBrandLogo.src = logo; elBrandLogo.style.display = "block"; }
      else { elBrandLogo.style.display = "none"; }
      elBrand.classList.toggle("is-yes", state.brandMentioned === "yes");
      elBrand.classList.toggle("is-no", state.brandMentioned === "no");
    }
    function cycleBrand(){
      closeDrilldown();
      // off → yes → no → off
      state.brandMentioned = state.brandMentioned === "" ? "yes" : (state.brandMentioned === "yes" ? "no" : "");
      state.page = 1;
      state.softReload = false; dim.end();
      persist(); syncBrand(); renderPager();
      fire("data-brand-fn", "udtBrand", { brand_mentioned: state.brandMentioned });
    }

    /* ---------------- search (same debounce/min-length/reqId pattern as urls-table.js) ---------------- */

    /* ---------------- export ---------------- */
    function openExport(){
      var id = String(root.getAttribute("data-export-instance") || "").trim();
      var fn = window.upstreemExportOpen
        || (window.parent && window.parent.upstreemExportOpen)
        || (window.top && window.top.upstreemExportOpen);
      if (typeof fn !== "function"){
        console.warn("[domains-table] window.upstreemExportOpen not found — is the export popup " +
          "component placed on this page?");
        return;
      }
      if (!id || id === "EXPORT_INSTANCE_ID"){
        console.warn("[domains-table] data-export-instance is not set. Put the export popup's " +
          "instanceId there so this button knows which popup to open.");
        return;
      }
      try { fn(id); } catch(e){}
    }

    /* ---------------- column explainers ---------------- */
    var explain = document.createElement("div");
    explain.className = "up-explain";
    document.body.appendChild(explain);
    function explainVisual(kind){
      if (kind === "type"){
        return ["Editorial","UGC_Community","Institutional"].map(function(k){
          var label = citeName(k);
          var col = CITE_COLOR[label] || OTHER_LIGHT;
          return '<span class="udt-explain-chip" style="color:' + col + ';background:' + tint(col, isDark ? 0.18 : 0.12) + '">' + esc(label) + '</span>';
        }).join("");
      }
      if (kind === "used"){
        return '<span class="udt-explain-row">1.2k</span>';
      }
      if (kind === "share"){
        return '<span class="udt-explain-row">18.4%' +
               '<span class="udt-explain-up">' + TREND_UP + '</span>' +
               '<span class="udt-explain-up">2.9%</span></span>' +
               '<span class="udt-explain-row">6.1%' +
               '<span class="udt-explain-down">' + TREND_DOWN + '</span>' +
               '<span class="udt-explain-down">1.4%</span></span>';
      }
      return '<span class="udt-explain-row">6.9%</span>';
    }
    /* Share text comes from UC.EXPLAIN_TEXT (core) — same wording urls-table's Share column uses,
       just "URL" swapped for "domain". Used/Citation Type have no counterpart elsewhere, local. */
    var EXPLAIN_LOCAL = {
      used: { h: "Used", t: "How many of this domain's pages were cited across all responses in the period." },
      type: { h: "Citation Type", t: "What kind of source this domain is: editorial, UGC, institutional, and so on." }
    };
    function explainInfo(kind){
      if (EXPLAIN_LOCAL[kind]) return EXPLAIN_LOCAL[kind];
      if (kind === "share" && UC.explainCopy) return UC.explainCopy("share", { subject: "domain" });
      if (kind === "share") return { h: "Share", t: "How much of all citations in the period went to this domain, plus the change against the previous period." };
      return null;
    }
    function showExplain(el){
      var kind = el.getAttribute("data-explain");
      var info = explainInfo(kind);
      if (!info) return;
      explain.setAttribute("data-theme", isDark ? "dark" : "light");
      explain.innerHTML =
        '<div class="udt-explain-vis">' + explainVisual(kind) + '</div>' +
        '<div class="udt-explain-h">' + esc(info.h) + '</div>' +
        '<div class="udt-explain-t">' + esc(info.t) + '</div>';
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
      var el = e.target.closest(".up-th-info");
      if (el && root.contains(el)) showExplain(el);
    });
    root.addEventListener("mouseout", function(e){
      if (e.target.closest(".up-th-info")) hideExplain();
    });

    /* ---------------- tooltips (shared via core) ---------------- */
    var _tips = UpstreemCore.makeTooltips(root, function(){ return isDark; });
    var showTipWide = _tips.showTipWide, hideTip = _tips.hideTip, unsuppressTip = _tips.unsuppress;
    /* Full title on a short hover-delay, but only when actually clipped — same rule for the domain
       rows and for the drilldown's page rows, so a hover never surfaces text the user can already
       read. .udt-sub-main deliberately carries no `title` attribute: the native tooltip would fire
       on every row regardless of clipping and can't be styled or delayed. */
    var TIP_WRAP_SEL = ".udt-dom-wrap, .udt-sub-main";
    var titleTipTimer = null, titleTipWrap = null;
    root.addEventListener("mouseover", function(e){
      var wrap = e.target.closest(TIP_WRAP_SEL);
      if (!wrap || !root.contains(wrap)) return;
      if (wrap === titleTipWrap) return;
      titleTipWrap = wrap;
      /* Same thing the core's delegated [data-tip] path does on mouseover: entering a new trigger
         lifts the suppression a previous click left behind. These wraps carry no data-tip, so
         nothing else would ever clear it. */
      if (unsuppressTip) unsuppressTip();
      clearTimeout(titleTipTimer);
      titleTipTimer = setTimeout(function(){
        var dt = wrap.querySelector(".udt-dom-title, .udt-sub-title");
        if (dt && dt.scrollWidth > dt.clientWidth + 1) showTipWide(dt, dt.textContent);
      }, 400);
    });
    root.addEventListener("mouseout", function(e){
      var wrap = e.target.closest(TIP_WRAP_SEL);
      if (!wrap || wrap !== titleTipWrap) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(TIP_WRAP_SEL) === wrap) return;
      titleTipWrap = null; clearTimeout(titleTipTimer); hideTip();
    });

    /* A 1s dwell on a domain row swaps the plain goto arrow for the explicit "Show Pages" control
       (item 10) — long enough that a cursor merely passing over the row on its way somewhere else
       never triggers it, but short enough to reward someone who is actually reading that row.
       Plain class toggle rather than a CSS transition-delay: a delayed appear and a delayed
       DISAPPEAR-after-appear on the SAME hover is two different endpoints for one continuous
       :hover state, which plain CSS transitions can't express without reaching for keyframes tied
       to a fixed total duration — a JS timer is simpler and exactly as reliable. */
    /* Die Uhr steht in core (UC.rowDwell) -- brands-overview braucht dieselbe fuer seinen
       Edit-Knopf, und zwei Kopien laufen auseinander. Klasse und Dauer bleiben, wie sie waren. */
    UC.rowDwell(root, "is-showpages-hover", 1000);

    /* ---------------- events ---------------- */
    function cloneSel(o){ var n = {}; for (var k in o){ if (Object.prototype.hasOwnProperty.call(o, k) && o[k]) n[k] = true; } return n; }
    function revertDrafts(pop){
      if (pop === elFilter){ state.filterSel = cloneSel(state.appliedSel); persist(); }
      else if (pop === elMent){ state.mentionSel = cloneSel(state.mentionApplied); persist(); }
    }

    var MENU_SEL = ".up-sort-menu, .up-filter-menu, .up-cols-menu, .up-ment-menu";
    var BTN_SEL  = ".up-sort-btn, .up-filter-btn, .up-cols-btn, .up-ment-btn";
    /* Each dropdown is a plain position:absolute child of its position:relative wrapper
       (STYLEGUIDE §14). UC.makePopover owns the open/close mechanics, focus escape, Escape key,
       group auto-close and the ONE page-wide outside-click listener — previously this file
       carried its own copy of all of that plus two more document listeners. revertDrafts runs
       via the onClose callback whenever a menu closes without Apply. */
    function menuOf(pop){
      return pop === elFilter ? elFilterMenu
           : pop === elMent   ? elMentMenu
           : pop === elSort   ? elSortMenu
           : pop === elCols   ? elColsMenu
           : (pop && pop.querySelector(MENU_SEL));
    }
    function repopKeepScroll(menu, fn){
      var l = menu && menu.querySelector(".up-filter-list");
      var sc = l ? l.scrollTop : 0;
      fn();
      var nl = menu && menu.querySelector(".up-filter-list");
      if (nl) nl.scrollTop = sc;
    }
    var POP_GROUP = "udt-" + instanceId;
    [elSort, elFilter, elCols, elMent].forEach(function(p){
      if (!p) return;
      /* handle stored ON the element, never in a map keyed by className: the wrapper gains
         "is-active" as soon as the filter has a selection, so a className key stopped matching and
         the dropdown could not be opened or closed any more. */
      p.__upPop = UC.makePopover({
        wrap: p, menu: menuOf(p), opener: p.querySelector(BTN_SEL), group: POP_GROUP,
        onClose: function(committed){ if (!committed) revertDrafts(p); }
      });
    });
    function popOf(pop){ return pop && pop.__upPop; }
    function setPopOpen(pop, open){
      var h = popOf(pop); if (!h) return;
      if (open) h.open(); else h.close(false);
    }
    function closePops(except){
      [elSort, elFilter, elCols, elMent].forEach(function(p){
        if (p && p !== except) setPopOpen(p, false);
      });
    }

    function ownsTarget(tg){
      return root.contains(tg)
          || (elFilterMenu && elFilterMenu.contains(tg))
          || (elMentMenu && elMentMenu.contains(tg))
          || (elSortMenu && elSortMenu.contains(tg))
          || (elColsMenu && elColsMenu.contains(tg));
    }
    document.addEventListener("click", function(e){
      if (!ownsTarget(e.target)) return;

      /* The drilldown's toolbar is handled FIRST, before anything else in this listener.
         Its type filter deliberately reuses the core .up-filter-btn / .up-filter-menu /
         .up-filter-item / .up-filter-reset classes so it looks identical to every other dropdown
         in the app — which means the toolbar handlers below would otherwise claim these clicks
         and drive the DOMAIN filter instead: opening the sub-dropdown opened the main one, and
         picking a URL type wrote a null key into state.filterSel. Matching by the data-sub*
         attributes up here keeps the shared styling without the shared behaviour. */
      var inSub = e.target.closest(".udt-subrows");
      /* --- drilldown sub-toolbar / pager ---
         Every branch below that changes what the server should return (query, type filter, page,
         page size) calls fetchSubPage() instead of a bare renderTable() — see the "server-paginated"
         comment on the state block. Only opening/closing the type MENU itself is purely local. */
      if (e.target.closest("[data-subdrillclose]")){
        e.stopPropagation();
        var hostC = e.target.closest("[data-sub-for]");
        var domC = hostC ? hostC.getAttribute("data-sub-for") : state.expandedDomain;
        if (domC) togglePages(domC);
        return;
      }
      if (e.target.closest("[data-subclear]")){
        e.stopPropagation();
        state.subQuery = ""; state.subPage = 1; fetchSubPage();
        var inp = root.querySelector(".udt-sub-search-in"); if (inp) inp.focus();
        return;
      }
      if (e.target.closest("[data-subfilter]")){
        e.stopPropagation(); subTypeOpen = !subTypeOpen; renderSubBlockOnly(state.expandedDomain); return;
      }
      if (e.target.closest("[data-subtypereset]")){
        e.stopPropagation(); state.subTypes = {}; state.subPage = 1; fetchSubPage(); return;
      }
      var subTypeItem = e.target.closest("[data-subtype]");
      if (subTypeItem){
        e.stopPropagation();
        var tk = subTypeItem.getAttribute("data-subtype");
        if (state.subTypes[tk]) delete state.subTypes[tk]; else state.subTypes[tk] = true;
        /* Applied immediately, no Apply button: the menu stays open (subTypeOpen is untouched)
           so picking several types in a row is one open/close cycle, not several. */
        state.subPage = 1; fetchSubPage(); return;
      }
      var subSizeBtn = e.target.closest("[data-subsize]");
      if (subSizeBtn){
        e.stopPropagation();
        var newSize = toNum(subSizeBtn.getAttribute("data-subsize")) || SUB_PAGE_SIZES[0];
        if (newSize === state.subPageSize) return;
        state.subPageSize = newSize; state.subPage = 1; fetchSubPage(); return;
      }
      if (e.target.closest("[data-subpage-prev]")){
        e.stopPropagation();
        if (state.subPage <= 1) return;
        state.subPage -= 1; fetchSubPage(); return;
      }
      if (e.target.closest("[data-subpage-next]")){
        e.stopPropagation();
        var subMaxPage = Math.max(1, Math.ceil((state.subTotal || 0) / state.subPageSize));
        if (state.subPage >= subMaxPage) return;
        state.subPage += 1; fetchSubPage(); return;
      }
      var subPageBtn = e.target.closest("[data-subpage]");
      if (subPageBtn){
        e.stopPropagation();
        var newPage = toNum(subPageBtn.getAttribute("data-subpage")) || 1;
        if (newPage === state.subPage) return;
        state.subPage = newPage; fetchSubPage(); return;
      }
      var subDispBtn = e.target.closest("[data-subdisp]");
      if (subDispBtn){
        e.stopPropagation();
        var mode = subDispBtn.getAttribute("data-subdisp") === "url" ? "url" : "title";
        if (mode === state.subDisplay) return;
        state.subDisplay = mode; renderSubBlockOnly(state.expandedDomain); return;   // pure display toggle, no fetch
      }
      /* Any click that is not inside the type menu itself closes it — inside the drilldown or
         anywhere else on the page. The two branches that must NOT close it (the trigger and the
         items) have already returned above. */
      if (subTypeOpen && !e.target.closest(".udt-sub-filtermenu")){
        subTypeOpen = false; renderSubBlockOnly(state.expandedDomain);
      }

      var inMenu = !inSub && e.target.closest(".up-sort-menu, .up-filter-menu, .up-cols-menu, .up-ment-menu");
      var onOpener = !inSub && e.target.closest(".up-sort-btn, .up-filter-btn, .up-cols-btn, .up-ment-btn");
      if (!inMenu && !onOpener) closePops();
      // --- pagination ---
      var ps = e.target.closest("[data-pagesize]");
      if (ps){ setPageSize(Number(ps.getAttribute("data-pagesize"))); return; }
      if (e.target.closest(".up-page-prev")){ goToPage(state.page - 1); return; }
      if (e.target.closest(".up-page-next")){ goToPage(state.page + 1); return; }
      var pg = e.target.closest("[data-page]");
      if (pg){ goToPage(Number(pg.getAttribute("data-page"))); return; }

      if (e.target.closest("[data-clearall]")){
        elSearchIn.value = ""; state.query = "";
        elSearch.classList.remove("has-text");
        state.filterSel = {}; state.appliedSel = {};
        state.brandMentioned = ""; state.mentionSel = {}; state.mentionApplied = {};
        state.page = 1;
        state.softReload = false; dim.end();
        persist(); syncFilterBadge(); syncBrand(); syncMentLabel(); populateFilter(); populateMent();
        search.cancel(); runSearch();
        fire("data-filter-fn", "udtFilter", { citation_types: "" });
        fire("data-mentioned-fn", "udtMentioned", { brands: "" });
        return;
      }

      // --- toolbar ---
      if (e.target.closest(".up-search-clear")){
        if (root.classList.contains("is-searchtakeover")){ toggleSearch(); return; }
        elSearchIn.value = ""; state.query = "";
        elSearch.classList.remove("has-text");
        persist(); search.cancel(); runSearch();
        try { elSearchIn.focus(); } catch(e2){}
        return;
      }
      if (e.target.closest(".up-export")){ openExport(); return; }
      if (e.target.closest(".up-search-btn")){ closePops(); toggleSearch(); return; }
      if (e.target.closest(".udt-brand-toggle")){ closePops(); cycleBrand(); return; }

      if (e.target.closest(".up-ment-clear")){
        state.mentionSel = {}; persist();
        if (elMent.classList.contains("is-open")) populateMent();
        submitMent(); setPopOpen(elMent, false);
        return;
      }
      var mentBtn = e.target.closest(".up-ment-btn");
      if (mentBtn){
        var openM = !elMent.classList.contains("is-open");
        closePops(elMent);
        if (openM){ state.mentionSel = cloneSel(state.mentionApplied); mentQuery = ""; populateMent(); }
        setPopOpen(elMent, openM);
        return;
      }
      if (e.target.closest(".up-ment-searchclear")){
        var msi = elMentMenu.querySelector(".up-ment-search");
        if (msi){ msi.value = ""; mentQuery = ""; applyMentFilter(); try { msi.focus(); } catch(e2){} }
        return;
      }
      var mentItem = e.target.closest("[data-brand]");
      if (mentItem){
        var bid = mentItem.getAttribute("data-brand");
        state.mentionSel[bid] = !state.mentionSel[bid];
        persist();
        mentItem.classList.toggle("is-checked", !!state.mentionSel[bid]);
        syncMentHead();
        return;
      }
      if (e.target.closest("[data-mentall]")){
        state.mentionSel = {};
        (state.brands || []).forEach(function(b){
          var id = String(b.company_id != null ? b.company_id : (b.id != null ? b.id : (b.brand_id != null ? b.brand_id : b.name)));
          state.mentionSel[id] = true;
        });
        persist(); populateMent(); submitMent();
        return;
      }
      if (e.target.closest("[data-mentreset]")){
        state.mentionSel = {}; persist(); populateMent(); submitMent(); setPopOpen(elMent, false);
        return;
      }
      if (e.target.closest("[data-mentapply]")){ submitMent(); setPopOpen(elMent, false); return; }

      var colsBtn = e.target.closest(".up-cols-btn");
      if (colsBtn){
        var openC = !elCols.classList.contains("is-open");
        closePops(elCols);
        if (openC) populateCols();
        setPopOpen(elCols, openC);
        return;
      }
      if (e.target.closest("[data-colsall]")){ selectAllCols(); return; }
      var colRow = e.target.closest("[data-col]");
      if (colRow){ toggleCol(colRow.getAttribute("data-col")); return; }

      var sortBtn = e.target.closest(".up-sort-btn");
      if (sortBtn){
        var openS = !elSort.classList.contains("is-open");
        closePops(elSort);
        if (openS) populateSort();
        setPopOpen(elSort, openS);
        return;
      }
      if (e.target.closest(".up-filter-btn-clear")){
        state.filterSel = {}; persist();
        if (elFilter.classList.contains("is-open")) populateFilter();
        submitFilter(); setPopOpen(elFilter, false);
        return;
      }
      var filterBtn = e.target.closest(".up-filter-btn");
      if (filterBtn){
        var openF = !elFilter.classList.contains("is-open");
        closePops(elFilter);
        if (openF){ state.filterSel = cloneSel(state.appliedSel); populateFilter(); }
        setPopOpen(elFilter, openF);
        return;
      }

      // --- sort menu ---
      var sf = e.target.closest("[data-sortfield]");
      if (sf){ applySort(sf.getAttribute("data-sortfield"), state.sortDir); return; }
      if (e.target.closest("[data-sortdir]")){
        applySort(state.sortField, state.sortDir === "desc" ? "asc" : "desc");
        return;
      }

      // --- filter menu ---
      var fi = e.target.closest(".up-filter-item");
      if (fi){
        var key = fi.getAttribute("data-type");
        state.filterSel[key] = !state.filterSel[key];
        persist(); repopKeepScroll(elFilterMenu, populateFilter);
        return;
      }
      if (e.target.closest(".up-filter-reset")){
        state.filterSel = {};
        persist(); populateFilter(); submitFilter(); setPopOpen(elFilter, false);
        return;
      }
      if (e.target.closest("[data-typeapply]")){
        submitFilter(); setPopOpen(elFilter, false);
        return;
      }

      // --- header sorters ---
      var th = e.target.closest(".up-th.is-sortable");
      if (th){ headSortClick(th.getAttribute("data-sortcol")); return; }

      /* --- drilldown: "N pages" toggle + clicks on a page row ---
         Both sit inside .up-row, so they must be handled (and stopped) before the row-click below,
         otherwise expanding a domain would also fire udtRowClick and navigate away. */
      var pagesBtn = e.target.closest("[data-pages-toggle]");
      if (pagesBtn){
        e.stopPropagation();
        var rowP = pagesBtn.closest(".up-row");
        var dP = rowP ? rowP.getAttribute("data-domain") : "";
        if (dP) togglePages(dP);
        return;
      }
      var subRow = e.target.closest(".udt-subrow");
      if (subRow && !subRow.classList.contains("is-sk")){
        e.stopPropagation();
        var su = subRow.getAttribute("data-suburl") || "";
        var subHost = subRow.closest("[data-sub-for]");
        if (su) fire("data-openurl-fn", "udtOpenUrl", {
          url: su, domain: subHost ? subHost.getAttribute("data-sub-for") : ""
        });
        return;
      }

      // --- row actions (must come BEFORE the row-click handler) ---
      var copyBtn = e.target.closest(".up-act-copy");
      if (copyBtn){
        e.stopPropagation();
        var rowC = copyBtn.closest(".up-row");
        var dC = rowC ? rowC.getAttribute("data-domain") : "";
        if (dC){
          var done = function(){
            try { window.showMacToast && window.showMacToast("Copied to clipboard", { icon: "copy", timeout: 2000 }); } catch(e){}
            copyBtn.classList.add("is-done");
            clearTimeout(copyBtn.__udtT);
            copyBtn.__udtT = setTimeout(function(){ copyBtn.classList.remove("is-done"); }, 1400);
          };
          try {
            if (navigator.clipboard && navigator.clipboard.writeText){
              navigator.clipboard.writeText(dC).then(done, function(){ legacyCopy(dC); done(); });
            } else { legacyCopy(dC); done(); }
          } catch(e){ legacyCopy(dC); done(); }
        }
        return;
      }
      var openBtn = e.target.closest(".up-act-open");
      if (openBtn){
        e.stopPropagation();
        var rowO = openBtn.closest(".up-row");
        var dO = rowO ? rowO.getAttribute("data-domain") : "";
        if (dO){
          var url = /^https?:\/\//i.test(dO) ? dO : "https://" + dO;
          try { window.open(url, "_blank", "noopener,noreferrer"); } catch(e){}
        }
        return;
      }

      // --- row click ---
      var row = e.target.closest(".up-row");
      if (row && !row.classList.contains("up-tsk")){
        var d = row.getAttribute("data-domain");
        if (d) fire("data-rowclick-fn", "udtRowClick", { domain: d });
      }
    });

    root.addEventListener("keydown", function(e){
      if (e.key !== "Enter" && e.key !== " ") return;
      /* Page rows are focusable, so they need the same Enter/Space treatment the domain rows get —
         and they must be checked FIRST, since they sit inside a .up-row and would otherwise be
         swallowed by the domain-row branch below. The "N pages" toggle needs nothing here: it is
         a real <button>, so the browser already turns Enter/Space into a click. */
      var sub = e.target.closest && e.target.closest(".udt-subrow");
      if (sub && !sub.classList.contains("is-sk")){
        e.preventDefault();
        var su2 = sub.getAttribute("data-suburl") || "";
        var host2 = sub.closest("[data-sub-for]");
        if (su2) fire("data-openurl-fn", "udtOpenUrl", {
          url: su2, domain: host2 ? host2.getAttribute("data-sub-for") : ""
        });
        return;
      }
      var row = e.target.closest && e.target.closest(".up-row");
      if (!row || row.classList.contains("up-tsk")) return;
      e.preventDefault();
      var d = row.getAttribute("data-domain");
      if (d) fire("data-rowclick-fn", "udtRowClick", { domain: d });
    });

    if (elSearchIn){
      elSearchIn.addEventListener("input", onSearchInput);
      elSearchIn.addEventListener("keydown", function(e){
        if (e.key === "Escape"){ e.stopPropagation(); toggleSearch(); }
        if (e.key === "Enter"){ search.cancel(); if (state.query.length >= MIN || !state.query.length) runSearch(); }
      });
    }

    var lastProcAttr = String(root.getAttribute("data-processing") || "") + "|" +
                       String(root.getAttribute("data-processing2") || "");
    var explicitOverride = false;
    /* Zwei Quellen fuer den Skeleton-Zustand, absichtlich getrennt:
         state.loading     — INTERN: von UC.makeSearch/UC.makePager gesetzt, wenn die Komponente
                             selbst nachlaedt. Wird geloescht, sobald Zeilen ankommen.
         state.extLoading  — EXTERN: data-processing/-2 oder ein expliziter set*Loading-Aufruf.
                             Wird NUR durch die Gegenseite geloescht, nie durch ankommende Daten.
       Vorher teilten sich beide einen Schalter, deshalb beendete die erste Datenlieferung auch
       einen extern gesetzten Ladezustand — die Tabelle verliess den Skeleton frueher als eine
       Chart-Komponente, deren set*Loading("no") gleichzeitig geplant war. */
    function isBusy(){ return !!state.loading || !!state.extLoading; }
    var syncFromAttrs = function(muts){
      /* Shared: UC.syncTheme applies data-isdark to data-theme and reports whether it moved.
         Five components had these seven lines character for character. */
      var _th = UC.syncTheme(root, isDark);
      isDark = _th.isDark;
      var changed = _th.changed;
      /* Reiner Themewechsel: Ladezustand nicht anfassen. Siehe UC.themeOnly. */
      if (UC.themeOnly && UC.themeOnly(muts)){ if (changed) render(); return; }
      var procAttr = String(root.getAttribute("data-processing") || "") + "|" +
                     String(root.getAttribute("data-processing2") || "");
      if (procAttr !== lastProcAttr){
        lastProcAttr = procAttr;
        explicitOverride = false;
      }
      if (!explicitOverride){
        var wantProc = readProcessing();
        if (wantProc !== state.extLoading){ state.extLoading = wantProc; changed = true; }
      }
      if (changed) render();
    };
    new MutationObserver(syncFromAttrs).observe(root, {
      attributes: true, attributeFilter: ["data-isdark","data-processing","data-processing2","data-brand-name","data-brand-logo"]
    });
    syncFromAttrs();

    /* Toolbar/table responsive tiers — same measured-gap approach as urls-table.js. The w3/w2/w1/w0
       hiding rules for the generic controls (.up-ment/.up-sort/.up-cols/.up-export) already live in
       core.css; only the brand-toggle's w3 rule is component-specific (see domains-table.css). */
    var MIN_HEAD_GAP = 64;
    var SEARCH_OPEN_WIDTH = 202;
    var MOBILE_SEARCH_MAX = 640;
    var TOOLBAR_TIERS = ["is-w3", "is-w2", "is-w1", "is-w0"];
    /* Shared: UC.headGap. Five components measured this identically (urls-table differed only in
       two comments). */
    function headGap(){ return UC.headGap(elHeading, elHeadTools, elSearch, SEARCH_OPEN_WIDTH); }
    function fitToolbar(){
      if (!elHeading || !elHeadTools) return;
      if (root.classList.contains("is-searchtakeover")) return;
      for (var r = 0; r < TOOLBAR_TIERS.length; r++) root.classList.remove(TOOLBAR_TIERS[r]);
      for (var i = 0; i < TOOLBAR_TIERS.length; i++){
        if (headGap() >= MIN_HEAD_GAP) return;
        root.classList.add(TOOLBAR_TIERS[i]);
      }
    }
    function applyResponsive(){
      var w = root.getBoundingClientRect().width || 0;
      if (!w) return;
      var before = root.className;
      syncSearchTakeover();
      fitToolbar();
      root.classList.toggle("is-t2", w < 720);   // row actions
      root.classList.toggle("is-t1", w < 560);   // "N pages" subtext (core.css: .up-root.is-t1 .up-pages)
      root.classList.toggle("is-t0", w < 440);   // trend chip
      root.classList.toggle("is-narrow", w < 860);
      root.classList.toggle("is-vnarrow", w < 620);
      /* Unconditional: which columns fit is now a continuous function of the width (autoFit
         in UC.makeColumns), not only of the tier classes above. applyCols() no-ops when the
         resulting layout is unchanged, so this stays cheap on every resize frame. */
      applyCols();
    }
    /* Fallback when core.js is OLDER than this file.
       core.js is a single global (window.UpstreemCore) shared by every component on the page, but
       each component loads it via its OWN data-cdn-pin — so a page with mixed pins ends up with
       whichever core.js executed last. Calling a function a stale core does not have throws
       inside initRoot, which aborts the whole component: no controller is stored, so render* and
       reset* silently do nothing afterwards. Degrading here instead keeps the component alive on
       a mixed page; only the newer behaviour is missing. */
    function onResizeCompat(el, fn){
      if (UpstreemCore.onResize) return UpstreemCore.onResize(el, fn);
      if (window.ResizeObserver){
        var raf = null;
        new ResizeObserver(function(){
          if (raf) return;
          raf = requestAnimationFrame(function(){ raf = null; fn(); });
        }).observe(el);
      } else {
        window.addEventListener("resize", UpstreemCore.rafThrottle(fn));
      }
    }
    /* One coalesced responsive pass per frame (core). The old pairing of a
       ResizeObserver AND a window-resize listener ran the whole measure/drop cascade
       TWICE per frame while a window was being dragged, and each pass forces several
       synchronous reflows. onResize also skips frames where the width did not change. */
    onResizeCompat(root, applyResponsive);

    /* sticky header machinery (core) */
    var _sticky = UpstreemCore.makeSticky(root, elHead);
    function syncTheadOffset(){ _sticky.syncTheadOffset(); }
    function applySticky(){ _sticky.applySticky(); }
    window.addEventListener("resize", UpstreemCore.rafThrottle(applySticky));
    applySticky();
    /* scroll-repositioning for the portaled dropdowns is handled centrally by
       UpstreemCore.makePortal — see core.js */
    function render(){
      renderTable(); renderCount(); syncHeadSorters(); syncBrand(); syncFilterBadge(); syncColsBadge();
      renderPageSize(); renderPager(); applyCols(); syncMentLabel(); applyResponsive();
      if (root.classList.contains("up-sticky")) syncTheadOffset();
    }

    if (state.query){ elSearchIn.value = state.query; elSearch.classList.add("is-open", "has-text"); }
    populateSort(); populateFilter(); populateCols(); populateMent(); render();

    return {
      root: root,
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          /* NICHT isYes(params.isDark): der Parameter ist eine Momentaufnahme aus dem Moment,
             in dem Bubble den Payload gebaut hat. Kennt core ein Thema, gewinnt core -- sonst
             dreht ein Render-Aufruf mit altem is_dark die Komponente hinter der App zurueck.
             Siehe UC.themeParam. */
          isDark = UC.themeParam(params.isDark);
          if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        }
        if (params.requestId != null && search.latestReqId() != null && String(params.requestId) !== String(search.latestReqId())) return;
        /* A fresh row payload closes an open drilldown regardless of what triggered it — our own
           search/sort/filter/page already closed it synchronously at click time (see
           closeDrilldown()'s call sites), so this only actually does anything for a re-render that
           came from outside this component's own UI (a page-level filter, a poll, anything else
           that calls renderDomainsTable directly). Item 9 asked for exactly that: internal or
           external, any outer reload closes the drilldown, no exceptions. */
        if (params.rows != null) closeDrilldown();
        if (params.rows != null){
          state.rows = Array.isArray(params.rows) ? params.rows : [];
          state.hasData = true;
        }
        if (params.totalCount != null) state.totalCount = toNum(params.totalCount);
        if (params.brands != null){
          var _b = Array.isArray(params.brands) ? params.brands : [];
          if (_b.length) state.brands = _b;
          populateMent();
        }
        if (params.brand_name != null) root.setAttribute("data-brand-name", String(params.brand_name));
        if (params.brand_logo != null) root.setAttribute("data-brand-logo", String(params.brand_logo));
        /* Ankommende Zeilen beenden nur das selbst ausgeloeste Nachladen. Ein extern gesetzter
           Ladezustand bleibt stehen, bis Bubble ihn selbst aufhebt — sonst wuerde diese Tabelle
           den Skeleton frueher verlassen als die Charts daneben. */
        /* Zeilen sind die Antwort, auf die JEDER Ladezustand gewartet hat, auch der
           ausdrueckliche. Blieb state.extLoading stehen, drehte die Tabelle nach einem
           setLoading("yes") ohne passendes "no" fuer immer weiter -- derselbe Fall wie in
           prompts-table, dort gemeldet. CLAUDE.md: ein Ladezustand muss IMMER enden. */
        if (params.rows != null){ state.loading = false; state.softReload = false; dim.end(); state.extLoading = false; }
        if (!explicitOverride && hasProcessingAttr()) state.extLoading = readProcessing();
        persist(); render();
      },
      setLoading: function(on){
        explicitOverride = true;
        LOADING_EXPLICIT[instanceId] = true;
        state.extLoading = isYes(on);
        if (!state.extLoading){ state.loading = false; state.softReload = false; dim.end(); }   // "fertig" beendet auch ein internes Nachladen
        persist(); render();
      },
      /* Answer to a udtShowPages event — now one PAGE's worth of rows, not the whole domain, and
         called again for every later search/type/page/page-size change too (see fetchSubPage).
         requestId is optional: pass back the request_id this component sent out, and a response
         that arrives after a newer request was already fired gets dropped instead of briefly
         flashing stale rows. Omit it and every response is accepted, same as before.
         Only repaints when the domain is still expanded — a user who collapsed the row before the
         RPC came back should not have it pop open again. */
      setPages: function(domain, list, requestId){
        if (requestId != null && state.subReqId != null && String(requestId) !== String(state.subReqId)) return true;
        if (state.expandedDomain !== domain) return true;
        state.subRows = list;
        /* total_count rides on every row now (each page carries the grand total for its own
           domain+filter combination) — read it off the first one. A response with rows but no
           total_count falls back to the row count itself rather than showing "1–10 of 0". */
        state.subTotal = list.length ? (toNum(list[0] && list[0].total_count) || list.length) : 0;
        state.subLoading = false;
        /* This lands asynchronously, arbitrarily long after the request that triggered it — the
           sub-search input's own debounce handler already restores focus for ITS render, but this
           is a SECOND, later render the user did nothing to trigger, and renderTable() rebuilds
           the toolbar from scratch either way. Without carrying focus across it too, a keystroke
           that landed just before the response arrived would drop out of the field the instant
           the response did. */
        var searchEl = root.querySelector(".udt-sub-search-in");
        var hadFocus = !!searchEl && document.activeElement === searchEl;
        var caret = hadFocus ? searchEl.selectionStart : null;
        renderSubBlockOnly(domain);
        if (hadFocus){
          var again = root.querySelector(".udt-sub-search-in");
          if (again){ again.focus(); try { again.setSelectionRange(caret, caret); } catch(e){} }
        }
        return true;
      },
      reset: function(){
        state.query = ""; elSearchIn.value = ""; elSearch.classList.remove("is-open");
        state.filterSel = {}; state.appliedSel = {};
        state.brandMentioned = "";
        state.sortField = DEFAULT_SORT.field; state.sortDir = DEFAULT_SORT.dir;
        state.pageSize = DEFAULT_PAGE_SIZE; state.page = 1;
        state.mentionSel = {}; state.mentionApplied = {};
        state.widths = {}; writeWidths();
        state.softReload = false; dim.end();
        elSearch.classList.remove("has-text");
        persist(); populateSort(); populateFilter(); render();
        return true;
      },
      destroy: function(){
        if (explain.parentNode) explain.parentNode.removeChild(explain);
        if (root.__udtController === this) root.__udtController = null;
      }
    };
  }

  /* ================= init / multi-instance bootstrap =================
     .udt-root (not the shared .up-root) is the init selector — see the matching comment in
     urls-table.js. Both components carry .up-root for CSS variables/theming; .udt-root marks
     "this root belongs to domains-table.js" so the two scripts never fight over each other's
     elements once both sit on the same page. */
  function initRoot(root){
    if (root.__udtController) return root.__udtController;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;   // placeholder not replaced yet
    var ctrl = makeController(root);
    if (!ctrl) return null;
    /* Die Markenliste kommt seitenweit aus core (setUpstreemBrands), nicht mehr nur aus dem
       eigenen Run-JS-Setter: EIN Aufruf pro Seite statt einer pro Placement, und eine neu
       angelegte oder deaktivierte Marke erreicht jede Komponente, auch die, an die niemand
       gedacht hat. Der komponenteneigene Setter bleibt als Rueckfall bestehen -- ein LEERER
       Store ueberschreibt nichts, eine Seite ohne setUpstreemBrands() verhaelt sich also
       unveraendert. */
    if (UC.brandsInto) UC.brandsInto(root, function(list){ ctrl.update({ brands: list }); });
    root.__udtController = ctrl;
    return ctrl;
  }
  function resolve(id){
    var r = rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    if (r.length === 1) return initRoot(r[0]);
    for (var i = 0; i < r.length; i++){
      try { if (r[i].offsetParent) return initRoot(r[i]); } catch(e){}
    }
    return initRoot(r[0]);
  }

  function doRender(params){
    var id = params && params.instanceId;
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".udt-root"));
    if (!ctrl) return false;
    ctrl.update(params);
    return true;
  }
  function doLoading(id, on){ var c = resolve(id); if (!c) return false; c.setLoading(on); return true; }
  function doReset(id){ var c = resolve(id); if (!c) return false; return c.reset(); }

  function doBrands(id, brands){
    var list = brands;
    if (typeof list === "string"){ try { list = JSON.parse(list); } catch(e){ list = []; } }
    if (!Array.isArray(list)) list = [];
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".udt-root"));
    if (!ctrl) return false;
    ctrl.update({ brands: list });
    return true;
  }
  /* Feeds one PAGE of a domain's pages into its expanded row — called from the Run-JS step that
     answers udtShowPages, and again for every later search/type/page/page-size change (the event
     re-fires each time, see fetchSubPage in makeController). Accepts a ready array OR the raw
     Bubble text, same as doBrands — the RPC response can be handed straight through without
     parsing it Bubble-side. Each item should carry total_count (the grand total for the current
     domain+filters, same value on every row) so the footer can paginate correctly.
     requestId is OPTIONAL — pass back the request_id the udtShowPages payload carried to guard
     against a slow response overwriting a faster, later one; omit it and every response is
     accepted as-is.
     Until this lands, the expanded row shows a skeleton on its own; an empty array is a valid
     answer and renders the "no pages" / "no matches" line rather than an endless skeleton. */
  function doPages(id, domain, urls, requestId){
    var dom = String(domain == null ? "" : domain).trim();
    if (!dom){
      if (window.console) console.warn("[domains-table] setDomainsTablePages needs a domain as the 2nd argument.");
      return false;
    }
    var list = urls;
    if (typeof list === "string") list = UC.parseBubbleJson(list);
    if (!Array.isArray(list)) list = [];
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".udt-root"));
    if (!ctrl){
      if (window.console) console.warn("[domains-table] setDomainsTablePages: no .udt-root matches instanceId " +
        JSON.stringify(id) + " — the pages were dropped.");
      return false;
    }
    return ctrl.setPages(dom, list, requestId);
  }
  /* mount from core: root registry, iframe forwarder, wheel forwarding, init cascade and the
     replay of whatever Bubble queued against the stubs. doRender/doLoading/doReset stay local. */
  var mount = UC.makeMount({
    /* onMount: makeMount replays Bubble's queued render* calls while it is still
       constructing, i.e. before `mount` below has been assigned. Without this the very
       first render Bubble queued threw on `mount` being undefined and was swallowed. */
    onMount: function(m){ mount = m; },
    rootClass: "udt-root", notPortal: true,
    ctrlProp: "__udtController",
    resolveLocal: "__udtResolveLocal",
    queue: "__udtBootQueue",
    initRoot: initRoot,
    api: { renderDomainsTable: doRender, setDomainsTableLoading: doLoading, resetDomainsTable: doReset,
           setDomainsTableBrands: doBrands, setDomainsTablePages: doPages },
    forwardShape: { renderDomainsTable: "params", resetDomainsTable: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end udtRun

  udtBoot(50); // retry for ~5s before giving up on core.js
})();
