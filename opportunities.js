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
/* ---- boot stubs (STYLEGUIDE §25) ----------------------------------------------------------
   Every other component in this repo installs these; this one never did, and it is the same
   defect that produced "window.resetPromptsTable is not a function" on a page where the component
   was not present: Bubble fires its workflow before -- or entirely without -- the element, the
   name does not exist yet, and the whole Run-JavaScript step dies with an uncaught TypeError
   instead of quietly doing nothing.

   Two different situations, both covered:
     - element exists, script still loading  -> the call queues and replays on init.
     - element is not on this page at all    -> the call is a no-op with one console note. That is
       the honest outcome: a workflow meant for another view has nothing to talk to here, and it
       must not take the rest of the step down with it.
   Installed before anything else in this file and guarded, so a second copy of the script (Bubble
   re-injecting the markup) cannot reinstall a stub over a queue that already holds calls. */
(function(){
  var Q = (window.__uoBootQueue = window.__uoBootQueue || []);
  if (window.__uoBootStubbed) return;
  window.__uoBootStubbed = true;
  ["opportunitiesSetItems", "opportunitiesSetLoading", "opportunitiesSetMode",
   "opportunitiesSetShowIgnored", "opportunitiesSetVisibleBoards", "opportunitiesSetTheme",
   "opportunitiesOpenDetail", "opportunitiesCloseDetail"].forEach(function(n){
    if (typeof window[n] === "function") return;
    window[n] = function(){ Q.push([n, [].slice.call(arguments)]); };
  });
})();

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

  /* ---------- detail drawer portal ----------
     The drawer is position:fixed so it can span the whole page, but "fixed" is only relative to the
     viewport while NO ancestor has a transform/filter/will-change -- any of those makes that
     ancestor the containing block, and the drawer collapses to the component's own box. A Bubble
     page usually has at least one such wrapper, which is exactly the "drawer only covers the
     component" symptom. Moving scrim + drawer to <body> takes them out of reach of whatever the
     host wraps this element in, for good.
     The host div keeps the .up-root and .uo-root classes so every colour token still resolves, and
     it carries the open/close state classes the CSS already keys off (.uo-root.detail-open ...), so
     those selectors keep matching after the move. __uoInit marks it as already-initialised, or
     uoRun's ".uo-root" sweep would come back and try to boot the portal as a second board. */
  /* data-portal="inline": Vorhang und Schublade bleiben, wo sie sind -- kein Umzug in den <body>
     und nicht in die oberste Ebene des Browsers.
     Wozu: die Hero-Sektion der Landingpage zeigt die App in einem FENSTER. Eine Schublade in der
     obersten Ebene liegt ueber der ganzen Seite und ist von dort aus nicht mehr einzufangen -- das
     Bild "Blick in eine laufende App" waere zerstoert. In der App bleibt der Umzug der Normalfall
     und richtig; hier sagt der Aufrufer ausdruecklich, dass er den Rahmen selbst stellt.
     Es genuegt, den Portal-Kasten in den Root zu haengen statt in den <body>: .uo-portal traegt
     display: contents, erzeugt also keine Box, und die Schublade darin ist position: fixed --
     bezogen auf den naechsten Vorfahren MIT transform, und das ist genau die Buehne des Fensters.
     Die oberste Ebene bleibt aus, denn sie kennt keinen Bezugsrahmen ausser dem Viewport. */
  var inlinePortal = root.getAttribute('data-portal') === 'inline';
  var portal = document.createElement('div');
  portal.className = 'up-root uo-root uo-portal';
  /* Out of the page flow INLINE, not via the stylesheet -- same reasoning as prompt-research.js's
     portal. The classes only keep this harmless while opportunities.css is on the page: that file
     supplies .uo-portal{display:contents} and the position:fixed + display:none on scrim and
     drawer. Without it the element falls back to core.css's .up-root{display:flex;width:100%} and
     the closed drawer becomes a plain static block at the end of <body>, adding real height to the
     page and letting it scroll past the end of the app. Fixed and 0x0 cannot add height under any
     stylesheet; with the CSS present display:contents generates no box and these are ignored. */
  portal.style.position = 'fixed';
  portal.style.top = '0'; portal.style.left = '0';
  portal.style.width = '0'; portal.style.height = '0';
  portal.style.overflow = 'hidden';
  portal.__uoInit = true;
  portal.__uoOwner = root;
  var scrimEl = root.querySelector('.uo-scrim');
  var modalEl = root.querySelector('.uo-modal');
  if (scrimEl) portal.appendChild(scrimEl);
  if (modalEl) portal.appendChild(modalEl);
  /* Bubble replaces this whole element on a page change and inits a fresh root; the old portal
     would otherwise stay behind in <body> forever. Each one remembers its root, so any whose root
     has left the document gets swept here. */
  Array.prototype.forEach.call(document.querySelectorAll('.uo-portal'), function(p){
    if (!p.__uoOwner || !document.body.contains(p.__uoOwner)) { try { p.remove(); } catch(_){} }
  });
  try { (inlinePortal ? root : document.body).appendChild(portal); } catch(_){}

  /* TOP LAYER, nicht z-index. A z-index race against the host is not winnable: this drawer sat at
     9900, and a Bubble wrapper around the component with a higher z-index (they hand those out
     freely) puts the ENTIRE board above it -- reproduced exactly, the drawer opened correctly and
     painted behind .uo-col-head. No number fixes that, because the number is compared inside the
     host's stacking context, not against it.
     The popover API moves the element into the browser's top layer, which is painted after the
     whole document and is unaffected by any ancestor's stacking context or z-index. "manual" so it
     is not light-dismissed: the scrim and Escape already handle closing, and auto-dismiss would
     also close it on every click inside the board behind it.
     Feature-detected: where showPopover does not exist the element stays exactly as it was, still
     body-mounted with its 9900/9895 pair, i.e. the previous behaviour. */
  var canPopover = !inlinePortal &&
    typeof portal.showPopover === "function" && typeof portal.hidePopover === "function";
  if (canPopover) { try { portal.setAttribute("popover", "manual"); } catch(_){ canPopover = false; } }
  function portalShow(){ if (canPopover){ try { portal.showPopover(); } catch(_){} } }
  function portalHide(){ if (canPopover){ try { portal.hidePopover(); } catch(_){} } }

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
  var INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" /></svg>';

  /* ---------- helpers ---------- */
  function esc(v){ var d = document.createElement('div'); d.textContent = String(v == null ? '' : v); return d.innerHTML; }
  function looseParse(s){ if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch(e){ return null; } }
  function fmtDate(iso){ if(!iso) return ''; var d = new Date(iso); if (isNaN(d.getTime())) return String(iso); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  /* UC.themeParam statt isYes: kennt core ein Thema, gewinnt core -- das Attribut ist nur die
     Momentaufnahme aus dem Lauf des Workflows. */
  function isDark(){ return UC.themeParam(root.getAttribute('data-isdark')) || root.getAttribute('data-theme') === 'dark'; }
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
    if (!url) return '<span class="up-logo-box up-fav">'+ltr+'</span>';
    return '<span class="up-logo-box up-fav has-img"><img src="'+esc(url)+'" alt="" referrerpolicy="no-referrer" loading="lazy" ' +
           'onerror="this.remove();this.parentNode.classList.remove(\'has-img\')">'+ltr+'</span>';
  }
  /* Every one of these is worth doing -- the bars rank them, they do not grade them. The old set
     (Minimal / Low / Medium / High) told a user that two thirds of their board was not worth the
     effort, which is the opposite of what a backlog of opportunities is for. Renamed so the low
     end reads as "small, quick" rather than "not important". */
  var POT_LABEL = { 1: 'Quick win', 2: 'Solid', 3: 'Strong', 4: 'Top priority' };
  /* Wie viele Wettbewerber im Detail sichtbar sind, bevor der Rest hinter den Zaehler geht. */
  var COMP_CAP = 3;
  function potBars(lvl){
    var bars = '';
    for (var i=1;i<=4;i++) bars += '<span class="uo-pot-bar p'+i+(i<=lvl?' is-on':'')+'"></span>';
    return bars;
  }
  function potHtml(item){
    var lvl = potLevel(item);
    // data-pot rides along so the explainer can preview THIS card's level instead of a fixed sample
    return '<div class="uo-pot" data-explain="potential" data-pot="'+lvl+'"><div class="uo-pot-bars">'+potBars(lvl)+'</div></div>';
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
  function explainVisual(kind, trigger){
    if (kind === 'potential'){
      /* mirrors the bars you're actually hovering -- a fixed "Medium" sample next to a four-bar
         card read as a contradiction, not an example */
      var lvl = trigger ? (parseInt(trigger.getAttribute('data-pot'), 10) || 3) : 3;
      if (lvl < 1) lvl = 1; if (lvl > 4) lvl = 4;
      return '<span class="up-explain-row"><span class="uo-pot-bars">'+potBars(lvl)+'</span>'+POT_LABEL[lvl]+'</span>';
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
    html: function(kind, trigger){
      var info = explainInfo(kind);
      if (!info) return '';
      return '<div class="up-explain-vis">' + explainVisual(kind, trigger) + '</div>' +
             '<div class="up-explain-h">' + esc(info.h) + '</div>' +
             '<div class="up-explain-t">' + esc(info.t) + '</div>';
    }
  }) : null;

  /* Small dark tooltip chips on every icon button, wired the app-wide way: makeTooltips installs a
     delegated [data-tip] handler on the root, so markup only carries the attribute. */
  /* ZWEIMAL, und das ist der Punkt: makeTooltips haengt EINEN delegierten Listener an den Knoten,
     den es bekommt. Scrim und Detail-Karte sind aber weiter oben nach .uo-portal am <body>
     umgezogen -- sie sind keine Nachfahren von root mehr, und der Listener sah sie nie. Ergebnis:
     die Knoepfe oben rechts in der Detailansicht (Ignore, Open URL, Close) trugen ihr data-tip,
     zeigten aber nichts an, waehrend dieselben Chips auf dem Board funktionierten. */
  if (UC.makeTooltips){ UC.makeTooltips(root, isDark); UC.makeTooltips(portal, isDark); }

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
      '<div class="uo-card-foot"><span class="uo-date"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>'+esc(fmtDate(item.created_at))+'</span></div>'+
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
          /* UC.icon("moreHorizontal") -- die eine Form, die im ganzen Haus fuer ein Punktemenue
             steht (Lucide "ellipsis"). Hier standen vorher SENKRECHTE Punkte, und dazu gefuellt mit
             r=1 statt gestrichelt: also an derselben Rolle ein anderes Bild UND eine andere Groesse
             als in prompts-table, quick-actions, ask-mira, prompt-research und der Sidebar. */
          UC.icon("moreHorizontal", 2) + '</button>'+
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
    /* The toolbar can change height between renders (the count going 1 -> 3 digits, the search
       opening, a wrap at a narrow width), and the pinned lane headers offset by that height. */
    if (stickyKit) stickyKit.syncTheadOffset();
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

    /* Gedeckelt auf drei. Die Liste ist ein vertikaler Stack mit rund 44px pro Zeile -- bei
       zwoelf erwaehnten Wettbewerbern schiebt sie alles unter sich aus der Karte heraus, und
       genau das ist der Grund, warum die aufgeklappte Karte abgeschnitten aussah. Drei Zeilen
       plus Zaehler ist auch die Form, die alle anderen Marken-Stapel in der App haben (siehe
       UC.brandStack).

       Versteckt wird per Klasse, NICHT per slice: data-comp-idx muss weiter der Position in
       item.mentioned_competitors entsprechen, sonst feuert der Klick auf den falschen Namen.
       Der Zaehler addiert zwei Dinge, die der Nutzer nicht auseinanderhalten muss -- was hier
       nur eingeklappt ist, und was der Server gar nicht erst mitgeschickt hat. Nur wenn etwas
       eingeklappt ist, laesst sich der Zaehler auch aufklappen. */
    var localMore = Math.max(0, comps.length - COMP_CAP);
    var moreTotal = localMore + Math.max(0, compMore);
    var moreChip = !moreTotal ? ''
      : localMore
        ? '<button type="button" class="uo-comp-more" data-comp-expand data-comp-rest="'+Math.max(0, compMore)+'">+'+moreTotal+' more</button>'
        : '<span class="uo-comp-more">+'+moreTotal+' more</span>';

    var compList = comps.length ? '<div class="uo-m-section-title">Mentioned competitors</div><div class="uo-comp-list'+(localMore ? ' is-capped' : '')+'">'+
      comps.map(function(c, i){ return '<div class="uo-comp" data-comp-idx="'+i+'" role="button" tabindex="0">'+favHtml(c.favicon_url, c.name)+'<span class="uo-comp-name">'+esc(c.name)+'</span></div>'; }).join('')+
      moreChip+
      '</div>' : '';

    var statusKey = statusKeyOf(item);
    /* is-lg ist die 32px-Stufe von .up-seg in core: Hoehe 32, Flaeche --vc-switch-bg, Knoepfe
       32px hoch. Genau die Werte, die jeder andere 32px-Umschalter der App traegt -- vorher stand
       hier die kleine Stufe (26px, --vc-switch-soft) und fiel daneben auf. Eine Klasse statt
       eigener Werte: der Umschalter bleibt EIN Bauteil. */
    var statusSeg = '<div class="up-seg is-lg uo-status-seg" data-id="'+esc(item.id)+'">'+
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
          '<button class="uo-m-act up-iconbtn" id="uo-m-goto" type="button" data-tip="Open URL" aria-label="Open URL"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg></button>'+
          '<button class="uo-m-act up-iconbtn" id="uo-m-close" type="button" data-tip="Close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg></button>'+
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
              '<svg class="uo-copy-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>'+
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
    var modal = modalEl;
    modal.innerHTML = detailHtml(item);
    if (closeTimer){ clearTimeout(closeTimer); closeTimer = null; }
    portal.setAttribute('data-theme', isDark() ? 'dark' : 'light');   // the portal is outside the root's theme attribute
    portalShow();
    portal.classList.add('detail-open');
    void modal.offsetWidth;
    requestAnimationFrame(function(){ portal.classList.add('detail-in'); });
    lockPageScroll(true);
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
    portal.classList.remove('detail-in');
    lockPageScroll(false);
    // 200ms = the 180ms slide-out plus a small buffer, same number the host app's drawer uses
    closeTimer = setTimeout(function(){ portal.classList.remove('detail-open'); portalHide(); if (modalEl) modalEl.innerHTML = ''; }, 200);
  }
  /* Scroll-lock, matching the host app's drawer system: while a drawer is open #main stops
     scrolling, and its position is restored on close so the page does not jump. Everything here is
     optional -- no #main (standalone page, a different host) simply means no lock. The class is
     only lifted when NONE of the app's own drawers is open either, so closing this one cannot
     unlock the page underneath one of theirs. */
  var mainScrollTop = 0;
  /* THE page could not be scrolled any more -- and this is why. The lock was applied to #main as a
     bare class with no record of WHO applied it, and the release refused to run whenever any
     [id^="drawer-"].open existed. Two ways that ends with a permanently dead page:
       - a host drawer that is .open (or stale-.open) at release time: our lock stays forever;
       - Bubble discards and rebuilds this element while the drawer is open: closeDetail never
         runs, the new instance knows nothing about the old lock, and #main keeps it for the
         rest of the session.
     Now the lock is stamped with data-uo-locked, so we only ever release our OWN, and boot()
     below clears a leftover before anything else happens. */
  function lockPageScroll(on){
    var main = document.getElementById('main');
    if (!main) return;
    var ours = main.getAttribute('data-uo-locked') != null;
    if (on){
      if (ours) return;
      mainScrollTop = main.scrollTop;
      main.setAttribute('data-uo-locked', String(mainScrollTop));
      main.classList.add('drawer-locked');
    } else if (ours){
      var top = Number(main.getAttribute('data-uo-locked')) || mainScrollTop || 0;
      main.removeAttribute('data-uo-locked');
      /* A host drawer of its own is up: leave the CLASS in place, it is theirs to lift now -- but
         drop our claim either way, or nothing will ever release it again. */
      if (!document.querySelector('[id^="drawer-"].open')){
        main.classList.remove('drawer-locked');
        main.scrollTop = top;
      }
    }
  }
  /* A lock left behind by a previous instance of this component (Bubble rebuilt the element while
     the drawer was open) would otherwise make the page permanently unscrollable. No detail can be
     open at this point -- this runs while the controller is still being built -- so any stamp we
     find here is stale by definition. */
  (function releaseStaleLock(){
    var main = document.getElementById('main');
    if (!main || main.getAttribute('data-uo-locked') == null) return;
    main.removeAttribute('data-uo-locked');
    if (!document.querySelector('[id^="drawer-"].open')) main.classList.remove('drawer-locked');
  })();

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
  /* What lands on the clipboard is meant to be pasted into a brief, a ticket or a chat -- so it is
     laid out with headings and blank lines, not run together. Sections with nothing in them are
     dropped entirely rather than left as an empty heading. */
  function copyDetailText(it){
    var lines = [];
    function section(title, body){
      if (!body) return;
      if (lines.length) lines.push('');
      lines.push(title); lines.push(body);
    }
    if (it.headline) lines.push(it.headline);
    if (it.label) lines.push('(' + it.label + (it.priority_label ? ' — ' + POT_LABEL[potLevel(it)] : '') + ')');

    section('Why this matters', it.reason || '');

    var topics = (it.topics || []).map(function(t){ return t && (t.name || t); }).filter(Boolean);
    section('Topics', topics.length ? topics.join(', ') : '');

    var src = [];
    if (it.lead_title) src.push(it.lead_title);
    if (it.lead_domain) src.push(it.lead_domain);
    if (it.lead_url) src.push(it.lead_url);
    section('Source', src.join('\n'));

    var comps = (it.competitors || []).map(function(c){ return c && (c.name || c); }).filter(Boolean);
    section('Mentioned competitors', comps.length ? comps.join(', ') : '');

    var meta = [];
    if (it.status) meta.push('Status: ' + it.status);
    if (it.effective_citation_type) meta.push('Citation type: ' + citePretty(it.effective_citation_type));
    if (it.created_at) meta.push('Created: ' + fmtDate(it.created_at));
    section('Details', meta.join('\n'));

    return lines.join('\n');
  }

  /* ---------- card / row click ----------
     Bound to the PORTAL as well as the root. The drawer's markup was moved into a body-level
     portal so it can escape the host's stacking contexts -- which also took it out of reach of a
     handler delegated on the root. Everything openDetail wires by hand (close, ignore, goto, the
     status segments) kept working; everything that relied on this delegation did not, and that is
     why the Copy button did nothing at all. Same function on both, so the two can never drift. */
  function onRootClick(e){
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
      /* Same data-tip tooltip every other control in this app uses -- swapped to a confirmation
         and put back afterwards, so the feedback is not only the icon flip. UC.makeTooltips reads
         the attribute live, so nothing else has to be told about the change. */
      var tipWas = cp.getAttribute('data-tip');
      cp.setAttribute('data-tip', 'Copied');
      /* Re-trigger the tip so the new text shows immediately: the pointer is already resting on
         the button, so without a fresh enter event the tooltip would keep saying "Copy" until the
         user moves away and back. */
      try { cp.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); } catch(_){}
      setTimeout(function(){
        cp.classList.remove('is-copied');
        if (tipWas != null) cp.setAttribute('data-tip', tipWas);
      }, 1200);
      return;
    }

    var sl = e.target.closest('.uo-m-source-link');
    if (sl){
      e.stopPropagation();
      var its = S.items.find(function(x){ return String(x.id) === String(S.detailId); });
      if (its){ emit('open_url', { opportunity_id: S.detailId, lead_url: its.lead_url, lead_title: its.lead_title, lead_domain: its.lead_domain }); }
      return;
    }

    /* Vor der Wettbewerber-Zeile pruefen: der Zaehler liegt in derselben Liste, und ein Klick
       darauf soll aufklappen statt ein competitor_click auf den falschen Namen zu feuern. */
    var compEx = e.target.closest('[data-comp-expand]');
    if (compEx){
      e.stopPropagation();
      var lst = compEx.closest('.uo-comp-list');
      if (lst) lst.classList.remove('is-capped');
      /* Aufklappen zeigt nur, was auch da ist. Hat der Server zusaetzlich gekuerzt, bleibt
         dessen Rest stehen -- jetzt als reiner Text, weil daran nichts mehr zu klicken ist.
         Den Zaehler hier ersatzlos zu entfernen wuerde behaupten, die Liste sei vollstaendig. */
      var rest = Number(compEx.getAttribute('data-comp-rest')) || 0;
      if (!rest){ compEx.remove(); return; }
      var still = document.createElement('span');
      still.className = 'uo-comp-more';
      still.textContent = '+' + rest + ' more';
      compEx.parentNode.replaceChild(still, compEx);
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
  }
  root.addEventListener('click', onRootClick);
  portal.addEventListener('click', onRootClick);
  if (scrimEl) scrimEl.addEventListener('click', closeDetail);
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

  /* ---------- sticky header ----------
     Same UC.makeSticky every table uses: it pins the toolbar at data-sticky-top and keeps
     --up-thead-off in sync with the toolbar's measured height, which is what opportunities.css
     offsets the pinned lane headers by. The board used to be a self-contained scroll box (the
     element kept its own height and each lane scrolled inside it, driven by the wheel handler
     that used to live here); it scrolls with the page now, so both of those are gone and the
     kanban behaves like every other screen. */
  /* Without data-sticky-top, makeSticky leaves --up-sticky-top at core's 171px default -- the value
     a full app page with its own topbar needs, not this board's. Defaulting the attribute here
     means an older pasted markup block still pins at the right offset off the CDN pin alone; an
     explicit data-sticky-top in the markup still wins. */
  if (!root.getAttribute('data-sticky-top')) root.setAttribute('data-sticky-top', '16');
  var stickyKit = UC.makeSticky ? UC.makeSticky(root, root.querySelector('.uo-head')) : null;
  function applySticky(){ if (stickyKit) stickyKit.applySticky(); }
  applySticky();

  /* applySticky() decides on/off from a ONE-OFF viewport measurement, and the only things that
     re-run it are a window resize and the ResizeObserver below. Both miss the case that actually
     bites in Bubble: the board initialises while its group is still hidden or mid-responsive-pass,
     so it measures a 0/narrow viewport, turns sticky off, and nothing ever asks again -- confirmed
     locally, a root that goes 0px -> 1500px wide does not reliably deliver either signal, and the
     headers stay unpinned for the life of the page. So re-check whenever the decision could be
     stale: a few beats after boot, and on scroll (the only moment sticky is observable at all).
     The guard repeats core's own condition on purpose -- applySticky() walks the ancestor chain to
     unclip it, which is not something to run on every scroll frame for nothing. */
  function stickyWanted(){
    var pageW = window.innerWidth || document.documentElement.clientWidth || 0;
    return root.getAttribute('data-sticky') !== 'no' && pageW >= 1000;
  }
  function resyncSticky(){ if (stickyWanted() !== root.classList.contains('up-sticky')) applySticky(); }
  [120, 400, 1000, 2500].forEach(function(ms){ setTimeout(resyncSticky, ms); });
  /* On document in the CAPTURE phase, not on window: the host page scrolls an inner element
     (#main), and an element's scroll event does not bubble -- a window listener would never hear
     it. Capture on document sees every scroll in the page, whichever box does the scrolling. */
  document.addEventListener('scroll', resyncSticky, { capture: true, passive: true });

  /* ---------- resize ---------- */
  var rzTimer = null;
  function onResize(){
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function(){
      applySticky(); updateLayout();
      if (S.mode === 'board') clampAllCardTags();
    }, 90);
  }
  /* Beides gedrosselt: onResize misst Karten und schreibt Klassen. */
  (function(){
    var kern = window.UpstreemCore;
    if (kern && kern.aufResize) kern.aufResize(onResize, { hoehe: true });
    else window.addEventListener('resize', onResize);
    if (kern && kern.beobachteGroesse) return kern.beobachteGroesse(root, onResize, { hoehe: true });
    if (typeof ResizeObserver !== 'undefined'){ try { new ResizeObserver(onResize).observe(root); } catch(_){} }
  })();

  /* Theme attribute mirror: Bubble sets data-isdark, core's CSS keys off data-theme. */
  function syncTheme(){
    if (UC.isYes(root.getAttribute('data-isdark'))) root.setAttribute('data-theme', 'dark');
    else if (root.getAttribute('data-theme') !== 'dark' || root.hasAttribute('data-isdark')) root.removeAttribute('data-theme');
    portal.setAttribute('data-theme', isDark() ? 'dark' : 'light');   // the drawer lives outside the root now
  }
  if (root.hasAttribute('data-isdark')) syncTheme();
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-isdark'] });

  /* ---------- public API ----------
     Names, signatures and semantics are byte-identical to the standalone. */
  function ingest(items){ S.items = (Array.isArray(items) ? items : []).map(function(it, i){ if (it.id == null) it.id = 'opp_' + i; return it; }); }
  window.opportunitiesSetItems = function(items){ if (typeof items === 'string') { var p = looseParse(items); items = Array.isArray(p) ? p : []; } S.loading = false; if (skelTimer){ clearTimeout(skelTimer); skelTimer = null; } ingest(items); if (S.detailId && !S.items.find(function(x){ return String(x.id)===String(S.detailId); })) closeDetail(); render(); };
  /* !!v war hier falsch, und zwar genau andersherum als gedacht: Bubble uebergibt "yes"/"no" als
     TEXT, und !!"no" ist true -- der Aufruf mit "no" schaltete das Skelett AN statt aus. Kein
     Fehler in der Konsole, das Board blieb einfach im Ladezustand haengen.

     Nicht ueber UC: das var UC dieser Datei lebt in der Boot-Funktion und ist hier nicht im Scope.
     window.UpstreemCore wird benutzt, wenn es da ist, sonst entscheidet die lokale Liste -- diese
     Setter koennen laufen, bevor core geladen ist. */
  function isYesVal(v){
    if (window.UpstreemCore && window.UpstreemCore.isYes) return window.UpstreemCore.isYes(v);
    if (typeof v === "boolean") return v;
    var t = String(v == null ? "" : v).trim().toLowerCase();
    return t === "yes" || t === "true" || t === "1";
  }
  window.opportunitiesSetLoading = function(v){ S.loading = isYesVal(v); render(); };
  window.opportunitiesSetMode = function(m){ if (m==='board'||m==='list'){ S.mode = m; root.querySelectorAll('.uo-mode .up-seg-btn').forEach(function(x){ x.classList.toggle('is-active', x.getAttribute('data-mode')===m); }); render(); } };
  window.opportunitiesSetShowIgnored = function(v){ S.visible.ignored = isYesVal(v);   /* gleicher Defekt wie oben */ var row = settingsPop.querySelector('[data-board="ignored"] .up-switch'); if (row) row.classList.toggle('is-on', S.visible.ignored); render(); };
  window.opportunitiesSetVisibleBoards = function(obj){ if (obj && typeof obj === 'object'){ ['pending','in_progress','done','ignored'].forEach(function(k){ if (k in obj){ S.visible[k] = !!obj[k]; var sw = settingsPop.querySelector('[data-board="'+k+'"] .up-switch'); if (sw) sw.classList.toggle('is-on', S.visible[k]); } }); render(); } };
  window.opportunitiesSetTheme = function(t){ root.setAttribute('data-theme', String(t).toLowerCase()==='dark' ? 'dark' : 'light'); if (String(t).toLowerCase() !== 'dark') root.removeAttribute('data-theme'); portal.setAttribute('data-theme', isDark() ? 'dark' : 'light'); };
  /* Eine Karte von aussen verschieben -- derselbe Weg, den das Ziehen und der Umschalter in der
     Schublade nehmen, samt Ereignis nach Bubble. Gebraucht von der Hero-Sektion der Landingpage,
     die den Zug vorfuehrt; in der App kann damit ein Workflow eine Karte umlegen, ohne die ganze
     Liste neu zu schicken -- wovor die Vorlage ausdruecklich warnt, weil das Brett sonst sichtbar
     unter dem Nutzer neu zeichnet.
     statusKey ist einer von pending | in_progress | done | ignored. */
  window.opportunitiesSetStatus = function(id, statusKey){ setStatus(String(id), String(statusKey)); };
  window.opportunitiesOpenDetail = openDetail;
  window.opportunitiesCloseDetail = closeDetail;
  window.opportunitiesGetState = function(){ return { mode: S.mode, visible: S.visible, query: S.query, count: S.items.length }; };

  /* Replay whatever Bubble called while this file was still loading, in the order it arrived.
     Cleared first so a second init cannot replay the same calls twice. */
  (function drainBootQueue(){
    var Q = window.__uoBootQueue;
    if (!Q || !Q.length) return;
    var pending = Q.splice(0, Q.length);
    pending.forEach(function(c){
      var fn = window[c[0]];
      if (typeof fn === "function"){ try { fn.apply(null, c[1]); } catch(e){
        if (window.console) console.warn("[opportunities] queued " + c[0] + " failed:", e);
      } }
    });
  })();
  /* Diagnostic for "the headers don't pin on my page". position:sticky only reaches the viewport
     if nothing between this root and <html> scrolls, clips or establishes a containing block --
     the usual culprits in a host page are overflow:hidden, transform, filter and will-change on a
     wrapper. Reports the whole chain plus the two decisions applySticky() makes, so the answer is
     one paste instead of another round of guessing. */
  window.opportunitiesDiagnoseSticky = function(){
    var out = { pageWidth: window.innerWidth, stickyOn: root.classList.contains('up-sticky'),
                dataSticky: root.getAttribute('data-sticky'), stickyTop: root.getAttribute('data-sticky-top'),
                blockers: [] };
    var el = root.parentElement, guard = 0;
    while (el && guard++ < 40){
      var cs; try { cs = getComputedStyle(el); } catch(_){ break; }
      var why = [];
      if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible')
        why.push('overflow:' + cs.overflow + '/' + cs.overflowX + '/' + cs.overflowY);
      if (cs.transform && cs.transform !== 'none') why.push('transform');
      if (cs.filter && cs.filter !== 'none') why.push('filter');
      if (cs.willChange && cs.willChange !== 'auto') why.push('will-change:' + cs.willChange);
      if (cs.contain && cs.contain !== 'none') why.push('contain:' + cs.contain);
      if (why.length) out.blockers.push({
        tag: el.tagName.toLowerCase(), id: el.id || '', cls: String(el.className || '').slice(0, 90),
        why: why.join(', '), scrolls: el.scrollHeight > el.clientHeight + 1
      });
      if (el === document.documentElement) break;
      el = el.parentElement || (el === document.body ? document.documentElement : null);
    }
    return out;
  };

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
