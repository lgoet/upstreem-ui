/* upstreem citations-page.js -- die Citations-Seite als EINE Komponente (08.10.). Praefix ucs.

   Kopf mit Krumen und Reitern (Domains, URLs), Kalender und Filter, Combo-Chart und die Tabelle
   des Reiters -- wie Shopping und Ads in einem Stueck. Chart und Tabellen sind die ECHTEN
   Bausteine der App (citations-combo-chart.js, domains-table.js, urls-table.js) im lokalen Modus:
   ihr Markup kommt aus den Bubble-Vorlagen (.citations_markup.py), ihre Ereignisse kommen als
   DOM-Ereignis hierher statt an Bubble, und diese Seite fuellt sie ueber ihre eigenen Setter.
   Dieselben Bausteine an anderen Orten (Drawer, andere Reusables) tragen kein data-local und
   arbeiten unveraendert weiter ueber Bubble.

   DATEN: direkt ueber UC.rpc (PostgREST, Nutzer-JWT), die vier RPCs aus
   bubble/citations_v1_vertrag.md. Wie die Anfragen aussehen und wie die Antworten in die Form der
   Bausteine kommen, steht in citations-data.js (ohne DOM, fuer spaeter mitzunehmen). Hier steht
   nur: wann was geladen wird und wohin es geht.

   FILTER (08.10.): der Kalender gilt app-weit (sein "Apply to all"), alles andere gilt fuer DIESE
   Seite und fuer beide Reiter gemeinsam -- Models, Markets, Topics und das Filter-Menue der
   Tabellen (Typen, "Brand mentioned", Marken).

   ADRESSE: ?cit=urls fuer den zweiten Reiter (Domains ist die Vorgabe und steht nicht drin).
   Zeilen oeffnen die Drawer der App selbst: openDrawer("domain", domain), openDrawer("url", url). */
