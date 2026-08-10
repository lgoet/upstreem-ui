/* upstreem urls-table.js — component logic. Requires core.js (window.UpstreemCore) loaded first. */
(function(){
  "use strict";

  /* Bubble's own RunJS "kick" polling can call window.setUrlsTableLoading/renderUrlsTable before
     core.js has finished loading and uutRun() has assigned the real functions — without this,
     that call throws "is not a function" and is lost. Stub them as immediate, synchronous
     queueing functions right away; uutRun() drains the queue (in original order) once the real
     implementations are assigned. window.__uutBootStubbed guards against re-stubbing over a
     real implementation if this script tag executes more than once on the page. */
  /* Stubs must exist before core.js is guaranteed to be loaded — Bubble polls for these by
     name and would otherwise miss the earliest calls. Everything after the wait uses UC.makeMount. */
  var __uutBootQueue = window.__uutBootQueue = window.__uutBootQueue || [];
  if (!window.__uutBootStubbed){
    window.__uutBootStubbed = true;
    ["renderUrlsTable", "setUrlsTableLoading", "resetUrlsTable", "setUrlsTableBrands"].forEach(function(n){
      window[n] = function(){ __uutBootQueue.push([n, arguments]); };
    });
  }

  /* Bubble injects this component's <script> tags via jQuery .html(), which does not guarantee
     external scripts execute in DOM order — urls-table.js can start running before core.js has
     finished loading. A one-shot check-and-bail here meant a slow core.js load permanently
     killed the whole component (no retry ever happened). Retry briefly instead: covers the
     normal race (core.js finishes a beat later) without masking a genuinely missing core.js. */
  function uutBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uutBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uutRun();
  }

  function uutRun(){
  var UC = window.UpstreemCore;
  var CITE_COLOR = UC.CITE_COLOR, CITE_ALIAS = UC.CITE_ALIAS, ALL_CITATION_TYPES = UC.ALL_CITATION_TYPES, URL_TYPE = UC.URL_TYPE, ALL_URL_TYPES = UC.ALL_URL_TYPES, OTHER_LIGHT = UC.OTHER_LIGHT, OTHER_DARK = UC.OTHER_DARK, CHIP_BG_DARK = UC.CHIP_BG_DARK, MONTHS = UC.MONTHS, DEBOUNCE = UC.DEBOUNCE, MIN = UC.MIN, SORT_DEBOUNCE = UC.SORT_DEBOUNCE, PAGE_SIZES = UC.PAGE_SIZES, DEFAULT_PAGE_SIZE = UC.DEFAULT_PAGE_SIZE, fmtTotal = UC.fmtTotal, isYes = UC.isYes, highlight = UC.highlight, redditTitleHtml = UC.redditTitleHtml, esc = UC.esc, citeName = UC.citeName, tint = UC.tint, toNum = UC.toNum, fmt1 = UC.fmt1, fmtInt = UC.fmtInt, fmtDate = UC.fmtDate, foldDiacritics = UC.foldDiacritics, germanExpand = UC.germanExpand, resolveBubbleFn = UC.resolveBubbleFn, TREND_UP = UC.TREND_UP, TREND_DOWN = UC.TREND_DOWN, CHECK_SVG = UC.CHECK_SVG, COPY_SVG = UC.COPY_SVG, GOTO_SVG = UC.GOTO_SVG, DONE_SVG = UC.DONE_SVG, EXT_SVG = UC.EXT_SVG, STORE = UC.STORE, LOADING_EXPLICIT = UC.LOADING_EXPLICIT;

  /* Hideable columns. Domain and Actions are deliberately absent — the table makes no sense
     without the domain, and the row actions are the point of the Actions cell. */
  var COLUMNS = [
      /* `prio` = survival order when too narrow to fit everything (higher survives longer, see
         UC.makeColumns' autoFit). Share is the metric the table exists for; Last Seen is the
         first thing you can do without. */
      { key: "share",    label: "Share",            w: "minmax(13%, 150px)",   min: 130, prio: 50 },
      { key: "type",     label: "Type",             w: "minmax(11%, 1fr)",     min: 118, dropAt: "vnarrow", prio: 30 },
      { key: "ment",     label: "Mentioned?",       w: "minmax(112px, 0.6fr)", min: 112, dropAt: "narrow",  prio: 20 },
      { key: "brands",   label: "Brands mentioned", w: "minmax(13%, 1fr)",     min: 178, dropAt: "vnarrow", prio: 40 },
      { key: "lastseen", label: "Last Seen",        w: "minmax(104px, 0.7fr)", min: 104, dropAt: "vnarrow", prio: 10 }
  ];

  /* ORDER maps each (field, direction) pair onto the single value the RPC expects in p_order.
     The table keeps thinking in field + direction because the header cycle needs both; only the
     outgoing event is collapsed into one token. */
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
  /* Which sort keys a header column cycles through, in order. Clicking past the end
     resets to the default (share desc) — same convention as elsewhere in the app. */
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
    var elFilterBtn = elFilter && elFilter.querySelector(".up-filter-btn");
    if (elFilterBtn) elFilterBtn.setAttribute("data-tip", "Filter Citation and URL Types");
    var elSort      = root.querySelector(".up-sort");
    var elSortMenu  = root.querySelector(".up-sort-menu");
    var elBrand     = root.querySelector(".uut-brand-toggle");
    /* Overwrites whatever data-tip a hand-pasted root copy already carries -- static Bubble
       markup, not something this file builds, so a wording fix only reaches existing embeds if
       the CDN'd JS rewrites the attribute at init. */
    if (elBrand) elBrand.setAttribute("data-tip", "Filter for your brand mentions");
    var elBrandLogo = root.querySelector(".uut-brand-logo");
    var elBrandLbl  = root.querySelector(".uut-brand-label");
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
      loading: false,                       // intern (Suche/Pagination), startet immer frei
      softReload: false,                    // true only while a sort is in flight — see dim.begin/end
      extLoading: hasProcessingAttr() ? readProcessing()
             : (LOADING_EXPLICIT[instanceId] ? !!saved.loading : false),
      query: saved.query || "",
      sortField: saved.sortField || DEFAULT_SORT.field,
      sortDir: saved.sortDir || DEFAULT_SORT.dir,
      filterSel: saved.filterSel || {},        // live checkbox state (citation types)
      appliedSel: saved.appliedSel || {},      // what was last submitted
      filterUrlSel: saved.filterUrlSel || {},  // live checkbox state (url types)
      appliedUrlSel: saved.appliedUrlSel || {},
      filterDim: saved.filterDim || "citation_type",
      brandMentioned: saved.brandMentioned || "",
      pageSize: saved.pageSize || DEFAULT_PAGE_SIZE,
      page: saved.page || 1,                   // 1-based; offset is derived, never stored
      cols: {},                                // filled from colsKit.readCols() below
      widths: {},                              // filled from colsKit.readWidths() below
      brands: saved.brands || [],              // full list; persisted so a Bubble re-render keeps them
      mentionSel: saved.mentionSel || {},      // live checkbox state
      mentionApplied: saved.mentionApplied || {},
      dense: readDense()                       // compact row mode (single-line first column) — localStorage
    };
    root.classList.toggle("is-dense", state.dense);   // apply the saved row mode on load
    /* Column visibility is a per-user display preference, not app data — localStorage, keyed by
       instance so two placements can differ. Wrapped because Bubble can run inside contexts where
       storage access throws (private mode, blocked third-party cookies). */
    /* Row-height mode is a display preference too -> localStorage, survives reloads. */
    function denseKey(){ return "uut_dense__" + instanceId; }
    function readDense(){ try { return window.localStorage.getItem(denseKey()) === "1"; } catch(e){ return false; } }
    function writeDense(){ try { window.localStorage.setItem(denseKey(), state.dense ? "1" : "0"); } catch(e){} }
    var sortTimer = null;
    /* Search comes from core (UC.makeSearch) — this file and domains-table carried copies that
       were identical apart from comments. fitToolbar stays local because the toolbar tiers are
       this component's own. */
    var MOBILE_SEARCH_MAX = 640;   // below this component width an open search takes over the toolbar
    var search = UC.makeSearch({
      root: root, box: elSearch, input: elSearchIn, state: state,
      mobileMax: MOBILE_SEARCH_MAX, prefix: "uut",
      onRender: function(){ renderTable(); renderPager(); },
      onFire: function(payload){ state.softReload = false; dim.end(); fire("data-search-fn", "uutSearch", payload); },
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
       loading state: whoever supplies a real value wins.

       This used to be a one-way latch — a single setUrlsTableLoading() call set a flag on
       window and the attribute was ignored from then on, for the rest of the page session and
       across every element rebuild. Wiring up the Run-JS step once, even just to try it, silently
       killed the attribute path for good. Now: attribute filled -> attribute decides; attribute
       empty -> the explicit call decides. Both paths stay usable, neither can lock the other out. */
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
        filterUrlSel: state.filterUrlSel, appliedUrlSel: state.appliedUrlSel, filterDim: state.filterDim,
        brandMentioned: state.brandMentioned,
        pageSize: state.pageSize, page: state.page,
        mentionSel: state.mentionSel, mentionApplied: state.mentionApplied,
        brands: state.brands
      };
    }
    /* shared event dispatch (core) */
    var fire = UpstreemCore.makeFire(root, { label: "urls-table", eventPrefix: "uut-" });
    /* Soft-reload dim — sort only. Same result set, only re-ordered, so the rows stay on screen
       and just dim instead of blanking to a skeleton. See UC.makeSoftReload / prompts-table.js,
       which had this first. */
    var dim = UC.makeSoftReload(root);

    /* ---------------- table ---------------- */
    function skeletonRows(n){
      return UC.skeletonRows({ count: n, cols: [
        { w:110, jitter:30, logo:true, cls:"uut-td-domain" },
        { w:70,  cls:"uut-td-share" },
        { w:82,  cls:"uut-td-type" },
        { w:48,  cls:"uut-td-ment" },
        { logo:true, logoStyle:"border-radius:999px", cls:"uut-td-brands" },
        { w:88,  cls:"uut-td-lastseen" },
        { w:56,  cls:"uut-td-actions" }
      ]});
    }
    function trendChip(delta, suffix){
      return UC.trendChip(delta, { decimals: true, suffix: suffix });
    }
    /* URL types have their own dark palette; citation types deliberately do not.
       A missing/empty type is "Uncategorized" — same convention as core.js's URL_LABEL.other and
       topcitations-dashboard's URL_TYPE_CHIP.other — never a blank cell. A non-empty value that
       just doesn't match a known key still renders as its own raw text: a real, if unmapped, type
       is not the same thing as an absent one. */
    function urlTypeInfo(raw){
      var key = String(raw == null ? "" : raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
      var t = URL_TYPE[key];
      if (t) return { label: t.label, color: isDark ? t.cDark : t.c, base: t.c };
      return { label: key ? String(raw) : "Uncategorized", color: isDark ? OTHER_DARK : OTHER_LIGHT, base: OTHER_LIGHT };
    }
    function tagHtml(raw){
      var ti = urlTypeInfo(raw);
      var bg = isDark ? CHIP_BG_DARK : tint(ti.base, 0.12);
      /* URL types always carry a leading dot; citation types never do. That is what keeps the two
         systems apart at a glance when they appear next to each other. */
      return '<span class="uut-tag" style="color:' + ti.color + ';background:' + bg + '">' +
               '<span class="uut-tag-dot" style="background:' + ti.color + '"></span>' +
               '<span class="uut-tag-lbl">' + esc(ti.label) + '</span>' +
             '</span>';
    }
    /* The yes/no cell moved to core as UC.mentCell — this file and responses-table.js each had
       their own byte-identical copy, so a design change had to be made twice.
       The fallback covers a page whose LAST-loaded core.js predates mentCell (see onResizeCompat
       for why that happens): without it the first render throws and the component is dead. */
    var mentCell = UC.mentCell || function(v){
      var yes = UC.isYes(v);
      return '<span class="up-ment-cell ' + (yes ? "is-yes" : "is-no") + '">' + (yes ? "Yes" : "No") + '</span>';
    };
    function rowHtml(r){
      var url = String(r.url == null ? "" : r.url);
      var title = String(r.title == null ? "" : r.title) || url;
      var dom = String(r.domain == null ? "" : r.domain);
      var fav = String(r.favicon == null ? "" : r.favicon);
      if (fav.indexOf("//") === 0) fav = "https:" + fav;
      var initial = dom.replace(/^www\./, "").charAt(0) || "?";
      // share_pct isn't in the URL payload; global_share_pct is the equivalent figure
      var share = (r.global_share_pct != null) ? r.global_share_pct : r.share_pct;
      return '<div class="up-row" data-url="' + esc(url) + '" tabindex="0" role="button">' +
        '<div class="up-td uut-td-domain">' +
          '<span class="uut-logo-box' + (fav ? " has-img" : "") + '">' +
            '<span class="uut-logo-ltr">' + esc(initial) + '</span>' +
            (fav ? '<img src="' + esc(fav) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                   ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
          '</span>' +
          '<span class="uut-url-wrap">' +
            '<span class="uut-url-title">' + (redditTitleHtml(url, title, state.query) || highlight(title, state.query)) + '</span>' +
            '<span class="uut-url-sub">' + highlight(url, state.query) + '</span>' +
          '</span>' +
          '<span class="uut-row-goto">' + GOTO_SVG + '</span>' +
        '</div>' +
        '<div class="up-td uut-td-share"><span class="uut-num">' + fmt1(share) + '%</span>' + trendChip(r.share_delta_pct, "%") + '</div>' +
        '<div class="up-td uut-td-type">' + tagHtml(r.url_type) + '</div>' +
        '<div class="up-td uut-td-ment">' + mentCell(r.is_mentioned) + '</div>' +
        '<div class="up-td uut-td-brands">' + UC.brandStack(r.mentions, r.mentions_totalcount) + '</div>' +
        '<div class="up-td uut-td-lastseen"><span class="uut-date">' + esc(fmtDate(r.last_seen)) + '</span></div>' +
        '<div class="up-td uut-td-actions">' +
          '<span class="uut-actions">' +
            '<button class="uut-actbtn up-act-copy" type="button" data-tip="Copy URL" aria-label="Copy URL">' + COPY_SVG + DONE_SVG + '</button>' +
            '<button class="uut-actbtn up-act-open" type="button" data-tip="Open in new tab" aria-label="Open in new tab">' + EXT_SVG + '</button>' +
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
        '<div class="up-empty-h">' + (filtered ? "No matching URLs" : "No URLs yet") + '</div>' +
        '<div class="up-empty-t">' + (filtered
          ? "Nothing matches the current search and filters."
          : "URLs appear here once your prompts have been run.") + '</div>' +
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
          /* the brands multiselect counts as a filter too — without this clause an empty result
             caused purely by it read as "No URLs yet" and offered no way to clear it */
          Object.keys(state.mentionApplied).some(function(k){ return state.mentionApplied[k]; });
        if (filtered){ clearEmptyGrace(); renderEmptyState(true); return; }
        /* An unfiltered empty result can be an interim "clearing" step before the real data lands
           a moment later (e.g. a workflow that clears the table before kicking off a new query) —
           showing "No URLs yet" immediately for that interim state flashes an empty placeholder
           that's gone a beat later. Give a short grace window for a follow-up call before
           committing to the empty view; any subsequent render() (loading again, or real rows)
           cancels it via clearEmptyGrace() above. */
        if (!emptyGraceTimer){
          elTbody.innerHTML = skeletonRows(state.pageSize);
          emptyGraceTimer = setTimeout(function(){
            emptyGraceTimer = null;
            if (isBusy() || !state.hasData || state.rows.length) return;   // state moved on already
            renderEmptyState(false);
          }, 600);   // matches the app-wide empty-grace window (see core.js's makeEmptyGrace)
        }
        return;
      }
      clearEmptyGrace();
      elTbody.innerHTML = state.rows.map(rowHtml).join("");
    }
    function renderCount(){
      elHeading.classList.add("has-count");   // dot + slot always shown; a skeleton stands in for a missing number
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
    /* The position inside a column's cycle is DERIVED from the sort that is actually active,
       never stored. A stored position drifts apart from the real state: once the cycle wrapped
       back to the default (share:desc) the stored position was cleared, so the next click
       started at index 0 and produced share:desc a SECOND time instead of moving on to
       share:asc. Reading the current sort back out of the cycle makes that impossible —
       wherever we are is where the next click continues from, no matter how we got there
       (header click, sort dropdown, wrap-around, or a reset). */
    /* Sorting is optimistic: the arrow, the header state and the dropdown update on the
       very first click with no delay, so the control never feels blocked. Only the OUTGOING
       event is debounced, exactly like search. Clicking through Share -> Share Trend -> Last
       Seen therefore costs one request instead of three, and a user hammering the header
       costs one request instead of dozens. Disabling the sorter while loading was the other
       option and is worse: a control that stops responding reads as broken, and people click
       it harder. */
    function applySort(field, dir){
      state.sortField = field; state.sortDir = dir;
      state.page = 1;   // a new ordering makes the old page index meaningless
      /* Marked and dimmed on the CLICK, not inside the debounce below: the outgoing event is
         delayed, but the user expects a response the moment they click — waiting for the debounce
         (or the eventual answer) means the table sits there looking like nothing happened. */
      state.softReload = true;
      dim.begin(state.hasData && !!state.rows.length);
      persist(); syncHeadSorters(); populateSort();   // UI first, immediately
      clearTimeout(sortTimer);
      sortTimer = setTimeout(function(){
        // A sort is a deliberate action, not part of a search race — clear the search's requestId
        // so its response can't be dropped by the requestId guard in update().
        search.setLatest(null);
        state.loading = true;
        fire("data-sort-fn", "uutSort", {
          order: orderValue(state.sortField, state.sortDir),   // -> p_order
          sort_field: state.sortField, sort_dir: state.sortDir // split parts, in case a workflow prefers them
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

    /* ---------------- citation type filter ---------------- */
    function populateFilter(){
      if (!elFilterMenu) return;   // a stale/incomplete root copy may be missing this markup
      /* Two dimensions in one dropdown, exactly like the TopCitations URL mode: a URL has both a
         citation type (what kind of source) and a url type (what kind of page). Each keeps its own
         selection, so switching the tab back and forth doesn't lose anything. */
      var dim = state.filterDim || "citation_type";
      var isUrlDim = dim === "url_type";
      var sel = isUrlDim ? state.filterUrlSel : state.filterSel;
      var keys = isUrlDim ? ALL_URL_TYPES : ALL_CITATION_TYPES;
      var dimSwitch = '<div class="up-filter-dim">' +
        '<button class="up-filter-dim-btn' + (!isUrlDim ? " is-active" : "") + '" type="button" data-dim="citation_type">Citation Type</button>' +
        '<button class="up-filter-dim-btn' + (isUrlDim ? " is-active" : "") + '" type="button" data-dim="url_type">URL Type</button>' +
      '</div>';
      var anyFilterSel = Object.keys(state.filterSel).filter(function(k){ return state.filterSel[k]; }).length
                       + Object.keys(state.filterUrlSel).filter(function(k){ return state.filterUrlSel[k]; }).length;
      var html = dimSwitch + '<div class="up-filter-head">' +
          '<span class="up-filter-title">' + (isUrlDim ? "URL Types" : "Citation Types") + '</span>' +
          (anyFilterSel
            ? '<button class="up-filter-reset" type="button">Reset</button>' : "") +
        '</div><div class="up-filter-list">';
      html += keys.map(function(key){
        var label, color, base;
        if (isUrlDim){ var ti = urlTypeInfo(key); label = ti.label; color = ti.color; base = ti.base; }
        else { label = citeName(key); color = CITE_COLOR[label] || OTHER_LIGHT; base = color; }
        var bg = isDark ? CHIP_BG_DARK : tint(base, 0.12);
        var dot = isUrlDim ? '<span class="uut-tag-dot" style="background:' + color + '"></span>' : "";
        return '<div class="up-filter-item' + (sel[key] ? " is-checked" : "") + '" data-type="' + esc(key) + '">' +
                 '<span class="up-filter-check">' + CHECK_SVG + '</span>' +
                 '<span class="up-filter-tag" style="color:' + color + ';background:' + bg + '">' + dot +
                   '<span class="up-filter-tag-lbl">' + esc(label) + '</span></span>' +
               '</div>';
      }).join("");
      html += '</div><button class="up-filter-submit" type="button" data-typeapply>Apply</button>';
      elFilterMenu.innerHTML = html;
    }
    function syncFilterBadge(){
      /* The button names the selection instead of showing a count badge — the point of a labelled
         control is that you can read the active filter without opening the menu. */
      var ct = Object.keys(state.appliedSel).filter(function(k){ return state.appliedSel[k]; });
      var ut = Object.keys(state.appliedUrlSel).filter(function(k){ return state.appliedUrlSel[k]; });
      var total = ct.length + ut.length;
      elFilter.classList.toggle("is-active", !!total);
      var lbl = !total ? "All Types"
              : total === 1 ? (ct.length ? citeName(ct[0]) : urlTypeInfo(ut[0]).label)
              : total + " Types";
      elFilterLbl.textContent = lbl;
      // the label just changed width, which changes how much gap is left in the head
      fitToolbar();
    }
    function submitFilter(){
      var nextCt = {}, nextUt = {};
      Object.keys(state.filterSel).forEach(function(k){ if (state.filterSel[k]) nextCt[k] = true; });
      Object.keys(state.filterUrlSel).forEach(function(k){ if (state.filterUrlSel[k]) nextUt[k] = true; });
      // No change in EITHER dimension since the menu opened -> close only, don't re-run the RPC.
      var beforeCt = Object.keys(state.appliedSel).filter(function(k){ return state.appliedSel[k]; }).sort().join(",");
      var beforeUt = Object.keys(state.appliedUrlSel).filter(function(k){ return state.appliedUrlSel[k]; }).sort().join(",");
      var afterCt  = Object.keys(nextCt).sort().join(",");
      var afterUt  = Object.keys(nextUt).sort().join(",");
      if (afterCt === beforeCt && afterUt === beforeUt){ persist(); return; }
      state.appliedSel = nextCt;
      state.appliedUrlSel = nextUt;
      state.page = 1;   // filtering changes the result set -> back to page 1
      state.softReload = false; dim.end();
      persist(); syncFilterBadge(); renderPager();
      // both dimensions go out together; the workflow decides how to combine them
      fire("data-filter-fn", "uutFilter", {
        citation_types: Object.keys(nextCt).join(","),
        url_types: Object.keys(nextUt).join(",")
      });
    }

    /* ---------------- column resizing ----------------
       Widths live as explicit px once the user has dragged; until then the CSS template rules.
       Every column carries a `min` that is large enough for its heading plus padding, so a column
       can never be squeezed to the point where its header or cell content wraps. */
    var URL_MIN = 220;          // the URL cell holds two lines of text; below this it stops being readable
    var ACTIONS_MIN = 120;

    /* Columns, pagination and header sorting all come from core now — urls-table and
       domains-table used to carry byte-identical copies of that machinery. Only the data
       differs, and that data is right here in the config. */
    var colsKit = UC.makeColumns({
      root: root, state: state, columns: COLUMNS,
      storePrefix: "uut", instanceId: instanceId,
      firstKey: "domain", firstMin: URL_MIN, actionsMin: 120,
      dense: true, badgeSel: ".uut-cols-badge", cellPrefixes: ["up","uut"],
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
      trendField: "share_trend",
      onSort: function(f, d){ applySort(f, d); }
    });
    var syncHeadSorters = sortKit.syncHeadSorters, headSortClick = sortKit.headSortClick;
    var legacyCopy = UC.legacyCopy;
    /* The visible order, including the two fixed columns that bracket the configurable ones. */
    /* Only the URL column is draggable. Everything else keeps its fr-based track, so the
       remaining space redistributes automatically — no pairwise trading, and no column can be
       starved by dragging a distant divider. The URL width is clamped so that every other visible
       column still fits its own minimum. */
    root.addEventListener("pointerdown", function(e){
      var grip = e.target.closest(".up-grip");
      if (!grip) return;
      e.stopPropagation();                 // a grip drag must not also sort the column
      startResize(e);
    });

    /* ---------------- column visibility ---------------- */
    /* Columns the user switched off AND columns the current width can't fit. Both end up here so
       the grid template is built in exactly one place — otherwise the inline style from one would
       silently beat the class rule from the other. */
    function setDense(on){
      state.dense = !!on;
      root.classList.toggle("is-dense", state.dense);
      writeDense(); populateCols();
    }

    /* ---------------- pagination ----------------
       Classic offset pagination: page size × page index → offset. The component never slices
       rows itself — it asks Bubble for the window and renders whatever comes back. */
    /* Window of page numbers around the current one: first, last, current ±1, ellipses between.
       Standard pattern — 1 … 4 [5] 6 … 12 — nothing invented here. */
    function firePage(){
      /* A page/size change is a deliberate action, not part of a search race. Clear the search's
         requestId so its response can't be dropped by the requestId guard in update(). */
      search.setLatest(null);
      state.softReload = false; dim.end();   // paging never dims — only sort does
      fire("data-page-fn", "uutPage", { limit: state.pageSize, offset: offset(), page: state.page });
    }

    /* ---------------- mentioned brands (multi-select) ----------------
       The quick "Brand X mentioned" toggle next to it stays: that one is the single-click path for
       the user's own brand. This is the broader filter for any combination of tracked brands. */
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
      if (!elMentMenu) return;   // a stale/incomplete root copy may be missing this markup
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
    /* Refresh only the dropdown's head (Reset / Select all) after an in-place (de)select. */
    function syncMentHead(){
      if (!elMentMenu) return;   // a stale/incomplete root copy may be missing this markup
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
      if (!elMent || !elMentLbl) return;   // a stale/incomplete root copy may be missing this markup
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
      if (after === before){ persist(); return; }   // unchanged -> close only, no RPC re-run
      state.mentionApplied = next;
      state.page = 1;
      state.softReload = false; dim.end();
      persist(); syncMentLabel(); renderPager();
      /* the multi-brand list goes out on the "mentioned" channel, the yes/no toggle on the
         "brand" channel — this file had the two swapped, which is why the workflow wired per the
         documented contract (and per domains-table) never saw the value it expected. */
      fire("data-mentioned-fn", "uutMentioned", { brands: Object.keys(next).join(",") });
    }

    /* ---------------- brand mentioned ---------------- */
    function syncHeadBrand(){
      var logo = root.getAttribute("data-brand-logo") || "";
      var name = root.getAttribute("data-brand-name") || "";
      var img = root.querySelector(".up-th-brandlogo");
      var lbl = root.querySelector(".up-th-mentlbl");
      if (!img || !lbl) return;
      if (logo && logo !== "BRAND_LOGO"){ img.src = logo; img.style.display = "block"; }
      else { img.style.display = "none"; }
      // the header reads "<logo> mentioned?"; without a logo the brand name has to carry it
      lbl.textContent = (!logo || logo === "BRAND_LOGO") && name && name !== "BRAND_NAME"
        ? name + " mentioned?" : "mentioned?";
    }
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
      var showsRows = state.hasData && !!(state.rows || []).length;
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
      // off → yes → no → off
      state.brandMentioned = state.brandMentioned === "" ? "yes" : (state.brandMentioned === "yes" ? "no" : "");
      state.page = 1;
      state.softReload = false; dim.end();
      persist(); syncBrand(); renderPager();
      fire("data-brand-fn", "uutBrand", { brand_mentioned: state.brandMentioned });
    }

    /* ---------------- search (same debounce/min-length/reqId as quick_actions) ---------------- */

    /* ---------------- export ---------------- */
    function openExport(){
      var id = String(root.getAttribute("data-export-instance") || "").trim();
      var fn = window.upstreemExportOpen
        || (window.parent && window.parent.upstreemExportOpen)
        || (window.top && window.top.upstreemExportOpen);
      if (typeof fn !== "function"){
        console.warn("[urls-table] window.upstreemExportOpen not found — is the export popup " +
          "component placed on this page?");
        return;
      }
      if (!id || id === "EXPORT_INSTANCE_ID"){
        console.warn("[urls-table] data-export-instance is not set. Put the export popup's " +
          "instanceId there so this button knows which popup to open.");
        return;
      }
      try { fn(id); } catch(e){}
    }

    /* ---------------- column explainers ----------------
       Richer than the plain button tooltip: a light panel showing the metric as it actually looks
       in the table, then heading + one sentence on the dark ground below it. */
    var explain = document.createElement("div");
    explain.className = "up-explain";
    document.body.appendChild(explain);
    function explainVisual(kind){
      if (kind === "type"){
        return ["article","comparison","listicle"].map(function(k){
          var t = URL_TYPE[k];
          var col = isDark ? t.cDark : t.c;
          return '<span class="uut-explain-chip" style="color:' + col + ';background:' + tint(col, isDark ? 0.18 : 0.12) + '">' + esc(t.label) + '</span>';
        }).join("");
      }
      if (kind === "brands"){
        return '<span class="up-explain-row" style="gap:0">' +
          '<span class="up-explain-dot"></span><span class="up-explain-dot" style="margin-left:-4px"></span>' +
          '<span class="up-explain-dot" style="margin-left:-4px"></span>' +
          '<span class="up-explain-dot up-explain-more" style="margin-left:-4px">+2</span></span>';
      }
      if (kind === "share"){
        return '<span class="up-explain-row">18.4%' +
               '<span class="up-explain-up">' + TREND_UP + '</span>' +
               '<span class="up-explain-up">2.9%</span></span>' +
               '<span class="up-explain-row">6.1%' +
               '<span class="up-explain-down">' + TREND_DOWN + '</span>' +
               '<span class="up-explain-down">1.4%</span></span>';
      }
      return '<span class="up-explain-row">6.9%</span>';
    }
    /* Share/Brand Mentions text comes from UC.EXPLAIN_TEXT (core) — the one shared wording every
       table with these columns uses now, instead of each writing its own (this table's "brands"
       used to say "appear on this page" where every other table said "are mentioned"). URL Type
       has no counterpart elsewhere, stays local. */
    var EXPLAIN_LOCAL = {
      type: { h: "URL Type", t: "What kind of page this is: an article, a comparison, a product page, and so on." }
    };
    function explainInfo(kind){
      if (EXPLAIN_LOCAL[kind]) return EXPLAIN_LOCAL[kind];
      if (UC.explainCopy){
        if (kind === "share") return UC.explainCopy("share", { subject: "URL" });
        if (kind === "brands") return UC.explainCopy("brands", { scope: " on this page" });
      }
      var FALLBACK = {
        share: { h: "Share", t: "How much of all citations in the period went to this URL, plus the change against the previous period." },
        brands: { h: "Brand Mentions", t: "Which of your tracked brands are mentioned on this page. Hover a logo to see its name." }
      };
      return FALLBACK[kind] || null;
    }
    function showExplain(el){
      var kind = el.getAttribute("data-explain");
      var info = explainInfo(kind);
      if (!info) return;
      explain.setAttribute("data-theme", isDark ? "dark" : "light");
      explain.innerHTML =
        '<div class="up-explain-vis">' + explainVisual(kind) + '</div>' +
        '<div class="up-explain-h">' + esc(info.h) + '</div>' +
        '<div class="up-explain-t">' + esc(info.t) + '</div>';
      explain.classList.add("is-on");
      var r = el.getBoundingClientRect();
      var er = explain.getBoundingClientRect();
      var iconCenter = r.left + r.width / 2;
      var left = Math.max(8, Math.min(window.innerWidth - er.width - 8, iconCenter - er.width/2));
      // prefer below the header; flip above only when there genuinely isn't room
      var flipped = false;
      var top = r.bottom + 10;
      if (top + er.height > window.innerHeight - 8){ top = Math.max(8, r.top - er.height - 10); flipped = true; }
      explain.classList.toggle("is-flipped", flipped);
      explain.style.left = left + "px";
      explain.style.top = top + "px";
      // the caret follows the icon even when the box was pushed sideways by a screen edge
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
    var showTip = _tips.showTip, showTipText = _tips.showTipText, showTipWide = _tips.showTipWide, hideTip = _tips.hideTip, unsuppressTip = _tips.unsuppress;
    /* Full URL title on a short hover-delay, but only when actually clipped — component-specific
       (uut-url-wrap) yet driven by the shared tooltip. */
    var titleTipTimer = null, titleTipWrap = null;
    root.addEventListener("mouseover", function(e){
      var wrap = e.target.closest(".uut-url-wrap");
      if (!wrap || !root.contains(wrap)) return;
      if (wrap === titleTipWrap) return;
      titleTipWrap = wrap;
      /* Same thing the core's delegated [data-tip] path does on mouseover: entering a new trigger
         lifts the suppression a previous click left behind. These wraps carry no data-tip, so
         nothing else would ever clear it. */
      if (unsuppressTip) unsuppressTip();
      clearTimeout(titleTipTimer);
      titleTipTimer = setTimeout(function(){
        var ut = wrap.querySelector(".uut-url-title");
        if (ut && ut.scrollWidth > ut.clientWidth + 1) showTipWide(ut, ut.textContent);
      }, 400);
    });
    root.addEventListener("mouseout", function(e){
      var wrap = e.target.closest(".uut-url-wrap");
      if (!wrap || wrap !== titleTipWrap) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(".uut-url-wrap") === wrap) return;
      titleTipWrap = null; clearTimeout(titleTipTimer); hideTip();
    });

    /* ---------------- events ---------------- */
    /* A committed selection lives in appliedSel / mentionApplied; the *Sel objects are a
       DRAFT the open menu edits. Draft is seeded from the applied set on open and thrown
       away on close — only Apply copies draft -> applied. cloneSel keeps just the truthy
       keys so a stale "false" never counts as a selection. */
    function cloneSel(o){ var n = {}; for (var k in o){ if (Object.prototype.hasOwnProperty.call(o, k) && o[k]) n[k] = true; } return n; }
    function revertDrafts(pop){
      if (pop === elFilter){ state.filterSel = cloneSel(state.appliedSel); state.filterUrlSel = cloneSel(state.appliedUrlSel); persist(); }
      else if (pop === elMent){ state.mentionSel = cloneSel(state.mentionApplied); persist(); }
    }

    /* Menus are taken out of flow (position:fixed) while open and positioned from the
       trigger's screen rect, so an ancestor's overflow:hidden — or a short component with
       only a few rows — can no longer clip them at the bottom edge. If there isn't room
       below the trigger, the menu flips above; whatever space remains becomes its max-height
       and the list scrolls inside. Same escape-the-container trick the tooltip already uses. */
    var MENU_SEL = ".up-sort-menu, .up-filter-menu, .up-cols-menu, .up-ment-menu";
    var BTN_SEL  = ".up-sort-btn, .up-filter-btn, .up-cols-btn, .up-ment-btn";
    /* Portal the dropdown menus up to document.body so they sit above every other page component.
       They live in a lightweight layer that carries the .up-root class (CSS variables) and mirrors
       the theme; display:contents means the layer paints nothing and the fixed menus stack at body
       level. Clicks are handled via a document listener + ownership guard (see below). */
    /* body-portal for the dropdown menus (core) */
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
    var POP_GROUP = "uut-" + instanceId;
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
      if (!ownsTarget(e.target)) return;   // portaled menus live in body now, so guard by ownership
      /* Marked while the click is still inside the component. The document listener below can't
         work this out on its own: populateFilter()/populateCols() rebuild the menu via innerHTML,
         so by the time the event reaches document the clicked node is detached and
         root.contains(e.target) is false — which closed the menu on every toggle. */
      /* A click on empty space inside the component closes any open dropdown. Clicks INSIDE an
         open menu obviously don't. */
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
        state.filterUrlSel = {}; state.appliedUrlSel = {}; state.filterDim = "citation_type";
        state.brandMentioned = ""; state.mentionSel = {}; state.mentionApplied = {};
        state.page = 1;
        state.softReload = false; dim.end();
        persist(); syncFilterBadge(); syncBrand(); syncMentLabel(); populateFilter(); populateMent();
        search.cancel(); runSearch();
        fire("data-filter-fn", "uutFilter", { citation_types: "" });
        fire("data-mentioned-fn", "uutMentioned", { brands: "" });
        fire("data-brand-fn", "uutBrand", { brand_mentioned: "" });
        return;
      }

      // --- toolbar ---
      if (e.target.closest(".up-search-clear")){
        if (root.classList.contains("is-searchtakeover")){ toggleSearch(); return; }   // mobile: X closes + resets the search
        elSearchIn.value = ""; state.query = "";
        elSearch.classList.remove("has-text");
        persist(); search.cancel(); runSearch();
        try { elSearchIn.focus(); } catch(e2){}
        return;
      }
      if (e.target.closest(".up-export")){ openExport(); return; }
      if (e.target.closest(".up-search-btn")){ closePops(); toggleSearch(); return; }
      if (e.target.closest(".uut-brand-toggle")){ closePops(); cycleBrand(); return; }

      /* The x sits inside the trigger, so it has to be caught before the open/close toggle —
         otherwise clearing the filter would also open the menu it just emptied. */
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
        // Toggle the one row in place instead of rebuilding the whole list — rebuilding made every
        // row flash for a frame on each (de)select.
        mentItem.classList.toggle("is-checked", !!state.mentionSel[bid]);
        syncMentHead();
        return;
      }
      if (e.target.closest("[data-mentall]")){
        // mirror of Reset: selecting all is the action, so it applies immediately
        state.mentionSel = {};
        (state.brands || []).forEach(function(b){
          var id = String(b.company_id != null ? b.company_id : (b.id != null ? b.id : (b.brand_id != null ? b.brand_id : b.name)));
          state.mentionSel[id] = true;
        });
        persist(); populateMent(); submitMent();
        return;
      }
      if (e.target.closest("[data-mentreset]")){
        // same as the type filter: resetting is the action, not a preparation for one
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
      var denseBtn = e.target.closest("[data-dense]");
      if (denseBtn){ setDense(denseBtn.getAttribute("data-dense") === "1"); return; }
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
        state.filterSel = {}; state.filterUrlSel = {}; persist();
        if (elFilter.classList.contains("is-open")) populateFilter();
        submitFilter(); setPopOpen(elFilter, false);
        return;
      }
      var filterBtn = e.target.closest(".up-filter-btn");
      if (filterBtn){
        var openF = !elFilter.classList.contains("is-open");
        closePops(elFilter);
        if (openF){ state.filterSel = cloneSel(state.appliedSel); state.filterUrlSel = cloneSel(state.appliedUrlSel); populateFilter(); }
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
      var dimBtn = e.target.closest("[data-dim]");
      if (dimBtn){ state.filterDim = dimBtn.getAttribute("data-dim"); persist(); populateFilter(); return; }
      var fi = e.target.closest(".up-filter-item");
      if (fi){
        var key = fi.getAttribute("data-type");
        var bucket = state.filterDim === "url_type" ? state.filterUrlSel : state.filterSel;
        bucket[key] = !bucket[key];
        persist(); repopKeepScroll(elFilterMenu, populateFilter);
        return;
      }
      if (e.target.closest(".up-filter-reset")){
        // reset BOTH dimensions and apply, no matter which type page is on screen — Reset is a
        // decision, not a staging step, so it closes the menu just like Apply does.
        state.filterSel = {}; state.filterUrlSel = {};
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
        var dC = rowC ? rowC.getAttribute("data-url") : "";
        if (dC){
          var done = function(){
            try { window.showMacToast && window.showMacToast("Copied to clipboard", { icon: "copy", timeout: 2000 }); } catch(e){}
            // confirm at the button too — the toast can be missed if the eye is on the row
            copyBtn.classList.add("is-done");
            clearTimeout(copyBtn.__uutT);
            copyBtn.__uutT = setTimeout(function(){ copyBtn.classList.remove("is-done"); }, 1400);
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
        var dO = rowO ? rowO.getAttribute("data-url") : "";
        if (dO){
          var url = /^https?:\/\//i.test(dO) ? dO : "https://" + dO;
          try { window.open(url, "_blank", "noopener,noreferrer"); } catch(e){}
        }
        return;
      }

      // --- row click ---
      var row = e.target.closest(".up-row");
      if (row && !row.classList.contains("up-tsk")){
        var d = row.getAttribute("data-url");
        if (d) fire("data-rowclick-fn", "uutRowClick", { url: d });
      }
    });

    /* Clipboard fallback for browsers/contexts where the async API is unavailable
       (e.g. a non-secure origin) — without this, Copy would silently do nothing there. */

    // rows are focusable (tabindex on the markup); make them behave like the buttons they are
    root.addEventListener("keydown", function(e){
      if (e.key !== "Enter" && e.key !== " ") return;
      var row = e.target.closest && e.target.closest(".up-row");
      if (!row || row.classList.contains("up-tsk")) return;
      e.preventDefault();
      var d = row.getAttribute("data-url");
      if (d) fire("data-rowclick-fn", "uutRowClick", { url: d });
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
    /* theme + processing attributes */
    var syncFromAttrs = function(){
      /* Shared: UC.syncTheme applies data-isdark to data-theme and reports whether it moved.
         Five components had these seven lines character for character. */
      var _th = UC.syncTheme(root, isDark);
      isDark = _th.isDark;
      var changed = _th.changed;
      var procAttr = String(root.getAttribute("data-processing") || "") + "|" +
                     String(root.getAttribute("data-processing2") || "");
      if (procAttr !== lastProcAttr){
        lastProcAttr = procAttr;
        explicitOverride = false;          // a fresh attribute value takes control back
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
    // reconcile once right after attaching: Bubble may resolve these between the initial
    // read above and this observer existing, and that change would otherwise be lost
    syncFromAttrs();

    /* The toolbar controls are dropped by MEASURING the gap between the heading block on the
       left and the tools on the right, not by guessing at root-width thresholds. Width alone
       says nothing about how much room the controls actually need: a long brand name, a wide
       "3 Citation Types" label or a different heading all move the point where it gets tight,
       and fixed breakpoints made things disappear while there was still space. Tiers are added
       one at a time, least important first, until MIN_HEAD_GAP px of breathing room is back. */
    var MIN_HEAD_GAP = 64;
    /* Reserve the search's open width even while it's collapsed, so opening it on a small screen
       never overflows into the heading. 200px box + 2px margin (see .up-search.is-open). */
    var SEARCH_OPEN_WIDTH = 202;
    var MOBILE_SEARCH_MAX = 640;   // below this component width an open search takes over the toolbar
    var TOOLBAR_TIERS = ["is-w3", "is-w2", "is-w1", "is-w0"];
    /* Shared: UC.headGap. Five components measured this identically (urls-table differed only in
       two comments). */
    function headGap(){ return UC.headGap(elHeading, elHeadTools, elSearch, SEARCH_OPEN_WIDTH); }
    function fitToolbar(){
      if (!elHeading || !elHeadTools) return;
      if (root.classList.contains("is-searchtakeover")) return;   // search owns the row on mobile
      for (var r = 0; r < TOOLBAR_TIERS.length; r++) root.classList.remove(TOOLBAR_TIERS[r]);
      for (var i = 0; i < TOOLBAR_TIERS.length; i++){
        if (headGap() >= MIN_HEAD_GAP) return;       // fits, nothing more to drop
        root.classList.add(TOOLBAR_TIERS[i]);        // forces a reflow, so the next read is honest
      }
    }

    /* On a narrow (mobile) width, an open search hides the other tools so it can use the full
       row; closing it restores the normal tier layout. */
    /* responsive: drop columns rather than squeezing them */
    function applyResponsive(){
      var w = root.getBoundingClientRect().width || 0;
      if (!w) return;
      var before = root.className;
      syncSearchTakeover();
      fitToolbar();
      // table tiers
      root.classList.toggle("is-t2", w < 720);   // row actions
      root.classList.toggle("is-t1", w < 560);   // "x pages"
      root.classList.toggle("is-t0", w < 440);   // trend chip
      // column drops
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

    /* Sticky header. Default on at >=1000px page width (off via data-sticky="no"); the column
       header sits right below the component head, its offset measured from the head's height.
       Desktop-only, because on mobile/tablet the filters collapse from the top and would fight a
       stuck header. */
    /* sticky header machinery (core) */
    var _sticky = UpstreemCore.makeSticky(root, elHead);
    function syncTheadOffset(){ _sticky.syncTheadOffset(); }
    function applySticky(){ _sticky.applySticky(); }
    window.addEventListener("resize", UpstreemCore.rafThrottle(applySticky));
    applySticky();
    /* scroll-repositioning for the portaled dropdowns is handled centrally by
       UpstreemCore.makePortal — see core.js */

    /* Count of the user-kept columns, shown on the gear button when the user has switched at least
       one off. Uses state.cols (the user's choice), NOT the responsive/effective set, so shrinking
       the screen never triggers it. Same rule as the combo chart: show only when some (not all) are
       off. */
    function render(){
      renderTable(); renderCount(); syncHeadSorters(); syncBrand(); syncFilterBadge(); syncColsBadge();
      renderPageSize(); renderPager(); applyCols(); syncMentLabel(); syncHeadBrand(); applyResponsive();
      if (root.classList.contains("up-sticky")) syncTheadOffset();
    }

    // restore the search box if a query survived a rebuild
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
        // A response for a superseded search must not overwrite a newer one. Bubble can
        // echo requestId back; when it does, anything stale is dropped here.
        if (params.requestId != null && search.latestReqId() != null && String(params.requestId) !== String(search.latestReqId())) return;
        if (params.rows != null){
          state.rows = Array.isArray(params.rows) ? params.rows : [];
          state.hasData = true;
        }
        if (params.totalCount != null) state.totalCount = toNum(params.totalCount);
        if (params.brands != null){
          var _b = Array.isArray(params.brands) ? params.brands : [];
          if (_b.length) state.brands = _b;   // ignore an empty/stray list so it can't wipe the dropdown on re-render
          populateMent();
        }
        if (params.brand_name != null) root.setAttribute("data-brand-name", String(params.brand_name));
        if (params.brand_logo != null) root.setAttribute("data-brand-logo", String(params.brand_logo));
        /* Ankommende Zeilen beenden nur das selbst ausgeloeste Nachladen. Ein extern gesetzter
           Ladezustand bleibt stehen, bis Bubble ihn selbst aufhebt — sonst wuerde diese Tabelle
           den Skeleton frueher verlassen als die Charts daneben. */
        if (params.rows != null){ state.loading = false; state.softReload = false; dim.end(); }
        if (!explicitOverride && hasProcessingAttr()) state.extLoading = readProcessing();
        persist(); render();
      },
      setLoading: function(on){
        // Overrides the attribute until the attribute itself changes again.
        explicitOverride = true;
        LOADING_EXPLICIT[instanceId] = true;
        state.extLoading = isYes(on);
        if (!state.extLoading){ state.loading = false; state.softReload = false; dim.end(); }   // "fertig" beendet auch ein internes Nachladen
        persist(); render();
      },
      reset: function(){
        state.query = ""; elSearchIn.value = ""; elSearch.classList.remove("is-open");
        state.filterSel = {}; state.appliedSel = {};
        state.filterUrlSel = {}; state.appliedUrlSel = {}; state.filterDim = "citation_type";
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
        /* The tooltip chip is deliberately NOT removed: it is one page-wide singleton shared by
           every component, so tearing it down here would take it away from all the others. (This
           line used to reference an undeclared `tip` and threw a ReferenceError on every
           teardown.) The explainer IS per instance, so that one does get removed. */
        if (explain.parentNode) explain.parentNode.removeChild(explain);
        if (root.__uutController === this) root.__uutController = null;
      }
    };
  }

  /* ================= init / multi-instance bootstrap ================= */
  function initRoot(root){
    if (root.__uutController) return root.__uutController;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;   // placeholder not replaced yet
    var ctrl = makeController(root);
    if (!ctrl) return null;
    root.__uutController = ctrl;
    return ctrl;
  }
  /* .uut-root (not the shared .up-root) is the init selector: once another .up-root-based
     component sits on the same page, matching on .up-root alone would make this script also
     try to initialize the OTHER component's roots (and vice versa) — same shared CSS-variable
     class, different JS. .up-root still carries the theming/variables; .uut-root marks "this
     root belongs to urls-table.js" specifically. */
  function resolve(id){
    var r = rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    if (r.length === 1) return initRoot(r[0]);
    for (var i = 0; i < r.length; i++){   // same id twice → prefer the visible one
      try { if (r[i].offsetParent) return initRoot(r[i]); } catch(e){}
    }
    return initRoot(r[0]);
  }

  function doRender(params){
    var id = params && params.instanceId;
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".uut-root"));
    if (!ctrl) return false;
    ctrl.update(params);
    return true;
  }
  function doLoading(id, on){ var c = resolve(id); if (!c) return false; c.setLoading(on); return true; }
  function doReset(id){ var c = resolve(id); if (!c) return false; return c.reset(); }

  /* Fills the "Mentioned brands" dropdown. Accepts an array or a JSON string of
     {company_id, name, logo_url} (id/brand_id/logo/favicon also accepted). Routed
     through update() so it lands in state.brands and re-renders the menu. */
  function doBrands(id, brands){
    var list = brands;
    if (typeof list === "string"){ try { list = JSON.parse(list); } catch(e){ list = []; } }
    if (!Array.isArray(list)) list = [];
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".uut-root"));
    if (!ctrl) return false;
    ctrl.update({ brands: list });
    return true;
  }
  /* mount from core: root registry, iframe forwarder, wheel forwarding, init cascade and the
     replay of whatever Bubble queued against the stubs. doRender/doLoading/doReset stay local. */
  var mount = UC.makeMount({
    /* onMount: makeMount replays Bubble's queued render* calls while it is still
       constructing, i.e. before `mount` below has been assigned. Without this the very
       first render Bubble queued threw on `mount` being undefined and was swallowed. */
    onMount: function(m){ mount = m; },
    rootClass: "uut-root", notPortal: true,
    ctrlProp: "__uutController",
    resolveLocal: "__uutResolveLocal",
    queue: "__uutBootQueue",
    initRoot: initRoot,
    api: { renderUrlsTable: doRender, setUrlsTableLoading: doLoading, resetUrlsTable: doReset, setUrlsTableBrands: doBrands },
    forwardShape: { renderUrlsTable: "params", resetUrlsTable: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end uutRun

  uutBoot(50); // retry for ~5s before giving up on core.js
})();
