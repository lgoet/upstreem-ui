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

   DATEN: bis ein Setter kommt, stehen Beispieldaten da (data-demo, siehe die Vorlage) -- so
   verlangt ("erstmal Dummy-Daten"). Die Felder sind DIESELBEN, die brands-overview und
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

  /* ---------- Beispieldaten ----------
     Die Werte aus dem Entwurf, damit das Dashboard vor dem Anschluss so aussieht wie gemeint.
     Die Form ist die der echten Setter -- wer den Anschluss baut, sieht hier, was ankommen muss. */
  var DEMO = {
    overview: {
      range_label: "Last 30 days",
      visibility_pct: 3.0, visibility_delta_pct: 1.0,
      visibility_series: [2.1, 2.2, 2.4, 2.3, 2.6, 2.8, 3.0],
      visibility_position: 2, brand_count: 8, leader_name: "Anfragenfluss", leader_visibility_pct: 5.2,
      avg_rank: 3.3, avg_rank_delta: -0.9,
      rank_series: [4.0, 3.9, 4.1, 3.8, 3.9, 3.6, 3.3],
      best_rank: 2.6, first_count: 14, prompt_count: 91,
      sentiment: 76, sentiment_delta: 1.6,
      sentiment_series: [74, 73.5, 74.5, 74, 74.8, 74.6, 76],
      field_avg_sentiment: 74, negative_count: 6, response_count: 214
    },
    /* avg_rank_delta und sentiment_delta sind seit dem 12.09. dabei: "Competitive field" zeigt
       den Trend jetzt in ALLEN drei Wertspalten, genau wie die maximierte Tabelle im Visibility
       Chart, deren Zeile hier das Vorbild ist. Beim Rang ist WENIGER besser -- die Richtung dreht
       UC.trendChip ueber inverted, nicht das Vorzeichen der Daten. */
    brands: [
      { company_id: "d1", position: 1, name: "Anfragenfluss", logo_url: "", visibility_pct: 5.2, visibility_delta_pct: 4.0, avg_rank: 2.6, avg_rank_delta: -0.4, sentiment: 75, sentiment_delta: 2.1 },
      { company_id: "d2", position: 2, name: "LeeUp Media", logo_url: "", visibility_pct: 3.0, visibility_delta_pct: 1.0, avg_rank: 3.3, avg_rank_delta: -0.9, sentiment: 76, sentiment_delta: 1.6, is_own: true },
      { company_id: "d3", position: 3, name: "Candidate Flow", logo_url: "", visibility_pct: 2.1, visibility_delta_pct: -1.0, avg_rank: 3.5, avg_rank_delta: 0.3, sentiment: 71, sentiment_delta: -1.2 },
      { company_id: "d4", position: 4, name: "Andreas May", logo_url: "", visibility_pct: 1.2, visibility_delta_pct: 0, avg_rank: 3.2, avg_rank_delta: 0, sentiment: 74, sentiment_delta: 0 },
      { company_id: "d5", position: 5, name: "Leadmagneten", logo_url: "", visibility_pct: 0.6, visibility_delta_pct: 0, avg_rank: 3.7, avg_rank_delta: 0.2, sentiment: 71, sentiment_delta: 0.4 },
      { company_id: "d6", position: 6, name: "A&M Beratung", logo_url: "", visibility_pct: 0.4, visibility_delta_pct: 0, avg_rank: 4.0, avg_rank_delta: -0.1, sentiment: 72, sentiment_delta: -0.6 },
      { company_id: "d7", position: 7, name: "Matthias Niehaus", logo_url: "", visibility_pct: 0.3, visibility_delta_pct: 0, avg_rank: 3.1, avg_rank_delta: 0.5, sentiment: 81, sentiment_delta: 3.0 }
    ],
    /* used_total wie in topcitations-dashboard: die Spalte "Used" gehoert zu dessen Zeile, und
       die ist seit dem 12.09. das Vorbild fuer "Trending Citations" hier. */
    top_domains: [
      { domain: "reddit.com", favicon: "", citation_type: "UGC_Community", share_pct: 6.8, share_delta_pct: 9.1, used_total: 1840 },
      { domain: "trustpilot.com", favicon: "", citation_type: "Brand_Platform", share_pct: 4.1, share_delta_pct: 5.2, used_total: 1120 },
      { domain: "handwerk.com", favicon: "", citation_type: "Editorial", share_pct: 7.3, share_delta_pct: 4.0, used_total: 1990 },
      { domain: "anfragenfluss.de", favicon: "", citation_type: "Competition", share_pct: 3.9, share_delta_pct: 3.4, used_total: 1060 },
      { domain: "ihk.de", favicon: "", citation_type: "Institutional", share_pct: 2.2, share_delta_pct: 1.8, used_total: 600 },
      { domain: "youtube.com", favicon: "", citation_type: "UGC_Community", share_pct: 21.0, share_delta_pct: -6.0, used_total: 5720 },
      { domain: "handwerk-digitalisieren.de", favicon: "", citation_type: "Brand_Platform", share_pct: 20.0, share_delta_pct: -13.0, used_total: 5450 }
    ],
    top_urls: [
      { url: "https://www.reddit.com/r/handwerk/leads", title: "Wie kommt ihr an Anfragen?", favicon: "", url_type: "forum", global_share_pct: 3.1, share_delta_pct: 6.2, used_total: 840 },
      { url: "https://www.trustpilot.com/review/anfragenfluss.de", title: "Anfragenfluss Bewertungen", favicon: "", url_type: "review", global_share_pct: 2.4, share_delta_pct: 3.0, used_total: 650 },
      { url: "https://www.handwerk.com/leadgenerierung", title: "Leadgenerierung im Handwerk", favicon: "", url_type: "article", global_share_pct: 2.2, share_delta_pct: 2.1, used_total: 600 },
      { url: "https://anfragenfluss.de/", title: "Anfragenfluss – Mehr Anfragen", favicon: "", url_type: "homepage", global_share_pct: 1.9, share_delta_pct: 1.4, used_total: 520 },
      { url: "https://www.ihk.de/digitalisierung", title: "Digitalisierung im Mittelstand", favicon: "", url_type: "article", global_share_pct: 1.2, share_delta_pct: 0.8, used_total: 330 }
    ],
    /* Derselbe Zeitraum wie in "Overview" (12.09. korrigiert: "die unteren Tabellen sind
       natuerlich auch 30 days, nicht 7 days"). */
    citations_label: "Last 30 days",
    /* Gesamtzahl der Domains bzw. URLs, die im Zeitraum zitiert haben -- NICHT die Laenge von
       top_domains/top_urls (die zeigen nur die "top" 7). Fuer die Kopfzeile der Tabelle
       ("32.5k citations · 7 days"). */
    totalCountDomain: 128, totalCountUrl: 32500
  };

  /* ---------- Die Chips ----------
     "Wichtige Daily-Use-Sachen, allgemeingueltig ... dahinter kleine, aber super effektive
     Prompts -- gleiche Logik wie bei den Kategorie-Karten." Also wie dort: der Prompt steht
     hier in beiden Sprachen, {TIMEFRAME} ersetzt Mira mit dem Zeitraum ihrer Report-Karten, und
     der Klick sendet sofort. {COMPETITOR} ist der staerkste Wettbewerber aus "Competitive field"
     -- der Chip heisst dann nach ihm, wie im Entwurf ("Compare me with Anfragenfluss").
     Zeichen: die Emoji des Entwurfs. Eigene Chips kann Bubble ueber renderPowerDashboard({ chips })
     setzen, dieselbe Form. */
  var CHIPS = {
    en: [
      { emoji: "📅", label: "Create a Daily Briefing",
        prompt: "Give me my daily AI visibility briefing: what changed since yesterday in visibility, ranking and sentiment, the three most important moves among my competitors, new or lost citations, and one concrete action for today. Short and scannable." },
      { emoji: "📉", label: "Show negative responses",
        prompt: "Show me the AI responses from {TIMEFRAME} that describe my brand negatively. Group them by theme, quote the critical passages with model and prompt, and tell me which ones matter most and why." },
      { emoji: "🏁", label: "Compare me with {COMPETITOR}", fallback: "Compare me with my top competitor",
        prompt: "Compare my brand with {COMPETITOR} for {TIMEFRAME}: visibility, average rank and sentiment side by side, the topics and prompts where they beat me and where I lead, and the sources that cite them but not me. End with three actions to close the gap." },
      { emoji: "🔗", label: "New citations this week",
        prompt: "Which sources and URLs started citing my brand or my competitors in the last 7 days? Highlight new domains, the ones that cite competitors but not me, and which of them I should target first." },
      { emoji: "📝", label: "Draft an AI visibility report",
        prompt: "Draft a presentation-ready AI visibility report for {TIMEFRAME}: executive summary, visibility and share of voice versus competitors, strongest and weakest topics, sentiment, the sources that matter, biggest win and biggest risk, and recommended next steps." }
    ],
    de: [
      { emoji: "📅", label: "Daily Briefing erstellen",
        prompt: "Gib mir mein tägliches Briefing zur KI-Sichtbarkeit: was sich seit gestern bei Sichtbarkeit, Ranking und Sentiment verändert hat, die drei wichtigsten Bewegungen meiner Wettbewerber, neue oder verlorene Zitierungen und eine konkrete Maßnahme für heute. Kurz und überfliegbar." },
      { emoji: "📉", label: "Negative Antworten zeigen",
        prompt: "Zeig mir die KI-Antworten aus {TIMEFRAME}, die meine Marke negativ darstellen. Gruppiere sie nach Thema, zitiere die kritischen Stellen mit Modell und Prompt und sag mir, welche am wichtigsten sind und warum." },
      { emoji: "🏁", label: "Mit {COMPETITOR} vergleichen", fallback: "Mit meinem stärksten Wettbewerber vergleichen",
        prompt: "Vergleiche meine Marke mit {COMPETITOR} für {TIMEFRAME}: Sichtbarkeit, durchschnittlicher Rang und Sentiment nebeneinander, die Themen und Prompts, bei denen sie vorne liegen und bei denen ich führe, und die Quellen, die sie zitieren, mich aber nicht. Schließe mit drei Maßnahmen, um den Abstand zu schließen." },
      { emoji: "🔗", label: "Neue Zitierungen diese Woche",
        prompt: "Welche Quellen und URLs zitieren seit den letzten 7 Tagen meine Marke oder meine Wettbewerber neu? Hebe neue Domains hervor, die, die Wettbewerber zitieren, mich aber nicht, und welche ich zuerst angehen sollte." },
      { emoji: "📝", label: "KI-Sichtbarkeitsreport entwerfen",
        prompt: "Entwirf einen präsentationsfertigen KI-Sichtbarkeitsreport für {TIMEFRAME}: Executive Summary, Sichtbarkeit und Share of Voice gegenüber Wettbewerbern, stärkste und schwächste Themen, Sentiment, die entscheidenden Quellen, größter Erfolg und größtes Risiko sowie empfohlene nächste Schritte." }
    ]
  };

  function upwRun(){
    UC = window.UpstreemCore;
    mount = UC.makeMount({
      onMount: function(m){ mount = m; },
      rootClass: "upw-root", notPortal: true,
      ctrlProp: "__upwController", resolveLocal: "__upwResolveLocal", queue: "__upwBootQueue",
      initRoot: initRoot,
      api: { renderPowerDashboard: doRender, setPowerDashboardLoading: doLoading },
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
  function isOn(attr){ var v = String(attr == null ? "" : attr).trim().toLowerCase();
    return !(v === "no" || v === "false" || v === "0" || v === "off"); }

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
    var TABS = { brands: 1, citations: 1, opportunities: 1 };
    function tabKey(){ return "upw_table__" + instanceId; }
    function readTab(){
      try { var v = window.localStorage.getItem(tabKey()); return TABS[v] ? v : "brands"; }
      catch(e){ return "brands"; }
    }
    function writeTab(v){ try { window.localStorage.setItem(tabKey(), v); } catch(e){} }
    function cmodeKey(){ return "upw_cmode__" + instanceId; }
    function readCmode(){
      try { return window.localStorage.getItem(cmodeKey()) === "url" ? "url" : "domain"; }
      catch(e){ return "domain"; }
    }
    function writeCmode(v){ try { window.localStorage.setItem(cmodeKey(), v); } catch(e){} }

    /* Demo: bis ein Setter kommt, stehen die Beispieldaten. Mit data-demo="no" steht stattdessen
       das Skelett, bis die echten Daten da sind -- das ist der Schalter fuer den Anschluss. */
    var demo = isOn(root.getAttribute("data-demo"));
    var state = {
      overview: demo ? DEMO.overview : null,
      brands: demo ? DEMO.brands : null,
      domains: demo ? DEMO.top_domains : null,
      urls: demo ? DEMO.top_urls : null,
      citesLabel: demo ? DEMO.citations_label : "",
      /* Die GESAMTZAHL, nicht die Laenge der obigen Arrays -- die zeigen nur die "top" 7, die
         Gesamtzahl kann groesser sein ("16 brands" auch wenn nur 7 Zeilen stehen). Fuer Brands
         gibt es dafuer schon overview.brand_count (dieselbe Zahl wie "#2 of 8 brands"); fuer
         Citations sind totalCountDomain/totalCountUrl NEU, wortgleich zu topcitations-dashboard,
         damit dieselbe RPC beide Komponenten fuellen kann. */
      totalCountDomain: demo ? DEMO.totalCountDomain : null,
      totalCountUrl: demo ? DEMO.totalCountUrl : null,
      chips: null,
      cmode: readCmode(),
      activeTable: readTab(),
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
          /* ---- Die eine Tabelle, umschaltbar (12.09. umgebaut) ----
             "Wir streichen, dass 2 nebeneinander dargestellt werden. Nur eine Tabelle auf full
             width." Ein Umschalter oben links waehlt Competitive field (Standard) oder Trending
             Citations; nur die aktive Tabelle steht im DOM sichtbar (is-off an der anderen).
             Rechts, in dieser Reihenfolge: die Anzahl+Zeitraum-Zeile, der Domains/URL-Umschalter
             (nur im Citations-Modus da) und ganz aussen ein Knopf, der -- je nach aktiver Tabelle
             -- die Brands- oder die Citations-Ansicht in Bubble oeffnet. */
          '<section class="upw-tcard">' +
            '<div class="up-head upw-head">' +
              /* is-lg ist die GROSSE Form des Umschalters aus core (32px hoch, 16px Polster je
                 Seite) -- genau die war gemeint ("exakt den grossen core switcher, nicht
                 nachbauen"), und sie steht dort schon fuer die Filter-Dropdowns und die
                 Granularitaet. Keine eigene Zeile Geometrie hier. */
              '<div class="up-seg is-lg upw-tabseg" role="tablist" aria-label="Table" data-upw-tabseg>' +
                '<button type="button" class="up-seg-btn" role="tab" data-upw-tab="brands" data-i18n="Competitive field">' + esc(t("Competitive field")) + '</button>' +
                '<button type="button" class="up-seg-btn" role="tab" data-upw-tab="citations" data-i18n="Trending Citations">' + esc(t("Trending Citations")) + '</button>' +
                '<button type="button" class="up-seg-btn" role="tab" data-upw-tab="opportunities" data-i18n="Opportunities">' + esc(t("Opportunities")) + '</button>' +
              '</div>' +
              '<div class="up-head-tools">' +
                '<span class="upw-tinfo" data-upw-tinfo></span>' +
                '<div class="up-seg upw-cmode" role="tablist" aria-label="Citations" data-upw-cmodewrap>' +
                  '<button type="button" class="up-seg-btn" role="tab" data-upw-cmode="domain" data-i18n="Domains">' + esc(t("Domains")) + '</button>' +
                  '<button type="button" class="up-seg-btn" role="tab" data-upw-cmode="url" data-i18n="URLs">' + esc(t("URLs")) + '</button>' +
                '</div>' +
                /* Der Platz, in den die Werkzeugleiste des GELIEHENEN Bretts einzieht (Sortierer,
                   Suche, Board/List, Brett-Einstellungen) -- sie kommt aus opportunities.js und
                   gehoert dort auch hin, siehe opportunitiesLauncherAttach. */
                '<span class="upw-uotools" data-upw-uotools></span>' +
                '<button type="button" class="up-iconbtn" data-upw-open>' + UC.icon("arrowUpRight", 2) + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="up-box" data-upw-tablebox><div class="up-table upw-table upw-t-brands" data-upw-brands></div>' +
              '<div class="up-table upw-table upw-t-cites" data-upw-cites></div></div>' +
            /* Der Platz des geliehenen Bretts. Bis es da ist (oder wenn es auf dieser Seite gar
               nicht eingebaut ist), steht hier der Hinweis darunter -- kein leeres Nichts. */
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
    var elTabseg = root.querySelector("[data-upw-tabseg]");
    var elTinfo = root.querySelector("[data-upw-tinfo]");
    var elCmodeWrap = root.querySelector("[data-upw-cmodewrap]");
    var elOpenBtn = root.querySelector("[data-upw-open]");
    var elTableBox = root.querySelector("[data-upw-tablebox]");
    var elBoard = root.querySelector("[data-upw-board]");
    var elUoTools = root.querySelector("[data-upw-uotools]");

    /* ---------- Chips ---------- */
    function staerksterWettbewerber(){
      var eigen = String(root.getAttribute("data-brand-name") || "").trim().toLowerCase();
      if (eigen === "brand_name") eigen = "";
      var beste = null;
      (state.brands || []).forEach(function(b){
        var name = String(b.name || "").trim();
        if (!name || b.is_own === true || String(b.is_own) === "yes" || b.role === "own") return;
        if (eigen && name.toLowerCase() === eigen) return;
        var v = num(b.visibility_pct);
        if (!beste || (v != null && (beste.v == null || v > beste.v))) beste = { name: name, v: v };
      });
      return beste ? beste.name : "";
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
        var label = String(c.label || "");
        if (braucht) label = wb ? label.replace("{COMPETITOR}", wb) : String(c.fallback || label.replace("{COMPETITOR}", ""));
        teile.push('<button type="button" class="up-btn-sec upw-chip" data-upw-chip="' + i + '">' +
          (c.emoji ? '<span class="upw-chip-emoji" aria-hidden="true">' + esc(c.emoji) + '</span>' : '') +
          '<span class="upw-chip-lbl">' + esc(label) + '</span></button>');
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
      var wb = staerksterWettbewerber() || (de() ? "meinem stärksten Wettbewerber" : "my strongest competitor");
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
      if (String(name) === VIEW && state.activeTable === "opportunities") brettPruefen();
    });
    if (UC.onDashboardMode) UC.onDashboardMode(function(mode){
      if (mode !== "power"){ zurueckgeben(); brettZurueckgeben(); }
      pruefen();
      if (mode === "power" && state.activeTable === "opportunities") brettPruefen();
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
    function renderChats(){
      var liste = (typeof window.askMiraRecentChats === "function") ? window.askMiraRecentChats(3) : [];
      if (liste.length) _chatsGeladen = true;
      if (!liste.length){
        /* Solange Mira ihre Liste noch nicht hat, ein Skelett in der Form der Zeilen -- "keine
           Chats" waere eine Aussage, die noch niemand gepruft hat. Nach 6s ohne Liste ist sie
           wahr (dieselbe Frist wie Miras eigene Chatleiste). */
        elChats.innerHTML = _chatsLeer
          ? '<div class="upw-chats-empty" data-i18n="No chats yet">' + esc(t("No chats yet")) + '</div>'
          : [0, 1, 2].map(function(i){ return '<div class="upw-chat is-sk"><span class="upw-sk upw-sk-ic"></span>' +
              '<span class="upw-sk upw-sk-title" style="width:' + [42, 30, 36][i] + '%"></span></div>'; }).join("");
        return;
      }
      elChats.innerHTML = liste.map(function(c){
        return '<button type="button" class="upw-chat" data-upw-chat="' + esc(c.id) + '">' +
          '<span class="upw-chat-ic" aria-hidden="true">' + UC.icon("messageCircle", 2) + '</span>' +
          '<span class="upw-chat-title">' + esc(c.title || t("Untitled chat")) + '</span>' +
          '<span class="upw-chat-when">' + esc(wann(c.time)) + '</span></button>';
      }).join("");
    }
    var _chatsLeer = false;
    setTimeout(function(){ if (!_chatsGeladen){ _chatsLeer = true; renderChats(); } }, 6000);
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
    var HASH = UC.HASH_ICON ? UC.HASH_ICON.replace("<svg ", '<svg class="up-hash" ') : "#";
    /* Mit dem Anfangsbuchstaben als Rueckfall (.up-logo-ltr) -- bei einer Marke ist er eine
       Aussage, und laedt das Bild nicht, nimmt der Favicon-Zuhoerer in core has-img ab und der
       Buchstabe steht da. */
    function logo(url, name){
      var ltr = '<span class="up-logo-ltr">' + esc(String(name || "?").trim().charAt(0) || "?") + '</span>';
      return url ? '<span class="up-logo-box has-img"><img src="' + esc(url) + '" alt="" referrerpolicy="no-referrer"/>' + ltr + '</span>'
                 : '<span class="up-logo-box">' + ltr + '</span>';
    }
    /* upw-th-rank/upw-th-sent markieren die zwei Spalten, die auf schmalem Platz verschwinden --
       Sentiment zuerst, dann Rank, dieselbe Reihenfolge und derselbe Griff (Klasse an Kopf UND
       Zelle) wie visibility-chart.js/.css (.vt-hide-sentiment/.vt-hide-rank). Sichtbar bleibt
       immer der Name: die Namensspalte traegt einen Mindestwert (minmax(120px,...), siehe CSS),
       genau wie dort.
       DIE SCHWELLEN sind die EIGENE Breite dieser Tabelle, nicht die der Seite -- die Karte kann
       neben ihrer Schwester stehen (breit) oder allein in einer Spalte (schmal, Telefon), und nur
       das zaehlt. 460px: darunter reicht der Platz nicht mehr fuer alle fuenf Spalten
       (40+120+130+66+72 = 428px plus Zellpolster). 380px: darunter reicht er nicht einmal mehr
       ohne Sentiment (40+120+130+66 = 356px plus Polster). Gemessen und bei Bedarf nachgezogen
       in _h_upw.html. */
    /* DER TREND FAELLT WEG, SOBALD ER NICHT MEHR IN SEINE ZELLE PASST -- wortgleich uebernommen
       aus visibility-chart.js (trendFitJetzt), inklusive der zwei Lehren, die dort im Kommentar
       stehen: erstens muss man die Trends zum Messen erst einblenden, sonst misst der Lauf das
       Ergebnis des vorigen und die Entscheidung kippt nie zurueck; zweitens wird SPALTENWEISE
       entschieden und nicht zeilenweise, sonst staenden in derselben Spalte mal Trends und mal
       keine, was sich als Fehler liest. 1px Toleranz gegen die Rundung der Prozentspuren.
       GEMESSEN, warum es das hier ueberhaupt braucht: bei 320px Fensterbreite ist die
       Visibility-Spur 91px breit, ihr Inhalt ("5.2%" plus Trend-Chip) braucht 119px. */
    var TREND_SPALTEN = ["vis", "rank", "sent"];
    function trendPasst(tabelle, spalten){
      if (!tabelle) return;
      spalten.forEach(function(k){ tabelle.classList.remove("upw-hide-trend-" + k); });
      var eng = {};
      spalten.forEach(function(k){
        var zellen = tabelle.querySelectorAll(".upw-td-" + k);
        for (var i = 0; i < zellen.length; i++){
          var c = zellen[i];
          if (!c.querySelector(".up-trend")) continue;
          if (getComputedStyle(c).display === "none") continue;
          if (c.scrollWidth > c.clientWidth + 1){ eng[k] = true; break; }
        }
      });
      spalten.forEach(function(k){ tabelle.classList.toggle("upw-hide-trend-" + k, !!eng[k]); });
    }
    function brandsResponsive(){
      var w = elBrands.clientWidth;
      if (!w) return;
      elBrands.classList.toggle("upw-hide-sent", w < 560);
      elBrands.classList.toggle("upw-hide-rank", w < 440);
      trendPasst(elBrands, TREND_SPALTEN);
    }
    /* Das Info-Zeichen der Spaltenkoepfe: .up-th-info aus core, das core selbst ueber
       ".up-th:hover .up-th-info" einblendet -- meine Koepfe SIND .up-th, also greift das ohne
       eigene Regel. Den Text holt UC.explainCopy aus dem einen Katalog in core, wortgleich zu
       brands-overview und visibility-chart: dieselbe Spalte soll nicht in drei Tabellen drei
       verschiedene Erklaerungen haben. */
    function infoIcon(key){
      return '<span class="up-th-info" data-explain="' + key + '" role="button" tabindex="0">' + UC.icon("info", 2) + '</span>';
    }
    var ROW_GOTO = UC.GOTO_SVG ? '<span class="up-row-goto">' + UC.GOTO_SVG + '</span>' : "";
    function brandsKopf(){
      return '<div class="up-thead">' +
        '<div class="up-th up-th-idx">' + (UC.HASH_ICON || "#") + '</div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Brand")) + '</span></div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Visibility")) + '</span>' + infoIcon("visibility") + '</div>' +
        '<div class="up-th upw-th-rank"><span class="up-th-txt">' + esc(t("Ranking")) + '</span>' + infoIcon("ranking") + '</div>' +
        '<div class="up-th upw-th-sent"><span class="up-th-txt">' + esc(t("Sentiment")) + '</span>' + infoIcon("sentiment") + '</div></div>';
    }
    function renderBrands(){
      var kopf = brandsKopf();
      if (state.fehler.brands){ elBrands.innerHTML = kopf + (UC.leseFehlerHtml ? UC.leseFehlerHtml("brands") : ""); return; }
      if (state.loading || !state.brands){
        elBrands.innerHTML = kopf + '<div class="up-tbody">' + UC.skeletonRows({ count: 7, rowClass: "up-row", cellClass: "up-td",
          cols: [{ w: 12, cls: "up-td-idx" }, { w: 90, jitter: 30, logo: true }, 60, { w: 36, cls: "upw-td-rank" }, { w: 40, cls: "upw-td-sent" }] }) + '</div>';
        brandsResponsive();
        return;
      }
      var rows = state.brands;
      if (!rows.length){ elBrands.innerHTML = kopf + '<div class="up-empty-mini" data-i18n="No data">' + esc(t("No data")) + '</div>'; brandsResponsive(); return; }
      elBrands.innerHTML = kopf + '<div class="up-tbody">' + rows.map(function(r, i){
        var pos = num(r.position) != null ? num(r.position) : i + 1;
        var v = num(r.visibility_pct), rk = num(r.avg_rank), s = num(r.sentiment);
        var vis = '<span class="up-num' + (v == null ? " is-empty" : "") + '">' + fmtPct1(v) + '</span>' +
          UC.trendChip(r.visibility_delta_pct, { decimals: true, suffix: "%" });
        /* Trend jetzt AUCH an Rang und Sentiment (12.09. angefordert), beide genau wie in der
           maximierten Tabelle des Visibility Charts: am Rang mit inverted, weil dort WENIGER
           besser ist, am Sentiment ohne -- und beide ohne Prozentzeichen, denn keiner der zwei
           Werte ist ein Prozentwert (CLAUDE.md 2b). */
        var rank = '<span class="up-rank-group">' + HASH + '<span class="up-num' + (rk == null ? " is-empty" : "") + '">' + fmtR(rk) + '</span></span>' +
          UC.trendChip(r.avg_rank_delta, { decimals: true, inverted: true });
        var sent = '<span class="up-sent"><span class="up-sent-dot" style="background:' + (s == null ? "#9E9E9E" : UC.sentColor(s)) + '"></span>' +
          '<span class="up-sent-val' + (s == null ? " is-empty" : "") + '">' + (s == null ? "–" : Math.round(s)) + '</span></span>' +
          UC.trendChip(r.sentiment_delta, { decimals: true });
        return '<div class="up-row' + (r.is_own === true || String(r.is_own) === "yes" ? " is-own" : "") + '" data-upw-row="brand" data-id="' + esc(String(r.company_id == null ? "" : r.company_id)) + '">' +
          '<div class="up-td up-td-idx">' + fmtI(pos) + '</div>' +
          '<div class="up-td upw-td-name">' + logo(r.logo_url || r.favicon_url, r.name) + '<span class="upw-name" title="' + esc(r.name == null ? "" : r.name) + '">' + esc(r.name == null ? "" : r.name) + '</span>' + ROW_GOTO + '</div>' +
          '<div class="up-td upw-td-vis">' + vis + '</div>' +
          '<div class="up-td upw-td-rank">' + rank + '</div>' +
          '<div class="up-td upw-td-sent">' + sent + '</div></div>';
      }).join("") + '</div>';
      brandsResponsive();
    }

    /* ---------- Trending Citations ----------
       Die Zeile von topcitations-dashboard, ohne Index und "Used": Domain bzw. URL mit Favicon,
       Typ, Anteil, Veraenderung. Der Typ-Chip ist .up-tag aus core in den Zitationstyp-Farben
       (wie domains-table), bei URLs in den URL-Typ-Farben mit Punkt (wie topcitations). */
    function typTag(roh, url){
      if (roh == null || roh === "") return "";
      var farbe, label = UC.typLabel ? UC.typLabel(roh, url ? "url" : "citation") : String(roh), punkt = false;
      if (url){
        var ut = (UC.URL_TYPE || {})[roh];
        farbe = ut ? (dunkel() ? ut.cDark : ut.c) : (dunkel() ? UC.OTHER_DARK : UC.OTHER_LIGHT);
        punkt = true;
      } else {
        farbe = (UC.CITE_COLOR || {})[UC.citeName ? UC.citeName(roh) : roh] || UC.OTHER_LIGHT;
      }
      var bg = dunkel() ? UC.CHIP_BG_DARK : (UC.tint ? UC.tint(farbe, 0.12) : "transparent");
      return '<span class="up-tag" style="color:' + farbe + ';background:' + bg + '">' +
        (punkt ? '<span class="up-tag-dot" style="background:' + farbe + '"></span>' : '') +
        '<span class="up-tag-lbl">' + esc(label) + '</span></span>';
    }
    /* KEINE eigene "Change"-Spalte mehr (12.09. angefordert: "warum ist Change ne eigene
       Spalte, das kommt in Share rein") -- der Trend steht jetzt IN der Share-Zelle, genau wie
       bei der Visibility-Spalte der Brands-Tabelle nebenan und wie ueberall sonst in der App
       (UC.trendChip direkt hinter dem up-num). upw-th-type/upw-td-type markieren die einzige
       Spalte, die auf schmalem Platz verschwindet -- dieselbe Reihenfolge wie in
       topcitations-dashboard.js/.css (dort zusaetzlich "Used", das es hier nicht gibt).
       Und jetzt MIT #-Spalte (12.09. angefordert: "immer die # columns anzeigen mit der
       Nummerierung") -- vorher hatte nur Competitive field eine.
       460px: darunter reicht der Platz nicht mehr fuer alle vier Spalten (40+120+148+130 = 438px
       plus Zellpolster) -- dieselbe eigene-Breite-Messung wie brandsResponsive() oben. */
    /* Reihenfolge des Ausblendens wie in topcitations-dashboard: erst "Used", dann "Type" --
       "Used" ist die Zahl, die am ehesten entbehrlich ist, "Type" traegt die Farbe und damit die
       schnellste Information der Zeile. Die Schwellen sind die EIGENE Breite dieser Tabelle. */
    function citesResponsive(){
      var w = elCites.clientWidth;
      if (!w) return;
      elCites.classList.toggle("upw-hide-used", w < 620);
      elCites.classList.toggle("upw-hide-type", w < 460);
      trendPasst(elCites, ["share"]);
    }
    function citesKopf(url){
      return '<div class="up-thead">' +
        '<div class="up-th up-th-idx">' + (UC.HASH_ICON || "#") + '</div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t(url ? "URL" : "Domain")) + '</span></div>' +
        '<div class="up-th upw-th-type"><span class="up-th-txt">' + esc(t("Type")) + '</span></div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Share")) + '</span>' + infoIcon("share") + '</div>' +
        '<div class="up-th upw-th-used"><span class="up-th-txt">' + esc(t("Used")) + '</span></div></div>';
    }
    function renderCites(){
      var url = state.cmode === "url";
      var kopf = citesKopf(url);
      var rows = url ? state.urls : state.domains;
      var fehler = url ? state.fehler.urls : state.fehler.domains;
      if (fehler){ elCites.innerHTML = kopf + (UC.leseFehlerHtml ? UC.leseFehlerHtml("citations") : ""); citesResponsive(); return; }
      if (state.loading || !rows){
        elCites.innerHTML = kopf + '<div class="up-tbody">' + UC.skeletonRows({ count: 7, rowClass: "up-row", cellClass: "up-td",
          cols: [{ w: 12, cls: "up-td-idx" }, { w: 110, jitter: 30, logo: true }, { w: 56, cls: "upw-td-type" }, 40,
                 { w: 36, cls: "upw-td-used" }] }) + '</div>';
        citesResponsive();
        return;
      }
      if (!rows.length){ elCites.innerHTML = kopf + '<div class="up-empty-mini" data-i18n="No data">' + esc(t("No data")) + '</div>'; citesResponsive(); return; }
      elCites.innerHTML = kopf + '<div class="up-tbody">' + rows.map(function(r, i){
        var name = url ? (r.title || r.url || "") : (r.domain || "");
        var id = url ? (r.url || r.title || "") : (r.domain || "");
        var fav = r.favicon || r.logo || "";
        var anteil = num(url ? (r.global_share_pct != null ? r.global_share_pct : r.share_pct) : r.share_pct);
        var share = '<span class="up-num' + (anteil == null ? " is-empty" : "") + '">' + fmtPct1(anteil) + '</span>' +
          UC.trendChip(r.share_delta_pct, { decimals: true, suffix: "%" });
        /* "Used" wie in topcitations-dashboard: die Gesamtzahl der Nennungen, kompakt (1.8k).
           Fehlt das Feld, bleibt die Zelle leer -- dort steht dann nichts, keine Null: niemand
           hat gezaehlt, und "0" waere eine Behauptung. */
        var used = num(r.used_total) != null
          ? '<span class="up-num">' + esc(UC.fmtTotal ? UC.fmtTotal(num(r.used_total)) : fmtI(num(r.used_total))) + '</span>' : "";
        return '<div class="up-row" data-upw-row="' + (url ? "url" : "domain") + '" data-id="' + esc(String(id)) + '">' +
          '<div class="up-td up-td-idx">' + fmtI(i + 1) + '</div>' +
          '<div class="up-td upw-td-name">' + (fav ? '<span class="up-logo-box up-fav has-img"><img src="' + esc(fav) + '" alt="" referrerpolicy="no-referrer"/></span>'
                                               : '<span class="up-logo-box up-fav"></span>') +
            '<span class="upw-name" title="' + esc(url && r.url ? r.url : name) + '">' + esc(name) + '</span>' + ROW_GOTO + '</div>' +
          '<div class="up-td upw-td-type">' + typTag(url ? r.url_type : r.citation_type, url) + '</div>' +
          '<div class="up-td upw-td-share">' + share + '</div>' +
          '<div class="up-td upw-td-used">' + used + '</div></div>';
      }).join("") + '</div>';
      citesResponsive();
    }

    /* ---------- EINE Tabelle statt zwei nebeneinander (12.09. umgebaut) ------------------------
       "Wir streichen, dass 2 nebeneinander dargestellt werden. Nur eine Tabelle auf full width."
       Der Umschalter oben links waehlt, welche der beiden im DOM stehenden Tabellen sichtbar ist
       (is-off an der anderen -- beide bleiben gerendert, ein Tabwechsel ist damit ohne neuen
       Datenabruf sofort da). Der Domains/URL-Umschalter daneben gilt nur im Citations-Modus, das
       Info-Zeichen rechts oeffnet je nach aktiver Tabelle die Brands- oder Citations-Ansicht in
       Bubble (dieselben zwei Ereignisse, die bis zum 12.09. am alten Maximieren-Knopf hingen). */
    /* ---------- Das geliehene Opportunities-Brett (12.09. angefordert) ----------
       Genau derselbe Griff wie bei Mira weiter oben, und aus demselben Grund: eine zweite
       .uo-root wuerde jede window.opportunities*-Funktion der echten ueberschreiben (der
       Launcher in opportunities.js erklaert es ausfuehrlich). Das Brett wandert also her,
       solange sein Reiter vorne steht, und geht zurueck, sobald ein anderer Reiter oder eine
       andere Ansicht dran ist. Seine Werkzeugleiste zieht dabei in elUoTools ein -- deshalb
       stehen Board/List, Sortierer, Suche und die Brett-Einstellungen hier oben rechts in
       DERSELBEN Zeile wie der Reiter-Umschalter, so wie verlangt. */
    function brettBereit(){
      return typeof window.opportunitiesLauncherAttach === "function";
    }
    function brettHier(){
      return !!(elBoard && elBoard.querySelector(".uo-root"));
    }
    function brettAusleihen(){
      if (!brettBereit() || !elBoard) return false;
      var ok = false;
      try { ok = window.opportunitiesLauncherAttach(elBoard, { view: VIEW, toolSlot: elUoTools }); } catch(e){}
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
          if (state.activeTable !== "opportunities") return;
          if (sichtbar()) brettAusleihen();
          root.classList.toggle("has-board", brettHier());
        }, ms));
      });
    }
    window.addEventListener("opportunities:bereit", function(){
      if (state.activeTable === "opportunities") brettPruefen();
    });

    function mitPunkt(a, b){ return a && b ? (a + " · " + b) : (a || b || ""); }
    function syncTinfo(){
      if (!elTinfo) return;
      var text;
      if (state.activeTable === "citations"){
        var n = state.cmode === "url" ? state.totalCountUrl : state.totalCountDomain;
        var nTxt = num(n) != null ? ((UC.fmtTotal ? UC.fmtTotal(n) : fmtI(n)) + " " + t("citations")) : "";
        text = mitPunkt(nTxt, state.citesLabel ? t(String(state.citesLabel)) : "");
      } else {
        var o = state.overview, bn = o ? num(o.brand_count) : null;
        var nTxt2 = bn != null ? (fmtI(bn) + " " + t("brands")) : "";
        text = mitPunkt(nTxt2, o && o.range_label ? t(String(o.range_label)) : "");
      }
      elTinfo.textContent = text;
    }
    /* GEMELDET (12.09.): "wenn man auf Citations wechselt, muss im Switcher auch Domain
       ausgewaehlt sein". War es nicht -- is-active wurde NUR im Klickzuhoerer gesetzt, also trug
       beim ersten Anzeigen KEINER der beiden Knoepfe die Markierung, obwohl state.cmode sehr wohl
       auf "domain" stand und die Tabelle auch Domains zeigte. Der Zustand war richtig, nur sein
       Abbild fehlte. Jetzt schreibt eine Funktion beides, und sie laeuft auch beim Aufbau. */
    function syncCmode(){
      if (!elCmodeWrap) return;
      Array.prototype.forEach.call(elCmodeWrap.querySelectorAll("[data-upw-cmode]"), function(b){
        var on = b.getAttribute("data-upw-cmode") === state.cmode;
        b.classList.toggle("is-active", on); b.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
    function syncActiveTable(){
      var tab = state.activeTable;
      var citations = tab === "citations", chancen = tab === "opportunities";
      syncCmode();
      if (elTabseg) Array.prototype.forEach.call(elTabseg.querySelectorAll("[data-upw-tab]"), function(b){
        var on = b.getAttribute("data-upw-tab") === tab;
        b.classList.toggle("is-active", on); b.setAttribute("aria-selected", on ? "true" : "false");
      });
      elBrands.classList.toggle("is-off", !(tab === "brands"));
      elCites.classList.toggle("is-off", !citations);
      /* Der Tabellenkasten ganz weg, wenn das Brett dran ist: es bringt seine eigene Flaeche mit
         (die Spalten des Kanbans), ein leerer Rahmen darueber waere eine Linie ohne Inhalt. */
      if (elTableBox) elTableBox.classList.toggle("is-off", chancen);
      if (elBoard) elBoard.classList.toggle("is-off", !chancen);
      if (elCmodeWrap) elCmodeWrap.classList.toggle("is-off", !citations);
      if (elTinfo) elTinfo.classList.toggle("is-off", chancen);
      if (elOpenBtn){
        var tip = t(chancen ? "Open opportunities" : citations ? "Open citations" : "Open brands");
        elOpenBtn.setAttribute("data-tip", tip);
        elOpenBtn.setAttribute("aria-label", tip);
      }
      /* Das Brett wird nur geliehen, solange sein Reiter vorne steht -- sonst haelt das Dashboard
         es fest, waehrend nebenan die Opportunities-Ansicht leer dasteht. */
      if (chancen) brettPruefen(); else brettZurueckgeben();
      /* Die gerade sichtbar gewordene Tabelle stand womoeglich als is-off bei 0 Breite und hat
         darum ihre Spalten-Ausblendung nie nachgezogen (clientWidth eines display:none-Elements
         ist 0, brandsResponsive/citesResponsive brechen dort sofort ab) -- hier nachgeholt. */
      if (citations) citesResponsive(); else if (!chancen) brandsResponsive();
      syncTinfo();
    }
    if (elTabseg) elTabseg.addEventListener("click", function(e){
      var b = e.target.closest("[data-upw-tab]");
      if (!b) return;
      var roh = b.getAttribute("data-upw-tab");
      var v = TABS[roh] ? roh : "brands";
      if (v === state.activeTable) return;
      state.activeTable = v;
      writeTab(v);
      syncActiveTable();
    });
    if (elCmodeWrap) elCmodeWrap.addEventListener("click", function(e){
      var b = e.target.closest("[data-upw-cmode]");
      if (!b) return;
      state.cmode = b.getAttribute("data-upw-cmode") === "url" ? "url" : "domain";
      writeCmode(state.cmode);
      syncCmode();
      renderCites();
      syncTinfo();
    });
    if (elOpenBtn) elOpenBtn.addEventListener("click", function(){
      if (state.activeTable === "opportunities") fire("data-opportunities-fn", "upwOpportunities", {});
      else if (state.activeTable === "citations") fire("data-citations-fn", "upwCitations", { mode: state.cmode === "url" ? "urls" : "domains" });
      else fire("data-brands-fn", "upwBrands", {});
    });
    root.addEventListener("click", function(e){
      var row = e.target.closest("[data-upw-row]");
      if (row && !row.classList.contains("up-tsk")){
        fire("data-rowclick-fn", "upwRowClick", { type: row.getAttribute("data-upw-row"), id: row.getAttribute("data-id") || "" });
      }
    });

    function renderAll(){ renderChips(); renderChats(); renderKpis(); renderBrands(); renderCites(); syncTinfo(); }

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
    if (UC.makeExplain && UC.explainCopy){
      var TREND_SATZ = ", plus the change against the previous period";
      /* Die kleine Vorschau ueber dem Text -- WORTGLEICH die aus brands-overview.js, samt deren
         Klassen aus core (.up-explain-row/.up-explain-up). Sie hat hier zuerst GEFEHLT, und das
         war der ganze Unterschied: die Karte zeigte nur Ueberschrift und Satz, waehrend sie in
         jeder anderen Tabelle der App mit einem Beispiel der Zelle aufmacht. brands-overview und
         nicht visibility-chart als Quelle, weil dort die core-Klassen stehen und nicht eigene
         (vot-explain-*) -- damit braucht diese Datei keine einzige eigene Regel dafuer. */
      function explainVisual(kind){
        /* Das ROHE Zeichen, nicht das mit .up-hash aus der Rang-Zelle: die Karte liegt am <body>
           und wird von .up-explain-row svg bemasst, eine mitgeschleppte Zellklasse brauchte dort
           niemand. */
        if (kind === "ranking") return '<span class="up-explain-row">' + (UC.HASH_ICON || "#") + '<span>2.3</span></span>';
        if (kind === "sentiment"){
          return '<span class="up-explain-row">78' +
            '<span class="up-explain-up">' + UC.TREND_UP + '</span><span class="up-explain-up">4</span></span>';
        }
        return '<span class="up-explain-row">18.4%' +
               '<span class="up-explain-up">' + UC.TREND_UP + '</span>' +
               '<span class="up-explain-up">2.9%</span></span>';
      }
      UC.makeExplain({
        root: root, triggerSel: ".up-th-info", getIsDark: dunkel,
        html: function(kind){
          var info;
          if (kind === "visibility") info = UC.explainCopy("visibility", { scope: " for the tracked prompts", trend: TREND_SATZ });
          else if (kind === "ranking"){ var r = UC.explainCopy("rank", { scope: "", trend: TREND_SATZ }); info = r ? { h: "Ranking", t: r.t } : null; }
          else if (kind === "sentiment") info = UC.explainCopy("sentiment", { scope: "", trend: TREND_SATZ });
          else if (kind === "share") info = UC.explainCopy("share", { subject: state.cmode === "url" ? "URL" : "domain" });
          if (!info) return "";
          return '<div class="up-explain-vis">' + explainVisual(kind) + '</div>' +
                 '<div class="up-explain-h">' + esc(info.h) + '</div>' +
                 '<div class="up-explain-t">' + esc(info.t) + '</div>';
        }
      });
    }
    /* Die zwei Tabellen messen sich SELBST nach: eine Aenderung ihrer EIGENEN Breite -- Fenster-
       resize oder is-narrow-Umschalten -- loest brandsResponsive()/citesResponsive() neu aus,
       ohne dass irgendwer explizit daran denken muss (syncActiveTable() holt das zusaetzlich
       nach, wenn ein Tabwechsel eine Tabelle von 0 Breite -- is-off -- auf sichtbar bringt, denn
       ein ResizeObserver an einem display:none-Element misst dort nichts). EINMAL angemeldet,
       nicht bei jedem render*() -- sonst haeufen sich Beobachter bei jedem Neuzeichnen an.
       UC.beobachteGroesse ist der geteilte, gedrosselte ResizeObserver aus core (siehe
       topcitations-dashboard.js fuer denselben Griff). */
    if (UC.beobachteGroesse){
      UC.beobachteGroesse(elBrands, brandsResponsive);
      UC.beobachteGroesse(elCites, citesResponsive);
    }

    /* Der persistierte Zustand (Tabelle, Domains/URL) muss auf das statische Anfangsmarkup
       nachgezogen werden -- es traegt noch keine is-active/is-off-Klassen. */
    syncActiveTable();
    renderAll();
    pruefen();

    return {
      update: function(p){
        var r;
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
        if (p.brands != null){ r = liste(p.brands); state.fehler.brands = r.kaputt; state.brands = r.wert || []; }
        if (p.top_domains != null){ r = liste(p.top_domains); state.fehler.domains = r.kaputt; state.domains = r.wert || []; }
        if (p.top_urls != null){ r = liste(p.top_urls); state.fehler.urls = r.kaputt; state.urls = r.wert || []; }
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
        state.loading = UC.isYes(on);
        if (state.loading) state.fehler = {};
        renderAll();
      }
    };
  }

  upwBoot(50);
})();
