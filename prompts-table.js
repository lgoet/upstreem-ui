/* upstreem prompts-table.js — component logic. Requires core.js (window.UpstreemCore) loaded first. */
(function(){
  "use strict";

  /* Bubble's own RunJS "kick" polling can call window.setPromptsTableLoading/renderPromptsTable
     before core.js has finished loading and uptRun() has assigned the real functions — without
     this, that call throws "is not a function" and is lost. Stub them as immediate, synchronous
     queueing functions right away; uptRun() drains the queue (in original order) once the real
     implementations are assigned. window.__uptBootStubbed guards against re-stubbing over a
     real implementation if this script tag executes more than once on the page. */
  var __uptBootQueue = window.__uptBootQueue = window.__uptBootQueue || [];
  if (!window.__uptBootStubbed){
    window.__uptBootStubbed = true;
    ["renderPromptsTable", "setPromptsTableLoading", "resetPromptsTable", "setPromptsTableTopics", "setPromptsTableBrands"].forEach(function(n){
      window[n] = function(){ __uptBootQueue.push([n, arguments]); };
    });
  }

  /* Bubble injects this component's <script> tags via jQuery .html(), which does not guarantee
     external scripts execute in DOM order — prompts-table.js can start running before core.js has
     finished loading. Retry briefly instead of bailing forever on the first check. Same
     pattern/reasoning as urls-table.js / domains-table.js. */
  function uptBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uptBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uptRun();
  }

  /* ==========================================================================================
     TOPICS WIDGET — verbatim from the existing "ust-cell" code component you already run inside
     Bubble repeating-group rows, with one adaptation: that version locates its own cell via
     document.currentScript.previousElementSibling from a trailing <script> tag. Rows here are
     built with innerHTML, and a <script> tag inserted that way never executes — so instead of
     the auto-locate tail, initTopicsCells() below calls the widget's init(cell) directly for
     every .ust-cell after each render. Everything else (styling, popup, layout, hover-reveal,
     theme) is unchanged, so it looks and behaves exactly like the version already live elsewhere.
     Deliberately NOT stored on the shared window.UstTopics name the older standalone widget uses:
     if that widget's script runs first on the same Bubble page, "if (window.UstTopics) return"
     used to silently skip installing THIS component's copy — including its hover-reveal CSS and
     the empty-state morph — since the two have since diverged (this one gained click-to-edit and
     the "-"/"+Add" hover morph the read-only widget never had). A component-private global can't
     collide with it, at the cost of a harmless duplicate <style>/popup div if both are present. */
  function installUstTopics(){
    if (window.__uptUstTopics) return;
    window.__uptUstTopics = (function(){
      var GAP = 8, theme = (window.__ustTheme === 'dark' ? 'dark' : 'light'), hideTimer = null;
      var registry = [];

      var style = document.createElement('style');
      style.id = 'ust-topics-style';
      style.textContent = [
        '.ust-cell{width:100%;height:100%;min-width:0;display:flex;align-items:center;background:transparent;border:0;overflow:hidden;font-family:Geist,Inter,system-ui,-apple-system,sans-serif;}',
        '.ust-cell *,.ust-topics-popup *{box-sizing:border-box;}',
        '.ust-row{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;width:100%;min-width:0;min-height:28px;overflow:hidden;}',
        '.ust-tag{height:28px;padding:0 10px;border-radius:8px;display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;border:1px solid color-mix(in srgb,var(--ust-tag-color,#6b7280) 40%,transparent);background:color-mix(in srgb,var(--ust-tag-color,#6b7280) 10%,transparent);color:var(--ust-tag-color,#4b5563);font-size:12px;line-height:1;font-weight:500;white-space:nowrap;cursor:pointer;user-select:none;}',
        '.ust-tag-emoji{font-size:12px;line-height:1;}',
        '.ust-tag-label{white-space:nowrap;}',
        '.ust-empty{display:inline-flex;align-items:center;color:#a0a5ad;font-size:13px;line-height:1;}',
        /* Dash shrinks/fades out, "+ Add" grows/fades in from width:0 — same idiom as the topic
           chip checkbox elsewhere in this file (a max-width transition, not display, since
           display can\'t be animated). Hover trigger lives on .upt-td-topics in prompts-table.css
           (the whole cell, not just this span, is the click/hover target — see the click handler
           that already fires uptTopicsClick from anywhere in the cell). */
        '.ust-empty-dash{display:inline-block;transition:opacity 140ms ease,max-width 180ms cubic-bezier(.2,0,.38,.9);}',
        '.ust-empty-add{display:inline-flex;align-items:center;gap:3px;max-width:0;opacity:0;overflow:hidden;white-space:nowrap;transition:max-width 180ms cubic-bezier(.2,0,.38,.9),opacity 140ms ease,margin-left 180ms cubic-bezier(.2,0,.38,.9);}',
        '.up-root:not(.is-inactive-view) .upt-td-topics:hover .ust-empty{color:var(--vc-text,#1f1f1b);}',
        '.up-root:not(.is-inactive-view) .upt-td-topics:hover .ust-empty-dash{opacity:0;max-width:0;}',
        '.up-root:not(.is-inactive-view) .upt-td-topics:hover .ust-empty-add{max-width:50px;opacity:1;margin-left:4px;}',
        '.ust-more{height:28px;padding:0 10px;border-radius:8px;display:inline-flex;align-items:center;flex:0 0 auto;border:0;background:#f5f5f5;color:var(--ust-more-color,#5f646d);font-size:12px;line-height:1;font-weight:600;white-space:nowrap;cursor:pointer;user-select:none;}',
        '.ust-cell{--ust-more-border:#d9dde3;--ust-more-color:#5f646d;}',
        '.ust-cell .ust-more:hover{background:#ececec;color:#1f1f1b;}',
        '.ust-cell[data-theme="dark"] .ust-tag{background:color-mix(in srgb,var(--ust-tag-color,#6b7280) 22%,transparent);color:#e0e0e0;}',
        '.ust-cell[data-theme="dark"] .ust-empty{color:#555;}',
        '.ust-cell[data-theme="dark"]{--ust-more-color:#a0a0a0;}',
        '.ust-cell[data-theme="dark"] .ust-more{background:rgba(42,42,42,0.6);}',
        '.ust-cell[data-theme="dark"] .ust-more:hover{background:rgba(42,42,42,0.85);color:#e0e0e0;}',
        '.ust-topics-popup{position:fixed;z-index:2147483000;display:none;pointer-events:none;max-width:320px;padding:10px;border:1px solid #d9dde3;border-radius:12px;background:#fff;box-shadow:0 14px 34px rgba(0,0,0,0.14);font-family:Geist,Inter,system-ui,-apple-system,sans-serif;}',
        '.ust-topics-popup .ust-popup-inner{display:flex;flex-wrap:wrap;gap:8px;}',
        /* Border brightened vs. the plain --vc-border dark value (#353535) — against this popup's
           #151515 background that reads as barely-there/blurry. Same #454545 fix already applied
           to the sort/columns/mentioned/filter dropdowns in core.css; this popup is a separate,
           hardcoded-color widget (not built on --vc-border) so it needs its own copy of the fix. */
        '.ust-topics-popup[data-theme="dark"]{background:#151515;border-color:#454545;box-shadow:0 14px 34px rgba(0,0,0,0.6);}',
        '.ust-topics-popup[data-theme="dark"] .ust-tag{background:color-mix(in srgb,var(--ust-tag-color,#6b7280) 22%,transparent);color:#e0e0e0;}'
      ].join('');
      document.head.appendChild(style);

      var popup = document.createElement('div');
      popup.className = 'ust-topics-popup';
      document.body.appendChild(popup);

      function esc(v){ var d=document.createElement('div'); d.textContent=String(v==null?'':v); return d.innerHTML; }
      function normHex(h){ h=String(h||'#6b7280').trim(); return h.charAt(0)==='#'?h:'#'+h; }
      function normTag(t){
        if(!t||typeof t!=='object') return null;
        var name=String(t.name||t.tag_name||'').trim(); if(!name) return null;
        var hex=t.hex_light||t.hex_dark||'#6b7280';
        return { id:t.id||t.tag_id||null, name:name, emoji:t.emoji?String(t.emoji):'', color:normHex(hex) };
      }
      function tagHtml(t){
        return '<span class="ust-tag up-chiphover" style="--ust-tag-color:'+esc(t.color)+';">'+(t.emoji?'<span class="ust-tag-emoji">'+esc(t.emoji)+'</span>':'')+'<span class="ust-tag-label">'+esc(t.name)+'</span></span>';
      }

      function layout(st){
        var row=st.row, more=st.moreEl, tags=st.tagEls, n=tags.length;
        if(!row.isConnected) return;
        var avail=row.clientWidth; if(avail<=0||!n) return;
        for(var k=0;k<n;k++) tags[k].style.display='';
        more.style.display='none';
        var w=[]; for(var i=0;i<n;i++) w[i]=tags[i].offsetWidth;
        var total=0; for(var j=0;j<n;j++) total+=w[j]+(j>0?GAP:0);
        if(total<=avail) return;
        more.textContent='+'+n; more.style.display='';
        var budget=avail-more.offsetWidth-GAP, used=0, shown=0;
        for(var x=0;x<n;x++){
          var add=(shown>0?GAP:0)+w[x];
          if(used+add<=budget){ used+=add; tags[x].style.display=''; shown++; }
          else { for(var y=x;y<n;y++) tags[y].style.display='none'; break; }
        }
        var hidden=n-shown;
        if(hidden<=0) more.style.display='none'; else more.textContent='+'+hidden;
      }

      function showPopup(st){
        clearTimeout(hideTimer);
        popup.innerHTML='<div class="ust-popup-inner">'+st.tags.map(tagHtml).join('')+'</div>';
        popup.setAttribute('data-theme', st.cell.getAttribute('data-theme')||theme);
        popup.style.display='block'; popup.style.visibility='hidden';
        var pr=popup.getBoundingClientRect(), mr=st.moreEl.getBoundingClientRect();
        var m=6, vw=window.innerWidth, vh=window.innerHeight;
        var top=mr.bottom+m; if(top+pr.height>vh-8) top=mr.top-pr.height-m; if(top<8) top=8;
        var left=mr.left; if(left+pr.width>vw-8) left=vw-8-pr.width; if(left<8) left=8;
        popup.style.top=top+'px'; popup.style.left=left+'px'; popup.style.visibility='visible';
      }
      function hidePopup(){ hideTimer=setTimeout(function(){ popup.style.display='none'; },80); }

      function fireOpen(st, tagId){
        var payload={ prompt_id:st.promptId, tag_id:tagId||null, tags:st.tags };
        var json=JSON.stringify(payload);
        if(typeof window.bubble_fn_openTags==='function') window.bubble_fn_openTags(json);
        else { window.dispatchEvent(new CustomEvent('upstreem:open-tags',{detail:payload})); console.log('open_tags', payload); }
      }

      var ro = (typeof ResizeObserver!=='undefined') ? new ResizeObserver(function(entries){
        for(var i=0;i<entries.length;i++){
          var el=entries[i].target;
          if(!el.isConnected){ ro.unobserve(el); continue; }
          if(el.__ustState) layout(el.__ustState);
        }
      }) : null;

      var rTimer=null;
      window.addEventListener('resize', function(){
        clearTimeout(rTimer);
        rTimer=setTimeout(function(){
          registry=registry.filter(function(st){ return st.cell.isConnected; });
          registry.forEach(layout);
        },120);
      });

      function init(cell){
        cell.__ustInit=true; cell.classList.add('ust-ready');
        if(!cell.hasAttribute('data-theme')) cell.setAttribute('data-theme', theme);
        var jsonEl=cell.querySelector('.ust-json'), row=cell.querySelector('.ust-row');
        var raw=[]; try{ raw=JSON.parse((jsonEl?jsonEl.textContent:'').trim()||'[]'); }catch(e){ raw=[]; }
        var tags=(Array.isArray(raw)?raw:[]).map(normTag).filter(Boolean);
        var st={ cell:cell, row:row, tags:tags, tagEls:[], moreEl:null, promptId:cell.getAttribute('data-prompt-id')||null };

        row.innerHTML='';
        if(!tags.length){
          row.innerHTML='<span class="ust-empty"><span class="ust-empty-dash">—</span>' +
            '<span class="ust-empty-add"><span>+</span><span>Add</span></span></span>';
          return;
        }

        tags.forEach(function(t){
          var el=document.createElement('span');
          el.className='ust-tag up-chiphover'; el.style.setProperty('--ust-tag-color', t.color);
          el.innerHTML=(t.emoji?'<span class="ust-tag-emoji">'+esc(t.emoji)+'</span>':'')+'<span class="ust-tag-label">'+esc(t.name)+'</span>';

          row.appendChild(el); st.tagEls.push(el);
        });
        var more=document.createElement('span');
        more.className='ust-more'; more.style.display='none';

        more.addEventListener('mouseenter', function(){ showPopup(st); });
        more.addEventListener('mouseleave', hidePopup);
        row.appendChild(more); st.moreEl=more;

        cell.__ustState=st; row.__ustState=st; registry.push(st);
        if(ro) ro.observe(row); layout(st);
      }

      function setTheme(t){
        theme=(String(t||'').toLowerCase()==='dark')?'dark':'light';
        window.__ustTheme = theme;
        document.querySelectorAll('.ust-cell').forEach(function(c){ c.setAttribute('data-theme', theme); });
        popup.setAttribute('data-theme', theme);
      }

      return { init:init, setTheme:setTheme };
    })();
  }

  function uptRun(){
  var UC = window.UpstreemCore;
  var MONTHS = UC.MONTHS, DEBOUNCE = UC.DEBOUNCE, MIN = UC.MIN, SORT_DEBOUNCE = UC.SORT_DEBOUNCE,
      PAGE_SIZES = UC.PAGE_SIZES, DEFAULT_PAGE_SIZE = UC.DEFAULT_PAGE_SIZE,
      isYes = UC.isYes, highlight = UC.highlight, esc = UC.esc, toNum = UC.toNum, fmt1 = UC.fmt1,
      fmtDate = UC.fmtDate, foldDiacritics = UC.foldDiacritics, germanExpand = UC.germanExpand,
      resolveBubbleFn = UC.resolveBubbleFn, CHECK_SVG = UC.CHECK_SVG, GOTO_SVG = UC.GOTO_SVG,
      /* Falls back to an inline copy rather than throwing if an older/mismatched core.js on the
         page (e.g. another component pinned to a different commit having last overwritten
         window.UpstreemCore) doesn't have this export yet — a missing icon shouldn't take down
         the whole table. */
      HASH_ICON = (UC.HASH_ICON || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>').replace('<svg ', '<svg class="up-hash" ');

  installUstTopics();

  /* Own store, deliberately NOT shared with any other component's persisted state (see
     domains-table.js for the same reasoning) — window.__uutStore is urls-table-specific despite
     living in the "shared" core.js file. */
  var STORE = (window.__uptStore = window.__uptStore || {});
  var LOADING_EXPLICIT = (window.__uptLoadingExplicit = window.__uptLoadingExplicit || {});

  /* Hideable columns. Prompt is deliberately absent — the table makes no sense without it. */
  var COLUMNS = [
    /* Visibility/Sentiment carry more header furniture now (logo/info-icon/sorter) than a plain
       label — a %-based responsive floor let them shrink below what that furniture needs at
       narrow widths, so both use a px floor instead, matching Rank's own min. */
    /* `prio` = survival order when the table is too narrow to show everything (higher survives
       longer, see UC.makeColumns' autoFit). Deliberately NOT the same as left-to-right order:
       Topics outranks Rank and Sentiment because it is the column this table is actually managed
       by, while Market/Created are reference data you can live without on a laptop screen. */
    { key: "visibility", label: "Visibility",      w: "minmax(150px, 1fr)", min: 150, prio: 70 },
    { key: "rank",       label: "Rank",            w: "minmax(90px, 1fr)",  min: 90,  dropAt: "vnarrow", prio: 40 },
    { key: "sentiment",  label: "Sentiment",       w: "minmax(120px, 1fr)", min: 120, dropAt: "narrow",  prio: 30 },
    /* 178px, same as urls-table's identical column: 4 × 32px avatars (−6px overlap each) plus
       the "+N" label plus the cell's own 28px padding, with headroom for the hover spread.
       A %-based floor let it collapse below that and clipped the stack. */
    /* No dropAt was a real bug, not a deliberate "always show" — every other column has one, and
       leaving this the sole exception meant the narrowest tier still showed Prompt + Visibility
       + Brand Mentions instead of just the two columns that are supposed to survive down there. */
    { key: "brands",     label: "Brand Mentions",  w: "minmax(178px, 1fr)", min: 178, dropAt: "vnarrow", prio: 50 },
    /* Market's growth ceiling (the fr half of minmax) is deliberately smaller than Topics' — this
       is the column people actually manage, Market is reference data that never needs to eat
       spare row width. The floors (150/90 px, 12%/8%) are untouched; only the fr split moved,
       0.3 from Market's ceiling straight onto Topics'. */
    { key: "topics",     label: "Topics",          w: "minmax(12%, 1.3fr)", min: 150, dropAt: "vnarrow", prio: 60 },
    { key: "market",     label: "Market",          w: "minmax(8%, 0.3fr)", min: 90,  dropAt: "narrow",  prio: 20 },
    { key: "created",    label: "Created",         w: "minmax(10%, 0.7fr)",min: 110, dropAt: "narrow",  prio: 10 }
  ];
  var ROW_HEIGHTS = [
    { key: "default", label: "Default", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>' },
    { key: "compact", label: "Compact", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>' },
    { key: "dynamic", label: "Dynamic", icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 8 12 3 17 8"/><polyline points="7 16 12 21 17 16"/></svg>' }
  ];

  var SORT_FIELDS = [
    { key: "prompt",     label: "Prompt" },
    { key: "visibility", label: "Visibility" },
    { key: "rank",       label: "Rank" },
    { key: "sentiment",  label: "Sentiment" },
    { key: "created",    label: "Created" }
  ];
  /* The tokens the RPC expects. The table thinks in field+direction because the header cycle
     needs both; only the outgoing `order` value is collapsed into one of these. Note the two
     names that deliberately differ from the column key: the prompt column sorts on `name_*` and
     Created on `created_at_*`. */
  var ORDER = {
    "prompt:asc": "name_asc",             "prompt:desc": "name_desc",
    "visibility:desc": "visibility_desc", "visibility:asc": "visibility_asc",
    "rank:asc": "rank_asc",               "rank:desc": "rank_desc",
    "sentiment:desc": "sentiment_desc",   "sentiment:asc": "sentiment_asc",
    "created:desc": "created_at_desc",    "created:asc": "created_at_asc"
  };
  function orderValue(field, dir){ return ORDER[field + ":" + dir] || "visibility_desc"; }
  /* First click per column goes the way people actually want it: highest first for the two
     "more is better" metrics, LOWEST first for Rank (1 is the best rank), A-Z for the text
     column, newest first for a date. */
  var HEAD_CYCLE = {
    prompt:     ["prompt:asc", "prompt:desc"],
    visibility: ["visibility:desc", "visibility:asc"],
    rank:       ["rank:asc", "rank:desc"],
    sentiment:  ["sentiment:desc", "sentiment:asc"],
    created:    ["created:desc", "created:asc"]
  };
  /* There is no unsorted state — the table always carries a sort, and Visibility desc is it. */
  var DEFAULT_SORT = { field: "visibility", dir: "desc" };

  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var saved = STORE[instanceId] || {};

    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
    if (window.__uptUstTopics) window.__uptUstTopics.setTheme(isDark ? "dark" : "light");

    var elHeadCount = root.querySelector(".up-head-count");
    var elTbody     = root.querySelector(".up-tbody");
    var elSearch    = root.querySelector(".up-search");
    var elSearchIn  = root.querySelector(".up-search-input");
    var elBrand     = root.querySelector(".upt-brand-toggle");
    var elBrandLogo = root.querySelector(".upt-brand-logo");
    var elBrandLbl  = root.querySelector(".upt-brand-label");
    var elSort      = root.querySelector(".up-sort");
    var elSortMenu  = root.querySelector(".up-sort-menu");
    var elHeading   = root.querySelector(".up-heading");
    var elHeadTools = root.querySelector(".up-head-tools");
    var elHead      = root.querySelector(".up-head");
    var elPager     = root.querySelector(".up-pager");
    var elCols      = root.querySelector(".up-cols");
    var elColsMenu  = root.querySelector(".up-cols-menu");

    /* Mentioned-brands multi-select — built from JS the same reason the header explainer icons
       are: the markup is a hand copy the CDN pin never touches, and this table simply never had
       the widget urls-table/responses-table already have. Same core classes (.up-ment/.up-ment-
       menu/.up-filter-item, all already styled), inserted right after the brand toggle — same
       toolbar position responses-table uses. */
    (function(){
      if (root.querySelector(".up-ment") || !elHeadTools) return;
      var wrap = document.createElement("div");
      wrap.className = "up-ment";
      wrap.innerHTML =
        '<button class="up-ment-btn" type="button" aria-haspopup="menu" aria-expanded="false">' +
          '<span class="up-ment-lbl">All Brands</span>' +
          '<svg class="up-ment-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
          '<svg class="up-ment-clear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '<div class="up-ment-menu" role="menu" aria-hidden="true"></div>';
      var beforeEl = elSort || elHeadTools.firstElementChild;
      if (beforeEl) elHeadTools.insertBefore(wrap, beforeEl); else elHeadTools.appendChild(wrap);
    })();
    var elMent      = root.querySelector(".up-ment");
    var elMentMenu  = root.querySelector(".up-ment-menu");
    var elMentLbl   = root.querySelector(".up-ment-lbl");
    var mentQuery = "";
    if (elMentMenu) elMentMenu.addEventListener("input", function(e){
      if (e.target && e.target.classList && e.target.classList.contains("up-ment-search")) applyMentFilter();
    });

    function rhKey(){ return "upt_rowheight__" + instanceId; }
    function readRowHeight(){
      try {
        var v = window.localStorage.getItem(rhKey());
        return (v === "compact" || v === "dynamic") ? v : "default";
      } catch(e){ return "default"; }
    }
    function writeRowHeight(){ try { window.localStorage.setItem(rhKey(), state.rowHeight); } catch(e){} }

    var state = {
      rows: [],
      totalCount: null,
      hasData: false,
      loading: false,                       // intern (Suche/Pagination/Sort), startet immer frei
      /* true = the pending reload only reorders/re-windows the SAME result set (sort, paging),
         so the rows already on screen stay valid and merely dim. false = the result set itself
         is changing (search, filter, brand toggle) and the rows must go back to a skeleton.
         Deliberately NOT persisted: a rebuilt element has no rows to keep, so it starts hard. */
      softReload: false,
      extLoading: hasProcessingAttr() ? readProcessing()
             : (LOADING_EXPLICIT[instanceId] ? !!saved.loading : false),
      query: saved.query || "",
      sortField: saved.sortField || DEFAULT_SORT.field,
      sortDir: saved.sortDir || DEFAULT_SORT.dir,
      pageSize: saved.pageSize || DEFAULT_PAGE_SIZE,
      page: saved.page || 1,
      cols: {},                             // filled from colsKit.readCols() below
      widths: {},                           // filled from colsKit.readWidths() below
      rowHeight: readRowHeight(),
      selected: saved.selected || {},       // prompt_id -> true, persisted across pages
      brandMentioned: saved.brandMentioned || "",
      brands: saved.brands || [],                             // full tracked-brand list, fed in once via setPromptsTableBrands
      mentionSel: saved.mentionSel || {}, mentionApplied: saved.mentionApplied || {}, // mentioned-brands multi-select filter
      /* Active vs Inactive is a VIEW, not a filter: the two are mutually exclusive and the
         column set differs (Inactive has no Brand Mentions). Hence a segmented control on the
         left rather than another dropdown in the filter area on the right. */
      status: saved.status === "inactive" ? "inactive" : "active",
      totalCountInactive: null,             // optional; tab renders without a count until it arrives
      /* true once the user takes the "select all N matching" escape hatch. Deliberately a FLAG,
         never a materialised id list: the set can be far larger than one page, the ids would
         blow up the payload, and they'd go stale against rows that changed since. Any change to
         the query invalidates it (see invalidateSelectAll). */
      selectAllMatching: false,
      topics: saved.topics || [],           // full topic list for the bulk editor, filled once
      stagedTopicIds: null                  // {id: true, ...} — the topic editor's draft selection
    };
    /* On a touch device a clamped prompt is unreadable, full stop: the full text is only ever
       reachable through the hover tooltip, and core.css switches tooltips off entirely under
       (hover: none). So on touch the row height falls back to Dynamic — the row grows to fit the
       prompt instead of hiding it behind an interaction that device cannot perform.
       This is an override, NOT a write: state.rowHeight and the saved preference are untouched, so
       the same user on a desktop still gets whatever they picked, and the switch in the Table
       Settings menu still reflects their real choice rather than silently reading "Dynamic". */
    var TOUCH_ONLY = (function(){
      try { return window.matchMedia && window.matchMedia("(hover: none)").matches; }
      catch(e){ return false; }
    })();
    function effectiveRowHeight(){ return TOUCH_ONLY ? "dynamic" : state.rowHeight; }
    function applyRowHeightClass(){
      var rh = effectiveRowHeight();
      root.classList.remove("is-rh-compact", "is-rh-dynamic");
      if (rh === "compact") root.classList.add("is-rh-compact");
      else if (rh === "dynamic") root.classList.add("is-rh-dynamic");
    }
    applyRowHeightClass();

    function usableAttr(v, placeholder){
      return v != null && v !== "" && v !== placeholder;
    }
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
        pageSize: state.pageSize, page: state.page,
        selected: state.selected, brandMentioned: state.brandMentioned,
        brands: state.brands, mentionSel: state.mentionSel, mentionApplied: state.mentionApplied,
        status: state.status, topics: state.topics
      };
    }
    /* shared event dispatch (core) */
    var fire = UC.makeFire(root, { label: "prompts-table", eventPrefix: "upt-" });

    /* Same shared modal topics-manager's own "+ New Topic" uses (UC.makeTopicModal, core.js) —
       "Add Topic" in the bulk editor used to just hand off to "your own topic-creation UI" via a
       bare uptAddTopics fire; now it opens this instead and folds the modal's clean
       {name,emoji,hex_light,hex_dark} draft into the SAME new_topic_* shape the inline
       "Create '…'" row (topicCreateHtml(), below) already produces — same event, same fields, no
       Bubble-side change needed for either path. Create-only: no onDelete, so the modal never
       shows a Delete button (it also only ever gets opened with mode "create" here). */
    var addTopicModal = UC.makeTopicModal({
      getIsDark: function(){ return isDark; },
      onSave: function(payload){
        var p = selectionPayload();
        p.new_topic_name = payload.name;
        p.new_topic_emoji = payload.emoji || "";
        p.new_topic_hex_light = payload.hex_light;
        p.new_topic_hex_dark = payload.hex_dark;
        fire("data-addtopics-fn", "uptAddTopics", p);
        /* Same stale-query trap as the inline create row below: the bulk panel's search box can
           still be holding a non-matching query from before this modal was opened, which would
           filter the freshly-updated topics list down to nothing once it lands. */
        if (elBulk){
          topicQuery = "";
          var mInp = elBulk.querySelector(".upt-topicsearch-in");
          if (mInp) mInp.value = "";
          var mHead = elBulk.querySelector(".upt-topichead");
          if (mHead) mHead.classList.remove("has-text");
        }
        addTopicModal.close();
      }
    });

    /* ---------------- soft-reload dimming (core) ----------------
       Shared with urls-table/domains-table now that both need the identical thing for their own
       sort — see UC.makeSoftReload. Only sort uses it; a page/size change goes back to whatever
       isBusy() drives normally (skeleton or nothing), it does not dim. */
    var _dim = UC.makeSoftReload(root);
    function beginSoftReload(){ _dim.begin(state.hasData && !!(state.rows || []).length); }
    function endSoftReload(){ _dim.end(); }

    var MOBILE_SEARCH_MAX = 640;
    var search = UC.makeSearch({
      root: root, box: elSearch, input: elSearchIn, state: state,
      mobileMax: MOBILE_SEARCH_MAX, prefix: "upt",
      onRender: function(){ renderTable(); renderPager(); },
      onFire: function(payload){ state.softReload = false; endSoftReload(); invalidateSelectAll(); fire("data-search-fn", "uptSearch", payload); },
      persist: function(){ persist(); }
    });
    function runSearch(){ search.run(); }
    function toggleSearch(){ search.toggle(); }
    function onSearchInput(){ search.onInput(); }

    /* ---------------- brand mentioned (quick toggle) ----------------
       Same off -> yes -> no -> off cycle as urls-table/domains-table. Visible only once
       data-brand-name is actually filled in (Bubble's placeholder text otherwise shows through). */
    function syncBrand(){
      var name = root.getAttribute("data-brand-name") || "";
      var logo = root.getAttribute("data-brand-logo") || "";
      var valid = name && name !== "BRAND_NAME";
      var hasLogo = valid && logo && logo !== "BRAND_LOGO";
      /* Visibility column header carries the tracked brand's logo — every metric in this table
         (Visibility/Rank/Sentiment) is about THIS brand's performance on the prompt, so naming it
         once in the header reads better than repeating it per row. */
      var headLogo = root.querySelector(".upt-th-brandlogo");
      if (headLogo){ if (hasLogo){ headLogo.src = logo; headLogo.style.display = "block"; } else { headLogo.style.display = "none"; } }
      if (!elBrand) return;
      /* Gated on the DATA, not just the attribute: Bubble can set data-brand-name long before the
         first row payload lands. Two separate conditions, both needed:
           hasData  — nothing has ever arrived, so there is nothing to filter yet.
           rows on screen while busy — a reload that still has its old rows keeps the toggle put
             (re-hiding it on every loading=yes made it flicker out on each reload), but a reload
             showing nothing but skeleton must not offer a filter over an empty table. */
      var showsRows = state.hasData && !!(state.rows || []).length;
      elBrand.classList.toggle("is-visible", !!valid && state.hasData && (showsRows || !isBusy()));
      if (!valid) return;
      elBrandLbl.textContent = name + " mentioned";
      if (hasLogo){ elBrandLogo.src = logo; elBrandLogo.style.display = "block"; }
      else { elBrandLogo.style.display = "none"; }
      elBrand.classList.toggle("is-yes", state.brandMentioned === "yes");
      elBrand.classList.toggle("is-no", state.brandMentioned === "no");
    }
    function cycleBrand(){
      state.brandMentioned = state.brandMentioned === "" ? "yes" : (state.brandMentioned === "yes" ? "no" : "");
      state.page = 1;
      persist(); syncBrand(); renderPager();
      state.softReload = false; endSoftReload(); invalidateSelectAll();
      fire("data-brand-fn", "uptBrand", { brand_mentioned: state.brandMentioned });
    }

    /* ---------------- mentioned brands (multi-select) — same pattern as urls-table/responses-table,
       same core classes (.up-ment/.up-filter-item), fed in via setPromptsTableBrands (below). ---- */
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
    }
    function submitMent(){
      var next = {};
      Object.keys(state.mentionSel).forEach(function(k){ if (state.mentionSel[k]) next[k] = true; });
      var before = Object.keys(state.mentionApplied).filter(function(k){ return state.mentionApplied[k]; }).sort().join(",");
      var after = Object.keys(next).sort().join(",");
      if (after === before){ persist(); return; }
      state.mentionApplied = next;
      state.page = 1;
      search.setLatest(null);
      state.softReload = false; endSoftReload(); invalidateSelectAll();
      persist(); syncMentLabel(); renderPager();
      fire("data-mentioned-fn", "uptMentioned", { brands: Object.keys(next).join(",") });
    }

    /* ---------------- selection ---------------- */
    function selectedIds(){ return Object.keys(state.selected).filter(function(k){ return state.selected[k]; }); }
    function fireSelect(){
      var p = selectionPayload();
      /* "selected" is the field the original contract documented; keep sending it for the id
         case so existing workflows don't break, alongside the newer mode/ids pair. */
      if (p.mode === "ids") p.selected = p.ids;
      fire("data-select-fn", "uptSelect", p);
    }
    function toggleSelectRow(id){
      /* A manual tick while "select all N matching" is active can't be expressed by that flag
         (it means "all of them except this one", which isn't a filter predicate) — so it drops
         back to an explicit id-based selection instead of silently keeping the stale N. */
      if (state.selectAllMatching) invalidateSelectAll();
      if (state.selected[id]) delete state.selected[id]; else state.selected[id] = true;
      persist(); syncRowChecks(); syncSelectAll(); fireSelect(); syncStagedTopicsToSelection();
    }
    function toggleSelectAll(){
      var rows = state.rows || [];
      if (!rows.length) return;
      var allSel = rows.every(function(r){ return state.selected[String(r.prompt_id)]; });
      if (allSel){
        /* Deselect always clears EVERYTHING, not just this page's rows — otherwise paging
           through, ticking "select all" on each page, then unticking on the last page silently
           stranded earlier pages' selections (or, with "Select all N matching" active, left
           state.selectAllMatching stuck true — every checkbox visually clears but the bulk bar
           keeps showing the full N count). One button, one unambiguous "all" both directions. */
        state.selected = {}; invalidateSelectAll();
      } else {
        rows.forEach(function(r){ state.selected[String(r.prompt_id)] = true; });
      }
      persist(); renderTable(); syncSelectAll(); fireSelect(); syncStagedTopicsToSelection();
    }
    /* Updates the checkboxes in place instead of re-rendering the table.
       renderTable() replaces elTbody.innerHTML wholesale, which recreates every <img> in every
       row — the brand logos then visibly flash while they re-decode. urls-table already learned
       this with its brand list ("rebuilding made every row flash for a frame"). */
    function syncRowChecks(){
      Array.prototype.forEach.call(elTbody.querySelectorAll("[data-select]"), function(b){
        var on = state.selectAllMatching || !!state.selected[b.getAttribute("data-select")];
        b.classList.toggle("is-checked", on);
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.innerHTML = on ? CHECK_SVG : "";
        var row = b.closest(".up-row");
        if (row) row.classList.toggle("is-selected", on);
      });
    }
    /* Same idea for the Topics column after a bulk topic change: only those cells changed. */
    function syncTopicCells(){
      Array.prototype.forEach.call(elTbody.querySelectorAll(".up-row"), function(row){
        var id = row.getAttribute("data-id");
        var cell = row.querySelector(".upt-td-topics");
        var r = (state.rows || []).filter(function(x){ return String(x.prompt_id) === id; })[0];
        if (!r || !cell) return;
        cell.innerHTML = topicsCell(id, r.tags);
        var c = cell.querySelector(".ust-cell");
        if (c && window.__uptUstTopics) window.__uptUstTopics.init(c);
      });
    }
    function clearSelection(){
      if (!selectedIds().length && !state.selectAllMatching) return;
      state.selected = {}; invalidateSelectAll();
      persist(); syncRowChecks(); syncSelectAll(); fireSelect(); syncStagedTopicsToSelection();
    }
    /* Counts the WHOLE selection, not just this page's — state.selected deliberately survives
       paging/sorting, so a user who selected rows on page 1 and paged on still sees them counted. */
    function syncSelCount(){
      var el = root.querySelector(".upt-selcount");
      if (!el) return;
      var n = selectedIds().length;
      el.classList.toggle("is-on", n > 0);
      /* Only ever written while there IS a selection: the chip fades out over ~200ms, and
         rewriting it to "0 selected" first meant you watched the number drop to zero before it
         disappeared. It keeps its last real count all the way out. */
      if (n > 0){
        var nEl = el.querySelector(".upt-selcount-n");
        if (nEl) nEl.textContent = n === 1 ? "1 selected" : (n + " selected");
      }
    }
    function syncSelectAll(){
      var box = root.querySelector("[data-selectall]");
      if (!box) return;
      var rows = state.rows || [];
      var total = rows.length;
      var sel = state.selectAllMatching ? total : rows.filter(function(r){ return state.selected[String(r.prompt_id)]; }).length;
      var all = total > 0 && sel === total;
      var some = sel > 0 && sel < total;
      box.classList.toggle("is-checked", all);
      box.classList.toggle("is-indeterminate", some);
      box.setAttribute("aria-checked", all ? "true" : (some ? "mixed" : "false"));
      box.innerHTML = all ? CHECK_SVG : "";
      syncSelCount();
      syncBulkBarCount();
    }

    /* ---------------- status view: Active / Inactive ----------------
       A view switch, not a filter — see state.status. The Inactive view drops Brand Mentions via
       a class on the root rather than by editing the column config, so it can't collide with the
       user's own saved column preferences. */
    function renderStatusTabs(){
      var el = root.querySelector(".upt-status");
      if (!el) return;
      var counts = { active: state.totalCount, inactive: state.totalCountInactive };
      el.innerHTML = [["active","Active"],["inactive","Inactive"]].map(function(p){
        var n = counts[p[0]];
        /* Only the tab you are NOT on carries a count: the current view's total is already
           shown next to the heading two elements to the left, and repeating it there just
           makes the eye check whether the two numbers agree.
           Both buttons stay fit-width — an earlier attempt kept the span in the markup and only
           hid it, to stop the switcher resizing on a tab change. That reserved a number's worth
           of empty space inside the active button and read as broken, which is worse than the
           resize it was avoiding. Fit-width wins.
           No count at all until the server sends one — total_count_inactive isn't in the
           payload yet, and "Inactive 0" would be a claim we can't back up. */
        var cnt = (p[0] === state.status || n == null || n === "")
          ? "" : '<span class="upt-status-n">' + UC.fmtTotal(n) + '</span>';
        return '<button class="upt-status-btn' + (state.status === p[0] ? " is-active" : "") +
               '" type="button" data-status="' + p[0] + '">' + p[1] + cnt + '</button>';
      }).join("");
      root.classList.toggle("is-inactive-view", state.status === "inactive");
    }
    function setStatus(next){
      if (next !== "active" && next !== "inactive") return;
      if (state.status === next) return;
      state.status = next;
      state.page = 1;
      /* A different record set entirely: keeping ids selected across the switch would let a bulk
         action hit prompts the user can no longer see. */
      state.selected = {}; invalidateSelectAll();
      state.softReload = false; endSoftReload();   // the result set changes -> skeleton, not dim
      persist(); renderStatusTabs(); render();
      /* limit/offset/page ride along (same shape as uptPage) so the Bubble workflow can re-run
         its RPC at page 1 directly, rather than relying on whatever pagination custom state it
         separately tracks from the last uptPage call still happening to be page 1 — the mode
         switch is a different record set entirely and must never silently keep serving a stale
         offset from the tab the user just left. */
      fire("data-status-fn", "uptStatus", {
        status: state.status,
        is_active: state.status === "active" ? "yes" : "no",
        limit: state.pageSize, offset: offset(), page: state.page
      });
    }

    /* ---------------- bulk actions ---------------- */
    /* The count that actually applies to whichever tab is open — state.totalCount is the Active
       count, state.totalCountInactive is the Inactive one, and every "how many rows are there in
       total" question below has to ask the right one. Using state.totalCount unconditionally is
       exactly the bug that made "Select all N" silently never appear on the Inactive tab whenever
       the Active count happened to be 0 — hasMorePages() saw "0 total" and never offered it, even
       with 45 real inactive rows sitting right there. */
    function currentTotal(){ return toNum(state.status === "inactive" ? state.totalCountInactive : state.totalCount); }
    function hasMorePages(){
      var t = currentTotal();
      return t != null && t > (state.rows || []).length;
    }
    function invalidateSelectAll(){ state.selectAllMatching = false; }
    /* The "select all N" offer belongs to the header checkbox, not to ticking single rows:
       after one manual tick, "select all 94" is a non-sequitur. Only once the whole visible
       page is selected does "and the rest?" become the obvious next question. */
    function pageFullySelected(){
      var rows = state.rows || [];
      if (!rows.length) return false;
      return rows.every(function(r){ return !!state.selected[String(r.prompt_id)]; });
    }
    /* What a bulk action operates on. Two shapes on purpose:
         ids    — the user ticked specific rows; send them.
         filter — the user took "select all N matching"; send the PREDICATE, not the ids, so the
                  server resolves the same set the table is showing. The field names here must
                  stay identical to the ones the render RPC already takes, otherwise the table
                  and the bulk action can silently disagree about which rows they mean. */
    function selectionPayload(){
      if (state.selectAllMatching){
        return { mode: "filter", count: currentTotal() || 0,
                 query: state.query, brand_mentioned: state.brandMentioned,
                 status: state.status, order: orderValue(state.sortField, state.sortDir) };
      }
      var ids = selectedIds();
      return { mode: "ids", count: ids.length, ids: ids.join(",") };
    }
    function bulkCount(){
      return state.selectAllMatching ? (currentTotal() || 0) : selectedIds().length;
    }

    var elBulk = null;
    var CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    var TAG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';
    var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    var TRASH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
    var SMILE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
    /* First stop of the tag creator this table will eventually need in full — for now it lives
       only where a brand-new topic can be named: the inline "no matches, create it" row.
       8 hue families + 2 neutral grays, x 3 tone rows each. Every one was picked by checking WCAG
       contrast against both a plain white and a plain near-black background (>= 2.5:1, in line
       with what the app's own existing example topic colors already sit at) — because only
       hex_light is ever actually rendered (see doTopics/topicListHtml), the same values have to
       read acceptably in both themes rather than getting a per-theme pass. The 2 grays per row
       are solved for a DIFFERENT target luminance than their row's hues (0.8x / 1.25x) rather
       than reusing the row's own — two swatches at the identical luminance would look like the
       same gray twice. */
    var TOPIC_COLOR_COLS = 10;   // must match .upt-colorgrid's column count
    var TOPIC_COLOR_PALETTE = [
      /* vibrant */ "#de1b22", "#b65616", "#8d6a11", "#108440", "#107c84", "#1b6eda", "#9145e8", "#d51a8b", "#666666", "#7d7d7d",
      /* muted   */ "#b47476", "#a87b5d", "#988552", "#4f926b", "#509195", "#6a88af", "#977ab8", "#b27098", "#787878", "#949494",
      /* deep    */ "#ab2b2f", "#8b4c23", "#725a1d", "#1b6a3c", "#1b656a", "#295ea3", "#7a33cc", "#a32972", "#575757", "#6f6f6f"
    ];
    /* Each ROW is one tone scale across the full hue range, each COLUMN one hue — so scanning
       down picks a mood and across picks a color.
       The rows are banded by PERCEPTUAL luminance, not by a fixed HSL lightness: at the same L,
       amber is far brighter than blue, so a fixed-L row came out visibly ragged. Solving each
       hue for a target luminance instead lands every swatch in a row within ~0.1 of the same
       contrast ratio. Those bands are also what keeps all 24 legible in BOTH themes at once
       (>=2.5:1 against white and against near-black) — necessary because only hex_light is ever
       rendered, so one value has to carry both. */
    function swatchInk(hex){
      var h = String(hex).replace("#", "");
      function lin(c){ c = parseInt(c, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
      var y = 0.2126 * lin(h.slice(0,2)) + 0.7152 * lin(h.slice(2,4)) + 0.0722 * lin(h.slice(4,6));
      /* 0.179 is where contrast-against-white and contrast-against-black are exactly equal
         (solve 1.05/(Y+.05) = (Y+.05)/.05), so it picks whichever tick is genuinely more legible
         rather than guessing at a "looks dark enough" cutoff.
         The three palette rows were each tuned to sit clearly on ONE side of it — vibrant and
         deep take a white tick, muted a near-black one. A row straddling the boundary would show
         some white and some black ticks side by side, which reads as a bug rather than a
         contrast decision. */
      return y > 0.179 ? "#151515" : "#ffffff";
    }
    /* emoji-picker-element (MIT, github.com/nolanlawson/emoji-picker-element) — a self-contained
       Web Component with its own emoji data, no framework/build step required. Loaded lazily as a
       real ES module <script> only once the emoji trigger is actually clicked, so nobody pays for
       ~200KB of emoji data just for having the table on the page. Once the custom element is
       defined, any <emoji-picker> already sitting in the DOM upgrades itself automatically — no
       manual re-mounting needed after the fetch resolves. */
    var EMOJI_LIB_URL = "https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js";
    var emojiLibPromise = null;
    function ensureEmojiLib(){
      if (window.customElements && window.customElements.get("emoji-picker")) return;
      if (emojiLibPromise) return;
      emojiLibPromise = true;
      var s = document.createElement("script");
      s.type = "module";
      s.textContent = 'import "' + EMOJI_LIB_URL + '";';
      document.head.appendChild(s);
    }
    /* Lives on document.body, NOT inside the component root: it has to sit bottom-centre of the
       PAGE, and a position:fixed element is positioned against the nearest ancestor that has a
       transform/filter/perspective — which Bubble containers frequently do. Parenting it to body
       is the only way to guarantee it's anchored to the viewport. */
    function ensureBulkBar(){
      if (elBulk && document.body.contains(elBulk)) return elBulk;
      elBulk = document.createElement("div");
            /* Deliberately NOT .up-root: that class carries width:100% and flex-direction:column,
         which flattened the bar across the page. Core's button rules (.up-filter-btn et al) are
         not root-scoped anyway — they only need the --vc-* variables, which prompts-table.css
         declares on .upt-bulkbar directly. */
      elBulk.className = "upt-bulkbar";
      elBulk.setAttribute("role", "toolbar");
      elBulk.setAttribute("aria-label", "Bulk actions");
      elBulk.setAttribute("aria-hidden", "true");
      elBulk.setAttribute("data-for", instanceId);
      /* The menu is rebuilt on every keystroke, so the listener has to sit on the bar and
         delegate rather than on the input itself. */
      elBulk.addEventListener("input", function(e){
        if (!e.target.classList || !e.target.classList.contains("upt-topicsearch-in")) return;
        topicQuery = e.target.value;
        var head = elBulk.querySelector(".upt-topichead");
        if (head) head.classList.toggle("has-text", topicQuery.length > 0);
        pickOpen = null;   // editing the intended name invalidates whichever picker was open
        renderTopicList();   // the input itself is left untouched, so focus and caret survive
      });
      /* emoji-picker-element dispatches this (bubbling, composed) from inside its shadow root.
         Delegated here rather than bound per-instance because the <emoji-picker> element itself
         gets torn down and recreated on every re-render while the picker is open. */
      elBulk.addEventListener("emoji-click", function(e){
        var unicode = e.detail && e.detail.unicode;
        if (!unicode) return;
        newTopicEmoji = unicode;
        /* Deliberately does NOT close the picker — picking is not the same as being done;
           closing on every click made it hard to compare a couple of emoji against each other. */
        renderTopicList();
      });
      /* The bar hangs off <body>, outside .up-root — core's tooltips delegate from whatever root
         they're given, so without registering the bar as its own root no [data-tip] inside it
         would ever fire. The tooltip ELEMENT and its state are page singletons, so this shares
         one tooltip with the table rather than creating a second. */
      UC.makeTooltips(elBulk, function(){ return isDark; });
      document.body.appendChild(elBulk);
      return elBulk;
    }
    /* Patches just the "N selected" text (slide + fade, same technique as the topic count) when
       a row checkbox toggles — the common case, and by far the most frequent call into the bar.
       renderBulkBar() rebuilds the whole innerHTML, which would destroy this very span before any
       transition could run; falls back to it only when something structural has to change too
       (the bar appearing/disappearing, or the escape-hatch link's presence flipping). */
    function syncBulkBarCount(){
      /* The selection just changed, so an armed Delete no longer refers to the set the user
         confirmed — never carry that arm over onto a different (or now-empty) set of rows. */
      disarmBulkDelete();
      var n = bulkCount();
      if (n === 0 || !elBulk || !elBulk.classList.contains("is-on")){ renderBulkBar(); return; }
      var numEl = elBulk.querySelector(".upt-bulkbar-count-n");
      if (!numEl){ renderBulkBar(); return; }
      var wantEscape = state.selectAllMatching || (hasMorePages() && pageFullySelected());
      var hasEscapeNow = !!elBulk.querySelector("[data-bulk-all],[data-bulk-undoall]");
      if (wantEscape !== hasEscapeNow){ renderBulkBar(); return; }
      /* Only this span moves — "selected" outside it is untouched, so it never has to be part of
         the animation and never shifts sideways from a wider/narrower digit run next to it. */
      var newTxt = UC.fmtInt(n);
      var prev = Number(numEl.getAttribute("data-n"));
      numEl.setAttribute("data-n", n);
      if (isNaN(prev) || prev === n){ numEl.textContent = newTxt; return; }
      var dir = n > prev ? 1 : -1;
      numEl.style.transition = "none";
      numEl.style.transform = "translateY(0)";
      numEl.style.opacity = "1";
      numEl.textContent = newTxt;
      void numEl.offsetWidth;
      numEl.style.transform = "translateY(" + (dir * 6) + "px)";
      numEl.style.opacity = "0";
      void numEl.offsetWidth;
      numEl.style.transition = "transform 180ms cubic-bezier(.2,0,.38,.9), opacity 140ms ease";
      numEl.style.transform = "translateY(0)";
      numEl.style.opacity = "1";
    }
    function renderBulkBar(){
      var n = bulkCount();
      var on = n > 0;
      var bar = on ? ensureBulkBar() : elBulk;
      if (!bar) return;
      bar.setAttribute("data-theme", isDark ? "dark" : "light");
      /* Same treatment as the table's own soft-reload dim, but this bar lives on document.body
         (outside .up-root), so it can't just piggyback on .up-root.is-reloading — it needs its
         own class. Nothing on it should be clickable while the table is mid-load; a bulk action
         fired against a row set that's about to change under it would be worse than just waiting
         a moment for the buttons to come back. */
      bar.classList.toggle("is-loading", isBusy());
      if (!on){
        /* Move focus out BEFORE hiding: aria-hidden on an ancestor of the focused element is
           an accessibility trap, and Chrome refuses it outright with a console error. Clicking
           the bar's own X is exactly the case that triggers it. */
        if (bar.contains(document.activeElement)){
          try { document.activeElement.blur(); } catch(e){}
        }
        bar.classList.remove("is-on");
        bar.setAttribute("aria-hidden", "true");
        /* Every control must leave the tab order while the bar is invisible, otherwise an
           opacity:0 toolbar becomes a set of phantom tab stops. */
        Array.prototype.forEach.call(bar.querySelectorAll("button"), function(b){ b.tabIndex = -1; });
        root.classList.remove("is-bulk");
        return;
      }
      var isAll = state.selectAllMatching;
      /* No "+": bulkCount() is the exact total_count once select-all is active, not an estimate —
         a "+" on a number we know precisely reads as a hedge we don't actually mean. */
      /* Polaris's trick: one control with two states. Before -> the escape hatch; after -> Undo.
         Only offered when there actually IS another page, otherwise "select all" is a lie. */
      var escape = "";
      if (isAll) escape = '<button class="upt-bulkbar-link" type="button" data-bulk-undoall>Undo</button>';
      else if (hasMorePages() && pageFullySelected()) escape = '<button class="upt-bulkbar-link" type="button" data-bulk-all>Select all ' +
        /* fmtInt, not fmtTotal: fmtTotal abbreviates (1000 -> "1k"), and "Select all 1k prompts"
           reads like a rounded guess when it is in fact an exact figure. */
        UC.fmtInt(currentTotal()) + ' prompts</button>';

      var statusLabel = state.status === "inactive" ? "Set Active" : "Set Inactive";
      /* Inactive prompts aren't tagged — Topics management only ever makes sense for the active
         set, so the button (and the whole staged-topic panel behind it) doesn't exist at all here
         rather than existing-but-disabled. Delete takes its place as the second action instead. */
      var isInactive = state.status === "inactive";
      var wasOpen = !isInactive && bar.classList.contains("is-topics");
      var topicsBtn = isInactive ? "" :
        '<button class="up-filter-btn upt-bulkbar-btn" type="button" data-bulk-topics aria-expanded="' + (wasOpen ? "true" : "false") + '">' + TAG_SVG + 'Topics</button>';
      var deleteBtn = isInactive ?
        '<button class="up-filter-btn upt-bulkbar-btn upt-bulkbar-delete" type="button" data-bulk-delete>' + TRASH_SVG + '<span class="upt-bulkbar-delete-lbl">Delete</span></button>' : "";
      bar.innerHTML =
        '<div class="upt-bulkbar-row' + (isInactive ? " is-inactive" : "") + '">' +
          /* Only the number lives in its own span — "selected" never moves, and syncBulkBarCount()
             only ever touches this inner span, not the whole phrase. */
          '<span class="upt-bulkbar-count" role="status" aria-live="polite">' +
            '<span class="upt-bulkbar-count-n" data-n="' + n + '">' + UC.fmtInt(n) + '</span>' +
            '<span class="upt-bulkbar-count-lbl">selected</span>' +
          '</span>' +
          escape +
          topicsBtn +
          '<button class="up-filter-btn upt-bulkbar-btn" type="button" data-bulk-status>' + esc(statusLabel) + '</button>' +
          deleteBtn +
          '<button class="upt-bulkbar-x" type="button" data-bulk-clear aria-label="Clear selection">' + CLOSE_SVG + '</button>' +
        '</div>' +
        '<div class="upt-bulkpanel" aria-hidden="' + (wasOpen ? "false" : "true") + '"></div>';
      if (wasOpen) renderTopicMenu();   // innerHTML above threw the open panel away
      Array.prototype.forEach.call(bar.querySelectorAll("button"), function(b){ b.tabIndex = 0; });
      bar.setAttribute("aria-hidden", "false");
      root.classList.add("is-bulk");
      if (!bar.classList.contains("is-on")){
        /* Force a style/layout flush so the browser has actually computed the from-state before
           the class flips — otherwise both states land in one frame and the transition is
           skipped. Deliberately NOT requestAnimationFrame: rAF is paused in a backgrounded tab,
           so the bar would simply never appear for anyone who selects a row and switches away
           and back. Same reason the chart kit polls on setInterval rather than rAF. */
        void bar.offsetWidth;
        bar.classList.add("is-on");
      }
    }

    /* ---- topic editor ----
       Staged, not immediate: a click only checks/unchecks a topic locally. Nothing is sent until
       Apply, which fires ONE event carrying the full staged set — mirrors picking labels in a
       Linear/Notion multi-select rather than firing a workflow per click. Capped at 5 staged
       topics client-side because that's the per-prompt limit; the RPC still has the final word
       for rows that already sit close to that limit before this batch is added. */
    var TOPIC_MAX = 5;
    function topicId(t){ return String((t && (t.id != null ? t.id : t.tag_id)) || ""); }
    function loadedSelectedRows(){
      return (state.rows || []).filter(function(r){ return state.selected[String(r.prompt_id)]; });
    }
    /* Seeds the staged set from what's already on the prompt — but only when exactly ONE prompt
       is selected. With several selected, "put these on all of them" has no single starting
       point, so the panel opens empty rather than guessing. */
    function topicInitialStaged(){
      var seed = {};
      if (state.selectAllMatching) return seed;
      var sel = loadedSelectedRows();
      if (sel.length !== 1) return seed;
      (sel[0].tags || []).forEach(function(t){ seed[topicId(t)] = true; });
      return seed;
    }
    function stagedCount(){ return Object.keys(state.stagedTopicIds || {}).length; }
    function isStaged(id){ return !!(state.stagedTopicIds && state.stagedTopicIds[id]); }
    function toggleStagedTopic(id){
      if (!state.stagedTopicIds) state.stagedTopicIds = {};
      if (state.stagedTopicIds[id]) delete state.stagedTopicIds[id];
      else {
        if (stagedCount() >= TOPIC_MAX) return;   // client-side guard only; RPC enforces per-row
        state.stagedTopicIds[id] = true;
      }
      renderTopicList(true);
      syncTopicFoot();
    }
    function resetStagedTopics(){
      state.stagedTopicIds = topicInitialStaged();
      renderTopicList(true);
      syncTopicFoot();
    }
    /* Selection changed (a different prompt got checked/unchecked, "select all N matching" got
       toggled, ...) while the topic panel happens to be open. The staged draft is tied to
       whichever prompt(s) were selected at the moment the panel was seeded — the instant that set
       changes, a topic that only ever came from the FIRST prompt would otherwise keep sitting
       there looking staged for a selection the user never actually asked to tag, and Apply would
       silently add it there too. Re-seeding (topicInitialStaged() already returns empty for
       anything but exactly one prompt) is simpler and safer than trying to tell "still exactly
       what was auto-seeded" apart from "the user edited it by hand" — losing an in-progress manual
       edit on a selection change is a much smaller cost than applying an unintended tag. */
    function syncStagedTopicsToSelection(){
      if (!topicMenuOpen()) return;
      resetStagedTopics();
    }
    var topicQuery = "";
    /* Draft state for the inline "create a new topic" row — see topicCreateHtml(). */
    var newTopicEmoji = "";
    var newTopicColor = null;
    var pickOpen = null;   // null | "emoji" | "color" — which picker (if any) is expanded
    /* Name of a topic just created (inline row or the Add Topic modal), waiting for the next
       topics list to land so it can be auto-staged — see the params.topics branch in update()
       and both create call sites below. Cleared once matched or once the panel closes. */
    var pendingAutoStageName = null;
    /* Split in three on purpose: the head (search + reset + count) is built ONCE when the menu
       opens; the chip list is rebuilt per keystroke/toggle; the foot's count/disabled-state is
       patched separately from a toggle so a click doesn't also tear down the search input. */
    function topicShown(){
      var list = state.topics || [];
      var qLower = topicQuery.trim().toLowerCase();
      return list.filter(function(t){
        return !qLower || String(t.name || "").toLowerCase().indexOf(qLower) > -1;
      });
    }
    /* True once a typed query has zero matches — the create-affordance state, and the one case
       where renderTopicList() has to free the list from its own chip-grid max-height/scroll. */
    function topicIsCreateMode(){
      return (state.topics || []).length > 0 && topicShown().length === 0;
    }
    function topicListHtml(){
      var list = state.topics || [];
      var q = topicQuery.trim();
      var shown = topicShown();
      var items = !list.length
        ? '<div class="upt-topicmenu-empty">No topics available</div>'
        : (!shown.length
            /* A typed query with zero matches is the exact moment "create it instead" is the
               obvious next action — surfaced inline rather than making the user go find the
               separate Add Topic button and retype the name there. */
            ? topicCreateHtml(q)
            : shown.map(function(t){
                var id = topicId(t);
                var on = isStaged(id);
                var color = String(t.hex_light || t.hex_dark || "#6b7280");
                if (color.charAt(0) !== "#") color = "#" + color;
                return '<button type="button" class="upt-topicchip up-chiphover' + (on ? " is-on" : "") +
                 '" data-topic="' + esc(id) + '" style="--ust-tag-color:' + esc(color) + '">' +
                 (t.emoji ? '<span class="upt-topicchip-e">' + esc(t.emoji) + '</span>' : "") +
                 '<span class="upt-topicchip-lbl">' + esc(t.name == null ? "" : t.name) + '</span>' +
                 '<span class="upt-topicchip-check' + (on ? " is-on" : "") + '">' + CHECK_SVG + '</span>' +
               '</button>';
              }).join(""));
      return items;
    }
    /* The inline "create a new topic" row, plus — first piece of the fuller tag creator this
       table will need later — an emoji and a color picker right next to it. Neither the emoji
       nor the color are staged in any global sense; they only ever travel along with THIS create
       click (see the data-topic-create handler). */
    function topicCreateHtml(query){
      var color = newTopicColor || TOPIC_COLOR_PALETTE[0];
      var emojiOpen = pickOpen === "emoji";
      var colorOpen = pickOpen === "color";
      var panel = "";
      if (emojiOpen){
        /* Explicit "light"/"dark" class, not just omitting "dark" in light mode — left unset,
           emoji-picker-element falls back to the OS's own prefers-color-scheme instead of this
           table's theme, which silently mismatched on any device set to dark. */
        panel = '<div class="upt-topicpickpanel"><emoji-picker class="upt-emojipicker ' +
          (isDark ? "dark" : "light") + '"></emoji-picker></div>';
      } else if (colorOpen){
        panel = '<div class="upt-topicpickpanel"><div class="upt-colorgrid">' +
          TOPIC_COLOR_PALETTE.map(function(hx){
            var on = hx === color;
            /* The tick sits INSIDE the blob rather than ringing it: a ring changes the swatch's
               footprint and made the whole grid twitch on every pick. */
            return '<button type="button" class="upt-colorcell" data-color="' + esc(hx) + '"' +
              ' aria-label="' + esc(hx) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
              '<span class="upt-colorblob" style="background:' + esc(hx) +
                (on ? ";color:" + swatchInk(hx) : "") + '">' + (on ? CHECK_SVG : "") + '</span>' +
            '</button>';
          }).join("") +
        '</div></div>';
      }
      return '<div class="upt-topiccreate-row">' +
          '<button type="button" class="upt-topiccreate" data-topic-create="' + esc(query) + '">' +
            PLUS_SVG + '<span>Create &ldquo;<strong>' + esc(query) + '</strong>&rdquo;</span></button>' +
          '<button type="button" class="upt-topiccreate-pick' + (emojiOpen ? " is-open" : "") +
            '" data-topic-pick="emoji" data-tip="Topic Emoji" aria-label="Topic emoji" aria-expanded="' + (emojiOpen ? "true" : "false") + '">' +
            (newTopicEmoji ? esc(newTopicEmoji) : SMILE_SVG) +
          '</button>' +
          '<button type="button" class="upt-topiccreate-pick' + (colorOpen ? " is-open" : "") +
            '" data-topic-pick="color" data-tip="Topic Color" aria-label="Topic color" aria-expanded="' + (colorOpen ? "true" : "false") + '">' +
            '<span class="upt-topiccreate-swatch" style="background:' + esc(color) + '"></span>' +
          '</button>' +
        '</div>' +
        panel;
    }
    /* animate=true runs a tiny FLIP: capture each chip's position before the rebuild, then ease
       from there — so a toggle that reflows the wrap (a chip growing a checkbox pushes the next
       one to a new line) reads as a slide instead of a jump. Skipped while typing: a full
       re-filter isn't "the same chips moved", it's a different set. */
    function renderTopicList(animate){
      if (!elBulk) return;
      var el = elBulk.querySelector(".upt-topiclist");
      if (!el) return;
      /* At the per-prompt cap, chips you haven't staged can't be added anyway — dimming them
         (see .upt-topiclist.is-full in the CSS) says so before the click does nothing. */
      el.classList.toggle("is-full", stagedCount() >= TOPIC_MAX);
      /* Create-mode has nothing to wrap/scroll — freed from the chip grid's own max-height so an
         open picker panel isn't clipped by it (see .upt-topiclist.is-create in the CSS). */
      var inCreateMode = topicIsCreateMode();
      el.classList.toggle("is-create", inCreateMode);
      elBulk.classList.toggle("is-picking", inCreateMode && !!pickOpen);
      if (!animate){ el.innerHTML = topicListHtml(); return; }
      var before = {};
      Array.prototype.forEach.call(el.querySelectorAll("[data-topic]"), function(c){
        before[c.getAttribute("data-topic")] = c.getBoundingClientRect();
      });
      el.innerHTML = topicListHtml();
      Array.prototype.forEach.call(el.querySelectorAll("[data-topic]"), function(c){
        var b = before[c.getAttribute("data-topic")];
        if (!b) return;
        var a = c.getBoundingClientRect();
        var dx = b.left - a.left, dy = b.top - a.top;
        if (!dx && !dy) return;
        c.style.transition = "none";
        c.style.transform = "translate(" + dx + "px," + dy + "px)";
        void c.offsetWidth;
        c.style.transition = "transform 200ms cubic-bezier(.2,0,.38,.9)";
        c.style.transform = "";
        c.addEventListener("transitionend", function te(){ c.style.transition = ""; c.removeEventListener("transitionend", te); });
      });
    }
    /* Subtle count-up/down: the new number slides in from the direction it moved (up when the
       count grew, down when it shrank) and fades in, rather than just snapping to the new digit
       — same idea as the FLIP nudges elsewhere in this panel, kept purely CSS-driven since it's
       only ever a +/-1 step. */
    function syncTopicFoot(){
      if (!elBulk) return;
      var n = stagedCount();
      var nEl = elBulk.querySelector(".upt-topiccount-n");
      if (nEl){
        var prev = Number(nEl.textContent);
        if (prev !== n){
          var dir = n > prev ? 1 : -1;
          nEl.style.transition = "none";
          nEl.style.transform = "translateY(0)";
          nEl.style.opacity = "1";
          nEl.textContent = n;
          void nEl.offsetWidth;
          nEl.style.transform = "translateY(" + (dir * 6) + "px)";
          nEl.style.opacity = "0";
          void nEl.offsetWidth;
          nEl.style.transition = "transform 180ms cubic-bezier(.2,0,.38,.9), opacity 140ms ease";
          nEl.style.transform = "translateY(0)";
          nEl.style.opacity = "1";
        } else {
          nEl.textContent = n;
        }
      }
      var applyBtn = elBulk.querySelector("[data-topic-apply]");
      if (applyBtn) applyBtn.disabled = n === 0;
    }
    function renderTopicMenu(){
      if (!elBulk) return;
      var menu = elBulk.querySelector(".upt-bulkpanel");
      if (!menu) return;
      var n = stagedCount();
      menu.innerHTML =
        ((state.topics || []).length
          ? '<div class="upt-topichead">' +
              '<div class="upt-topicsearch-wrap">' +
                '<input class="upt-topicsearch-in" type="text" placeholder="Search or create topics..." autocomplete="off" spellcheck="false"/>' +
                '<button class="upt-topicsearch-clear" type="button" data-topic-search-clear aria-label="Clear search">' + CLOSE_SVG + '</button>' +
              '</div>' +
              '<button class="upt-topicreset" type="button" data-topic-reset>Reset</button>' +
              '<span class="upt-topiccount"><span class="upt-topiccount-n">' + n + '</span>/' + TOPIC_MAX + '</span>' +
            '</div>'
          : "") +
        '<div class="upt-topiclist' + (n >= TOPIC_MAX ? " is-full" : "") + '">' + topicListHtml() + '</div>' +
        '<div class="upt-topicfoot">' +
          '<button class="upt-topicadd" type="button" data-topic-add>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
            'Add Topic</button>' +
          '<button class="upt-topicapply" type="button" data-topic-apply' + (n === 0 ? " disabled" : "") + '>Apply</button>' +
        '</div>';
    }
    /* Opening Topics grows the BAR — the topic section slides out of its lower edge rather than
       floating above it as a separate dropdown. One surface, not two stacked ones. */
    function setTopicMenuOpen(open){
      if (!elBulk) return;
      var panel = elBulk.querySelector(".upt-bulkpanel");
      var btn = elBulk.querySelector("[data-bulk-topics]");
      if (!panel) return;
      if (!open && panel.contains(document.activeElement)){
        /* Same trap as the bar's own hide-toggle: aria-hidden on an ancestor of the focused
           element (Add Topic, Apply, a chip) is rejected outright by Chrome unless focus moves
           out first. */
        try { document.activeElement.blur(); } catch(e){}
      }
      elBulk.classList.toggle("is-topics", !!open);
      if (!open){
        elBulk.classList.remove("is-picking");
        /* Explicit, not just "the next open reseeds anyway": a staged draft that outlives the
           panel it was drafted in is never meant to be read by anything else. */
        state.stagedTopicIds = null;
        pendingAutoStageName = null;
      }
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open){
        topicQuery = "";
        newTopicEmoji = "";
        newTopicColor = null;
        pickOpen = null;
        /* Warmed HERE rather than on the emoji button itself: the library downloads a sizeable
           emoji JSON and fills IndexedDB the first time, which was the stall on first open. The
           fetch now overlaps the seconds the user spends reading the chip list, so by the time
           the emoji button is actually clicked the data is usually already in place. Still not
           on page load — nobody who never opens Topics should pay for it. */
        ensureEmojiLib();
        state.stagedTopicIds = topicInitialStaged();
        renderTopicMenu();
        /* Deliberately no autofocus on the search input — opening Topics is often just to look
           at what's already on the prompt, and grabbing focus steals the keyboard from wherever
           the user actually was (mid-selection, or about to keep typing elsewhere). */
      }
    }
    function topicMenuOpen(){ return !!(elBulk && elBulk.classList.contains("is-topics")); }
    /* The one event this panel fires. prompt_ids/tag_ids are comma-joined strings — same
       convention selectionPayload() already uses for `ids` — so Bubble turns each into a real
       list with ":split by" a comma, no JSON parsing required on that side. */
    function applyStagedTopics(){
      var tagIds = Object.keys(state.stagedTopicIds || {});
      if (!tagIds.length) return;
      var tagsById = {};
      (state.topics || []).forEach(function(t){ tagsById[topicId(t)] = t; });
      var p = selectionPayload();
      p.tag_ids = tagIds.join(",");
      if (p.mode === "ids") p.prompt_ids = p.ids;
      fire("data-applybulktopics-fn", "uptApplyBulkTopics", p);
      /* Optimistic local update, same idea as the rest of the bar: only touches rows we have. */
      loadedSelectedRows().forEach(function(r){
        var tags = Array.isArray(r.tags) ? r.tags : (r.tags = []);
        tagIds.forEach(function(id){
          var has = tags.some(function(x){ return topicId(x) === id; });
          if (!has && tagsById[id]) tags.push(tagsById[id]);
        });
      });
      syncTopicCells();
      setTopicMenuOpen(false);
    }
    function applyBulkStatus(){
      var next = state.status === "inactive" ? "active" : "inactive";
      var p = selectionPayload();
      p.status = next;
      fire("data-bulkstatus-fn", "uptBulkStatus", p);
      /* Both directions are trivially reversible, so no confirm dialog — surface an undo in your
         own toast instead. The rows leave the current view once the server answers. */
      clearSelection();
    }
    /* Delete is the one bulk action that isn't trivially reversible, so unlike Set Active/Inactive
       above it gets the same two-click "arm" confirm UC.makeTopicModal's own Delete button uses
       (core.js's .up-topicmodal-delete): first click just arms the button and relabels it, second
       click (on the now-armed button) actually fires. Arming is a plain DOM class toggle, not a
       render() round-trip — same reasoning as syncBulkBarCount() staying out of renderBulkBar()
       for the common case. */
    function bulkDeleteBtn(){ return elBulk && elBulk.querySelector("[data-bulk-delete]"); }
    function disarmBulkDelete(){
      var btn = bulkDeleteBtn();
      if (!btn || !btn.classList.contains("is-armed")) return;
      btn.classList.remove("is-armed");
      var lbl = btn.querySelector(".upt-bulkbar-delete-lbl");
      if (lbl) lbl.textContent = "Delete";
    }
    function applyBulkDelete(){
      var btn = bulkDeleteBtn();
      if (!btn) return;
      if (!btn.classList.contains("is-armed")){
        btn.classList.add("is-armed");
        var lbl = btn.querySelector(".upt-bulkbar-delete-lbl");
        if (lbl) lbl.textContent = "Confirm delete?";
        return;
      }
      var p = selectionPayload();
      fire("data-bulkdelete-fn", "uptBulkDelete", p);
      clearSelection();
    }

    /* ---------------- table ---------------- */
    function skeletonRows(n){
      return UC.skeletonRows({ count: n, cols: [
        { w:180, jitter:40, cls:"upt-td-prompt" },
        { w:56,  cls:"upt-td-visibility" },
        { w:44,  cls:"upt-td-rank" },
        { w:56,  cls:"upt-td-sentiment" },
        { logo:true, logoStyle:"border-radius:999px", cls:"upt-td-brands" },
        { w:90,  cls:"upt-td-topics" },
        { w:60,  cls:"upt-td-market" },
        { w:76,  cls:"upt-td-created" }
      ]});
    }
    function visCell(v){
      var n = (v == null || v === "") ? null : Number(v);
      var bad = n == null || !isFinite(n);
      return '<span class="up-num' + (bad ? " is-empty" : "") + '">' + (bad ? "–" : (Math.round(n) + "%")) + '</span>';
    }
    function rankCell(v){
      return '<span class="up-rank-group">' + HASH_ICON + '<span class="up-num">' + fmt1(v) + '</span></span>';
    }
    function sentCell(v){
      var n = (v == null || v === "") ? null : Number(v);
      var bad = n == null || !isFinite(n);
      var sc = bad ? "#9E9E9E" : UC.sentColor(n);
      return '<span class="up-sent"><span class="up-sent-dot" style="background:' + sc + '"></span>' +
             '<span class="up-sent-val' + (bad ? " is-empty" : "") + '">' + (bad ? "–" : Math.round(n)) + '</span></span>';
    }
    function marketCell(m){
      var code = String(m == null ? "" : m).trim().toUpperCase();
      if (!code) return '<span class="up-num is-empty">–</span>';
      return '<span class="upt-market">' +
               '<span class="upt-flag"><img src="https://flagcdn.com/' + esc(code.toLowerCase()) + '.svg" alt="" loading="lazy"/></span>' +
               '<span class="upt-market-code">' + esc(code) + '</span>' +
             '</span>';
    }
    function findRowById(id){
      for (var i = 0; i < state.rows.length; i++){
        if (String(state.rows[i].prompt_id) === String(id)) return state.rows[i];
      }
      return null;
    }
    function topicsCell(id, tags){
      var json;
      try { json = JSON.stringify(Array.isArray(tags) ? tags : []); } catch(e){ json = "[]"; }
      // </script> inside the JSON payload would otherwise close the tag early
      json = json.replace(/</g, "\\u003c");
      return '<div class="ust-cell" data-prompt-id="' + esc(id) + '">' +
               '<script type="application/json" class="ust-json">' + json + '<\/script>' +
               '<div class="ust-row"></div>' +
             '</div>';
    }
    function rowHtml(r){
      var id = String(r.prompt_id == null ? "" : r.prompt_id);
      /* "Select all N matching" only ever set the flag, never backfilled state.selected for rows
         that weren't loaded yet — a page turn or a bigger page size brings in rows this flag
         should already cover, but that individually never got a state.selected[id]=true entry. */
      var checked = state.selectAllMatching || !!state.selected[id];
      var text = String(r.prompt_text == null ? "" : r.prompt_text);
      return '<div class="up-row' + (checked ? " is-selected" : "") + '" data-id="' + esc(id) + '" tabindex="0" role="button">' +
        '<div class="up-td upt-td-prompt">' +
          '<span class="upt-check' + (checked ? " is-checked" : "") + '" role="checkbox" tabindex="0" aria-checked="' + (checked ? "true" : "false") + '" data-select="' + esc(id) + '">' + (checked ? CHECK_SVG : "") + '</span>' +
          '<span class="upt-prompt-wrap">' +
            '<span class="upt-prompt-text">' + highlight(text, state.query) + '</span>' +
          '</span>' +
          '<span class="up-row-goto">' + GOTO_SVG + '</span>' +
        '</div>' +
        '<div class="up-td upt-td-visibility">' + visCell(r.visibility_pct) + '</div>' +
        '<div class="up-td upt-td-rank">' + rankCell(r.avg_rank) + '</div>' +
        '<div class="up-td upt-td-sentiment">' + sentCell(r.avg_sentiment_30d) + '</div>' +
        '<div class="up-td upt-td-brands">' + UC.brandStack(r.top_mentions, r.companies_preview_totalcount) + '</div>' +
        '<div class="up-td upt-td-topics">' + topicsCell(id, r.tags) + '</div>' +
        '<div class="up-td upt-td-market">' + marketCell(r.market) + '</div>' +
        '<div class="up-td upt-td-created"><span class="upt-date">' + esc(fmtDate(r.created_at)) + '</span></div>' +
      '</div>';
    }
    function initTopicsCells(){
      if (!window.__uptUstTopics) return;
      Array.prototype.forEach.call(elTbody.querySelectorAll(".ust-cell"), function(cell){
        if (!cell.__ustInit) window.__uptUstTopics.init(cell);
      });
    }
    var emptyGraceTimer = null;
    function clearEmptyGrace(){ if (emptyGraceTimer){ clearTimeout(emptyGraceTimer); emptyGraceTimer = null; } }
    function renderEmptyState(filtered){
      elTbody.innerHTML = '<div class="up-empty">' +
        '<div class="up-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
          '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>' +
        '<div class="up-empty-h">' + (filtered ? "No matching prompts" : "No prompts yet") + '</div>' +
        '<div class="up-empty-t">' + (filtered
          ? "Nothing matches the current search."
          : "Prompts appear here once your team has added them.") + '</div>' +
        (filtered ? '<button class="up-empty-btn" type="button" data-clearall>Clear search</button>' : "") +
      '</div>';
    }
    function renderTable(){
      /* elTbody.innerHTML is reassigned in every branch below, which throws away whatever grid-
         column inline style applyCols() had put on the previous .up-row elements — a brand new
         set of rows carries no inline style at all until applyCols() runs again. Callers outside
         the full render() cycle (checkbox toggle, search results, pagination) call renderTable()
         directly, so that reapply has to happen HERE, not rely on a later render(). */
      /* Two kinds of reload, deliberately shown differently (see setSoftReload):
         SOFT (sort, paging) reorders or re-windows the SAME result set — the rows on screen are
         still truthful, so they stay and only dim. Blanking them made every header click look
         like the table broke.
         HARD (search, filters, brand toggle, status switch) changes WHICH rows match — anything
         still on screen would be a lie, so it goes back to the skeleton. */
      if (isBusy() && state.softReload && state.hasData && state.rows.length){
        clearEmptyGrace(); return;   // leave the rows exactly as they are; CSS dims them
      }
      if (isBusy() || !state.hasData){
        clearEmptyGrace(); elTbody.innerHTML = skeletonRows(state.pageSize); applyCols(); return;
      }
      if (!state.rows.length){
        var filtered = !!state.query || !!state.brandMentioned;
        if (filtered){ clearEmptyGrace(); renderEmptyState(true); return; }
        if (!emptyGraceTimer){
          elTbody.innerHTML = skeletonRows(state.pageSize);
          applyCols();
          emptyGraceTimer = setTimeout(function(){
            emptyGraceTimer = null;
            if (isBusy() || !state.hasData || state.rows.length) return;
            renderEmptyState(false);
          }, 600);
        }
        return;
      }
      clearEmptyGrace();
      elTbody.innerHTML = state.rows.map(rowHtml).join("");
      applyCols();
      initTopicsCells();
    }
    function renderCount(){
      elHeading.classList.add("has-count");
      /* Skeleton for the WHOLE duration of isBusy(), not just before the first load — otherwise
         a stale count from before a filter/status change sits there unchanged while fresh data
         is still in flight, which reads as "nothing happened" rather than "loading". */
      if (isBusy()){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      var totalForView = currentTotal();
      var n = (totalForView != null) ? totalForView : (state.hasData ? state.rows.length : null);
      if (n == null){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      elHeadCount.textContent = UC.fmtTotal(n);
      elHeadCount.classList.remove("is-sk");
    }

    /* ---------------- header sorters ---------------- */
    var sortTimer = null;
    function applySort(field, dir){
      state.sortField = field; state.sortDir = dir;
      state.page = 1;
      /* Marked on the CLICK, not inside the debounce below: the outgoing event is delayed, but a
         loading state can be switched on by anything in between, and by then we still want it
         treated as a sort (dim) rather than as a fresh query (blank). */
      state.softReload = true;
      /* Dim on the CLICK. The outgoing event is debounced by a quarter second and the answer
         takes longer still — waiting for either means the table sits there looking like nothing
         happened at the exact moment the user expects a response. */
      beginSoftReload();
      persist(); syncHeadSorters(); populateSort();
      clearTimeout(sortTimer);
      sortTimer = setTimeout(function(){
        search.setLatest(null);
        /* Nothing has actually been requested until this moment, so this is where the loading
           state starts. UC.makeSearch and UC.makePager both do the same for their own events;
           sort was the one path that never set it, which is why the table never dimmed. */
        state.loading = true;
        fire("data-sort-fn", "uptSort", {
          order: orderValue(state.sortField, state.sortDir),
          sort_field: state.sortField, sort_dir: state.sortDir
        });
        renderTable();
      }, SORT_DEBOUNCE);
    }
    function populateSort(){
      if (!elSortMenu) return;
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

    /* ---------------- columns / pager / sort (core) ---------------- */
    var PROMPT_MIN = 260;
    var colsKit = UC.makeColumns({
      root: root, state: state, columns: COLUMNS,
      storePrefix: "upt", instanceId: instanceId,
      firstKey: "prompt", firstMin: PROMPT_MIN, noActions: true,
      /* Inactive prompts aren't being run, so there's nothing to show for any of these — no brand
         mentions, and no visibility/rank/sentiment either (those numbers come from the same runs).
         Removed from the grid template rather than hidden with CSS — a hidden cell would leave its
         track behind and knock the row out of line. */
      isHidden: function(c){
        return state.status === "inactive" &&
          (c.key === "brands" || c.key === "visibility" || c.key === "rank" || c.key === "sentiment");
      },
      rowHeightSwitch: ROW_HEIGHTS, badgeSel: ".upt-cols-badge", cellPrefixes: ["up","upt"],
      onChange: function(){ render(); }
    });
    var readCols = colsKit.readCols, writeCols = colsKit.writeCols;
    var readWidths = colsKit.readWidths, writeWidths = colsKit.writeWidths;
    var visibleCols = colsKit.visibleCols, effectiveCols = colsKit.effectiveCols;
    var layoutKeys = colsKit.layoutKeys, colMin = colsKit.colMin;
    var applyCols = colsKit.applyCols, startResize = colsKit.startResize;
    var populateCols = colsKit.populateCols, toggleCol = colsKit.toggleCol;
    var selectAllCols = colsKit.selectAllCols, syncColsBadge = colsKit.syncColsBadge;
    state.cols = colsKit.readCols();
    state.widths = colsKit.readWidths();

    var pagerKit = UC.makePager({
      root: root, state: state,
      /* Active/Inactive have separate totals (state.totalCount / state.totalCountInactive) —
         without this the pager always paginated against the Active count even while looking at
         the Inactive tab, showing the wrong page count and "X-Y of Z" for that view. */
      total: currentTotal,
      onClamp: function(){ persist(); },
      onChange: function(){ persist(); renderTable(); firePage(); }
    });
    var pageCount = pagerKit.pageCount, offset = pagerKit.offset;
    var renderPager = pagerKit.renderPager, renderPageSize = pagerKit.renderPageSize;
    var goToPage = pagerKit.goToPage, setPageSize = pagerKit.setPageSize;

    var sortKit = UC.makeHeadSort({
      root: root, state: state, cycles: HEAD_CYCLE, defaultSort: DEFAULT_SORT,
      onSort: function(f, d){ applySort(f, d); }
    });
    var syncHeadSorters = sortKit.syncHeadSorters, headSortClick = sortKit.headSortClick;

    /* The Prompt header is BOTH sortable and the one carrying the resize grip — unlike
       urls-table, where the draggable first column isn't sortable. Without this, finishing a
       drag left a click on the sortable header behind, which re-sorted and reloaded the table. */
    var lastResizeEnd = 0;
    root.addEventListener("pointerdown", function(e){
      var grip = e.target.closest(".up-grip");
      if (!grip) return;
      e.stopPropagation();
      startResize(e);
      var markEnd = function(){
        lastResizeEnd = +new Date();
        document.removeEventListener("pointerup", markEnd, true);
      };
      document.addEventListener("pointerup", markEnd, true);
    });

    function setRowHeight(mode){
      if (state.rowHeight === mode) return;
      state.rowHeight = mode;
      applyRowHeightClass();
      writeRowHeight(); populateCols();
    }

    function firePage(){
      search.setLatest(null);
      /* No dim here on purpose — only sort does that now. A page/size change falls back to
         whatever isBusy() drives on its own (skeleton, or nothing if it resolves fast). Also
         clears any dim a just-clicked sort left running, in case the two land in quick
         succession — endSoftReload(), not just the flag, or the class would stay on the root. */
      state.softReload = false;
      endSoftReload();
      fire("data-page-fn", "uptPage", { limit: state.pageSize, offset: offset(), page: state.page });
    }

    /* ---------------- export ----------------
       Hands off to the shared export popup component, exactly like urls-table/domains-table:
       put that popup's instanceId in data-export-instance. */
    function openExport(){
      var id = String(root.getAttribute("data-export-instance") || "").trim();
      var fn = window.upstreemExportOpen
        || (window.parent && window.parent.upstreemExportOpen)
        || (window.top && window.top.upstreemExportOpen);
      if (typeof fn !== "function"){
        console.warn("[prompts-table] window.upstreemExportOpen not found — is the export popup " +
          "component placed on this page?");
        return;
      }
      if (!id || id === "EXPORT_INSTANCE_ID"){
        console.warn("[prompts-table] data-export-instance is not set. Put the export popup's " +
          "instanceId there so this button knows which popup to open.");
        return;
      }
      try { fn(id); } catch(e){}
    }

    /* ---------------- tooltips (shared via core) ---------------- */
    var _tips = UC.makeTooltips(root, function(){ return isDark; });
    var showTipWide = _tips.showTipWide, hideTip = _tips.hideTip, unsuppressTip = _tips.unsuppress;
    /* Full prompt text on a short hover-delay, but only when actually clipped — mirrors
       urls-table's title hover, checking both dimensions since the clip can be a 1/2-line
       vertical clamp (default/compact) or, in principle, horizontal overflow. */
    var promptTipTimer = null, promptTipWrap = null;
    root.addEventListener("mouseover", function(e){
      var wrap = e.target.closest(".upt-prompt-wrap");
      if (!wrap || !root.contains(wrap)) return;
      if (wrap === promptTipWrap) return;
      promptTipWrap = wrap;
      /* Same thing the core's delegated [data-tip] path does on mouseover: entering a new trigger
         lifts the suppression a previous click left behind. These wraps carry no data-tip, so
         nothing else would ever clear it. */
      if (unsuppressTip) unsuppressTip();
      clearTimeout(promptTipTimer);
      promptTipTimer = setTimeout(function(){
        var pt = wrap.querySelector(".upt-prompt-text");
        if (!pt) return;
        var clipped = pt.scrollHeight > pt.clientHeight + 1 || pt.scrollWidth > pt.clientWidth + 1;
        if (clipped) showTipWide(pt, pt.textContent);
      }, 400);
    });
    root.addEventListener("mouseout", function(e){
      var wrap = e.target.closest(".upt-prompt-wrap");
      if (!wrap || wrap !== promptTipWrap) return;
      var to = e.relatedTarget;
      if (to && to.closest && to.closest(".upt-prompt-wrap") === wrap) return;
      promptTipWrap = null; clearTimeout(promptTipTimer); hideTip();
    });

    /* ---------------- column explainers ----------------
       Positioning/flip/caret is UC.makeExplain (core); only the per-metric copy and the visual
       sample are this component's own. Visibility/Rank/Sentiment deliberately do NOT reuse the
       real row cell builders (up-num/up-sent/up-rank-group) here: the explainer panel has its
       own plain "value + trend" look — same one urls-table's "Share" explainer uses — not the
       table's chip styling. */
    /* Visibility/Rank/Sentiment/Brand Mentions come from UC.EXPLAIN_TEXT (core) — the one shared
       wording every table with these columns uses now. Market has no counterpart elsewhere. */
    var EXPLAIN_LOCAL = {
      market: { h: "Market", t: "The market this prompt is tracked in." }
    };
    var EXPLAIN_FALLBACK = {
      visibility: { h: "Visibility", t: "How often the brand appears in AI answers for this prompt." },
      rank:       { h: "Rank", t: "The brand's average position among all brands mentioned for this prompt. A lower number is better." },
      sentiment:  { h: "Sentiment", t: "How positively the brand is described when it's mentioned for this prompt." },
      brands:     { h: "Brand Mentions", t: "Which of your tracked brands are mentioned in AI answers for this prompt. Hover a logo to see its name." }
    };
    function explainInfo(kind){
      if (EXPLAIN_LOCAL[kind]) return EXPLAIN_LOCAL[kind];
      if (UC.explainCopy){
        if (kind === "visibility") return UC.explainCopy("visibility", { scope: " for this prompt" });
        if (kind === "rank") return UC.explainCopy("rank", { scope: " for this prompt" });
        if (kind === "sentiment") return UC.explainCopy("sentiment", { scope: " for this prompt" });
        if (kind === "brands") return UC.explainCopy("brands", { scope: " in AI answers for this prompt" });
      }
      return EXPLAIN_FALLBACK[kind] || null;
    }
    function explainVisual(kind){
      if (kind === "visibility"){
        return '<span class="upt-explain-row">34%' +
          '<span class="upt-explain-up">' + UC.TREND_UP + '</span>' +
          '<span class="upt-explain-up">2.9%</span></span>';
      }
      if (kind === "rank"){
        return '<span class="upt-explain-row">' + UC.HASH_ICON + '2.3' +
          '<span class="upt-explain-down">' + UC.TREND_DOWN + '</span>' +
          '<span class="upt-explain-down">0.4</span></span>';
      }
      if (kind === "sentiment"){
        return '<span class="upt-explain-row">78' +
          '<span class="upt-explain-up">' + UC.TREND_UP + '</span>' +
          '<span class="upt-explain-up">4</span></span>';
      }
      if (kind === "brands"){
        return '<span class="upt-explain-row" style="gap:0">' +
          '<span class="upt-explain-dot"></span><span class="upt-explain-dot" style="margin-left:-10px"></span>' +
          '<span class="upt-explain-dot" style="margin-left:-10px"></span>' +
          '<span class="upt-explain-dot upt-explain-more" style="margin-left:-10px">+2</span></span>';
      }
      if (kind === "market"){
        return '<div style="display:flex;flex-direction:column;gap:6px;">' + marketCell("DE") + marketCell("US") + '</div>';
      }
      return "";
    }
    UC.makeExplain({
      root: root, triggerSel: ".up-th-info", getIsDark: function(){ return isDark; },
      html: function(kind){
        var info = explainInfo(kind);
        if (!info) return "";
        return '<div class="upt-explain-vis">' + explainVisual(kind) + '</div>' +
          '<div class="upt-explain-h">' + esc(info.h) + '</div>' +
          '<div class="upt-explain-t">' + esc(info.t) + '</div>';
      }
    });

    /* ---------------- dropdowns ---------------- */
    var POP_GROUP = "upt-" + instanceId;
    [elSort, elCols, elMent].forEach(function(p){
      if (!p) return;
      p.__upPop = UC.makePopover({
        wrap: p, menu: p.querySelector(".up-sort-menu, .up-cols-menu, .up-ment-menu"), opener: p.querySelector("button"), group: POP_GROUP
      });
    });
    function popOf(pop){ return pop && pop.__upPop; }
    function setPopOpen(pop, open){
      var h = popOf(pop); if (!h) return;
      if (open) h.open(); else h.close(false);
    }
    function closePops(except){
      [elSort, elCols, elMent].forEach(function(p){ if (p && p !== except) setPopOpen(p, false); });
    }

    function ownsTarget(tg){
      return root.contains(tg) || (elSortMenu && elSortMenu.contains(tg)) || (elColsMenu && elColsMenu.contains(tg))
          || (elMentMenu && elMentMenu.contains(tg)) || (elBulk && elBulk.contains(tg));
    }
    document.addEventListener("click", function(e){
      if (!ownsTarget(e.target)) return;
      var inMenu = e.target.closest(".up-sort-menu, .up-cols-menu, .up-ment-menu");
      var onOpener = e.target.closest(".up-sort-btn, .up-cols-btn, .up-ment-btn");
      if (!inMenu && !onOpener) closePops();

      /* --- bulk action bar (lives on document.body; ownsTarget lets its clicks through) --- */
      if (elBulk && elBulk.contains(e.target)){
        /* Marked HERE, while the clicked node is still attached. Handlers below rebuild the
           topic list via innerHTML, so by the time the outside-click listener further down sees
           this same event, e.target is detached and elBulk.contains() returns false — which
           closed the panel on every topic click. Same trap urls-table documents for its filter
           menu. */
        e.__uptInBar = true;
        if (e.target.closest("[data-bulk-clear]")){ setTopicMenuOpen(false); clearSelection(); return; }
        if (e.target.closest("[data-bulk-all]")){
          state.selectAllMatching = true;
          persist(); renderBulkBar(); syncSelCount(); fireSelect(); syncStagedTopicsToSelection(); return;
        }
        if (e.target.closest("[data-bulk-undoall]")){
          invalidateSelectAll();
          persist(); renderBulkBar(); syncSelCount(); fireSelect(); syncStagedTopicsToSelection(); return;
        }
        if (e.target.closest("[data-bulk-topics]")){ setTopicMenuOpen(!topicMenuOpen()); return; }
        var tRow2 = e.target.closest("[data-topic]");
        if (tRow2){ toggleStagedTopic(tRow2.getAttribute("data-topic")); return; }
        if (e.target.closest("[data-topic-reset]")){ resetStagedTopics(); return; }
        if (e.target.closest("[data-topic-search-clear]")){
          topicQuery = "";
          var inp2 = elBulk.querySelector(".upt-topicsearch-in");
          if (inp2) inp2.value = "";
          var head2 = elBulk.querySelector(".upt-topichead");
          if (head2) head2.classList.remove("has-text");
          renderTopicList();
          if (inp2) inp2.focus();
          return;
        }
        if (e.target.closest("[data-topic-apply]")){ applyStagedTopics(); return; }
        var pickBtn = e.target.closest("[data-topic-pick]");
        if (pickBtn){
          var kind = pickBtn.getAttribute("data-topic-pick");
          pickOpen = pickOpen === kind ? null : kind;
          if (pickOpen === "emoji") ensureEmojiLib();   // fire-and-forget; the tag upgrades itself once defined
          renderTopicList();
          return;
        }
        var colorBtn = e.target.closest("[data-color]");
        if (colorBtn){
          newTopicColor = colorBtn.getAttribute("data-color");
          /* Stays open — same reasoning as the emoji picker above. */
          renderTopicList();
          return;
        }
        var createBtn = e.target.closest("[data-topic-create]");
        if (createBtn){
          /* Same hand-off as the plain Add Topic button, plus the typed name and whatever emoji/
             color were picked — the create UI can use them straight away instead of asking again. */
          var cp = selectionPayload();
          var newName = createBtn.getAttribute("data-topic-create") || "";
          cp.new_topic_name = newName;
          cp.new_topic_emoji = newTopicEmoji || "";
          var pickedHex = newTopicColor || TOPIC_COLOR_PALETTE[0];
          cp.new_topic_hex_light = pickedHex;
          cp.new_topic_hex_dark = pickedHex;
          fire("data-addtopics-fn", "uptAddTopics", cp);
          /* The query that got us into "no matches, create it" mode is now stale the moment the
             fresh topics list lands — left alone, it kept filtering the rebuilt chip list down to
             just the new topic (the only one still matching that exact typed text) until the next
             keystroke nudged a re-filter. Clear it now, and remember the name so the matching
             topic in the next list gets auto-staged instead of the user having to re-find and
             re-click it. */
          topicQuery = ""; pendingAutoStageName = newName.trim();
          var cInp = elBulk.querySelector(".upt-topicsearch-in");
          if (cInp) cInp.value = "";
          var cHead = elBulk.querySelector(".upt-topichead");
          if (cHead) cHead.classList.remove("has-text");
          renderTopicList();
          return;
        }
        if (e.target.closest("[data-topic-add]")){
          /* Opens the shared create modal rather than firing straight off — the selection itself
             is untouched either way (still only leaves via Apply), and the bulk panel stays open
             behind it since the staged selection is still live and the user may come back to it. */
          addTopicModal.open("create", null);
          return;
        }
        if (e.target.closest("[data-bulk-status]")){ setTopicMenuOpen(false); applyBulkStatus(); return; }
        if (e.target.closest("[data-bulk-delete]")){ applyBulkDelete(); return; }
        return;
      }

      /* --- Active / Inactive view switch --- */
      var stBtn = e.target.closest("[data-status]");
      if (stBtn){ setStatus(stBtn.getAttribute("data-status")); return; }

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
        state.brandMentioned = "";
        state.page = 1;
        persist(); syncBrand();
        search.cancel(); runSearch();
        state.softReload = false;
        fire("data-brand-fn", "uptBrand", { brand_mentioned: "" });
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
      if (e.target.closest(".up-search-btn")){ closePops(); toggleSearch(); return; }
      if (e.target.closest(".up-export")){ openExport(); return; }
      if (e.target.closest(".upt-brand-toggle")){ closePops(); cycleBrand(); return; }

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

      // --- selection (must come before header-sorter / row-click) ---
      if (e.target.closest(".upt-selcount-clear")){ clearSelection(); return; }
      if (e.target.closest("[data-selectall]")){ toggleSelectAll(); return; }
      var selBox = e.target.closest("[data-select]");
      if (selBox){ e.stopPropagation(); toggleSelectRow(selBox.getAttribute("data-select")); return; }

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

      var sortBtn = e.target.closest(".up-sort-btn");
      if (sortBtn){
        var openS = !elSort.classList.contains("is-open");
        closePops(elSort);
        if (openS) populateSort();
        setPopOpen(elSort, openS);
        return;
      }

      // --- sort menu ---
      var sf = e.target.closest("[data-sortfield]");
      if (sf){ applySort(sf.getAttribute("data-sortfield"), state.sortDir); return; }
      if (e.target.closest("[data-sortdir]")){
        applySort(state.sortField, state.sortDir === "desc" ? "asc" : "desc");
        return;
      }

      // --- header sorters ---
      var th = e.target.closest(".up-th.is-sortable");
      if (th){
        if (e.target.closest(".up-grip")) return;                 // the grip is not a sort target
        if (+new Date() - lastResizeEnd < 300) return;            // the click that ends a drag
        headSortClick(th.getAttribute("data-sortcol")); return;
      }

      /* --- topics cell (own event; must come BEFORE the row-click handler) ---
         Clicking the tags opens topic management for that prompt rather than the prompt's own
         detail page, so it deliberately swallows the row click. Inactive prompts don't get topic
         management at all (there's nothing to tag on a prompt you've turned off) — the cell falls
         through untouched so a click there behaves like anywhere else in the row. */
      var topicsTd = state.status !== "inactive" ? e.target.closest(".upt-td-topics") : null;
      if (topicsTd && root.contains(topicsTd)){
        var tRow = topicsTd.closest(".up-row");
        if (tRow && !tRow.classList.contains("up-tsk")){
          e.stopPropagation();
          var tId = tRow.getAttribute("data-id");
          if (tId){
            var tRowData = findRowById(tId);
            fire("data-topics-fn", "uptTopicsClick", {
              prompt_id: tId,
              prompt_text: tRowData ? String(tRowData.prompt_text || "") : "",
              tag_ids: tRowData && tRowData.tags ? tRowData.tags.map(function(t){ return String(t.id); }).join(",") : ""
            });
          }
        }
        return;
      }

      // --- row click (Inactive view: nothing to open, no event) ---
      var row = e.target.closest(".up-row");
      if (row && !row.classList.contains("up-tsk") && state.status !== "inactive"){
        var d = row.getAttribute("data-id");
        if (d) fire("data-rowclick-fn", "uptRowClick", { prompt_id: d });
      }
    });

    root.addEventListener("keydown", function(e){
      if (e.key !== "Enter" && e.key !== " ") return;
      var chk = e.target.closest && e.target.closest(".upt-check");
      if (chk){
        e.preventDefault();
        if (chk.hasAttribute("data-selectall")) toggleSelectAll();
        else { var sid = chk.getAttribute("data-select"); if (sid) toggleSelectRow(sid); }
        return;
      }
      var row = e.target.closest && e.target.closest(".up-row");
      if (!row || row.classList.contains("up-tsk") || state.status === "inactive") return;
      e.preventDefault();
      var d = row.getAttribute("data-id");
      if (d) fire("data-rowclick-fn", "uptRowClick", { prompt_id: d });
    });

    if (elSearchIn){
      elSearchIn.addEventListener("input", onSearchInput);
      elSearchIn.addEventListener("keydown", function(e){
        if (e.key === "Escape"){ e.stopPropagation(); toggleSearch(); }
        if (e.key === "Enter"){ search.cancel(); if (state.query.length >= MIN || !state.query.length) runSearch(); }
      });
    }

    /* The topic menu hangs off a body-level bar, so its outside-click can't go through the
       component's own ownsTarget-guarded handler — it needs to see clicks anywhere. */
    document.addEventListener("click", function(e){
      if (!topicMenuOpen()) return;
      if (e.__uptInBar) return;                              // handled inside the bar already
      if (elBulk && elBulk.contains(e.target)) return;
      /* The Add Topic modal is a deliberate overlay spawned FROM this panel's own "+ Add Topic"
         button, but — like the bar itself — it's body-mounted outside elBulk, so without this it
         reads as a click "away" from the bar and closes the topic panel behind it on every click
         inside the modal, including its own Save button. Checked via the DOM (not
         addTopicModal.isOpen()) on purpose: Save's own click handler closes the modal
         SYNCHRONOUSLY during the same bubble phase, before this document-level listener runs, so
         an isOpen() check here would already read false by the time it matters. */
      if (e.target.closest(".up-topicmodal-backdrop")) return;
      /* Ticking a row (or header select-all) checkbox while the topic editor is open isn't
         "clicking away" — it's still building the same selection the editor is working on, and
         used to close the panel on every tick, which was especially jarring right as the escape-
         hatch link appears/disappears (that swap alone forced a bar rebuild that this listener's
         very next click would then immediately undo). */
      if (e.target.closest("[data-select], [data-selectall]")) return;
      setTopicMenuOpen(false);
    });
    /* Escape unwinds one layer at a time: the add-topic modal (its own scoped listener, inside
       UC.makeTopicModal), then the topic menu, then the selection itself. If the modal is open,
       do nothing here — its own Escape listener already closes just that layer on this same
       keydown, and closing the topic panel too on the same keystroke would unwind two layers at
       once. Deliberately no focus trap on the bar itself — it's a toolbar, and trapping would
       break shift-arrow range selection in the table behind it. */
    document.addEventListener("keydown", function(e){
      if (e.key !== "Escape" && e.key !== "Esc") return;
      if (addTopicModal.isOpen()) return;
      if (topicMenuOpen()){ setTopicMenuOpen(false); return; }
      if (bulkCount() > 0) clearSelection();
    });

    var lastProcAttr = String(root.getAttribute("data-processing") || "") + "|" +
                       String(root.getAttribute("data-processing2") || "");
    var explicitOverride = false;
    function isBusy(){ return !!state.loading || !!state.extLoading; }
    var syncFromAttrs = function(){
      var wantDark = isYes(root.getAttribute("data-isdark"));
      var changed = false;
      if (wantDark !== isDark){
        isDark = wantDark;
        if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
        if (window.__uptUstTopics) window.__uptUstTopics.setTheme(isDark ? "dark" : "light");
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
        if (wantProc !== state.extLoading){ state.extLoading = wantProc; changed = true; }
      }
      if (changed) render();
    };
    new MutationObserver(syncFromAttrs).observe(root, {
      attributes: true, attributeFilter: ["data-isdark","data-processing","data-processing2"]
    });
    syncFromAttrs();
    new MutationObserver(syncBrand).observe(root, {
      attributes: true, attributeFilter: ["data-brand-name","data-brand-logo"]
    });

    /* ---------------- toolbar fit (mobile) ----------------
       Same mechanism as urls-table/domains-table: measure the actual gap between the heading and
       the tools row, drop one tool at a time (least important first) until it fits again. This
       table never had this wired up at all — is-w0..is-w3 only ever did anything because
       core.css's rules for them are generic; nothing here was ever adding the classes. */
    var SEARCH_OPEN_WIDTH = 202;
    var MIN_HEAD_GAP = 64;
    var TOOLBAR_TIERS = ["is-w3", "is-w2", "is-w1", "is-w0"];   // is-w2 now applies: this table has the mentioned-brands dropdown too
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

    /* responsive: drop columns rather than squeezing them */
    function applyResponsive(){
      var w = root.getBoundingClientRect().width || 0;
      if (!w) return;
      var before = root.className;
      search.syncTakeover();
      fitToolbar();
      root.classList.toggle("is-t1", w < 560);
      root.classList.toggle("is-narrow", w < 860);
      root.classList.toggle("is-vnarrow", w < 620);
      /* Unconditional: which columns fit is now a continuous function of the width (see autoFit
         in UC.makeColumns), not something that only changes when one of the tier classes above
         flips. Gating this on a class change was why the table happily overflowed anywhere
         between two breakpoints. applyCols() itself no-ops when the resulting layout is
         identical, so calling it every frame is cheap. */
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
      if (UC.onResize) return UC.onResize(el, fn);
      if (window.ResizeObserver){
        var raf = null;
        new ResizeObserver(function(){
          if (raf) return;
          raf = requestAnimationFrame(function(){ raf = null; fn(); });
        }).observe(el);
      } else {
        window.addEventListener("resize", UC.rafThrottle(fn));
      }
    }
    /* One coalesced responsive pass per frame (core). The old pairing of a
       ResizeObserver AND a window-resize listener ran the whole measure/drop cascade
       TWICE per frame while a window was being dragged, and each pass forces several
       synchronous reflows. onResize also skips frames where the width did not change. */
    onResizeCompat(root, applyResponsive);

    /* sticky header machinery (core) */
    var _sticky = UC.makeSticky(root, elHead);
    function syncTheadOffset(){ _sticky.syncTheadOffset(); }
    window.addEventListener("resize", UC.rafThrottle(function(){ _sticky.applySticky(); }));
    _sticky.applySticky();

    function render(){
      renderTable(); renderCount(); syncHeadSorters(); syncColsBadge(); syncSelectAll(); syncBrand();
      syncMentLabel();
      renderPageSize(); renderPager(); applyCols(); applyResponsive();
      renderStatusTabs(); renderBulkBar();
      if (root.classList.contains("up-sticky")) syncTheadOffset();
    }

    if (state.query){ elSearchIn.value = state.query; elSearch.classList.add("is-open", "has-text"); }
    populateSort(); populateCols(); populateMent(); render();

    return {
      root: root,
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          isDark = isYes(params.isDark);
          if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
          if (window.__uptUstTopics) window.__uptUstTopics.setTheme(isDark ? "dark" : "light");
        }
        if (params.requestId != null && search.latestReqId() != null && String(params.requestId) !== String(search.latestReqId())) return;
        if (params.rows != null){
          state.rows = Array.isArray(params.rows) ? params.rows : [];
          state.hasData = true;
          /* An empty rows delivery with no accompanying total (e.g. every prompt just got
             deactivated, so the Active RPC now genuinely returns nothing) has no way to still
             imply a non-zero count for the tab it's FOR — left alone, the head count and "Select
             all N" kept showing whatever was there before the change. Only defaults the total for
             whichever tab this delivery is actually for; an explicit totalCount/totalCountInactive
             in the same payload always wins over this. */
          if (!state.rows.length){
            if (params.totalCount == null && state.status === "active") state.totalCount = 0;
            if (params.totalCountInactive == null && state.status === "inactive") state.totalCountInactive = 0;
          }
        }
        if (params.totalCount != null) state.totalCount = toNum(params.totalCount);
        /* Not in the payload yet — the Inactive tab simply renders without a count until it is. */
        if (params.totalCountInactive != null) state.totalCountInactive = toNum(params.totalCountInactive);
        if (params.brands != null){
          var _b = Array.isArray(params.brands) ? params.brands : [];
          if (_b.length) state.brands = _b;   // an empty list is a failed/not-yet-loaded fetch, not "no brands"
          populateMent();
        }
        if (params.topics != null){
          var _t = Array.isArray(params.topics) ? params.topics : [];
          if (_t.length) state.topics = _t;   // ignore a stray empty list so it can't wipe the editor
          /* Auto-stage the topic just created via the inline "Create '…'" row (see the
             data-topic-create handler) — it just landed in this fresh list, matched by the exact
             name that was typed. Only while the panel still has a live staged draft: if the user
             closed it in the meantime, state.stagedTopicIds is null and there's nothing to add to. */
          if (pendingAutoStageName && state.stagedTopicIds){
            var match = _t.filter(function(t){ return String(t && t.name || "").trim() === pendingAutoStageName; })[0];
            if (match) state.stagedTopicIds[topicId(match)] = true;
            pendingAutoStageName = null;
          }
        }
        if (params.rows != null){ state.loading = false; state.softReload = false; endSoftReload(); }
        if (!explicitOverride && hasProcessingAttr()) state.extLoading = readProcessing();
        persist(); render();
      },
      setLoading: function(on){
        explicitOverride = true;
        LOADING_EXPLICIT[instanceId] = true;
        state.extLoading = isYes(on);
        if (!state.extLoading){ state.loading = false; endSoftReload(); }
        persist(); render();
      },
      reset: function(){
        /* Deliberately narrow: only the bulk-topic popover state + selection, per explicit user
           request — NOT search/sort/paging/status/widths, which used to also get wiped here and
           surprised the user by silently flipping the table back to the Active tab. */
        var hadSelection = state.selectAllMatching || Object.keys(state.selected || {}).length > 0;
        var hadTopicMenu = topicMenuOpen();
        var hadModal = addTopicModal.isOpen();
        /* True no-op when there's nothing to reset — the caller is expected to fire this on every
           filter/page-leave trigger, not just when something was actually open, so skipping the
           persist()+render() round trip here matters for how often this realistically fires. */
        if (!hadSelection && !hadTopicMenu && !hadModal) return true;

        state.selected = {}; invalidateSelectAll();
        if (hadTopicMenu) setTopicMenuOpen(false);
        /* Separate from the bulk topic panel above — this is the "Add Topic" modal, which can be
           open on its own (it isn't nested inside the bulk bar's is-topics state). */
        if (hadModal) addTopicModal.close();
        persist(); render();
        return true;
      },
      destroy: function(){
        /* Both are parented to document.body, so neither goes away with the component's own
           markup when Bubble rebuilds the element — each has to be removed explicitly or it
           lingers as an orphan over the new instance. */
        if (elBulk && elBulk.parentNode) elBulk.parentNode.removeChild(elBulk);
        elBulk = null;
        addTopicModal.destroy();
        if (root.__uptController === this) root.__uptController = null;
        var li = LIVE_ROOTS.indexOf(root);
        if (li !== -1) LIVE_ROOTS.splice(li, 1);
      }
    };
  }

  /* ================= init / multi-instance bootstrap ================= */
  /* Cross-page cleanup (one shared observer for every instance, not one per root — the check
     itself is a cheap property read, so batching them behind a single document-wide observer
     costs nothing extra per instance). Bubble usually just re-renders the same root when a
     reusable is swapped back in, but when it's actually removed from the DOM (repeating
     structures, conditional "only when" visibility) neither the bulk bar nor the Add Topic
     modal — both parented to document.body — would otherwise ever notice, and they'd sit
     orphaned over whatever page Bubble shows next. This only catches genuine removal; a
     display:none-style hide (no DOM change) still needs the manual window.resetPromptsTable(id)
     fallback wired to a "user leaves this page" Bubble workflow. */
  var LIVE_ROOTS = [];
  var rootWatcher = null;
  function watchRootRemoval(root){
    LIVE_ROOTS.push(root);
    if (rootWatcher) return;
    rootWatcher = new MutationObserver(function(){
      for (var i = LIVE_ROOTS.length - 1; i >= 0; i--){
        var r = LIVE_ROOTS[i];
        if (!r.isConnected){
          LIVE_ROOTS.splice(i, 1);
          var ctrl = r.__uptController;
          if (ctrl && ctrl.reset) ctrl.reset();
        }
      }
    });
    rootWatcher.observe(document.body, { childList: true, subtree: true });
  }
  function initRoot(root){
    if (root.__uptController) return root.__uptController;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;   // placeholder not replaced yet
    var ctrl = makeController(root);
    if (!ctrl) return null;
    root.__uptController = ctrl;
    watchRootRemoval(root);
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
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".upt-root"));
    if (!ctrl){
      /* Silent otherwise: renderPromptsTable() is called, but no matching .upt-root exists (yet,
         or ever) — e.g. instanceId doesn't match data-instance on any root, or the root's
         data-instance is still the literal "INSTANCE_ID" placeholder. That reads as "the table
         ignored my data" with zero signal, so name exactly what was asked for vs what's on the
         page. */
      var have = Array.prototype.map.call(document.querySelectorAll(".upt-root"), function(r){
        return r.getAttribute("data-instance") || "(none)";
      });
      if (window.console) console.warn("[prompts-table] renderPromptsTable: no matching .upt-root for instanceId " +
        JSON.stringify(id) + ". Roots on this page have data-instance: " + JSON.stringify(have));
      return false;
    }
    ctrl.update(params);
    return true;
  }
  function doLoading(id, on){ var c = resolve(id); if (!c) return false; c.setLoading(on); return true; }
  /* Fills the bulk topic editor. Accepts an array or a JSON string of
     {id, name, emoji, hex_light, hex_dark} — the same shape the rows' own `tags` use, so you can
     feed it straight from your topics table. Load it once on page load, like the brand lists in
     urls-table/domains-table. */
  function doTopics(id, topics){
    var list = topics;
    /* Accepts either a ready array OR the raw Bubble text. Raw text goes through the shared
       core parser, so there is exactly ONE implementation of the "Bubble emits unquoted emoji
       and yes/no" workaround in the codebase. */
    if (typeof list === "string") list = UC.parseBubbleJson(list);
    if (!Array.isArray(list)) list = [];
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".upt-root"));
    if (!ctrl){
      if (window.console) console.warn("[prompts-table] setPromptsTableTopics: no .upt-root matches instanceId " +
        JSON.stringify(id) + " — the topics were dropped.");
      return false;
    }
    if (!list.length && window.console) console.warn("[prompts-table] setPromptsTableTopics got an empty list.");
    ctrl.update({ topics: list });
    return true;
  }
  function doReset(id){ var c = resolve(id); if (!c) return false; return c.reset(); }
  /* Fills the mentioned-brands filter dropdown. Same "fed in once at page load, full unfiltered
     list, raw string OR array" contract as every other table's brands setter (urls-table,
     responses-table). */
  function doBrands(id, brands){
    var list = brands;
    if (typeof list === "string") list = UC.parseBubbleJson(list);
    if (!Array.isArray(list)) list = [];
    list = list.filter(function(x){ return x != null; });
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".upt-root"));
    if (!ctrl){
      if (window.console) console.warn("[prompts-table] setPromptsTableBrands: no .upt-root matches instanceId " +
        JSON.stringify(id) + " — the brands were dropped.");
      return false;
    }
    if (!list.length) return true;   // an empty list is a failed/not-yet-loaded fetch, not "no brands"
    ctrl.update({ brands: list });
    return true;
  }

  var mount = UC.makeMount({
    rootClass: "upt-root", notPortal: true,
    ctrlProp: "__uptController",
    resolveLocal: "__uptResolveLocal",
    queue: "__uptBootQueue",
    initRoot: initRoot,
    api: { renderPromptsTable: doRender, setPromptsTableLoading: doLoading, resetPromptsTable: doReset,
           setPromptsTableTopics: doTopics, setPromptsTableBrands: doBrands },
    forwardShape: { renderPromptsTable: "params", resetPromptsTable: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end uptRun

  uptBoot(50); // retry for ~5s before giving up on core.js
})();
