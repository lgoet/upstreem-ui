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
    /* GENAU die Felder, die renderKpis() liest -- nicht mehr. Die Verlaufsreihen, der
       Spitzenreiter und die vier Zaehler der zweiten Fusszeilen-Haelfte sind am 13.09.
       mitgegangen, als ihre Anzeigen gestrichen wurden. Beispieldaten, die mehr zeigen als die
       Komponente liest, sind eine Einladung, den RPC groesser zu bauen als noetig. */
    overview: {
      range_label: "Last 30 days",
      visibility_pct: 3.0, visibility_delta_pct: 1.0,
      visibility_position: 2, brand_count: 8,
      avg_rank: 3.3, avg_rank_delta: -0.9, best_rank: 2.6,
      sentiment: 76, sentiment_delta: 1.6, field_avg_sentiment: 74
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
     -- der Chip heisst dann nach ihm, wie im Entwurf ("Compare me with Anfragenfluss"). Das ist
     der Spitzenreiter, und ist man selbst der Spitzenreiter, der Zweite: staerksterWettbewerber()
     ueberspringt die eigene Marke.
     DREI CHIPS, EINE REIHE (13.09. auf drei gekuerzt): Daily Briefing, der Vergleich und die
     neuen Zitierungen. "Negative Antworten zeigen" und der Report-Entwurf sind raus -- fuenf
     Chips brauchten zwei Reihen, und die zwei sind die, die man am ehesten in Mira selbst tippt.
     Zeichen: die Emoji des Entwurfs. Eigene Chips kann Bubble ueber renderPowerDashboard({ chips })
     setzen, dieselbe Form. */
  var CHIPS = {
    en: [
      { emoji: "📅", label: "Create a Daily Briefing",
        prompt: "Give me my daily AI visibility briefing: what changed since yesterday in visibility, ranking and sentiment, the three most important moves among my competitors, new or lost citations, and one concrete action for today. Short and scannable." },
      { emoji: "🏁", label: "Compare me with {COMPETITOR}", fallback: "Compare me with my top competitor",
        prompt: "Compare my brand with {COMPETITOR} for {TIMEFRAME}: visibility, average rank and sentiment side by side, the topics and prompts where they beat me and where I lead, and the sources that cite them but not me. End with three actions to close the gap." },
      { emoji: "🔗", label: "New citations this week",
        prompt: "Which sources and URLs started citing my brand or my competitors in the last 7 days? Highlight new domains, the ones that cite competitors but not me, and which of them I should target first." }
    ],
    de: [
      { emoji: "📅", label: "Daily Briefing erstellen",
        prompt: "Gib mir mein tägliches Briefing zur KI-Sichtbarkeit: was sich seit gestern bei Sichtbarkeit, Ranking und Sentiment verändert hat, die drei wichtigsten Bewegungen meiner Wettbewerber, neue oder verlorene Zitierungen und eine konkrete Maßnahme für heute. Kurz und überfliegbar." },
      { emoji: "🏁", label: "Mit {COMPETITOR} vergleichen", fallback: "Mit meinem stärksten Wettbewerber vergleichen",
        prompt: "Vergleiche meine Marke mit {COMPETITOR} für {TIMEFRAME}: Sichtbarkeit, durchschnittlicher Rang und Sentiment nebeneinander, die Themen und Prompts, bei denen sie vorne liegen und bei denen ich führe, und die Quellen, die sie zitieren, mich aber nicht. Schließe mit drei Maßnahmen, um den Abstand zu schließen." },
      { emoji: "🔗", label: "Neue Zitierungen diese Woche",
        prompt: "Welche Quellen und URLs zitieren seit den letzten 7 Tagen meine Marke oder meine Wettbewerber neu? Hebe neue Domains hervor, die, die Wettbewerber zitieren, mich aber nicht, und welche ich zuerst angehen sollte." }
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

    /* Demo: bis ein Setter kommt, stehen die Beispieldaten. Mit data-demo="no" steht stattdessen
       das Skelett, bis die echten Daten da sind -- das ist der Schalter fuer den Anschluss. */
    var demo = isOn(root.getAttribute("data-demo"));
    var state = {
      overview: demo ? DEMO.overview : null,
      brands: demo ? DEMO.brands : null,
      domains: demo ? DEMO.top_domains : null,
      urls: demo ? DEMO.top_urls : null,
      /* citesLabel/range_label werden seit dem 14.09. NICHT mehr angezeigt: die Kopfzeile, die
         "8 brands · Last 30 days" trug, ist mit der grossen Tabelle weggefallen, und neben
         "Overview" stand der Zeitraum schon vorher nicht mehr. Der Zustand bleibt trotzdem
         stehen -- Bubble schickt das Feld weiter, und ein Setter, der einen Wert stillschweigend
         verwirft, ist schwerer zu erklaeren als einer, der ihn aufhebt. Wer ihn wieder zeigen
         will, hat ihn hier. */
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
          '<div class="upw-modeseg" role="tablist" aria-label="Section" data-upw-modeseg>' +
            '<button type="button" class="upw-modebtn" role="tab" data-upw-mode="metrics" data-i18n="Main Metrics">' + esc(t("Main Metrics")) + '</button>' +
            '<button type="button" class="upw-modebtn" role="tab" data-upw-mode="opportunities" data-i18n="Opportunities">' + esc(t("Opportunities")) + '</button>' +
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
      if (String(name) === VIEW && state.mode === "opportunities") brettPruefen();
    });
    if (UC.onDashboardMode) UC.onDashboardMode(function(mode){
      if (mode !== "power"){ zurueckgeben(); brettZurueckgeben(); }
      pruefen();
      if (mode === "power" && state.mode === "opportunities") brettPruefen();
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
    function listenSkelett(n){
      var out = "";
      for (var i = 0; i < n; i++){
        out += '<div class="upw-li is-sk"><span class="upw-sk upw-sk-idx"></span>' +
          '<span class="upw-sk upw-sk-ava"></span>' +
          '<span class="upw-sk upw-sk-title" style="width:' + [46, 34, 40, 30, 38][i % 5] + '%"></span>' +
          '<span class="upw-sk upw-sk-val"></span></div>';
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
    function datenBedarfMelden(){
      var needs = state.mode === "opportunities"
        ? ["opportunities"]
        : ["brands", state.cmode === "url" ? "citations_url" : "citations_domain"];
      fire("data-needs-fn", "upwNeeds", { mode: state.mode, needs: needs });
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
    if (elAllBrands) elAllBrands.addEventListener("click", function(){
      fire("data-brands-fn", "upwBrands", {});
    });
    if (elAllCites) elAllCites.addEventListener("click", function(){
      fire("data-citations-fn", "upwCitations", { mode: state.cmode === "url" ? "urls" : "domains" });
    });
    root.addEventListener("click", function(e){
      var row = e.target.closest("[data-upw-row]");
      if (row && !row.classList.contains("up-tsk")){
        fire("data-rowclick-fn", "upwRowClick", { type: row.getAttribute("data-upw-row"), id: row.getAttribute("data-id") || "" });
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
       und der steht erst nach syncMode() fest. */
    datenBedarfMelden();

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
        /* EIN ABSCHNITT IST GESCHEITERT, die anderen nicht (14.09.). Der RPC liefert dafuer einen
           errors-Block, und ohne diese Zeilen haette der Aufrufer nur zwei schlechte Moeglich-
           keiten: den Abschnitt weglassen (dann steht das Skelett endlos) oder eine leere Liste
           schicken (dann behauptet die Oberflaeche "No data", wo in Wahrheit die Abfrage
           gescheitert ist). Beides ist ein stiller Ausfall.
           Die Schluessel sind die Abschnittsnamen aus der Datenspezifikation, damit RPC und
           Nutzlast dieselbe Sprache sprechen -- und nicht die internen Zustandsnamen. */
        if (p.errors && typeof p.errors === "object"){
          var ABSCHNITT = { overview: "overview", brands: "brands",
                            citations_domain: "domains", citations_url: "urls" };
          for (var eKey in ABSCHNITT){
            if (!Object.prototype.hasOwnProperty.call(p.errors, eKey)) continue;
            if (!p.errors[eKey]) continue;                 /* null/leer heisst "kein Fehler" */
            state.fehler[ABSCHNITT[eKey]] = true;
            state.loading = false;
          }
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
