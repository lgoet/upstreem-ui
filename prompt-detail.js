/* upstreem prompt-detail.js -- der Prompt-Drawer aus core (12.10.). Praefix uprd.
   Braucht core.js, citations-data.js und dashboard-data.js.

   Ein Drawer der ERSTEN Ebene (#drawer-prompt, Hoehe und Bewegung aus der Huelle in core,
   KERN_DRAWER). Aufbau von oben, wie Response und URL:
     Kopf (core)   "Prompt / <Text>", Ask Mira, Anheften, Schliessen
     Meta-Zeile    Market, Topics, letzter Lauf -- aus prompt_detail_v1
     Titel         der Prompt-Text, vollstaendig
     Filterzeile   Kalender und Modelle. Maerkte und Topics nicht: ein Prompt HAT seinen Markt und
                   seine Topics, ein Filter darauf waere entweder leer oder wirkungslos.
     Visibility    der Visibility-Chart der App mit seiner Tabelle
     Top Citations die Top Citations der App (Ring und Liste)
     Responses     die Responses-Tabelle der App
   Die drei Bausteine sind die ECHTEN der App im lokalen Modus (data-local, Markup aus den
   Bubble-Vorlagen ueber .prompt_detail_markup.py), gefuellt mit DENSELBEN Anfragen wie das
   Dashboard (dashboard-data.js), dazu p_prompt_id. Das ist der Vorschlag an den DB-Chat
   (bubble/prompt_detail_db_auftrag.md); solange die Bubble-Gruppe #drawer-prompt steht, laeuft
   hier nichts.

   Was die ganze Ansicht betrifft (Oeffnen, Zeitraum, Modelle) geht gleichzeitig hinaus. Was nur
   einen Teil betrifft (D/W/M, Sortierung, Suche, Seite ...), laeuft allein. Der Lader aus
   citations-data.js nimmt ueberholte Anfragen zurueck und haelt Antworten im Speicher. */
