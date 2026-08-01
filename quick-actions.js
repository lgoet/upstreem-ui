/* upstreem — Quick Actions (Cmd-K command menu).
   Split out of the original standalone quick_actions.html verbatim — logic below is unchanged
   from the standalone version, including the JS event names, the window.MiraQuickActions API,
   and every bubble_fn_* it calls. See bubble/quick_actions_bubble.html for the migration notes
   and the full attribute/event documentation. */
(function(){
  var root = document.getElementById('mira-quick-actions');
  if (!root || root.__mqaInit) return; root.__mqaInit = true;

  var trigger  = root.querySelector('.mqa-trigger');
  var overlay  = root.querySelector('.mqa-overlay');
  var modal    = overlay.querySelector('.mqa-modal');
  var input    = overlay.querySelector('.mqa-input');
  var scroll   = overlay.querySelector('.mqa-scroll');
  var resultsEl= overlay.querySelector('.mqa-results');
  var actionsWrap = overlay.querySelector('.mqa-actions-wrap');

  // move the overlay to <body> so it can never be clipped by a sidebar/containing block
  try { document.body.appendChild(overlay); } catch(_){}

  var DEBOUNCE = 400, MIN = 2;

  var TYPE_ORDER    = { brand:0, domain:1, url:2, prompt:3 };
  var TYPE_LABEL    = { brand:"Brands", domain:"Domains", url:"URLs", prompt:"Prompts" };
  var TYPE_SINGULAR = { brand:"Brand",  domain:"Domain",  url:"URL",  prompt:"Prompt" };

  var GLOBE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  var STATIC = [
    { action:"add_new_prompt",  label:"Add New Prompt",  hint:"", icon:'<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
    { action:"add_new_brand",   label:"Add New Brand",   hint:"", icon:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' },
    { action:"export_data",     label:"Export Your Data",hint:"", icon:'<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' },
    { action:"edit_your_brand", label:"Edit Your Brand", hint:"", icon:'<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' }
  ];

  var isOpen = false, query = "", latestReqId = null, state = "idle", debTimer = 0, _lastCompleted = null;
  var rows = [], activeIndex = -1, _rowData = [];

  /* ---------- "/" filter commands ----------
     Slots hold at most one value each, so "/urls /type you" reads: scope=url + type=You.
     scope/market/type narrow the search; rank turns the list into a leaderboard (no query needed). */
  var FILTERS = { scope: null, rank: null, type: null, urltype: null, market: null, mentioning: null };
  var CITATION_TYPES = ["You","Competition","Brand_Platform","Editorial","Institutional","Knowledge_Base","UGC_Community"];
  // url types + their own colour system, mirrored from the URL-classification component
  var URL_TYPES = ["homepage","product_service","marketplace","company_info","article","listicle","guide",
                   "comparison","review","documentation","forum","directory","video","social_post","other"];
  var URL_TYPE_LABEL = { homepage:"Homepage", product_service:"Product / Service", marketplace:"Marketplace",
    company_info:"Company Info", article:"Article", listicle:"Listicle", guide:"Guide", comparison:"Comparison",
    review:"Review", documentation:"Documentation", forum:"Forum", directory:"Directory", video:"Video",
    social_post:"Social Post", other:"Uncategorized" };
  var URL_TYPE_COLOR = { homepage:"#b45309", product_service:"#c2683b", marketplace:"#9a5b2e", company_info:"#a16207",
    article:"#047857", listicle:"#0e7490", guide:"#2563eb", comparison:"#4f46e5", review:"#6d28d9",
    documentation:"#6d28d9", forum:"#9333ea", directory:"#a21caf", video:"#7c3aed", social_post:"#8b5cf6", other:"#6f737c" };
  function urlTypeLabel(t){ return URL_TYPE_LABEL[t] || String(t||"").replace(/_/g," "); }
  function urlTypeColor(t){ return URL_TYPE_COLOR[t] || "#6f737c"; }
  // colours mirrored from the opportunities component so a type looks the same everywhere
  var CITE_COLOR = { Editorial:"#14b8a6", UGC_Community:"#0ea5e9", Knowledge_Base:"#6366f1", Brand_Platform:"#d946ef", Institutional:"#64748b", Competition:"#f97316", You:"#f43f5e" };
  function citeColor(c){ return CITE_COLOR[c] || "#6f737c"; }
  function citeDot(c){ return '<span class="mqa-ct-dot" style="background:' + citeColor(c) + '"></span>'; }
  function colorDot(color){ return '<span class="mqa-ct-dot" style="background:' + color + '"></span>'; }
  var MARKETS = ["de","us","gb","at","ch","fr","es","it","nl"];   // override via MiraQuickActions.setMarkets([...])
  var BRANDS  = [];                                               // fed in on page load via MiraQuickActions.setBrands([...])
  var ALL_SCOPES = ["url","domain","brand","prompt"];
  var COMMANDS = [
    // step 1 — pick what we're talking about
    { id:"urls",       slot:"scope",      value:"url",      label:"URLs",       hint:"Only URLs" },
    { id:"brands",     slot:"scope",      value:"brand",    label:"Brands",     hint:"Only brands" },
    { id:"domains",    slot:"scope",      value:"domain",   label:"Domains",    hint:"Only domains" },
    { id:"prompts",    slot:"scope",      value:"prompt",   label:"Prompts",    hint:"Only prompts" },
    // step 2 — dimensions, only offered where the data model actually has them
    { id:"citation-type", slot:"type",    label:"Citation type", hint:"Filter by citation type", sub:"types",    scopes:["url","domain"] },
    { id:"url-type",       slot:"urltype", label:"URL type",      hint:"Filter by URL type",      sub:"urltypes", scopes:["url"] },
    { id:"market",     slot:"market",     label:"Market",     hint:"Filter by market",        sub:"markets", scopes:ALL_SCOPES },
    { id:"mentioning", slot:"mentioning", label:"Mentioning", hint:"Mentions a brand",        sub:"brands",  scopes:["url","domain","prompt"] },
    { id:"top",        slot:"rank",       value:"top",      label:"Top",        hint:"Best performing first", scopes:ALL_SCOPES },
    { id:"trending",   slot:"rank",       value:"trending", label:"Trending",   hint:"Biggest risers first",  scopes:ALL_SCOPES }
  ];
  var CMD_BY_ID = {}; COMMANDS.forEach(function(c){ CMD_BY_ID[c.id] = c; });
  var SLOT_LABEL = { scope:"", rank:"", type:"Citation", urltype:"URL", market:"Market", mentioning:"Mentioning" };
  function subOptions(kind){
    if (kind === "types")    return CITATION_TYPES.map(function(t){ return { label: t.replace(/_/g," "), value: t, dot: citeColor(t) }; });
    if (kind === "urltypes") return URL_TYPES.map(function(t){ return { label: urlTypeLabel(t), value: t, dot: urlTypeColor(t) }; });
    if (kind === "markets") return MARKETS.map(function(m){
      return { label: String(m).toUpperCase(), value: m, av: "https://flagcdn.com/" + String(m).toLowerCase() + ".svg", round: true };
    });
    if (kind === "brands")  return BRANDS.map(function(b){
      return { label: b.name, value: (b.id != null && b.id !== "") ? b.id : b.name, av: b.logo || b.favicon || "", round: true };
    });
    return [];
  }
  function chipLabel(slot){
    var v = FILTERS[slot]; if (!v) return "";
    if (slot === "scope"){ var c = COMMANDS.filter(function(x){ return x.slot==="scope" && x.value===v; })[0]; return c ? c.label : v; }
    if (slot === "rank"){ var r = COMMANDS.filter(function(x){ return x.slot==="rank" && x.value===v; })[0]; return r ? r.label : v; }
    if (slot === "market") return String(v).toUpperCase();
    if (slot === "urltype") return urlTypeLabel(v);
    if (slot === "mentioning"){ var b = BRANDS.filter(function(x){ return String(x.id) === String(v) || x.name === v; })[0]; return b ? b.name : String(v); }
    return String(v).replace(/_/g," ");
  }
  function anyFilter(){ return !!(FILTERS.scope || FILTERS.rank || FILTERS.type || FILTERS.urltype || FILTERS.market || FILTERS.mentioning); }

  function esc(s){ var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }
  function escAttr(s){ return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  // highlight what matched — compare folded (so "Muller" still marks "Müller"), but mark the ORIGINAL
  // characters so nothing on screen changes except the emphasis
  function hl(text){
    var raw = String(text == null ? "" : text);
    var q = String(query || "").trim();
    if (!q) return esc(raw);
    var fRaw = foldDiacritics(raw), out = "", used = false;
    // every query word, longest first, so "kli an" marks both
    var words = q.split(/\s+/).map(foldDiacritics).filter(function(w){ return w.length > 1; }).sort(function(a,b){ return b.length - a.length; });
    if (!words.length) return esc(raw);
    var marks = new Array(raw.length).fill(false);
    words.forEach(function(w){
      var from = 0, i;
      while ((i = fRaw.indexOf(w, from)) !== -1){
        for (var k = i; k < i + w.length && k < marks.length; k++) marks[k] = true;
        used = true; from = i + w.length;
      }
    });
    if (!used) return esc(raw);
    var open = false;
    for (var i2 = 0; i2 < raw.length; i2++){
      if (marks[i2] && !open){ out += '<mark class="mqa-hl">'; open = true; }
      if (!marks[i2] && open){ out += '</mark>'; open = false; }
      out += esc(raw[i2]);
    }
    if (open) out += '</mark>';
    return out;
  }
  function newReqId(){ return "qa_" + Date.now() + "_" + Math.random().toString(36).slice(2,8); }
  function fire(name, detail){   // used for the search trigger only
    if (typeof window.bubble_fn_quick_actions_search === "function"){ try { window.bubble_fn_quick_actions_search(JSON.stringify(detail)); } catch(_){} }
    try { window.dispatchEvent(new CustomEvent(name, { detail: detail })); } catch(_){}
  }
  // one distinct event per static action (no value)
  function fireStatic(action){
    var base = { add_new_prompt:"qa_add_prompt", add_new_brand:"qa_add_brand", export_data:"qa_export_data", edit_your_brand:"qa_edit_brand" }[action];
    if (!base) return;
    var fn = "bubble_fn_" + base;
    if (typeof window[fn] === "function"){ try { window[fn](); } catch(_){} }
    try { window.dispatchEvent(new CustomEvent("mira_" + base)); } catch(_){}
  }
  // one distinct event per result category, carrying a single value (id / domain / url)
  function fireSelect(cat, value){
    value = String(value == null ? "" : value);
    var fn = "bubble_fn_qa_select_" + cat;
    if (typeof window[fn] === "function"){ try { window[fn](value); } catch(_){} }
    try { window.dispatchEvent(new CustomEvent("mira_qa_select_" + cat, { detail: { value: value } })); } catch(_){}
  }

  /* ---------- render helpers ---------- */
  function avHtml(src, fbInner){
    if (!src) return '<span class="mqa-av is-fb">' + fbInner + '</span>';
    return '<span class="mqa-av"><img src="' + escAttr(src) + '" alt="" loading="lazy" ' +
      'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-fb\');">' +
      '<span class="mqa-av-fb">' + fbInner + '</span></span>';
  }
  function letter(name){ var s = String(name || "").trim(); return s ? '<span class="mqa-av-t">' + esc(s.charAt(0).toUpperCase()) + '</span>' : GLOBE; }

  // what the number actually means depends on the type:
  //   url/domain -> share of citations, brand -> share of voice, prompt -> your own visibility
  var METRIC_LABEL = { url: "Share", domain: "Share", brand: "Share", prompt: "Visibility" };
  var ARR_UP   = '<svg viewBox="0 0 24 24"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>';
  var ARR_DOWN = '<svg viewBox="0 0 24 24"><line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/></svg>';
  var DASH     = '<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  function trendHtml(v){
    if (v == null || v === "" || isNaN(Number(v))) return '<span class="mqa-trend is-flat">' + DASH + '</span>';   // no trend
    var n = Number(v), a = Math.abs(n);
    if (a === 0) return '<span class="mqa-trend is-flat">' + DASH + '</span>';         // no change
    var txt = (a < 0.5) ? "<1%" : (Math.round(a) + "%");                               // <0.5 would round to 0% -> show "<1%"; 0.5-0.99 rounds to 1%
    return '<span class="mqa-trend ' + (n > 0 ? "is-up" : "is-down") + '">' +
             (n > 0 ? ARR_UP : ARR_DOWN) + '<span class="mqa-trend-n">' + txt + '</span>' +
           '</span>';
  }
  function metricHtml(item){
    // Bubble can send a ready-made string (item.metric), otherwise we format the numbers we know.
    var txt = "", cls = "", lbl = "";
    if (item.metric != null && item.metric !== ""){ txt = String(item.metric); }
    else if (FILTERS.rank === "top" && item.share_pct != null){ txt = Math.round(item.share_pct) + "%"; lbl = METRIC_LABEL[item.type] || "Share"; }
    else if (FILTERS.rank === "trending"){ return trendHtml(item.trend_pct); }
    if (!txt) return "";
    return '<span class="mqa-metric' + cls + '">' + (lbl ? '<span class="mqa-metric-lbl">' + esc(lbl) + '</span>' : "") + esc(txt) + '</span>';
  }

  function rowHtml(type, item, ri){
    var av = "", primary = "", secondary = "";
    if (type === "brand"){ av = avHtml(item.logo, letter(item.name)); primary = hl(item.name || ""); }
    else if (type === "domain"){ av = avHtml(item.favicon, GLOBE); primary = hl(item.domain || ""); }
    else if (type === "url"){ av = avHtml(item.favicon, GLOBE); primary = hl(item.title || item.url || ""); secondary = hl(item.url || ""); }
    else if (type === "prompt"){
      var mk = String(item.market || "").toUpperCase();
      var flag = item.market ? ("https://flagcdn.com/" + String(item.market).toLowerCase() + ".svg") : "";
      av = avHtml(flag, '<span class="mqa-av-t">' + esc(mk) + '</span>');
      primary = hl(item.prompt_text || ""); secondary = "Market · " + esc(mk);
    }
    return '<button class="mqa-row" type="button" role="option" data-ri="' + ri + '">' +
      av +
      '<span class="mqa-main"><span class="mqa-primary">' + primary + '</span>' +
        (secondary ? '<span class="mqa-secondary">' + secondary + '</span>' : '') +
      '</span>' +
      metricHtml(item) +
      '<span class="mqa-type">' + TYPE_SINGULAR[type] + '</span>' +
      '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>' +
    '</button>';
  }

  function groupsFrom(items){
    var g = { brand:[], domain:[], url:[], prompt:[] };
    (items || []).forEach(function(it){ if (it && g[it.type]) g[it.type].push(it); });
    return g;
  }
  function orderedKeys(g){
    return Object.keys(g).filter(function(k){ return g[k].length; })
      .sort(function(a,b){ return (g[b].length - g[a].length) || (TYPE_ORDER[a] - TYPE_ORDER[b]); });
  }

  function skeletonHtml(){
    var n = 5, s = "";
    for (var i = 0; i < n; i++){
      var w1 = 40 + (i * 13) % 45, w2 = 22 + (i * 17) % 28;
      s += '<div class="mqa-skel-row"><div class="mqa-skel-av"></div><div class="mqa-skel-lines">' +
           '<div class="mqa-skel-line" style="width:' + w1 + '%"></div>' +
           '<div class="mqa-skel-line" style="width:' + w2 + '%"></div></div></div>';
    }
    return s;
  }
  function emptyHtml(){
    return '<div class="mqa-empty"><div class="mqa-empty-title">No results found</div>' +
      '<div class="mqa-empty-sub">Try searching for a brand, domain, URL, or prompt.</div></div>';
  }
  function errorHtml(msg){
    return '<div class="mqa-empty mqa-error"><div class="mqa-empty-title">' + esc(msg || "Something went wrong") + '</div>' +
      '<div class="mqa-empty-sub">Please try again.</div></div>';
  }

  function buildStatic(){
    var html = '<div class="mqa-sep"></div><div class="mqa-group"><div class="mqa-group-head">Actions</div>';
    STATIC.forEach(function(a){
      html += '<button class="mqa-action" type="button" role="option" data-action="' + a.action + '">' +
        '<span class="mqa-action-ic">' + a.icon + '</span>' +
        '<span class="mqa-main"><span class="mqa-primary">' + esc(a.label) + '</span></span>' +
        (a.hint ? '<span class="mqa-action-hint">' + esc(a.hint) + '</span>' : '') +
        '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>' +
      '</button>';
    });
    html += '</div>';
    actionsWrap.innerHTML = html;
  }

  /* ---------- state renders ---------- */
  /* ---------- recent searches ----------
     A "search" is whatever was in the palette when it was closed (query + chips), so the last
     three things you actually looked at are one click away. Session only — a page reload clears them. */
  var RECENT_MAX = 3;
  var TEAM = (root.getAttribute("data-team") || "").trim();     // or MiraQuickActions.setTeam(id)
  var recentEl = overlay.querySelector("#mqa-recent");
  var _recent = [];   // session only: gone on reload, so it can never leak across teams
  var _viewed = [];   // the last items you opened — session only as well
  var VIEWED_MAX = 3;
  function viewedPush(type, item){
    var key = type + "|" + (item.id || item.url || item.domain || item.name || "");
    _viewed = _viewed.filter(function(x){ return x._k !== key; });
    var copy = {}; for (var k in item) if (Object.prototype.hasOwnProperty.call(item, k)) copy[k] = item[k];
    copy._k = key; copy.type = type;
    _viewed.unshift(copy);
    _viewed = _viewed.slice(0, VIEWED_MAX);
  }
  var CLOCK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>';
  function recentLoad(){ return _recent; }
  function recentSave(list){ _recent = list; }
  function recentKey(e){ return (e.query || "") + "|" + [e.scope, e.rank, e.type, e.market, e.mentioning].join("|"); }
  // called on close: remember the completed search
  function recentPush(){
    if (!_lastCompleted) return;
    var e = _lastCompleted;
    if (!e.query && !e.scope && !e.rank && !e.type && !e.market && !e.mentioning) return;   // nothing to remember
    var list = recentLoad().filter(function(x){ return recentKey(x) !== recentKey(e); });   // no duplicates
    list.unshift(e);
    recentSave(list.slice(0, RECENT_MAX));
  }
  function miniChips(e){
    var out = "";
    var saved = FILTERS; FILTERS = { scope:e.scope, rank:e.rank, type:e.type, urltype:e.urltype, market:e.market, mentioning:e.mentioning };
    ["scope","rank","type","urltype","market","mentioning"].forEach(function(slot){
      if (!FILTERS[slot]) return;
      // "URLs" / "Top" ARE the label (no slot prefix) -> normal weight.
      // "Type You" / "Market DE" -> only the value after the prefix steps back.
      var pre = SLOT_LABEL[slot];
      var col = (slot === "type") ? citeColor(FILTERS.type) : (slot === "urltype" ? urlTypeColor(FILTERS.urltype) : "");
      var dotVal = (slot === "type") ? FILTERS.type : (slot === "urltype" ? FILTERS.urltype : "");
      out += pre
        ? '<span class="mqa-mini">' + (col ? colorDot(col) : "") + esc(pre) + '<b' + (col ? ' style="color:' + col + '"' : '') + '>' + esc(chipLabel(slot)) + '</b></span>'
        : '<span class="mqa-mini">' + esc(chipLabel(slot)) + '</span>';
    });
    FILTERS = saved;
    return out;
  }
  function renderRecent(){
    var list = recentLoad();
    var h = "";
    if (_viewed.length){
      h += '<div class="mqa-sep"></div><div class="mqa-group"><div class="mqa-group-head">Recent</div>';
      _viewed.forEach(function(it, i){ h += viewedRowHtml(it, i); });
      h += '</div>';
    }
    if (!list.length){ recentEl.innerHTML = h; return; }
    h += (_viewed.length ? '' : '<div class="mqa-sep"></div>') + '<div class="mqa-group"><div class="mqa-group-head">Recent Searches</div>';
    list.forEach(function(e, i){
      h += '<button class="mqa-action" type="button" role="option" data-recent="' + i + '">' +
        '<span class="mqa-recent-ic">' + CLOCK + '</span>' +
        '<span class="mqa-main"><span class="mqa-primary mqa-recent-line">' + miniChips(e) +
          (e.query ? '<span class="mqa-recent-q">' + esc(e.query) + '</span>' : '') +
        '</span></span>' +
        '<span class="mqa-recent-x" role="button" tabindex="-1" data-recent-rm="' + i + '" aria-label="Remove">' + XSVG + '</span>' +
        '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>' +
      '</button>';
    });
    recentEl.innerHTML = h + '</div>';
  }
  // same shape as a result row, just smaller
  function viewedRowHtml(item, i){
    var av = "", primary = "", secondary = "";
    if (item.type === "brand"){ av = avHtml(item.logo, letter(item.name)); primary = esc(item.name || ""); }
    else if (item.type === "domain"){ av = avHtml(item.favicon, GLOBE); primary = esc(item.domain || ""); }
    else if (item.type === "url"){ av = avHtml(item.favicon, GLOBE); primary = esc(item.title || item.url || ""); secondary = esc(item.url || ""); }
    else if (item.type === "prompt"){
      var mk = String(item.market || "").toUpperCase();
      av = avHtml(item.market ? ("https://flagcdn.com/" + String(item.market).toLowerCase() + ".svg") : "", '<span class="mqa-av-t">' + esc(mk) + '</span>');
      primary = esc(item.prompt_text || ""); secondary = mk ? ("Market · " + esc(mk)) : "";
    }
    return '<button class="mqa-row is-mini" type="button" role="option" data-viewed="' + i + '">' +
      av +
      '<span class="mqa-main"><span class="mqa-primary">' + primary + '</span>' +
        (secondary ? '<span class="mqa-secondary">' + secondary + '</span>' : '') +
      '</span>' +
      '<span class="mqa-type">' + (TYPE_SINGULAR[item.type] || "") + '</span>' +
      '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>' +
    '</button>';
  }
  function applyRecent(i){
    var e = recentLoad()[i]; if (!e) return;
    FILTERS = { scope:e.scope || null, rank:e.rank || null, type:e.type || null, urltype:e.urltype || null, market:e.market || null, mentioning:e.mentioning || null };
    query = e.query || ""; input.value = query;
    renderChips(); syncPh();
    if (query.length >= MIN || FILTERS.rank) runSearch(); else renderIdle();
    input.focus();
  }
  recentEl.addEventListener("click", function(ev){
    var rm = ev.target.closest ? ev.target.closest("[data-recent-rm]") : null;
    if (rm){
      ev.stopPropagation();
      var list = recentLoad(); list.splice(+rm.getAttribute("data-recent-rm"), 1); recentSave(list);
      renderRecent(); refreshRows(); return;
    }
  });
  function showRecent(on){ recentEl.style.display = on ? "" : "none"; }
  function showStatic(on){ actionsWrap.style.display = on ? "" : "none"; }
  function renderIdle(){
    showStatic(true); renderRecent(); showRecent(true);
    resultsEl.innerHTML = ""; state = "idle"; refreshRows(); setActive(0, false);
  }

  /* ---------- chips ---------- */
  var chipsEl = overlay.querySelector("#mqa-chips");
  var phEl    = overlay.querySelector("#mqa-ph");
  var phCmdEl = overlay.querySelector("#mqa-ph-cmd");
  var escEl   = overlay.querySelector("#mqa-esc");
  var clearEl = overlay.querySelector("#mqa-clear");
  // the placeholder + "/" hint show only on an empty palette; the esc hint turns into a trash button
  // as soon as there's a query or a chip to clear
  function syncPh(){
    var busy = !!input.value || anyFilter();
    if (phEl)    phEl.classList.toggle("is-hidden", busy);
    if (phCmdEl) phCmdEl.classList.toggle("is-hidden", busy);
    if (escEl)   escEl.classList.toggle("is-hidden", busy);
    if (clearEl) clearEl.classList.toggle("is-hidden", !busy);
  }
  if (clearEl) clearEl.addEventListener("click", function(e){ e.stopPropagation(); clearAll(); input.focus(); });
  var XSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  function renderChips(){
    var h = "";
    ["scope","rank","type","urltype","market","mentioning"].forEach(function(slot){
      if (!FILTERS[slot]) return;
      var pre = SLOT_LABEL[slot];
      var col = (slot === "type") ? citeColor(FILTERS.type) : (slot === "urltype" ? urlTypeColor(FILTERS.urltype) : "");
      h += '<span class="mqa-chip" data-slot="' + slot + '">' +
           (col ? colorDot(col) : "") +
           (pre ? esc(pre) + '<b' + (col ? ' style="color:' + col + '"' : '') + '>' + esc(chipLabel(slot)) + '</b>' : esc(chipLabel(slot))) +
           '<button class="mqa-chip-x" type="button" data-rm="' + slot + '" aria-label="Remove filter">' + XSVG + '</button></span>';
    });
    chipsEl.innerHTML = h;
    syncPh();   // chips take the placeholder's place
  }
  chipsEl.addEventListener("click", function(e){
    var b = e.target.closest ? e.target.closest("[data-rm]") : null; if (!b) return;
    FILTERS[b.getAttribute("data-rm")] = null; pruneFilters(); renderChips(); afterFilterChange(); input.focus();
  });

  /* ---------- command dropdown ---------- */
  function cmdRowHtml(label, hint, attrs, av, round, dot){
    var lead = dot
      ? '<span class="mqa-cmd-dotwrap"><span class="mqa-ct-dot" style="background:' + escAttr(dot) + '"></span></span>'
      : (av
        ? '<span class="mqa-cmd-av' + (round ? ' is-round' : '') + '"><img src="' + escAttr(av) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'"></span>'
        : '<span class="mqa-cmd-slash">/</span>');
    return '<button class="mqa-action" type="button" role="option" ' + attrs + '>' +
      lead +
      '<span class="mqa-main"><span class="mqa-primary"' + (dot ? ' style="color:' + escAttr(dot) + '"' : '') + '>' + esc(label) + '</span></span>' +
      (hint ? '<span class="mqa-cmd-hint">' + esc(hint) + '</span>' : '') +
      '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></span>' +
    '</button>';
  }
  // returns true when the input is in command mode and the list was rendered
  function renderCommands(raw){
    var m = /^\/(\S*)(\s+)?(.*)$/.exec(raw);
    if (!m) return false;
    var head = (m[1] || "").toLowerCase(), hasSpace = !!m[2], rest = (m[3] || "").toLowerCase();
    var cmd = CMD_BY_ID[head];

    // sub-menu: "/type y" -> the citation types filtered by "y"
    if (cmd && cmd.sub && hasSpace){
      var opts = subOptions(cmd.sub).filter(function(o){ return !rest || o.label.toLowerCase().indexOf(rest) !== -1 || String(o.value).toLowerCase().indexOf(rest) !== -1; });
      var h1 = '<div class="mqa-group"><div class="mqa-group-head">' + esc(cmd.label) + '</div>';
      if (!opts.length) h1 += '<div class="mqa-empty">' + (cmd.sub === "brands" && !BRANDS.length ? "No brands loaded" : "No match") + '</div>';
      opts.forEach(function(o){ h1 += cmdRowHtml(o.label, "", 'data-cmd="' + cmd.id + '" data-cmd-val="' + escAttr(o.value) + '"', o.av, o.round, o.dot); });
      showStatic(false); showRecent(false);
      resultsEl.innerHTML = h1 + '</div>'; state = "commands"; refreshRows(); setActive(0, false); scroll.scrollTop = 0;
      return true;
    }

    // top level: step 1 offers only the scopes; the dimensions appear once a scope is picked,
    // and only those the data model has for that scope (a brand has no citation type, etc.)
    var list = COMMANDS.filter(function(c){
      if (c.slot === "scope") return !FILTERS.scope;                               // pick the type first
      if (!FILTERS.scope) return false;                                            // dimensions need a scope
      if (c.scopes && c.scopes.indexOf(FILTERS.scope) === -1) return false;        // not available for this type
      if (c.slot && FILTERS[c.slot] && !c.sub) return false;                       // slot already taken
      if (c.sub && FILTERS[c.slot]) return false;                                  // sub-filter already set
      return true;
    }).filter(function(c){
      if (!head) return true;
      // match on word starts only, so "/u" hits "URLs" but not "Edit yoUr brand"
      var words = (c.id + " " + c.label).toLowerCase().split(/[\s\-]+/);
      return words.some(function(w){ return w.indexOf(head) === 0; });
    });
    var h = "";
    if (!list.length){
      // most likely cause: a dimension was typed before choosing a type
      var wantsScope = !FILTERS.scope && COMMANDS.some(function(c){
        return c.slot !== "scope" && (c.id.indexOf(head) === 0 || c.label.toLowerCase().indexOf(head) === 0);
      });
      h = '<div class="mqa-empty">' + (wantsScope ? "Pick a type first — URLs, Brands, Domains or Prompts" : "No command") + '</div>';
    } else {
      var groups = [["Metrics", ["scope","type","urltype","market","mentioning"]], ["Performance", ["rank"]]];
      groups.forEach(function(g){
        var part = list.filter(function(c){ return g[1].indexOf(c.slot || null) !== -1; });
        if (!part.length) return;
        h += '<div class="mqa-group"><div class="mqa-group-head">' + g[0] + '</div>';
        part.forEach(function(c){ h += cmdRowHtml(c.label, c.hint, 'data-cmd="' + c.id + '"'); });
        h += '</div>';
      });
    }
    showStatic(false); showRecent(false);
    resultsEl.innerHTML = h; state = "commands"; refreshRows(); setActive(0, false); scroll.scrollTop = 0;
    return true;
  }
  function applyCommand(id, val){
    var cmd = CMD_BY_ID[id]; if (!cmd) return;
    if (cmd.action){ selectStatic(cmd.action); return; }
    if (cmd.sub && !val){ input.value = "/" + cmd.id + " "; onInput(); return; }   // step into the sub-menu
    FILTERS[cmd.slot] = val || cmd.value;
    input.value = ""; query = ""; syncPh();
    renderChips(); afterFilterChange(); input.focus();
  }
  // dimensions hang off the scope: drop the ones that stop making sense when the scope is removed/changed
  function pruneFilters(){
    if (!FILTERS.scope){ FILTERS.type = null; FILTERS.urltype = null; FILTERS.market = null; FILTERS.mentioning = null; FILTERS.rank = null; return; }
    COMMANDS.forEach(function(c){
      if (!c.slot || c.slot === "scope" || !FILTERS[c.slot]) return;
      if (c.scopes && c.scopes.indexOf(FILTERS.scope) === -1) FILTERS[c.slot] = null;
    });
  }
  function afterFilterChange(){
    clearTimeout(debTimer);                                   // no stale keystroke search on top
    if (FILTERS.rank || query.length >= MIN) runSearch();     // a click isn't typing -> no debounce needed
    else renderIdle();
  }
  function renderLoading(){ showStatic(true); showRecent(false); resultsEl.innerHTML = skeletonHtml(); state = "loading"; refreshRows(); setActive(0, false); }
  function renderEmpty(){ showStatic(true); showRecent(false); resultsEl.innerHTML = emptyHtml(); state = "empty"; refreshRows(); setActive(0, false); }
  function renderError(msg){ showStatic(true); showRecent(false); resultsEl.innerHTML = errorHtml(msg); state = "error"; refreshRows(); setActive(0, false); }
  function renderResults(items){
    if (!items || !items.length){ renderEmpty(); return; }
    var g = groupsFrom(items), keys = orderedKeys(g);
    if (!keys.length){ renderEmpty(); return; }
    _rowData = []; var html = "";
    keys.forEach(function(k){
      html += '<div class="mqa-group"><div class="mqa-group-head">' + TYPE_LABEL[k] + '</div>';
      g[k].forEach(function(it){ var ri = _rowData.length; _rowData.push(it); html += rowHtml(k, it, ri); });
      html += '</div>';
    });
    showStatic(true); showRecent(false);
    resultsEl.innerHTML = html; state = "results"; refreshRows(); setActive(0, false);
    scroll.scrollTop = 0;
  }

  /* ---------- keyboard selection ---------- */
  function refreshRows(){
    // results and actions are separate containers now -> query the modal (DOM order keeps results first).
    // only rows that are actually on screen: the actions block is hidden in command mode, and
    // keyboard nav must not run through invisible entries
    modal.classList.toggle("has-results", !!resultsEl.children.length);
    rows = Array.prototype.slice.call(modal.querySelectorAll(".mqa-row, .mqa-action"))
      .filter(function(el){ return el.offsetParent !== null; });
  }
  function setActive(i, doScroll){
    if (!rows.length){ activeIndex = -1; return; }
    if (i < 0) i = 0; if (i > rows.length - 1) i = rows.length - 1;
    activeIndex = i;
    for (var k = 0; k < rows.length; k++) rows[k].classList.toggle("is-active", k === i);
    if (doScroll){ var el = rows[i]; if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" }); }   // only for keyboard nav
  }
  function move(dir){ if (!rows.length) return; var n = activeIndex + dir; if (n < 0) n = rows.length - 1; if (n > rows.length - 1) n = 0; setActive(n, true); }
  function activate(el){
    if (!el) return;
    if (el.hasAttribute("data-viewed")){ var v = _viewed[+el.getAttribute("data-viewed")]; if (v){ _rowData.push(v); selectResult(_rowData.length - 1); } return; }
    if (el.hasAttribute("data-recent")){ applyRecent(+el.getAttribute("data-recent")); return; }
    if (el.hasAttribute("data-cmd")){ applyCommand(el.getAttribute("data-cmd"), el.getAttribute("data-cmd-val")); return; }
    if (el.classList.contains("mqa-action")) selectStatic(el.getAttribute("data-action"));
    else selectResult(+el.getAttribute("data-ri"));
  }

  /* ---------- selection -> events ---------- */
  function selectResult(ri){
    var it = _rowData[ri]; if (!it) return;
    viewedPush(it.type, it);
    if (it.type === "brand")       fireSelect("brand",  it.id);       // company / brand id
    else if (it.type === "domain") fireSelect("domain", it.domain);   // domain
    else if (it.type === "url")    fireSelect("url",    it.url);      // url
    else if (it.type === "prompt") fireSelect("prompt", it.id);       // prompt id
    else return;
    close();
  }
  function selectStatic(action){ if (!action) return; fireStatic(action); close(); }

  /* ---------- search ---------- */
  function onInput(){
    var raw = input.value;
    syncPh();
    clearTimeout(debTimer);
    if (raw.charAt(0) === "/"){ query = ""; latestReqId = null; renderCommands(raw); return; }   // "/" -> command dropdown
    query = raw.trim();
    // a rank filter searches even with an empty query (leaderboard) -> still debounce it
    if (query.length < MIN && !FILTERS.rank){ latestReqId = null; renderIdle(); return; }
    debTimer = setTimeout(runSearch, DEBOUNCE);
  }
  // Umlauts/diacritics: the raw query goes out untouched, plus two folded variants so the Bubble
  // search can match regardless of how the data is spelled ("Müller" vs "Mueller" vs "Muller").
  //   query_folded : diacritics stripped   -> "müller"  -> "muller",  "Köln" -> "koln"
  //   query_de     : German transliteration -> "müller" -> "mueller", "Köln" -> "koeln", "ß" -> "ss"
  function foldDiacritics(s){
    var t = String(s == null ? "" : s);
    try { t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch(_){}
    return t.replace(/ß/g, "ss").toLowerCase();
  }
  function germanExpand(s){
    return String(s == null ? "" : s)
      .replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue")
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .toLowerCase();
  }
  function runSearch(){
    var reqId = newReqId(); latestReqId = reqId;
    if (window.MQA_DEBUG) console.log("[MQA] runSearch -> new active req=", reqId, "scope=", FILTERS.scope, "rank=", FILTERS.rank, "q=", JSON.stringify(query));
    renderLoading();
    fire("mira_quick_actions_search", {
      query: query,
      query_folded: foldDiacritics(query),
      query_de: germanExpand(query),
      scope: FILTERS.scope || "",          // "url" | "brand" | "domain" | "prompt"
      rank: FILTERS.rank || "",            // "top" | "trending"  -> sort, works without a query
      citation_type: FILTERS.type || "",   // "You" | "Competition" | ...
      url_type: FILTERS.urltype || "",     // "listicle" | "guide" | ... (scope=url only)
      market: FILTERS.market || "",
      mentioning: FILTERS.mentioning || "",   // brand id (or name) the URL/domain/prompt must mention
      limit: FILTERS.scope ? 15 : 5,       // a single type can show more rows
      requestId: reqId
    });   // <- Bubble: run the RPC now
  }

  /* ---------- open / close ---------- */
  function open(){
    if (isOpen) return; isOpen = true;
    overlay.setAttribute("data-theme", root.getAttribute("data-theme") || "light");
    // always bring to the very front: move to the end of <body> (wins ties at equal z-index) + max z-index
    try { document.body.appendChild(overlay); } catch(_){}
    overlay.style.zIndex = "2147483647";
    overlay.classList.add("is-open"); overlay.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", onKeydown, true);
    renderIdle();
    setTimeout(function(){ try { input.focus(); input.select(); } catch(_){} }, 20);
  }
  function close(){
    recentPush(); _lastCompleted = null;
    if (!isOpen) return; isOpen = false;
    overlay.classList.remove("is-open"); overlay.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onKeydown, true);
    clearAll();
  }
  /* ---------- filter tooltip: hover "/ for filters" ---------- */
  var tipEl = document.createElement("div");
  tipEl.className = "mqa-tip";
  tipEl.innerHTML =
    '<div class="mqa-tip-h">Filters</div>' +
    '<div class="mqa-tip-flow">' +
      '<span class="mqa-tip-key">/</span><span class="mqa-tip-arrow">→</span>' +
      '<span class="mqa-mini">URLs</span><span class="mqa-tip-arrow">→</span>' +
      '<span class="mqa-mini">Type You</span>' +
    '</div>' +
    '<p>Type <b>/</b> to pick what you\'re looking for — URLs, brands, domains or prompts.</p>' +
    '<p>Then stack filters: <b>/type</b>, <b>/market</b>, <b>/mentioning</b>, or sort with <b>/top</b> and <b>/trending</b>.</p>' +
    '<p>Each pick becomes a chip. Keep typing to search inside them, <b>backspace</b> removes the last one.</p>';
  overlay.appendChild(tipEl);
  function showTip(){
    if (!phCmdEl) return;
    tipEl.classList.add("is-on");
    var r = phCmdEl.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
    var pad = 8, left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - t.width - pad));
    var top = r.bottom + 8;                                   // below the hint
    if (top + t.height > window.innerHeight - pad) top = r.top - t.height - 8;   // flip above if needed
    tipEl.style.left = Math.round(left) + "px"; tipEl.style.top = Math.round(top) + "px";
  }
  function hideTip(){ tipEl.classList.remove("is-on"); }
  if (phCmdEl){
    phCmdEl.addEventListener("mouseenter", showTip);
    phCmdEl.addEventListener("mouseleave", hideTip);
  }

  function clearAll(){
    clearTimeout(debTimer); query = ""; input.value = ""; latestReqId = null; _rowData = [];
    FILTERS = { scope: null, rank: null, type: null, urltype: null, market: null, mentioning: null };
    syncPh(); renderChips();
    renderIdle();
  }

  function onKeydown(e){
    if (!isOpen) return;
    if (e.key === "Escape"){ e.preventDefault(); close(); return; }
    // terminal-style: on an untouched field, ArrowUp recalls the last search instead of moving the cursor
    if (e.key === "ArrowUp" && !input.value && !anyFilter() && recentLoad().length){
      e.preventDefault(); applyRecent(0); return;
    }
    if (e.key === "ArrowDown"){ e.preventDefault(); move(1); return; }
    if (e.key === "ArrowUp"){ e.preventDefault(); move(-1); return; }
    if (e.key === "Enter"){ if (activeIndex >= 0 && rows[activeIndex]){ e.preventDefault(); activate(rows[activeIndex]); } return; }
    if (e.key === "Backspace" && !input.value && anyFilter()){
      var order = ["mentioning","market","urltype","type","rank","scope"];                       // remove the most recent-ish first
      for (var i = 0; i < order.length; i++){ if (FILTERS[order[i]]){ FILTERS[order[i]] = null; break; } }
      pruneFilters(); e.preventDefault(); renderChips(); afterFilterChange(); return;
    }
  }

  /* ---------- wiring ---------- */
  if (trigger) trigger.addEventListener("click", open);
  input.addEventListener("input", onInput);
  overlay.addEventListener("mousedown", function(e){ if (e.target === overlay) close(); });   // click outside
  // results, recent and actions live in three separate containers -> listen on the modal
  modal.addEventListener("click", function(e){ var el = e.target.closest ? e.target.closest(".mqa-row, .mqa-action") : null; if (el) activate(el); });
  modal.addEventListener("mousemove", function(e){ var el = e.target.closest ? e.target.closest(".mqa-row, .mqa-action") : null; if (el){ var i = rows.indexOf(el); if (i >= 0 && i !== activeIndex) setActive(i); } });
  // BULLETPROOF SCROLL: drive the list ourselves on wheel so it works over any element (text/logo/favicon)
  // and never leaks to the page behind — independent of any app-level scroll CSS/handlers.
  scroll.addEventListener("wheel", function(e){
    if (scroll.scrollHeight > scroll.clientHeight){
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= scroll.clientHeight;
      scroll.scrollTop += d;
    }
    e.preventDefault();
  }, { passive: false });

  // global Cmd/Ctrl+K — capture phase so neither the browser nor the app can swallow it first
  document.addEventListener("keydown", function(e){
    var k = (e.key || "").toLowerCase();
    if ((e.metaKey || e.ctrlKey) && (k === "k" || e.code === "KeyK")){
      e.preventDefault(); e.stopPropagation();
      isOpen ? close() : open();
    }
  }, true);

  // kbd label for platform
  try { if (!/Mac|iPhone|iPad|iPod/.test(navigator.platform || "")) { var k = root.querySelector("[data-kbd]"); if (k) k.textContent = "Ctrl K"; } } catch(_){}

  buildStatic();
  renderIdle();

  /* ---------- public API (Bubble drives these) ---------- */
  // Accepts items as an array (best), or as a JSON string — and if that string has unescaped quotes
  // inside values (a common Bubble/Supabase problem, e.g. a title like  "rave. now. together."),
  // it repairs them before parsing so a single stray quote can't blank the whole result list.
  function repairJson(str){
    // escape any double-quote that is NOT a structural one. A structural quote is followed (ignoring
    // whitespace) by one of  : , } ]  or preceded by one of  { [ , :  — everything else is content.
    var out = "", inStr = false;
    for (var i = 0; i < str.length; i++){
      var ch = str[i], prev = str[i - 1];
      if (ch === '"' && prev !== '\\'){
        if (!inStr){ inStr = true; out += ch; continue; }
        // we're inside a string and hit a quote — is it the real closing quote?
        var j = i + 1; while (j < str.length && /\s/.test(str[j])) j++;
        var next = str[j];
        if (next === ':' || next === ',' || next === '}' || next === ']' || next === undefined){
          inStr = false; out += ch;                 // structural closing quote
        } else {
          out += '\\"';                             // stray quote inside the value -> escape it
        }
        continue;
      }
      out += ch;
    }
    return out;
  }
  function coerceItems(items){
    if (Array.isArray(items)) return items;                 // already parsed by Bubble -> ideal
    if (typeof items !== "string") return [];
    try { return JSON.parse(items); } catch(e1){}
    try { return JSON.parse(repairJson(items)); } catch(e2){
      if (window.MQA_DEBUG) console.log("[MQA] could not parse items even after repair:", e2);
      return [];
    }
  }

  var api = {
    open: open,
    close: close,
    clear: clearAll,
    setTheme: function(theme){
      theme = (String(theme || "").toLowerCase() === "dark") ? "dark" : "light";
      root.setAttribute("data-theme", theme);
      overlay.setAttribute("data-theme", theme);
    },
    // scope the recent searches to a team — call this on page load AND whenever the team changes,
    // otherwise one team's recents would show up for the next
    // optional: only needed if the team can change without a page reload — drops the recents so
    // one team's searches never show up for the next
    setTeam: function(id){
      var next = String(id == null ? "" : id).trim();
      if (next === TEAM) return;
      TEAM = next; _recent = [];
      try { root.setAttribute("data-team", TEAM); } catch(_){}
      if (state === "idle"){ renderRecent(); refreshRows(); }
    },
    // brands for "/mentioning" — feed these in once on page load (name + logo is enough)
    setBrands: function(list){
      try { if (typeof list === "string") list = JSON.parse(list); } catch(_){}
      BRANDS = Array.isArray(list) ? list.filter(Boolean).map(function(b){
        return { id: b.id != null ? b.id : "", name: String(b.name || b.label || ""), logo: b.logo || b.favicon || "" };
      }).filter(function(b){ return b.name; }) : [];
    },
    // let Bubble supply the real market list for "/market" (falls back to a sensible default)
    setMarkets: function(list){
      try { if (typeof list === "string") list = JSON.parse(list); } catch(_){}
      if (Array.isArray(list) && list.length) MARKETS = list.map(function(m){ return String(m && m.value != null ? m.value : m); });
    },
    setLoading: function(requestId){ if (window.MQA_DEBUG) console.log("[MQA] setLoading req=", requestId, "active=", latestReqId, requestId && requestId !== latestReqId ? "IGNORED" : "OK"); if (requestId && requestId !== latestReqId) return; renderLoading(); },
    setResults: function(payload){
      payload = payload || {};
      if (window.MQA_DEBUG) console.log("[MQA] setResults req=", payload.requestId, "active=", latestReqId, (payload.requestId && payload.requestId !== latestReqId) ? "IGNORED (stale requestId)" : "RENDER");
      if (payload.requestId && payload.requestId !== latestReqId) return;
      var items = coerceItems(payload.items);
      _lastCompleted = { query: query, scope: FILTERS.scope || "", rank: FILTERS.rank || "", type: FILTERS.type || "", urltype: FILTERS.urltype || "", market: FILTERS.market || "", mentioning: FILTERS.mentioning || "" };
      renderResults(items);
    },
    setError: function(payload){ payload = payload || {}; if (payload.requestId && payload.requestId !== latestReqId) return; renderError(payload.message); },
    // exposed so the Bubble "Run JavaScript" step can sanitize the RPC response before parsing:
    //   MiraQuickActions.setResults({ requestId: `ID`, items: MiraQuickActions.parseItems(`[RESPONSE]`) });
    // (setResults also sanitizes internally, so passing a raw string as items works too)
    parseItems: function(items){ return coerceItems(items); }
  };
  window.MiraQuickActions = api;
})();
