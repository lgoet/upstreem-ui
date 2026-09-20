/* upstreem power-dashboard.js — die zweite Ansicht des Dashboards (11.09. angefordert, 12.09.
   ueberarbeitet). Requires core.js (window.UpstreemCore) loaded first.

   "Kompakter, Mira im Vordergrund, nur minimal Daten." Von oben nach unten:
     1. Miras Eingabefeld -- DAS ECHTE, ausgeliehen (siehe "Mira" unten und LAUNCHER in
        ask-mira.js). Ausdruecklich verlangt: "du sollst nicht das Mira-Inputfeld neu bauen".
     2. Chips mit hinterlegten Prompts. Klick = neuer Chat in Mira, der Prompt geht sofort ab.
     3. Overview (drei Kennzahlen mit Verlauf, das einzige Bauteil hier, das es vorher nicht
        gab) und daneben, weniger prominent, Recent chats -- die letzten drei aus Miras eigener
        Liste, Klick = dieser Chat in Mira (12.09.: aus der Chip-Spalte hierher verschoben).
     4. EINE Tabelle, umschaltbar zwischen Competitive field (Standard) und Trending Citations
        -- aus dem Tabellenbaukasten von core (.up-box, .up-table, .up-thead, .up-row, .up-sent,
        .up-rank-group, .up-tag, UC.trendChip), wortgleich so, wie brands-overview und
        topcitations-dashboard ihn benutzen. Im Citations-Modus zusaetzlich der Domains/URL-
        Umschalter. Beide Wahlen liegen im localStorage.
   Auf dem Dashboard selbst passiert nichts mit Mira-Antworten: jeder Einstieg wechselt in Miras
   Ansicht, und die Antwort kommt dort.

   DATEN: bis ein Setter kommt, steht das SKELETT -- nie erfundene Zahlen (17.09.).
   Die Felder sind DIESELBEN, die brands-overview und
   topcitations-dashboard lesen (plus totalCountDomain/totalCountUrl, ebenfalls wortgleich zu
   topcitations-dashboard), damit dieselben RPCs beide fuellen koennen.

   API (alle mit Stub-Warteschlange, Bubble ruft sie regelmaessig vor dem Laden dieser Datei):
     renderPowerDashboard({ instanceId, overview, brands, top_domains, top_urls,
                            citations_label, totalCountDomain, totalCountUrl, chips })
                                                                jeder Schluessel einzeln moeglich
     setPowerDashboardLoading(instanceId, "yes" | "no") */
