/* upstreem prompt-research.js — component logic. Requires core.js (window.UpstreemCore) first.

   Migrated from the standalone prompt_research.html with the BEHAVIOUR left alone: every public
   method on window.upstreemPromptResearch, every bubble_fn_* call, every CustomEvent name and
   every payload key is byte-identical to the standalone. What changed is the surface — core
   tokens, core table/toolbar/dropdown classes — plus one structural change that was asked for:
   "Previous researches" is no longer an inline panel under the composer but a right-hand sidebar.

   Two deliberate departures from the usual component skeleton, both with precedent:

   1) No UC.makeMount. This is a page-level SINGLETON with a NAMESPACED api
      (window.upstreemPromptResearch.setPrompts, not a flat window.renderX), and makeMount assigns
      cfg.api onto window by key — flat names only. Same situation quick-actions is in, same
      answer: keep the namespace, and do the one thing makeMount would genuinely have bought us
      here by hand, which is the stub queue below.
   2) No feather-icons. The standalone pulled unpkg.com/feather-icons at runtime and called
      feather.replace() after every render; nothing else in this repo takes a third-party runtime
      dependency, and an icon library that has to re-scan the DOM after each paint is exactly the
      kind of thing that makes a Bubble page feel slow. Every icon is an inline SVG constant.

   The sidebar is a page-level drawer, portalled into <body> for the same reason the opportunities
   drawer is: position:fixed only means "relative to the viewport" while no ancestor has a
   transform/filter/will-change, and a Bubble wrapper usually has one. */
