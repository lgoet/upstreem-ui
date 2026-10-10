/* upstreem prompts-page.js -- die Seite Prompt Insights als EINE Komponente (10.10.). Praefix upi.

   Kopf mit Krumen und drei Reitern (All Prompts, Responses, Topics), darunter Kalender und Filter,
   dann der Inhalt des Reiters. Die Inhalte sind die ECHTEN Bausteine der App im lokalen Modus
   (prompts-table.js, responses-table.js, topics-manager.js): ihr Markup kommt aus den
   Bubble-Vorlagen (.prompts_markup.py), ihre Ereignisse kommen als DOM-Ereignis hierher statt an
   Bubble, und diese Seite fuellt sie ueber ihre eigenen Setter. Dieselben Bausteine an anderen
   Orten (ohne data-local) arbeiten unveraendert weiter ueber Bubble.

   DATEN: direkt ueber UC.rpc (PostgREST, Nutzer-JWT). Anfragen und Antwortformen stehen in
   prompts-data.js (ohne DOM). Vertrag: Vorschlag des Datenbank-Chats vom 10.10. mit
   bubble/prompts_db_rueckmeldung.md. Responses wie im Dashboard (cached_dashboard_responses_v1).

   KNOEPFE IM KOPF je Reiter (10.10. angeordnet):
     All Prompts  "Add prompts" (Dialog add-prompts.js, hier mit eigener Speicherung) und Aktualisieren
     Responses    Aktualisieren
     Topics       "Add topic" (derselbe Dialog wie bisher der Knopf in der Leiste der Verwaltung)

   FILTER: der Kalender gilt app-weit (sein "Apply everywhere"), Models, Markets und Topics gelten
   fuer All Prompts und Responses gemeinsam. Auf Topics stehen sie nicht (die Verwaltung liest
   keinen Filter). Solange die Prompt-Tabelle nach Topics gruppiert, ist der Topic-Filter aus --
   wie bisher in Bubble (uptGroups: topicsfilter_visible).

   ADRESSE: ?pi=responses bzw. ?pi=topics (All Prompts ist die Vorgabe und steht nicht drin).
   Zeilen oeffnen die Drawer der App: prompt mit prompt_id, response mit prompt_run_id. */
