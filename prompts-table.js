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
    ["renderPromptsTable", "setPromptsTableLoading", "resetPromptsTable", "setPromptsTableTopics", "setPromptsTableBrands",
     "setPromptsTableGroups", "setPromptsTableGroupPrompts"].forEach(function(n){
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
        '.ust-tag{height:28px;padding:0 10px;border-radius:8px;display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;border:1px solid transparent;background:color-mix(in srgb,var(--ust-tag-color,#6b7280) 10%,transparent);color:var(--ust-tag-color,#4b5563);font-size:12px;line-height:1;font-weight:500;white-space:nowrap;cursor:pointer;user-select:none;}',
        '.ust-tag-emoji{font-size:12px;line-height:1;}',
        '.ust-tag-label{white-space:nowrap;}',
        '.ust-empty{display:inline-flex;align-items:center;color:#a0a5ad;font-size:13px;line-height:1;}',
        /* Dash shrinks/fades out, "+ Add" grows/fades in from width:0 — same idiom as the topic
           chip checkbox elsewhere in this file (a max-width transition, not display, since
           display can\'t be animated). Hover trigger lives on .upt-td-topics in prompts-table.css
           (the whole cell, not just this span, is the click/hover target — see the click handler
           that opens the Edit Topics popup from anywhere in the cell, openEditTopicsModal). */
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
    { key: "visibility", label: "Visibility",      w: "minmax(150px, 150px)", min: 150, prio: 70 },
    { key: "rank",       label: "Rank",            w: "minmax(90px, 128px)",  min: 90,  dropAt: "vnarrow", prio: 40 },
    { key: "sentiment",  label: "Sentiment",       w: "minmax(120px, 128px)", min: 120, dropAt: "narrow",  prio: 30 },
    /* 178px, same as urls-table's identical column: 4 × 32px avatars (−6px overlap each) plus
       the "+N" label plus the cell's own 28px padding, with headroom for the hover spread.
       A %-based floor let it collapse below that and clipped the stack. */
    /* No dropAt was a real bug, not a deliberate "always show" — every other column has one, and
       leaving this the sole exception meant the narrowest tier still showed Prompt + Visibility
       + Brand Mentions instead of just the two columns that are supposed to survive down there. */
    { key: "brands",     label: "Brand Mentions",  w: "minmax(178px, 1fr)", min: 178, dropAt: "vnarrow", prio: 50 },
    /* Topics is the column people actually manage, so it's the one that gets to keep growing --
       Visibility/Rank/Sentiment/Market are all hard-capped now (see their own w: above/below), so
       any spare row width flows to Topics (and Brands/Created's own smaller fr shares) instead. */
    { key: "topics",     label: "Topics",          w: "minmax(12%, 1.3fr)", min: 150, dropAt: "vnarrow", prio: 60 },
    /* Reference data, never needs to eat spare row width -- capped at 128px same as Rank/Sentiment,
       not left on a %/fr leash that grows it back out on a wide screen. */
    { key: "market",     label: "Market",          w: "minmax(90px, 128px)", min: 90,  dropAt: "narrow",  prio: 20 },
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

  /* Custom groups live in localStorage under exactly this key and shape, per the spec:
       promptGroups = [{ "key": "SUV & Hybrid", "tag_ids": ["uuid1","uuid2"] }]
     Global, not per instance: a grouping the user invented is a property of how THEY think about
     their topics, not of one placement of the table. Never written to the database. */
  var GROUPS_KEY = "promptGroups";
  function readCustomGroups(){
    try {
      var raw = window.localStorage.getItem(GROUPS_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr.filter(function(g){
        return g && typeof g.key === "string" && g.key && Array.isArray(g.tag_ids) && g.tag_ids.length;
      });
    } catch(e){ return []; }
  }
  function writeCustomGroups(list){
    try { window.localStorage.setItem(GROUPS_KEY, JSON.stringify(list || [])); } catch(e){}
  }

  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var saved = STORE[instanceId] || {};

    function gKey(k){ return "upt_" + k + "__" + instanceId; }
    function readGrouped(){
      try { return window.localStorage.getItem(gKey("grouped")) === "yes"; } catch(e){ return false; }
    }
    function writeGrouped(v){
      try { window.localStorage.setItem(gKey("grouped"), v ? "yes" : "no"); } catch(e){}
    }
    function readGroupSort(){
      try {
        var v = window.localStorage.getItem(gKey("groupsort"));
        return (v === "visibility" || v === "name") ? v : "count";
      } catch(e){ return "count"; }
    }
    function writeGroupSort(v){ try { window.localStorage.setItem(gKey("groupsort"), v); } catch(e){} }
    function readGroupSortDir(){
      try { return window.localStorage.getItem(gKey("groupsortdir")) === "asc" ? "asc" : "desc"; } catch(e){ return "desc"; }
    }
    function writeGroupSortDir(v){ try { window.localStorage.setItem(gKey("groupsortdir"), v); } catch(e){} }
    function readGroupMode(){
      try {
        var v = window.localStorage.getItem(gKey("groupmode"));
        return (v === "topics" || v === "custom") ? v : "both";
      } catch(e){ return "both"; }
    }
    function writeGroupMode(v){ try { window.localStorage.setItem(gKey("groupmode"), v); } catch(e){} }
    function readGroupsWide(){
      try { return window.localStorage.getItem(gKey("groupswide")) === "yes"; } catch(e){ return false; }
    }
    function writeGroupsWide(v){
      try { window.localStorage.setItem(gKey("groupswide"), v ? "yes" : "no"); } catch(e){}
    }

    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
    if (window.__uptUstTopics) window.__uptUstTopics.setTheme(isDark ? "dark" : "light");

    var elHeadCount = root.querySelector(".up-head-count");
    var elTbody     = root.querySelector(".up-tbody");
    var elFoot      = root.querySelector(".up-foot");
    var elSearch    = root.querySelector(".up-search");
    var elSearchIn  = root.querySelector(".up-search-input");
    var elBrand     = root.querySelector(".upt-brand-toggle");
    /* Overwrites whatever data-tip a hand-pasted root copy already carries -- this is a static
       Bubble element, not one this file builds, so a wording fix only reaches existing embeds if
       the CDN'd JS itself rewrites the attribute at init. Same reasoning as the .upt-status
       relocation above, applied to a text change instead of a DOM move. */
    if (elBrand) elBrand.setAttribute("data-tip", "Filter for your brand mentions");
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
        '<button class="up-ment-btn" type="button" data-tip="Filter for brand mentions" aria-haspopup="menu" aria-expanded="false">' +
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
      stagedTopicIds: null,                 // {id: true, ...} — the topic editor's draft selection

      /* ---- grouped-by-topic view (optional, layered ON TOP of the flat table) ----
         Deliberately ACTIVE-ONLY: the Inactive view stays exactly the flat table it always was.
         Grouping inactive prompts by topic answers a question nobody asks — you go to Inactive to
         see what you switched off, not to compare topic performance. */
      grouped: readGrouped(),
      groups: [],                           // header rows from cached_prompt_topics_grouped_v1
      groupsHasData: false,
      groupsLoading: false,
      groupSort: readGroupSort(),           // "count" (default) | "visibility" | "name"
      groupSortDir: readGroupSortDir(),     // "desc" (default) | "asc" -- direction for the Sorter above
      groupMode: readGroupMode(),           // "both" (default) | "topics" | "custom"
      /* Sidelist's own search -- purely a client-side filter over the already-loaded state.groups
         (see filterGroupsForSidelist), never sent anywhere, so it's not persisted like state.query
         is: there's no round trip to keep in sync with, just whatever's already on screen. */
      grpSideQuery: "",
      /* Wide view: a side list of groups to the left of the (otherwise completely unchanged)
         prompts table, instead of each group expanding inline. Purely a display preference —
         doesn't affect what data is fetched or which events fire. */
      groupsWide: readGroupsWide(),
      /* Exactly ONE group is expanded at a time, same rule (and same reasoning) as domains-table's
         drilldown: with one open section the sub-pagination can live as plain fields here instead
         of being kept per group. Not persisted — an expansion is a look-at-this-now gesture. */
      expandedGroup: null,
      gRows: [], gTotal: null, gLoading: false, gReqId: null,
      gPage: 1, gPageSize: 10,
      /* Group-scoped sibling of selectAllMatching, same reasoning: the group can hold far more
         prompts than the one loaded page in state.gRows, so "select the rest of it" has to be a
         flag the RPC resolves server-side (via the group's own tag_ids/tagmode, the same fields
         uptGroupOpen already sends), not a materialised id list. Holds the group's id (group_key)
         while active, null otherwise. Mutually exclusive with selectAllMatching in practice —
         that one only ever offers itself on the flat (ungrouped) view. */
      gSelectAllGroup: null
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
      onFire: function(payload){ state.softReload = false; endSoftReload(); invalidateSelectAll(); fire("data-search-fn", "uptSearch", payload); refreshOpenGroupIfAny(); },
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
      refreshOpenGroupIfAny();
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
      refreshOpenGroupIfAny();
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
      /* Wide grouping view reuses this exact header checkbox (.up-thead is unchanged there, see
         renderGroupWideBody) -- but while a real group is open, the rows on screen are that
         GROUP's (state.gRows), not the flat table's own state.rows. Delegate to the same
         per-group logic the inline view's own group-header checkbox already uses instead of
         duplicating it. With NO group open ("All Prompts" selected, or not grouped at all), the
         rows on screen ARE state.rows -- same flat logic below, no special-casing needed. */
      if (groupingOn() && state.groupsWide && state.expandedGroup){
        toggleGroupHeaderCheckbox(state.expandedGroup);
        /* toggleGroupHeaderCheckbox() only ever had to keep the INLINE view's own group-header
           checkbox in sync (part of the same grpHeadHtml re-render). This reused flat-table
           header box lives outside elTbody entirely (.up-thead is untouched by the body
           re-render), so nothing else updates it -- do it explicitly. */
        syncSelectAll();
        return;
      }
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
      if (!selectedIds().length && !state.selectAllMatching && !state.gSelectAllGroup) return;
      state.selected = {}; invalidateSelectAll();
      persist(); syncRowChecks(); syncSelectAll(); fireSelect(); syncStagedTopicsToSelection();
      /* syncRowChecks() only patches the flat table's own [data-select] buttons -- a group
         header's own checkbox (checked/indeterminate off state.gRows/gSelectAllGroup) needs the
         real re-render renderGroups() does. Guarded: cheap no-op when not grouped. */
      if (groupingOn()) renderGroups();
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
      /* Same reasoning as toggleSelectAll() above -- while a real group is open in wide grouping
         view, this box's checked/indeterminate state has to read off that group's own rows
         (state.gRows), not state.rows, or it never agrees with what's actually on screen. Mirrors
         grpSelectallHtml's own checked-state math (gChecked = gSelectAllGroup === id || allSel) so
         the two surfaces (inline header checkbox, this reused flat-table one) never disagree about
         the same group. With no group open ("All Prompts"), the flat logic below already reads
         off state.rows -- exactly what's on screen in that case. */
      if (groupingOn() && state.groupsWide && state.expandedGroup){
        var gRows = state.gRows || [];
        var gTotal = gRows.length;
        var gSel = gRows.filter(function(r){ return state.selected[String(r.prompt_id)]; }).length;
        var gAll = (gTotal > 0 && gSel === gTotal) || state.gSelectAllGroup === state.expandedGroup;
        var gSome = !gAll && gSel > 0;
        box.classList.toggle("is-checked", gAll);
        box.classList.toggle("is-indeterminate", gSome);
        box.setAttribute("aria-checked", gAll ? "true" : (gSome ? "mixed" : "false"));
        box.innerHTML = gAll ? CHECK_SVG : "";
        syncSelCount();
        syncBulkBarCount();
        return;
      }
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
    /* Relocates .upt-status from wherever the (possibly old, hand-pasted-in-Bubble) root markup
       put it into the toolbar, between Table Settings and Export -- same "build/move it from JS"
       reasoning as the Grouping button above: a CDN pin never touches a Bubble element's own
       copy-pasted HTML, so doing this in JS is what makes every existing embed pick it up
       immediately, with nothing to re-copy on the Bubble side. Also creates .upt-status-tag (the
       "(Inactive)" qualifier shown before the heading label in Inactive view) the same way, since
       it never existed in any prior markup at all. */
    (function(){
      var elStatus = root.querySelector(".upt-status");
      var elExport = root.querySelector(".up-export");
      if (elStatus && elHeadTools && elStatus.parentNode !== elHeadTools){
        if (elExport && elExport.parentNode === elHeadTools) elHeadTools.insertBefore(elStatus, elExport);
        else elHeadTools.appendChild(elStatus);
      }
      if (elHeading && !elHeading.querySelector(".upt-status-tag")){
        var tag = document.createElement("span");
        tag.className = "upt-status-tag";
        tag.textContent = "(Inactive)";
        elHeading.insertBefore(tag, elHeading.firstChild);
      }
    })();
    function renderStatusTabs(){
      var el = root.querySelector(".upt-status");
      if (!el) return;
      /* No counts on either tab -- these used to show the OTHER tab's total, but a number here
         that disagrees with (or just duplicates) the head count two elements away read as more
         confusing than helpful. Plain "Active"/"Inactive" text only. */
      el.innerHTML = [["active","Active"],["inactive","Inactive"]].map(function(p){
        return '<button class="upt-status-btn' + (state.status === p[0] ? " is-active" : "") +
               '" type="button" data-status="' + p[0] + '">' + p[1] + '</button>';
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
    function invalidateSelectAll(){ state.selectAllMatching = false; state.gSelectAllGroup = null; }
    function groupPageFullySelected(){
      var rows = state.gRows || [];
      if (!state.expandedGroup || !rows.length) return false;
      return rows.every(function(r){ return !!state.selected[String(r.prompt_id)]; });
    }
    function groupHasMorePages(){
      var t = toNum(state.gTotal);
      return !!state.expandedGroup && t != null && t > (state.gRows || []).length;
    }
    /* The header checkbox's click, for group `id`. Only ever reachable while `id` is the OPEN
       group -- grpHeadHtml doesn't render the checkbox at all for a collapsed one (see there), so
       there's nothing loaded to select against otherwise. Same logic toggleSelectAll() uses, just
       scoped to state.gRows instead of state.rows. */
    function toggleGroupHeaderCheckbox(id){
      if (state.expandedGroup !== id) return;
      var rows = state.gRows || [];
      if (!rows.length) return;
      var allSel = rows.every(function(r){ return state.selected[String(r.prompt_id)]; });
      if (allSel || state.gSelectAllGroup === id){
        rows.forEach(function(r){ delete state.selected[String(r.prompt_id)]; });
        if (state.gSelectAllGroup === id) state.gSelectAllGroup = null;
      } else {
        rows.forEach(function(r){ state.selected[String(r.prompt_id)] = true; });
      }
      persist(); renderTable(); renderBulkBar(); fireSelect(); syncStagedTopicsToSelection();
    }
    /* The "select all N" offer belongs to the header checkbox, not to ticking single rows:
       after one manual tick, "select all 94" is a non-sequitur. Only once the whole visible
       page is selected does "and the rest?" become the obvious next question. */
    function pageFullySelected(){
      var rows = state.rows || [];
      if (!rows.length) return false;
      return rows.every(function(r){ return !!state.selected[String(r.prompt_id)]; });
    }
    /* state.gTotal is only ever the OPEN group's own pagination total (see setGroupPrompts) --
       accurate for gSelectAllGroup when that is the same group, but stale/null when the checkbox
       was clicked on a COLLAPSED group (never fetched, nothing to be stale FROM). The group
       header's own prompts_count (from the group-list RPC, already on screen either way) is the
       right fallback there — same number the header itself displays. */
    /* gSelectAllGroup is only ever set to state.expandedGroup (see the data-bulk-group-all
       handler) -- the checkbox that used to set it for a COLLAPSED group is gone, so gTotal (the
       currently open group's own pagination total) is always the right number here. */
    function gSelectAllGroupTotal(){
      return state.gSelectAllGroup ? (toNum(state.gTotal) || 0) : 0;
    }
    /* What a bulk action operates on. Two shapes on purpose:
         ids    — the user ticked specific rows; send them.
         filter — the user took "select all N matching"; send the PREDICATE, not the ids, so the
                  server resolves the same set the table is showing. The field names here must
                  stay identical to the ones the render RPC already takes, otherwise the table
                  and the bulk action can silently disagree about which rows they mean. */
    function selectionPayload(){
      if (state.gSelectAllGroup){
        var g = (state.groups || []).filter(function(x){ return groupId(x) === state.gSelectAllGroup; })[0];
        return { mode: "filter_group", count: gSelectAllGroupTotal(), group_key: state.gSelectAllGroup,
                 tag_ids: g ? groupTagIds(g).join(",") : "", tagmode: "and",
                 is_custom: g && isYes2(g.is_custom) ? "yes" : "no",
                 untagged: g && isYes2(g.is_untagged) ? "yes" : "no" };
      }
      if (state.selectAllMatching){
        return { mode: "filter", count: currentTotal() || 0,
                 query: state.query, brand_mentioned: state.brandMentioned,
                 status: state.status, order: orderValue(state.sortField, state.sortDir) };
      }
      var ids = selectedIds();
      return { mode: "ids", count: ids.length, ids: ids.join(",") };
    }
    function bulkCount(){
      if (state.gSelectAllGroup) return gSelectAllGroupTotal();
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
       down picks a mood and across picks a color. The check mark itself is a fixed white (dark
       mode: primary text color, see core.css) rather than per-swatch contrast-solved ink — with
       24 hand-picked, already-legible colors a single fixed ink reads fine on all of them, and it
       is one fewer thing that has to match between this table's picker and core's canonical one. */
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
      var wantEscape = state.selectAllMatching || !!state.gSelectAllGroup ||
        (hasMorePages() && pageFullySelected()) || (groupHasMorePages() && groupPageFullySelected());
      var hasEscapeNow = !!elBulk.querySelector("[data-bulk-all],[data-bulk-group-all],[data-bulk-undoall]");
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
      var isAll = state.selectAllMatching || !!state.gSelectAllGroup;
      /* No "+": bulkCount() is the exact total_count once select-all is active, not an estimate —
         a "+" on a number we know precisely reads as a hedge we don't actually mean. */
      /* Polaris's trick: one control with two states. Before -> the escape hatch; after -> Undo.
         Only offered when there actually IS another page, otherwise "select all" is a lie.
         Group-scoped variant (data-bulk-group-all) mirrors it one level down: the group's own
         total (state.gTotal) instead of the whole active set (currentTotal()). */
      var escape = "";
      if (isAll) escape = '<button class="upt-bulkbar-link" type="button" data-bulk-undoall>Undo</button>';
      else if (hasMorePages() && pageFullySelected()) escape = '<button class="upt-bulkbar-link" type="button" data-bulk-all>Select all ' +
        /* fmtInt, not fmtTotal: fmtTotal abbreviates (1000 -> "1k"), and "Select all 1k prompts"
           reads like a rounded guess when it is in fact an exact figure. */
        UC.fmtInt(currentTotal()) + ' prompts</button>';
      else if (groupHasMorePages() && groupPageFullySelected()) escape = '<button class="upt-bulkbar-link" type="button" data-bulk-group-all>Select all ' +
        UC.fmtInt(toNum(state.gTotal)) + ' prompts</button>';

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
                return '<button type="button" class="up-topicchip up-chiphover' + (on ? " is-on" : "") +
                 '" data-topic="' + esc(id) + '" style="--ust-tag-color:' + esc(color) + '">' +
                 (t.emoji ? '<span class="up-topicchip-e">' + esc(t.emoji) + '</span>' : "") +
                 '<span class="up-topicchip-lbl">' + esc(t.name == null ? "" : t.name) + '</span>' +
                 '<span class="up-topicchip-check' + (on ? " is-on" : "") + '">' + CHECK_SVG + '</span>' +
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
              '<span class="upt-colorblob" style="background:' + esc(hx) + '">' +
                (on ? CHECK_SVG : "") + '</span>' +
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
      UC.flipReplace(el, topicListHtml(), "[data-topic]");
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
          '<button class="up-btn-sec upt-topicadd" type="button" data-topic-add>' +
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
      return '<span class="up-num' + (bad ? " is-empty" : "") + '">' + (bad ? "–" : UC.fmtPct(n)) + '</span>';
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
    /* ---- Edit Topics popup (single-prompt, opened by clicking the Topics cell) ----
       Same up-topicmodal-* shell New/Edit Grouping uses (same header/body/foot rhythm, same
       200ms show/hide) so it reads as the same app, not a one-off. Current topics sit up top as
       chips the user can click to remove; "Add Topics" reveals (200ms ease, the same
       cubic-bezier(.2,0,.38,.9) every other slide-reveal in this file uses) everything not yet on
       the prompt, click to add. One event on Apply. tag_ids is a real array here, unlike the
       comma-joined string uptTopicsClick/uptApplyBulkTopics use — asked for as an array
       specifically for this one. */
    var etModal = null, etRow = null, etStaged = {}, etOriginal = {}, etAddOpen = false;
    /* Apply only makes sense once the staged set actually differs from what the prompt already
       had when the popup opened -- same key-set-count-plus-membership comparison the bulk
       editor's own dirty-check uses elsewhere in this file. */
    function etHasChanges(){
      var a = Object.keys(etStaged), b = Object.keys(etOriginal);
      if (a.length !== b.length) return true;
      for (var i = 0; i < a.length; i++){ if (!etOriginal[a[i]]) return true; }
      return false;
    }
    function etTagsById(){
      var byId = {};
      (state.topics || []).forEach(function(t){ byId[topicId(t)] = t; });
      return byId;
    }
    function etChipHtml(t, on){
      var id = topicId(t);
      var color = String(t.hex_light || t.hex_dark || "#6b7280");
      if (color.charAt(0) !== "#") color = "#" + color;
      return '<button type="button" class="up-topicchip up-chiphover' + (on ? " is-on" : "") +
        '" data-et-topic="' + esc(id) + '" style="--ust-tag-color:' + esc(color) + '">' +
        (t.emoji ? '<span class="up-topicchip-e">' + esc(t.emoji) + '</span>' : "") +
        '<span class="up-topicchip-lbl">' + esc(t.name == null ? "" : t.name) + '</span>' +
        '<span class="up-topicchip-check' + (on ? " is-on" : "") + '">' + CHECK_SVG + '</span>' +
      '</button>';
    }
    function etRenderLists(animate){
      if (!etModal) return;
      var byId = etTagsById();
      var curEl = etModal.querySelector(".upt-et-current");
      var addEl = etModal.querySelector(".upt-et-addlist");
      if (curEl){
        var currentIds = Object.keys(etStaged);
        var curHtml = currentIds.length
          ? currentIds.map(function(id){ return byId[id] ? etChipHtml(byId[id], true) : ""; }).join("")
          : '<div class="upt-et-empty">No topics on this prompt yet</div>';
        if (animate) UC.flipReplace(curEl, curHtml, "[data-et-topic]"); else curEl.innerHTML = curHtml;
      }
      if (addEl){
        var addable = (state.topics || []).filter(function(t){ return !etStaged[topicId(t)]; });
        var addHtml = addable.length
          ? addable.map(function(t){ return etChipHtml(t, false); }).join("")
          : '<div class="upt-et-empty">No more topics to add</div>';
        if (animate) UC.flipReplace(addEl, addHtml, "[data-et-topic]"); else addEl.innerHTML = addHtml;
      }
      var applyBtn = etModal.querySelector("[data-et-apply]");
      if (applyBtn) applyBtn.disabled = !etHasChanges();
    }
    function etToggleTopic(id){
      if (etStaged[id]) delete etStaged[id]; else etStaged[id] = true;
      etRenderLists(true);
    }
    function etModalKey(e){ if (e.key === "Escape"){ e.stopPropagation(); closeEtModal(); } }
    function closeEtModal(){
      if (!etModal) return;
      etModal.classList.remove("is-shown");
      var m = etModal;
      setTimeout(function(){ if (m && m.parentNode) m.parentNode.removeChild(m); }, 160);
      etModal = null; etRow = null;
      document.removeEventListener("keydown", etModalKey, true);
    }
    function openEditTopicsModal(rowId){
      var row = findRowById(rowId);
      if (!row) return;
      closeEtModal();
      etRow = row; etStaged = {}; etOriginal = {}; etAddOpen = false;
      (row.tags || []).forEach(function(t){ etStaged[topicId(t)] = true; etOriginal[topicId(t)] = true; });
      etModal = document.createElement("div");
      etModal.className = "up-topicmodal-backdrop upt-et-backdrop";
      if (isDark) etModal.setAttribute("data-theme", "dark");
      etModal.innerHTML =
        '<div class="up-topicmodal-card" role="dialog" aria-modal="true" aria-label="Edit Topics">' +
          '<div class="up-topicmodal-head">' +
            '<div class="up-topicmodal-heading"><h3 class="up-topicmodal-title">Edit Topics</h3></div>' +
            '<button class="up-topicmodal-close" type="button" data-et-close aria-label="Close">' + CLOSE_SVG + '</button>' +
          '</div>' +
          '<div class="up-topicmodal-body">' +
            '<div class="up-topicmodal-field">' +
              '<span class="up-topicmodal-label upt-et-promptlabel">Prompt</span>' +
              '<p class="upt-et-prompttext">' + esc(String(row.prompt_text == null ? "" : row.prompt_text)) + '</p>' +
            '</div>' +
            '<div class="up-topicmodal-field">' +
              '<span class="up-topicmodal-label">Topics</span>' +
              '<div class="upt-et-current up-topiclist"></div>' +
              '<button class="up-btn-sec upt-et-addbtn" type="button" data-et-addtoggle>' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
                'Add Topics</button>' +
              '<div class="upt-et-addwrap"><div class="upt-et-addlist up-topiclist"></div></div>' +
            '</div>' +
          '</div>' +
          '<div class="up-topicmodal-foot">' +
            '<button class="up-btn-sec" type="button" data-et-cancel>Cancel</button>' +
            '<button class="up-topicmodal-save" type="button" data-et-apply disabled>Apply</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(etModal);
      etRenderLists(false);
      requestAnimationFrame(function(){ if (etModal) etModal.classList.add("is-shown"); });
      document.addEventListener("keydown", etModalKey, true);
      etModal.addEventListener("click", function(e){
        if (e.target === etModal){ closeEtModal(); return; }
        if (e.target.closest("[data-et-close]")){ closeEtModal(); return; }
        if (e.target.closest("[data-et-cancel]")){ closeEtModal(); return; }
        if (e.target.closest("[data-et-addtoggle]")){
          etAddOpen = !etAddOpen;
          var wrap = etModal.querySelector(".upt-et-addwrap");
          if (wrap) wrap.classList.toggle("is-open", etAddOpen);
          e.target.closest("[data-et-addtoggle]").classList.toggle("is-open", etAddOpen);
          return;
        }
        var chip = e.target.closest("[data-et-topic]");
        if (chip){ etToggleTopic(chip.getAttribute("data-et-topic")); return; }
        if (e.target.closest("[data-et-apply]")){
          var tagIds = Object.keys(etStaged);
          var tagsById = etTagsById();
          fire("data-edittopics-fn", "uptEditTopics", { prompt_id: String(etRow.prompt_id), tag_ids: tagIds });
          /* Optimistic local update, same idea as the bulk editor's applyStagedTopics(). */
          etRow.tags = tagIds.map(function(id){ return tagsById[id]; }).filter(Boolean);
          syncTopicCells();
          closeEtModal();
          return;
        }
      });
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


    /* ---- grouping control: icon button + dropdown + the "create group" popup ----
       Built from JS for the same reason the Mentioned dropdown above is: the root markup is a
       hand-pasted copy in Bubble that a CDN pin never touches, so anything new that only lives in
       the markup simply never arrives. */
    /* "Rows" glyph (rows-into-group, user-supplied asset) -- stroke="currentColor" (was hardcoded
       black in the source export) so it follows .up-iconbtn's existing color/hover/dark-theme rules
       exactly like every other toolbar icon; the source's <defs>/clipPath was dropped since nothing
       in this icon actually overflows its own coordinate space and a duplicated clip-path id would
       collide across multiple grouping-button instances on one page. */
    var GRP_ICON = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M16.25 11.25H9.375C9.02982 11.25 8.75 11.5298 8.75 11.875V15C8.75 15.3452 9.02982 15.625 9.375 15.625H16.25C16.5952 15.625 16.875 15.3452 16.875 15V11.875C16.875 11.5298 16.5952 11.25 16.25 11.25Z"/><path d="M16.25 4.375H3.75C3.40482 4.375 3.125 4.65482 3.125 5V8.125C3.125 8.47018 3.40482 8.75 3.75 8.75H16.25C16.5952 8.75 16.875 8.47018 16.875 8.125V5C16.875 4.65482 16.5952 4.375 16.25 4.375Z"/><path d="M3.125 11.25L5.625 13.75L3.125 16.25"/></svg>';
    /* Feather "sidebar" — one icon, both toggles (the sidelist heading's and the toolbar
       heading's): clicking either always means "toggle the group sidebar". */
    var SIDEBAR_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>';
    /* Same three-line glyph .up-sort-btn already uses elsewhere — a second, differently-scoped
       Sorter needs its own classes (see below) so it doesn't collide with the flat table's own
       .up-sort-btn click handling, but it should still look like the same control. */
    var GRPSIDE_SORT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>';
    var GRPSIDE_ADD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    /* Same magnifier glyph the toolbar's own .up-search-btn uses -- one search icon everywhere. */
    var GRPSIDE_SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    var elGrpWrap = null, elGrpMenu = null;
    (function(){
      if (!elHeadTools) return;
      elGrpWrap = root.querySelector(".upt-group");
      if (!elGrpWrap){
        elGrpWrap = document.createElement("div");
        elGrpWrap.className = "upt-group";
        elGrpWrap.innerHTML =
          '<button class="upt-group-btn up-iconbtn" type="button" data-tip="Grouping" aria-label="Grouping" aria-haspopup="menu" aria-expanded="false">' +
            GRP_ICON + '<span class="upt-group-dot"></span></button>' +
          '<div class="up-menu upt-group-menu" role="menu" aria-hidden="true"></div>';
        /* Left of the column-settings gear — grouping changes WHAT the table lists, the gear only
           changes how it is drawn, and the app orders toolbar controls that way everywhere. */
        if (elCols && elCols.parentNode === elHeadTools) elHeadTools.insertBefore(elGrpWrap, elCols);
        else elHeadTools.appendChild(elGrpWrap);
      }
      elGrpMenu = elGrpWrap.querySelector(".upt-group-menu");
    })();
    /* The popover itself is wired further down, next to the other dropdowns — POP_GROUP does not
       exist yet at this point in the file. */
    var grpPop = null;

    /* ---- groups wide view: side panel + the SAME .up-box, unchanged ----
       Wraps .up-box (head + body, untouched) in a flex row with a new side panel to its left.
       display:contents on the wrapper when wide view is off means .up-box behaves exactly as if
       this wrapper didn't exist -- no effect on the normal flat/inline-grouped layouts at all.
       Built once at init (same reasoning as the Grouping button above: a CDN pin never touches a
       Bubble element's hand-pasted root markup, so this has to happen in JS to reach existing
       embeds), not per-render. The panel is [sidehead (fixed, "Group" + its own Sorter + the
       list-view toggle)] + [sidelist (scrolls)], not just the list -- the heading needs a place to
       live that isn't part of the scrolling rows. */
    var elGrpSidelist = null, elGrpSideSort = null, elGrpSideSortMenu = null,
        elGrpSidehead = null, elGrpSideSearchIn = null;
    (function(){
      var box = root.querySelector(".up-box");
      if (!box) return;
      var wrap = (box.parentNode && box.parentNode.classList.contains("upt-grp-widewrap")) ? box.parentNode : null;
      if (!wrap){
        wrap = document.createElement("div");
        wrap.className = "upt-grp-widewrap";
        box.parentNode.insertBefore(wrap, box);
        wrap.appendChild(box);
      }
      var panel = wrap.querySelector(".upt-grp-sidepanel");
      if (!panel){
        panel = document.createElement("div");
        panel.className = "upt-grp-sidepanel";
        panel.innerHTML =
          '<div class="upt-grp-sidehead">' +
            '<span class="upt-grp-sidehead-lbl">Group</span>' +
            '<div class="upt-grp-sidetools">' +
              '<div class="upt-grp-sidesort">' +
                '<button class="upt-grp-sidesort-btn up-iconbtn" type="button" data-tip="Sort Groups" aria-label="Sort groups" aria-haspopup="menu" aria-expanded="false">' +
                  GRPSIDE_SORT_ICON + '</button>' +
                '<div class="up-menu upt-grp-sidesort-menu" role="menu" aria-hidden="true"></div>' +
              '</div>' +
              '<button class="upt-grp-sidesearch-btn up-iconbtn" type="button" data-grp-sidesearch-open data-tip="Search" aria-label="Search groups">' +
                GRPSIDE_SEARCH_ICON + '</button>' +
              '<button class="upt-grp-sideadd up-iconbtn" type="button" data-grp-new data-tip="New grouping" aria-label="New grouping">' +
                GRPSIDE_ADD_ICON + '</button>' +
              /* Only ever visible while the sidelist IS showing -- clicking it hides that list
                 again (the table goes back to full width), so the tooltip names THAT destination:
                 "Wide view", not "List view" (which is what you're already looking at). See the
                 toolbar's twin below for the mirror case. */
              '<button class="upt-grp-widebtn up-iconbtn" type="button" data-grp-widebtn data-tip="Wide view" aria-label="Switch to wide view">' +
                SIDEBAR_ICON + '</button>' +
            '</div>' +
            /* Takes over the WHOLE sidehead row when open (see .is-searching in prompts-table.css)
               -- unlike the toolbar's own .up-search, which only takes over its row below a width
               threshold, this panel is always narrow enough (256px min) that a takeover is the
               only layout that ever makes sense, so there is no width check here at all. */
            '<div class="upt-grp-sidesearch-box">' +
              '<input class="upt-grp-sidesearch-in" type="text" placeholder="Search groups…" autocomplete="off" spellcheck="false" aria-label="Search groups"/>' +
              '<button class="upt-grp-sidesearch-clear" type="button" data-grp-sidesearch-close aria-label="Close search">' + CLOSE_SVG + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="upt-grp-sidelist"></div>';
        wrap.insertBefore(panel, box);
      }
      elGrpSidelist = panel.querySelector(".upt-grp-sidelist");
      elGrpSideSort = panel.querySelector(".upt-grp-sidesort");
      elGrpSideSortMenu = panel.querySelector(".upt-grp-sidesort-menu");
      elGrpSidehead = panel.querySelector(".upt-grp-sidehead");
      elGrpSideSearchIn = panel.querySelector(".upt-grp-sidesearch-in");
    })();
    root.classList.toggle("is-groups-wide", state.groupsWide);

    /* The OTHER sidebar toggle: lives IN the toolbar heading, directly before "Prompts", and is
       only ever visible while grouping is on and wide view is off (see CSS) -- when wide view is
       already on, the sidepanel's own toggle above is the one in view. Built once, unconditionally;
       .is-grouped/.is-groups-wide on root is what actually shows or hides it, same as every other
       state-driven toolbar control in this file. */
    (function(){
      if (!elHeading) return;
      if (elHeading.querySelector(".upt-heading-widebtn")) return;
      var btn = document.createElement("button");
      btn.className = "upt-heading-widebtn up-iconbtn";
      btn.type = "button";
      btn.setAttribute("data-grp-widebtn", "");
      /* Mirror of the sidepanel's own toggle above: only ever visible while the sidelist is
         hidden (the table is at full/"wide" width already), so clicking it SHOWS the list --
         the tooltip names that destination, "List view". */
      btn.setAttribute("data-tip", "List view");
      btn.setAttribute("aria-label", "Switch to list view");
      btn.innerHTML = SIDEBAR_ICON;
      elHeading.insertBefore(btn, elHeading.firstChild);
    })();

    function populateGroupMenu(){
      if (!elGrpMenu) return;
      var custom = readCustomGroups();
      var on = state.grouped;
      var h = '<div class="up-pop-head">Grouping</div>' +
        '<div class="up-pop-row" data-grp-toggle>' +
          '<span class="up-pop-label">Group by topics</span>' +
          '<span class="up-switch' + (on ? " is-on" : "") + '" role="switch" aria-checked="' + (on ? "true" : "false") + '"></span>' +
        '</div>';
      /* Grouping is an Active-view feature; say so instead of silently doing nothing. */
      if (state.status === "inactive"){
        h += '<div class="upt-group-note">Active view only — inactive prompts stay ungrouped.</div>';
      }
      h += '<div class="up-pop-div"></div><div class="up-pop-sub">Sort groups by</div><div class="up-dense">' +
        GRP_SORTS.map(function(o){
          return '<button class="up-dense-btn' + (state.groupSort === o.key ? " is-active" : "") +
                 '" type="button" data-grp-sort="' + o.key + '">' + esc(o.label) + '</button>';
        }).join("") + '</div>';
      h += '<div class="up-pop-div"></div><div class="up-pop-sub">Custom groupings</div>';
      if (!custom.length){
        h += '<div class="upt-group-note">No custom grouping yet.</div>';
      } else {
        /* Hidden groupings sort to the bottom and cannot be dragged -- reordering something you
           cannot currently see is a recipe for "why did my list change" later. Visible ones keep
           whatever order the user last dragged them into (that order IS the stored array order,
           committed from the live DOM order at drop -- see the dragend handler below). 4px gap
           via .upt-group-list, not per-item margin, so it applies identically whether a row is
           being dragged or not. */
        var visible = custom.filter(function(g){ return !g.hidden; });
        var hidden = custom.filter(function(g){ return g.hidden; });
        h += '<div class="upt-group-list">' + visible.concat(hidden).map(function(g){
          var open = grpRowMenu === g.key;
          return '<div class="up-pop-row upt-group-item' + (open ? " is-menuopen" : "") +
              (g.hidden ? "" : " is-draggable") + '"' +
              (g.hidden ? "" : ' draggable="true" data-grp-drag="' + esc(g.key) + '"') + '>' +
            '<span class="upt-grp-cdot" style="background:' + esc(g.color || "#6b7280") + '"></span>' +
            '<span class="up-pop-label">' + esc(g.key) + '</span>' +
            /* Only ever shown via .is-dragging (see CSS) -- static placeholders for the dragged
               row's own slot, swapped in with a pure class toggle rather than an innerHTML swap. */
            '<span class="upt-group-sk-dot"></span><span class="upt-group-sk-text"></span>' +
            '<button class="upt-group-eye' + (g.hidden ? " is-off" : "") + '" type="button" data-grp-eye="' + esc(g.key) + '"' +
              ' aria-label="' + (g.hidden ? "Show grouping" : "Hide grouping") + '" aria-pressed="' + (g.hidden ? "true" : "false") + '">' +
              (g.hidden ? EYE_OFF_SVG : EYE_SVG) + '</button>' +
            '<button class="upt-group-more" type="button" data-grp-rowmenu="' + esc(g.key) + '" aria-label="Group actions" aria-haspopup="menu">' + GRP_MORE_SVG + '</button>' +
            /* Opens to the LEFT: this row already sits at the right edge of a 340px popover, so a
               right-opening menu would leave the panel. */
            (open ? '<div class="up-menu upt-group-rowmenu is-shown" role="menu">' +
                '<div class="up-pop-opt" data-grp-edit="' + esc(g.key) + '">Edit</div>' +
                '<div class="up-pop-opt is-danger" data-grp-del="' + esc(g.key) + '">Delete</div>' +
              '</div>' : "") +
          '</div>';
        }).join("") + '</div>';
      }
      /* Same off -> yes -> no -> off cycle and the exact checkbox glyph (.upt-brand-check) the
         toolbar's "Brand mentioned" toggle uses, and the same visual pill (see CSS) -- but NOT the
         literal .upt-brand-toggle class: that class is also the target of the toolbar's own
         responsive rules (.up-root.is-w3 .upt-brand-toggle, .is-vnarrow .upt-brand-toggle {
         display:none!important}), meant to drop the TOOLBAR toggle at narrow widths. Reusing it
         verbatim here made this popover control vanish under the exact same width rules, for a
         completely unrelated reason (it doesn't even live in the toolbar). Own class, same look.
         Sits BELOW the list, its own gap, not above: it is a view filter on the list that already
         rendered above it, not a heading for it. yes = groupMode "custom" (only custom), no =
         "topics" (custom excluded), off = "both". */
      var onlyCustom = state.groupMode === "custom", noCustom = state.groupMode === "topics";
      /* Label flips with the "no" state -- "Only show custom groupings" reads as backwards once
         the checkbox is actually hiding them (noCustom / groupMode "topics"), since "only" implies
         it's the one thing still showing. */
      h += '<div class="upt-group-onlycustom' + (onlyCustom ? " is-yes" : (noCustom ? " is-no" : "")) +
          '" data-grp-onlycustom role="checkbox" aria-checked="' + (onlyCustom ? "true" : "false") + '">' +
        '<span class="upt-brand-toggle-lbl"><span class="upt-brand-label">' +
          (noCustom ? "Don&#39;t show custom groupings" : "Only show custom groupings") + '</span></span>' +
        '<span class="upt-brand-check">' +
          '<svg class="upt-brand-check-yes" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          '<svg class="upt-brand-check-no" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        '</span></div>';
      h += '<div class="up-pop-div"></div>' +
        '<button class="up-btn-sec upt-group-new" type="button" data-grp-new>New Grouping</button>';
      elGrpMenu.innerHTML = h;
    }
    function syncGroupBtn(){
      if (!elGrpWrap) return;
      elGrpWrap.classList.toggle("is-on", groupingOn());
    }

    /* Reads the CURRENT DOM order of [data-grp-drag] rows (which dragover has already been
       live-moving, see below) and writes it back as the stored order -- hidden groupings are
       appended after, in whatever relative order they already had (they are never part of the
       draggable set, so their order among themselves never changes). */
    function commitDragOrder(){
      var all = readCustomGroups();
      var byKey = {};
      all.forEach(function(g){ byKey[g.key] = g; });
      var visibleKeys = Array.prototype.map.call(
        elGrpMenu.querySelectorAll("[data-grp-drag]"),
        function(el){ return el.getAttribute("data-grp-drag"); }
      );
      var hidden = all.filter(function(g){ return g.hidden; });
      var newOrder = visibleKeys.map(function(k){ return byKey[k]; }).filter(Boolean).concat(hidden);
      writeCustomGroups(newOrder);
    }
    /* Native HTML5 drag-and-drop, delegated on the menu itself (it survives every
       populateGroupMenu() re-render -- only its innerHTML is replaced, never the node, and
       nothing here calls populateGroupMenu() mid-drag). Hidden groupings have no [draggable] (see
       populateGroupMenu), so they are simply not valid drag sources or drop targets.
       The dragged row is physically moved in the DOM on every dragover (the standard "list
       shifts to show where it'll land" reorder feel), not just marked with an insertion line --
       .is-dragging's own skeleton-placeholder look (see CSS) travels along with it. */
    var grpDragKey = null;
    function grpClearDragClasses(){
      if (!elGrpMenu) return;
      Array.prototype.forEach.call(elGrpMenu.querySelectorAll("[data-grp-drag]"), function(r){
        r.classList.remove("is-dragging");
      });
    }
    if (elGrpMenu){
      elGrpMenu.addEventListener("dragstart", function(e){
        var row = e.target.closest && e.target.closest("[data-grp-drag]");
        if (!row){ e.preventDefault(); return; }
        grpDragKey = row.getAttribute("data-grp-drag");
        row.classList.add("is-dragging");
        try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", grpDragKey); } catch(err){}
      });
      elGrpMenu.addEventListener("dragover", function(e){
        if (!grpDragKey) return;
        var row = e.target.closest && e.target.closest("[data-grp-drag]");
        if (!row || row.getAttribute("data-grp-drag") === grpDragKey) return;
        e.preventDefault();
        var dragged = elGrpMenu.querySelector(".upt-group-item.is-dragging");
        if (!dragged) return;
        var r2 = row.getBoundingClientRect();
        var before = (e.clientY - r2.top) < r2.height / 2;
        row.parentNode.insertBefore(dragged, before ? row : row.nextSibling);
      });
      /* Whichever fires -- a real drop, or dragend after being released outside any row -- the
         DOM is already showing the live position, so both just commit it. */
      elGrpMenu.addEventListener("drop", function(e){ if (grpDragKey) e.preventDefault(); });
      elGrpMenu.addEventListener("dragend", function(){
        if (grpDragKey) commitDragOrder();
        grpDragKey = null;
        grpClearDragClasses();
        populateGroupMenu();
      });
    }


    /* ---- "New grouping" popup ----
       Shell is core's .up-topicmodal-* (STYLEGUIDE 27). The topic list uses core's .up-topicchip
       -- the SAME chip, with the same sliding checkbox, that this component's own topic popover
       draws, because a topic has to look like itself everywhere. The colour picker is the same
       TOPIC_COLOR_PALETTE grid the inline topic creator uses. Nothing here is a look-alike. */
    var GRP_MAX_TOPICS = 3;
    var GM_SEARCH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    var GRP_TOPICS_COLLAPSED = 10;   /* show this many, then a "Show all" button */
    var grpModal = null, grpPicked = {}, grpColor = null, grpColorOpen = false,
        grpNameTouched = false, grpQuery = "", grpSearchOpen = false, grpShowAll = false,
        grpEditKey = null;   /* non-null => editing that existing group instead of creating one */
    function closeGroupModal(){
      if (!grpModal) return;
      grpModal.classList.remove("is-shown");
      var m = grpModal;
      setTimeout(function(){ if (m && m.parentNode) m.parentNode.removeChild(m); }, 160);
      grpModal = null;
      document.removeEventListener("keydown", grpModalKey, true);
    }
    function grpModalKey(e){ if (e.key === "Escape"){ e.stopPropagation(); closeGroupModal(); } }

    function grpPickedIds(){
      return (state.topics || []).map(topicId).filter(function(id){ return grpPicked[id]; });
    }
    function grpTopicById(id){
      return (state.topics || []).filter(function(t){ return topicId(t) === id; })[0];
    }
    /* Average of the picked topics' own colours, channel by channel. A group of blue-ish and
       green-ish topics reads as the blue-green between them, which is what "these belong
       together" should look like; the user can still override it in the picker. */
    function mixHex(list){
      var cols = list.map(function(h){
        h = String(h || "").replace("#", "");
        if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
        return /^[0-9a-fA-F]{6}$/.test(h) ? h : null;
      }).filter(Boolean);
      if (!cols.length) return TOPIC_COLOR_PALETTE[0];
      var r=0,g=0,b=0;
      cols.forEach(function(h){
        r += parseInt(h.slice(0,2),16); g += parseInt(h.slice(2,4),16); b += parseInt(h.slice(4,6),16);
      });
      function two(n){ n = Math.round(n / cols.length).toString(16); return n.length < 2 ? "0"+n : n; }
      return "#" + two(r) + two(g) + two(b);
    }
    function grpAutoColor(){
      return mixHex(grpPickedIds().map(function(id){
        var t = grpTopicById(id); return t && (t.hex_light || t.hex_dark);
      }));
    }
    function grpAutoName(){
      return grpPickedIds().map(function(id){
        var t = grpTopicById(id); return t ? String(t.name == null ? "" : t.name) : "";
      }).filter(Boolean).join(" & ");
    }

    function grpChipHtml(t){
      var id = topicId(t), on = !!grpPicked[id];
      var color = String(t.hex_light || t.hex_dark || "#6b7280");
      if (color.charAt(0) !== "#") color = "#" + color;
      return '<button type="button" class="up-topicchip up-chiphover' + (on ? " is-on" : "") +
        '" data-gm-topic="' + esc(id) + '" style="--ust-tag-color:' + esc(color) + '">' +
        (t.emoji ? '<span class="up-topicchip-e">' + esc(t.emoji) + '</span>' : "") +
        '<span class="up-topicchip-lbl">' + esc(t.name == null ? "" : t.name) + '</span>' +
        '<span class="up-topicchip-check' + (on ? " is-on" : "") + '">' + CHECK_SVG + '</span>' +
      '</button>';
    }
    function renderGroupModalBody(animateList){
      if (!grpModal) return;
      var picked = grpPickedIds(), n = picked.length, full = n >= GRP_MAX_TOPICS;

      var q = grpQuery.trim().toLowerCase();
      var shown = (state.topics || []).filter(function(t){
        return !q || String(t.name || "").toLowerCase().indexOf(q) > -1;
      });
      /* Collapsed by default so ten topics do not become a wall; expanding turns the list into a
         scroll container rather than letting 100 topics push the popup off screen. */
      var hidden = Math.max(0, shown.length - GRP_TOPICS_COLLAPSED);
      var visible = (grpShowAll || !hidden) ? shown : shown.slice(0, GRP_TOPICS_COLLAPSED);
      var list = grpModal.querySelector(".upt-gm-list");
      if (list){
        list.className = "upt-gm-list up-topiclist" + (full ? " is-full" : "") + (grpShowAll ? " is-scroll" : "");
        var html = visible.length
          ? visible.map(grpChipHtml).join("")
          : '<div class="upt-topicmenu-empty">No topics match</div>';
        /* Exactly the popover's mechanic, from the same helper — the chips that shift because a
           checkbox appeared slide to their new places instead of jumping. */
        if (animateList) UC.flipReplace(list, html, "[data-gm-topic]");
        else list.innerHTML = html;
      }
      var moreBtn = grpModal.querySelector(".upt-gm-more");
      if (moreBtn){
        var showMore = hidden > 0 && !grpShowAll;
        moreBtn.style.display = showMore ? "" : "none";
        moreBtn.textContent = showMore ? ("Show all " + shown.length + " topics") : "";
      }
      var sw = grpModal.querySelector(".upt-gm-search");
      if (sw) sw.classList.toggle("is-open", grpSearchOpen);
      var sbtn = grpModal.querySelector(".upt-gm-searchbtn");
      if (sbtn) sbtn.classList.toggle("is-open", grpSearchOpen);
      var cnt = grpModal.querySelector(".upt-gm-count");
      if (cnt) cnt.textContent = n + "/" + GRP_MAX_TOPICS;

      var nameEl = grpModal.querySelector(".upt-gm-name-in");
      /* Prefilled from the picked topics ("Sedans & SUVs") until the user types their own. */
      if (nameEl && !grpNameTouched) nameEl.value = grpAutoName();
      if (nameEl && grpEditKey && !nameEl.value) nameEl.value = grpEditKey;
      var col = grpColor || grpAutoColor();
      var dot = grpModal.querySelector(".upt-gm-dot");
      if (dot) dot.style.background = col;

      var wrap = grpModal.querySelector(".upt-gm-colorwrap");
      if (wrap) wrap.classList.toggle("is-open", grpColorOpen);
      /* .upt-gm-colorpanel itself is never recreated (only its innerHTML), so an .is-open class
         added after mount (see the data-gm-colorbtn handler) survives every re-render while the
         picker stays open -- picking a color just refreshes the grid's checkmark, it does not
         replay the entrance animation. */
      var panel = grpModal.querySelector(".upt-gm-colorpanel");
      if (panel){
        if (grpColorOpen){
          panel.innerHTML = '<div class="upt-colorgrid">' + TOPIC_COLOR_PALETTE.map(function(hx){
              var on = hx === col;
              return '<button type="button" class="upt-colorcell" data-gm-color="' + esc(hx) + '"' +
                ' aria-label="' + esc(hx) + '" aria-pressed="' + (on ? "true" : "false") + '">' +
                '<span class="upt-colorblob" style="background:' + esc(hx) + '">' +
                  (on ? CHECK_SVG : "") + '</span>' +
              '</button>';
            }).join("") + '</div>';
        } else {
          panel.classList.remove("is-open");
          panel.innerHTML = "";
        }
      }
      var clr = grpModal.querySelector(".upt-gm-clear");
      if (clr) clr.classList.toggle("is-on", !!grpQuery);

      var submit = grpModal.querySelector(".upt-gm-submit");
      if (submit) submit.disabled = !(n > 0 && nameEl && nameEl.value.trim());
    }
    /* Two random topic names for the placeholder, so the field shows the shape of a good name
       ("Sedans & Hybrid") rather than an abstract instruction. */
    function grpPlaceholder(){
      var names = (state.topics || []).map(function(t){ return String(t.name == null ? "" : t.name); }).filter(Boolean);
      if (names.length < 2) return "Group name…";
      var i = Math.floor(Math.random() * names.length);
      var j = Math.floor(Math.random() * (names.length - 1));
      if (j >= i) j += 1;
      return names[i] + " & " + names[j];
    }
    function openGroupModal(editing){
      closeGroupModal();
      grpEditKey = editing ? editing.key : null;
      grpPicked = {}; grpColor = editing ? (editing.color || null) : null;
      grpColorOpen = false; grpNameTouched = !!editing;
      grpQuery = ""; grpSearchOpen = false; grpShowAll = false;
      if (editing) (editing.tag_ids || []).forEach(function(id){ grpPicked[String(id)] = true; });
      grpModal = document.createElement("div");
      grpModal.className = "up-topicmodal-backdrop upt-gm-backdrop";
      if (isDark) grpModal.setAttribute("data-theme", "dark");
      grpModal.innerHTML =
        '<div class="up-topicmodal-card" role="dialog" aria-modal="true" aria-label="New Grouping">' +
          '<div class="up-topicmodal-head">' +
            '<div class="up-topicmodal-heading">' +
              '<h3 class="up-topicmodal-title">' + (grpEditKey ? "Edit Grouping" : "New Grouping") + '</h3>' +
              '<p class="up-topicmodal-sub">Combine several topics into one group. A prompt counts ' +
                'towards the group only if it carries <strong>all</strong> of the topics.</p>' +
            '</div>' +
            '<button class="up-topicmodal-close" type="button" data-gm-close aria-label="Close">' + CLOSE_SVG + '</button>' +
          '</div>' +
          '<div class="up-topicmodal-body">' +
            '<div class="up-topicmodal-field">' +
              '<div class="upt-gm-labelrow">' +
                '<span class="up-topicmodal-label">Topics</span>' +
                '<span class="upt-gm-right">' +
                  '<button class="upt-gm-searchbtn" type="button" data-gm-searchtoggle aria-label="Search topics">' + GM_SEARCH_SVG + '</button>' +
                  '<span class="upt-gm-count">0/' + GRP_MAX_TOPICS + '</span>' +
                '</span>' +
              '</div>' +
              '<div class="upt-gm-search">' +
                '<input class="upt-gm-search-in" type="text" placeholder="Search topics…" autocomplete="off" spellcheck="false"/>' +
                '<button class="upt-gm-clear" type="button" data-gm-clear aria-label="Clear search">' + CLOSE_SVG + '</button>' +
              '</div>' +
              '<div class="upt-gm-list up-topiclist"></div>' +
              '<button class="upt-gm-more" type="button" data-gm-more></button>' +
            '</div>' +
            '<div class="up-topicmodal-field">' +
              '<span class="up-topicmodal-label">Group name</span>' +
              '<div class="upt-gm-namerow">' +
                '<div class="upt-gm-colorwrap">' +
                  '<button class="upt-gm-dotbtn" type="button" data-gm-colorbtn aria-label="Group color">' +
                    '<span class="upt-gm-dot"></span></button>' +
                '</div>' +
                '<input class="up-topicmodal-name upt-gm-name-in" type="text" placeholder="' + esc(grpPlaceholder()) + '" autocomplete="off" spellcheck="false"/>' +
              '</div>' +
              '<div class="upt-gm-colorpanel"></div>' +
            '</div>' +
          '</div>' +
          '<div class="up-topicmodal-foot">' +
            '<button class="up-topicmodal-save upt-gm-submit" type="button" data-gm-submit disabled>' + (grpEditKey ? "Save" : "Create group") + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(grpModal);
      renderGroupModalBody();
      requestAnimationFrame(function(){ if (grpModal) grpModal.classList.add("is-shown"); });
      document.addEventListener("keydown", grpModalKey, true);

      grpModal.addEventListener("input", function(e){
        if (e.target.classList.contains("upt-gm-name-in")){ grpNameTouched = true; renderGroupModalBody(); return; }
        if (e.target.classList.contains("upt-gm-search-in")){ grpQuery = e.target.value; renderGroupModalBody(); return; }
      });
      grpModal.addEventListener("click", function(e){
        if (e.target === grpModal){ closeGroupModal(); return; }
        if (e.target.closest("[data-gm-close]")){ closeGroupModal(); return; }
        if (e.target.closest("[data-gm-more]")){ grpShowAll = true; renderGroupModalBody(); return; }
        if (e.target.closest("[data-gm-searchtoggle]")){
          grpSearchOpen = !grpSearchOpen;
          if (!grpSearchOpen) grpQuery = "";
          renderGroupModalBody();
          if (grpSearchOpen){
            var si2 = grpModal.querySelector(".upt-gm-search-in");
            if (si2) setTimeout(function(){ try { si2.focus(); } catch(e){} }, 60);
          }
          return;
        }
        if (e.target.closest("[data-gm-clear]")){
          grpQuery = "";
          var si = grpModal.querySelector(".upt-gm-search-in");
          if (si){ si.value = ""; si.focus(); }
          renderGroupModalBody(); return;
        }
        if (e.target.closest("[data-gm-colorbtn]")){
          var wasOpen = grpColorOpen;
          grpColorOpen = !grpColorOpen;
          renderGroupModalBody();
          /* Opening animates in (two-phase: mount collapsed, THEN add .is-open next frame so the
             browser actually has a "before" state to transition from -- same trick the modal
             itself uses for .is-shown). Closing is instant; only "einblenden" was asked for. */
          if (!wasOpen && grpColorOpen){
            var p0 = grpModal.querySelector(".upt-gm-colorpanel");
            if (p0) requestAnimationFrame(function(){ p0.classList.add("is-open"); });
          }
          return;
        }
        var cc = e.target.closest("[data-gm-color]");
        /* Stays open on pick -- same as the emoji/color pickers everywhere else in this table. */
        if (cc){ grpColor = cc.getAttribute("data-gm-color"); renderGroupModalBody(); return; }
        var chip = e.target.closest("[data-gm-topic]");
        if (chip){
          var tid = chip.getAttribute("data-gm-topic");
          if (grpPicked[tid]) delete grpPicked[tid];
          else if (grpPickedIds().length < GRP_MAX_TOPICS) grpPicked[tid] = true;
          else return;                       // at the cap; .is-full already says so visually
          renderGroupModalBody(true);
          return;
        }
        if (e.target.closest("[data-gm-submit]")){
          var nameEl = grpModal.querySelector(".upt-gm-name-in");
          var name = nameEl ? nameEl.value.trim() : "";
          var ids = grpPickedIds();
          if (!name || !ids.length) return;
          var all = readCustomGroups().filter(function(g){
            return g.key !== name && g.key !== grpEditKey;   // renaming replaces the old entry
          });
          all.push({ key: name, tag_ids: ids, color: grpColor || grpAutoColor() });
          writeCustomGroups(all);            // localStorage only — no backend call, by design
          closeGroupModal();
          populateGroupMenu();
          if (groupingOn()) fetchGroups();
          return;
        }
      });
    }

    /* ============================================================================
       GROUPED-BY-TOPIC VIEW
       An optional layer on top of the flat table, not a replacement: every toolbar filter, the
       search, the brand toggle and the column settings keep working exactly as before and simply
       scope what the groups are computed from. Only the BODY changes -- accordion sections
       instead of rows -- and the outer pager is hidden, because in this view pagination belongs
       inside the open group (same model as domains-table's drilldown).
       ============================================================================ */
    var GRP_ANIM_MS = 200;   /* must match .upt-grp-rows animation in prompts-table.css */
    var GRP_CHEV = '<svg class="upt-grp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    /* Prompts first and default: "how many prompts is this topic actually about" is the question
       people open the grouped view with; visibility is the follow-up. */
    /* Feather "refresh-cw". */
    var GEN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    var GRP_EDIT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    var EYE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    var EYE_OFF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
    var GRP_MORE_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
    var grpRowMenu = null;   /* group key whose row menu is open, or null */
    /* Which kind of section the view shows. "topics" = the RPC's default (one group per topic +
       untagged), "custom" = only the user's own groupings, "both" = the union (default). Set via
       the "Only show custom groupings" checkbox in populateGroupMenu, not a dedicated switcher --
       off/yes/no maps to both/custom/topics, same 3-state cycle as "Brand mentioned". The mode
       rides on the uptGroups event so the RPC can answer accordingly. */
    var GRP_SORTS = [
      { key: "count",      label: "Prompts" },
      { key: "visibility", label: "Visibility" },
      { key: "name",       label: "Name A–Z" }
    ];
    var grpReqSeq = 0;

    function groupingOn(){ return state.grouped && state.status === "active"; }

    /* Wide view on/off -- pure display preference (doesn't touch state.expandedGroup, what's
       fetched, or any event). Switching away and back leaves whichever group was open still open.
       Reached only via the two sidebar-icon toggles now (the dropdown's own "Wide view" switch
       was removed -- one control, not two disagreeing ones). */
    function toggleGroupsWide(){
      /* The one trigger that could turn the list ON is already hidden while cramped (see
         .is-groups-cramped/fitGroupsWide) -- this is just the same guard applied to the toggle
         itself, so nothing can flip it on programmatically either while there's no room for it. */
      if (!state.groupsWide && root.classList.contains("is-groups-cramped")) return;
      state.groupsWide = !state.groupsWide;
      writeGroupsWide(state.groupsWide);
      root.classList.toggle("is-groups-wide", state.groupsWide);
      if (groupingOn()) renderGroups();
      /* .up-box's own width changes gradually as the sidepanel's 200ms CSS width transition runs
         (see .upt-grp-sidepanel) -- root's OUTER width never changes (the panel and box just
         re-split the same space), so the shared ResizeObserver (core.js's onResize, watching
         root) never fires for this and the columns never re-fit to the box's real end width on
         their own. Re-running applyCols() once the transition has settled catches it up. */
      setTimeout(function(){ applyCols(); }, 220);
    }

    /* The sidelist's own search: the magnifier takes over the WHOLE .upt-grp-sidehead row when
       opened (see .is-searching in prompts-table.css) -- there's no width check the way the
       toolbar's own .up-search has, because this panel is always narrow enough (256px floor) that
       a takeover is the only sane layout. Closing clears whatever query was typed (same "closing
       resets" behaviour the toolbar search already has), not just visually -- otherwise reopening
       later would silently still be filtering on stale text nobody can see anymore. */
    function toggleGrpSideSearch(open){
      if (!elGrpSidehead) return;
      elGrpSidehead.classList.toggle("is-searching", open);
      if (open){
        setTimeout(function(){ try { elGrpSideSearchIn.focus(); } catch(e){} }, 60);
        return;
      }
      if (!state.grpSideQuery) return;
      state.grpSideQuery = "";
      if (elGrpSideSearchIn) elGrpSideSearchIn.value = "";
      var box = elGrpSidehead.querySelector(".upt-grp-sidesearch-box");
      if (box) box.classList.remove("has-text");
      if (groupingOn() && state.groupsWide) renderGroupSidelist(filterGroupsForSidelist(sortedGroups()));
    }

    /* The group list, sorted client-side. "No topic" is pinned last regardless of the sort --
       it is not a topic competing with the others, it is the remainder. */
    function sortedGroups(){
      var rows = (state.groups || []).slice();
      var untagged = rows.filter(function(g){ return isYes2(g.is_untagged); });
      rows = rows.filter(function(g){ return !isYes2(g.is_untagged); });
      var mode = state.groupSort;
      /* "desc" is the literal direction, same convention orderValue()/state.sortDir already use
         for the flat table -- not a per-field-flipped "sensible default". name:asc reads A-Z,
         name:desc reads Z-A; count/visibility:desc reads highest first. */
      var mul = state.groupSortDir === "asc" ? 1 : -1;
      function cmp(a, b){
        if (mode === "name") return String(groupLabel(a)).localeCompare(String(groupLabel(b))) * mul;
        var av, bv;
        if (mode === "count"){ av = toNum(a.prompts_count) || 0; bv = toNum(b.prompts_count) || 0; }
        else { av = toNum(a.visibility_pct) || 0; bv = toNum(b.visibility_pct) || 0; }
        return (av - bv) * mul;
      }
      /* Custom groupings lead in Both mode -- in Topics/Custom mode this partition is a no-op
         (one side is always empty, since the RPC only ever returns one kind), so it is simplest
         to just always split rather than special-case the mode. */
      var custom = rows.filter(function(g){ return isYes2(g.is_custom); }).sort(cmp);
      var topics = rows.filter(function(g){ return !isYes2(g.is_custom); }).sort(cmp);
      return custom.concat(topics, untagged);
    }
    /* The sidelist's own search, applied on top of sortedGroups() -- never on the inline
       (non-wide) view's own group headers, which have no search box and shouldn't silently start
       filtering just because the sidelist's query happens to be non-empty. Plain substring match
       against the same label grpHeadHtml/renderGroupSidelist already show, nothing fancier: this
       is filtering a few dozen already-loaded rows, not a search that needs folding/debouncing. */
    function filterGroupsForSidelist(rows){
      var q = state.grpSideQuery.trim().toLowerCase();
      if (!q) return rows;
      return rows.filter(function(g){ return groupLabel(g).toLowerCase().indexOf(q) !== -1; });
    }
    /* The RPC's booleans arrive as real booleans from Supabase but as strings through Bubble. */
    function isYes2(v){ return v === true || v === "true" || v === "yes" || v === 1 || v === "1"; }
    function groupLabel(g){
      if (isYes2(g.is_untagged)) return "No topic";
      return String(g.tag_name || g.group_key || "");
    }
    function groupTagIds(g){
      if (isYes2(g.is_untagged)) return [];
      if (isYes2(g.is_custom)){
        var cg = readCustomGroups().filter(function(c){ return c.key === g.group_key; })[0];
        return cg ? cg.tag_ids.slice() : [];
      }
      return g.tag_id ? [String(g.tag_id)] : [];
    }
    function groupId(g){ return String(g.group_key == null ? "" : g.group_key); }

    /* The select-all-for-this-group checkbox markup, shared by grpHeadHtml() (full render) and
       syncGroupHeadCheckbox() (surgical patch on open/close -- see toggleGroup() for why that
       needs to be surgical rather than a full head re-render). Returns "" when the group isn't
       open: no gesture makes sense against a group whose rows aren't loaded. */
    /* .is-visible is baked into the markup here so a FULL re-render (grpHeadHtml, e.g. after a
       search/sort/select-all touches the whole group list) shows the checkbox immediately, at full
       opacity, with no animation -- the delayed fade is specifically an OPEN-transition thing (see
       syncGroupHeadCheckbox), not something a checkbox should replay every time an unrelated render
       happens to pass through it. */
    function grpSelectallHtml(id, open){
      if (!open) return "";
      var rows = state.gRows || [];
      var anySel = rows.some(function(r){ return !!state.selected[String(r.prompt_id)]; });
      var allSel = rows.length > 0 && rows.every(function(r){ return !!state.selected[String(r.prompt_id)]; });
      var gChecked = state.gSelectAllGroup === id || allSel;
      var gIndet = !gChecked && anySel;
      return '<span class="upt-check upt-grp-selectall is-visible' + (gChecked ? " is-checked" : (gIndet ? " is-indeterminate" : "")) +
        '" role="checkbox" tabindex="0" aria-checked="' + (gChecked ? "true" : (gIndet ? "mixed" : "false")) +
        '" data-grp-selectall="' + esc(id) + '">' + (gChecked ? CHECK_SVG : "") + '</span>';
    }
    /* Patches the checkbox in or out of an EXISTING header node without touching anything else in
       it -- toggleGroup() mutates the header's is-open class directly on the live node (so the
       chevron's CSS rotate transition actually animates; a full grpHeadHtml() re-render would swap
       in a brand-new SVG already at its final angle, no transition to animate FROM). The checkbox
       needs the same "patch the live node" treatment, or it would only ever catch up to state on
       the next full renderGroups() -- which is exactly the bug this fixes: opening a group toggled
       state.expandedGroup and the CSS class fine, but the checkbox stayed absent until some
       unrelated re-render happened to sweep through later.
       `reveal` is true only for the click that's actually OPENING this group (see toggleGroup): the
       checkbox is inserted invisible and, after the same GRP_ANIM_MS delay the row-block itself
       waits before firing its fetch, gets its .is-visible class added -- 200ms delay, then a 200ms
       CSS ease fade, not a plain instant appearance the row-block animation would otherwise dwarf. */
    function syncGroupHeadCheckbox(id, reveal){
      var head = elTbody.querySelector('[data-grp="' + cssEsc(id) + '"]');
      if (!head) return;
      var existing = head.querySelector(".upt-grp-selectall");
      var open = state.expandedGroup === id;
      if (existing) existing.parentNode.removeChild(existing);
      var html = grpSelectallHtml(id, open);
      if (!html) return;
      var tmp = document.createElement("div");
      tmp.innerHTML = html;
      var el = tmp.firstChild;
      if (reveal){
        el.classList.remove("is-visible");
        setTimeout(function(){ el.classList.add("is-visible"); }, GRP_ANIM_MS);
      }
      head.insertBefore(el, head.firstChild);
    }

    /* KPI cell — same primitives the flat rows use, so a Visibility figure in a group header and
       one in a row are literally the same widget. */
    /* Value first, label under it in uppercase — the number is what you scan, the label only
       tells you which number it is. */
    function grpKpi(label, html){
      return '<div class="upt-grp-kpi"><span class="upt-grp-kpi-val">' + html + '</span>' +
             '<span class="upt-grp-kpi-lbl">' + esc(label) + '</span></div>';
    }
    /* Shared with renderGroupSidelist() below -- a topic-type group is the SAME .up-topicchip
       the topic popover and the grouping popup draw, a custom group is its colour dot + name, and
       "No topic" is bare text. One function, so the wide view's sidelist can never drift from
       what the inline header already draws for the identical group. */
    function groupChipHtml(g){
      var custom = isYes2(g.is_custom), untag = isYes2(g.is_untagged);
      var label = groupLabel(g);
      if (custom){
        /* A custom group has no emoji, but it does carry the colour the user picked (or the mix
           of its topics' colours) as a 6px dot in front of the name. */
        var cg = readCustomGroups().filter(function(c){ return c.key === g.group_key; })[0];
        var cgCol = (cg && cg.color) || "#6b7280";
        return '<span class="upt-grp-cdot" style="background:' + esc(cgCol) + '"></span>' +
               '<span class="upt-grp-name">' + esc(label) + '</span>';
      }
      if (untag) return '<span class="upt-grp-name">' + esc(label) + '</span>';
      /* core's .up-topicchip — the same chip the topic popover and the grouping popup draw.
         Read-only here, so no checkbox slot; everything else is identical by construction. */
      var hex = String(g.tag_hex_light || g.tag_hex_dark || "#6b7280");
      if (hex.charAt(0) !== "#") hex = "#" + hex;
      return '<span class="up-topicchip is-static" style="--ust-tag-color:' + esc(hex) + '">' +
               (g.tag_emoji ? '<span class="up-topicchip-e">' + esc(g.tag_emoji) + '</span>' : "") +
               '<span class="up-topicchip-lbl">' + esc(label) + '</span>' +
             '</span>';
    }
    function grpHeadHtml(g){
      var id = groupId(g), open = state.expandedGroup === id;
      var custom = isYes2(g.is_custom);
      var chip = groupChipHtml(g);
      var nAct = toNum(g.prompts_count), nIn = toNum(g.prompts_count_inactive);
      var counts = '<span class="up-num">' + (nAct == null ? "–" : UC.fmtTotal(nAct)) + '</span>' +
        ((nIn != null && nIn > 0) ? '<span class="upt-grp-inactive">+' + UC.fmtTotal(nIn) + '</span>' : "");
      var visN = toNum(g.visibility_pct);
      var vis = '<span class="up-num' + (visN == null ? " is-empty" : "") + '">' +
                (visN == null ? "–" : UC.fmtPct(visN)) + '</span>';
      var rankN = toNum(g.avg_rank);
      var rank = (rankN == null) ? '<span class="up-num is-empty">–</span>'
        : '<span class="up-rank-group">' + HASH_ICON + '<span class="up-num">' + fmt1(rankN) + '</span></span>';
      var sN = toNum(g.avg_sentiment);
      /* No .up-sent box here: in a header row of four KPIs the boxed one read as a control among
         plain numbers. Dot plus number, same colour logic. */
      var sent = (sN == null) ? '<span class="up-num is-empty">–</span>'
        : '<span class="upt-grp-sent"><span class="up-sent-dot" style="background:' + UC.sentColor(sN) + '"></span>' +
          '<span class="up-sent-val">' + Math.round(sN) + '</span></span>';

      /* Select-all-for-this-group checkbox -- ONLY exists while this group is the open one, exactly
         like the flat table's own header checkbox exists unconditionally in its heading row (not a
         hover reveal here either): no gesture makes sense against a group whose rows aren't loaded,
         so there is nothing to show or fade in for a collapsed group. Rendering "" rather than a
         present-but-invisible element when collapsed matters just as much as the element itself --
         .upt-grp-left is a plain flex sibling with no reserved slot for it, so the chevron/chip
         shift back to the same left edge a headerless row would use the moment the checkbox isn't
         in the DOM at all. Same left position a row's own checkbox sits at either way (.upt-grp-head
         and .up-td share the same 0 16px 0 12px padding, so a first-child element in either lands at
         the identical x). Markup itself lives in grpSelectallHtml() -- toggleGroup() patches this
         same element in/out on open/close without a full head re-render (see there for why). */
      var chk = grpSelectallHtml(id, open);
      return '<div class="upt-grp-head' + (open ? " is-open" : "") +
               '" data-grp="' + esc(id) + '"' +
               ' role="button" tabindex="0" aria-expanded="' + (open ? "true" : "false") + '">' +
          chk +
          '<div class="upt-grp-left">' + GRP_CHEV + chip + '</div>' +
          '<div class="upt-grp-kpis">' +
            grpKpi("Prompts", counts) + grpKpi("Visibility", vis) +
            grpKpi("Ø Rank", rank) + grpKpi("Ø Sentiment", sent) +
          '</div>' +
          groupMenuBtnHtml(id, custom) +
        '</div>';
    }
    /* Group actions -- Edit/Delete (custom groupings only) + Generate More (always), reached via
       one always-visible 3-dot button, not a hover reveal: on a touch device or with a mouse that
       never happens to rest over the row, a hover-only action is an action you can't discover.
       Shared verbatim between the inline header (grpHeadHtml) and the wide view's sidelist row
       (renderGroupSidelist) -- same actions, same order, same look, wherever a group row appears.
       grpActionMenu tracks which single group's menu is open (module state, like grpRowMenu);
       closing on outside click is handled by its own document listener further down, since this
       menu isn't nested inside any single makePopover-registered wrap the way grpRowMenu is
       (nested inside the Grouping popover, which already closes it for free). */
    var grpActionMenu = null;
    function groupActionsMenuHtml(id, custom){
      return '<div class="up-menu upt-grp-actmenu is-shown" role="menu">' +
        (custom ? '<div class="up-pop-opt" data-grp-headedit="' + esc(id) + '">Edit</div>' : "") +
        '<div class="up-pop-opt" data-grp-more="' + esc(id) + '">Generate More</div>' +
        (custom ? '<div class="up-pop-opt is-danger" data-grp-headdel="' + esc(id) + '">Delete</div>' : "") +
      '</div>';
    }
    function groupMenuBtnHtml(id, custom){
      var open = grpActionMenu === id;
      return '<div class="upt-grp-menuwrap' + (open ? " is-open" : "") + '">' +
        '<button class="upt-grp-menubtn" type="button" data-grp-menubtn="' + esc(id) + '" aria-label="Group actions" aria-haspopup="menu" aria-expanded="' + (open ? "true" : "false") + '">' + GRP_MORE_SVG + '</button>' +
        (open ? groupActionsMenuHtml(id, custom) : "") +
      '</div>';
    }

    /* Byte-for-byte the domains-table drilldown footer: the table's own .up-pagesize /
       .up-pager / .up-page primitives, a Rows selector, the windowed page list (ends, a run
       around the current page, "…" between) and prev/next chevrons. A pager that looked
       different one level down would read as a different product. */
    var GRP_PAGE_SIZES = [10, 25, 50];
    /* Sentinel group id for the sidelist's pinned "All Prompts" row -- not a real group_key, so it
       can never collide with one. Selecting it just means state.expandedGroup is null, which
       renderGroupWideBody() already treats as "show the flat table's own state.rows" (see there). */
    var GRP_ALL_ID = "__all__";
    function grpFootHtml(){
      var total = toNum(state.gTotal) || 0;
      if (window.console) console.log("[prompts-table] drilldown pager for group \"" + state.expandedGroup +
        "\" rendering with state.gTotal =", state.gTotal, "(shown as", total + ")");
      var cur = state.gPage;
      var pageCount = Math.max(1, Math.ceil(total / state.gPageSize));
      var from = (cur - 1) * state.gPageSize;
      var shown = state.gRows.length;
      var sizes = GRP_PAGE_SIZES.map(function(n){
        return '<button class="up-pagesize-btn' + (state.gPageSize === n ? " is-active" : "") +
               '" type="button" data-grpsize="' + n + '">' + n + '</button>';
      }).join("");
      var pages = pagerKit.pageWindow(cur, pageCount).map(function(p){
        if (p === "gap") return '<span class="up-page-gap">…</span>';
        return '<button class="up-page' + (p === cur ? " is-active" : "") + '" type="button" data-grppage="' + p + '">' + p + '</button>';
      }).join("");
      var info = total ? '<span class="up-pager-info">' + UC.fmtTotal(from + 1) + '–' +
        UC.fmtTotal(from + shown) + ' of ' + UC.fmtTotal(total) + '</span>' : "";
      return '<div class="upt-grp-foot">' +
        '<div class="up-pagesize"><span class="up-pagesize-lbl">Rows</span>' +
          '<div class="up-pagesize-seg" role="group" aria-label="Rows per page">' + sizes + '</div></div>' +
        '<div class="up-pager">' + info +
          (pageCount > 1 ?
            '<button class="up-page up-page-prev" type="button" aria-label="Previous page" data-grppage-prev' + (cur <= 1 ? " disabled" : "") + '>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
            '<span class="upt-grp-pages">' + pages + '</span>' +
            '<button class="up-page up-page-next" type="button" aria-label="Next page" data-grppage-next' + (cur >= pageCount ? " disabled" : "") + '>' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>'
            : "") +
        '</div>' +
      '</div>';
    }
    function grpRowsHtml(id, entering){
      if (state.expandedGroup !== id) return "";
      var body;
      if (state.gLoading || state.gRows == null) body = skeletonRows(state.gPageSize);
      else if (!state.gRows.length) body = '<div class="up-empty-mini">No prompts in this group</div>';
      else body = state.gRows.map(rowHtml).join("");
      return '<div class="upt-grp-rows' + (entering ? " is-entering" : "") + '" data-grp-for="' + esc(id) + '">' +
               '<div class="upt-grp-inner">' + body +
                 (state.gLoading ? "" : grpFootHtml()) +
               '</div></div>';
    }


    function renderGroups(){
      /* ONLY state.groupsLoading (set exclusively by fetchGroups() -- i.e. this component KNOWING
         it just asked for fresh groups) and !state.groupsHasData gate this skeleton. A tempting-
         looking earlier version also gated on state.extLoading (setPromptsTableLoading), reasoning
         that an external filter refreshing everything should show the groups view loading too --
         reverted, because extLoading turned out to be far too generic a signal to safely act on:
         it is a single shared flag with no information about WHAT is loading, and this app's own
         "Group Open" handler (like every other event handler here) wraps its own RPC in the exact
         same Loading yes/RPC/Loading no pattern -- so simply expanding ONE group also flipped
         extLoading true/false, which this code then read as "the whole groups list is stale,
         skeleton everything" even though nothing about the group LIST had changed at all. Confirmed
         live: opening a single group flashed every OTHER group's header too.
         There is no reliable way to distinguish "an external filter is about to refresh groups"
         from "literally any other RPC this component fires is in flight" using extLoading alone --
         it would need a dedicated, purpose-specific signal, which does not exist yet. Until a
         genuinely external groups-affecting refresh (e.g. a date-range filter) actually gets built
         and needs this, staying with the narrower, always-correct groupsLoading/groupsHasData pair
         is the safer default: it can undershoot (a genuinely external refresh shows stale groups
         briefly) but never overshoots into a false-positive flash like this did. */
      if (state.groupsLoading || !state.groupsHasData){
        /* The table's own skeleton, not a second one: a hand-rolled row of grey bars looked like a
           different product loading. */
        elTbody.innerHTML = skeletonRows(6);
        applyCols();
        if (state.groupsWide && elGrpSidelist) elGrpSidelist.innerHTML = "";
        return;
      }
      var rows = sortedGroups();
      if (!rows.length){
        /* Its own wording: "no prompts" is the flat table's message and sends you looking for the
           wrong problem when what is actually missing is the group payload. */
        /* Same .up-empty-* markup the flat empty state uses — only the wording differs, because
           "no prompts" sends you looking for the wrong problem when the group payload is what is
           missing. */
        elTbody.innerHTML = '<div class="up-empty">' +
          '<div class="up-empty-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
            '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></div>' +
          '<div class="up-empty-h">No groups</div>' +
          '<div class="up-empty-t">' + ((state.query || state.brandMentioned)
            ? "No topic group matches the current search."
            : "The grouping call returned no rows — check the setPromptsTableGroups step.") + '</div>' +
        '</div>';
        if (state.groupsWide && elGrpSidelist) elGrpSidelist.innerHTML = "";
        return;
      }
      /* Wide view: same data (sortedGroups()), completely different shape -- a side list instead
         of inline-expandable headers, and .up-tbody shows exactly the rows a flat-table render
         would (rowHtml, same as always), just for whichever group is picked in the list. Zero new
         fetch/event logic: renderGroupSidelist's click handler calls the SAME toggleGroup() the
         inline header click already uses. */
      if (state.groupsWide){
        renderGroupSidelist(filterGroupsForSidelist(rows));
        renderGroupWideBody();
        return;
      }
      elTbody.innerHTML = rows.map(function(g){
        var id = groupId(g);
        return '<div class="upt-grp" data-grp-sec="' + esc(id) + '">' + grpHeadHtml(g) + grpRowsHtml(id) + '</div>';
      }).join("");
      applyCols();
      initTopicsCells();
    }
    /* No KPIs here on purpose (spec) -- a color dot + name, same label logic grpHeadHtml uses.
       .is-open marks the currently expanded (state.expandedGroup) one. Pinned first: "All Prompts"
       (GRP_ALL_ID) -- selecting it just means no real group is open, which renderGroupWideBody()
       already renders as the flat table's own state.rows. Pinned at the TOP, not the bottom: the
       same place Notion/Attio/HubSpot-style grouped list views put their own ungrouped/"all" entry,
       so it reads as the default rather than one option among many. Styled exactly like the
       untagged "No topic" row (plain .upt-grp-name, no chip) plus one thing neither topic nor
       custom groups have: a small dot in the PRIMARY text colour (var(--vc-text), not a per-group
       hex) -- not a colour identity like a real group's dot, just a plain bullet marking this as
       the pinned "everything" entry. */
    function renderGroupSidelist(rows){
      if (!elGrpSidelist) return;
      var allOpen = !state.expandedGroup;
      var allItem = '<div class="upt-grp-sideitem upt-grp-sideitem-all' + (allOpen ? " is-open" : "") +
        '" role="button" tabindex="0" data-grp-side="' + GRP_ALL_ID + '">' +
        '<span class="upt-grp-sidechip">' +
          '<span class="upt-grp-cdot" style="background:var(--vc-text)"></span>' +
          '<span class="upt-grp-name">All Prompts</span>' +
        '</span>' +
      '</div>';
      elGrpSidelist.innerHTML = allItem + rows.map(function(g){
        var id = groupId(g), custom = isYes2(g.is_custom);
        var open = state.expandedGroup === id;
        var n = toNum(g.prompts_count);
        /* Same chip groupChipHtml() draws for the inline header -- a topic-type group reads as a
           topic (its real .up-topicchip), a custom one as its colour dot, exactly like the
           non-wide view, not a plain grey dot regardless of kind. Not a <button> here (the group
           actions menu below needs its own nested <button>, and a button can't contain one) --
           role="button"/tabindex mirrors .upt-grp-head's own convention for the identical reason. */
        return '<div class="upt-grp-sideitem' + (open ? " is-open" : "") +
          '" role="button" tabindex="0" data-grp-side="' + esc(id) + '">' +
          '<span class="upt-grp-sidechip">' + groupChipHtml(g) + '</span>' +
          '<span class="upt-grp-sidecount">' + (n == null ? "–" : esc(UC.fmtTotal(n))) + '</span>' +
          groupMenuBtnHtml(id, custom) +
        '</div>';
      }).join("");
    }
    /* Asks for the flat prompts data "All Prompts" needs, the same way a manual search does --
       reuses search.run() (fires the existing data-search-fn/uptSearch event with whatever
       state.query currently is, usually "") rather than inventing a new event, because uptSearch
       is already the mechanism every later filter/sort change relies on to refresh state.rows
       while grouped (see refreshOpenGroupIfAny/applySort's own comments) -- Bubble's own workflow
       bound to it already has to answer with fresh flat rows regardless of grouping for THAT case
       to work at all. No-ops once state.hasData is true or a fetch is already in flight
      (isBusy()), so this can be called on every render() without re-firing: the first call sets
       state.loading, which is exactly what makes every call after it a no-op until real data (or a
       real empty answer) lands and flips state.hasData. */
    function ensureFlatDataForAllPrompts(){
      if (state.hasData || isBusy()) return;
      search.run();
    }
    /* .up-tbody's content here is exactly what the flat table would put there for state.gRows —
       same rowHtml(), same skeleton/empty markup grpRowsHtml() already used inline. Pagination
       reuses grpFootHtml() as-is (already fully self-contained on state.gPage/gPageSize/gTotal;
       its own data-grppage/data-grpsize handlers are delegated on document, not scoped to the
       inline layout, so they work unchanged here). */
    function renderGroupWideBody(){
      /* No group open -- "All Prompts" is selected in the sidelist. Render literally the same
         thing the flat (non-grouped) view would: renderFlatBody() reads state.rows/state.pageSize,
         the SAME fields every later uptSearch/uptSort/etc. event already keeps current regardless
         of grouping (see applySort/search.onFire) -- so switching between groups and All Prompts
         needs no new Bubble event once state.rows has SOME data in it.
         The gap that isn't covered by that: state.rows can still be genuinely empty here -- on a
         page that boots directly into grouped+wide mode (grouping persisted from localStorage), or
         after grouping was toggled on before any flat data ever arrived. There is no Bubble "kick"
         that fills it in on its own in that case (confirmed live: the initial load fired the
         grouped-headers RPC but never the flat prompts one). ensureFlatDataForAllPrompts() below
         asks for it the same way a manual search would -- see its own comment for why that's safe
         to reuse instead of needing a new event. */
      if (!state.expandedGroup){ ensureFlatDataForAllPrompts(); renderFlatBody(); return; }
      var body;
      if (state.gLoading || state.gRows == null) body = skeletonRows(state.gPageSize);
      else if (!state.gRows.length) body = '<div class="up-empty-mini">No prompts in this group</div>';
      else body = state.gRows.map(rowHtml).join("");
      elTbody.innerHTML = body + (state.gLoading ? "" : grpFootHtml());
      applyCols();
      initTopicsCells();
    }
    /* Thin wide-view wrapper around toggleGroup(): same state transition, same fetchGroupPage()
       call, same "click the open one again to close" / "switch straight to a different one"
       behaviour -- toggleGroup()'s own DOM patches (querySelector against .upt-grp-head/
       [data-grp-sec]) are silent no-ops here since neither exists in this layout, so the two
       renders below are what actually reflect the change. This is the "0 new event logic" the
       spec asked for: toggleGroup() already fires the one RPC (uptGroupOpen) either layout needs. */
    function toggleGroupWide(id){
      if (id === GRP_ALL_ID){ selectAllPrompts(); return; }
      toggleGroup(id);
      renderGroupSidelist(filterGroupsForSidelist(sortedGroups()));
      renderGroupWideBody();
      syncFlatFootVisibility();
      /* The reused header checkbox (see toggleSelectAll/syncSelectAll) has to catch up on every
         open/close/switch -- closing clears it (nothing open to select), switching groups must not
         leave it showing the PREVIOUS group's checked/indeterminate state. */
      syncSelectAll();
    }
    /* Selecting the sidelist's pinned "All Prompts" row: closes whichever real group was open (no
       animation to wait for here, unlike toggleGroup()'s own close branch -- the sidelist has no
       .upt-grp-rows entering/exiting block to animate) and falls back to the flat body. A no-op if
       All Prompts was already showing, so re-clicking it doesn't re-render for nothing. */
    function selectAllPrompts(){
      if (!state.expandedGroup) return;
      state.expandedGroup = null;
      state.gRows = []; state.gTotal = null; state.gReqId = null; state.gLoading = false; state.gPage = 1;
      renderGroupSidelist(filterGroupsForSidelist(sortedGroups()));
      renderGroupWideBody();
      syncFlatFootVisibility();
      syncSelectAll();
    }

    /* Lazy load: one request per expand, and one more per page turn inside the open group. */
    function fetchGroupPage(delay){
      var id = state.expandedGroup;
      if (!id) return;
      var g = (state.groups || []).filter(function(x){ return groupId(x) === id; })[0];
      if (!g) return;
      state.gLoading = true;
      if (state.groupsWide) renderGroupWideBody(); else renderGroupBlockOnly(id);
      function fireNow(){
        if (state.expandedGroup !== id) return;   // closed again before the delay elapsed
        grpReqSeq += 1;
        state.gReqId = grpReqSeq;
        fire("data-groupopen-fn", "uptGroupOpen", {
          group_key: id,
          tag_ids: groupTagIds(g).join(","),
          untagged: isYes2(g.is_untagged) ? "yes" : "no",
          is_custom: isYes2(g.is_custom) ? "yes" : "no",
          /* A custom group means ALL of its topics, so p_tagmode is 'and'. A plain topic group is
             a single tag_id, where the mode makes no difference — 'and' keeps one value to wire up
             instead of a conditional in the workflow. */
          tagmode: "and",
          /* Same limit/offset/page trio every other paginated event in this app sends. */
          limit: state.gPageSize,
          offset: (state.gPage - 1) * state.gPageSize,
          page: state.gPage,
          order: orderValue(state.sortField, state.sortDir),
          request_id: grpReqSeq
        });
      }
      if (delay) setTimeout(fireNow, delay); else fireNow();
    }
    /* Shared by every toolbar filter that changes WHICH rows match (sort, search, brand-mentioned
       toggle, mentioned-brands apply): if a group happens to be open when one of them fires, its
       own rows are exactly as filter-dependent as the flat table's, so they need the same re-fetch
       -- otherwise the open group keeps showing rows from before the filter changed until closed
       and reopened. Re-fires the SAME uptGroupOpen event fetchGroupPage always fires (with
       whatever order/search/etc. state already holds by the time this runs), no new Bubble-side
       event needed. Page reset to 1 -- a changed filter invalidates whatever page of the group you
       were on the same way it does for the flat table's own state.page. Groups themselves (the
       header list) deliberately do NOT refresh here -- see fetchGroups' own comment, headers were
       never filter-live by design, only the currently open group's rows are being kept honest. */
    function refreshOpenGroupIfAny(){
      if (groupingOn() && state.expandedGroup){
        var id = state.expandedGroup;
        state.gPage = 1;
        fetchGroupPage(0);
        /* The caller (applySort/search.onFire/cycleBrand/submitMent) always ends with its own
           renderTable()/render() call right after this returns -- which, since renderGroups()
           unconditionally rebuilds every group header's markup on every call (not just on a
           skeleton path, see grpHeadHtml), REPLACES this group's own header node a moment from
           now. Scrolling synchronously here would measure a node about to be thrown away. One
           rAF later that rebuild has already happened (synchronous, same call stack turn the
           caller runs right after this returns), so the fresh node is safe to measure. */
        requestAnimationFrame(function(){ scrollGroupHeadToTop(id); });
      }
    }
    /* Re-pins the given group's header to wherever it's SUPPOSED to sit -- the sticky offset when
       in sticky mode, flush against the viewport top otherwise -- instead of leaving wherever the
       browser happened to land the scroll after a filter change. Without this, a sort/search/
       brand/mentioned change while a group is open and its header pinned would otherwise often
       scroll away from it entirely: the group's OWN rows still briefly shrink to their own local
       skeleton while refetching (see fetchGroupPage/grpRowsHtml, unrelated to and unaffected by
       the renderGroups() skeleton reverted above), and losing that much page height while scrolled
       past the sticky threshold makes the browser clamp scrollY down on its own, with nothing
       here to put it back once the real (taller) content returns.
       getComputedStyle(head).top reads back the RESOLVED sticky offset (the calc() result, e.g.
       264px) when position is sticky -- not the live stuck/unstuck position -- which is exactly
       the target we want, no need to duplicate that calc() formula here. Falls back to 0 (flush
       to the very top) when not in sticky mode, where "top" computes to "auto". */
    function scrollGroupHeadToTop(id){
      if (state.expandedGroup !== id) return;   // closed again before this frame ran
      var head = elTbody.querySelector('[data-grp="' + cssEsc(id) + '"]');
      if (!head) return;
      var targetTop = parseFloat(getComputedStyle(head).top) || 0;
      var delta = head.getBoundingClientRect().top - targetTop;
      if (Math.abs(delta) > 1) window.scrollBy({ top: delta, left: 0, behavior: "instant" });
    }
    /* In-place swap of just this group's sub-block, never a rebuild of the whole list -- the same
       reason domains-table does it: recreating the header under an active mouse flickers. */
    function renderGroupBlockOnly(id, entering){
      var sec = elTbody.querySelector('[data-grp-sec="' + cssEsc(id) + '"]');
      if (!sec) return;
      var old = sec.querySelector('[data-grp-for]');
      var html = grpRowsHtml(id, entering);
      if (!html){ if (old) old.parentNode.removeChild(old); return; }
      var tmp = document.createElement("div");
      tmp.innerHTML = html;
      var next = tmp.firstChild;
      if (old) sec.replaceChild(next, old); else sec.appendChild(next);
      applyCols();
      initTopicsCells();
    }
    function cssEsc(v){ return String(v).replace(/["\\]/g, "\\$&"); }

    function toggleGroup(id){
      var head = elTbody.querySelector('[data-grp="' + cssEsc(id) + '"]');
      if (state.expandedGroup === id){
        var sec = elTbody.querySelector('[data-grp-sec="' + cssEsc(id) + '"]');
        var block = sec && sec.querySelector('[data-grp-for]');
        state.expandedGroup = null;
        state.gRows = []; state.gTotal = null; state.gLoading = false; state.gReqId = null; state.gPage = 1;
        if (head){ head.classList.remove("is-open"); head.setAttribute("aria-expanded", "false"); }
        /* Checkbox has to catch up to the class toggle above -- see syncGroupHeadCheckbox's own
           comment for why this can't just wait for the next full renderGroups(). */
        syncGroupHeadCheckbox(id);
        /* Animate out BEFORE removing: dropping the node immediately makes it vanish instead. */
        if (block){
          block.classList.add("is-closing");
          setTimeout(function(){ if (block.parentNode) block.parentNode.removeChild(block); }, GRP_ANIM_MS);
        }
        return;
      }
      /* Switching straight from one open group to another: close the old one instantly. */
      if (state.expandedGroup){
        var oldId = state.expandedGroup;
        var oldSec = elTbody.querySelector('[data-grp-sec="' + cssEsc(oldId) + '"]');
        var oldHead = elTbody.querySelector('[data-grp="' + cssEsc(oldId) + '"]');
        var oldBlock = oldSec && oldSec.querySelector('[data-grp-for]');
        if (oldBlock && oldBlock.parentNode) oldBlock.parentNode.removeChild(oldBlock);
        if (oldHead){ oldHead.classList.remove("is-open"); oldHead.setAttribute("aria-expanded", "false"); }
        state.expandedGroup = id;   // reassigned BEFORE the sync below, so oldId's own checkbox reads "closed"
        syncGroupHeadCheckbox(oldId);
      } else {
        state.expandedGroup = id;
      }
      state.gRows = []; state.gTotal = null; state.gReqId = null; state.gPage = 1;
      if (head){ head.classList.add("is-open"); head.setAttribute("aria-expanded", "true"); }
      /* reveal=true: this is the actual open, so the checkbox waits GRP_ANIM_MS then fades in over
         its own 200ms ease, rather than just appearing the instant the row-block starts opening. */
      syncGroupHeadCheckbox(id, true);
      /* Small delay before firing, exactly as domains-table does: the open animation and a
         synchronous re-render in the same frame read as a stutter. */
      fetchGroupPage(GRP_ANIM_MS + 40);
      renderGroupBlockOnly(id, true);
    }

    /* Header data. Fired on: the "Group by topics" toggle, the "Only show custom groupings"
       checkbox, saving/hiding/deleting a custom grouping. NOT re-fired on search/brand-filter
       changes -- state.groupsHasData latches true after the first successful load and nothing
       ever clears it, so the header counts/visibility stay whatever they were as of the last
       explicit grouping action while you filter. (Worth knowing, not obviously a bug -- flag it
       back if the headers should track search/filter live.) */
    function fetchGroups(){
      state.groupsLoading = true;
      renderTable();
      /* Hidden groupings are simply not sent: the server never computes a section nobody wants to
         see, instead of computing it and the client throwing it away. */
      var custom = readCustomGroups().filter(function(g){ return !g.hidden; });
      var p = { grouped: "yes", mode: state.groupMode };
      /* Only send p_groups when the user actually HAS visible custom groups -- the RPC's default
         is one group per topic plus untagged, and sending an empty array would ask for zero. */
      if (custom.length) p.groups = JSON.stringify(custom.map(function(g){
        return { key: g.key, tag_ids: g.tag_ids };   // color is a client-side concern
      }));
      fire("data-groups-fn", "uptGroups", p);
    }
    /* Page-load-specific: if grouping was already on from a persisted (localStorage) state, this
       fires as part of the FIRST synchronous render(), which can run before Bubble has finished
       publishing its own bubble_fn_* function onto window -- fire() (see UC.makeFire) tries
       exactly once and gives up silently (a console warning, nothing else) if the name isn't
       resolvable yet, unlike Bubble's own "Render" RunJS step, which polls for OUR function for
       up to 6s before giving up. A user-triggered click (toggle grouping, edit a custom group)
       never hits this: by then the page has been up for a while and Bubble's function is long
       since published, so firing immediately there is correct and stays that way -- only THIS one
       call site, made before any user interaction, needs the same wait Bubble's own step gets.
       state.groupsLoading is set synchronously here (not just inside fetchGroups(), which only
       runs once resolution succeeds) so that a second render() during the retry window -- a
       resize, a responsive re-layout, anything that re-renders before the poll resolves -- sees
       the render() guard's `!state.groupsLoading` as already false and doesn't start a second,
       parallel poll loop that would double-fire the event once both resolve. */
    function fetchGroupsInitial(){
      var fnName = root.getAttribute("data-groups-fn") || "uptGroups";
      var tries = 0;
      state.groupsLoading = true;
      (function go(){
        if (UC.resolveBubbleFn(fnName) || tries++ >= 30){ fetchGroups(); return; }
        setTimeout(go, 100);
      })();
    }

    /* Whether the flat table's own footer (.up-foot: page-size seg + pager) should be visible.
       True whenever the flat table owns the body -- either not grouped at all, or grouped-and-wide
       with "All Prompts" selected (no real group open), since that state literally renders the
       flat body/pagination inside the wide view (see renderFlatBody/renderGroupWideBody). Its own
       function so toggleGroupWide()/selectAllPrompts() can re-sync it on every sidelist switch, not
       just on a full renderTable() pass. */
    function syncFlatFootVisibility(){
      var grouped = groupingOn();
      var showFlatFoot = !grouped || (state.groupsWide && !state.expandedGroup);
      /* Explicit "flex"/"none" with !important BOTH ways, not a clear-to-"" for the show case --
         .up-root.is-grouped .up-foot{display:none} in prompts-table.css would otherwise still win
         while grouped (an absent inline style loses to ANY class rule, !important or not), which is
         exactly the "All Prompts selected in wide view" case this now needs to show through. A host
         page's own CSS can also out-specificity a class-based display:none from an embedded
         component's stylesheet -- confirmed live: an embedding page's global reset/theme CSS with
         an !important display rule on this element beats BOTH the class rule AND a plain inline
         style (inline style only outranks a non-!important selector; an !important selector still
         beats a plain inline value). setProperty(..., "important") is the one thing left that
         cannot lose that fight in either direction, so the pager some host CSS accidentally kept
         visible can never be mistaken for an open GROUP's own (that one is .upt-grp-foot, driven by
         state.gTotal, and lives inside the open group's own block). */
      if (elFoot) elFoot.style.setProperty("display", showFlatFoot ? "flex" : "none", "important");
    }
    /* elTbody.innerHTML is reassigned in every branch below, which throws away whatever grid-
       column inline style applyCols() had put on the previous .up-row elements — a brand new
       set of rows carries no inline style at all until applyCols() runs again. Callers outside
       the full render() cycle (checkbox toggle, search results, pagination) call renderTable()
       directly, so that reapply has to happen HERE, not rely on a later render(). Shared verbatim
       between the plain (non-grouped) view and the grouped-wide view's "All Prompts" selection
       (see renderGroupWideBody) -- same state.rows/state.pageSize, same skeleton/empty rules,
       same everything, just rendered in a different place in the DOM. */
    function renderFlatBody(){
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
    function renderTable(){
      /* The grouped view owns the body entirely; the flat path below is untouched by it. */
      var grouped = groupingOn();
      root.classList.toggle("is-grouped", grouped);
      /* render() unconditionally calls renderPageSize()/renderPager() regardless of grouping,
         which keeps refreshing this element's CONTENT (page-size buttons, page numbers,
         "1-15 of 88" -- the flat table's own state.pageSize/currentTotal(), nothing to do with any
         group) even while it might be hidden -- syncFlatFootVisibility() is belt-and-suspenders on
         top of the .up-root.is-grouped .up-foot{display:none} CSS rule for exactly that reason. */
      syncFlatFootVisibility();
      if (grouped){ renderGroups(); return; }
      renderFlatBody();
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
        refreshOpenGroupIfAny();
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
    /* Same field list the Grouping dropdown's "Sort groups by" quick-picks use (GRP_SORTS,
       state.groupSort), styled and behaving exactly like populateSort() above (checkmarked options
       + a Descending switch) instead of the dense-button strip -- this lives right where you're
       already looking (the sidelist heading), so it gets the full control, not a shortcut version
       of it. Writes the SAME state.groupSort the quick-picks read/write, so the two stay in sync. */
    function populateGrpSideSort(){
      if (!elGrpSideSortMenu) return;
      var html = '<div class="up-pop-head">Sort by</div>';
      html += GRP_SORTS.map(function(f){
        var label = f.key === "name" ? "Name" : f.label;
        return '<div class="up-pop-opt' + (f.key === state.groupSort ? " is-active" : "") + '" data-grpside-sortfield="' + f.key + '">' +
                 '<span>' + esc(label) + '</span>' +
                 '<span class="up-check">' + CHECK_SVG + '</span>' +
               '</div>';
      }).join("");
      html += '<div class="up-pop-div"></div>' +
        '<div class="up-pop-row"><span class="up-pop-label">Descending</span>' +
          '<span class="up-switch' + (state.groupSortDir === "desc" ? " is-on" : "") + '" role="switch" data-grpside-sortdir></span>' +
        '</div>';
      elGrpSideSortMenu.innerHTML = html;
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
        return '<span class="up-explain-row">34%' +
          '<span class="up-explain-up">' + UC.TREND_UP + '</span>' +
          '<span class="up-explain-up">2.9%</span></span>';
      }
      if (kind === "rank"){
        return '<span class="up-explain-row">' + UC.HASH_ICON + '2.3' +
          '<span class="up-explain-down">' + UC.TREND_DOWN + '</span>' +
          '<span class="up-explain-down">0.4</span></span>';
      }
      if (kind === "sentiment"){
        return '<span class="up-explain-row">78' +
          '<span class="up-explain-up">' + UC.TREND_UP + '</span>' +
          '<span class="up-explain-up">4</span></span>';
      }
      if (kind === "brands"){
        return '<span class="up-explain-row" style="gap:0">' +
          '<span class="up-explain-dot"></span><span class="up-explain-dot" style="margin-left:-4px"></span>' +
          '<span class="up-explain-dot" style="margin-left:-4px"></span>' +
          '<span class="up-explain-dot up-explain-more" style="margin-left:-4px">+2</span></span>';
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
        return '<div class="up-explain-vis">' + explainVisual(kind) + '</div>' +
          '<div class="up-explain-h">' + esc(info.h) + '</div>' +
          '<div class="up-explain-t">' + esc(info.t) + '</div>';
      }
    });

    /* ---------------- dropdowns ---------------- */
    var POP_GROUP = "upt-" + instanceId;
    if (elGrpWrap && elGrpMenu){
      grpPop = UC.makePopover({
        wrap: elGrpWrap, menu: elGrpMenu,
        opener: elGrpWrap.querySelector(".upt-group-btn"), group: POP_GROUP
      });
      elGrpWrap.__upPop = grpPop;
    }
    [elSort, elCols, elMent, elGrpSideSort].forEach(function(p){
      if (!p) return;
      p.__upPop = UC.makePopover({
        wrap: p, menu: p.querySelector(".up-sort-menu, .up-cols-menu, .up-ment-menu, .upt-grp-sidesort-menu"), opener: p.querySelector("button"), group: POP_GROUP
      });
    });
    function popOf(pop){ return pop && pop.__upPop; }
    function setPopOpen(pop, open){
      var h = popOf(pop); if (!h) return;
      if (open) h.open(); else h.close(false);
    }
    function closePops(except){
      [elSort, elCols, elMent, elGrpWrap, elGrpSideSort].forEach(function(p){ if (p && p !== except) setPopOpen(p, false); });
    }

    /* grpActionMenu's own outside-click-close -- it isn't nested inside any single makePopover
       wrap (unlike grpRowMenu, which lives inside the Grouping popover and closes for free when
       THAT closes), it can appear on any group row across the whole table/sidelist, and a click
       anywhere on the page outside it -- not just inside root -- has to close it, so this is its
       own always-active listener rather than folded into the ownsTarget-gated one below. */
    document.addEventListener("click", function(e){
      if (grpActionMenu == null) return;
      if (e.target.closest(".upt-grp-menuwrap")) return;
      grpActionMenu = null;
      if (groupingOn()) renderGroups();
    });

    function ownsTarget(tg){
      return root.contains(tg) || (elSortMenu && elSortMenu.contains(tg)) || (elColsMenu && elColsMenu.contains(tg))
          || (elMentMenu && elMentMenu.contains(tg)) || (elBulk && elBulk.contains(tg))
          || (elGrpSideSortMenu && elGrpSideSortMenu.contains(tg));
    }
    document.addEventListener("click", function(e){
      if (!ownsTarget(e.target)) return;
      var inMenu = e.target.closest(".up-sort-menu, .up-cols-menu, .up-ment-menu, .upt-group-menu, .upt-grp-sidesort-menu");
      var onOpener = e.target.closest(".up-sort-btn, .up-cols-btn, .up-ment-btn, .upt-group-btn, .upt-grp-sidesort-btn");
      if (!inMenu && !onOpener) closePops();

      /* --- grouping: trigger, dropdown, accordion --- */
      if (e.target.closest(".upt-group-btn")){
        e.stopPropagation();
        if (!elGrpWrap) return;
        var openG = !elGrpWrap.classList.contains("is-open");
        closePops(elGrpWrap);
        if (openG){ grpRowMenu = null; populateGroupMenu(); if (grpPop) grpPop.open(); }
        else if (grpPop) grpPop.close(false);
        return;
      }
      if (e.target.closest(".upt-group-menu")){
        e.stopPropagation();
        if (e.target.closest("[data-grp-toggle]")){
          state.grouped = !state.grouped;
          writeGrouped(state.grouped);
          /* Flipping between the flat and grouped view is a different question, not a refinement
             of the last one -- a search or selection made in one reads as stale leftover state in
             the other. */
          clearSelection();
          var hadQuery = !!state.query;
          if (hadQuery){
            state.query = "";
            if (elSearchIn) elSearchIn.value = "";
            if (elSearch) elSearch.classList.remove("is-open", "has-text");
          }
          populateGroupMenu(); syncGroupBtn();
          state.expandedGroup = null;
          if (groupingOn() && !state.groupsHasData){
            fetchGroups();
          } else {
            /* Turning OFF fired nothing at all here before this line -- the only other place
               uptGroups fires is fetchGroups(), which this branch deliberately does NOT call
               (there's nothing to fetch when grouping is off). Bubble-side workflows that need to
               track "is grouping currently on" (e.g. an external date-range filter deciding
               whether it also needs to refresh the groups RPC) had no reliable signal for this
               transition -- turning ON always fired uptGroups with grouped:"yes" the first time,
               but the reverse never fired anything, unless a search happened to be active (whose
               own runSearch() event carries no `grouped` field at all). This one-off, no-RPC-
               expected fire makes uptGroups's own `grouped` field the single source of truth for
               both directions: extract it from every uptGroups payload, regardless of whether
               `groups` is also present, and keep a persistent state from that alone. */
            if (!groupingOn()) fire("data-groups-fn", "uptGroups", { grouped: "no" });
            if (hadQuery) runSearch();     // clears the filter server-side, not just the input
            else render();
          }
          return;
        }
        if (e.target.closest("[data-grp-onlycustom]")){
          state.groupMode = state.groupMode === "both" ? "custom" : (state.groupMode === "custom" ? "topics" : "both");
          writeGroupMode(state.groupMode);
          populateGroupMenu();
          state.expandedGroup = null;
          if (groupingOn()) fetchGroups();
          return;
        }
        var gs = e.target.closest("[data-grp-sort]");
        if (gs){
          state.groupSort = gs.getAttribute("data-grp-sort");
          writeGroupSort(state.groupSort);
          populateGroupMenu();
          /* Client-side only — re-sorting the sections needs no new request. The open group is
             closed first so its sub-block cannot end up under a different header. */
          state.expandedGroup = null;
          renderTable();
          return;
        }
        var ge2 = e.target.closest("[data-grp-eye]");
        if (ge2){
          var ek2 = ge2.getAttribute("data-grp-eye");
          writeCustomGroups(readCustomGroups().map(function(g){
            if (g.key !== ek2) return g;
            var n = { key: g.key, tag_ids: g.tag_ids, color: g.color };
            if (!g.hidden) n.hidden = true;      // toggle; hidden groups are simply not sent as p_groups
            return n;
          }));
          populateGroupMenu();
          if (groupingOn()) fetchGroups();
          return;
        }
        var rm = e.target.closest("[data-grp-rowmenu]");
        if (rm){
          var rk = rm.getAttribute("data-grp-rowmenu");
          grpRowMenu = (grpRowMenu === rk) ? null : rk;
          populateGroupMenu();
          return;
        }
        var ge = e.target.closest("[data-grp-edit]");
        if (ge){
          var ek = ge.getAttribute("data-grp-edit");
          grpRowMenu = null;
          if (grpPop) grpPop.close(false);
          openGroupModal(readCustomGroups().filter(function(x){ return x.key === ek; })[0] || null);
          return;
        }
        var gd = e.target.closest("[data-grp-del]");
        if (gd){
          var delKey = gd.getAttribute("data-grp-del");
          grpRowMenu = null;
          writeCustomGroups(readCustomGroups().filter(function(g){ return g.key !== delKey; }));
          populateGroupMenu();
          if (groupingOn()) fetchGroups();
          return;
        }
        if (e.target.closest("[data-grp-new]")){
          if (grpPop) grpPop.close(false);
          openGroupModal();
          return;
        }
        return;
      }
      /* These four must be checked BEFORE grpSide below: the group-actions menu button and its
         dropdown live NESTED inside a .upt-grp-sideitem[data-grp-side], so a click anywhere in
         them also matches grpSide's own closest() check -- whichever branch runs first wins, and
         a bare row-toggle must not swallow a menu click. */
      var grpMenuBtn = e.target.closest("[data-grp-menubtn]");
      if (grpMenuBtn){
        e.stopPropagation();
        var mbId = grpMenuBtn.getAttribute("data-grp-menubtn");
        grpActionMenu = (grpActionMenu === mbId) ? null : mbId;
        if (groupingOn()) renderGroups();
        return;
      }
      var grpMore = e.target.closest("[data-grp-more]");
      if (grpMore){
        e.stopPropagation();
        var mk = grpMore.getAttribute("data-grp-more");
        var mg = (state.groups || []).filter(function(x){ return groupId(x) === mk; })[0];
        grpActionMenu = null;
        if (groupingOn()) renderGroups();
        /* Fires the JS event and nothing else — no refetch, no state change, per the spec. */
        fire("data-generatemore-fn", "uptGenerateMore", { group_key: mk, tag_ids: mg ? groupTagIds(mg).join(",") : "" });
        return;
      }
      var grpHeadEdit = e.target.closest("[data-grp-headedit]");
      if (grpHeadEdit){
        e.stopPropagation();
        var hek = grpHeadEdit.getAttribute("data-grp-headedit");
        grpActionMenu = null;
        if (groupingOn()) renderGroups();
        openGroupModal(readCustomGroups().filter(function(x){ return x.key === hek; })[0] || null);
        return;
      }
      var grpHeadDel = e.target.closest("[data-grp-headdel]");
      if (grpHeadDel){
        e.stopPropagation();
        var hdk = grpHeadDel.getAttribute("data-grp-headdel");
        grpActionMenu = null;
        writeCustomGroups(readCustomGroups().filter(function(g){ return g.key !== hdk; }));
        if (groupingOn()) fetchGroups();
        return;
      }
      var grpSide = e.target.closest("[data-grp-side]");
      if (grpSide){
        e.stopPropagation();
        toggleGroupWide(grpSide.getAttribute("data-grp-side"));
        return;
      }
      var grpSelAll = e.target.closest("[data-grp-selectall]");
      if (grpSelAll){
        e.stopPropagation();
        toggleGroupHeaderCheckbox(grpSelAll.getAttribute("data-grp-selectall"));
        return;
      }
      var grpSize = e.target.closest("[data-grpsize]");
      if (grpSize){
        e.stopPropagation();
        var ns = Number(grpSize.getAttribute("data-grpsize"));
        if (ns === state.gPageSize) return;
        state.gPageSize = ns; state.gPage = 1; fetchGroupPage(0);
        return;
      }
      var grpMaxPage = function(){
        return Math.max(1, Math.ceil((toNum(state.gTotal) || 0) / state.gPageSize));
      };
      var grpNum = e.target.closest("[data-grppage]");
      if (grpNum){
        e.stopPropagation();
        var pn = Number(grpNum.getAttribute("data-grppage"));
        if (!pn || pn === state.gPage) return;
        state.gPage = pn; fetchGroupPage(0);
        return;
      }
      if (e.target.closest("[data-grppage-prev]")){
        e.stopPropagation();
        if (state.gPage <= 1) return;
        state.gPage -= 1; fetchGroupPage(0);
        return;
      }
      if (e.target.closest("[data-grppage-next]")){
        e.stopPropagation();
        if (state.gPage >= grpMaxPage()) return;
        state.gPage += 1; fetchGroupPage(0);
        return;
      }
      var grpHead = e.target.closest("[data-grp]");
      if (grpHead && elTbody.contains(grpHead)){
        toggleGroup(grpHead.getAttribute("data-grp"));
        return;
      }

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
        if (e.target.closest("[data-bulk-group-all]")){
          state.gSelectAllGroup = state.expandedGroup;
          persist(); renderBulkBar(); syncSelCount(); fireSelect(); syncStagedTopicsToSelection();
          renderGroups(); return;
        }
        if (e.target.closest("[data-bulk-undoall]")){
          invalidateSelectAll();
          persist(); renderBulkBar(); syncSelCount(); fireSelect(); syncStagedTopicsToSelection();
          if (groupingOn()) renderGroups(); return;
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

      /* --- the sidelist's own Sorter (same state.groupSort/groupSortDir the Grouping dropdown's
         quick-picks read/write, just the full field+direction control instead of a shortcut). --- */
      var sideSortBtn = e.target.closest(".upt-grp-sidesort-btn");
      if (sideSortBtn){
        var openSS = !elGrpSideSort.classList.contains("is-open");
        closePops(elGrpSideSort);
        if (openSS) populateGrpSideSort();
        setPopOpen(elGrpSideSort, openSS);
        return;
      }
      var ssf = e.target.closest("[data-grpside-sortfield]");
      if (ssf){
        state.groupSort = ssf.getAttribute("data-grpside-sortfield");
        writeGroupSort(state.groupSort);
        populateGrpSideSort();
        state.expandedGroup = null;
        if (groupingOn()) renderTable();
        return;
      }
      if (e.target.closest("[data-grpside-sortdir]")){
        state.groupSortDir = state.groupSortDir === "desc" ? "asc" : "desc";
        writeGroupSortDir(state.groupSortDir);
        populateGrpSideSort();
        state.expandedGroup = null;
        if (groupingOn()) renderTable();
        return;
      }
      /* --- the sidebar toggle -- one handler, both locations (sidelist heading + toolbar
         heading), since both carry the same data-grp-widebtn marker and always mean the same
         thing: toggle wide view. --- */
      if (e.target.closest("[data-grp-widebtn]")){
        toggleGroupsWide();
        return;
      }
      /* The sidelist heading's own "+" -- same New Grouping modal the toolbar dropdown's own
         data-grp-new opens, but THAT handler only fires from inside .upt-group-menu (see above);
         this button lives in .upt-grp-sidehead, a different part of the DOM entirely, so it needs
         its own unscoped check rather than being reachable through that one. */
      if (e.target.closest(".upt-grp-sideadd")){
        openGroupModal();
        return;
      }
      if (e.target.closest("[data-grp-sidesearch-open]")){
        toggleGrpSideSearch(true);
        return;
      }
      if (e.target.closest("[data-grp-sidesearch-close]")){
        toggleGrpSideSearch(false);
        return;
      }

      // --- header sorters ---
      var th = e.target.closest(".up-th.is-sortable");
      if (th){
        if (e.target.closest(".up-grip")) return;                 // the grip is not a sort target
        if (+new Date() - lastResizeEnd < 300) return;            // the click that ends a drag
        headSortClick(th.getAttribute("data-sortcol")); return;
      }

      /* --- topics cell (opens the Edit Topics popup; must come BEFORE the row-click handler) ---
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
          if (tId) openEditTopicsModal(tId);
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

    if (elGrpSideSearchIn){
      elGrpSideSearchIn.addEventListener("input", function(){
        state.grpSideQuery = elGrpSideSearchIn.value;
        var box = elGrpSidehead ? elGrpSidehead.querySelector(".upt-grp-sidesearch-box") : null;
        if (box) box.classList.toggle("has-text", !!elGrpSideSearchIn.value.length);
        if (groupingOn() && state.groupsWide) renderGroupSidelist(filterGroupsForSidelist(sortedGroups()));
      });
      elGrpSideSearchIn.addEventListener("keydown", function(e){
        if (e.key === "Escape"){ e.stopPropagation(); toggleGrpSideSearch(false); }
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

    /* Below this root width there is no longer room for a 256px-minimum group sidelist (see
       .upt-grp-sidepanel's own min-width in prompts-table.css) plus a table worth looking at --
       same neighbourhood as is-narrow (860) so the list doesn't force the table into a narrower
       squeeze than the table's own breakpoints already consider workable. */
    var GRP_SIDELIST_MIN_ROOT = 860;
    function fitGroupsWide(w){
      if (!groupingOn()){ root.classList.remove("is-groups-cramped"); return; }
      var cramped = w < GRP_SIDELIST_MIN_ROOT;
      root.classList.toggle("is-groups-cramped", cramped);
      /* Force the list closed rather than merely hiding its toggle -- an already-open list has to
         actually go away the moment there's no room for it, not just become unreachable to
         re-open later. Re-opening it is what the (now hidden) toolbar toggle is for; there is
         nothing left here for the user to do once it's closed, so no confirmation, just close it
         the same way toggleGroupsWide() itself would. */
      if (cramped && state.groupsWide){
        state.groupsWide = false;
        writeGroupsWide(false);
        root.classList.remove("is-groups-wide");
        renderGroups();
      }
    }
    /* responsive: drop columns rather than squeezing them */
    function applyResponsive(){
      var w = root.getBoundingClientRect().width || 0;
      if (!w) return;
      var before = root.className;
      search.syncTakeover();
      fitToolbar();
      fitGroupsWide(w);
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
      syncGroupBtn();
      /* Only ever reachable here on the true initial mount (see fetchGroupsInitial's own comment):
         once groups have loaded once, state.groupsHasData latches true forever, so this branch
         can't fire again from any later render() call -- every other path to fetchGroups() is a
         direct, immediate, user-triggered call elsewhere (the toggle, the checkbox, saving a
         custom group), correctly NOT going through this retry-aware wrapper. */
      if (groupingOn() && !state.groupsHasData && !state.groupsLoading) fetchGroupsInitial();
      renderStatusTabs(); renderBulkBar();
      if (root.classList.contains("up-sticky")) syncTheadOffset();
    }

    if (state.query){ elSearchIn.value = state.query; elSearch.classList.add("is-open", "has-text"); }
    populateSort(); populateCols(); populateMent(); render();

    return {
      root: root,
      /* ---- grouped view: the two setters Bubble calls back into ---- */
      setGroups: function(rows){
        state.groups = Array.isArray(rows) ? rows : [];
        state.groupsHasData = true;
        state.groupsLoading = false;
        /* A fresh header set invalidates whatever section was open — the sections themselves may
           be different objects now. */
        state.expandedGroup = null;
        state.gRows = []; state.gTotal = null; state.gLoading = false;
        renderTable();
      },
      setGroupPrompts: function(rows, requestId){
        /* Stale-response guard, same shape as the drilldown's: a slow answer to an older request
           must not overwrite a newer one. */
        if (requestId != null && state.gReqId != null && String(requestId) !== String(state.gReqId)) return;
        var list = coerceRows(rows);
        state.gRows = list;
        /* group_total_count rides on every row this same prompts RPC call returns -- the
           filtered-set count for the tag_ids this specific group-open request asked for, and what
           the group's own pager pages through. Not the group header's prompts_count (a separate,
           coarser figure from the groups list itself). total_count on the SAME row is a different
           field now: the overall active-prompts count, identical in meaning to the flat table's
           own total_count -- it feeds the heading count (renderCount()), same as the no-grouping
           view already does, not the group pager. */
        state.gTotal = list.length ? toNum(list[0].group_total_count) : 0;
        if (list.length && list[0].total_count != null) state.totalCount = toNum(list[0].total_count);
        state.gLoading = false;
        if (state.expandedGroup){
          if (state.groupsWide){ renderGroupWideBody(); syncSelectAll(); } else renderGroupBlockOnly(state.expandedGroup);
        }
        renderCount();
      },
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

  /* Both take the RPC's array straight through UC.parseBubbleJson, so a raw Bubble string with
     its usual `"avg_rank":,` holes works without any regex on the workflow side. */
  /* Same loud failure doRender already has: a silent `return false` on a mismatched instanceId
     reads as "the grouped view is broken", with nothing anywhere saying what actually happened. */
    function warnNoRoot(fnName, id){
    if (!window.console) return;
    var have = Array.prototype.map.call(document.querySelectorAll(".upt-root"), function(r){
      return r.getAttribute("data-instance") || "(none)";
    });
    console.warn("[prompts-table] " + fnName + ": no .upt-root with data-instance " +
      JSON.stringify(id) + ". On this page: " + (have.length ? have.join(", ") : "no .upt-root at all") + ".");
  }
  /* Reports what ACTUALLY arrived instead of guessing at it. The previous message said "the
     array handed in was empty" for every non-string value -- including undefined, null and a
     plain object -- which made three different causes look like one. */
  function describeArg(v){
    if (v === undefined) return "undefined (the argument never arrived)";
    if (v === null) return "null";
    var t = Object.prototype.toString.call(v).slice(8, -1);
    var extra = "";
    try { extra = " — value: " + JSON.stringify(v).slice(0, 240); } catch(e){ extra = ""; }
    if (t === "Array") return "Array(" + v.length + ")" + extra;
    if (t === "String") return "String(" + v.length + " chars)" + extra;
    return t + extra;
  }
  function coerceRows(v){
    if (typeof v === "string") v = UC.parseBubbleJson(v);
    if (Array.isArray(v)) return v;
    /* Some Bubble plugins hand the result back wrapped. Accept the common shapes rather than
       silently rendering nothing. */
    if (v && typeof v === "object"){
      var keys = ["rows", "data", "result", "results", "items", "groups"];
      for (var i = 0; i < keys.length; i++){
        var inner = v[keys[i]];
        if (typeof inner === "string") inner = UC.parseBubbleJson(inner);
        if (Array.isArray(inner)) return inner;
      }
      /* A single row delivered as one object, not wrapped in an array. */
      if (v.group_key != null || v.tag_id != null || v.is_untagged != null) return [v];
    }
    return [];
  }
  function doGroups(id, rows){
    /* Called as setPromptsTableGroups(ROWS) with the id left out: treat the first argument as
       the rows and fall back to the only root on the page. */
    if (rows === undefined && (Array.isArray(id) || (id && typeof id === "object"))){ rows = id; id = null; }
    var list = coerceRows(rows);
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".upt-root"));
    if (!ctrl || !ctrl.setGroups){ warnNoRoot("setPromptsTableGroups", id); return false; }
    if (!list.length && window.console){
      console.warn("[prompts-table] setPromptsTableGroups got 0 groups. Second argument was: " +
        describeArg(rows) + ". Expected an array of group rows (or the JSON string of one).");
    }
    ctrl.setGroups(list);
    return true;
  }
  function doGroupPrompts(id, rows, requestId){
    var list = coerceRows(rows);
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".upt-root"));
    if (!ctrl || !ctrl.setGroupPrompts){ warnNoRoot("setPromptsTableGroupPrompts", id); return false; }
    ctrl.setGroupPrompts(list, requestId);
    return true;
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
    /* onMount: makeMount replays Bubble's queued render* calls while it is still
       constructing, i.e. before `mount` below has been assigned. Without this the very
       first render Bubble queued threw on `mount` being undefined and was swallowed. */
    onMount: function(m){ mount = m; },
    rootClass: "upt-root", notPortal: true,
    ctrlProp: "__uptController",
    resolveLocal: "__uptResolveLocal",
    queue: "__uptBootQueue",
    initRoot: initRoot,
    api: { renderPromptsTable: doRender, setPromptsTableLoading: doLoading, resetPromptsTable: doReset,
           setPromptsTableTopics: doTopics, setPromptsTableBrands: doBrands,
           setPromptsTableGroups: doGroups, setPromptsTableGroupPrompts: doGroupPrompts },
    forwardShape: { renderPromptsTable: "params", resetPromptsTable: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end uptRun

  uptBoot(50); // retry for ~5s before giving up on core.js
})();