(function(){
  "use strict";

  /* ---------- stubs ----------
     Bubble calls these by name as soon as its own workflows run, which is regularly before
     core.js has finished loading. Queue everything and replay it in call order once the real
     implementations exist (STYLEGUIDE §25 step 2). */
  var API_NAMES = ["setRunning", "setIdle", "setError", "setComplete", "setPrompts",
                   "setResearchMeta", "setPreviousResearches", "openHistory", "closeHistory",
                   "setTags", "setActionLoading", "setBusy", "setTheme", "setMarkets",
                   "setMarket", "setBusinessModel", "setPersona"];
  var __uprBootQueue = window.__uprBootQueue = window.__uprBootQueue || [];
  if (!window.__uprBootStubbed){
    window.__uprBootStubbed = true;
    var ns = window.upstreemPromptResearch = window.upstreemPromptResearch || {};
    API_NAMES.forEach(function(n){
      if (typeof ns[n] !== "function") ns[n] = function(){ __uprBootQueue.push([n, arguments]); };
    });
  }

  function uprBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ uprBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uprRun();
    var UC = window.UpstreemCore;
    /* Bubble replaces this element's markup block once its dynamic expressions resolve; without
       this the replacement root would never be initialised. Same guard as every other component. */
    if (UC.watchRoots) UC.watchRoots("upr-root", uprRun);
    [100, 300, 800, 1800].forEach(function(ms){ setTimeout(uprRun, ms); });
  }

  function uprRun(){
    var roots = document.querySelectorAll(".upr-root:not(.upr-portal)");
    Array.prototype.forEach.call(roots, function(root){
      if (root.__uprInit) return;
      root.__uprInit = true;
      initRoot(root, window.UpstreemCore);
    });
  }

  /* ---------- icons ----------
     Inline, wie es die Standalone-Fassung von feather.replace() bekam. */
  var SVG_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
  function ic(body){ return SVG_OPEN + body + '</svg>'; }
  var ICON = {
    /* Das Bereichszeichen fuer Prompt Research -- dasselbe scan-search wie in der Navigation,
       nicht die allgemeine Lupe. Es sitzt im Start-Knopf, solange eine Recherche laeuft. */
    search:      ic('<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
                    '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
                    '<circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>'),
    clock:       ic('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
    x:           ic('<path d="M18 6 6 18" /> <path d="m6 6 12 12" />'),
    trash:       ic('<path d="M10 11v6" /> <path d="M14 11v6" /> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /> <path d="M3 6h18" /> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />'),
    send:        ic('<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>'),
    chevronDown: ic('<path d="m6 9 6 6 6-6" />'),
    chevronUp:   ic('<path d="m18 15-6-6-6 6" />'),
    arrowLeft:   ic('<path d="m12 19-7-7 7-7" /> <path d="M19 12H5" />'),
    alignLeft:   ic('<path d="M21 5H3" /> <path d="M15 12H3" /> <path d="M17 19H3" />'),
    more:        ic('<circle cx="12" cy="12" r="1" /> <circle cx="19" cy="12" r="1" /> <circle cx="5" cy="12" r="1" />'),
    checkCircle: ic('<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
    /* Lucide "tags" statt "tag" -- siehe core. */
    tag:         ic('<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/><path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="6.5" cy="9.5" r=".5" fill="currentColor"/>'),
    briefcase:   ic('<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>'),
    user:        ic('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    check:       ic('<path d="M20 6 9 17l-5-5" />'),
    gotoArrow:   ic('<path d="M7 7h10v10" /> <path d="M7 17 17 7" />'),
    sliders:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="8" x2="20" y2="8"/><circle cx="9" cy="8" r="2.2"/><line x1="4" y1="16" x2="20" y2="16"/><circle cx="15" cy="16" r="2.2"/></svg>'
  };

  function initRoot(root, UC){
    /* Page header, built HERE and not in the Bubble template on purpose. That template is a
       fresh-install file: it is pasted once and later edits never reach a page that already
       exists. Adding this block there would have shipped nothing to the live page. Built from JS,
       it arrives with the CDN pin like every other fix.

       Uses the core Page Header Kit classes (.up-ph-*), so it is the same meta/heading/description
       block every other page in the app has -- not a lookalike that drifts on the next tweak. */
    (function buildPageHeader(){
      if (root.querySelector(".upr-pagehead")) return;
      var brand = (root.getAttribute("data-brand-name") || "").trim();
      if (brand === "BRAND_NAME") brand = "";
      var logo  = (root.getAttribute("data-brand-logo") || "").trim();
      if (logo === "BRAND_LOGO_URL") logo = "";

      var head = document.createElement("div");
      head.className = "up-ph-top upr-pagehead";
      head.innerHTML =
        '<div class="up-ph-left">' +
          '<div class="up-ph-meta">' +
            '<img class="up-ph-metalogo upr-ph-logo" alt=""' + (logo ? '' : ' style="display:none"') + '/>' +
            '<span class="up-ph-metatxt"><span class="upr-ph-brand"></span>Workspace</span>' +
          '</div>' +
          '<h1 class="up-ph-heading">Prompt Research</h1>' +
          '<p class="up-ph-desc">Find the prompts your audience actually asks AI, and turn the ones worth owning into tracked prompts.</p>' +
        '</div>';
      root.insertBefore(head, root.firstChild);

      /* Bubble resolves these dynamic expressions AFTER the root is mounted -- it patches the
         attribute in place rather than replacing the node -- so a one-shot read at init would
         show an empty brand forever. Same observer every page header in this repo runs. */
      var logoEl  = head.querySelector(".upr-ph-logo");
      var brandEl = head.querySelector(".upr-ph-brand");
      function syncBrand(){
        var n = (root.getAttribute("data-brand-name") || "").trim();
        if (n === "BRAND_NAME") n = "";
        /* The trailing space belongs to the NAME, not to the markup: without a name the meta line
           has to read "Workspace", not " Workspace". */
        brandEl.textContent = n ? n + " " : "";
        var l = (root.getAttribute("data-brand-logo") || "").trim();
        if (l === "BRAND_LOGO_URL") l = "";
        if (l){ logoEl.src = l; logoEl.style.display = ""; }
        else { logoEl.removeAttribute("src"); logoEl.style.display = "none"; }
      }
      syncBrand();
      new MutationObserver(syncBrand).observe(root, {
        attributes: true, attributeFilter: ["data-brand-name", "data-brand-logo"]
      });
    })();

    /* The top-right action belongs to the PAGE, not to the start screen: it was absolutely
       positioned inside .upr-content, so the new page header pushed it down with it. Lifted to
       the root, where the CSS pins it to 16px from the top and right like every other page's. */
    function liftHistoryButton(){
      /* Any depth: in the template it sits under .upr-shell, not .upr-content -- a child selector
         quietly matched nothing on the first attempt. */
      var btn = root.querySelector(".upr-history-entry");
      if (btn && btn.parentElement !== root) root.appendChild(btn);
    }
    /* Called again on a timer because later init steps re-render the shell and put the button back
       where the markup had it -- verified: the class set on the line below was present while the
       button had returned to .upr-shell. Cheap and idempotent: once it is a child of the root the
       call does nothing. */
    liftHistoryButton();
    setTimeout(liftHistoryButton, 0);
    setTimeout(liftHistoryButton, 400);

    /* data-head-top="0" (or any CSS length) trims the space above the meta row, for a placement
       where the Bubble element already brings its own top spacing. Default stays 16px, the value
       core.css gives every page header. */
    (function headTop(){
      var v = (root.getAttribute("data-head-top") || "").trim();
      if (!v) return;
      root.style.setProperty("--upr-head-top", /^-?[0-9.]+$/.test(v) ? v + "px" : v);
    })();

    /* Top-left of the page is this component's, so it carries the mobile sidebar clearance. */
    root.classList.add("up-sidebar-clear");
    if (UC.widthTiers) UC.widthTiers(root);


  /* ---------- element handles ---------- */
  var textarea            = root.querySelector('.upr-textarea');
  var composerEl          = root.querySelector('.upr-composer');
  var clearInputButton    = root.querySelector('#upr-clear-input');
  var settingsToggle      = root.querySelector('#upr-settings-toggle');
  var settingsPanel       = root.querySelector('#upr-settings-panel');
  var startButton         = root.querySelector('#upr-start-button');
  var suggestionsEl       = root.querySelector('#upr-suggestions');
  var resultsStage        = root.querySelector('#upr-results-stage');
  var resultsBody         = root.querySelector('#upr-results-body');
  var resultsCount        = root.querySelector('#upr-results-count');
  var resultsHeading      = root.querySelector('#upr-results-heading');
  var resultsContext      = root.querySelector('#upr-results-context');
  var tableMenu           = root.querySelector('#upr-table-menu');
  var tableMenuPopover    = root.querySelector('#upr-table-menu-popover');
  var acceptWithTagsBtn   = root.querySelector('#upr-accept-with-tags');
  var tableMenuTrigger    = root.querySelector('#upr-table-menu-trigger');
  var acceptAllButton     = root.querySelector('#upr-accept-all-prompts');
  var deleteAllButton     = root.querySelector('#upr-delete-all-prompts');
  var historyList         = root.querySelector('#upr-history-list');
  /* grabbed BEFORE the portal move below — after it, root.querySelector no longer reaches
     anything inside the sidebar. */
  var historyCountEl      = root.querySelector('#upr-history-count');
  /* Label + icon are patched from here rather than left to the markup: the root markup lives in a
     Bubble HTML element the user pasted once, so a change in bubble/prompt_research_bubble.html
     only reaches a FRESH install. From JS the CDN pin alone carries it. Idempotent by nature. */
  (function(){
    /* Die Seitenleiste aus core (panelLeft), GESPIEGELT: die Liste der Recherchen faehrt von
       rechts herein, die Leiste der App von links. Dasselbe Zeichen fuer dieselbe Sache, nur zur
       richtigen Seite gedreht. Vorher stand hier die runde Sprechblase -- die sagt "Chat" und
       nicht "Liste, die von der Seite kommt". */
    /* Die FORMEN aus core, nicht aus einer Kopie: icon() liefert ein ganzes svg, gebraucht wird
       hier nur sein Inhalt (das svg der Vorlage bleibt stehen, es traegt Groesse und Strichbreite
       aus der CSS des Knopfes). */
    var LEISTE = (function(){
      if (!UC || !UC.icon) return "";
      var h = document.createElement('div');
      h.innerHTML = UC.icon('panelLeft', 2);
      return h.firstChild ? h.firstChild.innerHTML : "";
    })();
    ['#upr-open-history', '#upr-open-history-results'].forEach(function(sel){
      var btn = root.querySelector(sel);
      if (!btn) return;
      var svg = btn.querySelector('svg');
      if (svg && LEISTE){ svg.innerHTML = LEISTE; svg.classList.add('upr-leiste-ic'); }
      /* Only the text node carries the label -- replacing it directly leaves the <svg> alone,
         which innerHTML/textContent on the button would not. */
      for (var i = 0; i < btn.childNodes.length; i++){
        var n = btn.childNodes[i];
        if (n.nodeType === 3 && n.nodeValue.trim()) { n.nodeValue = 'Previous Researches'; return; }
      }
    });
  })();

  /* Das Zeichen in der Kugel oben in der Mitte: lucide "telescope", dasselbe, das Prompt Research
     jetzt in der Seitenleiste und im Seitenkopf traegt. Vorher stand hier lucide "scan-search" --
     das war das letzte Zeichen der alten Familie. Getauscht wird im JS und nicht nur in der
     Vorlage: eine Vorlagenaenderung erreicht ein schon eingebautes Bubble-Element nicht. */
  /* NICHT nur einmal. Das Markup dieser Komponente gehoert Bubble, und Bubble zeichnet seine
     Gruppen ueber jQuery.html() neu -- danach steht im Kasten wieder das Zeichen aus der Vorlage,
     und bei einem Element, das vor dem Wechsel auf das Teleskop eingebaut wurde, ist das das alte.
     Deshalb wird der Stempel wiederholt: beim Start, in den ersten drei Sekunden gestaffelt, und
     bei jedem Wechsel des Zustands (siehe setResearchState). Geschrieben wird nur, wo etwas
     anderes steht -- ein Schreibvorgang ist selbst eine Mutation. */
  function fernrohrSetzen(){
    if (!UC || !UC.icon) return;
    var svg = UC.icon('telescope', 2);
    if (!svg) return;
    /* BEIDE Mitten, und die alte Ladekugel dazu: die Startseite traegt .upr-research-orb, das
       Ladebild .upr-l2-mark -- und ein Element, das schon vor dem Umbau des Ladebilds in Bubble
       eingebaut wurde, traegt dort noch .upr-loader-core mit dem alten scan-search. Das Ladebild
       baut ladebildSetzen zwar neu, aber nur wenn es .upr-loading-inner findet; fehlt die, bleibt
       die alte Kugel stehen. Ein Selektor mehr kostet nichts und schliesst genau diese Luecke. */
    [].forEach.call(root.querySelectorAll('.upr-research-orb, .upr-l2-mark, .upr-loader-core'),
      function(el){ if (el.innerHTML.indexOf('10.065') < 0) el.innerHTML = svg; });
  }
  fernrohrSetzen();
  [60, 250, 700, 1500, 3000].forEach(function(ms){ setTimeout(fernrohrSetzen, ms); });

  /* Das Ladebild: dasselbe Bild wie im ZWEITEN Ladeschirm des Onboardings (uob-load.is-compact) --
     Kachel, Name, Unterzeile, Balken, Satz, Marken. Die Werte sind von dort uebernommen und nicht
     nachempfunden: Kachel 44px mit Radius 13, Zeichen 30px, Name 18px/600, Unterzeile 13px,
     Balken 3px hoch und hoechstens 320 breit.
     Vorher schwebte hier ein Kasten zwischen zwei pulsenden Ringen ueber zwei Skelettbalken --
     drei Bewegungen, die nichts ueber den Stand sagten.
     Gebaut wird im JS und nicht nur in der Vorlage: eine Vorlagenaenderung erreicht ein schon
     eingebautes Bubble-Element nicht. Die zwei Anker der Animation (#upr-tl-tags und
     #upr-think-text) stehen wieder drin, damit startLoaderAnim unveraendert weiterlaeuft. */
  (function ladebildSetzen(){
    var innen = root.querySelector('.upr-loading-inner');
    if (!innen) return;
    var zeichen = (UC && UC.icon) ? UC.icon('telescope', 2) : '';
    innen.innerHTML =
      '<div class="upr-l2-mark">' + zeichen + '</div>' +
      '<div class="upr-l2-name" id="upr-l2-name">Prompt research</div>' +
      '<div class="upr-l2-sub" id="upr-l2-sub"></div>' +
      '<div class="upr-bar"><span class="upr-bar-fill" id="upr-bar"></span></div>' +
      /* Der Satz steht hier als fester Text und nicht als LOADER_PHRASES[0]: die Liste wird
         weiter unten in der Datei angelegt und ist an dieser Stelle noch undefined -- var wird
         hochgezogen, sein Wert nicht. Die Schleife setzt den Satz ohnehin neu, sobald sie
         laeuft; das hier ist nur, was ohne laufende Recherche dasteht. */
      '<div class="upr-think-loop"><span class="upr-think-text" id="upr-think-text">' +
        'Understanding your intent…</span></div>' +
      '<div class="upr-tl-tags" id="upr-tl-tags"></div>';
  })();

  var openHistoryButton   = root.querySelector('#upr-open-history');
  var closeHistoryButton  = root.querySelector('#upr-close-history');
  var openHistoryResultsButton = root.querySelector('#upr-open-history-results');
  var backToStartButton   = root.querySelector('#upr-back-to-start');

  /* ---------- sidebar ----------
     Scrim and panel stay INSIDE this component, exactly the way Ask Mira's "Previous chats" panel
     works (.am-prev-scrim / .am-prev-panel live in #ask-mira, and #ask-mira.prev-open drives them).
     They used to be moved into a host div on <body> so the drawer could span the whole page; that
     host turned out to be a liability. Its harmlessness depended entirely on prompt-research.css
     being on the page -- that file supplies its display:contents plus the position/hidden rules on
     scrim and panel -- and without it the closed panel rendered as a plain static block at the end
     of <body>, adding real height and letting the page scroll past the end of the app. Keeping the
     panel in the component removes that whole failure mode: whatever the stylesheet does or does
     not do, it can only ever affect this component's own box, which core.css already bounds.
     `portal` stays as the name for the element carrying the side-open / side-in state classes --
     it is the root now, so .upr-root.side-open still matches without a single selector changing. */
  var portal = root;
  var sideScrim = root.querySelector('.upr-side-scrim');
  var sidePanel = root.querySelector('.upr-side');

  /* Same idea for the history button: Ask Mira's "View Previous Chats" sits at the very top right
     of the component, and this one should too. It is authored inside .upr-content (a centred
     900px column, so its top-right is not the component's top-right), so move it up to .upr-shell
     and let the CSS pin it -- that way the Bubble markup does not have to change. */
  (function(){
    var histEntry = root.querySelector('.upr-history-entry');
    var shell = root.querySelector('.upr-shell');
    if (histEntry && shell && histEntry.parentElement !== shell) shell.appendChild(histEntry);
  })();

  /* ---------- Hoehe des Startbereichs ----------------------------------------------------
     justify-content: center zentriert den Inhalt in der Hoehe des Kastens -- und der Kasten war
     nur so hoch wie sein Inhalt. Damit stand die Ueberschrift direkt unter der Kopfzeile, nicht
     in der Mitte der Seite: die Zentrierung lief ins Leere.

     Der Kasten bekommt jetzt als Mindesthoehe, was unterhalb seiner Oberkante noch auf den
     Bildschirm passt. GEMESSEN und nicht als fester Wert: ueber der Komponente steht je nach
     Seite eine verschieden hohe Kopfzeile, und ein geschaetzter Abzug waere auf der einen Seite
     zu gross und auf der anderen zu klein.

     Mindesthoehe und nicht Hoehe: waechst der Inhalt ueber den Bildschirm hinaus -- aufgeklappte
     Einstellungen, ein offenes Auswahlfeld -- waechst der Kasten mit und die Seite scrollt.
     Abgeschnitten wird nichts.

     LUFT_UNTEN ist der Rand, der unter dem Eingabefeld stehen bleibt, damit es nicht auf der
     Kante klebt. */
  var LUFT_UNTEN = 28;
  /* Was zuletzt WIRKLICH geschrieben wurde. Der Grund steht im Trace vom 24.08.: diese Funktion
     war mit 695ms auf 42 Aufrufe die teuerste der ganzen Seite -- 16.5ms JE AUFRUF, mehr als
     jede andere. Sie liest (getBoundingClientRect) und schreibt dann (style.minHeight), und
     genau diese Reihenfolge macht das Layout des Teilbaums bei jedem Aufruf ungueltig; der
     naechste Aufruf muss es komplett neu rechnen lassen.
     Der Witz daran: beim Ziehen der BREITE aendert sich weder innerHeight noch die Oberkante des
     Kastens. Es wurde also 42 Mal derselbe Wert geschrieben, und jeder dieser Schreibzugriffe war
     reine Layout-Vernichtung ohne jede Wirkung. Ein Vergleich davor kostet nichts und spart
     alles. */
  var letzteHoehe = -1;
  function heldenHoeheJetzt(){
    var shell = root.querySelector('.upr-shell');
    if (!shell) return;
    /* In der Ergebnis- und der Laufansicht setzt die CSS min-height auf 0 und laesst den Inhalt
       oben beginnen. Ein Inline-Wert wuerde diese Regel schlagen, also hier wieder loeschen. */
    if (root.classList.contains('is-results') || root.classList.contains('is-running')){
      if (letzteHoehe !== 0){ shell.style.minHeight = ''; letzteHoehe = 0; }
      return;
    }
    var oben = shell.getBoundingClientRect().top;
    var frei = Math.round((window.innerHeight || 0) - oben - LUFT_UNTEN);
    /* Ein verdeckter Tab meldet 0 -- dann lieber nichts setzen als eine 0-Hoehe schreiben. */
    if (!(frei > 0)) return;
    var wert = Math.max(520, frei);
    if (wert === letzteHoehe) return;          /* unveraendert -> NICHT anfassen */
    letzteHoehe = wert;
    shell.style.minHeight = wert + 'px';
  }
  /* Und zusaetzlich nur einmal pro Bild, nicht pro Resize-Ereignis: der Listener unten hing ohne
     jede Drosselung an 'resize', und das feuert schneller als der Schirm zeichnet. rAF plus
     Timer als Netz -- rAF allein feuert in einem Hintergrund-Tab nicht, dann bliebe die Hoehe
     stehen. */
  var heldenHoeheSetzen = (function(){
    var raf = 0, t = 0;
    function lauf(){
      if (raf){ try { cancelAnimationFrame(raf); } catch(e){} raf = 0; }
      if (t){ clearTimeout(t); t = 0; }
      heldenHoeheJetzt();
    }
    return function(){
      if (raf || t) return;
      if (window.requestAnimationFrame) raf = requestAnimationFrame(lauf);
      t = setTimeout(lauf, 32);
    };
  })();
  heldenHoeheSetzen();
  /* Bubble baut die Seite in Schueben auf: die Kopfzeile ueber der Komponente steht erst spaeter,
     und damit verschiebt sich die Oberkante des Kastens noch. */
  [120, 400, 1200].forEach(function(ms){ setTimeout(heldenHoeheSetzen, ms); });
  /* Gedrosselt: die Funktion misst und schreibt eine Hoehe. */
  if (window.UpstreemCore && window.UpstreemCore.aufResize) window.UpstreemCore.aufResize(heldenHoeheSetzen, { hoehe: true });
  else window.addEventListener('resize', heldenHoeheSetzen);

  /* ---------- state (unchanged from the standalone) ---------- */
  var fallbackMarkets = [
    { alpha2: 'DE', alpha3: 'DEU', name: 'Germany', flag_url: 'https://flagcdn.com/de.svg', prompt_count: 0 },
    { alpha2: 'US', alpha3: 'USA', name: 'United States', flag_url: 'https://flagcdn.com/us.svg', prompt_count: 0 },
    { alpha2: 'GB', alpha3: 'GBR', name: 'United Kingdom', flag_url: 'https://flagcdn.com/gb.svg', prompt_count: 0 }
  ];
  var state = { market: null, market_alpha2: null, market_alpha3: null, market_name: null, business_model: 'b2c', persona: '' };
  var currentSuggestedPrompts = [];
  var previousResearches = [];
  var suggestionTagsSource = null;
  var suggestionTagsExpanded = false;
  var SUGGESTION_TAGS_LIMIT = 15;
  var acceptWithTags = true;
  var currentResearchMeta = { keywords: [], market: null, market_name: null, business_model: null, persona: null };

  /* ---------- helpers ---------- */
  function esc(v){ return UC.esc ? UC.esc(v) : String(v == null ? '' : v); }
  /* UC.themeParam statt isYes: kennt core ein Thema, gewinnt core -- das Attribut ist nur die
     Momentaufnahme aus dem Lauf des Workflows. */
  function isDark(){ return UC.themeParam(root.getAttribute('data-isdark')) || root.getAttribute('data-theme') === 'dark'; }
  function readJsonScript(id, fallback){
    try {
      var tag = root.querySelector('#' + id) || document.getElementById(id);
      if (!tag) return fallback;
      var txt = (tag.textContent || '').trim();
      if (!txt || txt === 'MARKETS_JSON' || txt === 'SUGGESTED_KEYWORDS_JSON') return fallback;
      var parsed = JSON.parse(txt);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch(e){ return fallback; }
  }
  function makeColor(value, fallback){ var raw = String(value || fallback || '#6b7280').trim(); return raw.charAt(0) === '#' ? raw : '#' + raw; }
  function getMarkets(){ return readJsonScript('upr-markets-json', fallbackMarkets); }
  function getFlagUrlForMarket(market){
    var code = String(market || '').trim().toUpperCase();
    if (!code || code === 'LOCAL') return '';
    var found = getMarkets().find(function(m){ return String(m.alpha2 || '').toUpperCase() === code; });
    return found && found.flag_url ? String(found.flag_url) : 'https://flagcdn.com/' + code.toLowerCase() + '.svg';
  }
  function flagHtml(flagUrl, name){ return flagUrl ? '<img src="' + esc(flagUrl) + '" alt="' + esc(name || 'Flag') + '" loading="lazy">' : ''; }
  function parseKeywords(raw){
    if (Array.isArray(raw)) return raw.map(function(x){ return String(x || '').trim(); }).filter(Boolean);
    return String(raw || '').split(',').map(function(x){ return x.trim(); }).filter(Boolean);
  }
  function updateResearchContext(meta){
    if (!meta || typeof meta !== 'object') return;
    var input = meta.research_input && typeof meta.research_input === 'object' ? meta.research_input : {};
    var rawKeywords = meta.keywords != null ? meta.keywords : (meta.input_keywords != null ? meta.input_keywords : (meta.keywords_raw != null ? meta.keywords_raw : input.keywords));
    currentResearchMeta = {
      keywords: parseKeywords(rawKeywords),
      market: meta.market || meta.market_alpha2 || input.market || currentResearchMeta.market,
      market_name: meta.market_name || input.market_name || currentResearchMeta.market_name,
      business_model: meta.business_model || input.business_model || currentResearchMeta.business_model,
      persona: meta.persona || input.persona || currentResearchMeta.persona
    };
  }

  /* ---------- loader animation (unchanged) ---------- */
  var _uprLoadTimers = [];
  var LOADER_PHRASES = ['Understanding your intent…','Matching intent patterns…','Building prompt variations…','Estimating search volume…','Scoring & tagging prompts…'];
  function _uprClearLoad(){ _uprLoadTimers.forEach(function(t){ clearTimeout(t); clearInterval(t); }); _uprLoadTimers = []; }
  function _uprSrcTags(){ return Array.isArray(suggestionTagsSource) ? suggestionTagsSource.map(normalizeSuggestionTag).filter(Boolean) : []; }
  function _uprSelectedTags(){
    var kws = (currentResearchMeta && Array.isArray(currentResearchMeta.keywords)) ? currentResearchMeta.keywords : [];
    var src = _uprSrcTags();
    return kws.map(function(k){
      var f = src.find(function(t){ return String(t.name).toLowerCase() === String(k).toLowerCase(); });
      return f ? { name: k, color: makeColor(f.hex_light, '#6f737c'), emoji: f.emoji } : { name: k, color: 'var(--vc-third)', emoji: '' };
    });
  }
  function _uprPoolTags(){
    var src = _uprSrcTags();
    if (!src.length) src = ['Discovery','Comparison','Buying intent','How-to','Reviews','Alternatives','Pricing','Best-of'].map(function(n){ return { name: n, hex_light: '', emoji: '' }; });
    return src.map(function(t){ return { name: t.name, color: makeColor(t.hex_light, '#9ca3af'), emoji: t.emoji }; });
  }
  function _uprMakeTag(tp){
    var tag = document.createElement('span'); tag.className = 'upr-tl-tag';
    var dot = document.createElement('span'); dot.className = 'upr-tl-dot'; dot.style.background = tp.color || 'var(--vc-third)';
    var label = String(tp.name || '');
    if (label.length > 15) label = label.slice(0, 15) + '…';   // keep loader chips compact
    tag.title = String(tp.name || '');
    tag.appendChild(dot); tag.appendChild(document.createTextNode((tp.emoji ? tp.emoji + ' ' : '') + label));
    return tag;
  }
  function _uprLimitToRows(host, maxRows){
    var chips = Array.prototype.slice.call(host.children);
    if (!chips.length) return;
    var tops = [];
    chips.forEach(function(c){ var t = c.offsetTop; if (tops.indexOf(t) === -1) tops.push(t); });   // reading offsetTop forces layout
    if (tops.length <= maxRows) return;
    tops.sort(function(a, b){ return a - b; });
    var cutoff = tops[maxRows];
    chips.forEach(function(c){ if (c.offsetTop >= cutoff) host.removeChild(c); });
  }
  function _uprFitOneLine(host){
    var guard = 0;
    while (host.children.length > 1 && host.scrollWidth > host.clientWidth + 1 && guard++ < 40){ host.removeChild(host.lastChild); }
  }
  function _uprRevealOnce(host, items){
    host.classList.remove('is-loop');
    host.innerHTML = '';
    items.slice(0, 30).forEach(function(tp){ host.appendChild(_uprMakeTag(tp)); });
    _uprLimitToRows(host, 3);
    Array.prototype.slice.call(host.children).forEach(function(el, i){ _uprLoadTimers.push(setTimeout(function(){ el.classList.add('on'); }, 120 + i * 140)); });
  }
  function _uprLoopTags(host, pool, count){
    host.classList.add('is-loop');
    var i = 0;
    function batch(){
      host.innerHTML = '';
      var slice = []; for (var k = 0; k < count; k++) slice.push(pool[(i + k) % pool.length]);
      i = (i + count) % pool.length;
      slice.forEach(function(tp){ host.appendChild(_uprMakeTag(tp)); });
      _uprFitOneLine(host);
      var els = Array.prototype.slice.call(host.children);
      els.forEach(function(el, idx){ _uprLoadTimers.push(setTimeout(function(){ el.classList.add('on'); }, 200 + idx * 300)); });
      _uprLoadTimers.push(setTimeout(function(){ els.forEach(function(el){ el.classList.remove('on'); }); }, 3600));
      _uprLoadTimers.push(setTimeout(batch, 4400));
    }
    batch();
  }
  function _uprLoopText(el, phrases){
    var idx = 0; el.textContent = phrases[0];
    var iv = setInterval(function(){
      el.classList.add('is-out');
      _uprLoadTimers.push(setTimeout(function(){
        idx = (idx + 1) % phrases.length;
        el.style.transition = 'none'; el.classList.remove('is-out'); el.classList.add('is-in');
        el.textContent = phrases[idx]; void el.offsetWidth; el.style.transition = ''; el.classList.remove('is-in');
      }, 240));
    }, 2800);
    _uprLoadTimers.push(iv);
  }
  /* Der Balken. Das Onboarding faehrt seinen aus echten Serverphasen; hier gibt es keine, also
     laeuft er auf einer abflachenden Kurve gegen 92 Prozent und springt erst auf 100, wenn die
     Ergebnisse da sind. Nie von selbst auf 100: ein voller Balken, unter dem sich weiter etwas
     dreht, ist eine Luege ueber den Stand.
     620ms Takt, weil die CSS genau so lange auf eine neue Breite faehrt (uebernommen aus
     onboarding-page.css: .uob-bar-fill transition width 620ms linear) -- ein schnellerer Takt
     wuerde jede Fahrt abschneiden, ein langsamerer liesse den Balken stehen. */
  var BALKEN_TAKT = 620, BALKEN_ZIEL = 92, BALKEN_HALB = 26000;
  function balkenStarten(){
    var el = root.querySelector('#upr-bar');
    if (!el) return;
    var t0 = Date.now();
    el.style.width = '0%';
    var iv = setInterval(function(){
      var t = Date.now() - t0;
      el.style.width = (BALKEN_ZIEL * (1 - Math.exp(-t / BALKEN_HALB))).toFixed(1) + '%';
    }, BALKEN_TAKT);
    _uprLoadTimers.push(iv);
  }
  function balkenVoll(){
    var el = root.querySelector('#upr-bar');
    if (el) el.style.width = '100%';
  }
  /* Kachelzeile des Ladebilds: was gesucht wird, und wo. Ohne Schlagworte bleibt der Name die
     Ueberschrift der Seite -- behauptet wird nichts, was nicht dasteht. */
  function ladebildFuellen(){
    var name = root.querySelector('#upr-l2-name');
    var sub  = root.querySelector('#upr-l2-sub');
    var kws = (currentResearchMeta && Array.isArray(currentResearchMeta.keywords)) ? currentResearchMeta.keywords : [];
    if (name) name.textContent = kws.length ? kws.slice(0, 3).join(', ') : 'Prompt research';
    if (sub){
      var m = currentResearchMeta && (currentResearchMeta.market_name || currentResearchMeta.market);
      sub.textContent = m ? String(m) : '';
      sub.style.display = m ? '' : 'none';
    }
  }
  function startLoaderAnim(){
    stopLoaderAnim();
    var host = root.querySelector('#upr-tl-tags');
    var textEl = root.querySelector('#upr-think-text');
    ladebildFuellen();
    balkenStarten();
    if (host){ var sel = _uprSelectedTags(); if (sel.length) _uprRevealOnce(host, sel); else _uprLoopTags(host, _uprPoolTags(), 3); }
    if (textEl) _uprLoopText(textEl, LOADER_PHRASES);
  }
  function stopLoaderAnim(){ _uprClearLoad(); balkenVoll(); }

  /* ---------- research state ---------- */
  function setResearchState(nextState){
    var name = String(nextState || 'idle').toLowerCase();
    var isRunning = name === 'running';
    var isResults = name === 'results';
    var isError = name === 'error';
    root.setAttribute('data-research-state', name);
    /* The toolbar only exists in the results view, so its height can only be measured once that
       view is up — remeasure on every state change. applyStickyNow is a hoisted declaration and
       guards on stickyKit, so an early call before init finishes is a no-op rather than a throw. */
    setTimeout(applyStickyNow, 0);
    fernrohrSetzen();          /* nach einem Neuaufbau der Gruppe steht sonst wieder das alte Zeichen da */
    root.classList.toggle('is-running', isRunning);
    root.classList.toggle('is-results', isResults);
    root.classList.toggle('is-error', isError);
    /* Nach dem Umschalten, nicht davor: die Funktion liest genau diese Klassen. */
    heldenHoeheSetzen();
    if (textarea) textarea.disabled = isRunning;
    if (settingsToggle) settingsToggle.disabled = isRunning;
    if (startButton){
      startButton.disabled = isRunning;
      startButton.innerHTML = (isRunning ? ICON.search : ICON.send) + '<span>' + (isRunning ? 'Researching' : 'Start Research') + '</span>';
      startButton.classList.toggle('is-running', isRunning);
    }
    root.querySelectorAll('.upr-chip, .upr-dd-trigger, .upr-dd-option, .upr-dd-clear, .upr-dd-search').forEach(function(el){ if ('disabled' in el) el.disabled = isRunning; });
    if (isRunning && settingsPanel){ settingsPanel.classList.remove('is-open'); if (settingsToggle){ settingsToggle.setAttribute('aria-expanded', 'false'); settingsToggle.classList.remove('is-active'); } }
    if (tableMenu && !isResults) tableMenuPop.close();
    if (isRunning) startLoaderAnim(); else stopLoaderAnim();
  }

  /* ---------- cells ---------- */
  function clampVolume(value){ var n = Math.round(Number(value)); if (!isFinite(n)) return null; return Math.max(0, Math.min(100, n)); }
  function volumeLevel(value){ var n = clampVolume(value); if (n === null) return 0; if (n <= 25) return 1; if (n <= 50) return 2; if (n <= 75) return 3; return 4; }
  function renderVolume(value){
    var level = volumeLevel(value);
    var html = '<div class="upr-volume-wrap" data-tip="Estimated volume: ' + esc(value == null ? 'n/a' : value) + '"><div class="upr-volume-track">';
    for (var i = 1; i <= 4; i++) html += '<span class="upr-volume-seg ' + (i <= level ? 'is-filled level-' + level : '') + '"></span>';
    return html + '</div></div>';
  }
  function normalizePromptItem(item, index){
    var tags = Array.isArray(item.tags) ? item.tags : [];
    return {
      id: item.id || item.suggested_prompt_id || item.prompt_id || item.uuid || null,
      row_index: item.row_index == null ? index : item.row_index,
      prompt_text: String(item.prompt_text || item.text || '').trim(),
      market: String(item.market || '').trim(),
      estimated_volume: clampVolume(item.estimated_volume),
      tags: tags.map(function(t){
        return { tag_id: t.tag_id || t.id || null, name: t.name || t.tag_name || '', emoji: t.emoji || '',
                 hex_light: t.hex_light || t.hex_dark || '#6b7280', hex_dark: t.hex_dark || '' };
      }).filter(function(t){ return t.name; })
    };
  }
  /* core's .up-topicchip, the same chip the prompts table and the topics manager draw, instead of
     the standalone's parallel .upr-tag-pill implementation. */
  function renderTags(tags){
    if (!Array.isArray(tags) || !tags.length) return '<span class="upr-cell-empty">–</span>';
    return '<div class="upr-tags-list">' + tags.map(function(tag){
      return '<span class="up-topicchip" style="--ust-tag-color:' + esc(makeColor(tag.hex_light, '#6b7280')) + ';">' +
        (tag.emoji ? '<span class="up-topicchip-e">' + esc(tag.emoji) + '</span>' : '') +
        '<span class="up-topicchip-lbl">' + esc(tag.name) + '</span></span>';
    }).join('') + '</div>';
  }
  function contextPills(meta, withKeywords){
    var flagUrl = getFlagUrlForMarket(meta.market);
    var marketLabel = meta.market_name || meta.market || 'Market';
    var keywordsLabel = meta.keywords && meta.keywords.length ? meta.keywords.join(', ') : 'No keywords';
    var businessLabel = meta.business_model || 'Model n/a';
    var personaLabel = meta.persona || 'No persona';
    return '<span class="upr-context-pill" data-tip="' + esc(marketLabel) + '"><span class="upr-market-flag">' + flagHtml(flagUrl, marketLabel) + '</span><span>' + esc(meta.market || marketLabel) + '</span></span>' +
      (withKeywords ? '<span class="upr-context-pill is-keywords" data-tip="Keywords: ' + esc(keywordsLabel) + '">' + ICON.tag + '<span>' + esc(keywordsLabel) + '</span></span>' : '') +
      '<span class="upr-context-pill" data-tip="Business model: ' + esc(businessLabel) + '">' + ICON.briefcase + '<span>' + esc(businessLabel) + '</span></span>' +
      (personaLabel !== 'No persona' ? '<span class="upr-context-pill" data-tip="Persona: ' + esc(personaLabel) + '">' + ICON.user + '<span>' + esc(personaLabel) + '</span></span>' : '');
  }
  function renderResultsContext(){ if (resultsContext) resultsContext.innerHTML = contextPills(currentResearchMeta, true); }

  /* ---------- previous researches (sidebar) ---------- */
  function normalizeResearchMeta(item){
    var input = item.research_input && typeof item.research_input === 'object' ? item.research_input : {};
    var rawKeywords = item.keywords != null ? item.keywords : (item.input_keywords != null ? item.input_keywords : (item.keywords_raw != null ? item.keywords_raw : input.keywords));
    return {
      job_id: item.job_id || item.id || null,
      keywords: parseKeywords(rawKeywords),
      market: item.market || item.market_alpha2 || input.market || null,
      market_name: item.market_name || input.market_name || null,
      business_model: item.business_model || input.business_model || null,
      persona: item.persona || input.persona || null,
      prompt_count: Number(item.prompt_count || item.suggested_prompt_count || item.inserted_count || 0),
      created_at: item.created_at || item.finished_at || item.updated_at || null
    };
  }
  function formatHistoryDate(value){
    if (!value) return 'recently';
    try { return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
    catch(e){ return String(value); }
  }
  function renderPreviousResearches(rawItems){
    previousResearches = (Array.isArray(rawItems) ? rawItems : []).map(normalizeResearchMeta).filter(function(x){ return x.job_id; });
    if (historyCountEl) historyCountEl.textContent = String(previousResearches.length);
    if (!historyList) return;
    if (!previousResearches.length){
      historyList.innerHTML = '<div class="up-empty"><div class="up-empty-ic">' + ICON.clock + '</div>' +
        '<div class="up-empty-h">No completed researches yet</div>' +
        '<div class="up-empty-t">Finished researches show up here so you can reopen them.</div></div>';
      return;
    }
    historyList.innerHTML = previousResearches.map(function(item, index){
      var headline = (item.keywords && item.keywords.length) ? item.keywords.join(', ') : 'Untitled research';
      return '<div class="upr-history-item" data-history-index="' + index + '" role="button" tabindex="0">' +
        '<div class="upr-history-main">' +
          '<div class="upr-history-headline" data-tip="' + esc(headline) + '">' + esc(headline) + '</div>' +
          '<div class="upr-history-date">' + esc(formatHistoryDate(item.created_at)) + ' · ' + esc(item.prompt_count || 0) + ' prompts</div>' +
          '<div class="upr-history-meta-row">' + contextPills(item, false) + '</div>' +
        '</div>' +
        '<div class="upr-history-actions">' +
          '<button class="up-iconbtn upr-history-delete" type="button" data-action="delete-research" data-job-id="' + esc(item.job_id) + '" data-history-index="' + index + '" data-tip="Delete research" aria-label="Delete research">' + ICON.trash + '</button>' +
          '<button class="up-iconbtn" type="button" data-action="open-research" data-history-index="' + index + '" data-tip="Open research" aria-label="Open research">' + ICON.gotoArrow + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ---------- sidebar open/close ----------
     Same drawer contract the rest of the app uses: slide in from the right, backdrop, page-height,
     z-index below the host app's own drawers, and #main locked while it is open. */
  var sideCloseTimer = null;
  var mainScrollTop = 0;
  function lockPageScroll(on){
    var main = document.getElementById('main');
    if (!main) return;
    var locked = main.classList.contains('drawer-locked');
    if (on && !locked){ mainScrollTop = main.scrollTop; main.classList.add('drawer-locked'); }
    else if (!on && locked){
      if (document.querySelector('[id^="drawer-"].open')) return;   // one of the app's own is still up
      main.classList.remove('drawer-locked');
      main.scrollTop = mainScrollTop;
    }
  }
  /* Everything about this panel -- that it is fixed, that it slides, that it is hidden while
     closed -- lives in prompt-research.css. Without that file the component silently does nothing
     visible, which is impossible to tell apart from a broken button. Probe once and say so
     plainly. The sentinel is .upr-side's own position:fixed -- a bare div has position:static, so
     if the stylesheet is on the page this comes back "fixed" and nothing is reported. */
  var _cssWarned = false;
  function stylesheetPresent(){
    try {
      var probe = document.createElement('div');
      probe.className = 'upr-side';
      probe.style.cssText = 'left:-9999px;top:-9999px';
      document.body.appendChild(probe);
      var ok = window.getComputedStyle(probe).position === 'fixed';
      probe.parentNode.removeChild(probe);
      return ok;
    } catch(_){ return true; }   // can't tell -> don't cry wolf
  }
  function warnIfNoStylesheet(){
    if (_cssWarned || stylesheetPresent()) return;
    _cssWarned = true;
    if (window.console) console.error(
      '[prompt-research] prompt-research.css is NOT loaded on this page. The script runs, but ' +
      'every panel it owns (previous-researches sidebar, dropdowns) has no styling and cannot ' +
      'show itself. Check that the loader injects prompt-research.css and that the data-cdn-pin ' +
      'commit actually serves it.');
  }

  function openHistoryPanel(){
    warnIfNoStylesheet();
    if (!sidePanel) return;
    if (sideCloseTimer){ clearTimeout(sideCloseTimer); sideCloseTimer = null; }
    portal.setAttribute('data-theme', isDark() ? 'dark' : 'light');
    portal.classList.add('side-open');
    void sidePanel.offsetWidth;
    requestAnimationFrame(function(){ portal.classList.add('side-in'); });
    lockPageScroll(true);
    if (historyList) historyList.scrollTop = 0;
  }
  function closeHistoryPanel(){
    if (!sidePanel) return;
    portal.classList.remove('side-in');
    lockPageScroll(false);
    sideCloseTimer = setTimeout(function(){ portal.classList.remove('side-open'); }, 200);
  }

  /* ---------- skeleton ---------- */
  function renderSkeletonRows(){
    if (!resultsBody) return;
    /* core's skeleton takes pixel widths and jitters them per row, so the block does not read as a
       rigid grid -- that is what the standalone's hand-written width table was doing by hand. */
    resultsBody.innerHTML = UC.skeletonRows
      ? UC.skeletonRows({ count: 8, cols: [{ w: 240, jitter: 40 }, { w: 150, jitter: 30 }, { w: 58 }, { w: 0 }] })
      : '';
  }

  /* ---------- events out (names unchanged) ---------- */
  function emitOpenResearchJob(item){
    if (!item || !item.job_id) return;
    updateResearchContext(item); renderResultsContext(); closeHistoryPanel();
    renderSkeletonRows();
    if (resultsStage) resultsStage.classList.remove('is-empty');
    if (resultsCount) resultsCount.textContent = '…';
    root.querySelectorAll('[data-count-label]').forEach(function(el){ el.textContent = '(…)'; });
    setResearchState('results');
    if (historyList) historyList.scrollTop = 0;
    var payload = { job_id: item.job_id, keywords: item.keywords, market: item.market, market_name: item.market_name, business_model: item.business_model, persona: item.persona };
    if (window.bubble_fn_openPromptResearchJob) window.bubble_fn_openPromptResearchJob(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('upstreem:open-prompt-research-job', { detail: payload })); }
  }
  function emitPromptAction(action, payload){
    payload = payload || {};
    if (action === 'accept' || action === 'accept_all') payload.accept_with_tags = acceptWithTags;
    var json = JSON.stringify(payload);
    var fnName = { accept: 'bubble_fn_acceptSuggestedPrompt', ignore: 'bubble_fn_ignoreSuggestedPrompt', accept_all: 'bubble_fn_acceptAllSuggestedPrompts', delete_all: 'bubble_fn_deleteAllSuggestedPrompts' }[action];
    if (fnName && typeof window[fnName] === 'function') window[fnName](json);
    else { window.dispatchEvent(new CustomEvent('upstreem:suggested-prompt:' + action, { detail: payload })); }
  }

  /* ---------- results table ---------- */
  function renderSuggestedPrompts(rawItems){
    var items = Array.isArray(rawItems) ? rawItems : [];
    currentSuggestedPrompts = items.map(normalizePromptItem).filter(function(item){ return item.prompt_text; });
    if (!currentResearchMeta.market && currentSuggestedPrompts.length) currentResearchMeta.market = currentSuggestedPrompts[0].market || null;
    var count = currentSuggestedPrompts.length;
    if (resultsCount) resultsCount.textContent = String(count);
    if (resultsHeading) resultsHeading.classList.toggle('has-count', true);
    root.querySelectorAll('[data-count-label]').forEach(function(el){ el.textContent = '(' + count + ')'; });
    if (resultsStage) resultsStage.classList.toggle('is-empty', count === 0);
    renderResultsContext();
    if (resultsBody){
      resultsBody.innerHTML = currentSuggestedPrompts.map(function(item, index){
        return '<div class="up-row" data-prompt-id="' + esc(item.id || '') + '" data-row-index="' + index + '">' +
          '<div class="up-td"><span class="upr-prompt-text">' + esc(item.prompt_text) + '</span></div>' +
          '<div class="up-td">' + renderTags(item.tags) + '</div>' +
          '<div class="up-td">' + renderVolume(item.estimated_volume) + '</div>' +
          '<div class="up-td upr-td-actions"><div class="upr-row-actions">' +
            '<button class="upr-row-btn is-ignore" type="button" data-action="ignore" data-index="' + index + '"><span>Ignore</span>' + ICON.x + '</button>' +
            '<button class="upr-row-btn is-accept" type="button" data-action="accept" data-index="' + index + '"><span>Track</span>' + ICON.check + '</button>' +
          '</div></div>' +
        '</div>';
      }).join('');
    }
    setResearchState('results');
  }

  function setActionLoading(isLoading){
    root.classList.toggle('is-action-loading', !!isLoading);
    root.querySelectorAll('button, input, textarea, select, a').forEach(function(el){
      if (isLoading){ if (!el.hasAttribute('data-upr-prev-disabled')) el.setAttribute('data-upr-prev-disabled', el.disabled ? '1' : '0'); el.disabled = true; }
      else if (el.hasAttribute('data-upr-prev-disabled')){ el.disabled = el.getAttribute('data-upr-prev-disabled') === '1'; el.removeAttribute('data-upr-prev-disabled'); }
    });
    if (sidePanel) sidePanel.querySelectorAll('button').forEach(function(el){
      if (isLoading){ if (!el.hasAttribute('data-upr-prev-disabled')) el.setAttribute('data-upr-prev-disabled', el.disabled ? '1' : '0'); el.disabled = true; }
      else if (el.hasAttribute('data-upr-prev-disabled')){ el.disabled = el.getAttribute('data-upr-prev-disabled') === '1'; el.removeAttribute('data-upr-prev-disabled'); }
    });
  }

  /* ---------- composer ---------- */
  function updateComposerValueState(){ if (!composerEl || !textarea) return; composerEl.classList.toggle('has-value', textarea.value.trim().length > 0); }
  function autoResizeTextarea(){ if (!textarea) return; textarea.style.height = 'auto'; textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px'; updateComposerValueState(); }
  function normalizeSuggestionTag(input){
    if (typeof input === 'string'){ var n = input.trim(); return n ? { id: null, name: n, emoji: '', hex_light: '#6f737c' } : null; }
    if (!input || typeof input !== 'object') return null;
    var name = String(input.name || input.tag_name || input.label || '').trim();
    if (!name) return null;
    return { id: input.id || input.tag_id || null, name: name, emoji: input.emoji || '', hex_light: input.hex_light || input.hex_dark || '#6f737c' };
  }
  function renderSuggestions(sourceTags){
    var isFirstCall = Array.isArray(sourceTags);
    if (isFirstCall){ suggestionTagsSource = sourceTags; suggestionTagsExpanded = false; }
    var source = Array.isArray(suggestionTagsSource) ? suggestionTagsSource : readJsonScript('upr-suggested-keywords-json', []);
    var tags = source.map(normalizeSuggestionTag).filter(Boolean);
    var visibleTags = suggestionTagsExpanded ? tags : tags.slice(0, SUGGESTION_TAGS_LIMIT);
    var hiddenCount = Math.max(tags.length - visibleTags.length, 0);
    if (!suggestionsEl) return;
    if (isFirstCall){
      var skeleton = root.querySelector('#upr-suggestions-skeleton');
      if (skeleton) skeleton.style.display = 'none';
      suggestionsEl.style.display = '';
    }
    suggestionsEl.innerHTML = visibleTags.map(function(tag){
      return '<button class="up-topicchip upr-chip" type="button" data-chip="' + esc(tag.name) + '" data-tag-id="' + esc(tag.id || '') + '" style="--ust-tag-color:' + esc(makeColor(tag.hex_light, '#6f737c')) + ';">' +
        (tag.emoji ? '<span class="up-topicchip-e">' + esc(tag.emoji) + '</span>' : '') +
        '<span class="up-topicchip-lbl">' + esc(tag.name) + '</span></button>';
    }).join('') +
    (hiddenCount > 0 ? '<button class="upr-showmore" type="button" id="upr-show-more-tags">Show More +' + esc(hiddenCount) + '</button>' : '') +
    (suggestionTagsExpanded ? '<button class="upr-showmore" type="button" id="upr-show-less-tags">' + ICON.chevronUp + '<span>Show Less</span></button>' : '');
    var showMoreButton = suggestionsEl.querySelector('#upr-show-more-tags');
    if (showMoreButton) showMoreButton.addEventListener('click', function(){ suggestionTagsExpanded = true; renderSuggestions(); });
    var showLessButton = suggestionsEl.querySelector('#upr-show-less-tags');
    if (showLessButton) showLessButton.addEventListener('click', function(){ suggestionTagsExpanded = false; renderSuggestions(); });
  }

  /* ---------- settings dropdowns ---------- */
  /* The root is its own scroll box, so a menu opening downwards near the bottom would have nothing
     to scroll to. The CSS adds bottom padding to the shell while any dropdown is open; this flag
     is what it keys off. Deferred by a tick because makePopover removes .is-open on the way out and
     we would otherwise read the state one step behind -- setTimeout, not requestAnimationFrame,
     because rAF is throttled to nothing in a background tab and the padding would then never come
     back off. */
  function syncDropdownOpenState(){
    setTimeout(function(){
      root.classList.toggle('is-dd-open', !!root.querySelector('.upr-dd.is-open'));
    }, 0);
  }
  function setDropdownValue(dd, option){
    if (!dd || !option) return;
    var name = dd.getAttribute('data-name');
    var valueEl = dd.querySelector('[data-dd-value]');
    Array.prototype.forEach.call(dd.querySelectorAll('.upr-dd-option'), function(o){ o.classList.remove('is-selected'); });
    option.classList.add('is-selected');
    var label  = option.getAttribute('data-label') || option.textContent.trim();
    var value  = option.getAttribute('data-value') || '';
    var alpha2 = option.getAttribute('data-alpha2') || '';
    var alpha3 = option.getAttribute('data-alpha3') || '';
    var flag   = option.getAttribute('data-flag') || '';
    if (name) state[name] = value;
    if (name === 'market'){ state.market = value; state.market_alpha2 = alpha2; state.market_alpha3 = alpha3; state.market_name = label; }
    if (valueEl) valueEl.innerHTML = (flag ? '<span class="upr-flag">' + flagHtml(flag, label) + '</span>' : '') + '<span>' + esc(label) + '</span>';
    if (dd.__pop) dd.__pop.close();
    syncDropdownOpenState();
  }
  function wireDropdown(dd){
    var trigger = dd.querySelector('.upr-dd-trigger');
    var menu    = dd.querySelector('.upr-dd-menu');
    var search  = dd.querySelector('.upr-dd-search');
    var clear   = dd.querySelector('.upr-dd-clear');
    var list    = dd.querySelector('[data-dd-list]');
    function getOptions(){ return Array.prototype.slice.call(dd.querySelectorAll('.upr-dd-option')); }
    /* core's popover: outside-click, Escape and mutual exclusion all come from there, so the
       standalone's own document-level click/keydown handlers are gone. makePopover has no open
       hook, so the search focus rides on the trigger click instead. */
    dd.__pop = UC.makePopover({
      wrap: dd, menu: menu, opener: trigger, group: 'upr-settings',
      onClose: syncDropdownOpenState
    });
    if (trigger) trigger.addEventListener('click', function(e){
      e.stopPropagation();
      dd.__pop.toggle();
      syncDropdownOpenState();
      if (search && dd.__pop.isOpen()) setTimeout(function(){ try { search.focus(); } catch(err){} }, 80);
    });
    dd.addEventListener('click', function(e){
      var option = e.target.closest('.upr-dd-option');
      if (!option || !dd.contains(option)) return;
      e.stopPropagation();
      setDropdownValue(dd, option);
    });
    if (search && list) search.addEventListener('input', function(){
      var q = search.value.trim().toLowerCase(), visibleCount = 0;
      getOptions().forEach(function(option){
        var haystack = [option.getAttribute('data-label'), option.getAttribute('data-value'), option.getAttribute('data-alpha2'), option.getAttribute('data-alpha3'), option.textContent].join(' ').toLowerCase();
        var visible = !q || haystack.indexOf(q) !== -1;
        option.style.display = visible ? '' : 'none';
        if (visible) visibleCount++;
      });
      list.classList.toggle('is-empty', visibleCount === 0);
    });
    if (clear && search && list) clear.addEventListener('click', function(e){
      e.stopPropagation(); search.value = '';
      getOptions().forEach(function(option){ option.style.display = ''; });
      list.classList.remove('is-empty'); search.focus();
    });
  }
  function renderMarketDropdown(){
    var markets = getMarkets().filter(function(m){ return m && m.alpha2 && m.name; }).map(function(m){
      return { alpha2: String(m.alpha2 || '').toUpperCase(), alpha3: String(m.alpha3 || '').toUpperCase(),
               name: String(m.name || '').trim(), flag_url: String(m.flag_url || '').trim(), prompt_count: Number(m.prompt_count || 0) };
    });
    var dd = root.querySelector('#upr-market-dd');
    if (!dd) return;
    var list = dd.querySelector('[data-dd-list]');
    if (!list) return;
    var sorted = markets.slice().sort(function(a, b){ return (b.prompt_count || 0) - (a.prompt_count || 0) || a.name.localeCompare(b.name); });
    list.innerHTML = sorted.map(function(m, index){
      return '<button class="upr-dd-option ' + (index === 0 ? 'is-selected' : '') + '" type="button" data-value="' + esc(m.alpha2) + '" data-alpha2="' + esc(m.alpha2) + '" data-alpha3="' + esc(m.alpha3) + '" data-label="' + esc(m.name) + '" data-flag="' + esc(m.flag_url) + '">' +
        '<span class="upr-dd-check">' + ICON.check + '</span>' +
        '<span class="upr-dd-optlabel">' + esc(m.name) + ' <span class="upr-dd-meta">(' + esc(m.alpha2) + ')</span></span>' +
        '<span class="upr-flag">' + flagHtml(m.flag_url, m.name) + '</span></button>';
    }).join('') + '<div class="upr-dd-empty">No markets found</div>';
    /* A market the host asked for wins over "just take the first option". The request usually
       arrives before this list exists (Bubble fires setMarket from a run-JS step on page load),
       so it is parked in _pendingMarket and claimed here -- this is the single point every path
       into the dropdown goes through, whether the markets came from setMarkets() or from the
       embedded #upr-markets-json tag at boot. */
    if (_pendingMarket != null && applyMarket(_pendingMarket)){ _pendingMarket = null; return; }
    var first = list.querySelector('.upr-dd-option');
    if (first) setDropdownValue(dd, first);
  }

  /* ---------- table kebab ---------- */
  var tableMenuPop = (tableMenu && tableMenuPopover)
    ? UC.makePopover({ wrap: tableMenu, menu: tableMenuPopover, opener: tableMenuTrigger, group: 'upr-table' })
    : { open: function(){}, close: function(){}, toggle: function(){}, isOpen: function(){ return false; } };

  /* ---------- wiring ---------- */
  if (textarea){ textarea.addEventListener('input', autoResizeTextarea); autoResizeTextarea(); }
  if (clearInputButton && textarea) clearInputButton.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); textarea.value = ''; textarea.focus(); autoResizeTextarea(); });
  if (settingsToggle && settingsPanel) settingsToggle.addEventListener('click', function(){
    var isOpen = settingsPanel.classList.toggle('is-open');
    settingsToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    settingsToggle.setAttribute('aria-label', isOpen ? 'Close research settings' : 'Open research settings');
    settingsToggle.classList.toggle('is-active', isOpen);      // §6a: open trigger keeps its state
  });
  root.querySelectorAll('.upr-dd').forEach(wireDropdown);

  if (startButton) startButton.addEventListener('click', function(){
    var payload = { keywords: textarea ? textarea.value.trim() : '', market: state.market, market_alpha2: state.market_alpha2,
                    market_alpha3: state.market_alpha3, market_name: state.market_name, business_model: state.business_model, persona: state.persona };
    updateResearchContext(payload); renderResultsContext();
    if (root.__uprStartLocked) return;
    root.__uprStartLocked = true; setTimeout(function(){ root.__uprStartLocked = false; }, 1200);
    setResearchState('running');
    if (textarea){ textarea.value = ''; autoResizeTextarea(); }
    if (window.bubble_fn_startPromptResearch) window.bubble_fn_startPromptResearch(JSON.stringify(payload));
    else { window.dispatchEvent(new CustomEvent('upstreem:start-prompt-research', { detail: payload })); }
  });

  if (resultsBody) resultsBody.addEventListener('click', function(e){
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    var index = Number(btn.getAttribute('data-index'));
    var item = currentSuggestedPrompts[index];
    if (!item) return;
    emitPromptAction(btn.getAttribute('data-action'), { suggested_prompt_id: item.id, suggested_prompt_ids: [item.id] });
  });

  if (historyList) historyList.addEventListener('click', function(e){
    var deleteBtn = e.target.closest('button[data-action="delete-research"]');
    if (deleteBtn){
      e.stopPropagation();
      var jobId = deleteBtn.getAttribute('data-job-id');
      var dIndex = Number(deleteBtn.getAttribute('data-history-index'));
      var dItem = previousResearches[dIndex];
      var payload = { job_id: jobId, keywords: dItem ? dItem.keywords : [], market: dItem ? dItem.market : null };
      if (window.bubble_fn_deletePromptResearch) window.bubble_fn_deletePromptResearch(JSON.stringify(payload));
      else window.dispatchEvent(new CustomEvent('upstreem:delete-prompt-research', { detail: payload }));
      return;
    }
    var itemRow = e.target.closest('.upr-history-item');
    if (!itemRow) return;
    emitOpenResearchJob(previousResearches[Number(itemRow.getAttribute('data-history-index'))]);
  });
  if (historyList) historyList.addEventListener('keydown', function(e){
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var itemRow = e.target.closest('.upr-history-item');
    if (!itemRow) return;
    e.preventDefault();
    emitOpenResearchJob(previousResearches[Number(itemRow.getAttribute('data-history-index'))]);
  });

  if (openHistoryButton) openHistoryButton.addEventListener('click', openHistoryPanel);
  if (openHistoryResultsButton) openHistoryResultsButton.addEventListener('click', openHistoryPanel);
  if (closeHistoryButton) closeHistoryButton.addEventListener('click', closeHistoryPanel);
  if (sideScrim) sideScrim.addEventListener('click', closeHistoryPanel);
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && portal.classList.contains('side-open')) closeHistoryPanel(); });
  if (backToStartButton) backToStartButton.addEventListener('click', function(){ setResearchState('idle'); closeHistoryPanel(); });

  if (tableMenuTrigger) tableMenuTrigger.addEventListener('click', function(e){ e.stopPropagation(); tableMenuPop.toggle(); });
  if (acceptWithTagsBtn) acceptWithTagsBtn.addEventListener('click', function(){
    acceptWithTags = !acceptWithTags;
    acceptWithTagsBtn.classList.toggle('is-on', acceptWithTags);
    acceptWithTagsBtn.setAttribute('aria-pressed', acceptWithTags ? 'true' : 'false');
    var sw = acceptWithTagsBtn.querySelector('.up-switch');
    if (sw) sw.classList.toggle('is-on', acceptWithTags);
  });
  if (acceptAllButton) acceptAllButton.addEventListener('click', function(){
    tableMenuPop.close();
    emitPromptAction('accept_all', { count: currentSuggestedPrompts.length, suggested_prompt_ids: currentSuggestedPrompts.map(function(p){ return p.id; }).filter(Boolean) });
  });
  if (deleteAllButton) deleteAllButton.addEventListener('click', function(){
    tableMenuPop.close();
    emitPromptAction('delete_all', { count: currentSuggestedPrompts.length, suggested_prompt_ids: currentSuggestedPrompts.map(function(p){ return p.id; }).filter(Boolean) });
  });

  /* ---------- wheel bridge for the results table ----------
     Straight back from the standalone, where it was there for a reason: inside a Bubble HTML
     element the wheel over the results area does not reliably reach the inner scroll box, so only
     the controls scrolled and the table itself felt stuck. Drive .upr-box ourselves for any wheel
     that lands inside the stage, and only swallow the event when we actually moved it — so once
     the box hits an end, the gesture chains out to the page as usual.
     deltaMode is honoured (the standalone assumed pixels): a mouse that reports LINE deltas would
     otherwise scroll about three pixels per notch. */
  if (!root.__uprWheelBound){
    root.__uprWheelBound = true;
    root.addEventListener('wheel', function(e){
      if (!root.classList.contains('is-results')) return;
      var stage = root.querySelector('#upr-results-stage');
      var box = root.querySelector('.upr-box');
      if (!stage || !box) return;
      if (!stage.contains(e.target)) return;
      if (e.target.closest && e.target.closest('.up-menu')) return;   // the kebab menu scrolls itself
      if (box.scrollHeight <= box.clientHeight + 1) return;
      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16; else if (e.deltaMode === 2) d *= box.clientHeight;
      var before = box.scrollTop;
      box.scrollTop = before + d;
      if (box.scrollTop !== before){ e.preventDefault(); e.stopPropagation(); }
    }, { passive: false, capture: true });
  }

  /* Button tooltips, the app-wide way: one delegated [data-tip] handler per root. Only root, not
     also portal -- portal IS root now that the sidebar moved inline (see the "sidebar" note
     above), and calling this twice on the same element double-registers the delegated listener. */
  if (UC.makeTooltips){ UC.makeTooltips(root, isDark); }

  /* ---------- sticky toolbar ----------
     The same UC.makeSticky every big table uses: it pins .up-head at --up-sticky-top and keeps
     --up-thead-off in sync with the toolbar's measured height, which is what the column header
     above offsets itself by.

     16px, written here and NOT read from an attribute. The tables expose data-sticky and
     data-sticky-top because they sit on pages with different chrome above them; this component
     fills its page and there is exactly one right answer, so a knob would only be a way to get
     it wrong. Core's default of 171px is meant for a full app page with its own topbar, so the
     value has to be set — leaving the attribute off would pin 155px too low. */
  root.setAttribute("data-sticky-top", "16");
  root.removeAttribute("data-sticky");
  var stickyKit = UC.makeSticky ? UC.makeSticky(root, root.querySelector(".upr-results-stage .up-head")) : null;
  function applyStickyNow(){ if (stickyKit) stickyKit.applySticky(); }
  applyStickyNow();
  /* applySticky decides on/off from a one-off viewport measurement, and the toolbar's height
     changes when the results view appears at all — both need a re-run. */
  if (window.UpstreemCore && window.UpstreemCore.aufResize) window.UpstreemCore.aufResize(applyStickyNow);
  else window.addEventListener("resize", applyStickyNow);

  /* ---------- column explainer: Est. Volume ----------
     The results table's thead is static markup (bubble/prompt_research_bubble.html), never
     touched by JS, unlike the tables that build their header from UC.makeColumns -- so the
     .up-th-info icon is authored directly into the HTML instead of a headHtml() builder. Volume
     has no counterpart in any other table, so this is a local copy, not something for core's
     shared EXPLAIN_TEXT dict (that dict is for wording repeated across multiple tables).

     The trigger is INSERTED here rather than relied upon from the markup. bubble/*.html is a
     fresh-install template: it is pasted into the page once, so anything added to it afterwards
     never reaches a page that already exists. Adding the icon there alone meant the explainer
     shipped but was unreachable -- there was no element to hover. Doing it from JS means the CDN
     pin carries it on its own, with no edit needed on the Bubble side. No-op when the markup
     already has one (a freshly pasted page, or a second boot after a re-render). */
  (function(){
    var ths = root.querySelectorAll(".up-th");
    for (var i = 0; i < ths.length; i++){
      var th = ths[i];
      if (th.querySelector(".up-th-info")) continue;
      if (String(th.textContent || "").trim().indexOf("Est. Volume") !== 0) continue;
      var s = document.createElement("span");
      s.className = "up-th-info";
      s.setAttribute("data-explain", "volume");
      s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
        'stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/>' +
        '<line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
      th.appendChild(s);
    }
  })();
  if (UC.makeExplain){
    UC.makeExplain({
      root: root, triggerSel: '.up-th-info', getIsDark: isDark,
      html: function(kind){
        if (kind !== 'volume') return '';
        return '<div class="up-explain-vis"><span class="up-explain-row" style="gap:3px">' +
                 /* Farben in CSS, nicht inline: das leere Segment war auf #e8eaee festgeschrieben und
                    blieb damit im Dark Mode hell, waehrend dieselbe Leiste in der echten Spalte
                    dunkel ist. NICHT auf --upr-vol-* umstellen -- die Karte haengt am body, dort
                    loesen die Tokens nicht auf und die Segmente waeren in beiden Themes unsichtbar. */
                 '<span class="upr-volume-track upr-vol-demo" style="width:58px"><span class="upr-volume-seg is-filled"></span><span class="upr-volume-seg is-filled"></span><span class="upr-volume-seg is-filled"></span><span class="upr-volume-seg"></span></span>' +
               '</span></div>' +
               '<div class="up-explain-h">Est. Volume</div>' +
               '<div class="up-explain-t">The estimated frequency that users actually use this or a very similar prompt.</div>';
      }
    });
  }

  /* Theme mirror: Bubble sets data-isdark, core's CSS keys off data-theme. */
  function syncTheme(){
    if (UC.isYes(root.getAttribute('data-isdark'))) root.setAttribute('data-theme', 'dark');
    else if (root.getAttribute('data-theme') !== 'dark' || root.hasAttribute('data-isdark')) root.removeAttribute('data-theme');
    portal.setAttribute('data-theme', isDark() ? 'dark' : 'light');
  }
  if (root.hasAttribute('data-isdark')) syncTheme();
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-isdark'] });

  /* ---------- inline tag editor (contenteditable over the hidden textarea) ----------
     Straight port of the standalone's second script: the visible field is a contenteditable that
     turns picked keywords into removable pills and keeps the hidden textarea in sync, because the
     start handler reads its value. */
  (function initTagEditor(){
    if (!composerEl || !textarea) return;
    var TAG_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="upr-inline-tag-ico" aria-hidden="true"><path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/><path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="6.5" cy="9.5" r=".5" fill="currentColor"/></svg>';
    var X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>';
    function isTag(node){ return node && node.nodeType === 1 && node.classList && node.classList.contains('upr-inline-tag'); }
    var placeholder = textarea.getAttribute('placeholder') || '';
    var editor = document.createElement('div');
    editor.className = 'upr-tag-editor is-empty';
    editor.setAttribute('contenteditable', 'true');
    editor.setAttribute('role', 'textbox');
    editor.setAttribute('aria-multiline', 'true');
    editor.setAttribute('data-placeholder', placeholder);
    textarea.style.display = 'none';
    composerEl.insertBefore(editor, textarea);

    function existingTagValues(){ return Array.prototype.slice.call(editor.querySelectorAll('.upr-inline-tag')).map(function(el){ return String(el.getAttribute('data-tag') || '').toLowerCase(); }); }
    function getValue(){
      var parts = [];
      editor.childNodes.forEach(function(node){
        if (isTag(node)){ var t = String(node.getAttribute('data-tag') || '').trim(); if (t) parts.push(t); }
        else String(node.textContent || '').split(',').forEach(function(s){ s = s.trim(); if (s) parts.push(s); });
      });
      return parts.join(', ');
    }
    function isEmpty(){
      if (editor.querySelector('.upr-inline-tag')) return false;
      return String(editor.textContent || '').replace(/[​]/g, '').trim() === '';
    }
    function updateState(){
      var empty = isEmpty();
      editor.classList.toggle('is-empty', empty);
      composerEl.classList.toggle('has-value', !empty);
      var val = getValue();
      if (textarea.value !== val) textarea.value = val;
    }
    function placeCaretAfter(node){
      try { var sel = window.getSelection(), r = document.createRange(); r.setStartAfter(node); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); } catch(e){}
    }
    function buildTag(value){
      var span = document.createElement('span');
      span.className = 'upr-inline-tag';
      span.setAttribute('contenteditable', 'false');
      span.setAttribute('data-tag', value);
      span.innerHTML = '<span class="upr-inline-tag-body">' + TAG_ICON +
        '<span class="upr-inline-tag-label">' + esc(value) + '</span>' +
        '<span class="upr-inline-tag-remove" role="button" tabindex="-1" aria-label="Remove tag: ' + esc(value) + '">' + X_ICON + '</span>' +
        '</span><span class="upr-inline-tag-sep">,</span>';
      return span;
    }
    function ensureTrailingText(){
      var last = editor.lastChild;
      if (!last || last.nodeType !== 3){ last = document.createTextNode(' '); editor.appendChild(last); }
      return last;
    }
    function insertTag(value){
      value = String(value || '').trim();
      if (!value){ editor.focus(); return; }
      if (existingTagValues().indexOf(value.toLowerCase()) !== -1){ editor.focus(); return; }
      var tag = buildTag(value);
      editor.insertBefore(tag, ensureTrailingText());
      editor.focus(); placeCaretAfter(tag); updateState();
    }
    function removeTag(tag){
      if (!tag) return;
      var prev = tag.previousSibling;
      tag.remove();
      if (isEmpty()) editor.innerHTML = '';
      else {
        try {
          var sel = window.getSelection(), r = document.createRange();
          if (prev) r.setStartAfter(prev); else r.setStart(editor, 0);
          r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
        } catch(e){}
      }
      updateState();
    }
    editor.addEventListener('input', updateState);
    editor.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){
        e.preventDefault();
        try {
          var sel = window.getSelection();
          if (!sel.rangeCount) return;
          var r = sel.getRangeAt(0);
          r.deleteContents();
          var br = document.createElement('br');
          r.insertNode(br); r.setStartAfter(br); r.collapse(true);
          sel.removeAllRanges(); sel.addRange(r);
        } catch(err){}
        updateState();
        return;
      }
      if (e.key !== 'Backspace') return;
      var s = window.getSelection();
      if (!s || s.rangeCount === 0) return;
      var range = s.getRangeAt(0);
      if (!range.collapsed) return;
      var c = range.startContainer, o = range.startOffset, before = null;
      if (c === editor){ if (o > 0) before = editor.childNodes[o - 1]; }
      else if (c.nodeType === 3){ if (o === 0) before = c.previousSibling; else return; }
      else if (c.nodeType === 1){ if (o === 0) before = c.previousSibling; }
      // skip only our own placeholder whitespace (nbsp/zwsp), never real text
      while (before && before.nodeType === 3 && /^[ ​]*$/.test(String(before.textContent || ''))) before = before.previousSibling;
      if (isTag(before)){ e.preventDefault(); removeTag(before); }
    });
    editor.addEventListener('mousedown', function(e){ if (e.target.closest && e.target.closest('.upr-inline-tag-remove')) e.preventDefault(); });
    editor.addEventListener('click', function(e){
      var rm = e.target.closest && e.target.closest('.upr-inline-tag-remove');
      if (!rm) return;
      e.preventDefault(); e.stopPropagation();
      removeTag(rm.closest('.upr-inline-tag'));
      editor.focus();
    });
    editor.addEventListener('paste', function(e){
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text/plain') || '';
      try { document.execCommand('insertText', false, text); }
      catch(err){
        var sel = window.getSelection();
        if (sel.rangeCount){ var r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(document.createTextNode(text)); }
      }
      updateState();
    });
    editor.addEventListener('beforeinput', function(e){
      if (e.inputType && e.inputType.indexOf('insert') === 0 && getValue().length >= 300) e.preventDefault();
    });
    if (suggestionsEl) suggestionsEl.addEventListener('click', function(e){
      var chip = e.target.closest && e.target.closest('.upr-chip');
      if (!chip || !suggestionsEl.contains(chip)) return;
      e.stopPropagation(); e.preventDefault();
      insertTag(chip.getAttribute('data-chip') || chip.textContent.trim());
    }, true);
    if (clearInputButton) clearInputButton.addEventListener('click', function(){ editor.innerHTML = ''; updateState(); editor.focus(); });
    if (startButton) startButton.addEventListener('click', function(){ editor.innerHTML = ''; updateState(); });
    new MutationObserver(function(){
      var running = root.classList.contains('is-running');
      editor.classList.toggle('is-disabled', running);
      editor.setAttribute('contenteditable', running ? 'false' : 'true');
    }).observe(root, { attributes: true, attributeFilter: ['class'] });
    updateState();
  })();

  /* ---------- public API (names and semantics byte-identical to the standalone) ---------- */
  var api = window.upstreemPromptResearch = window.upstreemPromptResearch || {};
  api.setRunning  = function(){ setResearchState('running'); };
  api.setIdle     = function(){ setResearchState('idle'); };
  api.setError    = function(){ setResearchState('idle'); };
  api.setComplete = function(data){ Array.isArray(data) ? renderSuggestedPrompts(data) : setResearchState('idle'); };
  api.setPrompts  = function(data, meta){
    if (typeof data === 'string'){ try { data = JSON.parse(data); } catch(e){ data = []; } }
    if (typeof meta === 'string'){ try { meta = JSON.parse(meta); } catch(e){ meta = null; } }
    updateResearchContext(meta || {});
    renderSuggestedPrompts(Array.isArray(data) ? data : []);
    if (Array.isArray(data) && data.length === 0){ closeHistoryPanel(); setResearchState('idle'); }
  };
  api.setResearchMeta = function(meta){
    if (typeof meta === 'string'){ try { meta = JSON.parse(meta); } catch(e){ meta = {}; } }
    updateResearchContext(meta || {}); renderResultsContext();
  };
  api.setPreviousResearches = function(items){
    if (typeof items === 'string'){ try { items = JSON.parse(items); } catch(e){ items = []; } }
    renderPreviousResearches(Array.isArray(items) ? items : []); setActionLoading(false);
  };
  api.openHistory      = openHistoryPanel;
  api.closeHistory     = closeHistoryPanel;
  api.setTags          = function(tags){ if (typeof tags === 'string'){ try { tags = JSON.parse(tags); } catch(e){ tags = []; } } renderSuggestions(Array.isArray(tags) ? tags : []); };
  api.setActionLoading = setActionLoading;
  api.setBusy          = setActionLoading;
  api.setTheme         = function(theme){ var dark = String(theme || '').toLowerCase() === 'dark'; root.setAttribute('data-theme', dark ? 'dark' : 'light'); portal.setAttribute('data-theme', dark ? 'dark' : 'light'); };
  api.setMarkets       = function(items){
    if (typeof items === 'string'){ try { items = JSON.parse(items); } catch(e){ items = []; } }
    if (!Array.isArray(items)) return;
    var tag = root.querySelector('#upr-markets-json') || document.getElementById('upr-markets-json');
    if (tag) tag.textContent = JSON.stringify(items);
    renderMarketDropdown();   // claims _pendingMarket itself, see there
  };

  /* ---------- settings the host sets from outside ----------
     Bubble runs these from run-JS steps on page load, i.e. usually BEFORE setMarkets() has
     delivered the market list (and before this file has even booted -- the stub queue at the top
     of the file covers that part). So setMarket() remembers what was asked for and setMarkets()
     re-applies it once the options exist. */
  var _pendingMarket = null;
  /* Pick the option whose alpha2 ("DE"), alpha3 ("DEU"), value or label ("Germany", "B2B")
     matches, and select it through setDropdownValue -- the same path a real click takes, so the
     trigger label, the checkmark and state[] all update exactly as if the user had chosen it. */
  function selectDdValue(dd, v){
    if (!dd) return false;
    var want = String(v && typeof v === 'object'
      ? (v.alpha2 || v.alpha3 || v.value || v.market || v.business_model || v.name || '')
      : (v == null ? '' : v)).trim().toLowerCase();
    if (!want) return false;
    var opts = Array.prototype.slice.call(dd.querySelectorAll('.upr-dd-option'));
    for (var i = 0; i < opts.length; i++){
      var o = opts[i];
      var cand = [o.getAttribute('data-alpha2'), o.getAttribute('data-alpha3'),
                  o.getAttribute('data-value'), o.getAttribute('data-label')];
      for (var j = 0; j < cand.length; j++){
        if (cand[j] && String(cand[j]).trim().toLowerCase() === want){ setDropdownValue(dd, o); return true; }
      }
    }
    return false;
  }
  function applyMarket(v){ return selectDdValue(root.querySelector('#upr-market-dd'), v); }
  function coerce(v){
    if (typeof v === 'string'){
      var t = v.trim();
      if (t.charAt(0) === '{' || t.charAt(0) === '['){ try { return JSON.parse(t); } catch(e){ return t; } }
    }
    return Array.isArray(v) ? v[0] : v;
  }
  api.setMarket = function(v){
    v = coerce(v);
    _pendingMarket = v;
    if (applyMarket(v)) _pendingMarket = null;
  };
  /* Business model is a plain three-option dropdown that is in the markup from the start, so no
     pending dance is needed -- but it DOES have a visible control, which the first version of this
     missed: it only wrote state.business_model, leaving the trigger stuck on "B2C". */
  api.setBusinessModel = function(v){
    selectDdValue(root.querySelector('.upr-dd[data-name="business_model"]'), coerce(v));
  };
  api.setPersona = function(v){
    var s = String(v == null ? '' : v).trim();
    state.persona = s;
    var el = root.querySelector('.upr-persona-input, #upr-persona, [data-name="persona"] input');
    if (el && 'value' in el) el.value = s;
  };

  renderSuggestions();
  renderMarketDropdown();
  renderPreviousResearches([]);
  setResearchState('idle');

  /* Replay whatever Bubble queued against the stubs, in call order. */
  var q = window.__uprBootQueue;
  if (q && q.length){
    q.splice(0, q.length).forEach(function(entry){
      try { api[entry[0]].apply(null, entry[1]); }
      catch(e){ if (window.console) console.error('[prompt-research] queued ' + entry[0] + ' failed:', e); }
    });
  }

  }

  uprBoot(50);
})();
