/* upstreem create-with-ai.js — Komponentenlogik. Braucht core.js (window.UpstreemCore) zuerst.

   Ein Knopf an einer Empfehlung, der ein Popup oeffnet: Quelle, freie Anweisungen, interne Links,
   Ausgabeformat, Schema-Opt-in und die Wahl des KI-Assistenten. Der Knopf unten baut daraus einen
   fertigen Prompt und oeffnet den Assistenten damit.

   ── Was diese Komponente anders macht als die uebrigen ───────────────────────
   Sie kann in einer Repeating Group liegen: dann steckt dieselbe data-instance in JEDER Zeile, und
   eine Adressierung nur ueber data-instance ginge schief -- alle Zeilen waeren derselbe Empfaenger.
   Jede Wurzel bekommt darum beim Mounten eine eigene UID und traegt sich unter
   window.createWithAi[UID] ein.

   DAS IST ABER NICHT DER EINZIGE FALL, und diese Datei hat lange nur ihn beschrieben. Genauso
   normal ist: das Element liegt ZWEIMAL auf einer Seite, je einmal in einem eigenen Reusable
   (gemeldet am 01.09.). Dann gibt es keine Repeating Group, sondern zwei feste Empfaenger -- und
   ein Aufruf ohne erstes Argument trifft "die zuletzt lebende Instanz", also mal den einen und mal
   den anderen. Fuer diesen Fall gibt es jetzt data-instance: die globalen Funktionen nehmen als
   erstes Argument eine UID ODER eine data-instance.

   Das Mounten selbst (Erstlauf, Bubble-Nachrender, Stub-Replay, Cross-Frame-Forwarder) kommt
   trotzdem aus UC.makeMount -- nur die Zuordnung Aufruf -> Instanz ist eigen.

   ── Was aus core kommt ──────────────────────────────────────────────────────
     Erklaerkarte der Formate      UC.makeExplain (cls: "uca-explain")
     Bubble-Klempnerei             UC.makeMount
     Schliessen-Knopf im Popup     .up-popup-close
     Farben, Schrift, Dropdown-Mase --vc-* / --up-* aus core.css

   ── Das Popup haengt im <body> ──────────────────────────────────────────────
   Bubble-Vorfahren clippen (overflow) und stapeln (z-index) gegen ein Overlay an. Overlay und
   Toast wandern darum in einen .up-root.up-portal-Wrapper an <body>. Der traegt die --vc-Tokens
   und das data-theme, und setUpstreemTheme() erfasst ihn dadurch von selbst -- die Komponente
   muss ihr Theme nicht mehr an drei Elemente einzeln schreiben. */
