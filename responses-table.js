/* upstreem responses-table.js — component logic. Requires core.js (window.UpstreemCore) loaded first.
   One row per prompt_run (a single LLM response), not per prompt — the same prompt_id repeats
   once per model/run. Two views of the same result set: a table and a card grid, switchable in
   the toolbar, each with its own pagination (see swapView()). */
(function(){
  "use strict";

  var __urtBootQueue = window.__urtBootQueue = window.__urtBootQueue || [];
  if (!window.__urtBootStubbed){
    window.__urtBootStubbed = true;
    ["renderResponsesTable", "setResponsesTableLoading", "resetResponsesTable",
     "setResponsesTableModels", "setResponsesTableBrands"].forEach(function(n){
      window[n] = function(){ __urtBootQueue.push([n, arguments]); };
    });
  }

  function urtBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ urtBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    urtRun();
  }

  function urtRun(){
  var UC = window.UpstreemCore;
  var MONTHS = UC.MONTHS, DEBOUNCE = UC.DEBOUNCE, MIN = UC.MIN, SORT_DEBOUNCE = UC.SORT_DEBOUNCE,
      DEFAULT_PAGE_SIZE = UC.DEFAULT_PAGE_SIZE,
      isYes = UC.isYes, highlight = UC.highlight, esc = UC.esc, toNum = UC.toNum, fmt1 = UC.fmt1, fmtInt = UC.fmtInt,
      fmtDate = UC.fmtDate, fmtTotal = UC.fmtTotal, foldDiacritics = UC.foldDiacritics, germanExpand = UC.germanExpand,
      resolveBubbleFn = UC.resolveBubbleFn, CHECK_SVG = UC.CHECK_SVG, GOTO_SVG = UC.GOTO_SVG,
      sentColor = UC.sentColor, brandStack = UC.brandStack, mentCell = UC.mentCell;
  /* Same .up-hash treatment prompts-table and visibility-chart apply — the shared rank cell is
     icon + number, never a typed "#". */
  var HASH_ICON = UC.HASH_ICON.replace('<svg ', '<svg class="up-hash" ');

  /* Own store — deliberately NOT UC.STORE (that one is hardcoded to urls-table's key, see
     topics-manager.js/prompts-table.js for the same reasoning). */
  var STORE = (window.__urtStore = window.__urtStore || {});
  var LOADING_EXPLICIT = (window.__urtLoadingExplicit = window.__urtLoadingExplicit || {});

  /* Table mode only — the card grid has no columns/row-height to configure, so the whole
     Table-Settings gear hides itself in Cards mode (see render()). "Prompt" is the firstKey,
     always visible, not in this hideable list — same convention as every other table here. */
  /* ORDER IS LOAD-BEARING: makeColumns builds the grid track template by walking this array, while
     the cells come from the markup. If the two disagree, every track lands on the wrong column —
     which is exactly what made Citations render narrower than Brand Mentions. This order must stay
     identical to the .up-th order in bubble/responses_table_bubble.html (after the Prompt column,
     which is `firstKey` and not listed here). `prio` is independent of this order and controls
     drop order when the table runs out of width. */
  var COLUMNS = [
    { key: "mentioned",  label: "Mentioned?",     w: "minmax(110px, 0.6fr)",  min: 110, dropAt: "vnarrow", prio: 30 },
    { key: "sentiment",  label: "Sentiment",      w: "minmax(120px, 1fr)",    min: 120, dropAt: "narrow",  prio: 70 },
    { key: "rank",       label: "Rank",           w: "minmax(90px, 1fr)",     min: 90,  dropAt: "narrow",  prio: 60 },
    /* Brand Mentions shows 4 chips + "+N" (178px, the app-wide figure). Citations shows FIVE chips
       and its "+N" routinely runs to 5 digits (+23266), so it gets a strictly wider floor and a
       larger fr share — with equal fr both columns end up the same width regardless of the mins. */
    { key: "brands",     label: "Brand Mentions", w: "minmax(178px, 1fr)",    min: 178, dropAt: "vnarrow", prio: 50 },
    { key: "citations",  label: "Citations",      w: "minmax(216px, 1.25fr)", min: 216, dropAt: "vnarrow", prio: 40 },
    { key: "model",      label: "Model",          w: "minmax(140px, 0.8fr)",  min: 140, dropAt: "vnarrow", prio: 20 },
    { key: "date",       label: "Date",           w: "minmax(100px, 0.6fr)",  min: 100, dropAt: "narrow",  prio: 10 }
  ];
  var ROW_HEIGHTS = [
    { key: "default", label: "Default", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>' },
    { key: "compact", label: "Compact", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>' }
  ];

  var SORT_FIELDS = [
    { key: "date",      label: "Date" },
    { key: "sentiment", label: "Sentiment" },
    { key: "rank",      label: "Rank" }
  ];
  var ORDER = {
    "date:desc":      "run_at_desc",      "date:asc":      "run_at_asc",
    "sentiment:desc": "sentiment_desc",   "sentiment:asc": "sentiment_asc",
    "rank:asc":       "rank_asc",         "rank:desc":     "rank_desc"
  };
  function orderValue(field, dir){ return ORDER[field + ":" + dir] || "run_at_desc"; }
  var HEAD_CYCLE = {
    date:      ["date:desc", "date:asc"],
    sentiment: ["sentiment:desc", "sentiment:asc"],
    rank:      ["rank:asc", "rank:desc"]
  };
  var DEFAULT_SORT = { field: "date", dir: "desc" };

  var RANK_MIN = 1, RANK_MAX = 20;     // 20 == "20+", open upper end — no data field defines a max
  var SENT_MIN = 0, SENT_MAX = 100;    // same 0-100 scale as sentColor everywhere else

  var TABLE_PAGE_SIZES = [15, 25, 50, 100];
  var CARD_PAGE_SIZES = [6, 12, 24, 48];   // all divisible by 2/3/4/6 -> a clean column count at every breakpoint

  var MINUS_SVG = '<svg class="urt-minus" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  var TABLE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>';
  var CARDS_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
  var FADER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="11" cy="18" r="2" fill="currentColor" stroke="none"/></svg>';

  /* "vor 1 Minute" / "vor 4 Stunden", falling back to the app's normal date format once the gap
     is >= 24h — no relative-time helper exists in core.js yet, and this is currently the only
     consumer, so it stays local rather than becoming a premature core export. */
  function relativeTime(iso){
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return "";
    var diffMs = Date.now() - d.getTime();
    if (diffMs < 0) diffMs = 0;
    var mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    return fmtDate(iso);
  }

  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var saved = STORE[instanceId] || {};

    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");

    var elHeadCount = root.querySelector(".up-head-count");
    var elTbody     = root.querySelector(".up-tbody");
    var elCards     = root.querySelector(".urt-cards");
    var elSearch    = root.querySelector(".up-search");
    var elSearchIn  = root.querySelector(".up-search-input");
    var elSort      = root.querySelector(".up-sort");
    var elSortMenu  = root.querySelector(".up-sort-menu");
    var elCols      = root.querySelector(".up-cols");
    var elColsMenu  = root.querySelector(".up-cols-menu");
    var elFader     = root.querySelector(".urt-fader");
    /* The filter glyph is WRITTEN here, not read from the markup. Markup is a hand copy that the
       CDN pin never touches, so an icon defined only there drifts away from the rest of the app
       the moment it is not re-pasted. UC.SLIDERS_ICON is the same constant the charts use. */
    (function(){
      var fb = root.querySelector(".urt-fader-btn");
      if (fb) fb.innerHTML = UC.SLIDERS_ICON;
    })();
    var elFaderMenu = root.querySelector(".urt-fader-menu");
    var elMent      = root.querySelector(".up-ment");
    var elMentMenu  = root.querySelector(".up-ment-menu");
    var mentQuery = "";
    if (elMentMenu) elMentMenu.addEventListener("input", function(e){
      if (e.target && e.target.classList && e.target.classList.contains("up-ment-search")) applyMentFilter();
    });
    var elMentLbl   = root.querySelector(".up-ment-lbl");
    var elBrand     = root.querySelector(".urt-brand-toggle");
    var elBrandLogo = root.querySelector(".urt-brand-logo");
    var elBrandLbl  = root.querySelector(".urt-brand-label");
    var elHeading   = root.querySelector(".up-heading");
    var elHeadTools = root.querySelector(".up-head-tools");
    var elHead      = root.querySelector(".up-head");
    var elViewSwitch = root.querySelector(".urt-viewswitch");

    function rhKey(){ return "urt_rowheight__" + instanceId; }
    function readRowHeight(){
      try { return window.localStorage.getItem(rhKey()) === "compact" ? "compact" : "default"; }
      catch(e){ return "default"; }
    }
    function writeRowHeight(){ try { window.localStorage.setItem(rhKey(), state.rowHeight); } catch(e){} }

    var state = {
      rows: [], totalCount: null, hasData: false,
      loading: false, softReload: false,
      extLoading: hasProcessingAttr() ? readProcessing()
             : (LOADING_EXPLICIT[instanceId] ? !!saved.loading : false),
      view: saved.view || "table",
      // two independent pagination states — only the one matching `view` is "live" in page/pageSize
      tablePage: saved.tablePage || 1, tablePageSize: saved.tablePageSize || DEFAULT_PAGE_SIZE,
      cardPage: saved.cardPage || 1, cardPageSize: saved.cardPageSize || 12,
      query: saved.query || "",
      sortField: saved.sortField || DEFAULT_SORT.field, sortDir: saved.sortDir || DEFAULT_SORT.dir,
      // rank*/sent* are the last APPLIED values, only ever written by applyFader(). The Fader
      // popover drags a separate *Draft pair (seeded from these on open, discarded on close
      // without Apply) — dragging a handle must not change what's actually filtered yet.
      rankMin: saved.rankMin != null ? saved.rankMin : RANK_MIN,
      rankMax: saved.rankMax != null ? saved.rankMax : RANK_MAX,
      sentMin: saved.sentMin != null ? saved.sentMin : SENT_MIN,
      sentMax: saved.sentMax != null ? saved.sentMax : SENT_MAX,
      rankFilterActive: !!saved.rankFilterActive, sentFilterActive: !!saved.sentFilterActive,
      brandMentioned: saved.brandMentioned || "",
      mentionSel: saved.mentionSel || {}, mentionApplied: saved.mentionApplied || {},
      brands: saved.brands || [], models: saved.models || [],
      cols: {}, widths: {}, rowHeight: readRowHeight()
    };
    // live pager fields makePager actually reads — synced from the per-view state on every swap
    state.page = state.view === "cards" ? state.cardPage : state.tablePage;
    state.pageSize = state.view === "cards" ? state.cardPageSize : state.tablePageSize;
    root.classList.toggle("is-cards-view", state.view === "cards");
    /* is-dense is core's own compact-row mode (72px -> 55px plus the smaller brand-stack chips).
       Toggling it is what actually resizes the rows; is-rh-compact only carries this component's
       own extras (the prompt line-clamp). Setting just the latter is why the Row Height switcher
       looked dead. */
    function applyRowHeightClass(){
      var compact = state.rowHeight === "compact";
      root.classList.toggle("is-rh-compact", compact);
      root.classList.toggle("is-dense", compact);
    }
    applyRowHeightClass();
    function setRowHeight(mode){
      if (state.rowHeight === mode) return;
      state.rowHeight = mode;
      applyRowHeightClass();
      writeRowHeight(); populateCols();
    }

    var sortTimer = null;

    var MOBILE_SEARCH_MAX = 640;
    var search = UC.makeSearch({
      root: root, box: elSearch, input: elSearchIn, state: state,
      mobileMax: MOBILE_SEARCH_MAX, prefix: "urt",
      onRender: function(){ renderBody(); renderPager(); },
      onFire: function(payload){ state.softReload = false; dim.end(); fire("data-search-fn", "urtSearch", payload); },
      onTakeoverEnd: function(){ fitToolbar(); },
      persist: function(){ persist(); }
    });
    function runSearch(){ search.run(); }
    function toggleSearch(){ search.toggle(); }
    function onSearchInput(){ search.onInput(); }
    function syncSearchTakeover(){ search.syncTakeover(); }

    function usableAttr(v, placeholder){ return v != null && v !== "" && v !== placeholder; }
    function hasProcessingAttr(){
      return usableAttr(root.getAttribute("data-processing"), "IS_PROCESSING") ||
             usableAttr(root.getAttribute("data-processing2"), "IS_PROCESSING_2");
    }
    function readProcessing(){
      var a = root.getAttribute("data-processing"), b = root.getAttribute("data-processing2");
      var pa = usableAttr(a, "IS_PROCESSING") ? isYes(a) : false;
      var pb = usableAttr(b, "IS_PROCESSING_2") ? isYes(b) : false;
      return pa || pb;
    }
    function persist(){
      STORE[instanceId] = {
        loading: state.extLoading, view: state.view,
        tablePage: state.tablePage, tablePageSize: state.tablePageSize,
        cardPage: state.cardPage, cardPageSize: state.cardPageSize,
        query: state.query, sortField: state.sortField, sortDir: state.sortDir,
        rankMin: state.rankMin, rankMax: state.rankMax, sentMin: state.sentMin, sentMax: state.sentMax,
        rankFilterActive: state.rankFilterActive, sentFilterActive: state.sentFilterActive,
        brandMentioned: state.brandMentioned,
        mentionSel: state.mentionSel, mentionApplied: state.mentionApplied,
        brands: state.brands, models: state.models
      };
    }
    var fire = UC.makeFire(root, { label: "responses-table", eventPrefix: "urt-" });
    var dim = UC.makeSoftReload(root);

    /* ---------------- cell renderers ---------------- */
    function skeletonRowsHtml(n){
      return UC.skeletonRows({ count: n, cols: [
        { w:220, jitter:40, cls:"urt-td-prompt" },
        { w:70,  cls:"urt-td-mentioned" },
        { w:56,  cls:"urt-td-sentiment" },
        { w:44,  cls:"urt-td-rank" },
        { logo:true, logoStyle:"border-radius:999px", cls:"urt-td-brands" },
        { logo:true, logoStyle:"border-radius:999px", cls:"urt-td-citations" },
        { w:110, cls:"urt-td-model" },
        { w:76,  cls:"urt-td-date" }
      ]});
    }
    function skeletonCardsHtml(n){
      var s = "";
      for (var i = 0; i < n; i++){
        s += '<div class="urt-card urt-card-sk">' +
               '<div class="urt-card-head"><span class="urt-sk urt-sk-chip"></span><span class="urt-sk urt-sk-date"></span></div>' +
               '<span class="urt-sk urt-sk-line" style="width:92%"></span>' +
               '<span class="urt-sk urt-sk-line" style="width:80%"></span>' +
               '<span class="urt-sk urt-sk-line" style="width:60%"></span>' +
             '</div>';
      }
      return s;
    }
    function rankCell(v){
      var n = (v == null || v === "") ? null : Number(v);
      if (n == null || !isFinite(n)) return '<span class="urt-empty">' + MINUS_SVG + '</span>';
      /* HASH_ICON + .up-num, exactly like prompts-table and visibility-chart — a literal "#"
         character is NOT the convention here and rendered visibly different from every other
         rank cell in the app. fmtInt (not fmt1): user_rank is an ordinal, not an average. */
      return '<span class="up-rank-group">' + HASH_ICON + '<span class="up-num">' + fmtInt(n) + '</span></span>';
    }
    function sentCell(v){
      var n = (v == null || v === "") ? null : Number(v);
      if (n == null || !isFinite(n)) return '<span class="urt-empty">' + MINUS_SVG + '</span>';
      return '<span class="up-sent"><span class="up-sent-dot" style="background:' + sentColor(n) + '"></span>' +
             '<span class="up-sent-val">' + Math.round(n) + '</span></span>';
    }
    /* NO total argument on purpose. `total_count` on a row is the RESULT-SET total — it drives
       pagination and the heading count — and passing it here printed "+23346" next to five
       citation chips. There is no per-row citations total in the payload, so the preview length
       is the count: brandStack falls back to it when totalCount is null. */
    function citationsChips(sources){
      var mapped = (Array.isArray(sources) ? sources : []).map(function(s){
        return { name: s && s.title, favicon: s && s.favicon };
      });
      return brandStack(mapped, null, { max: 5, spread: "left" });
    }
    /* Defensive on the ENTRY, not just the key: a malformed models list (a hole, a null, a bare
       string) must degrade to "unknown model, show the raw key" — never throw. This runs inside
       renderBody(), so a throw here took out everything render() does afterwards: pagination,
       column layout, brand toggle, view switch. One bad row should not empty the whole toolbar. */
    function modelInfo(key){
      var models = state.models || [];
      for (var i = 0; i < models.length; i++){
        var m = models[i];
        if (m && m.key === key) return m;
      }
      return null;
    }
    /* Long provider names blow the Model column apart ("Google AI Overviews" alone is wider than
       the whole track). A model may ship its own `short_name`; otherwise these known long names
       fall back to the abbreviation the rest of the product uses. Unknown keys pass through
       untouched. */
    var MODEL_SHORT = { "google-aio": "Google AIO" };
    function modelLabel(m, key){
      if (m && m.short_name) return String(m.short_name);
      if (MODEL_SHORT[key]) return MODEL_SHORT[key];
      return m ? String(m.display_name || key) : String(key || "");
    }
    function modelChip(key){
      var m = modelInfo(key);
      var name = modelLabel(m, key);
      var full = m ? String(m.display_name || key) : String(key || "");
      var logo = m && m.logo_url ? String(m.logo_url) : "";
      if (logo.indexOf("//") === 0) logo = "https:" + logo;
      var initial = name.charAt(0) || "?";
      /* .up-ment-logo / .up-ment-name are the shared 18px logo + label pair from core.css — the
         same one the Mentioned dropdown uses. The earlier custom .urt-model-logo drew a border
         box around the logo that exists nowhere else in the app. */
      return '<span class="urt-model-chip"' + (full !== name ? ' data-tip="' + esc(full) + '"' : "") + '>' +
               '<span class="up-ment-logo' + (logo ? " has-img" : "") + '">' +
                 '<span class="urt-model-ltr">' + esc(initial) + '</span>' +
                 (logo ? '<img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                         ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()"/>' : "") +
               '</span>' +
               '<span class="up-ment-name">' + esc(name) + '</span>' +
             '</span>';
    }

    /* ---------------- table rows ---------------- */
    function rowHtml(r){
      var promptText = String(r.prompt_text == null ? "" : r.prompt_text);
      return '<div class="up-row" data-run="' + esc(String(r.prompt_run_id || "")) + '" tabindex="0" role="button">' +
        '<div class="up-td urt-td-prompt"><span class="urt-prompt-text">' + highlight(promptText, state.query) + '</span></div>' +
        '<div class="up-td urt-td-mentioned">' + mentCell(r.has_user_brand) + '</div>' +
        '<div class="up-td urt-td-sentiment">' + sentCell(r.user_sentiment) + '</div>' +
        '<div class="up-td urt-td-rank">' + rankCell(r.user_rank) + '</div>' +
        '<div class="up-td urt-td-brands">' + brandStack(r.companies_preview, r.companies_preview_totalcount, { max: 4 }) + '</div>' +
        '<div class="up-td urt-td-citations">' + citationsChips(r.sources_preview) + '</div>' +
        '<div class="up-td urt-td-model">' + modelChip(r.model) + '</div>' +
        '<div class="up-td urt-td-date"><span class="urt-date">' + esc(fmtDate(r.run_at)) + '</span></div>' +
      '</div>';
    }
    function cardHtml(r){
      var promptText = String(r.prompt_text == null ? "" : r.prompt_text);
      var preview = String(r.response_preview == null ? "" : r.response_preview);
      var mentioned = isYes(r.has_user_brand);
      return '<div class="urt-card" data-run="' + esc(String(r.prompt_run_id || "")) + '" tabindex="0" role="button">' +
        '<div class="urt-card-head">' +
          modelChip(r.model) +
          '<span class="urt-card-date" data-tip="' + esc(fmtDate(r.run_at)) + '">' + esc(relativeTime(r.run_at)) + '</span>' +
        '</div>' +
        '<div class="urt-card-badges">' +
          sentCell(r.user_sentiment) + rankCell(r.user_rank) +
          (mentioned ? '<span class="urt-mentioned-badge">' + CHECK_SVG + 'Mentioned</span>' : "") +
        '</div>' +
        '<div class="urt-card-prompt">' + highlight(promptText, state.query) + '</div>' +
        '<div class="urt-card-preview">' + esc(preview) + '</div>' +
        '<div class="urt-card-foot">' +
          '<div class="urt-card-brands">' + brandStack(r.companies_preview, r.companies_preview_totalcount, { max: 4 }) + '</div>' +
          '<div class="urt-card-citations">' + citationsChips(r.sources_preview) + '</div>' +
        '</div>' +
      '</div>';
    }

    var emptyGraceTimer = null;
    function clearEmptyGrace(){ if (emptyGraceTimer){ clearTimeout(emptyGraceTimer); emptyGraceTimer = null; } }
    function anyFilterActive(){
      return !!state.query || !!state.brandMentioned || state.rankFilterActive || state.sentFilterActive ||
        Object.keys(state.mentionApplied).some(function(k){ return state.mentionApplied[k]; });
    }
    function emptyHtml(filtered){
      return '<div class="up-empty">' +
        '<div class="up-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>' +
        '<div class="up-empty-h">' + (filtered ? "No matching responses" : "No responses yet") + '</div>' +
        '<div class="up-empty-t">' + (filtered
          ? "Nothing matches the current search and filters."
          : "Responses appear here once your prompts have been run.") + '</div>' +
        (filtered ? '<button class="up-empty-btn" type="button" data-clearall>Clear filters</button>' : "") +
      '</div>';
    }
    function renderBody(){
      var isCards = state.view === "cards";
      var container = isCards ? elCards : elTbody;
      if (!container) return;
      if (isBusy() && state.softReload && state.hasData && state.rows.length){ clearEmptyGrace(); return; }
      if (isBusy() || !state.hasData){
        clearEmptyGrace();
        container.innerHTML = isCards ? skeletonCardsHtml(state.pageSize) : skeletonRowsHtml(state.pageSize);
        return;
      }
      if (!state.rows.length){
        if (anyFilterActive()){ clearEmptyGrace(); container.innerHTML = emptyHtml(true); return; }
        if (!emptyGraceTimer){
          container.innerHTML = isCards ? skeletonCardsHtml(state.pageSize) : skeletonRowsHtml(state.pageSize);
          emptyGraceTimer = setTimeout(function(){
            emptyGraceTimer = null;
            if (isBusy() || !state.hasData || state.rows.length) return;
            container.innerHTML = emptyHtml(false);
          }, 600);
        }
        return;
      }
      clearEmptyGrace();
      container.innerHTML = state.rows.map(isCards ? cardHtml : rowHtml).join("");
    }
    function renderCount(){
      elHeading.classList.add("has-count");
      if (isBusy()){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      var n = (state.totalCount != null) ? state.totalCount : (state.hasData ? state.rows.length : null);
      if (n == null){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      elHeadCount.textContent = fmtTotal(n);
      elHeadCount.classList.remove("is-sk");
    }

    /* ---------------- sort ---------------- */
    function applySort(field, dir){
      state.sortField = field; state.sortDir = dir;
      state.tablePage = 1; state.cardPage = 1; state.page = 1;
      state.softReload = true;
      dim.begin(state.hasData && !!state.rows.length);
      persist(); syncHeadSorters(); populateSort();
      clearTimeout(sortTimer);
      sortTimer = setTimeout(function(){
        search.setLatest(null);
        state.loading = true;
        fire("data-sort-fn", "urtSort", {
          order: orderValue(state.sortField, state.sortDir),
          sort_field: state.sortField, sort_dir: state.sortDir
        });
        renderBody();
      }, SORT_DEBOUNCE);
    }
    function populateSort(){
      if (!elSortMenu) return;
      var html = '<div class="up-pop-head">Sort by</div>';
      html += SORT_FIELDS.map(function(f){
        return '<div class="up-pop-opt' + (f.key === state.sortField ? " is-active" : "") + '" data-sortfield="' + f.key + '">' +
                 '<span>' + esc(f.label) + '</span><span class="up-check">' + CHECK_SVG + '</span></div>';
      }).join("");
      html += '<div class="up-pop-div"></div>' +
        '<div class="up-pop-row"><span class="up-pop-label">Descending</span>' +
          '<span class="up-switch' + (state.sortDir === "desc" ? " is-on" : "") + '" role="switch" data-sortdir></span></div>';
      elSortMenu.innerHTML = html;
    }

    /* ---------------- table settings (columns + row height) ---------------- */
    var PROMPT_MIN = 240;
    var colsKit = UC.makeColumns({
      root: root, state: state, columns: COLUMNS,
      storePrefix: "urt", instanceId: instanceId,
      firstKey: "prompt", firstMin: PROMPT_MIN, noActions: true,
      rowHeightSwitch: ROW_HEIGHTS, badgeSel: ".urt-cols-badge", cellPrefixes: ["up","urt"],
      onChange: function(){ render(); }
    });
    var applyCols = colsKit.applyCols, startResize = colsKit.startResize;
    var populateCols = colsKit.populateCols, toggleCol = colsKit.toggleCol;
    var selectAllCols = colsKit.selectAllCols, syncColsBadge = colsKit.syncColsBadge;
    state.cols = colsKit.readCols();
    state.widths = colsKit.readWidths();
    root.addEventListener("pointerdown", function(e){
      var grip = e.target.closest(".up-grip");
      if (!grip) return;
      e.stopPropagation();
      startResize(e);
    });

    /* ---------------- pagination (shared kit, swapped per view — see swapView) ---------------- */
    var pagerKit = UC.makePager({
      root: root, state: state,
      pageSizes: function(){ return state.view === "cards" ? CARD_PAGE_SIZES : TABLE_PAGE_SIZES; },
      onClamp: function(){ persist(); },
      onChange: function(){
        if (state.view === "cards"){ state.cardPage = state.page; state.cardPageSize = state.pageSize; }
        else { state.tablePage = state.page; state.tablePageSize = state.pageSize; }
        persist(); renderBody(); firePage();
      }
    });
    var renderPager = pagerKit.renderPager, renderPageSize = pagerKit.renderPageSize;
    var goToPage = pagerKit.goToPage, setPageSize = pagerKit.setPageSize, offset = pagerKit.offset;
    function firePage(){
      search.setLatest(null);
      state.softReload = false; dim.end();
      fire("data-page-fn", "urtPage", { page: state.page, size: state.pageSize, view: state.view });
    }
    /* View switch keeps each mode's own {page, pageSize} — going Table page 3/50 -> Cards ->
       back to Table restores exactly that, instead of dumping the user on whatever the other
       mode happened to be showing. */
    function swapView(next){
      if (next === state.view) return;
      if (state.view === "cards"){ state.cardPage = state.page; state.cardPageSize = state.pageSize; }
      else { state.tablePage = state.page; state.tablePageSize = state.pageSize; }
      state.view = next;
      state.page = next === "cards" ? state.cardPage : state.tablePage;
      state.pageSize = next === "cards" ? state.cardPageSize : state.tablePageSize;
      root.classList.toggle("is-cards-view", next === "cards");
      search.setLatest(null);
      state.softReload = false; dim.end(); state.loading = true;
      persist(); syncViewSwitch(); renderPageSize(); renderPager(); render();
      fire("data-view-fn", "urtView", { view: state.view });
      firePage();
    }
    function syncViewSwitch(){
      if (!elViewSwitch) return;
      var btns = elViewSwitch.querySelectorAll("[data-view]");
      Array.prototype.forEach.call(btns, function(b){
        b.classList.toggle("is-active", b.getAttribute("data-view") === state.view);
      });
      if (elCols) elCols.style.display = state.view === "cards" ? "none" : "";
    }

    /* ---------------- rank/sentiment fader popover ---------------- */
    function clampPair(min, max, lo, hi){
      min = Math.max(lo, Math.min(min, hi));
      max = Math.max(lo, Math.min(max, hi));
      if (min > max){ var t = min; min = max; max = t; }
      return [min, max];
    }
    function faderFillStyle(min, max, lo, hi){
      var l = ((min - lo) / (hi - lo)) * 100, r = ((max - lo) / (hi - lo)) * 100;
      return "left:" + l + "%; right:" + (100 - r) + "%;";
    }
    // Draft values the sliders actually drag — seeded from the last-applied state.rank*/sent*
    // right before the popover opens (see the .urt-fader-btn click handler), discarded again on
    // close without Apply. Dragging must not touch what's actually filtered until Apply commits it.
    var rankMinDraft = state.rankMin, rankMaxDraft = state.rankMax;
    var sentMinDraft = state.sentMin, sentMaxDraft = state.sentMax;
    function seedFaderDrafts(){
      rankMinDraft = state.rankMin; rankMaxDraft = state.rankMax;
      sentMinDraft = state.sentMin; sentMaxDraft = state.sentMax;
    }
    /* RANK_MAX is an OPEN upper end — at the top of the track the filter means "20 or worse",
       so it reads "20+" everywhere the number is shown. */
    function rankLabel(v){ return v >= RANK_MAX ? (RANK_MAX + "+") : String(v); }
    function sectionHtml(kind, label, lo, hi, vLo, vHi, fmt){
      return '<div class="urt-fader-sec">' +
          '<div class="urt-fader-head">' +
            '<span class="urt-fader-lbl">' + label + '</span>' +
            '<span class="urt-fader-val">' + fmt(vLo) + '<span class="urt-fader-dash">–</span>' + fmt(vHi) + '</span>' +
          '</div>' +
          '<div class="urt-slider" data-slider="' + kind + '">' +
            '<div class="urt-slider-track"></div>' +
            '<div class="urt-slider-fill" style="' + faderFillStyle(vLo, vHi, lo, hi) + '"></div>' +
            '<input type="range" class="urt-range urt-range-lo" min="' + lo + '" max="' + hi + '" step="1" value="' + vLo + '" data-handle="lo" aria-label="' + label + ' minimum"/>' +
            '<input type="range" class="urt-range urt-range-hi" min="' + lo + '" max="' + hi + '" step="1" value="' + vHi + '" data-handle="hi" aria-label="' + label + ' maximum"/>' +
          '</div>' +
        '</div>';
    }
    function populateFader(){
      if (!elFaderMenu) return;
      elFaderMenu.innerHTML =
        sectionHtml("rank", "Rank", RANK_MIN, RANK_MAX, rankMinDraft, rankMaxDraft, rankLabel) +
        sectionHtml("sentiment", "Sentiment", SENT_MIN, SENT_MAX, sentMinDraft, sentMaxDraft, String) +
        '<div class="urt-fader-foot">' +
          '<button class="urt-fader-reset" type="button" data-faderreset>Reset</button>' +
          '<button class="urt-fader-apply" type="button" data-faderapply>Apply</button>' +
        '</div>';
      wireFaderInputs();
    }
    function wireFaderInputs(){
      var sliders = elFaderMenu.querySelectorAll(".urt-slider");
      Array.prototype.forEach.call(sliders, function(sl){
        var kind = sl.getAttribute("data-slider");
        var isRank = kind === "rank";
        var lo = isRank ? RANK_MIN : SENT_MIN, hi = isRank ? RANK_MAX : SENT_MAX;
        var fmt = isRank ? rankLabel : String;
        var loIn = sl.querySelector(".urt-range-lo"), hiIn = sl.querySelector(".urt-range-hi");
        var fill = sl.querySelector(".urt-slider-fill");
        var val = sl.parentNode.querySelector(".urt-fader-val");
        function updateDraft(){
          var pair = clampPair(Number(loIn.value), Number(hiIn.value), lo, hi);
          loIn.value = pair[0]; hiIn.value = pair[1];
          if (isRank){ rankMinDraft = pair[0]; rankMaxDraft = pair[1]; }
          else { sentMinDraft = pair[0]; sentMaxDraft = pair[1]; }
          fill.setAttribute("style", faderFillStyle(pair[0], pair[1], lo, hi));
          /* Which handle sits on top matters: at the extremes both thumbs land on the same pixel
             and whichever input is last in the DOM would swallow every grab, making the range
             impossible to reopen. Raise the one the pointer can still usefully move. */
          var atTop = pair[0] === hi;
          loIn.style.zIndex = atTop ? 4 : 3;
          hiIn.style.zIndex = atTop ? 3 : 4;
          if (val) val.innerHTML = fmt(pair[0]) + '<span class="urt-fader-dash">–</span>' + fmt(pair[1]);
        }
        loIn.addEventListener("input", updateDraft);
        hiIn.addEventListener("input", updateDraft);
        updateDraft();
      });
    }
    function applyFader(){
      state.rankMin = rankMinDraft; state.rankMax = rankMaxDraft;
      state.sentMin = sentMinDraft; state.sentMax = sentMaxDraft;
      state.rankFilterActive = !(state.rankMin === RANK_MIN && state.rankMax === RANK_MAX);
      state.sentFilterActive = !(state.sentMin === SENT_MIN && state.sentMax === SENT_MAX);
      state.tablePage = 1; state.cardPage = 1; state.page = 1;
      state.softReload = false; dim.end();
      persist(); syncFaderBadge(); renderPager();
      fire("data-filter-fn", "urtFilter", {
        rank_min: state.rankMin, rank_max: state.rankMax, rank_active: state.rankFilterActive,
        sent_min: state.sentMin, sent_max: state.sentMax, sent_active: state.sentFilterActive
      });
    }
    function syncFaderBadge(){
      if (!elFader) return;
      elFader.classList.toggle("is-active", state.rankFilterActive || state.sentFilterActive);
    }

    /* ---------------- mentioned brands (multi-select) — same pattern as urls-table ---------------- */
    function populateMent(){
      if (!elMentMenu) return;
      var list = state.brands || [];
      var selCount = Object.keys(state.mentionSel).filter(function(k){ return state.mentionSel[k]; }).length;
      var head = '<div class="up-filter-head"><span class="up-filter-title">Mentioned brands</span>' +
          (selCount ? '<button class="up-pop-action" type="button" data-mentreset>Reset</button>'
             : (list.length ? '<button class="up-pop-action" type="button" data-mentall>Select all</button>' : "")) +
        '</div>';
      var items = !list.length ? '<div class="up-ment-empty">No brands available</div>'
        : list.map(function(b){
            var id = String(b.company_id != null ? b.company_id : (b.id != null ? b.id : (b.brand_id != null ? b.brand_id : b.name)));
            var nm = String(b.name != null ? b.name : id);
            var logo = String(b.logo_url != null ? b.logo_url : (b.logo != null ? b.logo : (b.favicon != null ? b.favicon : "")));
            return '<div class="up-filter-item' + (state.mentionSel[id] ? " is-checked" : "") +
                   '" data-brand="' + esc(id) + '" data-name="' + esc(nm.toLowerCase()) + '" title="' + esc(nm) + '">' +
                     '<span class="up-filter-check">' + CHECK_SVG + '</span>' +
                     (logo ? '<span class="up-ment-logo"><img src="' + esc(logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer"/></span>'
                           : '<span class="up-ment-logo"></span>') +
                     '<span class="up-ment-name">' + esc(nm) + '</span></div>';
          }).join("");
      var srch = list.length ? '<div class="up-ment-searchwrap">' +
            '<input class="up-ment-search" type="text" placeholder="Search brands..." autocomplete="off" spellcheck="false" value="' + esc(mentQuery) + '"/>' +
            '<button class="up-ment-searchclear" type="button" aria-label="Clear brand search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>' : "";
      elMentMenu.innerHTML = head + srch +
        '<div class="up-filter-list up-ment-list">' + items + '<div class="up-ment-noresult" style="display:none">No matches</div></div>' +
        '<button class="up-filter-submit" type="button" data-mentapply>Apply</button>';
      applyMentFilter();
    }
    function applyMentFilter(){
      if (!elMentMenu) return;
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
      if (!elMentMenu) return;
      var head = elMentMenu.querySelector(".up-filter-head");
      if (!head) return;
      var list = state.brands || [];
      var selCount = Object.keys(state.mentionSel).filter(function(k){ return state.mentionSel[k]; }).length;
      head.innerHTML = '<span class="up-filter-title">Mentioned brands</span>' +
        (selCount ? '<button class="up-pop-action" type="button" data-mentreset>Reset</button>'
           : (list.length ? '<button class="up-pop-action" type="button" data-mentall>Select all</button>' : ""));
    }
    function syncMentLabel(){
      if (!elMent || !elMentLbl) return;
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
      var after = Object.keys(next).sort().join(",");
      if (after === before){ persist(); return; }
      state.mentionApplied = next;
      state.tablePage = 1; state.cardPage = 1; state.page = 1;
      state.softReload = false; dim.end();
      persist(); syncMentLabel(); renderPager();
      fire("data-mentioned-fn", "urtMentioned", { brands: Object.keys(next).join(",") });
    }

    /* ---------------- brand X mentioned (single cycle) ---------------- */
    /* Column header reads "<brand logo> mentioned?" — same treatment as urls-table. Without a
       logo the brand NAME has to carry the meaning, otherwise the header just says "mentioned?"
       with no clue what is meant. */
    function syncHeadBrand(){
      var logo = root.getAttribute("data-brand-logo") || "";
      var name = root.getAttribute("data-brand-name") || "";
      var th = root.querySelector(".up-th-mentioned");
      if (!th) return;
      /* Built here when absent instead of required from the markup: the CDN pin ships JS/CSS
         while the Bubble markup is a hand copy, so anything that lives only in markup silently
         stays on whichever version was pasted last. */
      var img = th.querySelector(".up-th-brandlogo");
      if (!img){
        img = document.createElement("img");
        img.className = "up-th-brandlogo"; img.alt = ""; img.style.display = "none";
        th.insertBefore(img, th.firstChild);
      }
      var lbl = th.querySelector(".up-th-mentlbl");
      if (!lbl){
        lbl = document.createElement("span");
        lbl.className = "up-th-mentlbl";
        lbl.textContent = (th.textContent || "Mentioned?").trim() || "Mentioned?";
        /* replace the bare text node the old markup had */
        Array.prototype.slice.call(th.childNodes).forEach(function(n){
          if (n.nodeType === 3) th.removeChild(n);
        });
        th.appendChild(lbl);
      }
      if (logo && logo !== "BRAND_LOGO"){ img.src = logo; img.style.display = "block"; }
      else { img.style.display = "none"; }
      lbl.textContent = (!logo || logo === "BRAND_LOGO") && name && name !== "BRAND_NAME"
        ? name + " mentioned?" : "Mentioned?";
    }
    function syncBrand(){
      syncHeadBrand();
      if (!elBrand) return;
      var name = root.getAttribute("data-brand-name") || "";
      var logo = root.getAttribute("data-brand-logo") || "";
      var valid = name && name !== "BRAND_NAME";
      var showsRows = state.hasData && !!(state.rows || []).length;
      elBrand.classList.toggle("is-visible", !!valid && state.hasData && (showsRows || !isBusy()));
      if (!valid) return;
      elBrandLbl.textContent = name + " mentioned";
      if (logo && logo !== "BRAND_LOGO"){ elBrandLogo.src = logo; elBrandLogo.style.display = "block"; }
      else { elBrandLogo.style.display = "none"; }
      elBrand.classList.toggle("is-yes", state.brandMentioned === "yes");
      elBrand.classList.toggle("is-no", state.brandMentioned === "no");
    }
    function cycleBrand(){
      state.brandMentioned = state.brandMentioned === "" ? "yes" : (state.brandMentioned === "yes" ? "no" : "");
      state.tablePage = 1; state.cardPage = 1; state.page = 1;
      state.softReload = false; dim.end();
      persist(); syncBrand(); renderPager();
      fire("data-brand-fn", "urtBrand", { brand_mentioned: state.brandMentioned });
    }

    /* ---------------- export ---------------- */
    function openExport(){
      var id = String(root.getAttribute("data-export-instance") || "").trim();
      var fn = window.upstreemExportOpen || (window.parent && window.parent.upstreemExportOpen) || (window.top && window.top.upstreemExportOpen);
      if (typeof fn !== "function"){
        console.warn("[responses-table] window.upstreemExportOpen not found — is the export popup component placed on this page?");
        return;
      }
      if (!id || id === "EXPORT_INSTANCE_ID"){
        console.warn("[responses-table] data-export-instance is not set.");
        return;
      }
      try { fn(id); } catch(e){}
    }

    /* ---------------- popovers ---------------- */
    var BTN_SEL = ".up-sort-btn, .up-cols-btn, .urt-fader-btn, .up-ment-btn";
    var MENU_SEL = ".up-sort-menu, .up-cols-menu, .urt-fader-menu, .up-ment-menu";
    function menuOf(pop){
      return pop === elSort ? elSortMenu
           : pop === elCols ? elColsMenu
           : pop === elFader ? elFaderMenu
           : pop === elMent ? elMentMenu
           : (pop && pop.querySelector(MENU_SEL));
    }
    var POP_GROUP = "urt-" + instanceId;
    [elSort, elCols, elFader, elMent].forEach(function(p){
      if (!p) return;
      p.__upPop = UC.makePopover({ wrap: p, menu: menuOf(p), opener: p.querySelector(BTN_SEL), group: POP_GROUP });
    });
    function popOf(pop){ return pop && pop.__upPop; }
    function setPopOpen(pop, open){ var h = popOf(pop); if (!h) return; if (open) h.open(); else h.close(false); }
    function closePops(except){
      [elSort, elCols, elFader, elMent].forEach(function(p){ if (p && p !== except) setPopOpen(p, false); });
    }

    /* ---------------- responsive ---------------- */
    var MIN_HEAD_GAP = 64;
    var SEARCH_OPEN_WIDTH = 202;
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
      syncSearchTakeover();
      fitToolbar();
      root.classList.toggle("is-narrow", w < 860);
      root.classList.toggle("is-vnarrow", w < 620);
      applyCols();
    }
    if (window.ResizeObserver){
      new ResizeObserver(function(){
        if (root.__urtRaf) return;
        root.__urtRaf = requestAnimationFrame(function(){ root.__urtRaf = null; applyResponsive(); });
      }).observe(root);
    }
    window.addEventListener("resize", UC.rafThrottle(applyResponsive));

    var _sticky = UC.makeSticky(root, elHead);
    function syncTheadOffset(){ _sticky.syncTheadOffset(); }
    window.addEventListener("resize", UC.rafThrottle(function(){ _sticky.applySticky(); }));
    _sticky.applySticky();

    var _tips = UC.makeTooltips(root, function(){ return isDark; });
    /* Full prompt on hover when the 2-line clamp cuts it off — same behaviour prompts-table has,
       now from the shared kit rather than a second copy of the logic. */
    UC.makeClipTip(root, _tips, ".urt-td-prompt", ".urt-prompt-text");
    UC.makeClipTip(root, _tips, ".urt-card-prompt");

    var sortKit = UC.makeHeadSort({ root: root, state: state, cycles: HEAD_CYCLE, defaultSort: DEFAULT_SORT, onSort: function(f, d){ applySort(f, d); } });
    var syncHeadSorters = sortKit.syncHeadSorters, headSortClick = sortKit.headSortClick;

    function render(){
      renderBody(); renderCount(); syncHeadSorters(); syncBrand(); syncFaderBadge(); syncColsBadge();
      renderPageSize(); renderPager(); applyCols(); syncMentLabel(); syncViewSwitch(); applyResponsive();
      if (root.classList.contains("up-sticky")) syncTheadOffset();
    }

    if (state.query){ elSearchIn.value = state.query; elSearch.classList.add("is-open", "has-text"); }
    populateSort(); populateCols(); populateMent(); populateFader(); render();

    /* ---------------- click delegation ---------------- */
    function ownsTarget(tg){
      return root.contains(tg) || (elSortMenu && elSortMenu.contains(tg)) || (elColsMenu && elColsMenu.contains(tg)) ||
        (elFaderMenu && elFaderMenu.contains(tg)) || (elMentMenu && elMentMenu.contains(tg));
    }
    document.addEventListener("click", function(e){
      if (!ownsTarget(e.target)) return;
      var inMenu = e.target.closest(".up-sort-menu, .up-cols-menu, .urt-fader-menu, .up-ment-menu");
      var onOpener = e.target.closest(".up-sort-btn, .up-cols-btn, .urt-fader-btn, .up-ment-btn");
      if (!inMenu && !onOpener) closePops();

      var vs = e.target.closest("[data-view]");
      if (vs){ swapView(vs.getAttribute("data-view")); return; }

      var ps = e.target.closest("[data-pagesize]");
      if (ps){ setPageSize(Number(ps.getAttribute("data-pagesize"))); return; }
      if (e.target.closest(".up-page-prev")){ goToPage(state.page - 1); return; }
      if (e.target.closest(".up-page-next")){ goToPage(state.page + 1); return; }
      var pg = e.target.closest("[data-page]");
      if (pg){ goToPage(Number(pg.getAttribute("data-page"))); return; }

      if (e.target.closest("[data-clearall]")){
        elSearchIn.value = ""; state.query = ""; elSearch.classList.remove("has-text");
        state.brandMentioned = ""; state.mentionSel = {}; state.mentionApplied = {};
        state.rankMin = RANK_MIN; state.rankMax = RANK_MAX; state.sentMin = SENT_MIN; state.sentMax = SENT_MAX;
        state.rankFilterActive = false; state.sentFilterActive = false;
        seedFaderDrafts();
        state.tablePage = 1; state.cardPage = 1; state.page = 1;
        state.softReload = false; dim.end();
        persist(); syncBrand(); syncMentLabel(); syncFaderBadge(); populateMent(); populateFader();
        search.cancel(); runSearch();
        fire("data-mentioned-fn", "urtMentioned", { brands: "" });
        fire("data-brand-fn", "urtBrand", { brand_mentioned: "" });
        fire("data-filter-fn", "urtFilter", { rank_min: RANK_MIN, rank_max: RANK_MAX, rank_active: false, sent_min: SENT_MIN, sent_max: SENT_MAX, sent_active: false });
        return;
      }

      if (e.target.closest(".up-search-clear")){
        if (root.classList.contains("is-searchtakeover")){ toggleSearch(); return; }
        elSearchIn.value = ""; state.query = ""; elSearch.classList.remove("has-text");
        persist(); search.cancel(); runSearch();
        try { elSearchIn.focus(); } catch(e2){}
        return;
      }
      if (e.target.closest(".up-export")){ openExport(); return; }
      if (e.target.closest(".up-search-btn")){ closePops(); toggleSearch(); return; }
      if (e.target.closest(".urt-brand-toggle")){ closePops(); cycleBrand(); return; }

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
        if (openM){ state.mentionSel = JSON.parse(JSON.stringify(state.mentionApplied)); mentQuery = ""; populateMent(); }
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
      var rhBtn = e.target.closest("[data-rowheight]");
      if (rhBtn){ setRowHeight(rhBtn.getAttribute("data-rowheight")); return; }
      if (e.target.closest("[data-colsall]")){ selectAllCols(); return; }
      var colRow = e.target.closest("[data-col]");
      if (colRow){ toggleCol(colRow.getAttribute("data-col")); return; }

      var faderBtn = e.target.closest(".urt-fader-btn");
      if (faderBtn){
        var openFd = !elFader.classList.contains("is-open");
        closePops(elFader);
        if (openFd){ seedFaderDrafts(); populateFader(); }
        setPopOpen(elFader, openFd);
        return;
      }
      /* Reset only rewinds the DRAFT and repaints — it does not commit. Same Apply-gate as
         dragging a handle, so a mis-click costs nothing until Apply. */
      if (e.target.closest("[data-faderreset]")){
        rankMinDraft = RANK_MIN; rankMaxDraft = RANK_MAX;
        sentMinDraft = SENT_MIN; sentMaxDraft = SENT_MAX;
        populateFader();
        return;
      }
      if (e.target.closest("[data-faderapply]")){ applyFader(); setPopOpen(elFader, false); return; }

      var sortBtn = e.target.closest(".up-sort-btn");
      if (sortBtn){
        var openS = !elSort.classList.contains("is-open");
        closePops(elSort);
        if (openS) populateSort();
        setPopOpen(elSort, openS);
        return;
      }
      var sf = e.target.closest("[data-sortfield]");
      if (sf){ applySort(sf.getAttribute("data-sortfield"), state.sortDir); return; }
      if (e.target.closest("[data-sortdir]")){ applySort(state.sortField, state.sortDir === "desc" ? "asc" : "desc"); return; }

      var th = e.target.closest(".up-th.is-sortable");
      if (th){ headSortClick(th.getAttribute("data-sortcol")); return; }

      var row = e.target.closest(".up-row, .urt-card");
      if (row){
        var d = row.getAttribute("data-run");
        if (d) fire("data-rowclick-fn", "urtRowClick", { prompt_run_id: d });
      }
    });

    root.addEventListener("keydown", function(e){
      if (e.key !== "Enter" && e.key !== " ") return;
      var row = e.target.closest && e.target.closest(".up-row, .urt-card");
      if (!row) return;
      e.preventDefault();
      var d = row.getAttribute("data-run");
      if (d) fire("data-rowclick-fn", "urtRowClick", { prompt_run_id: d });
    });

    if (elSearchIn){
      elSearchIn.addEventListener("input", onSearchInput);
      elSearchIn.addEventListener("keydown", function(e){
        if (e.key === "Escape"){ e.stopPropagation(); toggleSearch(); }
        if (e.key === "Enter"){ search.cancel(); if (state.query.length >= MIN || !state.query.length) runSearch(); }
      });
    }

    var lastProcAttr = String(root.getAttribute("data-processing") || "") + "|" + String(root.getAttribute("data-processing2") || "");
    var explicitOverride = false;
    function isBusy(){ return !!state.loading || !!state.extLoading; }
    var syncFromAttrs = function(){
      var wantDark = isYes(root.getAttribute("data-isdark"));
      var changed = false;
      if (wantDark !== isDark){
        isDark = wantDark;
        if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        changed = true;
      }
      var procAttr = String(root.getAttribute("data-processing") || "") + "|" + String(root.getAttribute("data-processing2") || "");
      if (procAttr !== lastProcAttr){ lastProcAttr = procAttr; explicitOverride = false; }
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

    return {
      root: root,
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          isDark = isYes(params.isDark);
          if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        }
        if (params.requestId != null && search.latestReqId() != null && String(params.requestId) !== String(search.latestReqId())) return;
        if (params.rows != null){ state.rows = Array.isArray(params.rows) ? params.rows : []; state.hasData = true; }
        if (params.totalCount != null) state.totalCount = toNum(params.totalCount);
        else if (state.rows.length && state.rows[0].total_count != null){
          /* The RPC carries the result-set total on every row (same shape prompts-table uses).
             Deriving it here means pagination works without the Run-JS step having to know to
             pull it out — getting that wrong left the pager stuck on one page. */
          state.totalCount = toNum(state.rows[0].total_count);
        }
        if (params.models != null){
          var _m = Array.isArray(params.models) ? params.models : [];
          if (_m.length) state.models = _m;
        }
        if (params.brands != null){
          var _b = Array.isArray(params.brands) ? params.brands : [];
          if (_b.length) state.brands = _b;
          populateMent();
        }
        if (params.brand_name != null) root.setAttribute("data-brand-name", String(params.brand_name));
        if (params.brand_logo != null) root.setAttribute("data-brand-logo", String(params.brand_logo));
        if (params.rows != null){ state.loading = false; state.softReload = false; dim.end(); }
        if (!explicitOverride && hasProcessingAttr()) state.extLoading = readProcessing();
        persist(); render();
      },
      setLoading: function(on){
        explicitOverride = true;
        LOADING_EXPLICIT[instanceId] = true;
        state.extLoading = isYes(on);
        if (!state.extLoading){ state.loading = false; state.softReload = false; dim.end(); }
        persist(); render();
      },
      reset: function(){
        state.query = ""; elSearchIn.value = ""; elSearch.classList.remove("is-open", "has-text");
        state.brandMentioned = ""; state.mentionSel = {}; state.mentionApplied = {};
        state.rankMin = RANK_MIN; state.rankMax = RANK_MAX; state.sentMin = SENT_MIN; state.sentMax = SENT_MAX;
        state.rankFilterActive = false; state.sentFilterActive = false;
        seedFaderDrafts();
        state.sortField = DEFAULT_SORT.field; state.sortDir = DEFAULT_SORT.dir;
        state.view = "table"; root.classList.remove("is-cards-view");
        state.tablePage = 1; state.tablePageSize = DEFAULT_PAGE_SIZE;
        state.cardPage = 1; state.cardPageSize = 12;
        state.page = 1; state.pageSize = DEFAULT_PAGE_SIZE;
        state.widths = {}; colsKit.writeWidths();
        state.softReload = false; dim.end();
        persist(); populateSort(); populateFader(); render();
        return true;
      },
      destroy: function(){
        if (root.__urtController === this) root.__urtController = null;
      }
    };
  }

  /* ================= init / multi-instance bootstrap ================= */
  function initRoot(root){
    if (root.__urtController) return root.__urtController;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;
    var ctrl = makeController(root);
    if (!ctrl) return null;
    root.__urtController = ctrl;
    return ctrl;
  }
  function resolve(id){
    var r = rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    if (r.length === 1) return initRoot(r[0]);
    for (var i = 0; i < r.length; i++){ try { if (r[i].offsetParent) return initRoot(r[i]); } catch(e){} }
    return initRoot(r[0]);
  }

  /* Bubble hands raw RPC text through, and that text is NOT valid JSON: a null column arrives as
     `"user_sentiment":,` (nothing between the colon and the comma), yes/no come through bare, and
     emoji/quotes inside text fields are unescaped. UC.parseBubbleJson is the ONE shared repair
     pass for all of that — JSON.parse (what this used to use for the setters) throws on every one
     of those cases. Anything that can arrive as a string from a Run-JS step goes through here. */
  function asList(v){
    var l = (typeof v === "string") ? UC.parseBubbleJson(v) : (Array.isArray(v) ? v : []);
    /* Holes/nulls survive when a caller hands us a raw array instead of a string (parseBubbleJson
       already strips them on its own path). Every consumer below does property access. */
    return l.filter(function(x){ return x != null; });
  }
  function doRender(params){
    var id = params && params.instanceId;
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".urt-root"));
    if (!ctrl) return false;
    if (params && params.rows != null) params.rows = asList(params.rows);
    ctrl.update(params);
    return true;
  }
  function doLoading(id, on){ var c = resolve(id); if (!c) return false; c.setLoading(on); return true; }
  function doReset(id){ var c = resolve(id); if (!c) return false; return c.reset(); }
  function doModels(id, models){
    var list = asList(models);
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".urt-root"));
    if (!ctrl) return false;
    /* an empty list is a failed/not-yet-loaded fetch, not "no models" — keep what we have */
    if (!list.length) return true;
    ctrl.update({ models: list });
    return true;
  }
  function doBrands(id, brands){
    var list = asList(brands);
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".urt-root"));
    if (!ctrl) return false;
    if (!list.length) return true;
    ctrl.update({ brands: list });
    return true;
  }

  var mount = UC.makeMount({
    rootClass: "urt-root", notPortal: true,
    ctrlProp: "__urtController", resolveLocal: "__urtResolveLocal", queue: "__urtBootQueue",
    initRoot: initRoot,
    api: {
      renderResponsesTable: doRender, setResponsesTableLoading: doLoading, resetResponsesTable: doReset,
      setResponsesTableModels: doModels, setResponsesTableBrands: doBrands
    },
    forwardShape: { renderResponsesTable: "params", resetResponsesTable: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end urtRun

  urtBoot(50);
})();
