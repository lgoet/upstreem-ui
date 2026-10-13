/* upstreem domain-drawer.js -- der Domain-Drawer aus core (13.10.). Praefix uddr.
   Braucht core.js, citations-data.js, dashboard-data.js und domain-detail.js, view-switch.js,
   urls-table.js, responses-table.js.

   Ein Drawer der ERSTEN Ebene (#drawer-domain, Hoehe und Bewegung aus der Huelle in core,
   KERN_DRAWER), gebaut nach denselben Regeln wie Brand und Prompt:
     Kopf (core)   "Domain / <domain>", "Count as" (Menue, siehe unten), Ask Mira, Anheften
     Titel         Favicon, Domain, daneben der Chip des Citation Types -- aus domain_detail_v1
     Filterzeile   Kalender, Modelle, Maerkte, Topics
     Domain Detail domain-detail.js (Citation Share, URL Share, Funnel, Typen, Modelle)
     Umschalter    view-switch.js: "Pages / URLs" oder "Responses"
     URLs          urls-table.js im Domain-Modus -- cached_citations_domain_urls_v1
     Responses     responses-table.js -- cached_dashboard_responses_v1 mit p_domain
   Die Bausteine laufen im lokalen Modus (data-local). Neu, gebaut vom DB-Chat am 13.10.
   (bubble/domain_editor_13_10/): domain_detail_v1, domain_detail_stats_v1, domain_url_share_v1,
   domain_classify_v1. Solange die Bubble-Gruppe #drawer-domain steht, laeuft hier nichts.

   "COUNT AS" (Bubble: add_/remove_team_domain_override; der Nutzer wollte es nicht "Override"
   nennen; seit 13.10. ein Icon-Knopf mit Menue statt Text im Kopf): je Team laesst sich eine Domain als eigene Seite (Citation Type "You") oder als Seite
   eines Wettbewerbers ("Competition") zaehlen, wenn die App das nicht selbst erkennt -- oder
   zurueck zur Erkennung. Danach rechnet alles mit Citations-Bezug neu: domain_classify_v1 leert
   die Caches selbst, der Drawer verwirft seinen Speicher und laedt frisch.

   LADEN wie Brand und Prompt: GEMEINSAM -- was die ganze Ansicht betrifft, erscheint zusammen. */
