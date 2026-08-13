/* upstreem settings-brand.js — die "Your Brand"-Seite der Einstellungen. Braucht core.js
   (window.UpstreemCore) davor, wie jede Komponente dieser Familie.

   ── Gegen die Kits gebaut, nicht daneben (STYLEGUIDE 25) ─────────────────────
   Die Dropdowns sind die Core-Dropdowns: .up-filter / .up-filter-btn / .up-filter-menu /
   .up-filter-item / .up-filter-check, Suchfeld .up-ddsearch mit .up-ddsearch-in/-ic/-x und dem
   has-text-Wechsel. Damit sehen sie aus wie jedes andere Dropdown der App: Chevron dreht sich
   nicht, offener Zustand ist ein grauer Hintergrund, kein farbiger Rahmen.
   Der Schalter fuer das Business Model ist .up-dense / .up-dense-btn / .is-active, derselbe wie
   der Active/Inactive-Schalter der Prompts-Tabelle.
   Die Marktauswahl ist Zeile fuer Zeile dieselbe wie in add-prompts: Flagge, Name, Zahl rechts,
   Haken links, Suche darueber.

   ── Speichern blockweise, nicht pro Feld ─────────────────────────────────────
   Model Settings und Meta Settings haben je EINEN Speichern-Knopf. Aenderungen laufen bis dahin
   in einen Entwurf und werden erst beim Klick gefeuert. Zwei Gruende: der Nutzer stellt in Meta
   Settings ueblicherweise mehreres hintereinander um, und vier einzelne Serverrunden dafuer sind
   vier Gelegenheiten, auf halbem Weg stehen zu bleiben.
   Name und Matching Aliases bleiben aussen vor -- der Knopf feuert nur ein Event, der Editor
   dafuer ist ein eigener Dialog auf Bubble-Seite.

   ── Logo ────────────────────────────────────────────────────────────────────
   Der Upload liest die Datei hier und gibt sie als Data-URL weiter, damit Bubble sie ablegen
   kann. PNG und SVG, hoechstens 1 MB. Die Grenze ist nicht willkuerlich: die Data-URL ist rund
   ein Drittel groesser als die Datei und wandert als Text durch Bubbles Event-Kanal.
   Der Weg ueber eine Bild-URL ist eingeklappt -- er ist die Ausnahme, nicht der Regelfall, und
   ein zweites Eingabefeld neben dem Knopf laesst beide gleich wichtig aussehen.

   ── Danger Zone ─────────────────────────────────────────────────────────────
   Leave und Delete verlangen den getippten Teamnamen. Delete zusaetzlich einen zweiten Klick auf
   denselben Knopf, der nach 4s von selbst verfaellt. */
