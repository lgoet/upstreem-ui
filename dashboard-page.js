/* upstreem dashboard-page.js -- die Dashboard-Seite als EINE Komponente (08.10.). Praefix uds.

   Kopf (Krume "Dashboard", Umschalter Agentic/Analytic, Docs, Suche, Aktualisieren) und beide
   Ansichten in einem Stueck, wie die Citations-Seite:
     Agentic   das Power Dashboard (power-dashboard.js) -- Kennzahlen, Wettbewerbsfeld, Trending
               Citations; Mira und das Opportunities-Brett leiht es sich wie bisher selbst.
     Analytic  Kalender und Filter, Visibility-Chart, Top Citations, Responses-Tabelle.
   Alle Bausteine sind die ECHTEN der App im lokalen Modus (data-local="yes"): ihr Markup kommt aus
   den Bubble-Vorlagen (.dashboard_markup.py), ihre Ereignisse kommen als DOM-Ereignis hierher
   statt an Bubble, und diese Seite fuellt sie ueber ihre eigenen Setter. Dieselben Bausteine an
   anderen Orten (Drawer, andere Reusables) tragen kein data-local und bleiben bei Bubble.

   DATEN: direkt ueber UC.rpc (PostgREST, Nutzer-JWT), die RPCs aus bubble/dashboard_v1_vertrag.md
   plus Citations v1 fuer Top Citations und die Trending-Listen. Wie die Anfragen aussehen und wie
   die Antworten in die Form der Bausteine kommen, steht in dashboard-data.js (ohne DOM).

   ZEITRAUM UND FILTER: Agentic zeigt wie bisher immer die letzten 30 Tage ohne Filter. Analytic
   hat den Kalender ("Apply to all" gilt app-weit wie ueberall) und Models, Markets, Topics fuer
   die Seite; jeder Teil hat dazu seine eigene Bedienung (Sortierung, Auswahl, Typen, Suche ...).

   LADEN: was die ganze Ansicht betrifft (Oeffnen, Filter, Zeitraum, Aktualisieren, Team) geht
   GLEICHZEITIG hinaus und erscheint GEMEINSAM. Was nur einen Teil betrifft, laeuft allein.
   Aktualisieren leert zuerst den DB-Cache (clear_dashboard_cache_v1 -- leert Citations mit) und
   laedt dann frisch: die Regel fuer jeden Refresh-Knopf der App. */