(function () {
  "use strict";

  function uprdBoot(n) {
    if (!window.UpstreemCore || !window.UpstreemCitationsDaten || !window.UpstreemDashboardDaten) {
      if (n > 0) { setTimeout(function () { uprdBoot(n - 1); }, 100); return; }
      if (window.console) console.error("[prompt-detail] core.js, citations-data.js oder dashboard-data.js nicht geladen");
      return;
    }
    uprdStart();
  }

  /* ---- MARKUP ANFANG (erzeugt von .prompt_detail_markup.py -- nicht von Hand aendern) ---- */
  var MARKUP = {
    vot: "<div class=\"up-root vot-root\" data-local=\"yes\" data-instance=\"__UPRD_VOT__\" data-cdn-pin=\"\" data-isdark=\"__UPRD_DARK__\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"vot-unit vot-unit-left\"><div class=\"vot-head\"><div class=\"vot-heading\">Visibility over Time</div><div class=\"vot-head-tools\"><div class=\"vc-gran\" role=\"tablist\" aria-label=\"Granularity\"><button class=\"vc-gran-btn is-active\" data-gran=\"day\" type=\"button\" role=\"tab\" data-tip=\"Day\" aria-label=\"Day\">D</button><button class=\"vc-gran-btn\" data-gran=\"week\" type=\"button\" role=\"tab\" data-tip=\"Week\" aria-label=\"Week\">W</button><button class=\"vc-gran-btn\" data-gran=\"month\" type=\"button\" role=\"tab\" data-tip=\"Month\" aria-label=\"Month\">M</button></div><button class=\"vot-maximize vot-max-top vot-iconbtn\" type=\"button\" data-tip=\"Minimize\" aria-label=\"Minimize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button></div></div><div class=\"vot-box vot-box-left\"><div class=\"vot-panel-body\"><button class=\"vot-scale-btn\" type=\"button\" data-tip=\"Chart Settings\" aria-label=\"Chart Settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><div class=\"up-line-wrap\"><canvas class=\"up-line-canvas\"></canvas></div><div class=\"up-legend\"></div></div></div></div><div class=\"vot-unit vot-unit-right\"><div class=\"vot-head\"><div class=\"vot-heading vot-heading-right up-heading\"><span class=\"vot-head-label\">Top Brands</span><span class=\"vot-head-count up-head-count\"></span></div><div class=\"vot-head-tools\"><div class=\"vot-sort\"><button class=\"vot-sort-btn vot-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"vot-filter\"><button class=\"vot-filter-btn vot-iconbtn\" type=\"button\" data-tip=\"Filter brands\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg><span class=\"vot-filter-badge\"></span></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"vot-export vot-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"vot-maximize vot-max-right vot-iconbtn\" type=\"button\" data-tip=\"Maximize\" aria-label=\"Maximize\"><svg class=\"ic-max\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M15 3h6v6\"/><path d=\"m21 3-7 7\"/><path d=\"m3 21 7-7\"/><path d=\"M9 21H3v-6\"/></svg><svg class=\"ic-min\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m14 10 7-7\"/><path d=\"M20 10h-6V4\"/><path d=\"m3 21 7-7\"/><path d=\"M4 14h6v6\"/></svg></button><button class=\"vot-goto vot-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5\"/></svg></button></div></div><div class=\"vot-box vot-box-right\"><div class=\"vt-table\"></div></div></div></div>",
    tcd: "<div class=\"up-root tcd-root\" data-local=\"yes\" data-instance=\"__UPRD_TCD__\" data-cdn-pin=\"\" data-isdark=\"__UPRD_DARK__\" data-export-instance=\"\" data-processing=\"no\" data-processing2=\"no\"><div class=\"tcd-unit tcd-unit-left\"><div class=\"tcd-head\"><div class=\"tcd-mode\" role=\"tablist\" aria-label=\"Mode\"><button class=\"tcd-mode-btn is-active\" data-mode=\"domain\" type=\"button\" role=\"tab\">Domains</button><button class=\"tcd-mode-btn\" data-mode=\"url\" type=\"button\" role=\"tab\">URLs</button></div><div class=\"tcd-head-tools\"><div class=\"tcl-seg\" role=\"tablist\" aria-label=\"Chart type\"><button class=\"tcl-seg-btn is-active\" data-chart=\"doughnut\" role=\"tab\" aria-selected=\"true\" data-tip=\"Doughnut\" aria-label=\"Doughnut\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.5 15.8278C17.9985 21.756 9.86407 23.4835 5.20143 18.8641C0.629484 14.3347 2.04493 6.12883 8.05653 3.5\"/><path d=\"M17.6831 12.5C19.5708 12.5 20.5146 12.5 21.1241 11.655C21.1469 11.6234 21.1848 11.5667 21.2052 11.5336C21.7527 10.6471 21.4705 9.966 20.9063 8.60378C20.3946 7.36853 19.6447 6.24615 18.6993 5.30073C17.7538 4.35531 16.6315 3.60536 15.3962 3.0937C14.034 2.52946 13.3529 2.24733 12.4664 2.79477C12.4333 2.81523 12.3766 2.85309 12.345 2.87587C11.5 3.4854 11.5 4.42922 11.5 6.31686V8.42748C11.5 10.3473 11.5 11.3072 12.0964 11.9036C12.6928 12.5 13.6527 12.5 15.5725 12.5H17.6831Z\"/></svg></button><button class=\"tcl-seg-btn\" data-chart=\"bar\" role=\"tab\" aria-selected=\"false\" data-tip=\"Bars\" aria-label=\"Bars\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M3 3V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H21\"/><path d=\"M7 8V9C7 9.55228 7.44772 10 8 10H18C18.5523 10 19 9.55228 19 9V8C19 7.44772 18.5523 7 18 7H8C7.44772 7 7 7.44772 7 8Z\"/><path d=\"M7 15V16C7 16.5523 7.44772 17 8 17H14C14.5523 17 15 16.5523 15 16V15C15 14.4477 14.5523 14 14 14H8C7.44772 14 7 14.4477 7 15Z\"/></svg></button></div></div></div><div class=\"tcd-box\"><div class=\"tcd-panel-body\"><div class=\"tcl-top-total\"><span class=\"n\">0</span><span class=\"lbl\">Citations</span></div><div class=\"up-donut-body\"></div></div></div></div><div class=\"tcd-unit tcd-unit-right\"><div class=\"tcd-head\"><div class=\"tcd-heading tcd-heading-right up-heading\"><span class=\"tcd-head-label\">Top Domains</span><span class=\"tcd-head-count up-head-count\"></span></div><div class=\"tcd-head-tools\"><button class=\"tcd-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"tcd-brand-toggle-lbl\"><img class=\"tcd-brand-logo\" src=\"\" style=\"display:none\"/><span class=\"tcd-brand-label\"></span></span><span class=\"tcd-brand-check\"><svg class=\"tcd-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"tcd-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"tcd-filter\"><button class=\"tcd-filter-btn tcd-iconbtn\" type=\"button\" data-tip=\"Filter\" aria-label=\"Filter\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg><span class=\"tcd-filter-badge\"></span></button><div class=\"up-filter-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><button class=\"tcd-export tcd-iconbtn\" type=\"button\" data-tip=\"Export\" aria-label=\"Export\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg></button><button class=\"tcd-goto tcd-iconbtn\" type=\"button\" data-tip=\"Open\" aria-label=\"Open\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 6.65032C9 6.65032 15.9383 6.10759 16.9154 7.08463C17.8924 8.06167 17.3496 15 17.3496 15M16.5 7.5L6.5 17.5\"/></svg></button></div></div><div class=\"tcd-box\"><div class=\"tct-table\"></div></div></div></div>",
    urt: "<div class=\"up-root urt-root\" data-local=\"yes\" data-merken=\"yes\" data-instance=\"__UPRD_URT__\" data-cdn-pin=\"\" data-isdark=\"__UPRD_DARK__\" data-brand-name=\"__UPRD_BRAND__\" data-brand-logo=\"__UPRD_BRANDLOGO__\" data-spotlight-mode=\"no\" data-export-instance=\"\" data-sticky-top=\"16\" data-sticky=\"no\" data-default-view=\"table\"><div class=\"up-head\"><div class=\"up-heading\"><span class=\"up-head-label\">Responses</span><span class=\"up-head-sep\"></span><span class=\"up-head-count\"></span></div><div class=\"up-head-tools\"><button class=\"urt-brand-toggle\" type=\"button\" data-tip=\"Filter for your brand mentions\"><span class=\"urt-brand-toggle-lbl\"><img class=\"urt-brand-logo\" src=\"\" style=\"display:none\" alt=\"\"/><span class=\"urt-brand-label\"></span></span><span class=\"urt-brand-check\"><svg class=\"urt-brand-check-yes\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M5 13.2592L7.58583 15.9568C8.2525 16.6523 8.58583 17 9.00004 17C9.41425 17 9.74759 16.6523 10.4143 15.9568L19 7\"/></svg><svg class=\"urt-brand-check-no\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20.9922 12L2.99219 12\"/></svg></span></button><div class=\"up-ment\"><button class=\"up-ment-btn\" type=\"button\" data-tip=\"Filter for brand mentions\" aria-haspopup=\"menu\" aria-expanded=\"false\"><span class=\"up-ment-lbl\">All Brands</span><svg class=\"up-ment-chev\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg><svg class=\"up-ment-clear\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button><div class=\"up-ment-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- Reihenfolge: Sorter VOR dem Fader, also von rechts gelesen der Fader vor dem Sorter. core.js ordnet die Leiste zur Laufzeit ohnehin (orderToolbars) -- hier steht sie richtig, damit eine Neuinstallation nicht erst umsortiert werden muss. --><div class=\"up-sort\"><button class=\"up-sort-btn up-iconbtn\" type=\"button\" data-tip=\"Sort\" aria-label=\"Sort\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m3 16 4 4 4-4\"/><path d=\"M7 20V4\"/><path d=\"m21 8-4-4-4 4\"/><path d=\"M17 4v16\"/></svg></button><div class=\"up-sort-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- lucide \"settings-2\" \u2014 the SAME filter glyph visibility-chart / topcitations / combo-chart use. .up-iconbtn makes it behave like every other toolbar icon button. --><div class=\"urt-fader\"><button class=\"urt-fader-btn up-iconbtn\" type=\"button\" data-tip=\"Filter by rank &amp; sentiment\" aria-label=\"Filter by rank and sentiment\" aria-haspopup=\"menu\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M7 21L7 18\"/><path d=\"M17 21L17 15\"/><path d=\"M17 6L17 3\"/><path d=\"M7 9L7 3\"/><path d=\"M7 18C6.06812 18 5.60218 18 5.23463 17.8478C4.74458 17.6448 4.35523 17.2554 4.15224 16.7654C4 16.3978 4 15.9319 4 15C4 14.0681 4 13.6022 4.15224 13.2346C4.35523 12.7446 4.74458 12.3552 5.23463 12.1522C5.60218 12 6.06812 12 7 12C7.93188 12 8.39782 12 8.76537 12.1522C9.25542 12.3552 9.64477 12.7446 9.84776 13.2346C10 13.6022 10 14.0681 10 15C10 15.9319 10 16.3978 9.84776 16.7654C9.64477 17.2554 9.25542 17.6448 8.76537 17.8478C8.39782 18 7.93188 18 7 18Z\"/><path d=\"M17 12C16.0681 12 15.6022 12 15.2346 11.8478C14.7446 11.6448 14.3552 11.2554 14.1522 10.7654C14 10.3978 14 9.93188 14 9C14 8.06812 14 7.60218 14.1522 7.23463C14.3552 6.74458 14.7446 6.35523 15.2346 6.15224C15.6022 6 16.0681 6 17 6C17.9319 6 18.3978 6 18.7654 6.15224C19.2554 6.35523 19.6448 6.74458 19.8478 7.23463C20 7.60218 20 8.06812 20 9C20 9.93188 20 10.3978 19.8478 10.7654C19.6448 11.2554 19.2554 11.6448 18.7654 11.8478C18.3978 12 17.9319 12 17 12Z\"/></svg></button><div class=\"urt-fader-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><div class=\"up-search\"><button class=\"up-search-btn up-iconbtn\" type=\"button\" data-tip=\"Search\" aria-label=\"Search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M17 17L21 21\"/><path d=\"M19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19C15.4183 19 19 15.4183 19 11Z\"/></svg></button><div class=\"up-search-box\"><input class=\"up-search-input\" type=\"text\" placeholder=\"Search prompts...\" autocomplete=\"off\" spellcheck=\"false\" aria-label=\"Search responses\"/><button class=\"up-search-clear\" type=\"button\" aria-label=\"Clear search\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 6L6.00081 17.9992M17.9992 18L6 6.00085\"/></svg></button></div></div><div class=\"up-cols\"><button class=\"up-cols-btn up-iconbtn\" type=\"button\" data-tip=\"Table Settings\" aria-label=\"Table settings\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M2.5 12C2.5 7.52166 2.5 5.28249 3.89124 3.89124C5.28249 2.5 7.52166 2.5 12 2.5C16.4783 2.5 18.7175 2.5 20.1088 3.89124C21.5 5.28249 21.5 7.52166 21.5 12C21.5 16.4783 21.5 18.7175 20.1088 20.1088C18.7175 21.5 16.4783 21.5 12 21.5C7.52166 21.5 5.28249 21.5 3.89124 20.1088C2.5 18.7175 2.5 16.4783 2.5 12Z\"/><path d=\"M8.5 10C7.67157 10 7 9.32843 7 8.5C7 7.67157 7.67157 7 8.5 7C9.32843 7 10 7.67157 10 8.5C10 9.32843 9.32843 10 8.5 10Z\"/><path d=\"M15.5 17C16.3284 17 17 16.3284 17 15.5C17 14.6716 16.3284 14 15.5 14C14.6716 14 14 14.6716 14 15.5C14 16.3284 14.6716 17 15.5 17Z\"/><path d=\"M10 8.5L17 8.5\"/><path d=\"M14 15.5L7 15.5\"/></svg></button><span class=\"urt-cols-badge\"></span><div class=\"up-cols-menu\" role=\"menu\" aria-hidden=\"true\"></div></div><!-- .up-dense / .up-dense-btn are core's segmented control \u2014 the same one the Row Height picker uses. Reused verbatim so this switcher IS the app's switcher, not a lookalike. .urt-viewswitch only overrides the width (core's is full-width for the popover). --><div class=\"up-dense urt-viewswitch\" role=\"group\" aria-label=\"View\"><button class=\"up-dense-btn up-dense-btn-icon is-active\" type=\"button\" data-view=\"table\" data-tip=\"Table view\" aria-label=\"Table view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18\"/></svg></button><button class=\"up-dense-btn up-dense-btn-icon\" type=\"button\" data-view=\"cards\" data-tip=\"Card view\" aria-label=\"Card view\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 4V20\"/><path d=\"M18 4V20\"/><path d=\"M21 7L3 7\"/><path d=\"M21 17L3 17\"/></svg></button></div><button class=\"up-export\" type=\"button\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 15V3\" /><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /><path d=\"m7 10 5 5 5-5\" /></svg><span>Export</span></button></div></div><div class=\"up-box\"><div class=\"up-table\"><div class=\"up-thead\"><!-- The lead column's resize grip. Every other table has one; without it the first column simply cannot be dragged (core's resize kit binds to .up-grip). --><div class=\"up-th up-th-prompt\">Prompt<span class=\"up-grip\" data-grip=\"prompt\"></span></div><!-- \"<brand logo> mentioned?\", identical to urls-table: the logo is filled in from data-brand-logo, and without one the label falls back to \"<brand name> mentioned?\" --><div class=\"up-th up-th-mentioned\"><img class=\"up-th-brandlogo\" src=\"\" alt=\"\" style=\"display:none\"/><span class=\"up-th-mentlbl\">Mentioned</span></div><div class=\"up-th up-th-sentiment is-sortable\" data-sortcol=\"sentiment\"><span class=\"up-th-txt\">Sentiment</span><span class=\"up-thsort\" data-for=\"sentiment\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-rank is-sortable\" data-sortcol=\"rank\"><span class=\"up-th-txt\">Rank</span><span class=\"up-thsort\" data-for=\"rank\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div><div class=\"up-th up-th-brands\">Brand Mentions</div><div class=\"up-th up-th-citations\">Citations</div><div class=\"up-th up-th-model\">Model</div><div class=\"up-th up-th-date is-sortable\" data-sortcol=\"date\"><span class=\"up-th-txt\">Date</span><span class=\"up-thsort\" data-for=\"date\"><svg class=\"up-thsort-up\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 15C18 15 13.5811 9.00001 12 9C10.4188 8.99999 6 15 6 15\"/></svg><svg class=\"up-thsort-down\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M18 9.00005C18 9.00005 13.5811 15 12 15C10.4188 15 6 9 6 9\"/></svg></span></div></div><div class=\"up-tbody\"></div></div></div><div class=\"urt-cards\"></div><div class=\"up-foot\"><div class=\"up-pagesize\"><span class=\"up-pagesize-lbl\">Rows per page</span><div class=\"up-pagesize-seg\" role=\"group\" aria-label=\"Rows per page\"></div></div><div class=\"up-pager\"></div></div></div>"
  };
  /* ---- MARKUP ENDE ---- */

  function uprdStart() {
  var UC = window.UpstreemCore, D = window.UpstreemDashboardDaten;
  var esc = UC.esc, t = UC.t || function (x) { return x; };
  if (!UC.kernDrawer) return;

  function isArr(v) { return Object.prototype.toString.call(v) === "[object Array]"; }
  function str(v) { return v == null || typeof v === "object" ? "" : String(v); }
  function liste(s) { return String(s == null ? "" : s).split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function setter(name) { return typeof window[name] === "function" ? window[name] : function () {}; }
  function dunkel() { try { return (window.getUpstreemTheme ? window.getUpstreemTheme() : "") === "dark"; } catch (e) { return false; } }
  function eigeneMarke() {
    var l = UC.getBrands ? UC.getBrands() : [];
    for (var i = 0; i < l.length; i++) if (l[i] && (str(l[i].role).toLowerCase() === "own" || l[i].is_own === true)) return l[i];
    return null;
  }
  function teamWarten() { return UC.teamWarten ? UC.teamWarten(10000) : Promise.resolve(UC.getTeam ? UC.getTeam() : ""); }

  var FN = { kopf: "prompt_detail_v1" };
  var IDS = { daten: "drawer-prompt-daten", filter: "drawer-prompt-filter", modelle: "drawer-prompt-models",
              vot: "drawer-prompt-visibility", tcd: "drawer-prompt-topcitations", urt: "drawer-prompt-responses" };

  var P = {
    slot: null, root: null, kopf: null, id: "", zeile: null, nr: 0, ab: null,
    lader: D.makeLader({ rufen: function (fn, params, o) { return UC.rpc(fn, params, { signal: o && o.signal, timeoutMs: 60000 }); } }),
    f: { von: "", bis: "", modelle: null }, gran: "day",
    vis: { order: "visibility_desc", firmen: null }, autoFirmen: [],
    top: { modus: "domain", erwaehnt: "all", citationTypen: null, urlTypen: null },
    resp: null, eigene: null, kopfSpeicher: {}
  };
  function respStart() {
    return { order: "run_at_desc", limit: 15, offset: 0, suche: "", requestId: null, erwaehnt: "all",
             firmen: null, sentMin: null, sentMax: null, rankMin: null, rankMax: null };
  }
  P.resp = respStart();

  /* Die Anfragen des Dashboards, eingeschraenkt auf diesen Prompt: dieselben Parameter, dazu
     p_prompt_id -- und eine eigene Signatur, damit der Speicher des Laders Prompts nicht mischt. */
  function mitPrompt(a) {
    var p = {}, k;
    for (k in a.params) p[k] = a.params[k];
    p.p_prompt_id = P.id;
    return { art: a.art, fn: a.fn, params: p, sig: a.fn + "|" + JSON.stringify(p) };
  }
  function filterStand() {
    return { team: UC.getTeam ? UC.getTeam() : "", von: P.f.von, bis: P.f.bis, modelle: P.f.modelle,
             maerkte: null, topics: null, tagmode: "or" };
  }
  function marke() { return eigeneMarke() || P.eigene || null; }

  /* ---- Der Kopf (Meta-Zeile, Titel) und die Kopfleiste ---- */
  function kopfZeichnen() {
    var r = P.root;
    if (!r) return;
    var meta = r.querySelector(".uprd-meta"), titel = r.querySelector(".uprd-titel"), d = P.zeile;
    r.classList.toggle("is-fehler", !!P.fehler);
    var fehlerEl = r.querySelector(".uprd-fehler");
    fehlerEl.hidden = !P.fehler;
    if (P.fehler) {
      fehlerEl.innerHTML = UC.leerHtml({ icon: "info", titel: "Prompt not available", text: P.fehler,
        knopf: P.fehlerWiederholbar ? "Try again" : "", knopfAttr: "data-uprd-retry" });
      if (P.kopf) { P.kopf.name(""); P.kopf.eigen.innerHTML = ""; }
      return;
    }
    if (!d) {
      meta.innerHTML = '<span class="uprd-skz is-m"></span><span class="uprd-skz is-s"></span>';
      titel.innerHTML = '<span class="uprd-skz is-titel"></span><span class="uprd-skz is-titel2"></span>';
      if (P.kopf) { P.kopf.name(null); P.kopf.eigen.innerHTML = ""; }
      return;
    }
    var teile = [];
    if (d.market && UC.marketChip) teile.push(UC.marketChip(str(d.market)));
    var tags = isArr(d.tags) ? d.tags.filter(function (x) { return x && x.name; }) : [];
    if (tags.length) teile.push('<span class="uprd-tags">' + tags.map(topicChip).join("") + '</span>');
    var lauf = str(d.last_run_at);
    if (lauf && UC.relativeTime) teile.push('<span class="uprd-zeit" data-tip="' + esc(lauf) + '">' +
      esc(t("Last run {when}").replace("{when}", UC.relativeTime(lauf))) + '</span>');
    meta.innerHTML = teile.join('<span class="up-dk-sep" aria-hidden="true"></span>');
    titel.textContent = str(d.prompt_text) || "–";
    if (P.kopf) {
      P.kopf.name(str(d.prompt_text));
      var html = "";
      if (UC.anMira && UC.miraBezug) html += knopf("mira", "blend", "Ask Mira about this");
      if (typeof window.upstreemPinToSidebar === "function") html += knopf("pin", "pin", "Pin to sidebar");
      P.kopf.eigen.innerHTML = html;
    }
  }
  function knopf(art, zeichen, label) {
    return '<button type="button" class="up-iconbtn" data-uprd-kopf="' + art + '" data-tip="' + esc(t(label)) +
      '" aria-label="' + esc(t(label)) + '">' + UC.icon(zeichen, 2) + '</button>';
  }
  /* Ein Thema als .up-topicchip aus core -- dieselbe Form wie in Response Detail und der
     Prompts-Tabelle. Die Farbe kommt aus der Antwort (hex_light/hex_dark), sonst aus dem Store. */
  function topicChip(x) {
    var farbe = dunkel() ? (x.hex_dark || x.hex_light) : (x.hex_light || x.hex_dark);
    if (!farbe && UC.getTopics) {
      var l = UC.getTopics() || [];
      for (var i = 0; i < l.length; i++) if (l[i] && String(l[i].id) === String(x.id)) { farbe = l[i].color; break; }
    }
    return '<span class="up-topicchip is-static"' + (farbe ? ' style="--ust-tag-color:' + esc(str(farbe)) + '"' : "") + '>' +
      (x.emoji ? '<span class="up-topicchip-e">' + esc(str(x.emoji)) + '</span>' : "") +
      '<span class="up-topicchip-lbl">' + esc(str(x.name)) + '</span></span>';
  }
  function kopfKlick(art) {
    var d = P.zeile || {};
    if (art === "mira" && UC.anMira && UC.miraBezug) {
      var b = UC.miraBezug({ type: "prompt", id: P.id, prompt_text: str(d.prompt_text), market: str(d.market) });
      if (b) UC.anMira(b, ["prompt"]);
    } else if (art === "pin" && typeof window.upstreemPinToSidebar === "function") {
      /* Beim Prompt ist das Bild in der Seitenleiste die Flagge seines Marktes -- wie Quick Actions
         und die alte Topbar es tun (drawer-topbar.js, anheften). */
      var bild = d.market && UC.flagUrl ? UC.flagUrl(str(d.market)) : "";
      try { window.upstreemPinToSidebar({ type: "prompt", id: P.id, label: str(d.prompt_text) || P.id, logo: bild }); } catch (e) {}
    }
  }
  function fehlerText(code) {
    var c = String(code || "").trim();
    if (c === "prompt_not_found" || c === "team_invalid_param") return "This prompt could not be found.";
    if (c === "settings_not_authenticated" || c === "not authenticated") return "Your session has expired. Please sign in again.";
    if (c === "team_deleted") return "This team has been deleted.";
    if (/^team_access_/.test(c) || c === "forbidden" || c === "team_forbidden") return "Your team doesn't have access right now.";
    if (c === "prompt_rate_limited") return "Too many requests in a short time. Please wait a moment.";
    return "This prompt could not be loaded. Please try again.";
  }
  function wiederholbar(code) {
    var c = String(code || "").trim();
    return !(c === "prompt_not_found" || c === "team_invalid_param" || /^team_access_/.test(c) || c === "forbidden" ||
      c === "team_forbidden" || c === "team_deleted" || c === "not authenticated" || c === "settings_not_authenticated");
  }
  /* Der Kopf haengt nicht am Zeitraum: einmal je Prompt, aus dem Speicher beim Wiederoeffnen. */
  function kopfLaden(frisch) {
    var id = P.id;
    if (!frisch && P.kopfSpeicher[id]) { P.zeile = P.kopfSpeicher[id]; P.fehler = ""; kopfZeichnen(); return; }
    P.zeile = null; P.fehler = ""; kopfZeichnen();
    if (P.ab) { try { P.ab.abort(); } catch (e) {} }
    var ab = typeof AbortController !== "undefined" ? new AbortController() : null;
    P.ab = ab;
    var nr = ++P.nr;
    teamWarten().then(function (team) {
      if (nr !== P.nr) return null;
      if (!team) return { ok: false, status: 0, fehler: { message: "not authenticated" } };
      return UC.rpc(FN.kopf, { p_team: team, p_prompt_id: id }, { timeoutMs: 60000, signal: ab ? ab.signal : undefined });
    }).then(function (erg) {
      if (!erg || nr !== P.nr) return;
      var roh = erg.ok ? erg.daten : null;
      if (isArr(roh)) roh = roh.length ? roh[0] : null;
      var d = roh && roh.row && typeof roh.row === "object" ? roh.row : roh;
      if (d && typeof d === "object" && d.prompt_text != null) {
        P.kopfSpeicher[id] = d; P.zeile = d; P.fehler = ""; kopfZeichnen(); return;
      }
      var code = erg.ok ? "" : str((erg.fehler && (erg.fehler.message || erg.fehler.code)) || "");
      if (window.console) console.warn("[prompt-detail] " + FN.kopf + " fuer " + id + ": " + (code || "Antwort nicht lesbar") +
        (erg.status ? " (HTTP " + erg.status + ")" : ""));
      P.zeile = null; P.fehler = t(fehlerText(code)); P.fehlerWiederholbar = wiederholbar(code);
      kopfZeichnen();
    });
  }

  /* ---- Die drei Bausteine (wie dashboard-page.js, mit p_prompt_id) ---- */
  function laden(paare, frisch) {
    return Promise.all(paare.map(function (p) { return P.lader.laden(p[0], p[1], { frisch: !!frisch }); }));
  }
  function eigeneMerken(daten) {
    var o = daten && daten.own;
    if (!o || typeof o !== "object" || !o.name) return;
    P.eigene = { company_id: str(o.company_id), name: str(o.name), logo_url: str(o.logo_url) };
  }
  function visLaden(frisch) {
    var f = filterStand(), manuell = P.vis.firmen;
    var vis = mitPrompt(D.visibility(f, { gran: P.gran, firmen: manuell }));
    var ov = mitPrompt(D.overview(f, manuell ? { order: P.vis.order, limit: 10, firmen: manuell } : { order: P.vis.order, limit: 7 }));
    setter("setVisibilityChartLoading")(IDS.vot, "yes");
    return laden([["vis_chart", vis], ["vis_tabelle", ov]], frisch).then(function (e) {
      if (e.some(function (x) { return x.ueberholt; })) return;
      var p = e[0].ok && e[1].ok ? D.zuVisibility(e[0].daten, e[1].daten, { nurImChart: !!manuell }) : null;
      if (e[1].ok) eigeneMerken(e[1].daten);
      if (!p) setter("renderVisibilityChart")({ instanceId: IDS.vot, __parseError: true });
      else {
        if (!P.vis.firmen) P.autoFirmen = p.companies.map(function (c) { return c.company_id; });
        p.instanceId = IDS.vot; p.isDark = dunkel();
        setter("renderVisibilityChart")(p);
      }
      setter("setVisibilityChartLoading")(IDS.vot, "no");
    });
  }
  function topLaden(frisch) {
    var f = filterStand(), m = P.top.modus, tp = P.top;
    var typen = mitPrompt(D.topTypen(f, m, { erwaehnt: tp.erwaehnt }));
    var list = mitPrompt(D.topListe(f, m, { erwaehnt: tp.erwaehnt, citationTypen: tp.citationTypen, urlTypen: m === "url" ? tp.urlTypen : null, limit: 7 }));
    setter("setTopCitationsLoading")(IDS.tcd, "yes");
    return laden([["top_typen", typen], ["top_liste", list]], frisch).then(function (e) {
      if (e.some(function (x) { return x.ueberholt; })) return;
      var p = e[0].ok && e[1].ok ? D.zuTop(e[0].daten, e[1].daten, m) : null;
      if (!p) setter("renderTopCitations")({ instanceId: IDS.tcd, __parseError: true });
      else {
        var mk = marke();
        p.instanceId = IDS.tcd; p.isDark = dunkel();
        if (mk) p.brand = { id: str(mk.company_id || mk.id), name: str(mk.name), logo: str(mk.logo_url) };
        setter("renderTopCitations")(p);
      }
      setter("setTopCitationsLoading")(IDS.tcd, "no");
    });
  }
  function respLaden(frisch) {
    var teile = D.responsesTeile(filterStand(), P.resp).map(mitPrompt), reqId = P.resp.requestId;
    setter("setResponsesTableLoading")(IDS.urt, "yes");
    return laden(teile.map(function (a, i) { return ["resp_" + i, a]; }), frisch).then(function (e) {
      if (e.some(function (x) { return x.ueberholt; })) return;
      var ok = e.every(function (x) { return x.ok; });
      var p = ok ? D.zuResponses(e.map(function (x) { return x.daten; })) : null;
      if (!p) setter("renderResponsesTable")({ instanceId: IDS.urt, __parseError: true });
      else {
        var mk = marke();
        p.instanceId = IDS.urt; p.isDark = dunkel();
        if (reqId != null) p.requestId = reqId;
        if (mk) { p.brand_name = str(mk.name); p.brand_logo = str(mk.logo_url); }
        setter("renderResponsesTable")(p);
      }
      setter("setResponsesTableLoading")(IDS.urt, "no");
    });
  }
  var TEIL = { vis: visLaden, top: topLaden, resp: respLaden };
  function alleLaden(frisch) {
    if (!P.id) return;
    teamWarten().then(function (team) {
      if (!team) return;
      visLaden(frisch); topLaden(frisch); respLaden(frisch);
    });
  }
  /* Einzelteile gebuendelt (80ms, wie das Dashboard): wer D/W/M oder die Sortierung durchklickt,
     schickt eine Anfrage, nicht zehn. */
  var teilUhren = {};
  function teilLaden(teil) {
    clearTimeout(teilUhren[teil]);
    teilUhren[teil] = setTimeout(function () { teilUhren[teil] = null; if (P.id) TEIL[teil](false); }, 80);
  }

  /* ---- Filter: Kalender und Modelle (lokal, ihre Auswahl kommt als DOM-Ereignis) ---- */
  function setzen(feld, wert) {
    var alt = JSON.stringify(P.f[feld] == null ? null : P.f[feld]);
    if (alt === JSON.stringify(wert == null ? null : wert)) return false;
    P.f[feld] = wert;
    return true;
  }
  function modellAuswahl(d) {
    var gew = liste(d && d.model_keys);
    if (!gew.length) return null;
    if (d.select_mode !== "exclude") return gew;
    return (UC.getModels ? UC.getModels() : []).map(function (m) { return str(m.key || m.model); })
      .filter(function (k) { return k && gew.indexOf(k) < 0; });
  }
  function kalender() { var k = P.slot && P.slot.querySelector(".uprd-daten"); return k && k.__udrCtrl ? k.__udrCtrl : null; }
  /* Die Stufe des Charts folgt jedem neuen Zeitraum (UC.granFuerZeitraum), wie auf dem Dashboard. */
  function zeitraum(von, bis) {
    var a = setzen("von", von), b = setzen("bis", bis);
    if ((a || b) && UC.granFuerZeitraum) { var g = UC.granFuerZeitraum(von, bis); if (g) P.gran = g; }
    return a || b;
  }
  function kalenderLesen() {
    var c = kalender(), r = null;
    try { r = c && c.getRange ? c.getRange() : null; } catch (e) { r = null; }
    return r && r.from && r.to ? zeitraum(r.from, r.to) : false;
  }
  var filterUhr = null;
  function filterGeaendert() {
    P.resp.offset = 0;
    clearTimeout(filterUhr);
    filterUhr = setTimeout(function () { filterUhr = null; alleLaden(false); }, 120);
  }

  /* ---- Aufbau im Drawer ---- */
  function einsetzen(m) {
    var mk = marke();
    return String(m || "").split("__UPRD_VOT__").join(esc(IDS.vot))
      .split("__UPRD_TCD__").join(esc(IDS.tcd)).split("__UPRD_URT__").join(esc(IDS.urt))
      .split("__UPRD_DARK__").join(dunkel() ? "yes" : "no")
      .split("__UPRD_BRANDLOGO__").join(esc(mk ? str(mk.logo_url) : ""))
      .split("__UPRD_BRAND__").join(esc(mk ? str(mk.name) : ""));
  }
  function aufbauen(ctx) {
    var dk = dunkel() ? "yes" : "no";
    ctx.slot.innerHTML =
      '<div class="up-root uprd-root">' +
        '<div class="uprd-head up-dk">' +
          '<div class="uprd-meta up-dk-meta"></div>' +
          '<h2 class="uprd-titel up-dk-titel"></h2>' +
          /* Filterzeile wie auf den Seiten: links unter dem Kopf, ueber dem, was sie filtert. Nur
             Modelle: Topics und Maerkte stehen per Attribut aus (data-*-visible). */
          '<div class="uprd-filterzeile">' +
            '<div class="up-root udr-root uprd-daten" data-instance="' + esc(IDS.daten) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
            '<div class="up-root ufb-root uprd-filterleiste" data-instance="' + esc(IDS.filter) + '"' +
              ' data-models-instance="' + esc(IDS.modelle) + '" data-topics-visible="no" data-markets-visible="no" data-isdark="' + dk + '"></div>' +
            '<div class="up-root umf-root" data-instance="' + esc(IDS.modelle) + '" data-local="yes" data-isdark="' + dk + '"></div>' +
          '</div>' +
        '</div>' +
        '<div class="uprd-main">' +
          '<div class="uprd-teil uprd-vis">' + einsetzen(MARKUP.vot) + '</div>' +
          '<div class="uprd-teil uprd-top">' + einsetzen(MARKUP.tcd) + '</div>' +
          '<div class="uprd-teil uprd-resp">' + einsetzen(MARKUP.urt) + '</div>' +
        '</div>' +
        '<div class="uprd-fehler" hidden></div>' +
      '</div>';
    P.slot = ctx.slot; P.kopf = ctx; P.root = ctx.slot.querySelector(".uprd-root");
    if (UC.makeTooltips) UC.makeTooltips(P.root, dunkel);
    var s = ctx.slot;
    ctx.eigen.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-uprd-kopf]") : null;
      if (b) kopfKlick(b.getAttribute("data-uprd-kopf"));
    });
    s.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-uprd-retry]")) { kopfLaden(true); alleLaden(true); }
    });
    /* Kalender: nur ein WIRKLICH anderer Zeitraum (er meldet sich auch beim Einrichten). */
    s.addEventListener("change", function (e) {
      if (!e.target || !e.target.classList || !e.target.classList.contains("uprd-daten")) return;
      var d = e.detail || {};
      if (!d.date_from || !d.date_to) return;
      if (zeitraum(d.date_from, d.date_to)) filterGeaendert();
    });
    s.addEventListener("umf-models", function (e) { if (setzen("modelle", modellAuswahl(e.detail))) filterGeaendert(); });

    function an(name, fn) { s.addEventListener(name, function (e) { fn(e.detail || {}); }); }
    function wert(d) { return d && d.value != null ? d.value : ""; }
    an("vot-votGranularity", function (d) {
      var g = str(wert(d));
      if ((g !== "day" && g !== "week" && g !== "month") || g === P.gran) return;
      P.gran = g; teilLaden("vis");
    });
    an("vot-votSortTable", function (d) {
      var o = str(wert(d));
      if (D.ORDER.overview.indexOf(o) < 0 || o === P.vis.order) return;
      P.vis.order = o; teilLaden("vis");
    });
    an("vot-votSubmitCompanies", function (d) {
      var l = liste(wert(d)).filter(function (x) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x); }).slice(0, 10);
      var auto = P.autoFirmen || [];
      var gleich = l.length === auto.length && l.every(function (x) { return auto.indexOf(x) >= 0; });
      var neu = !l.length || gleich ? null : l;
      if (JSON.stringify(neu) === JSON.stringify(P.vis.firmen)) return;
      P.vis.firmen = neu; teilLaden("vis");
    });
    an("vot-votRowClick", function (d) { var id = str(wert(d)).trim(); if (id && UC.drawerOeffnen) UC.drawerOeffnen("brand", id, "prompt-detail"); });
    an("tcd-tcdMode", function (d) {
      var m = wert(d) === "url" ? "url" : "domain";
      if (m === P.top.modus) return;
      P.top.modus = m; teilLaden("top");
    });
    an("tcd-tcdApplyTypeFilter", function (d) {
      var teile = str(wert(d)).split(";"), c = liste(teile[0]), u = liste(teile[1]);
      P.top.citationTypen = c.length ? c : null; P.top.urlTypen = u.length ? u : null;
      teilLaden("top");
    });
    an("tcd-tcdBrandMentioned", function (d) {
      var v = str(wert(d));
      P.top.erwaehnt = v === "yes" || v === "no" ? v : "all";
      teilLaden("top");
    });
    an("tcd-tcdRowClick", function (d) {
      var id = str(wert(d)).trim();
      if (id && UC.drawerOeffnen) UC.drawerOeffnen(P.top.modus === "url" ? "url" : "domain", id, "prompt-detail");
    });
    function respNeu(fn) { return function (d) { fn(d); P.resp.requestId = null; teilLaden("resp"); }; }
    an("urt-urtSearch", function (d) {
      P.resp.suche = str(d.query); P.resp.offset = 0;
      P.resp.requestId = d.requestId != null ? d.requestId : null;
      teilLaden("resp");
    });
    an("urt-urtSort", respNeu(function (d) { if (D.ORDER.responses.indexOf(str(d.order)) >= 0) P.resp.order = str(d.order); P.resp.offset = 0; }));
    an("urt-urtPage", respNeu(function (d) {
      var l = Number(d.limit), o = Number(d.offset);
      if (isFinite(l) && l > 0) P.resp.limit = Math.max(1, Math.min(100, Math.round(l)));
      if (isFinite(o) && o >= 0) P.resp.offset = Math.round(o);
    }));
    an("urt-urtFilter", respNeu(function (d) {
      function n(v) { var x = Number(v); return v == null || v === "" || !isFinite(x) ? null : x; }
      var ra = d.rank_active === true || d.rank_active === "true", sa = d.sent_active === true || d.sent_active === "true";
      P.resp.rankMin = ra ? n(d.rank_min) : null;
      P.resp.rankMax = ra && n(d.rank_max) != null && n(d.rank_max) < 20 ? n(d.rank_max) : null;
      P.resp.sentMin = sa ? n(d.sent_min) : null;
      P.resp.sentMax = sa ? n(d.sent_max) : null;
      P.resp.offset = 0;
    }));
    an("urt-urtMentioned", respNeu(function (d) { var l = liste(d.brands); P.resp.firmen = l.length ? l : null; P.resp.offset = 0; }));
    an("urt-urtBrand", respNeu(function (d) {
      var v = str(d.brand_mentioned);
      P.resp.erwaehnt = v === "yes" || v === "no" ? v : "all"; P.resp.offset = 0;
    }));
    an("urt-urtRowClick", function (d) { var id = str(d.prompt_run_id).trim(); if (id && UC.drawerOeffnen) UC.drawerOeffnen("response", id, "prompt-detail"); });

    /* EXPORT (wie dashboard-page.js): das Export-Fenster der App vor dem Klick einstellen. Die
       Tabelle exportiert mit p_prompt_id (Vorschlag an den DB-Chat), Chart und Citations wie auf
       dem Dashboard. Ohne Export-Fenster auf der Seite ein Satz statt eines toten Knopfs. */
    s.addEventListener("click", function (e) {
      var b = e.target && e.target.closest ? e.target.closest(".vot-export, .tcd-export, .urt-root .up-export") : null;
      var teil = b && b.closest(".vot-root, .tcd-root, .urt-root");
      if (!teil) return;
      var ex = document.querySelector(".uex-root[data-instance]");
      var k = ex ? str(ex.getAttribute("data-instance")).trim() : "";
      if (!k || /^[A-Z_]{3,}$/.test(k) || typeof window.upstreemExportOpen !== "function") {
        e.stopPropagation();
        if (UC.toast) UC.toast(t("Export isn't available on this page"), { kind: "neutral" });
        return;
      }
      teil.setAttribute("data-export-instance", k);
      var typ = teil.classList.contains("vot-root") ? "brands" : teil.classList.contains("urt-root") ? "prompt_runs"
        : (P.top.modus === "url" ? "urls" : "domains");
      try { if (window.upstreemExportSetContext) window.upstreemExportSetContext(k, { export_type: typ, prompt_id: P.id }); } catch (err) {}
    }, true);
  }

  UC.kernDrawer("prompt", {
    aufbauen: aufbauen,
    zeigen: function (id) {
      id = str(id).trim();
      if (!id) return;
      if (id !== P.id) {
        /* Ein anderer Prompt: Auswahl, Suche und Seiten gehoeren zum vorigen. Sortierung,
           Seitengroesse und D/W/M bleiben -- Vorlieben, keine Auswahl. */
        var alt = P.resp;
        P.id = id; P.zeile = null; P.fehler = "";
        P.vis.firmen = null; P.autoFirmen = [];
        P.top.citationTypen = null; P.top.urlTypen = null; P.top.erwaehnt = "all";
        P.resp = respStart(); P.resp.order = alt.order; P.resp.limit = alt.limit;
        ["resetVisibilityChart", "resetTopCitations", "resetResponsesTable"].forEach(function (n, i) {
          try { setter(n)([IDS.vot, IDS.tcd, IDS.urt][i]); } catch (e) {}
        });
      }
      kopfLaden(false);
      /* Erst wenn Kalender und Modelle stehen (sie richten sich einen Takt nach dem Drawer ein),
         sonst ginge der erste Abruf ohne Zeitraum hinaus und der zweite gleich hinterher.
         Hoechstens 1,5s; fehlt date-range.js, nehmen die RPCs ihre Vorgabe. */
      var n = 0;
      (function warten() {
        if (!kalender() && n++ < 50) { setTimeout(warten, 30); return; }
        kalenderLesen();
        var m = P.slot && P.slot.querySelector(".umf-root");
        try { if (m && m.__umfCtrl) setzen("modelle", modellAuswahl(m.__umfCtrl.getSelected())); } catch (e) {}
        alleLaden(false);
      })();
    },
    zu: function () {}
  });
  }

  uprdBoot(50);
})();