(function(){
  "use strict";

  var __upwBootQueue = window.__upwBootQueue = window.__upwBootQueue || [];
  if (!window.__upwBootStubbed){
    window.__upwBootStubbed = true;
    ["renderPowerDashboard", "setPowerDashboardLoading"].forEach(function(n){
      window[n] = function(){ __upwBootQueue.push([n, arguments]); };
    });
  }

  function upwBoot(triesLeft){
    if (!window.UpstreemCore){
      if (triesLeft > 0){ setTimeout(function(){ upwBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    upwRun();
  }

  var UC, mount;

  /* ---------- KEINE BEISPIELDATEN MEHR (17.09.) ----------
     Hier standen die Werte aus dem Entwurf, damit das Dashboard vor dem Anschluss so aussieht wie
     gemeint -- und data-demo="no" schaltete sie ab. Beides ist weg, weil die Vorgabe ANDERSHERUM
     falsch war: ohne Attribut galt demo als EIN, und ein Element, an dem das Attribut fehlt oder
     verloren geht, zeigt erfundene Zahlen.
     Genau so gemeldet (17.09.): Seite gestern geladen, heute den Rechner aufgeklappt, auf Power
     umgeschaltet -- ein bis zwei Sekunden lang standen Beispieldaten da, dann kamen die echten.
     Zahlen, die aussehen wie Messwerte, aber keine sind, sind schlimmer als ein Skelett: man kann
     sie nicht als falsch erkennen.
     Jetzt ist der Anfangszustand fuer JEDEN Abschnitt "noch nichts da", und jeder Abschnitt zeigt
     dafuer sein Skelett (renderKpis, renderBrands, renderCites, die Chatliste). Wer das Aussehen
     vor dem Anschluss sehen will, ruft renderPowerDashboard mit Daten -- den statischen
     Run-JS-Schritt dafuer gibt es in bubble/power_dashboard_runjs_test.js. */

  /* ---------- Die Chips ----------
     "Wichtige Daily-Use-Sachen, allgemeingueltig ... dahinter kleine, aber super effektive
     Prompts -- gleiche Logik wie bei den Kategorie-Karten." Also wie dort: der Prompt steht
     hier in beiden Sprachen, {TIMEFRAME} ersetzt Mira mit dem Zeitraum ihrer Report-Karten, und
     der Klick sendet sofort. {COMPETITOR} ist der staerkste Wettbewerber aus "Competitive field"
     -- der Chip heisst dann nach ihm, wie im Entwurf ("Compare me with Anfragenfluss"). Das ist
     der Spitzenreiter, und ist man selbst der Spitzenreiter, der Zweite: staerksterWettbewerber()
     ueberspringt die eigene Marke.
     DREI CHIPS, EINE REIHE (13.09. auf drei gekuerzt): Daily Briefing, der Vergleich und die
     neuen Zitierungen. "Negative Antworten zeigen" und der Report-Entwurf sind raus -- fuenf
     Chips brauchten zwei Reihen, und die zwei sind die, die man am ehesten in Mira selbst tippt.

     ZEICHEN: icon traegt einen Namen aus UC.icon, und der Sonderwert "{COMPETITOR}" heisst "das
     Logo der Marke, um die es geht" (16.09.). Die Emoji des Entwurfs sind raus. Eigene Chips
     kann Bubble ueber renderPowerDashboard({ chips }) setzen, dieselbe Form -- ein mitgelieferter
     emoji-Schluessel wird weiterhin gezeigt, damit ein bestehender Aufruf nicht stumm sein
     Zeichen verliert.

     DIE PROMPTS SIND WASSERSTANDSMELDUNGEN, KEINE TAGESVERGLEICHE (16.09. umgeschrieben).
     Vorher stand in allen dreien "was hat sich seit gestern geaendert". Das ist bei dieser
     Datenmenge die falsche Frage: LLM-Antworten sind probabilistisch, ein Grossteil der
     zitierten Seiten wechselt innerhalb von zwei Wochen, und ein einzelner Lauf traegt keine
     Entscheidung. Ein Tagesdelta misst darum ueberwiegend Rauschen.
     Was die drei jetzt verlangen -- und warum:
       1. STAND statt Niveau-Aufzaehlung: nicht "Sichtbarkeit ist 34%", sondern wo der Wert im
          eigenen Verlauf steht und wohin er laeuft. Das Fenster dafuer ist die LETZTE WOCHE --
          eine feste Zahl im Prompt, keine Umschreibung, und sie steht HINTEN: der Prompt faengt
          mit der Aufgabe an ("Write my daily briefing"), nicht mit dem Zeitraum. Der erste Anlauf schrieb dem Modell
          stattdessen hinein, was es NICHT tun soll ("not a yesterday-vs-today comparison"); das
          ist keine Frage, sondern eine Anweisung ueber die Frage, und sie gehoert nicht in einen
          Text, den ein Nutzer als seinen eigenen abschickt.
       2. NUR AUSSERHALB DER UEBLICHEN SCHWANKUNG: die Ausnahme ist die Nachricht, alles andere
          ist Fuellung, die den Blick abstumpft.
       3. NEU STATT VERAENDERT: neue Prompts, Quellen, Wettbewerber -- das ist der Teil, den
          niemand aus einem Chart ablesen kann.
       4. HAEUFIGKEIT STATT ERSTAUFTRITT bei den Zitierungen: eine Quelle, die einmal auftaucht
          und nie wieder, ist kein Fund.
       5. AUSDRUECKLICH SAGEN, WENN NICHTS WAR. Ohne diesen Satz erfindet ein Modell eine
          Bewegung, weil es gefragt wurde.
       6. GENAU EINE HANDLUNG am Ende. Eine Meldung ohne naechsten Schritt wird nicht gelesen. */
  var CHIPS = {
    en: [
      { icon: "newspaper", label: "Create a Daily Briefing", kurz: "Daily Briefing",
        prompt: "Write my daily briefing: where visibility, average rank and sentiment stand and which way they are moving, what moved beyond the usual fluctuation, and what is new in prompts, sources or competitors. Use the last 7 days as the window. Say plainly if nothing meaningful changed, and end with the one thing worth doing today." },
      { icon: "{COMPETITOR}", label: "Compare me with {COMPETITOR}", kurz: "Compare with {COMPETITOR}", fallback: "Compare me with my top competitor",
        prompt: "Where do I stand against {COMPETITOR} right now? Visibility, average rank and sentiment side by side over {TIMEFRAME}, the topics and prompts where the gap holds across the whole period, and the sources that cite them but not me. Close with three actions that narrow the gap." },
      { icon: "trendingUp", label: "New citations this week", kurz: "New citations",
        prompt: "What is new in my citations over the last 7 days? New domains and URLs citing me or my competitors, sources that cite them but not me, and regular sources I have lost. Sort by how often each one comes up, not by when it first appeared, and name the one to go after first." }
    ],
    de: [
      { icon: "newspaper", label: "Daily Briefing erstellen", kurz: "Daily Briefing",
        prompt: "Schreib mein Daily Briefing: wo Sichtbarkeit, durchschnittlicher Rang und Sentiment stehen und in welche Richtung sie laufen, was über die übliche Schwankung hinausgeht und was neu ist bei Prompts, Quellen oder Wettbewerbern. Nimm die letzten 7 Tage als Zeitfenster. Sag klar, wenn sich nichts Wesentliches bewegt hat, und schließe mit der einen Sache, die heute lohnt." },
      { icon: "{COMPETITOR}", label: "Mit {COMPETITOR} vergleichen", kurz: "Vergleich mit {COMPETITOR}", fallback: "Mit meinem stärksten Wettbewerber vergleichen",
        prompt: "Wo stehe ich gerade gegenüber {COMPETITOR}? Sichtbarkeit, durchschnittlicher Rang und Sentiment nebeneinander über {TIMEFRAME}, die Themen und Prompts, bei denen der Abstand über den ganzen Zeitraum hält, und die Quellen, die sie zitieren, mich aber nicht. Schließe mit drei Maßnahmen, die den Abstand verkleinern." },
      { icon: "trendingUp", label: "Neue Zitierungen diese Woche", kurz: "Neue Zitierungen",
        prompt: "Was ist bei meinen Zitierungen in den letzten 7 Tagen neu? Neue Domains und URLs, die mich oder meine Wettbewerber zitieren, Quellen, die sie zitieren und mich nicht, und regelmäßige Quellen, die ich verloren habe. Sortiere danach, wie oft eine Quelle vorkommt, nicht danach, wann sie zuerst auftauchte, und nenne die eine, die ich zuerst angehen sollte." }
    ]
  };

  function upwRun(){
    UC = window.UpstreemCore;
    mount = UC.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "upw-root", notPortal: true,
      ctrlProp: "__upwController", resolveLocal: "__upwResolveLocal", queue: "__upwBootQueue",
      initRoot: initRoot,
      api: { renderPowerDashboard: doRender, setPowerDashboardLoading: doLoading,
             upwStand: doStand },
      forwardShape: { renderPowerDashboard: "params" }
    });
  }

  function resolve(id){
    var r = mount.rootsWithId(String(id || "").trim());
    if (!r.length) return null;
    if (r.length === 1) return initRoot(r[0]);
    for (var i = 0; i < r.length; i++){ try { if (r[i].offsetParent) return initRoot(r[i]); } catch(e){} }
    return initRoot(r[0]);
  }
  function doRender(params){
    var id = params && params.instanceId;
    var ctrl = id ? resolve(id) : initRoot(document.querySelector(".upw-root"));
    if (!ctrl) return false;
    ctrl.update(params || {});
    return true;
  }
  /* window.upwStand() in der Konsole -- ohne Argument, nimmt das einzige Dashboard der Seite.
     Beantwortet, was der Bildschirm nicht kann: WAS kam an, als "Could not load ..." entstand. */
  function doStand(id){
    var c = id ? resolve(id) : initRoot(document.querySelector(".upw-root"));
    if (!c) return "[power-dashboard] kein Dashboard auf dieser Seite gefunden.";
    var st = c.stand();
    try { console.table(st); } catch(e){}
    return st;
  }
  function doLoading(id, on){ var c = resolve(id); if (!c) return false; c.setLoading(on); return true; }

  function initRoot(root){
    if (!root) return null;
    if (root.__upwController) return root.__upwController;
    var ctrl = buildController(root);
    root.__upwController = ctrl;
    return ctrl;
  }

  /* Bubble liefert Text. readBubble ist die EINE Leseart fuer Bubble-Payloads in core (sie
     uebersteht nacktes yes/no, Emoji und abgeschnittene Felder). null heisst "nicht lesbar",
     ein leeres Array heisst "wirklich leer" -- zwei verschiedene Dinge (CLAUDE.md §2). */
  function lesen(v){
    if (v == null) return { wert: null, kaputt: false };
    if (typeof v === "object") return { wert: v, kaputt: false };
    var w = UC.readBubble(v);
    return { wert: w, kaputt: w == null && String(v).trim() !== "" };
  }
  function liste(v){
    var r = lesen(v);
    if (r.kaputt) return { wert: null, kaputt: true };
    var w = r.wert;
    if (w && !Array.isArray(w)) w = [w];
    return { wert: (w || []).filter(function(x){ return x != null; }), kaputt: false };
  }
  function num(v){
    if (v == null || v === "") return null;
    var n = Number(String(v).replace(",", "."));
    return isFinite(n) ? n : null;
  }
  /* reihe() -- der Leser fuer "1.2, 1.4, 1.9" -- ist mit den Verlaufslinien weggefallen (12.09.).
     Die drei *_series-Felder duerfen weiter im Payload stehen, sie werden nur nicht mehr
     gezeichnet; ein Leser, den niemand ruft, waere die naechste Drift. */
  function buildController(root){
    var esc = UC.esc;
    var fire = UC.makeFire(root, { label: "power-dashboard", eventPrefix: "upw" });
    var instanceId = root.getAttribute("data-instance") || "default";
    function t(s){ return UC.t ? UC.t(s) : s; }
    function de(){ return (UC.getPref && UC.getPref("locale")) === "de"; }
    function dunkel(){ return root.getAttribute("data-theme") === "dark"; }

    /* Das Thema: core stellt data-theme an jede .up-root (Theme-Waechter); data-isdark ist nur der
       Rueckfall fuer eine Seite ohne gesetztes Thema. */
    if (root.hasAttribute("data-isdark") && UC.syncTheme) UC.syncTheme(root, !UC.isYes(root.getAttribute("data-isdark")));

    /* ---------- localStorage: welche Tabelle, welcher Citations-Modus (12.09.) --------------
       "Alle die Settings bleiben im local storage gespeichert." Zwei Schluessel, je Platzierung
       eigen (instanceId haengt dran, dasselbe Muster wie responses-table.js' rhKey/urls-table.js
       usw.). Kein Team-Bezug -- welche Tabelle man zuletzt offen hatte, ist eine Geraetevorliebe,
       keine Teamdatensache (dieselbe Begruendung wie bei core.js' getDashboardMode). */
    /* Zwei Bereiche statt drei Reitern (14.09.): "Main Metrics" zeigt die beiden Listen,
       "Opportunities" das geliehene Brett. Der alte Schluessel upw_table__ ist damit ueberholt --
       ein gespeichertes "brands"/"citations" faellt hier auf "metrics", und genau dahin gehoerte
       es auch: beide Listen stehen jetzt nebeneinander. */
    var MODI = { metrics: 1, opportunities: 1 };
    function modeKey(){ return "upw_mode__" + instanceId; }
    function readMode(){
      try { var v = window.localStorage.getItem(modeKey()); return MODI[v] ? v : "metrics"; }
      catch(e){ return "metrics"; }
    }
    function writeMode(v){ try { window.localStorage.setItem(modeKey(), v); } catch(e){} }
    function cmodeKey(){ return "upw_cmode__" + instanceId; }
    function readCmode(){
      try { return window.localStorage.getItem(cmodeKey()) === "url" ? "url" : "domain"; }
      catch(e){ return "domain"; }
    }
    function writeCmode(v){ try { window.localStorage.setItem(cmodeKey(), v); } catch(e){} }

    var state = {
      overview: null,
      brands: null,
      domains: null,
      urls: null,
      /* citesLabel/range_label werden seit dem 14.09. NICHT mehr angezeigt: die Kopfzeile, die
         "8 brands · Last 30 days" trug, ist mit der grossen Tabelle weggefallen, und neben
         "Overview" stand der Zeitraum schon vorher nicht mehr. Der Zustand bleibt trotzdem
         stehen -- Bubble schickt das Feld weiter, und ein Setter, der einen Wert stillschweigend
         verwirft, ist schwerer zu erklaeren als einer, der ihn aufhebt. Wer ihn wieder zeigen
         will, hat ihn hier. */
      citesLabel: "",
      /* Die GESAMTZAHL, nicht die Laenge der obigen Arrays -- die zeigen nur die "top" 7, die
         Gesamtzahl kann groesser sein ("16 brands" auch wenn nur 7 Zeilen stehen). Fuer Brands
         gibt es dafuer schon overview.brand_count (dieselbe Zahl wie "#2 of 8 brands"); fuer
         Citations sind totalCountDomain/totalCountUrl NEU, wortgleich zu topcitations-dashboard,
         damit dieselbe RPC beide Komponenten fuellen kann. */
      totalCountDomain: null,
      totalCountUrl: null,
      chips: null,
      cmode: readCmode(),
      mode: readMode(),
      loading: false,
      fehler: {}
    };

    /* ---------- Markup ----------
       Die Komponente baut ihr Markup selbst; in Bubble steht nur die leere Wurzel. Dieselbe
       Entscheidung wie in drawer-topbar: ein von Hand eingefuegter Aufbau waere eine Kopie, die
       beim naechsten Pin nicht mitwandert. */
    root.innerHTML =
      '<div class="upw-col">' +
        /* ZWEI HUELLEN, GEGENLAEUFIG BREITER (11.09. angefordert): Mira und ihre Chips sollen
           72px je Seite SCHMALER sein als die Spalte, Overview/Recent-chats/die Tabelle 80px je
           Seite BREITER -- die Masse stehen an .upw-narrow/.upw-wide in power-dashboard.css, hier
           nur die Gruppierung. Recent chats stand hier frueher noch mit in .upw-narrow (11.09.);
           seit dem 12.09. sitzt sie neben Overview in .upw-datarow, siehe unten -- "die brauchen
           ja eigentlich nicht so super prominent zu sein". */
        '<div class="upw-narrow">' +
          /* Miras Platz. Bis sie da ist, steht ihr Umriss als Skelett -- sonst spraenge alles
             darunter um die Hoehe des Feldes, sobald sie ankommt. */
          '<div class="upw-mira" data-upw-mira><div class="upw-mira-sk" aria-hidden="true">' +
            '<span class="upw-sk upw-sk-line"></span><span class="upw-mira-sk-row">' +
            '<span class="upw-sk upw-sk-dot"></span><span class="upw-sk upw-sk-send"></span></span></div></div>' +
          '<div class="upw-chips" data-upw-chips></div>' +
        '</div>' +
        '<div class="upw-wide">' +
          /* Overview links, Recent chats rechts daneben, mit Abstand (12.09. angefordert) --
             "die brauchen ja eig. nicht so super prominent zu sein, darum sind die da ganz gut
             platziert". Recent chats bekommt eine feste, schmalere Breite (.upw-datarow-side in
             power-dashboard.css), Overview nimmt den Rest. */
          '<div class="upw-datarow">' +
            /* OHNE KASTEN, MIT TRENNLINIE (12.09. umgebaut, nach dem beigefuegten Entwurf): die
               drei Kennzahlen stehen frei nebeneinander statt in einem .up-box, und eine Linie
               unter der Abschnittszeile trennt Ueberschrift von Inhalt -- bei BEIDEN Abschnitten
               gleich. Die Verlaufslinien (spark) sind mit dem Kasten zusammen weg. */
            '<section class="upw-sec upw-datarow-main">' +
              /* Rechts steht hier nichts mehr (12.09.): der Zeitraum stand doppelt auf dem Schirm --
                 einmal hier und einmal in der Kopfzeile der Tabelle darunter ("8 brands · Last 30
                 days"), und dort ist er naeher an den Zahlen, die er datiert. */
              '<div class="upw-sec-head"><span class="upw-sec-h up-blockhead" data-i18n="Overview">' + esc(t("Overview")) + '</span></div>' +
              '<div class="upw-kpis" data-upw-kpis></div>' +
            '</section>' +
            '<section class="upw-sec upw-datarow-side">' +
              '<div class="upw-sec-head"><span class="upw-sec-h up-blockhead" data-i18n="Recent chats">' +
                esc(t("Recent chats")) + '</span>' +
                '<button type="button" class="upw-link" data-upw-allchats><span data-i18n="All">' + esc(t("All")) + '</span>' +
                UC.icon("chevronRight", 2) + '</button></div>' +
              '<div class="upw-chatlist" data-upw-chatlist></div>' +
            '</section>' +
          '</div>' +
          /* ---- ZWEI SCHMALE LISTEN STATT EINER GROSSEN TABELLE (14.09. umgebaut) ----
             "Wir streichen die Tabelle unten." An ihre Stelle treten zwei Bereiche im selben
             Zuschnitt wie Overview und Recent chats darueber: Ueberschrift, Trennlinie, Inhalt --
             und der Inhalt ist eine schlichte Liste ohne Raster, nicht der Tabellenbaukasten.
             Der Reiter-Umschalter von gestern ist weg; an seiner Stelle steht ein leiser
             Wortumschalter zwischen den zwei Listen und dem Opportunities-Brett. */
          '<div class="upw-modeseg" data-upw-modeseg>' +
            /* Der klassische Umschalter aus core (18.09. angefordert). Vorher standen hier zwei
               nackte Woerter mit 20px Abstand -- ein eigener, leiser Umschalter, den es so
               nirgends sonst gab. .up-seg bringt Flaeche, Radius, Farben, den Aktivzustand und
               den gleitenden Streifen mit; er steht in SEG_BOXEN, also faehrt der Streifen ohne
               eine Zeile JS. Die Liste (role=tablist) sitzt jetzt am Umschalter selbst und nicht
               mehr an der Zeile -- in der Zeile stehen auch die Werkzeuge des Bretts, und die
               sind keine Reiter. */
            '<div class="up-seg upw-modes" role="tablist" aria-label="Section">' +
              '<button type="button" class="up-seg-btn" role="tab" data-upw-mode="metrics" data-i18n="Main Metrics">' + esc(t("Main Metrics")) + '</button>' +
              '<button type="button" class="up-seg-btn" role="tab" data-upw-mode="opportunities" data-i18n="Opportunities">' + esc(t("Opportunities")) + '</button>' +
            '</div>' +
            /* Nur noch die eingezogene Werkzeugleiste des Bretts. Das Oeffnen-Zeichen, das hier
               stand, ist am 14.09. gestrichen -- die zwei Listen tragen ihres jetzt selbst, je in
               ihrer Ueberschriftzeile. */
            '<span class="upw-modetools"><span class="upw-uotools" data-upw-uotools></span></span>' +
          '</div>' +
          '<div class="upw-metrics" data-upw-metrics>' +
            '<section class="upw-sec upw-metric-card">' +
              '<div class="upw-sec-head"><span class="upw-sec-h up-blockhead" data-i18n="Competitive field">' + esc(t("Competitive field")) + '</span>' +
                '<button type="button" class="upw-goto" data-upw-allbrands>' + UC.icon("arrowUpRight", 2) + '</button></div>' +
              '<div class="upw-list" data-upw-brands></div>' +
            '</section>' +
            '<section class="upw-sec upw-metric-card">' +
              '<div class="upw-sec-head"><span class="upw-sec-h up-blockhead" data-i18n="Trending Citations">' + esc(t("Trending Citations")) + '</span>' +
                /* 24px statt der 26 aus core (angefordert): Hoehe UND Knopfhoehe zusammen, sonst
                   sprengt der Knopf die Pille -- CLAUDE.md 1. Die CSS steht bei .upw-cmode. */
                '<div class="up-seg upw-cmode" role="tablist" aria-label="Citations" data-upw-cmodewrap>' +
                  '<button type="button" class="up-seg-btn" role="tab" data-upw-cmode="domain" data-i18n="Domains">' + esc(t("Domains")) + '</button>' +
                  '<button type="button" class="up-seg-btn" role="tab" data-upw-cmode="url" data-i18n="URLs">' + esc(t("URLs")) + '</button>' +
                '</div>' +
                '<button type="button" class="upw-goto" data-upw-allcites>' + UC.icon("arrowUpRight", 2) + '</button></div>' +
              '<div class="upw-list" data-upw-cites></div>' +
            '</section>' +
          '</div>' +
          /* Der Platz des geliehenen Bretts. Bis es da ist (oder wenn es auf dieser Seite gar
             nicht eingebaut ist), bleibt er leer. */
          '<div class="upw-board is-off" data-upw-board></div>' +
          '</section>' +
        '</div>' +
      '</div>';

    var elSlot = root.querySelector("[data-upw-mira]");
    var elChips = root.querySelector("[data-upw-chips]");
    var elChats = root.querySelector("[data-upw-chatlist]");
    var elKpis = root.querySelector("[data-upw-kpis]");
    var elBrands = root.querySelector("[data-upw-brands]");
    var elCites = root.querySelector("[data-upw-cites]");
    var elModeseg = root.querySelector("[data-upw-modeseg]");
    var elCmodeWrap = root.querySelector("[data-upw-cmodewrap]");
    var elMetrics = root.querySelector("[data-upw-metrics]");
    var elBoard = root.querySelector("[data-upw-board]");
    var elUoTools = root.querySelector("[data-upw-uotools]");
    var elAllBrands = root.querySelector("[data-upw-allbrands]");
    var elAllCites = root.querySelector("[data-upw-allcites]");

    /* ---------- Chips ---------- */
    /* DER STAERKSTE WETTBEWERBER IST EINE FRAGE DES RANGS (15.09. praezisiert): Platz 1 aus
       "Competitive field", und steht die eigene Marke dort, Platz 2. Vorher wurde nach der
       hoechsten Sichtbarkeit gesucht -- dasselbe Ergebnis, solange die Liste danach sortiert
       ist, aber der Rang steht im Payload und muss nicht erraten werden.
       position ist der Rang in der VOLLSTAENDIGEN Rangliste (siehe die Datenspezifikation), also
       auch dann richtig, wenn die Liste gekuerzt ankommt. Fehlt er, entscheidet die Reihenfolge,
       in der die Marken geliefert wurden -- die ist ohnehin die Rangliste. */
    /* Gibt den ganzen Eintrag zurueck, nicht nur den Namen (16.09.): der Chip traegt jetzt das
       LOGO dieser Marke, und das steht im selben Datensatz. Ohne Wettbewerber: null. */
    function staerksterWettbewerber(){
      var eigen = String(root.getAttribute("data-brand-name") || "").trim().toLowerCase();
      if (eigen === "brand_name") eigen = "";
      var beste = null;
      (state.brands || []).forEach(function(b, i){
        var name = String(b.name || "").trim();
        if (!name || b.is_own === true || String(b.is_own) === "yes" || b.role === "own") return;
        if (eigen && name.toLowerCase() === eigen) return;
        var rang = num(b.position);
        if (rang == null) rang = i + 1;
        if (!beste || rang < beste.rang) beste = { name: name, rang: rang, logo: b.logo_url || b.favicon_url || "" };
      });
      return beste;
    }
    /* DAS ZEICHEN EINES CHIPS (16.09.): ein 16px-Plaettchen in der Primaerfarbe mit einem
       Lucide-Zeichen in der Primaerfarbe des anderen Themas. Die Groessen stehen in der CSS,
       hier steht nur, WAS hineinkommt.
       Drei Faelle, in dieser Reihenfolge:
         "{COMPETITOR}"  das Logo der Marke, um die es im Chip geht -- mit dem Buchstaben-
                         rueckfall darunter, denselben, den jede Logoplatte der App benutzt
                         (logo() weiter unten macht es genauso, nur mit .up-logo-box).
         ein Icon-Name   aus UC.icon. Strichstaerke 2.2 statt der ueblichen 1.8: das Zeichen
                         sitzt auf 10px herunterskaliert im Plaettchen, und duenner faellt es
                         gegen den deckenden Grund auseinander.
         emoji           der alte Schluessel. Nur noch Rueckfall fuer ein Bubble, das seine
                         eigenen Chips mit Emoji schickt -- unsere drei tragen keine mehr. */
    function chipZeichen(c, wb){
      var n = String(c.icon || "");
      if (n === "{COMPETITOR}"){
        if (!wb) return "";
        /* .up-logo-box aus core, nur auf 16px gezogen -- NICHT nachgebaut: die Platte bringt den
           Buchstabenrueckfall und das Ausblenden bei has-img schon mit, und genau das braucht es
           hier auch (CLAUDE.md 1, dasselbe Vorgehen wie in drawer-topbar). */
        var ltr = '<span class="up-logo-ltr">' + esc(String(wb.name || "?").trim().charAt(0) || "?") + '</span>';
        return '<span class="up-logo-box upw-chip-ic' + (wb.logo ? " has-img" : "") + '" aria-hidden="true">' +
          (wb.logo ? '<img src="' + esc(wb.logo) + '" alt="" referrerpolicy="no-referrer"/>' : "") +
          ltr + '</span>';
      }
      if (n) return '<span class="upw-chip-ic" aria-hidden="true">' + UC.icon(n, 2.2) + '</span>';
      if (c.emoji) return '<span class="upw-chip-emoji" aria-hidden="true">' + esc(c.emoji) + '</span>';
      return "";
    }
    function chipListe(){
      if (state.chips && state.chips.length) return state.chips;
      return de() ? CHIPS.de : CHIPS.en;
    }
    function renderChips(){
      var wb = staerksterWettbewerber();
      var liste = chipListe(), teile = [];
      liste.forEach(function(c, i){
        var braucht = /\{COMPETITOR\}/.test(String(c.label || "") + String(c.prompt || ""));
        /* OHNE WETTBEWERBER GAR NICHT ANZEIGEN (15.09. angefordert). Der Rueckfalltext ("mit
           meinem staerksten Wettbewerber vergleichen") stand sonst auch dann da, wenn es gar
           keinen gibt -- ein Vorschlag, der ins Leere fuehrt, ist schlechter als keiner. */
        if (braucht && !wb) return;
        var label = String(c.label || "");
        var kurz  = String(c.kurz || c.label || "");
        if (braucht){ label = label.replace("{COMPETITOR}", wb.name); kurz = kurz.replace("{COMPETITOR}", wb.name); }
        /* ZWEI BESCHRIFTUNGEN, EINE ENTSCHEIDET DIE CSS (17.09. angefordert: "im Mobilemode die
           Labels nicht truncaten, lieber kuerzere"). Nicht ueber einen Breitenmesser und ein
           Neuzeichnen: der Umbruch soll beim Drehen des Geraets sofort stimmen, und ein
           Neuzeichnen mitten in einer Bewegung waere teurer als ein zweites verstecktes Wort.
           Dasselbe Muster wie .am-prev-label-full/-short in Mira. */
        teile.push('<button type="button" class="up-btn-sec upw-chip" data-upw-chip="' + i + '">' +
          chipZeichen(c, wb) +
          '<span class="upw-chip-lbl">' +
            '<span class="upw-chip-lang">' + esc(label) + '</span>' +
            (kurz && kurz !== label ? '<span class="upw-chip-kurz">' + esc(kurz) + '</span>' : '') +
          '</span></button>');
        /* ERZWUNGENER ZEILENUMBRUCH NACH DEM DRITTEN (11.09. angefordert: "3 in row 1, 2 in
           row 2, bei default screen width"). Flexbox bricht sonst nach der VERFUEGBAREN BREITE
           um, nicht nach einer festen Anzahl -- bei fuenf unterschiedlich langen Beschriftungen
           waere das mal 4+1, mal 3+2, je nach Text und Fensterbreite (siehe den Entwurfs-
           Screenshot: dort stand es als 4+1). Ein leeres Element mit flex-basis:100% zwingt die
           naechste Zeile unabhaengig von der Textlaenge -- der uebliche Trick fuer eine feste
           Spaltenzahl in einer umbrechenden Flex-Reihe (CSS bei .upw-chip-break). Nur bei mehr
           als drei Chips, sonst gibt es nichts umzubrechen. */
        if (i === 2 && liste.length > 3) teile.push('<span class="upw-chip-break" aria-hidden="true"></span>');
      });
      elChips.innerHTML = teile.join("");
    }
    elChips.addEventListener("click", function(e){
      var b = e.target.closest("[data-upw-chip]");
      if (!b) return;
      var c = chipListe()[Number(b.getAttribute("data-upw-chip"))];
      if (!c || !c.prompt) return;
      var beste = staerksterWettbewerber();
      var wb = (beste && beste.name) || (de() ? "meinem stärksten Wettbewerber" : "my strongest competitor");
      zuMira({ prompt: String(c.prompt).replace(/\{COMPETITOR\}/g, wb) });
    });

    /* ---------- Mira ----------
       Ausleihen, wenn dieses Dashboard SICHTBAR ist -- und nur dann. Die Wurzel wandert in
       elSlot; Mira selbst stellt is-launcher und gibt sie beim naechsten Ansichtswechsel von
       sich aus zurueck (ask-mira.js, LAUNCHER). Die Ansicht, in der das Dashboard liegt
       (data-view, sonst "dashboard"), geht dabei mit: ein Wechsel IN diese Ansicht nimmt Mira
       nicht wieder weg. */
    var VIEW = String(root.getAttribute("data-view") || "dashboard").trim() || "dashboard";
    function sichtbar(){
      if (!root.isConnected) return false;
      if (UC.messbar && !UC.messbar(root)) return false;
      /* UND die Deckkraft, denn messbar() kennt sie nicht (19.09.). Ohne diese Zeile lieh sich
         das Dashboard Mira weiter aus, waehrend seine Ansicht schon weggeblendet war -- und
         Miras eigene Wache holte sie zurueck. Drei Einblend-Animationen hintereinander, so
         gemeldet. Die Pruefreihe (0/250/800/1800) faengt den kurzen Moment auf, in dem eine
         aufgehende Ansicht ihre Einblendung noch bei null hat. */
      if (UC.wirklichSichtbar && !UC.wirklichSichtbar(root)) return false;
      return root.getClientRects().length > 0;
    }
    function miraBereit(){
      return typeof window.askMiraLauncherAttach === "function" && !window.askMiraLauncherAttach.__amStub;
    }
    function miraHier(){
      var m = document.getElementById("ask-mira");
      return !!(m && m.parentNode === elSlot);
    }
    function ausleihen(){
      if (!miraBereit()) return false;
      var ok = false;
      try { ok = window.askMiraLauncherAttach(elSlot, { view: VIEW }); } catch(e){}
      root.classList.toggle("has-mira", !!ok && miraHier());
      return ok;
    }
    function zurueckgeben(){
      if (typeof window.askMiraLauncherDetach === "function") { try { window.askMiraLauncherDetach(elSlot); } catch(e){} }
      root.classList.remove("has-mira");
    }
    /* Nachsehen und entscheiden. Mehrere Anlaeufe, weil Bubble eine Gruppe erst im naechsten Task
       einblendet und Mira auf einer frischen Seite etwas spaeter startet als dieses Dashboard.
       Kein Dauer-Takt: jeder Anlass (Ansichtswechsel, Moduswechsel, Mira bereit) stoesst genau
       diese kurze Reihe an. */
    var _pruefT = [];
    function pruefen(){
      _pruefT.forEach(clearTimeout); _pruefT = [];
      [0, 250, 800, 1800].forEach(function(ms){
        _pruefT.push(setTimeout(function(){
          if (sichtbar()) ausleihen();
          else if (miraHier()) zurueckgeben();
          root.classList.toggle("has-mira", miraHier());
        }, ms));
      });
    }
    if (UC.onViewChange) UC.onViewChange(function(name){
      /* In die eigene Ansicht: sofort ausleihen, noch bevor Bubble die Gruppe zeigt -- dann
         steht das Feld beim Aufgehen schon da. Die Pruefreihe bestaetigt danach. */
      if (String(name) === VIEW && miraBereit()) { try { window.askMiraLauncherAttach(elSlot, { view: VIEW }); } catch(e){} }
      pruefen();
      /* Das Brett geht von sich aus nach Hause, sobald eine andere Ansicht dran ist (sein eigener
         onViewChange in opportunities.js) -- hier bleibt nur, es beim Zurueckkommen in DIESE
         Ansicht wieder zu holen, falls sein Reiter vorne steht. */
      if (String(name) === VIEW && state.mode === "opportunities") brettPruefen();
      if (String(name) === VIEW) bedarfNachholen();
    });
    if (UC.onDashboardMode) UC.onDashboardMode(function(mode){
      if (mode !== "power"){ zurueckgeben(); brettZurueckgeben(); }
      pruefen();
      if (mode === "power" && state.mode === "opportunities") brettPruefen();
      /* Jetzt ist dieses Dashboard dran -- was fehlt, wird jetzt gebraucht. */
      if (mode === "power") bedarfNachholen();
    });
    window.addEventListener("askmira:bereit", pruefen);
    function zuMira(o){
      if (typeof window.askMiraOpen === "function") { window.askMiraOpen(o || {}); return; }
      if (window.console) console.warn("[power-dashboard] Mira ist auf dieser Seite nicht geladen -- " +
        "askMiraOpen fehlt.");
    }

    /* ---------- Recent chats ---------- */
    /* OHNE JAHRESANGABE (12.09. angefordert). Nicht ein festes Format erfunden, sondern das
       eingestellte genommen und nur das Jahr weggelassen -- UC.datumsTeile liefert dieselben
       Teile, aus denen UC.fmtDateMuster seine vier Muster baut, also bleibt die Schreibweise die
       der App (Monat zuerst im englischen, Tag zuerst im deutschen Muster). Ein Chat ist ein
       Ereignis der letzten Tage; das Jahr dazuzuschreiben sagt nichts und kostet Platz in einer
       Spalte, die ohnehin die schmalste der Zeile ist. */
    function ohneJahr(d){
      var p = UC.datumsTeile ? UC.datumsTeile(d.toISOString()) : null;
      if (!p) return UC.fmtDate ? UC.fmtDate(d.toISOString()) : d.toLocaleDateString();
      var muster = UC.getPref ? UC.getPref("date") : "";
      if (muster === "mon-d-y") return p.mon + " " + p.t;
      if (muster === "d-m-y" || muster === "iso") return p.tt + "." + p.mm + ".";
      return p.tt + ". " + p.mon;
    }
    function wann(ms){
      if (ms == null) return "";
      var d = new Date(ms), jetzt = new Date();
      var tag = function(x){ return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
      var diff = Math.round((tag(jetzt) - tag(d)) / 86400000);
      if (diff === 0) return t("Today");
      if (diff === 1) return t("Yesterday");
      return ohneJahr(d);
    }
    var _chatsGeladen = false;
    function chatSkelett(){
      return [0, 1, 2].map(function(i){ return '<div class="upw-chat is-sk"><span class="upw-sk upw-sk-ic"></span>' +
        '<span class="upw-sk upw-sk-title" style="width:' + [42, 30, 36][i] + '%"></span></div>'; }).join("");
    }
    function renderChats(){
      /* LAEDT DAS DASHBOARD, STEHT AUCH HIER DAS SKELETT (18.09. gemeldet). Die Chatliste kommt
         aus Mira und damit aus einer anderen Quelle als der Rest -- sie war deshalb oft schon
         gefuellt, waehrend daneben noch ueberall Skelette standen. Ein halb geladenes Bild ist
         schlechter als ein ganz ladendes: es sieht fertig aus und ist es nicht. */
      /* DIESELBE BEDINGUNG WIE BEI DEN KACHELN DARUEBER: solange geladen wird ODER noch nie
         Daten da waren, steht hier das Skelett. Nur state.loading zu pruefen war zu wenig --
         der Ladeschalter kommt von Bubble und ist in den ersten Sekundenbruchteilen noch
         false. Genau in dem Fenster stand hier "No chats yet" (19.09. gemeldet: "ab und zu
         geht die Liste kurz in den Platzhalter, waehrend loading yes ist"). */
      if (state.loading || !state.overview){ elChats.innerHTML = chatSkelett(); return; }
      var liste = (typeof window.askMiraRecentChats === "function") ? window.askMiraRecentChats(3) : [];
      if (liste.length) _chatsGeladen = true;
      if (!liste.length){
        /* Solange Mira ihre Liste noch nicht hat, ein Skelett in der Form der Zeilen -- "keine
           Chats" waere eine Aussage, die noch niemand gepruft hat. Nach 6s ohne Liste ist sie
           wahr (dieselbe Frist wie Miras eigene Chatleiste). */
        elChats.innerHTML = _chatsLeer
          ? '<div class="upw-chats-empty" data-i18n="No chats yet">' + esc(t("No chats yet")) + '</div>'
          : chatSkelett();
        return;
      }
      elChats.innerHTML = liste.map(function(c){
        return '<button type="button" class="upw-chat" data-upw-chat="' + esc(c.id) + '">' +
          '<span class="upw-chat-ic" aria-hidden="true">' + UC.icon("messageCircle", 2) + '</span>' +
          '<span class="upw-chat-title">' + esc(c.title || t("Untitled chat")) + '</span>' +
          '<span class="upw-chat-when">' + esc(wann(c.time)) + '</span></button>';
      }).join("");
    }
    /* "Keine Chats" ist eine AUSSAGE und darf erst fallen, wenn sie geprueft ist. Die Uhr dafuer
       lief frueher ab dem Mounten -- sie war also abgelaufen, bevor der Ladeschalter ueberhaupt
       gesetzt war. Jetzt startet sie neu, sobald das Laden endet, und wird zurueckgenommen,
       sobald es wieder beginnt. */
    var _chatsLeer = false, _chatsUhr = null;
    function chatUhrStarten(){
      clearTimeout(_chatsUhr);
      _chatsUhr = setTimeout(function(){ if (!_chatsGeladen){ _chatsLeer = true; renderChats(); } }, 6000);
    }
    function chatUhrZurueck(){ clearTimeout(_chatsUhr); _chatsUhr = null; _chatsLeer = false; }
    chatUhrStarten();
    window.addEventListener("askmira:chats", function(){ _chatsLeer = false; renderChats(); });
    window.addEventListener("askmira:bereit", renderChats);
    elChats.addEventListener("click", function(e){
      var b = e.target.closest("[data-upw-chat]");
      if (b) zuMira({ chatId: b.getAttribute("data-upw-chat") });
    });
    root.querySelector("[data-upw-allchats]").addEventListener("click", function(){ zuMira({ chats: true }); });

    /* ---------- Overview (neu) ----------
       Drei Karten in EINEM Kasten (.up-box), getrennt durch Linien. Zahl, Trend und die
       Groessen sind die der Kennzahl in brand-detail (23px, Trend 15px mit 17px-Pfeil) -- das
       naechste Vorbild in der App, dieselbe Rolle. Der Verlauf ist eine schmale Linie mit Punkt am
       Ende, ohne Achsen: er sagt "steigt oder faellt", die Zahl daneben sagt wie viel. */
    function kpiKarte(label, wertHtml, trendHtml, fussStark){
      return '<div class="upw-kpi">' +
        '<div class="upw-kpi-top"><div class="upw-kpi-main">' +
          '<span class="upw-kpi-label" data-i18n="' + esc(label) + '">' + esc(t(label)) + '</span>' +
          '<span class="upw-kpi-row"><span class="upw-kpi-val">' + wertHtml + '</span>' +
          '<span class="upw-kpi-trend">' + trendHtml + '</span></span></div></div>' +
        '<div class="upw-kpi-foot">' + (fussStark ? '<span class="upw-kpi-strong">' + esc(fussStark) + '</span>' : '') + '</div>' +
      '</div>';
    }
    function fmtPct1(v){ return v == null ? "–" : (UC.fmtPct ? UC.fmtPct(v, 1) : v.toFixed(1) + "%"); }
    function fmtR(v){ return v == null ? "–" : (UC.fmt1 ? UC.fmt1(v) : v.toFixed(1)); }
    function fmtI(v){ return v == null ? "–" : (UC.fmtInt ? UC.fmtInt(v) : String(Math.round(v))); }
    function ersetze(s, o){ return String(s).replace(/\{(\w+)\}/g, function(_, k){ return o[k] != null ? o[k] : ""; }); }
    function renderKpis(){
      if (state.loading || !state.overview){ elKpis.innerHTML = kpiSkelett(); return; }
      if (state.fehler.overview){ elKpis.innerHTML = UC.leseFehlerHtml ? UC.leseFehlerHtml("overview") : ""; return; }
      var o = state.overview;
      var vis = num(o.visibility_pct), rank = num(o.avg_rank), sent = num(o.sentiment);
      /* Position und Feldgroesse: aus dem Payload -- und wenn er sie nicht traegt, aus
         "Competitive field" darunter, das dieselbe Frage beantwortet.
         Der Spitzenreiter (leader_name/leader_visibility_pct) wird hier seit dem 12.09. NICHT
         mehr gelesen: er stand in der zweiten Haelfte der Fusszeile, und die ist gestrichen. Die
         Felder duerfen weiter im Payload stehen, sie werden nur nicht mehr angezeigt. */
      var pos = num(o.visibility_position), anzahl = num(o.brand_count);
      if ((pos == null || anzahl == null) && state.brands && state.brands.length){
        var sortiert = state.brands.slice().sort(function(a, b){ return (num(b.visibility_pct) || 0) - (num(a.visibility_pct) || 0); });
        if (anzahl == null) anzahl = sortiert.length;
        if (pos == null) sortiert.forEach(function(b, i){ if (b.is_own === true || String(b.is_own) === "yes") pos = i + 1; });
      }
      var fussVis = (pos != null && anzahl != null) ? ersetze(t("#{n} of {m} brands"), { n: fmtI(pos), m: fmtI(anzahl) }) : "";
      var bestR = num(o.best_rank);
      var fussRank = bestR != null ? ersetze(t("Best in field {v}"), { v: fmtR(bestR) }) : "";
      var avg = num(o.field_avg_sentiment);
      var fussSent = avg != null ? ersetze(t("Field average {v}"), { v: fmtI(avg) }) : "";
      elKpis.innerHTML =
        kpiKarte("Visibility", '<span class="up-num">' + fmtPct1(vis) + '</span>',
          UC.trendChip(o.visibility_delta_pct, { decimals: true, suffix: "%" }), fussVis) +
        kpiKarte("Avg. Rank", '<span class="up-num">' + fmtR(rank) + '</span>',
          UC.trendChip(o.avg_rank_delta, { decimals: true, inverted: true }), fussRank) +
        kpiKarte("Sentiment", '<span class="up-num">' + fmtI(sent) + '</span>',
          UC.trendChip(o.sentiment_delta, { decimals: true }), fussSent);
    }
    function kpiSkelett(){
      var k = '<div class="upw-kpi is-sk"><div class="upw-kpi-top"><div class="upw-kpi-main">' +
        '<span class="upw-sk upw-sk-lbl"></span><span class="upw-sk upw-sk-val"></span></div>' +
        '</div><div class="upw-kpi-foot"><span class="upw-sk upw-sk-foot"></span></div></div>';
      return k + k + k;
    }

    /* ---------- Competitive field ----------
       Die Zeile von brands-overview (activeRowHtml), ohne Suche, ohne Aktionen, ohne Spalten-
       menue: Index, Logo und Name, Sichtbarkeit mit Trend, Rang, Sentiment. Die Felder heissen
       wie dort, also kann derselbe RPC beide fuellen. */
    /* ===== DIE ZWEI LISTEN (14.09. neu) =======================================================
       Keine Tabelle mehr, kein Raster, keine Trennlinien zwischen den Spalten: links Zeichen und
       Name, rechts der Wert mit seinem Trend. Die Bauteile sind die von core (.up-logo-box,
       .up-num, UC.trendChip) -- neu ist nur die Zeile, die sie traegt.
       Rang und Sentiment sind weg (angefordert): fuer den Blick aufs Dashboard zaehlt, wer wie
       sichtbar ist; alles andere steht eine Ansicht weiter. */
    function logo(url, name){
      var ltr = '<span class="up-logo-ltr">' + esc(String(name || "?").trim().charAt(0) || "?") + '</span>';
      return url ? '<span class="up-logo-box has-img"><img src="' + esc(url) + '" alt="" referrerpolicy="no-referrer"/>' + ltr + '</span>'
                 : '<span class="up-logo-box">' + ltr + '</span>';
    }
    function listenZeile(typ, id, idx, zeichen, name, titel, wertHtml, eigen){
      return '<div class="upw-li' + (eigen ? " is-own" : "") + '" data-upw-row="' + typ + '" data-id="' + esc(String(id == null ? "" : id)) + '">' +
        '<span class="upw-li-idx">' + esc(String(idx)) + '</span>' +
        zeichen +
        '<span class="upw-li-name" title="' + esc(titel || name) + '">' + esc(name) + '</span>' +
        '<span class="upw-li-val">' + wertHtml + '</span></div>';
    }
    /* DAS SKELETT TRAEGT DIE KLASSEN DER ECHTEN ZEILE (15.09.). Vorher hatte es eigene --
       .upw-sk-idx und .upw-sk-ava, zu denen es gar keine CSS gab (0px breit), und ein
       .upw-sk-val als VIERTES Flex-Kind statt in der Wertspalte. Mit dem 40px-Zeilenabstand und
       der festen 116px-Spalte stand danach nichts mehr dort, wo es spaeter steht -- genau das
       war gemeldet ("die Skelette der Tabellen sind voellig off").
       Jetzt kommt die Geometrie aus EINER Quelle: Platzziffer, Logokasten, Name und Wertspalte
       sind dieselben Kaesten wie in listenZeile, nur mit einem grauen Balken darin. Wer die
       Zeile aendert, aendert das Skelett automatisch mit. */
    function listenSkelett(n){
      var out = "";
      for (var i = 0; i < n; i++){
        out += '<div class="upw-li is-sk">' +
          '<span class="upw-li-idx"><span class="upw-sk upw-sk-bar" style="width:8px"></span></span>' +
          '<span class="up-logo-box"><span class="upw-sk upw-sk-ava"></span></span>' +
          '<span class="upw-li-name"><span class="upw-sk upw-sk-bar" style="width:' + [46, 34, 40, 30, 38][i % 5] + '%"></span></span>' +
          '<span class="upw-li-val"><span class="upw-sk upw-sk-bar" style="width:38px"></span></span>' +
          '</div>';
      }
      return out;
    }
    /* FUENF ZEILEN -- und die eigene Marke IMMER dabei (14.09. angefordert): steht sie jenseits
       von Platz fuenf, haengt sie unten an, mit ihrer ECHTEN Position in der Spalte davor. Sonst
       zeigt ein Dashboard fuenf fremde Marken und verschweigt die eigene, was die eine Frage
       unbeantwortet laesst, wegen der man hinsieht. */
    var LISTE_MAX = 5;
    function eigenesRoh(r){ return r && (r.is_own === true || String(r.is_own) === "yes"); }
    function renderBrands(){
      if (state.fehler.brands){ elBrands.innerHTML = UC.leseFehlerHtml ? UC.leseFehlerHtml("brands") : ""; return; }
      if (state.loading || !state.brands){ elBrands.innerHTML = listenSkelett(LISTE_MAX); return; }
      var rows = state.brands;
      if (!rows.length){ elBrands.innerHTML = '<div class="upw-li-empty" data-i18n="No data">' + esc(t("No data")) + '</div>'; return; }
      var pos = function(r, i){ return num(r.position) != null ? num(r.position) : i + 1; };
      var zeige = rows.slice(0, LISTE_MAX);
      var eigenIdx = -1;
      rows.forEach(function(r, i){ if (eigenIdx < 0 && eigenesRoh(r)) eigenIdx = i; });
      var angehaengt = eigenIdx >= LISTE_MAX ? rows[eigenIdx] : null;
      var html = zeige.map(function(r, i){
        var v = num(r.visibility_pct);
        return listenZeile("brand", r.company_id, fmtI(pos(r, i)),
          logo(r.logo_url || r.favicon_url, r.name),
          r.name == null ? "" : String(r.name), null,
          '<span class="up-num' + (v == null ? " is-empty" : "") + '">' + fmtPct1(v) + '</span>' +
            UC.trendChip(r.visibility_delta_pct, { decimals: true, suffix: "%" }),
          eigenesRoh(r));
      }).join("");
      if (angehaengt){
        var av = num(angehaengt.visibility_pct);
        html += listenZeile("brand", angehaengt.company_id, fmtI(pos(angehaengt, eigenIdx)),
          logo(angehaengt.logo_url || angehaengt.favicon_url, angehaengt.name),
          angehaengt.name == null ? "" : String(angehaengt.name), null,
          '<span class="up-num' + (av == null ? " is-empty" : "") + '">' + fmtPct1(av) + '</span>' +
            UC.trendChip(angehaengt.visibility_delta_pct, { decimals: true, suffix: "%" }),
          true);
      }
      elBrands.innerHTML = html;
    }
    function renderCites(){
      var url = state.cmode === "url";
      var rows = url ? state.urls : state.domains;
      var fehler = url ? state.fehler.urls : state.fehler.domains;
      if (fehler){ elCites.innerHTML = UC.leseFehlerHtml ? UC.leseFehlerHtml("citations") : ""; return; }
      if (state.loading || !rows){ elCites.innerHTML = listenSkelett(LISTE_MAX); return; }
      if (!rows.length){ elCites.innerHTML = '<div class="upw-li-empty" data-i18n="No data">' + esc(t("No data")) + '</div>'; return; }
      elCites.innerHTML = rows.slice(0, LISTE_MAX).map(function(r, i){
        var name = url ? (r.title || r.url || "") : (r.domain || "");
        var id = url ? (r.url || r.title || "") : (r.domain || "");
        var fav = r.favicon || r.logo || "";
        var anteil = num(url ? (r.global_share_pct != null ? r.global_share_pct : r.share_pct) : r.share_pct);
        var zeichen = fav
          ? '<span class="up-logo-box up-fav has-img"><img src="' + esc(fav) + '" alt="" referrerpolicy="no-referrer"/></span>'
          : '<span class="up-logo-box up-fav"></span>';
        return listenZeile(url ? "url" : "domain", id, fmtI(i + 1), zeichen, name,
          url && r.url ? r.url : name,
          '<span class="up-num' + (anteil == null ? " is-empty" : "") + '">' + fmtPct1(anteil) + '</span>' +
            UC.trendChip(r.share_delta_pct, { decimals: true, suffix: "%" }), false);
      }).join("");
    }

    /* ---------- Das geliehene Opportunities-Brett (12.09. angefordert) ----------
       Genau derselbe Griff wie bei Mira weiter oben, und aus demselben Grund: eine zweite
       .uo-root wuerde jede window.opportunities*-Funktion der echten ueberschreiben (der
       Launcher in opportunities.js erklaert es ausfuehrlich). Das Brett wandert also her,
       solange sein Bereich vorne steht, und geht zurueck, sobald der andere Bereich oder eine
       andere Ansicht dran ist. Seine Werkzeugleiste zieht dabei in elUoTools ein -- deshalb
       stehen Board/List, Sortierer, Suche und die Brett-Einstellungen hier oben rechts in
       DERSELBEN Zeile wie der Bereichs-Umschalter, so wie verlangt. */
    function brettBereit(){
      return typeof window.opportunitiesLauncherAttach === "function";
    }
    function brettHier(){
      return !!(elBoard && elBoard.querySelector(".uo-root"));
    }
    function brettAusleihen(){
      if (!brettBereit() || !elBoard) return false;
      var ok = false;
      /* Der Anheftpunkt fuer das Brett: unser eigener plus die Hoehe der klebenden Zeile darueber.
         Jedes Mal frisch gerechnet statt einmal beim Aufbau -- die Zeile bricht auf schmalen
         Schirmen um und ist dann hoeher. */
      var obenIch = parseFloat(getComputedStyle(root).getPropertyValue("--up-sticky-top")) || 0;
      var zeileHoch = elModeseg ? Math.round(elModeseg.getBoundingClientRect().height) : 0;
      try { ok = window.opportunitiesLauncherAttach(elBoard, { view: VIEW, toolSlot: elUoTools,
              stickyTop: Math.round(obenIch + zeileHoch) }); } catch(e){}
      root.classList.toggle("has-board", !!ok && brettHier());
      return ok;
    }
    function brettZurueckgeben(){
      if (typeof window.opportunitiesLauncherDetach === "function"){
        try { window.opportunitiesLauncherDetach(elBoard); } catch(e){}
      }
      root.classList.remove("has-board");
    }
    /* Dieselbe kurze Anlaufreihe wie bei Mira: Bubble blendet eine Gruppe erst im naechsten Task
       ein, und opportunities.js startet auf einer frischen Seite etwas spaeter als dieses
       Dashboard. Kein Dauertakt -- jeder Anlass stoesst genau diese Reihe an. */
    var _brettT = [];
    function brettPruefen(){
      _brettT.forEach(clearTimeout); _brettT = [];
      [0, 250, 800, 1800].forEach(function(ms){
        _brettT.push(setTimeout(function(){
          if (state.mode !== "opportunities") return;
          if (sichtbar()) brettAusleihen();
          root.classList.toggle("has-board", brettHier());
        }, ms));
      });
    }
    window.addEventListener("opportunities:bereit", function(){
      if (state.mode === "opportunities") brettPruefen();
    });

    /* ===== DIE FUSSZEILE UNTER JEDER LISTE (14.09.) ===========================================
       "All 8 brands" bzw. "All Domains"/"All URLs" mit Chevron, in Drittfarbe, im Hover in
       Primaerfarbe -- und ein Klick meldet es an Bubble. Bei den Marken steht die GESAMTZAHL
       darin (overview.brand_count), nicht die fuenf gezeigten; bei den Zitierungen waere die
       Gesamtzahl die der Domains bzw. URLs und stuende damit zweimal fast gleich da, darum dort
       nur das Wort. */
    function syncAlle(){
      if (elAllBrands){
        var o = state.overview, bn = o ? num(o.brand_count) : null;
        var bt = bn != null ? ersetze(t("Go to all {n} brands"), { n: fmtI(bn) }) : t("Go to all brands");
        elAllBrands.setAttribute("data-tip", bt);
        elAllBrands.setAttribute("aria-label", bt);
      }
      if (elAllCites){
        var ct = t(state.cmode === "url" ? "Go to all URLs" : "Go to all domains");
        elAllCites.setAttribute("data-tip", ct);
        elAllCites.setAttribute("aria-label", ct);
      }
    }
    /* GEMELDET (12.09.): "wenn man auf Citations wechselt, muss im Switcher auch Domain
       ausgewaehlt sein". War es nicht -- is-active wurde NUR im Klickzuhoerer gesetzt, also trug
       beim ersten Anzeigen KEINER der beiden Knoepfe die Markierung, obwohl state.cmode sehr wohl
       auf "domain" stand und die Liste auch Domains zeigte. Der Zustand war richtig, nur sein
       Abbild fehlte. Jetzt schreibt eine Funktion beides, und sie laeuft auch beim Aufbau. */
    function syncCmode(){
      if (!elCmodeWrap) return;
      Array.prototype.forEach.call(elCmodeWrap.querySelectorAll("[data-upw-cmode]"), function(b){
        var on = b.getAttribute("data-upw-cmode") === state.cmode;
        b.classList.toggle("is-active", on); b.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    /* ===== WELCHE DATEN GERADE GEBRAUCHT WERDEN =================================================
       Der Bereich merkt sich seine Wahl im localStorage -- wer zuletzt auf "Opportunities" stand,
       sieht das Brett schon beim Laden, und Bubble kann das nicht wissen. Ohne diese Meldung
       muesste jede Seite alles mitladen, auch was niemand ansieht.
       Seit dem Umbau auf zwei Listen nebeneinander braucht "Main Metrics" BEIDE Datensaetze
       gleichzeitig -- Marken und Zitierungen -- und meldet sie als Liste. */
    /* NUR MELDEN, WAS WIRKLICH FEHLT (15.09.). Vorher meldete jeder Wechsel seinen ganzen
       Abschnitt an, auch wenn die Daten laengst im Zustand standen -- der erste Schritt liefert
       inzwischen top_urls gleich mit. Der Workflow lief dann fuer nichts, und je nachdem, was er
       tut (Skelett an, neu laden, leer zurueckschreiben), verschwanden gefuellte Listen beim
       Umschalten. Genau so gemeldet: "wenn ich auf url schalte, seh ich keine daten, obwohl die
       ja schon da sind."
       null heisst "noch nie geliefert", eine leere Liste heisst "geliefert und wirklich leer" --
       zwei verschiedene Dinge (CLAUDE.md §2), und nur das erste ist ein Bedarf. Ein Lesefehler
       zaehlt auch als Bedarf: dann ist ein neuer Versuch genau das Richtige. */
    function fehlt(abschnitt){
      if (abschnitt === "brands")          return !state.brands || state.fehler.brands;
      if (abschnitt === "citations_domain") return !state.domains || state.fehler.domains;
      if (abschnitt === "citations_url")    return !state.urls || state.fehler.urls;
      return true;   /* opportunities: das Brett fuehrt seinen eigenen Zustand, hier unbekannt */
    }
    /* UND NUR, WENN DIESES DASHBOARD UEBERHAUPT DRAN IST (15.09.). Gemessen: die Komponente
       mountet auch in einer versteckten Gruppe und meldete ihren Bedarf 13ms nach dem Aufbau --
       also auch dann, wenn der Nutzer im Standard-Dashboard steht und niemand diese Daten sehen
       wird. Wer den Workflow daran haengt, laedt den teuren Power-RPC bei jedem Seitenaufbau.
       Zwei Bedingungen, beide noetig: der Dashboard-Modus steht auf "power" (der Umschalter im
       Seitenkopf, gemeinsamer Wert in core), UND die Wurzel wird wirklich gezeichnet -- die
       Ansicht kann eine andere sein. Beim Umschalten auf Power wird nachgeholt, siehe
       onDashboardMode weiter oben. */
    function dranSein(){
      if (UC.getDashboardMode && UC.getDashboardMode() !== "power") return false;
      return sichtbar();
    }
    /* EIN UNLESBARER ABSCHNITT SAGT, WELCHER ER IST UND WIE ER AUSSAH (15.09.). Der Bildschirm
       kann das nicht: dort steht "Could not load ..." -- richtig fuer den Nutzer, nutzlos fuer
       die Suche. Gekostet hat das eine ganze Runde: ein zweiter Aufruf mit unlesbarem top_urls
       zerlegte nur die Zitierungen, waehrend Overview und Marken heil dastanden, und von aussen
       sah es aus, als koenne die Komponente URLs nicht. Die ersten 80 Zeichen des Rohwerts
       zeigen sofort, ob dort "null", "[object Object]" oder ein abgeschnittener Payload steht.
       Nur beim UEBERGANG auf kaputt, sonst schreibt jeder Neuaufbau dieselbe Zeile. */
    function merkeFehler(abschnitt, r, roh){
      var vorher = !!state.fehler[abschnitt];
      state.fehler[abschnitt] = r.kaputt;
      if (r.kaputt && !vorher && window.console){
        var txt = typeof roh === "string" ? roh : (function(){ try { return JSON.stringify(roh); } catch(e){ return String(roh); } })();
        console.warn('[power-dashboard] "' + abschnitt + '" war nicht lesbar und zeigt jetzt den ' +
          'Lesefehler. So kam der Wert an (erste 80 Zeichen): ' + String(txt).slice(0, 80));
      }
    }
    var _bedarfGemeldet = {};
    function datenBedarfMelden(){
      if (!dranSein()) return;
      var alle = state.mode === "opportunities"
        ? ["opportunities"]
        : ["brands", state.cmode === "url" ? "citations_url" : "citations_domain"];
      var needs = alle.filter(fehlt);
      /* Nichts zu holen: gar nicht erst feuern. Ein Ereignis mit leerer Liste waere eine
         Einladung, den Workflow trotzdem durchlaufen zu lassen. */
      if (!needs.length) return true;
      /* Auch diese Ansage wartet auf ihren Empfaenger -- aus demselben Grund wie die
         Modusmeldung im Seitenkopf. Sie geht beim Aufbau raus, das Toolbox-Element kann noch
         fehlen, und eine verpuffte Bedarfsmeldung heisst: die Listen bleiben leer. */
      /* STILL feuern. Dieser Kanal ist eine Bitte, keine Pflicht: wer alle Abschnitte schon
         im Pageload liefert, braucht ihn nie -- und bekam trotzdem bei jedem Aufbau eine
         Warnung, weil die Abschnitte in den ersten Sekunden noch fehlen (gemeldet am
         18.09.: "aber ich hab im power dashboard keine probleme").
         Ob wirklich etwas fehlt, weiss erst der Blick DANACH: sind die Abschnitte acht
         Sekunden spaeter immer noch nicht da, hat niemand geantwortet und niemand sie
         anders geliefert -- dann steht in der Konsole, welche fehlen und was zu tun ist.
         Einmal je Abschnittsgruppe, sonst wiederholt sich die Zeile bei jedem Wechsel. */
      fire.spaet("data-needs-fn", "upwNeeds", { mode: state.mode, needs: needs }, { still: true });
      /* Nur was dieses Dashboard auch BEURTEILEN kann. "opportunities" gilt hier immer als
         fehlend -- das Brett fuehrt seinen eigenen Zustand, den kennt die Komponente nicht
         (siehe fehlt()). Eine Nachschau darueber waere also immer eine Warnung, egal wie gut
         alles verdrahtet ist. */
      var pruefbar = needs.filter(function(n){ return n !== "opportunities"; });
      var schluessel = pruefbar.join(",");
      if (pruefbar.length && !_bedarfGemeldet[schluessel]){
        _bedarfGemeldet[schluessel] = true;
        setTimeout(function(){
          var offen = pruefbar.filter(fehlt);
          if (!offen.length) return;
          if (window.console) console.warn('[power-dashboard] Diese Abschnitte fehlen weiter: ' +
            offen.join(', ') + '. Das Dashboard hat sie ueber upwNeeds angefordert, es gibt aber\n' +
            'kein Toolbox-Element dieses Namens -- und geliefert wurden sie auch sonst nicht.\n' +
            'Entweder upwNeeds verdrahten (Nutzlast { mode, needs }) oder die Abschnitte schon\n' +
            'im Pageload an ihre Setter geben.');
        }, 8000);
      }
      return true;
    }
    /* NACHFRAGEN, BIS DIESES DASHBOARD WIRKLICH DRAN IST.
       Beim Seitenaufbau steht es regelmaessig noch in einer versteckten Gruppe: Bubble blendet
       sie erst ein, nachdem der Seitenkopf seinen Modus gemeldet hat UND der Workflow gelaufen
       ist. Wie lange das dauert, weiss vorher niemand -- eine feste Reihe von Zeitpunkten ist
       eine Wette, und die ging am 15.09. verloren ("jetzt laedt nix mehr"): der Workflow war
       langsamer als die letzte Stufe, danach fragte niemand mehr nach, die Listen blieben leer.
       Also nachsehen, bis es klappt: alle 250ms, hoechstens 15 Sekunden, beim ersten Erfolg
       Schluss. Jeder Blick ist ein Lesen aus dem localStorage und ein getClientRects.
       KEIN ResizeObserver und kein requestAnimationFrame, obwohl beides hier naheliegt: beide
       ruhen in einem VERDECKTEN Tab, und genau dort baut ein Browser die Seite regelmaessig auf
       (gemessen im Pruefstand -- mit dem Beobachter kam die Meldung nie). */
    var _bedarfUhr = null, _bedarfBis = 0;
    function jetztMs(){ return window.performance && performance.now ? performance.now() : Date.now(); }
    function bedarfNachholen(){
      if (_bedarfUhr) clearTimeout(_bedarfUhr);
      _bedarfBis = jetztMs() + 15000;
      (function schauen(){
        _bedarfUhr = null;
        if (datenBedarfMelden()) return;                /* gemeldet oder nichts zu melden */
        if (jetztMs() >= _bedarfBis){
          if (window.console) console.warn("[power-dashboard] Dieses Dashboard wurde 15 Sekunden " +
            "lang nicht gezeichnet (versteckte Gruppe oder Standard-Modus), also ging KEINE " +
            "Bedarfsmeldung raus. Wird es spaeter sichtbar, fragt es beim Modus- oder " +
            "Ansichtswechsel erneut nach.");
          return;
        }
        _bedarfUhr = setTimeout(schauen, 250);
      })();
    }
    function syncMode(){
      var chancen = state.mode === "opportunities";
      syncCmode();
      if (elModeseg) Array.prototype.forEach.call(elModeseg.querySelectorAll("[data-upw-mode]"), function(b){
        var on = b.getAttribute("data-upw-mode") === state.mode;
        b.classList.toggle("is-active", on); b.setAttribute("aria-selected", on ? "true" : "false");
      });
      if (elMetrics) elMetrics.classList.toggle("is-off", chancen);
      if (elBoard) elBoard.classList.toggle("is-off", !chancen);
      /* Das Brett wird nur geliehen, solange sein Bereich vorne steht -- sonst haelt das Dashboard
         es fest, waehrend nebenan die Opportunities-Ansicht leer dasteht. */
      if (chancen) brettPruefen(); else brettZurueckgeben();
    }
    if (elModeseg) elModeseg.addEventListener("click", function(e){
      var b = e.target.closest("[data-upw-mode]");
      if (!b) return;
      var roh = b.getAttribute("data-upw-mode");
      var v = MODI[roh] ? roh : "metrics";
      if (v === state.mode) return;
      state.mode = v;
      writeMode(v);
      syncMode();
      datenBedarfMelden();
    });
    if (elCmodeWrap) elCmodeWrap.addEventListener("click", function(e){
      var b = e.target.closest("[data-upw-cmode]");
      if (!b) return;
      state.cmode = b.getAttribute("data-upw-cmode") === "url" ? "url" : "domain";
      writeCmode(state.cmode);
      syncCmode();
      renderCites();
      syncAlle();
      datenBedarfMelden();
    });
    /* Die zwei Fusszeilen melden sich einzeln -- "alle Marken" und "alle Zitierungen" fuehren auf
       verschiedene Ansichten. Die Citations-Meldung traegt mit, welche der beiden Listen offen
       war, damit die Zielansicht denselben Modus zeigt. */
    /* ---------- NAVIGATION OHNE BUBBLE-WORKFLOW (15.09.) --------------------------------------
       Die Host-App wechselt Ansichten mit showView(name) und oeffnet Drawer mit
       openDrawer(art, id) -- ausnahmslos, und openDrawer meldet die Kennung von sich aus an
       bubble_fn_drawer_<art>. Damit braucht KEIN Klick hier einen eigenen Workflow. Derselbe Weg,
       den Miras Senden aus dem Dashboard schon geht (ask-mira.js, zuMira).
       Die Namen sind nicht geraten: view-<name> stammt aus den Sidebar-Schluesseln, die drei
       Drawer-Arten stehen in DRAWER_LEVELS des Header-Snippets (brand und domain auf Ebene 1,
       url auf Ebene 2).
       Die EREIGNISSE BLEIBEN und feuern weiter. Sie wegzunehmen waere eine stille Vertrags-
       aenderung, und wer zusaetzlich etwas tun will (etwas mitloggen, einen State setzen), haengt
       sich weiter daran. Wer nichts tut, braucht den Workflow nicht mehr. */
    function zurAnsicht(name){
      if (typeof window.showView === "function"){ try { window.showView(name); return true; } catch(e){} }
      /* Kein showView: die Seite ist nicht die Hauptapp (Prueftand, Landingpage). Dann bleibt es
         beim Ereignis -- und einer Zeile, damit es nicht stumm nichts tut (CLAUDE.md §5). */
      if (window.console) console.warn('[power-dashboard] showView("' + name + '") gibt es auf ' +
        'dieser Seite nicht. Das Ereignis ist trotzdem gefeuert.');
      return false;
    }
    function zumDrawer(art, id){
      if (!id) return false;
      if (typeof window.openDrawer === "function"){ try { window.openDrawer(art, id); return true; } catch(e){} }
      if (window.console) console.warn('[power-dashboard] openDrawer("' + art + '") gibt es auf ' +
        'dieser Seite nicht. Das Ereignis ist trotzdem gefeuert.');
      return false;
    }
    if (elAllBrands) elAllBrands.addEventListener("click", function(){
      fire("data-brands-fn", "upwBrands", {});
      zurAnsicht("brands");
    });
    if (elAllCites) elAllCites.addEventListener("click", function(){
      fire("data-citations-fn", "upwCitations", { mode: state.cmode === "url" ? "urls" : "domains" });
      zurAnsicht("citations");
    });
    root.addEventListener("click", function(e){
      var row = e.target.closest("[data-upw-row]");
      if (row && !row.classList.contains("up-tsk")){
        var typ = row.getAttribute("data-upw-row");
        var id = row.getAttribute("data-id") || "";
        fire("data-rowclick-fn", "upwRowClick", { type: typ, id: id });
        /* Die Zeilentypen heissen genau wie die Drawer: brand, domain, url. */
        zumDrawer(typ, id);
      }
    });

    function renderAll(){ renderChips(); renderChats(); renderKpis(); renderBrands(); renderCites(); syncAlle(); }

    /* Sprache: Beschriftungen und Chips sind beim Zeichnen geschrieben -- also neu zeichnen. Nur
       bei der Sprache, nicht bei jeder Einstellung (siehe setDashboardMode in core). */
    if (UC.onPrefs) UC.onPrefs(function(d){ if (!d || d.name === "locale") renderAll(); });
    /* Thema: die Typ-Chips tragen ihre Farbe inline, und die haengt am Thema. */
    if (UC.onTheme) UC.onTheme(function(){ renderCites(); });
    /* Kompaktmodus des Tabellenbaukastens (55px statt 72px je Zeile) -- "das soll kompakter sein".
       is-dense ist der Schalter, den core dafuer hat (Zeilenhoehe "Compact" der grossen Tabellen). */
    root.classList.add("is-dense");
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 760, vnarrowAt: 480 });
    if (UC.makeTooltips) UC.makeTooltips(root, dunkel);
    /* Der Erklaerkasten an den Spaltenkoepfen -- derselbe Aufruf wie in brands-overview und
       visibility-chart, und derselbe Text aus UC.explainCopy. {scope}/{trend}/{subject} sind die
       Stellen, die je Tabelle wirklich verschieden sind: hier ist der Zeitraum der der Kopfzeile,
       und den Trend zeigt jede der drei Wertspalten. */
    /* Der Erklaerkasten an den Spaltenkoepfen ist mit den Spaltenkoepfen weggefallen (14.09.):
       die zwei Listen haben keine Koepfe mehr, nur noch Ueberschriften. UC.makeExplain wird hier
       also nicht mehr gerufen -- die Texte in core bleiben, sie gehoeren den grossen Tabellen. */
    /* Der persistierte Zustand (Bereich, Domains/URL) muss auf das statische Anfangsmarkup
       nachgezogen werden -- es traegt noch keine is-active/is-off-Klassen. */
    syncMode();
    renderAll();
    pruefen();
    /* Nach dem ersten Zeichnen und nicht davor: der Bedarf haengt am wiederhergestellten Bereich,
       und der steht erst nach syncMode() fest.
       Eine REIHE und kein einzelner Aufruf (15.09.): beim Seitenaufbau steht dieses Dashboard
       regelmaessig noch in einer versteckten Gruppe -- Bubble blendet sie erst ein, nachdem der
       Seitenkopf seinen Modus gemeldet hat und der Workflow gelaufen ist. Ein einzelner Aufruf
       faellt genau in dieses Loch: dranSein() ist false, und danach fragt niemand mehr nach.
       Genau so gemeldet ("jetzt laedt nix mehr"). Die Reihe hoert auf, sobald gemeldet wurde
       oder nichts zu melden ist. */
    bedarfNachholen();

    return {
      /* Fuer die Konsole: window.upwStand(). Zeigt je Abschnitt, WAS zuletzt ankam, was daraus
         wurde und ob ein Lesefehler steht. Beantwortet die eine Frage, die der Bildschirm nie
         beantworten kann -- "Could not load ..." nennt den Abschnitt, nicht den Wert. Aendert
         nichts, kostet nichts: state.letzte haelt nur Verweise auf das, was ohnehin dasteht. */
      stand: function(){
        function beschreibe(v){
          if (v === undefined) return "(nicht im Payload)";
          if (v === null) return "null";
          if (Array.isArray(v)) return "Liste mit " + v.length;
          if (typeof v === "object") return "Objekt";
          return "TEXT(" + String(v).length + " Zeichen): " + String(v).slice(0, 80);
        }
        var L = state.letzte || {};
        return {
          zuletztGesetzt: L.zeit || "(noch kein Aufruf)",
          laedtGerade: !!state.loading,
          overview: { kamAn: beschreibe(L.overview), imZustand: state.overview ? "da" : "leer", lesefehler: !!state.fehler.overview },
          brands:   { kamAn: beschreibe(L.brands),   imZustand: state.brands ? state.brands.length + " Zeilen" : "leer",   lesefehler: !!state.fehler.brands },
          domains:  { kamAn: beschreibe(L.top_domains), imZustand: state.domains ? state.domains.length + " Zeilen" : "leer", lesefehler: !!state.fehler.domains },
          urls:     { kamAn: beschreibe(L.top_urls), imZustand: state.urls ? state.urls.length + " Zeilen" : "leer",       lesefehler: !!state.fehler.urls },
          errorsBlock: beschreibe(L.errors),
          zeigtGerade: state.cmode === "url" ? "URLs" : "Domains"
        };
      },
      update: function(p){
        var r;
        /* Den letzten Rohwert je Abschnitt aufheben -- nur zum Nachsehen, nichts haengt daran. */
        try {
          state.letzte = { zeit: new Date().toISOString(),
            overview: p && p.overview, brands: p && p.brands,
            top_domains: p && p.top_domains, top_urls: p && p.top_urls, errors: p && p.errors };
        } catch(e){}
        /* Der ganze Payload war nicht lesbar (core, normParams). Dann weiss niemand, welcher Teil
           gemeint war -- alle vier Bereiche zeigen den Lesefehler statt ihrer alten Werte oder
           eines endlosen Skeletts (CLAUDE.md §2). */
        if (p.__parseError){
          state.fehler.overview = state.fehler.brands = state.fehler.domains = state.fehler.urls = true;
          state.loading = false;
          renderAll();
          return;
        }
        if (p.overview != null){
          r = lesen(p.overview);
          var o = Array.isArray(r.wert) ? r.wert[0] : r.wert;
          state.fehler.overview = r.kaputt || !o;
          state.overview = o || null;
        }
        if (p.brands != null){ r = liste(p.brands); merkeFehler("brands", r, p.brands); state.brands = r.wert || []; }
        if (p.top_domains != null){ r = liste(p.top_domains); merkeFehler("domains", r, p.top_domains); state.domains = r.wert || []; }
        if (p.top_urls != null){ r = liste(p.top_urls); merkeFehler("urls", r, p.top_urls); state.urls = r.wert || []; }
        /* EIN ABSCHNITT IST GESCHEITERT, die anderen nicht (14.09.). Der RPC liefert dafuer einen
           errors-Block, und ohne diese Zeilen haette der Aufrufer nur zwei schlechte Moeglich-
           keiten: den Abschnitt weglassen (dann steht das Skelett endlos) oder eine leere Liste
           schicken (dann behauptet die Oberflaeche "No data", wo in Wahrheit die Abfrage
           gescheitert ist). Beides ist ein stiller Ausfall.
           Die Schluessel sind die Abschnittsnamen aus der Datenspezifikation, damit RPC und
           Nutzlast dieselbe Sprache sprechen -- und nicht die internen Zustandsnamen.
           STEHT NACH den Datenzeilen, nicht davor: ein gescheiterter Abschnitt kommt in der
           Regel MIT leerer Liste an, und "top_urls: []" setzte den Fehler sonst sofort wieder
           auf false -- gemessen am Beispielpayload vom 14.09., der errors.citations_url trug
           und trotzdem die Liste zeigte. Umgekehrt loescht ein spaeterer Aufruf ohne diesen
           Schluessel den Fehler weiterhin, weil die Datenzeile ihn auf false zurueckschreibt. */
        if (p.errors && typeof p.errors === "object"){
          var ABSCHNITT = { overview: "overview", brands: "brands",
                            citations_domain: "domains", citations_url: "urls" };
          /* WER DATEN GELIEFERT HAT, IST NICHT GESCHEITERT (15.09.). Der RPC schickt seinen
             errors-Block auch dann noch mit, wenn der Abschnitt inzwischen Daten hat -- gemessen
             am laufenden System: top_urls kam als Liste mit 5 an, stand als 5 Zeilen im Zustand,
             und darueber lag trotzdem "Could not load citations". Drei Runden Suche, weil der
             Bildschirm nur den Abschnitt nennt und nicht den Grund.
             Die Regel ist jetzt: ein gemeldeter Fehler zaehlt nur fuer einen Abschnitt, der in
             DIESEM Aufruf nichts Brauchbares mitgebracht hat. Eine LEERE Liste zaehlt weiterhin
             als nichts -- sie ist ja gerade die Folge des Fehlschlags, und "No data" waere dort
             die falsche Auskunft. Damit bleibt der echte Fall erhalten (Abfrage gescheitert, also
             leer oder gar nicht dabei) und der falsche verschwindet. */
          var GEFUELLT = {
            overview: p.overview != null && !!state.overview,
            brands:   p.brands != null && !!(state.brands && state.brands.length),
            domains:  p.top_domains != null && !!(state.domains && state.domains.length),
            urls:     p.top_urls != null && !!(state.urls && state.urls.length)
          };
          for (var eKey in ABSCHNITT){
            if (!Object.prototype.hasOwnProperty.call(p.errors, eKey)) continue;
            if (!p.errors[eKey]) continue;                 /* null/leer heisst "kein Fehler" */
            var zielAbschnitt = ABSCHNITT[eKey];
            if (GEFUELLT[zielAbschnitt]){
              if (window.console) console.warn('[power-dashboard] Der RPC meldet "' + eKey +
                '" als gescheitert, hat aber Daten dafuer mitgeschickt. Die Daten werden gezeigt. ' +
                'Im RPC gehoert dieser Schluessel nur in den errors-Block, wenn der Abschnitt ' +
                'wirklich leer bleibt.');
              continue;
            }
            state.fehler[zielAbschnitt] = true;
            state.loading = false;
          }
        }
        if (p.citations_label != null) state.citesLabel = String(p.citations_label);
        if (p.totalCountDomain != null) state.totalCountDomain = num(p.totalCountDomain);
        if (p.totalCountUrl != null) state.totalCountUrl = num(p.totalCountUrl);
        if (p.chips != null){ r = liste(p.chips); state.chips = r.kaputt ? null : r.wert; }
        /* Echte Daten beenden jeden Ladezustand -- auch einen ausdruecklichen ohne passendes "no". */
        if (p.overview != null || p.brands != null || p.top_domains != null || p.top_urls != null) state.loading = false;
        renderAll();
      },
      /* Ein NEUER Ladeversuch raeumt die Lesefehler weg -- wie in responses-table. Sonst stuende
         die Meldung auch dann noch da, wenn laengst frische Daten unterwegs sind: gemessen, nach
         einem kaputten Payload zeigten beide Tabellen trotz "yes" weiter den Fehler. */
      setLoading: function(on){
        var vorher = state.loading;
        state.loading = UC.isYes(on);
        if (state.loading) state.fehler = {};
        /* Die Uhr der Chatliste haengt am Ladezustand und nicht am Mounten -- siehe dort.
           Direkt gerufen und nicht ueber window: es kann mehr als ein Dashboard auf der Seite
           stehen, und ein globaler Griff wuerde dann das falsche treffen. */
        if (state.loading) chatUhrZurueck();
        else if (vorher) chatUhrStarten();
        renderAll();
      }
    };
  }

  upwBoot(50);
})();
