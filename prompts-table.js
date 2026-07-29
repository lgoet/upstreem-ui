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
    ["renderPromptsTable", "setPromptsTableLoading", "resetPromptsTable"].forEach(function(n){
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
     the auto-locate tail, initTopicsCells() below calls window.UstTopics.init(cell) directly for
     every .ust-cell after each render. Everything else (styling, popup, layout, hover-reveal,
     theme) is unchanged, so it looks and behaves exactly like the version already live elsewhere. */
  function installUstTopics(){
    if (window.UstTopics) return;
    window.UstTopics = (function(){
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
        '.ust-empty{color:#a0a5ad;font-size:13px;line-height:1;}',
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
        '.ust-topics-popup[data-theme="dark"]{background:#151515;border-color:#353535;box-shadow:0 14px 34px rgba(0,0,0,0.6);}',
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
        return '<span class="ust-tag" style="--ust-tag-color:'+esc(t.color)+';">'+(t.emoji?'<span class="ust-tag-emoji">'+esc(t.emoji)+'</span>':'')+'<span class="ust-tag-label">'+esc(t.name)+'</span></span>';
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
        if(!tags.length){ row.innerHTML='<span class="ust-empty">—</span>'; return; }

        tags.forEach(function(t){
          var el=document.createElement('span');
          el.className='ust-tag'; el.style.setProperty('--ust-tag-color', t.color);
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
    { key: "visibility", label: "Visibility",      w: "minmax(10%, 1fr)",   min: 100 },
    { key: "rank",       label: "Rank",            w: "minmax(10%, 1fr)",   min: 90,  dropAt: "vnarrow" },
    { key: "brands",     label: "Brand Mentions",  w: "minmax(12%, 1fr)",   min: 150 },
    { key: "sentiment",  label: "Sentiment",       w: "minmax(9%, 1fr)",    min: 100, dropAt: "narrow" },
    { key: "topics",     label: "Topics",          w: "minmax(12%, 1fr)",   min: 150, dropAt: "vnarrow" },
    { key: "market",     label: "Market",          w: "minmax(8%, 0.6fr)", min: 90,  dropAt: "narrow" },
    { key: "created",    label: "Created",         w: "minmax(10%, 0.7fr)",min: 110, dropAt: "narrow" }
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
  var ORDER = {
    "prompt:asc": "prompt_asc",         "prompt:desc": "prompt_desc",
    "visibility:desc": "visibility_desc", "visibility:asc": "visibility_asc",
    "rank:asc": "rank_asc",             "rank:desc": "rank_desc",
    "sentiment:desc": "sentiment_desc", "sentiment:asc": "sentiment_asc",
    "created:desc": "created_desc",     "created:asc": "created_asc"
  };
  function orderValue(field, dir){ return ORDER[field + ":" + dir] || "created_desc"; }
  var HEAD_CYCLE = {
    prompt:     ["prompt:asc", "prompt:desc"],
    visibility: ["visibility:desc", "visibility:asc"],
    rank:       ["rank:asc", "rank:desc"],
    sentiment:  ["sentiment:desc", "sentiment:asc"],
    created:    ["created:desc", "created:asc"]
  };
  var DEFAULT_SORT = { field: "created", dir: "desc" };

  function makeController(root){
    var instanceId = root.getAttribute("data-instance") || "default";
    var saved = STORE[instanceId] || {};

    var isDark = isYes(root.getAttribute("data-isdark"));
    if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
    if (window.UstTopics) window.UstTopics.setTheme(isDark ? "dark" : "light");

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
      brandMentioned: saved.brandMentioned || ""
    };
    function applyRowHeightClass(){
      root.classList.remove("is-rh-compact", "is-rh-dynamic");
      if (state.rowHeight === "compact") root.classList.add("is-rh-compact");
      else if (state.rowHeight === "dynamic") root.classList.add("is-rh-dynamic");
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
        selected: state.selected, brandMentioned: state.brandMentioned
      };
    }
    /* shared event dispatch (core) */
    var fire = UC.makeFire(root, { label: "prompts-table", eventPrefix: "upt-" });

    var MOBILE_SEARCH_MAX = 640;
    var search = UC.makeSearch({
      root: root, box: elSearch, input: elSearchIn, state: state,
      mobileMax: MOBILE_SEARCH_MAX, prefix: "upt",
      onRender: function(){ renderTable(); renderPager(); },
      onFire: function(payload){ fire("data-search-fn", "uptSearch", payload); },
      persist: function(){ persist(); }
    });
    function runSearch(){ search.run(); }
    function toggleSearch(){ search.toggle(); }
    function onSearchInput(){ search.onInput(); }

    /* ---------------- brand mentioned (quick toggle) ----------------
       Same off -> yes -> no -> off cycle as urls-table/domains-table. Visible only once
       data-brand-name is actually filled in (Bubble's placeholder text otherwise shows through). */
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
      state.brandMentioned = state.brandMentioned === "" ? "yes" : (state.brandMentioned === "yes" ? "no" : "");
      state.page = 1;
      persist(); syncBrand(); renderPager();
      fire("data-brand-fn", "uptBrand", { brand_mentioned: state.brandMentioned });
    }

    /* ---------------- selection ---------------- */
    function selectedIds(){ return Object.keys(state.selected).filter(function(k){ return state.selected[k]; }); }
    function fireSelect(){
      var ids = selectedIds();
      fire("data-select-fn", "uptSelect", { selected: ids.join(","), count: ids.length });
    }
    function toggleSelectRow(id){
      if (state.selected[id]) delete state.selected[id]; else state.selected[id] = true;
      persist(); renderTable(); syncSelectAll(); fireSelect();
    }
    function toggleSelectAll(){
      var rows = state.rows || [];
      if (!rows.length) return;
      var allSel = rows.every(function(r){ return state.selected[String(r.prompt_id)]; });
      rows.forEach(function(r){
        var id = String(r.prompt_id);
        if (allSel) delete state.selected[id]; else state.selected[id] = true;
      });
      persist(); renderTable(); syncSelectAll(); fireSelect();
    }
    function syncSelectAll(){
      var box = root.querySelector("[data-selectall]");
      if (!box) return;
      var rows = state.rows || [];
      var total = rows.length;
      var sel = rows.filter(function(r){ return state.selected[String(r.prompt_id)]; }).length;
      var all = total > 0 && sel === total;
      var some = sel > 0 && sel < total;
      box.classList.toggle("is-checked", all);
      box.classList.toggle("is-indeterminate", some);
      box.setAttribute("aria-checked", all ? "true" : (some ? "mixed" : "false"));
      box.innerHTML = all ? CHECK_SVG : "";
    }

    /* ---------------- table ---------------- */
    function skeletonRows(n){
      return UC.skeletonRows({ count: n, cols: [
        { w:180, jitter:40, cls:"upt-td-prompt" },
        { w:56,  cls:"upt-td-visibility" },
        { w:44,  cls:"upt-td-rank" },
        { logo:true, logoStyle:"border-radius:999px", cls:"upt-td-brands" },
        { w:56,  cls:"upt-td-sentiment" },
        { w:90,  cls:"upt-td-topics" },
        { w:60,  cls:"upt-td-market" },
        { w:76,  cls:"upt-td-created" }
      ]});
    }
    function visCell(v){
      var n = (v == null || v === "") ? null : Number(v);
      var bad = n == null || !isFinite(n);
      return '<span class="up-num">' + (bad ? "–" : (Math.round(n) + "%")) + '</span>';
    }
    function rankCell(v){
      return '<span class="up-rank-group">' + HASH_ICON + '<span class="up-num">' + fmt1(v) + '</span></span>';
    }
    function sentCell(v){
      var n = (v == null || v === "") ? null : Number(v);
      var bad = n == null || !isFinite(n);
      var sc = bad ? "#9E9E9E" : UC.sentColor(n);
      return '<span class="up-sent"><span class="up-sent-dot" style="background:' + sc + '"></span>' +
             '<span class="up-sent-val">' + (bad ? "–" : Math.round(n)) + '</span></span>';
    }
    function marketCell(m){
      var code = String(m == null ? "" : m).trim().toUpperCase();
      if (!code) return '<span class="up-num">–</span>';
      return '<span class="upt-market">' +
               '<span class="upt-flag"><img src="https://flagcdn.com/' + esc(code.toLowerCase()) + '.svg" alt="" loading="lazy"/></span>' +
               '<span class="upt-market-code">' + esc(code) + '</span>' +
             '</span>';
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
      var checked = !!state.selected[id];
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
        '<div class="up-td upt-td-brands">' + UC.brandStack(r.top_mentions, r.companies_preview_totalcount) + '</div>' +
        '<div class="up-td upt-td-sentiment">' + sentCell(r.avg_sentiment_30d) + '</div>' +
        '<div class="up-td upt-td-topics">' + topicsCell(id, r.tags) + '</div>' +
        '<div class="up-td upt-td-market">' + marketCell(r.market) + '</div>' +
        '<div class="up-td upt-td-created"><span class="upt-date">' + esc(fmtDate(r.created_at)) + '</span></div>' +
      '</div>';
    }
    function initTopicsCells(){
      if (!window.UstTopics) return;
      Array.prototype.forEach.call(elTbody.querySelectorAll(".ust-cell"), function(cell){
        if (!cell.__ustInit) window.UstTopics.init(cell);
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
          }, 3000);
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
      var n = (state.totalCount != null) ? state.totalCount : (state.hasData ? state.rows.length : null);
      if (n == null){ elHeadCount.textContent = ""; elHeadCount.classList.add("is-sk"); return; }
      elHeadCount.textContent = UC.fmtTotal(n);
      elHeadCount.classList.remove("is-sk");
    }

    /* ---------------- header sorters ---------------- */
    var sortTimer = null;
    function applySort(field, dir){
      state.sortField = field; state.sortDir = dir;
      state.page = 1;
      persist(); syncHeadSorters(); populateSort();
      clearTimeout(sortTimer);
      sortTimer = setTimeout(function(){
        search.setLatest(null);
        fire("data-sort-fn", "uptSort", {
          order: orderValue(state.sortField, state.sortDir),
          sort_field: state.sortField, sort_dir: state.sortDir
        });
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

    root.addEventListener("pointerdown", function(e){
      var grip = e.target.closest(".up-grip");
      if (!grip) return;
      e.stopPropagation();
      startResize(e);
    });

    function setRowHeight(mode){
      if (state.rowHeight === mode) return;
      state.rowHeight = mode;
      applyRowHeightClass();
      writeRowHeight(); populateCols();
    }

    function firePage(){
      search.setLatest(null);
      fire("data-page-fn", "uptPage", { limit: state.pageSize, offset: offset(), page: state.page });
    }

    /* ---------------- tooltips (shared via core) ---------------- */
    var _tips = UC.makeTooltips(root, function(){ return isDark; });
    var showTipWide = _tips.showTipWide, hideTip = _tips.hideTip;
    /* Full prompt text on a short hover-delay, but only when actually clipped — mirrors
       urls-table's title hover, checking both dimensions since the clip can be a 1/2-line
       vertical clamp (default/compact) or, in principle, horizontal overflow. */
    var promptTipTimer = null, promptTipWrap = null;
    root.addEventListener("mouseover", function(e){
      var wrap = e.target.closest(".upt-prompt-wrap");
      if (!wrap || !root.contains(wrap)) return;
      if (wrap === promptTipWrap) return;
      promptTipWrap = wrap;
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

    /* ---------------- dropdowns ---------------- */
    var POP_GROUP = "upt-" + instanceId;
    [elSort, elCols].forEach(function(p){
      if (!p) return;
      p.__upPop = UC.makePopover({
        wrap: p, menu: p.querySelector(".up-sort-menu, .up-cols-menu"), opener: p.querySelector("button"), group: POP_GROUP
      });
    });
    function popOf(pop){ return pop && pop.__upPop; }
    function setPopOpen(pop, open){
      var h = popOf(pop); if (!h) return;
      if (open) h.open(); else h.close(false);
    }
    function closePops(except){
      [elSort, elCols].forEach(function(p){ if (p && p !== except) setPopOpen(p, false); });
    }

    function ownsTarget(tg){
      return root.contains(tg) || (elSortMenu && elSortMenu.contains(tg)) || (elColsMenu && elColsMenu.contains(tg));
    }
    document.addEventListener("click", function(e){
      if (!ownsTarget(e.target)) return;
      var inMenu = e.target.closest(".up-sort-menu, .up-cols-menu");
      var onOpener = e.target.closest(".up-sort-btn, .up-cols-btn");
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
        state.brandMentioned = "";
        state.page = 1;
        persist(); syncBrand();
        search.cancel(); runSearch();
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
      if (e.target.closest(".upt-brand-toggle")){ closePops(); cycleBrand(); return; }

      // --- selection (must come before header-sorter / row-click) ---
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
      if (th){ headSortClick(th.getAttribute("data-sortcol")); return; }

      // --- row click ---
      var row = e.target.closest(".up-row");
      if (row && !row.classList.contains("up-tsk")){
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
      if (!row || row.classList.contains("up-tsk")) return;
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
        if (window.UstTopics) window.UstTopics.setTheme(isDark ? "dark" : "light");
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

    /* responsive: drop columns rather than squeezing them */
    function applyResponsive(){
      var w = root.getBoundingClientRect().width || 0;
      if (!w) return;
      var before = root.className;
      search.syncTakeover();
      root.classList.toggle("is-t1", w < 560);
      root.classList.toggle("is-narrow", w < 860);
      root.classList.toggle("is-vnarrow", w < 620);
      if (root.className !== before) applyCols();
      else if (state.widths && state.widths.prompt) applyCols();
    }
    if (window.ResizeObserver){
      new ResizeObserver(function(){
        if (root.__uptRaf) return;
        root.__uptRaf = requestAnimationFrame(function(){ root.__uptRaf = null; applyResponsive(); });
      }).observe(root);
    }
    window.addEventListener("resize", applyResponsive);

    /* sticky header machinery (core) */
    var _sticky = UC.makeSticky(root, elHead);
    function syncTheadOffset(){ _sticky.syncTheadOffset(); }
    window.addEventListener("resize", function(){ _sticky.applySticky(); });
    _sticky.applySticky();

    function render(){
      renderTable(); renderCount(); syncHeadSorters(); syncColsBadge(); syncSelectAll(); syncBrand();
      renderPageSize(); renderPager(); applyCols(); applyResponsive();
      if (root.classList.contains("up-sticky")) syncTheadOffset();
    }

    if (state.query){ elSearchIn.value = state.query; elSearch.classList.add("is-open", "has-text"); }
    populateSort(); populateCols(); render();

    return {
      root: root,
      update: function(params){
        params = params || {};
        if (params.isDark != null){
          isDark = isYes(params.isDark);
          if (isDark) root.setAttribute("data-theme","dark"); else root.removeAttribute("data-theme");
          if (window.UstTopics) window.UstTopics.setTheme(isDark ? "dark" : "light");
        }
        if (params.requestId != null && search.latestReqId() != null && String(params.requestId) !== String(search.latestReqId())) return;
        if (params.rows != null){
          state.rows = Array.isArray(params.rows) ? params.rows : [];
          state.hasData = true;
        }
        if (params.totalCount != null) state.totalCount = toNum(params.totalCount);
        if (params.rows != null) state.loading = false;
        if (!explicitOverride && hasProcessingAttr()) state.extLoading = readProcessing();
        persist(); render();
      },
      setLoading: function(on){
        explicitOverride = true;
        LOADING_EXPLICIT[instanceId] = true;
        state.extLoading = isYes(on);
        if (!state.extLoading) state.loading = false;
        persist(); render();
      },
      reset: function(){
        state.query = ""; elSearchIn.value = ""; elSearch.classList.remove("is-open");
        state.sortField = DEFAULT_SORT.field; state.sortDir = DEFAULT_SORT.dir;
        state.pageSize = DEFAULT_PAGE_SIZE; state.page = 1;
        state.selected = {}; state.brandMentioned = "";
        state.widths = {}; writeWidths();
        elSearch.classList.remove("has-text");
        persist(); populateSort(); render();
        return true;
      },
      destroy: function(){
        if (root.__uptController === this) root.__uptController = null;
      }
    };
  }

  /* ================= init / multi-instance bootstrap ================= */
  function initRoot(root){
    if (root.__uptController) return root.__uptController;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;   // placeholder not replaced yet
    var ctrl = makeController(root);
    if (!ctrl) return null;
    root.__uptController = ctrl;
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
  function doReset(id){ var c = resolve(id); if (!c) return false; return c.reset(); }

  var mount = UC.makeMount({
    rootClass: "upt-root", notPortal: true,
    ctrlProp: "__uptController",
    resolveLocal: "__uptResolveLocal",
    queue: "__uptBootQueue",
    initRoot: initRoot,
    api: { renderPromptsTable: doRender, setPromptsTableLoading: doLoading, resetPromptsTable: doReset },
    forwardShape: { renderPromptsTable: "params", resetPromptsTable: "id" }
  });
  function rootsWithId(id){ return mount.rootsWithId(id); }
  function initAll(){ return mount.initAll(); }

  } // end uptRun

  uptBoot(50); // retry for ~5s before giving up on core.js
})();
