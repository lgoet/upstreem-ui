/* upstreem opportunities.js — kanban board for AI-visibility opportunities. Requires core.js
   (window.UpstreemCore) loaded first.

   MIGRATED FROM A STANDALONE FILE, VISUALS ONLY. The board's behaviour was already correct and is
   deliberately untouched here: same state shape, same filtering/sorting, same drag & drop, same
   status transitions, same emit() payloads, same window.opportunities* API, same Bubble function
   names. What changed is what it LOOKS like -- the standalone shipped its own complete design
   system (a full token set plus hand copies of the icon button, popover, switch, segmented
   control, tooltip, skeleton, chip and favicon box), which is why the board read as a different
   app than every other screen. All of that now comes from core.

   Two things that were genuinely wrong rather than merely different, and are fixed here because
   they are visual bugs:
     - TWO tooltip systems. The component carried its own .uo-tip element plus data-tip-title/
       data-tip-body attributes, so a tooltip on the board looked nothing like a tooltip on a
       table. Now: UC.makeTooltips for the small dark chips (data-tip), and the shared .up-explain
       popover for the two metrics that need a real explanation (potential, KPIs) -- the same
       treatment table column headers already use.
     - Citation-type colours were a locally invented palette (#14b8a6 for Editorial where the rest
       of the app uses #27a79b, and so on for all seven). Now: UC.typeColor/UC.citeName, which also
       gets the dark-mode variants right for free.

   Date formatting also moved from German month abbreviations (Mär/Mai/Okt/Dez) to the app's
   English format -- the standalone was the only German-language surface in the product. */
