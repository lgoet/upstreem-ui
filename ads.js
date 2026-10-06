/* upstreem ads.js -- Ads (Beta, V1): beobachtete Anzeigen in getrackten KI-Antworten (05.10.).
   Praefix uad. Entwurf: design_handoff_ads (Ads.dc.html, README.md), Datenvertrag: ADS_V1_RPCS.md
   (sechs Lese-RPCs, je eine Zeile mit genau einer Spalte "json").

   DREI SEITEN, EIN DETAIL UND EIN DRAWER in EINER Komponente, Bauart wie Shopping: Kopf mit Krumen
   und Reitern, Kalender und Filter IN der Komponente (lokale Instanzen, data-local).
     ?view=ads                                 Overview
     ?view=ads&ads=advertisers|library         die Reiter
     ?view=ads&ads=advertisers&advertiser=<n>  Advertiser Detail (der Reiter Advertisers bleibt an)
   Der Ad-Detail-Drawer ist ein Seiten-Drawer aus core (UC.makeSeitenDrawer): jedes Ad-Objekt traegt
   alle 29 Felder, er braucht also weder eine Anfrage noch ein Bubble-Element.

   DATENWEGE: sechs RPCs (bubble/ads_runjs.md). Jede Anfrage geht als Ereignis an Bubble und traegt
   den FERTIGEN RPC-Body als Text; die Antwort kommt als json-Feld des Umschlags plus Fehler-Body:
     adsOverview          get_ads_overview_v1           setAdsOverview(id, json, fehler)
     adsAdvertisers       list_ads_advertisers_v1       setAdsAdvertisers(id, json, fehler)
     adsAdvertiserDetail  get_ads_advertiser_detail_v1  setAdsAdvertiserDetail(id, json, fehler)
     adsLibrary           list_ads_library_v1           setAdsLibrary(id, json, fehler)
     adsPrompts           list_ads_prompts_v1           setAdsPrompts(id, json, fehler)
     adsFilterOptions     get_ads_filter_options_v1     setAdsFilterOptions(id, json, fehler)
   Die Antworten nennen ihre Parameter nicht. Darum laeuft je RPC hoechstens EINE Anfrage; was sich
   waehrenddessen aendert, geht hinaus, sobald sie da ist (dieselbe Bauart wie Shopping).

   WAS DER ENTWURF ZEIGT UND DIE RPCs NICHT LIEFERN (05.10., in der Uebergabe benannt; jeweils die
   kleinste richtige Loesung, nichts erfunden):
     - Trends der Kennzahlen und der Advertiser Share ("vs. Vorperiode", "New"): kein Vorperiodenwert
       in den RPCs -> keine Trend-Chips, kein Vergleichs-Fuss.
     - Ad Coverage "By Model | By Market": trend hat nur die Summe je Tag -> nur die eine Linie,
       ohne Umschalter.
     - Domain unter dem Advertiser in der Tabelle, Markt je Prompt: nicht in den Listen -> weg.
     - "6x" an der Karte, "All observations" und "Creatives in this campaign" im Drawer: die RPCs
       liefern jede Beobachtung als eigenes Item ("nichts wird zusammengefasst") -> eine Karte je
       Beobachtung, ohne Zaehler; der Drawer zeigt die eine Beobachtung.
     - Logos im Advertiser-Stapel der Prompt-Liste: nur advertiser_count -> die Zahl.
     - Die Ads eines Prompts beim Aufklappen: keine Prompt-Id in list_ads_library_v1 -> dieselbe
       RPC mit dem Prompttext als Suche, auf prompt_id gefiltert (hoechstens 100, die neuesten).
   Unlesbar, leer und noch nicht da sehen nie gleich aus: Fehlerzustand, Leerzustand, Skelett. */
