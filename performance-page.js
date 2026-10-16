/* upstreem performance-page.js -- die Performance-Seite als EINE Komponente (09.10.). Praefix upf.

   Kopf (Krume "Performance"), darunter der Performance Radar, und nach einem Klick auf eine Zelle
   der Detailbereich mit der URL-Tabelle dieser Zelle -- wie bisher die Bubble-Ansicht, nur ohne
   ihre Workflows. Radar, Detailbereich und URL-Tabelle sind die ECHTEN Bausteine der App
   (performance-radar.js, performance-detail.js, urls-table.js) im lokalen Modus: ihr Markup kommt
   aus den Bubble-Vorlagen (.performance_markup.py), ihre Ereignisse kommen als DOM-Ereignis hierher
   statt an Bubble. Dieselben Bausteine an anderen Orten tragen kein data-local und arbeiten
   unveraendert ueber Bubble weiter.

   DATEN: direkt ueber UC.rpc (Nutzer-JWT), Vertrag A aus bubble/seiten_db_vorschlag_2.md
   (performance_radar_v1, performance_company_chart_v1, performance_brand_variations_v1, fuer die
   URLs cached_citations_urls_v1). Anfragen und Umformung stehen in performance-data.js, der Lader
   kommt aus citations-data.js. Hier steht nur: wann was geladen wird und wohin es geht.

   KALENDER UND FILTERLEISTE (15.10. abends, gemeldet: "der hat ja gar keine Filter Bar mehr und
   Date Range"): dieselbe Filterzeile wie Dashboard, Citations, Shopping und Ads -- Kalender,
   Topics, Models, Markets und der Intent-Filter der App, alles lokale Instanzen. Bis dahin hatte
   die Seite keinen Kalender, und die DB rechnete fest die letzten 30 Tage. Das Detail nimmt die
   Tage aus der Antwort des Radars, damit Zelle und Detail dieselben zeigen, und Modelle, Maerkte
   und Topics aus der Leiste. Eine neue Auswahl dort laedt den Radar neu; eine offene Zelle bleibt
   offen, solange es sie im neuen Raster noch gibt.

   KEIN AKTUALISIEREN-KNOPF: der bisherige Seitenkopf hatte keinen, und die Seite bleibt so. Der
   Radar liegt im Cache der DB (6 h frisch); "Aktualisieren" im Dashboard leert ihn mit
   (clear_dashboard_cache_v1, Vertrag 4.5). */