(function () {
  "use strict";

  function uddrBoot(n) {
    if (!window.UpstreemCore || !window.UpstreemCitationsDaten || !window.UpstreemDashboardDaten) {
      if (n > 0) { setTimeout(function () { uddrBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[domain-drawer] core.js, citations-data.js oder dashboard-data.js nicht geladen");
      return;
    }
    uddrStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .drawer_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    uut: "<div class=\"up-root uut-root\" data-local=\"yes\" data-instance=\"__UDDR_UUT__\" data-cdn-pin=\"\" data-isdark=\"__UDDR_DARK__\" data-domain-mode=\"yes\" data-brand-name=\"__UDDR_BRAND__\" data-brand-logo=\"__UDDR_BRANDLOGO__\" data-export-instance=\"\" data-sticky-top=\"16\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">URLs</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"uut-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"uut-brand-toggle-lbl\"><img class=\"uut-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"uut-brand-label\"></span></span><span class=\"uut-brand-check\"><svg class=\"uut-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"uut-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-filter\"><button class=\"up-filter-btn\" type=\"button\" data-tip=\"Filter Citation and URL Types\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-filter-btn-lbl\">All Types</span><svg class=\"up-filter-btn-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-filter-btn-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Type in url...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search URLs\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"uut-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><div class=\"up-th up-th-domain\">URL<span class=\"up-grip\" data-grip=\"domain\"></span></div><div class=\"up-th up-th-share is-sortable\" data-sortcol=\"share\"><span class=\"up-th-txt\">Share</span><span class=\"up-th-info\" data-explain=\"share\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span><span class=\"up-thsort\" data-for=\"share\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-type\">Type<span class=\"up-th-info\" data-explain=\"type\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-ment\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">mentioned</span></div><div class=\"up-th up-th-brands\">Brands mentioned<span class=\"up-th-info\" data-explain=\"brands\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16V12\"/><path d=\"M12.125 8.25H12M12.25 8.25C12.25 8.11193 12.1381 8 12 8C11.8619 8 11.75 8.11193 11.75 8.25C11.75 8.38807 11.8619 8.5 12 8.5C12.1381 8.5 12.25 8.38807 12.25 8.25Z\"/></svg></span></div><div class=\"up-th up-th-lastseen is-sortable\" data-sortcol=\"last_seen\"><span class=\"up-th-txt\">Last Seen</span><span class=\"up-thsort\" data-for=\"last_seen\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th uut-th-actions\">Actions</div></div><div class=\"up-tbody\"></div></div></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>",
    urt: "<div class=\"up-root urt-root\" data-local=\"yes\" data-merken=\"yes\" data-instance=\"__UDDR_URT__\" data-cdn-pin=\"\" data-isdark=\"__UDDR_DARK__\" data-brand-name=\"__UDDR_BRAND__\" data-brand-logo=\"__UDDR_BRANDLOGO__\" data-spotlight-mode=\"no\" data-export-instance=\"\" data-sticky-top=\"16\" data-sticky=\"yes\" data-default-view=\"table\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Responses</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"urt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"urt-brand-toggle-lbl\"><img class=\"urt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"urt-brand-label\"></span></span><span class=\"urt-brand-check\"><svg class=\"urt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"urt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- Reihenfolge: Sorter VOR dem Fader, also von rechts gelesen der Fader vor dem Sorter. core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars) -- hier steht sie richtig, damit eine Neuinstallation nicht erst umsortiert werden muss. --><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- lucide \"settings-2\" \u2014 the SAME filter glyph visibility-chart / topcitations / combo-chart use. .up-iconbtn makes it behave like every other toolbar icon button. --><div class=\"urt-fader\"><button class=\"urt-fader-btn up-iconbtn\" type=\"button\" data-tip=\"Filter by rank &amp; sentiment\" aria-label=\"Filter by rank and sentiment\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg></button><div class=\"urt-fader-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search responses\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"urt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- .up-dense / .up-dense-btn are core's segmented control \u2014 the same one the Row Height picker uses. Reused verbatim so this switcher IS the app's switcher, not a lookalike. .urt-viewswitch only overrides the width (core's is full-width for the popover). --><div class=\"up-dense urt-viewswitch\" role=\"group\" aria-label=\"View\"><button class=\"up-dense-btn up-dense-btn-icon is-active\" type=\"button\" data-view=\"table\" data-tip=\"Table view\" aria-label=\"Table view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18\"/></svg></button><button class=\"up-dense-btn up-dense-btn-icon\" type=\"button\" data-view=\"cards\" data-tip=\"Card view\" aria-label=\"Card view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 4V20\"/><path d=\"M18 4V20\"/><path d=\"M21 7L3 7\"/><path d=\"M21 17L3 17\"/></svg></button></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><!-- The lead column's resize grip. Every other table has one; without it the first column simply cannot be dragged (core's resize kit binds to .up-grip). --><div class=\"up-th up-th-prompt\">Prompt<span class=\"up-grip\" data-grip=\"prompt\"></span></div><!-- \"<brand logo> mentioned?\", identical to urls-table: the logo is filled in from data-brand-logo, and without one the label falls back to \"<brand name> mentioned?\" --><div class=\"up-th up-th-mentioned\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">Mentioned</span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions</div><div class=\"up-th up-th-citations\">Citations</div><div class=\"up-th up-th-model\">Model</div><div class=\"up-th up-th-date is-sortable\" data-sortcol=\"date\"><span class=\"up-th-txt\">Date</span><span class=\"up-thsort\" data-for=\"date\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"urt-cards\"></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function uddrStart() {
  var UC = window.UpstreemCore, D = window.UpstreemDashboardDaten, C = window.UpstreemCitationsDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  if (!UC.kernDrawer) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function num(v) { if (v == null || v === "" || typeof v === "boolean") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function liste(s) { return String(s == null ? "" : s).split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function texte(a) { a = isArr(a) ? a.map(str).map(function (x) { return x.trim(); }).filter(Boolean) : []; return a.length ? a : null; }
  function setter(name) { return typeof window[name] === "function" ? window[name] : function () {}; }
  function dunkel() { try { return (window.getUpstreemTheme ? window.getUpstreemTheme() : "") === "dark"; } catch (e) { return false; } }
  function eigeneMarke() {
    var l = UC.getBrands ? UC.getBrands() : [];
    for (var i = 0; i < l.length; i++) if (l[i] && (str(l[i].role).toLowerCase() === "own" || l[i].is_own === true)) return l[i];
    return null;
  }
  function teamWarten() { return UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(UC.getTeam ? UC.getTeam() : ""); }
  function bild(u) { u = str(u).trim(); if (/^\/\//.test(u)) return "https:" + u; return /^https?:\/\//i.test(u) ? u : ""; }
  /* Wie die DB sie liest (Vertrag Citations: klein, ohne www.) -- die Adresse ist frei eingebbar. */
  function domainNorm(d) {
    d = str(d).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
    return d.split("/")[0].split("?")[0].split("#")[0].slice(0, 255);
  }

  var FN = { kopf: "domain_detail_v1", stats: "domain_detail_stats_v1", anteil: "domain_url_share_v1", zaehlen: "domain_classify_v1" };
  var IDS = { daten: "drawer-domain-daten", filter: "drawer-domain-filter", modelle: "drawer-domain-models",
              maerkte: "drawer-domain-markets", topics: "drawer-domain-topics",
              udd: "drawer-domain-detail", uvw: "drawer-domain-switch", uut: "drawer-domain-urls", urt: "drawer-domain-responses" };

  var S = {
    slot: null, root: null, kopf: null, domain: "", zeile: null, nr: 0, ab: null, fehler: "", fehlerWiederholbar: false,
    lader: D.makeLader({ rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 60000 }); } }),
    f: { von: "", bis: "", modelle: null, maerkte: null, topics: null, tagmode: "or" },
    udd: { modus: "citation", gran: "day" },
    /* Welche Tabelle der Umschalter zeigt: "pages" (URLs) oder "responses". */
    tab: "pages",
    urls: null, resp: null, eigene: null, kopfSpeicher: {}, zaehltLaeuft: false
  };
  function urlsStart() {
    return { order: "domainshare_desc", limit: 15, offset: 0, suche: "", requestId: null,
             urlTypen: null, citationTypen: null, marken: null, erwaehnt: "all" };
  }
  function respStart() {
    return { order: "run_at_desc", limit: 15, offset: 0, suche: "", requestId: null, erwaehnt: "all",
             firmen: null, sentMin: null, sentMax: null, rankMin: null, rankMax: null };
  }
  S.urls = urlsStart(); S.resp = respStart();

  function filterStand() {
    return { team: UC.getTeam ? UC.getTeam() : "", von: S.f.von, bis: S.f.bis, modelle: S.f.modelle,
             maerkte: S.f.maerkte, topics: S.f.topics, tagmode: S.f.tagmode };
  }
  function marke() { return eigeneMarke() || S.eigene || null; }
  function anfrage(fn, params) { return { art: fn, fn: fn, params: params, sig: fn + "|" + JSON.stringify(params) }; }
  function mit(a, zusatz) {
    var p = {}, k;
    for (k in a.params) p[k] = a.params[k];
    for (k in zusatz) p[k] = zusatz[k];
    return { art: a.art, fn: a.fn, params: p, sig: a.fn + "|" + JSON.stringify(p) };
  }
  /* Die Zeitraum- und Filterparameter der neuen Domain-RPCs -- dieselben Namen wie Dashboard und
     Citations (p_models, p_markets, p_tag_ids, p_tagmode). */
  function basis() {
    var f = filterStand();
    return { p_team: f.team, p_domain: S.domain, p_date_from: f.von || null, p_date_to: f.bis || null,
             p_models: texte(f.modelle), p_markets: texte(f.maerkte), p_tag_ids: texte(f.topics),
             p_tagmode: f.tagmode === "and" ? "and" : "or" };
  }

  /* ---- Der Kopf: Favicon, Domain, Chip des Citation Types ---- */
  function logoHtml(d) {
    var fav = bild(d.favicon_url), dom = str(d.domain) || S.domain;
    return '<span class="up-logo-box up-dk-logo' + (fav ? " has-img" : "") + '" data-domain="' + esc(dom) + '">' +
      (fav ? '<img src="' + esc(fav) + '" alt="" referrerpolicy="no-referrer"' +
             ' onerror="this.parentNode.classList.remove(\'has-img\'); this.remove()">' : "") +
      '<span class="up-logo-ltr">' + esc((dom.charAt(0) || "?").toUpperCase()) + '</span></span>';
  }
  /* Der Typ als .up-tag, wie im URL-Drawer (url-detail.js, kpiWert): Farbe aus UC.typeColor, im
     Hellen getoent, im Dunkeln auf dem Chipgrund. Ohne Punkt -- der gehoert dem URL-Typ. */
  function typChip(typ, dbLabel) {
    typ = str(typ);
    if (!typ) return "";
    var farbe = UC.typeColor ? UC.typeColor(typ, "citation", dunkel()) : "";
    var grund = dunkel() ? (UC.CHIP_BG_DARK || "") : (UC.tint ? UC.tint(farbe, 0.12) : "");
    /* Die Beschriftung der App (UC.typeLabel, uebersetzt), sonst die der DB (citation_type_label). */
    var label = (UC.typeLabel ? UC.typeLabel(typ, "citation") : "") || str(dbLabel) || typ;
    return '<span class="up-tag uddr-typ" style="color:' + esc(farbe) + ';background:' + esc(grund) + '">' +
      '<span class="up-tag-lbl">' + esc(label) + '</span></span>';
  }
  function typLabel(typ) { return UC.typeLabel ? UC.typeLabel(str(typ), "citation") : str(typ); }
  function kopfZeichnen() {
    var r = S.root;
    if (!r) return;
    var d = S.zeile, elLogo = r.querySelector(".uddr-bild"), elName = r.querySelector(".uddr-titel"),
        elTyp = r.querySelector(".uddr-typwahl"), elSub = r.querySelector(".uddr-sub");
    r.classList.toggle("is-fehler", !!S.fehler);
    var fehlerEl = r.querySelector(".uddr-fehler");
    fehlerEl.hidden = !S.fehler;
    if (S.fehler) {
      fehlerEl.innerHTML = UC.leerHtml({ icon: "info", titel: "Domain not available", text: S.fehler,
        knopf: S.fehlerWiederholbar ? "Try again" : "", knopfAttr: "data-uddr-retry" });
      if (S.kopf) { S.kopf.name(""); S.kopf.eigen.innerHTML = ""; }
      return;
    }
    if (!d) {
      elLogo.innerHTML = '<span class="up-dk-sk is-logo"></span>';
      elName.innerHTML = '<span class="up-dk-sk is-titel"></span>';
      elTyp.innerHTML = "";
      elSub.innerHTML = '<span class="up-dk-sk is-s"></span>';
      if (S.kopf) { S.kopf.name(null); S.kopf.eigen.innerHTML = ""; }
      return;
    }
    var dom = str(d.domain) || S.domain;
    elLogo.innerHTML = logoHtml(d);
    elName.textContent = dom;
    elTyp.innerHTML = typChip(d.citation_type, d.citation_type_label);
    /* Darunter: wem die Domain gehoert (eine verfolgte Marke) und wann sie zuletzt zitiert wurde --
       die leise Zeile des Kopfes, wie die Domain unter dem Markennamen. */
    var teile = [], c = d.company && typeof d.company === "object" ? d.company : null;
    if (c && c.name) teile.push('<button type="button" class="up-dk-held-link" data-uddr-marke="' + esc(str(c.company_id)) + '">' + esc(str(c.name)) + '</button>');
    if (d.last_seen) teile.push('<span class="uddr-zuletzt">' + esc(t("Last cited on {date}").replace("{date}", UC.fmtDate(str(d.last_seen)))) + '</span>');
    else teile.push('<span class="uddr-zuletzt">' + esc(t("Your team has never cited this domain.")) + '</span>');
    elSub.innerHTML = teile.join('<span class="up-dk-sep" aria-hidden="true"></span>');
    if (S.kopf) {
      S.kopf.name(dom);
      var html = "";
      /* Ohne Recht (can_override false, nur owner/admin) oeffnet der Knopf trotzdem: das Menue nennt
         dann den Typ und sagt, wer ihn aendern darf (Vertrag 13.10.: "nur lesbar"). */
      html += zaehltKnopf();
      if (UC.anMira && UC.miraBezug) html += knopf("mira", "blend", "Ask Mira about this");
      if (typeof window.upstreemPinToSidebar === "function") html += knopf("pin", "pin", "Pin to sidebar");
      S.kopf.eigen.innerHTML = html;
      zaehltMenueVerdrahten();
    }
  }
  function knopf(art, zeichen, label) {
    return '<button type="button" class="up-iconbtn" data-uddr-kopf="' + art + '" data-tip="' + esc(t(label)) +
      '" aria-label="' + esc(t(label)) + '">' + UC.icon(zeichen, 2) + '</button>';
  }

  /* ---- "Count as": Icon-Knopf und Menue im Kopf (13.10. umgebaut: "oben der aktuelle Citation
     Type, darunter die Moeglichkeiten zum Wechseln") ----------------------------------------------
     Ein Icon-Knopf wie die anderen im Kopf (Hugeicons DropdownFieldType), das Menue aus den
     Bausteinen des Sortiermenues in core (UC.makePopover, .up-sort-menu, .up-pop-head, .up-pop-opt
     mit Haken, .up-pop-div). Oben der wirksame Typ als Chip -- dieselbe Form wie im Titel --, darunter
     die Wahl. Ohne Recht (can_override false) nur der Stand und ein Satz, keine Wahl. */
  /* typ: der Citation Type, als der die Domain mit dieser Wahl zaehlt -- seine Farbe steht als
     kleine Form vor der Zeile (13.10.), wie der Chip oben im Menue. */
  var WAHL = [
    { key: "auto", label: "Detected automatically" },
    { key: "own", label: "Your own site", typ: "You" },
    { key: "competitor", label: "A competitor's site", typ: "Competition" }
  ];
  function wahlJetzt(d) { var o = str(d && d.override); return o === "own" || o === "competitor" ? o : "auto"; }
  function zaehltKnopf() {
    return '<div class="uddr-zaehlt">' +
      '<button type="button" class="up-iconbtn uddr-zaehlt-btn" aria-haspopup="menu" aria-expanded="false"' +
        ' data-tip="' + esc(t("Citation type")) + '" aria-label="' + esc(t("Citation type")) + '">' +
        UC.icon("bookmarkPlus", 2) + '</button>' +
      '<div class="up-sort-menu uddr-zaehlt-menu" role="menu" aria-hidden="true"></div>' +
    '</div>';
  }
  var zaehltPop = null;
  function zaehltMenueVerdrahten() {
    var wrap = S.kopf && S.kopf.eigen.querySelector(".uddr-zaehlt");
    if (!wrap || !UC.makePopover) return;
    var menu = wrap.querySelector(".uddr-zaehlt-menu"), btn = wrap.querySelector(".uddr-zaehlt-btn");
    var d = S.zeile || {}, jetzt = wahlJetzt(d), lesend = d.can_override === false;
    /* Gehoert die Domain einer verfolgten Marke, lehnt die DB den Widerspruch ab (Vertrag 13.10.:
       eigene Marke nicht als Wettbewerber, Wettbewerber nicht als eigene Seite). Die Wahl steht
       dann gesperrt da, mit dem Grund im Tooltip -- statt eines Klicks, der nur einen Fehler bringt. */
    var firma = d.company && typeof d.company === "object" ? d.company : null, rolle = firma ? str(firma.role) : "";
    function gesperrt(key) {
      if (rolle === "competitor" && key === "own") return t("This domain belongs to {brand}, a competitor.").replace("{brand}", str(firma.name));
      if (rolle === "own" && key === "competitor") return t("This is the domain of your brand {brand}.").replace("{brand}", str(firma.name));
      return "";
    }
    var quelle = jetzt === "auto" ? t("Detected automatically") : t("Set by your team");
    var html = '<div class="up-pop-head">' + esc(t("Current citation type")) + '</div>' +
      '<div class="uddr-zaehlt-jetzt">' + typChip(d.citation_type, d.citation_type_label) +
        '<span class="uddr-zaehlt-quelle">' + esc(quelle) + '</span></div>' +
      '<div class="up-pop-div"></div>';
    if (lesend) {
      html += '<div class="uddr-zaehlt-hinweis">' + esc(t("Only owners and admins can change how a domain counts.")) + '</div>';
    } else {
      html += '<div class="up-pop-head">' + esc(t("Count this domain as")) + '</div>' +
        WAHL.map(function (w) {
          var label = t(w.label), grund = gesperrt(w.key);
          if (w.key === "auto") label += " (" + (str(d.citation_type_auto_label) || typLabel(d.citation_type_auto || d.citation_type)) + ")";
          return '<div class="up-pop-opt' + (w.key === jetzt ? " is-active" : "") + (grund ? " is-disabled" : "") + '" role="menuitemradio" aria-checked="' +
            (w.key === jetzt) + '"' + (grund ? ' aria-disabled="true" data-tip="' + esc(grund) + '"' : ' tabindex="0" data-uddr-wahl="' + w.key + '"') +
            '><span class="up-pop-opt-l">' + (w.typ && UC.typeColor ? '<span class="up-pop-form" style="background:' + esc(UC.typeColor(w.typ, "citation", dunkel())) + '"></span>' : '') +
            '<span>' + esc(label) + '</span></span>' +
            '<span class="up-check">' + UC.icon("check", 3) + '</span></div>';
        }).join("");
    }
    menu.innerHTML = html;
    zaehltPop = UC.makePopover({ wrap: wrap, menu: menu, opener: btn });
    btn.addEventListener("click", function () { zaehltPop.toggle(); btn.setAttribute("aria-expanded", String(zaehltPop.isOpen())); });
    menu.addEventListener("click", function (e) {
      var o = e.target.closest ? e.target.closest("[data-uddr-wahl]") : null;
      if (!o) return;
      zaehltPop.close(true);
      zaehltSetzen(o.getAttribute("data-uddr-wahl"));
    });
  }

  /* Speichern: sofort dimmen (Schreibaktion, kein Skelett), dann neu rechnen lassen. Die DB leert
     ihre Caches selbst (Vertrag); hier wird der Speicher des Laders verworfen und alles frisch
     geladen -- auch die Tabellen, deren Typen jetzt anders heissen koennen. */
  function zaehltSetzen(wahl) {
    var d = S.zeile;
    if (!d || S.zaehltLaeuft || wahl === wahlJetzt(d)) return;
    S.zaehltLaeuft = true;
    S.root.classList.add("is-speichert");
    var domain = S.domain;
    teamWarten().then(function (team) {
      return UC.rpc(FN.zaehlen, { p_team: team, p_domain: domain, p_role: wahl === "auto" ? null : wahl }, { timeoutMs: 30000 });
    }).then(function (erg) {
      S.zaehltLaeuft = false;
      S.root.classList.remove("is-speichert");
      if (domain !== S.domain) return;
      var roh = erg && erg.ok ? erg.daten : null;
      if (isArr(roh)) roh = roh.length ? roh[0] : null;
      var neu = roh && roh.row && typeof roh.row === "object" ? roh.row : null;
      if (!erg || !erg.ok) {
        var fe = (erg && erg.fehler) || {}, code = str(fe.message || fe.code), hint = str(fe.hint), wer = str(fe.details || fe.detail);
        if (window.console) console.warn("[domain-drawer] " + FN.zaehlen + ": " + (code || "Antwort nicht lesbar") + (hint ? " (" + hint + ")" : ""));
        var satz = code === "domain_classify_forbidden" ? t("Only owners and admins can change how a domain counts.")
          : code === "domain_classify_rate_limited" ? t("Too many changes in a short time. Please wait a moment.")
          : code === "domain_classify_invalid" && hint === "tracked_competitor" ? t("This domain belongs to {brand}, a competitor.").replace("{brand}", wer || "?")
          : code === "domain_classify_invalid" && hint === "own_brand" ? t("This is the domain of your brand {brand}.").replace("{brand}", wer || "?")
          : code === "domain_classify_invalid" && hint === "limit" ? t("Your team can assign up to {n} domains.").replace("{n}", wer || "100")
          : t("This change could not be saved. Please try again.");
        if (UC.toast) UC.toast(satz, { kind: "error" });
        return;
      }
      if (neu) { S.kopfSpeicher[domain] = neu; S.zeile = neu; }
      if (UC.toast) UC.toast(t(wahl === "own" ? "This domain now counts as your own site."
        : wahl === "competitor" ? "This domain now counts as a competitor's site."
        : "This domain is detected automatically again."), { kind: "success" });
      /* Alles mit Citations-Bezug rechnet neu: Speicher weg, frisch laden, Kopf mit. */
      if (S.lader.leeren) S.lader.leeren();
      alleLaden(true, true);
    });
  }
  function kopfKlick(art) {
    var d = S.zeile || {};
    if (art === "mira" && UC.anMira && UC.miraBezug) {
      var b = UC.miraBezug({ type: "domain", domain: S.domain, favicon: bild(d.favicon_url), id: S.domain });
      if (b) UC.anMira(b, ["domain"]);
    } else if (art === "pin" && typeof window.upstreemPinToSidebar === "function") {
      try { window.upstreemPinToSidebar({ type: "domain", id: S.domain, label: S.domain, logo: bild(d.favicon_url) }); } catch (e) {}
    }
  }
  function fehlerText(code) {
    var c = String(code || "").trim();
    if (c === "domain_not_found" || c === "team_invalid_param") return "This isn't a valid domain.";
    if (c === "settings_not_authenticated" || c === "not authenticated") return "Your session has expired. Please sign in again.";
    if (c === "team_deleted") return "This team has been deleted.";
    if (/^team_access_/.test(c) || c === "forbidden" || c === "team_forbidden") return "Your team doesn't have access right now.";
    if (/_rate_limited$/.test(c)) return "Too many requests in a short time. Please wait a moment.";
    return "This domain could not be loaded. Please try again.";
  }
  function wiederholbar(code) {
    var c = String(code || "").trim();
    return !(c === "domain_not_found" || c === "team_invalid_param" || /^team_access_/.test(c) || c === "forbidden" ||
      c === "team_forbidden" || c === "team_deleted" || c === "not authenticated" || c === "settings_not_authenticated");
  }

  /* ---- LADEN: GEMEINSAM (wie brand-drawer.js und dashboard-page.js) ---- */
  var gruppeNr = 0, juengsteJe = {};
  function gemeinsam(auftraege, frisch) {
    var nr = ++gruppeNr;
    auftraege.forEach(function (a) { juengsteJe[a.kanal] = nr; if (frisch || !a.imSpeicher) a.ladenAn(); });
    return Promise.all(auftraege.map(function (a) { return a.laden(frisch); })).then(function (zeigen) {
      zeigen.forEach(function (z, i) {
        if (z && juengsteJe[auftraege[i].kanal] === nr) { try { z(); } catch (e) { if (window.console) console.error("[domain-drawer] " + auftraege[i].kanal + ":", e); } }
      });
    });
  }
  function laden(paare, frisch) {
    return Promise.all(paare.map(function (p) { return S.lader.laden(p[0], p[1], { frisch: !!frisch }); }));
  }
  function imSpeicher(anfragen) { return anfragen.every(function (a) { return S.lader.ausSpeicher(a) !== undefined; }); }
  function zeileAus(erg) {
    var roh = erg && erg.ok ? erg.daten : null;
    if (isArr(roh)) roh = roh.length ? roh[0] : null;
    return roh && typeof roh === "object" ? roh : null;
  }

  function kopfAuftrag() {
    var dom = S.domain;
    return {
      kanal: "kopf", imSpeicher: !!S.kopfSpeicher[dom],
      ladenAn: function () { S.zeile = null; S.fehler = ""; kopfZeichnen(); },
      laden: function (frisch) {
        if (!frisch && S.kopfSpeicher[dom]) {
          var d0 = S.kopfSpeicher[dom];
          return Promise.resolve(function () { S.zeile = d0; S.fehler = ""; kopfZeichnen(); });
        }
        if (S.ab) { try { S.ab.abort(); } catch (e) {} }
        var ab = typeof AbortController !== "undefined" ? new AbortController() : null;
        S.ab = ab;
        var nr = ++S.nr;
        return teamWarten().then(function (team) {
          if (nr !== S.nr) return null;
          if (!team) return { ok: false, status: 0, fehler: { message: "not authenticated" } };
          return UC.rpc(FN.kopf, { p_team: team, p_domain: dom }, { timeoutMs: 60000, signal: ab ? ab.signal : undefined });
        }).then(function (erg) {
          if (!erg || nr !== S.nr) return null;
          var roh = zeileAus(erg), d = roh && roh.row && typeof roh.row === "object" ? roh.row : null;
          if (d) {
            S.kopfSpeicher[dom] = d;
            return function () { S.zeile = d; S.fehler = ""; kopfZeichnen(); };
          }
          var code = erg.ok ? "" : str((erg.fehler && (erg.fehler.message || erg.fehler.code)) || "");
          if (window.console) console.warn("[domain-drawer] " + FN.kopf + " fuer " + dom + ": " + (code || "Antwort nicht lesbar") +
            (erg.status ? " (HTTP " + erg.status + ")" : ""));
          S.zeile = null; S.fehler = t(fehlerText(code)); S.fehlerWiederholbar = wiederholbar(code);
          kopfZeichnen();
          return null;
        });
      }
    };
  }

  /* Domain Detail: die Zahlen im Zeitraum (domain_detail_stats_v1), im Modus "URL Share" dazu die
     Kurven je URL (domain_url_share_v1). In die Form, die die Komponente heute liest
     (setDomainDetail / setDomainDetailUrls, siehe domain-detail.js setData/setUrls). */
  function zuDetail(roh) {
    var r = roh && roh.row && typeof roh.row === "object" ? roh.row : null;
    if (!r) return null;
    var m = roh.meta && typeof roh.meta === "object" ? roh.meta : {};
    var kz = r.header && typeof r.header === "object" ? r.header : r;
    var kopfZ = S.zeile || {};
    var header = {}, k;
    for (k in kz) if (Object.prototype.hasOwnProperty.call(kz, k) && typeof kz[k] !== "object") header[k] = kz[k];
    header.domain = S.domain; header.id = S.domain;
    header.favicon = bild(kopfZ.favicon_url);
    header.citation_type = str(kopfZ.citation_type) || header.citation_type;
    /* Vertrag 13.10.: timeseries ist die Liste der Buckets ({day, share_pct, partial, ...}); die
       Komponente liest sie als timeseries.citation_share_over_time (Form des alten v14). */
    var ts = isArr(r.timeseries) ? { citation_share_over_time: r.timeseries }
      : (r.timeseries && typeof r.timeseries === "object" ? r.timeseries : { citation_share_over_time: [] });
    return { header: header, granularity: str(m.granularity) || S.udd.gran,
             timeseries: ts,
             types_breakdown: isArr(r.types_breakdown) ? r.types_breakdown : [],
             model_breakdown: isArr(r.model_breakdown) ? r.model_breakdown : [],
             source_presence_funnel: r.source_presence_funnel || null };
  }
  /* URL Share zeigt, wie sich die Zitationen DIESER Domain auf ihre URLs verteilen (domain-detail.js,
     Modus "domain") -- also domain_share_pct und domain_share_total_pct (Vertrag 13.10.), nicht
     share_pct, das ist der Anteil an allen Antworten. Titel aus urls[], die Zeilen tragen keinen. */
  function zuAnteil(roh) {
    var rows = roh && isArr(roh.rows) ? roh.rows : null;
    if (!rows) return null;
    var m = roh.meta && typeof roh.meta === "object" ? roh.meta : {};
    var jeUrl = {};
    (isArr(roh.urls) ? roh.urls : []).forEach(function (u) { if (u && u.url) jeUrl[str(u.url)] = u; });
    return { granularity: str(m.granularity) || S.udd.gran, domain: S.domain,
             points: rows.map(function (p) {
               var u = jeUrl[str(p.url)] || {};
               var anteil = num(p.domain_share_pct), gesamt = num(u.domain_share_total_pct);
               return { day: str(p.day), url: str(p.url), title: str(p.title || u.title),
                        share_pct: anteil != null ? anteil : num(p.share_pct),
                        share_total_pct: gesamt != null ? gesamt : num(u.share_total_pct) };
             }) };
  }
  function detailAuftrag() {
    var modus = S.udd.modus, b = basis();
    b.p_granularity = S.udd.gran;
    var stats = anfrage(FN.stats, b), anteil = null;
    if (modus === "domain") { var b2 = {}, k; for (k in b) b2[k] = b[k]; b2.p_top_n = 7; anteil = anfrage(FN.anteil, b2); }
    var paare = [["udd_stats", stats]];
    if (anteil) paare.push(["udd_anteil", anteil]);
    return {
      kanal: "detail", imSpeicher: imSpeicher(paare.map(function (p) { return p[1]; })),
      ladenAn: function () { setter("setDomainDetailLoading")(IDS.udd, "yes"); },
      laden: function (frisch) {
        return laden(paare, frisch).then(function (e) {
          if (e.some(function (x) { return x.ueberholt; })) return null;
          if (modus !== S.udd.modus) return null;
          return function () {
            var p = e[0].ok ? zuDetail(zeileAus(e[0])) : null;
            /* Unlesbar ist nicht leer: domain-detail.js zeigt seinen Lesefehler nur bei einer
               Nutzlast, die kein Objekt ist -- also null, nicht { __parseError } (das hiesse dort
               "No data for this domain"). */
            setter("setDomainDetail")(IDS.udd, p || null);
            if (anteil) {
              var u = e[1].ok ? zuAnteil(zeileAus(e[1])) : null;
              setter("setDomainDetailUrls")(IDS.udd, u || null);
            }
            setter("setDomainDetailLoading")(IDS.udd, "no");
          };
        });
      }
    };
  }
  /* URLs der Domain: cached_citations_domain_urls_v1 (citations-data.js domainUrls), in die Form
     der URL-Tabelle (zuUrls -- dieselben URL-Zeilen). */
  function urlsAuftrag() {
    var f = filterStand(), u = S.urls;
    var cf = { team: f.team, von: f.von, bis: f.bis, modelle: f.modelle, maerkte: f.maerkte, topics: f.topics, tagmode: f.tagmode,
               erwaehnt: u.erwaehnt, marken: u.marken, citationTypen: u.citationTypen, urlTypen: null };
    var a = C.domainUrls(cf, S.domain, { suche: u.suche, order: u.order, limit: u.limit, offset: u.offset, urlTypen: u.urlTypen });
    var reqId = u.requestId;
    return {
      kanal: "urls", imSpeicher: imSpeicher([a]),
      ladenAn: function () { setter("setUrlsTableLoading")(IDS.uut, "yes"); },
      laden: function (frisch) {
        return laden([["urls", a]], frisch).then(function (e) {
          if (e[0].ueberholt) return null;
          return function () {
            var p = e[0].ok ? C.zuUrls(e[0].daten) : null;
            if (!p) setter("renderUrlsTable")({ instanceId: IDS.uut, __parseError: true });
            else {
              var mk = marke();
              p.instanceId = IDS.uut; p.isDark = dunkel();
              if (reqId != null) p.requestId = reqId;
              if (mk) { p.brand_name = str(mk.name); p.brand_logo = str(mk.logo_url); }
              setter("renderUrlsTable")(p);
            }
            setter("setUrlsTableLoading")(IDS.uut, "no");
          };
        });
      }
    };
  }
  /* Responses: cached_dashboard_responses_v1 mit p_domain (seit URL Detail, 12.10.). */
  function respAuftrag() {
    var teile = D.responsesTeile(filterStand(), S.resp).map(function (a) { return mit(a, { p_domain: S.domain }); }), reqId = S.resp.requestId;
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
              p.empty_text = t("No answers cited this domain in the selected period.");
              if (mk) { p.brand_name = str(mk.name); p.brand_logo = str(mk.logo_url); }
              setter("renderResponsesTable")(p);
            }
            setter("setResponsesTableLoading")(IDS.urt, "no");
          };
        });
      }
    };
  }
  /* Geladen wird nur die Tabelle, die der Umschalter zeigt; die andere kommt beim Umschalten. */
  function tabellenAuftrag() { return S.tab === "responses" ? respAuftrag() : urlsAuftrag(); }
  var AUFTRAG = { detail: detailAuftrag, urls: urlsAuftrag, resp: respAuftrag };
  function alleLaden(frisch, mitKopf) {
    if (!S.domain) return;
    teamWarten().then(function (team) {
      if (!team) return;
      var l = [detailAuftrag(), tabellenAuftrag()];
      if (mitKopf) l.unshift(kopfAuftrag());
      gemeinsam(l, frisch);
    });
  }
  var teilUhren = {};
  function teilLaden(teil) {
    clearTimeout(teilUhren[teil]);
    teilUhren[teil] = setTimeout(function () { teilUhren[teil] = null; if (S.domain) gemeinsam([AUFTRAG[teil]()], false); }, 80);
  }

  /* ---- Filter: Kalender, Modelle, Maerkte, Topics (wie brand-drawer.js) ---- */
  function setzen(feld, wert) {
    var alt = JSON.stringify(S.f[feld] == null ? null : S.f[feld]);
    if (alt === JSON.stringify(wert == null ? null : wert)) return false;
    S.f[feld] = wert;
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
  function kalender() { var k = S.slot && S.slot.querySelector(".uddr-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
  function zeitraum(von, bis) {
    var a = setzen("von", von), b = setzen("bis", bis);
    if ((a || b) && UC.granFuerZeitraum) { var g = UC.granFuerZeitraum(von, bis); if (g) S.udd.gran = g; }
    return a || b;
  }
  function filterAbgleichen() {
    var c = kalender(), r = null;
    try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
    if (r && r.from && r.to) zeitraum(r.from, r.to);
    var s = S.slot, m = s.querySelector(".umf-root"), k = s.querySelector(".umk-root"), tp = s.querySelector(".utf-root");
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
    S.resp.offset = 0; S.urls.offset = 0;
    clearTimeout(filterUhr);
    filterUhr = setTimeout(function () { filterUhr = null; alleLaden(false); }, 120);
  }

  /* ---- Aufbau ---- */
  function einsetzen(m) {
    var mk = marke();
    return String(m || "").split("__UDDR_UUT__").join(esc(IDS.uut)).split("__UDDR_URT__").join(esc(IDS.urt))
      .split("__UDDR_DARK__").join(dunkel() ? "yes" : "no")
      .split("__UDDR_BRANDLOGO__").join(esc(mk ? str(mk.logo_url) : ""))
      .split("__UDDR_BRAND__").join(esc(mk ? str(mk.name) : ""));
  }
  function tabZeigen() {
    if (!S.root) return;
    S.root.querySelector(".uddr-pane-urls").hidden = S.tab !== "pages";
    S.root.querySelector(".uddr-pane-resp").hidden = S.tab !== "responses";
  }
  function aufbauen(ctx) {
    var dk = dunkel() ? "yes" : "no", mk = marke();
    ctx.slot.innerHTML =
      '<div class="up-root uddr-root">' +
        '<div class="uddr-head up-dk">' +
          /* Kopf und Filter in EINER Zeile, die Filter oben rechts (13.10., Designvorlage Domain
             Detail: "Die Filter sind hier oben rechts"). Reicht die Breite nicht, rutschen sie
             unter den Kopf, linksbuendig -- siehe domain-drawer.css. */
          '<div class="uddr-heldzeile">' +
          '<div class="up-dk-held">' +
            '<span class="up-dk-held-bild uddr-bild"></span>' +
            '<div class="up-dk-held-text">' +
              '<div class="uddr-titelzeile"><h2 class="uddr-titel up-dk-titel"></h2><span class="uddr-typwahl"></span></div>' +
              '<div class="up-dk-held-sub uddr-sub"></div>' +
            '</div>' +
          '</div>' +
          '<div class="uddr-filterzeile">' +
            '<div class="up-root udr-root uddr-daten" data-instance="' + esc(IDS.daten) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
            '<div class="up-root ufb-root uddr-filterleiste" data-instance="' + esc(IDS.filter) + '" data-topics-instance="' + esc(IDS.topics) + '"' +
              ' data-models-instance="' + esc(IDS.modelle) + '" data-markets-instance="' + esc(IDS.maerkte) + '" data-isdark="' + dk + '"></div>' +
            '<div class="up-root utf-root" data-instance="' + esc(IDS.topics) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
            '<div class="up-root umf-root" data-instance="' + esc(IDS.modelle) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
            '<div class="up-root umk-root" data-instance="' + esc(IDS.maerkte) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
          '</div>' +
          '</div>' +
        '</div>' +
        '<div class="uddr-main">' +
          /* data-form="abschnitte": Domain Detail in der Form der Vorlage (Abschnitte statt
             Karten, Hinweisstreifen unter dem Trichter) -- nur hier, nicht auf der Landingpage. */
          '<div class="uddr-teil"><div class="up-root udd-root" data-local="yes" data-form="abschnitte" data-instance="' + esc(IDS.udd) + '" data-isdark="' + dk + '"' +
            ' data-brand="' + esc(mk ? str(mk.name) : "") + '"></div></div>' +
          '<div class="uddr-teil uddr-tabellen">' +
            '<div class="up-root uvw-root" data-local="yes" data-instance="' + esc(IDS.uvw) + '" data-isdark="' + dk + '" data-value="pages"></div>' +
            '<div class="uddr-pane-urls">' + einsetzen(MARKUP.uut) + '</div>' +
            '<div class="uddr-pane-resp" hidden>' + einsetzen(MARKUP.urt) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="uddr-fehler" hidden></div>' +
      '</div>';
    S.slot = ctx.slot; S.kopf = ctx; S.root = ctx.slot.querySelector(".uddr-root");
    if (UC.makeTooltips) UC.makeTooltips(S.root, dunkel);
    var s = ctx.slot;
    ctx.eigen.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-uddr-kopf]") : null;
      if (b) kopfKlick(b.getAttribute("data-uddr-kopf"));
    });
    s.addEventListener("click", function (e) {
      if (!e.target.closest) return;
      if (e.target.closest("[data-uddr-retry]")) { alleLaden(true, true); return; }
      var mk2 = e.target.closest("[data-uddr-marke]");
      if (mk2 && UC.drawerOeffnen) UC.drawerOeffnen("brand", mk2.getAttribute("data-uddr-marke"), "domain-drawer");
    });
    s.addEventListener("change", function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains("uddr-daten")) return;
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
    /* Domain Detail meldet Modus (citation | domain) und Stufe -- die Namen, die domain-detail.js
       im lokalen Modus schickt (Praefix "udd" vor dem nackten Namen). */
    an("udduddMode", function (d) {
      var m = str(d.mode) === "domain" ? "domain" : "citation";
      if (d.gran === "day" || d.gran === "week" || d.gran === "month") S.udd.gran = d.gran;
      if (m === S.udd.modus && !d.gran) return;
      S.udd.modus = m; teilLaden("detail");
    });
    an("udduddGran", function (d) {
      var g = str(d.gran);
      if (g !== "day" && g !== "week" && g !== "month") return;
      S.udd.gran = g; teilLaden("detail");
    });
    /* "Show these URLs" im Hinweisstreifen unter dem Trichter (domain-detail.js, uddLuecke): die
       URL-Tabelle auf die Seiten stellen, die einen Wettbewerber nennen, die eigene Marke aber
       nicht. Das sind zwei Filter, die die Tabelle schon hat und die die RPC schon kennt --
       "Brand mentioned: No" (p_mentioned no: die Seite nennt die eigene Marke nicht) und die
       Markenauswahl mit allen Wettbewerbern (p_mentioned_brands, ODER-verknuepft). Zusammen genau
       competitor_only_urls aus dem Trichter, also dieselbe Zahl wie im Streifen. Die Tabelle zeigt
       beide Filter sichtbar an (setUrlsTableFilters, still), der Nutzer nimmt sie dort wieder
       heraus wie jeden anderen. Danach: auf "Pages / URLs" stellen, frisch laden, hinrollen. */
    an("udduddLuecke", function (d) {
      var ids = isArr(d.competitor_ids) ? d.competitor_ids.map(str).filter(Boolean) : [];
      if (!ids.length) return;
      S.urls.marken = ids; S.urls.erwaehnt = "no"; S.urls.offset = 0; S.urls.requestId = null;
      try { setter("setUrlsTableFilters")(IDS.uut, { brands: ids, brand_mentioned: "no" }); } catch (e) {}
      if (S.tab !== "pages") {
        S.tab = "pages"; tabZeigen();
        try { setter("setViewSwitch")(IDS.uvw, "pages"); } catch (e) {}
      }
      gemeinsam([urlsAuftrag()], false);
      var ziel = S.root && S.root.querySelector(".uddr-tabellen");
      if (ziel && ziel.scrollIntoView) { try { ziel.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { ziel.scrollIntoView(); } }
    });
    /* Der Umschalter: Pages (URLs) oder Responses. Die gewaehlte Tabelle laedt, wenn sie fuer den
       aktuellen Filterstand noch nicht da ist. */
    s.addEventListener("uvwuvwSwitch", function (e) {
      var v = str(e.detail) === "responses" ? "responses" : "pages";
      if (v === S.tab) return;
      S.tab = v; tabZeigen();
      gemeinsam([tabellenAuftrag()], false);
    });
    /* URL-Tabelle (lokal, urls-table.js) */
    function urlsNeu(fn) { return function (d) { fn(d); S.urls.requestId = null; teilLaden("urls"); }; }
    an("uut-uutSearch", function (d) {
      S.urls.suche = str(d.query); S.urls.offset = 0;
      S.urls.requestId = d.requestId != null ? d.requestId : null;
      teilLaden("urls");
    });
    an("uut-uutSort", urlsNeu(function (d) { if (str(d.order)) S.urls.order = str(d.order); S.urls.offset = 0; }));
    an("uut-uutPage", urlsNeu(function (d) {
      var l = num(d.limit), o = num(d.offset);
      if (l != null && l > 0) S.urls.limit = Math.max(1, Math.min(100, Math.round(l)));
      if (o != null && o >= 0) S.urls.offset = Math.round(o);
    }));
    an("uut-uutFilter", urlsNeu(function (d) {
      var c = liste(d.citation_types), u = liste(d.url_types);
      S.urls.citationTypen = c.length ? c : null; S.urls.urlTypen = u.length ? u : null; S.urls.offset = 0;
    }));
    an("uut-uutMentioned", urlsNeu(function (d) { var l = liste(d.brands); S.urls.marken = l.length ? l : null; S.urls.offset = 0; }));
    an("uut-uutBrand", urlsNeu(function (d) {
      var v = str(d.brand_mentioned);
      S.urls.erwaehnt = v === "yes" || v === "no" ? v : "all"; S.urls.offset = 0;
    }));
    an("uut-uutRowClick", function (d) { var u = str(d.url).trim(); if (u && UC.drawerOeffnen) UC.drawerOeffnen("url", u, "domain-drawer"); });
    /* Responses-Tabelle (lokal, responses-table.js) -- wie brand-drawer.js */
    function respNeu(fn) { return function (d) { fn(d); S.resp.requestId = null; teilLaden("resp"); }; }
    an("urt-urtSearch", function (d) {
      S.resp.suche = str(d.query); S.resp.offset = 0;
      S.resp.requestId = d.requestId != null ? d.requestId : null;
      teilLaden("resp");
    });
    an("urt-urtSort", respNeu(function (d) { if (D.ORDER.responses.indexOf(str(d.order)) >= 0) S.resp.order = str(d.order); S.resp.offset = 0; }));
    an("urt-urtPage", respNeu(function (d) {
      var l = Number(d.limit), o = Number(d.offset);
      if (isFinite(l) && l > 0) S.resp.limit = Math.max(1, Math.min(100, Math.round(l)));
      if (isFinite(o) && o >= 0) S.resp.offset = Math.round(o);
    }));
    an("urt-urtFilter", respNeu(function (d) {
      function n(v) { var x = Number(v); return v == null || v === "" || !isFinite(x) ? null : x; }
      var ra = d.rank_active === true || d.rank_active === "true", sa = d.sent_active === true || d.sent_active === "true";
      S.resp.rankMin = ra ? n(d.rank_min) : null;
      S.resp.rankMax = ra && n(d.rank_max) != null && n(d.rank_max) < 20 ? n(d.rank_max) : null;
      S.resp.sentMin = sa ? n(d.sent_min) : null;
      S.resp.sentMax = sa ? n(d.sent_max) : null;
      S.resp.offset = 0;
    }));
    an("urt-urtMentioned", respNeu(function (d) { var l = liste(d.brands); S.resp.firmen = l.length ? l : null; S.resp.offset = 0; }));
    an("urt-urtBrand", respNeu(function (d) {
      var v = str(d.brand_mentioned);
      S.resp.erwaehnt = v === "yes" || v === "no" ? v : "all"; S.resp.offset = 0;
    }));
    an("urt-urtRowClick", function (d) { var id = str(d.prompt_run_id).trim(); if (id && UC.drawerOeffnen) UC.drawerOeffnen("response", id, "domain-drawer"); });

    /* EXPORT (wie prompt-detail): das Export-Fenster der App vor dem Klick einstellen, mit der
       Domain (domain -> p_domain, seit URL Detail). */
    s.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".uut-root .up-export, .urt-root .up-export") : null;
      var teil = b && b.closest(".uut-root, .urt-root");
      if (!teil) return;
      var ex = document.querySelector(".uex-root[data-instance]");
      var k = ex ? str(ex.getAttribute("data-instance")).trim() : "";
      if (!k || /^[A-Z_]{3,}$/.test(k) || typeof window.upstreemExportOpen !== "function") {
        e.stopPropagation();
        if (UC.toast) UC.toast(t("Export isn't available on this page"), { kind: "neutral" });
        return;
      }
      teil.setAttribute("data-export-instance", k);
      var typ = teil.classList.contains("urt-root") ? "prompt_runs" : "urls";
      try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, { export_type: typ, domain: S.domain }); } catch (err) {}
    }, true);
  }

  UC.kernDrawer("domain", {
    aufbauen: aufbauen,
    zeigen: function (id) {
      var dom = domainNorm(id);
      if (!dom) return;
      if (dom !== S.domain) {
        /* Eine andere Domain: Suche, Seiten und Auswahl gehoeren zur vorigen. Sortierung,
           Seitengroesse, Modus, D/W/M und der gewaehlte Reiter bleiben -- Vorlieben. */
        var altU = S.urls, altR = S.resp;
        S.domain = dom; S.zeile = null; S.fehler = "";
        S.urls = urlsStart(); S.urls.order = altU.order; S.urls.limit = altU.limit;
        S.resp = respStart(); S.resp.order = altR.order; S.resp.limit = altR.limit;
        try { setter("resetDomainDetail")(IDS.udd); } catch (e) {}
        ["resetUrlsTable", "resetResponsesTable"].forEach(function (n, i) {
          try { setter(n)([IDS.uut, IDS.urt][i]); } catch (e) {}
        });
        kopfZeichnen();
      }
      tabZeigen();
      var n = 0;
      (function warten() {
        if (!kalender() && n++ < 50) { setTimeout(warten, 30); return; }
        filterAbgleichen();
        alleLaden(false, true);
      })();
    },
    zu: function () { if (zaehltPop) { try { zaehltPop.close(); } catch (e) {} } }
  });
  }

  uddrBoot(50);
})();