(function () {
  "use strict";

  var API_NAMES = ["resetCitationsPage"];
  var Q = (window.__ucsBootQueue = window.__ucsBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function ucsBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemCitationsDaten) {
      if (triesLeft > 0) { setTimeout(function () { ucsBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[citations-page] core.js oder citations-data.js nicht geladen");
      return;
    }
    ucsStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .citations_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    combo: "<div class=\"up-root combo-root\" data-local=\"yes\" data-instance=\"__UCS_COMBO__\" data-cdn-pin=\"\" data-isdark=\"__UCS_DARK__\" data-processing=\"no\" data-processing2=\"no\"><div class=\"combo-unit combo-unit-left\"><div class=\"combo-head\"><div class=\"combo-heading\">Citation Share</div><div class=\"combo-head-tools\"><div class=\"cc-gran\" role=\"tablist\" aria-label=\"Granularity\"><button class=\"cc-gran-btn is-active\" data-gran=\"day\" type=\"button\" role=\"tab\">Day</button><button class=\"cc-gran-btn\" data-gran=\"week\" type=\"button\" role=\"tab\">Week</button><button class=\"cc-gran-btn\" data-gran=\"month\" type=\"button\" role=\"tab\">Month</button></div><div class=\"combo-filter\"><button class=\"combo-filter-btn combo-iconbtn\" type=\"button\" data-tip=\"Filter brands\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg><span class=\"combo-filter-badge\"></span></button><div class=\"combo-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"combo-maximize combo-iconbtn\" type=\"button\" data-tip=\"Maximize\" aria-label=\"Maximize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button></div></div><div class=\"combo-box combo-box-left\"><div class=\"combo-panel-body\"><button class=\"ccl-settings-btn\" type=\"button\" data-tip=\"Chart Settings\" aria-label=\"Chart Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><div class=\"up-line-wrap\"><canvas class=\"up-line-canvas\"></canvas></div><div class=\"up-legend\"></div></div></div></div><div class=\"combo-unit combo-unit-right\"><div class=\"combo-head\"><div class=\"combo-heading combo-heading-right\">Citation Type Split</div><div class=\"combo-head-tools\"><div class=\"cc-seg\" role=\"tablist\" aria-label=\"Chart type\"><button class=\"cc-seg-btn is-active\" data-chart=\"doughnut\" role=\"tab\" aria-selected=\"true\" data-tip=\"Doughnut\" aria-label=\"Doughnut\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.5 15.8278C17.9985 21.756 9.86407 23.4835 5.20143 18.8641C0.629484 14.3347 2.04493 6.12883 8.05653 3.5\"/><path d=\"M17.6831 12.5C19.5708 12.5 20.5146 12.5 21.1241 11.655C21.1469 11.6234 21.1848 11.5667 21.2052 11.5336C21.7527 10.6471 21.4705 9.966 20.9063 8.60378C20.3946 7.36853 19.6447 6.24615 18.6993 5.30073C17.7538 4.35531 16.6315 3.60536 15.3962 3.0937C14.034 2.52946 13.3529 2.24733 12.4664 2.79477C12.4333 2.81523 12.3766 2.85309 12.345 2.87587C11.5 3.4854 11.5 4.42922 11.5 6.31686V8.42748C11.5 10.3473 11.5 11.3072 12.0964 11.9036C12.6928 12.5 13.6527 12.5 15.5725 12.5H17.6831Z\"/></svg></button><button class=\"cc-seg-btn\" data-chart=\"bar\" role=\"tab\" aria-selected=\"false\" data-tip=\"Bars\" aria-label=\"Bars\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H21\"/><path d=\"M7 8V9C7 9.55228 7.44772 10 8 10H18C18.5523 10 19 9.55228 19 9V8C19 7.44772 18.5523 7 18 7H8C7.44772 7 7 7.44772 7 8Z\"/><path d=\"M7 15V16C7 16.5523 7.44772 17 8 17H14C14.5523 17 15 16.5523 15 16V15C15 14.4477 14.5523 14 14 14H8C7.44772 14 7 14.4477 7 15Z\"/></svg></button></div><button class=\"combo-hide combo-iconbtn\" type=\"button\" data-tip=\"Hide\" aria-label=\"Hide\"><svg class=\"ic-hide\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2 8C2 8 6.47715 3 12 3C17.5228 3 22 8 22 8\"/><path d=\"M21.544 13.045C21.848 13.4713 22 13.6845 22 14C22 14.3155 21.848 14.5287 21.544 14.955C20.1779 16.8706 16.6892 21 12 21C7.31078 21 3.8221 16.8706 2.45604 14.955C2.15201 14.5287 2 14.3155 2 14C2 13.6845 2.15201 13.4713 2.45604 13.045C3.8221 11.1294 7.31078 7 12 7C16.6892 7 20.1779 11.1294 21.544 13.045Z\"/><path d=\"M15 14C15 12.3431 13.6569 11 12 11C10.3431 11 9 12.3431 9 14C9 15.6569 10.3431 17 12 17C13.6569 17 15 15.6569 15 14Z\"/></svg><svg class=\"ic-show\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6.43385 6.51953C4.22009 7.89049 2.93281 9.86457 2.31858 11.0339C2.10621 11.4382 2.00003 11.6403 2 12.0082C1.99997 12.3761 2.10584 12.5777 2.3176 12.981C3.32862 14.9066 6.16702 19.0195 11.9669 19.0195C14.2454 19.0195 16.0669 18.3848 17.5 17.4972\"/><path d=\"M9.87868 9.87868C9.33579 10.4216 9 11.1716 9 12C9 13.6569 10.3431 15 12 15C12.8284 15 13.5784 14.6642 14.1213 14.1213\"/><path d=\"M2 2L22 22\"/><path d=\"M10 5.14847C10.5934 5.05255 11.224 5 11.8936 5C17.7747 5 20.6528 9.05385 21.6779 10.9517C21.8927 11.3492 22 11.548 22 11.9106C22 12.2733 21.8921 12.4727 21.6765 12.8717C21.3678 13.4428 20.8916 14.2085 20.2167 15\"/></svg></button></div></div><div class=\"combo-box combo-box-right\"><div class=\"combo-panel-body\"><div class=\"cc-type-root\"><div class=\"cc-top\"><div class=\"cc-top-total\"><span class=\"n\">0</span><span class=\"lbl\">Citations</span></div></div><div class=\"up-donut-body\"></div></div></div></div></div></div>",
    udt: "<div class=\"up-root udt-root\" data-local=\"yes\" data-instance=\"__UCS_UDT__\" data-cdn-pin=\"\" data-isdark=\"__UCS_DARK__\" data-brand-name=\"__UCS_BRAND__\" data-brand-logo=\"__UCS_BRANDLOGO__\" data-export-instance=\"\" data-sticky-top=\"16\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Domains</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"udt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"udt-brand-toggle-lbl\"><img class=\"udt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"udt-brand-label\"></span></span><span class=\"udt-brand-check\"><svg class=\"udt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"udt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-filter\"><button class=\"up-filter-btn\" type=\"button\" data-tip=\"Filter Citation Types\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-filter-btn-lbl\">All Types</span><svg class=\"up-filter-btn-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-filter-btn-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Type in domain...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search domains\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"udt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th up-th-domain\">Domain<span class=\"up-grip\" data-grip=\"domain\"></span></div><div class=\"up-th up-th-share is-sortable\" data-sortcol=\"share\"><span class=\"up-th-txt\">Share</span><span class=\"up-th-info\" data-explain=\"share\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"share\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-used\">Used<span class=\"up-th-info\" data-explain=\"used\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-type\">Type<span class=\"up-th-info\" data-explain=\"type\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-lastseen is-sortable\" data-sortcol=\"last_seen\"><span class=\"up-th-txt\">Last Seen</span><span class=\"up-thsort\" data-for=\"last_seen\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th udt-th-actions\">Actions</div></div><div class=\"up-tbody\"></div></div></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>",
    uut: "<div class=\"up-root uut-root\" data-local=\"yes\" data-instance=\"__UCS_UUT__\" data-cdn-pin=\"\" data-isdark=\"__UCS_DARK__\" data-domain-mode=\"no\" data-brand-name=\"__UCS_BRAND__\" data-brand-logo=\"__UCS_BRANDLOGO__\" data-export-instance=\"\" data-sticky-top=\"16\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">URLs</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"uut-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"uut-brand-toggle-lbl\"><img class=\"uut-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"uut-brand-label\"></span></span><span class=\"uut-brand-check\"><svg class=\"uut-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"uut-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-filter\"><button class=\"up-filter-btn\" type=\"button\" data-tip=\"Filter Citation and URL Types\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-filter-btn-lbl\">All Types</span><svg class=\"up-filter-btn-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-filter-btn-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Type in url...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search URLs\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"uut-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th up-th-domain\">URL<span class=\"up-grip\" data-grip=\"domain\"></span></div><div class=\"up-th up-th-share is-sortable\" data-sortcol=\"share\"><span class=\"up-th-txt\">Share</span><span class=\"up-th-info\" data-explain=\"share\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"share\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-type\">Type<span class=\"up-th-info\" data-explain=\"type\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-ment\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">mentioned</span></div><div class=\"up-th up-th-brands\">Brands mentioned<span class=\"up-th-info\" data-explain=\"brands\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-lastseen is-sortable\" data-sortcol=\"last_seen\"><span class=\"up-th-txt\">Last Seen</span><span class=\"up-thsort\" data-for=\"last_seen\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th uut-th-actions\">Actions</div></div><div class=\"up-tbody\"></div></div></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function ucsStart() {
  var UC = window.UpstreemCore, D = window.UpstreemCitationsDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__ucsStore = window.__ucsStore || {});

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function liste(s) { return String(s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function eigeneMarke() {
    var l = UC.getBrands ? UC.getBrands() : [];
    for (var i = 0; i < l.length; i++) if (l[i] && String(l[i].role || "").toLowerCase() === "own") return l[i];
    return null;
  }

  /* Die Reiter wie im bisherigen Seitenkopf (citations-page-header.js): derselbe Globus von Hand,
     das URL-Zeichen aus core. */
  var REITER = [
    { value: "domains", label: "Domains",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /> <path d="M2 12h20" /></svg>' },
    { value: "urls", label: "URLs", icon: UC.icon ? UC.icon("linkFeather", 2) : "" }
  ];
  var REFRESH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" /> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /> <path d="M8 16H3v5" /></svg>';

  /* ---- SOBALD SICHTBAR: ohne Dauerlauf (08.10.) -----------------------------------------------
     Die Ansichten der App sind beim Seitenaufbau versteckt und werden spaeter nur per Stil
     sichtbar -- ohne neuen Knoten, also ohne Meldung von watchRoots. Statt laufend nachzusehen,
     wird nur in einem KURZEN, BEGRENZTEN Fenster nachgesehen: nach dem Laden dieser Datei (bis
     10s) und nach jedem Ansichtswechsel der App (showView, ueber UC.onViewChange; bis 3s, weil
     Bubble die Gruppe erst nach showView einblendet). Danach laeuft nichts, bis die App wieder
     eine Ansicht oeffnet. Die Bubble-App ruft showView auch beim Seitenaufbau.
     beiSicht(el, schluessel, fn, test): fn einmal, sobald test(el) wahr ist. Derselbe Schluessel
     ersetzt einen wartenden Eintrag, statt einen zweiten anzulegen. */
  var SICHT = [], sichtUhren = [];
  /* Beim Seitenaufbau alle 500ms bis 10s (20 Blicke, jeder eine Sichtbarkeitsabfrage) -- ohne
     showView waere eine Ansicht, die nach 7s aufgeht, mit groben Stufen erst bei 10s da gewesen
     (gemessen). Nach einem Ansichtswechsel bis 3s. */
  var FENSTER_START = [0, 150, 300], FENSTER_WECHSEL = [0, 250, 750, 1500, 3000];
  for (var fs = 500; fs <= 10000; fs += 500) FENSTER_START.push(fs);
  function sichtPruefen() {
    SICHT = SICHT.filter(function (w) {
      if (w.el.isConnected === false) return false;
      var da = false;
      try { da = w.test(w.el); } catch (e) { da = true; }
      if (!da) return true;
      try { w.fn(); } catch (e) {}
      return false;
    });
    if (!SICHT.length) { sichtUhren.forEach(clearTimeout); sichtUhren = []; }
  }
  function sichtFenster(stufen) {
    sichtUhren.forEach(clearTimeout);
    sichtUhren = stufen.map(function (ms) { return setTimeout(sichtPruefen, ms); });
  }
  function beiSicht(el, schluessel, fn, test) {
    SICHT = SICHT.filter(function (w) { return !(w.el === el && w.schluessel === schluessel); });
    SICHT.push({ el: el, schluessel: schluessel, fn: fn, test: test });
    if (!sichtUhren.length) sichtFenster(FENSTER_WECHSEL);
  }
  if (UC.onViewChange) UC.onViewChange(function () { if (SICHT.length) sichtFenster(FENSTER_WECHSEL); });
  function messbar(el) { return !UC.messbar || UC.messbar(el); }

  function initRoot(root) {
    if (root.__ucsCtrl) return root.__ucsCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "citations_page";
    if (instanceId === "INSTANCE_ID") return null;
    var gem = STORE[instanceId] || {};
    var ohneAdresse = root.getAttribute("data-adresse") === "aus";

    function tabelleVorgabe() { return { suche: "", order: "share_desc", limit: UC.DEFAULT_PAGE_SIZE || 15, offset: 0, requestId: null }; }
    var state = {
      tab: "domains",
      f: gem.f || { von: "", bis: "", modelle: null, maerkte: null, topics: null, tagmode: "or",
                    erwaehnt: "all", marken: null, citationTypen: null, urlTypen: null },
      gran: gem.gran || "day",
      dom: gem.dom || tabelleVorgabe(),
      url: gem.url || tabelleVorgabe(),
      kalenderDa: false,
      fehler: {}
    };
    var adr = adresseLesen();
    state.tab = adr || gem.tab || "domains";
    function persist() {
      STORE[instanceId] = { tab: state.tab, f: state.f, gran: state.gran, dom: state.dom, url: state.url };
    }

    var lader = D.makeLader({ rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 30000 }); } });

    /* ---- Aufbau ------------------------------------------------------------------------------- */
    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    var ids = {
      daten: instanceId + "_dates", filter: instanceId + "_filters", modelle: instanceId + "_models",
      maerkte: instanceId + "_markets", topics: instanceId + "_topics",
      combo: instanceId + "_combo", udt: instanceId + "_domains", uut: instanceId + "_urls"
    };
    function einsetzen(m, kennung) {
      var marke = eigeneMarke();
      return String(m || "").split("__UCS_COMBO__").join(esc(ids.combo))
        .split("__UCS_UDT__").join(esc(ids.udt)).split("__UCS_UUT__").join(esc(ids.uut))
        .split("__UCS_DARK__").join(isDark() ? "yes" : "no")
        .split("__UCS_BRANDLOGO__").join(esc(marke ? str(marke.logo_url) : ""))
        .split("__UCS_BRAND__").join(esc(marke ? str(marke.name) : ""));
    }
    var dk = isDark() ? "yes" : "no";
    root.classList.add("up-sidebar-clear");
    root.innerHTML =
      '<div class="up-ph-top ucs-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Citations")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Analyze the domains and URLs influencing your visibility in AI responses")) + '</p></div>' +
        '<button class="up-ph-iconbtn ucs-refresh" type="button" aria-label="' + esc(t("Refresh")) + '" data-tip="' + esc(t("Refresh Data")) + '">' + REFRESH_SVG + '</button>' +
      '</div>' +
      '<div class="up-ph-nav ucs-nav" role="tablist"></div>' +
      '<div class="ucs-filterzeile">' +
        '<div class="up-root udr-root ucs-daten" data-instance="' + esc(ids.daten) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root ufb-root ucs-filterleiste" data-instance="' + esc(ids.filter) + '" data-topics-instance="' + esc(ids.topics) + '"' +
          ' data-models-instance="' + esc(ids.modelle) + '" data-markets-instance="' + esc(ids.maerkte) + '" data-isdark="' + dk + '"></div>' +
        '<div class="up-root utf-root" data-instance="' + esc(ids.topics) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root umf-root" data-instance="' + esc(ids.modelle) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root umk-root" data-instance="' + esc(ids.maerkte) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
      '</div>' +
      '<div class="ucs-main">' +
        '<div class="ucs-chart">' + einsetzen(MARKUP.combo) + '</div>' +
        '<div class="ucs-tab" data-ucs-tab="domains">' + einsetzen(MARKUP.udt) + '</div>' +
        '<div class="ucs-tab" data-ucs-tab="urls">' + einsetzen(MARKUP.uut) + '</div>' +
      '</div>';

    var elNav = root.querySelector(".ucs-nav"), elRefresh = root.querySelector(".ucs-refresh");
    var nav = UC.makePageNav ? UC.makePageNav(root, {
      nav: elNav, storeKey: instanceId + "|ucs-nav", selected: state.tab,
      pages: REITER, onSelect: function (v) { reiterOeffnen(v, true); }
    }) : null;
    var krumen = UC.makePageCrumbs ? UC.makePageCrumbs(root, { icon: "globe", name: "Citations", quelle: elNav, komponente: true }) : null;
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* ---- Reiter und Adresse ------------------------------------------------------------------- */
    function adresseLesen() {
      if (ohneAdresse) return null;
      try { var c = new URL(window.location.href).searchParams.get("cit"); return c === "urls" ? "urls" : null; }
      catch (e) { return null; }
    }
    function adresseSetzen(neuerEintrag) {
      if (ohneAdresse) return;
      try {
        var u = new URL(window.location.href);
        if (state.tab === "urls") u.searchParams.set("cit", "urls"); else u.searchParams.delete("cit");
        var neu = u.pathname + u.search + u.hash;
        if (neu === window.location.pathname + window.location.search + window.location.hash) return;
        if (neuerEintrag) window.history.pushState(window.history.state, "", neu);
        else window.history.replaceState(window.history.state, "", neu);
      } catch (e) {}
    }
    function reiterZeigen() {
      root.querySelectorAll(".ucs-tab").forEach(function (el) { el.hidden = el.getAttribute("data-ucs-tab") !== state.tab; });
      root.setAttribute("data-ucs-reiter", state.tab);
      if (krumen && krumen.zeichnen) krumen.zeichnen();
    }
    function reiterOeffnen(v, neuerEintrag) {
      v = v === "urls" ? "urls" : "domains";
      if (v === state.tab) return;
      state.tab = v;
      if (nav && nav.selectPage) { try { nav.selectPage(v, false); } catch (e) {} }
      persist(); adresseSetzen(neuerEintrag); reiterZeigen();
      bedarf();
    }
    window.addEventListener("popstate", function () {
      if (root.isConnected === false) return;
      var a = adresseLesen() || "domains";
      if (a !== state.tab) reiterOeffnen(a, false);
    });

    /* ---- Filter --------------------------------------------------------------------------------
       Kalender und die drei Filter sind lokale Instanzen: ihre Auswahl kommt als DOM-Ereignis. */
    function setzen(feld, wert) {
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
    function auswahl(feld, d, schluessel) {
      var gew = liste(d && d[schluessel]);
      if (!gew.length) return null;
      if (d.select_mode !== "exclude") return gew;
      var alle = feld === "modelle"
        ? (UC.getModels ? UC.getModels() : []).map(function (m) { return str(m.key || m.model); })
        : (UC.getAllMarkets ? toArr(UC.getAllMarkets()) : []).map(function (m) { return str(m.alpha2 || m.alpha3 || m.code || m.market).toUpperCase(); });
      return alle.filter(function (k) { return k && gew.indexOf(k) < 0; });
    }
    /* Neue Filter sind ein neuer Ergebnissatz: beide Tabellen zurueck auf die erste Seite. */
    function filterGeaendert() {
      state.dom.offset = 0; state.url.offset = 0;
      persist(); bedarf();
    }
    root.addEventListener("umf-models", function (e) { if (setzen("modelle", auswahl("modelle", e.detail, "model_keys"))) filterGeaendert(); });
    root.addEventListener("umk-markets", function (e) { if (setzen("maerkte", auswahl("maerkte", e.detail, "market_codes"))) filterGeaendert(); });
    root.addEventListener("utf-topics", function (e) {
      var d = e.detail || {}, l = liste(d.topic_ids);
      var a = setzen("topics", l.length ? l : null), b = setzen("tagmode", d.tag_mode === "and" ? "and" : "or");
      if (a || (b && l.length)) filterGeaendert();
    });
    function kalender() { var k = root.querySelector(".ucs-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
    /* DIE STUFE FOLGT DEM ZEITRAUM (UC.granFuerZeitraum, wie SET GRAN in Bubble): bei jedem neuen
       Zeitraum neu, dazwischen gilt, was im Chart gewaehlt wurde. */
    function zeitraum(von, bis) {
      var a = setzen("von", von), b = setzen("bis", bis);
      state.kalenderDa = true;
      if ((a || b) && UC.granFuerZeitraum) {
        var g = UC.granFuerZeitraum(von, bis);
        if (g) state.gran = g;
      }
      return a || b;
    }
    function kalenderLesen() {
      var c = kalender(), r = null;
      try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
      if (!r || !r.from || !r.to) return false;
      return zeitraum(r.from, r.to);
    }
    root.addEventListener("change", function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains("ucs-daten")) return;
      var d = e.detail || {};
      if (!d.date_from || !d.date_to) return;
      if (zeitraum(d.date_from, d.date_to)) filterGeaendert();
    });
    function filterAbgleichen() {
      var g = kalenderLesen();
      var m = root.querySelector(".umf-root"), k = root.querySelector(".umk-root"), tp = root.querySelector(".utf-root");
      try { if (m && m.__umfCtrl) g = setzen("modelle", auswahl("modelle", m.__umfCtrl.getSelected(), "model_keys")) || g; } catch (e) {}
      try { if (k && k.__umkCtrl) g = setzen("maerkte", auswahl("maerkte", k.__umkCtrl.getSelected(), "market_codes")) || g; } catch (e) {}
      try {
        if (tp && tp.__utfCtrl) {
          var s = tp.__utfCtrl.getSelected(), l = liste(s.topic_ids);
          g = setzen("topics", l.length ? l : null) || g;
          g = setzen("tagmode", s.tag_mode === "and" ? "and" : "or") || g;
        }
      } catch (e) {}
      return g;
    }

    /* ---- Ereignisse der Tabellen und des Charts ------------------------------------------------
       Die Tabellen feuern lokal "udt-udt<Name>" bzw. "uut-uut<Name>" (makeFire: Praefix plus Name).
       Such-, Sortier- und Seitenstand gehoeren der jeweiligen Tabelle, das Filter-Menue beiden. */
    function tabStand(art) { return art === "urls" ? state.url : state.dom; }
    /* Das Filter-Menue gehoert beiden Tabellen: nach jeder Aenderung zeigen BEIDE dieselbe
       Auswahl (setDomainsTableFilters / setUrlsTableFilters setzen nur die Anzeige, ohne Ereignis). */
    function menuesAngleichen() {
      var f = state.f;
      var o = { citation_types: f.citationTypen || [], brands: f.marken || [], brand_mentioned: f.erwaehnt === "yes" || f.erwaehnt === "no" ? f.erwaehnt : "" };
      try { if (window.setDomainsTableFilters) window.setDomainsTableFilters(ids.udt, o); } catch (e) {}
      o.url_types = f.urlTypen || [];
      try { if (window.setUrlsTableFilters) window.setUrlsTableFilters(ids.uut, o); } catch (e) {}
    }
    function aufTabellen(art, praefix) {
      function an(name, fn) { root.addEventListener(praefix + name, function (e) { fn(e.detail || {}); }); }
      var kurz = praefix === "udt-" ? "udt" : "uut";
      an(kurz + "Search", function (d) {
        var s = tabStand(art);
        s.suche = str(d.query); s.requestId = d.requestId != null ? d.requestId : null; s.offset = 0;
        persist(); tabelleLaden(art);
      });
      an(kurz + "Sort", function (d) { var s = tabStand(art); s.order = str(d.order) || s.order; s.offset = 0; persist(); tabelleLaden(art); });
      an(kurz + "Page", function (d) {
        var s = tabStand(art), l = num(d.limit), o = num(d.offset);
        if (l != null) s.limit = l;
        if (o != null) s.offset = o;
        persist(); tabelleLaden(art);
      });
      an(kurz + "Filter", function (d) {
        var a = setzen("citationTypen", liste(d.citation_types).length ? liste(d.citation_types) : null);
        var b = art === "urls" ? setzen("urlTypen", liste(d.url_types).length ? liste(d.url_types) : null) : false;
        if (a || b) { menuesAngleichen(); filterGeaendert(); }
      });
      an(kurz + "Mentioned", function (d) { if (setzen("marken", liste(d.brands).length ? liste(d.brands) : null)) { menuesAngleichen(); filterGeaendert(); } });
      an(kurz + "Brand", function (d) {
        var v = str(d.brand_mentioned);
        if (setzen("erwaehnt", v === "yes" || v === "no" ? v : "all")) { menuesAngleichen(); filterGeaendert(); }
      });
      an(kurz + "RowClick", function (d) {
        if (art === "urls") { if (UC.drawerOeffnen) UC.drawerOeffnen("url", str(d.url), "citations"); }
        else if (UC.drawerOeffnen) UC.drawerOeffnen("domain", str(d.domain), "citations");
      });
    }
    aufTabellen("domains", "udt-");
    aufTabellen("urls", "uut-");
    root.addEventListener("udt-udtOpenUrl", function (e) { var d = e.detail || {}; if (UC.drawerOeffnen) UC.drawerOeffnen("url", str(d.url), "citations"); });
    root.addEventListener("udt-udtShowPages", function (e) { drilldownLaden(e.detail || {}); });
    root.addEventListener("comboGranularity", function (e) {
      var g = str(e.detail && e.detail.gran);
      if (g !== "day" && g !== "week" && g !== "month") return;
      if (g === state.gran) return;
      state.gran = g; persist(); chartLaden();
    });
    /* EXPORT (08.10. gemeldet: "keiner der Export-Knoepfe funktioniert"). Die Tabellen oeffnen das
       Export-Fenster der App (export-data.js, ein eigenes Bubble-Element) ueber dessen Kennung in
       data-export-instance -- die stand hier leer, der Klick lief ins Leere. Jetzt setzt die Seite
       sie VOR dem Klick der Tabelle (Fangphase): aus ihrem eigenen data-export-instance, sonst vom
       Export-Element, das auf der Seite steht. Dazu der Typ des Reiters (domains/urls), damit das
       Fenster richtig vorgewaehlt aufgeht. Steht kein Export-Element auf der Seite, sagt die Seite
       es, statt still nichts zu tun. */
    function exportKennung() {
      var k = str(root.getAttribute("data-export-instance")).trim();
      if (k && !/^[A-Z_]{3,}$/.test(k)) return k;
      var e = document.querySelector(".uex-root[data-instance]");
      k = e ? str(e.getAttribute("data-instance")).trim() : "";
      return k && !/^[A-Z_]{3,}$/.test(k) ? k : "";
    }
    root.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".up-export") : null;
      var tab = b && b.closest(".udt-root, .uut-root");
      if (!tab || !root.contains(tab)) return;
      var k = exportKennung();
      if (!k || typeof window.upstreemExportOpen !== "function") {
        e.stopPropagation();
        if (UC.toast) UC.toast(t("Export is not available on this page."));
        return;
      }
      tab.setAttribute("data-export-instance", k);
      try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, { export_type: tab.classList.contains("uut-root") ? "urls" : "domains" }); } catch (err) {}
    }, true);
    if (elRefresh) elRefresh.addEventListener("click", function () {
      if (UC.spinOnce) UC.spinOnce(elRefresh);
      aktualisieren();
    });

    /* ---- Laden ---------------------------------------------------------------------------------
       Geladen wird nur, was der offene Reiter braucht, und nur, solange die Seite zu sehen ist.
       Ohne Team und ohne Kalender gibt es keine erste Anfrage: die Zahlen muessen genau diesen
       Zeitraum und dieses Team haben. */
    function sichtbarTest(el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); }
    function sichtbar() { return sichtbarTest(root); }
    var warteUhr = null, kalenderVersuche = 0;
    function spaeter(ms) { if (!warteUhr) warteUhr = setTimeout(function () { warteUhr = null; bedarf(); }, ms); }
    function filterStand() { var f = {}, k; for (k in state.f) f[k] = state.f[k]; f.team = team(); return f; }
    /* Verdeckt: KEIN Nachfragen im Takt (frueher jede Sekunde, solange die Ansicht geparkt war) --
       geladen wird, sobald die Ansicht wieder aufgeht (beiSicht). Ohne Team ebenso nicht: der
       erste setUpstreemTeam meldet sich ueber UC.onTeamChange (unten) und laedt dann. Nur das
       Warten auf den Kalender laeuft im Takt, und das ist auf 20 Versuche begrenzt. */
    function bereit() {
      if (!sichtbar()) { beiSicht(root, "laden", function () { bedarf(); }, sichtbarTest); return false; }
      if (!team()) return false;
      if (!state.kalenderDa && !kalenderLesen()) {
        /* Fehlt date-range.js ganz, laedt die Seite nach 3s ohne Zeitraum: die RPCs nehmen dann
           ihre Vorgabe (Vertrag: die letzten 7 Tage). */
        if (kalenderVersuche++ < 20) { spaeter(150); return false; }
      }
      return true;
    }
    /* CHART UND TABELLE ZEIGEN GEMEINSAM (08.10. angefordert: "nur weil eine vielleicht frueher
       fertig ist, darf die nicht schon Daten zeigen, wenn die andere noch laedt"). Bei allem, was
       BEIDE betrifft -- Oeffnen, Reiter, Filter, Zeitraum, Aktualisieren, Teamwechsel -- gehen beide
       in den Ladezustand, beide RPCs gehen GLEICHZEITIG hinaus (kein Nacheinander), und gezeichnet
       wird erst, wenn beide Antworten da sind. Liegt eine davon schon im Speicher, wartet sie auf
       die andere; liegen beide da, steht alles sofort.
       Was nur EINEN Teil betrifft, laeuft allein: Suche, Sortierung, Seite (Tabelle) und D/W/M
       (Chart). Gezeichnet wird je TEIL nur aus der juengsten Gruppe, die ihn angefordert hat: tippt
       jemand in die Suche, waehrend das gemeinsame Laden noch laeuft, uebernimmt die neue Anfrage
       die Tabelle -- der Chart der aelteren Gruppe kommt trotzdem (sonst bliebe er im Skelett). */
    var gruppeNr = 0, juengsteJe = {};
    function gemeinsam(auftraege, o) {
      o = o || {};
      var nr = ++gruppeNr;
      auftraege.forEach(function (a) { juengsteJe[a.kanal] = nr; });
      var alleDa = !o.frisch && auftraege.every(function (a) { return a.imSpeicher; });
      if (!alleDa) auftraege.forEach(function (a) { a.ladenAn(); });
      var vorab = o.vorab ? Promise.resolve(o.vorab).then(null, function () {}) : Promise.resolve();
      return vorab.then(function () {
        return Promise.all(auftraege.map(function (a) { return a.laden(o.frisch); }));
      }).then(function (zeigen) {
        zeigen.forEach(function (z, i) { if (z && juengsteJe[auftraege[i].kanal] === nr) z(); });
      });
    }
    function bedarf(o) {
      if (!bereit()) return;
      gemeinsam([chartAuftrag(), tabellenAuftrag(state.tab)], o);
    }
    function overviewAnfrage() { return D.overview(filterStand(), { modus: state.tab === "urls" ? "url" : "domain", gran: state.gran }); }
    function tabellenAnfrage(art) { var s = tabStand(art); return (art === "urls" ? D.urls : D.domains)(filterStand(), s); }

    /* Ein Auftrag: was er laedt, ob es schon im Speicher liegt, wie er den Ladezustand anschaltet,
       und -- nach der Antwort -- eine Funktion, die zeichnet (null, wenn eine neuere Anfrage
       derselben Art ihn ueberholt hat). Gezeichnet wird erst, wenn der Aufrufer das sagt. */
    function chartAuftrag() {
      var a = overviewAnfrage(), mode = state.tab === "urls" ? "url" : "domain";
      return {
        kanal: "overview",
        imSpeicher: lader.ausSpeicher(a) !== undefined,
        ladenAn: function () { try { window.setComboChartLoading(ids.combo, "yes"); } catch (e) {} },
        laden: function (frisch) {
          return lader.laden("overview", a, { frisch: !!frisch }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () {
              var p = erg.ok ? D.zuCombo(erg.daten, mode) : null;
              if (!p) {
                state.fehler.chart = erg.ok ? "x" : D.fehlerArt(erg);
                try { window.renderComboChart({ instanceId: ids.combo, __parseError: true }); } catch (e) {}
              } else {
                state.fehler.chart = null;
                p.instanceId = ids.combo; p.isDark = isDark();
                try { window.renderComboChart(p); } catch (e) {}
              }
              /* Der Chart haelt einen AUSDRUECKLICH gesetzten Ladezustand, bis er ebenso
                 ausdruecklich endet -- eine Lieferung allein beendet ihn nicht
                 (citations-combo-chart.js, LOADING_EXPLICIT; gemessen 08.10.). */
              try { window.setComboChartLoading(ids.combo, "no"); } catch (e) {}
            };
          });
        }
      };
    }
    function tabellenAuftrag(art) {
      var a = tabellenAnfrage(art), s = tabStand(art), id = art === "urls" ? ids.uut : ids.udt;
      var render = art === "urls" ? "renderUrlsTable" : "renderDomainsTable", laed = art === "urls" ? "setUrlsTableLoading" : "setDomainsTableLoading";
      var reqId = s.requestId;
      return {
        kanal: "tabelle_" + art,
        imSpeicher: lader.ausSpeicher(a) !== undefined,
        ladenAn: function () { try { window[laed](id, "yes"); } catch (e) {} },
        laden: function (frisch) {
          return lader.laden("tabelle_" + art, a, { frisch: !!frisch }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () {
              var p = erg.ok ? (art === "urls" ? D.zuUrls(erg.daten) : D.zuDomains(erg.daten)) : null;
              if (!p) {
                state.fehler[art] = erg.ok ? "x" : D.fehlerArt(erg);
                try { window[render]({ instanceId: id, __parseError: true }); } catch (e) {}
                return;
              }
              state.fehler[art] = null;
              p.instanceId = id; p.isDark = isDark();
              if (reqId != null) p.requestId = reqId;
              var m = eigeneMarke();
              if (m) { p.brand_name = str(m.name); p.brand_logo = str(m.logo_url); }
              try { window[render](p); } catch (e) {}
            };
          });
        }
      };
    }
    /* Allein: nur der Chart (D/W/M) bzw. nur die Tabelle (Suche, Sortierung, Seite). */
    function chartLaden() { if (bereit()) gemeinsam([chartAuftrag()]); }
    function tabelleLaden(art) { if (art === state.tab && bereit()) gemeinsam([tabellenAuftrag(art)]); }
    /* Der Drilldown einer Domain. Seine Anfrage-Kennung kommt von der Tabelle und geht mit der
       Antwort zurueck -- eine veraltete verwirft die Tabelle selbst. */
    function drilldownLaden(d) {
      var domain = str(d.domain).trim();
      if (!domain || !bereit()) return;
      var a = D.domainUrls(filterStand(), domain, {
        suche: d.query, urlTypen: liste(d.url_types), limit: num(d.page_size) || 10, offset: num(d.offset) || 0
      });
      var rid = d.request_id;
      lader.laden("drilldown", a).then(function (erg) {
        if (erg.ueberholt) return;
        var l = erg.ok ? D.zuDrilldown(erg.daten) : null;
        /* Ein Fehler im Drilldown: leere Liste mit Gesamtzahl 0 -- die Unterzeile zeigt dann ihren
           Leerzustand statt eines ewigen Kreisels. Ein eigener Fehlerzustand fehlt der Tabelle. */
        try { window.setDomainsTablePages(ids.udt, domain, l || [], rid); } catch (e) {}
      });
    }
    /* AKTUALISIEREN = DEN DB-CACHE LEEREN, DANN FRISCH LADEN. Das ist die Regel fuer JEDEN
       Refresh-Knopf einer Komponente (08.10. bestaetigt: "das ist gewollt" -- einmal kurz
       herausgenommen und am selben Tag zurueck). Beide sofort in den Ladezustand, dann
       clear_citations_cache_v1, dann Chart und Tabelle frisch und gemeinsam. Scheitert das Leeren,
       wird trotzdem neu geladen. */
    function aktualisieren() {
      if (!team() || !bereit()) return;
      var vorab = UC.rpc(D.FN.clear, { p_team: team() }).then(function () { lader.leeren(); });
      bedarf({ frisch: true, vorab: vorab });
    }

    /* Teamwechsel ohne Neuladen: andere Daten, also nichts aus dem Speicher weiterzeigen. */
    if (UC.onTeamChange) UC.onTeamChange(function () { lader.leeren(); state.dom.offset = 0; state.url.offset = 0; persist(); bedarf(); }, root);

    var ctrl = {
      root: root, state: state, ids: ids,
      reset: function () {
        lader.leeren();
        state.dom = tabelleVorgabe(); state.url = tabelleVorgabe();
        persist(); bedarf();
        return true;
      },
      neuLaden: function () { lader.leeren(); bedarf(); }
    };
    root.__ucsCtrl = ctrl;

    reiterZeigen();
    adresseSetzen(false);
    /* Erst nach dem Aufbau der eingebetteten Bausteine: deren Skripte richten sich ueber
       watchRoots ein, der Kalender kennt seinen Zeitraum also erst einen Takt spaeter. */
    setTimeout(function () { filterAbgleichen(); persist(); bedarf(); }, 0);
    return ctrl;
  }

  /* ---- Mount ---------------------------------------------------------------------------------- */
  function alle() { return [].slice.call(document.querySelectorAll(".ucs-root")); }
  function jede(id, fn) {
    var r = alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); });
    r.forEach(function (x) { var c = initRoot(x); if (c) fn(c); });
    return r.length > 0;
  }
  window.resetCitationsPage = function (id) { return jede(id, function (c) { c.reset(); }); };
  /* EINRICHTEN, SOBALD DIE WURZEL ZU SEHEN IST (08.10. gemeldet: "beim Pageload auf die
     Citations-Seite laedt sie nicht, nur beim Sidebar-Klick"). Bubble setzt das Element in die
     noch VERSTECKTE Ansicht und macht sie spaeter nur per Stil sichtbar; watchRoots meldet nur
     neue Knoten, eine beim Erscheinen nicht messbare Wurzel wurde also nie eingerichtet
     (nachgestellt: Wurzel da, Ansicht sichtbar, 0 Kinder, 0 Anfragen). Jetzt wartet sie ueber
     beiSicht -- ohne Dauerlauf. Erst sichtbar einrichten, mit Absicht: so entstehen Kalender,
     Chart und Tabellen darin sichtbar und vermessen sich richtig. */
  /* Eine Wurzel, die versteckt ERSCHEINT, bekommt das lange Fenster (10s): das ist der
     Seitenaufbau, und bis Bubble die Ansicht einblendet, kann es dauern. */
  function einrichten() {
    var neu = false;
    alle().forEach(function (r) {
      if (r.__ucsCtrl) return;
      if (messbar(r)) { initRoot(r); return; }
      if (!SICHT.some(function (w) { return w.el === r; })) neu = true;
      beiSicht(r, "einrichten", function () { initRoot(r); }, messbar);
    });
    if (neu) sichtFenster(FENSTER_START);
  }
  if (UC.watchRoots) UC.watchRoots("ucs-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }

  ucsBoot(30);
})();