(function () {
  "use strict";

  var API_NAMES = ["resetDashboardPage"];
  var Q = (window.__udsBootQueue = window.__udsBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function udsBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemCitationsDaten || !window.UpstreemDashboardDaten) {
      if (triesLeft > 0) { setTimeout(function () { udsBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[dashboard-page] core.js, citations-data.js oder dashboard-data.js nicht geladen");
      return;
    }
    udsStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .dashboard_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    vot: "<div class=\"up-root vot-root\" data-local=\"yes\" data-instance=\"__UDS_VOT__\" data-cdn-pin=\"\" data-isdark=\"__UDS_DARK__\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"vot-unit vot-unit-left\"><div class=\"vot-head\"><div class=\"vot-heading\">Visibility over Time</div><div class=\"vot-head-tools\"><div class=\"vc-gran\" role=\"tablist\" aria-label=\"Granularity\"><button class=\"vc-gran-btn is-active\" data-gran=\"day\" type=\"button\" role=\"tab\" data-tip=\"Day\" aria-label=\"Day\">D</button><button class=\"vc-gran-btn\" data-gran=\"week\" type=\"button\" role=\"tab\" data-tip=\"Week\" aria-label=\"Week\">W</button><button class=\"vc-gran-btn\" data-gran=\"month\" type=\"button\" role=\"tab\" data-tip=\"Month\" aria-label=\"Month\">M</button></div><button class=\"vot-maximize vot-max-top vot-iconbtn\" type=\"button\" data-tip=\"Minimize\" aria-label=\"Minimize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button></div></div><div class=\"vot-box vot-box-left\"><div class=\"vot-panel-body\"><button class=\"vot-scale-btn\" type=\"button\" data-tip=\"Chart Settings\" aria-label=\"Chart Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><div class=\"up-line-wrap\"><canvas class=\"up-line-canvas\"></canvas></div><div class=\"up-legend\"></div></div></div></div><div class=\"vot-unit vot-unit-right\"><div class=\"vot-head\"><div class=\"vot-heading vot-heading-right\"><span class=\"vot-head-label\">Top Brands</span><span class=\"vot-head-sep\"></span><span class=\"vot-head-count\"></span></div><div class=\"vot-head-tools\"><div class=\"vot-sort\"><button class=\"vot-sort-btn vot-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"vot-filter\"><button class=\"vot-filter-btn vot-iconbtn\" type=\"button\" data-tip=\"Filter brands\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg><span class=\"vot-filter-badge\"></span></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"vot-export vot-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"vot-maximize vot-max-right vot-iconbtn\" type=\"button\" data-tip=\"Maximize\" aria-label=\"Maximize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button><button class=\"vot-goto vot-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5\"/></svg></button></div></div><div class=\"vot-box vot-box-right\"><div class=\"vt-table\"></div></div></div></div>",
    tcd: "<div class=\"up-root tcd-root\" data-local=\"yes\" data-instance=\"__UDS_TCD__\" data-cdn-pin=\"\" data-isdark=\"__UDS_DARK__\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"tcd-unit tcd-unit-left\"><div class=\"tcd-head\"><div class=\"tcd-mode\" role=\"tablist\" aria-label=\"Mode\"><button class=\"tcd-mode-btn is-active\" data-mode=\"domain\" type=\"button\" role=\"tab\">Domains</button><button class=\"tcd-mode-btn\" data-mode=\"url\" type=\"button\" role=\"tab\">URLs</button></div><div class=\"tcd-head-tools\"><div class=\"tcl-seg\" role=\"tablist\" aria-label=\"Chart type\"><button class=\"tcl-seg-btn is-active\" data-chart=\"doughnut\" role=\"tab\" aria-selected=\"true\" data-tip=\"Doughnut\" aria-label=\"Doughnut\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.5 15.8278C17.9985 21.756 9.86407 23.4835 5.20143 18.8641C0.629484 14.3347 2.04493 6.12883 8.05653 3.5\"/><path d=\"M17.6831 12.5C19.5708 12.5 20.5146 12.5 21.1241 11.655C21.1469 11.6234 21.1848 11.5667 21.2052 11.5336C21.7527 10.6471 21.4705 9.966 20.9063 8.60378C20.3946 7.36853 19.6447 6.24615 18.6993 5.30073C17.7538 4.35531 16.6315 3.60536 15.3962 3.0937C14.034 2.52946 13.3529 2.24733 12.4664 2.79477C12.4333 2.81523 12.3766 2.85309 12.345 2.87587C11.5 3.4854 11.5 4.42922 11.5 6.31686V8.42748C11.5 10.3473 11.5 11.3072 12.0964 11.9036C12.6928 12.5 13.6527 12.5 15.5725 12.5H17.6831Z\"/></svg></button><button class=\"tcl-seg-btn\" data-chart=\"bar\" role=\"tab\" aria-selected=\"false\" data-tip=\"Bars\" aria-label=\"Bars\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H21\"/><path d=\"M7 8V9C7 9.55228 7.44772 10 8 10H18C18.5523 10 19 9.55228 19 9V8C19 7.44772 18.5523 7 18 7H8C7.44772 7 7 7.44772 7 8Z\"/><path d=\"M7 15V16C7 16.5523 7.44772 17 8 17H14C14.5523 17 15 16.5523 15 16V15C15 14.4477 14.5523 14 14 14H8C7.44772 14 7 14.4477 7 15Z\"/></svg></button></div></div></div><div class=\"tcd-box\"><div class=\"tcd-panel-body\"><div class=\"tcl-top-total\"><span class=\"n\">0</span><span class=\"lbl\">Citations</span></div><div class=\"up-donut-body\"></div></div></div></div><div class=\"tcd-unit tcd-unit-right\"><div class=\"tcd-head\"><div class=\"tcd-heading tcd-heading-right\"><span class=\"tcd-head-label\">Top Domains</span><span class=\"tcd-head-sep\"></span><span class=\"tcd-head-count\"></span></div><div class=\"tcd-head-tools\"><button class=\"tcd-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"tcd-brand-toggle-lbl\"><img class=\"tcd-brand-logo\" src=\"\" style=\"display:none\"/><span class=\"tcd-brand-label\"></span></span><span class=\"tcd-brand-check\"><svg class=\"tcd-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"tcd-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"tcd-filter\"><button class=\"tcd-filter-btn tcd-iconbtn\" type=\"button\" data-tip=\"Filter\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg><span class=\"tcd-filter-badge\"></span></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"tcd-export tcd-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"tcd-goto tcd-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5\"/></svg></button></div></div><div class=\"tcd-box\"><div class=\"tct-table\"></div></div></div></div>",
    urt: "<div class=\"up-root urt-root\" data-local=\"yes\" data-merken=\"yes\" data-instance=\"__UDS_URT__\" data-cdn-pin=\"\" data-isdark=\"__UDS_DARK__\" data-brand-name=\"__UDS_BRAND__\" data-brand-logo=\"__UDS_BRANDLOGO__\" data-spotlight-mode=\"no\" data-export-instance=\"\" data-sticky-top=\"16\" data-sticky=\"yes\" data-default-view=\"cards\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Responses</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"urt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"urt-brand-toggle-lbl\"><img class=\"urt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"urt-brand-label\"></span></span><span class=\"urt-brand-check\"><svg class=\"urt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"urt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- Reihenfolge: Sorter VOR dem Fader, also von rechts gelesen der Fader vor dem Sorter. core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars) -- hier steht sie richtig, damit eine Neuinstallation nicht erst umsortiert werden muss. --><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- lucide \"settings-2\" \u2014 the SAME filter glyph visibility-chart / topcitations / combo-chart use. .up-iconbtn makes it behave like every other toolbar icon button. --><div class=\"urt-fader\"><button class=\"urt-fader-btn up-iconbtn\" type=\"button\" data-tip=\"Filter by rank &amp; sentiment\" aria-label=\"Filter by rank and sentiment\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg></button><div class=\"urt-fader-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search responses\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"urt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- .up-dense / .up-dense-btn are core's segmented control \u2014 the same one the Row Height picker uses. Reused verbatim so this switcher IS the app's switcher, not a lookalike. .urt-viewswitch only overrides the width (core's is full-width for the popover). --><div class=\"up-dense urt-viewswitch\" role=\"group\" aria-label=\"View\"><button class=\"up-dense-btn up-dense-btn-icon is-active\" type=\"button\" data-view=\"table\" data-tip=\"Table view\" aria-label=\"Table view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18\"/></svg></button><button class=\"up-dense-btn up-dense-btn-icon\" type=\"button\" data-view=\"cards\" data-tip=\"Card view\" aria-label=\"Card view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 4V20\"/><path d=\"M18 4V20\"/><path d=\"M21 7L3 7\"/><path d=\"M21 17L3 17\"/></svg></button></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><!-- The lead column's resize grip. Every other table has one; without it the first column simply cannot be dragged (core's resize kit binds to .up-grip). --><div class=\"up-th up-th-prompt\">Prompt<span class=\"up-grip\" data-grip=\"prompt\"></span></div><!-- \"<brand logo> mentioned?\", identical to urls-table: the logo is filled in from data-brand-logo, and without one the label falls back to \"<brand name> mentioned?\" --><div class=\"up-th up-th-mentioned\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">Mentioned</span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions</div><div class=\"up-th up-th-citations\">Citations</div><div class=\"up-th up-th-model\">Model</div><div class=\"up-th up-th-date is-sortable\" data-sortcol=\"date\"><span class=\"up-th-txt\">Date</span><span class=\"up-thsort\" data-for=\"date\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"urt-cards\"></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function udsStart() {
  var UC = window.UpstreemCore, D = window.UpstreemDashboardDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__udsStore = window.__udsStore || {});

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function liste(s) { return String(s == null ? "" : s).split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function eigeneMarke() {
    var l = UC.getBrands ? UC.getBrands() : [];
    for (var i = 0; i < l.length; i++) if (l[i] && (String(l[i].role || "").toLowerCase() === "own" || l[i].is_own === true)) return l[i];
    return null;
  }
  function beiSicht(el, schluessel, fn, test, o) {
    if (UC.beiSicht) UC.beiSicht(el, schluessel, fn, test, o); else fn();
  }
  function messbar(el) { return !UC.messbar || UC.messbar(el); }
  function ic(name, w) { return UC.icon ? UC.icon(name, w) : ""; }
  /* Docs: dieselbe Adresse wie die Landingpage. data-docs-url am Element ersetzt sie. */
  var DOCS_URL = "https://docs.upstreem.ai/welcome";

  function initRoot(root) {
    if (root.__udsCtrl) return root.__udsCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "dashboard_page";
    if (instanceId === "INSTANCE_ID") return null;
    var gem = STORE[instanceId] || {};

    var ids = {
      daten: instanceId + "_dates", filter: instanceId + "_filters", modelle: instanceId + "_models",
      maerkte: instanceId + "_markets", topics: instanceId + "_topics",
      upw: instanceId + "_agentic", vot: instanceId + "_visibility", tcd: instanceId + "_topcitations", urt: instanceId + "_responses"
    };
    /* Der Stand der Responses-Tabelle: was ihr eigener Speicher (bei einem Neuaufbau) schon weiss,
       gilt -- sonst zeigt die Tabelle Seite 3 von "Karten zu 12" und die Seite fragt Seite 1 zu 15. */
    /* Seit dem 09.10. merkt sich die Tabelle Ansicht und Seitengroesse im localStorage
       (responses-table.js, data-merken, Schluessel urt_ansicht__<instanceId>); die Vorgabe auf dem
       Dashboard sind Karten zu 6. Derselbe Schluessel hier, sonst fragte die Seite 15 Zeilen an,
       waehrend die Tabelle 6 Karten zeigt. Was die Tabelle in dieser Sitzung schon weiss
       (__urtStore, Neuaufbau), geht vor. */
    function respVorgabe() {
      var ls = null;
      try { ls = JSON.parse(window.localStorage.getItem("urt_ansicht__" + ids.urt) || "null"); } catch (e) { ls = null; }
      ls = ls && typeof ls === "object" ? ls : {};
      var u = (window.__urtStore || {})[ids.urt] || {};
      var ansicht = u.view || ls.view || "cards", karten = ansicht === "cards";
      var groesse = karten ? (u.cardPageSize || num(ls.cardPageSize) || 6) : (u.tablePageSize || num(ls.tablePageSize) || UC.DEFAULT_PAGE_SIZE || 15);
      var seite = karten ? (u.cardPage || 1) : (u.tablePage || 1);
      return { order: "run_at_desc", limit: groesse, offset: (seite - 1) * groesse, suche: str(u.query), requestId: null,
               erwaehnt: "all", firmen: null, sentMin: null, sentMax: null, rankMin: null, rankMax: null };
    }
    var state = {
      modus: UC.getDashboardMode ? UC.getDashboardMode(str(root.getAttribute("data-mode-default")) || "power") : "power",
      f: gem.f || { von: "", bis: "", modelle: null, maerkte: null, topics: null, tagmode: "or" },
      gran: gem.gran || "day",
      vis: gem.vis || { order: "visibility_desc", firmen: null },
      top: gem.top || { modus: "domain", erwaehnt: "all", citationTypen: null, urlTypen: null },
      resp: gem.resp || respVorgabe(),
      autoFirmen: gem.autoFirmen || [],
      eigene: gem.eigene || null,
      kalenderDa: false
    };
    function persist() {
      STORE[instanceId] = { f: state.f, gran: state.gran, vis: state.vis, top: state.top, resp: state.resp, autoFirmen: state.autoFirmen, eigene: state.eigene };
    }

    var lader = D.makeLader({ rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 30000 }); } });

    /* ---- Aufbau ------------------------------------------------------------------------------- */
    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    function einsetzen(m) {
      var marke = eigeneMarke() || state.eigene;
      return String(m || "").split("__UDS_VOT__").join(esc(ids.vot))
        .split("__UDS_TCD__").join(esc(ids.tcd)).split("__UDS_URT__").join(esc(ids.urt))
        .split("__UDS_DARK__").join(isDark() ? "yes" : "no")
        .split("__UDS_BRANDLOGO__").join(esc(marke ? str(marke.logo_url) : ""))
        .split("__UDS_BRAND__").join(esc(marke ? str(marke.name) : ""));
    }
    var dk = isDark() ? "yes" : "no", marke0 = eigeneMarke() || state.eigene;
    /* Agentic zuerst, wie im bisherigen Seitenkopf (15.09. angefordert). Die WERTE bleiben
       "power"/"standard": daran haengen der Speicher in core (up_dashboard), das Attribut am
       <html> und der Vorlade-Schnipsel. Zeichen UND Wort im Markup, das Telefon blendet das Wort
       aus (dashboard-page.css). */
    var MODI = [["power", "Agentic", "gauge"], ["standard", "Analytic", "layoutDashboard"]];
    root.classList.add("up-sidebar-clear");
    root.innerHTML =
      '<div class="up-ph-top uds-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Dashboard")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Monitor your AI visibility, performance, and latest developments")) + '</p></div>' +
        '<div class="uds-tools">' +
          '<div class="up-seg uds-mode" role="tablist" aria-label="' + esc(t("Dashboard view")) + '">' +
            MODI.map(function (m) {
              var w = t(m[1]);
              return '<button type="button" class="up-seg-btn uds-modebtn" role="tab" data-uds-modus="' + m[0] + '" data-tip="' + esc(w) + '" aria-label="' + esc(w) + '">' +
                '<span class="uds-modeic" aria-hidden="true">' + ic(m[2], 2) + '</span><span class="uds-modelbl">' + esc(w) + '</span></button>';
            }).join("") +
          '</div>' +
          '<button class="up-ph-iconbtn uds-docs" type="button" aria-label="' + esc(t("Open Documentation")) + '" data-tip="' + esc(t("Open Documentation")) + '">' + ic("libraryBig", 1.8) + '</button>' +
          '<button class="up-ph-iconbtn uds-search" type="button" aria-label="' + esc(t("Open Quick Actions")) + '" data-tip="' + esc(t("Quick Actions")) + '">' + ic("search", 1.8) + '</button>' +
          '<button class="up-ph-iconbtn uds-refresh" type="button" aria-label="' + esc(t("Refresh")) + '" data-tip="' + esc(t("Refresh Data")) + '">' + ic("refreshCw", 1.8) + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="uds-ansicht uds-agentic" data-uds-ansicht="power">' +
        '<div class="up-root upw-root" data-local="yes" data-instance="' + esc(ids.upw) + '" data-view="dashboard" data-isdark="' + dk + '"' +
          ' data-brand-name="' + esc(marke0 ? str(marke0.name) : "") + '"></div>' +
      '</div>' +
      '<div class="uds-ansicht uds-analytic" data-uds-ansicht="standard">' +
        '<div class="uds-filterzeile">' +
          '<div class="up-root udr-root uds-daten" data-instance="' + esc(ids.daten) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
          '<div class="up-root ufb-root uds-filterleiste" data-instance="' + esc(ids.filter) + '" data-topics-instance="' + esc(ids.topics) + '"' +
            ' data-models-instance="' + esc(ids.modelle) + '" data-markets-instance="' + esc(ids.maerkte) + '" data-isdark="' + dk + '"></div>' +
          '<div class="up-root utf-root" data-instance="' + esc(ids.topics) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
          '<div class="up-root umf-root" data-instance="' + esc(ids.modelle) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
          '<div class="up-root umk-root" data-instance="' + esc(ids.maerkte) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '</div>' +
        '<div class="uds-main">' +
          '<div class="uds-teil uds-vis">' + einsetzen(MARKUP.vot) + '</div>' +
          '<div class="uds-teil uds-top">' + einsetzen(MARKUP.tcd) + '</div>' +
          '<div class="uds-teil uds-resp">' + einsetzen(MARKUP.urt) + '</div>' +
        '</div>' +
      '</div>';

    var elSeg = root.querySelector(".uds-mode"), elRefresh = root.querySelector(".uds-refresh");
    if (UC.makePageCrumbs) UC.makePageCrumbs(root, { icon: "home", name: "Dashboard", komponente: true });
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);
    if (UC.widthTiers) UC.widthTiers(root, { narrowAt: 768, vnarrowAt: 500 });
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* ---- Agentic | Analytic --------------------------------------------------------------------
       Ein Wert fuer die ganze App (UC.getDashboardMode/setDashboardMode, localStorage). Ein
       zweiter Weg zum Umschalten (Quick Actions, ein alter Seitenkopf) meldet sich ueber
       onDashboardMode -- dann folgt die Seite. Geladen wird nur die Ansicht, die zu sehen ist. */
    function modusZeigen() {
      root.querySelectorAll(".uds-ansicht").forEach(function (el) { el.hidden = el.getAttribute("data-uds-ansicht") !== state.modus; });
      if (elSeg) elSeg.querySelectorAll("[data-uds-modus]").forEach(function (b) {
        var an = b.getAttribute("data-uds-modus") === state.modus;
        b.classList.toggle("is-active", an); b.setAttribute("aria-selected", an ? "true" : "false");
      });
      root.setAttribute("data-uds-modus", state.modus);
    }
    function modusSetzen(v) {
      v = v === "standard" ? "standard" : "power";
      if (v === state.modus) return;
      state.modus = v;
      modusZeigen();
      bedarf();
    }
    if (elSeg) elSeg.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-uds-modus]") : null;
      if (!b) return;
      var v = b.getAttribute("data-uds-modus");
      if (UC.setDashboardMode) v = UC.setDashboardMode(v);
      modusSetzen(v);
    });
    if (UC.onDashboardMode) UC.onDashboardMode(function (v) { if (root.isConnected !== false) modusSetzen(v); });

    /* ---- Docs, Suche, Aktualisieren ------------------------------------------------------------
       Ohne Bubble: Docs oeffnet die Dokumentation in einem neuen Tab, die Suche drueckt Cmd+K wie
       der bisherige Seitenkopf (quick-actions.js hoert darauf), Aktualisieren leert den DB-Cache. */
    var elDocs = root.querySelector(".uds-docs"), elSuche = root.querySelector(".uds-search");
    if (elDocs) elDocs.addEventListener("click", function () {
      var u = str(root.getAttribute("data-docs-url")).trim();
      if (!/^https:\/\//i.test(u)) u = DOCS_URL;
      try { window.open(u, "_blank", "noopener"); } catch (e) {}
    });
    if (elSuche) elSuche.addEventListener("click", function () {
      var mac = false;
      try { mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || ""); } catch (e) {}
      try {
        (document.activeElement || document.body).dispatchEvent(new KeyboardEvent("keydown",
          { key: "k", code: "KeyK", metaKey: mac, ctrlKey: !mac, bubbles: true, cancelable: true }));
      } catch (e) {}
    });
    if (elRefresh) elRefresh.addEventListener("click", function () {
      if (UC.spinOnce) UC.spinOnce(elRefresh);
      aktualisieren();
    });

    /* ---- Filter (nur Analytic) -----------------------------------------------------------------
       Kalender und die drei Filter sind lokale Instanzen: ihre Auswahl kommt als DOM-Ereignis.
       Dieselben Regeln wie auf der Citations-Seite. */
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
    function auswahl(feld, d, schluessel) {
      var gew = liste(d && d[schluessel]);
      if (!gew.length) return null;
      if (d.select_mode !== "exclude") return gew;
      var alle = feld === "modelle"
        ? (UC.getModels ? UC.getModels() : []).map(function (m) { return str(m.key || m.model); })
        : (UC.getAllMarkets ? toArr(UC.getAllMarkets()) : []).map(function (m) { return str(m.alpha2 || m.alpha3 || m.code || m.market).toUpperCase(); });
      return alle.filter(function (k) { return k && gew.indexOf(k) < 0; });
    }
    /* Neue Filter sind ein neuer Ergebnissatz: die Responses zurueck auf die erste Seite.
       GEBUENDELT (08.10., Lasttest): jede Aenderung bricht die vorige Anfrage zwar ab, beim Server
       kommt sie trotzdem an -- 200 schnelle Wechsel waren 1000 Anfragen, die DB erlaubt 60 je
       Minute und Funktion. Wer in 120ms mehrmals waehlt, bekommt EINE Ladung mit dem letzten Stand;
       einzeln gewaehlt merkt man die 120ms nicht. */
    var filterUhr = null;
    function filterGeaendert() {
      state.resp.offset = 0;
      persist();
      clearTimeout(filterUhr);
      filterUhr = setTimeout(function () { filterUhr = null; bedarf(); }, 120);
    }
    root.addEventListener("umf-models", function (e) { if (setzen("modelle", auswahl("modelle", e.detail, "model_keys"))) filterGeaendert(); });
    root.addEventListener("umk-markets", function (e) { if (setzen("maerkte", auswahl("maerkte", e.detail, "market_codes"))) filterGeaendert(); });
    root.addEventListener("utf-topics", function (e) {
      var d = e.detail || {}, l = liste(d.topic_ids);
      var a = setzen("topics", l.length ? l : null), b = setzen("tagmode", d.tag_mode === "and" ? "and" : "or");
      if (a || (b && l.length)) filterGeaendert();
    });
    function kalender() { var k = root.querySelector(".uds-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
    /* Die Stufe des Charts folgt jedem neuen Zeitraum (UC.granFuerZeitraum, wie SET GRAN in
       Bubble); dazwischen gilt der Klick im Chart. */
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
      if (!e.target || !e.target.classList || !e.target.classList.contains("uds-daten")) return;
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

    /* ---- Ereignisse der Bausteine -------------------------------------------------------------- */
    function an(name, fn) { root.addEventListener(name, function (e) { fn(e.detail || {}); }); }
    function wert(d) { return d && d.value != null ? d.value : ""; }
    /* Visibility-Chart: Stufe, Sortierung der Tabelle, Auswahl der Marken, Zeilenklick. */
    an("vot-votGranularity", function (d) {
      var g = str(wert(d));
      if ((g !== "day" && g !== "week" && g !== "month") || g === state.gran) return;
      state.gran = g; persist(); teilLaden("vis");
    });
    an("vot-votSortTable", function (d) {
      var o = str(wert(d));
      if (D.ORDER.overview.indexOf(o) < 0 || o === state.vis.order) return;
      state.vis.order = o; persist(); teilLaden("vis");
    });
    /* Die Auswahl entspricht den Top 7 von selbst (das "Reset" im Menue schickt genau sie): dann
       wieder automatisch, statt dieselben Marken als Handauswahl zu fuehren -- die DB vergibt die
       Farben je Reihenfolge der Auswahl, und dieselbe Marke wechselte sonst ihre Farbe. */
    an("vot-votSubmitCompanies", function (d) {
      /* Nur Kennungen, die wie eine uuid aussehen: was sonst kaeme, waere ein manipuliertes
         Ereignis -- es soll nicht einmal im Zustand stehen (dashboard-data.js filtert ohnehin). */
      var l = liste(wert(d)).filter(function (x) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x); }).slice(0, 10), auto = state.autoFirmen || [];
      var gleich = l.length === auto.length && l.every(function (x) { return auto.indexOf(x) >= 0; });
      var neu = !l.length || gleich ? null : l;
      if (JSON.stringify(neu) === JSON.stringify(state.vis.firmen)) return;
      state.vis.firmen = neu; persist(); teilLaden("vis");
    });
    an("vot-votRowClick", function (d) { var id = str(wert(d)).trim(); if (id && UC.drawerOeffnen) UC.drawerOeffnen("brand", id, "dashboard"); });
    /* Top Citations: Domains/URLs, Typen, "Brand mentioned", Zeilenklick. */
    an("tcd-tcdMode", function (d) {
      var m = wert(d) === "url" ? "url" : "domain";
      if (m === state.top.modus) return;
      state.top.modus = m; persist(); teilLaden("top");
    });
    an("tcd-tcdApplyTypeFilter", function (d) {
      var teile = str(wert(d)).split(";"), c = liste(teile[0]), u = liste(teile[1]);
      state.top.citationTypen = c.length ? c : null; state.top.urlTypen = u.length ? u : null;
      persist(); teilLaden("top");
    });
    an("tcd-tcdBrandMentioned", function (d) {
      var v = str(wert(d));
      state.top.erwaehnt = v === "yes" || v === "no" ? v : "all";
      persist(); teilLaden("top");
    });
    an("tcd-tcdRowClick", function (d) {
      var id = str(wert(d)).trim();
      if (!id || !UC.drawerOeffnen) return;
      UC.drawerOeffnen(state.top.modus === "url" ? "url" : "domain", id, "dashboard");
    });
    /* Responses: Suche, Sortierung, Seite, Rang/Sentiment, Marken, "Brand mentioned", Zeile. */
    function respNeu(fn) { return function (d) { fn(d); state.resp.requestId = null; persist(); teilLaden("resp"); }; }
    an("urt-urtSearch", function (d) {
      state.resp.suche = str(d.query); state.resp.offset = 0;
      state.resp.requestId = d.requestId != null ? d.requestId : null;
      persist(); teilLaden("resp");
    });
    an("urt-urtSort", respNeu(function (d) { if (D.ORDER.responses.indexOf(str(d.order)) >= 0) state.resp.order = str(d.order); state.resp.offset = 0; }));
    an("urt-urtPage", respNeu(function (d) {
      var l = num(d.limit), o = num(d.offset);
      if (l != null) state.resp.limit = Math.max(1, Math.min(100, Math.round(l)));
      if (o != null) state.resp.offset = Math.max(0, Math.round(o));
    }));
    an("urt-urtFilter", respNeu(function (d) {
      var ra = d.rank_active === true || d.rank_active === "true", sa = d.sent_active === true || d.sent_active === "true";
      state.resp.rankMin = ra ? num(d.rank_min) : null;
      /* 20 heisst "20+": offenes Ende, kein p_rank_max (Vertrag). */
      state.resp.rankMax = ra && num(d.rank_max) != null && num(d.rank_max) < 20 ? num(d.rank_max) : null;
      state.resp.sentMin = sa ? num(d.sent_min) : null;
      state.resp.sentMax = sa ? num(d.sent_max) : null;
      state.resp.offset = 0;
    }));
    an("urt-urtMentioned", respNeu(function (d) { var l = liste(d.brands); state.resp.firmen = l.length ? l : null; state.resp.offset = 0; }));
    an("urt-urtBrand", respNeu(function (d) {
      var v = str(d.brand_mentioned);
      state.resp.erwaehnt = v === "yes" || v === "no" ? v : "all"; state.resp.offset = 0;
    }));
    an("urt-urtRowClick", function (d) { var id = str(d.prompt_run_id).trim(); if (id && UC.drawerOeffnen) UC.drawerOeffnen("response", id, "dashboard"); });
    /* Das Agentic-Dashboard meldet, was ihm fehlt (Lesefehler zaehlen mit) -- ein neuer Versuch.
       ERST IM NAECHSTEN TAKT: die Meldung kommt synchron, auch mitten aus seinem Aufbau, und ein
       Setter-Aufruf von hier aus waere ein zweiter Aufbau im ersten (power-dashboard.js,
       __upwBuilding). */
    var BEDARF_TEIL = { brands: "ov", citations_domain: "domain", citations_url: "url" };
    an("upwupwNeeds", function (d) {
      var teile = (isArr(d.needs) ? d.needs : []).map(function (n) { return BEDARF_TEIL[n]; }).filter(Boolean);
      var opps = isArr(d.needs) && d.needs.indexOf("opportunities") >= 0;
      setTimeout(function () {
        if (state.modus !== "power" || !bereit()) return;
        var auftraege = teile.map(function (t) { return agAuftrag(t, false); });
        if (opps && state.oppsGeliefert !== team()) auftraege.push(oppsAuftrag());
        if (auftraege.length) gemeinsam(auftraege);
      }, 0);
    });

    /* EXPORT: wie auf der Citations-Seite. Die drei Bausteine oeffnen das Export-Fenster der App
       ueber data-export-instance; die Seite setzt sie VOR dem Klick (Fangphase), aus ihrem eigenen
       data-export-instance oder vom Export-Element, das auf der Seite steht, samt dem Typ. Gibt es
       keins, sagt die Seite es, statt still nichts zu tun. */
    function exportKennung() {
      var k = str(root.getAttribute("data-export-instance")).trim();
      if (k && !/^[A-Z_]{3,}$/.test(k)) return k;
      var e = document.querySelector(".uex-root[data-instance]");
      k = e ? str(e.getAttribute("data-instance")).trim() : "";
      return k && !/^[A-Z_]{3,}$/.test(k) ? k : "";
    }
    root.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".vot-export, .tcd-export, .urt-root .up-export") : null;
      var teil = b && b.closest(".vot-root, .tcd-root, .urt-root");
      if (!teil || !root.contains(teil)) return;
      var k = exportKennung();
      if (!k || typeof window.upstreemExportOpen !== "function") {
        e.stopPropagation();
        if (UC.toast) UC.toast(t("Export isn't available on this page"), { kind: "neutral" });
        return;
      }
      teil.setAttribute("data-export-instance", k);
      var typ = teil.classList.contains("vot-root") ? "brands" : teil.classList.contains("urt-root") ? "prompt_runs"
        : (state.top.modus === "url" ? "urls" : "domains");
      try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, { export_type: typ }); } catch (err) {}
    }, true);

    /* ---- Laden ---------------------------------------------------------------------------------
       Ohne Team, ohne Sicht und (Analytic) ohne Kalender gibt es keine Anfrage: die Zahlen muessen
       genau diesen Zeitraum und dieses Team haben. Verdeckt wird NICHT im Takt nachgefragt --
       geladen wird, sobald die Seite wieder aufgeht (beiSicht). */
    function sichtbarTest(el) { return el.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(el)); }
    var warteUhr = null, kalenderVersuche = 0;
    function spaeter(ms) { if (!warteUhr) warteUhr = setTimeout(function () { warteUhr = null; bedarf(); }, ms); }
    function bereit() {
      if (!sichtbarTest(root)) { beiSicht(root, "laden", function () { bedarf(); }, sichtbarTest); return false; }
      if (!team()) return false;
      if (state.modus === "standard" && !state.kalenderDa && !kalenderLesen()) {
        /* Fehlt date-range.js ganz, laedt die Seite nach 3s ohne Zeitraum: die RPCs nehmen dann
           ihre Vorgabe (Vertrag: die letzten 30 Tage). */
        if (kalenderVersuche++ < 20) { spaeter(150); return false; }
      }
      return true;
    }
    function filterStand() { var f = {}, k; for (k in state.f) f[k] = state.f[k]; f.team = team(); return f; }
    function agenticStand() { var z = D.letzte30(); return { team: team(), von: z.von, bis: z.bis, modelle: null, maerkte: null, topics: null, tagmode: "or" }; }

    /* GEMEINSAM: alle Teile einer Gruppe gehen gleichzeitig in den Ladezustand, ihre Anfragen
       gleichzeitig hinaus, und gezeichnet wird erst, wenn ALLE Antworten da sind. Je Teil zeichnet
       nur die juengste Gruppe, die ihn angefordert hat (dieselbe Mechanik wie die Citations-Seite). */
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
        zeigen.forEach(function (z, i) { if (z && juengsteJe[auftraege[i].kanal] === nr) { try { z(); } catch (e) { if (window.console) console.error("[dashboard-page] " + auftraege[i].kanal + ":", e); } } });
      });
    }
    /* Ein Auftrag laedt mehrere Anfragen, jede auf ihrem Kanal. Ueberholt ist er, wenn eine davon
       ueberholt wurde -- dann zeichnet die neuere Gruppe. */
    function alleLaden(paare, frisch) {
      return Promise.all(paare.map(function (p) { return lader.laden(p[0], p[1], { frisch: !!frisch }); }));
    }
    function imSpeicher(anfragen) { return anfragen.every(function (a) { return lader.ausSpeicher(a) !== undefined; }); }
    function setter(name) { return typeof window[name] === "function" ? window[name] : function () {}; }

    /* DIE EIGENE MARKE (09.10. gemeldet: in Top Citations und Responses fehlte der Schalter
       "<Marke> mentioned?"). Die Seite kannte sie nur aus dem Marken-Store (role "own") -- die
       alte Seite bekam Name und Logo dagegen von Bubble als Attribut. Steht im Store keine Rolle
       oder kommt er spaeter als die Tabellen, blieb der Schalter weg. Jetzt ist die Quelle die
       Antwort selbst: cached_dashboard_overview_v1 liefert own (Vertrag, unabhaengig von Suche
       und Seite), Analytic und Agentic laden sie ohnehin. Der Store bleibt Vorrang, wenn er die
       Marke kennt. Sobald sie bekannt oder anders ist, bekommen beide Tabellen sie sofort. */
    function marke() { return eigeneMarke() || state.eigene || null; }
    function markeVerteilen() {
      var m = marke();
      if (!m || !m.name) return;
      try { setter("setResponsesTableBrand")(ids.urt, str(m.name), str(m.logo_url)); } catch (e) {}
      try { setter("renderTopCitations")({ instanceId: ids.tcd, brand: { id: str(m.company_id || m.id), name: str(m.name), logo: str(m.logo_url) } }); } catch (e) {}
    }
    function eigeneMerken(daten) {
      var o = daten && daten.own;
      if (!o || typeof o !== "object" || !o.name) return;
      var neu = { company_id: str(o.company_id), name: str(o.name), logo_url: str(o.logo_url) };
      var alt = state.eigene;
      state.eigene = neu; persist();
      if (!alt || alt.name !== neu.name || alt.logo_url !== neu.logo_url) markeVerteilen();
    }
    if (UC.onBrands) UC.onBrands(function () { markeVerteilen(); }, root);

    /* AGENTIC LAEDT NUR, WAS ZU SEHEN IST (09.10. gemeldet: beim Seitenaufbau im Domain-Modus
       lief schon cached_citations_urls_v1). Beim Aufbau der Ueberblick und die Liste, die das
       Dashboard gerade zeigt -- seine eigene Wahl im localStorage (power-dashboard.js,
       upw_cmode__<instanceId>). Die andere Liste kommt erst, wenn das Dashboard sie meldet
       (upwNeeds, beim Umschalten Domains/URLs). Jeder Teil ist ein eigener Auftrag auf eigenem
       Kanal: ein spaeterer Bedarf an der URL-Liste ueberholt so nie den Ueberblick. */
    function agListe() {
      try { return window.localStorage.getItem("upw_cmode__" + ids.upw) === "url" ? "url" : "domain"; } catch (e) { return "domain"; }
    }
    function agAuftrag(teil, mitLaden) {
      var fA = agenticStand();
      var a = teil === "ov" ? D.overview(fA, { order: "visibility_desc", limit: 5 })
        : D.topListe(fA, teil, { order: "share_delta_desc", limit: 5 });
      return {
        kanal: "ag_" + teil, imSpeicher: imSpeicher([a]),
        /* Den Ladezustand des ganzen Dashboards nur beim Laden der Ansicht: fuer eine einzelne
           nachgeforderte Liste wuerde er auch die schon gefuellten Kacheln ins Skelett nehmen. */
        ladenAn: function () { if (mitLaden) { try { setter("setPowerDashboardLoading")(ids.upw, "yes"); } catch (e) {} } },
        laden: function (frisch) {
          return lader.laden("ag_" + teil, a, { frisch: !!frisch }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () {
              var p = { instanceId: ids.upw, citations_label: "Last 30 days" }, fehler = {}, x;
              if (teil === "ov") {
                x = erg.ok ? D.zuPowerUeberblick(erg.daten) : null;
                if (x) { p.overview = x.overview; p.brands = x.brands; eigeneMerken(erg.daten); } else { fehler.overview = "x"; fehler.brands = "x"; }
              } else if (teil === "domain") {
                x = erg.ok ? D.zuPowerDomains(erg.daten) : null;
                if (x) { p.top_domains = x.top_domains; p.totalCountDomain = x.totalCountDomain; } else fehler.citations_domain = "x";
              } else {
                x = erg.ok ? D.zuPowerUrls(erg.daten) : null;
                if (x) { p.top_urls = x.top_urls; p.totalCountUrl = x.totalCountUrl; } else fehler.citations_url = "x";
              }
              if (Object.keys(fehler).length) p.errors = fehler;
              try { setter("renderPowerDashboard")(p); } catch (err) {}
              if (mitLaden) { try { setter("setPowerDashboardLoading")(ids.upw, "no"); } catch (err) {} }
            };
          });
        }
      };
    }
    /* CHATS UND OPPORTUNITIES (Nachtrag 09.10.: dashboard_chats_v1, dashboard_opportunities_v1).
       Bis zum 09.10. fuellte sie ein Bubble-Schritt aus get_power_dashboard_v1 -- den hatte diese
       Seite ersetzt, ohne die zwei mitzuversorgen: Recent chats blieben im Skelett, das Brett lud
       endlos (gemeldet). Beide gehen an die Setter der Komponenten, denen sie gehoeren (Mira, das
       Opportunities-Brett); das Dashboard leiht sich nur ihre Anzeige.
       Chats kommen mit der Ansicht. Miras Setter nimmt eine kuerzere Liste als Ausschnitt und
       behaelt, was Mira schon nachgeladen hat (ask-mira.js, 17.09.).
       Opportunities kommen, sobald das Brett sie braucht (upwNeeds "opportunities"), und danach
       nur noch mit Aktualisieren oder einem Teamwechsel: das Brett fuehrt verschobene Karten selbst
       weiter -- eine zweite Lieferung beim Hin- und Herschalten setzte sie auf den alten Stand
       zurueck. Scheitert die Abfrage, bekommt das Brett seinen Lesefehler statt endlos zu laden. */
    function chatsAuftrag() {
      var a = D.chats(team(), { limit: 15 });
      return {
        kanal: "ag_chats", imSpeicher: imSpeicher([a]), ladenAn: function () {},
        laden: function (frisch) {
          return lader.laden("ag_chats", a, { frisch: !!frisch }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () {
              var l = erg.ok ? D.zuChats(erg.daten) : null;
              if (l) { try { setter("askMiraSetPreviousChats")(l); } catch (e) {} }
            };
          });
        }
      };
    }
    function oppsAuftrag() {
      var a = D.opportunities(team());
      return {
        kanal: "ag_opps", imSpeicher: false,
        ladenAn: function () { try { setter("opportunitiesSetLoading")("yes"); } catch (e) {} },
        laden: function () {
          return lader.laden("ag_opps", a, { frisch: true }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () {
              var l = erg.ok ? D.zuOpportunities(erg.daten) : null;
              if (l) { state.oppsGeliefert = team(); try { setter("opportunitiesSetItems")(l); } catch (e) {} }
              /* Ein unlesbarer Text ist der Weg des Bretts zu seinem Lesefehler (opportunities.js,
                 opportunitiesSetItems) -- leer sahe aus wie "es gibt keine". */
              else { try { setter("opportunitiesSetItems")("{"); } catch (e) {} }
              /* Nach dem ausdruecklichen "yes" auch das "no": sonst wartet ein leeres Brett mit
                 seinem Leerzustand (opportunities.js, wartetAufNein). */
              try { setter("opportunitiesSetLoading")("no"); } catch (e) {}
            };
          });
        }
      };
    }
    function agenticAuftraege(frisch) {
      var l = [agAuftrag("ov", true), agAuftrag(agListe(), true), chatsAuftrag()];
      if (frisch && state.oppsGeliefert === team()) l.push(oppsAuftrag());
      return l;
    }
    function visAuftrag() {
      var f = filterStand();
      /* DIE TABELLE (09.10., zweimal):
         - OHNE eigene Auswahl sortiert sie ueber ALLE Marken und zeigt die ersten 7 der gewaehlten
           Sortierung -- so war es vorher, und so arbeiten Tabellen neben einem Chart ueberall:
           "Visibility aufsteigend" heisst die 7 Marken mit der geringsten Sichtbarkeit, nicht die 7
           des Charts andersherum. Die erste Fassung vom 09.10. hatte die Tabelle auf die Marken des
           Charts gekuerzt; damit war jede andere Sortierung sinnlos (gemeldet).
         - MIT eigener Auswahl im Fader zeigt sie genau die gewaehlten Marken, in der gewaehlten
           Sortierung ("soll gleichermassen auch auf die Tabelle angewendet werden"). */
      var manuell = state.vis.firmen;
      var vis = D.visibility(f, { gran: state.gran, firmen: manuell });
      var ov = D.overview(f, manuell ? { order: state.vis.order, limit: 10, firmen: manuell } : { order: state.vis.order, limit: 7 });
      return {
        kanal: "vis", imSpeicher: imSpeicher([vis, ov]),
        ladenAn: function () { try { setter("setVisibilityChartLoading")(ids.vot, "yes"); } catch (e) {} },
        laden: function (frisch) {
          return alleLaden([["vis_chart", vis], ["vis_tabelle", ov]], frisch).then(function (e) {
            if (e.some(function (x) { return x.ueberholt; })) return null;
            return function () {
              /* Nur mit eigener Auswahl auf die Marken im Chart gekuerzt (dieselbe Menge wie
                 p_companies); ohne Auswahl gilt die Antwort, wie sie kommt. */
              var p = e[0].ok && e[1].ok ? D.zuVisibility(e[0].daten, e[1].daten, { nurImChart: !!manuell }) : null;
              if (e[1].ok) eigeneMerken(e[1].daten);
              if (!p) {
                try { setter("renderVisibilityChart")({ instanceId: ids.vot, __parseError: true }); } catch (err) {}
              } else {
                if (!state.vis.firmen) { state.autoFirmen = p.companies.map(function (c) { return c.company_id; }); persist(); }
                p.instanceId = ids.vot; p.isDark = isDark();
                try { setter("renderVisibilityChart")(p); } catch (err) {}
              }
              /* Der Chart haelt einen AUSDRUECKLICH gesetzten Ladezustand, bis er ebenso
                 ausdruecklich endet (visibility-chart.js, LOADING_EXPLICIT). */
              try { setter("setVisibilityChartLoading")(ids.vot, "no"); } catch (err) {}
            };
          });
        }
      };
    }
    function topAuftrag() {
      var f = filterStand(), m = state.top.modus, tp = state.top;
      var typen = D.topTypen(f, m, { erwaehnt: tp.erwaehnt });
      var list = D.topListe(f, m, { erwaehnt: tp.erwaehnt, citationTypen: tp.citationTypen, urlTypen: m === "url" ? tp.urlTypen : null, limit: 7 });
      return {
        kanal: "top", imSpeicher: imSpeicher([typen, list]),
        ladenAn: function () { try { setter("setTopCitationsLoading")(ids.tcd, "yes"); } catch (e) {} },
        laden: function (frisch) {
          return alleLaden([["top_typen", typen], ["top_liste", list]], frisch).then(function (e) {
            if (e.some(function (x) { return x.ueberholt; })) return null;
            return function () {
              var p = e[0].ok && e[1].ok ? D.zuTop(e[0].daten, e[1].daten, m) : null;
              if (!p) {
                try { setter("renderTopCitations")({ instanceId: ids.tcd, __parseError: true }); } catch (err) {}
              } else {
                var mk = marke();
                p.instanceId = ids.tcd; p.isDark = isDark();
                if (mk) p.brand = { id: str(mk.company_id || mk.id), name: str(mk.name), logo: str(mk.logo_url) };
                try { setter("renderTopCitations")(p); } catch (err) {}
              }
              try { setter("setTopCitationsLoading")(ids.tcd, "no"); } catch (err) {}
            };
          });
        }
      };
    }
    function respAuftrag() {
      var teile = D.responsesTeile(filterStand(), state.resp), reqId = state.resp.requestId;
      return {
        kanal: "resp", imSpeicher: imSpeicher(teile),
        ladenAn: function () { try { setter("setResponsesTableLoading")(ids.urt, "yes"); } catch (e) {} },
        laden: function (frisch) {
          return alleLaden(teile.map(function (a, i) { return ["resp_" + i, a]; }), frisch).then(function (e) {
            if (e.some(function (x) { return x.ueberholt; })) return null;
            return function () {
              var ok = e.every(function (x) { return x.ok; });
              var p = ok ? D.zuResponses(e.map(function (x) { return x.daten; })) : null;
              if (!p) {
                try { setter("renderResponsesTable")({ instanceId: ids.urt, __parseError: true }); } catch (err) {}
              } else {
                var mk = marke();
                p.instanceId = ids.urt; p.isDark = isDark();
                if (reqId != null) p.requestId = reqId;
                if (mk) { p.brand_name = str(mk.name); p.brand_logo = str(mk.logo_url); }
                try { setter("renderResponsesTable")(p); } catch (err) {}
              }
              /* Nach jeder Lieferung "no": eine LEERE Antwort beendet den Ladezustand der Tabelle
                 sonst erst nach ihrer Notbremse (Leerzustand sofort, wie in Ads verlangt). */
              try { setter("setResponsesTableLoading")(ids.urt, "no"); } catch (err) {}
            };
          });
        }
      };
    }
    var AUFTRAG = { vis: visAuftrag, top: topAuftrag, resp: respAuftrag };
    function bedarf(o) {
      if (!bereit()) return null;
      if (state.modus === "power") return gemeinsam(agenticAuftraege(o && o.frisch), o);
      return gemeinsam([visAuftrag(), topAuftrag(), respAuftrag()], o);
    }
    /* Allein: nur ein Teil der Analytic-Ansicht (seine eigene Bedienung). Ebenfalls gebuendelt,
       je Teil 80ms: wer D/W/M oder die Sortierung durchklickt, schickt eine Anfrage, nicht zehn. */
    var teilUhren = {};
    function teilLaden(teil) {
      clearTimeout(teilUhren[teil]);
      teilUhren[teil] = setTimeout(function () {
        teilUhren[teil] = null;
        if (state.modus === "standard" && bereit()) gemeinsam([AUFTRAG[teil]()]);
      }, 80);
    }
    /* AKTUALISIEREN = DEN DB-CACHE LEEREN, DANN FRISCH LADEN (Regel fuer jeden Refresh-Knopf).
       clear_dashboard_cache_v1 leert Dashboard- UND Citations-Cache des Teams (Vertrag). Alles
       sofort in den Ladezustand; scheitert das Leeren, wird trotzdem neu geladen.
       EINMAL ZUR ZEIT: solange ein Aktualisieren laeuft, zaehlt kein weiterer Klick (gemessen ohne
       Sperre: 30 Klicks in 0,6s = 30 Aufrufe von clear, die DB erlaubt 10 je Minute). Der Knopf
       dreht sich trotzdem -- der Klick ist gesehen, es wird ja gerade frisch geladen. */
    var aktualisiertGerade = false;
    function aktualisieren() {
      if (aktualisiertGerade || !team() || !bereit()) return;
      aktualisiertGerade = true;
      var c = D.clear(team());
      var vorab = UC.rpc(c.fn, c.params).then(function () { lader.leeren(); }, function () { lader.leeren(); });
      var fertig = function () { aktualisiertGerade = false; };
      Promise.resolve(bedarf({ frisch: true, vorab: vorab })).then(fertig, fertig);
    }

    /* Teamwechsel ohne Neuladen: andere Daten, also nichts aus dem Speicher weiterzeigen, und die
       Markenauswahl des alten Teams gilt nicht mehr. */
    if (UC.onTeamChange) UC.onTeamChange(function () {
      lader.leeren(); state.resp.offset = 0; state.vis.firmen = null; state.autoFirmen = []; state.oppsGeliefert = null;
      state.resp.firmen = null; persist(); bedarf();
    }, root);

    var ctrl = {
      root: root, state: state, ids: ids,
      reset: function () {
        lader.leeren();
        state.vis = { order: "visibility_desc", firmen: null };
        state.top = { modus: "domain", erwaehnt: "all", citationTypen: null, urlTypen: null };
        state.resp = respVorgabe();
        ["resetVisibilityChart", "resetTopCitations", "resetResponsesTable"].forEach(function (n, i) {
          try { setter(n)([ids.vot, ids.tcd, ids.urt][i]); } catch (e) {}
        });
        persist(); bedarf();
        return true;
      },
      neuLaden: function () { lader.leeren(); bedarf(); }
    };
    root.__udsCtrl = ctrl;

    modusZeigen();
    /* Erst nach dem Aufbau der eingebetteten Bausteine: deren Skripte richten sich ueber
       watchRoots ein, der Kalender kennt seinen Zeitraum also erst einen Takt spaeter. */
    setTimeout(function () { filterAbgleichen(); persist(); bedarf(); }, 0);
    return ctrl;
  }

  /* ---- Mount ---------------------------------------------------------------------------------- */
  function alle() { return [].slice.call(document.querySelectorAll(".uds-root")); }
  function jede(id, fn) {
    var r = alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); });
    r.forEach(function (x) { var c = initRoot(x); if (c) fn(c); });
    return r.length > 0;
  }
  window.resetDashboardPage = function (id) { return jede(id, function (c) { c.reset(); }); };
  /* EINRICHTEN, SOBALD DIE WURZEL ZU SEHEN IST -- wie die Citations-Seite: Bubble setzt das
     Element in die noch versteckte Ansicht und macht sie spaeter nur per Stil sichtbar. Erst
     sichtbar einrichten, damit Kalender, Charts und Tabellen sich richtig vermessen. */
  function einrichten() {
    alle().forEach(function (r) {
      if (r.__udsCtrl) return;
      if (messbar(r)) { initRoot(r); return; }
      var neu = !(UC.wartetAufSicht && UC.wartetAufSicht(r));
      beiSicht(r, "einrichten", function () { initRoot(r); }, messbar, { lang: neu });
    });
  }
  if (UC.watchRoots) UC.watchRoots("uds-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }

  udsBoot(30);
})();
