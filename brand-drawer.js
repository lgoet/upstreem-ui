/* upstreem brand-drawer.js -- der Marken-Drawer aus core (12.10.). Praefix ubdr.
   Braucht core.js, citations-data.js, dashboard-data.js, performance-data.js und brand-detail.js.

   Ein Drawer der ERSTEN Ebene (#drawer-brand, Hoehe und Bewegung aus der Huelle in core,
   KERN_DRAWER). Aufbau von oben, wie Prompt:
     Kopf (core)   "Brand / <Name>", Bearbeiten, Ask Mira, Anheften, Schliessen
     Titel         Logo links, daneben der Name, darunter die Domain -- aus brand_detail_v1
     Filterzeile   Kalender, Modelle, Maerkte, Topics. Anders als beim Prompt alle drei: eine
                   Marke hat keinen eigenen Markt und keine eigenen Topics.
     Brand Detail  die Komponente brand-detail.js (Visibility, Ranking, Sentiment, Variations)
     Top Citations die Top Citations der App, nur Antworten, die diese Marke nennen
     Responses     die Responses-Tabelle der App, nur Antworten, die diese Marke nennen
   Die drei Bausteine sind die ECHTEN der App im lokalen Modus (data-local). Gefuellt werden sie
   mit vorhandenen RPCs:
     - Kennzahlen: cached_dashboard_overview_v1 mit p_companies;
     - Kurve und Varianten: performance_company_chart_v1 und performance_brand_variations_v1
       (performance-data.js, markenKurve/markenVarianten);
     - Citations und Responses: mit p_brand.
   Neu sind brand_detail_v1 und p_brand, gebaut vom DB-Chat am 12.10. (bubble/brand_detail_12_10/).
   GRUNDREGEL des Vertrags: alles im Drawer ist aus Sicht der Drawer-Marke. "Erwaehnt" in den
   Citations meint sie, Rang und Sentiment der Responses auch; nur die Spalte "Mentioned?" der
   Tabelle bleibt bei der eigenen Marke. Solange die Bubble-Gruppe #drawer-brand steht, laeuft
   hier nichts.

   Was die ganze Ansicht betrifft (Oeffnen, Zeitraum, Filter), geht gleichzeitig hinaus. Was nur
   einen Teil betrifft (Modus, D/W/M, Sortierung, Suche, Seite ...), laeuft allein. */