(function () {
  "use strict";

  var API_NAMES = ["resetPromptsPage"];
  var Q = (window.__upiBootQueue = window.__upiBootQueue || []);
  API_NAMES.forEach(function (n) {
    if (!window[n]) window[n] = function () { Q.push([n, [].slice.call(arguments)]); };
  });

  function upiBoot(triesLeft) {
    if (!window.UpstreemCore || !window.UpstreemPromptsDaten || !window.UpstreemCitationsDaten || !window.UpstreemDashboardDaten) {
      if (triesLeft > 0) { setTimeout(function () { upiBoot(triesLeft - 1); }, 100); return; }
      if (window.console) console.error("[prompts-page] core.js, prompts-data.js, citations-data.js oder dashboard-data.js nicht geladen");
      return;
    }
    upiStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .prompts_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    upt: "<div class=\"up-root upt-root\" data-local=\"yes\" data-instance=\"__UPI_UPT__\" data-cdn-pin=\"\" data-isdark=\"__UPI_DARK__\" data-brand-name=\"__UPI_BRAND__\" data-brand-logo=\"__UPI_BRANDLOGO__\" data-sticky-top=\"16\" data-export-instance=\"\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Prompts</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span><span class=\"upt-selcount\"><span class=\"upt-selcount-n\">0 selected</span><button class=\"upt-selcount-clear\" type=\"button\" aria-label=\"Clear selection\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></span></div><div class=\"upt-status\" role=\"tablist\" aria-label=\"Prompt status\"></div><div class=\"up-head-tools\"><button class=\"upt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"upt-brand-toggle-lbl\"><img class=\"upt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"upt-brand-label\"></span></span><span class=\"upt-brand-check\"><svg class=\"upt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"upt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search prompts\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"upt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th up-th-prompt is-sortable\" data-sortcol=\"prompt\"><span class=\"upt-check\" role=\"checkbox\" tabindex=\"0\" aria-checked=\"false\" data-selectall></span><span class=\"up-th-txt\">Prompt</span><span class=\"up-thsort\" data-for=\"prompt\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span><span class=\"up-grip\" data-grip=\"prompt\"></span></div><div class=\"up-th up-th-visibility is-sortable\" data-sortcol=\"visibility\"><img class=\"upt-th-brandlogo\" src=\"\" alt=\"\"/><span class=\"up-th-txt\">Visibility</span><span class=\"up-th-info\" data-explain=\"visibility\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"visibility\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-th-info\" data-explain=\"rank\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-th-info\" data-explain=\"sentiment\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions<span class=\"up-th-info\" data-explain=\"brands\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-topics\">Topics</div><div class=\"up-th up-th-market\">Market<span class=\"up-th-info\" data-explain=\"market\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-created is-sortable\" data-sortcol=\"created\"><span class=\"up-th-txt\">Created</span><span class=\"up-thsort\" data-for=\"created\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>",
    urt: "<div class=\"up-root urt-root\" data-local=\"yes\" data-merken=\"yes\" data-instance=\"__UPI_URT__\" data-cdn-pin=\"\" data-isdark=\"__UPI_DARK__\" data-brand-name=\"__UPI_BRAND__\" data-brand-logo=\"__UPI_BRANDLOGO__\" data-spotlight-mode=\"no\" data-export-instance=\"\" data-sticky-top=\"16\" data-sticky=\"yes\" data-default-view=\"table\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Responses</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"urt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"urt-brand-toggle-lbl\"><img class=\"urt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"urt-brand-label\"></span></span><span class=\"urt-brand-check\"><svg class=\"urt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"urt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"urt-fader\"><button class=\"urt-fader-btn up-iconbtn\" type=\"button\" data-tip=\"Filter by rank &amp; sentiment\" aria-label=\"Filter by rank and sentiment\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg></button><div class=\"urt-fader-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search responses\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"urt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-dense urt-viewswitch\" role=\"group\" aria-label=\"View\"><button class=\"up-dense-btn up-dense-btn-icon is-active\" type=\"button\" data-view=\"table\" data-tip=\"Table view\" aria-label=\"Table view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18\"/></svg></button><button class=\"up-dense-btn up-dense-btn-icon\" type=\"button\" data-view=\"cards\" data-tip=\"Card view\" aria-label=\"Card view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 4V20\"/><path d=\"M18 4V20\"/><path d=\"M21 7L3 7\"/><path d=\"M21 17L3 17\"/></svg></button></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th up-th-prompt\">Prompt<span class=\"up-grip\" data-grip=\"prompt\"></span></div><div class=\"up-th up-th-mentioned\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">Mentioned</span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions</div><div class=\"up-th up-th-citations\">Citations</div><div class=\"up-th up-th-model\">Model</div><div class=\"up-th up-th-date is-sortable\" data-sortcol=\"date\"><span class=\"up-th-txt\">Date</span><span class=\"up-thsort\" data-for=\"date\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"urt-cards\"></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>",
    utm: "<div class=\"up-root utm-root\" data-local=\"yes\" data-sticky-top=\"16\" data-instance=\"__UPI_UTM__\" data-cdn-pin=\"\" data-isdark=\"__UPI_DARK__\" data-processing=\"no\" data-processing2=\"no\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Topics</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search topics...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search topics\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div></div></div><div class=\"utm-chipgrid\"></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function upiStart() {
  var UC = window.UpstreemCore, D = window.UpstreemPromptsDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  var STORE = (window.__upiStore = window.__upiStore || {});

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function liste(s) { return String(s || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function team() { try { return (UC.getTeam && UC.getTeam()) || ""; } catch (e) { return ""; } }
  function eigeneMarke() {
    var l = UC.getBrands ? UC.getBrands() : [];
    for (var i = 0; i < l.length; i++) if (l[i] && (String(l[i].role || "").toLowerCase() === "own" || l[i].is_own === true)) return l[i];
    return null;
  }
  function beiSicht(el, schluessel, fn, test, o) { if (UC.beiSicht) UC.beiSicht(el, schluessel, fn, test, o); else fn(); }
  function messbar(el) { return !UC.messbar || UC.messbar(el); }
  function setter(name) { return typeof window[name] === "function" ? window[name] : function () {}; }
  function toast(text, art, desc) { if (UC.toast) UC.toast(text, { kind: art || "success", desc: desc || "" }); }

  /* Die Reiter wie im bisherigen Seitenkopf (prompts-page-header.js). Die Zeichen setzt
     UC.makePageNav ueber den Wert (NAV_ZEICHEN: allprompts, responses, topics). Der Wert der
     Responses ist hier "responses" -- der alte Kopf sagte "mentions", das kannte nur Bubble. */
  var REITER = [
    { value: "allprompts", label: "All Prompts", icon: "" },
    { value: "responses", label: "Responses", icon: "" },
    { value: "topics", label: "Topics", icon: "" }
  ];
  var REFRESH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /> <path d="M21 3v5h-5" /> <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /> <path d="M8 16H3v5" /></svg>';
  var PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14" /> <path d="M12 5v14" /></svg>';

  /* ---- Fehler als Satz fuer den Nutzer --------------------------------------------------------
     Je stabiler message des Vertrags ein Satz, der sagt, was passiert ist und was man tun kann.
     Keine internen Namen (Regel der App). */
  function fehlerSatz(erg, wobei) {
    var m = D.meldung(erg), n = D.hinweisZahl(erg), h = D.hinweis(erg);
    if (/limit_reached/.test(m)) {
      if (/^topics_/.test(m)) return { text: t("Your team has reached the topic limit"), desc: t("Delete a topic you no longer need to add a new one.") };
      if (/^inactive:/.test(h)) return { text: t("Too many inactive prompts"), desc: t("Delete inactive prompts you no longer need, then try again.") };
      /* hint = freie Plaetze. Bei 0 (der haeufige Fall, echte Antwort) kein "0 more ... fit". */
      return { text: t("Not enough room in your plan"),
               desc: n ? t("{n} more active prompts fit into your plan.").replace("{n}", String(n)) : t("Deactivate prompts or upgrade your plan.") };
    }
    if (/selection_changed/.test(m)) return { text: t("The selection has changed"), desc: t("Please select the prompts again.") };
    if (/forbidden/.test(m)) return { text: t("Only owners and admins can delete"), desc: "" };
    if (/duplicate_name/.test(m)) return { text: t("A topic with this name already exists"), desc: "" };
    if (/rate_limited/.test(m) || (erg && erg.status === 429)) return { text: t("Too many requests"), desc: t("Please wait a moment and try again.") };
    if (/not_found/.test(m)) return { text: t("Some items no longer exist"), desc: t("Refresh the page and try again.") };
    return { text: wobei || t("That didn't work"), desc: t("Please try again.") };
  }
  function fehlerToast(erg, wobei) { var f = fehlerSatz(erg, wobei); toast(f.text, "error", f.desc); }

  function initRoot(root) {
    if (root.__upiCtrl) return root.__upiCtrl;
    var instanceId = str(root.getAttribute("data-instance")).trim() || "prompts_page";
    if (instanceId === "INSTANCE_ID") return null;
    var gem = STORE[instanceId] || {};
    var ohneAdresse = root.getAttribute("data-adresse") === "aus";

    var ids = {
      daten: instanceId + "_dates", filter: instanceId + "_filters", modelle: instanceId + "_models",
      maerkte: instanceId + "_markets", topics: instanceId + "_topics",
      upt: instanceId + "_prompts", urt: instanceId + "_responses", utm: instanceId + "_topicsmanager"
    };
    /* Der Stand der Responses-Tabelle: was ihr eigener Speicher (Neuaufbau) oder ihr Merker im
       localStorage schon weiss, gilt -- dieselbe Ueberlegung wie auf dem Dashboard. */
    function respVorgabe() {
      var ls = null;
      try { ls = JSON.parse(window.localStorage.getItem("urt_ansicht__" + ids.urt) || "null"); } catch (e) { ls = null; }
      ls = ls && typeof ls === "object" ? ls : {};
      var u = (window.__urtStore || {})[ids.urt] || {};
      var ansicht = u.view || ls.view || "table", karten = ansicht === "cards";
      var groesse = karten ? (u.cardPageSize || num(ls.cardPageSize) || 12) : (u.tablePageSize || num(ls.tablePageSize) || UC.DEFAULT_PAGE_SIZE || 15);
      var seite = karten ? (u.cardPage || 1) : (u.tablePage || 1);
      return { order: "run_at_desc", limit: groesse, offset: (seite - 1) * groesse, suche: str(u.query), requestId: null,
               erwaehnt: "all", firmen: null, sentMin: null, sentMax: null, rankMin: null, rankMax: null };
    }
    function promptsVorgabe() {
      var u = (window.__uptStore || {})[ids.upt] || {};
      return { status: u.status === "inactive" ? "inactive" : "active", suche: str(u.query),
               order: "visibility_desc", limit: num(u.pageSize) || UC.DEFAULT_PAGE_SIZE || 15, offset: 0,
               erwaehnt: "all", firmen: null, requestId: null };
    }
    var state = {
      tab: "allprompts",
      f: gem.f || { von: "", bis: "", modelle: null, maerkte: null, topics: null, tagmode: "or" },
      p: gem.p || promptsVorgabe(),
      grp: gem.grp || { an: false, modus: "both", eigene: [] },
      resp: gem.resp || respVorgabe(),
      seite: gem.seite || null,
      kalenderDa: false
    };
    state.tab = adresseLesen() || gem.tab || "allprompts";
    function persist() {
      STORE[instanceId] = { tab: state.tab, f: state.f, p: state.p, grp: state.grp, resp: state.resp, seite: state.seite };
    }

    var lader = D.makeLader({ rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 30000 }); } });
    /* Schreiben laeuft nicht durch den Lader (kein Speicher, kein Abbrechen durch eine neuere
       Anfrage). XX000 einmal wiederholen (Regel der Seiten-Vertraege) -- aber nur, was die DB als
       Serverfehler meldet; ein Grenzen- oder Rechtefehler bleibt, was er ist. */
    function schreiben(a) {
      function ruf() { return UC.rpc(a.fn, a.params, { timeoutMs: 30000 }); }
      return ruf().then(function (erg) {
        var c = erg && erg.fehler ? str(erg.fehler.code) : "";
        if (erg && !erg.ok && c === "XX000") return new Promise(function (w) { setTimeout(w, 800); }).then(ruf);
        return erg;
      });
    }

    /* ---- Aufbau ------------------------------------------------------------------------------- */
    function isDark() { return (UC.themeParam && UC.themeParam(root.getAttribute("data-isdark"))) || root.getAttribute("data-theme") === "dark"; }
    function einsetzen(m) {
      var marke = eigeneMarke();
      return String(m || "").split("__UPI_UPT__").join(esc(ids.upt))
        .split("__UPI_URT__").join(esc(ids.urt)).split("__UPI_UTM__").join(esc(ids.utm))
        .split("__UPI_DARK__").join(isDark() ? "yes" : "no")
        .split("__UPI_BRANDLOGO__").join(esc(marke ? str(marke.logo_url) : ""))
        .split("__UPI_BRAND__").join(esc(marke ? str(marke.name) : ""));
    }
    var dk = isDark() ? "yes" : "no";
    root.classList.add("up-sidebar-clear");
    root.innerHTML =
      '<div class="up-ph-top upi-pagehead">' +
        '<div class="up-ph-left"><h1 class="up-ph-heading">' + esc(t("Prompt Insights")) + '</h1>' +
          '<p class="up-ph-desc">' + esc(t("Manage Prompts, Topics and monitor latest Responses")) + '</p></div>' +
        '<div class="upi-tools">' +
          /* Derselbe Knopf wie im bisherigen Kopf: kurz "Add", breit "Add Prompts". */
          '<button class="up-ph-addbtn up-export upi-add" type="button" data-upi-fuer="allprompts" aria-label="' + esc(t("Add Prompts")) + '">' + PLUS_SVG +
            '<span>' + esc(t("Add")) + ' <span class="up-ph-addbtn-full">' + esc(t("Prompts")) + '</span></span></button>' +
          '<button class="up-ph-addbtn up-export upi-addtopic" type="button" data-upi-fuer="topics" aria-label="' + esc(t("Add Topic")) + '">' + PLUS_SVG +
            '<span>' + esc(t("Add")) + ' <span class="up-ph-addbtn-full">' + esc(t("Topic")) + '</span></span></button>' +
          '<button class="up-ph-iconbtn upi-refresh" type="button" data-upi-fuer="allprompts responses" aria-label="' + esc(t("Refresh")) + '" data-tip="' + esc(t("Refresh Data")) + '">' + REFRESH_SVG + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="up-ph-nav upi-nav" role="tablist"></div>' +
      '<div class="upi-filterzeile">' +
        '<div class="up-root udr-root upi-daten" data-instance="' + esc(ids.daten) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root ufb-root upi-filterleiste" data-instance="' + esc(ids.filter) + '" data-topics-instance="' + esc(ids.topics) + '"' +
          ' data-models-instance="' + esc(ids.modelle) + '" data-markets-instance="' + esc(ids.maerkte) + '"' +
          ' data-topics-visible="' + (state.grp.an ? "no" : "yes") + '" data-isdark="' + dk + '"></div>' +
        '<div class="up-root utf-root" data-instance="' + esc(ids.topics) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root umf-root" data-instance="' + esc(ids.modelle) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
        '<div class="up-root umk-root" data-instance="' + esc(ids.maerkte) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
      '</div>' +
      '<div class="upi-main">' +
        '<div class="upi-tab" data-upi-tab="allprompts">' + einsetzen(MARKUP.upt) + '</div>' +
        '<div class="upi-tab" data-upi-tab="responses">' + einsetzen(MARKUP.urt) + '</div>' +
        '<div class="upi-tab" data-upi-tab="topics">' + einsetzen(MARKUP.utm) + '</div>' +
      '</div>';

    var elNav = root.querySelector(".upi-nav"), elRefresh = root.querySelector(".upi-refresh");
    var elAdd = root.querySelector(".upi-add"), elAddTopic = root.querySelector(".upi-addtopic");
    var elFilterleiste = root.querySelector(".upi-filterleiste");
    function el(sel) { return root.querySelector(sel); }
    var nav = UC.makePageNav ? UC.makePageNav(root, {
      nav: elNav, storeKey: instanceId + "|upi-nav", selected: state.tab,
      pages: REITER, onSelect: function (v) { reiterOeffnen(v, true); }
    }) : null;
    var krumen = UC.makePageCrumbs ? UC.makePageCrumbs(root, { icon: "zap", name: "Prompt Insights", quelle: elNav, komponente: true }) : null;
    if (UC.makeTooltips) UC.makeTooltips(root, isDark);
    if (isDark()) root.setAttribute("data-theme", "dark"); else root.removeAttribute("data-theme");

    /* ---- Reiter und Adresse ------------------------------------------------------------------- */
    function adresseLesen() {
      if (ohneAdresse) return null;
      try { var c = new URL(window.location.href).searchParams.get("pi"); return c === "responses" || c === "topics" ? c : null; }
      catch (e) { return null; }
    }
    function adresseSetzen(neuerEintrag) {
      if (ohneAdresse) return;
      try {
        var u = new URL(window.location.href);
        if (state.tab === "allprompts") u.searchParams.delete("pi"); else u.searchParams.set("pi", state.tab);
        var neu = u.pathname + u.search + u.hash;
        if (neu === window.location.pathname + window.location.search + window.location.hash) return;
        if (neuerEintrag) window.history.pushState(window.history.state, "", neu);
        else window.history.replaceState(window.history.state, "", neu);
      } catch (e) {}
    }
    function reiterZeigen() {
      root.querySelectorAll(".upi-tab").forEach(function (x) { x.hidden = x.getAttribute("data-upi-tab") !== state.tab; });
      /* Die Knoepfe des Kopfs je Reiter (hidden, nicht nur CSS: ein versteckter Knopf soll auch
         nicht per Tastatur erreichbar sein). */
      root.querySelectorAll("[data-upi-fuer]").forEach(function (b) {
        b.hidden = (" " + b.getAttribute("data-upi-fuer") + " ").indexOf(" " + state.tab + " ") < 0;
      });
      root.setAttribute("data-upi-reiter", state.tab);
      if (krumen && krumen.zeichnen) krumen.zeichnen();
    }
    function reiterOeffnen(v, neuerEintrag) {
      v = v === "responses" || v === "topics" ? v : "allprompts";
      if (v === state.tab) return;
      state.tab = v;
      if (nav && nav.selectPage) { try { nav.selectPage(v, false); } catch (e) {} }
      persist(); adresseSetzen(neuerEintrag); reiterZeigen();
      bedarf();
    }
    window.addEventListener("popstate", function () {
      if (root.isConnected === false) return;
      var a = adresseLesen() || "allprompts";
      if (a !== state.tab) reiterOeffnen(a, false);
    });

    /* ---- Filter (wie citations-page.js) --------------------------------------------------------- */
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
    /* exclude heisst "alle ausser" (wie Shopping und Citations). */
    function auswahl(feld, d, schluessel) {
      var gew = liste(d && d[schluessel]);
      if (!gew.length) return null;
      if (d.select_mode !== "exclude") return gew;
      var alle = feld === "modelle"
        ? (UC.getModels ? UC.getModels() : []).map(function (m) { return str(m.key || m.model); })
        : (UC.getAllMarkets ? toArr(UC.getAllMarkets()) : []).map(function (m) { return str(m.alpha2 || m.alpha3 || m.code || m.market).toUpperCase(); });
      return alle.filter(function (k) { return k && gew.indexOf(k) < 0; });
    }
    /* Neue Filter sind ein neuer Ergebnissatz: zurueck auf die erste Seite, Auswahl weg (wie in
       Bubble: RESET_SELECTED). Gebuendelt (120ms, wie das Dashboard): "Clear all" der
       Filterleiste feuert je Filter ein eigenes Ereignis, das waeren sonst drei Ladungen. */
    var filterUhr = null;
    function filterGeaendert() {
      state.p.offset = 0; state.resp.offset = 0;
      persist();
      clearTimeout(filterUhr);
      filterUhr = setTimeout(function () {
        filterUhr = null;
        try { if (window.resetPromptsTable) window.resetPromptsTable(ids.upt); } catch (e) {}
        bedarf();
      }, 120);
    }
    root.addEventListener("umf-models", function (e) { if (setzen("modelle", auswahl("modelle", e.detail, "model_keys"))) filterGeaendert(); });
    root.addEventListener("umk-markets", function (e) { if (setzen("maerkte", auswahl("maerkte", e.detail, "market_codes"))) filterGeaendert(); });
    root.addEventListener("utf-topics", function (e) {
      var d = e.detail || {}, l = liste(d.topic_ids);
      var a = setzen("topics", l.length ? l : null), b = setzen("tagmode", d.tag_mode === "and" ? "and" : "or");
      if (a || (b && l.length)) filterGeaendert();
    });
    function kalender() { var k = el(".upi-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
    function zeitraum(von, bis) {
      var a = setzen("von", von), b = setzen("bis", bis);
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
      if (!e.target || !e.target.classList || !e.target.classList.contains("upi-daten")) return;
      var d = e.detail || {};
      if (!d.date_from || !d.date_to) return;
      if (zeitraum(d.date_from, d.date_to)) filterGeaendert();
    });
    function filterAbgleichen() {
      var g = kalenderLesen();
      var m = el(".umf-root"), k = el(".umk-root"), tp = el(".utf-root");
      try { if (m && m.__umfCtrl) g = setzen("modelle", auswahl("modelle", m.__umfCtrl.getSelected(), "model_keys")) || g; } catch (e) {}
      try { if (k && k.__umkCtrl) g = setzen("maerkte", auswahl("maerkte", k.__umkCtrl.getSelected(), "market_codes")) || g; } catch (e) {}
      try {
        if (tp && tp.__utfCtrl && !state.grp.an) {
          var s = tp.__utfCtrl.getSelected(), l = liste(s.topic_ids);
          g = setzen("topics", l.length ? l : null) || g;
          g = setzen("tagmode", s.tag_mode === "and" ? "and" : "or") || g;
        }
      } catch (e) {}
      return g;
    }
    /* Gruppiert = Topic-Filter aus (wie in Bubble). Die Filterleiste leert ihn dabei ueber sein
       eigenes X, sein Ereignis kommt hier als utf-topics an. Bis dahin gilt er hier schon nicht
       mehr: eine Gruppe bringt ihre eigenen Topics mit, und p_untagged darf nicht mit p_tag_ids. */
    function topicFilterSichtbar(an) {
      if (elFilterleiste) elFilterleiste.setAttribute("data-topics-visible", an ? "yes" : "no");
      if (!an) { setzen("topics", null); setzen("tagmode", "or"); }
    }

    /* ---- Laden ---------------------------------------------------------------------------------- */
    function sichtbarTest(x) { return x.isConnected !== false && (!UC.istSichtbar || UC.istSichtbar(x)); }
    var warteUhr = null, kalenderVersuche = 0, seiteDa = false;
    function spaeter(ms) { if (!warteUhr) warteUhr = setTimeout(function () { warteUhr = null; bedarf(); }, ms); }
    function filterStand() { var f = {}, k; for (k in state.f) f[k] = state.f[k]; f.team = team(); return f; }
    function bereit() {
      if (!sichtbarTest(root)) { beiSicht(root, "laden", function () { bedarf(); }, sichtbarTest); return false; }
      if (!team()) return false;
      if (state.tab !== "topics" && !state.kalenderDa && !kalenderLesen()) {
        if (kalenderVersuche++ < 20) { spaeter(150); return false; }
      }
      return true;
    }
    /* Gemeinsam laden, gemeinsam zeigen (wie citations-page.js): alle Auftraege gehen gleichzeitig
       hinaus, gezeichnet wird erst, wenn alle da sind, und je Kanal nur aus der juengsten Gruppe. */
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
      if (!bereit()) return null;
      o = o || {};
      var a = [];
      if (state.tab === "allprompts") {
        a.push(listeAuftrag());
        if (state.grp.an) a.push(gruppenAuftrag());
        /* Die Meta einmal je Aufbau, nicht je Sitzung: nach einem Neuaufbau (Themenwechsel) stehen
           Verwaltung und Topic-Editor frisch da und brauchen ihre Topics wieder. */
        if (!seiteDa || o.frisch || o.seite) a.push(seitenAuftrag());
      } else if (state.tab === "responses") {
        a.push(respAuftrag());
      } else {
        a.push(seitenAuftrag());
      }
      return gemeinsam(a, o);
    }

    /* Die Seiten-Meta: Kontingent, Topics, Rolle, alle Maerkte. Sie fuellt die Topic-Verwaltung, den
       Topic-Editor der Tabelle und die Ablagen von core (Kontingent fuer die Kennzahlkarte, alle
       Maerkte fuer den Anlage-Dialog). */
    function seitenAuftrag() {
      var a = D.seite(team());
      return {
        kanal: "seite", imSpeicher: false,
        ladenAn: function () { if (state.tab === "topics" && !state.seite) { try { setter("setTopicsManagerLoading")(ids.utm, "yes"); } catch (e) {} } },
        laden: function (frisch) {
          return lader.laden("seite", a, { frisch: true }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () { seiteAnwenden(erg.ok ? D.zuSeite(erg.daten) : null); };
          });
        }
      };
    }
    function seiteAnwenden(z) {
      if (!z) {
        /* Ohne Meta keine Topics: die Verwaltung zeigt ihren Lesefehler statt eines leeren Rasters
           (leer und kaputt sehen verschieden aus). */
        if (!state.seite) { try { setter("renderTopicsManager")({ instanceId: ids.utm, __parseError: true }); } catch (e) {} }
        try { setter("setTopicsManagerLoading")(ids.utm, "no"); } catch (e) {}
        return;
      }
      state.seite = z; seiteDa = true; persist();
      try { setter("renderTopicsManager")({ instanceId: ids.utm, topics: z.topics, isDark: isDark() }); } catch (e) {}
      try { setter("setTopicsManagerLoading")(ids.utm, "no"); } catch (e) {}
      try { setter("setPromptsTableTopics")(ids.upt, z.topics); } catch (e) {}
      if (z.kontingent && UC.setQuota) {
        var q = (UC.getQuota && UC.getQuota()) || {};
        if (q.used !== z.kontingent.used || q.total !== z.kontingent.total) {
          q.used = z.kontingent.used; q.total = z.kontingent.total;
          if (z.kontingent.plan) q.plan = z.kontingent.plan;
          UC.setQuota(q, "prompts-page");
        }
      }
      if (z.maerkteAlle.length && window.setUpstreemAllMarkets) {
        try { window.setUpstreemAllMarkets(z.maerkteAlle); } catch (e) {}
      }
      var nein = z.darfLoeschen ? null : "nein";
      [el(".upt-root"), el(".utm-root")].forEach(function (x) {
        if (!x) return;
        if (nein) x.setAttribute("data-loeschen", nein); else x.removeAttribute("data-loeschen");
      });
    }
    function kontingentNachziehen(k) {
      if (!k || !UC.setQuota) return;
      var q = (UC.getQuota && UC.getQuota()) || {};
      q.used = k.used; q.total = k.total;
      UC.setQuota(q, "prompts-page");
    }

    function listeAuftrag() {
      var a = D.liste(filterStand(), state.p), reqId = state.p.requestId, status = state.p.status;
      return {
        kanal: "liste", imSpeicher: lader.ausSpeicher(a) !== undefined,
        ladenAn: function () { try { setter("setPromptsTableLoading")(ids.upt, "yes"); } catch (e) {} },
        laden: function (frisch) {
          return lader.laden("liste", a, { frisch: !!frisch }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () {
              var z = erg.ok ? D.zuListe(erg.daten, status) : null;
              if (!z) {
                try { setter("renderPromptsTable")({ instanceId: ids.upt, __parseError: true }); } catch (e) {}
              } else {
                var p = { instanceId: ids.upt, rows: z.rows, isDark: isDark(), view_active: "yes" };
                if (z.totalCount != null) p.totalCount = z.totalCount;
                if (z.totalCountInactive != null) p.totalCountInactive = z.totalCountInactive;
                if (z.without_topic != null) p.without_topic = z.without_topic;
                if (reqId != null) p.requestId = reqId;
                try { setter("renderPromptsTable")(p); } catch (e) {}
              }
              try { setter("setPromptsTableLoading")(ids.upt, "no"); } catch (e) {}
            };
          });
        }
      };
    }
    function gruppenAuftrag() {
      var s = { status: "active", suche: state.p.suche, erwaehnt: state.p.erwaehnt, firmen: state.p.firmen };
      var a = D.gruppen(filterStand(), s, state.grp.modus, state.grp.eigene);
      return {
        kanal: "gruppen", imSpeicher: lader.ausSpeicher(a) !== undefined,
        ladenAn: function () {},
        laden: function (frisch) {
          return lader.laden("gruppen", a, { frisch: !!frisch }).then(function (erg) {
            if (erg.ueberholt) return null;
            return function () {
              var g = erg.ok ? D.zuGruppen(erg.daten) : null;
              if (!g) { fehlerToast(erg, t("The groups could not be loaded")); g = []; }
              eigeneAufraeumen(erg.ok ? D.abgelegteTopics(erg.daten) : []);
              try { setter("setPromptsTableGroups")(ids.upt, g); } catch (e) {}
            };
          });
        }
      };
    }
    /* meta.dropped_tag_ids: Topics, die es nicht mehr gibt, aus den eigenen Gruppierungen im
       Browser streichen (sonst zaehlt eine Gruppe still 0 Prompts). Eine Gruppierung ohne gueltiges
       Topic faellt weg -- die Datenbank hat sie ebenso verworfen. */
    function eigeneAufraeumen(weg) {
      if (!weg.length || !UC.cgRead || !UC.cgWrite) return;
      var l = UC.cgRead(), geaendert = false;
      l = l.map(function (g) {
        var neu = g.tag_ids.filter(function (x) { return weg.indexOf(String(x)) < 0; });
        if (neu.length !== g.tag_ids.length) { geaendert = true; g.tag_ids = neu; }
        return g;
      }).filter(function (g) { return g.tag_ids.length; });
      if (geaendert) UC.cgWrite(l);
    }
    function respAuftrag() {
      var teile = D.responses(filterStand(), state.resp), reqId = state.resp.requestId;
      function imSp() { return teile.every(function (a) { return lader.ausSpeicher(a) !== undefined; }); }
      return {
        kanal: "resp", imSpeicher: imSp(),
        ladenAn: function () { try { setter("setResponsesTableLoading")(ids.urt, "yes"); } catch (e) {} },
        laden: function (frisch) {
          return Promise.all(teile.map(function (a, i) { return lader.laden("resp_" + i, a, { frisch: !!frisch }); })).then(function (e) {
            if (e.some(function (x) { return x.ueberholt; })) return null;
            return function () {
              var ok = e.every(function (x) { return x.ok; });
              var p = ok ? D.zuResponses(e.map(function (x) { return x.daten; })) : null;
              if (!p) {
                try { setter("renderResponsesTable")({ instanceId: ids.urt, __parseError: true }); } catch (err) {}
              } else {
                var mk = eigeneMarke();
                p.instanceId = ids.urt; p.isDark = isDark();
                if (reqId != null) p.requestId = reqId;
                if (mk) { p.brand_name = str(mk.name); p.brand_logo = str(mk.logo_url); }
                try { setter("renderResponsesTable")(p); } catch (err) {}
              }
              try { setter("setResponsesTableLoading")(ids.urt, "no"); } catch (err) {}
            };
          });
        }
      };
    }
    /* Einzelteile (eigene Bedienung eines Bausteins), je Teil gebuendelt (80ms, wie das Dashboard). */
    var teilUhren = {};
    function teilLaden(teil) {
      clearTimeout(teilUhren[teil]);
      teilUhren[teil] = setTimeout(function () {
        teilUhren[teil] = null;
        if (!bereit()) return;
        if (teil === "liste" && state.tab === "allprompts") {
          var a = [listeAuftrag()];
          if (state.grp.an) a.push(gruppenAuftrag());
          gemeinsam(a);
        } else if (teil === "gruppen" && state.tab === "allprompts") gemeinsam([gruppenAuftrag()]);
        else if (teil === "resp" && state.tab === "responses") gemeinsam([respAuftrag()]);
      }, 80);
    }
    /* Nach einer Aenderung: alles, was sich geaendert haben kann, frisch (Speicher weg). */
    function nachAenderung() {
      lader.leeren();
      if (bereit()) bedarf({ frisch: true, seite: true });
    }

    /* ---- Ereignisse der Prompt-Tabelle ---------------------------------------------------------
       Lokal: "upt-<Name>" (makeFire, Praefix plus Name). Die Tabelle schickt nur, was sich
       geaendert hat -- den Rest haelt diese Seite (state.p), wie bisher die Custom States in Bubble. */
    function an(name, fn) { root.addEventListener(name, function (e) { fn(e.detail || {}); }); }
    an("upt-uptSearch", function (d) {
      state.p.suche = str(d.query); state.p.offset = 0;
      state.p.requestId = d.requestId != null ? d.requestId : null;
      persist(); teilLaden("liste");
    });
    an("upt-uptSort", function (d) {
      if (D.ORDER.indexOf(str(d.order)) >= 0) state.p.order = str(d.order);
      state.p.offset = 0; state.p.requestId = null; persist(); teilLaden("liste");
    });
    an("upt-uptPage", function (d) {
      var l = num(d.limit), o = num(d.offset);
      if (l != null) state.p.limit = Math.max(1, Math.min(D.GRENZE.limit, Math.round(l)));
      if (o != null) state.p.offset = Math.max(0, Math.round(o));
      state.p.requestId = null; persist(); teilLaden("liste");
    });
    an("upt-uptStatus", function (d) {
      state.p.status = str(d.status) === "inactive" ? "inactive" : "active";
      state.p.offset = 0; state.p.requestId = null; persist(); teilLaden("liste");
    });
    an("upt-uptBrand", function (d) {
      var v = str(d.brand_mentioned);
      state.p.erwaehnt = v === "yes" || v === "no" ? v : "all";
      state.p.offset = 0; state.p.requestId = null; persist(); teilLaden("liste");
    });
    an("upt-uptMentioned", function (d) {
      var l = liste(d.brands);
      state.p.firmen = l.length ? l : null;
      state.p.offset = 0; state.p.requestId = null; persist(); teilLaden("liste");
    });
    an("upt-uptRowClick", function (d) {
      var id = str(d.prompt_id).trim();
      if (id && UC.drawerOeffnen) UC.drawerOeffnen("prompt", id, "prompts");
    });
    an("upt-uptGroups", function (d) {
      var an_ = str(d.grouped) !== "no";
      var eigene = [];
      if (an_ && d.groups) {
        try { eigene = typeof d.groups === "string" ? JSON.parse(d.groups) : d.groups; } catch (e) { eigene = []; }
        if (!isArr(eigene)) eigene = [];
      }
      var vorher = state.grp.an;
      state.grp = { an: an_, modus: str(d.mode) === "custom" || str(d.mode) === "topics" ? str(d.mode) : "both", eigene: eigene };
      persist();
      if (vorher !== an_) {
        topicFilterSichtbar(!an_);
        filterGeaendert();
        return;
      }
      if (an_) teilLaden("gruppen");
    });
    an("upt-uptGroupOpen", function (d) {
      if (!bereit()) return;
      var gruppe = {
        tagIds: liste(d.tag_ids), tagmode: str(d.tagmode) === "or" ? "or" : "and",
        ohneTopic: str(d.untagged) === "yes"
      };
      var s = { status: "active", suche: state.p.suche, erwaehnt: state.p.erwaehnt, firmen: state.p.firmen,
                order: str(d.order) || state.p.order, limit: num(d.limit) || 10, offset: num(d.offset) || 0 };
      var a = D.liste(filterStand(), s, gruppe), rid = d.request_id;
      lader.laden("gruppe_offen", a).then(function (erg) {
        if (erg.ueberholt) return;
        var z = erg.ok ? D.zuGruppenZeilen(erg.daten) : null;
        if (!z) { fehlerToast(erg, t("The prompts of this group could not be loaded")); z = []; }
        try { setter("setPromptsTableGroupPrompts")(ids.upt, z, rid); } catch (e) {}
      });
    });

    /* Die Auswahl der Tabelle als Ziel einer Sammelaktion (Vertrag: ids ODER Filter + Ausnahmen +
       erwartete Zahl). Im Filtermodus gelten GENAU die Filter der Liste -- der Nutzer hat die Zahl
       vor dem Klick gelesen, und genau diese Menge soll es sein. */
    function ziel(d) {
      var mode = str(d.mode);
      if (mode === "ids") return { ids: liste(d.ids || d.prompt_ids) };
      var s = { status: state.p.status, suche: state.p.suche, erwaehnt: state.p.erwaehnt, firmen: state.p.firmen };
      var z = { filter: true, f: filterStand(), s: s, ausgeschlossen: liste(d.excluded_ids), erwartet: num(d.count) || 0 };
      if (mode === "filter_group") {
        s.status = "active";
        z.gruppe = { tagIds: liste(d.tag_ids), tagmode: "and", ohneTopic: str(d.untagged) === "yes" };
      }
      return z;
    }
    var schreibtGerade = false;
    function sammel(aktion, d, tagIds, satz) {
      if (schreibtGerade || !team()) return;
      var z = ziel(d);
      if (!z.filter && !z.ids.length) return;
      schreibtGerade = true;
      schreiben(D.sammel(team(), aktion, z, tagIds)).then(function (erg) {
        schreibtGerade = false;
        var r = erg.ok ? D.zuSammel(erg.daten) : null;
        if (!erg.ok || !r) { fehlerToast(erg); nachAenderung(); return; }
        kontingentNachziehen(r.kontingent);
        var n = r.geaendert != null ? r.geaendert : (r.ziel || 0);
        var uv = r.unveraendert || 0;
        toast(satz(n), "success", uv ? t("{n} unchanged").replace("{n}", String(uv)) : "");
        if (aktion === "add_topics" || aktion === "delete") { try { if (UC.topicsChanged) UC.topicsChanged(); } catch (e) {} }
        nachAenderung();
      }, function () { schreibtGerade = false; fehlerToast(null); nachAenderung(); });
    }
    function anzahlSatz(einzahl, mehrzahl) {
      return function (n) { return (n === 1 ? t(einzahl) : t(mehrzahl)).replace("{n}", String(n)); };
    }
    an("upt-uptApplyBulkTopics", function (d) {
      sammel("add_topics", d, liste(d.tag_ids), anzahlSatz("Topics added to {n} prompt", "Topics added to {n} prompts"));
    });
    an("upt-uptBulkStatus", function (d) {
      var aktiv = str(d.status) === "active";
      sammel(aktiv ? "set_active" : "set_inactive", d, null,
        aktiv ? anzahlSatz("{n} prompt set to active", "{n} prompts set to active") : anzahlSatz("{n} prompt set to inactive", "{n} prompts set to inactive"));
    });
    an("upt-uptBulkDelete", function (d) {
      sammel("delete", d, null, anzahlSatz("{n} prompt deleted", "{n} prompts deleted"));
    });
    an("upt-uptEditTopics", function (d) {
      var id = str(d.prompt_id).trim();
      if (!id || !team()) return;
      var tags = isArr(d.tag_ids) ? d.tag_ids.map(str) : liste(d.tag_ids);
      schreiben(D.topicsSetzen(team(), id, tags)).then(function (erg) {
        if (!erg.ok) fehlerToast(erg, t("The topics could not be saved"));
        else { try { if (UC.topicsChanged) UC.topicsChanged(); } catch (e) {} }
        /* Auch nach einem Fehler neu laden: die Tabelle hat die Topics schon vorab gezeigt. */
        nachAenderung();
      }, function () { fehlerToast(null, t("The topics could not be saved")); nachAenderung(); });
    });
    /* Neues Topic aus dem Sammelpanel: nur anlegen (wie bisher in Bubble). Die Tabelle waehlt es
       im Panel vor, sobald die neue Topic-Liste ankommt (gleicher Name). Gibt es den Namen schon,
       ist das hier kein Fehler: dann kommt eben das bestehende Topic. */
    an("upt-uptAddTopics", function (d) {
      if (!team()) return;
      var p = { name: d.new_topic_name, emoji: d.new_topic_emoji, hex_light: d.new_topic_hex_light, hex_dark: d.new_topic_hex_dark };
      schreiben(D.topicSpeichern(team(), p)).then(function (erg) {
        if (!erg.ok && !/duplicate_name/.test(D.meldung(erg))) { fehlerToast(erg, t("The topic could not be created")); return; }
        try { if (UC.topicsChanged) UC.topicsChanged(); } catch (e) {}
        gemeinsam([seitenAuftrag()]);
      }, function () { fehlerToast(null, t("The topic could not be created")); });
    });

    /* ---- Ereignisse der Topic-Verwaltung -------------------------------------------------------
       Ihre Rueckfallnamen tragen das bubble_fn_ schon in sich (topics-manager.js), also heissen
       die lokalen Ereignisse "utm-bubble_fn_utm<Name>". Gelingt das Speichern, schliesst die neue
       Liste den Dialog (renderTopicsManager); scheitert es, bleibt er offen und sagt warum. */
    function utmCtrl() { var x = el(".utm-root"); return x && x.__utmController ? x.__utmController : null; }
    function topicGespeichert(edit) {
      try { if (UC.topicsChanged) UC.topicsChanged(); } catch (e) {}
      lader.leeren();
      var a = [seitenAuftrag()];
      /* Ein umbenanntes Topic steht auch in den Zeilen der Prompt-Tabelle. */
      if (edit && state.tab === "allprompts") a.push(listeAuftrag());
      gemeinsam(a, { frisch: true });
    }
    function topicSpeichern(d, edit) {
      if (!team()) return;
      schreiben(D.topicSpeichern(team(), d)).then(function (erg) {
        if (!erg.ok) {
          var f = fehlerSatz(erg, t("The topic could not be saved."));
          var c = utmCtrl();
          if (c && c.saveFailed) c.saveFailed(f.text); else toast(f.text, "error", f.desc);
          return;
        }
        toast(edit ? t("Topic saved") : t("Topic created"), "success");
        topicGespeichert(edit);
      }, function () { var c = utmCtrl(); if (c && c.saveFailed) c.saveFailed(t("The topic could not be saved.")); });
    }
    an("utm-bubble_fn_utmAdd", function (d) { topicSpeichern(d, false); });
    an("utm-bubble_fn_utmEdit", function (d) { topicSpeichern(d, true); });
    an("utm-bubble_fn_utmDelete", function (d) {
      var id = str(d.id).trim();
      if (!id || !team()) return;
      schreiben(D.topicLoeschen(team(), id)).then(function (erg) {
        if (!erg.ok) { fehlerToast(erg, t("The topic could not be deleted")); return; }
        toast(t("Topic deleted"), "success");
        try { if (UC.topicsChanged) UC.topicsChanged(); } catch (e) {}
        nachAenderung();
      }, function () { fehlerToast(null, t("The topic could not be deleted")); });
    });

    /* ---- Ereignisse der Response-Tabelle (wie dashboard-page.js) -------------------------------- */
    function respNeu(fn) { return function (d) { fn(d); state.resp.requestId = null; persist(); teilLaden("resp"); }; }
    an("urt-urtSearch", function (d) {
      state.resp.suche = str(d.query); state.resp.offset = 0;
      state.resp.requestId = d.requestId != null ? d.requestId : null;
      persist(); teilLaden("resp");
    });
    an("urt-urtSort", respNeu(function (d) {
      var o = str(d.order);
      if (["run_at_desc", "run_at_asc", "rank_asc", "rank_desc", "sentiment_asc", "sentiment_desc"].indexOf(o) >= 0) state.resp.order = o;
      state.resp.offset = 0;
    }));
    an("urt-urtPage", respNeu(function (d) {
      var l = num(d.limit), o = num(d.offset);
      if (l != null) state.resp.limit = Math.max(1, Math.min(100, Math.round(l)));
      if (o != null) state.resp.offset = Math.max(0, Math.round(o));
    }));
    an("urt-urtFilter", respNeu(function (d) {
      var ra = d.rank_active === true || d.rank_active === "true", sa = d.sent_active === true || d.sent_active === "true";
      state.resp.rankMin = ra ? num(d.rank_min) : null;
      /* 20 heisst "20+": offenes Ende, kein p_rank_max (Vertrag Dashboard v1). */
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
    an("urt-urtRowClick", function (d) { var id = str(d.prompt_run_id).trim(); if (id && UC.drawerOeffnen) UC.drawerOeffnen("response", id, "prompts"); });

    /* ---- Export (wie citations-page.js) --------------------------------------------------------
       Die Tabellen oeffnen das Export-Fenster der App ueber data-export-instance; die Seite setzt es
       VOR dem Klick (Fangphase), samt Typ des Reiters. */
    function exportKennung() {
      var k = str(root.getAttribute("data-export-instance")).trim();
      if (k && !/^[A-Z_]{3,}$/.test(k)) return k;
      var e = document.querySelector(".uex-root[data-instance]");
      k = e ? str(e.getAttribute("data-instance")).trim() : "";
      return k && !/^[A-Z_]{3,}$/.test(k) ? k : "";
    }
    root.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".up-export") : null;
      var tab = b && b.closest(".upt-root, .urt-root");
      if (!tab || !root.contains(tab)) return;
      var k = exportKennung();
      if (!k || typeof window.upstreemExportOpen !== "function") {
        e.stopPropagation();
        toast(t("Export isn't available on this page"), "neutral");
        return;
      }
      tab.setAttribute("data-export-instance", k);
      try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, { export_type: tab.classList.contains("urt-root") ? "prompt_runs" : "prompts" }); } catch (err) {}
    }, true);

    /* ---- Knoepfe im Kopf -------------------------------------------------------------------- */
    /* "Add Prompts": der Dialog der App, aber gespeichert wird HIER (onSubmit), nicht ueber den
       Bubble-Workflow -- sonst legte der alte Workflow dieselben Prompts ein zweites Mal an. Ein
       Fehler laesst den Dialog offen, mit allen Zeilen. */
    function anlegen(payload) {
      if (!team()) return Promise.resolve({ ok: false });
      return schreiben(D.anlegen(team(), payload)).then(function (erg) {
        var r = erg.ok ? D.zuAnlage(erg.daten) : null;
        if (!erg.ok || !r) { fehlerToast(erg, t("The prompts could not be added")); return { ok: false }; }
        kontingentNachziehen(r.kontingent);
        /* Was nicht angelegt wurde und was die Datenbank umgeschrieben hat (Backtick, Backslash, ${,
           Umbrueche, unsichtbare Zeichen) -- beides gehoert gesagt, nicht still geschluckt. */
        var weg = [
          r.uebersprungen ? t("{n} skipped (already there or invalid)").replace("{n}", String(r.uebersprungen)) : "",
          r.umgeschrieben ? (r.umgeschrieben === 1 ? t("1 adjusted (special characters removed)") : t("{n} adjusted (special characters removed)").replace("{n}", String(r.umgeschrieben))) : ""
        ].filter(Boolean).join(", ");
        if (!r.angelegt) {
          toast(t("No new prompts added"), "neutral", weg);
          return { ok: false };
        }
        toast((r.angelegt === 1 ? t("{n} prompt added") : t("{n} prompts added")).replace("{n}", String(r.angelegt)), "success", weg);
        try { if (UC.marketsChanged) UC.marketsChanged(); } catch (e) {}
        try { if (UC.topicsChanged) UC.topicsChanged(); } catch (e) {}
        nachAenderung();
        return { ok: true };
      }, function () { fehlerToast(null, t("The prompts could not be added")); return { ok: false }; });
    }
    if (elAdd) elAdd.addEventListener("click", function () {
      if (typeof window.openAddPrompts === "function") window.openAddPrompts({ onSubmit: anlegen });
    });
    if (elAddTopic) elAddTopic.addEventListener("click", function () {
      var c = utmCtrl();
      if (c && c.openAdd) c.openAdd();
    });
    /* AKTUALISIEREN = DEN DB-CACHE LEEREN, DANN FRISCH LADEN (Regel jedes Refresh-Knopfs). All
       Prompts: prompts_refresh_v1. Responses: clear_dashboard_cache_v1 (Vertrag: reicht, eine
       eigene Fassung lohnt nicht). Einmal zur Zeit. */
    var aktualisiertGerade = false;
    function aktualisieren() {
      if (aktualisiertGerade || !team() || !bereit()) return;
      aktualisiertGerade = true;
      var fn = state.tab === "responses" ? window.UpstreemDashboardDaten.FN.clear : D.FN.aktualisieren;
      var vorab = UC.rpc(fn, { p_team: team() }).then(function () { lader.leeren(); }, function () { lader.leeren(); });
      var fertig = function () { aktualisiertGerade = false; };
      Promise.resolve(bedarf({ frisch: true, vorab: vorab, seite: true })).then(fertig, fertig);
    }
    if (elRefresh) elRefresh.addEventListener("click", function () {
      if (UC.spinOnce) UC.spinOnce(elRefresh);
      aktualisieren();
    });

    /* DIE EIGENE MARKE KANN SPAETER KOMMEN als der Aufbau (setUpstreemBrands laeuft im
       Seitenaufbau der App, die Seite richtet sich schon vorher ein). Die Prompt-Tabelle liest sie
       nur aus data-brand-name/-logo (sie beobachtet die Attribute) -- also hier nachziehen, sonst
       fehlt ihr "<Marke> mentioned?" (im Pruefstand gemessen: Marke im Store, Schalter display
       none). Die Response-Tabelle bekommt sie zusaetzlich mit jeder Lieferung. */
    function markeNachziehen() {
      var mk = eigeneMarke();
      if (!mk) return;
      [el(".upt-root"), el(".urt-root")].forEach(function (x) {
        if (!x) return;
        if (x.getAttribute("data-brand-name") !== str(mk.name)) x.setAttribute("data-brand-name", str(mk.name));
        if (x.getAttribute("data-brand-logo") !== str(mk.logo_url)) x.setAttribute("data-brand-logo", str(mk.logo_url));
      });
    }
    if (UC.onBrands) UC.onBrands(markeNachziehen, root);
    markeNachziehen();

    /* Teamwechsel ohne Neuladen: andere Daten, also nichts aus dem Speicher weiterzeigen. */
    if (UC.onTeamChange) UC.onTeamChange(function () {
      lader.leeren(); state.seite = null;
      state.p.offset = 0; state.resp.offset = 0;
      persist(); bedarf({ seite: true });
    }, root);

    var ctrl = {
      root: root, state: state, ids: ids,
      reset: function () {
        lader.leeren();
        state.p = promptsVorgabe(); state.resp = respVorgabe();
        persist(); bedarf({ frisch: true, seite: true });
        return true;
      },
      neuLaden: function () { lader.leeren(); bedarf({ seite: true }); }
    };
    root.__upiCtrl = ctrl;

    reiterZeigen();
    adresseSetzen(false);
    /* Erst nach dem Aufbau der eingebetteten Bausteine: deren Skripte richten sich ueber
       watchRoots ein, der Kalender kennt seinen Zeitraum also erst einen Takt spaeter. */
    setTimeout(function () { filterAbgleichen(); persist(); bedarf(); }, 0);
    return ctrl;
  }

  /* ---- Mount (wie citations-page.js) ---------------------------------------------------------- */
  function alle() { return [].slice.call(document.querySelectorAll(".upi-root")); }
  function jede(id, fn) {
    var r = alle().filter(function (x) { return id == null || str(x.getAttribute("data-instance")) === String(id); });
    r.forEach(function (x) { var c = initRoot(x); if (c) fn(c); });
    return r.length > 0;
  }
  window.resetPromptsPage = function (id) { return jede(id, function (c) { c.reset(); }); };
  function einrichten() {
    alle().forEach(function (r) {
      if (r.__upiCtrl) return;
      if (messbar(r)) { initRoot(r); return; }
      var neu = !(UC.wartetAufSicht && UC.wartetAufSicht(r));
      beiSicht(r, "einrichten", function () { initRoot(r); }, messbar, { lang: neu });
    });
  }
  if (UC.watchRoots) UC.watchRoots("upi-root", einrichten);
  einrichten();
  Q.splice(0).forEach(function (q) { try { window[q[0]].apply(null, q[1]); } catch (e) {} });
  }

  upiBoot(30);
})();