(function(){
  "use strict";

  function uoBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uoBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    var UC = window.UpstreemCore;
    uoRun();
    /* Bubble replaces this element's whole markup block once its dynamic attribute expressions
       resolve; without this the replacement root would never be initialised. Same guard every
       other component in this repo carries. */
    if (UC.watchRoots) UC.watchRoots("uo-root", uoRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(uoRun, ms); });
  }

  function uoRun(){
    var roots = document.querySelectorAll(".uo-root");
    Array.prototype.forEach.call(roots, function(root){
      if (root.__uoInit) return;
      root.__uoInit = true;
      initRoot(root, window.UpstreemCore);
    });
  }

  function initRoot(root, UC){

  /* ---------- state ---------- */
  var S = { items: [], mode: 'board', visible: { pending: true, in_progress: true, done: true, ignored: false }, query: '', sort: 'priority', externalOnly: false, detailId: null, loading: false };
  var COL_ORDER = ['ignored', 'pending', 'in_progress', 'done'];

  /* Column identity colours: status semantics, not the app's up/down or citation palettes, so they
     stay as they were. */
  var COLUMNS = [
    { key: 'pending',     label: 'Pending',     status: 'Created',     dot: '#9ca3af' },
    { key: 'in_progress', label: 'In Progress', status: 'In Progress', dot: '#2384E2' },
    { key: 'done',        label: 'Done',        status: 'Done',        dot: '#15803d' },
    { key: 'ignored',     label: 'Ignored',     status: 'Ignored',     dot: '#b4451f' }
  ];
  var REC_ICON = {
    create_matching_content: '<polyline points="16 3 21 3 21 8"/><line x1="10" y1="14" x2="21" y2="3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>',
    build_presence: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    get_listed: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1.2"/><circle cx="3.5" cy="12" r="1.2"/><circle cx="3.5" cy="18" r="1.2"/>',
    improve_existing_content: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>'
  };
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

  /* ---------- helpers ---------- */
  function esc(v){ var d = document.createElement('div'); d.textContent = String(v == null ? '' : v); return d.innerHTML; }
  function looseParse(s){ if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch(e){ return null; } }
  function fmtDate(iso){ if(!iso) return ''; var d = new Date(iso); if (isNaN(d.getTime())) return String(iso); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  function isDark(){ return UC.isYes(root.getAttribute('data-isdark')) || root.getAttribute('data-theme') === 'dark'; }
  function citePretty(c){ return UC.citeName ? UC.citeName(c) : String(c||'').replace(/_/g,' '); }
  function citeColor(c){ return UC.typeColor ? UC.typeColor(c, 'citation', isDark()) : 'var(--vc-muted)'; }
  function recIcon(t){ return REC_ICON[t] || REC_ICON.get_listed; }
  function statusKeyOf(item){
    var s = String(item.status||'').toLowerCase();
    if (s === 'in progress' || s === 'in_progress') return 'in_progress';
    if (s === 'done' || s === 'completed') return 'done';
    if (s === 'ignored') return 'ignored';
    return 'pending';
  }
  function potLevel(item){ var l = String(item.priority_label||'').toLowerCase(); if (l==='high') return 4; if (l==='medium') return 3; if (l==='low') return 2; var s = Number(item.priority_score)||0; return s>=75?4:s>=50?3:s>=25?2:1; }
  function pct(v){ var n = Number(v); if (!isFinite(n)) return '–'; return (n>0?'':'') + (Math.round(n*100)/100) + '%'; }

  /* core's .up-logo-box: one element, letter underneath, image on top. The standalone shipped two
     sibling nodes and toggled inline styles from an onerror handler; this drops the has-img class
     instead, which is what the shared CSS already keys off. */
  function favHtml(url, name){
    var initials = String(name||'?').trim().charAt(0).toUpperCase() || '?';
    var ltr = '<span class="up-logo-ltr">'+esc(initials)+'</span>';
    if (!url) return '<span class="up-logo-box">'+ltr+'</span>';
    return '<span class="up-logo-box has-img"><img src="'+esc(url)+'" alt="" referrerpolicy="no-referrer" loading="lazy" ' +
           'onerror="this.remove();this.parentNode.classList.remove(\'has-img\')">'+ltr+'</span>';
  }
  function potHtml(item){
    var lvl = potLevel(item);
    var bars = '';
    for (var i=1;i<=4;i++) bars += '<span class="uo-pot-bar p'+i+(i<=lvl?' is-on':'')+'"></span>';
    return '<div class="uo-pot" data-explain="potential"><div class="uo-pot-bars">'+bars+'</div></div>';
  }
  /* Topic chips are core's .up-topicchip (28px, tinted by --ust-tag-color) — the standalone had its
     own 26px .uo-tag with a parallel colour-mix implementation. */
  function tagPills(topics, limit){
    var list = Array.isArray(topics) ? topics : [];
    var shown = (limit ? list.slice(0, limit) : list);
    var hidden = list.length - shown.length;
    var html = shown.map(function(t){
      var color = t.hex_light || t.hex_dark || '#6b7280';
      return '<span class="up-topicchip" style="--ust-tag-color:'+esc(color)+';">'+
        (t.emoji?'<span class="up-topicchip-e">'+esc(t.emoji)+'</span>':'')+
        '<span class="up-topicchip-lbl">'+esc(t.name)+'</span></span>';
    }).join('');
    if (hidden > 0) html += '<span class="uo-tagmore">+'+hidden+'</span>';
    return html;
  }

  /* ---------- explainer copy ----------
     Same two-part popover the table column headers use (light preview panel on top, heading and
     one sentence below). Share reuses core's canonical wording via UC.explainCopy so it reads
     identically to the Share column in urls-table/domains-table. */
  var EXPLAIN_LOCAL = {
    potential:   { h: "Potential",  t: "Estimated upside from acting on this opportunity, based on its priority score. More filled bars mean a higher expected impact on your AI visibility." },
    competitors: { h: "Competitors", t: "How many tracked competitors are mentioned alongside this source." },
    gap:         { h: "Competitor Gap", t: "How far your conversion sits behind the average competitor for this source. A negative number means competitors convert better than you do." },
    conversion:  { h: "Your Conversion", t: "How often a citation of this source turns into a mention of your brand." },
    avgconv:     { h: "Avg. Competitor Conv.", t: "The same conversion rate, averaged across the competitors mentioned for this source." }
  };
  function explainInfo(kind){
    if (EXPLAIN_LOCAL[kind]) return EXPLAIN_LOCAL[kind];
    if (kind === 'share' && UC.explainCopy) return UC.explainCopy('share', { subject: 'source' });
    return null;
  }
  function explainVisual(kind){
    if (kind === 'potential'){
      var bars = '';
      for (var i=1;i<=4;i++) bars += '<span class="uo-pot-bar p'+i+(i<=3?' is-on':'')+'"></span>';
      return '<span class="up-explain-row"><span class="uo-pot-bars">'+bars+'</span>Medium</span>';
    }
    if (kind === 'share') return '<span class="up-explain-row">6.9%<span class="up-explain-down">1.4%</span></span>';
    if (kind === 'competitors') return '<span class="up-explain-row">7</span>';
    if (kind === 'gap') return '<span class="up-explain-row"><span class="up-explain-down">-18.3%</span></span>';
    return '<span class="up-explain-row">8.2%</span>';
  }
  var explainKit = UC.makeExplain ? UC.makeExplain({
    root: root,
    triggerSel: '[data-explain]',
    getIsDark: isDark,
    html: function(kind){
      var info = explainInfo(kind);
      if (!info) return '';
      return '<div class="up-explain-vis">' + explainVisual(kind) + '</div>' +
             '<div class="up-explain-h">' + esc(info.h) + '</div>' +
             '<div class="up-explain-t">' + esc(info.t) + '</div>';
    }
  }) : null;

  /* Small dark tooltip chips on every icon button, wired the app-wide way: makeTooltips installs a
     delegated [data-tip] handler on the root, so markup only carries the attribute. */
  if (UC.makeTooltips) UC.makeTooltips(root, isDark);

  /* ---------- card ---------- */
  function cardHtml(item){
    return '<div class="uo-card" draggable="true" data-id="'+esc(item.id)+'">'+
      '<div class="uo-card-top">'+
        '<span class="uo-eyebrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+recIcon(item.recommendation_type)+'</svg><span>'+esc(item.label||'')+'</span></span>'+
        potHtml(item)+
      '</div>'+
      '<h3 class="uo-card-title">'+esc(item.headline||'')+'</h3>'+
      '<p class="uo-card-reason">'+esc(item.reason||'')+'</p>'+
      '<div class="uo-source">'+favHtml(item.lead_favicon, item.lead_domain)+
        '<div class="uo-source-meta"><span class="uo-source-title">'+esc(item.lead_title||'')+'</span><span class="uo-source-domain">'+esc(item.lead_domain||'')+'</span></div>'+
      '</div>'+
      (item.topics && item.topics.length ? '<div class="uo-tags">'+tagPills(item.topics)+'</div>' : '')+
      '<div class="uo-card-foot"><span class="uo-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'+esc(fmtDate(item.created_at))+'</span></div>'+
    '</div>';
  }

  /* ---------- filtering / columns ---------- */
  function visibleColumns(){
    return COL_ORDER.map(function(k){ return COLUMNS.find(function(c){ return c.key === k; }); })
                    .filter(function(c){ return c && S.visible[c.key]; });
  }
  function matchQuery(it, q){
    if (!q) return true;
    var hay = [it.label, it.headline, it.reason, it.lead_title, it.lead_url, it.lead_domain];
    if (Array.isArray(it.topics)) it.topics.forEach(function(t){ hay.push(t.name); });
    return hay.some(function(h){ return String(h||'').toLowerCase().indexOf(q) !== -1; });
  }
  function shownItems(){
    var q = String(S.query||'').trim().toLowerCase();
    var arr = S.items.filter(function(it){
      if (!matchQuery(it, q)) return false;
      if (S.externalOnly && it.source_scope !== 'external_only') return false;
      return true;
    });
    arr.sort(function(a,b){
      if (S.sort === 'newest') return new Date(b.created_at||0) - new Date(a.created_at||0);
      return (Number(b.priority_score)||0) - (Number(a.priority_score)||0);
    });
    return arr;
  }

  /* Tags are capped at two rows; whatever lands on a third row folds into a "+N" chip. */
  function clampTagsTwoRows(container){
    if (!container) return;
    var old = container.querySelector('.uo-tagmore'); if (old) old.remove();
    var tags = Array.prototype.slice.call(container.querySelectorAll('.up-topicchip'));
    if (!tags.length) return;
    tags.forEach(function(t){ t.style.display=''; });
    var tops = [];
    tags.forEach(function(t){ var top = t.offsetTop; if (tops.indexOf(top) === -1) tops.push(top); });
    tops.sort(function(a,b){ return a-b; });
    if (tops.length <= 2) return;
    var row3 = tops[2];
    var visible = [];
    tags.forEach(function(t){ if (t.offsetTop >= row3) t.style.display='none'; else visible.push(t); });
    var hidden = tags.length - visible.length;
    var more = document.createElement('span');
    more.className = 'uo-tagmore'; more.textContent = '+'+hidden;
    container.appendChild(more);
    var guard = 0;
    while (more.offsetTop >= row3 && visible.length && guard < 60){
      var last = visible.pop(); last.style.display='none'; hidden++; more.textContent='+'+hidden; guard++;
    }
  }
  function clampAllCardTags(){
    requestAnimationFrame(function(){
      root.querySelectorAll('.uo-stage .uo-card .uo-tags').forEach(clampTagsTwoRows);
    });
  }

  /* ---------- board ---------- */
  function renderBoard(){
    var stage = root.querySelector('.uo-stage');
    var cols = visibleColumns();
    var pool = shownItems();
    stage.innerHTML = '<div class="uo-board">' + cols.map(function(col){
      var items = pool.filter(function(it){ return statusKeyOf(it) === col.key; });
      var body = items.length ? items.map(cardHtml).join('') : '<div class="uo-col-empty">Nothing here yet</div>';
      /* Kebab is always rendered now, not only on populated columns — same call as the prompts-
         table group headers, where a control that appears and disappears read as a glitch. */
      var menu = '<div class="uo-col-menu-wrap">'+
        '<button class="uo-col-kebab up-iconbtn" type="button" data-col="'+col.key+'" data-tip="Column actions" aria-label="Column actions" aria-haspopup="menu">'+
          '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg></button>'+
        '<div class="up-menu uo-col-menu" role="menu" aria-hidden="true">'+
          COLUMNS.filter(function(t){ return t.key !== col.key; }).map(function(t){
            return '<div class="up-pop-opt" role="menuitem" data-from="'+col.key+'" data-to="'+t.key+'"><span class="up-pop-label"><span class="uo-col-dot" style="background:'+t.dot+';"></span>Move all to '+t.label+'</span></div>';
          }).join('')+
        '</div>'+
      '</div>';
      return '<section class="uo-col" data-status-key="'+col.key+'">'+
        '<div class="uo-col-head"><span class="uo-col-dot" style="background:'+col.dot+';"></span><span class="uo-col-title">'+col.label+'</span><span class="up-head-sep" style="display:block"></span><span class="uo-col-count">'+items.length+'</span>'+menu+'</div>'+
        '<div class="uo-col-body">'+body+'</div>'+
      '</section>';
    }).join('') + '</div>';
    wireDnD();
    clampAllCardTags();
  }

  /* ---------- list ---------- */
  function renderList(){
    var stage = root.querySelector('.uo-stage');
    var cols = visibleColumns();
    var pool = shownItems();
    var html = '<div class="uo-list">';
    cols.forEach(function(col){
      var items = pool.filter(function(it){ return statusKeyOf(it) === col.key; });
      if (!items.length) return;
      html += '<div class="uo-list-section"><div class="uo-list-sechead"><span class="uo-col-dot" style="background:'+col.dot+';"></span><span class="uo-col-title">'+col.label+'</span><span class="up-head-sep" style="display:block"></span><span class="uo-col-count">'+items.length+'</span></div><div class="uo-list-rows">';
      html += items.map(function(item){
        return '<div class="uo-row" data-id="'+esc(item.id)+'">'+
          '<div class="uo-row-main">'+
            '<span class="uo-row-title">'+esc(item.headline||'')+'</span>'+
            '<span class="uo-row-sub">'+favHtml(item.lead_favicon, item.lead_domain)+'<span class="uo-row-domain">'+esc(item.lead_domain||'')+'</span><span class="uo-dot-sep"></span><span class="uo-row-domain">'+esc(fmtDate(item.created_at))+'</span></span>'+
          '</div>'+
          '<div class="uo-row-right">'+
            (item.topics && item.topics.length ? '<span class="uo-row-tags">'+tagPills(item.topics, 2)+'</span>' : '')+
            potHtml(item)+
          '</div>'+
        '</div>';
      }).join('');
      html += '</div></div>';
    });
    if (!pool.length) html += '<div class="uo-col-empty" style="margin-top:8px;">No matching opportunities</div>';
    html += '</div>';
    stage.innerHTML = html;
  }

  function updateLayout(){
    if (S.mode !== 'board'){ root.classList.remove('is-stacked'); return; }
    var stage = root.querySelector('.uo-stage');
    if (!stage) return;
    var n = visibleColumns().length || 1;
    var avail = stage.clientWidth;
    var needed = n * 300 + (n - 1) * 16;
    root.classList.toggle('is-stacked', avail > 0 && avail < needed);
  }

  /* ---------- skeleton ---------- */
  function skelCard(){
    return '<div class="uo-skel-card">'+
      '<div class="uo-skel uo-skel-chip"></div>'+
      '<div class="uo-skel uo-skel-title"></div>'+
      '<div class="uo-skel uo-skel-title short"></div>'+
      '<div class="uo-skel uo-skel-text"></div>'+
      '<div class="uo-skel uo-skel-text short"></div>'+
      '<div class="uo-skel-source"><div class="uo-skel uo-skel-fav"></div><div class="uo-skel uo-skel-line"></div></div>'+
      '<div class="uo-skel-tags"><div class="uo-skel uo-skel-tag"></div><div class="uo-skel uo-skel-tag sm"></div></div>'+
    '</div>';
  }
  function renderSkeleton(){
    var elTotal = root.querySelector('.uo-total');
    elTotal.classList.add('is-sk'); elTotal.textContent = '';
    var stage = root.querySelector('.uo-stage');
    var cols = visibleColumns();
    var per = [3, 2, 2, 1];
    stage.innerHTML = '<div class="uo-board">' + cols.map(function(col, ci){
      var n = per[ci] != null ? per[ci] : 1, cards = '';
      for (var i = 0; i < n; i++) cards += skelCard();
      return '<section class="uo-col" data-status-key="'+col.key+'">'+
        '<div class="uo-col-head"><span class="uo-col-dot" style="background:'+col.dot+';"></span><span class="uo-col-title">'+col.label+'</span><span class="up-head-sep" style="display:block"></span><span class="uo-skel uo-skel-cnt"></span></div>'+
        '<div class="uo-col-body">'+cards+'</div>'+
      '</section>';
    }).join('') + '</div>';
    updateLayout();
  }

  function render(){
    var elTotal = root.querySelector('.uo-total');
    if (S.loading){ renderSkeleton(); return; }
    elTotal.classList.remove('is-sk');
    var active = shownItems().filter(function(it){ var k = statusKeyOf(it); return k === 'pending' || k === 'in_progress'; }).length;
    elTotal.textContent = String(active);
    if (S.mode === 'list') renderList(); else renderBoard();
    updateLayout();
  }

  /* ---------- detail drawer ---------- */
  function kpiBlock(label, valHtml, explainKey){
    var info = explainKey ? '<span class="uo-kpi-info" data-explain="'+explainKey+'">'+INFO_SVG+'</span>' : '';
    return '<div class="uo-kpi"><div class="uo-kpi-label">'+label+info+'</div><div class="uo-kpi-val">'+valHtml+'</div></div>';
  }
  function metaItem(k, v){ return '<div class="uo-meta-item"><span class="uo-meta-k">'+k+'</span><span class="uo-meta-v">'+v+'</span></div>'; }

  function detailHtml(item){
    var gapNeg = Number(item.gap) < 0;
    var comps = Array.isArray(item.mentioned_competitors) ? item.mentioned_competitors : [];
    var compMore = (Number(item.competitor_count)||comps.length) - comps.length;
    /* Trend chip comes from core so it matches every other trend indicator in the app. */
    var trend = UC.trendChip ? UC.trendChip(item.trend_pct, { suffix: '%', decimals: true }) : '';

    var kpis = '<div class="uo-kpis">'+
      kpiBlock('Competitors', String(item.competitor_count||0), 'competitors')+
      kpiBlock('Share', pct(item.global_share_pct)+trend, 'share')+
      kpiBlock('Competitor Gap', '<span class="'+(gapNeg?'is-neg':'is-pos')+'">'+pct(item.gap)+'</span>', 'gap')+
      kpiBlock('Your Conversion', pct(item.your_conversion), 'conversion')+
      kpiBlock('Avg. Competitor Conv.', pct(item.avg_competitor_conversion), 'avgconv')+
    '</div>';

    var meta = '<div class="uo-meta-grid">'+
      metaItem('Market', esc(item.market||'–'))+
      metaItem('Citation Type', '<span class="uo-cite" style="--uo-cite:'+citeColor(item.effective_citation_type)+';">'+esc(citePretty(item.effective_citation_type))+'</span>')+
      (Number(item.supporting_urls_count) > 0 ? metaItem('Supporting URLs', esc(item.supporting_urls_count)) : '')+
      metaItem('Priority', esc(item.priority_label||'')+' · '+(Math.round((Number(item.priority_score)||0)*10)/10))+
      metaItem('Created', esc(fmtDate(item.created_at)))+
    '</div>';

    var compList = comps.length ? '<div class="uo-m-section-title">Mentioned competitors</div><div class="uo-comp-list">'+
      comps.map(function(c, i){ return '<div class="uo-comp" data-comp-idx="'+i+'" role="button" tabindex="0">'+favHtml(c.favicon_url, c.name)+'<span class="uo-comp-name">'+esc(c.name)+'</span></div>'; }).join('')+
      (compMore > 0 ? '<span class="uo-comp-more">+'+compMore+' more</span>' : '')+
      '</div>' : '';

    var statusKey = statusKeyOf(item);
    var statusSeg = '<div class="up-seg uo-status-seg" data-id="'+esc(item.id)+'">'+
      COL_ORDER.map(function(k){ return COLUMNS.find(function(c){ return c.key === k; }); })
        .filter(function(c){ return c && (c.key!=='ignored' || S.visible.ignored || statusKey==='ignored'); })
        .map(function(c){
          return '<button type="button" class="up-seg-btn'+(c.key===statusKey?' is-active':'')+'" data-status-key="'+c.key+'">'+c.label+'</button>';
        }).join('')+'</div>';

    var showCta = String(item.effective_citation_type || '') !== 'UGC_Community';
    /* Feather, stroke-only — the standalone used a filled sparkle glyph, the one icon in the file
       that broke the "no fill, always stroke: currentColor" rule (§2a). */
    var stars = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z"/><path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7L19 15z"/></svg>';
    var ctaHtml = showCta ? '<button class="uo-cta up-export" id="uo-cta" type="button" data-id="'+esc(item.id)+'">'+stars+'<span>Create this with AI</span></button>' : '';

    return '<div class="uo-m-head">'+
        '<div class="uo-m-actions">'+
          '<button class="uo-m-act up-iconbtn" id="uo-m-ignore" type="button" data-tip="Ignore" aria-label="Ignore opportunity"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></svg></button>'+
          '<button class="uo-m-act up-iconbtn" id="uo-m-goto" type="button" data-tip="Open URL" aria-label="Open URL"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></button>'+
          '<button class="uo-m-act up-iconbtn" id="uo-m-close" type="button" data-tip="Close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>'+
        '</div>'+
        '<div class="uo-m-source">'+favHtml(item.lead_favicon, item.lead_domain)+
          '<div class="uo-m-source-meta">'+
            '<div class="uo-m-source-title"><span class="uo-m-source-link" data-source-link>'+esc(item.lead_title||'')+'</span></div>'+
            '<div class="uo-m-source-row"><span>'+esc(item.lead_domain||'')+'</span><span class="uo-dot-sep"></span><span>'+esc(fmtDate(item.created_at))+'</span><span class="uo-dot-sep"></span><span class="uo-cite" style="--uo-cite:'+citeColor(item.effective_citation_type)+';">'+esc(citePretty(item.effective_citation_type))+'</span></div>'+
          '</div>'+
        '</div>'+
      '</div>'+
      '<div class="uo-m-body">'+
        '<div class="uo-m-eyebrow"><span class="uo-eyebrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+recIcon(item.recommendation_type)+'</svg><span>'+esc(item.label||'')+'</span></span>'+potHtml(item)+'</div>'+
        '<div class="uo-m-textwrap">'+
          '<div class="uo-m-titlerow"><h2 class="uo-m-title">'+esc(item.headline||'')+'</h2>'+
            '<button class="uo-copy uo-m-copy up-iconbtn" type="button" data-copy="detail" data-tip="Copy" aria-label="Copy">'+
              '<svg class="uo-copy-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'+
              '<svg class="uo-copy-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'+
            '</button></div>'+
          '<p class="uo-m-reason">'+esc(item.reason||'')+'</p>'+
        '</div>'+
        (item.topics && item.topics.length ? '<div class="uo-m-section-title">Topics</div><div class="uo-tags">'+tagPills(item.topics)+'</div>' : '')+
        '<div class="uo-m-section-title">Performance</div>'+kpis+
        '<div class="uo-m-section-title">Details</div>'+meta+
        compList+
      '</div>'+
      '<div class="uo-m-foot">'+statusSeg+ctaHtml+'</div>';
  }

  function openDetail(id){
    var item = S.items.find(function(x){ return String(x.id) === String(id); });
    if (!item) return;
    S.detailId = id;
    var modal = root.querySelector('.uo-modal');
    modal.innerHTML = detailHtml(item);
    if (closeTimer){ clearTimeout(closeTimer); closeTimer = null; }
    root.classList.add('detail-open');
    void modal.offsetWidth;
    requestAnimationFrame(function(){ root.classList.add('detail-in'); });
    modal.querySelector('#uo-m-close').addEventListener('click', closeDetail);
    var ign = modal.querySelector('#uo-m-ignore');
    if (ign) ign.addEventListener('click', function(){ emit('ignore_opportunity', { opportunity_id: id }); setStatus(id, 'ignored'); });
    var goto = modal.querySelector('#uo-m-goto');
    if (goto) goto.addEventListener('click', function(){ emit('open_url', { opportunity_id: id, lead_url: item.lead_url, lead_title: item.lead_title, lead_domain: item.lead_domain }); if (item.lead_url) window.open(item.lead_url, '_blank', 'noopener'); });
    var cta = modal.querySelector('#uo-cta');
    if (cta) cta.addEventListener('click', function(){ emit('create_with_ai', { opportunity_id: id }); });
    var seg = modal.querySelector('.uo-status-seg');
    if (seg) seg.addEventListener('click', function(e){ var b = e.target.closest('button[data-status-key]'); if (!b) return; setStatus(id, b.getAttribute('data-status-key')); });
  }
  var closeTimer = null;
  function closeDetail(){
    S.detailId = null;
    root.classList.remove('detail-in');
    closeTimer = setTimeout(function(){ root.classList.remove('detail-open'); var m = root.querySelector('.uo-modal'); if (m) m.innerHTML = ''; }, 280);
  }

  /* ---------- status change ---------- */
  function setStatus(id, statusKey){
    var item = S.items.find(function(x){ return String(x.id) === String(id); });
    if (!item) return;
    var prev = statusKeyOf(item);
    if (prev === statusKey) return;
    var col = COLUMNS.find(function(c){ return c.key === statusKey; });
    var prevCol = COLUMNS.find(function(c){ return c.key === prev; });
    item.status = col ? col.status : statusKey;
    render();
    if (S.detailId === id) openDetail(id);
    emit('change_status', { opportunity_id: id, status: (col?col.status:statusKey), status_key: statusKey, previous_status: (prevCol?prevCol.status:prev), previous_status_key: prev });
  }

  /* ---------- drag & drop ---------- */
  var dragId = null;
  function wireDnD(){
    root.querySelectorAll('.uo-card').forEach(function(card){
      card.addEventListener('dragstart', function(e){ dragId = card.getAttribute('data-id'); card.classList.add('is-dragging'); try { e.dataTransfer.setData('text/plain', dragId); e.dataTransfer.effectAllowed = 'move'; } catch(_){} });
      card.addEventListener('dragend', function(){ card.classList.remove('is-dragging'); dragId = null; root.querySelectorAll('.uo-col.is-drop-target').forEach(function(c){ c.classList.remove('is-drop-target'); }); });
    });
    root.querySelectorAll('.uo-col').forEach(function(col){
      col.addEventListener('dragover', function(e){ e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch(_){} col.classList.add('is-drop-target'); });
      col.addEventListener('dragleave', function(e){ if (!col.contains(e.relatedTarget)) col.classList.remove('is-drop-target'); });
      col.addEventListener('drop', function(e){ e.preventDefault(); col.classList.remove('is-drop-target'); var id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain')); if (id) setStatus(id, col.getAttribute('data-status-key')); });
    });
  }

  /* ---------- events to Bubble ----------
     Unchanged from the standalone, deliberately: same action keys, same bubble_fn_* names, same
     payload shapes, same CustomEvent fallback. */
  function emit(action, payload){
    var fn = {
      change_status: 'bubble_fn_opportunity_change_status',
      create_with_ai: 'bubble_fn_opportunity_create_with_ai',
      move_all: 'bubble_fn_opportunity_move_all',
      open_url: 'bubble_fn_opportunity_open_url',
      ignore_opportunity: 'bubble_fn_opportunity_ignore',
      competitor_click: 'bubble_fn_opportunity_competitor_click'
    }[action];
    var json = JSON.stringify(payload);
    if (fn && typeof window[fn] === 'function') window[fn](json);
    else { window.dispatchEvent(new CustomEvent('upstreem:opportunity:' + action, { detail: payload })); console.log('Opportunity ' + action + ':', payload); }
  }

  /* ---------- move all cards of a column ---------- */
  function moveAll(fromKey, toKey){
    if (!fromKey || !toKey || fromKey === toKey) return;
    var toCol = COLUMNS.find(function(c){ return c.key === toKey; });
    var fromCol = COLUMNS.find(function(c){ return c.key === fromKey; });
    var moved = [];
    S.items.forEach(function(it){ if (statusKeyOf(it) === fromKey){ it.status = toCol ? toCol.status : toKey; moved.push(it.id); } });
    if (!moved.length) return;
    render();
    if (S.detailId && moved.indexOf(S.detailId) !== -1) openDetail(S.detailId);
    emit('move_all', {
      from_status_key: fromKey,
      from_status: fromCol ? fromCol.status : fromKey,
      to_status_key: toKey,
      to_status: toCol ? toCol.status : toKey,
      status: toCol ? toCol.status : toKey,
      opportunity_ids: moved
    });
  }
  function closeColMenus(){
    root.querySelectorAll('.uo-col-menu.is-shown').forEach(function(m){ m.classList.remove('is-shown'); m.setAttribute('aria-hidden','true'); });
    root.querySelectorAll('.uo-col-kebab.is-active').forEach(function(k){ k.classList.remove('is-active'); });
  }
  document.addEventListener('click', function(e){ if (!e.target.closest('.uo-col-menu-wrap')) closeColMenus(); });

  function copyText(t){
    t = String(t||'');
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t); return; } } catch(_){}
    try { var ta = document.createElement('textarea'); ta.value = t; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } catch(_){}
  }
  function copyDetailText(it){
    var topics = (it.topics || []).map(function(t){ return t.name; }).filter(Boolean).join(', ');
    return (it.headline||'') + '\n' + (it.reason||'') +
      '\n\n' + (it.lead_title||'') + '\n' + (it.lead_url||'') +
      '\n\nTopics: ' + topics;
  }

  /* ---------- card / row click ---------- */
  root.addEventListener('click', function(e){
    var kb = e.target.closest('.uo-col-kebab');
    if (kb){
      e.stopPropagation();
      var wrap = kb.closest('.uo-col-menu-wrap');
      var menu = wrap.querySelector('.uo-col-menu');
      var willOpen = !menu.classList.contains('is-shown');
      closeColMenus();
      closePops();
      menu.classList.toggle('is-shown', willOpen);
      menu.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
      kb.classList.toggle('is-active', willOpen);
      return;
    }
    var opt = e.target.closest('.uo-col-menu .up-pop-opt');
    if (opt){ e.stopPropagation(); moveAll(opt.getAttribute('data-from'), opt.getAttribute('data-to')); closeColMenus(); return; }

    var cp = e.target.closest('.uo-copy');
    if (cp){
      e.stopPropagation();
      var it = S.items.find(function(x){ return String(x.id) === String(S.detailId); });
      if (it){ copyText(copyDetailText(it)); }
      cp.classList.add('is-copied');
      setTimeout(function(){ cp.classList.remove('is-copied'); }, 1200);
      return;
    }

    var sl = e.target.closest('.uo-m-source-link');
    if (sl){
      e.stopPropagation();
      var its = S.items.find(function(x){ return String(x.id) === String(S.detailId); });
      if (its){ emit('open_url', { opportunity_id: S.detailId, lead_url: its.lead_url, lead_title: its.lead_title, lead_domain: its.lead_domain }); }
      return;
    }

    var comp = e.target.closest('.uo-comp');
    if (comp && comp.hasAttribute('data-comp-idx')){
      e.stopPropagation();
      var itc = S.items.find(function(x){ return String(x.id) === String(S.detailId); });
      var c = itc && Array.isArray(itc.mentioned_competitors) ? itc.mentioned_competitors[+comp.getAttribute('data-comp-idx')] : null;
      if (c){ emit('competitor_click', { opportunity_id: S.detailId, competitor_name: c.name, company_id: c.company_id, favicon_url: c.favicon_url }); }
      return;
    }

    var card = e.target.closest('.uo-card, .uo-row');
    if (card && root.querySelector('.uo-stage').contains(card)) { openDetail(card.getAttribute('data-id')); }
  });
  root.querySelector('.uo-scrim').addEventListener('click', closeDetail);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && S.detailId) closeDetail(); });

  /* ---------- toolbar ---------- */
  var modeSeg     = root.querySelector('.uo-mode');
  var settingsBtn = root.querySelector('.uo-settings-btn');
  var settingsPop = root.querySelector('.uo-settings-pop');
  var sortBtn     = root.querySelector('.uo-sort-btn');
  var sortPop     = root.querySelector('.uo-sort-pop');

  /* Core's .up-menu uses an opacity/scale appear animation keyed off .is-shown; the standalone had
     .is-open on a copy of the same menu, plus a hard display:none toggle on the column menus. */
  function setPop(pop, btn, open){
    if (!pop) return;
    pop.classList.toggle('is-shown', open);
    pop.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (btn) btn.classList.toggle('is-active', open);
  }
  function closePops(){ setPop(sortPop, sortBtn, false); setPop(settingsPop, settingsBtn, false); }

  modeSeg.addEventListener('click', function(e){
    var b = e.target.closest('button[data-mode]'); if (!b) return;
    S.mode = b.getAttribute('data-mode');
    this.querySelectorAll('.up-seg-btn').forEach(function(x){ x.classList.toggle('is-active', x === b); });
    render();
  });

  settingsBtn.addEventListener('click', function(e){
    e.stopPropagation();
    var open = !settingsPop.classList.contains('is-shown');
    closeColMenus(); setPop(sortPop, sortBtn, false);
    setPop(settingsPop, settingsBtn, open);
  });
  document.addEventListener('click', function(e){
    if (!settingsPop.contains(e.target) && !settingsBtn.contains(e.target)) setPop(settingsPop, settingsBtn, false);
  });
  settingsPop.addEventListener('click', function(e){
    var row = e.target.closest('[data-board]'); if (!row) return;
    var k = row.getAttribute('data-board');
    S.visible[k] = !S.visible[k];
    row.querySelector('.up-switch').classList.toggle('is-on', S.visible[k]);
    render();
  });

  sortBtn.addEventListener('click', function(e){
    e.stopPropagation();
    var open = !sortPop.classList.contains('is-shown');
    closeColMenus(); setPop(settingsPop, settingsBtn, false);
    setPop(sortPop, sortBtn, open);
  });
  document.addEventListener('click', function(e){
    if (!sortPop.contains(e.target) && !sortBtn.contains(e.target)) setPop(sortPop, sortBtn, false);
  });
  sortPop.addEventListener('click', function(e){
    var opt = e.target.closest('.up-pop-opt[data-sort]');
    if (opt){
      S.sort = opt.getAttribute('data-sort');
      sortPop.querySelectorAll('.up-pop-opt[data-sort]').forEach(function(o){ o.classList.toggle('is-active', o === opt); });
      render(); setPop(sortPop, sortBtn, false); return;
    }
    if (e.target.closest('.uo-toggle-external')){
      S.externalOnly = !S.externalOnly;
      root.querySelector('.uo-switch-external').classList.toggle('is-on', S.externalOnly);
      render();
    }
  });

  /* ---------- search ----------
     Collapsed icon button that slides a 200px field open, exactly like every table's .up-search.
     NOT UC.makeSearch: that kit fires a Bubble event with a requestId because the tables search
     server-side. This board holds its whole dataset in the browser and filters locally, so the
     query stays in S.query and nothing is emitted -- the standalone behaved the same way and the
     event contract must not change. */
  var searchWrap  = root.querySelector('.up-search');
  var searchBtn   = root.querySelector('.up-search-btn');
  var searchInput = root.querySelector('.up-search-input');
  var searchClear = root.querySelector('.up-search-clear');
  function syncSearch(){ searchWrap.classList.toggle('has-text', !!(searchInput && searchInput.value)); }
  searchBtn.addEventListener('click', function(){
    var open = !searchWrap.classList.contains('is-open');
    searchWrap.classList.toggle('is-open', open);
    if (open){ setTimeout(function(){ try { searchInput.focus(); } catch(_){} }, 60); }
    else if (S.query){ searchInput.value = ''; S.query = ''; syncSearch(); render(); }
  });
  searchInput.addEventListener('input', function(){ S.query = this.value; syncSearch(); render(); });
  searchClear.addEventListener('click', function(){
    searchInput.value = ''; S.query = ''; syncSearch(); searchInput.focus(); render();
  });

  /* ---------- resize ---------- */
  var rzTimer = null;
  function onResize(){ clearTimeout(rzTimer); rzTimer = setTimeout(function(){ updateLayout(); if (S.mode === 'board') clampAllCardTags(); }, 90); }
  window.addEventListener('resize', onResize);
  if (typeof ResizeObserver !== 'undefined'){ try { new ResizeObserver(onResize).observe(root); } catch(_){} }

  /* Wheel always scrolls the column under the cursor, even when it started over text or a chip. */
  var stageEl = root.querySelector('.uo-stage');
  stageEl.addEventListener('wheel', function(e){
    var sc = e.target.closest('.uo-col-body');
    if (!sc || sc.scrollHeight <= sc.clientHeight + 1) sc = e.target.closest('.uo-board');
    if (sc && sc.scrollHeight > sc.clientHeight + 1){ sc.scrollTop += e.deltaY; e.preventDefault(); }
  }, { passive: false, capture: true });

  /* Theme attribute mirror: Bubble sets data-isdark, core's CSS keys off data-theme. */
  function syncTheme(){
    if (UC.isYes(root.getAttribute('data-isdark'))) root.setAttribute('data-theme', 'dark');
    else if (root.getAttribute('data-theme') !== 'dark' || root.hasAttribute('data-isdark')) root.removeAttribute('data-theme');
  }
  if (root.hasAttribute('data-isdark')) syncTheme();
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-isdark'] });

  /* ---------- public API ----------
     Names, signatures and semantics are byte-identical to the standalone. */
  function ingest(items){ S.items = (Array.isArray(items) ? items : []).map(function(it, i){ if (it.id == null) it.id = 'opp_' + i; return it; }); }
  window.opportunitiesSetItems = function(items){ if (typeof items === 'string') { var p = looseParse(items); items = Array.isArray(p) ? p : []; } S.loading = false; if (skelTimer){ clearTimeout(skelTimer); skelTimer = null; } ingest(items); if (S.detailId && !S.items.find(function(x){ return String(x.id)===String(S.detailId); })) closeDetail(); render(); };
  window.opportunitiesSetLoading = function(v){ S.loading = !!v; render(); };
  window.opportunitiesSetMode = function(m){ if (m==='board'||m==='list'){ S.mode = m; root.querySelectorAll('.uo-mode .up-seg-btn').forEach(function(x){ x.classList.toggle('is-active', x.getAttribute('data-mode')===m); }); render(); } };
  window.opportunitiesSetShowIgnored = function(v){ S.visible.ignored = !!v; var row = settingsPop.querySelector('[data-board="ignored"] .up-switch'); if (row) row.classList.toggle('is-on', S.visible.ignored); render(); };
  window.opportunitiesSetVisibleBoards = function(obj){ if (obj && typeof obj === 'object'){ ['pending','in_progress','done','ignored'].forEach(function(k){ if (k in obj){ S.visible[k] = !!obj[k]; var sw = settingsPop.querySelector('[data-board="'+k+'"] .up-switch'); if (sw) sw.classList.toggle('is-on', S.visible[k]); } }); render(); } };
  window.opportunitiesSetTheme = function(t){ root.setAttribute('data-theme', String(t).toLowerCase()==='dark' ? 'dark' : 'light'); if (String(t).toLowerCase() !== 'dark') root.removeAttribute('data-theme'); };
  window.opportunitiesOpenDetail = openDetail;
  window.opportunitiesCloseDetail = closeDetail;
  window.opportunitiesGetState = function(){ return { mode: S.mode, visible: S.visible, query: S.query, count: S.items.length }; };

  /* ---------- init ---------- */
  var skelTimer = null;
  var injected = looseParse((root.querySelector('.uo-data-json')||{}).textContent || '');
  if (Array.isArray(injected) && injected.length){
    S.loading = false; ingest(injected);
  } else {
    /* no data yet -> skeletons until opportunitiesSetItems() arrives */
    S.loading = true;
    skelTimer = setTimeout(function(){ if (S.loading){ S.loading = false; render(); } }, 12000);
  }
  render();

  }

  uoBoot(50);
})();
