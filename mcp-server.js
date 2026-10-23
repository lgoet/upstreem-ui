/* upstreem mcp-server.js — die Seite "MCP Server" (Praefix `umc`, 22.10.). Braucht core.js.

   ── Wozu diese Seite da ist ─────────────────────────────────────────────
   upstreem hat seit dem 22.10. einen MCP-Server (upstreem-app /api/mcp): Claude und spaeter ChatGPT,
   Gemini & Co. lesen darueber die Daten des Nutzers, nur lesend. Die Seite sagt, wie man ihn verbindet,
   was er darf, und zeigt die verbundenen Apps mit "Revoke". Entwurf: Canvas "MCP Server Seite (Entwurf)"
   (claude.ai/artifact/WcqA1yc8Aqt42vSoNBkiU1), Variante A des Design-Agenten, Grafik "Fluss" (Lukas 22.10.:
   "Nimm Fluss"). Werte 1:1 von dort; die Masse der Bretter stammen von Page Audit und Impact.

   ── Wer entscheidet was ─────────────────────────────────────────────────
   Die App (upstreem-app, app/page.tsx) holt die verbundenen Apps bei Supabase Auth (oauth.listGrants), kennt
   die Adresse des Servers und die Client ID fuer Claude und widerruft (oauth.revokeGrant). Diese Datei zeigt
   an und meldet Klicks. Daten kommen erst, wenn die Seite danach fragt (umcLaden beim Einrichten), also
   nur fuer jemanden, der die Seite wirklich oeffnet.

   ── Die Zustaende der Liste "Connected apps" ───────────────────────────
     laden    bis die erste Antwort da ist: Skelett aus zwei Zeilen, gibt nach LADEN_MAX auf
     da       Tabelle, oder der Leerzustand aus core, wenn nichts verbunden ist
     fehler   der Satz aus der App und "Try again"
   "Refresh" im Kopf der Liste (Lukas 23.10.: "ein update button ... der einfach diese tabelle unten updated") fragt neu:
   mit Daten dimmt die Tabelle, bis die Antwort da ist (Memory "Dimmen statt Skelett"), ohne Daten das Skelett;
   scheitert es, der Fehlerzustand. Beschriftung wie die uebrigen Knoepfe zum Neuladen ("Refresh", Impact).
   Anleitung und Zugriff stehen sofort (sie haengen nicht an der Antwort); nur die Client ID wartet auf
   die App und steht bis dahin als Skelett im Kasten.

   ── Nach aussen ─────────────────────────────────────────────────────────
     setMcpServer(INSTANCE, { server_url, client_id, code_client_id, code_port,
                              apps: [{ client_id, name, known, granted_at }], error })
       client_id       der Client "Claude" (claude.ai, Custom Connector)
       code_client_id  der Client "Claude Code" mit Ruecksprung http://localhost:<code_port>/callback; fehlt er,
                       fehlt der Reiter Claude Code (ohne eigenen Client scheitert dort die Anmeldung, weil die
                       dynamische Registrierung aus ist -- Claude Code meldet dann "does not support dynamic client
                       registration")
     setMcpServerError(INSTANCE, "Meldung")      Widerruf gescheitert: Meldung als Toast, die Zeile wieder frei
     resetMcpServer(INSTANCE)
   Ereignisse (bubble_fn_*): umcLaden {}   umcRevoke { client_id, name } */
