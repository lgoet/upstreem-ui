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

   ZEITRAUM: die Seite hat keinen Kalender (wie bisher); die DB rechnet die letzten 30 Tage. Das
   Detail nimmt die Tage aus der Antwort des Radars, damit Zelle und Detail dieselben zeigen.

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
      fehler: {}
    };
    function persist() {
      gem.team = state.team; gem.auswahl = state.auswahl; gem.detail = state.detail; gem.url = state.url;
      gem.uf = state.uf; gem.zeitraum = state.zeitraum; gem.eigene = state.eigene;
    }
    var lader = gem.lader || (gem.lader = C.makeLader({
      rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 30000 }); }
    }));

    /* ---- Aufbau ------------------------------------------------------------------------------- */
    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    var ids = { uhm: instanceId + "_radar", upd: instanceId + "_detail", uut: instanceId + "_urls" };
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
    root.classList.add("up-sidebar-clear");
    root.innerHTML =
      '<div class="up-ph-top upf-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Performance")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Explore topic performance, compare brands, and uncover strengths and gaps")) + '</p></div>' +
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
      persist();
      detailZeigen(true);
      detailBald();
    });
    an("upd-bubble_fn_updClose", function () { detailZu(); });
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
      try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, { export_type: "urls" }); } catch (err) {}
    }, true);

    /* ---- Laden ---------------------------------------------------------------------------------
       Nur solange die Seite zu sehen ist und ein Team bekannt ist (wie Citations). */
    function sichtbarTest(el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); }
    function bereit() {
      if (!sichtbarTest(root)) { beiSicht(root, "laden", function () { bedarf(); }, sichtbarTest); return false; }
      return !!team();
    }
    /* Mehrere Teile gemeinsam zeigen (Muster der Citations-Seite): alle in den Ladezustand, alle
       Anfragen gleichzeitig hinaus, gezeichnet wird erst, wenn alle da sind -- und je Kanal nur aus
       der juengsten Gruppe. Liegt alles im Speicher, steht es sofort, ohne Ladezustand. */
    var gruppeNr = 0, juengsteJe = {};
    function gemeinsam(auftraege) {
      var nr = ++gruppeNr;
      auftraege.forEach(function (a) { juengsteJe[a.kanal] = nr; });
      if (!auftraege.every(function (a) { return a.imSpeicher; })) auftraege.forEach(function (a) { a.ladenAn(); });
      return Promise.all(auftraege.map(function (a) { return a.laden(); })).then(function (zeigen) {
        zeigen.forEach(function (z, i) { if (z && juengsteJe[auftraege[i].kanal] === nr) z(); });
      });
    }
    function laden(kanal, a) { return lader.laden(kanal, a); }
    function ergebnis(erg, umformen) {
      if (erg.ueberholt) return { ueberholt: true };
      var p = erg.ok ? umformen(erg.daten) : null;
      return p ? { p: p } : { fehler: erg.ok ? "x" : C.fehlerArt(erg) };
    }

    function radarAuftrag(o) {
      o = o || {};
      var a = D.radar({ team: team(), firmen: state.auswahl.firmen, topics: state.auswahl.topics });
      return {
        kanal: "radar",
        imSpeicher: lader.ausSpeicher(a) !== undefined,
        /* Nach einer Auswahl dimmt sich der Radar selbst (weich), sonst das Skelett. */
        ladenAn: function () { if (!o.weich) { try { window.setPerformanceRadarLoading(ids.uhm, "yes"); } catch (e) {} } },
        laden: function () {
          return laden("radar", a).then(function (erg) {
            var r = ergebnis(erg, D.zuRadar);
            if (r.ueberholt) return null;
            return function () {
              if (!r.p) {
                state.fehler.radar = r.fehler;
                try { window.renderPerformanceRadar({ instanceId: ids.uhm, __parseError: true }); } catch (e) {}
                return;
              }
              state.fehler.radar = null;
              state.zeitraum = r.p.zeitraum;
              if (r.p.eigene) state.eigene = r.p.eigene;
              persist();
              var p = {}, k;
              for (k in r.p) if (k !== "zeitraum" && k !== "eigene") p[k] = r.p[k];
              p.instanceId = ids.uhm;
              try { window.renderPerformanceRadar(p); } catch (e) {}
            };
          });
        }
      };
    }
    function radarLaden(o) { if (bereit()) gemeinsam([radarAuftrag(o)]); }

    function zelle() { return { team: team(), firma: state.detail && state.detail.firma, topic: state.detail && state.detail.topic }; }
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
    function detailLaden() {
      if (!state.detail || !bereit()) return;
      var z = state.zeitraum || {}, ak = D.kurve(zelle(), z), av = D.varianten(zelle(), z);
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
       watchRoots ein, ihre Setter greifen also erst einen Takt spaeter. */
    setTimeout(function () { bedarf(); }, 0);
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