(function(){
  "use strict";

  /* Bubble ruft setSettingsBrandLoading/renderSettingsBrand aus einem Workflow-Schritt, der beim
     Seitenaufbau laufen kann -- also bevor diese Datei ueberhaupt vom CDN da ist. Ohne diese
     Stubs wirft der Aufruf "is not a function" und ist weg: der Ladezustand kommt nie an, und die
     Modelle auch nicht. Genau das war der Grund, warum die Seite "0/3 models" zeigte, obwohl der
     Workflow-Schritt die Daten korrekt geholt hat. Jede andere Komponente dieser Familie hat
     diesen Block seit Langem (prompts-table.js:11), hier fehlte er.
     Die Aufrufe werden gemerkt und abgearbeitet, sobald die echten Funktionen stehen. */
  var __usbBootQueue = window.__usbBootQueue = window.__usbBootQueue || [];
  if (!window.__usbBootStubbed){
    window.__usbBootStubbed = true;
    ["renderSettingsBrand", "setSettingsBrandLoading", "setSettingsBrandLogo",
     "resetSettingsBrand"].forEach(function(n){
      window[n] = function(){ __usbBootQueue.push([n, arguments]); };
    });
  }

  function usbBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ usbBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    usbRun();
  }

  var MAX_LOGO_BYTES = 1024 * 1024;
  /* Deckel fuer die selbst eingetippte Branche. 48 Zeichen sind genug fuer "Industry &
     Manufacturing" mit Luft, und kurz genug, dass die Zeile im Dropdown und im Trigger nicht
     umbricht. Der Wert steht auch als maxlength am Feld, damit der Browser schon abschneidet. */
  var IND_MAX = 48;
  /* disabled_reason aus der RPC in einen Satz, den ein Nutzer versteht. Ein unbekannter Grund
     faellt auf den allgemeinen Satz zurueck, statt den rohen Schluessel anzuzeigen. */
  var REASON = {
    model_inactive: "This model is not available yet.",
    plan_limit:     "Your plan does not include this model.",
    not_allowed:    "Your plan does not include this model.",
    no_permission:  "Only admins can change the tracked models."
  };
  var LOGO_TYPES = ["image/png", "image/svg+xml"];

  var ICON = {
    edit:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    brand:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    pin:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    chev:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    x:      '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    trash:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    close:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  /* Feste Branchenliste. Sie kommt nicht aus Bubble, weil sie sich praktisch nie aendert und
     jeder Weg dorthin (Attribut, Payload) nur eine weitere Stelle waere, an der etwas fehlen kann.
     Wer etwas anderes braucht, tippt es unten im Dropdown selbst ein -- das Feld gibt es dafuer.
     Aendert sich die Liste doch einmal, wird sie hier geaendert; ein Payload mit industries
     uebersteuert sie weiterhin. */
  var INDUSTRIES = [
    "Agriculture & Food",
    "Automotive & Mobility",
    "Construction & Real Estate",
    "Consulting & Agencys",
    "E-Commerce & Retail",
    "Education & Training",
    "Energy & Utilities",
    "Fashion & Beauty",
    "Finance & Insurance",
    "Health & Pharma",
    "Hospitality & Gastronomy",
    "Industry & Manufacturing",
    "Legal & Compliance",
    "Logistics & Transport",
    "Media & Publishing",
    "Non-Profit & Public Sector",
    "SaaS & Software",
    "Sports & Fitness",
    "Telecommunications",
    "Travel & Tourism"
  ];

  var BUSINESS = [
    { value: "b2b",    label: "B2B" },
    { value: "b2c",    label: "B2C" },
    { value: "hybrid", label: "Hybrid (B2B & B2C)" }
  ];

  function makeController(root){
    var UC = window.UpstreemCore;
    var esc = UC.esc;
    var fire = UC.makeFire(root, { label: "settings-brand", eventPrefix: "usb" });

    /* saved = was der Server zuletzt bestaetigt hat, draft = was auf dem Bildschirm steht.
       Der Speichern-Knopf vergleicht die beiden; ohne diese Trennung gaebe es kein "geaendert". */
    var saved = { models: [], marketId: "", businessModel: "", industry: "", summary: "" };
    var draft = { models: [], marketId: "", businessModel: "", industry: "", summary: "" };
    var meta  = { brandName: "", brandLogo: "", teamName: "", teamId: "",
                  modelLimit: 3, canManage: true, markets: [], industries: INDUSTRIES.slice(), logoFileName: "" };
    var loading = false;

    function isDark(){ return UC.isYes(root.getAttribute("data-isdark")); }
    function cloneModels(list){ return list.map(function(m){ var c = {}; for (var k in m) c[k] = m[k]; return c; }); }
    function keysOf(list){ return list.filter(function(m){ return m.active; }).map(function(m){ return m.key; }).sort().join(","); }
    function flagUrl(a2){
      if (!a2) return "";
      var list = UC.getMarkets ? UC.getMarkets() : [];
      for (var i = 0; i < list.length; i++){
        if (String(list[i].alpha2 || "").toLowerCase() === String(a2).toLowerCase() && list[i].flag_url) return String(list[i].flag_url);
      }
      return "https://flagcdn.com/" + String(a2).toLowerCase() + ".svg";
    }

    /* Die Marktliste kommt aus dem seitenweiten Core-Store, den setUpstreemMarkets fuellt -- so wie
       bei jeder anderen Komponente, die Maerkte anbietet. EIN Aufruf pro Seite statt einer Liste
       im Payload jeder Komponente, und ein neu angelegter Markt erreicht alle auf einmal.
       Schluessel ist alpha2, genau wie in markets-filter und add-prompts.
       Der STORE gewinnt, nicht der Payload. Andersherum war es zuerst, und das war falsch: wer
       aus einer aelteren Fassung noch eine markets-Liste im renderSettingsBrand-Aufruf stehen hat,
       sah dauerhaft diese kurze Liste, obwohl setUpstreemAllMarkets laengst die volle geliefert
       hatte. Eine Liste im Payload greift jetzt nur noch, wenn der Store leer ist. */
    /* Die volle Liste notfalls SELBST aus der Warteschlange holen.
       Der Aufruf beim Seitenaufbau landet in window.__upstreemMarketQueue, wenn er kommt, bevor
       core.js da ist -- und core.js holt ihn nach. Ist auf der Seite aber ein core.js von einem
       aelteren Pin geladen (irgendeine andere Komponente mit altem data-cdn-pin gewinnt das
       Rennen), dann kennt dieses core.js setAllMarkets ueberhaupt nicht: die Warteschlange bleibt
       liegen, der Store zeigt "Aufrufe 0", und die Auswahl faellt kommentarlos auf die gefilterte
       Liste zurueck. Genau dieses Bild hatten wir.
       Statt darauf zu warten, dass jede Seite den richtigen Pin hat, liest die Komponente die
       liegengebliebenen Zeilen hier direkt. */
    function pendingAll(){
      var q = window.__upstreemMarketQueue;
      if (!q || !q.length) return [];
      for (var i = q.length - 1; i >= 0; i--){
        if (!q[i] || !q[i].all) continue;
        var rows = q[i].rows;
        if (typeof rows === "string"){
          var txt = rows
            .replace(/:\s*([,}\]])/g, ": null$1")
            .replace(/:\s*(yes|no)\s*([,}\]])/g, function(_, v, t){ return ": " + (v === "yes") + t; });
          try { rows = JSON.parse(txt); }
          catch(e){ rows = UC.parseBubbleJson ? UC.parseBubbleJson(rows) : null; }
        }
        if (Array.isArray(rows) && rows.length) return rows;
      }
      return [];
    }

    function marketList(){
      var quelle = "voll";
      /* NICHT einfach getAllMarkets() nehmen: core.js faellt darin still auf die gefilterte Liste
         zurueck, wenn der volle Store leer ist. Der Rueckgabewert ist also nie leer, und die
         Warteschlange darunter wurde nie erreicht -- die Auswahl zeigte eine Liste mit einem
         Eintrag und meldete trotzdem "Quelle ist die VOLLE Liste". Der Store wird deshalb ueber
         storeStats() gefragt, das die beiden auseinanderhaelt. */
      var voll = 0;
      if (UC.storeStats){ try { voll = UC.storeStats().allMarkets.n || 0; } catch(e){ voll = 0; } }
      var raw = (voll && UC.getAllMarkets) ? UC.getAllMarkets() : [];
      if (!raw.length){ raw = pendingAll(); if (raw.length) quelle = "warteschlange"; }
      if (!raw.length){ raw = UC.getMarkets ? UC.getMarkets() : []; if (raw.length) quelle = "gefiltert"; }
      if (!raw.length) return meta.markets;
      /* Einmal pro Sitzung in die Konsole schreiben, WOHER die Liste kommt. Ohne das ist "zu wenige
         Maerkte" nicht von "falsche Komponente" zu unterscheiden, und genau daran haben wir zwei
         Runden verloren. */
      if (!marketList._said && window.console && UC.storeStats){
        marketList._said = true;
        var st = UC.storeStats();
        console.info("[settings-brand] Marktliste: " + raw.length + " Eintraege. " +
          "Store allMarkets: " + st.allMarkets.n + " (Aufrufe " + st.allMarkets.calls +
          ", abgelehnt " + st.allMarkets.rejected + "), " +
          "Store markets (gefiltert): " + st.markets.n + ". " +
          (quelle === "voll" ? "Quelle ist die VOLLE Liste."
           : quelle === "warteschlange"
             ? "Quelle ist die WARTESCHLANGE -- das geladene core.js kennt setAllMarkets nicht " +
               "(alter data-cdn-pin an irgendeiner Komponente dieser Seite). Die Liste stimmt, " +
               "aber der Store bleibt leer."
             : "Quelle ist die GEFILTERTE Liste -- setUpstreemAllMarkets hat nichts geliefert."));
      }
      return raw.map(function(m){
        var a2 = String(m.alpha2 || m.alpha3 || "").toLowerCase();
        return { id: a2, name: m.name || a2.toUpperCase(),
                 score: m.prompt_count == null ? null : UC.toNum(m.prompt_count) };
      }).filter(function(m){ return !!m.id; });
    }
    function findMarket(id){
      if (!id) return null;
      var list = marketList();
      for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id).toLowerCase()) return list[i];
      return null;
    }

    /* ---------------- Geruest ---------------- */
    /* Das Dropdown der App, Knoten fuer Knoten wie der "All Brands"-Filter ueber den Tabellen:
       .up-ment als Huelle, .up-ment-btn als Knopf mit .up-ment-lbl und .up-ment-chev, .up-ment-menu
       als Liste, darin .up-filter-head / .up-ment-searchwrap / .up-filter-list / .up-filter-item.
       KEINE eigene Regel auf dem Knopf -- er ist rahmenlos (1px transparent, damit die Breite
       steht), 32px hoch, 12px/500, und wird im offenen Zustand grau hinterlegt. Genau das ist der
       Unterschied zu allem, was ich hier vorher gebaut hatte. */
    /* Der Filter-Trigger aus core: .up-ddwrap > .up-ddtrigger mit [Icon] [Text] [Chevron],
       genau wie Markets, Models, Topics und der Kalender. Das Menue darunter ist .up-ment-menu
       mit .up-ment-searchwrap und .up-filter-list, ebenfalls unveraendert aus core. */
    function ddHtml(kind, placeholder, searchLabel, title, icon){
      return '<div class="up-ddwrap usb-dd" data-dd="' + kind + '">' +
        '<button class="up-ddtrigger" type="button" data-dd-btn aria-haspopup="menu" aria-expanded="false">' +
          '<span class="up-ddtrigger-ic" data-dd-icon>' + icon + '</span>' +
          '<span class="up-ddtrigger-lbl" data-dd-label>' + esc(placeholder) + '</span>' +
          '<svg class="up-ddtrigger-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</button>' +
        '<div class="up-ment-menu usb-ddmenu" role="menu" aria-hidden="true">' +
          '<div class="up-filter-head"><span class="up-filter-title">' + esc(title) + '</span></div>' +
          '<div class="up-ment-searchwrap">' +
            '<input class="up-ment-search" type="text" placeholder="' + esc(searchLabel) + '" ' +
              'autocomplete="off" spellcheck="false" aria-label="' + esc(searchLabel) + '"/>' +
            '<button class="up-ment-searchclear" type="button" aria-label="Clear search">' + ICON.x + '</button>' +
          '</div>' +
          '<div class="up-filter-list up-ment-list" data-dd-list></div>' +
          (kind === "industry"
            ? '<div class="usb-ddcustom">' +
                '<div class="up-filter-title">Not listed? Add your own</div>' +
                '<div class="usb-ddcustom-row">' +
                  '<input class="up-ment-search usb-ddcustom-in" type="text" maxlength="' + IND_MAX + '" ' +
                    'placeholder="Your industry" autocomplete="off" spellcheck="false" ' +
                    'aria-label="Custom industry" data-dd-custom/>' +
                  '<button class="usb-ddcustom-add" type="button" data-dd-customadd disabled>Add</button>' +
                '</div>' +
              '</div>'
            : "") +
        '</div>' +
      '</div>';
    }

    root.innerHTML =
      '<div class="usb-body">' +

        '<section class="usb-sec">' +
          '<div class="usb-sechead">' +
            '<h2 class="usb-sectitle">Brand Settings</h2>' +
            '<p class="usb-secsub">Your brand identity as it appears across the workspace.</p>' +
          '</div>' +
          '<div class="usb-card">' +
            '<div class="usb-row">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Brand Name &amp; Matching Aliases</div>' +
                '<div class="usb-rowdesc">To edit your primary tracking and display name, or to add ' +
                  'matching aliases, use the button on the right.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<button class="up-btn-sec usb-btn" type="button" data-edit-brand>' +
                  ICON.edit + '<span class="usb-editbtn-lbl">Edit brand</span></button>' +
              '</div>' +
            '</div>' +
            '<div class="usb-div"></div>' +
            '<div class="usb-row">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Brand Logo</div>' +
                '<div class="usb-rowdesc">Change your logo to personalize your workspace. ' +
                  'Square images work best. PNG or SVG, up to 1 MB.</div>' +
              '</div>' +
              '<div class="usb-rowctl usb-logoctl">' +
                '<div class="usb-logoprev" data-logo-prev></div>' +
                '<div class="usb-logoforms">' +
                  '<div class="usb-uploadrow">' +
                    '<button class="up-btn-sec usb-btn" type="button" data-logo-pick>' +
                      ICON.upload + '<span>Upload</span></button>' +
                    '<span class="usb-filename" data-logo-file>No file selected</span>' +
                    '<input class="usb-fileinput" type="file" accept=".png,.svg,image/png,image/svg+xml" ' +
                      'data-logo-input aria-hidden="true" tabindex="-1"/>' +
                  '</div>' +
                  '<button class="usb-linktoggle" type="button" data-link-toggle aria-expanded="false">' +
                    '<span class="usb-linktoggle-chev">' + ICON.chev + '</span>' +
                    '<span>Use an image link instead</span>' +
                  '</button>' +
                  '<div class="usb-linkbox" data-link-box hidden>' +
                    '<input class="up-field usb-urlin" type="url" spellcheck="false" autocomplete="off" ' +
                      'placeholder="https://…" aria-label="Logo image URL" data-logo-url/>' +
                    '<button class="up-btn-sec usb-btn" type="button" data-logo-save>Use link</button>' +
                  '</div>' +
                  '<div class="usb-fileerr" data-logo-err hidden></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="usb-sec">' +
          '<div class="usb-sechead">' +
            '<h2 class="usb-sectitle">Model Settings</h2>' +
            '<p class="usb-secsub">Which AI models your prompts run against.</p>' +
          '</div>' +
          '<div class="usb-card">' +
            '<div class="usb-cardhead">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Manage AI Models</div>' +
                '<div class="usb-rowdesc" data-model-desc></div>' +
              '</div>' +
              '<span class="usb-count" data-model-count>0/0</span>' +
            '</div>' +
            '<div class="usb-models" data-models></div>' +
            '<div class="usb-savebar">' +
              '<span class="usb-savehint" data-models-hint></span>' +
              '<button class="usb-savebtn" type="button" data-models-save disabled>Save models</button>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="usb-sec">' +
          '<div class="usb-sechead">' +
            '<h2 class="usb-sectitle">Meta Settings</h2>' +
            '<p class="usb-secsub">Context the system uses when it generates prompts and analyses.</p>' +
          '</div>' +
          '<div class="usb-card">' +

            '<div class="usb-row">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Default Market</div>' +
                '<div class="usb-rowdesc">Your preset primary market focus. New prompts start here ' +
                  'unless you pick a different one.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' + ddHtml("market", "Select a market", "Search markets", "Default market", ICON.pin) + '</div>' +
            '</div>' +

            '<div class="usb-div"></div>' +

            '<div class="usb-row">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Business Model</div>' +
                '<div class="usb-rowdesc">Your target audience.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<div class="up-dense usb-dense" role="radiogroup" aria-label="Business model" data-business></div>' +
              '</div>' +
            '</div>' +

            '<div class="usb-div"></div>' +

            '<div class="usb-row">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Brand Industry</div>' +
                '<div class="usb-rowdesc">Your preset primary brand industry.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' + ddHtml("industry", "Select an industry", "Search industries", "Brand industry", "") + '</div>' +
            '</div>' +

            '<div class="usb-div"></div>' +

            '<div class="usb-sumblock">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-sumtitlerow">' +
                  '<img class="usb-sumlogo is-empty" alt="" data-sum-logo/>' +
                  '<span class="usb-rowtitle" data-sum-title>Brand Summary</span>' +
                '</div>' +
                '<div class="usb-rowdesc">Your brand summary tells the system what your company ' +
                  'does: its products, services and industry focus. It is used as an additional ' +
                  'context source when generating tailored research prompts, insights and AI ' +
                  'analyses. If your focus or product offering changes, update it here.</div>' +
              '</div>' +
              '<div class="usb-sumwrap">' +
                '<textarea class="up-field usb-sumin" rows="6" spellcheck="true" ' +
                  'placeholder="Describe what your company does…" aria-label="Brand summary" data-summary></textarea>' +
              '</div>' +
            '</div>' +

            '<div class="usb-savebar">' +
              '<span class="usb-savehint" data-meta-hint></span>' +
              '<button class="usb-savebtn" type="button" data-meta-save disabled>Save settings</button>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="usb-sec">' +
          '<div class="usb-sechead">' +
            '<h2 class="usb-sectitle usb-sectitle-danger">Danger Zone</h2>' +
            '<p class="usb-secsub">These actions affect the whole team and cannot be undone.</p>' +
          '</div>' +
          '<div class="usb-card usb-card-danger">' +
            '<div class="usb-row">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Leave Team</div>' +
                '<div class="usb-rowdesc">You lose access to this workspace. Other members keep theirs.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<button class="usb-dangerbtn" type="button" data-leave>' + ICON.logout + '<span>Leave team</span></button>' +
              '</div>' +
            '</div>' +
            '<div class="usb-div"></div>' +
            '<div class="usb-row">' +
              '<div class="usb-rowtext">' +
                '<div class="usb-rowtitle">Delete Team</div>' +
                '<div class="usb-rowdesc">Deletes the workspace and every brand, prompt and report ' +
                  'in it, for everyone. This cannot be undone.</div>' +
              '</div>' +
              '<div class="usb-rowctl">' +
                '<button class="usb-dangerbtn is-hard" type="button" data-delete>' + ICON.trash + '<span>Delete team</span></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

      '</div>';

    var elModels     = root.querySelector("[data-models]");
    var elModelCount = root.querySelector("[data-model-count]");
    var elModelDesc  = root.querySelector("[data-model-desc]");
    var elModelsSave = root.querySelector("[data-models-save]");
    var elModelsHint = root.querySelector("[data-models-hint]");
    var elBusiness   = root.querySelector("[data-business]");
    var elSummary    = root.querySelector("[data-summary]");
    var elMetaSave   = root.querySelector("[data-meta-save]");
    var elMetaHint   = root.querySelector("[data-meta-hint]");
    var elSumTitle   = root.querySelector("[data-sum-title]");
    var elSumLogo    = root.querySelector("[data-sum-logo]");
    var elLogoPrev   = root.querySelector("[data-logo-prev]");
    var elLogoFile   = root.querySelector("[data-logo-file]");
    var elLogoErr    = root.querySelector("[data-logo-err]");
    var elFileIn     = root.querySelector("[data-logo-input]");
    var elUrlIn      = root.querySelector("[data-logo-url]");
    var elLinkBox    = root.querySelector("[data-link-box]");
    var elLinkTgl    = root.querySelector("[data-link-toggle]");
    var elEditLbl    = root.querySelector(".usb-editbtn-lbl");

    /* ---------------- Marke + Logo ---------------- */
    function renderBrand(){
      elEditLbl.textContent = "Edit " + (meta.brandName || "your brand");
      elSumTitle.textContent = meta.brandName ? meta.brandName + " Summary" : "Brand Summary";
      if (elSumLogo){
        if (meta.brandLogo){ elSumLogo.src = meta.brandLogo; elSumLogo.classList.remove("is-empty"); }
        else { elSumLogo.removeAttribute("src"); elSumLogo.classList.add("is-empty"); }
      }
      if (meta.brandLogo){
        elLogoPrev.innerHTML = '<img src="' + esc(meta.brandLogo) + '" alt=""/>';
        elLogoPrev.classList.remove("is-empty");
      } else {
        elLogoPrev.innerHTML = ICON.brand;
        elLogoPrev.classList.add("is-empty");
      }
      elLogoFile.textContent = meta.logoFileName || "No file selected";
      elLogoFile.classList.toggle("is-set", !!meta.logoFileName);
    }
    function logoError(msg){
      elLogoErr.textContent = msg || "";
      elLogoErr.hidden = !msg;
    }

    /* Der Upload liest die Datei hier und reicht sie als Data-URL weiter. Bubble legt sie ab und
       meldet die endgueltige URL ueber setSettingsBrandLogo() zurueck. Bis dahin steht schon die
       lokale Vorschau -- der Nutzer sieht sofort, was er gewaehlt hat, statt auf den Server zu
       warten und in der Zwischenzeit das alte Logo anzusehen. */
    elFileIn.addEventListener("change", function(){
      var f = elFileIn.files && elFileIn.files[0];
      if (!f) return;
      var okType = LOGO_TYPES.indexOf(f.type) !== -1 || /\.(png|svg)$/i.test(f.name);
      if (!okType){ logoError("Only PNG and SVG files are supported."); elFileIn.value = ""; return; }
      if (f.size > MAX_LOGO_BYTES){
        logoError("That file is " + Math.round(f.size / 1024) + " KB. The limit is 1 MB.");
        elFileIn.value = ""; return;
      }
      logoError("");
      var rd = new FileReader();
      rd.onload = function(){
        meta.brandLogo = String(rd.result);
        meta.logoFileName = f.name;
        renderBrand();
        fire("data-logofile-fn", "usbLogoFile",
             { name: f.name, type: f.type || "", size: f.size, data: String(rd.result) });
      };
      rd.onerror = function(){ logoError("The file could not be read."); };
      rd.readAsDataURL(f);
      elFileIn.value = "";
    });

    elLinkTgl.addEventListener("click", function(){
      var open = elLinkBox.hidden;
      elLinkBox.hidden = !open;
      elLinkTgl.setAttribute("aria-expanded", open ? "true" : "false");
      elLinkTgl.classList.toggle("is-open", open);
      if (open) setTimeout(function(){ try { elUrlIn.focus(); } catch(e){} }, 0);
    });

    /* ---------------- Modelle ---------------- */
    function renderModels(){
      var on = draft.models.filter(function(m){ return m.active; }).length;
      var lim = meta.modelLimit || 0;
      var full = lim > 0 && on >= lim;
      elModelCount.textContent = on + "/" + lim;
      elModelCount.classList.toggle("is-full", full);
      elModelDesc.textContent = "Select the AI models you want to track. Your plan currently " +
        "supports up to " + lim + " active model" + (lim === 1 ? "" : "s") + ".";

      elModels.innerHTML = draft.models.length
        ? draft.models.map(function(m){
            /* Drei Gruende, warum eine Karte nicht schaltbar ist, und jeder bekommt seinen eigenen
               Satz. "Gesperrt" ohne Begruendung ist die Variante, ueber die sich jeder aergert. */
            var why = "";
            if (!meta.canManage) why = "Only admins can change the tracked models.";
            else if (m.canToggle === false) why = REASON[m.reason] || "This model is not available on your plan.";
            else if (full && !m.active) why = "Your plan allows " + lim + " active models. Turn one off first.";
            var locked = !!why;
            return '<button class="usb-model' + (m.active ? " is-on" : "") + (locked ? " is-locked" : "") + '" ' +
                'type="button" role="switch" aria-checked="' + (m.active ? "true" : "false") + '" ' +
                'data-model="' + esc(m.key) + '"' +
                (locked ? ' aria-disabled="true" data-tip="' + esc(why) + '"' : "") + '>' +
              /* Nur wenn es ein Logo gibt. Ein leeres Kaestchen als Platzhalter sieht aus wie ein
                 Bild, das nicht geladen hat. */
              (m.logo_url ? '<span class="usb-model-logo"><img src="' + esc(m.logo_url) + '" alt="" ' +
                 'onerror="this.parentNode.remove();"/></span>' : "") +
              '<span class="usb-model-txt">' +
                '<span class="usb-model-name">' + esc(m.display_name || m.key) + '</span>' +
                (m.provider ? '<span class="usb-model-prov">' + esc(m.provider) + '</span>' : "") +
              '</span>' +
              '<span class="usb-model-check">' + ICON.check + '</span>' +
            '</button>';
          }).join("")
        : '<div class="usb-modelsempty">No models available yet.</div>';

      var dirty = keysOf(draft.models) !== keysOf(saved.models);
      elModelsSave.disabled = !dirty;
      elModelsHint.textContent = dirty ? "Unsaved changes" : "";
      elModelsHint.classList.toggle("is-dirty", dirty);
    }

    /* ---------------- Business Model ---------------- */
    function renderBusiness(){
      elBusiness.innerHTML = BUSINESS.map(function(b){
        var on = draft.businessModel === b.value;
        return '<button class="up-dense-btn" type="button" role="radio" ' +
          'aria-checked="' + (on ? "true" : "false") + '" data-biz="' + b.value + '"' +
          (on ? ' data-on="1"' : "") + '>' + esc(b.label) + '</button>';
      }).join("");
      /* is-active per classList statt im String: core stylt darueber, und ein Tippfehler im
         Klassennamen faellt hier sofort auf statt erst im Browser. */
      Array.prototype.forEach.call(elBusiness.querySelectorAll(".up-dense-btn"), function(b){
        b.classList.toggle("is-active", b.getAttribute("data-on") === "1");
      });
    }

    /* ---------------- Dropdowns (Core-Bauart) ---------------- */
    function makeDropdown(kind, cfg){
      var wrap = root.querySelector('[data-dd="' + kind + '"]');
      var btn  = wrap.querySelector("[data-dd-btn]");
      var menu = wrap.querySelector(".up-ment-menu");
      var list = wrap.querySelector("[data-dd-list]");
      var sin  = wrap.querySelector(".up-ment-search");
      var sx   = wrap.querySelector(".up-ment-searchclear");
      var lbl  = wrap.querySelector("[data-dd-label]");
      var ic   = wrap.querySelector("[data-dd-icon]");
      var q = "";

      var pop = UC.makePopover({
        wrap: wrap, menu: menu, opener: btn, group: "usb-dd",
        onClose: function(){ btn.setAttribute("aria-expanded", "false"); }
      });

      function setQ(v){
        q = v;
        sin.value = v;
        paint();
      }
      function paint(){
        var items = cfg.items().filter(function(it){
          return !q || String(cfg.search(it)).toLowerCase().indexOf(q.toLowerCase()) !== -1;
        });
        list.innerHTML = items.length
          ? items.map(function(it){
              var val = cfg.value(it), on = String(val) === String(cfg.selected());
              return '<div class="up-filter-item usb-opt' + (on ? " is-checked" : "") + '" role="option" ' +
                  'tabindex="0" aria-selected="' + (on ? "true" : "false") + '" data-val="' + esc(val) + '">' +
                '<span class="up-filter-check">' + ICON.check + '</span>' +
                cfg.body(it) +
              '</div>';
            }).join("")
          : '<div class="usb-ddempty">' + esc(cfg.empty) + '</div>';
      }
      function syncLabel(){
        var t = cfg.selectedLabel();
        lbl.textContent = t || cfg.placeholder;
        /* Bewusst KEIN has-sel: bei den vier Filtern bedeutet die graue Fuellung "ein Filter ist
           gesetzt", also ein Zustand, den man wieder loeswerden kann. Hier hat jedes Feld immer
           einen Wert -- dauerhaft grau gefuellt hiesse, der Zustand sagt gar nichts mehr. */
        if (ic && cfg.icon) ic.innerHTML = cfg.icon();
      }
      btn.addEventListener("click", function(){
        if (pop.isOpen()){ pop.close(); return; }
        setQ("");
        pop.open();
        btn.setAttribute("aria-expanded", "true");
        setTimeout(function(){ try { sin.focus(); } catch(e){} }, 0);
      });
      sin.addEventListener("input", function(){ setQ(sin.value); });
      sx.addEventListener("click", function(e){ e.stopPropagation(); setQ(""); sin.focus(); });
      function pick(el){
        if (!el) return;
        pop.close();
        cfg.onPick(el.getAttribute("data-val"));
      }
      list.addEventListener("click", function(e){ pick(e.target.closest(".usb-opt")); });
      list.addEventListener("keydown", function(e){
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault(); pick(e.target.closest(".usb-opt"));
      });
      /* Eigene Branche eintippen. Der Knopf bleibt gesperrt, solange das Feld leer ist oder der
         Text schon in der Liste steht -- sonst legt man ein Duplikat an, das sich vom Original
         nur durch Gross- und Kleinschreibung unterscheidet. */
      var cin = wrap.querySelector("[data-dd-custom]");
      var cadd = wrap.querySelector("[data-dd-customadd]");
      if (cin && cadd){
        function customOk(){
          var v = cin.value.trim();
          if (!v) return false;
          var have = cfg.items().some(function(it){
            return String(cfg.value(it)).toLowerCase() === v.toLowerCase();
          });
          return !have;
        }
        cin.addEventListener("input", function(){ cadd.disabled = !customOk(); });
        cin.addEventListener("keydown", function(e){
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (customOk()) cadd.click();
        });
        cadd.addEventListener("click", function(){
          if (!customOk()) return;
          var v = cin.value.trim().slice(0, IND_MAX);
          cin.value = ""; cadd.disabled = true;
          pop.close();
          cfg.onCustom(v);
        });
      }
      return { sync: function(){ syncLabel(); if (pop.isOpen()) paint(); } };
    }

    var ddMarket = makeDropdown("market", {
      placeholder: "Select a market", empty: "No markets found",
      items: marketList,
      search: function(m){ return (m.name || "") + " " + (m.id || ""); },
      value: function(m){ return m.id; },
      body: function(m){
        return '<span class="usb-opt-main">' +
                 '<img class="usb-flag" src="' + esc(flagUrl(m.id)) + '" alt="" onerror="this.style.visibility=&quot;hidden&quot;"/>' +
                 '<span class="usb-opt-name">' + esc(m.name || String(m.id).toUpperCase()) + '</span>' +
               '</span>' +
               (m.score == null ? "" : '<span class="usb-opt-count">' + esc(m.score) + '</span>');
      },
      selected: function(){ return draft.marketId; },
      selectedLabel: function(){
        var m = findMarket(draft.marketId);
        return m ? (m.name || String(m.id).toUpperCase()) : "";
      },
      icon: function(){
        var m = findMarket(draft.marketId);
        return m ? '<img src="' + esc(flagUrl(m.id)) + '" alt="" onerror="this.style.visibility=&quot;hidden&quot;"/>' : ICON.pin;
      },
      onPick: function(v){ draft.marketId = v; ddMarket.sync(); syncMeta(); }
    });
    var ddIndustry = makeDropdown("industry", {
      placeholder: "Select an industry", empty: "No industries found",
      items: function(){ return meta.industries; },
      search: function(x){ return x; },
      value: function(x){ return x; },
      body: function(x){ return '<span class="usb-opt-main"><span class="usb-opt-name">' + esc(x) + '</span></span>'; },
      selected: function(){ return draft.industry; },
      selectedLabel: function(){ return draft.industry || ""; },

      onPick: function(v){ draft.industry = v; ddIndustry.sync(); syncMeta(); },
      onCustom: function(v){
        /* Die eigene Branche wandert in die Liste, damit sie beim naechsten Oeffnen oben
           mitsteht und nicht wie ein Fremdkoerper nur im Trigger klebt. */
        if (meta.industries.indexOf(v) === -1) meta.industries.push(v);
        draft.industry = v; ddIndustry.sync(); syncMeta();
      }
    });

    /* ---------------- Meta: geaendert? ---------------- */
    function metaDirty(){
      return draft.marketId !== saved.marketId ||
             draft.businessModel !== saved.businessModel ||
             draft.industry !== saved.industry ||
             elSummary.value !== saved.summary;
    }
    function syncMeta(){
      var d = metaDirty();
      elMetaSave.disabled = !d;
      elMetaHint.textContent = d ? "Unsaved changes" : "";
      elMetaHint.classList.toggle("is-dirty", d);
    }

    /* Ein zweites, eigenes Event nur fuer die Rueckmeldung. Es traegt KEINE Daten, sondern sagt
       nur, welcher Block gespeichert wurde -- damit ein Bubble-Workflow den vorhandenen Tooltip
       ("Changes saved") ausloesen kann, ohne den Speicher-Workflow selbst anfassen zu muessen.
       Getrennt vom Speicher-Event, weil der Tooltip sofort kommen soll und nicht erst, wenn der
       Server geantwortet hat: der Nutzer hat geklickt, die Aenderung ist uebernommen. */
    function saved_(block){ fire("data-saved-fn", "usbSaved", { block: block }); }

    /* ---------------- Klicks ---------------- */
    root.addEventListener("click", function(e){
      var t = e.target;
      if (t.closest("[data-edit-brand]")){ fire("data-editbrand-fn", "usbEditBrand", {}); return; }
      if (t.closest("[data-logo-pick]")){ elFileIn.click(); return; }
      if (t.closest("[data-logo-save]")){
        var url = String(elUrlIn.value || "").trim();
        if (!url){ elUrlIn.focus(); return; }
        meta.brandLogo = url; meta.logoFileName = "";
        renderBrand(); logoError("");
        fire("data-logourl-fn", "usbLogoUrl", { url: url });
        return;
      }
      var mb = t.closest("[data-model]");
      if (mb){
        if (mb.classList.contains("is-locked")) return;
        var key = mb.getAttribute("data-model");
        draft.models.forEach(function(m){ if (m.key === key) m.active = !m.active; });
        renderModels();
        return;
      }
      if (t.closest("[data-models-save]")){
        saved.models = cloneModels(draft.models);
        renderModels();
        fire("data-models-fn", "usbModels",
             { model_keys: draft.models.filter(function(m){ return m.active; }).map(function(m){ return m.key; }).join(",") });
        saved_(  "models" );
        return;
      }
      var bz = t.closest("[data-biz]");
      if (bz){ draft.businessModel = bz.getAttribute("data-biz"); renderBusiness(); syncMeta(); return; }
      if (t.closest("[data-meta-save]")){
        draft.summary = elSummary.value;
        saved.marketId = draft.marketId; saved.businessModel = draft.businessModel;
        saved.industry = draft.industry; saved.summary = draft.summary;
        syncMeta();
        fire("data-meta-fn", "usbMeta", {
          market_id: draft.marketId, business_model: draft.businessModel,
          industry: draft.industry, summary: draft.summary
        });
        saved_( "meta" );
        return;
      }
      if (t.closest("[data-leave]")){ openDanger("leave"); return; }
      if (t.closest("[data-delete]")){ openDanger("delete"); return; }
    });
    elSummary.addEventListener("input", syncMeta);
    elUrlIn.addEventListener("keydown", function(e){
      if (e.key === "Enter"){ e.preventDefault(); root.querySelector("[data-logo-save]").click(); }
    });

    /* ================= Danger-Dialog =================
       Kopfband in Signalfarbe ueber die volle Breite statt eines Icons in einer Ecke: der Dialog
       soll auf den ersten Blick anders aussehen als jeder andere, nicht erst beim Lesen. */
    var dlg = null, dlgMode = "", armed = false, armTimer = null;

    function closeDanger(){
      if (armTimer){ clearTimeout(armTimer); armTimer = null; }
      armed = false;
      if (!dlg) return;
      dlg.classList.remove("is-shown");
      var d = dlg;
      setTimeout(function(){ if (d && d.parentNode) d.parentNode.removeChild(d); }, 180);
      dlg = null;
      document.removeEventListener("keydown", onDlgKey, true);
    }
    function onDlgKey(e){ if (e.key === "Escape"){ e.stopPropagation(); closeDanger(); } }
    function goLabel(){ return dlgMode === "delete" ? "Delete team" : "Leave team"; }

    function openDanger(mode){
      closeDanger();
      /* closeDanger raeumt den Knoten erst nach 180ms weg. Oeffnet man in dieser Zeit den
         naechsten Dialog, liegen zwei Backdrops im DOM und querySelector findet den alten
         zuerst. Darum hier hart aufraeumen. */
      Array.prototype.forEach.call(document.querySelectorAll(".usb-dlg-backdrop"), function(n){
        if (n.parentNode) n.parentNode.removeChild(n);
      });
      dlgMode = mode;
      var isDel = mode === "delete";
      var team = meta.teamName || "this team";

      dlg = document.createElement("div");
      dlg.className = "usb-dlg-backdrop";
      dlg.setAttribute("data-theme", isDark() ? "dark" : "light");
      dlg.innerHTML =
        '<div class="usb-dlg" role="dialog" aria-modal="true" aria-label="' + esc(goLabel()) + '">' +
          '<div class="usb-dlg-band">' +
            '<h3 class="usb-dlg-title">' + (isDel ? "Delete " : "Leave ") + esc(team) + '</h3>' +
            '<button class="usb-dlg-close" type="button" data-dlg-close aria-label="Close">' + ICON.close + '</button>' +
          '</div>' +
          '<div class="usb-dlg-body">' +
            '<p class="usb-dlg-sub">' + (isDel
              ? "This deletes the workspace and everything in it, for every member. It cannot be undone."
              : "You lose access to this workspace. Other members keep theirs.") + '</p>' +
            '<div class="usb-dlg-field">' +
              '<label class="usb-dlg-lbl" for="usb-dlg-in">Type <b>' + esc(team) + '</b> to confirm</label>' +
              '<input class="usb-dlg-in" id="usb-dlg-in" type="text" autocomplete="off" ' +
                'spellcheck="false" placeholder="' + esc(team) + '" data-dlg-in/>' +
            '</div>' +
            '<div class="usb-dlg-foot">' +
              '<button class="up-btn-sec usb-dlg-cancel" type="button" data-dlg-close>Cancel</button>' +
              '<button class="usb-dlg-go" type="button" data-dlg-go disabled>' +
                '<span class="usb-dlg-golbl">' + goLabel() + '</span></button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(dlg);
      setTimeout(function(){ if (dlg) dlg.classList.add("is-shown"); }, 10);
      document.addEventListener("keydown", onDlgKey, true);

      var input = dlg.querySelector("[data-dlg-in]");
      var go = dlg.querySelector("[data-dlg-go]");
      setTimeout(function(){ try { input.focus(); } catch(e){} }, 60);

      function matches(){ return input.value.trim() === String(team).trim(); }
      function disarm(){
        armed = false;
        if (armTimer){ clearTimeout(armTimer); armTimer = null; }
        go.classList.remove("is-armed");
        go.querySelector(".usb-dlg-golbl").textContent = goLabel();
      }
      input.addEventListener("input", function(){
        go.disabled = !matches();
        if (!matches()) disarm();
      });

      dlg.addEventListener("click", function(e){
        if (e.target === dlg){ closeDanger(); return; }
        if (e.target.closest("[data-dlg-close]")){ closeDanger(); return; }
        if (!e.target.closest("[data-dlg-go]")) return;
        if (go.disabled || !matches()) return;
        if (isDel && !armed){
          armed = true;
          go.classList.add("is-armed");
          go.querySelector(".usb-dlg-golbl").textContent = "Click again to delete";
          armTimer = setTimeout(disarm, 4000);
          return;
        }
        var payload = { team_id: meta.teamId, team_name: meta.teamName };
        closeDanger();
        if (isDel) fire("data-delete-fn", "usbDeleteTeam", payload);
        else       fire("data-leave-fn",  "usbLeaveTeam",  payload);
      });
    }

    function render(){
      /* Der Ladezustand haengt am Root, nicht an dieser Closure. Sonst kann ein spaeteres render()
         die Klasse wieder abraeumen, obwohl setLoading("yes") sie gerade gesetzt hat -- genau so
         verschwand der Ladezustand des Pageloads wieder. */
      root.classList.toggle("is-loading", !!root.__usbLoading);
      renderBrand();
      renderModels();
      renderBusiness();
      ddMarket.sync();
      ddIndustry.sync();
      if (document.activeElement !== elSummary) elSummary.value = saved.summary || "";
      syncMeta();
    }

    /* ---------------- Werte aus data-Attributen ----------------
       Der Grund, warum das hier liegt und nicht im Run-JS: ein Wert, der als Quelltext in einen
       JS-String eingesetzt wird, bricht ihn, sobald er ein Anfuehrungszeichen oder einen
       Zeilenumbruch enthaelt. Ein Teamname mit " oder eine mehrzeilige Zusammenfassung reichen,
       und der GANZE Schritt wird nicht mehr geparst -- dann laeuft auch setUpstreemAllMarkets
       nicht mehr, was wie ein zweiter, unabhaengiger Fehler aussieht.
       Als Attribut kann das nicht passieren: Bubble schreibt den Wert selbst ins Markup und
       kodiert ihn dabei, der Browser gibt ihn ueber getAttribute unveraendert zurueck. Dieselbe
       Bauart wie data-brand-name in jedem Seitenkopf.
       Der Run-JS-Aufruf bleibt fuer die Modelle (echtes Array) und als Uebersteuerung bestehen.

       Die Attribute heissen data-brand-*, nicht data-market/data-summary: der Root traegt sonst
       dieselben Namen wie die Marker im eigenen Markup, und ein document.querySelector faengt den
       Root statt des Feldes. Genau darueber bin ich beim Testen gestolpert. */
    var ATTRS = [
      ["data-brand-name",   function(v){ meta.brandName = v; }],
      ["data-brand-logo",   function(v){ meta.brandLogo = v; }],
      ["data-team-id",      function(v){ meta.teamId = v; }],
      ["data-team-name",    function(v){ meta.teamName = v; }],
      ["data-brand-market",       function(v){ saved.marketId = v.trim().toLowerCase(); draft.marketId = saved.marketId; }],
      ["data-brand-business",     function(v){ saved.businessModel = v.trim().toLowerCase(); draft.businessModel = saved.businessModel; }],
      ["data-brand-industry",     function(v){
        saved.industry = v; draft.industry = v;
        /* Eine gespeicherte Branche, die nicht in der festen Liste steht (frueher selbst
           eingetippt), gehoert trotzdem ins Dropdown -- sonst zeigt der Trigger einen Wert, den
           die Liste darunter nicht kennt. */
        if (v && meta.industries.indexOf(v) === -1) meta.industries.push(v);
      }],
      ["data-brand-summary",      function(v){ saved.summary = v; draft.summary = v; }]
    ];
    function readAttrs(){
      var got = false;
      for (var i = 0; i < ATTRS.length; i++){
        var raw = root.getAttribute(ATTRS[i][0]);
        if (raw == null) continue;
        var v = String(raw);
        /* Ein nicht ersetzter Bubble-Platzhalter ist KEIN Wert. Ohne diese Zeile stuende im
           Markennamen woertlich "BRAND_NAME", bis der Ausdruck aufloest. */
        if (/^[A-Z_]{3,}$/.test(v.trim())) continue;
        ATTRS[i][1](v);
        got = true;
      }
      return got;
    }
    if (readAttrs()) { /* gleich gerendert, siehe render() weiter unten */ }
    if (window.MutationObserver){
      new MutationObserver(function(){ if (readAttrs()) render(); }).observe(root, {
        attributes: true,
        attributeFilter: ATTRS.map(function(a){ return a[0]; })
      });
    }

    UC.widthTiers(root);
    UC.onResize(root, function(){ UC.widthTiers(root); });
    UC.unclipAncestors(root, false);
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);
    if (window.MutationObserver){
      new MutationObserver(function(){
        if (dlg) dlg.setAttribute("data-theme", isDark() ? "dark" : "light");
      }).observe(root, { attributes: true, attributeFilter: ["data-isdark", "data-theme"] });
    }
    if (UC.onAllMarkets) UC.onAllMarkets(function(){ ddMarket.sync(); }, root);
    else if (UC.onMarkets) UC.onMarkets(function(){ ddMarket.sync(); }, root);
    render();

    return {
      render: function(p){
        p = p || {};
        var brand = p.brand || {}, team = p.team || {};
        if (brand.name != null) meta.brandName = String(brand.name);
        if (brand.logo != null) meta.brandLogo = String(brand.logo);
        if (team.name != null)  meta.teamName = String(team.name);
        if (team.id != null)    meta.teamId = String(team.id);

        /* Die Modellzeilen kommen so, wie die RPC sie liefert. Jede Zeile traegt neben dem Modell
           auch den Plan-Kontext (active_models_limit, user_can_manage) -- der ist in allen Zeilen
           gleich, wird also aus der ersten gelesen. Eigene Feldnamen bleiben als Rueckfall
           bestehen, damit ein handgeschriebener Aufruf weiter funktioniert.

           currently_tracking ist der Schalter, nicht is_model_active: letzteres sagt, ob das
           Modell ueberhaupt angeboten wird. Ein Modell mit is_model_active=false ist nicht
           "ausgeschaltet", es steht gar nicht zur Verfuegung -- can_toggle sagt das direkt. */
        var models = p.models;
        if (typeof models === "string") models = UC.parseBubbleJson(models);
        if (Array.isArray(models) && models.length){
          var first = models[0] || {};
          if (first.active_models_limit != null) meta.modelLimit = UC.toNum(first.active_models_limit) || 0;
          if (first.user_can_manage != null) meta.canManage = first.user_can_manage !== false;

          saved.models = models.map(function(m){
            var on = m.currently_tracking != null ? m.currently_tracking === true
                   : (m.active != null ? (UC.isYes(m.active) || m.active === true) : false);
            /* can_toggle deckt beide Richtungen ab. Fehlt es (handgeschriebener Aufruf), darf
               geschaltet werden -- sonst waere eine Liste ohne diese Felder komplett tot. */
            var toggle = m.can_toggle != null ? m.can_toggle !== false : true;
            return {
              key: String(m.model_key || m.key || m.model || ""),
              display_name: m.display_name || m.name || "",
              logo_url: m.logo_url || "",
              provider: m.provider || "",
              active: on,
              canToggle: toggle,
              reason: m.disabled_reason || "",
              sort: UC.toNum(m.sort_order) || 0
            };
          }).filter(function(m){ return !!m.key; })
            .sort(function(a, b){ return a.sort - b.sort; });
          draft.models = cloneModels(saved.models);
        }
        if (p.model_limit != null) meta.modelLimit = UC.toNum(p.model_limit) || 0;

        var markets = p.markets;
        if (typeof markets === "string") markets = UC.parseBubbleJson(markets);
        if (Array.isArray(markets)){
          meta.markets = markets.map(function(m){
            return { id: String(m.id != null ? m.id : (m.alpha2 != null ? m.alpha2 : m.name)),
                     name: m.name || "", score: m.score == null ? null : m.score };
          });
        }
        /* market ist der neue, kurze Weg: nur der Alpha-2-Code. market_id bleibt als Alias
           bestehen, damit ein bereits verdrahteter Aufruf nicht bricht. */
        var mk = p.market != null ? p.market : p.market_id;
        if (mk != null){ saved.marketId = String(mk).trim().toLowerCase(); draft.marketId = saved.marketId; }
        if (p.business_model != null){ saved.businessModel = String(p.business_model).toLowerCase(); draft.businessModel = saved.businessModel; }

        var inds = p.industries;
        if (typeof inds === "string") inds = UC.parseBubbleJson(inds);
        if (Array.isArray(inds)) meta.industries = inds.map(function(x){ return typeof x === "string" ? x : (x && x.name) || ""; }).filter(Boolean);
        if (p.industry != null){ saved.industry = String(p.industry); draft.industry = saved.industry; }
        if (p.summary != null){ saved.summary = String(p.summary); draft.summary = saved.summary; }

        loading = false;
        root.__usbLoading = false;
        render();
      },
      /* Was vom Server kommt, bekommt im Ladezustand ein Skelett -- die Auswahlfelder, die
         Modell-Kacheln, das Logo und die Zusammenfassung. Ueberschriften und Beschreibungen sind
         fest verdrahtet und bleiben stehen; ein Skelett darueber waere gelogen. */
      setLoading: function(on){
        loading = UC.isYes(on);
        root.__usbLoading = loading;
        root.classList.toggle("is-loading", loading);
        Array.prototype.forEach.call(
          root.querySelectorAll(".usb-rowctl, .usb-models, .usb-logoprev, .usb-logoforms, " +
                                ".usb-sumwrap, .usb-count"),
          function(el){ el.classList.add("usb-skelbox"); });
        /* Waehrend geladen wird, ist jeder Speichern-Knopf gesperrt. Sonst kann der Nutzer ein
           zweites Mal speichern, bevor die erste Antwort da ist, und die zweite Antwort
           ueberschreibt die erste. */
        Array.prototype.forEach.call(root.querySelectorAll(".usb-savebtn"), function(b){
          if (loading) b.disabled = true;
        });
        if (!loading){ renderModels(); syncMeta(); }
      },
      setLogo: function(url, fileName){
        if (url != null) meta.brandLogo = String(url);
        if (fileName != null) meta.logoFileName = String(fileName);
        logoError("");
        renderBrand();
      },
      reset: function(){
        closeDanger();
        if (UC.closePopovers) UC.closePopovers();
        elUrlIn.value = "";
        elLinkBox.hidden = true;
        elLinkTgl.classList.remove("is-open");
        elLinkTgl.setAttribute("aria-expanded", "false");
        logoError("");
        return true;
      }
    };
  }

  var mount = null;
  function usbRun(){
    var UCl = window.UpstreemCore;
    mount = UCl.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "usb-root", notPortal: true,
      ctrlProp: "__usbController", resolveLocal: "__usbResolveLocal", queue: "__usbBootQueue",
      initRoot: initRootNow,
      api: {
        renderSettingsBrand: doRender,
        setSettingsBrandLoading: doLoading,
        setSettingsBrandLogo: doLogo,
        resetSettingsBrand: doReset
      },
      forwardShape: { renderSettingsBrand: "params", resetSettingsBrand: "id" }
    });
  }
  /* Der Root wird hier notfalls SOFORT aufgebaut. Sonst geht der allererste Aufruf verloren: der
     Pageload-Schritt legt setSettingsBrandLoading("...","yes") in die Warteschlange, die beim Laden
     abgearbeitet wird -- aber zu dem Zeitpunkt hat der Root noch keinen Controller, resolve() gab
     null zurueck, und der Aufruf verschwand kommentarlos. Genau so sah es aus wie ein toter
     Ladezustand. */
  function resolve(id){
    id = String(id || "").trim();
    /* Ohne mount NICHT aufgeben: die Warteschlange wird abgearbeitet, waehrend makeMount noch
       laeuft -- die Zuweisung an `mount` passiert erst danach. Frueher gab resolve() in genau
       diesem Moment null zurueck, und der erste Aufruf des Pageloads war weg. */
    var r = mount ? mount.rootsWithId(id) : rootsById(id);
    if (!r.length) return null;
    return r[0].__usbController || initRootNow(r[0]);
  }
  function rootsById(id){
    var out = [], all = document.querySelectorAll(".usb-root");
    for (var i = 0; i < all.length; i++){
      if ((all[i].getAttribute("data-instance") || "default") === id) out.push(all[i]);
    }
    return out;
  }
  function initRootNow(root){
    if (root.__usbController) return root.__usbController;
    var id = root.getAttribute("data-instance") || "default";
    if (id === "INSTANCE_ID") return null;
    var ctrl = makeController(root);
    root.__usbController = ctrl;
    return ctrl;
  }
  function doRender(params){
    var UCl = window.UpstreemCore;
    var p = UCl.normParams ? UCl.normParams(params) : params;
    if (typeof p === "string") p = UCl.parseBubbleJson(p) || {};
    p = p || {};
    var c = resolve(p.instanceId);
    if (!c){ if (window.console) console.warn("[settings-brand] no instance for id " + p.instanceId); return; }
    c.render(p);
  }
  function doLoading(id, on){ var c = resolve(id); if (c) c.setLoading(on); }
  function doLogo(id, url, fileName){ var c = resolve(id); if (c) c.setLogo(url, fileName); }
  function doReset(id){ var c = resolve(id); return c ? c.reset() : false; }

  usbBoot(30);
})();