(function () {
  "use strict";

  function ubdrBoot(n) {
    if (!window.UpstreemCore || !window.UpstreemCitationsDaten || !window.UpstreemDashboardDaten || !window.UpstreemPerformanceDaten) {
      if (n > 0) { setTimeout(function () { ubdrBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[brand-drawer] core.js, citations-data.js, dashboard-data.js oder performance-data.js nicht geladen");
      return;
    }
    ubdrStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .drawer_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    tcd: "<div class=\"up-root tcd-root\" data-local=\"yes\" data-instance=\"__UBDR_TCD__\" data-cdn-pin=\"\" data-isdark=\"__UBDR_DARK__\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"tcd-unit tcd-unit-left\"><div class=\"tcd-head\"><div class=\"tcd-mode\" role=\"tablist\" aria-label=\"Mode\"><button class=\"tcd-mode-btn is-active\" data-mode=\"domain\" type=\"button\" role=\"tab\">Domains</button><button class=\"tcd-mode-btn\" data-mode=\"url\" type=\"button\" role=\"tab\">URLs</button></div><div class=\"tcd-head-tools\"><div class=\"tcl-seg\" role=\"tablist\" aria-label=\"Chart type\"><button class=\"tcl-seg-btn is-active\" data-chart=\"doughnut\" role=\"tab\" aria-selected=\"true\" data-tip=\"Doughnut\" aria-label=\"Doughnut\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.5 15.8278C17.9985 21.756 9.86407 23.4835 5.20143 18.8641C0.629484 14.3347 2.04493 6.12883 8.05653 3.5\"/><path d=\"M17.6831 12.5C19.5708 12.5 20.5146 12.5 21.1241 11.655C21.1469 11.6234 21.1848 11.5667 21.2052 11.5336C21.7527 10.6471 21.4705 9.966 20.9063 8.60378C20.3946 7.36853 19.6447 6.24615 18.6993 5.30073C17.7538 4.35531 16.6315 3.60536 15.3962 3.0937C14.034 2.52946 13.3529 2.24733 12.4664 2.79477C12.4333 2.81523 12.3766 2.85309 12.345 2.87587C11.5 3.4854 11.5 4.42922 11.5 6.31686V8.42748C11.5 10.3473 11.5 11.3072 12.0964 11.9036C12.6928 12.5 13.6527 12.5 15.5725 12.5H17.6831Z\"/></svg></button><button class=\"tcl-seg-btn\" data-chart=\"bar\" role=\"tab\" aria-selected=\"false\" data-tip=\"Bars\" aria-label=\"Bars\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H21\"/><path d=\"M7 8V9C7 9.55228 7.44772 10 8 10H18C18.5523 10 19 9.55228 19 9V8C19 7.44772 18.5523 7 18 7H8C7.44772 7 7 7.44772 7 8Z\"/><path d=\"M7 15V16C7 16.5523 7.44772 17 8 17H14C14.5523 17 15 16.5523 15 16V15C15 14.4477 14.5523 14 14 14H8C7.44772 14 7 14.4477 7 15Z\"/></svg></button></div></div></div><div class=\"tcd-box\"><div class=\"tcd-panel-body\"><div class=\"tcl-top-total\"><span class=\"n\">0</span><span class=\"lbl\">Citations</span></div><div class=\"up-donut-body\"></div></div></div></div><div class=\"tcd-unit tcd-unit-right\"><div class=\"tcd-head\"><div class=\"tcd-heading tcd-heading-right up-heading\"><span class=\"tcd-head-label\">Top Domains</span><span class=\"tcd-head-count up-head-count\"></span></div><div class=\"tcd-head-tools\"><button class=\"tcd-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"tcd-brand-toggle-lbl\"><img class=\"tcd-brand-logo\" src=\"\" style=\"display:none\"/><span class=\"tcd-brand-label\"></span></span><span class=\"tcd-brand-check\"><svg class=\"tcd-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"tcd-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"tcd-filter\"><button class=\"tcd-filter-btn tcd-iconbtn\" type=\"button\" data-tip=\"Filter\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg><span class=\"tcd-filter-badge\"></span></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"tcd-export tcd-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"tcd-goto tcd-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5\"/></svg></button></div></div><div class=\"tcd-box\"><div class=\"tct-table\"></div></div></div></div>",
    urt: "<div class=\"up-root urt-root\" data-local=\"yes\" data-merken=\"yes\" data-instance=\"__UBDR_URT__\" data-cdn-pin=\"\" data-isdark=\"__UBDR_DARK__\" data-brand-name=\"__UBDR_BRAND__\" data-brand-logo=\"__UBDR_BRANDLOGO__\" data-spotlight-mode=\"no\" data-export-instance=\"\" data-sticky-top=\"16\" data-sticky=\"yes\" data-default-view=\"table\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Responses</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"urt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"urt-brand-toggle-lbl\"><img class=\"urt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"urt-brand-label\"></span></span><span class=\"urt-brand-check\"><svg class=\"urt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"urt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- Reihenfolge: Sorter VOR dem Fader, also von rechts gelesen der Fader vor dem Sorter. core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars) -- hier steht sie richtig, damit eine Neuinstallation nicht erst umsortiert werden muss. --><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- lucide \"settings-2\" \u2014 the SAME filter glyph visibility-chart / topcitations / combo-chart use. .up-iconbtn makes it behave like every other toolbar icon button. --><div class=\"urt-fader\"><button class=\"urt-fader-btn up-iconbtn\" type=\"button\" data-tip=\"Filter by rank &amp; sentiment\" aria-label=\"Filter by rank and sentiment\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg></button><div class=\"urt-fader-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search responses\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"urt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- .up-dense / .up-dense-btn are core's segmented control \u2014 the same one the Row Height picker uses. Reused verbatim so this switcher IS the app's switcher, not a lookalike. .urt-viewswitch only overrides the width (core's is full-width for the popover). --><div class=\"up-dense urt-viewswitch\" role=\"group\" aria-label=\"View\"><button class=\"up-dense-btn up-dense-btn-icon is-active\" type=\"button\" data-view=\"table\" data-tip=\"Table view\" aria-label=\"Table view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18\"/></svg></button><button class=\"up-dense-btn up-dense-btn-icon\" type=\"button\" data-view=\"cards\" data-tip=\"Card view\" aria-label=\"Card view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 4V20\"/><path d=\"M18 4V20\"/><path d=\"M21 7L3 7\"/><path d=\"M21 17L3 17\"/></svg></button></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><!-- The lead column's resize grip. Every other table has one; without it the first column simply cannot be dragged (core's resize kit binds to .up-grip). --><div class=\"up-th up-th-prompt\">Prompt<span class=\"up-grip\" data-grip=\"prompt\"></span></div><!-- \"<brand logo> mentioned?\", identical to urls-table: the logo is filled in from data-brand-logo, and without one the label falls back to \"<brand name> mentioned?\" --><div class=\"up-th up-th-mentioned\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">Mentioned</span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions</div><div class=\"up-th up-th-citations\">Citations</div><div class=\"up-th up-th-model\">Model</div><div class=\"up-th up-th-date is-sortable\" data-sortcol=\"date\"><span class=\"up-th-txt\">Date</span><span class=\"up-thsort\" data-for=\"date\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"urt-cards\"></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function ubdrStart() {
  var UC = window.UpstreemCore, D = window.UpstreemDashboardDaten, PD = window.UpstreemPerformanceDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  if (!UC.kernDrawer) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function liste(s) { return String(s == null ? "" : s).split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function setter(name) { return typeof window[name] === "function" ? window[name] : function () {}; }
  function dunkel() { try { return (window.getUpstreemTheme ? window.getUpstreemTheme() : "") === "dark"; } catch (e) { return false; } }
  function eigeneMarke() {
    var l = UC.getBrands ? UC.getBrands() : [];
    for (var i = 0; i < l.length; i++) if (l[i] && (str(l[i].role).toLowerCase() === "own" || l[i].is_own === true)) return l[i];
    return null;
  }
  function teamWarten() { return UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(UC.getTeam ? UC.getTeam() : ""); }
  /* Logos und Favicons nur als http(s) oder protokollrelativ (Bubble-CDN "//..."): die Adresse
     landet in einem img-src (Befund H6 der Brands-Runde: javascript: als Logo war setzbar). */
  function bild(u) { u = str(u).trim(); if (/^\/\//.test(u)) return "https:" + u; return /^https?:\/\//i.test(u) ? u : ""; }

  var FN = { kopf: "brand_detail_v1" };
  var IDS = { daten: "drawer-brand-daten", filter: "drawer-brand-filter", modelle: "drawer-brand-models",
              maerkte: "drawer-brand-markets", topics: "drawer-brand-topics",
              ubd: "drawer-brand-detail", tcd: "drawer-brand-topcitations", urt: "drawer-brand-responses" };

  var B = {
    slot: null, root: null, kopf: null, id: "", zeile: null, nr: 0, ab: null, fehler: "", fehlerWiederholbar: false,
    lader: D.makeLader({ rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 60000 }); } }),
    f: { von: "", bis: "", modelle: null, maerkte: null, topics: null, tagmode: "or" },
    /* Modus und Stufe der Brand-Detail-Komponente: sie meldet beides, der Drawer laedt danach. */
    ubd: { modus: "visibility", gran: "day" },
    top: { modus: "domain", erwaehnt: "all", citationTypen: null, urlTypen: null },
    resp: null, eigene: null, kopfSpeicher: {}
  };
  function respStart() {
    return { order: "run_at_desc", limit: 15, offset: 0, suche: "", requestId: null, erwaehnt: "all",
             firmen: null, sentMin: null, sentMax: null, rankMin: null, rankMax: null };
  }
  B.resp = respStart();

  function filterStand() {
    return { team: UC.getTeam ? UC.getTeam() : "", von: B.f.von, bis: B.f.bis, modelle: B.f.modelle,
             maerkte: B.f.maerkte, topics: B.f.topics, tagmode: B.f.tagmode };
  }
  /* Eine Anfrage mit einem Zusatz-Parameter und neuer Signatur -- sonst mischte der Speicher des
     Laders die Antworten zweier Marken. */
  function mit(a, zusatz) {
    var p = {}, k;
    for (k in a.params) p[k] = a.params[k];
    for (k in zusatz) p[k] = zusatz[k];
    return { art: a.art, fn: a.fn, params: p, sig: a.fn + "|" + JSON.stringify(p) };
  }
  function marke() { return eigeneMarke() || B.eigene || null; }

  /* ---- Der Kopf: Logo, Name, Domain ---- */
  /* Die Logo-Kachel aus core (.up-logo-box) in Kopfgroesse, wie der Kopf von performance-detail
     (.upd-held-logobox): Bild, sonst der erste Buchstabe. Das Logo kommt nach der Logo-Regel aus
     der DB (Override nur fuer die eigene Marke, sonst Favicon); faellt es aus, greift der
     Favicon-Rueckfall aus core ueber data-domain. */
  function logoHtml(d) {
    var logo = bild(d.logo_url) || bild(d.favicon_url), name = str(d.name).trim();
    return '<span class="up-logo-box ubdr-logo' + (logo ? " has-img" : "") + '"' +
        (d.domain ? ' data-domain="' + esc(str(d.domain)) + '"' : "") + '>' +
      (logo ? '<img src="' + esc(logo) + '" alt="" referrerpolicy="no-referrer"' +
              ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()">' : "") +
      '<span class="up-logo-ltr">' + esc(name.charAt(0).toUpperCase() || "?") + '</span></span>';
  }
  function kopfZeichnen() {
    var r = B.root;
    if (!r) return;
    var d = B.zeile, elLogo = r.querySelector(".ubdr-logobox"), elName = r.querySelector(".ubdr-titel"),
        elDomain = r.querySelector(".ubdr-domain"), elMeta = r.querySelector(".ubdr-meta");
    r.classList.toggle("is-fehler", !!B.fehler);
    var fehlerEl = r.querySelector(".ubdr-fehler");
    fehlerEl.hidden = !B.fehler;
    if (B.fehler) {
      fehlerEl.innerHTML = UC.leerHtml({ icon: "info", titel: "Brand not available", text: B.fehler,
        knopf: B.fehlerWiederholbar ? "Try again" : "", knopfAttr: "data-ubdr-retry" });
      if (B.kopf) { B.kopf.name(""); B.kopf.eigen.innerHTML = ""; }
      return;
    }
    if (!d) {
      elLogo.innerHTML = '<span class="ubdr-skz is-logo"></span>';
      elName.innerHTML = '<span class="ubdr-skz is-titel"></span>';
      elDomain.innerHTML = '<span class="ubdr-skz is-s"></span>';
      elMeta.innerHTML = "";
      if (B.kopf) { B.kopf.name(null); B.kopf.eigen.innerHTML = ""; }
      return;
    }
    elLogo.innerHTML = logoHtml(d);
    elName.textContent = str(d.name) || "–";
    var dom = str(d.domain).trim();
    /* Die Domain oeffnet ihren Drawer, wie die Domain im Kopf des URL-Drawers. */
    elDomain.innerHTML = dom ? '<button type="button" class="ubdr-domlink" data-ubdr-domain="' + esc(dom) + '"' +
      ' data-tip="' + esc(t("Open domain")) + '">' + esc(dom) + '</button>' : "";
    elMeta.innerHTML = "";
    /* Eine Marke, die das Team nicht mehr verfolgt (nur ueber alte Links): statt leerer Zahlen
       ein Satz (Vertrag 12.10.: Kurve und Varianten antworten dann mit performance_not_found,
       der Rest leer). Filter und Bausteine treten ganz zurueck. */
    var inaktiv = str(d.status) === "inactive";
    r.classList.toggle("is-inaktiv", inaktiv);
    var elInaktiv = r.querySelector(".ubdr-inaktiv");
    elInaktiv.hidden = !inaktiv;
    if (inaktiv) {
      var seit = str(d.deactivated_at);
      elInaktiv.innerHTML = UC.leerHtml({ icon: "info", titel: "No longer tracked",
        text: seit ? t("Your team stopped tracking this brand on {date}.").replace("{date}", UC.fmtDate(seit))
                   : t("Your team no longer tracks this brand.") });
    }
    if (B.kopf) {
      B.kopf.name(str(d.name));
      var html = knopf("edit", "squarePen", "Edit brand");
      if (UC.anMira && UC.miraBezug) html += knopf("mira", "blend", "Ask Mira about this");
      if (typeof window.upstreemPinToSidebar === "function") html += knopf("pin", "pin", "Pin to sidebar");
      B.kopf.eigen.innerHTML = html;
    }
  }
  function knopf(art, zeichen, label) {
    return '<button type="button" class="up-iconbtn" data-ubdr-kopf="' + art + '" data-tip="' + esc(t(label)) +
      '" aria-label="' + esc(t(label)) + '">' + UC.icon(zeichen, 2) + '</button>';
  }
  function kopfKlick(art) {
    var d = B.zeile || {};
    if (art === "edit") {
      /* Der Brand Editor ist (noch) ein Bubble-Drawer der dritten Ebene: openDrawer meldet ihn
         Bubble ueber bubble_fn_drawer_companysettings -- derselbe Weg wie der Stift der alten
         Kopfleiste ueber seinen Workflow. */
      if (UC.drawerOeffnen) UC.drawerOeffnen("companysettings", B.id, "brand-drawer");
      else if (typeof window.openDrawer === "function") { try { window.openDrawer("companysettings", B.id); } catch (e) {} }
    } else if (art === "mira" && UC.anMira && UC.miraBezug) {
      var b = UC.miraBezug({ type: "brand", id: B.id, name: str(d.name), logo: bild(d.logo_url) });
      if (b) UC.anMira(b, ["brand"]);
    } else if (art === "pin" && typeof window.upstreemPinToSidebar === "function") {
      try { window.upstreemPinToSidebar({ type: "brand", id: B.id, label: str(d.name) || B.id, logo: bild(d.logo_url) || bild(d.favicon_url) }); } catch (e) {}
    }
  }
  function fehlerText(code) {
    var c = String(code || "").trim();
    /* Wortlaut des DB-Chats (12.10.), auch fuer eine fremde Marke. */
    if (c === "brand_not_found" || c === "team_invalid_param") return "This brand doesn't exist in this team.";
    if (c === "settings_not_authenticated" || c === "not authenticated") return "Your session has expired. Please sign in again.";
    if (c === "team_deleted") return "This team has been deleted.";
    if (/^team_access_/.test(c) || c === "forbidden" || c === "team_forbidden") return "Your team doesn't have access right now.";
    if (c === "brand_rate_limited") return "Too many requests in a short time. Please wait a moment.";
    return "This brand could not be loaded. Please try again.";
  }
  function wiederholbar(code) {
    var c = String(code || "").trim();
    return !(c === "brand_not_found" || c === "team_invalid_param" || /^team_access_/.test(c) || c === "forbidden" ||
      c === "team_forbidden" || c === "team_deleted" || c === "not authenticated" || c === "settings_not_authenticated");
  }
  /* ---- LADEN: GEMEINSAM (13.10. angefordert: "solange eine Komponente noch laedt, soll alles
     laden") ------------------------------------------------------------------------------------
     Dieselbe Mechanik wie dashboard-page.js (gemeinsam): alle Teile einer Gruppe gehen zugleich
     in den Ladezustand, ihre Anfragen gleichzeitig hinaus, und gezeichnet wird erst, wenn ALLE
     Antworten da sind -- beim Oeffnen samt Kopf. Vorher erschien jeder Teil, sobald er da war, und
     der Drawer baute sich in Stufen auf. Was im Speicher liegt, geht nicht erst in den
     Ladezustand. Je Teil zeichnet nur die juengste Gruppe, die ihn angefordert hat.
     Ein Auftrag: { kanal, imSpeicher, ladenAn(), laden(frisch) -> Promise<zeichnen | null> }. */
  var gruppeNr = 0, juengsteJe = {};
  function gemeinsam(auftraege, frisch) {
    var nr = ++gruppeNr;
    auftraege.forEach(function (a) { juengsteJe[a.kanal] = nr; if (frisch || !a.imSpeicher) a.ladenAn(); });
    return Promise.all(auftraege.map(function (a) { return a.laden(frisch); })).then(function (zeigen) {
      zeigen.forEach(function (z, i) {
        if (z && juengsteJe[auftraege[i].kanal] === nr) { try { z(); } catch (e) { if (window.console) console.error("[brand-drawer] " + auftraege[i].kanal + ":", e); } }
      });
    });
  }
  function laden(paare, frisch) {
    return Promise.all(paare.map(function (p) { return B.lader.laden(p[0], p[1], { frisch: !!frisch }); }));
  }
  function imSpeicher(anfragen) { return anfragen.every(function (a) { return B.lader.ausSpeicher(a) !== undefined; }); }

  /* Der Kopf haengt nicht am Zeitraum: einmal je Marke, aus dem Speicher beim Wiederoeffnen.
     Ein FEHLER oder eine inaktive Marke zeichnet sofort: dann gibt es nichts, worauf der Rest
     warten muesste -- die Bausteine sind ohnehin ausgeblendet. */
  function kopfAuftrag() {
    var id = B.id;
    return {
      kanal: "kopf", imSpeicher: !!B.kopfSpeicher[id],
      ladenAn: function () { B.zeile = null; B.fehler = ""; kopfZeichnen(); },
      laden: function (frisch) {
        if (!frisch && B.kopfSpeicher[id]) {
          var d0 = B.kopfSpeicher[id];
          return Promise.resolve(function () { B.zeile = d0; B.fehler = ""; kopfZeichnen(); });
        }
        if (B.ab) { try { B.ab.abort(); } catch (e) {} }
        var ab = typeof AbortController !== "undefined" ? new AbortController() : null;
        B.ab = ab;
        var nr = ++B.nr;
        return teamWarten().then(function (team) {
          if (nr !== B.nr) return null;
          if (!team) return { ok: false, status: 0, fehler: { message: "not authenticated" } };
          return UC.rpc(FN.kopf, { p_team: team, p_company: id }, { timeoutMs: 60000, signal: ab ? ab.signal : undefined });
        }).then(function (erg) {
          if (!erg || nr !== B.nr) return null;
          var roh = erg.ok ? erg.daten : null;
          if (isArr(roh)) roh = roh.length ? roh[0] : null;
          var d = roh && roh.row && typeof roh.row === "object" ? roh.row : roh;
          if (d && typeof d === "object" && d.name != null) {
            B.kopfSpeicher[id] = d;
            if (str(d.status) === "inactive") { B.zeile = d; B.fehler = ""; kopfZeichnen(); return null; }
            return function () { B.zeile = d; B.fehler = ""; kopfZeichnen(); };
          }
          var code = erg.ok ? "" : str((erg.fehler && (erg.fehler.message || erg.fehler.code)) || "");
          if (window.console) console.warn("[brand-drawer] " + FN.kopf + " fuer " + id + ": " + (code || "Antwort nicht lesbar") +
            (erg.status ? " (HTTP " + erg.status + ")" : ""));
          B.zeile = null; B.fehler = t(fehlerText(code)); B.fehlerWiederholbar = wiederholbar(code);
          kopfZeichnen();
          return null;
        });
      }
    };
  }

  /* ---- Die drei Bausteine ---- */
  function eigeneMerken(daten) {
    var o = daten && daten.own;
    if (!o || typeof o !== "object" || !o.name) return;
    B.eigene = { company_id: str(o.company_id), name: str(o.name), logo_url: str(o.logo_url) };
  }
  /* Brand Detail, Kennzahlen: die Zeile der Marke aus der Overview, in die Feldnamen der
     Komponente (avg_*, wie get_company_detailed_overview_v4 sie lieferte). Ohne Logo: das steht
     im Kopf des Drawers, ein zweites in der Karte darunter waere doppelt. */
  function kennzahlen(daten) {
    var id = B.id.toLowerCase(), z = null;
    var rows = daten && isArr(daten.rows) ? daten.rows : [];
    for (var i = 0; i < rows.length; i++) if (rows[i] && str(rows[i].company_id).toLowerCase() === id) { z = rows[i]; break; }
    if (!z && daten && daten.own && str(daten.own.company_id).toLowerCase() === id) z = daten.own;
    if (!z) return null;
    return { company_id: str(z.company_id), name: str(z.name),
      avg_visibility_pct: num(z.visibility_pct), avg_visibility_delta_pct: num(z.visibility_delta_pct),
      avg_rank: num(z.avg_rank), avg_rank_delta: num(z.avg_rank_delta),
      avg_sentiment: num(z.sentiment), avg_sentiment_delta: num(z.sentiment_delta) };
  }
  function detailAuftrag() {
    var f = filterStand(), modus = B.ubd.modus, chart = modus !== "variations";
    var kz = D.overview(f, { firmen: [B.id], limit: 1 });
    var teil = chart ? PD.markenKurve(f, B.id, { modus: modus, gran: B.ubd.gran }) : PD.markenVarianten(f, B.id);
    return {
      kanal: "detail", imSpeicher: imSpeicher([kz, teil]),
      ladenAn: function () { setter("setBrandDetailLoading")(IDS.ubd, "yes"); },
      laden: function (frisch) {
        return laden([["ubd_kz", kz], ["ubd_" + (chart ? "kurve" : "var"), teil]], frisch).then(function (e) {
          if (e.some(function (x) { return x.ueberholt; })) return null;
          /* Ein Moduswechsel waehrend des Ladens: diese Antwort gehoert zum alten Modus. */
          if (modus !== B.ubd.modus) return null;
          return function () {
            if (e[0].ok) { eigeneMerken(e[0].daten); setter("setBrandDetailCompany")(IDS.ubd, kennzahlen(e[0].daten) || { name: "" }); }
            if (chart) {
              var k = e[1].ok ? PD.zuKurve(e[1].daten, B.id) : null;
              if (k) { k.mode = modus; setter("setBrandDetailSeries")(IDS.ubd, k); }
              else setter("setBrandDetailSeries")(IDS.ubd, { __parseError: true });
            } else {
              var v = e[1].ok ? PD.zuVarianten(e[1].daten) : null;
              /* Unlesbar ist nicht leer: dann der Fehlerzustand der Karte statt einer leeren Liste. */
              if (v) setter("setBrandDetailVariations")(IDS.ubd, v);
              else setter("setBrandDetailSeries")(IDS.ubd, { __parseError: true });
            }
            setter("setBrandDetailLoading")(IDS.ubd, "no");
          };
        });
      }
    };
  }
  /* Die Marke des Drawers fuer die Schalter "<Marke> mentioned" -- aus dem Kopf, sonst keine
     (dann bleibt der Schalter weg, statt die eigene Marke zu behaupten). Gelesen erst beim
     Zeichnen: in derselben Gruppe zeichnet der Kopf zuerst. */
  function drawerMarke() {
    var d = B.zeile;
    if (!d || str(d.company_id).toLowerCase() !== B.id.toLowerCase()) return null;
    return { id: B.id, name: str(d.name), logo: bild(d.logo_url) || bild(d.favicon_url) };
  }
  /* Top Citations: dieselben Anfragen wie das Dashboard, dazu p_brand (Vertrag 12.10.: nur Zitate
     aus Antworten, die die Marke nennen; p_mentioned meint dann ebenfalls sie). */
  function topAuftrag() {
    var f = filterStand(), m = B.top.modus, tp = B.top, zusatz = { p_brand: B.id };
    var typen = mit(D.topTypen(f, m, { erwaehnt: tp.erwaehnt }), zusatz);
    var list = mit(D.topListe(f, m, { erwaehnt: tp.erwaehnt, citationTypen: tp.citationTypen, urlTypen: m === "url" ? tp.urlTypen : null, limit: 7 }), zusatz);
    return {
      kanal: "top", imSpeicher: imSpeicher([typen, list]),
      ladenAn: function () { setter("setTopCitationsLoading")(IDS.tcd, "yes"); },
      laden: function (frisch) {
        return laden([["top_typen", typen], ["top_liste", list]], frisch).then(function (e) {
          if (e.some(function (x) { return x.ueberholt; })) return null;
          return function () {
            var p = e[0].ok && e[1].ok ? D.zuTop(e[0].daten, e[1].daten, m) : null;
            if (!p) setter("renderTopCitations")({ instanceId: IDS.tcd, __parseError: true });
            else {
              var mk = drawerMarke();
              p.instanceId = IDS.tcd; p.isDark = dunkel();
              if (mk) p.brand = mk;
              setter("renderTopCitations")(p);
            }
            setter("setTopCitationsLoading")(IDS.tcd, "no");
          };
        });
      }
    };
  }
  /* Responses: p_brand fest (die Marke des Drawers), p_company_ids bleibt dem Markenfilter der
     Tabelle -- beides zusammen heisst "nennt diese Marke UND eine der gewaehlten". p_mentioned
     geht NICHT mit (Vertrag 12.10.: er meint die eigene Marke); der Schalter der Tabelle steht
     im Spotlight fest auf "<Drawer-Marke> mentioned". */
  function respAuftrag() {
    var r = {}, k;
    for (k in B.resp) r[k] = B.resp[k];
    r.erwaehnt = "all";
    var teile = D.responsesTeile(filterStand(), r).map(function (a) { return mit(a, { p_brand: B.id }); }), reqId = B.resp.requestId;
    return {
      kanal: "resp", imSpeicher: imSpeicher(teile),
      ladenAn: function () { setter("setResponsesTableLoading")(IDS.urt, "yes"); },
      laden: function (frisch) {
        return laden(teile.map(function (a, i) { return ["resp_" + i, a]; }), frisch).then(function (e) {
          if (e.some(function (x) { return x.ueberholt; })) return null;
          return function () {
            var ok = e.every(function (x) { return x.ok; });
            var p = ok ? D.zuResponses(e.map(function (x) { return x.daten; })) : null;
            if (!p) setter("renderResponsesTable")({ instanceId: IDS.urt, __parseError: true });
            else {
              var mk = marke();
              p.instanceId = IDS.urt; p.isDark = dunkel();
              if (reqId != null) p.requestId = reqId;
              p.empty_text = t("This brand wasn't mentioned in the selected period.");
              if (mk) { p.brand_name = str(mk.name); p.brand_logo = str(mk.logo_url); }
              var dm = drawerMarke();
              if (dm) { p.spotlight_name = dm.name; p.spotlight_logo = dm.logo; }
              setter("renderResponsesTable")(p);
            }
            setter("setResponsesTableLoading")(IDS.urt, "no");
          };
        });
      }
    };
  }
  var AUFTRAG = { detail: detailAuftrag, top: topAuftrag, resp: respAuftrag };
  /* Alles, was die ganze Ansicht betrifft (Oeffnen, Filter, Zeitraum, Nochmal): eine Gruppe. Beim
     Oeffnen mit dem Kopf. */
  function alleLaden(frisch, mitKopf) {
    if (!B.id) return;
    teamWarten().then(function (team) {
      if (!team) return;
      var l = [detailAuftrag(), topAuftrag(), respAuftrag()];
      if (mitKopf) l.unshift(kopfAuftrag());
      gemeinsam(l, frisch);
    });
  }
  /* Einzelteile gebuendelt (80ms, wie das Dashboard): wer D/W/M oder die Sortierung durchklickt,
     schickt eine Anfrage, nicht zehn. Ein Teil allein ist eine Gruppe aus einem. */
  var teilUhren = {};
  function teilLaden(teil) {
    clearTimeout(teilUhren[teil]);
    teilUhren[teil] = setTimeout(function () { teilUhren[teil] = null; if (B.id) gemeinsam([AUFTRAG[teil]()], false); }, 80);
  }

  /* ---- Filter: Kalender, Modelle, Maerkte, Topics (lokal, ihre Auswahl kommt als DOM-Ereignis).
     Dieselben Regeln wie auf dem Dashboard (dashboard-page.js). ---- */
  function setzen(feld, wert) {
    var alt = JSON.stringify(B.f[feld] == null ? null : B.f[feld]);
    if (alt === JSON.stringify(wert == null ? null : wert)) return false;
    B.f[feld] = wert;
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
  function kalender() { var k = B.slot && B.slot.querySelector(".ubdr-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
  /* Die Stufe der Kurve folgt jedem neuen Zeitraum (UC.granFuerZeitraum), wie auf dem Dashboard. */
  function zeitraum(von, bis) {
    var a = setzen("von", von), b = setzen("bis", bis);
    if ((a || b) && UC.granFuerZeitraum) { var g = UC.granFuerZeitraum(von, bis); if (g) B.ubd.gran = g; }
    return a || b;
  }
  function filterAbgleichen() {
    var c = kalender(), r = null;
    try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
    if (r && r.from && r.to) zeitraum(r.from, r.to);
    var s = B.slot, m = s.querySelector(".umf-root"), k = s.querySelector(".umk-root"), tp = s.querySelector(".utf-root");
    try { if (m && m.__umfCtrl) setzen("modelle", auswahl("modelle", m.__umfCtrl.getSelected(), "model_keys")); } catch (e) {}
    try { if (k && k.__umkCtrl) setzen("maerkte", auswahl("maerkte", k.__umkCtrl.getSelected(), "market_codes")); } catch (e) {}
    try {
      if (tp && tp.__utfCtrl) {
        var sel = tp.__utfCtrl.getSelected(), l = liste(sel.topic_ids);
        setzen("topics", l.length ? l : null);
        setzen("tagmode", sel.tag_mode === "and" ? "and" : "or");
      }
    } catch (e) {}
  }
  var filterUhr = null;
  function filterGeaendert() {
    B.resp.offset = 0;
    clearTimeout(filterUhr);
    filterUhr = setTimeout(function () { filterUhr = null; alleLaden(false); }, 120);
  }

  /* ---- Aufbau im Drawer ---- */
  function einsetzen(m) {
    var mk = marke();
    return String(m || "").split("__UBDR_TCD__").join(esc(IDS.tcd)).split("__UBDR_URT__").join(esc(IDS.urt))
      .split("__UBDR_DARK__").join(dunkel() ? "yes" : "no")
      .split("__UBDR_BRANDLOGO__").join(esc(mk ? str(mk.logo_url) : ""))
      .split("__UBDR_BRAND__").join(esc(mk ? str(mk.name) : ""));
  }
  function aufbauen(ctx) {
    var dk = dunkel() ? "yes" : "no";
    ctx.slot.innerHTML =
      '<div class="up-root ubdr-root">' +
        '<div class="ubdr-head up-dk">' +
          '<div class="ubdr-meta up-dk-meta"></div>' +
          '<div class="ubdr-held">' +
            '<span class="ubdr-logobox"></span>' +
            '<div class="ubdr-text">' +
              '<h2 class="ubdr-titel up-dk-titel"></h2>' +
              '<div class="ubdr-domain"></div>' +
            '</div>' +
          '</div>' +
          /* Filterzeile wie auf den Seiten: links unter dem Kopf, ueber dem, was sie filtert. */
          '<div class="ubdr-filterzeile">' +
            '<div class="up-root udr-root ubdr-daten" data-instance="' + esc(IDS.daten) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
            '<div class="up-root ufb-root ubdr-filterleiste" data-instance="' + esc(IDS.filter) + '" data-topics-instance="' + esc(IDS.topics) + '"' +
              ' data-models-instance="' + esc(IDS.modelle) + '" data-markets-instance="' + esc(IDS.maerkte) + '" data-isdark="' + dk + '"></div>' +
            '<div class="up-root utf-root" data-instance="' + esc(IDS.topics) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
            '<div class="up-root umf-root" data-instance="' + esc(IDS.modelle) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
            '<div class="up-root umk-root" data-instance="' + esc(IDS.maerkte) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
          '</div>' +
        '</div>' +
        '<div class="ubdr-main">' +
          '<div class="ubdr-teil ubdr-detail"><div class="up-root ubd-root" data-local="yes" data-instance="' + esc(IDS.ubd) + '" data-isdark="' + dk + '"></div></div>' +
          '<div class="ubdr-teil ubdr-top">' + einsetzen(MARKUP.tcd) + '</div>' +
          '<div class="ubdr-teil ubdr-resp">' + einsetzen(MARKUP.urt) + '</div>' +
        '</div>' +
        '<div class="ubdr-inaktiv" hidden></div>' +
        '<div class="ubdr-fehler" hidden></div>' +
      '</div>';
    B.slot = ctx.slot; B.kopf = ctx; B.root = ctx.slot.querySelector(".ubdr-root");
    /* Die Tabelle zeigt nur Antworten mit der Drawer-Marke: ihr Schalter steht fest darauf. */
    var urtRoot = B.root.querySelector(".urt-root");
    if (urtRoot) urtRoot.setAttribute("data-spotlight-mode", "yes");
    if (UC.makeTooltips) UC.makeTooltips(B.root, dunkel);
    var s = ctx.slot;
    ctx.eigen.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-ubdr-kopf]") : null;
      if (b) kopfKlick(b.getAttribute("data-ubdr-kopf"));
    });
    s.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      if (e.target.closest("[data-ubdr-retry]")) { alleLaden(true, true); return; }
      var dom = e.target.closest("[data-ubdr-domain]");
      if (dom && UC.drawerOeffnen) UC.drawerOeffnen("domain", dom.getAttribute("data-ubdr-domain"), "brand-drawer");
    });
    /* Kalender: nur ein WIRKLICH anderer Zeitraum (er meldet sich auch beim Einrichten). */
    s.addEventListener("change", function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains("ubdr-daten")) return;
      var d = e.detail || {};
      if (!d.date_from || !d.date_to) return;
      if (zeitraum(d.date_from, d.date_to)) filterGeaendert();
    });
    s.addEventListener("umf-models", function (e) { if (setzen("modelle", auswahl("modelle", e.detail, "model_keys"))) filterGeaendert(); });
    s.addEventListener("umk-markets", function (e) { if (setzen("maerkte", auswahl("maerkte", e.detail, "market_codes"))) filterGeaendert(); });
    s.addEventListener("utf-topics", function (e) {
      var d = e.detail || {}, l = liste(d.topic_ids);
      var a = setzen("topics", l.length ? l : null), b = setzen("tagmode", d.tag_mode === "and" ? "and" : "or");
      if (a || (b && l.length)) filterGeaendert();
    });

    function an(name, fn) { s.addEventListener(name, function (e) { fn(e.detail || {}); }); }
    function wert(d) { return d && d.value != null ? d.value : ""; }
    /* Brand Detail meldet Modus und Stufe; beides zusammen bestimmt die naechste Anfrage.
       Die Namen sind die, die brand-detail.js im lokalen Modus schon schickt (Praefix "ubd" vor
       dem vollen Bubble-Namen) -- sie anzugleichen haette die Ereignisnamen fuer Bubble aus dem
       Vertrag genommen (.contract_diff.py), obwohl Bubble sie weiter bekaeme. */
    an("ubdbubble_fn_ubdMode", function (d) {
      var m = str(d.mode);
      if (["visibility", "rank", "sentiment", "variations"].indexOf(m) < 0) return;
      B.ubd.modus = m;
      if (d.gran === "day" || d.gran === "week" || d.gran === "month") B.ubd.gran = d.gran;
      teilLaden("detail");
    });
    an("ubdbubble_fn_ubdGran", function (d) {
      var g = str(d.gran);
      if (g !== "day" && g !== "week" && g !== "month") return;
      B.ubd.gran = g; teilLaden("detail");
    });
    an("tcd-tcdMode", function (d) {
      var m = wert(d) === "url" ? "url" : "domain";
      if (m === B.top.modus) return;
      B.top.modus = m; teilLaden("top");
    });
    an("tcd-tcdApplyTypeFilter", function (d) {
      var teile = str(wert(d)).split(";"), c = liste(teile[0]), u = liste(teile[1]);
      B.top.citationTypen = c.length ? c : null; B.top.urlTypen = u.length ? u : null;
      teilLaden("top");
    });
    an("tcd-tcdBrandMentioned", function (d) {
      var v = str(wert(d));
      B.top.erwaehnt = v === "yes" || v === "no" ? v : "all";
      teilLaden("top");
    });
    an("tcd-tcdRowClick", function (d) {
      var id = str(wert(d)).trim();
      if (id && UC.drawerOeffnen) UC.drawerOeffnen(B.top.modus === "url" ? "url" : "domain", id, "brand-drawer");
    });
    function respNeu(fn) { return function (d) { fn(d); B.resp.requestId = null; teilLaden("resp"); }; }
    an("urt-urtSearch", function (d) {
      B.resp.suche = str(d.query); B.resp.offset = 0;
      B.resp.requestId = d.requestId != null ? d.requestId : null;
      teilLaden("resp");
    });
    an("urt-urtSort", respNeu(function (d) { if (D.ORDER.responses.indexOf(str(d.order)) >= 0) B.resp.order = str(d.order); B.resp.offset = 0; }));
    an("urt-urtPage", respNeu(function (d) {
      var l = Number(d.limit), o = Number(d.offset);
      if (isFinite(l) && l > 0) B.resp.limit = Math.max(1, Math.min(100, Math.round(l)));
      if (isFinite(o) && o >= 0) B.resp.offset = Math.round(o);
    }));
    an("urt-urtFilter", respNeu(function (d) {
      function n(v) { var x = Number(v); return v == null || v === "" || !isFinite(x) ? null : x; }
      var ra = d.rank_active === true || d.rank_active === "true", sa = d.sent_active === true || d.sent_active === "true";
      B.resp.rankMin = ra ? n(d.rank_min) : null;
      B.resp.rankMax = ra && n(d.rank_max) != null && n(d.rank_max) < 20 ? n(d.rank_max) : null;
      B.resp.sentMin = sa ? n(d.sent_min) : null;
      B.resp.sentMax = sa ? n(d.sent_max) : null;
      B.resp.offset = 0;
    }));
    an("urt-urtMentioned", respNeu(function (d) { var l = liste(d.brands); B.resp.firmen = l.length ? l : null; B.resp.offset = 0; }));
    /* urt-urtBrand: im Spotlight bedient niemand den Schalter; kommt doch eins (Alle Filter
       loeschen), gilt weiter "all" -- siehe respLaden. */
    an("urt-urtRowClick", function (d) { var id = str(d.prompt_run_id).trim(); if (id && UC.drawerOeffnen) UC.drawerOeffnen("response", id, "brand-drawer"); });

    /* EXPORT (wie prompt-detail): das Export-Fenster der App vor dem Klick einstellen, mit der
       Marke (brand_id). Ohne Export-Fenster auf der Seite ein Satz statt eines toten Knopfs. */
    s.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".tcd-export, .urt-root .up-export") : null;
      var teil = b && b.closest(".tcd-root, .urt-root");
      if (!teil) return;
      var ex = document.querySelector(".uex-root[data-instance]");
      var k = ex ? str(ex.getAttribute("data-instance")).trim() : "";
      if (!k || /^[A-Z_]{3,}$/.test(k) || typeof window.upstreemExportOpen !== "function") {
        e.stopPropagation();
        if (UC.toast) UC.toast(t("Export isn't available on this page"), { kind: "neutral" });
        return;
      }
      teil.setAttribute("data-export-instance", k);
      var typ = teil.classList.contains("urt-root") ? "prompt_runs" : (B.top.modus === "url" ? "urls" : "domains");
      /* Bubble reicht brand_id an alle drei Exporte als p_brand weiter (Vertrag 12.10.). */
      try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, { export_type: typ, brand_id: B.id }); } catch (err) {}
    }, true);
  }

  UC.kernDrawer("brand", {
    aufbauen: aufbauen,
    zeigen: function (id) {
      id = str(id).trim();
      if (!id) return;
      if (id !== B.id) {
        /* Eine andere Marke: Auswahl, Suche und Seiten gehoeren zur vorigen. Sortierung,
           Seitengroesse, Modus und D/W/M bleiben -- Vorlieben, keine Auswahl. */
        var alt = B.resp;
        B.id = id; B.zeile = null; B.fehler = "";
        B.top.citationTypen = null; B.top.urlTypen = null; B.top.erwaehnt = "all";
        B.resp = respStart(); B.resp.order = alt.order; B.resp.limit = alt.limit;
        try { setter("resetBrandDetail")(IDS.ubd); } catch (e) {}
        ["resetTopCitations", "resetResponsesTable"].forEach(function (n, i) {
          try { setter(n)([IDS.tcd, IDS.urt][i]); } catch (e) {}
        });
        /* Der Kopf der vorigen Marke darf nicht stehen bleiben, waehrend Kalender und Filter sich
           einrichten: Skelett, bis die Gruppe zeichnet. */
        kopfZeichnen();
      }
      /* Erst wenn Kalender und Filter stehen (sie richten sich einen Takt nach dem Drawer ein),
         sonst ginge der erste Abruf ohne Zeitraum hinaus und der zweite gleich hinterher.
         Hoechstens 1,5s; fehlt date-range.js, nehmen die RPCs ihre Vorgabe. */
      var n = 0;
      (function warten() {
        if (!kalender() && n++ < 50) { setTimeout(warten, 30); return; }
        filterAbgleichen();
        alleLaden(false, true);
      })();
    },
    zu: function () {}
  });
  }

  ubdrBoot(50);
})();