(function(){
  "use strict";

  /* Stubs, bevor irgendetwas auf core.js warten kann: Bubble ruft diese Namen unter Umstaenden
     schon, waehrend die CDN-Dateien noch laden. Gleiche Begruendung wie in jeder anderen
     Komponente. createWithAiGetPrompt fehlt hier bewusst -- es liefert einen Wert zurueck, und ein
     spaeter nachgeholter Aufruf haette niemanden mehr, dem er ihn geben koennte. */
  var __ucaBootQueue = window.__ucaBootQueue = window.__ucaBootQueue || [];
  if (!window.__ucaBootStubbed){
    window.__ucaBootStubbed = true;
    ["createWithAiOpen", "createWithAiSetContext", "createWithAiClose", "createWithAiSetTheme",
     "createWithAiSetYouUrls"].forEach(function(n){
      window[n] = function(){ __ucaBootQueue.push([n, arguments]); };
    });
  }

  function ucaBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ ucaBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[create-with-ai] UpstreemCore (core.js) not loaded");
      return;
    }
    ucaRun();
  }

  function ucaRun(){
  var UC = window.UpstreemCore;

  /* Eine Seite teilt sich EIN core.js, und es gewinnt das zuletzt geladene. Steht darauf ein
     aelterer Pin als auf dieser Datei, fehlen Kits -- die Komponente starb frueher mit einem
     nackten "UC.x is not a function", das die Ursache nicht nennt. */
  var MISSING = ["makeMount", "makeExplain", "esc"].filter(function(k){ return typeof UC[k] !== "function"; });
  if (MISSING.length && window.console){
    console.error("[create-with-ai] The core.js on this page is OLDER than create-with-ai.js and is " +
      "missing: " + MISSING.join(", ") + ". Every upstreem component on a page shares one core.js -- " +
      "pin them all to the same commit.");
  }

  var esc = UC.esc;

  var TEMPLATE_DEFAULT = "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/content_templates/upstreem-matching-content-v2-0.txt";
  var LOGO = {
    chatgpt: "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/llm_logos/openai_logo.png",
    claude:  "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/llm_logos/claude-logo%20(1).svg",
    gemini:  "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/llm_logos/gemini_logo.webp",
    grok:    "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/llm_logos/grok_logo.webp"
  };
  var ASSISTANTS = {
    chatgpt: { name: "ChatGPT",          desc: "Balanced writing and structure",      url: "https://chatgpt.com/?q=" },
    claude:  { name: "Claude",           desc: "Best for long-form, nuanced writing", url: "https://claude.ai/new?q=" },
    gemini:  { name: "Google AI Studio", desc: "Great for research-heavy drafts",     url: "https://aistudio.google.com/prompts/new_chat?prompt=" },
    grok:    { name: "Grok",             desc: "Clear drafts with a direct tone",     url: "https://grok.com/?q=" }
  };
  var ORDER = ["chatgpt", "claude", "gemini", "grok"];
  var SUGGESTS = ["Do not mention pricing", "Focus on SMEs", "Keep the tone factual", "Add a short FAQ"];

  var SV = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  var X_SVG      = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>';
  var X_SMALL    = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="2"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></svg>';
  var CHECK_SVG  = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="3"><path d="M20 6 9 17l-5-5" /></svg>';
  var CHECK_BOLD = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="3.2"><path d="M20 6 9 17l-5-5" /></svg>';
  var HELP_SVG   = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.7"><circle cx="12" cy="12" r="9.2"></circle><path d="M9.6 9.4a2.4 2.4 0 0 1 4.6.9c0 1.6-2.2 1.9-2.2 3.4"></path><line x1="12" y1="17.4" x2="12.01" y2="17.4"></line></svg>';
  var BULB_SVG   = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.8"><line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>';
  var LINK_SVG   = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.7"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
  var CHEV_SVG   = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="m9 18 6-6-6-6" /></svg>';
  var BACK_SVG   = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.9"><path d="m12 19-7-7 7-7" /> <path d="M19 12H5" /></svg>';
  var COPY_SVG   = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.7"><rect x="9" y="9" width="11" height="11" rx="2.4"></rect><path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1"></path></svg>';
  var FILE_SVG   = '<svg viewBox="0 0 24 24" ' + SV + ' stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="13" y2="17"></line></svg>';
  var GLOBE_SVG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
  /* ---------------------------------------------------------------------------
     Erklaerkarten der drei Ausgabeformate.
     Alle drei zeigen DENSELBEN Dreizeiler, einmal je Format. Das ist der Punkt: nur so sieht man,
     was sich zwischen den Formaten tatsaechlich aendert, statt drei verschiedene Beispiele zu
     vergleichen. Die Auszeichnung ist eingefaerbt, weil genau sie den Unterschied ausmacht --
     dass beim Plain Text nichts eingefaerbt ist, IST die Aussage.
     --------------------------------------------------------------------------- */
  var M = function(s){ return '<span class="uca-sy-mark">' + s + "</span>"; };
  var T = function(s){ return '<span class="uca-sy-tag">' + s + "</span>"; };
  var FORMATS = {
    markdown: {
      h: "Markdown",
      t: "Clean Markdown, ready to paste into most modern CMS and editors (Notion, Ghost, the WordPress block editor).",
      sample:
        M("##") + " Fast setup\n" +
        "Works in " + M("**") + "minutes" + M("**") + ".\n" +
        M("[") + "See pricing" + M("](/pricing)")
    },
    html: {
      h: "HTML",
      t: "Semantic tags only — headings, paragraphs, lists, links. No styling. For classic editors like WordPress or Webflow.",
      sample:
        T("&lt;h2&gt;") + "Fast setup" + T("&lt;/h2&gt;") + "\n" +
        T("&lt;p&gt;") + "Works in " + T("&lt;b&gt;") + "minutes" + T("&lt;/b&gt;") + "." + T("&lt;/p&gt;") + "\n" +
        T("&lt;a") + ' <span class="uca-sy-attr">href</span>=<span class="uca-sy-str">"/pricing"</span>' + T("&gt;") + "See pricing" + T("&lt;/a&gt;")
    },
    plain: {
      h: "Plain text",
      t: "No formatting at all. Best if you will style the content yourself in Google Docs or Word.",
      sample: "Fast setup\nWorks in minutes.\nSee pricing: /pricing"
    }
  };

  function explainHtml(key){
    var f = FORMATS[key];
    if (!f) return "";
    return '<div class="up-explain-vis"><div class="uca-sample">' + f.sample + "</div></div>" +
           '<div class="up-explain-h">' + esc(f.h) + "</div>" +
           '<div class="up-explain-t">' + esc(f.t) + "</div>";
  }

  /* ---------------------------------------------------------------------------
     Markup. Frueher stand das als fertiges HTML im Bubble-Element -- das war der Grund, warum ein
     einziger Tippfehler beim Einfuegen die Komponente lahmlegte und warum jede Aenderung ein
     erneutes Einfuegen brauchte. Jetzt baut die Komponente es selbst; das Bubble-Element ist ein
     leeres Div plus Loader.
     --------------------------------------------------------------------------- */
  function triggerHtml(){
    /* up-export dazu: der Knopf IST der Export-Knopf der App -- gefuellte Flaeche, 32 hoch,
       8px Polsterung auf beiden Seiten, 8px Abstand zum Zeichen, 12px/560. Vorher stand das alles
       noch einmal in create-with-ai.css, mit eigenen Werten (13.5px Schrift, 7px Abstand, links 7
       rechts 8) -- und genau daher kam der Eindruck, rechts sei zu viel Platz. */
    return '<button class="uca-trigger up-export" type="button" data-trigger aria-haspopup="dialog">' +
             '<span class="uca-star" aria-hidden="true">' + UC.icon("astroid", 2) + '</span>' +
             '<span class="uca-trigger-label">Create</span>' +
           "</button>";
  }

  function overlayHtml(){
    return '<div class="uca-overlay" data-overlay role="dialog" aria-modal="true" aria-label="Create with AI">' +
      '<div class="uca-modal" data-modal>' +

        '<div class="uca-head">' +
          '<div class="uca-head-title">' +
            '<span class="uca-action">' +
              '<span class="uca-action-ic" data-action-ic></span>' +
              '<span class="uca-action-text" data-action-label>–</span>' +
            "</span>" +
            '<button class="uca-help" type="button" data-help aria-label="How Create with AI works">' + HELP_SVG + "</button>" +
          "</div>" +
          '<button class="up-popup-close" type="button" data-close aria-label="Close">' + X_SVG + "</button>" +
        "</div>" +

        '<div class="uca-body">' +
          '<div class="uca-source">' +
            '<div class="uca-fav" data-fav></div>' +
            '<div class="uca-source-meta">' +
              '<div class="uca-source-title" data-source-title>–</div>' +
              '<div class="uca-source-url" data-source-url>–</div>' +
            "</div>" +
          "</div>" +

          '<div class="uca-section">' +
            '<div class="uca-label">What should the AI consider?</div>' +
            '<div class="uca-input-row">' +
              '<div class="uca-input-wrap" data-input-wrap>' +
                '<input class="uca-input" data-input type="text" placeholder="" maxlength="250" autocomplete="off" spellcheck="false" />' +
                '<div class="uca-ph-loop" aria-hidden="true"><span class="uca-ph-text" data-ph>Add instructions…</span></div>' +
                '<button class="uca-bulb" type="button" data-bulb aria-label="Show suggestions" aria-pressed="false">' + BULB_SVG + "</button>" +
              "</div>" +
              '<button class="uca-apply" type="button" data-apply>Apply</button>' +
            "</div>" +
            '<div class="uca-suggests" data-suggests>' +
              SUGGESTS.map(function(s){
                return '<button class="uca-suggest" type="button" data-suggest="' + esc(s) + '">' + esc(s) + "</button>";
              }).join("") +
            "</div>" +
            '<div class="uca-tags" data-tags></div>' +

            '<button class="uca-links-entry" type="button" data-links-entry>' +
              '<span class="uca-links-ic">' + LINK_SVG + "</span>" +
              '<span class="uca-links-meta">' +
                '<span class="uca-links-title">Internal Links</span>' +
                '<span class="uca-links-sub">Your pages the content should link to (max 3)</span>' +
              "</span>" +
              '<span class="uca-links-count" data-links-count></span>' +
              '<span class="uca-links-chev">' + CHEV_SVG + "</span>" +
            "</button>" +

            '<div class="uca-format">' +
              '<div class="uca-format-label">Output format</div>' +
              '<div class="uca-format-seg" data-format-seg>' +
                ["markdown", "html", "plain"].map(function(k){
                  return '<button class="uca-fmt' + (k === "markdown" ? " is-active" : "") + '" type="button" ' +
                    'data-fmt="' + k + '" data-explain="' + k + '">' + esc(FORMATS[k].h) + "</button>";
                }).join("") +
              "</div>" +
            "</div>" +

            '<button class="uca-cb-row" type="button" data-schema role="checkbox" aria-checked="false">' +
              '<span class="uca-cb" aria-hidden="true">' + CHECK_BOLD + "</span>" +
              '<span class="uca-cb-meta">' +
                '<span class="uca-cb-label">Add schema markup (JSON-LD)</span>' +
                '<span class="uca-cb-sub">Structured data snippet for your CMS, generated to match the content.</span>' +
              "</span>" +
            "</button>" +
          "</div>" +

          '<div class="uca-section">' +
            '<div class="uca-label">AI assistant</div>' +
            '<div class="uca-assistants" data-assistants></div>' +
          "</div>" +
        "</div>" +

        '<div class="uca-foot">' +
          '<button class="uca-primary" type="button" data-primary>' +
            '<span class="uca-star" aria-hidden="true">' + UC.icon("astroid", 2) + '</span><span data-primary-label>Open in ChatGPT</span>' +
          "</button>" +
          '<div class="uca-note">You need to be logged in to the selected AI provider for this to work!</div>' +
          '<div class="uca-secondary">' +
            '<button class="uca-ghost" type="button" data-copy>' + COPY_SVG + "<span>Copy prompt</span></button>" +
            '<button class="uca-ghost" type="button" data-preview>' + FILE_SVG + "<span>Preview .md file</span></button>" +
          "</div>" +
        "</div>" +

        '<div class="uca-builder" data-builder>' +
          '<div class="uca-bld-head">' +
            '<button class="uca-bld-back" type="button" data-bld-back aria-label="Back">' + BACK_SVG + "</button>" +
            '<span class="uca-bld-count" data-bld-count>0/3</span>' +
          "</div>" +
          '<div class="uca-bld-explain">Pick up to 3 of your own pages. The AI will link to them naturally inside the generated content where they fit — good for SEO and for connecting your pages. You can also paste any URL of your own site below.</div>' +
          '<div class="uca-bld-search">' +
            '<input class="uca-bld-input" data-bld-input type="text" placeholder="Search your pages or paste a URL…" autocomplete="off" spellcheck="false" />' +
            '<button class="uca-bld-add" type="button" data-bld-add hidden>Add</button>' +
          "</div>" +
          '<div class="uca-bld-list" data-bld-list></div>' +
        "</div>" +

        '<div class="uca-how" data-how role="tooltip">' +
          '<div class="uca-how-title">How Create with AI works</div>' +
          '<div class="uca-how-body">' +
            "We open your selected assistant with a ready-to-use prompt for this recommendation.<br><br>" +
            "Make sure you are logged in to the selected AI assistant. In most cases, a free account is enough.<br><br>" +
            "The prompt includes the source URL, your brand, topics, competitors and market.<br><br>" +
            "It also links to an upstreem .md file. A .md file is a Markdown text file: simple, structured instructions that are easy for humans and AI models to read.<br><br>" +
            "The .md file defines the writing rules, output structure and quality guidelines. The assistant should read it first, then analyze the source URL and create original content for your brand.<br><br>" +
            "You can still edit the prompt inside the assistant before sending it. For example, add a more specific page goal, extra brand context or additional instructions at the bottom.<br><br>" +
            "Nothing is published automatically. You stay in control." +
          "</div>" +
        "</div>" +

      "</div>" +
    "</div>" +
    '<div class="uca-toast" data-toast aria-live="polite"></div>';
  }

  /* ---------------------------------------------------------------------------
     Eine Instanz
     --------------------------------------------------------------------------- */
  function initRoot(root){
    if (root.getAttribute("data-uca-init")) return;
    root.setAttribute("data-uca-init", "1");

    var UID = "uca_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    root.setAttribute("data-uid", UID);

    var S = {
      url: "", citation_type: "",
      lead_title: "", lead_domain: "", lead_favicon: "",
      own_brand_name: "", own_brand_summary: "",
      youUrls: [], youLoaded: false, selectedLinks: [],
      format: "markdown", schema: false, suggestsOpen: false, inputFocused: false,
      template_url: TEMPLATE_DEFAULT, tags: [], assistant: "chatgpt"
    };

    root.innerHTML = triggerHtml();

    /* Portal: Overlay und Toast nach <body>. Der Wrapper traegt up-root (dadurch die --vc-Tokens)
       und up-portal (dadurch erfasst ihn setUpstreemTheme). display:contents aus core macht ihn
       layout-neutral, das fixed positionierte Overlay darin verhaelt sich also wie zuvor. */
    var portal = document.createElement("div");
    portal.className = "up-root up-portal uca-portal";
    portal.setAttribute("data-uid", UID);
    portal.innerHTML = overlayHtml();
    document.body.appendChild(portal);
    portal._ucaRoot = root;

    /* Top Layer statt z-index -- siehe die Begruendung bei .uca-portal[popover] in der CSS.
       "manual", damit der Browser nicht licht-schliesst: Scrim und Escape erledigen das Schliessen
       bereits, und ein Auto-Dismiss wuerde das Popup bei jedem Klick DARIN zumachen.
       Feature-erkannt: wo showPopover fehlt, bleibt alles wie zuvor, also body-montiert auf
       z-index 2147483000. */
    var kannPopover = typeof portal.showPopover === "function" && typeof portal.hidePopover === "function";
    if (kannPopover){ try { portal.setAttribute("popover", "manual"); } catch(e){ kannPopover = false; } }
    function portalZeigen(){ if (kannPopover){ try { portal.showPopover(); } catch(e){} } }
    function portalVerstecken(){ if (kannPopover){ try { portal.hidePopover(); } catch(e){} } }

    /* Nur VERWAISTE Portale wegraeumen (deren Wurzel ein Bubble-Rerender entfernt hat). Andere
       lebende Instanzen bleiben stehen -- in einer Repeating Group sind das die Nachbarzeilen. */
    Array.prototype.slice.call(document.querySelectorAll("body > .uca-portal")).forEach(function(n){
      if (n !== portal && (!n._ucaRoot || !document.documentElement.contains(n._ucaRoot))){
        if (n.parentNode) n.parentNode.removeChild(n);
      }
    });

    var q  = function(sel){ return root.querySelector(sel); };
    var qp = function(sel){ return portal.querySelector(sel); };

    var elTrigger  = q("[data-trigger]");
    var elTrigLbl  = q(".uca-trigger-label");
    var elOverlay  = qp("[data-overlay]");
    var elModal    = qp("[data-modal]");
    var elFav      = qp("[data-fav]");
    var elSTitle   = qp("[data-source-title]");
    var elSUrl     = qp("[data-source-url]");
    var elALabel   = qp("[data-action-label]");
    var elActionIc = qp("[data-action-ic]");
    var elSuggests = qp("[data-suggests]");
    var elInput    = qp("[data-input]");
    var elInputWrap= qp("[data-input-wrap]");
    var elPhText   = qp("[data-ph]");
    var elBulb     = qp("[data-bulb]");
    var elTags     = qp("[data-tags]");
    var elAssist   = qp("[data-assistants]");
    var elPLabel   = qp("[data-primary-label]");
    var elCopy     = qp("[data-copy]");
    var elHow      = qp("[data-how]");
    var elToast    = qp("[data-toast]");
    var elLinksCnt = qp("[data-links-count]");
    var elFormatSeg= qp("[data-format-seg]");
    var elSchema   = qp("[data-schema]");
    var elBldCount = qp("[data-bld-count]");
    var elBldInput = qp("[data-bld-input]");
    var elBldAdd   = qp("[data-bld-add]");
    var elBldList  = qp("[data-bld-list]");

    /* ---- Theme ---- */
    function applyTheme(t){
      t = (String(t).toLowerCase() === "dark") ? "dark" : "light";
      [root, portal].forEach(function(el){
        el.setAttribute("data-theme", t);
        el.setAttribute("data-isdark", t === "dark" ? "yes" : "no");
      });
      try { window.__ucaTheme = t; } catch(e){}
    }
    function isDark(){ return portal.getAttribute("data-theme") === "dark"; }

    /* ---- Erklaerkarte der Formate: das App-Popover, kein eigener Tooltip-Typ ----
       mount: portal, nicht der Standard <body>. Das Popup liegt im Top Layer (siehe oben), und
       der wird nach dem gesamten Dokument gezeichnet -- eine Karte am body lag dahinter, mit
       z-index 2147483001 genauso wie mit jeder anderen Zahl. Sie muss IN das befoerderte Element,
       dann faehrt sie mit. */
    UC.makeExplain({ root: elFormatSeg, cls: "uca-explain", mount: portal, getIsDark: isDark, html: explainHtml });

    /* ---- kleine Helfer ---- */
    function looseParse(v){
      if (v && typeof v === "object") return v;
      if (typeof v !== "string") return {};
      /* UC.readBubble zuerst: das ist die EINE geteilte Reparatur, die jede andere Komponente
         benutzt, und sie kennt die Faelle, die Bubble wirklich liefert -- nacktes yes/no, ein
         Emoji ohne Anfuehrungszeichen, rohe Zeilenumbrueche, unquotierte Schluessel. Der eigene
         Weg hier kannte nur JSON.parse plus einen Tausch von Apostrophen gegen
         Anfuehrungszeichen und gab bei allem anderen {} zurueck -- still. Genau so hat der
         Emoji-Fehler in top-citations eine ganze Runde Reparaturen ueberlebt: es gab zwei
         Kopien der Reparatur, und nur eine wurde geflickt. */
      if (UC && UC.readBubble){
        var p = UC.readBubble(v);
        /* AUSPACKEN. readBubble ist der LISTEN-Leser der App: ein einzelnes Objekt kommt als Liste
           mit einem Eintrag zurueck. Ohne diese Zeile gab looseParse die LISTE zurueck, setContext
           las p.url daran -- undefined -- und setzte nichts. Der Aufruf meldete trotzdem true.
           Damit hat createWithAiSetContext/Open mit einem Text-Payload seit dem Umstieg auf
           readBubble gar nichts getan; nur die data-Attribute kamen noch an. Gemessen: readBubble
           auf {"url":…} gibt [object Array] der Laenge 1 zurueck, und setContext liess den Titel
           in ALLEN Instanzen unveraendert -- auch in der, die ihre Attribute korrekt las.
           brand-editor und url-detail packen an derselben Stelle schon aus; hier fehlte es. */
        if (Array.isArray(p) && p.length === 1 && p[0] && typeof p[0] === "object") p = p[0];
        if (p && typeof p === "object" && !Array.isArray(p)) return p;
      }
      try { return JSON.parse(v); } catch(e){
        try { return JSON.parse(v.replace(/'/g, '"')); } catch(e2){ return {}; }
      }
    }
    function domainOf(u){
      if (!u) return "";
      try {
        var h = new URL(/^https?:\/\//i.test(u) ? u : "https://" + u).hostname;
        return h.replace(/^www\./, "");
      } catch(e){
        return String(u).replace(/^https?:\/\//i, "").replace(/^www\./, "").split(/[\/?#]/)[0];
      }
    }
    function faviconFor(url){
      var d = domainOf(url);
      return d ? "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(d) + "&sz=64" : "";
    }
    function faviconUrl(){ return S.lead_favicon || faviconFor(S.url); }
    function imgHtml(src){
      return '<img src="' + esc(src) + '" alt="" referrerpolicy="no-referrer" ' +
             "onerror=\"this.style.display='none'\" />";
    }
    function isYou(){ return String(S.citation_type || "").trim().toLowerCase() === "you"; }
    function action(){
      return isYou()
        ? { mode: "improve", label: "Improve this page",      icon: UC.icon("astroid", 2) }
        : { mode: "create",  label: "Create your own version", icon: UC.icon("astroid", 2) };
    }
    function toast(msg){
      elToast.textContent = msg;
      elToast.classList.add("is-on");
      clearTimeout(elToast._t);
      elToast._t = setTimeout(function(){ elToast.classList.remove("is-on"); }, 1900);
    }

    /* ---- Prompt ---- */
    function formatLabel(){ return S.format === "html" ? "clean HTML" : (S.format === "plain" ? "plain text" : "Markdown"); }
    function buildPromptText(){
      var L = [];
      L.push("Use this upstreem template:");
      L.push(S.template_url || TEMPLATE_DEFAULT);
      L.push("");
      L.push("Follow the template exactly. First read the template URL, then read the source URL below. If you cannot access or read the source URL, do not guess. Return the error message defined in the template.");
      L.push("");
      L.push("mode: " + action().mode);
      L.push("own_brand_name: " + (S.own_brand_name || ""));
      L.push("source_url: " + (S.url || ""));
      L.push("source_title: " + (S.lead_title || ""));
      L.push("");
      L.push("additional_instructions:");
      var items = [];
      if (S.own_brand_summary) items.push("- Brand context (verified): " + String(S.own_brand_summary).replace(/\s+/g, " ").trim());
      S.tags.forEach(function(t){ items.push("- " + t); });
      items.push("- Output format: " + formatLabel());
      S.selectedLinks.slice(0, 3).forEach(function(l){
        items.push("- Link naturally to: " + l.url + (l.title ? ' ("' + l.title + '")' : ""));
      });
      if (S.schema) items.push("- Add JSON-LD schema markup");
      if (!items.length) items.push("- (none)");
      items.forEach(function(x){ L.push(x); });
      L.push("");
      L.push("Task:");
      L.push("Do all analysis internally, then output only the clean content structure the template defines: SEO title, meta description, URL slug, H1, full body, FAQ if appropriate, CTA, followed by the short footer (improve mode: the change list, then Verify Before Publishing). No other text before or after.");
      return L.join("\n");
    }
    function buildUrl(){
      return (ASSISTANTS[S.assistant] || ASSISTANTS.chatgpt).url + encodeURIComponent(buildPromptText());
    }

    /* ---- Render ---- */
    function renderSource(){
      var a = action();
      elALabel.textContent = a.label;
      elActionIc.innerHTML = a.icon;
      if (!S.url){
        elFav.innerHTML = GLOBE_SVG;
        elSTitle.textContent = "No source passed yet";
        elSUrl.textContent = "Open with url + citation_type to fill this";
        return;
      }
      var fav = faviconUrl();
      elFav.innerHTML = fav ? imgHtml(fav) : GLOBE_SVG;
      /* KEIN Rueckfall auf die Domain: die steht eine Zeile tiefer, und zweimal dasselbe sieht aus
         wie ein verlorener Titel -- genau so ist es gemeldet worden ("da steht die Domain, wo der
         Titel stand"). Fehlt der Titel wirklich, sagt die Zeile das neutral. */
      /* Wenn hier der Rueckfall steht, will man WISSEN warum -- sonst sucht man an der falschen
         Stelle (gemeldet als "bei title steht selected source, nicht der title"). Einmal je
         Wurzel, damit eine Mutation nicht dauernd schreibt. */
      if (!S.lead_title && !titelGemeldet && window.console){
        titelGemeldet = true;
        var rohTitel = root.getAttribute("data-title");
        console.info("[create-with-ai] Kein Titel da, es steht der Rueckfall \"Selected source\". " +
          "data-title am Element: " + JSON.stringify(rohTitel) +
          (rohTitel && (PLATZHALTER[rohTitel] || rohTitel.indexOf("INSERT") !== -1)
            ? "  -> das ist noch der PLATZHALTER aus der Vorlage und wird ignoriert; dort gehoert " +
              "der dynamische Bubble-Ausdruck hinein."
            : (rohTitel ? "" : "  -> Attribut fehlt oder ist leer.")) +
          "  Ein Aufruf hat den Zustand gesetzt: " + (_explicit ? "ja" : "nein") +
          (_explicit ? "  -> ein setContext/open ohne lead_title ueberschreibt den Titel nicht, " +
                       "aber es setzt auch keinen. Gib lead_title mit oder trage data-title ein."
                     : "") +
          "  Instanz: uid=" + UID + ", data-instance=" +
          JSON.stringify(root.getAttribute("data-instance") || ""));
      }
      elSTitle.textContent = S.lead_title || "Selected source";
      elSUrl.textContent = S.lead_domain || domainOf(S.url) || S.url || "";
    }
    function renderAssistants(){
      elAssist.innerHTML = ORDER.map(function(k){
        var a = ASSISTANTS[k];
        return '<button class="uca-assistant' + (S.assistant === k ? " is-selected" : "") + '" type="button" data-assistant="' + k + '">' +
          '<span class="uca-ai-logo">' + imgHtml(LOGO[k]) + "</span>" +
          '<span class="uca-ai-meta"><span class="uca-ai-name">' + esc(a.name) + "</span>" +
            '<span class="uca-ai-desc">' + esc(a.desc) + "</span></span>" +
          '<span class="uca-ai-check">' + CHECK_SVG + "</span>" +
        "</button>";
      }).join("");
    }
    function renderPrimary(){ elPLabel.textContent = "Open in " + (ASSISTANTS[S.assistant] || ASSISTANTS.chatgpt).name; }
    function renderTags(){
      elTags.innerHTML = S.tags.map(function(t, i){
        return '<span class="uca-tag"><span>' + esc(t) + "</span>" +
          '<button class="uca-tag-x" type="button" data-idx="' + i + '" aria-label="Remove">' + X_SMALL + "</button></span>";
      }).join("");
      Array.prototype.forEach.call(elSuggests.querySelectorAll(".uca-suggest"), function(b){
        b.classList.toggle("is-used", S.tags.indexOf(b.getAttribute("data-suggest")) !== -1);
      });
    }
    function renderTrigger(){ if (elTrigLbl) elTrigLbl.textContent = isYou() ? "Improve" : "Create"; }
    function renderFormat(){
      Array.prototype.forEach.call(elFormatSeg.querySelectorAll(".uca-fmt"), function(b){
        b.classList.toggle("is-active", b.getAttribute("data-fmt") === S.format);
      });
    }
    function renderSchema(){
      elSchema.classList.toggle("is-checked", !!S.schema);
      elSchema.setAttribute("aria-checked", S.schema ? "true" : "false");
    }
    function renderSuggestsOpen(){
      elSuggests.classList.toggle("is-open", !!S.suggestsOpen);
      elBulb.classList.toggle("is-on", !!S.suggestsOpen);
      elBulb.setAttribute("aria-pressed", S.suggestsOpen ? "true" : "false");
    }
    function renderLinksEntry(){
      var n = S.selectedLinks.length;
      elLinksCnt.textContent = n ? (n + " selected") : "";
    }
    function renderAll(){
      renderTrigger(); renderSource(); renderAssistants(); renderPrimary(); renderTags();
      renderLinksEntry(); renderFormat(); renderSchema(); renderSuggestsOpen(); phUpdate();
    }

    /* ---- laufender Platzhalter ---- */
    var PH_ITEMS = ["Add instructions…"].concat(SUGGESTS);
    var phIdx = 0, phTimer = null;
    /* Nur bei OFFENEM Fenster. Der laufende Platzhalter steht im Eingabefeld des Modals -- ist das
       zu, sieht ihn niemand, und die Uhr lief trotzdem: alle fuenf Sekunden ein Tick mit einem
       erzwungenen Umbruch (void offsetWidth), und zwar je Platzierung. In einer Repeating Group
       sind das so viele Uhren wie Zeilen. Genau das stand reihenweise in der Konsole eines
       Nutzers ("'setTimeout' handler took 55ms" aus create-with-ai, alle paar Sekunden).
       open() und close() rufen beide renderAll(), und das ruft phUpdate -- die Uhr startet also
       beim Oeffnen und haelt beim Schliessen von selbst. */
    function phLoopActive(){
      return elOverlay.classList.contains("is-open") && !S.inputFocused && !elInput.value.trim();
    }
    function phStart(){
      phStop();
      if (!phLoopActive()) return;
      phIdx = 0;
      elPhText.style.transition = "none";
      elPhText.classList.remove("is-out", "is-in");
      elPhText.textContent = PH_ITEMS[0];
      void elPhText.offsetWidth;
      elPhText.style.transition = "";
      phTimer = setInterval(phTick, 5000);
    }
    function phStop(){ if (phTimer){ clearInterval(phTimer); phTimer = null; } }
    function phTick(){
      if (PH_ITEMS.length < 2) return;
      var t = elPhText;
      t.classList.add("is-out");
      setTimeout(function(){
        phIdx = (phIdx + 1) % PH_ITEMS.length;
        t.style.transition = "none";
        t.classList.remove("is-out"); t.classList.add("is-in");
        t.textContent = PH_ITEMS[phIdx];
        void t.offsetWidth;
        t.style.transition = "";
        t.classList.remove("is-in");
      }, 240);
    }
    function phUpdate(){
      var on = phLoopActive();
      elInputWrap.classList.toggle("loop-on", on);
      elInput.setAttribute("placeholder", (!on && !elInput.value.trim()) ? "Add instructions…" : "");
      if (on){ if (!phTimer) phStart(); } else phStop();
    }

    /* ---- Tags ---- */
    function addTag(text){
      var t = String(text || "").trim();
      if (!t) return;
      if (S.tags.indexOf(t) !== -1){ toast("Already added"); return; }
      S.tags.push(t); renderTags();
    }

    /* ---- Link-Builder ---- */
    function normUrl(u){
      u = String(u || "").trim();
      if (!u) return "";
      return /^https?:\/\//i.test(u) ? u : "https://" + u;
    }
    function normKey(s){ return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
    function looksLikeUrl(s){
      s = String(s || "").trim();
      if (!s) return false;
      if (/^https?:\/\//i.test(s)) return true;
      return s.indexOf(".") !== -1 && !/\s/.test(s);
    }
    function isSelected(url){
      var k = normKey(url);
      return S.selectedLinks.some(function(l){ return normKey(l.url) === k; });
    }
    function fireYouUrls(){
      if (typeof window.bubble_fn_get_you_urls === "function"){
        try { window.bubble_fn_get_you_urls(UID); } catch(e){}
      }
      try { root.dispatchEvent(new CustomEvent("get_you_urls", { bubbles: true, detail: { uid: UID } })); } catch(e){}
    }
    function setYouUrls(data){
      var arr = data;
      /* Nicht JSON.parse: die Liste kommt aus einem Bubble-Ausdruck und traegt Titel mit
         Anfuehrungszeichen, Umlauten und Emoji. JSON.parse warf daran und lieferte still eine
         leere Liste -- der Baukasten sah dann aus wie "keine Quellen gefunden". */
      if (typeof data === "string") arr = looseParse(data);
      if (!Array.isArray(arr)) arr = [];
      S.youUrls = arr.map(function(it){
        if (typeof it === "string") return { url: it, title: "" };
        return {
          url: String(it.url || it.link || ""),
          title: String(it.title || it.name || ""),
          favicon: it.favicon || it.favicon_url || ""
        };
      }).filter(function(x){ return x.url; });
      S.youLoaded = true;
      if (elModal.classList.contains("uca-in-builder")) renderBuilder();
    }
    function skeletonRow(){
      return '<div class="uca-bld-skel"><div class="uca-bld-skel-fav uca-skel"></div>' +
        '<div class="uca-bld-skel-lines"><div class="uca-bld-skel-l1 uca-skel"></div>' +
        '<div class="uca-bld-skel-l2 uca-skel"></div></div></div>';
    }
    function rowHtml(item){
      var sel = isSelected(item.url);
      var disabled = !sel && S.selectedLinks.length >= 3;
      var fav = item.favicon || faviconFor(item.url);
      var title = item.title || domainOf(item.url) || item.url;
      return '<button class="uca-bld-row' + (sel ? " is-selected" : "") + (disabled ? " is-disabled" : "") +
        '" type="button" data-url="' + esc(item.url) + '" data-title="' + esc(item.title || "") + '">' +
        '<span class="uca-bld-fav">' + (fav ? imgHtml(fav) : GLOBE_SVG) + "</span>" +
        '<span class="uca-bld-meta"><span class="uca-bld-title">' + esc(title) + "</span>" +
          '<span class="uca-bld-url">' + esc(item.url.replace(/^https?:\/\//i, "")) + "</span></span>" +
        '<span class="uca-bld-check">' + CHECK_SVG + "</span>" +
      "</button>";
    }
    function renderBuilderList(){
      if (!S.youLoaded){
        elBldList.innerHTML = skeletonRow() + skeletonRow() + skeletonRow() + skeletonRow() + skeletonRow();
        return;
      }
      var pool = S.youUrls.slice();
      S.selectedLinks.forEach(function(l){
        if (!pool.some(function(x){ return normKey(x.url) === normKey(l.url); })){
          pool.unshift({ url: l.url, title: l.title || "" });
        }
      });
      var nq = normKey(elBldInput.value);
      var list = nq ? pool.filter(function(it){ return normKey((it.title || "") + it.url).indexOf(nq) !== -1; }) : pool;
      elBldList.innerHTML = list.length
        ? list.map(rowHtml).join("")
        : '<div class="uca-bld-empty">No pages found. Paste a URL above to add it.</div>';
    }
    function renderBuilder(){
      renderBuilderList();
      elBldCount.textContent = S.selectedLinks.length + "/3";
    }
    function toggleLink(url, title){
      var k = normKey(url), i = -1;
      S.selectedLinks.forEach(function(l, idx){ if (normKey(l.url) === k) i = idx; });
      if (i !== -1) S.selectedLinks.splice(i, 1);
      else {
        if (S.selectedLinks.length >= 3) return;
        S.selectedLinks.push({ url: url, title: title || "" });
      }
      renderBuilder();
    }
    function updateAddBtn(){ elBldAdd.hidden = !looksLikeUrl(elBldInput.value); }
    function openBuilder(){
      elModal.style.height = elModal.getBoundingClientRect().height + "px";   // Popup-Groesse festhalten
      elModal.classList.add("uca-in-builder");
      elBldInput.value = ""; updateAddBtn();
      renderBuilder();
      fireYouUrls();
    }
    function backToMain(){
      elModal.classList.remove("uca-in-builder");
      elModal.style.height = "";
      renderLinksEntry();
    }

    /* ---- Kontext ---- */
    var CTX_KEYS = ["url", "citation_type", "lead_title", "lead_domain", "lead_favicon",
                    "own_brand_name", "own_brand_summary", "template_url"];
    function saveCtx(){
      try { var o = {}; CTX_KEYS.forEach(function(k){ o[k] = S[k]; }); window.__ucaCtx = o; } catch(e){}
    }
    function restoreCtx(){
      try {
        var o = window.__ucaCtx;
        if (o && typeof o === "object"){
          CTX_KEYS.forEach(function(k){ var v = o[k]; if (v != null && v !== "") S[k] = v; });
        }
      } catch(e){}
    }
    var _explicit = false;   // sobald Daten per run-JS kamen, duerfen Attribute sie nicht ueberschreiben
    var titelGemeldet = false;
    var PLATZHALTER = { SOURCE_URL: 1, SOURCE_TITLE: 1, BRAND_NAME: 1, CITATION_TYPE: 1, BRAND_SUMMARY: 1,
                        URL: 1, TITLE: 1, BRAND: 1, TYPE: 1, SUMMARY: 1 };
    /* Ein Platzhalter, der stehengeblieben ist, wird ignoriert -- und das wird EINMAL gesagt.
       Genau daran hat eine Runde Suche gehangen: das Element trug data-title="TITLE" aus der
       Vorlage, die Komponente warf den Wert still weg, und in der Titelzeile stand die Domain.
       Ein Attribut, das aussieht wie gesetzt und wie nicht gesetzt behandelt wird, muss sich
       melden. Je Attributname nur einmal, sonst schreibt jede Mutation eine neue Zeile. */
    var platzGemeldet = {};
    function attrOf(name){
      var v = root.getAttribute(name) || "";
      if (PLATZHALTER[v] || v.indexOf("INSERT") !== -1){
        if (!platzGemeldet[name] && window.console){
          platzGemeldet[name] = 1;
          console.warn("[create-with-ai] " + name + "=\"" + v + "\" ist noch der Platzhalter aus " +
            "der Vorlage und wird ignoriert. Dort gehoert der dynamische Bubble-Ausdruck hinein.");
        }
        return "";
      }
      return v;
    }
    function readAttrs(){
      /* Der Titel ist die eine Ausnahme von der _explicit-Sperre: ein Run-JS-Aufruf, der ihn nicht
         mitbringt, ist kein Grund, den vorhandenen wegzuwerfen. Alles andere bleibt gesperrt --
         dort gewinnt der Aufruf ueber das Attribut, so wie bisher. */
      if (_explicit){
        if (!S.lead_title){
          var tSpaet = attrOf("data-title");
          if (tSpaet){ S.lead_title = tSpaet; renderSource(); }
        }
        return;
      }
      var u = attrOf("data-url"), c = attrOf("data-citation-type"), t = attrOf("data-title"),
          br = attrOf("data-brand"), bs = attrOf("data-summary");
      if (u) S.url = u;
      if (c) S.citation_type = c;
      if (t) S.lead_title = t;
      if (br) S.own_brand_name = br;
      if (bs) S.own_brand_summary = bs;
      if (!S.lead_domain) S.lead_domain = domainOf(S.url);
    }
    function setContext(payload){
      var p = looseParse(payload);
      if (p.url != null || p.citation_type != null || p.own_brand_name != null || p.own_brand_summary != null) _explicit = true;
      if (p.url != null){
        S.url = String(p.url);
        /* Eine neue URL setzt die abgeleiteten Felder zurueck, ausser sie kommen im selben
           Aufruf mit -- sonst klebt der Titel der vorigen Quelle an der neuen. */
        if (p.lead_domain == null)  S.lead_domain = domainOf(S.url);
        /* Zuruecksetzen heisst NICHT loeschen: traegt das Element den Titel als data-title, gilt
           er weiter. Vorher fiel er hier weg, sobald ein Workflow setContext nur mit der URL rief
           -- und readAttrs holte ihn nicht zurueck, weil der Aufruf _explicit gesetzt hatte.
           Uebrig blieb die Domain in der Titelzeile. */
        if (p.lead_title == null)   S.lead_title = attrOf("data-title");
        if (p.lead_favicon == null) S.lead_favicon = "";
      }
      ["citation_type", "lead_title", "lead_domain", "lead_favicon", "own_brand_name", "own_brand_summary"]
        .forEach(function(k){ if (p[k] != null) S[k] = String(p[k]); });
      if (p.template_url) S.template_url = String(p.template_url);
      if (p.theme === "dark" || p.theme === "light") applyTheme(p.theme);
      if (!S.lead_domain) S.lead_domain = domainOf(S.url);
      saveCtx();
      renderAll();
    }

    /* ---- oeffnen / schliessen ---- */
    var _lastFocus = null;
    function onKey(e){
      if (e.key !== "Escape") return;
      if (elHow.classList.contains("is-open")) closeHow();
      else if (elModal.classList.contains("uca-in-builder")) backToMain();
      else close();
    }
    function openHow(){ elHow.classList.add("is-open"); }
    function closeHow(){ elHow.classList.remove("is-open"); }
    function open(){
      try {
        Array.prototype.forEach.call(document.querySelectorAll(".uca-overlay.is-open"), function(o){
          if (o !== elOverlay) o.classList.remove("is-open");
        });
      } catch(e){}
      readAttrs(); renderAll();
      portalZeigen();
      elOverlay.classList.add("is-open");
      /* NACH der Klasse: der laufende Platzhalter startet nur bei offenem Fenster, und renderAll()
         oben lief noch, als es zu war. Ohne diese Zeile bliebe das Feld beim Oeffnen stumm. */
      phUpdate();
      _lastFocus = document.activeElement;
      document.addEventListener("keydown", onKey);
    }
    function close(){
      elOverlay.classList.remove("is-open");
      portalVerstecken();
      closeHow();
      document.removeEventListener("keydown", onKey);
      backToMain();
      S.tags = []; S.selectedLinks = []; S.format = "markdown"; S.schema = false;
      S.suggestsOpen = false; S.inputFocused = false;
      try { elInput.value = ""; elBldInput.value = ""; } catch(e){}
      renderAll();
      try { if (_lastFocus && _lastFocus.focus) _lastFocus.focus(); } catch(e){}
    }

    /* ---- Ereignisse ---- */
    elTrigger.addEventListener("click", function(){ open(); });

    portal.addEventListener("click", function(e){
      if (e.target === elOverlay){ close(); return; }
      if (e.target.closest("[data-close]")){ close(); return; }
      if (e.target.closest("[data-help]")){
        e.stopPropagation();
        if (elHow.classList.contains("is-open")) closeHow(); else openHow();
        return;
      }
      if (e.target.closest("[data-apply]")){
        addTag(elInput.value); elInput.value = ""; elInput.focus(); phUpdate(); return;
      }
      if (e.target.closest("[data-bulb]")){
        e.stopPropagation(); S.suggestsOpen = !S.suggestsOpen; renderSuggestsOpen(); return;
      }
      var sug = e.target.closest("[data-suggest]");
      if (sug){ addTag(sug.getAttribute("data-suggest")); return; }
      var tagX = e.target.closest(".uca-tag-x");
      if (tagX){ S.tags.splice(parseInt(tagX.getAttribute("data-idx"), 10), 1); renderTags(); return; }
      var fmt = e.target.closest("[data-fmt]");
      if (fmt){ S.format = fmt.getAttribute("data-fmt"); renderFormat(); return; }
      if (e.target.closest("[data-schema]")){ S.schema = !S.schema; renderSchema(); return; }
      var asst = e.target.closest("[data-assistant]");
      if (asst){ S.assistant = asst.getAttribute("data-assistant"); renderAssistants(); renderPrimary(); return; }
      if (e.target.closest("[data-links-entry]")){ openBuilder(); return; }
      if (e.target.closest("[data-bld-back]")){ backToMain(); return; }
      if (e.target.closest("[data-bld-add]")){
        if (S.selectedLinks.length >= 3){ toast("Max 3 links"); return; }
        var u = normUrl(elBldInput.value);
        if (!u) return;
        if (!isSelected(u)) S.selectedLinks.push({ url: u, title: "" });
        elBldInput.value = ""; updateAddBtn(); renderBuilder();
        return;
      }
      var bldRow = e.target.closest(".uca-bld-row");
      if (bldRow && !bldRow.classList.contains("is-disabled")){
        toggleLink(bldRow.getAttribute("data-url"), bldRow.getAttribute("data-title"));
        return;
      }
      if (e.target.closest("[data-primary]")){ firePrimary(); return; }
      if (e.target.closest("[data-copy]")){ doCopy(); return; }
      if (e.target.closest("[data-preview]")){
        var tpl = S.template_url || TEMPLATE_DEFAULT;
        try { window.open(tpl, "_blank", "noopener"); } catch(e2){ location.href = tpl; }
        return;
      }
    });

    elInput.addEventListener("keydown", function(e){
      if (e.key === "Enter"){ e.preventDefault(); addTag(elInput.value); elInput.value = ""; phUpdate(); }
    });
    elInput.addEventListener("focus", function(){ S.inputFocused = true; phUpdate(); });
    elInput.addEventListener("blur",  function(){ S.inputFocused = false; phUpdate(); });
    elInput.addEventListener("input", phUpdate);

    elBldInput.addEventListener("input", function(){ updateAddBtn(); renderBuilderList(); });
    elBldInput.addEventListener("keydown", function(e){
      if (e.key === "Enter" && !elBldAdd.hidden){ e.preventDefault(); elBldAdd.click(); }
    });

    /* Aussenklick schliesst nur den How-Panel. Das Overlay selbst hat seinen eigenen Treffer
       oben; ein zweiter document-Listener dafuer wuerde beim Oeffnen sofort mitfeuern. */
    document.addEventListener("click", function(e){
      if (!elHow.classList.contains("is-open")) return;
      if (elHow.contains(e.target) || (e.target.closest && e.target.closest("[data-help]"))) return;
      closeHow();
    });

    function firePrimary(){
      var url = buildUrl();
      try { window.open(url, "_blank", "noopener"); } catch(e){ location.href = url; }
      if (typeof window.bubble_fn_create_with_ai_open === "function"){
        try {
          window.bubble_fn_create_with_ai_open(JSON.stringify({
            assistant: S.assistant, url: S.url, citation_type: S.citation_type, prompt_url: url
          }));
        } catch(e){}
      }
      try {
        root.dispatchEvent(new CustomEvent("upstreem:create-with-ai:open", {
          bubbles: true, detail: { assistant: S.assistant, prompt_url: url }
        }));
      } catch(e){}
    }
    function doCopy(){
      var text = buildPromptText();
      function pulse(){
        elCopy.innerHTML = CHECK_SVG + "<span>Copied</span>";
        clearTimeout(elCopy._t);
        elCopy._t = setTimeout(function(){ elCopy.innerHTML = COPY_SVG + "<span>Copy prompt</span>"; }, 1500);
      }
      function fallback(){
        try {
          var ta = document.createElement("textarea");
          ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.select();
          document.execCommand("copy"); document.body.removeChild(ta);
        } catch(e){}
      }
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(pulse, function(){ fallback(); pulse(); });
      } else { fallback(); pulse(); }
    }

    /* ---- Start ---- */
    readAttrs();
    S.lead_domain = S.lead_domain || domainOf(S.url);
    /* Der globale Kontext ist NUR ein Notnagel fuer reine run-JS-Aufbauten. Traegt diese Instanz
       eigene Attributdaten, gewinnen die immer -- sonst ueberschriebe der Kontext einer
       Nachbarzeile unseren citation_type, und der Knopf stuende auf "Create", obwohl die Zeile
       "You" ist. */
    if (!attrOf("data-url") && !attrOf("data-citation-type") && !attrOf("data-brand")) restoreCtx();

    /* Bubble fuellt dynamische Attribute manchmal erst NACH diesem Lauf. Die Beschriftung des
       Triggers ist vor dem Oeffnen sichtbar, also nachziehen. */
    try {
      if (window.MutationObserver){
        /* IMMER readAttrs, auch nach einem expliziten setContext -- die Sperre entscheidet drinnen,
           was uebernommen wird (nur ein noch leerer Titel). Hier lag der Rest des gemeldeten
           Fehlers: Bubble setzt data-title regelmaessig ERST nach dem Oeffnen, und wenn der
           Workflow davor setContext mit der url gerufen hat, stand _explicit -- der Beobachter rief
           dann gar nichts mehr, und der Titel kam nie an. */
        new MutationObserver(function(){ readAttrs(); renderTrigger(); })
          .observe(root, { attributes: true, attributeFilter: ["data-url", "data-title", "data-brand", "data-citation-type", "data-summary"] });
      }
    } catch(e){}

    applyTheme(
      (typeof window.__ucaTheme === "string" ? window.__ucaTheme : null) ||
      (root.getAttribute("data-isdark") === "yes" ? "dark" : null) ||
      root.getAttribute("data-theme") ||
      (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light")
    );
    renderAll();

    var api = {
      open: function(p){ if (p != null) setContext(p); open(); return true; },
      setContext: function(p){ setContext(p); return true; },
      close: function(){ close(); return true; },
      setTheme: function(t){ applyTheme(t); return true; },
      setYouUrls: function(d){ setYouUrls(d); return true; },
      getPrompt: function(){ return buildPromptText(); },
      uid: UID, root: root
    };
    window.createWithAi = window.createWithAi || {};
    window.createWithAi[UID] = api;
    try {
      Object.keys(window.createWithAi).forEach(function(k){
        var r = window.createWithAi[k].root;
        if (r && !document.documentElement.contains(r)) delete window.createWithAi[k];
      });
    } catch(e){}
    if (typeof window.bubble_fn_create_with_ai_ready === "function"){
      try { window.bubble_fn_create_with_ai_ready(UID); } catch(e){}
    }
  }

  /* ---------------------------------------------------------------------------
     Globale API. Erstes Argument wahlweise eine UID oder direkt die Nutzlast.
     --------------------------------------------------------------------------- */
  function live(){
    var reg = window.createWithAi || {};
    var ks = Object.keys(reg);
    for (var i = ks.length - 1; i >= 0; i--){
      var inst = reg[ks[i]];
      if (inst && inst.root && document.documentElement.contains(inst.root)) return inst;
    }
    return null;
  }
  /* Adressiert wird ueber die UID ODER ueber data-instance. Die UID ist der Weg fuer die
     Repeating Group (jede Zeile bekommt eine eigene, und der Workflow erfaehrt sie ueber
     bubble_fn_create_with_ai_ready). data-instance ist der Weg fuer den anderen Fall, der genauso
     vorkommt: ZWEI Elemente auf einer normalen Seite. Dort gab es bisher keinen -- ohne erstes
     Argument trifft ein Aufruf "die zuletzt lebende Instanz", und das ist bei zwei Elementen mal
     das eine und mal das andere. Genau so gemeldet am 01.09.: die eine Fassung ging, die andere
     nicht.
     Reihenfolge: UID zuerst (sie ist eindeutig), dann data-instance, dann die zuletzt lebende. */
  function nachInstanz(a){
    var reg = window.createWithAi || {}, ks = Object.keys(reg);
    for (var i = ks.length - 1; i >= 0; i--){
      var inst = reg[ks[i]];
      if (!inst || !inst.root || !document.documentElement.contains(inst.root)) continue;
      if (String(inst.root.getAttribute("data-instance") || "") === a) return inst;
    }
    return null;
  }
  function adressiert(a){
    if (typeof a !== "string" || !a) return null;
    var reg = window.createWithAi || {};
    return reg[a] || nachInstanz(a);
  }
  function resolve(a){
    return adressiert(a) || live();
  }
  function zweitesArg(a, b){
    return adressiert(a) ? b : a;
  }
  function ruf(a, b, fn){
    var inst = resolve(a);
    if (!inst){
      if (window.console) console.warn("[create-with-ai] no mounted instance on this page");
      return false;
    }
    return fn(inst, zweitesArg(a, b));
  }

  UC.makeMount({
    rootClass: "uca-root",
    notPortal: true,                 /* der Portal-Wrapper traegt uca-portal, nicht uca-root --
                                        notPortal ist trotzdem gesetzt, damit ein kuenftiger
                                        Umbau die Wurzeln nicht doppelt einsammelt */
    ctrlProp: "__ucaController",
    resolveLocal: "__ucaResolveLocal",
    queue: "__ucaBootQueue",
    initRoot: initRoot,
    api: {
      createWithAiOpen:       function(a, b){ return ruf(a, b, function(i, p){ return i.open(p); }); },
      createWithAiSetContext: function(a, b){ return ruf(a, b, function(i, p){ return i.setContext(p); }); },
      createWithAiClose:      function(a){ var i = resolve(a); return i ? i.close() : false; },
      createWithAiGetPrompt:  function(a){ var i = resolve(a); return i ? i.getPrompt() : ""; },
      createWithAiSetYouUrls: function(a, b){ return ruf(a, b, function(i, d){ return i.setYouUrls(d); }); },
      /* Theme ohne UID gilt fuer ALLE lebenden Instanzen -- eine Repeating Group wechselt das
         Theme nicht zeilenweise. */
      createWithAiSetTheme: function(a, b){
        var reg = window.createWithAi || {};
        if (typeof a === "string" && reg[a]) return reg[a].setTheme(b);
        var t = a;
        try { window.__ucaTheme = (String(t).toLowerCase() === "dark") ? "dark" : "light"; } catch(e){}
        var did = false;
        try {
          Object.keys(reg).forEach(function(k){
            var inst = reg[k];
            if (inst && inst.root && document.documentElement.contains(inst.root)){ inst.setTheme(t); did = true; }
          });
        } catch(e){}
        return did;
      }
    }
  });
  }

  ucaBoot(50);
})();