(function(){
  "use strict";

  /* Die App kann die Setter rufen, bevor diese Datei da ist (wie oauth-consent.js). */
  var BOOTQ = window.__umcBootQueue = window.__umcBootQueue || [];
  if (!window.__umcBootStubbed){
    window.__umcBootStubbed = true;
    ["setMcpServer", "setMcpServerError", "resetMcpServer"].forEach(function(n){
      window[n] = function(){ BOOTQ.push([n, arguments]); };
    });
  }

  function umcBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ umcBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    umcRun();
  }

  /* Englisch wie jede sichtbare Beschriftung; Deutsch setzt der Katalog von core ein. */
  var T = {
    titel:       "MCP Server",
    /* Kopf nach dem Nutzen, nicht nach der Technik (Lukas 23.10.; Peec: "Build custom workflows with your AI visibility
       data"). "Read-only" steht nur noch in der Karte daneben. */
    startH:      "Build custom workflows with your data",
    startS:      "Connect upstreem to Claude and turn your live AI visibility data into weekly briefs, competitor snapshots and content plans.",
    verbinden:   "Connect an app",
    bald:        "Coming soon",
    zugriff:     "Read-only access",
    kannLesen:   "Claude can read",
    kannNicht:   "Claude can't",
    nichtsAendern: "Create, change or delete anything",
    zugriffFuss: "Covers every team you belong to. You can revoke access at any time.",
    apps:        "Connected apps",
    spalteApp:   "App",
    spalteZugriff: "Access",
    spalteSeit:  "Connected",
    nurLesen:    "Read only",
    widerrufen:  "Revoke",
    leerH:       "No connected apps",
    leerS:       "Apps you connect to upstreem show up here.",
    laedtNicht:  "We could not load your connected apps.",
    nochmal:     "Try again",
    neu:         "Refresh",
    bauen:       "What you can build",
    kopierPrompt: "Copy prompt",
    fragTitel:   "Revoke Access",
    fragSatz:    "{name} will no longer be able to read your upstreem data. You can connect it again at any time.",
    fragKnopf:   "Revoke Access",
    widerrufenOk: "Access revoked",
    widerrufFehler: "We could not revoke access. Please try again.",
    ersatzName:  "An app"
  };
  /* Die Daten, die der Server liest -- dieselben wie auf der Zustimmungsseite (oauth-consent.js "can"), in der
     Reihenfolge und mit den Zeichen der Seitenleiste (sidebar.js BLOECKE), damit jedes Ding an beiden Stellen gleich
     aussieht. Seit 23.10. mit den Lesewerkzeugen aus P4 (Shopping, Ads, Performance, Impact, Page Audit, Prompt
     Research; app.mcp_rpc_erlaubt), Lukas: "in der Liste Claude can read fehlt das dann". */
  var DATEN = [
    { name: "Brands",          icon: "squareStack" },
    { name: "Prompts",         icon: "zap" },
    { name: "Sources",         icon: "globe" },
    { name: "AI responses",    icon: "response" },
    { name: "Shopping",        icon: "shoppingBag" },
    { name: "Ads",             icon: "marketing" },
    { name: "Performance",     icon: "chartColumnUp" },
    { name: "Opportunities",   icon: "listTodo" },
    { name: "Impact",          icon: "cells" },
    { name: "Page Audits",     icon: "dna01" },
    { name: "Prompt Research", icon: "telescope" }
  ];
  /* Logos der KI-Apps: dieselben Dateien wie in Create with AI (create-with-ai.js LOGO). Ein Logo kommt nur
     ueber den Schluessel, den die App fuer einen von ihr eingetragenen Client setzt (known), nie aus der
     Antwort von Supabase: logo_uri gibt der Client selbst an (Begruendung in oauth-consent.js). */
  var LOGO = {
    claude:  "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/llm_logos/claude-logo%20(1).svg",
    chatgpt: "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/llm_logos/openai_light.svg",
    gemini:  "https://tgdossbsevnonssyuewp.supabase.co/storage/v1/object/public/llm_logos/gemini_logo.webp"
  };
  /* Nachschlagen nur in den eigenen Schluesseln: "constructor" o. ae. aus dem Prototyp gaebe sonst eine Funktion als
     Bildadresse (Sicherheitspruefung 22.10., Hinweis 2). */
  function logoVon(k){ return Object.prototype.hasOwnProperty.call(LOGO, k) ? LOGO[k] : ""; }
  /* Was in den Terminalbefehl und die Kopierkaesten geht, wird geprueft, nicht nur escaped: ein Kopierkasten fuers
     Terminal ist eine Senke (Sicherheitspruefung 22.10.). Client IDs von Supabase sind UUIDs. */
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var SERVER_URL = /^(https:\/\/[A-Za-z0-9.-]+(:\d{2,5})?|http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?)\/api\/mcp$/;
  /* Beispiele je Weg: allgemein, nie aus Teamdaten. Je zwei (Lukas 23.10.: die dritte zu Opportunities raus). Seit 23.10. als
     kleine Workflows statt Fragen (Lukas: "build custom workflows with your data"; Vorbild Peec und Profound, die ihren
     MCP-Server mit Arbeitsablaeufen bewerben: Wochenbericht, Seiten mit Verlusten, Kundenbericht, Content-Plan). */
  var FRAGEN = {
    code: ["Turn this week's visibility data into a client report.", "Build a content plan from the prompts where competitors win."]
  };
  /* "What you can build" (Lukas 23.10., Variante B im Canvas): die Auswahlkarte aus core (UC.wkKarteHtml, kompakt) als
     Kopierkarte -- ein Klick kopiert einen fertigen Prompt (Lukas: "die cards sollen nicht mehr zu claude fuehren sondern
     einen fertigen prompt kopieren"), Zeichen Kopieren statt Pfeil, Tooltip "Copy prompt". Die Prompts nach Anthropics
     "Prompting best practices" (platform.claude.com, "Be clear and direct", "Add context", "Control the format") und den
     Vorlagen von Peec (MCP use cases): Datenquelle ausdruecklich (upstreem), Zweck und Leser, nummerierte Schritte mit
     festen Zeitraeumen und Schwellen, Form der Antwort, nur Zahlen aus upstreem, bei mehreren Teams erst fragen. Jeder
     Schritt nutzt nur, was die Werkzeuge des Servers liefern (brands_overview, explain_change, prompts, sources_*,
     url_summaries, opportunities). Titel und Satz uebersetzt wkKarteHtml, den Prompt die Seite beim Klick. Nie Teamdaten. */
  var WORKFLOWS = [
    { titel: "Weekly AI visibility brief", satz: "Every Monday: what changed in AI search, and why.", icon: "newspaper",
      auftrag: "Use my upstreem data to write our weekly AI visibility brief. It goes to the marketing team on Monday, so keep it short and concrete.\n\n1. Compare the last 7 days with the 7 days before for our own brand: visibility, average position and sentiment, each with the change.\n2. Explain the biggest change: which topics, prompts and AI models drove it.\n3. Show the 5 prompts with the largest gains and the 5 with the largest losses.\n4. Compare us with our top 3 competitors by visibility and flag anyone who moved more than 5 points.\n5. List the sources (domains and URLs) that gained or lost the most citations.\n\nStart with three sentences that sum up the week. Then add one section per step with a short table, and end with three concrete actions for next week. Only use numbers from upstreem; if something is missing, say so instead of estimating. If I have more than one team in upstreem, ask me which one first." },
    { titel: "Pages losing citations", satz: "Find the pages AI answers cite less, and what to update first.", icon: "chartBarDec",
      auftrag: "Use my upstreem data to build a refresh list of our pages that AI answers cite less than before, so we know which content to update first.\n\n1. Compare the citations of URLs on our own domains for the last 30 days with the 30 days before.\n2. Take the 10 URLs with the biggest drop and show citations before and now plus the change in %.\n3. For each URL, find the prompts and topics it was cited for and which pages AI answers cite there now instead.\n4. Read the page summary and name the most likely reason it lost ground, for example outdated content, no direct answer or a competitor with a better page.\n5. Check whether an Opportunity already exists for the URL.\n\nReturn one table sorted by the size of the drop with these columns: URL, citations before and now, change, main prompts, replaced by, likely reason, recommended fix. Below the table, describe the three fixes with the biggest expected impact. Only use data from upstreem and say when data is missing. If I have more than one team in upstreem, ask me which one first." },
    { titel: "Competitor snapshot", satz: "Before a pitch or launch: where competitors win and you don't.", icon: "swords",
      auftrag: "Use my upstreem data to prepare a competitor snapshot for a pitch or launch, so I know where competitors win in AI answers and where we can catch up.\n\n1. Rank our brand and all tracked competitors by visibility for the last 30 days, with average position and the change versus the 30 days before.\n2. For our top 3 competitors, show the topics and prompts where they appear and we don't.\n3. List the sources (domains and URLs) that AI answers cite for those prompts and say who owns them: us, a competitor or a third party.\n4. Point out where we are ahead and should defend our position.\n\nStart with a summary in five bullet points. Then add one table per competitor, and end with five concrete steps to win visibility, ordered by impact. Only use numbers from upstreem; say so when data is missing. If I have more than one team in upstreem, ask me which one first." }
  ];

  /* Ein Ladezustand muss IMMER enden (CLAUDE.md 2). Wie oauth-consent.js. */
  var LADEN_MAX = 15000;
  var KNOPF_MAX = 15000;

  var STORE = (window.__umcStore = window.__umcStore || {});

  function makeController(root){
    var UC = window.UpstreemCore;
    var esc = UC.esc;
    var t = UC.t || function(x){ return x; };
    var fire = UC.makeFire(root, { label: "mcp-server", eventPrefix: "umc" });
    function ic(name, w){ return UC.icon ? UC.icon(name, w || 2) : ""; }
    function str(v){ return v == null ? "" : String(v).trim(); }
    function istDunkel(){ return root.getAttribute("data-theme") === "dark" || (UC.getUpstreemTheme && UC.getUpstreemTheme() === "dark"); }

    var instanceId = String(root.getAttribute("data-instance") || "default");
    /* Der Stand ueberlebt einen Neuaufbau (Themenwechsel baut die Wurzel neu, Memory "Themenwechsel = Neuaufbau"). */
    var gem = STORE[instanceId] || (STORE[instanceId] = { phase: "laden", daten: null, fehler: "", reiter: "web" });
    var busy = {};
    var uhrLaden = null, uhrKnopf = null;

    /* ---------------- Aufbau ---------------- */
    /* Die Grafik "Fluss" (Canvas, Brett Main): links die Daten, eine Sammelleitung in den Knoten mit dem Zeichen des
       Servers, von dort gerade weiter in eine Spalte mit den Apps. Claude ist verbunden (durchgezogen, hervorgehoben),
       ChatGPT und Gemini kommen erst (gestrichelt, Logo leiser). Koordinaten im Feld 480 x 188, Zeilen auf 28/62/96/130/164.
       Die Platten der Apps sind im Dunkeln dunkel (mcp-server.css, 23.10.), OpenAI also nach dem Thema. */
    function grafikHtml(){
      var ys = [28, 62, 96, 130, 164], h = "";
      ys.forEach(function(y, i){ h += '<span class="umc-sg-kachel umc-sg-teil" style="left: 16px; top: ' + (y - 14) + 'px' + (i ? "; animation-delay: " + (i * 18) + "ms" : "") + '"></span>'; });
      ys.forEach(function(y, i){
        h += '<span class="umc-sg-kachel umc-sg-teil" style="left: 64px; top: ' + (y - 14) + 'px' + (i ? "; animation-delay: " + (i * 18) + "ms" : "") + '">' + ic(DATEN[i].icon, 2) + '</span>';
      });
      function app(k, top, bald, ms){
        return '<span class="umc-sg-app umc-sg-teil' + (bald ? " is-bald" : "") + '" style="left: 424px; top: ' + top + 'px; animation-delay: ' + ms + 'ms">' +
          '<img src="' + esc(UC.modelLogoUrl ? UC.modelLogoUrl(k, logoVon(k), istDunkel()) : logoVon(k)) + '" alt="" data-up-logo-thema></span>';
      }
      return '<div class="umc-grafik" aria-hidden="true">' +
        '<div class="umc-sg-feld">' +
          '<svg class="umc-sg-linien" width="480" height="188" viewBox="0 0 480 188">' +
            '<path d="' + ys.map(function(y){ return "M44 " + y + "H64"; }).join("") + '"></path>' +
            '<path d="M92 28H184Q196 28 196 40V152Q196 164 184 164H92M92 62H184Q196 62 196 74M92 130H184Q196 130 196 118M92 96H232"></path>' +
            '<path class="is-bald" d="M340 96V52Q340 40 352 40H424M340 96V140Q340 152 352 152H424"></path>' +
            '<path class="is-hl" d="M288 96H424"></path>' +
            '<circle cx="196" cy="96" r="2.5"></circle><circle cx="340" cy="96" r="2.5"></circle>' +
          '</svg>' + h +
          '<span class="umc-sg-knoten umc-sg-teil" style="animation-delay: 90ms">' + ic("mcpServer", 1.5) + '</span>' +
          /* Die Logoplatten liegen in beiden Themen hell (--vt-logo-bg): das ChatGPT-Zeichen bleibt darum das dunkle. */
          app("chatgpt", 20, true, 140) + app("claude", 76, false, 120) + app("gemini", 132, true, 160) +
        '</div></div>';
    }

    function shell(){
      return '' +
        '<div class="up-ph-top umc-pagehead"><div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t(T.titel)) + '</h1></div></div>' +
        '<div class="umc-main">' +
          '<section class="umc-start">' +
            '<div class="umc-start-text">' +
              '<h2 class="up-heading up-sec-h">' + esc(t(T.startH)) + '</h2>' +
              '<p class="up-sec-sub">' + esc(t(T.startS)) + '</p>' +
            '</div>' + grafikHtml() +
          '</section>' +
          '<section class="umc-abschnitt umc-wf">' +
            '<div class="up-sec-head"><div class="up-sec-titles"><h2 class="up-heading up-sec-h">' + esc(t(T.bauen)) + '</h2></div></div>' +
            '<div class="umc-wf-raster">' + WORKFLOWS.map(function(w, i){
              return UC.wkKarteHtml ? UC.wkKarteHtml({ titel: w.titel, satz: w.satz, icon: w.icon, kompakt: true, klasse: "umc-wk",
                kopieren: true, daten: { "umc-wf": String(i), tip: t(T.kopierPrompt) } }) : "";
            }).join("") + '</div>' +
          '</section>' +
          '<section class="umc-abschnitt">' +
            '<div class="up-sec-head"><div class="up-sec-titles"><h2 class="up-heading up-sec-h">' + esc(t(T.verbinden)) + '</h2></div></div>' +
            '<div class="umc-verbinden">' +
              '<div class="up-box umc-karte">' +
                '<div class="umc-kopf">' +
                  '<div class="up-seg" role="group" aria-label="App">' +
                    '<button type="button" class="up-seg-btn" data-umc-reiter="web" aria-pressed="false"><img src="' + esc(LOGO.claude) + '" alt="">Claude</button>' +
                    '<button type="button" class="up-seg-btn" data-umc-reiter="code" aria-pressed="false"><img src="' + esc(LOGO.claude) + '" alt="">Claude Code</button>' +
                  '</div>' +
                  '<div class="umc-bald"><span>' + esc(t(T.bald)) + '</span>' +
                    '<span class="umc-bald-app"><img src="" data-umc-oai alt="">ChatGPT</span>' +
                    '<span class="umc-bald-app"><img src="' + esc(LOGO.gemini) + '" alt="">Gemini</span>' +
                  '</div>' +
                '</div>' +
                '<ol class="umc-schritte" data-umc-schritte></ol>' +
              '</div>' +
              zugriffHtml() +
            '</div>' +
          '</section>' +
          '<section class="umc-abschnitt umc-apps">' +
            '<div class="up-sec-head"><div class="up-sec-titles"><h2 class="up-heading up-sec-h">' + esc(t(T.apps)) + '</h2></div>' +
              /* Sekundaerer Knopf aus core, rechts und mittig zur Ueberschrift (.up-sec-head ist flex, align-items center). */
              '<button type="button" class="up-btn-sec umc-neu" data-umc-neu aria-busy="false" aria-disabled="false">' +
                '<span class="umc-neu-ic" aria-hidden="true">' + ic("refreshCw", 2) + '</span>' +
                '<span class="umc-ring" aria-hidden="true">' + (UC.ringHtml ? UC.ringHtml(14) : "") + '</span>' +
                '<span>' + esc(t(T.neu)) + '</span></button>' +
            '</div>' +
            '<div class="up-box" data-umc-apps></div>' +
          '</section>' +
        '</div>';
    }

    function zugriffHtml(){
      return '<aside class="up-box umc-zugriff" aria-label="Access">' +
        '<h3 class="umc-block-titel">' + ic("shieldCheck", 2) + esc(t(T.zugriff)) + '</h3>' +
        '<p class="umc-gruppe">' + esc(t(T.kannLesen)) + '</p>' +
        '<ul class="umc-liste">' + DATEN.map(function(d){ return '<li>' + ic(d.icon, 2) + '<span>' + esc(t(d.name)) + '</span></li>'; }).join("") + '</ul>' +
        '<p class="umc-gruppe">' + esc(t(T.kannNicht)) + '</p>' +
        '<ul class="umc-liste is-nein"><li>' + ic("x", 2) + '<span>' + esc(t(T.nichtsAendern)) + '</span></li></ul>' +
        '<p class="umc-zugriff-fuss">' + esc(t(T.zugriffFuss)) + '</p>' +
      '</aside>';
    }

    root.classList.add("up-sidebar-clear");
    root.innerHTML = shell();
    var elSchritte = root.querySelector("[data-umc-schritte]");
    var elApps = root.querySelector("[data-umc-apps]");
    var elNeu = root.querySelector("[data-umc-neu]");
    /* Ein Neuaufbau (Thema) verliert die Uhr einer laufenden Anfrage: nie gedimmt ohne Uhr stehen bleiben. */
    gem.neu = false;
    var tips = UC.makeTooltips ? UC.makeTooltips(root, istDunkel) : null;
    if (UC.widthTiers) UC.widthTiers(root);
    if (UC.makePageCrumbs) UC.makePageCrumbs(root, { icon: "mcpServer", name: T.titel, komponente: true });
    var auftritt = UC.makeAuftritt ? UC.makeAuftritt(root, { kopf: ":scope > .up-ph-top", inhalt: ":scope > .umc-main" }) : null;
    if (auftritt) auftritt.bereit();

    /* Das ChatGPT-Zeichen in "Coming soon" steht ohne Platte auf der Karte: im Dunkeln die helle Datei (modelLogoUrl,
       data-up-logo-thema laesst core sie beim Themenwechsel tauschen). */
    var oai = root.querySelector("[data-umc-oai]");
    if (oai){
      oai.setAttribute("data-up-logo-thema", "");
      oai.setAttribute("src", UC.modelLogoUrl ? UC.modelLogoUrl("chatgpt", LOGO.chatgpt) : LOGO.chatgpt);
    }

    /* ---------------- Anleitung ---------------- */
    function serverUrl(){
      var u = str(gem.daten && gem.daten.server_url);
      return SERVER_URL.test(u) ? u : (location.origin + "/api/mcp");
    }
    function kopie(art, text){
      return UC.kopierBoxHtml ? UC.kopierBoxHtml({ text: text, attr: ' data-umc-kopie="' + art + '"' }) : '<code>' + esc(text) + '</code>';
    }
    function fragenHtml(liste){
      return '<div class="umc-fragen">' + liste.map(function(f){ return '<span class="umc-frage">' + esc(t(f)) + '</span>'; }).join("") + '</div>';
    }
    function schritt(nr, satzHtml, extra){
      return '<li class="umc-schritt"><span class="umc-nr">' + nr + '</span><div class="umc-schritt-in"><p class="umc-satz">' + satzHtml + '</p>' + (extra || "") + '</div></li>';
    }
    /* Ganze Saetze in den Katalog, die Namen aus Claudes Oberflaeche als {a}/{b}/{c} danach eingesetzt: Bruchstuecke wie
       "Open" oder "and click" stuenden im Katalog schon fuer Knoepfe ("Open" = "Oeffnen") und braechen den deutschen Satz.
       Die eingesetzten Namen bleiben englisch -- es sind die Beschriftungen in Claude. */
    function satz(key, teile){
      var h = esc(t(key));
      /* Als Funktion: ein String als Ersatz deutete $& und $` (Sicherheitspruefung 22.10., Hinweis 1). */
      Object.keys(teile || {}).forEach(function(k){ h = h.replace("{" + k + "}", function(){ return teile[k]; }); });
      return h;
    }
    function b(x){ return '<b>' + esc(x) + '</b>'; }
    /* Claude Code braucht bei abgeschalteter dynamischer Registrierung die Client ID und einen festen Port fuer den
       Ruecksprung (code.claude.com/docs/en/mcp, "Use pre-configured OAuth credentials", "Use a fixed OAuth callback
       port"): sonst waehlt es einen zufaelligen Port, und Supabase vergleicht die Adresse exakt. */
    function codeDa(){ return UUID.test(str(gem.daten && gem.daten.code_client_id)); }
    function befehl(){
      var d = gem.daten || {};
      var port = /^\d{2,5}$/.test(str(d.code_port)) ? str(d.code_port) : "33418";
      return "claude mcp add --transport http --client-id " + (codeDa() ? str(d.code_client_id) : "") + " --callback-port " + port +
        " upstreem " + serverUrl();
    }
    function schritteHtml(){
      var id = str(gem.daten && gem.daten.client_id);
      if (!UUID.test(id)) id = "";
      if (gem.reiter === "code" && codeDa()){
        return schritt(1, satz("Add upstreem in your terminal."), kopie("befehl", befehl())) +
          schritt(2, satz("Start Claude Code, run {a}, choose {b} and then {c}.",
            { a: '<code class="umc-code">/mcp</code>', b: b("upstreem"), c: b("Authenticate") })) +
          schritt(3, satz("Sign in to upstreem in the browser window that opens and choose {a}.", { a: b("Allow access") })) +
          schritt(4, satz("Try a workflow:"), fragenHtml(FRAGEN.code));
      }
      return schritt(1, satz("In Claude, open {a} and click {b}.",
            { a: '<span class="umc-pfad">Settings' + ic("chevronRight", 2) + 'Connectors</span>', b: b("Add custom connector") })) +
        schritt(2, satz("Name it {a} and paste the server URL.", { a: b("upstreem") }), kopie("url", serverUrl())) +
        schritt(3, satz("Open {a} and paste the OAuth Client ID.", { a: b("Advanced settings") }),
          /* Die ID kennt nur die App: bis zu ihrer Antwort steht an ihrer Stelle ein Skelett in der Groesse des Kastens. */
          id ? kopie("id", id) : '<span class="up-tsk-bar umc-sk-kasten" aria-hidden="true"></span>') +
        schritt(4, satz("Click {a}, sign in to upstreem and choose {b}.", { a: b("Connect"), b: b("Allow access") })) +
        /* Die Auftraege stehen als Karten oben ("What you can build"); hier nur der Verweis, sonst stuenden sie zweimal da. */
        schritt(5, satz("Start a chat and paste one of the prompts above."));
    }
    function anleitungZeichnen(){
      var html = schritteHtml();
      if (elSchritte.__umcHtml !== html){ elSchritte.__umcHtml = html; elSchritte.innerHTML = html; }
      var code = codeDa(), reiter = (gem.reiter === "code" && code) ? "code" : "web";
      root.querySelectorAll("[data-umc-reiter]").forEach(function(btn){
        var an = btn.getAttribute("data-umc-reiter") === reiter;
        if (btn.getAttribute("data-umc-reiter") === "code") btn.hidden = !code;
        btn.classList.toggle("is-active", an);
        btn.setAttribute("aria-pressed", an ? "true" : "false");
      });
    }

    /* ---------------- Verbundene Apps ---------------- */
    function appLogo(a){
      var k = str(a.known).toLowerCase();
      /* is-modell (core): im Dunkeln ohne helle Platte (23.10., "LLM-Logos brauchen nirgendwo in der App im Darkmode
         einen hellen Background"), darum OpenAI nach dem Thema und data-up-logo-thema fuer den Themenwechsel. */
      if (logoVon(k)) return '<span class="up-logo-box has-img is-modell"><img src="' + esc(UC.modelLogoUrl ? UC.modelLogoUrl(k, logoVon(k), istDunkel()) : logoVon(k)) + '" alt="" data-up-logo-thema></span>';
      /* Unbekannter Client: der Anfangsbuchstabe auf der Platte, wie auf der Zustimmungsseite. */
      var n = str(a.name) || T.ersatzName;
      return '<span class="up-logo-box umc-ltr" aria-hidden="true">' + esc(n.charAt(0).toUpperCase()) + '</span>';
    }
    function datum(v){
      if (!v) return "";
      return UC.fmtDate ? UC.fmtDate(v) : String(v).slice(0, 10);
    }
    function zeileHtml(a){
      var id = str(a.client_id), name = str(a.name) || T.ersatzName, seit = datum(a.granted_at);
      var laeuft = !!busy[id];
      return '<div class="up-row' + (laeuft ? " is-umc-busy" : "") + '" role="row" data-umc-client="' + esc(id) + '">' +
        '<div class="up-td" role="cell">' + appLogo(a) +
          '<span class="umc-app-name"><span class="up-zeilenname">' + esc(name) + '</span>' +
          (seit ? '<span class="umc-app-unter">' + esc(t(T.spalteSeit)) + ' ' + esc(seit) + '</span>' : '') + '</span></div>' +
        '<div class="up-td is-breit" role="cell"><span class="up-marke is-leise">' + esc(t(T.nurLesen)) + '</span></div>' +
        '<div class="up-td is-breit" role="cell"><span class="umc-datum">' + esc(seit) + '</span></div>' +
        '<div class="up-td is-aktion" role="cell"><button type="button" class="up-btn-sec umc-widerruf" data-umc-widerruf="' + esc(id) + '"' +
          ' aria-disabled="' + (laeuft ? "true" : "false") + '" aria-busy="' + (laeuft ? "true" : "false") + '">' +
          '<span>' + esc(t(T.widerrufen)) + '</span><span class="umc-ring">' + (UC.ringHtml ? UC.ringHtml(14) : "") + '</span></button></div>' +
      '</div>';
    }
    function kopfHtml(){
      /* data-up-colsig: ohne makeColumns fehlt das Merkmal, und core ("Keine rohe Tabelle") schnitte die Tabelle weg
         (CLAUDE.md 1d, Prompt Research). */
      return '<div class="up-thead" role="row" data-up-colsig="statisch">' +
        '<div class="up-th" role="columnheader">' + esc(t(T.spalteApp)) + '</div>' +
        '<div class="up-th is-breit" role="columnheader">' + esc(t(T.spalteZugriff)) + '</div>' +
        '<div class="up-th is-breit" role="columnheader">' + esc(t(T.spalteSeit)) + '</div>' +
        '<div class="up-th" role="columnheader" aria-label="Actions"></div></div>';
    }
    function skelettHtml(){
      var z = '<div class="up-row umc-sk-zeile" aria-hidden="true">' +
        '<div class="up-td"><span class="up-tsk-bar umc-sk-logo"></span><span class="up-tsk-bar umc-sk-name"></span></div>' +
        '<div class="up-td is-breit"><span class="up-tsk-bar umc-sk-marke"></span></div>' +
        '<div class="up-td is-breit"><span class="up-tsk-bar umc-sk-datum"></span></div>' +
        '<div class="up-td is-aktion"><span class="up-tsk-bar umc-sk-knopf"></span></div></div>';
      return '<div class="up-table" role="table" aria-label="' + esc(t(T.apps)) + '" aria-busy="true">' + kopfHtml() + '<div class="up-tbody">' + z + z + '</div></div>';
    }
    function appsHtml(){
      if (gem.phase === "fehler"){
        return '<div class="umc-fehler" role="alert"><p class="umc-fehler-satz">' + esc(t(gem.fehler || T.laedtNicht)) + '</p>' +
          '<button type="button" class="up-btn-sec" data-umc-nochmal>' + esc(t(T.nochmal)) + '</button></div>';
      }
      if (gem.phase === "laden") return skelettHtml();
      var apps = (gem.daten && Array.isArray(gem.daten.apps)) ? gem.daten.apps : [];
      if (!apps.length){
        return UC.leerHtml ? UC.leerHtml({ icon: "mcpServer", titel: T.leerH, text: T.leerS, knopf: "" })
          : '<p class="umc-fehler-satz">' + esc(t(T.leerH)) + '</p>';
      }
      return '<div class="up-table" role="table" aria-label="' + esc(t(T.apps)) + '">' + kopfHtml() +
        '<div class="up-tbody">' + apps.map(zeileHtml).join("") + '</div></div>';
    }
    /* Die Aktionsspalte nach dem Knopf messen (core, wie Explore Brands und Prompt Research): die Beschriftung kommt
       uebersetzt, "Zurueckziehen" ist breiter als "Revoke". */
    var aktionsSpur = UC.makeAktionsSpur ? UC.makeAktionsSpur({ root: elApps, zellen: ".up-row .up-td.is-aktion",
      anwenden: function(w){ elApps.style.setProperty("--umc-act-w", w + "px"); } }) : null;
    function appsZeichnen(){
      var html = appsHtml();
      if (elApps.__umcHtml !== html){ elApps.__umcHtml = html; elApps.innerHTML = html; if (aktionsSpur) aktionsSpur.messen(); }
      /* Neu laden mit Daten: die Tabelle bleibt stehen und dimmt; der Knopf traegt den Ring, solange gefragt wird. */
      var laeuft = !!gem.neu || gem.phase === "laden";
      elApps.classList.toggle("is-umc-dimm", !!gem.neu);
      elApps.setAttribute("aria-busy", laeuft ? "true" : "false");
      if (elNeu){
        elNeu.setAttribute("aria-busy", laeuft ? "true" : "false");
        elNeu.setAttribute("aria-disabled", laeuft ? "true" : "false");
      }
    }
    function neuLaden(){
      if (gem.neu || gem.phase === "laden") return;
      if (gem.phase === "da" && gem.daten) gem.neu = true;
      else { gem.phase = "laden"; gem.fehler = ""; }
      appsZeichnen();
      laden();
    }

    function render(){ anleitungZeichnen(); appsZeichnen(); }

    /* ---------------- Laden ---------------- */
    function laden(){
      gem.phase = gem.daten ? gem.phase : "laden";
      if (uhrLaden) clearTimeout(uhrLaden);
      uhrLaden = setTimeout(function(){
        uhrLaden = null;
        /* Auch ein Neuladen mit stehender Tabelle endet: sonst bliebe sie gedimmt stehen. */
        if (gem.phase !== "laden" && !gem.neu) return;
        gem.phase = "fehler"; gem.fehler = T.laedtNicht; gem.neu = false;
        render();
      }, LADEN_MAX);
      fire("data-laden-fn", "umcLaden", {});
    }

    /* ---------------- Handlungen ---------------- */
    function fragen(id){
      var a = ((gem.daten && gem.daten.apps) || []).filter(function(x){ return str(x.client_id) === id; })[0];
      if (!a) return;
      var name = str(a.name) || T.ersatzName;
      function los(){
        busy[id] = true; appsZeichnen();
        if (uhrKnopf) clearTimeout(uhrKnopf);
        uhrKnopf = setTimeout(function(){ uhrKnopf = null; if (busy[id]){ busy = {}; appsZeichnen(); if (UC.toast) UC.toast(T.widerrufFehler, { kind: "error" }); } }, KNOPF_MAX);
        fire("data-revoke-fn", "umcRevoke", { client_id: id, name: name });
      }
      /* Ohne Popup kein Widerruf: lieber nichts tun als ohne Rueckfrage (Sicherheitspruefung 22.10., Hinweis 3). */
      if (!UC.makeModal) return;
      /* Gefahraktion nach Geist Modal (CLAUDE.md 1d): Cancel hat den Fokus, Enter am Gefahrknopf loest nie aus
         (wie gefahrFragen in prompt-research.js). */
      var m = UC.makeModal({
        titel: T.fragTitel, isDark: istDunkel,
        inhaltHtml: '<div class="up-modal-saetze"><p class="up-modal-hinweis">' + esc(t(T.fragSatz).replace("{name}", function(){ return name; })) + '</p></div>',
        knoepfe: [
          { id: "ab", text: "Cancel", art: "sec" },
          { id: "weg", text: T.fragKnopf, art: "gefahr", aktion: function(){ los(); } }
        ]
      });
      var w = m && m.knopf ? m.knopf("weg") : null;
      if (w) w.addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); e.stopPropagation(); } });
    }

    root.addEventListener("click", function(e){
      var el = e.target && e.target.closest ? e.target.closest("[data-umc-reiter], [data-umc-kopie], [data-umc-widerruf], [data-umc-nochmal], [data-umc-neu], [data-umc-wf]") : null;
      if (!el || !root.contains(el)) return;
      if (el.hasAttribute("data-umc-wf")){
        var wf = WORKFLOWS[Number(el.getAttribute("data-umc-wf"))];
        /* Kopieren wie der Kopierkasten: Haken 2 s an Stelle des Zeichens, "Copied" in der Live-Region, Fehler als Toast. */
        if (wf && UC.kopierBoxKopieren) UC.kopierBoxKopieren(el, t(wf.auftrag));
        return;
      }
      if (el.hasAttribute("data-umc-reiter")){
        var r = el.getAttribute("data-umc-reiter");
        if (r !== gem.reiter){ gem.reiter = r; anleitungZeichnen(); }
        return;
      }
      if (el.hasAttribute("data-umc-kopie")){
        var art = el.getAttribute("data-umc-kopie");
        var text = art === "url" ? serverUrl() : art === "befehl" ? befehl() : str(gem.daten && gem.daten.client_id);
        if (UC.kopierBoxKopieren) UC.kopierBoxKopieren(el, text);
        return;
      }
      if (el.hasAttribute("data-umc-widerruf")){
        if (el.getAttribute("aria-disabled") === "true") return;
        fragen(el.getAttribute("data-umc-widerruf"));
        return;
      }
      if (el.hasAttribute("data-umc-nochmal")){
        gem.phase = "laden"; gem.fehler = ""; appsZeichnen(); laden();
        return;
      }
      if (el.hasAttribute("data-umc-neu")){
        if (el.getAttribute("aria-disabled") === "true") return;
        neuLaden();
      }
    });

    render();
    /* Daten nur einmal je Seitenaufbau holen; ein Neuaufbau (Thema) zeichnet aus dem Gedaechtnis. */
    if (!gem.daten && gem.phase !== "fehler") laden();

    function lesen(raw){
      var p = (raw && typeof raw === "object") ? raw : (UC.readBubble ? UC.readBubble(raw) : null);
      if (Array.isArray(p)) p = p[0];
      return (p && typeof p === "object") ? p : null;
    }

    return {
      root: root,
      setData: function(raw){
        var p = lesen(raw);
        if (uhrLaden){ clearTimeout(uhrLaden); uhrLaden = null; }
        if (uhrKnopf){ clearTimeout(uhrKnopf); uhrKnopf = null; }
        var warBusy = Object.keys(busy).filter(function(k){ return busy[k]; });
        busy = {};
        gem.neu = false;
        if (!p){
          gem.phase = "fehler"; gem.fehler = T.laedtNicht;
        } else {
          var apps = Array.isArray(p.apps) ? p.apps.filter(function(a){ return a && typeof a === "object" && str(a.client_id); }) : null;
          gem.daten = { server_url: str(p.server_url), client_id: str(p.client_id), code_client_id: str(p.code_client_id),
                        code_port: str(p.code_port), apps: apps || [] };
          if (str(p.error) || !apps){ gem.phase = "fehler"; gem.fehler = str(p.error) || T.laedtNicht; }
          else { gem.phase = "da"; gem.fehler = ""; }
          /* Nach einem Widerruf: ist die App aus der Liste verschwunden, war er erfolgreich. */
          if (warBusy.length && apps && UC.toast){
            var weg = warBusy.every(function(id){ return !apps.some(function(a){ return str(a.client_id) === id; }); });
            UC.toast(weg ? T.widerrufenOk : T.widerrufFehler, { kind: weg ? "success" : "error" });
          }
        }
        render();
        return true;
      },
      setError: function(text){
        if (uhrKnopf){ clearTimeout(uhrKnopf); uhrKnopf = null; }
        busy = {};
        appsZeichnen();
        if (UC.toast) UC.toast(str(text) || T.widerrufFehler, { kind: "error" });
        return true;
      },
      reset: function(){
        if (uhrLaden){ clearTimeout(uhrLaden); uhrLaden = null; }
        if (uhrKnopf){ clearTimeout(uhrKnopf); uhrKnopf = null; }
        busy = {};
        gem.phase = "laden"; gem.daten = null; gem.fehler = ""; gem.neu = false;
        render(); laden();
        return true;
      },
      tips: tips
    };
  }

  /* ---------------- Instanzen: makeMount aus core, wie oauth-consent.js ---------------- */
  var mount = null;
  function umcRun(){
    mount = window.UpstreemCore.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "umc-root", notPortal: true,
      ctrlProp: "__umcController", resolveLocal: "__umcResolveLocal", queue: "__umcBootQueue",
      initRoot: initRootNow,
      api: {
        setMcpServer: function(id, raw){ var c = resolve(id); return c ? c.setData(raw) : false; },
        setMcpServerError: function(id, text){ var c = resolve(id); return c ? c.setError(text) : false; },
        resetMcpServer: function(id){ var c = resolve(id); return c ? c.reset() : false; }
      },
      forwardShape: { resetMcpServer: "id" }
    });
  }
  function resolve(id){
    id = String(id || "").trim();
    var r = mount ? mount.rootsWithId(id) : [];
    if (!r.length) return null;
    return r[0].__umcController || initRootNow(r[0]);
  }
  function initRootNow(root){
    if (root.__umcController) return root.__umcController;
    if ((root.getAttribute("data-instance") || "default") === "INSTANCE_ID") return null;
    var c = makeController(root);
    root.__umcController = c;
    return c;
  }

  umcBoot(30);
})();
