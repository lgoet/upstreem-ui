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
    ["renderDomainsTable", "setDomainsTableLoading", "resetDomainsTable"].forEach(function(n){
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
  var CITE_COLOR = UC.CITE_COLOR, CITE_ALIAS = UC.CITE_ALIAS, ALL_CITATION_TYPES = UC.ALL_CITATION_TYPES, OTHER_LIGHT = UC.OTHER_LIGHT, OTHER_DARK = UC.OTHER_DARK, CHIP_BG_DARK = UC.CHIP_BG_DARK, MONTHS = UC.MONTHS, DEBOUNCE = UC.DEBOUNCE, MIN = UC.MIN, SORT_DEBOUNCE = UC.SORT_DEBOUNCE, PAGE_SIZES = UC.PAGE_SIZES, DEFAULT_PAGE_SIZE = UC.DEFAULT_PAGE_SIZE, fmtTotal = UC.fmtTotal, isYes = UC.isYes, highlight = UC.highlight, esc = UC.esc, citeName = UC.citeName, tint = UC.tint, toNum = UC.toNum, fmt1 = UC.fmt1, fmtInt = UC.fmtInt, fmtDate = UC.fmtDate, foldDiacritics = UC.foldDiacritics, germanExpand = UC.germanExpand, resolveBubbleFn = UC.resolveBubbleFn, TREND_UP = UC.TREND_UP, TREND_DOWN = UC.TREND_DOWN, CHECK_SVG = UC.CHECK_SVG, COPY_SVG = UC.COPY_SVG, GOTO_SVG = UC.GOTO_SVG, DONE_SVG = UC.DONE_SVG, EXT_SVG = UC.EXT_SVG;

  /* Own store, deliberately NOT UpstreemCore.STORE — that's hardcoded to window.__uutStore
     inside core.js (urls-table-specific despite living in the "shared" file). Sharing it here
     would let a domains-table instance's persisted state collide with a urls-table instance's. */
  var STORE = (window.__udtStore = window.__udtStore || {});
  var LOADING_EXPLICIT = (window.__udtLoadingExplicit = window.__udtLoadingExplicit || {});

  /* Hideable columns. Domain and Actions are deliberately absent — the table makes no sense
     without the domain, and the row actions are the point of the Actions cell. */
  var COLUMNS = [
      { key: "share",    label: "Share",     w: "minmax(13%, 150px)",   min: 130 },
      { key: "used",     label: "Used",      w: "minmax(11%, 1fr)",     min: 100, dropAt: "narrow" },
      { key: "type",     label: "Type",      w: "minmax(11%, 1fr)",     min: 118, dropAt: "vnarrow" },
      { key: "lastseen", label: "Last Seen", w: "minmax(104px, 0.7fr)", min: 104, dropAt: "vnarrow" }
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
    var elSort      = root.querySelector(".up-sort");
    var elSortMenu  = root.querySelector(".up-sort-menu");
    var elBrand     = root.querySelector(".udt-brand-toggle");
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
    var mentQuery = "";   // transient brand-search query inside the mentioned dropdown
    if (elMentMenu) elMentMenu.addEventListener("input", function(e){
      if (e.target && e.target.classList && e.target.classList.contains("up-ment-search")) applyMentFilter();
    });
    var elMentLbl   = root.querySelector(".up-ment-lbl");

    var state = {
      rows: [],
      totalCount: null,
      hasData: false,
      loading: hasProcessingAttr() ? readProcessing()
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
      onFire: function(payload){ fire("data-search-fn", "udtSearch", payload); },
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
        loading: state.loading, query: state.query,
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
    function rowHtml(r){
      var dom = String(r.domain == null ? "" : r.domain);
      var fav = String(r.favicon == null ? "" : r.favicon);
      if (fav.indexOf("//") === 0) fav = "https:" + fav;
      var initial = dom.replace(/^www\./, "").charAt(0) || "?";
      var share = r.share_pct;
      var used = (r.runs_with_domain != null) ? r.runs_with_domain
               : (r.used_total != null) ? r.used_total
               : (r.used != null) ? r.used
               : r.total_used;
      var pages = toNum(r.urls_count);
      return '<div class="up-row" data-domain="' + esc(dom) + '" tabindex="0" role="button">' +
        '<div class="up-td up-td-domain">' +
          '<span class="udt-logo-box' + (fav ? " has-img" : "") + '">' +
            '<span class="udt-logo-ltr">' + esc(initial) + '</span>' +
            (fav ? '<img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                   ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
          '</span>' +
          '<span class="udt-dom-wrap">' +
            '<span class="udt-dom-title">' + highlight(dom, state.query) + '</span>' +
            '<span class="up-pages">' + fmtTotal(pages || 0) + (pages === 1 ? " page" : " pages") + '</span>' +
          '</span>' +
          '<span class="udt-row-goto">' + GOTO_SVG + '</span>' +
        '</div>' +
        '<div class="up-td up-td-share"><span class="udt-num">' + fmt1(share) + '%</span>' + trendChip(r.share_delta_pct) + '</div>' +
        '<div class="up-td up-td-used"><span class="udt-used">' + fmtTotal(used || 0) + '</span></div>' +
        '<div class="up-td up-td-type">' + tagHtml(r.citation_type) + '</div>' +
        '<div class="up-td up-td-lastseen"><span class="udt-date">' + esc(fmtDate(r.last_used_at)) + '</span></div>' +
        '<div class="up-td udt-td-actions">' +
          '<span class="udt-actions">' +
            '<button class="udt-actbtn up-act-copy" type="button" data-tip="Copy domain" aria-label="Copy domain">' + COPY_SVG + DONE_SVG + '</button>' +
            '<button class="udt-actbtn up-act-open" type="button" data-tip="Open in new tab" aria-label="Open in new tab">' + EXT_SVG + '</button>' +
          '</span>' +
        '</div>' +
      '</div>';
    }
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
      // skeleton matches the CURRENT page size, so the table doesn't visibly resize when data lands
      if (state.loading || !state.hasData){ clearEmptyGrace(); elTbody.innerHTML = skeletonRows(state.pageSize); return; }
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
            if (state.loading || !state.hasData || state.rows.length) return;   // state moved on already
            renderEmptyState(false);
          }, 3000);   // matches the line-chart's established __votNoDataT grace window (visibility-chart.js)
        }
        return;
      }
      clearEmptyGrace();
      elTbody.innerHTML = state.rows.map(rowHtml).join("");
    }
    function renderCount(){
      elHeading.classList.add("has-count");
      var n = (state.totalCount != null) ? state.totalCount : (state.hasData ? state.rows.length : null);
      if (n == null){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      elHeadCount.textContent = fmtTotal(n);
      elHeadCount.classList.remove("is-sk");
    }

    /* ---------------- header sorters ---------------- */
    /* Same "derive the cycle position from the actually-active sort" logic as urls-table.js —
       see its comment for why a stored position drifts and breaks the wrap-around. */
    function applySort(field, dir){
      state.sortField = field; state.sortDir = dir;
      state.page = 1;
      persist(); syncHeadSorters(); populateSort();
      clearTimeout(sortTimer);
      sortTimer = setTimeout(function(){
        search.setLatest(null);
        fire("data-sort-fn", "udtSort", {
          order: orderValue(state.sortField, state.sortDir),   // -> p_order — last_used_desc/asc, NOT last_seen_*
          sort_field: state.sortField, sort_dir: state.sortDir
        });
      }, SORT_DEBOUNCE);
    }

    /* ---------------- sort dropdown ---------------- */
    function populateSort(){
      if (!elSortMenu) return;   // a stale/incomplete root copy may be missing this markup
      var html = '<div class="up-pop-head">Sort by</div>';
      html += SORT_FIELDS.map(function(f){
        return '<div class="up-pop-opt' + (f.key === state.sortField ? " is-active" : "") + '" data-sortfield="' + f.key + '">' +
                 '<span>' + esc(f.label) + '</span>' +
                 '<span class="up-check">' + CHECK_SVG + '</span>' +
               '</div>';
      }).join("");
      html += '<div class="up-pop-div"></div>' +
        '<div class="up-pop-row"><span class="up-pop-label">Descending</span>' +
          '<span class="up-switch' + (state.sortDir === "desc" ? " is-on" : "") + '" role="switch" data-sortdir></span>' +
        '</div>';
      elSortMenu.innerHTML = html;
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
      state.appliedSel = next;
      state.page = 1;
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
      onChange: function(){ persist(); renderTable(); firePage(); }
    });
    var pageCount = pagerKit.pageCount, offset = pagerKit.offset;
    var renderPager = pagerKit.renderPager, renderPageSize = pagerKit.renderPageSize;
    var goToPage = pagerKit.goToPage, setPageSize = pagerKit.setPageSize;

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
            '<button class="up-ment-searchclear" type="button" aria-label="Clear brand search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
          '</div>'
        : '';
      elMentMenu.innerHTML = head + search +
        '<div class="up-filter-list up-ment-list">' + items +
          '<div class="up-ment-noresult" style="display:none">No matches</div></div>' +
        '<button class="up-filter-submit" type="button" data-mentapply>Apply</button>';
      applyMentFilter();
    }
    function applyMentFilter(){
      var inp = elMentMenu.querySelector(".up-ment-search");
      if (inp) mentQuery = inp.value;
      var q = (mentQuery || "").trim().toLowerCase();
      var items = elMentMenu.querySelectorAll(".up-filter-item[data-brand]");
      var shown = 0;
      Array.prototype.forEach.call(items, function(it){
        var match = !q || (it.getAttribute("data-name") || "").indexOf(q) > -1;
        it.style.display = match ? "" : "none";
        if (match) shown++;
      });
      var nr = elMentMenu.querySelector(".up-ment-noresult");
      if (nr) nr.style.display = (items.length && shown === 0) ? "" : "none";
    }
    function syncMentHead(){
      var head = elMentMenu.querySelector(".up-filter-head");
      if (!head) return;
      var list = state.brands || [];
      var selCount = Object.keys(state.mentionSel).filter(function(k){ return state.mentionSel[k]; }).length;
      head.innerHTML = '<span class="up-filter-title">Mentioned brands</span>' +
        (selCount
           ? '<button class="up-pop-action" type="button" data-mentreset>Reset</button>'
           : (list.length ? '<button class="up-pop-action" type="button" data-mentall>Select all</button>' : ""));
    }
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
      state.mentionApplied = next;
      state.page = 1;
      persist(); syncMentLabel(); renderPager();
      fire("data-mentioned-fn", "udtMentioned", { brands: Object.keys(next).join(",") });
    }

    /* ---------------- brand mentioned (single toggle) ---------------- */
    function syncBrand(){
      if (!elBrand) return;
      var name = root.getAttribute("data-brand-name") || "";
      var logo = root.getAttribute("data-brand-logo") || "";
      var valid = name && name !== "BRAND_NAME";
      elBrand.classList.toggle("is-visible", !!valid);
      if (!valid) return;
      elBrandLbl.textContent = name + " mentioned";
      if (logo && logo !== "BRAND_LOGO"){ elBrandLogo.src = logo; elBrandLogo.style.display = "block"; }
      else { elBrandLogo.style.display = "none"; }
      elBrand.classList.toggle("is-yes", state.brandMentioned === "yes");
      elBrand.classList.toggle("is-no", state.brandMentioned === "no");
    }
    function cycleBrand(){
      // off → yes → no → off
      state.brandMentioned = state.brandMentioned === "" ? "yes" : (state.brandMentioned === "yes" ? "no" : "");
      state.page = 1;
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
    var EXPLAIN_TEXT = {
      share: { h: "Share",
        t: "How much of all citations in the period went to this domain, plus the change against the previous period." },
      used:  { h: "Used",
        t: "How many of this domain's pages were cited across all responses in the period." },
      type:  { h: "Citation Type",
        t: "What kind of source this domain is: editorial, UGC, institutional, and so on." }
    };
    function showExplain(el){
      var kind = el.getAttribute("data-explain");
      var info = EXPLAIN_TEXT[kind];
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
    var showTipWide = _tips.showTipWide, hideTip = _tips.hideTip;
    /* Full domain title on a short hover-delay, but only when actually clipped. */
    var titleTipTimer = null, titleTipWrap = null;
    root.addEventListener("mouseover", function(e){
      var wrap = e.target.closest(".udt-dom-wrap");
      if (!wrap || !root.contains(wrap)) return;
      if (wrap === titleTipWrap) return;
      titleTipWrap = wrap;
      clearTimeout(titleTipTimer);
      titleTipTimer = setTimeout(function(){
        var dt = wrap.querySelector(".udt-dom-title");
        if (dt && dt.scrollWidth > dt.clientWidth + 1) showTipWide(dt, dt.textContent);
      }, 400);
    });
    root.addEventListener("mouseout", function(e){
      var wrap = e.target.closest(".udt-dom-wrap");
      if (!wrap || wrap !== titleTipWrap) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(".udt-dom-wrap") === wrap) return;
      titleTipWrap = null; clearTimeout(titleTipTimer); hideTip();
    });

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
      var inMenu = e.target.closest(".up-sort-menu, .up-filter-menu, .up-cols-menu, .up-ment-menu");
      var onOpener = e.target.closest(".up-sort-btn, .up-filter-btn, .up-cols-btn, .up-ment-btn");
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
    var syncFromAttrs = function(){
      var wantDark = isYes(root.getAttribute("data-isdark"));
      var changed = false;
      if (wantDark !== isDark){
        isDark = wantDark;
        if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        changed = true;
      }
      var procAttr = String(root.getAttribute("data-processing") || "") + "|" +
                     String(root.getAttribute("data-processing2") || "");
      if (procAttr !== lastProcAttr){
        lastProcAttr = procAttr;
        explicitOverride = false;
      }
      if (!explicitOverride){
        var wantProc = readProcessing();
        if (wantProc !== state.loading){ state.loading = wantProc; changed = true; }
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
    function headGap(){
      var h = elHeading && elHeading.getBoundingClientRect();
      var tl = elHeadTools && elHeadTools.getBoundingClientRect();
      if (!h || !tl || !tl.width) return Infinity;
      var gap = tl.left - h.right;
      if (elSearch && !elSearch.classList.contains("is-open")) gap -= SEARCH_OPEN_WIDTH;
      return gap;
    }
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
      if (root.className !== before) applyCols();
      else if (state.widths && state.widths.domain) applyCols();
    }
    if (window.ResizeObserver){
      new ResizeObserver(function(){
        if (root.__udtRaf) return;
        root.__udtRaf = requestAnimationFrame(function(){ root.__udtRaf = null; applyResponsive(); });
      }).observe(root);
    }
    window.addEventListener("resize", applyResponsive);

    /* sticky header machinery (core) */
    var _sticky = UpstreemCore.makeSticky(root, elHead);
    function syncTheadOffset(){ _sticky.syncTheadOffset(); }
    function applySticky(){ _sticky.applySticky(); }
    window.addEventListener("resize", applySticky);
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
          isDark = isYes(params.isDark);
          if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        }
        if (params.requestId != null && search.latestReqId() != null && String(params.requestId) !== String(search.latestReqId())) return;
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
        if (explicitOverride){
          if (params.rows != null){ state.loading = false; explicitOverride = false; }
        }
        else if (hasProcessingAttr()) state.loading = readProcessing();
        else if (params.rows != null) state.loading = false;
        persist(); render();
      },
      setLoading: function(on){
        explicitOverride = true;
        LOADING_EXPLICIT[instanceId] = true;
        state.loading = isYes(on);
        persist(); render();
      },
      reset: function(){
        state.query = ""; elSearchIn.value = ""; elSearch.classList.remove("is-open");
        state.filterSel = {}; state.appliedSel = {};
        state.brandMentioned = "";
        state.sortField = DEFAULT_SORT.field; state.sortDir = DEFAULT_SORT.dir;
        state.pageSize = DEFAULT_PAGE_SIZE; state.page = 1;
        state.mentionSel = {}; state.mentionApplied = {};
        state.widths = {}; writeWidths();
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
  /* mount from core: root registry, iframe forwarder, wheel forwarding, init cascade and the
     replay of whatever Bubble queued against the stubs. doRender/doLoading/doReset stay local. */
  var mount = UC.makeMount({
    rootClass: "udt-root", notPortal: true,
    ctrlProp: "__udtController",
    resolveLocal: "__udtResolveLocal",
    queue: "__udtBootQueue",
    initRoot: initRoot,
    api: { renderDomainsTable: doRender, setDomainsTableLoading: doLoading, resetDomainsTable: doReset },
    forwardShape: { renderDomainsTable: "params", resetDomainsTable: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end udtRun

  udtBoot(50); // retry for ~5s before giving up on core.js
})();
