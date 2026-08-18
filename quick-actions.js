/* upstreem — Quick Actions (Cmd-K command menu).
   Split out of the original standalone quick_actions.html verbatim — logic below is unchanged
   from the standalone version, including the JS event names, the window.MiraQuickActions API,
   and every bubble_fn_* it calls. See bubble/quick_actions_bubble.html for the migration notes
   and the full attribute/event documentation. */
(function mqaBoot(){
  /* Der Loader dieses Elements laedt als EINZIGER der 15 Komponenten kein core.js mit -- er holt
     nur quick-actions.css/js. Auf einer Seite, auf der sonst keine upstreem-Komponente liegt,
     existiert damit gar kein window.UpstreemCore, also auch kein Marken-Store: /mentioning stand
     dort immer auf "No brands loaded", voellig unabhaengig davon, was setUpstreemBrands() getan
     hat. Genau deshalb funktionierten Topics und Markets: deren Filter bringen ihren Core selbst
     mit. Die Palette holt core.js jetzt aus demselben Pin nach, aus dem sie selbst kommt -- ohne
     dass irgendwo in Bubble ein Block neu eingesetzt werden muss.
     core.css bleibt bewusst aussen vor: die Palette bringt ihr eigenes Styling mit, ein
     zusaetzliches Stylesheet wuerde ihr Aussehen veraendern. */
  var SELF_SRC = (document.currentScript && document.currentScript.src) || "";
  function coreDa(){
    if (window.UpstreemCore) return true;
    /* Die Registry, ueber die sich alle Loader gegenseitig sehen. Ein Eintrag darin heisst: eine
       Komponente hat core.js schon angefordert, es laeuft nur noch nicht. */
    var reg = window.__upAssetsLoaded, k;
    if (reg) for (k in reg) if (/\/core\.js(?:\?|$)/.test(k)) return true;
    var sc = document.querySelectorAll("script[src]");
    for (var i = 0; i < sc.length; i++){
      if (/\/core\.js(?:\?|$)/.test(sc[i].getAttribute("src") || "")) return true;
    }
    return false;
  }
  function ensureCore(){
    if (coreDa()) return;
    var m = /^(.*\/)quick-actions\.js(?:\?.*)?$/.exec(SELF_SRC);
    if (!m) return;                                   // lokaler Harness / eigener Pfad: nichts tun
    var url = m[1] + "core.js";
    /* MIT Eintrag in die gemeinsame Registry. Ohne den holt der naechste Komponenten-Loader
       dieselbe Datei ein zweites Mal, core.js laeuft doppelt, und weil beide Ketten ihr eigenes
       async=false haben, kann eine Komponenten-JS vor ihrem Core dran sein. Die Komponente
       initialisiert dann nicht und ihr Markup steht unformatiert da. Genau das ist passiert. */
    var reg = window.__upAssetsLoaded || (window.__upAssetsLoaded = {});
    if (reg[url]) return;
    reg[url] = 1;
    var sc = document.createElement("script");
    sc.src = url; sc.async = false;
    sc.setAttribute("data-up-core", "1");
    sc.onerror = function(){
      if (window.console) console.warn("[quick-actions] could not load core.js from " + url +
        " — the page-wide brand store stays unavailable and /mentioning will have no brands.");
    };
    document.head.appendChild(sc);
  }
  /* Nachfassen, nicht vorpreschen. Auf einer normalen Seite bringt eine andere Komponente core.js
     mit; die Palette darf dieses Rennen nicht gewinnen, sonst laedt sie es aus IHREM Pin, waehrend
     der Rest der Seite auf einem anderen steht. Nur wenn nach dem Seitenaufbau immer noch keiner
     da ist -- die Palette also allein auf der Seite liegt -- springt sie ein. */
  setTimeout(ensureCore, 1200);

  /* Boot-Stubs. window.MiraQuickActions entsteht erst ganz unten in dieser Datei -- ein
     Workflow-Schritt, der frueher MiraQuickActions.setResults(...) ruft, wirft "Cannot read
     properties of undefined" und reisst den Rest des Schrittes mit. Das Stub-Objekt merkt den
     Aufruf vor; nach der echten Zuweisung wird die Warteschlange in Aufrufreihenfolge
     abgearbeitet. Jede andere Komponente dieser Familie hat den Block seit Langem
     (prompts-table.js:11), hier fehlte er ganz.
     Nur stubben, wenn noch niemand den Namen besitzt: laeuft diese Datei ein zweites Mal, darf
     die echte Fassung nicht ueberschrieben werden. */
  var MQA_API = ["open", "close", "clear", "setTheme", "setTeam", "setBrands", "setMarkets",
                 "setLoading", "setResults", "setError", "parseItems"];
  var MQA_Q = (window.__mqaBootQueue = window.__mqaBootQueue || []);
  if (!window.MiraQuickActions){
    var stub = {};
    MQA_API.forEach(function(n){
      stub[n] = function(){ MQA_Q.push([n, [].slice.call(arguments)]); };
    });
    stub.__isStub = true;
    window.MiraQuickActions = stub;
  }

  /* ---------- Markup ----------
     Das Markup stand bisher NUR in bubble/quick_actions_bubble.html. Damit konnte die Palette
     ausschliesslich dort entstehen, wo jemand diese 39 Zeilen von Hand eingesetzt hatte -- die
     Sidebar konnte sie nicht selbst aufbauen, ohne die Zeilen ein zweites Mal zu fuehren.
     Jetzt steht die Vorlage hier, und wer die Palette will, braucht nur noch den Rahmen:
         <div id="mira-quick-actions"></div>
     Bestehende Einbauten bleiben unberuehrt: ist ein .mqa-trigger schon da, wird nichts gebaut. */
  var MQA_MARKUP =
    '<button class="mqa-trigger" type="button" aria-label="Open quick actions">' +
      '<svg class="mqa-trigger-ic" viewBox="0 0 24 24"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>' +
      '<span class="mqa-trigger-label">Quick Actions</span>' +
      '<span class="mqa-kbd" data-kbd>\u2318K</span>' +
    '</button>' +
    '<div class="mqa-overlay" role="presentation" aria-hidden="true">' +
      '<div class="mqa-modal" role="dialog" aria-modal="true" aria-label="Quick actions">' +
        '<div class="mqa-search">' +
          '<svg class="mqa-search-ic" viewBox="0 0 24 24"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>' +
          '<span class="mqa-chips" id="mqa-chips"></span>' +
          '<span class="mqa-inputwrap">' +
            '<input class="mqa-input" type="text" autocomplete="off" spellcheck="false" placeholder="" aria-label="Search" />' +
            '<span class="mqa-ph" id="mqa-ph" aria-hidden="true">Search brands, domains, URLs, prompts\u2026</span>' +
          '</span>' +
          '<span class="mqa-ph-cmd" id="mqa-ph-cmd" aria-hidden="true">/ for filters</span>' +
          '<span class="mqa-kbd mqa-esc" id="mqa-esc">esc</span>' +
          '<button class="mqa-fav is-hidden" type="button" id="mqa-fav" aria-pressed="false" aria-label="Save as Favorite">' +
            '<svg viewBox="0 0 24 24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></svg>' +
          '</button>' +
          '<button class="mqa-clear is-hidden" type="button" id="mqa-clear" aria-label="Reset search">' +
            '<svg viewBox="0 0 24 24"><path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>' +
          '</button>' +
        '</div>' +
        '<button class="mqa-entercta is-hidden" type="button" id="mqa-entercta">Press' +
          '<span class="mqa-kbd"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4v7a4 4 0 0 1-4 4H4" /> <path d="m9 10-5 5 5 5" /></svg>Enter</span>' +
        'to search</button>' +
        '<div class="mqa-scroll"><div class="mqa-results" aria-live="polite"></div></div>' +
        '<div class="mqa-recent-wrap" id="mqa-recent"></div>' +
        '<div class="mqa-actions-wrap"></div>' +
      '</div>' +
    '</div>';

  var root = document.getElementById('mira-quick-actions');
  /* Nicht still aufgeben, wenn der Rahmen noch fehlt: Bubble baut die Seite in Schueben auf, und
     die Sidebar legt ihren Rahmen erst an, wenn sie selbst steht. Frueher war die Palette in
     diesem Fall fuer immer weg -- diese Datei lief genau einmal. */
  if (!root){
    var v = (window.__mqaWarten = (window.__mqaWarten || 0) + 1);
    if (v <= 40) setTimeout(mqaBoot, 150);
    else if (window.console) console.warn("[quick-actions] kein Element mit id=\"mira-quick-actions\" auf der Seite.");
    return;
  }
  if (root.__mqaInit) return; root.__mqaInit = true;
  if (!root.querySelector('.mqa-trigger')) root.innerHTML = MQA_MARKUP;

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

  var GLOBE = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /> <path d="M2 12h20" /></svg>';
  var STATIC = [
    { action:"add_new_prompt",  label:"Add New Prompt",  hint:"", icon:'<svg viewBox="0 0 24 24"><path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" /></svg>' },
    { action:"add_new_brand",   label:"Add New Brand",   hint:"", icon:'<svg viewBox="0 0 24 24"><path d="M4 10c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"/><path d="M10 16c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2"/><rect width="8" height="8" x="14" y="14" rx="2"/></svg>' },
    { action:"export_data",     label:"Export Your Data",hint:"", icon:'<svg viewBox="0 0 24 24"><path d="M12 15V3" /> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /> <path d="m7 10 5 5 5-5" /></svg>' },
    { action:"edit_your_brand", label:"Edit Your Brand", hint:"", icon:'<svg viewBox="0 0 24 24"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>' }
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
  /* Both palettes are core.js's, value for value -- URL_TYPE and CITE_COLOR there. They are
     MIRRORED rather than imported because this component is deliberately standalone: its Bubble
     loader pulls only quick-actions.css/.js, no core, so that the palette works on a page that
     embeds nothing else. The price is that these two tables have to be kept in step with core by
     hand; that is why they are one block with this note on it instead of scattered lookups.

     What changed here and why: this file used to carry ONE colour per type and no dark variant, so
     a chip in the palette was a different colour from the same chip in the tables as soon as the
     app was in dark mode -- and the citation hues were a second, older set entirely (#14b8a6 for
     Editorial where core says #27a79b). Now: core's light value, core's dark value, core's names.

     Citation types have no real dark variant in core either -- the same hue carries both themes,
     and only the chip BACKGROUND changes. URL types do have one. */
  var URL_TYPE_COLOR = {
    homepage:        { c:"#b45309", cDark:"#fbbf24" },
    product_service: { c:"#c2683b", cDark:"#fdba74" },
    marketplace:     { c:"#9a5b2e", cDark:"#fcae6f" },
    company_info:    { c:"#a16207", cDark:"#facc15" },
    article:         { c:"#047857", cDark:"#6ee7b7" },
    listicle:        { c:"#0e7490", cDark:"#67e8f9" },
    guide:           { c:"#2563eb", cDark:"#93c5fd" },
    comparison:      { c:"#4f46e5", cDark:"#a5b4fc" },
    review:          { c:"#6d28d9", cDark:"#c4b5fd" },
    documentation:   { c:"#6d28d9", cDark:"#c4b5fd" },
    forum:           { c:"#9333ea", cDark:"#d8b4fe" },
    directory:       { c:"#a21caf", cDark:"#f0abfc" },
    video:           { c:"#7c3aed", cDark:"#c4b5fd" },
    social_post:     { c:"#8b5cf6", cDark:"#ddd6fe" }
  };
  var OTHER_LIGHT = "#8c8f96", OTHER_DARK = "#a8abb2", CHIP_BG_DARK = "#242424";
  function urlTypeLabel(t){ return URL_TYPE_LABEL[t] || String(t||"").replace(/_/g," "); }
  /* base = the LIGHT hue always. The tinted background is mixed from it in both themes, so a
     chip's fill stays the same family whatever the text colour does. */
  function urlTypeBase(t){ var e = URL_TYPE_COLOR[t]; return e ? e.c : OTHER_LIGHT; }
  function urlTypeColor(t){
    var e = URL_TYPE_COLOR[t];
    if (!e) return isDarkTheme() ? OTHER_DARK : OTHER_LIGHT;
    return isDarkTheme() ? e.cDark : e.c;
  }
  var CITE_COLOR = {
    Editorial:"#27a79b", UGC_Community:"#34a1d1", Knowledge_Base:"#797ad8",
    Brand_Platform:"#bc69c9", Institutional:"#5e7eac", Competition:"#dd7e3e", You:"#d35f73"
  };
  function citeColor(c){ return CITE_COLOR[c] || OTHER_LIGHT; }
  /* core's citeName in miniature: the RPC's raw keys are not what the app shows. */
  var CITE_LABEL = {
    UGC_Community:"UGC / Community", Knowledge_Base:"Knowledge-Base", Brand_Platform:"Brand Platforms"
  };
  function citeLabel(c){ return CITE_LABEL[c] || String(c || "").replace(/_/g, " "); }
  function isDarkTheme(){ return root.getAttribute("data-theme") === "dark"; }
  /* core's tint(), same maths -- a hex plus an alpha, so the chip fill is the type's own colour at
     12% rather than a neutral grey that ignores the type entirely. */
  function tint(hex, a){
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h.split("").map(function(x){ return x + x; }).join("");
    var n = parseInt(h, 16);
    return "rgba(" + ((n>>16)&255) + "," + ((n>>8)&255) + "," + (n&255) + "," + a + ")";
  }
  /* The chip the TABLES draw: colour on a tinted ground in light, colour on the flat dark chip
     ground in dark. URL types carry a leading dot, citation types never do -- that is what keeps
     the two vocabularies apart at a glance when they sit next to each other. Geometry copied from
     core.css's .up-tag; the class is local because core.css is not loaded here. */
  function tagHtml(label, color, base, withDot){
    var bg = isDarkTheme() ? CHIP_BG_DARK : tint(base, 0.12);
    return '<span class="mqa-tag" style="color:' + color + ';background:' + bg + '">' +
             (withDot ? '<span class="mqa-tag-dot" style="background:' + color + '"></span>' : '') +
             '<span class="mqa-tag-lbl">' + esc(label) + '</span>' +
           '</span>';
  }
  function citeDot(c){ return '<span class="mqa-ct-dot" style="background:' + citeColor(c) + '"></span>'; }
  function colorDot(color){ return '<span class="mqa-ct-dot" style="background:' + color + '"></span>'; }
  var MARKETS = ["de","us","gb","at","ch","fr","es","it","nl"];   // override via MiraQuickActions.setMarkets([...])
  var BRANDS  = [];                                               // fed in on page load via MiraQuickActions.setBrands([...])
  /* ...ODER aus dem seitenweiten Store in core. Das Abo weiter unten liefert normalerweise; das
     hier ist der ZWEITE Weg, und er ist der verlaesslichere: er fragt genau in dem Moment nach,
     in dem die Liste gebraucht wird, statt sich darauf zu verlassen, dass zum Zeitpunkt des
     Abonnierens schon alles an seinem Platz war. Auf einer Bubble-Seite haengt die Reihenfolge
     von core.js, dieser Datei, dem Page-Load-Workflow und einem moeglichen Rebuild des
     Wurzelelements an zu vielen Faedeln, um sie zu garantieren -- und ein Push, der einmal
     danebengeht, ist danach fuer immer weg. Ein Pull kann das nicht passieren.
     Ueberschreibt eine bereits gefuellte Liste nicht: wer setBrands() selbst ruft, behaelt sie. */
  function pullBrands(){
    if (BRANDS.length) return;
    try {
      var UCg = window.UpstreemCore;
      if (UCg && UCg.getBrands){
        var l = UCg.getBrands();
        if (l && l.length) api.setBrands(l);
      }
    } catch(_){}
  }
  /* "No brands loaded" hat drei voellig verschiedene Ursachen, und alle drei sahen bisher gleich
     aus -- man konnte an der Palette nicht ablesen, ob core zu alt ist, ob die Seite nie Marken
     gesetzt hat, oder ob der Store voll ist und nur hier nichts ankommt. Genau das ist die Art
     stiller Ausfall, die eine Fehlersuche zum Raten macht. */
  function brandsEmpty(){
    var UCg = window.UpstreemCore;
    if (!UCg) return { txt: "Core not loaded", why: "window.UpstreemCore is missing on this page." };
    if (!UCg.getBrands) return {
      txt: "Brand store missing — update this element's CDN pin",
      why: "This page's core.js predates the page-wide brand store. The data-cdn-pin on the " +
           "Quick Actions element still points at an older commit."
    };
    var n = 0, st = null;
    try { n = (UCg.getBrands() || []).length; } catch(e){}
    try { st = UCg.storeStats ? UCg.storeStats() : null; } catch(e){}
    if (!n){
      /* Der Zaehler im Store trennt die beiden Faelle, die bisher gleich aussahen. */
      if (st && st.brands.calls === 0) return {
        txt: "No brands set on this page",
        why: "setUpstreemBrands() has NEVER run on this page (0 calls). For comparison: " +
             "setUpstreemTopics ran " + st.topics.calls + "x, setUpstreemMarkets " +
             st.markets.calls + "x. If those are 0 too, this page runs none of the three — the " +
             "Run-JS step is on another page or reusable. If only brands is 0, the step exists " +
             "but does not cover this page."
      };
      if (st && st.brands.rejected) return {
        txt: "Brand list could not be read",
        why: "setUpstreemBrands() ran " + st.brands.calls + "x but " + st.brands.rejected +
             " call(s) had a payload core could not parse — check the Run-JS step's argument."
      };
      return {
        txt: "No brands set on this page",
        why: "The page-wide store is empty" + (st ? " after " + st.brands.calls + " call(s)" : "") +
             " — the call ran with an empty list, or it ran before core.js and threw."
      };
    }
    return {
      txt: "Brands not reaching the palette",
      why: "The store holds " + n + " brands but this palette has none — the pull in pullBrands() " +
           "did not take. Two core.js copies under different data-cdn-pin values would do this."
    };
  }
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
    if (kind === "types")    return CITATION_TYPES.map(function(t){ return { label: citeLabel(t), value: t, dot: citeColor(t) }; });
    if (kind === "urltypes") return URL_TYPES.map(function(t){ return { label: urlTypeLabel(t), value: t, dot: urlTypeColor(t) }; });
    if (kind === "markets") return MARKETS.map(function(m){
      return { label: String(m).toUpperCase(), value: m,
               av: "https://flagcdn.com/" + String(m).toLowerCase() + ".svg", avKind: "flag" };
    });
    if (kind === "brands")  return BRANDS.map(function(b){
      return { label: b.name, value: (b.id != null && b.id !== "") ? b.id : b.name,
               av: b.logo || b.favicon || "", avKind: "brand" };
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
  /* ---------- reference: the in-app glossary ----------
     Sits ABOVE Actions in the same wrapper, so its visibility is Actions' visibility and cannot
     drift from it: shown while idle and underneath results, hidden only in command mode ("/"),
     where the whole panel belongs to the filter menu.

     Every entry is one metric or one closed vocabulary. Clicking slides its explanation open; the
     optional button underneath drops the reader straight into the palette query that shows the
     thing being described, so reading and doing are one click apart.

     `chips` is the list itself where the vocabulary IS the answer (citation types, URL types) --
     rendered from the SAME constants the palette filters use above, never retyped. A hand-copied
     second list is how a glossary starts lying: the day a type is added to URL_TYPES, this section
     gains it too, or it is visibly missing from both.

     `apply` mirrors what a user could type: { scope:"url", rank:"top" } is exactly /urls /top. */
  var REF = [
    {
      id: "citation-types",
      label: "Citation Types",
      hint: function(){ return CITATION_TYPES.length + " kinds"; },
      body: "Citation Type classifies the SOURCE of a cited URL. Every URL an AI answer cites receives " +
            "exactly one type. Use it to see which kinds of sources the answers about you are built from.",
      chips: function(){
        return CITATION_TYPES.map(function(t){
          var col = citeColor(t);
          return { label: citeLabel(t), color: col, base: col, dot: false };
        });
      },
      apply: { scope: "domain", rank: "top" },
      applyLabel: "Show top domains"
    },
    {
      id: "url-types",
      label: "URL Types",
      hint: function(){ return URL_TYPES.length + " kinds"; },
      body: "URL Type classifies the cited PAGE itself, independently of who published it. A competitor's " +
            "pricing page and a magazine's ranking list are both citations, but they are different kinds " +
            "of page and different opportunities. Citation Type describes the source, URL Type describes " +
            "the page.",
      chips: function(){
        return URL_TYPES.map(function(t){
          return { label: urlTypeLabel(t), color: urlTypeColor(t), base: urlTypeBase(t), dot: true };
        });
      },
      apply: { scope: "url", rank: "top" },
      applyLabel: "Show top URLs"
    },
    {
      id: "share",
      label: "Share",
      hint: "%",
      body: "Share is the percentage of all citations in the selected period that point to one URL, " +
            "domain or brand. Shares across all rows sum to 100%. A rising share means gaining ground " +
            "relative to everything else, not simply being cited more often. Domain Share applies the " +
            "same calculation inside a single domain: the percentage of that domain's own citations " +
            "carried by one URL.",
      apply: { scope: "domain", rank: "top" },
      applyLabel: "Show top domains"
    },
    {
      id: "trend",
      label: "Trend",
      hint: "▲ ▼",
      body: "Trend compares the selected period against the preceding period of equal length. A 30 day " +
            "range is compared against the 30 days before it. Values are percentage points, not percent " +
            "of the previous value: a move from 6% to 8% is shown as +2, never as +33%. No chip is shown " +
            "when the change rounds to zero. "
    },
    {
      id: "rank",
      label: "Rank",
      hint: "lower is better",
      body: "Rank is the average position your brand takes within an answer that mentions it. Position 1 " +
            "is the first brand named. Lower is better, so the trend chip is inverted: a falling rank " +
            "number is displayed as a positive move. Values are shown to one decimal because typical " +
            "changes are smaller than a full position.",
      apply: { scope: "brand", rank: "top" },
      applyLabel: "Show brands by rank"
    },
    {
      id: "sentiment",
      label: "Sentiment",
      hint: "0 – 100",
      body: "Sentiment scores how positively your brand is described, on a scale from 0 to 100, where 50 " +
            "is neutral. It is measured only in answers that mention your brand, so it carries no " +
            "information about how often that happens. Read it alongside Visibility, not instead of it. "
    },
    {
      id: "visibility",
      label: "Visibility",
      hint: "%",
      body: "Visibility is the percentage of runs for a prompt in which your brand was mentioned at all. " +
            "20% means one answer in five named you. Visibility measures reach. Rank and Sentiment " +
            "describe what happened inside the answers that did mention you.",
      apply: { scope: "prompt", rank: "top" },
      applyLabel: "Show top prompts"
    },
    {
      id: "prompts-responses",
      label: "Prompts vs Responses",
      hint: "1 : many",
      body: "A Prompt is the question you track. A Response is one model's answer to that prompt at one " +
            "point in time. Each prompt collects one response per model per run, so the relationship is " +
            "one to many. All aggregates in the app are computed across responses and displayed against " +
            "the prompt. This is why a prompt's numbers change without the prompt itself being edited. "
    },
    {
      id: "brand-mentions",
      label: "Brand Mentions",
      hint: "own vs competitor",
      body: "Brand Mentions lists which tracked brands appear on a cited page. Your own brand and your " +
            "competitors are stored the same way and differ only by role, so a single page can carry " +
            "both. Pages that mention competitors but not you are usually the ones worth acting on.",
      apply: { scope: "url" },
      applyLabel: "Show URLs"
    },
    {
      id: "topics",
      label: "Topics",
      hint: "Or / And",
      body: "Topics are your own labels on prompts. The app never creates them. Filtering by two topics " +
            "in Or mode returns prompts carrying either topic. And mode returns only prompts carrying " +
            "both, which is usually a much smaller set. "
    },
    {
      id: "models",
      label: "Models",
      hint: "Single / Multi",
      body: "Model identifies which LLM produced a response. Single select compares one model against the " +
            "full picture. Multi select pools several models into one number. Models often disagree about " +
            "which sources to cite, so a metric that looks flat across all models can hide a large " +
            "movement inside one of them. "
    }
  ];
  var REF_BY_ID = {}; REF.forEach(function(r){ REF_BY_ID[r.id] = r; });
  var refOpen = null;       // id of the entry currently expanded: one at a time, like an accordion
  /* Reference ALWAYS starts collapsed, on every open of the palette. Deliberately not persisted:
     the palette is opened to do something, and a section of documentation is not that. Actions is
     the opposite case and does persist, see below. */
  var refListOpen = false;
  /* One-shot: true only for the render right after a section was opened. Without it every rebuild
     re-ran the expand keyframes, so closing an ENTRY made the whole list visibly spring open again
     underneath it -- the animation was correct, it was just firing on renders that were not an
     opening. Reset by refHtml/buildStatic as soon as the markup carrying it is out. */
  var animSection = "";
  /* Actions, on the other hand, is a real preference: someone who never uses those four entries
     should not have to collapse them again on every page. localStorage, wrapped because Bubble can
     run this in contexts where storage throws (private mode, a sandboxed iframe). */
  var ACT_KEY = "mqa_actions_open";
  var actionsOpen = (function(){
    try { return window.localStorage.getItem(ACT_KEY) !== "0"; } catch(e){ return true; }
  })();
  function persistActions(){
    try { window.localStorage.setItem(ACT_KEY, actionsOpen ? "1" : "0"); } catch(e){}
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
  /* Export laeuft ueber DIESELBE Komponente wie ueberall sonst: window.upstreemExportOpen mit der
     Kennung aus data-export-instance. Frueher feuerte hier nur bubble_fn_qa_export_data, also ein
     eigener Weg fuer dieselbe Sache -- und der oeffnete keinen Dialog, sondern was auch immer auf
     Bubble-Seite daran haengt.
     Gibt es keine Kennung oder keine Export-Komponente auf der Seite, bleibt es beim alten Event:
     eine bestehende Verdrahtung darf durch diese Aenderung nicht ausfallen. */
  function oeffneExport(){
    var id = String((root.getAttribute("data-export-instance") || "")).trim();
    if (!id || id === "EXPORT_INSTANCE_ID") return false;
    var fn = window.upstreemExportOpen || (window.parent && window.parent.upstreemExportOpen) ||
             (window.top && window.top.upstreemExportOpen);
    if (typeof fn !== "function"){
      if (window.console) console.warn("[quick-actions] window.upstreemExportOpen nicht gefunden — liegt die Export-Komponente auf dieser Seite, und ist ihr Element SICHTBAR?");
      return false;
    }
    try { fn(id); } catch(_){ return false; }
    return true;
  }
  // one distinct event per static action (no value)
  function fireStatic(action){
    var base = { add_new_prompt:"qa_add_prompt", add_new_brand:"qa_add_brand", export_data:"qa_export_data", edit_your_brand:"qa_edit_brand" }[action];
    if (!base) return;
    /* Entweder Dialog ODER altes Event -- nie beides, sonst laeuft der Export doppelt. */
    if (action === "export_data" && oeffneExport()){
      try { window.dispatchEvent(new CustomEvent("mira_" + base)); } catch(_){}
      return;
    }
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
  /* istFlagge: eine Flagge ist quer, das 30er-Quadrat der Zeilen-Kachel schneidet sie zuerst auf
     ein Quadrat zu. Bei Deutschland faellt das nicht auf, bei den USA bleibt das Sternenfeld
     uebrig. Mit is-flag bekommt sie die Querformat-Kachel, die das Untermenue schon hat. */
  function avHtml(src, fbInner, istFlagge){
    var kl = "mqa-av" + (istFlagge ? " is-flag" : "");
    if (!src) return '<span class="' + kl + ' is-fb">' + fbInner + '</span>';
    return '<span class="' + kl + '"><img src="' + escAttr(src) + '" alt="" loading="lazy" ' +
      'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-fb\');">' +
      '<span class="mqa-av-fb">' + fbInner + '</span></span>';
  }
  function letter(name){ var s = String(name || "").trim(); return s ? '<span class="mqa-av-t">' + esc(s.charAt(0).toUpperCase()) + '</span>' : GLOBE; }

  // what the number actually means depends on the type:
  //   url/domain -> share of citations, brand -> share of voice, prompt -> your own visibility
  var METRIC_LABEL = { url: "Share", domain: "Share", brand: "Share", prompt: "Visibility" };
  var ARR_UP   = '<svg viewBox="0 0 24 24"><path d="M7 7h10v10" /> <path d="M7 17 17 7" /></svg>';
  var ARR_DOWN = '<svg viewBox="0 0 24 24"><path d="m7 7 10 10" /> <path d="M17 7v10H7" /></svg>';
  var DASH     = '<svg viewBox="0 0 24 24"><path d="M5 12h14" /></svg>';
  // per-row "more" menu — see rowHtml()/the row-menu block near the bottom of this file
  var MORE_SVG   = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
  var OPEN_SVG   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14" /> <path d="m12 5 7 7-7 7" /></svg>';
  var NEWTAB_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6" /> <path d="M10 14 21 3" /> <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>';
  /* Lucide pin -- fuer "Pin to sidebar" im Zeilenmenue. */
  var PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>';
  function trendHtml(v){
    if (v == null || v === "" || isNaN(Number(v))) return '<span class="mqa-trend is-flat">' + DASH + '</span>';   // no trend
    var n = Number(v), a = Math.abs(n);
    if (a === 0) return '<span class="mqa-trend is-flat">' + DASH + '</span>';         // no change
    var txt = UC.fmtPct(a);   // >0 but rounding to 0 prints "<1%" — see UC.fmtPct
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
      '<span class="mqa-rowmenu-btn" role="button" tabindex="-1" aria-label="More options" aria-haspopup="true">' + MORE_SVG + '</span>' +
      '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg></span>' +
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

  /* The reference list. One row per entry; the expanded body is a sibling DIV rather than a child
     of the button, because a <button> may not contain another <button> and the body carries one. */
  function refHtml(){
    /* Collapsed by default, and it has to be: eleven rows opened straight into the palette turned
       the first thing you see into a wall of documentation, above the four Actions people actually
       came for. One row now, expanding to the list on click. */
    /* Kein Trenner mehr ueber Reference: der Abstand macht die Trennung, siehe .mqa-actions-wrap
       in der CSS. Eine Linie DAZU war eine Aussage zu viel. */
    var html = '<div class="mqa-group mqa-refgroup' +
               (refListOpen ? " is-expanded" : "") + '">' +
      '<button class="mqa-action mqa-ref mqa-reftop" type="button" role="option" data-reflist="1"' +
              ' aria-expanded="' + (refListOpen ? "true" : "false") + '">' +
        '<span class="mqa-action-ic mqa-ref-ic">' +
          /* Feather "book-open", the same glyph the dashboard header's Docs button carries. Taken
             from the set rather than drawn here: a hand-made icon never quite matches the stroke
             weight and optical size of the ones around it. */
          '<svg viewBox="0 0 24 24"><path d="M12 5v16" /> <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" /></svg>' +
        '</span>' +
        '<span class="mqa-main"><span class="mqa-primary">Reference</span></span>' +
        '<span class="mqa-ref-chev">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>' +
        '</span>' +
      '</button>';
    if (!refListOpen) return html + '</div>';
    html += '<div class="mqa-fade' + (animSection === "ref" ? " is-anim" : "") + '">';
    REF.forEach(function(r){
      var on = (refOpen === r.id);
      var hint = (typeof r.hint === "function") ? r.hint() : (r.hint || "");
      html += '<div class="mqa-ref-item' + (on ? " is-open" : "") + '">' +
        '<button class="mqa-action mqa-ref" type="button" role="option" data-ref="' + escAttr(r.id) + '"' +
                ' aria-expanded="' + (on ? "true" : "false") + '">' +
          '<span class="mqa-main"><span class="mqa-primary">' + esc(r.label) + '</span></span>' +
          (hint ? '<span class="mqa-action-hint">' + esc(hint) + '</span>' : '') +
          '<span class="mqa-ref-chev">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>' +
          '</span>' +
        '</button>';
      /* Only the OPEN entry's body is in the DOM. The alternative — every body present and hidden
         by CSS — puts eleven paragraphs and two full colour legends into the palette on every
         idle render, and the palette re-renders on every keystroke. */
      if (on){
        /* .mqa-ref-inner is what the grid track collapses: a grid item can animate from 0fr to
           1fr, its own padding cannot. All the body's content therefore lives one level down. */
        html += '<div class="mqa-ref-body"><div class="mqa-ref-inner">' +
                  '<p class="mqa-ref-text">' + esc(r.body) + '</p>';
        if (r.chips){
          /* Same constants the palette's own /citation-type and /url-type menus read, drawn with
             the same tagHtml() the rest of this file now uses -- so a type looks identical here,
             in the filter menu, and in the tables. A hand-copied second list is how a glossary
             starts lying. */
          html += '<div class="mqa-ref-chips">';
          r.chips().forEach(function(c){ html += tagHtml(c.label, c.color, c.base, c.dot); });
          html += '</div>';
        }
        if (r.apply){
          html += '<button class="mqa-ref-go" type="button" data-refgo="' + escAttr(r.id) + '">' +
                    esc(r.applyLabel || "Show me") +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>' +
                  '</button>';
        }
        html += '</div></div>';
      }
      html += '</div>';
    });
    return html + '</div></div>';
  }

  /* Turns a reference entry's `apply` into the same palette state the user could have typed —
     { scope:"url", rank:"top" } is /urls /top. Deliberately routed through the existing FILTERS +
     afterFilterChange() path rather than firing something of its own, so the button cannot drift
     away from what the commands do. */
  function applyRef(id){
    var r = REF_BY_ID[id];
    if (!r || !r.apply) return;
    for (var slot in FILTERS) if (Object.prototype.hasOwnProperty.call(FILTERS, slot)) FILTERS[slot] = null;
    for (var k in r.apply) if (Object.prototype.hasOwnProperty.call(r.apply, k)) FILTERS[k] = r.apply[k];
    refOpen = null;                       // the reader is done reading — collapse behind them
    input.value = ""; query = ""; syncPh();
    renderChips(); buildStatic(); afterFilterChange();
    try { input.focus(); } catch(_){}
  }
  function toggleRefList(){
    refListOpen = !refListOpen;
    animSection = refListOpen ? "ref" : "";
    /* Immer nur eine der beiden Sektionen offen. Beide gleichzeitig ergeben eine Liste, die
       laenger ist als das Panel, und dann sieht man von der gerade geoeffneten nichts mehr. */
    /* OHNE persistActions: dass Actions hier zuklappt, ist eine Folge des Platzes, keine
       Entscheidung des Nutzers. Vorher wurde genau das gespeichert -- ein einziger Blick in die
       Referenzen liess Actions beim naechsten Oeffnen zugeklappt, obwohl aufgeklappt der
       Standard ist. */
    if (refListOpen && actionsOpen) actionsOpen = false;
    /* Collapsing the section also collapses whatever entry was open inside it, so reopening starts
       from the list rather than from someone else's half-read paragraph. */
    if (!refListOpen) refOpen = null;
    buildStatic();
    refreshRows();
  }
  function toggleRef(id){
    /* Closing gets a real collapse rather than a disappearance: keep the body in the DOM, run the
       reverse keyframes on it, and only rebuild once they are done. Rebuilding immediately is what
       made closing feel like a cut while opening slid. */
    if (refOpen === id){
      var body = actionsWrap.querySelector(".mqa-ref-item.is-open .mqa-ref-body");
      var item = actionsWrap.querySelector(".mqa-ref-item.is-open");
      if (body){
        if (item) item.classList.remove("is-open");     // chevron flips with the movement, not after
        body.classList.add("is-closing");
        var done = false;
        function finish(){
          if (done) return; done = true;
          refOpen = null; buildStatic(); refreshRows();
        }
        body.addEventListener("animationend", finish);
        /* Fallback for a browser that never fires the event (reduced-motion turns the animation
           off entirely, and then animationend legitimately never comes). */
        setTimeout(finish, 260);
        return;
      }
      refOpen = null;
    } else {
      refOpen = id;
    }
    buildStatic();
    refreshRows();                        // rows moved: the arrow-key ring has to be rebuilt
    var el = actionsWrap.querySelector('[data-ref="' + id + '"]');
    if (el && refOpen && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }

  function buildStatic(){
    var html = refHtml() +
      '<div class="mqa-group mqa-actgroup' + (actionsOpen ? " is-expanded" : "") + '">' +
      '<button class="mqa-action mqa-ref mqa-acttop" type="button" role="option" data-actlist="1"' +
              ' aria-expanded="' + (actionsOpen ? "true" : "false") + '">' +
        '<span class="mqa-action-ic mqa-ref-ic">' +
          /* Feather "command". NOT the zap glyph: that one is already "Add New Prompt", one row
             below inside this very group, and a head row wearing its own child's icon reads as a
             duplicate rather than as a heading. */
          '<svg viewBox="0 0 24 24"><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" /></svg>' +
        '</span>' +
        '<span class="mqa-main"><span class="mqa-primary">Actions</span></span>' +
        '<span class="mqa-ref-chev">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6" /></svg>' +
        '</span>' +
      '</button>';
    if (!actionsOpen){ actionsWrap.innerHTML = html + '</div>'; animSection = ""; return; }
    html += '<div class="mqa-fade' + (animSection === "act" ? " is-anim" : "") + '">';
    STATIC.forEach(function(a){
      html += '<button class="mqa-action" type="button" role="option" data-action="' + a.action + '">' +
        '<span class="mqa-action-ic">' + a.icon + '</span>' +
        '<span class="mqa-main"><span class="mqa-primary">' + esc(a.label) + '</span></span>' +
        (a.hint ? '<span class="mqa-action-hint">' + esc(a.hint) + '</span>' : '') +
        '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg></span>' +
      '</button>';
    });
    html += '</div></div>';
    actionsWrap.innerHTML = html;
    animSection = "";
  }
  function toggleActions(){
    actionsOpen = !actionsOpen;
    animSection = actionsOpen ? "act" : "";
    if (actionsOpen && (refListOpen || refOpen)){ refListOpen = false; refOpen = null; }
    persistActions();
    buildStatic();
    refreshRows();
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
  var CLOCK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
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

  /* ---------- favourite searches ----------
     The one thing here that outlives the session. Recent Searches are deliberately in-memory only
     (see above), but a favourite is an explicit act, so it goes to localStorage — keyed by team, so
     switching teams switches the list instead of leaking one team's saved filters into another.
     localStorage can throw outright (Safari private mode, blocked third-party storage inside
     Bubble's iframe preview), so every access is wrapped: a failure degrades to "no favourites",
     never to a broken palette. */
  var FAV_MAX = 5;
  var STAR = '<svg viewBox="0 0 24 24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></svg>';
  var favEl = overlay.querySelector("#mqa-fav");
  function favStoreKey(){ return "mqa_fav_" + (TEAM || "_"); }
  function favLoad(){
    try {
      var raw = window.localStorage.getItem(favStoreKey());
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.slice(0, FAV_MAX) : [];
    } catch(_){ return []; }
  }
  function favSave(list){
    try { window.localStorage.setItem(favStoreKey(), JSON.stringify(list.slice(0, FAV_MAX))); } catch(_){}
  }
  // the search as it stands right now — same shape as a recent entry, so recentKey/miniChips fit both
  function currentEntry(){
    return { query: query, scope: FILTERS.scope || "", rank: FILTERS.rank || "", type: FILTERS.type || "",
             urltype: FILTERS.urltype || "", market: FILTERS.market || "", mentioning: FILTERS.mentioning || "" };
  }
  function isFav(e){ var k = recentKey(e); return favLoad().some(function(x){ return recentKey(x) === k; }); }
  // the star only makes sense once a search actually ran — in idle/command mode there is nothing
  // to save yet, and the same emptiness check recentPush uses keeps a blank palette out of the list
  function favApplicable(){
    if (state === "idle" || state === "commands") return false;
    return !!(query || anyFilter());
  }
  function toggleFav(){
    if (!favApplicable()) return;
    var e = currentEntry(), k = recentKey(e);
    var list = favLoad(), had = list.some(function(x){ return recentKey(x) === k; });
    list = list.filter(function(x){ return recentKey(x) !== k; });
    if (!had) list.unshift(e);
    favSave(list);
    syncFav();
  }
  function syncFav(){
    if (!favEl) return;
    var on = favApplicable();
    favEl.classList.toggle("is-hidden", !on);
    var saved = on && isFav(currentEntry());
    favEl.classList.toggle("is-on", saved);
    favEl.setAttribute("aria-pressed", saved ? "true" : "false");
    favEl.setAttribute("aria-label", saved ? "Remove Favorite" : "Save as Favorite");
  }
  if (favEl) favEl.addEventListener("click", function(e){ e.stopPropagation(); toggleFav(); input.focus(); });

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
  var ENTER_CHEV = '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg></span>';
  function entryLineHtml(e){
    return '<span class="mqa-main"><span class="mqa-primary mqa-recent-line">' + miniChips(e) +
      (e.query ? '<span class="mqa-recent-q">' + esc(e.query) + '</span>' : '') + '</span></span>';
  }
  function recentRowHtml(e, i){
    return '<button class="mqa-action" type="button" role="option" data-recent="' + i + '">' +
      '<span class="mqa-recent-ic">' + CLOCK + '</span>' + entryLineHtml(e) +
      '<span class="mqa-recent-x" role="button" tabindex="-1" data-recent-rm="' + i + '" aria-label="Remove">' + XSVG + '</span>' +
      ENTER_CHEV + '</button>';
  }
  // same row, but the leading icon doubles as the remove control: star at rest, x on hover — the
  // delete affordance the user asked for without spending a second slot on it
  function favRowHtml(e, i){
    return '<button class="mqa-action" type="button" role="option" data-fav="' + i + '">' +
      '<span class="mqa-fav-lead">' +
        '<span class="mqa-fav-ic">' + STAR + '</span>' +
        '<span class="mqa-fav-x" role="button" tabindex="-1" data-fav-rm="' + i + '" aria-label="Remove favorite">' + XSVG + '</span>' +
      '</span>' + entryLineHtml(e) + ENTER_CHEV + '</button>';
  }
  function renderRecent(){
    var list = recentLoad(), favs = favLoad();
    var h = "";
    function group(head, body){
      /* Kein Trenner mehr vor der ersten Gruppe: der Abstand unter dem Suchfeld trennt. Das war
         der letzte, der noch stand -- die beiden ueber Reference und Actions sind schon weg. */
      h += '<div class="mqa-group"><div class="mqa-group-head">' + head + '</div>' + body + '</div>';
    }
    if (_viewed.length) group("Recent", _viewed.map(function(it, i){ return viewedRowHtml(it, i); }).join(""));
    if (list.length)    group("Recent Searches", list.map(recentRowHtml).join(""));
    if (favs.length)    group("Favorites", favs.map(favRowHtml).join(""));
    recentEl.innerHTML = h;
  }
  // same shape as a result row, just smaller
  function viewedRowHtml(item, i){
    var av = "", primary = "", secondary = "";
    if (item.type === "brand"){ av = avHtml(item.logo, letter(item.name)); primary = esc(item.name || ""); }
    else if (item.type === "domain"){ av = avHtml(item.favicon, GLOBE); primary = esc(item.domain || ""); }
    else if (item.type === "url"){ av = avHtml(item.favicon, GLOBE); primary = esc(item.title || item.url || ""); secondary = esc(item.url || ""); }
    else if (item.type === "prompt"){
      var mk = String(item.market || "").toUpperCase();
      av = avHtml(item.market ? ("https://flagcdn.com/" + String(item.market).toLowerCase() + ".svg") : "",
                  '<span class="mqa-av-t">' + esc(mk) + '</span>', true);
      primary = esc(item.prompt_text || ""); secondary = mk ? ("Market · " + esc(mk)) : "";
    }
    return '<button class="mqa-row is-mini" type="button" role="option" data-viewed="' + i + '">' +
      av +
      '<span class="mqa-main"><span class="mqa-primary">' + primary + '</span>' +
        (secondary ? '<span class="mqa-secondary">' + secondary + '</span>' : '') +
      '</span>' +
      '<span class="mqa-type">' + (TYPE_SINGULAR[item.type] || "") + '</span>' +
      '<span class="mqa-rowmenu-btn" role="button" tabindex="-1" aria-label="More options" aria-haspopup="true">' + MORE_SVG + '</span>' +
      '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg></span>' +
    '</button>';
  }
  function applyEntry(e){
    if (!e) return;
    FILTERS = { scope:e.scope || null, rank:e.rank || null, type:e.type || null, urltype:e.urltype || null, market:e.market || null, mentioning:e.mentioning || null };
    query = e.query || ""; input.value = query;
    renderChips(); syncPh();
    if (query.length >= MIN || FILTERS.rank) runSearch(); else renderIdle();
    input.focus();
  }
  function applyRecent(i){ applyEntry(recentLoad()[i]); }
  function applyFav(i){ applyEntry(favLoad()[i]); }
  recentEl.addEventListener("click", function(ev){
    var rm = ev.target.closest ? ev.target.closest("[data-recent-rm]") : null;
    if (rm){
      ev.stopPropagation();
      var list = recentLoad(); list.splice(+rm.getAttribute("data-recent-rm"), 1); recentSave(list);
      renderRecent(); refreshRows(); return;
    }
    var frm = ev.target.closest ? ev.target.closest("[data-fav-rm]") : null;
    if (frm){
      ev.stopPropagation();
      var favs = favLoad(); favs.splice(+frm.getAttribute("data-fav-rm"), 1); favSave(favs);
      renderRecent(); refreshRows(); return;
    }
  });
  function showRecent(on){ recentEl.style.display = on ? "" : "none"; }
  function showStatic(on){ actionsWrap.style.display = on ? "" : "none"; }
  function renderIdle(){
    showStatic(true); renderRecent(); showRecent(true);
    resultsEl.innerHTML = ""; state = "idle"; refreshRows();
    /* NICHTS ist vorausgewaehlt, wenn die Palette aufgeht. Vorher stand die Auswahl auf Zeile 0 --
       also auf "Reference", das damit hervorgehoben aussah, obwohl niemand dorthin gezeigt hat.
       Die Pfeiltasten laufen weiterhin von hier los (move(-1) springt ans Ende), und Enter loest
       ohne Auswahl nichts aus, was hier auch richtig ist: es gibt noch keine Zeile, die gemeint
       waere. */
    clearActive();
  }

  /* ---------- "Press Enter to search" ----------
     Chips alone don't run a search: without a query, the RPC needs a sort to have anything to
     return, which is what /top provides. So once there are chips but no /top or /trending, Enter
     (and the hint below the input, which is the same action with a mouse) fills that in and runs
     it. It only ever applies in the idle state — while the command list or a brand/type sub-list
     is open a row is highlighted, and Enter belongs to that row. */
  var ctaEl = overlay.querySelector("#mqa-entercta");
  function enterSearchOn(){ return state === "idle" && anyFilter() && !FILTERS.rank; }
  function enterSearch(){
    if (!enterSearchOn()) return;
    FILTERS.rank = "top";
    renderChips(); afterFilterChange();   // rank is set now -> afterFilterChange runs the search
    input.focus();
  }
  function syncCta(){ if (ctaEl) ctaEl.classList.toggle("is-hidden", !enterSearchOn()); }
  if (ctaEl) ctaEl.addEventListener("click", function(e){ e.preventDefault(); enterSearch(); });

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
  var XSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>';
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
  /* Marken- und Marktkachel, Geometrie wie in der Prompts-Table: die Marke bekommt die Kachel der
     Brand-Mentions (.up-stack-vis -- abgerundetes Quadrat, contain statt cover, damit ein breites
     Logo nicht beschnitten wird, Initial als Rueckfall), der Markt die Flaggenkachel (.upt-flag --
     flaches Rechteck, cover). Nachgebaut statt importiert: quick-actions.css laedt bewusst kein
     core.css und kennt die --vc-Tokens nicht, siehe Kopf dieser Datei. Die Groesse bleibt bei den
     bisherigen 20px, nur die Form kommt aus der Tabelle. */
  function avHtml(av, kind, label){
    if (kind === "flag"){
      return '<span class="mqa-cmd-av is-flag"><img src="' + escAttr(av) + '" alt="" loading="lazy"' +
             ' onerror="this.style.display=\'none\'"></span>';
    }
    var initial = String(label || "").charAt(0) || "?";
    return '<span class="mqa-cmd-av' + (av ? " has-img" : "") + '">' +
             '<span class="mqa-cmd-ltr">' + esc(initial) + '</span>' +
             (av ? '<img src="' + escAttr(av) + '" alt="" loading="lazy" referrerpolicy="no-referrer"' +
                   ' onerror="this.closest(\'.mqa-cmd-av\').classList.remove(\'has-img\'); this.remove()">' : "") +
           '</span>';
  }
  function cmdRowHtml(label, hint, attrs, av, avKind, dot){
    var lead = dot
      ? '<span class="mqa-cmd-dotwrap"><span class="mqa-ct-dot" style="background:' + escAttr(dot) + '"></span></span>'
      : ((av || avKind === "brand")
        ? avHtml(av, avKind, label)
        : '<span class="mqa-cmd-slash">/</span>');
    return '<button class="mqa-action" type="button" role="option" ' + attrs + '>' +
      lead +
      '<span class="mqa-main"><span class="mqa-primary"' + (dot ? ' style="color:' + escAttr(dot) + '"' : '') + '>' + esc(label) + '</span></span>' +
      (hint ? '<span class="mqa-cmd-hint">' + esc(hint) + '</span>' : '') +
      '<span class="mqa-enter"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg></span>' +
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
      /* Letzte Gelegenheit VOR dem Aufbau der Liste: der Store kann zwischen dem Oeffnen der
         Palette und diesem Tastendruck gefuellt worden sein. */
      if (cmd.sub === "brands" && !BRANDS.length) pullBrands();
      var opts = subOptions(cmd.sub).filter(function(o){ return !rest || o.label.toLowerCase().indexOf(rest) !== -1 || String(o.value).toLowerCase().indexOf(rest) !== -1; });
      var h1 = '<div class="mqa-group"><div class="mqa-group-head">' + esc(cmd.label) + '</div>';
      if (!opts.length){
        var msg = "No match";
        if (cmd.sub === "brands" && !BRANDS.length){
          var be = brandsEmpty(); msg = be.txt;
          if (window.console) console.warn("[quick-actions] /mentioning has no brands: " + be.why);
        }
        h1 += '<div class="mqa-empty">' + esc(msg) + '</div>';
      }
      opts.forEach(function(o){ h1 += cmdRowHtml(o.label, "", 'data-cmd="' + cmd.id + '" data-cmd-val="' + escAttr(o.value) + '"', o.av, o.avKind, o.dot); });
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
      h = '<div class="mqa-empty">' + (wantsScope ? "Pick a type first – URLs, Brands, Domains or Prompts" : "No command") + '</div>';
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
    /* A filter was applied, so the reader has moved on to results. Fold the reference away rather
       than leaving a paragraph open above them. Only rebuild when something actually changed --
       renderIdle() below does its own buildStatic(), and runSearch() must not lose the block. */
    if (collapseReference()) buildStatic();
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

  /* ---------- per-row "more" menu ----------
     Hover a result OR a Recent/Viewed row for a bit -> a "..." button slides in -> Open / Open
     in new tab. NOT on the static Actions or "Recent Searches" rows — those aren't single
     navigable items (no .type/id to build a drawer link from).

     Both source lists get a row-menu, so every row is tagged with WHICH list it came from
     ("result" = _rowData via data-ri, "viewed" = _viewed via data-viewed) rather than just an
     index — an index alone would be ambiguous between the two.

     Delegated on `scroll` AND `recentEl`, not bound per-row: rows get replaced wholesale on
     every render, so per-element listeners would need rebinding every time. mouseover/mouseout
     bubble (unlike mouseenter/mouseleave), which is what makes delegation possible here. */
  var ROWMENU_HOVER_MS = 750;
  var hoverTimer = null, hoverRowEl = null;
  var rowMenuOpenKind = null, rowMenuOpenIdx = null, rowMenuEl = null;

  function menuRowSel(){ return ".mqa-row[data-ri], .mqa-row[data-viewed]"; }
  function isOpenRow(rowEl){
    if (rowMenuOpenKind == null) return false;
    var attr = rowMenuOpenKind === "result" ? "data-ri" : "data-viewed";
    return rowEl.getAttribute(attr) === String(rowMenuOpenIdx);
  }
  function onRowHoverIn(e){
    var rowEl = e.target.closest ? e.target.closest(menuRowSel()) : null;
    if (!rowEl) return;
    if (rowEl === hoverRowEl) return;   // already tracking — mouseover keeps firing as the pointer crosses child elements
    clearTimeout(hoverTimer);
    if (hoverRowEl && !isOpenRow(hoverRowEl)) hoverRowEl.classList.remove("is-menuready");
    hoverRowEl = rowEl;
    hoverTimer = setTimeout(function(){ rowEl.classList.add("is-menuready"); }, ROWMENU_HOVER_MS);
  }
  function onRowHoverOut(e){
    var rowEl = e.target.closest ? e.target.closest(menuRowSel()) : null;
    if (!rowEl) return;
    if (e.relatedTarget && rowEl.contains(e.relatedTarget)) return;   // moved to a child, still inside the row
    if (rowEl !== hoverRowEl) return;
    clearTimeout(hoverTimer);
    hoverRowEl = null;
    if (!isOpenRow(rowEl)) rowEl.classList.remove("is-menuready");   // its dropdown is open -> keep the trigger visible
  }
  scroll.addEventListener("mouseover", onRowHoverIn);
  scroll.addEventListener("mouseout", onRowHoverOut);
  recentEl.addEventListener("mouseover", onRowHoverIn);
  recentEl.addEventListener("mouseout", onRowHoverOut);

  function itemForMenu(kind, idx){ return kind === "result" ? _rowData[idx] : _viewed[idx]; }
  function ensureRowMenu(){
    if (rowMenuEl) return rowMenuEl;
    rowMenuEl = document.createElement("div");
    rowMenuEl.className = "mqa-rowmenu";
    rowMenuEl.innerHTML =
      '<button class="mqa-rowmenu-opt" type="button" data-rowmenu-act="open">' +
        '<span class="mqa-rowmenu-opt-ic">' + OPEN_SVG + '</span>Open</button>' +
      '<button class="mqa-rowmenu-opt" type="button" data-rowmenu-act="newtab">' +
        '<span class="mqa-rowmenu-opt-ic">' + NEWTAB_SVG + '</span>Open in new tab</button>' +
      '<button class="mqa-rowmenu-opt" type="button" data-rowmenu-act="pin">' +
        '<span class="mqa-rowmenu-opt-ic">' + PIN_SVG + '</span>Pin to sidebar</button>';
    overlay.appendChild(rowMenuEl);
    rowMenuEl.addEventListener("click", function(e){
      var b = e.target.closest ? e.target.closest("[data-rowmenu-act]") : null;
      if (!b) return;
      e.stopPropagation();
      var kind = rowMenuOpenKind, idx = rowMenuOpenIdx, act = b.getAttribute("data-rowmenu-act");
      closeRowMenu();
      if (kind == null) return;
      if (act === "open"){
        if (kind === "result") selectResult(idx);
        else { var v = _viewed[idx]; if (v){ _rowData.push(v); selectResult(_rowData.length - 1); } }   // same path activate() already uses for a viewed row
      } else if (act === "newtab"){
        var it = itemForMenu(kind, idx); if (it) openItemInNewTab(it);
      } else if (act === "pin"){
        var it2 = itemForMenu(kind, idx); if (it2) pinToSidebar(it2);
      }
    });
    return rowMenuEl;
  }
  /* An die Sidebar uebergeben. Die Palette weiss nichts von ihr und soll es auch nicht: sie ruft
     eine globale Funktion, wenn es eine gibt. Liegt keine Sidebar auf der Seite, sagt sie das
     einmal in der Konsole statt stumm nichts zu tun.
     Uebergeben wird genau das, was die Leiste zum Zeichnen braucht -- Typ, Kennung, Beschriftung
     und Bild. Die Kennung ist dieselbe, die selectResult() an Bubble meldet, damit ein Klick in
     der Leiste denselben Wert liefert wie ein Klick in der Palette. */
  function pinToSidebar(it){
    var typ = it.type, id = "", label = "", logo = "";
    if (typ === "brand"){       id = it.id;     label = it.name || "";            logo = it.logo || ""; }
    else if (typ === "domain"){ id = it.domain; label = it.domain || "";          logo = it.favicon || ""; }
    else if (typ === "url"){    id = it.url;    label = it.title || it.url || ""; logo = it.favicon || ""; }
    else if (typ === "prompt"){ id = it.id;     label = it.prompt_text || "";
      /* Beim Prompt ist die Flagge des Marktes das Bild -- dieselbe Quelle wie in der Zeile. */
      logo = it.market ? ("https://flagcdn.com/" + String(it.market).toLowerCase() + ".svg") : ""; }
    else return;
    var fn = window.upstreemPinToSidebar ||
             (window.parent && window.parent.upstreemPinToSidebar) ||
             (window.top && window.top.upstreemPinToSidebar);
    if (typeof fn !== "function"){
      if (window.console) console.warn("[quick-actions] keine Sidebar auf dieser Seite -- " +
        "window.upstreemPinToSidebar fehlt, der Eintrag wurde nicht angeheftet.");
      return;
    }
    try { fn({ type: typ, id: String(id == null ? "" : id), label: label, logo: logo }); } catch(e){}
    close();
  }

  function positionRowMenu(btn){
    var r = btn.getBoundingClientRect(), t = rowMenuEl.getBoundingClientRect();
    var pad = 8, left = r.right - t.width;
    left = Math.max(pad, Math.min(left, window.innerWidth - t.width - pad));
    var top = r.bottom + 6;
    if (top + t.height > window.innerHeight - pad) top = r.top - t.height - 6;   // flip above if needed
    rowMenuEl.style.left = Math.round(left) + "px"; rowMenuEl.style.top = Math.round(top) + "px";
  }
  function onRowMenuOutside(e){
    if (!rowMenuEl || rowMenuEl.contains(e.target)) return;
    if (e.target.closest && e.target.closest(".mqa-rowmenu-btn")) return;   // its own toggle click, handled separately
    closeRowMenu();
  }
  function openRowMenu(kind, idx, btn){
    ensureRowMenu();
    if (rowMenuOpenKind != null) closeRowMenu();
    rowMenuOpenKind = kind; rowMenuOpenIdx = idx;
    btn.classList.add("is-open");
    var rowEl = btn.closest(".mqa-row"); if (rowEl) rowEl.classList.add("is-menuopen");
    rowMenuEl.classList.add("is-on");
    positionRowMenu(btn);
    document.addEventListener("mousedown", onRowMenuOutside, true);
  }
  function closeRowMenu(){
    if (rowMenuOpenKind == null) return;
    rowMenuOpenKind = null; rowMenuOpenIdx = null;
    if (rowMenuEl) rowMenuEl.classList.remove("is-on");
    var openBtn = modal.querySelector(".mqa-rowmenu-btn.is-open"); if (openBtn) openBtn.classList.remove("is-open");
    var openRow = modal.querySelector(".mqa-row.is-menuopen"); if (openRow) openRow.classList.remove("is-menuopen");
    document.removeEventListener("mousedown", onRowMenuOutside, true);
  }

  /* Reads the CURRENT page's own ?view= (same param the app's view-system already writes) and
     the app's ?detail=<type>:<value> drawer convention. Base URL always comes from
     location.origin + location.pathname — never a hardcoded host/path — so this produces a
     correct link on both the version-test environment and production without touching this file.
     Any drawer already open on the current page is deliberately dropped: "open in new tab" means
     exactly the current view plus ONE fresh drawer, never a stack of whatever was open here. */
  function detailValueFor(it){
    if (it.type === "brand")  return it.id;
    if (it.type === "domain") return it.domain;
    if (it.type === "url")    return it.url;
    if (it.type === "prompt") return it.id;
    return null;
  }
  function detailUrl(it){
    var val = detailValueFor(it); if (val == null || val === "") return null;
    var u;
    try { u = new URL(window.location.origin + window.location.pathname); } catch(_){ return null; }
    var view = null; try { view = new URL(window.location.href).searchParams.get("view"); } catch(_){}
    if (view) u.searchParams.set("view", view);
    u.searchParams.set("detail", it.type + ":" + val);
    return u.toString();
  }
  function openItemInNewTab(it){
    var url = detailUrl(it); if (!url) return;
    viewedPush(it.type, it);   // still "viewed" it, just not in this tab
    try { window.open(url, "_blank", "noopener"); } catch(_){}
  }

  /* ---------- keyboard selection ---------- */
  function refreshRows(){
    clearTimeout(hoverTimer); hoverRowEl = null; closeRowMenu();   // stale rows are about to be replaced
    // results and actions are separate containers now -> query the modal (DOM order keeps results first).
    // only rows that are actually on screen: the actions block is hidden in command mode, and
    // keyboard nav must not run through invisible entries
    modal.classList.toggle("has-results", !!resultsEl.children.length);
    rows = Array.prototype.slice.call(modal.querySelectorAll(".mqa-row, .mqa-action"))
      .filter(function(el){ return el.offsetParent !== null; });
    // every render funnels through here, and both of these depend only on state+filters
    syncCta(); syncFav();
  }
  function clearActive(){ activeIndex = -1; for (var k = 0; k < rows.length; k++) rows[k].classList.remove("is-active"); }
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
    if (el.hasAttribute("data-fav")){ applyFav(+el.getAttribute("data-fav")); return; }
    if (el.hasAttribute("data-cmd")){ applyCommand(el.getAttribute("data-cmd"), el.getAttribute("data-cmd-val")); return; }
    /* Before the .mqa-action branch below: a reference row carries that class too (it is the same
       row shape) but must expand instead of firing a Bubble action and closing the palette. */
    if (el.hasAttribute("data-actlist")){ toggleActions(); return; }
    if (el.hasAttribute("data-reflist")){ toggleRefList(); return; }
    if (el.hasAttribute("data-ref")){ toggleRef(el.getAttribute("data-ref")); return; }
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
    /* Sobald gesucht wird, ist das Glossar im Weg: es steht ueber den Treffern und schiebt sie
       aus dem Blick. Nur anfassen, wenn wirklich etwas offen ist -- onInput laeuft bei jedem
       Tastendruck, und ein buildStatic() pro Anschlag waere verschenkt. */
    if (raw && (refListOpen || refOpen)){
      refListOpen = false; refOpen = null; animSection = "";
      buildStatic();
    }
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
  function collapseReference(){
    if (!refListOpen && !refOpen) return false;
    refListOpen = false; refOpen = null;
    return true;
  }
  function open(){
    if (isOpen) return; isOpen = true;
    pullBrands();
    /* Erst alles andere zumachen. Ein Dropdown, das in einem Drawer geoeffnet wurde, liegt im
       Top Layer des Browsers -- und der schlaegt jede z-index-Zahl, auch die 2147483647 dieses
       Overlays. Es lag damit VOR der Palette. Die Palette ist ein Vollbild-Modus: dahinter soll
       ohnehin nichts offen bleiben, also ist Zumachen die richtige Antwort und nicht ein weiterer
       Stapelungs-Trick. core.js verweigert das Eskalieren zusaetzlich, solange dieses Overlay
       .is-open traegt (siehe menuEscape/paletteOpen). */
    try {
      var UCg = window.UpstreemCore;
      if (UCg && UCg.closePopovers) UCg.closePopovers(null, null);
      if (UCg && UCg.closeAllDropdowns) UCg.closeAllDropdowns();
    } catch(_){}
    overlay.setAttribute("data-theme", root.getAttribute("data-theme") || "light");
    // always bring to the very front: move to the end of <body> (wins ties at equal z-index) + max z-index
    try { document.body.appendChild(overlay); } catch(_){}
    /* Top Layer statt z-index -- siehe .mqa-overlay[popover] in der CSS. "manual", weil Escape
       und der Aussenklick das Schliessen schon selbst erledigen. Feature-erkannt: ohne
       showPopover bleibt alles wie zuvor. */
    if (typeof overlay.showPopover === "function"){
      try { overlay.setAttribute("popover", "manual"); overlay.showPopover(); } catch(_){}
    }
    overlay.style.zIndex = "2147483647";
    overlay.classList.add("is-open"); overlay.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", onKeydown, true);
    /* Always closed on open: the palette is for doing, not for reading. buildStatic() has to run
       here explicitly -- renderIdle() below only toggles the block's visibility and re-renders the
       results area, it does not rebuild the Actions markup, so without this the section would come
       back exactly as the previous session left it. */
    collapseReference();
    buildStatic();
    renderIdle();
    setTimeout(function(){ try { input.focus(); input.select(); } catch(_){} }, 20);
  }
  function close(){
    closeRowMenu(); hideBtip();
    recentPush(); _lastCompleted = null;
    if (!isOpen) return; isOpen = false;
    overlay.classList.remove("is-open"); overlay.setAttribute("aria-hidden", "true");
    if (overlay.hasAttribute("popover") && typeof overlay.hidePopover === "function"){
      try { overlay.hidePopover(); } catch(_){}
    }
    document.removeEventListener("keydown", onKeydown, true);
    clearAll();
  }
  /* ---------- filter tooltip: hover "/ for filters" ---------- */
  /* Format der Spalten-Explainer aus dem Core (.up-explain): dunkle Karte, helle Beispielplatte
     oben, darunter Ueberschrift und ein Fliesstext, mit einer Spitze auf das Element, das sie
     geoeffnet hat. Vorher war das hier ein eigenes Tooltip-Format -- heller Grund, drei Absaetze,
     eigene Rundung -- und damit das einzige Erklaerfeld der App, das anders aussah.
     Die Farben stehen literal da, wie im Core auch: die Karte haengt ausserhalb der Wurzel, die
     Variablen der Komponente reichen nicht bis hierher. Genau daran war die dunkle Variante des
     Core-Explainers schon einmal unsichtbar geworden. */
  var tipEl = document.createElement("div");
  tipEl.className = "mqa-tip";
  tipEl.innerHTML =
    '<div class="mqa-tip-vis">' +
      '<div class="mqa-tip-flow">' +
        '<span class="mqa-tip-key">/</span><span class="mqa-tip-arrow">→</span>' +
        '<span class="mqa-mini">URLs</span><span class="mqa-tip-arrow">→</span>' +
        '<span class="mqa-mini">Type You</span>' +
      '</div>' +
    '</div>' +
    '<div class="mqa-tip-h">Filters</div>' +
    '<div class="mqa-tip-t">Type / to pick what you are looking for, then stack filters like ' +
      '/type, /market or /mentioning. Every pick becomes a chip; keep typing to search inside ' +
      'them, backspace removes the last one.</div>';
  overlay.appendChild(tipEl);
  function showTip(){
    if (!phCmdEl) return;
    /* Das Theme muss mitwandern: die Karte haengt am Overlay, nicht an der Wurzel, und der
       Core-Explainer schaltet ueber genau dieses Attribut auf die helle Variante um. */
    try { tipEl.setAttribute("data-theme", root.getAttribute("data-theme") || "light"); } catch(e){}
    tipEl.classList.add("is-on");
    var r = phCmdEl.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
    var pad = 8, left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - t.width - pad));
    var top = r.bottom + 10, flip = false;                    // unter dem Hinweis
    if (top + t.height > window.innerHeight - pad){ top = r.top - t.height - 10; flip = true; }
    tipEl.classList.toggle("is-flipped", flip);
    tipEl.style.left = Math.round(left) + "px"; tipEl.style.top = Math.round(top) + "px";
    /* Die Spitze zeigt auf den Hinweis, nicht auf die Mitte der Karte -- bei angestossenem
       linken oder rechten Rand faellt beides auseinander. */
    tipEl.style.setProperty("--mqa-caret", Math.round(r.left + r.width / 2 - left) + "px");
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
    if (e.key === "Escape"){
      if (rowMenuOpenKind != null){ e.preventDefault(); closeRowMenu(); return; }   // close just the menu first
      e.preventDefault(); close(); return;
    }
    // terminal-style: on an untouched field, ArrowUp recalls the last search instead of moving the cursor
    if (e.key === "ArrowUp" && !input.value && !anyFilter() && recentLoad().length){
      e.preventDefault(); applyRecent(0); return;
    }
    if (e.key === "ArrowDown"){ e.preventDefault(); move(1); return; }
    if (e.key === "ArrowUp"){ e.preventDefault(); move(-1); return; }
    if (e.key === "Enter"){
      if (activeIndex >= 0 && rows[activeIndex]){ e.preventDefault(); activate(rows[activeIndex]); return; }
      if (enterSearchOn()){ e.preventDefault(); enterSearch(); }
      return;
    }
    if (e.key === "Backspace" && !input.value && anyFilter()){
      var order = ["mentioning","market","urltype","type","rank","scope"];                       // remove the most recent-ish first
      for (var i = 0; i < order.length; i++){ if (FILTERS[order[i]]){ FILTERS[order[i]] = null; break; } }
      pruneFilters(); e.preventDefault(); renderChips(); afterFilterChange(); return;
    }
  }

  /* ---------- button tooltips ----------
     The app-wide chip from core.css (.up-tip / UC.makeTooltips), rebuilt locally: this component
     deliberately never loads core, and the ".mqa-tip" above it is the big multi-line Filters
     explainer, not a label. Same visual contract as everywhere else -- dark card in BOTH themes
     (it floats above the page, not inside the surface), centred under the trigger, 8px below. */
  var btip = document.createElement("div");
  btip.className = "mqa-btip";
  overlay.appendChild(btip);
  var btipTimer = null;
  function showBtip(el, text){
    if (!text) return;
    btip.textContent = text;
    btip.classList.add("is-on");
    btip.style.left = "0px"; btip.style.top = "0px";
    var r = el.getBoundingClientRect(), t = btip.getBoundingClientRect();
    var vw = window.innerWidth || document.documentElement.clientWidth;
    btip.style.left = Math.max(6, Math.min(r.left + r.width / 2 - t.width / 2, vw - t.width - 6)) + "px";
    btip.style.top = (r.bottom + 8) + "px";
  }
  function hideBtip(){ clearTimeout(btipTimer); btipTimer = null; btip.classList.remove("is-on"); }
  // label is a function, not a string: the star's caption flips with its saved state
  function attachBtip(el, label){
    if (!el) return;
    function show(){ btipTimer = setTimeout(function(){ showBtip(el, label()); }, 260); }
    el.addEventListener("mouseenter", show);
    el.addEventListener("focus", show);
    el.addEventListener("mouseleave", hideBtip);
    el.addEventListener("blur", hideBtip);
    el.addEventListener("click", hideBtip);   // the button's own state just changed under the cursor
  }
  attachBtip(favEl, function(){ return favEl.classList.contains("is-on") ? "Remove Favorite" : "Save as Favorite"; });
  attachBtip(clearEl, function(){ return "Reset"; });

  /* ---------- wiring ---------- */
  if (trigger) trigger.addEventListener("click", open);
  input.addEventListener("input", onInput);
  overlay.addEventListener("mousedown", function(e){ if (e.target === overlay) close(); });   // click outside
  // results, recent and actions live in three separate containers -> listen on the modal
  modal.addEventListener("click", function(e){
    var menuBtn = e.target.closest ? e.target.closest(".mqa-rowmenu-btn") : null;
    if (menuBtn){
      e.stopPropagation();   // do NOT also activate() the row underneath
      var rowEl = menuBtn.closest(".mqa-row");
      var kind = null, idx = -1;
      if (rowEl){
        if (rowEl.hasAttribute("data-ri")){ kind = "result"; idx = +rowEl.getAttribute("data-ri"); }
        else if (rowEl.hasAttribute("data-viewed")){ kind = "viewed"; idx = +rowEl.getAttribute("data-viewed"); }
      }
      if (rowMenuOpenKind === kind && rowMenuOpenIdx === idx) closeRowMenu(); else openRowMenu(kind, idx, menuBtn);
      return;
    }
    /* The "show me" button inside an expanded reference body. Checked BEFORE the row lookup below,
       because it sits in the .mqa-ref-item next to the row that opened it — without this the click
       would fall through to that row and collapse the entry the user just acted on. */
    var refGo = e.target.closest ? e.target.closest("[data-refgo]") : null;
    if (refGo){ e.stopPropagation(); applyRef(refGo.getAttribute("data-refgo")); return; }
    var el = e.target.closest ? e.target.closest(".mqa-row, .mqa-action") : null; if (el) activate(el);
  });
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
      /* Type chips carry their colour as an INLINE style, computed from the theme at render time,
         so unlike everything else in this component they do not follow a data-theme flip on their
         own. Rebuild the block that holds them; a switch with the reference section open otherwise
         leaves the chips in the previous theme's palette. */
      buildStatic();
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
      /* Feldnamen: die Palette hiess sie schon immer id/name/logo, der seitenweite Brand-Store in
         core liefert company_id/name/logo_url. Beide werden gelesen, statt beim Abonnieren unten
         zu mappen -- so nimmt setBrands() jede der beiden Formen an, egal wer sie schickt. */
      BRANDS = Array.isArray(list) ? list.filter(Boolean).map(function(b){
        return { id: b.id != null ? b.id : (b.company_id != null ? b.company_id : ""),
                 name: String(b.name || b.label || ""),
                 logo: b.logo || b.favicon || b.logo_url || b.favicon_url || "" };
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
  /* Und aus dem seitenweiten Store speisen. MiraQuickActions.setBrands() bleibt bestehen und
     funktioniert unveraendert -- der Store liefert nur zusaetzlich, und nur wenn er etwas hat. */
  (function subscribeBrands(triesLeft){
    var UCg = window.UpstreemCore;
    /* core.js kann noch nicht da sein: die Palette laedt ueber denselben Loader, aber ein
       anderes Bubble-Element kann sie frueher einfuegen. Kurz nachfassen statt still nichts zu
       tun -- ohne das haette es keine Marken gegeben und die einzige Spur waere "No brands"
       gewesen. */
    if (!UCg || !UCg.brandsInto){
      /* Hier NICHT ensureCore() rufen. Das lief ab dem ersten Tastendruck der Seite und hat der
         Palette das Laderennen gegen die anderen Komponenten gewinnen lassen. Der verzoegerte
         Aufruf oben reicht: dieses Abo fasst 40 mal nach und ist noch da, wenn core spaeter kommt. */
      if (triesLeft > 0) setTimeout(function(){ subscribeBrands(triesLeft - 1); }, 150);
      return;
    }
    /* OHNE owner. brandsInto raeumt ein Abo weg, sobald sein owner nicht mehr im Dokument
       haengt -- richtig fuer eine Komponente pro Placement, falsch fuer diese hier: die Palette
       ist ein Singleton auf window, und Bubble ersetzt ihr Wurzelelement bei jeder Aenderung
       eines dynamischen Ausdrucks. Mit root als owner war das Abo nach dem ersten Rebuild weg,
       und ein spaeteres setUpstreemBrands() erreichte sie nicht mehr. */
    UCg.brandsInto(null, function(list){ api.setBrands(list); });
  })(40);

  window.MiraQuickActions = api;
  /* Nachholen, was waehrend des Ladens aufgelaufen ist -- in der Reihenfolge, in der es kam.
     Ein Wurf in einem der Aufrufe darf die restliche Warteschlange nicht mitnehmen, aber auch
     nicht still verschwinden. */
  if (MQA_Q.length){
    var offen = MQA_Q.splice(0, MQA_Q.length);
    for (var qi = 0; qi < offen.length; qi++){
      try { api[offen[qi][0]].apply(api, offen[qi][1]); }
      catch(e){ if (window.console) console.warn("[MQA] vorgemerkter Aufruf " + offen[qi][0] +
        " ist fehlgeschlagen:", e); }
    }
    if (window.console) console.info("[MQA] " + offen.length + " vorgemerkte(r) Aufruf(e) nachgeholt.");
  }
})();