(function () {
  "use strict";

  /* ---- Boot-Stubs (STYLEGUIDE §25), VOR der core-Pruefung ---------------------------------- */
  var API_NAMES = ["setAdsOverview", "setAdsAdvertisers", "setAdsAdvertiserDetail", "setAdsLibrary",
                   "setAdsPrompts", "setAdsFilterOptions", "resetAds"];
  var Q = (window.__uadBootQueue = window.__uadBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function uadBoot(triesLeft) {
    if (!window.UpstreemCore) {
      if (triesLeft > 0) { setTimeout(function () { uadBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("UpstreemCore (core.js) not loaded");
      return;
    }
    uadStart();
  }

  function uadStart() {
  var UC = window.UpstreemCore;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__uadStore = window.__uadStore || {});

  /* ---- Kleine Helfer ------------------------------------------------------------------------ */
  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  /* Ein Objekt oder eine Liste ist kein Text: ohne das stuende "[object Object]" als Titel da. */
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function ersetze(s, o) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return o[k] != null ? o[k] : ""; }); }
  function objOder(o) { return o && typeof o === "object" && !isArr(o) ? o : null; }
  /* Die Ids der Kampagnen-Metadaten sind lange Ziffernfolgen ("100000000000000000000") -- als Zahl
     verloeren sie ihre letzten Stellen. Das Backend schickt sie als Text ("IDs sind immer Strings");
     kaeme eine doch ohne Anfuehrungszeichen, wird sie VOR dem Lesen zu Text (UC.bubbleObjekt). */
  var GROSSE_IDS = ["campaign_id", "ad_account_id", "ad_id", "ad_group_id"];
  function objekt(raw) { return UC.bubbleObjekt ? UC.bubbleObjekt(raw, { grosseIds: GROSSE_IDS }) : null; }
  function fehlerCode(f) { return UC.bubbleFehler ? UC.bubbleFehler(f) : str(f).trim(); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  /* Nur http(s): ein Bild, Logo oder Ziel aus den Daten darf nie javascript: oder data: sein. */
  function sichereUrl(u) {
    var s = str(u).trim();
    if (!s) return "";
    if (s.indexOf("//") === 0) s = "https:" + s;
    return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : "";
  }

  /* ---- Zahlen (CLAUDE.md 2b): Prozent mit einer Stelle, Anzahlen ganz ----------------------------
     PLAUSIBEL ODER GAR NICHT, wie in Shopping: ein Anteil von 250 % oder 1e21 Auftritte ist kein
     Messwert, sondern ein Datenfehler -- er wird "–". Ein kleiner Rundungsueberhang (100,0004 %)
     bleibt ein Wert und wird auf den Rand gesetzt. */
  function anteilWert(v) { v = num(v); return v == null || v < -0.5 || v > 100.5 ? null : Math.max(0, Math.min(100, v)); }
  function anzahlWert(v) { v = num(v); return v == null || v < 0 || v >= 1e15 ? null : v; }
  function pct(v) { v = anteilWert(v); return v == null ? "–" : (UC.fmtPct ? UC.fmtPct(v, 1) : v.toFixed(1) + "%"); }
  function ganz(v) { v = anzahlWert(v); return v == null ? "–" : (UC.fmtInt ? UC.fmtInt(v) : String(Math.round(v))); }
  function datum(v) { return str(v).trim() ? (UC.fmtDate ? UC.fmtDate(v) : str(v).slice(0, 10)) : "–"; }
  /* "5. Okt. 2026, 14:37" -- Datum aus core, die Uhrzeit in der Zeit des Betrachters. */
  function zeitpunkt(v) {
    var d = datum(v);
    if (d === "–") return d;
    var x = new Date(str(v));
    if (isNaN(x.getTime())) return d;
    return d + ", " + ("0" + x.getHours()).slice(-2) + ":" + ("0" + x.getMinutes()).slice(-2);
  }
  /* Ein Marktcode ist kurz und ohne Sonderzeichen (DE, AT, US); was anders aussieht, ist keiner. */
  function marktCode(v) { var c = str(v).trim().toUpperCase(); return /^[A-Z0-9_-]{1,12}$/.test(c) ? c : ""; }
  function marktName(code) {
    var l = UC.getAllMarkets ? UC.getAllMarkets() : [];
    for (var i = 0; i < (l || []).length; i++) {
      var m = l[i];
      if (m && str(m.alpha2 || m.code).toUpperCase() === code && str(m.name).trim()) return str(m.name).trim() + " (" + code + ")";
    }
    return code;
  }

  /* ---- Katalog (Deutsch) ----------------------------------------------------------------------
     DER KATALOG IST EINER FUER DIE GANZE APP (feedback Katalog-Kollision): kein Schluessel, den core
     fuehrt, und keiner, den eine andere Komponente mit anderer Bedeutung fuehrt. "Image Ad",
     "Product Ad", "Competitor" stehen in core (Ad Card). Am 05.10. gegen alle Kataloge abgeglichen. */
  if (UC.addMessages) UC.addMessages("de", {
    "Ads": "Ads", "Observed advertisements inside tracked AI responses": "Beobachtete Anzeigen in getrackten KI-Antworten",
    "Advertisers": "Werbetreibende", "Ad Library": "Anzeigenbibliothek", "Advertiser": "Werbetreibender",
    "Ad Coverage": "Ad Coverage", "Ad Appearances": "Ad-Auftritte", "Prompts with Ads": "Prompts mit Ads",
    "{pct} of tracked prompts": "{pct} der getrackten Prompts",
    "Advertiser Share": "Anteil der Werbetreibenden", "Topics with Ads": "Topics mit Ads", "Recent Ads": "Neueste Ads",
    "View all": "Alle ansehen", "Open Ad Library": "Anzeigenbibliothek öffnen",
    "Activity": "Aktivität", "Appearances": "Auftritte", "Ad Share": "Ad Share",
    "By Campaign": "Nach Kampagne", "No campaign data": "Keine Kampagnendaten", "{n} ad": "{n} Ad", "{n} ads": "{n} Ads",
    "Organic Context": "Organischer Kontext", "Also mentioned organically": "Auch organisch erwähnt",
    "You are also mentioned organically": "Du wirst auch organisch erwähnt", "Not mentioned organically": "Nicht organisch erwähnt",
    "Formats": "Formate", "First Seen": "Zuerst gesehen", "Last Ad Seen": "Zuletzt mit Ad",
    "Ad": "Ad", "Format": "Format", "Observed": "Beobachtet",
    "Ads observed for this prompt": "Bei diesem Prompt beobachtete Ads", "Open Prompt Detail": "Prompt-Details öffnen",
    "Showing the {n} most recent of {total}.": "Die {n} neuesten von {total}.",
    "All advertisers": "Alle Werbetreibenden", "{n} advertisers": "{n} Werbetreibende",
    "All formats": "Alle Formate", "{n} formats": "{n} Formate",
    "Search advertisers…": "Werbetreibende durchsuchen…", "Search ads, advertisers, campaigns…": "Ads, Werbetreibende, Kampagnen durchsuchen…",
    "Search advertisers": "Werbetreibende durchsuchen", "Search ads": "Ads durchsuchen",
    "No advertisers yet": "Noch keine Werbetreibenden", "No formats yet": "Noch keine Formate",
    "No Ads match these filters.": "Keine Ads passen zu diesen Filtern.", "No Ads observed": "Keine Ads beobachtet",
    "None of the tracked AI responses in this range contained an Ad.": "Keine getrackte KI-Antwort in diesem Zeitraum enthielt eine Ad.",
    "No matching advertisers": "Keine passenden Werbetreibenden", "No matching Ads": "Keine passenden Ads",
    "No observed Ads match this search and these filters.": "Keine beobachteten Ads passen zu dieser Suche und diesen Filtern.",
    "No Ads were observed for this prompt.": "Bei diesem Prompt wurden keine Ads beobachtet.",
    "Clear search and filters": "Suche und Filter zurücksetzen",
    "Ad content": "Inhalt der Ad", "Destination": "Ziel", "Landing domain": "Zieldomain", "Landing URL": "Ziel-URL",
    "Observation": "Beobachtung", "Observed at": "Beobachtet am", "Campaign metadata": "Kampagnen-Metadaten",
    "UTM Campaign": "UTM-Kampagne", "Campaign ID": "Kampagnen-ID", "Ad Group ID": "Anzeigengruppen-ID", "Ad ID": "Ad-ID",
    "Ad Account ID": "Werbekonto-ID", "Ad Format": "Anzeigenformat",
    "Price": "Preis", "Topic": "Topic", "Topics": "Topics", "Image": "Bild", "Product": "Produkt",
    "Ads data could not be loaded": "Ads-Daten konnten nicht geladen werden",
    "This advertiser could not be loaded": "Dieser Werbetreibende konnte nicht geladen werden",
    "The date range is not valid.": "Der Zeitraum ist ungültig.",
    "Too many requests. Please wait a moment.": "Zu viele Anfragen. Bitte warte einen Moment.",
    "This is taking longer than expected. Please try again.": "Das dauert länger als erwartet. Bitte erneut versuchen.",
    "Try again": "Erneut versuchen",
    "No matching topics": "Keine passenden Topics",
    "View Response": "Antwort ansehen"
  });

  /* Die Erklaerkarten (UC.makeExplain), Texte aus dem Entwurf (TIPS). */
  var ERKLAER = {
    coverage: { h: "Ad Coverage", f: "Responses with at least one Ad ÷ tracked responses",
      t: "How often a tracked AI response contained at least one Ad." },
    advertisers: { h: "Advertisers", f: "Count of unique advertisers",
      t: "Distinct advertisers whose Ads appeared in the selected period." },
    appearances: { h: "Ad Appearances", f: "Count of observed Ads",
      t: "Every observed Ad counts once, even when the same creative appears again in another response." },
    prompts: { h: "Prompts with Ads", f: "Prompts with at least one Ad ÷ tracked prompts",
      t: "Tracked prompts that produced at least one Ad in any run." },
    share: { h: "Ad Share", f: "Appearances of this advertiser ÷ all Ad appearances",
      t: "An advertiser's part of all observed Ad appearances. This is presence in AI responses, not spend." },
    organic: { h: "Organic Context", f: "Brand mentioned in the organic answer of this prompt",
      t: "Whether this brand was also mentioned in the answer text of the same prompt. Only shown for brands Upstreem already tracks." }
  };
  if (UC.addMessages) UC.addMessages("de", {
    "Responses with at least one Ad ÷ tracked responses": "Antworten mit mindestens einer Ad ÷ getrackte Antworten",
    "How often a tracked AI response contained at least one Ad.": "Wie oft eine getrackte KI-Antwort mindestens eine Ad enthielt.",
    "Count of unique advertisers": "Anzahl verschiedener Werbetreibender",
    "Distinct advertisers whose Ads appeared in the selected period.": "Verschiedene Werbetreibende, deren Ads im gewählten Zeitraum erschienen.",
    "Count of observed Ads": "Anzahl beobachteter Ads",
    "Every observed Ad counts once, even when the same creative appears again in another response.": "Jede beobachtete Ad zählt einmal, auch wenn dasselbe Motiv in einer anderen Antwort wieder erscheint.",
    "Prompts with at least one Ad ÷ tracked prompts": "Prompts mit mindestens einer Ad ÷ getrackte Prompts",
    "Tracked prompts that produced at least one Ad in any run.": "Getrackte Prompts, die in irgendeinem Lauf mindestens eine Ad hervorgebracht haben.",
    "Appearances of this advertiser ÷ all Ad appearances": "Auftritte dieses Werbetreibenden ÷ alle Ad-Auftritte",
    "An advertiser's part of all observed Ad appearances. This is presence in AI responses, not spend.": "Der Anteil eines Werbetreibenden an allen beobachteten Ad-Auftritten. Das ist Präsenz in KI-Antworten, kein Budget.",
    "Brand mentioned in the organic answer of this prompt": "Marke in der organischen Antwort dieses Prompts erwähnt",
    "Whether this brand was also mentioned in the answer text of the same prompt. Only shown for brands Upstreem already tracks.": "Ob diese Marke auch im Antworttext desselben Prompts erwähnt wurde. Nur für Marken, die Upstreem bereits trackt."
  });

  /* Stabile Fehlercodes (Vertrag, Abschnitt 3) -> was der Nutzer tun kann. Alles andere: der
     allgemeine Satz. ads_invalid_param kann nur ein Fehler dieser Komponente sein -- der Nutzer kann
     daran nichts aendern, also der allgemeine Satz mit "Try again". */
  var FEHLER = {
    ads_invalid_date: "The date range is not valid.",
    rate_limited: "Too many requests. Please wait a moment.",
    zeit: "This is taking longer than expected. Please try again."
  };
  function fehlerText(code) {
    var c = str(code).trim();
    if (/^team_access_/.test(c) || c === "forbidden" || c === "not authenticated") return t("Your team doesn't have access right now.");
    if (/rate.?limit/i.test(c)) return t(FEHLER.rate_limited);
    return t(FEHLER[c] || "Something went wrong. Please try again.");
  }

  var SEITEN = [
    { value: "overview", label: "Overview", icon: "dashboardSquare" },
    { value: "advertisers", label: "Advertisers", icon: "bank" },
    { value: "library", label: "Ad Library", icon: "album" }
  ];
  var SEITE_OK = { overview: 1, advertisers: 1, library: 1, advertiser: 1 };
  /* Die erlaubten Sortierungen -- genau die Werte des Vertrags. Ein Wert ausserhalb waere
     ads_invalid_param. */
  var ORDER = {
    advertisers: ["ad_appearances_desc", "ad_appearances_asc", "prompt_count_desc", "topic_count_desc",
                  "last_seen_desc", "first_seen_asc", "advertiser_name_asc"],
    prompts: ["ad_coverage_desc", "ad_coverage_asc", "ad_appearances_desc", "advertiser_count_desc",
              "last_ad_seen_desc", "total_runs_desc", "prompt_text_asc"]
  };
  var ORDER_VORGABE = { advertisers: "ad_appearances_desc", prompts: "ad_coverage_desc" };
  /* Die Klickfolge je Spaltenkopf (UC.makeHeadSort): die erste Stufe ist die sinnvolle Richtung.
     Ad Share und Appearances sortieren beide nach den Auftritten -- der Anteil ist ihnen proportional. */
  var ZYKLEN = {
    advertisers: { ad_appearances: ["ad_appearances:desc", "ad_appearances:asc"], prompt_count: ["prompt_count:desc"],
                   topic_count: ["topic_count:desc"], last_seen: ["last_seen:desc"], first_seen: ["first_seen:asc"],
                   advertiser_name: ["advertiser_name:asc"] },
    prompts: { ad_coverage: ["ad_coverage:desc", "ad_coverage:asc"], ad_appearances: ["ad_appearances:desc"],
               advertiser_count: ["advertiser_count:desc"], last_ad_seen: ["last_ad_seen:desc"], prompt_text: ["prompt_text:asc"] },
    /* Topics with Ads (06.10.): sortiert wird in der Komponente -- overview.topics traegt ALLE
       Topics im Scope (Vertrag 4.1, keine Grenze), es gibt also nichts nachzuladen. */
    topics: { ad_coverage: ["ad_coverage:desc", "ad_coverage:asc"], advertiser_count: ["advertiser_count:desc"],
              ad_appearances: ["ad_appearances:desc"], topic_name: ["topic_name:asc"] }
  };
  var FORMAT_KURZ = { image_card_v2: "Image", product_card_v2: "Product" };
  var WARTE_MS = 25000;
  var CACHE_MAX = 16;
  /* Wie viele Ads beim Aufklappen eines Prompts geholt werden: die Obergrenze des Vertrags. */
  var AUF_LIMIT = 100;

  /* ============================================================================================
     Eine Wurzel
     ============================================================================================ */
  function initRoot(root) {
    if (root.__uadController) return root.__uadController;
    var instanceId = root.getAttribute("data-instance") || "default";
    if (/^[A-Z_]{4,}$/.test(instanceId)) return null;   /* Platzhalter noch nicht ersetzt */
    var fire = UC.makeFire(root, { label: "ads", eventPrefix: "uad" });

    /* Der Stand je Instanz im window-Speicher: Bubble baut das Element bei einem Themenwechsel neu
       (feedback Themenwechsel = Neuaufbau), dann geht es mit Seite, Filtern und Daten weiter. */
    var saved = STORE[instanceId] || null;
    function gemerkt(k, sonst) { return saved && saved[k] != null ? saved[k] : sonst; }
    var GROESSE = UC.DEFAULT_PAGE_SIZE || 15;
    var state = {
      seite: "overview", advertiser: null,
      filter: gemerkt("filter", { von: null, bis: null, preset: "", modelle: null, maerkte: null, topics: null }),
      /* Advertisers und Ad Format: die zwei Auswahlen der Ad Library (Entwurf: "nicht in More
         Filters"). Sie gelten wie dort fuer ALLE Seiten (p_advertisers, p_ad_formats). */
      adFilter: gemerkt("adFilter", { advertisers: [], formate: [] }),
      advertisers: gemerkt("advertisers", { suche: "", order: ORDER_VORGABE.advertisers, page: 1, pageSize: GROESSE }),
      library: gemerkt("library", { modus: "ads", ansicht: "grid", suche: "", page: 1, pageSize: 25 }),
      prompts: gemerkt("prompts", { order: ORDER_VORGABE.prompts, page: 1, pageSize: GROESSE }),
      /* Topics with Ads auf der Overview: Suche, Sortierung und Seite, alles in der Komponente. */
      topicsTab: gemerkt("topicsTab", { suche: "", order: "ad_coverage_desc", page: 1, pageSize: GROESSE }),
      dMetrik: gemerkt("dMetrik", "n"), dGruppe: gemerkt("dGruppe", "all"),
      offen: {},
      cache: gemerkt("cache", { overview: {}, advertisers: {}, detail: {}, library: {}, prompts: {}, optionen: {} }),
      /* Name des Werbetreibenden -> { fest: Domain aus einem Advertiser-Objekt, z: { Domain: Anzahl
         seiner Ads } }. Gelernt beim Merken jeder Antwort, siehe domainsLernen. */
      domains: gemerkt("domains", {}),
      reihe: gemerkt("reihe", { overview: [], advertisers: [], detail: [], library: [], prompts: [], optionen: [] }),
      fehler: {}, kalenderDa: false
    };
    function persist() {
      if (root.isConnected === false) return;
      STORE[instanceId] = { filter: state.filter, adFilter: state.adFilter, advertisers: state.advertisers, library: state.library,
        prompts: state.prompts, topicsTab: state.topicsTab, dMetrik: state.dMetrik, dGruppe: state.dGruppe, cache: state.cache, reihe: state.reihe,
        domains: state.domains };
    }
    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);

    /* Die Erklaerkarte aus core an jedem Info-Zeichen, im Format aller Spaltenkoepfe der App
       (05.10. abends: "Explainer Tooltips, so wie ueberall"): oben auf der hellen Platte ein Wert,
       so wie ihn die Kachel oder Zelle zeigt, darunter Titel, Satz und die Formel -- Wort fuer Wort
       der Aufbau von Shopping. Ohne Trendpfeil: die Ads-RPCs liefern keinen Vorperiodenwert, ein
       Pfeil in der Probe versprache einen, den die Seite nie zeigt. Die Werte sind die der
       Uebergabe-Daten (Overview: 11.4%, 6, 81, 13; HOLY: 34.6%). */
    function erklaerVorschau(key) {
      if (key === "organic") {
        return '<span class="up-explain-row"><span class="up-explain-up">' + UC.icon("check", 2) + '</span><span>' + esc(t("Also mentioned organically")) + '</span></span>';
      }
      var bsp = { coverage: "11.4%", advertisers: "6", appearances: "81", prompts: "13", share: "34.6%" }[key];
      return bsp ? '<span class="up-explain-row">' + esc(bsp) + '</span>' : "";
    }
    if (UC.makeExplain) UC.makeExplain({ root: root, triggerSel: ".uad-erklaer", getIsDark: isDark,
      html: function (key) {
        var e = ERKLAER[key];
        if (!e) return "";
        var vis = erklaerVorschau(key);
        return (vis ? '<div class="up-explain-vis">' + vis + '</div>' : '') +
          '<div class="up-explain-h">' + esc(t(e.h)) + '</div><div class="up-explain-t">' + esc(t(e.t)) + '</div>' +
          '<div class="up-explain-t">' + esc(t(e.f)) + '</div>';
      } });
    function info(key) {
      return '<span class="up-th-info uad-erklaer" data-explain="' + esc(key) + '">' + UC.icon("info", 2) + '</span>';
    }

    /* ---- Gerueste: Kopf, Reiter, Filterzeile, Inhalt ----------------------------------------- */
    root.classList.add("up-sidebar-clear");
    var idDaten = instanceId + "_dates", idFilter = instanceId + "_filters", idModelle = instanceId + "_models",
        idMaerkte = instanceId + "_markets", idTopics = instanceId + "_topics";
    var dunkelAttr = isDark() ? "yes" : "no";
    root.innerHTML =
      '<div class="up-ph-top uad-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Ads")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Observed advertisements inside tracked AI responses")) + '</p></div>' +
      '</div>' +
      '<div class="up-ph-nav uad-nav" role="tablist"></div>' +
      '<div class="uad-filterzeile">' +
        '<div class="up-root udr-root uad-daten" data-instance="' + esc(idDaten) + '" data-local="yes" data-isdark="' + dunkelAttr + '"></div>' +
        '<div class="up-root ufb-root uad-filterleiste" data-instance="' + esc(idFilter) + '" data-topics-instance="' + esc(idTopics) + '"' +
          ' data-models-instance="' + esc(idModelle) + '" data-markets-instance="' + esc(idMaerkte) + '" data-isdark="' + dunkelAttr + '"></div>' +
        '<div class="up-root utf-root" data-instance="' + esc(idTopics) + '" data-local="yes" data-isdark="' + dunkelAttr + '"></div>' +
        '<div class="up-root umf-root" data-instance="' + esc(idModelle) + '" data-local="yes" data-isdark="' + dunkelAttr + '"></div>' +
        '<div class="up-root umk-root" data-instance="' + esc(idMaerkte) + '" data-local="yes" data-isdark="' + dunkelAttr + '"></div>' +
      '</div>' +
      '<div class="uad-main"></div>';
    var elMain = root.querySelector(".uad-main"), elNav = root.querySelector(".uad-nav");
    var nav = UC.makePageNav ? UC.makePageNav(root, {
      nav: elNav, storeKey: instanceId + "|uad-nav",
      selected: "overview",
      pages: SEITEN.map(function (p) { return { value: p.value, label: p.label, icon: UC.icon(p.icon, 2) }; }),
      onSelect: function (v) { seiteOeffnen(v, true); }
    }) : null;
    var krumen = UC.makePageCrumbs ? UC.makePageCrumbs(root, {
      icon: "marketing", name: "Ads", marke: "Beta", komponente: true, quelle: elNav,
      klick: function () { seiteOeffnen("overview", true); },
      klickWenn: function () { return state.seite === "advertiser"; },
      stufen: function () {
        if (state.seite !== "advertiser") {
          var p = SEITEN.filter(function (x) { return x.value === state.seite; })[0];
          return p ? [{ name: p.label, uebersetzen: true }] : [];
        }
        return [{ name: "Advertisers", uebersetzen: true, klick: function () { seiteOeffnen("advertisers", true); } },
                { name: state.advertiser || "…" }];
      }
    }) : null;
    function krumenNeu() { if (krumen && krumen.zeichnen) krumen.zeichnen(); }

    /* ---- Adresse ------------------------------------------------------------------------------ */
    function adresseLesen() {
      var q;
      try { q = new URLSearchParams(window.location.search); } catch (e) { q = null; }
      var s = q ? str(q.get("ads")).trim() : "", a = q ? str(q.get("advertiser")).trim() : "";
      /* Ein Advertiser IST sein Name (p_advertiser_name). Ueberlang ist er keiner. */
      if (a && a.length <= 200) return { seite: "advertiser", advertiser: a };
      return { seite: SEITE_OK[s] && s !== "advertiser" ? s : "overview", advertiser: null };
    }
    function adresseSetzen(neuerEintrag) {
      try {
        var u = new URL(window.location.href);
        var s = state.seite === "advertiser" ? "advertisers" : state.seite;
        if (s === "overview") u.searchParams.delete("ads"); else u.searchParams.set("ads", s);
        if (state.seite === "advertiser" && state.advertiser) u.searchParams.set("advertiser", state.advertiser);
        else u.searchParams.delete("advertiser");
        var neu = u.pathname + u.search + u.hash;
        if (neu === window.location.pathname + window.location.search + window.location.hash) return;
        if (neuerEintrag) window.history.pushState(window.history.state, "", neu);
        else window.history.replaceState(window.history.state, "", neu);
      } catch (e) {}
    }

    /* ---- Filter -------------------------------------------------------------------------------
       Der Kalender und die drei Filter sind lokale Instanzen (data-local): sie senden nichts an
       Bubble, sie melden sich als DOM-Ereignis an dieser Wurzel (Bauart Shopping). Topics: der
       Vertrag kennt nur "eines der gewaehlten" (oder) -- tag_mode wird nicht geschickt. */
    function filterSig() {
      var f = state.filter, a = state.adFilter;
      return [f.von || "", f.bis || "", (f.modelle || []).join(","), (f.maerkte || []).join(","), (f.topics || []).join(","),
              (a.advertisers || []).join(","), (a.formate || []).join(",")].join("|");
    }
    function filterAktiv() {
      var f = state.filter, a = state.adFilter;
      return !!((f.modelle && f.modelle.length) || (f.maerkte && f.maerkte.length) || (f.topics && f.topics.length) ||
                (a.advertisers && a.advertisers.length) || (a.formate && a.formate.length));
    }
    function liste(s) { return String(s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
    function toArr(x) {
      if (isArr(x)) return x;
      if (x && typeof x === "object") return Object.keys(x).map(function (k) { var v = x[k]; return v && typeof v === "object" ? v : { code: k }; });
      return [];
    }
    /* include/exclude wie in Shopping: exclude heisst "alle ausser". Leer heisst alle = null. */
    function auswahl(feld, d, schluessel) {
      var gew = liste(d && d[schluessel]);
      if (!gew.length) return null;
      if (d.select_mode !== "exclude") return gew;
      var alle = feld === "modelle"
        ? (UC.getModels ? UC.getModels() : []).map(function (m) { return str(m.key || m.model); })
        : (UC.getAllMarkets ? toArr(UC.getAllMarkets()) : []).map(function (m) { return str(m.alpha2 || m.alpha3 || m.code || m.market).toUpperCase(); });
      return alle.filter(function (k) { return k && gew.indexOf(k) < 0; });
    }
    function filterSetzen(feld, wert) {
      var alt = JSON.stringify(state.filter[feld] == null ? null : state.filter[feld]);
      if (alt === JSON.stringify(wert == null ? null : wert)) return false;
      state.filter[feld] = wert;
      return true;
    }
    function filterGeaendert() {
      /* Neue Filter sind ein neuer Ergebnissatz: jede Tabelle zurueck auf Seite 1, jede aufgeklappte
         Prompt-Zeile zu. */
      state.advertisers.page = 1; state.library.page = 1; state.prompts.page = 1; state.offen = {};
      persist();
      zeichnen();
      bedarf();
    }
    root.addEventListener("umf-models", function (e) { if (filterSetzen("modelle", auswahl("modelle", e.detail, "model_keys"))) filterGeaendert(); });
    root.addEventListener("umk-markets", function (e) { if (filterSetzen("maerkte", auswahl("maerkte", e.detail, "market_codes"))) filterGeaendert(); });
    root.addEventListener("utf-topics", function (e) {
      var ids = liste(e.detail && e.detail.topic_ids);
      if (filterSetzen("topics", ids.length ? ids : null)) filterGeaendert();
    });
    function kalender() { var k = root.querySelector(".uad-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
    function kalenderLesen() {
      var c = kalender(), r = null;
      try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
      if (!r || !r.from || !r.to) return false;
      var a = filterSetzen("von", r.from), b = filterSetzen("bis", r.to);
      state.filter.preset = r.preset || "";
      state.kalenderDa = true;
      return a || b;
    }
    root.addEventListener("change", function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains("uad-daten")) return;
      var d = e.detail || {};
      if (!d.date_from || !d.date_to) return;
      state.kalenderDa = true;
      var a = filterSetzen("von", d.date_from), b = filterSetzen("bis", d.date_to);
      state.filter.preset = d.preset || "";
      if (a || b) filterGeaendert();
    });
    /* Beim Aufbau und beim Wiederkommen: was zeigen die Filter WIRKLICH? */
    function filterAbgleichen() {
      var g = false;
      g = kalenderLesen() || g;
      var m = root.querySelector(".umf-root"), k = root.querySelector(".umk-root"), tp = root.querySelector(".utf-root");
      try { if (m && m.__umfCtrl) g = filterSetzen("modelle", auswahl("modelle", m.__umfCtrl.getSelected(), "model_keys")) || g; } catch (e) {}
      try { if (k && k.__umkCtrl) g = filterSetzen("maerkte", auswahl("maerkte", k.__umkCtrl.getSelected(), "market_codes")) || g; } catch (e) {}
      try {
        if (tp && tp.__utfCtrl) {
          var ids = liste(tp.__utfCtrl.getSelected().topic_ids);
          g = filterSetzen("topics", ids.length ? ids : null) || g;
        }
      } catch (e) {}
      return g;
    }
    /* Ein Topic aus "Topics with Ads" in den Topic-Filter (Entwurf: Klick -> Ad Library, nach dem
       Topic gefiltert). Ueber den Filter selbst, damit die Leiste den Chip zeigt und "Clear All"
       ihn wieder nimmt: setSelected setzt still, das Ereignis danach ist dasselbe, das ein Klick im
       Filter ausloest -- Leiste und diese Wurzel hoeren beide darauf. */
    function topicWaehlen(id) {
      var tp = root.querySelector(".utf-root"), c = tp && tp.__utfCtrl;
      if (c && c.setSelected) {
        try { c.setSelected(id); } catch (e) {}
        var s = { topic_ids: id, tag_mode: "or" };
        try { s = c.getSelected(); } catch (e2) {}
        try {
          tp.dispatchEvent(new CustomEvent("utf-topics", { bubbles: true,
            detail: { instance_id: idTopics, topic_ids: s.topic_ids, tag_mode: s.tag_mode, count: liste(s.topic_ids).length } }));
        } catch (e3) {}
      }
      /* Ohne Filter-Element (oder wenn das Ereignis nicht ankam) gilt die Auswahl trotzdem. */
      if (filterSetzen("topics", [id])) { state.advertisers.page = 1; state.library.page = 1; state.prompts.page = 1; persist(); }
    }
    function alleFilterZuruecksetzen() {
      /* Ueber die eigenen Wege der Filter, wie "Clear All" der Filterleiste. */
      var fb = root.querySelector(".uad-filterleiste");
      var knopf = fb && fb.querySelector(".ufb-clear, [data-clearall], .ufb-clearall");
      if (knopf) { try { knopf.click(); } catch (e) {} }
      else {
        ["umf-root", "umk-root", "utf-root"].forEach(function (c) {
          var el = root.querySelector("." + c), ctrl = el && (el.__umfCtrl || el.__umkCtrl || el.__utfCtrl);
          try { if (ctrl && ctrl.reset) ctrl.reset(true); } catch (e) {}
        });
      }
      state.adFilter = { advertisers: [], formate: [] };
      state.advertisers.suche = ""; state.library.suche = "";
      persist();
    }

    /* ---- Anfragen an Bubble -------------------------------------------------------------------
       Je RPC ein Kanal: hoechstens EINE Anfrage unterwegs, eine Uhr, die das Warten beendet. */
    var KANAL = {
      overview: { attr: "data-overview-fn", name: "adsOverview", setter: "setAdsOverview", rpc: "get_ads_overview_v1" },
      advertisers: { attr: "data-advertisers-fn", name: "adsAdvertisers", setter: "setAdsAdvertisers", rpc: "list_ads_advertisers_v1" },
      detail: { attr: "data-advertiser-fn", name: "adsAdvertiserDetail", setter: "setAdsAdvertiserDetail", rpc: "get_ads_advertiser_detail_v1" },
      library: { attr: "data-library-fn", name: "adsLibrary", setter: "setAdsLibrary", rpc: "list_ads_library_v1" },
      prompts: { attr: "data-prompts-fn", name: "adsPrompts", setter: "setAdsPrompts", rpc: "list_ads_prompts_v1" },
      optionen: { attr: "data-options-fn", name: "adsFilterOptions", setter: "setAdsFilterOptions", rpc: "get_ads_filter_options_v1" }
    };
    var KANAELE = Object.keys(KANAL);
    var unterwegs = {}, nachzuegler = {};
    KANAELE.forEach(function (k) { unterwegs[k] = null; nachzuegler[k] = 0; });
    function grundBody() {
      var f = state.filter, a = state.adFilter;
      return { p_team_id: team(), p_date_from: f.von || null, p_date_to: f.bis || null,
               p_models: f.modelle && f.modelle.length ? f.modelle.slice() : null,
               p_markets: f.maerkte && f.maerkte.length ? f.maerkte.slice() : null,
               p_topic_ids: f.topics && f.topics.length ? f.topics.slice() : null,
               p_advertisers: a.advertisers && a.advertisers.length ? a.advertisers.slice() : null,
               p_ad_formats: a.formate && a.formate.length ? a.formate.slice() : null };
    }
    function mit(o, extra) { for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k]; return o; }
    function limitOf(tb) { var n = num(tb.pageSize) || 15; return Math.max(1, Math.min(100, Math.round(n))); }
    function offsetOf(tb) { return Math.max(0, ((num(tb.page) || 1) - 1) * limitOf(tb)); }
    function orderOf(name, tb) { return ORDER[name].indexOf(tb.order) >= 0 ? tb.order : ORDER_VORGABE[name]; }
    function suchText(s) { s = str(s).trim(); return s ? s.slice(0, 200) : null; }
    /* Die Signatur ist der Body ohne p_team_id -- das Team wechselt nur mit einem Seitenaufbau. */
    function sigVon(b) {
      var o = {}, k;
      for (k in b) if (k !== "p_team_id" && Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
      return JSON.stringify(o);
    }
    function anfrage(kanal, b) { return { kanal: kanal, body: b, sig: sigVon(b) }; }
    function ovAnfrage() { return anfrage("overview", grundBody()); }
    function advAnfrage() {
      var tb = state.advertisers;
      return anfrage("advertisers", mit(grundBody(), { p_search: suchText(tb.suche), p_limit: limitOf(tb), p_offset: offsetOf(tb), p_sort: orderOf("advertisers", tb) }));
    }
    /* p_advertisers nimmt die RPC an und ignoriert ihn im Detail (Vertrag) -- er geht trotzdem mit,
       damit die Signatur mit dem Advertiser-Filter wechselt wie jede andere Anfrage. */
    function detailAnfrage() { return anfrage("detail", mit(grundBody(), { p_advertiser_name: str(state.advertiser) })); }
    function libAnfrage() {
      var tb = state.library;
      return anfrage("library", mit(grundBody(), { p_search: suchText(tb.suche), p_limit: limitOf(tb), p_offset: offsetOf(tb) }));
    }
    function promptAnfrage() {
      var tb = state.prompts, lb = state.library;
      return anfrage("prompts", mit(grundBody(), { p_search: suchText(lb.suche), p_limit: limitOf(tb), p_offset: offsetOf(tb), p_sort: orderOf("prompts", tb) }));
    }
    /* Die Optionen der zwei Auswahlen haengen nur am Zeitraum (Vertrag). */
    function optAnfrage() { var f = state.filter; return anfrage("optionen", { p_team_id: team(), p_date_from: f.von || null, p_date_to: f.bis || null }); }
    /* Die Ads EINES Prompts (aufgeklappte Zeile): dieselbe Bibliothek mit dem Prompttext als Suche,
       danach auf prompt_id gefiltert (siehe Kopf dieser Datei). */
    function aufAnfrage(p) {
      return anfrage("library", mit(grundBody(), { p_search: suchText(p.text), p_limit: AUF_LIMIT, p_offset: 0 }));
    }
    function bedarfListe() {
      switch (state.seite) {
        case "overview": return [ovAnfrage()];
        case "advertisers": return [advAnfrage()];
        case "advertiser": return state.advertiser ? [detailAnfrage()] : [];
        case "library":
          var l = [optAnfrage()];
          if (state.library.modus === "prompts") {
            l.push(promptAnfrage());
            Object.keys(state.offen).forEach(function (pid) { if (state.offen[pid]) l.push(aufAnfrage(state.offen[pid])); });
          } else l.push(libAnfrage());
          return l;
      }
      return [];
    }
    function sichtbar() {
      if (root.isConnected === false) return false;
      return UC.istSichtbar ? UC.istSichtbar(root) : true;
    }
    function bedarf() {
      if (!sichtbar()) { verdecktPruefen(); return; }
      /* Ohne Kalender keine erste Anfrage: die Zahlen muessen genau seinen Zeitraum haben. Fehlt
         date-range.js ganz, laedt es nach 3s ohne Zeitraum (Vertrag: die letzten 30 Tage). */
      if (!state.kalenderDa && !kalenderLesen() && kalenderWarten()) return;
      bedarfListe().forEach(function (a) {
        if (state.cache[a.kanal][a.sig] || unterwegs[a.kanal]) return;
        if (state.fehler[a.kanal + a.sig]) return;
        senden(a);
      });
    }
    var kalenderVersuche = 0, kalenderUhr = null;
    function kalenderWarten() {
      if (kalenderVersuche >= 20) return false;
      if (!kalenderUhr) kalenderUhr = setTimeout(function () { kalenderUhr = null; kalenderVersuche++; bedarf(); }, 150);
      return true;
    }
    var verdecktUhr = null;
    function verdecktPruefen() {
      if (verdecktUhr || root.isConnected === false) return;
      verdecktUhr = setTimeout(function () { verdecktUhr = null; if (sichtbar()) { filterAbgleichen(); zeichnen(); bedarf(); } else verdecktPruefen(); }, 1000);
    }
    function senden(a) {
      var k = KANAL[a.kanal];
      var u = unterwegs[a.kanal] = { sig: a.sig, body: a.body, uhr: null };
      u.uhr = setTimeout(function () {
        if (unterwegs[a.kanal] !== u) return;
        unterwegs[a.kanal] = null;
        nachzuegler[a.kanal]++;
        state.fehler[a.kanal + a.sig] = "zeit";
        melden("zeit" + a.kanal, "Keine Antwort auf " + k.name + " nach " + (WARTE_MS / 1000) + " s. Ruft der Workflow von " +
          k.name + " am Ende " + k.setter + '("' + instanceId + '", ...) auf?');
        zeichnen();
        bedarf();
      }, WARTE_MS);
      var text = "";
      try { text = JSON.stringify(a.body); } catch (e) { text = ""; }
      fire(k.attr, k.name, text);
    }
    /* WELCHER RPC GEHOERT DIE ANTWORT? Am Inhalt, wo er eindeutig ist (wie Shopping): ein kopierter
       Workflow, der noch den Setter des Originals ruft, legt die Antwort sonst in den falschen Kanal.
       Leere Listen sind fuer Advertisers, Library und Prompts gleich -- dort gilt der Setter. */
    function kanalVon(d) {
      if (!d || typeof d !== "object") return null;
      if (objOder(d.advertiser) || objOder(d.summary)) return "detail";
      if (objOder(d.kpis) || isArr(d.advertiser_share) || isArr(d.recent_ads)) return "overview";
      if (isArr(d.ad_formats) && !isArr(d.items)) return "optionen";
      if (isArr(d.items) && d.items.length) {
        var x = d.items[0] || {};
        if ("ad_coverage_pct" in x || "total_runs" in x || "last_ad_seen" in x) return "prompts";
        if ("ad_format" in x || "prompt_run_id" in x || "title" in x) return "library";
        if ("prompt_count" in x || "relationship" in x || "markets" in x) return "advertisers";
      }
      return null;
    }
    var gemeldet = {};
    function melden(schluessel, text) {
      if (gemeldet[schluessel]) return;
      gemeldet[schluessel] = true;
      if (window.console) console.warn("[ads] " + text);
    }
    function antwort(kanal, raw, f) {
      var d = objekt(raw), echt = kanalVon(d);
      if (echt && echt !== kanal) {
        melden("kanal" + kanal + echt, KANAL[kanal].setter + " bekam die Antwort von " + KANAL[echt].rpc + ". Im Workflow von " +
          KANAL[echt].name + " muss der Run-JS-Schritt " + KANAL[echt].setter + " rufen. Die Antwort ist trotzdem richtig zugeordnet.");
        kanal = echt;
      }
      var u = unterwegs[kanal], ziel = u;
      if (!ziel) {
        var l = bedarfListe().filter(function (a) { return a.kanal === kanal; });
        ziel = l.length ? l[0] : null;
        if (!ziel && d) melden("ohne" + kanal, KANAL[kanal].setter + " bekam eine Antwort, ohne dass die offene Seite sie braucht -- sie wird nicht angezeigt.");
      }
      var ok = d && pruefen(kanal, d);
      if (ok && ziel && nachzuegler[kanal] > 0 && !passtZu(d, ziel.body)) {
        nachzuegler[kanal]--;
        return false;
      }
      if (u) { clearTimeout(u.uhr); unterwegs[kanal] = null; }
      var sig = ziel ? ziel.sig : null;
      if (sig) {
        if (ok) { delete state.fehler[kanal + sig]; merken(kanal, sig, d); }
        else state.fehler[kanal + sig] = fehlerCode(f) || (str(raw).trim() ? "x" : "leer");
      }
      persist();
      zeichnen();
      bedarf();
      return !!ok;
    }
    /* NACHZUEGLER (wie Shopping): nur nach einer abgelaufenen Uhr wird gegen die Anfrage geprueft --
       was die Antwort mitbringt (limit, offset der Listen). Fehlt es, gilt sie als passend. */
    function passtZu(d, body) {
      if (!body) return true;
      if (num(d.limit) != null && num(body.p_limit) != null && num(d.limit) !== num(body.p_limit)) return false;
      if (num(d.offset) != null && num(body.p_offset) != null && num(d.offset) !== num(body.p_offset)) return false;
      return true;
    }
    /* Was eine Antwort mindestens tragen muss, um als gelesen zu gelten. */
    function pruefen(kanal, d) {
      if (kanal === "overview") return !!(objOder(d.kpis) || isArr(d.trend) || isArr(d.recent_ads));
      if (kanal === "detail") return !!(objOder(d.advertiser) || objOder(d.summary));
      if (kanal === "optionen") return isArr(d.advertisers) || isArr(d.ad_formats) || isArr(d.models);
      return isArr(d.items);
    }
    function merken(kanal, sig, d) {
      var c = state.cache[kanal], r = state.reihe[kanal];
      c[sig] = d;
      domainsLernen(d);
      var i = r.indexOf(sig);
      if (i >= 0) r.splice(i, 1);
      r.push(sig);
      while (r.length > CACHE_MAX) { var alt = r.shift(); delete c[alt]; }
    }
    function nochmal(kanal) {
      bedarfListe().forEach(function (a) { if (!kanal || a.kanal === kanal) delete state.fehler[a.kanal + a.sig]; });
      zeichnen(); bedarf();
    }

    /* ---- Was die offene Seite gerade hat ------------------------------------------------------ */
    function daten(a) { return a ? state.cache[a.kanal][a.sig] || null : null; }
    function fehlerVon(a) { return a ? state.fehler[a.kanal + a.sig] || null : null; }

    /* ---- Advertiser: Beziehung und Logo ---------------------------------------------------------
       relationship und logo_url liefern nur die Advertiser-Liste und das Detail (Vertrag: "kommen nur
       ueber team_company bzw. company"). Die Ad-Objekte tragen nur company_id. Also: zuerst, was eine
       geladene Antwort zu diesem Namen sagt, sonst der Markenspeicher der App mit derselben
       company_id (dieselbe Quelle: die getrackten Marken des Teams). Aus Namen wird nichts abgeleitet. */
    /* ---- Advertiser: Domain, fuer das Favicon statt des Anfangsbuchstabens ------------------------
       Die Advertiser-Objekte der RPCs tragen (Stand 05.10.) keine Domain -- nur die Ads tragen ihre
       landing_domain, das Detail seine landing_domains. Ein Werbetreibender ohne getrackte Firma
       (company_id null, also auch logo_url null) stand deshalb ueberall als Buchstabe. Bis die RPCs
       ein Feld "domain" liefern (DB-Auftrag bubble/ads_db_auftrag.md), gilt: ein geliefertes
       domain/advertiser_domain an einem Advertiser-Objekt, sonst die Landing-Domain, die bei seinen
       geladenen Ads am haeufigsten steht. Gelernt einmal beim Merken einer Antwort, nicht bei
       jedem Zeichnen. Liefert die RPC das Feld spaeter, gewinnt es ohne Aenderung hier. */
    function domainsLernen(d) {
      if (!d || typeof d !== "object") return;
      var D = state.domains;
      function eintrag(n) { return D[n] || (D[n] = { fest: "", z: {} }); }
      function host(v) { var h = str(v).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[\/?#]/)[0]; return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) ? h : ""; }
      function advObjekt(x, nameFeld) {
        if (!x || typeof x !== "object") return;
        var n = str(x[nameFeld]).trim(), h = host(x.domain || x.advertiser_domain);
        if (!h && isArr(x.landing_domains)) h = host(x.landing_domains[0]);
        if (n && h) eintrag(n).fest = h;
      }
      function ads(l) {
        (isArr(l) ? l : []).forEach(function (a) {
          if (!a || typeof a !== "object") return;
          var n = str(a.advertiser_name).trim(), h = host(a.landing_domain);
          if (n && h) { var e = eintrag(n); e.z[h] = (e.z[h] || 0) + 1; }
        });
      }
      ads(d.recent_ads); ads(d.ads);
      if (isArr(d.items)) d.items.forEach(function (x) {
        if (x && typeof x === "object" && x.landing_domain != null) ads([x]); else advObjekt(x, "advertiser_name");
      });
      (isArr(d.advertiser_share) ? d.advertiser_share : []).forEach(function (x) { advObjekt(x, "advertiser_name"); });
      (isArr(d.advertisers) ? d.advertisers : []).forEach(function (x) { advObjekt(x, "value"); });
      if (objOder(d.advertiser)) advObjekt(d.advertiser, "advertiser_name");
    }
    function domainVon(n) {
      var e = state.domains[str(n).trim()];
      if (!e) return "";
      if (e.fest) return e.fest;
      var best = "", max = 0;
      for (var h in e.z) if (Object.prototype.hasOwnProperty.call(e.z, h) && e.z[h] > max) { max = e.z[h]; best = h; }
      return best;
    }
    function advInfo(name, companyId) {
      var n = str(name).trim(), cid = str(companyId).trim(), out = { beziehung: null, logo: "" };
      function aus(x) {
        if (!x || typeof x !== "object" || str(x.advertiser_name).trim() !== n) return false;
        var r = str(x.relationship).trim();
        if (r === "you" || r === "competitor") out.beziehung = r;
        if (!out.logo) out.logo = sichereUrl(x.logo_url);
        return true;
      }
      var i, j, sigs;
      sigs = state.reihe.advertisers;
      for (i = sigs.length - 1; i >= 0 && !out.logo; i--) {
        var d = state.cache.advertisers[sigs[i]], l = d && isArr(d.items) ? d.items : [];
        for (j = 0; j < l.length; j++) if (aus(l[j])) break;
      }
      sigs = state.reihe.detail;
      for (i = sigs.length - 1; i >= 0 && !out.logo; i--) {
        var dd = state.cache.detail[sigs[i]];
        if (dd && objOder(dd.advertiser)) aus(dd.advertiser);
      }
      if (cid && (!out.beziehung || !out.logo)) {
        var b = (UC.getBrands ? UC.getBrands() : []).filter(function (x) { return x && str(x.company_id) === cid; })[0];
        if (b) {
          if (!out.beziehung) out.beziehung = (b.role === "own" || b.is_own === true) ? "you" : "competitor";
          if (!out.logo) out.logo = sichereUrl(b.logo_url);
        }
      }
      if (!out.logo && UC.faviconUrl) out.logo = UC.faviconUrl(domainVon(n));
      return out;
    }
    /* Die Logo-Kachel der Tabellen (.up-logo-box). Ein geliefertes Logo gewinnt, sonst was advInfo
       kennt (Marken-Store, dann das Favicon der Domain), erst danach der Buchstabe. */
    /* Ohne Logo das Zeichen der Werbetreibenden (BankIcon, 06.10. angefordert) statt des
       Anfangsbuchstabens -- in jeder Kachel der Seite: Tabelle, Balken, Karte, Auswahl, Drawer. */
    var ADV_ZEICHEN = "bank";
    function advLogo(name, logo, companyId) {
      var n = str(name).trim(), u = sichereUrl(logo) || advInfo(n, companyId).logo;
      var ltr = '<span class="up-logo-zeichen">' + UC.icon(ADV_ZEICHEN, 2) + '</span>';
      return u ? '<span class="up-logo-box has-img"><img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' + ltr + '</span>'
               : '<span class="up-logo-box">' + ltr + '</span>';
    }
    function beziehungsMarke(r) {
      if (r === "you") return '<span class="up-marke up-you">' + esc(t("You")) + '</span>';
      if (r === "competitor") return '<span class="up-marke is-leise">' + esc(t("Competitor")) + '</span>';
      return "";
    }
    function hl(text, q) { return q && UC.highlight ? UC.highlight(text, q) : esc(text); }

    /* Jedes gezeichnete Ad-Objekt nach seiner Id -- der Drawer liest daraus, was er zeigt. */
    var adIndex = {};
    function adMerken(ad) { var id = str(ad && ad.id).trim(); if (id) adIndex[id] = ad; return id; }
    function karte(ad, q) {
      adMerken(ad);
      var i = advInfo(ad.advertiser_name, ad.company_id);
      return UC.adCardHtml ? UC.adCardHtml(ad, { logo: i.logo, beziehung: i.beziehung, q: q, zeichen: ADV_ZEICHEN }) : "";
    }
    function gueltigeAds(l) { return (isArr(l) ? l : []).filter(function (x) { return x && typeof x === "object" && str(x.id).trim(); }); }

    /* ---- Navigation ---------------------------------------------------------------------------- */
    function seiteOeffnen(s, neuerEintrag, extra) {
      if (!SEITE_OK[s]) s = "overview";
      state.seite = s;
      if (s !== "advertiser") state.advertiser = null;
      if (extra) {
        if (extra.advertiser != null) state.advertiser = str(extra.advertiser).trim() || null;
        if (extra.modus) { state.library.modus = extra.modus; state.library.page = 1; state.prompts.page = 1; }
      }
      if (s === "advertiser" && !state.advertiser) s = state.seite = "advertisers";
      persist();
      adresseSetzen(neuerEintrag);
      if (nav && nav.selectPage) nav.selectPage(s === "advertiser" ? "advertisers" : s, false);
      geruest = null;
      zeichnen();
      krumenNeu();
      try { var m = document.getElementById("main"); if (neuerEintrag && m) m.scrollTop = 0; } catch (e) {}
      bedarf();
    }
    function advertiserOeffnen(name) {
      name = str(name).trim();
      if (!name) return;
      seiteOeffnen("advertiser", true, { advertiser: name });
    }
    function adresseAnwenden() {
      var a = adresseLesen();
      if (a.seite === state.seite && a.advertiser === state.advertiser) return;
      state.seite = a.seite; state.advertiser = a.advertiser;
      if (nav && nav.selectPage) nav.selectPage(a.seite === "advertiser" ? "advertisers" : a.seite, false);
      geruest = null;
      zeichnen(); krumenNeu(); bedarf();
    }
    window.addEventListener("popstate", function () { if (root.isConnected) adresseAnwenden(); });
    /* Prompt Detail ist in der App der Prompt-Drawer (Entwurf: "navigation to the existing Prompt
       Detail"). Der eigene Drawer geht vorher zu: er liegt unter den Drawern der App. */
    function promptOeffnen(id) {
      id = str(id).trim();
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return;
      if (drawer && drawer.isOpen()) drawer.close();
      if (UC.drawerOeffnen) UC.drawerOeffnen("prompt", id, "ads");
    }
    /* Der Response-Drawer der App, mit der prompt_run_id der Ad. Der eigene Drawer schliesst vorher,
       wie beim Prompt: zwei Seitenfluegel uebereinander verdecken sich gegenseitig. */
    function antwortOeffnen(id) {
      id = str(id).trim();
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return;
      if (drawer && drawer.isOpen()) drawer.close();
      if (UC.drawerOeffnen) UC.drawerOeffnen("response", id, "ads");
    }

    /* ============================================================================================
       Zeichnen
       ============================================================================================ */
    var geruest = null, linie = null, pager = {}, sucheKit = {}, sortKit = {}, balken = null, spalten = {},
        advFilter = null, fmtFilter = null;
    function geruestSchluessel() {
      var s = state.seite;
      return s === "library" ? s + "|" + state.library.modus + "|" + (state.library.modus === "ads" ? state.library.ansicht : "") : s;
    }
    function zeichnen() {
      if (root.isConnected === false) return;
      var g = geruestSchluessel();
      if (geruest !== g) baueGeruest();
      var s = state.seite;
      if (s === "overview") zeichneOverview();
      else if (s === "advertisers") zeichneAdvertisers();
      else if (s === "advertiser") zeichneDetail();
      else if (s === "library") zeichneLibrary();
    }
    function aufraeumen() {
      if (linie && linie.destroy) { try { linie.destroy(); } catch (e) {} }
      linie = null; pager = {}; sucheKit = {}; sortKit = {}; balken = null; spalten = {}; advFilter = null; fmtFilter = null;
    }
    function sek(name) { return elMain.querySelector('[data-sek="' + name + '"]'); }
    /* Der Abschnittskopf des Entwurfs ist die Werkzeugzeile aus core (.up-head): Ueberschrift 14/500,
       Punkt und Zahl (.up-heading.has-count), Werkzeuge rechts (Komponenten-Abbildung im Entwurf). */
    function kopf(titel, o) {
      o = o || {};
      var mitZahl = o.zahl != null && o.zahl !== "";
      return '<div class="up-head uad-head">' +
        '<span class="up-heading uad-heading' + (mitZahl ? " has-count" : "") + '"><span class="up-head-label">' + esc(t(titel)) + '</span>' +
          (o.info ? info(o.info) : '') +
          '<span class="up-head-sep"></span><span class="up-head-count">' + (mitZahl ? esc(o.zahl) : '') + '</span></span>' +
        '<div class="up-head-tools uad-tools">' + (o.tools || '') + '</div>' +
      '</div>';
    }
    function zahlSetzen(el, n) {
      var h = el && el.querySelector(".uad-heading"), z = el && el.querySelector(".up-head-count");
      if (!h || !z) return;
      h.classList.toggle("has-count", num(n) != null);
      z.textContent = num(n) != null ? ganz(n) : "";
    }
    /* "View all", "Open Ad Library": der leise Knopf aus core (.up-quietbtn) mit Pfeil (Entwurf). */
    function leiserKnopf(text, attr) {
      return '<button type="button" class="up-quietbtn uad-mehr" ' + attr + '><span>' + esc(t(text)) + '</span>' + UC.icon("arrowRight", 2) + '</button>';
    }
    function segHtml(klasse, werte, aktiv, nurZeichen) {
      return '<div class="up-seg ' + klasse + '" role="group">' + werte.map(function (w) {
        return '<button type="button" class="up-seg-btn' + (w[0] === aktiv ? " is-active" : "") + '" data-wert="' + esc(w[0]) + '"' +
          (nurZeichen ? ' aria-label="' + esc(t(w[1])) + '" data-tip="' + esc(t(w[1])) + '">' + UC.icon(w[2], 2) : '>' + esc(t(w[1]))) + '</button>';
      }).join("") + '</div>';
    }
    function segSetzen(el, aktiv) {
      if (!el) return;
      var b = el.querySelectorAll(".up-seg-btn");
      for (var i = 0; i < b.length; i++) b[i].classList.toggle("is-active", b[i].getAttribute("data-wert") === aktiv);
      if (UC.segJetzt) { try { UC.segJetzt(el); } catch (e) {} }
    }
    function chartHtml() { return '<div class="up-box uad-chartbox"><div class="uad-linewrap"><canvas></canvas></div></div>'; }
    function spaltenKnopf() {
      return '<div class="up-cols">' +
        '<button type="button" class="up-iconbtn up-cols-btn" data-tip="' + esc(t("Table Settings")) + '" aria-label="' + esc(t("Table settings")) + '">' +
          UC.icon("settings", 2) + '<span class="up-badge uad-cols-badge"></span></button>' +
        '<div class="up-menu up-cols-menu" role="menu" aria-hidden="true"></div></div>';
    }
    function sucheHtml(platzhalter, label) {
      return '<div class="up-search uad-suche">' +
        '<button type="button" class="up-iconbtn up-search-btn" aria-label="' + esc(t("Search")) + '" data-tip="' + esc(t("Search")) + '">' + UC.icon("search", 2) + '</button>' +
        '<div class="up-search-box">' +
          '<input class="up-search-input" type="text" placeholder="' + esc(t(platzhalter)) + '" autocomplete="off" spellcheck="false" aria-label="' + esc(t(label)) + '" maxlength="200"/>' +
          '<button type="button" class="up-search-clear" aria-label="' + esc(t("Clear search")) + '">' + UC.icon("x", 2.2) + '</button>' +
        '</div></div>';
    }
    /* Ein Abschnitt mit Tabelle, Werkzeugen und Pager -- eine eigene .up-root wie in Shopping: die
       Suchuebernahme aus core (offene Suche nimmt schmal die ganze Kopfzeile) haengt an ".up-root". */
    function fussHtml() {
      return '<div class="up-foot uad-foot">' +
          '<div class="up-pagesize"><span class="up-pagesize-lbl">' + esc(t("Rows per page")) + '</span>' +
            '<div class="up-pagesize-seg" role="group" aria-label="' + esc(t("Rows per page")) + '"></div></div>' +
          '<div class="up-pager"></div>' +
        '</div>';
    }
    function tabSek(titel, werkzeuge, ohnePager, sekName) {
      return '<section class="up-root uad-sek uad-tab" data-sek="' + (sekName || "tabelle") + '">' +
        kopf(titel, { tools: werkzeuge }) +
        '<div class="up-root uad-tabwurzel"><div class="uad-tabelle"></div></div>' +
        (ohnePager ? '' : fussHtml()) +
      '</section>';
    }
    function baueGeruest() {
      aufraeumen();
      var s = state.seite, html = "";
      if (s === "overview") {
        html = '<div class="uad-seite" data-seite="overview">' +
          '<div class="uad-gruppe">' +
            '<div class="up-box up-kpiband is-4 uad-kpis" data-sek="kpis"></div>' +
            '<section class="uad-sek" data-sek="chart">' + kopf("Ad Coverage") + chartHtml() + '</section>' +
          '</div>' +
          '<div class="uad-zwei">' +
            '<section class="uad-sek" data-sek="anteil">' + kopf("Advertiser Share", { info: "share", tools: leiserKnopf("View all", 'data-uad-ziel="advertisers"') }) +
              '<div class="up-box uad-balkenbox"><div class="uad-balkenplatz"></div></div></section>' +
            /* Topics with Ads als ganze Tabelle wie alle anderen (06.10. angefordert): Suche und
               Zahnrad in der Kopfzeile, Seiten darunter. */
            tabSek("Topics with Ads", sucheHtml("Search topics…", "Search topics") + spaltenKnopf(), false, "topics") +
          '</div>' +
          '<section class="uad-sek" data-sek="recent">' + kopf("Recent Ads", { tools: leiserKnopf("Open Ad Library", 'data-uad-ziel="library"') }) +
            '<div class="uad-karten"></div></section>' +
        '</div>';
      } else if (s === "advertisers") {
        html = '<div class="uad-seite" data-seite="advertisers">' +
          tabSek("Advertisers", sucheHtml("Search advertisers…", "Search advertisers") + spaltenKnopf()) +
        '</div>';
      } else if (s === "advertiser") {
        html = '<div class="uad-seite" data-seite="advertiser">' +
          '<div class="uad-gruppe">' +
            '<div data-sek="held"></div>' +
            '<div class="up-box up-kpiband is-4 uad-kpis" data-sek="kpis"></div>' +
            '<section class="uad-sek" data-sek="chart">' + kopf("Activity", { tools: segHtml("uad-metrik", [["n", "Appearances"], ["share", "Ad Share"]], state.dMetrik) }) + chartHtml() + '</section>' +
          '</div>' +
          '<section class="uad-sek" data-sek="dprompts">' + kopf("Prompts") + '<div class="uad-vorschauplatz"></div></section>' +
          '<section class="uad-sek" data-sek="dads"></section>' +
        '</div>';
      } else if (s === "library") {
        var lb = state.library, istAds = lb.modus !== "prompts";
        var werkzeuge = '<span class="uad-advplatz"></span><span class="uad-fmtplatz"></span>' +
          segHtml("uad-modus", [["ads", "Ads"], ["prompts", "Prompts"]], istAds ? "ads" : "prompts") +
          (istAds ? segHtml("uad-ansicht", [["grid", "Grid", "layoutGrid"], ["list", "List", "listIcon"]], lb.ansicht, true) : '') +
          sucheHtml(istAds ? "Search ads, advertisers, campaigns…" : "Search prompts…", istAds ? "Search ads" : "Search prompts") +
          (istAds && lb.ansicht === "grid" ? '' : spaltenKnopf());
        html = '<div class="uad-seite" data-seite="library">' + tabSek(istAds ? "Ads" : "Prompts", werkzeuge) + '</div>';
      }
      elMain.innerHTML = html;
      geruest = geruestSchluessel();
      var lw = elMain.querySelector(".uad-linewrap");
      if (lw && UC.makeLine) {
        linie = UC.makeLine({
          wrap: lw, canvas: lw.querySelector("canvas"), legend: null,
          isDark: isDark, gran: function () { return "day"; },
          unit: function () { return state.seite === "advertiser" && state.dMetrik === "n" ? "" : "%"; },
          decimals: function () { return state.seite === "advertiser" && state.dMetrik === "n" ? 0 : 1; },
          yOhneDeckel: function () { return state.seite === "advertiser" && state.dMetrik === "n"; },
          yGanz: function () { return state.seite === "advertiser" && state.dMetrik === "n"; },
          tipLabel: function () { return t(state.seite === "advertiser" ? (state.dMetrik === "n" ? "Ad Appearances" : "Ad Share") : "Ad Coverage") + ":"; },
          markers: false
        });
      }
      var seg = elMain.querySelector(".uad-metrik");
      if (seg) seg.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-wert]");
        if (!b) return;
        state.dMetrik = b.getAttribute("data-wert") === "share" ? "share" : "n";
        persist(); segSetzen(seg, state.dMetrik); zeichneDetailChart();
      });
      var tab = sek("tabelle");
      if (tab) tabelleVerdrahten(tab);
      var tsek = s === "overview" ? sek("topics") : null;
      if (tsek) topicsVerdrahten(tsek);
    }

    /* ---- Tabellen-Bausteine (wie Shopping) ----------------------------------------------------- */
    function th(text, o) {
      o = o || {};
      return '<div class="up-th' + (o.sort ? " is-sortable" : "") + (o.k ? " " + o.k : "") + '"' + (o.sort ? ' data-sort="' + esc(o.sort) + '"' : '') + '>' +
        '<span class="up-th-txt">' + esc(t(text)) + '</span>' + (o.info ? info(o.info) : '') +
        (o.sort ? '<span class="up-thsort" data-for="' + esc(o.sort) + '">' +
          '<svg class="up-thsort-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15"/></svg>' +
          '<svg class="up-thsort-down" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9"/></svg></span>' : '') +
        '</div>';
    }
    function tabelleHtml(kopfHtml, zeilen, klasse) {
      return '<div class="up-box uad-box' + (klasse ? " " + klasse : "") + '">' +
        '<div class="up-colscroll"><div class="up-colscroll-innen">' +
          '<div class="up-thead">' + kopfHtml + '</div>' +
          '<div class="up-tbody">' + zeilen + '</div>' +
        '</div></div></div>';
    }
    /* Die Spalten jeder Tabelle laufen ueber UC.makeColumns wie in Shopping: Ziehgriff an der ersten
       Spalte, bei Tabellen mit Werkzeugleiste das Zahnrad, und nie faellt eine Spalte der Breite
       wegen weg (cfg.scrollen): ist es zu eng, scrollt der Kasten, die erste Spalte bleibt stehen.
       Mindestbreiten aus den festen Rastern des Entwurfs. prio: die kleinste faellt zuerst. */
    function sp(key, label, min, fr, prio, sk, o) {
      o = o || {};
      return { key: key, label: label, w: "minmax(" + min + "px," + fr + "fr)", min: min, prio: prio, sk: sk, sort: o.sort, info: o.info };
    }
    var TABELLEN = {
      advertisers: { erste: { label: "Advertiser", min: 240, sort: "advertiser_name", sk: { w: 120, logo: true } }, spalten: [
        sp("share", "Ad Share", 130, 1.1, 90, 60, { sort: "ad_appearances", info: "share" }),
        sp("n", "Appearances", 132, 1, 85, 30, { sort: "ad_appearances", info: "appearances" }),
        sp("prompts", "Prompts", 104, 0.8, 70, 30, { sort: "prompt_count" }),
        sp("topics", "Topics", 100, 0.8, 60, 30, { sort: "topic_count" }),
        /* 150: zwei Markt-Chips (Flagge 18, Code, Abstand 10) und "+N" muessen nebeneinander passen. */
        sp("markets", "Markets", 150, 1, 40, 50),
        sp("formats", "Formats", 140, 1, 30, 60),
        sp("first", "First Seen", 120, 0.9, 20, 60, { sort: "first_seen" }),
        sp("last", "Last Seen", 120, 0.9, 50, 60, { sort: "last_seen" })] },
      topics: { erste: { label: "Topic", min: 180, sort: "topic_name", sk: { w: 110 } }, spalten: [
        sp("cov", "Ad Coverage", 140, 1, 90, 60, { sort: "ad_coverage", info: "coverage" }),
        sp("advs", "Advertisers", 112, 0.8, 80, 30, { sort: "advertiser_count" }),
        sp("n", "Appearances", 122, 0.8, 70, 30, { sort: "ad_appearances" })] },
      dprompts: { erste: { label: "Prompt", min: 280, sk: { w: 180 } }, spalten: [
        sp("topic", "Topic", 160, 1.2, 60, 80),
        sp("n", "Appearances", 122, 0.8, 90, 30),
        sp("last", "Last Seen", 112, 0.8, 70, 60),
        sp("organic", "Organic Context", 220, 1.3, 80, 120, { info: "organic" })] },
      liste: { erste: { label: "Ad", min: 300, sk: { w: 170, logo: true } }, spalten: [
        sp("format", "Format", 110, 0.8, 70, 60),
        sp("price", "Price", 100, 0.8, 50, 50),
        sp("model", "Model", 170, 1, 80, { w: 80, logo: true }),
        sp("prompt", "Prompt", 220, 1.8, 40, 120),
        sp("seen", "Observed", 112, 0.8, 90, 60)] },
      lprompts: { erste: { label: "Prompt", min: 300, sort: "prompt_text", sk: { w: 180 } }, spalten: [
        sp("topic", "Topic", 160, 1.2, 60, 80),
        sp("cov", "Ad Coverage", 144, 1, 90, 60, { sort: "ad_coverage", info: "coverage" }),
        sp("advs", "Advertisers", 126, 0.8, 70, 30, { sort: "advertiser_count" }),
        sp("n", "Appearances", 132, 0.8, 80, 30, { sort: "ad_appearances" }),
        sp("last", "Last Ad Seen", 132, 0.9, 50, 60, { sort: "last_ad_seen" })] }
    };
    function kopfAus(name) {
      var d = TABELLEN[name];
      return th(d.erste.label, { sort: d.erste.sort }) + d.spalten.map(function (c) {
        return th(c.label, { k: "up-th-" + c.key, sort: c.sort, info: c.info });
      }).join("");
    }
    function skelettZeilen(n, sp2) { return UC.skeletonRows ? UC.skeletonRows({ count: n, rowClass: "up-row", cellClass: "up-td", cols: sp2 }) : ""; }
    function skelettAus(name, n) {
      var d = TABELLEN[name];
      return skelettZeilen(n, [d.erste.sk].concat(d.spalten.map(function (c) {
        var o = c.sk && typeof c.sk === "object" ? mit({}, c.sk) : { w: c.sk };
        o.cls = "up-td-" + c.key;
        return o;
      })));
    }
    function td(key, html) { return '<div class="up-td up-td-' + key + '">' + html + '</div>'; }
    function leerZelle() { return '<span class="up-num is-empty">–</span>'; }
    function dichteSchluessel(name) { return "uad_dense__" + instanceId + "__" + name; }
    function spaltenFuer(name, wurzel) {
      var e = spalten[name];
      if (e && e.wurzel === wurzel) return e;
      if (!UC.makeColumns || !wurzel) return null;
      var d = TABELLEN[name], st = { cols: {}, widths: {}, dense: false };
      var mitMenue = !!wurzel.querySelector(".up-cols-menu");
      var kit = UC.makeColumns({
        root: wurzel, state: st, columns: d.spalten, storePrefix: "uad", instanceId: instanceId + "__" + name,
        firstKey: "erste", firstMin: d.erste.min, noActions: true, scrollen: true,
        dense: mitMenue, badgeSel: ".uad-cols-badge", cellPrefixes: ["up"]
      });
      st.cols = kit.readCols(); st.widths = kit.readWidths();
      if (mitMenue) {
        try { st.dense = window.localStorage.getItem(dichteSchluessel(name)) === "1"; } catch (x) {}
        wurzel.classList.toggle("is-dense", st.dense);
      }
      e = spalten[name] = { wurzel: wurzel, kit: kit, st: st };
      wurzel.__uadSpalten = e;
      return e;
    }
    function dichteSetzen(name, an) {
      var e = spalten[name];
      if (!e) return;
      e.st.dense = !!an;
      try { window.localStorage.setItem(dichteSchluessel(name), an ? "1" : "0"); } catch (x) {}
      e.wurzel.classList.toggle("is-dense", !!an);
    }
    function spaltenAnwenden(name) {
      var e = spalten[name];
      if (!e) return;
      try { e.kit.applyCols(); e.kit.syncColsBadge(); } catch (x) {}
    }
    /* Die Vorschau-Tabellen ohne Werkzeugleiste (Topics with Ads, Prompts im Detail): Kopf einmal,
       darunter eine eigene Wurzel fuer das Kit, dicht (55) wie die Vorschauen in Shopping. */
    function vorschauPlatz(el, name) {
      var platz = el.querySelector(".uad-vorschauplatz");
      if (!platz.querySelector(".uad-vorschau")) platz.innerHTML = '<div class="up-root uad-vorschau is-dense"><div class="uad-tabelle"></div></div>';
      var w = platz.querySelector(".uad-vorschau");
      spaltenFuer(name, w);
      return w.querySelector(".uad-tabelle");
    }
    function fehlerKasten(a, was) {
      var code = fehlerVon(a);
      var titel = was === "detail" ? "This advertiser could not be loaded" : "Ads data could not be loaded";
      var text = code === "leer" || code === "x" ? "The data could not be read. Please reload the page." : fehlerText(code);
      return UC.leerHtml({ icon: "info", titel: titel, text: text, knopf: "Try again", knopfAttr: 'data-uad-nochmal="' + esc(a.kanal) + '"' });
    }
    function kpiHtml(o) {
      o.klasse = (o.klasse ? o.klasse + " " : "") + "uad-kpi";
      return UC.kpiKarte ? UC.kpiKarte(o) : "";
    }
    function kpiSkelett(n) { var h = ""; for (var i = 0; i < n; i++) h += UC.kpiKarteSkelett ? UC.kpiKarteSkelett("uad-kpi") : ""; return h; }
    /* Die Kacheln zaehlen hoch wie in Shopping, Events und dem Agentic Dashboard (UC.zaehlHtml und
       UC.hochzaehlen) -- einmal je Wert und Ort. */
    function hochzaehlen(el) { if (UC.hochzaehlen) UC.hochzaehlen(el, "ads|" + instanceId + "|" + state.seite + "|" + (state.advertiser || "")); }
    function zaehlWert(art, v) {
      v = art === "pct" ? anteilWert(v) : anzahlWert(v);
      if (v == null) return leerZelle();
      return UC.zaehlHtml ? UC.zaehlHtml(v, art === "pct" ? "pct1" : "int") : '<span class="up-num">' + esc(art === "pct" ? pct(v) : ganz(v)) + '</span>';
    }
    function erklaerAnLabels(el, keys) {
      if (!el) return;
      var l = el.querySelectorAll(".up-kpi-label");
      for (var i = 0; i < l.length && i < keys.length; i++) if (keys[i]) l[i].insertAdjacentHTML("beforeend", info(keys[i]));
    }
    function ringHtml(v) {
      v = anteilWert(v);
      if (v == null) return leerZelle();
      return '<span class="up-num">' + esc(pct(v)) + '</span>' + (UC.variationRing ? UC.variationRing(v) : '');
    }
    function ganzHtml(v) { v = anzahlWert(v); return v == null ? leerZelle() : '<span class="up-num">' + esc(ganz(v)) + '</span>'; }
    function datumHtml(v) { var d = datum(v); return d === "–" ? leerZelle() : '<span class="up-num">' + esc(d) + '</span>'; }
    function linienDaten(tr, feld, art) {
      return tr.map(function (x) { var v = art === "pct" ? anteilWert(x[feld]) : anzahlWert(x[feld]); return v; });
    }
    function trendTage(tr) {
      return (isArr(tr) ? tr : []).filter(function (x) { return x && typeof x === "object" && /^\d{4}-\d{2}-\d{2}/.test(str(x.date)); });
    }

    /* ============================================================================================
       Overview
       ============================================================================================ */
    function zeichneOverview() {
      var a = ovAnfrage(), d = daten(a);
      var fe = !d && fehlerVon(a);
      if (fe) {
        /* Ein Fehler steht EINMAL, an der Stelle der Kennzahlen; der Rest traegt dann nichts, was
           wie Daten aussieht. */
        sek("kpis").innerHTML = '<div class="uad-kpifehler">' + fehlerKasten(a) + '</div>';
        if (linie) linie.empty(t("Ads data could not be loaded"));
        sek("anteil").querySelector(".uad-balkenplatz").innerHTML = "";
        sek("topics").querySelector(".uad-tabelle").innerHTML = "";
        topicsPager(null);
        sek("recent").querySelector(".uad-karten").innerHTML = "";
        return;
      }
      zeichneOvKpis(d);
      zeichneOvChart(d);
      zeichneAnteil(d);
      zeichneTopics(d);
      zeichneRecent(d);
    }
    function zeichneOvKpis(d) {
      var el = sek("kpis");
      if (!el) return;
      if (!d) { el.innerHTML = kpiSkelett(4); return; }
      var k = objOder(d.kpis) || {};
      var mit_ = anzahlWert(k.prompts_with_ads), getrackt = anzahlWert(k.tracked_prompts);
      var fuss = mit_ != null && getrackt != null && getrackt > 0 ? esc(ersetze(t("{pct} of tracked prompts"), { pct: pct(mit_ / getrackt * 100) })) : "";
      el.innerHTML =
        kpiHtml({ label: "Ad Coverage", wertHtml: zaehlWert("pct", k.ad_coverage_pct) }) +
        kpiHtml({ label: "Advertisers", wertHtml: zaehlWert("int", k.advertisers) }) +
        kpiHtml({ label: "Ad Appearances", wertHtml: zaehlWert("int", k.ad_appearances) }) +
        kpiHtml({ label: "Prompts with Ads", wertHtml: zaehlWert("int", k.prompts_with_ads), fussHtml: fuss });
      erklaerAnLabels(el, ["coverage", "advertisers", "appearances", "prompts"]);
      hochzaehlen(el);
    }
    function linieZeichnen(labels, werte, label) {
      var tinte = UC.accentInk ? UC.accentInk(root) : "#1f1f1b";
      linie.render({ labels: labels, datasets: [{ label: label, __id: "ads", __baseColor: tinte, borderColor: tinte, data: werte }] });
    }
    function zeichneOvChart(d) {
      if (!linie) return;
      if (!d) { linie.skeleton(); return; }
      var tr = trendTage(d.trend);
      /* Ein Tag ohne getrackte Antwort hat keine Coverage (null) -- dort bricht die Linie ab, statt
         eine 0 zu behaupten, die niemand gemessen hat. */
      if (!tr.length || !tr.some(function (x) { return anteilWert(x.ad_coverage_pct) != null; })) { linie.empty(); return; }
      linieZeichnen(tr.map(function (x) { return str(x.date).slice(0, 10); }), linienDaten(tr, "ad_coverage_pct", "pct"), t("Ad Coverage"));
    }
    /* Advertiser Share: die Top 8 als Balkenliste aus core (Model Breakdown in domain-detail). Die
       Balken sind relativ zum ersten (Entwurf: der staerkste fuellt die Spur), der Wert daneben ist
       der echte Anteil. */
    function zeichneAnteil(d) {
      var el = sek("anteil"), platz = el && el.querySelector(".uad-balkenplatz");
      if (!platz) return;
      if (!balken && UC.makeBarList) balken = UC.makeBarList({ mount: platz, isDark: isDark, fmt: function (v) { return pct(v); } });
      if (!balken) return;
      if (!d) { balken.skeleton(6); return; }
      var l = (isArr(d.advertiser_share) ? d.advertiser_share : []).filter(function (x) {
        return x && typeof x === "object" && str(x.advertiser_name).trim() && anteilWert(x.ad_share_pct) != null;
      }).slice(0, 8);
      if (!l.length) { platz.innerHTML = UC.leerHtml({ mini: true, titel: leerSatz() }); balken = null; return; }
      var max = Math.max.apply(null, l.map(function (x) { return anteilWert(x.ad_share_pct); })) || 1;
      balken.render(l.map(function (x, i) {
        var n = str(x.advertiser_name).trim(), info_ = advInfo(n, x.company_id), v = anteilWert(x.ad_share_pct);
        return { key: n, name: n, share: v / max * 100, wert: pct(v), color: UC.balkenGrau ? UC.balkenGrau(i, isDark()) : "#1f1f1b",
                 logo: info_.logo || undefined, zeichen: info_.logo ? undefined : UC.icon(ADV_ZEICHEN, 2) };
      }));
    }
    /* ---- Topics with Ads: Suche, Sortierung, Seiten (06.10.) ------------------------------------
       Alles auf dem Payload der Overview -- er traegt alle Topics im Scope. Vorgabe: Ad Coverage
       absteigend (angefordert: "nach Ad Coverage, nicht nach Werbetreibenden"). */
    var topicsSort = null;
    function topicsSortWert(x, feld) {
      if (feld === "topic_name") return str(x.topic_name).trim().toLowerCase();
      if (feld === "ad_coverage") return anteilWert(x.ad_coverage_pct);
      return anzahlWert(x[feld]);
    }
    function topicsListe(d) {
      var tt = state.topicsTab, q = str(tt.suche).trim().toLowerCase();
      var l = (isArr(d && d.topics) ? d.topics : []).filter(function (x) {
        return x && typeof x === "object" && str(x.topic_name).trim() && (!q || str(x.topic_name).toLowerCase().indexOf(q) >= 0);
      });
      var m = /^(.*)_(asc|desc)$/.exec(tt.order || "") || [null, "ad_coverage", "desc"];
      var feld = m[1], auf = m[2] === "asc";
      return l.map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) {
        var va = topicsSortWert(a.x, feld), vb = topicsSortWert(b.x, feld);
        /* Leere Werte immer ans Ende, gleiche Werte in der Reihenfolge der Lieferung. */
        if (va == null && vb == null) return a.i - b.i;
        if (va == null) return 1;
        if (vb == null) return -1;
        var c = typeof va === "string" ? va.localeCompare(vb) : va - vb;
        return (auf ? c : -c) || (a.i - b.i);
      }).map(function (o) { return o.x; });
    }
    function topicsPager(total) {
      var p = pager.topics, tt = state.topicsTab;
      if (!p) return;
      p.st.page = tt.page || 1; p.st.pageSize = tt.pageSize || GROESSE; p.st.totalCount = total; p.st.loading = false;
      try { p.kit.renderPageSize(); p.kit.renderPager(); } catch (e) {}
      var foot = sek("topics") && sek("topics").querySelector(".uad-foot");
      if (foot) foot.hidden = !(num(total) > 0);
    }
    function topicsNeu() { zeichneTopics(daten(ovAnfrage())); }
    function topicsVerdrahten(el) {
      var tt = state.topicsTab;
      var pst = { page: tt.page || 1, pageSize: tt.pageSize || GROESSE, totalCount: null, loading: false };
      if (UC.makePager) pager.topics = { st: pst, kit: UC.makePager({ root: el, state: pst, onChange: function () {
        tt.page = pst.page; tt.pageSize = pst.pageSize; persist(); topicsNeu();
      } }) };
      var spe = spaltenFuer("topics", el), cw = el.querySelector(".up-cols");
      if (spe && cw && UC.makePopover) {
        var cm = cw.querySelector(".up-cols-menu"), cb = cw.querySelector(".up-cols-btn");
        var cpop = UC.makePopover({ wrap: cw, menu: cm, opener: cb, group: "uad-" + instanceId });
        cb.addEventListener("click", function (e) {
          e.stopPropagation();
          if (cpop.isOpen()) { cpop.close(false); return; }
          spe.kit.populateCols(); cpop.open();
        });
        cm.addEventListener("click", function (e) {
          if (e.target.closest("[data-colsall]")) { spe.kit.selectAllCols(); return; }
          var dn = e.target.closest("[data-dense]");
          if (dn) { dichteSetzen("topics", dn.getAttribute("data-dense") === "1"); spe.kit.populateCols(); return; }
          var cr = e.target.closest("[data-col]");
          if (cr) spe.kit.toggleCol(cr.getAttribute("data-col"));
        });
        spe.kit.syncColsBadge();
      }
      if (UC.makeHeadSort) {
        var sst = { sortField: "", sortDir: "" }, m0 = /^(.*)_(asc|desc)$/.exec(tt.order || "ad_coverage_desc");
        sst.sortField = m0 ? m0[1] : "ad_coverage"; sst.sortDir = m0 ? m0[2] : "desc";
        topicsSort = UC.makeHeadSort({ root: el, state: sst, cycles: ZYKLEN.topics, defaultSort: { field: "ad_coverage", dir: "desc" },
          onSort: function (feld, dir) {
            sst.sortField = feld; sst.sortDir = dir;
            tt.order = feld + "_" + dir; tt.page = 1; pst.page = 1; persist(); topicsNeu();
          } });
      }
      el.addEventListener("click", function (e) {
        if (ziehtNoch || (e.target.closest && e.target.closest(".up-grip"))) return;
        var k = pager.topics && pager.topics.kit;
        var ps = e.target.closest && e.target.closest("[data-pagesize]");
        if (ps && k) { k.setPageSize(Number(ps.getAttribute("data-pagesize"))); return; }
        if (e.target.closest(".up-page-prev") && k) { k.goToPage(pst.page - 1); return; }
        if (e.target.closest(".up-page-next") && k) { k.goToPage(pst.page + 1); return; }
        var pg = e.target.closest(".up-page[data-page]");
        if (pg && k) { k.goToPage(Number(pg.getAttribute("data-page"))); return; }
        var so = e.target.closest(".up-th.is-sortable[data-sort]");
        if (so && topicsSort) { topicsSort.headSortClick(so.getAttribute("data-sort")); return; }
        /* "Clear search" im Leerzustand leert nur DIESE Suche -- nicht die Filter der Seite, die der
           Knopf der Wurzel sonst zuruecksetzt. */
        if (e.target.closest("[data-uad-topicsweg]")) {
          e.stopPropagation();
          var inp0 = el.querySelector(".up-search-input"); if (inp0) inp0.value = "";
          el.querySelector(".uad-suche") && el.querySelector(".uad-suche").classList.remove("has-text");
          tt.suche = ""; tt.page = 1; pst.page = 1; persist(); topicsNeu();
        }
      });
      var box = el.querySelector(".uad-suche");
      if (box && UC.makeSearch) {
        var input = box.querySelector(".up-search-input");
        var sst2 = { query: tt.suche || "", page: 1, loading: false };
        if (tt.suche) { input.value = tt.suche; box.classList.add("is-open", "has-text"); }
        var kit = sucheKit.topics = UC.makeSearch({ root: el, box: box, input: input, state: sst2, prefix: "uadt", minChars: 1, debounceMs: 150,
          onRender: function () {},
          onFire: function (p) {
            var q = str(p.query).trim();
            if (q === str(tt.suche)) return;
            tt.suche = q; tt.page = 1; pst.page = 1; persist(); topicsNeu();
          } });
        box.querySelector(".up-search-btn").addEventListener("click", function () { kit.toggle(); });
        if (kit.syncTakeover) kit.syncTakeover();
        input.addEventListener("input", function () { kit.onInput(); });
        input.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("is-open")) kit.toggle(); });
        box.querySelector(".up-search-clear").addEventListener("click", function () {
          input.value = ""; kit.onInput();
          try { input.focus(); } catch (e2) {}
        });
      }
    }
    function zeichneTopics(d) {
      var el = sek("topics");
      if (!el) return;
      var platz = el.querySelector(".uad-tabelle");
      if (topicsSort) { try { topicsSort.syncHeadSorters(); } catch (e) {} }
      if (!d) { zahlSetzen(el, null); platz.innerHTML = tabelleHtml(kopfAus("topics"), skelettAus("topics", 5)); spaltenAnwenden("topics"); topicsPager(null); if (topicsSort) topicsSort.syncHeadSorters(); return; }
      var alle = topicsListe(d), tt = state.topicsTab, gr = tt.pageSize || GROESSE;
      zahlSetzen(el, alle.length);
      if (!alle.length) {
        var gesucht = !!str(tt.suche).trim();
        platz.innerHTML = '<div class="up-box">' + (gesucht
          ? UC.leerHtml({ gefiltert: true, was: "topics", knopf: "Clear search", knopfAttr: "data-uad-topicsweg" })
          : UC.leerHtml({ mini: true, titel: leerSatz() })) + '</div>';
        topicsPager(0);
        return;
      }
      var seiten = Math.max(1, Math.ceil(alle.length / gr));
      if ((tt.page || 1) > seiten) tt.page = seiten;
      var l = alle.slice(((tt.page || 1) - 1) * gr, (tt.page || 1) * gr);
      platz.innerHTML = tabelleHtml(kopfAus("topics"), l.map(function (x) {
        var id = str(x.topic_id).trim();
        return '<div class="up-row uad-zeile' + (id ? '" data-topic="' + esc(id) + '" role="link" tabindex="0"' : ' is-statisch"') + '>' +
          '<div class="up-td">' + topicChip(x) + '</div>' +
          '<div class="up-td up-td-cov up-var-sov">' + ringHtml(x.ad_coverage_pct) + '</div>' +
          td("advs", ganzHtml(x.advertiser_count)) +
          td("n", ganzHtml(x.ad_appearances)) +
        '</div>';
      }).join(""), "uad-klickbar");
      spaltenAnwenden("topics");
      if (topicsSort) topicsSort.syncHeadSorters();
      topicsPager(alle.length);
    }
    function zeichneRecent(d) {
      var el = sek("recent"), platz = el && el.querySelector(".uad-karten");
      if (!platz) return;
      if (!d) { platz.innerHTML = '<div class="up-adgrid">' + kartenSkelett(6) + '</div>'; return; }
      var l = gueltigeAds(d.recent_ads).slice(0, 6);
      if (!l.length) { platz.innerHTML = '<div class="up-box">' + UC.leerHtml({ icon: "marketing", titel: "No Ads observed",
        text: filterAktiv() ? "No Ads match these filters." : "None of the tracked AI responses in this range contained an Ad.",
        knopf: filterAktiv() ? "Clear search and filters" : "", knopfAttr: "data-uad-alleweg" }) + '</div>'; return; }
      platz.innerHTML = '<div class="up-adgrid">' + l.map(function (x) { return karte(x); }).join("") + '</div>';
    }
    /* Leer ist nicht gefiltert: "passt zu diesen Filtern" nur, wenn welche gesetzt sind. */
    function leerSatz() { return filterAktiv() ? "No Ads match these filters." : "No Ads observed"; }
    /* Das Skelett einer Karte: dieselben Masse (Bild 16:10, drei Zeilen Text). */
    function kartenSkelett(n) {
      var h = "";
      for (var i = 0; i < n; i++) h += '<div class="up-adcard uad-karte-sk" aria-hidden="true"><span class="up-adcard-media uad-sk-flaeche"></span>' +
        '<span class="up-adcard-body"><span class="up-tsk-bar" style="width:40%"></span><span class="up-tsk-bar" style="width:85%"></span>' +
        '<span class="up-tsk-bar" style="width:65%"></span><span class="up-adcard-foot"><span class="up-tsk-bar" style="width:50%"></span></span></span></div>';
      return h;
    }

    /* ============================================================================================
       Advertisers
       ============================================================================================ */
    function zeichneAdvertisers() {
      var tab = sek("tabelle");
      if (!tab) return;
      var tb = state.advertisers, a = advAnfrage(), d = daten(a);
      zahlSetzen(tab, d ? gesamt(d.total_count, tb, isArr(d.items) ? d.items.length : 0) : null);
      var kopfH = kopfAus("advertisers");
      if (!d) {
        if (fehlerVon(a)) { tabInhalt('<div class="up-box">' + fehlerKasten(a) + '</div>'); pagerSetzen("advertisers", null); return; }
        if (vorige.adv && vorige.advFilter === filterSig()) { tabInhalt(vorige.adv, true); spaltenAnwenden("advertisers"); pagerSetzen("advertisers", vorige.advTotal, true); sortSync(); return; }
        tabInhalt(tabelleHtml(kopfH, skelettAus("advertisers", 6)));
        spaltenAnwenden("advertisers"); pagerSetzen("advertisers", null, true); sortSync();
        return;
      }
      var l = (isArr(d.items) ? d.items : []).filter(function (x) { return x && typeof x === "object" && str(x.advertiser_name).trim(); });
      if (!l.length) {
        var gef = !!(tb.suche || filterAktiv());
        tabInhalt('<div class="up-box">' + UC.leerHtml({ gefiltert: gef, was: "advertisers", icon: "bank",
          titel: gef ? "No matching advertisers" : "No advertisers yet",
          text: gef ? "" : "None of the tracked AI responses in this range contained an Ad.",
          knopf: gef ? "Clear search and filters" : "", knopfAttr: "data-uad-alleweg" }) + '</div>');
        pagerSetzen("advertisers", 0); sortSync();
        return;
      }
      var q = tb.suche;
      var html = tabelleHtml(kopfH, l.map(function (x) {
        var n = str(x.advertiser_name).trim();
        var markets = (isArr(x.markets) ? x.markets : []).map(marktCode).filter(Boolean);
        /* Die Formate in der Tabelle kurz wie im Entwurf ("Image, Product"); unbekannte mit Rohwert. */
        var formate = (isArr(x.ad_formats) ? x.ad_formats : []).map(function (f) { f = str(f).trim(); return FORMAT_KURZ[f] ? t(FORMAT_KURZ[f]) : f; }).filter(Boolean);
        var r = str(x.relationship).trim();
        return '<div class="up-row uad-zeile" data-advertiser="' + esc(n) + '" role="link" tabindex="0">' +
          '<div class="up-td">' + advLogo(n, x.logo_url, x.company_id) + '<span class="up-varname" title="' + esc(n) + '">' + hl(n, q) + '</span>' + beziehungsMarke(r) + '</div>' +
          '<div class="up-td up-td-share up-var-sov">' + ringHtml(x.ad_share_pct) + '</div>' +
          td("n", ganzHtml(x.ad_appearances)) +
          td("prompts", ganzHtml(x.prompt_count)) +
          td("topics", ganzHtml(x.topic_count)) +
          td("markets", maerkteZelle(markets)) +
          td("formats", formate.length ? '<span class="uad-text" title="' + esc(formate.join(", ")) + '">' + esc(formate.join(", ")) + '</span>' : leerZelle()) +
          td("first", datumHtml(x.first_seen)) +
          td("last", datumHtml(x.last_seen)) +
        '</div>';
      }).join(""), "uad-klickbar");
      vorige.adv = html; vorige.advTotal = gesamt(d.total_count, tb, l.length); vorige.advFilter = filterSig();
      zahlSetzen(tab, vorige.advTotal);
      tabInhalt(html);
      spaltenAnwenden("advertisers");
      pagerSetzen("advertisers", vorige.advTotal);
      sortSync();
    }

    /* ---- Tabellen mit Suche, Sortierung und Pager (Advertisers, Ad Library) ------------------- */
    var vorige = {};
    function tbName() { return state.seite === "advertisers" ? "advertisers" : state.library.modus === "prompts" ? "lprompts" : "liste"; }
    function tbState() { return state.seite === "advertisers" ? state.advertisers : state.library.modus === "prompts" ? state.prompts : state.library; }
    function tabWurzel() { var tab = sek("tabelle"); return tab && tab.querySelector(".uad-tabwurzel"); }
    function tabInhalt(html, dimmen) {
      var w = tabWurzel();
      if (!w) return;
      w.classList.toggle("is-reloading", !!dimmen);
      w.querySelector(".uad-tabelle").innerHTML = html;
    }
    /* Die Gesamtzahl: total_count, und ist der kaputt oder fehlt, was sicher da ist -- Versatz plus
       gelieferte Zeilen. Zaehler im Kopf und Pager zeigen dieselbe Zahl. */
    function gesamt(roh, tb, n) { var g = anzahlWert(roh); return g != null ? Math.round(g) : offsetOf(tb) + n; }
    function pagerSetzen(name, total, laedt) {
      var p = pager.tab;
      if (!p) return;
      var tb = tbState();
      p.st.page = tb.page || 1; p.st.pageSize = tb.pageSize || 15; p.st.totalCount = total; p.st.loading = !!laedt;
      try { p.kit.renderPageSize(); p.kit.renderPager(); } catch (e) {}
      var foot = sek("tabelle") && sek("tabelle").querySelector(".uad-foot");
      if (foot) foot.hidden = !(num(total) > 0);
    }
    function sortSync() { if (sortKit.tab) { try { sortKit.tab.syncHeadSorters(); } catch (e) {} } }
    function tabelleVerdrahten(tab) {
      var tb = tbState(), name = tbName(), istLib = state.seite === "library";
      var pst = { page: tb.page || 1, pageSize: tb.pageSize || 15, totalCount: null, loading: false };
      if (UC.makePager) pager.tab = { st: pst, kit: UC.makePager({ root: tab, state: pst, onChange: function () {
        tb.page = pst.page; tb.pageSize = pst.pageSize; persist(); zeichnen(); bedarf();
      } }) };
      /* Die zwei Auswahlen der Ad Library: der Auswahl-Filter aus core in der Bauart "All Brands"
         (Entwurf: Pattern von brands-overview), mit Apply. Die Eintraege und ihre Zahlen kommen aus
         get_ads_filter_options_v1; ein gewaehlter Wert, den die Optionen nicht (mehr) kennen,
         bleibt in der Liste, damit er abgewaehlt werden kann. */
      if (istLib && UC.makeAuswahlFilter) {
        advFilter = UC.makeAuswahlFilter({
          klasse: "uad-advfilter", titel: "Advertisers", alle: "All advertisers", mehrere: "{n} advertisers",
          suche: "Search advertisers…", leer: "No advertisers yet",
          items: function () { return optionenListe("advertisers"); }, gewaehlt: state.adFilter.advertisers || [],
          onChange: function (keys) { state.adFilter.advertisers = keys.slice(); filterGeaendert(); }
        });
        fmtFilter = UC.makeAuswahlFilter({
          klasse: "uad-fmtfilter", titel: "Ad Format", alle: "All formats", mehrere: "{n} formats",
          suche: "Search…", leer: "No formats yet",
          items: function () { return optionenListe("ad_formats"); }, gewaehlt: state.adFilter.formate || [],
          onChange: function (keys) { state.adFilter.formate = keys.slice(); filterGeaendert(); }
        });
        var ap = tab.querySelector(".uad-advplatz"), fp = tab.querySelector(".uad-fmtplatz");
        if (ap) ap.appendChild(advFilter.el);
        if (fp) fp.appendChild(fmtFilter.el);
      }
      /* Das Zahnrad: Spalten und Zeilenhoehe aus UC.makeColumns, bedient wie in Shopping. Das Raster
         der Karten hat keins (keine Spalten). */
      var mitTabelle = !(istLib && state.library.modus === "ads" && state.library.ansicht === "grid");
      var spe = mitTabelle ? spaltenFuer(name, tab) : null, cw = tab.querySelector(".up-cols");
      if (spe && cw && UC.makePopover) {
        var cm = cw.querySelector(".up-cols-menu"), cb = cw.querySelector(".up-cols-btn");
        var cpop = UC.makePopover({ wrap: cw, menu: cm, opener: cb, group: "uad-" + instanceId });
        cb.addEventListener("click", function (e) {
          e.stopPropagation();
          if (cpop.isOpen()) { cpop.close(false); return; }
          spe.kit.populateCols(); cpop.open();
        });
        cm.addEventListener("click", function (e) {
          if (e.target.closest("[data-colsall]")) { spe.kit.selectAllCols(); return; }
          var dn = e.target.closest("[data-dense]");
          if (dn) { dichteSetzen(name, dn.getAttribute("data-dense") === "1"); spe.kit.populateCols(); return; }
          var cr = e.target.closest("[data-col]");
          if (cr) spe.kit.toggleCol(cr.getAttribute("data-col"));
        });
        spe.kit.syncColsBadge();
      }
      tab.addEventListener("click", function (e) {
        if (ziehtNoch || (e.target.closest && e.target.closest(".up-grip"))) return;
        var ps = e.target.closest && e.target.closest("[data-pagesize]");
        var k = pager.tab && pager.tab.kit;
        if (ps && k) { k.setPageSize(Number(ps.getAttribute("data-pagesize"))); return; }
        if (e.target.closest(".up-page-prev") && k) { k.goToPage(pst.page - 1); return; }
        if (e.target.closest(".up-page-next") && k) { k.goToPage(pst.page + 1); return; }
        var pg = e.target.closest(".up-page[data-page]");
        if (pg && k) { k.goToPage(Number(pg.getAttribute("data-page"))); return; }
        var so = e.target.closest(".up-th.is-sortable[data-sort]");
        if (so && sortKit.tab) { sortKit.tab.headSortClick(so.getAttribute("data-sort")); return; }
        var mo = e.target.closest(".uad-modus [data-wert]");
        if (mo) {
          var w = mo.getAttribute("data-wert") === "prompts" ? "prompts" : "ads";
          if (w !== state.library.modus) { state.library.modus = w; state.offen = {}; persist(); zeichnen(); bedarf(); }
          return;
        }
        var an = e.target.closest(".uad-ansicht [data-wert]");
        if (an) {
          var w2 = an.getAttribute("data-wert") === "list" ? "list" : "grid";
          if (w2 !== state.library.ansicht) { state.library.ansicht = w2; persist(); zeichnen(); }
        }
      });
      /* Sortierung ueber die Spaltenkoepfe (UC.makeHeadSort): Feld und Richtung ergeben genau einen
         Wert des Vertrags. Die Bibliothek der Ads hat keine (Vertrag: "immer neueste zuerst"). */
      var sortName = state.seite === "advertisers" ? "advertisers" : (istLib && state.library.modus === "prompts" ? "prompts" : "");
      if (sortName && UC.makeHeadSort) {
        var stb = sortName === "advertisers" ? state.advertisers : state.prompts;
        var sst = { sortField: "", sortDir: "" };
        var teile = /^(.*)_(asc|desc)$/.exec(stb.order || ORDER_VORGABE[sortName]) || [];
        sst.sortField = teile[1] || ""; sst.sortDir = teile[2] || "desc";
        var vorg = /^(.*)_(asc|desc)$/.exec(ORDER_VORGABE[sortName]);
        sortKit.tab = UC.makeHeadSort({ root: tab, state: sst, cycles: ZYKLEN[sortName], defaultSort: { field: vorg[1], dir: vorg[2] },
          onSort: function (feld, dir) {
            var o = feld + "_" + dir;
            if (ORDER[sortName].indexOf(o) < 0) o = ORDER_VORGABE[sortName];
            var m = /^(.*)_(asc|desc)$/.exec(o);
            sst.sortField = m[1]; sst.sortDir = m[2];
            stb.order = o; stb.page = 1; pst.page = 1; persist(); zeichnen(); bedarf();
          } });
      }
      /* Die ausklappbare Suche aus core (UC.makeSearch); onFire setzt den Suchtext in die Anfrage. */
      var box = tab.querySelector(".uad-suche");
      var such = state.seite === "advertisers" ? state.advertisers : state.library;
      if (box && UC.makeSearch) {
        var input = box.querySelector(".up-search-input");
        var sst2 = { query: such.suche || "", page: 1, loading: false };
        if (such.suche) { input.value = such.suche; box.classList.add("is-open", "has-text"); }
        var kit = sucheKit.tab = UC.makeSearch({ root: tab, box: box, input: input, state: sst2, prefix: "uad", minChars: 2, debounceMs: 300,
          onRender: function () {},
          onFire: function (p) {
            var q = str(p.query).trim();
            if (q === str(such.suche)) return;
            such.suche = q; such.page = 1; state.prompts.page = 1; state.offen = {}; pst.page = 1; persist(); zeichnen(); bedarf();
          } });
        box.querySelector(".up-search-btn").addEventListener("click", function () { kit.toggle(); });
        if (kit.syncTakeover) kit.syncTakeover();
        input.addEventListener("input", function () { kit.onInput(); });
        input.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("is-open")) kit.toggle(); });
        box.querySelector(".up-search-clear").addEventListener("click", function () {
          input.value = ""; kit.onInput();
          try { input.focus(); } catch (e2) {}
        });
      }
    }
    /* Die Eintraege eines Auswahl-Filters aus den Filter-Optionen. Advertisers mit Logo (aus dem,
       was geladen ist, und dem Markenspeicher), Formate mit ihrem Label aus der RPC. */
    function optionenListe(feld) {
      var d = daten(optAnfrage()) || letzteOptionen(), l = d && isArr(d[feld]) ? d[feld] : [], out = [], da = {};
      l.forEach(function (o) {
        if (!o || typeof o !== "object") return;
        var v = str(o.value).trim();
        if (!v || da[v]) return;
        da[v] = 1;
        var item = { key: v, label: str(o.label).trim() || v, zahl: anzahlWert(o.count) != null ? ganz(o.count) : null };
        if (feld === "advertisers") { item.logo = advInfo(v, null).logo || ""; item.zeichen = ADV_ZEICHEN; }
        out.push(item);
      });
      var gew = feld === "advertisers" ? state.adFilter.advertisers : state.adFilter.formate;
      (gew || []).forEach(function (v) {
        if (da[v]) return;
        da[v] = 1;
        out.push(feld === "advertisers" ? { key: v, label: v, logo: advInfo(v, null).logo || "", zeichen: ADV_ZEICHEN } : { key: v, label: UC.adFormatLabel ? UC.adFormatLabel(v) : v });
      });
      return out;
    }
    function letzteOptionen() { var r = state.reihe.optionen; return r.length ? state.cache.optionen[r[r.length - 1]] : null; }

    /* ============================================================================================
       Advertiser Detail
       ============================================================================================ */
    function dasDetail() { return state.advertiser ? daten(detailAnfrage()) : null; }
    function zeichneDetail() {
      var a = detailAnfrage(), d = dasDetail();
      krumenNeu();
      var fe = !d && fehlerVon(a);
      ["chart", "dprompts", "dads"].forEach(function (n) { var s = sek(n); if (s) s.hidden = !!fe; });
      if (fe) {
        sek("held").innerHTML = '<div class="up-box">' + fehlerKasten(a, "detail") + '</div>';
        sek("kpis").hidden = true;
        if (linie) linie.empty(t("This advertiser could not be loaded"));
        return;
      }
      sek("kpis").hidden = false;
      zeichneHeld(d);
      zeichneDetailKpis(d);
      zeichneDetailChart();
      zeichneDetailPrompts(d);
      zeichneDetailAds(d);
    }
    function zeichneHeld(d) {
      var el = sek("held");
      if (!el) return;
      var name = state.advertiser || "";
      if (!d) {
        el.innerHTML = '<div class="uad-held"><span class="up-logo-box uad-held-logo uad-sk-flaeche"></span><div class="uad-held-text">' +
          '<span class="up-tsk-bar" style="width:180px"></span><span class="up-tsk-bar" style="width:120px"></span></div></div>';
        return;
      }
      var adv = objOder(d.advertiser) || {}, n = str(adv.advertiser_name).trim() || name;
      var doms = (isArr(adv.landing_domains) ? adv.landing_domains : []).map(function (x) { return str(x).trim(); }).filter(Boolean);
      var r = str(adv.relationship).trim();
      el.innerHTML = '<div class="uad-held">' + advLogo(n, adv.logo_url, adv.company_id).replace('class="up-logo-box', 'class="up-logo-box uad-held-logo') +
        '<div class="uad-held-text">' +
          '<div class="uad-held-zeile"><h2 class="uad-held-name">' + esc(n) + '</h2>' + beziehungsMarke(r) + '</div>' +
          (doms.length ? '<span class="uad-held-dom">' + UC.icon("globe", 2) + '<span>' + esc(doms.join(", ")) + '</span></span>' : '') +
        '</div></div>';
    }
    function zeichneDetailKpis(d) {
      var el = sek("kpis");
      if (!el) return;
      if (!d) { el.innerHTML = kpiSkelett(4); return; }
      var s = objOder(d.summary) || {};
      /* Der Fuss der Topics nennt sie (Entwurf) -- aus den Prompts des Advertisers, denn summary
         traegt nur die Zahl. */
      var tn = {}, topics = [];
      (isArr(d.prompts) ? d.prompts : []).forEach(function (p) {
        topicListe(p && p.topics).forEach(function (x) {
          var k = str(x.topic_id).trim() || str(x.topic_name).trim();
          if (!tn[k]) { tn[k] = 1; topics.push(x); }
        });
      });
      el.innerHTML =
        kpiHtml({ label: "Ad Appearances", wertHtml: zaehlWert("int", s.ad_appearances) }) +
        kpiHtml({ label: "Prompts", wertHtml: zaehlWert("int", s.prompt_count) }) +
        kpiHtml({ label: "Topics", wertHtml: zaehlWert("int", s.topic_count), fussHtml: topics.length ? topicZelle(topics) : "" }) +
        kpiHtml({ label: "Ad Share", wertHtml: zaehlWert("pct", s.ad_share_pct) });
      erklaerAnLabels(el, ["appearances", "", "", "share"]);
      hochzaehlen(el);
    }
    function zeichneDetailChart() {
      if (!linie) return;
      var a = detailAnfrage(), d = dasDetail();
      if (!d) { if (fehlerVon(a)) linie.empty(t("This advertiser could not be loaded")); else linie.skeleton(); return; }
      var tr = trendTage(d.trend), n = state.dMetrik === "n";
      if (!tr.length) { linie.empty(); return; }
      /* Ein Tag ohne Auftritt ist 0 (gezaehlt), der Anteil eines Tags ohne Ads ist keiner (null). */
      var werte = n ? tr.map(function (x) { var v = anzahlWert(x.ad_appearances); return v == null ? 0 : v; }) : linienDaten(tr, "ad_share_pct", "pct");
      linieZeichnen(tr.map(function (x) { return str(x.date).slice(0, 10); }), werte, t(n ? "Ad Appearances" : "Ad Share"));
    }
    function zeichneDetailPrompts(d) {
      var el = sek("dprompts");
      if (!el) return;
      var platz = vorschauPlatz(el, "dprompts");
      if (!d) { zahlSetzen(el, null); platz.innerHTML = tabelleHtml(kopfAus("dprompts"), skelettAus("dprompts", 4)); spaltenAnwenden("dprompts"); return; }
      var adv = objOder(d.advertiser) || {}, r = str(adv.relationship).trim();
      /* Organic Context nur fuer einen Advertiser mit getrackter Firma (Vertrag: "Sonst sind beide
         Felder null"). */
      var verknuepft = !!str(adv.company_id).trim();
      var l = (isArr(d.prompts) ? d.prompts : []).filter(function (x) { return x && typeof x === "object" && str(x.prompt_text).trim(); });
      zahlSetzen(el, l.length);
      if (!l.length) { platz.innerHTML = '<div class="up-box">' + UC.leerHtml({ mini: true, titel: "No prompts yet" }) + '</div>'; return; }
      platz.innerHTML = tabelleHtml(kopfAus("dprompts"), l.map(function (x) {
        var pid = str(x.prompt_id).trim();
        var org = x.organic_mentioned, organisch;
        if (!verknuepft || (org !== true && org !== false)) organisch = leerZelle();
        else if (org) organisch = '<span class="uad-organisch is-ja">' + UC.icon("check", 2) + '<span>' + esc(t(r === "you" ? "You are also mentioned organically" : "Also mentioned organically")) + '</span></span>';
        else organisch = '<span class="uad-organisch">' + UC.icon("x", 2) + '<span>' + esc(t("Not mentioned organically")) + '</span></span>';
        return '<div class="up-row uad-zeile' + (pid ? '" data-prompt="' + esc(pid) + '" role="link" tabindex="0"' : ' is-statisch"') + '>' +
          '<div class="up-td"><span class="uad-prompt-ic">' + UC.icon("zap", 2) + '</span><span class="uad-titel" title="' + esc(str(x.prompt_text).trim()) + '">' + esc(str(x.prompt_text).trim()) + '</span></div>' +
          td("topic", topicZelle(x.topics)) +
          td("n", ganzHtml(x.ad_appearances)) +
          td("last", datumHtml(x.last_seen)) +
          td("organic", organisch) +
        '</div>';
      }).join(""), "uad-klickbar");
      spaltenAnwenden("dprompts");
    }
    /* Topics als der Chip der App (UC.topicChipHtml, 05.10. abends: "die uebliche Topic-Stylings").
       Die Ads-RPCs tragen nur topic_id und topic_name -- Farbe und Emoji kommen ueber die Id aus dem
       Store der Seite (setUpstreemTopics). In Zelle und Kachel die erste Topic und "+N" mit den
       uebrigen Namen im Tooltip; im Drawer alle. */
    /* Maerkte als der Chip der Prompts-Tabelle (UC.marketChip: Flagge und Code, 05.10. abends
       angefordert). Mehr als zwei: die ersten zwei und "+N", die uebrigen Codes im Tooltip. */
    function maerkteZelle(codes) {
      if (!codes.length) return leerZelle();
      if (!UC.marketChip) return '<span class="uad-text">' + esc(codes.join(", ")) + '</span>';
      var zeigen = codes.length > 2 ? codes.slice(0, 2) : codes, rest = codes.slice(zeigen.length);
      return '<span class="uad-maerkte">' + zeigen.map(function (c) { return UC.marketChip(c); }).join("") +
        (rest.length ? '<span class="up-marke is-leise" data-tip="' + esc(rest.join(", ")) + '">+' + rest.length + '</span>' : '') + '</span>';
    }
    function topicListe(l) {
      return (isArr(l) ? l : []).filter(function (x) { return x && typeof x === "object" && str(x.topic_name).trim(); });
    }
    function topicChip(x) {
      return UC.topicChipHtml ? UC.topicChipHtml(x, { dunkel: isDark() }) : '<span class="uad-text">' + esc(str(x.topic_name).trim()) + '</span>';
    }
    function topicZelle(l) {
      l = topicListe(l);
      if (!l.length) return leerZelle();
      var rest = l.slice(1).map(function (x) { return str(x.topic_name).trim(); });
      return '<span class="uad-topics">' + topicChip(l[0]) +
        (rest.length ? '<span class="up-marke is-leise" data-tip="' + esc(rest.join(", ")) + '">+' + rest.length + '</span>' : '') + '</span>';
    }
    /* Ads des Advertisers: die neuesten 20 (Vertrag), als Karten; "By Campaign" gruppiert nach
       campaign_id, sonst utm_campaign -- nur, wenn eine Ad Kampagnendaten traegt. */
    function kampagnenSchluessel(ad) { return str(ad.campaign_id).trim() || str(ad.utm_campaign).trim(); }
    function zeichneDetailAds(d) {
      var el = sek("dads");
      if (!el) return;
      if (!d) { el.innerHTML = kopf("Ads") + '<div class="up-adgrid">' + kartenSkelett(4) + '</div>'; return; }
      var l = gueltigeAds(d.ads), s = objOder(d.summary) || {};
      var mitKampagne = l.some(function (x) { return !!kampagnenSchluessel(x); });
      if (!mitKampagne) state.dGruppe = "all";
      var werkzeuge = (mitKampagne ? segHtml("uad-gruppe-seg", [["all", "All"], ["campaign", "By Campaign"]], state.dGruppe) : '') +
        leiserKnopf("Open Ad Library", 'data-uad-bibliothek="' + esc(state.advertiser || "") + '"');
      var gesamtN = anzahlWert(s.ad_appearances);
      if (!l.length) { el.innerHTML = kopf("Ads", { zahl: 0, tools: werkzeuge }) + '<div class="up-box">' + UC.leerHtml({ mini: true, titel: leerSatz() }) + '</div>'; return; }
      /* Mehr Auftritte als gelieferte Ads: das sind die neuesten. Der Satz sagt es, der Knopf daneben
         fuehrt zu allen. */
      var hinweis = gesamtN != null && gesamtN > l.length ? '<p class="uad-hinweis">' + esc(ersetze(t("Showing the {n} most recent of {total}."), { n: ganz(l.length), total: ganz(gesamtN) })) + '</p>' : '';
      var inhalt;
      if (state.dGruppe === "campaign" && mitKampagne) {
        var gruppen = {}, reihenfolge = [];
        l.forEach(function (x) {
          var k = kampagnenSchluessel(x) || "__ohne";
          if (!gruppen[k]) { gruppen[k] = []; reihenfolge.push(k); }
          gruppen[k].push(x);
        });
        reihenfolge.sort(function (a, b) { return (a === "__ohne") - (b === "__ohne"); });
        inhalt = reihenfolge.map(function (k) {
          var g = gruppen[k], erste = g[0], utm = str(erste.utm_campaign).trim(), cid = str(erste.campaign_id).trim();
          var titel = k === "__ohne" ? '<span class="uad-kamp-name is-ohne">' + esc(t("No campaign data")) + '</span>'
            : '<span class="uad-kamp-name' + (/^cmpn_/.test(utm || cid) ? " is-mono" : "") + '">' + esc(utm || cid) + '</span>' +
              (utm && cid && cid !== utm ? '<span class="uad-kamp-id">' + esc(cid) + '</span>' : '');
          return '<div class="uad-kampagne"><div class="uad-kamp-kopf"><span class="uad-kamp-ic">' + UC.icon("folder", 2) + '</span>' +
            '<div class="uad-kamp-text">' + titel + '</div>' +
            '<span class="uad-kamp-zahl">' + esc(ersetze(t(g.length === 1 ? "{n} ad" : "{n} ads"), { n: ganz(g.length) })) + '</span></div>' +
            '<div class="up-adgrid">' + g.map(function (x) { return karte(x); }).join("") + '</div></div>';
        }).join("");
      } else inhalt = '<div class="up-adgrid">' + l.map(function (x) { return karte(x); }).join("") + '</div>';
      el.innerHTML = kopf("Ads", { zahl: ganz(l.length), tools: werkzeuge }) + inhalt + hinweis;
    }

    /* ============================================================================================
       Ad Library
       ============================================================================================ */
    function zeichneLibrary() {
      var tab = sek("tabelle");
      if (!tab) return;
      if (advFilter) advFilter.setGewaehlt(state.adFilter.advertisers || []);
      if (fmtFilter) fmtFilter.setGewaehlt(state.adFilter.formate || []);
      if (state.library.modus === "prompts") zeichneLibPrompts(tab);
      else zeichneLibAds(tab);
    }
    function leerBibliothek(gef, prompts) {
      return '<div class="up-box">' + UC.leerHtml({ gefiltert: gef, was: prompts ? "prompts" : "ads", icon: prompts ? "zap" : "album",
        titel: gef ? (prompts ? "No matching prompts" : "No matching Ads") : (prompts ? "No prompts yet" : "No Ads observed"),
        text: gef ? "No observed Ads match this search and these filters." : "None of the tracked AI responses in this range contained an Ad.",
        knopf: gef ? "Clear search and filters" : "", knopfAttr: "data-uad-alleweg" }) + '</div>';
    }
    function zeichneLibAds(tab) {
      var lb = state.library, a = libAnfrage(), d = daten(a), grid = lb.ansicht !== "list";
      zahlSetzen(tab, d ? gesamt(d.total_count, lb, isArr(d.items) ? d.items.length : 0) : null);
      var schl = "lib" + (grid ? "g" : "l");
      if (!d) {
        if (fehlerVon(a)) { tabInhalt('<div class="up-box">' + fehlerKasten(a) + '</div>'); pagerSetzen("liste", null); return; }
        if (vorige[schl] && vorige[schl + "Filter"] === filterSig()) { tabInhalt(vorige[schl], true); if (!grid) spaltenAnwenden("liste"); pagerSetzen("liste", vorige[schl + "Total"], true); return; }
        tabInhalt(grid ? '<div class="up-adgrid">' + kartenSkelett(8) + '</div>' : tabelleHtml(kopfAus("liste"), skelettAus("liste", 6)));
        if (!grid) spaltenAnwenden("liste");
        pagerSetzen("liste", null, true);
        return;
      }
      var l = gueltigeAds(d.items);
      if (!l.length) { tabInhalt(leerBibliothek(!!(lb.suche || filterAktiv()), false)); pagerSetzen("liste", 0); return; }
      var q = lb.suche, html;
      if (grid) html = '<div class="up-adgrid">' + l.map(function (x) { return karte(x, q); }).join("") + '</div>';
      else html = tabelleHtml(kopfAus("liste"), l.map(function (x) { return listenZeile(x, q); }).join(""), "uad-klickbar");
      vorige[schl] = html; vorige[schl + "Total"] = gesamt(d.total_count, lb, l.length); vorige[schl + "Filter"] = filterSig();
      zahlSetzen(tab, vorige[schl + "Total"]);
      tabInhalt(html);
      if (!grid) spaltenAnwenden("liste");
      pagerSetzen("liste", vorige[schl + "Total"]);
    }
    function vorschauBild(ad, klasse) {
      var u = sichereUrl(ad.image_url);
      return '<span class="uad-bild' + (klasse ? " " + klasse : "") + (u ? " has-img" : "") + '"><span class="uad-bild-ph">' + UC.icon("image", 1.8) + '</span>' +
        (u ? '<img src="' + esc(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' : '') + '</span>';
    }
    function listenZeile(ad, q) {
      var id = adMerken(ad), titel = str(ad.title).trim(), adv = str(ad.advertiser_name).trim(), dom = str(ad.landing_domain).trim();
      var preis = (UC.fmtGeld ? UC.fmtGeld(ad.price, ad.currency) : "") || str(ad.price_str).trim().slice(0, 40);
      var markt = marktCode(ad.market), modell = str(ad.model).trim();
      return '<div class="up-row uad-zeile" data-ad-id="' + esc(id) + '" role="link" tabindex="0">' +
        '<div class="up-td">' + vorschauBild(ad) + '<span class="uad-zweizeilig"><span class="uad-titel" title="' + esc(titel) + '">' + (titel ? hl(titel, q) : '–') + '</span>' +
          '<span class="uad-unter">' + (adv ? '<span>' + hl(adv, q) + '</span>' : '') + (dom ? '<span>' + hl(dom, q) + '</span>' : '') + '</span></span></div>' +
        td("format", str(ad.ad_format).trim() ? '<span class="uad-text">' + esc(UC.adFormatLabel ? UC.adFormatLabel(ad.ad_format) : str(ad.ad_format)) + '</span>' : leerZelle()) +
        td("price", preis ? '<span class="up-num">' + esc(preis) + '</span>' : leerZelle()) +
        td("model", (modell ? (UC.modelChip ? UC.modelChip(modell) : esc(modell)) : leerZelle()) + (markt ? maerkteZelle([markt]) : '')) +
        td("prompt", str(ad.prompt_text).trim() ? '<span class="uad-text" title="' + esc(str(ad.prompt_text).trim()) + '">' + hl(str(ad.prompt_text).trim(), q) + '</span>' : leerZelle()) +
        td("seen", datumHtml(ad.observed_at)) +
      '</div>';
    }
    function zeichneLibPrompts(tab) {
      var lb = state.library, tb = state.prompts, a = promptAnfrage(), d = daten(a);
      zahlSetzen(tab, d ? gesamt(d.total_count, tb, isArr(d.items) ? d.items.length : 0) : null);
      var kopfH = kopfAus("lprompts");
      if (!d) {
        if (fehlerVon(a)) { tabInhalt('<div class="up-box">' + fehlerKasten(a) + '</div>'); pagerSetzen("lprompts", null); return; }
        if (vorige.lp && vorige.lpFilter === filterSig()) { tabInhalt(vorige.lp, true); spaltenAnwenden("lprompts"); pagerSetzen("lprompts", vorige.lpTotal, true); sortSync(); return; }
        tabInhalt(tabelleHtml(kopfH, skelettAus("lprompts", 6)));
        spaltenAnwenden("lprompts"); pagerSetzen("lprompts", null, true); sortSync();
        return;
      }
      var l = (isArr(d.items) ? d.items : []).filter(function (x) { return x && typeof x === "object" && str(x.prompt_text).trim(); });
      if (!l.length) { tabInhalt(leerBibliothek(!!(lb.suche || filterAktiv()), true)); pagerSetzen("lprompts", 0); sortSync(); return; }
      var q = lb.suche;
      var html = tabelleHtml(kopfH, l.map(function (x) {
        var pid = str(x.prompt_id).trim(), offen = !!(pid && state.offen[pid]), text = str(x.prompt_text).trim();
        return '<div class="up-row uad-zeile uad-pzeile' + (offen ? " is-offen" : "") + '"' + (pid ? ' data-auf="' + esc(pid) + '" data-auf-text="' + esc(text) + '" role="button" tabindex="0" aria-expanded="' + offen + '"' : '') + '>' +
            '<div class="up-td"><span class="uad-auf-ic">' + UC.icon(offen ? "chevronDown" : "chevronRight", 2.2) + '</span>' +
              '<span class="uad-titel" title="' + esc(text) + '">' + hl(text, q) + '</span></div>' +
            td("topic", topicZelle(x.topics)) +
            '<div class="up-td up-td-cov up-var-sov">' + ringHtml(x.ad_coverage_pct) + '</div>' +
            td("advs", ganzHtml(x.advertiser_count)) +
            td("n", ganzHtml(x.ad_appearances)) +
            td("last", datumHtml(x.last_ad_seen)) +
          '</div>' + (offen ? aufklappHtml(pid, text, anzahlWert(x.ad_appearances)) : '');
      }).join(""), "uad-klickbar");
      vorige.lp = html; vorige.lpTotal = gesamt(d.total_count, tb, l.length); vorige.lpFilter = filterSig();
      zahlSetzen(tab, vorige.lpTotal);
      tabInhalt(html);
      spaltenAnwenden("lprompts");
      pagerSetzen("lprompts", vorige.lpTotal);
      sortSync();
    }
    /* Die aufgeklappte Prompt-Zeile: die Ads dieses Prompts (Entwurf) und "Open Prompt Detail". */
    function aufklappHtml(pid, text, auftritte) {
      var a = aufAnfrage({ text: text }), d = daten(a), inhalt;
      if (!d) inhalt = fehlerVon(a) ? fehlerKasten(a) : '<div class="uad-auf-liste">' + [0, 1, 2].map(function () {
        return '<div class="uad-auf-ad is-sk"><span class="uad-bild uad-sk-flaeche"></span><span class="uad-zweizeilig"><span class="up-tsk-bar" style="width:140px"></span><span class="up-tsk-bar" style="width:90px"></span></span></div>';
      }).join("") + '</div>';
      else {
        var l = gueltigeAds(d.items).filter(function (x) { return str(x.prompt_id).trim() === pid; });
        if (!l.length) inhalt = '<p class="uad-hinweis">' + esc(t("No Ads were observed for this prompt.")) + '</p>';
        else {
          inhalt = '<div class="uad-auf-liste">' + l.map(function (x) {
            var id = adMerken(x), titel = str(x.title).trim() || "–";
            return '<button type="button" class="uad-auf-ad" data-ad-id="' + esc(id) + '">' + vorschauBild(x) +
              '<span class="uad-zweizeilig"><span class="uad-titel" title="' + esc(titel) + '">' + esc(titel) + '</span>' +
              '<span class="uad-unter"><span>' + esc(str(x.advertiser_name).trim()) + '</span><span>' + esc(datum(x.observed_at)) + '</span></span></span></button>';
          }).join("") + '</div>';
          if (auftritte != null && auftritte > l.length && l.length >= AUF_LIMIT) {
            inhalt += '<p class="uad-hinweis">' + esc(ersetze(t("Showing the {n} most recent of {total}."), { n: ganz(l.length), total: ganz(auftritte) })) + '</p>';
          }
        }
      }
      return '<div class="uad-auf"><div class="uad-auf-kopf"><span class="uad-auf-titel">' + esc(t("Ads observed for this prompt")) + '</span>' +
        leiserKnopf("Open Prompt Detail", 'data-prompt="' + esc(pid) + '"') + '</div>' + inhalt + '</div>';
    }

    /* ============================================================================================
       Der Ad-Detail-Drawer
       ============================================================================================ */
    var drawer = UC.makeSeitenDrawer ? UC.makeSeitenDrawer({ owner: root, klasse: "uad-drawer", isDark: isDark, label: "Ad" }) : null;
    var drawerVerdrahtet = false, drawerAd = null;
    function zeile(k, wertHtml, o) {
      o = o || {};
      return '<div class="uad-dr-zeile"><span class="uad-dr-k">' + esc(t(k)) + '</span>' +
        '<div class="uad-dr-v' + (o.mono ? " is-mono" : "") + '">' + wertHtml +
          (o.kopie ? '<button type="button" class="up-iconbtn is-24 uad-kopie" data-kopie="' + esc(o.kopie) + '" aria-label="' + esc(t("Copy")) + '" data-tip="' + esc(t("Copy")) + '">' + UC.icon("copy", 2) + '</button>' : '') +
        '</div></div>';
    }
    function gruppe(titel, zeilen) {
      return zeilen ? '<div class="uad-dr-gruppe"><div class="uad-dr-titel">' + esc(t(titel)) + '</div><div class="uad-dr-box">' + zeilen + '</div></div>' : '';
    }
    function drawerOeffnen(id) {
      var ad = adIndex[str(id).trim()];
      if (!ad || !drawer) return;
      drawerAd = ad;
      var adv = str(ad.advertiser_name).trim(), i = advInfo(adv, ad.company_id);
      var fmt = str(ad.ad_format).trim(), titel = str(ad.title).trim(), desc = str(ad.description).trim();
      var preis = (UC.fmtGeld ? UC.fmtGeld(ad.price, ad.currency) : "") || str(ad.price_str).trim().slice(0, 40);
      var bild = sichereUrl(ad.image_url), url = sichereUrl(ad.url), dom = str(ad.landing_domain).trim();
      var markt = marktCode(ad.market), modell = str(ad.model).trim(), topics = topicListe(ad.topics);
      /* Die Antwort, in der diese Ad stand: prompt_run_id traegt jedes Ad-Objekt (Vertrag), und
         genau das ist die Id des Response-Drawers -- wie "View Response" in Shopping. */
      var lauf = str(ad.prompt_run_id).trim();
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(lauf)) lauf = "";
      var pid = str(ad.prompt_id).trim(), ptext = str(ad.prompt_text).trim();
      var logoHtml = '<span class="up-ment-logo' + (i.logo ? " has-img" : "") + '"><span class="up-logo-zeichen">' + UC.icon(ADV_ZEICHEN, 2) + '</span>' +
        (i.logo ? '<img src="' + esc(i.logo) + '" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' : '') + '</span>';
      var krume = '<span class="up-sdrawer-typ">' + esc(t("Ad")) + '</span><span class="up-sdrawer-sep">/</span>' + logoHtml +
        (adv ? '<button type="button" class="up-sdrawer-name uad-dr-adv" data-advertiser="' + esc(adv) + '">' + esc(adv) + '</button>' : '<span class="up-sdrawer-name">–</span>');
      var kampagne = [
        str(ad.utm_campaign).trim() ? zeile("UTM Campaign", '<span>' + esc(str(ad.utm_campaign).trim()) + '</span>', { mono: true, kopie: str(ad.utm_campaign).trim() }) : "",
        str(ad.campaign_id).trim() ? zeile("Campaign ID", '<span>' + esc(str(ad.campaign_id).trim()) + '</span>', { mono: true, kopie: str(ad.campaign_id).trim() }) : "",
        str(ad.ad_group_id).trim() ? zeile("Ad Group ID", '<span>' + esc(str(ad.ad_group_id).trim()) + '</span>', { mono: true, kopie: str(ad.ad_group_id).trim() }) : "",
        str(ad.ad_id).trim() ? zeile("Ad ID", '<span>' + esc(str(ad.ad_id).trim()) + '</span>', { mono: true, kopie: str(ad.ad_id).trim() }) : "",
        str(ad.ad_account_id).trim() ? zeile("Ad Account ID", '<span>' + esc(str(ad.ad_account_id).trim()) + '</span>', { mono: true, kopie: str(ad.ad_account_id).trim() }) : ""
      ].join("");
      var inhalt =
        '<div class="uad-dr-motiv">' +
          '<div class="uad-dr-media' + (bild ? " has-img" : "") + '"><span class="up-adcard-ph">' + UC.icon(fmt === "product_card_v2" ? "shoppingBag" : "image", 1.5) + '</span>' +
            (bild ? '<img src="' + esc(bild) + '" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.classList.remove(\'has-img\');this.remove()"/>' : '') +
            (fmt ? '<span class="up-adcard-fmt">' + esc(UC.adFormatLabel ? UC.adFormatLabel(fmt) : fmt) + '</span>' : '') + '</div>' +
          '<div class="uad-dr-text">' +
            '<div class="uad-dr-absender"><span>' + esc(adv || "–") + '</span>' + beziehungsMarke(i.beziehung) + '</div>' +
            '<h2 class="uad-dr-h">' + esc(titel || "–") + '</h2>' +
            (desc ? '<p class="uad-dr-desc">' + esc(desc) + '</p>' : '') +
            (preis ? '<div class="uad-dr-preis">' + esc(preis) + '</div>' : '') +
          '</div>' +
        '</div>' +
        gruppe("Ad content",
          zeile("Advertiser", adv ? '<button type="button" class="uad-dr-link uad-dr-adv" data-advertiser="' + esc(adv) + '">' + esc(adv) + '</button>' : leerZelle()) +
          zeile("Format", fmt ? '<span>' + esc(UC.adFormatLabel ? UC.adFormatLabel(fmt) : fmt) + '</span>' : leerZelle()) +
          (preis ? zeile("Price", '<span>' + esc(preis) + '</span>') : "")) +
        gruppe("Destination",
          zeile("Landing domain", dom ? '<span>' + esc(dom) + '</span>' : leerZelle()) +
          zeile("Landing URL", url ? '<a class="uad-dr-url" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(url) + '</a>' : leerZelle(), { mono: true, kopie: url || "" })) +
        gruppe("Observation",
          zeile("Prompt", ptext ? (pid ? '<button type="button" class="uad-dr-link" data-prompt="' + esc(pid) + '">' + esc(ptext) + UC.icon("arrowRight", 2) + '</button>' : '<span>' + esc(ptext) + '</span>') : leerZelle()) +
          zeile("Response", lauf ? '<button type="button" class="uad-dr-link" data-antwort="' + esc(lauf) + '">' + esc(t("View Response")) + UC.icon("arrowUpRight", 2) + '</button>' : leerZelle()) +
          zeile("Topic", topics.length ? '<span class="uad-dr-topics">' + topics.map(topicChip).join("") + '</span>' : leerZelle()) +
          zeile("Model", modell ? (UC.modelChip ? UC.modelChip(modell, { full: true }) : esc(modell)) : leerZelle()) +
          zeile("Market", markt ? (UC.marketChip ? UC.marketChip(markt) : '<span>' + esc(marktName(markt)) + '</span>') : leerZelle()) +
          zeile("Observed at", '<span>' + esc(zeitpunkt(ad.observed_at)) + '</span>')) +
        (kampagne ? gruppe("Campaign metadata", kampagne) : "");
      drawer.open(krume, inhalt);
      if (!drawerVerdrahtet && drawer.body) {
        drawerVerdrahtet = true;
        var host = drawer.body.closest(".up-sdrawer-host") || drawer.body;
        host.addEventListener("click", function (e) {
          var z = e.target.closest && e.target;
          if (!z) return;
          var kp = z.closest(".uad-kopie[data-kopie]");
          if (kp) { kopieren(kp); return; }
          var av = z.closest(".uad-dr-adv[data-advertiser]");
          if (av) { var n = av.getAttribute("data-advertiser"); drawer.close(); advertiserOeffnen(n); return; }
          var an = z.closest("[data-antwort]");
          if (an) { antwortOeffnen(an.getAttribute("data-antwort")); return; }
          var pr = z.closest("[data-prompt]");
          if (pr) promptOeffnen(pr.getAttribute("data-prompt"));
        });
      }
    }
    function kopieren(knopf) {
      var text = knopf.getAttribute("data-kopie") || "";
      if (!text) return;
      function fertig() {
        knopf.classList.add("is-kopiert");
        knopf.innerHTML = UC.icon("check", 2);
        knopf.setAttribute("data-tip", t("Copied"));
        setTimeout(function () { knopf.classList.remove("is-kopiert"); knopf.innerHTML = UC.icon("copy", 2); knopf.setAttribute("data-tip", t("Copy")); }, 1500);
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(fertig, function () { if (UC.legacyCopy && UC.legacyCopy(text)) fertig(); }); return; }
      } catch (e) {}
      if (UC.legacyCopy && UC.legacyCopy(text)) fertig();
    }

    /* ---- Klicks ---------------------------------------------------------------------------------- */
    root.addEventListener("click", function (e) {
      var z = e.target.closest && e.target;
      if (!z) return;
      if (z.closest(".uad-filterzeile, .up-ph-nav, .up-ph-top")) return;
      var nm = z.closest("[data-uad-nochmal]");
      if (nm) { nochmal(nm.getAttribute("data-uad-nochmal")); return; }
      if (z.closest("[data-uad-alleweg], [data-clearall]")) {
        var inp = elMain.querySelector(".uad-suche .up-search-input"); if (inp) inp.value = "";
        alleFilterZuruecksetzen(); geruest = null; zeichnen(); bedarf(); return;
      }
      var zi = z.closest("[data-uad-ziel]");
      if (zi) { seiteOeffnen(zi.getAttribute("data-uad-ziel"), true, zi.getAttribute("data-uad-ziel") === "library" ? { modus: "ads" } : null); return; }
      var bib = z.closest("[data-uad-bibliothek]");
      if (bib) {
        var n = bib.getAttribute("data-uad-bibliothek");
        if (n) { state.adFilter.advertisers = [n]; state.library.page = 1; }
        seiteOeffnen("library", true, { modus: "ads" });
        return;
      }
      var gs = z.closest(".uad-gruppe-seg [data-wert]");
      if (gs) { state.dGruppe = gs.getAttribute("data-wert") === "campaign" ? "campaign" : "all"; persist(); zeichneDetailAds(dasDetail()); return; }
      var br = z.closest(".up-bar-row[data-bar-key]");
      if (br && z.closest('[data-sek="anteil"]')) { advertiserOeffnen(br.getAttribute("data-bar-key")); return; }
      var adk = z.closest("[data-ad-id]");
      if (adk && !adk.classList.contains("uad-karte-sk")) { drawerOeffnen(adk.getAttribute("data-ad-id")); return; }
      var pr = z.closest("[data-prompt]");
      if (pr) { promptOeffnen(pr.getAttribute("data-prompt")); return; }
      var zl = z.closest(".up-row.uad-zeile");
      if (zl) zeileOeffnen(zl);
    });
    root.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var zl = e.target && e.target.closest && e.target.closest(".up-row.uad-zeile[tabindex]");
      if (zl && e.target === zl) { e.preventDefault(); zeileOeffnen(zl); }
    });
    function zeileOeffnen(zl) {
      if (zl.hasAttribute("data-topic")) { topicWaehlen(zl.getAttribute("data-topic")); seiteOeffnen("library", true, { modus: "ads" }); return; }
      if (zl.hasAttribute("data-advertiser")) { advertiserOeffnen(zl.getAttribute("data-advertiser")); return; }
      if (zl.hasAttribute("data-auf")) {
        var pid = zl.getAttribute("data-auf");
        if (state.offen[pid]) delete state.offen[pid];
        else state.offen[pid] = { text: zl.getAttribute("data-auf-text") || "" };
        zeichnen(); bedarf();
        return;
      }
      if (zl.hasAttribute("data-ad-id")) { drawerOeffnen(zl.getAttribute("data-ad-id")); return; }
      if (zl.hasAttribute("data-prompt")) promptOeffnen(zl.getAttribute("data-prompt"));
    }

    /* ---- Spaltengriff: der Griff gehoert zu dem Kit, an dessen Wurzel er steht ---------------- */
    var ziehtNoch = false;
    root.addEventListener("pointerdown", function (e) {
      var g = e.target && e.target.closest && e.target.closest(".up-grip");
      if (!g) return;
      for (var n = g; n && n !== root.parentNode; n = n.parentNode) {
        if (n.__uadSpalten) {
          e.stopPropagation();
          ziehtNoch = true;
          document.addEventListener("pointerup", function () { setTimeout(function () { ziehtNoch = false; }, 0); }, { once: true });
          n.__uadSpalten.kit.startResize(e);
          return;
        }
      }
    });

    /* ---- Sichtbarkeit, Groesse, Format -------------------------------------------------------- */
    if (UC.onViewChange) UC.onViewChange(function (name) {
      if (name === "ads" && root.isConnected) setTimeout(function () { adresseAnwenden(); if (filterAbgleichen()) filterGeaendert(); else { zeichnen(); bedarf(); } }, 0);
    });
    if (UC.onResize) UC.onResize(root, function () {
      Object.keys(sucheKit).forEach(function (k) { try { if (sucheKit[k] && sucheKit[k].syncTakeover) sucheKit[k].syncTakeover(); } catch (e) {} });
      Object.keys(spalten).forEach(function (k) { try { spalten[k].kit.applyCols(); } catch (e) {} });
      if (sichtbar()) bedarf();
    });
    /* Die Stores der Seite kommen oft NACH der ersten Antwort -- setUpstreemTopics, -Brands, -Models
       und -Markets laufen in eigenen Workflows. Was sie beitragen (Topic-Farbe und Emoji, You/
       Competitor und Logo, Modell-Logo, Flagge), steht erst mit dem naechsten Zeichnen da; ohne das
       blieben die Topic-Chips bis zur naechsten Antwort grau. Vier Stores, ein gebuendelter Lauf. */
    var storeUhr = null;
    function storeNeu() {
      if (storeUhr) return;
      storeUhr = setTimeout(function () { storeUhr = null; if (root.isConnected !== false && sichtbar()) zeichnen(); }, 0);
    }
    if (UC.onTopics) UC.onTopics(storeNeu, root);
    if (UC.onBrands) UC.onBrands(storeNeu, root);
    if (UC.onModels) UC.onModels(storeNeu, root);
    if (UC.onMarkets) UC.onMarkets(storeNeu, root);

    /* ---- Setter -------------------------------------------------------------------------------- */
    var ctrl = {
      setOverview: function (raw, f) { return antwort("overview", raw, f); },
      setAdvertisers: function (raw, f) { return antwort("advertisers", raw, f); },
      setDetail: function (raw, f) { return antwort("detail", raw, f); },
      setLibrary: function (raw, f) { return antwort("library", raw, f); },
      setPrompts: function (raw, f) { return antwort("prompts", raw, f); },
      setOptionen: function (raw, f) { var ok = antwort("optionen", raw, f); if (advFilter) advFilter.neu(); if (fmtFilter) fmtFilter.neu(); return ok; },
      reset: function () {
        KANAELE.forEach(function (k) {
          state.cache[k] = {}; state.reihe[k] = [];
          if (unterwegs[k]) clearTimeout(unterwegs[k].uhr);
          unterwegs[k] = null;
        });
        state.fehler = {}; vorige = {};
        persist(); geruest = null; zeichnen(); bedarf();
        return true;
      },
      redraw: function () { geruest = null; zeichnen(); if (drawer) drawer.thema(); },
      state: state, root: root, seite: seiteOeffnen, advertiser: advertiserOeffnen, ad: drawerOeffnen, drawer: drawer
    };
    root.__uadController = ctrl;

    /* ?ads und ?advertiser gehoeren der Ads-Ansicht (06.10., wie ?event in den Events). */
    if (UC.ansichtsParameter) UC.ansichtsParameter({ ansicht: "ads", schluessel: ["ads", "advertiser"], owner: root,
      onTeamWechsel: function () { if (state.seite !== "overview") seiteOeffnen("overview", false); } });
    /* Erster Stand: die Adresse entscheidet. */
    var a0 = adresseLesen();
    state.seite = a0.seite; state.advertiser = a0.advertiser;
    if (nav && nav.selectPage) nav.selectPage(a0.seite === "advertiser" ? "advertisers" : a0.seite, false);
    zeichnen();
    krumenNeu();
    setTimeout(function () { filterAbgleichen(); zeichnen(); bedarf(); }, 0);
    return ctrl;
  }

  /* ---- Mount und oeffentliche Setter ------------------------------------------------------------ */
  var mount;
  mount = UC.makeMount({
    onMount: function (m) { mount = m; },
    rootClass: "uad-root", notPortal: true,
    ctrlProp: "__uadController",
    resolveLocal: "__uadResolveLocal",
    queue: "__uadBootQueue",
    initRoot: initRoot,
    redraw: function (c) { if (c && c.redraw) c.redraw(); },
    api: {
      /* (instanz, json, fehler): json ist das Feld json des Umschlags, fehler Bubbles "error body". */
      setAdsOverview:         function (id, p, f) { return jede(id, function (c) { c.setOverview(p, f); }, "setAdsOverview"); },
      setAdsAdvertisers:      function (id, p, f) { return jede(id, function (c) { c.setAdvertisers(p, f); }, "setAdsAdvertisers"); },
      setAdsAdvertiserDetail: function (id, p, f) { return jede(id, function (c) { c.setDetail(p, f); }, "setAdsAdvertiserDetail"); },
      setAdsLibrary:          function (id, p, f) { return jede(id, function (c) { c.setLibrary(p, f); }, "setAdsLibrary"); },
      setAdsPrompts:          function (id, p, f) { return jede(id, function (c) { c.setPrompts(p, f); }, "setAdsPrompts"); },
      setAdsFilterOptions:    function (id, p, f) { return jede(id, function (c) { c.setOptionen(p, f); }, "setAdsFilterOptions"); },
      resetAds:               function (id) { return jede(id, function (c) { c.reset(); }, "resetAds"); }
    }
  });
  /* Ein Setter ohne passende Wurzel sagt es einmal in der Konsole: sonst faellt die Antwort still
     weg (falsche Instanz im Run-JS-Schritt, Element nicht auf der Seite). */
  var ohneWurzel = {};
  function jede(id, fn, wer) {
    var roots = mount.rootsWithId(String(id == null ? "default" : id).trim());
    if (!roots.length) {
      var k = String(wer) + "|" + String(id);
      if (!ohneWurzel[k] && window.console) { ohneWurzel[k] = true; console.warn("[ads] " + wer + '("' + id + '"): kein Ads-Element mit dieser data-instance auf der Seite.'); }
      return false;
    }
    roots.forEach(function (r) { var c = initRoot(r); if (c) fn(c); });
    return true;
  }
  if (UC.watchRoots) UC.watchRoots("uad-root", function () {
    [].forEach.call(document.querySelectorAll(".uad-root"), function (r) { if (!UC.messbar || UC.messbar(r)) initRoot(r); });
  });
  }

  uadBoot(30);
})();