(function () {
  "use strict";

  var API_NAMES = ["resetPerformancePage"];
  var Q = (window.__upfBootQueue = window.__upfBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function upfBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemPerformanceDaten || !window.UpstreemCitationsDaten) {
      if (triesLeft > 0) { setTimeout(function () { upfBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[performance-page] core.js, performance-data.js oder citations-data.js nicht geladen");
      return;
    }
    upfStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .performance_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    uhm: "<div class=\"up-root uhm-root\" data-local=\"yes\" data-instance=\"__UPF_UHM__\" data-cdn-pin=\"\" data-isdark=\"no\"><div class=\"up-head\"><div class=\"up-heading\">Performance Chart</div><div class=\"up-head-tools\"><div class=\"uhm-metric up-seg\" role=\"tablist\" aria-label=\"Metric\"><button class=\"up-seg-btn is-active\" data-metric=\"visibility\" type=\"button\" role=\"tab\" aria-selected=\"true\">Visibility</button><button class=\"up-seg-btn\" data-metric=\"rank\" type=\"button\" role=\"tab\" aria-selected=\"false\">Ranking</button><button class=\"up-seg-btn\" data-metric=\"sentiment\" type=\"button\" role=\"tab\" aria-selected=\"false\">Sentiment</button></div><!-- Der Einstellungsknopf steht ganz rechts, hinter dem Filter. Er stand vorher links davon; core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars). --><div class=\"uhm-pick\"><button class=\"uhm-pick-btn up-iconbtn\" type=\"button\" data-tip=\"Brands &amp; Topics\" aria-label=\"Choose brands and topics\"></button><div class=\"uhm-pick-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"uhm-set\"><button class=\"uhm-set-btn up-iconbtn\" type=\"button\" data-tip=\"Settings\" aria-label=\"Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><div class=\"uhm-set-menu up-menu\" role=\"menu\" aria-hidden=\"true\"></div></div></div></div><div class=\"uhm-box\"><div class=\"uhm-scroll\"><div class=\"uhm-grid\"></div></div></div></div>",
    upd: "<div class=\"up-root upd-root\" data-local=\"yes\" data-instance=\"__UPF_UPD__\" data-cdn-pin=\"\" data-isdark=\"__UPF_DARK__\"></div>",
    uut: "<div class=\"up-root uut-root\" data-local=\"yes\" data-instance=\"__UPF_UUT__\" data-cdn-pin=\"\" data-isdark=\"__UPF_DARK__\" data-domain-mode=\"no\" data-brand-name=\"__UPF_BRAND__\" data-brand-logo=\"__UPF_BRANDLOGO__\" data-export-instance=\"\" data-sticky-top=\"16\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">URLs</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"uut-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"uut-brand-toggle-lbl\"><img class=\"uut-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"uut-brand-label\"></span></span><span class=\"uut-brand-check\"><svg class=\"uut-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"uut-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-filter\"><button class=\"up-filter-btn\" type=\"button\" data-tip=\"Filter Citation and URL Types\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-filter-btn-lbl\">All Types</span><svg class=\"up-filter-btn-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-filter-btn-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Type in url...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search URLs\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"uut-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th up-th-domain\">URL<span class=\"up-grip\" data-grip=\"domain\"></span></div><div class=\"up-th up-th-share is-sortable\" data-sortcol=\"share\"><span class=\"up-th-txt\">Share</span><span class=\"up-th-info\" data-explain=\"share\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"share\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-type\">Type<span class=\"up-th-info\" data-explain=\"type\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-ment\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">mentioned</span></div><div class=\"up-th up-th-brands\">Brands mentioned<span class=\"up-th-info\" data-explain=\"brands\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-lastseen is-sortable\" data-sortcol=\"last_seen\"><span class=\"up-th-txt\">Last Seen</span><span class=\"up-thsort\" data-for=\"last_seen\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th uut-th-actions\">Actions</div></div><div class=\"up-tbody\"></div></div></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function upfStart() {
  var UC = window.UpstreemCore, D = window.UpstreemPerformanceDaten, C = window.UpstreemCitationsDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  /* Je Instanz ueber einen Neuaufbau hinweg (Bubble baut Elemente beim Themenwechsel neu): die
     Auswahl, die offene Zelle, der Stand der URL-Tabelle -- und der Lader samt Speicher, damit der
     neue Aufbau aus dem Speicher zeichnet statt das Skelett zu zeigen. */
  var STORE = (window.__upfStore = window.__upfStore || {});

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function liste(s) { return isArr(s) ? s.map(str) : String(s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }

  function beiSicht(el, schluessel, fn, test, o) {
    if (UC.beiSicht) UC.beiSicht(el, schluessel, fn, test, o); else fn();
  }
  function messbar(el) { return !UC.messbar || UC.messbar(el); }

  function initRoot(root) {
    if (root.__upfCtrl) return root.__upfCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "performance_page";
    if (instanceId === "INSTANCE_ID") return null;
    var gem = STORE[instanceId] || (STORE[instanceId] = {});

    function tabelleVorgabe() { return { suche: "", order: "share_desc", limit: UC.DEFAULT_PAGE_SIZE || 15, offset: 0, requestId: null }; }
    var state = {
      team: gem.team || "",
      auswahl: gem.auswahl || { firmen: null, topics: null },
      detail: gem.detail || null,
      url: gem.url || tabelleVorgabe(),
      uf: gem.uf || { erwaehnt: "all", citationTypen: null, urlTypen: null },
      zeitraum: gem.zeitraum || null,
      eigene: gem.eigene || null,
      /* Die Stufe der Kurve im Detail (14.10.): beim Oeffnen jeder Zelle aus dem Zeitraum des Radars
         (UC.granFuerZeitraum, wie SET GRAN auf jeder Seite mit Kalender), danach per D/W/M. */
      gran: gem.gran || "day",
      /* Der Stand der Filterzeile, wie auf der Dashboard-Seite (state.f dort). */
      f: gem.f || { von: "", bis: "", modelle: null, maerkte: null, topics: null, tagmode: "or" },
      kalenderDa: false,
      fehler: {}
    };
    function persist() {
      gem.team = state.team; gem.auswahl = state.auswahl; gem.detail = state.detail; gem.url = state.url;
      gem.uf = state.uf; gem.zeitraum = state.zeitraum; gem.eigene = state.eigene; gem.gran = state.gran;
      gem.f = state.f;
    }
    function granAusZeitraum() {
      var z = state.zeitraum || {};
      var g = UC.granFuerZeitraum && z.von && z.bis ? UC.granFuerZeitraum(z.von, z.bis) : null;
      state.gran = g || "day";
    }
    var lader = gem.lader || (gem.lader = C.makeLader({
      rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 30000 }); }
    }));

    /* ---- Aufbau ------------------------------------------------------------------------------- */
    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    var ids = {
      uhm: instanceId + "_radar", upd: instanceId + "_detail", uut: instanceId + "_urls",
      daten: instanceId + "_dates", filter: instanceId + "_filters", modelle: instanceId + "_models",
      maerkte: instanceId + "_markets", topics: instanceId + "_topics"
    };
    function einsetzen(m) {
      var e = state.eigene;
      return String(m || "").split("__UPF_UHM__").join(esc(ids.uhm))
        .split("__UPF_UPD__").join(esc(ids.upd)).split("__UPF_UUT__").join(esc(ids.uut))
        .split("__UPF_DARK__").join(isDark() ? "yes" : "no")
        .split("__UPF_BRANDLOGO__").join(esc(e ? str(e.logo_url) : ""))
        .split("__UPF_BRAND__").join(esc(e ? str(e.name) : ""));
    }
    /* Der Radar findet seinen Detailbereich zwar selbst (erster .upd-root in einem Vorfahren), die
       Kennung steht trotzdem ausdruecklich dran: dann trifft er auch dann den richtigen, wenn eine
       zweite Instanz der Seite im selben Behaelter steht. */
    var radarHtml = einsetzen(MARKUP.uhm).replace('data-instance="' + esc(ids.uhm) + '"',
      'data-instance="' + esc(ids.uhm) + '" data-detail-instance="' + esc(ids.upd) + '"');
    var dk = isDark() ? "yes" : "no";
    root.classList.add("up-sidebar-clear");
    root.innerHTML =
      '<div class="up-ph-top upf-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Performance")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Explore topic performance, compare brands, and uncover strengths and gaps")) + '</p></div>' +
      '</div>' +
      /* Die Filterzeile wie auf der Dashboard-Seite (dashboard-page.js, .uds-filterzeile): Kalender,
         dann die Filterleiste, die ihre Untermenues ueber die Kennungen findet. .up-leiste-fluss
         (core, "DIE EINE LEISTE"): Filters, Chips und Clear All stehen einzeln neben dem Kalender
         und brechen in der Zeile um. */
      '<div class="upf-filterzeile up-leiste-fluss">' +
        '<div class="up-root udr-root upf-daten" data-instance="' + esc(ids.daten) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root ufb-root upf-filterleiste" data-instance="' + esc(ids.filter) + '" data-topics-instance="' + esc(ids.topics) + '"' +
          ' data-models-instance="' + esc(ids.modelle) + '" data-markets-instance="' + esc(ids.maerkte) + '" data-isdark="' + dk + '"></div>' +
        '<div class="up-root utf-root" data-instance="' + esc(ids.topics) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root umf-root" data-instance="' + esc(ids.modelle) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root umk-root" data-instance="' + esc(ids.maerkte) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
      '</div>' +
      '<div class="upf-main">' +
        '<div class="upf-radar">' + radarHtml + '</div>' +
        '<section class="upf-detail" hidden>' +
          einsetzen(MARKUP.upd) +
          '<div class="upf-urls">' + einsetzen(MARKUP.uut) + '</div>' +
        '</section>' +
      '</div>';

    var elDetail = root.querySelector(".upf-detail");
    if (UC.makePageCrumbs) UC.makePageCrumbs(root, { icon: "chartColumnUp", name: "Performance", komponente: true });
    /* Der Auftritt (core, makeAuftritt): Kopf sofort, der Inhalt erst mit Stylesheets und ersten
       Daten, dann in einem Zug. Siehe dort, warum. */
    var auftritt = UC.makeAuftritt ? UC.makeAuftritt(root, { kopf: ".upf-pagehead, .upf-filterzeile", inhalt: ".upf-main > *" }) : null;
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* ---- Detailbereich auf und zu --------------------------------------------------------------
       Bisher ein Custom State in Bubble (detail_open). Zu geht er bei X, bei einer neuen Auswahl im
       Radar (die Zelle gehoert dann zum alten Raster -- der Radar leert den Bereich selbst) und
       beim Teamwechsel. */
    function detailZeigen(an) {
      elDetail.hidden = !an;
      root.classList.toggle("has-detail", !!an);
    }
    function detailZu() {
      state.detail = null;
      persist();
      detailZeigen(false);
      lader.abbrechen("kurve"); lader.abbrechen("varianten"); lader.abbrechen("urls");
    }

    /* ---- Filter --------------------------------------------------------------------------------
       Kalender und die drei Filter sind lokale Instanzen: ihre Auswahl kommt als DOM-Ereignis.
       Dieselben Regeln wie auf der Dashboard- und der Citations-Seite (dort setzen/auswahl/
       zeitraum); fSetzen heisst hier anders, weil setzen() unten den Stand der URL-Tabelle setzt. */
    function fSetzen(feld, wert) {
      var alt = JSON.stringify(state.f[feld] == null ? null : state.f[feld]);
      if (alt === JSON.stringify(wert == null ? null : wert)) return false;
      state.f[feld] = wert;
      return true;
    }
    function toArr(x) {
      if (isArr(x)) return x;
      if (x && typeof x === "object") return Object.keys(x).map(function (k) { var v = x[k]; return v && typeof v === "object" ? v : { code: k }; });
      return [];
    }
    /* exclude heisst "alle ausser" (wie Shopping): die uebrigen Schluessel des Stores. */
    function auswahlAus(feld, d, schluessel) {
      var gew = liste(d && d[schluessel]);
      if (!gew.length) return null;
      if (d.select_mode !== "exclude") return gew;
      var alle = feld === "modelle"
        ? (UC.getModels ? UC.getModels() : []).map(function (m) { return str(m.key || m.model); })
        : (UC.getAllMarkets ? toArr(UC.getAllMarkets()) : []).map(function (m) { return str(m.alpha2 || m.alpha3 || m.code || m.market).toUpperCase(); });
      return alle.filter(function (k) { return k && gew.indexOf(k) < 0; });
    }
    /* GEBUENDELT wie auf der Dashboard-Seite (120ms): wer schnell mehrere Filter waehlt, bekommt
       EINE Ladung mit dem letzten Stand -- der Radar ist je Funktion auf 60 Aufrufe pro Minute
       begrenzt. Die URL-Tabelle einer offenen Zelle faengt wieder auf Seite 1 an. */
    var filterUhr = null;
    function filterGeaendert() {
      state.url.offset = 0;
      persist();
      clearTimeout(filterUhr);
      filterUhr = setTimeout(function () { filterUhr = null; filterLaden(); }, 120);
    }
    root.addEventListener("umf-models", function (e) { if (fSetzen("modelle", auswahlAus("modelle", e.detail, "model_keys"))) filterGeaendert(); });
    root.addEventListener("umk-markets", function (e) { if (fSetzen("maerkte", auswahlAus("maerkte", e.detail, "market_codes"))) filterGeaendert(); });
    root.addEventListener("utf-topics", function (e) {
      var d = e.detail || {}, l = liste(d.topic_ids);
      var a = fSetzen("topics", l.length ? l : null), b = fSetzen("tagmode", d.tag_mode === "and" ? "and" : "or");
      if (a || (b && l.length)) filterGeaendert();
    });
    /* Intent-Filter der App (13.10.): gemeinsamer Stand in core, Ereignis am window. Die Seite
       zeigt ihn seit dem 15.10. abends in ihrer Leiste, also gilt er auch fuer ihre Zahlen. */
    window.addEventListener("up-intentfilter", function () { if (document.contains(root)) filterGeaendert(); });
    /* Intent oder Branded geaendert (Live, 14.10.): die DB hat ihre Caches schon geleert, die Seite
       holt still frisch, sobald die Aenderung ihre Zahlen treffen kann (core, onIntentDaten). */
    if (UC.onIntentDaten) UC.onIntentDaten(function () {
      function holen() { lader.leeren(); filterLaden({ leise: true }); }
      if (UC.istSichtbar && !UC.istSichtbar(root) && UC.beiSicht) UC.beiSicht(root, "intentDaten", holen, null, { lang: true });
      else holen();
    }, root);
    function kalender() { var k = root.querySelector(".upf-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
    /* Ein neuer Zeitraum: kalenderDa heisst "der Kalender hat geantwortet", auch wenn der Zeitraum
       derselbe blieb (Neuaufbau mit gemerktem Stand). Die Stufe der Kurve im Detail folgt ihm beim
       naechsten Oeffnen einer Zelle von selbst (granAusZeitraum aus der Antwort des Radars). */
    function zeitraum(von, bis) {
      var a = fSetzen("von", von), b = fSetzen("bis", bis);
      state.kalenderDa = true;
      return a || b;
    }
    function kalenderLesen() {
      var c = kalender(), r = null;
      try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
      if (!r || !r.from || !r.to) return false;
      return zeitraum(r.from, r.to);
    }
    root.addEventListener("change", function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains("upf-daten")) return;
      var d = e.detail || {};
      if (!d.date_from || !d.date_to) return;
      if (zeitraum(d.date_from, d.date_to)) filterGeaendert();
    });
    function filterAbgleichen() {
      var g = kalenderLesen();
      var m = root.querySelector(".umf-root"), k = root.querySelector(".umk-root"), tp = root.querySelector(".utf-root");
      try { if (m && m.__umfCtrl) g = fSetzen("modelle", auswahlAus("modelle", m.__umfCtrl.getSelected(), "model_keys")) || g; } catch (e) {}
      try { if (k && k.__umkCtrl) g = fSetzen("maerkte", auswahlAus("maerkte", k.__umkCtrl.getSelected(), "market_codes")) || g; } catch (e) {}
      try {
        if (tp && tp.__utfCtrl) {
          var s = tp.__utfCtrl.getSelected(), l = liste(s.topic_ids);
          g = fSetzen("topics", l.length ? l : null) || g;
          g = fSetzen("tagmode", s.tag_mode === "and" ? "and" : "or") || g;
        }
      } catch (e) {}
      return g;
    }
    function filterStand() { var f = {}, k; for (k in state.f) f[k] = state.f[k]; return f; }

    /* ---- Ereignisse --------------------------------------------------------------------------- */
    function an(name, fn) { root.addEventListener(name, function (e) { fn(e.detail || {}); }); }
    /* Auswahl im Radar (makeFire, lokal: Praefix "uhm" + Name "uhmSelect"). Die Kennungen kommen
       als Komma-Text. Der Radar hat die Matrix schon verengt und dimmt sich, bis die Antwort da
       ist -- also kein Skelett (weich). */
    an("uhmuhmSelect", function (d) {
      var f = D.uuids(liste(d.company_ids)), tp = D.uuids(liste(d.topic_ids));
      if (!f || !tp) return;
      state.auswahl = { firmen: f, topics: tp };
      detailZu();
      persist();
      radarLaden({ weich: true });
    });
    /* Zellklick: der Radar hat den Detailbereich schon gefuellt (Kopf, Kennzahlen, Rangliste aus
       seinem Raster) -- hier kommen Kurve, Varianten und URLs dazu. */
    an("uhmCellClick", function (d) {
      var firma = str(d.company_id).trim(), topic = str(d.topic_id).trim();
      if (!firma || !topic) return;
      var neu = !state.detail || state.detail.firma !== firma || state.detail.topic !== topic;
      state.detail = { firma: firma, topic: topic };
      if (neu) { state.url = tabelleVorgabe(); state.uf = { erwaehnt: "all", citationTypen: null, urlTypen: null }; urlMenueAngleichen(); }
      /* Bei JEDER Zelle die Startstufe aus dem Zeitraum -- wie die Drawer beim Oeffnen (14.10.). */
      granAusZeitraum();
      persist();
      detailZeigen(true);
      detailBald();
    });
    an("upd-bubble_fn_updClose", function () { detailZu(); });
    /* D/W/M im Detail: nur die Kurve neu, Varianten und URLs haengen nicht an der Stufe. */
    an("upd-bubble_fn_updGran", function (d) {
      var g = str(d.gran);
      if ((g !== "day" && g !== "week" && g !== "month") || !state.detail) return;
      state.gran = g;
      persist();
      kurveLaden();
    });
    an("updCompanyClick", function (d) {
      var id = str(d.company_id).trim();
      if (id && UC.drawerOeffnen) UC.drawerOeffnen("brand", id, "performance");
    });

    /* Die URL-Tabelle (lokal "uut-uut<Name>"). Topic und Marke sind fest; die Tabelle stellt Suche,
       Sortierung, Seite, Typen und "<eigene Marke> mentioned" ein. Ihr Markenmenue ist hier
       ausgeblendet (performance-page.css): die Liste IST schon auf eine Marke gefiltert. */
    function urlMenueAngleichen() {
      var f = state.uf;
      try {
        if (window.setUrlsTableFilters) window.setUrlsTableFilters(ids.uut, {
          citation_types: f.citationTypen || [], url_types: f.urlTypen || [], brands: [],
          brand_mentioned: f.erwaehnt === "yes" || f.erwaehnt === "no" ? f.erwaehnt : ""
        });
      } catch (e) {}
    }
    function setzen(feld, wert) {
      var alt = JSON.stringify(state.uf[feld] == null ? null : state.uf[feld]);
      if (alt === JSON.stringify(wert == null ? null : wert)) return false;
      state.uf[feld] = wert;
      return true;
    }
    an("uut-uutSearch", function (d) {
      state.url.suche = str(d.query); state.url.requestId = d.requestId != null ? d.requestId : null; state.url.offset = 0;
      persist(); urlsLaden();
    });
    an("uut-uutSort", function (d) { state.url.order = str(d.order) || state.url.order; state.url.offset = 0; persist(); urlsLaden(); });
    an("uut-uutPage", function (d) {
      var l = num(d.limit), o = num(d.offset);
      if (l != null) state.url.limit = l;
      if (o != null) state.url.offset = o;
      persist(); urlsLaden();
    });
    an("uut-uutFilter", function (d) {
      var ct = liste(d.citation_types), ut = liste(d.url_types);
      var a = setzen("citationTypen", ct.length ? ct : null), b = setzen("urlTypen", ut.length ? ut : null);
      if (a || b) { state.url.offset = 0; persist(); urlsLaden(); }
    });
    an("uut-uutBrand", function (d) {
      var v = str(d.brand_mentioned);
      if (setzen("erwaehnt", v === "yes" || v === "no" ? v : "all")) { state.url.offset = 0; persist(); urlsLaden(); }
    });
    an("uut-uutRowClick", function (d) { if (UC.drawerOeffnen) UC.drawerOeffnen("url", str(d.url), "performance"); });

    /* EXPORT wie auf der Citations-Seite: die Tabelle oeffnet das Export-Fenster der App ueber
       dessen Kennung; die Seite setzt sie vor dem Klick (Fangphase). Kein Export-Element auf der
       Seite: ein Satz statt eines stillen Klicks ins Leere. */
    function exportKennung() {
      var k = str(root.getAttribute("data-export-instance")).trim();
      if (k && !/^[A-Z_]{3,}$/.test(k)) return k;
      var e = document.querySelector(".uex-root[data-instance]");
      k = e ? str(e.getAttribute("data-instance")).trim() : "";
      return k && !/^[A-Z_]{3,}$/.test(k) ? k : "";
    }
    root.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".up-export") : null;
      var tab = b && b.closest(".uut-root");
      if (!tab || !root.contains(tab)) return;
      var k = exportKennung();
      if (!k || typeof window.upstreemExportOpen !== "function") {
        e.stopPropagation();
        if (UC.toast) UC.toast(t("Export isn't available on this page"), { kind: "neutral" });
        return;
      }
      tab.setAttribute("data-export-instance", k);
      try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, exportKontext()); } catch (err) {}
    }, true);
    /* WAS DER EXPORT MITNIMMT (16.10., wie prompts-page.js): die URLs der offenen Zelle, also
       genau die Parameter der Tabelle darunter -- die Marke der Zelle (Brands), ihr Topic, die
       Filter der Tabelle und ihre Suche, dazu der Zeitraum des Radars. Im Dialog als Chips, jeder
       abwaehlbar. */
    function exportKontext() {
      var z = state.zeitraum || {}, r = null, c = kalender();
      try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
      /* Das Preset des Kalenders nur, wenn der Radar genau dessen Zeitraum zeigt -- sonst ist es ein
         freier Zeitraum (der Dialog sagt dann "Custom range"). */
      var preset = r && r.preset && r.from === z.von && r.to === z.bis ? r.preset : "";
      return {
        export_type: "urls", date_from: z.von || "", date_to: z.bis || "", preset: preset,
        params: { urls: C.urls(D.urlFilter(zelle(), state.zeitraum, state.uf), state.url).params }
      };
    }

    /* ---- Laden ---------------------------------------------------------------------------------
       Nur solange die Seite zu sehen ist und ein Team bekannt ist (wie Citations). */
    function sichtbarTest(el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); }
    /* Ohne Kalender keine Anfrage (wie die Dashboard-Seite): die Zahlen muessen genau diesen
       Zeitraum haben. Der Kalender richtet sich einen Takt nach der Seite ein -- also im Takt von
       30ms nachsehen, hoechstens 3s lang; fehlt date-range.js ganz, laedt die Seite danach ohne
       Zeitraum, und die DB nimmt ihre Vorgabe (die letzten 30 Tage, wie vor der Filterzeile). */
    var warteUhr = null, kalenderVersuche = 0;
    function spaeter(ms) { if (!warteUhr) warteUhr = setTimeout(function () { warteUhr = null; bedarf(); }, ms); }
    function bereit() {
      if (!sichtbarTest(root)) { beiSicht(root, "laden", function () { bedarf(); }, sichtbarTest); return false; }
      if (!team()) return false;
      if (!state.kalenderDa) {
        kalenderLesen();
        if (!state.kalenderDa && kalenderVersuche++ < 100) { spaeter(30); return false; }
      }
      return true;
    }
    /* Mehrere Teile gemeinsam zeigen (Muster der Citations-Seite): alle in den Ladezustand, alle
       Anfragen gleichzeitig hinaus, gezeichnet wird erst, wenn alle da sind -- und je Kanal nur aus
       der juengsten Gruppe. Liegt alles im Speicher, steht es sofort, ohne Ladezustand. */
    var gruppeNr = 0, juengsteJe = {};
    function gemeinsam(auftraege) {
      var nr = ++gruppeNr;
      auftraege.forEach(function (a) { juengsteJe[a.kanal] = nr; });
      /* Nur wer wirklich holen muss, zeigt Laden (11.10., wie die anderen Seiten). */
      auftraege.forEach(function (a) { if (!a.imSpeicher) a.ladenAn(); });
      return Promise.all(auftraege.map(function (a) { return a.laden(); })).then(function (zeigen) {
        zeigen.forEach(function (z, i) { if (z && juengsteJe[auftraege[i].kanal] === nr) z(); });
        if (auftritt) auftritt.bereit();
      });
    }
    function laden(kanal, a) { return lader.laden(kanal, a); }
    function ergebnis(erg, umformen) {
      if (erg.ueberholt) return { ueberholt: true };
      var p = erg.ok ? umformen(erg.daten) : null;
      return p ? { p: p } : { fehler: erg.ok ? "x" : C.fehlerArt(erg) };
    }

    /* o.weich: ohne Skelett (nach einer Auswahl dimmt sich der Radar selbst; nach einer Live-Meldung
       bleibt der alte Stand stehen, bis der neue da ist). o.zelleNeu: der Filter hat sich geaendert
       -- eine offene Zelle wird danach aus dem NEUEN Raster wieder geoeffnet (zelleWiederOeffnen). */
    function radarAuftrag(o) {
      o = o || {};
      var a = D.radar({ team: team(), firmen: state.auswahl.firmen, topics: state.auswahl.topics, f: filterStand() });
      return {
        kanal: "radar",
        imSpeicher: lader.ausSpeicher(a) !== undefined,
        ladenAn: function () { if (!o.weich) { try { window.setPerformanceRadarLoading(ids.uhm, "yes"); } catch (e) {} } },
        laden: function () {
          return laden("radar", a).then(function (erg) {
            var r = ergebnis(erg, D.zuRadar);
            if (r.ueberholt) return null;
            return function () {
              if (!r.p) {
                state.fehler.radar = r.fehler;
                try { window.renderPerformanceRadar({ instanceId: ids.uhm, __parseError: true }); } catch (e) {}
                /* Ohne Raster hat eine offene Zelle nichts mehr, woran sie haengt. */
                if (o.zelleNeu && state.detail) detailZu();
                return;
              }
              state.fehler.radar = null;
              state.zeitraum = r.p.zeitraum;
              if (r.p.eigene) state.eigene = r.p.eigene;
              persist();
              var p = {}, k;
              for (k in r.p) if (k !== "zeitraum" && k !== "eigene") p[k] = r.p[k];
              p.instanceId = ids.uhm;
              /* Gefiltert geladen: ein leeres Raster sagt dann "No matching data" (wie die Charts auf
                 Dashboard und Citations). */
              p.gefiltert = UC.seitenFilterAktiv ? UC.seitenFilterAktiv(state.f) : false;
              try { window.renderPerformanceRadar(p); } catch (e) {}
              if (o.zelleNeu) zelleWiederOeffnen();
            };
          });
        }
      };
    }
    function radarLaden(o) { if (bereit()) gemeinsam([radarAuftrag(o)]); }
    /* Neue Filter: der Radar laedt neu. Ist eine Zelle offen, geht ihr Detail sofort in den
       Ladezustand -- es zeigt sonst bis zur Antwort Zahlen des alten Filters unter dem neuen. */
    function filterLaden(o) {
      o = o || {};
      if (!bereit()) return;
      if (state.detail && !o.leise) {
        try { window.setPerformanceDetailLoading(ids.upd, "yes"); } catch (e) {}
        try { window.setUrlsTableLoading(ids.uut, "yes"); } catch (e) {}
      }
      gemeinsam([radarAuftrag({ zelleNeu: true, weich: !!o.leise })]);
    }
    /* DIE OFFENE ZELLE NACH EINEM NEUEN FILTER. Kopf, Kennzahlen und Rangliste des Details fuellt der
       Radar aus SEINEM Raster (performance-radar.js, feedDetail) -- nach neuen Filtern stehen dort
       andere Zahlen. Der Weg dahin ist derselbe wie beim Klick: die Zelle im neuen Raster anklicken.
       Das fuellt den Kopf und meldet uhmCellClick, und die Seite holt Kurve, Varianten und URLs mit
       dem neuen Stand (dieselbe Zelle: Suche, Sortierung und Typen der URL-Tabelle bleiben). Gibt es
       die Zelle nicht mehr (weggefiltert, ohne Werte), geht das Detail zu -- wie nach einer neuen
       Auswahl im Radar. Gesucht wird ueber die Attribute, nicht ueber einen Selektor mit der
       Kennung darin: so braucht es kein Escaping. Ein offenes Menue der Filterleiste bleibt
       dabei offen (gemessen 15.10.: Markets-Untermenue offen, Zelle neu geoeffnet, Menue steht). */
    function zelleWiederOeffnen() {
      var d = state.detail, r = root.querySelector(".uhm-root"), zelleEl = null;
      if (!d) return;
      if (r) [].some.call(r.querySelectorAll(".uhm-cell[data-company][data-topic]"), function (c) {
        if (c.getAttribute("data-company") !== d.firma || c.getAttribute("data-topic") !== d.topic) return false;
        zelleEl = c;
        return true;
      });
      if (zelleEl && !zelleEl.classList.contains("is-empty") && !zelleEl.classList.contains("is-sk")) zelleEl.click();
      else detailZu();
    }

    function zelle() { return { team: team(), firma: state.detail && state.detail.firma, topic: state.detail && state.detail.topic, f: filterStand() }; }
    /* Kurve und Varianten gemeinsam: der Detailbereich hat EINEN Ladezustand fuer beide. Scheitert
       einer der zwei, zeigt der Bereich seinen Lesefehler ("Could not load this cell") statt einer
       leeren Kurve, die wie "keine Daten" aussaehe. */
    /* SCHNELLE KLICKS BUENDELN (wie die Teile im Dashboard, 80 ms): jeder Zellklick kostet drei
       Abrufe (Kurve, Varianten, URLs), und Lesen ist je Funktion auf 60 pro Minute begrenzt. Wer mit
       Maus oder Tastatur ueber das Raster faehrt, loest so nur fuer die Zelle aus, auf der er
       stehen bleibt. Der Kopf des Detailbereichs steht trotzdem sofort -- den fuellt der Radar. */
    var detailUhr = null;
    function detailBald() {
      if (detailUhr) clearTimeout(detailUhr);
      try { window.setPerformanceDetailLoading(ids.upd, "yes"); } catch (e) {}
      detailUhr = setTimeout(function () { detailUhr = null; detailLaden(); }, 80);
    }
    /* Zeitraum des Radars plus die Stufe -- nur die Kurve kennt sie. */
    function kurvenZeit() { var z = state.zeitraum || {}; return { von: z.von, bis: z.bis, gran: state.gran }; }
    /* Nur die Kurve (nach D/W/M): eigener Kanal, die Antwort des juengsten Klicks gewinnt. */
    function kurveLaden() {
      if (!state.detail || !bereit()) return;
      var firma = state.detail.firma, a = D.kurve(zelle(), kurvenZeit());
      var nr = ++gruppeNr;
      juengsteJe.kurve = nr;
      laden("kurve", a).then(function (erg) {
        if (juengsteJe.kurve !== nr) return;
        var r = ergebnis(erg, function (d) { return D.zuKurve(d, firma); });
        if (r.ueberholt) return;
        if (!r.p) {
          state.fehler.detail = r.fehler;
          try { window.renderPerformanceDetail({ instanceId: ids.upd, __parseError: true }); } catch (e) {}
          return;
        }
        try { window.setPerformanceDetailSeries(ids.upd, r.p); } catch (e) {}
      });
    }
    function detailLaden() {
      if (!state.detail || !bereit()) return;
      var z = state.zeitraum || {}, ak = D.kurve(zelle(), kurvenZeit()), av = D.varianten(zelle(), z);
      var firma = state.detail.firma;
      function auftrag(kanal, a, umformen) {
        return {
          kanal: kanal, imSpeicher: lader.ausSpeicher(a) !== undefined,
          ladenAn: function () {},
          laden: function () { return laden(kanal, a).then(function (erg) { var r = ergebnis(erg, umformen); return r.ueberholt ? null : r; }); }
        };
      }
      var auftraege = [
        auftrag("kurve", ak, function (d) { return D.zuKurve(d, firma); }),
        auftrag("varianten", av, D.zuVarianten)
      ];
      if (!auftraege.every(function (x) { return x.imSpeicher; })) {
        try { window.setPerformanceDetailLoading(ids.upd, "yes"); } catch (e) {}
      }
      var nr = ++gruppeNr;
      juengsteJe.detail = nr;
      Promise.all(auftraege.map(function (x) { return x.laden(); })).then(function (r) {
        if (juengsteJe.detail !== nr || !r[0] || !r[1]) return;
        if (!r[0].p || !r[1].p) {
          state.fehler.detail = r[0].fehler || r[1].fehler;
          try { window.setPerformanceDetailLoading(ids.upd, "no"); } catch (e) {}
          try { window.renderPerformanceDetail({ instanceId: ids.upd, __parseError: true }); } catch (e) {}
          return;
        }
        state.fehler.detail = null;
        try { window.setPerformanceDetailSeries(ids.upd, r[0].p); } catch (e) {}
        try { window.setPerformanceDetailVariations(ids.upd, r[1].p); } catch (e) {}
        try { window.setPerformanceDetailLoading(ids.upd, "no"); } catch (e) {}
      });
      urlsLaden();
    }
    function urlsAuftrag() {
      var a = C.urls(D.urlFilter(zelle(), state.zeitraum, state.uf), state.url), reqId = state.url.requestId;
      return {
        kanal: "urls",
        imSpeicher: lader.ausSpeicher(a) !== undefined,
        ladenAn: function () { try { window.setUrlsTableLoading(ids.uut, "yes"); } catch (e) {} },
        laden: function () {
          return laden("urls", a).then(function (erg) {
            var r = ergebnis(erg, C.zuUrls);
            if (r.ueberholt) return null;
            return function () {
              if (!r.p) {
                state.fehler.urls = r.fehler;
                try { window.renderUrlsTable({ instanceId: ids.uut, __parseError: true }); } catch (e) {}
                return;
              }
              state.fehler.urls = null;
              var p = r.p;
              p.instanceId = ids.uut; p.isDark = isDark();
              if (reqId != null) p.requestId = reqId;
              if (state.eigene) { p.brand_name = str(state.eigene.name); p.brand_logo = str(state.eigene.logo_url); }
              try { window.renderUrlsTable(p); } catch (e) {}
            };
          });
        }
      };
    }
    function urlsLaden() { if (state.detail && bereit()) gemeinsam([urlsAuftrag()]); }

    function bedarf() {
      if (!bereit()) return;
      if (state.team && state.team !== team()) teamGewechselt();
      state.team = team(); persist();
      gemeinsam([radarAuftrag()]);
      if (state.detail) { detailZeigen(true); detailLaden(); }
    }
    /* Teamwechsel ohne Neuladen: andere Marken, andere Topics -- Auswahl und Zelle gehoeren zum
       alten Team. */
    function teamGewechselt() {
      lader.leeren();
      state.auswahl = { firmen: null, topics: null };
      state.zeitraum = null; state.eigene = null;
      detailZu();
      try { window.resetPerformanceRadar(ids.uhm); } catch (e) {}
      try { window.resetPerformanceDetail(ids.upd); } catch (e) {}
      state.team = team(); persist();
    }
    if (UC.onTeamChange) UC.onTeamChange(function () { if (state.team && state.team !== team()) bedarf(); }, root);

    var ctrl = {
      root: root, state: state, ids: ids,
      reset: function () {
        lader.leeren();
        state.auswahl = { firmen: null, topics: null };
        detailZu();
        try { window.resetPerformanceRadar(ids.uhm); } catch (e) {}
        try { window.resetPerformanceDetail(ids.upd); } catch (e) {}
        persist(); bedarf();
        return true;
      },
      neuLaden: function () { lader.leeren(); bedarf(); }
    };
    root.__upfCtrl = ctrl;
    detailZeigen(!!state.detail);
    /* Erst nach dem Aufbau der eingebetteten Bausteine: deren Skripte richten sich ueber
       watchRoots ein, ihre Setter greifen also erst einen Takt spaeter. Davor den Stand der
       Filterzeile uebernehmen (nach einem Neuaufbau kennen die Filter ihre Auswahl schon). */
    setTimeout(function () { filterAbgleichen(); persist(); bedarf(); }, 0);
    return ctrl;
  }

  /* ---- Mount ---------------------------------------------------------------------------------- */
  function alle() { return [].slice.call(document.querySelectorAll(".upf-root")); }
  function jede(id, fn) {
    var r = alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); });
    r.forEach(function (x) { var c = initRoot(x); if (c) fn(c); });
    return r.length > 0;
  }
  window.resetPerformancePage = function (id) { return jede(id, function (c) { c.reset(); }); };
  /* Einrichten, sobald die Wurzel zu sehen ist (Citations, 08.10.): Bubble setzt das Element in
     eine noch versteckte Ansicht; versteckt eingerichtet vermassen sich Radar und Kurve falsch. */
  function einrichten() {
    alle().forEach(function (r) {
      if (r.__upfCtrl) return;
      if (messbar(r)) { initRoot(r); return; }
      var neu = !(UC.wartetAufSicht && UC.wartetAufSicht(r));
      beiSicht(r, "einrichten", function () { initRoot(r); }, messbar, { lang: neu });
    });
  }
  if (UC.watchRoots) UC.watchRoots("upf-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }

  upfBoot(30);
})();
