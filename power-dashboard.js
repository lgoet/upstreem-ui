/* upstreem power-dashboard.js — die zweite Ansicht des Dashboards (11.09. angefordert).
   Requires core.js (window.UpstreemCore) loaded first.

   "Kompakter, Mira im Vordergrund, nur minimal Daten." Von oben nach unten:
     1. Miras Eingabefeld -- DAS ECHTE, ausgeliehen (siehe "Mira" unten und LAUNCHER in
        ask-mira.js). Ausdruecklich verlangt: "du sollst nicht das Mira-Inputfeld neu bauen".
     2. Chips mit hinterlegten Prompts. Klick = neuer Chat in Mira, der Prompt geht sofort ab.
     3. Recent chats -- die letzten drei aus Miras eigener Liste. Klick = dieser Chat in Mira.
     4. Overview -- drei Kennzahlen mit Verlauf. Das EINZIGE Bauteil hier, das es vorher nicht
        gab ("bis auf die Overview-KPI-Bar 100% Core-Sachen").
     5. Competitive field und Trending Citations -- aus dem Tabellenbaukasten von core
        (.up-box, .up-table, .up-thead, .up-row, .up-sent, .up-rank-group, .up-tag,
        UC.trendChip), wortgleich so, wie brands-overview und topcitations-dashboard ihn benutzen.
   Auf dem Dashboard selbst passiert nichts mit Mira-Antworten: jeder Einstieg wechselt in Miras
   Ansicht, und die Antwort kommt dort.

   DATEN: bis ein Setter kommt, stehen Beispieldaten da (data-demo, siehe die Vorlage) -- so
   verlangt ("erstmal Dummy-Daten"). Die Felder sind DIESELBEN, die brands-overview und
   topcitations-dashboard lesen, damit dieselben RPCs beide fuellen koennen.

   API (alle mit Stub-Warteschlange, Bubble ruft sie regelmaessig vor dem Laden dieser Datei):
     renderPowerDashboard({ instanceId, overview, brands, top_domains, top_urls,
                            citations_label, chips })     jeder Schluessel einzeln moeglich
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
    brands: [
      { company_id: "d1", position: 1, name: "Anfragenfluss", logo_url: "", visibility_pct: 5.2, visibility_delta_pct: 4.0, avg_rank: 2.6, sentiment: 75 },
      { company_id: "d2", position: 2, name: "LeeUp Media", logo_url: "", visibility_pct: 3.0, visibility_delta_pct: 1.0, avg_rank: 3.3, sentiment: 76, is_own: true },
      { company_id: "d3", position: 3, name: "Candidate Flow", logo_url: "", visibility_pct: 2.1, visibility_delta_pct: -1.0, avg_rank: 3.5, sentiment: 71 },
      { company_id: "d4", position: 4, name: "Andreas May", logo_url: "", visibility_pct: 1.2, visibility_delta_pct: 0, avg_rank: 3.2, sentiment: 74 },
      { company_id: "d5", position: 5, name: "Leadmagneten", logo_url: "", visibility_pct: 0.6, visibility_delta_pct: 0, avg_rank: 3.7, sentiment: 71 },
      { company_id: "d6", position: 6, name: "A&M Beratung", logo_url: "", visibility_pct: 0.4, visibility_delta_pct: 0, avg_rank: 4.0, sentiment: 72 },
      { company_id: "d7", position: 7, name: "Matthias Niehaus", logo_url: "", visibility_pct: 0.3, visibility_delta_pct: 0, avg_rank: 3.1, sentiment: 81 }
    ],
    top_domains: [
      { domain: "reddit.com", favicon: "", citation_type: "UGC_Community", share_pct: 6.8, share_delta_pct: 9.1 },
      { domain: "trustpilot.com", favicon: "", citation_type: "Brand_Platform", share_pct: 4.1, share_delta_pct: 5.2 },
      { domain: "handwerk.com", favicon: "", citation_type: "Editorial", share_pct: 7.3, share_delta_pct: 4.0 },
      { domain: "anfragenfluss.de", favicon: "", citation_type: "Competition", share_pct: 3.9, share_delta_pct: 3.4 },
      { domain: "ihk.de", favicon: "", citation_type: "Institutional", share_pct: 2.2, share_delta_pct: 1.8 },
      { domain: "youtube.com", favicon: "", citation_type: "UGC_Community", share_pct: 21.0, share_delta_pct: -6.0 },
      { domain: "handwerk-digitalisieren.de", favicon: "", citation_type: "Brand_Platform", share_pct: 20.0, share_delta_pct: -13.0 }
    ],
    top_urls: [
      { url: "https://www.reddit.com/r/handwerk/leads", title: "Wie kommt ihr an Anfragen?", favicon: "", url_type: "forum", global_share_pct: 3.1, share_delta_pct: 6.2 },
      { url: "https://www.trustpilot.com/review/anfragenfluss.de", title: "Anfragenfluss Bewertungen", favicon: "", url_type: "review", global_share_pct: 2.4, share_delta_pct: 3.0 },
      { url: "https://www.handwerk.com/leadgenerierung", title: "Leadgenerierung im Handwerk", favicon: "", url_type: "article", global_share_pct: 2.2, share_delta_pct: 2.1 },
      { url: "https://anfragenfluss.de/", title: "Anfragenfluss – Mehr Anfragen", favicon: "", url_type: "homepage", global_share_pct: 1.9, share_delta_pct: 1.4 },
      { url: "https://www.ihk.de/digitalisierung", title: "Digitalisierung im Mittelstand", favicon: "", url_type: "article", global_share_pct: 1.2, share_delta_pct: 0.8 }
    ],
    citations_label: "7 days"
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
  /* Eine Reihe fuer den Verlauf: Array oder "1.2, 1.4, 1.9". */
  function reihe(v){
    if (v == null || v === "") return [];
    var a = Array.isArray(v) ? v : String(v).replace(/^\s*\[|\]\s*$/g, "").split(/[,;]\s*|\s+/);
    return a.map(num).filter(function(n){ return n != null; });
  }
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

    /* Demo: bis ein Setter kommt, stehen die Beispieldaten. Mit data-demo="no" steht stattdessen
       das Skelett, bis die echten Daten da sind -- das ist der Schalter fuer den Anschluss. */
    var demo = isOn(root.getAttribute("data-demo"));
    var state = {
      overview: demo ? DEMO.overview : null,
      brands: demo ? DEMO.brands : null,
      domains: demo ? DEMO.top_domains : null,
      urls: demo ? DEMO.top_urls : null,
      citesLabel: demo ? DEMO.citations_label : "",
      chips: null,
      cmode: "domain",
      loading: false,
      fehler: {}
    };

    /* ---------- Markup ----------
       Die Komponente baut ihr Markup selbst; in Bubble steht nur die leere Wurzel. Dieselbe
       Entscheidung wie in drawer-topbar: ein von Hand eingefuegter Aufbau waere eine Kopie, die
       beim naechsten Pin nicht mitwandert. */
    function kopf(label, zaehler, werkzeuge){
      return '<div class="up-head upw-head">' +
        '<div class="up-heading has-count"><span class="up-head-label" data-i18n="' + esc(label) + '">' + esc(t(label)) + '</span>' +
          '<span class="up-head-sep"></span><span class="up-head-count" data-upw-count="' + zaehler + '"></span></div>' +
        '<div class="up-head-tools">' + werkzeuge + '</div></div>';
    }
    function expandBtn(was, tip){
      return '<button type="button" class="up-iconbtn upw-expand" data-upw-expand="' + was + '" ' +
        'data-tip="' + esc(t(tip)) + '" aria-label="' + esc(t(tip)) + '">' + UC.icon("maximize2", 2) + '</button>';
    }
    root.innerHTML =
      '<div class="upw-col">' +
        /* Miras Platz. Bis sie da ist, steht ihr Umriss als Skelett -- sonst spraenge alles
           darunter um die Hoehe des Feldes, sobald sie ankommt. */
        '<div class="upw-mira" data-upw-mira><div class="upw-mira-sk" aria-hidden="true">' +
          '<span class="upw-sk upw-sk-line"></span><span class="upw-mira-sk-row">' +
          '<span class="upw-sk upw-sk-dot"></span><span class="upw-sk upw-sk-send"></span></span></div></div>' +
        '<div class="upw-chips" data-upw-chips></div>' +
        '<section class="upw-sec">' +
          '<div class="upw-sec-head"><span class="upw-sec-h" data-i18n="Recent chats">' + esc(t("Recent chats")) + '</span>' +
            '<button type="button" class="upw-link" data-upw-allchats><span data-i18n="All chats">' + esc(t("All chats")) + '</span>' +
            UC.icon("chevronRight", 2) + '</button></div>' +
          '<div class="upw-chatlist" data-upw-chatlist></div>' +
        '</section>' +
        '<section class="upw-sec">' +
          '<div class="upw-sec-head"><span class="upw-sec-h" data-i18n="Overview">' + esc(t("Overview")) + '</span>' +
            '<span class="upw-range">' + UC.icon("calendar", 2) + '<span data-upw-range></span></span></div>' +
          '<div class="up-box upw-kpis" data-upw-kpis></div>' +
        '</section>' +
        '<div class="upw-tables">' +
          '<section class="upw-tcard">' +
            kopf("Competitive field", "brands", expandBtn("brands", "Open brands")) +
            '<div class="up-box"><div class="up-table upw-table upw-t-brands" data-upw-brands></div></div>' +
          '</section>' +
          '<section class="upw-tcard">' +
            kopf("Trending Citations", "cites",
              '<div class="up-seg upw-cmode" role="tablist" aria-label="Citations">' +
                '<button type="button" class="up-seg-btn is-active" role="tab" aria-selected="true" data-upw-cmode="domain" data-i18n="Domains">' + esc(t("Domains")) + '</button>' +
                '<button type="button" class="up-seg-btn" role="tab" aria-selected="false" data-upw-cmode="url" data-i18n="URLs">' + esc(t("URLs")) + '</button>' +
              '</div>' + expandBtn("citations", "Open citations")) +
            '<div class="up-box"><div class="up-table upw-table upw-t-cites" data-upw-cites></div></div>' +
          '</section>' +
        '</div>' +
      '</div>';

    var elSlot = root.querySelector("[data-upw-mira]");
    var elChips = root.querySelector("[data-upw-chips]");
    var elChats = root.querySelector("[data-upw-chatlist]");
    var elKpis = root.querySelector("[data-upw-kpis]");
    var elRange = root.querySelector("[data-upw-range]");
    var elBrands = root.querySelector("[data-upw-brands]");
    var elCites = root.querySelector("[data-upw-cites]");
    var elCntBrands = root.querySelector('[data-upw-count="brands"]');
    var elCntCites = root.querySelector('[data-upw-count="cites"]');

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
      elChips.innerHTML = chipListe().map(function(c, i){
        var braucht = /\{COMPETITOR\}/.test(String(c.label || "") + String(c.prompt || ""));
        var label = String(c.label || "");
        if (braucht) label = wb ? label.replace("{COMPETITOR}", wb) : String(c.fallback || label.replace("{COMPETITOR}", ""));
        return '<button type="button" class="up-btn-sec upw-chip" data-upw-chip="' + i + '">' +
          (c.emoji ? '<span class="upw-chip-emoji" aria-hidden="true">' + esc(c.emoji) + '</span>' : '') +
          '<span class="upw-chip-lbl">' + esc(label) + '</span></button>';
      }).join("");
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
    });
    if (UC.onDashboardMode) UC.onDashboardMode(function(mode){
      if (mode !== "power") zurueckgeben();
      pruefen();
    });
    window.addEventListener("askmira:bereit", pruefen);
    function zuMira(o){
      if (typeof window.askMiraOpen === "function") { window.askMiraOpen(o || {}); return; }
      if (window.console) console.warn("[power-dashboard] Mira ist auf dieser Seite nicht geladen -- " +
        "askMiraOpen fehlt.");
    }

    /* ---------- Recent chats ---------- */
    function wann(ms){
      if (ms == null) return "";
      var d = new Date(ms), jetzt = new Date();
      var tag = function(x){ return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
      var diff = Math.round((tag(jetzt) - tag(d)) / 86400000);
      if (diff === 0) return t("Today");
      if (diff === 1) return t("Yesterday");
      return UC.fmtDate ? UC.fmtDate(d.toISOString()) : d.toLocaleDateString();
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
          '<span class="upw-chat-ic">' + UC.icon("messageSquare", 2) + '</span>' +
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
    function spark(werte){
      if (!werte || werte.length < 2) return '<span class="upw-spark is-leer"></span>';
      var W = 96, H = 28, P = 3;
      var min = Math.min.apply(null, werte), max = Math.max.apply(null, werte);
      var span = (max - min) || 1;
      var pts = werte.map(function(v, i){
        return [P + i * (W - 2 * P) / (werte.length - 1), P + (1 - (v - min) / span) * (H - 2 * P)];
      });
      var d = pts.map(function(p, i){ return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
      var e = pts[pts.length - 1];
      return '<svg class="upw-spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' +
        '<path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<circle cx="' + e[0].toFixed(1) + '" cy="' + e[1].toFixed(1) + '" r="3" class="upw-spark-end"/></svg>';
    }
    function kpiKarte(label, wertHtml, trendHtml, reiheWerte, fussStark, fussLeise){
      return '<div class="upw-kpi">' +
        '<div class="upw-kpi-top"><div class="upw-kpi-main">' +
          '<span class="upw-kpi-label" data-i18n="' + esc(label) + '">' + esc(t(label)) + '</span>' +
          '<span class="upw-kpi-row"><span class="upw-kpi-val">' + wertHtml + '</span>' +
          '<span class="upw-kpi-trend">' + trendHtml + '</span></span></div>' + spark(reiheWerte) + '</div>' +
        '<div class="upw-kpi-foot">' + (fussStark ? '<span class="upw-kpi-strong">' + esc(fussStark) + '</span>' : '') +
          (fussStark && fussLeise ? '<span class="upw-dot" aria-hidden="true"></span>' : '') +
          (fussLeise ? '<span class="upw-kpi-soft">' + esc(fussLeise) + '</span>' : '') + '</div>' +
      '</div>';
    }
    function fmtPct1(v){ return v == null ? "–" : (UC.fmtPct ? UC.fmtPct(v, 1) : v.toFixed(1) + "%"); }
    function fmtR(v){ return v == null ? "–" : (UC.fmt1 ? UC.fmt1(v) : v.toFixed(1)); }
    function fmtI(v){ return v == null ? "–" : (UC.fmtInt ? UC.fmtInt(v) : String(Math.round(v))); }
    function ersetze(s, o){ return String(s).replace(/\{(\w+)\}/g, function(_, k){ return o[k] != null ? o[k] : ""; }); }
    function renderKpis(){
      if (state.loading || !state.overview){ elKpis.innerHTML = kpiSkelett(); elRange.textContent = ""; return; }
      if (state.fehler.overview){ elKpis.innerHTML = UC.leseFehlerHtml ? UC.leseFehlerHtml("overview") : ""; return; }
      var o = state.overview;
      elRange.textContent = o.range_label ? t(String(o.range_label)) : "";
      var vis = num(o.visibility_pct), rank = num(o.avg_rank), sent = num(o.sentiment);
      /* Position und Spitzenreiter: aus dem Payload -- und wenn er sie nicht traegt, aus
         "Competitive field" darunter, das dieselbe Frage beantwortet. */
      var pos = num(o.visibility_position), anzahl = num(o.brand_count);
      var leader = o.leader_name, leaderV = num(o.leader_visibility_pct);
      if ((pos == null || anzahl == null || !leader) && state.brands && state.brands.length){
        var sortiert = state.brands.slice().sort(function(a, b){ return (num(b.visibility_pct) || 0) - (num(a.visibility_pct) || 0); });
        if (anzahl == null) anzahl = sortiert.length;
        if (!leader){ leader = sortiert[0].name; leaderV = num(sortiert[0].visibility_pct); }
        if (pos == null) sortiert.forEach(function(b, i){ if (b.is_own === true || String(b.is_own) === "yes") pos = i + 1; });
      }
      var fussVis = (pos != null && anzahl != null) ? ersetze(t("#{n} of {m} brands"), { n: fmtI(pos), m: fmtI(anzahl) }) : "";
      var leiseVis = leader ? (String(leader) + (leaderV != null ? " " + fmtPct1(leaderV) : "")) : "";
      var bestR = num(o.best_rank), first = num(o.first_count), prompts = num(o.prompt_count);
      var fussRank = bestR != null ? ersetze(t("Best in field {v}"), { v: fmtR(bestR) }) : "";
      var leiseRank = (first != null && prompts != null) ? ersetze(t("First in {n}/{m} prompts"), { n: fmtI(first), m: fmtI(prompts) }) : "";
      var avg = num(o.field_avg_sentiment), neg = num(o.negative_count), resp = num(o.response_count);
      var fussSent = avg != null ? ersetze(t("Field average {v}"), { v: fmtI(avg) }) : "";
      var leiseSent = (neg != null && resp != null) ? ersetze(t("{n}/{m} negative"), { n: fmtI(neg), m: fmtI(resp) }) : "";
      elKpis.innerHTML =
        kpiKarte("Visibility", '<span class="up-num">' + fmtPct1(vis) + '</span>',
          UC.trendChip(o.visibility_delta_pct, { decimals: true, suffix: "%" }), reihe(o.visibility_series), fussVis, leiseVis) +
        kpiKarte("Avg. Rank", '<span class="up-num">' + fmtR(rank) + '</span>',
          UC.trendChip(o.avg_rank_delta, { decimals: true, inverted: true }), reihe(o.rank_series), fussRank, leiseRank) +
        kpiKarte("Sentiment", '<span class="up-num">' + fmtI(sent) + '</span>',
          UC.trendChip(o.sentiment_delta, { decimals: true }), reihe(o.sentiment_series), fussSent, leiseSent);
    }
    function kpiSkelett(){
      var k = '<div class="upw-kpi is-sk"><div class="upw-kpi-top"><div class="upw-kpi-main">' +
        '<span class="upw-sk upw-sk-lbl"></span><span class="upw-sk upw-sk-val"></span></div>' +
        '<span class="upw-sk upw-sk-spark"></span></div><div class="upw-kpi-foot"><span class="upw-sk upw-sk-foot"></span></div></div>';
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
    function brandsKopf(){
      return '<div class="up-thead">' +
        '<div class="up-th up-th-idx">' + (UC.HASH_ICON || "#") + '</div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Brand")) + '</span></div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Visibility")) + '</span></div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Rank")) + '</span></div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Sent.")) + '</span></div></div>';
    }
    function renderBrands(){
      var kopf = brandsKopf();
      if (state.fehler.brands){ elBrands.innerHTML = kopf + (UC.leseFehlerHtml ? UC.leseFehlerHtml("brands") : ""); zaehler(elCntBrands, null); return; }
      if (state.loading || !state.brands){
        elBrands.innerHTML = kopf + '<div class="up-tbody">' + UC.skeletonRows({ count: 7, rowClass: "up-row", cellClass: "up-td",
          cols: [{ w: 12, cls: "up-td-idx" }, { w: 90, jitter: 30, logo: true }, 60, 36, 40] }) + '</div>';
        zaehler(elCntBrands, null);
        return;
      }
      var rows = state.brands;
      zaehler(elCntBrands, rows.length);
      if (!rows.length){ elBrands.innerHTML = kopf + '<div class="up-empty-mini" data-i18n="No data">' + esc(t("No data")) + '</div>'; return; }
      elBrands.innerHTML = kopf + '<div class="up-tbody">' + rows.map(function(r, i){
        var pos = num(r.position) != null ? num(r.position) : i + 1;
        var v = num(r.visibility_pct), rk = num(r.avg_rank), s = num(r.sentiment);
        var vis = '<span class="up-num' + (v == null ? " is-empty" : "") + '">' + fmtPct1(v) + '</span>' +
          UC.trendChip(r.visibility_delta_pct, { decimals: true, suffix: "%" });
        var rank = '<span class="up-rank-group">' + HASH + '<span class="up-num">' + fmtR(rk) + '</span></span>';
        var sent = '<span class="up-sent"><span class="up-sent-dot" style="background:' + (s == null ? "#9E9E9E" : UC.sentColor(s)) + '"></span>' +
          '<span class="up-sent-val' + (s == null ? " is-empty" : "") + '">' + (s == null ? "–" : Math.round(s)) + '</span></span>';
        return '<div class="up-row' + (r.is_own === true || String(r.is_own) === "yes" ? " is-own" : "") + '" data-upw-row="brand" data-id="' + esc(String(r.company_id == null ? "" : r.company_id)) + '">' +
          '<div class="up-td up-td-idx">' + fmtI(pos) + '</div>' +
          '<div class="up-td upw-td-name">' + logo(r.logo_url || r.favicon_url, r.name) + '<span class="upw-name" title="' + esc(r.name == null ? "" : r.name) + '">' + esc(r.name == null ? "" : r.name) + '</span></div>' +
          '<div class="up-td">' + vis + '</div>' +
          '<div class="up-td">' + rank + '</div>' +
          '<div class="up-td">' + sent + '</div></div>';
      }).join("") + '</div>';
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
    function citesKopf(url){
      return '<div class="up-thead">' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t(url ? "URL" : "Domain")) + '</span></div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Type")) + '</span></div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Share")) + '</span></div>' +
        '<div class="up-th"><span class="up-th-txt">' + esc(t("Change")) + '</span></div></div>';
    }
    function renderCites(){
      var url = state.cmode === "url";
      var kopf = citesKopf(url);
      var rows = url ? state.urls : state.domains;
      var fehler = url ? state.fehler.urls : state.fehler.domains;
      elCntCites.textContent = state.citesLabel ? t(state.citesLabel) : "";
      elCntCites.parentNode.classList.toggle("has-count", !!state.citesLabel);
      if (fehler){ elCites.innerHTML = kopf + (UC.leseFehlerHtml ? UC.leseFehlerHtml("citations") : ""); return; }
      if (state.loading || !rows){
        elCites.innerHTML = kopf + '<div class="up-tbody">' + UC.skeletonRows({ count: 7, rowClass: "up-row", cellClass: "up-td",
          cols: [{ w: 110, jitter: 30, logo: true }, 56, 36, 40] }) + '</div>';
        return;
      }
      if (!rows.length){ elCites.innerHTML = kopf + '<div class="up-empty-mini" data-i18n="No data">' + esc(t("No data")) + '</div>'; return; }
      elCites.innerHTML = kopf + '<div class="up-tbody">' + rows.map(function(r){
        var name = url ? (r.title || r.url || "") : (r.domain || "");
        var id = url ? (r.url || r.title || "") : (r.domain || "");
        var fav = r.favicon || r.logo || "";
        var anteil = num(url ? (r.global_share_pct != null ? r.global_share_pct : r.share_pct) : r.share_pct);
        return '<div class="up-row" data-upw-row="' + (url ? "url" : "domain") + '" data-id="' + esc(String(id)) + '">' +
          '<div class="up-td upw-td-name">' + (fav ? '<span class="up-logo-box up-fav has-img"><img src="' + esc(fav) + '" alt="" referrerpolicy="no-referrer"/></span>'
                                               : '<span class="up-logo-box up-fav"></span>') +
            '<span class="upw-name" title="' + esc(url && r.url ? r.url : name) + '">' + esc(name) + '</span></div>' +
          '<div class="up-td">' + typTag(url ? r.url_type : r.citation_type, url) + '</div>' +
          '<div class="up-td"><span class="up-num' + (anteil == null ? " is-empty" : "") + '">' + fmtPct1(anteil) + '</span></div>' +
          '<div class="up-td">' + UC.trendChip(r.share_delta_pct, { decimals: true, suffix: "%" }) + '</div></div>';
      }).join("") + '</div>';
    }
    function zaehler(el, n){
      el.textContent = n == null ? "" : fmtI(n);
      el.parentNode.classList.toggle("has-count", n != null);
    }

    root.querySelector(".upw-cmode").addEventListener("click", function(e){
      var b = e.target.closest("[data-upw-cmode]");
      if (!b) return;
      state.cmode = b.getAttribute("data-upw-cmode") === "url" ? "url" : "domain";
      root.querySelectorAll("[data-upw-cmode]").forEach(function(x){
        var on = x === b;
        x.classList.toggle("is-active", on); x.setAttribute("aria-selected", on ? "true" : "false");
      });
      renderCites();
    });
    root.addEventListener("click", function(e){
      var x = e.target.closest("[data-upw-expand]");
      if (x){
        var was = x.getAttribute("data-upw-expand");
        if (was === "brands") fire("data-brands-fn", "upwBrands", {});
        else fire("data-citations-fn", "upwCitations", { mode: state.cmode === "url" ? "urls" : "domains" });
        return;
      }
      var row = e.target.closest("[data-upw-row]");
      if (row && !row.classList.contains("up-tsk")){
        fire("data-rowclick-fn", "upwRowClick", { type: row.getAttribute("data-upw-row"), id: row.getAttribute("data-id") || "" });
      }
    });

    function renderAll(){ renderChips(); renderChats(); renderKpis(); renderBrands(); renderCites(); }

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
