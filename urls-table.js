/* upstreem urls-table.js — component logic. Requires core.js (window.UpstreemCore) loaded first. */
(function(){
  "use strict";

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
  try { if (window.console && console.log) console.log("%cUPSTREEM urls-table","font-weight:bold;color:#2ea84a","build 2026-07-26-ROBUST — Dropdown->uutBrand{brand_mentioned}, Toggle->uutMentioned{brands}"); } catch(e){}
  var UC = window.UpstreemCore;
  var CITE_COLOR = UC.CITE_COLOR, CITE_ALIAS = UC.CITE_ALIAS, ALL_CITATION_TYPES = UC.ALL_CITATION_TYPES, URL_TYPE = UC.URL_TYPE, ALL_URL_TYPES = UC.ALL_URL_TYPES, OTHER_LIGHT = UC.OTHER_LIGHT, OTHER_DARK = UC.OTHER_DARK, CHIP_BG_DARK = UC.CHIP_BG_DARK, MONTHS = UC.MONTHS, DEBOUNCE = UC.DEBOUNCE, MIN = UC.MIN, SORT_DEBOUNCE = UC.SORT_DEBOUNCE, PAGE_SIZES = UC.PAGE_SIZES, DEFAULT_PAGE_SIZE = UC.DEFAULT_PAGE_SIZE, fmtTotal = UC.fmtTotal, isYes = UC.isYes, highlight = UC.highlight, esc = UC.esc, citeName = UC.citeName, tint = UC.tint, toNum = UC.toNum, fmt1 = UC.fmt1, fmtInt = UC.fmtInt, fmtDate = UC.fmtDate, foldDiacritics = UC.foldDiacritics, germanExpand = UC.germanExpand, resolveBubbleFn = UC.resolveBubbleFn, TREND_UP = UC.TREND_UP, TREND_DOWN = UC.TREND_DOWN, CHECK_SVG = UC.CHECK_SVG, COPY_SVG = UC.COPY_SVG, GOTO_SVG = UC.GOTO_SVG, DONE_SVG = UC.DONE_SVG, EXT_SVG = UC.EXT_SVG, STORE = UC.STORE, LOADING_EXPLICIT = UC.LOADING_EXPLICIT;

  /* Hideable columns. Domain and Actions are deliberately absent — the table makes no sense
     without the domain, and the row actions are the point of the Actions cell. */
  var COLUMNS = [
    { key: "share",    label: "Share",            w: "minmax(13%, 150px)", min: 130 },
    { key: "type",     label: "Type",             w: "minmax(11%, 1fr)",   min: 118 },
    { key: "ment",     label: "Mentioned?",       w: "minmax(112px, 0.6fr)", min: 112 },
    { key: "brands",   label: "Brands mentioned", w: "minmax(13%, 1fr)",   min: 178 },
    { key: "lastseen", label: "Last Seen",        w: "minmax(104px, 0.7fr)", min: 104 }
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
    "last_seen:desc":   "last_seen_desc",
    "last_seen:asc":    "last_seen_asc"
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
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme"); if (typeof syncPortalTheme === "function") syncPortalTheme();

    var elHeadCount = root.querySelector(".up-head-count");
    var elTbody     = root.querySelector(".up-tbody");
    var elSearch    = root.querySelector(".up-search");
    var elSearchIn  = root.querySelector(".up-search-input");
    var elFilter    = root.querySelector(".up-filter");
    var elFilterMenu= root.querySelector(".up-filter-menu");
    var elSort      = root.querySelector(".up-sort");
    var elSortMenu  = root.querySelector(".up-sort-menu");
    var elBrand     = root.querySelector(".uut-brand-toggle");
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
    var mentQuery = "";   // transient brand-search query inside the mentioned dropdown
    elMentMenu.addEventListener("input", function(e){
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
      filterSel: saved.filterSel || {},        // live checkbox state (citation types)
      appliedSel: saved.appliedSel || {},      // what was last submitted
      filterUrlSel: saved.filterUrlSel || {},  // live checkbox state (url types)
      appliedUrlSel: saved.appliedUrlSel || {},
      filterDim: saved.filterDim || "citation_type",
      brandMentioned: saved.brandMentioned || "",
      pageSize: saved.pageSize || DEFAULT_PAGE_SIZE,
      page: saved.page || 1,                   // 1-based; offset is derived, never stored
      cols: readCols(),
      widths: readWidths(),
      brands: saved.brands || [],              // full list; persisted so a Bubble re-render keeps them
      mentionSel: saved.mentionSel || {},      // live checkbox state
      mentionApplied: saved.mentionApplied || {},
      dense: readDense()                       // compact row mode (single-line first column) — localStorage
    };
    root.classList.toggle("is-dense", state.dense);   // apply the saved row mode on load
    /* Column visibility is a per-user display preference, not app data — localStorage, keyed by
       instance so two placements can differ. Wrapped because Bubble can run inside contexts where
       storage access throws (private mode, blocked third-party cookies). */
    function colsKey(){ return "uut_cols__" + instanceId; }
    function readCols(){
      var out = {};
      COLUMNS.forEach(function(c){ out[c.key] = true; });
      try {
        var raw = window.localStorage.getItem(colsKey());
        if (raw){
          var parsed = JSON.parse(raw);
          COLUMNS.forEach(function(c){ if (parsed[c.key] === false) out[c.key] = false; });
        }
      } catch(e){}
      return out;
    }
    function writeCols(){
      try { window.localStorage.setItem(colsKey(), JSON.stringify(state.cols)); } catch(e){}
    }
    /* Row-height mode is a display preference too -> localStorage, survives reloads. */
    function denseKey(){ return "uut_dense__" + instanceId; }
    function readDense(){ try { return window.localStorage.getItem(denseKey()) === "1"; } catch(e){ return false; } }
    function writeDense(){ try { window.localStorage.setItem(denseKey(), state.dense ? "1" : "0"); } catch(e){} }
    function visibleCols(){ return COLUMNS.filter(function(c){ return state.cols[c.key] !== false; }); }
    var debTimer = null, latestReqId = null, sortTimer = null;

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
    function attrOwnsLoading(){ return hasProcessingAttr(); }
    function persist(){
      STORE[instanceId] = {
        loading: state.loading, query: state.query,
        sortField: state.sortField, sortDir: state.sortDir,
        filterSel: state.filterSel, appliedSel: state.appliedSel,
        filterUrlSel: state.filterUrlSel, appliedUrlSel: state.appliedUrlSel, filterDim: state.filterDim,
        brandMentioned: state.brandMentioned,
        pageSize: state.pageSize, page: state.page,
        mentionSel: state.mentionSel, mentionApplied: state.mentionApplied,
        brands: state.brands
      };
    }
    function offset(){ return (state.page - 1) * state.pageSize; }
    function pageCount(){
      var t = toNum(state.totalCount);
      if (t == null || t <= 0) return 1;
      return Math.max(1, Math.ceil(t / state.pageSize));
    }
    /* shared event dispatch (core) */
    var fire = UpstreemCore.makeFire(root, { label: "urls-table", eventPrefix: "uut-" });

    /* ---------------- table ---------------- */
    function skeletonRows(n){
      var out = "";
      for (var i = 0; i < n; i++){
        out += '<div class="up-row up-tsk">' +
          '<div class="up-td uut-td-domain"><span class="up-tsk-logo"></span><span class="up-tsk-bar" style="width:' + (110 + (i%3)*30) + 'px"></span></div>' +
          '<div class="up-td uut-td-share"><span class="up-tsk-bar" style="width:70px"></span></div>' +
          '<div class="up-td uut-td-type"><span class="up-tsk-bar" style="width:82px"></span></div>' +
          '<div class="up-td uut-td-ment"><span class="up-tsk-bar" style="width:48px"></span></div>' +
          '<div class="up-td uut-td-brands"><span class="up-tsk-logo" style="border-radius:999px"></span></div>' +
          '<div class="up-td uut-td-lastseen"><span class="up-tsk-bar" style="width:88px"></span></div>' +
          '<div class="up-td uut-td-actions"><span class="up-tsk-bar" style="width:56px"></span></div>' +
        '</div>';
      }
      return out;
    }
    function trendChip(delta){
      var d = toNum(delta);
      if (d == null) return "";
      var shown = Math.round(Math.abs(d) * 10) / 10;
      if (shown === 0) return "";
      var up = d > 0;
      return '<span class="uut-trend ' + (up ? "pos" : "neg") + '">' + (up ? TREND_UP : TREND_DOWN) +
             shown.toFixed(1) + "%</span>";
    }
    /* URL types have their own dark palette; citation types deliberately do not. */
    function urlTypeInfo(raw){
      var key = String(raw == null ? "" : raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
      var t = URL_TYPE[key];
      if (!t) return { label: String(raw || ""), color: isDark ? OTHER_DARK : OTHER_LIGHT, base: OTHER_LIGHT };
      return { label: t.label, color: isDark ? t.cDark : t.c, base: t.c };
    }
    function tagHtml(raw){
      if (!raw) return "";
      var ti = urlTypeInfo(raw);
      var bg = isDark ? CHIP_BG_DARK : tint(ti.base, 0.12);
      /* URL types always carry a leading dot; citation types never do. That is what keeps the two
         systems apart at a glance when they appear next to each other. */
      return '<span class="uut-tag" style="color:' + ti.color + ';background:' + bg + '">' +
               '<span class="uut-tag-dot" style="background:' + ti.color + '"></span>' +
               '<span class="uut-tag-lbl">' + esc(ti.label) + '</span>' +
             '</span>';
    }
    var MAX_STACK = 4;
    function stackHtml(mentions, totalCount){
      var list = Array.isArray(mentions) ? mentions : [];
      if (!list.length) return '<span class="up-stack-empty">-</span>';
      var shown = list.slice(0, MAX_STACK);
      /* The RPC sends only a preview in `mentions` (4 entries) while mentions_totalcount carries
         the real number. Deriving the overflow from the array length gave 0 whenever the preview
         was exactly full, so the "+N" never appeared on rows that actually had more. */
      var total = toNum(totalCount);
      if (total == null || total < list.length) total = list.length;
      var rest = total - shown.length;
      var html = shown.map(function(m){
        var nm = String(m && m.name != null ? m.name : "");
        var logo = String(m && m.favicon_url != null ? m.favicon_url : "");
        // protocol-relative urls ("//cdn...") break inside some Bubble contexts
        if (logo.indexOf("//") === 0) logo = "https:" + logo;
        var initial = nm.charAt(0) || "?";
        return '<span class="uut-stack-item' + (logo ? " has-img" : "") + '" data-brandtip="' + esc(nm) + '">' +
                 '<span class="uut-stack-vis">' +
                   '<span class="uut-stack-ltr">' + esc(initial) + '</span>' +
                   (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                           ' onerror="this.closest(\'.uut-stack-item\').classList.remove(\'has-img\'); this.remove()"/>' : "") +
                 '</span>' +
               '</span>';
      }).join("");
      if (rest > 0) html += '<span class="uut-stack-more">+' + rest + '</span>';
      return '<span class="uut-stack">' + html + '</span>';
    }
    var YES_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    var NO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    function mentCell(v){
      var yes = isYes(v);
      return '<span class="uut-ment-cell ' + (yes ? "is-yes" : "is-no") + '">' +
               (yes ? YES_SVG : NO_SVG) + (yes ? "Yes" : "No") + '</span>';
    }
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
            '<span class="uut-url-title">' + highlight(title, state.query) + '</span>' +
            '<span class="uut-url-sub">' + highlight(url, state.query) + '</span>' +
          '</span>' +
          '<span class="uut-row-goto">' + GOTO_SVG + '</span>' +
        '</div>' +
        '<div class="up-td uut-td-share"><span class="uut-num">' + fmt1(share) + '%</span>' + trendChip(r.share_delta_pct) + '</div>' +
        '<div class="up-td uut-td-type">' + tagHtml(r.url_type) + '</div>' +
        '<div class="up-td uut-td-ment">' + mentCell(r.is_mentioned) + '</div>' +
        '<div class="up-td uut-td-brands">' + stackHtml(r.mentions, r.mentions_totalcount) + '</div>' +
        '<div class="up-td uut-td-lastseen"><span class="uut-date">' + esc(fmtDate(r.last_seen)) + '</span></div>' +
        '<div class="up-td uut-td-actions">' +
          '<span class="uut-actions">' +
            '<button class="uut-actbtn up-act-copy" type="button" data-tip="Copy URL" aria-label="Copy URL">' + COPY_SVG + DONE_SVG + '</button>' +
            '<button class="uut-actbtn up-act-open" type="button" data-tip="Open in new tab" aria-label="Open in new tab">' + EXT_SVG + '</button>' +
          '</span>' +
        '</div>' +
      '</div>';
    }
    function renderTable(){
      // skeleton matches the CURRENT page size, so the table doesn't visibly resize when data lands
      if (state.loading || !state.hasData){ elTbody.innerHTML = skeletonRows(state.pageSize); return; }
      if (!state.rows.length){
        var filtered = !!state.query ||
          Object.keys(state.appliedSel).some(function(k){ return state.appliedSel[k]; }) ||
          !!state.brandMentioned;
        elTbody.innerHTML = '<div class="up-empty">' +
          '<div class="up-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>' +
          '<div class="up-empty-h">' + (filtered ? "No matching URLs" : "No URLs yet") + '</div>' +
          '<div class="up-empty-t">' + (filtered
            ? "Nothing matches the current search and filters."
            : "URLs appear here once your prompts have been run.") + '</div>' +
          (filtered ? '<button class="up-empty-btn" type="button" data-clearall>Clear filters</button>' : "") +
        '</div>';
        return;
      }
      elTbody.innerHTML = state.rows.map(rowHtml).join("");
    }
    function renderCount(){
      elHeading.classList.add("has-count");   // dot + slot always shown; a skeleton stands in for a missing number
      var n = (state.totalCount != null) ? state.totalCount : (state.hasData ? state.rows.length : null);
      if (n == null){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      elHeadCount.textContent = fmtTotal(n);
      elHeadCount.classList.remove("is-sk");
    }

    /* ---------------- header sorters ---------------- */
    function syncHeadSorters(){
      Array.prototype.forEach.call(root.querySelectorAll(".up-thsort"), function(el){
        var col = el.getAttribute("data-for");
        el.classList.remove("is-asc","is-desc");
        // Share's header lights up for its trend key too — they share one column.
        var owns = (col === "share")
          ? (state.sortField === "share" || state.sortField === "share_trend")
          : (state.sortField === col);
        if (owns) el.classList.add(state.sortDir === "asc" ? "is-asc" : "is-desc");
        var th = el.closest(".up-th");
        if (th) th.setAttribute("aria-sort", owns ? (state.sortDir === "asc" ? "ascending" : "descending") : "none");
      });
      // show "Trend" next to the Share label while the trend key is the active sort
      var shareTh = root.querySelector(".up-th-share");
      if (shareTh){
        var sub = shareTh.querySelector(".up-th-sub");
        if (state.sortField === "share_trend"){
          if (!sub){
            sub = document.createElement("span");
            sub.className = "up-th-sub";
            sub.textContent = "Trend";
            shareTh.insertBefore(sub, shareTh.querySelector(".up-thsort"));
          }
        } else if (sub && sub.parentNode){ sub.parentNode.removeChild(sub); }
      }
    }
    /* The position inside a column's cycle is DERIVED from the sort that is actually active,
       never stored. A stored position drifts apart from the real state: once the cycle wrapped
       back to the default (share:desc) the stored position was cleared, so the next click
       started at index 0 and produced share:desc a SECOND time instead of moving on to
       share:asc. Reading the current sort back out of the cycle makes that impossible —
       wherever we are is where the next click continues from, no matter how we got there
       (header click, sort dropdown, wrap-around, or a reset). */
    function headSortClick(col){
      var cycle = HEAD_CYCLE[col];
      if (!cycle) return;
      var idx = cycle.indexOf(state.sortField + ":" + state.sortDir);  // -1 = another column owns the sort
      var pos = idx + 1;                                               // -1 -> 0: start this cycle at the top
      if (pos >= cycle.length){
        applySort(DEFAULT_SORT.field, DEFAULT_SORT.dir);               // past the end -> back to the default
        return;
      }
      var parts = cycle[pos].split(":");
      applySort(parts[0], parts[1]);
    }
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
      persist(); syncHeadSorters(); populateSort();   // UI first, immediately
      clearTimeout(sortTimer);
      sortTimer = setTimeout(function(){
        // A sort is a deliberate action, not part of a search race — clear the search's requestId
        // so its response can't be dropped by the requestId guard in update().
        latestReqId = null;
        fire("data-sort-fn", "uutSort", {
          order: orderValue(state.sortField, state.sortDir),   // -> p_order
          sort_field: state.sortField, sort_dir: state.sortDir // split parts, in case a workflow prefers them
        });
      }, SORT_DEBOUNCE);
    }

    /* ---------------- sort dropdown ---------------- */
    function populateSort(){
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

    /* ---------------- citation type filter ---------------- */
    function populateFilter(){
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
    function widthsKey(){ return "uut_widths__" + instanceId; }
    function readWidths(){
      try {
        var raw = window.localStorage.getItem(widthsKey());
        return raw ? JSON.parse(raw) : {};
      } catch(e){ return {}; }
    }
    function writeWidths(){
      try { window.localStorage.setItem(widthsKey(), JSON.stringify(state.widths)); } catch(e){}
    }
    function colMin(key){
      if (key === "domain") return URL_MIN;
      if (key === "actions") return ACTIONS_MIN;
      var c = COLUMNS.filter(function(x){ return x.key === key; })[0];
      return (c && c.min) || 100;
    }
    /* The visible order, including the two fixed columns that bracket the configurable ones. */
    function layoutKeys(){
      return ["domain"].concat(effectiveCols().map(function(c){ return c.key; }))
             .concat(root.classList.contains("is-t2") ? [] : ["actions"]);
    }
    /* Only the URL column is draggable. Everything else keeps its fr-based track, so the
       remaining space redistributes automatically — no pairwise trading, and no column can be
       starved by dragging a distant divider. The URL width is clamped so that every other visible
       column still fits its own minimum. */
    function startResize(e){
      var thead = root.querySelector(".up-thead");
      if (!thead) return;
      var startX = e.clientX;
      var first = thead.firstElementChild;
      var wA = first.getBoundingClientRect().width;
      var total = thead.getBoundingClientRect().width;
      var others = layoutKeys().slice(1).reduce(function(sum, k){ return sum + colMin(k); }, 0);
      var maxA = Math.max(URL_MIN, total - others);
      var grip = e.target.closest(".up-grip");
      if (grip) grip.classList.add("is-active");
      root.classList.add("is-resizing");

      function move(ev){
        var w = wA + (ev.clientX - startX);
        state.widths.domain = Math.round(Math.max(URL_MIN, Math.min(maxA, w)));
        applyCols();
      }
      function up(){
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        root.classList.remove("is-resizing");
        if (grip) grip.classList.remove("is-active");
        writeWidths();
      }
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", up);
      e.preventDefault();
    }
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
    function effectiveCols(){
      var narrow = root.classList.contains("is-narrow");
      var vnarrow = root.classList.contains("is-vnarrow");
      return visibleCols().filter(function(c){
        if (vnarrow && (c.key === "type" || c.key === "lastseen" || c.key === "brands")) return false;
        if ((narrow || vnarrow) && c.key === "ment") return false;
        return true;
      });
    }
    function applyCols(){
      /* The grid template is rebuilt from the shown columns rather than just hiding cells: with
         CSS grid a hidden cell would leave its track behind and knock the whole row out of line. */
      var shown = {};
      effectiveCols().forEach(function(c){ shown[c.key] = true; });
      COLUMNS.forEach(function(c){
        Array.prototype.forEach.call(root.querySelectorAll(".up-th-"+c.key+", .uut-th-"+c.key+", .up-td-"+c.key+", .uut-td-"+c.key), function(el){
          el.style.display = shown[c.key] ? "" : "none";
        });
      });
      /* A dragged column becomes a fixed px track; everything untouched keeps its responsive
         minmax() so the table still adapts to the container. */
      /* Once the URL column is pinned to a pixel width, every other track has to switch from its
         percentage minimum to its PIXEL minimum. The percentages are relative to the whole grid,
         not to the space left over — keeping them made the tracks add up to more than the
         container, so the table overflowed and the Actions buttons ended up outside the box. */
      var W = state.widths || {};
      var pinned = !!W.domain;
      var domainPx = W.domain;
      if (pinned){
        /* Clamp the pinned URL width against what's actually available so a fixed px URL plus the
           other tracks' minimums can't overflow a shrunken container and push Actions out. */
        var cw = root.getBoundingClientRect().width || 0;
        var othersMin = 0;
        effectiveCols().forEach(function(c){ othersMin += colMin(c.key); });
        if (!root.classList.contains("is-t2")) othersMin += ACTIONS_MIN;
        if (cw) domainPx = Math.max(URL_MIN, Math.min(W.domain, cw - othersMin));
      }
      var parts = [pinned ? domainPx + "px" : "minmax(30%, 1.6fr)"];
      effectiveCols().forEach(function(c){
        parts.push(pinned ? "minmax(" + colMin(c.key) + "px, 1fr)" : c.w);
      });
      if (!root.classList.contains("is-t2")){
        parts.push(pinned ? ACTIONS_MIN + "px" : "minmax(" + ACTIONS_MIN + "px, auto)");
      }
      var tpl = parts.join(" ");
      Array.prototype.forEach.call(root.querySelectorAll(".up-thead, .up-row"), function(el){
        el.style.gridTemplateColumns = tpl;
      });
    }
    function populateCols(){
      var vis = visibleCols();
      var off = COLUMNS.length - vis.length;
      var head = '<div class="up-pop-head up-pop-head-row">' +
        '<span>Columns</span>' +
        '<button class="up-pop-action' + (off >= 2 ? "" : " is-hidden") + '" type="button" data-colsall>Select all</button>' +
      '</div>';
      var COMFY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>';
      var COMPACT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>';
      elColsMenu.innerHTML = head +
        COLUMNS.map(function(c){
          var on = state.cols[c.key] !== false;
          // the last visible column can't be turned off
          var locked = on && vis.length === 1;
          return '<div class="up-pop-row' + (locked ? " is-locked" : "") + '" data-col="' + c.key + '">' +
                   '<span class="up-pop-label">' + esc(c.label) + '</span>' +
                   '<span class="up-switch' + (on ? " is-on" : "") + '" role="switch"></span>' +
                 '</div>';
        }).join("") +
        '<div class="up-pop-div"></div>' +
        '<div class="up-pop-sub">Row height</div>' +
        '<div class="up-dense">' +
          '<button class="up-dense-btn' + (!state.dense ? " is-active" : "") + '" type="button" data-dense="0">' + COMFY_SVG + 'Comfortable</button>' +
          '<button class="up-dense-btn' + (state.dense ? " is-active" : "") + '" type="button" data-dense="1">' + COMPACT_SVG + 'Compact</button>' +
        '</div>';
    }
    function setDense(on){
      state.dense = !!on;
      root.classList.toggle("is-dense", state.dense);
      writeDense(); populateCols();
    }
    function selectAllCols(){
      COLUMNS.forEach(function(c){ state.cols[c.key] = true; });
      writeCols(); populateCols(); applyCols(); syncColsBadge();
    }
    function toggleCol(key){
      var on = state.cols[key] !== false;
      if (on && visibleCols().length === 1) return;   // never hide the last one
      state.cols[key] = !on;
      writeCols(); populateCols(); applyCols(); syncColsBadge();
    }

    /* ---------------- pagination ----------------
       Classic offset pagination: page size × page index → offset. The component never slices
       rows itself — it asks Bubble for the window and renders whatever comes back. */
    function renderPageSize(){
      elPageSize.innerHTML = PAGE_SIZES.map(function(n){
        return '<button class="up-pagesize-btn' + (n === state.pageSize ? " is-active" : "") +
               '" type="button" data-pagesize="' + n + '">' + n + '</button>';
      }).join("");
    }
    /* Window of page numbers around the current one: first, last, current ±1, ellipses between.
       Standard pattern — 1 … 4 [5] 6 … 12 — nothing invented here. */
    function pageWindow(cur, total){
      if (total <= 7){
        var all = [];
        for (var i = 1; i <= total; i++) all.push(i);
        return all;
      }
      var out = [1];
      var from = Math.max(2, cur - 1), to = Math.min(total - 1, cur + 1);
      if (from > 2) out.push("gap");
      for (var p = from; p <= to; p++) out.push(p);
      if (to < total - 1) out.push("gap");
      out.push(total);
      return out;
    }
    function renderPager(){
      var total = pageCount();
      var cur = Math.min(state.page, total);
      if (cur !== state.page){ state.page = cur; persist(); }
      var t = toNum(state.totalCount);
      var info = "";
      if (t != null && t > 0){
        var from = offset() + 1;
        var to = Math.min(offset() + state.pageSize, t);
        info = '<span class="up-pager-info">' + fmtInt(from) + '–' + fmtInt(to) + ' of ' + fmtTotal(t) + '</span>';
      }
      var prevDis = cur <= 1 ? " disabled" : "";
      var nextDis = cur >= total ? " disabled" : "";
      var pages = pageWindow(cur, total).map(function(p){
        if (p === "gap") return '<span class="up-page-gap">…</span>';
        return '<button class="up-page' + (p === cur ? " is-active" : "") + '" type="button" data-page="' + p + '">' + p + '</button>';
      }).join("");
      elPager.innerHTML = info +
        '<button class="up-page up-page-prev" type="button" aria-label="Previous page"' + prevDis + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
        pages +
        '<button class="up-page up-page-next" type="button" aria-label="Next page"' + nextDis + '>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>';
    }
    function goToPage(p){
      var total = pageCount();
      p = Math.max(1, Math.min(total, p));
      if (p === state.page) return;
      state.page = p; state.loading = true;   // show a skeleton until the new page's rows arrive
      persist(); renderTable(); renderPager();
      firePage();
    }
    function setPageSize(n){
      if (n === state.pageSize) return;
      state.pageSize = n;
      state.page = 1;          // a different window size invalidates the current page index
      state.loading = true;    // show a skeleton until the resized page arrives
      persist(); renderPageSize(); renderTable(); renderPager();
      firePage();
    }
    function firePage(){
      /* A page/size change is a deliberate action, not part of a search race. Clear the search's
         requestId so its response can't be dropped by the requestId guard in update(). */
      latestReqId = null;
      fire("data-page-fn", "uutPage", { limit: state.pageSize, offset: offset(), page: state.page });
    }

    /* ---------------- mentioned brands (multi-select) ----------------
       The quick "Brand X mentioned" toggle next to it stays: that one is the single-click path for
       the user's own brand. This is the broader filter for any combination of tracked brands. */
    function populateMent(){
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
    /* Refresh only the dropdown's head (Reset / Select all) after an in-place (de)select. */
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
      if (after === before){ persist(); return; }   // unchanged -> close only, no RPC re-run
      state.mentionApplied = next;
      state.page = 1;
      persist(); syncMentLabel(); renderPager();
      fire("data-brand-fn", "uutBrand", { brand_mentioned: Object.keys(next).join(",") });
    }

    /* ---------------- brand mentioned ---------------- */
    function syncHeadBrand(){
      var logo = root.getAttribute("data-brand-logo") || "";
      var name = root.getAttribute("data-brand-name") || "";
      var img = root.querySelector(".uut-th-brandlogo");
      var lbl = root.querySelector(".up-th-mentlbl");
      if (!img || !lbl) return;
      if (logo && logo !== "BRAND_LOGO"){ img.src = logo; img.style.display = "block"; }
      else { img.style.display = "none"; }
      // the header reads "<logo> mentioned?"; without a logo the brand name has to carry it
      lbl.textContent = (!logo || logo === "BRAND_LOGO") && name && name !== "BRAND_NAME"
        ? name + " mentioned?" : "mentioned?";
    }
    function syncBrand(){
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
      fire("data-mentioned-fn", "uutMentioned", { brands: state.brandMentioned });
    }

    /* ---------------- search (same debounce/min-length/reqId as quick_actions) ---------------- */
    function newReqId(){ return "uut_" + Date.now() + "_" + Math.random().toString(36).slice(2,8); }
    function runSearch(){
      var reqId = newReqId(); latestReqId = reqId;
      state.page = 1;   // a new query is a new result set
      state.loading = true; renderTable(); renderPager();
      fire("data-search-fn", "uutSearch", {
        query: state.query,
        query_folded: foldDiacritics(state.query),
        query_de: germanExpand(state.query),
        requestId: reqId
      });
    }
    function onSearchInput(){
      state.query = String(elSearchIn.value || "").trim();
      elSearch.classList.toggle("has-text", !!elSearchIn.value.length);
      persist();
      clearTimeout(debTimer);
      // Below the minimum, an empty query still has to go out — that's how the table gets
      // its unfiltered list back after the user clears the box.
      if (state.query.length && state.query.length < MIN){ latestReqId = null; return; }
      debTimer = setTimeout(runSearch, DEBOUNCE);
    }
    function toggleSearch(){
      var open = !elSearch.classList.contains("is-open");
      elSearch.classList.toggle("is-open", open);
      syncSearchTakeover();   // mobile: take over the row when opening / release it when closing
      /* No fitToolbar() here: the open search's width is already reserved in headGap(), so the
         tier decision is identical open or closed. Re-measuring here would run mid-transition
         (box not full width yet), read too much room, and wrongly un-hide toolbar elements. */
      if (open){ setTimeout(function(){ try { elSearchIn.focus(); } catch(e){} }, 60); }
      else if (state.query){
        // closing clears the search, which means going back to the unfiltered list
        state.query = ""; elSearchIn.value = "";
        persist(); clearTimeout(debTimer); runSearch();
      }
    }

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
        return '<span class="uut-explain-row" style="gap:0">' +
          '<span class="uut-explain-dot"></span><span class="uut-explain-dot" style="margin-left:-10px"></span>' +
          '<span class="uut-explain-dot" style="margin-left:-10px"></span>' +
          '<span class="uut-explain-dot uut-explain-more" style="margin-left:-10px">+2</span></span>';
      }
      if (kind === "share"){
        return '<span class="uut-explain-row">18.4%' +
               '<span class="uut-explain-up">' + TREND_UP + '</span>' +
               '<span class="uut-explain-up">2.9%</span></span>' +
               '<span class="uut-explain-row">6.1%' +
               '<span class="uut-explain-down">' + TREND_DOWN + '</span>' +
               '<span class="uut-explain-down">1.4%</span></span>';
      }
      return '<span class="uut-explain-row">6.9%</span>';
    }
    var EXPLAIN_TEXT = {
      share: { h: "Share",
        t: "How much of all citations in the period went to this URL, plus the change against the previous period." },
      type:  { h: "URL Type",
        t: "What kind of page this is: an article, a comparison, a product page, and so on." },
      brands: { h: "Brands mentioned",
        t: "Which of your tracked brands appear on this page. Hover a logo to see its name." }
    };
    function showExplain(el){
      var kind = el.getAttribute("data-explain");
      var info = EXPLAIN_TEXT[kind];
      if (!info) return;
      explain.setAttribute("data-theme", isDark ? "dark" : "light");
      explain.innerHTML =
        '<div class="uut-explain-vis">' + explainVisual(kind) + '</div>' +
        '<div class="uut-explain-h">' + esc(info.h) + '</div>' +
        '<div class="uut-explain-t">' + esc(info.t) + '</div>';
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
    var showTip = _tips.showTip, showTipText = _tips.showTipText, showTipWide = _tips.showTipWide, hideTip = _tips.hideTip;
    /* Full URL title on a short hover-delay, but only when actually clipped — component-specific
       (uut-url-wrap) yet driven by the shared tooltip. */
    var titleTipTimer = null, titleTipWrap = null;
    root.addEventListener("mouseover", function(e){
      var wrap = e.target.closest(".uut-url-wrap");
      if (!wrap || !root.contains(wrap)) return;
      if (wrap === titleTipWrap) return;
      titleTipWrap = wrap;
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
    var _portal = UpstreemCore.makePortal(root, [elSortMenu, elFilterMenu, elColsMenu, elMentMenu], instanceId);
    var portalLayer = _portal.portalLayer, syncPortalTheme = _portal.syncPortalTheme;
    function menuOf(pop){
      return pop === elFilter ? elFilterMenu
           : pop === elMent   ? elMentMenu
           : pop === elSort   ? elSortMenu
           : pop === elCols   ? elColsMenu
           : (pop && pop.querySelector(MENU_SEL));
    }
    /* Re-render a menu's list without losing scroll position (selecting after scrolling down must
       not jump the list back to the top). */
    function repopKeepScroll(menu, fn){
      var l = menu && menu.querySelector(".up-filter-list");
      var sc = l ? l.scrollTop : 0;
      fn();
      var nl = menu && menu.querySelector(".up-filter-list");
      if (nl) nl.scrollTop = sc;
    }
    function placeMenu(pop){
      if (!pop) return;
      UpstreemCore.placeMenu(menuOf(pop), pop.querySelector(BTN_SEL));
    }
    function clearMenuPlacement(pop){
      var menu = menuOf(pop);
      if (!menu) return;
      menu.style.position = ""; menu.style.top = ""; menu.style.left = "";
      menu.style.right = ""; menu.style.maxHeight = ""; menu.style.zIndex = "";
    }
    function repositionOpenMenu(){
      [elSort, elFilter, elCols, elMent].forEach(function(p){
        if (p && p.classList.contains("is-open")) placeMenu(p);
      });
    }

    function closePops(except){
      [elSort, elFilter, elCols, elMent].forEach(function(p){
        if (!p || p === except) return;
        if (!p.classList.contains("is-open")) return;
        var menu = menuOf(p);
        // never leave focus inside something about to be hidden from assistive tech
        if (menu && menu.contains(document.activeElement)){
          var opener = p.querySelector(".up-sort-btn, .up-filter-btn, .up-cols-btn, .up-ment-btn");
          try { opener ? opener.focus({ preventScroll: true }) : document.activeElement.blur(); } catch(e){}
        }
        p.classList.remove("is-open");
        if (menu){ menu.setAttribute("aria-hidden", "true"); menu.classList.remove("is-shown"); }
        revertDrafts(p);   // closing any way other than Apply discards the draft
      });
    }
    function setPopOpen(pop, open){
      var menu = menuOf(pop);
      if (!open && menu && menu.contains(document.activeElement)){
        var opener = pop.querySelector(".up-sort-btn, .up-filter-btn, .up-cols-btn, .up-ment-btn");
        try { opener ? opener.focus({ preventScroll: true }) : document.activeElement.blur(); } catch(e){}
      }
      if (!open) revertDrafts(pop);   // toggled shut without Apply -> forget the draft
      pop.classList.toggle("is-open", !!open);
      if (menu){
        menu.setAttribute("aria-hidden", open ? "false" : "true");
        menu.classList.toggle("is-shown", !!open);
        // keep the fixed placement on close so it fades where it is (no downward snap); placeMenu
        // re-measures on the next open.
        if (open) placeMenu(pop);
      }
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
      e.__uutInside = true;
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
        state.brandMentioned = ""; state.page = 1;
        persist(); syncFilterBadge(); syncBrand(); populateFilter();
        clearTimeout(debTimer); runSearch();
        fire("data-filter-fn", "uutFilter", { citation_types: "" });
        fire("data-mentioned-fn", "uutMentioned", { brands: "" });
        return;
      }

      // --- toolbar ---
      if (e.target.closest(".up-search-clear")){
        if (root.classList.contains("is-searchtakeover")){ toggleSearch(); return; }   // mobile: X closes + resets the search
        elSearchIn.value = ""; state.query = "";
        elSearch.classList.remove("has-text");
        persist(); clearTimeout(debTimer); runSearch();
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
        state.mentionSel = {}; persist(); populateMent(); submitMent();
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
        // decision, not a staging step. The menu stays open so the cleared boxes are visible.
        state.filterSel = {}; state.filterUrlSel = {};
        persist(); populateFilter(); submitFilter();
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
    function legacyCopy(text){
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", "");
        ta.style.position = "fixed"; ta.style.top = "-1000px"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      } catch(e){}
    }

    // rows are focusable (tabindex on the markup); make them behave like the buttons they are
    root.addEventListener("keydown", function(e){
      if (e.key !== "Enter" && e.key !== " ") return;
      var row = e.target.closest && e.target.closest(".up-row");
      if (!row || row.classList.contains("up-tsk")) return;
      e.preventDefault();
      var d = row.getAttribute("data-url");
      if (d) fire("data-rowclick-fn", "uutRowClick", { url: d });
    });

    elSearchIn.addEventListener("input", onSearchInput);
    elSearchIn.addEventListener("keydown", function(e){
      if (e.key === "Escape"){ e.stopPropagation(); toggleSearch(); }
      if (e.key === "Enter"){ clearTimeout(debTimer); if (state.query.length >= MIN || !state.query.length) runSearch(); }
    });
    document.addEventListener("click", function(e){
      if (e.__uutInside) return;          // handled by the root listener above
      if (root.contains(e.target)) return;
      closePops();
    });

    var lastProcAttr = String(root.getAttribute("data-processing") || "") + "|" +
                       String(root.getAttribute("data-processing2") || "");
    var explicitOverride = false;
    /* theme + processing attributes */
    var syncFromAttrs = function(){
      var wantDark = isYes(root.getAttribute("data-isdark"));
      var changed = false;
      if (wantDark !== isDark){
        isDark = wantDark;
        if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme"); if (typeof syncPortalTheme === "function") syncPortalTheme();
        changed = true;
      }
      var procAttr = String(root.getAttribute("data-processing") || "") + "|" +
                     String(root.getAttribute("data-processing2") || "");
      if (procAttr !== lastProcAttr){
        lastProcAttr = procAttr;
        explicitOverride = false;          // a fresh attribute value takes control back
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
    function headGap(){
      var h = elHeading && elHeading.getBoundingClientRect();
      var tl = elHeadTools && elHeadTools.getBoundingClientRect();
      if (!h || !tl || !tl.width) return Infinity;   // tools not laid out yet -> never hide on a phantom
      var gap = tl.left - h.right;
      // measure as if search were open, so the layout is stable across opening it
      if (elSearch && !elSearch.classList.contains("is-open")) gap -= SEARCH_OPEN_WIDTH;
      return gap;
    }
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
    function syncSearchTakeover(){
      var w = root.getBoundingClientRect().width || 0;
      var on = !!elSearch && elSearch.classList.contains("is-open") && w > 0 && w < MOBILE_SEARCH_MAX;
      if (on === root.classList.contains("is-searchtakeover")) return;
      root.classList.toggle("is-searchtakeover", on);
      if (!on) fitToolbar();   // takeover ended -> recompute which tools fit
    }
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
      if (root.className !== before) applyCols();   // width change -> different column set
      else if (state.widths && state.widths.domain) applyCols();   // re-clamp the pinned URL width even within a tier
    }
    if (window.ResizeObserver){
      new ResizeObserver(function(){
        if (root.__uutRaf) return;
        root.__uutRaf = requestAnimationFrame(function(){ root.__uutRaf = null; applyResponsive(); });
      }).observe(root);
    }
    window.addEventListener("resize", applyResponsive);
    window.addEventListener("resize", repositionOpenMenu);

    /* Sticky header. Default on at >=1000px page width (off via data-sticky="no"); the column
       header sits right below the component head, its offset measured from the head's height.
       Desktop-only, because on mobile/tablet the filters collapse from the top and would fight a
       stuck header. */
    /* sticky header machinery (core) */
    var _sticky = UpstreemCore.makeSticky(root, elHead);
    function syncTheadOffset(){ _sticky.syncTheadOffset(); }
    function applySticky(){ _sticky.applySticky(); }
    window.addEventListener("resize", applySticky);
    applySticky();
    /* capture so scrolls in ANY ancestor (Bubble group, page) keep the menu pinned */
    window.addEventListener("scroll", repositionOpenMenu, true);

    /* Count of the user-kept columns, shown on the gear button when the user has switched at least
       one off. Uses state.cols (the user's choice), NOT the responsive/effective set, so shrinking
       the screen never triggers it. Same rule as the combo chart: show only when some (not all) are
       off. */
    function syncColsBadge(){
      var badge = root.querySelector(".uut-cols-badge");
      if (!badge) return;
      var all = COLUMNS.length;
      var active = visibleCols().length;
      var show = all > 0 && active > 0 && active < all;
      badge.textContent = show ? String(active) : "";
      badge.classList.toggle("is-visible", show);
    }
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
          if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme"); if (typeof syncPortalTheme === "function") syncPortalTheme();
        }
        // A response for a superseded search must not overwrite a newer one. Bubble can
        // echo requestId back; when it does, anything stale is dropped here.
        if (params.requestId != null && latestReqId != null && String(params.requestId) !== String(latestReqId)) return;
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
        if (explicitOverride){
          // an explicit "loading" is only cleared by an explicit "no" or by arriving rows
          if (params.rows != null){ state.loading = false; explicitOverride = false; }
        }
        else if (hasProcessingAttr()) state.loading = readProcessing();
        else if (params.rows != null) state.loading = false;   // data arrived -> the search is done
        persist(); render();
      },
      setLoading: function(on){
        // Overrides the attribute until the attribute itself changes again.
        explicitOverride = true;
        LOADING_EXPLICIT[instanceId] = true;
        state.loading = isYes(on);
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
        elSearch.classList.remove("has-text");
        persist(); populateSort(); populateFilter(); render();
        return true;
      },
      destroy: function(){
        if (tip.parentNode) tip.parentNode.removeChild(tip);
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
  function initAll(){
    var roots = document.querySelectorAll(".up-root:not(.up-portal)");
    for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
  }
  function rootsWithId(id){
    var out = [], roots = document.querySelectorAll(".up-root:not(.up-portal)");
    for (var i = 0; i < roots.length; i++){
      if (roots[i].getAttribute("data-instance") === id) out.push(roots[i]);
    }
    return out;
  }
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
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".up-root"));
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
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".up-root"));
    if (!ctrl) return false;
    ctrl.update({ brands: list });
    return true;
  }
  window.renderUrlsTable = doRender;
  window.setUrlsTableLoading = doLoading;
  window.setUrlsTableBrands = doBrands;
  window.resetUrlsTable = doReset;
  window.__uutResolveLocal = function(id){ return rootsWithId(id).length > 0; };

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
          for (var i = 0; i < ifr.length; i++){
            var cw; try { cw = ifr[i].contentWindow; } catch(e){ cw = null; }
            if (!cw || seen.indexOf(cw) !== -1) continue;
            seen.push(cw); queue.push(cw);
          }
        }
        for (var a = 0; a < seen.length; a++){
          try {
            var c = seen[a];
            if (c && typeof c[fnName] === "function" && c.__uutResolveLocal && c.__uutResolveLocal(id)) return c[fnName](arg1, arg2);
          } catch(e){}
        }
        for (var b = 0; b < seen.length; b++){
          try { var c2 = seen[b]; if (c2 && typeof c2[fnName] === "function") return c2[fnName](arg1, arg2); } catch(e){}
        }
        return false;
      };
    }
    for (var t = 0; t < targets.length; t++){
      (function(w){
        try {
          var deliver = makeDeliver(w);
          w.renderUrlsTable = function(p){ return deliver("renderUrlsTable", (p && p.instanceId) || "default", p); };
          w.setUrlsTableLoading = function(id, on){ return deliver("setUrlsTableLoading", id || "default", id, on); };
          w.setUrlsTableBrands = function(id, brands){ return deliver("setUrlsTableBrands", id || "default", id, brands); };
          w.resetUrlsTable = function(id){ return deliver("resetUrlsTable", id || "default", id); };
        } catch(e){}
      })(targets[t]);
    }
  })();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAll);
  else initAll();
  [30, 100, 250, 500, 1000, 1800].forEach(function(ms){ setTimeout(initAll, ms); });
  if (window.MutationObserver && !window.__uutObs){
    window.__uutObs = new MutationObserver(function(muts){
      for (var i = 0; i < muts.length; i++){
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++){
          var n = added[j];
          if (n.nodeType === 1 && ((n.classList && n.classList.contains("up-root")) || (n.querySelector && n.querySelector(".up-root")))){ initAll(); return; }
        }
      }
    });
    window.__uutObs.observe(document.body, { childList: true, subtree: true });
    setInterval(initAll, 1500);   // cheap no-op once initialised; catches late Bubble rebuilds
  }
  } // end uutRun

  uutBoot(50); // retry for ~5s before giving up on core.js
})();
